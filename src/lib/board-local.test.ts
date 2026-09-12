import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BOARD_LOCAL_KEY,
  createEntry,
  addEntry,
  getLocalBoard,
  saveLocalBoard,
  optInLocalBoard,
  optOutLocalBoard,
  saveEntryLocal,
  clearLocalBoard,
  type BoardData,
  type BoardEntry
} from './board-local';

describe('board-local', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      clear: () => {
        store = {};
      }
    };
  })();

  beforeEach(() => {
    // @ts-ignore
    global.window = { localStorage: localStorageMock };
    // @ts-ignore
    global.localStorage = localStorageMock;
    localStorageMock.clear();
  });

  afterEach(() => {
    // @ts-ignore
    delete global.window;
    // @ts-ignore
    delete global.localStorage;
  });

  describe('createEntry', () => {
    it('creates an entry with default date', () => {
      const entry = createEntry('player1', 100, 'math-1');
      expect(entry.alias).toBe('player1');
      expect(entry.score).toBe(100);
      expect(entry.unitId).toBe('math-1');
      expect(entry.id).toBeDefined();
      expect(entry.date).toBeLessThanOrEqual(Date.now());
    });

    it('creates an entry with overridden date', () => {
      const entry = createEntry('player2', 200, undefined, 1000);
      expect(entry.alias).toBe('player2');
      expect(entry.score).toBe(200);
      expect(entry.unitId).toBeUndefined();
      expect(entry.date).toBe(1000);
    });
  });

  describe('addEntry', () => {
    it('adds and sorts entries correctly', () => {
      const entries: BoardEntry[] = [];
      const e1 = createEntry('p1', 50, undefined, 100);
      const e2 = createEntry('p2', 100, undefined, 200);
      const e3 = createEntry('p3', 100, undefined, 300);

      let updated = addEntry(entries, e1);
      expect(updated[0].alias).toBe('p1');

      updated = addEntry(updated, e2);
      expect(updated[0].alias).toBe('p2'); // 100 > 50

      updated = addEntry(updated, e3);
      // Both 100, but e3 is newer (300 > 200) so e3 first
      expect(updated[0].alias).toBe('p3');
      expect(updated[1].alias).toBe('p2');
      expect(updated[2].alias).toBe('p1');
    });

    it('respects maxEntries', () => {
      let entries: BoardEntry[] = [];
      for (let i = 0; i < 5; i++) {
        entries = addEntry(entries, createEntry(`p${i}`, i * 10), 3);
      }
      expect(entries.length).toBe(3);
      // The lowest scores should be dropped
      expect(entries[0].score).toBe(40);
      expect(entries[2].score).toBe(20);
    });
  });

  describe('getLocalBoard and saveLocalBoard', () => {
    it('returns default empty board if no data', () => {
      const board = getLocalBoard();
      expect(board.optIn).toBe(false);
      expect(board.entries).toEqual([]);
    });

    it('can save and retrieve board data', () => {
      const data: BoardData = {
        optIn: true,
        entries: [createEntry('x', 99)]
      };
      saveLocalBoard(data);
      const loaded = getLocalBoard();
      expect(loaded.optIn).toBe(true);
      expect(loaded.entries.length).toBe(1);
      expect(loaded.entries[0].alias).toBe('x');
      expect(loaded.entries[0].score).toBe(99);
    });

    it('handles corrupted data gracefully', () => {
      localStorageMock.setItem(BOARD_LOCAL_KEY, 'invalid json');
      const loaded = getLocalBoard();
      expect(loaded.optIn).toBe(false);
      expect(loaded.entries).toEqual([]);
    });

    it('returns empty when window is undefined', () => {
      // @ts-ignore
      global.window = undefined;
      const board = getLocalBoard();
      expect(board.optIn).toBe(false);
      expect(board.entries).toEqual([]);
    });
  });

  describe('Gate actions', () => {
    it('optInLocalBoard enables optIn', () => {
      optInLocalBoard();
      const board = getLocalBoard();
      expect(board.optIn).toBe(true);
    });

    it('optOutLocalBoard disables optIn and clears entries', () => {
      optInLocalBoard();
      saveEntryLocal('test', 10);
      expect(getLocalBoard().entries.length).toBe(1);

      optOutLocalBoard();
      const board = getLocalBoard();
      expect(board.optIn).toBe(false);
      expect(board.entries).toEqual([]);
    });

    it('clearLocalBoard clears entries but keeps optIn state', () => {
      optInLocalBoard();
      saveEntryLocal('test', 10);
      expect(getLocalBoard().entries.length).toBe(1);

      clearLocalBoard();
      const board = getLocalBoard();
      expect(board.optIn).toBe(true);
      expect(board.entries).toEqual([]);
    });
  });

  describe('saveEntryLocal', () => {
    it('does not save entry if not opted in', () => {
      saveEntryLocal('ghost', 999);
      const board = getLocalBoard();
      expect(board.entries.length).toBe(0);
    });

    it('saves entry if opted in', () => {
      optInLocalBoard();
      saveEntryLocal('player', 500, 'math-1');
      const board = getLocalBoard();
      expect(board.entries.length).toBe(1);
      expect(board.entries[0].alias).toBe('player');
      expect(board.entries[0].score).toBe(500);
      expect(board.entries[0].unitId).toBe('math-1');
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProgress,
  saveProgress,
  updateProgress,
  clearProgress,
  type StudyProgress
} from './study-progress';

describe('study-progress', () => {
  const mockStorage: Storage = {
    length: 0,
    clear: function(): void {
      this.store = {};
    },
    getItem: function(key: string): string | null {
      return this.store[key] || null;
    },
    key: function(index: number): string | null {
      return Object.keys(this.store)[index] || null;
    },
    removeItem: function(key: string): void {
      delete this.store[key];
    },
    setItem: function(key: string, value: string): void {
      this.store[key] = value;
    },
    store: {} as Record<string, string>
  } as Storage & { store: Record<string, string> };

  beforeEach(() => {
    mockStorage.clear();
  });

  const unitId = 'test-unit-1';

  it('should retrieve null when no progress is saved', () => {
    const progress = getProgress(mockStorage, unitId);
    expect(progress).toBeNull();
  });

  it('should save and retrieve progress for a unit_id', () => {
    const data: StudyProgress = {
      completedItems: ['item1', 'item2'],
      score: 85,
      lastAccessed: 1234567890
    };

    saveProgress(mockStorage, unitId, data);
    const retrieved = getProgress(mockStorage, unitId);

    expect(retrieved).toEqual(data);
  });

  it('should return null if data is corrupted', () => {
    mockStorage.setItem(`pisastyle:progress:${unitId}`, 'invalid json');
    const progress = getProgress(mockStorage, unitId);
    expect(progress).toBeNull();
  });

  it('should update progress for an existing unit_id', () => {
    const initialData: StudyProgress = {
      completedItems: ['item1'],
      score: 50,
      lastAccessed: 1000
    };
    saveProgress(mockStorage, unitId, initialData);

    const updated = updateProgress(mockStorage, unitId, {
      completedItems: ['item1', 'item2'],
      score: 75
    });

    expect(updated.completedItems).toEqual(['item1', 'item2']);
    expect(updated.score).toBe(75);
    expect(updated.lastAccessed).toBeGreaterThan(1000);

    const retrieved = getProgress(mockStorage, unitId);
    expect(retrieved).toEqual(updated);
  });

  it('should initialize and update progress if none exists', () => {
    const updated = updateProgress(mockStorage, unitId, {
      completedItems: ['item1']
    });

    expect(updated.completedItems).toEqual(['item1']);
    expect(updated.lastAccessed).toBeDefined();

    const retrieved = getProgress(mockStorage, unitId);
    expect(retrieved).toEqual(updated);
  });

  it('should clear progress for a unit_id', () => {
    const data: StudyProgress = {
      completedItems: ['item1'],
      lastAccessed: 12345
    };
    saveProgress(mockStorage, unitId, data);

    expect(getProgress(mockStorage, unitId)).not.toBeNull();

    clearProgress(mockStorage, unitId);

    expect(getProgress(mockStorage, unitId)).toBeNull();
  });
});

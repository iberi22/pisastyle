/**
 * Browser-side state machine for an exam session.
 *
 * — WHY A MODULE —
 * `/evaluar` is SSR with GET: the whole quiz lives in the URL and dies on
 * reload. A real exam needs more than that (answers, a cursor, a review flag),
 * so the state moves into the browser and this module owns it. Everything here
 * is pure and immutable so it can be unit-tested without mounting anything.
 *
 * — WHY NO DEPENDENCIES —
 * This file imports nothing. Not from `pisa-i18n`, not from an item bundle, not
 * from a store. The item catalog is being written in parallel and binding this
 * module to it would make both untestable until they landed, so the shape of an
 * item is declared LOCALLY as a structural minimum (`ExamItemLike`): anything
 * with an `id`, a `domain` and a `correctOptionId` satisfies it. Passing the
 * real catalog items works with zero changes; so does a test literal.
 *
 * — PRIVACY (product requirement, not a suggestion) —
 * No accounts, no tracking, no identifiers, no timestamps, no user profile.
 * Only the in-browser exam state, keyed per locale. It never leaves the device.
 */

/** The three PISA domains. Kept as a string union so callers may use their own. */
export type DomainKey = 'math' | 'reading' | 'science';

/** Any domain id, including future ones: keys are open. */
export type DomainId = DomainKey | (string & {});

/**
 * Minimum shape this module needs from an item. Structural on purpose: the
 * real catalog type satisfies it without importing it.
 */
export interface ExamItemLike {
  /** Stable id, unique inside an exam. */
  readonly id: string;
  /** Domain bucket this item is scored in. */
  readonly domain: DomainId;
  /** Id of the correct option; compared against the selected option id. */
  readonly correctOptionId?: string;
}

/** The whole exam session. Plain data: safe to JSON-serialize and to compare. */
export interface ExamState {
  /** itemId -> selected optionId. */
  answers: Record<string, string>;
  /** itemId -> true when marked for review. Only true values are stored. */
  flagged: Record<string, boolean>;
  /** Cursor position in the item list. Always >= 0. */
  currentIndex: number;
}

/** Progress counters for the progress bar. */
export interface Progress {
  answered: number;
  total: number;
  /** Integer 0-100. Rounded half-up so 2/3 shows 67, not 66.6. */
  pct: number;
}

/** Per-domain scoring result. */
export interface DomainScore {
  /** Items answered correctly in this domain. */
  correct: number;
  /** Items in this domain (answered or not). */
  total: number;
  /** Estimated PISA level for this domain, or null when nothing was scored. */
  level: Level | null;
  /** Tone for the level chip, aligned with `level`. */
  tone: Tone | null;
}

/** Estimated performance level, PISA scale 1c..6. */
export type Level = '1c' | '1b' | '1a' | '2' | '3' | '4' | '5' | '6';

/** Visual tone of a level chip. */
export type Tone = 'low' | 'mid' | 'good' | 'top';

/** localStorage namespace. Per-locale key is `${STORAGE_PREFIX}:${locale}`. */
export const STORAGE_PREFIX = 'pisastyle:examen';

/**
 * Correct answers (0..5) -> estimated level.
 *
 * These are NOT the OECD cut scores of Protocol v1.1 §3 (233-607): those live
 * on the PISA scale and do not apply to a 5-question test. Mapping 5/5 onto 607
 * landed on level 1c, which is absurd. This table is an orientation estimate,
 * not official data, and the UI says so.
 *
 * Direct mapping, no interpolation: 6 possible results, 6 levels. That is
 * exactly what fits without faking precision.
 *
 * Extracted verbatim from `src/pages/[locale]/evaluar.astro` (LEVEL_BY_SCORE),
 * where the logic is already reviewed, instead of inventing a second scale that
 * would disagree with the page the student already used.
 */
export const LEVEL_BY_SCORE = ['1c', '1b', '2', '3', '4', '5'] as const;

/** Chip tone per number of correct answers. Indexes aligned with LEVEL_BY_SCORE. */
export const TONE_BY_SCORE = ['low', 'low', 'mid', 'mid', 'good', 'top'] as const;

/** Highest index of LEVEL_BY_SCORE: any bundle scores 0..5 points per domain. */
const MAX_LEVEL_SLOT = LEVEL_BY_SCORE.length - 1;

/* ————————————————————————————————— immutability helpers ————————————————————————— */

/** True for plain, non-null objects (not arrays, not null, not class instances). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Shallow copy of a string-valued map, dropping every non-string entry. */
function sanitizeAnswers(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(value)) return out;
  for (const [key, optionId] of Object.entries(value)) {
    if (typeof optionId === 'string' && key !== '') out[key] = optionId;
  }
  return out;
}

/** Shallow copy of a boolean map, dropping every non-boolean entry. */
function sanitizeFlagged(value: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isRecord(value)) return out;
  for (const [key, flag] of Object.entries(value)) {
    if (typeof flag === 'boolean' && key !== '') out[key] = flag;
  }
  return out;
}

/** A fresh copy of the whole state. Callers can mutate the result safely. */
function cloneState(state: ExamState): ExamState {
  return {
    answers: { ...state.answers },
    flagged: { ...state.flagged },
    currentIndex: state.currentIndex,
  };
}

/**
 * Clamp an index into [0, total-1]. Out-of-range input is cropped, never
 * thrown on: a cursor of -1 or 999 must not break the page. When there is
 * nothing to point at (total < 1) the answer is 0.
 */
function clampIndex(index: number, total: number): number {
  const max = total > 0 ? total - 1 : 0;
  if (typeof index !== 'number' || Number.isNaN(index)) return 0;
  // Infinity keeps clamp semantics: it crops to the boundary it points at.
  const int = Math.trunc(index);
  if (int < 0) return 0;
  if (int > max) return max;
  return int;
}

/** True when an item has an answer recorded. Unknown ids are simply not answered. */
export function isAnswered(state: ExamState, itemId: string): boolean {
  return typeof state.answers[itemId] === 'string';
}

/** Number of items marked for review. */
export function flaggedCount(state: ExamState): number {
  return Object.values(state.flagged).filter(Boolean).length;
}

/* ——————————————————————————————————— state ————————————————————————————————————— */

/** An empty session: no answers, no flags, cursor at the first item. */
export function createState(): ExamState {
  return { answers: {}, flagged: {}, currentIndex: 0 };
}

/** A validated copy of `state`. Handy at the boundary of untyped input. */
export function normalizeState(state: ExamState): ExamState {
  return {
    answers: sanitizeAnswers(state.answers),
    flagged: sanitizeFlagged(state.flagged),
    currentIndex: state.currentIndex > 0 ? Math.trunc(state.currentIndex) : 0,
  };
}

/** Drops every answer and flag and sends the cursor back to the first item. */
export function resetState(): ExamState {
  return createState();
}

/* —————————————————————————————— transitions (pure) ————————————————————————————— */

/**
 * Record `optionId` as the answer for `itemId`. Re-selecting another option
 * replaces it; the previous state is not mutated.
 */
export function selectOption(state: ExamState, itemId: string, optionId: string): ExamState {
  if (itemId === '' || typeof optionId !== 'string') return cloneState(state);
  return { ...cloneState(state), answers: { ...state.answers, [itemId]: optionId } };
}

/** Forget the answer of a single item, leaving the rest of the session alone. */
export function clearAnswer(state: ExamState, itemId: string): ExamState {
  if (!(itemId in state.answers)) return cloneState(state);
  const answers = { ...state.answers };
  delete answers[itemId];
  return { ...cloneState(state), answers };
}

/**
 * Flip the review flag of `itemId`. Unflagging removes the key instead of
 * storing `false`, so the serialized payload stays small.
 */
export function toggleFlag(state: ExamState, itemId: string): ExamState {
  if (itemId === '') return cloneState(state);
  const flagged = { ...state.flagged };
  if (flagged[itemId]) delete flagged[itemId];
  else flagged[itemId] = true;
  return { ...cloneState(state), flagged };
}

/** Move the cursor to `index`, clamped to [0, total-1]. */
export function goTo(state: ExamState, index: number, total: number): ExamState {
  return { ...cloneState(state), currentIndex: clampIndex(index, total) };
}

/** Move the cursor one item forward. At the last item it stays put. */
export function next(state: ExamState, total: number): ExamState {
  return goTo(state, state.currentIndex + 1, total);
}

/** Move the cursor one item back. At the first item it stays put. */
export function prev(state: ExamState, total: number): ExamState {
  return goTo(state, state.currentIndex - 1, total);
}

/** Cursor at the last item? */
export function isLast(state: ExamState, total: number): boolean {
  return state.currentIndex >= clampIndex(Number.MAX_SAFE_INTEGER, total);
}

/** Every item answered? With no items there is nothing left to answer. */
export function isComplete(state: ExamState, items: readonly ExamItemLike[]): boolean {
  return items.length > 0 && items.every((item) => isAnswered(state, item.id));
}

/* ————————————————————————————————— metrics ————————————————————————————————— */

/** Answered / total / percentage for the progress bar. */
export function progress(state: ExamState, total: number): Progress {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.trunc(total) : 0;
  const answered = safeTotal > 0 ? Math.min(Object.keys(state.answers).length, safeTotal) : 0;
  const pct = safeTotal > 0 ? Math.round((answered / safeTotal) * 100) : 0;
  return { answered, total: safeTotal, pct };
}

/** Ids of items already answered, restricted to the given item list. */
export function answeredIds(state: ExamState, items: readonly ExamItemLike[]): string[] {
  return items.filter((item) => isAnswered(state, item.id)).map((item) => item.id);
}

/** Ids of items marked for review, in item order. */
export function flaggedIds(state: ExamState, items: readonly ExamItemLike[]): string[] {
  return items.filter((item) => state.flagged[item.id] === true).map((item) => item.id);
}

/** How many answers were given per domain, counting every item of that domain. */
export function answeredByDomain(
  state: ExamState,
  items: readonly ExamItemLike[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    if (out[item.domain] === undefined) out[item.domain] = 0;
    if (isAnswered(state, item.id)) out[item.domain] += 1;
  }
  return out;
}

/**
 * Correct answers per domain, plus the estimated level.
 *
 * Only answered items count as correct or as incorrect: an unanswered item is
 * simply absent from the score, so a student who answered 2 of 5 is not punished
 * for the 3 they skipped. Unanswered items still count towards `total`.
 *
 * The number of correct answers doubles as the index into LEVEL_BY_SCORE and
 * TONE_BY_SCORE, so no second conversion is needed. Indexes past the table are
 * cropped to the last slot.
 */
export function scoreByDomain(
  state: ExamState,
  items: readonly ExamItemLike[],
): Record<string, DomainScore> {
  const scores: Record<string, DomainScore> = {};
  for (const item of items) {
    const entry = scores[item.domain] ?? { correct: 0, total: 0, level: null, tone: null };
    entry.total += 1;
    const chosen = state.answers[item.id];
    if (typeof chosen === 'string' && item.correctOptionId !== undefined && chosen === item.correctOptionId) {
      entry.correct += 1;
    }
    scores[item.domain] = entry;
  }
  for (const entry of Object.values(scores)) {
    if (entry.total === 0) continue;
    entry.level = levelForScore(entry.correct);
    entry.tone = toneForScore(entry.correct);
  }
  return scores;
}

/**
 * Index into the level tables for a raw number of correct answers. Out-of-range
 * and fractional input is cropped, so a domain with more items than the table
 * cannot overflow it.
 */
function levelSlot(correct: number): number {
  if (typeof correct !== 'number' || Number.isNaN(correct)) return 0;
  return Math.min(Math.max(Math.trunc(correct), 0), MAX_LEVEL_SLOT);
}

/** Level for a raw number of correct answers. Out-of-range input is cropped. */
export function levelForScore(correct: number): Level {
  return LEVEL_BY_SCORE[levelSlot(correct)];
}

/** Tone for a raw number of correct answers. Indexes aligned with the level. */
export function toneForScore(correct: number): Tone {
  return TONE_BY_SCORE[levelSlot(correct)];
}

/* ————————————————————————————————— persistence ——————————————————————————————— */

/**
 * localStorage is absent in SSR (workerd) and throws when the user blocks it
 * (Safari private mode throws on write, not on read).
 */
function safeStore(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__pisastyle_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

/** Storage key for a locale, e.g. `pisastyle:examen:es`. */
export function storageKey(locale: string): string {
  return `${STORAGE_PREFIX}:${locale}`;
}

/**
 * Serialize a session to a string. Output shape is stable and self-describing
 * so a truncated payload can be detected on the way back in.
 */
export function serialize(state: ExamState): string {
  const clean = normalizeState(state);
  return JSON.stringify({
    v: 1,
    answers: clean.answers,
    flagged: clean.flagged,
    currentIndex: clean.currentIndex,
  });
}

/**
 * Rebuild a session from a stored string.
 *
 * NEVER throws. localStorage can hold another app's junk, a truncated write or
 * a hand-edited value, and this product has no login: a corrupt state must not
 * be able to break the page. Anything that is not a valid ExamState yields null,
 * and the caller starts a fresh session.
 *
 * Strict on the three fields: a missing or mistyped `answers`, `flagged` or
 * `currentIndex` means the payload is not a session and is rejected. Entry-level
 * noise inside a valid container is dropped rather than rejected.
 */
export function deserialize(raw: string | null | undefined): ExamState | null {
  if (typeof raw !== 'string' || raw === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (!isRecord(parsed.answers) || !isRecord(parsed.flagged)) return null;
  const index = parsed.currentIndex;
  if (typeof index !== 'number' || !Number.isFinite(index) || index < 0) return null;
  return {
    answers: sanitizeAnswers(parsed.answers),
    flagged: sanitizeFlagged(parsed.flagged),
    currentIndex: Math.trunc(index),
  };
}

/**
 * Read the session for a locale. Returns null when there is nothing stored, the
 * storage is unavailable or the stored value is corrupt.
 */
export function loadState(locale: string): ExamState | null {
  const store = safeStore();
  if (!store) return null;
  try {
    return deserialize(store.getItem(storageKey(locale)));
  } catch {
    return null;
  }
}

/** Persist the session for a locale. Silently gives up on quota or blocked storage. */
export function saveState(locale: string, state: ExamState): void {
  const store = safeStore();
  if (!store) return;
  try {
    store.setItem(storageKey(locale), serialize(state));
  } catch {
    /* quota full or storage denied: not saving must not break the page */
  }
}

/** Forget the stored session for a locale. */
export function clearState(locale: string): void {
  const store = safeStore();
  if (!store) return;
  try {
    store.removeItem(storageKey(locale));
  } catch {
    /* idem */
  }
}

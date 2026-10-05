import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  EXAM_DOMAINS,
  EXAM_ITEMS,
  EXAM_LOCALES,
  correctText,
  distractorTexts,
  examByDomain,
  type ExamItem,
  type ExamLocale,
} from './exam-items';

/**
 * The self-assessment items may not drift while being extracted.
 *
 * — WHY THIS FILE EXISTS —
 * The fifteen items moved out of src/pages/[locale]/evaluar.astro into
 * src/lib/exam-items.ts. A move is the easy part; the dangerous part is that a
 * "harmless tidy-up" inside a data literal changes an ANSWER KEY or drops a
 * distractor, and nothing in the type system, the build or a typo check notices:
 * `['32 m', '28 m'], 1` still compiles when `1` should be `0`.
 *
 * The repo has audited these keys against real arithmetic, so the tests below
 * are a FROZEN SNAPSHOT of that state, not a re-statement of what the module
 * happens to say. FINGERPRINTS_TEST hashes come from the literals as they were
 * in evaluar.astro; SNAPSHOT_* below is the same data recorded as
 * human-readable structure. If an item is edited, reordered or lost, one of
 * these fails and the change has to be argued for out loud instead of slipping
 * through.
 *
 * BASELINE: 09f7437, the commit that holds evaluar.astro when this module was
 * last synced. It is a MOVING baseline on purpose: the page it mirrors is still
 * the source of truth, so a content fix landing upstream (09f7437 replaced the
 * duplicate-looking distractor "3/4" with "15/4" and fixed two Spanish stems)
 * has to be re-fingerprinted on purpose rather than silently absorbed.
 */

/** sha256 over [stem, options, correctIndex] — the whole answer key of an item. */
const fingerprints = (item: ExamItem): string =>
  createHash('sha256')
    .update(JSON.stringify([item.stem, item.options, item.correctIndex]))
    .digest('hex')
    .slice(0, 16);

/** sha256 over [correct option text, option count] of an item, locale-blind. */
const keyFingerprint = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 10);

/**
 * Per-item answer-key fingerprints, recorded from evaluar.astro @ 071eac0.
 * Grouped by locale, then by domain, in the source order of the questions.
 */
const FINGERPRINTS_TEST: Record<ExamLocale, Record<string, string[]>> = {
  es: {
    math: ['7b936403a6b7a61c', '1f27edbdc88b41b9', 'ebdb87e6d073de3b', '64e669d77d1b9ffe', '4665f77a43da13c3'],
    reading: ['a5e8823b284f6ad3', '3e8bfab9e49a4269', 'e372b5bd24cd2d4e', '0d2d2744d37c673d', 'f8cee519e9edd73e'],
    science: ['8fc219562f9d2f11', 'd47162f64c87b1a3', '1d6cb77e891b64d4', '80033ddabf61f776', 'a1bac45311a679fe'],
  },
  en: {
    math: ['92cf0cf3c45079bd', '554230b2f75cc384', '53a7a9575b01c2a7', 'af5f0ee3a326613a', '88bebe486df4eeb9'],
    reading: ['5c054603e0cea1bf', 'b943c0ce4106dbb8', 'f0c40a222ac3382a', 'ffaf1ef82b459d33', 'cd55d25d154f2e97'],
    science: ['6c2e08d495402111', '018c8ef6832ab412', 'de9d4b17a4b35282', '76a8c4b47cb7b2a2', 'e980e7c596c3a951'],
  },
  pt: {
    math: ['cc5a4437246f4fb0', '59b6c748062ea1ca', '8ea6cf7ea596ad22', '3772bee4e47f88f2', 'eccb5102381831b7'],
    reading: ['477960fc04709b83', '77cd7e9a1a390560', '31a1b835a973a5d8', '6810baab65cdd3c8', '601ebc148b468353'],
    science: ['8f6f31af0503545f', 'dd942d0aa4b0d02a', 'd930040666e64b9d', 'f5d43ed21c2ae0a2', '2e1a187129e1c6f0'],
  },
};

/** sha256 over the whole flat [stem, options, correctIndex] list per locale. */
const LOCALE_DIGEST_TEST: Record<ExamLocale, string> = {
  es: 'c7657d838c56b7144cc9926842991b01a3d949ef956bf330a873b0c404941965',
  en: '2f4f46d953a931f699c161d920f0d23eb2e59db640cd9fad87831af28cad572b',
  pt: '67785ac4cd8bffe535a40f0964d03e9aa203a2933efdefc050cd11b1b6bfcade',
};

/**
 * Answer-key fingerprints of the MATH items, which are locale-invariant.
 *
 * Every math option is a number ("32 m", "15/20", "350 km"), so the same answer
 * is BYTE-IDENTICAL in es/en/pt — unlike reading and science, whose options are
 * translated sentences. Only math can assert equality of the correct text, and
 * it must: a math key that differs between locales is a real extraction bug,
 * because no translator could have caused it.
 */
const MATH_CORRECT_TEXT_TEST: Record<ExamLocale, string[]> = {
  es: ['6f6a5281b6', '9ba5f532f7', 'f6f984a412', 'd4dd6adff6', '4edc30f407'],
  en: ['6f6a5281b6', '9ba5f532f7', 'f6f984a412', 'd4dd6adff6', '4edc30f407'],
  pt: ['6f6a5281b6', '9ba5f532f7', 'f6f984a412', 'd4dd6adff6', '4edc30f407'],
};

/** Domain labels as declared in the source `domains` of each locale. */
const DOMAIN_LABELS_TEST: Record<ExamLocale, Record<string, string>> = {
  es: { math: 'Matemáticas', reading: 'Lectura', science: 'Ciencias' },
  en: { math: 'Mathematics', reading: 'Reading', science: 'Science' },
  pt: { math: 'Matemática', reading: 'Leitura', science: 'Ciências' },
};

/** What to call an item in a failure message. */
const label = (item: ExamItem): string => `${item.id} (${item.domain}[${item.index}])`;

describe('EXAM_ITEMS shape', () => {
  it('serves exactly the three locales es, en and pt', () => {
    expect(Object.keys(EXAM_ITEMS).sort()).toEqual(['en', 'es', 'pt']);
    expect(EXAM_LOCALES).toEqual(['es', 'en', 'pt']);
  });

  it('has 15 items per locale', () => {
    for (const loc of EXAM_LOCALES) {
      expect(EXAM_ITEMS[loc], `locale ${loc}`).toHaveLength(15);
    }
  });

  it('has three domains of five items per locale', () => {
    for (const loc of EXAM_LOCALES) {
      const byDomain = examByDomain(EXAM_ITEMS[loc]);
      for (const { key } of EXAM_DOMAINS) {
        expect(byDomain[key], `${loc}/${key}`).toHaveLength(5);
      }
    }
  });

  it('declares the three domains in presentation order math, reading, science', () => {
    expect(EXAM_DOMAINS.map((d) => d.key)).toEqual(['math', 'reading', 'science']);
    for (const domain of EXAM_DOMAINS) {
      expect(Object.keys(domain.label).sort()).toEqual(['en', 'es', 'pt']);
      for (const loc of EXAM_LOCALES) {
        expect(domain.label[loc], `${domain.key}/${loc}`).toBeTruthy();
      }
    }
  });

  it('labels every item with the domain label of its own locale', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(item.domainLabel, label(item)).toBe(DOMAIN_LABELS_TEST[loc][item.domain]);
      }
    }
  });

  it('numbers items 0..4 inside their domain and gives each a stable id', () => {
    for (const loc of EXAM_LOCALES) {
      const byDomain = examByDomain(EXAM_ITEMS[loc]);
      for (const { key } of EXAM_DOMAINS) {
        const items = byDomain[key];
        expect(items.map((i) => i.index), `${loc}/${key}`).toEqual([0, 1, 2, 3, 4]);
        // level is the 1-based position (an estimation, documented on ExamItem).
        expect(items.map((i) => i.level), `${loc}/${key}`).toEqual([1, 2, 3, 4, 5]);
        expect(items.map((i) => i.id), `${loc}/${key}`).toEqual(
          items.map((_, n) => `${key}-${n + 1}`),
        );
      }
    }
  });

  it('is flat and grouped by domain in presentation order', () => {
    for (const loc of EXAM_LOCALES) {
      expect(EXAM_ITEMS[loc].map((i) => i.domain), loc).toEqual([
        'math', 'math', 'math', 'math', 'math',
        'reading', 'reading', 'reading', 'reading', 'reading',
        'science', 'science', 'science', 'science', 'science',
      ]);
    }
  });
});

describe('EXAM_ITEMS answer keys are well formed', () => {
  it('gives every item exactly four options', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(item.options, label(item)).toHaveLength(4);
      }
    }
  });

  it('keeps every correctIndex inside its own options array', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(Number.isInteger(item.correctIndex), label(item)).toBe(true);
        expect(item.correctIndex, label(item)).toBeGreaterThanOrEqual(0);
        expect(item.correctIndex, label(item)).toBeLessThan(item.options.length);
      }
    }
  });

  it('never repeats an option inside an item', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(new Set(item.options).size, label(item)).toBe(item.options.length);
      }
    }
  });

  it('has a non-empty stem and no stray whitespace around options', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(item.stem.trim(), label(item)).toBe(item.stem);
        expect(item.stem.length, label(item)).toBeGreaterThan(0);
        for (const opt of item.options) {
          expect(opt.trim(), label(item)).toBe(opt);
          expect(opt.length, label(item)).toBeGreaterThan(0);
        }
      }
    }
  });

  it('leaves the explanation empty, because the source data has none', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(item.explanation, label(item)).toBe('');
      }
    }
  });

  it('shuffles the options, so correctIndex is genuinely per locale', () => {
    // The three locales shuffle DIFFERENTLY on purpose. If every locale shared
    // one option order, a shuffle regression in a single locale would go
    // unnoticed — and this file is the single source of truth for those keys.
    const orders = EXAM_LOCALES.map((loc) => EXAM_ITEMS[loc].map((i) => i.correctIndex).join(','));
    expect(new Set(orders).size, `orders: ${orders.join(' | ')}`).toBe(3);
  });
});

describe('the three locales translate the same fifteen items', () => {
  it('aligns one-to-one by domain and index', () => {
    const reference = EXAM_ITEMS.es.map((i) => `${i.domain}-${i.index}`);
    for (const loc of EXAM_LOCALES) {
      expect(EXAM_ITEMS[loc].map((i) => `${i.domain}-${i.index}`), loc).toEqual(reference);
    }
  });

  it('uses the SAME id for the same item in every locale', () => {
    const reference = EXAM_ITEMS.es.map((i) => i.id);
    for (const loc of EXAM_LOCALES) {
      expect(EXAM_ITEMS[loc].map((i) => i.id), loc).toEqual(reference);
    }
  });

  it('gives the same correct-option TEXT across locales for every math item', () => {
    // Math options are numeric ("32 m"), so translation cannot change them. A
    // mismatch here would be a lost item or a wrong key in one locale.
    for (let i = 0; i < 5; i++) {
      const texts = EXAM_LOCALES.map((loc) => correctText(itemAt(loc, 'math', i)));
      expect(new Set(texts).size, `math[${i}]: ${texts.join(' / ')}`).toBe(1);
    }
  });

  it('keeps the math correct index pointing at that same text, not the same position', () => {
    // The shuffle is per locale, so the INDEX legitimately differs (1/0/3) while
    // the TEXT does not. Guarding both halves catches an off-by-one in either.
    const indices = EXAM_LOCALES.map((loc) => itemAt(loc, 'math', 0).correctIndex);
    expect(indices).toEqual([1, 0, 3]);
  });

  it('offers the same set of four math options in every locale', () => {
    for (let i = 0; i < 5; i++) {
      const sets = EXAM_LOCALES.map((loc) => [...itemAt(loc, 'math', i).options].sort().join('|'));
      expect(new Set(sets).size, `math[${i}] options: ${sets.join(' / ')}`).toBe(1);
    }
  });

  it('translates reading and science options instead of reusing them verbatim', () => {
    // Reading and science options are sentences, so their correct text MUST
    // differ per locale. If it ever stopped differing, someone had pasted the
    // Spanish list into the other locales and this test would catch it.
    for (const domain of ['reading', 'science'] as const) {
      const texts = EXAM_LOCALES.map((loc) => correctText(itemAt(loc, domain, 0)));
      expect(new Set(texts).size, `${domain}[0]: ${texts.join(' / ')}`).toBe(3);
    }
  });

  it('never reuses one question stem across locales', () => {
    for (let i = 0; i < 15; i++) {
      const stems = EXAM_LOCALES.map((loc) => EXAM_ITEMS[loc][i].stem);
      expect(new Set(stems).size, `item ${i} stems: ${stems.join(' / ')}`).toBe(3);
    }
  });
});

describe('the extraction lost nothing', () => {
  it('matches the frozen per-item answer-key fingerprints', () => {
    for (const loc of EXAM_LOCALES) {
      const byDomain = examByDomain(EXAM_ITEMS[loc]);
      for (const { key } of EXAM_DOMAINS) {
        const actual = byDomain[key].map(fingerprints);
        expect(actual, `${loc}/${key}`).toEqual(FINGERPRINTS_TEST[loc][key]);
      }
    }
  });

  it('matches the frozen per-locale digest of the whole list', () => {
    for (const loc of EXAM_LOCALES) {
      const flat = ['math', 'reading', 'science'].flatMap((d) => EXAM_ITEMS[loc].filter((i) => i.domain === d));
      const serialized = JSON.stringify(flat.map((i) => [i.stem, i.options, i.correctIndex]));
      expect(createHash('sha256').update(serialized).digest('hex'), loc).toBe(LOCALE_DIGEST_TEST[loc]);
    }
  });

  it('matches the frozen answer-key fingerprints of the math items', () => {
    for (const loc of EXAM_LOCALES) {
      const byDomain = examByDomain(EXAM_ITEMS[loc]);
      const actual = byDomain.math.map((i) => keyFingerprint(correctText(i)));
      expect(actual, loc).toEqual(MATH_CORRECT_TEXT_TEST[loc]);
    }
  });
});

describe('examByDomain', () => {
  it('returns five items per domain and an entry for every domain', () => {
    const byDomain = examByDomain(EXAM_ITEMS.es);
    expect(Object.keys(byDomain).sort()).toEqual(['math', 'reading', 'science']);
    for (const key of ['math', 'reading', 'science'] as const) {
      expect(byDomain[key], key).toHaveLength(5);
    }
  });

  it('keeps the input order inside a domain', () => {
    const byDomain = examByDomain(EXAM_ITEMS.es);
    expect(byDomain.math.map((i) => i.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('does not mutate or share the input array', () => {
    const input = [...EXAM_ITEMS.es];
    const byDomain = examByDomain(input);
    byDomain.math.push(input[0]);
    expect(input).toHaveLength(15);
    expect(byDomain.math).toHaveLength(6);
  });

  it('handles an empty list without throwing', () => {
    expect(examByDomain([])).toEqual({ math: [], reading: [], science: [] });
  });
});

describe('correctText', () => {
  it('returns text that is present in the options', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(item.options, label(item)).toContain(correctText(item));
      }
    }
  });

  it('returns the option the correctIndex points at', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(correctText(item), label(item)).toBe(item.options[item.correctIndex]);
      }
    }
  });
});

describe('distractorTexts', () => {
  it('never includes the correct option', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(distractorTexts(item).map((o) => o.text), label(item)).not.toContain(correctText(item));
      }
    }
  });

  it('returns the other three options with the index they occupy', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        const got = distractorTexts(item);
        expect(got, label(item)).toHaveLength(item.options.length - 1);
        for (const { index, text } of got) {
          expect(item.options[index], label(item)).toBe(text);
          expect(index, label(item)).not.toBe(item.correctIndex);
        }
      }
    }
  });

  it('holds exactly the options the correct one does not', () => {
    for (const loc of EXAM_LOCALES) {
      for (const item of EXAM_ITEMS[loc]) {
        expect(distractorTexts(item).map((o) => o.text).sort(), label(item)).toEqual(
          item.options.filter((_, i) => i !== item.correctIndex).sort(),
        );
      }
    }
  });
});

/** Item at a (domain, 0-based index) position in a locale. */
function itemAt(loc: ExamLocale, domain: string, index: number): ExamItem {
  const found = EXAM_ITEMS[loc].find((i) => i.domain === domain && i.index === index);
  if (!found) throw new Error(`missing item ${domain}[${index}] in ${loc}`);
  return found;
}
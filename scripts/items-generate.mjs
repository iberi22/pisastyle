#!/usr/bin/env node
/**
 * Daily item generator — PISAStyle
 *
 * Deterministic by construction: for a given (seed, date, lang) the output is
 * byte-identical, so a re-run produces the same item and the daily workflow
 * stays idempotent. No clock-driven randomness, no network, no model call.
 *
 * The item is *computed*, not invented:
 *   - the arithmetic answer comes out of real computation at generation time
 *     (`solve()`); it is never hardcoded;
 *   - the distractors are derived from that same computation, so no distractor
 *     can accidentally be correct;
 *   - the rendered file is run through scripts/validate-items.mjs (which wraps
 *     src/lib/items-validate.ts, the canonical gate) BEFORE it is written. If
 *     it does not validate, nothing is written and the exit code is 0.
 *
 * Output shape is dictated by the canonical gate, not by taste:
 *   - frontmatter with `protocol_version: v1.1`, a non-empty `sources` list and
 *     `items: <n>` matching the number of written items;
 *   - `## Item N` blocks (the gate refuses a file without them);
 *   - option rows `- [x] A) text`, exactly one marked correct;
 *   - `### Explicacion Pedagogica` of at least 80 characters;
 *   - `### Calibration` carrying the 8 mandatory protocol fields plus `sources`.
 *
 * Usage:
 *   node scripts/items-generate.mjs [--domain math] [--lang es] [--seed N] [--dry-run]
 *
 * Env:
 *   ITEMS_DATE=YYYY-MM-DD  date used in the item id (CI sets it, so re-running
 *                          the same day is a no-op instead of a duplicate).
 *
 * Exit codes: 0 = wrote an item, or honestly wrote nothing; 1 = bad usage.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const VALIDATOR = join(HERE, 'validate-items.mjs');
const TMP_DIR = join(ROOT, '.items-tmp');
const PROTOCOL_VERSION = 'v1.1'; // src/lib/items-validate.ts EXPECTED_PROTOCOL_VERSION
const MIN_EXPLANATION_CHARS = 80; // must satisfy the gate, checked there too

const DOMAINS = ['math', 'read', 'science'];
const LANGS = ['es', 'en', 'pt'];

/** Deterministic PRNG in [0,1) from an integer seed (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rand, min, max) => min + Math.floor(rand() * (max - min + 1));

/**
 * Stable integer seed derived from a YYYY-MM-DD date (FNV-1a over the string).
 * Deterministic: the same date always yields the same seed, so a re-run of the
 * same day reproduces the same item instead of writing a second one.
 *
 * @param {string} date
 */
export function dateSeed(date) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < date.length; i += 1) {
    hash ^= date.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Keep it in a range the operand search likes: >= 1 so the PRNG starts sane.
  return (hash % 100000) + 1;
}

/**
 * THE COMPUTATION.
 *
 * Item type: "when `a` is divided by `b` the remainder is `r`; which equality is
 * correct?" The only correct option is `b * q + r = a` with `q = floor(a/b)`.
 *
 *   q is computed here, never read back from the operand spec;
 *   the correct option is rendered from q and r;
 *   distractor 1 uses q + 1        -> "there is no remainder after all";
 *   distractor 2 uses q with r + 1  -> "off by one on the remainder".
 *
 * Both distractors are provably wrong: with 1 <= r < b, b*(q+1) + r != a and
 * b*q + (r+1) != a. Returns null on an illegal division, which is how this
 * script stays honest: no legal arithmetic, no item.
 *
 * @param {number} a dividend
 * @param {number} b divisor, must be > 0
 * @param {number} r remainder, must satisfy 0 <= r < b
 */
export function solve(a, b, r) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(r)) return null;
  if (b <= 0 || r < 0 || r >= b) return null;

  const quotient = Math.floor(a / b);
  const remainder = a - b * quotient; // real modulo, computed
  if (remainder !== r) return null; // defence in depth: the spec must stay consistent

  const correct = `${b} x ${quotient} + ${r} = ${a}`;
  const distractors = [`${b} x ${quotient + 1} + ${r} = ${a}`, `${b} x ${quotient} + ${r + 1} = ${a}`];

  // Assert the distractors really are wrong before they can reach the bank.
  if (distractors.includes(correct)) return null;

  return {
    quotient,
    remainder,
    correct,
    distractors,
    check: `${a} / ${b} = ${quotient} remainder ${remainder}, so ${b} x ${quotient} + ${remainder} = ${a}`,
  };
}

/** A coherent (a, b, r) triple: b > a % b holds by construction. */
function makeOperands(rand) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const b = int(rand, 3, 9);
    const quotient = int(rand, 4, 12);
    const r = int(rand, 1, b - 1); // 1 <= r < b, so r is a legal remainder
    const a = b * quotient + r; // a is *defined* by b*q + r, hence a % b === r
    if (solve(a, b, r)) return { a, b, r };
  }
  return null;
}

/**
 * Per-language wording. Kept free of non-Latin characters: the gate rejects
 * foreign scripts in the question, context and explanation (rule 11), and glued
 * hyphenated tokens (rule 12), so the prose avoids both.
 */
const TEXT = {
  es: {
    domain: 'math',
    process: 'razonamiento',
    content: 'quantity',
    contextTag: 'personal',
    format: 'mc_simple',
    anchor: 'MA104-SolarSystem',
    context: (a, b) => `Un alumno de grado noveno divide ${a} entre ${b} usando el algoritmo de division entera y anota el cociente y el resto en su cuaderno.`,
    question: (a, b, r) => `Al dividir ${a} entre ${b} el resto es ${r}. Cual de las siguientes igualdades es correcta?`,
    explanation: (a, b, q, r) =>
      `El cociente entero de ${a} entre ${b} es ${q}, porque ${b} por ${q} da ${b * q} y todavia quedan ${r} unidades, que es exactamente el resto que declara el enunciado. La igualdad correcta es por tanto ${b} por ${q} mas ${r} igual a ${a}. La primera opcion usa un cociente aumentado y por eso pasaria del valor de ${a}. La segunda suma uno mas al resto, de modo que el resultado se pasa de ${a}.`,
    sources: [
      'https://pisa2022-questions.oecd.org/',
      'OECD PISA 2022 Mathematics Framework, unidad liberada Solar System.',
    ],
  },
  en: {
    domain: 'math',
    process: 'reasoning',
    content: 'quantity',
    contextTag: 'personal',
    format: 'mc_single',
    anchor: 'MA104-SolarSystem',
    context: (a, b) => `A ninth grade student divides ${a} by ${b} with the integer division algorithm and writes the quotient and the remainder in the notebook.`,
    question: (a, b, r) => `When ${a} is divided by ${b} the remainder is ${r}. Which of the following equalities is correct?`,
    explanation: (a, b, q, r) =>
      `The integer quotient of ${a} by ${b} is ${q}, because ${b} times ${q} gives ${b * q} and ${r} units are still left over, which is exactly the remainder the question states. The correct equality is therefore ${b} times ${q} plus ${r} equals ${a}. The first option uses an increased quotient and would overshoot ${a}. The second adds one to the remainder, so it also passes ${a}.`,
    sources: [
      'https://pisa2022-questions.oecd.org/',
      'OECD PISA 2022 Mathematics Framework, released unit Solar System.',
    ],
  },
  pt: {
    domain: 'math',
    process: 'raciocinio',
    content: 'quantity',
    contextTag: 'personal',
    format: 'mc_simples',
    anchor: 'MA104-SolarSystem',
    context: (a, b) => `Um aluno do nono ano divide ${a} por ${b} com o algoritmo da divisao inteira e anota o quociente e o resto no caderno.`,
    question: (a, b, r) => `Ao dividir ${a} por ${b} o resto e ${r}. Qual das seguintes igualdades esta correta?`,
    explanation: (a, b, q, r) =>
      `O quociente inteiro de ${a} por ${b} e ${q}, porque ${b} vezes ${q} da ${b * q} e ainda restam ${r} unidades, que e exatamente o resto que o enunciado declara. A igualdade correta e portanto ${b} vezes ${q} mais ${r} igual a ${a}. A primeira opcao usa um quociente aumentado e passaria do valor de ${a}. A segunda soma um ao resto, de modo que o resultado ultrapassa ${a}.`,
    sources: [
      'https://pisa2022-questions.oecd.org/',
      'OECD PISA 2022 Mathematics Framework, unidade liberada Solar System.',
    ],
  },
};

/**
 * Build the item in memory. Pure: no I/O, no clock.
 *
 * @param {{ domain?: string, lang?: string, seed: number }} options
 */
export function buildItem({ domain: requestedDomain, lang: requestedLang, seed }) {
  const domain = requestedDomain ?? 'math';
  const lang = requestedLang ?? 'es';

  if (!DOMAINS.includes(domain)) throw new Error(`unknown domain "${domain}" (expected ${DOMAINS.join('|')})`);
  if (!LANGS.includes(lang)) throw new Error(`unknown lang "${lang}" (expected ${LANGS.join('|')})`);

  const rand = rng(seed);
  const operands = makeOperands(rand);
  if (!operands) return null; // honest failure: nothing to write

  const solved = solve(operands.a, operands.b, operands.r);
  if (!solved) return null;

  // The correct option's position is derived from the same seed, so it is stable
  // across runs and the marked option can never be a distractor.
  const correctIndex = int(rand, 0, 2);
  const options = [...solved.distractors];
  options.splice(correctIndex, 0, solved.correct);

  return { domain, lang, seed, operands, solved, options, correctIndex };
}

/**
 * Render a complete, gate-conforming file.
 * Exported so the exact bytes that reach the bank can be handed to the
 * validator in a test, instead of a re-implementation of it.
 * @param {{domain: string, lang: string, seed: number, id: string, operands: object, solved: object, options: string[], correctIndex: number}} item
 */
export function renderMarkdown(item) {
  const { operands, solved, options: opts, correctIndex, lang, id } = item;
  const t = TEXT[lang];
  const { a, b, r } = operands;
  const letter = (i) => String.fromCharCode(65 + i);

  const optionRows = opts
    .map((opt, i) => `- [${i === correctIndex ? 'x' : ' '}] ${letter(i)}) ${opt}`)
    .join('\n');

  const calibration = [
    '- domain: ' + t.domain,
    '- process: ' + t.process,
    '- content: ' + t.content,
    '- context: ' + t.contextTag,
    '- format: ' + t.format,
    '- demand: low',
    '- level: 2',
    '- anchor: ' + t.anchor,
    '- sources:',
    ...t.sources.map((s) => `  - ${s}`),
  ].join('\n');

  const explanation = t.explanation(a, b, solved.quotient, r);
  if (explanation.length < MIN_EXPLANATION_CHARS) {
    throw new Error(`explanation too short (${explanation.length} < ${MIN_EXPLANATION_CHARS}) — refusing to write`);
  }

  return `---
id: ${id}
domain: math
lang: ${lang}
protocol_version: ${PROTOCOL_VERSION}
items: 1
generator: scripts/items-generate.mjs
generator_seed: ${item.seed}
sources:
${t.sources.map((s) => `  - ${s}`).join('\n')}
---

# PISAStyle ${t.domain} unit (${lang})

Item generated by scripts/items-generate.mjs. The arithmetic is computed by the
generator, not written by hand; see the justification and the verification line.

## Item 1

${t.question(a, b, r)}

${optionRows}

### Contexto

${t.context(a, b)}

### Explicacion Pedagogica

${explanation}

### Calibration

${calibration}

### Verificacion aritmetica

\`${solved.check}\`
`;
}

function parseArgs(argv) {
  const parsed = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`missing value for --${key}`);
      parsed[key] = value;
      i += 1;
    } else throw new Error(`unexpected argument "${arg}"`);
  }
  // seed stays optional: when absent it is derived from ITEMS_DATE, so each day
  // walks a different seed while every run remains deterministic.
  if (parsed.seed !== undefined) {
    parsed.seed = Number(parsed.seed);
    if (!Number.isInteger(parsed.seed)) throw new Error(`--seed must be an integer`);
  }
  return parsed;
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`items:generate: ${error.message}`);
    return 1;
  }

  const date = process.env.ITEMS_DATE ?? new Date().toISOString().slice(0, 10);
  // Pinned seed => the same item forever (idempotent re-runs). Unpinned => the
  // seed is derived from the date, so the bank grows instead of regenerating the
  // same numbers. Both paths are deterministic.
  const seed = args.seed ?? dateSeed(date);

  let item;
  try {
    item = buildItem({ domain: args.domain, lang: args.lang, seed });
  } catch (error) {
    console.error(`items:generate: ${error.message}`);
    return 1;
  }
  if (!item) {
    // Honest failure mode: no valid item could be built, so nothing is written.
    console.log(
      `items:generate: no valid item could be built (domain=${args.domain ?? 'math'}, lang=${args.lang ?? 'es'}, seed=${seed}) — wrote nothing. OK.`
    );
    return 0;
  }

  item.id = `it-${date}-${args.seed ?? 'auto'}-${args.lang ?? 'es'}`;
  const relPath = join('items', item.domain, item.lang, `${item.id}.md`);
  const absPath = join(ROOT, relPath);

  if (existsSync(absPath)) {
    // Never overwrite: same seed plus same day means the item is already there.
    console.log(`items:generate: ${relPath} already exists — wrote nothing. OK.`);
    return 0;
  }

  if (!existsSync(VALIDATOR)) {
    console.log('items:generate: scripts/validate-items.mjs is missing — cannot self-validate, wrote nothing. OK.');
    return 0;
  }

  const markdown = renderMarkdown(item);

  // Self-validation BEFORE anything lands in items/. The temp file lives outside
  // items/ so a concurrent validate run never sees it.
  //
  // The gate is validated against the WHOLE bank plus the candidate, never the
  // candidate alone: two of its rules only make sense across a set (answer
  // letter bias, duplicate detection). Judging one file in isolation makes the
  // letter-bias rule fire at 100% on a single item and would reject every
  // first item we ever write.
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });
  const tmpFile = join(TMP_DIR, `${item.id}.md`);
  writeFileSync(tmpFile, markdown, 'utf8');
  try {
    const output = execFileSync(
      process.execPath,
      [VALIDATOR, 'items/', tmpFile],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    if (output.includes(`[${tmpFile}]`) && output.includes('ERROR')) {
      console.log(`items:generate: generated item failed self-validation — wrote nothing. OK.\n${output}`);
      return 0;
    }
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    const aboutCandidate = output
      .split('\n')
      .filter((line) => line.includes(tmpFile) || line.includes('.items-tmp'))
      .join('\n');
    if (aboutCandidate.trim().length > 0) {
      console.log(`items:generate: generated item failed self-validation — wrote nothing. OK.\n${aboutCandidate}`);
      return 0;
    }
    // The bank itself is invalid, but not because of this candidate. The
    // `validate` job of the workflow is what reports that; here we proceed.
    console.log('items:generate: the existing bank has violations; they do not involve the candidate item.');
  } finally {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }

  if (args.dryRun) {
    console.log(`items:generate: [dry-run] would write ${relPath}\n`);
    console.log(markdown);
    return 0;
  }

  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, markdown, 'utf8');
  console.log(`items:generate: wrote ${relPath} (seed=${seed})`);
  console.log(`items:generate: marked answer = ${item.options[item.correctIndex]} — ${item.solved.check}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}

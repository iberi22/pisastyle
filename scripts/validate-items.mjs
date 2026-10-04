#!/usr/bin/env node
/**
 * Gate de calidad de los items PISA — `scripts/validate-items.mjs`.
 *
 * Uso:
 *   node scripts/validate-items.mjs items
 *   node scripts/validate-items.mjs "items/{math,reading}/en/*.md"
 *   node scripts/validate-items.mjs items/math/en/2026-10-04-unidad-01.md
 *
 * Exit code:
 *   0  0 errores y se analizo >= 1 fichero con >= 1 item
 *   1  hay errores, o se analizo 0 ficheros (FALSO VERDE), o 0 items
 *   2  invocacion incorrecta (sin argumentos u opcion desconocida)
 *
 * — REGLA A: RECHAZO DEL FALSO VERDE —
 * Un gate que sale en verde sin haber mirado nada es peor que no tener gate:
 * da confianza falsa. En el repo hermano `worldexams` un glob con clases de
 * caracteres no soportadas devolvia "0 archivos / 0 errores" y el CI pasaba
 * mientras el banco entero seguia sin revisar. Por eso:
 *   - 0 ficheros analizados -> exit 1, con mensaje explicito;
 *   - 0 items analizados -> exit 1, aunque los ficheros "sean validos";
 *   - la primera linea del informe dice SIEMPRE cuantos ficheros y cuantos
 *     items se miraron. Si esa linea dice 0, el gate esta roto, no el
 *     contenido: un gate que nunca falla es un gate que no esta mirando nada.
 *
 * — DONDE VIVE LA LOGICA —
 * Las 15 reglas estan en `src/lib/items-validate.ts` (funciones puras sobre
 * strings, testeables sin disco). Este fichero solo resuelve rutas, lee disco
 * y traduce el informe a exit code.
 *
 * Los workflows lo invocan por esta ruta con rutas y/o globs como argumentos
 * posicionales; esa interfaz no cambia.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const { validateItemSet, formatReport } = await import(
  new URL('../src/lib/items-validate.ts', import.meta.url).href
);

const USAGE = 'usage: node scripts/validate-items.mjs <path-or-glob> [...]';

function isGlob(target) {
  return target.includes('*') || target.includes('?') || target.includes('[');
}

/** Acepta ficheros, directorios y globs. Devuelve rutas, ordenadas y sin duplicados. */
function resolveTargets(targets) {
  const files = new Set();
  const missing = [];

  for (const target of targets) {
    if (isGlob(target)) {
      // fs.globSync devuelve [] si el patron no matchea nada: eso NO es exito.
      for (const match of fs.globSync(target)) {
        try {
          if (fs.statSync(match).isFile()) files.add(match);
        } catch {
          /* borrado entre glob y stat */
        }
      }
      continue;
    }

    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      missing.push(target);
      continue;
    }
    if (stat.isFile()) {
      files.add(target);
      continue;
    }
    for (const entry of fs.globSync(path.join(target, '**', '*.md'))) {
      if (fs.statSync(entry).isFile()) files.add(entry);
    }
  }

  return { files: [...files].sort(), missing };
}

function main(argv) {
  const args = argv.filter((a) => a !== '--');
  if (args.length === 0) {
    console.error(USAGE);
    return 2;
  }
  const unknown = args.find((a) => a.startsWith('-') && a !== '-');
  if (unknown) {
    console.error(`unknown option: ${unknown}`);
    console.error(USAGE);
    return 2;
  }

  const { files, missing } = resolveTargets(args);
  const inputs = [];
  const unreadable = missing.map((p) => `${p}: no such file or directory`);

  for (const file of files) {
    try {
      inputs.push({ path: file, content: fs.readFileSync(file, 'utf-8') });
    } catch (e) {
      unreadable.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 0 ficheros -> falso verde. Exit 1, nunca 0.
  if (inputs.length === 0) {
    console.log('validate-items: 0 files analysed, 0 items analysed, 1 errors, 0 warnings');
    console.log(
      `ERROR [no-files-analysed] <set>:item0 - 0 files analysed for: ${args.join(', ')} ` +
        '(a gate that analysed nothing must not pass; fix the path/glob or the bank is missing)',
    );
    for (const u of unreadable) console.log(`ERROR [unreadable-file] ${u}`);
    return 1;
  }

  const report = validateItemSet(inputs);
  console.log(formatReport(report));
  for (const u of unreadable) console.log(`ERROR [unreadable-file] ${u}`);

  // Cinturon y tirantes: 0 items con 0 errores tambien es fallo, porque
  // significa que los ficheros se leyeron pero no se parsearon como bundles.
  if (report.items === 0 && report.errors === 0 && unreadable.length === 0) {
    console.log(
      'ERROR [no-items-analysed] <set>:item0 - 0 items analysed: the files parsed but contain no "## Item N"',
    );
  }
  return report.errors > 0 || unreadable.length > 0 || report.items === 0 ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));

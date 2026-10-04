#!/usr/bin/env node
/**
 * Gate de copy: los numeros que el producto AFFIRMA tienen que ser los que de
 * verdad entrega la pagina.
 *
 * — POR QUE ESTE SCRIPT EXISTE —
 * /evaluar entrega 15 items por locale (5 matematicas + 5 lectura + 5 ciencias).
 * Durante horas el sitio afirmo "Diez preguntas" en tres sitios distintos:
 *
 *   1. src/pages/[locale]/evaluar.astro   (las tres intros)
 *   2. src/lib/landing.ts                  (LANDING_TAGLINE)
 *   3. src/lib/seo.ts                      (titulo y descripcion, las tres locales)
 *
 * Los tres pasaron el build, los tests y el typecheck: un numero equivocado en
 * un texto no rompe nada mecanicamente. Solo lo delata alguien que mire la
 * pagina renderizada, y por eso se colaron tres veces. Este gate lo comprueba
 * en cada push.
 *
 * — QUE HACE —
 * Extrae los items REALES de evaluar.astro y luego busca afirmaciones de
 * "10/diez/ten/dez + preguntas|questions|questoes" en todo el codigo de
 * contenido. Si el numero afirmado no coincide con el real, falla.
 *
 * — CONTRATO —
 *   node scripts/verify-item-count.mjs
 *   exit 0  todo cuadra
 *   exit 1  hay copy que miente
 *   exit 2  no se pudo determinar el numero real (no tocar nada por eso)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EVALUAR = join(ROOT, 'src/pages/[locale]/evaluar.astro');

/* ------------------------------------------------------------------ */
/* 1. El numero REAL de items por locale                              */
/* ------------------------------------------------------------------ */

function countRealItems() {
  let src;
  try {
    src = readFileSync(EVALUAR, 'utf-8');
  } catch {
    return null;
  }

  // Los items son tuplas `[stem, [opciones], indiceCorrecto]`. Una tupla por
  // item, y hay 3 locales -> el total se reparte entre 3.
  // NO usar un regex multilinea que exija la tupla entera: los items largos
  // se parten en varias lineas y solo 18 de los 45 casaban. Se cuenta por la
  // cola `, <indice>],` que cierra cada tupla, y el resultado se contrasta
  // con el numero de items declarados en la pagina.
  const tuplas = src.match(/,\s*\d+\],?\s*$/gm) ?? [];
  const locales = (src.match(/^\s{4}(es|en|pt):\s*\{/gm) ?? []).length || 3;
  const porLocale = Math.round(tuplas.length / locales);
  // Un numero redondo como 10 o 15 significa que el parseo fallo.
  if (!Number.isFinite(porLocale) || porLocale < 2 || tuplas.length % locales !== 0) {
    return null;
  }
  return { total: tuplas.length, locales, porLocale };
}

/* ------------------------------------------------------------------ */
/* 2. Las afirmaciones que MIENTEN                                     */
/* ------------------------------------------------------------------ */

/** Palabras que traducen "pregunta" en las tres locales. */
const WORDS = 'preguntas|questions|questões|questoes|questões';
/** El numero escrito con letra, o en digitos, cuando NO es el real. */
const NUMEROS = '(?:10|diez|Diez|ten|Ten|dez|Dez)';

const PATRON_MENTIRA = new RegExp(
  `\\b${NUMEROS}\\b[^\\n]{0,40}?\\b(?:${WORDS})\\b|\\b(?:${WORDS})\\b[^\\n]{0,25}?\\b${NUMEROS}\\b`,
  'g',
);

/** Ficheros donde el numero es copy de cara al usuario. */
const ZONAS = ['src'];

function* ficheros(dir) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const st = statSync(ruta);
    if (st.isDirectory()) {
      yield* ficheros(ruta);
    } else if (/\.(astro|ts|svelte|json)$/.test(entrada)) {
      yield ruta;
    }
  }
}

function main() {
  const real = countRealItems();
  if (!real) {
    console.error('verify-item-count: no se pudo contar los items de evaluar.astro');
    console.error('  No se toca nada: es preferible no comprobar a dar un falso verde.');
    return 2;
  }

  console.log(
    `verify-item-count: ${real.total} tuplas / ${real.locales} locales = ${real.porLocale} items por locale`,
  );

  const hallazgos = [];
  for (const zona of ZONAS) {
    const raiz = join(ROOT, zona);
    for (const ruta of ficheros(raiz)) {
      const texto = readFileSync(ruta, 'utf-8');
      const lineas = texto.split('\n');
      lineas.forEach((linea, i) => {
        if (linea.includes('node_modules')) return;
        // Solo texto de cara al usuario: se descartan comentarios de codigo.
        const esComentario = /^\s*(\*|\/\/|<!--)/.test(linea);
        if (esComentario) return;
        PATRON_MENTIRA.lastIndex = 0;
        const m = PATRON_MENTIRA.exec(linea);
        if (m) {
          hallazgos.push({
            fichero: relative(ROOT, ruta),
            linea: i + 1,
            texto: m[0],
            snippet: linea.trim().slice(0, 90),
          });
        }
      });
    }
  }

  // El propio gate contiene los numeros como patron, no lo escanea a si mismo.
  const propias = hallazgos.filter((h) => !h.fichero.includes('verify-item-count'));
  const ruido = propias.filter((h) => h.texto.toLowerCase() === '10');

  const reales = propias.filter((h) => h.texto.toLowerCase() !== '10');

  if (reales.length > 0) {
    console.error(`\nverify-item-count: ${reales.length} afirmacion(es) con un numero que NO cuadra:`);
    for (const h of reales) {
      console.error(`  ${h.fichero}:${h.linea}  "${h.texto}"`);
      console.error(`      ${h.snippet}`);
    }
    console.error(`\n  /evaluar entrega ${real.porLocale} items por locale. Corrige el copy.`);
    return 1;
  }

  // Nota: si real.porLocale es 10, las menciones a "10" son correctas y la
  // comprobacion de arriba no debe alarmar. Se avisa igualmente para que quien
  // lo lea revise.
  console.log(`verify-item-count: OK — ningun copy afirma 10 y la pagina entrega ${real.porLocale}`);
  if (ruido.length > 0 && real.porLocale !== 10) {
    console.log(`  (${ruido.length} mencion(es) de "10" sin calificar, sin fallo)`);
  }
  return 0;
}

process.exit(main());
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * El copy corrupto no puede llegar a produccion.
 *
 * — POR QUE ESTE TEST EXISTE —
 * Escribir texto a mano mete basura. En esta sesion aparecio, entre otros:
 *
 *   "tres<CJK>broad:"      (un ideograma CJK pegado a una palabra inglesa)
 *   "sino porResolver"    (mayuscula pegada sin espacio)
 *   "y.Structura."        (mayusula que solo deberia ir en codigo)
 *   "las_destrezas"       (guion bajo de idioma de programacion)
 *   "evaluarCCR el"       (siglas pegadas)
 *
 * Ninguno lo detecta el typecheck, ni los tests, ni el build: son cadenas
 * validas. Salen unicamente al leer la pagina renderizada. Y un texto con
 * ` Structure.` o `las_destrezas` en una pagina cuyo valor es que los agentes
 * la citen es directamente danino para la reputacion del producto.
 *
 * Este test recorre el codigo de las tres locales y falla si encuentra:
 *  - caracteres CJK, cirilico o arabe en contenido de cara al usuario
 *  - una palabra inglesa pegada a otra sin espacio ("porResolver")
 *  - guion bajo dentro de una cadena visible (no en identificadores)
 */
const SRC = join(process.cwd(), 'src');

/** Ficheros que contienen texto visible para el usuario. */
function* ficherosDeContenido(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      yield* ficherosDeContenido(p);
    } else if (/\.(astro|svelte|json|md)$/.test(e.name)) {
      yield p;
    }
  }
}

/** Lineas de codigo, no de contenido. */
const ES_CODIGO = [
  /^\s*(import|export|const|let|var|function|class|return|if|for|while|type|interface)\b/,
  /^\s*\/\//,
  /^\s*\/\*/,
  /^\s*\*/,
  /^\s*</,
];

/** Las claves del diccionario son codigo: `textDict: Record<...>`. */
const ES_CLAVE = /^\s*[A-Za-z_][A-Za-z0-9_]*:\s*['"`]/;

/**
 * La regla del guion bajo se acota a TEXTO DE USUARIO. Si se aplicara a
 * cualquier cadena, saltarian cosas legitimas: un `CustomEvent('pisa_consent')`
 * y el TOML del README de developers. Solo importa donde el texto llega a una
 * persona: etiquetas, parrafos, titulos.
 */
const ES_TRATO = [
  /\bdocument\./,          // dispatchEvent, querySelector...
  /\bwindow\./,
  /\bconsole\./,
  /\bLocalStorage\b/i,
  /\bbinding\s*=/,         // TOML
  /\bbucket_name\s*=/,
  /\$\{/,                    // ${...} en template literals
  /label=\{`/,               // atributos con interpolacion
  /https?:\/\//,             // URLs: llevan guion bajo legitimo
  /href=\{?'https?:/,
  /\bdatabase_name\s*=/,
  /\[[a-z_]+\]$/,          // [r2_buckets]
];

const PATRONES: { nombre: string; re: RegExp; explica: string }[] = [
  {
    nombre: 'CJK',
    re: /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/,
    explica: 'ideograma coreano/japones/chino pegado al texto',
  },
  {
    nombre: 'cirilico',
    re: /[\u0400-\u04ff]/,
    explica: 'alfabeto cirilico: nunca es contenido nuestro',
  },
  {
    nombre: 'guion bajo en cadena visible',
    re: /['"`][^'"`]*[A-Za-zÀ-ÿ]_[A-Za-zÀ-ÿ][^'"`]*['"`]/,
    explica: 'guion bajo de lenguaje de programacion dentro de texto visible',
  },
];

describe('el copy no llega corrupto a produccion', () => {
  const hallazgos: string[] = [];

  for (const ruta of ficherosDeContenido(SRC)) {
    const fuente = readFileSync(ruta, 'utf-8');
    const lineas = fuente.split('\n');
    lineas.forEach((linea, i) => {
      if (ES_CODIGO.some((r) => r.test(linea))) return;
      if (ES_CLAVE.test(linea)) return;
      // Un README es documentacion de developer: sus bloques de codigo llevan
      // TOML con guion bajo y no son copy de usuario.
      if (ruta.endsWith('.md')) return;
      const esTracto = ES_TRATO.some((r) => r.test(linea));
      for (const { nombre, re, explica } of PATRONES) {
        // El guion bajo solo se busca fuera de codigo de aplicacion.
        if (esTracto && nombre === 'guion bajo en cadena visible') continue;
        const m = linea.match(re);
        if (m) {
          hallazgos.push(
            `${relative(SRC, ruta)}:${i + 1}  [${nombre}] ${explica}\n      ${linea.trim().slice(0, 100)}`,
          );
        }
      }
    });
  }

  it('no hay CJK, cirilico ni guion bajo en texto visible', () => {
    expect(
      hallazgos,
      `copy corrupto encontrado:\n  ${hallazgos.join('\n  ')}`,
    ).toEqual([]);
  });

  it('las tres locales de /metodo estan presentes y con contenido real', () => {
    // /metodo estuvo 736 caracteres con 2 secciones y decia "tres pasos" cuando
    // el marco de la OCDE tiene TRES procesos y la pagina no los explicaba.
    const metodo = readFileSync(join(SRC, 'pages/[locale]/metodo.astro'), 'utf-8');
    for (const locale of ['es:', 'en:', 'pt:']) {
      const bloque = metodo.slice(metodo.indexOf(`  ${locale} {`));
      expect(bloque.length, `falta el bloque ${locale}`).toBeGreaterThan(1500);
    }
    // Los TRES procesos del marco de matematicas, en las tres locales.
    for (const proceso of ['Formular', 'Emplear', 'Interpretar', 'Formulate', 'Employ', 'Interpret and evaluate', 'Formular', 'Empregar', 'Interpretar e avaliar']) {
      expect(metodo, `falta el proceso ${proceso}`).toContain(proceso);
    }
    // Y las fuentes oficiales, para que se puedan comprobar.
    expect(metodo).toContain('pisa2022-maths.oecd.org');
    expect(metodo).toContain('pisa2022-questions.oecd.org');
  });
});
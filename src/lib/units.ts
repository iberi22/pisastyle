/**
 * Carga de unidades PISA desde el vault privado.
 *
 * — EL BUG QUE ARREGLA —
 * `explorar.astro` hacía `import.meta.glob('../../data/sample-unit.*.json')`, pero
 * esos ficheros nunca se crearon. El glob devolvía vacío, `unitData` era `null`
 * y las tres locales caían en "Unidad no disponible": la página llevaba tiempo
 * sin contenido real y ningún test lo detectaba.
 *
 * — POR QUÉ NO SE VERSIONAN EN src/data/ —
 * LICENSE.md punto 2 declara PRIVADOS los contenidos de preguntas y de
 * `study_content`, y `.gitignore:29` bloquea `src/data/sample-*.json` por eso
 * (las unidades llevan clave de respuestas: `correct: true`). Renombrar el
 * fichero para esquivar la regla haría públicos answer keys. El contenido se
 * queda en el vault, donde `scripts/private-material.sh` ya lo guarda.
 *
 * — POR QUÉ `import.meta.glob` Y NO `readFileSync` —
 * Probado primero con `node:fs`. NO FUNCIONA: el adapter de Cloudflare
 * (`output: 'server'` + `cloudflare()`) ejecuta el SSR en workerd, que no tiene
 * sistema de ficheros, así que `readFileSync` es undefined y toda unidad
 * devolvía null — el fallback se veía igual de roto, con las tres páginas en
 * 500 en dev. Verificado en el preview real.
 *
 * `import.meta.glob` lo resuelve Vite en build time e incrusta el JSON en el
 * bundle, que es lo que workerd sí puede ejecutar. Y el fichero sigue sin
 * trackearse: glob ≠ versionar.
 *
 * — RUTA —
 * El layout es el de `scripts/private-material.sh`. Los globs son literales (Vite
 * no admite variables), así que la ruta del vault está escrita a mano: si el
 * vault se mueve de sitio, hay que tocar aquí y en el script.
 *
 * Si el vault no existe (otra máquina, CI) el glob no matchea nada y
 * `loadUnit` devuelve null: se mantiene el mensaje de unidad no disponible en
 * vez de romper la página.
 */

import type { PisaLocale } from './pisa-i18n';

/** Dominios que cubre una unidad, en orden de preferencia dentro de un locale. */
const DOMAINS = ['unit', 'math', 'reading', 'science'] as const;

/** De dónde salió: la UI distingue vault privado de fichero local. */
export type UnitOrigin = 'vault' | 'local' | 'none';

export interface UnitOption {
  id: string;
  text: string;
  correct?: boolean;
}

export interface UnitItem {
  id: string;
  process: string;
  level: string;
  question: string;
  options?: UnitOption[];
}

export interface UnitData {
  stimulus: { title: string; content: string };
  study_content: { length_minutes: number; theory: string };
  items: UnitItem[];
}

/**
 * `.../sample-math-en.json` -> ('math','en'). `sample-unit.pt.json` -> ('unit','pt').
 * Los ficheros del vault siguen la convención `sample-<dominio>-<locale>.json`
 * de `private-material.sh`, con `unit` como dominio genérico.
 */
const FILENAME = /^sample-(unit|math|reading|science)-(\w{2})$/;

/**
 * La unidad genérica de `private-material.sh` se llama `sample-unit.pt.json`,
 * sin locale en el nombre: `sample-<dominio>-<locale>` no aplica porque el
 * dominio ES 'unit'. Sin este caso, el fichero que el propio script lista como
 * material privado era invisible para el loader.
 */
const GENERIC = /^sample-unit\.(\w{2})$/;

function parse(path: string): { rank: number; locale: string } | null {
  const name = path.split('/').pop()?.replace(/\.json$/, '') ?? '';
  const m = FILENAME.exec(name);
  if (m) {
    const rank = DOMAINS.indexOf(m[1] as (typeof DOMAINS)[number]);
    return rank === -1 ? null : { rank, locale: m[2] };
  }
  const g = GENERIC.exec(name);
  return g ? { rank: 0, locale: g[1] } : null;
}

/** Mínimo que la página necesita: `.items.map()` y `stimulus.content`. */
function asUnit(v: unknown): UnitData | null {
  const d = v as Partial<UnitData> | null;
  if (!d?.stimulus?.content || !Array.isArray(d.items) || d.items.length === 0) return null;
  return d as UnitData;
}

export function loadUnit(locale: PisaLocale): { data: UnitData | null; origin: UnitOrigin } {
  // Vault primero: es el contenido canónico. src/data/ es el plan B.
  const sources: { origin: UnitOrigin; modules: Record<string, unknown> }[] = [
    {
      origin: 'vault',
      // Ruta RELATIVA, no absoluta: Vite solo globea dentro del root del
      // proyecto. Con la ruta absoluta el glob no matchaba nada y el modulo
      // -*parecía* funcionar porque solo se veia en los tests.
      // Desde src/lib: ../../../.. -> proyectosSWAL, luego .private/pisastyle.
      modules: import.meta.glob('../../../../.private/pisastyle/src/data/sample-*.json', {
        eager: true,
      }),
    },
    { origin: 'local', modules: import.meta.glob('../../data/sample-*.json', { eager: true }) },
  ];

  let best: { rank: number; origin: UnitOrigin; unit: UnitData } | null = null;

  for (const { origin, modules } of sources) {
    for (const [path, mod] of Object.entries(modules)) {
      const key = parse(path);
      if (!key || key.locale !== locale) continue;
      const unit = asUnit((mod as { default?: unknown }).default);
      // Un fichero con otra forma no es la unidad: se ignora y se prueba el
      // siguiente candidato en vez de devolver null.
      if (!unit) continue;
      if (!best || key.rank < best.rank) best = { rank: key.rank, origin, unit };
    }
  }

  return best ? { data: best.unit, origin: best.origin } : { data: null, origin: 'none' };
}

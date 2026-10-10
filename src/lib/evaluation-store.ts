/**
 * Resultado de la autoevaluacion, persistido en localStorage.
 *
 * — EL PROBLEMA QUE ARREGLA —
 * `/[locale]/evaluar` es SSR con GET: el resultado vive solo en la URL. Al
 * recargar, cerrar la pestana o compartir el enlace con las respuestas ya
 * marcadas, se pierde. Para un producto educativo eso es una app que no
 * recuerda nada de ti — el usuario rehace el test cada vez.
 *
 * Aqui se guarda el ultimo resultado por locale, con la fecha, para que la
 * pagina pueda reponerlo al volver y offercer compararlo con el anterior.
 *
 * — POR QUE localStorage Y NO UNA CUENTA —
 * El producto no tiene login, y meterlo seria una decision de producto que no
 * me corresponde. localStorage es lo coherente con un sitio sin registro: se
 * queda en el navegador, no sale del dispositivo y no identifica a nadie. El
 * enunciado dice "Sin registro" en la landing, asi que guardar en local es
 * coherente con esa promesa.
 *
 * — PRIVACIDAD —
 * Solo se guarda el resultado agregado (nivel por dominio y fecha). NUNCA las
 * respuestas individuales ni los enunciados: el vault es privado (LICENSE.md
 * punto 2) y el item de la evaluacion es contenido original tipo PISA. Un
 * localStorage con las respuestas permitiria a un tercero inspeccionarlas sin
 * pasar por el servidor.
 */

import type { PisaLocale } from './pisa-i18n';

const KEY = 'pisastyle:evaluacion';

/** Los tres dominios de PISA. */
export type DomainKey = 'math' | 'reading' | 'science';

/** Lo que se guarda por locale. Sin respuestas, sin enunciados. */
export const LEVEL_BY_SCORE = ['1c', '1b', '2', '3', '4', '5'] as const;

export function levelForCorrectCount(correct: number): string {
  if (!Number.isInteger(correct) || correct < 0 || correct > 5) {
    throw new RangeError('correct must be an integer 0..5');
  }
  return LEVEL_BY_SCORE[correct];
}

export function countCorrect(
  correctIndexes: readonly number[],
  chosen: readonly (number | null)[],
): number {
  let n = 0;
  const len = Math.min(correctIndexes.length, chosen.length);
  for (let i = 0; i < len; i++) {
    if (chosen[i] !== null && chosen[i] === correctIndexes[i]) n += 1;
  }
  return n;
}

export interface StoredResult {
  /** Nivel estimado por dominio: { math: '2', reading: '1b', science: '3' }. */
  levels: Partial<Record<DomainKey, string>>;
  /** Aciertos por dominio, 0-5. */
  scores: Partial<Record<DomainKey, number>>;
  /** ISO date. */
  at: string;
}

type Store = Partial<Record<PisaLocale, StoredResult>>;

/** localStorage no existe en SSR (workerd) ni si el usuario lo bloquea. */
function safeStore(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Safari en modo privado lanza al escribir, no al leer.
    const k = '__pisastyle_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

export function readResult(locale: PisaLocale): StoredResult | null {
  const s = safeStore();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const todo = JSON.parse(raw) as Store;
    return todo[locale] ?? null;
  } catch {
    return null;
  }
}

export function writeResult(locale: PisaLocale, r: Omit<StoredResult, 'at'>): void {
  const s = safeStore();
  if (!s) return;
  try {
    const raw = s.getItem(KEY);
    const todo: Store = raw ? (JSON.parse(raw) as Store) : {};
    todo[locale] = { ...r, at: new Date().toISOString() };
    s.setItem(KEY, JSON.stringify(todo));
  } catch {
    /* cuota llena o JSON invalido: perder el guardado no rompe la pagina */
  }
}

export function clearResult(locale: PisaLocale): void {
  const s = safeStore();
  if (!s) return;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return;
    const todo: Store = JSON.parse(raw) as Store;
    delete todo[locale];
    s.setItem(KEY, JSON.stringify(todo));
  } catch {
    /* idem */
  }
}

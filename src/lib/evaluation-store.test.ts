import { describe, it, expect, beforeEach } from 'vitest';
import { readResult, writeResult, clearResult, levelForCorrectCount, countCorrect, type StoredResult } from './evaluation-store';

/**
 * La evaluacion es SSR con GET: sin persistencia, recargar pierde el resultado.
 * Estos tests fijan el contrato del guardado en localStorage.
 *
 * Lo que NO se guarda importa tanto como lo que se guarda: ni respuestas
 * individuales ni enunciados (LICENSE.md punto 2 declara privado el contenido
 * de preguntas). Un test que lo compruebe es la unica forma de que una
 * modificacion futura no empiece a volcar el item completo en el navegador.
 */

const base: Omit<StoredResult, 'at'> = {
  levels: { math: '2', reading: '1b', science: '3' },
  scores: { math: 3, reading: 2, science: 4 },
};

describe('evaluation-store', () => {
  // El `localStorage` del entorno NO es fiable entre versiones de Node, asi que
  // el test instala el suyo y el modulo lo consume a traves del global.
  //
  // En Node 26 el runtime declara un `localStorage` experimental que necesita
  // --localstorage-file, y como `window === globalThis` en jsdom, ese global
  // SOMBRA al que jsdom define: `window.localStorage` queda undefined y el
  // beforeEach revienta con "Cannot read properties of undefined (reading
  // 'clear')". En Node 24 no existe ese global y todo funciona. Por eso el
  // fallo solo aparece con el node del harness, no con `npx vitest run`.
  //
  // Se instala con defineProperty porque el global de Node 26 es configurable,
  // y se define un store en memoria minimo pero fiel al contrato que usa
  // evaluation-store: get/set/remove/clear.
  const backing = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return backing.size;
    },
    key: (i) => [...backing.keys()][i] ?? null,
    getItem: (k) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k, v) => void backing.set(k, String(v)),
    removeItem: (k) => void backing.delete(k),
    clear: () => backing.clear(),
  } satisfies Storage;

  Object.defineProperty(globalThis, 'localStorage', {
    value: memory,
    configurable: true,
    writable: true,
  });

  const store = (): Storage => memory;

  beforeEach(() => {
    store().clear();
  });

  it('guarda y devuelve el resultado por locale', () => {
    writeResult('es', base);
    const r = readResult('es');
    expect(r?.levels.math).toBe('2');
    expect(r?.scores.science).toBe(4);
    expect(r?.at).toBeTruthy();
  });

  it('los locales son independientes: guardar en es no pisa en', () => {
    writeResult('es', base);
    writeResult('en', { levels: { math: '5' }, scores: { math: 5 } });
    expect(readResult('es')?.levels.math).toBe('2');
    expect(readResult('en')?.levels.math).toBe('5');
  });

  it('devuelve null si no hay nada guardado', () => {
    expect(readResult('pt')).toBeNull();
  });

  it('clearResult borra solo ese locale', () => {
    writeResult('es', base);
    writeResult('en', base);
    clearResult('es');
    expect(readResult('es')).toBeNull();
    expect(readResult('en')).not.toBeNull();
  });

  it('NO guarda respuestas individuales ni enunciados', () => {
    writeResult('es', base);
    const crudo = store().getItem('pisastyle:evaluacion') ?? '';
    // Lo unico permitido son niveles, aciertos y fecha.
    expect(crudo).not.toMatch(/question|opcion|option|enunciado|stimulus/i);
    expect(Object.keys(JSON.parse(crudo).es).sort()).toEqual(['at', 'levels', 'scores']);
  });

  it('un JSON corrupto no rompe la pagina: devuelve null', () => {
    store().setItem('pisastyle:evaluacion', '{ roto');
    expect(readResult('es')).toBeNull();
  });

  it('sobrescribe el resultado anterior del mismo locale, sin acumular', () => {
    writeResult('es', base);
    writeResult('es', { levels: { math: '5' }, scores: { math: 5 } });
    expect(readResult('es')?.levels.math).toBe('5');
    expect(Object.keys(JSON.parse(store().getItem('pisastyle:evaluacion')!))).toEqual(['es']);
  });
  it('levelForCorrectCount(0) is 1c, (2) is 2, (5) is 5', () => {
    expect(levelForCorrectCount(0)).toBe('1c');
    expect(levelForCorrectCount(2)).toBe('2');
    expect(levelForCorrectCount(5)).toBe('5');
  });

  it('levelForCorrectCount throws for 6 and 1.5', () => {
    expect(() => levelForCorrectCount(6)).toThrow(RangeError);
    expect(() => levelForCorrectCount(1.5)).toThrow(RangeError);
    expect(() => levelForCorrectCount(-1)).toThrow(RangeError);
  });

  it('countCorrect counts correct responses correctly', () => {
    expect(countCorrect([1, 0], [1, 2])).toBe(1);
    expect(countCorrect([1], [null])).toBe(0);
    expect(countCorrect([0, 1, 2], [0, 1, 2])).toBe(3);
    expect(countCorrect([1, 0], [0, 1])).toBe(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { readResult, writeResult, clearResult, type StoredResult } from './evaluation-store';

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
  beforeEach(() => {
    localStorage.clear();
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
    const crudo = localStorage.getItem('pisastyle:evaluacion') ?? '';
    // Lo unico permitido son niveles, aciertos y fecha.
    expect(crudo).not.toMatch(/question|opcion|option|enunciado|stimulus/i);
    expect(Object.keys(JSON.parse(crudo).es).sort()).toEqual(['at', 'levels', 'scores']);
  });

  it('un JSON corrupto no rompe la pagina: devuelve null', () => {
    localStorage.setItem('pisastyle:evaluacion', '{ roto');
    expect(readResult('es')).toBeNull();
  });

  it('sobrescribe el resultado anterior del mismo locale, sin acumular', () => {
    writeResult('es', base);
    writeResult('es', { levels: { math: '5' }, scores: { math: 5 } });
    expect(readResult('es')?.levels.math).toBe('5');
    expect(Object.keys(JSON.parse(localStorage.getItem('pisastyle:evaluacion')!))).toEqual(['es']);
  });
});

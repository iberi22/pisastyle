import { describe, it, expect, beforeEach } from 'vitest';
import {
  createState,
  selectOption,
  toggleFlag,
  goTo,
  next,
  prev,
  isAnswered,
  progress,
  answeredByDomain,
  scoreByDomain,
  serialize,
  deserialize,
  saveState,
  loadState,
  clearState,
  storageKey,
  STORAGE_PREFIX,
  LEVEL_BY_SCORE,
  TONE_BY_SCORE,
  type ExamState,
  type ExamItemLike,
} from './exam-session';

/**
 * El examen necesita mas que un GET con query: respuestas, cursor y marcas de
 * revision. Este modulo es puro e inmutable justamente para poder testearlo sin
 * montar nada; estos tests fijan ese contrato.
 *
 * El caso que mas pesa es `deserialize`: el producto no tiene login y
 * localStorage puede tener lo que le de la gana (otra app, una escritura a
 * medias, un valor editado a mano). Un estado corrupto NO puede romper la
 * pagina, y la unica forma de garantizarlo es que quede fijado en un test.
 */

/** 15 items, 5 por dominio: la forma real de un bundle PISA de PISAStyle. */
const ITEMS: readonly ExamItemLike[] = [
  { id: 'mat1', domain: 'math', correctOptionId: 'mat1.ok' },
  { id: 'mat2', domain: 'math', correctOptionId: 'mat2.ok' },
  { id: 'mat3', domain: 'math', correctOptionId: 'mat3.ok' },
  { id: 'mat4', domain: 'math', correctOptionId: 'mat4.ok' },
  { id: 'mat5', domain: 'math', correctOptionId: 'mat5.ok' },
  { id: 'lee1', domain: 'reading', correctOptionId: 'lee1.ok' },
  { id: 'lee2', domain: 'reading', correctOptionId: 'lee2.ok' },
  { id: 'lee3', domain: 'reading', correctOptionId: 'lee3.ok' },
  { id: 'lee4', domain: 'reading', correctOptionId: 'lee4.ok' },
  { id: 'lee5', domain: 'reading', correctOptionId: 'lee5.ok' },
  { id: 'cie1', domain: 'science', correctOptionId: 'cie1.ok' },
  { id: 'cie2', domain: 'science', correctOptionId: 'cie2.ok' },
  { id: 'cie3', domain: 'science', correctOptionId: 'cie3.ok' },
  { id: 'cie4', domain: 'science', correctOptionId: 'cie4.ok' },
  { id: 'cie5', domain: 'science', correctOptionId: 'cie5.ok' },
];

const TOTAL = ITEMS.length;

/** Estado con las 5 de matematicas respondidas bien y nada mas. */
function mathAnsweredCorrectly(): ExamState {
  let state = createState();
  for (const item of ITEMS.filter((i) => i.domain === 'math')) {
    state = selectOption(state, item.id, item.correctOptionId!);
  }
  return state;
}

describe('exam-session', () => {
  /* ————————————————————————————— inmutabilidad ————————————————————————————— */

  describe('inmutabilidad', () => {
    it('createState devuelve una sesion vacia y nueva cada vez', () => {
      const a = createState();
      const b = createState();
      expect(a).toEqual({ answers: {}, flagged: {}, currentIndex: 0 });
      expect(a.answers).not.toBe(b.answers);
      expect(a.flagged).not.toBe(b.flagged);
    });

    it('selectOption NO muta el estado recibido', () => {
      const before = createState();
      const snapshot = JSON.stringify(before);

      const after = selectOption(before, 'mat1', 'mat1.ok');

      expect(JSON.stringify(before)).toBe(snapshot);
      expect(before.answers).toEqual({});
      expect(after.answers).toEqual({ mat1: 'mat1.ok' });
      expect(after).not.toBe(before);
    });

    it('selectOption no comparte el diccionario de respuestas con el original', () => {
      const before = createState();
      const after = selectOption(before, 'mat1', 'mat1.ok');
      expect(after.answers).not.toBe(before.answers);
    });

    it('toggleFlag NO muta el estado recibido', () => {
      const before = selectOption(createState(), 'mat1', 'mat1.ok');
      const snapshot = JSON.stringify(before);

      const flagged = toggleFlag(before, 'mat1');
      const unflagged = toggleFlag(flagged, 'mat1');

      expect(JSON.stringify(before)).toBe(snapshot);
      expect(before.flagged).toEqual({});
      expect(flagged.flagged).toEqual({ mat1: true });
      // desenmarcar quita la clave en vez de guardar false
      expect(unflagged.flagged).toEqual({});
      expect(JSON.stringify(before)).toBe(snapshot);
    });

    it('la navegacion NO muta el estado recibido', () => {
      const before = createState();
      const snapshot = JSON.stringify(before);

      goTo(before, 7, TOTAL);
      next(before, TOTAL);
      prev(before, TOTAL);

      expect(JSON.stringify(before)).toBe(snapshot);
      expect(before.currentIndex).toBe(0);
    });
  });

  /* —————————————————————————————————— clamp ————————————————————————————————— */

  describe('clamp del cursor', () => {
    it('goTo negativo se queda en el primer item', () => {
      expect(goTo(createState(), -5, TOTAL).currentIndex).toBe(0);
    });

    it('goTo mas alla del final se queda en el ultimo item', () => {
      expect(goTo(createState(), 999, TOTAL).currentIndex).toBe(TOTAL - 1);
    });

    it('goTo dentro de rango respeta el indice', () => {
      expect(goTo(createState(), 0, TOTAL).currentIndex).toBe(0);
      expect(goTo(createState(), 7, TOTAL).currentIndex).toBe(7);
      expect(goTo(createState(), TOTAL - 1, TOTAL).currentIndex).toBe(TOTAL - 1);
    });

    it('prev en el primer item no retrocede', () => {
      expect(prev(createState(), TOTAL).currentIndex).toBe(0);
      expect(prev(goTo(createState(), 2, TOTAL), TOTAL).currentIndex).toBe(1);
    });

    it('next en el ultimo item no avanza', () => {
      const last = goTo(createState(), TOTAL - 1, TOTAL);
      expect(next(last, TOTAL).currentIndex).toBe(TOTAL - 1);
    });

    it('next y prev recorren la lista sin salirse', () => {
      let state = createState();
      for (let i = 0; i < TOTAL + 5; i++) state = next(state, TOTAL);
      expect(state.currentIndex).toBe(TOTAL - 1);
      for (let i = 0; i < TOTAL + 5; i++) state = prev(state, TOTAL);
      expect(state.currentIndex).toBe(0);
    });

    it('NaN, undefined e Infinity no rompen: siempre un indice valido', () => {
      const base = createState();
      for (const bad of [Number.NaN, undefined, Number.POSITIVE_INFINITY, -Infinity]) {
        const state = goTo(base, bad as number, TOTAL);
        expect(Number.isInteger(state.currentIndex)).toBe(true);
        expect(state.currentIndex).toBeGreaterThanOrEqual(0);
        expect(state.currentIndex).toBeLessThanOrEqual(TOTAL - 1);
      }
      // Comportamiento fijado: NaN/undefined caen al inicio, Infinity al final.
      expect(goTo(base, Number.NaN, TOTAL).currentIndex).toBe(0);
      expect(goTo(base, undefined as unknown as number, TOTAL).currentIndex).toBe(0);
      expect(goTo(base, Number.POSITIVE_INFINITY, TOTAL).currentIndex).toBe(TOTAL - 1);
    });

    it('un total de 0 items deja el cursor en 0 y no lanza', () => {
      expect(goTo(createState(), 3, 0).currentIndex).toBe(0);
      expect(next(createState(), 0).currentIndex).toBe(0);
      expect(prev(createState(), 0).currentIndex).toBe(0);
    });
  });

  /* —————————————————————— deserialize robusto (lo que mas pesa) ————————————————— */

  describe('deserialize nunca lanza y rechaza lo corrupto', () => {
    const corrupt: readonly [string, unknown][] = [
      ['undefined', undefined],
      ['null', null],
      ['vacio', ''],
      ['la cadena "null"', 'null'],
      ['la cadena "undefined"', 'undefined'],
      ['JSON truncado', '{roto'],
      ['JSON truncado a media respuesta', '{"answers":{"q1":"a"'],
      ['answers que no es un objeto', '{"answers":"no es un objeto"}'],
      ['answers que es un array', '{"answers":[1,2,3],"flagged":{},"currentIndex":0}'],
      ['flagged que no es un objeto', '{"answers":{},"flagged":7,"currentIndex":0}'],
      ['un array entero', '[1,2,3]'],
      ['un numero', '42'],
      ['una cadena', '"sesion"'],
      ['currentIndex que no es numero', '{"answers":{},"flagged":{},"currentIndex":"3"}'],
      ['currentIndex negativo', '{"answers":{},"flagged":{},"currentIndex":-4}'],
      ['currentIndex NaN serializado', '{"answers":{},"flagged":{},"currentIndex":null}'],
      ['claves de menos', '{"answers":{},"flagged":{}}'],
      ['solo answers', '{"answers":{"q1":"a"}}'],
      ['claves desconocidas', '{"foo":"bar"}'],
    ];

    for (const [label, raw] of corrupt) {
      it(`devuelve null sin lanzar: ${label}`, () => {
        expect(() => deserialize(raw as string | null | undefined)).not.toThrow();
        expect(deserialize(raw as string | null | undefined)).toBeNull();
      });
    }

    it('el ruido dentro de un contenedor valido se descarta, no se rechaza', () => {
      const state = deserialize(
        JSON.stringify({
          v: 1,
          answers: { mat1: 'mat1.ok', mat2: 7, '': 'huerfano' },
          flagged: { mat1: true, mat3: 'si' },
          currentIndex: 3.7,
        }),
      );
      expect(state).not.toBeNull();
      expect(state!.answers).toEqual({ mat1: 'mat1.ok' });
      expect(state!.flagged).toEqual({ mat1: true });
      expect(state!.currentIndex).toBe(3);
    });

    it('acepta una sesion valida tal cual la escribio serialize', () => {
      const state = deserialize(serialize(mathAnsweredCorrectly()));
      expect(state).not.toBeNull();
      expect(isAnswered(state!, 'mat1')).toBe(true);
      expect(state!.answers).toEqual({ mat1: 'mat1.ok', mat2: 'mat2.ok', mat3: 'mat3.ok', mat4: 'mat4.ok', mat5: 'mat5.ok' });
    });
  });

  /* ————————————————————————————————— round-trip ————————————————————————————— */

  describe('serialize / deserialize', () => {
    it('round-trip conserva el estado: serializar, leer y volver a serializar da lo mismo', () => {
      const original = toggleFlag(goTo(selectOption(createState(), 'mat1', 'mat1.ok'), 4, TOTAL), 'lee2');
      const raw = serialize(original);

      const recovered = deserialize(raw);
      expect(recovered).not.toBeNull();
      expect(recovered).toEqual(original);
      expect(serialize(recovered!)).toBe(raw);
    });

    it('un estado recien creado sobrevive al round-trip sin perder nada', () => {
      const fresh = createState();
      expect(deserialize(serialize(fresh))).toEqual(fresh);
    });

    it('el payload serializado no lleva enunciados ni respuestas sueltas sueltas', () => {
      const raw = serialize(mathAnsweredCorrectly());
      expect(JSON.parse(raw).v).toBe(1);
      expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['answers', 'currentIndex', 'flagged', 'v']);
    });
  });

  /* ————————————————————————————————— progreso ——————————————————————————————— */

  describe('progress', () => {
    it('0 de 15 responde 0%', () => {
      const p = progress(createState(), TOTAL);
      expect(p).toEqual({ answered: 0, total: 15, pct: 0 });
    });

    it('1 de 15 responde 7%', () => {
      const state = selectOption(createState(), 'mat1', 'mat1.ok');
      expect(progress(state, TOTAL)).toEqual({ answered: 1, total: 15, pct: 7 });
    });

    it('5 de 15 responde 33%', () => {
      expect(progress(mathAnsweredCorrectly(), TOTAL)).toEqual({ answered: 5, total: 15, pct: 33 });
    });

    it('15 de 15 responde 100 exacto', () => {
      let state = createState();
      for (const item of ITEMS) state = selectOption(state, item.id, item.correctOptionId!);
      const p = progress(state, TOTAL);
      expect(p).toEqual({ answered: 15, total: 15, pct: 100 });
    });

    it('el pct nunca se sale de [0, 100] en ningun punto del recorrido', () => {
      let state = createState();
      expect(progress(state, TOTAL).pct).toBe(0);
      for (const item of ITEMS) {
        state = selectOption(state, item.id, item.correctOptionId!);
        const { pct } = progress(state, TOTAL);
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
      }
    });

    it('total 0 no divide por cero: 0, no NaN', () => {
      const p = progress(selectOption(createState(), 'mat1', 'a'), 0);
      expect(Number.isNaN(p.pct)).toBe(false);
      expect(p).toEqual({ answered: 0, total: 0, pct: 0 });
    });

    it('un total negativo o NaN tampoco produce NaN', () => {
      for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const p = progress(createState(), bad);
        expect(Number.isNaN(p.pct)).toBe(false);
        expect(p.pct).toBe(0);
      }
    });
  });

  /* ———————————————————————————— puntuacion por dominio ————————————————————— */

  describe('answeredByDomain', () => {
    it('cuenta las respuestas por dominio', () => {
      expect(answeredByDomain(createState(), ITEMS)).toEqual({ math: 0, reading: 0, science: 0 });
      expect(answeredByDomain(mathAnsweredCorrectly(), ITEMS)).toEqual({ math: 5, reading: 0, science: 0 });
    });

    it('no inventa dominios que no estan en la lista de items', () => {
      expect(answeredByDomain(mathAnsweredCorrectly(), [])).toEqual({});
    });
  });

  describe('scoreByDomain', () => {
    it('acertar las 5 de matematicas da correct 5 en math y 0 en los otros', () => {
      const scores = scoreByDomain(mathAnsweredCorrectly(), ITEMS);
      expect(scores.math.correct).toBe(5);
      expect(scores.math.total).toBe(5);
      expect(scores.reading.correct).toBe(0);
      expect(scores.science.correct).toBe(0);
    });

    it('un dominio sin responder da correct 0, nunca NaN', () => {
      const scores = scoreByDomain(mathAnsweredCorrectly(), ITEMS);
      // math si esta respondida: 5/5
      expect(scores.math.correct).toBe(5);
      for (const domain of ['reading', 'science'] as const) {
        expect(Number.isNaN(scores[domain].correct)).toBe(false);
        expect(scores[domain].correct).toBe(0);
        // los items sin responder cuentan para el total, no para el acierto
        expect(scores[domain].total).toBe(5);
      }
    });

    it('sin ninguna respuesta la puntuacion es todo a cero y el nivel es 1c', () => {
      const scores = scoreByDomain(createState(), ITEMS);
      expect(scores.math.correct).toBe(0);
      expect(scores.math.level).toBe('1c');
      expect(scores.math.tone).toBe('low');
    });

    it('acertar una sola de matematicas da correct 1 y la cuenta es por item', () => {
      const state = selectOption(selectOption(createState(), 'mat1', 'mat1.ok'), 'mat2', 'mat2.mal');
      const scores = scoreByDomain(state, ITEMS);
      expect(scores.math.correct).toBe(1);
      expect(scores.math.total).toBe(5);
    });

    it('una lista de items vacia no inventa dominios ni devuelve NaN', () => {
      const scores = scoreByDomain(createState(), []);
      expect(scores).toEqual({});
    });

    it('el total por dominio cuenta todos los items, respondidos o no', () => {
      let state = createState();
      state = selectOption(state, 'mat1', 'mat1.ok');
      state = selectOption(state, 'lee1', 'lee1.ok');
      const scores = scoreByDomain(state, ITEMS);
      expect(scores.math.total).toBe(5);
      expect(scores.reading.total).toBe(5);
      expect(scores.science.total).toBe(5);
    });
  });

  /* ——————————————————————————— niveles: paridad con la pagina ————————————————— */

  describe('niveles coherentes con evaluar.astro', () => {
    // Copia deliberada de las tablas de `src/pages/[locale]/evaluar.astro`
    // (LEVEL_BY_SCORE / TONE_BY_SCORE). Si alguien cambia la escala en el
    // modulo sin cambiar la pagina (o al reves), esto falla.
    const PAGINA_LEVEL = ['1c', '1b', '2', '3', '4', '5'];
    const PAGINA_TONE = ['low', 'low', 'mid', 'mid', 'good', 'top'];

    it('las tablas del modulo son copia exacta de las de la pagina', () => {
      expect([...LEVEL_BY_SCORE]).toEqual(PAGINA_LEVEL);
      expect([...TONE_BY_SCORE]).toEqual(PAGINA_TONE);
    });

    it('scoreByDomain da el MISMO nivel que la pagina para cada numero de aciertos', () => {
      for (let correct = 0; correct <= 5; correct++) {
        const items: ExamItemLike[] = Array.from({ length: correct }, (_, i) => ({
          id: `mat${i}`,
          domain: 'math',
          correctOptionId: `mat${i}.ok`,
        }));
        // el sexto item existe pero no se responde: cuenta para total, no para acierto
        items.push({ id: 'matX', domain: 'math', correctOptionId: 'matX.ok' });

        let state = createState();
        for (let i = 0; i < correct; i++) state = selectOption(state, `mat${i}`, `mat${i}.ok`);

        const score = scoreByDomain(state, items).math;
        expect(score.correct).toBe(correct);
        expect(score.total).toBe(correct + 1);
        // lo mismo que hace la pagina: el numero de aciertos ES el indice
        expect(score.level).toBe(PAGINA_LEVEL[correct]);
        expect(score.tone).toBe(PAGINA_TONE[correct]);
      }
    });
  });

  /* ————————————————————————————— aislamiento por locale ————————————————————— */

  describe('aislamiento por locale', () => {
    // Mismo store en memoria que evaluation-store.test.ts: el global de Node 26
    // pisa al de jsdom, asi que el test instala el suyo.
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

    beforeEach(() => {
      Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true, writable: true });
      memory.clear();
    });

    it('la clave incluye el locale', () => {
      expect(storageKey('es')).toBe(`${STORAGE_PREFIX}:es`);
      expect(storageKey('pt')).toBe(`${STORAGE_PREFIX}:pt`);
      expect(storageKey('es')).not.toBe(storageKey('pt'));
    });

    it('el mismo itemId en es y en pt NO mezcla estado', () => {
      saveState('es', selectOption(createState(), 'mat1', 'es.opcion'));
      saveState('pt', selectOption(createState(), 'mat1', 'pt.opcion'));

      expect(loadState('es')!.answers['mat1']).toBe('es.opcion');
      expect(loadState('pt')!.answers['mat1']).toBe('pt.opcion');
    });

    it('guardar en un locale no pisa el otro', () => {
      saveState('es', selectOption(createState(), 'mat1', 'mat1.ok'));
      saveState('pt', selectOption(createState(), 'lee1', 'lee1.ok'));
      expect(loadState('es')!.answers).toEqual({ mat1: 'mat1.ok' });
      expect(loadState('pt')!.answers).toEqual({ lee1: 'lee1.ok' });
    });

    it('un locale sin nada guardado devuelve null, no un estado vacio', () => {
      saveState('es', createState());
      expect(loadState('es')).not.toBeNull();
      expect(loadState('en')).toBeNull();
    });

    it('un valor corrupto en disco devuelve null sin romper la pagina', () => {
      memory.setItem(storageKey('es'), '{roto');
      expect(() => loadState('es')).not.toThrow();
      expect(loadState('es')).toBeNull();
    });

    it('el round-trip por localStorage conserva la sesion', () => {
      const original = toggleFlag(goTo(mathAnsweredCorrectly(), 9, TOTAL), 'cie3');
      saveState('es', original);
      expect(loadState('es')).toEqual(original);
    });

    it('clearState borra solo ese locale', () => {
      saveState('es', mathAnsweredCorrectly());
      saveState('pt', mathAnsweredCorrectly());
      clearState('es');
      expect(loadState('es')).toBeNull();
      expect(loadState('pt')).not.toBeNull();
    });
  });
});
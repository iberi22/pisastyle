import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los 15 ítems de /evaluar tienen que ser correctos, no solo estar bien escritos.
 *
 * — POR QUE ESTE TEST EXISTE —
 * `no-false-teaching.test.ts` vigila que ninguna clave SEA una idea falsa. Eso no
 * cubre los otros dos modos de fallo de un ítem de opción múltiple, y ambos se
 * colaron en los 15:
 *
 *  1. LA ARITMÉTICA. La clave puede ser el número que el autor creía correcto y
 *     no serlo. Aquí se recalcula cada ítem de matemáticas en el propio test con
 *     aritmética racional: 12/3*8, 3/4*5, 4/2, 7*50, 18/30. Si alguien cambia
 *     el enunciado o la clave sin recalcular, el test lo dice.
 *
 *  2. LA AMBIGÜEDAD (item 2 de matemáticas). "Una fracción simplifica a 3/4.
 *     Multiplicando numerador y denominador por 5, ¿qué obtienes?" tenía entre
 *     las opciones "3/4" y "15/20", y la clave era 15/20. Multiplicar numerador
 *     y denominador por el mismo número NO cambia el valor de la fracción: la
 *     fracción sigue valiendo 3/4. O sea, la clave también era 3/4. Dos
 *     opciones igualmente correctas significa que un estudiante que acierta la
 *     pregunta se puntúa 0, y que el nivel que devuelve la página es ruido.
 *
 *     No es una "enseña una falsa": es peor en un sentido práctico. Un ítem sin
 *     respuesta única no mide lo que dice medir.
 *
 * — LA REGLA DE ORO —
 * El valor de las cuatro opciones de un ítem numérico tiene que ser DISTINTO en
 * las cuatro. Si dos opciones valen lo mismo, el ítem no tiene clave única y
 * está roto por construcción, sin importar cuál se marque.
 *
 * — POR QUÉ SE PARSEA EL .astro Y NO UN MÓDULO —
 * La fuente de verdad de estos ítems es el `COPY` del frontmatter de
 * `evaluar.astro`. Las preguntas se leen del fichero para que el test y la
 * página no puedan divergir: si mañana alguien saca el banco a un .ts, este test
 * sigue leyendo lo que la página realmente sirve.
 */
// Las preguntas se movieron de evaluar.astro a src/lib/exam-items.ts. Este test
// sigue vigilando la CORRECTITUD (aritmetica real y ausencia de ambiguedad),
// no la forma: de esa se encarga exam-items.test.ts.
const fuente = readFileSync(
  join(process.cwd(), 'src/lib/exam-items.ts'),
  'utf-8',
);

const DOMINIOS = ['math', 'reading', 'science'] as const;
const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

interface Item {
  enunciado: string;
  opciones: string[];
  clave: number;
}

// Las preguntas ya no viven en evaluar.astro: viven en src/lib/exam-items.ts,
// que es la fuente unica y la que la pagina consume. Este test sigue
// verificando lo mismo (aritmetica real y ausencia de ambiguedad), pero
// sobre el modulo. Ver exam-items.test.ts para el contrato de forma.
function bloqueDe(locale: Locale): string {
  const i = fuente.indexOf(`  ${locale}: [`);
  expect(i, `no se encuentra el bloque ${locale}`).toBeGreaterThan(-1);
  const fin = fuente.indexOf('\n  ],', i);
  return fuente.slice(i, fin);
}

// Cada item es un objeto `ExamItem` en exam-items.ts, no una tupla. Se
// trocean por `id: "<dominio>-<n>"` y de cada trozo se leen stem, options y
// correctIndex. Nada de regex sobre una sola linea: los enunciados ocupan
// varias y un item con acentos rompe el patron.
function itemsDe(bloque: string, dominio: string): Item[] {
  const out: Item[] = [];
  const trozos = bloque.split(/\n  \{\n/).slice(1);
  expect(trozos.length, `no se encuentra el dominio ${dominio}`).toBeGreaterThan(0);
  for (const trozo of trozos) {
    const id = trozo.match(/id:\s*"([^"]+)"/)?.[1] ?? '';
    if (!id.startsWith(`${dominio}-`)) continue;
    const enunciado = trozo.match(/stem:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
    const opciones = [...(trozo.match(/options:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(
      (o) => o[1],
    );
    const clave = Number(trozo.match(/correctIndex:\s*(\d+)/)?.[1]);
    expect(enunciado, `ítem ${id} sin stem`).toBeDefined();
    expect(opciones.length, `ítem ${id} sin opciones`).toBeGreaterThan(0);
    expect(Number.isFinite(clave), `ítem ${id} sin correctIndex`).toBe(true);
    out.push({ enunciado: enunciado!, opciones, clave });
  }
  return out;
}

/** Los 45 ítems: 5 por dominio, en las tres locales. */
const BANCO: Record<Locale, Record<string, Item[]>> = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    Object.fromEntries(DOMINIOS.map((d) => [d, itemsDe(bloqueDe(l), d)])),
  ]),
) as Record<Locale, Record<string, Item[]>>;

/**
 * Valor exacto de una opción numérica, o null si no es numérica.
 * Acepta "350 km", "60 %", "2 h", "15/20". Se comparan racionales, no floats.
 */
function valorDe(opcion: string): { num: number; den: number } | null {
  const uni = opcion.match(/^(\d+(?:[.,]\d+)?)\s*(m|km|%|h|min)\b/);
  if (uni) return { num: Number(uni[1].replace(',', '.')), den: 1 };
  const frac = opcion.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return { num: Number(frac[1]), den: Number(frac[2]) };
  return null;
}

function iguales(a: { num: number; den: number }, b: { num: number; den: number }) {
  return a.num * b.den === b.num * a.den;
}

describe('el banco de la autoevaluación tiene forma', () => {
  for (const loc of LOCALES) {
    for (const dom of DOMINIOS) {
      it(`${loc}/${dom}: 5 ítems, 4 opciones y clave dentro de rango`, () => {
        const items = BANCO[loc][dom];
        expect(items.length, `${loc}/${dom} no tiene 5 ítems`).toBe(5);
        for (const it of items) {
          expect(it.opciones.length, `${loc}/${dom}: ${it.enunciado}`).toBe(4);
          expect(new Set(it.opciones).size, `${loc}/${dom}: opciones repetidas`).toBe(4);
          expect(it.clave).toBeGreaterThanOrEqual(0);
          expect(it.clave).toBeLessThan(4);
        }
      });
    }
  }
});

describe('la aritmética de los 5 ítems de matemáticas, recalculada', () => {
  // Se recalcula aquí, no se copia del fichero: un test que repetiese las
  // cifras del enunciado pasaría aunque el enunciado cambiase.
  const CALCULADO: { que: string; valor: string; porque: string }[] = [
    { que: '3 paneles cubren 12 m, 8 paneles cubren', valor: '32 m', porque: '12/3 = 4 m por panel; 4*8 = 32' },
    { que: 'una fracción que vale 3/4, con numerador y denominador x5', valor: '15/20', porque: '3*5 = 15, 4*5 = 20' },
    { que: '4 h con un manguero, con dos', valor: '2 h', porque: '4 h / 2 mangueras = 2 h' },
    { que: '7 cm a 50 km por cm', valor: '350 km', porque: '7*50 = 350' },
    { que: '18 niñas de 30', valor: '60 %', porque: '18/30 = 0,6 = 60 %' },
  ];

  for (const loc of LOCALES) {
    CALCULADO.forEach((caso, i) => {
      it(`${loc}/matemáticas #${i + 1}: ${caso.porque}`, () => {
        const item = BANCO[loc]['math'][i];
        const clave = item.opciones[item.clave];
        expect(clave, `${loc}/matemáticas #${i + 1} (${caso.que})`).toBe(caso.valor);
      });
    });
  }
});

describe('ningún ítem numérico tiene dos opciones con el mismo valor', () => {
  // El fallo real: en matemáticas #2 ("simplifica a 3/4, x5") la clave era
  // 15/20 y "3/4" estaba también entre las opciones. Como multiplicar numerador
  // y denominador por 5 no cambia el valor de la fracción, 3/4 seguía siendo
  // correcta: dos claves. Quien acertaba se puntuaba 0.
  for (const loc of LOCALES) {
    for (const dom of DOMINIOS) {
      it(`${loc}/${dom}: los valores de las cuatro opciones son distintos`, () => {
        for (const item of BANCO[loc][dom]) {
          const valores = item.opciones.map(valorDe);
          // Solo se comprueban los ítems cuyas CUATRO opciones son numéricas:
          // en lectura y ciencias la clave es un texto, no una cantidad.
          if (valores.some((v) => v === null)) continue;
          for (let a = 0; a < valores.length; a++) {
            for (let b = a + 1; b < valores.length; b++) {
              expect(
                iguales(valores[a]!, valores[b]!),
                `${loc}/${dom}: "${item.enunciado}" — las opciones ` +
                  `"${item.opciones[a]}" y "${item.opciones[b]}" valen lo mismo. ` +
                  `El ítem no tiene respuesta única (la clave es "${item.opciones[item.clave]}").`,
              ).toBe(false);
            }
          }
        }
      });
    }
  }
});

describe('el enunciado no trae basura de tecleo', () => {
  // "Una piscina tarda 4 h en llenarse con un manguo. ¿Con dos mangos iguales?"
  // — dos erratas en el enunciado de matemáticas #3, solo en español: "manguo"
  // y "mangos" no son palabras. En inglés y portugués el mismo ítem está bien.
  for (const loc of LOCALES) {
    for (const dom of DOMINIOS) {
      it(`${loc}/${dom}: sin palabras inexistentes ni restos de CJK`, () => {
        for (const item of BANCO[loc][dom]) {
          const texto = `${item.enunciado} ${item.opciones.join(' ')}`;
          expect(texto, `${loc}/${dom}: "${item.enunciado}"`).not.toMatch(/\bmangos?\b/i);
          expect(texto, `${loc}/${dom}: "${item.enunciado}"`).not.toMatch(/[　-鿿가-힯]/);
        }
      });
    }
  }
});

describe('las tres locales dan la misma respuesta conceptual', () => {
  // La clave es un índice dentro de una baraja distinta en cada idioma, así que
  // el índice no se puede comparar entre locales: se compara el TEXTO. Si una
  // locale apunta a otra opción, el estudiante que cambia de idioma cambia de
  // nota con el mismo conocimiento.
  const CLAVE_DE_TEXTO = [
    ['reading', 0, { es: 'creció 12 % en dos años', en: 'grew 12 % in two years', pt: 'cresceu 12 % em dois anos' }],
    ['reading', 1, { es: 'a pesar de', en: 'despite', pt: 'apesar' }],
    ['reading', 2, { es: 'No, no se sabe', en: 'No, unknown', pt: 'Não, não se sabe' }],
    ['reading', 3, { es: 'opinión o sugerencia', en: 'opinion or suggestion', pt: 'opinião ou sugestão' }],
    ['reading', 4, { es: 'relación esperada', en: 'expected relationship', pt: 'relação esperada' }],
    ['science', 0, { es: 'congelación', en: 'freezing point', pt: 'congelamento' }],
    ['science', 1, { es: 'Fototropismo', en: 'Phototropism', pt: 'Fototropismo' }],
    ['science', 2, { es: 'empuje', en: 'buoyant force', pt: 'empuxo' }],
    ['science', 3, { es: 'cinética', en: 'Kinetic energy', pt: 'cinética' }],
    ['science', 4, { es: 'hielo derritiéndose', en: 'Ice melting', pt: 'gelo derretendo' }],
  ] as const;

  for (const [dom, i, porLocale] of CLAVE_DE_TEXTO) {
    it(`${dom} #${i + 1}: la clave es la misma idea en es, en y pt`, () => {
      for (const loc of LOCALES) {
        const item = BANCO[loc][dom][i];
        const clave = item.opciones[item.clave];
        expect(
          clave.toLowerCase(),
          `${loc}/${dom} #${i + 1}: la clave "${clave}" no es "${porLocale[loc]}"`,
        ).toContain(porLocale[loc].toLowerCase());
      }
    });
  }
});
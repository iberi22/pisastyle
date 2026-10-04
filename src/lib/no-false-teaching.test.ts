import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ningun ítem puede ENSEÑAR UNA FALSA.
 *
 * — POR QUE ESTE TEST EXISTE —
 * Cuatro ítems de `/evaluar` (y varios de `items/science`) tienen la clave
 *(pointing a la opcion) correcta, pero el CONCEPTO quePrem teaching es falso o
 * la aritmetica de la explicacion no cuadra. Un item con la respuesta mal puesta
 * es un bug visible; uno que ademas explica mal es peor: enseña falsehoods con
 * lenguaje de manual, y el estudiante que confía en la herramienta se lleva la
 * idea equivocada a casa. Para un producto de preparacion PISA, es el peor tipo
 * de bug posible: no se ve, y erosiona la confianza justo en lo que hay que
 * vender.
 *
 * Estos cuatro, verificados por calculo propio y confirmados por la revision
 * independiente:
 *
 * 1. CIENCIAS · "los objetos mas densos se hunden porque desplazan mas agua por
 *    su volumen" -> FALSO. Un cuerpo sumergido desplaza SIEMPRE su propio
 *    volumen, densa o no. Lo que lo hace hundirse es que su peso supera el
 *    empuje. La clave premia una idea falsa de Arquimedes.
 *
 * 2. LECTURA · "A pesar del aumento del precio, la demanda bajo" -> la clave es
 *    "una contradiccion aparente", pero ESA ES LA RELACION ESPERADA: si sube el
 *    precio, baja la demanda. El enunciado usa mal "a pesar de", asi que premia
 *    un razonamiento erroneo.
 *
 * 3. CIENCIAS item 6 · las perdidas mensuales son [27, -6, -2, -1]: la masa
 *    AUMENTA cada mes. La explicacion usa [27, 21, 19, 18] y dice que suman 85 g
 *    sobre 30 g de partida: imposible.
 *
 * 4. CIENCIAS item 8 · "cerca del ecuador, dia de 10 h 36 min el 21 de junio y
 *    8 h 28 min el 21 de diciembre". A 0 grados de latitud el dia dura ~12 h todo
 *    el ano. La resta (2 h 8 min) es correcta, pero el dato es fisicamente
 *    imposible.
 *
 * Este test falla mientras alguno siga en el fichero. No basta con arreglar la
 * clave: hay que reescribir el enunciado o cambiar el item.
 */
const EVALUAR = join(process.cwd(), 'src/pages/[locale]/evaluar.astro');
const CIENCIAS = join(
  process.cwd(),
  'items/science/en/science-en-2026-10-04-unidad-01.md',
);

const evaluar = readFileSync(EVALUAR, 'utf-8');
const ciencias = readFileSync(CIENCIAS, 'utf-8');

/** Los tres locales, para que un arreglo no se deje a medio camino. */
describe('no se enseña una falsa (3 locales)', () => {
  it('el item de densidade no premia "desplazan mas agua por su volumen"', () => {
    // El texto教 de Arquimedes correcto es: se hunden porque su peso supera el
    // empuje. Si la opcion que hace de clave sigue siendo la del volumen
    // desplazado, el item sigue enseñando la idea falsa.
    expect(evaluar).not.toMatch(
      /desplazan (m[áa]s|more) agua por su volumen/i,
    );
  });

  it('el item de precio/demanda no premia "contradiccion aparente"', () => {
    // Subir el precio y bajar la demanda es la ley de la oferta y la demanda:
    // es lo ESPERADO. Premiar "contradiccion" invierte el sentido.
    const frases = evaluar.match(/contradicci[óo]n aparente/gi) ?? [];
    for (const frase of frases) {
      expect(
        frase,
        'si "contradiccion aparente" sigue en el fichero, el item sigue mal',
      ).toBe('__ausente__');
    }
  });
});

describe('items/science: aritmetica y fisica', () => {
  it('item 6: la serie de perdidas que da la explicacion cuadra con 30 g', () => {
    // Residuos 3, 9, 11, 12 g. Perdidas mensuales: 27, -6, -2, -1.
    // Los residuos se LEEN del item: si estan hardcodeados aqui, el test pasa a
    // comprobar una serie que el fichero ya no tiene, y da verde en falso.
    // Solo el ENUNCIADO: la explicacion repite cifras y contaminaria la lectura.
    const item6 = ciencias.slice(ciencias.indexOf('## Item 6'), ciencias.indexOf('## Item 7'));
    const enunciado = item6.slice(0, item6.indexOf('- [ ] A)'));
    // Todos los "N g" del ENUNCIADO. El texto va con saltos de linea a mitad de
    // frase ("to 13 g after the\nsecond"), asi que un regex sobre la frase entera
    // se rompe; los numeros si sobreviven al salto.
    const todos = [...enunciado.matchAll(/(\d+) g/g)].map((m) => Number(m[1]));
    // La masa inicial se enuncia dos veces ("buries 30 g ... falls from 30 g").
    // Las restates consecutivas no son mediciones nuevas, asi que se colapsan.
    const residuos = todos.filter((v, i) => i === 0 || v !== todos[i - 1]);
    expect(residuos.length, 'no se pudo leer la serie de residuos del item 6').toBeGreaterThanOrEqual(5);
    expect(residuos[0], 'la masa inicial debe ser la primera cifra del enunciado').toBeGreaterThan(0);
    const perdidas = residuos.slice(1).map((r, i) => residuos[i] - r);
    // La serie que la explicacionostenia (27, 21, 19, 18) daria 85 g, mas de lo
    // que habia. El item tiene que ser coherente o tiene que desaparecer.
    const suma = perdidas.reduce((a, b) => a + b, 0);
    expect(suma, 'las perdidas no pueden sumar mas de la masa inicial').toBeLessThanOrEqual(residuos[0]);
    // Y si la clave dice "cada mes se perdio menos", la serie debe decrecer.
    const decreciente = perdidas.every((p, i) => i === 0 || p < perdidas[i - 1]);
    if (ciencias.includes('became smaller') || ciencias.includes('menor')) {
      expect(decreciente, 'la serie de perdidas no decrece pero la clave lo afirma').toBe(true);
    }
  });

  it('item 8: el dia cerca del ecuador no puede durar 10 h 36 min en junio', () => {
    // A ~0 grados de latitud la duracion del dia es ~12 h en todo el ano: la
    // inclinacion del eje no produce estacion alli. Si el item sigue
    // afirmandolo, el dato es fisicamente imposible.
    const mencionaEcuador = /near the equator/i.test(ciencias);
    if (mencionaEcuador) {
      const duraciones = [...ciencias.matchAll(/(\d+)\s*hours?\s*(\d+)\s*min/i)].map(
        (m) => Number(m[1]) + Number(m[2]) / 60,
      );
      for (const d of duraciones) {
        expect(
          d,
          `duracion de ${d.toFixed(2)} h imposible cerca del ecuador (debe rondar 12 h)`,
        ).toBeGreaterThan(11.5);
      }
    }
  });
});
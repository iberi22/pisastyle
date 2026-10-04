import { describe, it, expect } from 'vitest';
import { rankingRows, RANKING_MAX, type RankingRow } from './ranking';

/**
 * La serie que alimenta ranking-bars sale de home.*.json, que ya existe en las
 * tres locales. Estos tests fijan las reglas que la skill `pisastyle-infographics`
 * exige y que el grafico tiene que cumplir:
 *
 *  - "Ejes de barras SIEMPRE desde cero": la escala arranca en 0, nunca en el
 *    minimo del dataset. Truncar para exaggerar brechas esta prohibido.
 *  - Contraste y datos: el SVG lleva title/desc traducidos y la tabla de datos
 *    va en <details> (la skill lo pide para lectores de pantalla e impresion).
 */

describe('rankingRows', () => {
  const CO = {
    math: 383,
    reading: 409,
    science: 411,
  };

  it('devuelve una fila por dominio y region, en el orden de las tres regiones', () => {
    const rows = rankingRows({
      colombia: CO,
      oecd: { math: 472, reading: 476, science: 485 },
      singapore: { math: 575, reading: 543, science: 561 },
      labels: { math: 'Matemáticas', reading: 'Lectura', science: 'Ciencias' },
      regionLabels: { colombia: 'Colombia', oecd: 'Promedio OCDE', singapore: 'Singapur (top)' },
    });

    expect(rows).toHaveLength(9);
    expect(new Set(rows.map((r) => r.region))).toEqual(new Set(['colombia', 'oecd', 'singapore']));
  });

  it('el eje empieza en cero: el ancho es proporcion al valor, no al rango', () => {
    const rows = rankingRows({
      colombia: CO,
      oecd: { math: 472, reading: 476, science: 485 },
      singapore: { math: 575, reading: 543, science: 561 },
      labels: { math: 'Matemáticas', reading: 'Lectura', science: 'Ciencias' },
      regionLabels: { colombia: 'Colombia', oecd: 'Promedio OCDE', singapore: 'Singapur (top)' },
    });

    const col = rows.find((r) => r.region === 'colombia' && r.domain === 'math')!;
    const oecd = rows.find((r) => r.region === 'oecd' && r.domain === 'math')!;
    // 383 y 472 sobre la misma escala: el ratio de anchos debe ser el ratio de
    // valores. Si el eje arrancase en el minimo (383), ambos serian iguales.
    expect(col.value / oecd.value).toBeCloseTo(383 / 472, 5);
    expect(col.width).toBeCloseTo(oecd.width * (383 / 472), 5);
    expect(col.width).toBeLessThan(oecd.width);
  });

  it('la escala cubre el maximo del dataset con un margen, sin truncar', () => {
    const rows = rankingRows({
      colombia: CO,
      oecd: { math: 472, reading: 476, science: 485 },
      singapore: { math: 575, reading: 543, science: 561 },
      labels: { math: 'Matemáticas', reading: 'Lectura', science: 'Ciencias' },
      regionLabels: { colombia: 'Colombia', oecd: 'Promedio OCDE', singapore: 'Singapur (top)' },
    });

    // La barra mas alta debe tocar el borde, no desbordarlo (skill: eje 0-600).
    const max = Math.max(...rows.map((r) => r.value));
    const masAlta = rows.find((r) => r.value === max)!;
    expect(RANKING_MAX).toBeGreaterThan(max);
    expect(masAlta.width).toBeLessThanOrEqual(1);
    expect(masAlta.width).toBeGreaterThan(0.95);
  });

  it('todas las filas llevan etiqueta de dominio y de region ya traducidas', () => {
    const rows = rankingRows({
      colombia: CO,
      oecd: { math: 472, reading: 476, science: 485 },
      singapore: { math: 575, reading: 543, science: 561 },
      labels: { math: 'Math', reading: 'Reading', science: 'Science' },
      regionLabels: { colombia: 'Colombia', oecd: 'OECD Average', singapore: 'Singapore (top)' },
    });

    for (const r of rows) {
      expect(r.domainLabel.length).toBeGreaterThan(0);
      expect(r.regionLabel.length).toBeGreaterThan(0);
    }
    expect(rows.find((r) => r.domain === 'math')!.domainLabel).toBe('Math');
  });

  it('marca quien esta por debajo del promedio OCDE, para no comparar con ejes distintos', () => {
    const rows = rankingRows({
      colombia: CO,
      oecd: { math: 472, reading: 476, science: 485 },
      singapore: { math: 575, reading: 543, science: 561 },
      labels: { math: 'Matemáticas', reading: 'Lectura', science: 'Ciencias' },
      regionLabels: { colombia: 'Colombia', oecd: 'Promedio OCDE', singapore: 'Singapur (top)' },
    });

    const colMath = rows.find((r) => r.region === 'colombia' && r.domain === 'math')!;
    const singMath = rows.find((r) => r.region === 'singapore' && r.domain === 'math')!;
    const oecdMath = rows.find((r) => r.region === 'oecd' && r.domain === 'math')!;

    expect(colMath.belowOecd).toBe(true);
    expect(singMath.belowOecd).toBe(false);
    expect(oecdMath.belowOecd).toBe(false);
  });

  it('un dominio sin dato no produce fila (no inventa ceros)', () => {
    const rows = rankingRows({
      colombia: { math: 383 } as never, // sin reading/science
      oecd: { math: 472, reading: 476, science: 485 },
      singapore: { math: 575, reading: 543, science: 561 },
      labels: { math: 'Matemáticas', reading: 'Lectura', science: 'Ciencias' },
      regionLabels: { colombia: 'Colombia', oecd: 'Promedio OCDE', singapore: 'Singapur (top)' },
    });

    const deColombia = rows.filter((r) => r.region === 'colombia');
    expect(deColombia).toHaveLength(1);
    expect(deColombia[0].domain).toBe('math');
  });

  it('el tipo RankingRow expone lo que el SVG necesita', () => {
    // Compila solo si la forma es la que se usa en el componente.
    const fila: RankingRow = {
      region: 'colombia',
      regionLabel: 'Colombia',
      domain: 'math',
      domainLabel: 'Matemáticas',
      value: 383,
      width: 0.638,
      belowOecd: true,
    };
    expect(fila.value).toBe(383);
  });
});

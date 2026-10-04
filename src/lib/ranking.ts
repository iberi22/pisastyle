/**
 * Datos y escala para la infografía `ranking-bars`.
 *
 * Reglas de la skill `pisastyle-infographics` que este módulo garantiza:
 *
 *  - "Ejes de barras SIEMPRE desde cero. Nada de truncar para exagerar brechas."
 *    Aquí el eje va de 0 a RANKING_MAX. Las barras son `value / RANKING_MAX`, así
 *    que comparar 383 con 472 es comparar longitudes, no Visualizar el contraste
 *    amplificado. El RANKING_MAX se redondea por encima del máximo del dataset
 *    para que la barra más alta no toque el borde del SVG.
 *
 *  - "Color NUNCA como único canal." Cada fila lleva su etiqueta de texto y
 *    `belowOecd`, que el componente pinta como marca, no solo como color.
 *
 * Los datos vienen de `home.{es,en,pt}.json`, que ya están traducidos: no hay
 * que volver a traducir las etiquetas ni los nombres de región aquí.
 */

/** Regiones en orden: el de referencia primero, el país y el líder después. */
export const REGIONS = ['oecd', 'colombia', 'singapore'] as const;
export type RegionKey = (typeof REGIONS)[number];

/** Dominios en el orden en que los publica la OCDE. */
export const DOMAINS = ['math', 'reading', 'science'] as const;
export type DomainKey = (typeof DOMAINS)[number];

/**
 * Tope de la escala. 600 y no 575 (el máximo real) para que la barra más alta
 * no llegue al borde: con el tope justo, el SVG muestra el dato pegado al marco y
 * se lee como recortado.
 */
export const RANKING_MAX = 600;

/** Redondea el tope a un múltiplo de 50 hacia arriba, respetando el mínimo. */
function scaleMax(values: number[]): number {
  const max = Math.max(...values);
  if (!Number.isFinite(max) || max <= 0) return RANKING_MAX;
  const step = 50;
  return Math.max(RANKING_MAX, Math.ceil(max / step) * step);
}

export interface RankingRow {
  region: RegionKey;
  /** Nombre de la región ya traducido: "Promedio OCDE". */
  regionLabel: string;
  domain: DomainKey;
  /** Nombre del dominio ya traducido: "Matemáticas". */
  domainLabel: string;
  value: number;
  /** Proporción 0..1 sobre RANKING_MAX, lista para el ancho del SVG. */
  width: number;
  /** Por debajo del promedio OCDE en ese dominio. */
  belowOecd: boolean;
}

export interface RankingInput {
  colombia: Record<string, number>;
  oecd: Record<string, number>;
  singapore: Record<string, number>;
  /** Dominio -> etiqueta traducida. */
  labels: Record<string, string>;
  /** Región -> etiqueta traducida. */
  regionLabels: Record<string, string>;
}

/**
 * Una fila por región y dominio con dato.
 *
 * Un dominio sin valor NO produce fila: pintar 0 inventaría un dato que no
 * existe. La tabla de datos y el SVG se construyen con lo que hay.
 */
export function rankingRows(input: RankingInput): RankingRow[] {
  const valores: number[] = [];
  for (const region of REGIONS) {
    const porDomain = input[region] ?? {};
    for (const domain of DOMAINS) {
      const v = porDomain[domain];
      if (typeof v === 'number' && Number.isFinite(v)) valores.push(v);
    }
  }

  const max = scaleMax(valores);
  const rows: RankingRow[] = [];

  for (const region of REGIONS) {
    const porDomain = input[region] ?? {};
    for (const domain of DOMAINS) {
      const v = porDomain[domain];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const oecd = input.oecd?.[domain];
      rows.push({
        region,
        regionLabel: input.regionLabels?.[region] ?? region,
        domain,
        domainLabel: input.labels?.[domain] ?? domain,
        value: v,
        width: v / max,
        belowOecd: typeof oecd === 'number' ? v < oecd : false,
      });
    }
  }

  return rows;
}

/** Máximo real del eje con los datos dados, ya redondeado. */
export function rankingScale(rows: RankingRow[]): number {
  return scaleMax(rows.map((r) => r.value));
}

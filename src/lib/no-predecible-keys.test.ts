import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La clave no puede ser predecible.
 *
 * — POR QUE ESTE TEST EXISTE —
 * Los tres bundles de 8 items tenían la clave exactamente ABCDABCD. La regla de
 * sesgo de letra (`answer-letter-bias`) los aprobaba: el reparto es 2/2/2/2, que
 * es justo lo que la regla exige (ninguna letra por encima del 50 %).
 *
 * Pero el reparto no es lo que importa. Importa que un estudiante que se
 * aprenda el patrón acierte las ocho sin leer nada, y que un agente que genere
 * preguntasmarked como "correctas" aprenda a exploits. El banco parece
 * aleatorio y no lo es.
 *
 * Dos bancos con el mismo 2/2/2/2 son igual de validos: uno con A,B,C,D,A,B,C,D
 * y otro con A,C,B,D,D,B,C,A. El primero regala la respuesta.
 *
 * — QUE COMPRUEBA —
 * Para cada fichero con 4+ items, la secuencia de claves no debe ser periódica
 * con periodo 2, 3 ni 4. Con 8 items, el periodo 4 cubre exactamente el caso
 * ABCDABCD... que es el que se coló tres veces seguidas.
 */
const ITEMS = join(process.cwd(), 'items');

function* bundles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* bundles(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

/** Periodo de la secuencia de claves, o null si no es periódica. */
function periodOf(seq: string[]): number | null {
  for (let p = 1; p <= 4; p++) {
    if (seq.length <= p) break;
    if (seq.every((v, i) => v === seq[i % p])) return p;
  }
  return null;
}

/** Claves correctas de un fichero, en orden de item. */
function clavesDe(fuente: string): string[] {
  const out: string[] = [];
  for (const m of fuente.matchAll(/^- \[x\] ([A-D])\)/gm)) out.push(m[1]);
  return out;
}

describe('las claves no pueden ser predecibles', () => {
  const ficheros = [...bundles(ITEMS)];

  it('hay bundles que comprobar', () => {
    expect(ficheros.length).toBeGreaterThan(0);
  });

  for (const ruta of ficheros) {
    const seq = clavesDe(readFileSync(ruta, 'utf-8'));
    if (seq.length < 4) continue;
    const nombre = ruta.replace(ITEMS + '/', '');
    const periodo = periodOf(seq);

    it(`${nombre}: no es una secuencia periódica`, () => {
      expect(
        periodo,
        `las claves son ${seq.join('')}: periódica de periodo ${periodo}. ` +
          `Un estudiante que aprenda el patrón acierta todas sin leer.`,
      ).toBeNull();
    });
  }
});

describe('el mismo contenido no puede tener la misma clave en las tres locales', () => {
  it('las tres locales de /evaluar no comparten la misma secuencia', () => {
    // La secuencia de claves ahora vive en src/lib/exam-items.ts, no en la
    // pagina: la pagina consume el modulo. Se lee de ahi, que es la fuente.
    const mod = readFileSync(join(process.cwd(), 'src/lib/exam-items.ts'), 'utf-8');
    const seqs: Record<string, string> = {};
    for (const loc of ['es', 'en', 'pt']) {
      const i = mod.indexOf(`  ${loc}: [`);
      expect(i, `no se encuentra ${loc}`).toBeGreaterThan(-1);
      const bloque = mod.slice(i, mod.indexOf('\n  ],', i));
      seqs[loc] = [...bloque.matchAll(/correctIndex:\s*(\d+)/g)].map((m) => m[1]).join('');
    }
    const conDatos = Object.entries(seqs).filter(([, s]) => s.length >= 8);
    expect(conDatos.length, 'no se leyeron las tres locales').toBe(3);
    // Que dos locales no compartan la serie entera: si la comparten, el mismo
    // alumno que resuelve en español tiene la respuesta en las otras.
    const [a, b] = conDatos;
    expect(a[1]).not.toBe(b[1]);
  });
});
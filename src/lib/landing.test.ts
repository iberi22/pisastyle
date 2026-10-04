import { describe, it, expect } from 'vitest';
import { landingCtas, type LandingCta } from './landing';

/**
 * La landing real es `/{locale}/explorar`: el middleware redirige `/` y
 * `/{locale}` ahi (src/middleware.ts:68), asi que `[locale]/index.astro` es
 * inalcanzable y su hero no lo ve nadie.
 *
 * Estos tests fijan lo que la landing debe ofrecer y hacia donde lleva. Un CTA
 * sin destino es el sintoma exacto de "no es una app": botones que no hacen
 * nada. Por eso se comprueba el `href`, no solo que exista la etiqueta.
 */

describe('landingCtas', () => {

  it('ofrece los dos destinos que importan: estudiar y evaluarse', () => {
    for (const loc of ['es', 'en', 'pt'] as const) {
      const ctas = landingCtas(loc);
      expect(ctas.length).toBeGreaterThanOrEqual(2);
      const hrefs = ctas.map((c) => c.href);
      // Uno lleva a la unidad de la landing; otro, a la autoevaluacion.
      expect(hrefs.some((h) => h.endsWith('/explorar'))).toBe(true);
      expect(hrefs.some((h) => h.endsWith('/evaluar'))).toBe(true);
    }
  });

  it('todo CTA tiene href real: sin destinos vacios ni "#"', () => {
    for (const loc of ['es', 'en', 'pt'] as const) {
      for (const c of landingCtas(loc)) {
        expect(c.href).toBeTruthy();
        expect(c.href).not.toBe('#');
        expect(c.href).not.toContain('undefined');
      }
    }
  });

  it('el href lleva el locale del usuario, no uno hardcodeado', () => {
    expect(landingCtas('es')[0].href.startsWith('/es')).toBe(true);
    expect(landingCtas('en')[0].href.startsWith('/en')).toBe(true);
    expect(landingCtas('pt')[0].href.startsWith('/pt')).toBe(true);
  });

  it('el CTA principal es el de evaluacion: es la accion que el usuario busca', () => {
    // El goal era "no veo un evaluar aqui": la entrada al evaluador tiene que
    // estar en la landing, no escondida en el menu.
    for (const loc of ['es', 'en', 'pt'] as const) {
      const ctas = landingCtas(loc);
      const principal = ctas.find((c) => c.primary);
      expect(principal).toBeDefined();
      expect(principal!.href).toContain('/evaluar');
    }
  });

  it('las etiquetas estan traducidas, no en crudo', () => {
    const es = landingCtas('es').map((c) => c.label);
    const en = landingCtas('en').map((c) => c.label);
    const pt = landingCtas('pt').map((c) => c.label);
    expect(new Set(es).size).toBe(es.length);
    expect(new Set(en).size).toBe(en.length);
    // Ni una etiqueta puede quedarse en ingles en la version española/portuguesa
    // de la accion principal.
    expect(es[0]).not.toMatch(/^[A-Za-z ]+$/);
    expect(pt[0]).not.toMatch(/^[A-Za-z ]+$/);
    // Y las tres listas no son identicas (traducido de verdad, no copiado).
    expect(es.join('|')).not.toBe(en.join('|'));
    expect(en.join('|')).not.toBe(pt.join('|'));
  });

  it('el tipo LandingCta cubre lo que el componente necesita', () => {
    const c: LandingCta = { label: 'Evalúa tu nivel', href: '/es/evaluar', primary: true, variant: 'primary' };
    expect(c.href).toBe('/es/evaluar');
  });
});

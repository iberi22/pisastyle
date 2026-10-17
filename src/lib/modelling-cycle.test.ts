import { describe, it, expect } from 'vitest';
import { MODELLING_CYCLE_NODES, modellingCycleLabels } from './modelling-cycle';
import { PISASTYLE_LOCALES } from './pisa-i18n';

describe('Modelling Cycle Data Contract', () => {
  it('has exactly 3 nodes with ids [formulate, employ, interpret] in each locale', () => {
    for (const locale of PISASTYLE_LOCALES) {
      const nodes = MODELLING_CYCLE_NODES[locale];
      expect(nodes).toBeDefined();
      expect(nodes.length).toBe(3);
      const ids = nodes.map(n => n.id);
      expect(ids).toEqual(['formulate', 'employ', 'interpret']);
    }
  });

  it('has non-empty label and description for every node in every locale', () => {
    for (const locale of PISASTYLE_LOCALES) {
      const nodes = MODELLING_CYCLE_NODES[locale];
      for (const node of nodes) {
        expect(typeof node.label).toBe('string');
        expect(node.label.trim().length).toBeGreaterThan(0);
        expect(typeof node.description).toBe('string');
        expect(node.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('contains no placeholder text like undefined, [object Object] or TODO', () => {
    for (const locale of PISASTYLE_LOCALES) {
      const nodes = MODELLING_CYCLE_NODES[locale];
      for (const node of nodes) {
        const fullText = `${node.label} ${node.description}`;
        expect(fullText).not.toContain('undefined');
        expect(fullText).not.toContain('[object Object]');
        expect(fullText).not.toContain('TODO');
      }
    }
  });

  describe('modellingCycleLabels', () => {
    it('returns a record of labels for a valid locale', () => {
      const labels = modellingCycleLabels('es');
      expect(labels.formulate).toBe('Formular');
      expect(labels.employ).toBe('Emplear');
      expect(labels.interpret).toBe('Interpretar');
    });

    it('falls back to English for unknown locales (though types prevent it)', () => {
      const labels = modellingCycleLabels('fr' as any);
      expect(labels.formulate).toBe('Formulate');
    });
  });
});

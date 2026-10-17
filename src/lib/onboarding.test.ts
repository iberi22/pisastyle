import { describe, it, expect } from 'vitest';
import { ONBOARDING_STEPS, onboardingStepIds } from './onboarding';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { PisaLocale } from './pisa-i18n';

describe('onboarding data', () => {
  const locales: PisaLocale[] = ['es', 'en', 'pt'];
  const expectedIds = ['no-account', 'on-device', 'local-ai', 'device-lock', 'own-your-data'];

  it('contains the correct step IDs in the exact order for all locales', () => {
    for (const loc of locales) {
      expect(onboardingStepIds(loc)).toEqual(expectedIds);
    }
  });

  it('has non-empty title and body for every step in every locale', () => {
    for (const loc of locales) {
      for (const step of ONBOARDING_STEPS[loc]) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
      }
    }
  });

  it('contains the correct no-account phrase in each locale', () => {
    const noAccountPhrases = {
      es: 'sin registro',
      en: 'no sign-up',
      pt: 'sem cadastro'
    };

    for (const loc of locales) {
      const step = ONBOARDING_STEPS[loc].find(s => s.id === 'no-account');
      expect(step).toBeDefined();
      const combinedText = `${step!.title} ${step!.body}`.toLowerCase();
      expect(combinedText).toContain(noAccountPhrases[loc]);
    }
  });

  it('does not mention forbidden words in any locale', () => {
    const forbiddenPattern = /cuota|cupo diario|suscripción obligatoria|registro obligatorio/i;
    for (const loc of locales) {
      for (const step of ONBOARDING_STEPS[loc]) {
        const combinedText = `${step.title} ${step.body}`;
        expect(combinedText).not.toMatch(forbiddenPattern);
      }
    }
  });
});

describe('onboarding integration', () => {
  it('imports ONBOARDING_STEPS and maps it in explorar.astro', () => {
    const filePath = join(process.cwd(), 'src/pages/[locale]/explorar.astro');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('ONBOARDING_STEPS');
    expect(content).toContain('id="onboarding"');
    expect(content).toMatch(/ONBOARDING_STEPS\[.*\]\.map\(/);
  });
});

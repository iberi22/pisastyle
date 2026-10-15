import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // `src/**` es el producto; `scripts/**` cubre el pegamento de deploy
    // (normalize-wrangler-config, infra-config). Son .mjs y quedan fuera de
    // tsconfig/astro check a proposito: se prueban ejecutandolos.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    exclude: ['node_modules', 'dist', '.astro', 'tests/e2e/**', 'playwright.config.*'],
  },
});

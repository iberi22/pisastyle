import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYOUT_PATH = join(process.cwd(), 'src/layouts/Layout.astro');

describe('ConsentBanner integration', () => {
  it('mounts ConsentBanner in Layout.astro to ensure opt-in is requested', () => {
    const layoutSrc = readFileSync(LAYOUT_PATH, 'utf-8');

    // Verifies that ConsentBanner is imported
    expect(layoutSrc).toContain("import ConsentBanner from '../components/ConsentBanner.svelte';");

    // Verifies that ConsentBanner is mounted as a client-side component
    expect(layoutSrc).toMatch(/<ConsentBanner[\s\S]*client:only="svelte"[\s\S]*\/>/);

    // Verifies that the required props are passed down
    expect(layoutSrc).toContain('title=');
    expect(layoutSrc).toContain('description=');
    expect(layoutSrc).toContain('acceptText=');
    expect(layoutSrc).toContain('rejectText=');
  });
});

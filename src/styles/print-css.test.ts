import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRINT_CSS = join(process.cwd(), 'src/styles/print.css');
const LAYOUT_ASTRO = join(process.cwd(), 'src/layouts/Layout.astro');

describe('print.css and Layout.astro tests', () => {
  const printCss = readFileSync(PRINT_CSS, 'utf-8');
  const layoutAstro = readFileSync(LAYOUT_ASTRO, 'utf-8');

  it('print.css contains @media print block and correct structure', () => {
    expect(printCss).toContain('@media print');
    const mediaPrintIndex = printCss.indexOf('@media print');
    expect(mediaPrintIndex).toBeGreaterThan(-1);

    const beforeMedia = printCss.slice(0, mediaPrintIndex);
    const afterMedia = printCss.slice(mediaPrintIndex);

    // nav { display: none } should not be before @media print
    expect(beforeMedia).not.toContain('display: none');
    // nav { display: none } must be after @media print
    expect(afterMedia).toContain('display: none');

    // #fff should be after @media print
    expect(afterMedia).toContain('#fff');
  });

  it('print.css preserves @page { size: A4 }', () => {
    expect(printCss).toContain('size: A4');
  });

  it('Layout.astro imports print.css exactly once', () => {
    const importStatement = "@import '../styles/print.css';";
    const matches = layoutAstro.match(new RegExp(importStatement.replace(/\./g, '\\.').replace(/\//g, '\\/'), 'g'));
    expect(matches).toBeTruthy();
    expect(matches!.length).toBe(1);
  });
});

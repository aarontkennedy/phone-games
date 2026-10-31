// Emoji aren't flat: phones draw them glossy and shaded (docs/DESIGN.md, "Flat design").
// Reads files from disk, not via imports, so it doesn't skew test coverage.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd(); // vitest runs from the project root
const SRC = join(ROOT, 'src');

const sources = readdirSync(SRC, { recursive: true })
  .map(String)
  .filter((f) => /\.(ts|css|html)$/.test(f) && !f.endsWith('.test.ts') && !f.startsWith('test/'));

describe('no emoji in the app', () => {
  it('finds the source files to check', () => {
    expect(sources).toContain('app.ts');
  });

  it.each(sources)('src/%s contains no emoji', (file) => {
    const code = readFileSync(join(SRC, file), 'utf8');
    expect(code.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  });

  it('index.html contains no emoji', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  });
});

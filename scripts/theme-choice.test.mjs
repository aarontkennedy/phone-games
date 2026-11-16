import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { scope, themeChoice } from './theme-choice.mjs';

const run = async (css) => (await postcss([themeChoice()]).process(css, { from: undefined })).css;

describe('scope', () => {
  it('puts the condition on :root or html itself', () => {
    expect(scope(':root', '[x]')).toBe(':root[x]');
    expect(scope('html', '[x]')).toBe('html[x]');
  });

  it('puts other selectors under :root', () => {
    expect(scope('.ce .card', '[x]')).toBe(':root[x] .ce .card');
    expect(scope('  .htmlish ', '[x]')).toBe(':root[x] .htmlish');
  });
});

describe('themeChoice', () => {
  it('guards dark blocks against a Light choice and copies them for a Dark choice', async () => {
    const out = await run(':root { --a: 1; }\n@media (prefers-color-scheme: dark) { :root, .x { --a: 2; } }');
    expect(out).toContain(":root:not([data-theme='light']), :root:not([data-theme='light']) .x");
    expect(out).toContain("@media (prefers-color-scheme: dark)");
    // The Dark copy follows the media query's closing brace, so it applies on a light phone too.
    expect(out).toMatch(/}\s*}\s*:root\[data-theme='dark'\], :root\[data-theme='dark'\] \.x \{ --a: 2; \}/);
  });

  it('leaves other media queries alone', async () => {
    const css = '@media (orientation: landscape) { .x { a: b; } }\n@media (prefers-reduced-motion: reduce) { .y { a: b; } }';
    expect(await run(css)).toBe(css);
  });

  it('handles each dark block once, however many there are', async () => {
    const out = await run('@media (prefers-color-scheme: dark) { .a { --c: 1; } }\n@media (prefers-color-scheme: dark) { .b { --c: 2; } }');
    expect(out.match(/data-theme='dark'/g)).toHaveLength(2);
    expect(out.match(/data-theme='light'/g)).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { contrast, themes } from './test/contrast';

// Standards from docs/DESIGN.md, checked in both themes.
const { light, dark } = themes(css, ':root');

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, t) => {
  it.each([
    ['text', 'bg'],
    ['text', 'surface'],
    ['text', 'surface-2'],
    ['muted', 'bg'],
    ['muted', 'surface'],
    ['link', 'bg'],
    ['on-accent', 'accent'],
  ])('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text on surface-2 (segmented control labels) meets 4.5:1', () => {
    expect(contrast(t.muted, t['surface-2'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('flat design', () => {
  const sheets = import.meta.glob<string>('./**/*.css', { query: '?raw', import: 'default', eager: true });

  it('finds the stylesheets to check', () => {
    expect(Object.keys(sheets)).toContain('./style.css');
    expect(Object.keys(sheets).length).toBeGreaterThan(1);
  });

  it.each(Object.entries(sheets))('%s uses no gradients, shadows or filters', (_path, sheet) => {
    const code = sheet.replace(/\/\*[\s\S]*?\*\//g, ''); // ignore comments
    expect(code).not.toMatch(/gradient\s*\(/i);
    expect(code).not.toMatch(/(box|text)-shadow\s*:/i);
    expect(code).not.toMatch(/(^|[\s;{])(backdrop-)?filter\s*:/i);
    expect(code).not.toMatch(/url\s*\(/i); // no image textures
  });
});

describe('tokens', () => {
  it('defines a dark value for every themed color', () => {
    const colorTokens = Object.keys(light).filter((k) => /^#|rgba?\(/.test(light[k]));
    const notThemed = ['accent', 'on-accent', 'tile-ink-dark', 'tile-ink-light'];
    for (const name of colorTokens.filter((n) => !notThemed.includes(n))) {
      expect(css, `--${name} needs a dark value`).toMatch(
        new RegExp(`prefers-color-scheme: dark[\\s\\S]*--${name}:`),
      );
    }
  });

  it('sets a 44px minimum touch target', () => {
    expect(light.tap).toBe('44px');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import css from '../style.css?raw';
import { BAR_COLORS, applyAppearance, getAppearance, setAppearance } from './theme';
import { themes } from '../test/contrast';

function metas() {
  document.head.innerHTML = `<meta name="theme-color" content="x" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="x" media="(prefers-color-scheme: dark)">`;
}
const contents = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);

describe('appearance', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.head.innerHTML = '';
  });

  it('starts on Automatic and ignores anything unexpected that was saved', () => {
    expect(getAppearance()).toBe('auto');
    localStorage.setItem('pg:appearance', JSON.stringify('purple'));
    expect(getAppearance()).toBe('auto');
  });

  it('sets data-theme and the browser bar color for Light and Dark, and clears them for Automatic', () => {
    metas();
    setAppearance('dark');
    expect(localStorage.getItem('pg:appearance')).toBe('"dark"');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(contents()).toEqual([BAR_COLORS.dark, BAR_COLORS.dark]);
    setAppearance('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(contents()).toEqual([BAR_COLORS.light, BAR_COLORS.light]);
    setAppearance('auto');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(contents()).toEqual([BAR_COLORS.light, BAR_COLORS.dark]);
  });

  it('applies the saved choice', () => {
    localStorage.setItem('pg:appearance', JSON.stringify('dark'));
    applyAppearance();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('bar colors match the page background in each theme, here and in index.html', () => {
    const { light, dark } = themes(css, ':root');
    expect(BAR_COLORS).toEqual({ light: light.bg, dark: dark.bg });
    expect(html).toContain(`content="${light.bg}" media="(prefers-color-scheme: light)"`);
    expect(html).toContain(`content="${dark.bg}" media="(prefers-color-scheme: dark)"`);
    // index.html applies a saved choice before drawing, with the same key and colors.
    expect(html).toContain("localStorage.getItem('pg:appearance')");
    expect(html).toContain(`choice === 'dark' ? '${dark.bg}' : '${light.bg}'`);
  });
});

// The player's Appearance choice (home screen Settings): Automatic follows the phone's
// light or dark mode; Light or Dark overrides it. The choice is a data-theme attribute on
// <html>, which the dark style blocks respect (scripts/theme-choice.mjs). index.html applies
// a saved choice before anything draws, so the app never flashes the wrong colors.
import { load, save } from './storage';

export type Appearance = 'auto' | 'light' | 'dark';

/** Saved as pg:appearance (index.html reads the same key). */
const KEY = 'appearance';

/** The browser bar color for each theme: the page background (src/style.css --bg). */
export const BAR_COLORS = { light: '#f3f5f4', dark: '#0e1312' } as const;

export function getAppearance(): Appearance {
  const saved = load<unknown>(KEY, 'auto');
  return saved === 'light' || saved === 'dark' ? saved : 'auto';
}

/** Shows the choice at once and remembers it. */
export function setAppearance(choice: Appearance): void {
  save(KEY, choice);
  applyAppearance(choice);
}

export function applyAppearance(choice: Appearance = getAppearance()): void {
  const root = document.documentElement;
  if (choice === 'auto') delete root.dataset.theme;
  else root.dataset.theme = choice;
  // index.html has one bar color per phone mode; a choice paints both the same.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const phoneMode = meta.getAttribute('media')?.includes('dark') ? 'dark' : 'light';
    meta.content = BAR_COLORS[choice === 'auto' ? phoneMode : choice];
  });
}

// Lets the player's Appearance choice (Settings) override the phone's light or dark mode.
//
// The stylesheets keep writing dark colors the plain way, in
// `@media (prefers-color-scheme: dark) { ... }` blocks. At build time this PostCSS plugin
// (wired up in vite.config.ts) turns each such block into two:
//   - inside the media query, guarded by :root:not([data-theme='light']), so choosing
//     Light wins over a dark phone;
//   - outside it, under :root[data-theme='dark'], so choosing Dark wins over a light phone.
// src/core/theme.ts sets data-theme on <html>; Automatic removes it.

const DARK_QUERY = /^\(\s*prefers-color-scheme:\s*dark\s*\)$/;
export const NOT_LIGHT = ":not([data-theme='light'])";
export const DARK = "[data-theme='dark']";

/** Scopes one selector to a theme condition on the root element. */
export function scope(selector, condition) {
  const sel = selector.trim();
  if (/^(:root|html)(?![\w-])/.test(sel)) return sel.replace(/^(:root|html)/, `$1${condition}`);
  return `:root${condition} ${sel}`;
}

/** PostCSS plugin (no dependencies: PostCSS hands it the nodes). */
export function themeChoice() {
  return {
    postcssPlugin: 'theme-choice',
    AtRule: {
      media(atRule) {
        if (!DARK_QUERY.test(atRule.params.trim()) || atRule.raws.themeChoice) return;
        atRule.raws.themeChoice = true;
        const forced = [];
        atRule.walkRules((rule) => {
          const copy = rule.clone();
          copy.selectors = rule.selectors.map((s) => scope(s, DARK));
          forced.push(copy);
          rule.selectors = rule.selectors.map((s) => scope(s, NOT_LIGHT));
        });
        atRule.after(forced);
      },
    },
  };
}
themeChoice.postcss = true;

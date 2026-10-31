// WCAG contrast helpers and a tiny CSS custom-property reader, for design tests.

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Not a hex color: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads `--name: value;` declarations from the first `selector { ... }` block matched by `blockPattern`. */
export function readVars(css: string, blockPattern: RegExp): Record<string, string> {
  const block = css.match(blockPattern)?.[1];
  if (block === undefined) throw new Error(`Block not found: ${blockPattern}`);
  const vars: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[name] = value.trim();
  return vars;
}

/** Light and dark token sets for a selector whose dark overrides sit in a prefers-color-scheme block. */
export function themes(css: string, selector: string): { light: Record<string, string>; dark: Record<string, string> } {
  const sel = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const light = readVars(css, new RegExp(`(?:^|\\n)${sel}\\s*{([^}]*)}`));
  const dark = readVars(css, new RegExp(`prefers-color-scheme:\\s*dark\\)\\s*{\\s*${sel}\\s*{([^}]*)}`));
  return { light, dark: { ...light, ...dark } };
}

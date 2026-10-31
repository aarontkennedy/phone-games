// Flat board symbols: solid 2D shapes only (docs/DESIGN.md, "Flat design").
// Colors come from the .ms-sym-* rules in style.css, so they follow light and dark mode.

const sym = (label: string, body: string) =>
  `<svg class="ms-sym" viewBox="0 0 24 24" role="img" aria-label="${label}">${body}</svg>`;

/** A red triangle on a pole. */
export const flag = sym(
  'Flag',
  '<rect class="ms-sym-ink" x="5" y="3" width="2.5" height="18" rx="1"/>' +
    '<path class="ms-sym-cloth" d="M8.5 4 L20 9 L8.5 14 Z"/>',
);

/** A disc with four spikes. */
export const mine = sym(
  'Mine',
  '<g class="ms-sym-line"><path d="M12 3 V21 M3 12 H21 M5.6 5.6 L18.4 18.4 M18.4 5.6 L5.6 18.4"/></g>' +
    '<circle class="ms-sym-ink" cx="12" cy="12" r="6"/>',
);

/** An X over a square that was flagged but had no mine. */
export const wrongFlag = sym('Wrong flag', '<path class="ms-sym-line" d="M6 6 L18 18 M18 6 L6 18"/>');

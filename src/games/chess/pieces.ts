// Flat chess pieces: simple silhouettes of our own design (docs/LEGAL.md, "Assets"), drawn
// on a 45 by 45 grid. Colours come from CSS (.cs-piece.w and .cs-piece.b in style.css).

const BASE = '<rect x="10" y="35" width="25" height="5" rx="1.5"/>';

const SHAPES: Record<string, string> = {
  p: '<circle cx="22.5" cy="13" r="5.5"/><path d="M17 33c0-6 1.5-10 5.5-13 4 3 5.5 7 5.5 13Z"/>' + BASE,
  r: '<path d="M11 8h5v4h4V8h5v4h4V8h5v9H11Z"/><rect x="14" y="17" width="17" height="16"/>' + BASE,
  n: '<path d="M14 33c1-5 4-8 7-10-3 0-6 1-8 3l-2-4c2-6 6-11 12-13l2-4 2 4c6 3 8 11 8 24Z"/><circle cx="20" cy="14" r="1.6" class="cs-eye"/>' + BASE,
  b: '<circle cx="22.5" cy="6.5" r="2.5"/><path d="M22.5 9c5 4 8 9 8 14 0 4-2 6-4 8h-8c-2-2-4-4-4-8 0-5 3-10 8-14Z"/><rect x="15" y="31" width="15" height="4"/>' + BASE,
  q: '<path d="M12 33 9 13l7 8 2.5-12 4 11 4-11L29 21l7-8-3 20Z"/><circle cx="9" cy="11" r="2.2"/><circle cx="18.5" cy="7.5" r="2.2"/><circle cx="26.5" cy="7.5" r="2.2"/><circle cx="36" cy="11" r="2.2"/>' + BASE,
  k: '<rect x="21" y="4" width="3" height="11"/><rect x="17.5" y="7" width="10" height="3"/><path d="M13 33c-4-6-4-14 2-15 3-.5 5.5 1.5 7.5 4.5 2-3 4.5-5 7.5-4.5 6 1 6 9 2 15Z"/>' + BASE,
};

/** A piece drawn from its letter: capitals are white. */
export function pieceSvg(p: string): string {
  const side = p === p.toUpperCase() ? 'w' : 'b';
  return `<svg class="cs-piece ${side}" viewBox="0 0 45 45" aria-hidden="true">${SHAPES[p.toLowerCase()]}</svg>`;
}

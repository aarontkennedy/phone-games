// Flat game icons for the home screen: solid fills and simple 2D shapes only.
// No gradients, shadows, filters or images (docs/DESIGN.md, "Flat design").

const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">${body}</svg>`;

const round = (n: number) => Math.round(n * 10) / 10;

/** Four tiles in a 2x2 grid, in the 2048 tile palette. */
export const tilesIcon = svg(
  [
    ['4', '4', '#ffd08a'],
    ['26', '4', '#ef5f58'],
    ['4', '26', '#4fbcac'],
    ['26', '26', '#6c63ff'],
  ]
    .map(([x, y, fill]) => `<rect x="${x}" y="${y}" width="18" height="18" rx="4" fill="${fill}"/>`)
    .join(''),
);

/** A mine: a solid disc with eight spikes. */
export const mineIcon = svg(
  `<g stroke="#ef5f58" stroke-width="4" stroke-linecap="round">${[0, 45, 90, 135]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const dx = round(Math.cos(rad) * 19);
      const dy = round(Math.sin(rad) * 19);
      return `<line x1="${round(24 - dx)}" y1="${round(24 - dy)}" x2="${round(24 + dx)}" y2="${round(24 + dy)}"/>`;
    })
    .join('')}</g><circle cx="24" cy="24" r="12" fill="#ef5f58"/>`,
);

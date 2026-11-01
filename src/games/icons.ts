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

/** Two overlapping cards; the front one shows a red heart. */
export const cardsIcon = svg(
  '<rect x="6" y="6" width="22" height="31" rx="3" fill="#6c63ff" transform="rotate(-12 17 21)"/>' +
    '<rect x="18" y="10" width="23" height="32" rx="3" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<path d="M29.5 34C25 30.2 22 27.6 22 24.4a3.75 3.75 0 0 1 7.5-1.5 3.75 3.75 0 0 1 7.5 1.5c0 3.2-3 5.8-7.5 9.6Z" fill="#ef5f58"/>',
);

/** A betting chip: a red disc with a white ring and four edge marks. */
export const chipIcon = svg(
  '<circle cx="24" cy="24" r="20" fill="#ef5f58"/>' +
    [0, 90, 180, 270]
      .map((deg) => `<rect x="21" y="4" width="6" height="7" fill="#ffffff" transform="rotate(${deg} 24 24)"/>`)
      .join('') +
    '<circle cx="24" cy="24" r="11" fill="none" stroke="#ffffff" stroke-width="3"/>',
);

/** A large red heart. */
export const heartIcon = svg(
  '<path d="M24 42C12 32.5 4 25.5 4 16.5A10 10 0 0 1 24 12a10 10 0 0 1 20 4.5C44 25.5 36 32.5 24 42Z" fill="#ef5f58"/>',
);

/** A large spade, in purple so it shows in light and dark mode. */
export const spadeIcon = svg(
  '<path d="M24 4C34 14 43 21 43 29a8.5 8.5 0 0 1-15.5 4.8L30 44H18l2.5-10.2A8.5 8.5 0 0 1 5 29C5 21 14 14 24 4Z" fill="#6c63ff"/>',
);

/** Two cards side by side: a red diamond and a purple club, for a partners' game. */
export const pairIcon = svg(
  '<rect x="3" y="8" width="20" height="30" rx="3" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<path d="M13 15 19 23 13 31 7 23Z" fill="#ef5f58"/>' +
    '<rect x="25" y="8" width="20" height="30" rx="3" fill="#6c63ff"/>' +
    '<circle cx="35" cy="18.5" r="3.6" fill="#ffffff"/><circle cx="31" cy="24" r="3.6" fill="#ffffff"/>' +
    '<circle cx="39" cy="24" r="3.6" fill="#ffffff"/><path d="M33.6 24 32.5 31h5l-1.1-7Z" fill="#ffffff"/>',
);

/** A cribbage board: two rows of holes, with a purple and an orange peg. */
export const pegboardIcon = svg(
  '<rect x="3" y="12" width="42" height="24" rx="5" fill="#c9a26b"/>' +
    [9, 16, 23, 30, 37]
      .map((x) => `<circle cx="${x}" cy="19" r="2" fill="#6b4a1f"/><circle cx="${x}" cy="29" r="2" fill="#6b4a1f"/>`)
      .join('') +
    '<circle cx="30" cy="19" r="3.4" fill="#6c63ff"/><circle cx="16" cy="29" r="3.4" fill="#ef5f58"/>',
);

/** A tic-tac-toe grid with an X and an O. */
export const gridIcon = svg(
  '<g stroke="#6c63ff" stroke-width="3" stroke-linecap="round"><path d="M18 6v36M30 6v36M6 18h36M6 30h36"/></g>' +
    '<path d="M8 8l6 6M14 8l-6 6" stroke="#ef5f58" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="36" cy="36" r="4" fill="none" stroke="#ef5f58" stroke-width="3"/>',
);

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

/** A four-in-a-row board: a purple line of four among orange discs. */
export const discsIcon = svg(
  '<rect x="3" y="7" width="42" height="34" rx="5" fill="#6c63ff"/>' +
    [0, 1, 2, 3]
      .flatMap((r) => [0, 1, 2, 3].map((c) => ({ r, c })))
      .map(({ r, c }) => `<circle cx="${10.5 + c * 9}" cy="${13 + r * 7.5}" r="3" fill="${r === 3 - c ? '#ef5f58' : '#ffffff'}"/>`)
      .join(''),
);

/** Part of a checkerboard with a purple and an orange piece. */
export const checkersIcon = svg(
  '<rect x="4" y="4" width="40" height="40" rx="4" fill="#f4f1fb" stroke="#4a4560" stroke-width="2"/>' +
    '<rect x="24" y="4" width="20" height="20" fill="#4a4560"/><rect x="4" y="24" width="20" height="20" fill="#4a4560"/>' +
    '<circle cx="34" cy="14" r="7" fill="#9d94ff"/><circle cx="14" cy="34" r="7" fill="#ffb347"/>',
);

/** A 3x3 block of a number grid, three squares filled in purple. */
export const numberGridIcon = svg(
  '<rect x="5" y="5" width="38" height="38" rx="4" fill="#ffffff" stroke="#6c63ff" stroke-width="3"/>' +
    '<path d="M17.7 5v38M30.3 5v38M5 17.7h38M5 30.3h38" stroke="#6c63ff" stroke-width="1.5"/>' +
    '<rect x="8" y="8" width="7" height="7" rx="1.5" fill="#6c63ff"/><rect x="20.5" y="20.5" width="7" height="7" rx="1.5" fill="#ef5f58"/>' +
    '<rect x="33" y="33" width="7" height="7" rx="1.5" fill="#6c63ff"/>',
);

/** Four free cells above a column of cards. */
export const freeCellsIcon = svg(
  [4, 15, 26, 37].map((x) => `<rect x="${x}" y="5" width="8" height="11" rx="1.5" fill="none" stroke="#6c63ff" stroke-width="2"/>`).join('') +
    '<rect x="14" y="21" width="20" height="16" rx="2.5" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<rect x="14" y="27" width="20" height="16" rx="2.5" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<path d="M24 31 28 35 24 39 20 35Z" fill="#ef5f58"/>',
);

/** A card showing an 8, drawn as two stacked rings. */
export const eightIcon = svg(
  '<rect x="10" y="4" width="28" height="40" rx="4" fill="#ffffff" stroke="#6c63ff" stroke-width="2.5"/>' +
    '<circle cx="24" cy="17.5" r="5.5" fill="none" stroke="#ef5f58" stroke-width="3.5"/>' +
    '<circle cx="24" cy="30" r="7" fill="none" stroke="#ef5f58" stroke-width="3.5"/>',
);

/** A flat fish beside a card. */
export const fishIcon = svg(
  '<rect x="6" y="6" width="22" height="32" rx="4" fill="#ffffff" stroke="#6c63ff" stroke-width="2.5"/>' +
    '<path d="M20 30c4-6 10-8 16-6l6-5v16l-6-5c-6 2-12 0-16-6Z" fill="#ef5f58"/>' +
    '<circle cx="34" cy="28" r="1.8" fill="#ffffff"/>',
);

/** A flat run of three cards laid down in a row. */
export const runIcon = svg(
  '<rect x="3" y="10" width="18" height="26" rx="3" fill="#ffffff" stroke="#6c63ff" stroke-width="2.5"/>' +
    '<rect x="15" y="12" width="18" height="26" rx="3" fill="#ffffff" stroke="#6c63ff" stroke-width="2.5"/>' +
    '<rect x="27" y="14" width="18" height="26" rx="3" fill="#6c63ff"/>' +
    '<circle cx="36" cy="27" r="4" fill="#ef5f58"/>',
);

/** A flat chess knight on a board square. */
export const knightIcon = svg(
  '<rect x="4" y="4" width="40" height="40" rx="4" fill="#6f66a8"/>' +
    '<path d="M15 36c1-5 4-8 7-10-3 0-6 1-8 3l-2-4c2-6 6-11 12-13l2-4 2 4c6 3 8 11 8 24Z" fill="#ffffff" stroke="#1f1b2e" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<rect x="11" y="36" width="25" height="5" rx="1.5" fill="#ffffff" stroke="#1f1b2e" stroke-width="1.6"/>',
);

/** Five flat cards in a row, the middle one held (raised). */
export const videoPokerIcon = svg(
  '<rect x="2" y="16" width="10" height="16" rx="2" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<rect x="11" y="16" width="10" height="16" rx="2" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<rect x="19" y="9" width="10" height="16" rx="2" fill="#ef5f58"/>' +
    '<rect x="27" y="16" width="10" height="16" rx="2" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<rect x="36" y="16" width="10" height="16" rx="2" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<rect x="8" y="36" width="32" height="4" rx="2" fill="#6c63ff"/>',
);

/** Two flat cards over a stack of chips. */
export const holdemIcon = svg(
  '<rect x="8" y="6" width="16" height="24" rx="2.5" fill="#ffffff" stroke="#6c63ff" stroke-width="2.5"/>' +
    '<rect x="20" y="9" width="16" height="24" rx="2.5" fill="#ef5f58"/>' +
    '<ellipse cx="24" cy="38" rx="14" ry="4" fill="#6c63ff"/>' +
    '<rect x="10" y="33" width="28" height="5" fill="#6c63ff"/>',
);

/** Two flat dice. */
export const diceIcon = svg(
  '<rect x="4" y="12" width="22" height="22" rx="4" fill="#6c63ff"/>' +
    '<circle cx="10" cy="18" r="2.2" fill="#ffffff"/><circle cx="15" cy="23" r="2.2" fill="#ffffff"/><circle cx="20" cy="28" r="2.2" fill="#ffffff"/>' +
    '<rect x="22" y="20" width="22" height="22" rx="4" fill="#ef5f58"/>' +
    '<circle cx="28" cy="26" r="2.2" fill="#ffffff"/><circle cx="38" cy="26" r="2.2" fill="#ffffff"/><circle cx="28" cy="36" r="2.2" fill="#ffffff"/><circle cx="38" cy="36" r="2.2" fill="#ffffff"/>',
);

/** Three cards fanned out, the front one with a purple run marker. */
export const fanIcon = svg(
  '<rect x="6" y="10" width="20" height="28" rx="3" fill="#ffffff" stroke="#6c63ff" stroke-width="2" transform="rotate(-14 16 24)"/>' +
    '<rect x="14" y="8" width="20" height="28" rx="3" fill="#ffffff" stroke="#6c63ff" stroke-width="2"/>' +
    '<rect x="22" y="10" width="20" height="28" rx="3" fill="#6c63ff" transform="rotate(14 32 24)"/>' +
    '<path d="M18 16h12M18 22h12M18 28h8" stroke="#ef5f58" stroke-width="3" stroke-linecap="round"/>',
);

/** A domino tile: a 6 and a 3. */
export const dominoIcon = svg(
  '<rect x="4" y="13" width="40" height="22" rx="4" fill="#ffffff" stroke="#6c63ff" stroke-width="2.5"/>' +
    '<path d="M24 16v16" stroke="#6c63ff" stroke-width="2"/>' +
    [[10, 19], [18, 19], [10, 24], [18, 24], [10, 29], [18, 29], [29, 19], [34, 24], [39, 29]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#ef5f58"/>`)
      .join(''),
);

/** Three dice in a row, the middle one held up with an outline. */
export const yachtIcon = svg(
  '<rect x="3" y="20" width="13" height="13" rx="3" fill="#6c63ff"/><circle cx="9.5" cy="26.5" r="1.8" fill="#ffffff"/>' +
    '<rect x="17.5" y="12" width="13" height="13" rx="3" fill="#ef5f58"/>' +
    '<circle cx="21" cy="15.5" r="1.8" fill="#ffffff"/><circle cx="24" cy="18.5" r="1.8" fill="#ffffff"/><circle cx="27" cy="21.5" r="1.8" fill="#ffffff"/>' +
    '<rect x="32" y="20" width="13" height="13" rx="3" fill="#6c63ff"/><circle cx="35.5" cy="23.5" r="1.8" fill="#ffffff"/><circle cx="41.5" cy="29.5" r="1.8" fill="#ffffff"/>' +
    '<path d="M8 40h32" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>',
);

/** A 2x2 block of a reversi board: two purple and two orange discs. */
export const reversiIcon = svg(
  '<rect x="4" y="4" width="40" height="40" rx="4" fill="#4a4560"/>' +
    '<path d="M24 4v40M4 24h40" stroke="#2b283a" stroke-width="2"/>' +
    '<circle cx="14" cy="14" r="7" fill="#9d94ff"/><circle cx="34" cy="34" r="7" fill="#9d94ff"/>' +
    '<circle cx="34" cy="14" r="7" fill="#ffb347"/><circle cx="14" cy="34" r="7" fill="#ffb347"/>',
);

/** A mancala board: two rows of pits between two long stores, a few seeds showing. */
export const mancalaIcon = svg(
  '<rect x="2" y="12" width="44" height="24" rx="12" fill="#6c63ff"/>' +
    '<rect x="5" y="16" width="6" height="16" rx="3" fill="#ffffff"/><rect x="37" y="16" width="6" height="16" rx="3" fill="#ffffff"/>' +
    [14, 20.5, 27, 33.5]
      .flatMap((x) => [`<circle cx="${x}" cy="19.5" r="2.6" fill="#ffffff"/>`, `<circle cx="${x}" cy="28.5" r="2.6" fill="#ffffff"/>`])
      .join('') +
    '<circle cx="20.5" cy="28.5" r="1.2" fill="#ef5f58"/><circle cx="33.5" cy="19.5" r="1.2" fill="#ef5f58"/>',
);

/** A gallows with a figure, and two letter blanks below. */
export const hangmanIcon = svg(
  '<path d="M6 38H24M11 38V6H30V11" fill="none" stroke="#6c63ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="30" cy="15" r="4" fill="none" stroke="#ef5f58" stroke-width="2.5"/>' +
    '<path d="M30 19V29M30 22L25 26M30 22L35 26M30 29L26 35M30 29L34 35" fill="none" stroke="#ef5f58" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M30 43H36M39 43H45" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>',
);

/** Three overlapping columns of cards, like a spider solitaire table. */
export const spiderIcon = svg(
  [6, 18, 30]
    .map((x, i) => [0, 1, 2].map((r) => `<rect x="${x}" y="${6 + r * 7 + i * 3}" width="12" height="17" rx="2" fill="${r === 2 ? '#6c63ff' : '#ffffff'}" stroke="#6c63ff" stroke-width="1.5"/>`).join(''))
    .join('') + '<path d="M9 40h30" stroke="#ef5f58" stroke-width="3" stroke-linecap="round"/>',
);

/** A strip of backgammon points with a purple and an orange checker. */
export const backgammonIcon = svg(
  '<rect x="3" y="6" width="42" height="36" rx="4" fill="#2b283a"/>' +
    [0, 1, 2, 3, 4, 5].map((i) => `<path d="M${5 + i * 6.5} 8l3.25 14 3.25-14z" fill="${i % 2 ? '#6e6690' : '#ffffff'}"/><path d="M${5 + i * 6.5} 40l3.25-14 3.25 14z" fill="${i % 2 ? '#ffffff' : '#6e6690'}"/>`).join('') +
    '<circle cx="14.5" cy="35" r="4" fill="#9d94ff"/><circle cx="33.5" cy="13" r="4" fill="#ffb347"/>',
);

/** A 3 by 3 grid of dots with a few lines drawn and one purple box claimed. */
export const dotsIcon = svg(
  '<rect x="9" y="9" width="15" height="15" rx="2" fill="#6c63ff"/>' +
    '<path d="M8 8H40M8 8V40M24 8V24M8 24H24M24 24H40" stroke="#1d1a2b" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M24 40H40" stroke="#ef5f58" stroke-width="3" stroke-linecap="round"/>' +
    [8, 24, 40].flatMap((x) => [8, 24, 40].map((y) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#1d1a2b"/>`)).join(''),
);

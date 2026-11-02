// Basic strategy: the best play for every hand against every dealer card, for these rules
// (dealer stands on soft 17, checks for blackjack, double on any two cards and after a
// split, one split, no surrender). Worked out by exact calculation for each number of
// decks; 6 and 8 decks play the same. Shared by the hint, the accuracy score and the
// chart in the rules. No DOM, no game state, so the rules page can load it on its own.

/** H hit, S stand, Dh double (or hit if you can't), Ds double (or stand), P split. */
export type Play = 'H' | 'S' | 'Dh' | 'Ds' | 'P';
/** In a pair row, '-' means don't split: play the hand by its total. */
export type Cell = Play | '-';

export const DECK_CHOICES = [1, 2, 6, 8] as const;

/** Dealer's up card, in chart column order: 2 to 10, then ace (11). */
export const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** The chart for 4 or more decks. Hard 7 or less always hits; hard 17 or more stands. */
const SHOE = `
hard 8  H  H  H  H  H  H  H  H  H  H
hard 9  H  Dh Dh Dh Dh H  H  H  H  H
hard 10 Dh Dh Dh Dh Dh Dh Dh Dh H  H
hard 11 Dh Dh Dh Dh Dh Dh Dh Dh Dh H
hard 12 H  H  S  S  S  H  H  H  H  H
hard 13 S  S  S  S  S  H  H  H  H  H
hard 14 S  S  S  S  S  H  H  H  H  H
hard 15 S  S  S  S  S  H  H  H  H  H
hard 16 S  S  S  S  S  H  H  H  H  H
soft 13 H  H  H  Dh Dh H  H  H  H  H
soft 14 H  H  H  Dh Dh H  H  H  H  H
soft 15 H  H  Dh Dh Dh H  H  H  H  H
soft 16 H  H  Dh Dh Dh H  H  H  H  H
soft 17 H  Dh Dh Dh Dh H  H  H  H  H
soft 18 S  Ds Ds Ds Ds S  S  H  H  H
soft 19 S  S  S  S  S  S  S  S  S  S
pair 2  P  P  P  P  P  P  -  -  -  -
pair 3  P  P  P  P  P  P  -  -  -  -
pair 4  -  -  -  P  P  -  -  -  -  -
pair 5  -  -  -  -  -  -  -  -  -  -
pair 6  P  P  P  P  P  -  -  -  -  -
pair 7  P  P  P  P  P  P  -  -  -  -
pair 8  P  P  P  P  P  P  P  P  P  P
pair 9  P  P  P  P  P  -  P  P  -  -
pair 10 -  -  -  -  -  -  -  -  -  -
pair 11 P  P  P  P  P  P  P  P  P  P`;

/** Where fewer decks change the chart: [row, dealer card, play]. */
export const FEWER_DECKS: Record<1 | 2, [string, number, Cell][]> = {
  2: [
    ['hard 9', 2, 'Dh'],
    ['pair 6', 7, 'P'],
    ['pair 7', 8, 'P'],
  ],
  1: [
    ['hard 8', 5, 'Dh'],
    ['hard 8', 6, 'Dh'],
    ['hard 9', 2, 'Dh'],
    ['hard 11', 11, 'Dh'],
    ['soft 13', 4, 'Dh'],
    ['soft 14', 4, 'Dh'],
    ['soft 17', 2, 'Dh'],
    ['soft 18', 11, 'S'],
    ['soft 19', 6, 'Ds'],
    ['pair 3', 8, 'P'],
    ['pair 4', 4, 'P'],
    ['pair 6', 7, 'P'],
    ['pair 7', 8, 'P'],
  ],
};

export type Chart = Map<string, Cell[]>;

function parse(text: string): Chart {
  const chart: Chart = new Map();
  for (const line of text.trim().split('\n')) {
    const [kind, n, ...cells] = line.trim().split(/\s+/);
    chart.set(`${kind} ${n}`, cells as Cell[]);
  }
  return chart;
}

const charts = new Map<number, Chart>();

/** The chart for a number of decks. */
export function chartFor(decks: number): Chart {
  const key = decks >= 4 ? 4 : decks;
  if (!charts.has(key)) {
    const chart = parse(SHOE);
    for (const [row, up, cell] of FEWER_DECKS[key as 1 | 2] ?? []) chart.get(row)![UPCARDS.indexOf(up)] = cell;
    charts.set(key, chart);
  }
  return charts.get(key)!;
}

/**
 * The best play for a hand. `total` and `soft` describe the hand; `pair` is the pair's
 * card value (2 to 11) when splitting is allowed. `up` is the dealer's card (11 for an ace).
 */
export function bestPlay(decks: number, total: number, soft: boolean, up: number, pair?: number): Play {
  const chart = chartFor(decks);
  const col = UPCARDS.indexOf(up);
  if (pair) {
    const cell = chart.get(`pair ${pair}`)![col];
    if (cell === 'P') return 'P';
  }
  if (soft) {
    if (total >= 20) return 'S';
    if (total <= 12) return 'H'; // two aces you can't split
    return chart.get(`soft ${total}`)![col] as Play;
  }
  if (total >= 17) return 'S';
  if (total <= 7) return 'H';
  return chart.get(`hard ${total}`)![col] as Play;
}

// --- The chart in the rules ---

const UP_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

const ROWS: [string, string][] = [
  ['Hard', ''],
  ['hard 7', '5–7'],
  ...[8, 9, 10, 11, 12, 13, 14, 15, 16].map((n): [string, string] => [`hard ${n}`, String(n)]),
  ['hard 17', '17+'],
  ['Soft', ''],
  ...[2, 3, 4, 5, 6, 7, 8, 9].map((n): [string, string] => [`soft ${11 + n}`, `A,${n}`]),
  ['Pairs', ''],
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n): [string, string] => [`pair ${n}`, `${n},${n}`]),
  ['pair 11', 'A,A'],
];

function rowCells(chart: Chart, row: string): Cell[] {
  if (row === 'hard 7') return UPCARDS.map(() => 'H');
  if (row === 'hard 17' || row === 'soft 20') return UPCARDS.map(() => 'S');
  return chart.get(row)!;
}

const PLAY_TEXT: Record<Cell, string> = { H: 'Hit', S: 'Stand', Dh: 'Double', Ds: 'Double', P: 'Split', '-': '' };
const SHORT: Record<Cell, string> = { H: 'H', S: 'S', Dh: 'D', Ds: 'Ds', P: 'P', '-': '' };
const upName = (up: number) => (up === 11 ? 'an ace' : up === 8 ? 'an 8' : `a ${up}`);
const rowName = (row: string) => {
  const [kind, n] = row.split(' ');
  if (kind === 'pair') return Number(n) === 11 ? 'aces' : `${n}s`;
  return kind === 'soft' ? `A,${Number(n) - 11}` : `hard ${n}`;
};

/** "With 2 decks: double hard 9 against a 2; split 6s against a 7; ..." */
export function changesText(decks: 1 | 2): string {
  const groups = new Map<string, number[]>();
  for (const [row, up, cell] of FEWER_DECKS[decks]) {
    const key = `${PLAY_TEXT[cell].toLowerCase()} ${row.startsWith('pair') ? '' : 'on '}${rowName(row)}`.replace('double on', 'double');
    groups.set(key, [...(groups.get(key) ?? []), up]);
  }
  const parts = [...groups].map(([what, ups]) => `${what} against ${ups.map(upName).join(' or ').replace(/ or a /g, ' or ')}`);
  return `With ${decks === 1 ? '1 deck' : '2 decks'}: ${parts.join('; ')}.`;
}

/** The chart as an HTML table, for the rules page, with a key and the changes for fewer decks. */
export function chartHtml(): string {
  const chart = chartFor(6);
  const head = `<tr><td></td>${UP_NAMES.map((u) => `<th scope="col">${u}</th>`).join('')}</tr>`;
  const body = ROWS.map(([row, label]) =>
    label
      ? `<tr><th scope="row">${label}</th>${rowCells(chart, row)
          .map((c) => `<td${c === 'P' || c.startsWith('D') ? ' class="bs-strong"' : ''} aria-label="${PLAY_TEXT[c] || 'Play the total'}">${SHORT[c]}</td>`)
          .join('')}</tr>`
      : `<tr><th scope="rowgroup" colspan="11" class="bs-group">${row}</th></tr>`,
  ).join('');
  return `
    <h3>Best plays</h3>
    <p>Across the top is the dealer’s face-up card. Find your hand down the side.
      <b>H</b> hit, <b>S</b> stand, <b>D</b> double (or hit if you can’t), <b>Ds</b> double (or stand if you can’t),
      <b>P</b> split. A blank pair square means don’t split: play the total instead.</p>
    <table class="bs-chart"><thead>${head}</thead><tbody>${body}</tbody></table>
    <p>This chart is for 6 or 8 decks. ${changesText(2)} ${changesText(1)}</p>`;
}

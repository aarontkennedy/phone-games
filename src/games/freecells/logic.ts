// Free cells solitaire: all 52 cards face up in 8 columns, 4 free cells that hold one card
// each, and 4 foundations built ace to king by suit. Columns build down in alternating
// colors; any card can start an empty column. Groups of cards move as one if there are
// enough free cells and empty columns to do it a card at a time.
// Pure functions: every move returns a new State, or null if it isn't allowed.
import { SUITS, isCard, isFullDeck, isRed, shuffledDeck, type Card } from '../../core/cards';
import type { Rng } from '../../core/random';

export interface State {
  cells: (Card | null)[];
  /** One pile per suit, in SUITS order. */
  foundations: Card[][];
  /** The last card of each column is on top. */
  columns: Card[][];
  moves: number;
  elapsed: number;
  won: boolean;
}

export type Source = { from: 'cell'; i: number } | { from: 'col'; col: number; index: number };
export type Target = { to: 'foundation' } | { to: 'cell' } | { to: 'col'; col: number };

const clone = (s: State): State => JSON.parse(JSON.stringify(s));

export function newGame(rng: Rng = Math.random): State {
  const deck = shuffledDeck(rng);
  const columns: Card[][] = Array.from({ length: 8 }, () => []);
  deck.forEach((c, i) => columns[i % 8].push(c));
  return { cells: [null, null, null, null], foundations: SUITS.map(() => []), columns, moves: 0, elapsed: 0, won: false };
}

const foundationOf = (s: State, c: Card) => s.foundations[SUITS.indexOf(c.suit)];
export const canFound = (s: State, c: Card): boolean => c.rank === foundationOf(s, c).length + 1;
const stacks = (card: Card, on: Card | undefined) =>
  !on || (isRed(card) !== isRed(on) && card.rank === on.rank - 1);

/** Whether `cards` run down in alternating colors. */
export const isRun = (cards: Card[]): boolean => cards.every((c, i) => i === 0 || stacks(c, cards[i - 1]));

/** The most cards that can move at once, given free cells and empty columns. */
export function maxMove(s: State, toEmptyColumn: boolean): number {
  const freeCells = s.cells.filter((c) => !c).length;
  const emptyCols = s.columns.filter((c) => !c.length).length - (toEmptyColumn ? 1 : 0);
  return (freeCells + 1) * 2 ** Math.max(0, emptyCols);
}

export function cardsAt(s: State, src: Source): Card[] {
  if (src.from === 'cell') return s.cells[src.i] ? [s.cells[src.i]!] : [];
  const col = s.columns[src.col] ?? [];
  if (src.index < 0 || src.index >= col.length) return [];
  const run = col.slice(src.index);
  return isRun(run) ? run : [];
}

export function isLegal(s: State, src: Source, tgt: Target): boolean {
  const cards = cardsAt(s, src);
  if (!cards.length) return false;
  if (tgt.to === 'foundation') return cards.length === 1 && canFound(s, cards[0]);
  if (tgt.to === 'cell') return cards.length === 1 && src.from === 'col' && s.cells.some((c) => !c);
  if (src.from === 'col' && src.col === tgt.col) return false;
  const dest = s.columns[tgt.col];
  if (!dest) return false;
  return stacks(cards[0], dest.at(-1)) && cards.length <= maxMove(s, !dest.length);
}

/** Puts cards up when nobody could need them: aces, twos, and cards whose lower opposite-color cards are already up. */
function autoPlay(n: State): State {
  const safe = (c: Card) => {
    if (!canFound(n, c)) return false;
    if (c.rank <= 2) return true;
    return SUITS.filter((x) => isRed({ suit: x, rank: 1 }) !== isRed(c)).every((x) => n.foundations[SUITS.indexOf(x)].length >= c.rank - 1);
  };
  for (let moved = true; moved; ) {
    moved = false;
    for (let i = 0; i < 4; i++) {
      const c = n.cells[i];
      if (c && safe(c)) {
        foundationOf(n, c).push(c);
        n.cells[i] = null;
        moved = true;
      }
    }
    for (const col of n.columns) {
      const c = col.at(-1);
      if (c && safe(c)) {
        foundationOf(n, col.pop()!).push(c);
        moved = true;
      }
    }
  }
  return n;
}

export function move(s: State, src: Source, tgt: Target): State | null {
  if (s.won || !isLegal(s, src, tgt)) return null;
  const n = clone(s);
  const cards = src.from === 'cell' ? [n.cells[src.i]!] : n.columns[src.col].splice(src.index);
  if (src.from === 'cell') n.cells[src.i] = null;
  if (tgt.to === 'foundation') foundationOf(n, cards[0]).push(cards[0]);
  else if (tgt.to === 'cell') n.cells[n.cells.indexOf(null)] = cards[0];
  else n.columns[tgt.col].push(...cards);
  n.moves++;
  autoPlay(n);
  n.won = n.foundations.every((f) => f.length === 13);
  return n;
}

/**
 * Where a tapped card should go: its foundation, then a column with cards, then an empty
 * column, then a free cell. Never a pointless move, like a whole column to an empty one.
 */
export function bestTarget(s: State, src: Source): Target | null {
  if (isLegal(s, src, { to: 'foundation' })) return { to: 'foundation' };
  const wholeColumn = src.from === 'col' && src.index === 0;
  let empty: Target | null = null;
  for (let col = 0; col < 8; col++) {
    const tgt: Target = { to: 'col', col };
    if (!isLegal(s, src, tgt)) continue;
    if (s.columns[col].length) return tgt;
    if (!wholeColumn) empty ??= tgt;
  }
  if (empty) return empty;
  return isLegal(s, src, { to: 'cell' }) ? { to: 'cell' } : null;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  return (
    !!st &&
    Array.isArray(st.cells) &&
    st.cells.length === 4 &&
    st.cells.every((c) => c === null || isCard(c)) &&
    Array.isArray(st.foundations) &&
    st.foundations.length === 4 &&
    st.foundations.every((f, i) => Array.isArray(f) && f.every((c, r) => isCard(c) && c.suit === SUITS[i] && c.rank === r + 1)) &&
    Array.isArray(st.columns) &&
    st.columns.length === 8 &&
    st.columns.every((c) => Array.isArray(c)) &&
    typeof st.moves === 'number' &&
    typeof st.elapsed === 'number' &&
    typeof st.won === 'boolean' &&
    isFullDeck([...st.cells.filter(Boolean), ...st.foundations.flat(), ...st.columns.flat()])
  );
}

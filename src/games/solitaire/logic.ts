// Klondike solitaire rules. Pure functions: every move returns a new State (or null if
// it isn't allowed), so the screen can keep old states for Undo.
import { SUITS, isCard, isFullDeck, isRed, shuffledDeck, type Card } from '../../core/cards';
import type { Rng } from '../../core/random';

export type DrawCount = 1 | 3;

export interface Column {
  /** Face-down cards. */
  down: Card[];
  /** Face-up cards, highest first. The last one is on top. */
  up: Card[];
}

export interface State {
  draw: DrawCount;
  /** Face down. The last card is the top. */
  stock: Card[];
  /** Face up. The last card is the top, and the only one you can play. */
  waste: Card[];
  /** One pile per suit, in SUITS order, built ace to king. */
  foundations: Card[][];
  tableau: Column[];
  moves: number;
  /** Milliseconds of play. */
  elapsed: number;
  won: boolean;
}

/** Where the cards being moved come from. `index` is the first card moved, within `up`. */
export type Source =
  | { from: 'waste' }
  | { from: 'tableau'; col: number; index: number }
  | { from: 'foundation'; suit: number };

export type Target = { to: 'foundation' } | { to: 'tableau'; col: number };

const COLUMNS = 7;
const clone = (s: State): State => JSON.parse(JSON.stringify(s));

export function newState(draw: DrawCount = 1, rng: Rng = Math.random): State {
  const deck = shuffledDeck(rng);
  const tableau = Array.from({ length: COLUMNS }, (_, c) => {
    const cards = deck.splice(0, c + 1);
    return { down: cards.slice(0, -1), up: cards.slice(-1) };
  });
  return { draw, stock: deck, waste: [], foundations: SUITS.map(() => []), tableau, moves: 0, elapsed: 0, won: false };
}

/** Turns over the next card (or three) from the stock, or turns the waste back over when the stock is empty. */
export function draw(s: State): State | null {
  if (!s.stock.length && !s.waste.length) return null;
  const n = clone(s);
  if (!n.stock.length) {
    n.stock = n.waste.reverse();
    n.waste = [];
  } else {
    for (let i = 0; i < n.draw && n.stock.length; i++) n.waste.push(n.stock.pop()!);
  }
  n.moves++;
  return n;
}

/** The cards a move from `src` would pick up, or [] if there are none. */
export function cardsAt(s: State, src: Source): Card[] {
  if (src.from === 'waste') return s.waste.slice(-1);
  if (src.from === 'foundation') return s.foundations[src.suit]?.slice(-1) ?? [];
  const up = s.tableau[src.col]?.up ?? [];
  return src.index >= 0 && src.index < up.length ? up.slice(src.index) : [];
}

const foundationFor = (s: State, card: Card) => s.foundations[SUITS.indexOf(card.suit)];

export function canFound(s: State, card: Card): boolean {
  return card.rank === foundationFor(s, card).length + 1;
}

/** A king goes on an empty column; anything else on the next rank up in the other color. */
export function canStack(card: Card, col: Column): boolean {
  const top = col.up.at(-1);
  if (!top) return !col.down.length && card.rank === 13;
  return isRed(card) !== isRed(top) && card.rank === top.rank - 1;
}

export function isLegal(s: State, src: Source, tgt: Target): boolean {
  const cards = cardsAt(s, src);
  if (!cards.length) return false;
  if (tgt.to === 'foundation') return cards.length === 1 && src.from !== 'foundation' && canFound(s, cards[0]);
  if (src.from === 'tableau' && src.col === tgt.col) return false;
  const col = s.tableau[tgt.col];
  return !!col && canStack(cards[0], col);
}

export function move(s: State, src: Source, tgt: Target): State | null {
  if (!isLegal(s, src, tgt)) return null;
  const n = clone(s);
  let cards: Card[];
  if (src.from === 'waste') cards = [n.waste.pop()!];
  else if (src.from === 'foundation') cards = [n.foundations[src.suit].pop()!];
  else {
    const col = n.tableau[src.col];
    cards = col.up.splice(src.index);
    if (!col.up.length && col.down.length) col.up.push(col.down.pop()!);
  }
  if (tgt.to === 'foundation') foundationFor(n, cards[0]).push(cards[0]);
  else n.tableau[tgt.col].up.push(...cards);
  n.moves++;
  n.won = n.foundations.every((f) => f.length === 13);
  return n;
}

/**
 * The most useful place for the cards at `src`, for tap-to-move: the foundation first,
 * then a column with cards, then an empty column. Never a pointless move, like a king
 * that already starts its column moving to another empty column.
 */
export function bestTarget(s: State, src: Source): Target | null {
  if (isLegal(s, src, { to: 'foundation' })) return { to: 'foundation' };
  const kingAlreadyAtBottom = src.from === 'tableau' && src.index === 0 && !s.tableau[src.col].down.length;
  let empty: Target | null = null;
  for (let col = 0; col < COLUMNS; col++) {
    const tgt: Target = { to: 'tableau', col };
    if (!isLegal(s, src, tgt)) continue;
    if (s.tableau[col].up.length) return tgt;
    if (!kingAlreadyAtBottom) empty ??= tgt;
  }
  return empty;
}

export type Hint = { src: Source; tgt: Target } | { draw: true };

/** Every card that can be picked up: the turned-over card and each face-up tableau card. */
function sources(s: State): Source[] {
  const out: Source[] = s.waste.length ? [{ from: 'waste' }] : [];
  s.tableau.forEach((col, c) => col.up.forEach((_, index) => out.push({ from: 'tableau', col: c, index })));
  return out;
}

/**
 * The deck cards that turning the deck can bring to the top of the turned-over pile: the
 * rest of this pass, then one whole pass after the deck is turned back over (every later
 * pass is the same). Drawing three, the others stay buried until a card above them is played.
 */
function reachable(s: State): Card[] {
  let stock = s.stock.slice();
  let waste = s.waste.slice();
  const tops: Card[] = [];
  for (let passes = 0; passes < 2; ) {
    if (!stock.length) {
      if (!waste.length) break;
      stock = waste.reverse();
      waste = [];
      passes++;
      continue;
    }
    for (let i = 0; i < s.draw && stock.length; i++) waste.push(stock.pop()!);
    tops.push(waste.at(-1)!);
  }
  return tops;
}

/** True if turning the deck can bring up a card that could be played right now. */
const deckUseful = (s: State) => reachable(s).some((c) => canFound(s, c) || s.tableau.some((col) => canStack(c, col)));

/**
 * A move to suggest, most useful first: a card up to its pile, a move that turns over a
 * face-down card, the turned-over card onto a column, turning the deck (when it holds a
 * card that could be played), then any other legal move. Null when there's none at all.
 */
export function findHint(s: State): Hint | null {
  if (s.won) return null;
  const all = sources(s);
  const foundation = all.find((src) => isLegal(s, src, { to: 'foundation' }));
  if (foundation) return { src: foundation, tgt: { to: 'foundation' } };
  for (const src of all) {
    if (src.from !== 'tableau' || src.index !== 0 || !s.tableau[src.col].down.length) continue;
    const tgt = bestTarget(s, src);
    if (tgt) return { src, tgt };
  }
  const fromWaste = s.waste.length ? bestTarget(s, { from: 'waste' }) : null;
  if (fromWaste) return { src: { from: 'waste' }, tgt: fromWaste };
  if ((s.stock.length || s.waste.length) && deckUseful(s)) return { draw: true };
  for (const src of all) {
    const tgt = bestTarget(s, src);
    if (tgt) return { src, tgt };
  }
  return null;
}

/** No legal move, and no card in the deck that could ever be played: the deal is lost. */
export const isStuck = (s: State): boolean => findHint(s) === null && !s.won;

/** True when every card is face up and out of the stock, so the game can finish itself. */
export function canAutoFinish(s: State): boolean {
  return !s.won && !s.stock.length && !s.waste.length && s.tableau.every((c) => !c.down.length);
}

/**
 * Plays every remaining card to the foundations. Each column's top card is its lowest,
 * so the lowest card left is always on top somewhere and can always go up.
 */
export function autoFinish(s: State): State {
  let n = s;
  while (canAutoFinish(n)) {
    const col = n.tableau.findIndex((c) => c.up.length && canFound(n, c.up.at(-1)!));
    n = move(n, { from: 'tableau', col, index: n.tableau[col].up.length - 1 }, { to: 'foundation' })!;
  }
  return n;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  if (
    !st ||
    (st.draw !== 1 && st.draw !== 3) ||
    !Array.isArray(st.stock) ||
    !Array.isArray(st.waste) ||
    !Array.isArray(st.foundations) ||
    st.foundations.length !== SUITS.length ||
    !Array.isArray(st.tableau) ||
    st.tableau.length !== COLUMNS ||
    !st.tableau.every((c) => Array.isArray(c?.down) && Array.isArray(c?.up)) ||
    typeof st.moves !== 'number' ||
    typeof st.elapsed !== 'number' ||
    typeof st.won !== 'boolean'
  ) {
    return false;
  }
  const all = [...st.stock, ...st.waste, ...st.foundations.flat(), ...st.tableau.flatMap((c) => [...c.down, ...c.up])];
  return (
    isFullDeck(all) &&
    st.foundations.every((f, i) => f.every((c, r) => isCard(c) && c.suit === SUITS[i] && c.rank === r + 1))
  );
}

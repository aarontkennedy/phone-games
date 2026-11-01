// Spider solitaire with two decks (104 cards), in 1, 2 or 4 suits. Ten columns: the
// first four get 6 cards, the rest 5, only the top card face up; 50 cards stay in the
// deck. Put any card on one a rank higher, but only a run of one suit moves together.
// A whole King-to-Ace run of one suit leaves the table; eight runs win. Tapping the deck
// deals one card onto every column, once no column is empty.
// Pure functions: every action returns a new State, or null.
import { shuffle, type Rng } from '../../core/random';
import { SUITS, type Card, type Suit } from '../../core/cards';

export type Suits = 1 | 2 | 4;
export const COLUMNS = 10;
export const RUNS = 8;

export interface Column {
  down: Card[];
  /** Face-up cards, the last one on top. */
  up: Card[];
}

export interface State {
  suits: Suits;
  stock: Card[];
  tableau: Column[];
  /** Completed King-to-Ace runs, by suit, in the order they were finished. */
  done: Suit[];
  moves: number;
  elapsed: number;
  won: boolean;
}

/** Where a move picks up: a column and how far down its face-up cards. */
export interface Source {
  col: number;
  index: number;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
const SUIT_SETS: Record<Suits, readonly Suit[]> = { 1: ['S'], 2: ['S', 'H'], 4: SUITS };

/** The 104 cards for a level: two decks' worth, using only that level's suits. */
export function spiderDeck(suits: Suits): Card[] {
  const set = SUIT_SETS[suits];
  return Array.from({ length: 104 / 13 }, (_, i) => set[i % set.length]).flatMap((suit) =>
    Array.from({ length: 13 }, (_, r) => ({ suit, rank: r + 1 })),
  );
}

export function newGame(suits: Suits = 1, rng: Rng = Math.random): State {
  const deck = shuffle(spiderDeck(suits), rng);
  const tableau = Array.from({ length: COLUMNS }, (_, c) => {
    const cards = deck.splice(0, c < 4 ? 6 : 5);
    return { down: cards.slice(0, -1), up: cards.slice(-1) };
  });
  return { suits, stock: deck, tableau, done: [], moves: 0, elapsed: 0, won: false };
}

/** A run of one suit, each card one lower than the one before. */
export const isRun = (cards: Card[]): boolean =>
  cards.every((c, i) => i === 0 || (c.suit === cards[i - 1].suit && c.rank === cards[i - 1].rank - 1));

export function cardsAt(s: State, src: Source): Card[] {
  const col = s.tableau[src.col];
  return col && src.index >= 0 && src.index < col.up.length ? col.up.slice(src.index) : [];
}

/** True if the cards at `src` can go on column `to`. */
export function canMove(s: State, src: Source, to: number): boolean {
  const cards = cardsAt(s, src);
  const target = s.tableau[to];
  if (!cards.length || !target || to === src.col || !isRun(cards)) return false;
  const top = target.up.at(-1);
  return !top || top.rank === cards[0].rank + 1;
}

/** Turns over a column's new top card, and lifts off a finished King-to-Ace run. */
function settle(n: State, col: number): void {
  const c = n.tableau[col];
  const last13 = c.up.slice(-13);
  if (last13.length === 13 && last13[0].rank === 13 && isRun(last13)) {
    c.up.splice(-13);
    n.done.push(last13[0].suit);
  }
  if (!c.up.length && c.down.length) c.up.push(c.down.pop()!);
  n.won = n.done.length === RUNS;
}

export function move(s: State, src: Source, to: number): State | null {
  if (!canMove(s, src, to)) return null;
  const n = clone(s);
  n.tableau[to].up.push(...n.tableau[src.col].up.splice(src.index));
  settle(n, src.col);
  settle(n, to);
  n.moves++;
  return n;
}

/** Deals one card face up onto every column. Not allowed while a column is empty. */
export function deal(s: State): State | null {
  if (s.stock.length < COLUMNS || s.tableau.some((c) => !c.up.length && !c.down.length)) return null;
  const n = clone(s);
  n.tableau.forEach((c) => c.up.push(n.stock.pop()!));
  n.tableau.forEach((_, i) => settle(n, i));
  n.moves++;
  return n;
}

/**
 * Where a tapped card should go: onto a card of its own suit if possible (that keeps the
 * run together), then onto any card one higher, then an empty column. Never a pointless
 * move, like a whole column into an empty one.
 */
export function bestTarget(s: State, src: Source): number | null {
  const cards = cardsAt(s, src);
  if (!cards.length || !isRun(cards)) return null;
  const legal = Array.from({ length: COLUMNS }, (_, i) => i).filter((i) => canMove(s, src, i));
  const withCards = legal.filter((i) => s.tableau[i].up.length);
  const sameSuit = withCards.find((i) => s.tableau[i].up.at(-1)!.suit === cards[0].suit);
  if (sameSuit !== undefined) return sameSuit;
  if (withCards.length) return withCards[0];
  const wholeColumn = src.index === 0 && !s.tableau[src.col].down.length;
  return wholeColumn ? null : (legal[0] ?? null);
}

export type Hint = { src: Source; to: number } | { deal: true };

/**
 * A move to suggest, most useful first: one that builds a same-suit run, one that turns
 * over a face-down card or empties a column, then dealing, then any other move. Cards
 * already sitting on their own suit aren't shuffled around. Null when nothing is left.
 */
export function findHint(s: State): Hint | null {
  if (s.won) return null;
  const options: { src: Source; to: number; score: number }[] = [];
  s.tableau.forEach((col, c) =>
    col.up.forEach((card, index) => {
      const src = { col: c, index };
      const to = bestTarget(s, src);
      if (to === null) return;
      const below = col.up[index - 1];
      const settled = below && below.suit === card.suit && below.rank === card.rank + 1;
      if (settled) return;
      const onto = s.tableau[to].up.at(-1);
      const reveals = index === 0 && (col.down.length > 0 || !!onto);
      const score = (onto?.suit === card.suit ? 4 : 0) + (reveals ? 2 : 0) + (below ? 0 : 1);
      options.push({ src, to, score });
    }),
  );
  options.sort((a, b) => b.score - a.score);
  if (options.length && options[0].score >= 2) return { src: options[0].src, to: options[0].to };
  if (deal(s)) return { deal: true };
  return options.length ? { src: options[0].src, to: options[0].to } : null;
}

/** No move and no deal left: the game is lost. */
export const isStuck = (s: State): boolean => !s.won && findHint(s) === null;

const key = (c: Card) => `${c.rank}${c.suit}`;

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  if (!st || ![1, 2, 4].includes(st.suits) || !Array.isArray(st.stock) || !Array.isArray(st.tableau) || !Array.isArray(st.done)) return false;
  if (st.tableau.length !== COLUMNS || !st.tableau.every((c) => c && Array.isArray(c.down) && Array.isArray(c.up))) return false;
  if (!Number.isInteger(st.moves) || typeof st.elapsed !== 'number' || typeof st.won !== 'boolean') return false;
  if (st.tableau.some((c) => c.down.length && !c.up.length)) return false;
  // Every card of the level's two decks, exactly once (finished runs count as 13 each).
  const have = new Map<string, number>();
  const add = (c: Card) => have.set(key(c), (have.get(key(c)) ?? 0) + 1);
  const cards = [...st.stock, ...st.tableau.flatMap((c) => [...c.down, ...c.up])];
  if (!cards.every((c) => c && SUITS.includes(c.suit) && Number.isInteger(c.rank) && c.rank >= 1 && c.rank <= 13)) return false;
  cards.forEach(add);
  for (const suit of st.done) {
    if (!SUITS.includes(suit)) return false;
    for (let rank = 1; rank <= 13; rank++) add({ suit, rank });
  }
  const want = new Map<string, number>();
  for (const c of spiderDeck(st.suits)) want.set(key(c), (want.get(key(c)) ?? 0) + 1);
  return want.size === have.size && [...want].every(([k, n]) => have.get(k) === n) && st.won === (st.done.length === RUNS);
}

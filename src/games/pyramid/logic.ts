// Pyramid solitaire: 28 cards dealt face up in a pyramid of 7 rows, each row overlapping
// the one above; the other 24 make the deck. A card is free once both cards covering it
// are gone. Remove free cards in pairs that add up to 13 (aces 1, jacks 11, queens 12),
// and kings on their own. The top card of the turned-over pile can pair too. Turn the deck
// one card at a time, going through it up to three times. Clear the pyramid to win.
// Pure functions: every move returns a new State, or null if it isn't allowed.
import { isCard, isFullDeck, shuffledDeck, type Card } from '../../core/cards';
import type { Rng } from '../../core/random';

export const ROWS = 7;
export const SIZE = 28;
export const PASSES = 3;

export interface State {
  /** Row by row from the top: row r holds r + 1 cards. Null where a card is gone. */
  pyramid: (Card | null)[];
  /** Face down; the last card is turned next. */
  stock: Card[];
  /** Turned over; the last card is the one you can play. */
  waste: Card[];
  /** Times through the deck so far, counting this one (1 to PASSES). */
  pass: number;
  /** Cards removed (kings and pairs), for the full-deck check. */
  removed: Card[];
  moves: number;
  elapsed: number;
  won: boolean;
}

/** A card you can pick: one in the pyramid, or the top of the turned-over pile. */
export type Source = { from: 'pyramid'; i: number } | { from: 'waste' };

/** Row and place of pyramid card i, and back. */
export const rowOf = (i: number): number => Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
export const indexOf = (row: number, col: number): number => (row * (row + 1)) / 2 + col;

export function newGame(rng: Rng = Math.random): State {
  const deck = shuffledDeck(rng);
  return { pyramid: deck.slice(0, SIZE), stock: deck.slice(SIZE), waste: [], pass: 1, removed: [], moves: 0, elapsed: 0, won: false };
}

/** Whether pyramid card i is there and nothing covers it. */
export function isFree(s: State, i: number): boolean {
  if (!s.pyramid[i]) return false;
  const row = rowOf(i);
  if (row === ROWS - 1) return true;
  const col = i - indexOf(row, 0);
  return !s.pyramid[indexOf(row + 1, col)] && !s.pyramid[indexOf(row + 1, col + 1)];
}

export function cardAt(s: State, src: Source): Card | null {
  if (src.from === 'waste') return s.waste.at(-1) ?? null;
  return isFree(s, src.i) ? s.pyramid[src.i] : null;
}

/** Every card you can pick now. */
export function sources(s: State): Source[] {
  const out: Source[] = s.pyramid.flatMap((_, i) => (isFree(s, i) ? [{ from: 'pyramid' as const, i }] : []));
  if (s.waste.length) out.push({ from: 'waste' });
  return out;
}

const same = (a: Source, b: Source) => a.from === b.from && (a.from === 'waste' || a.i === (b as typeof a).i);

/** Removes a king, or two cards adding up to 13. */
export function remove(s: State, picks: Source[]): State | null {
  if (s.won || !picks.length || picks.length > 2) return null;
  if (picks.length === 2 && same(picks[0], picks[1])) return null;
  const cards = picks.map((p) => cardAt(s, p));
  if (cards.some((c) => !c)) return null;
  const sum = cards.reduce((t, c) => t + c!.rank, 0);
  if (sum !== 13) return null;
  const pyramid = s.pyramid.slice();
  const waste = s.waste.slice();
  for (const p of picks) {
    if (p.from === 'waste') waste.pop();
    else pyramid[p.i] = null;
  }
  return { ...s, pyramid, waste, removed: [...s.removed, ...(cards as Card[])], moves: s.moves + 1, won: pyramid.every((c) => !c) };
}

/** Turns the next deck card over, or turns the pile back into the deck for another pass. */
export function draw(s: State): State | null {
  if (s.won) return null;
  if (s.stock.length) return { ...s, stock: s.stock.slice(0, -1), waste: [...s.waste, s.stock.at(-1)!], moves: s.moves + 1 };
  if (s.pass >= PASSES || !s.waste.length) return null;
  return { ...s, stock: s.waste.slice().reverse(), waste: [], pass: s.pass + 1, moves: s.moves + 1 };
}

export const cardsLeft = (s: State): number => s.pyramid.filter(Boolean).length;
/** Passes through the deck still to come after this one. */
export const passesLeft = (s: State): number => PASSES - s.pass;

export type Hint = { remove: Source[] } | { draw: true };

/**
 * A move to suggest: a free king, a pair of pyramid cards (the lower in the pyramid the
 * better, as those free the most), a pyramid card with the turned-over card, then turning
 * the deck. Null when there's nothing left to do.
 */
export function findHint(s: State): Hint | null {
  if (s.won) return null;
  const all = sources(s);
  const king = all.find((p) => cardAt(s, p)!.rank === 13);
  if (king) return { remove: [king] };
  const depth = (p: Source) => (p.from === 'waste' ? -1 : rowOf(p.i));
  let best: Source[] | null = null;
  let bestDepth = -Infinity;
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) {
      if (cardAt(s, all[a])!.rank + cardAt(s, all[b])!.rank !== 13) continue;
      // Pairs within the pyramid first, then the deepest.
      const d = Math.min(depth(all[a]), depth(all[b])) + (all[a].from === 'waste' || all[b].from === 'waste' ? -10 : 0);
      if (d > bestDepth) [best, bestDepth] = [[all[a], all[b]], d];
    }
  }
  if (best) return { remove: best };
  return draw(s) ? { draw: true } : null;
}

/** No move left: the deal is lost. */
export const isStuck = (s: State): boolean => !s.won && findHint(s) === null;

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  return (
    !!st &&
    Array.isArray(st.pyramid) &&
    st.pyramid.length === SIZE &&
    st.pyramid.every((c) => c === null || isCard(c)) &&
    cards(st.stock) &&
    cards(st.waste) &&
    cards(st.removed) &&
    Number.isInteger(st.pass) &&
    st.pass >= 1 &&
    st.pass <= PASSES &&
    typeof st.moves === 'number' &&
    typeof st.elapsed === 'number' &&
    typeof st.won === 'boolean' &&
    isFullDeck([...st.pyramid.filter((c): c is Card => !!c), ...st.stock, ...st.waste, ...st.removed])
  );
}

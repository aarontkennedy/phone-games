import type { Card, Suit } from '../../core/cards';
import type { State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

/** Parses "QH", "10S" or "AC" into a card. */
export function card(id: string): Card {
  const r = id.slice(0, -1);
  return { suit: id.slice(-1) as Suit, rank: RANKS[r] ?? Number(r) };
}

/** Parses a space-separated list, bottom card first: "9S 8H 7C". */
export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

/** Ace up to `rank` of one suit: a foundation pile. */
export const upTo = (suit: Suit, rank: number): Card[] => Array.from({ length: rank }, (_, i) => ({ suit, rank: i + 1 }));

/** A table with no cards anywhere, to build test positions on. Not a valid saved game. */
export function blank(): State {
  return {
    draw: 1,
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: Array.from({ length: 7 }, () => ({ down: [], up: [] })),
    moves: 0,
    elapsed: 0,
    won: false,
  };
}

/**
 * A real, valid game one move from winning: everything is on the foundations except the
 * king of clubs, which is on the waste.
 */
export function oneMoveFromWinning(): State {
  return {
    ...blank(),
    waste: [{ suit: 'C', rank: 13 }],
    foundations: [upTo('S', 13), upTo('H', 13), upTo('D', 13), upTo('C', 12)],
  };
}

/** Makes a test position a valid saved game by putting every card it doesn't use in the stock. */
export function complete(s: State): State {
  const used = new Set(
    [...s.stock, ...s.waste, ...s.foundations.flat(), ...s.tableau.flatMap((c) => [...c.down, ...c.up])].map(
      (c) => `${c.rank}${c.suit}`,
    ),
  );
  const rest = (['S', 'H', 'D', 'C'] as Suit[]).flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1 })).filter((c) => !used.has(`${c.rank}${c.suit}`)),
  );
  return { ...s, stock: [...rest, ...s.stock] };
}

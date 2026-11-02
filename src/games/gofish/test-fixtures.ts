import { newDeck, type Card, type Suit } from '../../core/cards';
import type { State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
export const card = (id: string): Card => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) });
export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

/** A game in progress with these hands and books; every other card is in the deck, unless `stock` says. */
export function position(hands: string[], o: Partial<State> = {}): State {
  const held = hands.map(cards);
  const books = o.books ?? [[], [], [], []];
  const used = (c: Card) => held.flat().some((h) => h.suit === c.suit && h.rank === c.rank) || books.flat().includes(c.rank);
  return {
    level: 'strong',
    phase: 'playing',
    dealer: 3,
    hands: held,
    stock: newDeck().filter((c) => !used(c)),
    books,
    turn: 0,
    known: [[], [], [], []],
    last: null,
    tally: { won: 0, played: 0 },
    ...o,
  };
}

/** Moves these cards to the top of the deck, the last one drawn first. */
export function onTop(s: State, ids: string): State {
  const top = cards(ids);
  const rest = s.stock.filter((c) => !top.some((t) => t.suit === c.suit && t.rank === c.rank));
  return { ...s, stock: [...rest, ...top.reverse()] };
}

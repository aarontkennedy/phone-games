import { newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import type { State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
export const card = (id: string): Card => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) });
export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

/** A round in progress with these hands and discard pile; every other card is in the stock. */
export function position(hands: string[], discard: string, o: Partial<State> = {}): State {
  const held = hands.map(cards);
  const pile = cards(discard);
  const used = [...held.flat(), ...pile, ...(o.stock ?? [])];
  return {
    level: 'strong',
    phase: 'playing',
    dealer: 3,
    hands: held,
    stock: o.stock ?? newDeck().filter((c) => !used.some((u) => sameCard(u, c))),
    discard: pile,
    suit: pile.at(-1)!.suit,
    turn: 0,
    lastPlay: [null, null, null, null],
    scores: [0, 0, 0, 0],
    last: null,
    ...o,
  };
}

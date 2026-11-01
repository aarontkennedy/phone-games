import { newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import type { State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
export const card = (id: string): Card => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) });
export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

/** A hand in progress: these hands and discard pile, everything else in the stock. */
export function position(hands: [string, string], discard: string, o: Partial<State> = {}): State {
  const held = hands.map(cards);
  const pile = cards(discard);
  const used = [...held.flat(), ...pile];
  return {
    level: 'strong',
    phase: 'draw',
    dealer: 1,
    turn: 0,
    hands: held,
    stock: newDeck().filter((c) => !used.some((u) => sameCard(u, c))),
    discard: pile,
    taken: null,
    scores: [0, 0],
    last: null,
    ...o,
  };
}

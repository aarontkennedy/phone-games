import { newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import { newState, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map((id) => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) }));

/** A dealt hand waiting for you to hold cards; `next` are drawn in order. */
export function dealt(hand: string, next = '', o: Partial<State> = {}): State {
  const h = cards(hand);
  const n = cards(next);
  const rest = newDeck().filter((c) => !h.some((x) => sameCard(x, c)) && !n.some((x) => sameCard(x, c)));
  return { ...newState(), phase: 'holding', credits: 95, bet: 5, hand: h, held: [false, false, false, false, false], deck: [...rest, ...n.reverse()], ...o };
}

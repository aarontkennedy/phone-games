import { type Suit } from '../../core/cards';
import { JOKER, newState, type PgCard, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
/** "AS KH JK" (JK is the joker) into cards. */
export const cards = (ids: string): PgCard[] =>
  ids
    .split(' ')
    .filter(Boolean)
    .map((id) => (id === 'JK' ? JOKER : { suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) }));

/** A hand being set: your seven cards and the dealer's, as given (keep them highest first). */
export function setting(hand: string, dealer: string, o: Partial<State> = {}): State {
  return { ...newState(), phase: 'setting', chips: 960, bet: 40, hand: cards(hand), dealer: cards(dealer), ...o };
}

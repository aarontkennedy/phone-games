import { newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import { SIZE, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
export const card = (id: string): Card => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) });
export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

/**
 * A deal with these pyramid cards (by index, the rest gone), this turned-over pile (top
 * last) and this deck (turned next last). Every other card counts as removed, so it's a
 * valid saved game.
 */
export function table(pyramid: Record<number, string>, waste = '', stock = '', o: Partial<State> = {}): State {
  const pyr: (Card | null)[] = Array.from({ length: SIZE }, (_, i) => (pyramid[i] ? card(pyramid[i]) : null));
  const w = cards(waste);
  const st = cards(stock);
  const used = [...pyr.filter((c): c is Card => !!c), ...w, ...st];
  return {
    pyramid: pyr,
    stock: st,
    waste: w,
    pass: 1,
    removed: newDeck().filter((c) => !used.some((u) => sameCard(u, c))),
    moves: 0,
    elapsed: 0,
    won: false,
    ...o,
  };
}

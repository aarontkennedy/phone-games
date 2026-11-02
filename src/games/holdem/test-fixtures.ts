import { newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import { START_CHIPS, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map((id) => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) }));

/**
 * A hand in progress: these hole cards (empty for a seat not dealt in) and shared cards.
 * `next` are the next cards off the deck, in order (burn cards included). Chips not in
 * stacks are in the pot as `put`, so the total stays 4000.
 */
export function table(hole: string[], board = '', o: Partial<State> = {}, next = ''): State {
  const held = hole.map(cards);
  const shared = cards(board);
  const upcoming = cards(next);
  const street = [0, 0, 0, 1, 2, 3][shared.length];
  const used = [...held.flat(), ...shared, ...upcoming];
  const rest = newDeck().filter((c) => !used.some((u) => sameCard(u, c))).slice(street); // burned cards are gone
  const stacks = o.stacks ?? [START_CHIPS, START_CHIPS, START_CHIPS, START_CHIPS];
  const put = o.put ?? stacks.map((c) => START_CHIPS - c);
  return {
    level: 'strong',
    phase: 'betting',
    hand: 1,
    dealer: 3,
    stacks,
    live: held.map((h) => h.length > 0),
    hole: held,
    board: shared,
    deck: [...rest, ...upcoming.reverse()],
    street,
    turn: 0,
    bets: [0, 0, 0, 0],
    put,
    raises: 0,
    toAct: held.map((h) => h.length > 0),
    said: ['', '', '', ''],
    pots: null,
    shown: false,
    ...o,
  };
}

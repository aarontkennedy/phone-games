import { newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import { START_CHIPS, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map((id) => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) }));
export const card = (id: string): Card => cards(id)[0];

/**
 * A hand in progress: these hands (empty for a seat not dealt in). `next` are the next cards
 * off the deck, in order. Chips not in stacks are in the pot as `put`.
 */
export function table(hands: string[], o: Partial<State> = {}, next = ''): State {
  const held = hands.map(cards);
  const upcoming = cards(next);
  const used = [...held.flat(), ...upcoming];
  const rest = newDeck().filter((c) => !used.some((u) => sameCard(u, c)));
  const stacks = o.stacks ?? [START_CHIPS, START_CHIPS, START_CHIPS, START_CHIPS];
  return {
    level: 'strong',
    phase: 'betting',
    hand: 1,
    dealer: 3,
    turn: 0,
    stacks,
    live: held.map((h) => h.length > 0),
    bets: [0, 0, 0, 0],
    put: o.put ?? stacks.map((c) => START_CHIPS - c),
    raises: 0,
    toAct: held.map((h) => h.length > 0),
    said: ['', '', '', ''],
    hands: held,
    deck: [...rest, ...upcoming.reverse()],
    round: 0,
    drew: [-1, -1, -1, -1],
    discards: [],
    pots: null,
    shown: false,
    ...o,
  };
}

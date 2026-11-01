import { newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import type { Play, Seat } from '../../core/tricks';
import type { State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

export function card(id: string): Card {
  const r = id.slice(0, -1);
  return { suit: id.slice(-1) as Suit, rank: RANKS[r] ?? Number(r) };
}

export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

/** Plays in order, starting with `first`: trick(1, '5H KS') is West's 5H then North's KS. */
export const trick = (first: Seat, ids: string): Play[] =>
  cards(ids).map((c, i) => ({ seat: ((first + i) % 4) as Seat, card: c }));

/**
 * A round in progress. Hands are given for each seat; every other card counts as already
 * played, so the position is a valid saved game.
 */
export function position(hands: string[], overrides: Partial<State> = {}): State {
  const held = hands.map(cards);
  const table = (overrides.trick ?? []).map((p) => p.card);
  const played = newDeck().filter((c) => ![...held.flat(), ...table].some((h) => sameCard(h, c)));
  return {
    level: 'strong',
    round: 0,
    phase: 'playing',
    hands: held,
    trick: [],
    turn: 0,
    heartsBroken: false,
    tricksPlayed: 5,
    points: [0, 0, 0, 0],
    scores: [0, 0, 0, 0],
    lastRound: [0, 0, 0, 0],
    moon: null,
    played: [...played, ...table],
    received: [],
    ...overrides,
  };
}

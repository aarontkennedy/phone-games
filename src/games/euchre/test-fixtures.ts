import { sameCard, type Card, type Suit } from '../../core/cards';
import type { Play, Seat } from '../../core/tricks';
import { euchreDeck, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

export function card(id: string): Card {
  const r = id.slice(0, -1);
  return { suit: id.slice(-1) as Suit, rank: RANKS[r] ?? Number(r) };
}

export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

export const trick = (first: Seat, ids: string): Play[] =>
  cards(ids).map((c, i) => ({ seat: ((first + i) % 4) as Seat, card: c }));

/**
 * A hand in progress with hearts as trump, called by you. Hands and the kitty are given;
 * every other card counts as played, so the position is a valid saved game.
 */
export function position(hands: string[], overrides: Partial<State> = {}, kitty = ''): State {
  const held = hands.map(cards);
  const kept = cards(kitty);
  const table = (overrides.trick ?? []).map((p) => p.card);
  const used = [...held.flat(), ...kept, ...table];
  const played = euchreDeck().filter((c) => !used.some((u) => sameCard(u, c)));
  return {
    level: 'strong',
    phase: 'playing',
    dealer: 3,
    hands: held,
    kitty: kept,
    turned: kept[0] ?? card('9H'),
    turn: 0,
    trump: 'H',
    maker: 0,
    alone: false,
    trick: [],
    tricks: [0, 0, 0, 0],
    scores: [0, 0],
    last: null,
    played: [...played, ...table],
    ...overrides,
  };
}

/** Bidding, round one, with the 9 of hearts turned up and West to bid first (you deal... no: East deals). */
export function bidding(hands: string[], overrides: Partial<State> = {}): State {
  return position(hands, { phase: 'bidding1', trump: null, maker: null, turn: 0, ...overrides }, '9H 10S QS KS');
}

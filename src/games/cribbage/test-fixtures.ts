import { newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import type { Player, State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

export function card(id: string): Card {
  const r = id.slice(0, -1);
  return { suit: id.slice(-1) as Suit, rank: RANKS[r] ?? Number(r) };
}

export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

/** A pile of plays, alternating from `first`. */
export const pile = (first: Player, ids: string) =>
  cards(ids).map((c, i) => ({ player: ((first + i) % 2) as Player, card: c }));

/**
 * Pegging in progress. The computer dealt, so you play first. Hands and the current pile
 * are given; every other card is in the stock, so it's a valid saved game.
 */
export function pegging(hands: [string, string], overrides: Partial<State> = {}): State {
  const held = hands.map(cards);
  const pegged = overrides.pegged ?? overrides.pile ?? [];
  const crib = overrides.crib ?? cards('6S 7S 8S 10S'); // cards the tests don't use elsewhere
  const starter = overrides.starter === undefined ? card('KD') : overrides.starter;
  const used = [...held.flat(), ...pegged.map((p) => p.card), ...crib, ...(starter ? [starter] : [])];
  return {
    level: 'strong',
    phase: 'pegging',
    dealer: 1,
    hands: held,
    kept: [[], []],
    crib,
    starter,
    stock: newDeck().filter((c) => !used.some((u) => sameCard(u, c))),
    pile: [],
    pegged,
    turn: 0,
    showStep: 0,
    scores: [0, 0],
    events: [],
    ...overrides,
  };
}

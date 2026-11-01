import { newDeck, type Card, type Suit } from '../../core/cards';
import { newState, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

/** Parses "QH", "10S" or "AC" into a card. */
export function card(id: string): Card {
  const r = id.slice(0, -1);
  return { suit: id.slice(-1) as Suit, rank: RANKS[r] ?? Number(r) };
}

export const cards = (ids: string): Card[] => ids.split(' ').filter(Boolean).map(card);

/**
 * A table whose shoe deals `order` first, in that order. Deals go: you, dealer face up,
 * you, dealer face down, then each card drawn after. A full deck sits underneath, so the
 * shoe never runs out or reshuffles.
 */
export function stacked(order: string, overrides: Partial<State> = {}): State {
  const filler = Array.from({ length: 2 }, newDeck).flat();
  return { ...newState(() => 0), shoe: [...filler, ...cards(order).reverse()], ...overrides };
}

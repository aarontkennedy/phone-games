import type { Card, Suit } from '../../core/cards';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
export const cards = (ids: string): Card[] =>
  ids.split(' ').filter(Boolean).map((id) => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) }));

/** A shoe that deals these cards in this order (the shoe deals from its end). */
export const stacked = (ids: string): Card[] => cards(ids).reverse();

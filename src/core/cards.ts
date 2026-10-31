// Standard 52-card deck, shared by every card game. Pure data, no DOM.
import { shuffle, type Rng } from './random';

export type Suit = 'S' | 'H' | 'D' | 'C';

/** Rank 1 (ace) to 13 (king). Games that rank aces high handle that themselves. */
export interface Card {
  suit: Suit;
  rank: number;
}

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];

const SUIT_NAMES: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

export const isRed = (card: Card): boolean => card.suit === 'H' || card.suit === 'D';

/** Short label for the card corner: A, 2 to 10, J, Q, K. */
export const rankLabel = (card: Card): string => RANK_LABELS[card.rank];

/** Spoken name, e.g. "Queen of hearts". */
export const cardName = (card: Card): string => `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;

export const suitName = (suit: Suit): string => SUIT_NAMES[suit];

/** Stable id such as "QH" or "10S", for keys and data attributes. */
export const cardId = (card: Card): string => `${rankLabel(card)}${card.suit}`;

export const sameCard = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank;

/** All 52 cards in suit order, ace to king. */
export function newDeck(): Card[] {
  return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1 })));
}

export function shuffledDeck(rng: Rng = Math.random): Card[] {
  return shuffle(newDeck(), rng);
}

export function isCard(c: unknown): c is Card {
  const card = c as Card | null;
  return (
    !!card &&
    SUITS.includes(card.suit) &&
    Number.isInteger(card.rank) &&
    card.rank >= 1 &&
    card.rank <= 13
  );
}

/** True when `cards` holds every card of a full deck exactly once. */
export function isFullDeck(cards: unknown[]): boolean {
  if (cards.length !== 52 || !cards.every(isCard)) return false;
  return new Set(cards.map(cardId)).size === 52;
}

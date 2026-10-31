import { describe, expect, it } from 'vitest';
import {
  cardId,
  cardName,
  isCard,
  isFullDeck,
  isRed,
  newDeck,
  rankLabel,
  sameCard,
  shuffledDeck,
  suitName,
} from './cards';
import { seededRng } from './random';

describe('cards', () => {
  it('builds 52 unique cards', () => {
    const deck = newDeck();
    expect(deck).toHaveLength(52);
    expect(isFullDeck(deck)).toBe(true);
    expect(deck[0]).toEqual({ suit: 'S', rank: 1 });
    expect(deck[51]).toEqual({ suit: 'C', rank: 13 });
  });

  it('shuffles reproducibly with a seeded rng', () => {
    const a = shuffledDeck(seededRng(7));
    expect(a).toEqual(shuffledDeck(seededRng(7)));
    expect(a).not.toEqual(newDeck());
    expect(isFullDeck(a)).toBe(true);
  });

  it('names and labels cards', () => {
    expect(rankLabel({ suit: 'H', rank: 1 })).toBe('A');
    expect(rankLabel({ suit: 'H', rank: 10 })).toBe('10');
    expect(cardName({ suit: 'H', rank: 12 })).toBe('Queen of hearts');
    expect(cardName({ suit: 'C', rank: 7 })).toBe('7 of clubs');
    expect(cardId({ suit: 'S', rank: 10 })).toBe('10S');
    expect(suitName('D')).toBe('diamonds');
  });

  it('knows red suits', () => {
    expect(isRed({ suit: 'H', rank: 2 })).toBe(true);
    expect(isRed({ suit: 'D', rank: 2 })).toBe(true);
    expect(isRed({ suit: 'S', rank: 2 })).toBe(false);
    expect(isRed({ suit: 'C', rank: 2 })).toBe(false);
  });

  it('compares cards', () => {
    expect(sameCard({ suit: 'H', rank: 2 }, { suit: 'H', rank: 2 })).toBe(true);
    expect(sameCard({ suit: 'H', rank: 2 }, { suit: 'D', rank: 2 })).toBe(false);
  });

  it('validates cards and decks', () => {
    expect(isCard({ suit: 'H', rank: 13 })).toBe(true);
    expect(isCard({ suit: 'X', rank: 3 })).toBe(false);
    expect(isCard({ suit: 'H', rank: 0 })).toBe(false);
    expect(isCard({ suit: 'H', rank: 1.5 })).toBe(false);
    expect(isCard(null)).toBe(false);
    const deck = newDeck();
    expect(isFullDeck(deck.slice(1))).toBe(false);
    expect(isFullDeck([...deck.slice(2), deck[0], deck[0]])).toBe(false); // 52 cards, one twice
    expect(isFullDeck([...deck.slice(1), { suit: 'X', rank: 1 }])).toBe(false);
  });
});

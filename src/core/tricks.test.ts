import { describe, expect, it } from 'vitest';
import { newDeck, type Card, type Suit } from './cards';
import { dealFour, followSuit, highRank, nextSeat, sortHand, trickWinner, type Play, type Seat } from './tricks';

const c = (rank: number, suit: Suit): Card => ({ suit, rank });
const trick = (...cards: Card[]): Play[] => cards.map((card, i) => ({ seat: i as Seat, card }));

describe('tricks', () => {
  it('goes clockwise around the table', () => {
    expect(nextSeat(0)).toBe(1);
    expect(nextSeat(3)).toBe(0);
    expect(nextSeat(1, 2)).toBe(3);
  });

  it('ranks aces high', () => {
    expect(highRank(c(1, 'S'))).toBe(14);
    expect(highRank(c(13, 'S'))).toBe(13);
    expect(highRank(c(2, 'S'))).toBe(2);
  });

  it('gives the trick to the highest card of the suit led', () => {
    expect(trickWinner(trick(c(5, 'H'), c(13, 'S'), c(9, 'H'), c(1, 'C')))).toBe(2);
    expect(trickWinner(trick(c(1, 'H'), c(13, 'H'), c(9, 'H'), c(2, 'H')))).toBe(0);
  });

  it('lets trump beat the suit led', () => {
    expect(trickWinner(trick(c(1, 'H'), c(2, 'S'), c(9, 'H'), c(3, 'S')), 'S')).toBe(3);
    expect(trickWinner(trick(c(1, 'H'), c(2, 'D'), c(9, 'H'), c(3, 'C')), 'S')).toBe(0); // no trump played
  });

  it('makes you follow suit when you can', () => {
    const hand = [c(2, 'H'), c(5, 'S'), c(9, 'H')];
    expect(followSuit(hand, [])).toEqual(hand);
    expect(followSuit(hand, trick(c(3, 'H')))).toEqual([c(2, 'H'), c(9, 'H')]);
    expect(followSuit(hand, trick(c(3, 'D')))).toEqual(hand);
  });

  it('sorts a hand by suit, alternating colors, low to high', () => {
    expect(sortHand([c(1, 'H'), c(2, 'C'), c(13, 'S'), c(3, 'H'), c(10, 'D')])).toEqual([
      c(2, 'C'),
      c(10, 'D'),
      c(13, 'S'),
      c(3, 'H'),
      c(1, 'H'),
    ]);
  });

  it('deals four hands of 13', () => {
    const hands = dealFour(newDeck());
    expect(hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(hands.flat().map((x) => `${x.rank}${x.suit}`)).size).toBe(52);
  });
});

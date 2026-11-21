import { describe, expect, it } from 'vitest';
import { newDeck, type Card, type Suit } from './cards';
import { dealFour, followSuit, highRank, nextSeat, sortHand, theCard, trickText, trickWinner, type Play, type Seat } from './tricks';

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

describe('trick text', () => {
  const play = (seat: Seat, suit: Suit, rank: number): Play => ({ seat, card: { suit, rank } });
  it('names the lead and the winner, with "you" lower case mid-sentence', () => {
    expect(theCard({ suit: 'S', rank: 1 })).toBe('the ace of spades');
    expect(theCard({ suit: 'H', rank: 9 })).toBe('the 9 of hearts');
    const t = [play(1, 'S', 13), play(2, 'S', 12), play(3, 'S', 1), play(0, 'S', 10)];
    expect(trickText(t, 3)).toBe('West led the king of spades; East won with the ace of spades.');
    expect(trickText(t, 0, ', taking 2 points')).toBe('West led the king of spades; you won with the 10 of spades, taking 2 points.');
    expect(trickText([play(0, 'H', 1), play(1, 'H', 2)], 0)).toBe('You led the ace of hearts and won.');
  });
});

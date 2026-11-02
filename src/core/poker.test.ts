import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './cards';
import { bestHand, describeHand, rankFive } from './poker';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
const cards = (ids: string): Card[] => ids.split(' ').map((id) => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) }));
const rank = (ids: string) => rankFive(cards(ids));

describe('poker hands', () => {
  it('names every category', () => {
    expect(describeHand(rank('10H JH QH KH AH'))).toBe('Royal flush');
    expect(describeHand(rank('5S 6S 7S 8S 9S'))).toBe('Straight flush to the nine');
    expect(describeHand(rank('7S 7H 7D 7C 2S'))).toBe('Four sevens');
    expect(describeHand(rank('KS KH KD 5C 5S'))).toBe('Full house, kings over fives');
    expect(describeHand(rank('2H 9H JH 4H 6H'))).toBe('Flush, jack high');
    expect(describeHand(rank('AS 2H 3D 4C 5S'))).toBe('Straight to the five');
    expect(describeHand(rank('6S 6H 6D KC 2S'))).toBe('Three sixes');
    expect(describeHand(rank('JS JH 4D 4C 9S'))).toBe('Two pair, jacks and fours');
    expect(describeHand(rank('AS AH 4D 8C 9S'))).toBe('Pair of aces');
    expect(describeHand(rank('AS 3H 4D 8C 9S'))).toBe('Ace high');
    expect(describeHand(rank('10S 3H 4D 8C 9S'))).toBe('Ten high');
  });

  it('orders hands, using kickers to break ties', () => {
    const order = ['AS KH 4D 8C 9S', 'AS AH 4D 8C 9S', 'JS JH 4D 4C 9S', '6S 6H 6D KC 2S', 'AS 2H 3D 4C 5S', '2S 3H 4D 5C 6S', 'AH KS QD JC 10S', '2H 9H JH 4H 6H', 'KS KH KD 5C 5S', '7S 7H 7D 7C 2S', '5S 6S 7S 8S 9S', '10H JH QH KH AH'];
    const scores = order.map((h) => rank(h).score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    expect(rank('AS AH KD 8C 9S').score).toBeGreaterThan(rank('AD AC QD 8H 9H').score);
    expect(rank('AS AH KD 8C 9S').score).toBe(rank('AD AC KH 8H 9D').score); // a tie
    expect(rank('KS KH 2D 2C 9S').score).toBeGreaterThan(rank('QS QH JD JC AS').score);
    expect(rank('AS 2H 3D 4C 5S').score).toBeLessThan(rank('2S 3H 4D 5C 6S').score); // the wheel is the lowest straight
  });

  it('finds the best five of seven', () => {
    const h = bestHand(cards('2S 7H 7D 9C 7S KH KS'));
    expect(h.category).toBe('fullHouse');
    expect(h.kickers).toEqual([7, 13]);
    expect(h.cards).toHaveLength(5);
    expect(bestHand(cards('AH 2H 9H 3H 4D 5H 6S')).category).toBe('flush');
  });
});

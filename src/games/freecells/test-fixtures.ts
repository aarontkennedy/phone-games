import type { Card, Suit } from '../../core/cards';
import type { State } from './logic';

export const upTo = (suit: Suit, rank: number): Card[] => Array.from({ length: rank }, (_, i) => ({ suit, rank: i + 1 }));

/** Everything up except the kings of clubs and diamonds, which sit in columns 0 and 1. */
export function nearlyWon(): State {
  return {
    cells: [null, null, null, null],
    foundations: [upTo('S', 13), upTo('H', 13), upTo('D', 12), upTo('C', 12)],
    columns: [[{ suit: 'C', rank: 13 }], [{ suit: 'D', rank: 13 }], [], [], [], [], [], []],
    moves: 0,
    elapsed: 0,
    won: false,
  };
}

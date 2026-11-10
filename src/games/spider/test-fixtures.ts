import type { Card, Suit } from '../../core/cards';
import type { State } from './logic';

/** One suit, everything finished except a King-to-2 run in column 0 and the ace in column 1. */
export function oneMoveFromWinning(): State {
  const king2 = Array.from({ length: 12 }, (_, i): Card => ({ suit: 'S', rank: 13 - i }));
  const tableau = Array.from({ length: 10 }, (_, i) => ({ down: [], up: i === 0 ? king2 : i === 1 ? [{ suit: 'S' as Suit, rank: 1 }] : [] }));
  return { suits: 1, stock: [], tableau, done: ['S', 'S', 'S', 'S', 'S', 'S', 'S'], moves: 5, elapsed: 0, won: false };
}

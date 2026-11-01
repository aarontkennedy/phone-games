import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { chooseMove, count, isValidState, legalMoves, move, newGame, newRound, type State } from './logic';

describe('Reversi, many whole rounds', () => {
  // Easy only: Strong's search is slow here, and its own tests cover it.
  it('always ends when neither side can move, and more discs wins', () => {
    simulate<State>({
      games: 100,
      maxSteps: 64,
      start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame('easy')),
      step: (s, rng) => move(s, s.turn === 0 ? pick(legalMoves(s.board, 0), rng) : chooseMove({ ...s, level: 'easy' }, rng)),
      isOver: (s) => s.result !== null,
      isValid: isValidState,
      check: (prev, next) => {
        expect(count(next.board, 0) + count(next.board, 1)).toBe(count(prev.board, 0) + count(prev.board, 1) + 1);
      },
      end: (s) => {
        expect([legalMoves(s.board, 0), legalMoves(s.board, 1)]).toEqual([[], []]);
        const [you, computer] = [count(s.board, 0), count(s.board, 1)];
        expect(s.result).toBe(you > computer ? 0 : computer > you ? 1 : 'draw');
      },
    });
  }, 60_000);
});

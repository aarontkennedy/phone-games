import { describe, expect, it } from 'vitest';
import { simulate } from '../../test/simulate';
import { DRAW_AFTER, chooseMove, isValidState, legalMoves, move, newGame, type State } from './logic';

describe('Checkers, many whole rounds', () => {
  it('always ends: the loser can’t move, or 50 quiet moves each is a draw', () => {
    simulate<State>({
      games: 60,
      maxSteps: 2000,
      start: () => newGame('easy'),
      // Easy against Easy, with the occasional Strong side.
      step: (s, rng) => move(s, chooseMove({ ...s, level: s.turn === 1 && rng() < 0.1 ? 'strong' : 'easy' }, rng)),
      isOver: (s) => s.result !== null,
      isValid: isValidState,
      check: (prev, next) => {
        const pieces = (st: State) => st.board.filter(Boolean).length;
        expect(pieces(next)).toBeLessThanOrEqual(pieces(prev)); // pieces are only ever taken
      },
      end: (s) => {
        if (s.result === 'draw') expect(s.quiet).toBeGreaterThanOrEqual(DRAW_AFTER);
        else expect(legalMoves(s.board, s.result === 0 ? 1 : 0)).toEqual([]);
      },
    });
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { COLS, chooseColumn, drop, isValidState, landingRow, lineThrough, newGame, newRound, type State } from './logic';

describe('Four in a Row, many whole rounds', () => {
  it('always ends with a real line of four, or a full board', () => {
    simulate<State>({
      games: 300,
      maxSteps: 42,
      start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame(i % 20 === 0 ? 'strong' : 'easy')),
      step: (s, rng) => {
        const open = Array.from({ length: COLS }, (_, c) => c).filter((c) => landingRow(s.board, c) !== -1);
        return drop(s, s.turn === 0 ? pick(open, rng) : chooseColumn(s, rng));
      },
      isOver: (s) => s.result !== null,
      isValid: isValidState,
      end: (s) => {
        if (s.result === 'draw') expect(s.board.every((c) => c !== null)).toBe(true);
        else {
          expect(s.line!.length).toBeGreaterThanOrEqual(4);
          expect(s.line!.every((i) => s.board[i] === s.result)).toBe(true);
          expect(lineThrough(s.board, s.last!)).not.toBeNull();
        }
      },
    });
  }, 60_000);
});

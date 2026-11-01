import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { DIRECTIONS, applyMove, canMove, isValidState, newState, type State } from './logic';

const sum = (b: number[]) => b.reduce((a, x) => a + x, 0);

describe('2048, many whole games', () => {
  it('each move adds one 2 or 4, scores only merges, and the game ends when stuck', () => {
    simulate<State>({
      games: 300,
      maxSteps: 3000,
      start: (rng) => newState(rng),
      step: (s, rng) => {
        const st = s.won && !s.keepPlaying ? { ...s, keepPlaying: true } : s;
        const moves = DIRECTIONS.map((d) => applyMove(st, d, rng)).filter((t) => t !== null);
        return moves.length ? pick(moves, rng).state : null;
      },
      isOver: (s) => s.over,
      isValid: isValidState,
      check: (prev, next) => {
        expect([2, 4]).toContain(sum(next.board) - sum(prev.board));
        const gained = next.score - prev.score;
        expect(gained % 4 === 0 || gained === 0).toBe(true); // merges make 4, 8, 16, ...
      },
      end: (s) => expect(canMove(s.board)).toBe(false),
    });
  }, 60_000);
});

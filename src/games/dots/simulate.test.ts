import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { chooseLine, count, isValidState, move, newGame, newRound, type State } from './logic';

describe('Dots and Boxes, many whole rounds', () => {
  it('every round fills all 16 boxes, boxes are never lost, and more boxes wins', () => {
    simulate<State>({
      games: 300,
      maxSteps: 40,
      start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame(i % 4 === 0 ? 'strong' : 'easy')),
      step: (s, rng) => move(s, s.turn === 0 ? pick(s.lines.flatMap((on, l) => (on ? [] : [l])), rng) : chooseLine(s, rng)),
      isOver: (s) => s.result !== null,
      isValid: isValidState,
      check: (prev, next) => {
        for (const side of [0, 1] as const) expect(count(next, side)).toBeGreaterThanOrEqual(count(prev, side));
        const closed = count(next, 0) + count(next, 1) - count(prev, 0) - count(prev, 1);
        expect(next.turn === prev.turn).toBe(closed > 0 || next.result !== null);
      },
      end: (s) => {
        const [you, them] = [count(s, 0), count(s, 1)];
        expect(you + them).toBe(16);
        expect(s.result).toBe(you > them ? 0 : them > you ? 1 : 'draw');
      },
    });
  }, 60_000);
});

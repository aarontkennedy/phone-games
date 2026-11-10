import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { mount } from './index';
import { DIRECTIONS, applyMove, canMove, isValidState, newState, type State } from './logic';

const sum = (b: number[]) => b.reduce((a, x) => a + x, 0);

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 3000,
  start: (rng) => newState(rng),
  step: (s, rng) => {
    const st = s.won && !s.keepPlaying ? { ...s, keepPlaying: true } : s;
    const moves = DIRECTIONS.map((d) => applyMove(st, d, rng)).filter((t) => t !== null);
    return moves.length ? pick(moves, rng).state : null;
  },
  isOver: (s) => s.over,
};

describe('2048, many whole games', () => {
  it('each move adds one 2 or 4, scores only merges, and the game ends when stuck', () => {
    simulate<State>({
      ...wholeGame,
      games: 300,
      isValid: isValidState,
      check: (prev, next) => {
        expect([2, 4]).toContain(sum(next.board) - sum(prev.board));
        const gained = next.score - prev.score;
        expect(gained % 4 === 0 || gained === 0).toBe(true); // merges make 4, 8, 16, ...
      },
      end: (s) => expect(canMove(s.board)).toBe(false),
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: '2048',
      mount,
      isValid: isValidState,
      steps: 100,
      // Finished games (reopening one must not let the computer play on), and nearly finished ones.
      starts: [...nearlyFinished({ ...wholeGame, games: 2 }, 0), ...nearlyFinished({ ...wholeGame, games: 2 }, 3)],
      stepsFromStart: 25,
      isOver: wholeGame.isOver,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

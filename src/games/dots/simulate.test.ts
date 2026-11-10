import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { chooseLine, count, isValidState, move, newGame, newRound, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 40,
  start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame(i % 4 === 0 ? 'strong' : 'easy')),
  step: (s, rng) => move(s, s.turn === 0 ? pick(s.lines.flatMap((on, l) => (on ? [] : [l])), rng) : chooseLine(s, rng)),
  isOver: (s) => s.result !== null,
};

describe('Dots and Boxes, many whole rounds', () => {
  it('every round fills all 16 boxes, boxes are never lost, and more boxes wins', () => {
    simulate<State>({
      ...wholeGame,
      games: 300,
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
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 40,
      maxSteps: 100,
      start: (_rng, i) => (i % 4 >= 2 ? newRound(newGame()) : newGame()),
      step: (s, rng, strong) => move(s, chooseLine({ ...s, level: levelFor(s.turn === strong) }, rng)),
      isOver: (s) => s.result !== null,
      score: (s, strong) => (s.result === 'draw' ? 0.5 : s.result === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.75);
  });

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'dots',
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

import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { mount } from './index';
import { LEVELS, isFinished, isValidState, newState, open, toggleFlag, type Level, type State } from './logic';

const levels = Object.keys(LEVELS) as Level[];

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 400,
  start: (_rng, i) => newState(levels[i % levels.length]),
  step: (s, rng) => {
    const n: State = JSON.parse(JSON.stringify(s));
    const hidden = n.revealed.flatMap((r, i) => (r ? [] : [i]));
    const i = pick(hidden, rng);
    if (n.mines && rng() < 0.1) toggleFlag(n, i);
    else {
      if (n.flagged[i]) toggleFlag(n, i);
      open(n, i, rng);
    }
    return n;
  },
  isOver: isFinished,
};

describe('Mines, many whole games', () => {
  it('the first dig is always safe; a win opens every safe square, a loss hits a mine', () => {
    simulate<State>({
      ...wholeGame,
      games: 1500,
      isValid: isValidState,
      check: (prev, next) => {
        if (!prev.mines) expect(next.status).not.toBe('lost');
        expect(next.revealed.filter(Boolean).length).toBeGreaterThanOrEqual(prev.revealed.filter(Boolean).length);
      },
      end: (s) => {
        const safe = s.mines!.flatMap((m, i) => (m ? [] : [i]));
        if (s.status === 'won') expect(safe.every((i) => s.revealed[i])).toBe(true);
        else expect(s.mines![s.exploded]).toBe(true);
      },
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'minesweeper',
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

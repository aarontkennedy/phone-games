import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { mount } from './index';
import { LETTERS, MAX_MISSES, guess, isValidState, misses, newGame, newRound, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 26,
  start: (rng, i) => (i % 2 ? newRound(newGame(rng), rng) : newGame(rng)),
  step: (s, rng) => guess(s, pick(LETTERS.filter((l) => !s.guessed.includes(l)), rng)),
  isOver: (s) => s.result !== null,
};

describe('Hangman, many whole rounds', () => {
  it('every round ends in a win with all letters found, or a loss on the sixth miss', () => {
    simulate<State>({
      ...wholeGame,
      games: 1000,
      isValid: isValidState,
      end: (s) => {
        const found = [...s.word].every((l) => s.guessed.includes(l));
        if (s.result === 'won') expect([found, misses(s).length < MAX_MISSES]).toEqual([true, true]);
        else expect([found, misses(s).length]).toEqual([false, MAX_MISSES]);
        expect(s.stats.played).toBe(1);
      },
    });
  });

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'hangman',
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

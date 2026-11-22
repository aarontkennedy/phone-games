import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { simulate } from '../../test/simulate';
import { mount } from './index';
import { countSolutions, hint, isValidState, isWon, newPuzzle, runs, type State } from './logic';

describe('Cross Sums, many puzzles', () => {
  it('every puzzle has exactly one answer, and Hint alone solves it', () => {
    simulate<State>({
      games: 30,
      maxSteps: 30,
      start: (rng) => {
        const s = newPuzzle(0, rng);
        expect(countSolutions(s.white, runs(s))).toBe(1);
        return s;
      },
      step: (s) => hint(s),
      isOver: isWon,
      isValid: isValidState,
      end: (s) => expect(isWon(s)).toBe(true),
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a solved puzzle stays solved', () => {
    const done = (() => {
      let s = newPuzzle();
      while (!isWon(s)) s = hint(s)!;
      return s;
    })();
    const { finishedSteps } = stressScreen({ id: 'crosssums', mount, isValid: isValidState, steps: 150, starts: [done], stepsFromStart: 20, isOver: isWon });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

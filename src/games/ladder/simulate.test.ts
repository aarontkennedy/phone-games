import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { simulate } from '../../test/simulate';
import { mount } from './index';
import { hint, isValidState, newPuzzle, oneApart, step, steps, type State } from './logic';

describe('Word Ladder, many puzzles', () => {
  it('every puzzle can be solved by following Hint, in exactly par steps', () => {
    simulate<State>({
      games: 150,
      maxSteps: 10,
      start: (rng) => newPuzzle(rng),
      step: (s) => step(s, hint(s)!),
      isOver: (s) => s.won,
      isValid: isValidState,
      check: (prev, next) => expect(oneApart(prev.path.at(-1)!, next.path.at(-1)!)).toBe(true),
      end: (s) => {
        expect(s.won).toBe(true);
        expect(steps(s)).toBe(s.par);
      },
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a solved puzzle stays solved', () => {
    const { finishedSteps } = stressScreen({
      id: 'ladder',
      mount,
      isValid: isValidState,
      steps: 150,
      // A solved puzzle (random taps rarely solve one), and one a tap or two from solved.
      starts: [{ start: 'cold', target: 'cord', path: ['cold', 'cord'], par: 1, won: true }, { start: 'cold', target: 'cord', path: ['cold'], par: 1, won: false }],
      stepsFromStart: 40,
      isOver: (s: State) => s.won,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

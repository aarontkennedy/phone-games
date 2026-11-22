import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { allWords, enter, finish, isValidState, newRound, pathFor, points, type State } from './logic';

describe('Word Grid, many rounds', () => {
  it('every word the grid holds can be spelled and scores its points', () => {
    simulate<State>({
      games: 40,
      maxSteps: 1000,
      start: (rng) => newRound(0, rng),
      step: (s, rng) => {
        const left = allWords(s.grid).filter((w) => !s.found.includes(w));
        if (!left.length || rng() < 0.05) return finish(s);
        const w = pick(left, rng);
        return enter(s, pathFor(s.grid, w)!);
      },
      isOver: (s) => s.done,
      isValid: isValidState,
      check: (prev, next) => {
        if (next.found.length > prev.found.length) expect(next.score).toBe(prev.score + points(next.found.at(-1)!));
      },
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished round stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'wordgrid',
      mount,
      isValid: isValidState,
      steps: 150,
      starts: [{ grid: [...'catsodergineyxzq'], found: [], score: 0, done: true, best: 0 }],
      stepsFromStart: 20,
      isOver: (s: State) => s.done,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

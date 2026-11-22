import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { CENTER, SIDE, hint, isOver, isValidState, legalJumps, newGame, pegsLeft, play, type State } from './logic';

describe('Peg Solitaire, many games', () => {
  it('plays legal games to the end, and Hint answers quickly from any position', () => {
    let slowest = 0;
    simulate<State>({
      games: 60,
      maxSteps: 40,
      start: () => newGame(),
      step: (s, rng) => {
        // Now and then ask for a hint, as a player would, and time it.
        if (rng() < 0.2) {
          const t = performance.now();
          const tip = hint(s);
          slowest = Math.max(slowest, performance.now() - t);
          if (typeof tip !== 'string') return play(s, tip);
        }
        return play(s, pick(legalJumps(s), rng));
      },
      isOver,
      isValid: isValidState,
      check: (prev, next) => expect(pegsLeft(next)).toBe(pegsLeft(prev) - 1),
    });
    expect(slowest).toBeLessThan(2000); // and far less on most positions
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const won: State = { pegs: Array.from({ length: SIDE * SIDE }, (_, i) => i === CENTER), picked: null, moves: 31 };
    const { finishedSteps } = stressScreen({ id: 'pegs', mount, isValid: isValidState, steps: 150, starts: [won], stepsFromStart: 20, isOver });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

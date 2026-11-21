import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { bestDice, bestShut, canRollOne, isValidState, newRound, roll, score, shut, shutOptions, type State } from './logic';

type Play = State & { rounds: number; total: number; boxes: number };

/** Plays many rounds, perfectly or at random, and returns the average score and how often the box was shut. */
function play(perfect: boolean, rounds: number) {
  const [done] = simulate<Play>({
    games: 1,
    seed: perfect ? 11 : 12,
    maxSteps: rounds * 20,
    start: () => ({ ...newRound(), rounds: 0, total: 0, boxes: 0 }),
    step: (s, rng) => {
      const keep = { rounds: s.rounds, total: s.total, boxes: s.boxes };
      if (s.phase === 'over') {
        const sc = score(s);
        return { ...newRound(), rounds: s.rounds + 1, total: s.total + sc, boxes: s.boxes + (sc === 0 ? 1 : 0) };
      }
      if (s.phase === 'roll') {
        const dice = perfect ? bestDice(s) : canRollOne(s) && rng() < 0.5 ? 1 : 2;
        return { ...roll(s, dice, rng)!, ...keep };
      }
      const tiles = perfect ? bestShut(s) : pick(shutOptions(s), rng);
      return { ...shut(s, tiles)!, ...keep };
    },
    isOver: (s) => s.rounds >= rounds,
    isValid: isValidState,
    check: (prev, next) => {
      if (prev.phase === 'choose') expect(score(next)).toBeLessThan(score(prev)); // shutting always lowers the score
      if (next.phase === 'choose') expect(shutOptions(next).length).toBeGreaterThan(0); // only rolls you can use ask you to choose
    },
  });
  return { average: done.total / rounds, shutRate: done.boxes / rounds };
}

describe('Shut the Box, many rounds', () => {
  it('plays legal rounds, and perfect play beats random play by a wide margin', () => {
    const perfect = play(true, 4000);
    const random = play(false, 4000);
    // Perfect play averages a little under 10 and shuts the box about 1 round in 10.
    expect(perfect.average).toBeGreaterThan(8);
    expect(perfect.average).toBeLessThan(12);
    expect(perfect.shutRate).toBeGreaterThan(0.06);
    expect(random.average).toBeGreaterThan(perfect.average + 3);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished round stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'shutbox',
      mount,
      isValid: isValidState,
      steps: 100,
      starts: [{ phase: 'choose', open: [true, false, false, false, false, false, false, false, false], dice: [1] }],
      stepsFromStart: 25,
      isOver: (s: State) => s.phase === 'over',
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

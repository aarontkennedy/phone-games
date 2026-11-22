import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { simulate } from '../../test/simulate';
import { mount } from './index';
import { best, chooseComputer, endBust, hold, isValidState, newGame, roll, type State } from './logic';

/** Plays whole games: seat 0 plays the best play, seat 1 is Easy (or the best play too). */
function play(games: number, againstBest: boolean) {
  let firstWins = 0;
  simulate<State>({
    games,
    maxSteps: 5000,
    start: () => newGame(),
    step: (s, rng) => {
      if (s.bust) return endBust(s);
      const move = s.turn === 0 || againstBest ? best(s) : chooseComputer({ ...s, level: 'easy' }, rng);
      return move === 'hold' ? hold(s) : roll(s, rng);
    },
    isOver: (s) => s.winner !== null,
    isValid: isValidState,
    check: (prev, next) => {
      if (next.turn !== prev.turn) expect(next.turnPoints).toBe(0);
      expect(next.scores[0] + next.scores[1]).toBeGreaterThanOrEqual(prev.scores[0] + prev.scores[1]);
    },
    end: (s) => {
      if (s.winner === 0) firstWins++;
    },
  });
  return firstWins / games;
}

describe('Pig, many games', () => {
  it('the best play beats Easy, and going first is worth about 53% between best players', () => {
    expect(play(600, false)).toBeGreaterThan(0.6);
    const even = play(1500, true);
    expect(even).toBeGreaterThan(0.48);
    expect(even).toBeLessThan(0.58);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const won: State = { ...newGame(), scores: [100, 40], winner: 0 };
    const { finishedSteps } = stressScreen({ id: 'pig', mount, isValid: isValidState, steps: 150, starts: [won], stepsFromStart: 20, isOver: (s: State) => s.winner !== null });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

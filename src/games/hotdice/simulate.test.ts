import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { canScore, computerStep, GOAL, isValidState, newGame, winner, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 20000,
  start: (_rng, i) => newGame(i % 2 ? 'easy' : 'strong'),
  step: (s, rng) => computerStep({ ...s, level: s.turn === 0 ? 'easy' : s.level }, rng),
  isOver: (s) => s.phase === 'gameOver',
};

describe('Hot Dice, many whole games', () => {
  it('always finishes; banked points are what was kept, and a bust scores nothing', () => {
    simulate<State>({
      ...wholeGame,
      games: 300,
      isValid: isValidState,
      check: (prev, next) => {
        for (const p of [0, 1]) expect(next.scores[p]).toBeGreaterThanOrEqual(prev.scores[p]);
        const gained = next.turnPoints - prev.turnPoints;
        if (prev.phase === 'choose' && gained > 0) {
          expect(gained % 50).toBe(0); // every scoring combination is a multiple of 50
          expect(canScore(prev.dice)).toBe(true); // only a roll with something to keep
        }
        if (prev.phase === 'bust') expect(next.scores).toEqual(prev.scores);
        const banked = next.scores[prev.turn] - prev.scores[prev.turn];
        if (banked) expect(banked).toBe(prev.turnPoints);
      },
      end: (s) => expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GOAL),
    });
  }, 60_000);
  it('Strong beats Easy (it’s mostly luck, so by less)', () => {
    const share = strongShare<State>({
      games: 200,
      maxSteps: 20000,
      start: () => newGame(),
      step: (s, rng, strong) => computerStep({ ...s, level: levelFor(s.turn === strong) }, rng),
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.55);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'hotdice',
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

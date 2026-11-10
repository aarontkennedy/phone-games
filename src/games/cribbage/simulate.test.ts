import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { chooseCard, chooseDiscard, discard, GAME_POINTS, isValidState, legalPlays, newGame, nextStep, play, winner, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 3000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  step: (s, rng) => {
    if (s.phase === 'discard') return discard(s, chooseDiscard(s, 0, rng), rng);
    if (s.phase === 'show') return nextStep(s, rng);
    const p = s.turn;
    return play(s, p, p === 0 ? pick(legalPlays(s, 0), rng) : chooseCard(s, p, rng));
  },
  isOver: (s) => s.phase === 'gameOver',
};

describe('Cribbage, many whole games', () => {
  it('always finishes at 121, scores only climb, and the back pegs trail correctly', () => {
    simulate<State>({
      ...wholeGame,
      games: 40,
      isValid: isValidState,
      check: (prev, next) => {
        for (const p of [0, 1]) {
          expect(next.scores[p]).toBeGreaterThanOrEqual(prev.scores[p]);
          expect(next.scores[p]).toBeLessThanOrEqual(GAME_POINTS);
          expect(next.back![p]).toBeLessThanOrEqual(next.scores[p]);
          // The back peg marks where the latest scoring started. One move can hold two
          // scorings (the last card's point, then the first hand of the show).
          if (next.scores[p] > prev.scores[p]) {
            expect(next.back![p], 'back peg').toBeGreaterThanOrEqual(prev.scores[p]);
            expect(next.back![p], 'back peg').toBeLessThan(next.scores[p]);
          }
        }
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBe(GAME_POINTS);
        expect(s.scores[1 - winner(s)!]).toBeLessThan(GAME_POINTS);
      },
    });
  }, 60_000);
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 40,
      maxSteps: 3000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => {
        // The computer's discard happens inside discard(), at the state's level.
        if (s.phase === 'discard') return discard({ ...s, level: levelFor(strong === 1) }, chooseDiscard({ ...s, level: levelFor(strong === 0) }, 0, rng), rng);
        if (s.phase === 'show') return nextStep(s, rng);
        return play(s, s.turn, chooseCard({ ...s, level: levelFor(s.turn === strong) }, s.turn, rng));
      },
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.75);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'cribbage',
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

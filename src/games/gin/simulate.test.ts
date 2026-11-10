import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { applyTurn, chooseTurn, GAME_POINTS, GIN_BONUS, isValidState, KNOCK_AT, newGame, nextHand, UNDERCUT_BONUS, winner, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 4000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  step: (s, rng) => (s.phase === 'handOver' ? nextHand(s, rng) : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng))),
  isOver: (s) => s.phase === 'gameOver',
};

describe('Gin Rummy, many whole games', () => {
  it('always finishes, and every knock, gin, undercut and draw scores by the rules', () => {
    simulate<State>({
      ...wholeGame,
      games: 30,
      isValid: isValidState,
      check: (prev, next) => {
        const ended = prev.phase !== 'handOver' && (next.phase === 'handOver' || next.phase === 'gameOver');
        if (!ended) {
          expect(next.scores).toEqual(prev.scores);
          return;
        }
        const r = next.last!;
        if (r.kind === 'draw') {
          expect(r.winner).toBeNull();
          expect(next.scores).toEqual(prev.scores);
          return;
        }
        const k = r.knocker!;
        const d = (1 - k) as 0 | 1;
        expect(r.deadwood[k]).toBeLessThanOrEqual(KNOCK_AT);
        if (r.kind === 'gin') expect([r.deadwood[k], r.winner, r.points]).toEqual([0, k, r.deadwood[d] + GIN_BONUS]);
        if (r.kind === 'knock') expect([r.winner, r.points]).toEqual([k, r.deadwood[d] - r.deadwood[k]]);
        if (r.kind === 'undercut') expect([r.winner, r.points]).toEqual([d, r.deadwood[k] - r.deadwood[d] + UNDERCUT_BONUS]);
        expect(next.scores[r.winner!]).toBe(prev.scores[r.winner!] + r.points);
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GAME_POINTS);
      },
    });
  }, 60_000);
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 40,
      maxSteps: 5000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => (s.phase === 'handOver' ? nextHand(s, rng) : applyTurn(s, s.turn, chooseTurn({ ...s, level: levelFor(s.turn === strong) }, s.turn, rng))),
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.75);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'gin',
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

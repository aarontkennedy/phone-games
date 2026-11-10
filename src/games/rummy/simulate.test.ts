import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { applyTurn, cardPoints, chooseTurn, GAME_POINTS, isValidState, meldPoints, newGame, nextHand, winner, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 20000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  step: (s, rng) => (s.phase === 'handOver' ? nextHand(s, rng) : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng))),
  isOver: (s) => s.phase === 'gameOver',
};

describe('Rummy 500, many whole games', () => {
  it('always finishes, every meld on the table is real, and hands score melded minus held', () => {
    simulate<State>({
      ...wholeGame,
      games: 30,
      isValid: isValidState,
      check: (prev, next) => {
        if (prev.phase === 'handOver') return;
        const ended = next.phase === 'handOver' || next.phase === 'gameOver';
        if (!ended) {
          expect(next.scores).toEqual(prev.scores);
          // Points melded so far match the table.
          expect(next.melded[0] + next.melded[1]).toBe(next.table.reduce((t, m) => t + meldPoints(m), 0));
          return;
        }
        const r = next.last!;
        for (const p of [0, 1] as const) {
          expect(r.held[p]).toBe(next.hands[p].reduce((t, c) => t + cardPoints(c), 0));
          expect(next.scores[p]).toBe(prev.scores[p] + r.melded[p] - r.held[p]);
        }
        expect(r.out === null ? next.stock.length : next.hands[r.out].length).toBe(0);
      },
      end: (s) => {
        expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(GAME_POINTS);
        expect(s.scores[winner(s)!]).toBe(Math.max(...s.scores));
      },
    });
  }, 60_000);
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 40,
      maxSteps: 20000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => (s.phase === 'handOver' ? nextHand(s, rng) : applyTurn(s, s.turn, chooseTurn({ ...s, level: levelFor(s.turn === strong) }, s.turn, rng))),
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.8);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'rummy',
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

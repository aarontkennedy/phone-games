import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { MAX_DRAW, START_CHIPS, applyTurn, chooseTurn, isValidState, newGame, nextHand, options, swap, winner, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 20000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  // Mostly random legal moves (odd spots: all-ins, side pots), and some real computer play.
  step: (s, rng) => {
    if (s.phase === 'handOver') return nextHand(s, rng);
    if (rng() < 0.1) return applyTurn(s, s.turn, chooseTurn(s, s.turn, rng));
    if (s.phase === 'drawing') return swap(s, s.turn, s.hands[s.turn].filter(() => rng() < 0.4).slice(0, MAX_DRAW));
    return applyTurn(s, s.turn, { action: pick(options(s, s.turn), rng) });
  },
  isOver: (s) => s.phase === 'gameOver',
};

describe('Five-card draw, many whole games', () => {
  it('always ends, never makes or loses chips, and pays every pot to an eligible player', () => {
    simulate<State>({
      ...wholeGame,
      games: 10,
      isValid: isValidState,
      check: (prev, next) => {
        expect(next.stacks.every((c) => c >= 0)).toBe(true);
        expect(next.hands.every((h) => h.length === 0 || h.length === 5)).toBe(true);
        if (prev.phase !== 'handOver' && (next.phase === 'handOver' || next.phase === 'gameOver')) {
          expect(next.pots!.reduce((t, p) => t + p.amount, 0)).toBe(next.put.reduce((a, b) => a + b, 0));
          for (const p of next.pots!) expect(p.winners.every((w) => p.eligible.includes(w))).toBe(true);
        }
      },
      end: (s) => {
        expect(s.stacks[0] === 0 || s.stacks[0] === 4 * START_CHIPS).toBe(true);
        expect(s.stacks.reduce((a, b) => a + b, 0)).toBe(4 * START_CHIPS);
      },
    });
  }, 120_000);

  it('a Strong player wins more than its share against three Easy ones', () => {
    const share = strongShare<State>({
      games: 10,
      sides: 1, // you (seat 0) play Strong; the game ends when you win every chip or none
      maxSteps: 20000,
      start: (rng) => newGame('easy', rng),
      step: (s, rng) => (s.phase === 'handOver' ? nextHand(s, rng) : applyTurn(s, s.turn, chooseTurn({ ...s, level: levelFor(s.turn === 0) }, s.turn, rng))),
      isOver: (s) => s.phase === 'gameOver',
      score: (s) => (winner(s) ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.4); // an even share is 0.25
  }, 180_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'drawpoker',
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

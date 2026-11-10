import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { choosePit, isValidState, legalPits, move, newGame, newRound, PITS, SEEDS, STORE, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 400,
  start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame(i % 40 === 0 ? 'strong' : 'easy')),
  step: (s, rng) => move(s, s.turn === 0 ? pick(legalPits(s.board, 0), rng) : choosePit(s, rng)),
  isOver: (s) => s.result !== null,
};

describe('Mancala, many whole rounds', () => {
  it('always ends with every seed in a store, and the bigger store wins', () => {
    simulate<State>({
      ...wholeGame,
      games: 250,
      isValid: isValidState,
      check: (prev, next) => {
        expect(next.board.reduce((a, b) => a + b, 0)).toBe(2 * PITS * SEEDS);
        for (const side of [0, 1] as const) expect(next.board[STORE[side]]).toBeGreaterThanOrEqual(prev.board[STORE[side]]);
      },
      end: (s) => {
        const [you, them] = [s.board[STORE[0]], s.board[STORE[1]]];
        expect(you + them).toBe(2 * PITS * SEEDS);
        expect(s.result).toBe(you > them ? 0 : them > you ? 1 : 'draw');
      },
    });
  }, 60_000);
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 16,
      maxSteps: 500,
      start: (_rng, i) => (i % 4 >= 2 ? newRound(newGame()) : newGame()),
      step: (s, rng, strong) => move(s, choosePit({ ...s, level: levelFor(s.turn === strong) }, rng)),
      isOver: (s) => s.result !== null,
      score: (s, strong) => (s.result === 'draw' ? 0.5 : s.result === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.8);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'mancala',
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

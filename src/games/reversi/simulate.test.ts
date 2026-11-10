import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { chooseMove, count, isValidState, legalMoves, move, newGame, newRound, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 64,
  start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame('easy')),
  step: (s, rng) => move(s, s.turn === 0 ? pick(legalMoves(s.board, 0), rng) : chooseMove({ ...s, level: 'easy' }, rng)),
  isOver: (s) => s.result !== null,
};

describe('Reversi, many whole rounds', () => {
  // Easy only: Strong's search is slow here, and its own tests cover it.
  it('always ends when neither side can move, and more discs wins', () => {
    simulate<State>({
      ...wholeGame,
      games: 100,
      isValid: isValidState,
      check: (prev, next) => {
        expect(count(next.board, 0) + count(next.board, 1)).toBe(count(prev.board, 0) + count(prev.board, 1) + 1);
      },
      end: (s) => {
        expect([legalMoves(s.board, 0), legalMoves(s.board, 1)]).toEqual([[], []]);
        const [you, computer] = [count(s.board, 0), count(s.board, 1)];
        expect(s.result).toBe(you > computer ? 0 : computer > you ? 1 : 'draw');
      },
    });
  }, 60_000);
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 10,
      maxSteps: 200,
      start: (_rng, i) => (i % 4 >= 2 ? newRound(newGame()) : newGame()),
      step: (s, rng, strong) => move(s, chooseMove({ ...s, level: levelFor(s.turn === strong) }, rng)),
      isOver: (s) => s.result !== null,
      score: (s, strong) => ((s.result as unknown) === 'draw' ? 0.5 : s.result === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.7);
  }, 120_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'reversi',
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

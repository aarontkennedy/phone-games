import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { chooseColumn, COLS, drop, isValidState, landingRow, lineThrough, newGame, newRound, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 42,
  start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame(i % 20 === 0 ? 'strong' : 'easy')),
  step: (s, rng) => {
    const open = Array.from({ length: COLS }, (_, c) => c).filter((c) => landingRow(s.board, c) !== -1);
    return drop(s, s.turn === 0 ? pick(open, rng) : chooseColumn(s, rng));
  },
  isOver: (s) => s.result !== null,
};

describe('Four in a Row, many whole rounds', () => {
  it('always ends with a real line of four, or a full board', () => {
    simulate<State>({
      ...wholeGame,
      games: 300,
      isValid: isValidState,
      end: (s) => {
        if (s.result === 'draw') expect(s.board.every((c) => c !== null)).toBe(true);
        else {
          expect(s.line!.length).toBeGreaterThanOrEqual(4);
          expect(s.line!.every((i) => s.board[i] === s.result)).toBe(true);
          expect(lineThrough(s.board, s.last!)).not.toBeNull();
        }
      },
    });
  }, 60_000);
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 20,
      maxSteps: 50,
      start: (_rng, i) => (i % 4 >= 2 ? newRound(newGame()) : newGame()),
      step: (s, rng, strong) => drop(s, chooseColumn({ ...s, level: levelFor(s.turn === strong) }, rng)),
      isOver: (s) => s.result !== null,
      score: (s, strong) => (s.result === 'draw' ? 0.5 : s.result === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.8);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'fourinarow',
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

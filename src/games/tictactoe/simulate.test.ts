import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { mount } from './index';
import { chooseMove, isValidState, move, newGame, newRound, winningLine, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 9,
  start: (_rng, i) => {
    const s = { ...newGame(i % 2 ? 'easy' : 'strong') };
    return i % 4 >= 2 ? newRound(s) : s; // half the rounds, the computer starts
  },
  // X plays at random; O is the computer.
  step: (s, rng) => move(s, s.turn === 'X' ? pick(s.board.flatMap((c, i) => (c ? [] : [i])), rng) : chooseMove(s, rng)),
  isOver: (s) => s.result !== null,
};

describe('Tic-Tac-Toe, many whole rounds', () => {
  it('always ends in a correct win or draw, and Strong never loses', () => {
    const rounds = simulate<State>({
      ...wholeGame,
      games: 2000,
      isValid: isValidState,
      end: (s) => {
        const line = winningLine(s.board);
        if (s.result === 'draw') expect([line, s.board.every(Boolean)]).toEqual([null, true]);
        else expect(s.board[line![0]]).toBe(s.result);
        expect(s.tally.you + s.tally.computer + s.tally.draws).toBe(1);
      },
    });
    expect(rounds.filter((s) => s.level === 'strong' && s.result === 'X')).toEqual([]);
  });

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'tictactoe',
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

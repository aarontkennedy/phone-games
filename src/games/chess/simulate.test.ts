import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { chooseMove, DRAW_AFTER, inCheck, insufficient, isValidState, legalMoves, newGame, other, play, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 1500,
  start: (_rng, i) => newGame('easy', i % 2 ? 'w' : 'b'),
  // Easy against Easy, with the occasional Strong move.
  step: (s, rng) => play(s, chooseMove({ ...s, level: rng() < 0.05 ? 'strong' : 'easy' }, rng, 4000)),
  isOver: (s) => s.result !== null,
};

describe('Chess, many whole games', () => {
  it('always ends, with the result the rules say', () => {
    simulate<State>({
      ...wholeGame,
      games: 8,
      isValid: isValidState,
      check: (prev, next) => {
        expect(next.board.filter(Boolean).length).toBeLessThanOrEqual(prev.board.filter(Boolean).length);
        expect(inCheck(next, prev.turn)).toBe(false); // never leaves your own king in check
      },
      end: (s) => {
        if (s.reason === 'checkmate') {
          expect(inCheck(s)).toBe(true);
          expect(s.result).toBe(other(s.turn));
        }
        if (s.reason === 'stalemate') expect(inCheck(s) || legalMoves(s).length > 0).toBe(false);
        if (s.reason === 'fifty') expect(s.halfmove).toBeGreaterThanOrEqual(DRAW_AFTER);
        if (s.reason === 'material') expect(insufficient(s.board)).toBe(true);
        if (s.reason === 'repetition') expect(s.keys.filter((k) => k === s.keys.at(-1)).length).toBeGreaterThanOrEqual(3);
      },
    });
  }, 60_000);
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 6,
      maxSteps: 600,
      start: () => newGame('strong'),
      step: (s, rng, strong) => play(s, chooseMove({ ...s, level: levelFor((s.turn === 'w' ? 0 : 1) === strong) }, rng, 8000)),
      isOver: (s) => s.result !== null || s.moves.length >= 400, // a very long game counts as a draw
      score: (s, strong) => (s.result === null || s.result === 'draw' ? 0.5 : (s.result === 'w' ? 0 : 1) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.8);
  }, 120_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'chess',
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

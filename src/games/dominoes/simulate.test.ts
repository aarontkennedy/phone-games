import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { applyTurn, chooseTurn, GAME_POINTS, isValidState, newGame, nextRound, pips, winner, type State } from './logic';

const handPips = (s: State, p: number) => pips(s.hands[p]);

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 3000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  step: (s, rng) => (s.phase === 'roundOver' ? nextRound(s, rng) : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng))),
  isOver: (s) => s.phase === 'gameOver',
};

describe('Dominoes, many whole games', () => {
  it('always finishes; going out or the lower pips in a blocked game wins the round', () => {
    simulate<State>({
      ...wholeGame,
      games: 120,
      isValid: isValidState,
      check: (prev, next) => {
        const ended = prev.phase === 'playing' && next.phase !== 'playing';
        if (!ended) {
          expect(next.scores).toEqual(prev.scores);
          return;
        }
        const r = next.last!;
        const [a, b] = [handPips(next, 0), handPips(next, 1)];
        if (!r.blocked) expect(next.hands[r.winner!]).toHaveLength(0);
        else if (a === b) expect(r.winner).toBeNull();
        else expect(r.winner).toBe(a < b ? 0 : 1);
        if (r.winner !== null) {
          expect(next.scores[r.winner]).toBe(prev.scores[r.winner] + r.points);
          expect(next.scores[1 - r.winner]).toBe(prev.scores[1 - r.winner]);
        }
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GAME_POINTS);
      },
    });
  }, 60_000);
  it('Strong beats Easy', () => {
    const share = strongShare<State>({
      games: 100,
      maxSteps: 5000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => (s.phase === 'roundOver' ? nextRound(s, rng) : applyTurn(s, s.turn, chooseTurn({ ...s, level: levelFor(s.turn === strong) }, s.turn, rng))),
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.6);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'dominoes',
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

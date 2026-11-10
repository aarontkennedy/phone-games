import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { applyTurn, cardPoints, chooseTurn, GAME_POINTS, isValidState, newGame, nextRound, winner, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 6000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  step: (s, rng) => (s.phase === 'roundOver' ? nextRound(s, rng) : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng), rng)),
  isOver: (s) => s.phase === 'gameOver',
};

describe('Crazy Eights, many whole games', () => {
  it('always finishes, and the round winner scores the cards left in the other hands', () => {
    simulate<State>({
      ...wholeGame,
      games: 60,
      isValid: isValidState,
      check: (prev, next) => {
        const ended = prev.phase === 'playing' && next.phase !== 'playing';
        if (!ended) {
          expect(next.scores).toEqual(prev.scores);
          return;
        }
        const { seat, points } = next.last!;
        const others = next.hands.flatMap((h, i) => (i === seat ? [] : h));
        expect(points).toBe(others.reduce((t, c) => t + cardPoints(c), 0));
        expect(next.scores[seat]).toBe(prev.scores[seat] + points);
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GAME_POINTS);
      },
    });
  }, 60_000);
  it('a Strong player wins more than its share against three Easy ones (it’s mostly luck)', () => {
    const share = strongShare<State>({
      games: 400,
      sides: 4, // the Strong seat moves round the table
      maxSteps: 6000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => (s.phase === 'roundOver' ? nextRound(s, rng) : applyTurn(s, s.turn, chooseTurn({ ...s, level: levelFor(s.turn === strong) }, s.turn, rng), rng)),
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.32); // an even share is 0.25
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'crazyeights',
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

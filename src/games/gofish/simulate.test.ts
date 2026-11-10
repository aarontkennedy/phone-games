import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { applyTurn, BOOKS, chooseTurn, isValidState, newGame, winners, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 2000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  step: (s, rng) => applyTurn(s, s.turn, chooseTurn(s, s.turn, rng)),
  isOver: (s) => s.phase === 'over',
};

describe('Go Fish, many whole games', () => {
  it('always finishes with all 13 books made, and only a miss passes the turn', () => {
    simulate<State>({
      ...wholeGame,
      games: 200,
      isValid: isValidState,
      check: (prev, next) => {
        const e = next.last!;
        expect(e.seat).toBe(prev.turn);
        const booked = next.books.flat().length - prev.books.flat().length;
        expect(booked).toBe(e.books.length);
        if (next.phase === 'over' || next.turn === prev.turn) return;
        // The turn moved on: a miss, a draw with no one to ask, or a player out of cards.
        const missed = e.kind === 'ask' ? !e.got && e.drew?.rank !== e.rank : prev.hands[prev.turn].length > 0;
        expect(missed || !next.hands[prev.turn].length).toBe(true);
      },
      end: (s) => {
        expect(s.books.flat()).toHaveLength(BOOKS);
        expect(s.hands.flat()).toEqual([]);
        expect(s.tally.played).toBe(1);
        expect(s.tally.won).toBe(winners(s).includes(0) ? 1 : 0);
      },
    });
  }, 60_000);
  it('a Strong player wins more than its share against three Easy ones', () => {
    const share = strongShare<State>({
      games: 100,
      sides: 4,
      maxSteps: 2000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => applyTurn(s, s.turn, chooseTurn({ ...s, level: levelFor(s.turn === strong) }, s.turn, rng)),
      isOver: (s) => s.phase === 'over',
      score: (s, strong) => (winners(s).includes(strong as 0 | 1 | 2 | 3) ? 1 / winners(s).length : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.5); // an even share is 0.25
  });

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'gofish',
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

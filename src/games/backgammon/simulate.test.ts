import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { CHECKERS, chooseTurn, isValidState, legalMoves, move, newGame, newRound, pips, roll, type State } from './logic';

describe('Backgammon, many whole games', () => {
  it('always ends with one side’s fifteen checkers off, and pips only shrink for the mover', () => {
    simulate<State>({
      games: 50,
      maxSteps: 3000,
      start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame(i % 10 === 0 ? 'strong' : 'easy')),
      step: (s, rng) => {
        if (!s.dice.length) return roll(s, rng);
        return move(s, s.turn === 0 ? pick(legalMoves(s), rng) : chooseTurn(s, rng)[0]);
      },
      isOver: (s) => s.result !== null,
      isValid: isValidState, // 15 checkers each, always
      check: (prev, next) => {
        if (prev.dice.length) expect(pips(next, prev.turn)).toBeLessThan(pips(prev, prev.turn));
      },
      end: (s) => {
        expect(s.off[s.result!]).toBe(CHECKERS);
        expect(s.off[s.result === 0 ? 1 : 0]).toBeLessThan(CHECKERS);
        expect(s.gammon).toBe(s.off[s.result === 0 ? 1 : 0] === 0);
      },
    });
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { PITS, SEEDS, STORE, choosePit, isValidState, legalPits, move, newGame, newRound, type State } from './logic';

describe('Mancala, many whole rounds', () => {
  it('always ends with every seed in a store, and the bigger store wins', () => {
    simulate<State>({
      games: 250,
      maxSteps: 400,
      start: (_rng, i) => (i % 2 ? newRound(newGame('easy')) : newGame(i % 40 === 0 ? 'strong' : 'easy')),
      step: (s, rng) => move(s, s.turn === 0 ? pick(legalPits(s.board, 0), rng) : choosePit(s, rng)),
      isOver: (s) => s.result !== null,
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
});

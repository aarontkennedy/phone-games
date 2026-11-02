import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { choosePit, isValidState, legalPits, move, newGame, newRound, PITS, SEEDS, STORE, type State } from './logic';

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
});

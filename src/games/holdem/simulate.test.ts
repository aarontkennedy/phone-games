import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { act, chooseAction, isValidState, newGame, nextHand, options, START_CHIPS, winner, type State } from './logic';

describe("Texas hold'em, many whole games", () => {
  it('always ends, never makes or loses chips, and pays every pot to an eligible player', () => {
    simulate<State>({
      games: 10,
      maxSteps: 20000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      // Mostly random legal moves, which reach odd spots (all-ins, side pots), and some real computer play.
      step: (s, rng) =>
        s.phase === 'handOver'
          ? nextHand(s, rng)
          : act(s, s.turn, rng() < 0.1 ? chooseAction(s, s.turn, rng) : pick(options(s, s.turn), rng)),
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        expect(next.stacks.every((c) => c >= 0)).toBe(true);
        if (prev.phase === 'betting' && next.phase !== 'betting') {
          const total = next.pots!.reduce((t, p) => t + p.amount, 0);
          expect(total).toBe(next.put.reduce((a, b) => a + b, 0)); // every chip bet goes to a pot
          for (const p of next.pots!) {
            expect(p.winners.length).toBeGreaterThan(0);
            expect(p.winners.every((w) => p.eligible.includes(w))).toBe(true);
          }
        }
      },
      end: (s) => {
        expect(s.stacks[0] === 0 || s.stacks[0] === 4 * START_CHIPS).toBe(true);
        expect(s.stacks.reduce((a, b) => a + b, 0)).toBe(4 * START_CHIPS);
      },
    });
  }, 60_000);
  it('a Strong player wins more than its share against three Easy ones', () => {
    const share = strongShare<State>({
      games: 10,
      sides: 1, // you (seat 0) play Strong; the game ends when you win every chip or none
      maxSteps: 20000,
      start: (rng) => newGame('easy', rng),
      step: (s, rng) => (s.phase === 'handOver' ? nextHand(s, rng) : act(s, s.turn, chooseAction({ ...s, level: levelFor(s.turn === 0) }, s.turn, rng))),
      isOver: (s) => s.phase === 'gameOver',
      score: (s) => (winner(s) ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.4); // an even share is 0.25
  }, 180_000);
});

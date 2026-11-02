import { describe, expect, it } from 'vitest';
import { simulate } from '../../test/simulate';
import { GAME_POINTS, applyTurn, cardPoints, chooseTurn, isValidState, meldPoints, newGame, nextHand, winner, type State } from './logic';

describe('Rummy 500, many whole games', () => {
  it('always finishes, every meld on the table is real, and hands score melded minus held', () => {
    simulate<State>({
      games: 30,
      maxSteps: 20000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => (s.phase === 'handOver' ? nextHand(s, rng) : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng))),
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        if (prev.phase === 'handOver') return;
        const ended = next.phase === 'handOver' || next.phase === 'gameOver';
        if (!ended) {
          expect(next.scores).toEqual(prev.scores);
          // Points melded so far match the table.
          expect(next.melded[0] + next.melded[1]).toBe(next.table.reduce((t, m) => t + meldPoints(m), 0));
          return;
        }
        const r = next.last!;
        for (const p of [0, 1] as const) {
          expect(r.held[p]).toBe(next.hands[p].reduce((t, c) => t + cardPoints(c), 0));
          expect(next.scores[p]).toBe(prev.scores[p] + r.melded[p] - r.held[p]);
        }
        expect(r.out === null ? next.stock.length : next.hands[r.out].length).toBe(0);
      },
      end: (s) => {
        expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(GAME_POINTS);
        expect(s.scores[winner(s)!]).toBe(Math.max(...s.scores));
      },
    });
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { GAME_POINTS, chooseCard, chooseDiscard, discard, isValidState, legalPlays, newGame, nextStep, play, winner, type State } from './logic';

describe('Cribbage, many whole games', () => {
  it('always finishes at 121, scores only climb, and the back pegs trail correctly', () => {
    simulate<State>({
      games: 40,
      maxSteps: 3000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => {
        if (s.phase === 'discard') return discard(s, chooseDiscard(s, 0, rng), rng);
        if (s.phase === 'show') return nextStep(s, rng);
        const p = s.turn;
        return play(s, p, p === 0 ? pick(legalPlays(s, 0), rng) : chooseCard(s, p, rng));
      },
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        for (const p of [0, 1]) {
          expect(next.scores[p]).toBeGreaterThanOrEqual(prev.scores[p]);
          expect(next.scores[p]).toBeLessThanOrEqual(GAME_POINTS);
          expect(next.back![p]).toBeLessThanOrEqual(next.scores[p]);
          // The back peg marks where the latest scoring started. One move can hold two
          // scorings (the last card's point, then the first hand of the show).
          if (next.scores[p] > prev.scores[p]) {
            expect(next.back![p], 'back peg').toBeGreaterThanOrEqual(prev.scores[p]);
            expect(next.back![p], 'back peg').toBeLessThan(next.scores[p]);
          }
        }
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBe(GAME_POINTS);
        expect(s.scores[1 - winner(s)!]).toBeLessThan(GAME_POINTS);
      },
    });
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { simulate } from '../../test/simulate';
import { GAME_POINTS, applyTurn, cardPoints, chooseTurn, isValidState, newGame, nextRound, winner, type State } from './logic';

describe('Crazy Eights, many whole games', () => {
  it('always finishes, and the round winner scores the cards left in the other hands', () => {
    simulate<State>({
      games: 60,
      maxSteps: 6000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => (s.phase === 'roundOver' ? nextRound(s, rng) : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng), rng)),
      isOver: (s) => s.phase === 'gameOver',
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
});

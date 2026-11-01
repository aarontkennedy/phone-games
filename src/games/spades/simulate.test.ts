import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { GAME_POINTS, bid, chooseBid, chooseCard, collect, isValidState, legalPlays, newGame, nextRound, play, winner, type State } from './logic';

describe('Spades, many whole games', () => {
  it('always finishes, 13 tricks a round, scores move by the round result', () => {
    simulate<State>({
      games: 40,
      maxSteps: 5000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => {
        if (s.phase === 'roundOver') return nextRound(s, rng);
        if (s.phase === 'bidding') return bid(s, s.turn, chooseBid(s, s.turn, rng));
        if (s.trick.length === 4) return collect(s);
        const seat = s.turn;
        return play(s, seat, seat === 0 ? pick(legalPlays(s, 0), rng) : chooseCard(s, seat, rng));
      },
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        if (prev.phase === 'playing' && next.phase !== 'playing') {
          expect(next.tricks.reduce((a, b) => a + b, 0)).toBe(13);
          expect(next.scores).toEqual([prev.scores[0] + next.last!.points[0], prev.scores[1] + next.last!.points[1]]);
        } else if (next.phase !== 'bidding' || prev.phase !== 'roundOver') {
          expect(next.scores).toEqual(prev.scores);
        }
      },
      end: (s) => {
        expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(GAME_POINTS);
        expect(s.scores[0]).not.toBe(s.scores[1]);
        expect(s.scores[winner(s)!]).toBe(Math.max(...s.scores));
      },
    });
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { GAME_POINTS, chooseCard, choosePass, collect, isValidState, legalPlays, newGame, nextRound, passCards, play, winners, type State } from './logic';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('Hearts, many whole games', () => {
  it('always finishes with 26 points a round, and the lowest score wins', () => {
    simulate<State>({
      games: 60,
      maxSteps: 3000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => {
        if (s.phase === 'passing') return passCards(s, choosePass(s, 0, rng), rng);
        if (s.phase === 'roundOver') return nextRound(s, rng);
        if (s.trick.length === 4) return collect(s);
        const seat = s.turn;
        // You play any legal card, to reach situations the computer wouldn't choose.
        const card = seat === 0 ? pick(legalPlays(s, 0), rng) : chooseCard(s, seat, rng);
        return play(s, seat, card);
      },
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        next.scores.forEach((score, seat) => expect(score, `seat ${seat} score`).toBeGreaterThanOrEqual(prev.scores[seat]));
        expect(sum(next.points)).toBeLessThanOrEqual(26);
        if (prev.phase === 'playing' && next.phase !== 'playing') {
          if (next.moon === null) expect(sum(next.lastRound)).toBe(26);
          else expect(next.lastRound.map((p, seat) => (seat === next.moon ? p : p - 26))).toEqual([0, 0, 0, 0]);
          next.lastRound.forEach((p, seat) => expect(next.scores[seat]).toBe(prev.scores[seat] + p));
        }
      },
      end: (s) => {
        expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(GAME_POINTS);
        const low = Math.min(...s.scores);
        expect(winners(s).every((seat) => s.scores[seat] === low)).toBe(true);
      },
    });
  }, 60_000);
});

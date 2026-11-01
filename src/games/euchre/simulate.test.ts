import { describe, expect, it } from 'vitest';
import { simulate } from '../../test/simulate';
import { GAME_POINTS, applyBid, chooseBid, chooseCard, chooseDiscard, collect, discard, isValidState, newGame, nextHand, play, playersIn, teamOf, winner, type State } from './logic';

describe('Euchre, many whole games', () => {
  it('always finishes, five tricks a hand, 1, 2 or 4 points to the right team', () => {
    simulate<State>({
      games: 150,
      maxSteps: 3000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => {
        if (s.phase === 'handOver') return nextHand(s, rng);
        if (s.phase === 'bidding1' || s.phase === 'bidding2') return applyBid(s, s.turn, chooseBid(s, s.turn, rng));
        if (s.phase === 'discard') return discard(s, chooseDiscard(s));
        if (s.trick.length === playersIn(s)) return collect(s);
        return play(s, s.turn, chooseCard(s, s.turn, rng));
      },
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        if (prev.phase === 'playing' && next.phase !== 'playing') {
          const r = next.last!;
          expect(next.tricks.reduce((a, b) => a + b, 0)).toBe(5);
          expect([1, 2, 4]).toContain(r.points);
          const makers = teamOf(prev.maker!);
          expect(r.team).toBe(r.euchred ? 1 - makers : makers);
          expect(r.euchred).toBe(r.makerTricks < 3);
          if (r.euchred) expect(r.points).toBe(2);
          else expect(r.points).toBe(r.makerTricks < 5 ? 1 : prev.alone ? 4 : 2);
          expect(next.scores[r.team]).toBe(prev.scores[r.team] + r.points);
          expect(next.scores[1 - r.team]).toBe(prev.scores[1 - r.team]);
        } else {
          expect(next.scores).toEqual(prev.scores);
        }
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GAME_POINTS);
      },
    });
  }, 60_000);
});

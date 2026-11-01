import { describe, expect, it } from 'vitest';
import { simulate } from '../../test/simulate';
import { GAME_POINTS, applyTurn, chooseTurn, isValidState, newGame, nextRound, pips, winner, type State } from './logic';

const handPips = (s: State, p: number) => pips(s.hands[p]);

describe('Dominoes, many whole games', () => {
  it('always finishes; going out or the lower pips in a blocked game wins the round', () => {
    simulate<State>({
      games: 120,
      maxSteps: 3000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => (s.phase === 'roundOver' ? nextRound(s, rng) : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng))),
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        const ended = prev.phase === 'playing' && next.phase !== 'playing';
        if (!ended) {
          expect(next.scores).toEqual(prev.scores);
          return;
        }
        const r = next.last!;
        const [a, b] = [handPips(next, 0), handPips(next, 1)];
        if (!r.blocked) expect(next.hands[r.winner!]).toHaveLength(0);
        else if (a === b) expect(r.winner).toBeNull();
        else expect(r.winner).toBe(a < b ? 0 : 1);
        if (r.winner !== null) {
          expect(next.scores[r.winner]).toBe(prev.scores[r.winner] + r.points);
          expect(next.scores[1 - r.winner]).toBe(prev.scores[1 - r.winner]);
        }
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GAME_POINTS);
      },
    });
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { simulate } from '../../test/simulate';
import { GOAL, canScore, computerStep, isValidState, newGame, winner, type State } from './logic';

describe('Hot Dice, many whole games', () => {
  it('always finishes; banked points are what was kept, and a bust scores nothing', () => {
    simulate<State>({
      games: 300,
      maxSteps: 20000,
      start: (_rng, i) => newGame(i % 2 ? 'easy' : 'strong'),
      step: (s, rng) => computerStep({ ...s, level: s.turn === 0 ? 'easy' : s.level }, rng),
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        for (const p of [0, 1]) expect(next.scores[p]).toBeGreaterThanOrEqual(prev.scores[p]);
        const gained = next.turnPoints - prev.turnPoints;
        if (prev.phase === 'choose' && gained > 0) {
          expect(gained % 50).toBe(0); // every scoring combination is a multiple of 50
          expect(canScore(prev.dice)).toBe(true); // only a roll with something to keep
        }
        if (prev.phase === 'bust') expect(next.scores).toEqual(prev.scores);
        const banked = next.scores[prev.turn] - prev.scores[prev.turn];
        if (banked) expect(banked).toBe(prev.turnPoints);
      },
      end: (s) => expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GOAL),
    });
  }, 60_000);
});

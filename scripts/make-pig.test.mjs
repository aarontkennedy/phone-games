import { describe, expect, it } from 'vitest';
import { encode, solve } from './make-pig.mjs';
import { FIRST_PLAYER_WINS, TABLE } from '../src/games/pig/policy.ts';

describe('Pig best-play table', () => {
  it('matches a fresh calculation (run node scripts/make-pig.mjs if not)', () => {
    const { win, holds } = solve();
    expect(win(0, 0, 0)).toBeCloseTo(FIRST_PLAYER_WINS, 6);
    expect(encode(holds)).toBe(TABLE);
  }, 120_000);

  it('works on a smaller goal, where the answer is easy to check', () => {
    // To 2: any roll but a 1 wins at once; a 1 hands the same position to the other player.
    // So p = 5/6 + (1/6)(1 - p), which makes p = 6/7.
    const { win, holds } = solve(2);
    expect(win(0, 0, 0)).toBeCloseTo(6 / 7, 6);
    expect(holds(0, 0, 0)).toBe(false);
  });
});

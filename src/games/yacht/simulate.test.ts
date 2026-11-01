import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { BOXES, ROLLS, UPPER, YACHT_BONUS, choose, isGameOver, isValidState, newGame, openBoxes, roll, toggleHold, total, upperBonus, type State } from './logic';

describe('Yacht, many whole games', () => {
  it('13 turns fill the card, and the total always adds up', () => {
    simulate<State>({
      games: 2000,
      maxSteps: 200,
      start: () => newGame(),
      step: (s, rng) => {
        if (s.rolls === 0) return roll(s, rng);
        if (s.rolls < ROLLS && rng() < 0.6) {
          let n = s;
          for (let i = 0; i < 5; i++) if (rng() < 0.4) n = toggleHold(n, i)!;
          return roll(n, rng);
        }
        return choose(s, pick(openBoxes(s), rng));
      },
      isOver: isGameOver,
      isValid: isValidState,
      check: (prev, next) => {
        expect(total(next)).toBeGreaterThanOrEqual(total(prev));
        if (next.rolls > 1 && next.rolls > prev.rolls) next.dice.forEach((d, i) => next.held[i] && expect(d, `held die ${i}`).toBe(prev.dice[i]));
      },
      end: (s) => {
        const boxes = BOXES.reduce((t, b) => t + s.scores[b]!, 0);
        const upper = UPPER.reduce((t, b) => t + s.scores[b]!, 0);
        expect(upperBonus(s)).toBe(upper >= 63 ? 35 : 0);
        expect(total(s)).toBe(boxes + upperBonus(s) + s.extraYachts * YACHT_BONUS);
        if (s.extraYachts) expect(s.scores.yacht).toBe(50);
      },
    });
  }, 60_000);
});

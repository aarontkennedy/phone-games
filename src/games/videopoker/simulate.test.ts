import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { pick, simulate } from '../../test/simulate';
import { deal, draw, isBroke, isValidState, newState, payout, restart, setBet, toggleHold, winOf, type State } from './logic';

describe('Video poker, many hands', () => {
  it('pays every final hand by the table, and credits only change by bet and payout', () => {
    const [done] = simulate<State & { hands: number }>({
      games: 1,
      maxSteps: 40_000,
      start: () => ({ ...newState(), hands: 0 }),
      step: (s, rng) => {
        if (s.phase === 'holding') {
          let n: State = s;
          for (let i = 0; i < 5; i++) if (rng() < 0.4) n = toggleHold(n, i)!;
          return { ...draw(n)!, hands: s.hands + 1 };
        }
        if (isBroke(s)) return { ...restart(s), hands: s.hands };
        return { ...deal(setBet(s, pick([1, 2, 3, 4, 5], rng))!, rng)!, hands: s.hands };
      },
      isOver: (s) => s.hands >= 5000,
      isValid: isValidState,
      check: (prev, next) => {
        if (prev.phase === 'holding') {
          expect(next.win).toBe(winOf(next.hand));
          expect(next.credits).toBe(prev.credits + payout(next.win, prev.bet));
          next.hand.forEach((c, i) => prev.held[i] && expect(c).toEqual(prev.hand[i]));
        } else if (next.phase === 'holding') {
          expect(next.credits).toBe(prev.credits - next.bet);
          expect(isFullDeck([...next.hand, ...next.deck])).toBe(true);
        }
      },
    });
    expect(done.hands).toBe(5000);
  }, 60_000);
});

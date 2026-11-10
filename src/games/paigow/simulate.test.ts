import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { BETS, deal, isBroke, isValidSplit, isValidState, newState, play, restart, setBet, split, toggleLow, useHint, type State } from './logic';

describe('Pai Gow Poker, many hands', () => {
  it('the house way always sets a legal hand, and chips only change by the result', () => {
    const results = { win: 0, push: 0, lose: 0 };
    const [done] = simulate<State & { hands: number }>({
      games: 1,
      maxSteps: 100_000,
      start: () => ({ ...newState(), hands: 0 }),
      step: (s, rng) => {
        if (s.phase === 'setting') {
          // Half the time the house way; otherwise random picks until the hand is legal.
          let n: State = rng() < 0.5 ? useHint(s)! : s;
          if (n !== s) expect(play(n)).not.toBeNull(); // the hint is always a legal hand
          while (!play(n)) n = toggleLow(n, Math.floor(rng() * 7))!;
          return { ...play(n)!, hands: s.hands + 1 };
        }
        if (isBroke(s)) return { ...restart(s), hands: s.hands };
        return { ...deal(setBet(s, pick(BETS.filter((b) => b <= s.chips), rng)) ?? s, rng)!, hands: s.hands };
      },
      isOver: (s) => s.hands >= 6_000,
      isValid: isValidState,
      check: (prev, next) => {
        if (next.phase !== 'done' || prev.phase !== 'setting') return;
        results[next.result!]++;
        const expected = next.result === 'win' ? prev.bet * 1.95 : next.result === 'push' ? prev.bet : 0;
        expect(next.paid).toBe(expected);
        expect(next.chips).toBe(prev.chips + expected);
        expect(isValidSplit(split(next.dealer, next.dealerLow).high, split(next.dealer, next.dealerLow).low)).toBe(true);
      },
    });
    expect(done.hands).toBe(6_000);
    // Pushes are the most common result in pai gow (about 4 in 10 hands).
    expect(results.push / 6_000).toBeGreaterThan(0.3);
    expect(results.push / 6_000).toBeLessThan(0.5);
  }, 16_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished hand stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'paigow',
      mount,
      isValid: isValidState,
      steps: 100,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

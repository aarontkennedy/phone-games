import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { CHIPS, OUTSIDE, isBroke, isValidState, newState, place, repeat, restart, setChip, spin, total, winnings, type State } from './logic';

const SPOTS = [...Object.keys(OUTSIDE), ...Array.from({ length: 37 }, (_, n) => String(n))];

describe('Roulette, many spins', () => {
  it('pays every spin by the table, chips are never lost or made up, and each number comes up fairly', () => {
    const counts = Array(37).fill(0);
    const [done] = simulate<State & { spins: number }>({
      games: 1,
      maxSteps: 200_000,
      start: () => ({ ...newState(), spins: 0 }),
      step: (s, rng) => {
        if (isBroke(s)) return { ...restart(s), spins: s.spins };
        // Bet one to four chips, or repeat, then spin.
        let n: State = (rng() < 0.3 && repeat(s)) || s;
        for (let i = 0, k = 1 + Math.floor(rng() * 4); i < k; i++) n = place(setChip(n, pick(CHIPS, rng))!, pick(SPOTS, rng)) ?? n;
        if (!total(n.bets)) n = place(setChip(n, CHIPS[0])!, 'red')!;
        return { ...spin(n, rng)!, spins: s.spins + 1 };
      },
      isOver: (s) => s.spins >= 20_000,
      isValid: isValidState,
      check: (prev, next) => {
        if (next.spins === prev.spins) return; // starting over
        const n = next.history[0];
        counts[n]++;
        expect(next.paid).toBe(winnings(next.lastBets, n));
        expect(next.chips).toBe(prev.chips + (total(prev.bets) - next.staked) + next.paid); // what was bet before this step came from your chips
        expect(total(next.bets)).toBe(0);
      },
    });
    expect(done.spins).toBe(20_000);
    // Each number should come up about 20000 / 37 = 540 times.
    for (const c of counts) expect(c).toBeGreaterThan(420);
    for (const c of counts) expect(c).toBeLessThan(670);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'roulette',
      mount,
      isValid: isValidState,
      steps: 100,
      starts: [{ ...newState(), chips: 0 }, { ...newState(), chips: CHIPS[0] }], // broke, and one chip from it
      stepsFromStart: 25,
      isOver: isBroke, // the only way a session ends
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

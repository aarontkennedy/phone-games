import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { CHIPS, POINTS, isBroke, isValidState, newState, onTable, place, restart, roll, setChip, takeDown, type State } from './logic';

const TARGETS = ['pass', 'dontPass', 'come', 'dontCome', 'field', 'odds:pass', 'odds:dontPass', ...POINTS.map((p) => `odds:${p}`)];

describe('Craps, many rolls', () => {
  it('never loses or makes up chips, and the pass line keeps its small edge', () => {
    let passBet = 0;
    let passNet = 0;
    const [done] = simulate<State & { rolls: number }>({
      games: 1,
      maxSteps: 200_000,
      start: () => ({ ...newState(), rolls: 0 }),
      step: (s, rng) => {
        if (isBroke(s)) return { ...restart(s), rolls: s.rolls };
        let n: State = s;
        if (rng() < 0.05) n = takeDown(n) ?? n;
        for (let i = 0, k = Math.floor(rng() * 3); i < k; i++) n = place(setChip(n, pick(CHIPS, rng))!, pick(TARGETS, rng)) ?? n;
        return { ...roll(n, rng)!, rolls: s.rolls + 1 };
      },
      isOver: (s) => s.rolls >= 30_000,
      isValid: isValidState,
      check: (prev, next) => {
        if (next.rolls === prev.rolls) return;
        // Chips only change by what the roll settled: everything you had, on the table or
        // not, plus each bet's win or loss.
        const net = next.outcomes.reduce((t, o) => t + o.net, 0);
        expect(next.chips + onTable(next)).toBe(prev.chips + onTable(prev) + net);
        for (const o of next.outcomes)
          if (o.name === 'Pass line') {
            passBet++;
            passNet += Math.sign(o.net);
          }
      },
    });
    expect(done.rolls).toBe(30_000);
    expect(passBet).toBeGreaterThan(400);
    // Wins minus losses per pass bet: about -0.014 (odds don't change who wins).
    expect(passNet / passBet).toBeGreaterThan(-0.15);
    expect(passNet / passBet).toBeLessThan(0.12);
  }, 60_000);
});

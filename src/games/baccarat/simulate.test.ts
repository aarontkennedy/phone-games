import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { CHIPS, SPOTS, clear, deal, handTotal, isBroke, isValidState, newState, payout, place, restart, setChip, total, winnerOf, type Bets, type State } from './logic';

describe('Baccarat, many hands', () => {
  it('plays every hand by the rules and pays it right, and the shoe gives fair results', () => {
    const wins = { player: 0, banker: 0, tie: 0 };
    // `used`: the bets on the hand just dealt (they may come down after it).
    const [done] = simulate<State & { hands: number; used: Bets }>({
      games: 1,
      maxSteps: 100_000,
      start: (rng) => ({ ...newState(rng), hands: 0, used: newState().bets }),
      step: (s, rng) => {
        if (isBroke(s)) return { ...restart(s, rng), hands: s.hands, used: s.used };
        // Now and then change the bets; then deal.
        let n: State = s;
        if (!total(n.bets) || rng() < 0.3) {
          n = clear(n) ?? n;
          for (let i = 0, k = 1 + Math.floor(rng() * 3); i < k; i++) n = place(setChip(n, pick(CHIPS, rng))!, pick(SPOTS, rng)) ?? n;
          if (!total(n.bets)) n = place(setChip(n, CHIPS[0])!, 'banker')!;
        }
        return { ...deal(n, rng)!, hands: s.hands + 1, used: n.bets };
      },
      isOver: (s) => s.hands >= 20_000,
      isValid: isValidState,
      check: (prev, next) => {
        if (next.hands === prev.hands) return; // starting over
        wins[next.winner!]++;
        expect(next.player.length).toBeGreaterThanOrEqual(2);
        expect(next.player.length + next.banker.length).toBeLessThanOrEqual(6);
        expect(next.winner).toBe(winnerOf(next.player, next.banker));
        expect(handTotal(next.player)).toBeLessThan(10);
        expect(next.staked).toBe(total(next.used));
        expect(next.paid).toBe(payout(next.used, next.winner!));
        expect(next.chips).toBe(prev.chips - next.staked + next.paid);
      },
    });
    expect(done.hands).toBe(20_000);
    // Banker about 45.9%, Player 44.6%, Tie 9.5%.
    expect(wins.banker / 20_000).toBeGreaterThan(0.44);
    expect(wins.player / 20_000).toBeLessThan(wins.banker / 20_000 + 0.01);
    expect(wins.tie / 20_000).toBeGreaterThan(0.08);
    expect(wins.tie / 20_000).toBeLessThan(0.11);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a broken bank stays broken', () => {
    const { finishedSteps } = stressScreen({
      id: 'baccarat',
      mount,
      isValid: isValidState,
      steps: 100,
      starts: [{ ...newState(), chips: 0 }, { ...newState(), chips: CHIPS[0] }],
      stepsFromStart: 25,
      isOver: isBroke,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { BETS, START_CHIPS, act, canAct, deal, handValue, isBroke, isValidState, newState, restart, setBet, type Action, type State } from './logic';

const ACTIONS: Action[] = ['hit', 'stand', 'double', 'split'];
const SESSION = 60; // hands per simulated session (restarts when broke count as more)

describe('Blackjack, many sessions', () => {
  it('chips change by exactly the payouts, and the dealer plays to 17', () => {
    let hands = 0;
    simulate<State & { played?: number }>({
      games: 50,
      maxSteps: 4000,
      start: (rng) => newState(rng),
      step: (s, rng) => {
        if (s.phase === 'playing') return act(s, pick(ACTIONS.filter((a) => canAct(s, a)), rng));
        if (isBroke(s)) return restart(s, rng);
        hands++;
        const bet = setBet(s, pick(BETS.filter((b) => b <= s.chips), rng)) ?? s;
        return { ...deal(bet, rng)!, played: (s.played ?? 0) + 1 };
      },
      isOver: (s) => (s.played ?? 0) >= SESSION && s.phase !== 'playing',
      isValid: isValidState,
      check: (prev, next) => {
        expect(next.chips).toBeGreaterThanOrEqual(0);
        if (prev.phase === 'playing' && next.phase === 'done') {
          const staked = next.hands.reduce((t, h) => t + h.bet, 0);
          const paid = next.hands.reduce((t, h) => t + h.payout!, 0);
          const before = prev.chips + prev.hands.reduce((t, h) => t + h.bet, 0); // chips before the bets
          expect(next.chips).toBe(before - staked + paid);
          const dealer = handValue(next.dealer).total;
          const allBust = next.hands.every((h) => handValue(h.cards).total > 21);
          if (!allBust) expect(dealer).toBeGreaterThanOrEqual(17);
        }
        if (isBroke(prev) && prev.phase === 'done' && next.phase === 'betting') expect(next.chips).toBe(START_CHIPS);
      },
    });
    expect(hands).toBeGreaterThan(2500);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished hand stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'blackjack',
      mount,
      isValid: isValidState,
      steps: 100,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

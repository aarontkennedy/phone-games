import { describe, expect, it } from 'vitest';
import { isFullDeck, type Card } from '../../core/cards';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { table } from './test-fixtures';
import { PASSES, cardsLeft, draw, findHint, isStuck, isValidState, newGame, remove, sources, type State } from './logic';

const all = (s: State) => [...s.pyramid.filter((c): c is Card => !!c), ...s.stock, ...s.waste, ...s.removed];

describe('Pyramid, many deals', () => {
  it('plays whole deals by Hint: every move is legal, cards are never lost, and some deals are won', () => {
    let won = 0;
    const results = simulate<State>({
      games: 300,
      maxSteps: 400,
      start: (rng) => newGame(rng),
      // Mostly Hint's move; sometimes any legal one, so odd positions get played too.
      step: (s, rng) => {
        if (rng() < 0.2) {
          const srcs = sources(s);
          const a = pick(srcs, rng);
          const moved = remove(s, [a]) ?? remove(s, [a, pick(srcs, rng)]);
          if (moved) return moved;
        }
        const h = findHint(s)!;
        return 'draw' in h ? draw(s) : remove(s, h.remove);
      },
      isOver: (s) => s.won || isStuck(s),
      isValid: isValidState,
      check: (prev, next) => {
        expect(isFullDeck(all(next))).toBe(true);
        expect(cardsLeft(next)).toBeLessThanOrEqual(cardsLeft(prev));
        expect(next.pass).toBeGreaterThanOrEqual(prev.pass);
      },
      end: (s) => {
        if (s.won) won++;
        expect(s.won || isStuck(s)).toBe(true);
      },
    });
    expect(results).toHaveLength(300);
    expect(won).toBeGreaterThan(0); // winnable: Hint clears some deals
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a won deal stays won', () => {
    const { finishedSteps } = stressScreen({
      id: 'pyramid',
      mount,
      isValid: isValidState,
      steps: 100,
      // One tap from winning, and a deal with no moves left.
      starts: [table({ 27: 'KS' }), table({ 27: '2S' }, '3C', '', { pass: PASSES })],
      stepsFromStart: 25,
      isOver: (s: State) => s.won || isStuck(s),
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

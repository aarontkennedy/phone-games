import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { autoFinish, bestTarget, canAutoFinish, draw, isValidState, move, newState, type Source, type State } from './logic';
import { oneMoveFromWinning } from './test-fixtures';

function sources(s: State): Source[] {
  const out: Source[] = [{ from: 'waste' }];
  s.tableau.forEach((col, c) => col.up.forEach((_, index) => out.push({ from: 'tableau', col: c, index })));
  return out.filter((src) => bestTarget(s, src) !== null);
}
const stuck = (s: State) => !sources(s).length && !s.stock.length && !s.waste.length;
const cards = (s: State) => [...s.stock, ...s.waste, ...s.foundations.flat(), ...s.tableau.flatMap((c) => [...c.down, ...c.up])];

describe('Solitaire, many games of random play', () => {
  it('never loses or copies a card, and Auto finish always wins', () => {
    simulate<State>({
      games: 100,
      maxSteps: 400,
      start: (rng, i) => newState(i % 2 ? 1 : 3, rng),
      step: (s, rng) => {
        if (canAutoFinish(s)) return autoFinish(s);
        const options = sources(s);
        if (options.length && (rng() < 0.7 || (!s.stock.length && !s.waste.length))) {
          const src = pick(options, rng);
          return move(s, src, bestTarget(s, src)!);
        }
        return draw(s);
      },
      isOver: (s) => s.won || s.moves >= 300 || stuck(s),
      isValid: isValidState,
      check: (prev, next) => {
        expect(isFullDeck(cards(next))).toBe(true);
        if (canAutoFinish(prev) && next.won) expect(next.foundations.every((f) => f.length === 13)).toBe(true);
      },
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'solitaire',
      mount,
      isValid: isValidState,
      steps: 100,
      starts: [oneMoveFromWinning()],
      tries: 5,
      stepsFromStart: 25,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

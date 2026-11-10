import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { bestTarget, isValidState, move, newGame, type Source, type State } from './logic';
import { nearlyWon } from './test-fixtures';

function sources(s: State): Source[] {
  const out: Source[] = s.cells.flatMap((c, i) => (c ? [{ from: 'cell' as const, i }] : []));
  s.columns.forEach((col, c) => col.forEach((_, index) => out.push({ from: 'col', col: c, index })));
  return out.filter((src) => bestTarget(s, src) !== null);
}
const cards = (s: State) => [...s.cells.filter((c) => c !== null), ...s.foundations.flat(), ...s.columns.flat()];

describe('Free Cells, many games of random play', () => {
  it('never loses or copies a card, and foundations only grow', () => {
    simulate<State>({
      games: 80,
      maxSteps: 400,
      start: (rng) => newGame(rng),
      step: (s, rng) => {
        const src = pick(sources(s), rng);
        return move(s, src, bestTarget(s, src)!);
      },
      isOver: (s) => s.won || s.moves >= 300 || !sources(s).length,
      isValid: isValidState,
      check: (prev, next) => {
        expect(isFullDeck(cards(next))).toBe(true);
        expect(next.foundations.flat().length).toBeGreaterThanOrEqual(prev.foundations.flat().length);
      },
      end: (s) => {
        if (s.won) expect(s.foundations.every((f) => f.length === 13)).toBe(true);
      },
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'freecells',
      mount,
      isValid: isValidState,
      steps: 100,
      starts: [nearlyWon()],
      tries: 5,
      stepsFromStart: 25,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { pick, simulate } from '../../test/simulate';
import { bestTarget, isValidState, move, newGame, type Source, type State } from './logic';

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
});

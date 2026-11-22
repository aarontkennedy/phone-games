import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { SIZE, countSolutions, hint, isValidState, isWon, left, newPuzzle, repeats, runs, runsOf, select, solutions, write, type State } from './logic';

/** A puzzle from a picture of its answer: digits are white squares, # black or clue squares. */
function from(rows: string[], o: Partial<State> = {}): State {
  const cells = rows.join('').split('');
  return {
    white: cells.map((ch) => ch !== '#'),
    solution: cells.map((ch) => (ch === '#' ? 0 : Number(ch))),
    grid: cells.map(() => 0),
    hinted: cells.map(() => false),
    selected: null,
    solved: 0,
    ...o,
  };
}
// A 2 by 2 block: 1 2 over 3 4.
const SMALL = ['######', '#12###', '#34###', '######', '######', '######'];

// Making a puzzle takes a fraction of a second alone, far longer under coverage with every
// test file running at once.
describe('cross sums', { timeout: 60_000 }, () => {
  it('finds the across and down runs, each with its clue square', () => {
    const r = runsOf(from(SMALL).white);
    expect(r).toEqual([
      { clue: 6, down: false, cells: [7, 8] },
      { clue: 12, down: false, cells: [13, 14] },
      { clue: 1, down: true, cells: [7, 13] },
      { clue: 2, down: true, cells: [8, 14] },
    ]);
    expect(runs(from(SMALL)).map((x) => x.sum)).toEqual([3, 7, 4, 6]);
  });

  it('counts the answers the clues allow', () => {
    const s = from(SMALL);
    // 3 = 1 + 2 and 4 = 1 + 3 fix the corner as 1, and the rest follows: one answer.
    expect(countSolutions(s.white, runs(s))).toBe(1);
    expect(solutions(s.white, runs(s))[0][7]).toBe(1);
    // Two different digits can't total 2, so nothing works.
    expect(countSolutions(s.white, [{ cells: [7, 8], sum: 2 }])).toBe(0);
  });

  it('deals puzzles with exactly one answer, every run 2 to 4 squares', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const s = newPuzzle(3, seededRng(seed));
      expect(countSolutions(s.white, runs(s))).toBe(1);
      expect(runs(s).every((r) => r.cells.length >= 2 && r.cells.length <= 4)).toBe(true);
      expect(s.white.slice(0, SIZE).some(Boolean)).toBe(false); // the clue row
      expect(s.solved).toBe(3);
      expect(isValidState(s)).toBe(true);
    }
  });

  it('writes digits in the selected square, and wins when every square is right', () => {
    let s = from(SMALL);
    expect(select(s, 0)).toBeNull(); // not a white square
    expect(write(s, 5)).toBeNull(); // nothing selected
    s = select(s, 7)!;
    expect(select(s, 7)!.selected).toBe(7); // tapped again: still picked
    s = write(s, 2)!;
    expect(left(s)).toBe(3);
    s = write(s, 0)!;
    expect(left(s)).toBe(4);
    for (const [cell, d] of [[7, 1], [8, 2], [13, 3], [14, 4]]) s = write({ ...s, selected: cell }, d)!;
    expect(isWon(s)).toBe(true);
    expect(s.solved).toBe(1);
    expect(select(s, 7)).toBeNull();
    expect(write({ ...s, selected: 7 }, 3)).toBeNull();
  });

  it('finds digits that repeat in a run', () => {
    let s = from(SMALL);
    s = write(select(s, 7)!, 1)!;
    s = write(select(s, 8)!, 1)!;
    expect([...repeats(s)].sort()).toEqual([7, 8]);
  });

  it('hints the picked square, then a wrong one, then the easiest empty one', () => {
    let s = select(from(SMALL), 14)!;
    s = hint(s)!;
    expect(s.grid[14]).toBe(4);
    expect(s.hinted[14]).toBe(true);
    expect(write(s, 1)).toBeNull(); // a hinted square stays
    s = write(select(s, 7)!, 9)!; // wrong
    s = hint({ ...s, selected: null })!;
    expect(s.grid[7]).toBe(1);
    s = hint(s)!;
    s = hint(s)!;
    expect(isWon(s)).toBe(true);
    expect(s.solved).toBe(1);
    expect(hint(s)).toBeNull();
  });

  it('checks saved puzzles', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...from(SMALL), grid: [1] })).toBe(false);
    expect(isValidState({ ...from(SMALL), selected: 0 })).toBe(false); // not a white square
    expect(isValidState({ ...from(SMALL), solution: from(SMALL).solution.map((d, i) => (i === 7 ? 0 : d)) })).toBe(false);
  });
});

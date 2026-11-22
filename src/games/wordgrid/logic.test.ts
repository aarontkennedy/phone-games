import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { ENOUGH, allWords, enter, finish, hint, isPath, isValidState, missed, neighbors, newRound, pathFor, points, whyNot, type State } from './logic';

/** A round on this grid (16 letters, row by row). */
const round = (letters: string, o: Partial<State> = {}): State => ({ grid: [...letters], found: [], score: 0, done: false, best: 0, ...o });
// c a t s
// o d e r
// g i n e
// x y z q
const GRID = 'catsodergineyxzq';

describe('word grid', () => {
  it('deals grids with plenty of words', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = newRound(7, seededRng(seed));
      expect(s.grid).toHaveLength(16);
      expect(allWords(s.grid).length).toBeGreaterThanOrEqual(ENOUGH);
      expect(s.best).toBe(7);
      expect(isValidState(s)).toBe(true);
    }
  });

  it('knows which letters touch, diagonals too', () => {
    expect(neighbors(0).sort((a, b) => a - b)).toEqual([1, 4, 5]);
    expect(neighbors(5)).toHaveLength(8);
    expect(isPath([0, 1, 2])).toBe(true);
    expect(isPath([0, 2])).toBe(false);
    expect(isPath([0, 1, 0])).toBe(false);
    expect(isPath([0, 16])).toBe(false);
  });

  it('finds words along touching letters, not anywhere in the grid', () => {
    expect(pathFor([...GRID], 'cat')).toEqual([0, 1, 2]);
    expect(pathFor([...GRID], 'cats')).toEqual([0, 1, 2, 3]);
    expect(pathFor([...GRID], 'dog')).toEqual([5, 4, 8]);
    expect(pathFor([...GRID], 'tag')).toBeNull(); // T and G don't touch
    const all = allWords([...GRID]);
    expect(all).toEqual(expect.arrayContaining(['cat', 'cats', 'dog']));
    expect(all).not.toContain('tag');
  });

  it('scores words by length, once each', () => {
    let s = round(GRID);
    expect(whyNot(s, [0, 1])).toBe('Words need at least 3 letters.');
    expect(whyNot(s, [0, 2, 3])).toBe('Each letter must touch the one before.');
    expect(whyNot(s, [0, 1, 4])).toBe('CAO isn’t in the word list.');
    s = enter(s, [0, 1, 2])!;
    expect(s.found).toEqual(['cat']);
    expect(s.score).toBe(1);
    expect(whyNot(s, [0, 1, 2])).toBe('You already found CAT.');
    expect(enter(s, [0, 1, 2])).toBeNull();
    expect([3, 4, 5, 6, 7, 8, 9].map((n) => points('x'.repeat(n)))).toEqual([1, 1, 2, 3, 5, 11, 11]);
  });

  it('ends the round with Done, and lists what you missed', () => {
    const s = finish(enter(round(GRID), [0, 1, 2])!)!;
    expect(s.done).toBe(true);
    expect(finish(s)).toBeNull();
    expect(whyNot(s, [5, 4, 8])).toBe('The round is over.');
    expect(missed(s)).not.toContain('cat');
    expect(missed(s)).toContain('dog');
    expect(hint(s)).toBeNull();
  });

  it('hints an everyday word first, and where it starts', () => {
    const tip = hint(round(GRID))!;
    expect(pathFor([...GRID], tip.word)![0]).toBe(tip.start);
    // Everyday words (from the app's own lists) come first, longest first: COAT (C, O, A, T
    // all touch) beats longer words that aren't on those lists.
    expect(missed(round(GRID))[0]).toBe('coat');
    expect(missed(round(GRID)).length).toBeGreaterThan(missed(round(GRID)).indexOf('coat') + 1); // longer, rarer words follow
  });

  it('checks saved rounds', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState(round('abc'))).toBe(false);
    expect(isValidState(round('ABCDEFGHIJKLMNOP'))).toBe(false); // lower case only
    expect(isValidState({ ...round(GRID), done: 'no' })).toBe(false);
  });
});

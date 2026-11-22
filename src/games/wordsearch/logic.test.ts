import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { SIZE, WORDS, foundCells, hint, isValidState, isWon, newPuzzle, tap } from './logic';
import { THEMES } from './words';

describe('word search', () => {
  it('hides 8 words from one theme, each reading across, down or diagonally, forwards', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = newPuzzle(0, seededRng(seed));
      expect(s.words).toHaveLength(WORDS);
      for (const w of s.words) {
        expect(THEMES[s.theme].map((x) => x.toUpperCase())).toContain(w.word);
        expect(w.cells.map((c) => s.grid[c]).join('')).toBe(w.word);
        const step = w.cells[1] - w.cells[0];
        expect([1, SIZE, SIZE + 1]).toContain(step);
        expect(w.cells.every((c, i) => i === 0 || c - w.cells[i - 1] === step)).toBe(true);
        // Never wraps around an edge.
        if (step !== SIZE) expect(w.cells.at(-1)! % SIZE).toBeGreaterThan(w.cells[0] % SIZE);
      }
      expect(isValidState(s)).toBe(true);
    }
  });

  it('keeps theme words short enough for the grid', () => {
    for (const words of Object.values(THEMES)) {
      expect(words.length).toBeGreaterThanOrEqual(WORDS);
      for (const w of words) expect(w, w).toMatch(/^[a-z]{3,9}$/);
    }
  });

  it('finds a word from its first letter to its last', () => {
    let s = newPuzzle(0, seededRng(1));
    const [w] = s.words;
    s = tap(s, w.cells[0])!;
    expect(s.start).toBe(w.cells[0]);
    expect(tap(s, w.cells[0])!.start).toBeNull(); // tapped again: let go
    const n = tap(s, w.cells.at(-1)!)!;
    expect(n.found).toEqual([w.word]);
    expect(n.start).toBeNull();
    expect([...foundCells(n)].sort()).toEqual([...w.cells].sort());
    // Not a word's ends: starts again from the second tap.
    const other = w.cells.at(-1)! === 0 ? 1 : 0;
    expect(tap(s, other)!.start).toBe(other);
    expect(tap(s, -1)).toBeNull();
  });

  it('wins when every word is found, and counts it', () => {
    let s = newPuzzle(3, seededRng(2));
    for (const w of s.words) s = tap(tap(s, w.cells[0])!, w.cells.at(-1)!)!;
    expect(isWon(s)).toBe(true);
    expect(s.solved).toBe(4);
    expect(tap(s, 0)).toBeNull();
    expect(hint(s)).toBeNull();
  });

  it('hints a word not yet found', () => {
    const s = newPuzzle(0, seededRng(3));
    expect(hint(s)).toBe(s.words[0]);
    const n = tap(tap(s, s.words[0].cells[0])!, s.words[0].cells.at(-1)!)!;
    expect(hint(n)).toBe(s.words[1]);
  });

  it('checks saved puzzles', () => {
    const s = newPuzzle(0, seededRng(4));
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...s, grid: s.grid.slice(1) })).toBe(false);
    expect(isValidState({ ...s, found: ['NOPE'] })).toBe(false);
    expect(isValidState({ ...s, start: 100 })).toBe(false);
    expect(isValidState({ ...s, words: [{ word: 'AB', cells: [0] }] })).toBe(false); // one cell can't spell two letters
  });
});

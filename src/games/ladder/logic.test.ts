import { describe, expect, it } from 'vitest';
import { isWord } from '../../core/dictionary';
import { seededRng } from '../../core/random';
import { current, hint, isValidState, newPuzzle, oneApart, shortestLadder, step, steps, undo, whyNot, type State } from './logic';
import { COMMON } from './words';

const puzzle = (start: string, target: string, par = 4): State => ({ start, target, path: [start], par, won: false });

describe('word ladder', () => {
  it('starts and ends on everyday words, 3 to 5 steps apart by everyday words', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newPuzzle(seededRng(seed));
      expect(COMMON).toContain(s.start);
      expect(COMMON).toContain(s.target);
      expect(s.par).toBeGreaterThanOrEqual(3);
      expect(s.par).toBeLessThanOrEqual(5);
      expect(shortestLadder(s.start, s.target, new Set(COMMON))!.length - 1).toBe(s.par);
      expect(isValidState(s)).toBe(true);
    }
  });

  it('only uses real everyday words for puzzles', () => {
    for (const w of COMMON) expect(isWord(w), w).toBe(true);
    expect(new Set(COMMON).size).toBe(COMMON.length);
  });

  it('knows words one letter apart', () => {
    expect(oneApart('cold', 'cord')).toBe(true);
    expect(oneApart('cold', 'card')).toBe(false);
    expect(oneApart('cold', 'cold')).toBe(false);
  });

  it('steps one letter at a time through real words, and wins at the target', () => {
    let s = puzzle('cold', 'warm');
    expect(whyNot(s, 'card')).toBe('Change exactly one letter.');
    expect(whyNot(s, 'cxld')).toBe('CXLD isn’t in the word list.');
    s = step(s, 'cord')!;
    expect(current(s)).toBe('cord');
    expect(whyNot(s, 'cold')).toBe('You’ve already used COLD.');
    expect(step(s, 'cold')).toBeNull();
    s = step(step(step(s, 'card')!, 'ward')!, 'warm')!;
    expect(s.won).toBe(true);
    expect(steps(s)).toBe(4);
    expect(step(s, 'worm')).toBeNull(); // over
    expect(undo(s)).toBeNull();
    expect(undo(puzzle('cold', 'warm'))).toBeNull(); // nothing to take back
    expect(current(undo(step(puzzle('cold', 'warm'), 'cord')!)!)).toBe('cold');
  });

  it('hints the next word on a shortest ladder, through everyday words when it can', () => {
    const s = puzzle('cold', 'warm');
    const next = hint(s)!;
    expect(oneApart('cold', next)).toBe(true);
    expect(shortestLadder(next, 'warm', new Set(COMMON))!.length).toBe(4); // 3 more steps
    // From a word that isn't everyday, it finds a way through any real words.
    expect(hint(step(puzzle('cold', 'warm'), 'cola')!)).not.toBeNull();
    expect(hint({ ...s, won: true })).toBeNull();
    // QUIZ isn't an everyday word, so the way there goes through any real words.
    expect(oneApart(hint(puzzle('quit', 'quiz'))!, 'quit')).toBe(true);
    // AHOY has no word one letter away: no ladder reaches it.
    expect(hint(puzzle('cold', 'ahoy'))).toBeNull();
    // No way at all: every word near the target is used.
    expect(shortestLadder('cold', 'cold', new Set())).toEqual(['cold']);
    expect(shortestLadder('cold', 'zzzz', new Set(COMMON))).toBeNull();
  });

  it('checks saved puzzles', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...puzzle('cold', 'warm'), path: ['cold', 'card'] })).toBe(false); // two letters at once
    expect(isValidState({ ...puzzle('cold', 'warm'), par: 0 })).toBe(false);
    expect(isValidState({ ...puzzle('cold', 'warm'), start: 'cxld', path: ['cxld'] })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { LEVELS, PEERS, clashes, countSolutions, enter, hintSquare, isValidState, makePuzzle, newGame, shown, type State } from './logic';

const validGrid = (g: number[]) =>
  g.every((n, i) => n >= 1 && n <= 9 && PEERS[i].every((j) => g[j] !== n));

describe('number place', () => {
  it('knows each square’s 20 neighbors', () => {
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
    expect(PEERS[0]).toContain(80 - 72); // same row
    expect(PEERS[0]).toContain(10); // same box
    expect(PEERS[0]).not.toContain(13);
  });

  it.each(Object.keys(LEVELS) as (keyof typeof LEVELS)[])('makes a %s puzzle with exactly one solution', (level) => {
    const { puzzle, solution } = makePuzzle(level, seededRng(7));
    expect(validGrid(solution)).toBe(true);
    expect(puzzle.every((n, i) => !n || n === solution[i])).toBe(true);
    expect(countSolutions(puzzle)).toBe(1);
    const givens = puzzle.filter(Boolean).length;
    expect(givens).toBeGreaterThanOrEqual(LEVELS[level].givens);
    expect(givens).toBeLessThanOrEqual(LEVELS[level].givens + 8);
  });

  it('tries a new grid when the first one gets stuck above the target', () => {
    // With this seed the first hard grid stops at 27 givens; another try reaches 26.
    const { puzzle } = makePuzzle('hard', seededRng(6));
    expect(puzzle.filter(Boolean)).toHaveLength(LEVELS.hard.givens);
    expect(countSolutions(puzzle)).toBe(1);
  });

  it('counts several solutions, and none for a broken grid', () => {
    expect(countSolutions(Array(81).fill(0))).toBe(2);
    const broken = Array(81).fill(0);
    broken[0] = 5;
    broken[1] = 5;
    expect(countSolutions(broken)).toBe(0);
  });

  it('enters and erases numbers only in empty starting squares', () => {
    const s = newGame('easy', seededRng(1));
    const empty = s.puzzle.indexOf(0);
    const given = s.puzzle.findIndex(Boolean);
    const n = enter(s, empty, 4)!;
    expect(shown(n)[empty]).toBe(4);
    expect(enter(n, empty, 0)!.entries[empty]).toBe(0);
    expect(enter(s, given, 4)).toBeNull();
    expect(enter(s, empty, 10)).toBeNull();
    expect(enter(s, 81, 1)).toBeNull();
    expect(enter({ ...s, won: true }, empty, 1)).toBeNull();
  });

  it('marks numbers that repeat in a row, column or box', () => {
    const s = newGame('easy', seededRng(2));
    const empty = s.puzzle.indexOf(0);
    const peerGiven = PEERS[empty].find((j) => s.puzzle[j])!;
    const n = enter(s, empty, s.puzzle[peerGiven])!;
    expect(clashes(n).has(empty)).toBe(true);
    expect(clashes(n).has(peerGiven)).toBe(true);
    expect(clashes(s).size).toBe(0);
  });

  it('is solved when every square matches the solution', () => {
    let s: State = newGame('easy', seededRng(3));
    const empties = s.puzzle.flatMap((n, i) => (n ? [] : [i]));
    for (const i of empties.slice(0, -1)) s = enter(s, i, s.solution[i])!;
    expect(s.won).toBe(false);
    const last = empties.at(-1)!;
    expect(enter(s, last, (s.solution[last] % 9) + 1)!.won).toBe(false);
    expect(enter(s, last, s.solution[last])!.won).toBe(true);
  });

  it('validates saved games', () => {
    const s = newGame('medium', seededRng(4));
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...s, level: 'expert' })).toBe(false);
    expect(isValidState({ ...s, entries: [1] })).toBe(false);
    expect(isValidState({ ...s, solution: Array(81).fill(0) })).toBe(false);
    expect(isValidState({ ...s, puzzle: s.puzzle.map((n) => (n ? (n % 9) + 1 : 0)) })).toBe(false);
    expect(isValidState({ ...s, won: 'no' })).toBe(false);
  });
});

describe('hints', () => {
  const p = newGame('easy', seededRng(5));
  const empties = p.puzzle.flatMap((n, i) => (n ? [] : [i]));

  it('fills the chosen square if it’s empty or wrong', () => {
    expect(hintSquare(p, empties[3])).toBe(empties[3]);
    const wrong = { ...p, entries: p.entries.map((_, i) => (i === empties[3] ? (p.solution[i] % 9) + 1 : 0)) };
    expect(hintSquare(wrong, empties[3])).toBe(empties[3]);
  });

  it('otherwise fixes a wrong entry first, then picks the square with the fewest options', () => {
    const wrong = { ...p, entries: p.entries.map((_, i) => (i === empties[5] ? (p.solution[i] % 9) + 1 : 0)) };
    expect(hintSquare(wrong, p.puzzle.findIndex(Boolean))).toBe(empties[5]); // a given square was chosen
    const i = hintSquare(p);
    expect(empties).toContain(i);
  });

  it('has nothing to fill once solved', () => {
    expect(hintSquare({ ...p, won: true })).toBe(-1);
    const full = { ...p, entries: p.solution.map((n, i) => (p.puzzle[i] ? 0 : n)) };
    expect(hintSquare(full)).toBe(-1);
  });
});

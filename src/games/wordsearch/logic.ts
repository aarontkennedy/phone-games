// Word Search: 8 words from one theme hidden in a 10 by 10 grid of letters, reading across,
// down, or diagonally down and to the right (always forwards, so they read naturally).
// Find one by tapping its first letter, then its last. Find all 8 to win.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { randomInt, shuffle, type Rng } from '../../core/random';
import { THEMES } from './words';

export const SIZE = 10;
export const WORDS = 8;
/** Across, down, and diagonally down-right: [row step, column step]. */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
] as const;

export interface Placed {
  word: string;
  /** Cell indexes (row * SIZE + column), first letter first. */
  cells: number[];
}

export interface State {
  theme: string;
  /** SIZE * SIZE letters, row by row, upper case. */
  grid: string[];
  words: Placed[];
  found: string[];
  /** The first letter you tapped, waiting for the last, or null. */
  start: number | null;
  /** Puzzles finished. */
  solved: number;
}

/** Tries to hide every word; null if they wouldn't all fit (the caller tries again). */
function place(words: string[], rng: Rng): { grid: (string | null)[]; words: Placed[] } | null {
  const grid: (string | null)[] = Array(SIZE * SIZE).fill(null);
  const placed: Placed[] = [];
  for (const word of words) {
    let done = false;
    for (let attempt = 0; attempt < 200 && !done; attempt++) {
      const [dr, dc] = DIRECTIONS[randomInt(DIRECTIONS.length, rng)];
      const rows = SIZE - dr * (word.length - 1);
      const cols = SIZE - dc * (word.length - 1);
      const r = randomInt(rows, rng);
      const c = randomInt(cols, rng);
      const cells = [...word].map((_, i) => (r + dr * i) * SIZE + c + dc * i);
      if (cells.every((cell, i) => grid[cell] === null || grid[cell] === word[i])) {
        cells.forEach((cell, i) => (grid[cell] = word[i]));
        placed.push({ word, cells });
        done = true;
      }
    }
    if (!done) return null;
  }
  return { grid, words: placed };
}

export function newPuzzle(solved = 0, rng: Rng = Math.random): State {
  const names = Object.keys(THEMES);
  for (;;) {
    const theme = names[randomInt(names.length, rng)];
    // Longest first: they're the hardest to fit.
    const words = shuffle(THEMES[theme], rng)
      .slice(0, WORDS)
      .map((w) => w.toUpperCase())
      .sort((a, b) => b.length - a.length);
    const result = place(words, rng);
    if (!result) continue;
    const grid = result.grid.map((ch) => ch ?? String.fromCharCode(65 + randomInt(26, rng)));
    return { theme, grid, words: result.words, found: [], start: null, solved };
  }
}

export const isWon = (s: State): boolean => s.found.length === s.words.length;

/** Taps a cell: the first letter of a word, then its last. */
export function tap(s: State, cell: number): State | null {
  if (isWon(s) || !(cell >= 0 && cell < SIZE * SIZE)) return null;
  if (s.start === null || s.start === cell) return { ...s, start: s.start === cell ? null : cell };
  const hit = s.words.find((w) => !s.found.includes(w.word) && w.cells[0] === s.start && w.cells.at(-1) === cell);
  if (!hit) return { ...s, start: cell }; // not a word: start again from here
  const found = [...s.found, hit.word];
  return { ...s, found, start: null, solved: s.solved + (found.length === s.words.length ? 1 : 0) };
}

/** Cells of the words found so far. */
export const foundCells = (s: State): Set<number> => new Set(s.words.filter((w) => s.found.includes(w.word)).flatMap((w) => w.cells));

/** Hint: a word not yet found (the first in the list). */
export const hint = (s: State): Placed | null => s.words.find((w) => !s.found.includes(w.word)) ?? null;

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  return (
    !!st &&
    typeof st.theme === 'string' &&
    Array.isArray(st.grid) &&
    st.grid.length === SIZE * SIZE &&
    st.grid.every((ch) => typeof ch === 'string' && /^[A-Z]$/.test(ch)) &&
    Array.isArray(st.words) &&
    st.words.every((w) => typeof w.word === 'string' && Array.isArray(w.cells) && w.cells.map((c) => st.grid[c]).join('') === w.word) &&
    Array.isArray(st.found) &&
    st.found.every((f) => st.words.some((w) => w.word === f)) &&
    (st.start === null || (Number.isInteger(st.start) && st.start >= 0 && st.start < SIZE * SIZE)) &&
    Number.isInteger(st.solved)
  );
}

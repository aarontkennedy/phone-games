// Word Grid: 16 letters in a 4 by 4 grid. Spell words of 3 or more letters by tapping
// letters that touch (across, up and down, or diagonally), using each letter once per
// word. Longer words score more. Untimed: tap Done to end the round and see what you
// missed. Pure functions: every action returns a new State, or null if it isn't allowed.
import { dictionary, isWord } from '../../core/dictionary';
import { randomInt, type Rng } from '../../core/random';
import { BASES } from '../anagrams/words';
import { COMMON } from '../ladder/words';
import { WORDS as HANGMAN } from '../hangman/words';
import { THEMES } from '../wordsearch/words';

export const SIZE = 4;
export const MIN = 3;
/** A grid must hold at least this many words, so every round has plenty to find. */
export const ENOUGH = 40;

/** How often each letter is drawn, roughly as often as it's used in English words. */
const WEIGHTS: Record<string, number> = {
  e: 12, a: 9, i: 8, o: 8, t: 8, n: 7, s: 7, r: 7, l: 5, d: 4, u: 4, c: 3, h: 3, m: 3, p: 3, g: 3, b: 2,
  f: 2, y: 2, w: 2, k: 1, v: 1, x: 1, z: 1, j: 1,
};
const BAG = Object.entries(WEIGHTS).flatMap(([l, n]) => Array<string>(n).fill(l));

export interface State {
  /** SIZE * SIZE letters, row by row, lower case. */
  grid: string[];
  found: string[];
  score: number;
  /** Round over: Done was tapped. */
  done: boolean;
  best: number;
}

/** Cells touching cell i (diagonals too). */
export function neighbors(i: number): number[] {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
    }
  return out;
}

/** A path of cells spelling `word`, or null if the grid can't. */
export function pathFor(grid: string[], word: string): number[] | null {
  const walk = (path: number[]): number[] | null => {
    if (path.length === word.length) return path;
    const next = path.length ? neighbors(path.at(-1)!) : grid.map((_, i) => i);
    for (const i of next) if (grid[i] === word[path.length] && !path.includes(i)) {
      const found = walk([...path, i]);
      if (found) return found;
    }
    return null;
  };
  return walk([]);
}

/** Every word in the grid, longest first. */
export function allWords(grid: string[]): string[] {
  const have = new Set(grid);
  const out: string[] = [];
  for (const w of dictionary()) if ([...w].every((ch) => have.has(ch)) && pathFor(grid, w)) out.push(w);
  return out.sort((a, b) => b.length - a.length || a.localeCompare(b));
}

export function newRound(best = 0, rng: Rng = Math.random): State {
  for (;;) {
    const grid = Array.from({ length: SIZE * SIZE }, () => BAG[randomInt(BAG.length, rng)]);
    if (allWords(grid).length >= ENOUGH) return { grid, found: [], score: 0, done: false, best };
  }
}

/** Points by length: 3 or 4 letters 1, 5 letters 2, 6 letters 3, 7 letters 5, 8 letters 11. */
export const points = (word: string): number => [0, 0, 0, 1, 1, 2, 3, 5, 11][Math.min(word.length, 8)];

/** Whether cells form a path: each touching the one before, none used twice. */
export const isPath = (cells: number[]): boolean =>
  new Set(cells).size === cells.length && cells.every((c, i) => c >= 0 && c < SIZE * SIZE && (i === 0 || neighbors(cells[i - 1]).includes(c)));

/** Why the word spelled by these cells doesn't count, or null if it does. */
export function whyNot(s: State, cells: number[]): string | null {
  const word = cells.map((c) => s.grid[c]).join('');
  if (s.done) return 'The round is over.';
  if (!isPath(cells)) return 'Each letter must touch the one before.';
  if (word.length < MIN) return `Words need at least ${MIN} letters.`;
  if (s.found.includes(word)) return `You already found ${word.toUpperCase()}.`;
  if (!isWord(word)) return `${word.toUpperCase()} isn’t in the word list.`;
  return null;
}

/** Scores the word spelled by these cells. */
export function enter(s: State, cells: number[]): State | null {
  if (whyNot(s, cells)) return null;
  const word = cells.map((c) => s.grid[c]).join('');
  const score = s.score + points(word);
  return { ...s, found: [...s.found, word], score, best: Math.max(s.best, score) };
}

export const finish = (s: State): State | null => (s.done ? null : { ...s, done: true });

/** Everyday words, from the app's own word lists: shown first in hints and the missed list. */
const FAMILIAR = new Set([...BASES, ...COMMON, ...HANGMAN.map((w) => w.toLowerCase()), ...Object.values(THEMES).flat()]);

/** Words you haven't found, everyday words first, then longest first. */
export function missed(s: State): string[] {
  return allWords(s.grid)
    .filter((w) => !s.found.includes(w))
    .sort((a, b) => Number(FAMILIAR.has(b)) - Number(FAMILIAR.has(a)) || b.length - a.length || a.localeCompare(b));
}

/** Hint: a word you haven't found (everyday first), and where it starts. */
export function hint(s: State): { word: string; start: number } | null {
  if (s.done) return null;
  const word = missed(s)[0];
  return word ? { word, start: pathFor(s.grid, word)![0] } : null;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  return (
    !!st &&
    Array.isArray(st.grid) &&
    st.grid.length === SIZE * SIZE &&
    st.grid.every((ch) => typeof ch === 'string' && /^[a-z]$/.test(ch)) &&
    Array.isArray(st.found) &&
    st.found.every((w) => typeof w === 'string') &&
    Number.isInteger(st.score) &&
    typeof st.done === 'boolean' &&
    Number.isInteger(st.best)
  );
}

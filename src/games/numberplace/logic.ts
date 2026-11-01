// Number place: fill the 9x9 grid so every row, column and 3x3 box holds 1 to 9 once.
// Puzzles are generated here, always with exactly one solution. Difficulty sets how many
// numbers start filled in. Pure functions: an entry returns a new State, or null.
import { shuffle, type Rng } from '../../core/random';

export type Level = 'easy' | 'medium' | 'hard';

export const LEVELS: Record<Level, { label: string; givens: number }> = {
  easy: { label: 'Easy', givens: 40 },
  medium: { label: 'Medium', givens: 32 },
  hard: { label: 'Hard', givens: 26 },
};

export interface State {
  level: Level;
  /** The starting numbers; 0 is empty. */
  puzzle: number[];
  solution: number[];
  /** Your numbers in the empty squares; 0 is empty. */
  entries: number[];
  /** Milliseconds of play. */
  elapsed: number;
  won: boolean;
}

const row = (i: number) => Math.floor(i / 9);
const col = (i: number) => i % 9;
const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

/** The squares that share a row, column or box with `i`. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter((j) => j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))),
);

/** Numbers that could go in square `i` of `grid` without clashing. */
function candidates(grid: number[], i: number): number[] {
  const used = new Set(PEERS[i].map((j) => grid[j]));
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !used.has(n));
}

/**
 * Counts solutions, up to `limit`, filling the emptiest-choice square first. With an
 * `rng`, tries numbers in random order and leaves the first solution in `grid`.
 */
function solve(grid: number[], limit: number, rng?: Rng): number {
  let best = -1;
  let options: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const c = candidates(grid, i);
    if (best < 0 || c.length < options.length) [best, options] = [i, c];
    if (!c.length) return 0;
  }
  if (best < 0) return 1;
  let found = 0;
  for (const n of rng ? shuffle(options, rng) : options) {
    grid[best] = n;
    found += solve(grid, limit - found, rng);
    if (found >= limit) return found; // keep the grid filled when we stop on a solution
    grid[best] = 0;
  }
  return found;
}

/** Solutions of `grid`, up to `limit`. A grid whose numbers already clash has none. */
export function countSolutions(grid: number[], limit = 2): number {
  if (grid.some((n, i) => n && PEERS[i].some((j) => grid[j] === n))) return 0;
  return solve(grid.slice(), limit);
}

/** Tries to reach the level's number of givens. One pass can get stuck a square or two
 *  short, when every remaining square is needed for a single answer: then a new grid is
 *  tried, keeping the closest. */
export function makePuzzle(level: Level, rng: Rng = Math.random): { puzzle: number[]; solution: number[] } {
  const givens = (p: number[]) => p.filter(Boolean).length;
  let best = carve(level, rng);
  for (let tries = 1; tries < PUZZLE_TRIES && givens(best.puzzle) > LEVELS[level].givens; tries++) {
    const next = carve(level, rng);
    if (givens(next.puzzle) < givens(best.puzzle)) best = next;
  }
  return best;
}

export const PUZZLE_TRIES = 5;

function carve(level: Level, rng: Rng): { puzzle: number[]; solution: number[] } {
  const solution = Array(81).fill(0);
  solve(solution, 1, rng);
  const puzzle = solution.slice();
  let givens = 81;
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k), rng)) {
    if (givens <= LEVELS[level].givens) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle) === 1) givens--;
    else puzzle[i] = keep;
  }
  return { puzzle, solution };
}

export function newGame(level: Level = 'easy', rng: Rng = Math.random): State {
  const { puzzle, solution } = makePuzzle(level, rng);
  return { level, puzzle, solution, entries: Array(81).fill(0), elapsed: 0, won: false };
}

/** What's showing in each square: the starting number or yours. */
export const shown = (s: State): number[] => s.puzzle.map((g, i) => g || s.entries[i]);

/** Squares whose number repeats in a row, column or box. */
export function clashes(s: State): Set<number> {
  const grid = shown(s);
  const out = new Set<number>();
  grid.forEach((n, i) => {
    if (n && PEERS[i].some((j) => grid[j] === n)) out.add(i);
  });
  return out;
}

/** Puts `n` (or 0 to erase) in an empty starting square. */
export function enter(s: State, i: number, n: number): State | null {
  if (s.won || !Number.isInteger(i) || i < 0 || i > 80 || s.puzzle[i] || !Number.isInteger(n) || n < 0 || n > 9) return null;
  const entries = s.entries.slice();
  entries[i] = n;
  const next = { ...s, entries };
  next.won = shown(next).every((v, k) => v === s.solution[k]);
  return next;
}

/**
 * The square a Hint should fill: the chosen one if it's empty or wrong, else a wrong
 * entry, else the empty square with the fewest possible numbers (the most logical next
 * step). -1 once solved.
 */
export function hintSquare(s: State, chosen = -1): number {
  if (s.won) return -1;
  const open = (i: number) => !s.puzzle[i] && s.entries[i] !== s.solution[i];
  if (chosen >= 0 && chosen < 81 && open(chosen)) return chosen;
  const wrong = s.entries.findIndex((n, i) => n > 0 && n !== s.solution[i]);
  if (wrong >= 0) return wrong;
  const grid = shown(s);
  let best = -1;
  let fewest = 10;
  for (let i = 0; i < 81; i++) {
    if (!open(i)) continue;
    const n = candidates(grid, i).length;
    if (n < fewest) [best, fewest] = [i, n];
  }
  return best;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const grid = (g: unknown) => Array.isArray(g) && g.length === 81 && g.every((n) => Number.isInteger(n) && n >= 0 && n <= 9);
  return (
    !!st &&
    st.level in LEVELS &&
    grid(st.puzzle) &&
    grid(st.solution) &&
    grid(st.entries) &&
    st.solution.every((n) => n > 0) &&
    st.puzzle.every((n, i) => !n || n === st.solution[i]) &&
    typeof st.elapsed === 'number' &&
    typeof st.won === 'boolean'
  );
}

// Cross Sums: fill the white squares with 1 to 9. Each clue gives the total of the run of
// white squares to its right (across) or below it (down), and a run never repeats a
// digit. Every puzzle has exactly one answer, checked by a solver before it's dealt.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { randomInt, shuffle, type Rng } from '../../core/random';

/** The board is SIZE by SIZE squares: the top row and left column hold only clues. */
export const SIZE = 6;
const N = SIZE * SIZE;

/** A run of white squares, and the total it must make. */
export interface Run {
  cells: number[];
  sum: number;
}

export interface State {
  /** Which squares are white (to fill); the rest are black or clue squares. */
  white: boolean[];
  /** The answer, 1 to 9 in white squares (0 elsewhere). */
  solution: number[];
  /** What you've written, 0 for empty. */
  grid: number[];
  /** Squares Hint filled in (they count as given). */
  hinted: boolean[];
  /** The square you're writing in, or null. */
  selected: number | null;
  solved: number;
}

/** The across and down runs of white squares, each with the square whose clue it is. */
export function runsOf(white: boolean[]): { clue: number; down: boolean; cells: number[] }[] {
  const out: { clue: number; down: boolean; cells: number[] }[] = [];
  for (const down of [false, true]) {
    for (let line = 0; line < SIZE; line++) {
      let run: number[] = [];
      for (let k = 0; k <= SIZE; k++) {
        const i = down ? k * SIZE + line : line * SIZE + k;
        if (k < SIZE && white[i]) run.push(i);
        else {
          if (run.length) out.push({ clue: run[0] - (down ? SIZE : 1), down, cells: run });
          run = [];
        }
      }
    }
  }
  return out;
}

/** The clues: each run with its total. */
export const runs = (s: Pick<State, 'white' | 'solution'>): (Run & { clue: number; down: boolean })[] =>
  runsOf(s.white).map((r) => ({ ...r, sum: r.cells.reduce((t, c) => t + s.solution[c], 0) }));

/**
 * Black squares in the 5 by 5 area, mirrored through the center, every run 2 to 4 squares
 * long (longer runs leave too many answers to make a puzzle with just one).
 */
function randomShape(rng: Rng): boolean[] {
  for (;;) {
    const white = Array.from({ length: N }, (_, i) => i >= SIZE && i % SIZE !== 0);
    const blacks = 4 + randomInt(4, rng);
    for (let b = 0; b < blacks; b++) {
      const r = 1 + randomInt(SIZE - 1, rng);
      const c = 1 + randomInt(SIZE - 1, rng);
      white[r * SIZE + c] = false;
      white[(SIZE - r) * SIZE + (SIZE - c)] = false; // the mirror square
    }
    const all = runsOf(white);
    const covered = white.every((w, i) => !w || all.filter((r) => r.cells.includes(i)).length === 2);
    if (covered && all.every((r) => r.cells.length >= 2 && r.cells.length <= 4)) return white;
  }
}

/** Fills the white squares at random, no digit twice in a run. Null if it gets stuck. */
function randomFill(white: boolean[], rng: Rng): number[] | null {
  const all = runsOf(white);
  const grid = Array<number>(N).fill(0);
  const cells = white.flatMap((w, i) => (w ? [i] : []));
  const fill = (k: number): boolean => {
    if (k === cells.length) return true;
    const c = cells[k];
    const mine = all.filter((r) => r.cells.includes(c));
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
      if (mine.some((r) => r.cells.some((x) => grid[x] === d))) continue;
      grid[c] = d;
      if (fill(k + 1)) return true;
      grid[c] = 0;
    }
    return false;
  };
  return fill(0) ? grid : null;
}

/**
 * The answers the clues allow, up to `limit` of them: a search that only tries digits a
 * run's total can still reach.
 */
export function solutions(white: boolean[], sums: { cells: number[]; sum: number }[], limit = 2): number[][] {
  const found: number[][] = [];
  const grid = Array<number>(N).fill(0);
  const cells = white.flatMap((w, i) => (w ? [i] : []));
  const runsBy = new Map(cells.map((c) => [c, sums.filter((r) => r.cells.includes(c))]));
  const ok = (r: { cells: number[]; sum: number }) => {
    const filled = r.cells.filter((c) => grid[c]);
    const total = filled.reduce((t, c) => t + grid[c], 0);
    const left = r.cells.length - filled.length;
    if (!left) return total === r.sum;
    // The rest must fit between the smallest and largest unused digits.
    const unused = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !filled.some((c) => grid[c] === d));
    const low = unused.slice(0, left).reduce((a, b) => a + b, 0);
    const high = unused.slice(-left).reduce((a, b) => a + b, 0);
    return total + low <= r.sum && total + high >= r.sum;
  };
  const solve = (k: number) => {
    if (found.length >= limit) return;
    if (k === cells.length) {
      found.push(grid.slice());
      return;
    }
    const c = cells[k];
    const mine = runsBy.get(c)!;
    for (let d = 1; d <= 9; d++) {
      if (mine.some((r) => r.cells.some((x) => grid[x] === d))) continue;
      grid[c] = d;
      if (mine.every(ok)) solve(k + 1);
      grid[c] = 0;
    }
  };
  solve(0);
  return found;
}

/** How many answers the clues allow, counting up to `limit`. */
export const countSolutions = (white: boolean[], sums: { cells: number[]; sum: number }[], limit = 2): number => solutions(white, sums, limit).length;

/**
 * A new puzzle with exactly one answer. A random fill's clues usually allow several
 * answers. While they do, every way to change one digit where the answers disagree is
 * tried, and the change leaving the fewest answers is kept (changing a digit changes its
 * runs' totals), until only one answer is left.
 */
export function newPuzzle(solved = 0, rng: Rng = Math.random): State {
  const COUNT = 12; // count answers up to this many when comparing changes
  for (;;) {
    const white = randomShape(rng);
    const all = runsOf(white);
    const solution = randomFill(white, rng);
    if (!solution) continue;
    let answers = solutions(white, runs({ white, solution }), COUNT);
    for (let step = 0; step < 40 && answers.length > 1; step++) {
      const unsure = white.flatMap((w, i) => (w && answers.some((ans) => ans[i] !== solution[i]) ? [i] : []));
      let best: { cell: number; digit: number; answers: number[][] } | null = null;
      for (const cell of shuffle(unsure, rng)) {
        const mine = all.filter((r) => r.cells.includes(cell));
        const was = solution[cell];
        for (let digit = 1; digit <= 9; digit++) {
          if (digit === was || mine.some((r) => r.cells.some((x) => x !== cell && solution[x] === digit))) continue;
          solution[cell] = digit;
          const found = solutions(white, runs({ white, solution }), best ? best.answers.length : COUNT);
          if (!best || found.length < best.answers.length) best = { cell, digit, answers: found };
          solution[cell] = was;
        }
      }
      if (!best || best.answers.length >= answers.length) break; // stuck: try a new shape
      solution[best.cell] = best.digit;
      answers = best.answers;
    }
    if (answers.length === 1) {
      return { white, solution, grid: Array<number>(N).fill(0), hinted: Array<boolean>(N).fill(false), selected: null, solved };
    }
  }
}

export const isWon = (s: State): boolean => s.white.every((w, i) => !w || s.grid[i] === s.solution[i]);
export const left = (s: State): number => s.white.filter((w, i) => w && !s.grid[i]).length;

/** Squares whose digit repeats in a run, to show as mistakes. */
export function repeats(s: State): Set<number> {
  const out = new Set<number>();
  for (const r of runsOf(s.white)) {
    for (const c of r.cells) if (s.grid[c] && r.cells.some((x) => x !== c && s.grid[x] === s.grid[c])) out.add(c);
  }
  return out;
}

/** Picks the square to write in (tapping it again keeps it picked, ready for a new digit). */
export function select(s: State, cell: number): State | null {
  if (!s.white[cell] || isWon(s)) return null;
  return { ...s, selected: cell };
}

/** Writes a digit (0 erases) in the selected square. */
export function write(s: State, digit: number): State | null {
  if (s.selected === null || isWon(s) || s.hinted[s.selected] || !(digit >= 0 && digit <= 9)) return null;
  const grid = s.grid.slice();
  grid[s.selected] = digit;
  const next = { ...s, grid };
  return isWon(next) ? { ...next, selected: null, solved: s.solved + 1 } : next;
}

/**
 * Hint fills one square: the one you picked if it's empty or wrong, else a wrong one,
 * else the square with the fewest digits its runs allow.
 */
export function hint(s: State): State | null {
  if (isWon(s)) return null;
  const wrong = (i: number) => s.white[i] && s.grid[i] !== s.solution[i];
  let cell = s.selected !== null && wrong(s.selected) ? s.selected : s.grid.findIndex((d, i) => s.white[i] && d && d !== s.solution[i]);
  if (cell < 0) {
    const empty = s.white.flatMap((w, i) => (w && !s.grid[i] ? [i] : []));
    const choices = (i: number) => runsOf(s.white).filter((r) => r.cells.includes(i)).reduce((n, r) => n + r.cells.length, 0);
    cell = empty.sort((a, b) => choices(a) - choices(b))[0];
  }
  const grid = s.grid.slice();
  grid[cell] = s.solution[cell];
  const hinted = s.hinted.slice();
  hinted[cell] = true;
  const next = { ...s, grid, hinted, selected: cell };
  return isWon(next) ? { ...next, selected: null, solved: s.solved + 1 } : next;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const list = (a: unknown, ok: (v: unknown) => boolean) => Array.isArray(a) && a.length === N && a.every(ok);
  const digit = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 9;
  return (
    !!st &&
    list(st.white, (v) => typeof v === 'boolean') &&
    list(st.solution, digit) &&
    list(st.grid, digit) &&
    list(st.hinted, (v) => typeof v === 'boolean') &&
    st.white.every((w, i) => (w ? st.solution[i] > 0 : st.solution[i] === 0 && st.grid[i] === 0)) &&
    (st.selected === null || (Number.isInteger(st.selected) && st.white[st.selected])) &&
    Number.isInteger(st.solved)
  );
}

import { shuffle, type Rng } from '../../core/random';

export type Level = 'easy' | 'medium' | 'hard';
export type Status = 'ready' | 'playing' | 'won' | 'lost';

export const LEVELS: Record<Level, { label: string; cols: number; rows: number; mines: number }> = {
  easy: { label: 'Easy', cols: 6, rows: 6, mines: 5 },
  medium: { label: 'Medium', cols: 9, rows: 9, mines: 10 },
  hard: { label: 'Hard', cols: 12, rows: 12, mines: 22 },
};

export interface State {
  level: Level;
  mines: boolean[] | null; // null until the first dig, so the first tap is always safe
  revealed: boolean[];
  flagged: boolean[];
  status: Status;
  elapsed: number; // ms of play time (managed by the UI clock)
  exploded: number; // index of the mine that ended the game, or -1
}

export function newState(level: Level): State {
  const { cols, rows } = LEVELS[level];
  const n = cols * rows;
  return {
    level,
    mines: null,
    revealed: Array<boolean>(n).fill(false),
    flagged: Array<boolean>(n).fill(false),
    status: 'ready',
    elapsed: 0,
    exploded: -1,
  };
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  if (!st || typeof st.level !== 'string' || !Object.hasOwn(LEVELS, st.level)) return false;
  const { cols, rows } = LEVELS[st.level];
  const n = cols * rows;
  return (
    Array.isArray(st.revealed) &&
    st.revealed.length === n &&
    Array.isArray(st.flagged) &&
    st.flagged.length === n &&
    (st.mines === null || (Array.isArray(st.mines) && st.mines.length === n))
  );
}

export function neighbors(i: number, cols: number, rows: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  }
  return out;
}

/** Places mines anywhere except the first tapped cell and its neighbors. */
export function placeMines(level: Level, safe: number, rng: Rng = Math.random): boolean[] {
  const { cols, rows, mines } = LEVELS[level];
  const excluded = new Set([safe, ...neighbors(safe, cols, rows)]);
  const candidates = [...Array(cols * rows).keys()].filter((i) => !excluded.has(i));
  const result = Array<boolean>(cols * rows).fill(false);
  for (const i of shuffle(candidates, rng).slice(0, mines)) result[i] = true;
  return result;
}

const around = (state: State, i: number) => {
  const { cols, rows } = LEVELS[state.level];
  return neighbors(i, cols, rows);
};

/** Number of mines touching cell i. */
export function countAt(state: State, i: number): number {
  return around(state, i).filter((j) => state.mines?.[j]).length;
}

export function flagsLeft(state: State): number {
  return LEVELS[state.level].mines - state.flagged.filter(Boolean).length;
}

export function isFinished(state: State): boolean {
  return state.status === 'won' || state.status === 'lost';
}

/** Reveals a cell, flood-filling through empty areas. Returns true if it was a mine. */
function reveal(state: State, start: number): boolean {
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (state.revealed[i] || state.flagged[i]) continue;
    state.revealed[i] = true;
    if (state.mines![i]) return true;
    if (countAt(state, i) === 0) stack.push(...around(state, i));
  }
  return false;
}

function lose(state: State, i: number) {
  state.status = 'lost';
  state.exploded = i;
}

function checkWin(state: State) {
  if (state.status !== 'playing') return;
  const safeCells = state.revealed.length - LEVELS[state.level].mines;
  if (state.revealed.filter(Boolean).length < safeCells) return;
  state.status = 'won';
  state.flagged = state.mines!.slice();
}

/** Tapping a number whose flags are all placed reveals its other neighbors. */
function chord(state: State, i: number) {
  const n = countAt(state, i);
  const nb = around(state, i);
  if (!n || nb.filter((j) => state.flagged[j]).length !== n) return;
  for (const j of nb) {
    if (!state.revealed[j] && !state.flagged[j] && reveal(state, j)) {
      lose(state, j);
      return;
    }
  }
}

/**
 * Opens cell i: digs a hidden cell, or chords a revealed number.
 * The first dig places the mines. Mutates `state`.
 */
export function open(state: State, i: number, rng: Rng = Math.random): void {
  if (isFinished(state) || state.flagged[i]) return;
  if (!state.mines) {
    state.mines = placeMines(state.level, i, rng);
    state.status = 'playing';
  }
  if (state.revealed[i]) chord(state, i);
  else if (reveal(state, i)) lose(state, i);
  checkWin(state);
}

/** Flags or unflags a hidden cell. Returns true if anything changed. Mutates `state`. */
export function toggleFlag(state: State, i: number): boolean {
  if (isFinished(state) || state.revealed[i]) return false;
  state.flagged[i] = !state.flagged[i];
  return true;
}

// --- Hint: a square that's certainly safe (or certainly a mine), and why ---

export interface Deduction {
  /** The square the numbers prove something about. */
  cell: number;
  /** Safe to dig, or certainly a mine (flag it). */
  safe: boolean;
  /** The revealed numbers that prove it: one, or two compared. */
  clues: number[];
  /** How: the number's mines are all found ("full"), its hidden squares are all mines ("all"), or two numbers compared ("pair"). */
  rule: 'full' | 'all' | 'pair';
}

/**
 * A square the revealed numbers prove safe (first choice) or a mine, as a player would
 * reason it out. Flags aren't trusted (they might be wrong); mines proved along the way
 * are. Null when no square is certain: the next dig is a guess.
 */
export function deduce(state: State): Deduction | null {
  if (!state.mines) return null;
  const n = state.revealed.length;
  const mine = Array<boolean>(n).fill(false); // proved mines
  const clues = [...Array(n).keys()].filter((i) => state.revealed[i] && !state.mines![i] && around(state, i).some((j) => !state.revealed[j]));
  /** A clue's hidden squares not yet proved, and how many mines are still among them. */
  const open = (c: number) => {
    const hidden = around(state, c).filter((j) => !state.revealed[j]);
    const unknown = hidden.filter((j) => !mine[j]);
    return { unknown, left: countAt(state, c) - (hidden.length - unknown.length) };
  };
  const best: { found: Deduction | null } = { found: null };
  const note = (d: Deduction) => {
    if (d.safe) {
      if (!best.found?.safe) best.found = d;
    } else {
      mine[d.cell] = true;
      best.found ??= d;
    }
  };
  for (let changed = true; changed && !best.found?.safe; ) {
    changed = false;
    for (const c of clues) {
      const { unknown, left } = open(c);
      if (!unknown.length) continue;
      if (left === 0) {
        note({ cell: unknown[0], safe: true, clues: [c], rule: 'full' });
        break;
      }
      if (left === unknown.length) {
        unknown.forEach((cell) => note({ cell, safe: false, clues: [c], rule: 'all' }));
        changed = true;
      }
    }
    if (best.found?.safe || changed) continue;
    // Two numbers compared: when one's unknown squares all touch the other, the other's
    // extra squares hold exactly the difference in their mines.
    for (const a of clues) {
      const A = open(a);
      if (!A.unknown.length) continue;
      for (const b of clues) {
        if (a === b) continue;
        const B = open(b);
        if (!A.unknown.every((j) => B.unknown.includes(j))) continue;
        const extra = B.unknown.filter((j) => !A.unknown.includes(j));
        if (!extra.length) continue;
        const diff = B.left - A.left;
        if (diff === 0) {
          note({ cell: extra[0], safe: true, clues: [a, b], rule: 'pair' });
          break;
        }
        if (diff === extra.length) {
          extra.forEach((cell) => note({ cell, safe: false, clues: [a, b], rule: 'pair' }));
          changed = true;
        }
      }
      if (best.found?.safe) break;
    }
  }
  return best.found;
}

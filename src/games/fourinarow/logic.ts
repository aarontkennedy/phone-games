// Four in a row: drop discs into a 7-wide, 6-high grid; four in a line (across, down or
// diagonal) wins. You are player 0, the computer player 1. Who starts alternates.
// Pure functions: a move returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Disc = 0 | 1;
export type Result = Disc | 'draw' | null;

export const COLS = 7;
export const ROWS = 6;

export interface State {
  level: Level;
  /** Row by row from the top: index = row * COLS + col. */
  board: (Disc | null)[];
  turn: Disc;
  starter: Disc;
  result: Result;
  line: number[] | null;
  /** The last disc dropped, to highlight it. */
  last: number | null;
  tally: { you: number; computer: number; draws: number };
}

export function newGame(level: Level = 'strong'): State {
  return { level, board: Array(COLS * ROWS).fill(null), turn: 0, starter: 0, result: null, line: null, last: null, tally: { you: 0, computer: 0, draws: 0 } };
}

export function newRound(s: State): State {
  const starter: Disc = s.starter === 0 ? 1 : 0;
  return { ...newGame(s.level), turn: starter, starter, tally: { ...s.tally } };
}

/** The row a disc dropped in `col` lands in, or -1 if the column is full. */
export function landingRow(board: (Disc | null)[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + col] === null) return r;
  return -1;
}

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Four (or more) in a line through `idx`, or null. */
export function lineThrough(board: (Disc | null)[], idx: number): number[] | null {
  const p = board[idx];
  if (p === null) return null;
  const r0 = Math.floor(idx / COLS);
  const c0 = idx % COLS;
  for (const [dr, dc] of DIRS) {
    const cells = [idx];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === p) {
        cells.push(r * COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) return cells.sort((a, b) => a - b);
  }
  return null;
}

export function drop(s: State, col: number): State | null {
  if (s.result !== null || !Number.isInteger(col) || col < 0 || col >= COLS) return null;
  const row = landingRow(s.board, col);
  if (row < 0) return null;
  const board = s.board.slice();
  const idx = row * COLS + col;
  board[idx] = s.turn;
  const line = lineThrough(board, idx);
  const result: Result = line ? s.turn : board.every((d) => d !== null) ? 'draw' : null;
  const tally = { ...s.tally };
  if (result === 0) tally.you++;
  else if (result === 1) tally.computer++;
  else if (result === 'draw') tally.draws++;
  return { ...s, board, line, last: idx, result, tally, turn: s.turn === 0 ? 1 : 0 };
}

const open = (board: (Disc | null)[]) => [3, 2, 4, 1, 5, 0, 6].filter((c) => landingRow(board, c) >= 0);

/** How good a position is for `p`: open lines of 2 and 3, and discs in the middle column. */
export function evaluate(board: (Disc | null)[], p: Disc): number {
  const q = p === 0 ? 1 : 0;
  let score = 0;
  for (let r = 0; r < ROWS; r++) if (board[r * COLS + 3] === p) score += 3;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < 4; k++) {
          const d = board[(r + dr * k) * COLS + c + dc * k];
          if (d === p) mine++;
          else if (d === q) theirs++;
        }
        if (mine && theirs) continue;
        if (mine === 3) score += 5;
        else if (mine === 2) score += 2;
        else if (theirs === 3) score -= 4;
      }
    }
  }
  return score;
}

const WIN = 1_000_000;

function negamax(board: (Disc | null)[], depth: number, alpha: number, beta: number, p: Disc): number {
  const cols = open(board);
  if (!cols.length) return 0;
  if (depth === 0) return evaluate(board, p);
  let best = -Infinity;
  for (const c of cols) {
    const idx = landingRow(board, c) * COLS + c;
    board[idx] = p;
    const v = lineThrough(board, idx) ? WIN + depth : -negamax(board, depth - 1, -beta, -alpha, p === 0 ? 1 : 0);
    board[idx] = null;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Search depth for Strong: enough to see most traps without making you wait. */
export const DEPTH = 5;

/** Easy takes a win or blocks one it can see, otherwise plays anywhere. Strong searches ahead. */
export function chooseColumn(s: State, rng: Rng = Math.random): number {
  const cols = open(s.board);
  const me = s.turn;
  const winsFor = (p: Disc) =>
    cols.find((c) => {
      const b = s.board.slice();
      const idx = landingRow(b, c) * COLS + c;
      b[idx] = p;
      return lineThrough(b, idx);
    });
  const win = winsFor(me);
  if (win !== undefined) return win;
  if (s.level === 'easy') {
    const block = winsFor(me === 0 ? 1 : 0);
    return block !== undefined && rng() < 0.7 ? block : cols[randomInt(cols.length, rng)];
  }
  const board = s.board.slice();
  let best = cols[0];
  let bestScore = -Infinity;
  for (const c of cols) {
    const idx = landingRow(board, c) * COLS + c;
    board[idx] = me;
    const v = -negamax(board, DEPTH - 1, -Infinity, Infinity, me === 0 ? 1 : 0);
    board[idx] = null;
    if (v > bestScore) [best, bestScore] = [c, v];
  }
  return best;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const disc = (d: unknown) => d === 0 || d === 1;
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    Array.isArray(st.board) &&
    st.board.length === COLS * ROWS &&
    st.board.every((d) => d === null || disc(d)) &&
    disc(st.turn) &&
    disc(st.starter) &&
    (st.result === null || st.result === 'draw' || disc(st.result)) &&
    !!st.tally &&
    typeof st.tally.you === 'number' &&
    typeof st.tally.computer === 'number' &&
    typeof st.tally.draws === 'number'
  );
}

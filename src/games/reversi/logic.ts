// Reversi on an 8x8 board, you (0) against the computer (1). Place a disc so that it traps
// a straight line of the other side's discs between it and one of yours: the trapped
// discs flip to your side. If you can't trap anything you pass. The game ends when
// neither side can move, and the side with more discs wins. Who moves first alternates
// each round. Pure functions: a move returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Side = 0 | 1;
export type Cell = Side | null;
export type Result = Side | 'draw' | null;

export const SIZE = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
/** Strong searches this many moves ahead, and plays perfectly once few squares are left. */
export const DEPTH = 4;
export const ENDGAME = 8;

export interface State {
  level: Level;
  board: Cell[];
  turn: Side;
  starter: Side;
  result: Result;
  /** The square just played, so the computer's move is easy to see. */
  last: number | null;
  /** Set when a side had no move and had to pass. */
  passed: Side | null;
  /** Rounds won by you and by the computer. */
  tally: { you: number; computer: number };
}

export const other = (s: Side): Side => (s === 0 ? 1 : 0);

function startBoard(): Cell[] {
  const b: Cell[] = Array(SIZE * SIZE).fill(null);
  b[27] = b[36] = 1;
  b[28] = b[35] = 0;
  return b;
}

export function newGame(level: Level = 'strong'): State {
  return { level, board: startBoard(), turn: 0, starter: 0, result: null, last: null, passed: null, tally: { you: 0, computer: 0 } };
}

/** A fresh board; the other side starts. Keeps the tally. */
export function newRound(s: State): State {
  const starter = other(s.starter);
  return { ...s, board: startBoard(), turn: starter, starter, result: null, last: null, passed: null, tally: { ...s.tally } };
}

/** The discs that playing `side` at `i` would flip, or [] if it isn't a legal move. */
export function flips(board: Cell[], side: Side, i: number): number[] {
  if (board[i] !== null) return [];
  const r0 = Math.floor(i / SIZE);
  const c0 = i % SIZE;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === other(side)) {
      line.push(r * SIZE + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === side) out.push(...line);
  }
  return out;
}

export function legalMoves(board: Cell[], side: Side): number[] {
  return board.flatMap((_, i) => (flips(board, side, i).length ? [i] : []));
}

export const count = (board: Cell[], side: Side): number => board.filter((c) => c === side).length;

function place(board: Cell[], side: Side, i: number, flipped: number[]): Cell[] {
  const next = board.slice();
  next[i] = side;
  for (const f of flipped) next[f] = side;
  return next;
}

export function move(s: State, i: number): State | null {
  if (s.result !== null) return null;
  const flipped = flips(s.board, s.turn, i);
  if (!flipped.length) return null;
  const board = place(s.board, s.turn, i, flipped);
  const next = { ...s, board, last: i, passed: null };
  if (legalMoves(board, other(s.turn)).length) return { ...next, turn: other(s.turn) };
  if (legalMoves(board, s.turn).length) return { ...next, passed: other(s.turn) };
  const [you, computer] = [count(board, 0), count(board, 1)];
  const result: Result = you > computer ? 0 : computer > you ? 1 : 'draw';
  return {
    ...next,
    result,
    tally: { you: s.tally.you + (result === 0 ? 1 : 0), computer: s.tally.computer + (result === 1 ? 1 : 0) },
  };
}

// Corners are worth the most; the squares next to them give corners away.
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];
const CORNERS = [0, 7, 56, 63];

/** How good the board is for `side`: position, plus having more moves than the other side. */
export function evaluate(board: Cell[], side: Side): number {
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === side) score += WEIGHTS[i];
    else if (board[i] !== null) score -= WEIGHTS[i];
  }
  return score + 5 * (legalMoves(board, side).length - legalMoves(board, other(side)).length);
}

function search(board: Cell[], side: Side, depth: number, alpha: number, beta: number, exact: boolean): number {
  const moves = legalMoves(board, side);
  if (!moves.length) {
    if (!legalMoves(board, other(side)).length) return 1000 * (count(board, side) - count(board, other(side)));
    return -search(board, other(side), depth, -beta, -alpha, exact);
  }
  if (!exact && depth === 0) return evaluate(board, side);
  let best = -Infinity;
  for (const m of moves) {
    const v = -search(place(board, side, m, flips(board, side, m)), other(side), depth - 1, -beta, -alpha, exact);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's move. Easy grabs corners and otherwise plays at random. */
export function chooseMove(s: State, rng: Rng = Math.random): number {
  const moves = legalMoves(s.board, s.turn);
  if (s.level === 'easy') {
    const corner = moves.find((m) => CORNERS.includes(m));
    return corner ?? moves[randomInt(moves.length, rng)];
  }
  const exact = s.board.filter((c) => c === null).length <= ENDGAME;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const v = -search(place(s.board, s.turn, m, flips(s.board, s.turn, m)), other(s.turn), DEPTH - 1, -Infinity, -bestScore, exact);
    if (v > bestScore) [best, bestScore] = [m, v];
  }
  return best;
}

export function isValidState(s: unknown): s is State {
  if (!s || typeof s !== 'object') return false;
  const st = s as State;
  const side = (v: unknown) => v === 0 || v === 1;
  return (
    (st.level === 'easy' || st.level === 'strong') &&
    Array.isArray(st.board) &&
    st.board.length === SIZE * SIZE &&
    st.board.every((c) => c === null || side(c)) &&
    side(st.turn) &&
    side(st.starter) &&
    (st.result === null || st.result === 'draw' || side(st.result)) &&
    (st.last === null || (Number.isInteger(st.last) && st.last >= 0 && st.last < SIZE * SIZE)) &&
    (st.passed === null || side(st.passed)) &&
    !!st.tally &&
    Number.isInteger(st.tally.you) &&
    Number.isInteger(st.tally.computer) &&
    (st.result !== null || legalMoves(st.board, st.turn).length > 0)
  );
}

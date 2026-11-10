// Checkers (American rules) on the dark squares of an 8x8 board. You are player 0 at the
// bottom, moving up; the computer is player 1 at the top. Men move diagonally forward;
// kings move both ways. Jumps are compulsory, and a jumping piece keeps jumping while it
// can. Reaching the far row makes a king (and ends the move). You lose with no pieces or
// no moves. 50 moves in a row with no capture is a draw.
// Pure functions: a move returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Side = 0 | 1;
export type Result = Side | 'draw' | null;

export interface Piece {
  side: Side;
  king: boolean;
}

export interface Move {
  from: number;
  /** Squares landed on, in order. One for a step, more for a multi-jump. */
  path: number[];
  /** Squares of the pieces jumped. */
  captured: number[];
}

export interface State {
  level: Level;
  /** 64 squares, row by row from the top. Only dark squares hold pieces. */
  board: (Piece | null)[];
  turn: Side;
  starter: Side;
  result: Result;
  /** Moves (by either side) since the last capture. */
  quiet: number;
  last: Move | null;
  tally: { you: number; computer: number; draws: number };
}

export const DRAW_AFTER = 100; // 50 moves each

const rc = (i: number) => [Math.floor(i / 8), i % 8] as const;
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
export const isDark = (i: number) => (Math.floor(i / 8) + (i % 8)) % 2 === 1;

export function startBoard(): (Piece | null)[] {
  return Array.from({ length: 64 }, (_, i) => {
    if (!isDark(i)) return null;
    const r = Math.floor(i / 8);
    return r < 3 ? { side: 1, king: false } : r > 4 ? { side: 0, king: false } : null;
  });
}

export function newGame(level: Level = 'strong'): State {
  return { level, board: startBoard(), turn: 0, starter: 0, result: null, quiet: 0, last: null, tally: { you: 0, computer: 0, draws: 0 } };
}

export function newRound(s: State): State {
  const starter: Side = s.starter === 0 ? 1 : 0;
  return { ...newGame(s.level), turn: starter, starter, tally: { ...s.tally } };
}

const directions = (p: Piece) => (p.king ? [-1, 1] : p.side === 0 ? [-1] : [1]).flatMap((dr) => [[dr, -1], [dr, 1]]);

/** All jump sequences for the piece at `from`, following every branch. */
function jumps(board: (Piece | null)[], from: number, piece: Piece): Move[] {
  const out: Move[] = [];
  const walk = (sq: number, path: number[], captured: number[]) => {
    const [r, c] = rc(sq);
    let extended = false;
    for (const [dr, dc] of directions(piece)) {
      const over = at(r + dr, c + dc);
      const land = at(r + 2 * dr, c + 2 * dc);
      if (over < 0 || land < 0 || captured.includes(over)) continue;
      const victim = board[over];
      if (!victim || victim.side === piece.side || (board[land] && land !== from)) continue;
      extended = true;
      const crowned = !piece.king && Math.floor(land / 8) === (piece.side === 0 ? 0 : 7);
      if (crowned) out.push({ from, path: [...path, land], captured: [...captured, over] });
      else walk(land, [...path, land], [...captured, over]);
    }
    if (!extended && path.length) out.push({ from, path, captured });
  };
  walk(from, [], []);
  return out;
}

/** Every legal move for `side`. If any jump exists, only jumps are legal. */
export function legalMoves(board: (Piece | null)[], side: Side): Move[] {
  const steps: Move[] = [];
  const caps: Move[] = [];
  board.forEach((p, i) => {
    if (!p || p.side !== side) return;
    caps.push(...jumps(board, i, p));
    const [r, c] = rc(i);
    for (const [dr, dc] of directions(p)) {
      const to = at(r + dr, c + dc);
      if (to >= 0 && !board[to]) steps.push({ from: i, path: [to], captured: [] });
    }
  });
  return caps.length ? caps : steps;
}

export function applyMove(board: (Piece | null)[], m: Move): (Piece | null)[] {
  const b = board.slice();
  const piece = { ...b[m.from]! };
  const to = m.path.at(-1)!;
  b[m.from] = null;
  for (const c of m.captured) b[c] = null;
  if (Math.floor(to / 8) === (piece.side === 0 ? 0 : 7)) piece.king = true;
  b[to] = piece;
  return b;
}

const sameMove = (a: Move, b: Move) => a.from === b.from && a.path.join() === b.path.join();

export function move(s: State, m: Move): State | null {
  if (s.result !== null || !legalMoves(s.board, s.turn).some((x) => sameMove(x, m))) return null;
  const board = applyMove(s.board, m);
  const turn: Side = s.turn === 0 ? 1 : 0;
  const quiet = m.captured.length ? 0 : s.quiet + 1;
  let result: Result = null;
  if (!legalMoves(board, turn).length) result = s.turn;
  else if (quiet >= DRAW_AFTER) result = 'draw';
  const tally = { ...s.tally };
  if (result === 0) tally.you++;
  else if (result === 1) tally.computer++;
  else if (result === 'draw') tally.draws++;
  return { ...s, board, turn, quiet, result, last: m, tally };
}

export const count = (board: (Piece | null)[], side: Side) => board.filter((p) => p?.side === side).length;

/** Material and position for `side`: kings are worth more, men gain a little as they advance. */
export function evaluate(board: (Piece | null)[], side: Side): number {
  let score = 0;
  board.forEach((p, i) => {
    if (!p) return;
    const r = Math.floor(i / 8);
    const c = i % 8;
    const advance = p.king ? 0 : p.side === 0 ? 7 - r : r;
    const center = c >= 2 && c <= 5 ? 3 : 0;
    const v = (p.king ? 160 : 100) + advance * 3 + center;
    score += p.side === side ? v : -v;
  });
  return score;
}

function search(board: (Piece | null)[], side: Side, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(board, side);
  if (!moves.length) return -10_000 - depth; // no moves: a loss, sooner is worse
  if (depth === 0) return evaluate(board, side);
  let best = -Infinity;
  for (const m of moves) {
    const v = -search(applyMove(board, m), side === 0 ? 1 : 0, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export const DEPTH = 4;

/** Easy plays any legal move. Strong searches a few moves ahead. */
export function chooseMove(s: State, rng: Rng = Math.random): Move {
  const moves = legalMoves(s.board, s.turn);
  if (s.level === 'easy' || moves.length === 1) return moves[randomInt(moves.length, rng)];
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const v = -search(applyMove(s.board, m), s.turn === 0 ? 1 : 0, DEPTH - 1, -Infinity, Infinity);
    if (v > bestScore) [best, bestScore] = [m, v];
  }
  return best;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const side = (x: unknown) => x === 0 || x === 1;
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    Array.isArray(st.board) &&
    st.board.length === 64 &&
    st.board.every((p) => p === null || (side(p?.side) && typeof p.king === 'boolean')) &&
    side(st.turn) &&
    side(st.starter) &&
    (st.result === null || st.result === 'draw' || side(st.result)) &&
    typeof st.quiet === 'number' &&
    !!st.tally &&
    typeof st.tally.you === 'number' &&
    typeof st.tally.computer === 'number' &&
    typeof st.tally.draws === 'number'
  );
}

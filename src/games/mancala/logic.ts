// Mancala (the common six-pit version), you (0) against the computer (1). Each side has
// six pits of four seeds and a store. Pick up every seed in one of your pits and sow them
// one by one, counter-clockwise, into the next pits and your own store (never the other
// store). End in your store: go again. End in an empty pit of yours with seeds opposite:
// capture both into your store. When either row is empty the game ends, and the seeds
// left in the other row go to that side's store. Most seeds wins.
// Pure functions: a move returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Side = 0 | 1;
export type Result = Side | 'draw' | null;

export const PITS = 6;
export const SEEDS = 4;
/** Board indexes: your pits 0-5, your store 6, the computer's pits 7-12, its store 13. */
export const STORE: Record<Side, number> = { 0: 6, 1: 13 };
/** Strong looks this many moves ahead (an extra turn counts as a move). */
export const DEPTH = 7;

export interface State {
  level: Level;
  board: number[];
  turn: Side;
  starter: Side;
  result: Result;
  /** The pit just played and where its last seed landed, to show the move. */
  last: { side: Side; pit: number; end: number; captured: number; again: boolean } | null;
  tally: { you: number; computer: number; draws: number };
}

export const other = (s: Side): Side => (s === 0 ? 1 : 0);
export const pitsOf = (side: Side): number[] => Array.from({ length: PITS }, (_, i) => i + (side === 0 ? 0 : 7));
/** The pit straight across the board. */
export const opposite = (i: number): number => 12 - i;

function startBoard(): number[] {
  return Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : SEEDS));
}

export function newGame(level: Level = 'strong'): State {
  return { level, board: startBoard(), turn: 0, starter: 0, result: null, last: null, tally: { you: 0, computer: 0, draws: 0 } };
}

/** A fresh board; the other side starts. Keeps the tally. */
export function newRound(s: State): State {
  const starter = other(s.starter);
  return { ...s, board: startBoard(), turn: starter, starter, result: null, last: null, tally: { ...s.tally } };
}

export const legalPits = (board: number[], side: Side): number[] => pitsOf(side).filter((i) => board[i] > 0);

interface Sown {
  board: number[];
  end: number;
  captured: number;
  again: boolean;
  over: boolean;
}

/** Sows from `pit` for `side`, with captures, extra turns and the end of the game. */
export function sow(board: number[], side: Side, pit: number): Sown {
  const b = board.slice();
  let seeds = b[pit];
  b[pit] = 0;
  let i = pit;
  while (seeds) {
    i = (i + 1) % 14;
    if (i === STORE[other(side)]) continue;
    b[i]++;
    seeds--;
  }
  let captured = 0;
  const mine = pitsOf(side).includes(i);
  if (mine && b[i] === 1 && b[opposite(i)] > 0) {
    captured = b[opposite(i)] + 1;
    b[STORE[side]] += captured;
    b[i] = 0;
    b[opposite(i)] = 0;
  }
  const empty = (s: Side) => pitsOf(s).every((p) => b[p] === 0);
  const over = empty(0) || empty(1);
  if (over) {
    for (const s of [0, 1] as Side[]) {
      for (const p of pitsOf(s)) {
        b[STORE[s]] += b[p];
        b[p] = 0;
      }
    }
  }
  return { board: b, end: i, captured, again: i === STORE[side] && !over, over };
}

export function move(s: State, pit: number): State | null {
  if (s.result !== null || !legalPits(s.board, s.turn).includes(pit)) return null;
  const r = sow(s.board, s.turn, pit);
  const last = { side: s.turn, pit, end: r.end, captured: r.captured, again: r.again };
  if (!r.over) return { ...s, board: r.board, turn: r.again ? s.turn : other(s.turn), last };
  const [you, computer] = [r.board[STORE[0]], r.board[STORE[1]]];
  const result: Result = you > computer ? 0 : computer > you ? 1 : 'draw';
  return {
    ...s,
    board: r.board,
    result,
    last,
    tally: {
      you: s.tally.you + (result === 0 ? 1 : 0),
      computer: s.tally.computer + (result === 1 ? 1 : 0),
      draws: s.tally.draws + (result === 'draw' ? 1 : 0),
    },
  };
}

/** Store difference from `side`'s view, searching ahead with extra turns. */
function search(board: number[], side: Side, depth: number, alpha: number, beta: number): number {
  const moves = legalPits(board, side);
  if (depth === 0 || !moves.length) return board[STORE[side]] - board[STORE[other(side)]];
  let best = -Infinity;
  for (const pit of moves) {
    const r = sow(board, side, pit);
    let v: number;
    if (r.over) v = 100 * Math.sign(r.board[STORE[side]] - r.board[STORE[other(side)]]) + r.board[STORE[side]] - r.board[STORE[other(side)]];
    else if (r.again) v = search(r.board, side, depth - 1, alpha, beta);
    else v = -search(r.board, other(side), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's move. Easy grabs an extra turn or a capture half the time, else plays at random. */
export function choosePit(s: State, rng: Rng = Math.random): number {
  const moves = legalPits(s.board, s.turn);
  if (s.level === 'easy') {
    const good = moves.filter((p) => {
      const r = sow(s.board, s.turn, p);
      return r.again || r.captured > 0;
    });
    return good.length && rng() < 0.5 ? good[randomInt(good.length, rng)] : moves[randomInt(moves.length, rng)];
  }
  let best = moves[0];
  let bestScore = -Infinity;
  for (const pit of moves) {
    const r = sow(s.board, s.turn, pit);
    const side = s.turn;
    const v = r.over
      ? 100 * Math.sign(r.board[STORE[side]] - r.board[STORE[other(side)]]) + r.board[STORE[side]] - r.board[STORE[other(side)]]
      : r.again
        ? search(r.board, side, DEPTH - 1, -Infinity, Infinity)
        : -search(r.board, other(side), DEPTH - 1, -Infinity, Infinity);
    if (v > bestScore) [best, bestScore] = [pit, v];
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
    st.board.length === 14 &&
    st.board.every((n) => Number.isInteger(n) && n >= 0) &&
    st.board.reduce((a, b) => a + b, 0) === 2 * PITS * SEEDS &&
    side(st.turn) &&
    side(st.starter) &&
    (st.result === null || st.result === 'draw' || side(st.result)) &&
    (st.result !== null || legalPits(st.board, st.turn).length > 0) &&
    (st.last === null || (typeof st.last === 'object' && side(st.last.side) && Number.isInteger(st.last.end))) &&
    !!st.tally &&
    Number.isInteger(st.tally.you) &&
    Number.isInteger(st.tally.computer) &&
    Number.isInteger(st.tally.draws)
  );
}

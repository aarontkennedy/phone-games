// Tic-tac-toe: you are X, the computer is O. Three in a row wins. Who moves first
// alternates each round. Pure functions: a move returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Mark = 'X' | 'O';
export type Result = Mark | 'draw' | null;

export interface State {
  level: Level;
  board: (Mark | null)[];
  turn: Mark;
  /** Who moved first this round. */
  starter: Mark;
  result: Result;
  /** The winning three cells, if any. */
  line: number[] | null;
  /** Rounds won by you, by the computer, and drawn. */
  tally: { you: number; computer: number; draws: number };
}

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function newGame(level: Level = 'strong'): State {
  return { level, board: Array(9).fill(null), turn: 'X', starter: 'X', result: null, line: null, tally: { you: 0, computer: 0, draws: 0 } };
}

/** A fresh board; the other player starts. Keeps the tally. */
export function newRound(s: State): State {
  const starter: Mark = s.starter === 'X' ? 'O' : 'X';
  return { ...s, board: Array(9).fill(null), turn: starter, starter, result: null, line: null, tally: { ...s.tally } };
}

export function winningLine(board: (Mark | null)[]): number[] | null {
  return LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) ?? null;
}

export function move(s: State, cell: number): State | null {
  if (s.result || !Number.isInteger(cell) || cell < 0 || cell > 8 || s.board[cell]) return null;
  const board = s.board.slice();
  board[cell] = s.turn;
  const line = winningLine(board);
  const result: Result = line ? s.turn : board.every(Boolean) ? 'draw' : null;
  const tally = { ...s.tally };
  if (result === 'X') tally.you++;
  else if (result === 'O') tally.computer++;
  else if (result === 'draw') tally.draws++;
  return { ...s, board, line, result, tally, turn: s.turn === 'X' ? 'O' : 'X' };
}

const empty = (board: (Mark | null)[]) => board.flatMap((m, i) => (m ? [] : [i]));

/** Positions already worked out: there are only a few thousand. */
const memo = new Map<string, number>();

/** Perfect play: 1 if `me` can force a win from here, -1 for a loss, 0 for a draw. */
function minimax(board: (Mark | null)[], turn: Mark, me: Mark): number {
  const key = `${board.map((m) => m ?? '.').join('')}${turn}${me}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const line = winningLine(board);
  const cells = empty(board);
  let v: number;
  if (line) v = board[line[0]] === me ? 1 : -1;
  else if (!cells.length) v = 0;
  else {
    const scores = cells.map((i) => {
      board[i] = turn;
      const score = minimax(board, turn === 'X' ? 'O' : 'X', me);
      board[i] = null;
      return score;
    });
    v = turn === me ? Math.max(...scores) : Math.min(...scores);
  }
  memo.set(key, v);
  return v;
}

/** Easy takes a win it can see, otherwise plays anywhere. Strong never loses. */
export function chooseMove(s: State, rng: Rng = Math.random): number {
  const cells = empty(s.board);
  const me = s.turn;
  const wins = cells.filter((i) => {
    const b = s.board.slice();
    b[i] = me;
    return winningLine(b);
  });
  if (wins.length) return wins[0];
  if (s.level === 'easy') return cells[randomInt(cells.length, rng)];
  const board = s.board.slice();
  let best = cells[0];
  let bestScore = -Infinity;
  for (const i of cells) {
    board[i] = me;
    const v = minimax(board, me === 'X' ? 'O' : 'X', me);
    board[i] = null;
    if (v > bestScore) [best, bestScore] = [i, v];
  }
  return best;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const mark = (m: unknown) => m === 'X' || m === 'O';
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    Array.isArray(st.board) &&
    st.board.length === 9 &&
    st.board.every((m) => m === null || mark(m)) &&
    mark(st.turn) &&
    mark(st.starter) &&
    (st.result === null || st.result === 'draw' || mark(st.result)) &&
    !!st.tally &&
    ['you', 'computer', 'draws'].every((k) => typeof st.tally[k as keyof State['tally']] === 'number')
  );
}

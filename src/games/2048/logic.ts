import type { Direction } from '../../core/input';
import { randomInt, type Rng } from '../../core/random';

export const SIZE = 4;
export const WIN_TILE = 2048;
export const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down'];

export interface State {
  board: number[]; // SIZE*SIZE cells, row-major, 0 = empty
  score: number;
  over: boolean;
  won: boolean;
  keepPlaying: boolean;
}

export interface MoveResult {
  board: number[];
  gained: number;
  merged: Set<number>;
  moved: boolean;
}

export interface Turn {
  state: State;
  fresh: number; // index of the tile added after the move
  merged: Set<number>;
}

export function newState(rng: Rng = Math.random): State {
  const board = Array<number>(SIZE * SIZE).fill(0);
  addRandomTile(board, rng);
  addRandomTile(board, rng);
  return { board, score: 0, over: false, won: false, keepPlaying: false };
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  return (
    !!st &&
    Array.isArray(st.board) &&
    st.board.length === SIZE * SIZE &&
    st.board.every((v) => Number.isInteger(v) && v >= 0) &&
    typeof st.score === 'number'
  );
}

/** Places a 2 (90%) or 4 in a random empty cell. Returns its index, or -1 if full. */
export function addRandomTile(board: number[], rng: Rng = Math.random): number {
  const empty = board.flatMap((v, i) => (v === 0 ? [i] : []));
  if (empty.length === 0) return -1;
  const i = empty[randomInt(empty.length, rng)];
  board[i] = rng() < 0.9 ? 2 : 4;
  return i;
}

/** Cell indices for each row/column, ordered so tiles slide toward index 0. */
export function lines(dir: Direction): number[][] {
  const result: number[][] = [];
  for (let a = 0; a < SIZE; a++) {
    const line: number[] = [];
    for (let b = 0; b < SIZE; b++) {
      const r = SIZE - 1 - b;
      switch (dir) {
        case 'left': line.push(a * SIZE + b); break;
        case 'right': line.push(a * SIZE + r); break;
        case 'up': line.push(b * SIZE + a); break;
        case 'down': line.push(r * SIZE + a); break;
      }
    }
    result.push(line);
  }
  return result;
}

/** Slides and merges tiles. Each tile merges at most once per move. */
export function move(board: number[], dir: Direction): MoveResult {
  const next = board.slice();
  const merged = new Set<number>();
  let gained = 0;

  for (const line of lines(dir)) {
    const values = line.map((i) => board[i]).filter((v) => v !== 0);
    let out = 0;
    for (let k = 0; k < values.length; k++) {
      let v = values[k];
      const idx = line[out];
      if (values[k + 1] === v) {
        v *= 2;
        gained += v;
        merged.add(idx);
        k++;
      }
      next[idx] = v;
      out++;
    }
    for (; out < SIZE; out++) next[line[out]] = 0;
  }

  return { board: next, gained, merged, moved: next.some((v, i) => v !== board[i]) };
}

export function canMove(board: number[]): boolean {
  return DIRECTIONS.some((d) => move(board, d).moved);
}

/** Plays one move. Returns null if the move is not allowed or changes nothing. */
export function applyMove(state: State, dir: Direction, rng: Rng = Math.random): Turn | null {
  if (state.over || (state.won && !state.keepPlaying)) return null;
  const result = move(state.board, dir);
  if (!result.moved) return null;
  const fresh = addRandomTile(result.board, rng);
  return {
    state: {
      ...state,
      board: result.board,
      score: state.score + result.gained,
      won: state.won || result.board.includes(WIN_TILE),
      over: !canMove(result.board),
    },
    fresh,
    merged: result.merged,
  };
}

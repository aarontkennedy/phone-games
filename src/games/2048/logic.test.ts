import { describe, expect, it, vi } from 'vitest';
import { seededRng } from '../../core/random';
import {
  SIZE,
  addRandomTile,
  applyMove,
  canMove,
  isValidState,
  lines,
  move,
  newState,
  type State,
} from './logic';

/** Builds a board from 4 rows. */
const board = (...rows: number[][]) => rows.flat();
const empty = () => Array<number>(SIZE * SIZE).fill(0);
const state = (b: number[], extra: Partial<State> = {}): State => ({
  board: b,
  score: 0,
  over: false,
  won: false,
  keepPlaying: false,
  ...extra,
});
/** An rng that returns the given values in order. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('newState', () => {
  it('starts with two tiles, no score, and no flags set', () => {
    const s = newState(seededRng(1));
    expect(s.board.filter((v) => v !== 0)).toHaveLength(2);
    expect(s.board.every((v) => [0, 2, 4].includes(v))).toBe(true);
    expect(s).toMatchObject({ score: 0, over: false, won: false, keepPlaying: false });
  });

  it('is deterministic with a seeded rng', () => {
    expect(newState(seededRng(5))).toEqual(newState(seededRng(5)));
  });

  it('defaults to Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    newState();
    expect(spy).toHaveBeenCalled();
  });
});

describe('isValidState', () => {
  it('accepts a real state', () => {
    expect(isValidState(newState(seededRng(1)))).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'board'],
    ['a missing board', { score: 0 }],
    ['a short board', { board: [0, 2], score: 0 }],
    ['a fractional tile', { board: [...empty().slice(1), 2.5], score: 0 }],
    ['a negative tile', { board: [...empty().slice(1), -2], score: 0 }],
    ['a missing score', { board: empty() }],
  ])('rejects %s', (_label, value) => {
    expect(isValidState(value)).toBe(false);
  });
});

describe('addRandomTile', () => {
  it('fills the chosen empty cell with a 2 most of the time', () => {
    const b = board([2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    expect(addRandomTile(b, sequence(0, 0.5))).toBe(1);
    expect(b[1]).toBe(2);
  });

  it('places a 4 when the second roll is 0.9 or higher', () => {
    const b = empty();
    const i = addRandomTile(b, sequence(0.99, 0.9));
    expect(i).toBe(15);
    expect(b[15]).toBe(4);
  });

  it('returns -1 and changes nothing when the board is full', () => {
    const b = Array<number>(16).fill(2);
    expect(addRandomTile(b, sequence(0))).toBe(-1);
    expect(b).toEqual(Array(16).fill(2));
  });
});

describe('lines', () => {
  it('orders cells toward the edge being moved to', () => {
    expect(lines('left')[0]).toEqual([0, 1, 2, 3]);
    expect(lines('right')[0]).toEqual([3, 2, 1, 0]);
    expect(lines('up')[0]).toEqual([0, 4, 8, 12]);
    expect(lines('down')[0]).toEqual([12, 8, 4, 0]);
    expect(lines('down')[3]).toEqual([15, 11, 7, 3]);
  });

  it('covers every cell exactly once', () => {
    for (const dir of ['left', 'right', 'up', 'down'] as const) {
      expect(lines(dir).flat().sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
    }
  });
});

describe('move', () => {
  const row = (r: number[]) => board(r, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
  const firstRow = (b: number[]) => b.slice(0, 4);

  it.each([
    [[2, 2, 0, 0], [4, 0, 0, 0], 4],
    [[2, 0, 2, 0], [4, 0, 0, 0], 4],
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 2, 0], [4, 2, 0, 0], 4],
    [[4, 4, 8, 0], [8, 8, 0, 0], 8], // a merged tile does not merge again
    [[2, 4, 8, 16], [2, 4, 8, 16], 0],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0],
  ])('left: %j -> %j (+%i)', (input, output, gained) => {
    const r = move(row(input), 'left');
    expect(firstRow(r.board)).toEqual(output);
    expect(r.gained).toBe(gained);
  });

  it('moves right, up and down', () => {
    expect(firstRow(move(row([2, 2, 4, 0]), 'right').board)).toEqual([0, 0, 4, 4]);
    const col = board([2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0]);
    expect(move(col, 'up').board.filter((_, i) => i % 4 === 0)).toEqual([4, 4, 0, 0]);
    expect(move(col, 'down').board.filter((_, i) => i % 4 === 0)).toEqual([0, 0, 4, 4]);
  });

  it('reports which cells merged', () => {
    const r = move(row([2, 2, 4, 4]), 'left');
    expect([...r.merged]).toEqual([0, 1]);
  });

  it('reports whether anything moved, without mutating the input', () => {
    const b = row([2, 4, 0, 0]);
    expect(move(b, 'left').moved).toBe(false);
    expect(move(b, 'right').moved).toBe(true);
    expect(b).toEqual(row([2, 4, 0, 0]));
  });
});

describe('canMove', () => {
  it('is true when a tile can slide into an empty cell', () => {
    expect(canMove(board([2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]))).toBe(true);
  });

  it('is false on an empty board, since nothing can move', () => {
    expect(canMove(empty())).toBe(false);
  });

  it('is true on a full board with a possible merge', () => {
    expect(canMove(board([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]))).toBe(true);
  });

  it('is false on a full board with no merges', () => {
    expect(canMove(board([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]))).toBe(false);
  });
});

describe('applyMove', () => {
  it('moves, adds a tile, and adds the merged value to the score', () => {
    const s = state(board([2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), { score: 10 });
    const turn = applyMove(s, 'left', sequence(0, 0))!;
    expect(turn.state.board[0]).toBe(4);
    expect(turn.state.score).toBe(14);
    expect(turn.fresh).toBe(1); // first empty cell
    expect(turn.state.board[1]).toBe(2);
    expect([...turn.merged]).toEqual([0]);
    expect(s.board[0]).toBe(2); // input untouched
  });

  it('returns null when nothing moves', () => {
    expect(applyMove(state(board([2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0])), 'left')).toBeNull();
  });

  it('returns null once the game is over', () => {
    expect(applyMove(state(empty(), { over: true }), 'left')).toBeNull();
  });

  it('sets won on reaching 2048, then blocks moves until the player keeps going', () => {
    const s = state(board([1024, 1024, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]));
    const won = applyMove(s, 'left', sequence(0))!.state;
    expect(won.won).toBe(true);
    expect(applyMove(won, 'right')).toBeNull();
    expect(applyMove({ ...won, keepPlaying: true }, 'right', sequence(0))).not.toBeNull();
  });

  it('keeps won set on later moves', () => {
    const s = state(board([2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), {
      won: true,
      keepPlaying: true,
    });
    expect(applyMove(s, 'left', sequence(0))!.state.won).toBe(true);
  });

  it('sets over when the new tile leaves no moves', () => {
    const s = state(board([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [0, 4, 2, 8]));
    const turn = applyMove(s, 'left', sequence(0.5))!;
    expect(turn.state.board.slice(12)).toEqual([4, 2, 8, 2]);
    expect(turn.state.over).toBe(true);
  });

  it('defaults to Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    applyMove(state(board([2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0])), 'left');
    expect(spy).toHaveBeenCalled();
  });
});

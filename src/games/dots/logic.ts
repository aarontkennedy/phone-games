// Dots and Boxes on a 5 by 5 grid of dots (16 boxes), you (0) against the computer (1).
// Take turns drawing a line between two neighbouring dots. Drawing the fourth side of a
// box claims it and you go again. When every line is drawn, more boxes wins. Who goes
// first alternates each round. Pure functions: a move returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Side = 0 | 1;
export type Result = Side | 'draw' | null;

export const SIZE = 4; // boxes per row
/** Lines 0-19 are across (row by row), 20-39 are down. */
export const LINES = 2 * SIZE * (SIZE + 1);

export interface State {
  level: Level;
  lines: boolean[];
  boxes: (Side | null)[];
  turn: Side;
  starter: Side;
  result: Result;
  last: number | null;
  tally: { you: number; computer: number; draws: number };
}

export const other = (s: Side): Side => (s === 0 ? 1 : 0);
/** The four lines around box `b`: top, bottom, left, right. */
export function sides(b: number): number[] {
  const r = Math.floor(b / SIZE);
  const c = b % SIZE;
  const across = SIZE * (SIZE + 1);
  return [r * SIZE + c, (r + 1) * SIZE + c, across + r * (SIZE + 1) + c, across + r * (SIZE + 1) + c + 1];
}
const BOX_SIDES = Array.from({ length: SIZE * SIZE }, (_, b) => sides(b));
/** The boxes a line borders: one on the edge, two inside. */
export const boxesOf = (line: number): number[] => BOX_SIDES.flatMap((s, b) => (s.includes(line) ? [b] : []));
const drawnAround = (lines: boolean[], b: number) => BOX_SIDES[b].filter((l) => lines[l]).length;

export function newGame(level: Level = 'strong'): State {
  return { level, lines: Array(LINES).fill(false), boxes: Array(SIZE * SIZE).fill(null), turn: 0, starter: 0, result: null, last: null, tally: { you: 0, computer: 0, draws: 0 } };
}

export function newRound(s: State): State {
  const starter = other(s.starter);
  return { ...newGame(s.level), turn: starter, starter, tally: { ...s.tally } };
}

export const count = (s: State, side: Side): number => s.boxes.filter((b) => b === side).length;

export function move(s: State, line: number): State | null {
  if (s.result !== null || !Number.isInteger(line) || line < 0 || line >= LINES || s.lines[line]) return null;
  const lines = s.lines.slice();
  lines[line] = true;
  const boxes = s.boxes.slice();
  let closed = 0;
  for (const b of boxesOf(line)) {
    if (drawnAround(lines, b) === 4) {
      boxes[b] = s.turn;
      closed++;
    }
  }
  const next: State = { ...s, lines, boxes, last: line, turn: closed ? s.turn : other(s.turn) };
  if (!lines.every(Boolean)) return next;
  const [you, them] = [count(next, 0), count(next, 1)];
  const result: Result = you > them ? 0 : them > you ? 1 : 'draw';
  return {
    ...next,
    result,
    tally: {
      you: s.tally.you + (result === 0 ? 1 : 0),
      computer: s.tally.computer + (result === 1 ? 1 : 0),
      draws: s.tally.draws + (result === 'draw' ? 1 : 0),
    },
  };
}

const open = (s: State) => s.lines.flatMap((on, i) => (on ? [] : [i]));
/** Lines that close a box right now. */
const closing = (s: State) => open(s).filter((l) => boxesOf(l).some((b) => drawnAround(s.lines, b) === 3));
/** Lines that don't hand the other side a box (no box gets its third side). */
const safe = (s: State) => open(s).filter((l) => boxesOf(l).every((b) => drawnAround(s.lines, b) < 2));

/** How many boxes the other side could take in a row after `line` is drawn. */
function givesAway(s: State, line: number): number {
  let st = move({ ...s, turn: 0 }, line)!;
  st = { ...st, turn: 1 };
  let taken = 0;
  for (let l = closing(st)[0]; l !== undefined && st.result === null; l = closing(st)[0]) {
    const before = count(st, 1);
    st = move(st, l)!;
    taken += count(st, 1) - before;
    st = { ...st, turn: 1 };
  }
  return taken;
}

/**
 * The computer's line. Both take a box when they can. Easy otherwise plays at random;
 * Strong plays a safe line, and when none is left, gives away as few boxes as it can.
 */
export function chooseLine(s: State, rng: Rng = Math.random): number {
  const take = closing(s);
  if (take.length) return take[0];
  const all = open(s);
  if (s.level === 'easy') return all[randomInt(all.length, rng)];
  const quiet = safe(s);
  if (quiet.length) return quiet[randomInt(quiet.length, rng)];
  let best = all[0];
  let fewest = Infinity;
  for (const l of all) {
    const n = givesAway(s, l);
    if (n < fewest) [best, fewest] = [l, n];
  }
  return best;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const side = (v: unknown) => v === 0 || v === 1;
  if (!st || (st.level !== 'easy' && st.level !== 'strong') || !Array.isArray(st.lines) || st.lines.length !== LINES) return false;
  if (!st.lines.every((l) => typeof l === 'boolean') || !Array.isArray(st.boxes) || st.boxes.length !== SIZE * SIZE) return false;
  if (!st.boxes.every((b, i) => (b === null ? drawnAround(st.lines, i) < 4 : side(b) && drawnAround(st.lines, i) === 4))) return false;
  if (!side(st.turn) || !side(st.starter) || !(st.result === null || st.result === 'draw' || side(st.result))) return false;
  if (st.result === null && st.lines.every(Boolean)) return false;
  return !!st.tally && [st.tally.you, st.tally.computer, st.tally.draws].every(Number.isInteger);
}

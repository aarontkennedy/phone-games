// Peg Solitaire on the classic 33-hole cross: every hole has a peg except the center. Jump
// a peg over a neighboring peg into an empty hole just beyond (across or up and down, not
// diagonally), and the jumped peg comes off. Leave one peg to win; one in the center is
// perfect. Pure functions: every move returns a new State, or null if it isn't allowed.

/** The cross on a 7 by 7 grid: its holes, by grid cell (row * 7 + column). */
export const SIDE = 7;
const inCross = (r: number, c: number) => (r >= 2 && r <= 4) || (c >= 2 && c <= 4);
export const HOLES: readonly number[] = Array.from({ length: SIDE * SIDE }, (_, i) => i).filter((i) => inCross(Math.floor(i / SIDE), i % SIDE));
export const CENTER = 3 * SIDE + 3;

/** Every possible jump: from, over, to (grid cells). */
export const JUMPS: readonly [number, number, number][] = HOLES.flatMap((from) => {
  const r = Math.floor(from / SIDE);
  const c = from % SIDE;
  return [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ].flatMap(([dr, dc]) => {
    const [r2, c2] = [r + 2 * dr, c + 2 * dc];
    if (r2 < 0 || r2 >= SIDE || c2 < 0 || c2 >= SIDE || !inCross(r2, c2)) return [];
    return [[from, (r + dr) * SIDE + c + dc, r2 * SIDE + c2] as [number, number, number]];
  });
});

export interface State {
  /** Pegs, by grid cell (false outside the cross). */
  pegs: boolean[];
  /** The peg you picked up, waiting for where to jump, or null. */
  picked: number | null;
  moves: number;
}

export function newGame(): State {
  return { pegs: Array.from({ length: SIDE * SIDE }, (_, i) => HOLES.includes(i) && i !== CENTER), picked: null, moves: 0 };
}

export const pegsLeft = (s: State): number => s.pegs.filter(Boolean).length;
export const jumpsFrom = (s: State, from: number) => JUMPS.filter(([f, o, t]) => f === from && s.pegs[f] && s.pegs[o] && !s.pegs[t]);
export const legalJumps = (s: State) => JUMPS.filter(([f, o, t]) => s.pegs[f] && s.pegs[o] && !s.pegs[t]);
export const isOver = (s: State): boolean => legalJumps(s).length === 0;
export const isWon = (s: State): boolean => pegsLeft(s) === 1;

/** Picks up a peg (or puts it down), or jumps the picked peg to an empty hole. */
export function tap(s: State, cell: number): State | null {
  if (!HOLES.includes(cell) || isOver(s)) return null;
  if (s.pegs[cell]) return jumpsFrom(s, cell).length || s.picked === cell ? { ...s, picked: s.picked === cell ? null : cell } : null;
  if (s.picked === null) return null;
  const jump = jumpsFrom(s, s.picked).find(([, , t]) => t === cell);
  return jump ? play(s, jump) : null;
}

export function play(s: State, [from, over, to]: readonly [number, number, number]): State | null {
  if (!s.pegs[from] || !s.pegs[over] || s.pegs[to] || !JUMPS.some(([f, o, t]) => f === from && o === over && t === to)) return null;
  const pegs = s.pegs.slice();
  pegs[from] = pegs[over] = false;
  pegs[to] = true;
  return { pegs, picked: null, moves: s.moves + 1 };
}

// --- Hint: a jump that still leads to one peg left ---

/** Positions known not to lead to one peg, kept between hints (keys: peg bits as a number). */
const dead = new Set<number>();
/** Cleared past this many, so memory stays small. */
const DEAD_LIMIT = 1_000_000;
const BIT = HOLES.map((_, i) => 2 ** i);
const holeIndex = new Map(HOLES.map((cell, i) => [cell, i]));

/**
 * A jump from which one peg left can still be reached, found by searching ahead: the jump,
 * 'none' if one peg can't be reached from here, or 'unknown' if the search gave up after
 * `budget` positions (so a hint never takes long). Proving there's no way can take a huge
 * search when many pegs are left.
 */
export function hint(s: State, budget = 100_000): readonly [number, number, number] | 'none' | 'unknown' {
  if (dead.size > DEAD_LIMIT) dead.clear();
  const pegs = s.pegs.slice();
  let key = HOLES.reduce((k, cell, i) => (pegs[cell] ? k + BIT[i] : k), 0);
  let count = pegs.filter(Boolean).length;
  let seen = 0;
  const bit = (cell: number) => BIT[holeIndex.get(cell)!];
  const solve = (): boolean | null => {
    if (count === 1) return true;
    if (dead.has(key)) return false;
    if (++seen > budget) return null;
    for (const [f, o, t] of JUMPS) {
      if (!pegs[f] || !pegs[o] || pegs[t]) continue;
      pegs[f] = pegs[o] = false;
      pegs[t] = true;
      key += bit(t) - bit(f) - bit(o);
      count--;
      const result = solve();
      pegs[f] = pegs[o] = true;
      pegs[t] = false;
      key -= bit(t) - bit(f) - bit(o);
      count++;
      if (result !== false) return result;
    }
    dead.add(key);
    return false;
  };
  for (const jump of legalJumps(s)) {
    const [f, o, t] = jump;
    pegs[f] = pegs[o] = false;
    pegs[t] = true;
    key += bit(t) - bit(f) - bit(o);
    count--;
    const result = solve();
    pegs[f] = pegs[o] = true;
    pegs[t] = false;
    key -= bit(t) - bit(f) - bit(o);
    count++;
    if (result) return jump;
    if (result === null) return 'unknown';
  }
  return 'none';
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  return (
    !!st &&
    Array.isArray(st.pegs) &&
    st.pegs.length === SIDE * SIDE &&
    st.pegs.every((p, i) => typeof p === 'boolean' && (!p || HOLES.includes(i))) &&
    (st.picked === null || (Number.isInteger(st.picked) && st.pegs[st.picked])) &&
    Number.isInteger(st.moves)
  );
}

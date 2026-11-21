// Shut the Box: nine tiles numbered 1 to 9. Roll two dice and shut any open tiles that add
// up to the roll (one tile or several). Once 7, 8 and 9 are all shut you may roll one die
// instead. When no open tiles make the roll, the round ends and scores the open tiles'
// total: lower is better, and 0 (every tile shut) is shutting the box.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { randomInt, type Rng } from '../../core/random';

export const TILES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type Phase = 'roll' | 'choose' | 'over';

export interface State {
  phase: Phase;
  /** open[i] is tile i + 1. */
  open: boolean[];
  /** The last roll: one or two dice, or empty before the first. */
  dice: number[];
}

export const newRound = (): State => ({ phase: 'roll', open: TILES.map(() => true), dice: [] });

/** The open tiles' total: the score if the round ended now. */
export const score = (s: State): number => TILES.reduce((t, n, i) => t + (s.open[i] ? n : 0), 0);
export const rollTotal = (s: State): number => s.dice.reduce((a, b) => a + b, 0);
/** One die is allowed once 7, 8 and 9 are shut. */
export const canRollOne = (s: State): boolean => !s.open[6] && !s.open[7] && !s.open[8];

// Tiles as bits: bit i is tile i + 1.
const maskOf = (open: boolean[]) => open.reduce((m, o, i) => (o ? m | (1 << i) : m), 0);
const sumOf = (mask: number) => TILES.reduce((t, n, i) => t + (mask & (1 << i) ? n : 0), 0);

/** Every set of open tiles adding up to `total`, as bit masks. */
function shutsFor(openMask: number, total: number): number[] {
  const out: number[] = [];
  for (let m = openMask; m; m = (m - 1) & openMask) if (sumOf(m) === total) out.push(m);
  return out;
}

/** Whether the open tiles can make the last roll. */
const canShut = (s: State) => shutsFor(maskOf(s.open), rollTotal(s)).length > 0;

export function roll(s: State, dice: 1 | 2 = 2, rng: Rng = Math.random): State | null {
  if (s.phase !== 'roll' || (dice === 1 && !canRollOne(s))) return null;
  const n: State = { ...s, dice: Array.from({ length: dice }, () => randomInt(6, rng) + 1), phase: 'choose' };
  return canShut(n) ? n : { ...n, phase: 'over' };
}

/** Shuts the tiles at `tiles` (numbers 1 to 9): they must be open and add up to the roll. */
export function shut(s: State, tiles: number[]): State | null {
  if (s.phase !== 'choose' || !tiles.length || new Set(tiles).size !== tiles.length) return null;
  if (tiles.some((t) => !TILES.includes(t as (typeof TILES)[number]) || !s.open[t - 1])) return null;
  if (tiles.reduce((a, b) => a + b, 0) !== rollTotal(s)) return null;
  const open = s.open.map((o, i) => o && !tiles.includes(i + 1));
  return { phase: open.some(Boolean) ? 'roll' : 'over', open, dice: s.dice };
}

export const isShut = (s: State): boolean => s.open.every((o) => !o);

// --- The best play (Hint and the Right score) ---

/** Chance of each total with two dice (index = total), and with one die. */
const TWO = Array.from({ length: 13 }, (_, t) => Math.max(0, 6 - Math.abs(t - 7)) / 36);
const ONE = Array.from({ length: 7 }, (_, t) => (t ? 1 / 6 : 0));

let table: { value: Float64Array; oneDie: Uint8Array } | null = null;

/**
 * For every set of open tiles, the lowest average score you can end the round with,
 * playing perfectly from there, and whether to roll one die. Worked out once, exactly,
 * from fewer tiles up to more.
 */
function bestTable() {
  if (table) return table;
  const value = new Float64Array(512);
  const oneDie = new Uint8Array(512);
  const after = (open: number, chances: number[]) =>
    chances.reduce((t, p, total) => {
      if (!p) return t;
      const options = shutsFor(open, total);
      return t + p * (options.length ? Math.min(...options.map((m) => value[open & ~m])) : sumOf(open));
    }, 0);
  for (let open = 1; open < 512; open++) {
    const two = after(open, TWO);
    const one = open & 0b111000000 ? Infinity : after(open, ONE);
    value[open] = Math.min(two, one);
    oneDie[open] = one < two - 1e-12 ? 1 : 0;
  }
  return (table = { value, oneDie });
}

/** The average score this round ends with from here, playing perfectly (before a roll). */
export const expectedScore = (s: State): number => bestTable().value[maskOf(s.open)];

/** Before a roll: whether one die is the better roll. */
export const bestDice = (s: State): 1 | 2 => (canRollOne(s) && bestTable().oneDie[maskOf(s.open)] ? 1 : 2);

/** After a roll: what shutting these tiles leaves you, on average (lower is better). */
export function shutValue(s: State, tiles: number[]): number {
  const m = tiles.reduce((acc, t) => acc | (1 << (t - 1)), 0);
  return bestTable().value[maskOf(s.open) & ~m];
}

/** After a roll: every way to shut tiles for it, as tile numbers. */
export const shutOptions = (s: State): number[][] =>
  shutsFor(maskOf(s.open), rollTotal(s)).map((m) => TILES.filter((_, i) => m & (1 << i)));

/** After a roll: the tiles to shut for the lowest average score. Ties go to fewer tiles. */
export function bestShut(s: State): number[] {
  return shutOptions(s).reduce((best, t) => {
    const d = shutValue(s, t) - shutValue(s, best);
    return d < -1e-12 || (Math.abs(d) <= 1e-12 && t.length < best.length) ? t : best;
  });
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  return (
    !!st &&
    ['roll', 'choose', 'over'].includes(st.phase) &&
    Array.isArray(st.open) &&
    st.open.length === 9 &&
    st.open.every((o) => typeof o === 'boolean') &&
    Array.isArray(st.dice) &&
    st.dice.length <= 2 &&
    st.dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6) &&
    (st.phase !== 'choose' || st.dice.length > 0)
  );
}

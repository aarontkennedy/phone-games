// Roulette with a single zero (37 pockets, 0 to 36). Put chips on numbers or on the
// outside bets, spin, and every bet covering the winning number pays; the rest lose.
// A zero loses every outside bet. Pure functions: every action returns a new State, or
// null if it isn't allowed.
import { randomInt, type Rng } from '../../core/random';

export const START_CHIPS = 1000;
export const CHIPS = [5, 25, 100] as const;
/** Numbers shown, most recent first. */
export const HISTORY = 10;

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export type Color = 'red' | 'black' | 'green';
export const colorOf = (n: number): Color => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');

/** The outside bets, by id: what each covers and what it pays to 1. */
export const OUTSIDE: Record<string, { name: string; pays: number; covers: (n: number) => boolean }> = {
  low: { name: '1 to 18', pays: 1, covers: (n) => n >= 1 && n <= 18 },
  high: { name: '19 to 36', pays: 1, covers: (n) => n >= 19 },
  even: { name: 'Even', pays: 1, covers: (n) => n > 0 && n % 2 === 0 },
  odd: { name: 'Odd', pays: 1, covers: (n) => n % 2 === 1 },
  red: { name: 'Red', pays: 1, covers: (n) => RED.has(n) },
  black: { name: 'Black', pays: 1, covers: (n) => n > 0 && !RED.has(n) },
  d1: { name: '1st 12', pays: 2, covers: (n) => n >= 1 && n <= 12 },
  d2: { name: '2nd 12', pays: 2, covers: (n) => n >= 13 && n <= 24 },
  d3: { name: '3rd 12', pays: 2, covers: (n) => n >= 25 },
  // Columns run along the table: 1, 4, 7 ... 34 is the first.
  c1: { name: 'Column 1', pays: 2, covers: (n) => n > 0 && n % 3 === 1 },
  c2: { name: 'Column 2', pays: 2, covers: (n) => n > 0 && n % 3 === 2 },
  c3: { name: 'Column 3', pays: 2, covers: (n) => n > 0 && n % 3 === 0 },
};

/** A single number pays 35 to 1. Its bet id is the number itself, "0" to "36". */
export const STRAIGHT_PAYS = 35;

export const isBetId = (id: string): boolean => id in OUTSIDE || (/^(0|[1-9]\d?)$/.test(id) && Number(id) <= 36);
export const covers = (id: string, n: number): boolean => (id in OUTSIDE ? OUTSIDE[id].covers(n) : Number(id) === n);
export const pays = (id: string): number => (id in OUTSIDE ? OUTSIDE[id].pays : STRAIGHT_PAYS);

export type Bets = Record<string, number>;

export interface State {
  /** Chips in front of you, not counting those on the table. */
  chips: number;
  /** The chip you're betting with. */
  chip: number;
  bets: Bets;
  /** The last spin's bets, for Repeat. */
  lastBets: Bets;
  /** Winning numbers, most recent first. */
  history: number[];
  /** What the last spin paid back (stakes included), and what was bet on it. */
  paid: number;
  staked: number;
}

export const total = (b: Bets): number => Object.values(b).reduce((a, x) => a + x, 0);

export function newState(): State {
  return { chips: START_CHIPS, chip: CHIPS[1], bets: {}, lastBets: {}, history: [], paid: 0, staked: 0 };
}

export function setChip(s: State, chip: number): State | null {
  return (CHIPS as readonly number[]).includes(chip) ? { ...s, chip } : null;
}

/** Puts one chip on a bet, if you have it. Tapping again stacks another. */
export function place(s: State, id: string): State | null {
  if (!isBetId(id) || s.chips < s.chip) return null;
  return { ...s, chips: s.chips - s.chip, bets: { ...s.bets, [id]: (s.bets[id] ?? 0) + s.chip } };
}

/** Takes every chip back off the table. */
export function clear(s: State): State | null {
  if (!total(s.bets)) return null;
  return { ...s, chips: s.chips + total(s.bets), bets: {} };
}

/** Puts the last spin's bets down again, if nothing is on the table and you can cover them. */
export function repeat(s: State): State | null {
  const cost = total(s.lastBets);
  if (total(s.bets) || !cost || cost > s.chips) return null;
  return { ...s, chips: s.chips - cost, bets: { ...s.lastBets } };
}

/** What a set of bets pays back (stakes included) when `n` wins. */
export const winnings = (bets: Bets, n: number): number =>
  Object.entries(bets).reduce((t, [id, amount]) => t + (covers(id, n) ? amount * (pays(id) + 1) : 0), 0);

/** Spins the wheel: winning bets are paid with their stakes back, and the table clears. */
export function spin(s: State, rng: Rng = Math.random): State | null {
  if (!total(s.bets)) return null;
  const n = randomInt(37, rng);
  const paid = winnings(s.bets, n);
  return { ...s, chips: s.chips + paid, bets: {}, lastBets: s.bets, history: [n, ...s.history].slice(0, HISTORY), paid, staked: total(s.bets) };
}

export const isBroke = (s: State): boolean => s.chips < CHIPS[0] && !total(s.bets);
export const restart = (s: State): State => ({ ...newState(), chip: s.chip, history: s.history });

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const count = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  const bets = (b: unknown) =>
    !!b && typeof b === 'object' && !Array.isArray(b) && Object.entries(b).every(([id, v]) => isBetId(id) && count(v) && v > 0);
  return (
    !!st &&
    count(st.chips) &&
    (CHIPS as readonly number[]).includes(st.chip) &&
    bets(st.bets) &&
    bets(st.lastBets) &&
    Array.isArray(st.history) &&
    st.history.length <= HISTORY &&
    st.history.every((n) => Number.isInteger(n) && n >= 0 && n <= 36) &&
    count(st.paid) &&
    count(st.staked)
  );
}

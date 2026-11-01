// Yacht: five dice, thirteen turns, a box to fill each turn. Roll up to three times,
// holding any dice between rolls, then score the dice in one empty box. Upper boxes
// (ones to sixes) score the matching dice, with 35 extra for 63 or more in all. Lower
// boxes: three and four of a kind (all five dice), full house 25, small straight 30,
// large straight 40, yacht (five of a kind) 50, chance (all five dice).
// Extra yachts after scoring 50 in Yacht earn 100 each and act as jokers: they must go in
// the matching upper box if it's empty, else any lower box at full value, else 0 in an
// upper box. Pure functions: every action returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const;
export const LOWER = ['three', 'four', 'full', 'small', 'large', 'yacht', 'chance'] as const;
export const BOXES = [...UPPER, ...LOWER];
export type Box = (typeof BOXES)[number];

export const ROLLS = 3;
export const UPPER_TARGET = 63;
export const UPPER_BONUS = 35;
export const YACHT_BONUS = 100;

export interface State {
  /** Five dice, 1 to 6, or 0 before the turn's first roll. */
  dice: number[];
  held: boolean[];
  /** Rolls used this turn. */
  rolls: number;
  scores: Record<Box, number | null>;
  /** Extra yachts scored after a 50 in Yacht, worth 100 each. */
  extraYachts: number;
}

const sum = (dice: number[]) => dice.reduce((a, b) => a + b, 0);
const counts = (dice: number[]) => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
};
const hasRun = (dice: number[], length: number) => {
  const c = counts(dice);
  let run = 0;
  for (let face = 1; face <= 6; face++) {
    run = c[face] ? run + 1 : 0;
    if (run >= length) return true;
  }
  return false;
};

const emptyCard = () => Object.fromEntries(BOXES.map((b) => [b, null])) as Record<Box, number | null>;

export function newGame(): State {
  return { dice: [0, 0, 0, 0, 0], held: [false, false, false, false, false], rolls: 0, scores: emptyCard(), extraYachts: 0 };
}

export const isGameOver = (s: State): boolean => BOXES.every((b) => s.scores[b] !== null);
export const turnNumber = (s: State): number => Math.min(BOXES.filter((b) => s.scores[b] !== null).length + 1, BOXES.length);

export function roll(s: State, rng: Rng = Math.random): State | null {
  if (s.rolls >= ROLLS || isGameOver(s)) return null;
  const dice = s.dice.map((d, i) => (s.rolls > 0 && s.held[i] ? d : randomInt(6, rng) + 1));
  return { ...s, dice, rolls: s.rolls + 1 };
}

/** Holds or releases a die between rolls. */
export function toggleHold(s: State, i: number): State | null {
  if (s.rolls === 0 || s.rolls >= ROLLS || i < 0 || i > 4) return null;
  return { ...s, held: s.held.map((h, j) => (j === i ? !h : h)) };
}

/** Points for the dice in a box, ignoring the joker rule. */
export function basicScore(dice: number[], box: Box): number {
  const c = counts(dice);
  const upper = UPPER.indexOf(box as (typeof UPPER)[number]);
  if (upper >= 0) return c[upper + 1] * (upper + 1);
  const most = Math.max(...c);
  switch (box) {
    case 'three':
      return most >= 3 ? sum(dice) : 0;
    case 'four':
      return most >= 4 ? sum(dice) : 0;
    case 'full':
      return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'small':
      return hasRun(dice, 4) ? 30 : 0;
    case 'large':
      return hasRun(dice, 5) ? 40 : 0;
    case 'yacht':
      return most === 5 ? 50 : 0;
    default:
      return sum(dice); // chance
  }
}

/** A second (or later) yacht, once the Yacht box is filled: the joker rule applies. */
const isJoker = (s: State) => s.rolls > 0 && s.dice.every((d) => d === s.dice[0]) && s.scores.yacht !== null;

/** The boxes the current dice may go in. */
export function openBoxes(s: State): Box[] {
  if (s.rolls === 0) return [];
  const open = BOXES.filter((b) => s.scores[b] === null);
  if (!isJoker(s)) return open;
  const matching = UPPER[s.dice[0] - 1];
  if (s.scores[matching] === null) return [matching];
  const lower = open.filter((b) => (LOWER as readonly string[]).includes(b));
  return lower.length ? lower : open;
}

/** What the current dice would score in `box`, including the joker rule. */
export function scoreFor(s: State, box: Box): number {
  if (isJoker(s) && (LOWER as readonly string[]).includes(box)) {
    if (box === 'full') return 25;
    if (box === 'small') return 30;
    if (box === 'large') return 40;
  }
  return basicScore(s.dice, box);
}

/** Scores the dice in `box` and starts the next turn. */
export function choose(s: State, box: Box): State | null {
  if (!openBoxes(s).includes(box)) return null;
  const bonus = isJoker(s) && s.scores.yacht === 50 ? 1 : 0;
  return {
    dice: [0, 0, 0, 0, 0],
    held: [false, false, false, false, false],
    rolls: 0,
    scores: { ...s.scores, [box]: scoreFor(s, box) },
    extraYachts: s.extraYachts + bonus,
  };
}

/** True if scoring this box now earns an extra-yacht bonus. */
export const earnsYachtBonus = (s: State): boolean => isJoker(s) && s.scores.yacht === 50;

export const upperTotal = (s: State): number => UPPER.reduce((t, b) => t + (s.scores[b] ?? 0), 0);
export const upperBonus = (s: State): number => (upperTotal(s) >= UPPER_TARGET ? UPPER_BONUS : 0);
export const total = (s: State): number =>
  BOXES.reduce((t, b) => t + (s.scores[b] ?? 0), 0) + upperBonus(s) + s.extraYachts * YACHT_BONUS;

export function isValidState(s: unknown): s is State {
  if (!s || typeof s !== 'object') return false;
  const st = s as State;
  return (
    Array.isArray(st.dice) &&
    st.dice.length === 5 &&
    st.dice.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    Array.isArray(st.held) &&
    st.held.length === 5 &&
    st.held.every((h) => typeof h === 'boolean') &&
    Number.isInteger(st.rolls) &&
    st.rolls >= 0 &&
    st.rolls <= ROLLS &&
    (st.rolls === 0) === st.dice.every((d) => d === 0) &&
    !!st.scores &&
    typeof st.scores === 'object' &&
    BOXES.every((b) => st.scores[b] === null || (Number.isInteger(st.scores[b]) && st.scores[b]! >= 0)) &&
    Number.isInteger(st.extraYachts) &&
    st.extraYachts >= 0
  );
}

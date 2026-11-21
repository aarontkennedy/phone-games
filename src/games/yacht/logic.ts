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

// --- Advice (Hint and the Right score) ---

/**
 * About what each box scores in a well-played game. Advice weighs a box's points against
 * this, so a roll goes where it beats the usual most, and a poor roll goes where it
 * costs least (often Ones). A rule of thumb, not a perfect plan for the whole game.
 */
export const PAR: Record<Box, number> = {
  ones: 2.1, twos: 5.3, threes: 8.6, fours: 12.2, fives: 15.7, sixes: 19.2,
  three: 21.7, four: 13.1, full: 22.6, small: 29.5, large: 32.7, yacht: 16.9, chance: 22,
};

export type Advice = { roll: true; hold: boolean[]; value: number } | { roll: false; box: Box; value: number };

/** Every roll of n dice, as sorted faces, with its chance. */
const rollsOf = (() => {
  const memo = new Map<number, { dice: number[]; p: number }[]>();
  return (n: number) => {
    if (!memo.has(n)) {
      const out = new Map<string, { dice: number[]; p: number }>();
      for (let i = 0; i < 6 ** n; i++) {
        const dice = Array.from({ length: n }, (_, k) => (Math.floor(i / 6 ** k) % 6) + 1).sort();
        const key = dice.join('');
        const hit = out.get(key);
        if (hit) hit.p += 1 / 6 ** n;
        else out.set(key, { dice, p: 1 / 6 ** n });
      }
      memo.set(n, [...out.values()]);
    }
    return memo.get(n)!;
  };
})();

/** Each distinct set of dice to keep (sorted), from sorted dice. */
function keeps(dice: number[]): number[][] {
  const out = new Map<string, number[]>();
  for (let mask = 0; mask < 32; mask++) {
    const kept = dice.filter((_, i) => mask & (1 << i));
    out.set(kept.join(''), kept);
  }
  return [...out.values()];
}

/** Weighs scoring the dice in each open box, and every way to hold and roll again. */
function planner(s: State) {
  const boxValue = (dice: number[], box: Box) => scoreFor({ ...s, dice, rolls: 1 }, box) - PAR[box];
  const best0 = new Map<string, { box: Box; value: number }>();
  const scoreNow = (dice: number[]) => {
    const key = dice.join('');
    if (!best0.has(key)) {
      const open = openBoxes({ ...s, dice, rolls: 1 });
      const box = open.reduce((a, b) => (boxValue(dice, b) > boxValue(dice, a) ? b : a));
      best0.set(key, { box, value: boxValue(dice, box) });
    }
    return best0.get(key)!;
  };
  const memo = new Map<string, number>();
  /** The best value from sorted dice with `left` rolls to go. */
  const value = (dice: number[], left: number): number => {
    if (!left) return scoreNow(dice).value;
    const key = `${dice.join('')}:${left}`;
    if (!memo.has(key)) memo.set(key, Math.max(scoreNow(dice).value, ...keeps(dice).map((k) => keepValue(k, left))));
    return memo.get(key)!;
  };
  /** Holding `kept` (sorted) and rolling the rest, with `left` rolls to go before this one. */
  const keepValue = (kept: number[], left: number): number =>
    rollsOf(5 - kept.length).reduce((t, o) => t + o.p * value([...kept, ...o.dice].sort(), left - 1), 0);
  return { boxValue, scoreNow, keepValue };
}

/** The best move now: score a box, or hold these dice and roll. */
export function advice(s: State): Advice {
  const plan = planner(s);
  const sorted = [...s.dice].sort();
  const now = plan.scoreNow(sorted);
  let best: Advice = { roll: false, box: now.box, value: now.value };
  const left = ROLLS - s.rolls;
  if (left > 0) {
    for (const kept of keeps(sorted)) {
      const v = plan.keepValue(kept, left);
      if (v > best.value + 1e-9) {
        // Which dice on the table those are: the first of each matching face.
        const used = [false, false, false, false, false];
        for (const face of kept) used[s.dice.findIndex((d, i) => d === face && !used[i])] = true;
        best = { roll: true, hold: used, value: v };
      }
    }
  }
  return best;
}

/** What scoring `box` now is worth, on advice's scale. */
export const boxValue = (s: State, box: Box): number => planner(s).boxValue([...s.dice].sort(), box);

/** What holding `held` and rolling is worth, on advice's scale. */
export const holdValue = (s: State, held: boolean[]): number =>
  planner(s).keepValue(s.dice.filter((_, i) => held[i]).sort(), ROLLS - s.rolls);

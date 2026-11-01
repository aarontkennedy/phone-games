// Hot dice, for you against the computer, first to 10,000. Roll six dice and keep at least
// one scoring die or set, then roll the rest or bank your turn's points. A roll with
// nothing that scores is a bust: the turn's points are lost. Keep all six and you roll all
// six again. Scoring: 1s 100 each, 5s 50 each; three of a kind 100 times the number
// (three 1s 1,000); four, five or six of a kind 1,000, 2,000 or 3,000; a 1-6 straight or
// three pairs 1,500. Pure functions: every action returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Phase = 'roll' | 'choose' | 'bust' | 'gameOver';
export type Player = 0 | 1;

export const GOAL = 10_000;

export interface State {
  level: Level;
  phase: Phase;
  turn: Player;
  scores: [number, number];
  /** The dice just rolled, still to choose from. */
  dice: number[];
  /** Dice set aside so far this turn. */
  kept: number[];
  /** How many dice the next roll uses. */
  remaining: number;
  /** Points built up this turn, not yet banked. */
  turnPoints: number;
}

const counts = (dice: number[]) => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
};
const kindScore = (face: number, n: number) => (n === 3 ? (face === 1 ? 1000 : face * 100) : [0, 0, 0, 0, 1000, 2000, 3000][n]);
const single = (face: number) => (face === 1 ? 100 : face === 5 ? 50 : 0);

/** Points for keeping exactly these dice, or null if any of them doesn't score. */
export function scoreDice(dice: number[]): number | null {
  if (!dice.length) return null;
  const c = counts(dice);
  if (dice.length === 6 && c.slice(1).every((n) => n === 1)) return 1500;
  if (dice.length === 6 && c.filter((n) => n === 2).length === 3) return 1500;
  let total = 0;
  for (let face = 1; face <= 6; face++) {
    const n = c[face];
    if (!n) continue;
    if (n >= 3) total += Math.max(kindScore(face, n), kindScore(face, 3) + (n - 3) * single(face));
    else if (single(face)) total += n * single(face);
    else return null;
  }
  return total;
}

/** The highest-scoring way to keep dice from a roll, as indexes, or [] if nothing scores. */
export function bestKeep(dice: number[]): number[] {
  let best: number[] = [];
  let bestScore = 0;
  for (let mask = 1; mask < 1 << dice.length; mask++) {
    const idx = dice.flatMap((_, i) => (mask & (1 << i) ? [i] : []));
    const score = scoreDice(idx.map((i) => dice[i]));
    if (score !== null && (score > bestScore || (score === bestScore && idx.length < best.length))) [best, bestScore] = [idx, score];
  }
  return best;
}

export const canScore = (dice: number[]): boolean => bestKeep(dice).length > 0;

export function newGame(level: Level = 'strong'): State {
  return { level, phase: 'roll', turn: 0, scores: [0, 0], dice: [], kept: [], remaining: 6, turnPoints: 0 };
}

export function roll(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'roll') return null;
  const dice = Array.from({ length: s.remaining }, () => randomInt(6, rng) + 1);
  return { ...s, dice, phase: canScore(dice) ? 'choose' : 'bust' };
}

/** Sets aside the dice at `indexes`. They must all score. */
export function keep(s: State, indexes: number[]): State | null {
  if (s.phase !== 'choose' || new Set(indexes).size !== indexes.length || indexes.some((i) => !(i in s.dice))) return null;
  const chosen = indexes.map((i) => s.dice[i]);
  const points = scoreDice(chosen);
  if (points === null) return null;
  const remaining = s.remaining - chosen.length;
  return {
    ...s,
    phase: 'roll',
    dice: [],
    kept: remaining ? [...s.kept, ...chosen] : [], // hot dice: all six go back in
    remaining: remaining || 6,
    turnPoints: s.turnPoints + points,
  };
}

/** Adds the turn's points to your score and passes the dice. */
export function bank(s: State): State | null {
  if (s.phase !== 'roll' || !s.turnPoints) return null;
  const scores: [number, number] = [...s.scores];
  scores[s.turn] += s.turnPoints;
  if (scores[s.turn] >= GOAL) return { ...s, scores, phase: 'gameOver' };
  return nextTurn({ ...s, scores });
}

/** After a bust, the turn passes with nothing scored. */
export const endBust = (s: State): State | null => (s.phase === 'bust' ? nextTurn(s) : null);

const nextTurn = (s: State): State => ({ ...s, phase: 'roll', turn: s.turn === 0 ? 1 : 0, dice: [], kept: [], remaining: 6, turnPoints: 0 });

export const winner = (s: State): Player | null => (s.phase === 'gameOver' ? s.turn : null);

// --- Computer player ---

/** Turn points worth banking with this many dice left to roll (Strong). */
const BANK_AT = [0, 300, 300, 400, 1000, 2000, Infinity];

/** Whether the computer should bank now rather than roll again. */
export function shouldBank(s: State, rng: Rng = Math.random): boolean {
  if (!s.turnPoints) return false;
  if (s.scores[s.turn] + s.turnPoints >= GOAL) return true;
  if (s.level === 'easy') return s.turnPoints >= 300 + randomInt(4, rng) * 100 || s.remaining <= 2;
  return s.turnPoints >= BANK_AT[s.remaining];
}

/**
 * Easy keeps every scoring die. Strong does too, unless the points are all loose 1s and 5s:
 * then it keeps just the best one, to roll more dice, unless keeping all of them would
 * use up every die and earn a fresh roll of six.
 */
export function chooseKeep(s: State): number[] {
  const best = bestKeep(s.dice);
  if (s.level === 'easy' || best.length < 2) return best;
  const loose = best.every((i) => s.dice[i] === 1 || s.dice[i] === 5) && scoreDice(best.map((i) => s.dice[i])) === best.reduce((t, i) => t + single(s.dice[i]), 0);
  if (!loose || best.length === s.remaining) return best; // keeping them all means six fresh dice
  const one = best.find((i) => s.dice[i] === 1);
  return [one ?? best[0]];
}

/** One step of the computer's turn: roll, keep, bank or move on from a bust. */
export function computerStep(s: State, rng: Rng = Math.random): State | null {
  if (s.phase === 'bust') return endBust(s);
  if (s.phase === 'choose') return keep(s, chooseKeep(s));
  return shouldBank(s, rng) ? bank(s) : roll(s, rng);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const dice = (a: unknown) => Array.isArray(a) && a.every((d) => Number.isInteger(d) && d >= 1 && d <= 6);
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    ['roll', 'choose', 'bust', 'gameOver'].includes(st.phase) &&
    (st.turn === 0 || st.turn === 1) &&
    Array.isArray(st.scores) &&
    st.scores.length === 2 &&
    dice(st.dice) &&
    dice(st.kept) &&
    Number.isInteger(st.remaining) &&
    st.remaining >= 1 &&
    st.remaining <= 6 &&
    typeof st.turnPoints === 'number'
  );
}

// Pig: you against the computer, first to 100. On your turn, roll one die as often as you
// like, adding each roll to your turn total, and hold to bank it. Roll a 1 and the turn
// ends with nothing banked. The best play to win, for every situation, comes from
// policy.ts (scripts/make-pig.mjs works it out). Pure functions: every action returns a
// new State, or null.
import { randomInt, type Rng } from '../../core/random';
import { TABLE } from './policy';

export const GOAL = 100;
export type Level = 'easy' | 'strong';
export type Player = 0 | 1;

export interface State {
  level: Level;
  scores: [number, number];
  turn: Player;
  /** Points this turn, not yet banked. */
  turnPoints: number;
  /** The last roll, or null at the start of a turn. */
  roll: number | null;
  /** The last roll was a 1: the turn passes when the screen moves on. */
  bust: boolean;
  winner: Player | null;
}

export function newGame(level: Level = 'strong'): State {
  return { level, scores: [0, 0], turn: 0, turnPoints: 0, roll: null, bust: false, winner: null };
}

const pass = (s: State): State => ({ ...s, turn: (1 - s.turn) as Player, turnPoints: 0, roll: null, bust: false });

export function roll(s: State, rng: Rng = Math.random): State | null {
  if (s.winner !== null || s.bust) return null;
  const die = randomInt(6, rng) + 1;
  if (die === 1) return { ...s, roll: 1, turnPoints: 0, bust: true };
  return { ...s, roll: die, turnPoints: s.turnPoints + die };
}

/** Banks the turn's points; reaching the goal wins. */
export function hold(s: State): State | null {
  if (s.winner !== null || s.bust || !s.turnPoints) return null;
  const scores: [number, number] = [...s.scores];
  scores[s.turn] += s.turnPoints;
  if (scores[s.turn] >= GOAL) return { ...s, scores, turnPoints: 0, winner: s.turn };
  return pass({ ...s, scores });
}

/** After a 1: the turn passes. */
export const endBust = (s: State): State | null => (s.bust && s.winner === null ? pass(s) : null);

// --- The best play ---

let rows: string[] | null = null;

/** Whether holding is the best play to win, with these scores and points this turn. */
export function bestIsHold(mine: number, theirs: number, turnPoints: number): boolean {
  if (turnPoints === 0) return false;
  if (mine + turnPoints >= GOAL) return true;
  rows ??= TABLE.split(',');
  const row = rows[mine * GOAL + theirs];
  let holding = false;
  for (let at = 0; at < row.length; at += 2) {
    if (parseInt(row.slice(at, at + 2), 36) > turnPoints) break;
    holding = !holding;
  }
  return holding;
}

/** The best play for whoever's turn it is. */
export const best = (s: State): 'roll' | 'hold' => (bestIsHold(s.scores[s.turn], s.scores[1 - s.turn], s.turnPoints) ? 'hold' : 'roll');

/** Strong plays the best play; Easy holds once it has 15 to 25 points (or can win). */
export function chooseComputer(s: State, rng: Rng = Math.random): 'roll' | 'hold' {
  if (s.level === 'strong') return best(s);
  if (s.scores[s.turn] + s.turnPoints >= GOAL) return 'hold';
  return s.turnPoints >= 15 + randomInt(11, rng) ? 'hold' : 'roll';
}

/** One step of the computer's turn. */
export function computerStep(s: State, rng: Rng = Math.random): State | null {
  if (s.bust) return endBust(s);
  return chooseComputer(s, rng) === 'hold' ? hold(s) : roll(s, rng);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const score = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    Array.isArray(st.scores) &&
    st.scores.length === 2 &&
    st.scores.every(score) &&
    (st.turn === 0 || st.turn === 1) &&
    score(st.turnPoints) &&
    (st.roll === null || (Number.isInteger(st.roll) && st.roll >= 1 && st.roll <= 6)) &&
    typeof st.bust === 'boolean' &&
    (st.winner === null || st.winner === 0 || st.winner === 1)
  );
}

// Backgammon, you (0) against the computer (1), without the doubling cube. Points are
// indexed 0-23. You move from 23 down to 0 and bear off past 0 (your home is 0-5); the
// computer moves up from 0 and bears off past 23 (its home is 18-23). A point with two
// or more of the other side's checkers is blocked; a single one is hit and goes to the
// bar, and must come back in before anything else moves. Doubles give four moves, and you
// must use as many dice as you can (the larger one if only one fits).
// Pure functions: every action returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Side = 0 | 1;
/** Where a move starts: a point, or the bar. Where it ends: a point, or off the board. */
export type From = number | 'bar';
export type To = number | 'off';
export interface Move {
  from: From;
  to: To;
  die: number;
}

export const CHECKERS = 15;

export interface State {
  level: Level;
  /** Checkers on each point: positive for yours, negative for the computer's. */
  points: number[];
  bar: [number, number];
  off: [number, number];
  turn: Side;
  starter: Side;
  /** Dice still to use this turn; empty before rolling. */
  dice: number[];
  /** The two dice of the latest roll, shown even when it couldn't be played. */
  lastRoll: number[];
  /** The state at the start of this turn's moves, for Undo. */
  turnStart: State | null;
  result: Side | null;
  /** A win with none of the loser's checkers off counts double (a gammon). */
  gammon: boolean;
  tally: { you: number; computer: number };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export const other = (s: Side): Side => (s === 0 ? 1 : 0);
const sign = (side: Side) => (side === 0 ? 1 : -1);
const mine = (n: number, side: Side) => n * sign(side) > 0;
const theirs = (n: number, side: Side) => n * sign(side) < 0;

function startPoints(): number[] {
  const p = Array(24).fill(0);
  [[23, 2], [12, 5], [7, 3], [5, 5]].forEach(([i, n]) => {
    p[i] = n;
    p[23 - i] = -n;
  });
  return p;
}

export function newGame(level: Level = 'strong'): State {
  return { level, points: startPoints(), bar: [0, 0], off: [0, 0], turn: 0, starter: 0, dice: [], lastRoll: [], turnStart: null, result: null, gammon: false, tally: { you: 0, computer: 0 } };
}

export function newRound(s: State): State {
  const starter = other(s.starter);
  return { ...newGame(s.level), turn: starter, starter, tally: { ...s.tally } };
}

/** How far each side still has to go: the pip count. Lower is better. */
export function pips(s: State, side: Side): number {
  let total = s.bar[side] * 25;
  s.points.forEach((n, i) => {
    if (mine(n, side)) total += Math.abs(n) * (side === 0 ? i + 1 : 24 - i);
  });
  return total;
}

const allHome = (s: State, side: Side) =>
  s.bar[side] === 0 && s.points.every((n, i) => !mine(n, side) || (side === 0 ? i <= 5 : i >= 18));

/** Single-die moves for `side`, ignoring the use-both-dice rule. */
function singleMoves(s: State, side: Side, die: number): Move[] {
  const open = (i: number) => !(Math.abs(s.points[i]) >= 2 && theirs(s.points[i], side));
  if (s.bar[side]) {
    const to = side === 0 ? 24 - die : die - 1;
    return open(to) ? [{ from: 'bar', to, die }] : [];
  }
  const moves: Move[] = [];
  const home = allHome(s, side);
  s.points.forEach((n, from) => {
    if (!mine(n, side)) return;
    const to = side === 0 ? from - die : from + die;
    if (to >= 0 && to <= 23) {
      if (open(to)) moves.push({ from, to, die });
      return;
    }
    if (!home) return;
    const distance = side === 0 ? from + 1 : 24 - from;
    // Bear off exactly, or with a bigger die from the farthest checker.
    const farther = s.points.some((m, i) => mine(m, side) && (side === 0 ? i > from : i < from));
    if (distance === die || (die > distance && !farther)) moves.push({ from, to: 'off', die });
  });
  return moves;
}

/** Plays one checker move. Assumes it's legal. */
export function apply(s: State, m: Move): State {
  const n: State = clone({ ...s, turnStart: null });
  const side = s.turn;
  if (m.from === 'bar') n.bar[side]--;
  else n.points[m.from] -= sign(side);
  if (m.to === 'off') n.off[side]++;
  else {
    if (theirs(n.points[m.to], side)) {
      n.points[m.to] = 0;
      n.bar[other(side)]++;
    }
    n.points[m.to] += sign(side);
  }
  n.dice.splice(n.dice.indexOf(m.die), 1);
  n.turnStart = s.turnStart;
  return n;
}

const keyOf = (st: State) => `${st.points}|${st.bar}|${st.off}|${[...st.dice].sort()}`;
const options = (st: State) => [...new Set(st.dice)].flatMap((d) => singleMoves(st, st.turn, d));

/** The most dice that can still be used from here (each position worked out once). */
function maxLen(st: State, memo: Map<string, number>): number {
  const key = keyOf(st);
  const known = memo.get(key);
  if (known !== undefined) return known;
  const opts = options(st);
  const len = opts.length ? 1 + Math.max(...opts.map((m) => maxLen(apply(st, m), memo))) : 0;
  memo.set(key, len);
  return len;
}

/** The first moves allowed by the use-both-dice rule (or the larger die, if only one fits). */
function allowedFirst(s: State, memo: Map<string, number>): Move[] {
  const opts = options(s);
  if (!opts.length) return [];
  const lens = opts.map((m) => 1 + maxLen(apply(s, m), memo));
  const longest = Math.max(...lens);
  let ok = opts.filter((_, i) => lens[i] === longest);
  if (longest === 1 && s.dice.length === 2 && s.dice[0] !== s.dice[1]) {
    const big = Math.max(...s.dice);
    if (ok.some((m) => m.die === big)) ok = ok.filter((m) => m.die === big);
  }
  return ok;
}

/** Ways to play the rest of this turn, one per different end position, each using as many dice as allowed. */
export function sequences(s: State): Move[][] {
  const memo = new Map<string, number>();
  const seen = new Set<string>();
  const out: Move[][] = [];
  const walk = (st: State, done: Move[]) => {
    const key = keyOf(st);
    if (seen.has(key)) return;
    seen.add(key);
    const next = allowedFirst(st, memo);
    if (!next.length) return void out.push(done);
    for (const m of next) walk(apply(st, m), [...done, m]);
  };
  walk(s, []);
  return out;
}

/** The moves you may make next. */
export function legalMoves(s: State): Move[] {
  if (s.result !== null || !s.dice.length) return [];
  const seen = new Set<string>();
  return allowedFirst(s, new Map()).filter((m) => !seen.has(`${m.from}>${m.to}>${m.die}`) && !!seen.add(`${m.from}>${m.to}>${m.die}`));
}

/** Ends the turn, or the game when the mover has borne off all fifteen. */
function finish(s: State): State {
  const side = s.turn;
  if (s.off[side] === CHECKERS) {
    const gammon = s.off[other(side)] === 0;
    const points = gammon ? 2 : 1;
    return {
      ...s,
      dice: [],
      turnStart: null,
      result: side,
      gammon,
      tally: { you: s.tally.you + (side === 0 ? points : 0), computer: s.tally.computer + (side === 1 ? points : 0) },
    };
  }
  return { ...s, dice: [], turnStart: null, turn: other(side) };
}

/** Rolls the dice for whoever's turn it is. With no move possible, the turn passes. */
export function roll(s: State, rng: Rng = Math.random): State | null {
  if (s.result !== null || s.dice.length) return null;
  const a = randomInt(6, rng) + 1;
  const b = randomInt(6, rng) + 1;
  const rolled = { ...s, dice: a === b ? [a, a, a, a] : [a, b], lastRoll: [a, b], turnStart: null };
  const withStart = { ...rolled, turnStart: rolled };
  return legalMoves(withStart).length ? withStart : finish(withStart);
}

/** Makes one move; the turn ends by itself once no more moves are possible. */
export function move(s: State, m: Move): State | null {
  const legal = legalMoves(s).some((x) => x.from === m.from && x.to === m.to && x.die === m.die);
  if (!legal) return null;
  const n = apply(s, m);
  return n.off[n.turn] === CHECKERS || !legalMoves(n).length ? finish(n) : n;
}

/** Takes back the moves made so far this turn. */
export function undoTurn(s: State): State | null {
  if (!s.turnStart || s.turnStart.dice.length === s.dice.length) return null;
  return s.turnStart;
}

/** How good a position is for `side`: race lead, made points, and fewer blots in reach. */
export function evaluate(s: State, side: Side): number {
  let score = (pips(s, other(side)) - pips(s, side)) + 12 * (s.off[side] - s.off[other(side)]) + 15 * (s.bar[other(side)] - s.bar[side]);
  s.points.forEach((n, i) => {
    if (!mine(n, side)) return;
    const home = side === 0 ? i <= 5 : i >= 18;
    if (Math.abs(n) >= 2) score += home ? 6 : 3;
    else {
      // A blot the other side could hit: worse the closer their checkers are.
      const threats = s.points.some((m, j) => theirs(m, side) && (side === 0 ? j > i : j < i) && Math.abs(j - i) <= 12) || s.bar[other(side)] > 0;
      if (threats) score -= side === 0 ? 4 + (23 - i) / 4 : 4 + i / 4;
    }
  });
  return score;
}

/** The computer's whole turn: Easy picks any legal way; Strong the best-looking result. */
export function chooseTurn(s: State, rng: Rng = Math.random): Move[] {
  const options = sequences(s);
  if (s.level === 'easy') return options[randomInt(options.length, rng)];
  let best = options[0];
  let bestScore = -Infinity;
  const seen = new Set<string>();
  for (const q of options) {
    const end = q.reduce(apply, s);
    const key = JSON.stringify([end.points, end.bar, end.off]);
    if (seen.has(key)) continue;
    seen.add(key);
    const v = evaluate(end, s.turn);
    if (v > bestScore) [best, bestScore] = [q, v];
  }
  return best;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const side = (v: unknown) => v === 0 || v === 1;
  const pair = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0);
  if (!st || (st.level !== 'easy' && st.level !== 'strong') || !Array.isArray(st.points) || st.points.length !== 24) return false;
  if (!st.points.every(Number.isInteger) || !pair(st.bar) || !pair(st.off) || !side(st.turn) || !side(st.starter)) return false;
  if (!Array.isArray(st.dice) || !st.dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6) || st.dice.length > 4 || !Array.isArray(st.lastRoll)) return false;
  if (!(st.result === null || side(st.result)) || !st.tally || !Number.isInteger(st.tally.you) || !Number.isInteger(st.tally.computer)) return false;
  const count = (sd: Side) => st.bar[sd] + st.off[sd] + st.points.reduce((t, n) => t + (mine(n, sd) ? Math.abs(n) : 0), 0);
  return count(0) === CHECKERS && count(1) === CHECKERS;
}

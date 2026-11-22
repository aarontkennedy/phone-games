// Liar's Dice: you against West and East, five dice each, each player's dice hidden from
// the others. In turn, each player bids how many dice on the whole table show a face (say,
// "four 5s"), or calls "Liar!" on the last bid. A bid must be higher than the last: more
// dice, or the same number of a higher face. On a call, every die is shown: if the bid was
// right, the caller loses a die; if not, the bidder does. The loser starts the next round.
// Lose your last die and you're out; the last player with dice wins. No wild faces.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { randomInt, type Rng } from '../../core/random';

export const PLAYERS = 3;
export const DICE = 5;
export type Player = 0 | 1 | 2;
export type Level = 'easy' | 'strong';
export const NAMES = ['You', 'West', 'East'] as const;

export interface Bid {
  qty: number;
  face: number;
  by: Player;
}

/** A call and what it showed. */
export interface Reveal {
  bid: Bid;
  caller: Player;
  /** How many dice showed the bid's face. */
  actual: number;
  loser: Player;
}

export interface State {
  level: Level;
  /** Each player's dice this round (empty once out). */
  dice: number[][];
  turn: Player;
  bid: Bid | null;
  /** Set after a call, until the next round starts. */
  reveal: Reveal | null;
  winner: Player | null;
}

const rollDice = (n: number, rng: Rng) => Array.from({ length: n }, () => randomInt(6, rng) + 1).sort((a, b) => a - b);
const live = (s: State) => ([0, 1, 2] as const).filter((p) => s.dice[p].length > 0);
const after = (s: State, p: Player): Player => {
  for (let i = 1; i <= PLAYERS; i++) {
    const q = ((p + i) % PLAYERS) as Player;
    if (s.dice[q].length) return q;
  }
  return p;
};

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  return { level, dice: [0, 1, 2].map(() => rollDice(DICE, rng)), turn: 0, bid: null, reveal: null, winner: null };
}

export const totalDice = (s: State): number => s.dice.reduce((t, d) => t + d.length, 0);

/** Whether a bid is higher than the current one (and possible at all). */
export function isHigher(s: State, qty: number, face: number): boolean {
  if (!Number.isInteger(qty) || !Number.isInteger(face) || face < 1 || face > 6 || qty < 1 || qty > totalDice(s)) return false;
  if (!s.bid) return true;
  return qty > s.bid.qty || (qty === s.bid.qty && face > s.bid.face);
}

/** The lowest legal bid on a face: the same number on a higher face, else one more. */
export const lowestOn = (s: State, face: number): number => (!s.bid ? 1 : face > s.bid.face ? s.bid.qty : s.bid.qty + 1);

export function bid(s: State, player: Player, qty: number, face: number): State | null {
  if (s.reveal || s.winner !== null || s.turn !== player || !isHigher(s, qty, face)) return null;
  return { ...s, bid: { qty, face, by: player }, turn: after(s, player) };
}

/** Calls the last bid a lie: every die is shown, and whoever was wrong loses one. */
export function call(s: State, player: Player): State | null {
  if (s.reveal || s.winner !== null || s.turn !== player || !s.bid) return null;
  const actual = s.dice.flat().filter((d) => d === s.bid!.face).length;
  const loser = actual >= s.bid.qty ? player : s.bid.by;
  return { ...s, reveal: { bid: s.bid, caller: player, actual, loser } };
}

/** After a call: the loser drops a die, and (if anyone's left to play) a new round starts. */
export function nextRound(s: State, rng: Rng = Math.random): State | null {
  if (!s.reveal || s.winner !== null) return null;
  const counts = s.dice.map((d, p) => d.length - (p === s.reveal!.loser ? 1 : 0));
  const dice = counts.map((n) => rollDice(n, rng));
  const next: State = { ...s, dice, bid: null, reveal: null };
  const left = live(next);
  if (left.length === 1) return { ...next, winner: left[0], turn: left[0] };
  // The loser starts, or the next player if the loser is out.
  return { ...next, turn: dice[s.reveal.loser].length ? s.reveal.loser : after(next, s.reveal.loser) };
}

// --- Odds: Hint and the computer players ---

const choose = (n: number, k: number): number => {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
};

/** The chance at least `need` of `n` unseen dice show a given face. */
export function atLeast(need: number, n: number): number {
  if (need <= 0) return 1;
  let p = 0;
  for (let k = need; k <= n; k++) p += choose(n, k) * (1 / 6) ** k * (5 / 6) ** (n - k);
  return p;
}

/** The chance a bid is true, to `player`, who sees only their own dice. */
export function chance(s: State, player: Player, qty: number, face: number): number {
  const mine = s.dice[player].filter((d) => d === face).length;
  return atLeast(qty - mine, totalDice(s) - s.dice[player].length);
}

/** The likeliest legal bid for `player`: on each face, the lowest legal number, then the best. */
export function safestBid(s: State, player: Player): { qty: number; face: number; chance: number } | null {
  let best: { qty: number; face: number; chance: number } | null = null;
  for (let face = 1; face <= 6; face++) {
    const qty = lowestOn(s, face);
    if (!isHigher(s, qty, face)) continue;
    const c = chance(s, player, qty, face);
    if (!best || c > best.chance + 1e-12 || (Math.abs(c - best.chance) < 1e-12 && face > best.face)) best = { qty, face, chance: c };
  }
  return best;
}

/** Call when the last bid is less likely than this (and less likely than any raise). */
export const CALL_BELOW = 0.4;

/** The best move by the odds: call the last bid, or make the likeliest raise. */
export function advice(s: State, player: Player): { call: true; chance: number } | { call: false; qty: number; face: number; chance: number } {
  const raise = safestBid(s, player);
  if (s.bid) {
    const truth = chance(s, player, s.bid.qty, s.bid.face);
    if (!raise || (truth < CALL_BELOW && raise.chance < 1 - truth)) return { call: true, chance: truth };
  }
  return { call: false, ...raise! };
}

/**
 * The computer players. Strong follows the odds, and now and then bids a face it holds
 * more of than it needs to (a bluff of strength). Easy calls and raises loosely.
 */
export function computerMove(s: State, rng: Rng = Math.random): State | null {
  const p = s.turn;
  if (s.reveal || s.winner !== null || p === 0) return null;
  if (s.level === 'easy') {
    if (s.bid && chance(s, p, s.bid.qty, s.bid.face) < 0.2 + rng() * 0.3) return call(s, p);
    const face = 1 + randomInt(6, rng);
    return bid(s, p, lowestOn(s, face) + (rng() < 0.3 ? 1 : 0), face) ?? (s.bid ? call(s, p) : bid(s, p, 1, face));
  }
  const best = advice(s, p);
  if (best.call) return call(s, p);
  // A bluff now and then: push a face it holds plenty of one higher than it needs to.
  if (rng() < 0.15) {
    const held = s.dice[p].reduce((m, d, _, a) => (a.filter((x) => x === d).length > a.filter((x) => x === m).length ? d : m), s.dice[p][0]);
    const push = bid(s, p, lowestOn(s, held) + 1, held);
    if (push) return push;
  }
  return bid(s, p, best.qty, best.face);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const die = (d: unknown) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 6;
  const player = (p: unknown) => p === 0 || p === 1 || p === 2;
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    Array.isArray(st.dice) &&
    st.dice.length === PLAYERS &&
    st.dice.every((d) => Array.isArray(d) && d.length <= DICE && d.every(die)) &&
    player(st.turn) &&
    (st.bid === null || (Number.isInteger(st.bid.qty) && die(st.bid.face) && player(st.bid.by))) &&
    (st.winner === null || player(st.winner))
  );
}

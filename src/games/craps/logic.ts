// Craps: bet on rolls of two dice. The first roll of a round (the "come-out") wins the
// pass line on 7 or 11 and loses it on 2, 3 or 12; any other total becomes the point,
// and the pass line then wins if the point comes again before a 7. Don't pass is the
// opposite (12 on the come-out is a tie). Come and don't come work the same way but
// start on any roll while a point is on, each with its own number. Odds can go behind a
// pass, don't pass, come or don't come bet once it has a number, paid at true odds (no
// house edge). The field is a one-roll bet. Pure functions: every action returns a new
// State, or null if it isn't allowed.
import { randomInt, type Rng } from '../../core/random';

export const START_CHIPS = 1000;
export const CHIPS = [5, 25, 100] as const;
export const POINTS = [4, 5, 6, 8, 9, 10] as const;
/** The field wins on these totals: 2 pays double, 12 pays triple, the rest even money. */
export const FIELD = [2, 3, 4, 9, 10, 11, 12] as const;

export type Kind = 'pass' | 'dontPass' | 'come' | 'dontCome';

export interface LineBet {
  kind: Kind;
  flat: number;
  odds: number;
  /**
   * A come or don't come bet's own number, once it has one. Pass and don't pass use the
   * table's point instead, so theirs is always null.
   */
  point: number | null;
}

/** What happened to one bet on a roll, for the status line. `net` is chips won (or lost, below 0). */
export interface Outcome {
  name: string;
  net: number;
  /** A come bet that moved to its number. */
  moved?: number;
}

export interface State {
  /** Chips in front of you, not counting those on the table. */
  chips: number;
  chip: number;
  /** The table's point, or null before the come-out roll. */
  point: number | null;
  bets: LineBet[];
  field: number;
  /** The last roll, or null before the first. */
  dice: [number, number] | null;
  outcomes: Outcome[];
}

export const NAMES: Record<Kind, string> = { pass: 'Pass line', dontPass: 'Don’t pass', come: 'Come', dontCome: 'Don’t come' };
const isDont = (k: Kind) => k === 'dontPass' || k === 'dontCome';
const isLine = (k: Kind) => k === 'pass' || k === 'dontPass';

/** True odds of the point coming before a 7, as [pays, for]: 4 and 10 pay 2 to 1, and so on. */
const TRUE_ODDS: Record<number, [number, number]> = { 4: [2, 1], 10: [2, 1], 5: [3, 2], 9: [3, 2], 6: [6, 5], 8: [6, 5] };
/** Odds allowed behind a bet, as a multiple of it: 3, 4 and 5 times, which always pays 6 times. Laying odds: up to 6 times. */
const ODDS_LIMIT: Record<number, number> = { 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 };
const LAY_LIMIT = 6;

/** Winnings on odds of `amount` behind a bet on `point` (whole chips, rounded down). */
export function oddsWin(kind: Kind, point: number, amount: number): number {
  const [a, b] = TRUE_ODDS[point];
  return Math.floor(isDont(kind) ? (amount * b) / a : (amount * a) / b);
}

export const onTable = (s: State): number => s.field + s.bets.reduce((t, b) => t + b.flat + b.odds, 0);

export function newState(): State {
  return { chips: START_CHIPS, chip: CHIPS[0], point: null, bets: [], field: 0, dice: null, outcomes: [] };
}

export function setChip(s: State, chip: number): State | null {
  return (CHIPS as readonly number[]).includes(chip) ? { ...s, chip } : null;
}

/** The number a bet is riding on: its own, or the table's point for the pass line. */
export const pointOf = (s: State, b: LineBet): number | null => (isLine(b.kind) ? s.point : b.point);

/** How much more odds a bet can take. */
export function oddsRoom(s: State, b: LineBet): number {
  const p = pointOf(s, b);
  if (p === null) return 0;
  return b.flat * (isDont(b.kind) ? LAY_LIMIT : ODDS_LIMIT[p]) - b.odds;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));

/**
 * Bets one chip. `target` is a bet ("pass", "dontPass", "come", "dontCome", "field"), or
 * odds behind one: "odds:pass", "odds:dontPass", or "odds:6" for your come (or don't come)
 * bet on 6. Pass and don't pass go down before the come-out; come and don't come while a
 * point is on. Odds go up to the table limit.
 */
export function place(s: State, target: string): State | null {
  const n = clone(s);
  if (target === 'field') {
    if (n.chips < n.chip) return null;
    n.chips -= n.chip;
    n.field += n.chip;
    return n;
  }
  if (target.startsWith('odds:')) {
    const what = target.slice(5);
    const bet = n.bets.find((b) =>
      what === 'pass' || what === 'dontPass' ? b.kind === what : !isLine(b.kind) && b.point === Number(what) && oddsRoom(n, b) > 0,
    );
    if (!bet) return null;
    const amount = Math.min(n.chip, oddsRoom(n, bet), n.chips);
    if (amount <= 0) return null;
    n.chips -= amount;
    bet.odds += amount;
    return n;
  }
  const kind = target as Kind;
  if (!(kind in NAMES) || n.chips < n.chip || (isLine(kind) ? n.point !== null : n.point === null)) return null;
  const bet = n.bets.find((b) => b.kind === kind && b.point === null);
  if (bet) bet.flat += n.chip;
  else n.bets.push({ kind, flat: n.chip, odds: 0, point: null });
  n.chips -= n.chip;
  return n;
}

/**
 * Takes back everything that's allowed back: the field, all odds, and line bets that
 * haven't got a number yet. Bets riding on a number stay until they win or lose.
 */
export function takeDown(s: State): State | null {
  const n = clone(s);
  let back = n.field;
  n.field = 0;
  n.bets = n.bets.filter((b) => {
    back += b.odds;
    b.odds = 0;
    if (pointOf(n, b) !== null) return true;
    back += b.flat;
    return false;
  });
  if (!back) return null;
  n.chips += back;
  return n;
}

/** Rolls the dice and settles every bet the roll decides. */
export function roll(s: State, rng: Rng = Math.random): State | null {
  return settle(s, [1 + randomInt(6, rng), 1 + randomInt(6, rng)]);
}

export function settle(s: State, dice: [number, number]): State {
  const n = clone(s);
  const total = dice[0] + dice[1];
  const comeOut = n.point === null;
  const outcomes: Outcome[] = [];
  const pay = (name: string, stake: number, win: number) => {
    n.chips += stake + win;
    outcomes.push({ name, net: win });
  };
  const lose = (name: string, amount: number) => outcomes.push({ name, net: -amount });

  if (n.field) {
    if ((FIELD as readonly number[]).includes(total)) pay('Field', n.field, n.field * (total === 2 ? 2 : total === 12 ? 3 : 1));
    else lose('Field', n.field);
    n.field = 0;
  }

  n.bets = n.bets.filter((b) => {
    const dont = isDont(b.kind);
    const p = pointOf(s, b);
    const name = p !== null && !isLine(b.kind) ? `${NAMES[b.kind]} on ${p}` : NAMES[b.kind];
    if (p === null) {
      // A bet's first roll: 7 or 11 wins (loses for don't), 2, 3 or 12 loses (wins for
      // don't, but 12 ties), and any other total becomes its number.
      if (total === 7 || total === 11) {
        if (dont) lose(name, b.flat);
        else pay(name, b.flat, b.flat);
        return false;
      }
      if (total === 2 || total === 3 || total === 12) {
        if (dont && total === 12) return true; // a tie: the bet stays for the next roll
        if (dont) pay(name, b.flat, b.flat);
        else lose(name, b.flat);
        return false;
      }
      if (!isLine(b.kind)) {
        b.point = total;
        outcomes.push({ name: NAMES[b.kind], net: 0, moved: total });
      }
      return true;
    }
    // Riding on a number: it wins on that number and loses on 7 (the other way round for don't).
    if (total !== p && total !== 7) return true;
    // Odds behind a come bet sit out the come-out roll and come back either way.
    const oddsOff = comeOut && !isLine(b.kind) && !dont;
    const won = (total === p) !== dont;
    if (won) pay(name, b.flat + b.odds, b.flat + (oddsOff ? 0 : oddsWin(b.kind, p, b.odds)));
    else {
      if (oddsOff) n.chips += b.odds;
      lose(name, b.flat + (oddsOff ? 0 : b.odds));
    }
    return false;
  });

  if (comeOut) n.point = (POINTS as readonly number[]).includes(total) ? total : null;
  else if (total === n.point || total === 7) n.point = null;
  n.dice = dice;
  n.outcomes = outcomes;
  return n;
}

export const isBroke = (s: State): boolean => s.chips < CHIPS[0] && onTable(s) === 0;
export const restart = (s: State): State => ({ ...newState(), chip: s.chip });

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const count = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  const point = (v: unknown) => v === null || (POINTS as readonly unknown[]).includes(v);
  const die = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 6;
  const bet = (b: LineBet) =>
    !!b && b.kind in NAMES && count(b.flat) && b.flat > 0 && count(b.odds) && point(b.point) && !(isLine(b.kind) && b.point !== null);
  return (
    !!st &&
    count(st.chips) &&
    (CHIPS as readonly number[]).includes(st.chip) &&
    point(st.point) &&
    Array.isArray(st.bets) &&
    st.bets.every(bet) &&
    count(st.field) &&
    (st.dice === null || (Array.isArray(st.dice) && st.dice.length === 2 && st.dice.every(die))) &&
    Array.isArray(st.outcomes)
  );
}

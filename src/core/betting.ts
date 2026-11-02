// Fixed-limit poker betting for four seats, shared by the poker games: blinds, check,
// call, bet, raise and fold (at most four bets a round), all-ins, side pots, and paying
// the winners. Functions that change a table change the one passed in, so callers pass a
// copy. No DOM.
import { SEATS, nextSeat, type Seat } from './tricks';

export type Action = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export const MAX_RAISES = 4;

/** The betting part of a poker game's state. */
export interface Table {
  dealer: Seat;
  turn: Seat;
  stacks: number[];
  /** Still has cards: dealt in and not folded. */
  live: boolean[];
  /** Chips each seat has put in this betting round, and in the whole hand. */
  bets: number[];
  put: number[];
  raises: number;
  /** Who still has to act this round. */
  toAct: boolean[];
  /** Each seat's last action, for the table, e.g. "Call" or "Raise". */
  said: string[];
}

export interface Pot {
  amount: number;
  /** Who could win it, and who did. */
  eligible: Seat[];
  winners: Seat[];
}

/** The next seat after `seat` matching `test`. */
export function after(seat: Seat, test: (x: Seat) => boolean): Seat {
  for (let i = 1; i <= 4; i++) {
    const x = nextSeat(seat, i);
    if (test(x)) return x;
  }
  return seat;
}

/** Live and with chips left to bet. */
export const canBet = (t: Table, seat: Seat): boolean => t.live[seat] && t.stacks[seat] > 0;
export const toCall = (t: Table, seat: Seat): number => Math.max(...t.bets) - t.bets[seat];
export const pot = (t: Table): number => t.put.reduce((a, b) => a + b, 0);

/** Moves chips (as many as `seat` has, up to `amount`) into the pot. */
function post(t: Table, seat: Seat, amount: number) {
  const chips = Math.min(amount, t.stacks[seat]);
  t.stacks[seat] -= chips;
  t.bets[seat] += chips;
  t.put[seat] += chips;
}

/** Starts a hand: blinds from the two seats after the dealer, then the next seat acts. */
export function postBlinds(t: Table, bigBlind: number) {
  t.bets = [0, 0, 0, 0];
  t.put = [0, 0, 0, 0];
  t.said = ['', '', '', ''];
  const players = SEATS.filter((x) => t.live[x]).length;
  // Two players: the dealer posts the small blind and acts first.
  const small = players === 2 ? t.dealer : after(t.dealer, (x) => t.live[x]);
  const big = after(small, (x) => t.live[x]);
  post(t, small, bigBlind / 2);
  post(t, big, bigBlind);
  t.said[small] = 'Small blind';
  t.said[big] = 'Big blind';
  t.raises = 1; // the big blind counts as the first bet
  t.toAct = SEATS.map((x) => canBet(t, x));
  t.turn = after(big, (x) => t.toAct[x]);
}

/** Starts a later betting round: no bets yet, first to act is left of the dealer. */
export function newRound(t: Table) {
  t.bets = [0, 0, 0, 0];
  t.raises = 0;
  t.said = t.said.map((w, x) => (t.live[x] ? (t.stacks[x] === 0 ? 'All in' : '') : w));
  t.toAct = SEATS.map((x) => canBet(t, x));
  t.turn = after(t.dealer, (x) => t.toAct[x]);
}

/** What `seat` may do now, if it's their turn to bet. */
export function options(t: Table, seat: Seat): Action[] {
  if (t.turn !== seat || !t.toAct[seat] || !canBet(t, seat)) return [];
  const owe = toCall(t, seat);
  const more = t.raises < MAX_RAISES && t.stacks[seat] > owe && SEATS.some((x) => x !== seat && canBet(t, x));
  if (owe === 0) return more ? ['check', t.raises === 0 ? 'bet' : 'raise'] : ['check'];
  return more ? ['fold', 'call', 'raise'] : ['fold', 'call'];
}

/** Chips a bet or raise of `size` would put in now (all you have, if that's less). */
export const raiseCost = (t: Table, seat: Seat, size: number): number => Math.min(t.stacks[seat], toCall(t, seat) + size);

/** Applies a legal action (check `options` first), and moves the turn on within the round. */
export function applyAction(t: Table, seat: Seat, action: Action, size: number) {
  t.toAct[seat] = false;
  if (action === 'fold') {
    t.live[seat] = false;
    t.said[seat] = 'Fold';
  } else if (action === 'check') {
    t.said[seat] = 'Check';
  } else {
    const before = Math.max(...t.bets);
    post(t, seat, action === 'call' ? toCall(t, seat) : raiseCost(t, seat, size));
    if (t.bets[seat] > before) {
      t.raises++;
      // Everyone else still betting must answer the raise.
      for (const x of SEATS) if (x !== seat && canBet(t, x)) t.toAct[x] = true;
    }
    t.said[seat] = t.stacks[seat] === 0 ? 'All in' : action === 'call' ? 'Call' : action === 'bet' ? 'Bet' : 'Raise';
  }
  if (t.toAct.some(Boolean)) t.turn = after(seat, (x) => t.toAct[x]);
}

/** The pots, main first: each side pot holds what the players eligible for it all put in. */
export function makePots(put: number[], live: boolean[]): { amount: number; eligible: Seat[] }[] {
  const levels = [...new Set(SEATS.filter((x) => live[x]).map((x) => put[x]))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: Seat[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    const amount = put.reduce((t, p) => t + Math.max(0, Math.min(p, level) - prev), 0);
    if (amount) pots.push({ amount, eligible: SEATS.filter((x) => live[x] && put[x] >= level) });
    prev = level;
  }
  // Chips folded players put in above every live player's total go to the last pot.
  const extra = put.reduce((t, p) => t + Math.max(0, p - prev), 0);
  if (extra) pots[pots.length - 1].amount += extra;
  return pots;
}

/**
 * Pays every pot: to the best hand among those eligible (by `score`, higher is better),
 * or to the only one left if everyone else folded. Ties split; odd chips go to the first
 * winners left of the dealer.
 */
export function payPots(t: Table, score: ((seat: Seat) => number) | null): Pot[] {
  return makePots(t.put, t.live).map((p) => {
    let winners = p.eligible;
    if (score && winners.length > 1) {
      const best = Math.max(...winners.map(score));
      winners = winners.filter((x) => score(x) === best);
    }
    const share = Math.floor(p.amount / winners.length);
    let odd = p.amount - share * winners.length;
    for (let i = 1; i <= 4; i++) {
      const x = nextSeat(t.dealer, i);
      if (!winners.includes(x)) continue;
      t.stacks[x] += share + (odd > 0 ? 1 : 0);
      odd--;
    }
    return { ...p, winners };
  });
}

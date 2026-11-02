// Texas hold'em, fixed limit, for four: you and three computer players, 1000 chips each.
// Each hand: two private cards, then five shared cards dealt in three steps (the flop,
// turn and river) with a round of betting before and after each. Bets and raises are a
// set size: the big blind before the turn, twice that after, at most four per round.
// The best five-card hand from your two cards and the five shared ones wins the pot.
// Short stacks can go all in, which makes side pots. Blinds double every 10 hands. The
// game ends when you're out of chips or have them all.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { isCard, isFullDeck, newDeck, sameCard, shuffledDeck, type Card } from '../../core/cards';
import { bestHand, type HandRank } from '../../core/poker';
import { MAX_RAISES, after, applyAction, newRound, options as tableOptions, payPots, pot, postBlinds, raiseCost as tableRaiseCost, toCall, type Action, type Pot, type Table } from '../../core/betting';
import { type Rng } from '../../core/random';
import { SEATS, type Seat } from '../../core/tricks';

export type Level = 'easy' | 'strong';
export type Phase = 'betting' | 'handOver' | 'gameOver';

export const START_CHIPS = 1000;
export const BLIND = 10; // the big blind at the start
export const DOUBLE_EVERY = 10; // hands
export const STREETS = ['Before the flop', 'The flop', 'The turn', 'The river'] as const;

export { MAX_RAISES, pot, toCall, type Action, type Pot };

export interface State extends Table {
  level: Level;
  phase: Phase;
  hand: number;
  hole: Card[][];
  board: Card[];
  deck: Card[];
  /** 0 before the flop, then 1 flop, 2 turn, 3 river. */
  street: number;
  /** How the last hand ended: the pots, and whether hands were shown. */
  pots: Pot[] | null;
  shown: boolean;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
export const bigBlind = (hand: number): number => BLIND * 2 ** Math.floor((hand - 1) / DOUBLE_EVERY);
/** The bet size this round. */
export const betSize = (s: State): number => bigBlind(s.hand) * (s.street < 2 ? 1 : 2);
export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  const s: State = {
    level,
    phase: 'handOver',
    hand: 0,
    dealer: 0,
    stacks: [START_CHIPS, START_CHIPS, START_CHIPS, START_CHIPS],
    live: [false, false, false, false],
    hole: [[], [], [], []],
    board: [],
    deck: [],
    street: 0,
    turn: 0,
    bets: [0, 0, 0, 0],
    put: [0, 0, 0, 0],
    raises: 0,
    toAct: [false, false, false, false],
    said: ['', '', '', ''],
    pots: null,
    shown: false,
  };
  return nextHand({ ...s, dealer: 3 }, rng)!;
}

/** Deals the next hand: the button moves left, blinds go in, two cards each. */
export function nextHand(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'handOver') return null;
  const n = clone(s);
  n.hand++;
  n.phase = 'betting';
  n.dealer = after(s.dealer, (x) => n.stacks[x] > 0);
  n.live = n.stacks.map((c) => c > 0);
  n.deck = shuffledDeck(rng);
  n.hole = SEATS.map((x) => (n.live[x] ? [n.deck.pop()!, n.deck.pop()!] : []));
  n.board = [];
  n.street = 0;
  n.pots = null;
  n.shown = false;
  postBlinds(n, bigBlind(n.hand));
  return settle(n);
}

/** What `seat` may do now. */
export const options = (s: State, seat: Seat): Action[] => (s.phase === 'betting' ? tableOptions(s, seat) : []);

/** Chips a bet or raise would put in now (all you have, if that's less). */
export const raiseCost = (s: State, seat: Seat): number => tableRaiseCost(s, seat, betSize(s));

export function act(s: State, seat: Seat, action: Action): State | null {
  if (!options(s, seat).includes(action)) return null;
  const n = clone(s);
  applyAction(n, seat, action, betSize(s));
  return settle(n);
}

/** Moves play on: to the next player, the next street, or the end of the hand. */
function settle(n: State): State {
  const live = SEATS.filter((x) => n.live[x]);
  if (live.length === 1) return finish(n, false);
  if (n.toAct.some(Boolean)) return n;
  // The round is over. Deal the rest at once if at most one player can still bet.
  const bettors = live.filter((x) => n.stacks[x] > 0).length;
  while (n.street < 3) {
    n.street++;
    n.deck.pop(); // burn a card
    n.board.push(...n.deck.splice(-(n.street === 1 ? 3 : 1)).reverse());
    if (bettors > 1) {
      newRound(n);
      return n;
    }
  }
  return finish(n, true);
}

/** Each player's best hand, for the showdown. */
export const handOf = (s: State, seat: Seat): HandRank => bestHand([...s.hole[seat], ...s.board]);

function finish(n: State, showdown: boolean): State {
  n.pots = payPots(n, showdown ? (x) => handOf(n, x).score : null);
  n.shown = showdown;
  n.toAct = [false, false, false, false];
  n.phase = n.stacks[0] === 0 || n.stacks[0] === 4 * START_CHIPS ? 'gameOver' : 'handOver';
  return n;
}

export const winner = (s: State): boolean | null => (s.phase === 'gameOver' ? s.stacks[0] > 0 : null);

// --- Computer players ---

/** The chance (0 to 1) that `seat`'s hand beats every other live hand, by dealing out the rest many times. */
export function equity(s: State, seat: Seat, rng: Rng, trials = 150): number {
  const opponents = SEATS.filter((x) => x !== seat && s.live[x]).length;
  const unseen = [...s.deck, ...SEATS.flatMap((x) => (x === seat ? [] : s.hole[x]))];
  let wins = 0;
  for (let t = 0; t < trials; t++) {
    const pool = unseen.slice();
    const draw = () => pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const board = [...s.board];
    const theirs = Array.from({ length: opponents }, () => [draw(), draw()]);
    while (board.length < 5) board.push(draw());
    const mine = bestHand([...s.hole[seat], ...board]).score;
    const best = Math.max(...theirs.map((h) => bestHand([...h, ...board]).score));
    if (mine > best) wins++;
    else if (mine === best) wins += 0.5;
  }
  return wins / trials;
}

/**
 * Easy calls a lot, folds only its worst hands, and rarely raises. Strong deals out the
 * rest of the hand many times to judge its chances, calls when the pot pays for the risk,
 * raises good hands, and bluffs now and then.
 */
export function chooseAction(s: State, seat: Seat, rng: Rng = Math.random): Action {
  const opts = options(s, seat);
  const passive: Action = opts.includes('check') ? 'check' : 'call';
  const aggressive = opts.find((a) => a === 'bet' || a === 'raise');
  const eq = equity(s, seat, rng, s.level === 'easy' ? 40 : 150);
  const owe = toCall(s, seat);
  if (s.level === 'easy') {
    if (owe > 0 && eq < 0.15 && rng() < 0.6) return 'fold';
    if (aggressive && eq > 0.6 && rng() < 0.5) return aggressive;
    return passive;
  }
  const players = SEATS.filter((x) => s.live[x]).length;
  const fair = 1 / players; // an even share
  if (aggressive && (eq > fair * 1.6 || rng() < 0.05)) return aggressive;
  if (owe === 0) return 'check';
  const odds = owe / (pot(s) + owe); // what the call risks, against what it could win
  return eq >= odds ? 'call' : 'fold';
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const four = (a: unknown) => Array.isArray(a) && a.length === 4;
  const nums = (a: unknown) => four(a) && (a as unknown[]).every((v) => Number.isInteger(v) && (v as number) >= 0);
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  const seat = (v: unknown) => SEATS.includes(v as Seat);
  if (!st || (st.level !== 'easy' && st.level !== 'strong') || !['betting', 'handOver', 'gameOver'].includes(st.phase)) return false;
  if (!Number.isInteger(st.hand) || !seat(st.dealer) || !seat(st.turn) || !nums(st.stacks) || !nums(st.bets) || !nums(st.put)) return false;
  if (!four(st.live) || !four(st.toAct) || !four(st.said) || !four(st.hole) || !st.hole.every(cards) || !cards(st.board) || !cards(st.deck)) return false;
  if (!Number.isInteger(st.street) || st.street < 0 || st.street > 3 || !Number.isInteger(st.raises) || typeof st.shown !== 'boolean') return false;
  if (!(st.pots === null || Array.isArray(st.pots))) return false;
  // Chips are never made or lost: stacks plus what's in the pot is everyone's starting total.
  const inPot = st.phase === 'betting' ? st.put.reduce((a, b) => a + b, 0) : 0;
  if (st.stacks.reduce((a, b) => a + b, 0) + inPot !== 4 * START_CHIPS) return false;
  return st.phase !== 'betting' || isFullDeck([...st.hole.flat(), ...st.board, ...st.deck, ...burned(st)]);
}

/** Burned cards aren't kept; count them back in for the full-deck check. */
function burned(s: State): Card[] {
  const seen = [...s.hole.flat(), ...s.board, ...s.deck];
  if (52 - seen.length !== s.street) return []; // one burned card per street dealt
  return newDeck().filter((c) => !seen.some((x) => sameCard(x, c)));
}

// Five-card draw, fixed limit, for four: you and three computer players, 1000 chips each.
// Each hand: five private cards and a round of betting; then everyone still in swaps up
// to three cards for new ones, once; then a second round of betting (bets twice the
// size) and the best hand wins. Blinds double every 10 hands. The game ends when you're
// out of chips or have them all. Betting rules are shared with hold'em (core/betting).
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { MAX_RAISES, after, applyAction, newRound, options as tableOptions, payPots, pot, postBlinds, raiseCost as tableRaiseCost, toCall, type Action, type Pot, type Table } from '../../core/betting';
import { isCard, isFullDeck, sameCard, shuffledDeck, type Card } from '../../core/cards';
import { rankFive, type HandRank } from '../../core/poker';
import { type Rng } from '../../core/random';
import { SEATS, type Seat } from '../../core/tricks';

export { MAX_RAISES, pot, toCall, type Action, type Pot };

export type Level = 'easy' | 'strong';
export type Phase = 'betting' | 'drawing' | 'handOver' | 'gameOver';

export const START_CHIPS = 1000;
export const BLIND = 10;
export const DOUBLE_EVERY = 10;
export const MAX_DRAW = 3;

export interface State extends Table {
  level: Level;
  phase: Phase;
  hand: number;
  hands: Card[][];
  deck: Card[];
  /** 0 before the draw, 1 after it. */
  round: number;
  /** Cards each seat swapped, or -1 if it hasn't drawn yet. */
  drew: number[];
  /** Cards no longer in play: everyone's discards. */
  discards: Card[];
  pots: Pot[] | null;
  shown: boolean;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
export const bigBlind = (hand: number): number => BLIND * 2 ** Math.floor((hand - 1) / DOUBLE_EVERY);
export const betSize = (s: State): number => bigBlind(s.hand) * (s.round === 0 ? 1 : 2);
export const handOf = (s: State, seat: Seat): HandRank => rankFive(s.hands[seat]);

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  const s: State = {
    level,
    phase: 'handOver',
    hand: 0,
    dealer: 3,
    turn: 0,
    stacks: [START_CHIPS, START_CHIPS, START_CHIPS, START_CHIPS],
    live: [false, false, false, false],
    bets: [0, 0, 0, 0],
    put: [0, 0, 0, 0],
    raises: 0,
    toAct: [false, false, false, false],
    said: ['', '', '', ''],
    hands: [[], [], [], []],
    deck: [],
    round: 0,
    drew: [-1, -1, -1, -1],
    discards: [],
    pots: null,
    shown: false,
  };
  return nextHand(s, rng)!;
}

/** Deals the next hand: the button moves left, blinds go in, five cards each. */
export function nextHand(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'handOver') return null;
  const n = clone(s);
  n.hand++;
  n.phase = 'betting';
  n.dealer = after(s.dealer, (x) => n.stacks[x] > 0);
  n.live = n.stacks.map((c) => c > 0);
  n.deck = shuffledDeck(rng);
  n.hands = SEATS.map((x) => (n.live[x] ? n.deck.splice(-5) : []));
  n.round = 0;
  n.drew = [-1, -1, -1, -1];
  n.discards = [];
  n.pots = null;
  n.shown = false;
  postBlinds(n, bigBlind(n.hand));
  return settle(n);
}

export const options = (s: State, seat: Seat): Action[] => (s.phase === 'betting' ? tableOptions(s, seat) : []);
export const raiseCost = (s: State, seat: Seat): number => tableRaiseCost(s, seat, betSize(s));

export function act(s: State, seat: Seat, action: Action): State | null {
  if (!options(s, seat).includes(action)) return null;
  const n = clone(s);
  applyAction(n, seat, action, betSize(s));
  return settle(n);
}

/** Swaps the chosen cards (up to three) for new ones from the deck. Choosing none stands pat. */
export function swap(s: State, seat: Seat, cards: Card[]): State | null {
  if (s.phase !== 'drawing' || s.turn !== seat || cards.length > MAX_DRAW) return null;
  if (!cards.every((c) => s.hands[seat].some((h) => sameCard(h, c))) || new Set(cards.map((c) => `${c.rank}${c.suit}`)).size !== cards.length) return null;
  const n = clone(s);
  n.hands[seat] = n.hands[seat].map((c) => (cards.some((x) => sameCard(x, c)) ? n.deck.pop()! : c));
  n.discards.push(...cards);
  n.drew[seat] = cards.length;
  n.said[seat] = cards.length ? `Drew ${cards.length}` : 'Stood pat';
  const next = SEATS.filter((x) => n.live[x] && n.drew[x] < 0);
  if (next.length) {
    n.turn = after(seat, (x) => n.live[x] && n.drew[x] < 0);
    return n;
  }
  // Everyone has drawn: the second round of betting, if two players can still bet.
  n.round = 1;
  n.phase = 'betting';
  const draws = n.said.slice();
  newRound(n);
  // Keep "Drew 2" or "Stood pat" showing until each player acts again: it's worth knowing.
  n.said = n.said.map((w, x) => (n.live[x] && !w ? draws[x] : w));
  return settle(n);
}

/** Moves play on: the next player, the draw, the second round, or the end of the hand. */
function settle(n: State): State {
  const live = SEATS.filter((x) => n.live[x]);
  if (live.length === 1) return finish(n, false);
  if (n.toAct.some(Boolean)) return n;
  if (n.round === 0) {
    n.phase = 'drawing';
    n.turn = after(n.dealer, (x) => n.live[x]);
    n.said = n.said.map((w, x) => (n.live[x] ? '' : w));
    return n;
  }
  return finish(n, true);
}

function finish(n: State, showdown: boolean): State {
  n.pots = payPots(n, showdown ? (x) => handOf(n, x).score : null);
  n.shown = showdown;
  n.toAct = [false, false, false, false];
  n.phase = n.stacks[0] === 0 || n.stacks[0] === 4 * START_CHIPS ? 'gameOver' : 'handOver';
  return n;
}

export const winner = (s: State): boolean | null => (s.phase === 'gameOver' ? s.stacks[0] > 0 : null);

// --- Computer players ---

const high = (c: Card) => (c.rank === 1 ? 14 : c.rank);

/**
 * Which cards to swap, by the usual advice: keep a straight or better; draw one to four
 * cards of a flush or an open straight; keep pairs and trips; otherwise keep the two
 * highest cards (just the ace, if there is one) and draw three.
 */
export function bestDraw(hand: Card[]): Card[] {
  const r = rankFive(hand);
  if (['straight', 'flush', 'fullHouse', 'four', 'straightFlush'].includes(r.category)) return [];
  if (r.category !== 'high') {
    // Keep the matched cards and swap the rest (one card with two pair).
    const counts = new Map<number, number>();
    for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
    return hand.filter((c) => counts.get(c.rank) === 1).slice(0, MAX_DRAW);
  }
  for (const suit of ['S', 'H', 'D', 'C']) {
    const same = hand.filter((c) => c.suit === suit);
    if (same.length === 4) return hand.filter((c) => c.suit !== suit);
  }
  // Four in a row (an open-ended straight draw).
  const ranks = hand.map(high).sort((a, b) => a - b);
  for (const skip of ranks) {
    const rest = ranks.filter((x) => x !== skip);
    if (rest[3] - rest[0] === 3) return [hand.find((c) => high(c) === skip)!];
  }
  const sorted = [...hand].sort((a, b) => high(b) - high(a));
  return sorted[0].rank === 1 ? sorted.slice(1, 4) : sorted.slice(2);
}

/**
 * The chance (0 to 1) that `seat` ends with the best hand, by playing the rest out many
 * times: the others get random hands from the cards `seat` can't see and, before the
 * draw, everyone swaps by bestDraw.
 */
export function equity(s: State, seat: Seat, rng: Rng, trials = 150): number {
  const opponents = SEATS.filter((x) => x !== seat && s.live[x]).length;
  const unseen = [...s.deck, ...s.discards, ...SEATS.flatMap((x) => (x === seat ? [] : s.hands[x]))];
  let wins = 0;
  for (let t = 0; t < trials; t++) {
    const pool = unseen.slice();
    const take = () => pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const improve = (h: Card[]) => {
      if (s.round > 0) return h;
      const toss = bestDraw(h);
      return h.map((c) => (toss.includes(c) ? take() : c));
    };
    const me = rankFive(improve(s.hands[seat])).score;
    let best = 0;
    for (let o = 0; o < opponents; o++) best = Math.max(best, rankFive(improve([take(), take(), take(), take(), take()])).score);
    if (me > best) wins++;
    else if (me === best) wins += 0.5;
  }
  return wins / trials;
}

export type Turn = { action: Action } | { swap: Card[] };

/**
 * Betting: Easy calls a lot and rarely raises; Strong judges its chances against the pot,
 * raises good hands and bluffs now and then. Drawing: Strong follows the usual advice;
 * Easy keeps its pairs but otherwise swaps at random.
 */
export function chooseTurn(s: State, seat: Seat, rng: Rng = Math.random): Turn {
  if (s.phase === 'drawing') {
    if (s.level === 'strong') return { swap: bestDraw(s.hands[seat]) };
    const loose = bestDraw(s.hands[seat]);
    return { swap: loose.filter(() => rng() < 0.7) };
  }
  const opts = options(s, seat);
  const passive: Action = opts.includes('check') ? 'check' : 'call';
  const aggressive = opts.find((a) => a === 'bet' || a === 'raise');
  const eq = equity(s, seat, rng, s.level === 'easy' ? 40 : 150);
  const owe = toCall(s, seat);
  if (s.level === 'easy') {
    if (owe > 0 && eq < 0.15 && rng() < 0.6) return { action: 'fold' };
    if (aggressive && eq > 0.6 && rng() < 0.5) return { action: aggressive };
    return { action: passive };
  }
  const players = SEATS.filter((x) => s.live[x]).length;
  if (aggressive && (eq > (1.6 / players) || rng() < 0.05)) return { action: aggressive };
  if (owe === 0) return { action: 'check' };
  return { action: eq >= owe / (pot(s) + owe) ? 'call' : 'fold' };
}

export function applyTurn(s: State, seat: Seat, t: Turn): State | null {
  return 'swap' in t ? swap(s, seat, t.swap) : act(s, seat, t.action);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const four = (a: unknown) => Array.isArray(a) && a.length === 4;
  const nums = (a: unknown) => four(a) && (a as unknown[]).every((v) => Number.isInteger(v) && (v as number) >= 0);
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  const seat = (v: unknown) => SEATS.includes(v as Seat);
  if (!st || (st.level !== 'easy' && st.level !== 'strong') || !['betting', 'drawing', 'handOver', 'gameOver'].includes(st.phase)) return false;
  if (!Number.isInteger(st.hand) || !seat(st.dealer) || !seat(st.turn) || !nums(st.stacks) || !nums(st.bets) || !nums(st.put)) return false;
  if (!four(st.live) || !four(st.toAct) || !four(st.said) || !four(st.drew) || !four(st.hands) || !st.hands.every(cards) || !cards(st.deck) || !cards(st.discards)) return false;
  if ((st.round !== 0 && st.round !== 1) || !Number.isInteger(st.raises) || typeof st.shown !== 'boolean' || !(st.pots === null || Array.isArray(st.pots))) return false;
  const inPot = st.phase === 'betting' || st.phase === 'drawing' ? st.put.reduce((a, b) => a + b, 0) : 0;
  if (st.stacks.reduce((a, b) => a + b, 0) + inPot !== 4 * START_CHIPS) return false;
  return st.phase === 'handOver' || st.phase === 'gameOver' || isFullDeck([...st.hands.flat(), ...st.deck, ...st.discards]);
}

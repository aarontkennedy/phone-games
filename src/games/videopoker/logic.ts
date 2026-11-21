// Video poker, "jacks or better": bet 1 to 5 credits, get five cards, tap the ones to
// keep, and draw once to replace the rest. The final hand pays by the table below; a
// pair needs to be jacks or higher. A royal flush on a 5-credit bet pays 4000 (800 each).
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { isCard, isFullDeck, newDeck, shuffledDeck, type Card } from '../../core/cards';
import { rankFive, type Category } from '../../core/poker';
import { type Rng } from '../../core/random';

export const START_CREDITS = 100;
export const MAX_BET = 5;

export type Phase = 'betting' | 'holding' | 'done';
/** The pay table rows, best first. */
export type Win = 'royal' | 'straightFlush' | 'four' | 'fullHouse' | 'flush' | 'straight' | 'three' | 'twoPair' | 'jacks';

export const PAYS: readonly [Win, string, number][] = [
  ['royal', 'Royal flush', 250],
  ['straightFlush', 'Straight flush', 50],
  ['four', 'Four of a kind', 25],
  ['fullHouse', 'Full house', 9],
  ['flush', 'Flush', 6],
  ['straight', 'Straight', 4],
  ['three', 'Three of a kind', 3],
  ['twoPair', 'Two pair', 2],
  ['jacks', 'Jacks or better', 1],
];

export interface State {
  phase: Phase;
  credits: number;
  bet: number;
  /** Cards still to deal; the last is dealt next. */
  deck: Card[];
  hand: Card[];
  held: boolean[];
  /** The final hand's row in the pay table, or null for no win. */
  win: Win | null;
  /** Credits paid for the last hand. */
  paid: number;
}

export function newState(): State {
  return { phase: 'betting', credits: START_CREDITS, bet: MAX_BET, deck: [], hand: [], held: [], win: null, paid: 0 };
}

/** Which pay table row a five-card hand hits, if any. */
export function winOf(hand: Card[]): Win | null {
  const r = rankFive(hand);
  if (r.category === 'straightFlush') return r.kickers[0] === 14 ? 'royal' : 'straightFlush';
  if (r.category === 'pair') return r.kickers[0] >= 11 ? 'jacks' : null;
  return r.category === 'high' ? null : (r.category as Exclude<Category, 'high' | 'pair' | 'straightFlush'>);
}

/** Credits a win pays for a bet. The royal pays a bonus on a full 5-credit bet. */
export function payout(win: Win | null, bet: number): number {
  if (!win) return 0;
  if (win === 'royal' && bet === MAX_BET) return 4000;
  return PAYS.find((p) => p[0] === win)![2] * bet;
}

export function setBet(s: State, bet: number): State | null {
  if (s.phase === 'holding' || !Number.isInteger(bet) || bet < 1 || bet > MAX_BET) return null;
  return { ...s, bet };
}

export const isBroke = (s: State): boolean => s.phase !== 'holding' && s.credits < 1;

/** Takes the bet (or as much as you have left) and deals five fresh cards. */
export function deal(s: State, rng: Rng = Math.random): State | null {
  if (s.phase === 'holding' || s.credits < 1) return null;
  const bet = Math.min(s.bet, s.credits);
  const deck = shuffledDeck(rng);
  const hand = deck.splice(-5).reverse();
  return { phase: 'holding', credits: s.credits - bet, bet, deck, hand, held: [false, false, false, false, false], win: null, paid: 0 };
}

export function toggleHold(s: State, i: number): State | null {
  if (s.phase !== 'holding' || !(i >= 0 && i < 5)) return null;
  return { ...s, held: s.held.map((h, j) => (j === i ? !h : h)) };
}

/** Replaces every card you didn't hold, then pays the final hand. */
export function draw(s: State): State | null {
  if (s.phase !== 'holding') return null;
  const deck = s.deck.slice();
  const hand = s.hand.map((c, i) => (s.held[i] ? c : deck.pop()!));
  const win = winOf(hand);
  const paid = payout(win, s.bet);
  return { ...s, phase: 'done', deck, hand, win, paid, credits: s.credits + paid };
}

/** Out of credits: a fresh start. */
export const restart = (s: State): State => ({ ...newState(), bet: s.bet });

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  if (!st || !['betting', 'holding', 'done'].includes(st.phase) || !Number.isInteger(st.credits) || st.credits < 0) return false;
  if (!Number.isInteger(st.bet) || st.bet < 1 || st.bet > MAX_BET || !cards(st.deck) || !cards(st.hand) || !Array.isArray(st.held)) return false;
  if (!(st.win === null || PAYS.some((p) => p[0] === st.win)) || !Number.isInteger(st.paid)) return false;
  if (st.phase === 'betting') return true;
  if (st.hand.length !== 5 || st.held.length !== 5 || !st.held.every((h) => typeof h === 'boolean')) return false;
  // Cards replaced on the draw are gone; before it, hand and deck make a full deck.
  return st.phase === 'done' || isFullDeck([...st.hand, ...st.deck]);
}

// --- The best hold (Hint and the Right score) ---

/** Rank bits (2 is bit 0, ace bit 12) of the five-card straights, and of the royal. */
const STRAIGHTS = new Set([0b1000000001111, ...Array.from({ length: 9 }, (_, i) => 0b11111 << i)]);
const ROYAL = 0b11111 << 8;
const rankBit = (c: Card) => (c.rank === 1 ? 12 : c.rank - 2);
const SUIT_INDEX: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };

/**
 * The average payout of each way to hold cards: index `mask` holds card i when bit i is
 * set. Exact: every possible draw from the 47 unseen cards is scored (about 2.6 million
 * hands, kept fast by updating rank and suit counts as cards are added).
 */
export function holdValues(hand: Card[], bet: number): number[] {
  const pay = (w: Win | null) => payout(w, bet);
  const PAY = {
    royal: pay('royal'), straightFlush: pay('straightFlush'), four: pay('four'), fullHouse: pay('fullHouse'), flush: pay('flush'),
    straight: pay('straight'), three: pay('three'), twoPair: pay('twoPair'), jacks: pay('jacks'),
  };
  const unseen = newDeck().filter((c) => !hand.some((h) => h.suit === c.suit && h.rank === c.rank));
  const uRank = unseen.map(rankBit);
  const uSuit = unseen.map((c) => SUIT_INDEX[c.suit]);
  const counts = new Array<number>(13).fill(0);
  const suits = [0, 0, 0, 0];
  let pairs = 0; // pairs among the cards so far: 1 a pair, 2 two pair, 3 trips, 4 full house, 6 quads
  let highPairs = 0; // ranks jack or higher with 2 or more cards
  let mask = 0;
  const add = (r: number, s: number) => {
    pairs += counts[r];
    if (++counts[r] === 2 && r >= 9) highPairs++;
    if (counts[r] === 1) mask |= 1 << r;
    suits[s]++;
  };
  const remove = (r: number, s: number) => {
    if (counts[r]-- === 2 && r >= 9) highPairs--;
    pairs -= counts[r];
    if (counts[r] === 0) mask &= ~(1 << r);
    suits[s]--;
  };
  const score = (lastSuit: number): number => {
    if (pairs === 0) {
      const flush = suits[lastSuit] === 5;
      const straight = STRAIGHTS.has(mask);
      if (flush) return straight ? (mask === ROYAL ? PAY.royal : PAY.straightFlush) : PAY.flush;
      return straight ? PAY.straight : 0;
    }
    return pairs === 1 ? (highPairs ? PAY.jacks : 0) : pairs === 2 ? PAY.twoPair : pairs === 3 ? PAY.three : pairs === 4 ? PAY.fullHouse : PAY.four;
  };

  const values: number[] = [];
  for (let hold = 0; hold < 32; hold++) {
    const kept = hand.filter((_, i) => hold & (1 << i));
    kept.forEach((c) => add(rankBit(c), SUIT_INDEX[c.suit]));
    const need = 5 - kept.length;
    let total = 0;
    let hands = 0;
    const pick = (from: number, left: number, lastSuit: number) => {
      if (!left) {
        total += score(lastSuit);
        hands++;
        return;
      }
      for (let i = from; i <= unseen.length - left; i++) {
        add(uRank[i], uSuit[i]);
        pick(i + 1, left - 1, uSuit[i]);
        remove(uRank[i], uSuit[i]);
      }
    };
    pick(0, need, kept.length ? SUIT_INDEX[kept[0].suit] : 0);
    values.push(total / hands);
    kept.forEach((c) => remove(rankBit(c), SUIT_INDEX[c.suit]));
  }
  return values;
}

/** The hold mask for held cards: bit i for card i. */
export const holdMask = (held: boolean[]): number => held.reduce((m, h, i) => (h ? m | (1 << i) : m), 0);

/** Which cards to hold for the best average payout, from holdValues. Ties go to the first. */
export function bestHold(values: number[]): boolean[] {
  let best = 0;
  for (let m = 1; m < 32; m++) if (values[m] > values[best] + 1e-9) best = m;
  return Array.from({ length: 5 }, (_, i) => !!(best & (1 << i)));
}

/** Whether holding `held` is as good as the best hold (several holds can tie). */
export const isBestHold = (values: number[], held: boolean[]): boolean => values[holdMask(held)] >= Math.max(...values) - 1e-9;

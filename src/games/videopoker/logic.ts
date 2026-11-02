// Video poker, "jacks or better": bet 1 to 5 credits, get five cards, tap the ones to
// keep, and draw once to replace the rest. The final hand pays by the table below; a
// pair needs to be jacks or higher. A royal flush on a 5-credit bet pays 4000 (800 each).
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { isCard, isFullDeck, shuffledDeck, type Card } from '../../core/cards';
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

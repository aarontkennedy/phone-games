// Pai Gow Poker against the dealer, with one joker (53 cards). You and the dealer each
// get seven cards and split them into a five-card hand and a two-card hand; the five-card
// hand must rank higher. Win both hands against the dealer's and you win your bet, less a
// 5% commission; win one and it's a push; lose both (ties go to the dealer) and you lose.
// The joker counts as an ace, or as any card that completes a straight or a flush. The
// dealer sets its hand the "house way" below, which is also the hint.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { isCard, newDeck, type Card } from '../../core/cards';
import { CATEGORIES, describeHand, rankFive, type HandRank } from '../../core/poker';
import { shuffle, type Rng } from '../../core/random';

export const START_CHIPS = 1000;
/** Multiples of 20, so the 5% commission is always whole chips. */
export const BETS = [20, 40, 100, 200] as const;

export interface Joker {
  joker: true;
}
export type PgCard = Card | Joker;
export const JOKER: Joker = { joker: true };
export const isJoker = (c: PgCard): c is Joker => 'joker' in c;

export type Phase = 'betting' | 'setting' | 'done';
export type Result = 'win' | 'push' | 'lose';

export interface State {
  chips: number;
  bet: number;
  phase: Phase;
  /** Your seven cards, highest first, and which two you've picked for your two-card hand. */
  hand: PgCard[];
  low: number[];
  dealer: PgCard[];
  /** The dealer's two-card hand, once it's set. */
  dealerLow: number[];
  /** Each of your hands against the dealer's, and the overall result. */
  highWon: boolean | null;
  lowWon: boolean | null;
  result: Result | null;
  /** Chips paid back for the hand (your bet included). */
  paid: number;
}

/** A card's rank for ordering, aces (and the joker) as 14. */
export const value = (c: PgCard): number => (isJoker(c) ? 14 : c.rank === 1 ? 14 : c.rank);

/** Five aces (four and the joker) beat everything. */
const FIVE_ACES = CATEGORIES.length * 15 ** 5;

export interface FiveRank {
  score: number;
  /** For the rules: a pair needs `kickers`; null means five aces. */
  rank: HandRank | null;
  name: string;
}

/** Ranks a five-card hand, using the joker in the best way it's allowed. */
export function rankHigh(cards: PgCard[]): FiveRank {
  const real = cards.filter((c): c is Card => !isJoker(c));
  if (real.length === 5) {
    const rank = rankFive(real);
    return { score: rank.score, rank, name: describeHand(rank) };
  }
  if (real.every((c) => c.rank === 1)) return { score: FIVE_ACES, rank: null, name: 'Five aces' };
  let best: HandRank | null = null;
  for (const c of newDeck()) {
    const r = rankFive([...real, c]);
    const allowed = c.rank === 1 || r.category === 'straight' || r.category === 'flush' || r.category === 'straightFlush';
    if (allowed && (!best || r.score > best.score)) best = r;
  }
  return { score: best!.score, rank: best!, name: describeHand(best!) };
}

/** Ranks a two-card hand: a pair beats any two different cards. The joker is an ace here. */
export function rankLow(cards: PgCard[]): number {
  const [a, b] = cards.map(value).sort((x, y) => y - x);
  return a === b ? 1000 + a : a * 15 + b;
}

const WORDS = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
const PLURAL = ['', '', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings', 'aces'];

/** "Pair of kings", or "Ace and nine". */
export function describeLow(cards: PgCard[]): string {
  const [a, b] = cards.map(value).sort((x, y) => y - x);
  if (a === b) return `Pair of ${PLURAL[a]}`;
  const name = `${WORDS[a]} and ${WORDS[b]}`;
  return name[0].toUpperCase() + name.slice(1);
}

/** The five-card hand must rank higher than the two-card hand. */
export function isValidSplit(high: PgCard[], low: PgCard[]): boolean {
  const h = rankHigh(high);
  if (!h.rank) return true;
  const [a, b] = low.map(value).sort((x, y) => y - x);
  const { category, kickers } = h.rank;
  if (category !== 'high' && category !== 'pair') return true;
  if (a === b) return category === 'pair' && kickers[0] >= a;
  if (category === 'pair') return true;
  return kickers[0] > a || (kickers[0] === a && kickers[1] >= b);
}

/** Splits seven cards by the two picked for the low hand. */
export function split(cards: PgCard[], low: number[]): { high: PgCard[]; low: PgCard[] } {
  return { high: cards.filter((_, i) => !low.includes(i)), low: low.map((i) => cards[i]) };
}

/** Every allowed way to split seven cards, as the pair of indices for the low hand. */
function allowedSplits(cards: PgCard[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < 7; i++)
    for (let j = i + 1; j < 7; j++) {
      const s = split(cards, [i, j]);
      if (isValidSplit(s.high, s.low)) out.push([i, j]);
    }
  return out;
}

/**
 * The house way: how the dealer sets its hand, and the hint for yours. In short: no pair,
 * keep the top card in the five and the next two in the two; one pair stays in the five;
 * split two pair when the higher pair is jacks or better (or with no ace to play in the
 * two); with three pair, play the highest pair in the two; a full house puts its pair in
 * the two; split three aces and big four of a kinds; and play a straight or flush when it
 * leaves a good two-card hand.
 */
export function houseWay(cards: PgCard[]): number[] {
  const byValue = new Map<number, number[]>();
  cards.forEach((c, i) => byValue.set(value(c), [...(byValue.get(value(c)) ?? []), i]));
  const groups = [...byValue].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]);
  const of = (n: number) => groups.filter((g) => g[1].length === n).map((g) => g[0]);
  const at = (v: number) => byValue.get(v)!;
  const singles = of(1);
  const [pairs, trips, quads] = [of(2), of(3), of(4)];
  const top = (n: number, except: number[] = []) => singles.filter((v) => !except.includes(v)).slice(0, n).map((v) => at(v)[0]);

  // A straight or flush in the five, with the best two-card hand it leaves.
  const allowed = allowedSplits(cards);
  const strong = allowed
    .map((idx) => ({ idx, ...split(cards, idx) }))
    .filter((s) => {
      const r = rankHigh(s.high).rank;
      return r && ['straight', 'flush', 'straightFlush'].includes(r.category);
    })
    .sort((a, b) => rankLow(b.low) - rankLow(a.low) || rankHigh(b.high).score - rankHigh(a.high).score)[0];
  const goodLow = strong && rankLow(strong.low) >= 13 * 15; // a pair, or king-high or better

  let low: number[];
  if (of(5).length) low = at(14).slice(0, 2);
  else if (quads.length) {
    const q = quads[0];
    if (pairs.length) low = at(pairs[0]);
    else if (trips.length) low = at(trips[0]).slice(0, 2);
    else if (q >= 11) low = at(q).slice(0, 2);
    else if (q >= 7 && singles[0] === 14) low = top(2);
    else if (q >= 7) low = at(q).slice(0, 2);
    else low = top(2);
  } else if (trips.length >= 2) low = at(trips[0]).slice(0, 2);
  else if (trips.length && pairs.length) low = at(pairs[0]);
  else if (trips.length) {
    if (strong && goodLow) low = strong.idx;
    else if (trips[0] === 14) low = [at(14)[0], top(1)[0]];
    else low = top(2);
  } else if (pairs.length >= 3) low = at(pairs[0]);
  else if (pairs.length === 2) {
    const [hi, lo] = pairs;
    if (hi >= 11 || singles[0] !== 14) low = at(lo);
    else low = top(2);
  } else if (pairs.length === 1) {
    low = strong && goodLow ? strong.idx : top(2);
  } else low = strong ? strong.idx : top(2, [singles[0]]);

  // Every case above leaves a legal split (the simulation checks this on many deals).
  return [...low].sort((a, b) => a - b);
}

const byValue = (cards: PgCard[]) => [...cards].sort((a, b) => value(b) - value(a) || Number(isJoker(b)) - Number(isJoker(a)));

export function newState(): State {
  return { chips: START_CHIPS, bet: BETS[1], phase: 'betting', hand: [], low: [], dealer: [], dealerLow: [], highWon: null, lowWon: null, result: null, paid: 0 };
}

export function setBet(s: State, bet: number): State | null {
  if (s.phase === 'setting' || !(BETS as readonly number[]).includes(bet) || bet > s.chips) return null;
  return { ...s, bet };
}

/** Takes the bet and deals seven cards each from a 53-card deck. */
export function deal(s: State, rng: Rng = Math.random): State | null {
  if (s.phase === 'setting' || s.chips < s.bet) return null;
  const deck = shuffle<PgCard>([...newDeck(), JOKER], rng);
  return {
    ...s,
    chips: s.chips - s.bet,
    phase: 'setting',
    hand: byValue(deck.slice(0, 7)),
    low: [],
    dealer: byValue(deck.slice(7, 14)),
    dealerLow: [],
    highWon: null,
    lowWon: null,
    result: null,
    paid: 0,
  };
}

/** Picks a card for your two-card hand, or puts it back. Picking a third swaps out the first. */
export function toggleLow(s: State, i: number): State | null {
  if (s.phase !== 'setting' || !(i >= 0 && i < 7)) return null;
  const low = s.low.includes(i) ? s.low.filter((x) => x !== i) : [...s.low, i].slice(-2);
  return { ...s, low };
}

/** Picks your two-card hand the house way. */
export const useHint = (s: State): State | null => (s.phase === 'setting' ? { ...s, low: houseWay(s.hand) } : null);

export function canPlay(s: State): boolean {
  if (s.phase !== 'setting' || s.low.length !== 2) return false;
  const mine = split(s.hand, s.low);
  return isValidSplit(mine.high, mine.low);
}

/** Your hand is set: the dealer sets its own, and both hands are compared. Ties go to the dealer. */
export function play(s: State): State | null {
  if (!canPlay(s)) return null;
  const dealerLow = houseWay(s.dealer);
  const mine = split(s.hand, s.low);
  const theirs = split(s.dealer, dealerLow);
  const highWon = rankHigh(mine.high).score > rankHigh(theirs.high).score;
  const lowWon = rankLow(mine.low) > rankLow(theirs.low);
  const result: Result = highWon && lowWon ? 'win' : highWon || lowWon ? 'push' : 'lose';
  const paid = result === 'win' ? s.bet * 2 - s.bet / 20 : result === 'push' ? s.bet : 0;
  const n: State = { ...s, phase: 'done', dealerLow, highWon, lowWon, result, paid, chips: s.chips + paid };
  if (n.chips < n.bet) n.bet = [...BETS].reverse().find((b) => b <= n.chips) ?? BETS[0];
  return n;
}

export const isBroke = (s: State): boolean => s.phase !== 'setting' && s.chips < BETS[0];
export const restart = (s: State): State => ({ ...newState(), bet: s.bet });

const isPgCard = (c: unknown): c is PgCard => isCard(c) || (!!c && (c as Joker).joker === true);

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const indices = (a: unknown) => Array.isArray(a) && a.length <= 2 && a.every((i) => Number.isInteger(i) && i >= 0 && i < 7) && new Set(a).size === a.length;
  const seven = (a: unknown) => Array.isArray(a) && (a.length === 0 || a.length === 7) && a.every(isPgCard);
  if (!st || !Number.isInteger(st.chips) || st.chips < 0 || !(BETS as readonly number[]).includes(st.bet)) return false;
  if (!['betting', 'setting', 'done'].includes(st.phase) || !seven(st.hand) || !seven(st.dealer) || !indices(st.low) || !indices(st.dealerLow)) return false;
  if (!Number.isInteger(st.paid) || !(st.result === null || ['win', 'push', 'lose'].includes(st.result))) return false;
  if (st.phase === 'betting') return true;
  if (st.hand.length !== 7 || st.dealer.length !== 7) return false;
  // Fourteen different cards: no card dealt twice.
  const ids = [...st.hand, ...st.dealer].map((c) => (isJoker(c) ? 'joker' : `${c.rank}${c.suit}`));
  return new Set(ids).size === 14 && (st.phase === 'setting' || (st.low.length === 2 && st.dealerLow.length === 2));
}


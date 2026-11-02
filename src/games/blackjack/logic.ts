// Blackjack against the dealer: a shoe of 1, 2, 6 or 8 decks (6 to start), dealer stands
// on soft 17, blackjack pays 3 to 2, double on any first two cards (also after a split), one split, split aces get
// one card each. Pure functions: every action returns a new State, or null if not allowed.
import { isCard, newDeck, sameCard, type Card } from '../../core/cards';
import { shuffle, type Rng } from '../../core/random';
import { DECK_CHOICES, bestPlay, type Play } from './strategy';

export { DECK_CHOICES };
export const DEFAULT_DECKS = 6;
export const START_CHIPS = 1000;
/** Even amounts, so a 3 to 2 blackjack always pays whole chips. */
export const BETS = [10, 20, 50, 100] as const;
/** Reshuffle before a hand once fewer than this many cards are left: a quarter of the shoe. */
export const reshuffleAt = (decks: number): number => 13 * decks;

export type Phase = 'betting' | 'playing' | 'done';
export type Outcome = 'blackjack' | 'win' | 'push' | 'lose';
export type Action = 'hit' | 'stand' | 'double' | 'split';

export interface Hand {
  cards: Card[];
  bet: number;
  /** Came from splitting a pair: 21 here isn't a blackjack. */
  split: boolean;
  /** No more cards: stood, doubled, busted, 21, or a split ace. */
  done: boolean;
  outcome?: Outcome;
  /** Chips paid back when settled (0 for a loss). */
  payout?: number;
}

export interface State {
  /** Decks in the shoe: 1, 2, 6 or 8. */
  decks: number;
  /** Cards left to deal. The last card is dealt next. */
  shoe: Card[];
  chips: number;
  /** Bet for the next hand. */
  bet: number;
  phase: Phase;
  /** The second card stays face down until your hands are finished. */
  dealer: Card[];
  hands: Hand[];
  /** The hand you're playing now. */
  active: number;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));

export function newShoe(decks: number, rng: Rng = Math.random): Card[] {
  return shuffle(Array.from({ length: decks }, newDeck).flat(), rng);
}

export function newState(rng: Rng = Math.random, decks = DEFAULT_DECKS): State {
  return { decks, shoe: newShoe(decks, rng), chips: START_CHIPS, bet: 20, phase: 'betting', dealer: [], hands: [], active: 0 };
}

/** Changes the number of decks between hands, with a freshly shuffled shoe. */
export function setDecks(s: State, decks: number, rng: Rng = Math.random): State | null {
  if (s.phase === 'playing' || !(DECK_CHOICES as readonly number[]).includes(decks) || decks === s.decks) return null;
  return { ...clone(s), decks, shoe: newShoe(decks, rng) };
}

/** Saves from before you could choose the decks had a 6-deck shoe. */
export function upgrade(saved: unknown): unknown {
  return saved && typeof saved === 'object' && !('decks' in saved) ? { ...saved, decks: DEFAULT_DECKS } : saved;
}

/**
 * The next card. If a long hand empties the shoe (possible with one deck), the cards not
 * on the table are shuffled into a new one.
 */
function draw(n: State, rng: Rng = Math.random): Card {
  if (!n.shoe.length) {
    const left = newShoe(n.decks, rng);
    for (const c of [...n.dealer, ...n.hands.flatMap((h) => h.cards)]) left.splice(left.findIndex((x) => sameCard(x, c)), 1);
    n.shoe = left;
  }
  return n.shoe.pop()!;
}

/** Card points: aces 1 (or 11, see handValue), court cards 10. */
export const points = (card: Card): number => Math.min(card.rank, 10);

/** Best total without busting if possible. `soft` means an ace is counting as 11. */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  const hard = cards.reduce((sum, c) => sum + points(c), 0);
  const soft = cards.some((c) => c.rank === 1) && hard + 10 <= 21;
  return { total: soft ? hard + 10 : hard, soft };
}

export const isBlackjack = (cards: Card[], split = false): boolean =>
  !split && cards.length === 2 && handValue(cards).total === 21;

export const isBust = (cards: Card[]): boolean => handValue(cards).total > 21;

export function setBet(s: State, bet: number): State | null {
  if (s.phase === 'playing' || !(BETS as readonly number[]).includes(bet) || bet > s.chips) return null;
  return { ...clone(s), bet };
}

/** Out of chips for even the smallest bet. */
export const isBroke = (s: State): boolean => s.phase !== 'playing' && s.chips < BETS[0];

/** Starts over with a fresh stack of chips. */
export function restart(s: State, rng: Rng = Math.random): State {
  return { ...newState(rng, s.decks), bet: s.bet };
}

export function deal(s: State, rng: Rng = Math.random): State | null {
  if (s.phase === 'playing' || s.chips < s.bet) return null;
  const n = clone(s);
  if (n.shoe.length < reshuffleAt(n.decks)) n.shoe = newShoe(n.decks, rng);
  const [p1, d1, p2, d2] = [draw(n), draw(n), draw(n), draw(n)];
  n.chips -= n.bet;
  n.dealer = [d1, d2];
  n.hands = [{ cards: [p1, p2], bet: n.bet, split: false, done: false }];
  n.active = 0;
  n.phase = 'playing';
  // A blackjack on either side ends the hand at once (the dealer checks under an ace or 10).
  if (isBlackjack(n.dealer) || isBlackjack(n.hands[0].cards)) return settle(n);
  return n;
}

const activeHand = (s: State): Hand | undefined => (s.phase === 'playing' ? s.hands[s.active] : undefined);
const isSplitAce = (h: Hand) => h.split && h.cards[0].rank === 1;

export function canAct(s: State, action: Action): boolean {
  const hand = activeHand(s);
  if (!hand || hand.done) return false;
  const two = hand.cards.length === 2;
  switch (action) {
    case 'hit':
    case 'stand':
      return true;
    case 'double':
      return two && s.chips >= hand.bet;
    case 'split':
      return two && s.hands.length === 1 && points(hand.cards[0]) === points(hand.cards[1]) && s.chips >= hand.bet;
  }
}

export function act(s: State, action: Action, rng: Rng = Math.random): State | null {
  if (!canAct(s, action)) return null;
  const n = clone(s);
  const hand = n.hands[n.active];
  const take = () => draw(n, rng);

  if (action === 'hit') {
    hand.cards.push(take());
    hand.done = handValue(hand.cards).total >= 21;
  } else if (action === 'stand') {
    hand.done = true;
  } else if (action === 'double') {
    n.chips -= hand.bet;
    hand.bet *= 2;
    hand.cards.push(take());
    hand.done = true;
  } else {
    n.chips -= hand.bet;
    const [a, b] = hand.cards;
    n.hands = [a, b].map((c) => ({ cards: [c, take()], bet: hand.bet, split: true, done: false }));
    for (const h of n.hands) h.done = isSplitAce(h) || handValue(h.cards).total === 21;
  }
  return advance(n, rng);
}

/** Moves on to the next unfinished hand, or lets the dealer play once all are done. */
function advance(n: State, rng: Rng): State {
  const next = n.hands.findIndex((h) => !h.done);
  if (next >= 0) {
    n.active = next;
    return n;
  }
  if (n.hands.some((h) => !isBust(h.cards))) {
    while (handValue(n.dealer).total < 17) n.dealer.push(draw(n, rng));
  }
  return settle(n);
}

function settle(n: State): State {
  const dealer = handValue(n.dealer).total;
  const dealerBj = isBlackjack(n.dealer);
  for (const h of n.hands) {
    const mine = handValue(h.cards).total;
    const bj = isBlackjack(h.cards, h.split);
    let outcome: Outcome;
    if (bj && !dealerBj) outcome = 'blackjack';
    else if (dealerBj && !bj) outcome = 'lose';
    else if (bj) outcome = 'push'; // both have blackjack
    else if (mine > 21) outcome = 'lose'; // a bust loses even if the dealer busts too
    else if (dealer > 21 || mine > dealer) outcome = 'win';
    else outcome = mine === dealer ? 'push' : 'lose';
    h.outcome = outcome;
    h.payout = { blackjack: h.bet * 2.5, win: h.bet * 2, push: h.bet, lose: 0 }[outcome];
    h.done = true;
    n.chips += h.payout;
  }
  n.phase = 'done';
  if (n.chips < n.bet) n.bet = [...BETS].reverse().find((b) => b <= n.chips) ?? BETS[0];
  return n;
}

/** What the dealer's face-up card counts as for strategy: 2 to 10, or 11 for an ace. */
const upValue = (s: State) => (s.dealer[0].rank === 1 ? 11 : points(s.dealer[0]));

const PLAYS: Record<Play, [Action, Action]> = {
  H: ['hit', 'hit'],
  S: ['stand', 'stand'],
  Dh: ['double', 'hit'],
  Ds: ['double', 'stand'],
  P: ['split', 'split'],
};

/**
 * Basic strategy for this shoe (see strategy.ts): the best play for the hand you're
 * playing, or the best of what's allowed when you can't double.
 */
export function hint(s: State): Action | null {
  const hand = activeHand(s);
  if (!hand || hand.done) return null;
  const { total, soft } = handValue(hand.cards);
  const pair = canAct(s, 'split') ? (hand.cards[0].rank === 1 ? 11 : points(hand.cards[0])) : undefined;
  const [best, fallback] = PLAYS[bestPlay(s.decks, total, soft, upValue(s), pair)];
  return canAct(s, best) ? best : fallback;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (c: unknown) => Array.isArray(c) && c.every(isCard);
  return (
    !!st &&
    (DECK_CHOICES as readonly number[]).includes(st.decks) &&
    cards(st.shoe) &&
    cards(st.dealer) &&
    typeof st.chips === 'number' &&
    st.chips >= 0 &&
    (BETS as readonly number[]).includes(st.bet) &&
    ['betting', 'playing', 'done'].includes(st.phase) &&
    Array.isArray(st.hands) &&
    st.hands.every((h) => cards(h?.cards) && typeof h.bet === 'number' && typeof h.done === 'boolean') &&
    Number.isInteger(st.active) &&
    (st.phase !== 'playing' || (st.dealer.length >= 2 && st.active >= 0 && st.active < st.hands.length))
  );
}

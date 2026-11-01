// Blackjack against the dealer: 6-deck shoe, dealer stands on soft 17, blackjack pays
// 3 to 2, double on any first two cards (also after a split), one split, split aces get
// one card each. Pure functions: every action returns a new State, or null if not allowed.
import { isCard, newDeck, type Card } from '../../core/cards';
import { shuffle, type Rng } from '../../core/random';

export const DECKS = 6;
export const START_CHIPS = 1000;
/** Even amounts, so a 3 to 2 blackjack always pays whole chips. */
export const BETS = [10, 20, 50, 100] as const;
/** Reshuffle before a hand once fewer than this many cards are left. */
export const RESHUFFLE_AT = Math.round(52 * DECKS * 0.25);

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

export function newShoe(rng: Rng = Math.random): Card[] {
  return shuffle(Array.from({ length: DECKS }, newDeck).flat(), rng);
}

export function newState(rng: Rng = Math.random): State {
  return { shoe: newShoe(rng), chips: START_CHIPS, bet: 20, phase: 'betting', dealer: [], hands: [], active: 0 };
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
  return { ...newState(rng), bet: s.bet };
}

export function deal(s: State, rng: Rng = Math.random): State | null {
  if (s.phase === 'playing' || s.chips < s.bet) return null;
  const n = clone(s);
  if (n.shoe.length < RESHUFFLE_AT) n.shoe = newShoe(rng);
  const draw = () => n.shoe.pop()!;
  const [p1, d1, p2, d2] = [draw(), draw(), draw(), draw()];
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

export function act(s: State, action: Action): State | null {
  if (!canAct(s, action)) return null;
  const n = clone(s);
  const hand = n.hands[n.active];
  const draw = () => n.shoe.pop()!;

  if (action === 'hit') {
    hand.cards.push(draw());
    hand.done = handValue(hand.cards).total >= 21;
  } else if (action === 'stand') {
    hand.done = true;
  } else if (action === 'double') {
    n.chips -= hand.bet;
    hand.bet *= 2;
    hand.cards.push(draw());
    hand.done = true;
  } else {
    n.chips -= hand.bet;
    const [a, b] = hand.cards;
    n.hands = [a, b].map((c) => ({ cards: [c, draw()], bet: hand.bet, split: true, done: false }));
    for (const h of n.hands) h.done = isSplitAce(h) || handValue(h.cards).total === 21;
  }
  return advance(n);
}

/** Moves on to the next unfinished hand, or lets the dealer play once all are done. */
function advance(n: State): State {
  const next = n.hands.findIndex((h) => !h.done);
  if (next >= 0) {
    n.active = next;
    return n;
  }
  if (n.hands.some((h) => !isBust(h.cards))) {
    while (handValue(n.dealer).total < 17) n.dealer.push(n.shoe.pop()!);
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

/**
 * Basic strategy for these rules (6 decks, dealer stands on soft 17, double after split,
 * no surrender). Returns the recommended action, falling back to a legal one.
 */
export function hint(s: State): Action | null {
  const hand = activeHand(s);
  if (!hand || hand.done) return null;
  const up = upValue(s);
  const { total, soft } = handValue(hand.cards);
  const can = (a: Action) => canAct(s, a);
  const between = (lo: number, hi: number) => up >= lo && up <= hi;

  if (can('split')) {
    const pair = points(hand.cards[0]) === 1 ? 11 : points(hand.cards[0]);
    const split =
      pair === 11 ||
      pair === 8 ||
      (pair === 9 && up !== 7 && up < 10) ||
      ((pair === 7 || pair === 3 || pair === 2) && up <= 7) ||
      (pair === 6 && up <= 6) ||
      (pair === 4 && between(5, 6));
    if (split) return 'split';
  }

  const doubleOr = (fallback: Action): Action => (can('double') ? 'double' : fallback);
  if (soft) {
    if (total >= 20) return 'stand';
    if (total === 19) return up === 6 ? doubleOr('stand') : 'stand';
    if (total === 18) return between(2, 6) ? doubleOr('stand') : up <= 8 ? 'stand' : 'hit';
    if (total === 17) return between(3, 6) ? doubleOr('hit') : 'hit';
    if (total >= 15) return between(4, 6) ? doubleOr('hit') : 'hit';
    return between(5, 6) ? doubleOr('hit') : 'hit';
  }
  if (total >= 17) return 'stand';
  if (total >= 13) return up <= 6 ? 'stand' : 'hit';
  if (total === 12) return between(4, 6) ? 'stand' : 'hit';
  if (total === 11) return up <= 10 ? doubleOr('hit') : 'hit';
  if (total === 10) return up <= 9 ? doubleOr('hit') : 'hit';
  if (total === 9) return between(3, 6) ? doubleOr('hit') : 'hit';
  return 'hit';
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (c: unknown) => Array.isArray(c) && c.every(isCard);
  return (
    !!st &&
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

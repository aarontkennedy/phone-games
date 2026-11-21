// Shared pieces for trick-taking games (Hearts, Spades, Euchre). Pure functions, no DOM.
import { cardName, type Card, type Suit } from './cards';

/** Seats in play order: you (South), then clockwise West, North, East. */
export type Seat = 0 | 1 | 2 | 3;
export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const SEAT_NAMES = ['You', 'West', 'North', 'East'] as const;

export interface Play {
  seat: Seat;
  card: Card;
}

export const nextSeat = (seat: Seat, steps = 1): Seat => ((seat + steps) % 4) as Seat;

/** Rank for comparing cards in a trick: aces high (2 to 14). */
export const highRank = (card: Card): number => (card.rank === 1 ? 14 : card.rank);

/** Who wins a finished trick: the highest trump if any was played, else the highest card of the suit led. */
export function trickWinner(trick: Play[], trump?: Suit): Seat {
  const led = trick[0].card.suit;
  const best = (suit: Suit) =>
    trick.filter((p) => p.card.suit === suit).sort((a, b) => highRank(b.card) - highRank(a.card))[0];
  return (trump && best(trump) ? best(trump) : best(led)).seat;
}

/** Cards you may play: you must follow the suit led if you can. */
export function followSuit(hand: Card[], trick: Play[]): Card[] {
  if (!trick.length) return hand;
  const same = hand.filter((c) => c.suit === trick[0].card.suit);
  return same.length ? same : hand;
}

/** Sorts a hand for display: grouped by suit in alternating colors, low to high. */
export function sortHand(hand: Card[]): Card[] {
  const order: Suit[] = ['C', 'D', 'S', 'H'];
  return [...hand].sort((a, b) => order.indexOf(a.suit) - order.indexOf(b.suit) || highRank(a) - highRank(b));
}

/** Deals a deck into four hands of 13. */
export function dealFour(deck: Card[]): Card[][] {
  return SEATS.map((s) => deck.slice(s * 13, s * 13 + 13));
}

/** "the ace of spades", "the 9 of hearts". */
export const theCard = (c: Card): string => `the ${cardName(c).replace(/^(Ace|Jack|Queen|King)/, (w) => w.toLowerCase())}`;

/**
 * A finished trick in words, for the recent moves list (docs/DESIGN.md, "Recent moves"):
 * "West led the king of spades; East won with the ace of spades." or "You led the ace of
 * spades and won." `extra` goes before the full stop, e.g. ", taking 2 points".
 */
export function trickText(trick: Play[], winner: Seat, extra = ''): string {
  const lead = trick[0];
  const won = trick.find((p) => p.seat === winner)!;
  const led = `${SEAT_NAMES[lead.seat]} led ${theCard(lead.card)}`;
  if (won === lead) return `${led} and won${extra}.`;
  return `${led}; ${winner === 0 ? 'you' : SEAT_NAMES[winner]} won with ${theCard(won.card)}${extra}.`;
}

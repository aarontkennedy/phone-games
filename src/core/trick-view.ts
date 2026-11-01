// The shared table for trick-taking games: a row of seats (West, North, East, You), each
// with its name, a line of game info and the card it played, then your hand below.
// Styles live in trick-table.css (docs/DESIGN.md, "Playing cards").
import { cardFace, cardSlot } from './card-view';
import { sameCard, type Card } from './cards';
import { SEAT_NAMES, sortHand, type Seat } from './tricks';
import './trick-table.css';

/** Seats shown left to right: the order cards are played after yours. */
export const SEAT_ORDER: Seat[] = [1, 2, 3, 0];

export interface SeatView {
  /** A line under the name, e.g. a score or "Bid 3, won 1". May contain markup. */
  info: string;
  /** The card this seat has played to the current trick. */
  card?: Card;
  /** Outlines the seat whose turn it is. */
  turn: boolean;
}

export function seatsHtml(view: (seat: Seat) => SeatView): string {
  const seats = SEAT_ORDER.map((seat) => {
    const { info, card, turn } = view(seat);
    return `<div class="tt-seat${turn ? ' turn' : ''}" data-seat="${seat}">
      <span class="tt-name">${SEAT_NAMES[seat]}</span>
      <span class="tt-info">${info}</span>
      <div class="tt-play">${card ? cardFace(card) : cardSlot()}</div>
    </div>`;
  });
  return `<div class="tt-seats">${seats.join('')}</div>`;
}

export interface HandView {
  /** Cards you can tap now: a list, or 'all' (e.g. while choosing cards to pass). */
  playable: Card[] | 'all';
  /** Cards picked (e.g. to pass): outlined and lifted. */
  picked?: Card[];
  /** Cards just passed to you: a dashed outline. */
  received?: Card[];
  /** Extra classes for some cards, e.g. { loose: [...] }. */
  marked?: Record<string, Card[]>;
  /** Keep the hand in the order given instead of sorting by suit. */
  keepOrder?: boolean;
}

/** Cards per row: 7, or more for a long hand (Crazy Eights) so it stays in two rows up to 20 cards. */
export const handColumns = (cards: number): number => Math.min(10, Math.max(7, Math.ceil(cards / 2)));

/** Your hand, sorted. Playable cards lift when some aren't; the rest are disabled, never dimmed. */
export function handHtml(hand: Card[], { playable, picked = [], received = [], marked = {}, keepOrder = false }: HandView): string {
  const columns = handColumns(hand.length);
  const has = (list: Card[], c: Card) => list.some((x) => sameCard(x, c));
  const someIllegal = playable !== 'all' && playable.length < hand.length;
  const cards = (keepOrder ? hand : sortHand(hand)).map((c, i) => {
    const canPlay = playable === 'all' || has(playable, c);
    const className = [
      has(picked, c) ? 'picked' : '',
      has(picked, c) || (canPlay && someIllegal) ? 'lift' : '',
      has(received, c) ? 'received' : '',
      i >= columns ? 'next-row' : '',
      ...Object.entries(marked).flatMap(([name, list]) => (has(list, c) ? [name] : [])),
    ]
      .filter(Boolean)
      .join(' ');
    return cardFace(c, { button: true, className, attrs: `data-hand${canPlay ? '' : ' disabled'}` });
  });
  const style = columns === 7 ? '' : ` style="--hand-cols:${columns}"`;
  return `<div class="tt-hand" aria-label="Your cards"${style}>${cards.join('')}</div>`;
}

// Flat card faces and backs, shared by every card game (docs/DESIGN.md, "Flat design").
// Suits are our own simple SVG shapes. Styles live in cards.css.
import { cardId, cardName, isRed, rankLabel, type Card, type Suit } from './cards';
import './cards.css';

const SUIT_PATHS: Record<Suit, string> = {
  S: 'M12 2C17 7 22 10.5 22 14.5a4.5 4.5 0 0 1-8.2 2.6L15 22H9l1.2-4.9A4.5 4.5 0 0 1 2 14.5C2 10.5 7 7 12 2Z',
  H: 'M12 21C6 16 2 12.5 2 8.2A5 5 0 0 1 12 6a5 5 0 0 1 10 2.2C22 12.5 18 16 12 21Z',
  D: 'M12 2 20.5 12 12 22 3.5 12Z',
  C: 'M12 2.5a4.6 4.6 0 0 1 4.1 6.7A4.6 4.6 0 1 1 13.5 17L15 22H9l1.5-5a4.6 4.6 0 1 1-2.6-7.8A4.6 4.6 0 0 1 12 2.5Z',
};

/** A suit shape colored by the surrounding text color. */
export const suitSvg = (suit: Suit): string =>
  `<svg class="suit" viewBox="0 0 24 24" aria-hidden="true"><path d="${SUIT_PATHS[suit]}"/></svg>`;

export interface CardOptions {
  /** Render as a button the player can tap. Defaults to a plain element. */
  button?: boolean;
  /** Extra attributes, e.g. `data-col="2"`. */
  attrs?: string;
  /** Spoken label, for backs and slots that do something when tapped. */
  label?: string;
}

/** A face-up card: rank and suit in the corner, a large suit in the middle. */
export function cardFace(card: Card, { button = false, attrs = '' }: CardOptions = {}): string {
  const tag = button ? 'button' : 'div';
  const role = button ? '' : ' role="img"';
  return `<${tag} class="card${isRed(card) ? ' red' : ''}" data-card="${cardId(card)}" aria-label="${cardName(card)}"${role} ${attrs}>
    <span class="card-corner"><span class="card-rank">${rankLabel(card)}</span>${suitSvg(card.suit)}</span>
    <span class="card-pip">${suitSvg(card.suit)}</span>
  </${tag}>`;
}

/** A face-down card. */
export function cardBack({ button = false, attrs = '', label = 'Face-down card' }: CardOptions = {}): string {
  const tag = button ? 'button' : 'div';
  const role = button ? '' : ' role="img"';
  return `<${tag} class="card back" aria-label="${label}"${role} ${attrs}></${tag}>`;
}

/** An empty place where a pile goes. `content` can show what belongs there, e.g. a suit. */
export function cardSlot({ button = false, attrs = '', label = '' }: CardOptions = {}, content = ''): string {
  const tag = button ? 'button' : 'div';
  const aria = label ? ` aria-label="${label}"${button ? '' : ' role="img"'}` : ' aria-hidden="true"';
  return `<${tag} class="card-slot"${aria} ${attrs}>${content}</${tag}>`;
}

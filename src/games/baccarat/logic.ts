// Baccarat (punto banco), from a six-deck shoe. Bet on the Player hand, the Banker hand, or
// a Tie; the cards play themselves by fixed rules. Cards count their number, aces 1, and
// tens and court cards 0; a hand counts only its last digit (7 + 8 = 15 counts 5). Each hand
// gets two cards. An 8 or 9 is a natural and both stand. Otherwise the Player draws a third
// card on 0 to 5, and the Banker draws by its total and the Player's third card (the
// table below). Closer to 9 wins. Player pays 1 to 1, Banker 19 to 20 (a 5% commission),
// Tie 8 to 1; on a tie, Player and Banker bets come back.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { isCard, newDeck, type Card } from '../../core/cards';
import { shuffle, type Rng } from '../../core/random';

export const START_CHIPS = 1000;
/** Every chip is a multiple of 20, so a Banker win's 5% commission is always whole chips. */
export const CHIPS = [20, 100, 200] as const;
export const DECKS = 6;
/** The shoe is shuffled afresh when fewer cards than this are left. */
export const CUT = 52;

export type Spot = 'player' | 'banker' | 'tie';
export const SPOTS: readonly Spot[] = ['player', 'banker', 'tie'];
export type Bets = Record<Spot, number>;

export interface State {
  /** Chips in front of you. Bets come out of them when you deal. */
  chips: number;
  chip: number;
  /** What you'll bet on the next hand. They stay down from hand to hand until you clear them. */
  bets: Bets;
  /** Cards left to deal; the last is dealt next. */
  shoe: Card[];
  player: Card[];
  banker: Card[];
  /** The last hand's winner, or null before the first. */
  winner: Spot | null;
  /** What the last hand paid back (stakes included), and what was bet on it. */
  paid: number;
  staked: number;
}

const noBets = (): Bets => ({ player: 0, banker: 0, tie: 0 });
export const total = (b: Bets): number => b.player + b.banker + b.tie;
export const freshShoe = (rng: Rng = Math.random): Card[] => shuffle(Array.from({ length: DECKS }, newDeck).flat(), rng);

export function newState(rng: Rng = Math.random): State {
  return { chips: START_CHIPS, chip: CHIPS[0], bets: noBets(), shoe: freshShoe(rng), player: [], banker: [], winner: null, paid: 0, staked: 0 };
}

/** A card's count: aces 1, 2 to 9 their number, tens and court cards 0. */
export const points = (c: Card): number => (c.rank >= 10 ? 0 : c.rank);
/** A hand's count: the last digit of its total. */
export const handTotal = (cards: Card[]): number => cards.reduce((t, c) => t + points(c), 0) % 10;

export function setChip(s: State, chip: number): State | null {
  return (CHIPS as readonly number[]).includes(chip) ? { ...s, chip } : null;
}

/** Adds a chip to a bet, if your chips cover everything you've bet. */
export function place(s: State, spot: Spot): State | null {
  if (!SPOTS.includes(spot) || total(s.bets) + s.chip > s.chips) return null;
  return { ...s, bets: { ...s.bets, [spot]: s.bets[spot] + s.chip } };
}

export function clear(s: State): State | null {
  return total(s.bets) ? { ...s, bets: noBets() } : null;
}

/** Whether the Banker draws a third card, given its total and the Player's third card (if any). */
export function bankerDraws(banker: number, playerThird: Card | null): boolean {
  if (!playerThird) return banker <= 5;
  const p = points(playerThird);
  if (banker <= 2) return true;
  if (banker === 3) return p !== 8;
  if (banker === 4) return p >= 2 && p <= 7;
  if (banker === 5) return p >= 4 && p <= 7;
  if (banker === 6) return p === 6 || p === 7;
  return false;
}

/** Plays out a hand from the shoe by the drawing rules. */
export function playHand(shoe: Card[]): { player: Card[]; banker: Card[]; shoe: Card[] } {
  const left = shoe.slice();
  const draw = () => left.pop()!;
  const player = [draw()];
  const banker = [draw()];
  player.push(draw());
  banker.push(draw());
  const natural = handTotal(player) >= 8 || handTotal(banker) >= 8;
  if (!natural) {
    const third = handTotal(player) <= 5 ? draw() : null;
    if (third) player.push(third);
    if (bankerDraws(handTotal(banker), third)) banker.push(draw());
  }
  return { player, banker, shoe: left };
}

export function winnerOf(player: Card[], banker: Card[]): Spot {
  const p = handTotal(player);
  const b = handTotal(banker);
  return p > b ? 'player' : b > p ? 'banker' : 'tie';
}

/** What bets pay back (stakes included) when `winner` wins. */
export function payout(bets: Bets, winner: Spot): number {
  if (winner === 'tie') return bets.tie * 9 + bets.player + bets.banker;
  if (winner === 'player') return bets.player * 2;
  return bets.banker * 2 - bets.banker / 20; // 19 to 20: a 5% commission on the win
}

/** Deals a hand: your bets come out of your chips, and winners are paid. */
export function deal(s: State, rng: Rng = Math.random): State | null {
  const staked = total(s.bets);
  if (!staked || staked > s.chips) return null;
  const shoe = s.shoe.length < CUT ? freshShoe(rng) : s.shoe;
  const hand = playHand(shoe);
  const winner = winnerOf(hand.player, hand.banker);
  const paid = payout(s.bets, winner);
  const chips = s.chips - staked + paid;
  // Bets stay down for the next hand, unless your chips no longer cover them.
  const bets = total(s.bets) <= chips ? s.bets : noBets();
  return { ...s, chips, bets, shoe: hand.shoe, player: hand.player, banker: hand.banker, winner, paid, staked };
}

export const isBroke = (s: State): boolean => s.chips < CHIPS[0];
export const restart = (s: State, rng: Rng = Math.random): State => ({ ...newState(rng), chip: s.chip });

// --- Hint: the best bet, by how much of each the house keeps ---

/**
 * How much of each bet the house keeps on average, from six decks: Banker 1.06% (after
 * its commission), Player 1.24%, Tie 14.4%. Worked out exactly in the tests.
 */
export const HOUSE_EDGE: Record<Spot, number> = { banker: 0.0106, player: 0.0124, tie: 0.1444 };

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const count = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  return (
    !!st &&
    count(st.chips) &&
    (CHIPS as readonly number[]).includes(st.chip) &&
    !!st.bets &&
    SPOTS.every((x) => count(st.bets[x]) && st.bets[x] % 20 === 0) &&
    cards(st.shoe) &&
    st.shoe.length <= DECKS * 52 &&
    cards(st.player) &&
    cards(st.banker) &&
    (st.winner === null || SPOTS.includes(st.winner)) &&
    count(st.paid) &&
    count(st.staked)
  );
}

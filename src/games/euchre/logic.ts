// Euchre for four in two teams: you and North against West and East. 24 cards (9 to ace),
// 5 each, one turned up. Round one: order the dealer to pick up the turned card, making
// its suit trump. Round two: name another suit. The dealer must choose if everyone
// passes (stick the dealer). The maker may go alone. The jack of trump (right bower) is
// highest, then the other jack of the same color (left bower, which counts as trump), then
// A K Q 10 9. Makers score 1 for 3-4 tricks, 2 for all 5, 4 for all 5 alone; held under
// 3 they're euchred and the defenders score 2. First team to 10 wins.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { SUITS, isCard, newDeck, sameCard, type Card, type Suit } from '../../core/cards';
import { randomInt, shuffle, type Rng } from '../../core/random';
import { SEATS, nextSeat, type Play, type Seat } from '../../core/tricks';

export type Level = 'easy' | 'strong';
export type Phase = 'bidding1' | 'bidding2' | 'discard' | 'playing' | 'handOver' | 'gameOver';
export type Team = 0 | 1;

export const GAME_POINTS = 10;

export interface HandResult {
  /** The team that scored, and how much. */
  team: Team;
  points: number;
  /** Tricks the makers took. */
  makerTricks: number;
  euchred: boolean;
}

export interface State {
  level: Level;
  phase: Phase;
  dealer: Seat;
  hands: Card[][];
  /** The undealt cards (plus the dealer's discard). */
  kitty: Card[];
  /** The card turned up for bidding. It stays the same after the dealer picks it up. */
  turned: Card;
  turn: Seat;
  trump: Suit | null;
  maker: Seat | null;
  alone: boolean;
  trick: Play[];
  tricks: number[];
  scores: [number, number];
  last: HandResult | null;
  /** Every card played this hand. Strong players remember them. */
  played: Card[];
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
const high = (c: Card) => (c.rank === 1 ? 14 : c.rank);

/** The 24 cards used: 9, 10, jack, queen, king and ace of each suit. */
export const euchreDeck = (): Card[] => newDeck().filter((c) => c.rank === 1 || c.rank >= 9);
export const teamOf = (seat: Seat): Team => (seat % 2) as Team;
export const partnerOf = (seat: Seat): Seat => nextSeat(seat, 2);
export const upcard = (s: State): Card => s.turned;

const SAME_COLOR: Record<Suit, Suit> = { S: 'C', C: 'S', H: 'D', D: 'H' };
export const isRightBower = (c: Card, trump: Suit) => c.rank === 11 && c.suit === trump;
export const isLeftBower = (c: Card, trump: Suit) => c.rank === 11 && c.suit === SAME_COLOR[trump];

/** The suit a card plays as: the left bower belongs to trump. */
export const suitOf = (c: Card, trump: Suit | null): Suit => (trump && isLeftBower(c, trump) ? trump : c.suit);

/** Strength in a trick: trump beats everything, bowers top trump, aces high otherwise. */
export function power(c: Card, trump: Suit, led: Suit): number {
  if (isRightBower(c, trump)) return 200;
  if (isLeftBower(c, trump)) return 199;
  if (c.suit === trump) return 100 + high(c);
  return suitOf(c, trump) === led ? high(c) : 0;
}

/** Seat that sits out when the maker goes alone. */
export const sittingOut = (s: State): Seat | null => (s.alone && s.maker !== null ? partnerOf(s.maker) : null);

/** The next seat to act, skipping a partner who sits out. */
function after(s: State, seat: Seat): Seat {
  const next = nextSeat(seat);
  return next === sittingOut(s) ? nextSeat(next) : next;
}

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  return deal({ level, dealer: 3, scores: [0, 0], last: null }, rng);
}

function deal(base: Pick<State, 'level' | 'dealer' | 'scores' | 'last'>, rng: Rng): State {
  const deck = shuffle(euchreDeck(), rng);
  return {
    ...base,
    phase: 'bidding1',
    hands: SEATS.map((s) => deck.slice(s * 5, s * 5 + 5)),
    kitty: deck.slice(20),
    turned: deck[20],
    turn: nextSeat(base.dealer),
    trump: null,
    maker: null,
    alone: false,
    trick: [],
    tricks: [0, 0, 0, 0],
    played: [],
  };
}

export function pass(s: State, seat: Seat): State | null {
  if (s.turn !== seat || (s.phase !== 'bidding1' && s.phase !== 'bidding2')) return null;
  if (s.phase === 'bidding2' && seat === s.dealer) return null; // stick the dealer
  const n = clone(s);
  if (seat === s.dealer) n.phase = 'bidding2';
  n.turn = nextSeat(seat);
  return n;
}

/** Round one: makes the turned card's suit trump; the dealer picks it up. */
export function orderUp(s: State, seat: Seat, alone = false): State | null {
  if (s.phase !== 'bidding1' || s.turn !== seat) return null;
  const n = choose(clone(s), seat, upcard(s).suit, alone);
  if (sittingOut(n) === n.dealer) return startPlay(n); // the dealer sits out and doesn't pick up
  n.hands[n.dealer].push(n.kitty.shift()!); // the turned card is the first in the kitty
  n.phase = 'discard';
  n.turn = n.dealer;
  return n;
}

/** Round two: names any suit except the one turned down. */
export function callTrump(s: State, seat: Seat, suit: Suit, alone = false): State | null {
  if (s.phase !== 'bidding2' || s.turn !== seat || suit === upcard(s).suit) return null;
  return startPlay(choose(clone(s), seat, suit, alone));
}

function choose(n: State, seat: Seat, suit: Suit, alone: boolean): State {
  n.trump = suit;
  n.maker = seat;
  n.alone = alone;
  return n;
}

/** The dealer, after picking up, puts one card back. */
export function discard(s: State, card: Card): State | null {
  const hand = s.hands[s.dealer];
  const i = hand.findIndex((c) => sameCard(c, card));
  if (s.phase !== 'discard' || i < 0) return null;
  const n = clone(s);
  n.kitty.push(n.hands[n.dealer].splice(i, 1)[0]);
  return startPlay(n);
}

function startPlay(n: State): State {
  n.phase = 'playing';
  n.turn = after(n, n.dealer);
  return n;
}

export const playersIn = (s: State): number => (s.alone ? 3 : 4);

export function legalPlays(s: State, seat: Seat): Card[] {
  if (s.phase !== 'playing' || s.trick.length === playersIn(s) || seat === sittingOut(s)) return [];
  const hand = s.hands[seat];
  if (!s.trick.length) return hand;
  const led = suitOf(s.trick[0].card, s.trump);
  const same = hand.filter((c) => suitOf(c, s.trump) === led);
  return same.length ? same : hand;
}

export function trickWinner(trick: Play[], trump: Suit): Seat {
  const led = suitOf(trick[0].card, trump);
  return trick.reduce((best, p) => (power(p.card, trump, led) > power(best.card, trump, led) ? p : best)).seat;
}

export function play(s: State, seat: Seat, card: Card): State | null {
  if (s.turn !== seat || !legalPlays(s, seat).some((c) => sameCard(c, card))) return null;
  const n = clone(s);
  n.hands[seat].splice(n.hands[seat].findIndex((c) => sameCard(c, card)), 1);
  n.trick.push({ seat, card });
  n.played.push(card);
  if (n.trick.length < playersIn(n)) n.turn = after(n, seat);
  return n;
}

export function collect(s: State): State | null {
  if (s.phase !== 'playing' || s.trick.length !== playersIn(s)) return null;
  const n = clone(s);
  const winner = trickWinner(n.trick, n.trump!);
  n.tricks[winner]++;
  n.trick = [];
  n.turn = winner;
  return n.tricks.reduce((a, b) => a + b, 0) === 5 ? endHand(n) : n;
}

function endHand(n: State): State {
  const makers = teamOf(n.maker!);
  const makerTricks = n.tricks.filter((_, seat) => teamOf(seat as Seat) === makers).reduce((a, b) => a + b, 0);
  const euchred = makerTricks < 3;
  const team: Team = euchred ? ((1 - makers) as Team) : makers;
  const points = euchred ? 2 : makerTricks < 5 ? 1 : n.alone ? 4 : 2;
  n.scores[team] += points;
  n.last = { team, points, makerTricks, euchred };
  n.phase = n.scores[team] >= GAME_POINTS ? 'gameOver' : 'handOver';
  return n;
}

export function nextHand(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'handOver') return null;
  return deal({ level: s.level, dealer: nextSeat(s.dealer), scores: s.scores, last: s.last }, rng);
}

export const winner = (s: State): Team | null => (s.phase === 'gameOver' ? (s.scores[0] >= GAME_POINTS ? 0 : 1) : null);

// --- Computer players ---

/** How good a hand is with `trump` as trump: about 2.5 points per likely trick. */
export function handStrength(hand: Card[], trump: Suit): number {
  let total = 0;
  for (const c of hand) {
    if (isRightBower(c, trump)) total += 3;
    else if (isLeftBower(c, trump)) total += 2.5;
    else if (c.suit === trump) total += { 1: 2, 13: 1.5, 12: 1.2, 10: 1, 9: 0.8 }[c.rank as 1 | 13 | 12 | 10 | 9];
    else if (c.rank === 1) total += 1;
  }
  const trumps = hand.filter((c) => suitOf(c, trump) === trump).length;
  if (trumps >= 2) {
    for (const suit of SUITS) if (suit !== trump && !hand.some((c) => suitOf(c, trump) === suit)) total += 0.5;
  }
  return total;
}

/** A Strong player's view of ordering up: the dealer gains the turned card, helping their team. */
function orderStrength(s: State, seat: Seat): number {
  const up = upcard(s);
  const mine = handStrength(s.hands[seat], up.suit);
  const gift = handStrength([up], up.suit);
  if (seat === s.dealer) return handStrength([...s.hands[seat], up], up.suit) - 0.8; // must discard one
  return teamOf(s.dealer) === teamOf(seat) ? mine + gift * 0.7 : mine - gift * 0.7;
}

const CALL = 7;
const ALONE = 10.5; // about five sure tricks

export type Bid = { action: 'pass' } | { action: 'order'; alone: boolean } | { action: 'call'; suit: Suit; alone: boolean };

/** Easy calls loosely and never alone. Strong weighs its hand, the turned card and who's dealing. */
export function chooseBid(s: State, seat: Seat, rng: Rng = Math.random): Bid {
  const easy = s.level === 'easy';
  const threshold = easy ? CALL - 2 + randomInt(4, rng) : CALL;
  if (s.phase === 'bidding1') {
    const strength = orderStrength(s, seat);
    if (strength < threshold) return { action: 'pass' };
    return { action: 'order', alone: !easy && strength >= ALONE };
  }
  const options = SUITS.filter((suit) => suit !== upcard(s).suit);
  const [suit, strength] = options
    .map((x) => [x, handStrength(s.hands[seat], x)] as const)
    .reduce((a, b) => (b[1] > a[1] ? b : a));
  if (strength < threshold && seat !== s.dealer) return { action: 'pass' };
  return { action: 'call', suit, alone: !easy && strength >= ALONE };
}

/** Applies a computer player's bid. */
export function applyBid(s: State, seat: Seat, b: Bid): State | null {
  if (b.action === 'pass') return pass(s, seat);
  if (b.action === 'order') return orderUp(s, seat, b.alone);
  return callTrump(s, seat, b.suit, b.alone);
}

/** Weakest first: by strength in this trick, then by rank. */
const byPower = (cards: Card[], trump: Suit, led: Suit) =>
  [...cards].sort((a, b) => power(a, trump, led) - power(b, trump, led) || high(a) - high(b));

/** The dealer's discard: the weakest card, keeping trump and aces, emptying a short suit if it can. */
export function chooseDiscard(s: State): Card {
  const trump = s.trump!;
  const hand = s.hands[s.dealer];
  const side = hand.filter((c) => suitOf(c, trump) !== trump && c.rank !== 1);
  const pool = side.length ? side : hand;
  const count = (suit: Suit) => hand.filter((c) => suitOf(c, trump) === suit).length;
  return [...pool].sort(
    (a, b) => count(a.suit) - count(b.suit) || power(a, trump, a.suit) - power(b, trump, b.suit),
  )[0];
}

/** Easy plays any legal card. Strong pulls trump with the bowers, cashes aces, and doesn't overtake its partner. */
export function chooseCard(s: State, seat: Seat, rng: Rng = Math.random): Card {
  const legal = legalPlays(s, seat);
  if (s.level === 'easy' || legal.length === 1) return legal[randomInt(legal.length, rng)];
  const trump = s.trump!;
  const makers = teamOf(s.maker!) === teamOf(seat);

  if (!s.trick.length) {
    const right = legal.find((c) => isRightBower(c, trump));
    if (makers && right) return right;
    const aces = legal.filter((c) => c.rank === 1 && suitOf(c, trump) !== trump);
    if (aces.length) return aces[0];
    const side = legal.filter((c) => suitOf(c, trump) !== trump);
    return side.length ? [...side].sort((a, b) => high(a) - high(b))[0] : byPower(legal, trump, trump)[0];
  }

  const led = suitOf(s.trick[0].card, trump);
  const best = s.trick.reduce((a, p) => (power(p.card, trump, led) > power(a.card, trump, led) ? p : a));
  const top = power(best.card, trump, led);
  const winners = byPower(legal.filter((c) => power(c, trump, led) > top), trump, led);
  const lowest = byPower(legal, trump, led)[0];
  const last = s.trick.length === playersIn(s) - 1;
  const partnerWinning = best.seat === partnerOf(seat);

  if (partnerWinning && (last || top >= 114)) return lowest; // partner has it: an ace or trump
  if (winners.length) return winners[0]; // win as cheaply as possible
  return lowest;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const four = (a: unknown) => Array.isArray(a) && a.length === 4;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    ['bidding1', 'bidding2', 'discard', 'playing', 'handOver', 'gameOver'].includes(st.phase) &&
    SEATS.includes(st.dealer) &&
    SEATS.includes(st.turn) &&
    four(st.hands) &&
    st.hands.every(cards) &&
    cards(st.kitty) &&
    isCard(st.turned) &&
    (st.trump === null || SUITS.includes(st.trump)) &&
    (st.maker === null || SEATS.includes(st.maker)) &&
    typeof st.alone === 'boolean' &&
    Array.isArray(st.trick) &&
    st.trick.every((p) => SEATS.includes(p?.seat) && isCard(p.card)) &&
    four(st.tricks) &&
    Array.isArray(st.scores) &&
    st.scores.length === 2 &&
    cards(st.played) &&
    [...st.hands.flat(), ...st.kitty, ...st.played].every((c) => c.rank === 1 || c.rank >= 9) &&
    new Set([...st.hands.flat(), ...st.kitty, ...st.played].map((c) => `${c.rank}${c.suit}`)).size === 24 &&
    [...st.hands.flat(), ...st.kitty, ...st.played].length === 24
  );
}

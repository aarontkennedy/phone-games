// Crazy eights for four: you and three computer players. Match the top card of the
// discard pile by suit or rank; 8s are wild and name the next suit. If you can't play,
// draw until you can (pass only when no cards are left to draw). The first to empty
// their hand wins the round and scores the cards left in the others' hands: 8s 50,
// court cards 10, aces 1, others their number. First to 100 wins.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { SUITS, isCard, isFullDeck, sameCard, shuffledDeck, type Card, type Suit } from '../../core/cards';
import { randomInt, shuffle, type Rng } from '../../core/random';
import { SEATS, nextSeat, type Seat } from '../../core/tricks';

export type Level = 'easy' | 'strong';
export type Phase = 'playing' | 'roundOver' | 'gameOver';

export const HAND_SIZE = 5;
export const GAME_POINTS = 100;

export interface State {
  level: Level;
  phase: Phase;
  dealer: Seat;
  hands: Card[][];
  stock: Card[];
  /** The last card is on top. */
  discard: Card[];
  /** The suit to follow: the top card's, or the one named with an 8. */
  suit: Suit;
  turn: Seat;
  /** The card each seat played most recently, for the table. */
  lastPlay: (Card | null)[];
  scores: number[];
  /** Who won the last round, and the points they scored. */
  last: { seat: Seat; points: number } | null;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
export const cardPoints = (c: Card): number => (c.rank === 8 ? 50 : c.rank > 10 ? 10 : c.rank);
const top = (s: State) => s.discard.at(-1)!;

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  return deal({ level, dealer: 3, scores: [0, 0, 0, 0], last: null }, rng);
}

function deal(base: Pick<State, 'level' | 'dealer' | 'scores' | 'last'>, rng: Rng): State {
  const deck = shuffledDeck(rng);
  const hands = SEATS.map((s) => deck.slice(s * HAND_SIZE, (s + 1) * HAND_SIZE));
  const stock = deck.slice(4 * HAND_SIZE);
  // The first card turned up can't be an 8: bury any 8s.
  const first = stock.splice(stock.findIndex((c) => c.rank !== 8), 1)[0];
  return {
    ...base,
    phase: 'playing',
    hands,
    stock,
    discard: [first],
    suit: first.suit,
    turn: nextSeat(base.dealer),
    lastPlay: [null, null, null, null],
  };
}

export const canPlay = (s: State, c: Card): boolean => c.rank === 8 || c.suit === s.suit || c.rank === top(s).rank;
export const playable = (s: State, seat: Seat): Card[] => (s.phase === 'playing' && s.turn === seat ? s.hands[seat].filter((c) => canPlay(s, c)) : []);

/** Cards left to draw, counting the discards that would be shuffled back in. */
const drawable = (s: State) => s.stock.length + s.discard.length - 1;

/** Plays a card. An 8 needs the suit it names. */
export function play(s: State, seat: Seat, card: Card, named?: Suit): State | null {
  if (!playable(s, seat).some((c) => sameCard(c, card)) || (card.rank === 8 && !named)) return null;
  const n = clone(s);
  n.hands[seat] = n.hands[seat].filter((c) => !sameCard(c, card));
  n.discard.push(card);
  n.suit = card.rank === 8 ? named! : card.suit;
  n.lastPlay[seat] = card;
  if (!n.hands[seat].length) return endRound(n, seat);
  n.turn = nextSeat(seat);
  return n;
}

/** Draws one card, shuffling the discards back in if the stock is empty. Only when you can't play. */
export function draw(s: State, seat: Seat, rng: Rng = Math.random): State | null {
  if (s.phase !== 'playing' || s.turn !== seat || playable(s, seat).length || !drawable(s)) return null;
  const n = clone(s);
  if (!n.stock.length) n.stock = shuffle(n.discard.splice(0, n.discard.length - 1), rng);
  n.hands[seat].push(n.stock.pop()!);
  return n;
}

/** Passes, only when you can't play and there's nothing left to draw. */
export function pass(s: State, seat: Seat): State | null {
  if (s.phase !== 'playing' || s.turn !== seat || playable(s, seat).length || drawable(s)) return null;
  return { ...clone(s), turn: nextSeat(seat) };
}

function endRound(n: State, winner: Seat): State {
  const points = n.hands.reduce((sum, h) => sum + h.reduce((t, c) => t + cardPoints(c), 0), 0);
  n.scores[winner] += points;
  n.last = { seat: winner, points };
  n.phase = n.scores[winner] >= GAME_POINTS ? 'gameOver' : 'roundOver';
  return n;
}

export function nextRound(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'roundOver') return null;
  return deal({ level: s.level, dealer: nextSeat(s.dealer), scores: s.scores, last: s.last }, rng);
}

export const winner = (s: State): Seat | null => (s.phase === 'gameOver' ? s.last!.seat : null);

// --- Computer players ---

/** The suit this hand holds most of (not counting 8s). */
export function bestSuit(hand: Card[]): Suit {
  const count = (x: Suit) => hand.filter((c) => c.suit === x && c.rank !== 8).length;
  return [...SUITS].sort((a, b) => count(b) - count(a))[0];
}

export type Turn = { action: 'play'; card: Card; suit?: Suit } | { action: 'draw' } | { action: 'pass' };

/**
 * Easy plays any card it can and names a random suit. Strong keeps its 8s for when it
 * needs them, sheds high cards, and names its strongest suit.
 */
export function chooseTurn(s: State, seat: Seat, rng: Rng = Math.random): Turn {
  const options = playable(s, seat);
  if (!options.length) return drawable(s) ? { action: 'draw' } : { action: 'pass' };
  const hand = s.hands[seat];
  if (s.level === 'easy') {
    const card = options[randomInt(options.length, rng)];
    return { action: 'play', card, suit: card.rank === 8 ? SUITS[randomInt(4, rng)] : undefined };
  }
  const plain = options.filter((c) => c.rank !== 8);
  const threat = SEATS.some((x) => x !== seat && s.hands[x].length <= 1);
  if (plain.length && !(threat && plain.length < options.length && hand.length <= 2)) {
    // Prefer a card in a suit we hold more of, then the higher-scoring card.
    const count = (x: Suit) => hand.filter((c) => c.suit === x).length;
    const card = [...plain].sort((a, b) => count(b.suit) - count(a.suit) || cardPoints(b) - cardPoints(a))[0];
    return { action: 'play', card };
  }
  const eight = options.find((c) => c.rank === 8)!;
  return { action: 'play', card: eight, suit: bestSuit(hand.filter((c) => !sameCard(c, eight))) };
}

export function applyTurn(s: State, seat: Seat, t: Turn, rng: Rng = Math.random): State | null {
  if (t.action === 'play') return play(s, seat, t.card, t.suit);
  return t.action === 'draw' ? draw(s, seat, rng) : pass(s, seat);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    ['playing', 'roundOver', 'gameOver'].includes(st.phase) &&
    SEATS.includes(st.dealer) &&
    SEATS.includes(st.turn) &&
    SUITS.includes(st.suit) &&
    Array.isArray(st.hands) &&
    st.hands.length === 4 &&
    st.hands.every(cards) &&
    cards(st.stock) &&
    cards(st.discard) &&
    st.discard.length > 0 &&
    Array.isArray(st.lastPlay) &&
    st.lastPlay.length === 4 &&
    Array.isArray(st.scores) &&
    st.scores.length === 4 &&
    isFullDeck([...st.hands.flat(), ...st.stock, ...st.discard])
  );
}

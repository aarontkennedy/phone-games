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
  /**
   * Suits each seat is known to lack: everyone sees a player draw when they can't follow.
   * Forgotten once they play that suit. Optional, so games saved before it still load.
   */
  voids?: Suit[][];
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
    voids: [[], [], [], []],
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
  if (card.rank !== 8 && n.voids) n.voids[seat] = n.voids[seat].filter((x) => x !== card.suit);
  if (!n.hands[seat].length) return endRound(n, seat);
  n.turn = nextSeat(seat);
  return n;
}

/** Draws one card, shuffling the discards back in if the stock is empty. Only when you can't play. */
export function draw(s: State, seat: Seat, rng: Rng = Math.random): State | null {
  if (s.phase !== 'playing' || s.turn !== seat || playable(s, seat).length || !drawable(s)) return null;
  const n = clone(s);
  noteVoid(n, seat);
  if (!n.stock.length) n.stock = shuffle(n.discard.splice(0, n.discard.length - 1), rng);
  n.hands[seat].push(n.stock.pop()!);
  return n;
}

/** Passes, only when you can't play and there's nothing left to draw. */
export function pass(s: State, seat: Seat): State | null {
  if (s.phase !== 'playing' || s.turn !== seat || playable(s, seat).length || drawable(s)) return null;
  const n = clone(s);
  noteVoid(n, seat);
  return { ...n, turn: nextSeat(seat) };
}

/** A player who can't follow has none of the suit to play. */
function noteVoid(n: State, seat: Seat) {
  n.voids ??= [[], [], [], []];
  if (!n.voids[seat].includes(n.suit)) n.voids[seat].push(n.suit);
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

export type Turn = { action: 'play'; card: Card; suit?: Suit } | { action: 'draw' } | { action: 'pass' };

/**
 * Easy plays any card it can and names a random suit. Strong keeps its options open: it
 * plays the card that leaves it the most cards able to follow, sheds high cards, and
 * switches to a suit the next player is known to lack (or that someone about to go out
 * lacks). It keeps its 8s until it has no other play, or one clearly helps.
 */
export function chooseTurn(s: State, seat: Seat, rng: Rng = Math.random): Turn {
  const options = playable(s, seat);
  if (!options.length) return drawable(s) ? { action: 'draw' } : { action: 'pass' };
  if (s.level === 'easy') {
    const card = options[randomInt(options.length, rng)];
    return { action: 'play', card, suit: card.rank === 8 ? SUITS[randomInt(4, rng)] : undefined };
  }
  const hand = s.hands[seat];
  const voids = s.voids ?? [[], [], [], []];
  const next = nextSeat(seat);
  // Someone with one card left goes out on their turn unless they can't follow.
  const threat = SEATS.filter((x) => x !== seat && s.hands[x].length === 1);
  /** How good it is to leave `suit` (and `rank`) on top, with `rest` still in hand. */
  const worth = (suit: Suit, rank: number, rest: Card[]) =>
    rest.filter((c) => c.rank === 8 || c.suit === suit || c.rank === rank).length * 10 +
    (voids[next].includes(suit) ? 12 : 0) +
    threat.filter((x) => voids[x].includes(suit)).length * 40;
  let best: Turn | null = null;
  let bestScore = -Infinity;
  for (const card of options.filter((c) => c.rank !== 8)) {
    const score = worth(card.suit, card.rank, hand.filter((c) => !sameCard(c, card))) + cardPoints(card) / 2;
    if (score > bestScore) [best, bestScore] = [{ action: 'play', card }, score];
  }
  const eight = options.find((c) => c.rank === 8);
  if (eight) {
    const rest = hand.filter((c) => !sameCard(c, eight));
    const suit = [...SUITS].sort((a, b) => worth(b, 0, rest) - worth(a, 0, rest))[0];
    // An 8 is worth keeping: spend it only if it beats the best plain play by a margin,
    // a smaller one when someone is about to go out.
    if (!best || worth(suit, 0, rest) - (threat.length ? 10 : 45) > bestScore) best = { action: 'play', card: eight, suit };
  }
  return best!;
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

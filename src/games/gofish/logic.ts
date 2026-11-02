// Go fish for four: you and three computer players, five cards each. On your turn, ask
// another player for a rank you hold. If they have any, they hand them all over and you
// go again. If not, "go fish": draw from the deck, and go again only if you drew the rank
// you asked for. Four of a rank make a book, laid down at once. If your hand runs out,
// draw a card and carry on. When all 13 books are made, the most books wins.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { isCard, isFullDeck, shuffledDeck, type Card } from '../../core/cards';
import { randomInt, type Rng } from '../../core/random';
import { SEATS, nextSeat, type Seat } from '../../core/tricks';

export type Level = 'easy' | 'strong';
export type Phase = 'playing' | 'over';

export const HAND_SIZE = 5;
export const BOOKS = 13;

/** What the last action did, for the status line. */
export type Event =
  | {
      kind: 'ask';
      seat: Seat;
      from: Seat;
      rank: number;
      /** Cards handed over; 0 means go fish. */
      got: number;
      /** The card fished from the deck, if any. */
      drew: Card | null;
      /** Books this action completed. */
      books: number[];
    }
  | { kind: 'draw'; seat: Seat; drew: Card; books: number[] };

export interface State {
  level: Level;
  phase: Phase;
  dealer: Seat;
  hands: Card[][];
  stock: Card[];
  /** Ranks of the books each seat has made, in the order made. */
  books: number[][];
  turn: Seat;
  /** Ranks each seat is known to hold, because everyone heard them ask for it. */
  known: number[][];
  last: Event | null;
  tally: { won: number; played: number };
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
const ranksIn = (hand: Card[]) => [...new Set(hand.map((c) => c.rank))].sort((a, b) => a - b);
const countRank = (hand: Card[], rank: number) => hand.filter((c) => c.rank === rank).length;
export const bookCount = (s: State, seat: Seat): number => s.books[seat].length;

export function newGame(level: Level = 'strong', rng: Rng = Math.random, tally = { won: 0, played: 0 }, dealer: Seat = 3): State {
  const deck = shuffledDeck(rng);
  const n: State = {
    level,
    phase: 'playing',
    dealer,
    hands: SEATS.map((s) => deck.slice(s * HAND_SIZE, (s + 1) * HAND_SIZE)),
    stock: deck.slice(4 * HAND_SIZE),
    books: [[], [], [], []],
    turn: nextSeat(dealer),
    known: [[], [], [], []],
    last: null,
    tally: { ...tally },
  };
  for (const seat of SEATS) layBooks(n, seat);
  return settle(n);
}

/** The next game: the deal moves left and the tally carries over. */
export const nextGame = (s: State, rng: Rng = Math.random): State => newGame(s.level, rng, s.tally, nextSeat(s.dealer));

/** Lays down any four of a kind in `seat`'s hand. Returns the ranks booked. */
function layBooks(n: State, seat: Seat): number[] {
  const made = ranksIn(n.hands[seat]).filter((r) => countRank(n.hands[seat], r) === 4);
  for (const r of made) {
    n.hands[seat] = n.hands[seat].filter((c) => c.rank !== r);
    n.books[seat].push(r);
    n.known = n.known.map((k) => k.filter((x) => x !== r));
  }
  return made;
}

/** Ends the game when every book is made; skips a player with no cards when the deck is empty. */
function settle(n: State): State {
  if (n.books.flat().length === BOOKS) {
    n.phase = 'over';
    n.tally = { won: n.tally.won + (winners(n).includes(0) ? 1 : 0), played: n.tally.played + 1 };
    return n;
  }
  while (!n.hands[n.turn].length && !n.stock.length) n.turn = nextSeat(n.turn);
  return n;
}

/** Players who have cards, other than `seat`: the ones `seat` may ask. */
export const targets = (s: State, seat: Seat): Seat[] => SEATS.filter((x) => x !== seat && s.hands[x].length > 0);

/** True when `seat` must draw instead of asking: no cards, or no one left to ask. */
export const mustDraw = (s: State, seat: Seat): boolean =>
  s.phase === 'playing' && s.turn === seat && s.stock.length > 0 && (!s.hands[seat].length || !targets(s, seat).length);

/** Asks `from` for every card of `rank`. You must hold that rank yourself. */
export function ask(s: State, seat: Seat, from: Seat, rank: number): State | null {
  if (s.phase !== 'playing' || s.turn !== seat || !targets(s, seat).includes(from) || !countRank(s.hands[seat], rank)) return null;
  const n = clone(s);
  const given = n.hands[from].filter((c) => c.rank === rank);
  n.hands[from] = n.hands[from].filter((c) => c.rank !== rank);
  n.known[from] = n.known[from].filter((r) => r !== rank);
  if (!n.known[seat].includes(rank)) n.known[seat].push(rank);
  let drew: Card | null = null;
  if (given.length) n.hands[seat].push(...given);
  else if (n.stock.length) {
    drew = n.stock.pop()!;
    n.hands[seat].push(drew);
  }
  const books = layBooks(n, seat);
  if (!n.hands[from].length) n.known[from] = [];
  n.last = { kind: 'ask', seat, from, rank, got: given.length, drew, books };
  if (!given.length && drew?.rank !== rank) n.turn = nextSeat(seat);
  return settle(n);
}

/**
 * Draws a card when you must (see mustDraw). With an empty hand you then carry on with your
 * turn; with no one to ask the turn passes.
 */
export function draw(s: State, seat: Seat): State | null {
  if (!mustDraw(s, seat)) return null;
  const n = clone(s);
  const empty = !n.hands[seat].length;
  const drew = n.stock.pop()!;
  n.hands[seat].push(drew);
  const books = layBooks(n, seat);
  n.last = { kind: 'draw', seat, drew, books };
  if (!empty) n.turn = nextSeat(seat);
  return settle(n);
}

/** The seats with the most books. */
export function winners(s: State): Seat[] {
  const most = Math.max(...SEATS.map((x) => s.books[x].length));
  return SEATS.filter((x) => s.books[x].length === most);
}

// --- Computer players ---

export type Turn = { action: 'ask'; from: Seat; rank: number } | { action: 'draw' };

/**
 * Easy asks anyone for any rank it holds. Strong remembers who asked for what and asks
 * them for it; otherwise it asks for the rank it holds most of, from the biggest hand.
 */
export function chooseTurn(s: State, seat: Seat, rng: Rng = Math.random): Turn {
  if (mustDraw(s, seat)) return { action: 'draw' };
  const hand = s.hands[seat];
  const ranks = ranksIn(hand);
  const others = targets(s, seat);
  if (s.level === 'easy') return { action: 'ask', from: others[randomInt(others.length, rng)], rank: ranks[randomInt(ranks.length, rng)] };
  const byCount = [...ranks].sort((a, b) => countRank(hand, b) - countRank(hand, a));
  for (const rank of byCount) {
    const from = others.find((x) => s.known[x].includes(rank));
    if (from !== undefined) return { action: 'ask', from, rank };
  }
  const most = countRank(hand, byCount[0]);
  const top = byCount.filter((r) => countRank(hand, r) === most);
  const biggest = Math.max(...others.map((x) => s.hands[x].length));
  const big = others.filter((x) => s.hands[x].length === biggest);
  return { action: 'ask', from: big[randomInt(big.length, rng)], rank: top[randomInt(top.length, rng)] };
}

export function applyTurn(s: State, seat: Seat, t: Turn): State | null {
  return t.action === 'draw' ? draw(s, seat) : ask(s, seat, t.from, t.rank);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  const ranks = (a: unknown) => Array.isArray(a) && a.every((r) => Number.isInteger(r) && r >= 1 && r <= 13);
  const four = (a: unknown) => Array.isArray(a) && a.length === 4;
  if (!st || (st.level !== 'easy' && st.level !== 'strong') || (st.phase !== 'playing' && st.phase !== 'over')) return false;
  if (!SEATS.includes(st.dealer) || !SEATS.includes(st.turn) || !four(st.hands) || !st.hands.every(cards) || !cards(st.stock)) return false;
  if (!four(st.books) || !st.books.every(ranks) || !four(st.known) || !st.known.every(ranks)) return false;
  if (!st.tally || !Number.isInteger(st.tally.won) || !Number.isInteger(st.tally.played)) return false;
  // Every card is in a hand, the deck, or a book.
  const booked = st.books.flat();
  if (new Set(booked).size !== booked.length || st.hands.flat().some((c) => booked.includes(c.rank))) return false;
  const inPlay = [...st.hands.flat(), ...st.stock];
  return inPlay.length + 4 * booked.length === 52 && isFullDeck([...inPlay, ...booked.flatMap((rank) => (['S', 'H', 'D', 'C'] as const).map((suit) => ({ suit, rank })))]);
}

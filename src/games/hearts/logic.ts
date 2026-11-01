// Hearts for four: you and three computer players. Pass 3 cards (left, right, across,
// then no pass), the 2 of clubs leads, follow suit, no points on the first trick, hearts
// can't be led until broken. Hearts are 1 point, the queen of spades 13. Taking all 26 is
// shooting the moon: everyone else gets 26. The game ends at 100; lowest score wins.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { isCard, isFullDeck, sameCard, shuffledDeck, type Card, type Suit } from '../../core/cards';
import { randomInt, shuffle, type Rng } from '../../core/random';
import { SEATS, dealFour, followSuit, highRank, nextSeat, trickWinner, type Play, type Seat } from '../../core/tricks';

export type Level = 'easy' | 'strong';
export type Phase = 'passing' | 'playing' | 'roundOver' | 'gameOver';

export const GAME_POINTS = 100;
export const PASS_NAMES = ['left', 'right', 'across', 'none'] as const;
/** How many seats clockwise each pass direction sends cards. */
const PASS_STEPS = [1, 3, 2, 0];

export interface State {
  level: Level;
  /** Counts from 0. Sets the pass direction. */
  round: number;
  phase: Phase;
  hands: Card[][];
  /** Cards on the table, in play order. */
  trick: Play[];
  /** Whose turn it is (once 4 cards are down, the trick waits to be collected). */
  turn: Seat;
  heartsBroken: boolean;
  tricksPlayed: number;
  /** Points taken this round. */
  points: number[];
  /** Game totals, not counting this round until it ends. */
  scores: number[];
  /** Points added at the end of the last round. */
  lastRound: number[];
  /** Who shot the moon in the last round, if anyone. */
  moon: Seat | null;
  /** Every card played this round. Strong players remember them. */
  played: Card[];
  /** The cards passed to you this round, shown until you play. */
  received: Card[];
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
const remove = (hand: Card[], card: Card) => hand.splice(hand.findIndex((c) => sameCard(c, card)), 1);

export const isTwoOfClubs = (c: Card): boolean => c.suit === 'C' && c.rank === 2;
export const isQueenOfSpades = (c: Card): boolean => c.suit === 'S' && c.rank === 12;
export const cardPoints = (c: Card): number => (c.suit === 'H' ? 1 : isQueenOfSpades(c) ? 13 : 0);
export const passDirection = (s: State) => PASS_NAMES[s.round % 4];

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  return startRound({ level, round: 0, scores: [0, 0, 0, 0], lastRound: [0, 0, 0, 0], moon: null }, rng);
}

function startRound(base: Pick<State, 'level' | 'round' | 'scores' | 'lastRound' | 'moon'>, rng: Rng): State {
  const s: State = {
    ...base,
    phase: 'passing',
    hands: dealFour(shuffledDeck(rng)),
    trick: [],
    turn: 0,
    heartsBroken: false,
    tricksPlayed: 0,
    points: [0, 0, 0, 0],
    played: [],
    received: [],
  };
  return passDirection(s) === 'none' ? beginPlay(s) : s;
}

function beginPlay(s: State): State {
  s.phase = 'playing';
  s.turn = SEATS.find((seat) => s.hands[seat].some(isTwoOfClubs))!;
  return s;
}

/** You pass `mine`; the computer players choose theirs. Everyone receives at once. */
export function passCards(s: State, mine: Card[], rng: Rng = Math.random): State | null {
  const unique = new Set(mine.map((c) => `${c.rank}${c.suit}`)).size === 3;
  if (s.phase !== 'passing' || mine.length !== 3 || !unique || !mine.every((c) => s.hands[0].some((h) => sameCard(h, c)))) {
    return null;
  }
  const n = clone(s);
  const steps = PASS_STEPS[n.round % 4];
  const outgoing = SEATS.map((seat) => (seat === 0 ? mine : choosePass(n, seat, rng)));
  outgoing.forEach((cards, seat) => cards.forEach((c) => remove(n.hands[seat], c)));
  outgoing.forEach((cards, seat) => n.hands[nextSeat(seat as Seat, steps)].push(...cards));
  n.received = outgoing[nextSeat(0, 4 - steps)];
  return beginPlay(n);
}

export function legalPlays(s: State, seat: Seat): Card[] {
  if (s.phase !== 'playing' || s.trick.length === 4) return [];
  const hand = s.hands[seat];
  if (!s.trick.length) {
    if (s.tricksPlayed === 0) return hand.filter(isTwoOfClubs);
    const notHearts = hand.filter((c) => c.suit !== 'H');
    return s.heartsBroken || !notHearts.length ? hand : notHearts;
  }
  const options = followSuit(hand, s.trick);
  if (s.tricksPlayed === 0 && options[0].suit !== s.trick[0].card.suit) {
    const clean = options.filter((c) => !cardPoints(c)); // no points on the first trick, if you can help it
    return clean.length ? clean : options;
  }
  return options;
}

export function play(s: State, seat: Seat, card: Card): State | null {
  if (s.turn !== seat || !legalPlays(s, seat).some((c) => sameCard(c, card))) return null;
  const n = clone(s);
  remove(n.hands[seat], card);
  n.trick.push({ seat, card });
  n.played.push(card);
  if (card.suit === 'H') n.heartsBroken = true;
  if (n.trick.length < 4) n.turn = nextSeat(seat);
  if (seat === 0) n.received = [];
  return n;
}

/** Gives a finished trick to its winner, who leads next. Ends the round after 13 tricks. */
export function collect(s: State): State | null {
  if (s.trick.length !== 4) return null;
  const n = clone(s);
  const winner = trickWinner(n.trick);
  n.points[winner] += n.trick.reduce((sum, p) => sum + cardPoints(p.card), 0);
  n.trick = [];
  n.tricksPlayed++;
  n.turn = winner;
  return n.tricksPlayed === 13 ? endRound(n) : n;
}

function endRound(n: State): State {
  const moon = n.points.indexOf(26);
  n.lastRound = moon >= 0 ? n.points.map((_, i) => (i === moon ? 0 : 26)) : n.points;
  n.scores = n.scores.map((total, i) => total + n.lastRound[i]);
  n.moon = moon >= 0 ? (moon as Seat) : null;
  n.phase = n.scores.some((total) => total >= GAME_POINTS) ? 'gameOver' : 'roundOver';
  return n;
}

export function nextRound(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'roundOver') return null;
  return startRound({ level: s.level, round: s.round + 1, scores: s.scores, lastRound: s.lastRound, moon: null }, rng);
}

/** Seats with the lowest score (more than one on a tie). */
export function winners(s: State): Seat[] {
  const low = Math.min(...s.scores);
  return SEATS.filter((seat) => s.scores[seat] === low);
}

// --- Computer players ---

const byRank = (cards: Card[], dir = 1) => [...cards].sort((a, b) => dir * (highRank(a) - highRank(b)));
const lowest = (cards: Card[]) => byRank(cards)[0];
const highest = (cards: Card[]) => byRank(cards, -1)[0];
const without = (cards: Card[], test: (c: Card) => boolean) => {
  const rest = cards.filter((c) => !test(c));
  return rest.length ? rest : cards;
};

/** Easy passes at random. Strong passes the queen of spades, unprotected high spades, and high cards in short suits. */
export function choosePass(s: State, seat: Seat, rng: Rng = Math.random): Card[] {
  const hand = s.hands[seat];
  if (s.level === 'easy') return shuffle(hand, rng).slice(0, 3);
  const count = (suit: Suit) => hand.filter((c) => c.suit === suit).length;
  const danger = (c: Card) => {
    if (isQueenOfSpades(c)) return 100;
    if (c.suit === 'S') return highRank(c) > 12 && count('S') <= 4 ? 80 + highRank(c) : 0; // low spades protect you
    return highRank(c) * 2 + (c.suit === 'H' ? 6 : 0) + (13 - count(c.suit));
  };
  return [...hand].sort((a, b) => danger(b) - danger(a)).slice(0, 3);
}

/** Easy plays any legal card. Strong avoids points, sheds danger and remembers what's been played. */
export function chooseCard(s: State, seat: Seat, rng: Rng = Math.random): Card {
  const legal = legalPlays(s, seat);
  if (s.level === 'easy' || legal.length === 1) return legal[randomInt(legal.length, rng)];
  const hand = s.hands[seat];
  const queenOut = s.played.some(isQueenOfSpades);
  const holdsQueen = hand.some(isQueenOfSpades);

  if (!s.trick.length) {
    // Lead low spades to flush out the queen, when we can't be the one stuck with it.
    const spades = legal.filter((c) => c.suit === 'S');
    if (!queenOut && !holdsQueen && spades.length && spades.every((c) => highRank(c) < 12)) return lowest(spades);
    // Holding the queen, keep every spade to guard it. Otherwise don't lead the ace or king into it.
    const safe = without(legal, (c) => c.suit === 'S' && (holdsQueen || (highRank(c) >= 12 && !queenOut)));
    return lowest(without(safe, (c) => c.suit === 'H'));
  }

  const led = s.trick[0].card.suit;
  const trickPoints = s.trick.reduce((sum, p) => sum + cardPoints(p.card), 0);
  const last = s.trick.length === 3;
  if (legal[0].suit === led) {
    const winning = highest(s.trick.filter((p) => p.card.suit === led).map((p) => p.card));
    const queen = legal.find(isQueenOfSpades);
    if (queen && highRank(winning) > 12) return queen; // the ace or king of spades is winning: hand them the queen
    if (last && !trickPoints) return highest(without(legal, isQueenOfSpades)); // a free trick: shed a high card
    const under = legal.filter((c) => highRank(c) < highRank(winning));
    if (under.length) return highest(under); // duck as high as possible
    const noQueen = without(legal, isQueenOfSpades);
    return last ? highest(noQueen) : lowest(noQueen); // we'll win it anyway
  }

  // Can't follow suit: dump the most dangerous card.
  const queen = legal.find(isQueenOfSpades);
  if (queen) return queen;
  const bigSpades = legal.filter((c) => c.suit === 'S' && highRank(c) > 12);
  if (!queenOut && bigSpades.length) return highest(bigSpades);
  const hearts = legal.filter((c) => c.suit === 'H');
  if (hearts.length) return highest(hearts);
  const count = (suit: Suit) => hand.filter((c) => c.suit === suit).length;
  return [...legal].sort((a, b) => count(a.suit) - count(b.suit) || highRank(b) - highRank(a))[0];
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const four = (a: unknown) => Array.isArray(a) && a.length === 4;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    ['passing', 'playing', 'roundOver', 'gameOver'].includes(st.phase) &&
    Number.isInteger(st.round) &&
    four(st.hands) &&
    st.hands.every(cards) &&
    Array.isArray(st.trick) &&
    st.trick.length <= 4 &&
    st.trick.every((p) => SEATS.includes(p?.seat) && isCard(p.card)) &&
    SEATS.includes(st.turn) &&
    four(st.points) &&
    four(st.scores) &&
    four(st.lastRound) &&
    cards(st.played) &&
    cards(st.received) &&
    isFullDeck([...st.hands.flat(), ...st.played])
  );
}

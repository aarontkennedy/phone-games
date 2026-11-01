// Spades for four in two teams: you and North against West and East. Everyone bids how
// many tricks they'll take (0 is nil). Spades are always trump and can't be led until
// one has been played. A made bid scores 10 a trick plus 1 per extra trick (a bag);
// a missed bid loses 10 a trick. Nil: +100 or -100. Every 10 bags costs 100. First
// team to 500 wins. Pure functions: every action returns a new State, or null.
import { isCard, isFullDeck, sameCard, shuffledDeck, type Card, type Suit } from '../../core/cards';
import { randomInt, type Rng } from '../../core/random';
import { SEATS, dealFour, followSuit, highRank, nextSeat, trickWinner, type Play, type Seat } from '../../core/tricks';

export type Level = 'easy' | 'strong';
export type Phase = 'bidding' | 'playing' | 'roundOver' | 'gameOver';
/** Team 0 is you and North; team 1 is West and East. */
export type Team = 0 | 1;

export const GAME_POINTS = 500;
export const BAG_LIMIT = 10;
export const NIL_POINTS = 100;

export interface RoundResult {
  /** Points each team scored this round, bag penalties included. */
  points: [number, number];
  /** Bags each team took this round. */
  bags: [number, number];
  /** Whether each team lost 100 for reaching 10 bags. */
  bagPenalty: [boolean, boolean];
}

export interface State {
  level: Level;
  round: number;
  phase: Phase;
  /** Deals and bids first in seat order after this seat; rotates each round. */
  dealer: Seat;
  hands: Card[][];
  /** Each seat's bid this round, or null before they've bid. 0 is nil. */
  bids: (number | null)[];
  /** Tricks each seat has won this round. */
  tricks: number[];
  trick: Play[];
  turn: Seat;
  spadesBroken: boolean;
  scores: [number, number];
  bags: [number, number];
  last: RoundResult | null;
  /** Every card played this round. Strong players remember them. */
  played: Card[];
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
export const teamOf = (seat: Seat): Team => (seat % 2) as Team;
export const partnerOf = (seat: Seat): Seat => nextSeat(seat, 2);
const seatsOf = (team: Team): Seat[] => (team === 0 ? [0, 2] : [1, 3]);

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  return startRound({ level, round: 0, dealer: 3, scores: [0, 0], bags: [0, 0], last: null }, rng);
}

function startRound(base: Pick<State, 'level' | 'round' | 'dealer' | 'scores' | 'bags' | 'last'>, rng: Rng): State {
  return {
    ...base,
    phase: 'bidding',
    hands: dealFour(shuffledDeck(rng)),
    bids: [null, null, null, null],
    tricks: [0, 0, 0, 0],
    trick: [],
    turn: nextSeat(base.dealer),
    spadesBroken: false,
    played: [],
  };
}

export function bid(s: State, seat: Seat, amount: number): State | null {
  if (s.phase !== 'bidding' || s.turn !== seat || !Number.isInteger(amount) || amount < 0 || amount > 13) return null;
  const n = clone(s);
  n.bids[seat] = amount;
  n.turn = nextSeat(seat);
  if (n.bids.every((b) => b !== null)) n.phase = 'playing'; // the player after the dealer leads
  return n;
}

export function legalPlays(s: State, seat: Seat): Card[] {
  if (s.phase !== 'playing' || s.trick.length === 4) return [];
  const hand = s.hands[seat];
  if (s.trick.length) return followSuit(hand, s.trick);
  const notSpades = hand.filter((c) => c.suit !== 'S');
  return s.spadesBroken || !notSpades.length ? hand : notSpades;
}

export function play(s: State, seat: Seat, card: Card): State | null {
  if (s.turn !== seat || !legalPlays(s, seat).some((c) => sameCard(c, card))) return null;
  const n = clone(s);
  n.hands[seat].splice(n.hands[seat].findIndex((c) => sameCard(c, card)), 1);
  n.trick.push({ seat, card });
  n.played.push(card);
  if (card.suit === 'S') n.spadesBroken = true;
  if (n.trick.length < 4) n.turn = nextSeat(seat);
  return n;
}

export function collect(s: State): State | null {
  if (s.trick.length !== 4) return null;
  const n = clone(s);
  const winner = trickWinner(n.trick, 'S');
  n.tricks[winner]++;
  n.trick = [];
  n.turn = winner;
  return n.tricks.reduce((a, b) => a + b, 0) === 13 ? endRound(n) : n;
}

/** Scores a finished round for one team. Exported for tests and the round summary. */
export function scoreTeam(bids: number[], tricks: number[], bagsBefore: number) {
  let points = 0;
  bids.forEach((b, i) => {
    if (b === 0) points += tricks[i] === 0 ? NIL_POINTS : -NIL_POINTS;
  });
  const need = bids.reduce((a, b) => a + b, 0);
  const took = tricks.reduce((a, t) => a + t, 0); // a failed nil's tricks still count, as bags
  const nilTricks = bids.reduce((sum, b, i) => sum + (b === 0 ? tricks[i] : 0), 0);
  const bidders = took - nilTricks;
  let bags = 0;
  if (need > 0) {
    if (bidders >= need) {
      bags = took - need;
      points += need * 10 + bags;
    } else {
      points -= need * 10;
      bags = nilTricks;
    }
  } else {
    bags = took; // both nil: every trick is a bag
    points += bags;
  }
  const total = bagsBefore + bags;
  const penalty = total >= BAG_LIMIT;
  return { points: points - (penalty ? NIL_POINTS : 0), bags, bagsAfter: penalty ? total - BAG_LIMIT : total, penalty };
}

function endRound(n: State): State {
  const results = ([0, 1] as Team[]).map((team) => {
    const seats = seatsOf(team);
    return scoreTeam(
      seats.map((s) => n.bids[s]!),
      seats.map((s) => n.tricks[s]),
      n.bags[team],
    );
  });
  n.scores = [n.scores[0] + results[0].points, n.scores[1] + results[1].points];
  n.bags = [results[0].bagsAfter, results[1].bagsAfter];
  n.last = {
    points: [results[0].points, results[1].points],
    bags: [results[0].bags, results[1].bags],
    bagPenalty: [results[0].penalty, results[1].penalty],
  };
  const [us, them] = n.scores;
  n.phase = (us >= GAME_POINTS || them >= GAME_POINTS) && us !== them ? 'gameOver' : 'roundOver';
  return n;
}

export function nextRound(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'roundOver') return null;
  const { level, scores, bags, last } = s;
  return startRound({ level, round: s.round + 1, dealer: nextSeat(s.dealer), scores, bags, last }, rng);
}

export const winner = (s: State): Team | null => (s.phase === 'gameOver' ? (s.scores[0] > s.scores[1] ? 0 : 1) : null);

/** Team bid so far, counting only seats that have bid (nil counts 0). */
export const teamBid = (s: State, team: Team): number => seatsOf(team).reduce<number>((sum, seat) => sum + (s.bids[seat] ?? 0), 0);
export const teamTricks = (s: State, team: Team): number => seatsOf(team).reduce<number>((sum, seat) => sum + s.tricks[seat], 0);

// --- Computer players ---

const byRank = (cards: Card[], dir = 1) => [...cards].sort((a, b) => dir * (highRank(a) - highRank(b)));
const lowest = (cards: Card[]) => byRank(cards)[0];
const highest = (cards: Card[]) => byRank(cards, -1)[0];

/** Roughly how many tricks a hand should take. Also the suggested bid shown to you. */
export function estimateTricks(hand: Card[]): number {
  const count = (suit: Suit) => hand.filter((c) => c.suit === suit).length;
  const spades = count('S');
  let tricks = 0;
  for (const c of hand) {
    const r = highRank(c);
    const len = count(c.suit);
    if (c.suit === 'S') {
      if (r === 14) tricks += 1;
      else if (r === 13) tricks += spades >= 2 ? 1 : 0.5;
      else if (r === 12) tricks += spades >= 3 ? 0.75 : 0.25;
    } else {
      if (r === 14) tricks += len <= 5 ? 1 : 0.5;
      else if (r === 13) tricks += len >= 2 && len <= 4 ? 0.75 : 0.25;
      else if (r === 12) tricks += len >= 3 && len <= 4 ? 0.25 : 0;
    }
  }
  tricks += Math.max(0, spades - 3); // long trump wins tricks late
  for (const suit of ['H', 'D', 'C'] as Suit[]) {
    const len = count(suit);
    if (spades >= 2 && len === 0) tricks += 1; // a void lets you trump
    else if (spades >= 2 && len === 1) tricks += 0.5;
  }
  return Math.min(13, tricks);
}

/** Whether a hand is weak enough to bid nil: no aces, no high spades, few high cards. */
export function goodNil(hand: Card[]): boolean {
  const high = hand.filter((c) => highRank(c) >= 11).length;
  return (
    !hand.some((c) => c.rank === 1) &&
    hand.filter((c) => c.suit === 'S').every((c) => highRank(c) <= 9) &&
    high <= 2 &&
    estimateTricks(hand) < 1.5
  );
}

/** Easy bids loosely and never nil. Strong bids its estimate, nils weak hands, and keeps the table total sensible. */
export function chooseBid(s: State, seat: Seat, rng: Rng = Math.random): number {
  const est = estimateTricks(s.hands[seat]);
  if (s.level === 'easy') return Math.max(1, Math.min(13, Math.round(est) + randomInt(3, rng) - 1));
  const partnerBid = s.bids[partnerOf(seat)];
  if (goodNil(s.hands[seat]) && partnerBid !== 0) return 0;
  const others = s.bids.reduce<number>((sum, b) => sum + (b ?? 0), 0);
  return Math.max(1, Math.min(Math.round(est), 13 - others));
}

/** Easy plays any legal card. Strong works toward the team's bid without taking extra bags. */
export function chooseCard(s: State, seat: Seat, rng: Rng = Math.random): Card {
  const legal = legalPlays(s, seat);
  if (s.level === 'easy' || legal.length === 1) return legal[randomInt(legal.length, rng)];

  const team = teamOf(seat);
  const partner = partnerOf(seat);
  const nil = s.bids[seat] === 0;
  const partnerNil = s.bids[partner] === 0;
  const need = teamBid(s, team) - teamTricks(s, team);
  const wantTricks = !nil && need > 0;
  const beats = (a: Card, b: Card) =>
    a.suit === b.suit ? highRank(a) > highRank(b) : a.suit === 'S';

  if (!s.trick.length) {
    const nonSpades = legal.filter((c) => c.suit !== 'S');
    if (nil) return lowest(nonSpades.length ? nonSpades : legal);
    if (wantTricks) {
      // Lead a card nobody can beat in its suit: an ace, or a king once its ace is gone.
      const sure = legal.filter((c) => {
        const higher = [14, 13, 12].filter((r) => r > highRank(c));
        return higher.every((r) => s.played.some((p) => p.suit === c.suit && highRank(p) === r) || legal.some((h) => h.suit === c.suit && highRank(h) === r));
      });
      if (sure.length) return highest(sure);
    }
    return lowest(nonSpades.length ? nonSpades : legal);
  }

  const winning = s.trick.reduce((best, p) => (beats(p.card, best.card) ? p : best));
  const winners = legal.filter((c) => beats(c, winning.card));
  const losers = legal.filter((c) => !beats(c, winning.card));
  const last = s.trick.length === 3;

  if (nil) return losers.length ? highest(losers) : lowest(legal); // stay under, shedding high cards
  if (partnerNil && winning.seat === partner) {
    return winners.length ? lowest(winners) : lowest(legal); // take it away from our nil bidder
  }
  const opponentNil = s.bids[winning.seat] === 0 && teamOf(winning.seat) !== team;
  if (opponentNil) return losers.length ? highest(losers) : lowest(legal); // leave them stuck with it
  if (winning.seat === partner && (last || highRank(winning.card) >= 13)) return lowest(losers.length ? losers : legal);
  if (wantTricks && winners.length) return lowest(winners);
  return losers.length ? (last ? highest(losers) : lowest(losers)) : lowest(legal);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const four = (a: unknown) => Array.isArray(a) && a.length === 4;
  const two = (a: unknown) => Array.isArray(a) && a.length === 2 && a.every((x) => typeof x === 'number');
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    ['bidding', 'playing', 'roundOver', 'gameOver'].includes(st.phase) &&
    Number.isInteger(st.round) &&
    SEATS.includes(st.dealer) &&
    SEATS.includes(st.turn) &&
    four(st.hands) &&
    st.hands.every((h) => Array.isArray(h) && h.every(isCard)) &&
    four(st.bids) &&
    st.bids.every((b) => b === null || (Number.isInteger(b) && b >= 0 && b <= 13)) &&
    four(st.tricks) &&
    Array.isArray(st.trick) &&
    st.trick.length <= 4 &&
    st.trick.every((p) => SEATS.includes(p?.seat) && isCard(p.card)) &&
    two(st.scores) &&
    two(st.bags) &&
    Array.isArray(st.played) &&
    st.played.every(isCard) &&
    isFullDeck([...st.hands.flat(), ...st.played])
  );
}

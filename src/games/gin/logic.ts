// Gin rummy for two: you against the computer, first to 100. Each turn, draw from the stock
// or the discard pile, then discard (not the card you just took from the pile). Melds are
// sets of 3-4 of a rank, or runs of 3+ in a suit (aces low). Other cards are deadwood:
// aces 1, court cards 10, others their number. With 10 or less deadwood you may knock: the
// other player lays off what they can on your melds, and the lower deadwood scores the
// difference. Gin (no deadwood) scores 25 more and allows no lay-offs; being undercut
// (the defender ties or beats the knocker) gives the defender 25 more. If the stock gets
// down to 2 cards, the hand is a draw. Pure functions: actions return a new State, or null.
import { SUITS, isCard, isFullDeck, sameCard, shuffledDeck, type Card } from '../../core/cards';
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Phase = 'draw' | 'discard' | 'handOver' | 'gameOver';
export type Player = 0 | 1;

export const GAME_POINTS = 100;
export const KNOCK_AT = 10;
export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;

export interface Result {
  kind: 'knock' | 'gin' | 'undercut' | 'draw';
  knocker: Player | null;
  /** Who scored, and how much. */
  winner: Player | null;
  points: number;
  /** Deadwood each player finished with (after lay-offs for the defender). */
  deadwood: [number, number];
  /** Melds each player laid down. */
  melds: Card[][][];
}

export interface State {
  level: Level;
  phase: Phase;
  dealer: Player;
  turn: Player;
  hands: Card[][];
  stock: Card[];
  /** The last card is on top. */
  discard: Card[];
  /** The card just taken from the discard pile: it can't go straight back. */
  taken: Card | null;
  scores: [number, number];
  last: Result | null;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
export const value = (c: Card): number => Math.min(c.rank, 10);
const total = (cards: Card[]) => cards.reduce((t, c) => t + value(c), 0);

// --- Melds ---

/** Every possible meld within `hand`: sets of 3 or 4 and runs of 3 or more. */
export function possibleMelds(hand: Card[]): Card[][] {
  const melds: Card[][] = [];
  for (let rank = 1; rank <= 13; rank++) {
    const same = hand.filter((c) => c.rank === rank);
    if (same.length >= 3) {
      melds.push(same);
      if (same.length === 4) for (let skip = 0; skip < 4; skip++) melds.push(same.filter((_, i) => i !== skip));
    }
  }
  for (const suit of SUITS) {
    const ranks = new Set(hand.filter((c) => c.suit === suit).map((c) => c.rank));
    for (let start = 1; start <= 11; start++) {
      for (let len = 3; start + len - 1 <= 13 && ranks.has(start + len - 1); len++) {
        if (![...Array(len).keys()].every((k) => ranks.has(start + k))) break;
        melds.push([...Array(len).keys()].map((k) => ({ suit, rank: start + k })));
      }
    }
  }
  return melds;
}

/** The melds that leave the least deadwood, and that deadwood. */
export function bestMelds(hand: Card[]): { melds: Card[][]; deadwood: Card[]; points: number } {
  const options = possibleMelds(hand);
  let best = { melds: [] as Card[][], deadwood: hand, points: total(hand) };
  const search = (from: number, chosen: Card[][], used: Card[]) => {
    const left = hand.filter((c) => !used.some((u) => sameCard(u, c)));
    const points = total(left);
    if (points < best.points) best = { melds: chosen, deadwood: left, points };
    for (let i = from; i < options.length; i++) {
      const m = options[i];
      if (m.some((c) => used.some((u) => sameCard(u, c)))) continue;
      search(i + 1, [...chosen, m], [...used, ...m]);
    }
  };
  search(0, [], []);
  return best;
}

export const deadwood = (hand: Card[]): number => bestMelds(hand).points;

/** Cards from `cards` that can be added to `melds`, extending runs or completing sets, repeatedly. */
export function layOff(melds: Card[][], cards: Card[]): { laid: Card[]; rest: Card[] } {
  const ms = melds.map((m) => m.slice());
  let rest = cards.slice();
  const laid: Card[] = [];
  for (let progress = true; progress; ) {
    progress = false;
    for (const c of rest) {
      const fit = ms.find((m) => {
        const isSet = m.every((x) => x.rank === m[0].rank);
        if (isSet) return m.length < 4 && c.rank === m[0].rank;
        const ranks = m.map((x) => x.rank);
        return c.suit === m[0].suit && (c.rank === Math.min(...ranks) - 1 || c.rank === Math.max(...ranks) + 1);
      });
      if (fit) {
        fit.push(c);
        laid.push(c);
        rest = rest.filter((x) => !sameCard(x, c));
        progress = true;
        break;
      }
    }
  }
  return { laid, rest };
}

// --- The hand ---

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  return deal({ level, dealer: 1, scores: [0, 0], last: null }, rng);
}

function deal(base: Pick<State, 'level' | 'dealer' | 'scores' | 'last'>, rng: Rng): State {
  const deck = shuffledDeck(rng);
  return {
    ...base,
    phase: 'draw',
    turn: base.dealer === 0 ? 1 : 0,
    hands: [deck.slice(0, 10), deck.slice(10, 20)],
    discard: [deck[20]],
    stock: deck.slice(21),
    taken: null,
  };
}

export function drawStock(s: State, p: Player): State | null {
  if (s.phase !== 'draw' || s.turn !== p) return null;
  const n = clone(s);
  n.hands[p].push(n.stock.pop()!);
  n.taken = null;
  n.phase = 'discard';
  return n;
}

export function drawDiscard(s: State, p: Player): State | null {
  if (s.phase !== 'draw' || s.turn !== p || !s.discard.length) return null;
  const n = clone(s);
  const c = n.discard.pop()!;
  n.hands[p].push(c);
  n.taken = c;
  n.phase = 'discard';
  return n;
}

/** Whether discarding `card` would leave few enough deadwood points to knock. */
export const canKnockWith = (s: State, p: Player, card: Card): boolean =>
  deadwood(s.hands[p].filter((c) => !sameCard(c, card))) <= KNOCK_AT;

/** Discards a card, knocking if asked (and allowed). */
export function discard(s: State, p: Player, card: Card, knock = false): State | null {
  if (s.phase !== 'discard' || s.turn !== p || !s.hands[p].some((c) => sameCard(c, card))) return null;
  if (s.taken && sameCard(s.taken, card)) return null;
  if (knock && !canKnockWith(s, p, card)) return null;
  const n = clone(s);
  n.hands[p] = n.hands[p].filter((c) => !sameCard(c, card));
  n.discard.push(card);
  n.taken = null;
  if (knock) return settle(n, p);
  if (n.stock.length <= 2) {
    n.last = { kind: 'draw', knocker: null, winner: null, points: 0, deadwood: [deadwood(n.hands[0]), deadwood(n.hands[1])], melds: [bestMelds(n.hands[0]).melds, bestMelds(n.hands[1]).melds] };
    n.phase = 'handOver';
    return n;
  }
  n.turn = p === 0 ? 1 : 0;
  n.phase = 'draw';
  return n;
}

function settle(n: State, knocker: Player): State {
  const defender: Player = knocker === 0 ? 1 : 0;
  const k = bestMelds(n.hands[knocker]);
  const d = bestMelds(n.hands[defender]);
  const gin = k.points === 0;
  const defenderLeft = gin ? d.deadwood : layOff(k.melds, d.deadwood).rest;
  const dPoints = total(defenderLeft);
  const result: Result = { kind: 'knock', knocker, winner: knocker, points: 0, deadwood: [0, 0], melds: [[], []] };
  result.deadwood[knocker] = k.points;
  result.deadwood[defender] = dPoints;
  result.melds[knocker] = k.melds;
  result.melds[defender] = d.melds;
  if (gin) {
    result.kind = 'gin';
    result.points = GIN_BONUS + dPoints;
  } else if (dPoints <= k.points) {
    result.kind = 'undercut';
    result.winner = defender;
    result.points = UNDERCUT_BONUS + k.points - dPoints;
  } else {
    result.points = dPoints - k.points;
  }
  n.scores[result.winner!] += result.points;
  n.last = result;
  n.phase = n.scores[result.winner!] >= GAME_POINTS ? 'gameOver' : 'handOver';
  return n;
}

export function nextHand(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'handOver') return null;
  return deal({ level: s.level, dealer: s.dealer === 0 ? 1 : 0, scores: s.scores, last: s.last }, rng);
}

export const winner = (s: State): Player | null => (s.phase === 'gameOver' ? s.last!.winner : null);

// --- Computer player ---

/** The discard that leaves the least deadwood (ties: throw the higher card). */
export function bestDiscard(s: State, p: Player): Card {
  const options = s.hands[p].filter((c) => !(s.taken && sameCard(s.taken, c)));
  const score = (c: Card) => deadwood(s.hands[p].filter((x) => !sameCard(x, c))) * 100 - value(c);
  return options.reduce((a, b) => (score(b) < score(a) ? b : a));
}

export type Turn = { action: 'stock' } | { action: 'pile' } | { action: 'discard'; card: Card; knock: boolean };

/**
 * Easy takes the pile only to complete a meld, throws a random loose card, and knocks only
 * when nearly done. Strong takes the pile whenever it helps, throws its worst card, and
 * knocks as soon as it can.
 */
export function chooseTurn(s: State, p: Player, rng: Rng = Math.random): Turn {
  const hand = s.hands[p];
  if (s.phase === 'draw') {
    const top = s.discard.at(-1);
    if (!top) return { action: 'stock' };
    const now = deadwood(hand);
    const withTop = [...hand, top];
    if (s.level === 'easy') {
      const melded = bestMelds(withTop).melds.some((m) => m.some((c) => sameCard(c, top)));
      return melded ? { action: 'pile' } : { action: 'stock' };
    }
    const after = Math.min(...hand.map((c) => deadwood(withTop.filter((x) => !sameCard(x, c)))));
    return after < now ? { action: 'pile' } : { action: 'stock' };
  }
  let card: Card;
  if (s.level === 'easy') {
    const loose = bestMelds(hand).deadwood.filter((c) => !(s.taken && sameCard(s.taken, c)));
    card = loose.length ? loose[randomInt(loose.length, rng)] : bestDiscard(s, p);
  } else card = bestDiscard(s, p);
  const left = deadwood(hand.filter((c) => !sameCard(c, card)));
  const knock = left <= (s.level === 'easy' ? 4 : KNOCK_AT);
  return { action: 'discard', card, knock };
}

export function applyTurn(s: State, p: Player, t: Turn): State | null {
  if (t.action === 'stock') return drawStock(s, p);
  if (t.action === 'pile') return drawDiscard(s, p);
  return discard(s, p, t.card, t.knock);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    ['draw', 'discard', 'handOver', 'gameOver'].includes(st.phase) &&
    (st.dealer === 0 || st.dealer === 1) &&
    (st.turn === 0 || st.turn === 1) &&
    Array.isArray(st.hands) &&
    st.hands.length === 2 &&
    st.hands.every(cards) &&
    cards(st.stock) &&
    cards(st.discard) &&
    (st.taken === null || isCard(st.taken)) &&
    Array.isArray(st.scores) &&
    st.scores.length === 2 &&
    isFullDeck([...st.hands.flat(), ...st.stock, ...st.discard])
  );
}

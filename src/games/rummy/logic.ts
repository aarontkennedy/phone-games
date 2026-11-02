// Rummy 500 for two: you against the computer, 13 cards each, first to 500. On your turn,
// draw from the deck, or take any card from the face-up discard pile along with every card
// above it; a card taken from the pile must be melded that turn. Then lay down melds (sets
// of 3-4 of a rank, or runs of 3+ in a suit, aces low or high but not both) and lay off
// cards on any meld on the table, yours or the computer's. End by discarding one card.
// The hand ends when someone has no cards left, or the deck runs out. Each player scores the
// cards they melded and loses the cards left in their hand: aces 15 (1 in a low run), court
// cards and 10s 10, others their number. Pure functions: actions return a new State, or null.
import { SUITS, isCard, isFullDeck, sameCard, shuffledDeck, type Card } from '../../core/cards';
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Phase = 'draw' | 'play' | 'handOver' | 'gameOver';
export type Player = 0 | 1;

export const HAND_SIZE = 13;
export const GAME_POINTS = 500;

/** What the last action was, for the status line. */
export interface Action {
  player: Player;
  kind: 'stock' | 'pile' | 'meld' | 'layoff' | 'discard';
  cards: Card[];
}

export interface HandResult {
  melded: [number, number];
  held: [number, number];
  /** Each player's score for the hand: melded minus held. */
  points: [number, number];
  /** Who ran out of cards, or null when the deck ran out. */
  out: Player | null;
}

/** Where things stood before taking from the pile, so you can change your mind. */
export interface Before {
  hand: Card[];
  discard: Card[];
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
  /** Melds on the table, each in order. */
  table: Card[][];
  /** Points each player has melded this hand. */
  melded: [number, number];
  /** The card taken from the pile that must be melded this turn, in your next play. */
  mustUse: Card | null;
  before: Before | null;
  scores: [number, number];
  action: Action | null;
  last: HandResult | null;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
const has = (list: Card[], c: Card) => list.some((x) => sameCard(x, c));
const without = (list: Card[], remove: Card[]) => list.filter((c) => !has(remove, c));
const other = (p: Player): Player => (p === 0 ? 1 : 0);

/** A card's points in your hand, or melded anywhere but a low run. */
export const cardPoints = (c: Card): number => (c.rank === 1 ? 15 : Math.min(c.rank, 10));

// --- Melds ---

export const isSet = (cards: Card[]): boolean => cards.length >= 3 && cards.length <= 4 && cards.every((c) => c.rank === cards[0].rank);

/** The run's ranks in order, with an ace as 1 or 14, or null if it isn't a run. */
function runRanks(cards: Card[]): number[] | null {
  if (cards.length < 3 || !cards.every((c) => c.suit === cards[0].suit)) return null;
  for (const aceHigh of [false, true]) {
    const ranks = cards.map((c) => (c.rank === 1 && aceHigh ? 14 : c.rank)).sort((a, b) => a - b);
    if (ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1)) return ranks;
  }
  return null;
}

export const isRun = (cards: Card[]): boolean => runRanks(cards) !== null;
export const isMeld = (cards: Card[]): boolean => isSet(cards) || isRun(cards);

/** A meld's points: an ace in a low run (A-2-3) counts 1. */
export function meldPoints(meld: Card[]): number {
  const low = !isSet(meld) && runRanks(meld)?.[0] === 1;
  return meld.reduce((t, c) => t + (c.rank === 1 && low ? 1 : cardPoints(c)), 0);
}

/** A meld in order: runs low to high (a high ace last), sets by suit. */
export function sortMeld(meld: Card[]): Card[] {
  const ranks = runRanks(meld);
  if (!ranks || isSet(meld)) return [...meld].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
  return ranks.map((r) => meld.find((c) => c.rank === (r === 14 ? 1 : r))!);
}

/** The table meld `cards` can be laid off on, or -1. */
export const fits = (table: Card[][], cards: Card[]): number => (cards.length ? table.findIndex((m) => isMeld([...m, ...cards])) : -1);

/** Every meld you could make from `cards`: sets of 3 or 4 and runs of 3 or more. */
export function possibleMelds(cards: Card[]): Card[][] {
  const melds: Card[][] = [];
  for (let rank = 1; rank <= 13; rank++) {
    const same = cards.filter((c) => c.rank === rank);
    if (same.length >= 3) melds.push(same);
    if (same.length === 4) for (let skip = 0; skip < 4; skip++) melds.push(same.filter((_, i) => i !== skip));
  }
  for (const suit of SUITS) {
    const ranks = new Set(cards.filter((c) => c.suit === suit).flatMap((c) => (c.rank === 1 ? [1, 14] : [c.rank])));
    for (let start = 1; start <= 12; start++) {
      for (let end = start; ranks.has(end) && end - start < 13; end++) {
        if (end - start >= 2) melds.push(Array.from({ length: end - start + 1 }, (_, k) => ({ suit, rank: start + k === 14 ? 1 : start + k })));
      }
    }
  }
  return melds;
}

/** Whether `card` could be melded from `cards` (which include it) or laid off on the table. */
export const usable = (cards: Card[], table: Card[][], card: Card): boolean =>
  fits(table, [card]) >= 0 || possibleMelds(cards).some((m) => has(m, card));

export type Play = { kind: 'meld'; cards: Card[] } | { kind: 'layoff'; cards: Card[]; meld: number };

/** The next meld or lay-off worth making from `hand`: lay-offs first, then the meld worth most. */
export function nextPlay(hand: Card[], table: Card[][]): Play | null {
  for (const c of hand) {
    const meld = fits(table, [c]);
    if (meld >= 0) return { kind: 'layoff', cards: [c], meld };
  }
  const melds = possibleMelds(hand);
  if (!melds.length) return null;
  return { kind: 'meld', cards: melds.reduce((a, b) => (meldPoints(b) > meldPoints(a) ? b : a)) };
}

/** Points you could meld from `hand` this turn, playing greedily. */
export function meldable(hand: Card[], table: Card[][]): { points: number; left: Card[] } {
  let left = hand;
  let t = table.map((m) => m.slice());
  let points = 0;
  for (let p = nextPlay(left, t); p; p = nextPlay(left, t)) {
    if (p.kind === 'layoff') {
      points += meldPoints([...t[p.meld], ...p.cards]) - meldPoints(t[p.meld]);
      t = t.map((m, i) => (i === p.meld ? [...m, ...p.cards] : m));
    } else {
      points += meldPoints(p.cards);
      t = [...t, p.cards];
    }
    left = without(left, p.cards);
  }
  return { points, left };
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
    turn: other(base.dealer),
    hands: [deck.slice(0, HAND_SIZE), deck.slice(HAND_SIZE, 2 * HAND_SIZE)],
    discard: [deck[2 * HAND_SIZE]],
    stock: deck.slice(2 * HAND_SIZE + 1),
    table: [],
    melded: [0, 0],
    mustUse: null,
    before: null,
    action: null,
  };
}

export function drawStock(s: State, p: Player): State | null {
  if (s.phase !== 'draw' || s.turn !== p || !s.stock.length) return null;
  const n = clone(s);
  const c = n.stock.pop()!;
  n.hands[p].push(c);
  n.phase = 'play';
  n.action = { player: p, kind: 'stock', cards: [] };
  return n;
}

/** Whether you may take the pile card at `index` (and all above it): only if you can meld it. */
export function canTake(s: State, p: Player, index: number): boolean {
  if (s.phase !== 'draw' || s.turn !== p || !Number.isInteger(index) || index < 0 || index >= s.discard.length) return false;
  return usable([...s.hands[p], ...s.discard.slice(index)], s.table, s.discard[index]);
}

export function takePile(s: State, p: Player, index: number): State | null {
  if (!canTake(s, p, index)) return null;
  const n = clone(s);
  n.before = { hand: [...n.hands[p]], discard: [...n.discard] };
  const taken = n.discard.splice(index);
  n.hands[p] = [...n.hands[p], ...taken];
  n.mustUse = taken[0];
  n.phase = 'play';
  n.action = { player: p, kind: 'pile', cards: taken };
  return n;
}

/** Puts the pile cards back, before you've melded the card you must (which has to come first). */
export function undoTake(s: State, p: Player): State | null {
  if (s.phase !== 'play' || s.turn !== p || !s.before) return null;
  return { ...clone(s), hands: p === 0 ? [s.before.hand, s.hands[1]] : [s.hands[0], s.before.hand], discard: s.before.discard, phase: 'draw', mustUse: null, before: null, action: null };
}

function played(n: State, p: Player, cards: Card[]): State {
  n.hands[p] = without(n.hands[p], cards);
  if (n.mustUse && has(cards, n.mustUse)) {
    n.mustUse = null;
    n.before = null;
  }
  return n.hands[p].length ? n : endHand(n, p);
}

/** Whether `cards` may be played now: in your hand, and including the pile card you must meld. */
const canPlay = (s: State, p: Player, cards: Card[]) =>
  s.phase === 'play' && s.turn === p && cards.length > 0 && cards.every((c) => has(s.hands[p], c)) && (!s.mustUse || has(cards, s.mustUse));

/** Lays down a new meld from your hand. */
export function meld(s: State, p: Player, cards: Card[]): State | null {
  if (!canPlay(s, p, cards) || !isMeld(cards)) return null;
  const n = clone(s);
  const m = sortMeld(cards);
  n.table.push(m);
  n.melded[p] += meldPoints(m);
  n.action = { player: p, kind: 'meld', cards: m };
  return played(n, p, cards);
}

/** Adds cards from your hand to a meld on the table. */
export function layOff(s: State, p: Player, cards: Card[], index: number): State | null {
  if (!canPlay(s, p, cards)) return null;
  const target = s.table[index];
  if (!target || !isMeld([...target, ...cards])) return null;
  const n = clone(s);
  const m = sortMeld([...target, ...cards]);
  n.melded[p] += meldPoints(m) - meldPoints(target);
  n.table[index] = m;
  n.action = { player: p, kind: 'layoff', cards };
  return played(n, p, cards);
}

/** Ends your turn. Not allowed while the card you took from the pile is still in your hand. */
export function discard(s: State, p: Player, card: Card): State | null {
  if (s.phase !== 'play' || s.turn !== p || s.mustUse || !has(s.hands[p], card)) return null;
  const n = clone(s);
  n.hands[p] = without(n.hands[p], [card]);
  n.discard.push(card);
  n.action = { player: p, kind: 'discard', cards: [card] };
  if (!n.hands[p].length) return endHand(n, p);
  if (!n.stock.length) return endHand(n, null);
  n.turn = other(p);
  n.phase = 'draw';
  return n;
}

function endHand(n: State, out: Player | null): State {
  const held = n.hands.map((h) => h.reduce((t, c) => t + cardPoints(c), 0)) as [number, number];
  const points: [number, number] = [n.melded[0] - held[0], n.melded[1] - held[1]];
  n.scores = [n.scores[0] + points[0], n.scores[1] + points[1]];
  n.last = { melded: [...n.melded], held, points, out };
  n.mustUse = null;
  n.before = null;
  const [a, b] = n.scores;
  n.phase = Math.max(a, b) >= GAME_POINTS && a !== b ? 'gameOver' : 'handOver';
  return n;
}

export function nextHand(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'handOver') return null;
  return deal({ level: s.level, dealer: other(s.dealer), scores: s.scores, last: s.last }, rng);
}

export const winner = (s: State): Player | null => (s.phase === 'gameOver' ? (s.scores[0] > s.scores[1] ? 0 : 1) : null);

// --- Computer player ---

export type Turn =
  | { action: 'stock' }
  | { action: 'pile'; index: number }
  | { action: 'meld'; cards: Card[] }
  | { action: 'layoff'; cards: Card[]; meld: number }
  | { action: 'discard'; card: Card };

/** How much a card helps: pairs and near neighbours in its suit are worth keeping. */
function keepScore(hand: Card[], c: Card): number {
  const pair = hand.filter((x) => x.rank === c.rank).length - 1;
  const near = hand.filter((x) => x.suit === c.suit && x.rank !== c.rank && Math.abs(x.rank - c.rank) <= 2).length;
  return (pair + near) * 20 - cardPoints(c);
}

/**
 * Easy takes the top of the pile only when it can meld it, melds but never lays off, and
 * throws a random card. Strong weighs every pile card it could take, lays off what it can,
 * and throws its least useful high card.
 */
export function chooseTurn(s: State, p: Player, rng: Rng = Math.random): Turn {
  const hand = s.hands[p];
  if (s.phase === 'draw') {
    const top = s.discard.length - 1;
    if (s.level === 'easy') return top >= 0 && canTake(s, p, top) ? { action: 'pile', index: top } : { action: 'stock' };
    const now = meldable(hand, s.table).points;
    let best: Turn = { action: 'stock' };
    let gain = 0;
    for (let i = Math.max(0, top - 9); i <= top; i++) {
      if (!canTake(s, p, i)) continue;
      const taken = s.discard.slice(i);
      const after = meldable([...hand, ...taken], s.table);
      const g = after.points - now - after.left.filter((c) => has(taken, c)).reduce((t, c) => t + cardPoints(c), 0) / 2;
      if (g > gain) [best, gain] = [{ action: 'pile', index: i }, g];
    }
    return best;
  }
  if (s.mustUse) {
    const must = s.mustUse;
    const on = fits(s.table, [must]);
    if (on >= 0) return { action: 'layoff', cards: [must], meld: on };
    const options = possibleMelds(hand).filter((m) => has(m, must));
    return { action: 'meld', cards: options.reduce((a, b) => (b.length > a.length ? b : a)) };
  }
  const play = s.level === 'easy' ? possibleMelds(hand).map((cards): Play => ({ kind: 'meld', cards }))[0] ?? null : nextPlay(hand, s.table);
  if (play) return play.kind === 'meld' ? { action: 'meld', cards: play.cards } : { action: 'layoff', cards: play.cards, meld: play.meld };
  if (s.level === 'easy') return { action: 'discard', card: hand[randomInt(hand.length, rng)] };
  return { action: 'discard', card: hand.reduce((a, b) => (keepScore(hand, b) < keepScore(hand, a) ? b : a)) };
}

export function applyTurn(s: State, p: Player, t: Turn): State | null {
  if (t.action === 'stock') return drawStock(s, p);
  if (t.action === 'pile') return takePile(s, p, t.index);
  if (t.action === 'meld') return meld(s, p, t.cards);
  if (t.action === 'layoff') return layOff(s, p, t.cards, t.meld);
  return discard(s, p, t.card);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  const pair = (a: unknown) => Array.isArray(a) && a.length === 2 && a.every(Number.isInteger);
  const player = (v: unknown) => v === 0 || v === 1;
  if (!st || (st.level !== 'easy' && st.level !== 'strong') || !['draw', 'play', 'handOver', 'gameOver'].includes(st.phase)) return false;
  if (!player(st.dealer) || !player(st.turn) || !Array.isArray(st.hands) || st.hands.length !== 2 || !st.hands.every(cards)) return false;
  if (!cards(st.stock) || !cards(st.discard) || !Array.isArray(st.table) || !st.table.every((m) => cards(m) && isMeld(m))) return false;
  if (!pair(st.melded) || !pair(st.scores) || !(st.mustUse === null || isCard(st.mustUse))) return false;
  if (st.before !== null && !(st.before && cards(st.before.hand) && cards(st.before.discard))) return false;
  return isFullDeck([...st.hands.flat(), ...st.stock, ...st.discard, ...st.table.flat()]);
}

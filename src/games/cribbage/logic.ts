// Cribbage for two: you against the computer, first to 121. Each player gets 6 cards and
// puts 2 in the dealer's crib. A starter card is cut (a jack gives the dealer 2). Then
// pegging: players take turns laying cards, keeping a count up to 31, scoring fifteens,
// thirty-ones, pairs, runs, "go" and last card. Then the show: the non-dealer's hand,
// the dealer's hand and the crib are counted with the starter.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { isCard, isFullDeck, sameCard, shuffledDeck, type Card } from '../../core/cards';
import { randomInt, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Phase = 'discard' | 'pegging' | 'show' | 'gameOver';
/** 0 is you, 1 is the computer. */
export type Player = 0 | 1;

export const GAME_POINTS = 121;
export const PLAYER_NAMES = ['You', 'Computer'] as const;

export interface ScoreItem {
  label: string;
  points: number;
}

/** Something that scored, to tell the player about. */
export interface Event {
  player: Player;
  items: ScoreItem[];
}

export interface State {
  level: Level;
  phase: Phase;
  dealer: Player;
  /** Cards still in hand: 6 while discarding, then the ones not yet pegged. */
  hands: Card[][];
  /** The 4 cards each player kept, counted in the show. */
  kept: Card[][];
  crib: Card[];
  starter: Card | null;
  /** The rest of the deck. */
  stock: Card[];
  /** Cards in the current count, oldest first. Cleared after 31 or a go. */
  pile: { player: Player; card: Card }[];
  /** Every card pegged this hand, for the table. */
  pegged: { player: Player; card: Card }[];
  turn: Player;
  /** In the show: 0 is the non-dealer's hand, 1 the dealer's, 2 the crib. */
  showStep: number;
  scores: [number, number];
  /** The back pegs: each player's score before their latest points, like the trailing
   *  peg on a real board. Missing in saves from before the board had two pegs. */
  back?: [number, number];
  /** What scored most recently. */
  events: Event[];
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
export const other = (p: Player): Player => (1 - p) as Player;
/** Count value: aces 1, court cards 10. */
export const value = (c: Card): number => Math.min(c.rank, 10);
export const pileCount = (s: State): number => s.pile.reduce((sum, p) => sum + value(p.card), 0);
const plural = (n: number, word: string) => `${n === 1 ? 'a' : n} ${word}${n === 1 ? '' : 's'}`;

// --- Scoring a hand ---

/** Every way a show hand scores: fifteens, pairs, runs, flush and nobs. */
export function scoreHand(hand: Card[], starter: Card, crib = false): ScoreItem[] {
  const all = [...hand, starter];
  const items: ScoreItem[] = [];

  let fifteens = 0;
  for (let mask = 1; mask < 1 << all.length; mask++) {
    const sum = all.reduce((t, c, i) => (mask & (1 << i) ? t + value(c) : t), 0);
    if (sum === 15) fifteens++;
  }
  if (fifteens) items.push({ label: plural(fifteens, 'fifteen'), points: fifteens * 2 });

  const counts = new Map<number, number>();
  for (const c of all) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const pairs = [...counts.values()].reduce((t, n) => t + (n * (n - 1)) / 2, 0);
  if (pairs) items.push({ label: plural(pairs, 'pair'), points: pairs * 2 });

  for (let start = 1; start <= 13; start++) {
    if (!counts.has(start) || counts.has(start - 1)) continue;
    let len = 0;
    let ways = 1;
    while (counts.has(start + len)) ways *= counts.get(start + len++)!;
    if (len >= 3) items.push({ label: `${ways === 1 ? 'a run' : `${ways} runs`} of ${len}`, points: len * ways });
  }

  const suit = hand[0].suit;
  if (hand.every((c) => c.suit === suit)) {
    const five = starter.suit === suit;
    if (five || !crib) items.push({ label: `a flush of ${five ? 5 : 4}`, points: five ? 5 : 4 });
  }

  if (hand.some((c) => c.rank === 11 && c.suit === starter.suit)) items.push({ label: 'nobs', points: 1 });
  return items;
}

export const total = (items: ScoreItem[]): number => items.reduce((t, i) => t + i.points, 0);

// --- Pegging ---

/** Points for laying the last card of `pile`: fifteen, thirty-one, pairs and runs. */
export function pegPoints(pile: Card[]): ScoreItem[] {
  const items: ScoreItem[] = [];
  const count = pile.reduce((t, c) => t + value(c), 0);
  if (count === 15) items.push({ label: 'fifteen', points: 2 });
  if (count === 31) items.push({ label: 'thirty-one', points: 2 });

  const last = pile.at(-1)!;
  let same = 1;
  while (same < pile.length && pile[pile.length - 1 - same].rank === last.rank) same++;
  if (same > 1) {
    const [label, points] = [['', 0], ['', 0], ['a pair', 2], ['three of a kind', 6], ['four of a kind', 12]][same] as [string, number];
    items.push({ label, points });
  }

  for (let len = pile.length; len >= 3; len--) {
    const ranks = pile.slice(-len).map((c) => c.rank).sort((a, b) => a - b);
    if (ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1)) {
      items.push({ label: `a run of ${len}`, points: len });
      break;
    }
  }
  return items;
}

export const canPlay = (s: State, p: Player): boolean => s.hands[p].some((c) => pileCount(s) + value(c) <= 31);

export function legalPlays(s: State, p: Player): Card[] {
  if (s.phase !== 'pegging' || s.turn !== p) return [];
  return s.hands[p].filter((c) => pileCount(s) + value(c) <= 31);
}

/** Adds points, ending the game the moment someone reaches 121. */
function award(n: State, player: Player, items: ScoreItem[]): boolean {
  if (!items.length) return false;
  n.back = [...(n.back ?? n.scores)];
  n.back[player] = n.scores[player];
  n.scores[player] = Math.min(GAME_POINTS, n.scores[player] + total(items));
  n.events.push({ player, items });
  if (n.scores[player] >= GAME_POINTS) {
    n.phase = 'gameOver';
    return true;
  }
  return false;
}

// --- The hand ---

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  return deal({ level, dealer: 1, scores: [0, 0], back: [0, 0] }, rng);
}

function deal(base: Pick<State, 'level' | 'dealer' | 'scores' | 'back'>, rng: Rng): State {
  const deck = shuffledDeck(rng);
  return {
    ...base,
    phase: 'discard',
    hands: [deck.slice(0, 6), deck.slice(6, 12)],
    kept: [[], []],
    crib: [],
    starter: null,
    stock: deck.slice(12),
    pile: [],
    pegged: [],
    turn: other(base.dealer),
    showStep: 0,
    events: [],
  };
}

/** You send 2 cards to the crib; the computer chooses its 2. Then the starter is cut. */
export function discard(s: State, mine: Card[], rng: Rng = Math.random): State | null {
  const unique = mine.length === 2 && !sameCard(mine[0], mine[1]);
  if (s.phase !== 'discard' || !unique || !mine.every((c) => s.hands[0].some((h) => sameCard(h, c)))) return null;
  const n = clone(s);
  const theirs = chooseDiscard(n, 1, rng);
  for (const [p, cards] of [[0, mine], [1, theirs]] as const) {
    n.hands[p] = n.hands[p].filter((h) => !cards.some((c) => sameCard(c, h)));
    n.crib.push(...cards);
  }
  n.kept = [n.hands[0].slice(), n.hands[1].slice()];
  n.starter = n.stock.splice(randomInt(n.stock.length, rng), 1)[0];
  n.phase = 'pegging';
  n.turn = other(n.dealer);
  if (n.starter.rank === 11) award(n, n.dealer, [{ label: 'his heels (a jack cut)', points: 2 }]);
  return n;
}

export function play(s: State, p: Player, card: Card): State | null {
  if (!legalPlays(s, p).some((c) => sameCard(c, card))) return null;
  const n = clone(s);
  n.events = [];
  n.hands[p] = n.hands[p].filter((c) => !sameCard(c, card));
  n.pile.push({ player: p, card });
  n.pegged.push({ player: p, card });
  if (award(n, p, pegPoints(n.pile.map((x) => x.card)))) return n;

  const count = pileCount(n);
  const handsEmpty = !n.hands[0].length && !n.hands[1].length;
  if (count === 31) {
    n.pile = [];
  } else if (!canPlay(n, other(p)) && !canPlay(n, p)) {
    // Neither can play: the last card scores a point, and the count starts again.
    if (award(n, p, [{ label: handsEmpty ? 'last card' : 'go', points: 1 }])) return n;
    n.pile = [];
  }
  if (handsEmpty) return startShow(n);
  // The other player goes next if they can; after 31 or a go they lead, if they have cards.
  const next = other(p);
  n.turn = canPlay(n, next) ? next : p;
  return n;
}

function startShow(n: State): State {
  n.phase = 'show';
  n.showStep = 0;
  n.pile = [];
  scoreShowStep(n);
  return n;
}

/** What's counted at each step of the show, and whose points they are. */
export function showHand(s: State, step = s.showStep): { player: Player; cards: Card[]; crib: boolean } {
  if (step === 2) return { player: s.dealer, cards: s.crib, crib: true };
  const player = step === 0 ? other(s.dealer) : s.dealer;
  return { player, cards: s.kept[player], crib: false };
}

function scoreShowStep(n: State) {
  const { player, cards, crib } = showHand(n);
  const items = scoreHand(cards, n.starter!, crib);
  n.events = [];
  if (!award(n, player, items)) n.events = [{ player, items }];
}

/** Moves the show on to the next hand, then deals again with the other dealer. */
export function nextStep(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'show') return null;
  if (s.showStep === 2) return deal({ level: s.level, dealer: other(s.dealer), scores: s.scores, back: s.back }, rng);
  const n = clone(s);
  n.showStep++;
  scoreShowStep(n);
  return n;
}

export const winner = (s: State): Player | null =>
  s.phase === 'gameOver' ? (s.scores[0] >= GAME_POINTS ? 0 : 1) : null;

// --- Computer player ---

/** A rough value for two cards in a crib: fifteens, pairs, fives and near-runs. */
function cribValue([a, b]: Card[]): number {
  return (
    (value(a) + value(b) === 15 ? 2 : 0) +
    (a.rank === b.rank ? 2 : 0) +
    [a, b].filter((c) => c.rank === 5).length +
    (Math.abs(a.rank - b.rank) === 1 ? 0.5 : 0)
  );
}

/**
 * Easy throws any two cards. Strong tries every choice, averaging the kept hand over every
 * possible starter, plus the crib's value if it's ours or minus it if it isn't.
 */
export function chooseDiscard(s: State, p: Player, rng: Rng = Math.random): Card[] {
  const hand = s.hands[p];
  if (s.level === 'easy') {
    const i = randomInt(6, rng);
    const j = (i + 1 + randomInt(5, rng)) % 6;
    return [hand[i], hand[j]];
  }
  const starters = [...s.stock, ...s.hands[other(p)]];
  let best: Card[] = [];
  let bestScore = -Infinity;
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const toss = [hand[i], hand[j]];
      const keep = hand.filter((_, k) => k !== i && k !== j);
      const avg = starters.reduce((t, st) => t + total(scoreHand(keep, st)), 0) / starters.length;
      const score = avg + (s.dealer === p ? 1 : -1) * cribValue(toss);
      if (score > bestScore) [best, bestScore] = [toss, score];
    }
  }
  return best;
}

/** Easy plays any card that fits. Strong takes points and avoids leaving 5 or 21 for a ten. */
export function chooseCard(s: State, p: Player, rng: Rng = Math.random): Card {
  const legal = legalPlays(s, p);
  if (s.level === 'easy' || legal.length === 1) return legal[randomInt(legal.length, rng)];
  const pile = s.pile.map((x) => x.card);
  const rate = (c: Card) => {
    const count = pileCount(s) + value(c);
    let score = total(pegPoints([...pile, c]));
    if (count === 5 || count === 21) score -= 1.5; // a ten makes 15 or 31
    if (pile.length && pile.at(-1)!.rank === c.rank) score -= 1; // invites three of a kind
    if (!pile.length && value(c) < 5) score += 0.5; // a low lead can't be made into 15
    if (!pile.length && c.rank === 5) score -= 1;
    return score + value(c) * 0.01; // otherwise play high and keep low cards for later
  };
  return legal.reduce((a, b) => (rate(b) > rate(a) ? b : a));
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const cards = (a: unknown) => Array.isArray(a) && a.every(isCard);
  const players = (a: unknown) => a === 0 || a === 1;
  return (
    !!st &&
    (st.level === 'easy' || st.level === 'strong') &&
    ['discard', 'pegging', 'show', 'gameOver'].includes(st.phase) &&
    players(st.dealer) &&
    players(st.turn) &&
    Array.isArray(st.hands) &&
    st.hands.length === 2 &&
    st.hands.every(cards) &&
    Array.isArray(st.kept) &&
    st.kept.every(cards) &&
    cards(st.crib) &&
    cards(st.stock) &&
    (st.starter === null || isCard(st.starter)) &&
    Array.isArray(st.pile) &&
    Array.isArray(st.pegged) &&
    st.pegged.every((x) => players(x?.player) && isCard(x.card)) &&
    Number.isInteger(st.showStep) &&
    Array.isArray(st.scores) &&
    st.scores.length === 2 &&
    (st.back === undefined || (Array.isArray(st.back) && st.back.length === 2 && st.back.every(Number.isInteger))) &&
    Array.isArray(st.events) &&
    isFullDeck([
      ...st.hands.flat(),
      ...st.pegged.map((x) => x.card),
      ...st.crib,
      ...st.stock,
      ...(st.starter ? [st.starter] : []),
    ])
  );
}

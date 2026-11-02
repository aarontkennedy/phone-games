// Poker hand ranking, shared by the poker games. Pure functions, no DOM.
// Aces are high, and also low in the straight A-2-3-4-5 (the "wheel").
import type { Card } from './cards';

export type Category =
  | 'high'
  | 'pair'
  | 'twoPair'
  | 'three'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'four'
  | 'straightFlush';

/** Weakest first. */
export const CATEGORIES: readonly Category[] = ['high', 'pair', 'twoPair', 'three', 'straight', 'flush', 'fullHouse', 'four', 'straightFlush'];

export const CATEGORY_NAMES: Record<Category, string> = {
  high: 'High card',
  pair: 'Pair',
  twoPair: 'Two pair',
  three: 'Three of a kind',
  straight: 'Straight',
  flush: 'Flush',
  fullHouse: 'Full house',
  four: 'Four of a kind',
  straightFlush: 'Straight flush',
};

export interface HandRank {
  category: Category;
  /** Ranks that break ties, most important first, aces as 14. */
  kickers: number[];
  /** One number that orders hands: higher is better, equal is a tie. */
  score: number;
  /** The five cards that make the hand. */
  cards: Card[];
}

const high = (c: Card) => (c.rank === 1 ? 14 : c.rank);

/** Ranks a hand of exactly five cards. */
export function rankFive(cards: Card[]): HandRank {
  const ranks = cards.map(high).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const distinct = [...new Set(ranks)];
  let straightTop = 0;
  if (distinct.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightTop = ranks[0];
    else if (ranks.join() === '14,5,4,3,2') straightTop = 5; // the wheel
  }
  // Group by rank: bigger groups first, then higher ranks.
  const counts = distinct.map((r) => [r, ranks.filter((x) => x === r).length]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = counts.map((g) => g[1]).join('');
  const grouped = counts.map((g) => g[0]);
  let category: Category;
  let kickers = grouped;
  if (straightTop && flush) [category, kickers] = ['straightFlush', [straightTop]];
  else if (shape === '41') category = 'four';
  else if (shape === '32') category = 'fullHouse';
  else if (flush) [category, kickers] = ['flush', ranks];
  else if (straightTop) [category, kickers] = ['straight', [straightTop]];
  else if (shape === '311') category = 'three';
  else if (shape === '221') category = 'twoPair';
  else if (shape === '2111') category = 'pair';
  else [category, kickers] = ['high', ranks];
  const score = kickers.reduce((t, r, i) => t + r * 15 ** (4 - i), CATEGORIES.indexOf(category) * 15 ** 5);
  return { category, kickers, score, cards };
}

/** The best five-card hand within 5 to 7 cards. */
export function bestHand(cards: Card[]): HandRank {
  let best: HandRank | null = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const r = rankFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || r.score > best.score) best = r;
          }
  return best!;
}

const RANK_WORDS = ['', '', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings', 'aces'];
const RANK_WORD = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];

/** "Pair of jacks", "Full house, kings over fives", "Straight to the ten", "Royal flush". */
export function describeHand(h: HandRank): string {
  const [a, b] = h.kickers;
  switch (h.category) {
    case 'straightFlush':
      return a === 14 ? 'Royal flush' : `Straight flush to the ${RANK_WORD[a]}`;
    case 'four':
      return `Four ${RANK_WORDS[a]}`;
    case 'fullHouse':
      return `Full house, ${RANK_WORDS[a]} over ${RANK_WORDS[b]}`;
    case 'flush':
      return `Flush, ${RANK_WORD[a]} high`;
    case 'straight':
      return `Straight to the ${RANK_WORD[a]}`;
    case 'three':
      return `Three ${RANK_WORDS[a]}`;
    case 'twoPair':
      return `Two pair, ${RANK_WORDS[a]} and ${RANK_WORDS[b]}`;
    case 'pair':
      return `Pair of ${RANK_WORDS[a]}`;
    default:
      return `${RANK_WORD[a][0].toUpperCase()}${RANK_WORD[a].slice(1)} high`;
  }
}

// Known answers from outside sources (docs/TESTING.md, "Reference tests"). The other
// tests encode our own reading of the rules; these check it against published numbers,
// so a misunderstood rule fails here even when every other test agrees with it.
import { describe, expect, it } from 'vitest';
import { seededRng, shuffle } from '../core/random';
import { newDeck } from '../core/cards';
import { rankFive } from '../core/poker';
import { move as slide } from './2048/logic';
import { handValue } from './blackjack/logic';
import { applyMove, legalMoves as checkersMoves, startBoard, type Piece } from './checkers/logic';
import { START, fromFen, legalMoves as chessMoves, makeMove, type Position } from './chess/logic';
import { pegPoints, scoreHand, total } from './cribbage/logic';
import { cards } from './cribbage/test-fixtures';
import { scoreDice } from './hotdice/logic';
import { countSolutions } from './numberplace/logic';
import { flips, legalMoves as reversiMoves, newGame as newReversi, type Cell, type Side } from './reversi/logic';
import { scoreTeam } from './spades/logic';
import { basicScore } from './yacht/logic';

describe('Checkers: move counts from the start (published "perft" numbers)', () => {
  // English draughts perft, e.g. Aart Bik's checkers perft tables.
  function perft(board: (Piece | null)[], side: 0 | 1, depth: number): number {
    if (depth === 0) return 1;
    return checkersMoves(board, side).reduce((n, m) => n + perft(applyMove(board, m), side === 0 ? 1 : 0, depth - 1), 0);
  }
  it.each([
    [1, 7],
    [2, 49],
    [3, 302],
    [4, 1469],
    [5, 7361],
    [6, 36768],
  ])('%i moves deep: %i positions', (depth, expected) => {
    expect(perft(startBoard(), 0, depth)).toBe(expected);
  });
});

describe('Chess: move counts (published "perft" numbers, Chess Programming Wiki)', () => {
  // These positions between them test castling, en passant, promotion, pins and checks.
  const perft = (p: Position, depth: number): number => (depth === 0 ? 1 : chessMoves(p).reduce((n, m) => n + perft(makeMove(p, m), depth - 1), 0));
  it.each([
    ['the start', START, [20, 400, 8902]],
    ['"Kiwipete"', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0', [48, 2039]],
    ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0', [14, 191, 2812]],
    ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0', [6, 264, 9467]],
    ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1', [44, 1486]],
  ])('%s', (_name, fen, counts) => {
    counts.forEach((expected, i) => expect(perft(fromFen(fen as string), i + 1)).toBe(expected));
  });
});

describe('Poker: every five-card hand, counted by kind (published combinatorics)', () => {
  it('ranks all 2,598,960 hands into the known totals', () => {
    const d = newDeck();
    const counts: Record<string, number> = {};
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let e = c + 1; e < 52; e++)
            for (let f = e + 1; f < 52; f++) {
              const k = rankFive([d[a], d[b], d[c], d[e], d[f]]).category;
              counts[k] = (counts[k] ?? 0) + 1;
            }
    expect(counts).toEqual({
      straightFlush: 40, // including the 4 royal flushes
      four: 624,
      fullHouse: 3744,
      flush: 5108,
      straight: 10200,
      three: 54912,
      twoPair: 123552,
      pair: 1098240,
      high: 1302540,
    });
  }, 60_000);
});

describe('Reversi: move counts from the start (published "perft" numbers, OEIS A124004)', () => {
  function perft(board: Cell[], side: Side, depth: number): number {
    if (depth === 0) return 1;
    const moves = reversiMoves(board, side);
    const next: Side = side === 0 ? 1 : 0;
    if (!moves.length) return reversiMoves(board, next).length ? perft(board, next, depth - 1) : 1;
    return moves.reduce((n, i) => {
      const b = board.slice();
      b[i] = side;
      for (const f of flips(board, side, i)) b[f] = side;
      return n + perft(b, next, depth - 1);
    }, 0);
  }
  it.each([
    [1, 4],
    [2, 12],
    [3, 56],
    [4, 244],
    [5, 1396],
    [6, 8200],
  ])('%i moves deep: %i positions', (depth, expected) => {
    expect(perft(newReversi().board, 0, depth)).toBe(expected);
  });
});

describe('Cribbage: famous hands and facts', () => {
  const score = (hand: string, starter: string, crib = false) => total(scoreHand(cards(hand), cards(starter)[0], crib));

  it('the perfect hand scores 29: three 5s and the jack, with the 5 of the jack’s suit cut', () => {
    expect(score('5H 5C 5S JD', '5D')).toBe(29);
  });

  it('four 5s with a ten-card cut score 28; the 29 works with any suit of jack', () => {
    expect(score('5H 5C 5S 5D', 'KS')).toBe(28);
    expect(score('5H 5C 5D JS', '5S')).toBe(29);
    expect(score('5H 5C 5S 5D', 'JC')).toBe(28);
  });

  it('a four-card flush counts in a hand but not in the crib', () => {
    const hand = score('2H 4H 6H 8H', 'KS');
    expect(hand - score('2H 4H 6H 8H', 'KS', true)).toBe(4);
    expect(score('2H 4H 6H 8H', 'KH', true) - score('2H 4H 6H 8H', 'KS', true)).toBe(5);
  });

  it('no hand can score 19, 25, 26 or 27, and none beats 29', () => {
    const rng = seededRng(29);
    for (let i = 0; i < 20000; i++) {
      const [a, b, c, d, starter] = shuffle(newDeck(), rng);
      const points = total(scoreHand([a, b, c, d], starter, i % 2 === 0));
      expect([19, 25, 26, 27]).not.toContain(points);
      expect(points).toBeLessThanOrEqual(29);
    }
  });

  it('pegging: 15 and 31 for 2, a pair 2, three of a kind 6, four 12, runs in any order', () => {
    const peg = (ids: string) => total(pegPoints(cards(ids)));
    expect(peg('5H KS')).toBe(2);
    expect(peg('KH QS JD AC')).toBe(2); // 31
    expect(peg('7H 7S')).toBe(2);
    expect(peg('7H 7S 7D')).toBe(6);
    expect(peg('3H 3S 3D 3C')).toBe(12);
    expect(peg('2H 4S 3D')).toBe(3);
    expect(peg('4H 6S 5D')).toBe(5); // a run of 3 that also makes 15
    expect(peg('2H 4S 3D 5C')).toBe(4);
    expect(peg('4H 6S 9D')).toBe(0);
  });
});

describe('Number Place: Wikipedia’s example puzzle', () => {
  // The example on Wikipedia's "Sudoku" page, and its published solution.
  const puzzle = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
  const solution = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
  const grid = (s: string) => [...s].map((ch) => (ch === '.' ? 0 : Number(ch)));

  it('has exactly one answer, and it is the published one', () => {
    const p = grid(puzzle);
    const answer = grid(solution);
    expect(countSolutions(p)).toBe(1);
    // Every square's published digit keeps the puzzle solvable; any other legal digit breaks it.
    p.forEach((given, i) => {
      if (given) return;
      for (let n = 1; n <= 9; n++) {
        const tried = p.slice();
        tried[i] = n;
        expect(countSolutions(tried), `square ${i} = ${n}`).toBe(n === answer[i] ? 1 : 0);
      }
    });
  });
});

describe('Hot Dice: the common scoring table', () => {
  it.each<[number[], number | null]>([
    [[1], 100],
    [[5], 50],
    [[1, 1, 5], 250],
    [[1, 1, 1], 1000],
    [[2, 2, 2], 200],
    [[3, 3, 3], 300],
    [[4, 4, 4], 400],
    [[5, 5, 5], 500],
    [[6, 6, 6], 600],
    [[2, 2, 2, 2], 1000],
    [[2, 2, 2, 2, 2], 2000],
    [[2, 2, 2, 2, 2, 2], 3000],
    [[1, 2, 3, 4, 5, 6], 1500],
    [[2, 2, 4, 4, 6, 6], 1500],
    [[2, 3, 4, 6], null],
  ])('%j scores %s', (dice, points) => {
    expect(scoreDice(dice)).toBe(points);
  });
});

describe('Yacht: the standard score card', () => {
  it.each<[number[], Parameters<typeof basicScore>[1], number]>([
    [[3, 3, 3, 5, 5], 'full', 25],
    [[1, 2, 3, 4, 6], 'small', 30],
    [[2, 3, 4, 5, 6], 'large', 40],
    [[4, 4, 4, 4, 4], 'yacht', 50],
    [[2, 2, 2, 5, 6], 'three', 17],
    [[6, 6, 6, 6, 1], 'four', 25],
    [[5, 5, 2, 5, 1], 'fives', 15],
  ])('%j in %s scores %i', (dice, box, points) => {
    expect(basicScore(dice, box)).toBe(points);
  });
});

describe('Spades: standard scoring', () => {
  it('10 a trick bid, 1 a bag, minus 10 a trick when set, 100 for nil, minus 100 at 10 bags', () => {
    expect(scoreTeam([3, 1], [4, 1], 0).points).toBe(41); // bid 4, took 5
    expect(scoreTeam([3, 1], [2, 1], 0).points).toBe(-40); // bid 4, took 3
    expect(scoreTeam([0, 4], [0, 4], 0).points).toBe(140); // nil made, partner makes 4
    expect(scoreTeam([0, 4], [1, 4], 0).points).toBe(-59); // nil fails (-100), partner makes 4 (40), the nil trick is a bag (1)
    const bagged = scoreTeam([3, 2], [5, 2], 8);
    expect([bagged.penalty, bagged.points, bagged.bagsAfter]).toEqual([true, 50 + 2 - 100, 0]);
  });
});

describe('Blackjack: hand values', () => {
  it.each([
    ['AH KS', 21, true],
    ['AH AS 9D', 21, true],
    ['AH 6S 10D', 17, false],
    ['10H 6S AD AC', 18, false],
    ['AH 6S', 17, true],
    ['KH QS 2D', 22, false],
  ])('%s is %i', (ids, value, soft) => {
    expect(handValue(cards(ids))).toEqual({ total: value, soft });
  });
});

describe('2048: the merge rules', () => {
  const row = (r: number[]) => slide([...r, ...Array(12).fill(0)], 'left');
  it('merges each pair once, from the side it slides toward', () => {
    expect(row([2, 2, 2, 2]).board.slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(row([2, 2, 4, 0]).board.slice(0, 4)).toEqual([4, 4, 0, 0]); // the new 4 doesn't merge again
    expect(row([4, 4, 8, 8]).board.slice(0, 4)).toEqual([8, 16, 0, 0]);
    expect(row([2, 0, 2, 4]).board.slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(row([4, 4, 8, 8]).gained).toBe(24); // the score adds each new tile
  });
});

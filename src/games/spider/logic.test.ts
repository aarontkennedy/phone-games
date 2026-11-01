import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '../../core/cards';
import { seededRng } from '../../core/random';
import { RUNS, bestTarget, canMove, cardsAt, deal, findHint, isRun, isStuck, isValidState, move, newGame, spiderDeck, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
const card = (id: string): Card => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) });
const cards = (ids: string) => ids.split(' ').filter(Boolean).map(card);
const blank = (): State => ({ suits: 4, stock: [], tableau: Array.from({ length: 10 }, () => ({ down: [], up: [] })), done: [], moves: 0, elapsed: 0, won: false });
const run = (suit: Suit) => Array.from({ length: 13 }, (_, i) => ({ suit, rank: 13 - i }));

describe('dealing', () => {
  it.each([1, 2, 4] as const)('deals two decks of %i suit(s): 54 on the table, 50 in the deck', (suits) => {
    const s = newGame(suits, seededRng(1));
    expect(s.tableau.map((c) => c.down.length + c.up.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(s.tableau.every((c) => c.up.length === 1)).toBe(true);
    expect(s.stock).toHaveLength(50);
    expect(new Set(spiderDeck(suits).map((c) => c.suit)).size).toBe(suits);
    expect(isValidState(s)).toBe(true);
  });

  it('deals a card onto every column, but not while one is empty', () => {
    const s = newGame(1, seededRng(2));
    const d = deal(s)!;
    expect(d.tableau.every((c, i) => c.up.length === s.tableau[i].up.length + 1)).toBe(true);
    expect(d.stock).toHaveLength(40);
    const empty = { ...s, tableau: s.tableau.map((c, i) => (i === 3 ? { down: [], up: [] } : c)) };
    expect(deal(empty)).toBeNull();
    expect(deal({ ...s, stock: [] })).toBeNull();
  });
});

describe('moving', () => {
  it('puts any card on one rank higher, but moves only same-suit runs', () => {
    const s = blank();
    s.tableau[0].up = cards('9H 8S');
    s.tableau[1].up = cards('9D');
    s.tableau[2].up = cards('10C');
    expect(isRun(cards('9H 8H 7H'))).toBe(true);
    expect(isRun(cards('9H 8S'))).toBe(false);
    expect(canMove(s, { col: 0, index: 1 }, 1)).toBe(true); // 8 of spades on any 9
    expect(canMove(s, { col: 0, index: 0 }, 2)).toBe(false); // 9H 8S isn't one suit
    expect(canMove(s, { col: 0, index: 1 }, 0)).toBe(false);
    expect(cardsAt(s, { col: 0, index: 5 })).toEqual([]);
    expect(move(s, { col: 1, index: 0 }, 2)!.tableau[2].up).toEqual(cards('10C 9D'));
  });

  it('turns over the next card and prefers a same-suit home', () => {
    const s = blank();
    s.tableau[0] = { down: cards('2C'), up: cards('7S') };
    s.tableau[1].up = cards('8H');
    s.tableau[2].up = cards('8S');
    expect(bestTarget(s, { col: 0, index: 0 })).toBe(2);
    const n = move(s, { col: 0, index: 0 }, 2)!;
    expect(n.tableau[0].up).toEqual(cards('2C'));
    expect(n.moves).toBe(1);
  });

  it('never suggests moving a whole column into an empty one', () => {
    const s = blank();
    s.tableau[0].up = cards('5H');
    expect(bestTarget(s, { col: 0, index: 0 })).toBeNull();
    s.tableau[0].down = cards('KC');
    expect(bestTarget(s, { col: 0, index: 0 })).toBe(1);
    expect(bestTarget(s, { col: 4, index: 0 })).toBeNull();
  });

  it('lifts off a finished King-to-Ace run and wins after eight', () => {
    const s = blank();
    s.done = ['S', 'S', 'S', 'S', 'S', 'S', 'S'];
    s.tableau[0].up = run('H').slice(0, 12);
    s.tableau[1].up = cards('AH');
    const n = move(s, { col: 1, index: 0 }, 0)!;
    expect(n.done).toHaveLength(RUNS);
    expect(n.tableau[0].up).toEqual([]);
    expect(n.won).toBe(true);
  });
});

describe('hints', () => {
  it('prefers a same-suit move, then dealing, then any move; stuck when nothing is left', () => {
    const s = blank();
    s.tableau[0].up = cards('7S');
    s.tableau[1].up = cards('8H');
    s.tableau[2].up = cards('8S');
    expect(findHint(s)).toEqual({ src: { col: 0, index: 0 }, to: 2 });
    const t = blank();
    t.tableau.forEach((c) => (c.up = cards('KS'))); // ten kings: nothing can move
    t.stock = Array.from({ length: 10 }, () => card('2D'));
    expect(findHint(t)).toEqual({ deal: true });
    expect(isStuck({ ...t, stock: [] })).toBe(true);
    expect(findHint({ ...s, won: true })).toBeNull();
  });
});

describe('saves', () => {
  it('accepts real games and rejects broken ones', () => {
    const s = newGame(2, seededRng(3));
    expect(isValidState(s)).toBe(true);
    expect(isValidState({ ...s, done: ['S'] })).toBe(false); // 13 cards too many
    for (const bad of [
      null,
      { ...s, suits: 3 },
      { ...s, stock: null },
      { ...s, tableau: s.tableau.slice(1) },
      { ...s, tableau: [{ down: cards('2C'), up: [] }, ...s.tableau.slice(1)] },
      { ...s, moves: 'x' },
      { ...s, won: true },
      { ...s, stock: [{ suit: 'X', rank: 1 }, ...s.stock.slice(1)] },
      { ...s, done: ['Z'] },
    ]) {
      expect(isValidState(bad), JSON.stringify(bad).slice(0, 80)).toBe(false);
    }
  });
});

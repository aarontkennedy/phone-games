import { describe, expect, it } from 'vitest';
import { isFullDeck, type Card, type Suit } from '../../core/cards';
import { seededRng } from '../../core/random';
import { bestTarget, cardsAt, isLegal, isRun, isValidState, maxMove, move, newGame, type State } from './logic';

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
const card = (id: string): Card => ({ suit: id.slice(-1) as Suit, rank: RANKS[id.slice(0, -1)] ?? Number(id.slice(0, -1)) });
const cards = (ids: string) => ids.split(' ').filter(Boolean).map(card);
const upTo = (suit: Suit, rank: number) => Array.from({ length: rank }, (_, i) => ({ suit, rank: i + 1 }));
const blank = (): State => ({ cells: [null, null, null, null], foundations: [[], [], [], []], columns: Array.from({ length: 8 }, () => []), moves: 0, elapsed: 0, won: false });
const all = (s: State) => [...s.cells.filter(Boolean), ...s.foundations.flat(), ...s.columns.flat()] as Card[];

describe('free cells', () => {
  it('deals all 52 cards face up into 8 columns', () => {
    const s = newGame(seededRng(1));
    expect(s.columns.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(isFullDeck(all(s))).toBe(true);
    expect(isValidState(s)).toBe(true);
  });

  it('knows runs and how many cards can move at once', () => {
    expect(isRun(cards('9S 8H 7C'))).toBe(true);
    expect(isRun(cards('9S 8S'))).toBe(false);
    const s = blank();
    expect(maxMove(s, false)).toBe(5 * 2 ** 8);
    s.cells = [card('2C'), card('3C'), card('4C'), null];
    s.columns = Array.from({ length: 8 }, (_, i) => (i < 7 ? cards('KH') : []));
    expect(maxMove(s, false)).toBe(4);
    expect(maxMove(s, true)).toBe(2);
  });

  it('picks up a single card from a cell, or a run from a column', () => {
    const s = blank();
    s.cells[1] = card('5H');
    s.columns[0] = cards('2D 9S 8H 7C');
    expect(cardsAt(s, { from: 'cell', i: 1 })).toEqual(cards('5H'));
    expect(cardsAt(s, { from: 'cell', i: 0 })).toEqual([]);
    expect(cardsAt(s, { from: 'col', col: 0, index: 1 })).toEqual(cards('9S 8H 7C'));
    expect(cardsAt(s, { from: 'col', col: 0, index: 0 })).toEqual([]); // not a run
    expect(cardsAt(s, { from: 'col', col: 0, index: 9 })).toEqual([]);
  });

  it('moves to foundations, free cells and columns, by the rules', () => {
    let s = blank();
    s.columns[0] = cards('KS 9H');
    s.columns[1] = cards('10C');
    s.columns[2] = cards('QD 5S');
    s.foundations[1] = upTo('H', 8); // hearts up to 8
    expect(isLegal(s, { from: 'col', col: 0, index: 1 }, { to: 'foundation' })).toBe(true);
    expect(isLegal(s, { from: 'col', col: 0, index: 1 }, { to: 'col', col: 1 })).toBe(true);
    expect(isLegal(s, { from: 'col', col: 0, index: 1 }, { to: 'col', col: 0 })).toBe(false);
    expect(isLegal(s, { from: 'col', col: 0, index: 1 }, { to: 'col', col: 9 })).toBe(false);
    expect(isLegal(s, { from: 'col', col: 2, index: 1 }, { to: 'col', col: 1 })).toBe(false);
    s = move(s, { from: 'col', col: 2, index: 1 }, { to: 'cell' })!;
    expect(s.cells[0]).toEqual(card('5S'));
    expect(isLegal(s, { from: 'cell', i: 0 }, { to: 'cell' })).toBe(false); // cell to cell is pointless
    s = move(s, { from: 'col', col: 0, index: 1 }, { to: 'col', col: 1 })!;
    expect(s.columns[1]).toEqual(cards('10C 9H'));
    expect(s.moves).toBe(2);
    expect(move(s, { from: 'cell', i: 3 }, { to: 'cell' })).toBeNull();
  });

  it('won’t move more cards than the free space allows', () => {
    const s = blank();
    s.cells = [card('2C'), card('3C'), card('4C'), card('5C')];
    s.columns = [cards('9S 8H 7C'), cards('10H'), ...Array.from({ length: 6 }, () => cards('KD'))];
    expect(isLegal(s, { from: 'col', col: 0, index: 0 }, { to: 'col', col: 1 })).toBe(false); // 3 cards, room for 1
    s.cells[3] = null;
    s.cells[2] = null;
    expect(isLegal(s, { from: 'col', col: 0, index: 0 }, { to: 'col', col: 1 })).toBe(true);
  });

  it('puts safe cards up automatically, and wins', () => {
    const s = blank();
    s.foundations = [upTo('S', 13), upTo('H', 13), upTo('D', 12), upTo('C', 11)];
    s.columns[0] = cards('KC QC');
    s.columns[1] = cards('KD');
    const n = move(s, { from: 'col', col: 1, index: 0 }, { to: 'foundation' })!;
    expect(n.foundations.every((f) => f.length === 13)).toBe(true);
    expect(n.won).toBe(true);
    expect(move(n, { from: 'col', col: 0, index: 0 }, { to: 'cell' })).toBeNull();
  });

  it('keeps cards in play that a lower opposite-color card might need', () => {
    const s = blank();
    s.foundations = [upTo('S', 1), upTo('H', 4), [], []];
    s.columns[0] = cards('5H');
    s.columns[1] = cards('9C');
    s.cells[0] = card('2S');
    const n = move(s, { from: 'col', col: 1, index: 0 }, { to: 'col', col: 2 })!;
    expect(n.foundations[0]).toHaveLength(2); // the 2 of spades is always safe
    expect(n.columns[0]).toEqual(cards('5H')); // the 5 of hearts waits: black 4s aren't up
  });

  it('suggests the best place for a tapped card', () => {
    const s = blank();
    s.columns[0] = cards('KS 9H');
    s.columns[1] = cards('10C');
    s.columns[2] = cards('JD 4S');
    s.columns[3] = cards('AC');
    s.foundations[1] = upTo('H', 2);
    expect(bestTarget(s, { from: 'col', col: 0, index: 1 })).toEqual({ to: 'col', col: 1 });
    expect(bestTarget(s, { from: 'col', col: 3, index: 0 })).toEqual({ to: 'foundation' });
    expect(bestTarget(s, { from: 'col', col: 2, index: 1 })).toEqual({ to: 'col', col: 4 }); // an empty column
    expect(bestTarget(s, { from: 'col', col: 1, index: 0 })).toEqual({ to: 'cell' }); // a whole column
    const full = { ...s, cells: cards('2D 3D 4D 5D'), columns: s.columns.map((c, i) => (i > 3 ? cards('QH') : c)) };
    expect(bestTarget(full, { from: 'col', col: 2, index: 1 })).toBeNull();
  });

  it('validates saved games', () => {
    const s = newGame(seededRng(2));
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...s, cells: [] })).toBe(false);
    expect(isValidState({ ...s, columns: s.columns.slice(1) })).toBe(false);
    expect(isValidState({ ...s, foundations: [[card('2S')], [], [], []] })).toBe(false);
    expect(isValidState({ ...s, moves: 'x' })).toBe(false);
  });
});

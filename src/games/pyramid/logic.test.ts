import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import {
  PASSES,
  cardAt,
  cardsLeft,
  draw,
  findHint,
  indexOf,
  isFree,
  isStuck,
  isValidState,
  newGame,
  passesLeft,
  remove,
  rowOf,
  sources,
} from './logic';
import { card, table } from './test-fixtures';

describe('pyramid', () => {
  it('deals 28 cards in seven rows and 24 to the deck', () => {
    const s = newGame(seededRng(1));
    expect(s.pyramid.filter(Boolean)).toHaveLength(28);
    expect(s.stock).toHaveLength(24);
    expect(isFullDeck([...(s.pyramid as never[]), ...s.stock])).toBe(true);
    expect(isValidState(s)).toBe(true);
    expect(cardsLeft(s)).toBe(28);
    expect(passesLeft(s)).toBe(PASSES - 1);
  });

  it('knows rows and places', () => {
    expect([0, 1, 2, 3, 6, 21, 27].map(rowOf)).toEqual([0, 1, 1, 2, 3, 6, 6]);
    expect(indexOf(6, 0)).toBe(21);
    expect(indexOf(2, 1)).toBe(4);
  });

  it('frees a card once both cards below it are gone', () => {
    const s = newGame(seededRng(2));
    expect(isFree(s, 21)).toBe(true); // the bottom row
    expect(isFree(s, 15)).toBe(false); // row 5: covered by 21 and 22
    const opened = { ...s, pyramid: s.pyramid.map((c, i) => (i === 21 || i === 22 ? null : c)) };
    expect(isFree(opened, 15)).toBe(true);
    expect(isFree(opened, 21)).toBe(false); // gone
  });

  it('removes kings alone and pairs that make 13, and nothing else', () => {
    const s = table({ 0: '5S', 1: 'KH', 2: '8D', 3: '6C', 4: '7S', 5: 'QC' }, 'AD');
    // Row 2 (3, 4, 5) is the bottom here: everything below it is gone.
    const king = remove(s, [{ from: 'pyramid', i: 1 }]);
    expect(king).toBeNull(); // the king is covered by 3 and 4
    const pair = remove(s, [{ from: 'pyramid', i: 3 }, { from: 'pyramid', i: 4 }])!; // 6 and 7
    expect(pair.pyramid[3]).toBeNull();
    expect(pair.moves).toBe(1);
    expect(remove(pair, [{ from: 'pyramid', i: 1 }])!.pyramid[1]).toBeNull(); // now the king is free
    const withDeck = remove(s, [{ from: 'pyramid', i: 5 }, { from: 'waste' }])!; // queen and ace
    expect(withDeck.waste).toEqual([]);
    expect(remove(s, [{ from: 'pyramid', i: 3 }, { from: 'pyramid', i: 5 }])).toBeNull(); // 6 and 12
    expect(remove(s, [{ from: 'pyramid', i: 3 }, { from: 'pyramid', i: 3 }])).toBeNull(); // the same card twice
    expect(remove(s, [{ from: 'waste' }, { from: 'waste' }])).toBeNull();
    expect(remove(s, [])).toBeNull();
    expect(remove(s, [{ from: 'pyramid', i: 0 }, { from: 'pyramid', i: 2 }])).toBeNull(); // 5 and 8, but covered
    expect(cardAt(s, { from: 'waste' })).toEqual(card('AD'));
    expect(cardAt(table({ 27: 'KS' }), { from: 'waste' })).toBeNull();
  });

  it('wins when the pyramid is cleared', () => {
    const s = remove(table({ 0: 'KS' }), [{ from: 'pyramid', i: 0 }])!;
    expect(s.won).toBe(true);
    expect(remove(s, [{ from: 'waste' }])).toBeNull();
    expect(draw(s)).toBeNull();
    expect(findHint(s)).toBeNull();
    expect(isStuck(s)).toBe(false);
  });

  it('turns the deck one card at a time, and goes through it three times', () => {
    let s = table({ 0: 'QS' }, '', '2H 3H');
    s = draw(s)!;
    expect(s.waste).toEqual([card('3H')]);
    s = draw(draw(s)!)!; // turn the last card, then turn the pile back
    expect(s.stock).toEqual([card('2H'), card('3H')]); // the same order as the first time
    expect(s.pass).toBe(2);
    s = draw(draw(draw(s)!)!)!; // pass 3
    expect(s.pass).toBe(3);
    s = draw(draw(s)!)!;
    expect(s.stock).toEqual([]);
    expect(draw(s)).toBeNull(); // no passes left
    expect(draw(table({ 0: 'QS' }))).toBeNull(); // no deck and no pile
  });

  it('hints a king, then a pyramid pair (lowest first), then the deck card, then the deck', () => {
    expect(findHint(table({ 27: 'KS', 26: '6H', 25: '7H' }))).toEqual({ remove: [{ from: 'pyramid', i: 27 }] });
    expect(findHint(table({ 21: '6H', 22: '7H', 15: '5S', 16: 'AD' }, 'QC'))).toEqual({ remove: [{ from: 'pyramid', i: 21 }, { from: 'pyramid', i: 22 }] });
    expect(findHint(table({ 21: '6H' }, '7C'))).toEqual({ remove: [{ from: 'pyramid', i: 21 }, { from: 'waste' }] });
    expect(findHint(table({ 21: '6H' }, '', '9C'))).toEqual({ draw: true });
    const stuck = table({ 21: '6H' }, '9C', '', { pass: PASSES });
    expect(findHint(stuck)).toBeNull();
    expect(isStuck(stuck)).toBe(true);
    expect(sources(stuck)).toHaveLength(2);
  });

  it('checks saved games', () => {
    const s = newGame(seededRng(3));
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...s, pyramid: s.pyramid.slice(1) })).toBe(false);
    expect(isValidState({ ...s, pass: 4 })).toBe(false);
    expect(isValidState({ ...s, stock: s.stock.slice(1) })).toBe(false); // a card missing
  });
});

import { describe, expect, it } from 'vitest';
import { CENTER, HOLES, JUMPS, SIDE, hint, isOver, isValidState, isWon, jumpsFrom, legalJumps, newGame, pegsLeft, play, tap, type State } from './logic';

/** A board with pegs only at these cells. */
const only = (...cells: number[]): State => ({ pegs: Array.from({ length: SIDE * SIDE }, (_, i) => cells.includes(i)), picked: null, moves: 0 });

describe('peg solitaire', () => {
  it('starts with 32 pegs in the 33-hole cross, the center empty', () => {
    const s = newGame();
    expect(HOLES).toHaveLength(33);
    expect(JUMPS).toHaveLength(76);
    expect(pegsLeft(s)).toBe(32);
    expect(s.pegs[CENTER]).toBe(false);
    expect(legalJumps(s)).toHaveLength(4); // only into the center
    expect(isValidState(s)).toBe(true);
  });

  it('picks a peg up and jumps it over a neighbor into an empty hole', () => {
    let s = newGame();
    expect(tap(s, CENTER)).toBeNull(); // nothing picked up
    expect(tap(s, 0)).toBeNull(); // outside the cross
    expect(tap(s, 2)).toBeNull(); // a peg with no jump
    s = tap(s, CENTER - 2 * SIDE)!; // two above the center
    expect(s.picked).toBe(CENTER - 2 * SIDE);
    expect(tap(s, CENTER - 2 * SIDE)!.picked).toBeNull(); // put down again
    s = tap(s, CENTER)!;
    expect(s.pegs[CENTER]).toBe(true);
    expect(s.pegs[CENTER - SIDE]).toBe(false);
    expect(s.pegs[CENTER - 2 * SIDE]).toBe(false);
    expect(pegsLeft(s)).toBe(31);
    expect(s.moves).toBe(1);
    expect(play(s, [CENTER - 2 * SIDE, CENTER - SIDE, CENTER])).toBeNull(); // not any more
    expect(tap({ ...s, picked: CENTER + 2 * SIDE }, CENTER - 3 * SIDE)).toBeNull(); // not a jump from there
  });

  it('ends when no jump is left, and wins with one peg', () => {
    const won = only(CENTER);
    expect(isOver(won)).toBe(true);
    expect(isWon(won)).toBe(true);
    expect(tap(won, CENTER)).toBeNull();
    const stuck = only(HOLES[0], CENTER);
    expect(isOver(stuck)).toBe(true);
    expect(isWon(stuck)).toBe(false);
    expect(jumpsFrom(only(CENTER, CENTER + 1), CENTER)).toEqual([[CENTER, CENTER + 1, CENTER + 2]]);
  });

  it('hints a jump that can still reach one peg, from the start all the way down', () => {
    let s = newGame();
    while (pegsLeft(s) > 1) s = play(s, hint(s) as readonly [number, number, number])!;
    expect(isWon(s)).toBe(true);
  });

  it('says there’s no way when one peg can’t be reached', () => {
    // Two pegs far apart, with a third that can jump one: one jump, then stuck at 2.
    expect(hint(only(HOLES[0], CENTER, CENTER + 1))).toBe('none');
    expect(hint(newGame(), 1)).toBe('unknown'); // out of search budget
  });

  it('checks saved games', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...newGame(), pegs: [true] })).toBe(false);
    expect(isValidState({ ...only(0), picked: null })).toBe(false); // a peg outside the cross
    expect(isValidState({ ...newGame(), picked: CENTER })).toBe(false); // no peg there
  });
});

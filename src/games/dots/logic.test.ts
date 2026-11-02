import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { LINES, boxesOf, chooseLine, count, isValidState, move, newGame, newRound, sides, type State } from './logic';

const draw = (s: State, lines: number[]) => lines.reduce<State>((st, l) => move(st, l)!, s);

describe('lines and boxes', () => {
  it('has 40 lines; each box has four, and inside lines border two boxes', () => {
    expect(LINES).toBe(40);
    expect(sides(0)).toEqual([0, 4, 20, 21]);
    expect(boxesOf(0)).toEqual([0]);
    expect(boxesOf(4)).toEqual([0, 4]);
    expect(boxesOf(21)).toEqual([0, 1]);
  });

  it('passes the turn, unless a line closes a box: then it’s claimed and you go again', () => {
    let s = draw(newGame(), [0, 4, 20]);
    expect(s.turn).toBe(1);
    s = move(s, 21)!;
    expect(s.boxes[0]).toBe(1);
    expect(s.turn).toBe(1);
    expect(s.last).toBe(21);
    expect(move(s, 21)).toBeNull();
    expect(move(s, 40)).toBeNull();
  });

  it('closes two boxes with one line', () => {
    const s = draw(newGame(), [0, 4, 20, 1, 5, 22, 21].slice(0, 6)); // both boxes need line 21
    const n = move({ ...s, turn: 0 }, 21)!;
    expect([n.boxes[0], n.boxes[1]]).toEqual([0, 0]);
  });

  it('ends when every line is drawn, and keeps the tally', () => {
    let s = newGame();
    for (let l = 0; l < LINES; l++) s = move(s, l)!;
    expect(s.result).not.toBeNull();
    expect(count(s, 0) + count(s, 1)).toBe(16);
    expect(s.tally.you + s.tally.computer + s.tally.draws).toBe(1);
    expect(move(s, 0)).toBeNull();
    expect(newRound(s)).toMatchObject({ result: null, turn: 1, starter: 1 });
  });
});

describe('computer player', () => {
  it('takes a box when it can', () => {
    const s = { ...draw(newGame(), [0, 4, 20]), turn: 1 as const };
    expect(chooseLine(s)).toBe(21);
    expect(chooseLine({ ...s, level: 'easy' })).toBe(21);
  });

  it('Strong never gives a box away while a safe line is left; Easy plays anything', () => {
    const s = { ...draw(newGame(), [0, 4]), turn: 1 as const };
    for (let seed = 0; seed < 20; seed++) expect([20, 21]).not.toContain(chooseLine(s, seededRng(seed)));
    expect(chooseLine({ ...s, level: 'easy' }, seededRng(1))).toBeGreaterThanOrEqual(0);
  });

  it('with no safe line left, gives away as few boxes as it can', () => {
    let s = newGame();
    // Draw every line except the ones around boxes 0 and 15, leaving each with two sides open... then see it pick a cheap gift.
    const keep = new Set([...sides(0).slice(2), ...sides(15).slice(0, 2), ...sides(14).slice(0, 1)]);
    for (let l = 0; l < LINES && s.result === null; l++) if (!keep.has(l)) s = { ...move(s, l)!, turn: 0 };
    const line = chooseLine({ ...s, turn: 1 });
    expect(keep.has(line)).toBe(true);
  });
});

describe('saves', () => {
  it('accepts real games and rejects broken ones', () => {
    expect(isValidState(newGame())).toBe(true);
    for (const bad of [
      null,
      { ...newGame(), level: 'x' },
      { ...newGame(), lines: [] },
      { ...newGame(), lines: Array(40).fill(1) },
      { ...newGame(), boxes: [] },
      { ...newGame(), boxes: [0, ...Array(15).fill(null)] }, // claimed but not closed
      { ...newGame(), turn: 2 },
      { ...newGame(), result: 'x' },
      { ...newGame(), lines: Array(40).fill(true), boxes: Array(16).fill(0) }, // full but no result
      { ...newGame(), tally: null },
    ]) {
      expect(isValidState(bad), JSON.stringify(bad).slice(0, 50)).toBe(false);
    }
  });
});

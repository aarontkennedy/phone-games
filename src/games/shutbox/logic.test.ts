import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import {
  bestDice,
  bestShut,
  canRollOne,
  expectedScore,
  isShut,
  isValidState,
  newRound,
  roll,
  rollTotal,
  score,
  shut,
  shutOptions,
  shutValue,
  type State,
} from './logic';

/** A round with only these tiles open, after rolling `dice` (or before a roll). */
const at = (open: number[], dice: number[] = []): State => ({
  phase: dice.length ? 'choose' : 'roll',
  open: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => open.includes(n)),
  dice,
});

describe('shut the box', () => {
  it('starts with every tile open, scoring their total, 45', () => {
    const s = newRound();
    expect(score(s)).toBe(45);
    expect(canRollOne(s)).toBe(false);
    expect(isValidState(s)).toBe(true);
  });

  it('rolls two dice, or one once 7, 8 and 9 are shut', () => {
    const s = roll(newRound(), 2, seededRng(1))!;
    expect(s.dice).toHaveLength(2);
    expect(s.phase).toBe('choose');
    expect(rollTotal(s)).toBe(s.dice[0] + s.dice[1]);
    expect(roll(newRound(), 1)).toBeNull(); // 7, 8 and 9 still open
    expect(roll(s, 2)).toBeNull(); // not the time to roll
    const low = at([1, 2, 3]);
    expect(canRollOne(low)).toBe(true);
    expect(roll(low, 1, seededRng(2))!.dice).toHaveLength(1);
  });

  it('shuts open tiles that add up to the roll, and nothing else', () => {
    const s = at([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5]);
    expect(shutOptions(s).map((t) => t.join(' '))).toEqual(expect.arrayContaining(['9', '4 5', '1 3 5', '2 3 4', '1 2 6', '3 6', '2 7', '1 8']));
    const n = shut(s, [4, 5])!;
    expect(n.open).toEqual([true, true, true, false, false, true, true, true, true]);
    expect(n.phase).toBe('roll');
    expect(score(n)).toBe(36);
    expect(shut(s, [4, 4])).toBeNull(); // the same tile twice
    expect(shut(s, [9, 1])).toBeNull(); // adds up to 10
    expect(shut(s, [])).toBeNull();
    expect(shut(n, [9])).toBeNull(); // not after a roll
    expect(shut(at([1, 2], [1, 2]), [3])).toBeNull(); // tile 3 is shut
    expect(shut(at([1, 2], [1, 2]), [10])).toBeNull(); // no such tile
  });

  it('ends the round when no open tiles make the roll, or when every tile is shut', () => {
    expect(roll(at([9]), 2, () => 0)!.phase).toBe('over'); // a roll of 2 can't make 9
    const last = shut(at([3], [1, 2]), [3])!;
    expect(last.phase).toBe('over');
    expect(isShut(last)).toBe(true);
    expect(score(last)).toBe(0);
  });

  it('checks saved games', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...newRound(), phase: 'x' })).toBe(false);
    expect(isValidState({ ...newRound(), open: [true] })).toBe(false);
    expect(isValidState({ ...newRound(), dice: [7] })).toBe(false);
    expect(isValidState({ ...newRound(), phase: 'choose' })).toBe(false); // choosing needs a roll
  });
});

describe('the best play', () => {
  it('knows the average score of a perfectly played round', () => {
    // From all nine tiles, perfect play averages a little under 10.
    expect(expectedScore(newRound())).toBeGreaterThan(8);
    expect(expectedScore(newRound())).toBeLessThan(12);
    expect(expectedScore(at([]))).toBe(0);
  });

  it('shuts the big tiles first (a rules tip)', () => {
    expect(bestShut(at([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5]))).toEqual([9]);
    expect(bestShut(at([1, 2, 3, 4, 5, 6, 7, 8, 9], [3, 4]))).toEqual([7]);
    expect(shutValue(at([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5]), [9])).toBeLessThan(shutValue(at([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5]), [1, 3, 5]));
  });

  it('rolls one die with only small tiles left (a rules tip)', () => {
    expect(bestDice(at([1, 2]))).toBe(1);
    expect(bestDice(at([1, 2, 3]))).toBe(1);
    expect(bestDice(at([5, 6]))).toBe(2); // 11 needs two dice
    expect(bestDice(newRound())).toBe(2); // one die isn't allowed yet
  });
});

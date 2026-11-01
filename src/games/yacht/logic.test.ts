import { describe, expect, it } from 'vitest';
import {
  BOXES,
  basicScore,
  choose,
  earnsYachtBonus,
  isGameOver,
  isValidState,
  newGame,
  openBoxes,
  roll,
  scoreFor,
  toggleHold,
  total,
  turnNumber,
  upperBonus,
  upperTotal,
  type Box,
  type State,
} from './logic';

/** An rng that rolls these faces in order. */
const faces = (...ds: number[]) => () => (ds.shift()! - 1) / 6 + 0.01;
/** A state after one roll showing `dice`. */
const rolled = (dice: number[], o: Partial<State> = {}): State => ({ ...newGame(), dice, rolls: 1, ...o });
const card = (scores: Partial<Record<Box, number>>) => ({ ...newGame().scores, ...scores });

describe('rolling and holding', () => {
  it('rolls all five dice, then only the ones not held, up to three times', () => {
    let s = roll(newGame(), faces(1, 2, 3, 4, 5))!;
    expect(s.dice).toEqual([1, 2, 3, 4, 5]);
    expect(toggleHold(newGame(), 0)).toBeNull(); // nothing to hold before rolling
    s = toggleHold(toggleHold(s, 0)!, 4)!;
    expect(s.held).toEqual([true, false, false, false, true]);
    s = roll(s, faces(6, 6, 6))!;
    expect(s.dice).toEqual([1, 6, 6, 6, 5]);
    s = toggleHold(s, 0)!;
    expect(s.held[0]).toBe(false);
    s = roll(s, faces(2, 2, 2, 2))!;
    expect(s.rolls).toBe(3);
    expect(roll(s)).toBeNull();
    expect(toggleHold(s, 1)).toBeNull();
    expect(toggleHold(rolled([1, 1, 1, 1, 1]), 5)).toBeNull();
  });

  it('ignores holds left over from the last turn on the first roll', () => {
    const s = roll({ ...newGame(), held: [true, true, true, true, true], dice: [0, 0, 0, 0, 0] }, faces(3, 3, 3, 3, 3))!;
    expect(s.dice).toEqual([3, 3, 3, 3, 3]);
  });
});

describe('scoring', () => {
  it.each<[number[], Box, number]>([
    [[3, 3, 3, 1, 2], 'threes', 9],
    [[3, 3, 3, 1, 2], 'sixes', 0],
    [[4, 4, 4, 2, 1], 'three', 15],
    [[4, 4, 2, 2, 1], 'three', 0],
    [[5, 5, 5, 5, 1], 'four', 21],
    [[5, 5, 5, 1, 1], 'four', 0],
    [[2, 2, 3, 3, 3], 'full', 25],
    [[3, 3, 3, 3, 3], 'full', 0],
    [[1, 3, 2, 4, 6], 'small', 30],
    [[3, 4, 5, 6, 6], 'small', 30],
    [[1, 2, 3, 5, 6], 'small', 0],
    [[2, 3, 4, 5, 6], 'large', 40],
    [[1, 2, 3, 4, 6], 'large', 0],
    [[6, 6, 6, 6, 6], 'yacht', 50],
    [[6, 6, 6, 6, 5], 'yacht', 0],
    [[6, 5, 1, 2, 2], 'chance', 16],
  ])('%j in %s scores %i', (dice, box, points) => {
    expect(basicScore(dice, box)).toBe(points);
  });

  it('lets you pick any empty box after rolling, even for 0', () => {
    expect(openBoxes(newGame())).toEqual([]);
    const s = rolled([1, 2, 3, 4, 6], { scores: card({ ones: 1 }) });
    expect(openBoxes(s)).toHaveLength(12);
    expect(choose(s, 'ones')).toBeNull();
    const next = choose(s, 'yacht')!;
    expect(next.scores.yacht).toBe(0);
    expect(next).toMatchObject({ dice: [0, 0, 0, 0, 0], rolls: 0, extraYachts: 0 });
    expect(turnNumber(next)).toBe(3);
  });

  it('adds 35 when the upper boxes reach 63', () => {
    const s = { ...newGame(), scores: card({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18, chance: 20 }) };
    expect(upperTotal(s)).toBe(63);
    expect(upperBonus(s)).toBe(35);
    expect(total(s)).toBe(118);
    expect(upperBonus({ ...s, scores: { ...s.scores, sixes: 12 } })).toBe(0);
  });
});

describe('extra yachts', () => {
  const yachtScored = card({ yacht: 50 });

  it('must go in the matching upper box when it is empty, for 100 extra', () => {
    const s = rolled([4, 4, 4, 4, 4], { scores: yachtScored });
    expect(earnsYachtBonus(s)).toBe(true);
    expect(openBoxes(s)).toEqual(['fours']);
    const next = choose(s, 'fours')!;
    expect(next.scores.fours).toBe(20);
    expect(next.extraYachts).toBe(1);
    expect(total(next)).toBe(170);
  });

  it('then counts as a full house or straight in the lower boxes', () => {
    const s = rolled([4, 4, 4, 4, 4], { scores: { ...yachtScored, fours: 12 } });
    expect(openBoxes(s)).toEqual(['three', 'four', 'full', 'small', 'large', 'chance']);
    expect(scoreFor(s, 'full')).toBe(25);
    expect(scoreFor(s, 'small')).toBe(30);
    expect(scoreFor(s, 'large')).toBe(40);
    expect(scoreFor(s, 'three')).toBe(20);
  });

  it('and scores 0 in an upper box when the lower ones are full', () => {
    const lowerFull = card({ yacht: 50, fours: 12, three: 1, four: 1, full: 25, small: 30, large: 40, chance: 1 });
    const s = rolled([4, 4, 4, 4, 4], { scores: lowerFull });
    expect(openBoxes(s)).toEqual(['ones', 'twos', 'threes', 'fives', 'sixes']);
    expect(scoreFor(s, 'sixes')).toBe(0);
  });

  it('earns no bonus after a 0 in Yacht, but the joker rule still applies', () => {
    const s = rolled([2, 2, 2, 2, 2], { scores: card({ yacht: 0 }) });
    expect(earnsYachtBonus(s)).toBe(false);
    expect(openBoxes(s)).toEqual(['twos']);
    expect(choose(s, 'twos')!.extraYachts).toBe(0);
  });

  it('is a normal roll while Yacht is empty', () => {
    const s = rolled([2, 2, 2, 2, 2]);
    expect(openBoxes(s)).toHaveLength(13);
    expect(scoreFor(s, 'full')).toBe(0);
  });
});

describe('game over and saves', () => {
  it('ends when all 13 boxes are filled', () => {
    let s: State = newGame();
    for (const box of BOXES) s = choose(roll(s, faces(6, 6, 6, 6, 6))!, box)!;
    expect(isGameOver(s)).toBe(true);
    expect(turnNumber(s)).toBe(13);
    expect(roll(s)).toBeNull();
    expect(total(s)).toBeGreaterThan(0);
  });

  it('accepts real saves and rejects broken ones', () => {
    expect(isValidState(newGame())).toBe(true);
    expect(isValidState(rolled([1, 2, 3, 4, 5]))).toBe(true);
    for (const bad of [
      null,
      7,
      { ...newGame(), dice: [1, 2, 3] },
      { ...newGame(), dice: [7, 1, 1, 1, 1], rolls: 1 },
      { ...newGame(), held: [true] },
      { ...newGame(), held: [1, 0, 0, 0, 0] },
      { ...newGame(), rolls: 4 },
      { ...newGame(), rolls: 1 }, // rolled but no dice showing
      rolled([1, 2, 3, 4, 5], { rolls: 0 }),
      { ...newGame(), scores: null },
      { ...newGame(), scores: card({ ones: -1 }) },
      { ...newGame(), scores: { ones: null } },
      { ...newGame(), extraYachts: 1.5 },
    ]) {
      expect(isValidState(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

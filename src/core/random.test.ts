import { describe, expect, it, vi } from 'vitest';
import { randomInt, seededRng, shuffle } from './random';

describe('seededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it('produces different sequences for different seeds', () => {
    expect(seededRng(1)()).not.toBe(seededRng(2)());
  });

  it('stays within [0, 1)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('maps the rng range onto [0, max)', () => {
    expect(randomInt(6, () => 0)).toBe(0);
    expect(randomInt(6, () => 0.9999)).toBe(5);
    expect(randomInt(6, () => 0.5)).toBe(3);
  });

  it('defaults to Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    expect(randomInt(4)).toBe(1);
  });
});

describe('shuffle', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];

  it('returns a permutation without modifying the input', () => {
    const copy = items.slice();
    const out = shuffle(items, seededRng(3));
    expect(items).toEqual(copy);
    expect(out.slice().sort()).toEqual(items);
    expect(out).not.toEqual(items);
  });

  it('is deterministic with a seeded rng', () => {
    expect(shuffle(items, seededRng(9))).toEqual(shuffle(items, seededRng(9)));
  });

  it('handles empty and single-item arrays', () => {
    expect(shuffle([], seededRng(1))).toEqual([]);
    expect(shuffle(['x'], seededRng(1))).toEqual(['x']);
  });

  it('defaults to Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    shuffle(items);
    expect(spy).toHaveBeenCalled();
  });
});

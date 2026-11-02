import { describe, expect, it } from 'vitest';
import {
  CHIPS,
  OUTSIDE,
  START_CHIPS,
  clear,
  colorOf,
  covers,
  isBetId,
  isBroke,
  isValidState,
  newState,
  pays,
  place,
  repeat,
  restart,
  setChip,
  spin,
  total,
  winnings,
  type State,
} from './logic';

/** An rng whose spin lands on `n`. */
const landOn = (n: number) => () => (n + 0.5) / 37;
const betting = (bets: Record<string, number>, o: Partial<State> = {}): State => ({ ...newState(), bets, chips: START_CHIPS - total(bets), ...o });

describe('the wheel and the bets', () => {
  it('colors 18 numbers red, 18 black, and 0 green', () => {
    const colors = Array.from({ length: 37 }, (_, n) => colorOf(n));
    expect(colors.filter((c) => c === 'red')).toHaveLength(18);
    expect(colors.filter((c) => c === 'black')).toHaveLength(18);
    expect(colors[0]).toBe('green');
    expect([colorOf(1), colorOf(2), colorOf(10), colorOf(11), colorOf(19), colorOf(36)]).toEqual(['red', 'black', 'black', 'black', 'red', 'red']);
  });

  it('knows every bet’s numbers: each outside bet covers 18 or 12 numbers, never 0', () => {
    for (const [id, bet] of Object.entries(OUTSIDE)) {
      const hits = Array.from({ length: 37 }, (_, n) => n).filter((n) => covers(id, n));
      expect(hits.length, id).toBe(bet.pays === 1 ? 18 : 12);
      expect(hits, id).not.toContain(0);
    }
    expect(Array.from({ length: 37 }, (_, n) => n).filter((n) => covers('c1', n)).slice(0, 3)).toEqual([1, 4, 7]);
    expect(covers('17', 17)).toBe(true);
    expect(covers('17', 18)).toBe(false);
    expect([pays('0'), pays('red'), pays('d2'), pays('c3')]).toEqual([35, 1, 2, 2]);
  });

  it('gives every bet the same edge: on average it pays back 36 of every 37 chips', () => {
    for (const id of [...Object.keys(OUTSIDE), '0', '17']) {
      const back = Array.from({ length: 37 }, (_, n) => winnings({ [id]: 1 }, n)).reduce((a, b) => a + b, 0);
      expect(back, id).toBe(36);
    }
  });

  it('accepts only real bet names', () => {
    expect(['0', '36', 'red', 'c2', 'd3'].every(isBetId)).toBe(true);
    expect(['37', '07', '-1', 'green', 'x'].some(isBetId)).toBe(false);
  });
});

describe('betting', () => {
  it('puts the chosen chip on a spot, stacking on repeat taps', () => {
    let s = place(newState(), '17')!;
    s = place(s, '17')!;
    s = place(setChip(s, 100)!, 'red')!;
    expect(s.bets).toEqual({ '17': 50, red: 100 });
    expect(s.chips).toBe(START_CHIPS - 150);
    expect(place(s, 'green')).toBeNull();
    expect(place({ ...s, chips: 99 }, 'red')).toBeNull(); // can't cover a 100 chip
    expect(setChip(s, 7)).toBeNull();
  });

  it('clears the table back into your chips', () => {
    const s = clear(betting({ red: 50, '3': 25 }))!;
    expect(s.chips).toBe(START_CHIPS);
    expect(s.bets).toEqual({});
    expect(clear(s)).toBeNull();
  });
});

describe('spinning', () => {
  it('pays winning bets with their stakes, and clears the table', () => {
    const s = spin(betting({ '17': 10, black: 20, red: 30, d2: 10 }), landOn(17))!; // 17 is black, 2nd dozen
    expect(s.history).toEqual([17]);
    expect(s.paid).toBe(10 * 36 + 20 * 2 + 10 * 3);
    expect(s.staked).toBe(70);
    expect(s.chips).toBe(START_CHIPS - 70 + 430);
    expect(s.bets).toEqual({});
    expect(s.lastBets).toEqual({ '17': 10, black: 20, red: 30, d2: 10 });
  });

  it('loses every outside bet on 0', () => {
    const s = spin(betting({ red: 50, black: 50, even: 50, low: 50, d1: 50, c3: 50, '0': 5 }), landOn(0))!;
    expect(s.paid).toBe(5 * 36);
  });

  it('needs a bet to spin, and keeps the last ten numbers', () => {
    expect(spin(newState())).toBeNull();
    let s = newState();
    for (let i = 0; i < 12; i++) s = spin(place(s, 'red')!, landOn(i))!;
    expect(s.history).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  });

  it('repeats the last bets when the table is empty and you can cover them', () => {
    const after = spin(betting({ red: 50, '7': 25 }), landOn(2))!;
    const again = repeat(after)!;
    expect(again.bets).toEqual({ red: 50, '7': 25 });
    expect(again.chips).toBe(after.chips - 75);
    expect(repeat(again)).toBeNull(); // already on the table
    expect(repeat({ ...after, chips: 70 })).toBeNull(); // can't cover it
    expect(repeat(newState())).toBeNull(); // nothing to repeat
  });
});

describe('running out', () => {
  it('is broke only with too few chips and nothing on the table', () => {
    expect(isBroke({ ...newState(), chips: 4 })).toBe(true);
    expect(isBroke({ ...newState(), chips: 4, bets: { red: 5 } })).toBe(false);
    expect(isBroke({ ...newState(), chips: CHIPS[0] })).toBe(false);
    const fresh = restart({ ...newState(), chips: 0, chip: 100, history: [3] });
    expect([fresh.chips, fresh.chip, fresh.history]).toEqual([START_CHIPS, 100, [3]]);
  });
});

describe('isValidState', () => {
  it('accepts tables at every stage, including after saving', () => {
    expect(isValidState(newState())).toBe(true);
    const played = spin(betting({ red: 50 }), landOn(1))!;
    expect(isValidState(JSON.parse(JSON.stringify(played)))).toBe(true);
  });

  it.each([
    ['null', () => null],
    ['negative chips', (s: State) => ({ ...s, chips: -1 })],
    ['odd chip', (s: State) => ({ ...s, chip: 7 })],
    ['unknown bet', (s: State) => ({ ...s, bets: { green: 5 } })],
    ['empty bet', (s: State) => ({ ...s, bets: { red: 0 } })],
    ['bets as a list', (s: State) => ({ ...s, lastBets: [5] })],
    ['number off the wheel', (s: State) => ({ ...s, history: [37] })],
    ['long history', (s: State) => ({ ...s, history: Array(11).fill(1) })],
    ['bad payout', (s: State) => ({ ...s, paid: 1.5 })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(newState()))).toBe(false);
  });
});

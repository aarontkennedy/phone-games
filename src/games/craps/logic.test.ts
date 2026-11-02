import { describe, expect, it } from 'vitest';
import {
  CHIPS,
  START_CHIPS,
  isBroke,
  isValidState,
  newState,
  oddsRoom,
  oddsWin,
  onTable,
  place,
  restart,
  roll,
  setChip,
  settle,
  takeDown,
  type LineBet,
  type State,
} from './logic';

const table = (o: Partial<State> = {}): State => ({ ...newState(), ...o });
const bet = (kind: LineBet['kind'], flat: number, odds = 0, point: number | null = null): LineBet => ({ kind, flat, odds, point });
/** A table with these bets taken from your chips. */
const withBets = (bets: LineBet[], o: Partial<State> = {}): State => {
  const field = o.field ?? 0;
  return table({ bets, chips: START_CHIPS - field - bets.reduce((t, b) => t + b.flat + b.odds, 0), ...o });
};
/** Dice that add up to `t`. */
const dice = (t: number): [number, number] => (t <= 7 ? [1, t - 1] : [6, t - 6]);
const after = (s: State, ...totals: number[]) => totals.reduce((n, t) => settle(n, dice(t)), s);
const chipsOf = (s: State) => s.chips + onTable(s);

describe('the pass line', () => {
  it('wins on 7 or 11 and loses on 2, 3 or 12 on the come-out', () => {
    for (const t of [7, 11]) expect(chipsOf(after(withBets([bet('pass', 10)]), t))).toBe(START_CHIPS + 10);
    for (const t of [2, 3, 12]) expect(chipsOf(after(withBets([bet('pass', 10)]), t))).toBe(START_CHIPS - 10);
  });

  it('sets a point, then wins if it comes again before a 7', () => {
    const on = after(withBets([bet('pass', 10)]), 6);
    expect(on.point).toBe(6);
    expect(on.bets).toEqual([bet('pass', 10)]);
    const won = after(on, 3, 11, 6);
    expect(won.point).toBeNull();
    expect(chipsOf(won)).toBe(START_CHIPS + 10);
    expect(won.outcomes).toEqual([{ name: 'Pass line', net: 10 }]);
    expect(chipsOf(after(on, 7))).toBe(START_CHIPS - 10);
  });

  it('pays odds at true odds: 2 to 1 on 4 and 10, 3 to 2 on 5 and 9, 6 to 5 on 6 and 8', () => {
    expect([4, 5, 6, 8, 9, 10].map((p) => oddsWin('pass', p, 30))).toEqual([60, 45, 36, 36, 45, 60]);
    expect([4, 5, 6].map((p) => oddsWin('dontPass', p, 60))).toEqual([30, 40, 50]);
    expect(oddsWin('pass', 5, 5)).toBe(7); // half chips are rounded down
    const won = after(withBets([bet('pass', 10, 50)], { point: 6 }), 6);
    expect(chipsOf(won)).toBe(START_CHIPS + 10 + 60);
    expect(chipsOf(after(withBets([bet('pass', 10, 50)], { point: 6 }), 7))).toBe(START_CHIPS - 60);
  });
});

describe('don’t pass', () => {
  it('is the pass line backwards, except that 12 on the come-out is a tie', () => {
    for (const t of [2, 3]) expect(chipsOf(after(withBets([bet('dontPass', 10)]), t))).toBe(START_CHIPS + 10);
    for (const t of [7, 11]) expect(chipsOf(after(withBets([bet('dontPass', 10)]), t))).toBe(START_CHIPS - 10);
    const tie = after(withBets([bet('dontPass', 10)]), 12);
    expect(tie.bets).toEqual([bet('dontPass', 10)]);
    expect(tie.outcomes).toEqual([]);
    expect(chipsOf(after(withBets([bet('dontPass', 10, 60)]), 4, 7))).toBe(START_CHIPS + 10 + 30); // lay odds win
    expect(chipsOf(after(withBets([bet('dontPass', 10, 60)]), 4, 4))).toBe(START_CHIPS - 70);
  });
});

describe('come and don’t come', () => {
  it('move to their own number, then win or lose like the pass line', () => {
    const s = after(withBets([bet('come', 10), bet('dontCome', 10)], { point: 6 }), 8);
    expect(s.bets).toEqual([bet('come', 10, 0, 8), bet('dontCome', 10, 0, 8)]);
    expect(s.outcomes).toEqual([
      { name: 'Come', net: 0, moved: 8 },
      { name: 'Don’t come', net: 0, moved: 8 },
    ]);
    const hit = after(s, 8);
    expect(hit.outcomes).toEqual([
      { name: 'Come on 8', net: 10 },
      { name: 'Don’t come on 8', net: -10 },
    ]);
  });

  it('win or lose at once on 7, 11, 2, 3 and 12, with 12 a tie for don’t come', () => {
    expect(chipsOf(after(withBets([bet('come', 10)], { point: 5 }), 11))).toBe(START_CHIPS + 10);
    expect(chipsOf(after(withBets([bet('come', 10)], { point: 5 }), 2))).toBe(START_CHIPS - 10);
    expect(chipsOf(after(withBets([bet('dontCome', 10)], { point: 5 }), 3))).toBe(START_CHIPS + 10);
    expect(after(withBets([bet('dontCome', 10)], { point: 5 }), 12).bets).toEqual([bet('dontCome', 10)]);
  });

  it('keeps odds behind a come bet off on the come-out roll: they come back either way', () => {
    // The point is made with a 5, so the next roll is a come-out; the come bet sits on 6.
    const comeOut = withBets([bet('come', 10, 50, 6)]);
    const won = after(comeOut, 6);
    expect(chipsOf(won)).toBe(START_CHIPS + 10); // flat wins, odds just come back
    expect(won.point).toBe(6); // and the 6 is also the new point
    const lost = after(comeOut, 7);
    expect(chipsOf(lost)).toBe(START_CHIPS - 10);
    expect(lost.outcomes).toEqual([{ name: 'Come on 6', net: -10 }]);
    // During a point, the odds work.
    expect(chipsOf(after(withBets([bet('come', 10, 50, 6)], { point: 9 }), 6))).toBe(START_CHIPS + 70);
  });
});

describe('the field', () => {
  it('pays double on 2, triple on 12, even money on 3, 4, 9, 10 and 11, and loses otherwise', () => {
    const pays = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => chipsOf(after(withBets([], { field: 10 }), t)) - START_CHIPS);
    expect(pays).toEqual([20, 10, 10, -10, -10, -10, -10, 10, 10, 10, 30]);
  });
});

describe('the house edge', () => {
  /** Exact expected net for a one-bet table, by playing out every roll with its chance. */
  function expected(s: State): number {
    let ev = 0;
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++) {
        const n = settle(s, [a, b]);
        const net = chipsOf(n) - chipsOf(s);
        if (onTable(n) === 0 || pointOfBet(n) === null) ev += net / 36; // decided, or a tie
        else {
          // Riding on a number: the rolls that decide it are equally likely to come first
          // in proportion to their chances, so average what they pay.
          let decided = 0;
          let sum = 0;
          for (let c = 1; c <= 6; c++)
            for (let d = 1; d <= 6; d++) {
              const m = settle(n, [c, d]);
              if (onTable(m) < onTable(n)) {
                decided++;
                sum += chipsOf(m) - chipsOf(n);
              }
            }
          ev += (net + sum / decided) / 36;
        }
      }
    return ev;
  }
  const pointOfBet = (s: State) => s.point ?? s.bets[0]?.point ?? null;

  it('matches the published edges: pass 7/495, don’t pass 3/220, field 1/36', () => {
    expect(expected(withBets([bet('pass', 1)]))).toBeCloseTo(-7 / 495, 10);
    expect(expected(withBets([bet('dontPass', 1)]))).toBeCloseTo(-3 / 220, 10); // a 12 counts as a tie
    expect(expected(withBets([], { field: 1 }))).toBeCloseTo(-1 / 36, 10);
  });

  it('gives odds no edge at all', () => {
    for (const p of [4, 5, 6, 8, 9, 10]) {
      const flat = expected(withBets([bet('pass', 10)], { point: p }));
      const withOdds = expected(withBets([bet('pass', 10, 30)], { point: p }));
      expect(withOdds - flat, `odds on ${p}`).toBeCloseTo(0, 10);
    }
  });
});

describe('betting', () => {
  it('takes pass and don’t pass before the come-out, and come bets only during a point', () => {
    let s = place(place(newState(), 'pass')!, 'pass')!;
    expect(s.bets).toEqual([bet('pass', 10)]);
    expect(place(s, 'come')).toBeNull();
    s = after(s, 4);
    expect(place(s, 'pass')).toBeNull();
    s = place(s, 'come')!;
    expect(s.bets[1]).toEqual(bet('come', 5));
    expect(place(s, 'nonsense')).toBeNull();
    expect(place({ ...s, chips: 4 }, 'field')).toBeNull();
    expect(place({ ...s, chips: 4 }, 'dontCome')).toBeNull();
  });

  it('adds odds up to the limit: 3, 4 and 5 times the bet, or 6 times laid against', () => {
    let s = setChip(withBets([bet('pass', 10)], { point: 4 }), 25)!;
    expect(oddsRoom(s, s.bets[0])).toBe(30);
    s = place(place(s, 'odds:pass')!, 'odds:pass')!;
    expect(s.bets[0].odds).toBe(30); // 25, then the last 5
    expect(place(s, 'odds:pass')).toBeNull();
    expect(oddsRoom(withBets([bet('pass', 10)], { point: 6 }), bet('pass', 10))).toBe(50);
    expect(oddsRoom(withBets([bet('dontPass', 10)], { point: 6 }), bet('dontPass', 10))).toBe(60);
    expect(place(withBets([bet('pass', 10)]), 'odds:pass')).toBeNull(); // no point yet
    const come = place(withBets([bet('come', 10, 0, 9)], { point: 5 }), 'odds:9')!;
    expect(come.bets[0].odds).toBe(5);
    expect(place(come, 'odds:8')).toBeNull();
    expect(place({ ...come, chips: 0 }, 'odds:9')).toBeNull();
  });

  it('takes back the field, odds and bets without a number, but not bets riding on one', () => {
    const s = withBets([bet('pass', 10, 20), bet('come', 5), bet('come', 10, 10, 9)], { point: 6, field: 5 });
    const down = takeDown(s)!;
    expect(down.bets).toEqual([bet('pass', 10), bet('come', 10, 0, 9)]);
    expect(down.field).toBe(0);
    expect(down.chips).toBe(s.chips + 5 + 20 + 5 + 10);
    expect(takeDown(down)).toBeNull();
    expect(takeDown(withBets([bet('pass', 10)]))!.bets).toEqual([]); // before the come-out
  });
});

describe('rolling and running out', () => {
  it('rolls two dice from the random source', () => {
    const s = roll(newState(), () => 0.99)!;
    expect(s.dice).toEqual([6, 6]);
  });

  it('is broke only with too few chips and nothing on the table', () => {
    expect(isBroke(table({ chips: 4 }))).toBe(true);
    expect(isBroke(table({ chips: 4, field: 5 }))).toBe(false);
    expect(isBroke(table({ chips: CHIPS[0] }))).toBe(false);
    expect(restart(table({ chips: 0, chip: 100 }))).toEqual({ ...newState(), chip: 100 });
    expect(setChip(newState(), 7)).toBeNull();
  });
});

describe('isValidState', () => {
  it('accepts tables at every stage, including after saving', () => {
    expect(isValidState(newState())).toBe(true);
    const s = after(withBets([bet('pass', 10), bet('dontPass', 5)]), 6);
    expect(isValidState(JSON.parse(JSON.stringify(place(s, 'come'))))).toBe(true);
  });

  it.each([
    ['null', () => null],
    ['negative chips', (s: State) => ({ ...s, chips: -1 })],
    ['odd chip', (s: State) => ({ ...s, chip: 7 })],
    ['a point of 7', (s: State) => ({ ...s, point: 7 })],
    ['an unknown bet', (s: State) => ({ ...s, bets: [{ kind: 'hardways', flat: 5, odds: 0, point: null }] })],
    ['an empty bet', (s: State) => ({ ...s, bets: [bet('pass', 0)] })],
    ['a pass bet with its own number', (s: State) => ({ ...s, bets: [bet('pass', 5, 0, 6)] })],
    ['a seven-sided die', (s: State) => ({ ...s, dice: [7, 1] })],
    ['bad outcomes', (s: State) => ({ ...s, outcomes: 'none' })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(newState()))).toBe(false);
  });
});

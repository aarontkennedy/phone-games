import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { chooseTurn, evaluate, isValidState, legalMoves, move, newGame, newRound, pips, roll, sequences, undoTurn, type State } from './logic';

/** A position from {point: count} (positive yours, negative the computer's), with the rest off. */
function pos(points: Record<number, number>, o: Partial<State> = {}): State {
  const p = Array(24).fill(0);
  for (const [i, n] of Object.entries(points)) p[Number(i)] = n;
  const s = { ...newGame(), points: p, ...o };
  const on = (side: 0 | 1) => s.bar[side] + p.reduce((t, n) => t + (side === 0 ? Math.max(n, 0) : Math.max(-n, 0)), 0);
  return { ...s, off: [15 - on(0), 15 - on(1)] };
}
const rolled = (s: State, dice: number[]) => ({ ...s, dice, lastRoll: dice.slice(0, 2), turnStart: { ...s, dice, lastRoll: dice.slice(0, 2) } });

describe('the start', () => {
  it('sets up 15 checkers each, mirrored, with equal pip counts', () => {
    const s = newGame();
    expect(isValidState(s)).toBe(true);
    expect([pips(s, 0), pips(s, 1)]).toEqual([167, 167]);
    expect(newRound({ ...s, starter: 0 })).toMatchObject({ turn: 1, starter: 1 });
  });

  it('rolls two dice, or four of a kind for doubles', () => {
    const s = roll(newGame(), seededRng(1))!;
    expect(s.lastRoll).toHaveLength(2);
    expect(s.dice).toHaveLength(s.lastRoll[0] === s.lastRoll[1] ? 4 : 2);
    expect(roll(s)).toBeNull(); // already rolled
  });
});

describe('moving', () => {
  it('moves toward home, can’t land on two of theirs, and hits a single one', () => {
    const s = rolled(pos({ 10: 1, 7: -2, 6: -1, 0: -12 }), [3, 4]);
    const moves = legalMoves(s);
    expect(moves.some((m) => m.from === 10 && m.to === 7)).toBe(false); // blocked
    const hit = move(s, { from: 10, to: 6, die: 4 })!;
    expect(hit.points[6]).toBe(1);
    expect(hit.bar[1]).toBe(1);
  });

  it('must bring a checker in from the bar first', () => {
    const s = rolled(pos({ 10: 1, 0: -15 }, { bar: [1, 0] }), [2, 5]);
    expect(legalMoves(s).every((m) => m.from === 'bar')).toBe(true);
    expect(legalMoves(s).map((m) => m.to).sort()).toEqual([19, 22]);
  });

  it('uses both dice when possible, else the larger one', () => {
    // Only the 6 can be played (8 to 2); every 2 is blocked, before and after.
    const s = rolled(pos({ 8: 1, 20: 1, 6: -2, 18: -2, 0: -2, 14: -2, 23: -7 }), [6, 2]);
    expect(sequences(s).every((q) => q.length === 1 && q[0].die === 6)).toBe(true);
    const doubles = rolled(pos({ 20: 1, 0: -15 }), [2, 2, 2, 2]);
    expect(sequences(doubles)[0]).toHaveLength(4);
  });

  it('bears off exactly, or with a bigger die from the farthest checker', () => {
    const s = rolled(pos({ 2: 1, 0: 1, 23: -15 }), [6, 1]);
    const moves = legalMoves(s);
    expect(moves).toContainEqual({ from: 2, to: 'off', die: 6 });
    expect(moves).toContainEqual({ from: 0, to: 'off', die: 1 });
    expect(legalMoves(rolled(pos({ 2: 1, 9: 1, 23: -15 }), [6, 5])).some((m) => m.to === 'off')).toBe(false); // not all home
  });

  it('ends the turn when the dice are used, and Undo takes the turn back', () => {
    const s = rolled(pos({ 10: 2, 0: -15 }), [3, 1]);
    const one = move(s, { from: 10, to: 7, die: 3 })!;
    expect(one.turn).toBe(0);
    expect(undoTurn(one)).toEqual(s.turnStart);
    expect(undoTurn(s)).toBeNull(); // nothing moved yet
    const done = move(one, { from: 10, to: 9, die: 1 })!;
    expect(done.turn).toBe(1);
    expect(move(done, { from: 9, to: 8, die: 1 })).toBeNull();
  });

  it('passes the turn at once when a roll can’t be played', () => {
    // Your only checker is on the bar and every entry point is blocked.
    const blocked = pos({ 18: -2, 19: -2, 20: -2, 21: -2, 22: -2, 23: -2, 0: -3 }, { bar: [1, 0] });
    const s = roll(blocked, seededRng(4))!;
    expect(s.turn).toBe(1);
    expect(s.lastRoll).toHaveLength(2);
  });
});

describe('winning', () => {
  it('wins on the fifteenth checker off, a gammon if the other side has none off', () => {
    // With one checker left, either die bears it off, so the larger (3) must be used.
    const gammon = move(rolled(pos({ 0: 1, 12: -15 }), [1, 3]), { from: 0, to: 'off', die: 3 })!;
    expect(gammon).toMatchObject({ result: 0, gammon: true, tally: { you: 2, computer: 0 } });
    const single = move(rolled(pos({ 0: 1, 23: -14 }), [1, 3]), { from: 0, to: 'off', die: 3 })!;
    expect(single).toMatchObject({ result: 0, gammon: false, tally: { you: 1 } });
    expect(roll(single)).toBeNull();
  });
});

describe('computer player', () => {
  it('Strong hits a blot and keeps its own checkers safe; Easy plays something legal', () => {
    const s = rolled(pos({ 5: 1, 0: 14, 3: -1, 23: -14 }), [2, 1]);
    const me = { ...s, turn: 1 as const };
    const strong = chooseTurn(me);
    expect(strong.some((m) => m.to === 5)).toBe(true); // hits your blot on point 6
    expect(sequences({ ...me, level: 'easy' })).toContainEqual(chooseTurn({ ...me, level: 'easy' }, seededRng(2)));
    expect(evaluate(newGame(), 0)).toBe(evaluate(newGame(), 1));
  });
});

describe('saves', () => {
  it('accepts real games and rejects broken ones', () => {
    expect(isValidState(newGame())).toBe(true);
    for (const bad of [
      null,
      { ...newGame(), level: 'x' },
      { ...newGame(), points: [] },
      { ...newGame(), bar: [1, 0] }, // 16 checkers
      { ...newGame(), dice: [7] },
      { ...newGame(), lastRoll: null },
      { ...newGame(), result: 3 },
      { ...newGame(), tally: null },
      { ...newGame(), turn: 2 },
    ]) {
      expect(isValidState(bad), JSON.stringify(bad).slice(0, 60)).toBe(false);
    }
  });
});

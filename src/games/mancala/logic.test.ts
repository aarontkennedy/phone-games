import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { STORE, choosePit, isValidState, legalPits, move, newGame, newRound, opposite, sow, type State } from './logic';

/** A board from your pits (0-5), your store, the computer's pits (7-12) and its store. */
const board = (you: number[], yourStore: number, them: number[], theirStore: number) => [...you, yourStore, ...them, theirStore];
const state = (b: number[], o: Partial<State> = {}): State => ({ ...newGame(), board: b, ...o });

describe('sowing', () => {
  it('starts with 4 seeds in every pit and empty stores', () => {
    expect(newGame().board).toEqual(board([4, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0));
    expect(legalPits(newGame().board, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(opposite(0)).toBe(12);
    expect(opposite(5)).toBe(7);
  });

  it('drops one seed in each following pit, and the third pit reaches the store for another turn', () => {
    const s = move(newGame(), 2)!;
    expect(s.board).toEqual(board([4, 4, 0, 5, 5, 5], 1, [4, 4, 4, 4, 4, 4], 0));
    expect(s.turn).toBe(0); // ended in the store
    expect(s.last).toEqual({ side: 0, pit: 2, end: 6, captured: 0, again: true });
    const t = move(newGame(), 0)!;
    expect(t.turn).toBe(1);
  });

  it('skips the other store when going all the way round', () => {
    // 13 seeds: your store, their 6 pits, (skip their store), your 6 pits, ending in the
    // emptied pit 5, which then captures the 2 seeds across.
    const r = sow(board([0, 0, 0, 0, 0, 13], 0, [1, 1, 1, 1, 1, 1], 0), 0, 5);
    expect(r.board[STORE[1]]).toBe(0);
    expect(r.end).toBe(5);
    expect(r.captured).toBe(3);
    expect(r.board[STORE[0]]).toBe(4);
  });

  it('captures from an empty pit of yours, if the pit across has seeds', () => {
    const r = sow(board([1, 0, 0, 0, 0, 2], 0, [3, 3, 3, 3, 5, 3], 0), 0, 0);
    expect(r.captured).toBe(6); // the 1 seed and the 5 across
    expect(r.board[1]).toBe(0);
    expect(r.board[11]).toBe(0);
    expect(r.board[STORE[0]]).toBe(6);
    const none = sow(board([1, 0, 0, 0, 0, 2], 0, [3, 3, 3, 3, 0, 3], 0), 0, 0);
    expect(none.captured).toBe(0); // nothing across: no capture
  });

  it('captures for the computer on its own side too', () => {
    const r = sow(board([3, 3, 2, 3, 3, 3], 0, [1, 0, 3, 3, 3, 3], 0), 1, 7);
    expect(r.captured).toBe(4); // lands in empty pit 8, taking your 3 across, plus its own seed
    expect(r.board[STORE[1]]).toBe(4);
  });
});

describe('the end of the game', () => {
  it('ends when a row is empty, sweeping the other row into its store', () => {
    const s = move(state(board([0, 0, 0, 0, 0, 1], 20, [2, 0, 0, 0, 1, 0], 24)), 5)!;
    expect(s.board).toEqual(board([0, 0, 0, 0, 0, 0], 21, [0, 0, 0, 0, 0, 0], 27));
    expect(s.result).toBe(1);
    expect(s.tally).toEqual({ you: 0, computer: 1, draws: 0 });
    expect(move(s, 0)).toBeNull();
  });

  it('can end in a win for you or a draw, and the next round switches who starts', () => {
    const won = move(state(board([0, 0, 0, 0, 0, 1], 30, [1, 0, 0, 0, 0, 0], 16)), 5)!;
    expect(won.result).toBe(0);
    const drawn = move(state(board([0, 0, 0, 0, 0, 1], 23, [1, 0, 0, 0, 0, 0], 23)), 5)!;
    expect(drawn.result).toBe('draw');
    expect(drawn.tally.draws).toBe(1);
    const next = newRound(drawn);
    expect(next).toMatchObject({ result: null, turn: 1, starter: 1, tally: { draws: 1 } });
    expect(newRound(next).starter).toBe(0);
  });

  it('refuses empty pits, the other side’s pits, and moves out of turn', () => {
    const s = newGame();
    expect(move(s, 7)).toBeNull();
    expect(move(s, 6)).toBeNull();
    expect(move({ ...s, board: board([0, 4, 4, 4, 4, 8], 0, [4, 4, 4, 4, 4, 4], 0) }, 0)).toBeNull();
  });
});

describe('computer player', () => {
  it('Strong takes the free turn or the big capture', () => {
    // Pit 9 has 4 seeds: exactly enough to reach its store. No other pit does.
    const s = state(board([4, 4, 4, 4, 4, 4], 0, [1, 1, 4, 1, 1, 2], 0), { turn: 1 });
    expect(choosePit(s)).toBe(9);
  });

  it('Easy plays a legal pit, sometimes the good one', () => {
    const s = state(board([4, 4, 4, 4, 4, 4], 0, [1, 1, 4, 1, 1, 2], 0), { turn: 1, level: 'easy' });
    const picks = new Set(Array.from({ length: 40 }, (_, i) => choosePit(s, seededRng(i))));
    expect([...picks].every((p) => legalPits(s.board, 1).includes(p))).toBe(true);
    expect(picks.has(9)).toBe(true);
    expect(picks.size).toBeGreaterThan(1);
    const plain = state(board([4, 4, 4, 4, 4, 4], 0, [2, 2, 2, 2, 2, 0], 0), { turn: 1, level: 'easy' });
    expect(legalPits(plain.board, 1)).toContain(choosePit(plain, seededRng(1)));
  });

  it('Strong sees a move that ends the game', () => {
    const s = state(board([5, 5, 5, 5, 5, 3], 0, [0, 0, 0, 0, 0, 1], 24), { turn: 1 });
    expect(choosePit(s)).toBe(12);
  });
});

describe('saves', () => {
  it('accepts real saves and rejects broken ones', () => {
    expect(isValidState(newGame())).toBe(true);
    expect(isValidState(move(newGame(), 2))).toBe(true);
    for (const bad of [
      null,
      1,
      { ...newGame(), level: 'hard' },
      { ...newGame(), board: [4, 4] },
      { ...newGame(), board: board([4, 4, 4, 4, 4, 4], 1, [4, 4, 4, 4, 4, 4], 0) }, // 49 seeds
      { ...newGame(), board: board([-1, 5, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0) },
      { ...newGame(), turn: 2 },
      { ...newGame(), starter: 'x' },
      { ...newGame(), result: 'won' },
      { ...newGame(), board: board([0, 0, 0, 0, 0, 0], 24, [4, 4, 4, 4, 4, 4], 0) }, // your turn, no move, not over
      { ...newGame(), last: { side: 3, end: 1 } },
      { ...newGame(), tally: null },
      { ...newGame(), tally: { you: 0, computer: 0 } },
    ]) {
      expect(isValidState(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

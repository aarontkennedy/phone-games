import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { COLS, chooseColumn, drop, evaluate, isValidState, landingRow, lineThrough, newGame, newRound, type Disc, type State } from './logic';

/** Drops discs in these columns, alternating from whoever's turn it is. */
const play = (cols: number[], s: State = newGame()) => cols.reduce((st, c) => drop(st, c)!, s);

describe('four in a row', () => {
  it('drops discs to the lowest empty row', () => {
    const s = play([3, 3]);
    expect(s.board[5 * COLS + 3]).toBe(0);
    expect(s.board[4 * COLS + 3]).toBe(1);
    expect(landingRow(s.board, 3)).toBe(3);
    expect(s.last).toBe(4 * COLS + 3);
  });

  it('refuses full columns, bad columns and finished games', () => {
    const full = play([0, 0, 0, 0, 0, 0]);
    expect(landingRow(full.board, 0)).toBe(-1);
    expect(drop(full, 0)).toBeNull();
    expect(drop(newGame(), 7)).toBeNull();
    expect(drop(newGame(), 1.5)).toBeNull();
    expect(drop({ ...newGame(), result: 'draw' }, 0)).toBeNull();
  });

  it('wins across, down and diagonally', () => {
    const across = play([0, 0, 1, 1, 2, 2, 3]);
    expect(across.result).toBe(0);
    expect(across.line).toEqual([35, 36, 37, 38]);
    expect(across.tally.you).toBe(1);
    expect(play([0, 1, 0, 1, 0, 1, 0]).result).toBe(0);
    // Diagonal up to the right for player 0.
    const diag = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(diag.result).toBe(0);
    expect(lineThrough(diag.board, diag.last!)).toHaveLength(4);
    const lost = play([0, 1, 0, 1, 0, 1, 6, 1]);
    expect(lost.result).toBe(1);
    expect(lost.tally.computer).toBe(1);
    expect(lineThrough(newGame().board, 0)).toBeNull();
  });

  it('calls a full board with no line a draw', () => {
    // Fill columns in a pattern that never makes four.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const s = play(order);
    expect(s.result).toBe('draw');
    expect(s.tally.draws).toBe(1);
  });

  it('starts the next round with the other player', () => {
    const s = newRound(play([0, 0, 1, 1, 2, 2, 3]));
    expect(s.starter).toBe(1);
    expect(s.turn).toBe(1);
    expect(s.tally.you).toBe(1);
    expect(newRound(s).starter).toBe(0);
  });

  it('rates open lines and the middle column', () => {
    const s = play([3, 0, 3]);
    expect(evaluate(s.board, 0)).toBeGreaterThan(evaluate(s.board, 1));
  });

  it('both levels take a win; Strong blocks yours', () => {
    const threat = play([0, 6, 1, 6, 2]); // you have three across the bottom: 3 wins next
    expect(chooseColumn(threat)).toBe(3); // the computer blocks
    const easyWin = play([0, 0, 1, 1, 2], { ...newGame('easy'), turn: 1 });
    expect(chooseColumn(easyWin, seededRng(1))).toBe(3);
    expect(chooseColumn(play([1, 0, 1, 0, 1, 0]))).toBe(1); // win in column 1
  });

  it('Easy plays a legal column', () => {
    const s = { ...newGame('easy'), turn: 1 as Disc };
    const col = chooseColumn(s, seededRng(4));
    expect(landingRow(s.board, col)).toBe(5);
  });

  it('Strong beats a random player', () => {
    let wins = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const rng = seededRng(seed);
      let s = newGame('strong');
      while (!s.result) {
        const open = [0, 1, 2, 3, 4, 5, 6].filter((c) => landingRow(s.board, c) >= 0);
        s = drop(s, s.turn === 1 ? chooseColumn(s) : open[Math.floor(rng() * open.length)])!;
      }
      if (s.result === 1) wins++;
    }
    expect(wins).toBe(4);
  });

  it('validates saved games', () => {
    expect(isValidState(JSON.parse(JSON.stringify(play([3]))))).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...newGame(), board: [] })).toBe(false);
    expect(isValidState({ ...newGame(), turn: 2 })).toBe(false);
    expect(isValidState({ ...newGame(), level: 'x' })).toBe(false);
    expect(isValidState({ ...newGame(), result: 'x' })).toBe(false);
    expect(isValidState({ ...newGame(), tally: {} })).toBe(false);
  });
});

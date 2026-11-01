import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { chooseMove, isValidState, move, newGame, newRound, winningLine, type Mark, type State } from './logic';

/** A board from a string like "XO.X....." (dots are empty). */
const board = (cells: string) => [...cells].map((c) => (c === '.' ? null : (c as Mark)));
const at = (cells: string, o: Partial<State> = {}): State => ({ ...newGame(), board: board(cells), ...o });

describe('tic-tac-toe', () => {
  it('starts empty with you as X', () => {
    const s = newGame('easy');
    expect(s.board.every((c) => c === null)).toBe(true);
    expect(s.turn).toBe('X');
    expect(s.level).toBe('easy');
  });

  it('takes turns and refuses taken cells or a finished game', () => {
    const s = move(newGame(), 4)!;
    expect(s.board[4]).toBe('X');
    expect(s.turn).toBe('O');
    expect(move(s, 4)).toBeNull();
    expect(move(s, 9)).toBeNull();
    expect(move(s, 1.5)).toBeNull();
    expect(move({ ...s, result: 'draw' }, 0)).toBeNull();
  });

  it('finds three in a row and keeps the tally', () => {
    expect(winningLine(board('XXX......'))).toEqual([0, 1, 2]);
    expect(winningLine(board('O...O...O'))).toEqual([0, 4, 8]);
    expect(winningLine(board('XOX......'))).toBeNull();
    const won = move(at('XX.OO....'), 2)!;
    expect(won.result).toBe('X');
    expect(won.line).toEqual([0, 1, 2]);
    expect(won.tally).toEqual({ you: 1, computer: 0, draws: 0 });
    const lost = move(at('XX.OO.X..', { turn: 'O' }), 5)!;
    expect(lost.result).toBe('O');
    expect(lost.tally.computer).toBe(1);
  });

  it('calls a full board with no line a draw', () => {
    const s = move(at('XOXXOOOX.'), 8)!;
    expect(s.result).toBe('draw');
    expect(s.tally.draws).toBe(1);
  });

  it('starts the next round with the other player, keeping the tally', () => {
    const s = newRound({ ...move(at('XX.OO....'), 2)! });
    expect(s.board.every((c) => c === null)).toBe(true);
    expect(s.starter).toBe('O');
    expect(s.turn).toBe('O');
    expect(s.tally.you).toBe(1);
    expect(newRound(s).starter).toBe('X');
  });

  it('both levels take a winning move', () => {
    expect(chooseMove(at('OO.XX.X..', { turn: 'O', level: 'easy' }), seededRng(1))).toBe(2);
    expect(chooseMove(at('OO.XX.X..', { turn: 'O' }))).toBe(2);
  });

  it('Strong blocks your three in a row, and never loses', () => {
    expect(chooseMove(at('XX..O....', { turn: 'O' }))).toBe(2);
    // Every game against a random player: Strong never loses, moving first or second.
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seededRng(seed);
      let s = { ...newGame('strong'), turn: (seed % 2 ? 'X' : 'O') as Mark };
      while (!s.result) {
        const cells = s.board.flatMap((m, i) => (m ? [] : [i]));
        s = move(s, s.turn === 'O' ? chooseMove(s) : cells[Math.floor(rng() * cells.length)])!;
      }
      expect(s.result).not.toBe('X');
    }
  });

  it('Easy plays any empty cell when it can’t win', () => {
    const s = at('X........', { turn: 'O', level: 'easy' });
    const cell = chooseMove(s, seededRng(3));
    expect(s.board[cell]).toBeNull();
  });

  it('validates saved games', () => {
    expect(isValidState(JSON.parse(JSON.stringify(move(newGame(), 0))))).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...newGame(), board: [] })).toBe(false);
    expect(isValidState({ ...newGame(), turn: 'Z' })).toBe(false);
    expect(isValidState({ ...newGame(), result: 'maybe' })).toBe(false);
    expect(isValidState({ ...newGame(), tally: { you: 1 } })).toBe(false);
    expect(isValidState({ ...newGame(), level: 'x' })).toBe(false);
  });
});

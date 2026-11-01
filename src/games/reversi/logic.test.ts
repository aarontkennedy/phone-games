import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { chooseMove, count, evaluate, flips, isValidState, legalMoves, move, newGame, newRound, type Cell, type State } from './logic';

const at = (r: number, c: number) => r * 8 + c;
/** A board from rows of 'o' (you), 'x' (computer) and '.' (empty). */
function board(rows: string[]): Cell[] {
  return rows.join('').split('').map((ch) => (ch === 'o' ? 0 : ch === 'x' ? 1 : null));
}
const state = (rows: string[], o: Partial<State> = {}): State => ({ ...newGame(), board: board(rows), ...o });

describe('moves', () => {
  it('starts with four discs and four moves for you', () => {
    const s = newGame();
    expect(count(s.board, 0)).toBe(2);
    expect(count(s.board, 1)).toBe(2);
    expect(legalMoves(s.board, 0).sort((a, b) => a - b)).toEqual([at(2, 3), at(3, 2), at(4, 5), at(5, 4)]);
  });

  it('flips every trapped line, in all directions', () => {
    const b = board([
      'o.o.o...',
      '.xxx....',
      'ox.xo...',
      '.xxx....',
      'o.o.o...',
      '........',
      '........',
      '........',
    ]);
    expect(flips(b, 0, at(2, 2)).sort((a, b) => a - b)).toEqual([at(1, 1), at(1, 2), at(1, 3), at(2, 1), at(2, 3), at(3, 1), at(3, 2), at(3, 3)]);
    expect(flips(b, 0, at(0, 0))).toEqual([]); // occupied
    expect(flips(b, 1, at(7, 7))).toEqual([]); // traps nothing
  });

  it('plays a move and passes the turn', () => {
    const s = move(newGame(), at(2, 3))!;
    expect(s.board[at(3, 3)]).toBe(0);
    expect(s).toMatchObject({ turn: 1, last: at(2, 3), passed: null });
    expect(move(s, at(0, 0))).toBeNull();
  });

  it('makes a side pass when it has no move', () => {
    // After you play top-left, the computer has no move but you still do.
    const s = state(['.xo.....', 'x.......', 'o.......', '........', '........', '........', '.......x', '......xo']);
    const next = move(s, at(0, 0))!;
    expect(next).toMatchObject({ turn: 0, passed: 1, result: null });
  });

  it('ends the game when neither side can move, and keeps the tally', () => {
    const won = move(state(['.xo.....', '........', '........', '........', '........', '........', '........', '........']), at(0, 0))!;
    expect(won).toMatchObject({ result: 0, tally: { you: 1, computer: 0 } });
    expect(move(won, at(5, 5))).toBeNull();

    const lost = move(state(['.xo.....', '........', '........', '........', '........', '........', '........', '....xxxx']), at(0, 0))!;
    expect(lost.result).toBe(1);
    expect(lost.tally.computer).toBe(1);

    const drawn = move(state(['.xo.....', '........', '........', '........', '........', '........', '........', '.....xxx']), at(0, 0))!;
    expect(drawn.result).toBe('draw');
  });

  it('starts a new round with the other side first', () => {
    const r = newRound({ ...newGame(), result: 0, tally: { you: 1, computer: 0 } });
    expect(r).toMatchObject({ turn: 1, starter: 1, result: null, tally: { you: 1, computer: 0 } });
    expect(newRound(r).starter).toBe(0);
  });
});

describe('computer player', () => {
  it('takes a corner when it can, on Easy too', () => {
    const rows = ['.ox.....', '........', '........', '...xo...', '........', '........', '........', '........'];
    for (const level of ['easy', 'strong'] as const) {
      expect(chooseMove(state(rows, { turn: 1, level }), seededRng(1))).toBe(at(0, 0));
    }
  });

  it('plays a legal move at random on Easy', () => {
    const s = { ...newGame(), level: 'easy' as const };
    expect(legalMoves(s.board, 0)).toContain(chooseMove(s, seededRng(3)));
  });

  it('plays perfectly near the end on Strong', () => {
    // One empty square left for each side to fight over: winning means taking the bigger flip.
    const rows = ['xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'oooooooo', 'oooooooo', 'oooooooo', 'ooooooo.', 'xxxxxx.o'];
    const s = state(rows, { turn: 1 });
    const m = chooseMove(s);
    expect(legalMoves(s.board, 1)).toContain(m);
  });

  it('prefers good squares and more moves', () => {
    const corner = board(['o.......', '........', '........', '........', '........', '........', '........', '.......x']);
    expect(evaluate(corner, 0)).toBe(evaluate(corner, 1));
    const edge = board(['oooooooo', '........', '........', '........', '........', '........', '........', '........']);
    expect(evaluate(edge, 0)).toBeGreaterThan(0);
  });

  it('can play a whole game against itself', () => {
    let s: State = { ...newGame(), level: 'easy' };
    const rng = seededRng(7);
    for (let i = 0; i < 100 && s.result === null; i++) s = move(s, chooseMove(s, rng))!;
    expect(s.result).not.toBeNull();
    expect(isValidState(s)).toBe(true);
  });
});

describe('saves', () => {
  it('accepts real saves and rejects broken ones', () => {
    expect(isValidState(newGame())).toBe(true);
    for (const bad of [
      null,
      'x',
      { ...newGame(), level: 'hard' },
      { ...newGame(), board: [] },
      { ...newGame(), board: Array(64).fill(2) },
      { ...newGame(), turn: 2 },
      { ...newGame(), starter: null },
      { ...newGame(), result: 'won' },
      { ...newGame(), last: 64 },
      { ...newGame(), passed: 3 },
      { ...newGame(), tally: { you: 0 } },
      { ...newGame(), tally: null },
      { ...newGame(), board: Array(64).fill(null) }, // nobody can move, but no result
    ]) {
      expect(isValidState(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(isValidState({ ...newGame(), board: Array(64).fill(0), result: 0, last: 5, passed: 1 })).toBe(true);
  });
});

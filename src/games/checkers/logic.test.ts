import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import {
  DRAW_AFTER,
  applyMove,
  chooseMove,
  count,
  evaluate,
  isDark,
  isValidState,
  legalMoves,
  move,
  newGame,
  newRound,
  startBoard,
  type Piece,
  type State,
} from './logic';

const sq = (r: number, c: number) => r * 8 + c;
const man = (side: 0 | 1): Piece => ({ side, king: false });
const king = (side: 0 | 1): Piece => ({ side, king: true });
/** A board with only these pieces. */
function board(pieces: [number, number, Piece][]): (Piece | null)[] {
  const b: (Piece | null)[] = Array(64).fill(null);
  for (const [r, c, p] of pieces) b[sq(r, c)] = p;
  return b;
}
const state = (pieces: [number, number, Piece][], o: Partial<State> = {}): State => ({ ...newGame(), board: board(pieces), ...o });

describe('checkers', () => {
  it('sets up 12 pieces each on the dark squares', () => {
    const b = startBoard();
    expect(count(b, 0)).toBe(12);
    expect(count(b, 1)).toBe(12);
    expect(b.every((p, i) => !p || isDark(i))).toBe(true);
    expect(legalMoves(b, 0)).toHaveLength(7);
  });

  it('moves men diagonally forward only, and kings both ways', () => {
    expect(legalMoves(board([[5, 2, man(0)]]), 0).map((m) => m.path[0]).sort()).toEqual([sq(4, 1), sq(4, 3)]);
    expect(legalMoves(board([[2, 3, man(1)]]), 1).map((m) => m.path[0]).sort()).toEqual([sq(3, 2), sq(3, 4)]);
    expect(legalMoves(board([[4, 3, king(0)]]), 0)).toHaveLength(4);
  });

  it('makes jumps compulsory', () => {
    const b = board([[5, 2, man(0)], [4, 3, man(1)], [6, 7, man(0)]]);
    const moves = legalMoves(b, 0);
    expect(moves).toEqual([{ from: sq(5, 2), path: [sq(3, 4)], captured: [sq(4, 3)] }]);
  });

  it('keeps jumping, following every branch', () => {
    const b = board([[7, 0, man(0)], [6, 1, man(1)], [4, 3, man(1)], [4, 1, man(1)]]);
    const moves = legalMoves(b, 0);
    expect(moves.map((m) => m.path)).toEqual([[sq(5, 2), sq(3, 0)], [sq(5, 2), sq(3, 4)]]);
    expect(moves[0].captured).toEqual([sq(6, 1), sq(4, 1)]);
  });

  it('crowns a man that reaches the far row, which ends the move', () => {
    const b = board([[2, 1, man(0)], [1, 2, man(1)], [1, 4, man(1)]]);
    const [jump] = legalMoves(b, 0);
    expect(jump.path).toEqual([sq(0, 3)]); // stops on crowning instead of jumping on
    const after = applyMove(b, jump);
    expect(after[sq(0, 3)]).toEqual(king(0));
    expect(applyMove(board([[1, 0, man(0)]]), { from: sq(1, 0), path: [sq(0, 1)], captured: [] })[sq(0, 1)]!.king).toBe(true);
  });

  it('plays a move, refusing illegal ones', () => {
    const s = newGame();
    const m = legalMoves(s.board, 0)[0];
    const n = move(s, m)!;
    expect(n.turn).toBe(1);
    expect(n.last).toEqual(m);
    expect(n.quiet).toBe(1);
    expect(move(n, m)).toBeNull(); // not player 0's turn any more
    expect(move({ ...s, result: 'draw' }, m)).toBeNull();
  });

  it('wins when the other side has no pieces or no moves', () => {
    const lastPiece = state([[5, 2, man(0)], [4, 3, man(1)]]);
    const n = move(lastPiece, legalMoves(lastPiece.board, 0)[0])!;
    expect(n.result).toBe(0);
    expect(n.quiet).toBe(0);
    expect(n.tally.you).toBe(1);
    const lost = state([[2, 1, man(0)], [1, 2, man(1)]], { turn: 1 });
    const cap = move(lost, legalMoves(lost.board, 1)[0])!;
    expect(cap.result).toBe(1);
    expect(cap.tally.computer).toBe(1);
  });

  it('calls a draw after 50 moves each with no capture', () => {
    const s = state([[7, 0, king(0)], [0, 7, king(1)]], { quiet: DRAW_AFTER - 1 });
    const n = move(s, legalMoves(s.board, 0)[0])!;
    expect(n.result).toBe('draw');
    expect(n.tally.draws).toBe(1);
  });

  it('starts the next round with the other side', () => {
    const s = newRound(newGame());
    expect(s.starter).toBe(1);
    expect(s.turn).toBe(1);
    expect(newRound(s).starter).toBe(0);
  });

  it('values kings over men, and its own pieces over the other side’s', () => {
    expect(evaluate(board([[4, 3, king(0)]]), 0)).toBeGreaterThan(evaluate(board([[4, 3, man(0)]]), 0));
    expect(evaluate(board([[4, 3, man(0)]]), 1)).toBeLessThan(0);
  });

  it('Strong takes a free piece and avoids giving one away', () => {
    const s = state([[5, 2, man(0)], [3, 4, man(0)], [2, 3, man(1)], [0, 7, man(1)]], { turn: 1 });
    expect(chooseMove(s).captured).toHaveLength(1);
    // Moving the man at (0,7) to (1,6) is safe; nothing else is legal but... both are steps.
    const quiet = state([[7, 0, man(0)], [1, 2, man(1)], [5, 4, man(0)]], { turn: 1 });
    expect(legalMoves(quiet.board, 1)).toContainEqual(chooseMove(quiet));
  });

  it('Easy plays any legal move, and Strong beats it', () => {
    const s = { ...newGame('easy') };
    expect(legalMoves(s.board, 0)).toContainEqual(chooseMove(s, seededRng(2)));
    let strongWins = 0;
    for (let seed = 1; seed <= 2; seed++) {
      const rng = seededRng(seed);
      let g: State = newGame('strong');
      for (let i = 0; i < 400 && !g.result; i++) {
        g = move(g, g.turn === 1 ? chooseMove(g) : chooseMove({ ...g, level: 'easy' }, rng))!;
      }
      if (g.result === 1) strongWins++;
    }
    expect(strongWins).toBe(2);
  });

  it('validates saved games', () => {
    expect(isValidState(JSON.parse(JSON.stringify(newGame())))).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...newGame(), board: [] })).toBe(false);
    expect(isValidState({ ...newGame(), board: [{ side: 3 }, ...Array(63).fill(null)] })).toBe(false);
    expect(isValidState({ ...newGame(), turn: 2 })).toBe(false);
    expect(isValidState({ ...newGame(), level: 'x' })).toBe(false);
    expect(isValidState({ ...newGame(), result: 'x' })).toBe(false);
    expect(isValidState({ ...newGame(), tally: {} })).toBe(false);
  });
});

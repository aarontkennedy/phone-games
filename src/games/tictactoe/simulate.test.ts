import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { chooseMove, isValidState, move, newGame, newRound, winningLine, type State } from './logic';

describe('Tic-Tac-Toe, many whole rounds', () => {
  it('always ends in a correct win or draw, and Strong never loses', () => {
    const rounds = simulate<State>({
      games: 2000,
      maxSteps: 9,
      start: (_rng, i) => {
        const s = { ...newGame(i % 2 ? 'easy' : 'strong') };
        return i % 4 >= 2 ? newRound(s) : s; // half the rounds, the computer starts
      },
      // X plays at random; O is the computer.
      step: (s, rng) => move(s, s.turn === 'X' ? pick(s.board.flatMap((c, i) => (c ? [] : [i])), rng) : chooseMove(s, rng)),
      isOver: (s) => s.result !== null,
      isValid: isValidState,
      end: (s) => {
        const line = winningLine(s.board);
        if (s.result === 'draw') expect([line, s.board.every(Boolean)]).toEqual([null, true]);
        else expect(s.board[line![0]]).toBe(s.result);
        expect(s.tally.you + s.tally.computer + s.tally.draws).toBe(1);
      },
    });
    expect(rounds.filter((s) => s.level === 'strong' && s.result === 'X')).toEqual([]);
  });
});

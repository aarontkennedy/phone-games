import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { applyTurn, chooseTurn, draw, ends, fullSet, isValidState, legalMoves, newGame, nextRound, pass, pips, play, winner, type State, type Tile } from './logic';

/** A round with these hands and line; the rest of the set is in the boneyard. */
function at(hands: Tile[][], line: Tile[] = [], o: Partial<State> = {}): State {
  const used = [...hands.flat(), ...line];
  const boneyard = fullSet().filter((t) => !used.some((u) => (u[0] === t[0] && u[1] === t[1]) || (u[0] === t[1] && u[1] === t[0])));
  return { ...newGame(), hands, line, boneyard, ...o };
}

describe('dominoes', () => {
  it('has 28 tiles and deals 7 each', () => {
    expect(fullSet()).toHaveLength(28);
    const s = newGame('easy', seededRng(1));
    expect(s.hands.map((h) => h.length)).toEqual([7, 7]);
    expect(s.boneyard).toHaveLength(14);
    expect(s.line).toEqual([]);
    expect(isValidState(s)).toBe(true);
  });

  it('lets the leader play any tile, then matches the open ends', () => {
    const s = at([[[6, 6], [6, 2], [3, 4]], [[1, 1]]]);
    expect(ends(s)).toBeNull();
    expect(legalMoves(s, 0)).toHaveLength(3);
    const n = play(s, 0, { tile: [6, 2], end: 'right' })!;
    expect(ends(n)).toEqual([6, 2]);
    expect(n.turn).toBe(1);
    expect(legalMoves(n, 0)).toEqual([]); // not your turn
  });

  it('turns tiles to fit each end', () => {
    let s = at([[[2, 5], [4, 6], [1, 1]], [[5, 5]]], [[6, 2]]);
    expect(legalMoves(s, 0)).toEqual([{ tile: [2, 5], end: 'right' }, { tile: [4, 6], end: 'left' }]);
    s = play(s, 0, { tile: [4, 6], end: 'left' })!;
    expect(s.line).toEqual([[4, 6], [6, 2]]);
    s = { ...s, turn: 0 };
    s = play(s, 0, { tile: [2, 5], end: 'right' })!;
    expect(s.line).toEqual([[4, 6], [6, 2], [2, 5]]);
    expect(play(s, 0, { tile: [1, 1], end: 'left' })).toBeNull();
  });

  it('draws only when stuck, and passes only when the boneyard is empty', () => {
    const s = at([[[1, 1]], [[5, 5]]], [[6, 2]]);
    expect(pass(s, 0)).toBeNull();
    const n = draw(s, 0)!;
    expect(n.hands[0]).toHaveLength(2);
    expect(n.missing[0]).toEqual([6, 2]);
    expect(draw(at([[[6, 1]], [[5, 5]]], [[6, 2]]), 0)).toBeNull();
    const dry = { ...s, boneyard: [] as Tile[] };
    expect(draw(dry, 0)).toBeNull();
    expect(pass(dry, 0)!.turn).toBe(1);
  });

  it('scores the other hand’s pips when a player goes out', () => {
    const s = play(at([[[6, 2]], [[5, 5], [3, 1]]], [[2, 2]]), 0, { tile: [6, 2], end: 'right' })!;
    expect(s.phase).toBe('roundOver');
    expect(s.last).toEqual({ winner: 0, points: 14, blocked: false });
    expect(s.scores).toEqual([14, 0]);
    const next = nextRound(s, seededRng(2))!;
    expect(next.turn).toBe(0);
    expect(nextRound(next)).toBeNull();
  });

  it('ends a blocked round in favor of the lower pip total', () => {
    const blocked = (mine: Tile[], theirs: Tile[]) => {
      let s = { ...at([mine, theirs], [[6, 2]]), boneyard: [] as Tile[] };
      s = pass(s, 0)!;
      return pass(s, 1)!;
    };
    expect(blocked([[1, 1]], [[5, 5]]).last).toEqual({ winner: 0, points: 10, blocked: true });
    expect(blocked([[5, 5]], [[1, 0]]).last).toEqual({ winner: 1, points: 10, blocked: true });
    const tie = blocked([[3, 1]], [[4, 0]]);
    expect(tie.last).toEqual({ winner: null, points: 0, blocked: true });
    expect(nextRound(tie, seededRng(1))!.turn).toBe(1);
  });

  it('ends the game at 100', () => {
    const s = play(at([[[6, 2]], [[5, 5]]], [[2, 2]], { scores: [95, 0] }), 0, { tile: [6, 2], end: 'right' })!;
    expect(s.phase).toBe('gameOver');
    expect(winner(s)).toBe(0);
    expect(winner(at([[], []]))).toBeNull();
    expect(pips([[6, 6], [1, 0]])).toBe(13);
  });

  it('Strong plays heavy tiles and doubles, and leaves ends you can’t match', () => {
    expect(chooseTurn(at([[[0, 0]], [[6, 6], [6, 1], [1, 1]]], [], { turn: 1 }), 1)).toEqual({ action: 'play', move: { tile: [6, 6], end: 'right' } });
    const s = at([[[0, 0]], [[2, 3], [2, 4]]], [[2, 2]], { turn: 1, missing: [[3], []] });
    expect(chooseTurn(s, 1)).toEqual({ action: 'play', move: { tile: [2, 3], end: 'left' } });
    expect(chooseTurn(at([[[0, 0]], [[1, 1]]], [[6, 2]], { turn: 1 }), 1)).toEqual({ action: 'draw' });
    expect(chooseTurn({ ...at([[[0, 0]], [[1, 1]]], [[6, 2]], { turn: 1 }), boneyard: [] }, 1)).toEqual({ action: 'pass' });
  });

  it('Easy plays any tile that fits', () => {
    const s = { ...at([[[0, 0]], [[2, 3], [2, 4]]], [[2, 2]], { turn: 1 }), level: 'easy' as const };
    expect(applyTurn(s, 1, chooseTurn(s, 1, seededRng(1)))).not.toBeNull();
  });

  it.each(['easy', 'strong'] as const)('%s players finish whole games', (level) => {
    for (let seed = 1; seed <= 5; seed++) {
      const rng = seededRng(seed);
      let s = newGame(level, rng);
      for (let steps = 0; s.phase !== 'gameOver'; steps++) {
        s = s.phase === 'roundOver' ? nextRound(s, rng)! : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng))!;
        expect(s).not.toBeNull();
        expect(steps).toBeLessThan(20000);
      }
      expect(isValidState(s)).toBe(true);
    }
  });

  it('validates saved games', () => {
    const s = newGame('strong', seededRng(3));
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...s, level: 'x' })).toBe(false);
    expect(isValidState({ ...s, boneyard: s.boneyard.slice(1) })).toBe(false);
    expect(isValidState({ ...s, line: [[7, 7]] })).toBe(false);
    expect(isValidState({ ...s, scores: [1] })).toBe(false);
  });
});

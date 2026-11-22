import { describe, expect, it } from 'vitest';
import { GOAL, best, bestIsHold, chooseComputer, computerStep, endBust, hold, isValidState, newGame, roll, type State } from './logic';
import { FIRST_PLAYER_WINS } from './policy';

/** The roll a seeded random number gives: randomInt(6) + 1. */
const die = (face: number) => () => (face - 1) / 6 + 0.01;
const at = (o: Partial<State>): State => ({ ...newGame(), ...o });

describe('pig', () => {
  it('adds rolls to the turn, and a 1 loses them', () => {
    let s = roll(newGame(), die(5))!;
    expect(s.turnPoints).toBe(5);
    s = roll(s, die(6))!;
    expect(s.turnPoints).toBe(11);
    const bust = roll(s, die(1))!;
    expect(bust.bust).toBe(true);
    expect(bust.turnPoints).toBe(0);
    expect(roll(bust)).toBeNull();
    expect(hold(bust)).toBeNull();
    const next = endBust(bust)!;
    expect(next.turn).toBe(1);
    expect(next.scores).toEqual([0, 0]);
    expect(endBust(next)).toBeNull();
  });

  it('banks a turn with Hold, and wins at 100', () => {
    const s = hold(at({ turnPoints: 12 }))!;
    expect(s.scores).toEqual([12, 0]);
    expect(s.turn).toBe(1);
    expect(hold(newGame())).toBeNull(); // nothing to bank
    const won = hold(at({ scores: [95, 40], turnPoints: 6 }))!;
    expect(won.winner).toBe(0);
    expect(roll(won)).toBeNull();
  });

  it('plays to win: about 20 early, longer behind, sooner ahead, and always when holding wins', () => {
    expect(FIRST_PLAYER_WINS).toBeCloseTo(0.5306, 4); // Neller and Presser's figure
    expect(bestIsHold(0, 0, 0)).toBe(false); // nothing to hold yet
    expect(bestIsHold(0, 0, 19)).toBe(false);
    expect(bestIsHold(0, 0, 21)).toBe(true);
    expect(bestIsHold(0, 50, 25)).toBe(false); // behind: roll on
    expect(bestIsHold(50, 0, 16)).toBe(true); // ahead: hold sooner
    expect(bestIsHold(96, 0, 4)).toBe(true); // holding wins
    expect(best(at({ turnPoints: 22 }))).toBe('hold');
    expect(best(at({ turn: 1, scores: [50, 0], turnPoints: 22 }))).toBe('roll'); // the computer is behind
  });

  it('plays the computer: Strong by the table, Easy by a loose total', () => {
    expect(chooseComputer(at({ turn: 1, turnPoints: 22 }))).toBe('hold');
    expect(chooseComputer(at({ level: 'easy', turn: 1, turnPoints: 10 }), () => 0)).toBe('roll');
    expect(chooseComputer(at({ level: 'easy', turn: 1, turnPoints: 26 }), () => 0.99)).toBe('hold');
    expect(chooseComputer(at({ level: 'easy', turn: 1, scores: [0, 98], turnPoints: 2 }))).toBe('hold');
    expect(computerStep(at({ turn: 1, turnPoints: 22 }))!.scores).toEqual([0, 22]);
    expect(computerStep(at({ turn: 1, turnPoints: 3 }), die(4))!.turnPoints).toBe(7);
    expect(computerStep(at({ turn: 1, bust: true, roll: 1 }))!.turn).toBe(0);
    expect(GOAL).toBe(100);
  });

  it('checks saved games', () => {
    expect(isValidState(newGame())).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...newGame(), level: 'x' })).toBe(false);
    expect(isValidState({ ...newGame(), roll: 7 })).toBe(false);
    expect(isValidState({ ...newGame(), scores: [-1, 0] })).toBe(false);
  });
});

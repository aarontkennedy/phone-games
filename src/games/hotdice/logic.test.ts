import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { bank, bestChoice, bestKeep, canScore, choiceValue, chooseKeep, computerStep, endBust, isValidState, isBestChoice, keep, newGame, roll, rollValue, scoreDice, shouldBank, winner, type State } from './logic';

const at = (o: Partial<State>): State => ({ ...newGame(), ...o });

describe('hot dice scoring', () => {
  it.each([
    [[1], 100],
    [[5], 50],
    [[1, 1, 5], 250],
    [[2, 2, 2], 200],
    [[1, 1, 1], 1000],
    [[1, 1, 1, 1], 1100], // three 1s and a 1 beats four of a kind
    [[3, 3, 3, 3], 1000],
    [[4, 4, 4, 4, 4], 2000],
    [[6, 6, 6, 6, 6, 6], 3000],
    [[1, 2, 3, 4, 5, 6], 1500],
    [[2, 2, 3, 3, 6, 6], 1500],
    [[5, 5, 5, 1], 600],
  ])('%j scores %i', (dice, points) => {
    expect(scoreDice(dice)).toBe(points);
  });

  it('refuses dice that don’t score', () => {
    expect(scoreDice([])).toBeNull();
    expect(scoreDice([2])).toBeNull();
    expect(scoreDice([1, 3])).toBeNull();
    expect(scoreDice([2, 2])).toBeNull();
  });

  it('finds the best dice to keep', () => {
    expect(bestKeep([1, 3, 4, 2, 6, 6])).toEqual([0]);
    expect(bestKeep([2, 3, 4, 6, 6, 3])).toEqual([]);
    expect(canScore([2, 3, 4, 6, 6, 3])).toBe(false);
    expect(bestKeep([5, 5, 5, 2, 3, 1]).sort()).toEqual([0, 1, 2, 5]);
  });
});

describe('a turn', () => {
  it('rolls six dice, then the number left', () => {
    const s = roll(newGame(), seededRng(1))!;
    expect(s.dice).toHaveLength(6);
    expect(roll(s)).toBeNull(); // choose first
    expect(roll(at({ remaining: 2 }), seededRng(1))!.dice).toHaveLength(2);
  });

  it('busts when nothing scores', () => {
    const rng = () => 1 / 6 + 0.01; // every die a 2
    const s = roll(at({ remaining: 2, turnPoints: 400 }), rng)!;
    expect(s.phase).toBe('bust');
    const n = endBust(s)!;
    expect(n.turn).toBe(1);
    expect(n.turnPoints).toBe(0);
    expect(n.scores).toEqual([0, 0]);
    expect(endBust(n)).toBeNull();
  });

  it('keeps scoring dice and adds them to the turn', () => {
    const s = at({ phase: 'choose', dice: [1, 5, 2, 3, 4, 6] });
    expect(keep(s, [2])).toBeNull(); // a 2 doesn't score
    expect(keep(s, [0, 0])).toBeNull();
    expect(keep(s, [9])).toBeNull();
    expect(keep({ ...s, phase: 'roll' }, [0])).toBeNull();
    const n = keep(s, [0, 1])!;
    expect(n.turnPoints).toBe(150);
    expect(n.kept).toEqual([1, 5]);
    expect(n.remaining).toBe(4);
    expect(n.phase).toBe('roll');
  });

  it('gives all six dice back after keeping them all', () => {
    const n = keep(at({ phase: 'choose', dice: [5], remaining: 1, kept: [1, 1, 1, 5, 5], turnPoints: 1100 }), [0])!;
    expect(n.remaining).toBe(6);
    expect(n.kept).toEqual([]);
    expect(n.turnPoints).toBe(1150);
  });

  it('banks the turn, passes the dice, and wins at 10,000', () => {
    expect(bank(newGame())).toBeNull(); // nothing to bank
    const n = bank(at({ turnPoints: 500, remaining: 3 }))!;
    expect(n.scores).toEqual([500, 0]);
    expect(n.turn).toBe(1);
    const won = bank(at({ turnPoints: 600, scores: [9500, 2000] }))!;
    expect(won.phase).toBe('gameOver');
    expect(winner(won)).toBe(0);
    expect(winner(n)).toBeNull();
  });
});

describe('computer player', () => {
  it('banks at sensible totals, and always when it wins', () => {
    expect(shouldBank(at({ turnPoints: 0 }))).toBe(false);
    expect(shouldBank(at({ turnPoints: 350, remaining: 2 }))).toBe(true);
    expect(shouldBank(at({ turnPoints: 350, remaining: 4 }))).toBe(false);
    expect(shouldBank(at({ turnPoints: 1500, remaining: 6 }))).toBe(false);
    expect(shouldBank(at({ turnPoints: 100, remaining: 6, scores: [9950, 0] }))).toBe(true);
    expect(shouldBank(at({ level: 'easy', turnPoints: 50, remaining: 2 }))).toBe(true);
  });

  it('Strong keeps one loose 1 to roll more dice; otherwise keeps every scoring die', () => {
    expect(chooseKeep(at({ phase: 'choose', dice: [1, 5, 1, 2, 3, 4] }))).toEqual([0]);
    expect(chooseKeep(at({ phase: 'choose', dice: [5, 5, 2, 3, 4, 6] }))).toEqual([0]);
    expect(chooseKeep(at({ phase: 'choose', dice: [1, 1, 1, 2, 3, 4] })).sort()).toEqual([0, 1, 2]);
    expect(chooseKeep(at({ phase: 'choose', dice: [1, 5], remaining: 2 })).sort()).toEqual([0, 1]);
    expect(chooseKeep(at({ level: 'easy', phase: 'choose', dice: [1, 5, 1, 2, 3, 4] })).sort()).toEqual([0, 1, 2]);
  });

  it.each(['easy', 'strong'] as const)('%s plays whole games to the end', (level) => {
    for (let seed = 1; seed <= 5; seed++) {
      const rng = seededRng(seed);
      let s = newGame(level);
      for (let steps = 0; s.phase !== 'gameOver'; steps++) {
        s = computerStep(s, rng)!;
        expect(s).not.toBeNull();
        expect(steps).toBeLessThan(50000);
      }
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(10000);
      expect(isValidState(s)).toBe(true);
    }
  });

  it('validates saved games', () => {
    expect(isValidState(newGame())).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...newGame(), dice: [7] })).toBe(false);
    expect(isValidState({ ...newGame(), remaining: 0 })).toBe(false);
    expect(isValidState({ ...newGame(), phase: 'x' })).toBe(false);
    expect(isValidState({ ...newGame(), turn: 2 })).toBe(false);
    expect(isValidState({ ...newGame(), level: 'x' })).toBe(false);
  });
});

describe('the best play', () => {
  const at = (o: Partial<State>): State => ({ ...newGame(), phase: 'choose', ...o });


  it('knows what rolling on is worth, and when to bank', () => {
    // A whole turn, played perfectly, scores about 583 on average.
    expect(rollValue(6, 0)).toBeGreaterThan(550);
    expect(rollValue(6, 0)).toBeLessThan(620);
    // With 2 dice left, 250 is worth banking; 200 is worth rolling for.
    expect(rollValue(2, 250)).toBeLessThan(250);
    expect(rollValue(2, 200)).toBeGreaterThan(200);
    // Six fresh dice are almost always worth rolling.
    expect(rollValue(6, 5000)).toBeGreaterThan(5000);
    expect(rollValue(6, 40_000)).toBe(0);
  });

  it('picks the keep, then roll or bank, that scores most', () => {
    expect(bestChoice(at({ dice: [1, 5, 3, 3, 4, 2], remaining: 6 }))).toMatchObject({ keep: [0], then: 'roll' });
    expect(bestChoice(at({ dice: [1, 5, 3], remaining: 3, turnPoints: 350 }))).toMatchObject({ keep: [0, 1], then: 'bank', value: 500 });
    // All six score: keep them all and roll six fresh dice.
    expect(bestChoice(at({ dice: [1, 2, 3, 4, 5, 6], remaining: 6 }))).toMatchObject({ keep: [0, 1, 2, 3, 4, 5], then: 'roll' });
    // Banking that wins the game beats everything.
    const win = at({ dice: [1, 2, 3, 4, 6, 6], remaining: 6, turnPoints: 0, scores: [9950, 0] });
    expect(bestChoice(win)).toMatchObject({ keep: [0], then: 'bank', value: Infinity });
    expect(choiceValue(win, [1], 'roll')).toBeLessThan(Infinity);
  });

  it('banks from the totals the rules give', () => {
    // src/games/index.ts, Hot Dice tips: bank once the turn has this much, by dice left.
    const bankFrom = (dice: number) => {
      let t = 50;
      while (rollValue(dice, t) > t) t += 50;
      return t;
    };
    expect([1, 2, 3, 4, 5].map(bankFrom)).toEqual([350, 250, 450, 1050, 3100]);
    // And it's one switch: rolling is better below those, banking at and above.
    for (const [dice, from] of [[1, 350], [2, 250], [3, 450], [4, 1050], [5, 3100]]) {
      for (let t = 50; t < 5000; t += 50) expect(rollValue(dice, t) > t).toBe(t < from);
    }
  });

  it('counts ties as right', () => {
    const s = at({ dice: [1, 5, 3, 3, 4, 2], remaining: 6 });
    expect(isBestChoice(s, [1], 'roll')).toBe(true);
    expect(isBestChoice(s, [1, 5], 'bank')).toBe(false);
  });
});

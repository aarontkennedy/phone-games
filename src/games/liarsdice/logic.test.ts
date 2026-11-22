import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { CALL_BELOW, DICE, advice, atLeast, bid, call, chance, computerMove, isHigher, isValidState, lowestOn, newGame, nextRound, safestBid, totalDice, type State } from './logic';

const table = (dice: number[][], o: Partial<State> = {}): State => ({ level: 'strong', dice, turn: 0, bid: null, reveal: null, winner: null, ...o });

describe('liar’s dice', () => {
  it('deals five dice each', () => {
    const s = newGame('strong', seededRng(1));
    expect(s.dice.map((d) => d.length)).toEqual([DICE, DICE, DICE]);
    expect(totalDice(s)).toBe(15);
    expect(isValidState(s)).toBe(true);
  });

  it('only takes higher bids: more dice, or the same number of a higher face', () => {
    let s = table([[1, 2, 3], [4, 5], [6]]);
    expect(isHigher(s, 7, 2)).toBe(false); // more dice than the table holds
    expect(isHigher(s, 0, 2)).toBe(false);
    expect(isHigher(s, 2, 7)).toBe(false);
    s = bid(s, 0, 2, 4)!;
    expect(s.bid).toEqual({ qty: 2, face: 4, by: 0 });
    expect(s.turn).toBe(1);
    expect(isHigher(s, 2, 3)).toBe(false);
    expect(isHigher(s, 2, 5)).toBe(true);
    expect(isHigher(s, 3, 1)).toBe(true);
    expect(lowestOn(s, 5)).toBe(2);
    expect(lowestOn(s, 4)).toBe(3);
    expect(bid(s, 0, 3, 4)).toBeNull(); // not your turn
    expect(bid(s, 1, 2, 3)).toBeNull(); // not higher
  });

  it('calls a bid: a true bid costs the caller a die, a false one the bidder', () => {
    const s = bid(table([[5, 5, 1], [5, 2], [3]]), 0, 3, 5)!;
    const right = call(s, 1)!;
    expect(right.reveal).toEqual({ bid: { qty: 3, face: 5, by: 0 }, caller: 1, actual: 3, loser: 1 });
    const lie = call(bid(table([[5, 1, 1], [5, 2], [3]]), 0, 3, 5)!, 1)!;
    expect(lie.reveal!.loser).toBe(0);
    expect(call(table([[1], [2], [3]]), 0)).toBeNull(); // nothing to call
    expect(call(right, 1)).toBeNull(); // already called
  });

  it('takes the die off, and the loser starts the next round; the last with dice wins', () => {
    const s = call(bid(table([[5, 1, 1], [5, 2], [3]]), 0, 3, 5)!, 1)!;
    const n = nextRound(s, seededRng(2))!;
    expect(n.dice.map((d) => d.length)).toEqual([2, 2, 1]);
    expect(n.turn).toBe(0);
    expect(n.bid).toBeNull();
    expect(nextRound(n)).toBeNull(); // no call yet
    // East's last die: East is out, and the next player starts.
    const out = nextRound(call(bid(table([[5], [5], [2]], { turn: 2 }), 2, 2, 2)!, 0)!)!; // two 2s: a lie
    expect(out.dice[2]).toEqual([]);
    expect(out.turn).toBe(0);
    // One player left: they win.
    const won = nextRound(call(bid(table([[5], [], [2]], { turn: 2 }), 2, 2, 2)!, 0)!)!;
    expect(won.winner).toBe(0);
    expect(bid(won, 0, 1, 1)).toBeNull();
  });

  it('works out the odds from your own dice', () => {
    expect(atLeast(0, 10)).toBe(1);
    expect(atLeast(1, 1)).toBeCloseTo(1 / 6, 9);
    expect(atLeast(2, 2)).toBeCloseTo(1 / 36, 9);
    const s = table([[5, 5, 1, 2, 3], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]]);
    expect(chance(s, 0, 2, 5)).toBe(1); // you hold two 5s
    expect(chance(s, 0, 3, 5)).toBeCloseTo(atLeast(1, 10), 9);
    expect(safestBid(s, 0)).toMatchObject({ qty: 1, chance: 1 });
  });

  it('advises calling an unlikely bid, and the safest raise otherwise', () => {
    const s = bid(table([[1, 2, 3, 4, 6], [5, 5, 5, 5, 5], [5, 5, 5, 5, 5]], { turn: 1 }), 1, 9, 5)!;
    // Nine 5s, and you hold none: very unlikely to you.
    const a = advice({ ...s, turn: 0 }, 0);
    expect(a.call).toBe(true);
    expect(a.chance).toBeLessThan(CALL_BELOW);
    const open = advice(table([[6, 6, 6, 1, 2], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]]), 0);
    expect(open).toMatchObject({ call: false, face: 6 });
  });

  it('plays the computer players by the odds, or loosely on Easy', () => {
    const strong = computerMove(bid(table([[1, 2, 3, 4, 6], [5, 5, 1, 2, 3], [4, 4, 4, 4, 4]]), 0, 10, 5)!, seededRng(3))!;
    expect(strong.reveal).not.toBeNull(); // ten 5s: West calls
    const opening = computerMove(table([[1, 2], [5, 5, 5], [2, 3]], { turn: 1 }), () => 0.9)!;
    expect(opening.bid).toMatchObject({ by: 1, face: 5 });
    const bluff = computerMove(table([[1, 2], [5, 5, 5], [2, 3]], { turn: 1 }), () => 0.01)!;
    expect(bluff.bid).toMatchObject({ by: 1, qty: 2, face: 5 }); // one more than it needs
    const easy = computerMove(table([[1], [2, 3], [4]], { level: 'easy', turn: 1 }), seededRng(4))!;
    expect(easy.bid?.by).toBe(1);
    const easyCall = computerMove(bid(table([[1], [2, 3], [4]], { level: 'easy' }), 0, 4, 6)!, () => 0.1)!;
    expect(easyCall.reveal).not.toBeNull();
    expect(computerMove(table([[1], [2], [3]]))).toBeNull(); // your turn
  });

  it('checks saved games', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState(table([[7], [1], [1]]))).toBe(false);
    expect(isValidState(table([[1], [1]]))).toBe(false);
    expect(isValidState(table([[1], [1], [1]], { turn: 3 as 0 }))).toBe(false);
  });
});

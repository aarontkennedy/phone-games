import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import { makePots } from '../../core/betting';
import { act, betSize, bigBlind, chooseAction, equity, isValidState, newGame, nextHand, options, pot, raiseCost, toCall, winner, type State } from './logic';
import { cards, table } from './test-fixtures';

describe("hold'em hands", () => {
  it('deals two cards each and posts the blinds', () => {
    const s = newGame('strong', seededRng(1));
    expect(s.dealer).toBe(0);
    expect(s.hole.every((h) => h.length === 2)).toBe(true);
    expect(s.bets).toEqual([0, 5, 10, 0]); // West small blind, North big blind
    expect(s.said).toEqual(['', 'Small blind', 'Big blind', '']);
    expect(s.turn).toBe(3); // East is first to act
    expect(pot(s)).toBe(15);
    expect(isFullDeck([...s.hole.flat(), ...s.deck])).toBe(true);
    expect(isValidState(s)).toBe(true);
    expect(nextHand(s)).toBeNull(); // not until this hand is over
  });

  it('raises blinds every 10 hands, and bets double after the flop and turn', () => {
    expect([1, 10, 11, 21].map(bigBlind)).toEqual([10, 10, 20, 40]);
    expect(betSize(table(['AS AH', 'KS KH', '', ''], ''))).toBe(10);
    expect(betSize(table(['AS AH', 'KS KH', '', ''], '2C 3C 4C'))).toBe(10);
    expect(betSize(table(['AS AH', 'KS KH', '', ''], '2C 3C 4C 5D'))).toBe(20);
  });

  it('offers check or bet with nothing to call, and call, raise or fold against a bet', () => {
    const s = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C');
    expect(options(s, 0)).toEqual(['check', 'bet']);
    expect(options(s, 1)).toEqual([]); // not West's turn
    const bet = act(s, 0, 'bet')!;
    expect(bet.bets[0]).toBe(10);
    expect(bet.turn).toBe(1);
    expect(toCall(bet, 1)).toBe(10);
    expect(options(bet, 1)).toEqual(['fold', 'call', 'raise']);
    expect(raiseCost(bet, 1)).toBe(20);
    const raised = act(bet, 1, 'raise')!;
    expect(raised.toAct).toEqual([true, false, false, false]);
    expect(raised.said).toEqual(['Bet', 'Raise', '', '']);
    expect(act(raised, 0, 'check')).toBeNull();
  });

  it('caps a round at four bets', () => {
    const s = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C', { raises: 4, bets: [40, 30, 0, 0], turn: 1 });
    expect(options(s, 1)).toEqual(['fold', 'call']);
  });

  it('deals the next street when the round is done, and shows down after the river', () => {
    let s = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C 8D', {}, '9H JD');
    s = act(act(s, 0, 'check')!, 1, 'check')!;
    expect(s.board).toEqual(cards('2C 3C 4C 8D JD'));
    expect(s.street).toBe(3);
    expect(s.turn).toBe(0);
    s = act(act(s, 0, 'check')!, 1, 'check')!;
    expect(s.phase).toBe('handOver');
    expect(s.shown).toBe(true);
    expect(s.pots).toEqual([{ amount: 0, eligible: [0, 1], winners: [0] }].filter((p) => p.amount)); // no chips bet
  });

  it('pays the best hand at a showdown, and splits ties', () => {
    const s = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C 8D 9H', { stacks: [990, 990, 1010, 1010], put: [10, 10, 0, 0] });
    const shown = act(act(s, 0, 'check')!, 1, 'check')!;
    expect(shown.pots).toEqual([{ amount: 20, eligible: [0, 1], winners: [0] }]);
    expect(shown.stacks).toEqual([1010, 990, 1010, 1010]);
    // North folded after putting in 5, so 25 is split two ways.
    const tie = table(['AS 7H', 'AD 7C', '', ''], 'KC QC JD 10D 2S', { stacks: [990, 990, 995, 1015], put: [10, 10, 5, 0] });
    const split = act(act(tie, 0, 'check')!, 1, 'check')!;
    expect(split.pots).toEqual([{ amount: 25, eligible: [0, 1], winners: [0, 1] }]);
    expect(split.stacks).toEqual([1003, 1002, 995, 1015]); // the odd chip goes first left of the dealer: you
    // Chips nobody matched come back.
    const over = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C 8D 9H', { stacks: [985, 990, 1010, 1015], put: [15, 10, 0, 0] });
    expect(act(act(over, 0, 'check')!, 1, 'check')!.pots).toEqual([
      { amount: 20, eligible: [0, 1], winners: [0] },
      { amount: 5, eligible: [0], winners: [0] },
    ]);
  });

  it('gives the pot to the last player in when everyone else folds', () => {
    const s = table(['AS AH', 'KS KH', '', ''], '', { stacks: [995, 990, 1000, 1015], put: [5, 10, 0, 0], bets: [5, 10, 0, 0], raises: 1 });
    const folded = act(s, 0, 'fold')!;
    expect(folded.phase).toBe('handOver');
    expect(folded.shown).toBe(false);
    expect(folded.stacks[1]).toBe(1005);
  });

  it('makes side pots when someone is all in', () => {
    expect(makePots([50, 100, 100, 20], [true, true, true, false])).toEqual([
      { amount: 170, eligible: [0, 1, 2] },
      { amount: 100, eligible: [1, 2] },
    ]);
    // Chips a folded player put in above everyone still in go to the last pot.
    expect(makePots([30, 50, 0, 0], [true, false, false, false])).toEqual([{ amount: 80, eligible: [0] }]);
    // All in: no more betting; the rest of the cards come out at once.
    const s = table(['AS AH', 'KS KH', '', ''], '', { stacks: [0, 990, 1010, 1000], put: [1000, 0, 0, 0], bets: [1000, 0, 0, 0], toAct: [false, true, false, false], turn: 1, raises: 1 });
    expect(options(s, 1)).toEqual(['fold', 'call']);
    const called = act(s, 1, 'call')!;
    expect(called.board).toHaveLength(5);
    expect(called.phase).not.toBe('betting');
    expect(called.said[1]).toBe('All in'); // West called with every chip
  });

  it('ends the game when you are out of chips or have them all', () => {
    const lost = table(['7S 2H', 'AS AH', '', ''], '2C 3C 4C 8D 9H', { stacks: [0, 500, 1000, 1000], put: [1000, 500, 0, 0], bets: [1000, 500, 0, 0], toAct: [false, true, false, false], turn: 1, raises: 1 });
    const over = act(lost, 1, 'call')!;
    expect(over.phase).toBe('gameOver');
    expect(winner(over)).toBe(false);
    expect(winner(table(['AS AH', 'KS KH', '', ''], ''))).toBeNull();
    // The dealer button skips players who are out.
    const next = nextHand({ ...table(['AS AH', 'KS KH', '', ''], ''), phase: 'handOver', stacks: [2000, 2000, 0, 0], put: [0, 0, 0, 0], dealer: 1 }, seededRng(1))!;
    expect(next.dealer).toBe(0);
    expect(next.hole[2]).toEqual([]);
    // Two players: the dealer posts the small blind and acts first.
    expect(next.bets).toEqual([5, 10, 0, 0]);
    expect(next.turn).toBe(0);
  });
});

describe("hold'em computer players", () => {
  it('judges its chances by dealing the rest out', () => {
    const s = table(['AS AH', '7C 2D', '', ''], 'AD AC KS');
    expect(equity(s, 0, seededRng(1))).toBeGreaterThan(0.95);
    // West can't see your aces, so it judges 7-2 against any two cards.
    expect(equity(s, 1, seededRng(1))).toBeLessThan(0.35);
  });

  it('Strong raises good hands and folds bad ones facing a bet', () => {
    const good = table(['7C 2D', 'AS AH', '', ''], 'AD AC KS', { turn: 1 });
    expect(chooseAction(good, 1, seededRng(2))).toBe('bet');
    const bad = table(['AS AH', '7C 2D', '', ''], 'AD AC KS', { turn: 1, bets: [10, 0, 0, 0], raises: 1 });
    expect(chooseAction(bad, 1, seededRng(2))).toBe('fold');
    const free = table(['AS AH', '7C 2D', '', ''], 'AD AC KS', { turn: 1 });
    expect(chooseAction(free, 1, seededRng(2))).toBe('check');
  });

  it('Easy mostly calls', () => {
    const s = table(['AS AH', '7C 9D', '', ''], '2D 5C KS', { level: 'easy', turn: 1, bets: [10, 0, 0, 0], raises: 1 });
    expect(['call', 'fold']).toContain(chooseAction(s, 1, seededRng(3)));
    const strong = table(['7C 2D', 'AS AH', '', ''], 'AD AC KS', { level: 'easy', turn: 1 });
    expect(['bet', 'check']).toContain(chooseAction(strong, 1, seededRng(3)));
  });

  it('rejects broken saves', () => {
    const good = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C');
    expect(isValidState(good)).toBe(true);
    const bad: unknown[] = [
      null,
      { ...good, level: 'x' },
      { ...good, phase: 'x' },
      { ...good, hand: 'x' },
      { ...good, stacks: [1, 2, 3] },
      { ...good, live: [] },
      { ...good, board: 'x' },
      { ...good, street: 5 },
      { ...good, shown: 'x' },
      { ...good, pots: 'x' },
      { ...good, stacks: [1000, 1000, 1000, 999] },
      { ...good, deck: good.deck.slice(1) },
    ];
    for (const b of bad) expect(isValidState(b as State)).toBe(false);
  });
});

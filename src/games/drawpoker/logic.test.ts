import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import { applyTurn, bestDraw, betSize, bigBlind, chooseTurn, equity, isValidState, newGame, nextHand, options, swap, winner, type State } from './logic';
import { card, cards, table } from './test-fixtures';

describe('five-card draw', () => {
  it('deals five cards each and posts the blinds', () => {
    const s = newGame('strong', seededRng(1));
    expect(s.dealer).toBe(0);
    expect(s.hands.every((h) => h.length === 5)).toBe(true);
    expect(s.bets).toEqual([0, 5, 10, 0]);
    expect(s.turn).toBe(3);
    expect(isFullDeck([...s.hands.flat(), ...s.deck])).toBe(true);
    expect(isValidState(s)).toBe(true);
    expect(nextHand(s)).toBeNull();
    expect([1, 11].map(bigBlind)).toEqual([10, 20]);
  });

  it('goes to the draw when the first round is done, starting left of the dealer', () => {
    const s = table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', '']);
    const drawing = applyTurn(applyTurn(s, 0, { action: 'check' })!, 1, { action: 'check' })!;
    expect(drawing.phase).toBe('drawing');
    expect(drawing.turn).toBe(0);
    expect(options(drawing, 0)).toEqual([]);
  });

  it('swaps up to three cards, then bets again at twice the size', () => {
    const s = table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', ''], { phase: 'drawing', toAct: [false, false, false, false] }, 'AD AC 6H 8H');
    expect(swap(s, 0, cards('2C 3D 9S 2C'))).toBeNull(); // too many
    expect(swap(s, 0, cards('2C 2C'))).toBeNull(); // the same card twice
    expect(swap(s, 0, cards('QS'))).toBeNull(); // not in your hand
    expect(swap(s, 1, [])).toBeNull(); // not West's turn
    const mine = swap(s, 0, cards('2C 3D'))!;
    expect(mine.hands[0]).toEqual(cards('AS AH AD AC 9S'));
    expect(mine.said[0]).toBe('Drew 2');
    expect(mine.discards).toEqual(cards('2C 3D'));
    expect(mine.turn).toBe(1);
    const both = swap(mine, 1, [])!;
    expect(both.said[1]).toBe('Stood pat');
    expect(both.phase).toBe('betting');
    expect(both.round).toBe(1);
    expect(betSize(both)).toBe(20);
    expect(isValidState(both)).toBe(true);
  });

  it('shows down after the second round, and the best hand wins', () => {
    const s = table(['AS AH AD AC 9S', 'KS KH 4C 5D 7S', '', ''], { round: 1, stacks: [990, 990, 1010, 1010], put: [10, 10, 0, 0] });
    const done = applyTurn(applyTurn(s, 0, { action: 'check' })!, 1, { action: 'check' })!;
    expect(done.phase).toBe('handOver');
    expect(done.shown).toBe(true);
    expect(done.pots).toEqual([{ amount: 20, eligible: [0, 1], winners: [0] }]);
    expect(done.stacks[0]).toBe(1010);
  });

  it('skips the draw when everyone but one folds', () => {
    const s = table(['AS AH AD AC 9S', 'KS KH 4C 5D 7S', '', ''], { bets: [0, 10, 0, 0], put: [0, 10, 0, 0], stacks: [1000, 990, 1000, 1010], raises: 1 });
    const folded = applyTurn(s, 0, { action: 'fold' })!;
    expect(folded.phase).toBe('handOver');
    expect(folded.shown).toBe(false);
    expect(folded.stacks[1]).toBe(1000);
  });

  it('ends the game when you are out of chips or have them all', () => {
    const s = table(['7S 2H 3C 4D 9S', 'AS AH AD AC 9H', '', ''], { round: 1, stacks: [0, 500, 1000, 1000], put: [1000, 500, 0, 0], bets: [1000, 500, 0, 0], toAct: [false, true, false, false], turn: 1, raises: 1 });
    const over = applyTurn(s, 1, { action: 'call' })!;
    expect(over.phase).toBe('gameOver');
    expect(winner(over)).toBe(false);
    expect(winner(s)).toBeNull();
  });

  it('draws by the usual advice', () => {
    expect(bestDraw(cards('2S 3S 4S 5S 7S'))).toEqual([]); // a flush: keep it
    expect(bestDraw(cards('JS JH 2C 5D 9S'))).toEqual(cards('2C 5D 9S'));
    expect(bestDraw(cards('JS JH 2C 2D 9S'))).toEqual(cards('9S'));
    expect(bestDraw(cards('2S 7S 9S KS 4H'))).toEqual(cards('4H')); // four to a flush
    expect(bestDraw(cards('5H 6S 7D 8C KH'))).toEqual(cards('KH')); // four in a row
    expect(bestDraw(cards('AS 3H 7D 9C KH'))).toEqual(cards('KH 9C 7D')); // keep the ace
    expect(bestDraw(cards('QS 3H 7D 9C KH'))).toEqual(cards('9C 7D 3H')); // keep the two highest
  });

  it('judges its chances, and bets or folds on them', () => {
    const s = table(['AS AH AD AC 9S', '7C 2D 3H 5S 9D', '', ''], { round: 1 });
    expect(equity(s, 0, seededRng(1))).toBeGreaterThan(0.95);
    expect(chooseTurn(s, 0, seededRng(2))).toEqual({ action: 'bet' });
    const facing = table(['AS AH AD AC 9S', '7C 2D 3H 5S 9D', '', ''], { round: 1, turn: 1, bets: [20, 0, 0, 0], raises: 1 });
    expect(chooseTurn(facing, 1, seededRng(2))).toEqual({ action: 'fold' });
    expect(chooseTurn({ ...s, phase: 'drawing' }, 0)).toEqual({ swap: [] });
    const easy = { ...table(['JS JH 2C 5D 9S', '', '', '']), phase: 'drawing' as const, level: 'easy' as const };
    const t = chooseTurn(easy, 0, seededRng(3));
    expect('swap' in t && t.swap.every((c) => ['2C', '5D', '9S'].includes(`${c.rank}${c.suit}`))).toBe(true);
    const easyBet = { ...facing, level: 'easy' as const };
    expect(['call', 'fold']).toContain((chooseTurn(easyBet, 1, seededRng(4)) as { action: string }).action);
    const easyStrong = { ...s, level: 'easy' as const };
    expect(['bet', 'check']).toContain((chooseTurn(easyStrong, 0, seededRng(4)) as { action: string }).action);
    expect(card('AS')).toEqual({ suit: 'S', rank: 1 });
  });

  it('rejects broken saves', () => {
    const good = table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', '']);
    expect(isValidState(good)).toBe(true);
    const bad: unknown[] = [
      null,
      { ...good, level: 'x' },
      { ...good, phase: 'x' },
      { ...good, hand: 'x' },
      { ...good, stacks: [1, 2] },
      { ...good, drew: [] },
      { ...good, discards: 'x' },
      { ...good, round: 2 },
      { ...good, shown: 1 },
      { ...good, pots: 'x' },
      { ...good, stacks: [1000, 1000, 1000, 999] },
      { ...good, deck: good.deck.slice(1) },
    ];
    for (const b of bad) expect(isValidState(b as State)).toBe(false);
  });
});

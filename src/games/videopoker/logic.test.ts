import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import { START_CREDITS, deal, draw, isBroke, isValidState, newState, payout, restart, setBet, toggleHold, winOf, type State } from './logic';
import { cards, dealt } from './test-fixtures';

describe('video poker', () => {
  it('finds the pay table row for a hand', () => {
    expect(winOf(cards('10H JH QH KH AH'))).toBe('royal');
    expect(winOf(cards('5S 6S 7S 8S 9S'))).toBe('straightFlush');
    expect(winOf(cards('7S 7H 7D 7C 2S'))).toBe('four');
    expect(winOf(cards('KS KH KD 5C 5S'))).toBe('fullHouse');
    expect(winOf(cards('2H 9H JH 4H 6H'))).toBe('flush');
    expect(winOf(cards('AS 2H 3D 4C 5S'))).toBe('straight');
    expect(winOf(cards('6S 6H 6D KC 2S'))).toBe('three');
    expect(winOf(cards('3S 3H 4D 4C 9S'))).toBe('twoPair');
    expect(winOf(cards('JS JH 4D 8C 9S'))).toBe('jacks');
    expect(winOf(cards('10S 10H 4D 8C 9S'))).toBeNull(); // tens don't pay
    expect(winOf(cards('AS 3H 4D 8C 9S'))).toBeNull();
  });

  it('pays by the bet, with the royal bonus at 5 credits', () => {
    expect(payout('jacks', 3)).toBe(3);
    expect(payout('fullHouse', 5)).toBe(45);
    expect(payout('royal', 4)).toBe(1000);
    expect(payout('royal', 5)).toBe(4000);
    expect(payout(null, 5)).toBe(0);
  });

  it('takes the bet and deals five cards from a fresh deck', () => {
    const s = deal(newState(), seededRng(1))!;
    expect(s.phase).toBe('holding');
    expect(s.credits).toBe(START_CREDITS - 5);
    expect(s.hand).toHaveLength(5);
    expect(isFullDeck([...s.hand, ...s.deck])).toBe(true);
    expect(deal(s)).toBeNull();
    // Short of credits: bets what's left.
    expect(deal({ ...newState(), credits: 3 }, seededRng(1))!.bet).toBe(3);
    expect(deal({ ...newState(), credits: 0 })).toBeNull();
  });

  it('holds cards and replaces the rest once, then pays', () => {
    let s = dealt('JS JH 4D 8C 9S', 'JD 2C 3C');
    s = toggleHold(toggleHold(s, 0)!, 1)!;
    expect(s.held).toEqual([true, true, false, false, false]);
    expect(toggleHold(toggleHold(s, 4)!, 4)!.held).toEqual(s.held);
    expect(toggleHold(s, 5)).toBeNull();
    const done = draw(s)!;
    expect(done.hand).toEqual(cards('JS JH JD 2C 3C'));
    expect(done.win).toBe('three');
    expect(done.paid).toBe(15);
    expect(done.credits).toBe(110);
    expect(draw(done)).toBeNull();
    expect(toggleHold(done, 0)).toBeNull();
    const lost = draw(dealt('2S 5H 7D 9C JS', 'KD 4C 3C 8H 10S'))!;
    expect(lost.win).toBeNull();
    expect(lost.credits).toBe(95);
  });

  it('changes the bet between hands and starts over when broke', () => {
    expect(setBet(newState(), 2)!.bet).toBe(2);
    expect(setBet(newState(), 6)).toBeNull();
    expect(setBet(dealt('2S 5H 7D 9C JS'), 2)).toBeNull();
    const broke = { ...newState(), credits: 0, phase: 'done' as const };
    expect(isBroke(broke)).toBe(true);
    expect(restart({ ...broke, bet: 2 })).toEqual({ ...newState(), bet: 2 });
  });

  it('rejects broken saves', () => {
    const good = dealt('2S 5H 7D 9C JS');
    expect(isValidState(newState())).toBe(true);
    expect(isValidState(good)).toBe(true);
    expect(isValidState(draw(good))).toBe(true);
    const bad: unknown[] = [
      null,
      { ...good, phase: 'x' },
      { ...good, credits: -1 },
      { ...good, bet: 6 },
      { ...good, deck: 'x' },
      { ...good, win: 'x' },
      { ...good, paid: 0.5 },
      { ...good, hand: good.hand.slice(1) },
      { ...good, held: [1, 2, 3, 4, 5] },
      { ...good, deck: good.deck.slice(1) },
    ];
    for (const b of bad) expect(isValidState(b as State)).toBe(false);
  });
});

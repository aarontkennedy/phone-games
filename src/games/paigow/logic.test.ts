import { describe, expect, it } from 'vitest';
import {
  BETS,
  START_CHIPS,
  canPlay,
  deal,
  describeLow,
  houseWay,
  isBroke,
  isValidSplit,
  isValidState,
  newState,
  play,
  rankHigh,
  rankLow,
  restart,
  setBet,
  split,
  toggleLow,
  useHint,
  type State,
} from './logic';
import { cards, setting } from './test-fixtures';

/** The two cards the house way plays low, as ids. */
const lowOf = (hand: string) => {
  const c = cards(hand);
  return houseWay(c).map((i) => hand.split(' ')[i]).join(' ');
};

describe('ranking hands with the joker', () => {
  it('uses the joker as an ace, or to finish a straight or flush', () => {
    expect(rankHigh(cards('JK KS 9H 5D 2C')).name).toBe('Ace high');
    expect(rankHigh(cards('JK AS 9H 5D 2C')).name).toBe('Pair of aces');
    expect(rankHigh(cards('JK KS KH 5D 2C')).name).toBe('Pair of kings'); // not three kings: it's only an ace here
    expect(rankHigh(cards('JK 9S 8H 7D 6C')).name).toBe('Straight to the ten');
    expect(rankHigh(cards('JK 9S 8S 4S 2S')).name).toBe('Flush, ace high');
    expect(rankHigh(cards('JK QS JS 10S 9S')).name).toBe('Straight flush to the king');
    expect(rankHigh(cards('JK KS QS JS 10S')).name).toBe('Royal flush');
    expect(rankHigh(cards('JK AS AH AD AC')).name).toBe('Five aces');
    expect(rankHigh(cards('JK AS AH AD AC')).score).toBeGreaterThan(rankHigh(cards('AS KS QS JS 10S')).score);
    expect(rankHigh(cards('KS KH 9D 9C 2C')).name).toBe('Two pair, kings and nines');
  });

  it('ranks two-card hands: any pair beats two different cards', () => {
    expect(rankLow(cards('2S 2H'))).toBeGreaterThan(rankLow(cards('AS KH')));
    expect(rankLow(cards('AS 3H'))).toBeGreaterThan(rankLow(cards('KS QH')));
    expect(rankLow(cards('JK KH'))).toBe(rankLow(cards('AS KD'))); // the joker is an ace
    expect(describeLow(cards('9S 9H'))).toBe('Pair of nines');
    expect(describeLow(cards('3S JK'))).toBe('Ace and three');
  });

  it('only lets the high hand go out when it beats the low hand', () => {
    const ok = (high: string, low: string) => isValidSplit(cards(high), cards(low));
    expect(ok('AS 9H 7D 5C 2C', 'KS QH')).toBe(true);
    expect(ok('KS 9H 7D 5C 2C', 'AS QH')).toBe(false);
    expect(ok('KS QH 7D 5C 2C', 'KD JH')).toBe(true); // same top card, better second
    expect(ok('KS JH 7D 5C 2C', 'KD QH')).toBe(false);
    expect(ok('KS QH 7D 5C 2C', 'KD QD')).toBe(true); // the extra cards make it higher
    expect(ok('9S 9H 7D 5C 2C', '9D 9C')).toBe(true);
    expect(ok('8S 8H 7D 5C 2C', '9D 9C')).toBe(false);
    expect(ok('AS KH 7D 5C 2C', '3D 3C')).toBe(false); // no pair can't beat a pair
    expect(ok('8S 8H 7D 5C 2C', 'AD KC')).toBe(true);
    expect(ok('9S 8H 7D 6C 5C', 'AD AC')).toBe(true);
    expect(ok('JK AS AH AD AC', 'KD KC')).toBe(true);
  });
});

describe('the house way', () => {
  it.each([
    ['no pair: best card high, next two low', 'AS QH 10D 8C 6S 4H 2D', 'QH 10D'],
    ['one pair stays high', 'KS 9H 9D 8C 6S 4H 2D', 'KS 8C'],
    ['two big pairs split', 'QS QH 5D 5C AS 8H 2D', '5D 5C'],
    ['two small pairs with an ace: keep them, ace low', 'AS 9H 9D 5C 5S 4H 2D', 'AS 4H'],
    ['two small pairs without an ace split', 'KS 9H 9D 5C 5S 4H 2D', '5C 5S'],
    ['three pair: highest pair low', 'KS KH 9H 9D 5C 5S 2D', 'KS KH'],
    ['full house: the pair goes low', '8S 8H 8D 4C 4S AH 2D', '4C 4S'],
    ['two threes: split the higher', '9S 9H 9D 4C 4S 4H 2D', '9S 9H'],
    ['three aces: one ace low with the next card', 'AS AH AD KC 9S 4H 2D', 'AS KC'],
    ['three of a kind stays high', '8S 8H 8D KC 9S 4H 2D', 'KC 9S'],
    ['big four of a kind splits', 'QS QH QD QC 9S 4H 2D', 'QS QH'],
    ['middle four of a kind with an ace: ace low', '9S 9H 9D 9C AS 4H 2D', 'AS 4H'],
    ['middle four of a kind without an ace splits', '9S 9H 9D 9C KS 4H 2D', '9S 9H'],
    ['small four of a kind stays together', '5S 5H 5D 5C KS 4H 2D', 'KS 4H'],
    ['four of a kind and a pair: the pair goes low', '5S 5H 5D 5C KS KH 2D', 'KS KH'],
    ['four of a kind and three: the three makes a low pair', '5S 5H 5D 5C KS KH KD', 'KS KH'],
    ['five aces: two low', 'JK AS AH AD AC KS 2D', 'JK AS'],
    ['a straight that leaves a good low hand', 'AS KH 9D 8C 7S 6H 5D', 'AS KH'],
    ['a pair is played with a straight that leaves a king low', 'KS 9H 9D 8C 7S 6H 5D', 'KS 9H'],
    ['three of a kind gives way to a flush with an ace low', 'AH 8S 8H 8D 6H 4H 2H', '8S 8D'],
  ])('%s', (_name, hand, low) => {
    expect(lowOf(hand)).toBe(low);
  });

  it('plays a lone straight even with a weak low hand when there’s no pair', () => {
    expect(lowOf('10S 9H 8D 7C 6S 4H 2D')).toBe('4H 2D');
  });
});

describe('playing a hand', () => {
  it('deals seven cards each from 53, highest first, and takes the bet', () => {
    const s = deal(newState(), () => 0.3)!;
    expect(s.hand).toHaveLength(7);
    expect(s.dealer).toHaveLength(7);
    expect(s.chips).toBe(START_CHIPS - 40);
    expect(isValidState(s)).toBe(true);
    expect(deal(s)).toBeNull(); // not while setting
    expect(deal({ ...newState(), chips: 10 })).toBeNull();
  });

  it('picks two cards for the low hand, swapping out the oldest pick for a third', () => {
    let s = setting('AS QH 10D 8C 6S 4H 2D', 'KS QS 10S 8S 6H 4D 3C');
    s = toggleLow(toggleLow(toggleLow(s, 1)!, 2)!, 3)!;
    expect(s.low).toEqual([2, 3]);
    expect(toggleLow(s, 2)!.low).toEqual([3]);
    expect(toggleLow(s, 9)).toBeNull();
    expect(canPlay(toggleLow(s, 2)!)).toBe(false);
    expect(canPlay({ ...s, low: [0, 1] })).toBe(false); // ace-queen low beats a ten-high hand
  });

  it('pays a win of both hands less 5%, pushes a split, and loses both', () => {
    // You: ace high, and queen-ten low. The dealer: king high, and jack-nine low.
    const win = play(setting('AS QH 10D 8C 6S 4H 2D', 'KS JS 9S 7S 5H 3D 2C', { low: [1, 2] }))!;
    expect([win.highWon, win.lowWon, win.result]).toEqual([true, true, 'win']);
    expect(win.paid).toBe(78);
    expect(win.chips).toBe(960 + 78);
    expect(win.dealerLow).toEqual([1, 2]);

    const push = play(setting('AS 9H 8D 7C 6S 4H 2D', 'KS QS JS 9H 5H 3D 2C', { low: [1, 2] }))!;
    expect([push.highWon, push.lowWon, push.result, push.paid]).toEqual([true, false, 'push', 40]);

    const copy = play(setting('AS QH 10D 8C 6S 4H 2D', 'AD QS 10S 8H 6D 4C 2C', { low: [1, 2] }))!;
    expect([copy.highWon, copy.lowWon, copy.result, copy.paid]).toEqual([false, false, 'lose', 0]); // identical hands: the dealer wins
    expect(play(setting('AS QH 10D 8C 6S 4H 2D', 'AD QS 10S 8H 6D 4C 2C'))).toBeNull(); // hand not set
  });

  it('lowers the bet when you can’t cover it, and starts over when broke', () => {
    const s = play(setting('AS QH 10D 8C 6S 4H 2D', 'AD QS 10S 8H 6D 4C 2C', { low: [1, 2], chips: 10 }))!;
    expect(s.bet).toBe(BETS[0]);
    expect(isBroke(s)).toBe(true);
    expect(restart(s)).toEqual({ ...newState(), bet: BETS[0] });
    expect(setBet(newState(), 100)!.bet).toBe(100);
    expect(setBet(newState(), 30)).toBeNull();
    expect(setBet({ ...newState(), chips: 50 }, 100)).toBeNull();
    expect(setBet(setting('AS', 'KS'), 20)).toBeNull();
  });

  it('gives the hint as the house way, only while setting', () => {
    const s = useHint(setting('AS QH 10D 8C 6S 4H 2D', 'KS JS 9S 7S 5H 3D 2C'))!;
    expect(s.low).toEqual([1, 2]);
    expect(useHint(newState())).toBeNull();
    expect(split(s.hand, s.low).low).toEqual(cards('QH 10D'));
  });
});

describe('isValidState', () => {
  it('accepts hands at every stage, including after saving', () => {
    expect(isValidState(newState())).toBe(true);
    const s = setting('AS QH 10D 8C 6S 4H 2D', 'KS JS 9S 7S 5H 3D JK', { low: [1, 2] });
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isValidState(play(s))).toBe(true);
  });

  it.each([
    ['null', () => null],
    ['negative chips', (s: State) => ({ ...s, chips: -1 })],
    ['odd bet', (s: State) => ({ ...s, bet: 30 })],
    ['bad phase', (s: State) => ({ ...s, phase: 'lunch' })],
    ['six cards', (s: State) => ({ ...s, hand: s.hand.slice(1) })],
    ['a card twice', (s: State) => ({ ...s, dealer: [...s.dealer.slice(1), s.hand[0]] })],
    ['three low cards', (s: State) => ({ ...s, low: [0, 1, 2] })],
    ['a repeated pick', (s: State) => ({ ...s, low: [1, 1] })],
    ['bad result', (s: State) => ({ ...s, result: 'maybe' })],
    ['a finished hand with no low hand', (s: State) => ({ ...s, phase: 'done' })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(setting('AS QH 10D 8C 6S 4H 2D', 'KS JS 9S 7S 5H 3D JK')))).toBe(false);
  });
});

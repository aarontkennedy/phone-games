import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import {
  BETS,
  DECKS,
  RESHUFFLE_AT,
  START_CHIPS,
  act,
  canAct,
  deal,
  handValue,
  hint,
  isBlackjack,
  isBroke,
  isBust,
  isValidState,
  newState,
  restart,
  setBet,
  type Action,
  type State,
} from './logic';
import { cards, stacked } from './test-fixtures';

/** Deals with these cards coming out in order: you, dealer up, you, dealer hole, then any draws. */
const dealt = (order: string, s: Partial<State> = {}) => deal(stacked(order, s))!;

describe('hand values', () => {
  it('counts court cards as 10 and an ace as 11 when it fits', () => {
    expect(handValue(cards('KH QS'))).toEqual({ total: 20, soft: false });
    expect(handValue(cards('AH 6S'))).toEqual({ total: 17, soft: true });
    expect(handValue(cards('AH 6S 9C'))).toEqual({ total: 16, soft: false });
    expect(handValue(cards('AH AS 9C'))).toEqual({ total: 21, soft: true });
    expect(handValue([])).toEqual({ total: 0, soft: false });
  });

  it('knows blackjack and busts', () => {
    expect(isBlackjack(cards('AH KS'))).toBe(true);
    expect(isBlackjack(cards('AH KS'), true)).toBe(false); // after a split it's just 21
    expect(isBlackjack(cards('7H 7S 7C'))).toBe(false);
    expect(isBust(cards('KH QS 2C'))).toBe(true);
    expect(isBust(cards('KH QS AC'))).toBe(false);
  });
});

describe('a new table', () => {
  it('starts with a full shoe, 1000 chips and a 20 bet', () => {
    const s = newState(seededRng(1));
    expect(s.shoe).toHaveLength(52 * DECKS);
    expect(s.chips).toBe(START_CHIPS);
    expect(s.bet).toBe(20);
    expect(s.phase).toBe('betting');
  });

  it('changes the bet only between hands, and only to a listed amount', () => {
    const s = newState(seededRng(1));
    expect(setBet(s, 100)!.bet).toBe(100);
    expect(setBet(s, 30)).toBeNull();
    expect(setBet({ ...s, chips: 40 }, 50)).toBeNull(); // more than you have
    expect(setBet(dealt('9H 7S 8C 10D'), 50)).toBeNull();
  });
});

describe('dealing', () => {
  it('deals two cards each and takes the bet', () => {
    const s = dealt('9H 7S 8C 10D');
    expect(s.hands[0].cards).toEqual(cards('9H 8C'));
    expect(s.dealer).toEqual(cards('7S 10D'));
    expect(s.chips).toBe(START_CHIPS - 20);
    expect(s.phase).toBe('playing');
  });

  it("won't deal mid-hand or without enough chips", () => {
    expect(deal(dealt('9H 7S 8C 10D'))).toBeNull();
    expect(deal({ ...newState(seededRng(1)), chips: 10 })).toBeNull(); // bet is 20
  });

  it('reshuffles a low shoe before dealing', () => {
    const s = { ...newState(seededRng(1)), shoe: cards('2H 3H 4H 5H') };
    expect(deal(s, seededRng(2))!.shoe).toHaveLength(52 * DECKS - 4);
    expect(RESHUFFLE_AT).toBe(78);
  });

  it('pays a blackjack 3 to 2 at once', () => {
    const s = dealt('AH 7S KC 9D');
    expect(s.phase).toBe('done');
    expect(s.hands[0].outcome).toBe('blackjack');
    expect(s.chips).toBe(START_CHIPS + 30);
  });

  it('ends the hand at once when the dealer has blackjack', () => {
    const s = dealt('9H AS 8C KD');
    expect(s.phase).toBe('done');
    expect(s.hands[0].outcome).toBe('lose');
    expect(s.chips).toBe(START_CHIPS - 20);
  });

  it('pushes when both have blackjack', () => {
    const s = dealt('AH AS KC KD');
    expect(s.hands[0].outcome).toBe('push');
    expect(s.chips).toBe(START_CHIPS);
  });
});

describe('playing a hand', () => {
  it('hits, then the dealer draws to 17 and stands', () => {
    let s = dealt('9H 6S 2C 10D 5H 4C'); // you 11, dealer 16
    s = act(s, 'hit')!; // you 16 with the 5
    expect(s.phase).toBe('playing');
    s = act(s, 'stand')!; // dealer draws the 4: 20
    expect(s.dealer).toEqual(cards('6S 10D 4C'));
    expect(s.hands[0].outcome).toBe('lose');
  });

  it('busts and the dealer does not draw', () => {
    const s = act(dealt('10H 6S 6C 10D KH'), 'hit')!;
    expect(s.hands[0].outcome).toBe('lose');
    expect(s.dealer).toHaveLength(2);
    expect(s.chips).toBe(START_CHIPS - 20);
  });

  it('stops automatically at 21', () => {
    const s = act(dealt('5H 9S 6C 8D KH'), 'hit')!; // 11 + K = 21 stops; dealer stands on 17
    expect(s.phase).toBe('done');
    expect(s.hands[0].outcome).toBe('win');
    expect(s.chips).toBe(START_CHIPS + 20);
  });

  it('wins when the dealer busts, and pushes on a tie', () => {
    const bust = act(dealt('10H 6S 8C 10D KC'), 'stand')!;
    expect(bust.hands[0].outcome).toBe('win');
    const tie = act(dealt('10H 10S 8C 8D'), 'stand')!;
    expect(tie.hands[0].outcome).toBe('push');
    expect(tie.chips).toBe(START_CHIPS);
  });

  it('dealer stands on soft 17', () => {
    const s = act(dealt('10H AS 9C 6D'), 'stand')!;
    expect(s.dealer).toHaveLength(2);
    expect(s.hands[0].outcome).toBe('win');
  });

  it('doubles: one card, twice the bet', () => {
    const s = act(dealt('6H 6S 5C 10D 10C 9H'), 'double')!; // you 21, dealer 16 then 25
    expect(s.hands[0].cards).toHaveLength(3);
    expect(s.hands[0].bet).toBe(40);
    expect(s.hands[0].outcome).toBe('win');
    expect(s.chips).toBe(START_CHIPS + 40);
  });

  it("won't double after hitting or without chips", () => {
    const s = act(dealt('2H 6S 3C 10D 4H'), 'hit')!;
    expect(canAct(s, 'double')).toBe(false);
    expect(canAct({ ...dealt('6H 6S 5C 10D'), chips: 10 }, 'double')).toBe(false);
  });

  it('refuses actions when no hand is being played', () => {
    const s = newState(seededRng(1));
    for (const a of ['hit', 'stand', 'double', 'split'] as Action[]) expect(act(s, a)).toBeNull();
  });
});

describe('splitting', () => {
  it('splits a pair into two hands that play in turn', () => {
    let s = dealt('8H 10S 8C 7D 3H 2C'); // 8,8 vs 17
    expect(canAct(s, 'split')).toBe(true);
    s = act(s, 'split')!;
    expect(s.hands.map((h) => h.cards)).toEqual([cards('8H 3H'), cards('8C 2C')]);
    expect(s.chips).toBe(START_CHIPS - 40);
    expect(s.active).toBe(0);
    expect(canAct(s, 'split')).toBe(false); // only one split
    s = act(s, 'stand')!;
    expect(s.active).toBe(1);
    s = act(s, 'stand')!;
    expect(s.phase).toBe('done');
    expect(s.hands.map((h) => h.outcome)).toEqual(['lose', 'lose']);
  });

  it('splits any two 10-point cards, and doubles after a split', () => {
    let s = act(dealt('KH 6S QC 10D AH 9C'), 'split')!; // K,Q vs 16
    expect(s.hands[0].cards).toEqual(cards('KH AH'));
    expect(s.hands[0].done).toBe(true); // 21 stops, and isn't a blackjack
    expect(s.active).toBe(1);
    s = act({ ...s, shoe: [...s.shoe, ...cards('2H')] }, 'double')!; // Q,9 + 2 = 21
    expect(s.hands[1].bet).toBe(40);
    expect(s.phase).toBe('done');
    expect(s.hands[0].outcome).not.toBe('blackjack');
  });

  it('gives split aces one card each and finishes them', () => {
    const s = act(dealt('AH 9S AC 8D KH 5C'), 'split')!;
    expect(s.phase).toBe('done');
    expect(s.hands.map((h) => h.outcome)).toEqual(['win', 'lose']); // 21 vs 17, 16 vs 17
  });

  it('a busted hand loses even when the dealer busts too', () => {
    let s = act(dealt('8H 10S 8C 6D 3H 2C 9H 5H KC'), 'split')!; // 8,3 and 8,2 vs 16
    s = act(act(s, 'hit')!, 'hit')!; // 8,3,9,5 = 25: bust
    s = act(s, 'stand')!; // dealer draws the king: 26
    expect(s.hands.map((h) => h.outcome)).toEqual(['lose', 'win']);
  });

  it("won't split different cards or without chips", () => {
    expect(canAct(dealt('8H 10S 9C 7D'), 'split')).toBe(false);
    expect(canAct({ ...dealt('8H 10S 8C 7D'), chips: 0 }, 'split')).toBe(false);
  });
});

describe('chips', () => {
  it('lowers the bet when you can no longer cover it', () => {
    const s = dealt('9H 7S 8C 10D', { chips: 60, bet: 50 });
    const lost = act(s, 'stand')!; // 17 vs 17: push
    expect(lost.chips).toBe(60);
    const bust = act(dealt('10H 7S 6C 10D KH', { chips: 60, bet: 50 }), 'hit')!;
    expect(bust.chips).toBe(10);
    expect(bust.bet).toBe(10);
  });

  it('is broke below the smallest bet, and can start over', () => {
    const s = act(dealt('10H 7S 6C 10D KH', { chips: 10, bet: 10 }), 'hit')!;
    expect(s.chips).toBe(0);
    expect(isBroke(s)).toBe(true);
    const fresh = restart(s, seededRng(4));
    expect(fresh.chips).toBe(START_CHIPS);
    expect(fresh.bet).toBe(BETS[0]);
    expect(isBroke(fresh)).toBe(false);
  });
});

describe('basic strategy hint', () => {
  const tip = (order: string) => hint(dealt(order));

  it.each([
    ['10H 5S 7C 9D', 'stand'], // hard 17
    ['10H 7S 6C 9D', 'hit'], // 16 vs 7
    ['10H 6S 6C 9D', 'stand'], // 16 vs 6
    ['10H 3S 2C 9D', 'hit'], // 12 vs 3
    ['10H 4S 2C 9D', 'stand'], // 12 vs 4
    ['6H 5S 5C 9D', 'double'], // 11 vs 5
    ['6H AS 5C 9D', 'hit'], // 11 vs ace
    ['6H 9S 4C 9D', 'double'], // 10 vs 9
    ['6H 10S 4C 9D', 'hit'], // 10 vs 10
    ['5H 3S 4C 9D', 'double'], // 9 vs 3
    ['5H 2S 4C 9D', 'hit'], // 9 vs 2
    ['3H 2S 4C 9D', 'hit'], // 7
    ['AH 5S 9C 9D', 'stand'], // soft 20
    ['AH 6S 8C 9D', 'double'], // soft 19 vs 6
    ['AH 5S 8C 9D', 'stand'], // soft 19 vs 5
    ['AH 4S 7C 9D', 'double'], // soft 18 vs 4
    ['AH 8S 7C 9D', 'stand'], // soft 18 vs 8
    ['AH 9S 7C 9D', 'hit'], // soft 18 vs 9
    ['AH 3S 6C 9D', 'double'], // soft 17 vs 3
    ['AH 2S 6C 9D', 'hit'], // soft 17 vs 2
    ['AH 4S 4C 9D', 'double'], // soft 15 vs 4
    ['AH 3S 4C 9D', 'hit'], // soft 15 vs 3
    ['AH 5S 2C 9D', 'double'], // soft 13 vs 5
    ['AH 4S 2C 9D', 'hit'], // soft 13 vs 4
    ['AH 10S AC 9D', 'split'], // aces
    ['8H 10S 8C 9D', 'split'], // eights
    ['9H 6S 9C 9D', 'split'], // nines vs 6
    ['9H 7S 9C 9D', 'stand'], // nines vs 7
    ['9H 10S 9C 9D', 'stand'], // nines vs 10
    ['7H 7S 7C 9D', 'split'], // sevens vs 7
    ['6H 6S 6C 9D', 'split'], // sixes vs 6
    ['6H 7S 6C 9D', 'hit'], // sixes vs 7
    ['4H 5S 4C 9D', 'split'], // fours vs 5
    ['4H 4S 4C 9D', 'hit'], // fours vs 4: hard 8
    ['5H 6S 5C 9D', 'double'], // fives are a hard 10
    ['KH 6S QC 9D', 'stand'], // tens never split
  ])('%s -> %s', (order, expected) => {
    expect(tip(order)).toBe(expected);
  });

  it('hits or stands instead of doubling when doubling is not allowed', () => {
    const three = act(dealt('2H 5S 3C 9D 6H'), 'hit')!; // hard 11 in three cards
    expect(hint(three)).toBe('hit');
    const soft18 = act(dealt('AH 4S 2C 9D 5H'), 'hit')!; // soft 18 in three cards vs 4
    expect(hint(soft18)).toBe('stand');
  });

  it('has nothing to say between hands', () => {
    expect(hint(newState(seededRng(1)))).toBeNull();
  });
});

describe('isValidState', () => {
  it('accepts tables at every stage, including after saving', () => {
    expect(isValidState(newState(seededRng(1)))).toBe(true);
    const playing = dealt('9H 7S 8C 10D');
    expect(isValidState(JSON.parse(JSON.stringify(playing)))).toBe(true);
    expect(isValidState(act(playing, 'stand'))).toBe(true);
  });

  it.each([
    ['null', () => null],
    ['bad card in shoe', (s: State) => ({ ...s, shoe: [{ suit: 'X', rank: 1 }] })],
    ['negative chips', (s: State) => ({ ...s, chips: -5 })],
    ['odd bet', (s: State) => ({ ...s, bet: 7 })],
    ['bad phase', (s: State) => ({ ...s, phase: 'lunch' })],
    ['bad hand', (s: State) => ({ ...s, hands: [{ cards: 'x' }] })],
    ['playing with no hands', (s: State) => ({ ...s, phase: 'playing' })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(newState(seededRng(1))))).toBe(false);
  });
});

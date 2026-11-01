import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import type { Seat } from '../../core/tricks';
import {
  applyBid,
  callTrump,
  chooseBid,
  chooseCard,
  chooseDiscard,
  collect,
  discard,
  euchreDeck,
  handStrength,
  isValidState,
  legalPlays,
  newGame,
  nextHand,
  orderUp,
  pass,
  play,
  power,
  sittingOut,
  suitOf,
  trickWinner,
  upcard,
  winner,
  type State,
} from './logic';
import { bidding, card, cards, position, trick } from './test-fixtures';

// A full deal for bidding tests (East deals, so you bid first). The 9 of hearts is turned up.
const HANDS = ['JH JD AH KC 9C', '10H QH 9D 10D 10C', 'KH AD KD QD JC', 'AS JS 9S AC QC'];

describe('the deck and a new game', () => {
  it('uses 24 cards: 9 to ace', () => {
    const deck = euchreDeck();
    expect(deck).toHaveLength(24);
    expect(deck.every((c) => c.rank === 1 || c.rank >= 9)).toBe(true);
  });

  it('deals 5 each, turns one up, and starts bidding left of the dealer', () => {
    const s = newGame('easy', seededRng(1));
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.kitty).toHaveLength(4);
    expect(upcard(s)).toEqual(s.kitty[0]);
    expect(upcard(orderUp(s, 0)!)).toEqual(s.kitty[0]); // still known after the dealer picks it up
    expect(s.phase).toBe('bidding1');
    expect(s.dealer).toBe(3);
    expect(s.turn).toBe(0);
    expect(isValidState(s)).toBe(true);
  });
});

describe('trump', () => {
  it('makes the other jack of the same color a trump (the left bower)', () => {
    expect(suitOf(card('JD'), 'H')).toBe('H');
    expect(suitOf(card('JC'), 'H')).toBe('C');
    expect(suitOf(card('JD'), null)).toBe('D');
  });

  it('ranks the right bower, then the left, then A K Q 10 9 of trump, above everything else', () => {
    const order = cards('JH JD AH KH QH 10H 9H AS').map((c) => power(c, 'H', 'S'));
    expect([...order].sort((a, b) => b - a)).toEqual(order);
    expect(power(card('AC'), 'H', 'S')).toBe(0); // off-suit and not led
  });

  it('gives the trick to the strongest card', () => {
    expect(trickWinner(trick(0, 'AS KS JD QS'), 'H')).toBe(2); // left bower trumps
    expect(trickWinner(trick(0, 'AS KS 9S QS'), 'H')).toBe(0);
    expect(trickWinner(trick(0, 'AH JD JH 9H'), 'H')).toBe(2);
  });
});

describe('bidding', () => {
  it('passes around, then the dealer turns the card down and round two begins', () => {
    let s = bidding(HANDS);
    expect(pass(s, 1)).toBeNull(); // not West's turn
    for (const seat of [0, 1, 2] as Seat[]) s = pass(s, seat)!;
    expect(s.phase).toBe('bidding1');
    s = pass(s, 3)!;
    expect(s.phase).toBe('bidding2');
    expect(s.turn).toBe(0);
  });

  it('orders up the turned card: the dealer picks it up and discards', () => {
    let s = orderUp(bidding(HANDS), 0)!;
    expect(s.trump).toBe('H');
    expect(s.maker).toBe(0);
    expect(s.phase).toBe('discard');
    expect(s.hands[3]).toHaveLength(6);
    expect(s.turn).toBe(3);
    expect(discard(s, card('KH'))).toBeNull(); // not the dealer's card
    s = discard(s, card('QC'))!;
    expect(s.hands[3]).toHaveLength(5);
    expect(s.phase).toBe('playing');
    expect(s.turn).toBe(0); // left of the dealer leads
    expect(isValidState(s)).toBe(true);
  });

  it('when the dealer’s partner goes alone, the dealer sits out and doesn’t pick up', () => {
    const s = orderUp(bidding(HANDS, { turn: 1 }), 1, true)!;
    expect(s.alone).toBe(true);
    expect(sittingOut(s)).toBe(3);
    expect(s.phase).toBe('playing');
    expect(s.hands[3]).toHaveLength(5);
    expect(s.turn).toBe(0);
  });

  it('names another suit in round two, and sticks the dealer', () => {
    const s = bidding(HANDS, { phase: 'bidding2' });
    expect(callTrump(s, 0, 'H')).toBeNull(); // the turned-down suit
    expect(callTrump(s, 1, 'D')).toBeNull(); // not West's turn
    expect(orderUp(s, 0)).toBeNull(); // round one is over
    const called = callTrump(s, 0, 'D', true)!;
    expect(called.trump).toBe('D');
    expect(called.alone).toBe(true);
    expect(called.phase).toBe('playing');
    expect(called.turn).toBe(0);
    expect(pass({ ...s, turn: 3 }, 3)).toBeNull(); // the dealer must choose
    expect(pass({ ...s, phase: 'playing' }, 0)).toBeNull();
  });
});

describe('playing', () => {
  it('follows the suit led, where the left bower counts as trump', () => {
    const s = position(['JD 9S QS', '', '', ''], { trick: trick(3, 'AH') });
    expect(legalPlays(s, 0)).toEqual(cards('JD'));
    const spade = position(['JD 9S QS', '', '', ''], { trick: trick(3, 'AS') });
    expect(legalPlays(spade, 0)).toEqual(cards('9S QS'));
    const void_ = position(['JD 9S', '', '', ''], { trick: trick(3, 'AC') });
    expect(legalPlays(void_, 0)).toEqual(cards('JD 9S'));
  });

  it('skips the partner who sits out, so tricks have 3 cards', () => {
    let s = position(['9S', 'KS', 'QS', 'AS'], { alone: true, maker: 0, turn: 0 });
    expect(legalPlays(s, 2)).toEqual([]);
    s = play(s, 0, card('9S'))!;
    s = play(s, 1, card('KS'))!;
    expect(s.turn).toBe(3);
    s = play(s, 3, card('AS'))!;
    expect(s.trick).toHaveLength(3);
    expect(play(s, 2, card('QS'))).toBeNull();
    s = collect(s)!;
    expect(s.tricks).toEqual([0, 0, 0, 1]);
    expect(s.turn).toBe(3);
  });

  it('refuses plays out of turn, and early collects', () => {
    const s = position(['9S', 'KS', 'QS', 'AS']);
    expect(play(s, 1, card('KS'))).toBeNull();
    expect(play(s, 0, card('AS'))).toBeNull();
    expect(collect(s)).toBeNull();
  });
});

describe('scoring', () => {
  const lastTrick = (tricksBefore: number[], o: Partial<State> = {}) =>
    position(['', '', '', ''], { tricks: tricksBefore, trick: trick(0, 'JH 9S 10S QS'), ...o }); // you win it

  it('gives the makers 1 for three or four tricks', () => {
    const n = collect(lastTrick([2, 1, 0, 1]))!;
    expect(n.last).toEqual({ team: 0, points: 1, makerTricks: 3, euchred: false });
    expect(n.scores).toEqual([1, 0]);
    expect(n.phase).toBe('handOver');
  });

  it('gives 2 for all five, and 4 for all five alone', () => {
    expect(collect(lastTrick([3, 0, 1, 0]))!.last!.points).toBe(2);
    // Alone, North sits out and tricks have 3 cards.
    const aloneTrick = [0, 1, 3].map((seat, i) => ({ seat: seat as Seat, card: cards('JH 9S 10S')[i] }));
    const alone = (before: number[]) =>
      collect(position(['', '', 'QS', ''], { alone: true, tricks: before, trick: aloneTrick }))!.last!.points;
    expect(alone([4, 0, 0, 0])).toBe(4);
    expect(alone([2, 1, 0, 1])).toBe(1);
  });

  it('gives the defenders 2 when the makers are euchred', () => {
    const n = collect(lastTrick([1, 1, 1, 1], { maker: 1 }))!; // West called; West and East took 2
    expect(n.last).toEqual({ team: 0, points: 2, makerTricks: 2, euchred: true });
  });

  it('ends the game at 10 and deals the next hand otherwise', () => {
    const over = collect(lastTrick([3, 0, 1, 0], { scores: [8, 5] }))!;
    expect(over.phase).toBe('gameOver');
    expect(winner(over)).toBe(0);
    expect(winner({ ...over, scores: [6, 10] })).toBe(1);
    expect(winner(position(['']))).toBeNull();
    expect(nextHand(over)).toBeNull();

    const next = nextHand(collect(lastTrick([2, 1, 0, 1]))!, seededRng(2))!;
    expect(next.dealer).toBe(0);
    expect(next.turn).toBe(1);
    expect(next.phase).toBe('bidding1');
    expect(next.scores).toEqual([1, 0]);
  });
});

describe('computer players', () => {
  it('rates hands by trump, bowers, aces and empty suits', () => {
    expect(handStrength(cards('JH JD AH KH QH'), 'H')).toBe(3 + 2.5 + 2 + 1.5 + 1.2 + 1.5);
    expect(handStrength(cards('9S 10S 9C 10C 9D'), 'H')).toBe(0);
    expect(handStrength(cards('AS 9H 9C 10C 9D'), 'H')).toBe(1.8);
  });

  it('Strong orders up a strong hand, goes alone with a great one, and passes a weak one', () => {
    const strong = (hand: string, seat: Seat = 0, o: Partial<State> = {}) => {
      const hands = ['', '', '', ''];
      hands[seat] = hand;
      return chooseBid(bidding(hands, { turn: seat, ...o }), seat);
    };
    expect(strong('JH JD AH 9C 10C')).toEqual({ action: 'order', alone: false });
    expect(strong('JH JD AH KH QH')).toEqual({ action: 'order', alone: true });
    expect(strong('10C 9C AS 10D 9D')).toEqual({ action: 'pass' });
  });

  it('Strong names its best suit in round two, and the dealer always names one', () => {
    const s = bidding(['JD JH AD KD 9C', '', '', '9S 10S 9C 10C 10D'], { phase: 'bidding2' });
    expect(chooseBid(s, 0)).toEqual({ action: 'call', suit: 'D', alone: false });
    const stuck = { ...s, turn: 3 as Seat };
    expect(chooseBid(stuck, 3)).toMatchObject({ action: 'call' });
    const weak = bidding(['9S 10S 9C 10C 10D', '', '', ''], { phase: 'bidding2' });
    expect(chooseBid(weak, 0)).toEqual({ action: 'pass' });
  });

  it('Easy calls loosely but never goes alone', () => {
    const s = { ...bidding(['JH JD AH KH QH', '', '', '']), level: 'easy' as const };
    for (let seed = 1; seed < 10; seed++) expect(chooseBid(s, 0, seededRng(seed))).toEqual({ action: 'order', alone: false });
  });

  it('applies bids', () => {
    const s = bidding(HANDS);
    expect(applyBid(s, 0, { action: 'pass' })!.turn).toBe(1);
    expect(applyBid(s, 0, { action: 'order', alone: false })!.phase).toBe('discard');
    expect(applyBid({ ...s, phase: 'bidding2' }, 0, { action: 'call', suit: 'S', alone: false })!.trump).toBe('S');
  });

  it('the dealer discards its weakest side card, emptying a short suit', () => {
    const s = position(['', '', '', '9H JH AC 10C QS KS'], { phase: 'discard', dealer: 3 });
    expect(chooseDiscard(s)).toEqual(card('10C'));
    const allTrump = position(['', '', '', '9H JH AH KH QH 10H'], { phase: 'discard' });
    expect(chooseDiscard(allTrump)).toEqual(card('9H'));
  });

  const pick = (hands: string[], o: Partial<State>, seat: Seat = 0) => chooseCard(position(hands, o), seat);

  it('Strong leads the right bower as a maker, then off-suit aces, then low', () => {
    expect(pick(['JH AS 9C', '', '', ''], {})).toEqual(card('JH'));
    expect(pick(['JH AS 9C', '', '', ''], { maker: 1 })).toEqual(card('AS'));
    expect(pick(['QS 9C KH', '', '', ''], {})).toEqual(card('9C'));
    expect(pick(['QH 9H', '', '', ''], { maker: 1 })).toEqual(card('9H'));
  });

  it('Strong lets a winning partner have the trick', () => {
    expect(pick(['KS 9S', '', '', ''], { trick: trick(1, '10S AS JS') })).toEqual(card('9S'));
  });

  it('Strong wins as cheaply as it can, trumping when void', () => {
    expect(pick(['KS AS', '', '', ''], { trick: trick(3, 'QS') })).toEqual(card('KS'));
    expect(pick(['9H AH 10C', '', '', ''], { trick: trick(3, 'QS') })).toEqual(card('9H'));
    expect(pick(['9S 10S', '', '', ''], { trick: trick(3, 'AS') })).toEqual(card('9S'));
  });

  it('Easy plays any legal card', () => {
    const s = position(['9S KS AH', '', '', ''], { level: 'easy', trick: trick(3, 'QS') });
    expect(cards('9S KS')).toContainEqual(chooseCard(s, 0, seededRng(4)));
  });
});

describe('whole games', () => {
  it.each(['easy', 'strong'] as const)('%s players always find a legal move and finish the game', (level) => {
    for (let seed = 1; seed <= 10; seed++) {
      const rng = seededRng(seed);
      let s = newGame(level, rng);
      let steps = 0;
      while (s.phase !== 'gameOver') {
        if (s.phase === 'bidding1' || s.phase === 'bidding2') s = applyBid(s, s.turn, chooseBid(s, s.turn, rng))!;
        else if (s.phase === 'discard') s = discard(s, chooseDiscard(s))!;
        else if (s.phase === 'handOver') s = nextHand(s, rng)!;
        else if (s.trick.length === (s.alone ? 3 : 4)) s = collect(s)!;
        else s = play(s, s.turn, chooseCard(s, s.turn, rng))!;
        expect(s).not.toBeNull();
        expect(isValidState(s)).toBe(true);
        expect(++steps).toBeLessThan(5000);
      }
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('isValidState', () => {
  it.each([
    ['null', () => null],
    ['bad level', (s: State) => ({ ...s, level: 'hard' })],
    ['bad phase', (s: State) => ({ ...s, phase: 'snack' })],
    ['bad trump', (s: State) => ({ ...s, trump: 'X' })],
    ['lost a card', (s: State) => ({ ...s, kitty: s.kitty.slice(1) })],
    ['no turned card', (s: State) => ({ ...s, turned: null })],
    ['a 2 in the deck', (s: State) => ({ ...s, kitty: [{ suit: 'S', rank: 2 }, ...s.kitty.slice(1)] })],
    ['bad scores', (s: State) => ({ ...s, scores: [0] })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(newGame('strong', seededRng(1))))).toBe(false);
  });
});

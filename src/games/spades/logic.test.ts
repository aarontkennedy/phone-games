import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import type { Seat } from '../../core/tricks';
import {
  bid,
  chooseBid,
  chooseCard,
  collect,
  estimateTricks,
  goodNil,
  isValidState,
  legalPlays,
  newGame,
  nextRound,
  partnerOf,
  play,
  scoreTeam,
  teamBid,
  teamOf,
  teamTricks,
  winner,
  type State,
} from './logic';
import { card, cards, position, trick } from './test-fixtures';

describe('a new game', () => {
  it('deals 13 each and starts bidding left of the dealer', () => {
    const s = newGame('easy', seededRng(1));
    expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(isFullDeck(s.hands.flat())).toBe(true);
    expect(s.phase).toBe('bidding');
    expect(s.dealer).toBe(3);
    expect(s.turn).toBe(0); // you bid first in the first round
  });

  it('pairs you with North against West and East', () => {
    expect([0, 1, 2, 3].map((x) => teamOf(x as Seat))).toEqual([0, 1, 0, 1]);
    expect(partnerOf(0)).toBe(2);
    expect(partnerOf(1)).toBe(3);
  });
});

describe('bidding', () => {
  it('goes around the table, then the first bidder leads', () => {
    let s = newGame('strong', seededRng(1));
    expect(bid(s, 1, 3)).toBeNull(); // not West's turn
    expect(bid(s, 0, 14)).toBeNull();
    expect(bid(s, 0, -1)).toBeNull();
    expect(bid(s, 0, 2.5)).toBeNull();
    s = bid(s, 0, 4)!;
    expect(teamBid(s, 0)).toBe(4); // North hasn't bid yet
    s = bid(s, 1, 0)!;
    s = bid(s, 2, 3)!;
    expect(s.phase).toBe('bidding');
    s = bid(s, 3, 2)!;
    expect(s.bids).toEqual([4, 0, 3, 2]);
    expect(s.phase).toBe('playing');
    expect(s.turn).toBe(0);
    expect(bid(s, 0, 1)).toBeNull(); // bidding is over
    expect(teamBid(s, 0)).toBe(7);
    expect(teamBid(s, 1)).toBe(2);
  });
});

describe('playing', () => {
  it("can't lead spades until they're broken, unless that's all you have", () => {
    expect(legalPlays(position(['3S 9D', '', '', '']), 0)).toEqual(cards('9D'));
    expect(legalPlays(position(['3S 9D', '', '', ''], { spadesBroken: true }), 0)).toEqual(cards('3S 9D'));
    expect(legalPlays(position(['3S 5S', '', '', '']), 0)).toEqual(cards('3S 5S'));
  });

  it('follows suit, or trumps or throws anything when void', () => {
    expect(legalPlays(position(['3S 9D 4D', '', '', ''], { trick: trick(3, 'KD') }), 0)).toEqual(cards('9D 4D'));
    expect(legalPlays(position(['3S 9C', '', '', ''], { trick: trick(3, 'KD') }), 0)).toEqual(cards('3S 9C'));
    expect(legalPlays(position(['3S'], { phase: 'bidding' }), 0)).toEqual([]);
  });

  it('breaks spades when one is played, and spades win tricks', () => {
    let s = position(['2S', '9D', 'KD', 'AD'], { trick: trick(1, '9D KD AD'), turn: 0 });
    s.hands = [cards('2S'), [], [], []];
    s = play(s, 0, card('2S'))!;
    expect(s.spadesBroken).toBe(true);
    s = collect(s)!;
    expect(s.tricks).toEqual([1, 0, 0, 0]);
    expect(s.turn).toBe(0);
  });

  it('refuses plays out of turn or not in hand', () => {
    const s = position(['9D', '3D', '', ''], { turn: 0 });
    expect(play(s, 1, card('3D'))).toBeNull();
    expect(play(s, 0, card('AD'))).toBeNull();
    expect(collect(s)).toBeNull();
  });
});

describe('scoring', () => {
  it('scores 10 a trick bid plus a point per bag', () => {
    expect(scoreTeam([3, 2], [4, 3], 0)).toEqual({ points: 52, bags: 2, bagsAfter: 2, penalty: false });
  });

  it('loses 10 a trick bid when the team falls short', () => {
    expect(scoreTeam([4, 3], [2, 3], 0)).toEqual({ points: -70, bags: 0, bagsAfter: 0, penalty: false });
  });

  it('scores nil: +100 made, -100 failed, and a failed nil’s tricks are bags', () => {
    expect(scoreTeam([0, 4], [0, 5], 0)).toEqual({ points: 141, bags: 1, bagsAfter: 1, penalty: false });
    expect(scoreTeam([0, 4], [2, 4], 0)).toEqual({ points: -58, bags: 2, bagsAfter: 2, penalty: false });
    expect(scoreTeam([0, 4], [2, 3], 0)).toEqual({ points: -140, bags: 2, bagsAfter: 2, penalty: false });
  });

  it('scores a double nil', () => {
    expect(scoreTeam([0, 0], [0, 0], 0).points).toBe(200);
    expect(scoreTeam([0, 0], [1, 0], 0)).toEqual({ points: 1, bags: 1, bagsAfter: 1, penalty: false });
  });

  it('takes 100 off at 10 bags and keeps the rest', () => {
    expect(scoreTeam([3, 2], [6, 4], 7)).toEqual({ points: -45, bags: 5, bagsAfter: 2, penalty: true });
  });

  /** The 13th trick, about to be collected: East's 5 of diamonds wins it. */
  const lastTrick = (bids: number[], tricksBefore: number[], scores: [number, number]) =>
    position(['', '', '', ''], { bids, tricks: tricksBefore, trick: trick(0, '2D 3D 4D 5D'), scores });

  it('adds up both teams at the end of a round', () => {
    const n = collect(lastTrick([4, 2, 3, 3], [4, 2, 2, 4], [100, 90]))!;
    expect(n.tricks).toEqual([4, 2, 2, 5]);
    expect(n.phase).toBe('roundOver');
    expect(n.last).toEqual({ points: [-70, 52], bags: [0, 2], bagPenalty: [false, false] }); // we bid 7, took 6
    expect(n.scores).toEqual([30, 142]);
    expect(n.bags).toEqual([0, 2]);
  });

  it('ends the game when a team reaches 500 and leads', () => {
    const n = collect(lastTrick([3, 3, 3, 4], [4, 3, 2, 3], [480, 300]))!; // both make their bids
    expect(n.scores).toEqual([540, 370]);
    expect(n.phase).toBe('gameOver');
    expect(winner(n)).toBe(0);
    expect(winner({ ...n, scores: [400, 520] })).toBe(1);
    expect(winner(position(['']))).toBeNull();
  });

  it('plays on when both teams reach 500 with the same score', () => {
    const n = collect(lastTrick([3, 3, 3, 4], [4, 3, 2, 3], [440, 430]))!; // +60 and +70
    expect(n.scores).toEqual([500, 500]);
    expect(n.phase).toBe('roundOver');
  });

  it('deals the next round with the next dealer', () => {
    const s = { ...position(['', '', '', '']), phase: 'roundOver' as const, dealer: 3 as Seat, scores: [50, 40] as [number, number] };
    const n = nextRound(s, seededRng(3))!;
    expect(n.dealer).toBe(0);
    expect(n.turn).toBe(1);
    expect(n.round).toBe(1);
    expect(n.scores).toEqual([50, 40]);
    expect(nextRound(n)).toBeNull();
  });
});

describe('hand estimates and bids', () => {
  it('counts aces, protected kings, long spades and voids', () => {
    expect(estimateTricks(cards('AS KS QS JS 10S AH KH 2H AD 3D 4D 5C 6C'))).toBe(7.5);
    expect(estimateTricks(cards('2H 3H 4H 5H 6D 7D 8D 9C 10C 2C 3C 4S 5S'))).toBe(0);
    expect(estimateTricks(cards('2S 3S 4S 5S 6S 2H 3H 4H 5H 6H 7H 8H 9H'))).toBe(4); // 2 long spades, 2 voids
  });

  it('knows a good nil hand', () => {
    expect(goodNil(cards('2H 3H 4H 5H 6D 7D 8D 9C 10C 2C 3C 4S 5S'))).toBe(true);
    expect(goodNil(cards('AH 3H 4H 5H 6D 7D 8D 9C 10C 2C 3C 4S 5S'))).toBe(false);
    expect(goodNil(cards('2H 3H 4H 5H 6D 7D 8D 9C 10C 2C 3C 4S QS'))).toBe(false);
  });

  it('Strong bids its estimate, nils weak hands, and keeps the table at 13 or under', () => {
    const strong = (hand: string, bids: (number | null)[] = [null, null, null, null], seat: Seat = 1) =>
      chooseBid(position(['', '', '', ''].map((_, i) => (i === seat ? hand : '')), { phase: 'bidding', bids, turn: seat }), seat);
    expect(strong('AS KS QS JS 10S AH KH 2H AD 3D 4D 5C 6C')).toBe(8);
    expect(strong('2H 3H 4H 5H 6D 7D 8D 9C 10C 2C 3C 4S 5S')).toBe(0);
    expect(strong('2H 3H 4H 5H 6D 7D 8D 9C 10C 2C 3C 4S 5S', [null, null, null, 0])).toBe(1); // partner already nil
    expect(strong('AS KS QS JS 10S AH KH 2H AD 3D 4D 5C 6C', [6, null, 4, null])).toBe(3);
  });

  it('Easy bids around its estimate and never nil', () => {
    const s = position(['2H 3H 4H 5H 6D 7D 8D 9C 10C 2C 3C 4S 5S', '', '', ''], { phase: 'bidding', level: 'easy' });
    for (let seed = 1; seed < 20; seed++) expect(chooseBid(s, 0, seededRng(seed))).toBeGreaterThanOrEqual(1);
  });
});

describe('Strong card play', () => {
  const pick = (hands: string[], o: Partial<State>, seat: Seat = 0) => chooseCard(position(hands, o), seat);

  it('leads a sure winner when the team needs tricks', () => {
    expect(pick(['AH 5H 3D', '', '', ''], {})).toEqual(card('AH'));
    expect(pick(['KH 5H 3D', '', '', ''], { played: [card('AH')] })).toEqual(card('KH'));
  });

  it('leads low when the bid is made, to avoid bags', () => {
    expect(pick(['AH 5H 3D', '', '', ''], { tricks: [3, 0, 3, 0] })).toEqual(card('3D'));
  });

  it('wins as cheaply as it can when tricks are needed', () => {
    expect(pick(['QD KD 3D', '', '', ''], { trick: trick(3, 'JD') })).toEqual(card('QD'));
    expect(pick(['4S 9S 3C', '', '', ''], { trick: trick(3, 'JD') })).toEqual(card('4S')); // trump low
  });

  it("doesn't overtake a partner who is winning", () => {
    expect(pick(['QD AD 3D', '', '', ''], { trick: trick(1, '5D KD 9D') })).toEqual(card('3D'));
  });

  it('stays under as a nil bidder', () => {
    expect(pick(['QD 8D 3D', '', '', ''], { bids: [0, 3, 3, 3], trick: trick(3, '10D') })).toEqual(card('8D'));
    expect(pick(['QD KD', '', '', ''], { bids: [0, 3, 3, 3], trick: trick(3, '10D') })).toEqual(card('QD'));
    expect(pick(['QD 3H 9C', '', '', ''], { bids: [0, 3, 3, 3] })).toEqual(card('3H'));
    expect(pick(['9S 4S', '', '', ''], { bids: [0, 3, 3, 3] })).toEqual(card('4S')); // only spades left
  });

  it('covers a partner bidding nil', () => {
    expect(pick(['QD AD 3D', '', '', ''], { bids: [3, 3, 0, 3], trick: trick(1, '5D JD 9D') })).toEqual(card('QD'));
    expect(pick(['3D 4D', '', '', ''], { bids: [3, 3, 0, 3], trick: trick(1, '5D JD 9D') })).toEqual(card('3D')); // can't
  });

  it('leaves an opponent bidding nil stuck with the trick', () => {
    expect(pick(['QD AD 3D', '', '', ''], { bids: [3, 0, 3, 3], trick: trick(1, 'JD') })).toEqual(card('3D'));
  });

  it('sheds a high loser when the bid is made', () => {
    expect(pick(['8D 4D AD', '', '', ''], { tricks: [3, 0, 3, 0], trick: trick(1, 'JD 2D 3D') })).toEqual(card('8D'));
  });

  it('Easy plays any legal card', () => {
    const s = position(['QD 3D 9C', '', '', ''], { level: 'easy', trick: trick(3, 'JD') });
    expect(cards('QD 3D')).toContainEqual(chooseCard(s, 0, seededRng(1)));
  });
});

describe('whole games', () => {
  it.each(['easy', 'strong'] as const)('%s players always find a legal move and finish the game', (level) => {
    for (let seed = 1; seed <= 4; seed++) {
      const rng = seededRng(seed);
      let s = newGame(level, rng);
      let steps = 0;
      while (s.phase !== 'gameOver') {
        if (s.phase === 'bidding') s = bid(s, s.turn, chooseBid(s, s.turn, rng))!;
        else if (s.phase === 'roundOver') s = nextRound(s, rng)!;
        else if (s.trick.length === 4) s = collect(s)!;
        else s = play(s, s.turn, chooseCard(s, s.turn, rng))!;
        expect(s).not.toBeNull();
        expect(++steps).toBeLessThan(20000);
      }
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(500);
      expect(teamTricks(s, 0) + teamTricks(s, 1)).toBe(13);
    }
  });
});

describe('isValidState', () => {
  it('accepts games at every stage, including after saving', () => {
    const s = newGame('strong', seededRng(1));
    expect(isValidState(s)).toBe(true);
    expect(isValidState(JSON.parse(JSON.stringify(bid(s, 0, 3))))).toBe(true);
  });

  it.each([
    ['null', () => null],
    ['bad level', (s: State) => ({ ...s, level: 'pro' })],
    ['bad phase', (s: State) => ({ ...s, phase: 'tea' })],
    ['bad dealer', (s: State) => ({ ...s, dealer: 5 })],
    ['bad bid', (s: State) => ({ ...s, bids: [14, null, null, null] })],
    ['lost a card', (s: State) => ({ ...s, hands: [s.hands[0].slice(1), ...s.hands.slice(1)] })],
    ['bad scores', (s: State) => ({ ...s, scores: [0] })],
    ['bad trick', (s: State) => ({ ...s, trick: [{ seat: 9, card: s.hands[0][0] }] })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(newGame('strong', seededRng(1))))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { isFullDeck, sameCard, type Card } from '../../core/cards';
import { seededRng } from '../../core/random';
import type { Seat } from '../../core/tricks';
import {
  cardPoints,
  chooseCard,
  choosePass,
  collect,
  isValidState,
  legalPlays,
  newGame,
  nextRound,
  passCards,
  passDirection,
  play,
  winners,
  type State,
} from './logic';
import { card, cards, position, trick } from './test-fixtures';

const has = (hand: Card[], c: Card) => hand.some((h) => sameCard(h, c));

describe('a new game', () => {
  it('deals 13 cards each and starts by passing left', () => {
    const s = newGame('easy', seededRng(1));
    expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(isFullDeck(s.hands.flat())).toBe(true);
    expect(s.phase).toBe('passing');
    expect(passDirection(s)).toBe('left');
    expect(s.level).toBe('easy');
  });

  it('scores hearts 1 and the queen of spades 13', () => {
    expect(cardPoints(card('5H'))).toBe(1);
    expect(cardPoints(card('QS'))).toBe(13);
    expect(cardPoints(card('KS'))).toBe(0);
  });
});

describe('passing', () => {
  it('sends your 3 cards left to West and takes 3 from East, then the 2 of clubs leads', () => {
    const s = newGame('strong', seededRng(2));
    const mine = s.hands[0].slice(0, 3);
    const n = passCards(s, mine, seededRng(3))!;
    for (const c of mine) {
      expect(has(n.hands[0], c)).toBe(false);
      expect(has(n.hands[1], c)).toBe(true);
    }
    expect(n.received).toHaveLength(3);
    for (const c of n.received) expect(has(s.hands[3], c)).toBe(true);
    expect(n.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(n.phase).toBe('playing');
    expect(has(n.hands[n.turn], card('2C'))).toBe(true);
  });

  it('rotates right, then across, then no pass', () => {
    let s = newGame('strong', seededRng(4));
    s = { ...s, round: 1 };
    const right = passCards(s, s.hands[0].slice(0, 3))!;
    expect(has(right.hands[3], s.hands[0][0])).toBe(true);
    s = { ...s, round: 2 };
    const across = passCards(s, s.hands[0].slice(0, 3))!;
    expect(has(across.hands[2], s.hands[0][0])).toBe(true);
    const none = nextRound({ ...s, phase: 'roundOver' }, seededRng(5))!; // round 3
    expect(passDirection(none)).toBe('none');
    expect(none.phase).toBe('playing');
  });

  it('refuses anything but 3 different cards from your hand', () => {
    const s = newGame('strong', seededRng(2));
    const [a, b, c] = s.hands[0];
    expect(passCards(s, [a, b])).toBeNull();
    expect(passCards(s, [a, a, b])).toBeNull();
    expect(passCards(s, [a, b, s.hands[1][0]])).toBeNull();
    expect(passCards({ ...s, phase: 'playing' }, [a, b, c])).toBeNull();
  });
});

describe('legal plays', () => {
  it('opens with the 2 of clubs', () => {
    const s = position(['2C 5H 9S', '3C 4H 8D', '4C 6H 7D', '5C 7H 6D'], { tricksPlayed: 0 });
    expect(legalPlays(s, 0)).toEqual(cards('2C'));
  });

  it('must follow suit', () => {
    const s = position(['2C 5H 9C', '3C', '4C', '5C'], { trick: trick(3, 'KC'), turn: 0 });
    expect(legalPlays(s, 0)).toEqual(cards('2C 9C'));
  });

  it('allows no points on the first trick, unless that is all you have', () => {
    const first = { tricksPlayed: 0, trick: trick(3, '2C'), turn: 0 as Seat };
    expect(legalPlays(position(['5H QS 9D', '3D', '4D', 'KD'], first), 0)).toEqual(cards('9D'));
    expect(legalPlays(position(['5H QS', '3D', '4D', 'KD'], first), 0)).toEqual(cards('5H QS'));
  });

  it("can't lead hearts until they're broken, unless you only have hearts", () => {
    expect(legalPlays(position(['5H 9D', '3D', '4D', 'KD']), 0)).toEqual(cards('9D'));
    expect(legalPlays(position(['5H 9D', '3D', '4D', 'KD'], { heartsBroken: true }), 0)).toEqual(cards('5H 9D'));
    expect(legalPlays(position(['5H 7H', '3D', '4D', 'KD']), 0)).toEqual(cards('5H 7H'));
  });

  it('has nothing to play out of turn phases', () => {
    expect(legalPlays(position(['5H'], { phase: 'roundOver' }), 0)).toEqual([]);
    expect(legalPlays(position(['5H', '', '', ''], { trick: trick(0, '2D 3D 4D 5D') }), 0)).toEqual([]);
  });
});

describe('playing tricks', () => {
  it('plays in turn, breaks hearts and clears your received cards', () => {
    let s = position(['9D', '3D 5H', '4D', 'KD'], { received: cards('9D') });
    expect(play(s, 1, card('3D'))).toBeNull(); // not West's turn
    expect(play(s, 0, card('5H'))).toBeNull(); // not in your hand
    s = play(s, 0, card('9D'))!;
    expect(s.received).toEqual([]);
    expect(s.turn).toBe(1);
    expect(play(s, 1, card('5H'))).toBeNull(); // must follow diamonds
    s = play(s, 1, card('3D'))!;
    s = play(s, 2, card('4D'))!;
    s = play(s, 3, card('KD'))!;
    expect(s.trick).toHaveLength(4);
    expect(s.heartsBroken).toBe(false);
  });

  it('gives the trick and its points to the highest card of the suit led', () => {
    const s = position(['', '', '', ''], {
      trick: trick(0, '9D 5H KD QS'),
      tricksPlayed: 3,
      heartsBroken: true,
    });
    const n = collect(s)!;
    expect(n.points).toEqual([0, 0, 0, 0].map((_, i) => (i === 2 ? 14 : 0)));
    expect(n.turn).toBe(2);
    expect(n.trick).toEqual([]);
    expect(n.tricksPlayed).toBe(4);
    expect(collect(n)).toBeNull();
  });
});

describe('ending a round', () => {
  const lastTrick = (points: number[], t: string, first: Seat = 0) =>
    position(['', '', '', ''], { trick: trick(first, t), tricksPlayed: 12, points });

  it('adds the round to the scores', () => {
    const n = collect(lastTrick([3, 13, 5, 0], '9D 2D 3D 4H'))!;
    expect(n.lastRound).toEqual([4, 13, 5, 0]);
    expect(n.scores).toEqual([4, 13, 5, 0]);
    expect(n.phase).toBe('roundOver');
    expect(n.moon).toBeNull();
  });

  it('gives everyone else 26 when one player takes all the points', () => {
    const n = collect(lastTrick([0, 25, 0, 0], '2D AD 3D 4H', 0))!; // West takes the last heart
    expect(n.moon).toBe(1);
    expect(n.lastRound).toEqual([26, 0, 26, 26]);
  });

  it('ends the game at 100, lowest score wins', () => {
    const s = { ...lastTrick([5, 0, 0, 0], '9D 2D 3D 4D'), scores: [97, 40, 30, 30] };
    const n = collect(s)!;
    expect(n.phase).toBe('gameOver');
    expect(winners(n)).toEqual([2, 3]);
    expect(nextRound(n)).toBeNull();
  });

  it('deals the next round, keeping scores and difficulty', () => {
    const done = collect(lastTrick([3, 13, 5, 0], '9D 2D 3D 4H'))!;
    const n = nextRound({ ...done, level: 'easy' }, seededRng(9))!;
    expect(n.round).toBe(1);
    expect(n.scores).toEqual(done.scores);
    expect(n.level).toBe('easy');
    expect(n.phase).toBe('passing');
    expect(passDirection(n)).toBe('right');
  });
});

describe('computer players', () => {
  it('Easy plays a legal card and passes any 3', () => {
    const s = position(['2C 9C 5H', 'KC', '3C', '4C'], { level: 'easy', trick: trick(1, 'KC 3C 4C'), turn: 0 });
    expect(cards('2C 9C')).toContainEqual(chooseCard(s, 0, seededRng(1)));
    expect(choosePass({ ...newGame('easy', seededRng(1)) }, 1, seededRng(2))).toHaveLength(3);
  });

  it('Strong passes the queen of spades and unprotected high spades first', () => {
    const s = position(['QS AS 2S 3D 4D 5D 6D 7D 8D 9D 10D JD 2H'], { phase: 'passing' });
    expect(choosePass(s, 0)).toEqual(cards('QS AS JD'));
  });

  it('Strong keeps high spades when well protected, and passes high hearts', () => {
    const s = position(['AS KS 2S 3S 4S AH KH 2D 3D 4D 5D 6D 7D'], { phase: 'passing' });
    expect(choosePass(s, 0)).toEqual(cards('AH KH 7D'));
  });

  const pick = (hands: string[], o: Partial<State>, seat: Seat = 0) => chooseCard(position(hands, o), seat);

  it('Strong leads low spades to flush out the queen, but not while holding it', () => {
    expect(pick(['3S 9S 2D', 'QS', '', ''], {})).toEqual(card('3S')); // West still has the queen
    expect(pick(['3S QS 9D', '', '', ''], {})).toEqual(card('9D'));
  });

  it('Strong leads low and avoids leading hearts or big spades', () => {
    expect(pick(['AS 5D 9C 2H', '', '', ''], { heartsBroken: true, played: [] })).toEqual(card('5D'));
    expect(pick(['4H 9H', '', '', ''], { heartsBroken: true })).toEqual(card('4H'));
  });

  it('Strong hands the queen to whoever played the ace or king of spades', () => {
    expect(pick(['QS 3S', '', '', ''], { trick: trick(2, 'KS 2S') })).toEqual(card('QS'));
  });

  it('Strong ducks under the winning card, as high as it can', () => {
    expect(pick(['3D 8D QD', '', '', ''], { trick: trick(3, '9D') })).toEqual(card('8D'));
  });

  it('Strong takes a free last trick with its highest card, never the queen', () => {
    expect(pick(['3D 8D QD', '', '', ''], { trick: trick(1, '9D 2D 4D') })).toEqual(card('QD'));
    expect(pick(['QS 2S', '', '', ''], { trick: trick(1, '3S 4S 5S'), played: [] })).toEqual(card('2S'));
  });

  it('Strong wins as cheaply as it can when it must, or sheds high when last', () => {
    expect(pick(['JD KD', '', '', ''], { trick: trick(2, '9D 5H') })).toEqual(card('JD'));
    expect(pick(['JD KD', '', '', ''], { trick: trick(1, '9D 2D 5H') })).toEqual(card('KD'));
  });

  it('Strong dumps the queen, then big spades, then high hearts when it can’t follow', () => {
    expect(pick(['QS AH 9C', '', '', ''], { trick: trick(3, '5D') })).toEqual(card('QS'));
    expect(pick(['KS AH 9C', '', '', ''], { trick: trick(3, '5D'), played: [] })).toEqual(card('KS'));
    expect(pick(['3H AH 9C', '', '', ''], { trick: trick(3, '5D') })).toEqual(card('AH'));
    expect(pick(['2C 9C KS 4S', '', '', ''], { trick: trick(3, '5D') })).toEqual(card('KS')); // queen is gone
  });

  it('Strong otherwise dumps the highest card of its shortest suit', () => {
    expect(pick(['2C 9C JC 4S 10S', '', '', ''], { trick: trick(3, '5D') })).toEqual(card('10S'));
  });
});

describe('isValidState', () => {
  it('accepts games at every stage, including after saving', () => {
    const s = newGame('strong', seededRng(1));
    expect(isValidState(s)).toBe(true);
    expect(isValidState(JSON.parse(JSON.stringify(passCards(s, s.hands[0].slice(0, 3)))))).toBe(true);
  });

  it.each([
    ['null', () => null],
    ['bad level', (s: State) => ({ ...s, level: 'medium' })],
    ['bad phase', (s: State) => ({ ...s, phase: 'nap' })],
    ['three hands', (s: State) => ({ ...s, hands: s.hands.slice(1) })],
    ['lost a card', (s: State) => ({ ...s, hands: [s.hands[0].slice(1), ...s.hands.slice(1)] })],
    ['bad trick', (s: State) => ({ ...s, trick: [{ seat: 7, card: s.hands[0][0] }] })],
    ['bad turn', (s: State) => ({ ...s, turn: 4 })],
    ['bad scores', (s: State) => ({ ...s, scores: [0] })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(newGame('strong', seededRng(1))))).toBe(false);
  });
});

describe('whole games', () => {
  it.each(['easy', 'strong'] as const)('%s players always find a legal move and finish the game', (level) => {
    for (let seed = 1; seed <= 5; seed++) {
      const rng = seededRng(seed);
      let s = newGame(level, rng);
      let steps = 0;
      while (s.phase !== 'gameOver') {
        if (s.phase === 'passing') s = passCards(s, choosePass(s, 0, rng), rng)!;
        else if (s.phase === 'roundOver') s = nextRound(s, rng)!;
        else if (s.trick.length === 4) s = collect(s)!;
        else s = play(s, s.turn, chooseCard(s, s.turn, rng))!;
        expect(s).not.toBeNull();
        expect(++steps).toBeLessThan(5000);
      }
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(100);
      expect(s.scores.reduce((a, b) => a + b, 0) % 26).toBe(0); // each round adds 26, or 78 after a moon
    }
  });
});

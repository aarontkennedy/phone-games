import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import {
  canPlay,
  chooseCard,
  chooseDiscard,
  discard,
  isValidState,
  legalPlays,
  newGame,
  nextStep,
  pegPoints,
  pileCount,
  play,
  scoreHand,
  showHand,
  total,
  winner,
  type State,
} from './logic';
import { card, cards, pegging, pile } from './test-fixtures';

const score = (hand: string, starter: string, crib = false) => scoreHand(cards(hand), card(starter), crib);

describe('scoring a hand', () => {
  it('scores the best possible hand: 29', () => {
    const items = score('5H 5D 5S JC', '5C');
    expect(items).toEqual([
      { label: '8 fifteens', points: 16 },
      { label: '6 pairs', points: 12 },
      { label: 'nobs', points: 1 },
    ]);
    expect(total(items)).toBe(29);
  });

  it('scores a double run with a pair and fifteens', () => {
    expect(score('3C 4D 5H 5S', 'KD')).toEqual([
      { label: '2 fifteens', points: 4 },
      { label: 'a pair', points: 2 },
      { label: '2 runs of 3', points: 6 },
    ]);
  });

  it('scores a single run and a fifteen', () => {
    expect(score('9C 10D JH 2S', '4C')).toEqual([
      { label: 'a fifteen', points: 2 },
      { label: 'a run of 3', points: 3 },
    ]);
  });

  it('scores flushes: 4 in the hand, but only 5 in the crib', () => {
    expect(score('2H 4H 6H 8H', 'KC')).toEqual([{ label: 'a flush of 4', points: 4 }]);
    expect(score('2H 4H 6H 8H', 'KH')).toEqual([{ label: 'a flush of 5', points: 5 }]);
    expect(score('2H 4H 6H 8H', 'KC', true)).toEqual([]);
    expect(score('2H 4H 6H 8H', 'KH', true)).toEqual([{ label: 'a flush of 5', points: 5 }]);
  });

  it('scores nobs and nothing', () => {
    expect(score('JH 2C 7D 9S', '4H')).toEqual([
      { label: 'a fifteen', points: 2 },
      { label: 'nobs', points: 1 },
    ]);
    expect(score('2C 4D 6H 8S', 'KC')).toEqual([]);
  });
});

describe('pegging points', () => {
  const peg = (ids: string) => pegPoints(cards(ids));

  it('scores fifteen and thirty-one', () => {
    expect(peg('5H KD')).toEqual([{ label: 'fifteen', points: 2 }]);
    expect(peg('10H JD QS AC')).toEqual([{ label: 'thirty-one', points: 2 }]);
  });

  it('scores pairs, three and four of a kind', () => {
    expect(peg('7H 7D')).toEqual([{ label: 'a pair', points: 2 }]);
    expect(peg('7H 7D 7S')).toEqual([{ label: 'three of a kind', points: 6 }]);
    expect(peg('2H 2D 2S 2C')).toEqual([{ label: 'four of a kind', points: 12 }]);
  });

  it('scores runs in any order, only at the end of the pile', () => {
    expect(peg('3H 5D 4S')).toEqual([{ label: 'a run of 3', points: 3 }]);
    expect(peg('3H 5D 4S 6C')).toEqual([{ label: 'a run of 4', points: 4 }]);
    expect(peg('3H 4D 3S')).toEqual([]);
    expect(peg('4H 5D 6S')).toEqual([
      { label: 'fifteen', points: 2 },
      { label: 'a run of 3', points: 3 },
    ]);
  });
});

describe('dealing and the crib', () => {
  it('deals 6 each and asks for discards; the non-dealer plays first', () => {
    const s = newGame('easy', seededRng(1));
    expect(s.hands.map((h) => h.length)).toEqual([6, 6]);
    expect(s.phase).toBe('discard');
    expect(s.dealer).toBe(1);
    expect(s.turn).toBe(0);
    expect(isValidState(s)).toBe(true);
  });

  it('sends two cards each to the crib and cuts a starter', () => {
    const s = newGame('strong', seededRng(2));
    const mine = s.hands[0].slice(0, 2);
    const n = discard(s, mine, seededRng(3))!;
    expect(n.crib).toHaveLength(4);
    expect(n.crib).toEqual(expect.arrayContaining(mine));
    expect(n.hands.map((h) => h.length)).toEqual([4, 4]);
    expect(n.kept).toEqual(n.hands);
    expect(n.starter).not.toBeNull();
    expect(n.phase).toBe('pegging');
    expect(isValidState(n)).toBe(true);
  });

  it('refuses anything but 2 different cards from your hand', () => {
    const s = newGame('strong', seededRng(2));
    const [a, b] = s.hands[0];
    expect(discard(s, [a])).toBeNull();
    expect(discard(s, [a, a])).toBeNull();
    expect(discard(s, [a, s.hands[1][0]])).toBeNull();
    expect(discard({ ...s, phase: 'pegging' }, [a, b])).toBeNull();
  });
});

describe('his heels', () => {
  it('gives the dealer 2 for a jack starter', () => {
    const s = pegging(['AH 2H 3H 4H 5H 6H', '7H 8H 9H 10H JS QH'], { phase: 'discard', starter: null, crib: [] });
    const n = discard({ ...s, stock: [card('JH')] }, cards('AH 2H'), () => 0); // the only card left to cut
    expect(n!.starter).toEqual(card('JH'));
    expect(n!.scores).toEqual([0, 2]);
    expect(n!.events).toEqual([{ player: 1, items: [{ label: 'his heels (a jack cut)', points: 2 }] }]);
  });
});

describe('pegging', () => {
  it('only allows cards that keep the count at 31 or under, in turn', () => {
    const s = pegging(['KH 2D', '5S'], { pile: pile(1, 'QC JC') });
    expect(pileCount(s)).toBe(20);
    expect(legalPlays(s, 0)).toEqual(cards('KH 2D'));
    expect(legalPlays(s, 1)).toEqual([]); // not their turn
    expect(play(s, 0, card('5S'))).toBeNull();
    const high = pegging(['KH 2D', '5S'], { pile: pile(1, 'QC JC 9C') });
    expect(legalPlays(high, 0)).toEqual(cards('2D'));
  });

  it('scores a play and passes the turn', () => {
    const n = play(pegging(['KH 2D', '5S 9S'], { pile: pile(1, '5C') }), 0, card('KH'))!;
    expect(n.scores).toEqual([2, 0]);
    expect(n.events).toEqual([{ player: 0, items: [{ label: 'fifteen', points: 2 }] }]);
    expect(n.turn).toBe(1);
  });

  it('moves the back peg to where the score was, like a real board', () => {
    const n = play(pegging(['KH 2D', '5S 9S'], { pile: pile(1, '5C'), scores: [10, 7], back: [4, 3] }), 0, card('KH'))!;
    expect(n.scores).toEqual([12, 7]);
    expect(n.back).toEqual([10, 3]); // only the scorer's pegs move
    const old = play(pegging(['KH 2D', '5S 9S'], { pile: pile(1, '5C'), scores: [10, 7], back: undefined }), 0, card('KH'))!;
    expect(old.back).toEqual([10, 7]); // a save from before back pegs
  });

  it('keeps playing when the other player says go', () => {
    const s = pegging(['AH 2D', 'KS'], { pile: pile(1, 'QC JC 5C') }); // 25: the king won't fit
    const n = play(s, 0, card('AH'))!; // 26
    expect(canPlay(n, 1)).toBe(false);
    expect(n.turn).toBe(0);
  });

  it('gives a point for go when neither can play, then starts the count again', () => {
    const s = pegging(['5H 9D', 'KS'], { pile: pile(1, 'QC JC') }); // 20
    const n = play(s, 0, card('9D'))!; // 29: neither can play
    expect(n.events).toEqual([{ player: 0, items: [{ label: 'go', points: 1 }] }]);
    expect(n.pile).toEqual([]);
    expect(n.turn).toBe(1); // the other player leads the new count
  });

  it('starts again after 31 without a go point', () => {
    const s = pegging(['AH 3D', 'KS 4C'], { pile: pile(1, 'QC JC KC') }); // 30
    const n = play(s, 0, card('AH'))!;
    expect(n.scores).toEqual([2, 0]);
    expect(n.pile).toEqual([]);
    expect(n.turn).toBe(1);
  });

  it('lets the player with cards lead when the other has none', () => {
    const s = pegging(['9D 3D', ''], { pile: pile(1, 'QC JC') });
    s.hands = [cards('9D 3D'), []];
    const n = play(s, 0, card('9D'))!; // 29: go
    expect(n.turn).toBe(0);
    expect(n.pile).toEqual([]);
  });

  it('scores the last card, then moves to the show', () => {
    const s = pegging(['3D', ''], { pile: pile(1, 'QC') });
    s.hands = [cards('3D'), []];
    s.kept = [cards('3D 4D 5D 6D'), cards('7C 8C 9C QC')];
    const n = play(s, 0, card('3D'))!;
    expect(n.phase).toBe('show');
    expect(n.events[0].player).toBe(0); // the show starts with the non-dealer: you
    const hand = total(scoreHand(s.kept[0], s.starter!));
    expect(n.scores[0]).toBe(1 + hand); // last card, then your hand
  });

  it('can win the game with a go point', () => {
    const n = play(pegging(['5H 9D', 'KS'], { pile: pile(1, 'QC JC'), scores: [120, 0] }), 0, card('9D'))!;
    expect(n.phase).toBe('gameOver');
    expect(n.events).toEqual([{ player: 0, items: [{ label: 'go', points: 1 }] }]);
  });

  it('ends the game the moment someone reaches 121', () => {
    const n = play(pegging(['KH 2D', '5S'], { pile: pile(1, '5C'), scores: [120, 90] }), 0, card('KH'))!;
    expect(n.phase).toBe('gameOver');
    expect(n.scores).toEqual([121, 90]);
    expect(winner(n)).toBe(0);
    expect(winner({ ...n, scores: [100, 121] })).toBe(1);
    expect(winner(pegging(['', '']))).toBeNull();
  });
});

describe('the show', () => {
  function shown(): State {
    return pegging(['', ''], {
      phase: 'show',
      showStep: 0,
      starter: card('5C'),
      kept: [cards('5H 5D JC 4S'), cards('2H 4H 6H 8H')],
      crib: cards('10D JD QD KS'),
      pegged: pile(0, '5H 2H 5D 4H JC 6H 4S 8H'),
    });
  }

  it('counts the non-dealer, then the dealer, then the crib', () => {
    const s = shown();
    expect(showHand(s, 0)).toEqual({ player: 0, cards: s.kept[0], crib: false });
    expect(showHand(s, 1)).toEqual({ player: 1, cards: s.kept[1], crib: false });
    expect(showHand(s, 2)).toEqual({ player: 1, cards: s.crib, crib: true });
    let n = nextStep(s)!;
    expect(n.showStep).toBe(1);
    expect(n.scores[1]).toBe(total(scoreHand(s.kept[1], s.starter!)));
    n = nextStep(n)!;
    expect(n.showStep).toBe(2);
    const deal = nextStep(n, seededRng(5))!;
    expect(deal.phase).toBe('discard');
    expect(deal.dealer).toBe(0);
    expect(deal.turn).toBe(1);
    expect(nextStep(deal)).toBeNull();
  });

  it('can end the game during the show', () => {
    const n = nextStep({ ...shown(), scores: [0, 120] })!;
    expect(n.phase).toBe('gameOver');
    expect(winner(n)).toBe(1);
  });
});

describe('computer player', () => {
  it('Strong keeps the fives and the jack', () => {
    const s = pegging(['', '5H 5D 5S JC 9H KD'], { phase: 'discard', dealer: 0 });
    expect(chooseDiscard(s, 1)).toEqual(cards('9H KD'));
  });

  it('Easy throws any two different cards', () => {
    const s = { ...pegging(['', '5H 5D 5S JC 9H KD'], { phase: 'discard' }), level: 'easy' as const };
    const toss = chooseDiscard(s, 1, seededRng(3));
    expect(toss).toHaveLength(2);
    expect(toss[0]).not.toEqual(toss[1]);
  });

  const pick = (hands: [string, string], o: Partial<State>, p: 0 | 1 = 1) => chooseCard(pegging(hands, { turn: p, ...o }), p);

  it('Strong takes a fifteen or a pair', () => {
    expect(pick(['', 'KH 2D 9C'], { pile: pile(0, '5S') })).toEqual(card('KH'));
    expect(pick(['', '7H 2D'], { pile: pile(0, '7S') })).toEqual(card('7H'));
  });

  it('Strong avoids leaving 21, and leads low', () => {
    expect(pick(['', '3H 2D'], { pile: pile(0, '10S 8C') })).toEqual(card('2D')); // 3 would make 21
    expect(pick(['', '9H 4D 5C'], {})).toEqual(card('4D'));
  });

  it('Easy plays any card that fits', () => {
    const s = { ...pegging(['', 'KH 2D'], { turn: 1, pile: pile(0, 'QS JS') }), level: 'easy' as const };
    expect(chooseCard(s, 1, seededRng(2))).toEqual(card('2D'));
  });
});

describe('whole games', () => {
  it.each(['easy', 'strong'] as const)('%s play always finishes the game', (level) => {
    for (let seed = 1; seed <= 3; seed++) {
      const rng = seededRng(seed);
      let s = newGame(level, rng);
      let steps = 0;
      while (s.phase !== 'gameOver') {
        if (s.phase === 'discard') s = discard(s, chooseDiscard(s, 0, rng), rng)!;
        else if (s.phase === 'show') s = nextStep(s, rng)!;
        else s = play(s, s.turn, chooseCard(s, s.turn, rng))!;
        expect(s).not.toBeNull();
        expect(isValidState(s)).toBe(true);
        expect(++steps).toBeLessThan(5000);
      }
      expect(Math.max(...s.scores)).toBe(121);
    }
  });
});

describe('isValidState', () => {
  it('accepts a saved game', () => {
    expect(isValidState(JSON.parse(JSON.stringify(newGame('strong', seededRng(1)))))).toBe(true);
    expect(isFullDeck(pegging(['AH', '2H']).stock.concat(cards('AH 2H 6S 7S 8S 10S KD')))).toBe(true);
  });

  it.each([
    ['null', () => null],
    ['bad level', (s: State) => ({ ...s, level: 'x' })],
    ['bad phase', (s: State) => ({ ...s, phase: 'nap' })],
    ['bad dealer', (s: State) => ({ ...s, dealer: 2 })],
    ['lost a card', (s: State) => ({ ...s, stock: s.stock.slice(1) })],
    ['bad scores', (s: State) => ({ ...s, scores: [0] })],
    ['bad starter', (s: State) => ({ ...s, starter: { suit: 'X', rank: 1 } })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(newGame('strong', seededRng(1))))).toBe(false);
  });
});

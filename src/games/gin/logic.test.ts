import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import {
  applyTurn,
  bestDiscard,
  bestMelds,
  canKnockWith,
  chooseTurn,
  deadwood,
  discard,
  drawDiscard,
  drawStock,
  isValidState,
  layOff,
  newGame,
  nextHand,
  possibleMelds,
  winner,
} from './logic';
import { card, cards, position } from './test-fixtures';

describe('melds and deadwood', () => {
  it('finds sets and runs, aces low', () => {
    const melds = possibleMelds(cards('7H 7S 7D AC 2C 3C 9D'));
    expect(melds).toContainEqual(cards('7H 7S 7D'));
    expect(melds).toContainEqual(cards('AC 2C 3C'));
    expect(possibleMelds(cards('QS KS AS'))).toEqual([]); // no wrapping round
    expect(possibleMelds(cards('7H 7S 7D 7C')).length).toBe(5); // the four, and each three
    expect(possibleMelds(cards('3H 4H 5H 6H')).length).toBe(3); // 3-5, 3-6 and 4-6
  });

  it('picks the melds that leave the least deadwood', () => {
    const { melds, points } = bestMelds(cards('5H 6H 7H 7S 7D 2C 9C KD'));
    expect(points).toBe(5 + 6 + 2 + 9 + 10); // the three 7s leave 32; the 5-6-7 run would leave 35
    expect(melds).toHaveLength(1);
    expect(deadwood(cards('AS 2S 3S 4D 4C 4H 9H 9S 9D KC'))).toBe(10);
    expect(deadwood(cards('AS 2S 3S'))).toBe(0);
  });

  it('counts aces 1 and court cards 10', () => {
    expect(deadwood(cards('AS KH QD 5C'))).toBe(1 + 10 + 10 + 5);
  });

  it('lays off cards on runs and sets', () => {
    const { laid, rest } = layOff([cards('5H 6H 7H'), cards('9S 9D 9C')], cards('4H 8H 3H 9H KC'));
    expect(laid).toEqual(cards('4H 8H 3H 9H'));
    expect(rest).toEqual(cards('KC'));
  });
});

describe('turns', () => {
  it('deals 10 each and turns up a card', () => {
    const s = newGame('easy', seededRng(1));
    expect(s.hands.map((h) => h.length)).toEqual([10, 10]);
    expect(s.discard).toHaveLength(1);
    expect(s.turn).toBe(0);
    expect(isFullDeck([...s.hands.flat(), ...s.stock, ...s.discard])).toBe(true);
  });

  it('draws from the stock or the pile, then discards', () => {
    const s = position(['AS 2S 3S 4D 4C 4H 9H 9S 9D KC', '2H 3H 4S 5D 6C 7S 8D 10C JH QS'], '5S');
    expect(drawStock(s, 1)).toBeNull();
    const fromStock = drawStock(s, 0)!;
    expect(fromStock.hands[0]).toHaveLength(11);
    expect(fromStock.phase).toBe('discard');
    expect(drawStock(fromStock, 0)).toBeNull();
    const fromPile = drawDiscard(s, 0)!;
    expect(fromPile.taken).toEqual(card('5S'));
    expect(discard(fromPile, 0, card('5S'))).toBeNull(); // can't throw back the card just taken
    expect(discard(fromPile, 0, card('2H'))).toBeNull(); // not in hand
    const n = discard(fromPile, 0, card('KC'))!;
    expect(n.turn).toBe(1);
    expect(n.phase).toBe('draw');
    expect(n.discard.at(-1)).toEqual(card('KC'));
    expect(drawDiscard({ ...s, discard: [] }, 0)).toBeNull();
  });

  it('calls the hand a draw when the stock is nearly gone', () => {
    const s = position(['AS 2S 3S 4D 4C 4H 9H 9S 9D KC', '2H 3H 4S 5D 6C 7S 8D 10C JH QS'], '5S');
    s.phase = 'discard';
    s.hands[0].push(s.stock.pop()!);
    s.discard = [...s.discard, ...s.stock.splice(0, s.stock.length - 2)];
    const n = discard(s, 0, card('KC'))!;
    expect(n.phase).toBe('handOver');
    expect(n.last!.kind).toBe('draw');
    expect(n.scores).toEqual([0, 0]);
  });
});

describe('knocking', () => {
  const ready = (mine: string, theirs: string) => {
    const s = position([mine, theirs], '5S', { phase: 'discard' });
    return s;
  };

  it('knocks with 10 or less, and the lower deadwood scores the difference', () => {
    // You: A-2-3 spades, 4s, 9s; deadwood KC... discard KC, keep 2C: 2 deadwood.
    const s = ready('AS 2S 3S 4D 4C 4H 9H 9S 9D KC 2C', '2H 3H 4S 5D 6C 7S 8D 10C JH QS');
    expect(canKnockWith(s, 0, card('KC'))).toBe(true);
    expect(canKnockWith(s, 0, card('AS'))).toBe(false);
    expect(discard(s, 0, card('AS'), true)).toBeNull();
    const n = discard(s, 0, card('KC'), true)!;
    expect(n.last!.kind).toBe('knock');
    expect(n.last!.winner).toBe(0);
    expect(n.last!.deadwood[0]).toBe(2);
    expect(n.last!.points).toBe(n.last!.deadwood[1] - 2);
    expect(n.phase).toBe('handOver');
  });

  it('scores gin with a bonus and no lay-offs', () => {
    const gin = ready('AS 2S 3S 4D 4C 4H 9H 9S 9D 9C KC', '4S 5H 6C 7S 8D 10C JH QS KH 2D');
    const n = discard(gin, 0, card('KC'), true)!;
    expect(n.last!.kind).toBe('gin');
    expect(n.last!.points).toBe(25 + n.last!.deadwood[1]);
  });

  it('gives the defender an undercut bonus when they tie or beat the knocker', () => {
    const s = ready('AS 2S 3S 4D 4C 4H 9H 9S 9D 8C KC', '5H 6H 7H JD JS JC QH QS QD AC');
    const n = discard(s, 0, card('KC'), true)!;
    expect(n.last!.kind).toBe('undercut');
    expect(n.last!.winner).toBe(1);
    expect(n.last!.points).toBe(25 + 8 - 1);
  });

  it('lets the defender lay off on the knocker’s melds', () => {
    const s = ready('5H 6H 7H 4D 4C 4S 9H 9S 9D 2C KC', '8H 3H 4H JD JS QC QH KS KD AC');
    const n = discard(s, 0, card('KC'), true)!;
    // The defender lays off the 8 of hearts on 5-6-7, and the 4 of hearts on the 4s.
    expect(n.last!.deadwood[1]).toBe(deadwood(cards('3H JD JS QC QH KS KD AC')));
  });

  it('ends the game at 100 and deals the next hand otherwise', () => {
    const s = ready('AS 2S 3S 4D 4C 4H 9H 9S 9D 9C KC', '4S 5H 6C 7S 8D 10C JH QS KH 2D');
    const over = discard({ ...s, scores: [90, 0] }, 0, card('KC'), true)!;
    expect(over.phase).toBe('gameOver');
    expect(winner(over)).toBe(0);
    expect(nextHand(over)).toBeNull();
    const hand = discard(s, 0, card('KC'), true)!;
    expect(winner(hand)).toBeNull();
    const next = nextHand(hand, seededRng(3))!;
    expect(next.dealer).toBe(0);
    expect(next.turn).toBe(1);
    expect(next.scores).toEqual(hand.scores);
  });
});

describe('computer player', () => {
  it('Strong takes the pile when it helps, and throws its worst card', () => {
    const s = position(['2H 3H 4S 5D 6C 7S 8D 10C JH QS', '7H 7D 2C 9C KD AS 3S 5H 8S 10D'], '7C', { turn: 1 });
    expect(chooseTurn(s, 1)).toEqual({ action: 'pile' });
    expect(chooseTurn(position(['', '7H 7D 2C 9C KD AS 3S 5H 8S 10D'], 'QC', { turn: 1 }), 1)).toEqual({ action: 'stock' });
    const after = drawDiscard(s, 1)!;
    expect(bestDiscard(after, 1)).toEqual(card('KD'));
    expect(chooseTurn(after, 1)).toEqual({ action: 'discard', card: card('KD'), knock: false });
  });

  it('Strong knocks as soon as it can; Easy waits for less deadwood', () => {
    const s = position(['', 'AS 2S 3S 4D 4C 4H 9H 9S 9D KC 2C'], '5S', { turn: 1, phase: 'discard' });
    expect(chooseTurn(s, 1)).toEqual({ action: 'discard', card: card('KC'), knock: true });
    const easy = { ...position(['', 'AS 2S 3S 4D 4C 4H 9H 9S 9D KC 8C'], '5S', { turn: 1, phase: 'discard' }), level: 'easy' as const };
    const t = chooseTurn(easy, 1, seededRng(1));
    expect(t.action === 'discard' && t.knock).toBe(false);
  });

  it('Easy takes the pile only to make a meld', () => {
    const s = { ...position(['', '7H 7D 2C 9C KD AS 3S 5H 8S 10D'], '7C', { turn: 1 }), level: 'easy' as const };
    expect(chooseTurn(s, 1)).toEqual({ action: 'pile' });
    expect(chooseTurn({ ...s, discard: cards('QC') }, 1)).toEqual({ action: 'stock' });
    expect(chooseTurn({ ...s, discard: [] }, 1)).toEqual({ action: 'stock' });
  });

  it.each(['easy', 'strong'] as const)('%s players finish whole games', (level) => {
    for (let seed = 1; seed <= 3; seed++) {
      const rng = seededRng(seed);
      let s = newGame(level, rng);
      for (let steps = 0; s.phase !== 'gameOver'; steps++) {
        s = s.phase === 'handOver' ? nextHand(s, rng)! : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng))!;
        expect(s).not.toBeNull();
        expect(steps).toBeLessThan(20000);
      }
      expect(isValidState(s)).toBe(true);
    }
  });

  it('validates saved games', () => {
    const s = newGame('strong', seededRng(2));
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...s, level: 'x' })).toBe(false);
    expect(isValidState({ ...s, phase: 'x' })).toBe(false);
    expect(isValidState({ ...s, stock: s.stock.slice(1) })).toBe(false);
    expect(isValidState({ ...s, taken: { suit: 'X', rank: 1 } })).toBe(false);
  });
});

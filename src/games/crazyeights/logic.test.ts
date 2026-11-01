import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import { applyTurn, bestSuit, canPlay, cardPoints, chooseTurn, draw, isValidState, newGame, nextRound, pass, play, playable, winner, type State } from './logic';
import { card, cards, position } from './test-fixtures';

describe('crazy eights', () => {
  it('deals 5 each and turns up a card that isn’t an 8', () => {
    for (let seed = 1; seed < 20; seed++) {
      const s = newGame('easy', seededRng(seed));
      expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
      expect(s.discard[0].rank).not.toBe(8);
      expect(s.suit).toBe(s.discard[0].suit);
      expect(s.turn).toBe(0);
      expect(isFullDeck([...s.hands.flat(), ...s.stock, ...s.discard])).toBe(true);
    }
  });

  it('scores 8s 50, court cards 10, aces 1, others their number', () => {
    expect(cards('8S KH QD JC AS 7H').map(cardPoints)).toEqual([50, 10, 10, 10, 1, 7]);
  });

  it('matches the suit or rank, and 8s anywhere', () => {
    const s = position(['7H 2C 8D KS', '', '', ''], '7S');
    expect(playable(s, 0)).toEqual(cards('7H 8D KS'));
    expect(canPlay(s, card('2C'))).toBe(false);
    expect(playable(s, 1)).toEqual([]); // not their turn
  });

  it('plays a card and passes the turn; an 8 names the suit', () => {
    let s = position(['7H 8D KS', 'AC', 'AD', 'AH'], '7S');
    expect(play(s, 0, card('2C'))).toBeNull();
    expect(play(s, 0, card('8D'))).toBeNull(); // must name a suit
    s = play(s, 0, card('8D'), 'C')!;
    expect(s.suit).toBe('C');
    expect(s.lastPlay[0]).toEqual(card('8D'));
    expect(s.turn).toBe(1);
    expect(playable(s, 1)).toEqual(cards('AC'));
  });

  it('draws only when you can’t play, shuffling the discards back if needed', () => {
    const s = position(['2C', 'AC', 'AD', 'AH'], '7S');
    expect(draw(position(['7H', '', '', ''], '7S'), 0)).toBeNull();
    expect(draw(s, 1)).toBeNull();
    const n = draw(s, 0)!;
    expect(n.hands[0]).toHaveLength(2);
    const dry = position(['2C', '', '', ''], '3H 9D 7S', { stock: [] });
    const reshuffled = draw(dry, 0, seededRng(1))!;
    expect(reshuffled.discard).toEqual(cards('7S'));
    expect(reshuffled.hands[0]).toHaveLength(2);
    expect(reshuffled.stock).toHaveLength(1);
  });

  it('passes only when there’s nothing to draw', () => {
    const empty = position(['2C', '', '', ''], '7S', { stock: [] });
    expect(pass(position(['2C', '', '', ''], '7S'), 0)).toBeNull();
    expect(pass(position(['7C', '', '', ''], '7S', { stock: [] }), 0)).toBeNull();
    expect(draw(empty, 0)).toBeNull();
    expect(pass(empty, 0)!.turn).toBe(1);
    expect(pass(empty, 1)).toBeNull();
  });

  it('ends the round when a hand empties, scoring the cards left', () => {
    const s = play(position(['7H', '8C KD', '2S', 'AH'], '7S'), 0, card('7H'))!;
    expect(s.phase).toBe('roundOver');
    expect(s.last).toEqual({ seat: 0, points: 50 + 10 + 2 + 1 });
    expect(s.scores).toEqual([63, 0, 0, 0]);
    const next = nextRound(s, seededRng(2))!;
    expect(next.dealer).toBe(0);
    expect(next.turn).toBe(1);
    expect(next.scores).toEqual([63, 0, 0, 0]);
    expect(nextRound(next)).toBeNull();
  });

  it('ends the game at 100', () => {
    const s = play(position(['7H', '8C', '2S', 'AH'], '7S', { scores: [60, 0, 0, 0] }), 0, card('7H'))!;
    expect(s.phase).toBe('gameOver');
    expect(winner(s)).toBe(0);
    expect(winner(position(['7H', '', '', ''], '7S'))).toBeNull();
  });

  it('finds the suit a hand holds most of', () => {
    expect(bestSuit(cards('2H 3H 4C 8S 8S'))).toBe('H');
  });

  it('Strong saves its 8s, plays from its longest suit, and names its best suit', () => {
    const strong = (hand: string, top = '7S', o: Partial<State> = {}) => chooseTurn(position([hand, 'AC AD', 'AH 2H', '3H 4H'], top, o), 0);
    expect(strong('8D 7H 2S 3S')).toEqual({ action: 'play', card: card('3S') });
    expect(strong('8D 2C 3C')).toEqual({ action: 'play', card: card('8D'), suit: 'C' });
    expect(strong('2C 3C')).toEqual({ action: 'draw' });
    expect(chooseTurn(position(['2C', '', '', ''], '7S', { stock: [] }), 0)).toEqual({ action: 'pass' });
    // An opponent about to go out, and only two cards left: use the 8 to change the suit.
    expect(chooseTurn(position(['8D 7H', 'AC', 'AH 2H', '3H 4H'], '7S'), 0)).toEqual({ action: 'play', card: card('8D'), suit: 'H' });
  });

  it('Easy plays any card it can', () => {
    const s = position(['8D 7H 2C', '', '', ''], '7S', { level: 'easy' });
    for (let seed = 1; seed < 10; seed++) {
      const t = chooseTurn(s, 0, seededRng(seed));
      expect(applyTurn(s, 0, t)).not.toBeNull();
    }
  });

  it('applies draws and passes', () => {
    expect(applyTurn(position(['2C', '', '', ''], '7S'), 0, { action: 'draw' })!.hands[0]).toHaveLength(2);
    expect(applyTurn(position(['2C', '', '', ''], '7S', { stock: [] }), 0, { action: 'pass' })!.turn).toBe(1);
  });

  it.each(['easy', 'strong'] as const)('%s players finish whole games', (level) => {
    for (let seed = 1; seed <= 5; seed++) {
      const rng = seededRng(seed);
      let s = newGame(level, rng);
      for (let steps = 0; s.phase !== 'gameOver'; steps++) {
        s = s.phase === 'roundOver' ? nextRound(s, rng)! : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng), rng)!;
        expect(s).not.toBeNull();
        expect(steps).toBeLessThan(20000);
      }
      expect(isValidState(s)).toBe(true);
    }
  });

  it('validates saved games', () => {
    const s = newGame('strong', seededRng(1));
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...s, level: 'x' })).toBe(false);
    expect(isValidState({ ...s, suit: 'X' })).toBe(false);
    expect(isValidState({ ...s, discard: [] })).toBe(false);
    expect(isValidState({ ...s, stock: s.stock.slice(1) })).toBe(false);
    expect(isValidState({ ...s, scores: [0] })).toBe(false);
  });
});

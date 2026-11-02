import { describe, expect, it } from 'vitest';
import { isFullDeck, newDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import { applyTurn, canPlay, cardPoints, chooseTurn, draw, isValidState, newGame, nextRound, pass, play, playable, winner, type State } from './logic';
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

  it('remembers suits a player lacks: they drew or passed on it, until they play it', () => {
    const drew = draw(position(['2C', '3H', '4H', '5H'], '7S'), 0)!;
    expect(drew.voids![0]).toEqual(['S']);
    expect(draw(drew, 0)!.voids![0]).toEqual(['S']); // noted once
    const played = play({ ...position(['2S 4D', '3H', '4H', '5H'], '7S'), voids: [['S', 'D'], [], [], []] }, 0, card('2S'))!;
    expect(played.voids![0]).toEqual(['D']);
    const eight = play({ ...position(['8S 4D', '3H', '4H', '5H'], '7S'), voids: [['S'], [], [], []] }, 0, card('8S'), 'H')!;
    expect(eight.voids![0]).toEqual(['S']); // an 8 says nothing about spades
    const rest = newDeck().filter((c) => !(c.rank === 2 && c.suit === 'C') && !(c.rank === 12 && c.suit === 'S') && c.rank !== 8 && c.suit !== 'S');
    const stuck = { ...position(['2C', '', '', ''], 'QS', { stock: [] }), hands: [cards('2C'), newDeck().filter((c) => c.rank === 8 || (c.suit === 'S' && c.rank !== 12)), rest, []] };
    expect(pass(stuck, 0)!.voids![0]).toEqual(['S']);
    // Games saved before this was added have no record, and still play.
    const { voids: _old, ...before } = position(['2C', '3H', '4H', '5H'], '7S');
    expect(isValidState(before)).toBe(true);
    expect(draw(before as State, 0)!.voids).toEqual([['S'], [], [], []]);
    expect(chooseTurn({ ...(before as State), hands: [cards('7H 2S 3S'), cards('AC'), cards('AH'), cards('3H')] }, 0)).toMatchObject({ action: 'play' });
  });

  it('Strong keeps its options open and sheds high cards', () => {
    const strong = (hand: string, top = '7S', o: Partial<State> = {}) => chooseTurn(position([hand, 'AC AD', 'AH 2H', '3H 4H'], top, o), 0);
    // Any spade leaves two spades to follow, the 7 of hearts leaves none: shed the king.
    expect(strong('7H 2S 3S KS')).toEqual({ action: 'play', card: card('KS') });
    expect(strong('2C 3C')).toEqual({ action: 'draw' });
    expect(chooseTurn(position(['2C', '', '', ''], '7S', { stock: [] }), 0)).toEqual({ action: 'pass' });
  });

  it('Strong keeps its 8s unless they clearly help, and names its best suit', () => {
    const strong = (hand: string, top = '7S', o: Partial<State> = {}) => chooseTurn(position([hand, 'AC AD', 'AH 2H', '3H 4H'], top, o), 0);
    expect(strong('8D 7H 2S 3S')).toMatchObject({ card: { suit: 'S' } }); // a spade, keeping the 8
    expect(strong('8D 2C 3C')).toEqual({ action: 'play', card: card('8D'), suit: 'C' }); // no other play
  });

  it('Strong switches to a suit the next player lacks, and blocks someone about to go out', () => {
    // West (next) is known to lack hearts: switch to hearts with the 7 of hearts.
    const starve = position(['7H 2S 9H', 'AC AD', 'AH 2H', '3H 4H'], '7S', { voids: [[], ['H'], [], []] });
    expect(chooseTurn(starve, 0)).toEqual({ action: 'play', card: card('7H') });
    // North has one card and lacks clubs: spend the 8 to name clubs.
    const block = position(['8D 2S 3S', 'AC AD', 'AH', '3H 4H'], '7S', { voids: [[], [], ['C'], []] });
    expect(chooseTurn(block, 0)).toEqual({ action: 'play', card: card('8D'), suit: 'C' });
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

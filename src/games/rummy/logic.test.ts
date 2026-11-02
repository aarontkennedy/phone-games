import { describe, expect, it } from 'vitest';
import { isFullDeck } from '../../core/cards';
import { seededRng } from '../../core/random';
import {
  applyTurn,
  canTake,
  cardPoints,
  chooseTurn,
  discard,
  drawStock,
  fits,
  isMeld,
  isRun,
  isSet,
  isValidState,
  layOff,
  meld,
  meldPoints,
  meldable,
  newGame,
  nextHand,
  possibleMelds,
  sortMeld,
  takePile,
  undoTake,
  winner,
  type State,
} from './logic';
import { card, cards, position } from './test-fixtures';

describe('rummy 500 melds', () => {
  it('knows sets and runs, with aces low or high but not around the corner', () => {
    expect(isSet(cards('7H 7S 7D'))).toBe(true);
    expect(isSet(cards('7H 7S'))).toBe(false);
    expect(isRun(cards('5H 6H 7H 8H'))).toBe(true);
    expect(isRun(cards('AH 2H 3H'))).toBe(true);
    expect(isRun(cards('QH KH AH'))).toBe(true);
    expect(isRun(cards('KH AH 2H'))).toBe(false);
    expect(isRun(cards('5H 6H 7S'))).toBe(false);
    expect(isRun(cards('5H 6H 8H'))).toBe(false);
    expect(isMeld(cards('7H 7S 7D 8H'))).toBe(false);
    expect(sortMeld(cards('AH KH QH')).map((c) => c.rank)).toEqual([12, 13, 1]);
    expect(sortMeld(cards('7C 7S 7H')).map((c) => c.suit)).toEqual(['S', 'H', 'C']);
  });

  it('scores aces 15, but 1 in a low run; 10s and court cards 10', () => {
    expect(cards('AS KH 10D 9C 2S').map(cardPoints)).toEqual([15, 10, 10, 9, 2]);
    expect(meldPoints(cards('AH 2H 3H'))).toBe(6);
    expect(meldPoints(cards('QH KH AH'))).toBe(35);
    expect(meldPoints(cards('AH AS AD'))).toBe(45);
  });

  it('finds every meld in a hand, including high-ace runs', () => {
    const melds = possibleMelds(cards('QH KH AH 7S 7D 7C 7H'));
    expect(melds.some((m) => isRun(m) && m.length === 3)).toBe(true);
    expect(melds.filter(isSet)).toHaveLength(5); // all four, and each three
    expect(possibleMelds(cards('2C 9D'))).toEqual([]);
    // A whole suit: the ace can't sit at both ends of one run.
    const suit = possibleMelds(cards('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS KS'));
    expect(Math.max(...suit.map((m) => m.length))).toBe(13);
  });

  it('finds where cards lay off', () => {
    const table = [cards('5H 6H 7H'), cards('9S 9D 9C')];
    expect(fits(table, cards('8H'))).toBe(0);
    expect(fits(table, cards('9H'))).toBe(1);
    expect(fits(table, cards('2C'))).toBe(-1);
    expect(fits(table, [])).toBe(-1);
    expect(meldable(cards('8H 9H 2C 2D 2S KC'), table)).toEqual({ points: 6 + 8 + 9, left: cards('KC') });
  });
});

describe('rummy 500 hands', () => {
  it('deals 13 each and turns up one card', () => {
    const s = newGame('easy', seededRng(3));
    expect(s.hands.map((h) => h.length)).toEqual([13, 13]);
    expect(s.discard).toHaveLength(1);
    expect(s.stock).toHaveLength(25);
    expect(s.turn).toBe(0);
    expect(isFullDeck([...s.hands.flat(), ...s.stock, ...s.discard])).toBe(true);
  });

  it('draws from the deck, then melds, lays off and discards', () => {
    let s = drawStock(position(['5H 6H 7H 8H 9S KC', '2C'], 'JD'), 0)!;
    expect(s.phase).toBe('play');
    expect(drawStock(s, 0)).toBeNull();
    expect(meld(s, 0, cards('5H 6H 9S'))).toBeNull();
    expect(meld(s, 0, cards('5H 6H 2C'))).toBeNull(); // not in your hand
    s = meld(s, 0, cards('7H 5H 6H'))!;
    expect(s.table).toEqual([cards('5H 6H 7H')]);
    expect(s.melded).toEqual([18, 0]);
    expect(layOff(s, 0, cards('9S'), 0)).toBeNull();
    expect(layOff(s, 0, cards('8H'), 3)).toBeNull();
    s = layOff(s, 0, cards('8H'), 0)!;
    expect(s.melded).toEqual([26, 0]);
    expect(s.action).toEqual({ player: 0, kind: 'layoff', cards: cards('8H') });
    s = discard(s, 0, card('KC'))!;
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('draw');
    expect(s.discard.at(-1)).toEqual(card('KC'));
  });

  it('takes from the pile only a card you can meld, and every card above it', () => {
    const s = position(['7H 7S 2C', 'KD'], '7D 4S 9C', ['3H 4H 5H']);
    expect(canTake(s, 0, 0)).toBe(true);
    expect(canTake(s, 0, 1)).toBe(false);
    expect(canTake(s, 0, 2)).toBe(false);
    expect(canTake(s, 0, 3)).toBe(false);
    expect(takePile(s, 0, 1)).toBeNull();
    const took = takePile(s, 0, 0)!;
    expect(took.hands[0]).toHaveLength(6);
    expect(took.discard).toEqual([]);
    expect(took.mustUse).toEqual(card('7D'));
    // The card you took must come first, and it must be melded before you discard.
    expect(discard(took, 0, card('2C'))).toBeNull();
    expect(meld(took, 0, cards('2C 3C 4C'))).toBeNull();
    const melded = meld(took, 0, cards('7H 7S 7D'))!;
    expect(melded.mustUse).toBeNull();
    expect(melded.before).toBeNull();
    expect(discard(melded, 0, card('4S'))!.turn).toBe(1);
    // A card that lays off on the table may be taken too.
    expect(canTake(position(['2C', 'KD'], '6H'), 0, 0)).toBe(false);
    expect(canTake(position(['2C', 'KD'], '6H', ['3H 4H 5H']), 0, 0)).toBe(true);
  });

  it('puts the pile back on Undo', () => {
    const s = position(['7H 7S 2C', 'KD'], '7D 4S 9C');
    const took = takePile(s, 0, 0)!;
    const undone = undoTake(took, 0)!;
    expect(undone.hands[0]).toEqual(s.hands[0]);
    expect(undone.discard).toEqual(s.discard);
    expect(undone.phase).toBe('draw');
    expect(undoTake(undone, 0)).toBeNull();
    const theirs = takePile({ ...s, hands: [cards('KD'), cards('7H 7S 2C')], turn: 1 }, 1, 0)!;
    expect(undoTake(theirs, 1)!.hands[1]).toEqual(cards('7H 7S 2C'));
  });

  it('ends the hand when someone goes out, scoring melded minus held', () => {
    const s = position(['7H 7S 7D', 'KD AS 2C'], '9C', [], { phase: 'play', melded: [10, 20] });
    const out = meld(s, 0, cards('7H 7S 7D'))!;
    expect(out.phase).toBe('handOver');
    expect(out.last).toEqual({ melded: [31, 20], held: [0, 27], points: [31, -7], out: 0 });
    expect(out.scores).toEqual([31, -7]);
    const next = nextHand(out, seededRng(1))!;
    expect(next.dealer).toBe(0);
    expect(next.turn).toBe(1);
    expect(next.scores).toEqual([31, -7]);
    expect(nextHand(next)).toBeNull();

    const lastCard = discard(position(['9H', 'KD'], '2C', [], { phase: 'play' }), 0, card('9H'))!;
    expect(lastCard.last!.out).toBe(0);
  });

  it('ends the hand when the deck runs out, and the game at 500', () => {
    const base = position(['9H 2S', 'KD'], '2C', [], { phase: 'play' });
    const dry = discard({ ...base, stock: [], hands: [cards('9H 2S'), [...cards('KD'), ...base.stock]] }, 0, card('9H'))!;
    expect(dry.last!.out).toBeNull();

    const near = position(['7H 7S 7D', 'KD'], '9C', [], { phase: 'play', scores: [480, 300] });
    const won = meld(near, 0, cards('7H 7S 7D'))!;
    expect(won.phase).toBe('gameOver');
    expect(winner(won)).toBe(0);
    const behind = position(['7H 7S 7D', 'KD'], '9C', [], { phase: 'play', scores: [300, 600] });
    expect(winner(meld(behind, 0, cards('7H 7S 7D'))!)).toBe(1);
    // Level at 500 or more: play another hand.
    const level = position(['7H 7S 7D', 'KD'], '9C', [], { phase: 'play', scores: [500, 531] });
    expect(meld(level, 0, cards('7H 7S 7D'))!.phase).toBe('handOver');
    expect(winner(level)).toBeNull();
  });
});

describe('rummy 500 computer', () => {
  it('Easy takes the top of the pile only when it can meld it', () => {
    const s = position(['2C', '7H 7S KD'], '4C 7D', [], { level: 'easy', turn: 1 });
    expect(chooseTurn(s, 1)).toEqual({ action: 'pile', index: 1 });
    expect(chooseTurn({ ...s, discard: cards('7D 4C') }, 1)).toEqual({ action: 'stock' });
  });

  it('Strong digs into the pile when it pays, and draws otherwise', () => {
    const s = position(['2C', '7H 7S KD QD'], '7D JD 3S', [], { turn: 1 });
    expect(chooseTurn(s, 1)).toEqual({ action: 'pile', index: 0 });
    expect(chooseTurn(position(['2C', '7H 8S'], '4D'), 1)).toEqual({ action: 'stock' });
  });

  it('melds the card it took first, then lays off, melds, and throws its least useful card', () => {
    const took = takePile(position(['2C', '7H 7S 9D'], '7D', ['3H 4H 5H'], { turn: 1 }), 1, 0)!;
    expect(chooseTurn(took, 1)).toMatchObject({ action: 'meld' });
    const onTable = takePile(position(['2C', '9D 2S'], '6H', ['3H 4H 5H'], { turn: 1 }), 1, 0)!;
    expect(chooseTurn(onTable, 1)).toEqual({ action: 'layoff', cards: cards('6H'), meld: 0 });

    const play = position(['2C', '6H KS 9C 9D 9S QD JD'], '4C', ['3H 4H 5H'], { turn: 1, phase: 'play' });
    expect(chooseTurn(play, 1)).toEqual({ action: 'layoff', cards: cards('6H'), meld: 0 });
    const loose = position(['2C', 'KS QD JD 2S'], '4C', [], { turn: 1, phase: 'play' });
    expect(chooseTurn(loose, 1)).toEqual({ action: 'discard', card: card('KS') });
  });

  it('Easy melds but never lays off, and throws at random', () => {
    const s = position(['2C', '6H KS 9C 9D 9S'], '4C', ['3H 4H 5H'], { level: 'easy', turn: 1, phase: 'play' });
    expect(chooseTurn(s, 1)).toEqual({ action: 'meld', cards: cards('9C 9D 9S') });
    const t = chooseTurn({ ...s, hands: [cards('2C'), cards('6H KS')] }, 1, seededRng(1));
    expect(t.action).toBe('discard');
    for (const turn of [{ action: 'stock' as const }, { action: 'pile' as const, index: 0 }]) expect(applyTurn(s, 1, turn)).toBeNull();
    expect(applyTurn(s, 1, { action: 'layoff', cards: cards('6H'), meld: 0 })).not.toBeNull();
  });

  it('rejects broken saves', () => {
    const good = position(['7H', '7S'], '2C', ['3H 4H 5H']);
    expect(isValidState(good)).toBe(true);
    expect(isValidState({ ...good, before: { hand: [], discard: [] } })).toBe(true);
    const bad: unknown[] = [
      null,
      { ...good, level: 'hard' },
      { ...good, phase: 'done' },
      { ...good, turn: 2 },
      { ...good, hands: [[]] },
      { ...good, stock: 'x' },
      { ...good, table: [cards('3H 4H 6H')] },
      { ...good, melded: [1] },
      { ...good, mustUse: 'x' },
      { ...good, before: { hand: 'x' } },
      { ...good, stock: good.stock.slice(1) },
    ];
    for (const b of bad) expect(isValidState(b as State)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { isFullDeck, type Card, type Suit } from '../../core/cards';
import { seededRng } from '../../core/random';
import {
  autoFinish,
  bestTarget,
  canAutoFinish,
  canFound,
  canStack,
  cardsAt,
  draw,
  findHint,
  isLegal,
  isStuck,
  isValidState,
  move,
  newState,
  type State,
} from './logic';
import { blank, card, cards, oneMoveFromWinning, upTo } from './test-fixtures';

const allCards = (s: State) => [
  ...s.stock,
  ...s.waste,
  ...s.foundations.flat(),
  ...s.tableau.flatMap((c) => [...c.down, ...c.up]),
];

describe('newState', () => {
  it('deals 1 to 7 cards with only the top one face up, and 24 to the stock', () => {
    const s = newState(3, seededRng(1));
    expect(s.draw).toBe(3);
    s.tableau.forEach((col, i) => {
      expect(col.down).toHaveLength(i);
      expect(col.up).toHaveLength(1);
    });
    expect(s.stock).toHaveLength(24);
    expect(s.waste).toEqual([]);
    expect(isFullDeck(allCards(s))).toBe(true);
  });

  it('deals the same game from the same seed', () => {
    expect(newState(1, seededRng(5))).toEqual(newState(1, seededRng(5)));
    expect(newState(1, seededRng(5))).not.toEqual(newState(1, seededRng(6)));
  });
});

describe('draw', () => {
  it('turns over one card in Draw 1', () => {
    const s = { ...blank(), stock: cards('2S 3S 4S') };
    const n = draw(s)!;
    expect(n.stock).toEqual(cards('2S 3S'));
    expect(n.waste).toEqual(cards('4S'));
    expect(n.moves).toBe(1);
    expect(s.stock).toHaveLength(3); // original untouched
  });

  it('turns over three cards in Draw 3, or what is left', () => {
    const s: State = { ...blank(), draw: 3, stock: cards('2S 3S 4S 5S') };
    const n = draw(s)!;
    expect(n.stock).toEqual(cards('2S'));
    expect(n.waste).toEqual(cards('5S 4S 3S'));
    expect(draw(n)!.waste).toEqual(cards('5S 4S 3S 2S'));
  });

  it('turns the waste back over when the stock runs out, keeping the order', () => {
    let s: State = { ...blank(), stock: cards('2S 3S 4S') };
    s = draw(draw(draw(s)!)!)!;
    expect(s.stock).toEqual([]);
    s = draw(s)!;
    expect(s.waste).toEqual([]);
    expect(s.stock).toEqual(cards('2S 3S 4S'));
    expect(s.moves).toBe(4);
  });

  it('does nothing when the stock and waste are both empty', () => {
    expect(draw(blank())).toBeNull();
  });
});

describe('cardsAt', () => {
  const s: State = {
    ...blank(),
    waste: cards('2S 3H'),
    foundations: [upTo('S', 2), [], [], []],
  };
  s.tableau[0] = { down: cards('KD'), up: cards('9C 8H 7S') };

  it('picks up the top waste card, top foundation card, or a tableau run', () => {
    expect(cardsAt(s, { from: 'waste' })).toEqual(cards('3H'));
    expect(cardsAt(s, { from: 'foundation', suit: 0 })).toEqual(cards('2S'));
    expect(cardsAt(s, { from: 'tableau', col: 0, index: 1 })).toEqual(cards('8H 7S'));
  });

  it('picks up nothing from empty or missing places', () => {
    expect(cardsAt(blank(), { from: 'waste' })).toEqual([]);
    expect(cardsAt(s, { from: 'foundation', suit: 1 })).toEqual([]);
    expect(cardsAt(s, { from: 'foundation', suit: 9 })).toEqual([]);
    expect(cardsAt(s, { from: 'tableau', col: 0, index: 3 })).toEqual([]);
    expect(cardsAt(s, { from: 'tableau', col: 0, index: -1 })).toEqual([]);
    expect(cardsAt(s, { from: 'tableau', col: 9, index: 0 })).toEqual([]);
  });
});

describe('stacking rules', () => {
  it('puts only a king on an empty column', () => {
    expect(canStack(card('KH'), { down: [], up: [] })).toBe(true);
    expect(canStack(card('QH'), { down: [], up: [] })).toBe(false);
    expect(canStack(card('KH'), { down: cards('2C'), up: [] })).toBe(false);
  });

  it('builds down in alternating colors', () => {
    const col = { down: [], up: cards('9S') };
    expect(canStack(card('8H'), col)).toBe(true);
    expect(canStack(card('8D'), col)).toBe(true);
    expect(canStack(card('8C'), col)).toBe(false); // same color
    expect(canStack(card('7H'), col)).toBe(false); // wrong rank
  });

  it('builds foundations up by suit from the ace', () => {
    const s: State = { ...blank(), foundations: [upTo('S', 1), [], [], []] };
    expect(canFound(s, card('AH'))).toBe(true);
    expect(canFound(s, card('2S'))).toBe(true);
    expect(canFound(s, card('3S'))).toBe(false);
    expect(canFound(s, card('2H'))).toBe(false);
  });
});

describe('move', () => {
  function sample(): State {
    const s: State = { ...blank(), waste: cards('AH 8D'), foundations: [upTo('S', 3), [], [], []] };
    s.tableau[0] = { down: cards('2C 5H'), up: cards('9S') };
    s.tableau[1] = { down: [], up: cards('10H 9C 8H') };
    s.tableau[2] = { down: [], up: [] };
    s.tableau[3] = { down: [], up: cards('5D') };
    return s;
  }

  it('moves the waste card onto a column', () => {
    const n = move(sample(), { from: 'waste' }, { to: 'tableau', col: 0 })!;
    expect(n.tableau[0].up).toEqual(cards('9S 8D'));
    expect(n.waste).toEqual(cards('AH'));
    expect(n.moves).toBe(1);
  });

  it('moves a run between columns and turns over the card underneath', () => {
    const s = sample();
    s.tableau[4] = { down: [], up: cards('10D') };
    const n = move(s, { from: 'tableau', col: 0, index: 0 }, { to: 'tableau', col: 4 })!;
    expect(n.tableau[4].up).toEqual(cards('10D 9S'));
    expect(n.tableau[0]).toEqual({ down: cards('2C'), up: cards('5H') });
  });

  it('moves a single card to its foundation, and back down to a column', () => {
    let s = sample();
    s.tableau[5] = { down: [], up: cards('5H 4S') };
    s = move(s, { from: 'tableau', col: 5, index: 1 }, { to: 'foundation' })!;
    expect(s.foundations[0]).toEqual(upTo('S', 4));
    s = move(s, { from: 'foundation', suit: 0 }, { to: 'tableau', col: 5 })!;
    expect(s.tableau[5].up).toEqual(cards('5H 4S'));
  });

  it('refuses illegal moves', () => {
    const s = sample();
    expect(move(s, { from: 'tableau', col: 1, index: 0 }, { to: 'foundation' })).toBeNull(); // several cards
    expect(move(s, { from: 'foundation', suit: 0 }, { to: 'foundation' })).toBeNull();
    expect(move(s, { from: 'tableau', col: 1, index: 2 }, { to: 'tableau', col: 1 })).toBeNull(); // same column
    expect(move(s, { from: 'waste' }, { to: 'tableau', col: 9 })).toBeNull();
    expect(move(s, { from: 'waste' }, { to: 'tableau', col: 2 })).toBeNull(); // not a king
    expect(move(blank(), { from: 'waste' }, { to: 'foundation' })).toBeNull();
    expect(isLegal(s, { from: 'tableau', col: 3, index: 0 }, { to: 'tableau', col: 2 })).toBe(false);
  });

  it('wins when the last card reaches the foundations', () => {
    const s: State = {
      ...blank(),
      waste: cards('KC'),
      foundations: [upTo('S', 13), upTo('H', 13), upTo('D', 13), upTo('C', 12)],
    };
    const n = move(s, { from: 'waste' }, { to: 'foundation' })!;
    expect(n.won).toBe(true);
  });
});

describe('bestTarget (tap to move)', () => {
  it('prefers the foundation', () => {
    const s: State = { ...blank(), waste: cards('AH') };
    s.tableau[0] = { down: [], up: cards('2S') };
    expect(bestTarget(s, { from: 'waste' })).toEqual({ to: 'foundation' });
  });

  it('prefers a column with cards over an empty one', () => {
    const s: State = { ...blank(), waste: cards('QH') };
    s.tableau[0] = { down: [], up: [] };
    s.tableau[5] = { down: [], up: cards('KS') };
    expect(bestTarget(s, { from: 'waste' })).toEqual({ to: 'tableau', col: 5 });
  });

  it('moves a king to an empty column, unless it already starts its own', () => {
    const s: State = { ...blank(), waste: cards('KH') };
    s.tableau[0] = { down: [], up: cards('KS') };
    s.tableau[1] = { down: cards('3D'), up: cards('KC') };
    s.tableau[2] = { down: [], up: [] };
    expect(bestTarget(s, { from: 'waste' })).toEqual({ to: 'tableau', col: 2 });
    expect(bestTarget(s, { from: 'tableau', col: 1, index: 0 })).toEqual({ to: 'tableau', col: 2 });
    expect(bestTarget(s, { from: 'tableau', col: 0, index: 0 })).toBeNull();
  });

  it('returns null when a card has nowhere to go', () => {
    const s: State = { ...blank(), waste: cards('5H') };
    s.tableau.forEach((c) => (c.up = cards('9S')));
    expect(bestTarget(s, { from: 'waste' })).toBeNull();
  });
});

describe('autoFinish', () => {
  function nearlyDone(): State {
    const s: State = {
      ...blank(),
      foundations: [upTo('S', 10), upTo('H', 10), upTo('D', 10), upTo('C', 10)],
    };
    s.tableau[0].up = cards('KS QH JC');
    s.tableau[1].up = cards('KH QS JD');
    s.tableau[2].up = cards('KD QC JH');
    s.tableau[3].up = cards('KC QD JS');
    return s;
  }

  it('finishes once every card is face up and the stock is empty', () => {
    const s = nearlyDone();
    expect(canAutoFinish(s)).toBe(true);
    const n = autoFinish(s);
    expect(n.won).toBe(true);
    expect(n.foundations.every((f) => f.length === 13)).toBe(true);
    expect(canAutoFinish(n)).toBe(false);
  });

  it('waits while cards are face down or in the stock', () => {
    const down = nearlyDone();
    down.tableau[4].down = cards('AS'); // not a real game, but enough to block
    expect(canAutoFinish(down)).toBe(false);
    expect(autoFinish(down)).toBe(down);
    expect(canAutoFinish({ ...nearlyDone(), stock: cards('2H') })).toBe(false);
    expect(canAutoFinish({ ...nearlyDone(), waste: cards('2H') })).toBe(false);
  });
});

describe('isValidState', () => {
  it('accepts a dealt game, including after saving and loading', () => {
    const s = newState(1, seededRng(3));
    expect(isValidState(s)).toBe(true);
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
  });

  it.each([
    ['null', () => null],
    ['bad draw count', (s: State) => ({ ...s, draw: 2 })],
    ['missing column', (s: State) => ({ ...s, tableau: s.tableau.slice(1) })],
    ['broken column', (s: State) => ({ ...s, tableau: [{ down: [] }, ...s.tableau.slice(1)] })],
    ['missing foundation', (s: State) => ({ ...s, foundations: s.foundations.slice(1) })],
    ['lost a card', (s: State) => ({ ...s, stock: s.stock.slice(1) })],
    ['bad moves', (s: State) => ({ ...s, moves: '3' })],
    ['bad won', (s: State) => ({ ...s, won: 'no' })],
    ['stock not a list', (s: State) => ({ ...s, stock: 'x' })],
  ])('rejects %s', (_name, change) => {
    expect(isValidState(change(newState(1, seededRng(3))))).toBe(false);
  });

  it('rejects foundations out of order or in the wrong suit', () => {
    const s = newState(1, seededRng(3));
    const notAce = (c: Card) => !(c.rank === 1 && c.suit === ('H' as Suit));
    s.stock = s.stock.filter(notAce);
    s.tableau.forEach((col) => {
      col.down = col.down.filter(notAce);
      col.up = col.up.filter(notAce);
    });
    const ace = card('AH');
    expect(isValidState({ ...s, foundations: [[ace], [], [], []] })).toBe(false); // hearts on spades
    expect(isValidState({ ...s, foundations: [[], [ace], [], []] })).toBe(true);
    expect(isValidState({ ...s, foundations: [[], [card('2H')], [], []] })).toBe(false); // not from the ace
  });
});

describe('hints', () => {
  it('suggests a card up to its pile first', () => {
    const s = blank();
    s.foundations[0] = upTo('S', 3);
    s.tableau[0].up = cards('4S');
    s.waste = cards('9H');
    expect(findHint(s)).toEqual({ src: { from: 'tableau', col: 0, index: 0 }, tgt: { to: 'foundation' } });
  });

  it('then a move that turns over a face-down card, before one from the turned-over pile', () => {
    const s = blank();
    s.tableau[0] = { down: cards('2C'), up: cards('6H') };
    s.tableau[1].up = cards('7S');
    s.tableau[2].up = cards('7C');
    s.waste = cards('6D');
    expect(findHint(s)).toEqual({ src: { from: 'tableau', col: 0, index: 0 }, tgt: { to: 'tableau', col: 1 } });
    s.tableau[0] = { down: [], up: cards('2C') };
    expect(findHint(s)).toEqual({ src: { from: 'waste' }, tgt: { to: 'tableau', col: 1 } });
  });

  it('then turning the deck, if a card in it could be played', () => {
    const s = blank();
    s.tableau[0].up = cards('KH');
    s.stock = cards('QS 2D');
    expect(findHint(s)).toEqual({ draw: true });
    expect(isStuck(s)).toBe(false);
  });

  it('then any other legal move, rather than calling the game stuck', () => {
    const s = blank();
    s.tableau[0].up = cards('8S 7H');
    s.tableau[1].up = cards('8C');
    s.stock = cards('2D');
    expect(findHint(s)).toEqual({ src: { from: 'tableau', col: 0, index: 1 }, tgt: { to: 'tableau', col: 1 } });
  });

  it('says stuck when nothing can move and the deck holds nothing playable', () => {
    const s = blank();
    s.tableau[0].up = cards('KH');
    s.tableau[1].up = cards('5C');
    s.stock = cards('2D 9S');
    expect(findHint(s)).toBeNull();
    expect(isStuck(s)).toBe(true);
    expect(isStuck({ ...oneMoveFromWinning(), won: true, waste: [] })).toBe(false);
    expect(findHint({ ...s, won: true })).toBeNull();
  });
});

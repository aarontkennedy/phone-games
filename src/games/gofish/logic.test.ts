import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { applyTurn, ask, chooseTurn, draw, isValidState, mustDraw, newGame, nextGame, targets, winners, type State } from './logic';
import { card, cards, onTop, position } from './test-fixtures';

const ALL_BOOKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

describe('go fish', () => {
  it('deals 5 each, lays down any dealt books, and starts left of the dealer', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = newGame('easy', seededRng(seed));
      expect(s.hands.flat().length + s.books.flat().length * 4).toBe(20);
      expect(s.stock).toHaveLength(32);
      expect(s.turn).toBe(0);
      expect(isValidState(s)).toBe(true);
    }
    const next = nextGame({ ...newGame('easy', seededRng(1)), tally: { won: 2, played: 3 } }, seededRng(2));
    expect(next.dealer).toBe(0);
    expect(next.turn).toBe(1);
    expect(next.level).toBe('easy');
    expect(next.tally).toEqual({ won: 2, played: 3 });
  });

  it('hands over every card of the rank and you go again', () => {
    const s = ask(position(['7H 2C', '7S 7D 3C', '4H', '5H']), 0, 1, 7)!;
    expect(s.hands[0]).toEqual(cards('7H 2C 7S 7D'));
    expect(s.hands[1]).toEqual(cards('3C'));
    expect(s.turn).toBe(0);
    expect(s.known[0]).toEqual([7]);
    expect(s.last).toEqual({ kind: 'ask', seat: 0, from: 1, rank: 7, got: 2, drew: null, books: [] });
  });

  it('goes fishing: the turn passes unless you draw the rank you asked for', () => {
    const miss = ask(onTop(position(['7H 2C', '3C', '4H', '5H']), '9D'), 0, 1, 7)!;
    expect(miss.hands[0]).toEqual(cards('7H 2C 9D'));
    expect(miss.turn).toBe(1);
    expect(miss.last).toMatchObject({ got: 0, drew: card('9D') });

    const lucky = ask(onTop(position(['7H 2C', '3C', '4H', '5H']), '7C'), 0, 1, 7)!;
    expect(lucky.turn).toBe(0);
  });

  it('lays down a book of four, and forgets who held that rank', () => {
    const s = ask(position(['7H 7C 7D 2C', '7S 3C', '4H', '5H'], { known: [[], [], [7], []] }), 0, 1, 7)!;
    expect(s.hands[0]).toEqual(cards('2C'));
    expect(s.books[0]).toEqual([7]);
    expect(s.known).toEqual([[], [], [], []]);
    expect(s.last).toMatchObject({ books: [7] });
  });

  it('only lets you ask for a rank you hold, on your turn, from someone with cards', () => {
    const s = position(['7H 2C', '7S', '', '5H']);
    expect(ask(s, 0, 1, 9)).toBeNull();
    expect(ask(s, 0, 0, 7)).toBeNull();
    expect(ask(s, 0, 2, 7)).toBeNull(); // North has no cards
    expect(ask(s, 1, 0, 7)).toBeNull(); // not West's turn
    expect(ask({ ...s, phase: 'over' }, 0, 1, 7)).toBeNull();
    expect(targets(s, 0)).toEqual([1, 3]);
  });

  it('draws when your hand is empty and carries on, or passes when no one is left to ask', () => {
    const empty = onTop(position(['', '3C', '4H', '5H']), '9D');
    expect(mustDraw(empty, 0)).toBe(true);
    expect(ask(empty, 0, 1, 3)).toBeNull();
    const drew = draw(empty, 0)!;
    expect(drew.hands[0]).toEqual(cards('9D'));
    expect(drew.turn).toBe(0);
    expect(drew.last).toEqual({ kind: 'draw', seat: 0, drew: card('9D'), books: [] });
    expect(draw(drew, 0)).toBeNull();

    const alone = position(['3C', '', '', '']);
    expect(mustDraw(alone, 0)).toBe(true);
    expect(draw(alone, 0)!.turn).toBe(1);
  });

  it('skips a player with no cards once the deck is empty', () => {
    const rest = ALL_BOOKS.filter((r) => ![2, 3].includes(r));
    const s = position(['2C 2D', '2S 2H 3C', '', '3D 3S 3H'], { books: [rest, [], [], []] });
    expect(s.stock).toEqual([]);
    // Your book of 2s empties your hand, so your extra turn is skipped.
    const next = ask(s, 0, 1, 2)!;
    expect(next.books[0]).toContain(2);
    expect(next.hands[0]).toEqual([]);
    expect(next.turn).toBe(1);
  });

  it('ends the game when all 13 books are made, and counts your wins', () => {
    const s = position(['7H 7C 7D', '7S', '', ''], { books: [[1, 2, 3, 4, 5, 6], [8, 9, 10], [11, 12], [13]] });
    const won = ask(s, 0, 1, 7)!;
    expect(won.phase).toBe('over');
    expect(winners(won)).toEqual([0]);
    expect(won.tally).toEqual({ won: 1, played: 1 });

    const lost = ask(position(['7H 7C 7D', '7S', '', ''], { books: [[1], [8, 9, 10, 2, 3], [11, 12, 4, 5, 6], [13]] }), 0, 1, 7)!;
    expect(winners(lost)).toEqual([1, 2]);
    expect(lost.tally).toEqual({ won: 0, played: 1 });
  });

  it('Easy asks at random for a rank it holds', () => {
    const s = position(['2C', '7H 9C', '4H', '5H'], { level: 'easy', turn: 1 });
    for (let seed = 1; seed < 20; seed++) {
      const t = chooseTurn(s, 1, seededRng(seed));
      expect(t.action === 'ask' && [7, 9].includes(t.rank) && [0, 2, 3].includes(t.from)).toBe(true);
      expect(applyTurn(s, 1, t)).not.toBeNull();
    }
  });

  it('Strong asks whoever is known to hold a rank, else its biggest group from the biggest hand', () => {
    const remembered = position(['2C', '7H 9C 9D', '4H', '7S'], { turn: 1, known: [[], [], [], [7]] });
    expect(chooseTurn(remembered, 1)).toEqual({ action: 'ask', from: 3, rank: 7 });

    const fresh = position(['2C 3C', '7H 9C 9D', '4H 5H 6H', '7S'], { turn: 1 });
    expect(chooseTurn(fresh, 1)).toEqual({ action: 'ask', from: 2, rank: 9 });

    const drawing = position(['', '7H', '', ''], { turn: 1 });
    expect(chooseTurn(drawing, 1)).toEqual({ action: 'draw' });
    expect(applyTurn(drawing, 1, { action: 'draw' })!.turn).toBe(2);
  });

  it('rejects broken saves', () => {
    const good = position(['7H', '7S', '', '']);
    expect(isValidState(good)).toBe(true);
    const bad: unknown[] = [
      null,
      { ...good, level: 'hard' },
      { ...good, phase: 'done' },
      { ...good, turn: 4 },
      { ...good, hands: [[], [], []] },
      { ...good, stock: [{ suit: 'X', rank: 1 }] },
      { ...good, books: [[14], [], [], []] },
      { ...good, known: [[], []] },
      { ...good, tally: null },
      { ...good, stock: good.stock.slice(1) },
      { ...good, books: [[7], [], [], []] },
      { ...good, books: [[2], [2], [], []] },
    ];
    for (const b of bad) expect(isValidState(b as State)).toBe(false);
  });
});

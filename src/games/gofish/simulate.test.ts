import { describe, expect, it } from 'vitest';
import { simulate } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { applyTurn, BOOKS, chooseTurn, isValidState, newGame, winners, type State } from './logic';

describe('Go Fish, many whole games', () => {
  it('always finishes with all 13 books made, and only a miss passes the turn', () => {
    simulate<State>({
      games: 200,
      maxSteps: 2000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => applyTurn(s, s.turn, chooseTurn(s, s.turn, rng)),
      isOver: (s) => s.phase === 'over',
      isValid: isValidState,
      check: (prev, next) => {
        const e = next.last!;
        expect(e.seat).toBe(prev.turn);
        const booked = next.books.flat().length - prev.books.flat().length;
        expect(booked).toBe(e.books.length);
        if (next.phase === 'over' || next.turn === prev.turn) return;
        // The turn moved on: a miss, a draw with no one to ask, or a player out of cards.
        const missed = e.kind === 'ask' ? !e.got && e.drew?.rank !== e.rank : prev.hands[prev.turn].length > 0;
        expect(missed || !next.hands[prev.turn].length).toBe(true);
      },
      end: (s) => {
        expect(s.books.flat()).toHaveLength(BOOKS);
        expect(s.hands.flat()).toEqual([]);
        expect(s.tally.played).toBe(1);
        expect(s.tally.won).toBe(winners(s).includes(0) ? 1 : 0);
      },
    });
  }, 60_000);
  it('a Strong player wins more than its share against three Easy ones', () => {
    const share = strongShare<State>({
      games: 100,
      sides: 4,
      maxSteps: 2000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => applyTurn(s, s.turn, chooseTurn({ ...s, level: levelFor(s.turn === strong) }, s.turn, rng)),
      isOver: (s) => s.phase === 'over',
      score: (s, strong) => (winners(s).includes(strong as 0 | 1 | 2 | 3) ? 1 / winners(s).length : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.5); // an even share is 0.25
  });
});

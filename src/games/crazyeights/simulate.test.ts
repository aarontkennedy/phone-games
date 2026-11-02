import { describe, expect, it } from 'vitest';
import { simulate } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { applyTurn, cardPoints, chooseTurn, GAME_POINTS, isValidState, newGame, nextRound, winner, type State } from './logic';

describe('Crazy Eights, many whole games', () => {
  it('always finishes, and the round winner scores the cards left in the other hands', () => {
    simulate<State>({
      games: 60,
      maxSteps: 6000,
      start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
      step: (s, rng) => (s.phase === 'roundOver' ? nextRound(s, rng) : applyTurn(s, s.turn, chooseTurn(s, s.turn, rng), rng)),
      isOver: (s) => s.phase === 'gameOver',
      isValid: isValidState,
      check: (prev, next) => {
        const ended = prev.phase === 'playing' && next.phase !== 'playing';
        if (!ended) {
          expect(next.scores).toEqual(prev.scores);
          return;
        }
        const { seat, points } = next.last!;
        const others = next.hands.flatMap((h, i) => (i === seat ? [] : h));
        expect(points).toBe(others.reduce((t, c) => t + cardPoints(c), 0));
        expect(next.scores[seat]).toBe(prev.scores[seat] + points);
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GAME_POINTS);
      },
    });
  }, 60_000);
  it('a Strong player wins more than its share against three Easy ones (it’s mostly luck)', () => {
    const share = strongShare<State>({
      games: 400,
      sides: 4, // the Strong seat moves round the table
      maxSteps: 6000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => (s.phase === 'roundOver' ? nextRound(s, rng) : applyTurn(s, s.turn, chooseTurn({ ...s, level: levelFor(s.turn === strong) }, s.turn, rng), rng)),
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.32); // an even share is 0.25
  }, 60_000);
});

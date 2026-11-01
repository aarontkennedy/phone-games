import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { LETTERS, MAX_MISSES, guess, isValidState, misses, newGame, newRound, type State } from './logic';

describe('Hangman, many whole rounds', () => {
  it('every round ends in a win with all letters found, or a loss on the sixth miss', () => {
    simulate<State>({
      games: 1000,
      maxSteps: 26,
      start: (rng, i) => (i % 2 ? newRound(newGame(rng), rng) : newGame(rng)),
      step: (s, rng) => guess(s, pick(LETTERS.filter((l) => !s.guessed.includes(l)), rng)),
      isOver: (s) => s.result !== null,
      isValid: isValidState,
      end: (s) => {
        const found = [...s.word].every((l) => s.guessed.includes(l));
        if (s.result === 'won') expect([found, misses(s).length < MAX_MISSES]).toEqual([true, true]);
        else expect([found, misses(s).length]).toEqual([false, MAX_MISSES]);
        expect(s.stats.played).toBe(1);
      },
    });
  });
});

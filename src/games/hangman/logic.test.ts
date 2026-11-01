import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { MAX_MISSES, RECENT, guess, isValidState, misses, newGame, newRound, type State } from './logic';
import { WORDS } from './words';

const round = (word: string, o: Partial<State> = {}): State => ({ ...newGame(seededRng(1)), word, guessed: [], result: null, ...o });
const play = (s: State, letters: string) => [...letters].reduce<State>((st, l) => guess(st, l) ?? st, s);

describe('the word list', () => {
  it('has hundreds of different everyday words, 5 to 8 capital letters each', () => {
    expect(WORDS.length).toBeGreaterThan(250);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const w of WORDS) expect(w, w).toMatch(/^[A-Z]{5,8}$/);
  });
});

describe('guessing', () => {
  it('reveals a right letter everywhere it appears, and counts a wrong one', () => {
    let s = guess(round('BANANA'), 'A')!;
    expect(s.guessed).toEqual(['A']);
    expect(misses(s)).toEqual([]);
    s = guess(s, 'Z')!;
    expect(misses(s)).toEqual(['Z']);
    expect(guess(s, 'Z')).toBeNull(); // already tried
    expect(guess(s, 'é')).toBeNull();
  });

  it('wins when every letter is found, counting the streak', () => {
    const s = play(round('BANANA', { stats: { won: 2, played: 3, streak: 2, best: 2 } }), 'BAN');
    expect(s.result).toBe('won');
    expect(s.stats).toEqual({ won: 3, played: 4, streak: 3, best: 3 });
    expect(guess(s, 'Q')).toBeNull(); // the round is over
  });

  it('loses on the sixth wrong letter, ending the streak but keeping the best', () => {
    const s = play(round('BANANA', { stats: { won: 2, played: 3, streak: 2, best: 5 } }), 'QWERTY');
    expect(misses(s)).toHaveLength(MAX_MISSES);
    expect(s.result).toBe('lost');
    expect(s.stats).toEqual({ won: 2, played: 4, streak: 0, best: 5 });
  });
});

describe('new words', () => {
  it('doesn’t repeat a recent word', () => {
    let s = newGame(seededRng(2));
    const seen = [s.word];
    for (let i = 0; i < RECENT - 1; i++) {
      s = newRound(s, seededRng(100 + i));
      seen.push(s.word);
    }
    expect(new Set(seen).size).toBe(RECENT);
    expect(s.recent).toHaveLength(RECENT);
    expect(newRound(s, seededRng(9)).recent).toHaveLength(RECENT); // keeps only the latest
  });

  it('counts a word given up partway as played and lost', () => {
    const started = guess(round('BANANA', { stats: { won: 1, played: 1, streak: 1, best: 1 } }), 'A')!;
    expect(newRound(started, seededRng(3)).stats).toEqual({ won: 1, played: 2, streak: 0, best: 1 });
    const untouched = round('BANANA', { stats: { won: 1, played: 1, streak: 1, best: 1 } });
    expect(newRound(untouched, seededRng(3)).stats.streak).toBe(1); // skipping before guessing is free
  });
});

describe('saves', () => {
  it('accepts real saves and rejects broken ones', () => {
    expect(isValidState(newGame(seededRng(4)))).toBe(true);
    for (const bad of [
      null,
      'x',
      { ...round('BANANA'), word: 'ab' },
      { ...round('BANANA'), word: 7 },
      { ...round('BANANA'), guessed: ['A', 'A'] },
      { ...round('BANANA'), guessed: ['1'] },
      { ...round('BANANA'), guessed: 'A' },
      { ...round('BANANA'), result: 'maybe' },
      { ...round('BANANA'), recent: [1] },
      { ...round('BANANA'), recent: null },
      { ...round('BANANA'), stats: null },
      { ...round('BANANA'), stats: { won: -1, played: 0, streak: 0, best: 0 } },
      { ...round('BANANA'), guessed: [...'QWERTYU'] }, // seven misses
    ]) {
      expect(isValidState(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { isWord } from '../../core/dictionary';
import { seededRng } from '../../core/random';
import { ALL_SEVEN_BONUS, allWords, enter, fits, hint, hinted, isValidState, newRound, points, shuffleLetters, whyNot, type State } from './logic';
import { BASES } from './words';

const round = (base: string): State => ({ base, letters: [...base], found: [], score: 0, hints: 0, best: 0 });

describe('anagrams', () => {
  it('deals the letters of an everyday 7-letter word', () => {
    const s = newRound(5, seededRng(1));
    expect(BASES).toContain(s.base);
    expect([...s.letters].sort()).toEqual([...s.base].sort());
    expect(s.best).toBe(5);
    expect(isValidState(s)).toBe(true);
  });

  it('only uses real 7-letter words for rounds', () => {
    for (const w of BASES) {
      expect(w, w).toHaveLength(7);
      expect(isWord(w), w).toBe(true);
    }
    expect(new Set(BASES).size).toBe(BASES.length);
  });

  it('scores real words made from the letters, each letter once', () => {
    let s = round('planets');
    expect(fits(s, 'plan')).toBe(true);
    expect(fits(s, 'pplan')).toBe(false);
    expect(whyNot(s, 'at')).toBe('Words need at least 3 letters.');
    expect(whyNot(s, 'zap')).toBe('Use only these letters, each once.');
    expect(whyNot(s, 'nalp')).toBe('NALP isn’t in the word list.');
    s = enter(s, 'PLAN')!;
    expect(s.found).toEqual(['plan']);
    expect(s.score).toBe(4);
    expect(whyNot(s, 'plan')).toBe('You already found PLAN.');
    expect(enter(s, 'plan')).toBeNull();
    s = enter(s, 'planets')!;
    expect(s.score).toBe(4 + 7 + ALL_SEVEN_BONUS);
    expect(s.best).toBe(s.score);
    expect(points('cat')).toBe(3);
  });

  it('finds every word the letters make, longest first', () => {
    const words = allWords(round('planets'));
    expect(words[0]).toHaveLength(7);
    expect(words).toEqual(expect.arrayContaining(['planets', 'plane', 'plan', 'ants']));
    expect(words.every((w) => w.length >= 3)).toBe(true);
  });

  it('shows the 7-letter word a letter at a time, until it’s found', () => {
    let s = round('planets');
    expect(hinted(s)).toBe('');
    s = hint(hint(s)!)!;
    expect(hinted(s)).toBe('pl');
    expect(hint({ ...s, hints: 7 })).toBeNull();
    expect(hint(enter(s, 'planets')!)).toBeNull();
  });

  it('shuffles the letters without changing them', () => {
    const s = shuffleLetters(round('planets'), seededRng(2));
    expect([...s.letters].sort()).toEqual([...'planets'].sort());
  });

  it('checks saved rounds', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...round('planets'), base: 'zzzzzzz' })).toBe(false);
    expect(isValidState({ ...round('planets'), letters: [...'planetz'] })).toBe(false);
    expect(isValidState({ ...round('planets'), hints: 8 })).toBe(false);
  });
});

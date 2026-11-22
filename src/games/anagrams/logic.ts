// Anagrams: seven letters, shuffled from an everyday 7-letter word. Spell as many real
// words of 3 or more letters as you can, each letter used once per word. Longer words
// score more, and using all seven letters scores a bonus. Pure functions: every action
// returns a new State, or null if it isn't allowed.
import { isWord, wordsFrom } from '../../core/dictionary';
import { randomInt, shuffle, type Rng } from '../../core/random';
import { BASES } from './words';

export const MIN = 3;
/** Points for using all seven letters, on top of the word's own. */
export const ALL_SEVEN_BONUS = 10;

export interface State {
  /** The round's 7-letter word (lower case), kept to show at the end. */
  base: string;
  /** The letter tiles, in the order shown. */
  letters: string[];
  /** Words found this round, in the order found. */
  found: string[];
  score: number;
  /** How many letters of `base` Hint has shown. */
  hints: number;
  /** Your best round score. */
  best: number;
}

export function newRound(best = 0, rng: Rng = Math.random): State {
  const base = BASES[randomInt(BASES.length, rng)];
  return { base, letters: shuffle([...base], rng), found: [], score: 0, hints: 0, best };
}

/** Points for a word: one per letter, plus the bonus for using all seven. */
export const points = (word: string): number => word.length + (word.length === 7 ? ALL_SEVEN_BONUS : 0);

/** Whether `word` uses only the round's letters, each at most once. */
export function fits(s: State, word: string): boolean {
  const left = [...s.letters];
  for (const ch of word) {
    const i = left.indexOf(ch);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

/** Why a word doesn't count, or null if it does. */
export function whyNot(s: State, word: string): string | null {
  const w = word.toLowerCase();
  if (w.length < MIN) return `Words need at least ${MIN} letters.`;
  if (!fits(s, w)) return 'Use only these letters, each once.';
  if (s.found.includes(w)) return `You already found ${w.toUpperCase()}.`;
  if (!isWord(w)) return `${w.toUpperCase()} isn’t in the word list.`;
  return null;
}

/** Scores a word you spelled. */
export function enter(s: State, word: string): State | null {
  if (whyNot(s, word)) return null;
  const w = word.toLowerCase();
  const score = s.score + points(w);
  return { ...s, found: [...s.found, w], score, best: Math.max(s.best, score) };
}

export const shuffleLetters = (s: State, rng: Rng = Math.random): State => ({ ...s, letters: shuffle(s.letters, rng) });

/** Every word these letters make, longest first. */
export const allWords = (s: State): string[] => wordsFrom(s.letters.join(''), MIN);

/** Shows one more letter of the 7-letter word. Null once it's all shown or found. */
export function hint(s: State): State | null {
  if (s.hints >= 7 || s.found.some((w) => w.length === 7)) return null;
  return { ...s, hints: s.hints + 1 };
}

/** The start of the 7-letter word that Hint has shown so far. */
export const hinted = (s: State): string => s.base.slice(0, s.hints);

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  return (
    !!st &&
    typeof st.base === 'string' &&
    BASES.includes(st.base) &&
    Array.isArray(st.letters) &&
    [...st.letters].sort().join('') === [...st.base].sort().join('') &&
    Array.isArray(st.found) &&
    st.found.every((w) => typeof w === 'string') &&
    Number.isInteger(st.score) &&
    Number.isInteger(st.hints) &&
    st.hints >= 0 &&
    st.hints <= 7 &&
    Number.isInteger(st.best)
  );
}

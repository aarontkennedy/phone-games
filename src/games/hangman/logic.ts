// Hangman: guess the hidden word one letter at a time. Every wrong letter adds a part to
// the figure; six wrong letters and the round is lost. Recent words aren't repeated.
// Pure functions: a guess returns a new State, or null.
import { randomInt, type Rng } from '../../core/random';
import { WORDS } from './words';

export const MAX_MISSES = 6;
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** How many recent words to keep out of the next draw. */
export const RECENT = 40;

export interface State {
  word: string;
  guessed: string[];
  result: 'won' | 'lost' | null;
  /** Words used lately, newest last, so they don't come straight back. */
  recent: string[];
  stats: { won: number; played: number; streak: number; best: number };
}

const pickWord = (recent: string[], rng: Rng) => {
  const fresh = WORDS.filter((w) => !recent.includes(w));
  return fresh[randomInt(fresh.length, rng)];
};

export function newGame(rng: Rng = Math.random): State {
  const word = pickWord([], rng);
  return { word, guessed: [], result: null, recent: [word], stats: { won: 0, played: 0, streak: 0, best: 0 } };
}

/** The next word. A round given up before it ended counts as a loss. */
export function newRound(s: State, rng: Rng = Math.random): State {
  const stats = s.result === null && s.guessed.length ? { ...s.stats, played: s.stats.played + 1, streak: 0 } : s.stats;
  const word = pickWord(s.recent, rng);
  return { word, guessed: [], result: null, recent: [...s.recent, word].slice(-RECENT), stats };
}

export const misses = (s: State): string[] => s.guessed.filter((l) => !s.word.includes(l));

export function guess(s: State, letter: string): State | null {
  if (s.result !== null || !LETTERS.includes(letter) || s.guessed.includes(letter)) return null;
  const next = { ...s, guessed: [...s.guessed, letter] };
  const won = [...s.word].every((l) => next.guessed.includes(l));
  const lost = misses(next).length >= MAX_MISSES;
  if (!won && !lost) return next;
  const streak = won ? s.stats.streak + 1 : 0;
  return {
    ...next,
    result: won ? 'won' : 'lost',
    stats: { won: s.stats.won + (won ? 1 : 0), played: s.stats.played + 1, streak, best: Math.max(s.stats.best, streak) },
  };
}

export function isValidState(s: unknown): s is State {
  if (!s || typeof s !== 'object') return false;
  const st = s as State;
  const count = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
  return (
    typeof st.word === 'string' &&
    /^[A-Z]{3,}$/.test(st.word) &&
    Array.isArray(st.guessed) &&
    st.guessed.every((l) => LETTERS.includes(l)) &&
    new Set(st.guessed).size === st.guessed.length &&
    (st.result === null || st.result === 'won' || st.result === 'lost') &&
    Array.isArray(st.recent) &&
    st.recent.every((w) => typeof w === 'string') &&
    !!st.stats &&
    count(st.stats.won) &&
    count(st.stats.played) &&
    count(st.stats.streak) &&
    count(st.stats.best) &&
    misses(st).length <= MAX_MISSES
  );
}

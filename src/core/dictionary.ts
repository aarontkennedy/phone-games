// The word list the word games check words against: ENABLE (public domain), 3 to 8
// letters, with slurs and vulgar words taken out (scripts/make-words.mjs builds it). It's
// bundled only with the word games, which are loaded when opened, and cached for offline
// play like everything else.
import list from './words/enable.txt?raw';

let words: Set<string> | null = null;

/** Every word, lower case. Built on first use. */
export function dictionary(): Set<string> {
  return (words ??= new Set(list.split('\n').filter(Boolean)));
}

/** Whether `word` (any case) is a real word of 3 to 8 letters. */
export const isWord = (word: string): boolean => dictionary().has(word.toLowerCase());

/** Letter counts, a to z. */
const countLetters = (word: string): number[] => {
  const c = new Array<number>(26).fill(0);
  for (const ch of word) c[ch.charCodeAt(0) - 97]++;
  return c;
};

/** Every word that can be spelled from `letters` (each used at most once), longest first. */
export function wordsFrom(letters: string, min = 3): string[] {
  const have = countLetters(letters.toLowerCase());
  const out: string[] = [];
  for (const w of dictionary()) {
    if (w.length < min || w.length > letters.length) continue;
    const need = countLetters(w);
    if (need.every((n, i) => n <= have[i])) out.push(w);
  }
  return out.sort((a, b) => b.length - a.length || a.localeCompare(b));
}

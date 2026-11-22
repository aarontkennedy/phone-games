// Word Ladder: turn one 4-letter word into another, changing one letter at a time, with
// every step a real word (COLD, CORD, CARD, WARD, WARM). Puzzles start and end on everyday
// words (COMMON), and Par is the fewest steps through everyday words. Any real word is
// allowed as a step. Pure functions: every move returns a new State, or null.
import { dictionary, isWord } from '../../core/dictionary';
import { randomInt, type Rng } from '../../core/random';
import { COMMON } from './words';

export const LENGTH = 4;

export interface State {
  start: string;
  target: string;
  /** The words so far, starting with `start`. */
  path: string[];
  /** The fewest steps through everyday words. */
  par: number;
  won: boolean;
}

/** Whether a and b differ in exactly one letter. */
export const oneApart = (a: string, b: string): boolean => {
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return a.length === b.length && diff === 1;
};

const COMMON_SET = new Set(COMMON);
let allFour: string[] | null = null;
/** Every real 4-letter word. */
const fourLetterWords = () => (allFour ??= [...dictionary()].filter((w) => w.length === LENGTH));

/** The words one letter away from `word`, among `pool`. */
const neighborsIn = (word: string, pool: Set<string>): string[] => {
  const out: string[] = [];
  for (let i = 0; i < LENGTH; i++) {
    for (let c = 97; c <= 122; c++) {
      const w = word.slice(0, i) + String.fromCharCode(c) + word.slice(i + 1);
      if (w !== word && pool.has(w)) out.push(w);
    }
  }
  return out;
};

/** The shortest ladder from `from` to `to` through `pool` (both ends included), or null. */
export function shortestLadder(from: string, to: string, pool: Set<string>): string[] | null {
  if (from === to) return [from];
  const back = new Map<string, string>([[from, '']]);
  let frontier = [from];
  while (frontier.length) {
    const next: string[] = [];
    for (const w of frontier) {
      for (const n of neighborsIn(w, pool)) {
        if (back.has(n)) continue;
        back.set(n, w);
        if (n === to) {
          const path = [n];
          for (let p = w; p; p = back.get(p)!) path.unshift(p);
          return path;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

/** Everyday words reachable from `word` in exactly `steps` steps through everyday words. */
function atDistance(word: string, steps: number): string[] {
  const seen = new Set([word]);
  let frontier = [word];
  for (let d = 0; d < steps; d++) {
    const next: string[] = [];
    for (const w of frontier) for (const n of neighborsIn(w, COMMON_SET)) if (!seen.has(n)) (seen.add(n), next.push(n));
    frontier = next;
  }
  return frontier;
}

/** A new puzzle: two everyday words 3 to 5 steps apart. */
export function newPuzzle(rng: Rng = Math.random): State {
  for (;;) {
    const start = COMMON[randomInt(COMMON.length, rng)];
    const par = 3 + randomInt(3, rng);
    const ends = atDistance(start, par);
    if (ends.length) {
      const target = ends[randomInt(ends.length, rng)];
      return { start, target, path: [start], par, won: false };
    }
  }
}

export const current = (s: State): string => s.path.at(-1)!;
/** Steps taken so far. */
export const steps = (s: State): number => s.path.length - 1;

/** Why a word can't be the next step, or null if it can. */
export function whyNot(s: State, word: string): string | null {
  const w = word.toLowerCase();
  if (!oneApart(current(s), w)) return 'Change exactly one letter.';
  if (!isWord(w)) return `${w.toUpperCase()} isn’t in the word list.`;
  if (s.path.includes(w)) return `You’ve already used ${w.toUpperCase()}.`;
  return null;
}

/** Takes a step to `word`. */
export function step(s: State, word: string): State | null {
  if (s.won || whyNot(s, word)) return null;
  const w = word.toLowerCase();
  return { ...s, path: [...s.path, w], won: w === s.target };
}

/** Takes back the last step. */
export const undo = (s: State): State | null => (s.won || s.path.length < 2 ? null : { ...s, path: s.path.slice(0, -1) });

/**
 * The next word on a shortest ladder from where you are to the target: through everyday
 * words if it can, else through any real words. Null once you're there.
 */
export function hint(s: State): string | null {
  if (s.won) return null;
  const used = new Set(s.path.slice(0, -1));
  const avoid = (pool: Iterable<string>) => new Set([...pool].filter((w) => !used.has(w)));
  const ladder = shortestLadder(current(s), s.target, avoid(COMMON_SET)) ?? shortestLadder(current(s), s.target, avoid(fourLetterWords()));
  return ladder?.[1] ?? null;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  return (
    !!st &&
    typeof st.start === 'string' &&
    typeof st.target === 'string' &&
    isWord(st.start) &&
    isWord(st.target) &&
    Array.isArray(st.path) &&
    st.path[0] === st.start &&
    st.path.every((w, i) => typeof w === 'string' && isWord(w) && (i === 0 || oneApart(st.path[i - 1], w))) &&
    Number.isInteger(st.par) &&
    st.par > 0 &&
    typeof st.won === 'boolean'
  );
}

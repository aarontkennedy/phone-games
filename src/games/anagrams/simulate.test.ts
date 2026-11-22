import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { allWords, enter, hint, isValidState, newRound, points, shuffleLetters, type State } from './logic';

/** Every word a round's letters make, worked out once per round (it scans the whole list). */
const cache = new Map<string, string[]>();
const wordsOf = (s: State) => cache.get(s.base) ?? (cache.set(s.base, allWords(s)), cache.get(s.base)!);

describe('Anagrams, many rounds', () => {
  it('every round has a 7-letter word, and every word found scores its points', () => {
    simulate<State>({
      games: 120,
      maxSteps: 30,
      start: (rng) => newRound(0, rng),
      step: (s, rng) => {
        const r = rng();
        if (r < 0.1) return shuffleLetters(s, rng);
        if (r < 0.2) return hint(s) ?? s;
        const left = wordsOf(s).filter((w) => !s.found.includes(w));
        return enter(s, pick(left, rng))!;
      },
      isOver: (s) => s.found.length >= Math.min(15, wordsOf(s).length),
      isValid: isValidState,
      check: (prev, next) => {
        if (next.found.length > prev.found.length) expect(next.score).toBe(prev.score + points(next.found.at(-1)!));
      },
      end: (s) => expect(wordsOf(s).some((w) => w.length === 7)).toBe(true),
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen', () => {
    const { finishedSteps } = stressScreen({ id: 'anagrams', mount, isValid: isValidState, steps: 200 });
    expect(finishedSteps).toBe(0); // a round never ends by itself: you choose Next word
  }, 120_000);
});

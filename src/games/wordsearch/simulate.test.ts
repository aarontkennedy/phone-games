import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { simulate } from '../../test/simulate';
import { mount } from './index';
import { SIZE, isValidState, isWon, newPuzzle, tap, type State } from './logic';

describe('Word Search, many puzzles', () => {
  it('every puzzle can be finished, and random taps never find a word that isn’t there', () => {
    simulate<State>({
      games: 200,
      maxSteps: 200,
      start: (rng) => newPuzzle(0, rng),
      step: (s, rng) => {
        // Half the time a random tap; otherwise one end of a word not yet found.
        if (rng() < 0.5) return tap(s, Math.floor(rng() * SIZE * SIZE))!;
        const w = s.words.find((x) => !s.found.includes(x.word))!;
        return tap(s, s.start === w.cells[0] ? w.cells.at(-1)! : w.cells[0])!;
      },
      isOver: isWon,
      isValid: isValidState,
      check: (prev, next) => {
        if (next.found.length > prev.found.length) {
          const w = next.words.find((x) => x.word === next.found.at(-1))!;
          expect(prev.start).toBe(w.cells[0]);
        }
      },
      end: (s) => expect(isWon(s)).toBe(true),
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished puzzle stays finished', () => {
    const done = (() => {
      let s = newPuzzle();
      for (const w of s.words) s = tap(tap(s, w.cells[0])!, w.cells.at(-1)!)!;
      return s;
    })();
    const { finishedSteps } = stressScreen({ id: 'wordsearch', mount, isValid: isValidState, steps: 150, starts: [done], stepsFromStart: 20, isOver: isWon });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

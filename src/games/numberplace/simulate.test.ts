import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { mount } from './index';
import { LEVELS, PEERS, countSolutions, enter, isValidState, newGame, type Level } from './logic';

/** A real puzzle with every square filled in but one. */
function oneSquareLeft() {
  let s = newGame('easy', seededRng(1));
  const empty = s.puzzle.flatMap((n, i) => (n ? [] : [i]));
  for (const i of empty.slice(1)) s = enter(s, i, s.solution[i])!;
  return s;
}

describe('Number Place, many generated puzzles', () => {
  it.each(Object.keys(LEVELS) as Level[])('%s puzzles have exactly one answer, and entering it wins', (level) => {
    for (let seed = 1; seed <= 15; seed++) {
      let s = newGame(level, seededRng(seed));
      const where = `${level} puzzle, seed ${seed}`;
      expect(isValidState(s), where).toBe(true);
      expect(countSolutions(s.puzzle), where).toBe(1);
      expect(s.puzzle.filter(Boolean).length, where).toBe(LEVELS[level].givens);
      // The solution is a real grid: no number twice in any row, column or box.
      s.solution.forEach((n, i) => expect(PEERS[i].some((p) => s.solution[p] === n), where).toBe(false));
      s.puzzle.forEach((n, i) => n && expect(s.solution[i], where).toBe(n));
      for (let i = 0; i < 81; i++) if (!s.puzzle[i]) s = enter(s, i, s.solution[i])!;
      expect(s.won, where).toBe(true);
    }
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'numberplace',
      mount,
      isValid: isValidState,
      steps: 100,
      starts: [oneSquareLeft()],
      tries: 5,
      stepsFromStart: 25,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

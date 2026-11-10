import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { pick, simulate } from '../../test/simulate';
import { mount } from './index';
import { bestTarget, deal, findHint, isValidState, move, newGame, type Source, type State } from './logic';
import { oneMoveFromWinning } from './test-fixtures';

const sources = (s: State): Source[] =>
  s.tableau.flatMap((col, c) => col.up.map((_, index) => ({ col: c, index }))).filter((src) => bestTarget(s, src) !== null);

describe('Spider Solitaire, many games of random play', () => {
  it('never loses or copies a card, and finished runs only grow', () => {
    simulate<State>({
      games: 60,
      maxSteps: 500,
      start: (rng, i) => newGame(([1, 2, 4] as const)[i % 3], rng),
      step: (s, rng) => {
        const options = sources(s);
        const dealt = deal(s);
        if (options.length && (rng() < 0.85 || !dealt)) {
          const src = pick(options, rng);
          return move(s, src, bestTarget(s, src)!);
        }
        return dealt;
      },
      isOver: (s) => s.won || s.moves >= 400 || findHint(s) === null,
      isValid: isValidState, // checks every card of both decks is present exactly once
      check: (prev, next) => expect(next.done.length).toBeGreaterThanOrEqual(prev.done.length),
    });
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'spider',
      mount,
      isValid: isValidState,
      steps: 100,
      starts: [oneMoveFromWinning()],
      tries: 5,
      stepsFromStart: 25,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

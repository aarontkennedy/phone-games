import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { bestTarget, deal, findHint, isValidState, move, newGame, type Source, type State } from './logic';

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
});

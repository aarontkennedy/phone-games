import { describe, expect, it } from 'vitest';
import { pick, simulate } from '../../test/simulate';
import { LEVELS, isFinished, isValidState, newState, open, toggleFlag, type Level, type State } from './logic';

const levels = Object.keys(LEVELS) as Level[];

describe('Mines, many whole games', () => {
  it('the first dig is always safe; a win opens every safe square, a loss hits a mine', () => {
    simulate<State>({
      games: 1500,
      maxSteps: 400,
      start: (_rng, i) => newState(levels[i % levels.length]),
      step: (s, rng) => {
        const n: State = JSON.parse(JSON.stringify(s));
        const hidden = n.revealed.flatMap((r, i) => (r ? [] : [i]));
        const i = pick(hidden, rng);
        if (n.mines && rng() < 0.1) toggleFlag(n, i);
        else {
          if (n.flagged[i]) toggleFlag(n, i);
          open(n, i, rng);
        }
        return n;
      },
      isOver: isFinished,
      isValid: isValidState,
      check: (prev, next) => {
        if (!prev.mines) expect(next.status).not.toBe('lost');
        expect(next.revealed.filter(Boolean).length).toBeGreaterThanOrEqual(prev.revealed.filter(Boolean).length);
      },
      end: (s) => {
        const safe = s.mines!.flatMap((m, i) => (m ? [] : [i]));
        if (s.status === 'won') expect(safe.every((i) => s.revealed[i])).toBe(true);
        else expect(s.mines![s.exploded]).toBe(true);
      },
    });
  }, 60_000);
});

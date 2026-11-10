// Screen stress tests (docs/TESTING.md, "Simulation tests"). Simulations check the rules;
// this drives the real screen: random taps on whatever can be tapped, random waits (so the
// computer moves), and now and then leaving the game and coming back. After every step:
// nothing crashed or logged an error, the saved game is valid, and a finished game didn't
// change while we only waited. (Four in a Row once let the computer play on after your win,
// which only showed up on the screen, half a second after the winning move.)
import { vi } from 'vitest';
import { seededRng, type Rng } from '../core/random';
import { load, save } from '../core/storage';
import { closeConfirm } from '../core/ui';
import { makeContainer, press, tap } from './helpers';

/** Set by `npm run test:stress`; the stress tests skip otherwise, so `npm run test:sim` stays quick. */
export const stressRun = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.STRESS;

/** Everything a player can tap: buttons, and the cards, cells and spaces games draw. */
const TARGETS = [
  'button:not([disabled])',
  ...['card', 'card-index', 'hand', 'cell', 'box', 'i', 'tile', 'src', 'spot', 'pick', 'col', 'pit', 'point', 'sq', 'line', 'pt', 'die', 'seat', 'pile', 'stock', 'target'].map(
    (d) => `[data-${d}]`,
  ),
].join(', ');

/** A finished game or hand, in the shapes the games use. */
export function looksFinished(s: unknown): boolean {
  const x = s as Record<string, unknown> | null;
  if (!x || typeof x !== 'object') return false;
  return (
    (x.result !== undefined && x.result !== null) ||
    x.won === true ||
    x.lost === true ||
    x.over === true ||
    x.status === 'won' ||
    x.status === 'lost' ||
    ['gameOver', 'handOver', 'roundOver', 'done', 'over'].includes(x.phase as string)
  );
}

export interface ScreenStress<S> {
  /** The game's id: its saved game is `${id}:state`. */
  id: string;
  mount: (container: HTMLElement) => () => void;
  isValid: (s: unknown) => boolean;
  /** Random steps from a new game. */
  steps: number;
  seed?: number;
  /**
   * Nearly finished games to also start from, so long games reach their ending too. Each
   * is tried `tries` times: random taps often start a new game before winning this one.
   */
  starts?: S[];
  tries?: number;
  /** Random steps from each start. */
  stepsFromStart?: number;
  /** The game's own test for a finished game, on top of `looksFinished`. */
  isOver?: (s: S) => boolean;
}

/** Runs the stress test. Throws on the first problem; returns how many steps began finished. */
export function stressScreen<S>(opts: ScreenStress<S>): { finishedSteps: number } {
  const key = `${opts.id}:state`;
  const isOver = (s: unknown) => s !== null && (looksFinished(s) || (opts.isOver?.(s as S) ?? false));
  const runs: (S | null)[] = [null, ...(opts.starts ?? []).flatMap((s) => Array<S>(opts.tries ?? 2).fill(s))];
  const errors: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args.map(String).join(' ')));
  vi.useFakeTimers();
  let finishedSteps = 0;
  try {
    runs.forEach((raw, run) => {
      // The computer plays Easy: Strong searches far ahead on every move, which is slow here
      // (the simulations already cover Strong). The level buttons are left alone.
      const start = raw !== null && typeof (raw as { level?: unknown }).level === 'string' ? { ...raw, level: 'easy' } : raw;
      const rng: Rng = seededRng((opts.seed ?? 1) + run);
      localStorage.clear();
      document.body.replaceChildren();
      if (start !== null) save(key, start);
      let container = makeContainer();
      let unmount = opts.mount(container);
      document.querySelector<HTMLElement>('[data-level="easy"]')?.click();
      const steps = start === null ? opts.steps : (opts.stepsFromStart ?? opts.steps);
      const where = (step: number) => `${opts.id} ${start === null ? 'from a new game' : `from nearly-finished game ${run}`}, step ${step}`;
      try {
        // Step 0 only waits: just opening a finished game must not let the computer play on.
        for (let step = 0; step <= steps; step++) {
          const r = step === 0 ? 1 : rng();
          if (step === 0) {
            // Nothing to tap yet.
          } else if (r < 0.03) {
            // Leave the game and come back, as the app does.
            closeConfirm();
            unmount();
            container = makeContainer();
            unmount = opts.mount(container);
          } else if (r < 0.1) {
            press(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'][Math.floor(rng() * 4)]); // swipes, for 2048
          } else {
            const targets = [...document.body.querySelectorAll<HTMLElement>(TARGETS)].filter(
              (el) => !el.closest('[hidden]') && !(el as HTMLButtonElement).disabled && !el.matches('[data-level]'),
            );
            const el = targets[Math.floor(rng() * targets.length)];
            if (el) {
              if (rng() < 0.5) el.click();
              else tap(el);
            }
          }
          const before = JSON.stringify(load<unknown>(key, null));
          const finished = isOver(JSON.parse(before));
          if (finished) finishedSteps++;
          vi.advanceTimersByTime(rng() < 0.7 ? 1500 : Math.floor(rng() * 800));
          const after = JSON.stringify(load<unknown>(key, null));
          if (finished && after !== before) throw new Error(`${where(step)}: a finished game changed while waiting`);
          const saved = JSON.parse(after);
          if (saved !== null && !opts.isValid(saved)) throw new Error(`${where(step)}: the saved game is invalid`);
          if (errors.length) throw new Error(`${where(step)}: ${errors[0]}`);
        }
      } finally {
        closeConfirm();
        unmount();
      }
    });
  } finally {
    spy.mockRestore();
  }
  return { finishedSteps };
}

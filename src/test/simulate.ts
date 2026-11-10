// Mass simulation for game rules (docs/TESTING.md, "Simulation tests"). Plays many
// complete games with seeded randomness, checking the state after every move, so rare
// situations get exercised: decks running out, stalemates, odd scores.
import { seededRng, type Rng } from '../core/random';

export interface Simulation<S> {
  /** How many complete games to play. Game i uses seed `seed + i`, so failures reproduce. */
  games: number;
  seed?: number;
  /** A game that hasn't finished after this many moves counts as stuck. */
  maxSteps: number;
  start: (rng: Rng, game: number) => S;
  /** The next move for whoever is to play. Must return a state: null means a stuck game. */
  step: (s: S, rng: Rng) => S | null;
  isOver: (s: S) => boolean;
  isValid: (s: unknown) => boolean;
  /** Rules that must hold from one state to the next. Throw (or use expect) to fail. */
  check?: (prev: S, next: S) => void;
  /** Checks on the finished game, e.g. that the declared winner is right. */
  end?: (s: S) => void;
}

/** Plays the games and returns the finished states, for overall checks. */
export function simulate<S>(sim: Simulation<S>): S[] {
  const finished: S[] = [];
  for (let game = 0; game < sim.games; game++) {
    const where = (step: number) => `game ${game} (seed ${(sim.seed ?? 1) + game}), move ${step}`;
    const rng = seededRng((sim.seed ?? 1) + game);
    let s = sim.start(rng, game);
    if (!sim.isValid(s)) throw new Error(`${where(0)}: the starting state is invalid`);
    let steps = 0;
    while (!sim.isOver(s)) {
      if (++steps > sim.maxSteps) throw new Error(`${where(steps)}: still not finished, so it may be stuck`);
      const next = sim.step(s, rng);
      if (next === null) throw new Error(`${where(steps)}: no legal move was accepted`);
      if (!sim.isValid(next)) throw new Error(`${where(steps)}: the state became invalid`);
      if (!sim.isValid(JSON.parse(JSON.stringify(next)))) throw new Error(`${where(steps)}: the state doesn't survive a save`);
      try {
        sim.check?.(s, next);
      } catch (e) {
        throw new Error(`${where(steps)}: ${(e as Error).message}`);
      }
      s = next;
    }
    try {
      sim.end?.(s);
    } catch (e) {
      throw new Error(`${where(steps)}, at the end: ${(e as Error).message}`);
    }
    finished.push(s);
  }
  return finished;
}

/** Picks one item at random. */
export const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

/**
 * Nearly finished games, for screen stress tests to start from: plays games like
 * `simulate` (without its checks) and keeps, from each, the state `movesBefore` moves
 * before it ended.
 */
export function nearlyFinished<S>(
  sim: Pick<Simulation<S>, 'games' | 'seed' | 'maxSteps' | 'start' | 'step' | 'isOver'>,
  movesBefore: number,
): S[] {
  const out: S[] = [];
  for (let game = 0; game < sim.games; game++) {
    const rng = seededRng((sim.seed ?? 1) + game);
    const recent: S[] = [sim.start(rng, game)];
    for (let steps = 0; !sim.isOver(recent.at(-1)!) && steps < sim.maxSteps; steps++) {
      const next = sim.step(recent.at(-1)!, rng);
      if (next === null) break;
      recent.push(next);
      if (recent.length > movesBefore + 1) recent.shift();
    }
    if (sim.isOver(recent.at(-1)!)) out.push(recent[0]);
  }
  return out;
}

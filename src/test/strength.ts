// "Strong beats Easy" checks (docs/TESTING.md, "Simulation tests"): plays whole games with
// Strong on one side and Easy on the other, and returns how often Strong won. Without
// this, Strong could quietly become as weak as Easy and every other test would pass.
import { seededRng, type Rng } from '../core/random';

export interface Match<S> {
  games: number;
  seed?: number;
  /** Moves before a game counts as stuck. */
  maxSteps: number;
  /** Game i: `strong` is the Strong side for that game (alternates so neither side always moves first). */
  start: (rng: Rng, game: number, strong: number) => S;
  /** The next move, with `strong` telling the step which side plays Strong. */
  step: (s: S, rng: Rng, strong: number) => S | null;
  isOver: (s: S) => boolean;
  /** 1 if Strong won, 0 if it lost, 0.5 for a draw. */
  score: (s: S, strong: number) => number;
  /** How many sides Strong rotates through: 2 for one-on-one or teams, 4 to rotate a seat. */
  sides?: number;
}

/** Strong's share of the points, from 0 to 1. */
export function strongShare<S>(m: Match<S>): number {
  let total = 0;
  for (let game = 0; game < m.games; game++) {
    const rng = seededRng((m.seed ?? 1) + game);
    const strong = game % (m.sides ?? 2);
    let s = m.start(rng, game, strong);
    for (let steps = 0; !m.isOver(s); steps++) {
      if (steps > m.maxSteps) throw new Error(`game ${game}: still not finished, so it may be stuck`);
      const next = m.step(s, rng, strong);
      if (next === null) throw new Error(`game ${game}: no legal move was accepted`);
      s = next;
    }
    total += m.score(s, strong);
  }
  return total / m.games;
}

/** The level for the side or seat about to act. */
export const levelFor = (strong: boolean): 'strong' | 'easy' => (strong ? 'strong' : 'easy');

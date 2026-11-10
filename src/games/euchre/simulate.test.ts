import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { applyBid, chooseBid, chooseCard, chooseDiscard, collect, discard, GAME_POINTS, isValidState, newGame, nextHand, play, playersIn, teamOf, winner, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 3000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  step: (s, rng) => {
    if (s.phase === 'handOver') return nextHand(s, rng);
    if (s.phase === 'bidding1' || s.phase === 'bidding2') return applyBid(s, s.turn, chooseBid(s, s.turn, rng));
    if (s.phase === 'discard') return discard(s, chooseDiscard(s));
    if (s.trick.length === playersIn(s)) return collect(s);
    return play(s, s.turn, chooseCard(s, s.turn, rng));
  },
  isOver: (s) => s.phase === 'gameOver',
};

describe('Euchre, many whole games', () => {
  it('always finishes, five tricks a hand, 1, 2 or 4 points to the right team', () => {
    simulate<State>({
      ...wholeGame,
      games: 150,
      isValid: isValidState,
      check: (prev, next) => {
        if (prev.phase === 'playing' && next.phase !== 'playing') {
          const r = next.last!;
          expect(next.tricks.reduce((a, b) => a + b, 0)).toBe(5);
          expect([1, 2, 4]).toContain(r.points);
          const makers = teamOf(prev.maker!);
          expect(r.team).toBe(r.euchred ? 1 - makers : makers);
          expect(r.euchred).toBe(r.makerTricks < 3);
          if (r.euchred) expect(r.points).toBe(2);
          else expect(r.points).toBe(r.makerTricks < 5 ? 1 : prev.alone ? 4 : 2);
          expect(next.scores[r.team]).toBe(prev.scores[r.team] + r.points);
          expect(next.scores[1 - r.team]).toBe(prev.scores[1 - r.team]);
        } else {
          expect(next.scores).toEqual(prev.scores);
        }
      },
      end: (s) => {
        expect(s.scores[winner(s)!]).toBeGreaterThanOrEqual(GAME_POINTS);
      },
    });
  }, 60_000);
  it('a Strong team beats an Easy team', () => {
    const share = strongShare<State>({
      games: 60,
      maxSteps: 3000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => {
        const level = levelFor(s.turn % 2 === strong);
        if (s.phase === 'handOver') return nextHand(s, rng);
        if (s.phase === 'bidding1' || s.phase === 'bidding2') return applyBid(s, s.turn, chooseBid({ ...s, level }, s.turn, rng));
        if (s.phase === 'discard') return discard(s, chooseDiscard(s));
        if (s.trick.length === playersIn(s)) return collect(s);
        return play(s, s.turn, chooseCard({ ...s, level }, s.turn, rng));
      },
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.75);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'euchre',
      mount,
      isValid: isValidState,
      steps: 100,
      // Finished games (reopening one must not let the computer play on), and nearly finished ones.
      starts: [...nearlyFinished({ ...wholeGame, games: 2 }, 0), ...nearlyFinished({ ...wholeGame, games: 2 }, 3)],
      stepsFromStart: 25,
      isOver: wholeGame.isOver,
    });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

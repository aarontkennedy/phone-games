import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { nearlyFinished, pick, simulate, type Simulation } from '../../test/simulate';
import { levelFor, strongShare } from '../../test/strength';
import { mount } from './index';
import { bid, chooseBid, chooseCard, collect, GAME_POINTS, isValidState, legalPlays, newGame, nextRound, play, winner, type State } from './logic';

/** How a whole game is played, shared by the simulation and the screen stress test. */
const wholeGame: Pick<Simulation<State>, 'maxSteps' | 'start' | 'step' | 'isOver'> = {
  maxSteps: 5000,
  start: (rng, i) => newGame(i % 2 ? 'easy' : 'strong', rng),
  step: (s, rng) => {
    if (s.phase === 'roundOver') return nextRound(s, rng);
    if (s.phase === 'bidding') return bid(s, s.turn, chooseBid(s, s.turn, rng));
    if (s.trick.length === 4) return collect(s);
    const seat = s.turn;
    return play(s, seat, seat === 0 ? pick(legalPlays(s, 0), rng) : chooseCard(s, seat, rng));
  },
  isOver: (s) => s.phase === 'gameOver',
};

describe('Spades, many whole games', () => {
  it('always finishes, 13 tricks a round, scores move by the round result', () => {
    simulate<State>({
      ...wholeGame,
      games: 40,
      isValid: isValidState,
      check: (prev, next) => {
        if (prev.phase === 'playing' && next.phase !== 'playing') {
          expect(next.tricks.reduce((a, b) => a + b, 0)).toBe(13);
          expect(next.scores).toEqual([prev.scores[0] + next.last!.points[0], prev.scores[1] + next.last!.points[1]]);
        } else if (next.phase !== 'bidding' || prev.phase !== 'roundOver') {
          expect(next.scores).toEqual(prev.scores);
        }
      },
      end: (s) => {
        expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(GAME_POINTS);
        expect(s.scores[0]).not.toBe(s.scores[1]);
        expect(s.scores[winner(s)!]).toBe(Math.max(...s.scores));
      },
    });
  }, 60_000);
  it('a Strong team beats an Easy team', () => {
    const share = strongShare<State>({
      games: 40,
      maxSteps: 5000,
      start: (rng) => newGame('strong', rng),
      step: (s, rng, strong) => {
        const level = levelFor(s.turn % 2 === strong);
        if (s.phase === 'roundOver') return nextRound(s, rng);
        if (s.phase === 'bidding') return bid(s, s.turn, chooseBid({ ...s, level }, s.turn, rng));
        if (s.trick.length === 4) return collect(s);
        return play(s, s.turn, chooseCard({ ...s, level }, s.turn, rng));
      },
      isOver: (s) => s.phase === 'gameOver',
      score: (s, strong) => (winner(s) === strong ? 1 : 0),
    });
    expect(share).toBeGreaterThanOrEqual(0.8);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const { finishedSteps } = stressScreen({
      id: 'spades',
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

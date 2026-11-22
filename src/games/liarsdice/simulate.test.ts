import { describe, expect, it } from 'vitest';
import { stressRun, stressScreen } from '../../test/screen-stress';
import { simulate } from '../../test/simulate';
import { mount } from './index';
import { advice, bid, call, computerMove, isValidState, newGame, nextRound, totalDice, type Level, type State } from './logic';

/** Plays whole games: seat 0 by the odds (Hint), the others as `level`. */
function play(games: number, level: Level) {
  let youWin = 0;
  simulate<State>({
    games,
    maxSteps: 3000,
    start: (rng) => newGame(level, rng),
    step: (s, rng) => {
      if (s.reveal) return nextRound(s, rng);
      if (s.turn !== 0) return computerMove(s, rng);
      const a = advice(s, 0);
      return a.call ? call(s, 0) : bid(s, 0, a.qty, a.face);
    },
    isOver: (s) => s.winner !== null,
    isValid: isValidState,
    check: (prev, next) => {
      expect(totalDice(next)).toBeLessThanOrEqual(totalDice(prev));
      if (prev.reveal && !next.reveal) expect(totalDice(next)).toBe(totalDice(prev) - 1);
      if (next.bid && prev.bid && next.bid !== prev.bid && !next.reveal) {
        expect(next.bid.qty > prev.bid.qty || (next.bid.qty === prev.bid.qty && next.bid.face > prev.bid.face)).toBe(true);
      }
    },
    end: (s) => {
      if (s.winner === 0) youWin++;
    },
  });
  return youWin / games;
}

describe('Liar’s Dice, many games', () => {
  it('plays legal games to the end, and playing the odds beats Easy players', () => {
    expect(play(300, 'easy')).toBeGreaterThan(0.45); // an even share would be 1 in 3
    expect(play(300, 'strong')).toBeGreaterThan(0.15);
  }, 60_000);

  // Its own command (npm run test:stress), so it doesn't slow the simulations down.
  it.skipIf(!stressRun)('survives random tapping on the screen, and a finished game stays finished', () => {
    const won: State = { level: 'easy', dice: [[3], [], []], turn: 0, bid: null, reveal: null, winner: 0 };
    const { finishedSteps } = stressScreen({ id: 'liarsdice', mount, isValid: isValidState, steps: 150, starts: [won], stepsFromStart: 20, isOver: (s: State) => s.winner !== null });
    expect(finishedSteps).toBeGreaterThan(0); // the check above really ran
  }, 120_000);
});

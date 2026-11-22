import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track, answerNewGame } from '../../test/helpers';
import { AI_DELAY, BUST_PAUSE, mount, moveText } from './index';
import { newGame, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('pig:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('pig:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const recent = () => [...container.querySelectorAll('[data-recent] li')].map((li) => li.textContent).reverse();
  return { container, unmount, $, stored, status, recent };
}

/** Makes the next rolls these faces (Math.random is what roll() uses by default). */
function nextRolls(...faces: number[]) {
  const spy = vi.spyOn(Math, 'random');
  for (const f of faces) spy.mockReturnValueOnce((f - 1) / 6 + 0.01);
}

const at = (o: Partial<State>): State => ({ ...newGame(), ...o });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.restoreAllMocks());

describe('Pig screen', () => {
  it('rolls, holds, and passes the die to the computer', () => {
    const { $, stored, status, recent } = setup();
    expect(status()).toMatch(/^Roll the die\./);
    expect($<HTMLButtonElement>('[data-hold]').disabled).toBe(true);
    expect($('[data-hint]')).toBeNull(); // the first roll of a turn isn't a choice
    nextRolls(5);
    $('[data-roll]').click();
    expect(status()).toBe('You have 5 this turn, 5 if you hold. Roll again, or hold.');
    expect($('[data-turn-points]').textContent).toBe('5');
    $('[data-hold]').click(); // 5 is too soon: rolling on is best
    expect(stored().scores).toEqual([5, 0]);
    expect(recent()).toEqual(['You held 5, for 5.']);
    expect($('[data-accuracy]').textContent).toBe('0%');
    expect(status()).toBe('The computer is rolling…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().roll).not.toBeNull();
  });

  it('loses the turn on a 1, then the die passes', () => {
    const { $, stored, status, recent } = setup(at({ turnPoints: 8, roll: 4 }));
    nextRolls(1);
    $('[data-roll]').click();
    expect(status()).toBe('A 1! Your turn ends with nothing banked.');
    expect(recent()).toEqual(['You rolled a 1 and lost 8 points.']);
    expect($('.pi-die').classList.contains('bust')).toBe(true);
    vi.advanceTimersByTime(BUST_PAUSE);
    expect(stored().turn).toBe(1);
  });

  it('gives the best play when asked, says it after a miss, and scores a best play as right', () => {
    const { $ } = setup(at({ turnPoints: 22, roll: 5 }));
    $('[data-hint]').click();
    expect($('[data-tip]').textContent).toBe('Best: hold 22.');
    nextRolls(3);
    $('[data-roll]').click(); // asked first: not scored
    expect($('[data-accuracy]').textContent).toBe('–');
    document.body.replaceChildren();
    const miss = setup(at({ turnPoints: 22, roll: 5 }));
    nextRolls(3);
    miss.$('[data-roll]').click();
    expect(miss.status()).toMatch(/^Best was to hold 22\. You have 25 this turn/);
    document.body.replaceChildren();
    const right = setup(at({ turnPoints: 6, roll: 6 }));
    nextRolls(2);
    right.$('[data-roll]').click();
    expect(load('pig:accuracy', null)).toEqual({ right: 1, plays: 2 });
  });

  it('ends at 100, starts over, and asks before New partway through', () => {
    const { $, stored, status } = setup(at({ scores: [96, 50], turnPoints: 6, roll: 6 }));
    $('[data-hold]').click();
    expect(status()).toBe('You reached 100!');
    $<HTMLButtonElement>('.overlay .btn').click();
    expect(stored().scores).toEqual([0, 0]);
    nextRolls(4);
    $('[data-roll]').click();
    $('[data-new]').click();
    answerNewGame();
    expect(stored().turnPoints).toBe(0);
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    $('[data-controls]').click(); // not on a button
  });

  it('says what each turn did, for the recent moves list', () => {
    expect(moveText(at({ turn: 1, turnPoints: 0 }), at({ turn: 1, bust: true, roll: 1 }))).toBe('The computer rolled a 1 and lost nothing.');
    expect(moveText(at({ turnPoints: 4 }), at({ turnPoints: 9 }))).toBeNull();
    document.body.replaceChildren();
    const lost = setup(at({ turn: 1, scores: [10, 99], turnPoints: 0 }));
    vi.advanceTimersByTime(AI_DELAY * 40 + BUST_PAUSE * 5);
    expect(lost.stored().winner === 1 || lost.stored().turn === 0).toBe(true);
    const broken = setup({ level: 'x' });
    broken.unmount();
    expect(broken.stored().scores).toBeDefined();
  });
});

describe('Pig colors', () => {
  it('shows a rolled 1 clearly in light and dark', () => {
    const own = themes(css, '.pi');
    const app = themes(appCss, ':root');
    for (const t of ['light', 'dark'] as const) expect(contrast(own[t]['pi-bust'], app[t].surface)).toBeGreaterThanOrEqual(4.5);
  });
});

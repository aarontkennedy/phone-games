import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, readVars } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { newGame, type Cell, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('reversi:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const sq = (r: number, c: number) => $<HTMLButtonElement>(`[data-sq="${r * 8 + c}"]`);
  const stored = () => load<State>('reversi:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, sq, stored, status };
}

const board = (rows: string[]): Cell[] => rows.join('').split('').map((ch) => (ch === 'o' ? 0 : ch === 'x' ? 1 : null));
const empty = ['........', '........', '........', '........', '........', '........', '........'];

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Reversi screen', () => {
  it('starts with four discs and rings on your four moves', () => {
    const { $, $$, sq, status } = setup();
    expect($$('.rv-disc.p0')).toHaveLength(2);
    expect($$('.rv-sq.target')).toHaveLength(4);
    expect(sq(2, 3).disabled).toBe(false);
    expect(sq(2, 3).getAttribute('aria-label')).toBe('You can play here, row 3, column 4');
    expect(sq(3, 3).getAttribute('aria-label')).toBe('Computer’s disc, row 4, column 4');
    expect(sq(0, 0).disabled).toBe(true);
    expect($('[data-you]').textContent).toBe('2');
    expect(status()).toBe('Your turn: tap a square with a ring to place a purple disc.');
  });

  it('plays your move, then the computer answers after a pause', () => {
    const { $, sq, stored, status } = setup();
    sq(2, 3).click();
    expect($('[data-you]').textContent).toBe('4');
    expect(status()).toBe('The computer is thinking…');
    sq(5, 4).click(); // not your turn
    expect(stored().turn).toBe(1);
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().turn).toBe(0);
    expect(stored().last).not.toBe(19);
    expect($('.rv-sq.last')).not.toBeNull();
  });

  it('says when someone had to pass', () => {
    const pass = (passed: 0 | 1) => setup({ ...newGame(), passed }).status();
    expect(pass(1)).toMatch(/^The computer can’t move, so it passes\./);
    expect(pass(0)).toMatch(/^You can’t move, so you pass\./);
  });

  it('shows the result and the rounds won, then a new round', () => {
    const won = setup({ ...newGame(), board: board(['.xo.....', ...empty]) });
    won.sq(0, 0).click();
    expect(won.status()).toBe('You win! Rounds won: you 1, computer 0. Tap  for another round.');
    won.$('[data-new]').click();
    expect(won.stored()).toMatchObject({ starter: 1, turn: 1, result: null });

    expect(setup({ ...newGame(), result: 1 }).status()).toMatch(/^The computer wins\./);
    expect(setup({ ...newGame(), result: 'draw' }).status()).toMatch(/^It’s a draw\./);
  });

  it('switches Easy and Strong, ignores stray taps and broken saves, and stops when closed', () => {
    const { $, stored, unmount, container } = setup({ ...newGame(), turn: 1, level: 'nope' });
    expect(stored()).toMatchObject({ turn: 0, level: 'strong' }); // broken save: a fresh game
    $<HTMLButtonElement>('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect($('[data-level="easy"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-board]').click();
    unmount();
    expect(container.children).toHaveLength(0);
  });

  it('stops the computer’s pending move when closed', () => {
    const { sq, stored, unmount } = setup();
    sq(2, 3).click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().turn).toBe(1);
  });
});

describe('Reversi colors', () => {
  const c = readVars(css, /(?:^|\n)\.rv\s*{([^}]*)}/);
  it('discs and move marks stand out on the squares (3:1)', () => {
    expect(contrast(c['rv-you'], c['rv-square'])).toBeGreaterThanOrEqual(3);
    expect(contrast(c['rv-computer'], c['rv-square'])).toBeGreaterThanOrEqual(3);
    expect(contrast(c['rv-mark'], c['rv-square'])).toBeGreaterThanOrEqual(3);
  });
});

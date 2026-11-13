import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { expectStaysFinished, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { drop, newGame, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('fourinarow:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const col = (c: number) => $<HTMLButtonElement>(`[data-col="${c}"]`);
  const stored = () => load<State>('fourinarow:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, col, stored, status };
}

const play = (cols: number[], s: State = newGame()) => cols.reduce((st, c) => drop(st, c)!, s);

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Four in a row screen', () => {
  it('starts empty, on your turn', () => {
    const { col, status, $ } = setup();
    expect(col(0).getAttribute('aria-label')).toBe('Column 1');
    expect($('.fir-space.p0')).toBeNull();
    expect(status()).toBe('Your turn: tap a column to drop a purple disc.');
  });

  it('drops your disc, then the computer answers', () => {
    const { col, status, stored, $ } = setup();
    col(3).click();
    expect($('.fir-space.p0.last')).not.toBeNull();
    expect(col(0).disabled).toBe(true);
    expect(status()).toBe('The computer is thinking…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().board.filter((d) => d !== null)).toHaveLength(2);
  });

  it('marks a full column', () => {
    expect(setup(play([0, 0, 0, 0, 0, 0])).col(0).getAttribute('aria-label')).toBe('Column 1, full');
  });

  it('shows a win, a loss and a draw, then a new round', () => {
    const won = setup(play([0, 0, 1, 1, 2, 2]));
    won.col(3).click();
    expect(won.status()).toBe('You win! Tap  for another round.');
    expect(won.$('.fir-space.win')).not.toBeNull();
    // The computer doesn't take a turn after your win, and the columns stay closed.
    expectStaysFinished(won.stored);
    expect(won.status()).toBe('You win! Tap  for another round.');
    expect(won.col(4).disabled).toBe(true);
    won.$('[data-new]').click();
    expect(won.stored().starter).toBe(1);
    document.body.replaceChildren();

    expect(setup({ ...play([0, 1, 0, 1, 6, 1, 6, 1]) }).status()).toBe('The computer wins. Tap  for another round.');
    document.body.replaceChildren();
    expect(setup({ ...newGame(), result: 'draw' }).status()).toBe('The board is full: it’s a draw. Tap  for another round.');
  });

  it('switches Easy and Strong without restarting, ignores stray taps, and stops when closed', () => {
    const { $, stored, unmount } = setup(play([3]));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    $('[data-board]').click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 2);
    expect(stored().board.filter((d) => d !== null)).toHaveLength(1);
    expect(setup({ board: 1 }).status()).toMatch(/^Your turn/);
  });
});

describe('Four in a row colors', () => {
  const t = themes(css, '.fir');
  const app = themes(appCss, ':root');
  it.each([
    ['light', t.light, app.light],
    ['dark', t.dark, app.dark],
  ])('discs stand out in the %s theme (3:1)', (_n, c, a) => {
    for (const disc of ['fir-you', 'fir-computer']) {
      expect(contrast(c[disc], a.surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(c[disc], a.board)).toBeGreaterThanOrEqual(3);
    }
  });
});

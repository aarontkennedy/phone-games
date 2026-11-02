import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { answerNewGame, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { move, newGame, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('dots:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const line = (i: number) => $(`[data-line="${i}"]`);
  const stored = () => load<State>('dots:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, line, stored, status };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Dots and Boxes screen', () => {
  it('shows 25 dots, 40 lines and 16 boxes', () => {
    const { container, line, status } = setup();
    expect(container.querySelectorAll('.db-dot')).toHaveLength(25);
    expect(container.querySelectorAll('[data-line]')).toHaveLength(40);
    expect(container.querySelectorAll('.db-box')).toHaveLength(16);
    expect(line(0).getAttribute('aria-label')).toBe('Across line 1: open');
    expect(line(20).getAttribute('aria-label')).toBe('Down line 1: open');
    expect(status()).toMatch(/^Your turn: tap between two dots/);
  });

  it('draws your line, then the computer answers after a pause', () => {
    const { line, stored, status } = setup();
    line(0).click();
    expect(line(0).classList.contains('drawn')).toBe(true);
    expect(status()).toBe('The computer is thinking…');
    line(1).click(); // not your turn
    expect(stored().lines[1]).toBe(false);
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().turn).toBe(0);
    expect(status()).toMatch(/^Your turn: draw a line/);
  });

  it('fills a box you close, and shows the result', () => {
    // Every line drawn except the one between boxes 1 and 2 (played for real, always your turn).
    let s = newGame();
    for (let l = 0; l < 40; l++) if (l !== 21) s = { ...move(s, l)!, turn: 0 };
    const { $, line, status } = setup(s);
    line(21).click();
    expect($('.db-box.p0')).not.toBeNull();
    expect(status()).toMatch(/^(You win|The computer wins|It’s a draw)/);
    expect(setup({ ...newGame(), result: 1 }).status()).toMatch(/^The computer wins/);
    expect(setup({ ...newGame(), result: 'draw' }).status()).toMatch(/^It’s a draw/);
  });

  it('switches Easy and Strong, asks before New mid-round, and stops when closed', () => {
    const { $, line, stored, unmount, container } = setup();
    $<HTMLButtonElement>('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    line(0).click();
    vi.advanceTimersByTime(AI_DELAY);
    $<HTMLButtonElement>('[data-new]').click();
    answerNewGame();
    expect(stored().lines.filter(Boolean)).toHaveLength(0);
    $('[data-board]').click();
    unmount();
    expect(container.children).toHaveLength(0);
  });
});

describe('Dots and Boxes colors', () => {
  const db = themes(css, '.db');
  const app = themes(appCss, ':root');
  it.each([
    ['light', db.light, app.light],
    ['dark', db.dark, app.dark],
  ])('boxes and open lines stand out on the board in the %s theme (3:1)', (_n, t, a) => {
    for (const v of ['db-you', 'db-them', 'db-guide']) expect(contrast(t[v], a.board), v).toBeGreaterThanOrEqual(3);
  });
});

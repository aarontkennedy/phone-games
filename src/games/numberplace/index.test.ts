import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { seededRng } from '../../core/random';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, setHidden, track } from '../../test/helpers';
import { mount } from './index';
import { PEERS, enter, newGame, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('numberplace:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const cell = (i: number) => $(`[data-cell="${i}"]`);
  const num = (n: number) => $<HTMLButtonElement>(`[data-num="${n}"]`);
  const stored = () => load<State>('numberplace:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, cell, num, stored, status };
}

const puzzle = () => newGame('easy', seededRng(11));

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

describe('Number place screen', () => {
  it('shows the puzzle and asks you to pick a square', () => {
    const s = puzzle();
    const { cell, num, status, $ } = setup(s);
    const given = s.puzzle.findIndex(Boolean);
    expect(cell(given).classList.contains('given')).toBe(true);
    expect(cell(given).getAttribute('aria-label')).toMatch(/, given$/);
    expect(num(1).disabled).toBe(true);
    expect($('[data-left]').textContent).toBe(String(s.puzzle.filter((n) => !n).length));
    expect(status()).toBe('Tap an empty square, then a number.');
  });

  it('fills and erases a square, and highlights the same number elsewhere', () => {
    const s = puzzle();
    const { cell, num, status, stored, $ } = setup(s);
    const empty = s.puzzle.indexOf(0);
    cell(empty).click();
    expect(status()).toBe('Tap a number to fill the square, or the erase key to clear it.');
    num(s.solution[empty]).click();
    expect(cell(empty).textContent).toBe(String(s.solution[empty]));
    expect(cell(empty).classList.contains('mine')).toBe(true);
    expect(stored().entries[empty]).toBe(s.solution[empty]);
    expect($('.np-cell.same')).not.toBeNull();
    num(0).click();
    expect(stored().entries[empty]).toBe(0);
  });

  it('won’t let you change a given number', () => {
    const s = puzzle();
    const { cell, num, status } = setup(s);
    cell(s.puzzle.findIndex(Boolean)).click();
    expect(status()).toBe('That number was given. Tap an empty square.');
    expect(num(1).disabled).toBe(true);
  });

  it('marks clashes', () => {
    const s = puzzle();
    const empty = s.puzzle.indexOf(0);
    const peer = PEERS[empty].find((j) => s.puzzle[j])!;
    const { cell, status } = setup(enter(s, empty, s.puzzle[peer]));
    expect(cell(empty).classList.contains('clash')).toBe(true);
    expect(cell(empty).getAttribute('aria-label')).toMatch(/clashes$/);
    expect(status()).toBe('Some numbers clash: they’re marked in red and underlined.');
  });

  it('times the puzzle, pausing while hidden, and records the best time when solved', () => {
    let s: State = puzzle();
    const empties = s.puzzle.flatMap((n, i) => (n ? [] : [i]));
    for (const i of empties.slice(0, -1)) s = enter(s, i, s.solution[i])!;
    const { cell, num, status, stored, $ } = setup(s);
    vi.advanceTimersByTime(3000);
    expect($('[data-time]').textContent).toBe('0:03');
    setHidden(true);
    vi.advanceTimersByTime(5000);
    setHidden(false);
    vi.advanceTimersByTime(2000);
    const last = empties.at(-1)!;
    cell(last).click();
    num(s.solution[last]).click();
    expect(stored().won).toBe(true);
    expect(status()).toBe('Solved in 0:05! Best: 0:05.');
    expect($('.overlay h2').textContent).toBe('Solved!');
    expect(load('numberplace:best', {})).toEqual({ easy: 5 });
    cell(0).click(); // squares can't be picked once solved
    $('.overlay .btn').click();
    expect(stored().won).toBe(false);
    expect(status()).toBe('Tap an empty square, then a number. Best: 0:05.');
  });

  it('keeps a better best time', () => {
    save('numberplace:best', { easy: 1 });
    let s: State = puzzle();
    const empties = s.puzzle.flatMap((n, i) => (n ? [] : [i]));
    for (const i of empties.slice(0, -1)) s = enter(s, i, s.solution[i])!;
    const { cell, num } = setup(s);
    vi.advanceTimersByTime(9000);
    cell(empties.at(-1)!).click();
    num(s.solution[empties.at(-1)!]).click();
    expect(load('numberplace:best', {})).toEqual({ easy: 1 });
  });

  it('starts a new puzzle at another difficulty, ignores stray taps, and saves when closed', () => {
    const { $, stored, unmount, container } = setup(puzzle());
    $('[data-board]').click();
    $('[data-level="hard"]').click();
    expect(stored().level).toBe('hard');
    expect($('[data-level="hard"]').getAttribute('aria-pressed')).toBe('true');
    vi.advanceTimersByTime(2000);
    unmount();
    expect(stored().elapsed).toBe(2000);
    expect(container.children).toHaveLength(0);
    expect(setup({ puzzle: 1 }).status()).toBe('Tap an empty square, then a number.');
  });
});

describe('Number place colors', () => {
  const t = themes(css, '.np');
  const app = themes(appCss, ':root');
  it.each([
    ['light', t.light, app.light],
    ['dark', t.dark, app.dark],
  ])('numbers are readable in the %s theme (4.5:1)', (_n, c, a) => {
    for (const bg of [a.surface, c['np-same']]) {
      expect(contrast(a.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c['np-mine'], bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c['np-clash'], bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Number place hints', () => {
  it('fills the chosen square, or the easiest one, and says what it is', () => {
    const p = puzzle();
    const { cell, stored, status, $ } = setup(p);
    const empty = p.puzzle.findIndex((n) => !n);
    cell(empty).click();
    $<HTMLButtonElement>('[data-hint]').click();
    expect(stored().entries[empty]).toBe(p.solution[empty]);
    expect(status()).toBe(`Hint: row ${Math.floor(empty / 9) + 1}, column ${(empty % 9) + 1} is ${p.solution[empty]}.`);
    cell(empty).click();
    expect(status()).not.toMatch(/^Hint/);
    $<HTMLButtonElement>('[data-hint]').click(); // that square is right now: another one gets filled
    expect(stored().entries.filter(Boolean)).toHaveLength(2);
  });

  it('does nothing once solved', () => {
    const p = puzzle();
    const solved = { ...p, entries: p.solution.map((n, i) => (p.puzzle[i] ? 0 : n)), won: true };
    const { stored, $ } = setup(solved);
    $<HTMLButtonElement>('[data-hint]').click();
    expect(stored().won).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import * as symbols from './symbols';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, pointer, setHidden, tap, track, answerNewGame } from '../../test/helpers';
import { LONG_PRESS_MS, mount } from './index';
import { seededRng } from '../../core/random';
import { fixture } from './test-fixtures';
import type { State } from './logic';

function setup(saved: State | null = fixture()) {
  if (saved) save('minesweeper:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const cells = () => [...container.querySelectorAll<HTMLElement>('.ms-cell')];
  const cell = (i: number) => cells()[i];
  /** A cell's symbol label ("Flag", "Mine", "Wrong flag"), or its number text. */
  const mark = (i: number) => cell(i).querySelector('svg')?.getAttribute('aria-label') ?? cell(i).textContent;
  const revealed = () => cells().filter((c) => c.classList.contains('revealed')).length;
  const stored = () => load<State | null>('minesweeper:state', null)!;
  return { container, unmount, $, cells, cell, mark, revealed, stored };
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate');
});

describe('Mines screen', () => {
  it('starts a new easy game when nothing is saved', () => {
    const { cells, $, stored } = setup(null);
    expect(cells()).toHaveLength(36);
    expect($('[data-mines]').textContent).toBe('5');
    expect($('[data-time]').textContent).toBe('0');
    expect($('[data-status]').textContent).toBe('Tap to dig. Long-press to flag.');
    expect($('[data-level="easy"]').getAttribute('aria-pressed')).toBe('true');
    expect($('[data-mode]').textContent).toBe('Dig');
    expect(stored()).toBeNull();
  });

  it('ignores a corrupt saved game', () => {
    save('minesweeper:state', { level: 'nope' });
    const { cells } = setup(null);
    expect(cells()).toHaveLength(36);
  });

  it('starts the clock on the first dig', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRng(1));
    const { cell, $, stored } = setup(null);
    tap(cell(14));
    expect(stored().status).toBe('playing');
    vi.advanceTimersByTime(3000);
    expect($('[data-time]').textContent).toBe('3');
  });

  it('reveals cells with numbers on tap and saves', () => {
    const { cell, revealed, stored } = setup();
    tap(cell(35));
    expect(revealed()).toBe(30);
    expect(cell(6).textContent).toBe('2');
    expect(cell(6).dataset.n).toBe('2');
    expect(cell(35).textContent).toBe('');
    expect(stored().revealed[35]).toBe(true);
  });

  describe('flagging', () => {
    it('flags on long-press without digging', () => {
      const vibrate = vi.fn();
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
      const { mark, cell, $, revealed } = setup();
      pointer(cell(3), 'pointerdown');
      vi.advanceTimersByTime(LONG_PRESS_MS);
      pointer(cell(3), 'pointerup');
      expect(mark(3)).toBe('Flag');
      expect($('[data-mines]').textContent).toBe('4');
      expect(revealed()).toBe(0);
      expect(vibrate).toHaveBeenCalledWith(15);
    });

    it('cancels a long-press when the finger moves', () => {
      const { cell, revealed } = setup();
      pointer(cell(3), 'pointerdown', { x: 0, y: 0 });
      pointer(cell(3), 'pointermove', { x: 30, y: 0 });
      vi.advanceTimersByTime(LONG_PRESS_MS);
      pointer(cell(3), 'pointerup');
      expect(cell(3).textContent).toBe('');
      expect(revealed()).toBe(0);
    });

    it('allows a little finger wobble', () => {
      const { mark, cell } = setup();
      pointer(cell(3), 'pointerdown', { x: 0, y: 0 });
      pointer(cell(3), 'pointermove', { x: 5, y: 5 });
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(mark(3)).toBe('Flag');
    });

    it('ignores pointermove without a press', () => {
      const { cell, revealed } = setup();
      pointer(cell(3), 'pointermove', { x: 50, y: 0 });
      expect(revealed()).toBe(0);
    });

    it('cancels a press on pointercancel (e.g. scrolling)', () => {
      const { cell, revealed } = setup();
      pointer(cell(35), 'pointerdown');
      pointer(cell(35), 'pointercancel');
      vi.advanceTimersByTime(LONG_PRESS_MS);
      pointer(cell(35), 'pointerup');
      expect(cell(35).textContent).toBe('');
      expect(revealed()).toBe(0);
    });

    it('flags with right-click', () => {
      const { mark, cell, container } = setup();
      const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      cell(3).dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
      expect(mark(3)).toBe('Flag');
      container.querySelector('[data-board]')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
      expect(mark(3)).toBe('Flag');
    });

    it('ignores the contextmenu that some phones fire during a long-press', () => {
      const { mark, cell } = setup();
      pointer(cell(3), 'pointerdown');
      cell(3).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(mark(3)).toBe('Flag');
    });

    it('does not vibrate when the flag is not allowed', () => {
      const vibrate = vi.fn();
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
      const { cell } = setup();
      tap(cell(35));
      cell(35).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      expect(vibrate).not.toHaveBeenCalled();
    });

    it('works without vibration support', () => {
      const { mark, cell } = setup();
      cell(3).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      expect(mark(3)).toBe('Flag');
    });

    it('flags on tap in flag mode, and still chords revealed numbers', () => {
      const { mark, cell, $ } = setup();
      tap(cell(35));
      const mode = $('[data-mode]');
      mode.click();
      expect(mode.textContent).toBe('Flag');
      expect(mode.getAttribute('aria-pressed')).toBe('true');

      tap(cell(4));
      expect(mark(4)).toBe('Flag');
      tap(cell(11)); // revealed number: chord opens cell 5 and wins
      expect($('[data-status]').textContent).toContain('Cleared');

      mode.click();
      expect(mode.textContent).toBe('Dig');
    });
  });

  it('ignores presses outside cells and with other mouse buttons', () => {
    const { $, cell, revealed } = setup();
    pointer($('[data-board]'), 'pointerdown');
    pointer($('[data-board]'), 'pointerup');
    pointer(cell(35), 'pointerdown', { button: 2 });
    pointer(cell(35), 'pointerup', { button: 2 });
    expect(revealed()).toBe(0);
  });

  it('shows the board and stops the clock when a mine is hit', () => {
    const { mark, cell, $, stored } = setup();
    cell(5).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); // wrong flag
    cell(1).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); // right flag
    vi.advanceTimersByTime(2000);
    tap(cell(0));

    expect(cell(0).className).toBe('ms-cell revealed exploded');
    expect(mark(2)).toBe('Mine');
    expect(cell(2).className).toBe('ms-cell revealed');
    expect(mark(1)).toBe('Flag');
    expect(mark(5)).toBe('Wrong flag');
    expect(cell(5).classList.contains('wrong')).toBe(true);
    expect($('[data-status]').textContent).toBe('Boom! Tap New to try again.');

    vi.advanceTimersByTime(5000);
    expect($('[data-time]').textContent).toBe('2');
    expect(stored().status).toBe('lost');

    tap(cell(35)); // finished: nothing happens
    expect(cell(35).classList.contains('revealed')).toBe(false);
  });

  describe('winning and best times', () => {
    function playToWin(seconds: number) {
      const ctx = setup();
      vi.advanceTimersByTime(seconds * 1000);
      tap(ctx.cell(35));
      tap(ctx.cell(5));
      return ctx;
    }

    it('records the time as the best', () => {
      const { $ } = playToWin(12);
      expect($('[data-status]').textContent).toBe('Cleared in 12s! Best: 12s.');
      expect(load('minesweeper:best:v3', {})).toEqual({ easy: 12 });
    });

    it('keeps a better previous best and shows it', () => {
      save('minesweeper:best:v3', { easy: 5 });
      const { $ } = playToWin(12);
      expect($('[data-status]').textContent).toBe('Cleared in 12s! Best: 5s.');
      expect(load('minesweeper:best:v3', {})).toEqual({ easy: 5 });
    });

    it('replaces a slower previous best', () => {
      save('minesweeper:best:v3', { easy: 50, hard: 7 });
      playToWin(12);
      expect(load('minesweeper:best:v3', {})).toEqual({ easy: 12, hard: 7 });
    });

    it('shows the best time while playing', () => {
      save('minesweeper:best:v3', { easy: 9 });
      const { $ } = setup();
      expect($('[data-status]').textContent).toBe('Tap to dig. Long-press to flag. Best: 9s.');
    });
  });

  describe('clock', () => {
    it('resumes an in-progress game from its saved time', () => {
      const s = fixture();
      s.elapsed = 42_000;
      const { $ } = setup(s);
      expect($('[data-time]').textContent).toBe('42');
      vi.advanceTimersByTime(1000);
      expect($('[data-time]').textContent).toBe('43');
    });

    it('caps the display at 999', () => {
      const s = fixture();
      s.elapsed = 5_000_000;
      const { $ } = setup(s);
      expect($('[data-time]').textContent).toBe('999');
    });

    it('pauses while the app is hidden and saves', () => {
      const { $, stored } = setup();
      vi.advanceTimersByTime(4000);
      setHidden(true);
      expect(stored().elapsed).toBe(4000);
      vi.advanceTimersByTime(60_000);
      setHidden(false);
      vi.advanceTimersByTime(1000);
      expect($('[data-time]').textContent).toBe('5');
    });

    it('does not start while hidden', () => {
      setHidden(true);
      const { $ } = setup();
      vi.advanceTimersByTime(5000);
      expect($('[data-time]').textContent).toBe('0');
    });
  });

  it('switches levels and restarts with New', () => {
    const { $, cells, cell, revealed, stored } = setup();
    $('[data-level="hard"]').click();
    answerNewGame(); // the saved game is partway through, so switching asks first
    expect(cells()).toHaveLength(144);
    expect($('[data-mines]').textContent).toBe('22');
    expect($('[data-level="hard"]').getAttribute('aria-pressed')).toBe('true');
    expect($('[data-level="easy"]').getAttribute('aria-pressed')).toBe('false');
    expect(stored().level).toBe('hard');

    tap(cell(70));
    expect(revealed()).toBeGreaterThan(0);
    $('[data-new]').click();
    answerNewGame();
    expect(revealed()).toBe(0);
    expect(stored()).toMatchObject({ level: 'hard', status: 'ready' });
  });

  it('saves elapsed time and cleans up on unmount', () => {
    const { container, unmount, cell, stored } = setup();
    vi.advanceTimersByTime(3000);
    pointer(cell(3), 'pointerdown');
    unmount();
    expect(container.children).toHaveLength(0);
    expect(stored().elapsed).toBe(3000);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(stored().flagged[3]).toBe(false);
    setHidden(true); // listener removed: no save
    expect(stored().elapsed).toBe(3000);
  });
});

describe('Mines colors', () => {
  const { light, dark } = themes(css, '.ms');

  it.each([
    ['light', light],
    ['dark', dark],
  ])('numbers are readable on open cells in the %s theme (3:1, large bold text)', (_name, t) => {
    for (let n = 1; n <= 8; n++) {
      expect(contrast(t[`ms-n${n}`], t['ms-open']), `number ${n}`).toBeGreaterThanOrEqual(3);
    }
  });

  const app = themes(appCss, ':root');

  it.each([
    ['light', light, app.light],
    ['dark', dark, app.dark],
  ])('flags, mines and Xs stand out (3:1) in the %s theme', (_name, t, a) => {
    expect(contrast(t['ms-flag-edge'], t['ms-hidden']), 'flag on a closed square').toBeGreaterThanOrEqual(3);
    expect(contrast(t['ms-n7'], t['ms-hidden']), 'flag pole on a closed square').toBeGreaterThanOrEqual(3);
    expect(contrast(t['ms-n7'], t['ms-open']), 'mine on an open square').toBeGreaterThanOrEqual(3);
    expect(contrast(t['ms-n7'], a.danger), 'mine on the exploded square').toBeGreaterThanOrEqual(3);
    expect(contrast(t['ms-n7'], a['danger-soft']), 'X on a wrong flag').toBeGreaterThanOrEqual(3);
  });
});

describe('Mines symbols', () => {
  it.each(Object.entries(symbols))('%s is a flat, labeled SVG', (_name, markup) => {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const root = doc.documentElement;
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(root.nodeName).toBe('svg');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBeTruthy();
    expect(
      doc.querySelectorAll('linearGradient, radialGradient, pattern, filter, image, foreignObject, [filter], [opacity]'),
    ).toHaveLength(0);
  });
});

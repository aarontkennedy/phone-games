import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import rootCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, pointer, press, track } from '../../test/helpers';
import { mount } from './index';
import type { State } from './logic';

const empty = () => Array<number>(16).fill(0);
const withTiles = (tiles: Record<number, number>) => {
  const b = empty();
  for (const [i, v] of Object.entries(tiles)) b[Number(i)] = v;
  return b;
};
const saveState = (board: number[], extra: Partial<State> = {}) =>
  save('2048:state', { board, score: 0, over: false, won: false, keepPlaying: false, ...extra });

function setup() {
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const cells = () => [...container.querySelectorAll<HTMLElement>('.g2048-cell')];
  const values = () => cells().map((c) => Number(c.textContent || 0));
  const overlay = () => container.querySelector<HTMLElement>('.overlay');
  const button = (label: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)!;
  return { container, unmount, $, cells, values, overlay, button };
}

describe('2048 screen', () => {
  it('starts a new game with two tiles', () => {
    const { cells, values, $ } = setup();
    expect(cells()).toHaveLength(16);
    expect(values().filter(Boolean)).toHaveLength(2);
    expect($('[data-score]').textContent).toBe('0');
    expect($('[data-best]').textContent).toBe('0');
  });

  it('restores a saved game and best score', () => {
    saveState(withTiles({ 0: 8, 5: 16 }), { score: 40 });
    save('2048:best', 99);
    const { values, $ } = setup();
    expect(values()).toEqual(withTiles({ 0: 8, 5: 16 }));
    expect($('[data-score]').textContent).toBe('40');
    expect($('[data-best]').textContent).toBe('99');
  });

  it('ignores a corrupt saved game', () => {
    save('2048:state', { board: [1, 2, 3] });
    const { values } = setup();
    expect(values().filter(Boolean)).toHaveLength(2);
  });

  it('moves with the arrow keys, scores, animates and saves', () => {
    saveState(withTiles({ 0: 2, 1: 2 }));
    const { cells, values, $ } = setup();
    press('ArrowLeft');

    expect(values()[0]).toBe(4);
    expect(values().filter(Boolean)).toHaveLength(2); // merged tile + new tile
    expect($('[data-score]').textContent).toBe('4');
    expect($('[data-best]').textContent).toBe('4');
    expect(cells()[0].classList.contains('merged')).toBe(true);
    expect(cells().filter((c) => c.classList.contains('new'))).toHaveLength(1);
    expect(load<State | null>('2048:state', null)!.score).toBe(4);
    expect(load('2048:best', 0)).toBe(4);
  });

  it('keeps a higher best score', () => {
    saveState(withTiles({ 0: 2, 1: 2 }));
    save('2048:best', 100);
    const { $ } = setup();
    press('ArrowLeft');
    expect($('[data-best]').textContent).toBe('100');
    expect(load('2048:best', 0)).toBe(100);
  });

  it('ignores moves that change nothing', () => {
    saveState(withTiles({ 0: 2 }));
    const before = localStorage.getItem('pg:2048:state');
    setup();
    press('ArrowLeft');
    expect(localStorage.getItem('pg:2048:state')).toBe(before);
  });

  it('moves with swipes', () => {
    saveState(withTiles({ 0: 2, 1: 2 }));
    const { $, values } = setup();
    const root = $('.g2048');
    pointer(root, 'pointerdown', { x: 200, y: 100 });
    pointer(root, 'pointerup', { x: 100, y: 100 });
    expect(values()[0]).toBe(4);
  });

  it('styles tiles by value and digit count', () => {
    saveState(withTiles({ 0: 2, 1: 128, 2: 1024, 3: 4096 }));
    const { cells } = setup();
    expect(cells()[0].className).toBe('g2048-cell t-2');
    expect(cells()[1].dataset.digits).toBe('3');
    expect(cells()[2].dataset.digits).toBe('4');
    expect(cells()[3].className).toBe('g2048-cell t-big');
    expect(cells()[4].dataset.digits).toBe('');
  });

  it('never shows a best below the restored score', () => {
    saveState(withTiles({ 0: 64 }), { score: 500 });
    save('2048:best', 100);
    const { $ } = setup();
    expect($('[data-best]').textContent).toBe('500');
  });

  it('restarts with the New button', () => {
    saveState(withTiles({ 0: 64, 1: 32, 2: 16 }), { score: 500 });
    const { values, $, button } = setup();
    button('New').click();
    expect(values().filter(Boolean)).toHaveLength(2);
    expect($('[data-score]').textContent).toBe('0');
    expect($('[data-best]').textContent).toBe('500');
  });

  describe('winning', () => {
    function win() {
      saveState(withTiles({ 0: 1024, 1: 1024 }));
      const ctx = setup();
      press('ArrowLeft');
      return ctx;
    }

    it('shows a win overlay that blocks moves', () => {
      const { overlay, values } = win();
      expect(overlay()!.hidden).toBe(false);
      expect(overlay()!.textContent).toContain('You win!');
      const before = values();
      press('ArrowRight');
      expect(values()).toEqual(before);
    });

    it('can keep going', () => {
      const { overlay, button } = win();
      button('Keep going').click();
      expect(overlay()!.hidden).toBe(true);
      expect(load<State | null>('2048:state', null)!.keepPlaying).toBe(true);
    });

    it('can start a new game', () => {
      const { overlay, button, values } = win();
      button('New game').click();
      expect(overlay()!.hidden).toBe(true);
      expect(values()).not.toContain(2048);
    });
  });

  it('shows game over and can try again', () => {
    saveState(withTiles({ 0: 2 }), { over: true });
    const { overlay, button, values } = setup();
    expect(overlay()!.textContent).toContain('Game over');
    button('Try again').click();
    expect(overlay()!.hidden).toBe(true);
    expect(values().filter(Boolean)).toHaveLength(2);
  });

  it('cleans up on unmount', () => {
    saveState(withTiles({ 0: 2, 1: 2 }));
    const { container, unmount } = setup();
    unmount();
    expect(container.children).toHaveLength(0);
    press('ArrowLeft');
    expect(load<State | null>('2048:state', null)!.score).toBe(0);
  });
});

describe('2048 tile colors', () => {
  const { light, dark } = themes(rootCss, ':root');
  const tiles = [...css.matchAll(/\.t-(\w+)\s*{\s*background:\s*(#[0-9a-f]{6});(\s*color:\s*var\(--([\w-]+)\))?/gi)];

  it('defines a color for every tile up to 2048 plus big tiles', () => {
    const names = tiles.map((m) => m[1]);
    for (let v = 2; v <= 2048; v *= 2) expect(names).toContain(String(v));
    expect(names).toContain('big');
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ])('numbers are readable on every tile in the %s theme (3:1, large bold text)', (_name, t) => {
    for (const [, name, bg, , ink = 'tile-ink-dark'] of tiles) {
      expect(contrast(t[ink], bg), `tile ${name}`).toBeGreaterThanOrEqual(3);
    }
  });
});

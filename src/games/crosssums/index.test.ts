import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track, answerNewGame } from '../../test/helpers';
import { mount } from './index';
import type { State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('crosssums:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('crosssums:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const put = (cell: number, n: number) => {
    $(`[data-cell="${cell}"]`).click();
    $(`[data-num="${n}"]`).click();
  };
  return { container, unmount, $, stored, status, put };
}

// A 2 by 2 block: 1 2 over 3 4.
const small = (o: Partial<State> = {}): State => {
  const cells = ['######', '#12###', '#34###', '######', '######', '######'].join('').split('');
  return {
    white: cells.map((ch) => ch !== '#'),
    solution: cells.map((ch) => (ch === '#' ? 0 : Number(ch))),
    grid: cells.map(() => 0),
    hinted: cells.map(() => false),
    selected: null,
    solved: 0,
    ...o,
  };
};

// New makes a puzzle: a fraction of a second alone, far longer under coverage.
describe('Cross Sums screen', { timeout: 30_000 }, () => {
  it('shows the clues, and fills squares to solve the puzzle', () => {
    const { $, container, stored, status, put } = setup(small());
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(4);
    expect(container.querySelector('[aria-label="Clue: across 3"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Clue: down 4"]')).not.toBeNull();
    expect(status()).toMatch(/^Tap a white square, then a number\./);
    $('[data-cell="7"]').click();
    expect(status()).toBe('Now tap a number, or erase.');
    $('[data-num="1"]').click();
    expect($('[data-left]').textContent).toBe('3');
    put(8, 1);
    expect(status()).toMatch(/^A digit repeats in a run/);
    expect($('[data-cell="8"]').classList.contains('wrong')).toBe(true);
    put(8, 2);
    put(13, 3);
    put(14, 5);
    expect(status()).toBe('Every square is filled, but some don’t add up. Tap Hint to fix one.');
    put(14, 4);
    expect(status()).toBe('Every run adds up. Solved!');
    expect($('[data-solved]').textContent).toBe('1');
    expect($<HTMLButtonElement>('[data-hint]').disabled).toBe(true);
    $<HTMLButtonElement>('.overlay .btn').click();
    expect(stored().grid.every((d) => !d)).toBe(true);
  });

  it('hints a square, erases, and asks before New partway through', () => {
    const { $, stored, put } = setup(small());
    $('[data-hint]').click();
    expect(stored().grid.filter(Boolean)).toHaveLength(1);
    expect(document.querySelector('.xs-cell.given')).not.toBeNull();
    put(7, 9);
    put(7, 0); // erase (or a hinted square stays)
    $('[data-board]').click(); // not on a square
    $('[data-new]').click();
    answerNewGame();
    expect(stored().grid.every((d) => !d)).toBe(true);
    document.body.replaceChildren();
    const broken = setup({ white: 'x' });
    broken.unmount();
    expect(broken.stored().white).toHaveLength(36);
  });
});

describe('Cross Sums colors', () => {
  it('shows a repeated digit clearly in light and dark', () => {
    const own = themes(css, '.cs-sums');
    const app = themes(appCss, ':root');
    for (const t of ['light', 'dark'] as const) expect(contrast(own[t]['xs-wrong'], app[t].surface)).toBeGreaterThanOrEqual(4.5);
  });
});

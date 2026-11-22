import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import { allWords, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('wordgrid:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('wordgrid:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const tapCells = (...cells: number[]) => cells.forEach((c) => $(`[data-cell="${c}"]`).click());
  return { container, unmount, $, stored, status, tapCells };
}

// c a t s
// o d e r
// g i n e
// y x z q
const round = (o: Partial<State> = {}): State => ({ grid: [...'catsodergineyxzq'], found: [], score: 0, done: false, best: 0, ...o });

describe('Word Grid screen', () => {
  it('spells words with touching letters and scores them', () => {
    const { $, stored, status, tapCells } = setup(round());
    expect(status()).toMatch(/^Tap touching letters/);
    expect($<HTMLButtonElement>('[data-enter]').disabled).toBe(true);
    tapCells(0, 1, 2);
    expect($('.wg-word').textContent).toBe('CAT');
    expect($('[data-cell="2"]').classList.contains('last')).toBe(true);
    $('[data-enter]').click();
    expect(status()).toBe('CAT: 1 point.');
    expect(stored().found).toEqual(['cat']);
    expect($('[data-score]').textContent).toBe('1');
    tapCells(0, 1, 2, 3);
    $('[data-enter]').click();
    expect(status()).toBe('CATS: 1 point.');
    $('[data-board]').click(); // not on a letter
  });

  it('takes letters back, starts over on a letter that doesn’t touch, and says why a word doesn’t count', () => {
    const { $, status, tapCells } = setup(round());
    tapCells(0, 1, 2, 2); // the last letter again: taken back
    expect($('.wg-word').textContent).toBe('CA');
    tapCells(2, 3, 1); // back to a letter already in the word
    expect($('.wg-word').textContent).toBe('CA');
    tapCells(15); // doesn't touch: a new word starts there
    expect($('.wg-word').textContent).toBe('Q');
    $('[data-clear]').click();
    tapCells(0, 1, 4);
    $('[data-enter]').click();
    expect(status()).toBe('CAO isn’t in the word list.');
  });

  it('hints where a word starts, and ends the round with what you missed', () => {
    const { $, stored, status, container } = setup(round());
    $('[data-hint]').click();
    expect(status()).toBe('Hint: a 4-letter word starts at the outlined letter.');
    expect(container.querySelectorAll('.wg-cell.hint')).toHaveLength(1);
    $('[data-done]').click();
    expect(stored().done).toBe(true);
    expect(status()).toMatch(/^0 words for 0 points\. Some you missed: COAT, /);
    expect(container.querySelector<HTMLButtonElement>('[data-cell="0"]')!.disabled).toBe(true);
    $('[data-new-round]').click();
    expect(stored().done).toBe(false);
    expect(stored().found).toEqual([]);
  });

  it('says when every word was found, and ignores a broken save', () => {
    const grid = [...'catqqqqqqqqqqqqq'];
    const tiny = setup({ ...round(), grid, found: allWords(grid), done: true });
    expect(tiny.status()).toMatch(/You found every word!$/);
    document.body.replaceChildren();
    const broken = setup({ grid: 'x' });
    broken.unmount();
    expect(broken.stored().grid).toHaveLength(16);
  });
});

describe('Word Grid colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});

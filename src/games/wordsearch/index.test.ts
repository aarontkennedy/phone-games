import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { seededRng } from '../../core/random';
import { makeContainer, track, answerNewGame } from '../../test/helpers';
import { mount } from './index';
import { newPuzzle, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('wordsearch:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('wordsearch:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const cell = (i: number) => $(`[data-cell="${i}"]`);
  return { container, unmount, $, stored, status, cell };
}

describe('Word Search screen', () => {
  it('finds a word from its first letter to its last, and crosses it off', () => {
    const s = newPuzzle(0, seededRng(1));
    const [w] = s.words;
    const { $, container, stored, status, cell } = setup(s);
    expect(status()).toMatch(/^Find each word: tap its first letter, then its last\./);
    expect(container.querySelectorAll('.ws-cell')).toHaveLength(100);
    expect($('.ws-theme').textContent).toBe(`${s.theme}:`);
    cell(w.cells[0]).click();
    expect(status()).toBe('Now tap the last letter of the word.');
    expect(cell(w.cells[0]).classList.contains('picked')).toBe(true);
    cell(w.cells.at(-1)!).click();
    expect(status()).toBe(`Found ${w.word}!`);
    expect(stored().found).toEqual([w.word]);
    expect($('[data-found]').textContent).toBe('1/8');
    expect([...container.querySelectorAll('.ws-words .found')].map((li) => li.textContent)).toEqual([w.word]);
    expect(cell(w.cells[1]).classList.contains('found')).toBe(true);
    $('[data-board]').click(); // not on a cell
  });

  it('hints a word’s first letter, and finishes a puzzle', () => {
    const s = newPuzzle(0, seededRng(2));
    const { $, stored, status, cell } = setup(s);
    $('[data-hint]').click();
    expect(status()).toBe(`Hint: ${s.words[0].word} starts at the outlined letter.`);
    expect(cell(s.words[0].cells[0]).classList.contains('hint')).toBe(true);
    for (const w of s.words) {
      cell(w.cells[0]).click();
      cell(w.cells.at(-1)!).click();
    }
    expect(status()).toBe('You found all 8 words!');
    expect($('[data-solved]').textContent).toBe('1');
    expect($<HTMLButtonElement>('[data-hint]').disabled).toBe(true);
    $<HTMLButtonElement>('.overlay .btn').click();
    expect(stored().found).toEqual([]);
    expect(stored().solved).toBe(1);
  });

  it('asks before New partway through, and ignores a broken save', () => {
    const s = newPuzzle(0, seededRng(3));
    const { $, stored, cell } = setup(s);
    cell(s.words[0].cells[0]).click();
    cell(s.words[0].cells.at(-1)!).click();
    $('[data-new]').click();
    answerNewGame();
    expect(stored().found).toEqual([]);
    document.body.replaceChildren();
    const broken = setup({ grid: 'x' });
    broken.unmount();
    expect(broken.stored().grid).toHaveLength(100);
  });
});

describe('Word Search colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});

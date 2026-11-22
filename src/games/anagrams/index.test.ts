import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import type { State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('anagrams:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('anagrams:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  /** Taps the tiles that spell `word` (the letters are in base order in these tests). */
  const spell = (word: string) => {
    for (const ch of word) {
      const tile = [...container.querySelectorAll<HTMLButtonElement>('[data-tile]:not([disabled])')].find((t) => t.textContent === ch.toUpperCase())!;
      tile.click();
    }
  };
  return { container, unmount, $, stored, status, spell };
}

const round = (base: string, o: Partial<State> = {}): State => ({ base, letters: [...base], found: [], score: 0, hints: 0, best: 0, ...o });

describe('Anagrams screen', () => {
  it('spells words from the tiles and scores them', () => {
    const { $, stored, status, spell } = setup(round('planets'));
    expect(status()).toBe('Tap letters to spell words of 3 or more letters, then tap Enter.');
    expect($<HTMLButtonElement>('[data-enter]').disabled).toBe(true);
    spell('plan');
    expect($('.an-word').getAttribute('aria-label')).toBe('Your word: PLAN');
    expect($<HTMLButtonElement>('[data-tile="0"]').disabled).toBe(true);
    $('[data-enter]').click();
    expect(status()).toBe('PLAN: 4 points.');
    expect(stored().found).toEqual(['plan']);
    expect($('[data-score]').textContent).toBe('4');
    spell('planets');
    $('[data-enter]').click();
    expect(status()).toBe('PLANETS: 17 points. All seven letters!');
    expect($('.an-seven').textContent).toBe('PLANETS');
    expect($('[data-best]').textContent).toBe('21');
  });

  it('says why a word doesn’t count, deletes letters, and shuffles', () => {
    const { $, stored, status, spell } = setup(round('planets'));
    spell('pl');
    $('[data-enter]').click();
    expect(status()).toBe('Words need at least 3 letters.');
    $('[data-delete]').click();
    expect($('.an-word').getAttribute('aria-label')).toBe('Your word: P');
    spell('ln');
    $('[data-enter]').click();
    expect(status()).toBe('PLN isn’t in the word list.');
    $('[data-shuffle]').click();
    expect($('.an-word').getAttribute('aria-label')).toBe('Your word: PLN'); // kept
    expect([...stored().letters].sort().join('')).toBe('aelnpst');
    $('[data-delete]').click();
    $('[data-delete]').click();
    $('[data-delete]').click();
    expect($<HTMLButtonElement>('[data-delete]').disabled).toBe(true);
  });

  it('hints the 7-letter word, and moves to the next round with a summary', () => {
    const { $, stored, status, spell } = setup(round('planets'));
    $('[data-hint]').click();
    $('[data-hint]').click();
    expect(status()).toBe('Tap letters to spell words of 3 or more letters, then tap Enter. The 7-letter word starts PL.');
    spell('plan');
    $('[data-enter]').click();
    $('[data-board]').click(); // not on a tile
    expect(status()).toBe('PLAN: 4 points.');
    $('[data-hint]').click();
    expect(status()).toBe('1 word so far. The 7-letter word starts PLA.');
    $('[data-next]').click();
    expect(status()).toMatch(/^Last round: 1 word, for 4 points\. The 7-letter words? (was|were) .*PLANETS/);
    expect(stored().found).toEqual([]);
    expect(stored().best).toBe(4);
  });

  it('says when Hint has nothing more to show', () => {
    const all = setup(round('planets', { hints: 7 }));
    all.$('[data-hint]').click();
    expect(all.status()).toBe('That’s the whole word.');
    document.body.replaceChildren();
    const found = setup(round('planets', { found: ['planets'], score: 17 }));
    found.$('[data-hint]').click();
    expect(found.status()).toBe('You’ve already found a 7-letter word.');
  });

  it('names both 7-letter words when there are two, and ignores a broken save', () => {
    const { $, status } = setup(round('parties'));
    $('[data-next]').click();
    expect(status()).toMatch(/The 7-letter words were [A-Z]+ and [A-Z]+/);
    document.body.replaceChildren();
    const broken = setup({ base: 'x' });
    broken.unmount();
    expect(broken.stored().letters).toHaveLength(7);
  });
});

describe('Anagrams colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});

import { describe, expect, it } from 'vitest';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import { newGame, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('hangman:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const key = (l: string) => $<HTMLButtonElement>(`[data-letter="${l}"]`);
  const stored = () => load<State>('hangman:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, key, stored, status };
}

const round = (word: string, o: Partial<State> = {}): State => ({ ...newGame(), word, guessed: [], result: null, recent: [word], ...o });
const typeKey = (key: string, o: KeyboardEventInit = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key, ...o }));

describe('Hangman screen', () => {
  it('shows a blank for each letter, the empty gallows and 26 keys', () => {
    const { $, $$, status } = setup(round('GARDEN'));
    expect($$('.hm-letter.blank')).toHaveLength(6);
    expect($('.hm-word').getAttribute('aria-label')).toBe('The word: blank, blank, blank, blank, blank, blank');
    expect($('.hm-art').getAttribute('aria-label')).toBe('0 of 6 wrong guesses');
    expect($$('[data-letter]')).toHaveLength(26);
    expect(status()).toBe('Guess a letter. 6 wrong guesses left.');
  });

  it('marks right and wrong guesses on the keys and draws the figure', () => {
    const { $, $$, key, status } = setup(round('GARDEN'));
    key('A').click();
    expect(status()).toBe('Yes, there’s an A! 6 wrong guesses left.');
    expect(key('A').classList.contains('hm-right')).toBe(true);
    expect(key('A').disabled).toBe(true);
    expect(key('A').getAttribute('aria-label')).toBe('A, in the word');
    key('Z').click();
    expect(status()).toBe('No Z. 5 wrong guesses left.');
    expect(key('Z').classList.contains('hm-wrong')).toBe(true);
    expect($('.hm-art').getAttribute('aria-label')).toBe('1 of 6 wrong guesses');
    expect($$('.hm-art > *')).toHaveLength(2); // the gallows and a head
    key('G').click();
    expect(status()).toBe('Yes, there’s a G! 5 wrong guesses left.');
  });

  it('wins, then offers the next word at the bottom', () => {
    const { $, stored, status } = setup(round('GARDEN', { guessed: [...'GARDE'] }));
    typeKey('n');
    expect(stored().result).toBe('won');
    expect(status()).toBe('You got it: GARDEN! Best streak: 1.');
    expect($('[data-won]').textContent).toBe('1');
    expect($('[data-streak]').textContent).toBe('1');
    $<HTMLButtonElement>('[data-next]').click();
    expect(stored().result).toBeNull();
    expect(stored().word).not.toBe('GARDEN');
    expect(status()).toBe('Guess a letter. 6 wrong guesses left.');
  });

  it('loses on the sixth miss and shows the missing letters', () => {
    const { $$, status } = setup(round('GARDEN', { guessed: [...'GQWTYP'] })); // five misses so far
    typeKey('U');
    expect(status()).toBe('Out of guesses. The word was GARDEN.');
    expect($$('.hm-letter.missed').map((l) => l.textContent)).toEqual([...'ARDEN']);
    expect($$('.hm-art > *')).toHaveLength(7);
  });

  it('ignores shortcuts, stray taps and broken saves; New skips the word', () => {
    const { $, stored, unmount, container } = setup({ word: 1 });
    const word = stored().word;
    typeKey('a', { metaKey: true });
    typeKey('1');
    expect(stored().guessed).toEqual([]);
    $('[data-keys]').click();
    $<HTMLButtonElement>('[data-new]').click();
    expect(stored().word).not.toBe(word);
    unmount();
    typeKey('e');
    expect(container.children).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { makeContainer, track, answerNewGame } from '../../test/helpers';
import { mount } from './index';
import type { State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('ladder:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('ladder:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const change = (at: number, letter: string) => {
    $(`[data-at="${at}"]`).click();
    $(`[data-letter="${letter}"]`).click();
  };
  return { container, unmount, $, stored, status, change };
}

const puzzle = (start: string, target: string, par = 4): State => ({ start, target, path: [start], par, won: false });

describe('Word Ladder screen', () => {
  it('changes one letter at a time, and wins at the target', () => {
    const { $, stored, status, change } = setup(puzzle('cold', 'warm'));
    expect(status()).toBe('Turn COLD into WARM. Tap a letter to change.');
    expect($('[data-par]').textContent).toBe('4');
    expect($<HTMLButtonElement>('[data-undo]').disabled).toBe(true);
    $('[data-letter="R"]').click();
    expect(status()).toBe('First tap the letter you want to change.');
    $('[data-at="2"]').click();
    expect(status()).toBe('Now tap the new letter for letter 3.');
    change(2, 'R'); // tapping the picked letter again keeps it picked
    expect(stored().path).toEqual(['cold', 'cord']);
    expect($('.ld-path').textContent).toBe('COLD →');
    change(1, 'A');
    change(0, 'W');
    change(3, 'M');
    expect(stored().won).toBe(true);
    expect(status()).toBe('You made WARM in 4 steps, right on par.');
    expect($('[data-solved]').textContent).toBe('1');
    expect(load('ladder:solved', 0)).toBe(1);
    $('[data-next]').click();
    expect(stored().won).toBe(false);
  });

  it('says why a step isn’t allowed, takes steps back, and beats par', () => {
    const { $, stored, status, change } = setup(puzzle('cold', 'warm'));
    change(0, 'X');
    expect(status()).toBe('XOLD isn’t in the word list.');
    change(0, 'C'); // the same letter: nothing happens
    change(2, 'R');
    $('[data-undo]').click();
    expect(stored().path).toEqual(['cold']);
    document.body.replaceChildren();
    const under = setup(puzzle('cold', 'cord', 3));
    under.change(2, 'R');
    expect(under.status()).toBe('You made CORD in 1 step, 2 under par.');
    document.body.replaceChildren();
    const used = setup({ ...puzzle('cold', 'cord', 1), path: ['cold', 'bold'] });
    used.change(0, 'C'); // back to COLD
    expect(used.status()).toBe('You’ve already used COLD.');
  });

  it('hints the next word and outlines the letter to change', () => {
    const { $, status, container } = setup(puzzle('cold', 'warm'));
    $('[data-hint]').click();
    expect(status()).toMatch(/^Hint: change COLD to [A-Z]{4}\.$/);
    expect(container.querySelectorAll('.ld-tile.hint')).toHaveLength(1);
    expect(container.querySelectorAll('.ld-tile.picked')).toHaveLength(1); // ready to change
  });

  it('says when no ladder reaches the target', () => {
    const { $, status } = setup(puzzle('cold', 'ahoy')); // AHOY has no word one letter away
    $('[data-hint]').click();
    expect(status()).toBe('No ladder reaches the target from here. Tap Undo to go back.');
  });

  it('asks before New partway through, and ignores a broken save', () => {
    const { $, stored, change } = setup(puzzle('cold', 'warm'));
    change(2, 'R');
    $('[data-new]').click();
    answerNewGame();
    expect(stored().path).toHaveLength(1);
    document.body.replaceChildren();
    const broken = setup({ start: 'zzzz' });
    broken.unmount();
    expect(broken.stored().path).toHaveLength(1);
  });
});

describe('Word Ladder colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});

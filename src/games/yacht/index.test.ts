import { describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { contrast, themes } from '../../test/contrast';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import { BOXES, newGame, type Box, type State } from './logic';

function setup(saved: unknown = null, best?: number) {
  if (saved) save('yacht:state', saved);
  if (best !== undefined) save('yacht:best', best);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const box = (b: Box) => $<HTMLButtonElement>(`[data-box="${b}"]`);
  const die = (i: number) => $<HTMLButtonElement>(`[data-die="${i}"]`);
  const stored = () => load<State>('yacht:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, box, die, stored, status };
}

const rolled = (dice: number[], o: Partial<State> = {}): State => ({ ...newGame(), dice, rolls: 1, ...o });

describe('Yacht screen', () => {
  it('starts with an empty card and asks you to roll', () => {
    const { $, $$, box, die, status } = setup();
    expect($$('[data-box]')).toHaveLength(13);
    expect(box('ones').disabled).toBe(true);
    expect(box('ones').getAttribute('aria-label')).toBe('Ones, empty');
    expect(die(0).disabled).toBe(true);
    expect(die(0).getAttribute('aria-label')).toBe('Die, not rolled yet');
    expect($('[data-roll]').textContent).toBe('Roll (3 left)');
    expect($('[data-bonus]').textContent).toBe('0/63');
    expect($('[data-score]').textContent).toBe('0');
    expect(status()).toBe('Turn 1 of 13. Tap Roll.');
  });

  it('rolls, holds dice and shows what each box would score', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // every die shows 4
    const { $, box, die, stored, status } = setup();
    $<HTMLButtonElement>('[data-roll]').click();
    expect(stored().dice).toEqual([4, 4, 4, 4, 4]);
    expect(box('fours').getAttribute('aria-label')).toBe('Score 20 in Fours');
    expect(box('fours').classList.contains('open')).toBe(true);
    expect(box('yacht').querySelector('b')!.textContent).toBe('50');
    expect($('[data-roll]').textContent).toBe('Roll (2 left)');
    expect(status()).toBe('Turn 1 of 13. Tap dice to hold them and roll again, or pick a box.');

    die(2).click();
    expect(die(2).getAttribute('aria-pressed')).toBe('true');
    expect(die(2).getAttribute('aria-label')).toBe('Die showing 4, held');
    vi.restoreAllMocks();
  });

  it('scores a box and moves to the next turn', () => {
    const { $, box, stored, status } = setup(rolled([2, 3, 4, 5, 6]));
    box('large').click();
    expect(stored().scores.large).toBe(40);
    expect(box('large').getAttribute('aria-label')).toBe('Large straight: 40');
    expect(box('large').classList.contains('filled')).toBe(true);
    expect($('[data-score]').textContent).toBe('40');
    expect(status()).toBe('Turn 2 of 13. Tap Roll.');
    box('large').click(); // filled boxes do nothing
    expect(stored().scores.large).toBe(40);
  });

  it('says when the rolls are used up, and celebrates an extra yacht', () => {
    const { $, status } = setup(rolled([1, 2, 3, 5, 5], { rolls: 3 }));
    expect(status()).toBe('Turn 1 of 13. No rolls left: pick a box to score.');
    expect($<HTMLButtonElement>('[data-roll]').disabled).toBe(true);
    expect($('[data-roll]').textContent).toBe('Pick a box');

    const scores = { ...newGame().scores, yacht: 50 };
    expect(setup(rolled([3, 3, 3, 3, 3], { scores })).status()).toBe('Another yacht: 100 bonus points! Pick a box for it.');
  });

  it('shows the upper bonus once earned', () => {
    const scores = { ...newGame().scores, ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
    expect(setup({ ...newGame(), scores }).$('[data-bonus]').textContent).toBe('35');
  });

  it('finishes the game, saves a new best, and starts again', () => {
    const scores = Object.fromEntries(BOXES.map((b) => [b, 0])) as State['scores'];
    scores.chance = null;
    const { $, box, stored, status } = setup(rolled([6, 6, 6, 6, 5], { scores }), 10);
    box('chance').click();
    expect(load('yacht:best', 0)).toBe(29);
    expect($('.overlay h2').textContent).toBe('New best: 29!');
    expect(status()).toBe('Game over. You scored 29. Tap New game to play again.');
    expect($<HTMLButtonElement>('[data-roll]').disabled).toBe(true);
    $<HTMLButtonElement>('.overlay .btn').click();
    expect(stored().scores.chance).toBeNull();
    expect($('.overlay')).toBeNull();
  });

  it('keeps the best when a game scores less', () => {
    const scores = Object.fromEntries(BOXES.map((b) => [b, 0])) as State['scores'];
    const { $ } = setup({ ...newGame(), scores }, 200);
    expect($('.overlay h2').textContent).toBe('Final score: 0');
    expect($('[data-best]').textContent).toBe('200');
  });

  it('starts over with New, ignores a broken save, and cleans up', () => {
    const { $, stored, unmount, container } = setup({ broken: true });
    expect(stored()).toEqual(newGame());
    save('yacht:state', rolled([1, 1, 2, 2, 3]));
    $<HTMLButtonElement>('[data-new]').click();
    expect(stored().rolls).toBe(0);
    $('[data-board]').click(); // a tap between boxes
    $('[data-dice]').click(); // a tap between dice
    unmount();
    expect(container.children).toHaveLength(0);
  });
});

describe('Yacht colors', () => {
  const ya = themes(css, '.ya');
  const app = themes(appCss, ':root');
  it.each([
    ['light', ya.light, app.light],
    ['dark', ya.dark, app.dark],
  ])('the dice outline stands out from the die and the table in the %s theme (3:1)', (_n, t, a) => {
    expect(contrast(t['ya-edge'], a.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(t['ya-edge'], a.board)).toBeGreaterThanOrEqual(3);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import { newRound, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('shutbox:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const tiles = () => [...container.querySelectorAll<HTMLButtonElement>('[data-tile]')];
  const stored = () => load<State>('shutbox:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, tiles, stored, status };
}

/** Makes the next dice roll these faces (Math.random is what roll() uses by default). */
function nextRoll(...faces: number[]) {
  const spy = vi.spyOn(Math, 'random');
  for (const f of faces) spy.mockReturnValueOnce((f - 1) / 6 + 0.01);
}

const at = (open: number[], dice: number[] = []): State => ({
  phase: dice.length ? 'choose' : 'roll',
  open: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => open.includes(n)),
  dice,
});

afterEach(() => vi.restoreAllMocks());

describe('Shut the Box screen', () => {
  it('rolls, picks tiles that make the roll, and shuts them', () => {
    const { $, tiles, stored, status } = setup();
    expect(tiles()).toHaveLength(9);
    expect(status()).toMatch(/^Roll the dice/);
    expect($('[data-score]').textContent).toBe('45');
    expect($('[data-best]').textContent).toBe('–');
    expect(tiles().every((t) => t.disabled)).toBe(true);
    nextRoll(4, 5);
    $('[data-roll="2"]').click();
    expect($$dice()).toEqual(['Die showing 4', 'Die showing 5']);
    expect(status()).toBe('You rolled 9. Tap open tiles that add up to 9.');
    expect($<HTMLButtonElement>('[data-shut]').disabled).toBe(true);
    $('[data-tile="4"]').click();
    expect(status()).toBe('Picked 4 of 9.');
    $('[data-tile="5"]').click();
    expect(status()).toBe('Those make 9. Tap Shut.');
    $('[data-tile="5"]').click(); // changed your mind
    $('[data-tile="5"]').click();
    $('[data-shut]').click();
    expect(stored().open.slice(3, 5)).toEqual([false, false]);
    expect($('[data-score]').textContent).toBe('36');
    expect(status()).toMatch(/^Best was to shut 9\. Roll again\.$/); // shutting the 9 was better
    expect($('[data-accuracy]').textContent).toBe('0%');
    $('[data-board]').click(); // not on a tile
    $('[data-controls]').click(); // not on a button

    function $$dice() {
      return [...document.querySelectorAll('.sb-die')].map((d) => d.getAttribute('aria-label'));
    }
  });

  it('ends the round when nothing makes the roll, keeps the best, and starts again', () => {
    const { $, stored, status } = setup(at([8, 9]));
    nextRoll(1, 1);
    $('[data-roll="2"]').click();
    expect(stored().phase).toBe('over');
    expect(status()).toBe('No open tiles make 2. Round over: score 17. Best: 17.');
    expect(load('shutbox:best', null)).toBe(17);
    $('[data-new-round]').click();
    expect(stored().open.every(Boolean)).toBe(true);
    expect($('[data-best]').textContent).toBe('17');
  });

  it('keeps a lower best when a round scores more', () => {
    save('shutbox:best', 3);
    const { $, status } = setup(at([8, 9]));
    nextRoll(1, 1);
    $('[data-roll="2"]').click();
    expect(status()).toBe('No open tiles make 2. Round over: score 17. Best: 3.');
  });

  it('says to roll two dice when that’s better, and counts it as right', () => {
    const { $ } = setup(at([5, 6]));
    $('[data-hint]').click();
    expect($('[data-tip]').textContent).toBe('Best: roll two dice.');
    document.body.replaceChildren();
    const right = setup(at([5, 6]));
    nextRoll(5, 6);
    right.$('[data-roll="2"]').click();
    expect(right.$('[data-accuracy]').textContent).toBe('100%');
  });

  it('celebrates shutting the box', () => {
    const { $, status } = setup(at([3], [1, 2]));
    $('[data-tile="3"]').click();
    $('[data-shut]').click();
    expect(status()).toBe('You shut the box! Score 0. Best: 0.');
  });

  it('offers one die once 7, 8 and 9 are shut, and coaches the choice', () => {
    const { $, status } = setup(at([1, 2]));
    expect(status()).toBe('7, 8 and 9 are shut, so you may roll one die or two.');
    $('[data-hint]').click();
    expect($('[data-tip]').textContent).toBe('Best: roll one die.');
    nextRoll(1);
    $('[data-roll="1"]').click(); // asked first: not scored
    expect($('[data-accuracy]').textContent).toBe('–');
    document.body.replaceChildren();
    const wrong = setup(at([1, 2]));
    nextRoll(1, 1);
    wrong.$('[data-roll="2"]').click();
    expect(wrong.status()).toMatch(/^Best was to roll one die\. /);
  });

  it('outlines the best tiles to shut when asked, and scores a best choice as right', () => {
    const { $, container } = setup(at([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5]));
    $('[data-hint]').click();
    expect($('[data-tip]').textContent).toBe('Best: shut the outlined tiles.');
    expect([...container.querySelectorAll<HTMLElement>('.sb-tile.hint')].map((t) => t.dataset.tile)).toEqual(['9']);
    document.body.replaceChildren();
    const right = setup(at([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5]));
    right.$('[data-tile="9"]').click();
    right.$('[data-shut]').click();
    expect(right.$('[data-accuracy]').textContent).toBe('100%');
    // Only one way to make the roll: nothing to advise or score.
    document.body.replaceChildren();
    const only = setup(at([2, 9], [1, 1]));
    expect(only.$('[data-hint]')).toBeNull();
    only.$('[data-tile="2"]').click();
    only.$('[data-shut]').click();
    expect(load('shutbox:accuracy', null)).toEqual({ right: 1, plays: 1 }); // unchanged
  });

  it('ignores a broken save and saves when closed', () => {
    const { stored, unmount } = setup({ phase: 'x' });
    unmount();
    expect(stored()).toEqual(newRound());
  });
});

describe('Shut the Box colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});

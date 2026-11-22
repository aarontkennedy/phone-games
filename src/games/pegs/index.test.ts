import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { makeContainer, track, answerNewGame } from '../../test/helpers';
import { mount } from './index';
import { CENTER, SIDE, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('pegs:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('pegs:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const hole = (i: number) => $(`[data-cell="${i}"]`);
  return { container, unmount, $, stored, status, hole };
}

const only = (...cells: number[]): State => ({ pegs: Array.from({ length: SIDE * SIDE }, (_, i) => cells.includes(i)), picked: null, moves: 0 });
const ABOVE = CENTER - 2 * SIDE;

describe('Peg Solitaire screen', () => {
  it('picks a peg, shows where it can jump, and jumps', () => {
    const { $, container, stored, status, hole } = setup();
    expect(container.querySelectorAll('.pg-hole')).toHaveLength(33);
    expect($('[data-pegs]').textContent).toBe('32');
    expect(status()).toMatch(/^Tap a peg, then the empty hole two away/);
    hole(2).click(); // no jump from a corner peg
    expect(status()).toMatch(/^That peg has no jump\./);
    hole(ABOVE).click();
    expect(status()).toBe('Now tap the empty hole to jump to.');
    expect(hole(CENTER).classList.contains('target')).toBe(true);
    hole(CENTER - 2).click(); // another peg with a jump: picks that one instead
    expect(stored().picked).toBe(CENTER - 2);
    hole(CENTER).click();
    expect($('[data-pegs]').textContent).toBe('31');
    expect(stored().pegs[CENTER]).toBe(true);
    $('[data-undo]').click();
    expect($('[data-pegs]').textContent).toBe('32');
    $('[data-board]').click(); // not on a hole
  });

  it('hints a jump, and says when there’s no way down to one peg', () => {
    const { $, status, container } = setup();
    $('[data-hint]').click();
    expect(status()).toMatch(/^Hint: jump the outlined peg into the outlined hole\./);
    expect(container.querySelectorAll('.pg-hole.hint')).toHaveLength(2);
    document.body.replaceChildren();
    const lost = setup(only(2, CENTER, CENTER + 1)); // a corner peg, far from the other two
    lost.$('[data-hint]').click();
    expect(lost.status()).toMatch(/^There’s no way to get down to one peg from here\./);
  });

  it('says when Hint can’t tell', async () => {
    const logic = await import('./logic');
    const { vi } = await import('vitest');
    vi.spyOn(logic, 'hint').mockReturnValue('unknown');
    const { $, status } = setup();
    $('[data-hint]').click();
    expect(status()).toMatch(/^Hint can’t tell from here/);
    vi.restoreAllMocks();
  });

  it('ends a game: one peg wins, more is a loss, and Best records the fewest', () => {
    const { $, status, hole } = setup(only(CENTER - 2, CENTER - 1));
    hole(CENTER - 2).click();
    hole(CENTER).click();
    expect(status()).toBe('One peg, right in the center: a perfect game!');
    expect($('[data-best]').textContent).toBe('1');
    expect($<HTMLButtonElement>('[data-hint]').disabled).toBe(true);
    document.body.replaceChildren();
    const off = setup(only(CENTER - 1, CENTER, 2));
    off.hole(CENTER - 1).click();
    off.hole(CENTER + 1).click();
    expect(off.status()).toBe('No jumps left, with 2 pegs. Tap Undo to try another way.');
    document.body.replaceChildren();
    const edge = setup(only(CENTER, CENTER + 1));
    edge.hole(CENTER).click();
    edge.hole(CENTER + 2).click();
    expect(edge.status()).toMatch(/^One peg left: you win!/);
    edge.$<HTMLButtonElement>('.overlay .btn').click();
    expect(edge.stored().pegs.filter(Boolean)).toHaveLength(32);
  });

  it('asks before New partway through, and ignores a broken save', () => {
    const { $, stored, hole } = setup();
    hole(ABOVE).click();
    hole(CENTER).click();
    $('[data-new]').click();
    answerNewGame();
    expect(stored().moves).toBe(0);
    document.body.replaceChildren();
    const broken = setup({ pegs: 'x' });
    broken.unmount();
    expect(broken.stored().pegs).toHaveLength(49);
  });
});

describe('Peg Solitaire colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});

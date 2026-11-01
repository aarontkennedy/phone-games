import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card, Suit } from '../../core/cards';
import { load, save } from '../../core/storage';
import { makeContainer, setHidden, track } from '../../test/helpers';
import { mount } from './index';
import type { State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('freecells:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('freecells:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, stored, status };
}

const upTo = (suit: Suit, rank: number): Card[] => Array.from({ length: rank }, (_, i) => ({ suit, rank: i + 1 }));
/** Everything up except the kings of clubs and diamonds, which sit in columns 0 and 1. */
function nearlyWon(): State {
  return {
    cells: [null, null, null, null],
    foundations: [upTo('S', 13), upTo('H', 13), upTo('D', 12), upTo('C', 12)],
    columns: [[{ suit: 'C', rank: 13 }], [{ suit: 'D', rank: 13 }], [], [], [], [], [], []],
    moves: 0,
    elapsed: 0,
    won: false,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Free cells screen', () => {
  it('deals a new game', () => {
    const { $, $$, status } = setup();
    expect($$('.fc-col')).toHaveLength(8);
    expect($$('.fc-col .card')).toHaveLength(52);
    expect($$('.fc-top .card-slot')).toHaveLength(8);
    expect($<HTMLButtonElement>('[data-undo]').disabled).toBe(true);
    expect(status()).toBe('Tap a card to move it. The four spaces on the left hold one card each.');
  });

  it('moves a tapped card, and says when it can’t', () => {
    const s = nearlyWon();
    s.foundations[3] = upTo('C', 11);
    s.columns[0] = [{ suit: 'C', rank: 13 }, { suit: 'C', rank: 12 }];
    s.columns[2] = [];
    const { $, stored, status } = setup(s);
    $('[data-src="col:0:0"]').click(); // king under the queen: not a run, can't move
    expect(status()).toBe("That card can't move right now.");
    $('[data-src="col:0:1"]').click(); // queen of clubs up, then everything else follows
    expect(stored().won).toBe(true);
  });

  it('wins, times the game and records the best', () => {
    const { $, stored, status } = setup({ ...nearlyWon(), moves: 3 });
    vi.advanceTimersByTime(4000);
    $('[data-src="col:0:0"]').click(); // the king of clubs goes up; the king of diamonds follows by itself
    expect(stored().won).toBe(true);
    expect(status()).toBe('You won in 0:04 with 4 moves! Best: 0:04.');
    expect(load('freecells:best', null)).toBe(4);
    $('.overlay .btn').click();
    expect(stored().won).toBe(false);
    expect(stored().moves).toBe(0);
  });

  it('keeps a better best time', () => {
    save('freecells:best', 1);
    const { $, status } = setup({ ...nearlyWon(), moves: 1 });
    vi.advanceTimersByTime(3000);
    $('[data-src="col:0:0"]').click();
    expect(status()).toBe('You won in 0:03 with 2 moves! Best: 0:01.');
  });

  it('says "1 move"', () => {
    const { $, status } = setup(nearlyWon());
    $('[data-src="col:0:0"]').click();
    expect(status()).toBe('You won in 0:00 with 1 move! Best: 0:00.');
  });

  it('undoes a move', () => {
    const { $, $$, stored } = setup();
    const before = JSON.stringify(stored()?.columns ?? null);
    // Find any card that can move: try each column's top card.
    for (const el of $$('.fc-col .card:last-child')) {
      el.click();
      if (stored()?.moves) break;
    }
    expect(stored().moves).toBe(1);
    $('[data-undo]').click();
    expect(stored().moves).toBe(0);
    expect(before === 'null' || JSON.stringify(stored().columns) === before).toBe(true);
  });

  it('squeezes long columns to fit, keeping ranks readable', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(300);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const el = this as HTMLElement;
      if (el.classList.contains('fc-cols')) return { top: 100, height: 0 } as DOMRect;
      if (el.classList.contains('fc-col')) return { top: 100, height: el.dataset.col === '0' ? 500 : 50 } as DOMRect;
      if (el.matches('.fc-col .card')) return { top: 100 + 26 * [...el.parentElement!.children].indexOf(el), height: 56 } as DOMRect;
      return { top: 0, height: 0 } as DOMRect;
    });
    const { $ } = setup();
    expect($('[data-col="0"]').style.getPropertyValue('--peek')).toBe('24px');
    expect($('[data-col="5"]').style.getPropertyValue('--peek')).toBe('');
    window.dispatchEvent(new Event('resize'));
  });

  it('pauses the clock while hidden, saves when closed, and ignores stray taps and broken saves', () => {
    const { $, stored, unmount, container } = setup({ ...nearlyWon(), moves: 1, columns: [[{ suit: 'C', rank: 13 }], [{ suit: 'D', rank: 13 }], [], [], [], [], [], []] });
    vi.advanceTimersByTime(2000);
    setHidden(true);
    vi.advanceTimersByTime(5000);
    setHidden(false);
    $('[data-board]').click();
    unmount();
    expect(stored().elapsed).toBe(2000);
    expect(container.children).toHaveLength(0);
    expect(setup({ cells: 1 }).$$('.fc-col .card')).toHaveLength(52);
  });
});

describe('Free cells hints', () => {
  it('outlines the card and says where it goes', () => {
    const { $, status } = setup(nearlyWon());
    $<HTMLButtonElement>('[data-hint]').click();
    expect(status()).toBe('Hint: move the king of clubs up to its pile.');
    expect($('[data-src="col:0:0"]').classList.contains('hint')).toBe(true);
    $<HTMLElement>('[data-src="col:0:0"]').click();
    expect($('.hint')).toBeNull();
  });

  it('describes moves onto a card, with the run below it, and to a free space', () => {
    const { $, status } = setup();
    $<HTMLButtonElement>('[data-hint]').click();
    expect(status()).toMatch(/^Hint: move the .+ (onto the .+|to a free space|up to its pile|to the empty column)\.$/);
    expect($('.hint')).not.toBeNull();
  });
});

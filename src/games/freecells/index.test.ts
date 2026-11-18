import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../core/storage';
import { makeContainer, setHidden, track } from '../../test/helpers';
import { mount } from './index';
import type { State } from './logic';
import { nearlyWon, upTo } from './test-fixtures';

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
    expect(status()).toMatch(/^The king of clubs can't move yet: the cards on top of it aren't in order/);
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

  // A full deck (or the save is thrown away): the given free cells and column tops, with
  // the rest buried under the tops. Each column's next card is the same color as the
  // bottom of its top run, so nothing underneath can ever move.
  type Id = [number, 'S' | 'H' | 'D' | 'C'];
  function board(cells: Id[], tops: Id[][]): State {
    const c = ([rank, suit]: Id) => ({ rank, suit });
    const used = new Set([...cells, ...tops.flat()].map(([r, su]) => `${r}${su}`));
    const rest = (['S', 'H', 'D', 'C'] as const).flatMap((suit) => upTo(suit, 13)).filter((x) => !used.has(`${x.rank}${x.suit}`));
    const red = (x: { suit: string }) => x.suit === 'H' || x.suit === 'D';
    const columns = tops.map((top) => {
      const under = rest.splice(rest.findIndex((x) => red(x) === red(c(top[0]))), 1);
      return [...under, ...top.map(c)];
    });
    rest.forEach((x, i) => columns[i % 8].unshift(x));
    return { ...nearlyWon(), foundations: [[], [], [], []], cells: cells.map(c), columns };
  }
  const reds = (ranks: number[]): Id[][] => (['H', 'D'] as const).flatMap((suit) => ranks.map((r): Id[] => [[r, suit]]));

  it('won’t send you in circles, and says when every move goes back', () => {
    const { $, $$, status } = setup(board([[5, 'C'], [6, 'C'], [7, 'C'], [8, 'C']], [[[3, 'C'], [2, 'H']], [[3, 'S']], ...reds([13, 12, 11])]));
    $<HTMLButtonElement>('[data-hint]').click();
    expect(status()).toBe('Hint: move the 2 of hearts onto the 3 of spades.');
    $$('[data-col="0"] .card').at(-1)!.click();
    // Its only move is straight back: no hint, and the line says so.
    expect(status()).toMatch(/^No new moves left: every move goes back to a position you’ve had\. Tap Undo/);
    $<HTMLButtonElement>('[data-hint]').click();
    expect(status()).toMatch(/^No new moves left/);
    expect($('.hint')).toBeNull();
  });

  it('says when no card can move at all', () => {
    const { $, status } = setup(board([[2, 'C'], [3, 'C'], [4, 'C'], [5, 'C']], reds([13, 12, 11, 9])));
    expect(status()).toMatch(/^No moves left\. Tap Undo/);
    $<HTMLButtonElement>('[data-hint]').click();
    expect(status()).toMatch(/^No moves left\./);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, readVars } from '../../test/contrast';
import { expectStaysFinished, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { newGame, type Piece, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('checkers:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const sq = (r: number, c: number) => $<HTMLButtonElement>(`[data-sq="${r * 8 + c}"]`);
  const stored = () => load<State>('checkers:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, sq, stored, status };
}

const man = (side: 0 | 1): Piece => ({ side, king: false });
function state(pieces: [number, number, Piece][], o: Partial<State> = {}): State {
  const board: (Piece | null)[] = Array(64).fill(null);
  for (const [r, c, p] of pieces) board[r * 8 + c] = p;
  return { ...newGame(), board, ...o };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Checkers screen', () => {
  it('starts with your pieces at the bottom, ready to move', () => {
    const { $$, sq, status } = setup();
    expect($$('.ck-piece.p0')).toHaveLength(12);
    expect($$('.ck-piece.p1')).toHaveLength(12);
    expect(sq(5, 0).getAttribute('aria-label')).toBe('Your piece, row 6, column 1');
    expect(sq(5, 0).disabled).toBe(false);
    expect(sq(6, 1).disabled).toBe(true); // blocked in
    expect(status()).toBe('Your turn: tap one of your purple pieces.');
  });

  it('selects a piece, marks its moves, then moves and lets the computer answer', () => {
    const { $$, sq, status, stored } = setup();
    sq(5, 2).click();
    expect(sq(5, 2).classList.contains('selected')).toBe(true);
    expect($$('.ck-sq.target').map((b) => b.getAttribute('aria-label'))).toEqual(['Move here, row 5, column 2', 'Move here, row 5, column 4']);
    expect(status()).toBe('Tap a marked square to move there, or tap another piece.');
    sq(4, 3).click();
    expect(stored().board[4 * 8 + 3]).toEqual(man(0));
    expect(status()).toBe('The computer is thinking…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().turn).toBe(0);
    expect($$('.ck-sq.last').length).toBeGreaterThan(0);
  });

  it('insists on jumps, and shows kings', () => {
    const s = state([[5, 2, man(0)], [4, 3, man(1)], [0, 1, { side: 1, king: true }]]);
    const { sq, status } = setup(s);
    expect(status()).toBe('Your turn. You must jump: tap a piece that can take one.');
    expect(sq(0, 1).getAttribute('aria-label')).toBe('Computer’s king, row 1, column 2');
    sq(5, 2).click();
    sq(3, 4).click();
  });

  it('shows a win, a loss and a draw, then a new round', () => {
    const won = setup(state([[5, 2, man(0)], [4, 3, man(1)]]));
    won.sq(5, 2).click();
    won.sq(3, 4).click();
    expect(won.status()).toBe('You win! Tap  for another round.');
    expectStaysFinished(won.stored);
    expect(won.status()).toBe('You win! Tap  for another round.');
    won.$('[data-new]').click();
    expect(won.stored().starter).toBe(1);
    document.body.replaceChildren();
    expect(setup({ ...newGame(), result: 1 }).status()).toBe('The computer wins. Tap  for another round.');
    document.body.replaceChildren();
    expect(setup({ ...newGame(), result: 'draw' }).status()).toMatch(/draw/);
  });

  it('switches Easy and Strong, ignores stray taps, and stops when closed', () => {
    const { $, stored, unmount } = setup({ ...newGame(), turn: 1 });
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    $('[data-board]').click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 2);
    expect(stored().turn).toBe(1);
    expect(setup({ board: 0 }).status()).toMatch(/^Your turn/);
  });
});

describe('Checkers colors', () => {
  const c = readVars(css, /(?:^|\n)\.ck\s*{([^}]*)}/);
  it('pieces, kings and move marks stand out on the dark squares (3:1)', () => {
    expect(contrast(c['ck-you'], c['ck-dark'])).toBeGreaterThanOrEqual(3);
    expect(contrast(c['ck-computer'], c['ck-dark'])).toBeGreaterThanOrEqual(3);
    expect(contrast(c['ck-light'], c['ck-dark'])).toBeGreaterThanOrEqual(3);
    expect(contrast(c['ck-dark'], c['ck-you'])).toBeGreaterThanOrEqual(3); // king ring
    expect(contrast(c['ck-dark'], c['ck-computer'])).toBeGreaterThanOrEqual(3);
  });
});

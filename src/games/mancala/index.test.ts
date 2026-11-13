import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { newGame, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('mancala:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const pit = (i: number) => $<HTMLButtonElement>(`[data-pit="${i}"]`);
  const stored = () => load<State>('mancala:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, pit, stored, status };
}

const board = (you: number[], yourStore: number, them: number[], theirStore: number) => [...you, yourStore, ...them, theirStore];

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Mancala screen', () => {
  it('shows your pits on the bottom row, ready to tap', () => {
    const { $, $$, pit, status } = setup();
    expect($$('[data-pit]')).toHaveLength(6);
    expect($$('.mc-row.them .mc-pit')).toHaveLength(6);
    expect(pit(0).getAttribute('aria-label')).toBe('Your pit 1: 4 seeds');
    expect($$('.mc-row.them .mc-pit')[0].getAttribute('aria-label')).toBe('Computer’s pit 6: 4 seeds'); // right to left
    expect($('.mc-store.you').getAttribute('aria-label')).toBe('Your store: 0 seeds');
    expect(status()).toBe('Your turn: tap one of your pits on the bottom row.');
  });

  it('sows, gives another turn from the store, then the computer plays after a pause', () => {
    const { $, pit, stored, status } = setup();
    pit(2).click();
    expect($('[data-you]').textContent).toBe('1');
    expect(status()).toBe('You ended in the store, so you go again. Your turn: tap one of your pits on the bottom row.');
    expect(pit(2).classList.contains('played')).toBe(true);
    expect($('.mc-store.you').classList.contains('landed')).toBe(true);
    pit(0).click();
    expect(status()).toBe('The computer is thinking…');
    pit(1).click(); // not your turn
    expect(stored().turn).toBe(1);
    vi.advanceTimersByTime(AI_DELAY * 4);
    expect(stored().last!.side).toBe(1);
  });

  it('says what the computer captured, and singular seeds', () => {
    const s: State = {
      ...newGame(),
      board: board([1, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 3, 4], 4), // 48 seeds in all
      last: { side: 1, pit: 9, end: 8, captured: 5, again: false },
    };
    const { pit, status } = setup(s);
    expect(status()).toMatch(/^The computer captured 5 seeds\./);
    expect(pit(0).getAttribute('aria-label')).toBe('Your pit 1: 1 seed');
  });

  it('shows the result and the rounds won, then a new round', () => {
    const won = setup({ ...newGame(), board: board([0, 0, 0, 0, 0, 1], 30, [1, 0, 0, 0, 0, 0], 16) });
    won.pit(5).click();
    expect(won.status()).toBe('You win! Rounds won: you 1, computer 0. Tap  for another round.');
    won.$('[data-new]').click();
    expect(won.stored()).toMatchObject({ starter: 1, result: null });
    expect(setup({ ...newGame(), result: 1 }).status()).toMatch(/^The computer wins\./);
    expect(setup({ ...newGame(), result: 'draw' }).status()).toMatch(/^It’s a draw\./);
  });

  it('switches Easy and Strong, ignores stray taps and broken saves, and stops when closed', () => {
    const { $, stored, unmount, container } = setup({ ...newGame(), level: 'nope' });
    expect(stored().level).toBe('strong');
    $<HTMLButtonElement>('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect($('[data-level="easy"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-board]').click();
    unmount();
    expect(container.children).toHaveLength(0);
  });

  it('cancels the computer’s move when closed', () => {
    const { pit, stored, unmount } = setup();
    pit(0).click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 4);
    expect(stored().turn).toBe(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { newGame, type Mark, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('tictactoe:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const cell = (i: number) => $<HTMLButtonElement>(`[data-cell="${i}"]`);
  const stored = () => load<State>('tictactoe:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, cell, stored, status };
}

const at = (cells: string, o: Partial<State> = {}): State => ({
  ...newGame(),
  board: [...cells].map((c) => (c === '.' ? null : (c as Mark))),
  ...o,
});

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Tic-tac-toe screen', () => {
  it('starts with an empty board and your turn', () => {
    const { cell, status } = setup();
    expect(cell(0).getAttribute('aria-label')).toBe('Row 1, column 1: empty');
    expect(cell(0).disabled).toBe(false);
    expect(status()).toBe('Your turn: you’re X. Get three in a row.');
  });

  it('places your X, then the computer answers', () => {
    const { cell, status, stored } = setup();
    cell(4).click();
    expect(cell(4).getAttribute('aria-label')).toBe('Row 2, column 2: X');
    expect(cell(0).disabled).toBe(true); // the computer's turn
    expect(status()).toBe('The computer is thinking…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().board.filter(Boolean)).toHaveLength(2);
    expect(status()).toBe('Your turn: you’re X. Get three in a row.');
  });

  it('shows a win, a loss and a draw, then starts a new round', () => {
    const won = setup(at('XX.OO....'));
    won.cell(2).click();
    expect(won.status()).toBe('You win! Tap New for another round.');
    expect(won.cell(0).classList.contains('win')).toBe(true);
    expect(won.$('[data-you]').textContent).toBe('1');
    won.$('[data-new]').click();
    expect(won.stored().starter).toBe('O');
    document.body.replaceChildren();

    const lost = setup(at('XX.OO.X..', { turn: 'O' }));
    vi.advanceTimersByTime(AI_DELAY);
    expect(lost.status()).toBe('The computer wins. Tap New for another round.');
    document.body.replaceChildren();

    const drawn = setup(at('XOXXOOOX.', { tally: { you: 0, computer: 0, draws: 1 } }));
    drawn.cell(8).click();
    expect(drawn.status()).toBe('It’s a draw. Tap New for another round. Draws so far: 2.');
  });

  it('switches Easy and Strong without restarting', () => {
    const { $, stored } = setup(at('X........', { turn: 'X' }));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect(stored().board[0]).toBe('X');
  });

  it('ignores taps between cells, stops when closed, and ignores a broken save', () => {
    const { $, unmount, container, stored } = setup(at('X........', { turn: 'O' }));
    $('[data-board]').click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 2);
    expect(stored().board.filter(Boolean)).toHaveLength(1);
    expect(container.children).toHaveLength(0);
    expect(setup({ board: 3 }).status()).toBe('Your turn: you’re X. Get three in a row.');
  });
});

describe('Tic-tac-toe colors', () => {
  const t = themes(css, '.ttt');
  const app = themes(appCss, ':root');
  it.each([
    ['light', t.light, app.light],
    ['dark', t.dark, app.dark],
  ])('X and O stand out on their cells in the %s theme (3:1)', (_n, c, a) => {
    expect(contrast(c['ttt-x'], a.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(c['ttt-o'], a.surface)).toBeGreaterThanOrEqual(3);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { expectStaysFinished, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, BUST_PAUSE, mount } from './index';
import { newGame, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('hotdice:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('hotdice:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const act = (name: string) => $(`[data-act="${name}"]`).click();
  return { container, unmount, $, $$, stored, status, act };
}

const at = (o: Partial<State>): State => ({ ...newGame(), ...o });
/** Makes every die roll `face`. */
const rollAll = (face: number) => vi.spyOn(Math, 'random').mockReturnValue((face - 1) / 6 + 0.01);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Hot dice screen', () => {
  it('starts with your turn and a Roll button', () => {
    const { $, status } = setup();
    expect($('[data-act="roll"]').textContent).toBe('Roll 6');
    expect($('[data-act="bank"]')).toBeNull();
    expect($('.hd-hint').textContent).toBe('6 dice to roll');
    expect(status()).toBe('First to 10,000 wins. Tap Roll to start your turn.');
  });

  it('rolls, keeps scoring dice, and rolls on', () => {
    rollAll(1);
    const { $, $$, stored, status, act } = setup();
    act('roll');
    expect($$('.hd-die:not(.small)')).toHaveLength(6);
    expect(status()).toBe('Tap the dice to keep: 1s, 5s and sets of three or more score.');
    expect($<HTMLButtonElement>('[data-act="keep-roll"]').disabled).toBe(true);
    $('[data-die="0"]').click();
    expect($('[data-die="0"]').getAttribute('aria-pressed')).toBe('true');
    expect(status()).toBe('Keeping these scores 100. Roll on or bank.');
    $('[data-die="0"]').click(); // unpick
    $('[data-die="0"]').click();
    act('keep-roll');
    expect(stored().turnPoints).toBe(100);
    expect(stored().kept).toEqual([1]);
    expect($$('.hd-kept .hd-die')).toHaveLength(1);
  });

  it('says when picked dice don’t all score', () => {
    const { $, status } = setup(at({ phase: 'choose', dice: [1, 2, 3, 4, 6, 6] }));
    $('[data-die="1"]').click();
    expect(status()).toBe('Those dice don’t all score. Keep only scoring dice.');
  });

  it('keeps and banks, passing the dice to the computer', () => {
    const { $, stored, status, act } = setup(at({ phase: 'choose', dice: [5, 2, 3, 4, 6, 6], turnPoints: 300, remaining: 6 }));
    $('[data-die="0"]').click();
    act('keep-bank');
    expect(stored().scores).toEqual([350, 0]);
    expect(stored().turn).toBe(1);
    expect(status()).toBe('The computer is playing…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().phase).not.toBe('roll');
  });

  it('banks between rolls', () => {
    const { stored, status, act } = setup(at({ turnPoints: 450, remaining: 3 }));
    expect(status()).toBe('You have 450 this turn. Roll again, or bank to keep it.');
    act('bank');
    expect(stored().scores).toEqual([450, 0]);
  });

  it('shows a bust, then passes the turn', () => {
    rollAll(2);
    const { stored, status, act } = setup(at({ turnPoints: 600, remaining: 2 }));
    act('roll');
    expect(status()).toBe('Bust! Nothing scored, so your turn ends with no points.');
    vi.advanceTimersByTime(BUST_PAUSE);
    expect(stored().turn).toBe(1);
    expect(stored().scores).toEqual([0, 0]);
  });

  it('says one die', () => {
    expect(setup(at({ remaining: 1, turnPoints: 50 })).$('.hd-hint').textContent).toBe('1 die to roll');
  });

  it('ends the game when you bank past 10,000, and the computer doesn’t play on', () => {
    const { $, stored, act } = setup(at({ scores: [9800, 4000], turnPoints: 450, remaining: 3 }));
    act('bank');
    expect(stored().phase).toBe('gameOver');
    expect($('.overlay h2').textContent).toBe('You win!');
    expectStaysFinished(stored);
  });

  it('ends the game', () => {
    const won = setup(at({ phase: 'gameOver', scores: [10200, 4000] }));
    expect(won.$('.overlay h2').textContent).toBe('You win!');
    expect(won.status()).toBe('You reached 10,000 with 10,200!');
    won.$('.overlay .btn').click();
    expect(won.stored().scores).toEqual([0, 0]);
    document.body.replaceChildren();
    const lost = setup(at({ phase: 'gameOver', turn: 1, scores: [4000, 10050] }));
    expect(lost.$('.overlay h2').textContent).toBe('The computer wins');
    expect(lost.status()).toBe('The computer reached 10,000 with 10,050!');
  });

  it('switches Easy and Strong, ignores stray taps, and stops when closed', () => {
    const { $, stored, unmount } = setup(at({ turn: 1 }));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    $('[data-board]').click();
    $('[data-actions]').click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(stored().phase).toBe('roll');
    expect(setup({ dice: 'x' }).status()).toMatch(/^First to/);
  });

  it('shows the computer’s bust', () => {
    expect(setup(at({ phase: 'bust', turn: 1 })).status()).toBe('Bust! Nothing scored, so the computer’s turn ends with no points.');
  });
});

describe('Hot dice colors', () => {
  const t = themes(css, '.hd');
  const app = themes(appCss, ':root');
  it.each([
    ['light', t.light, app.light],
    ['dark', t.dark, app.dark],
  ])('dice stand out in the %s theme (3:1)', (_n, c, a) => {
    expect(contrast(c['hd-edge'], a.board)).toBeGreaterThanOrEqual(3);
    expect(contrast(a.text, a.surface)).toBeGreaterThanOrEqual(3);
  });
});

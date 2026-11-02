import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { SPIN_DELAY, mount } from './index';
import { START_CHIPS, newState, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('roulette:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = (sel: string) => [...container.querySelectorAll<HTMLElement>(sel)];
  const stored = () => load<State>('roulette:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const stat = (name: string) => $(`[data-${name}]`).textContent;
  return { container, unmount, $, $$, stored, status, stat };
}

/** Makes the next spin land on `n`. */
const landOn = (n: number) => vi.spyOn(Math, 'random').mockReturnValue((n + 0.5) / 37);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Roulette screen', () => {
  it('lays out the table: 0, twelve columns of three, column bets, dozens and even-money bets', () => {
    const { $$, status, stat } = setup();
    expect(status()).toBe('Choose a chip, then tap the table to bet. A number pays 35 to 1.');
    const spots = $$('[data-spot]').map((b) => b.dataset.spot);
    expect(spots.slice(0, 15)).toEqual(['0', '3', '6', '9', '12', '15', '18', '21', '24', '27', '30', '33', '36', 'c3', '2']);
    expect(spots.slice(-9)).toEqual(['d1', 'd2', 'd3', 'low', 'even', 'red', 'black', 'odd', 'high']);
    expect(spots).toHaveLength(37 + 3 + 3 + 6);
    expect([stat('chips'), stat('bet'), stat('best')]).toEqual(['1000', '0', '1000']);
    expect($$('[data-spot="7"]')[0].getAttribute('aria-label')).toBe('7 red');
    expect($$('[data-spot="red"]')[0].getAttribute('aria-label')).toBe('Red, pays even money');
  });

  it('bets with the chosen chip, lists the bets, and clears them', () => {
    const { $, status, stat, stored } = setup();
    $('[data-chip="100"]').click();
    $('[data-spot="red"]').click();
    $('[data-chip="5"]').click();
    $('[data-spot="17"]').click();
    $('[data-spot="17"]').click();
    expect(status()).toBe('On the table: 17 (10), Red (100). Tap Spin.');
    expect([stat('chips'), stat('bet')]).toEqual(['890', '110']);
    expect($('[data-spot="17"]').classList.contains('bet')).toBe(true);
    expect($('[data-spot="17"]').getAttribute('aria-label')).toBe('17 black, bet 10');
    $('[data-spot="d1"]').click();
    $('[data-spot="c1"]').click();
    expect(status()).toBe('On the table: 120 on 4 bets. Tap Spin.');
    $('[data-clear]').click();
    expect(stored().chips).toBe(START_CHIPS);
    expect($<HTMLButtonElement>('[data-spin]').disabled).toBe(true);
  });

  it('spins, keeps the result hidden for a moment, then pays and marks the winner', () => {
    const { $, $$, status, stat, stored } = setup();
    $('[data-spot="17"]').click(); // 25 on 17
    $('[data-spot="red"]').click();
    landOn(17);
    $('[data-spin]').click();
    expect(stored().chips).toBe(START_CHIPS - 50 + 25 * 36); // decided and saved at once
    expect(status()).toBe('The ball is spinning…');
    expect(stat('chips')).toBe('950'); // the stats wait for the ball
    expect(stat('bet')).toBe('50');
    expect(stat('best')).toBe('1000');
    expect($$('[data-controls] button')).toHaveLength(0);
    expect($<HTMLButtonElement>('[data-spot="5"]').disabled).toBe(true);
    $('[data-spot="5"]').click(); // ignored while spinning
    vi.advanceTimersByTime(SPIN_DELAY);
    expect(status()).toBe('17 black. You win 850.');
    expect([stat('chips'), stat('best')]).toEqual(['1850', '1850']);
    expect($('[data-result] .rl-pocket.big').textContent).toBe('17');
    expect($('[data-spot="17"]').classList.contains('won')).toBe(true);
    expect($('[data-spot="black"]').classList.contains('won')).toBe(true);
    expect($('[data-spot="red"]').classList.contains('won')).toBe(false);
  });

  it('says how a spin went: a loss, breaking even, and a partial loss', () => {
    const { $, status } = setup();
    $('[data-spot="red"]').click();
    landOn(2);
    $('[data-spin]').click();
    vi.advanceTimersByTime(SPIN_DELAY);
    expect(status()).toBe('2 black. No win: you lose 25.');
    $('[data-repeat]').click(); // red again
    $('[data-spot="black"]').click();
    landOn(4);
    $('[data-spin]').click();
    vi.advanceTimersByTime(SPIN_DELAY);
    expect(status()).toBe('4 black. You break even.');
    $('[data-spot="black"]').click();
    $('[data-spot="d1"]').click();
    $('[data-spot="0"]').click();
    landOn(14); // red, so black loses; 1st 12 doesn't cover 14
    $('[data-spot="d2"]').click();
    $('[data-spin]').click();
    vi.advanceTimersByTime(SPIN_DELAY);
    expect(status()).toBe('14 red. You lose 25.');
    expect($('[data-result]').textContent).toBe('1442');
  });

  it('offers Start over when out of chips', () => {
    const { $, status, stored } = setup({ ...newState(), chips: 0, history: [5], staked: 25 });
    expect(status()).toBe('5 red. No win: you lose 25. You’re out of chips. Tap Start over for 1000 more.');
    $('[data-restart]').click();
    expect(stored().chips).toBe(START_CHIPS);
    $('[data-board]').click(); // between the spots
    $('[data-controls]').click(); // between the buttons
    expect(stored().chips).toBe(START_CHIPS);
  });

  it('starts fresh from a broken save, and cleans up when closed', () => {
    const { stat, unmount, container } = setup({ chips: 'lots' });
    expect(stat('chips')).toBe('1000');
    unmount();
    expect(container.children).toHaveLength(0);
  });
});

describe('Roulette colors', () => {
  const rl = themes(css, '.rl');
  const app = themes(appCss, ':root');

  it.each([
    ['light', rl.light, app.light],
    ['dark', rl.dark, app.dark],
  ])('numbers are readable on their squares in the %s theme (4.5:1)', (_name, t, a) => {
    for (const bg of ['rl-red', 'rl-black', 'rl-green']) expect(contrast(t['rl-on'], t[bg]), bg).toBeGreaterThanOrEqual(4.5);
    expect(contrast(a['on-accent'], a.accent), 'outside bet with chips').toBeGreaterThanOrEqual(4.5);
    expect(contrast(t['rl-diamond'], a.surface), 'red diamond').toBeGreaterThanOrEqual(3);
    expect(contrast(a.text, a.surface), 'black diamond’s edge').toBeGreaterThanOrEqual(3);
  });
});

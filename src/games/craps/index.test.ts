import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { ROLL_DELAY, mount } from './index';
import { START_CHIPS, newState, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('craps:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = (sel: string) => [...container.querySelectorAll<HTMLElement>(sel)];
  const stored = () => load<State>('craps:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const stat = (name: string) => $(`[data-${name}]`).textContent;
  return { container, unmount, $, $$, stored, status, stat };
}

/** Makes the next roll come up `a` and `b`. */
function nextRoll(a: number, b: number) {
  const spy = vi.spyOn(Math, 'random');
  spy.mockReturnValueOnce((a - 0.5) / 6).mockReturnValueOnce((b - 0.5) / 6);
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Craps screen', () => {
  it('starts on a come-out roll, with only the line bets and the field open', () => {
    const { $, status, stat } = setup();
    expect(status()).toBe('Come-out roll: bet the pass line or don’t pass, then tap Roll.');
    expect([stat('chips'), stat('bet'), stat('best')]).toEqual(['1000', '0', '1000']);
    expect($<HTMLButtonElement>('[data-target="pass"]').disabled).toBe(false);
    expect($<HTMLButtonElement>('[aria-label^="Come"]').disabled).toBe(true);
    expect($('.cr-puck').textContent).toBe('No point');
    expect($<HTMLButtonElement>('[data-clear]').disabled).toBe(true);
  });

  it('bets, rolls a point, adds odds, and wins it', () => {
    const { $, status, stat, stored } = setup();
    $('[data-chip="25"]').click();
    $('[data-target="pass"]').click();
    expect([stat('chips'), stat('bet')]).toEqual(['975', '25']);
    nextRoll(2, 4);
    $('[data-roll]').click();
    expect(status()).toBe('Rolling…');
    expect($('.cr-die').getAttribute('aria-label')).toBe('Rolling');
    vi.advanceTimersByTime(ROLL_DELAY);
    expect(status()).toBe('Rolled 6. The point is 6.');
    expect($('.cr-puck').textContent).toBe('Point 6');
    expect($('[data-target="odds:6"]').classList.contains('point')).toBe(true);
    expect($('.cr-die').getAttribute('aria-label')).toBe('Die showing 2');

    $('[data-chip="100"]').click();
    $('[data-target="odds:pass"]').click(); // 5x on a 6: 100 of the 125 allowed
    expect(stored().bets[0].odds).toBe(100);
    expect($('[data-target="odds:pass"] b').textContent).toBe('25 · odds 100');
    nextRoll(3, 3);
    $('[data-roll]').click();
    expect(stat('chips')).toBe('875'); // as it was, until the dice land
    vi.advanceTimersByTime(ROLL_DELAY);
    expect(status()).toBe('Rolled 6. Pass line wins 145. New come-out roll.');
    expect([stat('chips'), stat('best')]).toEqual(['1145', '1145']);
  });

  it('moves a come bet to its number and adds odds there', () => {
    const { $, status, stored } = setup({ ...newState(), point: 4 });
    expect(status()).toBe('The point is 4: pass wins if it comes before a 7. Tap a bet to add odds.');
    $('[data-target="come"]').click();
    $('[data-target="dontCome"]').click();
    nextRoll(4, 5);
    $('[data-roll]').click();
    vi.advanceTimersByTime(ROLL_DELAY);
    expect(status()).toBe('Rolled 9. Come moves to 9. Don’t come moves to 9. The point is 4.');
    const nine = $('[data-target="odds:9"]');
    expect(nine.textContent).toContain('10');
    expect(nine.getAttribute('aria-label')).toBe('9: Come, bet 5, Don’t come, bet 5, tap to add odds');
    nine.click();
    expect(stored().bets.find((b) => b.kind === 'come')!.odds).toBe(5);
  });

  it('sums up a roll that settles many bets, and takes bets back', () => {
    const { $, status, stored } = setup({ ...newState(), point: 4 });
    $('[data-target="come"]').click();
    $('[data-target="field"]').click();
    $('[data-target="dontCome"]').click();
    $('[data-clear]').click();
    expect(stored().chips).toBe(START_CHIPS);
    $('[data-target="come"]').click();
    $('[data-target="field"]').click();
    $('[data-target="dontCome"]').click();
    nextRoll(5, 6); // 11: come wins, field wins, don't come loses
    $('[data-roll]').click();
    vi.advanceTimersByTime(ROLL_DELAY);
    expect(status()).toBe('Rolled 11. You win 5. The point is 4.');
    nextRoll(1, 2);
    $('[data-target="field"]').click();
    $('[data-roll]').click();
    vi.advanceTimersByTime(ROLL_DELAY);
    expect(status()).toBe('Rolled 3. Field wins 5. The point is 4.');
  });

  it('says when a roll breaks even or a bet ties, and offers Start over when broke', () => {
    const tie = setup({ ...newState(), bets: [{ kind: 'dontPass', flat: 5, odds: 0, point: null }], chips: 995 });
    nextRoll(6, 6);
    tie.$('[data-roll]').click();
    vi.advanceTimersByTime(ROLL_DELAY);
    expect(tie.status()).toBe('Rolled 12. New come-out roll.');
    document.body.replaceChildren();

    const even = setup({ ...newState(), point: 5, chips: 1000 });
    even.$('[data-target="come"]').click();
    even.$('[data-target="dontCome"]').click();
    even.$('[data-target="field"]').click();
    nextRoll(1, 6); // 7: come wins 5, don't come loses 5, field loses 5
    even.$('[data-roll]').click();
    vi.advanceTimersByTime(ROLL_DELAY);
    expect(even.status()).toBe('Rolled 7. You lose 5. New come-out roll.');
    document.body.replaceChildren();

    const broke = setup({ ...newState(), chips: 0, dice: [1, 1], outcomes: [{ name: 'Pass line', net: -5 }] });
    expect(broke.status()).toBe('Rolled 2. Pass line loses 5. You’re out of chips. Tap Start over for 1000 more.');
    broke.$('[data-restart]').click();
    expect(broke.stored().chips).toBe(START_CHIPS);
    broke.$('[data-board]').click();
    broke.$('[data-controls]').click();
    expect(broke.stored().bets).toEqual([]);
  });

  it('describes a roll that settles exactly two bets one by one, including a tie', () => {
    const { status } = setup({ ...newState(), dice: [3, 4], outcomes: [{ name: 'Come on 6', net: 0 }, { name: 'Field', net: -5 }] });
    expect(status()).toBe('Rolled 7. Come on 6 ties. Field loses 5. New come-out roll.');
  });

  it('breaks even across three bets', () => {
    const outcomes = [{ name: 'Come', net: 5 }, { name: 'Field', net: -5 }, { name: 'Don’t come', net: 0, moved: 6 }];
    const { status } = setup({ ...newState(), point: 6, dice: [2, 4], outcomes });
    expect(status()).toBe('Rolled 6. You break even. The point is 6.');
  });

  it('starts fresh from a broken save, and cleans up when closed', () => {
    const { stat, unmount, container } = setup({ chips: 'lots' });
    expect(stat('chips')).toBe('1000');
    unmount();
    expect(container.children).toHaveLength(0);
  });
});

describe('Craps colors', () => {
  const app = themes(appCss, ':root');

  it.each([
    ['light', app.light],
    ['dark', app.dark],
  ])('the table reads clearly in the %s theme', (_name, a) => {
    expect(contrast(a['on-accent'], a.accent), 'the point').toBeGreaterThanOrEqual(4.5);
    expect(contrast(a.text, a.surface), 'bets').toBeGreaterThanOrEqual(4.5);
    expect(contrast(a.muted, a.surface), 'closed bets').toBeGreaterThanOrEqual(4.5);
    expect(contrast(a.text, a.surface), 'chip edges').toBeGreaterThanOrEqual(3);
    expect(css).toContain('var(--on-accent)');
  });
});

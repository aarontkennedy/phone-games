import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, readVars } from '../../test/contrast';
import { answerNewGame, expectStaysFinished, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { newGame, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('backgammon:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const pt = (id: string | number) => $(`[data-pt="${id}"]`);
  const stored = () => load<State>('backgammon:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, pt, stored, status };
}

const rolled = (dice: number[], o: Partial<State> = {}): State => {
  const s = { ...newGame(), dice, lastRoll: dice.slice(0, 2), ...o };
  return { ...s, turnStart: s };
};

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Backgammon screen', () => {
  it('sets up the board with 24 points, the bar and the trays', () => {
    const { container, pt, status, $ } = setup();
    expect(container.querySelectorAll('.bg-pt')).toHaveLength(24);
    expect(pt(23).getAttribute('aria-label')).toBe('Point 24: 2 yours');
    expect(pt(0).getAttribute('aria-label')).toBe('Point 1: 2 the computer’s');
    expect($('[data-pt="off"]').getAttribute('aria-label')).toBe('Yours borne off: 0 of 15');
    expect(status()).toMatch(/^Your turn: tap Roll/);
  });

  it('rolls, picks a checker, marks where it can go, and moves it', () => {
    const { pt, stored, status, $ } = setup(rolled([3, 1]));
    expect(status()).toBe('You rolled 3 and 1. Tap a checker to move.');
    expect($('[data-roll]').hasAttribute('disabled')).toBe(true);
    pt(7).click();
    expect(pt(7).classList.contains('selected')).toBe(true);
    expect(pt(4).classList.contains('target')).toBe(true);
    expect(status()).toMatch(/^Tap a marked point/);
    pt(4).click();
    expect(stored().points[4]).toBe(1);
    expect($('[data-undo]').hasAttribute('disabled')).toBe(false);
    $<HTMLButtonElement>('[data-undo]').click();
    expect(stored().points[4]).toBe(0);
    pt(7).click();
    pt(7).click(); // tap again to let go
    expect(pt(7).classList.contains('selected')).toBe(false);
    pt(3).click(); // not a checker you can move
  });

  it('lets the computer roll and play after your turn', () => {
    const { pt, stored, status } = setup(rolled([3, 1]));
    pt(7).click();
    pt(4).click();
    pt(5).click();
    pt(4).click();
    expect(stored().turn).toBe(1);
    expect(status()).toMatch(/^The computer is rolling/);
    vi.advanceTimersByTime(AI_DELAY);
    expect(status()).toMatch(/^The computer rolled/);
    vi.advanceTimersByTime(AI_DELAY * 6);
    expect(stored().turn).toBe(0);
  });

  it('says when your roll can’t be played', () => {
    const p = Array(24).fill(0);
    [18, 19, 20, 21, 22, 23].forEach((i) => (p[i] = -2));
    p[0] = -3;
    p[10] = 14;
    const { $, status } = setup({ ...newGame(), points: p, bar: [1, 0] });
    expect(status()).toMatch(/^Your turn: tap Roll/);
    $<HTMLButtonElement>('[data-roll]').click();
    expect(status()).toMatch(/^You rolled \d and \d but can’t move\. The computer/);
  });

  it('wins when you bear off your last checker, and the computer doesn’t play on', () => {
    const points = Array(24).fill(0);
    points[0] = 1; // your last checker, one pip from home
    points[23] = -12;
    const { pt, $, stored, status } = setup(rolled([1, 2], { points, off: [14, 3] }));
    pt(0).click();
    $('[data-pt="off"]').click();
    expect(stored().result).toBe(0);
    expect(status()).toMatch(/^You win/);
    expectStaysFinished(stored);
  });

  it('shows a win, and New starts again (asking first mid-game)', () => {
    const won = setup({ ...newGame(), result: 0, gammon: true, tally: { you: 2, computer: 0 } });
    expect(won.status()).toBe('You win a gammon, worth 2! Tap  for another game.');
    won.$<HTMLButtonElement>('[data-new]').click();
    expect(won.stored().result).toBeNull();
    won.unmount();
    const mid = setup(rolled([3, 1]));
    mid.$<HTMLButtonElement>('[data-new]').click();
    answerNewGame();
    expect(mid.stored().lastRoll).toEqual([]);
    expect(setup({ ...newGame(), result: 1 }).status()).toMatch(/^The computer wins!/);
  });

  it('switches Easy and Strong, ignores broken saves, and stops when closed', () => {
    const { $, stored, unmount, container } = setup({ broken: 1 });
    $<HTMLButtonElement>('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    unmount();
    expect(container.children).toHaveLength(0);
  });
});

describe('Backgammon colors', () => {
  const c = readVars(css, /(?:^|\n)\.bg\s*{([^}]*)}/);
  it('checkers and marks stand out on both point colors (3:1)', () => {
    for (const fill of ['bg-you', 'bg-them', 'bg-mark']) {
      expect(contrast(c[fill], c['bg-point-a']), fill).toBeGreaterThanOrEqual(3);
      expect(contrast(c[fill], c['bg-point-b']), fill).toBeGreaterThanOrEqual(3);
    }
    expect(contrast('#1d1a2b', c['bg-you'])).toBeGreaterThanOrEqual(4.5); // the count on a stack
    expect(contrast('#1d1a2b', c['bg-them'])).toBeGreaterThanOrEqual(4.5);
  });
});

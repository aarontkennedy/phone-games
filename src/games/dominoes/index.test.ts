import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { fullSet, newGame, type State, type Tile } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('dominoes:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('dominoes:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const recent = () => $$('[data-recent] li').map((li) => li.textContent).reverse();
  return { container, unmount, $, $$, stored, status, recent };
}

function at(hands: Tile[][], line: Tile[] = [], o: Partial<State> = {}): State {
  const used = [...hands.flat(), ...line];
  const boneyard = fullSet().filter((t) => !used.some((u) => (u[0] === t[0] && u[1] === t[1]) || (u[0] === t[1] && u[1] === t[0])));
  return { ...newGame(), hands, line, boneyard, ...o };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Dominoes screen', () => {
  it('starts with your lead', () => {
    const { $$, status } = setup(at([[[6, 6], [6, 2]], [[1, 1]]]));
    expect($$('[data-tile]:not([disabled])')).toHaveLength(2);
    expect(status()).toBe('Your lead: tap any tile.');
  });

  it('plays a tile, then the computer answers', () => {
    const { $, $$, stored, status, recent } = setup(at([[[6, 6], [6, 2]], [[6, 1], [3, 3]]]));
    expect(recent()).toEqual([]);
    $('[data-tile="6-2"]').click();
    expect(recent()).toEqual(['You played 6 and 2.']);
    expect(stored().line).toEqual([[6, 2]]);
    expect($$('.dom-line .dom-tile.end')).toHaveLength(1);
    expect(status()).toBe('The computer is playing…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().line).toHaveLength(2);
    expect(status()).toBe('Nothing matches 1 or 2. Draw a tile.');
    expect(recent()).toEqual(['You played 6 and 2.', 'The computer played 1 and 6 on the left.']);
  });

  it('asks which end when a tile fits both', () => {
    const { $, $$, stored, status } = setup(at([[[2, 5], [0, 0]], [[1, 1]]], [[5, 3], [3, 2]]));
    $('[data-tile="2-5"]').click();
    expect(status()).toBe('That tile fits both ends. Which end?');
    expect($$('[data-end]').map((b) => b.textContent)).toEqual(['Left end (5)', 'Right end (2)']);
    $('[data-tile="2-5"]').click(); // change your mind
    expect($('[data-end]')).toBeNull();
    $('[data-tile="2-5"]').click();
    $('[data-end="right"]').click();
    expect(stored().line.at(-1)).toEqual([2, 5]);
    expect($$('[data-recent] li').map((li) => li.textContent).reverse()).toEqual(['You played 2 and 5 on the right.']);
  });

  it('plays straight away when both ends show the same number', () => {
    const { $, stored } = setup(at([[[3, 5], [0, 0]], [[1, 1]]], [[3, 3]]));
    $('[data-tile="3-5"]').click();
    expect(stored().line).toHaveLength(2);
  });

  it('draws when stuck, and passes when the boneyard is empty', () => {
    const drawing = setup(at([[[1, 1]], [[5, 5]]], [[6, 2]]));
    expect(drawing.status()).toBe('Nothing matches 6 or 2. Draw a tile.');
    // The computer's hand and the boneyard show as face-down tiles, one per tile.
    const [hand, yard] = drawing.$$('.dom-backs');
    expect(hand.getAttribute('aria-label')).toBe('1 tile');
    expect(hand.querySelectorAll('.dom-back')).toHaveLength(1);
    expect(yard.getAttribute('aria-label')).toBe('25 tiles');
    expect(yard.querySelectorAll('.dom-back')).toHaveLength(25);
    drawing.$('[data-draw]').click();
    expect(drawing.stored().hands[0]).toHaveLength(2);
    expect(drawing.$$('.dom-backs')[1].querySelectorAll('.dom-back')).toHaveLength(24);
    expect(drawing.recent()).toEqual(['You drew a tile.']);
    drawing.$('[data-level="easy"]').click(); // not a move
    expect(drawing.recent()).toHaveLength(1);
    document.body.replaceChildren();
    const rest = fullSet().filter((t) => !(t[0] === 1 && t[1] === 1) && !(t[0] === 2 && t[1] === 6));
    const passing = setup({ ...at([[[1, 1]], rest], [[6, 2]]), boneyard: [] });
    expect(passing.status()).toBe('Nothing matches 6 or 2, and the boneyard is empty: tap Pass.');
    expect(passing.$$('.dom-row')[1].textContent).toBe('BoneyardEmpty');
    passing.$('[data-pass]').click();
    expect(passing.stored().turn).toBe(1);
    expect(passing.recent().at(-1)).toBe('You passed.');
  });

  it('sums up rounds and the game', () => {
    const r = (o: Partial<State>) => ({ ...at([[[1, 1]], [[5, 5]]], [[6, 2]]), ...o });
    const won = setup(r({ phase: 'roundOver', last: { winner: 0, points: 14, blocked: false } }));
    expect(won.$('.overlay h2').textContent).toBe('You win the round');
    expect(won.status()).toBe('You played the last tile and score 14.');
    expect(won.$$('.dom-row .dom-tile.small')).toHaveLength(1);
    won.$('.overlay .btn').click();
    expect(won.stored().phase).toBe('playing');
    expect(won.recent()).toEqual([]);
    document.body.replaceChildren();

    const blocked = setup(r({ phase: 'roundOver', last: { winner: 1, points: 9, blocked: true } }));
    expect(blocked.$('.overlay h2').textContent).toBe('The computer wins the round');
    expect(blocked.status()).toBe('Nobody could play. The computer had fewer pips and scores 9.');
    document.body.replaceChildren();
    const tie = setup(r({ phase: 'roundOver', last: { winner: null, points: 0, blocked: true } }));
    expect(tie.$('.overlay h2').textContent).toBe('A tie');
    expect(tie.status()).toBe('Nobody could play. Your pips and the computer’s are equal, so nobody scores.');
    document.body.replaceChildren();
    const over = setup(r({ phase: 'gameOver', last: { winner: 1, points: 30, blocked: false }, scores: [20, 110] }));
    expect(over.$('.overlay h2').textContent).toBe('The computer wins');
    over.$('.overlay .btn').click();
    expect(over.stored().scores).toEqual([0, 0]);
    document.body.replaceChildren();
    expect(setup(r({ phase: 'gameOver', last: { winner: 0, points: 30, blocked: false }, scores: [110, 20] })).$('.overlay h2').textContent).toBe('You win!');
  });

  it('switches Easy and Strong, ignores stray taps, and stops when closed', () => {
    const { $, stored, unmount } = setup(at([[[1, 1]], [[6, 6]]], [], { turn: 1 }));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    $('[data-board]').click();
    $('[data-actions]').click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 2);
    expect(stored().line).toEqual([]);
    expect(setup({ hands: 0 }).$$('[data-tile]')).toHaveLength(7);
  });
});

describe('Dominoes colors', () => {
  const t = themes(css, '.dom');
  const app = themes(appCss, ':root');
  it.each([
    ['light', t.light, app.light],
    ['dark', t.dark, app.dark],
  ])('tiles stand out in the %s theme (3:1)', (_n, c, a) => {
    expect(contrast(c['dom-edge'], a.board)).toBeGreaterThanOrEqual(3);
    expect(contrast(c['dom-edge'], a.surface)).toBeGreaterThanOrEqual(3);
  });
});

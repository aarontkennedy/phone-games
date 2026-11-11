import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../core/storage';
import { answerNewGame, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, eventText, mount, plural } from './index';
import type { State } from './logic';
import { card, onTop, position } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('gofish:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('gofish:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const recent = () => $$('[data-recent] li').map((li) => li.textContent).reverse();
  const tap = (id: string) => $(`[data-hand][data-card="${id}"]`).click();
  return { container, unmount, $, $$, stored, status, recent, tap };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Go fish screen', () => {
  it('shows the table, then asks a player for the rank you tap', () => {
    const { $, $$, stored, status, recent, tap } = setup(position(['7H 7C 2C', '7S 3C', '4H', '5H'], { books: [[], [9], [], []] }));
    expect(recent()).toEqual([]);
    expect($('[data-seat="1"] .tt-info').textContent).toBe('2 left1 book');
    expect($('[data-seat="1"] .tt-play .card').getAttribute('aria-label')).toBe('9 of spades');
    expect($('[data-seat="2"] .tt-info').textContent).toBe('1 left0 books');
    expect(status()).toBe('Your turn: tap a card, then ask a player for that rank.');
    expect($('[data-actions]').innerHTML).toBe('');

    tap('7H');
    expect($$('.tt-hand .picked').map((c) => c.dataset.card)).toEqual(['7C', '7H']);
    expect(status()).toBe('Tap West, North or East to ask for 7s.');
    expect($$('[data-ask]').map((b) => b.getAttribute('aria-label'))).toEqual(['Ask West for 7s', 'Ask North for 7s', 'Ask East for 7s']);
    expect($('[data-seat="0"]').hasAttribute('data-ask')).toBe(false);
    tap('7C'); // tap again to change your mind
    expect($('[data-ask]')).toBeNull();
    tap('7C');
    $('[data-ask="1"]').click();
    expect(stored().hands[0]).toHaveLength(4);
    expect(recent()).toEqual(['You asked West for 7s and got 1.']);
    expect(status()).toBe('Your turn: tap a card, then ask a player for that rank.');
  });

  it('goes fishing, then the computer players take their turns', () => {
    const { $, stored, status, recent, tap } = setup(onTop(position(['7H 2C', '3C', '4H', '5H']), '9D'));
    tap('7H');
    $('[data-ask="2"]').click();
    expect(stored().turn).toBe(1);
    expect(recent()).toEqual(['You asked North for 7s: go fish, drew the 9 of diamonds.']);
    expect(status()).toBe('West is asking…');
    $('[data-board]').click(); // not your turn
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().last).toMatchObject({ seat: 1 });
    expect(recent()).toHaveLength(2);
    expect(recent()[1]).toMatch(/^West /);
  });

  it('draws when your hand is empty', () => {
    const { $, stored, status, recent } = setup(position(['', '3C', '4H', '5H']));
    expect(status()).toBe('You have no cards: draw one.');
    $('[data-draw]').click();
    expect(stored().hands[0]).toHaveLength(1);
    expect(recent()[0]).toMatch(/^You drew the .+\.$/);
    expect(status()).toMatch(/^Your turn/);
    document.body.replaceChildren();
    expect(setup(position(['3C', '', '', ''])).status()).toBe('No one else has cards: draw one.');
    document.body.replaceChildren();
    const one = setup(position(['3C 4C', '', '5D', '']));
    one.tap('3C');
    expect(one.status()).toBe('Tap North to ask for 3s.');
  });

  it('describes every kind of turn', () => {
    const ask = { kind: 'ask' as const, seat: 1 as const, from: 0 as const, rank: 1, got: 0, drew: null, books: [] };
    expect(eventText({ ...ask, got: 2 })).toBe('West asked you for aces and got 2.');
    expect(eventText(ask)).toBe('West asked you for aces: go fish, the deck is empty.');
    expect(eventText({ ...ask, drew: card('AS'), books: [1] })).toBe('West asked you for aces: go fish, drew an ace, goes again. Book of aces.');
    expect(eventText({ ...ask, seat: 0, from: 3, rank: 8, drew: card('8S') })).toBe('You asked East for 8s: go fish, drew an 8, go again.');
    expect(eventText({ ...ask, drew: card('5S') })).toBe('West asked you for aces: go fish.');
    expect(eventText({ kind: 'draw', seat: 2, drew: card('5S'), books: [] })).toBe('North drew a card.');
    expect(eventText({ kind: 'draw', seat: 0, drew: card('QS'), books: [12, 5] })).toBe('You drew the queen of spades. Book of queens and 5s.');
    expect([1, 7, 10, 11, 13].map(plural)).toEqual(['aces', '7s', '10s', 'jacks', 'kings']);
  });

  it('ends the game and starts the next', () => {
    const books = { books: [[1, 2, 3, 4, 5, 6], [8, 9, 10], [11, 12], [13]] };
    const won = setup(position(['7H 7C 7D', '7S', '', ''], books));
    won.tap('7H');
    won.$('[data-ask="1"]').click();
    expect(won.$('.overlay h2').textContent).toBe('You win!');
    expect(won.recent()).toEqual(['You asked West for 7s and got 1. Book of 7s.']);
    expect(won.status()).toBe('You won 1 of 1 games.');
    won.$('.overlay .btn').click();
    expect(won.stored().phase).toBe('playing');
    expect(won.recent()).toEqual([]); // a new game starts a new list
    expect(won.stored().tally).toEqual({ won: 1, played: 1 });
    document.body.replaceChildren();

    const over = (b: number[][]) => setup({ ...position(['', '', '', ''], { books: b }), phase: 'over' }).$('.overlay h2').textContent;
    expect(over([[1, 2, 3], [4, 5, 6, 7], [8, 9, 10], [11, 12, 13]])).toBe('West wins');
    document.body.replaceChildren();
    expect(over([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11], [12, 13]])).toBe('You tie for the win!');
    document.body.replaceChildren();
    expect(over([[1, 2, 3], [5, 6, 7, 8], [9, 10, 11, 4], [12, 13]])).toBe('A tie');
  });

  it('asks before abandoning a game, switches level, and stops when closed', () => {
    const { $, $$, stored, unmount } = setup(onTop(position(['7H 2C', '3C', '4H', '5H']), '9D'));
    $('[data-new]').click(); // nothing has happened yet: no question
    expect(stored().dealer).toBe(0);
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect($$('[data-level]').map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    $('[data-actions]').click();
    unmount();
    document.body.replaceChildren();

    const mid = setup(onTop(position(['7H 2C', '3C', '4H', '5H']), '9D'));
    mid.tap('7H');
    mid.$('[data-ask="1"]').click();
    mid.unmount();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(mid.stored().turn).toBe(1);
    document.body.replaceChildren();

    const again = setup(mid.stored());
    expect(again.recent()[0]).toBe('You asked West for 7s: go fish, drew the 9 of diamonds.'); // kept while away
    again.$('[data-new]').click();
    answerNewGame();
    expect(again.stored().last).toBeNull();
    expect(again.recent()).toEqual([]);
    document.body.replaceChildren();
    expect(setup({ hands: 2 }).$$('[data-hand]').length).toBeGreaterThan(0);
  });
});

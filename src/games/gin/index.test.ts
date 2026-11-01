import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import type { Result, State } from './logic';
import { position } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('gin:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('gin:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const tap = (id: string) => $(`[data-hand][data-card="${id}"]`).click();
  return { container, unmount, $, $$, stored, status, tap };
}

const MINE = 'AS 2S 3S 4D 4C 4H 9H 9S 9D KC';
const THEIRS = '2H 3H 4S 5D 6C 7S 8D 10C JH QS';

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Gin rummy screen', () => {
  it('shows your hand with melds first and loose cards outlined', () => {
    const { $$, status } = setup(position([MINE, THEIRS], '5S'));
    const order = $$('[data-hand]').map((c) => c.dataset.card);
    expect(order.at(-1)).toBe('KC');
    expect($$('.card.loose').map((c) => c.dataset.card)).toEqual(['KC']);
    expect(status()).toBe('Your turn: take the 5 of spades from the pile, or draw from the deck. Your deadwood: 10. Loose cards have a dashed outline.');
  });

  it('draws from the deck, then discards, then the computer plays', () => {
    const { $, stored, status, tap } = setup(position([MINE, THEIRS], '5S'));
    $('[data-stock]').click();
    expect(stored().hands[0]).toHaveLength(11);
    expect(status()).toMatch(/^Tap a card to discard\./);
    tap('KC');
    expect(stored().turn).toBe(1);
    expect(status()).toBe('The computer is playing…');
    vi.advanceTimersByTime(AI_DELAY * 2);
    expect(stored().turn).toBe(0);
  });

  it('takes the pile card, which can’t go straight back', () => {
    const { $, stored } = setup(position([MINE, THEIRS], '5S'));
    $('[data-pile]').click();
    expect(stored().taken).toEqual({ suit: 'S', rank: 5 });
    expect($<HTMLButtonElement>('[data-hand][data-card="5S"]').disabled).toBe(true);
  });

  it('knocks: tap Knock, then a card that leaves 10 or less', () => {
    const s = position(['AS 2S 3S 4D 4C 4H 9H 9S 9D KC 2C', THEIRS], '5S', { phase: 'discard' });
    const { $, stored, status, tap } = setup(s);
    expect($('[data-knock]').hidden).toBe(false);
    expect(status()).toMatch(/You can knock: tap Knock first\./);
    $('[data-knock]').click();
    expect($('[data-knock]').getAttribute('aria-pressed')).toBe('true');
    expect(status()).toBe('Tap a card to discard and knock (you need 10 or less deadwood).');
    expect($<HTMLButtonElement>('[data-hand][data-card="AS"]').disabled).toBe(true);
    $('[data-knock]').click();
    $('[data-knock]').click();
    tap('KC');
    expect(stored().phase).toBe('handOver');
    expect($('.overlay h2').textContent).toBe('You win the hand');
    expect(status()).toMatch(/^You knocked\. Deadwood: you 2, computer \d+, so you score \d+\.$/);
    expect($('.gin-fan.open .card')).not.toBeNull();
    $('.overlay .btn').click();
    expect(stored().phase).toBe('draw');
  });

  const over = (last: Result, o: Partial<State> = {}) => ({ ...position([MINE, THEIRS], '5S'), phase: 'handOver' as const, last, ...o });

  it.each([
    [{ kind: 'gin', knocker: 0, winner: 0, points: 40, deadwood: [0, 15], melds: [[], []] }, 'Gin!', 'You went gin. Deadwood: you 0, computer 15, so you score 40.'],
    [{ kind: 'gin', knocker: 1, winner: 1, points: 30, deadwood: [5, 0], melds: [[], []] }, 'The computer has gin', 'The computer went gin. Deadwood: you 5, computer 0, so the computer scores 30.'],
    [{ kind: 'undercut', knocker: 0, winner: 1, points: 27, deadwood: [6, 4], melds: [[], []] }, 'You were undercut', 'You knocked. Deadwood: you 6, computer 4, so the computer scores 27.'],
    [{ kind: 'undercut', knocker: 1, winner: 0, points: 26, deadwood: [3, 4], melds: [[], []] }, 'Undercut!', 'The computer knocked. Deadwood: you 3, computer 4, so you score 26.'],
    [{ kind: 'knock', knocker: 1, winner: 1, points: 9, deadwood: [12, 3], melds: [[], []] }, 'The computer wins the hand', 'The computer knocked. Deadwood: you 12, computer 3, so the computer scores 9.'],
    [{ kind: 'draw', knocker: null, winner: null, points: 0, deadwood: [12, 3], melds: [[], []] }, 'No winner', 'The deck ran low, so nobody scores this hand.'],
  ] as [Result, string, string][])('sums up the hand: %j', (last, title, text) => {
    const { $, status } = setup(over(last));
    expect($('.overlay h2').textContent).toBe(title);
    expect(status()).toBe(text);
  });

  it('ends the game', () => {
    const r: Result = { kind: 'knock', knocker: 0, winner: 0, points: 20, deadwood: [3, 23], melds: [[], []] };
    const won = setup({ ...over(r), phase: 'gameOver', scores: [105, 30] });
    expect(won.$('.overlay h2').textContent).toBe('You win!');
    expect(won.status()).toMatch(/First to 100: you win!$/);
    won.$('.overlay .btn').click();
    expect(won.stored().scores).toEqual([0, 0]);
    document.body.replaceChildren();
    const lost = setup({ ...over({ ...r, knocker: 1, winner: 1 }), phase: 'gameOver', scores: [30, 101] });
    expect(lost.$('.overlay h2').textContent).toBe('The computer wins');
    expect(lost.status()).toMatch(/the computer wins\.$/);
  });

  it('switches Easy and Strong, ignores stray taps, and stops when closed', () => {
    const { $, stored, unmount } = setup(position([MINE, THEIRS], '5S', { turn: 1 }));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    $('[data-board]').click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(stored().turn).toBe(1);
    expect(setup({ hands: 'x' }).$$('[data-hand]')).toHaveLength(10);
  });
});

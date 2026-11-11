import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import type { State } from './logic';
import { newDeck } from '../../core/cards';
import { cards, position } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('crazyeights:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('crazyeights:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const recent = () => $$('[data-recent] li').map((li) => li.textContent).reverse();
  const tap = (id: string) => $(`[data-hand][data-card="${id}"]`).click();
  return { container, unmount, $, $$, stored, status, recent, tap };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Crazy eights screen', () => {
  it('shows the table and what you can play', () => {
    const { $, $$, status } = setup(position(['7H 2C 8D KS', 'AC 2D', 'AD', 'AH'], '7S'));
    expect($('[data-seat="1"] .tt-info').textContent!.replace(/\s+/g, ' ')).toBe('2 left · 0 pts');
    expect($('[data-seat="0"] .tt-info').textContent!.replace(/\s+/g, ' ')).toBe('4 left · 0 pts');
    expect($$('[data-hand]:not([disabled])').map((c) => c.dataset.card)).toEqual(['8D', 'KS', '7H']);
    expect(status()).toBe('Your turn: play a spade or a 7, or an 8.');
  });

  it('plays a card, then the computer players take their turns', () => {
    const { stored, status, recent, tap, $ } = setup(position(['7H 2C', '3H 9C', '4H 9D', '5H 9S'], '7S'));
    tap('7H');
    expect(stored().turn).toBe(1);
    expect($('[data-seat="0"] .tt-play .card').dataset.card).toBe('7H');
    expect(recent()).toEqual(['You played the 7 of hearts.']);
    expect(status()).toBe('West is playing…');
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(stored().turn).toBe(0);
    expect(recent()).toHaveLength(4);
    expect(recent().slice(1).map((l) => l!.split(' ')[0])).toEqual(['West', 'North', 'East']);
  });

  it('plays an 8 after you name the suit', () => {
    const { $, $$, stored, status, tap } = setup(position(['8D 2C', '3H', '4H', '5H'], '7S'));
    tap('8D');
    expect(status()).toBe('Name the next suit.');
    expect($$('[data-suit]').map((b) => b.getAttribute('aria-label'))).toEqual(['Spades', 'Hearts', 'Diamonds', 'Clubs']);
    tap('8D'); // tap again to change your mind
    expect($('[data-suit]')).toBeNull();
    tap('8D');
    $('[data-suit="C"]').click();
    expect(stored().suit).toBe('C');
    expect($$('[data-recent] li').map((li) => li.textContent).reverse()).toEqual(['You played the 8 of diamonds: clubs now.']);
    expect($('.ce-suit').textContent).toContain('Clubs');
  });

  it('draws when you can’t play, and passes when the deck is empty', () => {
    const drawing = setup(position(['2C', '3H', '4H', '5H'], '7S'));
    expect(drawing.status()).toBe('You have nothing to play on the 7 of spades. Draw a card.');
    drawing.$('[data-actions] [data-draw]').click();
    expect(drawing.stored().hands[0]).toHaveLength(2);
    expect(drawing.recent()).toEqual([expect.stringMatching(/^You drew the .+ of .+\.$/)]);
    drawing.$('[data-level="easy"]').click(); // not a move
    expect(drawing.recent()).toHaveLength(1);
    document.body.replaceChildren();

    const deck = setup(position(['2C', '3H', '4H', '5H'], 'AS'));
    expect(deck.status()).toBe('You have nothing to play on the ace of spades. Draw a card.');
    deck.$('.ce-pile [data-draw]').click();
    expect(deck.stored().hands[0]).toHaveLength(2);
    document.body.replaceChildren();

    // Every other card is in North's hand, so there's truly nothing left to draw.
    const rest = newDeck().filter((c) => !(c.rank === 2 && c.suit === 'C') && !(c.rank === 12 && c.suit === 'S') && c.rank !== 8 && c.suit !== 'S');
    const stuckState = { ...position(['2C', '', '', ''], 'QS', { stock: [] }) };
    stuckState.hands = [cards('2C'), newDeck().filter((c) => c.rank === 8 || (c.suit === 'S' && c.rank !== 12)), rest, []];
    const stuck = setup(stuckState);
    expect(stuck.status()).toBe('You can’t play and the deck is empty: tap Pass.');
    stuck.$('[data-pass]').click();
    expect(stuck.stored().turn).toBe(1);
    expect(stuck.recent().at(-1)).toBe('You passed.');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stuck.recent().at(-1)).toMatch(/^West (played|drew)/);
  });

  it('says which suit to follow after an 8', () => {
    const s = position(['2C', '3H', '4H', '5H'], '7S 8H', { suit: 'D' });
    expect(setup(s).$('.ce-suit').classList.contains('red')).toBe(true);
    document.body.replaceChildren();
    const black = position(['2D', '3H', '4H', '5H'], '7S 8H', { suit: 'C' });
    expect(setup(black).status()).toBe('You have nothing to play on the 8 of hearts. Draw a card.');
    document.body.replaceChildren();
    expect(setup(position(['2C', '3H', '4H', '5H'], '7S 8H', { suit: 'C' })).status()).toBe('Your turn: play a club, or an 8.');
    document.body.replaceChildren();
    expect(setup(position(['2C QS', '3H', '4H', '5H'], 'QH')).status()).toBe('Your turn: play a heart or a queen, or an 8.');
  });

  it('ends a round and the game', () => {
    const round = setup(position(['7H', '8C KD', '2S', 'AH'], '7S'));
    round.tap('7H');
    expect(round.$('.overlay h2').textContent).toBe('You win the round!');
    expect(round.status()).toBe('You played the last card and score 63 for the cards left in the other hands.');
    expect(round.recent()).toEqual(['You played the 7 of hearts.']);
    round.$('.overlay .btn').click();
    expect(round.stored().phase).toBe('playing');
    expect(round.recent()).toEqual([]); // each round starts a new list
    document.body.replaceChildren();

    const lost = { ...position(['7H', '', '2S', 'AH'], '7S'), phase: 'gameOver' as const, last: { seat: 1 as const, points: 40 }, scores: [10, 120, 0, 0] };
    const over = setup(lost);
    expect(over.$('.overlay h2').textContent).toBe('West wins');
    expect(over.status()).toBe('West played the last card and scores 40 for the cards left in the other hands.');
    over.$('.overlay .btn').click();
    expect(over.stored().scores).toEqual([0, 0, 0, 0]);
    document.body.replaceChildren();

    const lostRound = { ...position(['7H', '', '2S', 'AH'], '7S'), phase: 'roundOver' as const, last: { seat: 2 as const, points: 9 } };
    expect(setup(lostRound).$('.overlay h2').textContent).toBe('North wins the round');
    document.body.replaceChildren();
    const won = { ...position(['', '2C', '2S', 'AH'], '7S'), phase: 'gameOver' as const, last: { seat: 0 as const, points: 30 }, scores: [110, 0, 0, 0] };
    expect(setup(won).$('.overlay h2').textContent).toBe('You win!');
  });

  it('switches Easy and Strong, ignores stray taps, and stops when closed', () => {
    const { $, stored, unmount } = setup(position(['2C', cards('3H').length ? '3H' : '', '4H', '5H'], '7S', { turn: 1 }));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    $('[data-board]').click();
    $('[data-actions]').click();
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(stored().turn).toBe(1);
    $('[data-new]')?.click();
    expect(setup({ hands: 2 }).$$('[data-hand]')).toHaveLength(5);
  });
});

describe('Crazy eights colors', () => {
  const t = themes(css, '.ce');
  const app = themes(appCss, ':root');
  it.each([
    ['light', t.light, app.light],
    ['dark', t.dark, app.dark],
  ])('red suit shapes stand out in the %s theme (3:1)', (_n, c, a) => {
    expect(contrast(c['ce-red'], a.board)).toBeGreaterThanOrEqual(3);
    expect(contrast(c['ce-red'], a.surface)).toBeGreaterThanOrEqual(3);
  });
});

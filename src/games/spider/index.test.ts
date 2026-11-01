import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card, Suit } from '../../core/cards';
import { load, save } from '../../core/storage';
import { answerNewGame, makeContainer, setHidden, track } from '../../test/helpers';
import { mount } from './index';
import { newGame, spiderDeck, type State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('spider:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('spider:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, stored, status };
}

/** One suit, everything finished except a King-to-2 run in column 0 and the ace in column 1. */
function oneMoveFromWinning(): State {
  const king2 = Array.from({ length: 12 }, (_, i): Card => ({ suit: 'S', rank: 13 - i }));
  const tableau = Array.from({ length: 10 }, (_, i) => ({ down: [], up: i === 0 ? king2 : i === 1 ? [{ suit: 'S' as Suit, rank: 1 }] : [] }));
  return { suits: 1, stock: [], tableau, done: ['S', 'S', 'S', 'S', 'S', 'S', 'S'], moves: 5, elapsed: 0, won: false };
}

/**
 * A real 4-suit game whose top cards are eight kings, a jack and a 9: nothing can move,
 * so the deck is the only play.
 */
function blocked(): State {
  const tops: Card[] = [...(['S', 'H', 'D', 'C'] as Suit[]).flatMap((suit) => [{ suit, rank: 13 }, { suit, rank: 13 }]), { suit: 'S', rank: 11 }, { suit: 'S', rank: 9 }];
  const rest = spiderDeck(4);
  for (const t of tops) rest.splice(rest.findIndex((c) => c.suit === t.suit && c.rank === t.rank), 1);
  const stock = rest.splice(0, 50);
  const tableau = tops.map((top, i) => ({ down: rest.splice(0, i < 4 ? 5 : 4), up: [top] }));
  return { suits: 4, stock, tableau, done: [], moves: 3, elapsed: 0, won: false };
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

describe('Spider Solitaire screen', () => {
  it('deals ten columns, the deck and eight empty places for runs', () => {
    const { $, status, container } = setup();
    expect(container.querySelectorAll('.sp-col')).toHaveLength(10);
    expect(container.querySelectorAll('.sp-done > *')).toHaveLength(8);
    expect($('[data-deal]').getAttribute('aria-label')).toBe('Deal a card onto every column, 5 deals left');
    expect($('[data-suits="1"]').getAttribute('aria-pressed')).toBe('true');
    expect(status()).toMatch(/^Build runs from King down to Ace/);
  });

  it('deals from the deck, undoes it, and explains a refused tap', () => {
    const { $, stored, status } = setup(newGame(1));
    $<HTMLElement>('[data-deal]').click();
    expect(stored().stock).toHaveLength(40);
    $<HTMLButtonElement>('[data-undo]').click();
    expect(stored().stock).toHaveLength(50);
    const t = setup(blocked());
    t.$<HTMLElement>('[data-src="0:0"]').click();
    expect(t.status()).toMatch(/^That can’t move/);
    expect(status()).toMatch(/^Build runs/);
  });

  it('wins when the last run is finished, and keeps a best time', () => {
    const { $, stored, status } = setup(oneMoveFromWinning());
    $<HTMLElement>('[data-src="1:0"]').click();
    expect(stored().won).toBe(true);
    expect(status()).toMatch(/^You won/);
    expect(load<Record<string, number>>('spider:best', {})[1]).toBe(0);
    expect($('.overlay h2').textContent).toBe('You win!');
    $<HTMLButtonElement>('.overlay .btn').click();
    expect(stored().done).toEqual([]);
  });

  it('Hint outlines a move and names it, or the deck', () => {
    const { $, status } = setup(oneMoveFromWinning());
    $<HTMLButtonElement>('[data-hint]').click();
    expect(status()).toBe('Hint: move the ace of spades onto the 2 of spades.');
    expect($('[data-src="1:0"]').classList.contains('hint')).toBe(true);
    const d = setup(blocked());
    d.$<HTMLButtonElement>('[data-hint]').click();
    expect(d.status()).toBe('Hint: tap the deck to deal a card onto every column.');
    expect(d.$('[data-deal]').classList.contains('hint')).toBe(true);
  });

  it('switches suits (asking first mid-game), and New starts over', () => {
    const { $, stored } = setup();
    $<HTMLButtonElement>('[data-suits="4"]').click(); // nothing played yet: no question
    expect(stored().suits).toBe(4);
    $<HTMLElement>('[data-deal]').click();
    $<HTMLButtonElement>('[data-new]').click();
    answerNewGame();
    expect(stored()).toMatchObject({ suits: 4, moves: 0 });
    expect(new Set(spiderDeck(4).map((c) => c.suit)).size).toBe(4);
  });
});

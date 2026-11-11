import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../core/storage';
import { answerNewGame, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import type { State } from './logic';
import { table } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('drawpoker:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('drawpoker:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const buttons = () => $$('[data-actions] button').map((b) => b.textContent);
  const tap = (id: string) => $(`[data-hand][data-card="${id}"]`).click();
  const recent = () => $$('[data-recent] li').map((li) => li.textContent).reverse();
  return { container, unmount, $, $$, stored, status, buttons, tap, recent };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Five-card draw screen', () => {
  it('shows the seats, your hand and what you can do', () => {
    const { $, $$, status, buttons } = setup(table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', ''], { said: ['', 'Check', '', ''] }));
    expect($('[data-seat="1"] .tt-info').textContent).toBe('1000Check');
    expect($('[data-seat="3"] .tt-name').textContent).toBe('East D');
    expect($$('[data-seat="1"] .dp-fan .back')).toHaveLength(5);
    expect($$('.dp-hand .card').map((c) => c.dataset.card)).toEqual(['AS', 'AH', '2C', '3D', '9S']);
    expect($$('.dp-hand .card:disabled')).toHaveLength(5); // not the draw yet
    expect($$('.dp-info')[0].textContent).toBe('Hand 1 · blinds 5 and 10');
    expect($$('.dp-info')[1].textContent).toBe('You have: pair of aces');
    expect(buttons()).toEqual(['Check', 'Bet']);
    expect(status()).toBe('Before the draw, your turn: check or bet 10.');
  });

  it('picks up to three cards to swap, then draws', () => {
    const s = table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', ''], { phase: 'drawing', toAct: [false, false, false, false] }, 'AD AC 6H 8H');
    const { $, $$, stored, status, buttons, tap, recent } = setup(s);
    expect(status()).toBe('The draw: tap up to 3 cards to swap, or tap Stand pat to keep them all.');
    expect(buttons()).toEqual(['Stand pat']);
    tap('2C');
    expect(status()).toBe('Tap Swap to trade that card for new ones, or tap a card again to keep it.');
    tap('3D');
    tap('9S');
    tap('AS'); // a fourth is ignored
    expect($$('.dp-mark').map((m) => m.textContent)).toEqual(['', '', 'Swap', 'Swap', 'Swap']);
    expect($('[data-card="2C"]').getAttribute('aria-pressed')).toBe('true');
    tap('9S'); // changed your mind
    expect(buttons()).toEqual(['Swap 2']);
    expect(status()).toBe('Tap Swap to trade those 2 cards for new ones, or tap a card again to keep it.');
    $('[data-swap]').click();
    expect(stored().hands[0]).toHaveLength(5);
    expect(stored().said[0]).toBe('Drew 2');
    expect(recent()).toEqual(['You drew 2 cards.']);
    expect(status()).toBe('The draw: West is choosing cards…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(recent()[1]).toMatch(/^West (drew [123] cards?|kept all five cards)\.$/);
    expect(stored().phase).toBe('betting');
    expect(stored().round).toBe(1);
  });

  it('bets, then the computer players take their turns', () => {
    const s = table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', ''], { round: 1, bets: [0, 20, 0, 0], put: [0, 20, 0, 0], stacks: [1000, 980, 1000, 1000], raises: 1 });
    const { $, stored, status, buttons, recent } = setup(s);
    expect(buttons()).toEqual(['Fold', 'Call', 'Raise']);
    expect(status()).toBe('After the draw, your turn: call 20, raise 40 or fold.');
    $('[data-action="raise"]').click();
    expect(recent()).toEqual(['You raised 40.']);
    expect(status()).toBe('After the draw: West is thinking…');
    const before = JSON.stringify(stored());
    vi.advanceTimersByTime(AI_DELAY);
    expect(JSON.stringify(stored())).not.toBe(before);
  });

  it('says when a call goes all in', () => {
    const s = table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', ''], { bets: [0, 20, 0, 0], put: [995, 10, 0, 0], stacks: [5, 990, 1000, 1000], raises: 1 });
    expect(setup(s).status()).toBe('Before the draw, your turn: call 5 (all in) or fold.');
  });

  it('shows everyone’s hand at a showdown, and describes the pots', () => {
    const over = (o: Partial<State>) =>
      setup({ ...table(['AS AH AD 3D 9S', 'KS KH 4C 5D 7S', '', '']), phase: 'handOver', put: [0, 0, 0, 0], ...o });
    const shown = over({ shown: true, pots: [{ amount: 20, eligible: [0, 1], winners: [0] }] });
    expect(shown.status()).toBe('You win the pot of 20 with three aces.');
    expect(shown.$('[data-seat="1"] .tt-info').textContent).toBe('1000Pair');
    expect(shown.$('[data-seat="1"] .dp-fan').getAttribute('aria-label')).toBe('West’s cards: King of spades, King of hearts, 4 of clubs, 5 of diamonds, 7 of spades, pair of kings');
    expect(shown.buttons()).toEqual(['Next hand']);
    shown.$('[data-next]').click();
    expect(shown.stored().hand).toBe(2);
    expect(shown.recent()).toEqual([]); // a new list each hand
    document.body.replaceChildren();
    expect(over({ shown: true, pots: [{ amount: 30, eligible: [0, 1], winners: [0, 1] }, { amount: 10, eligible: [1], winners: [1] }] }).status()).toBe(
      'You and West split the main pot of 30 with three aces. West wins a side pot of 10 with pair of kings.',
    );
    document.body.replaceChildren();
    expect(over({ shown: false, pots: [{ amount: 15, eligible: [1], winners: [1] }], live: [false, true, false, false] }).status()).toBe('Everyone else folded. West wins the pot of 15.');
  });

  it('ends the game when you run out or win every chip', () => {
    const lost = setup({ ...table(['7S 2H 3C 4D 9S', 'AS AH AD AC 9H', '', '']), phase: 'gameOver', stacks: [0, 2000, 1000, 1000], put: [0, 0, 0, 0], pots: [{ amount: 10, eligible: [1], winners: [1] }] });
    expect(lost.$('.overlay h2').textContent).toBe('You’re out of chips');
    expect(lost.$('[data-seat="0"] .tt-info').textContent).toBe('Out');
    lost.$('.overlay .btn').click();
    expect(lost.stored().hand).toBe(1);
    document.body.replaceChildren();
    const won = setup({ ...table(['AS AH AD AC 9H', '7S 2H 3C 4D 9S', '', '']), phase: 'gameOver', stacks: [4000, 0, 0, 0], put: [0, 0, 0, 0], pots: [{ amount: 10, eligible: [0], winners: [0] }] });
    expect(won.$('.overlay h2').textContent).toBe('You win every chip!');
  });

  it('asks before abandoning a game, switches level, and stops when closed', () => {
    const fresh = setup(table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', '']));
    fresh.$('[data-new]').click();
    expect(fresh.stored().hand).toBe(1);
    fresh.$('[data-level="easy"]').click();
    expect(fresh.stored().level).toBe('easy');
    fresh.$('[data-board]').click(); // not the draw: nothing happens
    fresh.unmount();
    document.body.replaceChildren();

    const mid = setup(table(['AS AH 2C 3D 9S', 'KS KH 4C 5D 7S', '', ''], { hand: 3, turn: 1 }));
    mid.unmount();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(mid.stored().turn).toBe(1);
    document.body.replaceChildren();
    const again = setup(mid.stored());
    again.$('[data-new]').click();
    answerNewGame();
    expect(again.stored().hand).toBe(1);
    again.$('[data-actions]').click();
    document.body.replaceChildren();
    expect(setup({ hand: 'x' }).$$('[data-seat]')).toHaveLength(4);
  });
});

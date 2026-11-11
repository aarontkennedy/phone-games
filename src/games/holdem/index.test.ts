import { beforeEach, describe, expect, it, vi } from 'vitest';
import { betText } from '../../core/betting';
import { load, save } from '../../core/storage';
import { answerNewGame, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import type { State } from './logic';
import { table } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('holdem:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('holdem:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const buttons = () => $$('[data-actions] button').map((b) => b.textContent);
  const recent = () => $$('[data-recent] li').map((li) => li.textContent).reverse();
  return { container, unmount, $, $$, stored, status, buttons, recent };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("Hold'em screen", () => {
  it('shows the seats, the shared cards and your hand', () => {
    const { $, $$, status, buttons } = setup(table(['AS AH', 'KS KH', '7C 2D', ''], '2C 3C 4C', { said: ['', 'Check', '', ''], stacks: [1000, 1000, 1000, 1000] }));
    expect($('[data-seat="0"] .tt-info').textContent!.trim()).toBe('1000');
    expect($('[data-seat="1"] .tt-info').textContent).toBe('1000Check');
    expect($('[data-seat="3"] .tt-name').textContent).toBe('East D');
    expect($$('[data-seat="0"] .he-hole .card').map((c) => c.getAttribute('aria-label'))).toEqual(['Ace of spades', 'Ace of hearts']);
    expect($$('[data-seat="1"] .he-hole .back')).toHaveLength(2); // the computer's cards stay hidden
    expect($$('[data-seat="3"] .he-hole .card')).toHaveLength(0);
    expect($$('.he-board .card')).toHaveLength(3);
    expect($$('.he-info')[0].textContent).toBe('Hand 1 · blinds 5 and 10');
    expect($$('.he-info')[1].textContent).toBe('You have: pair of aces');
    expect(buttons()).toEqual(['Check', 'Bet']);
    expect(status()).toBe('The flop, your turn: check or bet 10.');
  });

  it('names your two cards before the flop', () => {
    expect(setup(table(['AS KH', 'KS KD', '', ''], '')).$$('.he-info')[1].textContent).toBe('You have: ace high');
    document.body.replaceChildren();
    expect(setup(table(['9S 9H', 'KS KD', '', ''], '')).$$('.he-info')[1].textContent).toBe('You have: pair of nines');
    document.body.replaceChildren();
    expect(setup(table(['9S 2H', 'KS KD', '', ''], '')).$$('.he-info')[1].textContent).toBe('You have: nine high');
  });

  it('acts, then the computer players take their turns', () => {
    const s = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C', { bets: [0, 10, 0, 0], put: [0, 10, 0, 0], stacks: [1000, 990, 1000, 1000], raises: 1 });
    const { $, stored, status, buttons, recent } = setup(s);
    expect(buttons()).toEqual(['Fold', 'Call', 'Raise']);
    expect(status()).toBe('The flop, your turn: call 10, raise 20 or fold.');
    $('[data-action="raise"]').click();
    expect(stored().bets[0]).toBe(20);
    expect(recent()).toEqual(['You raised 20.']);
    expect(status()).toBe('The flop: West is thinking…');
    expect($('[data-seat="1"]').classList.contains('turn')).toBe(true);
    const before = JSON.stringify(stored());
    vi.advanceTimersByTime(AI_DELAY);
    expect(JSON.stringify(stored())).not.toBe(before); // West acted
    expect(recent()[1]).toMatch(/^West (folded|called 10|raised 20)\.$/);
  });

  it('says each action and each new street in the recent moves list', () => {
    const s = table(['AS AH', 'KS KH', '', ''], '', { bets: [10, 10, 0, 0], put: [10, 10, 0, 0], stacks: [990, 990, 1000, 1000], toAct: [true, false, false, false] });
    const { $, stored, recent } = setup(s);
    $('[data-action="check"]').click();
    expect(stored().street).toBe(1);
    expect(recent()).toEqual(['You checked.', 'The flop is dealt.']);
    $('[data-level="easy"]').click(); // not a move
    expect(recent()).toHaveLength(2);

    const t = table(['AS AH', 'KS KH', '7C 2D', ''], '', { bets: [0, 20, 0, 0], put: [0, 20, 0, 0], stacks: [1000, 980, 15, 1000] });
    expect(betText(t, 0, 'fold', 10, 'You')).toBe('You folded.');
    expect(betText(t, 0, 'call', 10, 'You')).toBe('You called 20.');
    expect(betText(t, 0, 'raise', 10, 'You')).toBe('You raised 30.');
    expect(betText(t, 2, 'call', 10, 'North')).toBe('North called 15, all in.');
    expect(betText({ ...t, bets: [0, 0, 0, 0] }, 3, 'bet', 10, 'East')).toBe('East bet 10.');
  });

  it('says when a call goes all in', () => {
    const s = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C', { bets: [0, 20, 0, 0], put: [995, 10, 0, 0], stacks: [5, 990, 1000, 1000], raises: 1 });
    expect(setup(s).status()).toBe('The flop, your turn: call 5 (all in) or fold.');
  });

  it('shows the winner and the cards at a showdown, then deals the next hand', () => {
    const s = table(['AS AH', 'KS KH', '', ''], '2C 3C 4C 8D 9H', { stacks: [990, 990, 1010, 1010], put: [10, 10, 0, 0], turn: 1, toAct: [false, true, false, false] });
    const { $, $$, stored, status, buttons } = setup(s);
    vi.advanceTimersByTime(AI_DELAY);
    const shown = stored();
    if (shown.phase === 'handOver') {
      expect(buttons()).toEqual(['Next hand']);
      expect($$('[data-seat="1"] .he-hole .card')).toHaveLength(shown.shown ? 2 : 0);
      expect(status()).toMatch(/^(You win the pot of \d+|Everyone else folded)/);
      $('[data-next]').click();
      expect(stored().hand).toBe(2);
      expect($$('[data-recent] li')).toHaveLength(0); // a new list each hand
    }
  });

  it('describes split pots, side pots and folds', () => {
    const over = (o: Partial<State>, hole = ['AS 7H', 'AD 7C', '', '']) =>
      setup({ ...table(hole, 'KC QC JD 10D 2S'), phase: 'handOver', put: [0, 0, 0, 0], ...o }).status();
    expect(over({ shown: true, pots: [{ amount: 20, eligible: [0, 1], winners: [0, 1] }] })).toBe('You and West split the pot of 20 with straight to the ace.');
    document.body.replaceChildren();
    expect(over({ shown: true, pots: [{ amount: 30, eligible: [0, 1], winners: [1] }, { amount: 10, eligible: [1], winners: [1] }] })).toBe(
      'West wins the main pot of 30 with straight to the ace. West wins a side pot of 10 with straight to the ace.',
    );
    document.body.replaceChildren();
    expect(over({ shown: false, pots: [{ amount: 15, eligible: [2], winners: [2] }], live: [false, false, true, false] })).toBe('Everyone else folded. North wins the pot of 15.');
  });

  it('ends the game when you run out or win every chip', () => {
    const lost = setup({ ...table(['7S 2H', 'AS AH', '', '']), phase: 'gameOver', stacks: [0, 2000, 1000, 1000], put: [0, 0, 0, 0], pots: [{ amount: 10, eligible: [1], winners: [1] }] });
    expect(lost.$('.overlay h2').textContent).toBe('You’re out of chips');
    expect(lost.$('[data-seat="0"] .tt-info').textContent).toBe('Out');
    lost.$('.overlay .btn').click();
    expect(lost.stored().stacks.reduce((a, b) => a + b, 0) + lost.stored().put.reduce((a, b) => a + b, 0)).toBe(4000);
    document.body.replaceChildren();
    const won = setup({ ...table(['AS AH', '7S 2H', '', '']), phase: 'gameOver', stacks: [4000, 0, 0, 0], put: [0, 0, 0, 0], pots: [{ amount: 10, eligible: [0], winners: [0] }] });
    expect(won.$('.overlay h2').textContent).toBe('You win every chip!');
  });

  it('asks before abandoning a game, switches level, and stops when closed', () => {
    const fresh = setup(table(['AS AH', 'KS KH', '', '']));
    fresh.$('[data-new]').click(); // nothing has happened: a new game at once
    expect(fresh.stored().hand).toBe(1);
    fresh.$('[data-level="easy"]').click();
    expect(fresh.stored().level).toBe('easy');
    fresh.unmount();
    document.body.replaceChildren();

    const mid = setup(table(['AS AH', 'KS KH', '', ''], '', { hand: 3, turn: 1 }));
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

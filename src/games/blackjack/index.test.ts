import { beforeEach, describe, expect, it } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import type { State } from './logic';
import { stacked } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('blackjack:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = (sel: string) => [...container.querySelectorAll<HTMLElement>(sel)];
  const stored = () => load<State>('blackjack:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const labels = () => $$('.bj-label').map((l) => l.textContent!.replace(/\s+/g, ' ').trim());
  const press = (sel: string) => $(sel).click();
  return { container, unmount, $, $$, stored, status, labels, press };
}

/** Sets up a table whose next deal is `order` (you, dealer up, you, dealer hole, draws...). */
const table = (order: string, overrides: Partial<State> = {}) => setup(stacked(order, overrides));

beforeEach(() => {
  localStorage.clear();
});

describe('Blackjack screen', () => {
  it('starts at an empty table, ready to bet', () => {
    const { $, $$, status, labels } = setup();
    expect($('[data-deal]').textContent).toBe('Deal');
    expect($('[data-chips]').textContent).toBe('1000');
    expect($('[data-best]').textContent).toBe('1000');
    expect($('[data-bet="20"]').getAttribute('aria-pressed')).toBe('true');
    expect($$('.bj-table .card-slot')).toHaveLength(4);
    expect(labels()).toEqual(['Dealer', 'You']);
    expect(status()).toBe('Choose a bet and tap Deal. Blackjack pays 3 to 2.');
  });

  it('changes the bet, and disables bets you can’t cover', () => {
    const { $, press, stored } = table('9H 7S 8C 10D', { chips: 30 });
    press('[data-bet="10"]');
    expect(stored().bet).toBe(10);
    expect($('[data-bet="10"]').getAttribute('aria-pressed')).toBe('true');
    expect($<HTMLButtonElement>('[data-bet="50"]').disabled).toBe(true);

    const fifty = $<HTMLButtonElement>('[data-bet="50"]');
    fifty.disabled = false; // even if tapped, the rules refuse it
    fifty.click();
    expect(stored().bet).toBe(10);
  });

  it('deals with the dealer’s second card face down', () => {
    const { $, $$, labels, press, status } = table('9H 7S 8C 10D');
    press('[data-deal]');
    expect(labels()).toEqual(['Dealer shows 7', 'You 17 Bet 20']);
    expect($$('.bj-table .card.back')).toHaveLength(1);
    expect($<HTMLButtonElement>('[data-deal]').disabled).toBe(true);
    expect($$('[data-action]').map((b) => b.textContent)).toEqual(['Hit', 'Stand', 'Double', 'Split']);
    expect($<HTMLButtonElement>('[data-action="split"]').disabled).toBe(true);
    expect($('.bj-hand.active')).not.toBeNull();
    expect(status()).toBe('Hit to take a card, or stand to keep your total.');
  });

  it('names an ace and soft totals', () => {
    const { labels, press } = table('AH AS 6C 7D');
    press('[data-deal]');
    expect(labels()).toEqual(['Dealer shows an ace', 'You Soft 17 Bet 20']);
  });

  it('plays out a win when the dealer busts, and raises the best', () => {
    const { $, labels, press, status } = table('10H 6S 7C 10D KC');
    press('[data-deal]');
    press('[data-action="stand"]');
    expect(labels()).toEqual(['Dealer Bust', 'You 17 Bet 20 +20']);
    expect($('.bj-result').classList.contains('won')).toBe(true);
    expect(status()).toBe('Dealer busts. You win 20.');
    expect($('[data-chips]').textContent).toBe('1020');
    expect($('[data-best]').textContent).toBe('1020');
    expect(load('blackjack:best', 0)).toBe(1020);
    expect($('[data-deal]').textContent).toBe('Deal');
  });

  it('shows a loss, a push and a blackjack', () => {
    const lose = table('10H 10S 6C 9D KH');
    lose.press('[data-deal]');
    lose.press('[data-action="hit"]');
    expect(lose.status()).toBe('You lose 20.');
    expect(lose.labels()[1]).toBe('You Bust Bet 20 -20');
    document.body.replaceChildren();

    const push = table('10H 10S 7C 7D');
    push.press('[data-deal]');
    push.press('[data-action="stand"]');
    expect(push.status()).toBe('Push: your bet comes back.');
    expect(push.labels()[1]).toBe('You 17 Bet 20 Push');
    document.body.replaceChildren();

    const bj = table('AH 7S KC 9D');
    bj.press('[data-deal]');
    expect(bj.status()).toBe('Blackjack! You win 30.');
    expect(bj.labels()).toEqual(['Dealer 16', 'You Blackjack Bet 20 +30']);
  });

  it('greys out Double after a hit', () => {
    const { $, press } = table('2H 7S 3C 10D 4H');
    press('[data-deal]');
    press('[data-action="hit"]');
    expect($<HTMLButtonElement>('[data-action="double"]').disabled).toBe(true);
  });

  it('splits into two hands and marks the one being played', () => {
    const { $$, labels, press } = table('8H 10S 8C 7D 3H 2C');
    press('[data-deal]');
    press('[data-action="split"]');
    expect(labels().slice(1)).toEqual(['Hand 1 11 Bet 20', 'Hand 2 10 Bet 20']);
    expect($$('.bj-hand').indexOf($$('.bj-hand.active')[0])).toBe(1);
    press('[data-action="stand"]');
    expect($$('.bj-hand').indexOf($$('.bj-hand.active')[0])).toBe(2);
  });

  it('gives hints when they are turned on, and remembers the setting', () => {
    const { $, press, status } = table('10H 6S 7C 10D');
    press('[data-hints]');
    expect($('[data-hints]').getAttribute('aria-pressed')).toBe('true');
    expect(load('blackjack:hints', false)).toBe(true);
    press('[data-deal]');
    expect(status()).toBe('Hint: the best play here is to stand.');
  });

  it('offers Start over when out of chips', () => {
    const { $, press, status, stored } = table('10H 7S 6C 10D KH', { chips: 10, bet: 10 });
    press('[data-deal]');
    press('[data-action="hit"]');
    expect(status()).toBe("You lose 10. You're out of chips. Tap Start over for 1000 more.");
    expect($('[data-deal]').textContent).toBe('Start over');
    press('[data-deal]');
    expect(stored().chips).toBe(1000);
    expect(stored().phase).toBe('betting');
  });

  it('ignores taps between the buttons', () => {
    const { $, stored } = table('9H 7S 8C 10D');
    $('[data-controls]').click();
    expect(stored().phase).toBe('betting');
  });

  it('restores a hand in progress, and ignores a broken save', () => {
    const first = table('9H 7S 8C 10D');
    first.press('[data-deal]');
    first.unmount();
    document.body.replaceChildren();
    const again = setup();
    expect(again.labels()).toEqual(['Dealer shows 7', 'You 17 Bet 20']);
    document.body.replaceChildren();

    const broken = setup({ chips: 'lots' });
    expect(broken.$('[data-chips]').textContent).toBe('1000');
  });

  it('cleans up when closed', () => {
    const { container, unmount } = setup();
    unmount();
    expect(container.children).toHaveLength(0);
  });
});

describe('Blackjack colors', () => {
  const bj = themes(css, '.bj');
  const app = themes(appCss, ':root');

  it.each([
    ['light', bj.light, app.light],
    ['dark', bj.dark, app.dark],
  ])('table text is readable in the %s theme (4.5:1)', (_name, t, a) => {
    expect(contrast(t['bj-won'], a.board), 'win amount').toBeGreaterThanOrEqual(4.5);
    expect(contrast(a.muted, a.board), 'bet amount').toBeGreaterThanOrEqual(4.5);
    expect(contrast(a.text, a.board), 'labels').toBeGreaterThanOrEqual(4.5);
  });
});

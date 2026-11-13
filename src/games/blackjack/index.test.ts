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
    const { container, $, $$, labels, press, status } = table('9H 7S 8C 10D');
    press('[data-deal]');
    expect(labels()).toEqual(['Dealer shows 7', 'You 17 Bet 20']);
    expect($$('.bj-table .card.back')).toHaveLength(1);
    expect(container.querySelector('[data-deal]')).toBeNull(); // the play buttons replace it
    expect($$('[data-action]').map((b) => b.textContent)).toEqual(['Hit', 'Stand', 'Double', 'Split']);
    expect($<HTMLButtonElement>('[data-action="split"]').disabled).toBe(true);
    expect($('.bj-hand.active')).not.toBeNull();
    expect(status()).toBe('Hit for another card, or stand.');
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

  it('shows a hint above the buttons only when you ask, for that decision only', () => {
    const { $, press, status, container } = table('10H 2S 2C 10D 3H');
    expect(container.querySelector('[data-hint]')).toBeNull(); // nothing to advise while betting
    press('[data-deal]');
    expect(status()).toBe('Hit for another card, or stand.');
    press('[data-hint]');
    expect($('[data-tip]').textContent).toBe('Best play: Hit');
    expect(status()).toBe('Hit for another card, or stand.'); // the instructions stay
    press('[data-action="hit"]');
    expect(container.querySelector('[data-tip]')).toBeNull(); // ask again for the next one
    expect($('[data-hint]').textContent).toBe('Hint');
  });

  it('scores each play against the best one, and says what was best after a miss', () => {
    const { $, press, status } = table('10H 2S 2C 10D 3H 10C'); // 12 vs 2: hit
    expect($('[data-accuracy]').textContent).toBe('–');
    press('[data-deal]');
    press('[data-action="stand"]');
    expect(status()).toMatch(/ Best was to hit\.$/);
    expect($('[data-accuracy]').textContent).toBe('0%');
    expect(load('blackjack:accuracy', null)).toEqual({ right: 0, plays: 1 });
    press('[data-deal]');
    expect(status()).toBe('Hit for another card, or stand.'); // a new hand, a clean slate
  });

  it('counts a right play, keeps the lesson in view mid-hand, and skips plays made after a hint', () => {
    save('blackjack:accuracy', { right: 3, plays: 3 });
    const { $, press, status } = table('10H 7S 2C 10D 2H 2D 9C'); // 12 vs 7: hit
    expect($('[data-accuracy]').textContent).toBe('100%');
    press('[data-deal]');
    press('[data-action="hit"]'); // right: 14 vs 7, hit again
    expect($('[data-accuracy]').textContent).toBe('100%');
    press('[data-hint]');
    press('[data-action="stand"]'); // looked first: not counted
    expect(load('blackjack:accuracy', null)).toEqual({ right: 4, plays: 4 });
    expect(status()).not.toMatch(/Best was/);

    const again = table('10H 7S 2C 10D 2H 2D 9C');
    again.press('[data-deal]');
    again.press('[data-action="double"]'); // wrong: 12 vs 7 hits
    expect(load('blackjack:accuracy', null)).toEqual({ right: 4, plays: 5 });
  });

  it('starts fresh if the saved score is broken', () => {
    save('blackjack:accuracy', { right: 5, plays: 2 });
    const { $ } = setup();
    expect($('[data-accuracy]').textContent).toBe('–');
  });

  it('shows the decks at the top of the table; Settings changes them, only between hands', () => {
    const { $, press, stored } = table('9H 7S 8C 10D');
    const pressed = () => $('[data-settings] [aria-pressed="true"]').textContent;
    expect($('.bj-decks').textContent).toBe('6 decks');
    expect($('[data-settings] h3').textContent).toBe('Decks in the shoe');
    expect(pressed()).toBe('6');
    press('[data-decks="8"]');
    expect(stored().decks).toBe(8);
    expect(stored().shoe).toHaveLength(416);
    expect(pressed()).toBe('8');
    press('[data-decks="1"]');
    expect($('.bj-decks').textContent).toBe('1 deck');
    press('[data-decks="1"]'); // the same choice changes nothing
    expect(stored().decks).toBe(1);

    const playing = table('9H 7S 8C 10D', { decks: 2 });
    playing.press('[data-deal]');
    expect(playing.$<HTMLButtonElement>('[data-decks="6"]').disabled).toBe(true);
    expect(playing.$('.bj-decks').textContent).toBe('2 decks');
    playing.press('[data-decks="6"]');
    expect(playing.stored().decks).toBe(2);
  });

  it('opens a save from before the deck choice with 6 decks and the same chips', () => {
    const { decks: _gone, ...old } = stacked('9H 7S 8C 10D', { chips: 777 });
    const { $ } = setup(old);
    expect($('[data-chips]').textContent).toBe('777');
    expect($('.bj-decks').textContent).toBe('6 decks');
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

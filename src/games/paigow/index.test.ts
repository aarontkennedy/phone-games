import { beforeEach, describe, expect, it } from 'vitest';
import css from './style.css?raw';
import cardsCss from '../../core/cards.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import { START_CHIPS, newState, type State } from './logic';
import { setting } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('paigow:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = (sel: string) => [...container.querySelectorAll<HTMLElement>(sel)];
  const stored = () => load<State>('paigow:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, stored, status };
}

beforeEach(() => localStorage.clear());

describe('Pai Gow Poker screen', () => {
  it('starts ready to bet, and deals seven cards each', () => {
    const { $, $$, status, stored } = setup();
    expect(status()).toBe('Choose a bet and tap Deal. Win both hands to win your bet, less 5%.');
    $('[data-bet="100"]').click();
    $('[data-deal]').click();
    expect(stored().phase).toBe('setting');
    expect($('[data-chips]').textContent).toBe(String(START_CHIPS - 100));
    expect($$('[data-pick]')).toHaveLength(7);
    expect($$('.card.back')).toHaveLength(7);
    expect(status()).toBe('Tap two cards for your low hand. The other five make your high hand.');
    expect($<HTMLButtonElement>('[data-play]').disabled).toBe(true);
  });

  it('picks the low hand, names both hands, and refuses a high hand that doesn’t beat the low', () => {
    const { $, status } = setup(setting('AS QH 10D 8C 6S 4H 2D', 'KS JS 9S 7S 5H 3D 2C'));
    $('[data-pick="0"]').click();
    $('[data-pick="1"]').click();
    expect(status()).toBe('Your high hand must beat your low hand: pick two other cards.');
    expect($('[data-pick="0"]').getAttribute('aria-pressed')).toBe('true');
    expect($('[data-pick="0"]').parentElement!.textContent).toContain('Low');
    $('[data-pick="0"]').click();
    $('[data-pick="2"]').click();
    expect(status()).toBe('High: ace high. Low: queen and ten. Tap Play.');
    $('[data-board]').click(); // between the cards
  });

  it('plays, shows both set hands, and pays the win less commission', () => {
    const { $, $$, status, stored } = setup(setting('AS QH 10D 8C 6S 4H 2D', 'KS JS 9S 7S 5H 3D 2C'));
    $('[data-hint]').click();
    expect(stored().low).toEqual([1, 2]);
    $('[data-play]').click();
    expect(status()).toBe('High hand: you win. Low hand: you win. You win 40, less 2 commission.');
    expect($('[data-chips]').textContent).toBe('1038');
    expect($$('.pg-caption').map((c) => c.textContent)).toEqual(['King high', 'J-9', 'Ace high', 'Q-10']);
    expect($$('[role="group"]').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Dealer’s high hand: King high',
      'Dealer’s low hand: Jack and nine',
      'Your high hand: Ace high',
      'Your low hand: Queen and ten',
    ]);
    expect($$('.won')).toHaveLength(2);
  });

  it('says when a hand pushes or loses, and offers Start over when broke', () => {
    const push = setup(setting('AS 9H 8D 7C 6S 4H 2D', 'KS QS JS 9C 5H 3D 2C', { low: [1, 2] }));
    push.$('[data-play]').click();
    expect(push.status()).toBe('High hand: you win. Low hand: dealer wins. A push: your bet comes back.');
    document.body.replaceChildren();

    const lose = setup(setting('AS QH 10D 8C 6S 4H 2D', 'AD QS 10S 8H 6D 4C 2C', { low: [1, 2], chips: 0, bet: 20 }));
    lose.$('[data-play]').click();
    expect(lose.status()).toBe('High hand: dealer wins. Low hand: dealer wins. You lose 20. You’re out of chips. Tap Start over for 1000 more.');
    expect(lose.$$('.pg-caption')[2].textContent).toBe('Ace high');
    lose.$('[data-deal]').click();
    expect(lose.stored().chips).toBe(START_CHIPS);
    lose.$('[data-controls]').click();
  });

  it('draws the joker as a star card', () => {
    const { $ } = setup(setting('JK AS QH 10D 8C 6S 4H', 'KS JS 9S 7S 5H 3D 2C'));
    expect($('[data-pick="0"]').getAttribute('aria-label')).toBe('Joker');
    expect($('[data-pick="0"]').classList.contains('joker')).toBe(true);
  });

  it('starts fresh from a broken save, and cleans up when closed', () => {
    const { $, unmount, container } = setup({ chips: 'lots' });
    expect($('[data-chips]').textContent).toBe(String(newState().chips));
    unmount();
    expect(container.children).toHaveLength(0);
  });
});

describe('Pai Gow Poker colors', () => {
  const pg = themes(css, '.pg');
  const card = themes(cardsCss, '.cards');

  it.each([
    ['light', pg.light, card.light],
    ['dark', pg.dark, card.dark],
  ])('the joker reads on a card in the %s theme (4.5:1)', (_name, p, c) => {
    expect(contrast(p['pg-joker'], c['card-face'])).toBeGreaterThanOrEqual(4.5);
  });
});

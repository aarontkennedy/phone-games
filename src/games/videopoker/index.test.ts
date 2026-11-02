import { describe, expect, it } from 'vitest';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import { newState, type State } from './logic';
import { dealt } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('videopoker:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('videopoker:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, stored, status };
}

describe('Video poker screen', () => {
  it('shows the pay table for your bet and deals', () => {
    const { $, $$, stored, status } = setup();
    expect(status()).toBe('Choose a bet of 1 to 5 credits and tap Deal.');
    expect($$('.vp-pays li').map((li) => li.textContent)).toEqual([
      'Royal flush4000', 'Straight flush250', 'Four of a kind125', 'Full house45', 'Flush30', 'Straight20', 'Three of a kind15', 'Two pair10', 'Jacks or better5',
    ]);
    $('[data-bet="1"]').click();
    expect($('.vp-pays li b').textContent).toBe('250');
    expect($('[data-bet="1"]').getAttribute('aria-pressed')).toBe('true');
    expect($$('.vp-hand .card-slot')).toHaveLength(5);
    $('[data-deal]').click();
    expect(stored().phase).toBe('holding');
    expect($('[data-credits]').textContent).toBe('99');
    expect(status()).toMatch(/^Tap the cards to keep, then tap Draw\./);
  });

  it('holds cards, draws, and pays', () => {
    const { $, $$, stored, status } = setup(dealt('JS JH 4D 8C 9S', 'JD 2C 3C'));
    expect(status()).toBe('Tap the cards to keep, then tap Draw. You already have a winner: pair of jacks.');
    $('[data-card-index="0"]').click();
    $('[data-card-index="1"]').click();
    expect($$('.vp-held').map((h) => h.textContent)).toEqual(['Held', 'Held', '', '', '']);
    expect($('[data-card-index="0"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-draw]').click();
    expect(stored().win).toBe('three');
    expect(status()).toBe('Three jacks: you win 15.');
    expect($('.vp-pays .won').textContent).toBe('Three of a kind15');
    expect($('[data-credits]').textContent).toBe('110');
    expect($('[data-best]').textContent).toBe('110');
    expect(load('videopoker:best', 0)).toBe(110);
    $('[data-board]').click(); // a stray tap
  });

  it('says when a hand loses, and offers Start over when broke', () => {
    const { $, stored, status } = setup(dealt('2S 5H 7D 9C JS', 'KD 4C 3C 8H 10S', { credits: 0 }));
    expect(status()).toBe('Tap the cards to keep, then tap Draw.');
    $('[data-draw]').click();
    expect(status()).toBe('King high: no win. You’re out of credits. Tap Start over for 100 more.');
    expect($('[data-deal]').textContent).toBe('Start over');
    $('[data-deal]').click();
    expect(stored().credits).toBe(100);
    expect(stored().phase).toBe('betting');
    $('[data-controls]').click(); // not on a button
  });

  it('starts fresh from a broken save', () => {
    const { $, status } = setup({ phase: 'x' });
    expect(status()).toBe('Choose a bet of 1 to 5 credits and tap Deal.');
    expect($('[data-credits]').textContent).toBe(String(newState().credits));
  });
});

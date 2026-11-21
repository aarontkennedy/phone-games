import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { makeContainer, track, answerNewGame } from '../../test/helpers';
import { mount } from './index';
import { PASSES, type State } from './logic';
import { table } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('pyramid:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('pyramid:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const tapCard = (i: number) => $(`[data-i="${i}"]`).click();
  return { container, unmount, $, $$, stored, status, tapCard };
}

describe('Pyramid screen', () => {
  it('deals a pyramid of 28 cards with only the bottom row free', () => {
    const { $$, $, status } = setup();
    expect($$('.py-row')).toHaveLength(7);
    expect($$('[data-i]')).toHaveLength(28);
    expect($$<HTMLButtonElement>('[data-i]:not([disabled])')).toHaveLength(7);
    expect($('[data-left]').textContent).toBe('28');
    expect($('[data-deck]').textContent).toBe('24');
    expect($('[data-best]').textContent).toBe('–');
    expect(status()).toBe('Tap two free cards that add up to 13, or a king. Tap the deck to turn a card.');
  });

  it('pairs two cards that make 13, removes a king, and lets a pick go', () => {
    const { $, stored, status, tapCard } = setup(table({ 21: '6H', 22: '7S', 23: 'KD', 24: '2C', 15: 'QS', 16: '5D' }, 'AH', '3C'));
    tapCard(21);
    expect(status()).toBe('Now tap a card that makes 13 with the 6 of hearts, or tap it again to let it go.');
    expect($('[data-i="21"]').classList.contains('picked')).toBe(true);
    tapCard(21); // let it go
    expect($('[data-i="21"]').classList.contains('picked')).toBe(false);
    tapCard(21);
    tapCard(24); // 6 and 2: not 13, so the 2 is picked instead
    expect($('[data-i="24"]').classList.contains('picked')).toBe(true);
    tapCard(21);
    tapCard(22); // 6 and 7
    expect(stored().pyramid[21]).toBeNull();
    expect(stored().pyramid[22]).toBeNull();
    tapCard(23); // a king, on its own
    expect(stored().pyramid[23]).toBeNull();
    tapCard(15); // the queen is free now (21 and 22 are gone): pair it with the ace on the pile
    $('[data-waste]').click();
    expect(stored().pyramid[15]).toBeNull();
    expect(stored().waste).toEqual([]);
    $('[data-i="16"]').click(); // covered by 23? no: 22 and 23 are gone, so it's free
    expect($('[data-left]').textContent).toBe('2');
  });

  it('turns the deck, turns the pile back, and says when it’s used up', () => {
    const { $, stored, status } = setup(table({ 27: '5S' }, '', '2C', { pass: PASSES }));
    $('[data-stock]').click();
    expect(stored().waste).toHaveLength(1);
    expect($('[data-deck]').textContent).toBe('0');
    // No passes left and no move: the deal is over, and Best records it.
    expect(status()).toMatch(/^No moves left: 1 cards in the pyramid\./);
    expect(load('pyramid:best', null)).toBe(1);
    $('[data-stock]').click();
    document.body.replaceChildren();
    const again = setup(table({ 27: '5S' }, '2C', '', { pass: 1 }));
    again.$('[data-stock]').click(); // turn the pile back over
    expect(again.stored().pass).toBe(2);
    expect(again.stored().stock).toHaveLength(1);
  });

  it('hints a move, and undoes one', () => {
    const { $, $$, status, stored } = setup(table({ 21: '6H', 22: '7S' }, '', '3C'));
    $('[data-hint]').click();
    expect(status()).toBe('Hint: pair the 6 of hearts with the 7 of spades.');
    expect($$('.card.hint')).toHaveLength(2);
    $('[data-i="21"]').click();
    $('[data-i="22"]').click();
    expect(stored().won).toBe(true);
    expect(status()).toBe('You cleared the pyramid!');
    expect(load('pyramid:best', null)).toBe(0);
    $('[data-undo]').click();
    expect(stored().won).toBe(false);
    $('[data-hint]').click();
    expect(status()).toBe('Hint: pair the 6 of hearts with the 7 of spades.');
  });

  it('hints a king, the deck, and turning the pile back', () => {
    const king = setup(table({ 27: 'KS', 26: '2H' }));
    king.$('[data-hint]').click();
    expect(king.status()).toBe('Hint: remove the king of spades.');
    document.body.replaceChildren();
    const deck = setup(table({ 27: '2S' }, '', '3C'));
    deck.$('[data-hint]').click();
    expect(deck.status()).toBe('Hint: turn a card from the deck.');
    expect(deck.$('[data-stock]').classList.contains('hint')).toBe(true);
    document.body.replaceChildren();
    const back = setup(table({ 27: '2S' }, '3C', ''));
    back.$('[data-hint]').click();
    expect(back.status()).toBe('Hint: turn the pile back over for another pass through the deck.');
    document.body.replaceChildren();
    const none = setup(table({ 27: '2S' }, '3C', '', { pass: PASSES }));
    none.$('[data-hint]').click();
    expect(none.status()).toMatch(/^No moves left\./);
  });

  it('asks before New in a game partway through, ignores stray taps, and a broken save', () => {
    const { $, stored } = setup(table({ 21: '6H', 22: '7S', 27: '2C' }, '', '', { moves: 3 }));
    $('[data-board]').click();
    $('[data-i="21"]').closest('.py-row')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    $('[data-new]').click();
    answerNewGame();
    expect(stored().moves).toBe(0);
    document.body.replaceChildren();
    const broken = setup({ pyramid: 'x' });
    broken.unmount(); // a fresh deal, saved over the broken one
    expect(broken.stored().pyramid).toHaveLength(28);
  });
});

describe('Pyramid colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});

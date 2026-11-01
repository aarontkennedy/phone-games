import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track, answerNewGame } from '../../test/helpers';
import { AI_DELAY, TRICK_PAUSE, mount } from './index';
import type { HandResult, State } from './logic';
import { bidding, position, trick } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('euchre:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('euchre:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const strip = () => $('.eu-trump').textContent!.replace(/\s+/g, ' ').trim();
  const info = (seat: number) => $(`[data-seat="${seat}"] .tt-info`).textContent!.replace(/\s+/g, ' ').trim();
  const buttons = () => $$('[data-bidding] button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
  return { container, unmount, $, $$, stored, status, strip, info, buttons };
}

// East deals, so you bid first. The 9 of hearts is turned up.
const HANDS = ['JH JD AH KC 9C', '10H QH 9D 10D 10C', 'KH AD KD QD JC', 'AS JS 9S AC QC'];

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Euchre screen', () => {
  it('starts bidding with the turned-up card and your choices', () => {
    const { $, status, strip, info, buttons } = setup(bidding(HANDS));
    expect(strip()).toMatch(/^Turned up/);
    expect($('.eu-trump .card').dataset.card).toBe('9H');
    expect(buttons()).toEqual(['Order up', 'Alone', 'Pass']);
    expect(status()).toBe('Order the dealer to pick up the 9 of hearts, making hearts trump? Or pass.');
    expect(info(3)).toBe('Dealer');
    expect(info(1)).toBe('');
  });

  it('orders up: the dealer picks up and puts a card back, then you lead', () => {
    const { $, status, strip, stored } = setup(bidding(HANDS));
    $('[data-order]').click();
    expect(stored().phase).toBe('discard');
    expect(status()).toBe('East is picking up the 9 of hearts…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().phase).toBe('playing');
    expect(strip()).toBe('Hearts are trump, called by you');
    expect(status()).toBe('Your turn to lead.');
  });

  it('as the dealer, you pick it up and choose a card to put back', () => {
    const { $, $$, status, buttons, stored } = setup(bidding(HANDS, { dealer: 0, turn: 0 }));
    expect(buttons()[0]).toBe('Pick it up');
    expect(status()).toBe('Pick up the 9 of hearts to make hearts trump, or pass.');
    $('[data-order]').click();
    expect(status()).toBe('You picked up the 9 of hearts. Tap a card to put back.');
    expect($$('[data-hand]:not([disabled])')).toHaveLength(6);
    $('[data-hand][data-card="9C"]').click();
    expect(stored().hands[0]).toHaveLength(5);
    expect(stored().phase).toBe('playing');
    expect(stored().turn).toBe(1);
  });

  it('goes alone: North sits out', () => {
    const { $, strip, info, stored } = setup(bidding(HANDS));
    $('[data-alone]').click();
    expect($('[data-alone]').getAttribute('aria-pressed')).toBe('true');
    $('[data-alone]').click();
    $('[data-alone]').click();
    $('[data-order]').click();
    expect(stored().alone).toBe(true);
    vi.advanceTimersByTime(AI_DELAY);
    expect(strip()).toBe('Hearts are trump, called by you, alone');
    expect(info(2)).toBe('Out · 0');
  });

  it('passes, and the computer players decide in turn', () => {
    const { $, status, stored } = setup(bidding(HANDS));
    $('[data-pass]').click();
    expect(stored().turn).toBe(1);
    expect(status()).toBe('West is deciding…');
    expect($('[data-bidding]').hidden).toBe(true);
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(stored().turn).not.toBe(1);
  });

  it('names another suit in round two', () => {
    const { $, status, strip, buttons, stored } = setup(bidding(HANDS, { phase: 'bidding2' }));
    expect(strip()).toBe('Turned down: 9 of hearts');
    expect(status()).toBe('Name a trump suit (not hearts), or pass.');
    expect(buttons()).toEqual(['Spades', 'Diamonds', 'Clubs', 'Alone', 'Pass']);
    $('[data-suit="D"]').click();
    expect(stored().trump).toBe('D');
    expect(stored().phase).toBe('playing');
  });

  it('makes the dealer name trump when everyone passes', () => {
    const { status, buttons } = setup(bidding(HANDS, { phase: 'bidding2', dealer: 0, turn: 0 }));
    expect(status()).toBe('Everyone passed, so you must name trump.');
    expect(buttons()).toEqual(['Spades', 'Diamonds', 'Clubs', 'Alone']);
  });

  it('plays a trick and shows tricks won', () => {
    const s = position(['9S AH', 'KS', 'QS', 'AS 10C'], { turn: 0, tricks: [1, 0, 0, 0] });
    const { $, status, info, stored } = setup(s);
    expect(info(0)).toBe('1');
    expect(info(3)).toBe('Dealer · 0');
    $('[data-hand][data-card="9S"]').click();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(status()).toBe('East takes the trick.');
    vi.advanceTimersByTime(TRICK_PAUSE);
    expect(stored().tricks).toEqual([1, 0, 0, 1]);

    document.body.replaceChildren();
    const follow = setup(position(['9S AH', '', '', ''], { turn: 0, trick: trick(1, 'KS QS 10S') }));
    expect(follow.status()).toBe('Your turn. Follow suit if you can.');
    follow.$('[data-hand][data-card="9S"]').click();
    expect(follow.status()).toBe('West takes the trick.');
  });

  it('shows a black trump suit, a computer player deciding in round two, and your winning trick', () => {
    const black = setup(position(['9S AS', '', '', ''], { trump: 'S', maker: 2, turn: 0, trick: trick(1, 'KS QS 10S') }));
    expect(black.strip()).toBe('Spades are trump, called by North');
    expect(black.$('.eu-suit').classList.contains('red')).toBe(false);
    black.$('[data-hand][data-card="AS"]').click();
    expect(black.status()).toBe('You take the trick.');
    document.body.replaceChildren();
    expect(setup(bidding(HANDS, { phase: 'bidding2', turn: 2 })).status()).toBe('North is deciding…');
  });

  const over = (last: HandResult, o: Partial<State> = {}) =>
    position(['', '', '', ''], { phase: 'handOver', last, tricks: [2, 1, 1, 1], ...o });

  it.each([
    [{ team: 0, points: 1, makerTricks: 3, euchred: false }, {}, 'You called hearts and took 3: 1 point for us.'],
    [{ team: 0, points: 2, makerTricks: 5, euchred: false }, { maker: 2 }, 'North called hearts and took all 5: 2 points for us.'],
    [{ team: 1, points: 4, makerTricks: 5, euchred: false }, { maker: 1, alone: true }, 'West called hearts alone and took all 5: 4 points for them.'],
    [{ team: 0, points: 2, makerTricks: 2, euchred: true }, { maker: 3 }, 'East called hearts but took only 2. Euchred! We score 2 points.'],
    [{ team: 1, points: 2, makerTricks: 1, euchred: true }, {}, 'You called hearts but took only 1. Euchred! They score 2 points.'],
  ] as [HandResult, Partial<State>, string][])('sums up the hand: %j', (last, o, text) => {
    const { $, status, stored } = setup(over(last, o));
    expect($('.overlay h2').textContent).toBe('Hand over');
    expect(status()).toBe(text);
    $('.overlay .btn').click();
    expect(stored().phase).toBe('bidding1');
    expect(stored().dealer).toBe(0);
  });

  it.each([
    [[10, 4], 'We win!', 'We win 10 to 4!'],
    [[6, 11], 'They win', 'They win 11 to 6.'],
  ])('ends the game at %j', (scores, title, ending) => {
    const s = over({ team: 0, points: 1, makerTricks: 3, euchred: false }, { phase: 'gameOver', scores: scores as [number, number] });
    const { $, status, stored } = setup(s);
    expect($('.overlay h2').textContent).toBe(title);
    expect(status().endsWith(ending)).toBe(true);
    $('.overlay .btn').click();
    expect(stored().scores).toEqual([0, 0]);
  });

  it('switches Easy and Strong without restarting, and New starts over', () => {
    const { $, stored } = setup(position(['9S', 'KS', 'QS', 'AS'], { scores: [5, 3] }));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect(stored().scores).toEqual([5, 3]);
    $('[data-new]').click();
    answerNewGame();
    expect(stored().scores).toEqual([0, 0]);
  });

  it('ignores taps off the buttons, and moves the rules refuse', () => {
    const { $, stored } = setup(position(['9S AH', '', '', ''], { turn: 0, trick: trick(1, 'KS QS 10S') }));
    $('[data-board]').click();
    $('[data-bidding]').click();
    const heart = $<HTMLButtonElement>('[data-card="AH"]');
    heart.disabled = false; // must follow spades
    heart.click();
    expect(stored().hands[0]).toHaveLength(2);
  });

  it('stops the computer players when closed, and ignores a broken save', () => {
    const { unmount, stored } = setup(bidding(HANDS, { turn: 1 }));
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 5);
    expect(stored().turn).toBe(1);
    document.body.replaceChildren();
    expect(setup({ hands: 'x' }).$$('[data-hand]')).toHaveLength(5);
  });
});

describe('Euchre colors', () => {
  const eu = themes(css, '.eu');
  const app = themes(appCss, ':root');
  it.each([
    ['light', eu.light, app.light],
    ['dark', eu.dark, app.dark],
  ])('red suit shapes stand out in the %s theme (3:1)', (_name, t, a) => {
    expect(contrast(t['eu-red'], a.board)).toBeGreaterThanOrEqual(3);
    expect(contrast(t['eu-red'], a.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(a.text, a.surface)).toBeGreaterThanOrEqual(3);
  });
});

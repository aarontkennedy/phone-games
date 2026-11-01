import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, TRICK_PAUSE, mount } from './index';
import { estimateTricks, type State } from './logic';
import { position, trick } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('spades:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('spades:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const info = (seat: number) => $(`[data-seat="${seat}"] .tt-info`).textContent!.replace(/\s+/g, ' ').trim();
  const seatCard = (seat: number) => $(`[data-seat="${seat}"] .card`)?.dataset.card;
  return { container, unmount, $, $$, stored, status, info, seatCard };
}

const bidding = (o: Partial<State> = {}) =>
  position(
    ['AS KS 2H 3H 4H 5D 6D 7D 8C 9C 10C JC QC', '2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS AH KH', '6H 7H 8H 9H 10H JH QH 2D 3D 4D 9D 10D JD', 'AD KD QD AC KC 2C 3C 4C 5C 6C 7C 5H 8D'],
    { phase: 'bidding', bids: [null, null, null, null], turn: 0, ...o },
  );

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Spades screen', () => {
  it('asks for your bid first, suggesting one from your hand', () => {
    const s = bidding();
    const { $, status, info } = setup(s);
    const suggested = Math.round(estimateTricks(s.hands[0]));
    expect($('[data-bidding]').hidden).toBe(false);
    expect($('[data-amount]').textContent).toBe(String(suggested));
    expect($('[data-bid]').textContent).toBe(`Bid ${suggested}`);
    expect(status()).toBe(`How many tricks? Your hand looks like about ${suggested}. 0 is nil.`);
    expect(info(1)).toBe('');
    expect($('[data-us]').textContent).toBe('0');
    expect($('[data-them]').textContent).toBe('0');
  });

  it('steps the bid between 0 (nil) and 13', () => {
    const { $ } = setup(bidding());
    const down = $<HTMLButtonElement>('[data-step="-1"]');
    const up = $<HTMLButtonElement>('[data-step="1"]');
    for (let i = 0; i < 15; i++) down.click();
    expect($('[data-amount]').textContent).toBe('0');
    expect($('[data-bid]').textContent).toBe('Bid nil');
    expect(down.disabled).toBe(true);
    for (let i = 0; i < 20; i++) up.click();
    expect($('[data-amount]').textContent).toBe('13');
    expect(up.disabled).toBe(true);
  });

  it('bids, then the computer players bid in turn, then you lead', () => {
    const { $, info, status, stored } = setup(bidding());
    $('[data-step="1"]').click();
    const mine = Number($('[data-amount]').textContent);
    $('[data-bid]').click();
    expect(stored().bids[0]).toBe(mine);
    expect($('[data-bidding]').hidden).toBe(true);
    expect(status()).toBe('West is bidding…');
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(stored().phase).toBe('playing');
    expect(info(0)).toBe(`Bid ${mine} · 0`);
    expect(status()).toBe('Your turn to lead. Spades aren’t broken yet.');
  });

  it('tells you what your partner bid', () => {
    const order = { dealer: 1 as const }; // North bids first, then East, then you
    expect(setup(bidding({ ...order, bids: [null, null, 4, 2] })).status()).toMatch(/^North bid 4\. How many tricks\?/);
    document.body.replaceChildren();
    expect(setup(bidding({ ...order, bids: [null, null, 0, 2] })).status()).toMatch(/^North bid nil\. /);
    document.body.replaceChildren();
    expect(setup(bidding({ bids: [3, null, null, null], turn: 1 })).info(0)).toBe('Bid 3 · 0');
  });

  it('plays a trick where a spade trumps the suit led', () => {
    const s = position(['9D 5S', '2D 3C', 'KD 4C', 'AD 6C'], { turn: 0 });
    const { $, status, seatCard, stored } = setup(s);
    expect(status()).toBe('Your turn to lead. Spades aren’t broken yet.');
    $('[data-hand][data-card="9D"]').click();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(seatCard(3)).toBe('AD');
    expect(status()).toBe('East takes the trick.');
    vi.advanceTimersByTime(TRICK_PAUSE);
    expect(stored().tricks).toEqual([0, 0, 0, 1]);

    document.body.replaceChildren();
    const trumped = setup(position(['5S 3C', '', '', ''], { turn: 0, trick: trick(1, '2D KD AD') }));
    expect(trumped.status()).toBe('Your turn. Follow suit, or play a spade to trump.');
    trumped.$('[data-hand][data-card="5S"]').click();
    expect(trumped.status()).toBe('You take the trick.');
  });

  it('stops mentioning broken spades once they are', () => {
    expect(setup(position(['9D 5S', '', '', ''], { spadesBroken: true })).status()).toBe('Your turn to lead.');
  });

  it('shows each seat’s bid, nil and tricks won', () => {
    const { info } = setup(position(['9D', '2D', 'KD', 'AD'], { bids: [4, 0, 3, 2], tricks: [2, 0, 1, 3] }));
    expect([0, 1, 2, 3].map(info)).toEqual(['Bid 4 · 2', 'Nil · 0', 'Bid 3 · 1', 'Bid 2 · 3']);
  });

  it('sums up a round, including bags and the bag penalty, then deals again', () => {
    const s = position(['', '', '', ''], {
      phase: 'roundOver',
      bids: [4, 2, 3, 3],
      tricks: [4, 1, 2, 6],
      scores: [30, 42],
      last: { points: [-70, -48], bags: [0, 2], bagPenalty: [false, true] },
    });
    const { $, status, stored } = setup(s);
    expect($('.overlay h2').textContent).toBe('Round over');
    expect(status()).toBe(
      'We bid 7 and took 6: −70. They bid 5 and took 7 with 2 bags: −48 (10 bags: −100).',
    );
    $('.overlay .btn').click();
    expect(stored().phase).toBe('bidding');
    expect(stored().dealer).toBe(0);
  });

  it('says one bag, and a plain made bid', () => {
    const s = position(['', '', '', ''], {
      phase: 'roundOver',
      bids: [3, 3, 3, 3],
      tricks: [4, 3, 3, 3],
      last: { points: [71, 60], bags: [1, 0], bagPenalty: [false, false] },
    });
    expect(setup(s).status()).toBe('We bid 6 and took 7 with 1 bag: +71. They bid 6 and took 6: +60.');
  });

  it.each([
    [[520, 300], 'We win!', 'We win 520 to 300!'],
    [[300, 520], 'They win', 'They win 520 to 300.'],
  ])('ends the game at %j', (scores, title, ending) => {
    const s = position(['', '', '', ''], {
      phase: 'gameOver',
      scores: scores as [number, number],
      last: { points: [0, 0], bags: [0, 0], bagPenalty: [false, false] },
      tricks: [3, 3, 3, 4],
    });
    const { $, status, stored } = setup(s);
    expect($('.overlay h2').textContent).toBe(title);
    expect(status()).toMatch(new RegExp(`${ending.replace(/[.!]/g, '\\$&')}$`));
    $('.overlay .btn').click();
    expect(stored().scores).toEqual([0, 0]);
    expect(stored().phase).toBe('bidding');
  });

  it('switches Easy and Strong without restarting, and New starts over', () => {
    const { $, stored } = setup(position(['9D', '2D', 'KD', 'AD'], { scores: [120, 80] }));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect(stored().scores).toEqual([120, 80]);
    $('[data-new]').click();
    expect(stored().scores).toEqual([0, 0]);
    expect(stored().level).toBe('easy');
  });

  it('ignores taps off the cards and moves the rules refuse', () => {
    const { $, stored } = setup(position(['9D 3C', '', '', ''], { turn: 0, trick: trick(1, '2D KD AD') }));
    $('[data-board]').click();
    $('[data-bidding]').click();
    const club = $<HTMLButtonElement>('[data-card="3C"]');
    club.disabled = false; // must follow diamonds
    club.click();
    expect(stored().hands[0]).toHaveLength(2);
  });

  it('stops the computer players when closed, and ignores a broken save', () => {
    const { unmount, stored } = setup(bidding({ turn: 1, bids: [3, null, null, null] }));
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 5);
    expect(stored().bids).toEqual([3, null, null, null]);
    document.body.replaceChildren();
    expect(setup({ hands: 1 }).$$('[data-hand]')).toHaveLength(13);
  });
});

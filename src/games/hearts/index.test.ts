import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cardId } from '../../core/cards';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, TRICK_PAUSE, mount } from './index';
import type { State } from './logic';
import { cards, position, trick } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('hearts:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('hearts:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const hand = () => $$<HTMLButtonElement>('[data-hand]');
  const tapCard = (id: string) => $(`[data-hand][data-card="${id}"]`).click();
  const seatCard = (seat: number) => $(`[data-seat="${seat}"] .card`)?.dataset.card;
  return { container, unmount, $, $$, stored, status, hand, tapCard, seatCard };
}

/** First trick: you hold the 2 of clubs and lead. */
const opening = () =>
  position(['2C 5D 9H', '3C 6D 10H', '4C 7D JH', 'KC 8D QH'], { tricksPlayed: 0, turn: 0 });

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Hearts screen', () => {
  it('starts a game by asking you to pass three cards left', () => {
    const { $, $$, status, hand } = setup();
    expect(hand()).toHaveLength(13);
    expect($$('.tt-name').map((n) => n.textContent)).toEqual(['West', 'North', 'East', 'You']);
    expect($('[data-pass]').textContent).toBe('Pass to West');
    expect($<HTMLButtonElement>('[data-pass]').disabled).toBe(true);
    expect($('[data-round]').textContent).toBe('1');
    expect($('[data-level="strong"]').getAttribute('aria-pressed')).toBe('true');
    expect(status()).toBe('Pick 3 cards to pass left to West. 0 picked.');
  });

  it('picks up to three cards to pass, then passes them', () => {
    const { $, $$, status, hand, stored } = setup();
    const [a, b, c, d] = hand().map((h) => h.dataset.card!);
    const tap = (id: string) => $(`[data-hand][data-card="${id}"]`).click();
    tap(a);
    tap(b);
    tap(b); // unpick
    tap(b);
    tap(c);
    tap(d); // a fourth pick drops the oldest
    expect($$('.card.picked').map((x) => x.dataset.card).sort()).toEqual([b, c, d].sort());
    expect($$('.card.picked')).toHaveLength(3);
    expect(status()).toBe('Pick 3 cards to pass left to West. 3 picked.');
    $('[data-pass]').click();
    expect(stored().phase).toBe('playing');
    expect($('[data-pass]').hidden).toBe(true);
    expect($$('.card.received')).toHaveLength(3);
    const mine = stored().hands[0].map(cardId);
    expect(mine).toContain(a); // dropped from the picks, so kept
    expect(mine).not.toContain(d);
  });

  it('plays a trick: your card, then each computer player in turn, then the winner takes it', () => {
    const { hand, status, tapCard, seatCard, stored } = setup(opening());
    expect(status()).toBe('Your turn: lead the 2 of clubs.');
    expect(hand().filter((h) => !h.disabled).map((h) => h.dataset.card)).toEqual(['2C']);
    expect(hand().find((h) => h.dataset.card === '2C')!.classList.contains('lift')).toBe(true);

    tapCard('2C');
    expect(seatCard(0)).toBe('2C');
    expect(status()).toBe('West is playing…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(seatCard(1)).toBe('3C');
    vi.advanceTimersByTime(AI_DELAY * 2);
    expect(seatCard(3)).toBe('KC');
    expect(status()).toBe('East takes the trick.');

    vi.advanceTimersByTime(TRICK_PAUSE);
    expect(stored().trick).toEqual([]);
    expect(stored().turn).toBe(3);
    expect(seatCard(0)).toBeUndefined();
  });

  it('asks you to follow suit, and only lets you play cards that follow', () => {
    const s = position(['5D 9D 9H', '3C', '4C', 'KC'], { trick: trick(3, 'KD'), turn: 0, heartsBroken: true });
    const { hand, status } = setup(s);
    expect(status()).toBe('Your turn. Follow suit if you can.');
    expect(hand().filter((h) => !h.disabled).map((h) => h.dataset.card)).toEqual(['5D', '9D']);
  });

  it('reminds you when hearts are not broken yet', () => {
    const { status } = setup(position(['5D 9H', '3C', '4C', 'KC'], { turn: 0 }));
    expect(status()).toBe('Your turn to lead. Hearts aren’t broken yet.');
  });

  it('says who passed you which cards', () => {
    const s = position(['5D 9H QS', '3C', '4C', 'KC'], { turn: 0, heartsBroken: true, received: cards('QS 9H') });
    const { status } = setup(s);
    expect(status()).toBe('East passed you the queen of spades and 9 of hearts. Your turn to lead.');
  });

  it('shows points taken this round next to each score', () => {
    const { $ } = setup(position(['5D', '3C', '4C', 'KC'], { points: [0, 5, 0, 13], scores: [10, 20, 30, 40] }));
    expect($('[data-seat="1"] .tt-info').textContent).toBe('20 +5');
    expect($('[data-seat="0"] .tt-info').textContent).toBe('10');
    expect($('[data-score]').textContent).toBe('10');
  });

  it('ends a round with a summary, then deals the next one', () => {
    const s = position(['', '', '', ''], {
      trick: trick(0, '9D 2D 3D 4H'),
      tricksPlayed: 12,
      points: [3, 13, 5, 0],
      heartsBroken: true,
    });
    const { $, status, stored } = setup(s);
    vi.advanceTimersByTime(TRICK_PAUSE);
    expect($('.overlay h2').textContent).toBe('Round over');
    expect(status()).toBe('Round points: You 4, West 13, North 5 and East 0.');
    $('.overlay .btn').click();
    expect(stored().round).toBe(1);
    expect(stored().phase).toBe('passing');
    expect($('[data-pass]').textContent).toBe('Pass to East');
  });

  it('announces shooting the moon', () => {
    const s = position(['', '', '', ''], { phase: 'roundOver', moon: 2, lastRound: [26, 26, 0, 26], scores: [26, 26, 0, 26] });
    expect(setup(s).status()).toBe('North shot the moon! Round points: You 26, West 26, North 0 and East 26.');
  });

  it.each([
    [[40, 100, 60, 70], null, 'You win!', 'You win with 40!'],
    [[90, 100, 30, 70], null, 'North wins', 'North wins with 30. You finished with 90.'],
    [[30, 100, 30, 70], 0, 'It’s a tie', 'You shot the moon! You and North tie for the win with 30.'],
  ])('ends the game: %j', (scores, moon, title, text) => {
    const s = position(['', '', '', ''], { phase: 'gameOver', scores, moon: moon as 0 | null });
    const { $, status, stored } = setup(s);
    expect($('.overlay h2').textContent).toBe(title);
    expect(status()).toBe(text);
    $('.overlay .btn').click();
    expect(stored().phase).toBe('passing');
    expect(stored().scores).toEqual([0, 0, 0, 0]);
  });

  it('switches the computer players between Easy and Strong without restarting', () => {
    const { $, stored } = setup(opening());
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect(stored().tricksPlayed).toBe(0);
    expect($('[data-level="easy"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('ignores taps that aren’t on a card, and cards out of turn', () => {
    const { $, tapCard, stored } = setup(position(['5D', '3C', '4C', 'KC'], { turn: 1 }));
    $('[data-board]').click();
    tapCard('5D'); // disabled: West's turn
    const card = $<HTMLButtonElement>('[data-card="5D"]');
    card.disabled = false; // even if tapped, the rules refuse it
    card.click();
    expect(stored().hands[0]).toHaveLength(1);
  });

  it('starts over with New', () => {
    const { $, stored } = setup(position(['5D', '3C', '4C', 'KC'], { scores: [50, 2, 3, 4], level: 'easy' }));
    $('[data-new]').click();
    expect(stored().scores).toEqual([0, 0, 0, 0]);
    expect(stored().level).toBe('easy');
  });

  it('resumes the computer players after reopening, and stops them when closed', () => {
    const s = position(['5D', '3D', '4D', 'KD'], { turn: 1, trick: trick(0, '5D') });
    s.hands[0] = [];
    const { unmount, stored, container } = setup({ ...s, played: [...s.played] });
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().trick).toHaveLength(2);
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 5);
    expect(stored().trick).toHaveLength(2);
    expect(container.children).toHaveLength(0);
  });

  it('ignores a broken save', () => {
    expect(setup({ hands: 'nope' }).hand()).toHaveLength(13);
  });
});

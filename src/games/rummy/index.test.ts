import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../core/storage';
import { answerNewGame, expectStaysFinished, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, actionText, meldText, mount } from './index';
import type { State } from './logic';
import { cards, position } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('rummy:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('rummy:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const tap = (...ids: string[]) => ids.forEach((id) => $(`[data-hand][data-card="${id}"]`).click());
  const buttons = () => $$('[data-actions] button').map((b) => b.textContent);
  const recent = () => $$('[data-recent] li').map((li) => li.textContent).reverse();
  return { container, unmount, $, $$, stored, status, tap, buttons, recent };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Rummy 500 screen', () => {
  it('shows the table and lets you take only pile cards you can meld', () => {
    const { $, $$, status } = setup(position(['7H 7S 2C', 'KD QD'], '7D 4S 9C', ['3H 4H 5H'], { melded: [12, 0] }));
    expect($('.rm-info').textContent).toBe('Computer 2 cards · Melded: you 12, it 0');
    expect($('.rm-meld').getAttribute('aria-label')).toBe('Meld: the 3, 4 and 5 of hearts');
    expect($$('[data-pile]:not([disabled])').map((c) => c.dataset.card)).toEqual(['7D']);
    expect($$('[data-hand]:not([disabled])')).toHaveLength(0);
    expect(status()).toBe('Your turn: tap the deck, or a pile card you can meld. You take every card above it too.');
    document.body.replaceChildren();
    expect(setup(position(['2C', 'KD'], '9C')).$('.rm-melds').textContent).toBe('No melds yet');
  });

  it('takes from the pile, melds the card you took, and discards', () => {
    const { $, stored, status, tap, buttons } = setup(position(['7H 7S 2C', 'KD QD'], '7D 4S 9C'));
    $('[data-pile="0"]').click();
    expect(stored().hands[0]).toHaveLength(6);
    expect(status()).toBe('Meld the 7 of diamonds (dashed outline): tap it and the cards that go with it, then Meld or Lay off.');
    expect($('.tt-hand .received').dataset.card).toBe('7D');
    expect(buttons()).toEqual(['Undo']);
    tap('2C');
    expect(buttons()).toEqual(['Undo']); // no discarding yet
    tap('2C', '7H', '7S', '7D');
    expect(buttons()).toEqual(['Meld', 'Undo']);
    $('[data-meld]').click();
    expect(stored().table).toHaveLength(1);
    expect(status()).toBe('Tap cards to meld or lay off, or tap one card and Discard to end your turn.');
    tap('9C');
    expect(status()).toBe('Tap Meld or Lay off for a meld; Discard for one card to end your turn.');
    expect(buttons()).toEqual(['Discard']);
    $('[data-discard]').click();
    expect(stored().turn).toBe(1);
    expect(status()).toBe('The computer is playing…');
  });

  it('puts the pile back with Undo', () => {
    const { $, stored, recent } = setup(position(['7H 7S 2C', 'KD QD'], '7D 4S 9C'));
    $('[data-pile="0"]').click();
    $('[data-undo]').click();
    expect(stored().discard).toHaveLength(3);
    expect(recent()).toEqual(['You took the 7 of diamonds from the pile and 2 more.', 'You put the pile cards back.']);
    $('[data-level="easy"]').click(); // not a move
    expect(recent()).toHaveLength(2);
    expect(stored().phase).toBe('draw');
  });

  it('draws from the deck and lays off on a meld', () => {
    const { $, stored, tap, buttons } = setup(position(['6H 2C 9D', 'KD QD'], '9C', ['3H 4H 5H']));
    $('[data-stock]').click();
    expect(stored().phase).toBe('play');
    tap('6H');
    expect(buttons()).toEqual(['Lay off', 'Discard']);
    $('[data-layoff]').click();
    expect(stored().table[0]).toEqual(cards('3H 4H 5H 6H'));
    $('[data-board]').click(); // a stray tap
    $('[data-actions]').click();
  });

  it('says what the computer did, then waits for its moves', () => {
    const s = position(['2C 9D', 'KD QD JD 4S 8C'], '9C', [], { turn: 1, phase: 'play', action: { player: 1, kind: 'stock', cards: [] } });
    const { stored, status, recent } = setup(s);
    expect(status()).toBe('The computer is playing…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().action).toMatchObject({ kind: 'meld' });
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().turn).toBe(0);
    expect(recent()).toEqual(['The computer melded the jack, queen and king of diamonds.', 'The computer discarded the 8 of clubs.']);
    expect(status()).toMatch(/^Your turn/);
    expect(actionText({ player: 0, kind: 'stock', cards: [] })).toBe('You drew from the deck.');
    expect(actionText({ player: 1, kind: 'pile', cards: cards('7D 4S 9C') })).toBe('The computer took the 7 of diamonds from the pile and 2 more.');
    expect(actionText({ player: 1, kind: 'pile', cards: cards('KD') })).toBe('The computer took the king of diamonds from the pile.');
    expect(actionText({ player: 1, kind: 'layoff', cards: cards('6H 7H') })).toBe('The computer laid off the 6 of hearts and 7 of hearts.');
    expect(meldText(cards('AS AH AD'))).toBe('three aces');
    expect(meldText(cards('7S 7H 7D 7C'))).toBe('four 7s');
    expect(meldText(cards('QH KH AH'))).toBe('the queen, king and ace of hearts');
  });

  it('ends the hand and the game', () => {
    const hand = setup(position(['7H 7S 7D', 'KD AS'], '9C', [], { phase: 'play', melded: [10, 20] }));
    hand.tap('7H', '7S', '7D');
    hand.$('[data-meld]').click();
    expect(hand.$('.overlay h2').textContent).toBe('You win the hand');
    expectStaysFinished(hand.stored);
    expect(hand.status()).toBe('You went out. You melded 31 and held 0: 31. The computer melded 20 and held 25: -5.');
    hand.$('.overlay .btn').click();
    expect(hand.stored().phase).toBe('draw');
    hand.unmount(); // it would keep playing the next hand in the background
    document.body.replaceChildren();

    const result = (points: [number, number], out: 0 | 1 | null, scores: [number, number], phase: State['phase']) =>
      setup({ ...position(['', ''], '9C'), phase, scores, last: { melded: [0, 0], held: [0, 0], points, out } });
    const lost = result([5, 40], 1, [100, 520], 'gameOver');
    expect(lost.$('.overlay h2').textContent).toBe('The computer wins');
    expectStaysFinished(lost.stored);
    expect(lost.status()).toBe('The computer went out. You melded 0 and held 0: 5. The computer melded 0 and held 0: 40. First to 500: the computer wins.');
    lost.$('.overlay .btn').click();
    expect(lost.stored().scores).toEqual([0, 0]);
    document.body.replaceChildren();
    expect(result([0, 0], null, [0, 0], 'handOver').$('.overlay h2').textContent).toBe('A tied hand');
    document.body.replaceChildren();
    expect(result([0, 9], null, [0, 9], 'handOver').$('.overlay h2').textContent).toBe('The computer wins the hand');
    document.body.replaceChildren();
    const won = result([90, 0], 0, [510, 200], 'gameOver');
    expect(won.$('.overlay h2').textContent).toBe('You win!');
    expect(won.status()).toMatch(/First to 500: you win!$/);
  });

  it('asks before abandoning a game, switches level, and stops when closed', () => {
    const fresh = setup(position(['2C 9D', 'KD'], '9C'));
    fresh.$('[data-new]').click(); // nothing has happened yet: no question
    expect(fresh.stored().hands[0]).toHaveLength(13);
    fresh.$('[data-level="easy"]').click();
    expect(fresh.stored().level).toBe('easy');
    fresh.unmount();
    document.body.replaceChildren();

    const mid = setup(position(['2C 9D', 'KD QD JD 4S'], '9C', [], { turn: 1, action: { player: 0, kind: 'discard', cards: cards('9C') } }));
    mid.unmount();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(mid.stored().phase).toBe('draw');
    document.body.replaceChildren();
    const again = setup(mid.stored());
    again.$('[data-new]').click();
    answerNewGame();
    expect(again.stored().action).toBeNull();
    document.body.replaceChildren();
    expect(setup({ hands: 2 }).$$('[data-hand]')).toHaveLength(13);
  });
});

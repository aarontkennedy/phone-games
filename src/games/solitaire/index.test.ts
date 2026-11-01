import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../core/storage';
import { makeContainer, setHidden, track, answerNewGame } from '../../test/helpers';
import { formatTime, mount } from './index';
import type { State } from './logic';
import { blank, cards, complete, oneMoveFromWinning, upTo } from './test-fixtures';

function setup(saved: State | unknown | null = null) {
  if (saved) save('solitaire:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = (sel: string) => [...container.querySelectorAll<HTMLElement>(sel)];
  const stored = () => load<State | null>('solitaire:state', null)!;
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, $$, stored, status };
}

/** Column 0 holds a black 9 over a hidden 2; column 1 a red 10; the waste an ace of hearts. */
function position(): State {
  const s: State = { ...blank(), waste: cards('AH') };
  s.tableau[0] = { down: cards('2C'), up: cards('9S') };
  s.tableau[1] = { down: [], up: cards('10H') };
  s.tableau[2] = { down: [], up: cards('5D') };
  return complete(s);
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Solitaire screen', () => {
  it('deals a new game', () => {
    const { $, $$, status } = setup();
    expect($$('.sol-col')).toHaveLength(7);
    expect($$('.sol-col .card.back')).toHaveLength(21);
    expect($$('.sol-col button.card')).toHaveLength(7);
    expect($('[data-stock]').getAttribute('aria-label')).toBe('Turn over cards');
    expect($('[data-moves]').textContent).toBe('0');
    expect($('[data-time]').textContent).toBe('0:00');
    expect($('[data-draw="1"]').getAttribute('aria-pressed')).toBe('true');
    expect($<HTMLButtonElement>('[data-undo]').disabled).toBe(true);
    expect(status()).toBe('Tap a card to move it. Tap the deck to turn cards over.');
    expect($$('.sol-found .card-slot')[1].getAttribute('aria-label')).toBe('Empty hearts pile');
  });

  it('turns over a card from the deck and starts the clock', () => {
    const { $, $$, stored } = setup();
    $('[data-stock]').click();
    expect($$('.sol-waste .card')).toHaveLength(1);
    expect($('[data-moves]').textContent).toBe('1');
    expect($<HTMLButtonElement>('[data-undo]').disabled).toBe(false);
    expect(stored().waste).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect($('[data-time]').textContent).toBe('0:03');
  });

  it('starts a Draw 3 game that turns over three cards, with only the top one playable', () => {
    const { $, $$ } = setup();
    $('[data-draw="3"]').click();
    expect($('[data-draw="3"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-stock]').click();
    expect($$('.sol-waste .card')).toHaveLength(3);
    expect($$('.sol-waste button.card')).toHaveLength(1);
  });

  it('turns the pile back over when the deck is empty', () => {
    const s = position();
    const { $, stored } = setup({ ...s, stock: [], waste: [...s.stock, ...s.waste] });
    const slot = $('[data-stock]');
    expect(slot.getAttribute('aria-label')).toBe('Turn the pile back over');
    slot.click();
    expect(stored().waste).toEqual([]);
    expect($('[data-stock]').classList.contains('back')).toBe(true);
  });

  it('shows an empty, untappable deck when every card is dealt out', () => {
    const s = position();
    const { $ } = setup({
      ...s,
      stock: [],
      waste: [],
      tableau: [...s.tableau.slice(0, 6), { down: [], up: [...s.stock, ...s.waste] }],
    });
    expect($('.sol-stock .card-slot').tagName).toBe('DIV');
    expect($('[data-stock]')).toBeNull();
  });

  it('moves a tapped card to its foundation', () => {
    const { $, stored } = setup(position());
    $('[data-src="waste"]').click();
    expect($('.sol-found [data-card="AH"]')).not.toBeNull();
    expect(stored().foundations[1]).toEqual(upTo('H', 1));
  });

  it('moves a tapped card onto a column and turns over the card underneath', () => {
    const { $, stored } = setup(position());
    $('[data-src="0:0"]').click();
    expect(stored().tableau[1].up).toEqual(cards('10H 9S'));
    expect($('[data-col="0"] [data-card="2C"]').tagName).toBe('BUTTON');
  });

  it("says so when a tapped card can't move", () => {
    const { $, status, stored } = setup(position());
    $('[data-src="2:0"]').click(); // 5 of diamonds has nowhere to go
    expect(status()).toBe("That card can't move right now.");
    expect(stored().moves).toBe(0);
    expect($<HTMLButtonElement>('[data-undo]').disabled).toBe(true);
  });

  it('undoes moves one at a time', () => {
    const { $, stored } = setup(position());
    $('[data-src="waste"]').click();
    $('[data-src="0:0"]').click();
    $('[data-undo]').click();
    expect(stored().tableau[0].up).toEqual(cards('9S'));
    expect(stored().foundations[1]).toHaveLength(1);
    $('[data-undo]').click();
    expect(stored().foundations[1]).toHaveLength(0);
    expect($<HTMLButtonElement>('[data-undo]').disabled).toBe(true);

    const undo = $<HTMLButtonElement>('[data-undo]');
    undo.disabled = false; // nothing left to undo
    undo.click();
    expect(stored().moves).toBe(0);
  });

  it('finishes by itself once every card is face up, and records the best time', () => {
    const s: State = {
      ...blank(),
      waste: cards('QC'),
      foundations: [upTo('S', 13), upTo('H', 13), upTo('D', 13), upTo('C', 11)],
    };
    s.tableau[0].up = cards('KC');
    const { $, status, stored } = setup(s);
    vi.advanceTimersByTime(5000); // not playing yet: the clock waits for the first move
    $('[data-src="waste"]').click();

    expect(stored().won).toBe(true);
    expect(stored().moves).toBe(2);
    expect($('.overlay h2').textContent).toBe('You win!');
    expect(status()).toBe('You won in 0:00 with 2 moves! Best: 0:00.');
    expect(load('solitaire:best', {})).toEqual({ 1: 0 });

    $('.overlay .btn').click();
    expect(stored().won).toBe(false);
    expect($('.overlay')).toBeNull();
    expect(status()).toContain('Best: 0:00.');
  });

  it('keeps the best time when a slower game is won', () => {
    save('solitaire:best', { 1: 0 });
    const { $ } = setup(oneMoveFromWinning());
    vi.advanceTimersByTime(1000);
    $('[data-src="waste"]').click();
    expect(load('solitaire:best', {})).toEqual({ 1: 0 });
  });

  it('pauses the clock while the app is hidden', () => {
    const { $, stored } = setup();
    $('[data-stock]').click();
    vi.advanceTimersByTime(2000);
    setHidden(true);
    expect(stored().elapsed).toBe(2000);
    vi.advanceTimersByTime(5000);
    setHidden(false);
    vi.advanceTimersByTime(1000);
    expect($('[data-time]').textContent).toBe('0:03');
  });

  it('starts over with New, keeping the draw setting', () => {
    const { $, stored } = setup({ ...position(), draw: 3 });
    $('[data-src="waste"]').click();
    $('[data-new]').click();
    answerNewGame();
    expect(stored().moves).toBe(0);
    expect(stored().draw).toBe(3);
    expect($<HTMLButtonElement>('[data-undo]').disabled).toBe(true);
  });

  it('restores a saved game and ignores a broken one', () => {
    setup(position());
    expect(document.querySelector('[data-src="waste"] ')!.getAttribute('aria-label')).toBe('Ace of hearts');
    document.body.replaceChildren();
    const { $$ } = setup({ nope: true });
    expect($$('.sol-col .card')).toHaveLength(28); // a fresh deal
  });

  it('saves and cleans up when closed', () => {
    const { $, container, unmount, stored } = setup();
    $('[data-stock]').click();
    vi.advanceTimersByTime(4000);
    unmount();
    expect(container.children).toHaveLength(0);
    expect(stored().elapsed).toBe(4000);
  });

  it('squeezes a long column to fit the screen, but keeps ranks readable', () => {
    const s: State = { ...blank() };
    s.tableau[0].up = cards('KS QH JS 10H 9S 8H 7S 6H 5S 4H 3S 2H');
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const el = this as HTMLElement;
      if (el.classList.contains('sol-tableau')) return { top: 100, height: 0 } as DOMRect;
      if (el.classList.contains('sol-col')) return { top: 100, height: el.dataset.col === '0' ? 600 : 50 } as DOMRect;
      if (el.matches('.sol-col .card')) return { top: 100 + 28 * [...el.parentElement!.children].indexOf(el), height: 66 } as DOMRect;
      return { top: 0, height: 0 } as DOMRect;
    });
    const { $ } = setup(complete(s));
    // 600px tall, 400 - 100 - 8 = 292px available: 308px to lose over 11 gaps of 28px.
    expect($('[data-col="0"]').style.getPropertyValue('--peek-up')).toBe('24px');
    expect($('[data-col="1"]').style.getPropertyValue('--peek-up')).toBe('');

    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(2000); // e.g. turned upright
    window.dispatchEvent(new Event('resize'));
    expect($('[data-col="0"]').style.getPropertyValue('--peek-up')).toBe('');
  });
});

describe('formatTime', () => {
  it('shows minutes and seconds, up to 99:59', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(125_000)).toBe('2:05');
    expect(formatTime(10 * 60 * 60 * 1000)).toBe('99:59');
  });
});

describe('Solitaire hints', () => {
  it('outlines a good card and says where it goes, until the next move', () => {
    const s = blank();
    s.foundations[0] = upTo('S', 3);
    s.waste = cards('4S');
    const { $, status } = setup(complete(s));
    $<HTMLButtonElement>('[data-hint]').click();
    expect(status()).toBe('Hint: move the 4 of spades up to its pile.');
    expect($('[data-src="waste"]').classList.contains('hint')).toBe(true);
    $<HTMLElement>('[data-src="waste"]').click();
    expect(status()).not.toMatch(/^Hint/);
    expect($('.hint')).toBeNull();
  });

  it('names the card to stack onto, an empty column, or the deck', () => {
    const onto = blank();
    onto.tableau[0] = { down: cards('2C'), up: cards('6H') };
    onto.tableau[1].up = cards('7S');
    const a = setup(complete(onto));
    a.$<HTMLButtonElement>('[data-hint]').click();
    expect(a.status()).toBe('Hint: move the 6 of hearts onto the 7 of spades.');
    expect(a.$('[data-src="0:0"]').classList.contains('hint')).toBe(true);
    a.unmount();

    const king = blank();
    king.tableau[0] = { down: cards('2C'), up: cards('KH') };
    const b = setup(complete(king));
    b.$<HTMLButtonElement>('[data-hint]').click();
    expect(b.status()).toBe('Hint: move the king of hearts to the empty column.');
    b.unmount();

    const deck = blank();
    deck.tableau[0].up = cards('KH');
    const c = setup(complete(deck));
    c.$<HTMLButtonElement>('[data-hint]').click();
    expect(c.status()).toBe('Turn over the deck: a card in it can be played.');
    expect(c.$('[data-stock]').classList.contains('hint')).toBe(true);
  });
});

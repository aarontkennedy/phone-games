import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { makeContainer, track, answerNewGame } from '../../test/helpers';
import { AI_DELAY, bidWords, mount, moveText } from './index';
import type { State } from './logic';

function setup(saved: unknown = null) {
  if (saved) save('liarsdice:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('liarsdice:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const recent = () => [...container.querySelectorAll('[data-recent] li')].map((li) => li.textContent).reverse();
  return { container, unmount, $, stored, status, recent };
}

const table = (dice: number[][], o: Partial<State> = {}): State => ({ level: 'strong', dice, turn: 0, bid: null, reveal: null, winner: null, ...o });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.restoreAllMocks());

describe('Liar’s Dice screen', () => {
  it('builds a bid from a face and a number, and the others answer', () => {
    const { $, stored, status, recent } = setup(table([[5, 5, 1, 2, 3], [1, 2, 3, 4, 6], [1, 2, 3, 4, 6]]));
    expect(status()).toBe('Your bid: pick a face, set the number, tap Bid.');
    expect($<HTMLButtonElement>('[data-call]').disabled).toBe(true); // nothing to call yet
    $('[data-face="5"]').click();
    expect($('[data-face="5"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-step="1"]').click();
    expect($('.li-qty').textContent).toBe('2');
    $('[data-bid]').click();
    expect(stored().bid).toEqual({ qty: 2, face: 5, by: 0 });
    expect(recent()).toEqual(['You bid two 5s.']);
    expect(status()).toBe('West is thinking…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(recent()[1]).toMatch(/^West (bids \w+ \d+s?\.|called “Liar!”)/);
  });

  it('calls a bluff, shows every die, and starts the next round', () => {
    const s = table([[1, 2, 3, 4, 6], [5, 5, 1, 2, 3], [1, 2, 3, 4, 6]], { bid: { qty: 6, face: 5, by: 1 } });
    const { $, stored, status, recent, container } = setup(s);
    expect(status()).toBe('Raise the bid, or call “Liar!”');
    expect($('.li-bid').textContent).toMatch(/^Bid: six 5s by West/);
    $('[data-call]').click();
    expect(status()).toBe('There were two 5s, so the bid was a lie: West loses a die.');
    expect(recent()).toEqual(['You called “Liar!” There were two 5s: West loses a die.']);
    expect(container.querySelectorAll('.li-die.hidden')).toHaveLength(0);
    expect(container.querySelectorAll('.li-die.match')).toHaveLength(2);
    $('[data-next]').click();
    expect(stored().dice[1]).toHaveLength(4);
    expect(stored().turn).toBe(1); // the loser starts
    expect(recent()).toEqual([]);
  });

  it('says when you lose your last die, and when the game ends', () => {
    const { $, status, stored } = setup(table([[2], [5, 5], []], { bid: { qty: 2, face: 5, by: 1 } }));
    $('[data-call]').click();
    expect(status()).toBe('There were two 5s, so the bid was right: you lose a die. You’re out.');
    $('[data-next]').click();
    expect(stored().winner).toBe(1);
    expect(status()).toBe('West is the last with dice.');
    $<HTMLButtonElement>('.overlay .btn').click();
    expect(stored().dice.map((d) => d.length)).toEqual([5, 5, 5]);
  });

  it('says when a computer player is out, and when you win', () => {
    const { $, status, stored } = setup(table([[5, 5], [2], []], { bid: { qty: 3, face: 5, by: 1 } }));
    $('[data-call]').click(); // three 5s? There are two: West's bid was a lie
    expect(status()).toBe('There were two 5s, so the bid was a lie: West loses a die. West is out.');
    $('[data-next]').click();
    expect(stored().winner).toBe(0);
    expect(status()).toBe('You’re the last with dice: you win!');
  });

  it('gives the odds when asked, without a Right score', () => {
    const { $ } = setup(table([[1, 2, 3, 4, 6], [5, 5, 5, 5, 5], [5, 5, 5, 5, 5]], { bid: { qty: 9, face: 5, by: 2 } }));
    $('[data-hint]').click();
    expect($('[data-tip]').textContent).toMatch(/^Best: call “Liar!” That bid is true only about \d+% of the time, given your dice\.$/);
    expect($('[data-accuracy]')).toBeNull();
    document.body.replaceChildren();
    const raise = setup(table([[6, 6, 6, 1, 2], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5]], { bid: { qty: 1, face: 2, by: 1 } }));
    raise.$('[data-hint]').click();
    expect(raise.$('[data-tip]').textContent).toMatch(/^Best: bid \w+ 6s?: true about \d+% of the time, given your dice\. The last bid is true about \d+%\.$/);
  });

  it('asks before New partway through, switches level, and words bids', () => {
    const { $, stored } = setup(table([[5, 5, 1, 2, 3], [1, 2, 3, 4, 6], [1, 2, 3, 4, 6]]));
    $('[data-bid]').click();
    $('[data-new]').click();
    answerNewGame();
    expect(stored().bid).toBeNull();
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect(bidWords(1, 6)).toBe('one 6');
    expect(bidWords(3, 2)).toBe('three 2s');
    expect(moveText(table([[1], [1], [1]]), table([[1], [1], [1]]))).toBeNull();
    $('[data-controls]').click(); // not on a button
    const broken = setup({ dice: 'x' });
    broken.unmount();
    expect(broken.stored().dice).toHaveLength(3);
  });
});

describe('Liar’s Dice colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});

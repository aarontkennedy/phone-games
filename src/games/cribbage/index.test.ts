import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import appCss from '../../style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, themes } from '../../test/contrast';
import { makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { nextStep, play, type State } from './logic';
import { card, cards, pegging, pile } from './test-fixtures';

function setup(saved: unknown = null) {
  if (saved) save('cribbage:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('cribbage:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const tap = (id: string) => $(`[data-hand][data-card="${id}"]`).click();
  return { container, unmount, $, $$, stored, status, tap };
}

const discarding = () =>
  pegging(['AH 2H 3H 4H 5H 6H', '7H 8H 9H 10H JS QH'], { phase: 'discard', starter: null, crib: [] });

/** The last card of the hand is about to be played, so the show comes next. */
function intoShow(crib = '6S 7S 8S 10S', starter = '5C'): State {
  const s = pegging(['3D', ''], { pile: pile(1, 'QC'), starter: card(starter), crib: cards(crib) });
  s.hands = [cards('3D'), []];
  s.kept = [cards('3D 4D 5D 6D'), cards('7C 8C 9C QC')];
  return play(s, 0, card('3D'))!;
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Cribbage screen', () => {
  it('starts by asking for two cards for the crib', () => {
    const { $, $$, status } = setup(discarding());
    expect($$('[data-hand]:not([disabled])')).toHaveLength(6);
    expect($$('.cb-who').map((w) => w.textContent)).toEqual(['You', 'Computer']);
    expect($('.cb-opponent').textContent).toContain('Computer · dealer');
    expect($$('.cb-opponent .card.back')).toHaveLength(6);
    expect($('[data-crib]').hidden).toBe(false);
    expect($<HTMLButtonElement>('[data-crib]').disabled).toBe(true);
    expect($('[data-next]').hidden).toBe(true);
    expect(status()).toBe('Pick 2 cards for the computer’s crib. 0 picked.');
  });

  it('picks two cards, then sends them to the crib and cuts the starter', () => {
    const { $, $$, status, stored, tap } = setup(discarding());
    tap('AH');
    tap('2H');
    tap('3H'); // a third pick drops the oldest
    expect($$('.card.picked').map((c) => c.dataset.card).sort()).toEqual(['2H', '3H']);
    tap('3H');
    tap('6H');
    expect(status()).toBe('Pick 2 cards for the computer’s crib. 2 picked.');
    $('[data-crib]').click();
    expect(stored().phase).toBe('pegging');
    expect(stored().crib).toEqual(expect.arrayContaining(cards('2H 6H')));
    expect($$('.cb-crib .card.back')).toHaveLength(4);
    expect($('.cb-spot .card:not(.back)')).not.toBeNull(); // the starter
    expect($('[data-crib]').hidden).toBe(true);
    expect(status()).toMatch(/Your turn\. The count is 0\.$/);
  });

  it('pegs: your card, then the computer’s, with the points explained', () => {
    const { $, status, stored, tap } = setup(pegging(['5H 9D', 'KS 3C']));
    tap('5H');
    expect($('[data-count]').textContent).toBe('5');
    expect(status()).toBe('Computer is playing…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().scores).toEqual([0, 2]);
    expect(status()).toBe('Computer scores 2 for fifteen. Your turn. The count is 15.');
  });

  it('tells you when you score, and when the computer says go', () => {
    const scored = setup(pegging(['KH 2D', '5S 9S'], { pile: pile(1, '5C') }));
    scored.tap('KH');
    expect(scored.status()).toBe('You score 2 for fifteen. Computer is playing…');
    document.body.replaceChildren();

    const go = setup(pegging(['AH 2D', 'KS'], { pile: pile(1, 'QC JC 5C') }));
    go.tap('AH');
    expect(go.status()).toBe('The computer says go. Your turn. The count is 26.');
    expect(go.$$('[data-hand]:not([disabled])').map((c) => c.dataset.card)).toEqual(['2D']); // 28 still fits
  });

  it('counts each hand in the show, then deals the next hand', () => {
    const { $, status, stored } = setup(intoShow());
    expect($('.cb-wide span').textContent).toBe('Your hand');
    expect(status()).toMatch(/^Your hand: .+\. Total \d+\.$/);
    expect($('[data-next]').textContent).toBe('Next');
    $('[data-next]').click();
    expect($('.cb-wide span').textContent).toBe('The computer’s hand');
    $('[data-next]').click();
    expect($('.cb-wide span').textContent).toBe('The computer’s crib');
    expect($('[data-next]').textContent).toBe('Next hand');
    $('[data-next]').click();
    expect(stored().phase).toBe('discard');
    expect(stored().dealer).toBe(0);
    expect(status()).toBe('Pick 2 cards for your crib. 0 picked.');
  });

  it('says when a hand scores nothing', () => {
    const crib = nextStep(nextStep(intoShow('2C 4C 6C 8C', 'KD'))!)!; // on to the crib
    expect(setup(crib).status()).toBe('The computer’s crib scores nothing.');
  });

  it.each([
    [[121, 98], 'You win!', 'You win 121 to 98!'],
    [[98, 121], 'The computer wins', 'The computer wins 121 to 98.'],
  ])('ends the game at %j', (scores, title, text) => {
    const s = pegging(['', ''], { phase: 'gameOver', scores: scores as [number, number] });
    const { $, status, stored } = setup(s);
    expect($('.overlay h2').textContent).toBe(title);
    expect(status()).toBe(text);
    $('.overlay .btn').click();
    expect(stored().scores).toEqual([0, 0]);
    expect(stored().phase).toBe('discard');
  });

  it('shows scores on the track', () => {
    const { $ } = setup(pegging(['5H', 'KS'], { scores: [60, 30] }));
    expect($('[data-player="0"] .cb-bar').getAttribute('aria-label')).toBe('60 of 121');
    expect($<HTMLElement>('[data-player="0"] .cb-bar > span').style.width).toMatch(/^49\.5/);
    expect($('[data-score="1"]').textContent).toBe('30');
  });

  it('switches Easy and Strong without restarting, and New starts over', () => {
    const { $, stored } = setup(pegging(['5H', 'KS'], { scores: [60, 30] }));
    $('[data-level="easy"]').click();
    expect(stored().level).toBe('easy');
    expect(stored().scores).toEqual([60, 30]);
    $('[data-new]').click();
    expect(stored().scores).toEqual([0, 0]);
  });

  it('ignores taps off the cards, and moves the rules refuse', () => {
    const { $, stored } = setup(pegging(['KH 2D', '5S'], { pile: pile(1, 'QC JC 9C') }));
    $('[data-board]').click();
    const king = $<HTMLButtonElement>('[data-card="KH"]');
    king.disabled = false; // 30 + 10 is over 31
    king.click();
    expect(stored().hands[0]).toHaveLength(2);
  });

  it('stops the computer when closed, and ignores a broken save', () => {
    const { unmount, stored } = setup(pegging(['5H', 'KS 3C'], { turn: 1 }));
    unmount();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(stored().hands[1]).toHaveLength(2);
    document.body.replaceChildren();
    expect(setup({ hands: 3 }).$$('[data-hand]')).toHaveLength(6);
  });
});

describe('Cribbage colors', () => {
  const cb = themes(css, '.cb');
  const app = themes(appCss, ':root');
  it.each([
    ['light', cb.light, app.light],
    ['dark', cb.dark, app.dark],
  ])('score bars stand out in the %s theme (3:1)', (_name, t, a) => {
    for (const fill of ['cb-you', 'cb-them']) {
      expect(contrast(t[fill], a.board), `${fill} on the table`).toBeGreaterThanOrEqual(3);
      expect(contrast(t[fill], t['cb-track']), `${fill} on its track`).toBeGreaterThanOrEqual(3);
    }
  });
});

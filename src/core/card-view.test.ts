import { describe, expect, it } from 'vitest';
import css from './cards.css?raw';
import appCss from '../style.css?raw';
import { cardBack, cardFace, cardSlot, suitSvg } from './card-view';
import { SUITS } from './cards';
import { contrast, themes } from '../test/contrast';

const html = (markup: string) => {
  const el = document.createElement('div');
  el.innerHTML = markup;
  return el.firstElementChild as HTMLElement;
};

describe('card view', () => {
  it('draws a face with rank, suit and a spoken name', () => {
    const card = html(cardFace({ suit: 'H', rank: 12 }));
    expect(card.tagName).toBe('DIV');
    expect(card.getAttribute('role')).toBe('img');
    expect(card.getAttribute('aria-label')).toBe('Queen of hearts');
    expect(card.dataset.card).toBe('QH');
    expect(card.classList.contains('red')).toBe(true);
    expect(card.querySelector('.card-rank')!.textContent).toBe('Q');
    expect(card.querySelectorAll('svg.suit')).toHaveLength(2);
  });

  it('marks black cards and makes tappable cards buttons', () => {
    const card = html(cardFace({ suit: 'S', rank: 1 }, { button: true, attrs: 'data-col="3"' }));
    expect(card.tagName).toBe('BUTTON');
    expect(card.hasAttribute('role')).toBe(false);
    expect(card.classList.contains('red')).toBe(false);
    expect(card.dataset.col).toBe('3');
  });

  it('draws backs and empty slots', () => {
    const back = html(cardBack());
    expect(back.classList.contains('back')).toBe(true);
    expect(back.getAttribute('aria-label')).toBe('Face-down card');
    const deck = html(cardBack({ button: true, label: 'Turn over cards' }));
    expect(deck.tagName).toBe('BUTTON');
    expect(deck.getAttribute('aria-label')).toBe('Turn over cards');

    const slot = html(cardSlot());
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    const labeled = html(cardSlot({ button: true, attrs: 'data-stock', label: 'Turn the pile over' }));
    expect(labeled.tagName).toBe('BUTTON');
    expect(labeled.getAttribute('aria-label')).toBe('Turn the pile over');
    expect(labeled.hasAttribute('data-stock')).toBe(true);

    const suit = html(cardSlot({ label: 'Empty hearts pile' }, suitSvg('H')));
    expect(suit.getAttribute('role')).toBe('img');
    expect(suit.querySelector('svg.suit')).not.toBeNull();
  });

  it.each(SUITS)('draws the %s suit as a flat SVG', (suit) => {
    const doc = new DOMParser().parseFromString(suitSvg(suit), 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('aria-hidden')).toBe('true');
    expect(doc.querySelectorAll('path')).toHaveLength(1);
    expect(doc.querySelectorAll('linearGradient, radialGradient, pattern, filter, image, [opacity]')).toHaveLength(0);
  });
});

describe('card colors', () => {
  const cards = themes(css, '.cards');
  const app = themes(appCss, ':root');

  it.each([
    ['light', cards.light, app.light],
    ['dark', cards.dark, app.dark],
  ])('meet contrast in the %s theme', (_name, c, a) => {
    expect(contrast(c['card-red'], c['card-face']), 'red rank on the face').toBeGreaterThanOrEqual(4.5);
    expect(contrast(c['card-black'], c['card-face']), 'black rank on the face').toBeGreaterThanOrEqual(4.5);
    expect(contrast(c['card-edge'], a.board), 'card edge on the table').toBeGreaterThanOrEqual(3);
    expect(contrast(c['card-back'], a.board), 'card back on the table').toBeGreaterThanOrEqual(3);
    expect(contrast(c['card-slot'], a.board), 'empty pile outline on the table').toBeGreaterThanOrEqual(3);
  });
});

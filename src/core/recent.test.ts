import { describe, expect, it } from 'vitest';
import { makeContainer } from '../test/helpers';
import { RECENT_HTML, RECENT_LINES, recentMoves } from './recent';
import { load, save } from './storage';

function setup() {
  const container = makeContainer();
  container.innerHTML = RECENT_HTML;
  const items = () => [...container.querySelectorAll('li')].map((li) => li.textContent).reverse(); // as on screen: oldest first
  return { container, items, list: container.querySelector<HTMLElement>('[data-recent]')! };
}

describe('recent moves', () => {
  it('is a labeled log, empty at first', () => {
    const { container, list, items } = setup();
    recentMoves(container, 'test');
    expect(list.getAttribute('role')).toBe('log');
    expect(list.getAttribute('aria-label')).toBe('Recent moves');
    expect(items()).toEqual([]);
  });

  it('adds moves at the end, keeps only the last few, and skips empty ones', () => {
    const { container, items } = setup();
    const r = recentMoves(container, 'test');
    r.add('One.');
    r.add(null);
    r.add(['Two.', null, '', 'Three.']);
    expect(items()).toEqual(['One.', 'Two.', 'Three.']);
    r.add(['Four.', 'Five.', 'Six.']);
    expect(RECENT_LINES).toBe(4);
    expect(items()).toEqual(['Three.', 'Four.', 'Five.', 'Six.']);
    expect(container.querySelector('li')!.textContent).toBe('Six.'); // newest first in the page; CSS shows it last
    expect(r.lines()).toEqual(items());
    expect(load('test:recent', null)).toEqual(items());
  });

  it('shows text as text, not markup', () => {
    const { container, list } = setup();
    recentMoves(container, 'test').add('<b>bold</b>');
    expect(list.querySelector('b')).toBeNull();
    expect(list.textContent).toBe('<b>bold</b>');
  });

  it('comes back after leaving the game, and clears for a new one', () => {
    save('test:recent', ['A.', 'B.', 'C.', 'D.', 'E.']);
    const first = setup();
    const r = recentMoves(first.container, 'test');
    expect(first.items()).toEqual(['B.', 'C.', 'D.', 'E.']);
    r.clear();
    expect(first.items()).toEqual([]);
    expect(load('test:recent', null)).toEqual([]);
  });

  it('ignores a damaged save', () => {
    save('test:recent', ['A.', 3]);
    const { container, items } = setup();
    recentMoves(container, 'test');
    expect(items()).toEqual([]);
  });
});

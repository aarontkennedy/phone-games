import { describe, expect, it } from 'vitest';
import { newDeck } from './cards';
import { handColumns, handHtml } from './trick-view';

describe('your hand', () => {
  it('uses 7 columns, more for a long hand so it stays in two rows, up to 10', () => {
    expect([1, 13, 14, 15, 16, 18, 20, 21, 30].map(handColumns)).toEqual([7, 7, 7, 8, 8, 9, 10, 10, 10]);
  });

  it('marks the cards after the first row, and widens the grid only when needed', () => {
    const html = (n: number) => {
      const el = document.createElement('div');
      el.innerHTML = handHtml(newDeck().slice(0, n), { playable: 'all' });
      return el.querySelector<HTMLElement>('.tt-hand')!;
    };
    const thirteen = html(13);
    expect(thirteen.querySelectorAll('.next-row')).toHaveLength(6);
    expect(thirteen.style.getPropertyValue('--hand-cols')).toBe('');
    const eighteen = html(18);
    expect(eighteen.querySelectorAll('.next-row')).toHaveLength(9);
    expect(eighteen.style.getPropertyValue('--hand-cols')).toBe('9');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { hideOverlay, showOverlay } from './ui';

describe('overlay', () => {
  function host() {
    const el = document.createElement('div');
    document.body.append(el);
    return el;
  }

  it('shows a titled dialog with a primary and secondary button', () => {
    const el = host();
    const first = vi.fn();
    const second = vi.fn();
    showOverlay(el, 'You win!', [
      ['Keep going', first],
      ['New game', second],
    ]);

    const overlay = el.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.hidden).toBe(false);
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-label')).toBe('You win!');
    expect(overlay.querySelector('h2')!.textContent).toBe('You win!');

    const buttons = overlay.querySelectorAll('button');
    expect([...buttons].map((b) => [b.textContent, b.className])).toEqual([
      ['Keep going', 'btn'],
      ['New game', 'btn secondary'],
    ]);
    buttons[1].click();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it('reuses one overlay and replaces its contents', () => {
    const el = host();
    showOverlay(el, 'One', [['A', () => {}]]);
    showOverlay(el, 'Two', [['B', () => {}]]);
    expect(el.querySelectorAll('.overlay')).toHaveLength(1);
    expect(el.querySelector('h2')!.textContent).toBe('Two');
    expect(el.querySelectorAll('button')).toHaveLength(1);
  });

  it('hides the overlay', () => {
    const el = host();
    showOverlay(el, 'Hi', []);
    hideOverlay(el);
    expect(el.querySelector<HTMLElement>('.overlay')!.hidden).toBe(true);
  });

  it('does nothing when hiding without an overlay', () => {
    const el = host();
    expect(() => hideOverlay(el)).not.toThrow();
    expect(el.children).toHaveLength(0);
  });
});

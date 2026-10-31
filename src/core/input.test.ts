import { describe, expect, it, vi } from 'vitest';
import { onArrowKeys, onSwipe } from './input';
import { pointer, press } from '../test/helpers';

describe('onSwipe', () => {
  function setup(threshold?: number) {
    const el = document.createElement('div');
    document.body.append(el);
    const handler = vi.fn();
    const stop = onSwipe(el, handler, threshold);
    const swipe = (dx: number, dy: number, id = 1) => {
      pointer(el, 'pointerdown', { x: 100, y: 100, id });
      pointer(el, 'pointerup', { x: 100 + dx, y: 100 + dy, id });
    };
    return { el, handler, stop, swipe };
  }

  it.each([
    [50, 0, 'right'],
    [-50, 0, 'left'],
    [0, 50, 'down'],
    [0, -50, 'up'],
    [40, 30, 'right'],
    [30, -40, 'up'],
  ])('detects a swipe of (%i, %i) as %s', (dx, dy, dir) => {
    const { handler, swipe } = setup();
    swipe(dx, dy);
    expect(handler).toHaveBeenCalledExactlyOnceWith(dir);
  });

  it('ignores movements shorter than the threshold', () => {
    const { handler, swipe } = setup();
    swipe(23, 10);
    expect(handler).not.toHaveBeenCalled();
  });

  it('respects a custom threshold', () => {
    const { handler, swipe } = setup(100);
    swipe(60, 0);
    expect(handler).not.toHaveBeenCalled();
    swipe(120, 0);
    expect(handler).toHaveBeenCalledWith('right');
  });

  it('ignores pointerup from a different pointer', () => {
    const { el, handler } = setup();
    pointer(el, 'pointerdown', { x: 0, y: 0, id: 1 });
    pointer(el, 'pointerup', { x: 80, y: 0, id: 2 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores pointerup without a pointerdown', () => {
    const { el, handler } = setup();
    pointer(el, 'pointerup', { x: 80, y: 0 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('forgets the gesture on pointercancel', () => {
    const { el, handler } = setup();
    pointer(el, 'pointerdown', { x: 0, y: 0 });
    pointer(el, 'pointercancel');
    pointer(el, 'pointerup', { x: 80, y: 0 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops listening after cleanup', () => {
    const { handler, stop, swipe } = setup();
    stop();
    swipe(80, 0);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('onArrowKeys', () => {
  it.each([
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down'],
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['w', 'up'],
    ['s', 'down'],
    ['a', 'left'],
    ['d', 'right'],
  ])('maps %s to %s and prevents scrolling', (key, dir) => {
    const handler = vi.fn();
    const stop = onArrowKeys(handler);
    const e = press(key);
    expect(handler).toHaveBeenCalledExactlyOnceWith(dir);
    expect(e.defaultPrevented).toBe(true);
    stop();
  });

  it('ignores other keys', () => {
    const handler = vi.fn();
    const stop = onArrowKeys(handler);
    const e = press('Enter');
    expect(handler).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    stop();
  });

  it('stops listening after cleanup', () => {
    const handler = vi.fn();
    onArrowKeys(handler)();
    press('ArrowUp');
    expect(handler).not.toHaveBeenCalled();
  });
});

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Calls `handler` when the user swipes on `el`. The element should have
 * `touch-action: none` so the browser doesn't cancel the gesture to scroll.
 */
export function onSwipe(el: HTMLElement, handler: (dir: Direction) => void, threshold = 24): () => void {
  let start: { x: number; y: number; id: number } | null = null;

  const down = (e: PointerEvent) => {
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    handler(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };
  const cancel = () => {
    start = null;
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}

const ARROW_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

/** Arrow keys / WASD, handy when testing on a desktop browser. */
export function onArrowKeys(handler: (dir: Direction) => void): () => void {
  const listener = (e: KeyboardEvent) => {
    const dir = ARROW_KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    handler(dir);
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}

// Test-only helpers shared by unit tests.
import { expect, vi } from 'vitest';

export interface PointerInit {
  x?: number;
  y?: number;
  id?: number;
  button?: number;
}

/** Dispatches a pointer-style event. jsdom lacks PointerEvent, so this is a MouseEvent with a pointerId. */
export function pointer(el: Element, type: string, init: PointerInit = {}): MouseEvent {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
    button: init.button ?? 0,
  });
  Object.defineProperty(e, 'pointerId', { value: init.id ?? 1 });
  el.dispatchEvent(e);
  return e;
}

/** A quick tap: pointerdown then pointerup at the same spot. */
export function tap(el: Element): void {
  pointer(el, 'pointerdown');
  pointer(el, 'pointerup');
}

export function press(key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

const mounted = new Set<() => void>();

/**
 * Registers a game's unmount function so it runs after the test even if the test
 * doesn't call it. Otherwise window/document listeners leak into later tests.
 */
export function track(unmount: () => void): () => void {
  const once = () => {
    if (mounted.delete(once)) unmount();
  };
  mounted.add(once);
  return once;
}

export function unmountAll(): void {
  for (const unmount of [...mounted]) unmount();
}

/** Creates an attached container element for mounting a game. */
export function makeContainer(): HTMLElement {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
}

/** Controls document.hidden for visibility tests. */
export function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets pending promises and zero-delay timers run. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Answers "Start a new game?" (confirmNew). Fails if the question wasn't asked. */
export function answerNewGame(choice: 'new' | 'keep' = 'new'): void {
  const button = document.querySelector<HTMLButtonElement>(`.confirm [data-${choice === 'new' ? 'confirm' : 'cancel'}]`);
  if (!button) throw new Error('Expected "Start a new game?" to be asked');
  button.click();
}

/**
 * Waits well past any computer move and checks the saved game didn't change: a finished
 * game must stay finished. (Four in a Row once let the computer play on after your win.)
 */
export function expectStaysFinished(stored: () => unknown, wait = 10_000): void {
  const before = JSON.stringify(stored());
  vi.advanceTimersByTime(wait);
  expect(JSON.stringify(stored())).toBe(before);
}

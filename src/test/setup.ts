import { afterEach, vi } from 'vitest';
import { unmountAll } from './helpers';

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
  localStorage.clear();
  document.body.replaceChildren();
  history.replaceState(null, '', '/');
});

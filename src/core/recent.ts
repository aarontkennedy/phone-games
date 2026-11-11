// Recent moves: a short list under the board of what just happened, so moves the
// computer makes between your turns don't flash by unseen (docs/DESIGN.md, "Recent moves").
// On screen the oldest is at the top and the newest at the bottom, just above the status
// line; in the page (for screen readers) the newest comes first.
import { load, save } from './storage';

/** How many moves the list keeps. */
export const RECENT_LINES = 4;

/** The list's markup: put it between `.board-frame` and `.status-line`. */
export const RECENT_HTML = '<ol class="recent" data-recent role="log" aria-label="Recent moves"></ol>';

export interface Recent {
  /** Adds moves to the end, dropping the oldest past RECENT_LINES. Empty entries are skipped. */
  add(lines: string | null | readonly (string | null)[]): void;
  /** Empties the list, for a new game, round or hand. */
  clear(): void;
  lines(): string[];
}

const isLines = (x: unknown): x is string[] => Array.isArray(x) && x.every((l) => typeof l === 'string');

/**
 * Shows the recent moves in `container`'s `[data-recent]` list and keeps them saved under
 * `${id}:recent`, so leaving the game and coming back keeps them.
 */
export function recentMoves(container: HTMLElement, id: string): Recent {
  const key = `${id}:recent`;
  const el = container.querySelector<HTMLElement>('[data-recent]')!;
  const saved = load<unknown>(key, []);
  let lines: string[] = isLines(saved) ? saved.slice(-RECENT_LINES) : [];

  function show() {
    save(key, lines);
    // Newest first in the page; CSS (column-reverse) shows it at the bottom. Sideways, the
    // list can be shorter than its moves, and a reversed column stays scrolled to its end,
    // so the newest move stays in view however the layout changes.
    el.replaceChildren(
      ...[...lines].reverse().map((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }),
    );
  }

  show();
  return {
    add(more) {
      const added = (typeof more === 'string' || more === null ? [more] : more).filter((l): l is string => !!l);
      if (!added.length) return;
      lines = [...lines, ...added].slice(-RECENT_LINES);
      show();
    },
    clear() {
      lines = [];
      show();
    },
    lines: () => [...lines],
  };
}

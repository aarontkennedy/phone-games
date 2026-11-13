// Recent moves: a short list under the status line of what just happened, so moves the
// computer makes between your turns don't flash by unseen (docs/DESIGN.md, "Recent moves").
// The newest is first, at the top, right under the status line; older ones follow and
// scroll inside the list when it's short on room.
import { load, save } from './storage';

/** How many moves the list keeps. */
export const RECENT_LINES = 4;

/** The list's markup: put it between `.status-line` and `.controls`. */
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
    // Newest first, at the top; scrolled back to the top so it's in view even when the
    // list is shorter than its moves.
    el.replaceChildren(
      ...[...lines].reverse().map((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }),
    );
    el.scrollTop = 0;
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

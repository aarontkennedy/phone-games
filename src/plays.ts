// How often each game is opened on this device, for the home screen's Most played row.
// Stored locally like everything else; nothing leaves the phone.
import { load, save } from './core/storage';

const KEY = 'plays';
/** How many games the Most played row shows. */
export const MOST_PLAYED = 2;

export type Plays = Record<string, { count: number; last: number }>;

export function loadPlays(): Plays {
  const raw = load<unknown>(KEY, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const plays: Plays = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const entry = v as { count?: unknown; last?: unknown } | null;
    if (entry && Number.isInteger(entry.count) && (entry.count as number) > 0 && typeof entry.last === 'number') {
      plays[id] = { count: entry.count as number, last: entry.last };
    }
  }
  return plays;
}

/** Counts one more opening of a game. */
export function recordPlay(id: string, now = Date.now()): void {
  const plays = loadPlays();
  plays[id] = { count: (plays[id]?.count ?? 0) + 1, last: now };
  save(KEY, plays);
}

/** The most-opened games among `ids`, most first; ties go to the one opened last. */
export function mostPlayed(ids: string[], plays: Plays = loadPlays(), n = MOST_PLAYED): string[] {
  return ids
    .filter((id) => plays[id])
    .sort((a, b) => plays[b].count - plays[a].count || plays[b].last - plays[a].last)
    .slice(0, n);
}

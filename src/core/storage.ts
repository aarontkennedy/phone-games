// Thin wrapper over localStorage. Access can throw (private mode, storage full),
// so every call is guarded and falls back gracefully.

const PREFIX = 'pg:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore: the game still works, it just won't persist.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore.
  }
}

/** True if this browser keeps what we save (it may not in private mode, or with storage blocked). */
export function storageWorks(): boolean {
  try {
    localStorage.setItem(`${PREFIX}test`, '1');
    localStorage.removeItem(`${PREFIX}test`);
    return true;
  } catch {
    return false;
  }
}

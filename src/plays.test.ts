import { describe, expect, it } from 'vitest';
import { save } from './core/storage';
import { loadPlays, mostPlayed, recordPlay } from './plays';

describe('play counts', () => {
  it('counts each opening and remembers when', () => {
    recordPlay('hearts', 100);
    recordPlay('hearts', 200);
    recordPlay('mines', 150);
    expect(loadPlays()).toEqual({ hearts: { count: 2, last: 200 }, mines: { count: 1, last: 150 } });
  });

  it('ranks by count, then by the most recent, ignoring games that no longer exist', () => {
    const plays = { a: { count: 1, last: 5 }, b: { count: 3, last: 1 }, c: { count: 1, last: 9 }, gone: { count: 9, last: 9 } };
    expect(mostPlayed(['a', 'b', 'c'], plays)).toEqual(['b', 'c']);
    expect(mostPlayed(['a', 'b', 'c'], plays, 3)).toEqual(['b', 'c', 'a']);
    expect(mostPlayed(['a'], {})).toEqual([]);
  });

  it('ignores damaged data', () => {
    save('plays', [1, 2]);
    expect(loadPlays()).toEqual({});
    save('plays', { ok: { count: 2, last: 1 }, zero: { count: 0, last: 1 }, bad: { count: 'x', last: 1 }, odd: null, late: { count: 1 } });
    expect(loadPlays()).toEqual({ ok: { count: 2, last: 1 } });
    save('plays', null);
    expect(loadPlays()).toEqual({});
  });
});

import { describe, expect, it, vi } from 'vitest';
import { seededRng } from '../../core/random';
import {
  LEVELS,
  countAt,
  flagsLeft,
  isFinished,
  isValidState,
  neighbors,
  newState,
  open,
  placeMines,
  toggleFlag,
  type Level,
  type State,
} from './logic';
import { fixture } from './test-fixtures';

const revealedCount = (s: State) => s.revealed.filter(Boolean).length;

describe('LEVELS', () => {
  it.each(Object.entries(LEVELS))('%s leaves room for a safe first tap', (_id, l) => {
    expect(l.mines).toBeGreaterThan(0);
    expect(l.mines).toBeLessThanOrEqual(l.cols * l.rows - 9);
  });

  it('gets harder at each level', () => {
    const { easy, medium, hard } = LEVELS;
    expect(easy.cols * easy.rows).toBeLessThan(medium.cols * medium.rows);
    expect(medium.cols * medium.rows).toBeLessThan(hard.cols * hard.rows);
  });
});

describe('newState', () => {
  it.each(Object.keys(LEVELS) as Level[])('creates an empty %s board', (level) => {
    const s = newState(level);
    const n = LEVELS[level].cols * LEVELS[level].rows;
    expect(s.revealed).toHaveLength(n);
    expect(s.flagged).toHaveLength(n);
    expect(s).toMatchObject({ level, mines: null, status: 'ready', elapsed: 0, exploded: -1 });
  });
});

describe('isValidState', () => {
  it('accepts new and in-progress games', () => {
    expect(isValidState(newState('hard'))).toBe(true);
    expect(isValidState(fixture())).toBe(true);
  });

  const easy = newState('easy');
  it.each([
    ['null', null],
    ['an unknown level', { ...easy, level: 'expert' }],
    ['an inherited property as level', { ...easy, level: 'toString' }],
    ['a non-string level', { ...easy, level: 3 }],
    ['wrong revealed length', { ...easy, revealed: [false] }],
    ['missing flagged', { ...easy, flagged: undefined }],
    ['wrong flagged length', { ...easy, flagged: [] }],
    ['wrong mines length', { ...easy, mines: [true] }],
    ['non-array mines', { ...easy, mines: 'x' }],
    ['a board from a different level', { ...newState('medium'), level: 'easy' }],
  ])('rejects %s', (_label, value) => {
    expect(isValidState(value)).toBe(false);
  });
});

describe('neighbors', () => {
  it('finds 3 for a corner, 5 for an edge and 8 in the middle', () => {
    expect(neighbors(0, 3, 3).sort()).toEqual([1, 3, 4]);
    expect(neighbors(1, 3, 3).sort()).toEqual([0, 2, 3, 4, 5]);
    expect(neighbors(4, 3, 3).sort()).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(neighbors(8, 3, 3).sort()).toEqual([4, 5, 7]);
  });

  it('does not wrap around rows', () => {
    expect(neighbors(2, 3, 3)).not.toContain(3);
    expect(neighbors(3, 3, 3)).not.toContain(2);
  });
});

describe('placeMines', () => {
  it.each(Object.keys(LEVELS) as Level[])('places the right number of mines on %s, never near the first tap', (level) => {
    const { cols, rows, mines } = LEVELS[level];
    for (let seed = 1; seed <= 30; seed++) {
      const safe = (seed * 7) % (cols * rows);
      const m = placeMines(level, safe, seededRng(seed));
      expect(m.filter(Boolean)).toHaveLength(mines);
      for (const i of [safe, ...neighbors(safe, cols, rows)]) expect(m[i]).toBe(false);
    }
  });

  it('is deterministic with a seeded rng', () => {
    expect(placeMines('hard', 50, seededRng(4))).toEqual(placeMines('hard', 50, seededRng(4)));
  });

  it('defaults to Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.3);
    placeMines('easy', 0);
    expect(spy).toHaveBeenCalled();
  });
});

describe('counting', () => {
  it('counts touching mines', () => {
    const s = fixture();
    expect(countAt(s, 6)).toBe(2); // below mines 0 and 1
    expect(countAt(s, 7)).toBe(3);
    expect(countAt(s, 11)).toBe(1);
    expect(countAt(s, 35)).toBe(0);
  });

  it('counts zero before mines are placed', () => {
    expect(countAt(newState('easy'), 7)).toBe(0);
  });

  it('tracks flags left, even below zero', () => {
    const s = fixture();
    expect(flagsLeft(s)).toBe(5);
    s.flagged.fill(true, 10, 16);
    expect(flagsLeft(s)).toBe(-1);
  });

  it('knows when the game is finished', () => {
    const s = fixture();
    expect(isFinished(s)).toBe(false);
    s.status = 'won';
    expect(isFinished(s)).toBe(true);
    s.status = 'lost';
    expect(isFinished(s)).toBe(true);
  });
});

describe('open', () => {
  it('places mines on the first dig, away from the tapped cell', () => {
    const s = newState('easy');
    open(s, 14, seededRng(1));
    expect(s.mines).not.toBeNull();
    expect(s.mines![14]).toBe(false);
    expect(s.revealed[14]).toBe(true);
    expect(s.status).not.toBe('lost');
    expect(s.status).not.toBe('ready');
  });

  it('defaults to Math.random for the first dig', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    open(newState('easy'), 0);
    expect(spy).toHaveBeenCalled();
  });

  it('flood-fills empty areas and stops at numbers', () => {
    const s = fixture();
    open(s, 35);
    expect(revealedCount(s)).toBe(30); // everything except 5 mines and cell 5
    expect(s.revealed[5]).toBe(false);
    expect(s.status).toBe('playing');
  });

  it('reveals only the cell when it has a number', () => {
    const s = fixture();
    open(s, 7);
    expect(revealedCount(s)).toBe(1);
  });

  it('does not open flagged cells or flood through them', () => {
    const s = fixture();
    s.flagged[35] = true;
    open(s, 35);
    expect(revealedCount(s)).toBe(0);
    s.flagged[35] = false;
    s.flagged[28] = true;
    open(s, 35);
    expect(s.revealed[28]).toBe(false);
  });

  it('loses when digging a mine', () => {
    const s = fixture();
    open(s, 2);
    expect(s.status).toBe('lost');
    expect(s.exploded).toBe(2);
  });

  it('wins when every safe cell is revealed, flagging all mines', () => {
    const s = fixture();
    open(s, 35);
    open(s, 5);
    expect(s.status).toBe('won');
    expect(s.flagged).toEqual(s.mines);
  });

  it('does nothing once the game is finished', () => {
    const s = fixture();
    s.status = 'lost';
    open(s, 35);
    expect(revealedCount(s)).toBe(0);
  });

  describe('chording (opening a revealed number)', () => {
    const opened = () => {
      const s = fixture();
      open(s, 35);
      return s;
    };

    it('reveals the other neighbors when the flags match the number', () => {
      const s = opened();
      s.flagged[4] = true;
      open(s, 11); // 11 touches mine 4 and hidden safe cell 5
      expect(s.revealed[5]).toBe(true);
      expect(s.status).toBe('won');
    });

    it('loses when a flag is in the wrong place', () => {
      const s = opened();
      s.flagged[5] = true; // wrong: 5 is safe, 4 is the mine
      open(s, 11);
      expect(s.status).toBe('lost');
      expect(s.exploded).toBe(4);
    });

    it('does nothing without enough flags', () => {
      const s = opened();
      const before = revealedCount(s);
      open(s, 11);
      expect(revealedCount(s)).toBe(before);
      expect(s.status).toBe('playing');
    });

    it('does nothing on an empty cell', () => {
      const s = opened();
      const before = structuredClone(s);
      open(s, 35);
      expect(s).toEqual(before);
    });
  });
});

describe('toggleFlag', () => {
  it('flags and unflags hidden cells', () => {
    const s = fixture();
    expect(toggleFlag(s, 3)).toBe(true);
    expect(s.flagged[3]).toBe(true);
    expect(toggleFlag(s, 3)).toBe(true);
    expect(s.flagged[3]).toBe(false);
  });

  it('works before the first dig', () => {
    const s = newState('easy');
    expect(toggleFlag(s, 0)).toBe(true);
  });

  it('ignores revealed cells', () => {
    const s = fixture();
    open(s, 35);
    expect(toggleFlag(s, 35)).toBe(false);
    expect(s.flagged[35]).toBe(false);
  });

  it('ignores finished games', () => {
    const s = fixture();
    s.status = 'won';
    expect(toggleFlag(s, 3)).toBe(false);
  });
});

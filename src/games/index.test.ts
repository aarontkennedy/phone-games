import { describe, expect, it } from 'vitest';
import { games } from './index';
import { makeContainer } from '../test/helpers';

// Names that are, or may be, someone's trademark. Kept conservative on purpose.
// Rules: docs/LEGAL.md. Add to this list; only remove after a real check.
const PROTECTED_NAMES = [
  'yahtzee',
  'tetris',
  'scrabble',
  'boggle',
  'uno',
  'monopoly',
  'rummikub',
  'mahjong titans',
  'candy crush',
  'bejeweled',
  'threes',
  'minesweeper',
  'freecell',
  'wordle',
  'sudoku',
];

describe('game registry', () => {
  it('has unique, URL-safe ids', () => {
    const ids = games.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('gives every game a title and description', () => {
    for (const g of games) {
      expect(g.title.trim()).not.toBe('');
      expect(g.description.trim()).not.toBe('');
    }
  });

  it('gives every game a flat SVG icon', () => {
    for (const g of games) {
      const doc = new DOMParser().parseFromString(g.icon, 'image/svg+xml');
      const root = doc.documentElement;
      expect(root.nodeName, g.id).toBe('svg');
      expect(root.getAttribute('aria-hidden'), g.id).toBe('true');
      expect(doc.querySelector('parsererror'), g.id).toBeNull();
      const banned = doc.querySelectorAll(
        'linearGradient, radialGradient, pattern, filter, image, foreignObject, [filter], [opacity]',
      );
      expect(banned, `${g.id} icon is not flat`).toHaveLength(0);
    }
  });

  it('uses no protected names in visible text', () => {
    for (const g of games) {
      const text = `${g.title} ${g.description}`.toLowerCase();
      for (const name of PROTECTED_NAMES) {
        expect(text, `${g.id} mentions "${name}"`).not.toMatch(new RegExp(`\\b${name}\\b`));
      }
    }
  });

  it.each(games.map((g) => [g.id, g]))('%s loads, mounts and cleans up', async (_id, g) => {
    const module = await g.load();
    const container = makeContainer();
    const unmount = module.mount(container);
    expect(container.children.length).toBeGreaterThan(0);
    unmount();
    expect(container.children).toHaveLength(0);
  });
});

import { expect, test } from '@playwright/test';
import { failOnErrors, seedRandom } from './helpers';

// The buttons at the bottom share their row equally (docs/DESIGN.md, "Steady controls"):
// one fills the width, two take half each, and so on. A line that wraps shares its own width.
const GAMES = [
  '2048', 'backgammon', 'blackjack', 'checkers', 'chess', 'craps', 'crazyeights', 'cribbage', 'dominoes', 'dots', 'drawpoker',
  'euchre', 'fourinarow', 'freecells', 'gin', 'gofish', 'hangman', 'hearts', 'holdem', 'hotdice', 'mancala', 'minesweeper',
  'numberplace', 'paigow', 'reversi', 'roulette', 'rummy', 'solitaire', 'spades', 'spider', 'tictactoe', 'videopoker', 'yacht',
  'pyramid', 'baccarat', 'shutbox', 'anagrams', 'wordsearch', 'ladder', 'wordgrid', 'pegs', 'crosssums',
];

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
});

for (const id of GAMES) {
  test(`${id}: bottom buttons share their row equally`, async ({ page }) => {
    await page.goto(`./#/${id}`);
    await expect(page.locator('.game .screen')).toBeVisible();
    const lines = await page.evaluate(() => {
      const controls = document.querySelector<HTMLElement>('.game .controls');
      if (!controls) return []; // Some board games have no buttons at the bottom.
      const box = controls.getBoundingClientRect();
      const shown = (el: Element) => el.getBoundingClientRect().width > 0;
      // Everything that sits in the controls' rows: direct children, or an .actions row's.
      const items = [...controls.children].flatMap((el) => (el.classList.contains('actions') ? [...el.children] : [el]));
      const rows = new Map<number, { left: number; right: number; widths: number[] }>();
      for (const el of items.filter(shown)) {
        const r = el.getBoundingClientRect();
        const row = rows.get(Math.round(r.top)) ?? { left: Infinity, right: -Infinity, widths: [] };
        row.left = Math.min(row.left, r.left);
        row.right = Math.max(row.right, r.right);
        if (el.matches('.btn') && getComputedStyle(el).flexGrow === '1') row.widths.push(r.width);
        rows.set(Math.round(r.top), row);
      }
      return [...rows.values()]
        .filter((row) => row.widths.length)
        .map((row) => ({ ...row, boxLeft: box.left, boxRight: box.right }));
    });
    for (const line of lines) {
      expect(line.left).toBeCloseTo(line.boxLeft, 0);
      expect(line.right).toBeCloseTo(line.boxRight, 0);
      for (const w of line.widths) expect(Math.abs(w - line.widths[0])).toBeLessThanOrEqual(1);
    }
  });
}

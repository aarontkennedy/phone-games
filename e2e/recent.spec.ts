import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, failOnErrors, seedRandom } from './helpers';

// Recent moves (docs/DESIGN.md, "Recent moves"): a short list under the board in the games
// where the computer makes moves between your turns. Full of long moves, it must still fit
// the phone, upright and sideways, with the newest move in view.
const GAMES = ['gofish', 'crazyeights', 'rummy', 'gin', 'holdem', 'drawpoker', 'dominoes', 'hotdice'];

const LONG = [
  'West asked North for queens: go fish, drew a queen, goes again. Book of queens.',
  'The computer took the 7 of diamonds from the pile and 2 more.',
  'The computer rolled 1 3 5 5 6, kept 1 5 5 for 200.',
  'East asked you for 10s and got 3.',
];

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
});

async function openWithMoves(page: Page, id: string) {
  await page.addInitScript(([key, lines]) => localStorage.setItem(key, lines), [`pg:${id}:recent`, JSON.stringify(LONG)] as const);
  await page.goto(`./#/${id}`);
  await expect(page.locator('[data-recent] li')).toHaveCount(4);
}

/** The newest move is fully inside the list's visible box. */
async function expectNewestInView(page: Page) {
  const list = (await page.locator('[data-recent]').boundingBox())!;
  const newest = (await page.locator('[data-recent] li').first().boundingBox())!;
  expect(newest.y).toBeGreaterThanOrEqual(list.y - 1);
  expect(newest.y + newest.height).toBeLessThanOrEqual(list.y + list.height + 1);
}

for (const id of GAMES) {
  test(`${id}: the status line sits under the board, recent moves under it, and the controls stay on screen`, async ({ page }) => {
    await openWithMoves(page, id);
    const board = (await page.locator('.board-frame').boundingBox())!;
    const list = (await page.locator('[data-recent]').boundingBox())!;
    const status = (await page.locator('.status-line').boundingBox())!;
    const controls = (await page.locator('.controls').boundingBox())!;
    expect(status.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
    expect(list.y).toBeGreaterThanOrEqual(status.y + status.height - 1);
    expect(controls.y).toBeGreaterThanOrEqual(list.y + list.height - 1);
    const sizes = `board ${board.y}+${board.height}, list ${list.y}+${list.height}, controls ${controls.y}+${controls.height}`;
    // At least the newest move shows (older ones scroll inside the list), and the buttons
    // are still on screen.
    expect(list.height, sizes).toBeGreaterThanOrEqual(18 * 1.35);
    expect(controls.y + controls.height, sizes).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    await expectNewestInView(page);
    await expectNoHorizontalOverflow(page);
    await expectReadableText(page);
  });
}

for (const size of [
  { name: 'iPhone 13', width: 844, height: 390 },
  { name: 'iPhone SE', width: 667, height: 375 },
]) {
  for (const id of GAMES) {
    test(`${id} sideways on an ${size.name}: recent moves fit the side bar, newest in view`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openWithMoves(page, id);
      const board = (await page.locator('.board-frame').boundingBox())!;
      const list = (await page.locator('[data-recent]').boundingBox())!;
      expect(list.x).toBeGreaterThanOrEqual(board.x + board.width - 1);
      expect(list.x + list.width).toBeLessThanOrEqual(size.width + 1);
      const status = (await page.locator('.status-line').boundingBox())!;
      expect(list.y).toBeGreaterThanOrEqual(status.y + status.height - 1); // the same order as upright
      // At least two lines of text show.
      expect(list.height).toBeGreaterThanOrEqual(2 * 18 * 1.35);
      const scrollY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      expect(scrollY).toBeLessThanOrEqual(0);
      await expectNewestInView(page);
      await expectNoHorizontalOverflow(page);
    });
  }
}

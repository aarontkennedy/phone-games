import { expect, test, type Page } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  expectReadableText,
  expectTouchTargets,
  failOnErrors,
  seedRandom,
  swipe,
} from './helpers';

// Phones turned sideways: controls in a side bar on the left, the board on the right,
// everything on one screen (docs/DESIGN.md, "Landscape").
const SIZES = [
  { name: 'iPhone 13', width: 844, height: 390 },
  { name: 'iPhone SE', width: 667, height: 375 },
];

const MIN_CELL_PX = 26;

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
});

async function expectSideBarLayout(page: Page) {
  const viewport = page.viewportSize()!;
  const board = (await page.locator('.board-frame').boundingBox())!;

  // The board is fully on screen and on the right.
  expect(board.y).toBeGreaterThanOrEqual(0);
  expect(board.y + board.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(board.x + board.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(board.width).toBeGreaterThan(viewport.height * 0.8);

  // Every control sits to the left of the board.
  for (const el of await page.locator('.topbar, .stats, .controls, .status-line').all()) {
    const box = (await el.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(board.x + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }

  // Nothing scrolls, either way.
  const scrollY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(scrollY).toBeLessThanOrEqual(0);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
}

for (const size of SIZES) {
  test.describe(`${size.name} sideways`, () => {
    test.beforeEach(({ page }) => page.setViewportSize({ width: size.width, height: size.height }));

    test('2048: side bar on the left, board on the right, swipes still work', async ({ page }) => {
      await page.goto('./#/2048');
      await expectSideBarLayout(page);

      const tiles = () => page.locator('.g2048-cell').evaluateAll((els) => els.map((e) => e.textContent));
      const before = await tiles();
      for (const [dx, dy] of [[-120, 0], [0, -120], [120, 0], [0, 120]]) await swipe(page.locator('.g2048'), dx, dy);
      expect(await tiles()).not.toEqual(before);
    });

    for (const level of ['easy', 'medium', 'hard']) {
      test(`Mines ${level}: side bar on the left, board on the right`, async ({ page }) => {
        await page.goto('./#/minesweeper');
        await page.locator(`[data-level="${level}"]`).click();
        await expectSideBarLayout(page);
        const cell = (await page.locator('[data-i="0"]').boundingBox())!;
        expect(cell.width).toBeGreaterThanOrEqual(MIN_CELL_PX);
      });
    }

    test('Solitaire: side bar on the left, cards on the right', async ({ page }) => {
      await page.goto('./#/solitaire');
      await expectSideBarLayout(page);
      await page.locator('[data-draw="3"]').click();
      await page.locator('[data-stock]').click();
      await expectSideBarLayout(page);
    });

    test('home and About still fit the width', async ({ page }) => {
      await page.goto('./');
      await expectNoHorizontalOverflow(page);
      await expectReadableText(page);
      await page.getByRole('link', { name: 'About' }).click();
      await expectNoHorizontalOverflow(page);
    });
  });
}

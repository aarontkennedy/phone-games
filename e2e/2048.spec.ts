import { expect, test } from '@playwright/test';
import { failOnErrors, seedRandom, swipe } from './helpers';

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
  await page.goto('./#/2048');
});

const tiles = (page: import('@playwright/test').Page) =>
  page.locator('.g2048-cell').evaluateAll((els) => els.map((e) => e.textContent));

test('swipes move tiles', async ({ page }) => {
  const board = page.locator('.g2048');
  const before = await tiles(page);
  for (const [dx, dy] of [[-120, 0], [0, -120], [120, 0], [0, 120]]) await swipe(board, dx, dy);
  expect(await tiles(page)).not.toEqual(before);
  expect((await tiles(page)).filter(Boolean).length).toBeGreaterThan(2);
});

test('the game survives a reload', async ({ page }) => {
  const board = page.locator('.g2048');
  await swipe(board, -120, 0);
  await swipe(board, 0, 120);
  const before = await tiles(page);
  await page.reload();
  expect(await tiles(page)).toEqual(before);
});

test('the board is square and fills the width', async ({ page }) => {
  const box = (await page.locator('.g2048-board').boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(Math.abs(box.width - box.height)).toBeLessThan(2);
  expect(box.width).toBeGreaterThan(width * 0.8);
});

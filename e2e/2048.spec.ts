import { expect, test } from '@playwright/test';
import { expectReadableText, failOnErrors, seedRandom, swipe } from './helpers';

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

test('tile numbers are readable without glasses, even 5 digits', async ({ page }) => {
  const board = [2, 64, 1024, 16384, ...Array(12).fill(0)];
  await page.evaluate((b) => localStorage.setItem('pg:2048:state', JSON.stringify({ board: b, score: 0 })), board);
  // Reopen the game instead of reloading: a reload can interrupt WebKit's service worker install.
  await page.getByRole('link', { name: '‹ Games' }).click();
  await page.locator('a[href="#/2048"]').click();
  await expect(page.locator('.g2048-cell[data-digits="5"]')).toHaveText('16384');
  await expectReadableText(page);
});

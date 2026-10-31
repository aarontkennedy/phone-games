import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, failOnErrors, longPress, seedRandom, skipHowToPlay } from './helpers';

/** Smallest comfortable cell for a finger on a phone grid (see docs/DESIGN.md). */
const MIN_CELL_PX = 26;

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
  await skipHowToPlay(page);
  await page.goto('./#/minesweeper');
});

const cell = (page: import('@playwright/test').Page, i: number) => page.locator(`[data-i="${i}"]`);

test('first tap is safe and opens an area', async ({ page }) => {
  await cell(page, 14).click();
  await expect(page.locator('.ms-cell.revealed').first()).toBeVisible();
  expect(await page.locator('.ms-cell.revealed').count()).toBeGreaterThanOrEqual(9);
  await expect(page.locator('.exploded')).toHaveCount(0);
});

test('long-press flags a cell', async ({ page }) => {
  await cell(page, 14).click();
  const hidden = page.locator('.ms-cell:not(.revealed)').first();
  await longPress(hidden);
  await expect(hidden).toHaveText('🚩');
  await expect(page.locator('[data-mines]')).toHaveText('4');
});

test('flag mode flags with a tap', async ({ page }) => {
  await page.locator('[data-mode]').click();
  await cell(page, 0).click();
  await expect(cell(page, 0)).toHaveText('🚩');
});

test('progress survives a reload', async ({ page }) => {
  await cell(page, 14).click();
  const opened = await page.locator('.ms-cell.revealed').count();
  await page.reload();
  await expect(page.locator('.ms-cell.revealed')).toHaveCount(opened);
});

for (const level of ['easy', 'medium', 'hard']) {
  test(`${level} cells are big enough to tap`, async ({ page }) => {
    await page.locator(`[data-level="${level}"]`).click();
    const box = (await cell(page, 0).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(MIN_CELL_PX);
  });

  test(`${level} numbers and text are readable without glasses`, async ({ page }) => {
    await page.locator(`[data-level="${level}"]`).click();
    const size = await cell(page, 0).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(18);
    await expectReadableText(page);
    await expectNoHorizontalOverflow(page);
  });
}

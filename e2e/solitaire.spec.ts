import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
  await page.goto('./#/solitaire');
});

const moves = async (page: import('@playwright/test').Page) => Number(await page.locator('[data-moves]').textContent());

test('deals seven columns that fit the phone and read without glasses', async ({ page }) => {
  await expect(page.locator('.sol-col')).toHaveCount(7);
  await expect(page.locator('.sol-col .card')).toHaveCount(28);
  const card = (await page.locator('.sol-col .card').first().boundingBox())!;
  expect(card.width).toBeGreaterThanOrEqual(40);
  expect(card.height).toBeGreaterThan(card.width);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
});

test('the deck turns over one card, or three in Draw 3', async ({ page }) => {
  await page.locator('[data-stock]').click();
  await expect(page.locator('.sol-waste .card')).toHaveCount(1);
  await page.locator('[data-draw="3"]').click();
  await page.locator('[data-stock]').click();
  await expect(page.locator('.sol-waste .card')).toHaveCount(3);
  await expectNoHorizontalOverflow(page);
});

test('tapping a card moves it, or says why not', async ({ page }) => {
  for (let col = 0; col < 7; col++) {
    const before = await moves(page);
    const top = page.locator(`[data-col="${col}"] button.card`).last();
    if (!(await top.count())) continue;
    await top.click();
    const after = await moves(page);
    if (after === before) await expect(page.locator('[data-status]')).toHaveText("That card can't move right now.");
    else expect(after).toBe(before + 1);
  }
});

test('Undo takes back the last move', async ({ page }) => {
  await page.locator('[data-stock]').click();
  await expect(page.locator('[data-moves]')).toHaveText('1');
  await page.locator('[data-undo]').click();
  await expect(page.locator('[data-moves]')).toHaveText('0');
  await expect(page.locator('.sol-waste .card')).toHaveCount(0);
});

test('the game is still there after leaving and coming back', async ({ page }) => {
  await page.locator('[data-stock]').click();
  await page.locator('[data-stock]').click();
  const waste = await page.locator('.sol-waste .card').last().getAttribute('data-card');
  await page.getByRole('link', { name: '‹ Games' }).click();
  await page.locator('a[href="#/solitaire"]').click();
  await expect(page.locator('[data-moves]')).toHaveText('2');
  await expect(page.locator('.sol-waste .card').last()).toHaveAttribute('data-card', waste!);
});

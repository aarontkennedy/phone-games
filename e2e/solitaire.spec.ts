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

test('every face-up card has its rank in the top corner, tappable or not', async ({ page }) => {
  await page.locator('[data-draw="3"]').click();
  await page.locator('[data-stock]').click(); // Draw 3 fans plain (not tappable) cards under the top one
  const offsets = await page.locator('.card:not(.back)').evaluateAll((cards) =>
    cards.map((c) => ({
      tag: c.tagName,
      top: c.querySelector('.card-corner')!.getBoundingClientRect().top - c.getBoundingClientRect().top,
    })),
  );
  expect(new Set(offsets.map((o) => o.tag))).toEqual(new Set(['BUTTON', 'DIV']));
  for (const o of offsets) expect(o.top, `${o.tag} card corner`).toBeLessThanOrEqual(5);
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
  await page.getByRole('link', { name: 'Back to games' }).click();
  await page.locator('a[href="#/solitaire"]').first().click(); // also under Most played by now
  await expect(page.locator('[data-moves]')).toHaveText('2');
  await expect(page.locator('.sol-waste .card').last()).toHaveAttribute('data-card', waste!);
});

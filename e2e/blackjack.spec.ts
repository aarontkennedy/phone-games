import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  expectReadableText,
  expectTouchTargets,
  failOnErrors,
  openBlackjackWith,
  seedRandom,
} from './helpers';

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
  await page.goto('./#/blackjack');
});

test('the table fits the phone and reads without glasses, before and during a hand', async ({ page }) => {
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);

  await openBlackjackWith(page, '9H 7S 8C 10D');
  await page.locator('[data-deal]').click();
  await expect(page.locator('[data-action="hit"]')).toBeVisible();
  await expect(page.locator('.bj-table .card.back')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
});

test('bet, deal, stand and get paid', async ({ page }) => {
  await openBlackjackWith(page, '10H 6S 7C 10D KC'); // 17 vs 16; dealer draws the king and busts
  await page.locator('[data-bet="50"]').click();
  await page.locator('[data-deal]').click();
  await page.locator('[data-action="stand"]').click();
  await expect(page.locator('[data-status]')).toHaveText('Dealer busts. You win 50.');
  await expect(page.locator('[data-chips]')).toHaveText('1050');
  await expect(page.locator('[data-deal]')).toBeEnabled();
});

test('hints suggest the best play', async ({ page }) => {
  await openBlackjackWith(page, '6H 5S 5C 9D'); // 11 vs 5: double
  await page.locator('[data-hints]').click();
  await page.locator('[data-deal]').click();
  await expect(page.locator('[data-status]')).toHaveText('Hint: the best play here is to double.');
});

test('split hands sit side by side and still fit', async ({ page }) => {
  await openBlackjackWith(page, '8H 10S 8C 7D 3H 2C');
  await page.locator('[data-deal]').click();
  await page.locator('[data-action="split"]').click();
  const [a, b] = await page.locator('.bj-player .bj-hand').all();
  const boxA = (await a.boundingBox())!;
  const boxB = (await b.boundingBox())!;
  expect(Math.abs(boxA.y - boxB.y)).toBeLessThan(2); // same row
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
});

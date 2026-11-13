import { expect, test } from '@playwright/test';
import {
  chooseSetting,
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

test('Hint shows the best play just above the buttons, leaving the instructions', async ({ page }) => {
  await openBlackjackWith(page, '6H 5S 5C 9D'); // 11 vs 5: double
  await page.locator('[data-deal]').click();
  const status = page.locator('[data-status]');
  await expect(status).toHaveText('Hit for another card, or stand.');
  await page.locator('[data-hint]').click();
  await expect(page.locator('[data-tip]')).toHaveText('Best play: Double');
  await expect(status).toHaveText('Hit for another card, or stand.');
  await expectTouchTargets(page);
  await expectReadableText(page);

  // The instructions sit right above the buttons they describe.
  const line = (await status.boundingBox())!;
  const controls = (await page.locator('[data-controls]').boundingBox())!;
  expect(controls.y - (line.y + line.height)).toBeLessThan(30);
});

test('a play that isn’t the best is scored, and the best one named', async ({ page }) => {
  await openBlackjackWith(page, '10H 2S 2C 10D 3H 10C'); // 12 vs 2: hit
  await page.locator('[data-deal]').click();
  await page.locator('[data-action="stand"]').click();
  await expect(page.locator('[data-status]')).toContainText('Best was to hit.');
  await expect(page.locator('[data-accuracy]')).toHaveText('0%');
});

test('Settings changes the decks between hands; the table shows how many', async ({ page }) => {
  const decks = page.locator('.bj-decks');
  await expect(decks).toHaveText('6 decks');
  await chooseSetting(page, '[data-decks="8"]');
  await expect(decks).toHaveText('8 decks');
  await chooseSetting(page, '[data-decks="1"]');
  await expect(decks).toHaveText('1 deck');
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await openBlackjackWith(page, '9H 7S 8C 10D'); // a 6-deck save, mid-hand after the deal
  await page.locator('[data-deal]').click();
  await page.locator('[data-settings-open]').click();
  await expect(page.locator('.settings [data-decks="8"]')).toBeDisabled(); // not during a hand
  await expectTouchTargets(page);
  await page.locator('.settings .btn[data-settings-close]').click();
  await expect(decks).toHaveText('6 decks');
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

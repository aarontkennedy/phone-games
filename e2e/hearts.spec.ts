import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
  await page.goto('./#/hearts');
});

test('the table fits the phone and reads without glasses', async ({ page }) => {
  await expect(page.locator('[data-hand]')).toHaveCount(13);
  const card = (await page.locator('[data-hand]').first().boundingBox())!;
  expect(card.width).toBeGreaterThanOrEqual(40);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
});

test('pass three cards, then play a trick with the computer players', async ({ page }) => {
  const hand = page.locator('[data-hand]');
  for (let i = 0; i < 3; i++) await hand.nth(i).click();
  await expect(page.locator('.card.picked')).toHaveCount(3);
  await page.locator('[data-pass]').click();
  await expect(page.locator('[data-pass]')).toBeHidden();
  await expect(page.locator('.card.received')).toHaveCount(3);

  // The computer players take turns until it's yours.
  await expect(page.locator('[data-status]')).toContainText('Your turn', { timeout: 15_000 });
  await page.locator('[data-hand]:enabled').first().click();
  await expect(page.locator('[data-seat="0"] .card')).toBeVisible();
  await expect(page.locator('[data-status]')).toHaveText(/takes? the trick/, { timeout: 10_000 });
  await expect(page.locator('.hrt-play .card')).toHaveCount(4);
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
});

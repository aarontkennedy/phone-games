import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
  await page.goto('./#/spades');
});

test('bidding fits the phone and reads without glasses', async ({ page }) => {
  await expect(page.locator('[data-bidding]')).toBeVisible();
  await expect(page.locator('[data-hand]')).toHaveCount(13);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
});

test('bid, let the computer players bid, then play a trick', async ({ page }) => {
  await page.locator('[data-step="1"]').click();
  const amount = await page.locator('[data-amount]').textContent();
  await page.locator('[data-bid]').click();
  await expect(page.locator('[data-bidding]')).toBeHidden();
  await expect(page.locator('[data-seat="0"] .tt-info')).toContainText(amount === '0' ? 'Nil' : `Bid ${amount}`);

  await expect(page.locator('[data-status]')).toContainText('Your turn', { timeout: 10_000 });
  await page.locator('[data-hand]:enabled').first().click();
  await expect(page.locator('[data-status]')).toHaveText(/takes? the trick/, { timeout: 10_000 });
  await expect(page.locator('.tt-play .card')).toHaveCount(4);
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
});

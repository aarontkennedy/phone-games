import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
  await page.goto('./#/euchre');
});

test('bidding fits the phone and reads without glasses', async ({ page }) => {
  await expect(page.locator('[data-bidding]')).toBeVisible();
  await expect(page.locator('.eu-trump .card')).toBeVisible();
  await expect(page.locator('[data-hand]')).toHaveCount(5);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
});

test('bid through to play, then play a trick', async ({ page }) => {
  const status = page.locator('[data-status]');
  const bidding = page.locator('[data-bidding]');
  // Pass whenever asked; if it comes back to you in round two, name the first suit offered.
  for (let i = 0; i < 3; i++) {
    await expect(status).toHaveText(/Your turn|Order the dealer|Name a trump/, { timeout: 15_000 });
    if (!(await bidding.isVisible())) break;
    const passBtn = page.locator('[data-pass]');
    if (await passBtn.count()) await passBtn.click();
    else await page.locator('[data-suit]').first().click();
  }
  await expect(page.locator('.eu-trump')).toContainText('are trump', { timeout: 15_000 });
  await expect(status).toContainText('Your turn', { timeout: 15_000 });
  await page.locator('[data-hand]:enabled').first().click();
  await expect(status).toHaveText(/takes? the trick/, { timeout: 10_000 });
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
});

import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
  await page.goto('./#/cribbage');
});

test('the table fits the phone and reads without glasses', async ({ page }) => {
  await expect(page.locator('[data-hand]')).toHaveCount(6);
  await expect(page.locator('.cb-track')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
});

test('a whole hand: crib, pegging and the show', async ({ page }) => {
  const hand = page.locator('[data-hand]');
  await hand.nth(0).click();
  await hand.nth(1).click();
  await page.locator('[data-crib]').click();
  await expect(page.locator('.cb-crib .card.back')).toHaveCount(4);

  // Play a card whenever it's your turn, until the show starts.
  const next = page.locator('[data-next]');
  for (let i = 0; i < 12 && !(await next.isVisible()); i++) {
    await expect(page.locator('[data-status]')).toHaveText(/Your turn|Total|nothing/, { timeout: 10_000 });
    const card = page.locator('[data-hand]:enabled').first();
    if (await card.count()) await card.click();
  }
  await expect(next).toBeVisible({ timeout: 10_000 });
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
  await next.click();
  await next.click();
  await expect(next).toHaveText('Next hand');
  await next.click();
  await expect(page.locator('[data-crib]')).toBeVisible();
});

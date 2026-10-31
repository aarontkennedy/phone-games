import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors } from './helpers';

test.beforeEach(({ page }) => failOnErrors(page));

test('About is linked from home, reads without glasses, and goes back', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible();
  await expect(page.getByText('All rights reserved')).toBeVisible();
  await expectReadableText(page);
  await expectTouchTargets(page);
  await expectNoHorizontalOverflow(page);

  await page.getByText('Show the license notices').click();
  await expect(page.locator('[data-notices]')).toContainText('Workbox');
  await expectReadableText(page);
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: '‹ Games' }).click();
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible();
});

import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets } from './helpers';

// No failOnErrors here: these tests cause an error on purpose.

test('a crash offers to email a report, and Not now closes it', async ({ page }) => {
  await page.goto('./#/hearts');
  await expect(page.getByRole('heading', { name: 'Hearts' })).toBeVisible();
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('test crash');
    });
  });

  const banner = page.getByRole('alertdialog');
  await expect(banner).toContainText('something went wrong');
  const href = decodeURIComponent((await banner.getByRole('link', { name: 'Email a report' }).getAttribute('href'))!);
  expect(href).toMatch(/^mailto:[^?]+@[^?]+\?subject=Games problem report/);
  expect(href).toContain('Error: test crash');
  expect(href).toContain('Screen: #/hearts');
  await expectReadableText(page);
  await expectTouchTargets(page);
  await expectNoHorizontalOverflow(page);

  await banner.getByRole('button', { name: 'Not now' }).click();
  await expect(banner).toHaveCount(0);
});

test('About has an Email feedback link', async ({ page }) => {
  await page.goto('./#/about');
  const link = page.getByRole('link', { name: 'Email feedback' });
  await expect(link).toBeVisible();
  expect(await link.getAttribute('href')).toMatch(/^mailto:[^?]+@[^?]+\?subject=Games%20feedback/);
  await expectReadableText(page);
  await expectTouchTargets(page);
});

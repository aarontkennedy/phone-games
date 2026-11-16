import { expect, test, type Page } from '@playwright/test';
import { expectReadableText, expectTouchTargets, failOnErrors } from './helpers';

// Settings (the gear on the home screen) > Appearance: Automatic follows the phone; Light
// or Dark overrides it, everywhere, and is remembered (src/core/theme.ts).
const LIGHT_BG = 'rgb(243, 245, 244)';
const DARK_BG = 'rgb(14, 19, 18)';
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.beforeEach(({ page }) => failOnErrors(page));

test('Automatic follows the phone', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  expect(await background(page)).toBe(DARK_BG);
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await background(page)).toBe(LIGHT_BG);
});

test('Dark wins over a light phone, in games too, and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expectReadableText(page);
  await expectTouchTargets(page);
  await page.getByRole('button', { name: 'Dark' }).click();
  expect(await background(page)).toBe(DARK_BG);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#0e1312');

  // A game's own dark colors follow too: a Mines square looks the same on a light phone
  // as on a dark one (its colors come from the game's own dark block).
  await page.reload();
  expect(await background(page)).toBe(DARK_BG);
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('./#/minesweeper');
  expect(await background(page)).toBe(DARK_BG);
  const darkCell = await page.locator('.ms-cell').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.locator('.ms-cell').first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(darkCell);
});

test('Light wins over a dark phone', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Light' }).click();
  expect(await background(page)).toBe(LIGHT_BG);
  await page.goto('./#/minesweeper');
  const lightCell = await page.locator('.ms-cell').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.locator('.ms-cell').first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(lightCell);
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Automatic' }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await background(page)).toBe(DARK_BG);
});

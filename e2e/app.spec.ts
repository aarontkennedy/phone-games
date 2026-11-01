import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors } from './helpers';

const GAMES = [
  { id: '2048', title: '2048' },
  { id: 'minesweeper', title: 'Mines' },
  { id: 'solitaire', title: 'Solitaire' },
  { id: 'blackjack', title: 'Blackjack' },
  { id: 'hearts', title: 'Hearts' },
  { id: 'spades', title: 'Spades' },
  { id: 'euchre', title: 'Euchre' },
  { id: 'cribbage', title: 'Cribbage' },
];

test.beforeEach(({ page }) => failOnErrors(page));

test('home lists every game', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible();
  for (const g of GAMES) await expect(page.locator(`a[href="#/${g.id}"]`)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
});

for (const g of GAMES) {
  test(`${g.title}: opens, fits the screen, and goes back`, async ({ page }) => {
    await page.goto('./');
    await page.locator(`a[href="#/${g.id}"]`).click();
    await expect(page.getByRole('heading', { name: g.title })).toBeVisible();
    await expect(page.locator('.game > *')).not.toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await expectReadableText(page);

    await page.getByRole('link', { name: '‹ Games' }).click();
    await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible();
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`follows the phone's ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe(scheme === 'light' ? 'rgb(246, 244, 251)' : 'rgb(21, 19, 31)');
  });
}

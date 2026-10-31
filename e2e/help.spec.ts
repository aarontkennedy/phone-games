import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors } from './helpers';

const GAMES = [
  { id: '2048', title: '2048' },
  { id: 'minesweeper', title: 'Mines' },
];

test.beforeEach(({ page }) => failOnErrors(page));

for (const g of GAMES) {
  test(`${g.title}: How to play opens the first time, then from Rules`, async ({ page }) => {
    await page.goto(`./#/${g.id}`);
    const help = page.getByRole('dialog', { name: `How to play ${g.title}` });
    await expect(help).toBeVisible();
    await expect(help.locator('ol li')).not.toHaveCount(0);
    await expectReadableText(page);
    await expectTouchTargets(page);
    await expectNoHorizontalOverflow(page);

    await help.getByRole('button', { name: 'Got it' }).click();
    await expect(help).toBeHidden();

    // Reopen instead of reloading: a reload can interrupt WebKit's service worker install.
    await page.getByRole('link', { name: '‹ Games' }).click();
    await page.locator(`a[href="#/${g.id}"]`).click();
    await expect(page.locator('.game > *')).not.toHaveCount(0);
    await expect(help).toBeHidden();

    await page.getByRole('button', { name: 'Rules' }).click();
    await expect(help).toBeVisible();
  });
}

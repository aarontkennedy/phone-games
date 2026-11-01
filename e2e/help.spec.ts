import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors } from './helpers';

const GAMES = [
  { id: '2048', title: '2048' },
  { id: 'minesweeper', title: 'Mines' },
  { id: 'solitaire', title: 'Solitaire' },
  { id: 'blackjack', title: 'Blackjack' },
  { id: 'hearts', title: 'Hearts' },
  { id: 'spades', title: 'Spades' },
];

test.beforeEach(({ page }) => failOnErrors(page));

for (const g of GAMES) {
  test(`${g.title}: Rules opens How to play, and Got it closes it`, async ({ page }) => {
    await page.goto(`./#/${g.id}`);
    await expect(page.locator('.game > *')).not.toHaveCount(0);
    const help = page.getByRole('dialog', { name: `How to play ${g.title}` });
    await expect(help).toBeHidden();

    await page.getByRole('button', { name: 'Rules' }).click();
    await expect(help).toBeVisible();
    await expect(help.locator('ol li')).not.toHaveCount(0);
    await expectReadableText(page);
    await expectTouchTargets(page);
    await expectNoHorizontalOverflow(page);

    await help.getByRole('button', { name: 'Got it' }).click();
    await expect(help).toBeHidden();
  });
}

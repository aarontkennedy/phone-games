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
  { id: 'tictactoe', title: 'Tic-Tac-Toe' },
  { id: 'fourinarow', title: 'Four in a Row' },
  { id: 'checkers', title: 'Checkers' },
  { id: 'numberplace', title: 'Number Place' },
  { id: 'freecells', title: 'Free Cells' },
  { id: 'crazyeights', title: 'Crazy Eights' },
  { id: 'hotdice', title: 'Hot Dice' },
  { id: 'gin', title: 'Gin Rummy' },
  { id: 'dominoes', title: 'Dominoes' },
  { id: 'yacht', title: 'Yacht' },
  { id: 'reversi', title: 'Reversi' },
  { id: 'mancala', title: 'Mancala' },
  { id: 'hangman', title: 'Hangman' },
];

test.beforeEach(({ page }) => failOnErrors(page));

test('home groups the games, and shows the most played once you’ve played', async ({ page }) => {
  await page.goto('./');
  const groups = page.locator('.home-group h2');
  await expect(groups).toHaveText(['Card games', 'Solitaire and puzzles', 'Board games', 'Dice and tiles']);
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);

  await page.locator('a[href="#/yacht"]').first().click();
  await page.getByRole('link', { name: 'Back to games' }).click();
  await expect(groups.first()).toHaveText('Most played');
  await expect(page.locator('[aria-labelledby="group-most-played"] .game-card')).toHaveText([/Yacht/]);
});

test('New asks before throwing away a game in progress', async ({ page }) => {
  await page.goto('./#/tictactoe');
  await page.locator('[data-cell="4"]').click();
  await page.locator('[data-new]').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Start a new game?');
  await expectReadableText(page);
  await expectTouchTargets(page);
  await dialog.getByRole('button', { name: 'Keep playing' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-cell="4"]')).toHaveAttribute('aria-label', /: X$/);
  await page.locator('[data-new]').click();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('[data-cell="4"]')).not.toHaveAttribute('aria-label', /: X$/);
});

test('home lists every game', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible();
  for (const g of GAMES) await expect(page.locator(`a[href="#/${g.id}"]`).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
});

test('Share offers text and email when the browser has no share sheet', async ({ page }) => {
  await page.addInitScript(() => {
    delete (Navigator.prototype as { share?: unknown }).share;
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Share' }).click();
  const text = page.getByRole('link', { name: 'Send a text' });
  await expect(text).toBeVisible();
  await expect(text).toHaveAttribute('href', /^sms:\?&body=/);
  await expect(page.getByRole('link', { name: 'Send an email' })).toHaveAttribute('href', /^mailto:/);
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

    // Thumb-friendly order: stats at the top, then the board, then the controls.
    const board = (await page.locator('.board-frame').boundingBox())!;
    const stats = (await page.locator('.stats').boundingBox())!;
    expect(stats.y + stats.height).toBeLessThanOrEqual(board.y + 1);
    const controls = page.locator('.controls');
    if (await controls.count()) {
      const box = (await controls.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
    }

    await page.getByRole('link', { name: 'Back to games' }).click();
    await expect(page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible();
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

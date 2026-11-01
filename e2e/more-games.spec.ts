import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

// Browser checks for Tic-Tac-Toe, Four in a Row, Checkers, Number Place, Free Cells,
// Crazy Eights, Hot Dice, Gin Rummy, Dominoes, Yacht, Reversi, Mancala and Hangman: each fits the phone, reads without
// glasses, and plays a first move.

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
});

async function expectGoodLayout(page: Page) {
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
}

const status = (page: Page) => page.locator('[data-status]');

test('Tic-Tac-Toe: you move, the computer answers', async ({ page }) => {
  await page.goto('./#/tictactoe');
  await expectGoodLayout(page);
  await page.locator('[data-cell="4"]').click();
  await expect(page.locator('[data-cell="4"]')).toHaveAttribute('aria-label', /: X$/);
  await expect(status(page)).toHaveText(/^Your turn/, { timeout: 5000 });
  await expect(page.locator('.ttt-o')).toHaveCount(1);
});

test('Four in a Row: drop a disc, the computer answers', async ({ page }) => {
  await page.goto('./#/fourinarow');
  await expectGoodLayout(page);
  const space = (await page.locator('.fir-space').first().boundingBox())!;
  expect(space.width).toBeGreaterThanOrEqual(26);
  await page.locator('[data-col="3"]').click();
  await expect(page.locator('.fir-space.p0')).toHaveCount(1);
  await expect(page.locator('.fir-space.p1')).toHaveCount(1, { timeout: 5000 });
});

test('Checkers: move a piece, the computer answers', async ({ page }) => {
  await page.goto('./#/checkers');
  await expectGoodLayout(page);
  await page.locator('[data-sq="42"]').click(); // row 6, column 3
  await page.locator('.ck-sq.target').first().click();
  await expect(status(page)).toHaveText(/^Your turn/, { timeout: 8000 });
  await expect(page.locator('.ck-sq.last')).not.toHaveCount(0);
});

test('Number Place: fill a square', async ({ page }) => {
  await page.goto('./#/numberplace');
  await expectGoodLayout(page);
  const cell = (await page.locator('.np-cell').first().boundingBox())!;
  expect(cell.width).toBeGreaterThanOrEqual(26);
  const empty = page.locator('.np-cell.mine').first();
  await empty.click();
  await page.locator('[data-num="5"]').click();
  await expect(empty).toHaveText('5');
  await expectReadableText(page);
});

test('Free Cells: tapping a card moves it, or says why not', async ({ page }) => {
  await page.goto('./#/freecells');
  await expect(page.locator('.fc-col .card')).toHaveCount(52);
  await expectGoodLayout(page);
  await page.locator('[data-col="0"] .card').last().click();
  await expect(status(page)).toHaveText(/Tap a card|can't move/);
});

test('Crazy Eights: play or draw, then the computer players go', async ({ page }) => {
  await page.goto('./#/crazyeights');
  await expectGoodLayout(page);
  const card = page.locator('[data-hand]:enabled:not([data-card^="8"])').first();
  if (await card.count()) await card.click();
  else if (await page.locator('[data-hand]:enabled').count()) {
    await page.locator('[data-hand]:enabled').first().click();
    await page.locator('[data-suit]').first().click();
  } else await page.locator('[data-actions] [data-draw]').click();
  await expect(status(page)).toHaveText(/Your turn|Draw a card|playing/, { timeout: 8000 });
  await expectGoodLayout(page);
});

test('Hot Dice: roll the dice', async ({ page }) => {
  await page.goto('./#/hotdice');
  await expectGoodLayout(page);
  await page.locator('[data-act="roll"]').click();
  await expect(status(page)).toHaveText(/Tap the dice|Bust/);
  if (await page.locator('[data-die]').count()) await expectGoodLayout(page);
});

test('Gin Rummy: draw and discard, then the computer plays', async ({ page }) => {
  await page.goto('./#/gin');
  await expect(page.locator('[data-hand]')).toHaveCount(10);
  await expectGoodLayout(page);
  await page.locator('[data-stock]').click();
  await page.locator('[data-hand]:enabled').last().click();
  await expect(status(page)).toHaveText(/^Your turn/, { timeout: 8000 });
});

test('Dominoes: lead a tile, the computer answers', async ({ page }) => {
  await page.goto('./#/dominoes');
  await expectGoodLayout(page);
  await page.locator('[data-tile]:enabled').first().click();
  await expect(page.locator('.dom-line .dom-tile')).not.toHaveCount(0);
  await expect(status(page)).toHaveText(/Your turn|Nothing matches|wins|tie/, { timeout: 8000 });
  await expectGoodLayout(page);
});

test('Yacht: roll, hold a die, roll again and score a box', async ({ page }) => {
  await page.goto('./#/yacht');
  await expectGoodLayout(page);
  await page.locator('[data-roll]').click();
  await expect(page.locator('[data-roll]')).toHaveText('Roll (2 left)');
  await page.locator('[data-die="0"]').click();
  await expect(page.locator('[data-die="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expectGoodLayout(page);
  await page.locator('[data-roll]').click();
  await page.locator('[data-box="chance"]').click();
  await expect(page.locator('[data-box="chance"]')).toHaveClass(/filled/);
  await expect(status(page)).toHaveText('Turn 2 of 13. Tap Roll.');
});

test('Reversi: place a disc, the computer answers', async ({ page }) => {
  await page.goto('./#/reversi');
  await expectGoodLayout(page);
  await page.locator('.rv-sq.target').first().click();
  await expect(page.locator('[data-you]')).toHaveText('4');
  await expect(status(page)).toHaveText(/^Your turn/, { timeout: 5000 });
  await expect(page.locator('.rv-sq.last')).toHaveCount(1);
});

test('Mancala: sow from a pit, the computer answers', async ({ page }) => {
  await page.goto('./#/mancala');
  await expectGoodLayout(page);
  await page.locator('[data-pit="0"]').click(); // 4 seeds: lands short of the store
  await expect(status(page)).toHaveText(/^Your turn/, { timeout: 10_000 });
  await expect(page.locator('.mc-pit.played, .mc-store.landed')).not.toHaveCount(0);
});

test('Hangman: right and wrong guesses mark the keys', async ({ page }) => {
  await page.goto('./#/hangman');
  await expectGoodLayout(page);
  for (const letter of 'EAIOU') await page.locator(`[data-letter="${letter}"]`).click();
  await expect(page.locator('.hm-right, .hm-wrong')).toHaveCount(5);
  await expectGoodLayout(page);
});

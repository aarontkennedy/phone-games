import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

// Settings that aren't changed often (the computer's level, a difficulty) sit behind the
// gear beside Rules (docs/DESIGN.md, "Settings"), off the game screen.
const GAMES = [
  'backgammon', 'blackjack', 'checkers', 'chess', 'crazyeights', 'cribbage', 'dominoes', 'dots', 'drawpoker', 'euchre',
  'fourinarow', 'gin', 'gofish', 'hearts', 'holdem', 'hotdice', 'mancala', 'minesweeper', 'numberplace', 'reversi',
  'rummy', 'solitaire', 'spades', 'spider', 'tictactoe',
];

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
});

for (const id of GAMES) {
  test(`${id}: the gear opens readable settings, and none are left on the game screen`, async ({ page }) => {
    await page.goto(`./#/${id}`);
    // Upright the icons sit side by side and the bar stays one row (a long title wraps inside it).
    const gear = (await page.locator('[data-settings-open]').boundingBox())!;
    const rules = (await page.locator('[data-help]').boundingBox())!;
    expect(rules.y).toBe(gear.y);
    const newGame = page.locator('header [data-new]');
    if (await newGame.count()) expect((await newGame.boundingBox())!.y).toBe(gear.y);
    await expect(page.locator('.stats [data-new]')).toHaveCount(0);
    expect((await page.locator('#app > .topbar').boundingBox())!.height).toBeLessThanOrEqual(44 + 2 * 8 + 1);
    // Bet (Blackjack) changes every hand, so it stays on the game screen.
    await expect(page.locator('.game .segmented:not([aria-label="Bet"])')).toHaveCount(0);
    await page.locator('[data-settings-open]').click();
    const panel = page.locator('.settings');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.setting').first()).toBeVisible();
    await expect(panel.locator('.segmented [aria-pressed="true"]')).toHaveCount(await panel.locator('.setting').count());
    await expectReadableText(page);
    await expectTouchTargets(page);
    await expectNoHorizontalOverflow(page);
    await panel.locator('.btn[data-settings-close]').click();
    await expect(panel).toBeHidden();
    await expect(page.locator('[data-settings-open]')).toBeFocused();
  });

  for (const size of [
    { name: 'iPhone 13', width: 844, height: 390 },
    { name: 'iPhone SE', width: 667, height: 375 },
  ]) {
    test(`${id} sideways on an ${size.name}: the gear and Rules fit the side bar's top bar`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(`./#/${id}`);
      const bar = (await page.locator('#app > .topbar').boundingBox())!;
      for (const sel of ['#app > .topbar .back', '[data-settings-open]', '[data-help]']) {
        const b = (await page.locator(sel).boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(bar.x - 1);
        expect(b.x + b.width).toBeLessThanOrEqual(size.width + 1);
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.y + b.height).toBeLessThanOrEqual(bar.y + bar.height + 1); // one row, nothing wrapped
      }
      const title = (await page.locator('#app > .topbar h1').boundingBox())!;
      expect(title.y + title.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
      const scrollY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      expect(scrollY).toBeLessThanOrEqual(0);
      await expectNoHorizontalOverflow(page);
    });
  }
}

test('a difficulty change asks before throwing away a game in progress', async ({ page }) => {
  await page.goto('./#/minesweeper');
  await page.locator('[data-i="0"]').click(); // start the game
  await page.locator('[data-settings-open]').click();
  await page.locator('.settings [data-level="hard"]').click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.locator('[data-cancel]').click();
  await expect(page.locator('.settings [data-level="easy"]')).toHaveAttribute('aria-pressed', 'true');
});

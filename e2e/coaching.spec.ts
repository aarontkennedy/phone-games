import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

// Coaching (docs/DESIGN.md, "Coaching"): in each game with a best play, Hint shows it in a
// row above the buttons, the Right score sits with the stats, and it all fits the phone.

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
});

/** Taps Hint and checks the tip, the Right stat and the layout. */
async function expectHint(page: Page, tip: string | RegExp) {
  await expect(page.locator('[data-accuracy]')).toBeVisible();
  await page.locator('[data-hint]').click();
  await expect(page.locator('[data-tip]')).toHaveText(tip);
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
  await expectTouchTargets(page);
}

test('Video Poker: Hint outlines the cards to hold', async ({ page }) => {
  await page.goto('./#/videopoker');
  await page.locator('[data-deal]').click();
  await expectHint(page, /^Best: hold (the (outlined card|\d outlined cards)|nothing and draw 5 new cards)\.$/);
});

test('Cribbage: Hint outlines the 2 cards for the crib', async ({ page }) => {
  await page.goto('./#/cribbage');
  await expectHint(page, 'Best: put the 2 outlined cards in the crib.');
  await expect(page.locator('.tt-hand .card.hint')).toHaveCount(2);
});

test('Hot Dice: Hint says what to keep, then roll or bank', async ({ page }) => {
  await page.goto('./#/hotdice');
  // A bust passes the dice; roll until a roll scores on your turn.
  for (let i = 0; i < 20 && !(await page.locator('[data-hint]').count()); i++) {
    const roll = page.locator('[data-act="roll"]');
    await expect(roll.or(page.locator('[data-hint]'))).toBeVisible({ timeout: 15_000 });
    if (await roll.count()) await roll.click();
  }
  await expectHint(page, /^Best: keep [1-6]( [1-6])*, then (roll [1-6]|bank [\d,]+)\.$/);
});

test('Texas Hold’em: Hint gives the best play by the numbers', async ({ page }) => {
  await page.goto('./#/holdem');
  // The computer players act first; wait for your turn.
  await expect(page.locator('[data-hint]')).toBeVisible({ timeout: 15_000 });
  await expectHint(page, /^Best: (Fold|Check|Call|Bet|Raise)\. You win about \d+% against [1-3] hands?/);
});

test('Five-Card Draw: Hint gives the best bet, or the cards to swap', async ({ page }) => {
  await page.goto('./#/drawpoker');
  await expect(page.locator('[data-hint]')).toBeVisible({ timeout: 15_000 });
  await expectHint(page, /^Best: (Fold|Check|Call|Bet|Raise)\. You win about \d+% against [1-3] hands?|^Best: (swap the|stand pat)/);
});

test('Euchre: Hint gives the best bid with the count behind it', async ({ page }) => {
  await page.goto('./#/euchre');
  // The computer players bid first; one may take trump before your turn comes.
  const asked = await page.locator('[data-hint]').waitFor({ timeout: 10_000 }).then(() => true, () => false);
  test.skip(!asked, 'This deal gave you no bid to make');
  await expectHint(page, /^Best: (pass|order up|pick it up|call \w+)( alone)?\. Your hand counts about [\d.]+ with \w+ as trump|^Best: put back the outlined card/);
});

test('Yacht: Hint outlines the dice to hold or the box to score', async ({ page }) => {
  await page.goto('./#/yacht');
  await page.locator('[data-roll]').click();
  await expectHint(page, /^Best: (hold the outlined dice and roll|roll all five again|score [\w ]+ now)\.$/);
});

test('Craps: Hint outlines the best bets', async ({ page }) => {
  await page.goto('./#/craps');
  await page.locator('[data-hint]').click();
  await expect(page.locator('[data-tip]')).toHaveText(/^Best: bet the Pass line or Don’t pass\./);
  await expect(page.locator('.cr-bet.hint')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
  await expectTouchTargets(page);
});

test('Mines: Hint says what the numbers prove', async ({ page }) => {
  await page.goto('./#/minesweeper');
  await page.locator('.ms-cell').nth(14).click();
  await page.locator('[data-hint]').click();
  await expect(page.locator('[data-tip]')).toHaveText(/^Best: (dig|flag) the dashed square\.|^No square is certain right now/);
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
  await expectTouchTargets(page);
});

test('Shut the Box: Hint outlines the best tiles to shut', async ({ page }) => {
  await page.goto('./#/shutbox');
  // Roll until there's a choice to make (more than one way to make the roll).
  for (let i = 0; i < 10 && !(await page.locator('[data-hint]').count()); i++) {
    if (await page.locator('[data-new-round]').count()) await page.locator('[data-new-round]').click();
    else if (await page.locator('[data-shut]').count()) {
      const total = Number((await page.locator('[data-status]').textContent())!.match(/\d+/)![0]);
      await page.locator(`[data-tile="${total}"]`).click();
      await page.locator('[data-shut]').click();
    } else await page.locator('[data-roll="2"]').click();
  }
  await expectHint(page, /^Best: (shut the outlined tiles|roll (one die|two dice))\.$/);
});

test('Baccarat: Hint outlines the Banker bet', async ({ page }) => {
  await page.goto('./#/baccarat');
  await page.locator('[data-hint]').click();
  await expect(page.locator('[data-tip]')).toHaveText(/^Best: bet on Banker\./);
  await expect(page.locator('.bc-spot.hint')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
  await expectTouchTargets(page);
});

test('Pig: Hint says whether to roll or hold', async ({ page }) => {
  await page.goto('./#/pig');
  // A 1 on the first roll passes the turn; roll until there are points to decide about.
  for (let i = 0; i < 10 && !(await page.locator('[data-hint]').count()); i++) {
    const roll = page.locator('[data-roll]');
    await expect(roll.or(page.locator('[data-hint]'))).toBeVisible({ timeout: 15_000 });
    if (await roll.count()) await roll.click();
  }
  await expectHint(page, /^Best: (hold \d+|roll again)\.$/);
});

test('Liar’s Dice: Hint gives the odds', async ({ page }) => {
  await page.goto('./#/liarsdice');
  await expect(page.locator('[data-hint]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-hint]').click();
  await expect(page.locator('[data-tip]')).toHaveText(/^Best: (bid|call)/);
  await expectNoHorizontalOverflow(page);
  await expectReadableText(page);
  await expectTouchTargets(page);
});

test('three stats fit the side bar on a small phone held sideways', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  // Each game's screen class, so the check waits for that game, not the one before it.
  const games = { videopoker: 'vp', cribbage: 'cb', hotdice: 'hd', holdem: 'he', blackjack: 'bj', drawpoker: 'dp', euchre: 'eu', yacht: 'ya', shutbox: 'sb', pig: 'pi' };
  for (const [id, screen] of Object.entries(games)) {
    await page.goto(`./#/${id}`);
    await expect(page.locator(`.screen.${screen} [data-accuracy]`)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // One row: every stat's top lines up.
    const tops = await page.locator(`.screen.${screen} > .stats > .stat`).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size, `${id} stats wrapped`).toBe(1);
  }
});

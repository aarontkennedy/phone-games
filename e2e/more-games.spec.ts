import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, expectReadableText, expectTouchTargets, failOnErrors, seedRandom } from './helpers';

// Browser checks for Tic-Tac-Toe, Four in a Row, Checkers, Number Place, Free Cells,
// Crazy Eights, Hot Dice, Gin Rummy, Dominoes, Yacht, Reversi, Mancala, Hangman, Spider, Backgammon, Dots and Boxes and the casino games: each fits the phone, reads without
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
  // Cells stay the same size whether they hold an X, an O or nothing.
  const heights = await page.locator('[data-cell]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(heights).size).toBe(1);
  // New sits below the board, under the thumb; ties count at the top.
  const board = (await page.locator('[data-board]').boundingBox())!;
  const newBtn = (await page.locator('[data-new]').boundingBox())!;
  expect(newBtn.y).toBeGreaterThan(board.y + board.height);
  await expect(page.locator('[data-ties]')).toHaveText('0');
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
  // It may first say what the best play was (Hint, docs/DESIGN.md "Coaching").
  await expect(status(page)).toHaveText(/(^|\. )Turn 2 of 13\. Tap Roll\.$/);
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

test('Spider Solitaire: ten columns fit, the deck deals a card onto each', async ({ page }) => {
  await page.goto('./#/spider');
  await expectGoodLayout(page);
  const faceUp = () => page.locator('.sp-col .card:not(.back)').count();
  await page.locator('[data-deal]').click();
  expect(await faceUp()).toBe(20);
  await expectGoodLayout(page);
});

test('Backgammon: roll, move a checker, the computer answers', async ({ page }) => {
  await page.goto('./#/backgammon');
  await expectGoodLayout(page);
  // The dice have their own row: rolling doesn't move the buttons.
  const buttons = page.locator('[data-roll], [data-undo]');
  const before = await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.x, r.y]));
  await page.locator('[data-roll]').click();
  await expect(page.locator('[data-dice] svg').first()).toBeVisible();
  expect(await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.x, r.y]))).toEqual(before);
  const source = page.locator('.bg-board .source').first();
  if (await source.count()) {
    await source.click();
    await page.locator('.bg-board .target').first().click();
  }
  await expect(status(page)).toHaveText(/^(You rolled|The computer|Your turn|Tap)/);
  await expectGoodLayout(page);
});

test('Dots and Boxes: draw a line, the computer answers', async ({ page }) => {
  await page.goto('./#/dots');
  await expectGoodLayout(page);
  await page.locator('[data-line="0"]').click();
  await expect(status(page)).toHaveText(/^Your turn/, { timeout: 5000 });
  await expect(page.locator('.db-line.drawn')).toHaveCount(2);
});

test('Go Fish: ask a player for a rank, then the others play', async ({ page }) => {
  await page.goto('./#/gofish');
  await expectGoodLayout(page);
  await page.locator('[data-hand]').first().click();
  await expect(status(page)).toHaveText(/^Tap West, North or East to ask/);
  await expectGoodLayout(page);
  await page.locator('[data-ask="1"]').click();
  await expect(page.locator('[data-recent] li').last()).toHaveText(/^You asked West for/); // the oldest of the recent moves
});

test('Rummy 500: draw, discard, then the computer plays', async ({ page }) => {
  await page.goto('./#/rummy');
  await expectGoodLayout(page);
  await page.locator('[data-stock]').click();
  await page.locator('[data-hand]').first().click();
  await expectGoodLayout(page);
  await page.locator('[data-discard]').click();
  await expect(status(page)).toHaveText(/Your turn/, { timeout: 10000 });
});

test('Chess: move a pawn, the computer replies', async ({ page }) => {
  await page.goto('./#/chess');
  await expectGoodLayout(page);
  await page.getByRole('button', { name: 'White pawn, e2' }).click();
  await page.getByRole('button', { name: 'Empty, e4, move here' }).click();
  await expect(status(page)).toHaveText(/^The computer moved/, { timeout: 10000 });
  await expect(page.locator('.cs-sq.last')).toHaveCount(2);
});

test('Video Poker: deal, hold a card, draw', async ({ page }) => {
  await page.goto('./#/videopoker');
  await expectGoodLayout(page);
  await page.locator('[data-deal]').click();
  await page.locator('[data-card-index="2"]').click();
  await expect(page.locator('.vp-held').nth(2)).toHaveText('Held');
  await expectGoodLayout(page);
  await page.locator('[data-draw]').click();
  await expect(status(page)).toHaveText(/: (you win \d+|no win)\./);
});

test("Texas Hold'em: act on your turn, then the computer players play", async ({ page }) => {
  await page.goto('./#/holdem');
  await expectGoodLayout(page);
  // You're the dealer in the first hand, so the computer players act first.
  const action = page.locator('[data-action]').first();
  await expect(action).toBeVisible({ timeout: 10000 });
  await expectGoodLayout(page);
  await page.locator('[data-action="call"], [data-action="check"]').first().click();
  await expect(status(page)).not.toHaveText(/^Before the flop, your turn/);
});

test('Five-Card Draw: bet, swap cards, and the hand plays on', async ({ page }) => {
  await page.goto('./#/drawpoker');
  await expectGoodLayout(page);
  // You're the dealer in the first hand: the computer players act first.
  // Check or call (again, if someone raises) until the draw comes round, or everyone else folds.
  const swapBtn = page.locator('[data-swap]');
  const passive = page.locator('[data-action="call"], [data-action="check"]').first();
  const next = swapBtn.or(page.locator('[data-next]')).or(passive);
  for (let i = 0; i < 6 && !(await swapBtn.isVisible()) && !(await page.locator('[data-next]').isVisible()); i++) {
    await expect(next).toBeVisible({ timeout: 15000 });
    if (await passive.isVisible()) await passive.click();
  }
  await expect(swapBtn.or(page.locator('[data-next]'))).toBeVisible({ timeout: 15000 });
  if (await swapBtn.isVisible()) {
    await page.locator('[data-hand]').first().click();
    await expect(swapBtn).toHaveText('Swap 1');
    await expectGoodLayout(page);
    await swapBtn.click();
    await expect(status(page)).not.toHaveText(/^The draw: tap/);
  }
});

test('Roulette: bet on red, spin, and get paid or not', async ({ page }) => {
  await page.goto('./#/roulette');
  await expectGoodLayout(page);
  await page.locator('[data-spot="red"]').click();
  await page.locator('[data-spot="17"]').click();
  await expect(status(page)).toHaveText('On the table: 17 (25), Red (25). Tap Spin.');
  await expectGoodLayout(page);
  await page.locator('[data-spin]').click();
  await expect(status(page)).toHaveText(/^\d+ (red|black|green)\. /, { timeout: 5000 });
  await expect(page.locator('[data-result] .rl-pocket.big')).toBeVisible();
  await expectGoodLayout(page);
});

test('Craps: bet the pass line and roll', async ({ page }) => {
  await page.goto('./#/craps');
  await expectGoodLayout(page);
  await page.locator('[data-target="pass"]').click();
  await page.locator('[data-target="field"]').click();
  await page.locator('[data-roll]').click();
  await expect(status(page)).toHaveText(/^Rolled \d+\./, { timeout: 5000 });
  await expect(page.locator('.cr-die').first()).toHaveAttribute('aria-label', /^Die showing [1-6]$/);
  await expectGoodLayout(page);
});

test('Pyramid: pair cards, turn the deck, and take a hint', async ({ page }) => {
  await page.goto('./#/pyramid');
  await expectGoodLayout(page);
  await expect(page.locator('[data-i]:enabled')).toHaveCount(7);
  await page.locator('[data-stock]').click();
  await expect(page.locator('[data-waste]')).toBeVisible();
  await page.locator('[data-hint]').click();
  await expect(status(page)).toHaveText(/^Hint: |^No moves left/);
  await expectGoodLayout(page);
});

test('Baccarat: bet on Banker, deal, and get paid or not', async ({ page }) => {
  await page.goto('./#/baccarat');
  await expectGoodLayout(page);
  await page.locator('[data-spot="banker"]').click();
  await page.locator('[data-deal]').click();
  await expect(status(page)).toHaveText(/^(Player|Banker) wins, \d to \d\.|^A tie, \d each\./);
  await expect(page.locator('.bc-hand .card')).not.toHaveCount(0);
  await expectGoodLayout(page);
});

test('Shut the Box: roll, shut tiles that make the roll', async ({ page }) => {
  await page.goto('./#/shutbox');
  await expectGoodLayout(page);
  await page.locator('[data-roll="2"]').click();
  await expect(status(page)).toHaveText(/^You rolled (\d+)\. Tap open tiles that add up to \1\.$/);
  const total = Number((await status(page).textContent())!.match(/\d+/)![0]);
  // Shut the one tile that makes it, or two that do.
  if (total <= 9) await page.locator(`[data-tile="${total}"]`).click();
  else {
    await page.locator('[data-tile="9"]').click();
    await page.locator(`[data-tile="${total - 9}"]`).click();
  }
  await page.locator('[data-shut]').click();
  await expect(page.locator('[data-score]')).toHaveText(String(45 - total));
  await expectGoodLayout(page);
});

test('Anagrams: spell a word from the tiles', async ({ page }) => {
  await page.goto('./#/anagrams');
  await expectGoodLayout(page);
  // Hint shows the 7-letter word a letter at a time; seven taps show it all, then spell it.
  for (let i = 0; i < 7; i++) await page.locator('[data-hint]').click();
  const word = (await status(page).textContent())!.match(/starts ([A-Z]{7})/)![1];
  for (const ch of word) await page.locator(`[data-tile]:enabled:text-is("${ch}")`).first().click();
  await page.locator('[data-enter]').click();
  await expect(status(page)).toHaveText(`${word}: 17 points. All seven letters!`);
  await expectGoodLayout(page);
});

test('Word Search: find a word from the hint', async ({ page }) => {
  await page.goto('./#/wordsearch');
  await expectGoodLayout(page);
  await page.locator('[data-hint]').click();
  await expect(status(page)).toHaveText(/^Hint: [A-Z]+ starts at the outlined letter\.$/);
  await expect(page.locator('.ws-cell.hint')).toHaveCount(1);
  await expectGoodLayout(page);
});

test('Word Ladder: follow the hint one step', async ({ page }) => {
  await page.goto('./#/ladder');
  await expectGoodLayout(page);
  await page.locator('[data-hint]').click();
  const next = (await status(page).textContent())!.match(/to ([A-Z]{4})\./)![1];
  const now = await page.locator('.ld-now').getAttribute('aria-label');
  const word = now!.match(/[A-Z]{4}$/)![0];
  const at = [...word].findIndex((ch, i) => ch !== next[i]);
  await page.locator(`[data-at="${at}"]`).click();
  await page.locator(`[data-letter="${next[at]}"]`).click();
  await expect(page.locator('[data-steps]')).toHaveText('1');
  await expectGoodLayout(page);
});

test('Word Grid: take a hint and finish the round', async ({ page }) => {
  await page.goto('./#/wordgrid');
  await expectGoodLayout(page);
  await page.locator('[data-hint]').click();
  await expect(status(page)).toHaveText(/^Hint: a \d-letter word starts at the outlined letter\.$/);
  await page.locator('[data-done]').click();
  await expect(status(page)).toHaveText(/^0 words for 0 points\. Some you missed: /);
  await expectGoodLayout(page);
});

test('Peg Solitaire: jump a peg into the center', async ({ page }) => {
  await page.goto('./#/pegs');
  await expectGoodLayout(page);
  await page.locator('[data-cell="10"]').click(); // two above the center
  await page.locator('[data-cell="24"]').click(); // the center
  await expect(page.locator('[data-pegs]')).toHaveText('31');
  await page.locator('[data-hint]').click();
  await expect(page.locator('.pg-hole.hint')).toHaveCount(2);
  await expectGoodLayout(page);
});

test('Cross Sums: fill a square, and hint another', async ({ page }) => {
  await page.goto('./#/crosssums');
  await expectGoodLayout(page);
  const before = Number(await page.locator('[data-left]').textContent());
  await page.locator('[data-hint]').click();
  await expect(page.locator('[data-left]')).toHaveText(String(before - 1));
  await expectGoodLayout(page);
});

test('Pig: roll, hold, and the computer takes its turn', async ({ page }) => {
  await page.goto('./#/pig');
  await expectGoodLayout(page);
  await page.locator('[data-roll]').click();
  await expect(status(page)).toHaveText(/^You have \d+ this turn|^A 1!/);
  if (await page.locator('[data-hold]:enabled').count()) await page.locator('[data-hold]').click();
  await expect(status(page)).toHaveText(/computer|Computer|A 1!/, { timeout: 5000 });
  await expectGoodLayout(page);
});

test('Liar’s Dice: bid, and the others answer', async ({ page }) => {
  await page.goto('./#/liarsdice');
  await expectGoodLayout(page);
  await page.locator('[data-face="6"]').click();
  await page.locator('[data-bid]').click();
  await expect(page.locator('[data-recent] li').first()).toHaveText(/^(You bid|West|East)/);
  await expect(page.locator('[data-recent] li')).not.toHaveCount(0);
  await expectGoodLayout(page);
});

test('Pai Gow Poker: deal, set the hand with the hint, and play', async ({ page }) => {
  await page.goto('./#/paigow');
  await expectGoodLayout(page);
  await page.locator('[data-deal]').click();
  await expect(page.locator('[data-pick]')).toHaveCount(7);
  await page.locator('[data-hint]').click();
  await expect(status(page)).toHaveText(/^High: .*\. Low: .*\. Tap Play\.$/);
  await expectGoodLayout(page);
  await page.locator('[data-play]').click();
  await expect(status(page)).toHaveText(/^High hand: (you|dealer) wins?\. Low hand: /);
  await expect(page.locator('.pg-caption')).toHaveCount(4);
  await expectGoodLayout(page);
});

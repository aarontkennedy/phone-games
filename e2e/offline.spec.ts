import { expect, test } from '@playwright/test';

// Playwright supports service workers in Chromium only, so this runs on the Android project.
test('works offline after the first visit, including every game', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service worker testing needs Chromium');

  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible();

  const links = await page.locator('.game-card').evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
  for (const href of new Set(links)) {
    await page.goto(`./${href}`);
    await expect(page.locator('.game > *')).not.toHaveCount(0);
    await expect(page.getByText("Couldn't load")).toHaveCount(0);
  }
});

// The word list is the one big file loaded on its own: a word game must check words offline,
// not just open.
test('word games check words against the word list offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service worker testing needs Chromium');

  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);

  await page.goto('./#/anagrams');
  // Hint shows the 7-letter word a letter at a time: seven taps show it all.
  for (let i = 0; i < 7; i++) await page.locator('[data-hint]').click();
  const status = page.locator('[data-status]');
  const word = (await status.textContent())!.match(/starts ([A-Z]{7})/)![1];
  for (const ch of word) await page.locator(`[data-tile]:enabled:text-is("${ch}")`).first().click();
  await page.locator('[data-enter]').click();
  await expect(status).toHaveText(`${word}: 17 points. All seven letters!`);

  // And a made-up word is turned away: the list really was checked. (The word backwards:
  // PLANETS makes STENALP.)
  const backwards = [...word].reverse().join('');
  for (const ch of backwards) await page.locator(`[data-tile]:enabled:text-is("${ch}")`).first().click();
  await page.locator('[data-enter]').click();
  await expect(status).toHaveText(`${backwards} isn’t in the word list.`);
});

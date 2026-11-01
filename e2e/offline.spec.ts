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

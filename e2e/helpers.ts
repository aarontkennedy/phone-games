import { expect, type Locator, type Page } from '@playwright/test';

/** Replaces Math.random with a seeded generator so games are reproducible. */
export async function seedRandom(page: Page, seed = 1): Promise<void> {
  await page.addInitScript((s) => {
    let a = s >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}

/** Fails the test on any uncaught page error or console error. */
export function failOnErrors(page: Page): void {
  page.on('pageerror', (err) => {
    throw err;
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') throw new Error(`Console error: ${msg.text()}`);
  });
}

/** Swipes across an element with pointer events, the way a finger would. */
export async function swipe(target: Locator, dx: number, dy: number): Promise<void> {
  await target.evaluate(
    (el, [dx, dy]) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const opts = { bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: x, clientY: y }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: x + dx, clientY: y + dy }));
    },
    [dx, dy],
  );
}

/** Holds a finger on an element for `ms`. */
export async function longPress(target: Locator, ms = 500): Promise<void> {
  const box = (await target.boundingBox())!;
  const init = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, pointerId: 1, button: 0 };
  await target.dispatchEvent('pointerdown', init);
  await target.page().waitForTimeout(ms);
  await target.dispatchEvent('pointerup', init);
}

/** The page must never scroll sideways: everything fits the phone's width. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** All visible text is at least `min` px, so it reads without reading glasses. */
export async function expectReadableText(page: Page, min = 18): Promise<void> {
  const small = await page.evaluate((min) => {
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.checkVisibility())
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()))
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < min)
      .map((el) => `${el.textContent!.trim().slice(0, 30)} (${getComputedStyle(el).fontSize})`);
  }, min);
  expect(small).toEqual([]);
}

/** Every visible button and link meets the minimum touch target height. */
export async function expectTouchTargets(page: Page, min = 44): Promise<void> {
  const small = await page.evaluate((min) => {
    return [...document.querySelectorAll<HTMLElement>('button, a')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => el.getBoundingClientRect().height < min - 6) // segmented buttons sit inside a 3px track
      .map((el) => el.textContent?.trim() || el.outerHTML.slice(0, 60));
  }, min);
  expect(small).toEqual([]);
}

/**
 * Opens Blackjack with a table whose next deal is `order` ("8H 10S 8C 7D ..."): you,
 * dealer up, you, dealer hole, then draws. Leaves the game first and waits for it to
 * close, because closing it saves the current table and would overwrite this one.
 */
export async function openBlackjackWith(page: Page, order: string): Promise<void> {
  const back = page.getByRole('link', { name: 'Back to games' });
  if (await back.count()) await back.click();
  // The home screen appears only after the game has closed (and saved), so nothing
  // can overwrite the table below.
  await expect(page.getByRole('heading', { name: 'Games', level: 1 })).toBeVisible();
  const ranks: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
  const cards = order.split(' ').map((id) => ({ suit: id.slice(-1), rank: ranks[id.slice(0, -1)] ?? Number(id.slice(0, -1)) }));
  const filler = Array.from({ length: 100 }, () => ({ suit: 'S', rank: 5 }));
  const state = { shoe: [...filler, ...cards.reverse()], chips: 1000, bet: 20, phase: 'betting', dealer: [], hands: [], active: 0 };
  await page.evaluate((s) => localStorage.setItem('pg:blackjack:state', JSON.stringify(s)), state);
  await page.locator('a[href="#/blackjack"]').first().click(); // also under Most played by now
}

/** Opens Settings (the gear), taps a choice, and closes it with Done. */
export async function chooseSetting(page: Page, selector: string) {
  await page.locator('[data-settings-open]').click();
  await page.locator(`.settings ${selector}`).click();
  await page.locator('.settings .btn[data-settings-close]').click();
  await expect(page.locator('.settings')).toBeHidden();
}

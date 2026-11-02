import { expect, test, type Page } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  expectReadableText,
  expectTouchTargets,
  failOnErrors,
  openBlackjackWith,
  seedRandom,
  swipe,
} from './helpers';
import { newGame as newCrazyEights } from '../src/games/crazyeights/logic';
import { newGame as newGoFish } from '../src/games/gofish/logic';
import { newGame as newRummy } from '../src/games/rummy/logic';
import { newDeck } from '../src/core/cards';

// Phones turned sideways: the board on the left, controls in a side bar on the right,
// everything on one screen (docs/DESIGN.md, "Landscape").
const SIZES = [
  { name: 'iPhone 13', width: 844, height: 390 },
  { name: 'iPhone SE', width: 667, height: 375 },
];

const MIN_CELL_PX = 26;

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
});

async function expectSideBarLayout(page: Page) {
  const viewport = page.viewportSize()!;
  const board = (await page.locator('.board-frame').boundingBox())!;

  // The board is fully on screen and on the left.
  expect(board.x).toBeGreaterThanOrEqual(0);
  expect(board.y).toBeGreaterThanOrEqual(0);
  expect(board.y + board.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(board.x + board.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(board.width).toBeGreaterThan(viewport.height * 0.8);

  // Every control sits to the right of the board.
  for (const el of await page.locator('.topbar:visible, .stats, .controls, .status-line').all()) { // not the hidden rules bar
    const box = (await el.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(board.x + board.width - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }

  // Nothing scrolls, either way.
  const scrollY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(scrollY).toBeLessThanOrEqual(0);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
  await expectReadableText(page);
}

for (const size of SIZES) {
  test.describe(`${size.name} sideways`, () => {
    test.beforeEach(({ page }) => page.setViewportSize({ width: size.width, height: size.height }));

    test('2048: board on the left, side bar on the right, swipes still work', async ({ page }) => {
      await page.goto('./#/2048');
      await expectSideBarLayout(page);

      const tiles = () => page.locator('.g2048-cell').evaluateAll((els) => els.map((e) => e.textContent));
      const before = await tiles();
      for (const [dx, dy] of [[-120, 0], [0, -120], [120, 0], [0, 120]]) await swipe(page.locator('.g2048'), dx, dy);
      expect(await tiles()).not.toEqual(before);
    });

    for (const level of ['easy', 'medium', 'hard']) {
      test(`Mines ${level}: board on the left, side bar on the right`, async ({ page }) => {
        await page.goto('./#/minesweeper');
        await page.locator(`[data-level="${level}"]`).click();
        await expectSideBarLayout(page);
        const cell = (await page.locator('[data-i="0"]').boundingBox())!;
        expect(cell.width).toBeGreaterThanOrEqual(MIN_CELL_PX);
      });
    }

    test('Solitaire: cards on the left, side bar on the right', async ({ page }) => {
      await page.goto('./#/solitaire');
      await expectSideBarLayout(page);
      await page.locator('[data-draw="3"]').click();
      await page.locator('[data-stock]').click();
      await expectSideBarLayout(page);
    });

    test('Blackjack: table on the left, side bar on the right, even after a split', async ({ page }) => {
      await page.goto('./#/blackjack');
      await expectSideBarLayout(page);
      await openBlackjackWith(page, '8H 10S 8C 7D 3H 2C');
      await page.locator('[data-deal]').click();
      await page.locator('[data-action="split"]').click();
      await expectSideBarLayout(page);
    });

    test('Hearts: table and hand on the left, side bar on the right', async ({ page }) => {
      await page.goto('./#/hearts');
      await expectSideBarLayout(page);
    });

    test('Spades: side bar with the bid controls, table on the left', async ({ page }) => {
      await page.goto('./#/spades');
      await expect(page.locator('[data-bidding]')).toBeVisible();
      await expectSideBarLayout(page);
    });

    test('Euchre: side bar with the bidding buttons, table on the left', async ({ page }) => {
      await page.goto('./#/euchre');
      await expect(page.locator('[data-bidding]')).toBeVisible();
      await expectSideBarLayout(page);
    });

    test('Cribbage: peg board and cards on the left, side bar on the right', async ({ page }) => {
      await page.goto('./#/cribbage');
      await expectSideBarLayout(page);
    });

    for (const id of ['tictactoe', 'fourinarow', 'checkers', 'numberplace', 'freecells', 'crazyeights', 'hotdice', 'gin', 'dominoes', 'yacht', 'reversi', 'mancala', 'hangman', 'spider', 'backgammon', 'dots', 'gofish', 'rummy', 'chess', 'videopoker', 'holdem', 'drawpoker', 'roulette', 'craps', 'paigow']) {
      test(`${id}: board on the left, side bar on the right`, async ({ page }) => {
        await page.goto(`./#/${id}`);
        await expectSideBarLayout(page);
      });
    }

    for (const held of [12, 18]) {
      test(`Crazy Eights: a ${held}-card hand still fits beside the side bar`, async ({ page }) => {
        const s = newCrazyEights('strong');
        s.hands[0].push(...s.stock.splice(0, held - s.hands[0].length)); // drawn until something played
        await page.addInitScript((saved) => localStorage.setItem('pg:crazyeights:state', saved), JSON.stringify(s));
        await page.goto('./#/crazyeights');
        await expect(page.locator('[data-hand]')).toHaveCount(held);
        await expectSideBarLayout(page);
      });
    }

    test('Go Fish: a 16-card hand fits beside the side bar while asking', async ({ page }) => {
      const s = newGoFish('strong');
      s.hands[0].push(...s.stock.splice(0, 16 - s.hands[0].length));
      await page.addInitScript((saved) => localStorage.setItem('pg:gofish:state', saved), JSON.stringify(s));
      await page.goto('./#/gofish');
      await page.locator('[data-hand]').first().click();
      await expect(page.locator('[data-ask]')).toHaveCount(3);
      await expectSideBarLayout(page);
    });

    test('Rummy 500: a crowded table still fits beside the side bar', async ({ page }) => {
      const deck = newDeck();
      const table = [2, 3, 4, 5, 6].map((rank) => deck.filter((c) => c.rank === rank && c.suit !== 'C'));
      const rest = deck.filter((c) => !table.flat().includes(c));
      const s = { ...newRummy('strong'), table, hands: [rest.slice(0, 16), rest.slice(16, 21)], discard: rest.slice(21, 36), stock: rest.slice(36) };
      await page.addInitScript((saved) => localStorage.setItem('pg:rummy:state', saved), JSON.stringify(s));
      await page.goto('./#/rummy');
      await expect(page.locator('[data-hand]')).toHaveCount(16);
      await expectSideBarLayout(page);
    });

    test('Video Poker: the pay table and a held hand fit beside the side bar', async ({ page }) => {
      await page.goto('./#/videopoker');
      await page.locator('[data-deal]').click();
      await page.locator('[data-card-index="0"]').click();
      await expect(page.locator('.vp-held').first()).toHaveText('Held');
      await expectSideBarLayout(page);
    });

    test('home and About still fit the width', async ({ page }) => {
      await page.goto('./');
      await expectNoHorizontalOverflow(page);
      await expectReadableText(page);
      await page.getByRole('link', { name: 'About' }).click();
      await expectNoHorizontalOverflow(page);
    });
  });
}

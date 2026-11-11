import { expect, test, type Page } from '@playwright/test';
import { failOnErrors, seedRandom } from './helpers';

// Games with a button that comes and goes beside the Easy/Strong switch (docs/DESIGN.md,
// "Steady controls"): the switch keeps its place and size, and the button fits beside it on
// the same row, so nothing moves when it appears.
const CASES: { id: string; name: string; button: string; show: (on: boolean) => void }[] = [
  {
    id: 'gofish',
    name: 'Draw',
    button: '[data-draw]',
    show: (on) => {
      document.querySelector('[data-actions]')!.innerHTML = on ? '<button class="btn" data-draw>Draw</button>' : '';
    },
  },
];

const SIZES = [
  { name: 'upright', size: null },
  { name: 'sideways on an iPhone 13', size: { width: 844, height: 390 } },
  { name: 'sideways on an iPhone SE', size: { width: 667, height: 375 } },
];

test.beforeEach(async ({ page }) => {
  failOnErrors(page);
  await seedRandom(page);
});

async function box(page: Page, selector: string) {
  return (await page.locator(selector).boundingBox())!;
}

for (const { name: where, size } of SIZES) {
  for (const c of CASES) {
    test(`${c.id}: ${c.name} appears beside the level switch without moving it, ${where}`, async ({ page }) => {
      if (size) await page.setViewportSize(size);
      await page.goto(`./#/${c.id}`);
      await expect(page.locator('.controls .segmented')).toBeVisible();
      await page.evaluate(`(${c.show})(false)`);
      const before = await box(page, '.controls .segmented');
      const controls = await box(page, '.controls');
      await page.evaluate(`(${c.show})(true)`);
      await expect(page.locator(c.button)).toBeVisible();
      expect(await box(page, '.controls .segmented')).toEqual(before);
      // Same row as the switch, and the controls didn't grow.
      const button = await box(page, c.button);
      expect(Math.abs(button.y - before.y), `button ${button.y}+${button.height}, switch ${before.y}`).toBeLessThanOrEqual(4);
      expect((await box(page, '.controls')).height).toBeLessThanOrEqual(controls.height + 1);
    });
  }
}

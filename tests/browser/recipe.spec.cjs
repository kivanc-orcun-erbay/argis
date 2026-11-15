// Input recipe: seed, fertilizer and diesel per plan year, costed from the farmer's own prices.
const { test, expect } = require('@playwright/test');
const { mockServices, watchErrors } = require('./mocks.cjs');

const open = async page => {
  await mockServices(page);
  await page.goto('/index.html');
  await expect(page.locator('#planTitle')).toHaveAttribute('aria-label', /→/);
};
const seedIds = page => page.locator('#seedPrices input').evaluateAll(els => els.map(e => e.dataset.seed));

test('without prices: amounts per year and a list of the prices still needed', async ({ page }) => {
  await open(page);
  await expect(page.locator('#recipeBand')).toBeVisible();
  const ids = await seedIds(page);
  const plan = await page.evaluate(() => window.FS.CROPS.concat([window.FS.NADAS]).filter(c => document.querySelector('#planTitle').getAttribute('aria-label').split(' → ').includes(c.n)).map(c => c.id));
  expect(ids.sort()).toEqual(plan.filter(id => id !== 'nadas').sort());
  await expect(page.locator('#recipeT tbody tr')).toHaveCount(4); // 3 years + total
  await expect(page.locator('#recipeTitle')).toHaveText('3 yıllık plan için girdi reçetesi');
  await expect(page.locator('#recipeLead')).toContainText('mazot, üre');
  await expect(page.locator('#recipeLead')).toContainText('L mazot');
});

test('with every price: per-year cost, field total, and the numbers add up', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await page.locator('#recipeEnter').click();
  await expect(page.locator('#costBox')).toHaveAttribute('open', '');
  await page.fill('#urea', '20'); await page.locator('#urea').dispatchEvent('change');
  await page.fill('#fuel', '50'); await page.locator('#fuel').dispatchEvent('change');
  for (const id of await seedIds(page)) { await page.fill(`#seed-${id}`, '10'); await page.locator(`#seed-${id}`).dispatchEvent('change'); }
  await expect(page.locator('#recipeTitle')).toContainText('girdi maliyeti');
  await expect(page.locator('#recipeTitle')).toContainText('(20 dekar)');
  // Recompute the same numbers in the page's model and compare with the table.
  const want = await page.evaluate(() => {
    const all = window.FS.CROPS.concat([window.FS.NADAS]), seq = document.querySelector('#planTitle').getAttribute('aria-label').split(' → ').map(n => all.find(c => c.n === n));
    const seed = {}; seq.forEach(c => { seed[c.id] = 10; });
    return window.FS.recipe(seq, { prev: all.find(c => c.id === 'bugday'), irrigation: false, credit: 4, area: 20, prices: { fuel: 50, urea: 20, seed } }).field;
  });
  await expect(page.locator('#recipeT tr.total td').last()).toHaveText(`${Math.round(want).toLocaleString('tr-TR')} ₺`);
  // Area change rescales the field total.
  await page.fill('#area', '40'); await page.locator('#area').dispatchEvent('change');
  await expect(page.locator('#recipeTitle')).toContainText('(40 dekar)');
  await expect(page.locator('#recipeT tr.total td').last()).toHaveText(`${Math.round(want * 2).toLocaleString('tr-TR')} ₺`);
  expect(errors).toEqual([]);
});

test('seed prices survive a plan change and the language switch', async ({ page }) => {
  await open(page);
  const [first] = await seedIds(page);
  await page.locator('#costBox summary').click();
  await page.fill(`#seed-${first}`, '33'); await page.locator(`#seed-${first}`).dispatchEvent('change');
  await page.locator('#lEn').click();
  await expect(page.locator('#recipeBand .eyebrow')).toHaveText('Input recipe');
  await expect(page.locator(`#seed-${first}`)).toHaveValue('33');
  await expect(page.locator('#seedPrices label').first()).toContainText('seed (₺/');
  await expect(page.locator('#recipeLead')).toContainText('enter these prices');
  await page.locator('.pbtn[data-snap="cukurova"]').click();
  await page.locator('.pbtn[data-snap="konya"]').click();
  await expect(page.locator(`#seed-${first}`)).toHaveValue('33');
});

test.describe('phone (375 px)', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('recipe table stacks without sideways scrolling', async ({ page }) => {
    await open(page);
    await page.locator('#recipeBand').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

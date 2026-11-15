// "Veri kontrolleri" panel: what the plan's data was checked for, with a second source (ERA5 via Open-Meteo).
const { test, expect } = require('@playwright/test');
const { mockServices, watchErrors } = require('./mocks.cjs');

const row = (page, id) => page.locator(`#checks li[data-chk="${id}"]`);
const open = async (page, opts) => {
  await mockServices(page, opts);
  await page.goto('/index.html');
  await expect(page.locator('#planTitle')).toHaveAttribute('aria-label', /→/);
};

test('saved Konya data: every check passes, the second source agrees, the hero links to the panel', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await expect(page.locator('#checks li')).toHaveCount(8);
  await expect(row(page, 'second')).toHaveAttribute('data-state', 'ok');
  await expect(row(page, 'second')).toContainText('NASA POWER');
  await expect(row(page, 'fresh')).toContainText('kayıtlı veri');
  for (const id of ['fresh', 'missing', 'limits', 'jumps', 'daily', 'modis', 'soil']) await expect(row(page, id)).toHaveAttribute('data-state', 'ok');
  await expect(page.locator('#checkTitle')).toHaveText('8 kontrolden 8 tanesi geçti');
  await expect(page.locator('#checkLink')).toHaveText('Veri kontrolleri: 8/8 geçti');
  await page.locator('#checkLink').click();
  await expect(page).toHaveURL(/#checkBand$/);
  expect(errors).toEqual([]);
});

test('a second source with half the rain is flagged, with the size of the gap', async ({ page }) => {
  await open(page, { secondRain: 0.5 });
  await expect(row(page, 'second')).toHaveAttribute('data-state', 'risk');
  await expect(row(page, 'second')).toContainText('+%100');
  await expect(row(page, 'second')).toContainText('Yağış farkı büyük');
  await expect(page.locator('#checkTitle')).toHaveText('8 kontrolden 7 tanesi geçti · 1 uyarı');
});

test('second source unreachable: the row says so, the plan and the other checks are unaffected', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, { second: 'fail' });
  await expect(row(page, 'second')).toHaveAttribute('data-state', 'nil');
  await expect(row(page, 'second')).toContainText('ulaşılamadı');
  await expect(row(page, 'missing')).toHaveAttribute('data-state', 'ok');
  expect(errors.filter(e => !/open-meteo|503/i.test(e))).toEqual([]);
});

test('live data without daily temperatures, MODIS or soil: those rows warn', async ({ page }) => {
  await open(page, { daily: 'fail', modis: 'fail', soil: 'fail' });
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('Plan hazır');
  await expect(row(page, 'daily')).toHaveAttribute('data-state', 'risk');
  await expect(row(page, 'modis')).toHaveAttribute('data-state', 'risk');
  await expect(row(page, 'soil')).toHaveAttribute('data-state', 'risk');
  await expect(row(page, 'fresh')).toContainText("NASA POWER'dan şimdi çekildi");
});

test('synthetic example: real-data checks are marked not checked', async ({ page }) => {
  await open(page);
  await page.locator('#demo').click();
  for (const id of ['fresh', 'daily', 'second', 'modis']) await expect(row(page, id)).toHaveAttribute('data-state', 'nil');
});

test('English: the panel follows the language', async ({ page }) => {
  await open(page, { secondRain: 0.5 });
  await page.locator('#lEn').click();
  await expect(page.locator('#checkBand .eyebrow')).toHaveText('Data checks');
  await expect(page.locator('#checkTitle')).toHaveText('7 of 8 checks passed · 1 warning');
  await expect(row(page, 'second')).toContainText('+100%');
  await expect(row(page, 'second')).toContainText('Large rainfall gap');
});

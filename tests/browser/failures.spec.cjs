// "Münavebe planımı çıkar" against mocked services: success, each service failing, and slow answers.
const { test, expect } = require('@playwright/test');
const { mockServices } = require('./mocks.cjs');

const status = page => page.locator('#status');
const open = async (page, opts) => {
  await mockServices(page, opts);
  await page.goto('/index.html');
  await expect(page.locator('#planTitle')).toHaveAttribute('aria-label', /→/);
};
const goAt = async (page, lat, lon) => {
  if (lat != null) {
    await page.locator('#vEng').click();
    await page.fill('#lat', String(lat)); await page.locator('#lat').dispatchEvent('change');
    await page.fill('#lon', String(lon)); await page.locator('#lon').dispatchEvent('change');
  }
  await page.locator('#go').click();
};

test('all services answer: plan from live data, every source marked ok', async ({ page }) => {
  await open(page, {});
  await goAt(page);
  await expect(status(page)).toContainText('Plan hazır; güncel NASA verisiyle.');
  for (const src of ['power', 'modis', 'soil']) await expect(page.locator(`#srcStatus li[data-src="${src}"]`)).toHaveAttribute('data-state', 'ok');
  await expect(page.locator('#evidenceNote')).toContainText('Güncel NASA verisi');
});

test('while loading: busy button, per-source progress, old results dimmed', async ({ page }) => {
  await open(page, { power: 1500 });
  await goAt(page);
  await expect(page.locator('#go')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#go')).toContainText('NASA verisi çekiliyor');
  await expect(page.locator('#srcStatus li[data-src="power"]')).toHaveAttribute('data-state', 'loading');
  await expect(page.locator('#results')).toHaveClass(/is-stale/);
  await expect(status(page)).toContainText('Plan hazır', { timeout: 10_000 });
  await expect(page.locator('#go')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#results')).not.toHaveClass(/is-stale/);
});

test('POWER down at a preset location: falls back to the saved real data and says so', async ({ page }) => {
  await open(page, { power: 'fail' });
  await goAt(page);
  await expect(status(page)).toContainText('kayıtlı veri gösteriliyor');
  await expect(page.locator('#planTitle')).toHaveAttribute('aria-label', /→/);
});

test('POWER down elsewhere: clear error, previous plan kept, no crash', async ({ page }) => {
  await open(page, { power: 'fail' });
  const before = await page.locator('#planTitle').getAttribute('aria-label');
  await goAt(page, 39.9, 32.85);
  await expect(status(page)).toContainText('NASA POWER verisi alınamadı');
  await expect(page.locator('#go')).toBeEnabled();
  await expect(page.locator('#planTitle')).toHaveAttribute('aria-label', before);
});

test('daily temperatures down: plan still made, warning that heat/frost may be overstated', async ({ page }) => {
  await open(page, { daily: 'fail' });
  await goAt(page);
  await expect(status(page)).toContainText('Günlük sıcaklık alınamadı');
  await expect(status(page).locator('.err')).toBeVisible();
});

test('MODIS down: plan still made, status names the missing greenness data', async ({ page }) => {
  await open(page, { modis: 'fail' });
  await goAt(page);
  await expect(status(page)).toContainText('uydu yeşilliği verisi olmadan');
  await expect(page.locator('#srcStatus li[data-src="modis"]')).toHaveAttribute('data-state', 'err');
});

test('SoilGrids down: plan still made, soil marked missing', async ({ page }) => {
  await open(page, { soil: 'fail' });
  await goAt(page);
  await expect(status(page)).toContainText('toprak');
  await expect(page.locator('#srcStatus li[data-src="soil"]')).toHaveAttribute('data-state', 'err');
});

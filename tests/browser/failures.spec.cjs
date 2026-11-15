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

test('the annual chart skips a year with missing rainfall and still plots temperature', async ({ page }) => {
  await open(page, { missingRainMonth: '202501' });
  await page.locator('#vEng').click();
  const annualChart = page.locator('#f1 svg');
  const rainBars = annualChart.locator('rect');
  await expect(rainBars).toHaveCount(25);
  const temperature = await annualChart.locator('polyline').getAttribute('points');
  await goAt(page);
  await expect(status(page)).toContainText('Plan hazır; güncel NASA verisiyle.');
  await expect(rainBars).toHaveCount(24);
  await expect(annualChart.locator('polyline')).toHaveAttribute('points', temperature);
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

test('slow MODIS: plan appears from POWER + soil, then updates when MODIS arrives', async ({ page }) => {
  await open(page, { modis: 3000 });
  await goAt(page);
  // Plan is ready and the button free while MODIS is still loading.
  await expect(page.locator('#go')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#srcStatus li[data-src="modis"]')).toHaveAttribute('data-state', 'loading');
  await expect(status(page)).toContainText('arka planda yükleniyor');
  await expect(page.locator('#evidenceNote')).toContainText('Güncel NASA verisi');
  // MODIS arrives: status settles, toast confirms the update.
  await expect(page.locator('#srcStatus li[data-src="modis"]')).toHaveAttribute('data-state', 'ok', { timeout: 15_000 });
  await expect(status(page)).toContainText('Plan hazır; güncel NASA verisiyle.');
  await expect(status(page)).not.toContainText('arka planda');
  await expect(page.locator('#toast')).toContainText('MODIS yeşillik verisi geldi');
});

test('a late MODIS answer does not overwrite a preset chosen in the meantime', async ({ page }) => {
  await open(page, { modis: 2500 });
  await goAt(page);
  await expect(page.locator('#go')).toHaveAttribute('aria-busy', 'false');
  await page.locator('.pbtn[data-snap="trakya"]').click();
  const presetStatus = await status(page).innerText();
  await page.waitForTimeout(3500); // MODIS for the old lookup arrives during this wait
  await expect(status(page)).toHaveText(presetStatus);
  await expect(page.locator('#evidenceNote')).toContainText('kaydedilmiş gerçek NASA verisi');
});

test('slow SoilGrids: plan appears after ~5 s without soil, then updates when soil arrives', async ({ page }) => {
  await open(page, { soil: 8000 });
  const t = Date.now();
  await goAt(page);
  await expect(page.locator('#go')).toHaveAttribute('aria-busy', 'false', { timeout: 8000 });
  const waited = Date.now() - t;
  expect(waited).toBeLessThan(7500);            // did not wait the full 8 s for soil
  await expect(page.locator('#srcStatus li[data-src="soil"]')).toHaveAttribute('data-state', 'loading');
  await expect(status(page)).toContainText('SoilGrids toprak');
  await expect(status(page)).toContainText('arka planda yükleniyor');
  await expect(page.locator('#srcStatus li[data-src="soil"]')).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
  await expect(status(page)).not.toContainText('SoilGrids toprak');
  await expect(page.locator('#soilNote')).toContainText('SoilGrids tahmini');
});

// Privacy: the notice is easy to find, and what it says is what the page does.
const { test, expect } = require('@playwright/test');
const { mockServices } = require('./mocks.cjs');

const open = async page => {
  await mockServices(page);
  await page.goto('/index.html');
  await expect(page.locator('#planTitle')).toHaveAttribute('aria-label', /→/);
};
// Every request the page makes, with its URL and body.
const recordRequests = page => { const seen = []; page.on('request', r => seen.push(`${r.url()} ${r.postData() || ''}`)); return seen; };

test('the notice is visible to farmers: header link, a note next to the inputs, and the section itself', async ({ page }) => {
  await open(page);
  await expect(page.locator('.hdr-link')).toBeVisible();
  await expect(page.locator('.privacy-note')).toBeVisible();
  await page.locator('.hdr-link').click();
  await expect(page).toHaveURL(/#privacyBand$/);
  await expect(page.locator('#privacyBand')).toBeVisible();
  await expect(page.locator('#privacyBand')).toContainText('hiçbir yere gönderilmez');
  await page.locator('#lEn').click();
  await expect(page.locator('#privacyTitle')).toHaveText('How your location and soil test are used');
});

test('soil test values, prices and area are never sent; only the two preferences are stored', async ({ page }) => {
  const seen = recordRequests(page);
  await open(page);
  // Distinctive values that would stand out in any URL or body.
  await page.locator('#labBox summary').click();
  for (const [id, v] of [['ph', '6.37'], ['clay', '41'], ['lime', '17.3'], ['ec', '3.9']]) { await page.fill(`#${id}`, v); await page.locator(`#${id}`).dispatchEvent('change'); }
  await page.locator('#costBox summary').click();
  for (const [id, v] of [['urea', '23.71'], ['fuel', '47.83'], ['area', '137']]) { await page.fill(`#${id}`, v); await page.locator(`#${id}`).dispatchEvent('change'); }
  const seedId = await page.locator('#seedPrices input').first().getAttribute('data-seed');
  await page.fill(`#seed-${seedId}`, '88.19'); await page.locator(`#seed-${seedId}`).dispatchEvent('change');
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('Plan hazır');
  await page.waitForTimeout(500);
  expect(seen.length).toBeGreaterThan(5);
  for (const v of ['6.37', '17.3', '3.9', '23.71', '47.83', '88.19', '137']) {
    expect(seen.filter(s => s.includes(v)), `value ${v} left the page`).toEqual([]);
  }
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys.filter(k => !['fs-lang', 'fs-view'].includes(k))).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
});

test('tapping the map sends no coordinates', async ({ page }) => {
  await open(page);
  const seen = recordRequests(page);
  const map = page.locator('#map.leaflet-container'), box = await map.boundingBox();
  await map.click({ position: { x: Math.round(box.width * 0.3), y: Math.round(box.height * 0.7) } });
  await expect(page.locator('#parcel')).toBeVisible();
  const lat = await page.inputValue('#lat');
  await page.waitForTimeout(500);
  expect(seen.filter(s => s.includes(lat) || /power\.larc|isric|modis\.ornl|open-meteo/.test(s))).toEqual([]);
});

test('coordinates leave the page rounded to 3 decimals (~100 m), never at full precision', async ({ page }) => {
  await open(page);
  const seen = recordRequests(page);
  await page.locator('#vEng').click();
  await page.fill('#lat', '38.7346'); await page.fill('#lon', '33.4079');
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('Plan hazır');
  await expect(page.locator('#checks li[data-chk="second"]')).not.toHaveAttribute('data-state', /^$/);
  await page.waitForTimeout(500);
  const data = seen.filter(s => /power\.larc|isric|modis\.ornl|open-meteo/.test(s));
  for (const host of ['power.larc', 'isric', 'modis.ornl', 'open-meteo']) expect(data.some(s => s.includes(host)), host).toBe(true);
  expect(data.filter(s => s.includes('38.7346') || s.includes('33.4079'))).toEqual([]);
  expect(data.every(s => s.includes('38.735') && s.includes('33.408'))).toBe(true);
});

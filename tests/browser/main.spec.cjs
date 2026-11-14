// Main user flows on the real embedded data. Run: npx playwright test
const { test, expect } = require('@playwright/test');
const { mockServices, watchErrors, golden } = require('./mocks.cjs');

const REGIONS = ['konya', 'cukurova', 'harran', 'trakya'];
const plan = page => page.locator('#planTitle');
const names = (page, ids) => page.evaluate(ids => ids.map(id => window.FS.CROPS.concat([window.FS.NADAS]).find(c => c.id === id).n).join(' → '), ids);

test.beforeEach(async ({ page }) => {
  await mockServices(page);
  await page.goto('/index.html');
  await expect(plan(page)).toHaveAttribute('aria-label', /→/);
});

test('opens on real Konya data, not the synthetic example', async ({ page }) => {
  await expect(page.locator('#status')).toContainText('Konya Ovası');
  await expect(page.locator('#status')).toContainText('kayıtlı NASA verisi');
  await expect(page.locator('#demoNote')).toBeHidden();
  await expect(page.locator('#evidenceNote')).toContainText('kaydedilmiş gerçek NASA verisi');
  await expect(plan(page)).toHaveAttribute('aria-label', await names(page, golden()['konya/kıraç'].plan));
});

test('each preset shows the same plan as the regional record (dry and irrigated)', async ({ page }) => {
  const g = golden();
  for (const r of REGIONS) {
    await page.locator(`.pbtn[data-snap="${r}"]`).click();
    await expect(page.locator(`.pbtn[data-snap="${r}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.check('#kirac');
    await expect(plan(page)).toHaveAttribute('aria-label', await names(page, g[`${r}/kıraç`].plan));
    await page.check('#irr');
    await expect(plan(page)).toHaveAttribute('aria-label', await names(page, g[`${r}/sulu`].plan));
  }
});

test('warmer-and-drier toggle recomputes for +2 °C / -20 % and can be undone', async ({ page }) => {
  await page.locator('label[for="hot"]').click();
  await expect(page.locator('#hot')).toBeChecked();
  await expect(page.locator('#dT')).toHaveValue('2');
  await expect(page.locator('#dP')).toHaveValue('-20');
  await expect(page.locator('#planShift')).toContainText('+2 °C');
  // Either the scenario message, or (if the plan changed) the undo message.
  await expect(page.locator('#toast')).toContainText(/\+2 °C|Plan değişti/);
  await page.locator('label[for="hot"]').click();
  await expect(page.locator('#dT')).toHaveValue('0');
  await expect(page.locator('#planShift')).not.toContainText('senaryosuyla');
});

test('soil-test salinity lowers salt-sensitive crops and is credited to the lab report', async ({ page }) => {
  await page.locator('#vEng').click();
  await page.locator('.pbtn[data-snap="harran"]').click();
  await page.check('#irr');
  const score = id => page.locator('#suitT tbody tr', { hasText: id }).locator('td[data-l="Senaryo"] b').innerText().then(Number);
  const before = { misir: await score('Mısır'), arpa: await score('Arpa') };
  await page.locator('#labBox summary').click();
  await page.fill('#ec', '9');
  await page.locator('#ec').dispatchEvent('change');
  await expect(page.locator('#labNote')).toContainText('EC 9 dS/m');
  await expect(page.locator('#evidenceNote')).toContainText('Toprak analiz raporundan');
  expect(await score('Mısır')).toBeLessThan(before.misir);   // maize threshold 1.7 dS/m
  expect(await score('Arpa')).toBe(before.arpa);              // barley threshold 8 dS/m: within tolerance
});

test('farmer / engineer views show and hide the technical sections, and the choice is remembered', async ({ page }) => {
  await page.locator('#vFarm').click();
  await expect(page.locator('#climBand')).toBeHidden();
  await expect(page.locator('#methodBand')).toBeHidden();
  await page.locator('#vEng').click();
  await expect(page.locator('#climBand')).toBeVisible();
  await expect(page.locator('#thrT tbody tr')).toHaveCount(13);
  await page.reload();
  await expect(page.locator('#vEng')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#methodBand')).toBeVisible();
});

test('clicking the map shows the parcel card with coordinates and the TKGM link', async ({ page }) => {
  const map = page.locator('#map.leaflet-container');
  await expect(map).toBeVisible();
  const box = await map.boundingBox();
  // Click the map element itself (scrolled into view, checked for overlays), away from marker and controls.
  await map.click({ position: { x: Math.round(box.width * 0.3), y: Math.round(box.height * 0.7) } });
  await expect(page.locator('#parcel')).toBeVisible();
  await expect(page.locator('#parcel')).toContainText('Seçtiğin nokta');
  await expect(page.locator('#parcel a')).toHaveAttribute('href', 'https://parselsorgu.tkgm.gov.tr/');
  await expect(page.locator('#copyLL')).toBeVisible();
});

test('reasons carry a data-source tag and year tiles name the limiting factor', async ({ page }) => {
  await expect(page.locator('#planWhy li .tag').first()).toBeVisible();
  await expect(page.locator('#planYears .yr__src').first()).toContainText(/Sınırlayan|İklim uygun/);
});

test('no console errors through the main flow', async ({ page }) => {
  const errors = watchErrors(page);
  await page.reload();
  await expect(plan(page)).toHaveAttribute('aria-label', /→/);
  for (const r of REGIONS) await page.locator(`.pbtn[data-snap="${r}"]`).click();
  await page.locator('#vEng').click();
  await page.locator('label[for="hot"]').click();
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('Plan hazır');
  expect(errors).toEqual([]);
});

test('climate pattern section: significant warming, Harran 2007-2009 drought, p-values only in engineer view', async ({ page }) => {
  await expect(page.locator('#patternBand')).toBeVisible();
  await expect(page.locator('#patTitle')).toContainText('Isınma belirgin');
  await expect(page.locator('#patTrends li')).toHaveCount(6);
  await expect(page.locator('#patLead')).toContainText('gelecek tahmini değildir');
  await page.locator('.pbtn[data-snap="harran"]').click();
  await expect(page.locator('#patSpiText')).toContainText('2007, 2008, 2009');
  await expect(page.locator('#patSpi .yb.dry')).toHaveCount(4);
  await expect(page.locator('#patSpi')).toHaveAttribute('aria-label', /Kurak yıllar: 2007, 2008, 2009/);
  await page.locator('#vFarm').click();
  await expect(page.locator('#patTrends .raw').first()).toBeHidden();
  await page.locator('#vEng').click();
  await expect(page.locator('#patTrends .raw').first()).toContainText('p = ');
  // History is not changed by the scenario toggle.
  const before = await page.locator('#patTitle').innerText();
  await page.locator('label[for="hot"]').click();
  await expect(page.locator('#patTitle')).toHaveText(before);
});

test('undo: a setting that changes the plan can be undone from the message', async ({ page }) => {
  const before = await page.locator('#planTitle').getAttribute('aria-label');
  await page.selectOption('#years', '2');
  await expect(page.locator('#planTitle')).not.toHaveAttribute('aria-label', before);
  const toastEl = page.locator('#toast');
  await expect(toastEl).toContainText('Plan değişti');
  await toastEl.getByRole('button', { name: 'Geri al' }).click();
  await expect(page.locator('#years')).toHaveValue('3');
  await expect(page.locator('#planTitle')).toHaveAttribute('aria-label', before);
  await expect(toastEl).toContainText('Önceki plana dönüldü');
});

test('reset link appears only when settings differ, and restores the defaults', async ({ page }) => {
  await expect(page.locator('#reset')).toBeHidden();
  await page.fill('#area', '55'); await page.locator('#area').dispatchEvent('change');
  await page.locator('.goal[data-goal="toprak"]').click();
  await expect(page.locator('#reset')).toBeVisible();
  await page.locator('#reset').click();
  await expect(page.locator('#area')).toHaveValue('20');
  await expect(page.locator('.goal[data-goal="denge"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#reset')).toBeHidden();
});

test('evidence note is a one-line summary that opens to the full text', async ({ page }) => {
  await expect(page.locator('#evidenceSum')).toContainText('model önerisi');
  await expect(page.locator('#evidenceNote')).toBeHidden();
  await page.locator('#evidenceBox summary').click();
  await expect(page.locator('#evidenceNote')).toBeVisible();
});

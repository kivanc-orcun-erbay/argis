// Turkish / English switch: every visible text follows the language, the plan does not change.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { mockServices, watchErrors } = require('./mocks.cjs');

const plan = page => page.locator('#planTitle');
const ids = page => page.evaluate(() => { const all = window.FS.CROPS.concat([window.FS.NADAS]); return document.querySelector('#planTitle').getAttribute('aria-label').split(' → ').map(n => all.find(c => c.n === n).id); });
// Letters only Turkish uses. Proper names that keep them in English are allowed.
const turkishLeft = page => page.evaluate(() => document.body.innerText.replace(/Çukurova/g, '').split('\n').filter(l => /[ğışçöüĞİŞÇÖÜ]/.test(l)));

test.beforeEach(async ({ page }) => {
  await mockServices(page);
  await page.goto('/index.html');
  await expect(plan(page)).toHaveAttribute('aria-label', /→/);
});

test('opens in Turkish; EN switches all visible text, TR brings it back', async ({ page }) => {
  const errors = watchErrors(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(page.locator('#lTr')).toHaveAttribute('aria-pressed', 'true');
  const trPlan = await ids(page);

  await page.locator('#lEn').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle(/crop rotation plans/);
  await expect(page.locator('.hdr p')).toHaveText(/A crop rotation plan for your field/);
  await expect(page.locator('#go')).toContainText('Make my rotation plan');
  await expect(page.locator('#status')).toContainText('NASA data saved on');
  await expect(page.locator('#planEyebrow')).toHaveText('Your 3-year rotation plan');
  expect(await ids(page)).toEqual(trPlan);
  await expect(page.locator('#planWhy li .tag').first()).toBeVisible();
  await expect(page.locator('#planYears .yr__src').first()).toContainText(/Limited by|Climate suits/);
  await expect(page.locator('#prev option[value="bugday"]')).toHaveText('Wheat');
  await page.locator('#vEng').click();
  expect(await turkishLeft(page)).toEqual([]);

  await page.locator('#lTr').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(page.locator('.hdr p')).toHaveText(/Tarlana göre münavebe planı/);
  await expect(page.locator('#planEyebrow')).toHaveText('3 yıllık münavebe planın');
  await expect(page.locator('#prev option[value="bugday"]')).toHaveText('Buğday');
  expect(await ids(page)).toEqual(trPlan);
  expect(errors).toEqual([]);
});

test('English after live data, a map click and the hot scenario: no Turkish left', async ({ page }) => {
  await page.locator('#lEn').click();
  await page.locator('#vEng').click();
  await page.locator('label[for="hot"]').click();
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('Plan ready');
  const map = page.locator('#map.leaflet-container'), box = await map.boundingBox();
  await map.click({ position: { x: Math.round(box.width * 0.3), y: Math.round(box.height * 0.7) } });
  await expect(page.locator('#parcel')).toContainText('Point you picked');
  expect(await turkishLeft(page)).toEqual([]);
});

test('changing language translates open planning and evidence panels and preserves their inputs', async ({ page }) => {
  const errors = watchErrors(page);
  await page.locator('#vEng').click();
  await page.locator('#currentPlan summary').click();
  await page.selectOption('#cycle1', 'bugday');
  await page.selectOption('#cycle2', 'nadas');
  await page.selectOption('#cycle3', 'bugday');
  await page.check('#keep1');
  await page.locator('#planningBox summary').click();
  await page.check('#irr');
  await page.fill('#startMonth', '2026-12');
  await page.fill('#harvestDeadline', '2028-12');
  await page.fill('#waterQuota', '999');
  await page.check('#replayDry');
  await page.locator('#fieldEvidence summary').click();
  await expect(page.locator('#fieldEvidenceRows')).toContainText('ölçülen tüketim');
  const trPlan = await ids(page);

  await page.locator('#lEn').click();
  await expect(page.locator('#currentPlan summary')).toHaveText('Compare with my current plan');
  await expect(page.locator('#cycle1')).toHaveValue('bugday');
  await expect(page.locator('#cycle1 option:checked')).toHaveText('Wheat');
  await expect(page.locator('#keep1')).toBeChecked();
  await expect(page.locator('#keep1')).toHaveAccessibleName('Keep this crop (year 1)');
  await expect(page.locator('#singleChangeBefore')).toHaveText('Current plan · Wheat → Fallow → Wheat');
  await expect(page.locator('#singleChangeMeasures')).toContainText('Peak seasonal irrigation');
  await expect(page.locator('#constraintResult')).toContainText('First harvest by December 2028');
  await expect(page.locator('#waterQuota')).toHaveValue('999');
  await expect(page.locator('#dryResult')).toContainText('Dry-year test · 2013');
  await expect(page.locator('#fieldEvidenceRows')).toContainText('241 mm measured water use');
  expect(await ids(page)).toEqual(trPlan);

  await page.locator('#lTr').click();
  await expect(page.locator('#singleChangeBefore')).toHaveText('Mevcut plan · Buğday → Nadas → Buğday');
  await expect(page.locator('#fieldEvidenceRows')).toContainText('ölçülen tüketim');
  expect(errors).toEqual([]);
});

test('the choice is remembered, and ?lang=en opens in English', async ({ page }) => {
  await page.locator('#lEn').click();
  await page.reload();
  await expect(plan(page)).toHaveAttribute('aria-label', /→/);
  await expect(page.locator('#lEn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#planEyebrow')).toHaveText(/rotation plan/);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/index.html?lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#status')).toContainText('Konya Plain');
});

test('accessibility in English: no serious or critical axe violations', async ({ page }) => {
  await page.locator('#lEn').click();
  await page.locator('#vEng').click();
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const res = await new AxeBuilder({ page }).exclude('#map').withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = res.violations.filter(v => ['serious', 'critical'].includes(v.impact));
  expect(bad.map(v => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0].target.join(' ')} — ${v.help}`)).toEqual([]);
});

test.describe('phone (375 px), English', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('longer English crop names still fit: no sideways scrolling in either view', async ({ page }) => {
    await page.locator('#lEn').click();
    for (const r of ['konya', 'cukurova', 'harran', 'trakya']) {
      await page.locator(`.pbtn[data-snap="${r}"]`).click();
      await page.locator('#years').selectOption('4');
      for (const v of ['#vFarm', '#vEng']) {
        await page.locator(v).click();
        // Fixed 375: on a phone the browser widens the layout viewport to fit content, so innerWidth would hide an overflow.
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${r} ${v}`).toBeLessThanOrEqual(375);
      }
    }
  });
});

// Phone layout, dark mode, reduced motion and an automated accessibility scan (axe).
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { mockServices } = require('./mocks.cjs');

const ready = async page => {
  await mockServices(page);
  await page.goto('/index.html');
  await expect(page.locator('#planTitle')).toHaveAttribute('aria-label', /→/);
};
// Compared with the set width: on a phone the browser widens the layout viewport to fit wide content,
// so scrollWidth <= innerWidth would pass even when the page overflows.
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= 375);

test.describe('phone (375 px)', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('no sideways scrolling in either view, plan and main button reachable', async ({ page }) => {
    await ready(page);
    expect(await noSideScroll(page)).toBe(true);
    await page.locator('#vEng').click();
    await page.locator('#labBox summary').click();
    expect(await noSideScroll(page)).toBe(true);
    await expect(page.locator('#go')).toBeVisible();
    await page.locator('#planBand').scrollIntoViewIfNeeded();
    await expect(page.locator('#planYears .yr')).toHaveCount(3);
  });
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('uses the dark palette', async ({ page }) => {
    await ready(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(13, 24, 30)'); // --bg in dark mode
    const ink = await page.evaluate(() => getComputedStyle(document.querySelector('#planTitle')).color);
    expect(ink).not.toBe('rgb(19, 33, 42)'); // not the light-mode ink
  });
});

test.describe('reduced motion', () => {
  test('animations are effectively off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.cta')).transitionDuration);
    expect(parseFloat(dur)).toBeLessThanOrEqual(0.001);
  });
});

for (const view of ['farm', 'eng']) {
  test(`accessibility: no serious or critical axe violations (${view} view)`, async ({ page }) => {
    await ready(page);
    if (view === 'eng') await page.locator('#vEng').click();
    // Sections fade in (0.22 s); scanning mid-fade measures half-transparent text as low contrast.
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
    // The Leaflet map is third-party; its own controls are out of scope here.
    const res = await new AxeBuilder({ page }).exclude('#map').withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = res.violations.filter(v => ['serious', 'critical'].includes(v.impact));
    expect(bad.map(v => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0].target.join(' ')} — ${v.help}`)).toEqual([]);
  });
}

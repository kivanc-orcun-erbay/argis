// Page load and interaction latency in Chromium (Playwright), cold cache every run.
//   node tests/bench/page.cjs [url] [runs]
// Default URL is the live GitHub Pages site. Two profiles:
//   desktop: no throttling
//   phone:   4x CPU slowdown + "slow 4G" (1.6 Mbit/s down, 750 kbit/s up, 150 ms RTT), 375x812 viewport
const { chromium } = require('@playwright/test');

const URL = process.argv[2] || 'https://kivanc-orcun-erbay.github.io/fieldshift/';
const RUNS = +(process.argv[3] || 7);
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, cpu: 1, net: null },
  phone: { viewport: { width: 375, height: 812 }, cpu: 4, net: { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 } },
};
const med = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const p95 = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(.95 * s.length))] : null; };

async function oneLoad(browser, prof) {
  const ctx = await browser.newContext({ viewport: prof.viewport });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (prof.net) await cdp.send('Network.emulateNetworkConditions', prof.net);
  if (prof.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu });
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto(URL, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction(() => /→/.test(document.getElementById('planTitle')?.getAttribute('aria-label') || ''), null, { timeout: 120_000 });
  const planAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0], res = performance.getEntriesByType('resource');
    const kb = x => Math.round(x / 1024);
    const pageBytes = n.transferSize, own = res.filter(r => r.name.includes('/fieldshift/')).reduce((s, r) => s + r.transferSize, 0);
    const all = pageBytes + res.reduce((s, r) => s + r.transferSize, 0);
    return { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, lcp: window.__lcp, htmlKB: kb(pageBytes), ownKB: kb(pageBytes + own), allKB: kb(all), requests: res.length + 1 };
  });
  m.plan = planAt;

  // Interaction latency: from the event to the next painted frame (compute + DOM update).
  const act = async js => page.evaluate(async js => {
    const t = performance.now(); new Function(js)();
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    return performance.now() - t;
  }, js);
  m.preset = await act(`document.querySelector('.pbtn[data-snap="trakya"]').click()`);
  m.irrigation = await act(`document.getElementById('irr').click()`);
  m.scenario = await act(`document.getElementById('hot').click()`);
  m.years4 = await act(`const s=document.getElementById('years'); s.value='4'; s.dispatchEvent(new Event('change'))`);
  m.years3 = await act(`const s=document.getElementById('years'); s.value='3'; s.dispatchEvent(new Event('change'))`);
  m.view = await act(`document.getElementById('vEng').click()`);
  await ctx.close();
  return m;
}

(async () => {
  const browser = await chromium.launch();
  console.log(`${URL}\nChromium ${browser.version()}, ${RUNS} cold loads per profile, median (p95), ms unless noted\n`);
  for (const [name, prof] of Object.entries(PROFILES)) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) { try { runs.push(await oneLoad(browser, prof)); } catch (e) { console.error(`  ${name} run ${i + 1} failed: ${e.message.split('\n')[0]}`); } }
    if (!runs.length) continue;
    const col = k => `${Math.round(med(runs.map(r => r[k])))} (${Math.round(p95(runs.map(r => r[k])))})`;
    console.log(`### ${name}`);
    console.log(`| TTFB | DOM ready | load event | LCP | first plan shown | HTML KB | page total KB | all incl. map/fonts KB | requests |`);
    console.log(`|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);
    console.log(`| ${col('ttfb')} | ${col('dcl')} | ${col('load')} | ${col('lcp')} | ${col('plan')} | ${med(runs.map(r => r.htmlKB))} | ${med(runs.map(r => r.ownKB))} | ${med(runs.map(r => r.allKB))} | ${med(runs.map(r => r.requests))} |\n`);
    console.log(`| preset click | irrigation | +2 °C scenario | plan 3 → 4 years | plan 4 → 3 years | engineer view |`);
    console.log(`|---:|---:|---:|---:|---:|---:|`);
    console.log(`| ${col('preset')} | ${col('irrigation')} | ${col('scenario')} | ${col('years4')} | ${col('years3')} | ${col('view')} |\n`);
  }
  await browser.close();
})();

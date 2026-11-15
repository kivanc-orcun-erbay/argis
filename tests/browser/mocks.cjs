// Mocks for every outside service the page calls, built from the real saved data in data/raw/.
// Tests never depend on NASA / ISRIC / ORNL being up, and each service can be made to fail.
const fs = require('node:fs');
const path = require('node:path');

const RAW = path.join(__dirname, '..', '..', 'data', 'raw');
const load = name => JSON.parse(fs.readFileSync(path.join(RAW, name + '.json'), 'utf8'));
const ym = (y0, i) => `${y0 + Math.floor(i / 12)}${String(i % 12 + 1).padStart(2, '0')}`;

function powerMonthly(region, missingRainMonth) {
  const pw = load(`${region}_power`), parameter = {};
  for (const [k, arr] of Object.entries(pw.p)) { parameter[k] = {}; arr.forEach((v, i) => { parameter[k][ym(pw.y0, i)] = v == null ? -999 : v; }); }
  if (missingRainMonth) parameter.PRECTOTCORR[missingRainMonth] = -999;
  return { type: 'Feature', properties: { parameter } };
}
// Daily highs/lows whose monthly mean equals the saved (already daily-averaged) values.
function powerDaily(region) {
  const pw = load(`${region}_power`), parameter = { T2M_MAX: {}, T2M_MIN: {} };
  for (const k of ['T2M_MAX', 'T2M_MIN']) pw.p[k].forEach((v, i) => {
    const key = ym(pw.y0, i), y = +key.slice(0, 4), m = +key.slice(4), days = new Date(y, m, 0).getDate();
    for (let d = 1; d <= days; d++) parameter[k][`${key}${String(d).padStart(2, '0')}`] = v == null ? -999 : v;
  });
  return { type: 'Feature', properties: { parameter } };
}
function soilgrids(region) {
  const s = load(`${region}_soil`);
  const layer = (name, v) => ({ name, unit_measure: { d_factor: 10 }, depths: [{ values: { mean: v == null ? null : Math.round(v * 10) } }] });
  return { type: 'Feature', properties: { layers: [layer('phh2o', s.ph), layer('clay', s.clay), layer('soc', s.soc)] } };
}
const modisCode = iso => { const d = new Date(iso + 'T00:00:00Z'), doy = Math.round((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1; return `A${d.getUTCFullYear()}${String(doy).padStart(3, '0')}`; };
function modis(region) {
  const rows = load(`${region}_ndvi`);
  const dates = rows.map(([d]) => ({ modis_date: modisCode(d), calendar_date: d }));
  const subset = (band, start, end) => ({
    subset: rows.filter(([d]) => { const c = modisCode(d); return c >= start && c <= end; })
      .map(([d, v, q]) => ({ calendar_date: d, data: [band.includes('reliability') ? q : v == null ? -3000 : Math.round(v * 10000)] })),
  });
  return { dates: { dates }, subset };
}

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });

/**
 * Install routes on a page. opts: { region, power, daily, soil, modis } where each service is
 * 'ok' (default), 'fail' (HTTP 503) or a number of ms to delay an ok answer.
 */
async function mockServices(page, opts = {}) {
  const region = opts.region || 'konya';
  const mode = k => opts[k] == null ? 'ok' : opts[k];
  const answer = async (route, k, body) => {
    const m = mode(k);
    if (m === 'fail') return json(route, { error: 'unavailable' }, 503);
    if (typeof m === 'number') await new Promise(r => setTimeout(r, m));
    return json(route, body);
  };
  const md = modis(region);

  await page.route('https://power.larc.nasa.gov/**', route => {
    const daily = route.request().url().includes('/temporal/daily/');
    return daily ? answer(route, 'daily', powerDaily(region)) : answer(route, 'power', powerMonthly(region, opts.missingRainMonth));
  });
  await page.route('https://rest.isric.org/**', route => answer(route, 'soil', soilgrids(region)));
  await page.route('https://modis.ornl.gov/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/dates')) return answer(route, 'modis', md.dates);
    return answer(route, 'modis', md.subset(u.searchParams.get('band'), u.searchParams.get('startDate'), u.searchParams.get('endDate')));
  });
  // Map tiles, NASA GIBS layers and web fonts: answer empty so nothing hits the network or logs errors.
  const empty = route => route.fulfill({ status: 200, contentType: route.request().resourceType() === 'stylesheet' ? 'text/css' : 'image/png', body: '' });
  for (const host of ['https://server.arcgisonline.com/**', 'https://*.tile.openstreetmap.org/**', 'https://gibs.earthdata.nasa.gov/**', 'https://fonts.googleapis.com/**', 'https://fonts.gstatic.com/**']) await page.route(host, empty);
}

/** Collect console errors and page crashes for a "no errors" assertion. */
function watchErrors(page) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  return errors;
}

module.exports = { mockServices, watchErrors, golden: () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'regions.golden.json'), 'utf8')) };

// Latency of the outside data services behind "Münavebe planımı çıkar".
// Deliberately light: a few sequential requests with pauses, never in parallel, so it does
// not load NASA / ISRIC / ORNL servers. Not a load test.
//   node tests/bench/services.cjs [samples]
const SAMPLES = +(process.argv[2] || 3);
const LAT = 37.56, LON = 32.76; // Konya preset (cropland)
const P = 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,ALLSKY_SFC_SW_DWN';
const SERVICES = [
  ['NASA POWER monthly (2001-2025)', `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${P}&community=AG&longitude=${LON}&latitude=${LAT}&start=2001&end=2025&format=JSON`],
  ['NASA POWER daily highs/lows', `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN&community=AG&longitude=${LON}&latitude=${LAT}&start=20010101&end=20251231&format=JSON`],
  ['SoilGrids 2.0', `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${LON}&lat=${LAT}&property=phh2o&property=clay&property=soc&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean`],
  ['MODIS dates (ORNL)', `https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=${LAT}&longitude=${LON}`],
  ['MODIS one subset (10 dates)', `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=${LAT}&longitude=${LON}&band=250m_16_days_NDVI&startDate=A2025001&endDate=A2025145&kmAboveBelow=0&kmLeftRight=0`],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log(`${new Date().toISOString()}, ${SAMPLES} sequential samples each, 90 s timeout\n`);
  console.log('| Service | median | min | max | size | failures |');
  console.log('|---|---:|---:|---:|---:|---:|');
  for (const [name, url] of SERVICES) {
    const t = [], fails = []; let size = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const a = performance.now();
      try {
        const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(90_000) });
        const body = await r.arrayBuffer();
        if (!r.ok) throw new Error('HTTP ' + r.status);
        t.push(performance.now() - a); size = body.byteLength;
      } catch (e) { fails.push(e.name === 'TimeoutError' ? 'timeout' : e.message); }
      await sleep(2000);
    }
    const s = t.sort((x, y) => x - y), f = v => v == null ? '–' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
    console.log(`| ${name} | ${f(s[Math.floor(s.length / 2)])} | ${f(s[0])} | ${f(s[s.length - 1])} | ${size ? Math.round(size / 1024) + ' KB' : '–'} | ${fails.length ? fails.length + ' (' + [...new Set(fails)].join(', ') + ')' : 0} |`);
  }
  console.log('\nThe page asks for MODIS in ~24 subset requests (2 bands x 12 chunks of 10 dates), 6 at a time.');
})();

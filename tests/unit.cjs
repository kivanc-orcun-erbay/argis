// Unit tests for the FS model block in index.html. No dependencies: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./load-model.cjs');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const crop = id => F.CROPS.find(c => c.id === id);
const synthClim = (dT = 0) => F.shiftClim(F.climatology(F.parsePower(F.synthPower(37.87)), 2016, 2025), dT, 0);
// Hand-built climatology so each test controls the months it cares about.
const flatClim = over => Object.assign({
  T: Array(12).fill(15), TX: Array(12).fill(25), TN: Array(12).fill(5),
  R: Array(12).fill(40), W: Array(12).fill(0.5), SW: Array(12).fill(5), y0: 2016, y1: 2025,
}, over);
const SOIL = { ph: 7.2, clay: 25 };

test('trap: zero outside, one on the plateau, linear between, neutral when unknown', () => {
  const p = [0, 10, 20, 30];
  assert.equal(F.trap(-1, p), 0);
  assert.equal(F.trap(0, p), 0);
  assert.equal(F.trap(30, p), 0);
  assert.equal(F.trap(10, p), 1);
  assert.equal(F.trap(20, p), 1);
  near(F.trap(5, p), 0.5);
  near(F.trap(25, p), 0.5);
  assert.equal(F.trap(null, p), 1);
  assert.equal(F.trap(NaN, p), 1);
});

test('ramp: clamps to 0..1 in either direction', () => {
  assert.equal(F.ramp(-5, 0, 10), 0);
  assert.equal(F.ramp(15, 0, 10), 1);
  near(F.ramp(5, 0, 10), 0.5);
  near(F.ramp(38, 41, 35), 0.5); // falling ramp (heat): 41 -> 0, 35 -> 1
  assert.equal(F.ramp(null, 0, 10), 1);
});

test('seasonStats: heat ignores the harvest month', () => {
  const TX = Array(12).fill(20); TX[4] = 28; TX[5] = 40; // May grain fill 28 °C, June harvest 40 °C
  const st = F.seasonStats(crop('bugday'), flatClim({ TX }));
  assert.equal(st.TX, 28);
  const s = F.suit(crop('bugday'), flatClim({ TX }), SOIL, false);
  assert.equal(s.f.heat, 1, 'a hot harvest month must not scorch mature wheat');
});

test('seasonStats: a hot growing month still counts', () => {
  const TX = Array(12).fill(20); TX[4] = 36; // May
  assert.equal(F.seasonStats(crop('bugday'), flatClim({ TX })).TX, 36);
  assert.ok(F.suit(crop('bugday'), flatClim({ TX }), SOIL, false).f.heat < 1);
});

test('suit: more rain never lowers the water factor (rainfed)', () => {
  const base = synthClim();
  for (const c of F.CROPS.filter(c => c.irr === 'no')) {
    let prev = -1;
    for (const k of [0.25, 0.5, 1, 1.5]) {
      const w = F.suit(c, Object.assign({}, base, { R: base.R.map(v => v * k) }), SOIL, false).f.water;
      if (k <= 1) assert.ok(w >= prev - 1e-9, `${c.id}: water fell from ${prev} to ${w} at rain x${k}`);
      prev = w;
    }
  }
});

test('suit: irrigation removes the water limit for crops that can be irrigated', () => {
  const dry = Object.assign({}, synthClim(), { R: Array(12).fill(0), W: Array(12).fill(0.2) });
  for (const c of F.CROPS.filter(c => c.irr !== 'no')) assert.equal(F.suit(c, dry, SOIL, true).f.water, 1, c.id);
});

test('suit: higher salinity or lime never raises a score', () => {
  const clim = synthClim();
  for (const c of F.CROPS) {
    let prevS = Infinity, prevL = Infinity;
    for (const v of [0, 2, 4, 6, 8, 12, 16]) {
      const s = F.suit(c, clim, Object.assign({ ec: v }, SOIL), true).S;
      const l = F.suit(c, clim, Object.assign({ lime: v * 3 }, SOIL), true).S;
      assert.ok(s <= prevS, `${c.id}: EC ${v} raised score ${prevS} -> ${s}`);
      assert.ok(l <= prevL, `${c.id}: lime ${v * 3}% raised score ${prevL} -> ${l}`);
      prevS = s; prevL = l;
    }
  }
});

test('suit: salinity follows the published thresholds', () => {
  const clim = synthClim();
  assert.equal(F.suit(crop('arpa'), clim, Object.assign({ ec: 8 }, SOIL), true).f.sal, 1, 'barley threshold 8 dS/m');
  near(F.suit(crop('misir'), clim, Object.assign({ ec: 3.7 }, SOIL), true).f.sal, 1 - 12 * 2 / 100, 1e-9); // 1.7 + 2 dS/m, 12 %/dS/m
});

test('suit: a warmer scenario never raises frost risk', () => {
  for (const c of F.CROPS) assert.ok(F.suit(c, synthClim(2), SOIL, false).f.cold >= F.suit(c, synthClim(0), SOIL, false).f.cold - 1e-9, c.id);
});

test('suit: missing soil gives a range that contains the known-soil score', () => {
  const clim = synthClim();
  for (const c of F.CROPS) {
    const part = F.suit(c, clim, { ph: null, clay: null }, false), full = F.suit(c, clim, SOIL, false);
    assert.ok(part.lower <= full.S && full.S <= part.upper, `${c.id}: ${part.lower}..${part.upper} vs ${full.S}`);
    assert.ok(part.unknown.includes('ph'));
  }
});

const plan = over => {
  const suits = Object.fromEntries(F.CROPS.map(c => [c.id, F.suit(c, synthClim(), SOIL, false)]));
  return F.plan(Object.assign({ suits, years: 3, prev: 'bugday', irrigation: false, pri: { water: .5, soil: .5, income: .5 } }, over));
};

test('plan: every option has the requested number of years and a finite score', () => {
  for (const years of [2, 3, 4]) {
    const P = plan({ years });
    assert.ok(P.top.length >= 1 && P.top.length <= 3);
    for (const p of P.top) { assert.equal(p.seq.length, years); assert.ok(Number.isFinite(p.total)); }
  }
});

test('plan: a crop fixed for year 1 is respected in every option', () => {
  for (const p of plan({ next: 'nohut' }).top) assert.equal(p.seq[0].id, 'nohut');
});

test('plan: the top plan never repeats a crop in consecutive years', () => {
  for (const prev of ['bugday', 'nohut', 'arpa', '']) {
    const full = [F.CROPS.find(c => c.id === prev), ...plan({ prev: prev || null }).top[0].seq].filter(Boolean);
    for (let i = 1; i < full.length; i++) if (full[i].id !== 'nadas') assert.notEqual(full[i].id, full[i - 1].id, `prev ${prev}`);
  }
});

test('plan: options are sorted best first', () => {
  const t = plan({}).top.map(p => p.total);
  for (let i = 1; i < t.length; i++) assert.ok(t[i - 1] >= t[i]);
});

test('plan: still answers when almost every crop is ruled out', () => {
  const suits = Object.fromEntries(F.CROPS.map(c => [c.id, Object.assign(F.suit(c, synthClim(), SOIL, false), { S: c.id === 'arpa' ? 70 : 5 })]));
  const P = F.plan({ suits, years: 3, prev: 'bugday', irrigation: false, pri: { water: .5, soil: .5, income: .5 } });
  assert.ok(P.top.length >= 1);
  for (const p of P.top) for (const c of p.seq) assert.ok(c.id === 'arpa' || c.id === 'nadas', c.id);
});

test('applyDailyMeans: replaces extremes with the daily mean', () => {
  const P = { T2M_MAX: { 202407: 40 }, T2M_MIN: { 202407: 10 } }, D = { T2M_MAX: {}, T2M_MIN: {} };
  for (let d = 1; d <= 31; d++) { const k = `202407${String(d).padStart(2, '0')}`; D.T2M_MAX[k] = 30 + (d % 3); D.T2M_MIN[k] = 18; }
  assert.equal(F.applyDailyMeans(P, D), true);
  near(P.T2M_MAX[202407], 31, 0.05);
  assert.equal(P.T2M_MIN[202407], 18);
});

test('applyDailyMeans: ignores -999 and keeps months with fewer than 20 days', () => {
  const P = { T2M_MAX: { 202401: 15, 202402: 16 }, T2M_MIN: { 202401: -12, 202402: -10 } }, D = { T2M_MAX: {}, T2M_MIN: {} };
  for (let d = 1; d <= 31; d++) { const k = `202401${String(d).padStart(2, '0')}`; D.T2M_MAX[k] = d <= 5 ? -999 : 8; D.T2M_MIN[k] = -1; }
  for (let d = 1; d <= 19; d++) { const k = `202402${String(d).padStart(2, '0')}`; D.T2M_MAX[k] = 9; D.T2M_MIN[k] = 0; }
  F.applyDailyMeans(P, D);
  assert.equal(P.T2M_MAX[202401], 8, '-999 days are skipped');
  assert.equal(P.T2M_MAX[202402], 16, 'a month with 19 days keeps its value');
  assert.equal(F.applyDailyMeans({ T2M_MAX: {}, T2M_MIN: {} }, {}), false);
});

test('ndviQA: drops cloudy/snow/fill readings, keeps unflagged ones, sorts by date', () => {
  const out = F.ndviQA([['2024-03-01', 0.5, 0], ['2024-01-01', 0.4, 3], ['2024-02-01', 0.45, 1], ['2024-04-01', 0.6, null], ['2024-05-01', 0.2, 2], ['2024-06-01', 0.1, -1]]);
  assert.deepEqual(out.map(o => o.d), ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01', '2024-05-01', '2024-06-01']);
  assert.deepEqual(out.map(o => o.v), [null, 0.45, 0.5, 0.6, null, null]);
  assert.equal(out.dropped, 3);
});

// ---------- climate pattern statistics ----------
test('normCdf / normInv: known values and round trip', () => {
  near(F.normCdf(0), 0.5, 1e-7);
  near(F.normCdf(1.959964), 0.975, 1e-6);
  near(F.normInv(0.975), 1.959964, 1e-5);
  // normCdf is accurate to ~1.5e-7 absolute, so deep in the tail the round trip loosens a little.
  for (const z of [-3, -1.5, -0.2, 0.7, 2.4]) near(F.normInv(F.normCdf(z)), z, 1e-4);
});

test('gammaP: matches closed forms', () => {
  for (const x of [0.1, 1, 3, 8]) near(F.gammaP(1, x), 1 - Math.exp(-x), 1e-9);                 // exponential
  for (const x of [0.5, 2, 6]) near(F.gammaP(2, x), 1 - Math.exp(-x) * (1 + x), 1e-9);        // Erlang k=2
});

test('mannKendall: perfect trend, no trend, Sen slope, ties', () => {
  const xs = Array.from({ length: 12 }, (_, i) => 2001 + i);
  const up = F.mannKendall(xs, xs.map(x => 2 * x + 1));
  assert.equal(up.S, 66); assert.equal(up.tau, 1); near(up.sen, 2); assert.ok(up.p < 0.001);
  const down = F.mannKendall(xs, xs.map(x => -x));
  assert.equal(down.S, -66); assert.ok(down.p < 0.001);
  const flat = F.mannKendall(xs, xs.map(() => 5));
  assert.equal(flat.S, 0); near(flat.p, 1, 1e-6); assert.equal(flat.sen, 0);
  // Alternating series: no trend.
  assert.ok(F.mannKendall(xs, xs.map((x, i) => i % 2 ? 10 : 0)).p > 0.5);
  // Missing values are skipped; fewer than 8 points gives no result.
  assert.equal(F.mannKendall(xs.slice(0, 7), xs.slice(0, 7)), null);
  assert.equal(F.mannKendall(xs, xs.map((x, i) => i < 5 ? null : x)), null);
});

test('mannKendall: textbook example (n=10, S=+27 with no ties)', () => {
  // Hand-checked: S = 27, Var(S) = 10*9*25/18 = 125, z = 26/sqrt(125) = 2.3255, p = 0.0200.
  const ys = [1, 3, 2, 5, 4, 6, 8, 7, 10, 9].map((v, i) => i === 0 ? 1 : v);
  const r = F.mannKendall(ys.map((_, i) => i), [3, 1, 4, 2, 6, 5, 9, 7, 8, 10]);
  let S = 0; const v = [3, 1, 4, 2, 6, 5, 9, 7, 8, 10];
  for (let a = 0; a < 9; a++) for (let b = a + 1; b < 10; b++) S += Math.sign(v[b] - v[a]);
  assert.equal(r.S, S);
  near(r.z, (S - 1) / Math.sqrt(125), 1e-12);
  near(r.p, 2 * (1 - F.normCdf(Math.abs(r.z))), 1e-12);
});

test('spi: centred on zero, increases with rainfall, flags the driest year', () => {
  const rain = [420, 380, 510, 300, 450, 470, 360, 600, 410, 390, 440, 520, 330, 480, 400];
  const z = F.spi(rain);
  near(z.reduce((s, v) => s + v, 0) / z.length, 0, 0.15);
  const order = rain.map((r, i) => [r, z[i]]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < order.length; i++) assert.ok(order[i][1] > order[i - 1][1]);
  assert.ok(z[rain.indexOf(300)] < -1, 'driest year should be at least moderately dry');
  assert.ok(z[rain.indexOf(600)] > 1, 'wettest year should be at least moderately wet');
});

test('waterYearRain: October-September totals', () => {
  const d = F.parsePower(F.synthPower(37.87));
  const wy = F.waterYearRain(d);
  assert.equal(wy[0][0], d._years[1]);
  const y = wy[0][0], P = d.PRECTOTCORR;
  let tot = 0; for (let m = 9; m < 12; m++) tot += P[y - 1][m] * F.MD[m]; for (let m = 0; m < 9; m++) tot += P[y][m] * F.MD[m];
  near(wy[0][1], tot, 1e-9);
});

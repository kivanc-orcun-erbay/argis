// Regional sanity check on the real NASA snapshots embedded in index.html.
// Prints the model's plan for each preset region (rainfed and irrigated) so it can be
// compared with local practice by an agronomist. No dependencies: node tests/regions.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const snap = JSON.parse(html.match(/<script id="snapData" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const src = html.slice(html.indexOf('var FS = (function'), html.indexOf('})();', html.indexOf('var FS = (function')) + 5);
const ctx = {}; vm.runInNewContext(src, ctx); const F = ctx.FS;

const toPower = sn => {
  const p = {};
  for (const [k, arr] of Object.entries(sn.power.p)) { p[k] = {}; arr.forEach((v, i) => { p[k][`${sn.power.y0 + Math.floor(i / 12)}${String(i % 12 + 1).padStart(2, '0')}`] = v == null ? -999 : v; }); }
  return { properties: { parameter: p } };
};

const keys = Object.keys(snap);
assert(keys.length >= 4, 'expected 4 regional snapshots');
const rows = [];
for (const k of keys) {
  const sn = snap[k], d = F.parsePower(toPower(sn));
  const ys = d._years.filter(y => d.T2M[y] && d.T2M[y].every(v => v != null));
  const last = ys[ys.length - 1], first = ys[0];
  const rec = F.climatology(d, Math.max(last - 9, first), last), base = F.climatology(d, first, first + 9);
  const soil = sn.soil && sn.soil.ph != null ? { ph: sn.soil.ph, clay: sn.soil.clay } : { ph: null, clay: null };
  const rainR = rec.R.reduce((s, v) => s + (v || 0), 0), rainB = base.R.reduce((s, v) => s + (v || 0), 0);
  for (const irr of [false, true]) {
    const suits = Object.fromEntries(F.CROPS.map(c => [c.id, F.suit(c, rec, soil, irr)]));
    const P = F.plan({ suits, years: 3, prev: 'bugday', irrigation: irr, pri: { water: .5, soil: .5, income: .5 } });
    assert(P.top.length > 0, `${k} ${irr ? 'sulu' : 'kıraç'}: no plan`);
    rows.push({ bölge: k, su: irr ? 'sulu' : 'kıraç', yağış: `${Math.round(rainB)}→${Math.round(rainR)} mm`, pH: soil.ph, kil: soil.clay, ndvi: (sn.ndvi || []).length, plan: P.top[0].seq.map(c => c.n).join(' → ') });
  }
}
console.table(rows);

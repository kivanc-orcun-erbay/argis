// Model speed: how long the scoring and plan search take, per region, in Node.
//   node tests/bench/model.cjs [runs]
const { performance } = require('node:perf_hooks');
const F = require('../load-model.cjs');

const RUNS = +(process.argv[2] || 50);
const PRI = { water: .5, soil: .5, income: .5 };
const stats = xs => { const s = xs.slice().sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { median: q(.5), p95: q(.95), max: s[s.length - 1] }; };
const fmt = v => v < 1 ? `${(v * 1000).toFixed(0)} µs` : `${v.toFixed(2)} ms`;
const time = (fn, n = RUNS) => { for (let i = 0; i < 5; i++) fn(); const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); fn(); t.push(performance.now() - a); } return stats(t); };

const snap = F.snapshots();
const rows = [];
for (const [k, sn] of Object.entries(snap)) {
  const prep = () => {
    const d = F.parsePower(F.snapPower(sn));
    const ys = d._years.filter(y => d.T2M[y] && d.T2M[y].every(v => v != null));
    const last = ys[ys.length - 1], first = ys[0];
    return { d, base: F.climatology(d, first, first + 9), rec: F.climatology(d, last - 9, last), an: F.annual(d) };
  };
  const { rec } = prep();
  const soil = { ph: sn.soil.ph, clay: sn.soil.clay };
  const suits = () => Object.fromEntries(F.CROPS.map(c => [c.id, F.suit(c, rec, soil, true)]));
  const S = suits();
  const r = {
    region: k,
    'parse + climate (25 y)': time(prep),
    'score 13 crops': time(suits),
    'plan, 2 y': time(() => F.plan({ suits: S, years: 2, prev: 'bugday', irrigation: true, pri: PRI })),
    'plan, 3 y': time(() => F.plan({ suits: S, years: 3, prev: 'bugday', irrigation: true, pri: PRI })),
    'plan, 4 y': time(() => F.plan({ suits: S, years: 4, prev: 'bugday', irrigation: true, pri: PRI }), Math.min(RUNS, 10)),
    // What the page does on every change: 3 climates x 13 crops + 2 plan searches (3 years).
    'full recompute (3 y)': time(() => { const p = prep(); const sc = {}; for (const cl of [p.base, p.rec, p.rec]) for (const c of F.CROPS) sc[c.id] = F.suit(c, cl, soil, true); F.plan({ suits: sc, years: 3, prev: 'bugday', irrigation: true, pri: PRI }); F.plan({ suits: sc, years: 3, prev: 'bugday', irrigation: true, pri: PRI }); }),
  };
  rows.push(r);
}

const cols = Object.keys(rows[0]).filter(c => c !== 'region');
console.log(`Node ${process.version}, ${RUNS} runs (4-year plan: ${Math.min(RUNS, 10)}), median / p95\n`);
console.log('| Region | ' + cols.join(' | ') + ' |');
console.log('|---|' + cols.map(() => '---:').join('|') + '|');
for (const r of rows) console.log(`| ${r.region} | ` + cols.map(c => `${fmt(r[c].median)} / ${fmt(r[c].p95)}`).join(' | ') + ' |');

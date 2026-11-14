// Regional checks on the real NASA / SoilGrids data embedded in index.html.
//
//   node tests/regions.cjs            run checks, print the table
//   node tests/regions.cjs --update   accept the current results as the new record
//
// Two kinds of check:
// 1. Plausibility rules an agronomist would agree with (would have caught the
//    "three years of fallow in Harran" and "cotton ruled out" bugs).
// 2. A saved record (tests/regions.golden.json) of every region's plan and crop
//    scores. Any change fails until someone looks at it and runs --update, so model
//    or data changes never shift recommendations silently.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const F = require('./load-model.cjs');

const GOLDEN = path.join(__dirname, 'regions.golden.json');
const PRI = { water: .5, soil: .5, income: .5 };
const snap = F.snapshots();
assert.ok(Object.keys(snap).length >= 4, 'expected 4 regional snapshots');

const results = {}, rows = [], failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

for (const [k, sn] of Object.entries(snap)) {
  const d = F.parsePower(F.snapPower(sn));
  const ys = d._years.filter(y => d.T2M[y] && d.T2M[y].every(v => v != null));
  const last = ys[ys.length - 1], first = ys[0];
  const rec = F.climatology(d, Math.max(last - 9, first), last);
  const soil = sn.soil && sn.soil.ph != null ? { ph: sn.soil.ph, clay: sn.soil.clay } : { ph: null, clay: null };
  const nd = F.ndviSummary(F.ndviQA(sn.ndvi || []));
  const ndviWeak = nd.slope != null && nd.slope < -0.01 ? 1 : 0;
  for (const irr of [false, true]) {
    const suits = Object.fromEntries(F.CROPS.map(c => [c.id, F.suit(c, rec, soil, irr)]));
    const P = F.plan({ suits, years: 3, prev: 'bugday', irrigation: irr, pri: PRI, ndviWeak });
    const top = P.top[0], key = `${k}/${irr ? 'sulu' : 'kıraç'}`;
    check(!!top, `${key}: no plan`);
    if (!top) continue;
    const ids = top.seq.map(c => c.id);
    // 4-year plans use the pruned search (see FS.plan); record them so pruning changes are caught.
    const P4 = F.plan({ suits, years: 4, prev: 'bugday', irrigation: irr, pri: PRI, ndviWeak });
    results[key] = { plan: ids, score: Math.round(top.total), plan4: P4.top.map(p => p.seq.map(c => c.id).join('-')), suit: Object.fromEntries(F.CROPS.map(c => [c.id, suits[c.id].S])) };
    rows.push({ bölge: k, su: irr ? 'sulu' : 'kıraç', pH: soil.ph, ndvi: (sn.ndvi || []).length, plan: top.seq.map(c => c.n).join(' → '), puan: Math.round(top.total) });

    // --- plausibility rules ---
    const fallow = ids.filter(id => id === 'nadas').length;
    check(fallow <= (irr ? 1 : 2), `${key}: ${fallow} fallow years in a 3-year plan`);
    if (!irr) for (const c of top.seq) check(c.irr !== 'yes', `${key}: dry-farming plan contains ${c.id}, which needs irrigation`);
    check(F.CROPS.filter(c => suits[c.id].S >= 60).length >= 2, `${key}: fewer than 2 crops suitable (>= 60) on a cropland point`);
  }
}

// Region-specific expectations (well-established practice; see docs/DEGERLENDIRME.md).
const S = (key, id) => results[key] && results[key].suit[id];
check(S('harran/sulu', 'pamuk') >= 60, `harran/sulu: cotton suitability ${S('harran/sulu', 'pamuk')} < 60`);
check(S('cukurova/sulu', 'pamuk') >= 60, `cukurova/sulu: cotton suitability ${S('cukurova/sulu', 'pamuk')} < 60`);
check(S('konya/kıraç', 'bugday') >= 60, `konya/kıraç: wheat suitability ${S('konya/kıraç', 'bugday')} < 60`);
check(S('trakya/kıraç', 'bugday') >= 60, `trakya/kıraç: wheat suitability ${S('trakya/kıraç', 'bugday')} < 60`);

console.table(rows);

// --- saved record ---
if (process.argv.includes('--update')) {
  fs.writeFileSync(GOLDEN, JSON.stringify(results, null, 1) + '\n');
  console.log('record updated:', path.relative(process.cwd(), GOLDEN));
} else if (!fs.existsSync(GOLDEN)) {
  failures.push('no saved record yet: run node tests/regions.cjs --update');
} else {
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  for (const key of new Set([...Object.keys(want), ...Object.keys(results)])) {
    const a = want[key], b = results[key];
    if (!a || !b) { failures.push(`${key}: ${a ? 'missing now' : 'not in saved record'}`); continue; }
    if (a.plan.join() !== b.plan.join()) failures.push(`${key}: plan changed ${a.plan.join('→')} => ${b.plan.join('→')}`);
    if (a.score !== b.score) failures.push(`${key}: plan score changed ${a.score} => ${b.score}`);
    if (a.plan4 && (a.plan4 || []).join() !== (b.plan4 || []).join()) failures.push(`${key}: 4-year options changed ${a.plan4.join(' | ')} => ${b.plan4.join(' | ')}`);
    for (const id of Object.keys(a.suit)) if (a.suit[id] !== b.suit[id]) failures.push(`${key}: ${id} suitability changed ${a.suit[id]} => ${b.suit[id]}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} regional check(s) failed:\n  - ` + failures.join('\n  - '));
  console.error('\nIf a change is intended, review it and run: node tests/regions.cjs --update');
  process.exit(1);
}
console.log('regional checks ok');

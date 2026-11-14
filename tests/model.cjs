const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)];
// JavaScript blocks must compile; JSON data blocks (type="application/json") must parse.
for (const [, attrs = '', body] of blocks) {
  if (!body.trim()) continue;
  if (/type="application\/json"/.test(attrs)) JSON.parse(body); else new vm.Script(body);
}
const source = html.slice(html.indexOf('var FS = (function'), html.indexOf('})();', html.indexOf('var FS = (function')) + 5);
const context = {};
vm.runInNewContext(source, context);
const F = context.FS;
const data = F.parsePower(F.synthPower(37.8746));
const climate = F.climatology(data, 2016, 2025);
for (const crop of F.CROPS) {
  const full = F.suit(crop, climate, {ph: 7.9, clay: 32}, false);
  const partial = F.suit(crop, climate, {ph: null, clay: null}, false);
  assert.equal(full.lower, full.upper);
  assert.equal(full.S, full.lower);
  assert(partial.unknown.includes('ph'));
  assert.equal(partial.f.ph, null);
  assert(partial.lower <= full.S && full.S <= partial.upper);
  assert(Number.isFinite(partial.S));
}
const scenarios = [ ['Mevcut örnek iklim', climate], ['+2 °C / yağış −%20', F.shiftClim(climate, 2, -20)] ];
const report = [];
for (const [name, c] of scenarios) {
  const suits = Object.fromEntries(F.CROPS.map(crop => [crop.id, F.suit(crop,c,{ph:7.9,clay:32},false)]));
  const plan = F.plan({suits, years:3, prev:'bugday', irrigation:false, pri:{water:.5,soil:.5,income:.5}});
  assert(plan.top.length > 0);
  assert(plan.top.every(p => Number.isFinite(p.total)));
  report.push({scenario:name, plan:plan.top[0].seq.map(c=>c.n).join(' → '), score:Math.round(plan.top[0].total), wheat:suits.bugday.S});
}
console.log('PASS: inline JavaScript syntax, missing-soil bounds, complete-data scores, two scenario plans.');
console.log(JSON.stringify(report, null, 2));

// Soil-test factors: optional, never treated as missing data, and they move the score the right way.
{
  const soil = { ph: 7.9, clay: 32 };
  const base = Object.fromEntries(F.CROPS.map(c => [c.id, F.suit(c, climate, soil, true)]));
  const salty = Object.fromEntries(F.CROPS.map(c => [c.id, F.suit(c, climate, { ...soil, ec: 8 }, true)]));
  const limey = Object.fromEntries(F.CROPS.map(c => [c.id, F.suit(c, climate, { ...soil, lime: 30 }, true)]));
  for (const c of F.CROPS) {
    assert(!('sal' in base[c.id].f) && !('lime' in base[c.id].f), `${c.id}: lab factors must be absent when not entered`);
    assert(!salty[c.id].unknown.includes('sal'));
    assert(salty[c.id].S <= base[c.id].S, `${c.id}: salinity must not raise the score`);
    assert(limey[c.id].S <= base[c.id].S, `${c.id}: lime must not raise the score`);
  }
  assert(salty.misir.f.sal < salty.arpa.f.sal, 'maize must be hurt more by salinity than barley');
  assert.equal(salty.arpa.f.sal, 1, 'barley threshold is 8 dS/m');
  assert(limey.fasulye.f.lime < 1 && !('lime' in limey.bugday.f), 'lime affects sensitive crops only');
  console.log('soil-test factors ok');
}

const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(Boolean);
for (const script of scripts) new vm.Script(script);
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

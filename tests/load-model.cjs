// Loads the FS model block (and the embedded regional data) out of index.html for Node tests.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// FS_HTML lets a test run against another copy of the page (e.g. an older version).
const html = fs.readFileSync(process.env.FS_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('var FS = (function');
const src = html.slice(start, html.indexOf('})();', start) + 5);
const ctx = {};
vm.runInNewContext(src, ctx);

module.exports = ctx.FS;
module.exports.html = html;
module.exports.snapshots = () => JSON.parse(html.match(/<script id="snapData" type="application\/json">([\s\S]*?)<\/script>/)[1]);
// Same conversion the page uses: compact saved data -> POWER API shape.
module.exports.snapPower = sn => {
  const p = {};
  for (const [k, arr] of Object.entries(sn.power.p)) {
    p[k] = {};
    arr.forEach((v, i) => { p[k][`${sn.power.y0 + Math.floor(i / 12)}${String(i % 12 + 1).padStart(2, '0')}`] = v == null ? -999 : v; });
  }
  return { properties: { parameter: p } };
};

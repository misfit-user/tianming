'use strict';
const fs = require('fs'), path = require('path');
const WEB = path.resolve(__dirname, '..');
const ASSETS = Object.freeze({
  'smoke-audio-bgm.js': ['tianming-hegui', 'gucheng-junqi', 'hanwei-fengyun', 'changhe-zhangu', 'yunkai-wanli'].map(name => 'assets/audio/bgm/' + name + '.mp3'),
  'smoke-mapeditor-ui.js': ['assets/fonts/ZCOOLXiaoWei-Regular.ttf', 'assets/fonts/MaShanZheng-Regular.ttf']
});
const emitted = new Set();
function assetExists(name, relative, io = fs) {
  if (io.existsSync(path.join(WEB, relative))) return true;
  if (!(ASSETS[name] || []).includes(relative)) throw new Error('Unapproved missing asset: ' + relative);
  const key = name + '|' + relative;
  if (!emitted.has(key)) console.log('TM_SMOKE_WAIVER ' + JSON.stringify({ code: 'optional-asset-absent', path: relative }));
  emitted.add(key);
  return true; // only the presence assertion; the remainder of the smoke still executes
}
function discover(dir = __dirname) { return fs.readdirSync(dir).filter(name => /^smoke-.*\.js$/.test(name)).sort(); }
function validateReport(report, expected, io = fs) {
  function demand(value, code) { if (!value) throw new Error('smoke-evidence-' + code); }
  demand(expected.runnerExit === 0, 'runner-failed');
  demand(report && report.version === 2 && report.complete === true, 'incomplete');
  demand(report.runId === expected.runId && report.head === expected.head, 'stale');
  demand(Array.isArray(expected.tests) && expected.tests.length > 0, 'empty-discovery');
  demand(JSON.stringify(report.expected) === JSON.stringify(expected.tests), 'discovery-mismatch');
  demand(Array.isArray(report.results) && report.results.length === expected.tests.length, 'missing-results');
  demand(Array.isArray(report.skipped) && report.skipped.length === 0, 'skipped-tests');
  const seen = new Set(); let pass = 0, fail = 0, waived = 0, waivedChecks = 0;
  for (const row of report.results) {
    demand(row && expected.tests.includes(row.name) && !seen.has(row.name), 'duplicate-or-unknown'); seen.add(row.name);
    const records = row.waivers;
    demand(Array.isArray(records), 'waiver-schema');
    const paths = new Set();
    for (const waiver of records) {
      demand(waiver && waiver.code === 'optional-asset-absent' && (ASSETS[row.name] || []).includes(waiver.path)
        && !io.existsSync(path.join(WEB, waiver.path)) && !paths.has(waiver.path), 'invalid-waiver');
      paths.add(waiver.path);
    }
    if (row.pass !== true || row.exit !== 0 || row.timedOut !== false || row.suspect !== false) fail++;
    else if (records.length) { waived++; waivedChecks += records.length; } else pass++;
  }
  demand(fail === 0, 'test-failed');
  return { pass, fail, skip: 0, waived, waivedChecks, total: seen.size };
}
module.exports = { assetExists, discover, validateReport };

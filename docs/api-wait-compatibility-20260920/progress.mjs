import fs from 'node:fs';
const dir = 'docs/api-wait-compatibility-20260920';
for (const name of ['resumed-full-tests.json', 'resumed-run-status.json', 'verification.json']) {
  if (!fs.existsSync(dir + '/' + name)) continue;
  const row = JSON.parse(fs.readFileSync(dir + '/' + name, 'utf8'));
  console.log(name, JSON.stringify({ complete: row.complete, ok: row.ok, summary: row.summary || row.full, changedDuringRun: row.changedDuringRun, changedAfterTests: row.changedAfterTests }));
  for (const r of row.results || []) if (r.pass === false) console.log('FAIL', r.name, String(r.output).slice(-1000));
  if (name === 'verification.json') console.log(JSON.stringify({ files: row.files.length, quality: row.qualityChecks, architecture: row.architecture, browser: row.browser, scopedDiff: row.scopedDiff }));
}

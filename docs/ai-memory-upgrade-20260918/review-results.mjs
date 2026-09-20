import fs from 'node:fs';
const file = process.argv[2] || 'docs/ai-memory-upgrade-20260918/full-smokes.json';
if (!fs.existsSync(file)) { console.log('Report is not yet available.'); process.exit(0); }
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log('COMPLETE', report.complete, 'SUMMARY', JSON.stringify(report.summary));
const failed = report.results.filter(row => row.pass !== true);
console.log('FAILURES', JSON.stringify(failed.map(row => ({ name: row.name, exit: row.exit, timedOut: row.timedOut }))));
for (const row of failed) console.log('DETAIL', row.name, String(row.output || '').slice(-1300));
const memory = report.results.filter(row => /memory|context|semantic/.test(row.name || ''));
console.log('MEMORY', JSON.stringify({ selected: memory.length, nonPass: memory.filter(row => row.pass !== true).map(row => row.name) }));

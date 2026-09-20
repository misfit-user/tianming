import fs from 'node:fs';
for (const name of process.argv.slice(2)) {
  const path = 'docs/ai-memory-upgrade-r2-20260918/' + name;
  if (!fs.existsSync(path)) { console.log(name + ': report unavailable'); continue; }
  const report = JSON.parse(fs.readFileSync(path, 'utf8'));
  console.log(name, JSON.stringify(report.summary));
  for (const row of report.results || []) if (row.pass !== true) console.log(row.name, String(row.output || '').slice(-1800));
}

import fs from 'node:fs';
for (const name of process.argv.slice(2)) {
  const file = 'docs/endturn-reliability-20260918/' + name;
  if (!fs.existsSync(file)) { console.log(name, 'not finished'); continue; }
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(name, JSON.stringify(r.summary));
  for (const row of r.results || []) if (!row.pass) console.log(row.name, String(row.output || '').slice(-1900));
}

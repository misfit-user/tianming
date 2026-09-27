import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { parse } = createRequire(path.resolve('package.json'))('acorn');
const dir = 'docs/api-wait-compatibility-20260920';
const base = JSON.parse(fs.readFileSync(dir + '/baseline.json', 'utf8'));
function functions(source) {
  const found = new Map();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id) found.set(node.id.name, source.slice(node.start, node.end).replace(/\r\n/g, '\n'));
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  }
  visit(parse(source, { ecmaVersion: 'latest' })); return found;
}
for (const file of ['web/tm-endturn-ai.js', 'web/tm-endturn-agent-mode.js', 'web/tm-memory-agent-tools.js', 'web/tm-ai-infra.js', 'web/tm-utils.js']) {
  const before = functions(fs.readFileSync(path.join(base.backup, file), 'utf8'));
  const after = functions(fs.readFileSync(file, 'utf8'));
  const changed = [...after].filter(([name, body]) => before.get(name) !== body).map(([name]) => name);
  console.log(file, JSON.stringify({ total: after.size, changed, unchanged: [...before].filter(([name, body]) => after.get(name) === body).map(([name]) => name) }));
}

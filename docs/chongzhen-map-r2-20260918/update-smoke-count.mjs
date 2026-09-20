// Keep the existing runtime smoke tied to this delivered geometry, without deleting assertions.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]),file=path.join(root,'web/scripts/smoke-tianqi-map-runtime.js');
const before=fs.readFileSync(file),text=before.toString('utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal((text.match(/\b284\b/g)||[]).length,6,'Smoke count changed concurrently');
const after=Buffer.from(text.replace(/\b284\b/g,'296'));
fs.writeFileSync(path.join(w,'runtime-before/smoke-tianqi-map-runtime.js'),before);
assert.equal(hash(fs.readFileSync(file)),hash(before));fs.writeFileSync(file,after);
assert.equal(hash(fs.readFileSync(file)),hash(after));
fs.writeFileSync(path.join(w,'smoke-update.json'),JSON.stringify({file:'web/scripts/smoke-tianqi-map-runtime.js',before:hash(before),after:hash(after),reason:'296 refined cells under 43 province groups; no assertion removed'},null,2));
console.log('Runtime smoke count updated to 296; all original checks retained.');

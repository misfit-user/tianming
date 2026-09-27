// Retain the existing mutation/isolation assertions, using the newly split Ningyuan leaf.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const file=path.join(root,'web/scripts/smoke-tianqi-map-runtime.js');const raw=fs.readFileSync(file),hash=b=>crypto.createHash('sha256').update(b).digest('hex');let text=raw.toString('utf8');
assert.ok(text.includes("findRegion('ming-28')"));assert.ok(text.includes("target.name.includes('辽东')"));
text=text.replaceAll("'ming-28'","'ming-28-p02'").replace("target.name.includes('辽东')","target.name === '宁远城'").replace('target region ming-28 missing','target region ming-28-p02 missing');
fs.writeFileSync(path.join(work,'smoke-before-leaf-target.js'),raw);assert.equal(hash(fs.readFileSync(file)),hash(raw));fs.writeFileSync(file,text);
fs.writeFileSync(path.join(work,'smoke-refinement.json'),JSON.stringify({file:'web/scripts/smoke-tianqi-map-runtime.js',before:hash(raw),after:hash(text),reason:'The old Guanning region is now a province group; test the actual Ningyuan leaf. No assertions removed.'},null,2));
console.log('Smoke target updated to the real leaf; all assertions retained.');

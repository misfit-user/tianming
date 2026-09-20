import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),file=path.join(root,'web/scripts/smoke-tianqi-map-runtime.js');
const before=fs.readFileSync(file);let text=before.toString('utf8');const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function one(a,b){assert.equal(text.split(a).length,2,a);text=text.replace(a,b);}
one("  assert(sc.map.regions.length === 43, `expected 43 land regions, got ${sc.map.regions.length}`);",`  assert(sc.map.regions.length === 284, \`expected 284 prefecture/retained regional units, got \${sc.map.regions.length}\`);
  assert(Array.isArray(sc.map.circuitRegistry) && sc.map.circuitRegistry.length === 43, '43 inherited province groups required');
  const memberships = sc.map.circuitRegistry.flatMap(p => p.memberRegionIds || []);
  assert(memberships.length === 284 && new Set(memberships).size === 284, 'province membership must cover each cell exactly once');
  assert(sc.map.regions.every(r => memberships.includes(r.id)), 'province registry contains dangling cells');`);
one("ctx.GM.mapData.regions.length === 43, 'GM.mapData did not receive live map'","ctx.GM.mapData.regions.length === 284, 'GM.mapData did not receive live map'");
one("/地图总览/.test(aiContext) && /43/.test(aiContext)","/地图总览/.test(aiContext) && /284/.test(aiContext)");
if(before.toString('utf8').includes('\r\n'))text=text.replace(/\r?\n/g,'\r\n');
fs.mkdirSync(path.join(work,'runtime-before'),{recursive:true});fs.writeFileSync(path.join(work,'runtime-before/smoke-tianqi-map-runtime.js'),before);assert.equal(hash(fs.readFileSync(file)),hash(before));
fs.writeFileSync(file,text);fs.writeFileSync(path.join(work,'smoke-update.json'),JSON.stringify({file:'web/scripts/smoke-tianqi-map-runtime.js',before:hash(before),after:hash(text),reason:'284 leaf units under the existing 43 parent outlines, retaining original mutation and template-isolation assertions'},null,2));

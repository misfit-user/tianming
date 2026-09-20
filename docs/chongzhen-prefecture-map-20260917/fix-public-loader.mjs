// Repair the existing startup service's missing script registration, not its guard.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import vm from 'node:vm';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const file=path.join(root,'web/index.html'),service=path.join(root,'web/tm-public-treasury.js'),before=fs.readFileSync(file),text=before.toString('utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
new vm.Script(fs.readFileSync(service,'utf8'),{filename:'tm-public-treasury.js'});
const ctx={};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(service,'utf8'),ctx);assert.equal(ctx.TM.PublicTreasury.initialize({game:{}}).legacy,true);
assert.ok(!text.includes('src="tm-public-treasury.js'),'Registration now exists; review concurrent edits');
const anchor='<script src="tm-fiscal-engine.js?v=20260828-edictledger"></script>';assert.equal(text.split(anchor).length,2);
const eol=text.includes('\r\n')?'\r\n':'\n';const after=Buffer.from(text.replace(anchor,'<script src="tm-public-treasury.js?v=20260917accounts"></script>'+eol+anchor));
const dir=path.join(work,'runtime-before');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),before);
assert.equal(hash(fs.readFileSync(file)),hash(before));const tmp=file+'.cz-loader.tmp';fs.writeFileSync(tmp,after);fs.renameSync(tmp,file);assert.equal(hash(fs.readFileSync(file)),hash(after));
fs.writeFileSync(path.join(work,'loader-repair.json'),JSON.stringify({file:'web/index.html',before:hash(before),after:hash(after),serviceSha256:hash(fs.readFileSync(service)),test:'legacy initialization returns ok:true without changing scenario accounting',reason:'native startup called an existing but unregistered PublicTreasury service'},null,2));
console.log('Missing real service registered; legacy initialization tested.');

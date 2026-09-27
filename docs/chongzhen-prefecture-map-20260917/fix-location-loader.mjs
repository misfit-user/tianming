// Restore the existing location adapter's registration. No gameplay data is changed.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import vm from 'node:vm';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const file=path.join(root,'web/index.html'),moduleFile=path.join(root,'web/tm-map-locations.js');
const before=fs.readFileSync(file),text=before.toString('utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const moduleBytes=fs.readFileSync(moduleFile);new vm.Script(moduleBytes.toString('utf8'),{filename:'tm-map-locations.js'});
const c={};c.window=c;vm.createContext(c);vm.runInContext(moduleBytes.toString('utf8'),c);assert.equal(c.TMMapLocations.enabled({}),false);
const existing=/<script[^>]+src=["']tm-map-locations\.js/.test(text);if(existing){console.log('Already registered; no write');process.exit(0);}
const anchor='<script src="tm-map-system.js?v=20260709"></script>';assert.equal(text.split(anchor).length,2);
const eol=text.includes('\r\n')?'\r\n':'\n';const after=Buffer.from(text.replace(anchor,anchor+eol+'<script src="tm-map-locations.js?v=20260917location2"></script>'));
const backup=path.join(work,'runtime-before/index.before-location-loader.html');assert.ok(!fs.existsSync(backup),'Backup already exists; review state');fs.writeFileSync(backup,before);
assert.equal(hash(fs.readFileSync(file)),hash(before));const tmp=file+'.cz-location-loader.tmp';assert.ok(!fs.existsSync(tmp));fs.writeFileSync(tmp,after);assert.equal(hash(fs.readFileSync(tmp)),hash(after));fs.renameSync(tmp,file);assert.equal(hash(fs.readFileSync(file)),hash(after));
const report={checkedAt:new Date().toISOString(),file:'web/index.html',before:hash(before),after:hash(after),moduleSha256:hash(moduleBytes),reason:'Existing enabled map contract required TMMapLocations but homepage did not load it',legacyGuardVerified:true};fs.writeFileSync(path.join(work,'location-loader-repair.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));

// Restore the existing shared location service to the live page's load order.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),file=path.join(root,'web/index.html');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),before=fs.readFileSync(file),text=before.toString('utf8'),eol=text.includes('\r\n')?'\r\n':'\n';
assert.ok(fs.existsSync(path.join(root,'web/tm-map-locations.js')),'Location implementation missing');assert.ok(!text.includes('src="tm-map-locations.js'),'Already registered; inspect existing receipt');
const anchor='<script src="tm-map-system.js?v=20260709"></script>';assert.equal(text.split(anchor).length,2,'Map script anchor changed');
const after=Buffer.from(text.replace(anchor,anchor+eol+'<script src="tm-map-locations.js?v=20260917location2"></script>'));
const backup=path.join(work,'index-before-location-registration.html');assert.ok(!fs.existsSync(backup));fs.writeFileSync(backup,before);assert.equal(hash(fs.readFileSync(backup)),hash(before));
const tmp=file+'.chongzhen-location-loader.tmp';assert.ok(!fs.existsSync(tmp));fs.writeFileSync(tmp,after);assert.equal(hash(fs.readFileSync(file)),hash(before));let mode='rename';
try{fs.renameSync(tmp,file);}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;assert.equal(hash(fs.readFileSync(file)),hash(before));const fd=fs.openSync(file,'r+');try{let p=0;while(p<after.length){const n=fs.writeSync(fd,after,p,after.length-p,p);assert.ok(n>0);p+=n;}fs.ftruncateSync(fd,after.length);fs.fsyncSync(fd);}catch(error){fs.writeSync(fd,before,0,before.length,0);fs.ftruncateSync(fd,before.length);fs.fsyncSync(fd);throw error;}finally{fs.closeSync(fd);}mode='backed-up-in-place';fs.unlinkSync(tmp);}
assert.equal(hash(fs.readFileSync(file)),hash(after));const result={complete:true,file:'web/index.html',before:hash(before),after:hash(after),mode,moduleSha256:hash(fs.readFileSync(path.join(root,'web/tm-map-locations.js'))),scope:'one script load entry; no source data or version change'};
fs.writeFileSync(path.join(work,'location-loader-registration.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));

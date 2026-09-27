'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {copyReleaseInputs}=require('../../scripts/sync-hot-baseline.js'),tree=require('../../scripts/lib/release-tree.js');
const root=path.resolve(__dirname,'../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'tm-baseline-input-test-')),src=path.join(temp,'source'),dst=path.join(temp,'overlay');
try{
 const inputs={'index.html':'<html>exact</html>','assets/portrait.png':'original-media','vendor/shanhe25d/height.png':'height-data','preview/img/court.webp':'court-media','dev-tools/test/sessionData/secret.txt':'excluded-test-storage','scripts/test.js':'test-only','tm-code.js.original':'old-backup','tm-code.js':'runtime'};
 for(const [f,v]of Object.entries(inputs)){const p=path.join(src,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
 const config=tree.loadConfig(root).config,result=copyReleaseInputs(src,dst,config);
 const expected=tree.walkTree(src,config).kept;assert.equal(result.files,expected.length);assert(expected.length>=5);
 for(const item of expected)assert(fs.readFileSync(path.join(dst,item.rel)).equals(fs.readFileSync(item.abs)),item.rel);
 for(const f of ['dev-tools/test/sessionData/secret.txt','scripts/test.js','tm-code.js.original'])assert(!fs.existsSync(path.join(dst,f)),f);
 assert.throws(()=>copyReleaseInputs(src,dst,config),e=>e.code==='EEXIST','existing staged bytes are not overwritten');
 console.log('PASS baseline input collection: exact shared production rules, all runtime assets, no profiles/backups and no overwrite');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';import crypto from 'node:crypto';
const d='docs/endturn-final-closeout-20260919',lock=JSON.parse(fs.readFileSync('package-lock.json','utf8')).packages['node_modules/js-yaml'];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),pins=['package.json','package-lock.json'].map(f=>[f,hash(f)]);
if(lock.version!=='4.3.2'||lock.resolved!=='https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz')throw Error('Unexpected lockfile; inspect instead of guessing');
const installed=JSON.parse(fs.readFileSync('node_modules/js-yaml/package.json','utf8'));if(installed.version===lock.version){console.log('Already aligned');process.exit(0);}
const stage=d+'/yaml-locked-package';fs.mkdirSync(stage,{recursive:true});const cli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const r=cp.spawnSync(process.execPath,[cli,'pack',lock.resolved,'--ignore-scripts','--json','--pack-destination',stage,'--registry=https://registry.npmjs.org','--fetch-retries=0','--fetch-timeout=20000'],{encoding:'utf8',timeout:30000});
fs.writeFileSync(d+'/yaml-sync-download.log',(r.stdout||'')+(r.stderr||''));if(r.status!==0)throw Error('Locked package download failed; source files were not changed');
const meta=JSON.parse(r.stdout)[0],tgz=path.join(stage,meta.filename),integrity='sha512-'+crypto.createHash('sha512').update(fs.readFileSync(tgz)).digest('base64');if(integrity!==lock.integrity)throw Error('Package integrity mismatch');
const listing=cp.execFileSync('tar',['-tzf',tgz],{encoding:'utf8'}).trim().split(/\r?\n/);if(listing.some(n=>!n.startsWith('package/')||n.split('/').includes('..')))throw Error('Unexpected tar member');
cp.execFileSync('tar',['-xzf',tgz,'-C',stage]);const incoming=path.join(stage,'package');if(JSON.parse(fs.readFileSync(incoming+'/package.json','utf8')).version!==lock.version)throw Error('Version mismatch');
const backup='.bak-endturn-final-closeout-20260919/node_modules/js-yaml';fs.mkdirSync(path.dirname(backup),{recursive:true});if(fs.existsSync(backup))throw Error('Package backup exists; refusing overwrite');
for(const [f,h]of pins)if(hash(f)!==h)throw Error('Dependency definitions changed during operation');
fs.renameSync('node_modules/js-yaml',backup);try{fs.renameSync(incoming,'node_modules/js-yaml');}catch(e){fs.renameSync(backup,'node_modules/js-yaml');throw e;}
fs.writeFileSync(d+'/yaml-sync.json',JSON.stringify({at:new Date().toISOString(),before:installed.version,after:lock.version,integrity,backup,scriptExecution:false,manifestUnchanged:pins.every(([f,h])=>hash(f)===h)},null,2));console.log('Aligned installed js-yaml',installed.version,'->',lock.version,'using verified locked tarball; no install scripts');

'use strict';
// Full installers complete a previously prepared version without retagging ship-* or moving OTA feeds.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const tree=require('./lib/release-tree.js'),{tagCommit}=require('./release-web-only.js');
function run(command,args,root){const r=spawnSync(command,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:12e6});if(r.status!==0)throw Error(command+' failed: '+String(r.stderr||r.stdout));return String(r.stdout||'').trim();}
function hash(file){const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buffer=Buffer.alloc(4*1024*1024);try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,n));return h.digest('hex');}finally{fs.closeSync(fd);}}
function assertCompletion({version,current,code,mobileVersion,existingTag}){
  if(version!==current||mobileVersion.version!==version||Number(code)!==Number(mobileVersion.versionCode))throw Error('Full-installer completion requires the exact prepared version and Android versionCode');
  if(existingTag)throw Error('Full-installer tag already exists; a new full release needs a new version');
}
function fingerprint(root){
  const config=tree.loadConfig(root).config,web=path.join(root,'web'),inventory=tree.walkTree(web,config);
  const files=tree.hashEntries(inventory.kept);
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
  const shell=[...new Set(['package.json','package-lock.json','mobile/release-version.json','mobile/capacitor.config.json',...pkg.build.files.filter(f=>!f.startsWith('!')&&!f.includes('*')&&!f.startsWith('web/'))])].sort().map(file=>({file,sha256:hash(path.join(root,file))}));
  return {webTreeHash:tree.treeHash(files),webFiles:files.length,webBytes:files.reduce((n,f)=>n+f.size,0),shell};
}
function record({root,directory,exe,apk,unsignedTest}){
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),version=pkg.build.buildVersion;
  const artifacts=[exe,apk].map(name=>{if(!name||path.basename(name)!==name)throw Error('Artifact names must be basenames');const file=path.join(directory,name);return {name,bytes:fs.statSync(file).size,sha256:hash(file)};});
  if(!/\.exe$/i.test(exe)||! /\.apk$/i.test(apk))throw Error('Both complete EXE and APK required');
  const receipt={schema:'tianming-full-installers/1',version,preparedHead:run('git',['rev-parse','HEAD'],root),unsignedTest:!!unsignedTest,source:fingerprint(root),artifacts};
  fs.writeFileSync(path.join(directory,'full-installer-receipt.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
function verify({root,version,directory}){
  const receipt=JSON.parse(fs.readFileSync(path.join(directory,'full-installer-receipt.json')));
  if(receipt.schema!=='tianming-full-installers/1'||receipt.version!==version||!Array.isArray(receipt.artifacts)||receipt.artifacts.length!==2)throw Error('Invalid installer receipt');
  if(JSON.stringify(receipt.source)!==JSON.stringify(fingerprint(root)))throw Error('Installer source differs from current release tree');
  if(!receipt.artifacts.some(a=>/\.exe$/i.test(a.name))||!receipt.artifacts.some(a=>/\.apk$/i.test(a.name)))throw Error('Missing complete installer');
  for(const a of receipt.artifacts){if(path.basename(a.name)!==a.name)throw Error('Unsafe artifact name');const f=path.join(directory,a.name);if(fs.statSync(f).size!==a.bytes||hash(f)!==a.sha256)throw Error('Artifact changed: '+a.name);}
  if(receipt.unsignedTest!==true){const signing=require('./lib/windows-signing.js');signing.verifyAuthenticode(path.join(directory,receipt.artifacts.find(a=>/\.exe$/i.test(a.name)).name),signing.requirePublisher());}
  return receipt;
}
function uploadedArtifact(assets,artifact){
  // GitHub normalizes non-ASCII filenames. Match the uploaded bytes, not a lossy name.
  const matches=assets.filter(a=>a.size===artifact.bytes&&a.digest==='sha256:'+artifact.sha256);
  if(matches.length!==1)throw Error('Uploaded asset hash/size mismatch: '+artifact.name);
  return matches[0];
}
function publish({root,version,head,directory,notes,receipt}){
  if(!/^[a-f0-9]{40}$/.test(head))throw Error('Missing locked main commit');
  const tag='full-'+version,repo='misfit-user/tianming',existing=tagCommit(root,tag);
  if(existing&&existing!==head)throw Error('Existing full-installer tag points at a different commit');
  const view=spawnSync('gh',['release','view',tag,'--repo',repo,'--json','isDraft,assets'],{cwd:root,encoding:'utf8'});
  if(view.status===0&&!JSON.parse(view.stdout).isDraft)throw Error('Full-installer release already published; refusing replacement');
  const body=path.join(directory,'release-notes.md');fs.writeFileSync(body,notes+'\n');
  if(view.status!==0)run('gh',['release','create',tag,'--repo',repo,'--target',head,'--draft','--prerelease','--latest=false','--title','天命 '+version+' · 完整安装版','--notes-file',body],root);
  if(tagCommit(root,tag)&&tagCommit(root,tag)!==head)throw Error('Tag verification failed');
  const files=receipt.artifacts.map(a=>path.join(directory,a.name)).concat([path.join(directory,'full-installer-receipt.json')]);
  for(const extra of ['SHA256SUMS.txt','完整包内容对账.json','安装说明.txt'])if(fs.existsSync(path.join(directory,extra)))files.push(path.join(directory,extra));
  run('gh',['release','upload',tag,'--repo',repo,'--clobber',...files],root);
  const uploaded=JSON.parse(run('gh',['release','view',tag,'--repo',repo,'--json','assets'],root));
  for(const a of receipt.artifacts)uploadedArtifact(uploaded.assets,a);
  run('gh',['release','edit',tag,'--repo',repo,'--draft=false','--prerelease','--latest=false'],root);
  if(tagCommit(root,tag)!==head)throw Error('Published full-installer tag verification failed');
  run('gh',['workflow','run','pages.yml','--repo',repo,'--ref','main','-f','ref='+head],root);
  console.log('FULL_INSTALLERS_PUBLISHED '+tag+' '+head+'; Pages pinned to the same source; OTA unchanged');
}
if(require.main===module){try{const args=process.argv.slice(2),get=k=>args[args.indexOf('--'+k)+1],root=path.resolve(__dirname,'..');if(!args.includes('--record'))throw Error('Use release.js for prepare/publish; this entry only records built artifacts');const r=record({root,directory:path.resolve(get('dir')),exe:get('exe'),apk:get('apk'),unsignedTest:args.includes('--unsigned-test')});console.log('FULL_INSTALLERS_RECORDED '+r.version+' files='+r.source.webFiles);}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={assertCompletion,fingerprint,record,verify,publish,uploadedArtifact};

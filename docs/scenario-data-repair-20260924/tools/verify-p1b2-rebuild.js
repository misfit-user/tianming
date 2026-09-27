// 从原版完整重建各两次，只存哈希，不复制大剧本。会写回三部真源和已有补丁报告。
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../../..'),DIR=path.resolve(__dirname,'..');
const scenarios={tianqi:'天启七年·九月（官方）.json',shaosong:'绍宋·建炎元年八月（官方）.json',tang:'晚唐·开成五年（官方）.json'};
const report=[];
for(const [key,name] of Object.entries(scenarios)) {
  const rounds=[];
  for(let round=1;round<=2;round++) {
    const script=path.join(DIR,'patches/rebuild-'+key+'.js');
    console.log('START '+key+' rebuild '+round);
    const r=spawnSync(process.execPath,[script],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
    if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');throw Error(key+' rebuild failed '+r.status);}
    const data=fs.readFileSync(path.join(ROOT,'scenarios',name));
    const row={round,bytes:data.length,md5:crypto.createHash('md5').update(data).digest('hex'),sha256:crypto.createHash('sha256').update(data).digest('hex')};
    rounds.push(row);console.log('PASS '+key+' rebuild '+round+' '+JSON.stringify(row));
  }
  assert.strictEqual(rounds[0].md5,rounds[1].md5,key+' 两次重建不同');
  assert.strictEqual(rounds[0].sha256,rounds[1].sha256,key+' 两次重建不同');
  report.push({scenario:name,rounds});
  fs.writeFileSync(path.join(DIR,'reports/p1b2-rebuild.json'),JSON.stringify(report,null,2)+'\n');
}
console.log('PASS all three scenarios rebuilt twice, byte hashes equal');

// 从原版完整重建两次；一次只启动一个重建子进程，不运行游戏 VM。
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),{spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../../..'),DIR=path.resolve(__dirname,'..');
const requested=process.argv.slice(2),reportFile=path.join(DIR,'reports/tax-base-rebuild.json');
const out=requested.length&&fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):[];
for(const key of requested.length?requested:['tianqi','shaosong','tang']){
  assert(['tianqi','shaosong','tang'].includes(key),'未知剧本');
  const name=require('../data/'+key+'-tax-base').scenario,rounds=[];
  for(let i=1;i<=2;i++){
    const r=spawnSync(process.execPath,[path.join(DIR,'patches/rebuild-'+key+'.js')],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
    if(r.status!==0)throw Error(key+' rebuild failed\n'+r.stdout+'\n'+r.stderr);
    const bytes=fs.readFileSync(path.join(ROOT,'scenarios',name));
    rounds.push({round:i,bytes:bytes.length,md5:crypto.createHash('md5').update(bytes).digest('hex'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
    console.log('PASS rebuild '+key+' #'+i+' '+rounds[i-1].sha256);
  }
  assert.equal(rounds[0].sha256,rounds[1].sha256,key+'两次重建不一致');
  assert.equal(rounds[0].md5,rounds[1].md5,key+'两次重建MD5不一致');
  const prior=out.findIndex(r=>r.scenario===name);if(prior>=0)out[prior]={scenario:name,rounds};else out.push({scenario:name,rounds});
  fs.writeFileSync(reportFile,JSON.stringify(out,null,2)+'\n');
}

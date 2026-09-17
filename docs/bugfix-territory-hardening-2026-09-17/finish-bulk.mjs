import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import os from 'node:os';import {fileURLToPath} from 'node:url';
import {functionSource} from '../../web/scripts/lib-perf-round1.js';
const here=path.dirname(fileURLToPath(import.meta.url)),file=path.resolve(here,'../../web/tm-faction-membership.js');
if(os.hostname()!=='LAPTOP-AV4J1O7I')throw Error('wrong device');
const before=fs.readFileSync(file),source=before.toString('utf8'),old=functionSource(source,'bulkReassignProvinces');
const next=`function bulkReassignProvinces(filterFn, newFacName, opts) {
    var g=_gm();if(!g)return 0;opts=opts || {};
    if(typeof filterFn!=='function')throw new Error('批量易主缺少选择条件');
    var table=g._provinceToFaction || {},rows=[];
    Object.keys(table).forEach(function(key){
      if(filterFn(key,table[key]))rows.push({regionRef:key,newOwner:newFacName,reason:opts.reason});
    });
    var result=applyProvinceTransfers(rows,Object.assign({},opts,{silent:true}));
    if(result.applied>0 && !opts.silent)_emit('faction:bulkProvinces',{newFaction:newFacName,count:result.applied,reason:opts.reason});
    return result.applied;
  }`;
const updated=source.replace(old,next);new vm.Script(updated,{filename:file});
if(!fs.readFileSync(file).equals(before))throw Error('concurrent edit');
fs.writeFileSync(path.join(here,'membership-before-bulk.bak'),before,{flag:'wx'});
const data=Buffer.from(updated,'utf8'),fd=fs.openSync(file,'r+');
try{let n=0;while(n<data.length)n+=fs.writeSync(fd,data,n,data.length-n,n);fs.ftruncateSync(fd,data.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
if(!fs.readFileSync(file).equals(data))throw Error('readback mismatch');
console.log('BULK_TRANSFER_PATCH_READBACK_OK');

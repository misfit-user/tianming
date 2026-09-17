import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { functionSource } from '../../web/scripts/lib-perf-round1.js';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../..'),web=path.join(repo,'web');
if(os.hostname()!=='LAPTOP-AV4J1O7I'||path.basename(repo)!=='tianming')throw Error('wrong target');
const names=['tm-endturn-apply.js','tm-faction-membership.js','tm-map-system.js','map-integration.js','tm-ai-change-narrative.js'];
const original={},code={};
for(const name of names){
  const file=path.join(web,name),backup=path.join(here,'originals',name);
  if(!fs.existsSync(backup))fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
  original[name]=fs.readFileSync(backup);if(!fs.readFileSync(file).equals(original[name]))throw Error('concurrent edit: '+name);
  code[name]=original[name].toString('utf8');
}
function edit(name,from,to){
  if(code[name].split(from).length!==2)throw Error('nonunique patch: '+name+' '+from.slice(0,80));
  code[name]=code[name].replace(from,to);
}
function fn(name,key,text){const old=functionSource(code[name],key);edit(name,old,text.replace(/\r?\n/g,old.includes('\r\n')?'\r\n':'\n'));}
const text=name=>fs.readFileSync(path.join(here,name),'utf8');
const membership='tm-faction-membership.js';
let refresh=functionSource(code[membership],'_refreshIndex');
fn(membership,'_refreshIndex',refresh.replace('_refreshIndex(facName)','_refreshIndex(facName, strict)').replaceAll('catch(_){}','catch(error){if(strict)throw error;}'));
edit(membership,'  function _provinceTransferRecord(g, ref) {',text('batch-support.txt')+'\n  function _provinceTransferRecord(g, ref) {');

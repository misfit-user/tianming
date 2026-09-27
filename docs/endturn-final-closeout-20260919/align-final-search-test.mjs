import fs from 'node:fs';import crypto from 'node:crypto';import cp from 'node:child_process';import {edit} from './patch-utils.mjs';
const d='docs/endturn-final-closeout-20260919',file='web/phase8-formal-map.js',bytes=fs.readFileSync(file),text=bytes.toString('utf8');
if(!text.includes('if (window.GM && GM._useAIGeo === true) return null;'))throw Error('The explicit geography guard was lost; inspect before adoption');
const changes=JSON.parse(fs.readFileSync(d+'/changes.json','utf8')),last=changes.filter(r=>r.file===file).at(-1),hash=crypto.createHash('sha256').update(bytes).digest('hex');
if(hash!==last.after){
 const diff=cp.spawnSync('git',['diff','--no-index','--','docs/endturn-final-closeout-20260919/parallel-observed/'+file,file],{encoding:'utf8'});
 fs.writeFileSync(d+'/parallel-map-final.diff',diff.stdout||'');
 fs.writeFileSync(d+'/parallel-observed/map-final.js',bytes,{flag:'wx'});
 changes.push({file,before:last.after,after:hash,at:new Date().toISOString(),externalAdoption:true,note:'Preserve the other window retained mapHTML implementation; own AI-geography guard is intact.'});fs.writeFileSync(d+'/changes.json',JSON.stringify(changes,null,2));
}
edit('web/scripts/smoke-search-empty-state.js',(s,r)=>{
 const old=s.split('\n').find(l=>l.startsWith('ok(/var resultsHtml = rows'));
 if(!old)throw Error('Search contract location changed');
 s=r(s,old,"ok(/var resultsHtml = rows\\.length \\?/.test(mapSrc) && mapSrc.includes('mapHTML(host, resultsHtml);'), '① 完整搜索结果交给实际保留式渲染器，空状态不丢失');");
 return r(s,"vm.createContext(c);vm.runInContext(functionSource(mapSrc,'renderMapSearchResults'),c);","vm.createContext(c);vm.runInContext('var _mapHTMLCache = new WeakMap();\\n'+functionSource(mapSrc,'mapHTML')+'\\n'+functionSource(mapSrc,'renderMapSearchResults'),c);");
});

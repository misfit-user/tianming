import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../..');
const files=['web/map-integration.js','web/tm-endturn-prompt.js'];
const originals=new Map(files.map(f=>[f,fs.readFileSync(path.join(root,f))]));
const output=new Map([...originals].map(([f,b])=>[f,b.toString('utf8')]));
function replace(f,oldText,newText){const text=output.get(f),i=text.indexOf(oldText);if(i<0||text.indexOf(oldText,i+oldText.length)>=0)throw Error('Non-unique anchor '+f);output.set(f,text.slice(0,i)+newText+text.slice(i+oldText.length));}
const map=files[0],prompt=files[1],newline=f=>output.get(f).includes('\r\n')?'\r\n':'\n';
replace(map,'    const regions = mapData.regions;',`    // Detached, read-only view; partial/legacy map rows must not erase AI geography.
    const regions = mapData.regions.filter(Boolean).map(r => Object.assign({},r,{
        owner: r.currentOwner != null ? r.currentOwner : (r.owner || r.factionId || ''),
        neighbors: Array.isArray(r.neighbors) ? r.neighbors : [],
        resources: Array.isArray(r.resources) ? r.resources : []
    }));`.replace(/\n/g,newline(map)));
replace(map,'    const factions = gameState.factions || [];','    gameState = gameState || {};'+newline(map)+'    const factions = gameState.facs || gameState.factions || [];');
replace(map,'共有 ${regions.length} 个省份。','共有 ${regions.length} 个地块。');
replace(map,'控制 ${territories.length} 个省份','控制 ${territories.length} 个地块');
replace(map,'    // 3. 战略要地',`    // Recent confirmed transfers stay visible even beyond the five-name overview.
    const factionLabel = value => {
        const f=factions.find(x=>x && (x.id===value || x.name===value));
        return f ? f.name : (value || '无主');
    };
    const now=Number(gameState.turn);
    const transfers=regions.map(r=>({r:r,h:Array.isArray(r.ownerHistory)?r.ownerHistory[r.ownerHistory.length-1]:null}))
        .filter(x=>x.h && (!Number.isFinite(now) || Number(x.h.turn)>=now-2))
        .sort((a,b)=>Number(b.h.turn)-Number(a.h.turn));
    if (transfers.length) {
        context += '\\n【近期已确认的领地易主】\\n当前运行态归属优先于开局设定；以下变化已经生效，不要重复扣除或恢复旧归属。\\n';
        transfers.slice(0,32).forEach(x=>{
            context += String(x.r.name || x.r.id).slice(0,60)+' ['+String(x.r.id).slice(0,60)+']：'+factionLabel(x.h.from)+' → '+factionLabel(x.r.owner)+'；第'+x.h.turn+'回合；'+String(x.h.reason || '').slice(0,80)+'\\n';
        });
        if(transfers.length>32)context += '另有 '+(transfers.length-32)+' 处易主未逐条展开，势力分布为当前总览。\\n';
    }

    // 3. 战略要地`.replace(/\n/g,newline(map)));
const mt=output.get(map),bs=mt.indexOf('function findBorderConflicts(regions) {'),be=mt.indexOf('}',mt.indexOf('    return conflicts;',bs))+1;
if(bs<0||be<=bs)throw Error('Missing border function');
replace(map,mt.slice(bs,be),`function findBorderConflicts(regions) {
    const conflicts=[], byId=new Map(), seen=new Set();
    (regions || []).filter(Boolean).forEach(r=>byId.set(r.id,r));
    byId.forEach(r1=>{
        if(!r1.owner)return;
        (Array.isArray(r1.neighbors)?r1.neighbors:[]).forEach(id=>{
            const r2=byId.get(id);
            if(!r2 || !r2.owner || r2.owner===r1.owner)return;
            const key=JSON.stringify([String(r1.id),String(r2.id)].sort());
            if(seen.has(key))return;
            seen.add(key);
            conflicts.push({region1:r1.name,owner1:r1.owner,region2:r2.name,owner2:r2.owner});
        });
    });
    return conflicts;
}`.replace(/\n/g,newline(map)));
const pt=output.get(prompt),ps=pt.indexOf('    if(P.map && P.map.regions'),pe=pt.indexOf('    if(sc&&sc.refText)',ps);
if(ps<0||pe<0)throw Error('Missing live prompt block');
replace(prompt,pt.slice(ps,pe),`    var _livePromptMap = typeof TMMapRuntime !== 'undefined' && TMMapRuntime.peekMapSource ? TMMapRuntime.peekMapSource() : (GM.mapData || GM.map);
    if(_livePromptMap && _livePromptMap.regions && _livePromptMap.regions.length > 0) {
      try { tp += generateMapContextForAI(_livePromptMap, GM) + "\\n"; } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'endturn.mapContextForAI'); }
    }
`.replace(/\n/g,newline(prompt)));
for(const [f,text] of output)new vm.Script(text,{filename:f});
for(const [f,buf] of originals){
  if(!fs.readFileSync(path.join(root,f)).equals(buf))throw Error('Concurrent edit '+f);
  fs.writeFileSync(path.join(dir,'originals',path.basename(f)+'.bak'),buf,{flag:'wx'});
}
function write(f,buf){const fd=fs.openSync(path.join(root,f),'r+');try{let n=0;while(n<buf.length)n+=fs.writeSync(fd,buf,n,buf.length-n,n);fs.ftruncateSync(fd,buf.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}if(!fs.readFileSync(path.join(root,f)).equals(buf))throw Error('Readback mismatch '+f);}
const written=[];
try{for(const [f,text] of output){written.push(f);write(f,Buffer.from(text,'utf8'));}}
catch(e){for(const f of written.reverse())write(f,originals.get(f));throw e;}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest={updatedAt:new Date().toISOString(),files:files.map(f=>({path:f,before:hash(originals.get(f)),after:hash(fs.readFileSync(path.join(root,f)))}))};
fs.writeFileSync(path.join(dir,'context-patch-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log('CONTEXT_PATCH_READBACK_OK '+JSON.stringify(manifest));

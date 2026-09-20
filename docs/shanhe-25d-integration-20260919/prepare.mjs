// Import the exact approved B5 artifact; do not modify scenarios, saves or existing source.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),work=import.meta.dirname;
const input='C:/Users/37814/Downloads/天命_山河境_B5_2.5D.html';
const bytes=fs.readFileSync(input),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(hash(bytes)!=='9f8abf8dd6e85333e7e702ece4dc1f1a223f90f2b8e1d11029d6fcf19772dbcc')throw Error('Approved B5 hash mismatch');
const html=bytes.toString('utf8'),payload=JSON.parse(html.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
if(scripts.length!==3||!scripts[0].includes('class Renderer'))throw Error('Unexpected B5 structure');
const dest=path.join(root,'web/vendor/shanhe25d');fs.mkdirSync(dest,{recursive:true});
const owned=['engine.js','environment.js','height.png','albedo.webp','fallback.webp','water.png'];
if(owned.some(n=>fs.existsSync(path.join(dest,n))))throw Error('Native asset destination already populated; refuse overwrite');
let engine=scripts[0].replace('if(v.span<2||v.span>110','if(v.span<.1||v.span>300');
fs.writeFileSync(path.join(dest,'engine.js'),engine);fs.writeFileSync(path.join(dest,'environment.js'),'window.TM_SHANHE_ENV='+JSON.stringify(payload.environment)+';\n');
for(const [key,name]of [['height','height.png'],['albedo','albedo.webp'],['fallback','fallback.webp'],['water','water.png']])fs.writeFileSync(path.join(dest,name),Buffer.from(payload.assets[key].split(',')[1],'base64'));
const calPath='D:/tianming-assistant-work/chongzhen-prefecture-map-20260917/calibration.json';
fs.writeFileSync(path.join(dest,'ming-calibration.json'),fs.readFileSync(calPath));
const source=[];
for(const file of fs.readdirSync(path.join(root,'scenarios')).filter(n=>n.endsWith('（官方）.json'))){
 const raw=fs.readFileSync(path.join(root,'scenarios',file)),s=JSON.parse(raw),m=s.map;
 source.push({file,id:s.id,sha256:hash(raw),mapId:m.id,width:m.width,height:m.height,regions:m.regions.length,projection:m.projection,source:m.source,geographicReferences:m.geographicReferences,anchors:m.regions.slice(0,4).map(r=>({id:r.id,center:r.center,referenceSeat:r.referenceSeat,geographicCenter:r.geographicCenter}))});
}
fs.writeFileSync(path.join(work,'source-inspection.json'),JSON.stringify(source,null,2));
fs.writeFileSync(path.join(work,'asset-import.json'),JSON.stringify({input,inputSha256:hash(bytes),files:owned.map(file=>({file,sha256:hash(fs.readFileSync(path.join(dest,file)))})),note:'Approved B5 resources, no old review fixtures or review UI installed'},null,2));
console.log(JSON.stringify({assetDestination:dest,source:source.map(s=>({id:s.id,mapId:s.mapId,regions:s.regions,projection:s.projection,geographicReferences:s.geographicReferences}))},null,2));

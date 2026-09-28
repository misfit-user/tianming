'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const G=require('../web/map-editor-scenario-geometry.js');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(sourceRoot,outRoot,write){
  const folder=path.join(sourceRoot,'scenarios'),output=path.join(outRoot,'web/data/maps/scenario-library'),entries=[];
  const files=fs.readdirSync(folder).filter(f=>f.endsWith('（官方）.json')).sort();
  if(write)fs.mkdirSync(output,{recursive:true});
  for(const file of files){
    const bytes=fs.readFileSync(path.join(folder,file)),scenario=JSON.parse(bytes.toString('utf8'));
    if(!(scenario.map||scenario.mapData))continue;
    if(!/^[a-zA-Z0-9_-]+$/.test(scenario.id))throw Error('Unsafe scenario id');
    const source={path:'scenarios/'+file,sha256:sha(bytes)};
    const filename=scenario.id+'.json',target=path.join(output,filename);
    if(write){
      const bundle=G.compile(scenario,source),text=JSON.stringify(bundle)+'\n';fs.writeFileSync(target,text);
      if(fs.readFileSync(target,'utf8')!==text)throw Error('Map asset readback failed');
    }
    const data=fs.readFileSync(target),bundle=JSON.parse(data.toString('utf8'));
    if(bundle.source.sha256!==source.sha256 || bundle.source.path!==source.path)throw Error('Scenario map library is stale: '+file);
    const counts=Object.fromEntries(Object.entries(bundle.layers).map(([k,v])=>[k,v.length]));
    entries.push({id:scenario.id,name:scenario.name,era:scenario.era,dynasty:scenario.dynasty,mapName:bundle.base.title,
      levels:['all','realm','region','prefecture'],counts,source,filename,bytes:data.length,sha256:sha(data)});
    console.log(scenario.id+' '+JSON.stringify(counts)+' '+data.length+' bytes');
  }
  const producerSha256=sha(Buffer.concat([fs.readFileSync(__filename),fs.readFileSync(path.join(__dirname,'../web/map-editor-scenario-geometry.js'))]));
  const text=JSON.stringify({schemaVersion:'tm-map-editor-library-index/1',producerSha256,entries},null,2)+'\n',index=path.join(output,'index.json');
  if(write)fs.writeFileSync(index,text);else if(fs.readFileSync(index,'utf8')!==text)throw Error('Map library index is stale');
  return entries;
}
if(require.main===module){
  const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
  if(!args.includes('--write')&&!args.includes('--check'))throw Error('Use --write or --check');
  build(path.resolve(value('--source-root')||path.join(__dirname,'..')),path.resolve(value('--out-root')||path.join(__dirname,'..')),args.includes('--write'));
}
module.exports={build};

'use strict';
(async function(){
  const fs=await import('node:fs'),path=await import('node:path'),vm=await import('node:vm');
  const assert=(await import('node:assert/strict')).default,root=path.resolve(__dirname,'..');
  const source=fs.readFileSync(path.join(root,'map-integration.js'),'utf8');
  const prompt=fs.readFileSync(path.join(root,'tm-endturn-prompt.js'),'utf8');
  function fixture(){
    const regions=Array.from({length:12},(_,i)=>({id:'r'+i,name:i===9?'易主测试州':'州'+i,owner:i<8?'fb':'fa',neighbors:[],resources:[],development:50}));
    const template={regions:regions},live=JSON.parse(JSON.stringify(template));
    live.regions[9].owner='fb';live.regions[9].currentOwner='fb';
    live.regions[9].ownerHistory=[{turn:7,from:'fa',to:'fb',reason:'已完成割让'}];
    const ctx={console,P:{map:template,factions:[{id:'fa',name:'甲国'},{id:'fb',name:'旧乙国'}]},
      GM:{turn:7,mapData:live,facs:[{id:'fa',name:'甲国'},{id:'fb',name:'乙国'}]},tp:'',
      TM:{errors:{capture(e){throw e;}}}};
    ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'map-integration.js'});return ctx;
  }
  const tests=[];function test(name,run){tests.push({name,run});}
  test('actual end-turn map block uses live world even when P.map remains stale',()=>{
    const c=fixture();let start=prompt.indexOf('    var _livePromptMap =');
    if(start<0)start=prompt.indexOf('    if(P.map && P.map.regions');
    const end=prompt.indexOf('    if(sc&&sc.refText)',start);assert(start>=0&&end>start);
    vm.runInContext(prompt.slice(start,end),c);
    assert.match(c.tp,/乙国：控制 9 个地块/);assert(!c.tp.includes('旧乙国'));
    assert.match(c.tp,/易主测试州.*甲国 → 乙国/);assert.equal(c.P.map.regions[9].owner,'fa');
  });
  test('recent transfer beyond five-name overview is explicitly included',()=>{
    const c=fixture(),text=c.generateMapContextForAI(c.GM.mapData,c.GM);
    assert.match(text,/近期已确认的领地易主/);assert.match(text,/易主测试州.*甲国 → 乙国/);
  });
  test('partial map arrays do not erase the entire geography context',()=>{
    const c=fixture();delete c.GM.mapData.regions[0].neighbors;delete c.GM.mapData.regions[0].resources;
    assert.match(c.generateMapContextForAI(c.GM.mapData,c.GM),/势力分布/);
  });
  test('generating a prompt cannot mutate template or runtime state',()=>{
    const c=fixture(),before=JSON.stringify([c.P,c.GM]);
    c.generateMapContextForAI(c.GM.mapData,c.GM);assert.equal(JSON.stringify([c.P,c.GM]),before);
  });
  test('empty current owner is authoritative rather than reverting to stale owner',()=>{
    const c=fixture();c.GM.mapData.regions[9].currentOwner='';
    const text=c.generateMapContextForAI(c.GM.mapData,c.GM);assert.match(text,/易主测试州.*→ 无主/);
  });
  test('border detection uses IDs when neighboring regions share display names',()=>{
    const c=fixture(),rows=[{id:'a',name:'同名',owner:'fa',neighbors:['b']},{id:'b',name:'同名',owner:'fb',neighbors:['a','c']},{id:'c',name:'同名',owner:'fa',neighbors:['b']}];
    assert.equal(c.findBorderConflicts(rows).length,2);
  });
  test('old transfers expire and recent list is bounded',()=>{
    const c=fixture();c.GM.turn=20;
    assert(!c.generateMapContextForAI(c.GM.mapData,c.GM).includes('近期已确认的领地易主'));
    c.GM.turn=7;c.GM.mapData.regions=Array.from({length:50},(_,i)=>({...c.GM.mapData.regions[9],id:'recent'+i,name:'近期州'+i}));
    const text=c.generateMapContextForAI(c.GM.mapData,c.GM);assert.equal((text.match(/→/g)||[]).length,32);assert.match(text,/另有 18 处易主/);
  });
  let failed=0;for(const t of tests){try{await t.run();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}
  console.log(JSON.stringify({suite:'territory-context-sync',total:tests.length,passed:tests.length-failed,failed}));
  if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

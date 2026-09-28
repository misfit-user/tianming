// node patches/tax-base.js tianqi|shaosong|tang [--report <文件>] [--write]
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.resolve(__dirname,'../../..'),DIR=path.resolve(__dirname,'..');
const SOURCES=require('../data/tax-base-sources');
const OPENING=require('../data/opening-treasury');
const leaves=nodes=>(nodes||[]).flatMap(d=>d.children&&d.children.length?leaves(d.children):[d]);
function productionTax(id,name,base,price,rate,refs,regionIds,basis){
  return {id,name,base,baseFactor:1,rate,storeAs:'money',sourceTag:base==='saltProduction'?'yanlizhuan':base==='maritimeTradeVolume'?'shipaiShui':id,annual:true,
    productionTax:{unitPrice:price,quantityUnit:base==='saltProduction'?'斤':'本位钱',basis:basis||'taxable-value',sources:refs,...(regionIds?{regionIds}: {})}};
}
function apply(s,data){
  const fc=s.fiscalConfig,all=leaves(s.adminHierarchy.player.divisions),old=fc.taxList||fc.taxes;
  assert(Array.isArray(old),'缺显式税表');
  // 旧档常只保存开关，须连同旧附加税及起运规则冻结，而非继承新版场景参数。
  fc.legacyTaxConfig=JSON.parse(JSON.stringify(data.legacy));
  if(data.mode==='ming'){
    const taken=new Set();
    const salt=data.salt.map(g=>{
      const selected=g.names?g.names.map(n=>{const a=all.filter(d=>d.name===n);assert.equal(a.length,1,n);return a[0];}):
        s.adminHierarchy.player.divisions.filter(d=>g.provinces.includes(d.name)).flatMap(d=>leaves([d])).filter(d=>(d.tags||{}).saltRegion);
      assert(selected.length,g.name+'无产区');
      assert.equal(selected.reduce((a,d)=>a+(d.economyBase.saltProduction||0),0),g.quantity,g.name+'原产额与史料配对数量不同');
      selected.forEach(d=>{assert(!taken.has(d.id),'盐区重征 '+d.name);taken.add(d.id);});
      const tax=productionTax(g.id,g.name,'saltProduction',g.receipts/g.quantity,1,g.sources,selected.map(d=>d.id),'fiscal-receipt');
      tax.description='按本运司可销额盐斤数计课；每斤课银由史载额盐与课银配对推得，不是盐的零售价。';
      return tax;
    });
    fc.taxList=old.filter(t=>!/^salt_/.test(t.id)&&t.id!=='guanshui').concat(salt);
    const ports=all.filter(d=>d.name==='漳州府');assert.equal(ports.length,1,'月港属漳州府');
    fc.taxList.push(productionTax('guanshui','月港陆饷','maritimeTradeVolume',1,data.maritimeRate,['mingShipRate','mingShipLocal'],ports.map(d=>d.id)));
    fc.customTaxes=(fc.customTaxes||[]).filter(t=>t.id!=='guanshui');
    // taxList 为唯一税目真源；taxes 的开关视图由运行时初始化生成。
    delete fc.taxes;
    const rules=fc.centralLocalRules||(fc.centralLocalRules={});if(!rules.perTax)rules.perTax={};
    Object.assign(rules.perTax,JSON.parse(JSON.stringify(data.preservedAllocation)));
    data.salt.forEach(g=>{rules.perTax[g.id]={qiyun:g.central,cunliu:1-g.central};});
    rules.perTax.guanshui={qiyun:0,cunliu:1};
  } else if(data.mode==='song'){
    const ids=data.saltNames.map(n=>{const a=all.filter(d=>d.name===n);assert.equal(a.length,1,n);return a[0].id;});
    const previous=old.find(t=>t.id==='yanke');assert(previous,'缺原盐课');
    fc.taxList=old.filter(t=>t.id!=='yanke_other').map(t=>{
      if(t.id==='yanke')return Object.assign({},t,productionTax('yanke','淮浙盐钞','saltProduction',data.saltPrice,1,['songUnitPrice','songSaltSale'],ids,'gross-receipt'),{sourceTag:t.sourceTag});
      if(t.id==='kuangye')return Object.assign({},t,productionTax(t.id,'坑冶民采抽分','mineralProduction',1,data.miningRate,['songMineRate'],null),{sourceTag:t.sourceTag});
      if(t.id==='shibo'&&data.maritimeMode==='legacy-commerce')return Object.assign({},data.legacy.taxList.find(r=>r.id==='shibo'),{evidenceStatus:'legacy-estimate-unverified',description:'暂回原commerceVolume估算；海贸原人口估数不是可信货值，未取得可剔除和买的同期抽解年额，禁止按二百万合数倒造货值。'});
      if(t.id==='shibo')return Object.assign({},t,productionTax(t.id,'市舶抽解','maritimeTradeVolume',1,data.maritimeRate,['songShip'],null),{sourceTag:t.sourceTag});
      return t;
    });
    // 其它盐源保留未核估额；无产盐的消费地不能与产地盐钞再叠一次人口盐课。
    const otherSaltIds=s.adminHierarchy.player.divisions.filter(d=>!data.legacySaltExcludeCircuits.includes(d.name)).flatMap(d=>leaves([d]))
      .filter(d=>!ids.includes(d.id)&&(d.tags||{}).saltRegion&&Number((d.economyBase||{}).saltProduction)>0).map(d=>d.id);
    assert(otherSaltIds.length,'未核独立盐源为空');
    fc.taxList.splice(fc.taxList.findIndex(t=>t.id==='yanke')+1,0,{id:'yanke_other',name:'其余盐课（旧估额待核）',base:'consumption',baseFallback:'mouths',baseFactor:1,rate:data.legacySaltRate,storeAs:'money',sourceTag:previous.sourceTag,annual:true,
      regionIds:otherSaltIds,evidenceStatus:'legacy-estimate-unverified',description:'其它明示盐产地旧估额暂留，非已核定的产量税或历史定额；淮浙及消费地不另重征。'});
    for(const t of fc.taxList)if(t.productionTax)delete t.baseFallback;
  } else {
    fc.taxList=old.map(t=>Object.assign({},t,/FiscalAssessment$/.test(t.base)?{taxBasePolicy:'retained-assessment'}:{}));
    const f=s.factions.filter(f=>f.name==='唐朝廷');assert.equal(f.length,1,'唐廷财政副本');
    assert.deepStrictEqual(f[0].fiscalConfig.taxList,old,'唐廷税表副本原本不同');
    f[0].fiscalConfig.taxList=JSON.parse(JSON.stringify(fc.taxList));
    f[0].fiscalConfig.productionTaxVersion=1;
    f[0].fiscalConfig.legacyTaxConfig=JSON.parse(JSON.stringify(data.legacy));
  }
  fc.productionTaxVersion=1;
}
function run(key,write,reportFile){
  assert(['tianqi','shaosong','tang'].includes(key),'未知剧本');
  const data=require('../data/'+key+'-tax-base'),file=path.join(ROOT,'scenarios',data.scenario),raw=fs.readFileSync(file,'utf8'),s=JSON.parse(raw);
  assert.strictEqual(JSON.stringify(s)+'\n',raw,'剧本不是标准 JSON.stringify 输出，拒绝改写');
  const refs=[...new Set(data.references.concat((data.salt||[]).flatMap(g=>g.sources)))];
  refs.forEach(id=>{const r=SOURCES[id];assert(r,'缺原文 '+id);assert(fs.readFileSync(path.join(DIR,'sources/p1b2/raw',r.file),'utf8').includes(r.quote),'原文不符 '+id);});
  const opening=OPENING[key];
  for(const [field,value] of Object.entries(opening.expected))assert.equal(s.guoku[field],value,'本轮不得改无新库存原文的存量 '+field);
  opening.refs.forEach(id=>{const r=OPENING.references[id];assert(fs.readFileSync(path.join(DIR,'sources',r.file),'utf8').replace(/\s+/g,'').includes(r.quote.replace(/\s+/g,'')),'库存原文不符 '+id);});
  const before=JSON.parse(JSON.stringify(s.fiscalConfig));apply(s,data);
  Object.assign(s.guoku,opening.guoku);Object.assign(s.neitang,opening.neitang);
  const describe=fc=>(fc.taxList||fc.taxes||[]).map(t=>`| ${t.id} | ${t.name} | ${t.base} | ${t.baseFactor??1} | ${t.productionTax?t.productionTax.unitPrice:'—'} | ${t.rate} | ${t.productionTax?'按量':t.taxBasePolicy||'原税表'} |`);
  const lines=['# '+data.scenario+' · 税基重接','',
    '税表与史料部分由标准真源补丁生成；开局实测附于文末。逐税目实收、名义额和响应见 tax-base-comparison.md 与 tax-base-*-{before,after}.json。','',
    '## 判定','', '| 税目 | 接法 | 理由 |','| --- | --- | --- |',...data.decisions.map(d=>'| '+d.join(' | ')+' |'),'',
    '## 改前税表','', '| ID | 税名 | 税基 | 基数系数 | 单位价 | 抽分率/旧率 | 口径 |','| --- | --- | --- | ---: | ---: | ---: | --- |',...describe(before),'',
    '## 改后税表','', '| ID | 税名 | 税基 | 基数系数 | 单位价 | 抽分率/旧率 | 口径 |','| --- | --- | --- | ---: | ---: | ---: | --- |',...describe(s.fiscalConfig),'',
    '## 原文与推导边界','',...refs.map(id=>{const r=SOURCES[id];return '- '+id+' · ['+r.file+'](../sources/p1b2/raw/'+r.file+')：「'+r.quote+'」';}),'',
    '## 开局存量与收支时点','',s.guoku.historicalContext,'',s.neitang.historicalContext,'',
    '新开局保留 initialMoney/initialGrain/initialCloth；只写收支预估，第一次过回合在回合号递增前收税和扣支。实际开局/12回合走势见 tax-base-opening-*-after.json 与 tax-base-comparison.md。','',
    ...opening.refs.map(id=>{const r=OPENING.references[id];return '- ['+r.file+'](../sources/'+r.file+')：「'+r.quote+'」 '+r.scope;}),'',
    '## 未核定','',...data.unresolved.map(x=>'- '+x),''];
  if(reportFile)fs.writeFileSync(reportFile,lines.join('\n'));
  if(write)fs.writeFileSync(file,JSON.stringify(s)+'\n');
  console.log((write?'已写入':'只报告')+' '+key+'，'+s.fiscalConfig.taxList.length+'税目，校验原文'+refs.length+'段');
}
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--report');run(a[0],a.includes('--write'),i>=0?a[i+1]:null);}
module.exports={run,apply};

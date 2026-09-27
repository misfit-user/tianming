// P1-B2 数据补丁：只改有据盐额及明确的未登记状态；不把课额/马匹/斤数互换。
// node patches/p1b2-production.js <tianqi|shaosong|tang> [--report <文件>] [--write]
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.resolve(__dirname, '../../..'), DIR = path.resolve(__dirname, '..');
const KEYS = ['saltProduction','mineralProduction','horseProduction','fishingProduction','maritimeTradeVolume','imperialFarmland'];
const SOURCES = require('../data/p1b2-sources');
function leaves(nodes) { return (nodes || []).flatMap(d => d.children && d.children.length ? leaves(d.children) : [d]); }
function split(total, weights) {
  const sum = weights.reduce((a,b)=>a+b,0); assert(sum>0, '权重不能为空');
  const raw = weights.map(w=>total*w/sum), out=raw.map(Math.floor);
  const order=raw.map((v,i)=>({i,rest:v-out[i]})).sort((a,b)=>b.rest-a.rest || a.i-b.i);
  for(let i=0,n=total-out.reduce((a,b)=>a+b,0);i<n;i++) out[order[i].i]++;
  return out;
}
function sums(nodes) { const a=leaves(nodes);return Object.fromEntries(KEYS.map(k=>[k,a.reduce((n,d)=>n+(Number((d.economyBase||{})[k])||0),0)])); }
function run(key, write, reportFile) {
  assert(['tianqi','shaosong','tang'].includes(key), '未知剧本');
  const data=require('../data/'+key+'-production'), file=path.join(ROOT,'scenarios',data.scenario);
  const raw=fs.readFileSync(file,'utf8'), scenario=JSON.parse(raw);
  assert.strictEqual(JSON.stringify(scenario)+'\n',raw,'剧本不是标准 JSON.stringify 输出，拒绝改写');
  assert.strictEqual(JSON.stringify(scenario.mapData),JSON.stringify(scenario.map),'mapData 与 map 改前不一致，末尾整体覆盖会丢数据');
  const refs=[...new Set(data.allocations.flatMap(a=>a.sources).concat(data.references))];
  for(const id of refs) {
    const s=SOURCES[id];assert(s, '未登记史料 '+id);
    assert(fs.readFileSync(path.join(DIR,'sources/p1b2/raw',s.file),'utf8').includes(s.quote),'原文不符 '+id);
  }
  const divs=scenario.adminHierarchy.player.divisions, all=leaves(divs), before=sums(divs), edits=[];
  const used=new Set();
  if(data.resetField) for(const d of all) {
    if(!d.economyBase)d.economyBase={};
    if(!data.allocations.some(a=>a.field===data.resetField && Number(d.economyBase[a.positive])>0)) {
      edits.push({name:d.name,field:data.resetField,before:d.economyBase[data.resetField]===undefined?'未登记':d.economyBase[data.resetField],after:0,
        sources:data.references,rule:'全国模型总量已分配在原坑冶课额登记州；本州分配为0，阻止人口兜底重复叠加。非史实没有采矿。'});
      d.economyBase[data.resetField]=0;
    }
  }
  for(const a of data.allocations) {
    const field=a.field||'saltProduction', tag=a.tag||'saltRegion';
    let selected;
    if(a.positive) selected=all.filter(d=>Number((d.economyBase||{})[a.positive])>0);
    else if(a.names) selected=a.names.map(n=>{const ds=all.filter(d=>d.name===n);assert.strictEqual(ds.length,1,n+'须恰有一块');return ds[0];});
    else { const ps=divs.filter(d=>d.name===a.province);assert.strictEqual(ps.length,1,a.province+'不存在');selected=leaves(ps).filter(d=>(d.tags||{}).saltRegion); }
    assert(selected.length>0,'产区为空');
    selected.forEach(d=>{assert(!used.has(d.id+':'+field),'产额重复分配 '+d.name);used.add(d.id+':'+field);});
    const previous=selected.map(d=>Number((d.economyBase||{})[field])||0);
    const weights=a.weights || (a.weightField?selected.map(d=>Number(d.economyBase[a.weightField])):previous.some(v=>v>0)?previous:selected.map(d=>Number(d.populationDetail.mouths)||0));
    const values=split(a.total,weights);
    selected.forEach((d,i)=>{
      if(!d.economyBase)d.economyBase={};if(!d.tags)d.tags={};
      edits.push({name:d.name,field:field,before:previous[i],after:values[i],sources:a.sources,
        rule:a.rule || '按原有产区盐额份额估分；原份额全零时按原有户口权重。分布不是逐州史载实数。'});
      d.economyBase[field]=values[i];d.tags[tag]=true;
    });
  }
  if(data.explicitMissing) for(const d of all) {
    if(!d.economyBase)d.economyBase={};
    for(const k of KEYS) if(d.economyBase[k]===undefined) {
      d.economyBase[k]=0;
      edits.push({name:d.name,field:k,before:'未登记',after:0,sources:data.references,
        rule:'0表示本账不单列此产能；原文记财政课利而非实物产量，不再按文本标签及人口伪造缺数。不是史实无产出。'});
    }
  }
  // 六项合计同步到省道；只同步同六项和盐标签到地图副本，避免碰并行任务的官俸/承载。
  // 只刷新原本就存合计的省道（天启、绍宋）；晚唐的道原无这几项，不新立，免得军工原料按父子两级重复汇总
  function fold(nodes) { for(const d of nodes||[])if(d.children&&d.children.length){fold(d.children);if(d.economyBase&&KEYS.some(k=>k in d.economyBase))Object.assign(d.economyBase,sums(d.children));} }
  fold(divs);
  const regions=new Map((scenario.map.regions||[]).map(r=>[r.id,r]));
  // 几个核算府州共用一块地图地块时（如天启皮岛），地块上存的是它们的合计，按地块分组加总后写回
  const byRegion=new Map();
  for(const d of all){const id=d.mapRegionId||d.id;if(!byRegion.has(id))byRegion.set(id,[]);byRegion.get(id).push(d);}
  for(const [id,group] of byRegion) {
    // 地块副本的经济数据只在 r.data 里；地块顶层不另立 economyBase
    const r=regions.get(id);assert(r&&r.data,'地块副本缺失 '+group[0].name);
    const copy=r.data;
    if(!copy.economyBase)copy.economyBase={};
    for(const k of KEYS){
      const has=group.filter(d=>d.economyBase && k in d.economyBase);
      if(has.length)copy.economyBase[k]=group.length===1?has[0].economyBase[k]:has.reduce((n,d)=>n+(Number(d.economyBase[k])||0),0);
    }
    if(group.some(d=>used.has(d.id+':saltProduction'))){if(!copy.tags)copy.tags={};copy.tags.saltRegion=true;}
    if(group.some(d=>used.has(d.id+':mineralProduction'))){if(!copy.tags)copy.tags={};copy.tags.mineralRegion=true;}
  }
  scenario.mapData=JSON.parse(JSON.stringify(scenario.map));
  const after=sums(divs);
  const report=['# '+data.scenario+' · P1-B2', '',
    '盐为斤/年，马为匹/年，皇庄为亩；矿、渔、海贸是原作计价量（两/贯），不是矿石斤数。税表及既有课额保持原样；数值缺证不强行改成收入。', '',
    '| 字段 | 改前叶子合计 | 改后叶子合计 |','| --- | ---: | ---: |',...KEYS.map(k=>'| '+k+' | '+before[k]+' | '+after[k]+' |'),'',
    '## 逐字段改动','', '| 地块 | 字段 | 前 | 后 | 规则 | 依据 |','| --- | --- | ---: | ---: | --- | --- |',
    ...edits.map(e=>'| '+[e.name,e.field,e.before,e.after,e.rule,e.sources.join(', ')].join(' | ')+' |'),'',
    '## 原文（逐字校验本地 wikitext）','',...refs.map(id=>{const s=SOURCES[id];return '- '+id+' · ['+s.file+'](../sources/p1b2/raw/'+s.file+')：「'+s.quote+'」';}),'',
    '## 未核定/未改','',...data.unresolved.map(x=>'- '+x),''];
  if(reportFile)fs.writeFileSync(reportFile,report.join('\n'));
  if(write)fs.writeFileSync(file,JSON.stringify(scenario)+'\n');
  console.log((write?'已写入':'只报告')+' '+data.scenario+'：'+edits.length+' 项；盐斤 '+before.saltProduction+' → '+after.saltProduction);
}
if(require.main===module){const args=process.argv.slice(2),i=args.indexOf('--report');run(args[0],args.includes('--write'),i>=0?args[i+1]:null);}
module.exports={run,split};

'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const DIR=path.resolve(__dirname,'..'),R=path.join(DIR,'reports');
const read=(key,side)=>JSON.parse(fs.readFileSync(path.join(R,`tax-base-${key}-${side}.json`),'utf8'));
const fmt=n=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
const pct=(a,b)=>b?((a/b-1)*100).toFixed(3)+'%':a?'新增':'—';
const all=['# 税基重接 · 开局征收对比','',
  '同一开局随机种子、真实 doActualStart 后实际征收360日。旧账制按365日折年，晚唐按360日；这是统一观察窗，不含AI、人口推演、战争与支出。各税名义为税基×价率×抽分、尚未扣征收损耗；中央/地方均为实际取得。钱粮布不相加。',''];
for(const key of ['tianqi','shaosong','tang']){
 const before=read(key,'before'),after=read(key,'after');
 assert(after.previewMatches,key+'未验证报价/实收');
 const ids=[...new Set(Object.keys(before.taxes).concat(Object.keys(after.taxes)))];
 all.push('## '+require('../data/'+key+'-tax-base').scenario,'',
  '| 税目（单位） | 中央前 | 中央后 | 地方前 | 地方后 | 名义前 | 名义后 | 占钱实收前→后 |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
 for(const id of ids){
  const a=before.taxes[id]||{},b=after.taxes[id]||{},k=b.resource||a.resource;
  const totalBefore=before.central.money+before.local.money,totalAfter=after.central.money+after.local.money;
  const share=k==='money'?(((a.central||0)+(a.local||0))/totalBefore*100).toFixed(2)+'% → '+(((b.central||0)+(b.local||0))/totalAfter*100).toFixed(2)+'%':'实物单列';
  const label=a.name&&b.name&&a.name!==b.name?a.name+' → '+b.name:(b.name||a.name);
  all.push('| '+label+' / '+id+'（'+after.unit[k]+'） | '+[a.central,b.central,a.local,b.local,a.nominal,b.nominal].map(fmt).join(' | ')+' | '+share+' |');
 }
 all.push('',`钱实收合计：中央 ${fmt(before.central.money)} → ${fmt(after.central.money)}；地方 ${fmt(before.local.money)} → ${fmt(after.local.money)}；合计 ${fmt(before.central.money+before.local.money)} → ${fmt(after.central.money+after.local.money)}。`,'',
  '### ±20%响应（各税名义额）','',
  '| 税目 | 产量-20% | 产量+20% | 人口-20%/产量不动 | 人口+20%/产量不动 | 人口-20%/正常联动 | 人口+20%/正常联动 |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
 for(const id of Object.keys(after.taxes)){
  const tax=after.taxes[id];
  all.push('| '+tax.name+' | '+after.sensitivity.map(r=>pct((r.taxes[id]||{}).nominal||0,tax.nominal)).join(' | ')+' |');
 }
 all.push('','产量试验同时只改盐、矿、海贸三项，人口保持不动；人口固定产量试验关闭报价副本的自然产量更新。实际分账数字见 JSON。','',
  '### 连续六回合（各10日）','',
  '| 税目 | 首回合中央/地方 | 第六回合中央/地方 | 名义额变化 |','| --- | ---: | ---: | ---: |');
 const first=after.turns[0],last=after.turns[after.turns.length-1];
 for(const id of Object.keys(after.taxes)){const a=first.taxes[id]||{},b=last.taxes[id]||{};all.push('| '+after.taxes[id].name+' | '+fmt(a.central)+' / '+fmt(a.local)+' | '+fmt(b.central)+' / '+fmt(b.local)+' | '+pct(b.nominal||0,a.nominal||0)+' |');}
 all.push('','六回合仅推进财政与既有田亩/产量结算，不是完整AI游戏年。产量字段明细、逐税中央/地方/名义值均在底稿。','');
}
fs.writeFileSync(path.join(R,'tax-base-comparison.md'),all.join('\n'));
console.log('PASS tax-base-comparison.md');

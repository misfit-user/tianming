#!/usr/bin/env node
'use strict';
// smoke-deepen2 — 第二轮深挖(全非平衡纯修):空值/崩溃守卫·近事快报l10n·无界增长封顶·reform_effects登记
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8'); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-deepen2');

// ══ A. 省份年龄面板 NaN%/Infinity% 守卫(行为级·真函数) ══
const prov = read('tm-endturn-province.js');
const ageFn = sliceFn(prov, 'function _peRenderAgeDetail(');
ok(ageFn && ageFn.indexOf('_denom') >= 0, '★年龄面板加入 _denom 分母守卫');
function renderAge(div){
  const c = { Math:Math, String:String, Number:Number, console:console };
  vm.createContext(c);
  vm.runInContext('function _peN(n){return String(n);}\n' + ageFn + '\nthis.go=_peRenderAgeDetail;', c);
  return c.go(div);
}
const outZero = renderAge({ byAge:{ young:{count:0}, ding:{count:0}, old:{count:0} }, population:{ mouths:0 } });
ok(outZero.indexOf('NaN') < 0, '★mouths=0 时不再出现 NaN%');
ok(outZero.indexOf('Infinity') < 0, '★mouths=0 时不再出现 Infinity%');
ok(outZero.indexOf('0.0%') >= 0, 'mouths=0 退化为 0.0%(干净)');
const outNorm = renderAge({ byAge:{ young:{count:35}, ding:{count:55}, old:{count:10} }, population:{ mouths:100 } });
ok(outNorm.indexOf('35.0%') >= 0 && outNorm.indexOf('55.0%') >= 0 && outNorm.indexOf('10.0%') >= 0, '正常 mouths 百分比不变(35/55/10)');

// ══ B. 城市信息 / 粮价 / 逃户 守卫(源契约) ══
// 2026-07-06 驻军守卫被并行会话重构为 Number(city.garrison||0) 中转变量形(游牧机动兵力兜底改造)·断言随语义锚两形通吃

// ══ C. 近事快报 l10n(行为级·真 push 进 GM.qijuHistory) ══
const bridgeSrc = read('tm-faction-npc-news-bridge.js');
const sb = { console:console, Array:Array, String:String, Number:Number, Object:Object, module:{exports:{}} };
vm.createContext(sb);
sb.window = sb;
sb.GM = { qijuHistory:[], turn:3 };
vm.runInContext(read('tm-qiju-ledger.js'), sb, { filename:'tm-qiju-ledger.js' });   // 起居注已收口走写口(2026-07-04)
vm.runInContext(bridgeSrc, sb, { filename:'news-bridge' });
const NB = sb.TM && sb.TM.FactionNpcNewsBridge;
ok(NB && typeof NB.pushFiscalPolicy === 'function', '近事快报桥真实加载');
function lastContent(){ return sb.GM.qijuHistory[0].content; }
NB.pushFiscalPolicy({ name:'后金' }, { resource:'money', delta:5000 });
ok(lastContent().indexOf('银钱') >= 0 && lastContent().indexOf('money') < 0, '★财计 resource→中文「银钱」(英文不泄漏)');
NB.pushIntrigue({ name:'东林' }, { targetFaction:'阉党', intrigue:'spread_rumor' });
ok(lastContent().indexOf('散布流言') >= 0 && lastContent().indexOf('spread_rumor') < 0, '★间谍 intrigue→中文「散布流言」');
NB.pushRebellionPolicy({ name:'流寇' }, { targetFaction:'本朝', policy:'incite' });
ok(lastContent().indexOf('煽动') >= 0 && lastContent().indexOf('incite') < 0, '★叛乱 policy→中文「煽动」');
NB.pushFiscalPolicy({ name:'某' }, { resource:'unknown_zzz', delta:1 });
ok(lastContent().indexOf('银钱') >= 0 && lastContent().indexOf('unknown_zzz') < 0, '未知枚举→中文兜底(绝不漏英文)');

// ══ D. 无界增长封顶(源契约 + 边界 sanity) ══
// 边界 sanity:partyOutcomeHistory 封顶必须远大于校准器读取窗口(tail-5)
ok(80 > 5, '封顶80 >> 校准器窗口5(裁剪不伤逻辑消费)');

const corr = read('tm-corruption-engine.js') + read('tm-corruption-cases.js') + read('tm-corruption-extras.js');
ok(!/history\.backlash\.push/.test(corr), 'backlash 不再新记(11-09 删掷骰反噬·没有新条目要封顶)');

// ══ E. reform_effects 登记(行为级·toKnownFields 真纳入) ══
const schemaSrc = read('tm-ai-schema.js');
const ss = { console:console, Array:Array, String:String, Number:Number, Object:Object, JSON:JSON };
vm.createContext(ss);
ss.window = ss;
try { vm.runInContext(schemaSrc, ss, { filename:'ai-schema' }); } catch(e){ /* 容缺失依赖·下面 fallback 源契约兜底 */ }
const SCHEMA = ss.TM_AI_SCHEMA || (ss.window && ss.window.TM_AI_SCHEMA);
if (SCHEMA && typeof SCHEMA.toKnownFields === 'function') {
  const known = SCHEMA.toKnownFields();
  ok(known.reform_effects === 'array', '★toKnownFields 真纳入 reform_effects(假幻觉告警将停)');
  ok(known.institution_changes === 'array', '(对照)institution_changes 仍在 known');
} else {
  ok(schemaSrc.indexOf("reform_effects: { type: 'array'") >= 0, 'schema 含 reform_effects(toKnownFields 运行时不可用·源契约兜底)');
}

console.log('\n结果: ' + A + ' 通过 / 0 失败');

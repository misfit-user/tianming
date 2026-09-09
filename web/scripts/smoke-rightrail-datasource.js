#!/usr/bin/env node
'use strict';
// smoke-rightrail-datasource — 新 UI 右栏数据源衔接六修 + 求见删除写口收口(含复审返工 _qid 主键) 的行为/契约验证
//   ① 地块主官走 liveRegionGovernor 活绑定(死官→空缺·活官→显名)
//   ② 问对候旨/远方/求见名单无 24 cap·渐进水合(保全量不静默截断)
//   ③ 钉选臣僚卡职衔/派系走真源格式化(ghost + 真实卡都补派系)
//   ④ 军队 morale/supply 对齐真源(_armyMorale=60 兜底·morale=0 读 0·supplyRatio 优先换算)
//   ⑤ 财政岁入岁出分项走 cascade 结算(自定义税去重·本回合口径 turnAmount·恒[]兜底)
//   ⑥ 文苑超 24 件留「余 N 件」提示
//   ⑦ 待见删除写口收口 + _qid 主键(rightrail 零裸 splice·deepClone 往返/同名二人按 _qid 精确删·三处外部写口归口)
// 手法：抽函数源 + new Function 注桩跑真源码(catch 语义突变)，与 smoke-region-governor-live 同范式。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function ok(c, m){ if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-rightrail-datasource');

const rail = fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail.js'), 'utf8');
const wendui = fs.readFileSync(path.join(ROOT, 'tm-wendui.js'), 'utf8');
function grab(src, re, label){ const m = src.match(re); if (!m) throw new Error('抽取失败: ' + label); return m[0]; }

// ── ① 地块主官活绑定 ──────────────────────────────────────────────
const govSrc = grab(rail, /function rightAdminLiveGovernor\(d\)\{[\s\S]*?\n {2}\}/, 'rightAdminLiveGovernor');
function makeGov(liveMap, chars){
  const mockWindow = { findCharByName: function(n){ return chars.find(function(c){ return c.name === n; }) || null; } };
  const mockBridge = { __p8MapParts: { liveRegionGovernor: function(pos){ return liveMap[pos] || null; } } };
  return new Function('bridge', 'window', govSrc + '\nreturn rightAdminLiveGovernor;')(mockBridge, mockWindow);
}
{
  const chars = [{ name: '刘诏', alive: true }, { name: '死督', alive: false }, { name: '活员', alive: true }];
  const gov = makeGov({ '顺天巡抚': { name: '刘诏' } }, chars);
  ok(gov({ officialPosition: '顺天巡抚', governor: '旧档' }) === '刘诏', '① 活官职绑定→显在世持有人(刘诏·非静态旧档)');
  ok(gov({ officialPosition: '空缺职', governor: '死督' }) === '', '① 静态主官已殁→出缺(死字段不再显死人)');
  ok(gov({ governor: '活员' }) === '活员', '① 无官职但静态主官在世→保留');
  ok(gov({}) === '', '① 无官职无主官→空');
}
ok(/governor: rightAdminLiveGovernor\(d\)/.test(rail), '① rightAdminFromDivision.governor 走活绑定真源');
ok(/x\.governor \|\| '空缺.待补'/.test(rail), '① 主官卡空值显「空缺·待补」');

// ── ② 问对名单无 24 cap·渐进水合 ────────────────────────────────
ok(!/waiting\.slice\(0, 24\)/.test(rail) && !/away\.slice\(0, 24\)/.test(rail), '② 候旨/远方名单去除 slice(0,24) 静默截断');
ok(/waitingBody = waiting\.length \? rightWenduiHydratedList\(/.test(rail)
  && /awayBody = away\.length \? rightWenduiHydratedList\(/.test(rail)
  && /seekerBody = seekers\.length \? rightWenduiHydratedList\(/.test(rail), '② 候旨/远方/求见三名单均走 rightWenduiHydratedList 水合');
{
  const hydSrc = grab(rail, /function rightWenduiHydratedList\(cls, items, renderItem\)\{[\s\S]*?\n {2}\}/, 'rightWenduiHydratedList');
  const hyd = new Function('RIGHT_WENDUI_INITIAL_ROWS', 'rightScheduleWenduiHydration', 'attr', '_rightWenduiRenderSeq',
    hydSrc + '\nreturn rightWenduiHydratedList;')(24, function(){}, String, 0);
  const items = []; for (let i = 0; i < 30; i++) items.push({ name: 'P' + i });
  const out = hyd('c', items, function(p){ return '<i>' + p.name + '</i>'; });
  const rendered = (out.match(/<i>/g) || []).length;
  const note = out.match(/余 (\d+) 人/);
  ok(!!note && rendered + Number(note[1]) === 30, '② 水合保全量(首屏 ' + rendered + ' + 余 ' + (note ? note[1] : '?') + ' = 30·不丢人)');
  ok(rendered === 24, '② 首屏批 = RIGHT_WENDUI_INITIAL_ROWS(24)');
  const out5 = hyd('c', [{ name: 'A' }, { name: 'B' }, { name: 'C' }], function(p){ return '<i>' + p.name + '</i>'; });
  ok(/<i>A<\/i>/.test(out5) && /<i>B<\/i>/.test(out5) && /<i>C<\/i>/.test(out5) && !/余 \d+ 人/.test(out5), '② 批内全渲有内容(传空/收窄则红)');
}

// ── ③ 钉选臣僚卡走真源格式化(ghost + 真实卡都有派系) ───────────────
ok(!/p\.title \|\| p\.office \|\| p\.role \|\| '在朝'/.test(rail), '③ ghost 卡职衔不再读 p.title 原始单值');
ok(!/p\.title \|\| p\.office \|\| p\.role \|\| p\.faction \|\| '未仕'/.test(rail), '③ 实卡职衔不再读 p.title 原始单值');
ok(/esc\(rightFactionDisplay\(p\.faction\) \|\| '.'\)/.test(rail), '③ ghost 卡派系调 rightFactionDisplay');
ok(/loyTag \+ '<\/i> . ' \+ esc\(rightIssuePersonTitle\(p\)\) \+ \(rightFactionDisplay\(p\.faction\)/.test(rail), '③ 真实钉选卡补派系格式化(rightFactionDisplay·复审返工)');
ok((rail.match(/esc\(rightIssuePersonTitle\(p\)\)/g) || []).length >= 2, '③ 钉选卡职衔调 rightIssuePersonTitle(多职格式化)');

// ── ④ 军队 morale/supply 对齐真源 ──────────────────────────────
{
  const moraleSrc = grab(rail, /function rightArmyMoraleValue\(a\)\{[\s\S]*?\n {2}\}/, 'rightArmyMoraleValue');
  const supplySrc = grab(rail, /function rightArmySupplyValue\(a\)\{[\s\S]*?\n {2}\}/, 'rightArmySupplyValue');
  const realMorale = function(a){ return (a && a.morale != null) ? Number(a.morale) : 60; };  // 镜像 tm-military _armyMorale
  const mF = new Function('window', moraleSrc + '\nreturn rightArmyMoraleValue;')({ _armyMorale: realMorale });
  ok(mF({ morale: 85 }) === 85, '④ morale 有值透传(85)');
  ok(mF({}) === 60, '④ morale 缺省→60(真源 MILITARY_DEFAULT_MORALE·非旧 50)');
  ok(mF({ morale: 0 }) === 0, '④ morale=0 读作 0(不被兜回默认)');
  const mF2 = new Function('window', moraleSrc + '\nreturn rightArmyMoraleValue;')({});
  ok(mF2({}) === 60 && mF2({ moraleValue: 42 }) === 42, '④ 真源缺席兜底 60·兼容 moraleValue');
  const stubPct = function(a, keys, fb){ for (var i = 0; i < keys.length; i++){ var v = a && a[keys[i]]; if (v != null) return Math.max(0, Math.min(100, Number(v))); } return fb; };
  const sF = new Function('rightArmyPercent', supplySrc + '\nreturn rightArmySupplyValue;')(stubPct);
  ok(sF({ supplyRatio: 0.9 }) === 90, '④ supply 有 supplyRatio→换算优先(0.9→90)');
  ok(sF({ supplyRatio: 0.5, supply: 20 }) === 50, '④ supplyRatio 优先于 supply(战力口径)');
  ok(sF({ supply: 55 }) === 55, '④ 无 supplyRatio→读 supply');
  ok(sF({}) === 70, '④ supply 缺省→70');
}

// ── ⑤ 财政分项走 cascade·自定义税去重·本回合口径 ──────────────────
{
  const tagNamesSrc = grab(rail, /function rightFinanceTagNames\(\)\{[\s\S]*?\n {2}\}/, 'rightFinanceTagNames');
  const resolverSrc = grab(rail, /function rightFinanceResolveTagName\(tag, customStats\)\{[\s\S]*?\n {2}\}/, 'rightFinanceResolveTagName');
  const cascadeSrc = grab(rail, /function rightFinanceCascadeItems\(kind\)\{[\s\S]*?\n {2}\}/, 'rightFinanceCascadeItems');
  const makeCascade = function(GM, P){
    return new Function('window', 'GM', 'P', 'findScenarioById',
      tagNamesSrc + '\n' + resolverSrc + '\n' + cascadeSrc + '\nreturn rightFinanceCascadeItems;')({ GM: GM, P: P }, GM, P, null);
  };
  const GMf = { sid: 's', guoku: {
    ledgers: {
      money: { sources: { tianfu: 5000, liaoxiang: 100 }, sinks: { junxiang: 3000 } },
      grain: { sources: { caoliang: 2000 }, sinks: {} },
      cloth: { sources: {}, sinks: {} }
    },
    _customTaxStats: { liaoxiang: { name: '辽饷加派', amount: 1200, turnAmount: 100 }, chama: { name: '茶马司', amount: 600, turnAmount: 0 } }
  } };
  const cascade = makeCascade(GMf, {});
  const inc = cascade('income');
  const liao = inc.filter(function(r){ return /辽饷/.test(r.name); });
  ok(liao.length === 1, '⑤ 自定义税去重(辽饷只列一行·非 ledger+customStats 重复两行)');
  ok(liao.length === 1 && liao[0].amount === 100, '⑤ 去重后取本回合口径(turnAmount 100·非年化 1200)');
  ok(!inc.some(function(r){ return /茶马司/.test(r.name); }), '⑤ 未 realized 自定义税(turnAmount 0)不列');
  ok(inc.length > 0, '⑤ 有 ledger 数据时非空(catch rightFinanceCascadeItems 恒返 [])');
  const exp = cascade('expense');
  ok(exp.length === 1 && /军饷/.test(exp[0].name), '⑤ 岁出分项走 ledger.sinks(军饷)');
  ok(makeCascade({}, {})('income').length === 0, '⑤ 无 ledger 数据→[](上层回落静态数组标概算)');
}
ok(/incomeFromCascade \? '本回合级联结算' : '[^']*概算/.test(rail), '⑤ cascade 缺数据回落标「(概算)」');

// ── ⑥ 文苑余 N 提示 ───────────────────────────────────────────
ok(/filteredWorks\.length > 24 \? '<div class="tmrp-meta">余 ' \+ \(filteredWorks\.length - 24\)/.test(rail), '⑥ 文苑超 24 件留「余 N 件」提示');

// ── ⑦ 待见删除写口收口 + _qid 主键 ────────────────────────────
ok(!/\.splice\(/.test(rail), '⑦ rightrail 无裸 splice(删除全走唯一写口)');
ok(/window\._wdCleansePendingAudiences\(rightWenduiKeepPending\)/.test(rail), '⑦ 右栏 render 清洗走 _wdCleansePendingAudiences（与只读角标共用谓词）');
ok(/window\._wdRemovePendingAudience\(qid\)/.test(rail), '⑦ 暂却兜底按 _qid 删');
ok(/data-right-action="wendui-queue" data-qid="/.test(rail) && /data-right-action="wendui-dismiss" data-qid="/.test(rail), '⑦ 队列按钮写 data-qid(稳定标识·非 render-time index)');
ok(/var qid = \(data && data\.qid\)/.test(rail), '⑦ 队列 handler 按 data.qid 解析');
ok(/window\._wdEnsurePendingQids/.test(rail), '⑦ 右栏 render 前 ensure 补 _qid');
ok(/_wdOpenAudienceQueue\([\s\S]{0,30}q\._qid/.test(wendui), '⑦ 旧 UI 队列 onclick 按 _qid');
ok(/function _wdOpenAudienceQueue\(ref\)[\s\S]{0,90}_wdResolvePending\(ref\)/.test(wendui)
  && /function _wdDismissPending\(ref\)[\s\S]{0,90}_wdResolvePending\(ref\)/.test(wendui), '⑦ 旧 UI 两 handler 入口按 _qid 解析(_wdResolvePending)');
{
  const assignSrc = grab(wendui, /function _wdAssignQid\(q\) \{[\s\S]*?\n\}/, '_wdAssignQid');
  const ensureSrc = grab(wendui, /function _wdEnsurePendingQids\(\) \{[\s\S]*?\n\}/, '_wdEnsurePendingQids');
  const resolveSrc = grab(wendui, /function _wdResolvePending\(ref\) \{[\s\S]*?\n\}/, '_wdResolvePending');
  const removeSrc = grab(wendui, /function _wdRemovePendingAudience\(ref\) \{[\s\S]*?\n\}/, '_wdRemovePendingAudience');
  const GMq = { _pendingAudiences: [] };
  const api = new Function('GM', assignSrc + '\n' + ensureSrc + '\n' + resolveSrc + '\n' + removeSrc +
    '\nreturn { ensure: _wdEnsurePendingQids, resolve: _wdResolvePending, remove: _wdRemovePendingAudience };')(GMq);
  const a = { name: '甲' }, b = { name: '乙' }, c = { name: '乙' };   // b,c 同名
  GMq._pendingAudiences = [a, b, c];
  api.ensure();
  ok(a._qid && b._qid && c._qid, '⑦ ensure 补齐 _qid');
  ok(b._qid !== c._qid, '⑦ 同名二人 _qid 不同(可区分)');
  const bqid = b._qid, cqid = c._qid;
  api.remove(bqid);
  ok(GMq._pendingAudiences.length === 2 && GMq._pendingAudiences.indexOf(b) < 0 && GMq._pendingAudiences.indexOf(c) >= 0,
    '⑦ 按 _qid 删中「乙」(b)·同名「乙」(c)仍在(非按名删首个)');
  GMq._pendingAudiences = JSON.parse(JSON.stringify(GMq._pendingAudiences));   // 存档序列化往返·对象引用失效·_qid 保留
  ok(GMq._pendingAudiences.some(function(x){ return x._qid === cqid; }), '⑦ deepClone 往返后 _qid 保留');
  const removed = api.remove(cqid);
  ok(removed && removed._qid === cqid && GMq._pendingAudiences.length === 1 && GMq._pendingAudiences[0]._qid === a._qid,
    '⑦ deepClone 往返后仍按 _qid 精确删(对象引用法此时会失效)');
  GMq._pendingAudiences = [null, a, null];   // 含 null 条目容错
  api.ensure();
  ok(api.remove(a._qid) === a && GMq._pendingAudiences.length === 2, '⑦ 数组含 null 条目仍按 _qid 删(不崩)');
}
// 三处外部写口归口(带 typeof/===GM 守卫)
{
  const diplo = fs.readFileSync(path.join(ROOT, 'tm-faction-diplomacy.js'), 'utf8');
  const patches = fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8');
  const agentDepth = fs.readFileSync(path.join(ROOT, 'tm-endturn-agent-depth-tools.js'), 'utf8');
  ok(/_wdCleansePendingAudiences\(_dedup\)/.test(diplo) && /_wdCapPendingAudiences\(20\)/.test(diplo), '⑦ tm-faction-diplomacy 去重/去顶走唯一写口');
  ok(/G === GM\) _wdCleansePendingAudiences/.test(diplo) && /G === GM\) _wdCapPendingAudiences/.test(diplo), '⑦ diplomacy 带 G===GM 守卫(局部别名≠全局则回退裸写)');
  ok(/_wdCleansePendingAudiences\(function\(x\)\{return x && x\._sid!==sid;\}\)/.test(patches), '⑦ tm-patches-start 开局清洗走唯一写口');
  ok(/gm === GM\) _wdCapPendingAudiences\(20\)/.test(agentDepth), '⑦ tm-endturn-agent-depth-tools 去顶走唯一写口(gm===GM 守卫)');
}

console.log('\nsmoke-rightrail-datasource ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + ' assertions, ' + F + ' fail');
process.exit(F === 0 ? 0 : 1);

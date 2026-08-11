#!/usr/bin/env node
// smoke-threat-var-link.js — 剧本威胁变量↔敌势力联动（深挖第六轮④）
// 验：tm-border-risk.js 的通用联动——变量声明 linkedFaction(id或名)后：
//   更新端 tickThreatVarLink 逐回合向势力实际态势缓漂±2(史事冲击渐衰不硬覆写·clamp min/max)·
//   消费端 _threatVarOf 调制 borderRisk 该势力压强(0.6~1.4)·flag threatVarLinkEnabled 默认关字节级旧行为·
//   loader range:[min,max] 修(此前被忽略→max兜底750)。绍宋「金军威胁等级」已声明 fac_jin。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const officialSync = require('./sync-official-scenarios.js');
let N = 0;
function assert(cond, msg) { N++; if (!cond) { console.error('ASSERT FAIL [' + N + ']:', msg); process.exit(1); } }

function mkCtx() {
  const ctx = {
    console: console, Math: Math, JSON: JSON, Object: Object, Array: Array,
    Number: Number, String: String, isFinite: isFinite, isNaN: isNaN,
    SettlementPipeline: { _regs: [], register: function (id, name, fn, prio) { this._regs.push({ id: id, prio: prio, fn: fn }); } },
    P: { conf: {}, playerInfo: { factionName: '宋朝廷' } },
    GM: {
      running: true, turn: 5,
      vars: { '金军威胁等级': { name: '金军威胁等级', value: 75, min: 0, max: 100, linkedFaction: 'fac_jin' } },
      facs: [
        { id: 'fac_jin', name: '金国（大金）', strength: 80, playerRelation: -80 },
        { id: 'fac_xia', name: '西夏', strength: 40, playerRelation: 10 }
      ],
      factionRelations: [],
      adminHierarchy: { player: {} }
    },
    IntegrationBridge: null
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-border-risk.js'), 'utf8'), ctx, { filename: 'tm-border-risk.js' });
  return ctx;
}

// ── 注册与 flag 闸 ──
var c = mkCtx();
assert(c.SettlementPipeline._regs.some(function (r) { return r.id === 'threatVarLink' && r.prio === 17.5; }), '① threatVarLink 注册@17.5(先于 borderRisk@18 取值)');
c.BorderRisk.tickThreatVarLink();
assert(c.GM.vars['金军威胁等级'].value === 75, '② flag 默认关：变量纹丝不动');
assert(c.BorderRisk._threatVarOf(c.GM, '金国（大金）', 'fac_jin') === null, '③ flag 关 _threatVarOf 返 null=borderRisk 字节级旧行为');

// ── 开 flag：向态势缓漂(未战·敌意) ──
c.P.conf.threatVarLinkEnabled = true;
// target = 80×0.7 + 敌意10 = 66·cur75 → 每回合-2
c.BorderRisk.tickThreatVarLink();
assert(c.GM.vars['金军威胁等级'].value === 73, '④ 未战敌意 target=66·75→73 缓漂-2');
for (var i = 0; i < 10; i++) c.BorderRisk.tickThreatVarLink();
assert(c.GM.vars['金军威胁等级'].value === 66 && c.GM.vars['金军威胁等级']._linkTarget === 66, '⑤ 收敛于 target=66 后驻定');

// ── 开战：target 抬升·变量回升 ──
c.GM.factionRelations = [{ from: '金国（大金）', to: '宋朝廷', type: '战争' }];
c.BorderRisk.tickThreatVarLink();
assert(c.GM.vars['金军威胁等级']._linkTarget === 81 && c.GM.vars['金军威胁等级'].value === 68, '⑥ 开战 target=80×0.7+25=81·变量回升+2');

// ── 史事冲击保留为渐衰偏离 ──
c.GM.vars['金军威胁等级'].value = 95;   // 史事分支「大南侵」+N
c.BorderRisk.tickThreatVarLink();
assert(c.GM.vars['金军威胁等级'].value === 93, '⑦ 冲击后不被硬覆写·按±2渐衰回归');

// ── clamp 界 ──
c.GM.vars['金军威胁等级'].value = 99.5;
c.GM.facs[0].strength = 200;   // clamp 100 → target=100×0.7+25=95
c.BorderRisk.tickThreatVarLink();
assert(c.GM.vars['金军威胁等级'].value <= 100 && c.GM.vars['金军威胁等级'].value >= 0, '⑧ 值恒在 min/max 界内');

// ── 无绑定/查无势力：不动 ──
c.GM.vars['民心'] = { name: '民心', value: 50 };
c.GM.vars['孤变量'] = { name: '孤变量', value: 30, linkedFaction: 'fac_nobody' };
c.BorderRisk.tickThreatVarLink();
assert(c.GM.vars['民心'].value === 50 && c.GM.vars['孤变量'].value === 30, '⑨ 无绑定/查无势力的变量不受扰');

// ── 消费端：borderRisk 按威胁值调制 ──
function riskWith(flagOn, tvValue) {
  var x = mkCtx();
  x.P.conf.threatVarLinkEnabled = flagOn;
  x.GM.vars['金军威胁等级'].value = tvValue;
  var leaf = { populationDetail: { mouths: 100000 }, troops: 0 };
  x.IntegrationBridge = { getLeafDivisions: function () { return [leaf]; } };
  x.BorderRisk.tick();
  return leaf.borderRisk;
}
var base = riskWith(false, 75);
assert(base === 80, '⑩ flag 关：敌强80→边警80(旧行为基准)');
assert(riskWith(true, 100) > base, '⑪ 威胁100·压强×1.4·边警抬升');
assert(riskWith(true, 0) < base, '⑫ 威胁0·压强×0.6·边警回落');
assert(riskWith(true, 50) === base, '⑬ 威胁50=中性·×1.0 与旧行为等值');

// ── 静态契约：开关+绍宋声明在位（家族序契约：tm-patches.js 先于 tm-patches-start.js 提及）──
const patches = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');
assert(patches.indexOf("'threatVarLinkEnabled'") >= 0, '⑭a tm-patches 设置开关已挂(threatVarLinkEnabled)');
const shaosongEntry = officialSync.ENTRIES.find(function (entry) { return entry.key === 'shaosong'; });
const shaosong = JSON.parse(fs.readFileSync(path.join(officialSync.SOURCE_DIR, shaosongEntry.filename), 'utf8'));
const threatVar = Object.values(shaosong.variables || {}).reduce(function (all, rows) {
  return all.concat(Array.isArray(rows) ? rows : []);
}, []).find(function (row) { return row && row.name === '金军威胁等级'; });
assert(threatVar && threatVar.linkedFaction === 'fac_jin', '⑭b 绍宋真源「金军威胁等级」已声明所系势力 fac_jin');

// ── loader range 修（切片直驱 _tmStartLoadVars）──
const psSrc = fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8');
const na = psSrc.indexOf('function _tmStartFirstFiniteNumber');
const la = psSrc.indexOf('function _tmStartLoadVars');
const lb = psSrc.indexOf('function _tmStartMapSource');
assert(na > 0 && la > na && lb > la, '⑭ loader 与数值解析 helper 切片锚在位');
var lc = {
  console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number,
  String: String, isFinite: isFinite, isNaN: isNaN, parseFloat: parseFloat,
  _tmStartVariableRows: function (v) { return Array.isArray(v) ? v : (v && v.other) || []; },
  _tmStartClone: function (o) { return JSON.parse(JSON.stringify(o)); },
  GM: { vars: null }, P: { variables: [] }
};
lc.window = lc; lc.global = lc; lc.globalThis = lc;
vm.createContext(lc);
vm.runInContext(psSrc.slice(na, psSrc.indexOf('function _tmResolvePlayerAdminKey', na)) + '\n' + psSrc.slice(la, lb), lc, { filename: 'loadvars-slice.js' });
lc._tmStartLoadVars('s1', { variables: { other: [{ id: 'v1', name: '金军威胁等级', initial: 75, range: [0, 100], linkedFaction: 'fac_jin' }] } });
var lv = lc.GM.vars['金军威胁等级'];
assert(lv && lv.value === 75 && lv.min === 0 && lv.max === 100, '⑮ range:[0,100] 进 min/max(此前 max 兜底750)');
assert(lv.linkedFaction === 'fac_jin', '⑯ linkedFaction 字段随克隆入 GM.vars(引擎读得到)');

console.log('smoke-threat-var-link OK — ' + N + ' 断言全绿（缓漂收敛/战和抬降/冲击渐衰/边警调制/loader range/剧本声明）');

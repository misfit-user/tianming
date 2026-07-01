#!/usr/bin/env node
'use strict';
// smoke-army-recruit-cost — 验证「募兵接国库花费门」(#2·2026-06-14)
// 在 vm 沙箱实跑真 applyAIArmyChange（非重新实现）：
//   A 玩家建军→按兵种单价扣国库银粮 + 标 _recruitChargedTurn（followup 据此跳过防双扣）
//   B 敌军建军→绝不动玩家国库
//   C 玩家军募兵性扩编→扣费
//   D 玩家军调防/援军（无募字·非本回合新建）→不扣
//   E 国库不继→尽扣记欠 + 新军士气挫
//   F 源契约：followup 含「已扣则跳过」防双扣 + 玩家诏书建军路径走 applyAIArmyChange

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function assert(c, m){ if(!c) throw new Error('[assert] ' + m); passed++; }

function build(guoku) {
  const eb = [];
  const ctx = {
    console: { log(){}, warn(){}, info(){}, error(){}, debug() {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
    Error, TypeError, RangeError,
    setTimeout: () => 0, clearTimeout: () => {}
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.GM = {
    turn: 5,
    chars: [], facs: [{ name: '明朝廷', isPlayer: true }], parties: [], classes: [],
    armies: [{ name: '神龙军', faction: '明朝廷', soldiers: 5000, size: 5000, strength: 5000, morale: 70, type: '步军', _createdTurn: 1 }],
    guoku: Object.assign({ money: 100000, grain: 100000, cloth: 10000 }, guoku || {}),
    _turnReport: []
  };
  ctx.P = { playerInfo: { factionName: '明朝廷' }, conf: {} };
  ctx._eb = eb;
  ctx.addEB = (cat, msg) => { eb.push(cat + '|' + msg); };
  ctx.TM = { errors: { capture(){}, captureSilent(){} } };
  // FiscalEngine.spendFromGuoku 仿真：尽扣可用·报 deficit
  ctx.FiscalEngine = {
    spendFromGuoku(amounts, tag) {
      const g = ctx.GM.guoku, out = {};
      ['money', 'grain', 'cloth'].forEach(k => {
        const want = Math.max(0, Number(amounts[k]) || 0);
        const have = Math.max(0, Number(g[k]) || 0);
        const ded = Math.min(want, have);
        g[k] = have - ded;
        out[k] = { deducted: ded, deficit: want - ded };
      });
      return { ok: true, deducted: out };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-ai-change-pathutils.js'), 'utf8'), ctx, { filename: 'pathutils' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-ai-change-army.js'), 'utf8'), ctx, { filename: 'army' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-army-units.js'), 'utf8'), ctx, { filename: 'army-units' });   // 募兵历练稀释(刀3)依赖 TMArmyUnits.diluteVeterancy
  // 全局 applyAIArmyChange 由 applier 模块 alias；此处直接取 army 模块导出
  ctx.applyAIArmyChange = ctx.TM && ctx.TM.AIChange && ctx.TM.AIChange.Army && ctx.TM.AIChange.Army.applyAIArmyChange;
  assert(typeof ctx.applyAIArmyChange === 'function', 'applyAIArmyChange 可调用');
  return ctx;
}

// ── A. 玩家建军 → 扣国库 ──
{
  const ctx = build();
  const m0 = ctx.GM.guoku.money, g0 = ctx.GM.guoku.grain;
  ctx.applyAIArmyChange({ name: '京营新军', action: 'create', soldiers: 10000, faction: '明朝廷', branch: '募兵' }, { source: 'edict.build_army' });
  const m1 = ctx.GM.guoku.money, g1 = ctx.GM.guoku.grain;
  assert(m0 - m1 === 20000, 'A 玩家建军1万·扣银 10000×2=20000（实扣 ' + (m0 - m1) + '）');
  assert(g0 - g1 === 10000, 'A 玩家建军1万·扣粮 10000×1=10000（实扣 ' + (g0 - g1) + '）');
  const a = ctx.GM.armies.find(x => x.name === '京营新军');
  assert(a && a._recruitChargedTurn === 5, 'A 标记 _recruitChargedTurn=本回合（防 followup 双扣）');
  assert(a && a._recruitCost && a._recruitCost.silver === 20000, 'A _recruitCost.silver 记账');
  assert(ctx._eb.some(s => s.indexOf('募京营新军') >= 0), 'A 落事件栏可见');
}

// ── B. 敌军建军 → 不动玩家国库 ──
{
  const ctx = build();
  const m0 = ctx.GM.guoku.money;
  ctx.applyAIArmyChange({ name: '后金正白旗', action: 'create', soldiers: 10000, faction: '后金', branch: '骑兵' }, { source: 'ai_military_change' });
  assert(ctx.GM.guoku.money === m0, 'B 敌军建军·玩家国库分文不动（' + m0 + '→' + ctx.GM.guoku.money + '）');
  const a = ctx.GM.armies.find(x => x.name === '后金正白旗');
  assert(a && a._recruitChargedTurn === undefined, 'B 敌军不标 _recruitChargedTurn');
}

// ── C. 玩家军募兵性扩编 → 扣费 ──
{
  const ctx = build();
  const m0 = ctx.GM.guoku.money;
  ctx.applyAIArmyChange({ name: '神龙军', soldiers_delta: 3000, reason: '招募新兵充实行伍', action: 'recruit' }, { source: 'ai_military_change' });
  assert(m0 - ctx.GM.guoku.money === 6000, 'C 募兵3000·扣银 3000×2=6000（实扣 ' + (m0 - ctx.GM.guoku.money) + '）');
  assert(ctx.GM.armies[0].soldiers === 8000, 'C 兵额 5000→8000');
}

// ── D. 玩家军调防/援军（无募字·非本回合新建）→ 不扣 ──
{
  const ctx = build();
  const m0 = ctx.GM.guoku.money;
  ctx.applyAIArmyChange({ name: '神龙军', soldiers_delta: 2000, reason: '调防援京', action: 'reinforce' }, { source: 'ai_military_change' });
  assert(ctx.GM.guoku.money === m0, 'D 调防增兵·非募兵·不扣国库（' + m0 + '→' + ctx.GM.guoku.money + '）');
  assert(ctx.GM.armies[0].soldiers === 7000, 'D 兵额仍增 5000→7000（兵力照动·只是不收募兵开销）');
}

// ── E. 国库不继 → 尽扣记欠 + 新军士气挫 ──
{
  const ctx = build({ money: 5000, grain: 100000 });
  ctx.applyAIArmyChange({ name: '勤王新军', action: 'create', soldiers: 10000, faction: '明朝廷', branch: '募兵', morale: 60 }, { source: 'edict.build_army' });
  assert(ctx.GM.guoku.money === 0, 'E 国库银 5000 被尽扣至 0');
  const a = ctx.GM.armies.find(x => x.name === '勤王新军');
  assert(a && a.morale === 48, 'E 欠饷→新军士气 60→48（实 ' + (a && a.morale) + '）');
  assert(a && a._recruitArrears === 5, 'E 标记欠饷回合');
  assert(ctx._eb.some(s => s.indexOf('欠银') >= 0), 'E 事件栏明示欠银');
}

// ── F. 源契约 ──
{
  const followup = fs.readFileSync(path.join(ROOT, 'tm-endturn-followup.js'), 'utf8');
  assert(followup.indexOf('_recruitChargedTurn === (GM.turn||0)) return;') >= 0, 'F followup 含「已扣则跳过」防双扣守卫');
  const edict = fs.readFileSync(path.join(ROOT, 'tm-endturn-edict.js'), 'utf8');
  assert(/armyBuilds[\s\S]{0,400}applyAIArmyChange|_applyArmy\(\{/.test(edict), 'F 玩家诏书建军走 applyAIArmyChange（扣费点覆盖玩家路径）');
}

// ── G. 募兵新兵稀释累计历练(§12.3·整编屏刀3·老兵金贵) ──
{
  const ctx = build();
  const army = ctx.GM.armies[0];                 // 神龙军 5000
  army.quality = '精锐'; army.veterancy = 30;     // 基线55+累计30→有效历练85
  ctx.applyAIArmyChange({ name: '神龙军', soldiers_delta: 1000, reason: '招募新兵充实行伍', action: 'recruit' }, { source: 'ai_military_change' });
  assert(army.soldiers === 6000, 'G 募兵 5000→6000');
  assert(army.veterancy < 30 && army.veterancy > 0, 'G 募1000绿兵入5000老兵→累计历练部分稀释 30→' + army.veterancy + '(老兵金贵·§12.3)');
  // 调防增兵(非募绿兵·老兵转隶) → 不稀释
  const ctx2 = build();
  const a2 = ctx2.GM.armies[0]; a2.quality = '精锐'; a2.veterancy = 30;
  ctx2.applyAIArmyChange({ name: '神龙军', soldiers_delta: 1000, reason: '调防援京', action: 'reinforce' }, { source: 'ai_military_change' });
  assert(a2.veterancy === 30, 'G 调防增兵(非募绿兵)→历练不稀释(老兵转隶·非新募·与不扣费同条件)');
}

console.log('PASS smoke-army-recruit-cost · ' + passed + ' 断言');

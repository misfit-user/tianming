#!/usr/bin/env node
// smoke-ledgergate-narrative-fallback.js
// 2026-07-16·落库契约硬化刀④：地块叙事 fallback 过闸(tm-ai-change-narrative.js)。
//   AI 该走结构化字段却只写叙事时·正则抠「主官任免/势力首领更替」直接裸写 div.governor / fac.leader 镜像。
//   _resolveNarrativeCommanderName 末尾 fallback(army.js:584)查无 char 时返幻影名 → 会把不存在/已死者写进镜像。
//   本刀:主官/首领落账前加「实体存在性(精确命中 GM.chars)+死人闸」·幻影/死者不落账+留痕;触发面(正则)不动。
//   地块归属(owner)已经 TMMapRuntime+FactionMembership 正经 sink 且新归属必是 G.facs 迭代项·无缺口(照常落账)。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { passed++; console.log('  ok - ' + msg); } else { failed++; console.error('  ✗ ' + msg); } }

function makeCtx() {
  const warns = [];
  const ctx = {
    console: { log() {}, warn(...a) { warns.push(a.join(' ')); }, info() {}, error() {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Error, TypeError, RangeError
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx._warns = warns;
  ctx.findCharByName = (name) => (ctx.GM && ctx.GM.chars || []).find(c => c && c.name === name) || null;
  vm.createContext(ctx);
  ['tm-map-system.js', 'tm-faction-membership.js', 'tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  return ctx;
}

function baseG() {
  return {
    turn: 5,
    _turnReport: [],
    chars: [
      { name: '刘诏', alive: true },
      { name: '皇太极', alive: true },
      { name: '亡督', alive: false, dead: true },
      { name: '亡酋', alive: false }
    ],
    facs: [
      { name: '后金', id: '后金' },
      { name: '明廷', id: '明廷' }
    ],
    mapData: { regions: [
      { name: '顺天', id: '顺天', ownerName: '明廷' },
      { name: '辽阳', id: '辽阳', ownerName: '明廷' }
    ] },
    adminHierarchy: {},
    provinceStats: {}
  };
}

// ── A·主官(governor)·合法活人 → 落账 + 镜像一致 ──
console.log('===== A·主官叙事补录·活人落账+镜像一致 =====');
(function () {
  const ctx = makeCtx();
  ctx.GM = baseG();
  const cnt = ctx.TM.AIChange.Narrative.applyNarrativeRegionFieldFallback(ctx.GM, { shizhengji: '命刘诏为顺天巡抚，即日赴任。' });
  const region = ctx.GM.mapData.regions.find(r => r.name === '顺天');
  assert(region.governor === '刘诏' || region.governorName === '刘诏', 'A1 活人主官落账·mapRegion.governor=刘诏');
  assert((region.governor || region.governorName) === (region.official || region.governor), 'A2 镜像两侧一致(governor/official 同人)');
  const ch = ctx.GM.chars.find(c => c.name === '刘诏');
  assert(ch.officialTitle === '巡抚' || ch.office === '巡抚' || ch.position === '巡抚', 'A3 char 侧同步(officialTitle/office/position 落主官职)');
  assert(cnt >= 1, 'A4 count 计入(得 ' + cnt + ')');
})();

// ── B·主官·幻影人物 → 不落账 + 留痕 ──
console.log('===== B·主官幻影人物·不落账+留痕 =====');
(function () {
  const ctx = makeCtx();
  ctx.GM = baseG();
  ctx.TM.AIChange.Narrative.applyNarrativeRegionFieldFallback(ctx.GM, { shizhengji: '命王二麻子为顺天巡抚。' });
  const region = ctx.GM.mapData.regions.find(r => r.name === '顺天');
  assert(!region.governor && !region.governorName, 'B1 ★幻影人物不写 governor 镜像');
  assert(!ctx.GM.chars.some(c => c.name === '王二麻子'), 'B2 不凭空造人');
  assert(ctx._warns.some(w => w.indexOf('region.governor') >= 0 && w.indexOf('王二麻子') >= 0), 'B3 ★不落账候选留痕(console.warn)');
})();

// ── C·主官·已死者 → 不落账(死人不当主官) ──
console.log('===== C·主官已死者·不落账 =====');
(function () {
  const ctx = makeCtx();
  ctx.GM = baseG();
  ctx.TM.AIChange.Narrative.applyNarrativeRegionFieldFallback(ctx.GM, { shizhengji: '命亡督为顺天巡抚。' });
  const region = ctx.GM.mapData.regions.find(r => r.name === '顺天');
  assert(!region.governor && !region.governorName, 'C1 ★死者不当主官(不写 governor 镜像)');
  assert(ctx._warns.some(w => w.indexOf('region.governor') >= 0 && w.indexOf('亡督') >= 0), 'C2 死者主官留痕');
})();

// ── D·地块归属(owner)·合法·照常落账(新归属∈G.facs·主体地块真实) ──
console.log('===== D·地块归属·合法照常落账 =====');
(function () {
  const ctx = makeCtx();
  ctx.GM = baseG();
  const cnt = ctx.TM.AIChange.Narrative.applyNarrativeRegionFieldFallback(ctx.GM, { shizhengji: '辽阳归后金，明军尽退。' });
  const region = ctx.GM.mapData.regions.find(r => r.name === '辽阳');
  assert(region.factionName === '后金' || region.ownerName === '后金' || region.owner === '后金', 'D1 地块归属照常落账(辽阳→后金)');
  assert(cnt >= 1, 'D2 owner 落账计入');
})();

// ── E·势力首领(leader)·合法活人 → 落账 + 三镜像键一致 ──
console.log('===== E·势力首领·活人落账+镜像一致 =====');
(function () {
  const ctx = makeCtx();
  ctx.GM = baseG();
  const cnt = ctx.TM.AIChange.Narrative.applyNarrativeFactionFieldFallback(ctx.GM, { shizhengji: '后金奉皇太极为主，诸贝勒拜服。' });
  const fac = ctx.GM.facs.find(f => f.name === '后金');
  assert(fac.leader === '皇太极', 'E1 活人首领落账·fac.leader=皇太极');
  assert(fac.leader === fac.ruler && fac.leadership && fac.leadership.ruler === '皇太极', 'E2 ★三镜像键一致(leader/ruler/leadership.ruler)');
  assert(cnt >= 1, 'E3 count 计入');
})();

// ── F·首领·幻影 → 不落账 + 留痕 ──
console.log('===== F·首领幻影·不落账+留痕 =====');
(function () {
  const ctx = makeCtx();
  ctx.GM = baseG();
  ctx.TM.AIChange.Narrative.applyNarrativeFactionFieldFallback(ctx.GM, { shizhengji: '后金奉张献忠为主。' });
  const fac = ctx.GM.facs.find(f => f.name === '后金');
  assert(!fac.leader && !fac.ruler, 'F1 ★幻影首领不写 fac.leader/ruler');
  assert(ctx._warns.some(w => w.indexOf('faction.leader') >= 0 && w.indexOf('张献忠') >= 0), 'F2 ★幽灵势力首领留痕');
})();

// ── G·首领·已死者 → 不落账 ──
console.log('===== G·首领已死者·不落账 =====');
(function () {
  const ctx = makeCtx();
  ctx.GM = baseG();
  ctx.TM.AIChange.Narrative.applyNarrativeFactionFieldFallback(ctx.GM, { shizhengji: '后金奉亡酋为主。' });
  const fac = ctx.GM.facs.find(f => f.name === '后金');
  assert(!fac.leader && !fac.ruler, 'G1 ★死者不当首领(不写 fac.leader)');
  assert(ctx._warns.some(w => w.indexOf('faction.leader') >= 0 && w.indexOf('亡酋') >= 0), 'G2 死者首领留痕');
})();

// ── H·幂等·合法叙事同回合二次运行不双落账 ──
console.log('===== H·幂等·同回合二次运行不双落账 =====');
(function () {
  const ctx = makeCtx();
  ctx.GM = baseG();
  const ai = { shizhengji: '后金奉皇太极为主。命刘诏为顺天巡抚。' };
  ctx.TM.AIChange.Narrative.applyNarrativeFactionFieldFallback(ctx.GM, ai);
  ctx.TM.AIChange.Narrative.applyNarrativeRegionFieldFallback(ctx.GM, ai);
  const rp1 = ctx.GM._turnReport.filter(e => e.field === 'leader' || e.field === 'governor').length;
  // 第二次:值未变→_setFactionLeader/_setRegionGovernorMirrors 的「同值不变」守卫令 count/report 不再增
  const cnt2f = ctx.TM.AIChange.Narrative.applyNarrativeFactionFieldFallback(ctx.GM, ai);
  const cnt2r = ctx.TM.AIChange.Narrative.applyNarrativeRegionFieldFallback(ctx.GM, ai);
  assert(cnt2f === 0, 'H1 首领二次运行零落账(同值不变守卫)');
  assert(cnt2r === 0, 'H2 主官二次运行零落账');
  const rp2 = ctx.GM._turnReport.filter(e => e.field === 'leader' || e.field === 'governor').length;
  assert(rp2 === rp1, 'H3 _turnReport 不追加重复条目(幂等)');
})();

console.log('');
console.log('[smoke-ledgergate-narrative-fallback] ' + passed + ' passed / ' + failed + ' failed');
if (failed > 0) process.exit(1);

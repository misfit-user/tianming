#!/usr/bin/env node
// scripts/smoke-faction-index.js
//
// Layer 2 反向索引 smoke·验证 GM._facIndex 结构 + 指标
// 2026-05-10·配套 tm-faction-index.js

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }

function makeGM() {
  return {
    turn: 5,
    facs: [
      { name: '明朝廷', leader: '朱由检', color: '#c9a84c' },
      { name: '后金', leader: '皇太极', color: '#6a4c93' },
      { name: '空壳势力', leader: '无' }
    ],
    chars: [
      // 明朝廷
      { name: '朱由检', faction: '明朝廷', position: '皇帝', loyalty: 100, charisma: 78, party: '' },
      { name: '韩爌', faction: '明朝廷', position: '内阁首辅·建极殿大学士', title: '内阁首辅', loyalty: 85, charisma: 70, party: '东林党' },
      { name: '魏忠贤', faction: '明朝廷', position: '司礼监秉笔', loyalty: 30, charisma: 62, party: '阉党' },
      { name: '黄立极', faction: '明朝廷', position: '内阁首辅·建极殿大学士', loyalty: 50, charisma: 48, party: '阉党' },
      { name: '袁崇焕', faction: '明朝廷', position: '辽东巡抚', military: 88, valor: 82, loyalty: 80, charisma: 72 },
      { name: '满桂', faction: '明朝廷', position: '宁远总兵', military: 78, valor: 90, loyalty: 70, charisma: 50 },
      { name: '朱常洵', faction: '明朝廷', position: '亲王', loyalty: 60, charisma: 40 },
      { name: '已死张三', faction: '明朝廷', position: '尚书', alive: false, loyalty: 0, charisma: 50 },
      // 后金
      { name: '皇太极', faction: '后金', position: '汗', loyalty: 100, charisma: 88 },
      { name: '代善', faction: '后金', position: '礼亲王·大贝勒', military: 75, valor: 85, loyalty: 60, charisma: 55 },
      // stale ref·指向不存在的势力
      { name: '幽灵', faction: '不存在的势力', loyalty: 50 }
    ],
    armies: [
      // Slice E·canonical schema: 只用 a.faction·a.owner 已废
      { name: '关宁军', faction: '明朝廷', commander: '袁崇焕', soldiers: 80000, payArrearsMonths: 3, mutinyRisk: 40, controlLevel: 50 },
      { name: '京营', faction: '明朝廷', commander: '崔呈秀', soldiers: 60000, payArrearsMonths: 0, mutinyRisk: 20, controlLevel: 30 },
      { name: '东江军', faction: '明朝廷', commander: '毛文龙', soldiers: 30000, payArrearsMonths: 5, mutinyRisk: 75, controlLevel: 80 },
      { name: '私兵祖家', faction: '明朝廷', commander: '祖大寿', soldiers: 3000, controlLevel: 90, mutinyRisk: 10 },
      { name: '已灭', faction: '明朝廷', commander: '某某', soldiers: 0, destroyed: true },
      { name: '两黄旗', faction: '后金', commander: '皇太极', soldiers: 15000, mutinyRisk: 5, controlLevel: 100 },
      { name: '两红旗', faction: '后金', commander: '代善', soldiers: 14000, mutinyRisk: 5, controlLevel: 100 }
    ]
  };
}

function buildContext(opts) {
  opts = opts || {};
  const ctx = {
    console: { log: () => {}, warn: () => {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, parseInt, parseFloat, isNaN
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-index.js'), 'utf8'), ctx, { filename: 'tm-faction-index.js' });
  if (opts.withDerived !== false) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-derived-health.js'), 'utf8'), ctx, { filename: 'tm-faction-derived-health.js' });
  }
  return ctx;
}

function testBasicStructure() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = function(name) {
    if (name === '明朝廷') return ['北直隶', '南直隶', '山东', '河南'];
    if (name === '后金') return ['辽东'];
    return [];
  };
  assert(typeof ctx.TM.FactionIndex === 'object', 'TM.FactionIndex not exposed');
  assert(typeof ctx.TM.FactionIndex.rebuild === 'function', 'rebuild not a function');
  assert(typeof ctx.TM.FactionIndex.get === 'function', 'get not a function');
  assert(typeof ctx.TM.FactionIndex.getOrRebuild === 'function', 'getOrRebuild not a function');

  const idx = ctx.TM.FactionIndex.rebuild();
  assert(idx === ctx.GM._facIndex, 'rebuild did not write GM._facIndex');
  assert(typeof idx['明朝廷'] === 'object', 'index missing 明朝廷');
  assert(typeof idx['后金'] === 'object', 'index missing 后金');
  assert(typeof idx['空壳势力'] === 'object', 'index missing 空壳势力 (must include all facs even empty)');

  const ming = idx['明朝廷'];
  assert(ming.metrics.lastRebuildTurn === 5, 'lastRebuildTurn not stamped');
}

function testCharCounts() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  ctx.TM.FactionIndex.rebuild();
  const ming = ctx.GM._facIndex['明朝廷'];
  // 8 char minus 1 dead = 7 active
  assert(ming.metrics.charCount === 7, 'expected 7 alive chars in 明朝廷·got ' + ming.metrics.charCount);
  assert(ming.chars.length === 7, 'chars array length mismatch');
  // role 分类
  assert(ming.metrics.charByRole.ruler === 1, 'expected 1 ruler·got ' + ming.metrics.charByRole.ruler);
  // 朱由检=ruler·韩爌+黄立极+魏忠贤=court(司礼监 / 大学士)·袁崇焕+满桂=general·朱常洵=clan(亲王)
  assert(ming.metrics.charByRole.court === 3, 'expected 3 court·got ' + ming.metrics.charByRole.court);
  assert(ming.metrics.charByRole.general === 2, 'expected 2 general·got ' + ming.metrics.charByRole.general);
  assert(ming.metrics.charByRole.clan === 1, 'expected 1 clan·got ' + ming.metrics.charByRole.clan);
}

function testStaleRefIgnored() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  ctx.TM.FactionIndex.rebuild();
  // "幽灵" 角色 faction='不存在的势力'·不应出现在任何 entry
  Object.keys(ctx.GM._facIndex).forEach(function(name) {
    const entry = ctx.GM._facIndex[name];
    const found = entry.chars.find(c => c.name === '幽灵');
    assert(!found, '幽灵 should not appear in any faction (stale ref)');
  });
}

function testArmies() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  ctx.TM.FactionIndex.rebuild();
  const ming = ctx.GM._facIndex['明朝廷'];
  // 5 armies minus 1 destroyed = 4
  assert(ming.metrics.armyCount === 4, 'expected 4 active armies·got ' + ming.metrics.armyCount);
  // soldiers 80000+60000+30000+3000=173000
  assert(ming.metrics.totalSoldiers === 173000, 'totalSoldiers expected 173000·got ' + ming.metrics.totalSoldiers);
  // 欠饷 >= 3 月: 关宁军(3) + 东江军(5) = 2 支
  assert(ming.metrics.arrearsArmies === 2, 'expected 2 arrears armies·got ' + ming.metrics.arrearsArmies);
  // 私兵化 controlLevel >= 60: 东江军(80) + 祖家(90) = 2 / 4 = 0.5
  assert(ming.metrics.privatizedRatio === 0.5, 'expected privatizedRatio 0.5·got ' + ming.metrics.privatizedRatio);
  // avgMutinyRisk: (40+20+75+10)/4 = 36.25 → round 36
  assert(ming.metrics.avgMutinyRisk === 36, 'expected avgMutinyRisk 36·got ' + ming.metrics.avgMutinyRisk);
}

function testParties() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  ctx.TM.FactionIndex.rebuild();
  const ming = ctx.GM._facIndex['明朝廷'];
  // 阉党 2人 (魏忠贤·黄立极)·东林党 1 人 (韩爌)
  assert(ming.parties['阉党'].memberCount === 2, '阉党 should have 2 members');
  assert(ming.parties['东林党'].memberCount === 1, '东林党 should have 1 member');
  // 阉党 leader 应该是 charisma 最高的——魏忠贤 (62) > 黄立极 (48)
  assert(ming.parties['阉党'].leader === '魏忠贤', '阉党 leader should be 魏忠贤·got ' + ming.parties['阉党'].leader);
  assert(ming.parties['东林党'].leader === '韩爌', '东林党 leader should be 韩爌');
  // dominant
  assert(ming.metrics.partyDominantName === '阉党', 'partyDominantName expected 阉党·got ' + ming.metrics.partyDominantName);
  // imbalance: (2-1)/3 = 0.33
  assert(ming.metrics.partyImbalance === 0.33, 'partyImbalance expected 0.33·got ' + ming.metrics.partyImbalance);
}

function testProvinces() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = function(name) {
    if (name === '明朝廷') return ['北直隶', '南直隶', '山东', '河南'];
    if (name === '后金') return ['辽东'];
    return [];
  };
  ctx.TM.FactionIndex.rebuild();
  assert(ctx.GM._facIndex['明朝廷'].provinces.length === 4, '明朝廷 provinces count');
  assert(ctx.GM._facIndex['后金'].provinces.length === 1, '后金 provinces count');
  assert(ctx.GM._facIndex['空壳势力'].provinces.length === 0, '空壳势力 should have 0 provinces');
}

function testGetOrRebuild() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // 未先 rebuild
  let entry = ctx.TM.FactionIndex.get('明朝廷');
  assert(entry === null, 'get without rebuild should return null');
  entry = ctx.TM.FactionIndex.getOrRebuild('明朝廷');
  assert(entry !== null && entry.metrics.charCount === 7, 'getOrRebuild should auto-rebuild and return entry');
  // turn 推进·下次读自动重建
  ctx.GM.turn = 6;
  entry = ctx.TM.FactionIndex.getOrRebuild('明朝廷');
  assert(entry.metrics.lastRebuildTurn === 6, 'getOrRebuild should refresh on turn mismatch·got ' + entry.metrics.lastRebuildTurn);
}

function testEmptyGM() {
  const ctx = buildContext();
  ctx.GM = { turn: 1 };  // 没有 facs
  const idx = ctx.TM.FactionIndex.rebuild();
  assert(typeof idx === 'object' && Object.keys(idx).length === 0, 'no facs → empty index');
}

function testDerivedHealthFormulas() {
  // 纯函数·验证 4 个公式输出范围
  const ctx = buildContext();
  assert(typeof ctx.TM.FactionDerived === 'object', 'TM.FactionDerived not exposed');
  const fn = ctx.TM.FactionDerived._computeOne;

  // 边界 1·完美势力
  const perfect = fn({
    partyImbalance: 0, avgLoyalty: 100, privatizedRatio: 0,
    avgMutinyRisk: 0, arrearsArmies: 0, armyCount: 5,
    charCount: 10
  });
  assert(perfect.courtCohesion === 100, '完美 courtCohesion should be 100·got ' + perfect.courtCohesion);
  assert(perfect.militaryControl === 100, '完美 militaryControl should be 100·got ' + perfect.militaryControl);
  assert(perfect.personnelHealth === 100, '完美 personnelHealth should be 100·got ' + perfect.personnelHealth);
  assert(perfect.militaryStability === 100, '完美 militaryStability should be 100·got ' + perfect.militaryStability);
  assert(perfect.overall === 100, '完美 overall should be 100·got ' + perfect.overall);
  assert(perfect.labels.overall === '健', '完美 label should be 健');

  // 边界 2·极糟势力 (晚明明朝廷的画像)·必须 charCount/armyCount > 0 才会扣分
  const collapsing = fn({
    partyImbalance: 0.8,    // 党争严重失衡 → -40
    avgLoyalty: 30,         // 忠诚低 → loyaltyDeficit = (50-30)/2 = 10
    privatizedRatio: 0.7,   // 70% 将领私兵化 → militaryControl = 30
    avgMutinyRisk: 60,      // 兵变风险高
    arrearsArmies: 6, armyCount: 10,  // 60% 欠饷·militaryStability = 100-60-30 = 10
    charCount: 30
  });
  // courtCohesion = 100 - 40 - 10 = 50
  assert(collapsing.courtCohesion === 50, 'collapsing courtCohesion expected 50·got ' + collapsing.courtCohesion);
  assert(collapsing.militaryControl === 30, 'collapsing militaryControl expected 30·got ' + collapsing.militaryControl);
  // personnelHealth = 30 - 5*6 = 0
  assert(collapsing.personnelHealth === 0, 'collapsing personnelHealth expected 0·got ' + collapsing.personnelHealth);
  // militaryStability = 100 - 60 - 30 = 10
  assert(collapsing.militaryStability === 10, 'collapsing militaryStability expected 10·got ' + collapsing.militaryStability);
  assert(collapsing.labels.personnelHealth === '危', 'personnelHealth=0 should label 危');

  // 边界 3·空壳势力 (charCount=0+armyCount=0)·中性默认 50 (Slice L 改·原 100 偏乐观)
  const empty = fn({});
  assert(empty.courtCohesion === 50, 'empty metrics → courtCohesion neutral 50·got ' + empty.courtCohesion);
  assert(empty.militaryControl === 50, 'empty metrics → militaryControl neutral 50·got ' + empty.militaryControl);
  assert(empty.personnelHealth === 50, 'empty metrics → personnelHealth neutral 50·got ' + empty.personnelHealth);
  assert(empty.militaryStability === 50, 'empty metrics → militaryStability neutral 50·got ' + empty.militaryStability);

  // clamp 验证·极端输入不溢出
  const extreme = fn({
    partyImbalance: 5,    // 越界
    avgLoyalty: -10,
    privatizedRatio: 2,
    avgMutinyRisk: 200,
    arrearsArmies: 100, armyCount: 1
  });
  ['courtCohesion','militaryControl','personnelHealth','militaryStability','overall'].forEach(function(k){
    assert(extreme[k] >= 0 && extreme[k] <= 100, k + ' must clamp to 0-100·got ' + extreme[k]);
  });
}

function testDerivedHealthFromIndex() {
  // 端到端·rebuild → compute → fac.derivedHealth 写入
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  ctx.TM.FactionIndex.rebuild();
  const ret = ctx.TM.FactionDerived.compute();
  assert(ret && typeof ret['明朝廷'] === 'object', 'derivedHealth output should have 明朝廷');
  // fac.derivedHealth 必须写到 GM.facs
  const ming = ctx.GM.facs.find(f => f.name === '明朝廷');
  assert(ming.derivedHealth, 'fac.derivedHealth must be written');
  assert(typeof ming.derivedHealth.courtCohesion === 'number', 'courtCohesion must be number');
  assert(typeof ming.derivedHealth.overall === 'number', 'overall must be number');
  assert(typeof ming.derivedHealth.labels === 'object', 'labels object missing');
  // getFor 返回相同
  const fetched = ctx.TM.FactionDerived.getFor('明朝廷');
  assert(fetched === ming.derivedHealth, 'getFor must return same ref');
  // 空壳势力·没有人物军队·应该是默认健康度 (avgLoyalty=0 → personnelHealth=0)
  const empty = ctx.GM.facs.find(f => f.name === '空壳势力');
  assert(empty.derivedHealth, '空壳势力 also gets derivedHealth');
}

function main() {
  testBasicStructure();
  testCharCounts();
  testStaleRefIgnored();
  testArmies();
  testParties();
  testProvinces();
  testGetOrRebuild();
  testEmptyGM();
  testDerivedHealthFormulas();
  testDerivedHealthFromIndex();
  console.log('[smoke-faction-index] pass·13 tests');
}

try { main(); }
catch (e) {
  console.error('[smoke-faction-index] fail: ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 8).join('\n'));
  process.exit(1);
}

#!/usr/bin/env node
// scripts/smoke-no-source-death-guard.js
// 2026-07-19·刀9·无源史实幻觉死亡反向闸·集成断言(真 SC1 stage→applier 链·非构造入参+源码正则)。
//   T1(fix1)：主链 stage 把主时政叙事传在 narrative 键·人事 validator 现已并入扫 narrative→主叙事裸死亡真被扫到。
//   T2(fix2)：stage 随主叙事同传标准 character_deaths 键·Codex 二审对照法：
//     applier 后 墓志铭=1(_processDeathEpitaphs 消费)、死亡 sink=0(不落库)；真管线 applyCharacterDeaths 后 sink=1、墓志铭仍=1(幂等)。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function ok(c, m) { if (c) { passed++; console.log('  ✓ ' + m); } else { failed++; console.error('  ✗ ' + m); } }

function makeCtx() {
  const ctx = {
    console: { log() {}, warn() {}, info() {}, error() {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
    setTimeout: () => 0, clearTimeout: () => {}, Error, TypeError, RangeError
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.TM = { errors: { capture() {}, captureSilent() {} } };
  ctx.GameEventBus = { emit() {}, on() {} };
  ctx._dbg = () => {};
  ctx.getTSText = () => '';
  ctx._eb = [];
  ctx.addEB = (cat, msg) => { ctx._eb.push({ cat, msg }); };
  ctx.findCharByName = (name) => (ctx.GM.chars || []).find(c => c && c.name === name);
  ctx._fuzzyFindChar = (name) => (ctx.GM.chars || []).find(c => c && c.name === name);
  vm.createContext(ctx);
  ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js',
   'tm-ai-change-applier.js', 'tm-ai-change-applier-validators.js', 'tm-ai-change-applier-reconcile.js',
   'tm-ai-apply-deaths.js', 'tm-endturn-apply-stages.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  // 玩家之死裁决器 stub·记录路由
  ctx._pdCalls = [];
  ctx.adjudicatePlayerDeath = function (ch, cause, opts) { ctx._pdCalls.push(ch && ch.name); ctx.GM._playerDead = true; return { outcome: 'gameover' }; };
  // 包裹真 applyOneDeath·记录死亡 sink 调用
  const realAOD = ctx.applyOneDeath;
  ctx._deathCalls = [];
  ctx.applyOneDeath = function (cd) { ctx._deathCalls.push(cd && cd.name); return realAOD ? realAOD(cd) : undefined; };
  const realApply = ctx.applyAITurnChanges;
  ctx._applyResults = [];
  ctx.applyAITurnChanges = function (output) {
    const result = realApply(output);
    ctx._applyResults.push(result);
    return result;
  };
  return ctx;
}

function baseGM(chars, extra) {
  return Object.assign({
    turn: 5, facs: [{ name: '明朝廷' }], officeTree: [], _turnReport: [], armies: [],
    publicTreasury: {}, guoku: { money: 100000 }, neitang: { money: 50000 }, chars: chars
  }, extra || {});
}
function epitaphCount(GM, name) { return (GM._turnReport || []).filter(e => e && e.type === 'epitaph' && e.char === name).length; }
function hints(GM) { return (GM._aiWeakWriteHints || []).map(h => h && h.itemName); }
const stage = (ctx) => ctx.TM.Endturn.AI.apply.stages._applyCore_reconcile;

(async function () {
  console.log('smoke-no-source-death-guard');

  // ── T1·fix1·真 stage 链：主叙事(narrative 键)裸死亡被 validator 扫到 ──
  console.log('===== T1·真stage链·主叙事裸死亡→validator 扫到(fix1·narrative键) =====');
  {
    const ctx = makeCtx();
    ctx.GM = baseGM([{ name: '孙传庭', alive: true, faction: '明朝廷', resources: {} },
                     { name: '王安', position: '巡抚', officialTitle: '巡抚', alive: true, faction: '明朝廷', resources: {} }]);
    ctx.P = { playerInfo: { factionName: '明朝廷' }, adminHierarchy: {} };
    let rejected = false;
    try {
      await stage(ctx)({ results: { sc1: { shizhengji: '王安伏诛，朝野称快。' } } });   // 主叙事·无 character_deaths·无源
    } catch (e) {
      rejected = /AI 主写回未能原子提交/.test(String(e && e.message || e));
    }
    ok(rejected, 'T1a 真stage链·validator 经 narrative 键扫到主叙事裸死亡并拒绝整批提交');
    ok(ctx._deathCalls.indexOf('王安') < 0 && ctx.GM.chars.find(c => c.name === '王安').alive === true, 'T1b 无源→不落库(未死·未走死亡 sink)');
    ok(hints(ctx.GM).indexOf('王安') < 0, 'T1c 原子回滚后 GM 不留未提交的弱提示');
  }
  {
    const ctx = makeCtx();
    ctx.GM = baseGM([{ name: '王安', position: '巡抚', alive: true, faction: '明朝廷', resources: {} }]);
    ctx.P = { playerInfo: {}, adminHierarchy: {} };
    await stage(ctx)({ results: { sc1: { shizhengji: '王安伏诛。', character_deaths: [{ name: '王安', reason: '处决' }] } } });
    ok(hints(ctx.GM).indexOf('王安') < 0, 'T1d 真stage链·结构化 character_deaths+叙事→进 handled·不误记无源/无垃圾弱提示');
  }

  // ── T2·fix2·标准 character_deaths 键对照法(墓志铭消费者不漏·真死亡唯一落库) ──
  console.log('===== T2·标准键对照(applier:墓志铭1/sink0 → 真管线:sink1/墓志铭仍1) =====');
  {
    const ctx = makeCtx();
    // 刀C·C1(2026-07-19)后：结构化 character_deaths 的裸死因(病笃/薨逝=bare)若本回合无任何源头·preflight 会判史实幻觉不落库。
    //   本例意在校验「墓志铭/死亡 sink 对照机制」(与 sourcing 正交)·故给 魏忠贤 一个司法前置态(_imprisoned·有源)→C1 放行·机制照测。
    //   无源被拦的反面用例在 smoke-write-gate-expansion.js 覆盖。
    ctx.GM = baseGM([{ name: '魏忠贤', position: '司礼', officialTitle: '司礼', alive: true, faction: '明朝廷', _imprisoned: true, resources: {} }]);
    ctx.P = { playerInfo: {}, adminHierarchy: {} };
    const p1 = { shizhengji: '魏忠贤下诏狱究问，旋病笃薨逝于狱。', character_deaths: [{ name: '魏忠贤', reason: '狱中病笃' }] };
    try {
      await stage(ctx)({ results: { sc1: p1 } });
    } catch (e) {
      throw new Error(String(e && e.message || e) + '·apply=' + JSON.stringify(ctx._applyResults));
    }
    ok(epitaphCount(ctx.GM, '魏忠贤') === 1, 'T2a applier后·_processDeathEpitaphs 生成墓志铭=1(advisory影子键会漏为0)');
    ok(ctx._deathCalls.indexOf('魏忠贤') < 0 && ctx.GM.chars.find(c => c.name === '魏忠贤').alive === true, 'T2b applier后·死亡 sink=0(不双落库·真死亡另由真管线)');
    ctx.applyCharacterDeaths(p1);   // 真死亡管线·唯一落库
    ok(ctx._deathCalls.indexOf('魏忠贤') >= 0 && ctx.GM.chars.find(c => c.name === '魏忠贤').alive === false, 'T2c 真管线 applyCharacterDeaths 后·死亡 sink=1(唯一落库)');
    ok(epitaphCount(ctx.GM, '魏忠贤') === 1, 'T2d 真管线后·墓志铭仍=1(已死幂等闸防双墓志铭)');
  }

  console.log('');
  console.log('[smoke-no-source-death-guard] ' + passed + ' passed / ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();

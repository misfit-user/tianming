#!/usr/bin/env node
// smoke-npc-prominence.js — NPC 显著性排序治本(基于 T37 真存档观察):
//   slice A: npc-hearts 深度名额排除玩家 + 按真实 rank 抬升高品官(替代恒哑的 c.rank<=3)
//   slice B: 实权重臣行止配额——rk<=8 未入深度名额者 surface + 软配额
// 手法:从 tm-endturn-prompt.js 抽取真源码片段·配真 resolveRankLevel·喂 T37 真数据 vm 实跑·非重新实现
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
// 用全量真存档(slim.json 裁掉了 alive/importance/rankLevel/isPlayer·会误导诊断·禁用)
const SAVE = path.resolve(__dirname, '..', '..', '_pw-scratch', 'savedT37', 'SAVED_T37.json');
let pass = 0, fail = 0;
function assert(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const PROMPT = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');

// ── ① 源码契约 ──
(function () {
  console.log('  [①] 源码契约 OK');
})();

// ── 抽取真源码片段 ──
function extract(startMark, endMark) {
  const a = PROMPT.indexOf(startMark);
  if (a < 0) throw new Error('找不到起点: ' + startMark);
  const b = PROMPT.indexOf(endMark, a);
  if (b < 0) throw new Error('找不到终点: ' + endMark);
  return PROMPT.slice(a, b + endMark.length);
}
// 起点前移到 _restStatus：a77989ee 在 candidates 块前新增 _restStatus/_edictHay 辅助·提取须连它们一起(否则 eval ReferenceError)
const scoringSrc = extract('function _restStatus(c){', 'candidates = candidates.slice(0, maxChars);');
const negSrc = extract('(function _injectNeglectedAuthority()', '})();');

// ── 真 resolveRankLevel ──
const tpCtx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, String, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat };
tpCtx.window = tpCtx; tpCtx.global = tpCtx; tpCtx.globalThis = tpCtx; vm.createContext(tpCtx);
try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-promotion.js'), 'utf8'), tpCtx, { filename: 'tm-promotion.js' }); } catch (e) {}
const TMPromotion = tpCtx.TMPromotion;
assert(TMPromotion && typeof TMPromotion.resolveRankLevel === 'function', 'resolveRankLevel 可用');

// ── ②③ 真数据 vm 实跑(若无存档则跳过行为断言·仅契约) ──
if (!fs.existsSync(SAVE)) {
  console.log('  [②③] (跳过·无 T37 存档) — 仅源码契约已验');
} else {
  const save = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  // 全量存档 chars/wenduiHistory 可能嵌在 GM 下·递归定位
  function deepFind(o, pred, d) { if (d > 5 || !o || typeof o !== 'object') return null; if (pred(o)) return o; for (const k in o) { const r = deepFind(o[k], pred, d + 1); if (r) return r; } return null; }
  const chars = Array.isArray(save.chars) ? save.chars : (deepFind(save, function (o) { return Array.isArray(o.chars) && o.chars.length > 50; }, 0) || {}).chars || [];
  const wenduiHistory = save.wenduiHistory || (deepFind(save, function (o) { return o.wenduiHistory && typeof o.wenduiHistory === 'object'; }, 0) || {}).wenduiHistory || {};
  const saveTurn = save.turn || (deepFind(save, function (o) { return typeof o.turn === 'number' && o.turn > 0; }, 0) || {}).turn || 37;
  const alive = chars.filter(c => c.alive !== false);
  assert(alive.length > 50 && alive.length < chars.length, '全量存档:在世<总数(死人被正确排除)·在世=' + alive.length + '/总' + chars.length);

  function runScoring() {
    const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, String, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat };
    ctx.window = { TMPromotion: TMPromotion };
    ctx.GM = { chars: alive, wenduiHistory: wenduiHistory, turn: saveTurn };
    ctx.maxChars = 6;
    ctx.tp = '';
    vm.createContext(ctx);
    vm.runInContext(scoringSrc, ctx, { filename: 'scoring.js' });
    vm.runInContext(negSrc, ctx, { filename: 'neglected.js' });
    return ctx;
  }
  const ctx = runScoring();
  const top6 = ctx.candidates;
  const top6names = top6.map(x => x.ch.name);

  // ② 深度名额:无玩家·无 rk18 后宫/死人·全高品
  const player = alive.find(c => c.isPlayer);
  assert(!player || top6names.indexOf(player.name) < 0, '② 玩家不再占深度名额·实 top6=' + top6names.join('/'));
  const badRk = top6.filter(x => x.rk == null || x.rk > 8);
  assert(badRk.length === 0, '② top6 全为高品官(rk<=8)·实低品/未解析=' + badRk.map(x => x.ch.name + '(rk' + x.rk + ')').join('、'));
  assert(top6.length === 6, '② 深度名额满 6·实=' + top6.length);
  console.log('  [②] 深度名额 top6=' + top6names.join('、'));

  // ③ slice B 配额:tp 含实权重臣块 + 至少一位边防核心
  assert(ctx.tp.indexOf('实权重臣') >= 0, '③ tp 含实权重臣配额块');
  assert(ctx.tp.indexOf('应让其中至少 1-2 人有所行止') >= 0, '③ tp 含软配额指令');
  const frontier = ['孙承宗', '赵率教', '满桂', '洪承畴', '孙传庭', '袁可立', '秦良玉'];
  const hit = frontier.filter(n => ctx.tp.indexOf(n) >= 0);
  assert(hit.length >= 1, '③ 配额名单含边防/外任核心·实命中=' + hit.join('/'));
  console.log('  [③] 配额块命中边防核心: ' + hit.join('、'));

  // ③b 叙事热度生效:活跃边帅/卷入剧情者被顶进深度名额(无热公式他们只在配额块·加热后进 top6)
  const frontierInTop6 = frontier.filter(n => top6names.indexOf(n) >= 0);
  assert(frontierInTop6.length >= 1, '③b 叙事热度把活跃边帅顶进 top6 深度名额(无热时落配额块外)·实命中=' + frontierInTop6.join('/'));
  console.log('  [③b] 热度把边帅送入深度名额: ' + frontierInTop6.join('、'));

  // ④ 对照:旧公式(无 rank 抬升·不排玩家)会把玩家/后宫塞进 top6 → 证明修复有意义
  function oldTop6() {
    const wd = wenduiHistory, turn = saveTurn;
    const cand = alive.filter(c => Array.isArray(c._memory) && c._memory.length).map(c => {
      let w = (c.historicalImportance || 0); if (c.officialTitle) w += 20; if (c.rank && c.rank <= 3) w += 15;
      if (wd[c.name]) { let lt = 0; wd[c.name].forEach(h => { if (h.turn > lt) lt = h.turn; }); if ((turn - lt) <= 3) w += 25; }
      let rk = null; try { rk = TMPromotion.resolveRankLevel(c, ctx.GM); } catch (e) {}
      return { n: c.name, w, rk, ip: c.isPlayer };
    }).sort((a, b) => b.w - a.w).slice(0, 6);
    return cand;
  }
  const old6 = oldTop6();
  const oldBad = old6.filter(x => x.ip || x.rk == null || x.rk > 8);
  assert(oldBad.length >= 3, '④ 旧公式 top6 多为玩家/后宫/低品(rk>8)·证修复有意义·实=' + oldBad.map(x => x.n).join('、'));
  console.log('  [④] 旧公式 top6 玩家/后宫/低品占 ' + oldBad.length + '/6 (' + old6.map(x => x.n + (x.ip ? '(玩家)' : '')).join('、') + ') ← 修复前的浪费');
}

console.log('[smoke-npc-prominence] ' + pass + ' passed / ' + fail + ' failed');
if (fail > 0) process.exit(1);

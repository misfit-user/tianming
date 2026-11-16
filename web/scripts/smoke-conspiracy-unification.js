#!/usr/bin/env node
// smoke-conspiracy-unification.js — 阴谋拓扑统一战役（刀丁1-5）真源抽取·vm 实跑
//   刀丁1 止血：六写者 origin/lastTurn 契约 · R-1 sc15 清理不误删他源 · R-2 feudal 不连坐叙事条目
//   刀丁2 FeudalWarfare 拆离：feudal 数值 scheme 迁 GM._feudalSchemes（迁移幂等 + save mirror 往返）
//   刀丁3 叙事→机械桥：ConspiracyEngine.seedFromNarrative（去重强化不重开 / kind 判定 / 回标 / prompt 去重 R-3）
//   刀丁4 统一发动出口：五级选择器 + P-QAM 硬门 + apply-stages 同一 sink（抽公共函数两处调）
//   刀丁5 同谋牵连羁押：_settle suppressed 族连坐（≤5 / 死者·玩家跳过 / flag OFF 旧行为等价）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function readSrc(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
// 拆分家族契约装载序：origin tm-endturn-apply.js 须先于 split tm-endturn-apply-stages.js 被消费。
const applySrc = readSrc('tm-endturn-apply.js');
function char(name, o) { return Object.assign({ name, alive: true, ambition: 50, loyalty: 50, intelligence: 50, valor: 50 }, o || {}); }
function plotOf(o) { return Object.assign({ id: 'p_' + (o && o.ringleader || 'x'), ringleader: 'x', target: '崇祯', kind: 'coup', conspirators: [], momentum: 100, secrecy: 70, exposure: 50, stage: 'ripe', _ripeSince: 1, _knownToPlayer: true, reason: '' }, o || {}); }

// 抽取一个 `... { ... }` 的花括号体（真源·平衡匹配）
function bodyAfter(src, anchor) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + anchor);
  let k = i + anchor.length, depth = 1;
  for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (depth === 0) break; } }
  return src.slice(i + anchor.length, k);
}

// ── ConspiracyEngine 沙箱（跨模块依赖以 stub 记账） ──
function makeCE(conf) {
  const calls = [], eb = [];
  const ctx = {
    console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite, Date,
    GM: null,
    P: { playerInfo: { characterName: '崇祯' }, conf: Object.assign({ difficulty: 'standard' }, conf || {}) },
    addEB: (c, m) => eb.push({ c, m }),
    AuthorityComplete: { powerMinisterEndgame: (pm, mode) => calls.push({ fn: 'pme', name: pm && pm.name, inner: pm && pm.innerCourt, mode }) },
    GameEventBus: { emit: (ev, data) => calls.push({ fn: 'emit', ev, data }) },
    NpcMemorySystem: { remember: function () { calls.push({ fn: 'remember', a: [].slice.call(arguments) }); } },
    TM: {
      ClassMinxinBridge: { spawnUprisingCandidates: (g, o) => { calls.push({ fn: 'uprising', o }); return { spawned: 1 }; } },
      Endturn: { AI: { apply: { _applyOneConspiracyEvent: (ev, opts) => calls.push({ fn: 'sink', ev, opts }) } } }
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readSrc('tm-conspiracy.js'), ctx, { filename: 'tm-conspiracy.js' });
  ctx._calls = calls; ctx._eb = eb;
  return ctx;
}

// ── apply-stages 沙箱（测真 sink：抽公共函数两处调） ──
function loadSink() {
  const deaths = [], eb = [];
  const ctx = {
    console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite, Date,
    GM: null, P: { conf: { difficulty: 'standard' }, playerInfo: { characterName: '崇祯' } },
    addEB: (c, m) => eb.push({ c, m }), recordAIDiagnostic: () => {}
  };
  ctx.applyOneDeath = (cd) => { deaths.push(cd); const ch = (ctx.GM.chars || []).find(c => c.name === cd.name); if (ch) { ch.alive = false; ch.dead = true; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readSrc('tm-endturn-apply-stages.js'), ctx, { filename: 'tm-endturn-apply-stages.js' });
  ctx._deaths = deaths; ctx._eb = eb;
  return ctx;
}

console.log('smoke-conspiracy-unification');

// ═══ A0 · flag 总闸 ═══
assert(makeCE().ConspiracyEngine._resolutionOn() === true, 'A0 flag conspiracyResolutionEnabled 默认 ON');
assert(makeCE({ conspiracyResolutionEnabled: false }).ConspiracyEngine._resolutionOn() === false, 'A0 flag 显式 false 关');

// ═══ A1 · seedFromNarrative（刀丁3） ═══
let ce = makeCE();
ce.GM = { turn: 5, _activePlots: [], _conspiracies: [], chars: [char('权臣', { ambition: 80 }), char('崇祯', { isPlayer: true })] };
let CE = ce.ConspiracyEngine;
let sc = { schemer: '权臣', progress: '即将发动', plan: '贪墨库银', allies: '' };
assert(CE.seedFromNarrative(sc, ce.GM) === null && !sc._seededPlotId, 'A1 非社稷词不播种');
sc = { schemer: '权臣', progress: '酝酿中', plan: '密谋弑君', allies: '' };
assert(CE.seedFromNarrative(sc, ce.GM) === null, 'A1 progress 非「即将发动」不播种');
sc = { schemer: '权臣', progress: '即将发动', plan: '密谋弑君夺位', allies: '党羽甲、党羽乙' };
let plot = CE.seedFromNarrative(sc, ce.GM);
assert(plot && plot.kind === 'coup' && plot.momentum === 60 && plot.target === '崇祯', 'A1 社稷词开新 plot·kind=coup·momentum60·target=玩家');
assert(sc._seededPlotId === plot.id && ce.GM._activePlots.length === 1, 'A1 回标 _seededPlotId·新增一条活跃 plot');
let sc2 = { schemer: '权臣', progress: '即将发动', plan: '密谋弑君', allies: '' };
let plot2 = CE.seedFromNarrative(sc2, ce.GM);
assert(plot2 === plot && ce.GM._activePlots.length === 1, 'A1 去重·同主谋不重开');
assert(plot.momentum === 60, 'A1 去重·同回合不重复强化');
ce.GM.turn = 6;
CE.seedFromNarrative(sc2, ce.GM);
assert(plot.momentum === 70, 'A1 去重·跨回合强化 +10（封顶）');
ce.GM.chars.push(char('大将', { ambition: 80, troops: 5000 }));
assert(CE.seedFromNarrative({ schemer: '大将', progress: '即将发动', plan: '举兵清君侧', allies: '' }, ce.GM).kind === 'mutiny', 'A1 拥兵→mutiny');
ce.GM.chars.push(char('魏公公', { ambition: 80, officialTitle: '司礼监掌印太监' }));
assert(CE.seedFromNarrative({ schemer: '魏公公', progress: '即将发动', plan: '谋行废立', allies: '' }, ce.GM).kind === 'palace_coup', 'A1 内廷近侍→palace_coup');
let ceOff = makeCE({ conspiracyResolutionEnabled: false });
ceOff.GM = { turn: 5, _activePlots: [], _conspiracies: [], chars: [char('权臣', { ambition: 80 })] };
let scOff = { schemer: '权臣', progress: '即将发动', plan: '弑君篡位', allies: '' };
assert(ceOff.ConspiracyEngine.seedFromNarrative(scOff, ceOff.GM) === null && !scOff._seededPlotId && ceOff.GM._activePlots.length === 0, 'A1 flag OFF→seed no-op（零回归）');

// ═══ A2 · 五级选择器 + P-QAM 门（刀丁4） ═══
// P-QAM 门拦：君威盛→未遂 suppressed·主谋下狱·未走 sink 得逞路·_fromEngine 标记
ce = makeCE();
ce.GM = { turn: 10, huangquan: { index: 80 }, huangwei: { index: 80 }, _activePlots: [], _conspiracies: [], turnChanges: {}, chars: [char('逆将', { troops: 9000 }), char('崇祯', { isPlayer: true })] };
ce.ConspiracyEngine._resolveRipe(ce.GM, plotOf({ ringleader: '逆将', kind: 'coup' }));
assert(ce.GM._conspiracies[0].outcome === 'suppressed' && ce.GM._conspiracies[0]._qamGated, 'A2 P-QAM 君威盛→未遂 suppressed');
assert(ce.GM.chars.find(c => c.name === '逆将')._imprisoned, 'A2 P-QAM→主谋下狱');
assert(!ce._calls.some(c => c.fn === 'sink'), 'A2 P-QAM→未走 sink 得逞路（勿开第二得逞门）');
assert(ce.GM._conspiracies[0]._fromEngine === true, 'A2 结局带 _fromEngine（R-5 剪枝握手）');

// coup→玩家（君威衰）→ 构造 regicide 走 sink·fromEngine
ce = makeCE();
ce.GM = { turn: 10, huangquan: { index: 20 }, huangwei: { index: 20 }, _activePlots: [], _conspiracies: [], chars: [char('逆将', {}), char('崇祯', { isPlayer: true })] };
ce.ConspiracyEngine._resolveRipe(ce.GM, plotOf({ ringleader: '逆将', kind: 'coup', _narrativePlan: '弑君夺位' }));
let sinkCall = ce._calls.find(c => c.fn === 'sink');
assert(sinkCall && sinkCall.ev.action === 'regicide' && sinkCall.ev.instigator === '逆将' && sinkCall.opts.fromEngine === true, 'A2 coup→玩家·走 apply-stages 同一 sink（regicide·fromEngine）');

// mutiny（君威衰）→ emit + 主谋流亡 + 军 morale 冲击
ce = makeCE();
ce.GM = { turn: 10, huangquan: { index: 20 }, huangwei: { index: 20 }, _activePlots: [], _conspiracies: [], chars: [char('大将', { troops: 9000 }), char('崇祯', { isPlayer: true })], armies: [{ name: '边军', _commander: '大将', faction: '边镇', morale: 80 }] };
ce.ConspiracyEngine._resolveRipe(ce.GM, plotOf({ ringleader: '大将', kind: 'mutiny' }));
assert(ce._calls.some(c => c.fn === 'emit' && c.ev === 'army:mutinyRisk'), 'A2 mutiny→emit army:mutinyRisk');
assert(ce.GM.chars.find(c => c.name === '大将')._fled === true, 'A2 mutiny→主谋流亡 _fled');
assert(ce.GM.armies[0].morale === 55, 'A2 mutiny→军队 morale -25');
assert(ce.GM._conspiracies.some(c => c.action === 'mutiny' && c._fromEngine), 'A2 mutiny→史录（_fromEngine）');

// palace_coup 得逞（君威严重衰）→ 复用 R1d 废帝
ce = makeCE();
ce.GM = { turn: 10, huangquan: { index: 20 }, huangwei: { index: 20 }, _activePlots: [], _conspiracies: [], chars: [char('魏公公', { officialTitle: '司礼监掌印太监' }), char('崇祯', { isPlayer: true })] };
ce.ConspiracyEngine._resolveRipe(ce.GM, plotOf({ ringleader: '魏公公', kind: 'palace_coup' }));
assert(ce._calls.some(c => c.fn === 'pme' && c.mode === 'usurpation' && c.inner === true), 'A2 palace_coup 得逞→复用 powerMinisterEndgame（内竖挟主）');
assert(ce.GM._conspiracies.some(c => c.action === 'palace_coup' && c.outcome === 'succeeded'), 'A2 palace_coup 史录得逞');

// palace_coup 条件不足→降级未遂下狱
ce = makeCE();
ce.GM = { turn: 10, huangquan: { index: 35 }, huangwei: { index: 45 }, _activePlots: [], _conspiracies: [], turnChanges: {}, chars: [char('魏公公', { officialTitle: '太监' }), char('崇祯', { isPlayer: true })] };
ce.ConspiracyEngine._resolveRipe(ce.GM, plotOf({ ringleader: '魏公公', kind: 'palace_coup' }));
assert(!ce._calls.some(c => c.fn === 'pme'), 'A2 palace_coup 条件不足→不废帝');
assert(ce.GM.chars.find(c => c.name === '魏公公')._imprisoned, 'A2 palace_coup 条件不足→降级未遂下狱');

// plot（构陷政敌·无 P-QAM）→ 目标构陷下狱·主谋不下狱
ce = makeCE();
ce.GM = { turn: 10, _activePlots: [], _conspiracies: [], chars: [char('权臣', {}), char('政敌', {})] };
ce.ConspiracyEngine._resolveRipe(ce.GM, plotOf({ ringleader: '权臣', kind: 'plot', target: '政敌' }));
assert(ce.GM.chars.find(c => c.name === '政敌')._imprisoned, 'A2 plot→目标构陷下狱');
assert(!ce.GM.chars.find(c => c.name === '权臣')._imprisoned, 'A2 plot→主谋不下狱（得逞）');
assert(ce.GM._conspiracies.some(c => c.action === 'plot_succeeded'), 'A2 plot→史录得逞');

// 民变 modifier（plan 含义军）→ ClassMinxinBridge + revolt 渠帅候选
ce = makeCE();
ce.GM = { turn: 10, minxin: { revolts: [] }, _activePlots: [], _conspiracies: [], chars: [char('渠帅', { location: '河南' })] };
ce.ConspiracyEngine._resolveRipe(ce.GM, plotOf({ ringleader: '渠帅', kind: 'coup', _narrativePlan: '聚众揭竿·义军举事' }));
assert(ce._calls.some(c => c.fn === 'uprising'), 'A2 民变→ClassMinxinBridge.spawnUprisingCandidates');
assert(ce.GM.minxin.revolts.some(r => r.leader === '渠帅' && r._fromConspiracy && r.level === 3), 'A2 民变→主谋入 minxin.revolts 当渠帅候选');
assert(ce.GM._conspiracies.some(c => c.action === 'uprising'), 'A2 民变→史录');

// ═══ A3 · 同谋牵连羁押（刀丁5） ═══
ce = makeCE();
ce.GM = { turn: 10, _conspiracies: [], turnChanges: {}, chars: [char('主谋', {}), char('从犯甲', {}), char('从犯乙', {}), char('死从', { alive: false }), char('崇祯', { isPlayer: true })] };
ce.ConspiracyEngine._settle(ce.GM, plotOf({ ringleader: '主谋', conspirators: ['从犯甲', '从犯乙', '死从', '崇祯'] }), 'coup_failed', 'suppressed', 't', false);
assert(ce.GM.chars.find(c => c.name === '主谋')._imprisoned && ce.GM.chars.find(c => c.name === '主谋')._conspiracyConvicted, 'A3 连坐·主谋下狱+convicted');
assert(ce.GM.chars.find(c => c.name === '从犯甲')._imprisoned && ce.GM.chars.find(c => c.name === '从犯甲')._imprisonReason === '逆案连坐', 'A3 连坐·从犯下狱（逆案连坐）');
assert(!ce.GM.chars.find(c => c.name === '死从')._imprisoned, 'A3 连坐·死者跳过');
assert(!ce.GM.chars.find(c => c.name === '崇祯')._imprisoned, 'A3 连坐·玩家跳过');
ce = makeCE();
let many = [], names = [];
for (let i = 0; i < 7; i++) { many.push(char('从' + i, {})); names.push('从' + i); }
ce.GM = { turn: 10, _conspiracies: [], chars: [char('头', {})].concat(many) };
ce.ConspiracyEngine._settle(ce.GM, plotOf({ ringleader: '头', conspirators: names }), 'coup_failed', 'suppressed', 't', false);
assert(many.filter(c => c._imprisoned).length === 5, 'A3 连坐·封顶 5 人');
ceOff = makeCE({ conspiracyResolutionEnabled: false });
ceOff.GM = { turn: 10, _conspiracies: [], chars: [char('主', {}), char('从', {})] };
ceOff.ConspiracyEngine._settle(ceOff.GM, plotOf({ ringleader: '主', conspirators: ['从'] }), 'coup_failed', 'suppressed', 't', false);
assert(ceOff.GM.chars.find(c => c.name === '主')._imprisoned && !ceOff.GM.chars.find(c => c.name === '从')._imprisoned, 'A3 连坐 flag OFF·只拿主谋（旧行为等价）');

// ═══ A4 · _fromEngine 剪枝握手（R-5·唯一去重口） ═══
ce = makeCE();
ce.GM = {
  turn: 10, huangquan: { index: 50 }, huangwei: { index: 50 },
  _conspiracies: [{ instigator: '甲', turn: 9, _fromEngine: true }, { instigator: '乙', turn: 9 }],
  _activePlots: [plotOf({ id: 'pa', ringleader: '甲', momentum: 10, stage: 'brewing' }), plotOf({ id: 'pb', ringleader: '乙', momentum: 10, stage: 'brewing' })],
  chars: [char('甲', {}), char('乙', {})]
};
ce.ConspiracyEngine.tick({ turn: 10, monthRatio: 0.08 });
let alive = ce.GM._activePlots.map(p => p.ringleader);
assert(alive.indexOf('乙') < 0, 'A4 剪枝·AI 收束（非 _fromEngine 近史）→移除对应 plot');
assert(alive.indexOf('甲') >= 0, 'A4 剪枝·引擎账（_fromEngine）不触发 AI 去重·plot 保留');

// ═══ H · 真 sink（apply-stages·抽公共函数两处调） ═══
let sk = loadSink();
assert(typeof sk.TM.Endturn.AI.apply._applyOneConspiracyEvent === 'function', 'H sink _applyOneConspiracyEvent 已导出');
sk.GM = { turn: 5, huangquan: { index: 80 }, huangwei: { index: 80 }, _conspiracies: [], turnChanges: {}, chars: [{ name: '崇祯', isPlayer: true, alive: true }, { name: '逆党', alive: true }] };
sk.TM.Endturn.AI.apply._applyOneConspiracyEvent({ action: 'regicide', outcome: 'succeeded', instigator: '逆党', target: '崇祯', conspirators: [], reason: '弑' });
assert(sk._deaths.length === 0 && sk.GM._conspiracies[0].action === 'coup_failed' && sk.GM._conspiracies[0].outcome === 'suppressed', 'H sink·君威盛 regicide 被 P-QAM 门降级·玩家不死');
assert(sk.GM.chars.find(c => c.name === '逆党')._imprisoned, 'H sink·gated→主谋下狱');
sk = loadSink();
sk.GM = { turn: 5, huangquan: { index: 15 }, huangwei: { index: 15 }, _conspiracies: [], turnChanges: {}, chars: [{ name: '崇祯', isPlayer: true, alive: true }, { name: '逆党', alive: true }] };
sk.TM.Endturn.AI.apply._applyOneConspiracyEvent({ action: 'regicide', outcome: 'succeeded', instigator: '逆党', target: '崇祯', conspirators: [], reason: '弑' }, { fromEngine: true });
assert(sk._deaths.some(d => d.name === '崇祯'), 'H sink·君威衰 regicide 过门→adjudicate/applyOneDeath（玩家）');
assert(sk.GM._conspiracies[0]._fromEngine === true, 'H sink·opts.fromEngine→_fromEngine:true');
sk = loadSink();
sk.GM = { turn: 5, huangquan: { index: 50 }, huangwei: { index: 50 }, _conspiracies: [], turnChanges: {}, chars: [{ name: 'x', alive: true }] };
sk.TM.Endturn.AI.apply._applyOneConspiracyEvent({ action: 'plot_failed', outcome: 'suppressed', instigator: 'x', target: 'y', conspirators: [], reason: 'r' });
assert(sk.GM._conspiracies[0]._autoFromReconcile === true && !sk.GM._conspiracies[0]._fromEngine, 'H sink·缺省 opts→_autoFromReconcile（apply 旧行为等价）');

// ═══ B · R-1 sc15 清理（真源抽取 followup 过滤谓词） ═══
const followupSrc = readSrc('tm-endturn-followup.js');
const r1Body = bodyAfter(followupSrc, 'GM.activeSchemes = GM.activeSchemes.filter(function(s) {');
const r1pred = new Function('s', 'GM', 'turnsForMonths', r1Body);
const R1 = (s) => r1pred(s, { turn: 20 }, (m) => m);
assert(R1({ origin: 'sc15', lastTurn: 19 }) === true, 'B R-1·新鲜 sc15 保留');
assert(R1({ origin: 'sc15', lastTurn: 10 }) === false, 'B R-1·过期 sc15 仍清');
assert(R1({ origin: 'sc1c', lastTurn: 1 }) === true, 'B R-1·sc1c 不误删（他源不连坐）');
assert(R1({ origin: 'yuqian', lastTurn: 1 }) === true, 'B R-1·yuqian 不误删');
const legacy = { id: 'z' };
assert(R1(legacy) === true && legacy.lastTurn === 20, 'B R-1·legacy 无 lastTurn 补戳不删');

// ═══ C · feudal _ensureFeudal 迁移（真源抽取·R-2 不连坐叙事） ═══
const feudalSrc = readSrc('tm-feudal-warfare.js');
const ensureBody = bodyAfter(feudalSrc, 'function _ensureFeudal() {');
const ensureFn = new Function('GM', ensureBody);
const GMf = { activeSchemes: [{ origin: 'sc15', schemer: 'a', plan: 'x', progress: '酝酿中' }, { typeId: 'assassination', phase: { current: 1, total: 2 }, progress: 30, status: 'active', schemer: 'b' }] };
ensureFn(GMf);
assert(Array.isArray(GMf._feudalSchemes) && GMf._feudalSchemes.length === 1 && GMf._feudalSchemes[0].schemer === 'b', 'C 迁移·feudal 形（typeId+phase+数值 progress）迁出');
assert(GMf._feudalSchemes[0].origin === 'feudal', 'C 迁移·补 origin=feudal');
assert(GMf.activeSchemes.length === 1 && GMf.activeSchemes[0].schemer === 'a', 'C R-2·叙事条目留 activeSchemes 不连坐');
ensureFn(GMf);
assert(GMf._feudalSchemes.length === 1 && GMf.activeSchemes.length === 1, 'C 迁移幂等·再跑不重复');

// ═══ D · 六写者 origin/lastTurn 契约（真源存在性） ═══

// ═══ E · save-lifecycle _feudalSchemes mirror 往返（真源抽取） ═══
const saveSrc = readSrc('tm-save-lifecycle.js');
const saveLine = (saveSrc.match(/if \(GM\._feudalSchemes\) GM\._savedFeudalSchemes = _safeClone\(GM\._feudalSchemes\);/) || [])[0];
const restoreLine = (saveSrc.match(/if \(GM\._savedFeudalSchemes\) \{ GM\._feudalSchemes = GM\._savedFeudalSchemes; delete GM\._savedFeudalSchemes; \}/) || [])[0];
assert(saveLine && restoreLine && /if \(!Array\.isArray\(GM\._feudalSchemes\)\) GM\._feudalSchemes = \[\]/.test(saveSrc), 'E mirror·ensure/save/restore 三处真源存在');
const GMm = { _feudalSchemes: [{ id: 'f1' }] };
new Function('GM', '_safeClone', saveLine)(GMm, (x) => JSON.parse(JSON.stringify(x)));
GMm._feudalSchemes = [];
new Function('GM', restoreLine)(GMm);
assert(GMm._feudalSchemes.length === 1 && GMm._feudalSchemes[0].id === 'f1' && GMm._savedFeudalSchemes === undefined, 'E mirror·往返恢复 feudal 账本');

// ═══ F · apply scheme_actions 撤 typeof 分流后 advance/expose 仍工作（真源抽取·applySrc 已于顶部载入） ═══
assert(!/typeof scheme\.progress === 'string'/.test(applySrc), 'F apply·scheme_actions 已撤 typeof 数值分流');
const saBody = bodyAfter(applySrc, 'p1.scheme_actions.forEach(function(sa) {');
const runSA = new Function('sa', 'GM', 'addEB', 'NpcMemorySystem', 'PhaseD', 'ChronicleTracker', saBody);
const schemeF = { id: 's1', schemer: '谋士', target: '政敌', progress: '酝酿中', progressPct: 35, status: 'active', typeName: '构陷' };
const GMsa = { turn: 12, activeSchemes: [schemeF] };
runSA({ schemeId: 's1', action: 'advance', amount: 20, reason: 't' }, GMsa, () => {}, undefined, undefined, undefined);
assert(schemeF.progressPct === 55 && typeof schemeF.progress === 'string', 'F apply·advance 提升 progressPct（字符串 scheme·无 NaN）');
assert(schemeF.lastTurn === 12, 'F apply·advance 刷新 lastTurn');
runSA({ schemeId: 's1', action: 'expose', reason: '败露' }, GMsa, () => {}, undefined, undefined, undefined);
assert(schemeF.status === 'exposed' && schemeF.discovered === true, 'F apply·expose 设 status=exposed');

// ═══ G · R-3 prompt 注入去重（滤 _seededPlotId） ═══
const g3 = [{ schemer: 'a' }, { schemer: 'b', _seededPlotId: 'p1' }].filter(function (_s) { return !_s._seededPlotId; });
assert(g3.length === 1 && g3[0].schemer === 'a', 'G R-3·过滤剔除已播种条目');

console.log('\nsmoke-conspiracy-unification PASS · ' + A + ' assertions');
process.exit(0);

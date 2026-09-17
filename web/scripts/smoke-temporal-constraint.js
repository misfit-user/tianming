#!/usr/bin/env node
// scripts/smoke-temporal-constraint.js
// 平行历史·时空约束战役 smoke（2026-07-19，返工版）
//   Slice A：_buildTemporalConstraint 本体——总纲铁律 / 真实字段重要度排序 / mentionedNames 强纳标生死 /
//            clauseOnly 省名单文案自洽 / 已故截取文案 / deathTurn??_deathTurn 兼容 / 有界扫描助手
//   Slice B：四个零防线 LLM 入口各接上约束（源码 grep + 真传递断言）
//
// 不真调 LLM：把 tm-ai-infra.js 中整段时空约束函数抽出·在 vm 沙箱里喂 stub GM/P（含真实官方剧本）跑断言。

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SCN_DIR = path.resolve(ROOT, '..', 'scenarios');

let PASS = 0;
function assert(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } PASS++; }

// ── 抽出整段时空约束代码（_buildTemporalConstraint..._tcScanMentionedNames，含 _TC_OFFICE_TIERS 声明）──
function extractBlock() {
  const infra = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
  const si = infra.indexOf('function _buildTemporalConstraint(ch, opts)');
  const ei = infra.indexOf('/** 构建长期行动/长期诏书/长期政策摘要·注入推演 sysP');
  if (si < 0 || ei < 0 || ei <= si) throw new Error('无法定位时空约束代码段');
  return infra.slice(si, ei);
}

function newCtx(gm, p) {
  const ctx = {
    console: { log: function(){}, warn: function(){}, error: function(){} },
    Math: Math, JSON: JSON, Object: Object, Array: Array, RegExp: RegExp,
    Number: Number, String: String, Boolean: Boolean
  };
  ctx.GM = gm; ctx.P = p;
  ctx.getTSText = function(){ return '天启七年·九月'; };
  ctx.findCharByName = function(name){ return (ctx.GM.chars || []).filter(function(c){ return c && c.name === name; })[0] || null; };
  vm.createContext(ctx);
  vm.runInContext(extractBlock(), ctx, { filename: 'extracted-temporal.js' });
  return ctx;
}

// ── 官方天启剧本（若缺则找任一含黄立极+皇太极的剧本）──
function loadTianqi() {
  let file = path.join(SCN_DIR, '天启七年·九月（官方）.json');
  if (!fs.existsSync(file)) {
    const cand = fs.readdirSync(SCN_DIR).filter(function(n){ return /\.json$/.test(n); })
      .map(function(n){ return path.join(SCN_DIR, n); })
      .filter(function(f){ try { const s = fs.readFileSync(f, 'utf8'); return s.indexOf('黄立极') >= 0 && s.indexOf('皇太极') >= 0; } catch(_){ return false; } });
    if (!cand.length) return null;
    file = cand[0];
  }
  const sc = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { name: path.basename(file), sc: sc };
}

// ── Slice A-1：本体文案 / mentionedNames / clauseOnly / deathTurn 兼容（真实字段合成样本）──
function sliceA_body() {
  const chars = [];
  for (let i = 1; i <= 34; i++) chars.push({ name: '平民' + i, alive: true, faction: '本朝' });          // 无官职·faction 本朝
  chars.push({ name: '张尚书', alive: true, officialTitle: '吏部尚书', faction: '本朝', isHistorical: true }); // index 34·靠打分进前30
  chars.push({ name: '活人甲', alive: true, faction: '本朝' });
  chars.push({ name: '亡者乙', alive: false, deathTurn: 7, faction: '本朝' });
  chars.push({ name: '魏公公', alive: false, deathTurn: 5, faction: '本朝', officialTitle: '司礼监秉笔' });
  chars.push({ name: '仅私字段者', alive: false, _deathTurn: 9, faction: '本朝' });                        // 只有 _deathTurn
  const ctx = newCtx({ turn: 3, year: 1627, chars: chars }, { time: { year: 1627 }, playerInfo: { factionName: '本朝' } });
  const full = ctx._buildTemporalConstraint(null);

  // 总纲铁律关键句
  assert(full.indexOf('本局平行历史·唯一现实铁律') >= 0, '总纲标题缺失');
  assert(full.indexOf('压倒你的历史知识') >= 0, '总纲「压倒你的历史知识」缺失');
  assert(full.indexOf('不认史书卒年') >= 0, '总纲「不认史书卒年」缺失');
  assert(full.indexOf('生死荣辱只认名单与 GM') >= 0, 'full 模式末句应「只认名单与 GM」');
  assert(full.indexOf('绝不因「真实历史如此」拉回史实') >= 0, '「玩家已介入以游戏态为准」规则点缺失');
  assert(full.indexOf('不得把游戏当前时间之后的史实当既成事实') >= 0, '「未来史实非既成」规则点缺失');
  // 软化后的名单措辞（不再宣称在世名单穷尽）
  assert(full.indexOf('不在在世名单者，生死一律以 GM 游戏态为准') >= 0, '铁律应软化为「不在名单者以 GM 为准」');
  assert(/在世名单|非全名单|要员节选/.test(full), '在世名单应标明为节选而非全量');

  // 死者名单矛盾修复：改「以下为部分已故人物（本局全部生死以 GM 为准）」
  assert(full.indexOf('以下为部分已故人物（本局全部生死以 GM 为准）') >= 0, '已故名单文案未改为「部分…全部以 GM 为准」');
  assert(full.indexOf('仅此列已死') < 0, '不应再出现「仅此列已死」矛盾措辞');
  assert(full.indexOf('魏公公（卒于第5回合）') >= 0, '已故名单未标卒于回合');
  // _deathTurn 兼容（死者名单里 仅私字段者 用 _deathTurn=9）
  assert(full.indexOf('仅私字段者（卒于第9回合）') >= 0, '已故名单未兼容 _deathTurn');

  // 有官职者进前30（张尚书·真实字段 officialTitle，无 rank 字段）
  const aliveLine = full.split('\n').filter(function(l){ return l.indexOf('当前在世人物') === 0; })[0] || '';
  assert(aliveLine.indexOf('张尚书') >= 0, '有官职者「张尚书」未按打分进前30');

  // mentionedNames 逐人标生死（在世 / 已故 / 仅 _deathTurn 已故 / 不在册）
  const wm = ctx._buildTemporalConstraint(null, { mentionedNames: ['活人甲', '亡者乙', '仅私字段者', '查无此人'] });
  assert(wm.indexOf('本议题所涉人物') >= 0, 'mentionedNames 未生成涉议区块');
  assert(wm.indexOf('活人甲（在世·此刻活着可行动）') >= 0, 'mentioned 在世者未标在世');
  assert(wm.indexOf('亡者乙（已故·卒于第7回合）') >= 0, 'mentioned 已故者未标卒于回合');
  assert(wm.indexOf('仅私字段者（已故·卒于第9回合）') >= 0, 'mentioned 未兼容 _deathTurn');
  assert(wm.indexOf('查无此人') >= 0 && wm.indexOf('不在人物册') >= 0, 'mentioned 不在册者未提示以 GM 为准');

  // clauseOnly：带总纲 / 不带在世大名单 / 文案自洽（不引用「下列名单」）
  const clause = ctx._buildTemporalConstraint(null, { clauseOnly: true });
  assert(clause.indexOf('本局平行历史·唯一现实铁律') >= 0, 'clauseOnly 应带总纲');
  assert(clause.indexOf('当前在世人物') < 0, 'clauseOnly 不应带在世大名单');
  assert(clause.indexOf('以下为部分已故人物') < 0, 'clauseOnly 不应带已故大名单');
  assert(clause.indexOf('下列名单') < 0, 'clauseOnly 文案不应引用「下列名单」');
  assert(clause.indexOf('本 prompt 提供的游戏态与 GM') >= 0 && clause.indexOf('只认 GM 游戏态') >= 0, 'clauseOnly 文案应自洽为「以本 prompt 游戏态与 GM 为准」');
  const clauseM = ctx._buildTemporalConstraint(null, { clauseOnly: true, mentionedNames: ['亡者乙'] });
  assert(clauseM.indexOf('亡者乙（已故·卒于第7回合）') >= 0, 'clauseOnly 下 mentionedNames 仍应标生死');
  assert(clauseM.indexOf('当前在世人物') < 0, 'clauseOnly+mentioned 仍不带在世大名单');

  // 向后兼容：仅 ch
  const legacy = ctx._buildTemporalConstraint({ _memory: [{ turn: 2, event: '受召入对', emotion: '惶恐' }] });
  assert(legacy.indexOf('本局平行历史·唯一现实铁律') >= 0, '旧签名(仅 ch)应带总纲');
  assert(legacy.indexOf('受召入对') >= 0, '旧签名(仅 ch)应注入 NPC 记忆');

  console.log('  [sliceA-body] ' + PASS + ' 断言通过');
}

// ── Slice A-2：>12 死者时，被 mentioned 的第13+死者仍必现（截取只截大名单，不截 mentioned）──
function sliceA_deadCap() {
  const start = PASS;
  const chars = [];
  for (let i = 1; i <= 15; i++) chars.push({ name: '故臣' + i, alive: false, deathTurn: i, faction: '本朝' });
  chars.push({ name: '在世君', alive: true, faction: '本朝', officialTitle: '皇帝', isPlayer: true });
  const ctx = newCtx({ turn: 20, year: 1627, chars: chars }, { time: {}, playerInfo: { factionName: '本朝' } });
  const full = ctx._buildTemporalConstraint(null);
  const deadLine = full.split('\n').filter(function(l){ return l.indexOf('以下为部分已故人物') === 0; })[0] || '';
  const shownDead = (deadLine.match(/故臣\d+/g) || []).length;
  assert(shownDead <= 12, '已故大名单应截取 ≤12（实=' + shownDead + '）');
  // 故臣15 被截出大名单；用 mentionedNames 传入应仍标生死
  const wm = ctx._buildTemporalConstraint(null, { mentionedNames: ['故臣15'] });
  assert(wm.indexOf('故臣15（已故·卒于第15回合）') >= 0, '>12 死者时·被 mentioned 的第13+死者必须现（走 mentioned 不受 12 截取影响）');
  console.log('  [sliceA-deadCap] ' + (PASS - start) + ' 断言通过');
}

// ── Slice A-3：真实官方剧本排序（首辅/阁臣/尚书必在前30；外邦君主不得挤入）──
function sliceA_realScenario() {
  const start = PASS;
  const t = loadTianqi();
  assert(!!t, '找不到天启剧本（黄立极+皇太极）用于排序验证');
  const sc = t.sc;
  const chars = (sc.characters || []).map(function(c){ return Object.assign({}, c, { alive: c.alive !== false }); });
  const pf = (sc.playerInfo && sc.playerInfo.factionName) || '明朝廷';
  const ctx = newCtx({ turn: 1, year: 1627, chars: chars }, { time: {}, playerInfo: { factionName: pf } });

  const alive = chars.filter(function(c){ return c && c.alive !== false && !c.dead; });
  const ranked = alive.slice().sort(function(a, b){ return ctx._tcImportanceScore(b) - ctx._tcImportanceScore(a); });
  const top30 = ranked.slice(0, 30);
  const names30 = top30.map(function(c){ return c.name; });
  function inTop(nm){ return names30.some(function(n){ return n.indexOf(nm) >= 0; }); }

  console.log('  [sliceA-realScenario] 剧本=' + t.name + '｜玩家=' + pf + '｜在世=' + alive.length);
  console.log('  前30：' + names30.join('、'));

  // 本朝要员必在前30
  ['黄立极', '施凤来', '周应秋', '魏忠贤'].forEach(function(nm){ assert(inTop(nm), '本朝要员「' + nm + '」应在前30'); });
  // 首辅/阁臣/尚书 结构性在列
  assert(top30.filter(function(c){ return /大学士|首辅|内阁/.test(c.officialTitle || ''); }).length >= 3, '前30 应含 ≥3 阁臣（大学士/首辅）');
  assert(top30.filter(function(c){ return /尚书/.test(c.officialTitle || ''); }).length >= 2, '前30 应含 ≥2 尚书');
  // 外邦君主不得挤掉本朝重臣
  ['皇太极', '林丹', '德川'].forEach(function(nm){ assert(!inTop(nm), '外邦君主「' + nm + '」不应挤入前30'); });
  // 玩家（皇帝）必首位
  assert(top30[0] && (top30[0].isPlayer || /皇帝|天子/.test(top30[0].officialTitle || '')), '前30 首位应为玩家/君主');

  console.log('  [sliceA-realScenario] ' + (PASS - start) + ' 断言通过');
}

// ── Slice A-4：有界扫描助手单元断言 ──
function sliceA_scan() {
  const start = PASS;
  const chars = [{ name: '魏忠贤', alive: true }, { name: '孙承宗', alive: true }, { name: '袁崇焕', alive: false, deathTurn: 3 }, { name: '甲', alive: true }];
  const ctx = newCtx({ turn: 1, chars: chars }, { playerInfo: {} });
  // 从议题文本命中已知人名·发言人(种子)恒入
  const r = ctx._tcScanMentionedNames('是否处置魏忠贤，起复袁崇焕、孙承宗', ['某发言人'], 10);
  assert(r.indexOf('某发言人') >= 0, '扫描应保留种子(发言人)');
  assert(r.indexOf('魏忠贤') >= 0 && r.indexOf('孙承宗') >= 0 && r.indexOf('袁崇焕') >= 0, '扫描应命中议题文本中的已知人名');
  assert(r.indexOf('甲') < 0, '单字名不应被误命中(长度<2)');
  // cap 生效
  const many = { turn: 1, chars: [] };
  for (let i = 0; i < 30; i++) many.chars.push({ name: '人物' + (100 + i), alive: true });
  const ctx2 = newCtx(many, { playerInfo: {} });
  const txt = many.chars.map(function(c){ return c.name; }).join('、');
  const r2 = ctx2._tcScanMentionedNames(txt, [], 5);
  assert(r2.length <= 5, '扫描 hit 应受 cap 限制(=' + r2.length + ')');
  console.log('  [sliceA-scan] ' + (PASS - start) + ' 断言通过');
}

// ── Slice B：四入口源码 grep + 真传递断言 ──
function sliceB() {
  const start = PASS;
  const guard = /typeof\s+(?:global\.)?_buildTemporalConstraint\s*===\s*'function'/;
  const call = /(?:global\.)?_buildTemporalConstraint\s*\(/;
  const entries = [
    { f: 'tm-memorials.js',                 pass: /_tcScanMentionedNames\(/,  note: '奏疏·扫描主题上下文' },
    { f: 'tm-chaoyi-tinyi.js',              pass: /_tcScanMentionedNames\([^)]*\[name\]/, note: '廷议·扫描议题+发言人种子' },
    { f: 'tm-chaoyi-yuqian.js',             pass: /_tcScanMentionedNames\([^)]*\[name\]/, note: '御前·扫描议题+发言人种子' },
    { f: 'tm-faction-npc-llm-decision.js',  pass: /candidateChars[\s\S]{0,160}mentionedNames/, note: '势力·clauseOnly+候选人生死行' }
  ];
  entries.forEach(function(it){
    const src = fs.readFileSync(path.join(ROOT, it.f), 'utf8');
    assert(guard.test(src), it.f + ' 须以 typeof 守卫注入（' + it.note + '）');
    assert(call.test(src), it.f + ' 须调用 _buildTemporalConstraint（' + it.note + '）');
    assert(it.pass.test(src.replace(/\s+/g, ' ')) || it.pass.test(src), it.f + ' 须真传递涉议人物 mentionedNames（' + it.note + '）·非硬编常量');
  });
  // faction 走 clauseOnly
  const facSrc = fs.readFileSync(path.join(ROOT, 'tm-faction-npc-llm-decision.js'), 'utf8').replace(/\s+/g, ' ');
  assert(/_buildTemporalConstraint\s*\([^)]*clauseOnly/.test(facSrc), 'faction 决策须用 clauseOnly 版');
  // 助手确已定义于 infra
  const infra = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
  assert(/function _tcScanMentionedNames\s*\(/.test(infra), 'tm-ai-infra.js 须定义 _tcScanMentionedNames 供四入口复用');
  console.log('  [sliceB] ' + (PASS - start) + ' 断言通过（四入口 grep + 真传递）');
}

// ── Slice B2：owner 点名的老入口（SliceA 前就有约束者）议题扫描补齐（各含 _tcScanMentionedNames 调用或说明不可达）──
function sliceB2() {
  const start = PASS;
  const guard = /typeof\s+(?:global\.)?_buildTemporalConstraint\s*===\s*'function'/;
  const oldEntries = [
    { f: 'tm-chaoyi-changchao-adapter.js',  note: '朔朝 NPC 台词·扫描 item.title/detail' },
    { f: 'tm-chaoyi-changchao.js',          note: '常朝 buildNpcPrompt·扫描 item.title/detail+playerText' },
    { f: 'tm-wendui-persona-views.js',      note: '问对·扫描玩家提问(wenduiHistory)' },
    { f: 'tm-hongyan-office.js',            note: '鸿雁御案·扫描来信 letter.content+往来' },
    { f: 'tm-shizheng-panel.js',            note: '时政面板·扫描 d.issue+已往对答' }
  ];
  oldEntries.forEach(function(it){
    const src = fs.readFileSync(path.join(ROOT, it.f), 'utf8');
    assert(guard.test(src), it.f + ' 老入口须保留 typeof 守卫（' + it.note + '）');
    // 议题扫描已接上（存在 _tcScanMentionedNames 调用）·或（若不可达）显式说明——本批五处皆可达
    assert(/_tcScanMentionedNames\s*\(/.test(src), it.f + ' 老入口须接上议题扫描 _tcScanMentionedNames（' + it.note + '）');
    assert(/扫描源/.test(src), it.f + ' 每处须一行注释说明扫描源（' + it.note + '）');
    assert(/_buildTemporalConstraint\s*\([^)]*mentionedNames/.test(src.replace(/\s+/g, ' ')), it.f + ' 须把扫描所得作 mentionedNames 传入（' + it.note + '）');
  });
  console.log('  [sliceB2] ' + (PASS - start) + ' 断言通过（五老入口议题扫描补齐）');
}

sliceA_body();
sliceA_deadCap();
sliceA_realScenario();
sliceA_scan();
sliceB();
sliceB2();
console.log('PASS smoke-temporal-constraint · 共 ' + PASS + ' 断言');

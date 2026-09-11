#!/usr/bin/env node
// scripts/smoke-tc-keju-wave.js
// 刀A3·科举族裸 LLM 口补时空约束 · 逐口断言 + 行为锁（2026-07-19·Codex 复审返工版）
//   Slice A：_buildTemporalConstraint 机制自检（clauseOnly 带铁律 + mentionedNames 逐人标生死；full 带在世名单）
//   Slice B：32 处注入口逐口断言（marker→守卫→调用→mode→scan/mention）+ 顺序锚定（约束注入须在 LLM sink 之前·改同一 prompt 变量·防注入被挪到 sink 后失效）
//   Slice C：每文件注入计数对账（32）+ 2 处「不适用」口理由断言
//   Slice D：条1 行为锁·VM 实调 pickHistoricalCandidates·stub AI 返回含本局死者的候选·断言死者绝不入选 + 死者名单进 prompt 排除
//   Slice E：条2 行为锁·VM 实调 _kjpL12LlmReformerBio·stub AI 返回 deathYear+书卒正文·断言在世传主 deathYear 强清、书卒句剔除、约束 sentinel 真达 prompt；死者传主 deathYear 保留（闸条件精确）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

let PASS = 0;
function assert(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } PASS++; }
function readSrc(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
// 抽顶层函数（顶层 fn 闭括号在第 0 列·内层皆缩进·故首个「\n}\n」即函数尾）
function extractTopFn(src, sig) {
  const s = src.indexOf(sig);
  if (s < 0) throw new Error('未找到函数签名：' + sig);
  const e = src.indexOf('\n}\n', s);
  if (e < 0) throw new Error('未找到函数尾：' + sig);
  return src.slice(s, e + 2);
}
function baseCtx() {
  return { console: { log(){}, warn(){}, error(){} }, Math, JSON, Object, Array, RegExp,
           Number, String, Boolean, Promise, setTimeout, Date, isFinite, parseInt, parseFloat };
}

// ── Slice A：机制自检 ──
function sliceA() {
  const start = PASS;
  const infra = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
  const si = infra.indexOf('function _buildTemporalConstraint(ch, opts)');
  const ei = infra.indexOf('/** 构建长期行动/长期诏书/长期政策摘要·注入推演 sysP');
  assert(si >= 0 && ei > si, 'tm-ai-infra.js 须含时空约束代码段');
  const ctx = baseCtx();
  ctx.GM = { turn: 7, year: 1627, chars: [
    { name: '在世卿', alive: true, faction: '本朝', officialTitle: '吏部尚书' },
    { name: '已故公', alive: false, deathTurn: 5, faction: '本朝' }
  ] };
  ctx.P = { time: { year: 1627 }, playerInfo: { factionName: '本朝' } };
  ctx.getTSText = () => '天启七年·九月';
  ctx.findCharByName = (n) => (ctx.GM.chars || []).filter(c => c && c.name === n)[0] || null;
  vm.createContext(ctx);
  vm.runInContext(infra.slice(si, ei), ctx, { filename: 'extracted-tc.js' });

  const clause = ctx._buildTemporalConstraint(null, { clauseOnly: true, mentionedNames: ['在世卿', '已故公', '查无此人'] });
  assert(clause.indexOf('本局平行历史·唯一现实铁律') >= 0, 'clauseOnly 应带平行历史总纲');
  assert(clause.indexOf('当前在世人物') < 0, 'clauseOnly 不应带在世大名单（防污染 JSON）');
  assert(clause.indexOf('不得把游戏当前时间之后的史实当既成事实') >= 0, 'clauseOnly 应含「未来史实非既成」铁律');
  assert(clause.indexOf('在世卿（在世·此刻活着可行动）') >= 0, 'clauseOnly+mentioned 在世者应标在世（防书卒）');
  assert(clause.indexOf('已故公（已故·卒于第5回合）') >= 0, 'clauseOnly+mentioned 已故者应标卒于回合');
  assert(clause.indexOf('查无此人') >= 0 && clause.indexOf('不在人物册') >= 0, 'clauseOnly+mentioned 不在册者应提示以 GM 为准');
  const full = ctx._buildTemporalConstraint(null, { mentionedNames: ['在世卿'] });
  assert(full.indexOf('当前在世人物') >= 0, 'full 应带在世名单');
  console.log('  [sliceA] ' + (PASS - start) + ' 断言通过（clauseOnly/full 机制）');
}

// ── Slice B：逐口注入断言 + 顺序锚定 ──
// mode: 'full'|'clauseOnly'|'na'; scan:用_tcScanMentionedNames; mention:传mentionedNames; pv:prompt变量; sk:LLM sink 子串
const PORTS = [
  { f:'tm-keju-runtime.js', m:'科举体系初始化配置',              mode:'clauseOnly', pv:'prompt', sk:'callAISmart(prompt, 800, {maxRetries: 2})' },
  { f:'tm-keju-runtime.js', m:'开科到期判定',                    mode:'clauseOnly', pv:'prompt', sk:'callAISmart(prompt, 300,' },
  { f:'tm-keju-runtime.js', m:'地方选拔模拟',                    mode:'clauseOnly', pv:'prompt', sk:'callAISmart(prompt, 1000, {maxRetries: 2})' },
  { f:'tm-keju-runtime.js', m:'扫描主考+旧题涉议人物',           mode:'full',       scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, 800, {minLength: 100' },
  { f:'tm-keju-runtime.js', m:'扫描会试题面涉议人物·批卷统计',   mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, 800, {maxRetries: 2})' },
  { f:'tm-keju-runtime.js', m:'扫描近期事件涉议人物·殿试策问',   mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, 500,' },
  { f:'tm-keju-runtime.js', m:'扫描殿试题面涉议人物·考生档案',   mode:'clauseOnly', scan:true, mention:true, pv:'metaPrompt', sk:'callAISmart(metaPrompt' },
  { f:'tm-keju-runtime.js', m:'扫描殿试题面涉议人物·答卷essay',  mode:'clauseOnly', scan:true, mention:true, pv:'batchPrompt', sk:'callAISmart(batchPrompt' },
  { f:'tm-keju-runtime.js', m:'扫描殿试题面涉议人物·主考逐卷批语', mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, _tokC' },
  { f:'tm-keju-runtime.js', m:'扫描殿试题面涉议人物·考官排序建议', mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, 3000' },
  { f:'tm-keju.js', m:'扫描时局背景涉议人物·主考题本',           mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, 2000' },
  { f:'tm-keju.js', m:'不适用：此口为史实检索器',                mode:'na' },
  { f:'tm-keju-reform-llm.js', m:'不适用：纯 descriptor',        mode:'na' },
  { f:'tm-keju-reform-llm.js', m:'试点候选推荐',                 mode:'clauseOnly', pv:'prompt', sk:"callAISmart(prompt, 800, { maxRetries: 1, priority: 'low', timeoutMs: 30000 }" },
  { f:'tm-keju-reform-llm.js', m:'扫描议题文本涉议人物·朝议预判', mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, 600,' },
  { f:'tm-keju-reform-llm.js', m:'扫描议题+召对大臣涉议人物·私谈', mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:"callAISmart(prompt, 800, { maxRetries: 1, priority: 'low', timeoutMs: 30000 }" },
  { f:'tm-keju-reform-llm.js', m:'两策对大臣涉议人物·advisor合并', mode:'clauseOnly', mention:true, pv:'prompt', sk:'callAISmart(prompt, 2500' },
  { f:'tm-keju-reform-llm.js', m:'新科目推荐',                   mode:'clauseOnly', pv:'prompt', sk:'callAISmart(prompt, 1500' },
  { f:'tm-keju-reform-llm.js', m:'科目合理化',                   mode:'clauseOnly', pv:'prompt', sk:"callAISmart(prompt, 800, { maxRetries: 1, priority: 'low', timeoutMs: 25000 }" },
  { f:'tm-keju-reformer-bio.js', m:'改革者本人涉议人物·改革者小传', mode:'clauseOnly', mention:true, pv:'prompt', sk:'callAISmart(prompt, 1000,' },
  { f:'tm-keju-reform-evolution.js', m:'改革逐年演进',           mode:'clauseOnly', mention:true, pv:'prompt', sk:'callAISmart(prompt, 1000,' },
  { f:'tm-keju-reform-evolution.js', m:'跨代承袭诏书',           mode:'clauseOnly', pv:'prompt', sk:'callAISmart(prompt, 1500,' },
  { f:'tm-keju-reform-evolution.js', m:'主导者(entry.by)+史评涉议人物·改革命名', mode:'clauseOnly', mention:true, pv:'prompt', sk:'callAISmart(prompt, 600,' },
  { f:'tm-keju-reform-evolution.js', m:'改革黑天鹅',            mode:'clauseOnly', mention:true, pv:'prompt', sk:'callAISmart(prompt, 900,' },
  { f:'tm-keju-activation.js', m:'开科/改革5档评估',            mode:'clauseOnly', pv:'prompt', sk:'callAISmart(prompt, Math.min(tokBudget' },
  { f:'tm-keju-enke.js', m:'主考涉议人物·恩科题面',            mode:'clauseOnly', mention:true, pv:'prompt', sk:'callAI(prompt, 800)' },
  { f:'tm-keju-enke.js', m:'主考涉议人物·恩科谢恩奏疏',        mode:'full',       mention:true, pv:'prompt', sk:'callAI(prompt, 600)' },
  { f:'tm-keju-wuju.js', m:'主考涉议人物·武举校阅奏疏',        mode:'full',       mention:true, pv:'prompt', sk:'callAI(prompt, 600)' },
  { f:'tm-keju-tongzi.js', m:'受抚童子涉议人物·抚摩大典纪事',   mode:'full',       mention:true, pv:'prompt', sk:'callAI(prompt, function(err, text)' },
  { f:'tm-keju-school-network.js', m:'扫描讲会主稿涉议人物',     mode:'full',       scan:true, mention:true, pv:'prompt', sk:'callAI(prompt, 600)' },
  { f:'tm-keju-runtime-keyi.js', m:'扫描议题+已发言涉议人物·廷议大臣发言', mode:'full',       scan:true, mention:true, pv:'prompt', sk:'content: prompt' },
  { f:'tm-keju-runtime-keyi.js', m:'扫描议程发言涉议人物·廷议表决精修',   mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, _tokBudget' },
  { f:'tm-keju-runtime-keyi.js', m:'扫描殿试题面+考生涉议人物·考生答卷',   mode:'clauseOnly', scan:true, mention:true, pv:'prompt', sk:'callAISmart(prompt, 1500,' },
  { f:'tm-keju-runtime-keyi.js', m:'考生本人涉议人物·进士人物卡',         mode:'clauseOnly', mention:true, pv:'prompt', sk:'callAISmart(prompt, 3000,' }
];

function findPortIdx(src, m) {
  let from = 0, idx;
  while ((idx = src.indexOf(m, from)) >= 0) {
    const ls = src.lastIndexOf('\n', idx) + 1;
    let le = src.indexOf('\n', idx); if (le < 0) le = src.length;
    if (src.slice(ls, le).indexOf('时空约束') >= 0) return idx;
    from = idx + 1;
  }
  return -1;
}

function sliceB() {
  const start = PASS;
  const cache = {};
  const guardRe = /typeof\s+_buildTemporalConstraint\s*===\s*'function'/;
  PORTS.forEach(function(p) {
    const src = cache[p.f] || (cache[p.f] = readSrc(p.f));
    const mi = findPortIdx(src, p.m);
    assert(mi >= 0, p.f + ' 缺注入 marker：' + p.m);
    const win = src.slice(mi, mi + 700);
    if (p.mode === 'na') {
      assert(win.indexOf('_buildTemporalConstraint(') < 0, p.f + '「不适用」口不应注入约束调用：' + p.m);
      assert(/不适用/.test(win) && /故不注入|不成立/.test(win), p.f + '「不适用」口须给出理由：' + p.m);
      return;
    }
    assert(guardRe.test(win), p.f + ' 口缺 typeof 守卫：' + p.m);
    assert(win.indexOf('_buildTemporalConstraint(') >= 0, p.f + ' 口缺 _buildTemporalConstraint 调用：' + p.m);
    if (p.mode === 'clauseOnly') assert(/clauseOnly:\s*true/.test(win), p.f + ' 口应为 clauseOnly：' + p.m);
    else assert(!/clauseOnly/.test(win.split('_buildTemporalConstraint(')[1].slice(0, 160)), p.f + ' full 口不应带 clauseOnly：' + p.m);
    if (p.scan) assert(win.indexOf('_tcScanMentionedNames(') >= 0, p.f + ' 口应用 _tcScanMentionedNames 扫描：' + p.m);
    if (p.mention) assert(/mentionedNames\s*:/.test(win), p.f + ' 口应传 mentionedNames：' + p.m);
    // 顺序锚定：约束改写同一 prompt 变量·且在 LLM sink 之前（防注入被挪到 sink 之后而静默失效）
    const mutIdx = src.indexOf(p.pv + ' += _buildTemporalConstraint', mi);
    assert(mutIdx >= 0 && mutIdx < mi + 700, p.f + ' 口未见「' + p.pv + ' += _buildTemporalConstraint」紧随 marker：' + p.m);
    const skIdx = src.indexOf(p.sk, mi);
    assert(skIdx >= 0, p.f + ' 口找不到 LLM sink「' + p.sk + '」：' + p.m);
    assert(skIdx > mutIdx, p.f + ' 口约束注入须在 LLM sink 之前（防失效）：' + p.m);
  });
  console.log('  [sliceB] ' + (PASS - start) + ' 断言通过（' + PORTS.length + ' 口逐口 + 顺序锚定）');
}

// ── Slice C：每文件注入计数对账 ──
function sliceC() {
  const start = PASS;
  const expect = {
    'tm-keju-runtime.js': 10, 'tm-keju.js': 1, 'tm-keju-reform-llm.js': 6,
    'tm-keju-reform-evolution.js': 4, 'tm-keju-reformer-bio.js': 1, 'tm-keju-activation.js': 1,
    'tm-keju-enke.js': 2, 'tm-keju-wuju.js': 1, 'tm-keju-tongzi.js': 1,
    'tm-keju-school-network.js': 1, 'tm-keju-runtime-keyi.js': 4
  };
  let total = 0;
  Object.keys(expect).forEach(function(f) {
    const src = readSrc(f);
    const n = (src.match(/\+=\s*_buildTemporalConstraint\(/g) || []).length;
    assert(n === expect[f], f + ' 注入计数应=' + expect[f] + '（实=' + n + '）');
    total += n;
  });
  assert(total === 32, '科举族总注入应=32（实=' + total + '）');
  const infra = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
  assert(/function _tcScanMentionedNames\s*\(/.test(infra), 'tm-ai-infra.js 须定义 _tcScanMentionedNames');
  console.log('  [sliceC] ' + (PASS - start) + ' 断言通过（32 口计数对账）');
}

// ── Slice D：条1(异名穿透)+条2(死者段独立)+条4(era-gate 后置) 行为锁·VM 实调 pickHistoricalCandidates ──
async function sliceD() {
  const start = PASS;
  const src = readSrc('tm-keju.js');
  const fnSrc = extractTopFn(src, 'async function pickHistoricalCandidates(exam) {');
  function runPick(cfg) {
    const ctx = baseCtx();
    let cap = '';
    ctx.P = { keju: { historicalFigurePolicy: { enableHistorical: true }, _historicalFiguresUsed: [] }, ai: { key: 'k' }, conf: { gameMode: cfg.mode || 'yanyi' }, dynasty: cfg.dynasty || '明', era: cfg.dynasty || '明' };
    ctx.GM = { year: cfg.year || 1620, chars: cfg.chars || [] };
    ctx._kejuHistoricalWindow = () => (cfg.window === undefined ? null : cfg.window);
    ctx.findCharByName = (n) => ctx.GM.chars.filter(c => c && c.name === n)[0] || null;   // 精确名·模拟 displayName/内插空格不被 findCharByName 解析
    ctx.extractJSON = (r) => { try { return JSON.parse(r); } catch (_) { return null; } };
    ctx.callAISmart = async (p) => { cap = p; return JSON.stringify(cfg.returns); };
    vm.createContext(ctx);
    vm.runInContext(fnSrc + '\nthis.__pick = pickHistoricalCandidates;', ctx, { filename: 'extracted-pick.js' });
    return ctx.__pick({}).then(r => ({ names: (r || []).map(c => c.name), prompt: cap }));
  }
  // 基线：GM 明确死者(dead / alive:false)绝不入选·非死者留
  let r = await runPick({ chars: [{ name: '死学者', alive: false, dead: true }, { name: '亡臣', alive: false }], returns: [
    { name: '死学者', age: 30, class: '寒门', probability: 1 },
    { name: '亡臣', age: 32, class: '士族', probability: 1 },
    { name: '活名士', age: 28, class: '寒门', probability: 1 } ] });
  assert(r.names.indexOf('死学者') < 0 && r.names.indexOf('亡臣') < 0, '条1·GM 明确死者绝不入选（实=' + r.names.join('、') + '）');
  assert(r.names.indexOf('活名士') >= 0, '条1·不在册应考名士应留');
  // 场景1·displayName 变体穿透（findCharByName 按 name 不解析 displayName·靠归一异名键集拦）
  r = await runPick({ chars: [{ name: '王安石', displayName: '王介甫（显示名）', alive: false, dead: true }], returns: [
    { name: '王介甫（显示名）', age: 30, class: '寒门', probability: 1 },
    { name: '活名士', age: 28, class: '寒门', probability: 1 } ] });
  assert(r.names.indexOf('王介甫（显示名）') < 0, '条1·死者 displayName 变体须被后置闸剔除（实=' + r.names.join('、') + '）');
  assert(r.names.indexOf('活名士') >= 0, '条1·displayName 场景非死者应留');
  // 场景2·内插空格（GM 侧脏空格「李 贽」·候选侧有/无空格两变体·两侧归一后皆命中）
  r = await runPick({ chars: [{ name: '李 贽', alive: false, dead: true }], returns: [
    { name: '李贽', age: 40, class: '寒门', probability: 1 },
    { name: '李 贽', age: 40, class: '寒门', probability: 1 },
    { name: '活名士', age: 28, class: '寒门', probability: 1 } ] });
  assert(r.names.indexOf('李贽') < 0 && r.names.indexOf('李 贽') < 0, '条1·死者名内插空格·两侧归一后有/无空格变体皆剔（实=' + r.names.join('、') + '）');
  assert(r.names.indexOf('活名士') >= 0, '条1·空格场景非死者应留');
  // 场景3·80 在世官员 + 1 死者·死者恒在 prompt 排除段（不被官员名单 slice(0,80) 挤出）
  const many = [];
  for (let i = 0; i < 80; i++) many.push({ name: '官员' + i, alive: true, officialTitle: '尚书' });
  many.push({ name: '亡卿', alive: false, dead: true });
  r = await runPick({ chars: many, returns: [{ name: '活名士', age: 28, class: '寒门', probability: 1 }] });
  assert(r.prompt.indexOf('亡卿') >= 0, '条2·80 官员+1 死者时·死者恒在 prompt 排除段（不被官员名单挤出）');
  // 场景4·条4·窗外年份剔除（strict·year1620·window100·[1520,1720]）
  r = await runPick({ mode: 'strict_hist', window: 100, year: 1620, dynasty: '明', chars: [], returns: [
    { name: '窗外人', age: 30, class: '寒门', historicalYearMet: 1140, nativeEra: '宋', probability: 1 },
    { name: '窗内人', age: 30, class: '寒门', historicalYearMet: 1600, nativeEra: '明', probability: 1 } ] });
  assert(r.names.indexOf('窗外人') < 0, '条4·窗外年份(1140∉[1520,1720])史实候选须剔除（实=' + r.names.join('、') + '）');
  assert(r.names.indexOf('窗内人') >= 0, '条4·窗内年份史实候选应留');
  // 场景5·条4·跨朝代剔除（strict·明·nativeEra宋）
  r = await runPick({ mode: 'strict_hist', window: 100, year: 1620, dynasty: '明', chars: [], returns: [
    { name: '跨代人', age: 30, class: '寒门', historicalYearMet: 1600, nativeEra: '宋', probability: 1 },
    { name: '本代人', age: 30, class: '寒门', historicalYearMet: 1600, nativeEra: '明', probability: 1 } ] });
  assert(r.names.indexOf('跨代人') < 0, '条4·strict 模式跨朝代(nativeEra宋≠明)史实候选须剔除（实=' + r.names.join('、') + '）');
  assert(r.names.indexOf('本代人') >= 0, '条4·本朝候选应留');
  // 场景6·演义模式(window=null)·不做时代硬剔（跨代人物保留·仅标 anomaly）
  r = await runPick({ mode: 'yanyi', year: 1620, dynasty: '明', chars: [], returns: [
    { name: '演义跨代', age: 30, class: '寒门', historicalYearMet: 1140, nativeEra: '宋', probability: 1 } ] });
  assert(r.names.indexOf('演义跨代') >= 0, '条4·演义模式(window=null)不做时代硬剔·跨代人物保留');
  // 场景7·条2·真实 schema 异名穿透（haoName 号名 / formerNames 曾用名·hao/courtesyName 死代码已剔）
  r = await runPick({ chars: [{ name: '王安石', haoName: '半山（号）', alive: false, dead: true }], returns: [
    { name: '半山（号）', age: 30, class: '寒门', probability: 1 }, { name: '活士', age: 28, class: '寒门', probability: 1 } ] });
  assert(r.names.indexOf('半山（号）') < 0 && r.names.indexOf('活士') >= 0, '条2·死者 haoName 号名变体须被剔除（真 schema 字段）');
  r = await runPick({ chars: [{ name: '李贽', formerNames: ['林载贽'], alive: false, dead: true }], returns: [
    { name: '林载贽', age: 40, class: '寒门', probability: 1 }, { name: '活士', age: 28, class: '寒门', probability: 1 } ] });
  assert(r.names.indexOf('林载贽') < 0 && r.names.indexOf('活士') >= 0, '条2·死者 formerNames 曾用名变体须被剔除（真 schema 字段）');
  // 场景8·条2·displayName 撞在世者 name·归属让位·在世者不被误杀
  r = await runPick({ chars: [{ name: '张三', displayName: '李贽', alive: false, dead: true }, { name: '李贽', alive: true }], returns: [
    { name: '李贽', age: 35, class: '寒门', probability: 1 } ] });
  assert(r.names.indexOf('李贽') >= 0, '条2·死者别名(displayName)撞在世者 name 时·在世者不被误杀（归属让位在世者）');
  // 场景9·条3·era 闸 fail-closed·数字字符串"1140"(窗外)转数后剔·"1600"(窗内)留
  r = await runPick({ mode: 'strict_hist', window: 100, year: 1620, dynasty: '明', returns: [
    { name: '串窗外', age: 30, class: '寒门', historicalYearMet: '1140', nativeEra: '明', probability: 1 },
    { name: '串窗内', age: 30, class: '寒门', historicalYearMet: '1600', nativeEra: '明', probability: 1 } ] });
  assert(r.names.indexOf('串窗外') < 0, '条3·数字字符串"1140"须 Number() 转换后按窗剔除（非 fail-open 绕过）');
  assert(r.names.indexOf('串窗内') >= 0, '条3·数字字符串"1600"窗内应留');
  // 场景10·条3·strict 下缺字段 / null → fail-closed 拒收；演义(window=null)不 gate
  r = await runPick({ mode: 'strict_hist', window: 100, year: 1620, dynasty: '明', returns: [
    { name: '缺年份', age: 30, class: '寒门', nativeEra: '明', probability: 1 },
    { name: 'null年份', age: 30, class: '寒门', historicalYearMet: null, nativeEra: '明', probability: 1 } ] });
  assert(r.names.indexOf('缺年份') < 0 && r.names.indexOf('null年份') < 0, '条3·strict 下缺失/null historicalYearMet 一律拒收（fail-closed）');
  r = await runPick({ mode: 'yanyi', year: 1620, dynasty: '明', returns: [{ name: '演义缺年', age: 30, class: '寒门', probability: 1 }] });
  assert(r.names.indexOf('演义缺年') >= 0, '条3·演义模式(window=null)不做 era 硬剔·缺年份候选保留');
  console.log('  [sliceD] ' + (PASS - start) + ' 断言通过（条1异名穿透+条2真schema/归属+条4 era-gate fail-closed）');
}

// ── Slice E：条2 行为锁·VM 实调 _kjpL12LlmReformerBio ──
async function sliceE() {
  const start = PASS;
  const bioSrc = readSrc('tm-keju-reformer-bio.js');
  function run(gmChars) {
    const ctx = baseCtx();
    ctx.window = {};
    let capturedPrompt = '';
    ctx.P = { ai: { key: 'k' }, conf: {}, playerInfo: {} };
    ctx.GM = { chars: gmChars, _kejuParadigm: { initEra: '宋' } };
    ctx.findCharByName = (n) => ctx.GM.chars.filter(c => c && c.name === n)[0] || null;
    ctx._buildTemporalConstraint = () => '\n<<TC_SENTINEL·平行历史铁律>>';
    ctx._tcScanMentionedNames = () => [];
    ctx.callAISmart = async (p) => { capturedPrompt = p; return JSON.stringify({
      text: '王介甫·抚州临川人。行熙宁新法·天下汹汹。卒于元祐元年·葬钟山。后世论其功过不一。',
      deathYear: 1086, birthYear: 1021, faction: '改革派'
    }); };
    vm.createContext(ctx);
    vm.runInContext(bioSrc, ctx, { filename: 'reformer-bio.js' });
    return { ctx, prompt: () => capturedPrompt };
  }
  // 传主在世 → 强清 deathYear + 剔书卒句 + sentinel 真达 prompt
  const alive = run([{ name: '王安石', alive: true }]);
  const bioA = await alive.ctx.window._kjpL12LlmReformerBio('王安石', [{ year: 1069, canonicalName: '熙宁变法', method: 'edict' }], { era: '宋' });
  assert(alive.prompt().indexOf('<<TC_SENTINEL') >= 0, '条2/条4·约束 sentinel 须真达 reformer-bio 的 LLM prompt');
  assert(bioA && bioA.deathYear === null, '条2·在世传主 deathYear 须强清为 null（实=' + (bioA && bioA.deathYear) + '）');
  assert(bioA && bioA.text.indexOf('卒于元祐元年') < 0, '条2·在世传主正文书卒句「卒于元祐元年」须剔除');
  assert(bioA && bioA.text.indexOf('熙宁新法') >= 0, '条2·剔书卒句后正文其余须保留');
  // 传主已死 → deathYear 保留（闸条件精确·非无差别清空）
  const dead = run([{ name: '王安石', alive: false, dead: true }]);
  const bioD = await dead.ctx.window._kjpL12LlmReformerBio('王安石', [{ year: 1069, canonicalName: '熙宁变法', method: 'edict' }], { era: '宋' });
  assert(bioD && bioD.deathYear === 1086, '条2·已故传主 deathYear 应保留（闸仅对在世者·实=' + (bioD && bioD.deathYear) + '）');
  // 直测句剔除器
  const scrub = alive.ctx.window._kjpL12ScrubDeathClaims('甲事。卒于1086年。乙事。', '某');
  assert(scrub.indexOf('卒于1086年') < 0 && scrub.indexOf('甲事') >= 0 && scrub.indexOf('乙事') >= 0, '条2·_kjpL12ScrubDeathClaims 应只剔书卒句、留其余');
  // 条3·Codex 六行矩阵（子句级主语判定·不误删他人卒句）
  const scrub3 = alive.ctx.window._kjpL12ScrubDeathClaims;
  let mx = scrub3('改革者之父先卒，后改革者亦卒于任上', '改革者');
  assert(mx.indexOf('改革者之父先卒') >= 0 && mx.indexOf('亦卒于任上') < 0, '条3矩阵①·「改革者之父先卒」留 + 传主卒子句删（合法父卒不丢失）');
  mx = scrub3('其父先卒，后改革者亦卒于任上', '改革者');
  assert(mx.indexOf('其父先卒') >= 0 && mx.indexOf('亦卒于任上') < 0, '条3矩阵②·「其父先卒」留 + 传主卒子句删（传主书卒不泄漏）');
  mx = scrub3('改革者卒后，门人继其志', '改革者');
  assert(mx.indexOf('门人继其志') >= 0 && mx.indexOf('卒后') < 0, '条3矩阵③·传主「卒后」子句删 + 「门人继其志」留（卒后已入死亡正则）');
  assert(scrub3('先考卒于家', '改革者') === '先考卒于家', '条3矩阵④·「先考卒于家」亲属词救·整句保留');
  assert(scrub3('改革者行新法。改革者卒于元祐元年。后世论其功过。', '改革者').indexOf('卒于元祐元年') < 0, '条3矩阵⑤·传主自身书卒句须删');
  assert(scrub3('其法仿商鞅。张居正卒于万历十年，考成法行。安石继之。', '王安石').indexOf('张居正卒于万历十年') >= 0, '条3矩阵⑥·他人名(张居正)紧邻死亡词·先例句保留');
  const neg = scrub3('传言其已卒，实则健在。后复起用。', '王安石');
  assert(neg.indexOf('实则健在') >= 0 && neg.indexOf('已卒') >= 0, '条1③·否定/转折(传言…实则健在)·死亡宣称存疑须整句保留');
  // 条4·变异红绿：删 clause 级 KIN 分支 → 「先考卒于家」失救被删（证亲属分支载重·非被通用人名正则兜住）
  const mutSrc = bioSrc.replace('_KJP_L12_KIN_RE.test(clause) ||', 'false ||');
  assert(mutSrc !== bioSrc, '条4·变异锚点存在（_kjpL12ClauseNotSubjectDeath 的 clause 级 KIN 分支）');
  function scrubFrom(srcText) { const c = baseCtx(); c.window = {}; c.P = { ai: {} }; c.GM = { chars: [] }; c.findCharByName = () => null; vm.createContext(c); vm.runInContext(srcText, c); return c.window._kjpL12ScrubDeathClaims; }
  assert(scrubFrom(mutSrc)('先考卒于家', '改革者').indexOf('先考卒于家') < 0, '条4·删 KIN 分支后「先考卒于家」必被删（变异转红·证 KIN 分支不可缺·未被通用人名正则兜住）');
  console.log('  [sliceE] ' + (PASS - start) + ' 断言通过（条2·deathYear闸+子句剔除+sentinel / 条3·六行矩阵+否定 / 条4·KIN 变异红绿）');
}

(async function main() {
  sliceA();
  sliceB();
  sliceC();
  await sliceD();
  await sliceE();
  console.log('PASS smoke-tc-keju-wave · 共 ' + PASS + ' 断言');
})().catch(function(e) { console.error('FAIL(异常): ' + (e && e.stack || e)); process.exit(1); });

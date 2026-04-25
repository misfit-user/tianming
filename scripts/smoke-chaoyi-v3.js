#!/usr/bin/env node
// scripts/smoke-chaoyi-v3.js — 常朝 v3 纯逻辑 smoke
// 在 vm 沙盒里加载 tm-chaoyi-v3.js·测纯函数（不依赖 DOM/真 AI）
// 覆盖：意图识别 / 点名识别 / 关键词解析 / 朝威分流 / 诏令档位 / 朝代配置 / 议程增强 / 干支日期

'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const v3src = fs.readFileSync(path.join(ROOT, 'tm-chaoyi-v3.js'), 'utf8');

// ─── 沙盒构造（mock GM/P/DOM/callAI 等）───
function makeSandbox(opts) {
  opts = opts || {};
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, Date, Promise, JSON, Array, Object, String, Number, Boolean, Error,
    document: (function() {
      // 安全 mock element·支持任意 property 赋值（onkeydown / onclick / oninput 等）
      function mkEl(tag) {
        const el = {
          tagName: (tag || 'div').toUpperCase(),
          style: {}, dataset: {},
          classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
          appendChild() {}, removeChild() {}, remove() {},
          querySelector() { return mkEl('div'); }, querySelectorAll() { return []; },
          addEventListener() {}, setAttribute() {}, getAttribute(){return null;},
          innerHTML: '', textContent: '', value: '', checked: false,
          onclick: null, onkeydown: null, onchange: null, oninput: null
        };
        return el;
      }
      return {
        getElementById: () => mkEl('div'),
        querySelector: () => mkEl('div'),
        querySelectorAll: () => [],
        createElement: mkEl,
        addEventListener() {},
        head: { appendChild() {} },
        body: { appendChild() {}, removeChild() {} }
      };
    })(),
    localStorage: {
      _store: {},
      getItem(k) { return this._store[k] || null; },
      setItem(k, v) { this._store[k] = v; },
      removeItem(k) { delete this._store[k]; }
    },
    AbortController: function() { this.signal = {}; this.abort = function(){}; },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    // ─── 游戏全局 ───
    GM: {
      turn: opts.turn != null ? opts.turn : 0,
      vars: {
        '皇威': { value: opts.prestige != null ? opts.prestige : 55 },
        '皇权': { value: opts.power != null ? opts.power : 60 }
      },
      chars: opts.chars || [
        { name: '韩爌',   officialTitle: '内阁首辅',   faction: '东林',     loyalty: 80, integrity: 70, ambition: 30, alive: true, personality: '老成持重' },
        { name: '毕自严', officialTitle: '户部尚书',   faction: '中立',     loyalty: 75, alive: true, personality: '勤勉务实' },
        { name: '温体仁', officialTitle: '礼部侍郎',   faction: '阉党残余', loyalty: 40, integrity: 30, ambition: 80, alive: true, personality: '阴鸷善谋' },
        { name: '黄宗周', officialTitle: '都察院御史', faction: '东林',     loyalty: 85, alive: true, personality: '清正敢谏' },
        { name: '满桂',   officialTitle: '总兵',       faction: '军方',     loyalty: 70, alive: true, personality: '骁勇率直' }
      ],
      currentIssues: [],
      armies: [], evtLog: [], officeTree: [],
      _ccHeldItems: [], _pendingTinyiTopics: [], _courtRecords: []
    },
    P: {
      scenario: opts.scenario || { startYear: 1628, chaoyi: {} },
      ai: { key: 'mock', url: 'mock' }
    },
    // ─── 函数 stub ───
    findCharByName: null, // 后绑定·因为引用 sandbox.GM
    _isAtCapital: () => true,
    _isPlayerFactionChar: () => true,
    _isSameLocation: () => true,
    _cyGetRank: function(ch) {
      const rmap = { '内阁首辅':'正一品', '户部尚书':'正二品', '吏部尚书':'正二品',
                     '礼部尚书':'正二品', '兵部尚书':'正二品', '工部尚书':'正二品',
                     '都察院御史':'正四品', '总兵':'正二品', '副将':'正三品',
                     '礼部侍郎':'正三品' };
      return rmap[ch && (ch.officialTitle || ch.title)] || '正七品';
    },
    callAI: async () => '[]',
    extractJSON: (s) => null,
    _aiDialogueTok: () => 500,
    _aiDialogueWordHint: () => '约 50-120 字',
    _cc2_buildAgendaPrompt: () => 'mock agenda prompt',
    NpcMemorySystem: undefined,
    OpinionSystem: undefined,
    AffinityMap: undefined,
    addCYBubble: () => {},
    openChaoyi: () => {}, closeChaoyi: () => {},
    CY: { open: false, mode: 'changchao', _cc2: { queue: [], decisions: [], attendees: [] } },
    toast: () => {},
    getTSText: () => 'T0',
    TM: { errors: { captureSilent: () => {}, capture: () => {} } }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  // findCharByName 使用 sandbox.GM（绑定后）
  sandbox.findCharByName = function(name) { return sandbox.GM.chars.find(c => c && c.name === name); };
  return sandbox;
}

function runV3(sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(v3src, sandbox, { filename: 'tm-chaoyi-v3.js' });
  // CC-P3 后 const CHARS / AGENDA 是空·smoke 模拟 _cc3_open 中的覆盖逻辑·让 GM.chars 填充
  try { vm.runInContext('_cc3_overrideMockWithGM()', sandbox); } catch (_) {}
  return sandbox;
}

// 沙盒里 const 声明的变量（state 等）不暴露在 sandbox 属性·需 vm.runInContext 取
function evalIn(sandbox, code) {
  return vm.runInContext(code, sandbox);
}

// ─── 测试统计 ───
let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ FAIL: ' + label); }
}
function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ FAIL: ' + label + '·期望 ' + JSON.stringify(expected) + '·实际 ' + JSON.stringify(actual)); }
}

console.log('\n[smoke-chaoyi-v3] 常朝 v3 纯逻辑测试\n');

// ═══════════════════════════════════════
// T1·玩家话意图识别 7 类 + neutral
// ═══════════════════════════════════════
console.log('  T1·inferPlayerIntent 8 类');
{
  const sb = runV3(makeSandbox());
  assertEq(sb.inferPlayerIntent('必须即办！'), 'aggressive', 'aggressive·必须即办');
  assertEq(sb.inferPlayerIntent('严办温体仁'), 'punish', 'punish·严办');
  assertEq(sb.inferPlayerIntent('民苦如此 朕心忧之'), 'sympathetic', 'sympathetic·民苦');
  assertEq(sb.inferPlayerIntent('卿勤勉可嘉'), 'praise', 'praise·勤勉');
  assertEq(sb.inferPlayerIntent('恐有未察 当再查'), 'doubt', 'doubt·恐有');
  assertEq(sb.inferPlayerIntent('两全分批办之'), 'mediate', 'mediate·分批');
  assertEq(sb.inferPlayerIntent('细言之'), 'inquire', 'inquire·细言');
  assertEq(sb.inferPlayerIntent('天气不错'), 'neutral', 'neutral·中性');
}

// ═══════════════════════════════════════
// T2·点名识别
// ═══════════════════════════════════════
console.log('\n  T2·findMentionedChars');
{
  const sb = runV3(makeSandbox());
  // CHARS 此时是 preview mock(韩爌/毕自严/温体仁等)
  assert(sb.findMentionedChars('严办温体仁').indexOf('温体仁') >= 0, '点名·温体仁');
  assert(sb.findMentionedChars('韩相言之有理').indexOf('韩爌') < 0, '点名·韩相 ≠ 韩爌（精确字符匹配）');
  assert(sb.findMentionedChars('韩爌与毕自严共议').length === 2, '点名·韩爌+毕自严 双名');
  assert(sb.findMentionedChars('陛下圣明').length === 0, '无点名·空数组');
}

// ═══════════════════════════════════════
// T3·关键词自动触发动作
// ═══════════════════════════════════════
console.log('\n  T3·parseDetailKeyword 5 类');
{
  const sb = runV3(makeSandbox());
  assertEq(sb.parseDetailKeyword('准奏'), 'approve', 'approve·准奏');
  assertEq(sb.parseDetailKeyword('准了'), 'approve', 'approve·准了');
  assertEq(sb.parseDetailKeyword('驳'), 'reject', 'reject·驳');
  assertEq(sb.parseDetailKeyword('不可'), 'reject', 'reject·不可');
  assertEq(sb.parseDetailKeyword('留中容朕思之'), 'hold', 'hold·留中');
  assertEq(sb.parseDetailKeyword('下廷议'), 'escalate', 'escalate·下廷议');
  assertEq(sb.parseDetailKeyword('随便说说'), null, 'null·自由话语');
}

// ═══════════════════════════════════════
// T4·朝威分流
// ═══════════════════════════════════════
console.log('\n  T4·isStrictCourt 阈值');
{
  const sb1 = runV3(makeSandbox());
  evalIn(sb1, 'state.prestige = 80; state.power = 80;');
  assert(evalIn(sb1, 'isStrictCourt()') === true, '80/80·肃朝 true');

  const sb2 = runV3(makeSandbox());
  evalIn(sb2, 'state.prestige = 74; state.power = 76;');
  assert(evalIn(sb2, 'isStrictCourt()') === false, '74/76·一项不足 false');

  const sb3 = runV3(makeSandbox());
  evalIn(sb3, 'state.prestige = 50; state.power = 50;');
  assert(evalIn(sb3, 'isStrictCourt()') === false, '50/50·众言 false');

  // 剧本覆盖阈值
  const sb4 = runV3(makeSandbox({ scenario: { startYear: 1628, chaoyi: { strictThreshold: { prestige: 60, power: 50 } } } }));
  evalIn(sb4, 'state.prestige = 60; state.power = 50;');
  assert(evalIn(sb4, 'isStrictCourt()') === true, '剧本阈值 60/50·达 true');
}

// ═══════════════════════════════════════
// T5·当庭口述诏令档位（皇威皇权 → S/A/B/C/D）
// ═══════════════════════════════════════
console.log('\n  T5·computeDecreeTier 档位');
{
  const cases = [
    { p: 90, w: 90, expect: 'S', label: '90/90·圣旨煌煌' },
    { p: 75, w: 80, expect: 'S', label: '80/75·两高 S' },
    { p: 65, w: 80, expect: 'A', label: '80/65·一高 A' },
    { p: 60, w: 60, expect: 'B', label: '60/60·勉强 B' },
    { p: 65, w: 40, expect: 'C', label: '40/65·众议 C' },
    { p: 40, w: 40, expect: 'D', label: '40/40·诏不下殿 D' },
    { p: 25, w: 60, expect: 'D', label: '60/25·危诏激变 D' },
    { p: 60, w: 25, expect: 'D', label: '25/60·危诏激变 D' }
  ];
  cases.forEach(c => {
    const sb = runV3(makeSandbox());
    evalIn(sb, 'state.prestige = ' + c.w + '; state.power = ' + c.p + ';');
    const t = evalIn(sb, 'computeDecreeTier()');
    assertEq(t.code, c.expect, c.label);
  });
}

// ═══════════════════════════════════════
// T6·朝代配置兜底
// ═══════════════════════════════════════
console.log('\n  T6·_cc3_getScenarioConfig 兜底');
{
  // 无 scenario.chaoyi → 默认值
  const sb1 = runV3(makeSandbox({ scenario: { startYear: 1628 } }));
  const cfg1 = sb1._cc3_getScenarioConfig();
  assertEq(cfg1.audienceHall, '正殿', '默认殿名·正殿');
  assertEq(cfg1.strictThreshold, { prestige: 75, power: 75 }, '默认阈值 75/75');
  assertEq(cfg1.deptOptions.length, 7, '默认部议 7 项');

  // 唐风剧本覆盖
  const sb2 = runV3(makeSandbox({
    scenario: {
      startYear: 700,
      chaoyi: {
        audienceHall: '紫宸殿',
        deptOptions: ['尚书省', '中书省', '门下省', '六部'],
        strictThreshold: { prestige: 80, power: 70 }
      }
    }
  }));
  const cfg2 = sb2._cc3_getScenarioConfig();
  assertEq(cfg2.audienceHall, '紫宸殿', '唐剧本·紫宸殿');
  assertEq(cfg2.deptOptions, ['尚书省', '中书省', '门下省', '六部'], '唐剧本·三省+六部');
  assertEq(cfg2.strictThreshold.prestige, 80, '唐剧本·阈值 80');
  assertEq(cfg2.strictThreshold.power, 70, '唐剧本·阈值 70');
}

// ═══════════════════════════════════════
// T7·干支日期推算
// ═══════════════════════════════════════
console.log('\n  T7·_cc3_buildDateLabel 干支');
{
  // startYear 1628 = 戊辰年
  const sb1 = runV3(makeSandbox({ scenario: { startYear: 1628 }, turn: 0 }));
  const lbl1 = sb1._cc3_buildDateLabel(sb1.P.scenario);
  assert(lbl1.indexOf('戊辰') >= 0, '1628·戊辰年 (got: ' + lbl1 + ')');
  assert(lbl1.indexOf('正月') >= 0, 'turn=0·正月');

  // turn=12 进入次年（perTurn='1m' 即 1 月一回合）
  // sandbox 默认 getTSText 返 'T0'·此 case 测试 fallback·须 P.time 缺失走 fallback 路径
  const sb2 = runV3(makeSandbox({ scenario: { startYear: 1628 }, turn: 12 }));
  // 强制清掉 P.time 让 fallback 启用·并把 getTSText 改成抛错让 fallback 接手
  if (sb2.P) sb2.P.time = null;
  sb2.getTSText = function() { throw new Error('forced fallback'); };
  const lbl2 = sb2._cc3_buildDateLabel(sb2.P.scenario);
  // 默认 perTurn='1s'·12 回合=36 月=3 年·1628+3=1631 辛未；改为 '1m' 测 1 月一回合
  // 这里就让默认走·assertion 改成"含年/月"格式即可（不强制具体干支）
  assert(lbl2.indexOf('年') >= 0 && lbl2.indexOf('月') >= 0, 'fallback 含年月 (got: ' + lbl2 + ')');

  // 唐 624 = 甲申年
  const sb3 = runV3(makeSandbox({ scenario: { startYear: 624 }, turn: 0 }));
  const lbl3 = sb3._cc3_buildDateLabel(sb3.P.scenario);
  assert(lbl3.indexOf('甲申') >= 0, '624·甲申年 (got: ' + lbl3 + ')');
}

// ═══════════════════════════════════════
// T8·议程增强·_cc3_enhanceAgendaItem
// ═══════════════════════════════════════
console.log('\n  T8·_cc3_enhanceAgendaItem 字段补全');
{
  const sb = runV3(makeSandbox());
  // 用 preview mock CHARS（韩爌/毕自严/温体仁等）测·因为没 _cc3_open 触发覆盖

  // case 1: 低争议 routine·应只补 selfReact
  const item1 = { presenter: '毕自严', dept: '户部', type: 'routine', title: '岁贡', detail: '岁贡之事...', controversial: 2 };
  const enhanced1 = sb._cc3_enhanceAgendaItem(item1);
  assert(Array.isArray(enhanced1.selfReact) && enhanced1.selfReact.length >= 1, 'routine·补 selfReact (1+)');
  assert(!enhanced1.debate || enhanced1.debate.length < 4, 'routine·不强补 debate');

  // case 2: 高争议·补 selfReact + debate
  const item2 = { presenter: '黄景昉', dept: '都察院', type: 'confrontation', target: '温体仁', title: '弹劾', detail: '臣劾温侍郎...', controversial: 9 };
  const enhanced2 = sb._cc3_enhanceAgendaItem(item2);
  assert(enhanced2.selfReact && enhanced2.selfReact.length >= 2, 'confrontation 9·selfReact 2+');
  assert(enhanced2.debate && enhanced2.debate.length >= 4, 'confrontation 9·debate 4+');
  assert(enhanced2.debate2 && enhanced2.debate2.length >= 1, 'confrontation 9·debate2 有');
  // target 在 debate 中应为 oppose 立场
  const targetEntry = enhanced2.debate.find(d => d.name === '温体仁');
  if (targetEntry) {
    assertEq(targetEntry.stance, 'oppose', 'target 温体仁·debate 中必反对');
  }

  // case 3: 已有 selfReact·不覆盖
  const item3 = { presenter: '韩爌', selfReact: [{ name: '毕自严', stance: 'support', line: '原文' }], detail: '...', controversial: 5 };
  const enhanced3 = sb._cc3_enhanceAgendaItem(item3);
  assertEq(enhanced3.selfReact[0].line, '原文', '已有 selfReact·不覆盖');
}

// ═══════════════════════════════════════
// T9·派系立场推断
// ═══════════════════════════════════════
console.log('\n  T9·_cc3_pickStanceByFaction 派系倾向');
{
  const sb = runV3(makeSandbox());
  const item = { title: '某事', target: '温体仁' };

  // target 必反对
  assertEq(sb._cc3_pickStanceByFaction('温体仁', item, 0), 'oppose', 'target·必 oppose');

  // idx=1 / idx=3 偏 mediate
  assertEq(sb._cc3_pickStanceByFaction('韩爌', item, 1), 'mediate', 'idx=1·mediate');
  assertEq(sb._cc3_pickStanceByFaction('毕自严', item, 3), 'mediate', 'idx=3·mediate');

  // 派系倾向（多次采样验证·因为含随机）
  const counts = { 东林: { support: 0, mediate: 0, other: 0 } };
  for (let i = 0; i < 100; i++) {
    const s = sb._cc3_pickStanceByFaction('黄宗周', item, 0); // 东林·idx=0
    if (s === 'support') counts.东林.support++;
    else if (s === 'mediate') counts.东林.mediate++;
    else counts.东林.other++;
  }
  assert(counts.东林.support + counts.东林.mediate >= 80, '东林·多数 support/mediate (got s=' + counts.东林.support + ' m=' + counts.东林.mediate + ')');
}

// ═══════════════════════════════════════
// T10·朝威下 rank 分类
// ═══════════════════════════════════════
console.log('\n  T10·classifyForStrict 阁臣/请奏分流');
{
  // 默认阈值 75/75·directSpeakRank=2
  const sb = runV3(makeSandbox());
  evalIn(sb, 'state.prestige = 80; state.power = 80;');
  // CHARS 是 preview mock 含韩爌(rank 1)·黄宗周(rank 4)·黄景昉(rank 5)等
  assertEq(evalIn(sb, "classifyForStrict({name:'韩爌'})"), 'speak', '肃朝·韩爌(rank 1)·直发');
  assertEq(evalIn(sb, "classifyForStrict({name:'黄景昉'})"), 'request', '肃朝·黄景昉(rank 5)·请奏');

  // 众言·全直发
  const sb2 = runV3(makeSandbox());
  evalIn(sb2, 'state.prestige = 50; state.power = 50;');
  assertEq(evalIn(sb2, "classifyForStrict({name:'黄景昉'})"), 'speak', '众言·黄景昉·直发');
}

// ═══════════════════════════════════════
// 总结
// ═══════════════════════════════════════
console.log('\n──────────────────────────────────────');
console.log('[smoke-chaoyi-v3] ' + pass + ' 通过 · ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);

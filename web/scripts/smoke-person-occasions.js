#!/usr/bin/env node
// 人物统一底子（人2）smoke：各机制扮演人物时读同一份「他是谁」（tm-person.js）。
//   · 人格核合成规矩：特质并 traitIds 与 traits（英文代号不进提示词）、口吻合一、立场与所求去重、名单一行。
//   · 开关 P.conf.personUnifiedEnabled 默认关：关着时问对、常朝的提示词与改造前逐字相同（金标准哈希）；
//     开着时各场合的人物段含同一份人格核（一字不差）。
// 金标准由改造前的文件在同一夹具上算出：TM_PERSON_SMOKE_GOLDEN_DIR=<放改造前文件的目录> node 本文件 → 打印哈希后退出。
// 施工单：E:/tianming-tmp/orders/人2-各机制接人物底子-施工单.md；设计：docs/guanben-roleplay-20260930/tuiyan.md 7.2 节。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
const GOLDEN_DIR = process.env.TM_PERSON_SMOKE_GOLDEN_DIR || '';
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const read = (f) => fs.readFileSync(path.join(GOLDEN_DIR || WEB, f), 'utf8');

function world() {
  const chars = [
    { name: '朱由检', isPlayer: true, alive: true },
    { name: '温体仁', officialTitle: '礼部侍郎', age: 54, stress: 40, stance: '中立', personalGoal: '入阁拜相，独揽票拟之权',
      personality: '阴柔多智', traitIds: ['t-sly', 't-ambitious'], traits: ['t-sly', 'shrewd', '谨守'],
      speechStyle: '言辞委婉、步步设防', diction: '言辞委婉', loyalty: 55, integrity: 30, ambition: 82, rankLevel: 3,
      family: '乌程温氏', faction: '明朝廷', party: '浙党', class: '士大夫', alive: true,
      aiPersonaText: '外示谦退，内实阴狠', _memory: [{ type: 'dialogue', turn: 3, event: '奏对时力陈东林结党之害，陛下默然不语' }] },
    { name: '温育仁', family: '乌程温氏', alive: true },
    { name: '钱谦益', officialTitle: '礼部右侍郎', personality: '负才傲物', diction: '好引经据典', alive: true },
    { name: '毛文龙', officialTitle: '东江总兵', personality: '跋扈', traitIds: ['t-brave'], stance: '保住东江饷源', personalGoal: '保住东江饷源',
      speechStyle: '粗豪直白', diction: '好称兵势', alive: true }
  ];
  return {
    sid: 'smoke', turn: 4, chars,
    vars: { '皇威': { value: 55 }, '皇权': { value: 60 } },
    characterArcs: {}, culturalWorks: [],
    classes: [{ name: '士大夫', demands: '复科举旧制、宽言路' }],
    _courtRecords: [], _edictLifecycle: [], _npcCommitments: {}, wenduiHistory: {},
    currentIssues: [], armies: [], evtLog: [], officeTree: [], qijuHistory: [], _npcActionsLog: [], zoushuPool: [],
    _ccHeldItems: [], _pendingTinyiTopics: []
  };
}

function mkEl(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(), style: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, remove() {}, querySelector() { return mkEl('div'); }, querySelectorAll() { return []; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    innerHTML: '', textContent: '', value: '', checked: false, className: ''
  };
}

function sandbox() {
  const GM = world();
  const c = {
    console: { log() {}, warn() {}, error() {} },
    Math, Date, JSON, Promise, Array, Object, String, Number, Boolean, RegExp, Error, parseInt, parseFloat, isFinite, Map, Set,
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    GM,
    P: { traitDefinitions: [{ id: 't-sly', name: '狡诈' }, { id: 't-ambitious', name: '野心勃勃' }, { id: 't-brave', name: '勇猛' }],
      conf: {}, ai: { key: 'mock', url: 'mock' }, scenario: { startYear: 1628, chaoyi: {} } },
    TM: { errors: { captureSilent() {}, capture() {} },
      PromptComposer: { buildAiPersonaText: (ch) => (ch.aiPersonaText ? '\n【NPC 内省·' + ch.name + '】\n' + ch.aiPersonaText + '\n' : ''), buildRecognitionState: () => '' } },
    document: { getElementById: () => mkEl('div'), querySelector: () => mkEl('div'), querySelectorAll: () => [], createElement: mkEl,
      addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} } },
    localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } },
    AbortController: function () { this.signal = {}; this.abort = function () {}; },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    findScenarioById: () => ({ era: '崇祯初年' }),
    escHtml: (s) => String(s == null ? '' : s), _$: () => null, toast() {},
    callAI: async () => '', callAIMessagesStream: undefined, extractJSON: () => null,
    _charRangeText: () => '（80-200字）', _aiDialogueWordHint: () => '约 50-120 字', _aiDialogueTok: () => 600,
    OpinionSystem: { getTotal: () => 46, getEventOpinion: () => 40 },
    AffinityMap: { getRelations: () => [{ name: '周延儒', value: 40 }] },
    NpcMemorySystem: { getMemoryContext: (n, o) => n + '记得上回会推之争' + (o && o.topic ? '（议题：' + o.topic + '）' : ''),
      recall: () => [{ event: '会推之争', turn: 3 }] },
    getNpcCognitionSnippet: () => '',
    _buildTemporalConstraint: () => '\n【时空约束】',
    _tcScanMentionedNames: (t, seed) => seed || [],
    EDICT_TYPES: {}, EDICT_STAGES: {}, NPC_RELATION_LABELS: {}, CONFLICT_LEVELS: {},
    _isAtCapital: () => true, _isPlayerFactionChar: () => true, _isSameLocation: () => true,
    _cyGetRank: () => '正三品', _cc2_buildAgendaPrompt: () => 'mock agenda prompt',
    addCYBubble() {}, openChaoyi() {}, closeChaoyi() {}, getTSText: () => 'T4',
    CY: { open: false, mode: 'changchao', _cc2: { queue: [], decisions: [], attendees: [] } }
  };
  c.findCharByName = (n) => GM.chars.find((x) => x && x.name === n);
  c.window = c; c.globalThis = c; c.global = c;
  vm.createContext(c);
  ['tm-person.js', 'tm-wendui.js', 'tm-wendui-persona-views.js'].forEach((f) => vm.runInContext(read(f), c, { filename: f }));
  const cc = ['tm-chaoyi-changchao-adapter.js', 'tm-chaoyi-changchao.js', 'tm-chaoyi-changchao-flows.js'].map(read).join('\n');
  vm.runInContext(cc, c, { filename: 'changchao-trio.js' });
  try { vm.runInContext('_cc3_overrideMockWithGM()', c); } catch (_) {}
  // 截下常朝自发表态那一路的提示词（不调模型）
  c.__captured = [];
  c._cc3_makeMessagesWithSystem = (p) => { c.__captured.push(p); return [{ role: 'user', content: p }]; };
  c.callAIMessages = async () => '{"stance":"oppose","line":"臣以为不可"}';
  return c;
}

const ITEM = { title: '会推阁臣', dept: '吏部', presenter: '王永光', detail: '阁臣出缺，请会推补之', selfReact: [], debate: [] };

async function prompts(c) {
  const wen = c.GM.chars[1];
  c._wenduiMode = 'formal';
  const wendui = c._wdBuildPrompt(wen, '温体仁');
  const reply = c.buildNpcPrompt('温体仁', ITEM, '卿以为如何', 'oppose', 'neutral', false);
  c.__captured.length = 0;
  await c._cc3_aiGenReact('温体仁', ITEM, 'selfReact');
  const react = c.__captured[0] || '';
  return { wendui, reply, react };
}

(async () => {
  if (GOLDEN_DIR) {
    const g = await prompts(sandbox());
    console.log(JSON.stringify({ wendui: sha(g.wendui), reply: sha(g.reply), react: sha(g.react), lengths: [g.wendui.length, g.reply.length, g.react.length] }, null, 2));
    return;
  }

  // ── 1. 人格核合成 ──
  const c = sandbox();
  const P2 = c.TM.Person;
  const [, wen, , qian, mao] = c.GM.chars;
  eq(P2.on(), false, '开关默认关');
  eq(Array.from(P2.traitNames(wen)), ['狡诈', '野心勃勃', '谨守'], '特质并 traitIds 与 traits：认得出的用定义名，去重；含汉字的照写；英文代号不写');
  eq(P2.speechText(wen), '言辞委婉、步步设防', '口吻与 diction 互相包含只写一份');
  eq(P2.speechText(mao), '粗豪直白；好称兵势', '口吻与 diction 不同时并写');
  eq(P2.speechText(qian), '好引经据典', '没有 speechStyle 用 diction');
  eq(P2.speechText({ speechStyle: '见帝则匍匐。', diction: '善察言观色' }), '见帝则匍匐。善察言观色', '口吻以句号收尾时不再加分号');
  ok(P2.coreText({ name: '甲', personality: '阴狠·狡诈', traitIds: ['t-sly', 't-brave'] }).includes('【性情】阴狠·狡诈；特质：勇猛\n'), '性情原文已有的字眼，特质里不重写');
  eq(P2.coreText(wen), '【人物】温体仁（礼部侍郎），年54，当前压力40（焦虑不安）\n【性情】阴柔多智；特质：狡诈、野心勃勃、谨守\n【立场】中立\n【所求】入阁拜相，独揽票拟之权\n【口吻】言辞委婉、步步设防\n', '人格核');
  ok(!P2.coreText(mao).includes('【立场】') && P2.coreText(mao).includes('【所求】保住东江饷源'), '立场与所求相同只写所求');
  eq(P2.line(wen), '温体仁（礼部侍郎）：阴柔多智；特质狡诈、野心勃勃、谨守；所求入阁拜相，独揽票拟之权', '名单一行');
  ok(P2.line(wen, { goalMax: 4 }).endsWith('所求入阁拜相…'), '名单一行的所求可截');
  const short = P2.brief(wen, { detail: 'brief', topic: '会推阁臣' });
  ok(short.startsWith(P2.coreText(wen)) && short.includes('【NPC 内省·温体仁】') && short.includes('【处境】势力：明朝廷｜党派：浙党｜阶层：士大夫｜家族：乌程温氏｜忠诚55·清廉30·野心82'), '精简档：人格核、人设长文、处境一行');
  ok(short.includes('（议题：会推阁臣）') && short.includes('【往次问对记忆】'), '精简档：记忆按议题回想，带往次问对');
  const full = P2.brief(wen, {});
  ok(full.startsWith(P2.coreText(wen)) && full.includes('【阶层诉求】复科举旧制') && full.includes('【同族】温育仁') && full.includes('【能力】') && !full.includes('【个人语言风格】'), '完整档：另有阶层诉求、同族、能力；口吻不重复');

  // ── 2. 开关关着：问对、常朝两路提示词与改造前逐字相同 ──
  // 由改造前（a8b8754d）的六个文件在同一夹具上算出：问对 2113 字、常朝回应 438 字、自发表态 1372 字
  const GOLDEN = {
    wendui: 'b060ce95e7fbfb66a87a4232ecbfeea24b240a6ddd3e6c996ad442c849d0835c',
    reply: '86c3c619b2bfb9c6ec7d93d1b52249766e6076cfdfd8555bb8294adb29c80f8e',
    react: 'd92975773b2c063165b25c2a9de79428edae9cc27632cb8b45a05e9eab095390'
  };
  const off = await prompts(c);
  eq(sha(off.wendui), GOLDEN.wendui, '关着：问对提示词逐字不变');
  eq(sha(off.reply), GOLDEN.reply, '关着：常朝回应陛下的提示词逐字不变');
  eq(sha(off.react), GOLDEN.react, '关着：常朝自发表态的提示词逐字不变');
  ok(off.react.includes('特质：t-sly·shrewd·谨守'), '（改造前的毛病）关着时自发表态把 traits 原样拼进去');

  // ── 3. 开关开着：各场合读同一份人格核 ──
  c.P.conf.personUnifiedEnabled = true;
  eq(P2.on(), true, '开关开');
  const on = await prompts(c);
  const core = P2.coreText(wen);
  ok(on.wendui.includes(core) && !on.wendui.includes('【人设】特质:') && !on.wendui.includes('【个人语言风格】'), '开着：问对的人设换成人格核，口吻不重复');
  ok(on.reply.includes(P2.brief(wen, { detail: 'brief', topic: '会推阁臣' })) && on.reply.includes('【朝班】品级 3') && !on.reply.includes('性格：阴柔多智'), '开着：常朝回应读精简档，留朝班');
  ok(on.reply.includes('合乎上面所写你的性情与口吻') && on.reply.includes('陛下方才说：「卿以为如何」'), '开着：常朝场合规矩照旧');
  ok(on.react.includes(P2.brief(wen, { detail: 'brief', topic: '会推阁臣' })) && !on.react.includes('── 你的档案 ──'), '开着：常朝自发表态读精简档');
  ok(!/shrewd|t-sly/.test(on.react) && !/shrewd|t-sly/.test(on.reply), '开着：英文代号不进提示词');
  ok(on.react.includes('── 今日早朝议题 ──') && on.react.includes('议题：「会推阁臣」'), '开着：自发表态的议题段照旧');
  for (const k of ['wendui', 'reply', 'react']) ok(on[k].split(core).length === 2, '开着：' + k + ' 里人格核出现且只出现一次');

  // ── 4. 接线与守卫 ──
  ok(read('tm-patches.js').includes("_togglePConf(\\'personUnifiedEnabled\\'"), '设置面板有「人物统一底子」开关');
  ok(read('tm-player-settings.js').includes('personUnifiedEnabled:'), '开关有提示语');
  console.log('[smoke-person-occasions] pass assertions=' + checks);
})().catch((e) => { console.error('[smoke-person-occasions] FAIL', e && e.message || e); process.exit(1); });

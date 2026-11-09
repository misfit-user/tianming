#!/usr/bin/env node
// 人物统一底子（人2）smoke：各机制扮演人物时读同一份「他是谁」（tm-person.js）。
//   · 人格核合成规矩：特质并 traitIds 与 traits（英文代号不进提示词）、口吻合一、立场与所求去重、名单一行。
//   · 开关 P.conf.personUnifiedEnabled 默认关：关着时问对、常朝、廷议、朝议插话、常朝议程名单、御前、奏疏、书信回信、NPC 自主决策的提示词
//     与改造前逐字相同（金标准哈希）；开着时各场合的人物段含同一份人格核（一字不差）。
//   · 认知画像（sc07 写的）：开着时人格只认人格核，画像里的自识、人格、口吻、史标不写，其余精简档、完整档读同一段；奏疏名单带知与不知。
// 金标准由改造前的文件在同一夹具上算出：TM_PERSON_SMOKE_GOLDEN_DIR=<放改造前文件的目录> node 本文件 → 打印哈希后退出。
//   问对、常朝两路取 a8b8754d（人2 第一片之前）；廷议、插话、议程名单取 38ffde2a（第二片之前）；御前取 fe3076dd（第三片之前）；奏疏取 c563c01b（第四片之前）；书信取 ca9ccef3（第五片之前）；NPC 自主取 c19a05b7（第六片之前）；带认知画像的问对、常朝取 1af53976（画像这一刀之前）。
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

// 廷议、朝议插话、常朝议程名单另开一个夹具：多载 tm-chaoyi.js、tm-chaoyi-tinyi.js（它们会换掉上面的几样桩子，
// 所以不和问对、常朝两路共用，免得动了那三份金标准）
function courtSandbox() {
  const c = sandbox();
  vm.runInContext(read('tm-chaoyi.js') + '\n' + read('tm-chaoyi-tinyi.js'), c, { filename: 'chaoyi-tinyi.js' });
  c.addCYBubble = () => mkEl('div');
  c._ty2_enterDecide = () => {};
  c._ty2_render = () => {};
  c.NpcMemorySystem.remember = () => {};
  c.__court = [];
  c.callAI = async (p) => { c.__court.push(p); return '[]'; };
  c.callAIMessagesStream = async (msgs) => { c.__court.push(msgs[0].content); return '{"stance":"支持","line":"臣附议"}'; };
  c.extractJSON = (raw) => { try { return JSON.parse(raw); } catch (_) { return null; } };
  return c;
}

const COURT_LABEL = { tinyi: '廷议发言', judge: '廷议立场迁移判定', mediate: '廷议折中', override: '逆众议后判谁反弹',
  interject: '朝议插话回应', agenda: '常朝议程（在场官员名单）' };

// 御前（人2 第三片）：在廷议夹具上再载 tm-chaoyi-yuqian.js（同样单开一个，不碰前面的金标准）
function yqSandbox() {
  const c = courtSandbox();
  vm.runInContext(read('tm-chaoyi-yuqian.js'), c, { filename: 'tm-chaoyi-yuqian.js' });
  c.addCYBubble = () => mkEl('div');
  c._yq2_offerFollowUp = () => {};
  c._yq2_finalEnd = () => {};
  return c;
}

const YQ_LABEL = { speak: '御前直陈', deep: '御前深问', leak: '御前泄密判定' };

async function yqPrompts(c) {
  const CY = c.CY, out = {};
  CY.open = true; CY._abortChaoyi = false;
  CY._yq2 = { topic: '会推阁臣', advisors: ['温体仁', '钱谦益'], opinions: {}, candorMap: {}, record: 'normal', _transcript: '',
    decision: { mode: '准奏', custom: '' } };
  const take = async (fn) => { c.__court.length = 0; await fn(); return c.__court[0] || ''; };
  out.speak = await take(() => c._yq2_oneAdvisorSpeak('温体仁', 1));
  out.deep = await take(() => c._yq2_doAskAdvisor('温体仁', '卿以为谁可入阁'));
  // 泄密是掷骰的：这一下让它必泄，好截下判谁泄密的提示词
  const realMath = c.Math;
  c.Math = Object.create(realMath, { random: { value: () => 0 } });
  try { out.leak = await take(() => c._yq2_evaluateLeak()); } finally { c.Math = realMath; }
  return out;
}

// 奏疏（人2 第四片）：genMemorialsAI 一次替好几个人执笔，候选上奏人名单每人一行（tm-memorials.js）
function memSandbox() {
  const c = sandbox();
  vm.runInContext(read('tm-memorials.js'), c, { filename: 'tm-memorials.js' });
  c.__mem = [];
  c.callAISmart = async (p) => { c.__mem.push(p); return '[]'; };
  c.extractJSON = (raw) => { try { return JSON.parse(raw); } catch (_) { return null; } };
  c.renderMemorials = () => {};
  c._getCharRange = () => [300, 600];  // tm-ai-infra-model-detect.js 里的，夹具不载
  return c;
}

async function memPrompt(c) {
  c.__mem.length = 0;
  await c.genMemorialsAI(3);
  return c.__mem[0] || '';
}

// 书信（人2 第五片）：人物给天子回信，单人执笔（tm-hongyan-office.js _generateLetterReply）
function letterSandbox() {
  const c = sandbox();
  vm.runInContext(read('tm-hongyan-office.js'), c, { filename: 'tm-hongyan-office.js' });
  c.__letter = [];
  c.callAI = (p) => { c.__letter.push(p); return Promise.resolve('臣谨复。'); };
  c.getCharacterPersonalityBrief = (ch) => ch.name + ' 理性务实·善于结交';  // tm-npc-engine.js 里的八维短语，夹具不载
  return c;
}

// NPC 自主（人2 第六片）：tm-npc-decision-ai-driven.js——一人单独决策的「本人」资料、几人同批决策的名单
function npcSandbox() {
  const c = sandbox();
  c.TM.NPC = { ActionLedger: {
    findChar: (q) => c.GM.chars.find((x) => x && q && (x.name === q.name)),
    capture: () => ({}), current: () => true,
    state: () => ({ planExposure: {}, schedule: {}, sequence: 0, modelTurn: c.GM.turn, modelCalls: 0 }),
    ensurePlans: () => [], planView: () => null, commitments: () => [], prepare() {}, due: () => false } };
  c.NpcBehaviorRegistry = { list: () => ['none', 'petition'] };
  c._npcAbilityProfile = () => ({});
  vm.runInContext(read('tm-npc-decision-ai-driven.js'), c, { filename: 'tm-npc-decision-ai-driven.js' });
  c.__npc = [];
  c.callAI = async (p) => { c.__npc.push(p); return '[]'; };
  c.extractJSON = (raw) => { try { return JSON.parse(raw); } catch (_) { return null; } };
  return c;
}

// 认知画像（11-09）：片段用真的 getNpcCognitionSnippet（从 tm-utils.js 截出这一个函数载进夹具），栏名一改这里就红
const COG = {
  温体仁: { selfIdentity: '浙江乌程人·礼部侍郎·浙党之望', personalityCore: '阴狡柔佞·外温文而内藏机心', speechThread: '恒言「臣愚以为」「容臣熟思之」',
    historicalVoice: '崇祯朝首辅·排东林而专政', abilityAwareness: '长于揣摩上意', currentFocus: '迎合圣意而藏其私', attitudeTowardsPlayer: '阳恭阴测',
    knows: ['己上停祠条陈。', '崔呈秀乞退留中。', '周延儒来与密议。', '第四条不进'], doesntKnow: ['崔呈秀谋帝之实。', '帝对己之真实观感。', '第三条不进'],
    agenda: '入阁为首辅、破东林。', _identityInitialized: true },
  温育仁: { personalityCore: '谨小慎微', speechThread: '唯唯诺诺', currentFocus: '为兄奔走' }
};
function withCog(c) {
  const m = read('tm-utils.js').match(/function getNpcCognitionSnippet\(name, opts\) \{[\s\S]*?\r?\n\}\r?\n/);
  if (!m) throw new Error('tm-utils.js 里找不到 getNpcCognitionSnippet');
  vm.runInContext(m[0], c, { filename: 'tm-utils.js#getNpcCognitionSnippet' });
  c.GM._npcCognition = JSON.parse(JSON.stringify(COG));
  return c;
}

async function npcPrompts(c) {
  const wen = c.GM.chars[1], qian = c.GM.chars[3];
  const self = JSON.stringify(c.buildNpcBehaviorContext(wen).self);
  c.__npc.length = 0;
  await c.batchNpcDecisions([wen, qian], c.buildNpcBehaviorContext(), {});
  return { self, batch: c.__npc[0] || '' };
}

async function letterPrompt(c) {
  c.__letter.length = 0;
  c.GM.letters = [];
  const letter = { to: '温体仁', from: '玩家', letterType: 'secret', content: '会推阁臣，卿意属谁？', _cipher: 'none', status: 'delivered' };
  c._generateLetterReply(letter);
  await Promise.resolve();
  return c.__letter[0] || '';
}

async function courtPrompts(c) {
  const CY = c.CY, out = {};
  CY.open = true; CY._abortChaoyi = false;
  CY._ty2 = { topic: '会推阁臣', topicType: 'appointment', topicCustom: '', roundNum: 1, attendees: ['温体仁', '钱谦益', '毛文龙'],
    stances: { 温体仁: { current: '折中', confidence: 55 }, 钱谦益: { current: '反对', confidence: 60 }, 毛文龙: { current: '支持', confidence: 40 } },
    _allSpeeches: [], stanceHistory: [], _playerInterjects: [] };
  const said = [{ name: '钱谦益', stance: '反对', line: '会推当出公论，不可以私意左右' }];
  const take = async (fn) => { c.__court.length = 0; await fn(); return c.__court[0] || ''; };
  out.tinyi = await take(() => c._ty2_genOneSpeech('温体仁', 1, said));
  out.judge = await take(() => c._ty2_judgeStanceShifts(said));
  out.mediate = await take(() => c._ty2_offerMediation());
  out.override = await take(() => c._ty2_afterOverride({ oppose: [{ name: '温体仁' }, { name: '钱谦益' }], support: [] }, '允行'));
  out.interject = await take(() => c._cyInterjectRespond('温体仁以为如何', { kind: 'tinyi', topic: '会推阁臣', attendees: ['温体仁', '钱谦益'], stances: CY._ty2.stances, round: 1, noJishi: true }));
  CY._cc2 = { queue: [], decisions: [], attendees: [{ name: '温体仁', title: '礼部侍郎', faction: '明朝廷', party: '浙党' }, { name: '毛文龙', title: '东江总兵' }, { name: '无名氏', title: '给事中' }] };
  out.agenda = c._cc2_buildAgendaPrompt();
  return out;
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
    const gc = await courtPrompts(courtSandbox());
    const court = {}, lengths = {};
    Object.keys(COURT_LABEL).forEach((k) => { court[k] = sha(gc[k]); lengths[k] = gc[k].length; });
    console.log(JSON.stringify({ court, lengths }, null, 2));
    const gy = await yqPrompts(yqSandbox());
    const yq = {}, yqLen = {};
    Object.keys(YQ_LABEL).forEach((k) => { yq[k] = sha(gy[k]); yqLen[k] = gy[k].length; });
    console.log(JSON.stringify({ yuqian: yq, lengths: yqLen }, null, 2));
    const gm = await memPrompt(memSandbox());
    console.log(JSON.stringify({ memorial: sha(gm), length: gm.length }, null, 2));
    const gl = await letterPrompt(letterSandbox());
    console.log(JSON.stringify({ letter: sha(gl), length: gl.length }, null, 2));
    const gn = await npcPrompts(npcSandbox());
    console.log(JSON.stringify({ npcSelf: sha(gn.self), npcBatch: sha(gn.batch), lengths: [gn.self.length, gn.batch.length] }, null, 2));
    const gg = await prompts(withCog(sandbox()));
    console.log(JSON.stringify({ cogOff: { wendui: sha(gg.wendui), reply: sha(gg.reply), react: sha(gg.react) }, lengths: [gg.wendui.length, gg.reply.length, gg.react.length] }, null, 2));
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

  // ── 4. 廷议、朝议插话、常朝议程名单（人2 第二片）：关着逐字不变 ──
  // 由改造前（38ffde2a）的文件在同一夹具上算出：廷议发言 380 字、立场迁移 311、折中 97、逆众议 304、插话 200、议程 1019
  const COURT_GOLDEN = {
    tinyi: '221cc2ab93cb96fe4a1346d0897669aa9b68e28f6bf169710151d3dcc4bd8e57',
    judge: '205aa98a61af9a658358386249a0154dc13e1fc3317ea8baf590f96a2f021aba',
    mediate: '3c4e8f27b9d7d3737d06b9e917e4aa6240a8d8081ef80206314b230358206f70',
    override: '4940f39499cdea87a4c4e74e72729bf7b045376969ee65812e7ce9213a825a37',
    interject: '2e490d809aade8990553add2b5edf4ec322f333f627548c596a4c0e2867713e2',
    agenda: 'e370eea5a04da710e762a820d9b783b5f5e3a666f1f4b19e72db99adf96dd634'
  };
  const cc = courtSandbox();
  const coff = await courtPrompts(cc);
  for (const k of Object.keys(COURT_GOLDEN)) eq(sha(coff[k]), COURT_GOLDEN[k], '关着：' + COURT_LABEL[k] + '提示词逐字不变');
  ok(coff.judge.includes('deceitful 随风倒') && coff.mediate.indexOf('【人物】') < 0, '（改造前的毛病）立场迁移的规矩里夹着英文代号；折中者只有名字');

  // ── 5. 开着：廷议、插话、议程名单读同一份底子 ──
  cc.P.conf.personUnifiedEnabled = true;
  const con = await courtPrompts(cc);
  const P3 = cc.TM.Person, wen3 = cc.GM.chars[1];
  const brief3 = P3.brief(wen3, { detail: 'brief', topic: '会推阁臣' });
  const row3 = (max) => P3.line(wen3, { noName: true, goalMax: max });
  eq(row3(20), '阴柔多智；特质狡诈、野心勃勃、谨守；所求入阁拜相，独揽票拟之权', '名单一行不带名字的写法');
  ok(con.tinyi.includes('你扮演温体仁，在廷议上发言。\n' + brief3) && con.tinyi.includes('【朝班】') && !con.tinyi.includes('  性格：'), '开着：廷议发言读精简档，留朝班');
  ok(!con.tinyi.includes('【此人记忆与心性】') && !con.tinyi.includes('  学识：'), '开着：廷议发言记忆不重复写，没有学识不写空行');
  ok(con.tinyi.includes('他官立场：钱谦益:反对') && con.tinyi.includes('本轮已发言') && con.tinyi.includes('"reason":"内在动机"'), '开着：廷议场合规矩照旧');
  ok(con.judge.includes('温体仁：折中（confidence 55）｜' + row3(20) + '｜党:浙党') && con.judge.includes('狡诈者随风倒') && !con.judge.includes('deceitful'), '开着：立场迁移名单读名单一行，规矩里不夹英文代号');
  ok(con.mediate.includes(brief3) && con.mediate.includes('合乎上面所写你的性情与口吻'), '开着：折中者带上自己的底子');
  ok(con.override.includes('温体仁(礼部侍郎) 党:浙党 忠55 野82｜' + row3(20) + '\n'), '开着：逆众议后的名单补上名单一行');
  ok(con.interject.includes('你扮演温体仁，此议眼下持「折中」。\n' + brief3) && con.interject.includes('须切合上面所写你的性情与口吻，并顾及你此议所持') && !con.interject.includes('性格：阴柔多智'), '开着：朝议插话读精简档，此议所持与素来立场分开写');
  ok(con.agenda.includes('温体仁(礼部侍郎) 属明朝廷 党浙党｜' + row3(16) + '\n') && con.agenda.includes('  无名氏(给事中)\n') && !con.agenda.includes(' 性:'), '开着：常朝议程名单读名单一行');
  ok(Object.keys(con).every((k) => !/shrewd|t-sly/.test(con[k])), '开着：英文代号不进廷议、插话、议程的提示词');
  for (const k of ['tinyi', 'mediate', 'interject']) ok(con[k].split(P3.coreText(wen3)).length === 2, '开着：' + COURT_LABEL[k] + '里人格核出现且只出现一次');
  ok([on.wendui, on.reply, on.react, con.tinyi, con.mediate, con.interject].every((s) => s.includes(core)), '开着：问对、常朝两路、廷议发言、折中、插话读到的人格核一字不差');
  // 交办凭据的 helper 在 TM.ImperialOrders 在时总带标题：此人没有交办时，精简档不写空标题（真档里温体仁就是这样）
  cc.TM.ImperialOrders = { context: () => '' };
  ok(!P3.brief(wen3, { detail: 'brief' }).includes('【本人交办与复命凭据】'), '精简档：交办凭据只有标题时不写');
  cc.TM.ImperialOrders = { context: () => '\n  奉旨查核会推名单（未复命）' };
  ok(P3.brief(wen3, { detail: 'brief' }).includes('【本人交办与复命凭据】\n  奉旨查核会推名单（未复命）'), '精简档：有交办时照写');
  delete cc.TM.ImperialOrders;

  // ── 6. 御前（人2 第三片）：关着逐字不变，开着读同一份底子 ──
  // 由改造前（fe3076dd）的文件在同一夹具上算出：直陈 282 字、深问 141、泄密判定 209
  const YQ_GOLDEN = {
    speak: '2f7aabb5d32521fb6a108634443ef5a256cd6c9e3edc77f810a9adf8694a08e0',
    deep: '896a4462b7db76f650ddf298aa61fa5b942a55aa7c7b0087f833b0c3f743ef61',
    leak: '68fee1d61bb10c30caae7d675a1c69c5a532c691c07d01bb0411e3aa9187ce29'
  };
  const yc = yqSandbox();
  const yoff = await yqPrompts(yc);
  for (const k of Object.keys(YQ_GOLDEN)) eq(sha(yoff[k]), YQ_GOLDEN[k], '关着：' + YQ_LABEL[k] + '提示词逐字不变');
  yc.P.conf.personUnifiedEnabled = true;
  const yon = await yqPrompts(yc);
  const P4 = yc.TM.Person, wen4 = yc.GM.chars[1];
  ok(yon.speak.includes('你扮演温体仁，在御前密议中直陈。\n' + P4.brief(wen4, { detail: 'brief', topic: '会推阁臣' })) && !yon.speak.includes('性格：阴柔多智') && !yon.speak.includes('【此人记忆与心性】'), '开着：御前直陈读精简档，记忆不重复写');
  ok(yon.speak.includes('你的坦白度：77.5/100') && yon.speak.includes('"inwardThought"') && !yon.speak.includes('学识：'), '开着：御前场合规矩照旧，没有学识不写空行');
  ok(yon.deep.includes('你扮演温体仁，御前密议中陛下单独深问你。\n' + P4.brief(wen4, { occasion: 'yuqian', detail: 'full', topic: '会推阁臣' })) && yon.deep.includes('【能力】') && !yon.deep.includes('【此人记忆与心性】'), '开着：御前深问读完整档（单人深谈，同问对一档），记忆不再截 500 字另拼');
  ok(yon.deep.includes('皇帝再深问：卿以为谁可入阁') && yon.deep.includes('坦白度:77.5'), '开着：深问的场合规矩照旧');
  ok(yon.leak.includes('与会者：\n  温体仁｜' + P4.line(wen4, { noName: true, goalMax: 20 }) + '\n  钱谦益｜负才傲物\n'), '开着：泄密判定的与会者每人一行性情、特质、所求');
  ok(Object.keys(yon).every((k) => !/shrewd|t-sly/.test(yon[k])), '开着：英文代号不进御前的提示词');
  for (const k of ['speak', 'deep']) ok(yon[k].split(P4.coreText(wen4)).length === 2, '开着：' + YQ_LABEL[k] + '里人格核出现且只出现一次');
  ok([yon.speak, yon.deep].every((s) => s.includes(core)), '开着：御前直陈、深问读到的人格核与问对、常朝、廷议一字不差');

  // ── 7. 奏疏（人2 第四片）：一次替好几个人执笔，候选上奏人名单每人一行 ──
  // 由改造前（c563c01b）的文件在同一夹具上算出：3956 字
  const MEM_GOLDEN = 'e5e53ec27d85986a1b5b34339b8c504f5f44a03f17315d34a06c9ca4df5dcada';
  const mc = memSandbox();
  const moff = await memPrompt(mc);
  eq(sha(moff), MEM_GOLDEN, '关着：奏疏提示词逐字不变');
  ok(moff.includes(' 狡诈、野心勃勃 目标:入阁拜相，独揽票拟之权 ') && moff.includes(' 负才傲物 '), '（改造前）有特质的只写特质名不写性格，没有的只写性格；口吻一个字都没有');
  mc.P.conf.personUnifiedEnabled = true;
  const mon = await memPrompt(mc);
  const P5 = mc.TM.Person, wen5 = mc.GM.chars[1];
  const row5 = P5.line(wen5, { noName: true, goalMax: 25, speech: true });
  eq(row5, '阴柔多智；特质狡诈、野心勃勃、谨守；所求入阁拜相，独揽票拟之权；口吻言辞委婉、步步设防', '名单一行带口吻的写法');
  eq(P5.line({ name: '甲', personality: '阴狡。', personalGoal: '入阁。', speechStyle: '温文。' }, { noName: true, speech: true }), '阴狡。所求入阁。口吻温文。', '名单一行：前一段以句号收尾时不再加分号（真档里温体仁「破东林。；口吻」）');
  ok(mon.includes('1. 温体仁(礼部侍郎) [在京] 忠55') && mon.includes(' 家:乌程温氏 ' + row5 + ' ') && !mon.includes('目标:入阁'), '开着：奏疏候选名单的特质、目标两栏换成名单一行（带口吻）');
  ok(mon.includes('钱谦益(礼部右侍郎)') && mon.includes(' 负才傲物；口吻好引经据典 '), '开着：只有性格和 diction 的人也读同一份（口吻取 diction）');
  ok(mon.includes('请为其中3人生成奏疏。') && mon.includes('【奏疏体裁】') && mon.includes('心绪:温体仁记得上回会推之争'), '开着：奏疏场合规矩、记忆照旧');
  ok(!/shrewd|t-sly/.test(mon), '开着：英文代号不进奏疏提示词');

  // ── 8. 书信（人2 第五片）：人物给天子回信，单人执笔，读完整档 ──
  // 由改造前（ca9ccef3）的文件在同一夹具上算出：373 字
  const LETTER_GOLDEN = '6a9743e8f409489ba9d57fd479f2840c2f6ba4b534a5986228800a23c3b2e65b';
  const lc = letterSandbox();
  const loff = await letterPrompt(lc);
  eq(sha(loff), LETTER_GOLDEN, '关着：回信提示词逐字不变');
  ok(loff.includes('性格：温体仁 理性务实·善于结交'), '（改造前）回信的性格是八维推出来的短语，和问对、常朝各是一套');
  lc.P.conf.personUnifiedEnabled = true;
  const lon = await letterPrompt(lc);
  const P6 = lc.TM.Person, wen6 = lc.GM.chars[1];
  ok(lon.startsWith('你是温体仁，当前在远方，收到天子来书，亲笔作复。\n' + P6.brief(wen6, { occasion: 'letter', detail: 'full', topic: '会推阁臣，卿意属谁？' }).replace(/\n+$/, '')), '开着：回信读完整档（单人执笔，同问对一档），记忆按来信内容回想');
  ok(!lon.includes('性格：') && !lon.includes('近期心绪：') && !lon.includes('政治立场：'), '开着：八维短语、另拼的记忆和立场不再出现');
  ok(lon.includes('1. 以上面所写此人的性情、口吻与身份') && lon.includes('「会推阁臣，卿意属谁？」') && lon.includes('语气：标准臣礼'), '开着：回信的场合规矩照旧');
  ok(lon.split(core).length === 2 && !/shrewd|t-sly/.test(lon), '开着：回信里人格核出现且只出现一次，与问对、常朝、廷议、御前一字不差；英文代号不进');

  // ── 9. NPC 自主（人2 第六片）：一人单独决策的「本人」资料、几人同批决策的名单 ──
  // 由改造前（c19a05b7）的文件在同一夹具上算出：self 574 字（JSON）、同批提示词 1185 字
  const NPC_GOLDEN = { self: '91a723b5086049ce04fd5e3132be921486aedc20ddc0feceb9fc977446ad322c', batch: '20a722957f38b3936c38a9cc8f6a662ce4a0ef0ab8cd1d3c4fb45101c053c9f8' };
  const nc = npcSandbox();
  const noff = await npcPrompts(nc);
  eq(sha(noff.self), NPC_GOLDEN.self, '关着：NPC 单独决策的「本人」资料逐字不变');
  eq(sha(noff.batch), NPC_GOLDEN.batch, '关着：NPC 同批决策的提示词逐字不变');
  ok(noff.self.includes('"traits":["t-sly","t-ambitious"]') && noff.batch.includes('{"name":"温体仁","office":"礼部侍郎","location":""}'), '（改造前的毛病）单独决策的特质是英文代号；同批名单只有名字、官职、所在');
  nc.P.conf.personUnifiedEnabled = true;
  const non = await npcPrompts(nc);
  const P7 = nc.TM.Person, wen7 = nc.GM.chars[1];
  const self7 = JSON.parse(non.self);
  eq(self7.traits, ['狡诈', '野心勃勃', '谨守'], '开着：单独决策的特质写中文定义名');
  eq(self7.personality, P7.who(wen7), '开着：单独决策的性格是人格核＋人设长文（TM.Person.who）');
  ok(self7.personality.startsWith(core) && self7.goal === '入阁拜相，独揽票拟之权' && self7.stress === 40, '开着：人格核与问对、常朝、廷议、御前、回信一字不差；目标、压力等其余字段照旧');
  ok(non.batch.includes('{"name":"温体仁","office":"礼部侍郎","location":"","persona":"' + P7.line(wen7, { noName: true, goalMax: 30 }) + '"}') && non.batch.includes('"persona":"负才傲物"'), '开着：同批名单每人补一行性情、特质、所求');
  ok(!/shrewd|t-sly|t-ambitious/.test(non.self + non.batch), '开着：英文代号不进 NPC 决策的提示词');

  // ── 10. 认知画像（11-09）：人格只认人格核，知与不知各档都带 ──
  // 由改动前（1af53976）的文件在同一夹具上带画像算出（关着）：问对 2672 字、常朝回应 438、自发表态 1555
  const COG_GOLDEN = {
    wendui: 'dd4e1c8aea31fe67f6efd01fbdbf450b8db1c36f619a18898b84960e52365267',
    reply: '86c3c619b2bfb9c6ec7d93d1b52249766e6076cfdfd8555bb8294adb29c80f8e',
    react: 'e35283eb8f6ac7bc9f14cef6dd531926f25faac869b9b38a9124840af45fe7e4'
  };
  const gc = withCog(sandbox());
  const goff = await prompts(gc);
  for (const k of Object.keys(COG_GOLDEN)) eq(sha(goff[k]), COG_GOLDEN[k], '关着：带认知画像时' + { wendui: '问对', reply: '常朝回应', react: '常朝自发表态' }[k] + '提示词逐字不变');
  ok(goff.wendui.includes('人格：阴狡柔佞') && goff.react.includes('口吻：恒言') && goff.react.includes('史标：崇祯朝首辅'), '（改动前）问对、常朝把画像的人格、口吻、史标原样写进去，与人格核是两份');
  gc.P.conf.personUnifiedEnabled = true;
  const P8 = gc.TM.Person, wen8 = gc.GM.chars[1], yu8 = gc.GM.chars[2];
  const cog8 = P8.cognitionText('温体仁');
  ok(cog8.startsWith('\n【该臣认知·自我画像·文事籍影】\n') && cog8.includes('\n心念：迎合圣意而藏其私\n') && cog8.includes('\n对帝：阳恭阴测\n') && cog8.includes('\n自知：长于揣摩上意\n'), '画像：心念、对帝、自知照写');
  ok(!/(^|\n)(自识|人格|口吻|史标)：/.test(cog8), '画像：自识、人格、口吻不写（人格只认人格核）；史标不写（会带进游戏时间之后的事）');
  ok(cog8.includes('\n眼下所图：入阁为首辅、破东林。\n') && !cog8.includes('\n所求：'), '画像：所求改叫眼下所图，不和人格核的【所求】相混');
  ok(cog8.includes('\n知：己上停祠条陈。崔呈秀乞退留中。周延儒来与密议。\n') && cog8.includes('\n不知：崔呈秀谋帝之实。帝对己之真实观感。\n') && !/第四条|第三条/.test(cog8), '画像：知取三条、不知取两条，句号后不多分号');
  const brief8 = P8.brief(wen8, { detail: 'brief', topic: '会推阁臣' });
  const full8 = P8.brief(wen8, { occasion: 'yuqian', detail: 'full', topic: '会推阁臣' });
  ok(brief8.includes(cog8 + '▲ 上面是此人眼下真知道的') && full8.includes(cog8 + '▲ 上面是此人眼下真知道的'), '精简档、完整档带同一段画像');
  ok(full8.includes('▲ 如被问及「不知」里的事') && full8.includes('  · 武人耿直 → ') && !brief8.includes('▲ 如被问及'), '完整档另有被问到不知之事怎么应对，精简档没有');
  eq(P8.coreText(wen8), core, '剧本写了性情、口吻的照剧本，画像不顶替：人格核与前面各场合一字不差');
  ok(P8.coreText(yu8).includes('【性情】谨小慎微\n') && P8.coreText(yu8).includes('【口吻】唯唯诺诺\n'), '剧本没写性情、口吻的，拿画像那句补进人格核');
  ok(P8.line(yu8, { noName: true, speech: true }) === '谨小慎微；口吻唯唯诺诺' && !P8.cognitionText('温育仁').includes('人格：'), '补进人格核的，名单一行同样用；画像里那句不再重复');
  const gon = await prompts(gc);
  ok(gon.wendui.split(cog8).length === 2 && gon.react.split(cog8).length === 2 && gon.reply.split(cog8).length === 2, '开着：问对、常朝两路都带这段画像，各只一次');
  ok(![gon.wendui, gon.reply, gon.react].some((s) => /人格：阴狡|口吻：恒言|史标：|自识：|doesntKnow/.test(s)), '开着：问对、常朝不再写画像的人格、口吻、自识、史标，规矩里不夹英文栏名');
  const cc10 = withCog(courtSandbox());
  cc10.P.conf.personUnifiedEnabled = true;
  const con10 = await courtPrompts(cc10);
  ok(['tinyi', 'mediate', 'interject'].every((k) => con10[k].includes(cog8 + '▲ 上面是此人眼下真知道的')), '开着：廷议发言、折中、朝议插话带同一段画像');
  const yc10 = withCog(yqSandbox());
  yc10.P.conf.personUnifiedEnabled = true;
  const yon10 = await yqPrompts(yc10);
  ok(yon10.speak.includes(cog8) && yon10.deep.includes(cog8) && yon10.deep.includes('▲ 如被问及「不知」里的事') && !yon10.speak.includes('▲ 如被问及'), '开着：御前直陈、深问带同一段画像（深问另有应对规矩）——同一场御前前后知道的一样');
  const mc10 = withCog(memSandbox());
  mc10.P.conf.personUnifiedEnabled = true;
  const mon10 = await memPrompt(mc10);
  ok(mon10.includes('；口吻言辞委婉、步步设防；知：己上停祠条陈。崔呈秀乞退留中。周延儒来与密议。不知：崔呈秀谋帝之实。帝对己之真实观感。 '), '开着：奏疏候选名单每人带知与不知');
  const lc10 = withCog(letterSandbox());
  lc10.P.conf.personUnifiedEnabled = true;
  const lon10 = await letterPrompt(lc10);
  ok(lon10.includes(cog8) && !/人格：阴狡|史标：/.test(lon10), '开着：回信带同一段画像，不写画像的人格、史标');

  // ── 11. 接线与守卫 ──
  ok(read('tm-patches.js').includes("_togglePConf(\\'personUnifiedEnabled\\'"), '设置面板有「人物统一底子」开关');
  ok(read('tm-player-settings.js').includes('personUnifiedEnabled:'), '开关有提示语');
  console.log('[smoke-person-occasions] pass assertions=' + checks);
})().catch((e) => { console.error('[smoke-person-occasions] FAIL', e && e.message || e); process.exit(1); });

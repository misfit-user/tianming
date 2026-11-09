#!/usr/bin/env node
// 人物实体（人1）smoke：TM.Person 的片段、人格核合成、精简档；问对经 TM.Person 拼装后逐字不变（金标准哈希取自改造前）；
// 棘轮守卫已接入。真档逐字比对见实验台 tools/person-brief-check.cjs（三部剧本 2718 例全同）。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a === undefined ? a : JSON.parse(JSON.stringify(a)), b === undefined ? b : JSON.parse(JSON.stringify(b)), m); checks++; };
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function world() {
  const chars = [
    { name: '朱由检', isPlayer: true },
    { name: '温体仁', officialTitle: '礼部侍郎', age: 54, stress: 70, stance: '中立', personalGoal: '入阁拜相，独揽票拟之权', traitIds: ['t-sly', 't-ambitious'],
      loyalty: 55, ambition: 82, family: '乌程温氏', faction: '明朝廷', party: '浙党', class: '士大夫', appearance: '面白微须', charisma: 75,
      culture: '江南', learning: '进士', speechStyle: '言辞委婉、步步设防', ethnicity: '汉', birthplace: '乌程',
      intelligence: 88, military: 20, administration: 80, diplomacy: 70, benevolence: 30,
      aiPersonaText: '外示谦退，内实阴狠', _memory: [{ type: 'dialogue', turn: 3, event: '奏对时力陈东林结党之害，陛下默然不语' }] },
    { name: '温育仁', family: '乌程温氏', alive: true },
    { name: '钱谦益', personality: '负才傲物', diction: '好引经据典', officialTitle: '礼部右侍郎' }
  ];
  return {
    sid: 'smoke', turn: 4, chars,
    characterArcs: { '温体仁': [{ desc: '上疏劾钱谦益' }, { desc: '暗结周延儒' }] },
    culturalWorks: [{ author: '温体仁', title: '秋兴', subtype: '七律', mood: '郁' }],
    classes: [{ name: '士大夫', demands: '复科举旧制、宽言路' }],
    _courtRecords: [{ turn: 4, topic: '会推阁臣', stances: { '温体仁': { stance: '反对', brief: '言钱谦益结党' } } }],
    _edictLifecycle: [{ isCompleted: false, edictType: 'reform', oppositionLeaders: ['温体仁'], stages: [{ stage: 'draft', executor: '钱谦益' }] }],
    _npcCommitments: {}, wenduiHistory: {}
  };
}

function sandbox(files) {
  const GM = world();
  const c = {
    console: { log() {}, warn() {}, error() {} },
    Math, Date, JSON, Promise, Array, Object, String, Number, Boolean, RegExp, parseInt, parseFloat, isFinite, Map, Set,
    setTimeout() {}, clearTimeout() {},
    GM, P: { traitDefinitions: [{ id: 't-sly', name: '狡诈' }, { id: 't-ambitious', name: '野心勃勃' }], conf: {}, ai: {} },
    TM: { PromptComposer: { buildAiPersonaText: (ch) => (ch.aiPersonaText ? '\n【AI人设】' + ch.aiPersonaText : ''), buildRecognitionState: () => '' } },
    document: { createElement() { return { className: '', innerHTML: '', appendChild() {}, style: {}, children: [] }; } },
    findScenarioById: () => ({ era: '崇祯初年' }),
    findCharByName: (n) => GM.chars.find((x) => x.name === n),
    escHtml: (s) => String(s == null ? '' : s), _$: () => null, toast() {},
    callAI: async () => '', callAIMessagesStream: async () => '', extractJSON: () => null,
    _charRangeText: () => '（80-200字）', _aiDialogueWordHint: () => '', _aiDialogueTok: () => 600,
    OpinionSystem: { getTotal: () => 46 },
    AffinityMap: { getRelations: () => [{ name: '周延儒', value: 40 }, { name: '钱谦益', value: -50 }] },
    NpcMemorySystem: { getMemoryContext: (n) => n + '记得上回会推之争' },
    getNpcCognitionSnippet: (n) => '\n【认知】' + n + '知会推内情\n',
    _buildTemporalConstraint: () => '\n【时空约束】',
    _tcScanMentionedNames: (t, seed) => seed || [],
    EDICT_TYPES: { reform: { label: '改制' } }, EDICT_STAGES: { draft: { label: '拟议' } },
    NPC_RELATION_LABELS: {}, CONFLICT_LEVELS: {}
  };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  files.forEach((f) => vm.runInContext(read(f), c, { filename: f }));
  return c;
}

const c = sandbox(['tm-person.js', 'tm-wendui.js', 'tm-wendui-persona-views.js']);
const F = c.TM.Person.frag;
const wen = c.GM.chars[1], qian = c.GM.chars[3];

// ── 1. 片段 ──
eq(F.traitDesc(wen), '狡诈、野心勃勃', '特质取 traitIds 的定义名');
eq(F.traitDesc(qian), '负才傲物', '没有 traitIds 用 personality');
eq(F.ageInfo(wen), '，年54', '年岁');
eq(F.stressInfo(wen), '，当前压力70(濒临崩溃)', '压力过 60 濒临崩溃');
ok(F.family(wen).includes('同族：温育仁'), '家族带同族');
ok(F.identity(wen).includes('阶层:士大夫(诉求:复科举旧制、宽言路)'), '身份带阶层诉求');
ok(F.edictRoles('温体仁').includes('《改制》(拟议)——反对'), '进行中诏令的立场');
ok(F.courtStance(wen, '温体仁', true).includes('私下问对时'), '朝议立场：私下');
ok(F.courtStance(wen, '温体仁', false).includes('正式问对中'), '朝议立场：朝堂');
ok(F.memory(wen).includes('【往次问对记忆】') && F.memory(wen).includes('T3：上次你说过'), '记忆带往次问对');
ok(F.arcs(wen).includes('上疏劾钱谦益') && F.works(wen).includes('《秋兴》'), '近事与文事');
ok(F.background(wen).includes('【个人语言风格】言辞委婉') && F.abilities(wen).startsWith('【能力】智88'), '背景与能力');
ok(F.cognition('温体仁').includes('【认知】温体仁') && F.personaText(wen).includes('外示谦退'), '认知画像与人设文本');

// ── 2. 人格核合成：traitIds → personality；speechStyle → diction ──
eq(c.TM.Person.core(wen).speech, '言辞委婉、步步设防', '说话优先 speechStyle');
eq(c.TM.Person.core(qian).speech, '好引经据典', '没有 speechStyle 用 diction');
eq(c.TM.Person.core(qian).traits, '负才傲物', '人格核的特质同片段');

// ── 3. 精简档、完整档（人2 按施工单重定：都以统一人格核开头；人2 各场合的断言在 smoke-person-occasions.js）──
const short = c.TM.Person.brief(wen, { detail: 'brief' });
ok(short.startsWith('【人物】温体仁（礼部侍郎），年54，当前压力70（濒临崩溃）\n【性情】特质：狡诈、野心勃勃\n'), '精简档以人格核开头');
ok(short.includes('【口吻】言辞委婉') && short.includes('【记忆】') && !short.includes('【要求】') && !short.includes('JSON'), '精简档带口吻与记忆，不带问对规矩');
ok(short.length < 900, '精简档够短');
const full = c.TM.Person.brief(wen, {});
ok(full.startsWith(c.TM.Person.coreText(wen)) && full.includes('【记忆】') && full.includes('【处境】') && full.includes('【认知】') && !full.includes('【要求】'), '完整档有人物各块，不带场合规矩');
eq(c.TM.Person.brief(wen, { occasion: 'wendui' }), c._wdBuildPrompt(wen, '温体仁'), '问对场合的完整档就是问对提示词');

// ── 4. 问对经 TM.Person 拼装后逐字不变：金标准取自改造前的 _wdBuildPrompt（同一夹具、同一替身） ──
// 由改造前的 HEAD（3956c457）在同一夹具上算出：朝堂 3058 字、私下 3081 字
const GOLDEN = {
  formal: '4746c31481c6c44f3926349d15bb27ecd9f3f6e789a5846279b151831e21634d',
  private: '3c42e52c0190179b4e851524d88e5297c080405ce9b1981bf3934322672bfebe'
};
c._wenduiMode = 'formal';
eq(sha(c._wdBuildPrompt(wen, '温体仁')), GOLDEN.formal, '朝堂问对提示词与改造前逐字相同');
c._wenduiMode = 'private';
eq(sha(c._wdBuildPrompt(wen, '温体仁')), GOLDEN.private, '私下问对提示词与改造前逐字相同');

// ── 5. 接线与守卫 ──
const pv = read('tm-wendui-persona-views.js');
ok(pv.includes('var F = TM.Person.frag;') && !pv.includes('P.traitDefinitions.find'), '问对改从 TM.Person 取人物各块');
const html = read('index.html');
ok(html.indexOf('tm-person.js') > 0 && html.indexOf('tm-person.js') < html.indexOf('tm-wendui.js'), 'index.html 在问对之前装载 tm-person.js');
ok(read('scripts/lint-arch-all.js').includes("'lint-person-assembly.js'"), '棘轮守卫接入 lint-arch-all');
ok(fs.existsSync(path.join(__dirname, 'arch-baselines', 'person-assembly.json')), '守卫有基线');

console.log('[smoke-person-brief] pass assertions=' + checks);

#!/usr/bin/env node
'use strict';
// smoke-person-rosters — 人2-8 主推演名单（docs/guanben-roleplay-20260930/tuiyan.md 人2 第八片）
//
// 全知提示词里列一群人的地方，「人物统一底子」（P.conf.personUnifiedEnabled）开着时，人格读名单一行
// （TM.Person.line：性情、特质、所求），与问对、常朝、奏疏同一份；关着时与改前逐字相同。
// 这几份提示词整份要几十个全局才拼得起来，这里只抽改动所在的那一段源码放进 vm 跑：
//   主推演：npc-hearts 的 <self>、「特质直接驱动行为」规矩（tm-endturn-prompt.js）
//   过回合后续：sc15「全部存活角色当前状态」、sc07 认知画像的人物资料（tm-endturn-followup.js）
//   主推演候选 NPC 名单（tm-ai-npc-memorials.js _summarizeCandidateNpcs）
//   开局深读：全部角色（块B）、重要人物性格（块B2，tm-npc-engine.js）、全员心绪记忆（块B3）、角色个体深度分析（tm-ai-planning.js）
// 金标准由改造前的文件在同一夹具上算出：TM_PERSON_SMOKE_GOLDEN_DIR=<放改造前文件的目录> node 本文件 → 打印哈希后退出
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

// 取第一处含 startHas 的行起，到其后第一处含 endHas 的行为止（exclusive：不含那一行；extra：再多带几行）
function seg(src, startHas, endHas, opts) {
  const o = opts || {};
  const lines = src.split('\n');
  const s = lines.findIndex((l) => l.includes(startHas));
  if (s < 0) throw new Error('找不到段首：' + startHas);
  let e = -1;
  for (let i = s + 1; i < lines.length; i++) if (lines[i].includes(endHas)) { e = i; break; }
  if (e < 0) throw new Error('找不到段尾：' + endHas);
  return lines.slice(s, o.exclusive ? e : e + 1 + (o.extra || 0)).join('\n');
}

function world() {
  return {
    turn: 5, _capital: '京师',
    // 剧本没写性情的人，人格核拿认知画像那句补（TM.Person.temperOf）
    _npcCognition: { '无名吏': { personalityCore: '谨小慎微，唯上是从' } },
    chars: [
      { name: '朱由检', isPlayer: true, alive: true, title: '皇帝', personality: '刚烈多疑', loyalty: 100 },
      { name: '魏忠贤', officialTitle: '司礼监秉笔太监', title: '九千岁', faction: '明朝廷', party: '阉党', alive: true,
        personality: '阴鸷狠辣，睚眦必报，善揣上意，以恩威笼络朝臣，权倾内外十余年；新君登极以来惶惶不可终日，犹百计图存，表面恭顺至极而心怀叵测',
        traitIds: ['t-vengeful', 't-ambitious', 't-sly'], traits: ['brave', '贪婪', 'xyz_code'],
        personalGoal: '保全身家性命，借新君之信重掌内廷，令东林诸人永不得翻案，再图恢复生祠香火', stance: '力保权位',
        speechStyle: '谦卑恭顺而暗藏机锋', diction: '自称老奴',
        loyalty: 40, ambition: 90, intelligence: 75, integrity: 10, rank: 2, stress: 45, _mood: '惧',
        stressSources: ['新君疑忌', '东林反扑'], innerThought: '先帝新丧，新君深沉难测，须先自保再图后计', zi: '完吾',
        familyMembers: [{ relation: '侄', name: '魏良卿' }, { relation: '母', name: '刘氏' }],
        _memory: [{ event: '天启帝崩', importance: 9 }], _cap: 60, location: '京师' },
      { name: '温体仁', officialTitle: '礼部尚书', faction: '明朝廷', party: '浙党', alive: true,
        personality: '外谦内忌，城府极深', traitIds: ['t-sly'], traits: ['t-sly'],
        personalGoal: '入阁拜相，独掌票拟。', stance: '入阁拜相，独掌票拟。', speechStyle: '论事避重就轻',
        loyalty: 60, ambition: 85, integrity: 30, rank: 2, stressSources: ['首辅之位未定'],
        _memory: [{ event: '会推之争', importance: 7 }], _cap: 20, location: '南京' },
      { name: '无名吏', officialTitle: '户部主事', alive: true, loyalty: 50, rank: 6, _cap: 0 }
    ]
  };
}

const TRAIT_LIBRARY = { brave: { name: '勇猛', behaviorTendency: '主动请战' } };

function sandbox(on) {
  const c = {
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, isFinite, parseInt, parseFloat,
    GM: world(),
    P: { traitDefinitions: [{ id: 't-vengeful', name: '睚眦必报', dims: { vengefulness: 0.8 } }, { id: 't-ambitious', name: '野心勃勃', dims: { boldness: 0.5 } },
      { id: 't-sly', name: '狡诈' }, { id: 'brave', name: '勇猛' }], conf: { personUnifiedEnabled: on } },
    TM: { errors: { captureSilent() {}, capture() {} } },
    getNpcCognitionSnippet: () => '',
    _isSameLocation: (a, b) => a === b,
    // 与 tm-traits-data.js 同：认不出的代号跳过
    getTraitBehaviorSummary: (ids) => ids.map((id) => TRAIT_LIBRARY[id]).filter(Boolean).map((t) => t.name + '——' + t.behaviorTendency).join('；'),
    TRAIT_LIBRARY,
    NpcMemorySystem: {
      getCapacity: (ch) => ({ active: ch._cap || 0 }),
      // 不取 personalOnly 时开头是约 500 字的「我是谁」与天下大势，与游戏里一样
      getMemoryContext: (n, o) => (o && o.personalOnly ? '' : '【我是谁】' + n + '：' + '出身仕途心事'.repeat(60) + '。【天下大势】银贵钱贱。')
        + n + '的往事：先帝崩后日夜忧惧'
    }
  };
  c.window = c; c.globalThis = c; c.global = c;
  vm.createContext(c);
  vm.runInContext(read('tm-person.js'), c, { filename: 'tm-person.js' });
  vm.runInContext(read('tm-npc-engine.js'), c, { filename: 'tm-npc-engine.js' });
  return c;
}

const LABEL = { hearts: '主推演 npc-hearts 的 <self>', rule: '主推演「特质直接驱动行为」规矩', sc15: 'sc15 全部存活角色', sc07: 'sc07 认知画像的人物资料',
  candidates: '主推演候选 NPC 名单', blockB: '开局深读全部角色', blockB2: '开局深读重要人物性格', blockB3: '开局深读全员心绪记忆', deep: '开局深读角色个体深度分析' };

function run(on) {
  const c = sandbox(on);
  const prompt = read('tm-endturn-prompt.js'), followup = read('tm-endturn-followup.js');
  const planning = read('tm-ai-planning.js'), memorials = read('tm-ai-npc-memorials.js');
  const fn = (code) => vm.runInContext(code, c);
  const chars = c.GM.chars, npcs = chars.filter((x) => !x.isPlayer);
  const out = { c };
  const self = fn(['(function (c) {', 'var xmlLines = [];',
    'var _xE = function (s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };',
    seg(prompt, 'var _selfBits = [];', 'if (_selfBits.length) xmlLines.push('), 'return xmlLines.join("|");', '})'].join('\n'));
  out.hearts = npcs.map((x) => self(x)).join('\n');
  out.rule = fn(['(function () {', 'var sysP = "";', seg(prompt, "sysP += '\\n- 小人物也要有行动", "_mark('npcDeep');", { exclusive: true }),
    'return sysP;', '})()'].join('\n'));
  out.sc15 = fn(['(function () {', 'var tp15 = "";',
    seg(followup, '(GM.chars || []).filter(function(c) { return c.alive !== false; }).forEach(function(c) {', '// 加入显著矛盾', { exclusive: true }),
    'return tp15;', '})()'].join('\n'));
  out.sc07 = fn(['(function (_cogTargets) {', 'var _npcFullCtx = "", p1 = null;',
    seg(followup, '_cogTargets.forEach(function(c){', "_npcFullCtx += _lines.join('\\n') + '\\n';", { extra: 1 }), 'return _npcFullCtx;', '})'].join('\n'))(npcs);
  const cand = fn(['(function (global) {', seg(memorials, 'function _summarizeCandidateNpcs(G) {', "return lines.join('\\n');", { extra: 1 }),
    'return _summarizeCandidateNpcs;', '})(this)'].join('\n'));
  out.candidates = cand({ chars, officeTree: [] });
  out.blockB = fn(['(function (_aliveChars) {', 'var _compressChars = false, blockB = "";',
    seg(planning, '_aliveChars.forEach(function(c, _ci) {', "blockB += '  ' + line + '\\n';", { extra: 1 }), 'return blockB;', '})'].join('\n'))(chars);
  out.blockB2 = fn('getNpcPersonalityInjection(8)');
  out.blockB3 = fn(['(function (_allMemChars) {', 'var _memLines = [], _memScale = 1, _t1Limit = 300, _t2Limit = 180, _t3EventLen = 20;',
    seg(planning, 'var _tier1 = []; // 核心人物', '叠加在记忆之上'), 'return _memLines.join("|");', '})'].join('\n'))(npcs);
  out.deep = fn(['(function (topChars) {', seg(planning, "var charDeepBlock = '请逐个分析以下关键角色", "charDeepBlock += ' [有配偶]';", { extra: 1 }),
    'return charDeepBlock;', '})'].join('\n'))(chars);
  return out;
}

if (GOLDEN_DIR) {
  const g = run(false);
  const o = {};
  Object.keys(LABEL).forEach((k) => { o[k] = sha(g[k]); });
  console.log(JSON.stringify(o, null, 2));
  process.exit(0);
}

// ── 关着：与改前逐字相同 ──
const GOLDEN = {
  hearts: '5dbb16cb1ea398767b7fc4a68ee3f466739ccbd0f77a4e7b1a5d7b5852596a52',
  rule: '75cec7b1025548b081754251ef9f5135c580ef77df4d608373d7cd5598e7391d',
  sc15: '48bb9c32903bf2d803ae360eb97873c0581f04c1a8b00c32db36b4f9e2e2a91b',
  sc07: 'ea0ef47f549f1c89b10fae6c88cdb27bab43283e21de1d10b3dab9a62fa6679a',
  candidates: 'b3bf90efbcc7ce71ec79ce5e1356b010a77b334d74047553645fddf46961c7bd',
  blockB: '7f09847bd6699eda5bb22b2c8d3111469a7a6a3169f08e78bf7035b72ca0cb73',
  blockB2: 'b6f9787deeed63c43ddfaad793a8adf1c84616ba14a07a9a925d4b0a69e627ab',
  blockB3: 'e9fe9248e90886ee206e297ba7c9bd8acf0573a7e7d0de8278eb04d0fd39a20e',
  deep: '1ba7d340d03f8955922abfb184fb8ee868bb0b0b471d7a67743261640eecb2eb'
};
const off = run(false), on = run(true);
for (const k of Object.keys(LABEL)) eq(sha(off[k]), GOLDEN[k], '关着：' + LABEL[k] + '与改前逐字相同');

// ── 开着：各处读同一份名单一行 ──
const Person = on.c.TM.Person;
const [, wei, wen, li] = on.c.GM.chars;
const L = (ch, o) => Person.line(ch, o);
const weiLine = L(wei, { noName: true });
ok(wei.personality.length > 60, '夹具：魏忠贤性情长过 60 字（原来 npc-hearts 截在 60 字）');
ok(weiLine.indexOf('特质野心勃勃、狡诈、勇猛、贪婪') > 0, '名单一行：特质写定义名，性情里已有的「睚眦必报」不重写，认不出的英文代号不写');
eq(L(li, { noName: true }), '谨小慎微，唯上是从', '名单一行：剧本没写性情的，拿认知画像那句补');

for (const ch of [wei, wen, li]) ok(on.hearts.includes('<self>' + L(ch, { noName: true }) + '</self>'), '开着：npc-hearts 的 <self> 是名单一行（' + ch.name + '）');
ok(on.hearts.includes(wei.personality) && !off.hearts.includes(wei.personality), '开着：npc-hearts 性情不再截 60 字');
ok(!off.hearts.includes('谨小慎微'), '关着：剧本没写性情的人 npc-hearts 没有 <self>');

ok(off.rule.includes('traitIds(特质)') && off.rule.includes('勇猛(brave)'), '关着：特质规矩照旧带 traitIds 与英文代号');
ok(!on.rule.includes('traitIds') && !/\([a-z]+\)/.test(on.rule), '开着：特质规矩不提 traitIds、不带英文代号');
ok(on.rule.includes('每个角色的特质不是装饰标签') && on.rule.includes('勇猛 → 主动请战'), '开着：特质规矩其余照旧');
ok(on.rule.includes('小人物也要有行动'), '开着：特质规矩之前的那段不受影响');

ok(on.sc15.includes('性:' + weiLine) && on.sc15.includes('性:' + L(wen, { noName: true })), '开着：sc15 每人「性:」是名单一行');
ok(!on.sc15.includes('特:') && !on.sc15.includes('求:'), '开着：sc15 不再另写「特:」「求:」');
ok(off.sc15.includes('特:') && off.sc15.includes('求:') && off.sc15.includes('xyz_code'), '关着：sc15 照旧另写特、求（特质原样带英文代号）');
ok(on.sc15.includes('压力45') && on.sc15.includes('情:惧'), '开着：sc15 压力、心情等处境照旧');

ok(on.sc07.includes('  人格：' + L(wei, { noName: true, speech: true })), '开着：sc07 人物资料的「人格」是名单一行带口吻');
ok(!/  (性格|口吻|特质)：/.test(on.sc07), '开着：sc07 不再另写性格、口吻、特质');
ok(/  性格：/.test(off.sc07) && off.sc07.includes('  口吻：') && off.sc07.includes('  特质：'), '关着：sc07 照旧');

ok(on.candidates.includes('性:' + L(wen, { noName: true })) && on.candidates.includes('性:' + weiLine), '开着：候选 NPC 名单带名单一行');
ok(!off.candidates.includes('性:'), '关着：候选 NPC 名单照旧只有官职与数值');

const weiLong = L(wei, { noName: true, goalMax: 200 });
ok(on.blockB.includes(' 人格:' + weiLong) && weiLong.includes(wei.personalGoal), '开着：开局深读全部角色的「人格」是名单一行，所求不截');
ok(!/ (特质|目标|性格):/.test(on.blockB), '开着：开局深读全部角色不再另写特质、目标、性格');
ok(on.blockB.includes(' 立场:力保权位') && !on.blockB.includes(' 立场:入阁拜相'), '开着：立场与所求相同只写所求');
ok(off.blockB.includes(' 立场:入阁拜相，独掌票拟') && off.blockB.includes(' 目标:') && off.blockB.includes(' 性格:'), '关着：开局深读全部角色照旧');

ok(on.blockB2.includes('- ' + L(wei) + '，忧:新君疑忌/东林反扑，思:「') && on.blockB2.includes('，家:母刘氏，字完吾'), '开着：重要人物性格是名单一行，附忧、思、家人、表字');
ok(on.blockB2.includes('- ' + L(wen) + '忧:首辅之位未定') && !on.blockB2.includes('。，'), '开着：名单一行以句号收尾时，后面的忧、思不再接逗号');
ok(!on.blockB2.includes('胆大好斗') && off.blockB2.includes('胆大好斗'), '开着：重要人物性格不再由八维推性格短语');
ok(!on.blockB2.includes('【睚眦必报·野心勃勃·狡诈】') && off.blockB2.includes('【睚眦必报·野心勃勃·狡诈】'), '开着：重要人物性格不再另列特质');

ok(on.blockB3.includes('★ 魏忠贤：魏忠贤的往事') && on.blockB3.includes('- 温体仁：温体仁的往事'), '开着：全员心绪记忆截的是此人自己那段');
ok(!on.blockB3.includes('【我是谁】') && off.blockB3.includes('【我是谁】') && !off.blockB3.includes('魏忠贤的往事'), '关着：截 300 字全落在「我是谁」里');
ok(on.blockB3.includes('|特质叠加在记忆之上') && off.blockB3.includes('|特质(traitIds)叠加在记忆之上'), '开着：记忆规矩不提 traitIds');

ok(on.deep.includes(' 人格:' + weiLong) && !/ (目标|性格):/.test(on.deep), '开着：角色个体深度分析的「人格」是名单一行');
ok(off.deep.includes(' 性格:') && off.deep.includes(' 目标:'), '关着：角色个体深度分析照旧');

for (const k of Object.keys(LABEL)) ok(!String(on[k]).includes('xyz_code'), '开着：' + LABEL[k] + '不带认不出的英文代号');

console.log('PASS smoke-person-rosters ' + checks + '/' + checks);

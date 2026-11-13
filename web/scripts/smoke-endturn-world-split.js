#!/usr/bin/env node
'use strict';
// smoke-endturn-world-split — 主推演「近期心绪」拆出国中实况（docs/guanben-roleplay-20260930/tuiyan.md「近期心绪拆国中实况」）
//
// 主推演主角一节的「近期心绪」原来是 NpcMemorySystem.getMemoryContext(玩家) 整份：开头是「我是谁」身份块，接着货币、央地、
// 户口、环境、诏令、皇权、历史预设各引擎的精要，最后才是本人的心绪往事，整段标作「近期心绪」，主推演会当成皇帝的心事。
// 现在「近期心绪」只取身份块与本人那段（opts.noWorld），各引擎精要在主角一节末尾单列【国中实况·各项精要】（getWorldContext），
// 内容一字不删。别处（问对、奏疏、朝议……）不带 noWorld，取到的与原来逐字相同。
// 金标准由改造前的文件在同一夹具上算出：TM_PERSON_SMOKE_GOLDEN_DIR=<放改造前 tm-mechanics-memory.js 与 tm-endturn-prompt.js 的目录>
//   node 本文件 → 打印哈希后退出
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

const SELF = '【我是朱由检】，今年17岁\n出身：光宗第五子\n我在任：皇帝';
const WORLD = [
  '【货币·市场】\n粮价 820 文/石；通胀 3.0%',
  '【央地财政】\n合规危险区域：陕西(合规41%/自治35%)',
  '【奏疏】已拟就待朱批 2 本：请饷疏、劾魏疏',
  '【皇权】62\n【皇威】70'
];

function sandbox(withEngines) {
  const c = { console: { log() {}, warn() {}, error() {} }, Date, Math, JSON };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(read('tm-mechanics-memory.js'), c, { filename: 'tm-mechanics-memory.js' });
  c.CharFullSchema = { toAIContext: (ch) => (ch.name === '朱由检' ? SELF : '【我是' + ch.name + '】') };
  if (withEngines) {
    c.CurrencyEngine = { getAIContext: () => WORLD[0] };
    c.CentralLocalEngine = { getAIContext: () => WORLD[1] };
    c.EdictParser = { getAIContext: () => WORLD[2] };
    c.AuthorityEngines = { getAuthorityAIContext: () => WORLD[3] };
  }
  c.TM = { PersonalMemoryRecall: { personal: () => '会推前夜与周延儒密议' } };
  c.GM = { turn: 3, chars: [
    { name: '朱由检', alive: true, age: 17, stress: 40, _mood: '忧', _memory: [{ event: '登基，诛魏之议起', importance: 9, turn: 1, emotion: '忧' }] },
    { name: '温体仁', alive: true, age: 54, _mood: '平', _memory: [{ event: '会推之争', importance: 8, turn: 2, emotion: '忧' }] }
  ] };
  c.P = { playerInfo: { characterName: '朱由检', characterTitle: '皇帝', factionName: '明朝廷', playerRole: 'emperor', characterAge: 17 } };
  c.sc = null;
  return c;
}

// 主推演主角一节（tm-endturn-prompt.js 里 if (P.playerInfo) 一整段）照原样跑
const playerBlock = (c) => vm.runInContext('(function () { var sysP = \'\';\n' +
  seg(read('tm-endturn-prompt.js'), '    if (P.playerInfo) {', "_mark('player');", { exclusive: true }) + '\nreturn sysP; })()', c, { filename: 'player-block' });

function run() {
  const c = sandbox(true);
  const NMS = c.NpcMemorySystem;
  const o = {
    full: NMS.getMemoryContext('朱由检'),
    own: NMS.getMemoryContext('朱由检', { personalOnly: true }),
    topic: NMS.getMemoryContext('温体仁', { topic: '会推阁臣' }),
    topicOwn: NMS.getMemoryContext('温体仁', { personalOnly: true, topic: '会推阁臣' })
  };
  o.sysP = playerBlock(c);
  if (!GOLDEN_DIR) {
    o.nw = NMS.getMemoryContext('朱由检', { noWorld: true });
    o.nwTopic = NMS.getMemoryContext('温体仁', { noWorld: true, topic: '会推阁臣' });
    o.world = NMS.getWorldContext();
    const bare = sandbox(false);
    o.bareFull = bare.NpcMemorySystem.getMemoryContext('朱由检');
    o.bareNw = bare.NpcMemorySystem.getMemoryContext('朱由检', { noWorld: true });
    o.bareWorld = bare.NpcMemorySystem.getWorldContext();
    o.bareSysP = playerBlock(bare);
    const mock = sandbox(true);
    mock.NpcMemorySystem = { getMemoryContext: () => '旧式替身记忆' };
    o.mockSysP = playerBlock(mock);
  }
  return o;
}

if (GOLDEN_DIR) {
  const o = run();
  console.log(JSON.stringify({ full: sha(o.full), own: sha(o.own), topic: sha(o.topic), topicOwn: sha(o.topicOwn), sysP: sha(o.sysP) }, null, 2));
  process.exit(0);
}

const GOLD = {
  full: 'febea2c7f88bc2c60ad09da0566a29979fe0bdc2088001f6ce7f40e401992f17',
  own: '7d3d2975e72a8dbd7ae7083b199547cd538edd2436024ac549ceda316e165a22',
  topic: '1455b0ba2e1eefa4e88d71cc80b5a4d41a7276b4fae7aa7f7220fa19e52b7775',
  topicOwn: 'c08d13ace6a09b9493d2fb4c8196c2ad263940c314bf3f2c2aa8faaca76d7177',
  sysP: 'a6c975134bf2f323fc0a724abc2e6969e8702993f121b010891b5d9a716402f5'
};
const out = run();
const HEAD = '\n\n【国中实况·各项精要】\n';

// ── 别处（问对、奏疏、朝议……）不带 noWorld：与改前逐字相同 ──
eq(sha(out.full), GOLD.full, '不带 noWorld：记忆全文与改前逐字相同（身份块、国中实况、本人那段）');
eq(sha(out.own), GOLD.own, 'personalOnly：与改前逐字相同');
eq(sha(out.topic), GOLD.topic, '带议题回想：与改前逐字相同');
eq(sha(out.topicOwn), GOLD.topicOwn, 'personalOnly 带议题：与改前逐字相同');
ok(out.full === SELF + '。' + WORLD.join('。') + '。' + out.own, '记忆全文＝身份块。国中实况各段。本人那段（拼法照旧）');

// ── noWorld 与 getWorldContext ──
eq(out.nw, SELF + '。' + out.own, 'noWorld：只要身份块与本人那段，国中实况一段不带');
ok(out.nwTopic.endsWith('。议题相关原始记忆：会推前夜与周延儒密议') && !/【货币|【央地|【奏疏|【皇权/.test(out.nwTopic), 'noWorld 照样按议题回想，不带国中实况');
eq(out.world, WORLD.join('\n'), 'getWorldContext：各引擎精要原样，一段一行');
eq(out.bareWorld, '', '没有引擎时 getWorldContext 是空的');
eq(out.bareNw, out.bareFull, '没有引擎时 noWorld 与全文相同');

// ── 主推演主角一节 ──
const p = out.sysP;
ok(p.includes('\n  近期心绪：' + out.nw + '\n'), '近期心绪：只剩身份块与本人那段');
ok(p.endsWith(HEAD + out.world), '国中实况在主角一节末尾单列，内容原样');
ok(p.indexOf('【货币·市场】') === p.indexOf(HEAD) + HEAD.length, '国中实况只出现在单列那节（近期心绪里不再有）');
for (const w of WORLD) ok(p.split(w).length === 2, '国中实况每段只出现一次：' + w.split('\n')[0]);
const reOld = p.slice(0, p.length - (HEAD + out.world).length).replace('近期心绪：' + out.nw, () => '近期心绪：' + out.full);
eq(sha(reOld), GOLD.sysP, '把国中实况放回近期心绪、去掉单列那节，就与改前逐字相同（主角一节别处一字没动）');
ok(!out.bareSysP.includes('国中实况'), '没有引擎时不添空的一节');
ok(out.mockSysP.includes('\n  近期心绪：旧式替身记忆') && !out.mockSysP.includes('国中实况'), '记忆系统没有 getWorldContext（旧替身）时照旧，不报错');

console.log('PASS smoke-endturn-world-split ' + checks + '/' + checks);

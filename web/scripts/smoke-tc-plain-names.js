#!/usr/bin/env node
'use strict';
// smoke-tc-plain-names — 时空约束清编号（docs/guanben-roleplay-20260930/tuiyan.md 人2 之后的「时空约束清编号」）
//
// 人物说话的场合（问对、常朝、廷议、御前、书信……）都带时空约束，里面的「本局当前资料」（TM.LiveContext.build）
// 与「本 NPC 关键记忆」原来露内部编号：势力 fac_…、党派 pty_…、阶层与地块编号、任职人 char_…、记忆 [NPC-memory:char_…]，
// 开局前的事写成负回合（天启真档魏忠贤 T-1800），品级写内部序号（rankLevel 7 是正四品，写「品级7」会被读成七品）。
// 现在都写名字、品名、中文；主推演那份（tm-endturn-ai.js 直接调 publicFacts，不带 plain）照旧带编号（金标准哈希守）。
// 顺手修：党派成员剧本里是「魏忠贤·崔呈秀」这样的字串，原来按数组取，「成员」一栏是空的。
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

function world(membersAsText) {
  return {
    turn: 3,
    facs: [{ id: 'fac_ming01', name: '明朝廷', leader: '朱由检' }, { id: 'fac-houjin', name: '后金', leader: '皇太极' }],
    chars: [
      { id: 'char_wei01', name: '魏忠贤', officialTitle: '司礼监秉笔太监', rankLevel: 7, faction: '明朝廷', factionId: 'fac_ming01', party: '阉党', location: '京师',
        _memory: [{ turn: -1800, event: '入宫净身，后入司礼监', importance: 8 }, { turn: 0, event: '天启帝崩，司礼监掌宫中丧仪', importance: 9 },
          { turn: 2, event: '新君召对司礼监诸珰，言辞冷淡', importance: 7, emotion: '惧' }] },
      { id: 'char_hong01', name: '皇太极', officialTitle: '后金汗', factionId: 'fac-houjin', location: '沈阳' }
    ],
    parties: [{ id: 'pty_yan01', name: '阉党', leader: '魏忠贤', members: membersAsText ? '魏忠贤·崔呈秀' : ['魏忠贤', '崔呈秀'], ideology: '固权' }],
    classes: [{ id: 'cls_shi', name: '士大夫', economicRole: '科举仕进', demands: '宽言路' }],
    officeTree: [{ name: '司礼监', positions: [{ name: '秉笔太监', actualHolders: [{ characterId: 'char_wei01' }, { characterId: 'char_gone99' }] }] }],
    mapData: { regions: [{ id: 'rg_jingshi', name: '京师', currentOwner: 'fac_ming01', terrain: '平原', population: 1000000, prosperity: 70, unrest: 20, taxAuthorityFactionId: 'fac_ming01' }] },
    dynamicInstitutions: [], qijuHistory: []
  };
}
const QUERY = '皇太极 阉党 士大夫 司礼监 官制';

function sandbox() {
  const c = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, WeakMap, isFinite };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(seg(fs.readFileSync(path.join(WEB, 'tm-office-system.js'), 'utf8'), 'var RANK_HIERARCHY = [', '];'), c, { filename: 'RANK_HIERARCHY' });
  vm.runInContext(read('tm-personal-memory-recall.js'), c, { filename: 'tm-personal-memory-recall.js' });
  vm.runInContext(read('tm-live-context.js'), c, { filename: 'tm-live-context.js' });
  return c;
}

function run() {
  const c = sandbox();
  const LC = c.TM.LiveContext;
  const g = world(true), gArr = world(false);
  const memFn = vm.runInContext(['(function (_memSrc) {',
    seg(read('tm-ai-infra.js'), 'var memLines = _memSrc.slice(-5).map(function(m) {', "}).join('\\n');"), 'return memLines; })'].join('\n'), c);
  return {
    person: LC.build(g, g.chars[0], QUERY),
    main: LC.publicFacts(gArr, null, QUERY),
    mainText: LC.publicFacts(g, null, QUERY),
    recall: c.TM.PersonalMemoryRecall.personal(g, g.chars[0], QUERY, 6),
    tcMem: memFn(g.chars[0]._memory)
  };
}

if (GOLDEN_DIR) {
  const o = run();
  console.log(JSON.stringify({ main: sha(o.main) }, null, 2));
  process.exit(0);
}

const out = run();
// ── 主推演那份（不带 plain）照旧：成员是数组时与改前逐字相同 ──
eq(sha(out.main), 'dec54e134c04131e8e8fe13461db1f81d1ad301433cab3e08e11256af5e4b02f', '主推演那份 publicFacts 与改前逐字相同');
ok(out.main.includes('所涉人物当前记录：皇太极；在世；现职后金汗；势力fac-houjin') && out.main.includes('当前党派：阉党[pty_yan01]'), '主推演那份照旧带编号');
ok(out.mainText.includes('；成员魏忠贤·崔呈秀；'), '顺手修：党派成员是字串时也列出（原来按数组取，成员一栏是空的）');

// ── 人物说话的场合：只写名字 ──
const p = out.person;
ok(p.includes('本人现状：魏忠贤；现职司礼监秉笔太监；品级正四品；势力明朝廷；党派阉党；所在京师'), '本人现状：品级写品名，势力写名字');
ok(p.includes('所涉人物当前记录：皇太极；在世；现职后金汗；势力后金'), '所涉人物：势力写名字（原来写 fac-houjin）');
ok(p.includes('实时官制名册：司礼监·秉笔太监：魏忠贤') && !p.includes('char_gone99'), '官制名册：任职人写名字，认不出的编号不写');
ok(p.includes('当前地块：京师；归属明朝廷；地形平原；人口1000000；繁荣70；动荡20；税权明朝廷'), '地块：不写编号，归属与税权写名字，各项写中文');
ok(p.includes('当前党派：阉党；领袖魏忠贤；成员魏忠贤·崔呈秀；主张固权'), '党派：不写编号');
ok(p.includes('当前阶层：士大夫；经济基础科举仕进；诉求宽言路'), '阶层：不写编号');
for (const id of ['fac_', 'fac-', 'pty_', 'cls_', 'rg_', 'char_', 'NPC-memory', 'T-1800', 'terrain=']) ok(!p.includes(id), '人物说话的场合不露「' + id + '」');

// ── 个人原始记录：不写编号，开局前的事不写负回合 ──
ok(out.recall.includes('开局前 个人历史记录：入宫净身，后入司礼监') && out.recall.includes('开局前 个人历史记录：天启帝崩'), '个人原始记录：开局前（含 0 回合）写「开局前」');
ok(out.recall.includes('T2 个人历史记录：新君召对司礼监诸珰'), '个人原始记录：开局后的照写回合');
ok(!out.recall.includes('[') && !out.recall.includes('T-1800') && !out.recall.includes('T0 '), '个人原始记录：不带 [编号]、负回合、T0');

// ── 时空约束的「本 NPC 关键记忆」──
eq(out.tcMem, ['  · 开局前·入宫净身，后入司礼监', '  · 开局前·天启帝崩，司礼监掌宫中丧仪', '  · T2·新君召对司礼监诸珰，言辞冷淡(惧)'].join('\n'), '本 NPC 关键记忆：开局前写「开局前」，不写 T-1800、T0');

console.log('PASS smoke-tc-plain-names ' + checks + '/' + checks);

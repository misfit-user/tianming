#!/usr/bin/env node
/* eslint-env node */
// 锁定 ①复命/请罪闭环·内容层:_wdBuildPrompt 须把该 NPC 手头未了差事的真实状态注入提示词,
// 并指示据实回奏/逾期请罪/勿谎报。服务问对完善 sprint·Slice 2。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
// 问对的人物各块自 2026-11-07 起从 tm-person.js（TM.Person.frag）取，先装它
const src = (fs.readFileSync(path.join(ROOT, 'tm-person.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-wendui.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-wendui-persona-views.js'), 'utf8'));

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  passed += 1;
}

const sandbox = {
  console, setTimeout, clearTimeout, Promise, Array, Object, String, Number,
  Boolean, RegExp, Date, Math, JSON, parseInt, parseFloat, isFinite,
  GM: { sid: 'smoke', turn: 10, chars: [], wenduiHistory: {}, _npcCommitments: {}, characterArcs: {} },
  P: { ai: { key: 'k' }, playerInfo: { characterName: '天子' }, traitDefinitions: [] },
  document: { createElement() { return { className: '', innerHTML: '', appendChild() {}, style: {}, children: [] }; } },
  window: {},
  findScenarioById: () => null,
  findCharByName(name) { return sandbox.GM.chars.find(c => c.name === name); },
  escHtml(s) { return String(s == null ? '' : s); },
  _$(id) { return null; },
  callAIMessagesStream: async () => '',
  callAI: async () => '',
  extractJSON(raw) { try { return JSON.parse(raw); } catch (_) { return null; } },
  toast() {},
  _charRangeText: () => '',
  _aiDialogueWordHint: () => '',
  _aiDialogueTok: () => 600
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'tm-wendui.js' });

assert(typeof sandbox._wdBuildPrompt === 'function', '_wdBuildPrompt must be defined');

const ch = { name: '杨嗣昌', title: '兵部尚书', loyalty: 70, ambition: 50, stress: 20, alive: true };
sandbox.GM.chars.push(ch);

// 无承诺时:不应注入差事块
let p0 = sandbox._wdBuildPrompt(ch, '杨嗣昌');
assert(typeof p0 === 'string' && p0.length > 0, '_wdBuildPrompt should return a non-empty prompt');
assert(p0.indexOf('你奉旨在办的差事') < 0, '无承诺时不应注入差事块');

// 有逾期承诺:应注入任务名+逾期标记+据实回奏指令
sandbox.GM._npcCommitments['杨嗣昌'] = [
  { task: '督师剿贼安定中原', category: 'dispatch', status: 'executing', assignedTurn: 2, deadline: 3, progress: 40 }
];
let p1 = sandbox._wdBuildPrompt(ch, '杨嗣昌');
assert(p1.indexOf('你奉旨在办的差事') >= 0, '有未了承诺时应注入差事块');
assert(p1.indexOf('督师剿贼安定中原') >= 0, '差事块应含真实任务名');
assert(p1.indexOf('已逾期') >= 0, '已历8回合/限3应标记已逾期');
assert(p1.indexOf('据实回奏') >= 0, '应含据实回奏指令');
assert(p1.indexOf('厂卫') >= 0, '应含谎报可被厂卫核查的威慑');

// 已完成/失败的承诺不应再列入"在办"
sandbox.GM._npcCommitments['杨嗣昌'] = [
  { task: '已结之事', status: 'completed', assignedTurn: 2, deadline: 3 },
  { task: '已败之事', status: 'failed', assignedTurn: 2, deadline: 3 }
];
let p2 = sandbox._wdBuildPrompt(ch, '杨嗣昌');
assert(p2.indexOf('你奉旨在办的差事') < 0, '已完成/已失败承诺不应列入在办差事');

// ⑤ 游说进取:高野心者(amb>75)逢边事 → 注入进取机会块+党争锋芒提示
sandbox.GM._npcCommitments = {};
const amb = { name: '袁崇焕', title: '辽东巡抚', loyalty: 70, ambition: 88, stress: 20, alive: true };
sandbox.GM.chars.push(amb);
sandbox.GM.activeWars = [{ name: '辽东之役' }];
let pa = sandbox._wdBuildPrompt(amb, '袁崇焕');
assert(pa.indexOf('进取机会') >= 0, '高野心者逢边事应注入进取机会块');
assert(pa.indexOf('督师') >= 0 || pa.indexOf('军功') >= 0, '进取机会应锚定边事(自请督师立军功)');
assert(pa.indexOf('排挤锋芒') >= 0 || pa.indexOf('党争') >= 0, '应含党争/排挤叙事指令');

// ⑤ 低野心者 → 不应注入进取机会块
const meek = { name: '老臣', title: '太常寺卿', loyalty: 70, ambition: 40, stress: 20, alive: true };
sandbox.GM.chars.push(meek);
let pm = sandbox._wdBuildPrompt(meek, '老臣');
assert(pm.indexOf('进取机会') < 0, '低野心者不应误注入进取机会块');
sandbox.GM.activeWars = [];

// ⑥ 诉难求裁:高压且治理出问题的辖区 → 注入辖下之难(读 provinceStats·governor 匹配)
const gov = { name: '孙传庭', title: '陕西巡抚', loyalty: 70, ambition: 50, stress: 75, alive: true };
sandbox.GM.chars.push(gov);
sandbox.GM.provinceStats = {
  '陕西': { name: '陕西', governor: '孙传庭', unrest: 65, stability: 30, corruption: 55, taxRevenue: 0 },
  '山东': { name: '山东', governor: '某甲', unrest: 70, stability: 20, corruption: 60, taxRevenue: 0 }
};
let pb = sandbox._wdBuildPrompt(gov, '孙传庭');
assert(pb.indexOf('你辖下之难') >= 0, '高压治理者应注入辖下之难块');
assert(pb.indexOf('陕西') >= 0, '辖下之难应锚定其治理的省(陕西)');
assert(pb.indexOf('山东') < 0, '不应混入他人治理的省(山东)');
assert(pb.indexOf('民变思动') >= 0 && pb.indexOf('钱粮枯竭') >= 0, '应据真实政情列出具体困境');

// ⑥ 低压者 → 不注入辖下之难块(即便治理有问题)
const calmGov = { name: '安臣', title: '某巡抚', loyalty: 70, ambition: 50, stress: 20, alive: true };
sandbox.GM.chars.push(calmGov);
sandbox.GM.provinceStats['河南'] = { name: '河南', governor: '安臣', unrest: 65, stability: 30, corruption: 55, taxRevenue: 0 };
let pc = sandbox._wdBuildPrompt(calmGov, '安臣');
assert(pc.indexOf('你辖下之难') < 0, '低压者不应注入辖下之难块');

console.log(`[verify-wendui-commit-context] PASS ${passed} assertions`);

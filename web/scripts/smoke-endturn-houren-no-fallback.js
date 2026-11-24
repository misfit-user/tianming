#!/usr/bin/env node
// smoke-endturn-houren-no-fallback.js — 后人戏说不再拿正文顶（tm-endturn-render.js _endTurn_finalizeRecords）。
// 模型没写后人戏说：史记里这一卷是空的（原先顶成正文，史记卷正文、后人戏说两页一字不差，推演前情、记忆回填也读两遍）；
// 只写了后人戏说、上游挪作正文的：不再记第二份；真写了的照存。三回都真跑落史记，看 GM.shijiHistory。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
function check(cond, msg) {
  if (!cond) throw new Error('[smoke-endturn-houren-no-fallback] FAIL ' + msg);
  passed++;
}

const sandbox = {
  console, Math, Date, JSON, RegExp, Error, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
  escHtml: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  deepClone: (o) => JSON.parse(JSON.stringify(o)),
  setTimeout() { return 1; },
  clearTimeout() {},
  getTSText(turn) { return 'T' + turn; },
  turnsForDuration() { return 12; },
  AccountingSystem: { getLedger() { return { items: [], totalIncome: 0, totalExpense: 0, netChange: 0 }; } },
  ChronicleSystem: { addMonthDraft() {} },
  CORE_METRIC_LABELS: {},
  PromptLayerCache: { preload() {} },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  _$() { return null; },
  renderQiju() {}, renderWenduiChars() {}, generateMemorials() {}, renderGameState() {}, hideLoading() {},
  showTurnResult() {}, toast() {}, showCharPopup() {}, _dbg() {},
  SaveManager: { autoSave() {} },
  GM: {
    turn: 5, sid: 'smoke', eraNames: [], chars: [{ name: '孙承宗', alive: true }], facs: [], vars: {}, rels: {},
    evtLog: [], factionEvents: [], shijiHistory: [], qijuHistory: [], jishiRecords: [], _turnReport: [], _turnBattleResults: [],
    armies: [], activeWars: [], battleHistory: [],
    turnChanges: { variables: [], characters: [], factions: [], parties: [], classes: [], military: [], map: [] },
    guoku: { money: 0, grain: 0, cloth: 0 }, neitang: { money: 0, grain: 0, cloth: 0 }, population: { national: {}, fugitives: 0 }
  },
  P: { time: { year: 1627, startMonth: 8, perTurn: '1m' }, adminHierarchy: {}, playerInfo: { factionName: '明' }, variables: [], conf: {} }
};
sandbox.window = sandbox;
sandbox.TM = { errors: { capture() {}, captureSilent() {} } };
sandbox.document = { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } };
vm.createContext(sandbox);
// 弹窗组装在 sibling，须先装（与 smoke-endturn-battle-detail-fallback 同序）
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-shiji-compose.js'), 'utf8'), sandbox, { filename: 'tm-endturn-shiji-compose.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-render.js'), 'utf8'), sandbox, { filename: 'tm-endturn-render.js' });
check(typeof sandbox._endTurn_finalizeRecords === 'function', '_endTurn_finalizeRecords 可调');

// 落一回史记，取刚落下的那条
function finalize(zhengwen, houren) {
  sandbox._endTurn_finalizeRecords('时政记一段。', zhengwen, '', '', {}, {}, {}, '', null, [], null, '本回总括。', '实录一段。', '题', '', [], houren, null);
  const list = sandbox.GM.shijiHistory;
  return list[list.length - 1];
}

let rec = finalize('孙承宗督师关宁，整饬边备。', '');
check(rec && rec.zhengwen === '孙承宗督师关宁，整饬边备。', '正文照存');
check(rec.houren === '', `没写后人戏说：空着，不拿正文顶（得「${rec.houren}」）`);

rec = finalize('后人谓此时若饷册早清，辽事或少一重虚耗。', '后人谓此时若饷册早清，辽事或少一重虚耗。');
check(rec.houren === '', '后人戏说与正文同文（上游已挪作正文）：不记第二份');

rec = finalize('孙承宗督师关宁。', '后人有诗云：辽海风霜满戍楼。');
check(rec.houren === '后人有诗云：辽海风霜满戍楼。', '真写了的后人戏说照存');

rec = finalize('孙承宗督师关宁。', '后人有诗云：\\n辽海风霜满戍楼。');
check(rec.houren === '后人有诗云：\n辽海风霜满戍楼。', '字面转义照旧归一');

console.log(`[smoke-endturn-houren-no-fallback] PASS ${passed} 项`);

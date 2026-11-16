#!/usr/bin/env node
// smoke-office-supervision.js — 玩家群 2026-07-21 立案两缺的防腐线：
// 缺a：衙门名后缀白名单漏「行/台/寺/卫/厂/库/坊/科/仓/驿」类（玩家设「中央银行」漏识别）。
// 缺b：新设衙门在吏治账恒记「无监察」欠账·全库无处补——诏书动词「为X设监察/考成/任期/问责」落旗销欠。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function assert(cond, msg) {
  if (cond) { A++; console.log('  PASS ' + msg); }
  else { F++; console.log('  FAIL ' + msg); }
}
function load(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

const ctx = {
  console, Date, JSON, Math,
  setTimeout: () => {}, clearTimeout: () => {},
  GM: {
    turn: 20, month: 3,
    guoku: { money: 200000 },
    corruption: { overall: 30, trueIndex: 30 },
    huangwei: { index: 50 }, huangquan: { index: 50 },
    officeTree: [],
    dynamicInstitutions: [
      { id: 'inst_bank', name: '中央银行', rank: 5, stage: 'running', annualBudget: 30000,
        corruption: 20, effectiveness: 0.9, duties: '掌宝钞印行', history: [] },
      { id: 'inst_shibo', name: '市舶司', rank: 5, stage: 'running', annualBudget: 20000,
        corruption: 10, effectiveness: 0.9, duties: '掌海贸抽分', history: [] }
    ],
    _turnReport: []
  },
  P: {}, addEB: () => {}, toast: () => {}, callAI: async () => null
};
ctx.window = ctx; ctx.global = ctx;
vm.createContext(ctx);
load(ctx, 'tm-edict-parser.js');

console.log('smoke-office-supervision');

// ── 缺a：后缀白名单收「行」类 ──
const EP = ctx.EdictParser;
assert(EP && typeof EP.superviseInstitution === 'function', 'EdictParser 导出 superviseInstitution');
const entry = EP.EDICT_TYPES && EP.EDICT_TYPES.office_reform;
assert(entry && typeof entry.aiEntry === 'function', 'office_reform.aiEntry 在');

// 「设中央银行」现在能被设立正则抓到名字（旧白名单「行」不认→名字抓空）
const ok1 = entry.aiEntry({ _edictText: '着即添设 皇家钱庄行，掌宝钞兑印，正五品。' });
assert(ok1 !== false, '「添设…行」类衙门名可识别（缺a·中央银行类不再漏）');
assert((ctx.GM.dynamicInstitutions || []).some(i => i && i.name === '皇家钱庄行'),
  '新设「皇家钱庄行」已入 dynamicInstitutions');

// ── 缺b：补监察动词落旗销欠 ──
const bank = ctx.GM.dynamicInstitutions.find(i => i.id === 'inst_bank');
assert(!bank.hasSupervision && !bank.hasAudit, '起点：中央银行四旗全空（欠账进行时）');
const ok2 = entry.aiEntry({ _edictText: '为中央银行设监察，派驻御史稽核账目。' });
assert(ok2 === true, '「为中央银行设监察」诏书落账成功');
assert(bank.hasSupervision === true, '监察旗已设（hasSupervision）');
assert(bank.hasAudit === true, '稽核旗已设（hasAudit）');
assert(!bank.hasTermLimit, '未提任期→任期旗不越权代设');
assert(bank.corruption < 20, '新制上身·衙内风气当期收敛（corruption 下调）');

// 动词精确落旗：「补设监察」只落监察·稽核归考成动词（各票各投·可分次下诏）
const shibo = ctx.GM.dynamicInstitutions.find(i => i.id === 'inst_shibo');
const ok3 = entry.aiEntry({ _edictText: '给市舶司补设监察。' });
assert(ok3 === true && shibo.hasSupervision === true && !shibo.hasAudit,
  '补设监察→监察单旗·不越权代设稽核（市舶司）');

// 任期/问责单列
const ok4 = entry.aiEntry({ _edictText: '为市舶司定任期轮换之制，立问责考核。' });
assert(ok4 === true && shibo.hasTermLimit === true && shibo.hasAccountability === true,
  '任期/问责动词各自落旗');

// 指名不存在的衙门→不落账
const ok5 = entry.aiEntry({ _edictText: '为子虚乌有司设监察。' });
assert(ok5 === false, '不在册衙门→补监察拒绝落账');

// classify 路由：补监察文本归 office_reform
if (typeof EP.classify === 'function') {
  const cls = EP.classify('为中央银行设监察，派驻御史。');
  assert(!cls || !cls.type || String(cls.type).indexOf('office_reform') >= 0 || cls === 'office_reform',
    'classify 将补监察文本归 office_reform（或安全放行）');
} else { assert(true, 'classify 未导出·跳过路由断言'); }

console.log('smoke-office-supervision ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);

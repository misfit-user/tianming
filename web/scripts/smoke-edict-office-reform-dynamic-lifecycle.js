#!/usr/bin/env node
// smoke-edict-office-reform-dynamic-lifecycle.js - direct office-reform edicts must create dynamic institutions.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function load(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

const ctx = {
  console,
  Date, JSON, Math,
  setTimeout: () => {},
  clearTimeout: () => {},
  GM: {
    turn: 72,
    month: 1,
    huangquan: { index: 60 },
    huangwei: { index: 60 },
    minxin: { trueIndex: 55 },
    guoku: { money: 5000000 },
    officeTree: { 中央: {} },
    chars: [],
    corruption: { overall: 30 },
    _pendingMemorials: [],
    _pendingClarifications: [],
    dynamicInstitutions: [],
    customOffices: []
  },
  P: {},
  addEB: () => {},
  toast: () => {},
  callAI: async () => null
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

(function main() {
  load(ctx, 'tm-fiscal-engine.js');
  load(ctx, 'tm-edict-parser.js');

  assert(ctx.EdictParser && typeof ctx.EdictParser.tryExecute === 'function', 'EdictParser.tryExecute should load');
  assert(ctx.FiscalEngine && typeof ctx.FiscalEngine.trySpendFromGuoku === 'function',
    'office reform smoke uses the same canonical fiscal provider as production');

  const result = ctx.EdictParser.tryExecute('诏令：设文书司，正五品，掌诏令档案，司典籍校雠。', {}, {});
  assert(result && result.ok, 'direct office reform edict should execute');
  assert(result.classification && result.classification.typeKey === 'office_reform', 'direct edict should classify as office_reform');

  const inst = ctx.GM.dynamicInstitutions.find(i => i && i.name === '文书司');
  assert(inst, 'direct office reform edict should register GM.dynamicInstitutions');
  assert(inst.rank === 5, 'dynamic institution should infer rank from text');
  assert(/诏令档案/.test(inst.duties || ''), 'dynamic institution should infer duties from text');
  assert(inst.createdBy === 'edict', 'dynamic institution should be attributed to edict');
  assert(inst.stage === 'proposal', 'dynamic institution should enter proposal lifecycle stage');
  assert(ctx.GM.customOffices.some(o => o && o.name === '文书司'), 'legacy customOffices mirror should still be written');

  const beforeCount = ctx.GM.dynamicInstitutions.length;
  const again = ctx.EdictParser.tryExecute('诏令：设文书司，正五品，掌诏令档案，司典籍校雠。', {}, {});
  assert(again && again.ok, 'duplicate direct office reform edict should not fail');
  assert(ctx.GM.dynamicInstitutions.length === beforeCount, 'duplicate direct office reform edict should not create duplicate dynamic institutions');

  ctx.GM.month = 1;
  ctx.GM.turn = 73;
  const moneyBeforeTick = ctx.GM.guoku.money;
  ctx.EdictParser.tick({ turn: 73, monthRatio: 1 });
  assert(inst.stage === 'running' || inst.stage === 'proposal' || inst.stage === 'underfunded', 'dynamic institution should remain in lifecycle after tick');
  assert(ctx.GM.guoku.money <= moneyBeforeTick, 'dynamic institution lifecycle tick should be able to budget through guoku');

  console.log('[smoke-edict-office-reform-dynamic-lifecycle] PASS direct office reform dynamic lifecycle');
})();

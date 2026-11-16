#!/usr/bin/env node
// smoke-ai-structured-policy-actions.js - AI structured policy fields must land through the existing EdictParser bridge.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function runFile(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

function buildContext() {
  const calls = [];
  const ctx = {
    console: { log(){}, warn(){}, info(){}, error(){}, debug(){} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Error, TypeError, RangeError,
    __edictCalls: calls
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  ctx.GM = {
    turn: 52,
    _turnReport: [],
    chars: [],
    facs: [{ name: '明朝廷', isPlayer: true, treasury: { money: 1000 } }],
    parties: [],
    classes: [],
    armies: [],
    items: [],
    regions: [],
    officeTree: { 中央: {} },
    guoku: { money: 50000, grain: 30000 },
    neitang: { money: 20000 },
    population: {
      hiddenCount: 1000,
      byLegalStatus: { huangji: { households: 100, mouths: 500, ding: 200 }, taoohu: { households: 20, mouths: 100, ding: 30 } },
      byRegion: {}
    }
  };
  ctx.P = { playerInfo: { factionName: '明朝廷' }, conf: {}, time: { year: 1627 } };
  ctx.TM = { errors: { capture(){}, captureSilent(){} } };
  ctx.EdictParser = {
    tryExecute(text, params, meta) {
      calls.push({ text: String(text || ''), params: params || {}, meta: meta || {} });
      return { ok: true, pathway: 'direct', classification: { typeKey: meta && meta.expectedType || 'smoke' } };
    }
  };
  ctx.escHtml = (s) => String(s || '');
  ctx.getTSText = (t) => 'T' + t;
  ctx.addEB = () => {};
  vm.createContext(ctx);
  return ctx;
}

(function main() {

  const schemaCtx = buildContext();
  runFile(schemaCtx, 'tm-ai-schema.js');
  runFile(schemaCtx, 'tm-ai-output-validator.js');
  assert(schemaCtx.TM_AI_SCHEMA, 'TM_AI_SCHEMA should load');
  assert(schemaCtx.TM && typeof schemaCtx.TM.validateAIOutput === 'function', 'validator should load');
  const validation = schemaCtx.TM.validateAIOutput({
    turn_summary: '结构化政策动作测试',
    currency_adjustments: [{ action: 'ban_private_mint', reason: '私铸扰乱钱法' }],
    population_adjustments: [{ action: 'purge_hidden', reason: '清查隐户' }],
    central_local_actions: [{ action: 'transfer_to_region', region: '江南', amount: 50000, purpose: 'disaster_relief' }],
    environment_actions: [{ action: 'ban_logging', region: '江南' }],
    institution_changes: [{ action: 'create', name: '榷货司', rank: 5, duties: '总理钱法' }]
  }, 'smoke-ai-policy-actions');
  assert(validation.ok, 'validator should accept structured policy fields');
  assert(!validation.warnings.some(w => /currency_adjustments|population_adjustments|central_local_actions|environment_actions|institution_changes/.test(w)), 'structured policy fields should not warn as unknown');

  const ctx = buildContext();
  runFile(ctx, 'tm-ai-change-pathutils.js');
  runFile(ctx, 'tm-ai-change-army.js');
  runFile(ctx, 'tm-ai-change-narrative.js');
  runFile(ctx, 'generated/tm-ai-change-applier.bundle.js');

  const result = ctx.AIChangeApplier.applyAITurnChanges({
    currency_adjustments: [
      { action: 'ban_private_mint', reason: '私铸扰乱钱法' },
      { action: 'issue_paper', paperName: '会子', amount: 200000, reserveRatio: 0.4, reason: '蜀中商旅钱紧' }
    ],
    population_adjustments: [
      { action: 'purge_hidden', reason: '清查隐户' },
      { action: 'resettle_refugees', region: '京畿', reason: '招抚逃户流民' }
    ],
    central_local_actions: [
      { action: 'transfer_to_region', region: '江南', amount: 50000, purpose: 'disaster_relief' },
      { action: 'set_region_allocation', region: '江南', qiyunRatio: 0.7, cunliuRatio: 0.3 }
    ],
    environment_actions: [
      { action: 'ban_logging', region: '江南' },
      { action: 'dredge', region: '江南' }
    ],
    institution_changes: [
      { action: 'create', name: '榷货司', rank: 5, duties: '总理钱法' }
    ]
  });

  assert(result && result.ok, 'applyAITurnChanges should return ok');
  assert(ctx.__edictCalls.length === 9, 'structured policy fields should execute nine EdictParser calls, got ' + ctx.__edictCalls.length);
  assert(ctx.__edictCalls.some(c => /严禁民间私铸/.test(c.text)), 'currency action should become an edict-like private mint ban');
  assert(ctx.__edictCalls.some(c => /发行会子/.test(c.text) && c.params.amount === 200000), 'currency paper issue should preserve amount params');
  assert(ctx.__edictCalls.some(c => /清查隐户/.test(c.text)), 'population action should become huji edict text');
  assert(ctx.__edictCalls.some(c => /下拨江南银50000两/.test(c.text)), 'central-local transfer should preserve region and amount');
  assert(ctx.__edictCalls.some(c => /禁伐江南山林/.test(c.text)), 'environment action should become environment edict text');
  assert(ctx.__edictCalls.some(c => /设榷货司/.test(c.text) && c.params.officeName === '榷货司'), 'institution create should become office reform edict text');
  assert(ctx.GM._aiStructuredPolicyActions && ctx.GM._aiStructuredPolicyActions.length === 9, 'GM should retain an audit ledger for structured policy actions');
  assert(result.applied.semantic && result.applied.semantic.ai_policy_actions === 9, 'applied semantic count should include structured policy actions');

  console.log('[smoke-ai-structured-policy-actions] PASS AI structured policy action bridge');
})();

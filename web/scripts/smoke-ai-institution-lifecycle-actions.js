#!/usr/bin/env node
// smoke-ai-institution-lifecycle-actions.js - AI institution_changes must enter the real EdictParser institution lifecycle.

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

function buildContext() {
  const eb = [];
  const ctx = {
    console,
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Error, TypeError, RangeError,
    __eb: eb
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  ctx.GM = {
    turn: 63,
    month: 1,
    _turnReport: [],
    dynamicInstitutions: [],
    customOffices: [],
    officeTree: [],
    guoku: { money: 5000000 },
    huangquan: { index: 60 },
    population: { byLegalStatus: {}, byRegion: {} },
    chars: [],
    facs: [{ name: '明朝廷', isPlayer: true }],
    parties: [],
    classes: [],
    armies: [],
    items: [],
    regions: []
  };
  ctx.P = { playerInfo: { factionName: '明朝廷' }, conf: {}, time: { year: 1627 } };
  ctx.TM = { errors: { capture(){}, captureSilent(){} } };
  ctx.addEB = (type, text) => eb.push({ type, text });
  ctx.escHtml = (s) => String(s || '');
  ctx.getTSText = (t) => 'T' + t;
  vm.createContext(ctx);
  return ctx;
}

(function main() {
  const ctx = buildContext();
  load(ctx, 'tm-ai-change-pathutils.js');
  load(ctx, 'tm-ai-change-army.js');
  load(ctx, 'tm-ai-change-narrative.js');
  load(ctx, 'tm-office-creation.js');
  load(ctx, 'tm-office-reform.js');
  load(ctx, 'tm-fiscal-engine.js');
  load(ctx, 'tm-edict-parser.js');
  load(ctx, 'generated/tm-ai-change-applier.bundle.js');

  assert(ctx.EdictParser && typeof ctx.EdictParser.registerDynamicInstitution === 'function', 'EdictParser dynamic institution API should load');
  assert(ctx.AIChangeApplier && typeof ctx.AIChangeApplier.applyAITurnChanges === 'function', 'AIChangeApplier should load');

  const createResult = ctx.AIChangeApplier.applyAITurnChanges({
    institution_changes: [
      { action: 'create', name: '榷货司', rank: 5, duties: '总理钱法与商税', annualBudget: 30000, staffSize: 24, reason: '整顿货币商税' }
    ]
  });

  assert(createResult && createResult.ok, 'create apply should return ok');
  const created = ctx.GM.dynamicInstitutions.find(i => i && i.name === '榷货司');
  assert(created, 'institution_changes:create should register a real dynamic institution');
  assert(created.rank === 5, 'created dynamic institution should preserve rank');
  assert(created.duties === '总理钱法与商税', 'created dynamic institution should preserve duties');
  assert(created.annualBudget === 30000, 'created dynamic institution should preserve annualBudget');
  assert(ctx.GM.officeTree.some(n => n.name === '榷货司'), 'institution also lands in the real runtime tree');
  const createAudit = ctx.GM._aiStructuredPolicyActions.find(a => a && a.field === 'institution_changes' && a.lifecycle && a.lifecycle.action === 'create');
  assert(createAudit, 'create should record lifecycle audit metadata');
  assert(createAudit.result && Object.prototype.hasOwnProperty.call(createAudit.result, 'edict'), 'create should still keep the office reform tryExecute audit result');
  assert(createResult.applied.semantic && createResult.applied.semantic.ai_policy_actions === 1, 'create should count as one AI policy action');

  const abolishResult = ctx.AIChangeApplier.applyAITurnChanges({
    institution_changes: [
      { action: 'abolish', id: created.id, name: '榷货司', reason: '并归户部，免重费' }
    ]
  });

  assert(abolishResult && abolishResult.ok, 'abolish apply should return ok');
  const abolished = ctx.GM.dynamicInstitutions.find(i => i && i.id === created.id);
  assert(abolished && abolished.stage === 'abolished', 'institution_changes:abolish should mark the dynamic institution abolished');
  assert(abolished.abolishedTurn === 63, 'abolish should stamp current turn');
  assert(!ctx.GM.officeTree.some(n => n.name === '榷货司'), 'abolish removes the exact linked runtime department');
  assert(ctx.GM._aiStructuredPolicyActions.some(a => a && a.field === 'institution_changes' && a.lifecycle && a.lifecycle.action === 'abolish'), 'abolish should record lifecycle audit metadata');
  assert(abolishResult.applied.semantic && abolishResult.applied.semantic.ai_policy_actions === 1, 'abolish should count as one AI policy action');

  console.log('[smoke-ai-institution-lifecycle-actions] PASS AI institution lifecycle actions');
})();

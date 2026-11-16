#!/usr/bin/env node
// smoke-postturn-court-turn-gating.js
// Ensures post-turn Shuochao decisions are attributed to the next turn only.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const promptSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');
const changchaoSrc = (fs.readFileSync(path.join(ROOT, 'tm-chaoyi-changchao-adapter.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-chaoyi-changchao.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-chaoyi-changchao-flows.js'), 'utf8'));
const courtSrc = fs.readFileSync(path.join(ROOT, 'tm-court-meter.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-core.js'), 'utf8');

let passed = 0;
function assert(cond, label) {
  if (!cond) throw new Error('[assert] ' + label);
  passed++;
}

const sandbox = {
  console,
  window: null,
  global: null,
  TM: { Endturn: { AI: { prompt: {} } }, errors: { capture: function(){}, captureSilent: function(){} } }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(promptSrc, sandbox, { filename: 'tm-endturn-prompt.js' });

const promptApi = sandbox.TM.Endturn.AI.prompt;
assert(promptApi && typeof promptApi.getCurrentChangchaoDecisions === 'function', 'prompt exposes getCurrentChangchaoDecisions');

const closeMatch = changchaoSrc.match(/function _cc3_close\(\)\s*\{([\s\S]*?)\n\}/);
assert(!!closeMatch, 'Changchao close block found');
assert(closeMatch[1].indexOf('GM._isPostTurnCourt') < 0, 'manual Changchao close does not infer post-turn from stale GM flag');

const openBranch = courtSrc.match(/function _postTurnCourtChoose\(openCourt\)\s*\{([\s\S]*?)\}\s*else\s*\{/);
assert(!!openBranch, 'post-turn court open branch found');
const startIdx = openBranch[1].indexOf('_endTurnInternal({ postTurnCourt: true });');
const courtUiIdx = openBranch[1].indexOf('setTimeout(function(){');
assert(startIdx >= 0, 'opening Shuochao starts end-turn pipeline');
assert(courtUiIdx >= 0, 'opening Shuochao schedules court UI');
assert(startIdx < courtUiIdx, 'end-turn pipeline starts before Shuochao UI schedule');
const txnIdx = coreSrc.indexOf('_turnTxn = _tmCaptureEndTurnTransaction();');
const courtStateIdx = coreSrc.indexOf("Object.prototype.hasOwnProperty.call(options, 'postTurnCourt')");
const prepareIdx = coreSrc.indexOf('await _tmPrepareEndTurnBoundary(_turnTxn, _preCommittedState);', courtStateIdx);
const recoveryCommitIdx = coreSrc.indexOf('await _tmCommitPreEndTurnRecoveryPoint(txn, clickState);');
const calibrationIdx = coreSrc.indexOf('await _runPreSubmitPartyClassCalibration();', recoveryCommitIdx);
assert(txnIdx >= 0 && courtStateIdx > txnIdx && prepareIdx > courtStateIdx
  && recoveryCommitIdx >= 0 && calibrationIdx > recoveryCommitIdx,
  'court flags begin after the transaction snapshot and calibration waits for the click-time recovery commit');

const postTurnGM = {
  turn: 1,
  _lastChangchaoDecisions: [{ action: 'approve', title: 'Post-turn Shuochao decision' }],
  _lastChangchaoDecisionMeta: { turn: 1, targetTurn: 2, phase: 'post-turn', mode: 'changchao' }
};
assert(promptApi.getCurrentChangchaoDecisions(postTurnGM).length === 0, 'post-turn decisions do not affect current ending turn');

postTurnGM.turn = 2;
assert(promptApi.getCurrentChangchaoDecisions(postTurnGM).length === 1, 'post-turn decisions affect their target turn');

const overlappingCourtGM = {
  turn: 1,
  _lastChangchaoDecisions: [{ action: 'decree', title: 'Next-turn Shuochao decision' }],
  _lastChangchaoDecisionMeta: { turn: 1, targetTurn: 2, phase: 'post-turn', mode: 'changchao' },
  _courtRecords: [
    {
      turn: 1,
      targetTurn: 1,
      phase: 'in-turn',
      decisions: [{ action: 'approve', title: 'Current-turn morning court decision' }]
    },
    {
      turn: 1,
      targetTurn: 2,
      phase: 'post-turn',
      decisions: [{ action: 'decree', title: 'Next-turn Shuochao decision' }]
    }
  ]
};
assert(promptApi.getCurrentChangchaoDecisions(overlappingCourtGM).length === 1,
  'current-turn court decisions survive when post-turn Shuochao overwrites _lastChangchaoDecisions');

const inTurnGM = {
  turn: 3,
  _lastChangchaoDecisions: [{ action: 'reject', title: 'In-turn court decision' }],
  _lastChangchaoDecisionMeta: { turn: 3, targetTurn: 3, phase: 'in-turn', mode: 'changchao' }
};
assert(promptApi.getCurrentChangchaoDecisions(inTurnGM).length === 1, 'in-turn decisions still affect current turn');

const legacyGM = {
  turn: 4,
  _lastChangchaoDecisions: [{ action: 'hold', title: 'Legacy decision without metadata' }]
};
assert(promptApi.getCurrentChangchaoDecisions(legacyGM).length === 1, 'legacy saves without metadata remain readable');

console.log('[smoke-postturn-court-turn-gating] pass assertions=' + passed);

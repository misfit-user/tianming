const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed++;
}

const infra = (read('tm-ai-infra-retry.js') + '\n' + read('tm-ai-infra.js'));
const ai = read('tm-endturn-ai.js');
const followup = read('tm-endturn-followup.js');
const apply = read('generated/tm-ai-change-applier.bundle.js');
const reconcile = read('modules/ai-change-applier/reconcile.js');
const legacyAdapter = read('modules/ai-change-applier/legacy-adapter.js');
const endApply = read('tm-endturn-apply.js') + '\n' + read('tm-endturn-apply-stages.js'); // apply解构S2·preflightAIWriteBack 等迁 stages·拼接 origin→stages
const render = read('tm-endturn-render.js');

assert(/function\s+ensureAIDiagnostics\s*\(/.test(infra), 'ensureAIDiagnostics exists');
assert(/function\s+recordAIDiagnostic\s*\(/.test(infra), 'recordAIDiagnostic exists');
assert(/function\s+setAIBranchDiagnostic\s*\(/.test(infra), 'setAIBranchDiagnostic exists');
assert(/ensureDiagnostics:\s*typeof ensureAIDiagnostics/.test(infra), 'TM.ai exposes diagnostics helper');
assert(/hints:\s*\[\]/.test(infra) && /kind === 'write_hint'/.test(infra), 'AI diagnostics supports hidden hints');

assert(/async function\s+_callEndturnAI\s*\(/.test(ai), 'endturn AI station helper exists');
assert(/ctx\.subcalls\._callEndturnAI\s*=\s*_callEndturnAI/.test(ai), 'AI station exported to ctx');
assert(/function\s+_formatAIError\s*\(/.test(ai), 'AI station error formatter exists');
assert(/_callEndturnAI\(_sc1Body/.test(ai), 'sc1 routes through AI station');
assert(/_callEndturnAI\(_sc1bBody/.test(ai), 'sc1b routes through AI station');
assert(/_callEndturnAI\(_sc1cBody/.test(ai), 'sc1c routes through AI station');
assert(/_callEndturnAI\(_sc1dBody/.test(ai), 'sc1d routes through AI station');
assert(/recordAIDiagnostic\('call'/.test(ai), 'AI station records call diagnostics');
assert(/recordAIDiagnostic\('call_failed'/.test(ai), 'AI station records failed call diagnostics');
assert(/recordAIDiagnostic\('subcall_failed'/.test(ai), 'subcall wrapper records failed subcall diagnostics');
assert(/setAIBranchDiagnostic\(id,\s*'ok'/.test(ai), 'subcall ok status recorded');
assert(/setAIBranchDiagnostic\(id,\s*'failed'/.test(ai), 'subcall failed status recorded');

assert(/async function\s+_callFollowupAI\s*\(/.test(followup), 'followup AI station adapter exists');
[
  'sc15', 'sc_memwrite', 'sc16', 'sc17', 'sc18', 'sc_audit',
  'sc19', 'sc2', 'sc25', 'sc27', 'sc07', 'sc28',
  'sc_consolidate', 'history_check',
  'compress_ai_memory', 'compress_foreshadows', 'compress_conversation'
].forEach(function(id) {
  assert(new RegExp("_callFollowupAI\\([\\s\\S]{0,220}id:\\s*['\"]" + id + "['\"]").test(followup),
    id + ' routes through followup AI station');
});

assert(/function\s+preflightAIWriteBack\s*\(/.test(apply), 'write preflight helper exists');
assert(/preflightAIWriteBack:\s*preflightAIWriteBack/.test(reconcile), 'write preflight is staged as a legacy export');
assert(/exportKeys\.forEach[\s\S]*publishProperty\(global/.test(legacyAdapter), 'write preflight is published only by the atomic adapter');
assert(/preflightAIWriteBack\(aiOutput/.test(apply), 'applyAITurnChanges invokes preflight');
assert(/function\s+validateAIWriteBackBatch\s*\(/.test(apply), 'strict detached writeback validator exists');
assert(/validateAIWriteBackBatch:\s*validateAIWriteBackBatch/.test(reconcile), 'strict validator is staged as a legacy export');
assert(!/global\.(?:preflightAIWriteBack|validateAIWriteBackBatch)\s*=(?!=)/.test(reconcile), 'reconcile factory must not publish partial globals');
assert(/character_deaths/.test(apply) && /faction_dissolve/.test(apply) && /battleResult/.test(apply), 'high impact fields covered');
assert(/function\s+_tmResolveChar\s*\(/.test(apply) && /function\s+_tmResolveFaction\s*\(/.test(apply), 'weak entity resolvers exist');
assert(/_tmWeakEntityHint/.test(apply) && /_aiWeakWriteHints/.test(apply), 'weak write hints are recorded');
assert(/function\s+_validateAndRepairMainWriteback\s*\(/.test(endApply), 'main writeback validates before field application');
assert(/await\s+_validateAndRepairMainWriteback\(/.test(endApply), 'main writeback awaits bounded repair before atomic apply');
assert(/_strictValidation\s*:\s*true/.test(endApply), 'atomic applier is invoked in strict validation mode');

assert(/GM\._lastAIDiagnostics/.test(render), 'render reads diagnostics');
assert(/hidden summary/.test(render), 'render keeps diagnostics hidden from player feed');

console.log('[smoke-ai-preflight-diagnostics] pass assertions=' + passed);

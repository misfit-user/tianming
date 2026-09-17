#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function read(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}
function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

// 第二十三拆：模型探测族(probeModel*/detect*/getCompressionParams)迁 tm-ai-infra-model-detect.js·拼接(origin 先·契约随人走)
const infra = (read('tm-ai-infra-retry.js') + '\n' + read('tm-ai-infra.js')) + '\n' + read('tm-ai-infra-model-detect.js');
const settings = read('tm-player-settings.js');

assert(infra.includes('async function probeModelEvidenceAudit'), 'probeModelEvidenceAudit missing');
assert(infra.includes("'json_schema'"), 'evidence json/schema check missing');
assert(infra.includes("'endturn_schema'"), 'real endturn schema check missing');
assert(infra.includes("'repair_resilience'"), 'json repair resilience check missing');
assert(infra.includes("'context_recall'"), 'evidence context recall check missing');
assert(infra.includes("'narrative_record'"), 'shizhengji/shilu narrative check missing');
assert(infra.includes("'output_sustain'"), 'evidence output sustain check missing');
assert(infra.includes('weightedScore'), 'weighted evidence score missing');
assert(infra.includes('latencyMs'), 'latency evidence missing');
assert(infra.includes('responseChars'), 'response length evidence missing');
assert(infra.includes('finishReason'), 'finish reason evidence missing');
assert(infra.includes('tm-endturn-mini-v1'), 'endturn-like probe payload missing');
assert(infra.includes('tm-record-mini-v1'), 'record-like probe payload missing');
assert(infra.includes("P.conf._probeHistory[keyName] = report"), 'evidence report not persisted');
assert(infra.includes("P.conf['_evidenceScore' + _sfx]"), 'evidence score not persisted');

const tierUrlMatches = infra.match(/_buildAIUrlForTier\(_tier\)/g) || [];
assert(tierUrlMatches.length >= 4, 'tier-aware probe URLs not consistently used, count=' + tierUrlMatches.length);

assert(/_probeRunEvidence\('primary'\)/.test(settings), 'primary evidence button missing');
assert(/_probeRunEvidence\('secondary'\)/.test(settings), 'secondary evidence button missing');
assert(settings.includes('async function _probeRunEvidence'), '_probeRunEvidence wrapper missing');
assert(settings.includes('仅参考') || settings.includes('\\u4EC5\\u53C2\\u8003'), 'self-report trust warning missing');
assert(settings.includes('var evidence = isSec ? probe.evidence_secondary : probe.evidence;'), 'evidence panel read missing');
assert(settings.includes('_renderEvidenceDetails'), 'evidence detail renderer missing');
assert(settings.includes('6 次'), 'evidence call count prompt not updated');
assert(settings.includes('_refreshBothProbePanels();'), 'both-tier refresh helper not used');

console.log('[smoke-model-probe-evidence] pass assertions=25');

'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const { context, ROOT } = require('./lib-memory-upgrade-r2');
function fixture(options = {}) {
  const c = context(); let calls = 0, persisted = 0;
  c._getAITier = () => c.P.ai; c._buildAIUrlForTier = () => c.P.ai.url + '/chat/completions'; c._persistProbeConf = () => { persisted++; };
  c.setTimeout = fn => setTimeout(fn, 0);
  c._tmAIFetch = async (_url, request) => {
    calls++; const body = JSON.parse(request.body), prompt = body.messages.map(m => m.content).join('\n'); let content = '', message;
    if (options.onRequest) options.onRequest(c, calls);
    if (options.failAll) return { ok: false, status: 503, text: async () => 'synthetic unavailable' };
    if (calls === 1) content = JSON.stringify({ probe: 'tm-evidence-v1', sum: 1213, reverse: 'gnimnait', items: [2,4,6,8], truth: true });
    else if (calls === 2) content = prompt.slice(prompt.indexOf('{'), prompt.lastIndexOf('}') + 1);
    else if (calls === 3) content = JSON.stringify({ probe: 'tm-repair-mini-v1', edict_relations: [{ edict: '命户部赈灾', result: '民心+3' }], resource_changes: [{ pool: 'guoku', delta: -5000, reason: '赈灾' }], note: 'keep' });
    else if (calls === 4) content = JSON.stringify({ head: prompt.match(/HEAD_SECRET=([A-Z0-9]+)/)[1], tail: prompt.match(/TAIL_SECRET=([A-Z0-9]+)/)[1], latestTopic: '赈灾', discardedTopic: '加税' });
    else if (calls === 5) content = JSON.stringify({ probe: 'tm-record-mini-v1', title: '辽东赈灾', summary: '袁崇焕议赈灾。', shiluText: '袁崇焕奏辽东赈灾。'.repeat(6), shizhengji: '朝廷议辽东赈灾。'.repeat(4) });
    else if (calls === 6) { const nonce = prompt.match(/TM-PROBE-001-([A-Z0-9]+)/)[1]; content = Array.from({ length: 60 }, (_, i) => 'TM-PROBE-' + String(i + 1).padStart(3, '0') + '-' + nonce).join('\n'); }
    else if (calls === 7) {
      const lines = prompt.split('\n'), records = JSON.parse(lines.find(line => line.startsWith('['))), depot = JSON.parse(lines.find(line => line.includes('"id":"r4"')));
      content = JSON.stringify({ subject: records[1].subject, destination: records[1].destination, depot: depot.depot, source_refs: ['r2','r4'] });
    } else if (calls === 8) {
      const records = JSON.parse(prompt.slice(prompt.indexOf('Records: ') + 9));
      content = JSON.stringify({ completed: [{ task: records[1].task, source_refs: ['a1','a2'] }], open: [{ task: records[2].task, source_refs: ['a3'] }], unsupported: [{ task: records[3].task, source_refs: ['a4'] }] });
    } else if (calls === 9) message = { tool_calls: [{ id: 'call-test', type: 'function', function: { name: 'recall_by_entity', arguments: JSON.stringify({ name: prompt.match(/history of ([^,]+),/)[1], kind: 'person' }) } }], content: null };
    if (options.fenced && calls === 1) content = '```json\n' + content + '\n```';
    return { ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: message || { content }, finish_reason: message ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100 } }) };
  };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-ai-infra-model-detect.js'), 'utf8'), c, { filename: 'tm-ai-infra-model-detect.js' });
  return { c, stats: () => ({ calls, persisted }) };
}
(async () => {
  let passed = 0, failed = 0;
  async function test(name, run) { try { await run(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); } }
  await test('actual evidence audit executes nine probes and persists an owned profile', async () => {
    const { c, stats } = fixture(); const report = await c.probeModelEvidenceAudit({ contextChars: 2000 });
    assert.equal(stats().calls, 9); assert.equal(report.total, 9); assert.equal(report.passed, 9); assert.equal(stats().persisted, 1);
    assert.equal(c.TM.MemoryAdaptive.plan().mode, 'deep'); assert.equal(c.TM.MemoryAdaptive.plan().plannerMode, 'native');
  });
  await test('markdown-wrapped JSON no longer passes the strict JSON probe', async () => {
    const { c } = fixture({ fenced: true }); const report = await c.probeModelEvidenceAudit({ contextChars: 2000 });
    assert.equal(report.checks.find(r => r.id === 'json_schema').ok, false); assert.equal(c.TM.MemoryAdaptive.plan().mode, 'compact');
  });
  await test('provider failure is unavailable evidence rather than low reasoning ability', async () => {
    const { c, stats } = fixture({ failAll: true }); const report = await c.probeModelEvidenceAudit({ contextChars: 2000 });
    assert(report.checks.every(row => row.state === 'unavailable' && row.weight === 0)); assert.equal(report.reliability, 'unknown'); assert.equal(c.TM.MemoryAdaptive.plan().verified, false); assert(stats().calls <= 18);
  });
  await test('switching configuration during a probe never overwrites the new profile', async () => {
    const { c, stats } = fixture({ onRequest(c, number) { if (number === 1) c.P.ai.model = 'changed-model'; } });
    const report = await c.probeModelEvidenceAudit({ contextChars: 2000 }); assert.equal(report.stale, true); assert.equal(stats().persisted, 0); assert.equal(c.P.conf._memoryCapabilityProfiles, undefined);
  });
  console.log(JSON.stringify({ passed, failed, tests: 4 })); if (failed) process.exitCode = 1;
})();

#!/usr/bin/env node
// 普通重试 smoke：回答解析不了就按票重新要、截断的不收、次数有上限、换了世界不再重试、工具参数写坏了重新要；
// 11-08 删掉「回合复核与应急推演」后，这些留在 tm-ai-reply-retry.js（不再有应急修补）。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };

function load() {
  const c = { console: { log() {}, warn() {}, error() {} }, TM: {}, GM: { turn: 3, _campaignId: 'c', _timelineId: 't' }, P: { ai: { key: 'k' } }, _tmLoadGen: 1 };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-ai-reply-retry.js'), 'utf8'), c, { filename: 'tm-ai-reply-retry.js' });
  return c;
}
// 照 _parseOrRepairJsonResultNormal 的形状：能解析就给 parsed；不能就 failed，没收尾的记 truncated
function normal(raw) {
  try { return { parsed: JSON.parse(raw), raw, repaired: false, truncated: false }; }
  catch (_) { return { parsed: null, raw, repaired: false, truncated: /^\s*\{[^}]*$/.test(raw), failed: true }; }
}
const reply = (content) => ({ choices: [{ message: { content }, finish_reason: 'stop' }] });

(async () => {
  let c = load();
  const A = c.TM.RecoveryAdapters, R = c.TM.RecoveryRuntime;
  ok(A && R && typeof R.parse === 'function' && typeof R.tools === 'function', '对外仍是 TM.RecoveryAdapters / TM.RecoveryRuntime');
  ok(!A.json && !A.identity && !A.edited && !R.finalSC1 && !c.TM.EmergencyRecovery, '应急修补全删：没有 json/identity 修补、没有主推演最后一搏');

  const sent = [];
  let queue = [];
  c._aiFetchWithRetry = async (url, body, signal, o) => { sent.push(o); A.claimNormal(o); return queue.shift(); };
  const spec = (maxRetries) => ({ id: 'sc1', url: 'U', key: 'K', body: { messages: [] }, maxRetries });

  let r = await R.parse('{"a":1}', reply('{"a":1}'), '主推演', spec(2), normal);
  ok(r.parsed && r.parsed.a === 1 && sent.length === 0, '能解析的直接用，不重要');

  queue = [reply('{"a":2}')];
  r = await R.parse('{"a":1,}', reply('{"a":1,}'), '主推演', spec(2), normal);
  ok(r.parsed && r.parsed.a === 2 && sent.length === 1 && sent[0].maxRetries === 0 && sent[0]._turnRetriesResolved === true, '写坏了：按票重要一次，拿到能解析的就用');

  sent.length = 0;
  r = await R.parse('{"a":"阻止东林', reply('{"a":"阻止东林'), '主推演', spec(2), normal);
  ok(r.failed && r.parsed === null && sent.length === 0, '截断的不收、也不重要（交断处续与救援）');

  sent.length = 0; queue = [reply('{"a":1,}'), reply('{"a":1,}'), reply('{"a":3}')];
  r = await R.parse('{"a":1,}', reply('{"a":1,}'), '主推演', spec(2), normal);
  ok(r.failed && r.parsed === null && sent.length === 2, '一直写坏：重要到上限（2 次）就照旧失败，不做应急修补');

  sent.length = 0;
  c.GM = { turn: 4, _campaignId: 'c', _timelineId: 't' };
  const data = reply('{"a":1,}');
  const o = A.beginNormal({ id: 'sc1', maxRetries: 2 });
  A.markResponse(data, o);
  c.GM = { turn: 5, _campaignId: 'c', _timelineId: 't' };
  await assert.rejects(R.parse('{"a":1,}', data, '主推演', spec(2), normal), (e) => e.code === 'AI_STALE_WORLD'); checks++;
  ok(sent.length === 0, '读档、换回合后旧回答不再重试');

  c = load();
  const R2 = c.TM.RecoveryRuntime, A2 = c.TM.RecoveryAdapters;
  let calls = 0;
  const toolNormal = async (prompt, defs, o2) => { calls++; A2.claimNormal(o2); return calls < 2 ? { text: '', toolCalls: [], _recoveryRawTools: [{ name: 'x', arguments: '{"a":' }] } : { text: 'ok', toolCalls: [{ name: 'x', input: { a: 1 } }] }; };
  const t = await R2.tools('p', [{ name: 'x', parameters: { type: 'object' } }], { id: 'agent', maxRetries: 1 }, toolNormal);
  ok(t.text === 'ok' && calls === 2, '工具参数写坏了：重新要一次');
  calls = 0;
  const bad = await R2.tools('p', [], { id: 'agent', maxRetries: 1 }, async (p, d, o3) => { calls++; A2.claimNormal(o3); return { text: '', toolCalls: [], _recoveryRawTools: [{ name: 'x', arguments: '{' }] }; });
  ok(bad.error && bad.error.code === 'tool-json-invalid' && calls === 2, '工具参数一直写坏：到上限照旧失败');

  ok(A2.schemaOK({ a: 1 }, { type: 'object', properties: { a: { type: 'integer' } }, required: ['a'] }) && !A2.schemaOK({}, { type: 'object', required: ['a'] }), '工具参数契约检查还在');
  ok(A2.sourcePreserved('{"a":1}', { parsed: { a: 1 }, raw: '{"a":1}' }) && !A2.sourcePreserved('{"a":1,}', { parsed: { a: 1 }, raw: '{"a":1,}', repaired: true }), '原文核对还在');

  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  ok(/tm-ai-reply-retry\.js/.test(html) && !/tm-emergency-recovery-/.test(html), 'index.html 只载普通重试，回合复核与应急推演的模块不再加载');
  const ai = fs.readFileSync(path.join(WEB, 'tm-endturn-ai.js'), 'utf8');
  ok(/TM\.RecoveryRuntime\.parse\(/.test(ai) && !/finalSC1/.test(ai), '回合子调用的解析仍经普通重试；主推演不再走应急最后一搏');
  const settings = fs.readFileSync(path.join(WEB, 'tm-call-budget-settings.js'), 'utf8') + fs.readFileSync(path.join(WEB, 'tm-patches.js'), 'utf8');
  ok(!/RecoverySettings/.test(settings), '设置里「回合复核与应急推演」那一栏没了');
  const infer = fs.readFileSync(path.join(WEB, 'tm-endturn-ai-infer.js'), 'utf8') + fs.readFileSync(path.join(WEB, 'tm-endturn-apply-stages.js'), 'utf8');
  ok(!/RecoveryReview|requireTurnReview|_deferNarrativeRepairs/.test(infer), '每回合复核不再启动；叙事修补不再推给复核，照旧当场修');

  console.log('smoke-ai-reply-retry: ' + checks + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });

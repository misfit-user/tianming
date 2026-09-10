#!/usr/bin/env node
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const root = path.resolve(__dirname, '../..'), at = process.argv.indexOf('--source-ref'), ref = at < 0 ? null : process.argv[at + 1];
function fixture() {
  const store = new Map(), c = { console, Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } };
  c.window = c; vm.createContext(c);
  for (const f of ['tm-agent-kernel.js', 'editor-authoring-agent-provider.js', 'editor-authoring-agent.js']) {
    const file = 'web/' + f, source = ref ? cp.execFileSync('git', ['show', ref + ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }) : fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInContext(source, c, { filename: file });
  }
  return { aa: c.TM.AuthoringAgent, store, c };
}
const opts = { noMemoryRecall: true, conventions: '', toolPacks: false, maxIterations: 6, maxTokens: 1000000 };
const call = (name, input = {}) => ({ id: name, name, input }), reply = (...toolCalls) => Promise.resolve({ toolCalls });
const finish = call('finish', { summary: '已完成' }), bad = call('applyEdit', { path: 'labels.missing.text', value: '目标值' });
const base = () => ({ name: '原剧本', labels: [] });
function scripted(steps) { let n = 0; return () => reply(...(steps[n++] || [finish])); }
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
(async () => {
  await test('failed write cannot be followed by a false completed result', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()), r = await aa.runAuthoringLoop(d, '修改不存在的条目', { ...opts, caller: scripted([[bad]]) });
    assert.equal(r.finished, false); assert.equal(r.completion.status, 'blocked'); assert.equal(r.completion.unresolved.length, 1); assert.equal(d.labels.length, 0);
  });
  await test('repairing the actual failed target closes it; an unrelated success does not', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base());
    const r = await aa.runAuthoringLoop(d, '补齐条目', { ...opts, caller: scripted([[bad], [call('applyEdit', { path: 'name', value: '无关改名' }), finish], [call('applyPush', { path: 'labels', value: { name: 'missing' } }), bad, finish]]) });
    assert(r.transcript.some(t => t.name === 'finish' && t.result.errorCode === 'unresolved-writes')); assert.equal(r.finished, true); assert.equal(r.completion.unresolved.length, 0); assert.equal(d.labels[0].text, '目标值');
  });
  await test('explicit partial outcome stops honestly and retains unresolved work', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()), r = await aa.runAuthoringLoop(d, '部分处理', { ...opts, caller: scripted([[bad, call('applyEdit', { path: 'name', value: '可完成的改名' })], [call('finish', { status: 'partial', summary: '仅改名，目标条目缺失' })]]) });
    assert.equal(r.finished, false); assert.equal(r.stopReason, 'partial'); assert.equal(r.completion.status, 'partial'); assert.equal(r.completion.unresolved.length, 1); assert(r.resumeState);
  });
  await test('optional read miss and true no-op may finish without inventing a modification', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()), r = await aa.runAuthoringLoop(d, '只核对', { ...opts, caller: scripted([[call('getField', { path: 'notExisting' }), call('applyEdit', { path: 'name', value: '原剧本' })], [finish]]) });
    assert(r.finished); assert(r.completion, 'explicit completion contract is present'); assert.equal(r.completion.status, 'unchanged'); assert.equal(r.completion.unresolved.length, 0);
  });
  await test('equal-length Unicode edit is observed exactly in the write receipt', async () => {
    const { aa } = fixture(), original = { name: '原', description: '甲'.repeat(2000) }, d = aa.makeDraft(original);
    const r = await aa.runAuthoringLoop(d, '改一个字', { ...opts, caller: scripted([[call('applyEdit', { path: 'description', value: '乙' + original.description.slice(1) })], [finish]]) });
    const receipt = r.toolReceipts.find(t => t.tool === 'applyEdit'); assert.equal(aa.computeDiff(original, d).length, 1); assert.equal(receipt.changed, true); assert.equal(receipt.verified, true);
    assert(!JSON.stringify(receipt).includes('甲'.repeat(20)), 'receipts never expose full state snapshots');
  });
  await test('unfinished todos cannot be erased by repeatedly insisting on finish', async () => {
    const { aa } = fixture(), r = await aa.runAuthoringLoop(aa.makeDraft(base()), '执行两步', { ...opts, caller: scripted([[call('todoWrite', { todos: [{ content: '必须完成', status: 'pending' }] })]]) });
    assert.equal(r.finished, false); assert.equal(r.todos.length, 1); assert.equal(r.completion.status, 'blocked');
  });
  await test('parallel run cannot reset another run unfinished todos', async () => {
    const { aa } = fixture(); let n = 0, release, entered;
    const ready = new Promise(r => { entered = r; });
    const a = aa.runAuthoringLoop(aa.makeDraft(base()), 'A任务', { ...opts, caller: () => { n++; if (n === 1) return reply(call('todoWrite', { todos: [{ content: 'A未完成', status: 'pending' }] })); if (n === 2) { entered(); return new Promise(r => { release = () => r({ toolCalls: [finish] }); }); } return reply(finish); } });
    await ready; const b = await aa.runAuthoringLoop(aa.makeDraft(base()), 'B核对', { ...opts, caller: () => reply(finish) }); release(); const r = await a;
    assert(b.finished); assert.equal(r.finished, false); assert.equal(r.todos[0].content, 'A未完成');
  });
  await test('failed run carries a usable same-draft recovery with side effects, receipts and failed writes', async () => {
    const { aa, store } = fixture(), d = aa.makeDraft(base()); let n = 0, error;
    try { await aa.runAuthoringLoop(d, '改名并记住约定', { ...opts, caller: () => ++n === 1 ? reply(call('applyEdit', { path: 'name', value: '已经改好的名称' }), call('saveMemory', { name: 'safe-note', description: '隔离约定', body: 'synthetic-private-body' }), bad) : Promise.reject(Error('controlled-provider-failure')) }); } catch (e) { error = e; }
    assert(error && error.partial && error.partial.resumeState); assert.equal(error.partial.sideEffects.length, 1); assert.equal(error.partial.toolReceipts.length, 3); assert.equal(store.size, 0);
    assert(!JSON.stringify(error.partial.resumeState).includes('synthetic-private-body'));
    const r = await aa.runAuthoringLoop(d, '继续未完成部分', { ...opts, resumeState: error.partial.resumeState, caller: scripted([[call('applyPush', { path: 'labels', value: { name: 'missing' } }), bad, finish]]) });
    assert(r.finished); assert.equal(d.name, '已经改好的名称'); assert.equal(d.labels[0].text, '目标值'); assert.equal(r.sideEffects.length, 1); assert.equal(store.size, 0); assert(r.toolReceipts.length >= 5);
  });
  await test('recovery rejects another draft and external draft mutation before any model call', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()); let error;
    try { await aa.runAuthoringLoop(d, '失败', { ...opts, caller: () => Promise.reject(Error('controlled')) }); } catch (e) { error = e; }
    assert(error.partial.resumeState); let calls = 0; const resumeOpts = { ...opts, resumeState: error.partial.resumeState, caller: () => { calls++; return reply(finish); } };
    await assert.rejects(Promise.resolve().then(() => aa.runAuthoringLoop(aa.makeDraft(base()), '续', resumeOpts)), e => e.code === 'authoring-resume-mismatch');
    d.name = '外部改过'; await assert.rejects(Promise.resolve().then(() => aa.runAuthoringLoop(d, '续', resumeOpts)), e => e.code === 'authoring-resume-mismatch'); assert.equal(calls, 0);
  });
  await test('recovery preserves pre-failure quality baseline instead of laundering newly introduced defects', async () => {
    const { aa } = fixture(), d = aa.makeDraft({ factions: [{ name: 'F' }], characters: [] }); let n = 0, error;
    try { await aa.runAuthoringLoop(d, '新增人物', { ...opts, blockingChecks: [], caller: () => ++n === 1 ? reply(call('applyPush', { path: 'characters', value: { name: '坏引用', faction: 'missing' } })) : Promise.reject(Error('controlled')) }); } catch (e) { error = e; }
    assert(error.partial.resumeState);
    const r = await aa.runAuthoringLoop(d, '继续', { ...opts, blockingChecks: [], resumeState: error.partial.resumeState, caller: () => reply(finish) });
    assert.equal(r.finished, false); assert(r.transcript.some(t => t.result.errorCode === 'quality-gate-worse'));
  });
  await test('orchestration stops at the first incomplete subtask rather than finishing later steps', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()); let later = 0;
    const r = await aa.runOrchestrated(d, '逐步修改', { ...opts, subMaxIterations: 4, caller: (conversation, tools) => {
      if (tools.some(t => t.name === 'proposePlan')) return reply(call('proposePlan', { steps: ['第一步', '第二步'] }));
      if (conversation[0].text.includes('【子任务 2/')) { later++; return reply(finish); }
      return conversation.some(m => m.role === 'tool') ? reply(finish) : reply(bad);
    } });
    assert.equal(later, 0); assert.equal(r.finished, false); assert.notEqual(r.stopReason, 'finish'); assert(r.resumeState);
  });
  await test('missing critic reports cannot be advertised as both critics finding no problems', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base());
    const r = await aa.runWithCritics(d, '复核', { ...opts, maxNoToolNudges: 0, caller: (_c, tools) => tools.some(t => t.name === 'submitReview') ? reply() : reply(finish) });
    assert.equal(r.finished, false); assert.notEqual(r.stopReason, 'finish'); assert(!/均未发现/.test(r.summary)); assert(r.resumeState);
  });
  await test('normal editing still finishes with a detached source and valid actual value', async () => {
    const { aa } = fixture(), original = base(), d = aa.makeDraft(original), r = await aa.runAuthoringLoop(d, '改名', { ...opts, caller: scripted([[call('applyEdit', { path: 'name', value: '新名' })], [finish]]) });
    assert(r.finished); assert.equal(d.name, '新名'); assert.equal(original.name, '原剧本'); assert(r.finalValidation);
  });
  await test('existing structural failure still blocks normal finish', async () => {
    const { aa } = fixture(), d = aa.makeDraft({ factions: [{ name: 'F' }], characters: [{ name: '坏引用', faction: 'missing' }] });
    const r = await aa.runAuthoringLoop(d, '核对', { ...opts, caller: () => reply(finish) }); assert.equal(r.finished, false); assert.equal(r.stopReason, 'finishBlocked');
  });
  await test('ignored setter is a failed readback, not a verified successful no-op', async () => {
    const { aa } = fixture(), d = { labels: [] }; Object.defineProperty(d, 'name', { enumerable: true, configurable: true, get: () => '原', set() {} });
    const r = await aa.runAuthoringLoop(d, '改名', { ...opts, caller: scripted([[call('applyEdit', { path: 'name', value: '不应假成功' })], [finish]]) });
    assert.equal(r.finished, false); assert.equal(r.toolReceipts[0].ok, false); assert.equal(r.toolReceipts[0].verified, false); assert.equal(r.transcript[0].result.errorCode, 'write-readback-mismatch');
  });
  await test('resume handle is single-use and serialized copies cannot authorize execution', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()); let error;
    try { await aa.runAuthoringLoop(d, '失败', { ...opts, caller: () => Promise.reject(Error('controlled')) }); } catch (e) { error = e; }
    assert(error.partial.resumeState); const state = error.partial.resumeState;
    await assert.rejects(Promise.resolve().then(() => aa.runAuthoringLoop(d, '续', { ...opts, resumeState: JSON.parse(JSON.stringify(state)), caller: () => reply(finish) })), e => e.code === 'authoring-resume-mismatch');
    await assert.rejects(Promise.resolve().then(() => aa.runAuthoringLoop(d, '改为只读', { ...opts, planOnly: true, resumeState: state, caller: () => reply(finish) })), e => e.code === 'authoring-resume-mode-mismatch');
    assert(aa.canResume(state, d), 'rejected mode switch does not consume the valid recovery');
    assert((await aa.runAuthoringLoop(d, '续', { ...opts, resumeState: state, caller: () => reply(finish) })).finished);
    await assert.rejects(Promise.resolve().then(() => aa.runAuthoringLoop(d, '再放一次', { ...opts, resumeState: state, caller: () => reply(finish) })), e => e.code === 'authoring-resume-mismatch');
  });
  await test('orchestration resumes only the failed subtask and keeps earlier append exactly once', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()); let phase = 'fail', plans = 0, firstCalls = 0, error;
    const caller = (conversation, tools) => {
      if (tools.some(t => t.name === 'proposePlan')) { plans++; return reply(call('proposePlan', { steps: ['添加条目', '补充内容'] })); }
      if (conversation[0].text.includes('【子任务 1/')) { firstCalls++; return conversation.some(m => m.role === 'tool') ? reply(finish) : reply(call('applyPush', { path: 'labels', value: { name: 'once' } })); }
      if (phase === 'fail') return conversation.some(m => m.role === 'tool') ? Promise.reject(Error('subtask failed')) : reply(call('applyEdit', { path: 'labels.once.text', value: '半成品' }));
      return reply(call('applyEdit', { path: 'labels.once.text', value: '完整' }), finish);
    };
    try { await aa.runOrchestrated(d, '两步执行', { ...opts, caller }); } catch (e) { error = e; }
    assert(error.partial.resumeState); assert.equal(d.labels.length, 1); const before = firstCalls; phase = 'resume';
    const r = await aa.runOrchestrated(d, '继续，补成完整内容', { ...opts, caller, resumeState: error.partial.resumeState });
    assert(r.finished); assert.equal(plans, 1); assert.equal(firstCalls, before); assert.equal(d.labels.length, 1); assert.equal(d.labels[0].text, '完整');
  });
  await test('critics resume only failed reviewer; author and completed review are not replayed', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()); let broken = true, author = 0, history = 0, balance = 0, error;
    const caller = (conversation, tools, context) => {
      if (tools.some(t => t.name === 'submitReview')) {
        if (context.system.includes('【史官】')) { history++; return reply(call('submitReview', { findings: [], summary: '已核对' })); }
        balance++; return broken ? Promise.reject(Error('balance failed')) : reply(call('submitReview', { findings: [], summary: '已核对' }));
      }
      author++; return conversation.some(m => m.role === 'tool') ? reply(finish) : reply(call('applyPush', { path: 'labels', value: { name: 'once' } }));
    };
    try { await aa.runWithCritics(d, '会审', { ...opts, caller }); } catch (e) { error = e; }
    assert(error.partial.resumeState); const authorBefore = author, historyBefore = history; broken = false;
    const r = await aa.runWithCritics(d, '继续会审', { ...opts, caller, resumeState: error.partial.resumeState });
    assert(r.finished); assert.equal(author, authorBefore); assert.equal(history, historyBefore); assert.equal(balance, 2); assert.equal(d.labels.length, 1);
  });
  await test('one failed reviewer does not return until its live sibling settles', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()); let release, entered, settled = false;
    const ready = new Promise(r => { entered = r; });
    const promise = aa.runWithCritics(d, '会审', { ...opts, caller: (_c, tools, context) => {
      if (!tools.some(t => t.name === 'submitReview')) return reply(finish);
      if (context.system.includes('【史官】')) { entered(); return new Promise(r => { release = () => r({ toolCalls: [call('submitReview', { findings: [] })] }); }); }
      return Promise.reject(Error('peer failed'));
    } }).then(() => { settled = true; }, e => { settled = true; return e; });
    await ready; try { await new Promise(r => setTimeout(r, 20)); assert.equal(settled, false); } finally { release(); }
    const error = await promise; assert(error.partial.resumeState);
  });
  await test('memory-only result is staged work, not unchanged or already persisted', async () => {
    const { aa, store } = fixture(), d = aa.makeDraft(base());
    const r = await aa.runAuthoringLoop(d, '只记住偏好', { ...opts, caller: scripted([[call('saveMemory', { name: 'only-memory', description: '隔离偏好', body: 'synthetic' }), finish]]) });
    assert(r.finished); assert(r.completion, 'explicit staged-work contract exists'); assert.equal(r.completion.status, 'completed'); assert.equal(r.completion.changedWrites, 0); assert.equal(r.completion.stagedEffects, 1); assert.equal(store.size, 0); assert.deepEqual(JSON.parse(JSON.stringify(d)), base());
  });
  await test('a withdrawn partial finish cannot label a later completed response as partial', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base()); let n = 0;
    const r = await aa.runAuthoringLoop(d, '先停止', { ...opts, caller: () => ++n === 1 ? reply(call('finish', { status: 'partial', summary: '暂时暂停' })) : reply(finish),
      onStep: s => { if (n === 1 && s.name === 'finish') aa.steer('经核对不需要修改，完成核对即可'); } });
    assert.equal(n, 2); assert(r.finished); assert.equal(r.stopReason, 'finish'); assert(r.completion, 'explicit completion contract exists'); assert.equal(r.completion.status, 'unchanged');
  });
  await test('stopped multi-call response retains paired tool messages for actual provider recovery', async () => {
    const { aa } = fixture(), d = aa.makeDraft(base());
    const r = await aa.runAuthoringLoop(d, '先暂停', { ...opts, caller: () => reply(call('finish', { status: 'partial', summary: '等待确认' }), call('applyPush', { path: 'labels', value: { name: 'must-not-run' } })) });
    assert.equal(d.labels.length, 0); assert(r.resumeState, 'the next call must be an actual continuation');
    const next = await aa.runAuthoringLoop(d, '继续', { ...opts, resumeState: r.resumeState, caller: conversation => {
      for (let i = 0; i < conversation.length; i++) if (conversation[i].role === 'assistant' && conversation[i].toolCalls.length) {
        assert.deepEqual(conversation[i].toolCalls.map(c => c.id), conversation[i + 1].toolResults.map(c => c.id));
      }
      return reply(finish);
    } });
    assert(next.finished); assert(next.resumed); assert.equal(d.labels.length, 0);
  });
  console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0, sourceRef: ref || 'worktree' })); process.exitCode = fail ? 1 : 0;
})();

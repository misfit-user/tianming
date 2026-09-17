#!/usr/bin/env node
'use strict';
// Actual provider and loop; isolated HTTP fixtures only. Same tests run against --source-ref.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.resolve(__dirname, '../..'), ai = process.argv.indexOf('--source-ref'), ref = ai < 0 ? null : process.argv[ai + 1];
const files = ['tm-agent-kernel.js', 'editor-authoring-agent-provider.js', 'editor-authoring-agent.js'];
const sources = files.map(f => [f, ref ? cp.execFileSync('git', ['show', ref + ':web/' + f], { cwd: root, encoding: 'utf8', maxBuffer: 8e6 }) : fs.readFileSync(path.join(root, 'web', f), 'utf8')]);
const cfg = { url: 'https://response.invalid/v1', key: 'synthetic-only', model: 'controlled-thinking', temp: .2 };
const opts = { cfg, noMemoryRecall: true, conventions: '', maxIterations: 18, maxTokens: 1000000 };
const call = (name, input, id = name) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(input) } });
const done = call('finish', { summary: '核验完成' });
const thought = 'PRIVATE_SYNTHETIC_THOUGHT';
const reply = (calls = [], reason = 'tool_calls', content = '', reasoning) => new Response(JSON.stringify({ choices: [{ message: { content, tool_calls: calls, ...(reasoning === undefined ? {} : { reasoning_content: reasoning }) }, finish_reason: reason }] }));
function fixture(fetcher) {
  const logs = [], c = { console: { log: (...a) => logs.push(a), warn: (...a) => logs.push(a), error: (...a) => logs.push(a) }, Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, TextDecoder, TextEncoder, Uint8Array, Response, ReadableStream, Headers,
    setTimeout: (fn, ms) => setTimeout(fn, ms <= 30000 ? 0 : ms), clearTimeout, fetch: fetcher };
  c.window = c; vm.createContext(c); for (const [f, s] of sources) vm.runInContext(s, c, { filename: f });
  return { aa: c.TM.AuthoringAgent, logs };
}
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
(async () => {
  await test('empty response after a real write retries native without an empty assistant or duplicate append', async () => {
    let n = 0; const packets = [], f = fixture(async (_, init) => {
      const b = JSON.parse(init.body); packets.push(b); n++;
      if (n === 1) return reply([call('applyPush', { path: 'labels', value: { name: 'once' } })], 'tool_calls', '', thought);
      if (n === 2 || !b.tools || b.messages.some(m => m.role === 'assistant' && !m.content && !m.reasoning_content && !m.tool_calls)) return reply([], null);
      return reply([done]);
    });
    const live = { name: '隔离案卷', labels: [] }, draft = f.aa.makeDraft(live);
    const r = await f.aa.runAuthoringLoop(draft, '添加并检查', opts);
    assert(r.finished); assert.equal(n, 3); assert(packets.every(b => b.tools)); assert.equal(draft.labels.length, 1); assert.equal(live.labels.length, 0);
    assert.equal(packets[2].messages.find(m => m.tool_calls).reasoning_content, thought);
  });
  await test('failed JSON trial returns to last proven native mode; manual continuation retains the draft', async () => {
    let phase = 0, n = 0; const packets = [], f = fixture(async (_, init) => {
      const b = JSON.parse(init.body); packets.push(b); n++;
      if (!phase && n === 1) return reply([call('applyPush', { path: 'labels', value: { name: 'once' } })]);
      if (!phase && n === 2) return reply([], 'stop', '继续核对');
      if (!phase || !b.tools) return reply([], null);
      return reply([done]);
    });
    const d = f.aa.makeDraft({ name: '隔离', labels: [] });
    const first = await f.aa.runAuthoringLoop(d, '添加后核对', opts);
    assert(!first.finished); assert.equal(n, 4); assert.equal(d.labels.length, 1); assert(packets[2].tools === undefined); assert(packets[3].tools);
    phase = 1; const r = await f.aa.runAuthoringLoop(d, '只继续未完成的检查', { ...opts, resumeState: first.resumeState });
    assert(r.finished); assert.equal(n, 5); assert.equal(d.labels.length, 1);
  });
  await test('proven JSON-only endpoint remains compatible on continuation', async () => {
    let phase = 0, n = 0; const f = fixture(async (_, init) => {
      const b = JSON.parse(init.body); n++;
      if (b.tools) return new Response('tools unsupported', { status: 400 });
      if (phase) return reply([], 'stop', JSON.stringify({ tool_calls: [{ name: 'finish', input: { summary: '完成' } }] }));
      if (n === 2) return reply([], 'stop', JSON.stringify({ tool_calls: [{ name: 'applyPush', input: { path: 'labels', value: { name: 'once' } } }] }));
      return reply([], 'stop');
    });
    const d = f.aa.makeDraft({ name: '隔离', labels: [] }), first = await f.aa.runAuthoringLoop(d, '添加并核验', opts);
    assert(!first.finished); const before = n; phase = 1;
    const r = await f.aa.runAuthoringLoop(d, '继续', { ...opts, resumeState: first.resumeState });
    assert(r.finished); assert.equal(n, before + 1); assert.equal(d.labels.length, 1);
  });
  await test('truncation has exactly two bounded budget repairs, never switches protocol or executes a prefix', async () => {
    const budgets = [], packets = [], texts = []; const f = fixture(async (_, init) => {
      const b = JSON.parse(init.body); packets.push(b); budgets.push(b.max_tokens);
      return reply([call('applyEdit', { path: 'name', value: '不应执行' })], 'length', '', thought);
    });
    const d = f.aa.makeDraft({ name: '原' }), r = await f.aa.runAuthoringLoop(d, '完整制作，不削减内容', { ...opts, onText: t => texts.push(t) });
    assert(!r.finished); assert.equal(d.name, '原'); assert.equal(budgets.length, 3); assert.equal(budgets[0], 3000); assert.equal(budgets.at(-1), 16000);
    assert(packets.every(b => b.tools)); assert(packets.slice(1).every(b => JSON.stringify(b.messages).includes('下一步')));
    assert.equal(r.stopReason, 'outputLimit'); assert(!JSON.stringify([r.transcript, texts, r.apiDiagnostics]).includes(thought));
    assert(!r.conversation.some(m => m.reasoningContent === thought));
  });
  await test('resuming keeps the last output budget; an explicit larger starting budget is never reduced', async () => {
    for (const start of [3000, 24000]) {
      let phase = 0; const budgets = [], f = fixture(async (_, init) => {
        const b = JSON.parse(init.body); budgets.push(b.max_tokens);
        return phase ? reply([done]) : reply([], 'length', '', thought);
      });
      const d = f.aa.makeDraft({ name: '隔离' }), first = await f.aa.runAuthoringLoop(d, '核验', { ...opts, maxTok: start });
      assert(!first.finished); assert(budgets.every(x => x >= start)); const last = budgets.at(-1); phase = 1;
      const r = await f.aa.runAuthoringLoop(d, '继续', { ...opts, maxTok: start, resumeState: first.resumeState });
      assert(r.finished); assert.equal(budgets.at(-1), last);
    }
  });
  for (const reason of ['insufficient_system_resource', 'aborted']) await test(reason + ' is not unknown/empty and partial tools cannot execute', async () => {
    const packets = [], f = fixture(async (_, init) => {
      packets.push(JSON.parse(init.body)); return reply([call('applyEdit', { path: 'name', value: '不应执行' })], reason);
    });
    const d = f.aa.makeDraft({ name: '原' }), r = await f.aa.runAuthoringLoop(d, '修改', opts);
    assert.equal(d.name, '原'); assert(!r.finished); assert.equal(r.apiDiagnostics.at(-1).finishReason, reason);
    assert.equal(r.apiDiagnostics.at(-1).kind, 'interrupted'); assert(packets.every(b => b.tools)); assert.equal(packets.length, 3);
  });
  await test('reasoning-only replies retry the original mode, never execute or log thought-shaped commands', async () => {
    const packets = [], texts = [], f = fixture(async (_, init) => { packets.push(JSON.parse(init.body)); return reply([], 'stop', '', thought + '{"tool_calls":[{"name":"finish","input":{}}]}'); });
    const r = await f.aa.runAuthoringLoop(f.aa.makeDraft({ name: '原' }), '核验', { ...opts, onText: t => texts.push(t) });
    assert(!r.finished); assert.equal(packets.length, 3); assert(packets.every(b => b.tools)); assert(!JSON.stringify([r.transcript, texts, r.apiDiagnostics, f.logs]).includes(thought));
  });
  await test('unsupported tool_choice repairs only that option and preserves native tools and reasoning', async () => {
    const packets = [], f = fixture(async (_, init) => {
      const b = JSON.parse(init.body); packets.push(b);
      if (b.tool_choice !== undefined) return new Response('{"error":{"message":"Thinking mode does not support this tool_choice"}}', { status: 400 });
      if (!b.tools) return reply([], 'stop');
      return reply([done]);
    });
    const conv = [{ role: 'assistant', text: '', reasoningContent: thought, toolCalls: [{ id: 'read', name: 'getField', input: { path: 'name' } }] }, { role: 'tool', toolResults: [{ id: 'read', name: 'getField', content: '原' }] }];
    const r = await f.aa.callWithTools(conv, [{ name: 'finish' }], { cfg, maxRetries: 0 });
    assert.equal(r.toolCalls.length, 1); assert.equal(packets.length, 2); assert(packets[1].tools); assert.equal(packets[1].messages[0].reasoning_content, thought);
    assert.equal(packets[1].tool_choice, undefined); assert(!packets[1].thinking); assert(!packets[1].reasoning_effort);
  });
  await test('resuming an older checkpoint does not resend empty assistant placeholders', async () => {
    let n = 0; const f = fixture(async (_, init) => {
      const b = JSON.parse(init.body); n++;
      assert(!b.messages.some(m => m.role === 'assistant' && !m.content && !m.tool_calls && !m.reasoning_content));
      return reply([done]);
    });
    const r = await f.aa.runAuthoringLoop(f.aa.makeDraft({ name: '原' }), '只继续校验', { ...opts, priorConversation: [{ role: 'user', text: '原需求' }, { role: 'assistant', text: '', toolCalls: [] }, { role: 'user', text: '继续' }] });
    assert(r.finished); assert.equal(n, 1);
  });
  await test('cancelled response cannot spend another retry or apply a late result', async () => {
    let n = 0, aa; const f = fixture(async () => { n++; aa.abort(); return reply([], null); }); aa = f.aa;
    const d = aa.makeDraft({ name: '原' }), r = await aa.runAuthoringLoop(d, '核验', opts);
    assert.equal(r.stopReason, 'aborted'); assert.equal(n, 1); assert.equal(d.name, '原');
  });
  for (const reason of ['insufficient_system_resource', 'aborted']) await test('SSE ' + reason + ' discards even a malformed tool prefix and permits bounded native recovery', async () => {
    let n = 0; const f = fixture(async (_, init) => {
      assert(JSON.parse(init.body).tools); n++;
      if (n > 1) return reply([done]);
      const frame = { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'partial', function: { name: 'applyEdit', arguments: '{"path":' } }] }, finish_reason: reason }] };
      return new Response('data: ' + JSON.stringify(frame) + '\n\ndata: [DONE]\n\n');
    });
    const d = f.aa.makeDraft({ name: '原' }), r = await f.aa.runAuthoringLoop(d, '核验', opts);
    assert(r.finished); assert.equal(n, 2); assert.equal(d.name, '原'); assert.equal(r.apiDiagnostics[0].kind, 'interrupted');
  });
  await test('cancelling during response backoff stops before another HTTP request', async () => {
    let n = 0, aa; const f = fixture(async () => { n++; return reply([], null); }); aa = f.aa;
    const r = await aa.runAuthoringLoop(aa.makeDraft({ name: '原' }), '核验', { ...opts, onText: () => aa.abort() });
    assert.equal(n, 1); assert.equal(r.stopReason, 'aborted'); assert.equal(r.completion.status, 'cancelled');
  });
  await test('default edit exposes every registered tool up front and listGaps does not need requestTools', async () => {
    let packet;const f=fixture(async(_,init)=>{packet=JSON.parse(init.body);return reply([call('listGaps',{}),done]);});
    const d=f.aa.makeDraft({name:'原'}),r=await f.aa.runAuthoringLoop(d,'核验现状',opts);
    assert.deepEqual(packet.tools.map(t=>t.function.name).sort(),Array.from(f.aa.AGENT_TOOLS,t=>t.name).sort());
    assert(r.finished);assert.equal(r.transcript[0].name,'listGaps');assert.notEqual(r.transcript[0].result.errorCode,'tool-not-authorized');assert(!r.transcript.some(t=>t.name==='requestTools'));
  });
  await test('run estimate includes the same full catalog and an explicit editing subset remains enforced', async () => {
    const f=fixture(async()=>reply([done])),d=f.aa.makeDraft({name:'原'});
    const full=f.aa.estimateRun(d,'核验现状',{conventions:''}),explicit=f.aa.estimateRun(d,'核验现状',{conventions:'',toolPacks:false});assert.equal(full.perCallInput,explicit.perCallInput);
    const subset=f.aa.AGENT_TOOLS.filter(t=>['getField','finish'].includes(t.name));
    const g=fixture(async()=>reply([call('applyEdit',{path:'name',value:'不允许'}),done]));
    const guarded=await g.aa.runAuthoringLoop(d,'修改',{...opts,tools:subset});assert.equal(d.name,'原');assert.equal(guarded.transcript[0].result.errorCode,'tool-not-authorized');
  });
  await test('stopping after an executed tool prevents remaining calls; resume keeps real HTTP history paired', async () => {
    let n=0,aa;const packets=[],f=fixture(async(_,init)=>{packets.push(JSON.parse(init.body));return ++n===1?reply([call('applyPush',{path:'labels',value:{name:'once'}},'first'),call('applyPush',{path:'labels',value:{name:'late'}},'late')],'tool_calls','',thought):reply([done]);});aa=f.aa;
    const live={name:'原',labels:[]},d=aa.makeDraft(live),first=await aa.runAuthoringLoop(d,'先添加再检查',{...opts,onStep:s=>{if(s.name==='applyPush')aa.abort();}});
    assert.equal(first.completion.status,'cancelled');assert.equal(d.labels.length,1,'remaining call must not execute after Stop');assert.equal(d.labels[0].name,'once');assert.equal(live.labels.length,0);assert(first.resumeState);
    const next=await aa.runAuthoringLoop(d,'只继续检查',{...opts,resumeState:first.resumeState});assert(next.finished);assert.equal(n,2);assert.equal(d.labels.length,1);
    for(let i=0;i<packets[1].messages.length;i++){const m=packets[1].messages[i];if(!m.tool_calls)continue;assert.equal(m.reasoning_content,thought);assert.deepEqual(m.tool_calls.map(c=>c.id),packets[1].messages.slice(i+1,i+1+m.tool_calls.length).map(m=>m.tool_call_id));}
  });
  await test('Stop cancels an in-flight native continuation; a fresh signal resumes without empty history or replay', async () => {
    let n=0,ready,abortObserved=false;const waiting=new Promise(r=>{ready=r;}),packets=[];
    const f=fixture(async(_,init)=>{const b=JSON.parse(init.body);packets.push(b);n++;if(n===1)return reply([call('applyPush',{path:'labels',value:{name:'once'}})],'tool_calls','',thought);if(n===2){ready();return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{abortObserved=true;const e=Error('player-stop');e.name='AbortError';reject(e);},{once:true}));}assert(!init.signal.aborted);assert(!b.messages.some(m=>m.role==='assistant'&&!m.content&&!m.reasoning_content&&!m.tool_calls));return reply([done]);});
    const live={name:'原',labels:[]},d=f.aa.makeDraft(live),pending=f.aa.runAuthoringLoop(d,'添加后核对',opts);await waiting;f.aa.abort();const stopped=await pending;
    assert(abortObserved);assert.equal(stopped.completion.status,'cancelled');assert(stopped.resumeState);assert.equal(n,2);assert.equal(d.labels.length,1);assert.equal(live.labels.length,0);
    const resumed=await f.aa.runAuthoringLoop(d,'继续核验',{...opts,resumeState:stopped.resumeState});assert(resumed.finished);assert.equal(n,3);assert.equal(d.labels.length,1);assert.equal(packets[2].messages.find(m=>m.tool_calls).reasoning_content,thought);
  });
  console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0, sourceRef: ref || 'worktree' })); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });

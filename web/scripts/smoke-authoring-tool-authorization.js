#!/usr/bin/env node
'use strict';
// Actual core/registry and staged side effects; only provider replies are controlled.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.resolve(__dirname, '../..'), at = process.argv.indexOf('--source-ref'), ref = at < 0 ? null : process.argv[at + 1];
const source = f => ref ? cp.execFileSync('git', ['show', ref + ':web/' + f], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'web', f), 'utf8');
function fixture(kernel = true) {
  let writes = 0, network = 0; const store = new Map();
  const c = { console, Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => { writes++; store.set(k, v); }, removeItem: k => { writes++; store.delete(k); } },
    fetch: () => { network++; throw Error('unexpected-external-call'); } };
  c.window = c; vm.createContext(c);
  for (const f of [...(kernel ? ['tm-agent-kernel.js'] : []), 'editor-authoring-agent-provider.js', 'editor-authoring-agent.js']) vm.runInContext(source(f), c, { filename: f });
  return { c, aa: c.TM.AuthoringAgent, counts: () => ({ writes, network }) };
}
const call = (name, input) => ({ id: name, name, input });
const modes = { planOnly: call('proposePlan', { steps: ['先核对再请玩家批准'], summary: '计划' }), reviewOnly: call('submitReview', { findings: [], summary: '审阅' }), qaOnly: call('submitAnswer', { answer: '原值为100' }), explainOnly: call('submitExplanation', { points: [{ topic: '财政', detail: '原值为100' }], summary: '讲解' }) };
const opts = { noMemoryRecall: true, conventions: '', maxIterations: 3, maxTokens: 1000000, toolPacks: false };
const attacks = [call('applyEdit', { path: 'name', value: '越权' }), call('multiEdit', { edits: [{ path: 'fiscalConfig.treasury', value: 450 }] }), call('saveMemory', { name: '越权', description: '只读不得保存', body: '不应落盘' }), call('saveSkill', { name: '越权', body: '不应落盘' }), call('generateImage', { path: 'cover', prompt: '不应联网' })];
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
(async () => {
  for (const [mode, terminal] of Object.entries(modes)) await test(mode + ' rejects unoffered writes and still completes legitimate read/report', async () => {
    const f = fixture(), original = { name: '原剧本', fiscalConfig: { treasury: 100 }, factions: [], characters: [] }, d = f.aa.makeDraft(original); let n = 0;
    const r = await f.aa.runAuthoringLoop(d, '只查看，不修改', { ...opts, [mode]: true, caller: async (_c, tools) => {
      assert(!tools.some(t => attacks.some(a => a.name === t.name)));
      return { toolCalls: ++n === 1 ? attacks : [call('getField', { path: 'fiscalConfig.treasury' }), terminal] };
    } });
    assert.equal(JSON.stringify(d), JSON.stringify(original)); assert.equal(r.finished, true); assert.equal(r.sideEffects.length, 0);
    assert.equal(r.transcript.filter(t => t.result.errorCode === 'tool-not-authorized').length, attacks.length);
    assert(r.transcript.find(t => t.name === 'getField').result.ok); assert.deepEqual(f.counts(), { writes: 0, network: 0 });
    assert(r.toolReceipts.filter(t => attacks.some(a => a.name === t.tool)).every(t => !t.ok && !t.changed && !t.verified));
  });
  await test('authorization also works without optional kernel', async () => {
    const f = fixture(false), d = f.aa.makeDraft({ name: '原' }); let n = 0;
    const r = await f.aa.runAuthoringLoop(d, '只规划', { ...opts, planOnly: true, caller: async () => ({ toolCalls: ++n === 1 ? [attacks[0]] : [modes.planOnly] }) });
    assert.equal(d.name, '原'); assert.equal(r.transcript[0].result.errorCode, 'tool-not-authorized'); assert(r.finished);
  });
  await test('explicit editing subset rejects a known but unoffered write', async () => {
    const f = fixture(), d = f.aa.makeDraft({ name: '原' }); let n = 0;
    const r = await f.aa.runAuthoringLoop(d, '核对', { ...opts, tools: f.aa.AGENT_TOOLS.filter(t => ['getField', 'finish'].includes(t.name)), caller: async () => ({ toolCalls: ++n === 1 ? [attacks[0]] : [call('finish', { summary: '未修改' })] }) });
    assert.equal(d.name, '原'); assert.equal(r.transcript[0].result.errorCode, 'tool-not-authorized'); assert.equal(r.finished, false); assert.equal(r.completion.status, 'blocked');
  });
  await test('approved editing still changes detached draft and stages memory for explicit commit', async () => {
    const f = fixture(), original = { name: '原' }, d = f.aa.makeDraft(original); let n = 0;
    const r = await f.aa.runAuthoringLoop(d, '改名并记住', { ...opts, caller: async () => ({ toolCalls: ++n === 1 ? [attacks[0], call('saveMemory', { name: '编辑习惯', description: '检查习惯', body: '先检查字段' })] : [call('finish', { summary: '已改草稿' })] }) });
    assert.equal(d.name, '越权'); assert.equal(original.name, '原'); assert(r.finished); assert.equal(r.sideEffects.length, 1); assert.equal(f.counts().writes, 0);
  });
  await test('allowed collection and destructive guards remain enforced', async () => {
    const f = fixture(), d = f.aa.makeDraft({ name: '原', characters: [{ name: '甲' }] }); let n = 0;
    const r = await f.aa.runAuthoringLoop(d, '改名', { ...opts, allowedCollections: ['characters'], allowDestructive: false,
      caller: async () => ({ toolCalls: ++n === 1 ? [attacks[0], call('removeEntity', { path: 'characters.0' })] : [call('finish', { summary: '被保护' })] }) });
    assert.equal(d.name, '原'); assert.equal(d.characters.length, 1); assert(r.transcript.slice(0, 2).every(t => t.result.ok === false));
  });
  await test('parallel critics cannot mutate the author draft they are reviewing', async () => {
    const f = fixture(), d = f.aa.makeDraft({ name: '原' });
    const r = await f.aa.runWithCritics(d, '请修改名称', { ...opts, caller: async (conversation, tools) => {
      const review = tools.some(t => t.name === 'submitReview');
      const hasCall = conversation.some(m => (m.toolCalls || []).some(c => c.name === 'applyEdit'));
      return { toolCalls: !hasCall ? [call('applyEdit', { path: 'name', value: review ? '评审越权' : '作者修改' })] : [review ? modes.reviewOnly : call('finish', { summary: '作者完成' })] };
    } });
    assert.equal(d.name, '作者修改'); assert.equal(r.revised, false);
    assert(r.critiques.history && r.critiques.balance);
  });
  await test('legacy actual in-place importer changes ownership even with identical name and id', () => {
    const f = fixture(), src = source('editor-fullgen.js'), nodes = require('acorn').parse(src, { ecmaVersion: 'latest' }).body;
    f.c.scriptData = { id: 'same', name: 'same', fiscalConfig: { treasury: 100 } }; f.c.document = { getElementById: () => null };
    for (const name of ['_ensureScriptDataDefaults', 'renderGameSettings', 'renderAll', 'saveScript']) f.c[name] = () => {};
    const selected = nodes.filter(n => n.type === 'FunctionDeclaration' && ['_beginLegacyEditorDocument', '_mergeAndRenderScriptData'].includes(n.id.name) || n.type === 'VariableDeclaration' && n.declarations.some(d => d.id.name === '_legacyDocumentPrefix'));
    vm.runInContext(selected.map(n => src.slice(n.start, n.end)).join('\n'), f.c);
    assert.equal(typeof f.c._beginLegacyEditorDocument, 'function', 'legacy host owns a real load identity'); f.c._beginLegacyEditorDocument();
    const adapter = f.aa.makeOldEditorAdapter(f.c), lease = adapter.captureLease(), reference = f.c.scriptData, key = adapter.getFileKey();
    f.c._mergeAndRenderScriptData({ id: 'same', name: 'same', fiscalConfig: { treasury: 777 } });
    assert.equal(f.c.scriptData, reference); assert.notEqual(adapter.getFileKey(), key); assert.equal(adapter.isLeaseCurrent(lease), false);
    assert.throws(() => adapter.commit({ name: 'stale' }, lease), e => e.code === 'editor-document-changed'); assert.equal(f.c.scriptData.fiscalConfig.treasury, 777);
    const current = adapter.captureLease(); adapter.commit({ name: 'current', fiscalConfig: { treasury: 888 } }, current); assert.equal(f.c.scriptData.fiscalConfig.treasury, 888); assert(adapter.isLeaseCurrent(current));
  });
  await test('legacy host without load identity refuses unsafe commit', () => {
    const f = fixture(), g = { scriptData: { name: 'old' }, saveScript: () => {} }, adapter = f.aa.makeOldEditorAdapter(g);
    assert.throws(() => adapter.commit({ name: 'unsafe' }), /安全加载身份/); assert.equal(g.scriptData.name, 'old');
  });
  console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0, sourceRef: ref || 'worktree' })); process.exitCode = fail ? 1 : 0;
})();

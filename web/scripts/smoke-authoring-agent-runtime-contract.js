'use strict';
// 剧本工坊运行契约：手动自动选模、懒加载工具包、原子批写、暂存副作用、真取消。
const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');
const passed = { value: 0 };
const assert = makeAssert(passed);

const store = Object.create(null);
globalThis.localStorage = {
  getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function(k, v) { store[k] = String(v); },
  removeItem: function(k) { delete store[k]; }
};
require(path.join(ROOT, 'tm-agent-kernel.js'));
const AA = require(path.join(ROOT, 'editor-authoring-agent.js'));

assert(AA.toolRegistry && AA.toolRegistry.get('applyEdit').effect === 'draft-write', '工坊工具注册到共享 ToolSpec registry');
assert(AA.toolRegistry.get('saveMemory').effect === 'memory-write', '记忆工具声明外部副作用');
assert(AA.toolRegistry.get('generateImage').effect === 'external', '生图工具声明外部调用');

let packs = AA.selectToolPacks('给人物补一段小传', { worldKind: 'historical' });
assert(packs.indexOf('core') >= 0 && packs.indexOf('history') >= 0 && packs.indexOf('media') < 0, '工具包按需求加载·史实任务不带生图包');
packs = AA.selectToolPacks('批量给所有人物生成头像并统计', { worldKind: 'fictional' });
assert(packs.indexOf('bulk') >= 0 && packs.indexOf('media') >= 0, '批量生图请求加载 bulk+media');

assert(AA.selectWorkMode('优化一下', {}, { permissionMode: 'review' }).mode === 'plan', '含混请求在手动自动选模中先计划');
assert(AA.selectWorkMode('全面重做人物、势力、地图，然后统一关系网', {}, { permissionMode: 'review' }).mode === 'orchestrate', '跨域多步骤请求选分解编排');
assert(AA.selectWorkMode('严格复核并删除不合史实的官制', {}, { permissionMode: 'review' }).mode === 'critics', '高风险史实改动选三堂会审');
assert(AA.selectWorkMode('改剧本名为绍宋', {}, { permissionMode: 'plan' }).mode === 'plan', '权限问策优先于自动选模');

const atomicDraft = { id: 'fixed', name: '旧名', events: [] };
const atomicFail = AA.dispatchTool(atomicDraft, 'multiEdit', { edits: [
  { path: 'name', value: '新名' },
  { path: 'id', value: 'bad' }
] });
assert(!atomicFail.ok && atomicFail.atomic && atomicDraft.name === '旧名' && atomicDraft.id === 'fixed', 'multiEdit 任一失败则整批不落地');
const atomicOk = AA.dispatchTool(atomicDraft, 'multiEdit', { edits: [{ path: 'name', value: '新名' }, { path: 'world.note', value: 'x' }] });
assert(atomicOk.ok && atomicOk.atomic && atomicDraft.name === '新名' && atomicDraft.world.note === 'x', 'multiEdit 成功则整批一次提交');

(async function() {
  let round = 0, sawKnowledgeTool = false, sawSignal = false;
  const draft = { name: '旧剧本', characters: [], factions: [] };
  const res = await AA.runAuthoringLoop(draft, '把剧本改名，并记住这个创作偏好', {
    noMemoryRecall: true,
    caller: async function(conv, tools, opts) {
      sawKnowledgeTool = sawKnowledgeTool || tools.some(function(t) { return t.name === 'saveMemory'; });
      sawSignal = sawSignal || !!(opts && opts.signal);
      round++;
      if (round === 1) return { text: '', toolCalls: [
        { id: 'm', name: 'saveMemory', input: { name: '命名偏好', type: 'user', description: '剧本命名', body: '采用四字古典标题' } },
        { id: 'e', name: 'applyEdit', input: { path: 'name', value: '新剧本' } }
      ] };
      return { text: '', toolCalls: [{ id: 'f', name: 'finish', input: { summary: '完成' } }] };
    }
  });
  assert(res.finished && draft.name === '新剧本' && sawSignal, '工坊循环正常编辑且每次 caller 获得 AbortSignal');
  assert(sawKnowledgeTool, '需求命中 knowledge 工具包');
  const editReceipt = (res.toolReceipts || []).find(function(r) { return r.tool === 'applyEdit'; });
  const memoryReceipt = (res.toolReceipts || []).find(function(r) { return r.tool === 'saveMemory'; });
  assert(editReceipt && editReceipt.ok && editReceipt.changed && editReceipt.verified, '草稿工具生成 changed+verified 标准回执');
  assert(memoryReceipt && memoryReceipt.ok && memoryReceipt.changed && memoryReceipt.verified, '暂存记忆也生成可审计回执');
  assert(res.sideEffects.length === 1 && !store.tm_aa_memdir, 'saveMemory 在运行期只暂存·未越过玩家批准');
  const committed = AA.commitSideEffects(res.sideEffects);
  assert(committed.ok && committed.committed === 1 && JSON.parse(store.tm_aa_memdir)[0].name === '命名偏好', '应用阶段才提交暂存记忆');

  const noOpDraft = { characters: [{ name: '甲', loyalty: 50 }] };
  let noOpRound = 0;
  const noOpRun = await AA.runAuthoringLoop(noOpDraft, '保持现值并复查', {
    toolPacks: ['bulk'], // 本用例验证批改回执，明确提供被测工具，不靠模型越过工具清单。
    noMemoryRecall: true,
    caller: async function() {
      noOpRound++;
      if (noOpRound === 1) return { text: '', toolCalls: [{ id: 'r1', name: 'getField', input: { path: 'characters' } }] };
      if (noOpRound === 2) return { text: '', toolCalls: [{ id: 'w1', name: 'bulkUpdate', input: { collection: 'characters', where: { name: '甲' }, field: 'loyalty', op: 'set', value: 50 } }] };
      if (noOpRound === 3) return { text: '', toolCalls: [{ id: 'r2', name: 'getField', input: { path: 'characters' } }] };
      return { text: '', toolCalls: [{ id: 'f2', name: 'finish', input: { summary: '无须改动' } }] };
    }
  });
  const noOpReceipt = noOpRun.toolReceipts.find(function(r) { return r.tool === 'bulkUpdate'; });
  const repeatedRead = noOpRun.transcript.filter(function(t) { return t.name === 'getField'; })[1];
  assert(noOpReceipt && noOpReceipt.ok && !noOpReceipt.changed && repeatedRead && repeatedRead.result.unchanged, '无操作批改不推进写世代·重复读仍命中去重缓存');
  const badOp = AA.dispatchTool(noOpDraft, 'bulkUpdate', { collection: 'characters', where: {}, field: 'loyalty', op: 'divide', value: 2 });
  assert(!badOp.ok && noOpDraft.characters[0].loyalty === 50, 'bulkUpdate 拒绝未知运算符且草稿不变');

  let releaseStart;
  const started = new Promise(function(resolve) { releaseStart = resolve; });
  let abortedSignal = false;
  const cancelRun = AA.runAuthoringLoop({ name: 'x' }, '改名', {
    noMemoryRecall: true,
    caller: function(conv, tools, opts) {
      releaseStart();
      return new Promise(function(resolve, reject) {
        opts.signal.addEventListener('abort', function() {
          abortedSignal = true;
          var e = new Error('cancelled'); e.aborted = true; e.name = 'AbortError'; reject(e);
        }, { once: true });
      });
    }
  });
  await started;
  assert(AA.abort() === true, 'abort 找到并停止活动运行');
  const cancelled = await cancelRun;
  assert(abortedSignal && cancelled.stopReason === 'aborted', '停止会取消在途调用并干净返回 aborted');

  const uiSrc = fs.readFileSync(path.join(ROOT, 'editor-authoring-agent-ui.js'), 'utf8');
  assert(/act: 'auto-select'/.test(uiSrc) && /ui\._autoModeArmed/.test(uiSrc), '自动选择是玩家显式武装的工作模式');
  assert(/data-pm="plan"/.test(uiSrc) && /data-pm="review"/.test(uiSrc) && /data-pm="auto"/.test(uiSrc), '自动选模与问策/共审/放行权限模式彼此独立');

  console.log('[smoke-authoring-agent-runtime-contract] pass assertions=' + passed.value);
})().catch(function(e) { console.error(e); process.exit(1); });

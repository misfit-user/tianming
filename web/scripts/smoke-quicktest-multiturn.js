#!/usr/bin/env node
// scripts/smoke-quicktest-multiturn.js — 快测扩建·playtest 前一键体检（2026-07-16 刀A/B/C）
//
// 锁住 scenario-editor-sandbox-bridge.js 快测运行器的多回合体检契约：
//   刀A 多回合化：默认 3 回合(turns 1-10 可调)·同一局连跑(世界连续·非三局各跑一回合)·
//        单回合抛错记录后不中断后续·超时中止后续(防 _endTurnInternal 异步与下一回合争抢)。
//   刀B 四类体检：死人任职+幽灵键 ← TM.invariants.check()（tm-invariants.js）·
//        账面守恒 ← GM._fiscalValidatorLog（generated/tm-ai-change-applier.bundle.js:_validateFiscalConsistency）·
//        叙事错名 ← GM._personnelValidatorLog（同上:_validatePersonnelConsistency）·
//        全部「调既有校验器取结果」·log 基线 slice 按回合归因·
//        报告 schema:2 向后兼容(旧 bootOk/turnOk/turn/errors 保留)·verdict 总判绿/黄/红+
//        异常清单带回合号与原句/原账摘录·写回 IndexedDB quickTestReport:latest(镜像契约见 C6)。
//   刀C 快档路由+入口：次要 API 配置完整且启用 → 快测全程 P.ai 临时指向 secondary·
//        正常 finish 全路径还原；超时则冻结 GM + 清凭据 + 销毁独立沙盒，绝不向晚到任务暴露主 key·
//        URL 参数 tmScenarioQuickTestTurns 可调。
// 全程 mock LLM（_endTurnInternal 由脚本编排·零真 AI 调用·真 key 留给 owner 手跑）。

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const BRIDGE = path.join(ROOT, 'preview', 'scenario-editor-sandbox-bridge.js');
const sourceRef = process.argv.includes('--source-ref') ? process.argv[process.argv.indexOf('--source-ref') + 1] : null;
const src = sourceRef ? require('child_process').execFileSync('git', ['show', sourceRef + ':web/preview/scenario-editor-sandbox-bridge.js'], { cwd:path.resolve(ROOT, '..'), encoding:'utf8' }) : fs.readFileSync(BRIDGE, 'utf8');

let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) { passed++; console.log('  ✓ ' + msg); } else { failed++; console.error('  ✗ ' + msg); } }

// ═══ 0. 源码契约面（镜像/入口钉，与 smoke-authoring-agent-tools C6 互补） ═══
console.log('— 0: 源码契约面 —');
ok(src.indexOf("QUICKTEST_DB_ID = 'quickTestReport:latest'") >= 0, '报告写回 key 保留(quickTestReport:latest·agent 镜像同 key)');
ok(/TM_SCENARIO_QUICKTEST\s*=/.test(src) && /runById/.test(src), 'TM_SCENARIO_QUICKTEST 句柄 + runById console 入口在');
ok(/tmScenarioQuickTestTurns/.test(src), 'URL 回合数参数 tmScenarioQuickTestTurns 接线在');
ok(/_useSecondaryTier/.test(src) && /restoreAiTier/.test(src), '快档路由 engage/restore 在');
ok(/TM\.invariants/.test(src) && /_fiscalValidatorLog/.test(src) && /_personnelValidatorLog/.test(src), '四类体检全走既有校验器(invariants/fiscal/personnel log)');
const agentSrc = fs.readFileSync(path.join(ROOT, 'editor-authoring-agent.js'), 'utf8');
ok(agentSrc.indexOf("'quickTestReport:latest'") >= 0, 'agent 侧读取仍与桥侧同 key(镜像防漂移)');

// ═══ vm 沙箱：mock IndexedDB + mock 回合引擎(按 plan 编排) ═══
function makeIDB() {
  const store = {};
  function open() {
    const req = {};
    setTimeout(() => {
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => {},
        transaction: () => {
          const tx = {};
          tx.objectStore = () => ({
            put: (rec) => { store[rec.id] = rec; setTimeout(() => tx.oncomplete && tx.oncomplete(), 0); },
            get: (key) => { const g = {}; setTimeout(() => { g.result = store[key]; g.onsuccess && g.onsuccess(); }, 0); return g; },
            delete: () => {}
          });
          return tx;
        },
        close: () => {}
      };
      req.result = db;
      req.onsuccess && req.onsuccess({ target: { result: db } });
    }, 0);
    return req;
  }
  return { open, __store: store };
}

function makeCtx(plan) {
  const idb = makeIDB();
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    Math, Date, JSON, Promise, setTimeout, clearTimeout, URLSearchParams,
    Object, Array, Number, String, Boolean, parseInt, parseFloat, isNaN, isFinite, RegExp
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.location = { search: '' };
  ctx.document = { readyState: 'complete', addEventListener() {} };
  ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
  ctx.__closed = 0; ctx.__stopped = 0; ctx.close = () => { ctx.__closed++; }; ctx.stop = () => { ctx.__stopped++; };
  ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  ctx.indexedDB = idb;
  ctx.toast = () => {};
  ctx.buildIndices = () => {}; ctx.saveP = () => {}; ctx.showScnSelect = () => {};
  ctx.P = { ai: { key: 'primary-key', url: 'https://primary/v1', model: 'big', secondary: { key: 'sec', url: 'https://sec/v1', model: 'fast' } }, conf: {}, scenarios: [] };
  // TM.invariants mock：形状与 tm-invariants.js check() 返回一致·__inv 可被 plan 替换
  ctx.__inv = { chars: {}, officeTree: {}, factions: {} };
  ctx.TM = { invariants: { check: () => ({ results: {
    chars: { details: { deadButBusy: ctx.__inv.chars.deadButBusy || 0 }, violations: ctx.__inv.chars.v || [] },
    officeTree: { details: { deadHolders: ctx.__inv.officeTree.deadHolders || 0, phantomHolders: ctx.__inv.officeTree.phantomHolders || 0 }, violations: ctx.__inv.officeTree.v || [] },
    factions: { details: { orphanFacRefs: ctx.__inv.factions.orphanFacRefs || 0 }, violations: ctx.__inv.factions.v || [] }
  } }) } };
  ctx.startGame = () => { ctx.GM = { turn: 0, running: true, chars: [{ name: 'A', alive: true }], facs: [{ name: 'F' }], guoku: { money: 1000 }, _fiscalValidatorLog: [], _personnelValidatorLog: [] }; return Promise.resolve(); };
  // plan 按「尝试序号」编排(非世界回合数)——抛错步模拟瞬时故障·世界不推进·下一尝试可恢复
  let attempt = 0;
  ctx._endTurnInternal = () => {
    attempt++;
    const step = plan[attempt] || {};
    if (step.throw) return Promise.reject(new Error(step.throw));
    if (step.hang) return new Promise(() => {});
    if (step.lateMs) return new Promise(resolve => setTimeout(() => {
      ctx.__lateSeenKey = ctx.P.ai.key;
      try { ctx.GM.turn = (ctx.GM.turn || 0) + (step.lateAdvance || 10); } catch (_) {}
      resolve();
    }, step.lateMs));
    const n = (ctx.GM.turn || 0) + 1;
    ctx.GM.turn = n;
    if (step.fiscal) ctx.GM._fiscalValidatorLog.push({ turn: n, warnings: step.fiscal.warnings, samples: step.fiscal.samples || [] });
    if (step.person) ctx.GM._personnelValidatorLog.push({ turn: n, missing: step.person.missing, patched: step.person.patched || 0, skipped: step.person.skipped || [] });
    if (step.inv) ctx.__inv = step.inv;
    return Promise.resolve();
  };
  vm.createContext(ctx);
  ctx.crypto=require('crypto').webcrypto; ctx.TextEncoder=TextEncoder;
  vm.runInContext(fs.readFileSync(path.join(ROOT,'tm-agent-kernel.js'),'utf8'),ctx,{filename:'tm-agent-kernel.js'});
  vm.runInContext(src, ctx, { filename: 'scenario-editor-sandbox-bridge.js' });
  return { ctx, idb };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  {
    const {ctx,idb}=makeCtx({1:{}}),scenario={id:'frozen-report',name:'原始输入'},json=JSON.stringify(scenario);
    const running=ctx.TM_SCENARIO_QUICKTEST.run(scenario,{turns:1,bootWaitMs:5,perTurnTimeoutMs:2000});scenario.name='启动之后被修改';await running;
    const binding=idb.__store['quickTestReport:latest'].quickTest.sourceFingerprint;
    ok(binding && binding.hash===require('crypto').createHash('sha256').update(json).digest('hex'),'报告指纹绑定开局前原输入，不绑定结束时可能变动的对象');
  }
  // ═══ 1. 多回合 + 报告结构 + 按回合归因 + 黄判 ═══
  console.log('— 1: 三回合连跑·schema:2·体检累积按回合归因·黄判 —');
  {
    const { ctx, idb } = makeCtx({
      1: {},
      2: { fiscal: { warnings: [{ kind: 'income', resource: 'money', mentioned: 4500000, adjusted: 0, shortfall: 4500000, ratio: 0 }], samples: [{ raw: '抄没家产四百五十万两' }] },
           person: { missing: [{ name: '胡廷晏', verb: '斩', raw: '把胡廷晏砍了' }], patched: 1 } },
      3: {}
    });
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc1', name: '测试剧本' }, { turns: 3, bootWaitMs: 5, perTurnTimeoutMs: 2000 });
    await wait(20);
    const rep = idb.__store['quickTestReport:latest'].quickTest;
    ok(rep.schema === 2 && rep.turnsRequested === 3 && rep.turnsRan === 3 && rep.turns.length === 3, 'schema:2·3 回合全跑·turns[] 逐回合累积');
    ok(ctx.GM.turn === 3, '同一局连跑(GM.turn 推进到 3·世界连续)');
    ['id', 'createdAt', 'scenarioId', 'scenarioName', 'phase', 'bootOk', 'turnRan', 'turnOk', 'errors', 'boot', 'turn', 'note'].forEach(k => {
      ok(k in rep, '旧字段向后兼容: ' + k);
    });
    ok(rep.turnOk === true && rep.turn.stats.turn === 3, '旧语义保留(turnOk=首回合·turn=最后一回合)');
    ok(rep.verdict && rep.verdict.level === 'yellow', '账面脱节+叙事错名 → 总判黄');
    const fa = rep.verdict.anomalies.find(a => a.category === 'fiscal-drift');
    const na = rep.verdict.anomalies.find(a => a.category === 'narrative-name');
    ok(fa && fa.turn === 2 && /四百五十万/.test(fa.excerpt), '账面异常带回合号(2)+原账摘录');
    ok(na && na.turn === 2 && /胡廷晏/.test(na.excerpt), '叙事错名异常带回合号(2)+原句摘录');
    ok(rep.turns[0].health.fiscal.count === 0 && rep.turns[1].health.fiscal.count === 1 && rep.turns[2].health.fiscal.count === 0, 'log 基线 slice·告警只归产生它的回合');
    ok(rep.turns.every(t => t.health && 'deadOffice' in t.health && 'ghostKey' in t.health && 'fiscal' in t.health && 'narrative' in t.health), '每回合 health 四检齐全');
  }

  // ═══ 2. 单回合失败不中断 + 红判 ═══
  console.log('— 2: 回合2抛错·记录后继续跑回合3·红判 —');
  {
    const { ctx, idb } = makeCtx({ 1: {}, 2: { throw: '模拟回合崩' }, 3: {} });
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc2', name: 'X' }, { turns: 3, bootWaitMs: 5, perTurnTimeoutMs: 2000 });
    await wait(20);
    const rep = idb.__store['quickTestReport:latest'].quickTest;
    ok(rep.turns.length === 3 && rep.turns[1].threw === true && !rep.turns[2].skipped, '回合2抛错记录·回合3照跑(失败隔离)');
    ok(rep.turns[2].ok === true && rep.turns[2].turnBefore === 1 && rep.turns[2].stats.turn === 2, '回合3自世界断点续推(turnBefore 锚定·瞬时故障后恢复)');
    ok(rep.verdict.level === 'red' && rep.verdict.anomalies.some(a => a.category === 'turn-error' && a.turn === 2), '红判+turn-error 异常带回合号');
  }

  // ═══ 3. 结构性损坏(死人任职/幽灵键) → 红判 ═══
  console.log('— 3: invariants 结构违规 → 红判 —');
  {
    const { ctx, idb } = makeCtx({ 1: { inv: { chars: { deadButBusy: 2, v: ['2 个死角色仍占职'] }, officeTree: { phantomHolders: 1, v: ['1 个官职 holder 角色不存在'] }, factions: {} } } });
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc3', name: 'Y' }, { turns: 1, bootWaitMs: 5, perTurnTimeoutMs: 2000 });
    await wait(20);
    const rep = idb.__store['quickTestReport:latest'].quickTest;
    ok(rep.verdict.level === 'red', '死人任职/幽灵键 → 红判');
    ok(rep.verdict.anomalies.some(a => a.category === 'dead-office' && /占职/.test(a.excerpt || '')), 'dead-office 异常带违规原文');
    ok(rep.verdict.anomalies.some(a => a.category === 'ghost-key' && /不存在/.test(a.excerpt || '')), 'ghost-key 异常带违规原文');
    ok(rep.turns[0].health.deadOffice.count === 2 && rep.turns[0].health.ghostKey.count === 1, '体检计数直取校验器 details(不重算)');
  }

  // ═══ 4. 超时保护：挂死回合中止后续 ═══
  console.log('— 4: 回合2挂死 → 超时记录+中止回合3(防异步争抢) —');
  {
    const { ctx, idb } = makeCtx({ 1: {}, 2: { hang: true }, 3: {} });
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc4', name: 'Z' }, { turns: 3, bootWaitMs: 5, perTurnTimeoutMs: 80 });
    await wait(150);
    const rep = idb.__store['quickTestReport:latest'].quickTest;
    ok(rep.turns.some(t => /超时/.test(t.error || '')), '回合2超时如实记录');
    ok(rep.turns.some(t => t.skipped), '回合3被安全中止(skipped·不与挂死回合争抢)');
    ok(rep.verdict.level === 'red', '超时 → 红判');
    ok(ctx.P.ai.key === '' && ctx.__closed === 1 && ctx.__stopped === 1, '超时清空运行时凭据并 teardown 独立沙盒(不恢复主 key)');
  }

  // ═══ 4b. 晚到 Promise：报告返回后不得再改 GM / 读取主 key ═══
  console.log('— 4b: 超时后 late-resolve 被冻结隔离 —');
  {
    const { ctx, idb } = makeCtx({ 1: { lateMs: 120, lateAdvance: 99 } });
    ctx._useSecondaryTier = () => true;
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc4b', name: 'Late' }, { turns: 1, bootWaitMs: 5, perTurnTimeoutMs: 35 });
    const turnAtReport = ctx.GM.turn;
    await wait(180);
    const rep = idb.__store['quickTestReport:latest'].quickTest;
    ok(rep.teardown === 'window-close' && /超时/.test(rep.turns[0].error || ''), 'late-resolve 场景先写超时报告再销毁');
    ok(ctx.GM.turn === turnAtReport && turnAtReport === 0, '晚到 _endTurnInternal 无法继续变异已冻结 GM');
    ok(ctx.__lateSeenKey === '' && ctx.P.ai.key === '' && ctx.P.ai.secondary.key === '', '晚到任务只见空凭据·从未见恢复后的主/次 key');
  }

  // ═══ 5. 全清 → 绿判 ═══
  console.log('— 5: 三回合全清 → 绿判 —');
  {
    const { ctx, idb } = makeCtx({ 1: {}, 2: {}, 3: {} });
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc5', name: 'G' }, { turns: 3, bootWaitMs: 5, perTurnTimeoutMs: 2000 });
    await wait(20);
    const rep = idb.__store['quickTestReport:latest'].quickTest;
    ok(rep.verdict.level === 'green' && rep.verdict.anomalies.length === 0, '四类体检全清 → 绿判·零异常');
    ok(/3\/3/.test(rep.verdict.summary), '总判 summary 报 3/3 回合跑通');
  }

  // ═══ 6. 刀C·快档路由 engage/restore ═══
  console.log('— 6: 次要 API 快档路由·跑中切换·全路径还原 —');
  {
    const { ctx, idb } = makeCtx({ 1: {}, 2: {}, 3: {} });
    ctx._useSecondaryTier = () => true;
    const seen = [];
    const origET = ctx._endTurnInternal;
    ctx._endTurnInternal = () => { seen.push(ctx.P.ai.model + '|' + ctx.P.ai.key); return origET(); };
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc6', name: 'T' }, { turns: 3, bootWaitMs: 5, perTurnTimeoutMs: 2000 });
    await wait(20);
    const rep = idb.__store['quickTestReport:latest'].quickTest;
    ok(rep.aiTier === 'secondary', 'report.aiTier=secondary(快档已接管)');
    ok(seen.length === 3 && seen.every(m => m === 'fast|sec'), '回合期间 P.ai=快档(model=fast·key=sec)·整条推演链归快档');
    ok(ctx.P.ai.model === 'big' && ctx.P.ai.key === 'primary-key' && ctx.P.ai.url === 'https://primary/v1', '跑完 P.ai 还原主档');
  }
  {
    const { ctx, idb } = makeCtx({ 1: {} });
    ctx._useSecondaryTier = () => false;
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc6b', name: 'U' }, { turns: 1, bootWaitMs: 5, perTurnTimeoutMs: 2000 });
    await wait(20);
    ok(idb.__store['quickTestReport:latest'].quickTest.aiTier === 'primary' && ctx.P.ai.key === 'primary-key', '次要 API 关闭 → 全程主档·P.ai 未动');
  }
  {
    const { ctx } = makeCtx({ 1: { throw: '崩' } });
    ctx._useSecondaryTier = () => true;
    await wait(20);
    await ctx.TM_SCENARIO_QUICKTEST.run({ id: 'sc6c', name: 'V' }, { turns: 1, bootWaitMs: 5, perTurnTimeoutMs: 2000 });
    await wait(20);
    ok(ctx.P.ai.key === 'primary-key' && ctx.P.ai.model === 'big', '回合抛错路径亦还原 P.ai(finish 全路径)');
  }

  // Explicit thinking belongs to the selected API, even when quick-test routes it through the primary transport slot.
  for (const [mainThinking, secondaryThinking] of [[true,false],[false,true],[true,undefined],[undefined,false]]) {
    const { ctx } = makeCtx({ 1:{}, 2:{} });
    ctx._useSecondaryTier = () => true; ctx.URL = URL;
    ctx.P.ai.model = 'deepseek-chat'; ctx.P.ai.secondary.model = 'qwen3-235b-a22b';
    if (mainThinking !== undefined) { ctx.P.ai.thinking = mainThinking; ctx.P.ai.thinkingProtocol = 'deepseek'; }
    if (secondaryThinking !== undefined) { ctx.P.ai.secondary.thinking = secondaryThinking; ctx.P.ai.secondary.thinkingProtocol = 'qwen'; }
    const original = JSON.stringify(ctx.P.ai), had = Object.prototype.hasOwnProperty.call(ctx.P.ai, 'thinking');
    vm.runInContext(fs.readFileSync(path.join(ROOT,'tm-ai-request-options.js'),'utf8'),ctx,{filename:'tm-ai-request-options.js'});
    const seen = [], runTurn = ctx._endTurnInternal;
    ctx._endTurnInternal = () => { seen.push(ctx.TM.AIOptions.apply({model:ctx.P.ai.model,max_tokens:4000},ctx.P.ai,'openai')); return runTurn(); };
    await ctx.TM_SCENARIO_QUICKTEST.run({id:'thinking-route',name:'思考路由'}, {turns:2,bootWaitMs:5,perTurnTimeoutMs:2000});
    ok(seen.length===2 && seen.every(body=>body.enable_thinking===secondaryThinking && body.thinking===undefined), '快测使用副 API thinking='+secondaryThinking+'，不串主 API='+mainThinking);
    ok(JSON.stringify(ctx.P.ai)===original && Object.prototype.hasOwnProperty.call(ctx.P.ai,'thinking')===had, '快测后原样恢复主 API 与默认字段存在性');
  }

  // ═══ 7. 刀C·runById console 入口 ═══
  console.log('— 7: runById console 一键入口 —');
  {
    const { ctx, idb } = makeCtx({ 1: {}, 2: {} });
    await wait(20);
    ctx.P.scenarios.push({ id: 'sc-console', name: '控制台剧本' });
    await ctx.TM_SCENARIO_QUICKTEST.runById('sc-console', { turns: 2, bootWaitMs: 5, perTurnTimeoutMs: 2000 });
    await wait(20);
    const rep = idb.__store['quickTestReport:latest'].quickTest;
    ok(rep && rep.scenarioId === 'sc-console' && rep.turnsRequested === 2, 'runById 走同一运行器·turns 参数生效');
    const r2 = await ctx.TM_SCENARIO_QUICKTEST.runById('不存在的id');
    ok(r2 === null, 'runById 找不到剧本返回 null 不抛');
  }

  console.log('');
  console.log(`[smoke-quicktest-multiturn] ${passed} passed / ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch(e => { console.error('harness 自身异常: ' + (e && e.stack || e)); process.exit(1); });

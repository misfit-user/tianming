#!/usr/bin/env node
'use strict';
// Runtime consistency smoke: unified save builder + cross-load write leases + pre_endturn validation + settings persistence.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ok - ' + msg); } else { fail++; console.error('  FAIL - ' + msg); } }
function sliceFn(src, marker) {
  const a = src.indexOf(marker); if (a < 0) return '';
  let i = src.indexOf('{', a), depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}' && --depth === 0) { j++; break; } }
  return src.slice(a, j);
}

const lifecycle = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'tm-endturn-core.js'), 'utf8');
const render = fs.readFileSync(path.join(ROOT, 'tm-endturn-render.js'), 'utf8');
const pipeline = fs.readFileSync(path.join(ROOT, 'tm-endturn-pipeline-steps.js'), 'utf8');
const manager = fs.readFileSync(path.join(ROOT, 'tm-save-manager.js'), 'utf8');
const storage = fs.readFileSync(path.join(ROOT, 'tm-storage.js'), 'utf8');
const office = fs.readFileSync(path.join(ROOT, 'tm-office-editor.js'), 'utf8');
const patches = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');
const playerSettings = fs.readFileSync(path.join(ROOT, 'tm-player-settings.js'), 'utf8');
const utils = fs.readFileSync(path.join(ROOT, 'tm-utils.js'), 'utf8');
const launch = fs.readFileSync(path.join(ROOT, 'tm-launch.js'), 'utf8');
const resume = fs.readFileSync(path.join(ROOT, 'tm-resume-point.js'), 'utf8');
const mainImpl = fs.readFileSync(path.join(ROOT, '..', 'main-impl.js'), 'utf8');
const preloadImpl = fs.readFileSync(path.join(ROOT, '..', 'preload-impl.js'), 'utf8');
const startPatch = fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8');
const integrationBridge = fs.readFileSync(path.join(ROOT, 'tm-integration-bridge.js'), 'utf8');
const hujiEngine = fs.readFileSync(path.join(ROOT, 'tm-huji-engine.js'), 'utf8');

console.log('=== 1. unified save snapshot builder ===');
const snapshotSrc = sliceFn(lifecycle, 'function _tmSaveSnapshotSkipKeys(') + '\n' + sliceFn(lifecycle, 'function _autoSaveSnapshotGM(');
const builderSrc = sliceFn(lifecycle, 'function _buildSaveState(');
const desktopResultSrc = sliceFn(lifecycle, 'function _tmDesktopAutoSaveResultOk(');
ok(!!snapshotSrc && !!builderSrc, '_autoSaveSnapshotGM + _buildSaveState 可抽取');
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(desktopResultSrc, ctx);
  ok(ctx._tmDesktopAutoSaveResultOk({ success: true }) && ctx._tmDesktopAutoSaveResultOk(true)
    && !ctx._tmDesktopAutoSaveResultOk({ success: false }) && !ctx._tmDesktopAutoSaveResultOk(undefined), 'Electron autoSave 显式区分业务成功与 resolve({success:false})');
}
{
  const ctx = {
    GM: { turn: 8, chars: [{ name: '甲', loyalty: 50 }], qijuHistory: [{ t: 1 }], _aiTelemetry: { huge: true } },
    P: { ai: { key: 'primary-secret', secondary: { key: 'secondary-secret', url: 'x' } }, conf: { a: 1 } },
    deepClone: v => JSON.parse(JSON.stringify(v)),
    _tmStripAiKeyInPlace: p => { if (p.ai) { delete p.ai.key; if (p.ai.secondary) delete p.ai.secondary.key; } return p; },
    _prepareGMForSave() {}, window: {}
  };
  vm.createContext(ctx);
  vm.runInContext(snapshotSrc + '\n' + builderSrc + '\nthis.IDB=_buildSaveState({format:"idb",prepare:false});this.PROJ=_buildSaveState({format:"project",prepare:false});', ctx);
  ok(ctx.IDB.GM.turn === 8 && ctx.IDB.P.conf.a === 1, 'IDB 外壳保持 {GM,P}');
  ok(ctx.PROJ.gameState.turn === 8 && ctx.PROJ.conf.a === 1, 'project 外壳保持 P+gameState');
  ok(!ctx.IDB.P.ai.key && !ctx.IDB.P.ai.secondary.key && !ctx.PROJ.ai.key, '两种外壳均剥离主/次 API key');
  ok(!('_aiTelemetry' in ctx.IDB.GM) && !('_aiTelemetry' in ctx.PROJ.gameState), '两种外壳复用 selective GM snapshot');
}
ok(/saveData2=_buildSaveState\(\{format:'project'\}\)/.test(lifecycle), '浏览器导出走统一纯 builder');
ok(/saveData=_buildSaveState\(\{format:'project'\}\)/.test(lifecycle), '桌面手动存档走统一纯 builder');
ok(/_buildSaveState\(\{ format: 'idb', detach: true, gm: txn\.gmRef, p: txn\.pRef \}\)/.test(core),
  'pre_endturn 从点击时事务引用走统一 detached builder');
ok(/global\._buildSaveState\(\{ format: 'idb', detach: true, gm: GM, p: P \|\| \{\} \}\)/.test(resume), '残局发布以 detached 模式复用统一 builder');
ok(!/gameState\s*=\s*deepClone\(GM\)|GM\s*:\s*deepClone\(GM\)/.test(lifecycle + '\n' + core + '\n' + manager), '生产存档写口无裸 deepClone(GM)');
ok(!/SaveManager\.autoSave\(\)/.test(render), '端回合不再重复调用 SaveManager.autoSave 覆盖 slot_0');
ok(/TM_SaveDB\.saveManyAtomic\(\[[\s\S]*?id: 'autosave'[\s\S]*?id: 'slot_0'[\s\S]*?_writeOk !== true[\s\S]*?_clearPreEndturnMarkerAfterSave/.test(render),
  'canonical batch failure preserves the pre_endturn recovery marker');
ok(/_writeOk !== true[\s\S]*?throw new Error\('canonical 回合存档未原子落库'\)[\s\S]*?_updateSaveIndex/.test(render),
  'slot index is published only after the canonical batch commits');
{
  const batchAt = render.indexOf('TM_SaveDB.saveManyAtomic([');
  const writesDoneAt = render.indexOf("if (_writeOk !== true", batchAt);
  const markerAt = render.indexOf("localStorage.setItem('tm_autosave_mark'", batchAt);
  ok(markerAt > writesDoneAt && writesDoneAt > batchAt && /turn:\s*_autoMeta\.turn/.test(render.slice(markerAt, markerAt + 300)), 'tm_autosave_mark 仅在原子双槽提交后写入并锚定快照 turn');
}
ok(/var result = await window\.tianming\.autoSave\(saveData\);[\s\S]*?if \(!_tmDesktopAutoSaveResultOk\(result\)\) throw[\s\S]*?_autoSaveLastDoneMs = Date\.now\(\)/.test(lifecycle), '60s Electron autoSave 仅在业务成功后推进成功时钟');
ok(/_autoSaveLastSavedTurn = Number\(saveData\._saveMeta\.turn\)/.test(lifecycle), 'Electron 闲置跳存基线锚定已写 committed snapshot turn');
ok(!/window\.tianming\.autoSave\(/.test(render), '端回合删除重复 Electron autoSave·崩溃恢复档只留 60s 写口');
ok(/var _endturnSaveGM = GM;[\s\S]*?var _endturnSaveP = P;[\s\S]*?_endturnSaveLoadGen[\s\S]*?_endturnSavePreId/.test(render), '端回合 detached save 捕获 GM/P/loadGen/pre snapshotId');
ok(/await _awaitPostTurnJobsForSave[\s\S]*?if \(!_endturnSaveStillCurrent\(\)\) return false;[\s\S]*?_buildSaveState\(\{format:'idb',detach:true,gm:_endturnSaveGM,p:_endturnSaveP\}\)/.test(render), '后台等待后先验租约·builder 在 detached snapshot 上准备');
ok(/TM_SaveDB\.saveManyAtomic\([\s\S]*?_autoWriteOptions\)/.test(render)
  && /function saveManyAtomic\(entries, options\)/.test(storage), 'autosave/slot_0 共用代际租约与单一批量事务');
{
  const renderFn = sliceFn(render, 'function _endTurn_render(');
  const barrierStepAt = pipeline.indexOf("name: 'prepare-commit-barrier'");
  const normalIndicatorAt = pipeline.indexOf('_kjUpdateIndicators(ctx)');
  const deferredOpenersAt = pipeline.indexOf('await _runPostRenderTurnOpeners(ctx)');
  const deferredSaveAt = pipeline.indexOf('await _tmFinalizeEndTurnTransaction(ctx, ctx.meta.transaction)', deferredOpenersAt);
  ok(!/_endTurn_saveSnapshot\s*\(/.test(renderFn), '_endTurn_render 只渲染·不再在 Phase5 前启动存档');
  ok(barrierStepAt > normalIndicatorAt && normalIndicatorAt >= 0 && /finalSaveRequired\s*=\s*true/.test(pipeline.slice(barrierStepAt)), 'normal 路径在 Phase5/J1 后只声明提交屏障');
  ok(deferredSaveAt > deferredOpenersAt && /ctx\.meta\.deferEndTurnSave\s*=\s*false/.test(pipeline.slice(deferredOpenersAt, deferredSaveAt + 300)), 'deferred 路径在 Phase5/openers 后复用共享提交屏障');
  ok(/ctx\.meta\.deferEndTurnSave\s*=\s*true/.test(pipeline) && /if \(ctx\.meta\.deferEndTurnSave\) return true;/.test(core), 'deferred 路径显式阻止 core 提前落库');
  ok(/!ctx\.meta\.endTurnSavePromise && typeof _endTurn_saveSnapshot/.test(core)
    && (core.match(/_endTurn_saveSnapshot\(ctx\)/g) || []).length === 1, 'normal/deferred 两条路径复用同一幂等存档 promise');
  ok(/var saved = await ctx\.meta\.endTurnSavePromise;[\s\S]*?saved !== true[\s\S]*?_tmCommitEndTurnTransaction/.test(core), 'normal 提交屏障严格等待最终存档后才 commit');
}
ok(/function createCanonicalPayload\(state, identity\)[\s\S]*?JSON\.stringify\(state\)[\s\S]*?SaveCompression\.compress\(json\)/.test(storage)
  && /function save\(id, gameState, meta, options\)[\s\S]*?createCanonicalPayload\(gameState[\s\S]*?if \(!_writeStillAllowed\(\)\) return Promise\.resolve\(false\)[\s\S]*?if \(!_writeStillAllowed\(\)\) return false;[\s\S]*?_putSaveRecord/.test(storage),
  'SaveDB 同步冻结 canonical payload，并在异步准备前及真正 put 前复验 writeGuard');
ok(/var sourceSnapshot = lastCommittedSnapshot;[\s\S]*?await window\.tianming\.autoSave\(saveData\);[\s\S]*?lastCommittedSnapshot !== sourceSnapshot[\s\S]*?不推进当前局闲置基线[\s\S]*?_autoSaveLastDoneMs = Date\.now\(\)/.test(lifecycle), '60s Electron IPC 跨档或快照推进后不推进当前局闲置跳存基线');
ok(/let autoSaveWriteQueue = Promise\.resolve\(\);[\s\S]*?const task = autoSaveWriteQueue\.then[\s\S]*?autoSaveWriteQueue = task\.then/.test(mainImpl), '主进程串行化固定 .tmp 的所有 auto-save IPC');
ok(/auto-save-session-rotate/.test(mainImpl) && /autoSaveSessionMatches\(requestToken\)/.test(mainImpl)
  && /writeFile[\s\S]*?autoSaveSessionMatches\(requestToken\)[\s\S]*?rename/.test(mainImpl), 'Electron canonical auto-save 在 write/rename 间按 session token 复验');
ok(/rotateAutoSaveSession/.test(preloadImpl) && /_tmRotateDesktopAutoSaveSession\('full-load'/.test(lifecycle)
  && /_tmRotateDesktopAutoSaveSession\('new-game'/.test(startPatch), 'preload + 读档 + 新局共同切换 auto-save session');
ok(/var _turnDataRecovery = await _recoverPendingTurnDataPublish\(\);[\s\S]*?_turnDataRecovery\.ok === false[\s\S]*?throw[\s\S]*?_tmForkLoadedTimeline/.test(lifecycle),
  'receipt recovery failure aborts before the loaded world can fork its timeline');
ok(/_tmRebindRuntimeWorld\(\{ strict: true, integration: false/.test(lifecycle)
  && /_tmRunCriticalLoadStep\('engine migration'/.test(lifecycle)
  && /_tmRunCriticalLoadStep\('relationship reference migration'/.test(lifecycle)
  && /_tmRunCriticalLoadStep\('fiscal configuration migration'/.test(lifecycle)
  && /_tmRebindRuntimeWorld\(\{ strict: true, map: false \}\)/.test(lifecycle)
  && /_tmRunCriticalLoadStep\('loaded world validation'/.test(lifecycle),
  'state-mutating load migrations propagate into the load transaction instead of failing open');
ok(/function aggregateRegionsToVariables\(options\)[\s\S]*?var strict = options\.strict === true/.test(integrationBridge)
  && !/function _naturalPopulationGrowth\(/.test(integrationBridge)
  && !/function _accumulateCorruptionFromNpcs\(/.test(integrationBridge)
  && /function tick\(options\)[\s\S]*?aggregateRegionsToVariables\(\{ strict: strict \}\)/.test(integrationBridge),
  'integration bridge is aggregation-only; Huji and CorruptionEngine own simulation time');
ok(/function _tmStripSaveTransportMetadata\([\s\S]*?\^__tm\(\?:Desktop\|AutoSave\)/.test(lifecycle)
  && /_tmStripSaveTransportMetadata\(_incomingP\)/.test(lifecycle)
  && /_tmStripSaveTransportMetadata\(_incomingGM\)/.test(lifecycle),
  'desktop and auto-save envelope fields are stripped before P/GM become runtime state');
ok(/stageTurnData\([\s\S]*?result\.success === true[\s\S]*?回合分卷暂存失败/.test(render)
  && /turnPublishReceipt:\s*ctx\.meta\.stagedTurnData/.test(render)
  && /_tmCommitEndTurnTransaction[\s\S]*?await _endTurn_publishStagedTurnData/.test(core), '回合分卷先暂存·receipt 与世界同事务提交·仅在 commit 后发布');
ok(/function _recoverPendingTurnDataPublish\(\)[\s\S]*?baseRecoveryLeaseCurrent[\s\S]*?listTurnPublishReceipts\(campaignId, timelineId, 'world-committed'\)[\s\S]*?recoverTurnData\(marker\)[\s\S]*?deleteTurnPublishReceipt\(marker/.test(lifecycle),
  '读档按世界身份租约补发独立 receipt，并只删除轻量事务记录');
{
  const loadImpl = sliceFn(lifecycle, 'async function _fullLoadGameApplyImpl(');
  const hydrateAt = loadImpl.indexOf('await ChronicleSystem.hydrateDurableRecords(GM, P)');
  const receiptAt = loadImpl.indexOf('await _recoverPendingTurnDataPublish()');
  const forkAt = loadImpl.indexOf('_tmForkLoadedTimeline(GM');
  const enableAt = loadImpl.indexOf('GM.busy = false');
  const showWorldAt = loadImpl.indexOf('_$("G").style.display="grid"');
  const enterAt = loadImpl.indexOf('enterGame()');
  ok(/function fullLoadGame\(data, loadOptions\)[\s\S]*?window\._tmLoadBarrier = barrier/.test(lifecycle)
    && hydrateAt >= 0 && receiptAt > hydrateAt && forkAt > receiptAt && enableAt > forkAt
    && showWorldAt > enableAt && enterAt > showWorldAt,
  '读档以显式 Promise 屏障等待编年 hydration 和 receipt 恢复后才开放玩法');
  ok(/GM\.busy = true;[\s\S]*?GM\._loadHydrationPending = true;/.test(loadImpl)
    && /function _tmAwaitLoadBarrier\(\)[\s\S]*?result !== true[\s\S]*?throw new Error/.test(lifecycle)
    && /doSaveGame=async function\(\)\{\s*await _tmAwaitLoadBarrier\(\)/.test(lifecycle)
    && /desktopDoSave=async function\(\)\{[\s\S]*?_tmCaptureWorldLease\(\)[\s\S]*?await _tmAwaitLoadBarrier\(\)/.test(lifecycle)
    && /saveToSlot:\s*async function[\s\S]*?await _tmAwaitLoadBarrier\(\)/.test(manager),
  'hydration 期间 busy 阻止过回合，所有主要手动保存入口也等待同一屏障');
}
ok(/function _endTurn_publishStagedTurnData\([\s\S]*?deleteTurnPublishReceipt\(marker[\s\S]*?ctx\.meta\.stagedTurnData = null/.test(render)
  && !/function _endTurn_publishStagedTurnData\([\s\S]*?clearPendingTurnDataPublishAtomic/.test(render),
  '正常分卷发布不再解压、重压并重写两个 canonical 世界');
{
  const finalizerFn = sliceFn(render, 'function _endTurn_finalizeRecords(');
  const uiRenderFn = sliceFn(render, 'function _endTurn_render(');
  ok(/_syncFiscalScalars\(GM\)[\s\S]*?_wdPrepareAudienceRenderState\(\)[\s\S]*?updateMapColors\(\{ refresh: false \}\)/.test(finalizerFn),
    '财政、问对和地图派生状态在事务内最终化');
  ok(/renderWenduiChars\(false, \{ skipStatePreparation: true \}\)/.test(uiRenderFn)
    && /renderGameState\(\{ skipStateSync: true \}\)/.test(uiRenderFn)
    && !/updateMapColors\(/.test(uiRenderFn), 'commit 后 UI 渲染跳过所有已知状态准备入口');
}

console.log('=== 2. pre_endturn two-phase + strict validator ===');
ok(/commitState:\s*'pending'/.test(core) && /livePreMark\.commitState = 'committed'/.test(core), 'marker pending -> committed 两阶段');
ok(/snapshotId:\s*preSnapshotId/.test(core) && /snapshotId: \(meta && meta\.snapshotId\)/.test(storage), 'snapshotId 同时进入 marker/state/IDB record');
ok(/TM_SaveDB\.save\('pre_endturn',[\s\S]*?writeGuard:\s*preWriteStillCurrent/.test(core)
  && /GM === preSaveGM && P === preSaveP[\s\S]*?preSaveLoadGen[\s\S]*?GM\.turn === preTurn[\s\S]*?GM\.sid === preSid[\s\S]*?preSnapshotId/.test(core),
  'pre_endturn 写事务绑定 GM/P/loadGen/turn/sid/snapshotId lease');
ok(storage.indexOf('jsonStr = JSON.stringify(gameState)') < storage.indexOf('return _ensureOpen().then(function()'), 'SaveDB 在异步 open/gzip 前同步固化 snapshot JSON');
ok(/_validatePreEndturnSnapshot\(record, preInfo, true\)/.test(office), '启动恢复要求 marker 严格校验');
ok(/_tryLoadAutosave\(autoInfo\)/.test(office), '校验/读取失败保留 autosave 安全回退');
{
  const validatorSrc = sliceFn(manager, 'function _validatePreEndturnSnapshot(');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(validatorSrc, ctx);
  const rec = {
    turn: 8, snapshotId: 'snap-8', commitState: 'committed',
    gameState: { GM: { turn: 8 }, P: {}, _preEndturn: { turn: 8, snapshotId: 'snap-8', commitState: 'committed' } }
  };
  const mark = { turn: 8, snapshotId: 'snap-8', commitState: 'committed' };
  ok(ctx._validatePreEndturnSnapshot(rec, mark, true).ok, '完全匹配 committed 三方可恢复');
  ok(!ctx._validatePreEndturnSnapshot(rec, { ...mark, snapshotId: 'old' }, true).ok, 'marker snapshotId 错配拒绝');
  ok(!ctx._validatePreEndturnSnapshot({ ...rec, turn: 7 }, mark, true).ok, 'record turn 错配拒绝');
  ok(!ctx._validatePreEndturnSnapshot(rec, { ...mark, commitState: 'pending' }, true).ok, 'pending marker 拒绝');
}

console.log('=== 3. sSaveAll atomic API persistence ===');
ok(!/function sSaveAll\(\)\{\s*sSaveAPI\(\)/.test(patches), 'sSaveAll 不再提前调用 sSaveAPI 写旧 secondary');
ok(!/tianming\.autoSave\(_tmStripAiKeyView\(P\)\)/.test(patches + '\n' + playerSettings), 'API 单项保存不再以纯 P 覆盖对局中的桌面恢复档');
ok(/function sSaveAPI\(\)[\s\S]*?localStorage\.setItem\("tm_api"[\s\S]*?saveP\(\)/.test(patches), '主 API 单项保存统一 tm_api + saveP');
ok(/function sSaveSecondaryAPI\(\)[\s\S]*?localStorage\.setItem\("tm_api"[\s\S]*?saveP\(\)/.test(patches), '次 API 单项保存统一 tm_api + saveP');
const savePSrc = sliceFn(utils, 'function saveP(');
const saveAndBackSrc = sliceFn(launch, 'function saveAndBack(');
ok(!/tianming\.autoSave\(/.test(savePSrc + '\n' + saveAndBackSrc), 'saveP / 编辑器返回不再以纯 P 覆盖 Electron canonical 恢复档');
ok(/setInterval\(function\(\)\{[\s\S]*?_tmRunDesktopAutoSaveTick\(\)/.test(lifecycle)
  && ((lifecycle + '\n' + utils + '\n' + launch + '\n' + patches + '\n' + playerSettings).match(/tianming\.autoSave\(/g) || []).length === 1,
  'Electron autoSave 生产写口只剩消费 committed snapshot 的 60s runner');
{
  const applySrc = sliceFn(patches, 'function _sApplyPrimaryApiFields(');
  const allSrc = sliceFn(patches, 'function sSaveAll(');
  const values = {
    's-key': 'new-primary', 's-url': 'https://new-primary/v1', 's-model': 'main', 's-prov': 'openai',
    's-sec-key': 'new-secondary', 's-sec-url': 'https://new-secondary/v1', 's-sec-model': 'fast', 's-sec-prov': 'openai'
  };
  const writes = [];
  const ctx = {
    P: { ai: { secondary: { key: 'old-secondary' } }, conf: {} },
    _$: id => Object.prototype.hasOwnProperty.call(values, id) ? { value: values[id] } : null,
    document: { querySelectorAll: () => [] },
    localStorage: { setItem: (k, v) => writes.push([k, JSON.parse(v)]) },
    saveP() {}, toast() {}, tmApplyInsecureTlsConfig() {},
    console: { warn() {} }, parseInt, parseFloat, isNaN
  };
  vm.createContext(ctx);
  vm.runInContext(applySrc + '\n' + allSrc + '\nsSaveAll();', ctx);
  const apiWrites = writes.filter(w => w[0] === 'tm_api');
  ok(apiWrites.length === 1, '保存全部只原子写 tm_api 一次');
  ok(apiWrites[0][1].key === 'new-primary' && apiWrites[0][1].secondary.key === 'new-secondary', '同一次持久化包含新主 key + 新 secondary key');
}

async function runDynamicLeaseSmokes() {
  console.log('=== 4. dynamic write lease regressions ===');
  {
    let releaseBarrier;
    let settled = false;
    const ctx = {
      window: {}, Promise,
      setTimeout, clearTimeout
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx);
    vm.runInContext(sliceFn(lifecycle, 'function _tmAwaitLoadBarrier('), ctx);
    ctx.window._tmLoadBarrier = new Promise(resolve => { releaseBarrier = resolve; });
    const waiting = ctx._tmAwaitLoadBarrier().then(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 5));
    ok(settled === false, '保存/玩法共享的 load barrier 在 hydration 完成前保持未决');
    releaseBarrier(true);
    await waiting;
    ok(settled === true, 'hydration 完成后 load barrier 才放行等待中的操作');
  }
  {
    const division = {
      id: 'region-1', population: { mouths: 50000000, households: 10000000, ding: 12500000 },
      populationDetail: { mouths: 50000000, households: 10000000, ding: 12500000 },
      minxin: 60, corruption: 30, environment: { currentLoad: 0.5, carrying: 100000000 }, fiscal: {}
    };
    const ctx = {
      console, Promise, JSON, Math, Number, Object, Array, Date,
      GM: {
        turn: 10, adminHierarchy: { player: { divisions: [division] } },
        population: {
          national: { mouths: 50000000, households: 10000000, ding: 12500000 },
          dynamics: { birthRateBase: 0.03, deathRateBase: 0.022, yearlyLog: [] }
        },
        minxin: { trueIndex: 60 }, corruption: { trueIndex: 30, overall: 30, byDept: {} },
        chars: [{ name: '测试官', officialTitle: '知县', integrity: 0, resources: { private: { money: 500000 } } }]
      },
      P: { conf: { populationBottomUpEnabled: false }, time: { year: 1627 } },
      TM: { errors: { capture() {}, captureSilent() {} } },
      turnsForMonths(months) { return months; },
      _getDaysPerTurn() { return 30; }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(integrationBridge, ctx);
    vm.runInContext(hujiEngine, ctx);
    ctx.IntegrationBridge.migrateAndRebind({ strict: true }); // 一次性 schema 对齐
    function gameplayState() {
      const leaf = ctx.GM.adminHierarchy.player.divisions[0];
      return JSON.stringify({
        turn: ctx.GM.turn, population: leaf.population, populationDetail: leaf.populationDetail,
        corruption: ctx.GM.corruption, currentLoad: leaf.environment.currentLoad
      });
    }
    const stable = gameplayState();
    for (let i = 0; i < 10; i++) {
      const disk = JSON.parse(JSON.stringify({ GM: ctx.GM, P: ctx.P }));
      ctx.GM = disk.GM; ctx.P = disk.P;
      ctx.IntegrationBridge.migrateAndRebind({ strict: true });
    }
    const afterTenLoads = gameplayState();
    ctx.HujiEngine.tick({ turn: ctx.GM.turn, monthRatio: 1, strict: true });
    const afterHuji = gameplayState();
    ctx.IntegrationBridge.tick({ strict: true });
    const afterBridge = gameplayState();
    ok(afterTenLoads === stable && afterHuji !== stable && afterBridge === afterHuji,
      '读档—保存循环不推进玩法，Huji 单次推进且 IntegrationBridge 不再重复结算');
  }
  {
    const helpers = [
      sliceFn(lifecycle, 'function _tmStripSaveTransportMetadata('),
      sliceFn(lifecycle, 'function _tmStableIdMissing('),
      sliceFn(lifecycle, 'function _tmStableIdentityParts('),
      sliceFn(lifecycle, 'function _tmCollectAdminDivisionEntries('),
      sliceFn(lifecycle, 'function _tmEntityIdSet('),
      sliceFn(lifecycle, 'function _tmValidateUniqueStableIds('),
      sliceFn(lifecycle, 'function _tmValidateStableForeignKeys('),
      sliceFn(lifecycle, 'function _tmValidateFiniteWorldNumbers('),
      sliceFn(lifecycle, 'function _tmValidateLoadedWorld(')
    ].join('\n');
    const ctx = {
      Number, Object, Array, String, Error, WeakSet, JSON,
      _tmEnsureTimelineIdentity(gm) { return !!gm._timelineId; }
    };
    vm.createContext(ctx); vm.runInContext(helpers, ctx);
    const p = { __tmDesktopSaveGeneration: 'storage-only', __tmAutoSaveEnvelope: 1, conf: {} };
    const gm = {
      __tmDesktopPrivate: true, __tmAutoSavePrivate: true,
      turn: 1, _campaignId: 'campaign', _timelineId: 'tml_runtime_12345678',
      chars: [{ id: 'char-1' }], facs: [{ id: 'fac-1' }], armies: [], officeTree: [], mapData: { regions: [{ id: 'region-1' }] }
    };
    ctx._tmStripSaveTransportMetadata(p); ctx._tmStripSaveTransportMetadata(gm);
    ok(!Object.keys(p).some(key => /^__tm(?:Desktop|AutoSave)/.test(key))
      && !Object.keys(gm).some(key => /^__tm(?:Desktop|AutoSave)/.test(key))
      && ctx._tmValidateLoadedWorld(p, gm) === true,
    'storage envelope metadata never enters validated runtime P/GM');
    let duplicateRejected = false;
    try { ctx._tmValidateLoadedWorld(p, Object.assign({}, gm, { chars: [{ id: 'dup' }, { id: 'dup' }] })); }
    catch (error) { duplicateRejected = /重复 id/.test(error.message); }
    ok(duplicateRejected, 'loaded-world invariant gate rejects duplicate stable character IDs before UI opens');
  }
  {
    const transactionFns = [
      sliceFn(lifecycle, 'function _tmAwaitLoadBarrier('),
      sliceFn(lifecycle, 'function _tmCaptureLoadStepError('),
      sliceFn(lifecycle, 'function _tmRunCriticalLoadStep('),
      sliceFn(lifecycle, 'function _tmRuntimeMapSourceForWorld('),
      sliceFn(lifecycle, 'function _tmRebindRuntimeWorld('),
      sliceFn(lifecycle, 'function _tmCaptureLoadTransaction('),
      sliceFn(lifecycle, 'function _tmRestoreLoadTransaction('),
      sliceFn(lifecycle, 'function fullLoadGame('),
      sliceFn(lifecycle, 'async function _fullLoadGameImpl(')
    ].join('\n');
    function makeLoadContext(rollbackMustFail) {
      let sessionToken = 'session-old-1234567890';
      const reboundWorlds = [];
      const oldP = { marker: 'old-P' };
      const oldGM = { marker: 'old-GM', running: true, busy: false, _chronicleSysState: { monthDrafts: {}, yearChronicles: {}, yearBases: {} } };
      const context = {
        P: oldP, GM: oldGM, Promise, Date, Math, Error, String, Object, Array,
        console: { warn() {}, error() {}, log() {} },
        _tmGetDesktopAutoSaveSessionToken() { return sessionToken; },
        _tmRotateDesktopAutoSaveSession(_reason, token) { sessionToken = token; return token; },
        ChronicleSystem: { deserialize() {} },
        bindRuntimeMapState() { reboundWorlds.push(['map', context.GM]); },
        IntegrationBridge: { migrateAndRebind() { reboundWorlds.push(['integration', context.GM]); } },
        buildIndices: rollbackMustFail ? function() { throw new Error('rollback-index-failure'); } : function() { reboundWorlds.push(['indices', context.GM]); },
        MemTables: { ensureInit() { reboundWorlds.push(['memory', context.GM]); } },
        TM: { FactionIndex: { rebuild() { reboundWorlds.push(['faction', context.GM]); } } }
      };
      context.window = context;
      context._tmLoadGen = 7;
      context.scriptData = { customPresets: { old: true } };
      context._fullLoadGameApplyImpl = async function() {
        context.P = { marker: 'incoming-P' };
        context.GM = { marker: 'incoming-GM', running: true, busy: true };
        context.window.P = context.P;
        context.window.GM = context.GM;
        context._tmLoadGen++;
        context._tmRotateDesktopAutoSaveSession('full-load', 'session-incoming-123456');
        await Promise.resolve();
        context._tmRunCriticalLoadStep('engine migration', function() {
          context.GM.enginePartiallyMigrated = true;
          throw new Error('engine-migration-injected-failure');
        });
      };
      vm.createContext(context);
      vm.runInContext(transactionFns, context);
      return { context, oldP, oldGM, reboundWorlds, getSession: () => sessionToken };
    }
    const restored = makeLoadContext(false);
    let loadError = null;
    try { await restored.context.fullLoadGame({}); } catch (error) { loadError = error; }
    await restored.context._tmAwaitLoadBarrier();
    ok(loadError && loadError._tmLoadRollbackComplete === true && loadError._tmLoadStep === 'engine migration'
      && restored.context.P === restored.oldP && restored.context.GM === restored.oldGM
      && restored.context._tmLoadGen === 9 && restored.getSession() === 'session-old-1234567890'
      && restored.reboundWorlds.length >= 4 && restored.reboundWorlds.every(entry => entry[1] === restored.oldGM),
    'critical migration partial write rolls back P/GM/session and rebinds every runtime singleton to the old world');

    const blocked = makeLoadContext(true);
    let blockedError = null;
    try { await blocked.context.fullLoadGame({}); } catch (error) { blockedError = error; }
    let barrierRejected = false;
    try { await blocked.context._tmAwaitLoadBarrier(); } catch (_) { barrierRejected = true; }
    ok(blockedError && blockedError._tmLoadRollbackComplete !== true && blockedError._tmLoadRollbackError
      && barrierRejected === true,
    '读档回滚自身失败时 barrier 保持 rejected，半恢复世界不能被手动保存入口放行');

    let releaseFirstLoad;
    const serialized = makeLoadContext(false);
    serialized.context._fullLoadGameApplyImpl = async function() {
      await new Promise(resolve => { releaseFirstLoad = resolve; });
    };
    const firstLoad = serialized.context.fullLoadGame({ id: 'first' });
    const firstBarrier = serialized.context._tmLoadBarrier;
    let overlappingRejected = false;
    try { await serialized.context.fullLoadGame({ id: 'second' }); } catch (_) { overlappingRejected = true; }
    ok(overlappingRejected && serialized.context._tmLoadBarrier === firstBarrier
      && serialized.context._tmActiveLoadTransaction,
    '重叠读档被同步拒绝且不能替换第一条仍在进行的完成屏障');
    releaseFirstLoad();
    await firstLoad;
    await serialized.context._tmAwaitLoadBarrier();
  }
  {
    const writes = [], order = [];
    const ls = new Map([['tm_pre_endturn_mark', JSON.stringify({ snapshotId: 'pre-9' })]]);
    const ctx = {
      GM: { turn: 9, sid: 's1', phase5Value: 'after', eraName: '某年号' }, P: { marker: 'p1' },
      window: { _tmLoadGen: 2, _tmActivePreEndturnSnapshotId: 'pre-9', TM: { errors: { capture() {}, captureSilent() {} } } },
      TM: { errors: { capture() {}, captureSilent() {} } }, console, Promise, Date, JSON, Math, Error, setTimeout,
      localStorage: { getItem: k => ls.get(k) || null, setItem: (k, v) => ls.set(k, v), removeItem: k => ls.delete(k) },
      _awaitPostTurnJobsForSave: async () => { order.push('jobs'); }, _prepareGMForSave: () => { order.push('prepare'); },
      _buildSaveState: opts => { order.push('snapshot:' + opts.gm.phase5Value); return { GM: { phase5Value: opts.gm.phase5Value }, P: opts.p }; },
      findScenarioById: () => ({ name: '测试剧本' }), getTSText: () => '某日',
      TM_SaveDB: {
        saveManyAtomic: async entries => {
          entries.forEach(entry => writes.push([entry.id, entry.gameState.GM.phase5Value]));
          return true;
        }
      }
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx); vm.runInContext(render, ctx);
    order.push('phase5');
    const saved = await ctx._endTurn_saveSnapshot({ meta: {} });
    ok(saved === true && order.indexOf('phase5') < order.indexOf('snapshot:after') && writes.length === 2 && writes.every(w => w[1] === 'after'), '真实 save helper 只快照 Phase5 后状态并同时写 autosave/slot_0');
  }
  {
    let staged = 0, published = 0, deleted = 0, capturedOptions = null;
    const ctx = {
      GM: { turn: 50, sid: 's1', saveName: 'desktop-save', _campaignId: 'campaign-receipt', _timelineId: 'tml_receipt_12345678', eraName: '某年号' }, P: {},
      window: {
        _tmLoadGen: 2,
        _tmActivePreEndturnSnapshotId: 'pre-50',
        TM: { errors: { capture() {}, captureSilent() {} } },
        tianming: {
          isDesktop: true,
          turnDataProtocolVersion: 2,
          async stageTurnData() { staged++; return { success: true }; },
          async publishTurnData() { published++; return { success: true }; }
        }
      },
      TM: { errors: { capture() {}, captureSilent() {} } }, console, Promise, Date, JSON, Math, Error, setTimeout,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      _awaitPostTurnJobsForSave: async () => {}, _prepareGMForSave() {},
      _buildSaveState: opts => ({ GM: JSON.parse(JSON.stringify(opts.gm)), P: opts.p }),
      findScenarioById: () => ({ name: '测试剧本' }), getTSText: () => '某日',
      TM_SaveDB: {
        async saveManyAtomic(entries, options) { capturedOptions = options; return entries.length === 2; },
        async deleteTurnPublishReceipt() { deleted++; return true; }
      }
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx); vm.runInContext(render, ctx);
    const saveCtx = { meta: { transactionId: 'turn-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', turnPresentation: { turnData: { context: { turn: 49 } } } } };
    const saved = await ctx._endTurn_saveSnapshot(saveCtx);
    const publishedOk = await ctx._endTurn_publishStagedTurnData(saveCtx);
    ok(saved === true && publishedOk === true && staged === 1 && published === 1 && deleted === 1
      && capturedOptions.turnPublishReceipt.transactionId === 'turn-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
      && !ctx.GM._pendingTurnDataPublish,
    'desktop receipt commits with canonical worlds and publish cleanup never mutates the world payload');
  }
  {
    const receipt = {
      id: 'turn-publish:campaign-recover:tml_recover_12345678:turn-recover-1', campaignId: 'campaign-recover', timelineId: 'tml_recover_12345678',
      transactionId: 'turn-recover-1', saveName: '测试档', turn: 50,
      stateChecksum: 'checksum-recover-1', status: 'world-committed'
    };
    const futureReceipt = Object.assign({}, receipt, { id: receipt.id + '-future', transactionId: 'turn-recover-future', turn: 80 });
    const foreignReceipt = Object.assign({}, receipt, { id: receipt.id + '-foreign', transactionId: 'turn-recover-foreign', timelineId: 'tml_foreign_12345678' });
    let recovered = 0, deleted = 0;
    const ctx = {
      GM: { turn: 51, _campaignId: 'campaign-recover', _timelineId: 'tml_recover_12345678' }, P: { id: 'p-recover' },
      window: {
        _tmLoadGen: 4,
        tianming: { turnDataProtocolVersion: 2, async recoverTurnData(marker) { recovered++; return { success: marker.transactionId === receipt.transactionId }; } },
        TM: { errors: { capture() {} } }
      },
      TM: { errors: { capture() {} } }, Promise, JSON, Error, console,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      TM_SaveDB: {
        async listTurnPublishReceipts(campaignId, timelineId, status) {
          return campaignId === receipt.campaignId && timelineId === receipt.timelineId && status === 'world-committed'
            ? [futureReceipt, foreignReceipt, receipt] : [];
        },
        async deleteTurnPublishReceipt(marker, options) {
          if (options.writeGuard() !== true) return false;
          deleted++;
          return marker.transactionId === receipt.transactionId;
        }
      },
      toast() {}
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx); vm.runInContext(sliceFn(lifecycle, 'function _recoverPendingTurnDataPublish('), ctx);
    await ctx._recoverPendingTurnDataPublish();
    ok(recovered === 1 && deleted === 1 && !ctx.GM._pendingTurnDataPublish,
      'load recovery publishes only matching, non-future receipts and leaves other branches untouched');
    ctx.window.tianming.recoverTurnData = async function() { return { success: false, error: 'disk unavailable' }; };
    const failedRecovery = await ctx._recoverPendingTurnDataPublish();
    ok(failedRecovery && failedRecovery.ok === false && /disk unavailable/.test(String(failedRecovery.error && failedRecovery.error.message))
      && deleted === 1,
    'receipt recovery failure is explicit and leaves the durable receipt available for a transactional retry');
  }
  {
    let staged = 0, discarded = 0;
    const ctx = {
      GM: { turn: 50, sid: 's1', saveName: 'desktop-save', _campaignId: 'campaign-a', _timelineId: 'tml_campaign_a_12345678', eraName: '某年号' }, P: {},
      window: {
        _tmLoadGen: 2,
        _tmActivePreEndturnSnapshotId: 'pre-50',
        TM: { errors: { capture() {}, captureSilent() {} } },
        tianming: {
          isDesktop: true,
          turnDataProtocolVersion: 2,
          async stageTurnData() { staged++; return { success: true }; },
          async discardTurnData() { discarded++; return { success: true }; }
        }
      },
      TM: { errors: { capture() {}, captureSilent() {} } }, console, Promise, Date, JSON, Math, Error, setTimeout,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      _awaitPostTurnJobsForSave: async () => {}, _prepareGMForSave() {},
      _buildSaveState: opts => ({ GM: JSON.parse(JSON.stringify(opts.gm)), P: opts.p }),
      findScenarioById: () => ({ name: '测试剧本' }), getTSText: () => '某日',
      TM_SaveDB: { async saveManyAtomic() { throw new Error('slot_0 injected failure'); } }
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx); vm.runInContext(render, ctx);
    const saveCtx = { meta: { transactionId: 'turn-11111111-2222-4333-8444-555555555555', turnPresentation: { turnData: { context: { turn: 49 } } } } };
    const saved = await ctx._endTurn_saveSnapshot(saveCtx);
    ok(saved === false && staged === 1 && discarded === 1 && !ctx.GM._pendingTurnDataPublish,
      'canonical batch failure discards desktop staging and leaves no formal publish marker');
  }
  {
    let staged = 0, discarded = 0, committedReceipt = null;
    const ctx = {
      GM: { turn: 50, sid: 's1', saveName: 'desktop-save', _campaignId: 'campaign-cross-load', _timelineId: 'tml_cross_load_12345678', eraName: '某年号' }, P: {},
      window: {
        _tmLoadGen: 2,
        _tmActivePreEndturnSnapshotId: 'pre-50',
        TM: { errors: { capture() {}, captureSilent() {} } },
        tianming: {
          isDesktop: true,
          turnDataProtocolVersion: 2,
          async stageTurnData() { staged++; return { success: true }; },
          async discardTurnData() { discarded++; return { success: true }; }
        }
      },
      TM: { errors: { capture() {}, captureSilent() {} } }, console, Promise, Date, JSON, Math, Error, setTimeout,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      _awaitPostTurnJobsForSave: async () => {}, _prepareGMForSave() {},
      _buildSaveState: opts => ({ GM: JSON.parse(JSON.stringify(opts.gm)), P: opts.p }),
      findScenarioById: () => ({ name: '测试剧本' }), getTSText: () => '某日',
      TM_SaveDB: {
        async saveManyAtomic(entries, options) {
          committedReceipt = options.turnPublishReceipt;
          ctx.window._tmLoadGen++;
          return entries.length === 2;
        },
        async deleteTurnPublishReceipt() { throw new Error('committed receipt must remain'); }
      }
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx); vm.runInContext(render, ctx);
    const saveCtx = { meta: { transactionId: 'turn-cross-load-12345678', turnPresentation: { turnData: { context: { turn: 49 } } } } };
    const saved = await ctx._endTurn_saveSnapshot(saveCtx);
    ok(saved === false && staged === 1 && discarded === 0 && committedReceipt.transactionId === 'turn-cross-load-12345678',
      'a post-commit load switch preserves staging and its durable receipt for the original campaign');
  }
  {
    let src = storage;
    const bootAt = src.lastIndexOf('\nTM_SaveDB.open().then');
    src = src.slice(0, bootAt);
    let allowed = true, writeAttempts = 0, committed = 0, deletes = 0;
    const db = {
      objectStoreNames: { contains: () => true },
      transaction() {
        const tx = {};
        tx.objectStore = (storeName) => ({
          get() {
            const req = {};
            setTimeout(() => { req.result = undefined; req.onsuccess({ target: req }); }, 0);
            return req;
          },
          put() {
            if (storeName !== 'saves') return;
            writeAttempts++;
            if (writeAttempts === 1) setTimeout(() => tx.onerror({ target: { error: { name: 'QuotaExceededError' } } }), 0);
            else { committed++; setTimeout(() => tx.oncomplete(), 0); }
          },
          getAll() {
            const req = {};
            setTimeout(() => { allowed = false; req.result = [{ id: 'older-auto', type: 'auto', timestamp: 1 }]; req.onsuccess(); }, 0);
            return req;
          },
          delete() { deletes++; setTimeout(() => tx.oncomplete(), 0); }
        });
        return tx;
      },
      close() {}
    };
    const indexedDB = { open() { const req = {}; setTimeout(() => req.onsuccess({ target: { result: db } }), 0); return req; }, deleteDatabase() {} };
    const localStorage = { length: 0, setItem() {}, getItem() { return null; }, removeItem() {}, key() { return null; } };
    const ctx = { window: { indexedDB }, indexedDB, localStorage, navigator: { storage: {} }, console, setTimeout, clearTimeout, Promise, Date, JSON, Math, Blob, Response, CompressionStream: undefined, DecompressionStream: undefined };
    Object.assign(ctx.window, { window: ctx.window, localStorage, navigator: ctx.navigator, console });
    vm.createContext(ctx); vm.runInContext(src, ctx);
    await ctx.TM_SaveDB.open();
    const result = await ctx.TM_SaveDB.save('autosave', { GM: { turn: 8 }, P: {} }, { type: 'auto', turn: 8 }, { writeGuard: () => allowed });
    ok(result === false && allowed === false && writeAttempts === 1 && committed === 0 && deletes === 0, 'stale quota recovery neither deletes an older autosave nor retries put');
  }
  {
    const currentFn = sliceFn(core, 'function _tmEndTurnTransactionCurrent(');
    const commitFn = sliceFn(core, 'async function _tmCommitPreEndTurnRecoveryPoint(');
    const src = currentFn + '\n' + commitFn
      + '\nthis.__commitPreEndturn = function(txn, state){ return _tmCommitPreEndTurnRecoveryPoint(txn, state); };';
    const store = new Map(), ls = new Map();
    let releaseSave, rawSave;
    const ctx = {
      GM: { running: true, sid: 'old-sid', turn: 8, eraName: 'old', saveName: 'old-save' },
      P: { id: 'old-p' },
      window: { _tmLoadGen: 3, TM: { errors: { capture() {}, captureSilent() {} } } },
      crypto: { randomUUID: () => 'pre-snapshot-old' }, Date, Math, JSON, Error, Promise, console,
      _tmReportEndTurnBoundaryError() {},
      _tmAdoptCommittedWorldSnapshot() { return true; },
      findScenarioById() { return { name: 'old' }; }, getTSText() { return 'T8'; },
      localStorage: { setItem(k, v) { ls.set(k, v); }, getItem(k) { return ls.get(k) || null; } },
      TM_SaveDB: {
        save(id, state, meta, options) {
          rawSave = new Promise(resolve => {
            releaseSave = () => {
              const current = options.writeGuard() === true;
              if (current) store.set(id, state);
              resolve(current);
            };
          });
          return rawSave;
        }
      }
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx); vm.runInContext(src, ctx);
    const txn = {
      gmRef: ctx.GM, pRef: ctx.P, loadGen: 3, campaignId: '', timelineId: '',
      committed: false, rolledBack: false
    };
    const preSaveRun = ctx.__commitPreEndturn(txn, { GM: { turn: 8, sid: 'old-sid', eraName: 'old' }, P: { id: 'old-p' } });
    await Promise.resolve();
    ls.set('tm_pre_endturn_mark', JSON.stringify({ turn: 21, snapshotId: 'pre-snapshot-new', commitState: 'pending' }));
    ctx.window._tmActivePreEndturnSnapshotId = 'pre-snapshot-new';
    ctx.window._tmLoadGen = 4;
    ctx.GM = { running: true, sid: 'new-sid', turn: 21 };
    ctx.P = { id: 'new-p' };
    releaseSave();
    await rawSave;
    let preSaveError = null;
    try { await preSaveRun; } catch (e) { preSaveError = e; }
    const marker = JSON.parse(ls.get('tm_pre_endturn_mark'));
    ok(!!preSaveError && !store.has('pre_endturn') && marker.snapshotId === 'pre-snapshot-new' && marker.commitState === 'pending', 'stale pre_endturn completion fails closed and cannot overwrite the newer record or marker');
  }
  {
    const a = mainImpl.indexOf('const AUTO_SAVE_FILE =');
    const b = mainImpl.indexOf('// --- 系统对话框：导出 ---', a);
    const src = mainImpl.slice(a, b);
    const files = new Map(), handles = {}, syncHandles = {};
    let releaseFirstWrite, firstWriteStarted;
    const firstStarted = new Promise(resolve => { firstWriteStarted = resolve; });
    let delayFirst = true, autoRenames = 0;
    const fakeFs = {
      writeFileSync(file, data) { files.set(file, String(data)); },
      readFileSync(file) { if (!files.has(file)) throw new Error('ENOENT'); return files.get(file); },
      renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
      existsSync(file) { return files.has(file); },
      promises: {
        async writeFile(file, data) {
          if (delayFirst && /__autosave__\.json\.tmp$/.test(file)) {
            delayFirst = false; firstWriteStarted(); await new Promise(resolve => { releaseFirstWrite = resolve; });
          }
          files.set(file, String(data));
        },
        async rename(from, to) { if (/__autosave__\.json$/.test(to)) autoRenames++; files.set(to, files.get(from)); files.delete(from); },
        async unlink(file) { files.delete(file); }
      }
    };
    const ipcMain = { handle(name, fn) { handles[name] = fn; }, on(name, fn) { syncHandles[name] = fn; } };
    const ctx = {
      ipcMain, fs: fakeFs, path: { join: (...parts) => parts.join('/') }, SAVE_DIR: 'mem', ensureSaveDir() {},
      crypto: { randomUUID: () => 'generated-session-token-0001' }, Promise, JSON, String, Error,
      prepareDesktopSavePayload(data) {
        data.__tmDesktopSaveGeneration = data.__tmDesktopSaveGeneration || 'payload-generation-test-0001';
        return { data, generation: data.__tmDesktopSaveGeneration, text: JSON.stringify(data) };
      },
      async readJsonFileOffMainThread(file) { return JSON.parse(fakeFs.readFileSync(file, 'utf8')); },
      desktopSaveGenerationFromData(data) { return data && data.__tmDesktopSaveGeneration || ''; },
      invalidateDesktopSaveGeneration() {},
      writeDesktopSaveMetadata() {}
    };
    vm.createContext(ctx); vm.runInContext(src, ctx);
    const rotate = token => { const event = {}; syncHandles['auto-save-session-rotate'](event, token); return event.returnValue; };
    const current = () => { const event = {}; syncHandles['auto-save-session-current'](event); return event.returnValue; };
    const tokenA = 'session-token-A-00000001', tokenB = 'session-token-B-00000002';
    const oldWrite = handles['auto-save'](null, { __tmAutoSaveEnvelope: 1, sessionToken: tokenA, data: { gameState: { turn: 8 } } });
    await firstStarted;
    ok(current().token === tokenA, 'first wrapped request atomically adopts its token when sidecar is absent');
    ok(rotate(tokenB).success === true, 'full-load/new-game synchronously invalidates an in-flight session');
    releaseFirstWrite();
    const oldResult = await oldWrite;
    ok(oldResult.success === false && oldResult.stale === true && autoRenames === 0, 'invalidated old IPC cannot rename over canonical auto-save');
    const newResult = await handles['auto-save'](null, { __tmAutoSaveEnvelope: 1, sessionToken: tokenB, data: { gameState: { turn: 21 } } });
    const loaded = await handles['load-auto-save']();
    ok(newResult.success === true && autoRenames === 1 && loaded.success === true && loaded.sessionToken === tokenB && loaded.data.gameState.turn === 21, 'current session writes and reloads the canonical envelope');
  }
}

runDynamicLeaseSmokes().then(function() {
  console.log('\n[smoke-runtime-save-consistency] ' + pass + ' passed / ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch(function(err) {
  fail++;
  console.error('  FAIL - dynamic lease smoke crashed:', err && err.stack || err);
  console.log('\n[smoke-runtime-save-consistency] ' + pass + ' passed / ' + fail + ' failed');
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'tm-save-lifecycle.js'), 'utf8');
const closeSource = fs.readFileSync(path.join(__dirname, '..', 'tm-save-close-flush.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(__dirname, '..', 'tm-endturn-core.js'), 'utf8');
const start = source.indexOf('var _autoSaveInFlight=false;');
const end = source.indexOf('if(_tmHasNativeFs()){', start);
if (start < 0 || end <= start) throw new Error('desktop auto-save runtime slice missing');
const coreStart = coreSource.indexOf('function _tmCaptureEndTurnObject(');
const coreEnd = coreSource.indexOf('async function _tmFinalizeEndTurnTransaction(', coreStart);
if (coreStart < 0 || coreEnd <= coreStart) throw new Error('end-turn transaction runtime slice missing');

let pass = 0;
function check(name, condition) {
  if (!condition) throw new Error('[smoke-desktop-autosave-committed-world] ' + name);
  pass += 1;
  console.log('  PASS - ' + name);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function main() {
  const writes = [];
  const preEndturnWrites = [];
  const backgroundTransactions = [];
  const localValues = new Map();
  let sessionToken = 'session-a';
  let delayedWriteResolve = null;
  let delayNextWrite = false;
  let closeFlushCallback = null;
  const context = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    Error,
    Promise,
    setTimeout,
    clearTimeout,
    crypto: { randomUUID: () => 'autosave-test-uuid' },
    window: {
      _tmLoadGen: 4,
      tianming: {
        getAutoSaveSessionToken() { return sessionToken; },
        async autoSave(payload) {
          if (delayNextWrite) {
            delayNextWrite = false;
            await new Promise(resolve => { delayedWriteResolve = resolve; });
          }
          writes.push(clone(payload));
          return { success: true };
        },
        onAppCloseFlushRequest(callback) {
          closeFlushCallback = callback;
          return function dispose() {
            if (closeFlushCallback !== callback) return false;
            closeFlushCallback = null;
            return true;
          };
        }
      }
    },
    deepClone: clone,
    _tmStripAiKeyInPlace(value) { return value; },
    _tmStripAiKeyView(value) { return value; },
    _tmLiteSafeConf(value) { return value; },
    _prepareGMForSave(gm, p) { return { GM: gm, P: p }; },
    _tmHasNativeFs() { return true; },
    findScenarioById() { return { name: '测试剧本' }; },
    getTSText(turn) { return 'T' + turn; },
    TM_SaveDB: {
      async save(id, state, meta, options) {
        if (id !== 'pre_endturn') throw new Error('unexpected save id: ' + id);
        if (!options || typeof options.writeGuard !== 'function' || options.writeGuard() !== true) {
          throw new Error('pre_endturn write guard rejected click-state');
        }
        preEndturnWrites.push({ id, state: clone(state), meta: clone(meta) });
        return true;
      },
      async createCanonicalPayload(state, identity) {
        return { state: clone(state), identity: clone(identity), json: JSON.stringify(state), checksum: 'background-test' };
      },
      async saveManyAtomic(entries, options) {
        if (context.__backgroundSaveFailuresRemaining > 0) {
          context.__backgroundSaveFailuresRemaining--;
          throw new Error('injected background atomic failure');
        }
        if (!options || typeof options.writeGuard !== 'function' || options.writeGuard() !== true) {
          throw new Error('background write guard rejected world');
        }
        backgroundTransactions.push({
          ids: entries.map(entry => entry.id),
          states: entries.map(entry => clone(entry.gameState)),
          payloads: entries.map(entry => entry.canonicalPayload),
          meta: clone(entries[0].meta),
          transactionId: options.transactionId
        });
        return true;
      }
    },
    localStorage: {
      removeItem(key) { localValues.delete(String(key)); },
      setItem(key, value) { localValues.set(String(key), String(value)); },
      getItem(key) { return localValues.has(String(key)) ? localValues.get(String(key)) : null; }
    }
  };
  context.window.window = context.window;
  context.GM = {
    running: true,
    turn: 8,
    sid: 'scenario-a',
    saveName: '案卷甲',
    _campaignId: 'campaign-a',
    _timelineId: 'timeline-a',
    treasury: 100,
    population: { national: { mouths: 1000 } },
    qijuHistory: [{ turn: 7, text: '已提交' }]
  };
  context.P = { conf: { marker: 'before' }, scenarios: [] };
  context._runPreSubmitPartyClassCalibration = async function() {
    context.GM.treasury = 80;
    context.GM.population.national.mouths = 950;
    context.GM.qijuHistory.push({ turn: 8, text: '校准中' });
    context.P.conf.marker = 'calibrated';
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context, { filename: 'tm-save-lifecycle-autosave-slice.js' });
  vm.runInContext(closeSource, context, { filename: 'tm-save-close-flush.js' });
  vm.runInContext(coreSource.slice(coreStart, coreEnd), context, { filename: 'tm-endturn-core-transaction-slice.js' });

  check('桌面存档生命周期安装关闭前 flush 回调', typeof closeFlushCallback === 'function');
  check('统一世界事务判定函数可用', typeof context.isWorldTransactionActive === 'function');
  const cyclicGM = Object.assign({}, context.GM);
  cyclicGM._postTurnJobs = { pending: [{ id: 'critical', gmRef: cyclicGM }] };
  cyclicGM._postTurnDetachedJobs = [{ id: 'optional', gmRef: cyclicGM }];
  const cycleSafeState = context._buildSaveState({
    format: 'idb', detach: true, prepare: false, gm: cyclicGM, p: context.P
  });
  check('已提交快照排除带 gmRef 环的运行时任务队列', !!cycleSafeState
    && !Object.prototype.hasOwnProperty.call(cycleSafeState.GM, '_postTurnJobs')
    && !Object.prototype.hasOwnProperty.call(cycleSafeState.GM, '_postTurnDetachedJobs'));
  const endTurnTransaction = context._tmCaptureEndTurnTransaction();
  const clickState = context._tmCapturePreEndTurnCommittedState(endTurnTransaction);
  context.GM.busy = true;
  context.GM._endTurnBusy = true;
  context.GM._endTurnCommitPending = true;
  await context._tmPrepareEndTurnBoundary(endTurnTransaction, clickState);
  check('生产 prepare 顺序先提交点击时 pre_endturn、后执行校准', preEndturnWrites.length === 1
    && preEndturnWrites[0].state.GM.treasury === 100
    && preEndturnWrites[0].state.GM.population.national.mouths === 1000
    && preEndturnWrites[0].state.P.conf.marker === 'before'
    && context.GM.treasury === 80
    && context.P.conf.marker === 'calibrated');
  context.GM.treasury = 60;
  context.GM.population.national.mouths = 850;
  context.GM.qijuHistory.push({ turn: 8, text: '半结算' });
  const duringTurn = await context._tmRunDesktopAutoSaveTick({ force: true });
  check('过回合事务中 timer 只 deferred、不写盘', duringTurn.deferred === true && writes.length === 0);

  check('真实回合事务回滚恢复半结算前 GM/P',
    context._tmRollbackEndTurnTransaction(endTurnTransaction, new Error('injected later system failure')) === true
    && context.GM.treasury === 100
    && context.GM.population.national.mouths === 1000
    && context.GM.qijuHistory.length === 1
    && context.P.conf.marker === 'before');
  const afterRollback = await context._tmFlushDeferredDesktopAutoSave('rollback', { immediate: true });
  check('回滚后 deferred 自动档写入一次', afterRollback.ok === true && writes.length === 1);
  check('桌面自动档等于过回合前已提交世界', writes[0].gameState.treasury === 100
    && writes[0].gameState.population.national.mouths === 1000
    && writes[0].gameState.qijuHistory.length === 1
    && writes[0].conf.marker === 'before');
  check('回滚纵深保护重新提升恢复世界而非校准世界', context.lastCommittedSnapshot.GM.treasury === 100
    && context.lastCommittedSnapshot.GM.population.national.mouths === 1000
    && context.lastCommittedSnapshot.P.conf.marker === 'before'
    && /:rollback$/.test(context.lastCommittedTransactionId));

  const committedTurn9 = context._buildSaveState({
    format: 'idb', detach: true, prepare: false,
    gm: Object.assign({}, context.GM, { turn: 9, treasury: 130, qijuHistory: [{ turn: 8, text: '完成' }] }),
    p: Object.assign({}, context.P, { conf: { marker: 'after' } })
  });
  context._tmAdoptCommittedWorldSnapshot(committedTurn9, { turn: 9, transactionId: 'turn-9' });
  committedTurn9.GM.treasury = 1;
  context.GM.turn = 9;
  const postCommit = await context._tmRunDesktopAutoSaveTick({ force: true });
  check('canonical commit 后自动档推进到新回合', postCommit.ok === true && writes[1]._saveMeta.turn === 9);
  check('已提交快照不引用调用方随后修改的对象', writes[1].gameState.treasury === 130);

  const transactionFlags = [
    function loadHydration() { context.window._tmActiveLoadTransaction = { id: 'load' }; context.GM._loadHydrationPending = true; },
    function rollback() { context.window._tmActiveLoadTransaction = null; context.GM._loadHydrationPending = false; context.window._tmWorldRollbackActive = true; },
    function timeTravel() { context.window._tmWorldRollbackActive = false; context.window._tmActiveTimeTravelTransaction = { id: 'travel' }; }
  ];
  for (const setFlag of transactionFlags) {
    setFlag();
    const beforeWrites = writes.length;
    const result = await context._tmRunDesktopAutoSaveTick({ force: true });
    check('hydration/rollback/time-travel 活跃时均不写盘', result.deferred === true && writes.length === beforeWrites);
  }
  context.window._tmActiveTimeTravelTransaction = null;
  context.window._tmWorldRollbackActive = false;
  context.window._tmActiveLoadTransaction = null;
  context.GM._loadHydrationPending = false;
  await context._tmFlushDeferredDesktopAutoSave('transactions-clear', { immediate: true });

  context.GM.busy = true;
  context.GM._endTurnCommitPending = true;
  const beforeBurst = writes.length;
  await Promise.all([
    context._tmRunDesktopAutoSaveTick({ force: true }),
    context._tmRunDesktopAutoSaveTick({ force: true }),
    context._tmRunDesktopAutoSaveTick({ force: true })
  ]);
  check('连续 timer 不会写入三个不同结算阶段', writes.length === beforeBurst);
  context.GM.busy = false;
  context.GM._endTurnCommitPending = false;
  await context._tmFlushDeferredDesktopAutoSave('burst-clear', { immediate: true });
  check('连续 deferred 最终只补写同一已提交快照一次', writes.length === beforeBurst + 1);

  delayNextWrite = true;
  const firstWrite = context._tmRunDesktopAutoSaveTick({ force: true });
  await Promise.resolve();
  const overlapping = await context._tmRunDesktopAutoSaveTick({ force: true });
  check('IPC 在途锁阻止重叠自动档', overlapping.skipped === true && overlapping.reason === 'in-flight');
  delayedWriteResolve();
  await firstWrite;

  sessionToken = 'session-b';
  context.window._tmAutoSaveSessionToken = sessionToken;
  context.GM._campaignId = 'campaign-b';
  context.GM._timelineId = 'timeline-b';
  const crossWorld = await context._tmRunDesktopAutoSaveTick({ force: true });
  check('新会话不会复用旧战役已提交快照', crossWorld.skipped === true
    && crossWorld.reason === 'no-committed-snapshot');
  const newWorldState = context._buildSaveState({
    format: 'idb', detach: true, prepare: false, gm: context.GM, p: context.P
  });
  check('新世界稳定边界能够建立自己的 committed snapshot',
    context._tmAdoptCommittedWorldSnapshot(newWorldState, {
      turn: context.GM.turn,
      transactionId: 'new-world-loaded',
      takeOwnership: true
    }) === true);
  const newWorldWrite = await context._tmRunDesktopAutoSaveTick({ force: true });
  check('新世界只写入本战役已提交快照', newWorldWrite.ok === true
    && writes[writes.length - 1].gameState._campaignId === 'campaign-b');

  const backgroundLease = {
    gmRef: context.GM,
    pRef: context.P,
    campaignId: context.GM._campaignId,
    sid: context.GM.sid,
    turn: context.GM.turn,
    loadGen: context.window._tmLoadGen
  };
  context.GM._aiMemorySummary = '后台摘要已完成';
  context.GM._monthlyChronicle = [{ turn: context.GM.turn, text: '本月纪事' }];
  await context.requestBackgroundAutosave({ reason: 'ai-memory-summary-complete', expectedWorldLease: backgroundLease, expectedTurn: context.GM.turn });
  await context.requestBackgroundAutosave({ reason: 'monthly-chronicle-complete', expectedWorldLease: backgroundLease, expectedTurn: context.GM.turn });
  await context._tmAwaitBackgroundAutosaves();
  check('摘要与月度纪事保存请求合并为一个 canonical 双槽事务', backgroundTransactions.length === 1
    && backgroundTransactions[0].ids.join(',') === 'autosave,slot_0'
    && backgroundTransactions[0].meta.backgroundReasons.length === 2);
  check('双槽共享同一 canonical payload 且保存后台完成后的最新状态', backgroundTransactions[0].payloads[0] === backgroundTransactions[0].payloads[1]
    && backgroundTransactions[0].states[0].GM._aiMemorySummary === '后台摘要已完成'
    && backgroundTransactions[0].states[1].GM._monthlyChronicle.length === 1);
  check('后台 canonical 提交后推进 committed snapshot', context.lastCommittedSnapshot.GM._aiMemorySummary === '后台摘要已完成');

  const staleLease = Object.assign({}, backgroundLease);
  context.GM._campaignId = 'campaign-c';
  const staleSave = await context.requestBackgroundAutosave({ reason: 'stale-world-result', expectedWorldLease: staleLease, expectedTurn: staleLease.turn });
  await context._tmAwaitBackgroundAutosaves();
  check('切档后的旧后台结果不会写入新世界', staleSave.stale === true && backgroundTransactions.length === 1);

  context.GM._campaignId = 'campaign-b';
  const retryLease = Object.assign({}, backgroundLease, { gmRef: context.GM, pRef: context.P });
  context.__backgroundSaveFailuresRemaining = 1;
  await context.requestBackgroundAutosave({ reason: 'retry-once', expectedWorldLease: retryLease, expectedTurn: retryLease.turn });
  await context._tmAwaitBackgroundAutosaves();
  await context._tmAwaitBackgroundAutosaves();
  check('后台保存失败只做有限重试并最终原子成功', backgroundTransactions.length === 2
    && backgroundTransactions[1].meta.backgroundReasons[0] === 'retry-once');

  const mismatch = await context.requestBackgroundAutosave({ reason: 'wrong-turn', expectedWorldLease: retryLease, expectedTurn: retryLease.turn + 1 });
  check('后台保存拒绝与 lease 不一致的回合身份', mismatch.stale === true && mismatch.reason === 'background-turn-mismatch');

  context.GM._aiMemorySummary = '退出前刚完成的后台摘要';
  const beforeCloseFlush = backgroundTransactions.length;
  const beforeCloseMirrorWrites = writes.length;
  delayedWriteResolve = null;
  delayNextWrite = true;
  await context.requestBackgroundAutosave({
    reason: 'summary-complete-before-exit',
    expectedWorldLease: retryLease,
    expectedTurn: retryLease.turn
  });
  let closeFlushSettled = false;
  const closeFlushPromise = Promise.resolve(closeFlushCallback({ reason: 'renderer-quit' })).then((result) => {
    closeFlushSettled = true;
    return result;
  });
  for (let spin = 0; !delayedWriteResolve && spin < 20; spin++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  check('关闭握手会等待桌面自动档 IPC 而非仅等待 canonical 双槽', typeof delayedWriteResolve === 'function' && closeFlushSettled === false);
  const firstCloseMirrorResolve = delayedWriteResolve;
  context.GM._aiMemorySummary = '关闭等待期间新完成的后台摘要';
  const duringCloseSave = await context.requestBackgroundAutosave({
    reason: 'summary-complete-during-close',
    expectedWorldLease: retryLease,
    expectedTurn: retryLease.turn
  });
  check('桌面镜像在途时新摘要仍进入独立 canonical 保存队列', duringCloseSave.ok === true
    && closeFlushSettled === false);
  delayNextWrite = true;
  firstCloseMirrorResolve();
  for (let spin = 0; delayedWriteResolve === firstCloseMirrorResolve && spin < 40; spin++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  check('首次镜像完成后关闭握手继续等待新 canonical 对应的第二个桌面镜像',
    typeof delayedWriteResolve === 'function' && delayedWriteResolve !== firstCloseMirrorResolve
    && closeFlushSettled === false && backgroundTransactions.length === beforeCloseFlush + 2);
  delayedWriteResolve();
  const closeFlush = await closeFlushPromise;
  check('立即退出握手会实际 drain 后台保存而非只提示', closeFlush.ok === true
    && closeFlush.quiescencePasses === 2
    && backgroundTransactions.length === beforeCloseFlush + 2
    && backgroundTransactions[backgroundTransactions.length - 1].states[0].GM._aiMemorySummary === '关闭等待期间新完成的后台摘要');
  check('关闭握手把最新后台摘要同步到桌面恢复镜像', writes.length === beforeCloseMirrorWrites + 2
    && writes[writes.length - 1].gameState._aiMemorySummary === '关闭等待期间新完成的后台摘要');
  check('关闭握手成功后 canonical 与桌面镜像都不存在待保存或在途任务',
    !context._backgroundSavePending && !context._backgroundSaveInFlight
    && !context._autoSaveDeferred && !context._autoSaveFlushTimer
    && !context._autoSaveInFlight && !context._autoSaveInFlightPromise);

  context.GM.busy = true;
  context.GM._endTurnCommitPending = true;
  const blockedClose = await closeFlushCallback({ reason: 'window-close' });
  check('世界事务活跃时关闭握手明确拒绝退出', blockedClose.ok === false
    && blockedClose.code === 'world-transaction-active');
  context.GM.busy = false;
  context.GM._endTurnCommitPending = false;

  console.log('[smoke-desktop-autosave-committed-world] pass=' + pass);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

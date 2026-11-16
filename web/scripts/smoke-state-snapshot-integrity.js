#!/usr/bin/env node
'use strict';

// StateSnapshot v6：旧快照迁移、索引化祖先只读继承、完整状态恢复、异步身份租约与 awaited hook。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-state-snapshot.js'), 'utf8');
let pass = 0;
function ok(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok - ' + msg); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

function fakeIndexedDB(options) {
  options = options || {};
  const stores = new Map();
  const deletedIndexes = [];
  const stats = { fullStoreGetAll: 0, indexGetAll: 0, indexGetAllKeys: 0 };
  if (Array.isArray(options.records)) {
    stores.set('snapshots_v2', {
      keyPath: 'id',
      rows: new Map(options.records.map(record => [String(record.id), clone(record)])),
      indexes: new Set(options.indexes || ['campaignId', 'campaignTurn'])
    });
    stores.set('snapshots', { keyPath: 'turn', rows: new Map(), indexes: new Set() });
  }
  function storeFacade(def) {
    function completeLater(tx) { setTimeout(function() { if (tx && tx.oncomplete) tx.oncomplete(); }, 0); }
    return {
      indexNames: { contains(name) { return def.indexes.has(name); } },
      createIndex(name) { def.indexes.add(name); },
      deleteIndex(name) { def.indexes.delete(name); deletedIndexes.push(name); },
      put(record) { def.rows.set(String(record[def.keyPath]), clone(record)); return {}; },
      get(key) {
        const req = {};
        setTimeout(function() { if (req.onsuccess) req.onsuccess({ target: { result: def.rows.has(String(key)) ? clone(def.rows.get(String(key))) : undefined } }); }, 0);
        return req;
      },
      getAll() {
        stats.fullStoreGetAll++;
        const req = {};
        setTimeout(function() { if (req.onsuccess) req.onsuccess({ target: { result: Array.from(def.rows.values()).map(clone) } }); }, 0);
        return req;
      },
      index(name) {
        if (!def.indexes.has(name)) throw new Error('missing index ' + name);
        function indexKey(record) {
          if (name === 'campaignTimeline') return [record.campaignId, record.timelineId];
          if (name === 'timelineTurn') return [record.campaignId, record.timelineId, record.turn];
          if (name === 'campaignParent') return [record.campaignId, record.parentTimelineId];
          if (name === 'campaignId') return record.campaignId;
          return undefined;
        }
        return {
          getAll(query) {
            stats.indexGetAll++;
            const req = {};
            const wanted = JSON.stringify(query);
            const values = Array.from(def.rows.values()).filter(record => JSON.stringify(indexKey(record)) === wanted).map(clone);
            setTimeout(function() { if (req.onsuccess) req.onsuccess({ target: { result: values } }); }, 0);
            return req;
          },
          getAllKeys(query) {
            stats.indexGetAllKeys++;
            const req = {};
            const wanted = JSON.stringify(query);
            const keys = Array.from(def.rows.entries())
              .filter(entry => JSON.stringify(indexKey(entry[1])) === wanted)
              .map(entry => entry[0]);
            setTimeout(function() { if (req.onsuccess) req.onsuccess({ target: { result: keys } }); }, 0);
            return req;
          }
        };
      },
      delete(key) { def.rows.delete(String(key)); return {}; },
      openCursor() {
        const req = {};
        const values = Array.from(def.rows.values()).map(clone);
        let cursorIndex = 0;
        function advance() {
          setTimeout(function() {
            req.result = cursorIndex < values.length ? { value: values[cursorIndex++], continue: advance } : null;
            if (req.onsuccess) req.onsuccess({ target: req });
          }, 0);
        }
        advance();
        return req;
      },
      _completeLater: completeLater
    };
  }
  const db = {
    objectStoreNames: { contains(name) { return stores.has(name); } },
    createObjectStore(name, options) {
      if (!stores.has(name)) stores.set(name, { keyPath: options.keyPath, rows: new Map(), indexes: new Set() });
      return storeFacade(stores.get(name));
    },
    close() {},
    transaction(name) {
      const names = Array.isArray(name) ? name : [name];
      names.forEach(storeName => { if (!stores.has(storeName)) throw new Error('missing store ' + storeName); });
      const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
      let completionScheduled = false;
      function completeLater() {
        if (completionScheduled) return;
        completionScheduled = true;
        setTimeout(function() { if (tx.oncomplete) tx.oncomplete(); }, 0);
      }
      tx.objectStore = function(storeName) {
        const def = stores.get(storeName || names[0]);
        const facade = storeFacade(def);
        const put = facade.put;
        const del = facade.delete;
        facade.put = function(record) { const result = put(record); completeLater(); return result; };
        facade.delete = function(key) { const result = del(key); completeLater(); return result; };
        return facade;
      };
      return tx;
    }
  };
  return {
    stores,
    deletedIndexes,
    stats,
    open(_name, version) {
      const req = {};
      setTimeout(function() {
        const upgradeTx = { objectStore(name) { return storeFacade(stores.get(name)); } };
        if (req.onupgradeneeded) req.onupgradeneeded({ oldVersion: Number(options.oldVersion) || 0, target: { result: db, transaction: upgradeTx } });
        if (req.onsuccess) req.onsuccess({ target: { result: db } });
      }, 0);
      return req;
    }
  };
}

(async function() {
  let registeredHook = null;
  const primaryDb = fakeIndexedDB();
  const ctx = {
    console, Promise, Date, Math, JSON, Object, Array, Number,
    setTimeout, clearTimeout, structuredClone,
    crypto: { randomUUID: function() { return 'fixed-id'; } },
    indexedDB: primaryDb,
    EndTurnHooks: {
      register(phase, callback, name) {
        if (phase === 'after' && name === 'StateSnapshot.autoSave') registeredHook = callback;
      }
    },
    addEventListener() {}
  };
  ctx.window = ctx;
  ctx._tmLoadGen = 0;
  ctx._desktopAutoSaveFlushes = 0;
  let persistenceBuilds = 0;
  ctx._tmFlushDeferredDesktopAutoSave = function() { ctx._desktopAutoSaveFlushes++; };
  ctx._buildSaveState = function(options) {
    persistenceBuilds++;
    return { GM: clone(options.gm), P: clone(options.p || {}) };
  };
  let forkSeq = 0;
  ctx.fullLoadGame = function(payload, options) {
    ctx.GM = clone(payload.gameState.GM);
    ctx.P = clone(payload.gameState.P);
    if (!(options && options.preserveTimeline)) {
      const parentTimelineId = ctx.GM._timelineId;
      ctx.GM._parentTimelineId = parentTimelineId;
      ctx.GM._timelineId = 'tml_time_travel_fork_' + (++forkSeq) + '_12345678';
      ctx.GM._forkTurn = ctx.GM.turn;
      ctx.GM._timelineForkReason = options && options.source || 'load';
    }
    ctx._tmLoadGen++;
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);

  ok(registeredHook && typeof registeredHook === 'function', 'after hook 已注册');

  function expectedLegacyTimeline(campaignId) {
    let hash = 2166136261;
    for (let i = 0; i < campaignId.length; i++) {
      hash ^= campaignId.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'tml_legacy_' + (hash >>> 0).toString(16).padStart(8, '0') + '_' + campaignId;
  }
  const legacyCampaign = 'campaignLegacy';
  const legacyTimeline = expectedLegacyTimeline(legacyCampaign);
  const legacyDb = fakeIndexedDB({
    oldVersion: 2,
    records: [{
      id: legacyCampaign + ':4', campaignId: legacyCampaign, turn: 4, ts: 4, schema: 2,
      state: { GM: { _campaignId: legacyCampaign, turn: 4, marker: 'legacy-v2' }, P: { conf: { legacy: true } } }
    }]
  });
  const legacyCtx = {
    console, Promise, Date, Math, JSON, Object, Array, Number,
    setTimeout, clearTimeout, structuredClone,
    indexedDB: legacyDb,
    EndTurnHooks: { register() {} }, addEventListener() {},
    _buildSaveState(options) { return { GM: clone(options.gm), P: clone(options.p || {}) }; }
  };
  legacyCtx.window = legacyCtx;
  vm.createContext(legacyCtx);
  vm.runInContext(src, legacyCtx);
  await legacyCtx.StateSnapshot.list(legacyCampaign, legacyTimeline);
  await new Promise(resolve => setTimeout(resolve, 20));
  const migratedLegacy = await legacyCtx.StateSnapshot.load(4, legacyCampaign, legacyTimeline);
  ok(migratedLegacy && migratedLegacy.state.GM.marker === 'legacy-v2'
    && migratedLegacy.state.GM._timelineId === legacyTimeline
    && migratedLegacy.migrationState === 'legacy-v2',
  'v2 campaign-only snapshot migrates atomically into deterministic legacy timeline');
  ok(legacyDb.deletedIndexes.includes('campaignTurn'), 'v4 upgrade removes obsolete unique campaignTurn index');

  ctx.GM = { _campaignId: 'campA', _timelineId: 'tml_campA_12345678', turn: 1, marker: 'A1', customWorld: { deep: 11 }, shijiHistory: [{ turn: 1, a: 1 }], evtLog: [{ turn: 1 }] };
  ctx.P = { conf: { campaign: 'A' }, mapData: { a: 1 } };
  let r = await ctx.StateSnapshot.save(1);
  ok(r.ok === true, 'campA/T1 完整快照写入');
  const canonicalBuildsBefore = persistenceBuilds;
  const canonicalState = { GM: clone(ctx.GM), P: clone(ctx.P) };
  canonicalState.GM._campaignId = 'campCanonical';
  canonicalState.GM._timelineId = 'tml_canonical_12345678';
  canonicalState.GM.turn = 7;
  canonicalState.GM.marker = 'canonical-reuse';
  r = await ctx.StateSnapshot.save({
    canonicalState,
    campaignId: 'campCanonical',
    timelineId: 'tml_canonical_12345678',
    turn: 7
  });
  ok(r.ok === true && persistenceBuilds === canonicalBuildsBefore
    && (await ctx.StateSnapshot.load(7, 'campCanonical', 'tml_canonical_12345678')).state.GM.marker === 'canonical-reuse',
  '提供 canonical state 时快照直接复用，不再次构造或读取 live world');
  // 注入 100 个无关战役；当前列表必须继续只走 campaign+timeline 复合索引。
  const snapshotRows = primaryDb.stores.get('snapshots_v2').rows;
  for (let i = 0; i < 100; i++) {
    snapshotRows.set('noise-' + i, {
      id: 'noise-' + i, campaignId: 'noise-campaign-' + i, timelineId: 'tml_noise_' + String(i).padStart(8, '0'),
      turn: i, ts: i, state: { GM: { turn: i }, P: {} }
    });
  }

  ctx.GM.turn = 2; ctx.GM.marker = 'A2'; ctx.GM.customWorld.deep = 22;
  ctx.GM.shijiHistory.push({ turn: 2, a: 2 }); ctx.P.mapData.a = 2;
  r = await ctx.StateSnapshot.save(2);
  ok(r.ok === true && (await ctx.StateSnapshot.list()).length === 2, '同局多回合可列出');

  ctx.GM = {
    _campaignId: 'campA', _timelineId: 'tml_childA_12345678', _parentTimelineId: 'tml_campA_12345678',
    _forkTurn: 2, turn: 2, marker: 'A2-child', customWorld: { deep: 23 }, shijiHistory: [], evtLog: []
  };
  ctx.P = { conf: { campaign: 'A-child' }, mapData: { a: 23 } };
  const inheritedList = await ctx.StateSnapshot.list();
  const inheritedA1 = await ctx.StateSnapshot.load(1);
  ok(inheritedList.map(item => item.turn).join(',') === '1,2'
    && inheritedList.every(item => item.inherited === true)
    && inheritedA1 && inheritedA1.inherited === true && inheritedA1.state.GM.marker === 'A1',
  '子时间线以父链只读继承 forkTurn 以前的完整快照列表');
  const inheritedDelete = await ctx.StateSnapshot.delete(1);
  ok(inheritedDelete.ok === false && inheritedDelete.reason === 'inherited-readonly'
    && (await ctx.StateSnapshot.load(1)).state.GM.marker === 'A1',
  '继承快照明确只读，删除请求不得伪装成功或影响祖先记录');
  r = await ctx.StateSnapshot.save(2);
  const childOverrideList = await ctx.StateSnapshot.list();
  ok(r.ok === true && childOverrideList[0].inherited === true && childOverrideList[1].inherited === false
    && (await ctx.StateSnapshot.load(2)).state.GM.marker === 'A2-child',
  '子时间线同回合快照覆盖父线视图但不复制其他祖先 payload');

  // A → B → C：中间时间线 B 尚未生成任何快照，C 仍须沿独立 timeline graph 继承 A。
  ctx.GM = {
    _campaignId: 'campA', _timelineId: 'tml_empty_middle_B_12345678', _parentTimelineId: 'tml_campA_12345678',
    _forkTurn: 2, turn: 2, marker: 'B-no-snapshot', shijiHistory: [], evtLog: []
  };
  await ctx.StateSnapshot.recordTimeline(ctx.GM);
  ctx.GM = {
    _campaignId: 'campA', _timelineId: 'tml_deep_child_C_12345678', _parentTimelineId: 'tml_empty_middle_B_12345678',
    _forkTurn: 2, turn: 2, marker: 'C-live', shijiHistory: [], evtLog: []
  };
  await ctx.StateSnapshot.recordTimeline(ctx.GM);
  const deepInherited = await ctx.StateSnapshot.list('campA', 'tml_deep_child_C_12345678');
  ok(deepInherited.map(item => item.turn).join(',') === '1,2'
    && deepInherited.every(item => item.inherited === true && item.sourceTimelineId === 'tml_campA_12345678'),
  'A→B→C 且 B 无快照时，C 仍通过独立 timeline graph 继承 A 的 forkTurn 前快照');

  ctx.GM = { _campaignId: 'campB', _timelineId: 'tml_campB_12345678', turn: 1, marker: 'B1', customWorld: { deep: 99 }, shijiHistory: [], evtLog: [] };
  ctx.P = { conf: { campaign: 'B' } };
  r = await ctx.StateSnapshot.save(1);
  const listB = await ctx.StateSnapshot.list();
  const b1 = await ctx.StateSnapshot.load(1);
  const a1 = await ctx.StateSnapshot.load(1, 'campA', 'tml_campA_12345678');
  ok(r.ok === true && listB.length === 1 && b1.state.GM.marker === 'B1', '同回合不同 campaign 不覆盖、默认列表只见当前局');
  ok(a1.state.GM.marker === 'A1' && a1.state.P.conf.campaign === 'A', '显式 campaign 可读回原局快照');

  // 回到 campA/T2，再穿越 T1；未在旧 partial 白名单里的 customWorld/P.mapData 也必须恢复。
  ctx.GM = { _campaignId: 'campA', _timelineId: 'tml_campA_12345678', turn: 2, marker: 'A2-live', customWorld: { deep: 222 }, shijiHistory: [{ turn: 2, current: true }], evtLog: [{ turn: 2 }] };
  ctx.P = { conf: { campaign: 'A-live' }, mapData: { a: 222 } };
  ctx._tmLoadGen++;
  r = await ctx.StateSnapshot.timeTravel(1);
  ok(r.ok === true && ctx.GM.turn === 1 && ctx.GM.marker === 'A1', 'timeTravel 恢复目标回合身份');
  ok(ctx.GM.customWorld.deep === 11 && ctx.P.mapData.a === 1 && ctx.P.conf.campaign === 'A', '完整 GM/P 恢复，不叠加当前局字段');
  ok(ctx.GM.shijiHistory.length === 1 && ctx.GM.shijiHistory[0].turn === 1, '默认使用目标快照历史，不覆盖当前历史');
  ok(!ctx.GM._postTurnJobs && !ctx.GM._turnAiResults, '恢复后清理临时任务');
  const forkedTimeline = ctx.GM._timelineId;
  const forkedSnapshots = await ctx.StateSnapshot.list('campA', forkedTimeline);
  const forkedReturn = await ctx.StateSnapshot.load(2, 'campA', forkedTimeline);
  ok(forkedTimeline !== 'tml_campA_12345678' && ctx.GM._parentTimelineId === 'tml_campA_12345678',
    'timeTravel 恢复目标后建立明确的子时间线');
  ok(forkedSnapshots.map(item => item.turn).join(',') === '1,2'
    && forkedReturn.state.GM._timelineId === forkedTimeline && forkedReturn.state.GM.marker === 'A2-live',
  '子时间线同时继承目标快照和返航点，分支隔离不破坏返回能力');

  // 异步读取期间换局：旧请求必须失效，不能覆盖新局。
  ctx.GM = { _campaignId: 'campA', _timelineId: 'tml_campA_12345678', turn: 2, marker: 'source-before-stale', shijiHistory: [], evtLog: [] };
  ctx.P = { conf: { campaign: 'A' } };
  ctx._tmLoadGen++;
  const flushesBeforeStaleTravel = ctx._desktopAutoSaveFlushes;
  const pending = ctx.StateSnapshot.timeTravel(1);
  ok(ctx._tmActiveTimeTravelTransaction && ctx._tmActiveTimeTravelTransaction.fromTurn === 2,
    'timeTravel 异步读取开始前发布统一世界事务标志');
  ctx.GM = { _campaignId: 'campB', _timelineId: 'tml_campB_12345678', turn: 1, marker: 'new-live', shijiHistory: [], evtLog: [] };
  ctx.P = { conf: { campaign: 'B' } };
  ctx._tmLoadGen++;
  r = await pending;
  ok(r.ok === false && /stale game/.test(r.reason) && ctx.GM.marker === 'new-live', '跨异步边界换局后拒绝旧 timeTravel');
  ok(!ctx._tmActiveTimeTravelTransaction && ctx._desktopAutoSaveFlushes === flushesBeforeStaleTravel + 1,
    'timeTravel 所有结束路径都清事务标志并通知 deferred 自动档');

  // hook 返回真实 Promise；EndTurnHooks.execute 可 await 落库完成。
  ctx.GM = { _campaignId: 'campHook', _timelineId: 'tml_campHook_12345678', turn: 3, marker: 'hook', shijiHistory: [], evtLog: [] };
  ctx.P = { conf: {} };
  const hookResult = registeredHook();
  ok(hookResult && typeof hookResult.then === 'function', '自动快照 hook 返回 Promise');
  r = await hookResult;
  ok(r.ok === true && (await ctx.StateSnapshot.load(3)).state.GM.marker === 'hook', 'await hook 后快照已落库');

  // 真实触发 200 条上限；清理阶段只能取主键，不得读取/克隆 205 份完整 state。
  const lruCampaign = 'campLRU';
  const lruTimeline = 'tml_lru_12345678';
  for (let turn = 0; turn < 205; turn++) {
    snapshotRows.set(lruCampaign + ':' + lruTimeline + ':' + turn, {
      id: lruCampaign + ':' + lruTimeline + ':' + turn,
      campaignId: lruCampaign,
      timelineId: lruTimeline,
      turn,
      ts: turn,
      state: { GM: { _campaignId: lruCampaign, _timelineId: lruTimeline, turn, payload: 'x'.repeat(256) }, P: {} }
    });
  }
  const fullReadsBeforeLRU = primaryDb.stats.fullStoreGetAll;
  r = await ctx.StateSnapshot.save({
    canonicalState: { GM: { _campaignId: lruCampaign, _timelineId: lruTimeline, turn: 205 }, P: {} },
    campaignId: lruCampaign,
    timelineId: lruTimeline,
    turn: 205
  });
  const lruRows = Array.from(snapshotRows.values()).filter(record => record.campaignId === lruCampaign && record.timelineId === lruTimeline);
  ok(r.ok === true && lruRows.length === 200 && Math.min.apply(null, lruRows.map(record => record.turn)) === 6
    && primaryDb.stats.fullStoreGetAll === fullReadsBeforeLRU,
  '205 条真实 payload 的 LRU 只读 keys 并精确保留最新 200 条');

  ok(primaryDb.stats.indexGetAll > 0 && primaryDb.stats.indexGetAllKeys > 0 && primaryDb.stats.fullStoreGetAll === 0
    && !/objectStore\(STORE\)\.getAll\(\)/.test(src) && !/objectStore\(LINEAGE_STORE\)\.getAll\(\)/.test(src),
  '多战役快照列表按复合索引、keys-only LRU 和谱系主键读取，不执行全库 getAll');

  console.log('\n[smoke-state-snapshot-integrity] pass=' + pass);
})().catch(function(e) {
  console.error(e && e.stack || e);
  process.exit(1);
});

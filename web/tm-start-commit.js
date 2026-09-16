// One native-start commit, using the existing load rollback owner and canonical slot transaction.
(function (root) {
  'use strict';
  var active = null,
    used = new Set();
  function fail(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
  }
  function current(lease) {
    return (
      root.GM === lease.gm &&
      root.P === lease.p &&
      Number(root._tmStartRequestEpoch || 0) === lease.epoch &&
      (lease.turn === undefined || root.GM.turn === lease.turn) &&
      (lease.loadGen === undefined || Number(root._tmLoadGen || 0) === lease.loadGen)
    );
  }
  async function sourceCurrent(lease, compiler) {
    if (!lease.sourceScenario) return;
    var s = (lease.p.scenarios || []).find(function (s) {
      return s.id === lease.sourceScenario.id;
    });
    if (
      s !== lease.sourceScenario ||
      (await compiler.sha256(new root.TextEncoder().encode(JSON.stringify(s)))) !== lease.sourceHash
    )
      throw fail('native-source-changed', '选择期间源剧本已更新，请重新打开选择；未提交旧候选');
  }
  async function commit(prepared, lease) {
    if (active) throw fail('native-commit-busy', '已有新局正在提交');
    if (!prepared || prepared.status !== 'initialized-not-committed' || !lease || !current(lease))
      throw fail('native-commit-stale', '开局准备已过期，当前世界未改动');
    if (used.has(prepared.requestId)) throw fail('native-commit-reentry', '该新局已经提交过');
    var tm = root.TM || {},
      compiler = tm.StartCompiler;
    if (
      !compiler ||
      !tm.NativeWorld ||
      typeof root.fullLoadGame !== 'function' ||
      typeof root._buildSaveState !== 'function' ||
      !root.TM_SaveDB ||
      !root.TM_SaveDB.saveManyAtomic
    )
      throw fail('native-commit-unavailable', '原生提交或本地存储不可用');
    var operation = { requestId: prepared.requestId };
    active = operation;
    try {
      var bytes = new root.TextEncoder().encode(prepared.snapshotText);
      if (bytes.byteLength !== prepared.byteLength || (await compiler.sha256(bytes)) !== prepared.snapshotHash)
        throw fail('native-commit-hash', '准备快照字节已改变，未提交');
      if (!current(lease)) throw fail('native-commit-stale', '验证期间已切换世界');
      var snapshot = JSON.parse(prepared.snapshotText);
      await tm.NativeWorld.validateSnapshot(snapshot.GM);
      await sourceCurrent(lease, compiler);
      if (!current(lease)) throw fail('native-commit-stale', '验证期间已切换世界');
      // Keep the real catalog: the private initializer holds only one selected candidate.
      // It must never replace the user's scenario library or persist a derived copy per profile.
      snapshot.P.ai = JSON.parse(JSON.stringify(lease.p.ai || {}));
      var transactionId = 'native-start:' + prepared.requestId,
        receipt = null;
      await root.fullLoadGame(
        { gameState: snapshot },
        {
          source: 'native-start',
          preserveTimeline: true,
          nativeStart: true,
          beforeCommit: async function (state) {
            var targetG = state.GM,
              targetP = state.P;
            targetP.scenarios = lease.p.scenarios;
            function guard() {
              return (
                active === operation &&
                root.GM === targetG &&
                root.P === targetP &&
                root._tmActiveLoadTransaction === state.transaction &&
                Number(root._tmStartRequestEpoch || 0) === lease.epoch
              );
            }
            if (!guard()) throw fail('native-commit-stale', '新局提交租约失效');
            var saved = root._buildSaveState({ format: 'idb', detach: true, gm: targetG, p: targetP });
            saved.GM.busy = false;
            delete saved.GM._loadHydrationPending;
            var identity = {
              campaignId: String(saved.GM._campaignId),
              timelineId: String(saved.GM._timelineId),
              turn: saved.GM.turn,
              transactionId: transactionId,
              schemaVersion: 1,
            };
            var payload = await root.TM_SaveDB.createCanonicalPayload(saved, identity);
            var ok = await root.TM_SaveDB.saveManyAtomic(
              [
                {
                  id: 'autosave',
                  gameState: saved,
                  canonicalPayload: payload,
                  meta: {
                    turn: saved.GM.turn,
                    source: 'native-start',
                    nativeStartProfile: saved.GM.startContext.startProfileId,
                  },
                },
                {
                  id: 'slot_0',
                  gameState: saved,
                  canonicalPayload: payload,
                  meta: {
                    turn: saved.GM.turn,
                    source: 'native-start',
                    nativeStartProfile: saved.GM.startContext.startProfileId,
                  },
                },
              ],
              { transactionId: transactionId, writeGuard: guard },
            );
            if (ok !== true) throw fail('native-save-failed', '新局存档未原子提交，正在恢复旧世界');
            // The IDB transaction is the durable commit point. No further fallible work belongs here.
            receipt = {
              status: 'started',
              requestId: prepared.requestId,
              transactionId: transactionId,
              profileId: saved.GM.startContext.startProfileId,
              characterId: saved.GM.playerCharacterId,
              factionId: saved.GM.startContext.playerFactionId,
              canonicalSaved: true,
            };
          },
        },
      );
      if (!receipt) throw fail('native-commit-not-confirmed', '原生加载未到达存档提交点');
      used.add(prepared.requestId);
      if (used.size > 128) used.delete(used.values().next().value);
      return receipt;
    } finally {
      if (active === operation) active = null;
    }
  }
  root.TM = root.TM || {};
  root.TM.StartCommit = {
    commit: commit,
    busy: function () {
      return !!active;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

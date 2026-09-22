// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// EndTurn 渲染模块（从 tm-endturn.js 拆分）
// 包含：_endTurn_finalizeRecords（事务内状态落账）、_endTurn_render（commit 后纯 UI）、Delta面板等
// Requires: tm-endturn.js (must load before this file)
//
// 2026-07-06 重做：弹窗 HTML 组装全部迁至 tm-endturn-shiji-compose.js（御览分卷）。
// 本文件把记录落账与 UI 明确分层：digest/风闻/史记/起居注/指标属于事务内 finalization；
// DOM、动画和提示只在 canonical 存档 commit 后运行。组装函数纯读零写·弹窗结构见 compose 文件头。
// Domain: 回合结果展示 (战况 / 兵备 / 财政 / 起居)
// Refactor notes:
//   Phase 3·**Codex own·Claude review at merge** (我刚 #5 加 affectedArmies/militarySystems)
//   Phase 5·namespace TM.Endturn.Render
// 见 web/docs/architecture-map.md §1 行 7
//   §8 [L1300] 自动存档触发 + meta 写入
//   §9 [L1600] 角色高亮工具 + 史官弹窗
// ============================================================

function _clearPreEndturnMarkerAfterSave(expectedId) {
  try {
    if (expectedId == null) expectedId = (typeof window !== 'undefined') ? window._tmActivePreEndturnSnapshotId : '';
    var raw = localStorage.getItem('tm_pre_endturn_mark');
    var marker = raw ? JSON.parse(raw) : null;
    // 异步旧 autosave 不得清掉后起回合的 marker。
    if (expectedId && marker && marker.snapshotId && marker.snapshotId !== expectedId) return false;
    localStorage.removeItem('tm_pre_endturn_mark');
    if (typeof window !== 'undefined') window._tmActivePreEndturnSnapshotId = '';
    return true;
  } catch (_) { return false; }
}

function _endTurn_stripCommittedDraftsFromSnapshot(snapshot) {
  var snapGM = snapshot && snapshot.GM;
  if (!snapGM || typeof snapGM !== 'object') return snapshot;
  try { delete snapGM._savedEdictDrafts; } catch (_) {}
  if (snapGM._phase8FormalDrafts && typeof snapGM._phase8FormalDrafts === 'object') {
    snapGM._phase8FormalDrafts.edictDraft = [];
    snapGM._phase8FormalDrafts.edictDrafts = {};
    snapGM._phase8FormalDrafts.playerAction = '';
  }
  return snapshot;
}

async function _endTurn_stateChecksum(snapshot, canonicalPayload) {
  if (canonicalPayload && canonicalPayload.state === snapshot && canonicalPayload.checksum) {
    return canonicalPayload.checksum;
  }
  var json = JSON.stringify(snapshot);
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
      return Array.prototype.map.call(new Uint8Array(digest), function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
  } catch (_) {}
  var hash = 2166136261;
  for (var i = 0; i < json.length; i++) { hash ^= json.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
}

async function _endTurn_stageTurnData(ctx, snapshot, canonicalPayload) {
  ctx = ctx || { meta: {} };
  ctx.meta = ctx.meta || {};
  var presentation = ctx.meta.turnPresentation;
  if (!(window.tianming && window.tianming.isDesktop && GM.saveName && presentation && presentation.turnData)) return true;
  if (typeof window.tianming.stageTurnData !== 'function') throw new Error('桌面回合分卷暂存接口缺失');
  if (window.tianming.turnDataProtocolVersion !== 2) throw new Error('分卷时间线协议需要更新桌面安装包');
  var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;
  if (!reliability || typeof reliability.callTurnBridge !== 'function') throw new Error('桌面分卷等待管理未加载');
  var stageBridge = window.tianming, stageGM = GM, stageP = P, stageTurn = GM.turn, stageName = GM.saveName, stageGen = window._tmLoadGen || 0;
  var stageCampaign = String(GM._campaignId || ''), stageTimeline = String(GM._timelineId || '');
  function stageLeaseCurrent() { return window.tianming === stageBridge && GM === stageGM && P === stageP && GM.turn === stageTurn && GM.saveName === stageName && (window._tmLoadGen || 0) === stageGen && String(GM._campaignId || '') === stageCampaign && String(GM._timelineId || '') === stageTimeline; }
  var checksum = await _endTurn_stateChecksum(snapshot, canonicalPayload);
  if (!stageLeaseCurrent()) throw new Error('分卷校验期间世界已改变，未发送旧数据');
  var marker = {
    protocolVersion: 2,
    saveName: GM.saveName,
    turn: GM.turn - 1,
    campaignId: String(GM._campaignId || ''),
    timelineId: String(GM._timelineId || ''),
    transactionId: String(ctx.meta.transactionId || ''),
    stateChecksum: checksum
  };
  var result = await reliability.callTurnBridge('stageTurnData', Object.assign({ data: presentation.turnData }, marker), { isCurrent: stageLeaseCurrent });
  if (!(result && result.success === true)) throw new Error('回合分卷暂存失败' + (result && result.error ? '：' + result.error : ''));
  ctx.meta.stagedTurnData = marker;
  return true;
}

async function _endTurn_discardStagedTurnData(ctx) {
  var marker = ctx && ctx.meta && ctx.meta.stagedTurnData;
  if (!marker) return true;
  var receipt = ctx.meta.canonicalSaveReceipt || (ctx.meta.transaction && ctx.meta.transaction.canonicalSaveReceipt);
  if (receipt && receipt.state === 'committed') throw new Error('主存档已提交，禁止丢弃待发布分卷');
  var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;
  if (!reliability || typeof reliability.callTurnBridge !== 'function') throw new Error('桌面分卷等待管理未加载');
  var gm = GM, p = P, generation = window._tmLoadGen || 0;
  function current() { return GM === gm && P === p && (window._tmLoadGen || 0) === generation && ctx.meta.stagedTurnData === marker; }
  var result = await reliability.callTurnBridge('discardTurnData', marker, { isCurrent: current });
  if (!result || result.success !== true) throw new Error('分卷丢弃未确认，保留原有恢复信息');
  if (typeof TM_SaveDB !== 'undefined' && TM_SaveDB && typeof TM_SaveDB.deleteTurnPublishReceipt === 'function') {
    if (await TM_SaveDB.deleteTurnPublishReceipt(marker, { writeGuard: current }) !== true) throw new Error('分卷已丢弃但回执清理失败');
  }
  if (!current()) throw new Error('丢弃分卷期间世界已改变');
  ctx.meta.stagedTurnData = null;
  return true;
}

async function _endTurn_publishStagedTurnData(ctx) {
  var marker = ctx && ctx.meta && ctx.meta.stagedTurnData;
  if (!marker) return true;
  if (!(window.tianming && typeof window.tianming.publishTurnData === 'function')) throw new Error('桌面回合分卷发布接口缺失');
  var targetGM = GM;
  var targetP = P;
  var targetLoadGen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
  function publishLeaseCurrent() {
    return GM === targetGM && P === targetP &&
      (((typeof window !== 'undefined' && window._tmLoadGen) || 0) === targetLoadGen) &&
      String((GM && GM._campaignId) || '') === String(marker.campaignId || '') &&
      String((GM && GM._timelineId) || '') === String(marker.timelineId || '');
  }
  var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;
  if (!reliability || typeof reliability.callTurnBridge !== 'function') throw new Error('桌面分卷等待管理未加载');
  var result = await reliability.callTurnBridge('publishTurnData', marker, { isCurrent: publishLeaseCurrent });
  if (!(result && result.success === true)) throw new Error('回合分卷发布失败' + (result && result.error ? '：' + result.error : ''));
  if (!publishLeaseCurrent()) throw new Error('回合分卷发布完成时世界身份已变化');
  if (!(typeof TM_SaveDB !== 'undefined' && TM_SaveDB && typeof TM_SaveDB.deleteTurnPublishReceipt === 'function')) {
    throw new Error('回合分卷 receipt 清理接口缺失');
  }
  var cleared = await TM_SaveDB.deleteTurnPublishReceipt(marker, { writeGuard: publishLeaseCurrent });
  if (cleared !== true) {
    throw new Error('回合分卷已发布，但 receipt 清理失败');
  }
  if (!publishLeaseCurrent()) throw new Error('回合分卷清理结束时世界身份已变化');
  ctx.meta.stagedTurnData = null;
  return true;
}

// 回合存档唯一入口：必须由 core 在全部状态写入和记录最终化后触发。
// autosave/slot_0 共用一个数据库事务；桌面分卷只在该事务提交后发布。
function _endTurn_saveSnapshot(ctx) {
  if (typeof TM_SaveDB === 'undefined' || typeof TM_SaveDB.saveManyAtomic !== 'function' || typeof _buildSaveState !== 'function') return Promise.resolve(false);
  ctx = ctx || { meta: {} };
  ctx.meta = ctx.meta || {};
  var _endturnSaveGM = GM;
  var _endturnSaveP = P;
  var _endturnSaveLoadGen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
  var _endturnSaveTurn = GM.turn;
  var _endturnSaveSid = GM.sid;
  var _endturnSavePreId = (typeof window !== 'undefined' && window._tmActivePreEndturnSnapshotId) || '';
  var _endturnSaveStillCurrent = function() {
    var _liveGen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
    var _livePreId = (typeof window !== 'undefined' && window._tmActivePreEndturnSnapshotId) || '';
    return GM === _endturnSaveGM && P === _endturnSaveP
      && _liveGen === _endturnSaveLoadGen
      && GM.turn === _endturnSaveTurn && GM.sid === _endturnSaveSid
      && (!_livePreId || _livePreId === _endturnSavePreId);
  };
  return (async function() {
    var _canonicalCommitted = false;
    var _snapshotTask = null;
    function _saveWarning(stage, error) {
      var warnings = ctx.meta.turnSaveWarnings || (ctx.meta.turnSaveWarnings = []);
      if (!warnings.some(function(w) { return w.stage === stage; })) warnings.push({ stage: stage, code: String(error && (error.code || error.name) || 'auxiliary-failure').slice(0, 80) });
      try { console.warn('[AutoSave] 主存档已提交，附加步骤失败：' + stage, error); } catch (_) {}
    }
    function _receiptMatches(receipt) {
      return receipt && receipt.state === 'committed' && receipt.transactionId === String(ctx.meta.transactionId || '')
        && Array.isArray(receipt.slots) && receipt.slots.length === 2
        && ['autosave', 'slot_0'].every(function(id) { return receipt.slots.some(function(slot) {
          return slot.id === id && slot.turn === _endturnSaveTurn && slot.campaignId === _canonicalIdentity.campaignId && slot.timelineId === _canonicalIdentity.timelineId;
        }); });
    }
    function _acceptCommit(receipt) {
      if (_canonicalCommitted || !_receiptMatches(receipt)) return;
      _canonicalCommitted = true;
      ctx.meta.canonicalSaveReceipt = receipt;
      if (ctx.meta.transaction) ctx.meta.transaction.canonicalSaveReceipt = receipt;
      ctx.meta.canonicalWorldSnapshot = _autoState;
      ctx.meta.canonicalWorldSnapshotMeta = { turn: _endturnSaveTurn, transactionId: String(ctx.meta.transactionId || ''), takeOwnership: true };
      if (!_endturnSaveStillCurrent()) return;
      _snapshotTask = Promise.resolve().then(function() {
        if (typeof StateSnapshot === 'undefined' || !StateSnapshot || typeof StateSnapshot.save !== 'function') return { ok: true, skipped: true };
        return StateSnapshot.save({ canonicalState: _autoState, canonicalPayload: _canonicalPayload, campaignId: _canonicalIdentity.campaignId, timelineId: _canonicalIdentity.timelineId, turn: _endturnSaveTurn });
      }).then(function(result) {
        if (result && result.ok === true) return;
        _saveWarning('time-snapshot', result && result.error);
      }, function(error) { _saveWarning('time-snapshot', error); });
    }

    try {
      if (typeof _awaitPostTurnJobsForSave === 'function') {
        Promise.resolve().then(function(){return _awaitPostTurnJobsForSave(typeof _postTurnSaveRequiredIds === 'function' ? _postTurnSaveRequiredIds() : ['sc25', 'sc25c']);}).then(function(){
          if(_endturnSaveStillCurrent()&&typeof requestBackgroundAutosave==='function')return requestBackgroundAutosave({reason:'post-turn-memory-complete',expectedTurn:_endturnSaveTurn});
        }).catch(function(error){
          if(window.TM&&TM.Endturn&&TM.Endturn.Validity)TM.Endturn.Validity.defer(ctx,'后台记忆',error);
          else console.warn('[EndturnDeferred] 后台记忆待补正:',error.message);
        });
      }
      if (!_endturnSaveStillCurrent()) return false;
      try { if (typeof _wtRunFulfillAudit === 'function') _wtRunFulfillAudit(); } catch (_wtFaHkE) {}
      var _autoT0 = Date.now();
      var _canonicalSpan = (typeof TM !== 'undefined' && TM.perf && typeof TM.perf.beginSpan === 'function')
        ? TM.perf.beginSpan('endturn.finalCanonicalBuild', { transactionId: ctx.meta.transactionId || '' }) : null;
      var _autoState;
      try {
        _autoState = _buildSaveState({format:'idb',detach:true,gm:_endturnSaveGM,p:_endturnSaveP});
      } catch (_canonicalBuildError) {
        if (_canonicalSpan && TM.perf && typeof TM.perf.endSpan === 'function') TM.perf.endSpan(_canonicalSpan, { ok:false, error:_canonicalBuildError.message || String(_canonicalBuildError) });
        throw _canonicalBuildError;
      }
      _endTurn_stripCommittedDraftsFromSnapshot(_autoState);
      if (_canonicalSpan && TM.perf && typeof TM.perf.endSpan === 'function') TM.perf.endSpan(_canonicalSpan, { ok:true });
      var _captureSession = ctx.meta.transaction && ctx.meta.transaction.captureSession;
      if (_captureSession) _captureSession.finalCanonicalState = _autoState;
      var _canonicalIdentity = {
        campaignId: String(_endturnSaveGM._campaignId || ''),
        timelineId: String(_endturnSaveGM._timelineId || ''),
        turn: _endturnSaveTurn,
        transactionId: String(ctx.meta.transactionId || ''),
        schemaVersion: 1
      };
      var _canonicalPayload;
      if (typeof TM_SaveDB.createCanonicalPayload === 'function') {
        _canonicalPayload = await TM_SaveDB.createCanonicalPayload(_autoState, _canonicalIdentity);
      } else {
        // Compatibility for embedders/tests that provide the older SaveDB surface.
        var _canonicalJson = JSON.stringify(_autoState);
        _canonicalPayload = {
          identity: _canonicalIdentity,
          state: _autoState,
          json: _canonicalJson,
          jsonByteLength: _canonicalJson.length,
          checksum: await _endTurn_stateChecksum(_autoState),
          compressed: _canonicalJson,
          compressedByteLength: _canonicalJson.length
        };
      }
      if (_captureSession) _captureSession.finalPayload = _canonicalPayload;
      ctx.meta.canonicalWorldPayload = _canonicalPayload;
      try { await _endTurn_stageTurnData(ctx, _autoState, _canonicalPayload); }
      catch(auxiliaryError){
        if(!_endturnSaveStillCurrent())throw auxiliaryError;
        ctx.meta.stagedTurnData=null;
        var deferredData={transactionId:String(ctx.meta.transactionId||''),turn:_endturnSaveTurn-1,reason:String(auxiliaryError.message||auxiliaryError)};
        try{deferredData.data=JSON.parse(JSON.stringify(ctx.meta.turnPresentation&&ctx.meta.turnPresentation.turnData||{}));}catch(_){deferredData.dataUnavailable=true;}
        var pending=Array.isArray(_autoState.GM._deferredTurnData)?_autoState.GM._deferredTurnData.filter(function(row){return row.transactionId!==deferredData.transactionId;}):[];
        pending.push(deferredData);_autoState.GM._deferredTurnData=pending; // arch-ok: canonical snapshot owner retains complete auxiliary output for later repair.
        _endturnSaveGM._deferredTurnData=pending; // arch-ok: same-world save owner retains the same pending auxiliary output in live state.
        if(typeof TM_SaveDB.createCanonicalPayload==='function')_canonicalPayload=await TM_SaveDB.createCanonicalPayload(_autoState,_canonicalIdentity);
        else{var deferredJson=JSON.stringify(_autoState);_canonicalPayload={identity:_canonicalIdentity,state:_autoState,json:deferredJson,compressed:deferredJson,checksum:await _endTurn_stateChecksum(_autoState)};}
        ctx.meta.canonicalWorldPayload=_canonicalPayload;if(_captureSession)_captureSession.finalPayload=_canonicalPayload;
        var stageWarnings=ctx.meta.turnSaveWarnings||(ctx.meta.turnSaveWarnings=[]);stageWarnings.push({stage:'turn-data',code:String(auxiliaryError.code||'auxiliary-turn-data-failed')});
        console.warn('[EndturnDeferred] 附加分卷未完成，原文随主存档保留:',auxiliaryError.message);
      }
      var _autoSnapMs = Date.now() - _autoT0;
      if (_autoSnapMs > 800) console.warn('[AutoSave] 端回合 snapshot 耗 '+_autoSnapMs+'ms·考虑 A-2');
      var _sc3 = typeof findScenarioById === 'function' ? findScenarioById(_endturnSaveSid) : null;
      var _autoMeta = {
        name: '自动封存·' + (typeof getTSText==='function'?getTSText(_endturnSaveTurn):'T'+_endturnSaveTurn),
        type: 'auto', turn: _endturnSaveTurn,
        scenarioName: _sc3 ? _sc3.name : '', eraName: _endturnSaveGM.eraName || ''
      };
      ctx.meta.acceptReconciledCommit = async function() {
        if (!_endturnSaveStillCurrent()) throw new Error('核对后的保存不再属于当前世界');
        _acceptCommit({ state: 'committed', transactionId: String(ctx.meta.transactionId || ''), slots: ['autosave','slot_0'].map(function(id) {
          return { id: id, turn: _endturnSaveTurn, campaignId: _canonicalIdentity.campaignId, timelineId: _canonicalIdentity.timelineId };
        }) });
        if (!_canonicalCommitted) throw new Error('无法确认恢复后的主存档回执');
        await _snapshotTask;
        if (!_endturnSaveStillCurrent()) throw new Error('附加快照期间世界已变化');
        try { _clearPreEndturnMarkerAfterSave(_endturnSavePreId); } catch (_) {}
        try { if (typeof _updateSaveIndex === 'function') _updateSaveIndex(0, _autoMeta); } catch (_) {}
        try { localStorage.setItem('tm_autosave_mark', JSON.stringify({ turn: _autoMeta.turn, timestamp: Date.now(), scenarioName: _autoMeta.scenarioName, eraName: _autoMeta.eraName })); }
        catch (_) { /* The verified canonical slots remain authoritative if a UI marker cannot be persisted. */ }
      };
      var _autoWriteOptions = {
        writeGuard: _endturnSaveStillCurrent,
        onCommitted: _acceptCommit,
        turnPublishReceipt: ctx.meta.stagedTurnData || null
      };
      var _writeOk = await TM_SaveDB.saveManyAtomic([
        { id: 'autosave', gameState: _autoState, canonicalPayload: _canonicalPayload, meta: _autoMeta },
        { id: 'slot_0', gameState: _autoState, canonicalPayload: _canonicalPayload, meta: _autoMeta }
      ], Object.assign({ transactionId: String(ctx.meta.transactionId || '') }, _autoWriteOptions));
      if (_writeOk !== true && !_canonicalCommitted) throw new Error('canonical 回合存档未原子落库');
      if (!_canonicalCommitted) _acceptCommit({ state: 'committed', transactionId: String(ctx.meta.transactionId || ''), slots: ['autosave', 'slot_0'].map(function(id) {
        return { id: id, turn: _endturnSaveTurn, campaignId: _canonicalIdentity.campaignId, timelineId: _canonicalIdentity.timelineId };
      }) });
      if (!_endturnSaveStillCurrent()) { ctx.meta.stagedTurnData = null; return false; }
      await _snapshotTask;
      if (!_endturnSaveStillCurrent()) { ctx.meta.stagedTurnData = null; return false; }
      // 两个 canonical 槽位都提交后，才清恢复点并发布“已安全保存”标志。
      try { _clearPreEndturnMarkerAfterSave(_endturnSavePreId); } catch (_) {}
      try { if (typeof _updateSaveIndex === 'function') _updateSaveIndex(0, _autoMeta); } catch (_) {}
      try {
        localStorage.setItem('tm_autosave_mark', JSON.stringify({
          turn: _autoMeta.turn, timestamp: Date.now(),
          scenarioName: _autoMeta.scenarioName, eraName: _autoMeta.eraName
        }));
      } catch(e) {
        try { window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn-render'); } catch(_) {}
      }
      return true;
    } catch(e) {
      console.warn('[AutoSave] post-turn save failed:', e);
      if (e && e.code === 'SAVE_WRITE_UNCONFIRMED' && !_canonicalCommitted) {
        ctx.meta.saveWriteUnconfirmed = true;
        if (ctx.meta.transaction) ctx.meta.transaction.saveWriteUnconfirmed = true;
        throw e; // Do not discard staged data or infer rollback before the storage result is known.
      }
      if (!_canonicalCommitted) {
        try { await _endTurn_discardStagedTurnData(ctx); } catch (_discardE) { console.warn('[AutoSave] discard staged turn-data failed:', _discardE); }
      } else {
        _saveWarning('post-commit', e);
        await _snapshotTask;
        if (_endturnSaveStillCurrent()) return true;
        // 世界已与 receipt 同事务落库；若此刻恰好跨档，只保留 staging 供该战役下次加载补发。
        ctx.meta.stagedTurnData = null;
      }
      return false;
    }
  })();
}

// 世界态变更摘要——把本回合 turnChanges（已满）+ 当下势力虚实压成一小段纯文本，
// 存 GM._lastTurnDigest，供下回合 tm-endturn-prompt.js 层1 注入给 AI。
// 朝代中立：只读 name/owner/strength/morale/soldiers 等通用运行时字段，不写死任何朝代专名。
function buildWorldChangeDigest() {
  if (typeof GM === 'undefined' || !GM) return '';
  var tc = GM.turnChanges;
  var CAP = 5;
  var sections = [];

  // 1. 疆土易主（map 桶：扁平 {regionName, field, oldValue, newValue, reason}）
  if (tc && Array.isArray(tc.map) && tc.map.length) {
    var terr = [];
    tc.map.forEach(function(m) {
      if (m && m.field === 'owner') {
        terr.push('· ' + (m.regionName || m.regionId || '某地') + '：' + (m.oldValue || '无主') + '→' + (m.newValue || '无主') + (m.reason ? '（' + m.reason + '）' : ''));
      }
    });
    if (terr.length) sections.push('疆土易主：\n' + terr.slice(0, CAP).join('\n'));
  }

  // 2. 兵势骤变（military 桶：{name, changes:[{field:'soldiers', oldValue, newValue}]}）
  if (tc && Array.isArray(tc.military) && tc.military.length) {
    var troops = [];
    tc.military.forEach(function(mc) {
      if (!mc || !Array.isArray(mc.changes)) return;
      mc.changes.forEach(function(ch) {
        if (ch && ch.field === 'soldiers') {
          var d = (ch.newValue || 0) - (ch.oldValue || 0);
          if (d !== 0) troops.push({ name: mc.name, d: d });
        }
      });
    });
    troops.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
    if (troops.length) {
      sections.push('兵势骤变：\n' + troops.slice(0, CAP).map(function(t) {
        return '· ' + t.name + ' 兵力' + (t.d > 0 ? '+' : '') + t.d;
      }).join('\n'));
    }
  }

  // 3. 势力消长（factions 桶：{name, changes:[{field:'strength', oldValue, newValue}]}）
  if (tc && Array.isArray(tc.factions) && tc.factions.length) {
    var facd = [];
    tc.factions.forEach(function(fc) {
      if (!fc || !Array.isArray(fc.changes)) return;
      fc.changes.forEach(function(ch) {
        if (ch && ch.field === 'strength') {
          var d = (ch.newValue || 0) - (ch.oldValue || 0);
          if (d !== 0) facd.push({ name: fc.name, d: d });
        }
      });
    });
    facd.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
    if (facd.length) {
      sections.push('势力消长：\n' + facd.slice(0, CAP).map(function(f) {
        return '· ' + f.name + ' 实力' + (f.d > 0 ? '+' : '') + f.d;
      }).join('\n'));
    }
  }

  // 4. 当下虚实（运行时 GM.facs：濒崩者点名——供 AI 识别可乘之机；字段对齐 prompt 运行时态块）
  if (Array.isArray(GM.facs) && GM.facs.length) {
    var weak = [];
    GM.facs.forEach(function(f) {
      if (!f || !f.name) return;
      if (f._collapsing) weak.push('· ' + f.name + '【濒临崩溃】实力' + (f.strength || 0) + '·民心' + (f.morale || 0));
    });
    if (weak.length) sections.push('当下虚实：\n' + weak.slice(0, CAP).join('\n'));
  }

  if (!sections.length) return '';
  return '【上一回合天下变动】（据此判断时局与战机）\n' + sections.join('\n');
}

function _endTurn_finalizeRecords(shizhengji, zhengwen, playerStatus, playerInner, edicts, xinglu, oldVars, changeReportHtml, queueResult, suggestions, tyrantResult, turnSummary, shiluText, szjTitle, szjSummary, personnelChanges, hourenXishuo, recordLineage) {
  // 默认参数兼容（旧版调用者未传新参数时不崩）
  shiluText = shiluText || '';
  szjTitle = szjTitle || '';
  szjSummary = szjSummary || '';
  personnelChanges = personnelChanges || [];
  hourenXishuo = hourenXishuo || zhengwen || '';
  // ★2026-07-01·归一叙事里的字面转义(agent 模式常见坑):AI 把段落分隔写成字面 "\n\n"、或过度转义 \\n/\\"·
  //   JSON.parse 后仍是「字面反斜杠+n」→ 渲染直出 "\n\n"/误显英文 n·且下方时政记 split(/\n{2,}/) 按真换行
  //   分段失效→整段糊成一坨。此处统一转真换行/引号(所有来源:agent finalize/deepen、LLM 管线、史记回放共此入口)。
  //   纯文本清洗·不改结构;正常路径(已是真换行)无字面转义→全 no-op·零回归。
  var _unescNarr = function (s) {
    return String(s == null ? '' : s)
      .replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  };
  shizhengji = _unescNarr(shizhengji);
  zhengwen = _unescNarr(zhengwen);
  shiluText = _unescNarr(shiluText);
  hourenXishuo = _unescNarr(hourenXishuo);
  playerStatus = _unescNarr(playerStatus);
  playerInner = _unescNarr(playerInner);
  turnSummary = _unescNarr(turnSummary);
  szjSummary = _unescNarr(szjSummary);
  // 1.4 措施4: 死亡角色二次过滤——标记叙事中已死角色的主动行为
  if (GM.chars && zhengwen) {
    var _deadNames = GM.chars.filter(function(c) { return c.alive === false && c.dead; }).map(function(c) { return c.name; });
    _deadNames.forEach(function(dn) {
      if (dn.length < 2) return;
      // 匹配"死者+主动动词"模式并加注
      var _activePattern = new RegExp('(' + dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(说|曰|奏|上书|进言|率军|带领|发兵|下令|命令|宣布)', 'g');
      zhengwen = zhengwen.replace(_activePattern, '[$1(已故)]$2');
    });
    // 对后人戏说同样过滤
    if (hourenXishuo) {
      _deadNames.forEach(function(dn) {
        if (dn.length < 2) return;
        var _ap = new RegExp('(' + dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(说|曰|奏|上书|进言|率军|带领|发兵|下令|命令|宣布)', 'g');
        hourenXishuo = hourenXishuo.replace(_ap, '[$1(已故)]$2');
      });
    }
  }
  // 动态更新年号
  (function(){
    // 年号系统始终启用
    var t=P.time;
    var _diEra=(typeof calcDateFromTurn==='function')?calcDateFromTurn(GM.turn||1):null;
    var _dpvEra=(typeof _getDaysPerTurn==='function')?_getDaysPerTurn():30;
    var y=_diEra?_diEra.adYear:((t.year||0)+Math.floor(((GM.turn||1)-1)*_dpvEra/365));
    var mo=_diEra?_diEra.lunarMonth:(t.startMonth||1);
    var eraList=GM.eraNames||[];
    var best=null;
    eraList.forEach(function(e){
      if(!e||!e.name)return;
      var ey=e.startYear||0;var em=e.startMonth||1;
      if(y>ey||(y===ey&&mo>=em)){
        if(!best||ey>best.startYear||(ey===best.startYear&&em>best.startMonth))best=e;
      }
    });
    if(best)GM.eraName=best.name;
  })();

  // 世界态变更摘要：此刻 turnChanges 已满（reset→AI→apply 之后），压成纯文本存住，供下回合喂 AI
  try { GM._lastTurnDigest = buildWorldChangeDigest(); }
  catch (_wcdE) {
    if (window.TM && TM.errors) TM.errors.capture(_wcdE, 'endturn.worldChangeDigest');
    throw _wcdE;
  }

  // 一句话总曰·供弹窗头部 tr-summary-bar 与 shijiHistory.turnSummary（弹窗内容已分卷·见 tm-endturn-shiji-compose.js）
  var _summaryText = turnSummary || '';
  // 若AI未返回turn_summary，从时政记首句自动截取
  if (!_summaryText && shizhengji) {
    var _firstSentence = shizhengji.split(/[。！\n]/)[0];
    _summaryText = _firstSentence || '';
  }
  // 群臣动向→风闻录事（每条 NPC 事件写入 GM._fengwenRecord）
  // ※ 奏疏类(奏/谏/弹劾/上书/疏/表)走正常奏疏系统·不入风闻
  // ※ 只收录 4 类：密札(密谋)/耳报(私交)/军情(军事动向)/风议(舆论)
  try {
    if (GM.evtLog) {
      var _npcEvtsFw = GM.evtLog.filter(function(e) { return e.type === 'NPC自主' && e.turn === GM.turn - 1; });
      if (_npcEvtsFw.length > 0) {
        if (!GM._fengwenRecord) GM._fengwenRecord = [];
        _npcEvtsFw.forEach(function(e) {
          var _t = e.text || '';
          // 奏疏类完全跳过（已由奏疏系统处理）
          if (/奏|谏|弹劾|上书|疏|表奏|上表|题奏|参劾/.test(_t)) return;
          var _type = null;
          if (/密|暗|谋|阴|贿|收买|拉拢|勾结|串/.test(_t)) _type = '密札';
          else if (/结交|拜|宴|盟|联姻|访|攀交|门生|座师/.test(_t)) _type = '耳报';
          else if (/军|兵|战|攻|守|练|征|讨|调兵|点卯|调遣/.test(_t)) _type = '军情';
          else if (/私议|流言|传|说|闲谈|窃语/.test(_t)) _type = '风议';
          if (!_type) return; // 不分类·不收录
          GM._fengwenRecord.push({
            type: _type, text: _t,
            credibility: 0.75, turn: GM.turn - 1, source: 'npc_action'
          });
        });
      }
    }
  } catch(_fwE) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_fwE, 'shiji→fengwen] NPC evts 转录失败') : console.warn('[shiji→fengwen] NPC evts 转录失败', _fwE);
    throw _fwE;
  }

  // 史记弹窗·御览分卷组装（tm-endturn-shiji-compose.js·2026-07-06 重做）——
  // 组装为纯函数（读 GM/P·零写入）·素材已经上方 _unescNarr 清洗+死亡过滤·副作用（digest/风闻/落账/存档）全留本函数
  var shijiHtml = (typeof _composeShijiHtml === 'function')
    ? _composeShijiHtml({
        shizhengji: shizhengji,
        playerStatus: playerStatus,
        playerInner: playerInner,
        oldVars: oldVars,
        tyrantResult: tyrantResult,
        shiluText: shiluText,
        szjTitle: szjTitle,
        szjSummary: szjSummary,
        personnelChanges: personnelChanges,
        hourenXishuo: hourenXishuo
      })
    : '<div style="padding:1rem;line-height:1.8;white-space:pre-wrap;">' + escHtml(shizhengji || turnSummary || '') + '</div>';

  // shijiHistory存完整HTML + 所有结构化字段（供史记回顾和后续兼容）
  var _fullHtml = shijiHtml;
  // 收集本回合玩家下的诏令（edicts 参数存的是按分类的原文）
  var _thisTurnEdicts = edicts || {};
  var _lineageBasisRefs = [];
  try {
    if (recordLineage && Array.isArray(recordLineage.basis_refs)) _lineageBasisRefs = recordLineage.basis_refs;
    else if (recordLineage && Array.isArray(recordLineage.basisRefs)) _lineageBasisRefs = recordLineage.basisRefs;
  } catch(_) { _lineageBasisRefs = []; }
  var _recordMeta = null;
  var _evidenceRefs = [];
  try {
    if (window.TM && TM.MemorySourceBound && typeof TM.MemorySourceBound.buildRecordMetadata === 'function') {
      _recordMeta = TM.MemorySourceBound.buildRecordMetadata(GM, {
        type: 'shijiHistory',
        turn: GM.turn - 1,
        text: [shizhengji, zhengwen, shiluText, szjTitle, szjSummary, turnSummary].filter(Boolean).join('\n'),
        authority: 'official_record',
        visibility: 'public',
        role: 'record',
        lane: 'L6_retrieved_evidence',
        aiBasisRefs: _lineageBasisRefs,
        maxBasisRefs: 24
      });
      _evidenceRefs = _recordMeta.basisRefs;
    } else if (window.TM && TM.MemoryEvidenceRegistry && typeof TM.MemoryEvidenceRegistry.buildBasisRefs === 'function') {
      _evidenceRefs = TM.MemoryEvidenceRegistry.buildBasisRefs(GM, { maxRefs: 16 });
    }
  } catch(_) { _evidenceRefs = []; }
  GM.shijiHistory.push({
    id: _recordMeta && _recordMeta.id,
    turn: GM.turn-1, time: getTSText(GM.turn-1),
    shizhengji: shizhengji, zhengwen: zhengwen,
    playerStatus: playerStatus, playerInner: playerInner,
    turnSummary: _summaryText,
    // 新增字段
    shilu: shiluText, szjTitle: szjTitle, szjSummary: szjSummary,
    personnel: personnelChanges, houren: hourenXishuo,
    suggestions: Array.isArray(suggestions) ? suggestions : [],
    sourceType: 'official_record',
    authorityLevel: 'official_record',
    confidence: 0.72,
    sourceRefs: _recordMeta ? _recordMeta.sourceRefs : [],
    basisRefs: _recordMeta ? _recordMeta.basisRefs : _evidenceRefs,
    evidenceRefs: _evidenceRefs,
    contentHash: _recordMeta && _recordMeta.contentHash,
    basisMaxAuthorityRank: _recordMeta && _recordMeta.basisMaxAuthorityRank,
    generatedBy: 'endturn.sc1d',
    factStatus: 'recorded_turn',
    edicts: _thisTurnEdicts,  // 保留玩家诏令全文以便史记回顾+下回合 AI 上下文
    html: _fullHtml
  });
  if (GM.shijiHistory.length > 200) GM.shijiHistory.splice(0, GM.shijiHistory.length - 200); // arch-ok·史记封顶防长局存档膨胀·生成式 cap（同文件 _factionHistory/_metricHistory）
  // 6.5: 每回合一句话摘要存入年度素材
  if (!GM._yearlyDigest) GM._yearlyDigest = [];
  var _digestTurn = GM.turn - 1;
  var _digestDate = (typeof _chronicleDateForTurn === 'function') ? _chronicleDateForTurn(_digestTurn) : null;
  GM._yearlyDigest.push({
    turn: _digestTurn,
    year: _digestDate && Number.isSafeInteger(_digestDate.year) ? _digestDate.year : undefined,
    summary: _summaryText || (shizhengji||'').split(/[\u3002\n]/)[0] || ''
  });
  // 保留两年重试素材；年度 prompt 会再次按 canonical year 精确过滤。
  var _yTurns = (typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12;
  if (GM._yearlyDigest.length > _yTurns * 2) GM._yearlyDigest = GM._yearlyDigest.slice(-_yTurns * 2);
  // 纪传体：记录月度摘要
  // 编年史草稿：优先使用实录(正式体)+时政记；后人戏说作为辅助材料
  // 实录本就是正史体，最适合喂给编年体系统；否则回落到shizhengji+zhengwen
  var _chrSummary = shiluText || shizhengji || '';
  var _chrDetail = shizhengji || '';
  if (_chrDetail && _chrDetail === _chrSummary) _chrDetail = zhengwen || ''; // 避免重复
  ChronicleSystem.addMonthDraft(GM.turn-1, _chrSummary, _chrDetail);

  // 8. 写入起居注
  if(!GM.qijuHistory)GM.qijuHistory=[];
  var _qijuMeta = null;
  try {
    if (window.TM && TM.MemorySourceBound && typeof TM.MemorySourceBound.buildRecordMetadata === 'function') {
      _qijuMeta = TM.MemorySourceBound.buildRecordMetadata(GM, {
        type: 'qijuHistory',
        turn: GM.turn - 1,
        text: zhengwen || '',
        authority: 'official_record',
        visibility: 'public',
        role: 'record',
        lane: 'L6_retrieved_evidence',
        aiBasisRefs: _lineageBasisRefs,
        fallbackBasisRefs: _recordMeta && _recordMeta.sourceRefs || [],
        maxBasisRefs: 16
      });
    }
  } catch(_) { _qijuMeta = null; }
  if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
    id: _qijuMeta && _qijuMeta.id,
    turn:GM.turn-1,time:getTSText(GM.turn-1),zhengwen:zhengwen,
    sourceType: 'official_record',
    authorityLevel: 'official_record',
    confidence: 0.72,
    sourceRefs: _qijuMeta ? _qijuMeta.sourceRefs : [],
    basisRefs: _qijuMeta ? _qijuMeta.basisRefs : [],
    evidenceRefs: _qijuMeta ? _qijuMeta.basisRefs : [],
    contentHash: _qijuMeta && _qijuMeta.contentHash,
    factStatus: 'recorded_narrative',
    generatedBy: 'endturn.finalize'
  });
  // 9. 新回合奏疏；属于记录最终化，异常必须触发整回合回滚。
  generateMemorials();

  // 11.5/11.6 自然死亡和空缺检查已在 Step 6.90-6.91 中执行，此处不再重复

  // 11b. 快照当前值用于下回合delta显示
  GM._prevVars = {};
  Object.entries(GM.vars||{}).forEach(function(e) { GM._prevVars[e[0]] = e[1].value; });
  // 动态快照所有核心指标（供 Delta 面板比较）
  var _cmlKeys = (typeof CORE_METRIC_LABELS === 'object') ? Object.keys(CORE_METRIC_LABELS) : [];

  // 9.4: 记录核心指标历史快照（供结局统计画曲线）
  if (!GM._metricHistory) GM._metricHistory = [];
  var _snap = {turn: GM.turn - 1};
  _cmlKeys.forEach(function(k) { if (typeof GM[k] === 'number') _snap[k] = Math.round(GM[k]); });
  // 同时记录vars中的核心变量
  Object.entries(GM.vars||{}).forEach(function(e) {
    if (e[1].isCore || (typeof CORE_METRIC_LABELS === 'object' && CORE_METRIC_LABELS[e[0]])) {
      _snap[e[0]] = Math.round(e[1].value);
    }
  });
  GM._metricHistory.push(_snap);
  if (GM._metricHistory.length > 500) GM._metricHistory = GM._metricHistory.slice(-500);
  _cmlKeys.forEach(function(k) { if (typeof GM[k] === 'number') GM['_prev_' + k] = GM[k]; });

  // 11b. 势力历史快照（每回合记录各势力状态，供AI分析趋势）
  if (GM.facs && GM.facs.length > 0) {
    if (!GM._factionHistory) GM._factionHistory = [];
    var _fSnapshot = { turn: GM.turn - 1, factions: {} };
    GM.facs.forEach(function(f) {
      _fSnapshot.factions[f.name] = {
        strength: f.strength ?? 50,
        military: f.militaryStrength || 0,
        attitude: f.attitude || '',
        leader: f.leader || ''
      };
    });
    GM._factionHistory.push(_fSnapshot);
    // 只保留最近10回合快照
    if (GM._factionHistory.length > 10) GM._factionHistory.shift();
  }

  // 性能·_turnReport 无界增长裁剪（渲染只读当回合/上回合·见 954/1572）·防越玩越卡时 deepClone/序列化/遍历越来越重
  if (GM._turnReport && GM._turnReport.length > 600) GM._turnReport = GM._turnReport.slice(-600);
  // 性能·jishiRecords（push 尾插·读取端只取近 50）无写入端 cap·尾部环形裁剪（qijuHistory 已在 npc-driver/news-bridge slice(0,200) 受控·不重复裁）
  if (GM.jishiRecords && GM.jishiRecords.length > 400) GM.jishiRecords = GM.jishiRecords.slice(-400);
  // 史料权威补全(纪事)·议政记录皆实录→信史·confidence 按 mode/泄密分级·供史册库权威钤印/置信
  if (Array.isArray(GM.jishiRecords)) GM.jishiRecords.forEach(function(_r){ if (_r && !_r.authorityLevel){ _r.authorityLevel = 'official_record'; _r.confidence = (_r.leaked || _r.secret) ? 0.55 : (_r.mode === 'private' ? 0.68 : 0.78); } });
  // 这些旧 UI 入口过去会在渲染时顺手规范化状态。现在先在事务内完成，
  // commit 后的 renderer 只读已经准备好的财政、问对和地图展示数据。
  if (typeof _syncFiscalScalars === 'function') _syncFiscalScalars(GM);
  if (typeof _wdPrepareAudienceRenderState === 'function') _wdPrepareAudienceRenderState();
  if (P.map && P.map.enabled && typeof updateMapColors === 'function') updateMapColors({ refresh: false });
  var _pendingToasts = Array.isArray(GM._pendingToasts) ? GM._pendingToasts.slice() : [];
  GM._pendingToasts = [];
  var turnData = null;
  if (window.tianming && window.tianming.isDesktop && GM.saveName) {
    if (window.TM && TM.MemoryTrace && typeof TM.MemoryTrace.finalizeTurnTrace === 'function') {
      var _mtTrace = TM.MemoryTrace.finalizeTurnTrace(GM);
      if (_mtTrace && _mtTrace.summary && typeof recordMemoryDiagnostic === 'function') {
        recordMemoryDiagnostic('trace', { status: 'finalized', summary: _mtTrace.summary });
      }
    }
    var turnCtx={turn:GM.turn-1,time:getTSText(GM.turn-1),shizhengji:shizhengji,zhengwen:zhengwen,playerStatus:playerStatus,playerInner:playerInner,vars:deepClone(GM.vars),rels:deepClone(GM.rels),chars:deepClone(GM.chars),officeTree:deepClone(GM.officeTree||[]),families:GM.families?deepClone(GM.families):null,harem:GM.harem?deepClone(GM.harem):null};
    var playerInput={edicts:edicts,xinglu:xinglu,memorialResponses:(GM.memorials||[]).map(function(m){return{from:m.from,type:m.type,status:m.status,reply:m.reply};}),tyrantActivities:GM._turnTyrantActivities||[]};
    var aiResults=GM._turnAiResults||{};
    var varChanges={_timeScale: P.time ? P.time.perTurn : '1m', _customDays: P.time ? P.time.customDays : null};
    Object.entries(GM.vars || {}).forEach(function(e){
      var oldValue = oldVars && oldVars[e[0]] != null ? oldVars[e[0]] : 0;
      var d=e[1].value-oldValue;
      if(Math.abs(d)>=0.1) {
        var entry = {old:oldValue, now:e[1].value, delta:d};
        var unit = e[1].unit || e[1].unitName || e[1].suffix || '';
        if (unit) entry.unit = unit;
        varChanges[e[0]] = entry;
      }
    });
    var scenarioData=null;
    var refTextData=null;
    if(GM.turn<=2){
      var _sc4=typeof findScenarioById === 'function' && findScenarioById(GM.sid);
      if(_sc4) scenarioData=deepClone(_sc4);
      if(_sc4&&_sc4.refText) refTextData=_sc4.refText;
    }
    turnData={context:turnCtx,playerInput:playerInput,aiResults:aiResults,varChanges:varChanges};
    if(scenarioData) turnData.scenario=scenarioData;
    if(refTextData) turnData.refText=refTextData;
  }

  var _aiDiagnosticSummary = '';
  var _aiDiag = GM._lastAIDiagnostics;
  if (_aiDiag && !_aiDiag._announced) {
    var _fw = Array.isArray(_aiDiag.failedWrites) ? _aiDiag.failedWrites.length : 0;
    var _warn = Array.isArray(_aiDiag.warnings) ? _aiDiag.warnings.length : 0;
    var _rep = Array.isArray(_aiDiag.repairedJson) ? _aiDiag.repairedJson.length : 0;
    if (_fw || _warn || _rep) {
      _aiDiagnosticSummary = 'write_gate=' + _fw + ', warnings=' + _warn + ', json_repair=' + _rep;
      _aiDiag._announced = true;
    }
  }

  return {
    shijiHtml: shijiHtml,
    shijiIndex: GM.shijiHistory.length - 1,
    pendingToasts: _pendingToasts,
    turnData: turnData,
    aiDiagnosticSummary: _aiDiagnosticSummary
  };
}

// 玩家输入必须在世界与 canonical 存档都提交以后才清空；失败回滚无需重建 DOM 草稿。
function _endTurn_clearCommittedInputs() {
  var errors = [];
  ["edict-pol","edict-mil","edict-dip","edict-eco","edict-oth","xinglu","xinglu-pub","xinglu-prv"].forEach(function(id){
    try { var el=typeof _$ === 'function' ? _$(id) : null;if(el)el.value=""; }
    catch (error) { errors.push(error); }
  });
  try {
    if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.clearEdictDrafts === 'function') {
      var result = window.TMPhase8FormalBridge.clearEdictDrafts();
      if (result && result.ok === false) errors = errors.concat(result.errors || [new Error('正式诏令草稿持久层清理失败')]);
    }
  } catch (error) { errors.push(error); }
  if (errors.length) {
    try { if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(errors[0], 'endTurn] clear committed drafts'); } catch (_) {}
    try { if (typeof toast === 'function') toast('本回合诏令已经生效；界面草稿清理不完整，已阻止其再次提交。'); } catch (_) {}
    return false;
  }
  return true;
}

// 纯展示阶段：只在事务 commit 后调用。这里的异常可降级，不能反向回滚已提交世界。
function _endTurn_render(presentation) {
  presentation = presentation || {};
  var btn = (typeof _$ === 'function' ? (_$("btn-end") || _$("btn-end-turn")) : null);
  if (typeof renderQiju === 'function') renderQiju();
  if (typeof renderWenduiChars === 'function') renderWenduiChars(false, { skipStatePreparation: true });
  var _wdm=typeof _$ === 'function' ? _$('wendui-modal') : null;if(_wdm)_wdm.remove();
  if (typeof renderGameState === 'function') renderGameState({ skipStateSync: true });
  if (typeof hideLoading === 'function') hideLoading();
  if (typeof showTurnResult === 'function') showTurnResult(presentation.shijiHtml || '', presentation.shijiIndex);
  setTimeout(function() {
    if (typeof PromptLayerCache !== 'undefined' && PromptLayerCache.preload) PromptLayerCache.preload();
  }, 500);
  (presentation.pendingToasts || []).forEach(function(msg, i) { setTimeout(function(){ toast(msg); }, 500 + i * 800); });
  if (btn) { btn.textContent="\u23F3 \u9759\u5F85\u65F6\u53D8";btn.style.opacity="1"; }
  if (typeof updateTimeDisplay === 'function') updateTimeDisplay();
  if (typeof updateTopVariables === 'function') updateTopVariables();
  _dbg('========== 回合结算完成 (T' + GM.turn + ') ==========');
  _dbg('[endTurn] 财务报表:', (typeof AccountingSystem !== 'undefined' && AccountingSystem.getLedger) ? AccountingSystem.getLedger() : null);
  _dbg('[endTurn] 变动队列已清空，准备进入下一回合');
  if (presentation.aiDiagnosticSummary) _dbg('[AIDiagnostics] hidden summary: ' + presentation.aiDiagnosticSummary);
  if (P.map && P.map.enabled && typeof refreshMapDisplay === 'function') refreshMapDisplay();
}

function _endTurn_showRenderFallback(error) {
  try { if (typeof hideLoading === 'function') hideLoading(); } catch (_) {}
  var message = String(error && (error.message || error) || 'unknown render error');
  var safe = message.replace(/[&<>"']/g, function(ch) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]; });
  if (typeof showTurnResult === 'function') {
    showTurnResult('<div style="padding:1rem;line-height:1.8;color:var(--txt);"><h3 style="color:var(--gold);margin:0 0 0.8rem;">史记弹窗渲染失败</h3><p>本回合已安全保存，但结果界面渲染失败。可继续操作，请把控制台诊断发给开发者。</p><pre style="white-space:pre-wrap;color:var(--red,#c44);">' + safe + '</pre></div>');
  }
  try { if (typeof toast === 'function') toast('回合已安全保存，但史记弹窗渲染失败，请查看控制台诊断。'); } catch (_) {}
}

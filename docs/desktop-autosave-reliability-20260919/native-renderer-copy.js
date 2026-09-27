var _autoSaveInFlight=false;
var _autoSaveInFlightPromise=null;
var _autoSaveSkipCount=0;
var _autoSaveLiteTick=0;
var _autoSaveLastInputMs=0;   // C·最后一次用户输入时间
var _autoSaveLastDoneMs=0;     // C·最后一次 autoSave 成功时间
var _autoSaveDeferStreak=0;    // C·连续 defer 次数·用于日志
// D (2026-05-28)·闲置跳存·防 renderer OOM
// 闲置时 defer 永不触发 (无输入→_sinceInput 恒>5000)·autoSave 反而每 60s 满血跑一次 (比活跃游玩 3 分钟一次频繁 3 倍)·
// 每次全量 deepClone(P)+_autoSaveSnapshotGM()(~1s·数百 MB 瞬时分配)+IPC structuredClone·
// 闲置 10 分钟累积 ~10 次峰值→堆耗尽→Render process gone 黑屏。
// 而闲置时 GM 完全冻结·这些存档是把盘上同一份数据反复重写·纯浪费。
// 故:真闲置 (自上次成功存档以来无输入 且 turn 未变) 时跳过·盘上副本已是最新。
var _autoSaveCommittedRevision=0,_autoSaveLastSavedRevision=-1;
var _autoSaveLastSavedTurn=-1; // D·上次成功存档时的 GM.turn
var _autoSaveIdleSkipStreak=0; // D·连续闲置跳过次数·用于日志
var _autoSaveDeferred=false;
var _autoSaveFlushTimer=null;
// 桌面 60s 自动档只能消费这一份已脱离 live GM/P 的稳定快照。
// 它由新局/读档完成、pre_endturn 提交或 canonical 双槽提交这些明确边界更新；
// timer 本身绝不从正在变化的世界临时抓取一份“看起来完整”的状态。
var lastCommittedSnapshot=null;
var lastCommittedTurn=-1;
var lastCommittedTransactionId='';
var _lastCommittedSnapshotIdentity=null;
// Background AI summaries are deliberately outside the critical end-turn path.  Once they
// mutate the still-current world they request one coalesced canonical save here instead of
// calling a storage primitive from independent promise callbacks.
var _backgroundSavePending=null;
var _backgroundSaveInFlight=null;
var _backgroundSaveTimer=null;
var _backgroundSaveSequence=0;
var _BACKGROUND_SAVE_MAX_ATTEMPTS=2;

function _tmReportDesktopAutoSaveBoundaryError(error, label){
  var normalized = (error && (typeof error === 'object' || typeof error === 'function')) ? error : new Error(String(error));
  var reported = false;
  try {
    if (typeof window !== 'undefined' && window.TM && TM.errors) {
      if (typeof TM.errors.captureSilent === 'function') {
        TM.errors.captureSilent(normalized, String(label || 'desktop autosave boundary'));
        reported = true;
      } else if (typeof TM.errors.capture === 'function') {
        TM.errors.capture(normalized, String(label || 'desktop autosave boundary'));
        reported = true;
      }
    }
  } catch (captureError) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[autoSave] diagnostic reporter failed:', captureError);
  }
  if (!reported && typeof console !== 'undefined' && console.warn) {
    console.warn('[autoSave] ' + String(label || 'desktop autosave boundary') + ':', normalized);
  }
  return normalized;
}

var _autoSaveNativePending=null, _autoSaveTransportEvents=[];
var _DESKTOP_AUTOSAVE_WAIT_MS=60000;
function _tmDesktopAutoSaveWaitError(code){
  var e=new Error(code==='DESKTOP_AUTOSAVE_UNCONFIRMED'
    ? '桌面自动存档回执尚未确认；未重发或标记成功，请保留当前页面并核对主存档。'
    : '桌面自动存档对应的世界或会话已变化，旧快照未发送');
  e.code=code; return e;
}
function _tmDesktopAutoSaveTransportEvent(phase){
  _autoSaveTransportEvents.push({phase:phase,at:Date.now()});
  if(_autoSaveTransportEvents.length>12)_autoSaveTransportEvents.shift();
}
function _tmDesktopAutoSaveTransportStatus(){
  return {pending:!!_autoSaveNativePending,timedOut:!!(_autoSaveNativePending&&_autoSaveNativePending.timedOut),
    events:_autoSaveTransportEvents.map(function(e){return {phase:e.phase,at:e.at};})};
}
function _tmAwaitDesktopAutoSaveReply(execute){
  if(_autoSaveNativePending)return Promise.reject(_tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_UNCONFIRMED'));
  return new Promise(function(resolve,reject){
    var job={timedOut:false},settled=false,timer;
    _autoSaveNativePending=job;
    function ended(error,value){
      clearTimeout(timer);
      if(_autoSaveNativePending===job)_autoSaveNativePending=null;
      if(settled){_tmDesktopAutoSaveTransportEvent(error?'late-rejection':'late-reply');return;}
      settled=true;_tmDesktopAutoSaveTransportEvent(error?'rejected':_tmDesktopAutoSaveResultOk(value)?'acknowledged':'negative-reply');
      if(error)reject(error);else resolve(value);
    }
    timer=setTimeout(function(){
      if(settled)return;settled=true;job.timedOut=true;
      _tmDesktopAutoSaveTransportEvent('unconfirmed');
      reject(_tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_UNCONFIRMED'));
    },_DESKTOP_AUTOSAVE_WAIT_MS);
    try{Promise.resolve(execute()).then(function(value){ended(null,value);},function(error){ended(error);});}
    catch(error){ended(error);}
  });
}

function _tmDesktopAutoSaveResultOk(result){
  return result === true || !!(result && result.success === true);
}
function _tmDesktopAutoSaveFailure(result){
  return new Error('桌面自动存档未落盘' + (result && result.error ? '：' + result.error : ''));
}

function isWorldTransactionActive(){
  var liveGM = (typeof GM !== 'undefined') ? GM : null;
  var root = (typeof window !== 'undefined') ? window : null;
  return !!(
    (liveGM && (liveGM.busy || liveGM._endTurnBusy || liveGM._endTurnCommitPending || liveGM._loadHydrationPending)) ||
    (root && (root._tmActiveLoadTransaction || root._tmWorldRollbackActive || root._tmActiveTimeTravelTransaction)) ||
    (typeof endTurn !== 'undefined' && endTurn && endTurn._preSubmitInFlight)
  );
}

function _tmBackgroundSaveLeaseCurrent(request){
  if (!request || !request.lease) return false;
  if (typeof _tmWorldLeaseCurrent === 'function') return _tmWorldLeaseCurrent(request.lease);
  var lease=request.lease;
  return typeof GM !== 'undefined' && typeof P !== 'undefined'
    && GM===lease.gmRef && P===lease.pRef
    && String((GM&&GM._campaignId)||'')===String(lease.campaignId||'')
    && String((GM&&GM.sid)||'')===String(lease.sid||'')
    && Number((GM&&GM.turn)||0)===Number(lease.turn||0)
    && (((typeof window!=='undefined'&&window._tmLoadGen)||0)===Number(lease.loadGen||0));
}

function _tmBackgroundSaveLeaseSame(a,b){
  return !!(a&&b)
    && a.gmRef===b.gmRef && a.pRef===b.pRef
    && String(a.campaignId||'')===String(b.campaignId||'')
    && String(a.sid||'')===String(b.sid||'')
    && Number(a.turn||0)===Number(b.turn||0)
    && Number(a.loadGen||0)===Number(b.loadGen||0);
}

function _tmBackgroundSaveMeta(request){
  var scenario=null;
  try {
    scenario=typeof findScenarioById==='function'?findScenarioById(GM.sid):null;
  } catch (error) {
    if (typeof console!=='undefined'&&console.warn) console.warn('[background-save] scenario metadata lookup failed',error);
  }
  return {
    name:'自动封存·'+(typeof getTSText==='function'?getTSText(GM.turn):'T'+GM.turn),
    type:'auto',
    turn:Number(GM.turn),
    scenarioName:scenario?String(scenario.name||''):'',
    eraName:String(GM.eraName||''),
    backgroundReasons:Array.from(request.reasons).slice(0,8)
  };
}

function _tmReportBackgroundSaveFailure(error, request){
  var normalized=_tmReportDesktopAutoSaveBoundaryError(error,'background canonical save · '+Array.from(request.reasons).join(','));
  try {
    if (!Array.isArray(GM._backgroundSaveFailures)) GM._backgroundSaveFailures=[];
    GM._backgroundSaveFailures.push({
      turn:Number(GM.turn)||0,
      reasons:Array.from(request.reasons).slice(0,8),
      attempts:Number(request.attempts)||0,
      message:String(normalized&&normalized.message||normalized).slice(0,500),
      at:Date.now()
    });
    if (GM._backgroundSaveFailures.length>20) GM._backgroundSaveFailures=GM._backgroundSaveFailures.slice(-20);
  } catch (diagnosticError) {
    if (typeof console!=='undefined'&&console.warn) console.warn('[background-save] failure diagnostic could not be persisted',diagnosticError);
  }
  return normalized;
}

async function _tmCommitBackgroundWorld(request){
  if (!_tmBackgroundSaveLeaseCurrent(request)) return {ok:false,stale:true,reason:'world-lease-stale'};
  if (isWorldTransactionActive()) return {ok:false,deferred:true,reason:'world-transaction-active'};
  if (!(typeof TM_SaveDB!=='undefined'&&TM_SaveDB&&typeof TM_SaveDB.saveManyAtomic==='function')) {
    throw new Error('background canonical save unavailable');
  }
  var writeGuard=function(){
    return _tmBackgroundSaveLeaseCurrent(request)&&!isWorldTransactionActive();
  };
  var state=_buildSaveState({format:'idb',detach:true,gm:request.lease.gmRef,p:request.lease.pRef});
  if (!state||!state.GM||!state.P) throw new Error('background canonical state build failed');
  if (!writeGuard()) return {ok:false,stale:true,reason:'world-changed-during-build'};
  var transactionId='background:'+String(state.GM._campaignId||'')+':'+String(state.GM._timelineId||'')+':'+String(state.GM.turn||0)+':'+String(++_backgroundSaveSequence);
  var identity={
    campaignId:String(state.GM._campaignId||''),
    timelineId:String(state.GM._timelineId||''),
    turn:Number(state.GM.turn)||0,
    transactionId:transactionId,
    schemaVersion:1
  };
  var payload=typeof TM_SaveDB.createCanonicalPayload==='function'
    ?await TM_SaveDB.createCanonicalPayload(state,identity)
    :null;
  if (!writeGuard()) return {ok:false,stale:true,reason:'world-changed-before-write'};
  var meta=_tmBackgroundSaveMeta(request);
  var saved=await TM_SaveDB.saveManyAtomic([
    {id:'autosave',gameState:state,canonicalPayload:payload,meta:meta},
    {id:'slot_0',gameState:state,canonicalPayload:payload,meta:meta}
  ],{transactionId:transactionId,writeGuard:writeGuard});
  if (saved!==true) throw new Error('background canonical slots were not committed atomically');
  if (!writeGuard()) return {ok:false,stale:true,reason:'world-changed-after-write'};
  if (!_tmAdoptCommittedWorldSnapshot(state,{turn:state.GM.turn,transactionId:transactionId,takeOwnership:true})) {
    throw new Error('background committed snapshot adoption failed');
  }
  _autoSaveDeferred=true;
  _tmRequestDeferredDesktopAutoSaveFlush('background-canonical-save');
  return {ok:true,turn:Number(state.GM.turn)||0,transactionId:transactionId,reasons:Array.from(request.reasons)};
}

function _tmScheduleBackgroundSave(delay){
  if (_backgroundSaveTimer||_backgroundSaveInFlight) return;
  _backgroundSaveTimer=setTimeout(function(){
    _backgroundSaveTimer=null;
    _tmDrainBackgroundAutosaves().catch(function(error){
      if (_backgroundSavePending) _tmReportBackgroundSaveFailure(error,_backgroundSavePending);
    });
  },Math.max(0,Number(delay)||0));
}

async function _tmDrainBackgroundAutosaves(){
  if (_backgroundSaveInFlight) return _backgroundSaveInFlight;
  if (!_backgroundSavePending) return {ok:false,skipped:true,reason:'no-background-save'};
  var request=_backgroundSavePending;
  _backgroundSavePending=null;
  _backgroundSaveInFlight=(async function(){
    if (!_tmBackgroundSaveLeaseCurrent(request)) return {ok:false,stale:true,reason:'world-lease-stale'};
    if (isWorldTransactionActive()) {
      _backgroundSavePending=request;
      _tmScheduleBackgroundSave(50);
      return {ok:false,deferred:true,reason:'world-transaction-active'};
    }
    request.attempts++;
    try {
      return await _tmCommitBackgroundWorld(request);
    } catch (error) {
      if (_tmBackgroundSaveLeaseCurrent(request)&&request.attempts<_BACKGROUND_SAVE_MAX_ATTEMPTS) {
        _backgroundSavePending=request;
        _tmScheduleBackgroundSave(100);
      } else {
        _tmReportBackgroundSaveFailure(error,request);
      }
      return {ok:false,error:error,attempts:request.attempts};
    }
  })();
  try { return await _backgroundSaveInFlight; }
  finally {
    _backgroundSaveInFlight=null;
    if (_backgroundSavePending) _tmScheduleBackgroundSave(0);
  }
}

function requestBackgroundAutosave(options){
  options=options||{};
  var lease=options.expectedWorldLease;
  if (!lease&&typeof _tmCaptureWorldLease==='function') lease=_tmCaptureWorldLease();
  if (!lease) return Promise.resolve({ok:false,skipped:true,reason:'world-lease-unavailable'});
  if (options.expectedTurn!==undefined&&options.expectedTurn!==null
    && Number(options.expectedTurn)!==Number(lease.turn)) {
    return Promise.resolve({ok:false,stale:true,reason:'background-turn-mismatch'});
  }
  var request={
    lease:lease,
    reasons:new Set([String(options.reason||'background-state-change')]),
    attempts:0,
    requestedAt:Date.now()
  };
  if (!_tmBackgroundSaveLeaseCurrent(request)) return Promise.resolve({ok:false,stale:true,reason:'world-lease-stale'});
  if (_backgroundSavePending&&_tmBackgroundSaveLeaseSame(_backgroundSavePending.lease,lease)) {
    request.reasons.forEach(function(reason){_backgroundSavePending.reasons.add(reason);});
  } else if (!_backgroundSavePending) {
    _backgroundSavePending=request;
  } else {
    // A pending request for an obsolete world must never be retargeted to the live world.
    if (!_tmBackgroundSaveLeaseCurrent(_backgroundSavePending)) _backgroundSavePending=request;
    else return Promise.resolve({ok:false,skipped:true,reason:'different-world-save-pending'});
  }
  _tmScheduleBackgroundSave(options.immediate===true?0:25);
  return Promise.resolve({ok:true,scheduled:true,reasons:Array.from(_backgroundSavePending.reasons)});
}

async function _tmAwaitBackgroundAutosaves(){
  if (_backgroundSaveTimer) {
    clearTimeout(_backgroundSaveTimer);
    _backgroundSaveTimer=null;
  }
  var result={ok:false,skipped:true,reason:'no-background-save'};
  var drains=0;
  while (_backgroundSavePending||_backgroundSaveInFlight) {
    if (_backgroundSaveTimer) {
      clearTimeout(_backgroundSaveTimer);
      _backgroundSaveTimer=null;
    }
    result=_backgroundSaveInFlight
      ? await _backgroundSaveInFlight
      : await _tmDrainBackgroundAutosaves();
    drains++;
    // A world transaction cannot be waited out from a close handshake. Keep the
    // request pending and let the main process cancel this close attempt.
    if (result&&result.deferred) return result;
    if (drains>_BACKGROUND_SAVE_MAX_ATTEMPTS+1) {
      return {ok:false,error:new Error('background save drain exceeded retry limit'),attempts:drains};
    }
  }
  return result;
}

function _tmNewDesktopAutoSaveSessionToken(){
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return 'tm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14) + '_' + Math.random().toString(36).slice(2, 10);
}

function _tmGetDesktopAutoSaveSessionToken(){
  try {
    if (typeof window !== 'undefined' && window.tianming && typeof window.tianming.getAutoSaveSessionToken === 'function') {
      var bridgeToken = String(window.tianming.getAutoSaveSessionToken() || '');
      if (bridgeToken) window._tmAutoSaveSessionToken = bridgeToken;
    }
  } catch (_) {}
  return (typeof window !== 'undefined' && window._tmAutoSaveSessionToken) ? String(window._tmAutoSaveSessionToken) : '';
}

function _tmRotateDesktopAutoSaveSession(reason, preferredToken){
  if (!_tmHasNativeFs()) return '';
  var token = String(preferredToken || '') || _tmNewDesktopAutoSaveSessionToken();
  if (!(window.tianming && typeof window.tianming.rotateAutoSaveSession === 'function')) return _tmGetDesktopAutoSaveSessionToken();
  var result = window.tianming.rotateAutoSaveSession(token);
  if (!(result && result.success === true && result.token)) {
    throw new Error('auto-save session rotate failed' + (result && result.error ? '：' + result.error : '') + (reason ? ' [' + reason + ']' : ''));
  }
  window._tmAutoSaveSessionToken = String(result.token);
  return window._tmAutoSaveSessionToken;
}
if (typeof window !== 'undefined') {
  window._tmGetDesktopAutoSaveSessionToken = _tmGetDesktopAutoSaveSessionToken;
  window._tmRotateDesktopAutoSaveSession = _tmRotateDesktopAutoSaveSession;
}

// C·document 级监听·任何键盘/指点/IME composition 都算 active input·5s 内 autoSave 跳过
if (typeof document !== 'undefined'){
  var _aSBumpInput=function(){ _autoSaveLastInputMs=Date.now(); };
  ['keydown','pointerdown','compositionupdate','input'].forEach(function(ev){
    try{ document.addEventListener(ev, _aSBumpInput, { capture:true, passive:true }); }catch(_){}
  });
}

// A-1·snapshot helper·浅拷顶 + 选择性深拷·明示 mutable / appendOnly / skip
// 注·top-level function decl 通过 hoisting 自动 attach 到 window (sloppy mode)·无需占位
function _tmSaveSnapshotSkipKeys(){
  // skip·debug-only·崩溃恢复用不上·清掉省 100-300ms
  // 2026-06-10 追加三个纯冗余大块(真存档实测计 5.5MB+):
  //   _facIndex·派生反向索引·序列化后是与 chars 脱钩的死拷贝·读档即 rebuild(fullLoadGame)+每回合 render-finalize 重建
  //   _savedMapData / _savedAdminHierarchy·_prepareGMForSave 每次从工作数据克隆的备份·
  //     与文件里 gameState.mapData / P.adminHierarchy 逐字节相同·_restoreSavedFields 是条件式恢复·缺席时工作数据原样生效
  // 2026-07-16·案二·_saved* 镜像去重(承上两键的同款判断·真档 T54 实测再省 ~4.8MB):
  //   下列 _saved* 均是 _prepareGMForSave 以 _safeClone(GM.<活字段>) 克隆的镜像·与文件里的活字段(gameState.GM.<活字段>)
  //   逐字节全同(measure 实证 IDENTICAL)·_restoreSavedFields 的恢复是条件式 `if(GM._savedX){GM.x=GM._savedX;...}`·
  //   缺席时活字段(fullLoadGame:822/828 直接从档载入·恢复前不被重置)原样生效·故只落活字段一份即可。
  //   ★安全边界(白名单法·多列一个只是多存·漏列一个不丢数据)：只纳入「活字段=GM.x·恢复写回 GM.x·非切片」者。
  //   刻意排除：子系统序列化态(_savedEventOpinions/_savedEventBus·经 OpinionSystem/StoryEventBus 反序列化·无活字段孪生)、
  //   DOM 草稿(_savedEdictDrafts)、逐角色聚合(_savedCharMemExt/_savedCharOfficeFields)、
  //   P 层孪生(_savedVassalSystem/_savedTitleSystem/_savedBuildingSystem/_savedKeju/_savedOfficialVassalMapping/_savedGovernment/_savedOfficeConfig·跨 GM/P)、
  //   截断切片(_savedNpcDecisionDiagnostics=slice(-120)·镜像≠活字段)、_savedRenli(并行线在飞·避让)。
  return {
    _aiTelemetry:1, _debugSnapshots:1, _aiBranchDiag:1, _aiDiag:1,
    _sysCacheMode:1, _sysCacheLen:1, _saveMeta:1,
    // Promise/lease jobs may retain gmRef and form cycles; they are runtime coordination, never world state.
    _postTurnJobs:1, _postTurnDetachedJobs:1,
    _facIndex:1, _savedMapData:1, _savedAdminHierarchy:1,
    // ── 案二·GM 活字段的冗余 _saved* 镜像(按 T54 体积降序·活字段孪生已入档) ──
    _savedConvArchive:1, _savedMemoryArchiveFull:1, _savedLetters:1,
    _savedEdictTracker:1, _savedEdictSuggestions:1, _savedNpcActionLedger:1,
    _savedChronicle:1, _savedCulturalWorks:1, _savedProvinceStats:1,
    _savedHistoryIndex:1, _savedFactionRelationsMap:1, _savedNpcCommitments:1,
    _savedCharacterArcs:1, _savedEdictLifecycle:1, _savedCourtRecords:1,
    _savedNpcFactionAiTurnLedger:1, _savedFamilies:1, _savedCausalGraph:1,
    _savedMemoryLayers:1, _savedBattleHistory:1, _savedFactionArcs:1,
    // 刀C返工三轮(2026-07-19)·写端来源判据的派生记忆化缓存(allNames/朝议拼接文本+其签名)·非游戏态·不入档
    //   (随通用快照持久化会致读档命中旧局缓存·已并 loadGen 入键作二保险)。
    _wgAllNamesCache:1, _wgAllNamesSigVal:1, _wgCourtTextCache:1, _wgCourtTextSigVal:1
  };
}

function _autoSaveSnapshotGM(sourceGM, options){
  options = options || {};
  var _snapshotGM = sourceGM || (typeof GM !== 'undefined' ? GM : null);
  if (!_snapshotGM) return null;
  // append-only 字段·上层只 push·不改老元素·直接引用 (无 deepClone 成本)
  var APPEND_ONLY = {
    qijuHistory:1, jishiRecords:1, shijiHistory:1, evtLog:1, biannianItems:1,
    officeChanges:1, eraStateHistory:1, conv:1, _chronicle:1, _chronicleTracks:1,
    _turnReport:1, _foreshadows:1, allCharacters:1, summarizedTurns:1, _convArchive:1,
    recentChaoyi:1, _ccHeldItems:1, _aiDispatchStats:1, _subcallTimings:1,
    _pendingMartyrEvents:1, _pendingTinyiActions:1, _pendingTinyiTopics:1,
    triggeredHistoryEvents:1, triggeredOffendEvents:1, rigidTriggers:1,
    // L3·R5·改革召对历史·cap 50·append-only·不深拷
    _kjpPrivateAudienceLog:1
  };
  var SKIP = _tmSaveSnapshotSkipKeys();
  var out = {};
  for (var k in _snapshotGM) {
    if (!_snapshotGM.hasOwnProperty(k)) continue;
    if (typeof TM !== 'undefined' && TM.perf && typeof TM.perf.count === 'function') {
      TM.perf.count('world.persistenceVisitedNodes', 1);
    }
    if (SKIP[k]) continue;
    // _prepareGMForSave 刚以 _safeClone 建的 _saved* 镜像·写后只读不再变动·此处引用即可
    // (原落入下方 deepClone 分支被二次深拷·每60s 自动存档对~130 个大块多拷一遍·此优化砍掉冗余那遍·序列化输出逐字节不变)
    if (k.slice(0, 6) === '_saved') {
      var savedValue = _snapshotGM[k];
      if (options.detach && !options.reuseMutable && savedValue !== null && typeof savedValue === 'object') out[k] = deepClone(savedValue);
      else out[k] = savedValue;
      continue;
    }
    if (APPEND_ONLY[k]) {
      // 普通手动快照仍可复用 append-only；提交给后台 timer 的稳定快照必须一次性脱离 live。
      var appendValue = _snapshotGM[k];
      out[k] = (options.detach && !options.reuseMutable && appendValue !== null && typeof appendValue === 'object') ? deepClone(appendValue) : appendValue;
      continue;
    }
    var v = _snapshotGM[k];
    // 函数·跳·先于 primitive 检查 (typeof function 不是 'object'·会误入 primitive 分支)
    if (typeof v === 'function') continue;
    // 原始 / null·直接赋
    if (v === null || typeof v !== 'object') { out[k] = v; continue; }
    // mutable·首次快照深拷；对已经脱离 live GM 的工作副本可安全复用，
    // 让准备后的第二遍过滤不再重复深拷整个世界。
    try { out[k] = options.reuseMutable ? v : deepClone(v); }
    catch (_cE) {
      // detach 快照一旦回退到引用，就重新暴露半回合写盘风险；必须明确失败。
      if (options.detach) throw _cE;
      out[k] = v;
    }
  }
  return out;
}
if (typeof window !== 'undefined') window._autoSaveSnapshotGM = _autoSaveSnapshotGM;

// 存档快照唯一构造口：所有可持久化写口都复用同一份 selective GM snapshot，
// 并保持两种既有外壳格式不变：
//   idb     -> { GM, P }（TM_SaveDB / slot / pre_endturn）
//   project -> P 克隆本体 + gameState（桌面存档 / 浏览器导出 / Electron autosave）
// 调用方须在需要时先 await 后台任务；prepare 默认开启，传 prepare:false 可避免同一写口重复序列化。
function _buildSaveState(options){
  options = options || {};
  if (typeof TM !== 'undefined' && TM.perf && typeof TM.perf.count === 'function') {
    TM.perf.count('world.persistenceBuild.count', 1);
  }
  var liveGM = (typeof GM !== 'undefined' ? GM : null);
  var sourceGM = options.gm || liveGM;
  var sourceP = options.p || (typeof P !== 'undefined' ? P : {});
  if (!sourceGM) return null;
  var gmSnapshot = _autoSaveSnapshotGM(sourceGM, { detach: options.detach === true });
  var pWorking = deepClone(sourceP || {});
  if (options.prepare !== false && typeof _prepareGMForSave === 'function') {
    var prepared = _prepareGMForSave(gmSnapshot, pWorking, { omitDiscardedMirrors: true });
    if (!prepared) return null;
    gmSnapshot = _autoSaveSnapshotGM(prepared.GM, {
      reuseMutable: true,
      detach: options.detach === true
    });
    pWorking = prepared.P;
  }
  var pSnapshot = _tmStripAiKeyInPlace(pWorking);
  // P.gameState 只允许出现在 project 外壳的最外层；清掉旧读档遗留的嵌套僵尸再装当前快照。
  try { if (pSnapshot && pSnapshot.gameState) delete pSnapshot.gameState; } catch (_) {}
  if (options.format === 'project') {
    pSnapshot.gameState = gmSnapshot;
    return pSnapshot;
  }
  return { GM: gmSnapshot, P: pSnapshot };
}
if (typeof window !== 'undefined') window._buildSaveState = _buildSaveState;

function _tmCommittedSnapshotIdentityFor(state, meta){
  var snapshotGM = state && state.GM;
  if (!snapshotGM || !state.P) return null;
  meta = meta || {};
  var turn = Number(meta.turn !== undefined ? meta.turn : snapshotGM.turn);
  if (!Number.isFinite(turn)) return null;
  var loadGenerationRaw = (typeof window !== 'undefined') ? window._tmLoadGen : 0;
  if (loadGenerationRaw === undefined || loadGenerationRaw === null) loadGenerationRaw = 0;
  if (typeof loadGenerationRaw === 'string' && !loadGenerationRaw.trim()) return null;
  var loadGeneration = Number(loadGenerationRaw);
  if (!Number.isFinite(loadGeneration) || loadGeneration < 0) return null;
  return {
    campaignId: String(snapshotGM._campaignId || ''),
    timelineId: String(snapshotGM._timelineId || ''),
    sessionToken: String(meta.sessionToken || _tmGetDesktopAutoSaveSessionToken() || ''),
    loadGeneration: loadGeneration,
    turn: turn,
    transactionId: String(meta.transactionId || '')
  };
}

function _tmAdoptCommittedWorldSnapshot(state, meta){
  meta = meta || {};
  var identity = _tmCommittedSnapshotIdentityFor(state, meta);
  if (!identity) return false;
  // 默认防御性克隆，保证调用方随后修改入参也不会改变已提交基线。
  // canonical/pre_endturn 已用 detach:true 构造时可显式移交所有权，避免第二份完整世界峰值。
  var ownedState = meta.takeOwnership === true ? state : deepClone(state);
  if (!ownedState || !ownedState.GM || !ownedState.P) return false;
  lastCommittedSnapshot = ownedState;
  _autoSaveCommittedRevision++;
  lastCommittedTurn = identity.turn;
  lastCommittedTransactionId = identity.transactionId;
  _lastCommittedSnapshotIdentity = identity;
  return true;
}

function _tmInvalidateCommittedWorldSnapshot(reason){
  lastCommittedSnapshot = null;
  lastCommittedTurn = -1;
  lastCommittedTransactionId = '';
  _lastCommittedSnapshotIdentity = null;
  if (reason && typeof console !== 'undefined' && console.warn) {
    console.warn('[autoSave] 已提交世界基线失效:', String(reason));
  }
  return true;
}

function _tmCaptureCommittedWorldSnapshotFromLive(reason){
  if (!GM || !P || !GM.running || isWorldTransactionActive()) return false;
  var state = _buildSaveState({ format: 'idb', detach: true, gm: GM, p: P });
  if (!state) return false;
  return _tmAdoptCommittedWorldSnapshot(state, {
    turn: GM.turn,
    transactionId: String(reason || 'stable-world-boundary'),
    takeOwnership: true
  });
}

function _tmCommittedSnapshotMatchesLive(){
  if (!lastCommittedSnapshot || !_lastCommittedSnapshotIdentity || !GM || !P) return false;
  return String(GM._campaignId || '') === _lastCommittedSnapshotIdentity.campaignId
    && String(GM._timelineId || '') === _lastCommittedSnapshotIdentity.timelineId
    && String(_tmGetDesktopAutoSaveSessionToken() || '') === _lastCommittedSnapshotIdentity.sessionToken;
}

function _tmCommittedSnapshotProjectEnvelope(){
  if (!lastCommittedSnapshot || !lastCommittedSnapshot.GM || !lastCommittedSnapshot.P) return null;
  // 只新建轻量根对象；嵌套对象属于不可变 committed snapshot，IPC structured clone 会复制到主进程。
  var payload = Object.assign({}, lastCommittedSnapshot.P);
  if (Object.prototype.hasOwnProperty.call(payload, 'gameState')) delete payload.gameState;
  payload.gameState = lastCommittedSnapshot.GM;
  var snapshotGM = lastCommittedSnapshot.GM;
  var scenario = typeof findScenarioById === 'function' ? findScenarioById(snapshotGM.sid) : null;
  payload._saveMeta = {
    turn: lastCommittedTurn,
    scenario: (scenario && scenario.name) || '',
    saveName: snapshotGM.saveName,
    date: new Date().toISOString(),
    transactionId: lastCommittedTransactionId
  };
  return payload;
}

async function _tmRunDesktopAutoSaveTick(options){
  options = options || {};
  if (!GM || !GM.running) return { ok: false, skipped: true, reason: 'not-running' };
  if (isWorldTransactionActive()) {
    _autoSaveDeferred = true;
    return { ok: false, deferred: true, reason: 'world-transaction-active' };
  }
  if (_autoSaveInFlightPromise||_autoSaveInFlight) {
    _autoSaveSkipCount++;
    if (_autoSaveSkipCount === 5) console.warn('[autoSave] 连续 5 次被跳·上一次 IPC 尚未完成');
    return { ok: false, skipped: true, reason: 'in-flight' };
  }
  if (_autoSaveNativePending) return { ok: false, pending: true, reason: 'native-write-unconfirmed', error: _tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_UNCONFIRMED') };
  if (!_tmCommittedSnapshotMatchesLive()) {
    return { ok: false, skipped: true, reason: 'no-committed-snapshot' };
  }

  var now = Date.now();
  var sinceInput = now - _autoSaveLastInputMs;
  var sinceSave = now - _autoSaveLastDoneMs;
  if (options.force !== true && sinceInput < 5000 && sinceSave < 180000) {
    _autoSaveDeferStreak++;
    return { ok: false, skipped: true, reason: 'recent-input' };
  }
  if (_autoSaveDeferStreak > 0) _autoSaveDeferStreak = 0;
  if (options.force !== true && _autoSaveLastDoneMs > 0
      && _autoSaveLastInputMs <= _autoSaveLastDoneMs
      && lastCommittedTurn === _autoSaveLastSavedTurn && _autoSaveCommittedRevision === _autoSaveLastSavedRevision) {
    _autoSaveIdleSkipStreak++;
    return { ok: false, skipped: true, reason: 'idle-unchanged' };
  }
  _autoSaveIdleSkipStreak = 0;

  var sourceSnapshot = lastCommittedSnapshot;
  var sourceIdentity = _lastCommittedSnapshotIdentity;
  var targetGM=GM,targetP=P,targetGeneration=window._tmLoadGen||0,bridge=window.tianming;
  function snapshotStillCurrent(){return GM===targetGM&&P===targetP&&(window._tmLoadGen||0)===targetGeneration
    &&window.tianming===bridge&&lastCommittedSnapshot===sourceSnapshot&&_lastCommittedSnapshotIdentity===sourceIdentity
    &&_tmCommittedSnapshotMatchesLive();}
  var saveData = _tmCommittedSnapshotProjectEnvelope();
  if (!saveData) return { ok: false, skipped: true, reason: 'snapshot-unavailable' };
  _autoSaveInFlight = true;
  var operation=Promise.resolve().then(async function(){
    try {
      _autoSaveSkipCount = 0;
      // Optional shell capability: avoid contextBridge deep-copy/freeze of the
      // large object graph. No persistent cache, changed frequency or live-world
      // reads. Old shells keep their existing transport; errors never fall back
      // to a second write. The main session/queue/rename protocol is unchanged.
      var result = await _tmAwaitDesktopAutoSaveReply(function(){
        if(!snapshotStillCurrent()||isWorldTransactionActive())throw _tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_STALE');
        if(typeof bridge.autoSaveJson==='function'){
          var json=JSON.stringify(saveData);
          if(!snapshotStillCurrent()||isWorldTransactionActive())throw _tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_STALE');
          return bridge.autoSaveJson(json);
        }
        return bridge.autoSave(saveData);
      });
      if (!_tmDesktopAutoSaveResultOk(result)) throw _tmDesktopAutoSaveFailure(result);
      if (!snapshotStillCurrent()) {
        console.warn('[autoSave] 已提交快照在 IPC 期间推进或跨档·本次落盘有效但不推进当前局闲置基线');
        return { ok: true, stale: true, turn: Number(saveData._saveMeta.turn) };
      }
      if (result && result.sessionToken && String(result.sessionToken)!==String(sourceIdentity.sessionToken)) throw _tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_STALE');
      _autoSaveLastDoneMs = Date.now();
      _autoSaveLastSavedTurn = Number(saveData._saveMeta.turn);
      _autoSaveLastSavedRevision = _autoSaveCommittedRevision;
      _autoSaveLiteTick++;
      if (_autoSaveLiteTick >= 5) {
        _autoSaveLiteTick = 0;
        try {
          var committedP = lastCommittedSnapshot.P || {};
          localStorage.removeItem('tm_P');
          localStorage.setItem('tm_P_lite', JSON.stringify(_tmStripAiKeyView({
            scenarios: (committedP.scenarios || []).map(function(s){ return {id:s.id,name:s.name,era:s.era,role:s.role}; }),
            ai: committedP.ai,
            conf: _tmLiteSafeConf(committedP.conf),
            _hasFullData: true
          })));
        } catch (liteError) {
          _tmReportDesktopAutoSaveBoundaryError(liteError, 'desktop autosave lite');
        }
      }
      return { ok: true, turn: _autoSaveLastSavedTurn, transactionId: lastCommittedTransactionId };
    } catch (error) {
      console.warn('[autoSave] 桌面自动存档失败:', error && (error.message || error));
      return { ok: false, error: error };
    } finally {
      _autoSaveInFlight = false;
      if (_autoSaveInFlightPromise===operation) _autoSaveInFlightPromise=null;
    }
  });
  _autoSaveInFlightPromise=operation;
  return operation;
}

function _tmFlushDeferredDesktopAutoSave(reason, options){
  options = options || {};
  if (!_autoSaveDeferred) return Promise.resolve({ ok: false, skipped: true, reason: 'not-deferred' });
  if (isWorldTransactionActive()) return Promise.resolve({ ok: false, deferred: true, reason: 'world-transaction-active' });
  if (options.immediate === true) {
    _autoSaveDeferred = false;
    return _tmRunDesktopAutoSaveTick({ force: true, reason: reason || 'deferred' });
  }
  if (_autoSaveFlushTimer) return Promise.resolve({ ok: false, scheduled: true, reason: 'already-scheduled' });
  _autoSaveFlushTimer = setTimeout(function(){
    _autoSaveFlushTimer = null;
    if (!_autoSaveDeferred) return;
    if (isWorldTransactionActive()) return;
    _autoSaveDeferred = false;
    _tmRunDesktopAutoSaveTick({ force: true, reason: reason || 'deferred' }).catch(function(error){
      console.warn('[autoSave] deferred flush failed:', error && (error.message || error));
    });
  }, 0);
  return Promise.resolve({ ok: false, scheduled: true, reason: reason || 'deferred' });
}

function _tmRequestDeferredDesktopAutoSaveFlush(reason, options){
  if (typeof _tmFlushDeferredDesktopAutoSave !== 'function') {
    return Promise.resolve({ ok: false, skipped: true, reason: 'flush-unavailable' });
  }
  var pending;
  try {
    pending = _tmFlushDeferredDesktopAutoSave(reason, options);
  } catch (error) {
    var syncError = _tmReportDesktopAutoSaveBoundaryError(error, 'deferred desktop autosave flush · ' + String(reason || 'unknown'));
    return Promise.resolve({ ok: false, error: syncError });
  }
  return Promise.resolve(pending).catch(function(error){
    var asyncError = _tmReportDesktopAutoSaveBoundaryError(error, 'deferred desktop autosave flush · ' + String(reason || 'unknown'));
    return { ok: false, error: asyncError };
  });
}

if (typeof window !== 'undefined') {
  window.isWorldTransactionActive = isWorldTransactionActive;
  window._tmAdoptCommittedWorldSnapshot = _tmAdoptCommittedWorldSnapshot;
  window._tmInvalidateCommittedWorldSnapshot = _tmInvalidateCommittedWorldSnapshot;
  window._tmCaptureCommittedWorldSnapshotFromLive = _tmCaptureCommittedWorldSnapshotFromLive;
  window._tmRunDesktopAutoSaveTick = _tmRunDesktopAutoSaveTick;
  window._tmDesktopAutoSaveTransportStatus = _tmDesktopAutoSaveTransportStatus;
  window._tmFlushDeferredDesktopAutoSave = _tmFlushDeferredDesktopAutoSave;
  window.requestBackgroundAutosave = requestBackgroundAutosave;
  window._tmDrainBackgroundAutosaves = _tmDrainBackgroundAutosaves;
  window._tmAwaitBackgroundAutosaves = _tmAwaitBackgroundAutosaves;
}

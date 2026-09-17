// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-apply-stages.js — endturn writeBack 阶段函数（类③巨石解构·apply解构 S2）
//
// 范式（IIFE 型·origin-first·ns.stages 运行时解析）：
//   本片是 tm-endturn-apply.js（origin）的保序切割 sibling，装载序【紧随 origin 之后】
//   （index.html · 双戳 ?v=20260706-applyS2）。origin 的 writeBack 已变薄为 dispatcher，
//   在运行时（回合推演调用期，远晚于两片装载）调用 ns.stages.<stage>(ctx)——故 sibling
//   载于 origin 之后安全（装载期不互相调用，仅定义）。
//   跨文件词法可见性：origin 与本片同为经典 <script>（非 module），bare 全局标识符
//   （GM/addEB/applyAITurnChanges/callAI/callAIWithTools/preflightAIWriteBack/DebugLog/
//   _fuzzyFindChar 等）在两片中同样解析到全局对象；IIFE 参数名沿用 `global`，令迁出体内
//   `global.TM.MemoryTurnInference` 等引用与 origin 逐字节等价。
//
// 两个 stage（自 origin writeBack 逐字节迁出·仅加函数壳与状态解构·业务体不改）：
//   ns.stages._applyCore_reconcile(ctx)  —— AP-1：applyAITurnChanges 主应用 + province_changes
//     surface + 辅臣拟议/奏疏代拟/一致性 reconcile 自审（4 处 await）。_surfaceUnappliedChanges
//     仅本 stage 消费·随迁本片模块作用域。
//   ns.stages._applyPostValidateAssemble(ctx, _st)  —— AP-6：幻觉防火墙后验 + 记忆入账
//     （enqueuePostTurnCandidates/archiveTurn/rebuildFromArchive）+ ctx.record 组装 + return ctx。
//     读 writeBack 局部变量（p1/文本族/_applied/_applyStart）经状态包 _st 传入·函数顶部解构回
//     同名 var 以保业务体逐字节一致。
// ============================================================
(function(global) {
  if (typeof global.TM === "undefined") global.TM = {};
  if (typeof global.TM.Endturn === "undefined") global.TM.Endturn = {};
  if (typeof global.TM.Endturn.AI === "undefined") global.TM.Endturn.AI = {};
  if (typeof global.TM.Endturn.AI.apply === "undefined") global.TM.Endturn.AI.apply = {};

  var ns = global.TM.Endturn.AI.apply;
  ns.stages = ns.stages || {};

  // 【落地核对·2026-06】applyAITurnChanges 返回 {applied:{failed:[]}}·原两调用点丢弃返回值→AI 声明应用失败 100% 静默(owner 痛点#1:摘要显示了却没改到状态)。此助手接住失败清单·记 GM._unappliedChanges + console.warn + addEB·让"显示了却没落地"从看不见变看得见(这是修#1的 keystone·后续按 GM._unappliedChanges 对症)。
  function _surfaceUnappliedChanges(applyRes, source) {
    try {
      var failed = (applyRes && applyRes.applied && Array.isArray(applyRes.applied.failed)) ? applyRes.applied.failed : [];
      if (!failed.length) return;
      if (typeof GM === 'undefined' || !GM) return;
      if (!Array.isArray(GM._unappliedChanges)) GM._unappliedChanges = [];
      failed.forEach(function (f) { try { GM._unappliedChanges.push(Object.assign({ turn: GM.turn || 0, source: source }, f)); } catch (_) {} });
      if (GM._unappliedChanges.length > 80) GM._unappliedChanges = GM._unappliedChanges.slice(-80);
      var byReason = {};
      failed.forEach(function (f) { var r = (f && f.reason) || 'unknown'; byReason[r] = (byReason[r] || 0) + 1; });
      var summary = Object.keys(byReason).map(function (r) { return r + '×' + byReason[r]; }).join('·');
      try { console.warn('[落地核对·' + source + '] ' + failed.length + ' 项 AI 声明未落地: ' + summary, failed); } catch (_) {}
      if (typeof addEB === 'function') { try { addEB('⚠落地核对', source + '·' + failed.length + ' 项 AI 声明未能落地(' + summary + ')·详见控制台 GM._unappliedChanges'); } catch (_) {} }
    } catch (e) { try { console.warn('[落地核对] surface failed', e); } catch (_) {} }
  }

  // _unappliedChanges 的单一写主；其他模块运行时动态调用本入口，避免各自闯入内部子树。
  ns.recordUnappliedChange = function(entry, source) {
    _surfaceUnappliedChanges({ applied:{ failed:[entry || { reason:'unknown writeback failure' }] } }, source || 'endturn-writeback');
  };

  function _stageSemanticFailure(kind, ref, reason) {
    ns.recordUnappliedChange({ kind:kind, ref:ref, reason:reason }, 'endturn-reconcile');
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_gate', { label:kind, ref:ref, reason:reason }); } catch (_) {}
    return false;
  }

  function _cloneWritebackValue(value) {
    if (value == null || typeof value !== 'object') return value;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) {}
    }
    if (typeof deepClone === 'function') return deepClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function _collectWritebackRepairCandidates() {
    var G = typeof GM !== 'undefined' && GM ? GM : {};
    var offices = [];
    var regions = [];
    var seenRegions = [];
    function walkOffice(nodes) {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(function(node) {
        if (!node || typeof node !== 'object') return;
        if (node.id || node.name || node.title || node.position) offices.push({ id:node.id || '', name:node.name || node.title || node.position || '' });
        if (Array.isArray(node.subs)) walkOffice(node.subs);
        if (Array.isArray(node.children)) walkOffice(node.children);
        if (Array.isArray(node.positions)) walkOffice(node.positions);
      });
    }
    function addRegion(row) {
      if (!row || typeof row !== 'object' || seenRegions.indexOf(row) >= 0) return;
      seenRegions.push(row);
      if (row.id || row.name) regions.push({ id:row.id || '', name:row.name || '' });
      if (Array.isArray(row.children)) row.children.forEach(addRegion);
      if (Array.isArray(row.subs)) row.subs.forEach(addRegion);
      if (Array.isArray(row.divisions)) row.divisions.forEach(addRegion);
    }
    walkOffice(G.officeTree);
    var map = G.mapData || G.map;
    if (map && Array.isArray(map.regions)) map.regions.forEach(addRegion);
    if (G.regionMap && typeof G.regionMap === 'object') Object.keys(G.regionMap).forEach(function(key) { addRegion(G.regionMap[key]); });
    if (G.adminHierarchy && typeof G.adminHierarchy === 'object') Object.keys(G.adminHierarchy).forEach(function(key) { addRegion(G.adminHierarchy[key]); });
    return {
      characters: (Array.isArray(G.chars) ? G.chars : []).slice(0, 160).map(function(ch) { return { id:ch && ch.id || '', name:ch && ch.name || '', alive:!(ch && (ch.alive === false || ch.dead === true)) }; }),
      factions: (Array.isArray(G.facs) ? G.facs : []).slice(0, 120).map(function(fac) { return { id:fac && fac.id || '', name:fac && fac.name || '' }; }),
      offices: offices.slice(0, 200),
      regions: regions.slice(0, 200)
    };
  }

  function _parseWritebackRepair(raw) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    var text = String(raw == null ? '' : raw).trim();
    if (!text) return null;
    try {
      return typeof robustParseJSON === 'function' ? robustParseJSON(text) : JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function _writebackRepairSlot(field, index) {
    return String(field || '') + ':' + (Number.isInteger(index) ? String(index) : '$');
  }

  function _identityFieldsForFailure(failure) {
    if (!failure || failure.retryable !== true) return [];
    var field = String(failure.field || '');
    var code = String(failure.code || '');
    if (!/(not-found|ambiguous-reference|missing-required-field|invalid-target|office-not-found)/.test(code)) return [];
    if (Array.isArray(failure.identityFields) && failure.identityFields.length) return failure.identityFields.slice();
    if (/^(appointments|char_updates|office_assignments|personnel_changes|character_deaths)$/.test(field)) {
      if (code === 'office-not-found') return ['post', 'position', 'toPosition', 'officeId'];
      return ['characterId', 'charId', 'charName', 'character', 'name'];
    }
    if (/^(faction_updates|faction_dissolve|faction_succession|battleResult)$/.test(field)) {
      return [
        'factionId', 'faction', 'id', 'name',
        'newLeaderId', 'newLeader',
        'winnerFactionId', 'winnerFaction', 'winner',
        'loserFactionId', 'loserFaction', 'loser',
        'targetFactionId', 'targetFaction', 'newFactionId', 'newFaction', 'toFactionId', 'toFaction'
      ];
    }
    if (/^(region_updates|population_adjustments|central_local_actions|environment_actions)$/.test(field)) {
      return ['regionId', 'region_id', 'region', 'targetRegion', 'target'];
    }
    return [];
  }

  function _buildWritebackRepairAllowlist(failures) {
    var allowed = Object.create(null);
    (Array.isArray(failures) ? failures : []).forEach(function(failure) {
      var fields = _identityFieldsForFailure(failure);
      if (!fields.length) return;
      var slot = _writebackRepairSlot(failure.field, failure.index);
      if (!allowed[slot]) allowed[slot] = { field:String(failure.field || ''), index:Number.isInteger(failure.index) ? failure.index : null, fields:Object.create(null), failures:[] };
      fields.forEach(function(field) { allowed[slot].fields[field] = true; });
      allowed[slot].failures.push(failure);
    });
    return allowed;
  }

  function _repairComparable(value, ignoredTopLevelFields, depth) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(function(row) { return _repairComparable(row, null, (depth || 0) + 1); });
    var out = {};
    Object.keys(value).sort().forEach(function(key) {
      if ((depth || 0) === 0 && ignoredTopLevelFields && ignoredTopLevelFields[key]) return;
      out[key] = _repairComparable(value[key], null, (depth || 0) + 1);
    });
    return out;
  }

  function _repairPreservesSemantics(before, after, allowedFields) {
    try {
      return JSON.stringify(_repairComparable(before, allowedFields, 0)) === JSON.stringify(_repairComparable(after, allowedFields, 0));
    } catch (_) {
      return false;
    }
  }

  function _applyTargetedWritebackRepairs(batch, response, allowlist) {
    if (!response || typeof response !== 'object' || !Array.isArray(response.repairs)) {
      return { ok:false, code:'invalid-repair-response' };
    }
    if (response.semanticUnchanged !== true) return { ok:false, code:'repair-semantic-change-requires-regeneration' };
    if (String(response.narrativePatch || '').trim()) return { ok:false, code:'repair-narrative-patch-not-allowed' };
    var next = _cloneWritebackValue(batch);
    var applied = 0;
    var seen = Object.create(null);
    for (var repairIndex = 0; repairIndex < response.repairs.length; repairIndex++) {
      var repair = response.repairs[repairIndex];
      if (!repair || typeof repair !== 'object' || !repair.field || !repair.item || typeof repair.item !== 'object') {
        return { ok:false, code:'invalid-repair-item', repairIndex:repairIndex };
      }
      var field = String(repair.field);
      var index = Number.isInteger(repair.index) ? repair.index : null;
      var slot = _writebackRepairSlot(field, index);
      var permission = allowlist && allowlist[slot];
      if (!permission) return { ok:false, code:'repair-target-not-allowed', field:field, index:index };
      if (seen[slot]) return { ok:false, code:'duplicate-repair-target', field:field, index:index };
      seen[slot] = true;
      if (!Object.prototype.hasOwnProperty.call(next, field)) return { ok:false, code:'repair-field-missing', field:field };
      var before;
      if (index !== null) {
        if (!Array.isArray(next[field]) || index < 0 || index >= next[field].length) return { ok:false, code:'repair-index-out-of-range', field:field, index:index };
        before = next[field][index];
      } else {
        if (Array.isArray(next[field]) || !next[field] || typeof next[field] !== 'object') return { ok:false, code:'repair-scalar-shape-invalid', field:field };
        before = next[field];
      }
      if (!_repairPreservesSemantics(before, repair.item, permission.fields)) {
        return { ok:false, code:'repair-changed-business-semantics', field:field, index:index };
      }
      if (index !== null) next[field][index] = _cloneWritebackValue(repair.item);
      else next[field] = _cloneWritebackValue(repair.item);
      applied++;
    }
    if (!applied) return { ok:false, code:'repair-applied-nothing' };
    return { ok:true, output:next, applied:applied };
  }

  async function _validateAndRepairMainWriteback(batch, opts) {
    opts = opts || {};
    if (typeof global.validateAIWriteBackBatch !== 'function') {
      var unavailable = new Error('AI 主写回严格预检器未加载');
      unavailable.code = 'writeback-preflight-unavailable';
      throw unavailable;
    }
    var current = _cloneWritebackValue(batch);
    var validation = global.validateAIWriteBackBatch(current, { source:opts.source || 'endturn-full-p1' });
    var attempts = 0;
    var lastRepairFailureCode = '';
    while (!validation.ok && attempts < 2) {
      if (typeof callAI !== 'function') break;
      var repairable = validation.failures.filter(function(failure) { return _identityFieldsForFailure(failure).length > 0; }).slice(0, 24);
      var allowlist = _buildWritebackRepairAllowlist(repairable);
      if (!Object.keys(allowlist).length) break;
      attempts++;
      var failures = repairable.map(function(failure) {
        var permission = allowlist[_writebackRepairSlot(failure.field, failure.index)];
        return {
          field:failure.field,
          index:failure.index,
          code:failure.code,
          target:failure.target,
          reason:failure.reason,
          allowedIdentityFields:permission ? Object.keys(permission.fields) : [],
          item:failure.item || (Array.isArray(current[failure.field]) && Number.isInteger(failure.index) ? current[failure.field][failure.index] : current[failure.field])
        };
      });
      var prompt = '【AI 主写回定向修复】\n' +
        '只修正下列 retryable 失败槽位中列出的身份引用字段；不得修改动作、数量、方向、效果或任何已通过项目。\n' +
        '每个槽位最多返回一次 repair；必须 semanticUnchanged=true 且 narrativePatch 为空。无法保持业务语义时不要猜测，本回合将整体重新生成。\n' +
        '返回唯一 JSON：{"repairs":[{"field":"数组字段","index":0,"item":{完整修正项}}],"semanticUnchanged":true,"narrativePatch":""}\n' +
        '失败项：' + JSON.stringify(failures) + '\n' +
        '可用候选：' + JSON.stringify(_collectWritebackRepairCandidates()) + '\n' +
        '原叙事节选：' + String(current.shizhengji || current.narrative || '').slice(0, 1800);
      var rawRepair = await callAI(prompt, 2200, undefined, 'secondary', {
        priority:'critical', timeoutMs:50000, maxRetries:0, temperature:0
      });
      var repair = _applyTargetedWritebackRepairs(current, _parseWritebackRepair(rawRepair), allowlist);
      if (!repair.ok) {
        lastRepairFailureCode = repair.code || 'repair-rejected';
        continue;
      }
      current = repair.output;
      validation = global.validateAIWriteBackBatch(current, { source:'endturn-writeback-repair-' + attempts });
    }
    if (!validation.ok) {
      var error = new Error('AI 主写回预检失败；本回合未修改世界状态，可重新生成本回合');
      error.code = 'ai-writeback-preflight-failed';
      error.writebackFailures = validation.failures.slice(0, 40).map(function(failure) {
        return Object.assign({ attempts:attempts, finalRollbackReason:'preflight-failed' }, failure);
      });
      error.repairAttempts = attempts;
      error.lastRepairFailureCode = lastRepairFailureCode;
      throw error;
    }
    return { ok:true, output:validation.output, repairAttempts:attempts };
  }
  ns._validateAndRepairMainWriteback = _validateAndRepairMainWriteback;

  // 刀丁4·单个 record_conspiracy_event 处理出口(P-QAM 硬门+落库+下狱+regicide→adjudicatePlayerDeath)。
  //   reconcile 补录与 ConspiracyEngine 五级发动出口共用此 sink(抽公共函数两处调)。
  //   opts.fromEngine=true(引擎发动)→落 _fromEngine(与 tick 剪枝握手 R-5)·缺省(AI 补录)→落 _autoFromReconcile(旧行为等价)。
  ns._applyOneConspiracyEvent = function(e, opts) {
                if (!GM._conspiracies) GM._conspiracies = [];
                // P-QAM·政变/弑君得逞硬门：AI 凭空坐实"政变成功/弑君/宫变"前，确定性读皇权皇威——
                //   君威正盛(皇权或皇威≥阈值)时这类得逞不合理 → 降为"未遂(suppressed/coup_failed)"、主谋下狱、邸报留痕。
                //   不夺 AI 编情节自由(失败/败露的阴谋照常坐实)，只挡"凭空得逞"。阈值机制参数·owner 可调。
                var _action = e.action, _outcome = e.outcome || 'suppressed';
                var _isSuccess = (_outcome === 'succeeded') || _action === 'coup_succeeded' || _action === 'regicide' || _action === 'palace_coup';
                var _qamGated = false;
                if (_isSuccess) {
                  var _hq = (GM.huangquan && typeof GM.huangquan.index === 'number') ? GM.huangquan.index : 50;
                  var _hw = (GM.huangwei && typeof GM.huangwei.index === 'number') ? GM.huangwei.index : 50;
                  var _qdC = ({narrative:'narrative',standard:'standard',hardcore:'hardcore','简单':'narrative','普通':'standard','中等':'standard','困难':'hardcore','地狱':'hardcore'})[(typeof P!=='undefined'&&P.conf&&P.conf.difficulty)||'']||'standard';
                  var P_QAM_COUP_HQ = _qdC==='narrative'?45:(_qdC==='hardcore'?75:60), P_QAM_COUP_HW = P_QAM_COUP_HQ; // 皇权或皇威≥此驳回凭空政变·按难度:叙事45(稍强即拦护玩家)/标准60/硬核75(更易政变)
                  if (_hq >= P_QAM_COUP_HQ || _hw >= P_QAM_COUP_HW) {
                    _qamGated = true;
                    _action = 'coup_failed';
                    _outcome = 'suppressed';
                    if (typeof addEB === 'function') addEB('谋反', (e.instigator||'某人') + ' 谋' + ({coup_succeeded:'变',regicide:'弑君',palace_coup:'宫变'}[e.action]||'逆') + '，然皇权 ' + Math.round(_hq) + '·皇威 ' + Math.round(_hw) + ' 正盛，事败就擒（确定性护栏·未遂）');
                  }
                }
                GM._conspiracies.push({ turn: GM.turn||0, action: _action, instigator: e.instigator, target: e.target||'', outcome: _outcome, conspirators: e.conspirators||[], reason: e.reason||'', _autoFromReconcile: !(opts && opts.fromEngine), _fromEngine: !!(opts && opts.fromEngine), _qamGated: _qamGated || undefined });
                // 主谋通常应受惩·登记 NPC 状态（被门降级的得逞→按未遂同样下狱）
                var inst = (GM.chars||[]).find(function(c){return c && c.name === e.instigator;});
                if (inst && (_outcome === 'suppressed' || _action === 'plot_failed' || _action === 'coup_failed')) {
                  inst._imprisoned = true;
                  inst._conspiracyConvicted = true;
inst._imprisonedTurn = GM.turn||0;
                  inst._imprisonReason = '谋逆事发·下诏狱待勘';
                }
                // 鼎革R1c(2026-07-07)：弑君得逞不再只记史册(勘察D静默杀漏洞②——AI 判 regicide
                //   succeeded 此前只 push 一条史录·玩家角色照活照玩)。过 P-QAM 硬门的弑君是
                //   「玩家角色被杀」这一具体事件：标死+走 R1a 裁决器(有储君继统续玩/绝嗣终局)。
                //   palace_coup/coup_succeeded 得逞≠必弑君(废立/挟持)·归 R1d 废帝态·此处不越界。
                if (!_qamGated && _action === 'regicide' && _outcome === 'succeeded') {
                  var _sov = (typeof TM !== 'undefined' && TM.Player && typeof TM.Player.getCharacter === 'function')
                    ? TM.Player.getCharacter(GM)
                    : (GM.chars || []).find(function(c) { return c && c.isPlayer === true; });
                  var _pcName = _sov ? _sov.name : '';
                  if (!_sov) {
                    _stageSemanticFailure('conspiracy_events.regicide', _pcName || '(player)', 'player character not found');
                  } else if (_sov.alive !== false && !_sov.dead) {
                    var _regicideReason = '为' + (e.instigator || '逆党') + '所弑';
                    var _regicideRouteFailed = false;
                    try {
                      if (typeof global.applyOneDeath === 'function') global.applyOneDeath({ name:_sov.name, reason:_regicideReason });
                      else if (typeof global.applyCharacterDeaths === 'function') global.applyCharacterDeaths({ character_deaths:[{ name:_sov.name, reason:_regicideReason }] });
                      else { _regicideRouteFailed = true; _stageSemanticFailure('conspiracy_events.regicide', _sov.name, 'death pipeline unavailable'); }
                    } catch (_regicideE) {
                      _regicideRouteFailed = true;
                      _stageSemanticFailure('conspiracy_events.regicide', _sov.name, 'death pipeline exception: ' + ((_regicideE && _regicideE.message) || _regicideE));
                    }
                    if (!_regicideRouteFailed && _sov.alive !== false && !_sov.dead) _stageSemanticFailure('conspiracy_events.regicide', _sov.name, 'death pipeline did not apply');
                    if ((_sov.alive === false || _sov.dead) && typeof addEB === 'function') addEB('国变', (_sov.name || '天子') + '为' + (e.instigator || '逆党') + '所弑·大行崩逝，天下震动', { credibility: 'high' });
                  }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: '_conspiracies', label: '谋反·' + e.instigator + '·' + _action + '/' + _outcome, delta: 1, reason: e.reason || '一致性补录' });
  };

  function _stageSetPartyLeader(party, ref, reason) {
    var raw = String(ref == null ? '' : ref).trim();
    var ch = (typeof GM !== 'undefined' && GM && Array.isArray(GM.chars)) ? GM.chars.find(function(c) {
      return c && ((c.name != null && String(c.name).trim() === raw) || (c.id != null && String(c.id).trim() === raw));
    }) : null;
    if (!ch || ch.alive === false || ch.dead === true) return _stageSemanticFailure('party_events.leader', ref, 'leader must be an existing living character');
    var sink = global.TM && global.TM.AIChange && global.TM.AIChange.Narrative && global.TM.AIChange.Narrative.setPartyLeader;
    if (typeof sink !== 'function') return _stageSemanticFailure('party_events.leader', ref, 'party leader sink unavailable');
    sink(party, ch.name, GM, reason || '一致性补录立党');
    return party.leader === ch.name && party.head === ch.name ? true : _stageSemanticFailure('party_events.leader', ref, 'party leader sink rejected write');
  }

  // ── AP-1（自 origin writeBack sc1 写回主体逐字节迁出·if(p1) 由 dispatcher 保留·此处 recompute p1）──
  ns.stages._applyCore_reconcile = async function(ctx) {
    var p1 = ctx.results.sc1 || null;
        var _strictPreflight = await _validateAndRepairMainWriteback(p1, { source:'endturn-full-p1' });
        p1 = _strictPreflight.output;
        ctx.results.sc1 = p1;
        // char_updates 的 alive/dead 先在原始 p1 上规范化：后续既有 applyCharacterDeaths(p1)
        // 负责唯一死亡 sink；同时把敏感键从共享 char_update 对象移除，防通用 merge 裸写。
        var _deathNorm1 = { added: [], failed: [], normalized: 0 };
        try { if (p1 && typeof global.normalizeAIWriteBackDeaths === 'function') _deathNorm1 = global.normalizeAIWriteBackDeaths(p1, { source: 'endturn-full-p1', deferDeaths: true }) || _deathNorm1; } catch(_dnE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_dnE, 'endturn] normalizeAIWriteBackDeaths') : console.warn('[endturn] normalizeAIWriteBackDeaths:', _dnE); }
        // 方案融入：AI 产出的通用变化/任免/机构/区划/事件/NPC行动/关系 → 统一应用
        try {
          if (typeof applyAITurnChanges === 'function') {
            var _applyRes1 = applyAITurnChanges({
              _strictValidation: true,
              narrative: p1.shizhengji || '',
              changes: Array.isArray(p1.changes) ? p1.changes : [],
              appointments: Array.isArray(p1.appointments) ? p1.appointments : [],
              institutions: Array.isArray(p1.institutions) ? p1.institutions : [],
              regions: Array.isArray(p1.regions) ? p1.regions : [],
              events: Array.isArray(p1.events) ? p1.events : [],
              npc_actions: Array.isArray(p1.npc_actions) ? p1.npc_actions : [],
              relations: Array.isArray(p1.relations) ? p1.relations : [],
              // 关键补传：AI 返回的财政/人事/势力/党派调整要透传给 applier
              fiscal_adjustments: Array.isArray(p1.fiscal_adjustments) ? p1.fiscal_adjustments : [],
              currency_adjustments: Array.isArray(p1.currency_adjustments) ? p1.currency_adjustments : [],
              population_adjustments: Array.isArray(p1.population_adjustments) ? p1.population_adjustments : [],
              central_local_actions: Array.isArray(p1.central_local_actions) ? p1.central_local_actions : [],
              environment_actions: Array.isArray(p1.environment_actions) ? p1.environment_actions : [],
              institution_changes: Array.isArray(p1.institution_changes) ? p1.institution_changes : [],
              char_updates: Array.isArray(p1.char_updates) ? p1.char_updates : [],
              office_assignments: Array.isArray(p1.office_assignments) ? p1.office_assignments : [],
              // 刀9·随主叙事同传结构化死亡名单给校验器(令结构化死者进 handled·免主链把正经死亡错记无源+吐垃圾弱提示)。
              //   Codex 二审对照实测确认走标准键安全：normalizeAIWriteBackDeaths 只路由 char_updates 合成死亡·不 apply 显式 character_deaths→
              //   本 applyAITurnChanges 死亡 sink=0(不落库)·仅 _processDeathEpitaphs 消费一次生成墓志铭(墓志铭=1)·避免 advisory 影子键漏掉墓志铭消费者；
              //   真死亡仍唯一由稍后 tm-endturn-apply.js:997 的 applyCharacterDeaths(p1) 落库(sink=1·已死幂等闸防双墓志铭)。
              character_deaths: Array.isArray(p1.character_deaths) ? p1.character_deaths : [],
              faction_updates: Array.isArray(p1.faction_updates) ? p1.faction_updates : [],
              party_updates: Array.isArray(p1.party_updates) ? p1.party_updates : [],
              // v2 结构化扩展字段必须跟主 p1 同回合抵达 applier；此前 prompt 宣告但 dispatcher 遗漏，形成静默黑洞。
              tax_reforms: Array.isArray(p1.tax_reforms) ? p1.tax_reforms : (Array.isArray(p1.taxReforms) ? p1.taxReforms : []),
              class_updates: Array.isArray(p1.class_updates) ? p1.class_updates : [],
              region_updates: Array.isArray(p1.region_updates) ? p1.region_updates : [],
              project_updates: Array.isArray(p1.project_updates) ? p1.project_updates : [],
              anyPathChanges: Array.isArray(p1.anyPathChanges) ? p1.anyPathChanges : [],
              // 兜底：AI 常只写 personnel_changes (展示用) 而不写 office_assignments — applier 里做备胎消费
              personnel_changes: Array.isArray(p1.personnel_changes) ? p1.personnel_changes : [],
              // 问天 directive 合规回报
              directive_compliance: Array.isArray(p1.directive_compliance) ? p1.directive_compliance : [],
              regent_decisions: Array.isArray(p1.regent_decisions) ? p1.regent_decisions : []
            });
            if (_deathNorm1.failed && _deathNorm1.failed.length) {
              _applyRes1.applied = _applyRes1.applied || {};
              _applyRes1.applied.failed = Array.isArray(_applyRes1.applied.failed) ? _applyRes1.applied.failed : [];
              Array.prototype.push.apply(_applyRes1.applied.failed, _deathNorm1.failed);
            }
            _surfaceUnappliedChanges(_applyRes1, 'sc1主应用');  // 【落地核对】接住失败清单·让静默 #1 可见
            if (!_applyRes1 || _applyRes1.ok !== true || (_applyRes1.applied && _applyRes1.applied.failed && _applyRes1.applied.failed.length)) {
              throw new Error('AI 主写回未能原子提交');
            }
          }
        } catch(_applyErr) {
          (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_applyErr, 'endturn] applyAITurnChanges:') : console.warn('[endturn] applyAITurnChanges:', _applyErr);
          throw _applyErr;
        }

        // 【落地核对·Slice3·2026-06】province_changes 是无 handler 的冗余自由字段(省级意图应走 population_adjustments/central_local_actions/localActions/fiscal 等有 handler 字段)·原本被收集喂下回合却从不 mutate state→纯静默落空。此处显式 surface·让真机从 GM._unappliedChanges 看到 AI 实际往里塞什么·据此再决定补 handler 还是删 schema(不盲改)。
        try {
          if (p1 && Array.isArray(p1.province_changes) && p1.province_changes.length && typeof GM !== 'undefined' && GM) {
            if (!Array.isArray(GM._unappliedChanges)) GM._unappliedChanges = [];
            GM._unappliedChanges.push({ turn: GM.turn || 0, source: 'province_changes', count: p1.province_changes.length, sample: p1.province_changes.slice(0, 3), reason: 'province_changes 无 apply handler(省级变化请走 population_adjustments/central_local_actions)' });
            if (GM._unappliedChanges.length > 80) GM._unappliedChanges = GM._unappliedChanges.slice(-80);
            try { console.warn('[落地核对·province_changes] ' + p1.province_changes.length + ' 项省级变化无 handler·未落地·样本:', p1.province_changes.slice(0, 3)); } catch (_) {}
            if (typeof addEB === 'function') { try { addEB('⚠落地核对', 'province_changes·' + p1.province_changes.length + ' 项省级变化无 handler 未落地·详见 GM._unappliedChanges'); } catch (_) {} }
          }
        } catch (_pcSurfaceE) {}

        // ═══════════════════════════════════════════════════════════════════
        // 辅臣拟议·AI 生成 (Stage 2·2026-06-02)·御前待批奏疏的辅臣处理建议
        //   decoupled secondary 调用 (同 reconcile 范式)·失败不影响主流程·写 m._fuchenNiyi (UI 御览批红右栏读)
        //   跨朝代中立：提示词禁后世专名(内阁/票拟)·以「辅臣/近臣」通称·辅臣带立场私心
        // ═══════════════════════════════════════════════════════════════════
        try {
          if (GM && Array.isArray(GM.memorials) && typeof callAI === 'function') {
            var _niyiPend = GM.memorials.filter(function(m){ return m && !m._fuchenNiyi && (m.status === 'pending' || m.status === 'pending_review'); }).slice(0, 8);
            if (_niyiPend.length) {
              var _niyiList = _niyiPend.map(function(m, i){ return (i + 1) + '. 【' + (m.type || '奏疏') + (m.subtype ? '·' + m.subtype : '') + '】' + (m.from || '臣工') + '：' + String(m.title || '').slice(0, 40) + '　—　' + String(m.text || m.content || '').slice(0, 90); }).join('\n');
              var _niyiPrompt = '【辅臣拟议】\n你扮演当朝中枢辅臣（佐理机务的首席文臣·按本朝制度而定·勿用后世专名如内阁/票拟）。下列奏疏已呈御前·请为每封拟一句简短处理建议（依议/驳之/缓议/会官详议/下有司核议/留中再观）·并略陈一句理由。\n要带你自己的立场与分寸（循资守成或锐意任事·护党或秉公·畏事或敢任）·按辅臣本色·不必全然中正。\n密折/警报系直达御前不付外廷者·以「近臣」口吻拟·余以「辅臣」口吻。\n\n奏疏清单：\n' + _niyiList + '\n\n只输出 JSON 数组·每项 {"i":序号,"niyi":"拟议正文(建议+一句理由·40字内)"}·勿输出其他文字。';
              var _niyiRaw = await callAI(_niyiPrompt, 900, undefined, 'secondary', { priority: 'low', timeoutMs: 45000, maxRetries: 1 });
              if (_niyiRaw) {
                var _niyiArr = null;
                try { var _np = (typeof robustParseJSON === 'function') ? robustParseJSON(String(_niyiRaw)) : JSON.parse(String(_niyiRaw)); if (Array.isArray(_np)) _niyiArr = _np; } catch(_nje) {}
                if (Array.isArray(_niyiArr)) {
                  _niyiArr.forEach(function(o){ if (!o || o.niyi == null) return; var _ix = Number(o.i) - 1; if (_ix >= 0 && _ix < _niyiPend.length) _niyiPend[_ix]._fuchenNiyi = String(o.niyi).slice(0, 120); });
                }
              }
            }
          }
        } catch (_niyiErr) { /* 辅臣拟议失败不影响主流程 */ }

        // 奏疏代拟正文·AI 生成(照辅臣拟议范式·decoupled secondary·失败不影响主流程·保确定性中文兜底·2026-06-13)
        //   有司具题的程式化奏疏(民情积压等·_needsAiBody)以上奏大臣口吻代拟正经正文·AI失败/空/夹英文则保 _pressureReasonCN 中文兜底
        try {
          if (GM && Array.isArray(GM.memorials) && typeof callAI === 'function') {
            var _NL10 = String.fromCharCode(10);
            var _zsDraft = GM.memorials.filter(function(m){ return m && m._needsAiBody && !m._aiBodyDone && (m.status === 'pending' || m.status === 'pending_review'); }).slice(0, 6);
            if (_zsDraft.length) {
              var _zsList = _zsDraft.map(function(m, i){ var c = m._minxinPressureCandidate || {}; return (i + 1) + '. 上奏者【' + (m.from || '有司') + '】·' + (c.regionName || '') + '·' + (c.className || '') + '民心实情' + Math.round(c['true'] || 0) + (c.perceived != null ? '，朝堂观感' + Math.round(c.perceived) : '') + '·缘由：' + String(m.text || m.content || '').replace(/\s+/g, ' ').slice(0, 70); }).join(_NL10);
              var _zsPrompt = '【奏疏代拟】' + _NL10 + '下列地方民情积压已由有司具题待呈御前。请以各自上奏者(大臣)的口吻·按本朝制度(勿用内阁/票拟等后世专名)·为每封代拟一道正经奏疏正文：陈情(实情与缘由)→略陈成因隐患→提出处置建议(安抚/赈济/蠲免/查劾/付廷议等)·150-240字·纯中文文言奏疏体·不夹英文字段名。' + _NL10 + _NL10 + '奏疏清单：' + _NL10 + _zsList + _NL10 + _NL10 + '只输出 JSON 数组·每项 {"i":序号,"body":"奏疏正文"}·勿输出其他文字。';
              var _zsRaw = await callAI(_zsPrompt, 2400, undefined, 'secondary', { priority: 'low', timeoutMs: 50000, maxRetries: 1 });
              if (_zsRaw) {
                var _zsArr = null;
                try { var _zp = (typeof robustParseJSON === 'function') ? robustParseJSON(String(_zsRaw)) : JSON.parse(String(_zsRaw)); if (Array.isArray(_zp)) _zsArr = _zp; } catch (_zje) {}
                if (Array.isArray(_zsArr)) {
                  _zsArr.forEach(function(o){ if (!o || o.body == null) return; var _ix = Number(o.i) - 1; if (_ix < 0 || _ix >= _zsDraft.length) return; var _b = String(o.body).trim(); if (_b.length >= 20 && !/[a-zA-Z]{4,}/.test(_b)) { _zsDraft[_ix].content = _b; _zsDraft[_ix].text = _b; _zsDraft[_ix]._aiBodyDone = true; } });
                }
              }
            }
          }
        } catch (_zsErr) { /* 奏疏代拟失败不影响主流程·保确定性中文兜底 */ }

        // 空体奏疏兜底:sc1主推演等吐了空 content 的奏疏(图2「暂无正文」根治)→给确定性中文兜底体·绝不显「暂无正文」(2026-06-13)
        try {
          if (GM && Array.isArray(GM.memorials)) {
            GM.memorials.forEach(function (m) {
              if (!m || m._emptyFallbackDone) return;
              if (String(m.text || m.content || '').trim()) return;
              var _ttl = String(m.title || m.topic || '').trim();
              if (!_ttl && !m.from && !m.type) return;
              var _from = String(m.from || '有司').trim() || '有司';
              var _fb = _ttl ? ('臣' + _from + '谨奏，为' + _ttl + '事：事由如题，谨具题上闻，所陈缘由轻重，伏乞圣鉴裁夺。') : ('臣' + _from + '谨奏：具题在案，容臣面陈缘由，伏乞圣鉴。');
              m.content = _fb; m.text = _fb; m._emptyFallbackDone = true;
            });
          }
        } catch (_efbErr) { /* 空体兜底失败不影响主流程 */ }

        // ═══════════════════════════════════════════════════════════════════
        // Wave 1c+2 · 二次 AI 自审 reconciliation·tool_use 强约束
        // 6 个 validator 累计警告 >= 3 时·_maybeReconcileWithAI 设 GM._needsReconcile·此处取走并调 AI 二审
        // Wave 2 改造：用 callAIWithTools·让 AI 必须以结构化 tool_call 输出·彻底消灭 narrative/JSON 不一致
        // 兼容所有 API（Anthropic 原生/Gemini 原生/OpenAI 兼容/失败 fallback 到 schema-注入 prompt）
        // ═══════════════════════════════════════════════════════════════════
        if (GM && GM._needsReconcile) {
          var _rec = GM._needsReconcile;
          GM._needsReconcile = null;  // 立即取走·避免下回合重复
          try {
            var _totalW = Object.values(_rec.warnings).reduce(function(a,b){return a+b;},0);
            var _reconcilePrompt = '【一致性自审任务】\n你刚才输出的 narrative 与结构化 JSON 之间·校验器检测到 ' + _totalW + ' 处不一致·按领域分布:\n' +
              JSON.stringify(_rec.warnings) + '\n\n' +
              '【你的 narrative 节选(2KB)】\n' + _rec.narrativeSnapshot + '\n\n' +
              '【你已写的结构化数据(摘要)】\n' +
              'personnel_changes: ' + JSON.stringify((_rec.structuredSnapshot.personnel_changes||[]).slice(0,5)) + '\n' +
              'office_assignments: ' + JSON.stringify((_rec.structuredSnapshot.office_assignments||[]).slice(0,5)) + '\n' +
              'fiscal_adjustments: ' + JSON.stringify((_rec.structuredSnapshot.fiscal_adjustments||[]).slice(0,5)) + '\n' +
              'military_changes: ' + JSON.stringify((_rec.structuredSnapshot.military_changes||[]).slice(0,5)) + '\n\n' +
              '请检查 narrative 中提到但未在结构化数据里体现的状态变化·只补遗漏的·不要重复已写过的。\n' +
              '使用提供的 5 个工具之一记录补录·若完全无需补录请调用 record_no_changes。\n' +
              '注意：每个工具可调用多次·按领域分别调用（人事/任命/财政/军事各自独立）。';

            // 【落地核对·structured↔state 残差修复·搭车·2026-06】把主应用「已尝试应用但未落地」的结构化变化(applied.failed·多因目标名对不上)喂进**同一次**自审·让 LLM 解析正确目标后用上面**同一组工具**重记·随 _patch 经下方 L653 重应用·**零新增调用/零新工具**。只挑"目标对不上"类(排除 blocked 等故意拦截·不喂回去)·重应用若仍失败由 _applyRes2 的 surface 兜住(不静默)。
            try {
              var _failedForRepair = (typeof _applyRes1 !== 'undefined' && _applyRes1 && _applyRes1.applied && Array.isArray(_applyRes1.applied.failed))
                ? _applyRes1.applied.failed.filter(function(f){ return f && f.reason && /not found|未找到|对不上|未落地|无法解析/i.test(String(f.reason)) && !/blocked|玩家保护/i.test(String(f.reason)); }).slice(0, 12)
                : [];
              if (_failedForRepair.length) {
                _reconcilePrompt += '\n\n【另有结构化变化已尝试应用但未落地·多因目标名对不上】\n' + JSON.stringify(_failedForRepair) + '\n请把其中的目标(人名/势力/地区)解析为当前实际存在的对象后·用上面同一组工具按正确名字重新记录·解析不出的跳过·切勿凭空捏造对象。';
              }
            } catch (_repairPromptErr) {}

            // 取 reconcile 工具集
            var _reconcileTools = (window.TM_AI_SCHEMA && TM_AI_SCHEMA.reconcileTools) || [];
            var _toolResp = null;
            if (typeof callAIWithTools === 'function' && _reconcileTools.length > 0) {
              _toolResp = await callAIWithTools(_reconcilePrompt, _reconcileTools, { maxTok: 1500, tier: 'secondary', priority: 'high', timeoutMs: 60000, maxRetries: 1 });
            } else {
              // 极端兜底（不该发生·callAIWithTools 应已加载）
              var _raw = await callAI(_reconcilePrompt, 1500, undefined, 'secondary', { priority: 'high', timeoutMs: 60000, maxRetries: 1 });
              _toolResp = { text: _raw||'', toolCalls: [] };
            }

            // 把 toolCalls 聚合为 patch 字段
            var _patch = { personnel_changes: [], office_assignments: [], fiscal_adjustments: [], military_changes: [], sentiment_changes: [], population_changes: [], war_events: [], revolt_events: [], disaster_events: [], diplomacy_events: [], keju_events: [], party_events: [], edict_events: [], court_ceremony_events: [], construction_events: [], omen_events: [], marriage_birth_events: [], conspiracy_events: [], currency_events: [], religion_events: [] };
            (_toolResp.toolCalls || []).forEach(function(tc) {
              if (!tc || !tc.name || !tc.input) return;
              if (tc.name === 'record_personnel_changes' && Array.isArray(tc.input.changes)) {
                tc.input.changes.forEach(function(c) {
                  if (c && c.name) _patch.personnel_changes.push({ name: c.name, change: c.change||'罢免', reason: c.reason||'' });
                });
              } else if (tc.name === 'record_office_assignments' && Array.isArray(tc.input.assignments)) {
                tc.input.assignments.forEach(function(a) {
                  if (a && a.name) _patch.office_assignments.push({ name: a.name, action: a.action||'dismiss', post: a.post||'', reason: a.reason||'' });
                });
              } else if (tc.name === 'record_fiscal_adjustments' && Array.isArray(tc.input.adjustments)) {
                tc.input.adjustments.forEach(function(f) {
                  if (f && f.target && f.amount) _patch.fiscal_adjustments.push({ target: f.target, kind: f.kind||'expense', resource: f.resource||'money', amount: Number(f.amount)||0, name: f.name||'', reason: f.reason||'' });
                });
              } else if (tc.name === 'record_military_changes' && Array.isArray(tc.input.changes)) {
                tc.input.changes.forEach(function(m) {
                  if (m && m.armyName) _patch.military_changes.push({ armyName: m.armyName, delta: Number(m.delta)||0, reason: m.reason||'' });
                });
              } else if (tc.name === 'record_sentiment_changes' && Array.isArray(tc.input.changes)) {
                tc.input.changes.forEach(function(s) {
                  if (s && s.target && typeof s.delta === 'number') _patch.sentiment_changes.push({ target: s.target, delta: Number(s.delta)||0, reason: s.reason||'' });
                });
              } else if (tc.name === 'record_population_changes' && Array.isArray(tc.input.changes)) {
                tc.input.changes.forEach(function(p) {
                  if (p && p.region && p.amount) _patch.population_changes.push({ region: p.region, kind: p.kind||'death', amount: Number(p.amount)||0, reason: p.reason||'' });
                });
              } else if (tc.name === 'record_war_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(w) {
                  if (w && w.action) _patch.war_events.push({ action: w.action, enemy: w.enemy||'', region: w.region||'', outcome: w.outcome||'', casualties: Number(w.casualties)||0, reason: w.reason||'' });
                });
              } else if (tc.name === 'record_revolt_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(r) {
                  if (r && r.action && r.region) _patch.revolt_events.push({ action: r.action, region: r.region, leader: r.leader||'', scale: Number(r.scale)||0, reason: r.reason||'' });
                });
              } else if (tc.name === 'record_disaster_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(d) {
                  if (d && d.category && d.region) _patch.disaster_events.push({ category: d.category, region: d.region, severity: d.severity||'moderate', casualties: Number(d.casualties)||0, reason: d.reason||'' });
                });
              } else if (tc.name === 'record_diplomacy_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.faction) _patch.diplomacy_events.push({ action: e.action, faction: e.faction, attitude: e.attitude||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_keju_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.stage) _patch.keju_events.push({ stage: e.stage, year: e.year||'', topThree: Array.isArray(e.topThree)?e.topThree:[], reason: e.reason||'' }); });
              } else if (tc.name === 'record_party_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.partyName) _patch.party_events.push({ action: e.action, partyName: e.partyName, leader: e.leader||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_edict_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.edictName) _patch.edict_events.push({ action: e.action, edictName: e.edictName, category: e.category||'other', reason: e.reason||'' }); });
              } else if (tc.name === 'record_court_ceremony_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.target) _patch.court_ceremony_events.push({ action: e.action, target: e.target, newTitle: e.newTitle||'', newCapital: e.newCapital||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_construction_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.kind && e.name) _patch.construction_events.push({ action: e.action, kind: e.kind, name: e.name, region: e.region||'', cost: Number(e.cost)||0, reason: e.reason||'' }); });
              } else if (tc.name === 'record_omen_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.category && e.tone) _patch.omen_events.push({ category: e.category, tone: e.tone, description: e.description||'', region: e.region||'' }); });
              } else if (tc.name === 'record_marriage_birth_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.target) _patch.marriage_birth_events.push({ action: e.action, target: e.target, partner: e.partner||'', heirName: e.heirName||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_conspiracy_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.instigator) _patch.conspiracy_events.push({ action: e.action, instigator: e.instigator, target: e.target||'', outcome: e.outcome||'suppressed', conspirators: Array.isArray(e.conspirators)?e.conspirators:[], reason: e.reason||'' }); });
              } else if (tc.name === 'record_currency_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action) _patch.currency_events.push({ action: e.action, severity: e.severity||'moderate', priceIndexDelta: Number(e.priceIndexDelta)||0, region: e.region||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_religion_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.religion) _patch.religion_events.push({ action: e.action, religion: e.religion, region: e.region||'', followers: Number(e.followers)||0, reason: e.reason||'' }); });
              } else if (tc.name === 'record_no_changes') {
                // 显式声明无需补录·略
              }
            });

            // ─ 直接施加 sentiment/population 补丁（不走 applyAITurnChanges 因为它没这俩字段） ─
            try {
              // B1.5·AI 皇威/皇权参与定量的护栏：保留 AI 自由给(灵活)，但上闸——①单事件夹 ±P_AI_EVENT_CAP(3) ②每回合该值 AI 净变封顶 ±P_AI_TURN_CAP(5)防暴冲。
              //   闸只收紧 authority(皇威/皇权)；民心走 adjustMinxin 摊叶子(治本)、自有动力学、不在此夹。经 aiSentiment 记账可审计。配额按回合重置。
              if (GM._aiAuthCapTurn !== (GM.turn || 0)) { GM._aiAuthCapTurn = (GM.turn || 0); GM._aiAuthAcc = { huangwei: 0, huangquan: 0 }; }
              _patch.sentiment_changes.forEach(function(s) {
                var pathMap = { minxin: 'minxin', huangwei: 'huangwei', huangquan: 'huangquan' };
                var key = pathMap[s.target]; if (!key) return;
                var delta = Number(s.delta) || 0;
                if (s.target === 'huangwei' || s.target === 'huangquan') {
                  var P_AI_EVENT_CAP = 3, P_AI_TURN_CAP = 5;
                  if (delta > P_AI_EVENT_CAP) delta = P_AI_EVENT_CAP;       // ① 单事件夹
                  else if (delta < -P_AI_EVENT_CAP) delta = -P_AI_EVENT_CAP;
                  var acc = GM._aiAuthAcc[s.target] || 0;                    // ② 每回合净变封顶
                  if (delta >= 0) delta = Math.max(0, Math.min(delta, P_AI_TURN_CAP - acc));
                  else delta = Math.min(0, Math.max(delta, -P_AI_TURN_CAP - acc));
                  if (delta === 0) return;                                   // 配额用尽·丢弃这条
                  GM._aiAuthAcc[s.target] = acc + delta;
                }
                var _AE = (typeof window !== 'undefined' && window.AuthorityEngines) || (typeof global !== 'undefined' && global.AuthorityEngines) || null;
                var _adj = _AE && ({ minxin: _AE.adjustMinxin, huangwei: _AE.adjustHuangwei, huangquan: _AE.adjustHuangquan })[s.target];
                if (typeof _adj === 'function') {
                  _adj('aiSentiment', delta, s.reason || 'AI推演');
                } else if (GM[key] && typeof GM[key].trueIndex === 'number') {
                  GM[key].trueIndex = Math.max(0, Math.min(100, GM[key].trueIndex + delta));
                } else if (typeof GM[key] === 'number') {
                  GM[key] = Math.max(0, Math.min(100, GM[key] + delta));
                }
                // 登记 turnChanges 供史记显示
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: key + '.trueIndex', label: ({minxin:'民心',huangwei:'皇威',huangquan:'皇权'})[s.target], delta: delta, reason: s.reason || '一致性补录' });
              });
              _patch.population_changes.forEach(function(p) {
                if (!GM.adminHierarchy || !Array.isArray(GM.adminHierarchy.nodes)) return;
                var node = GM.adminHierarchy.nodes.find(function(n){return n.name === p.region;});
                if (!node || !node.populationDetail) return;
                var amt = Math.max(0, Math.min(p.amount, node.populationDetail.mouths || 0));
                if (p.kind === 'death') {
                  node.populationDetail.mouths = Math.max(0, (node.populationDetail.mouths||0) - amt);
                } else if (p.kind === 'flee') {
                  node.populationDetail.fugitives = (node.populationDetail.fugitives||0) + amt;
                  node.populationDetail.mouths = Math.max(0, (node.populationDetail.mouths||0) - amt);
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'admin.' + p.region + '.mouths', label: p.region + (p.kind==='flee'?'·逃亡':'·伤亡'), delta: -amt, reason: p.reason || '一致性补录' });
              });
              // 战争补录
              _patch.war_events.forEach(function(w) {
                if (!Array.isArray(GM.activeWars)) GM.activeWars = [];
                if (w.action === 'start') {
                  GM.activeWars.push({
                    name: (w.enemy||'?') + '之役',
                    enemy: w.enemy || '',
                    region: w.region || '',
                    startedTurn: GM.turn || 0,
                    status: 'ongoing',
                    battles: [],
                    _autoFromReconcile: true
                  });
                } else if (w.action === 'end') {
                  // 取最早一场未结束的战争·标 ended
                  var openWar = GM.activeWars.find(function(x){return x && (x.status==='ongoing' || !x.endedTurn);});
                  if (openWar) {
                    openWar.status = (w.outcome === 'peace' || w.outcome === 'surrender') ? 'peace' : 'ended';
                    openWar.endedTurn = GM.turn || 0;
                    openWar.outcome = w.outcome || 'stalemate';
                  }
                } else if (w.action === 'battle') {
                  var ongoingWar = GM.activeWars.find(function(x){return x && x.status==='ongoing';});
                  if (ongoingWar) {
                    if (!Array.isArray(ongoingWar.battles)) ongoingWar.battles = [];
                    ongoingWar.battles.push({ turn: GM.turn||0, region: w.region||'', outcome: w.outcome||'stalemate', casualties: w.casualties||0, reason: w.reason||'' });
                  }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'activeWars', label: '战事·' + (w.enemy||w.action), delta: w.action==='start'?1:(w.action==='end'?-1:0), reason: w.reason || '一致性补录' });
              });
              // 民变补录
              _patch.revolt_events.forEach(function(r) {
                if (!GM.minxin) GM.minxin = {};
                if (!Array.isArray(GM.minxin.revolts)) GM.minxin.revolts = [];
                if (r.action === 'start') {
                  // 确定性护栏：AI 叙事可提鼓噪，但该省民心若仍安定(div.minxin>=阈值)，不坐实为引擎民变——
                  //   防「AI 推演不认数值」(E.B 报：全国/各省民心 98 仍冒叛军)。解析不到该省真值则照旧放行(不误拦)。
                  var _PUr = (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.PathUtils) || null;
                  // 省名容错(陕西→陕西布政使司)·模糊优先·退回精确
                  var _rdiv = _PUr ? (
                    (typeof _PUr.findDivisionByNameFuzzy === 'function' && _PUr.findDivisionByNameFuzzy(GM, r.region)) ||
                    (typeof _PUr.findDivisionByNameOrId === 'function' && _PUr.findDivisionByNameOrId(GM, r.region)) || null
                  ) : null;
                  // 解析到该省→读该省 div.minxin；解析不到→退回全国 trueIndex 作闸
                  //   (防命名空间不齐导致护栏被绕过·E.B：全国民心 98 仍冒叛军)
                  var _rmx = (_rdiv && typeof _rdiv.minxin === 'number') ? _rdiv.minxin
                           : (GM.minxin && typeof GM.minxin.trueIndex === 'number') ? GM.minxin.trueIndex : null;
                  var _qd = ({narrative:'narrative',standard:'standard',hardcore:'hardcore','简单':'narrative','普通':'standard','中等':'standard','困难':'hardcore','地狱':'hardcore'})[(typeof P!=='undefined'&&P.conf&&P.conf.difficulty)||'']||'standard';
                  var P_AI_REVOLT_MX = _qd==='narrative'?35:(_qd==='hardcore'?65:50); // 民心≥此·AI起事不坐实·按难度:叙事35(更多省受护·少凭空民变)/标准50/硬核65(更多危机)·可调
                  if (_rmx != null && _rmx >= P_AI_REVOLT_MX) {
                    if (typeof addEB === 'function') addEB('民变', (r.region||'某地') + '虽有鼓噪，然民心 ' + Math.round(_rmx) + ' 尚安，未成气候（确定性护栏·未坐实）');
                  } else {
                    // AI 报的叛军规模确定性封顶·不许凭空 30 万：按该省人口比例卡上限(解析不到走绝对上限)
                    var P_AI_REVOLT_SCALE_FRAC = 0.05, P_AI_REVOLT_SCALE_ABS = 80000;
                    var _mouths = (_rdiv && _rdiv.populationDetail && typeof _rdiv.populationDetail.mouths === 'number') ? _rdiv.populationDetail.mouths : null;
                    var _scaleCap = _mouths != null ? Math.max(2000, Math.round(_mouths * P_AI_REVOLT_SCALE_FRAC)) : P_AI_REVOLT_SCALE_ABS;
                    var _scale = Math.min(Number(r.scale) || 1000, _scaleCap);
                    GM.minxin.revolts.push({
                      id: 'revolt-airec-t' + (GM.turn || 0) + '-' + GM.minxin.revolts.length, // 补id·镇压路径按id find·无id曾镇不掉(2026-07-04 审查定罪)
                      region: r.region,
                      leader: r.leader || '',
                      scale: _scale,
                      startedTurn: GM.turn || 0,
                      status: 'ongoing',
                      _autoFromReconcile: true
                    });
                  }
                } else if (r.action === 'suppress' || r.action === 'appease') {
                  var openR = GM.minxin.revolts.find(function(x){return x && x.status === 'ongoing' && x.region === r.region;});
                  if (openR) {
                    openR.status = (r.action === 'suppress') ? 'suppressed' : 'appeased';
                    openR.endedTurn = GM.turn || 0;
                    // AI 叙事的武力平乱也确定性接皇威（与引擎/手动平乱同口径·_hwAwarded 防重复·状态互斥不双计）；招抚不计
                    if (r.action === 'suppress' && !openR._hwAwarded) {
                      var _AEsup = (typeof window !== 'undefined' && window.AuthorityEngines) || (typeof global !== 'undefined' && global.AuthorityEngines) || null;
                      if (_AEsup && typeof _AEsup.adjustHuangwei === 'function') {
                        _AEsup.adjustHuangwei('suppressRevolt', Math.max(2, Math.min(8, (openR.level || 1) * 2)), (r.region || '某地') + ' 平乱');
                        openR._hwAwarded = true;
                      }
                    }
                  }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'minxin.revolts', label: r.region + '·民变·' + r.action, delta: r.action==='start'?1:-1, reason: r.reason || '一致性补录' });
              });
              // 天灾补录
              _patch.disaster_events.forEach(function(d) {
                if (!Array.isArray(GM.activeDisasters)) GM.activeDisasters = [];
                // 灾害历时(回合)·时间感知:灾种月数经 turnsForMonths 随 daysPerTurn 换算·夹 [1,12]·治本「永不消除」
                var _disMonths = ({drought:5,flood:2,locust:3,plague:4,quake:1})[d.category] || 3;
                var _disDur = Math.max(1, Math.min(12, Math.round((typeof turnsForMonths === 'function' ? turnsForMonths(_disMonths) : _disMonths)) || 1));
                GM.activeDisasters.push({
                  type: d.category,
                  category: d.category,
                  region: d.region,
                  severity: d.severity || 'moderate',
                  casualties: d.casualties || 0,
                  startedTurn: GM.turn || 0,
                  duration: _disDur,
                  reason: d.reason || '',
                  _autoFromReconcile: true
                });
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'activeDisasters', label: d.region + '·' + ({drought:'旱',flood:'涝',locust:'蝗',plague:'疫',quake:'震'})[d.category], delta: 1, reason: d.reason || '一致性补录' });
              });
              // 外交补录
              _patch.diplomacy_events.forEach(function(e) {
                if (!Array.isArray(GM.facs)) GM.facs = [];
                var fac = GM.facs.find(function(f){return f && f.name === e.faction;});
                if (fac) {
                  if (e.attitude) fac.attitude = e.attitude;
                  if (!fac._diplomaticHistory) fac._diplomaticHistory = [];
                  fac._diplomaticHistory.push({ turn: GM.turn||0, action: e.action, reason: e.reason||'', _autoFromReconcile: true });
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'facs.' + e.faction, label: '外交·' + e.faction + '·' + e.action, delta: 0, reason: e.reason || '一致性补录' });
              });
              // 科举补录
              _patch.keju_events.forEach(function(e) {
                if (typeof P !== 'undefined') {
                  if (!P.keju) P.keju = {};
                  if (!P.keju.history) P.keju.history = [];
                  P.keju.history.push({ turn: GM.turn||0, stage: e.stage, year: e.year||'', topThree: e.topThree||[], reason: e.reason||'', _autoFromReconcile: true });
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'keju.history', label: '科举·' + e.stage + (e.year?'·'+e.year:''), delta: 1, reason: e.reason || '一致性补录' });
              });
              // 党派补录
              _patch.party_events.forEach(function(e) {
                if (!Array.isArray(GM.parties)) GM.parties = [];
                if (e.action === 'form') {
                  var _formedParty = { name: e.partyName, leader:'', head:'', members:[], formedTurn: GM.turn||0, status: 'active', reason: e.reason||'', _autoFromReconcile: true };
                  if (e.leader && !_stageSetPartyLeader(_formedParty, e.leader, e.reason || '一致性补录立党')) return;
                  if (_formedParty.leader) _formedParty.members = [_formedParty.leader];
                  GM.parties.push(_formedParty);
                } else if (e.action === 'dissolve') {
                  var p = GM.parties.find(function(x){return x && x.name === e.partyName && x.status === 'active';});
                  if (p) { p.status = 'dissolved'; p.dissolvedTurn = GM.turn||0; }
                } else if (e.action === 'split' || e.action === 'impeach') {
                  var p2 = GM.parties.find(function(x){return x && x.name === e.partyName;});
                  if (p2) { if (!p2._events) p2._events = []; p2._events.push({ turn: GM.turn||0, action: e.action, reason: e.reason||'' }); }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'parties.' + e.partyName, label: '党派·' + e.partyName + '·' + e.action, delta: e.action==='form'?1:(e.action==='dissolve'?-1:0), reason: e.reason || '一致性补录' });
              });
              // 法令补录
              _patch.edict_events.forEach(function(e) {
                if (!Array.isArray(GM.activeEdicts)) GM.activeEdicts = [];
                if (e.action === 'promulgate' || e.action === 'renew') {
                  GM.activeEdicts.push({ name: e.edictName, category: e.category||'other', startedTurn: GM.turn||0, status: 'active', reason: e.reason||'', _autoFromReconcile: true });
                } else if (e.action === 'revoke') {
                  var ed = GM.activeEdicts.find(function(x){return x && x.name === e.edictName && x.status === 'active';});
                  if (ed) { ed.status = 'revoked'; ed.revokedTurn = GM.turn||0; }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'activeEdicts.' + e.edictName, label: '法令·' + e.edictName + '·' + e.action, delta: e.action==='promulgate'?1:(e.action==='revoke'?-1:0), reason: e.reason || '一致性补录' });
              });
              // 朝廷礼仪 / 后宫补录
              _patch.court_ceremony_events.forEach(function(e) {
                if (e.action === 'move_capital' && e.newCapital) {
                  GM._capitalHistory = GM._capitalHistory || [];
                  GM._capitalHistory.push({ turn: GM.turn||0, from: GM.capital||'', to: e.newCapital, reason: e.reason||'', _autoFromReconcile: true });
                  GM.capital = e.newCapital;
                } else {
                  // 角色相关：找 char 并加 title/posthumous/spouse
                  var ch = (GM.chars||[]).find(function(c){return c && c.name === e.target;});
                  if (ch) {
                    if (e.action === 'grant_title' || e.action === 'enthrone_consort') ch.title = e.newTitle || ch.title;
                    else if (e.action === 'strip_title' || e.action === 'depose_consort') ch.titleStripped = true;
                    else if (e.action === 'posthumous_title') ch.posthumousName = e.newTitle || ch.posthumousName;
                    else if (e.action === 'grant_marriage') ch.recentMarriage = { partner: e.newTitle||'', turn: GM.turn||0 };
                    else if (e.action === 'grant_surname') ch.bestowedSurname = e.newTitle || '';
                    if (!ch._titleHistory) ch._titleHistory = [];
                    ch._titleHistory.push({ turn: GM.turn||0, action: e.action, value: e.newTitle||'', reason: e.reason||'', _autoFromReconcile: true });
                  }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'court.' + e.target, label: '朝仪·' + e.target + '·' + e.action, delta: 0, reason: e.reason || '一致性补录' });
              });
              // 工程·物品·建筑补录
              _patch.construction_events.forEach(function(e) {
                if (!Array.isArray(GM.activeProjects)) GM.activeProjects = [];
                if (e.action === 'build' || e.action === 'restore' || e.action === 'cast') {
                  GM.activeProjects.push({ kind: e.kind, name: e.name, region: e.region||'', cost: e.cost||0, action: e.action, status: 'in_progress', startedTurn: GM.turn||0, reason: e.reason||'', _autoFromReconcile: true });
                } else if (e.action === 'complete') {
                  var prj = GM.activeProjects.find(function(x){return x && x.name === e.name && x.status === 'in_progress';});
                  if (prj) { prj.status = 'complete'; prj.completedTurn = GM.turn||0; }
                  else GM.activeProjects.push({ kind: e.kind, name: e.name, region: e.region||'', status: 'complete', completedTurn: GM.turn||0, reason: e.reason||'', _autoFromReconcile: true });
                } else if (e.action === 'destroy') {
                  GM.activeProjects.push({ kind: e.kind, name: e.name, region: e.region||'', status: 'destroyed', destroyedTurn: GM.turn||0, reason: e.reason||'', _autoFromReconcile: true });
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'projects.' + e.name, label: e.kind + '·' + e.name + '·' + e.action, delta: e.action==='destroy'?-1:1, reason: e.reason || '一致性补录' });
              });
              // 异象补录
              _patch.omen_events.forEach(function(e) {
                if (!Array.isArray(GM.omens)) GM.omens = [];
                GM.omens.push({ category: e.category, tone: e.tone, description: e.description||'', region: e.region||'', turn: GM.turn||0, _autoFromReconcile: true });
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'omens', label: '异象·' + e.category + '·' + e.tone, delta: 1, reason: e.description || '一致性补录' });
              });
              // 婚姻·生育·继承 补录
              _patch.marriage_birth_events.forEach(function(e) {
                var ch = (GM.chars||[]).find(function(c){return c && c.name === e.target;});
                if (!GM._marriageBirthHistory) GM._marriageBirthHistory = [];
                GM._marriageBirthHistory.push({ turn: GM.turn||0, action: e.action, target: e.target, partner: e.partner||'', heirName: e.heirName||'', reason: e.reason||'', _autoFromReconcile: true });
                if (ch) {
                  if (e.action === 'marriage') ch.spouse = e.partner || ch.spouse;
                  else if (e.action === 'birth' && e.heirName) {
                    if (!ch.children) ch.children = [];
                    ch.children.push(e.heirName);
                    if (typeof addPendingCharacter === 'function' && typeof findCharByName === 'function' && !findCharByName(e.heirName)) {
                      addPendingCharacter({ name: e.heirName, source: '家事', snippet: e.target + '诞下子嗣：' + e.heirName });
                    }
                  } else if (e.action === 'succession') ch.inheritedTitle = true;
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'family.' + e.target, label: '家事·' + e.target + '·' + e.action, delta: 0, reason: e.reason || '一致性补录' });
              });
              // 谋反·政变 补录
              _patch.conspiracy_events.forEach(function(e) { ns._applyOneConspiracyEvent(e); });
              // 货币·币值 补录
              _patch.currency_events.forEach(function(e) {
                if (!GM.currency) GM.currency = {};
                if (!GM.currency.events) GM.currency.events = [];
                GM.currency.events.push({ turn: GM.turn||0, action: e.action, severity: e.severity||'moderate', region: e.region||'', reason: e.reason||'', _autoFromReconcile: true });
                if (e.priceIndexDelta) {
                  var prev = (typeof GM.currency.priceIndex === 'number') ? GM.currency.priceIndex : 100;
                  GM.currency.priceIndex = Math.max(20, Math.min(800, prev + e.priceIndexDelta));
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'currency.' + e.action, label: '币政·' + e.action + (e.region?'@'+e.region:''), delta: e.priceIndexDelta||0, reason: e.reason || '一致性补录' });
              });
              // 宗教·教派 补录
              _patch.religion_events.forEach(function(e) {
                if (!Array.isArray(GM.religions)) GM.religions = [];
                if (e.action === 'sect_rise' || e.action === 'foreign_arrival' || e.action === 'promote') {
                  var existRel = GM.religions.find(function(r){return r && r.name === e.religion;});
                  if (existRel) {
                    existRel.followers = (existRel.followers||0) + (e.followers||0);
                    existRel.status = 'active';
                  } else {
                    GM.religions.push({ name: e.religion, status: 'active', followers: e.followers||0, foundedTurn: GM.turn||0, region: e.region||'', _autoFromReconcile: true });
                  }
                } else if (e.action === 'suppress' || e.action === 'sect_ban' || e.action === 'heresy_purge') {
                  var existRel2 = GM.religions.find(function(r){return r && r.name === e.religion;});
                  if (existRel2) { existRel2.status = 'suppressed'; existRel2.suppressedTurn = GM.turn||0; }
                  else GM.religions.push({ name: e.religion, status: 'suppressed', suppressedTurn: GM.turn||0, region: e.region||'', _autoFromReconcile: true });
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'religions.' + e.religion, label: '宗教·' + e.religion + '·' + e.action, delta: e.action.indexOf('rise')>=0||e.action==='promote'?1:-1, reason: e.reason || '一致性补录' });
              });
            } catch(_apE) {
              (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_apE, 'reconcile sentiment/population:') : console.warn('[Reconcile] sentiment/population apply failed:', _apE);
            }

            var _patched = _patch.personnel_changes.length + _patch.office_assignments.length + _patch.fiscal_adjustments.length + _patch.military_changes.length + _patch.sentiment_changes.length + _patch.population_changes.length + _patch.war_events.length + _patch.revolt_events.length + _patch.disaster_events.length + _patch.diplomacy_events.length + _patch.keju_events.length + _patch.party_events.length + _patch.edict_events.length + _patch.court_ceremony_events.length + _patch.construction_events.length + _patch.omen_events.length + _patch.marriage_birth_events.length + _patch.conspiracy_events.length + _patch.currency_events.length + _patch.religion_events.length;
            if ((_patch.personnel_changes.length + _patch.office_assignments.length + _patch.fiscal_adjustments.length + _patch.military_changes.length) > 0 && typeof applyAITurnChanges === 'function') {
              var _applyRes2 = applyAITurnChanges({
                personnel_changes: _patch.personnel_changes,
                office_assignments: _patch.office_assignments,
                fiscal_adjustments: _patch.fiscal_adjustments,
                military_changes: _patch.military_changes,
                // 不传 narrative·避免触发 validator 死循环
                shilu_text: '',
                shizhengji: ''
              });
              _surfaceUnappliedChanges(_applyRes2, 'reconcile补录');  // 【落地核对】二审补录也接住失败清单
              if (!_applyRes2 || _applyRes2.ok !== true || (_applyRes2.applied && _applyRes2.applied.failed && _applyRes2.applied.failed.length)) {
                throw new Error('AI 二审补录未能原子提交');
              }
              if (!GM._reconcilePatchLog) GM._reconcilePatchLog = [];
              GM._reconcilePatchLog.push({ turn: GM.turn||0, patch: _patch, mode: _toolResp.fallback ? 'fallback' : 'tool_use', timestamp: Date.now() });
              if (GM._reconcilePatchLog.length > 10) GM._reconcilePatchLog = GM._reconcilePatchLog.slice(-10);
              console.log('[Reconcile] AI 二审完成·补录 ' + _patched + ' 条·模式=' + (_toolResp.fallback?'fallback':'tool_use'));
              if (typeof addEB === 'function') {
                addEB('校验补录', 'AI 二审一致性·补录 ' + _patched + ' 条结构化数据' + (_toolResp.fallback?'（兜底）':''));
              }
            } else {
              console.log('[Reconcile] AI 二审完成·无需补录·模式=' + (_toolResp.fallback?'fallback':'tool_use'));
            }
          } catch(_recE) {
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_recE, 'endturn] reconcile AI:') : console.warn('[endturn] reconcile AI failed:', _recE);
          }
        }
  };

  // ── AP-6（自 origin writeBack 尾部逐字节迁出·幻觉防火墙后验+记忆入账+record 组装+return ctx）──
  //   writeBack 局部变量经状态包 _st 传入·顶部解构回同名 var 保业务体逐字节一致。
  ns.stages._applyPostValidateAssemble = function(ctx, _st) {
    var p1 = _st.p1;
    var shizhengji = _st.shizhengji, zhengwen = _st.zhengwen, playerStatus = _st.playerStatus, playerInner = _st.playerInner, turnSummary = _st.turnSummary, shiluText = _st.shiluText, szjTitle = _st.szjTitle, szjSummary = _st.szjSummary, personnelChanges = _st.personnelChanges, hourenXishuo = _st.hourenXishuo;
    var _applied = _st._applied;
    var _applyStart = _st._applyStart;
      // 主链的 faction_succession consumer 还承担稳定度/史事副作用；在其执行后统一经
      // Narrative 语义 sink 补齐 leader/leaderName/ruler/leadership.ruler/leaderInfo.name 镜像。
      // 前置 preflight 已将 faction/newLeader 收紧为当前活跃势力与存活人物的精确对象。
      if (p1 && Array.isArray(p1.faction_succession) && global.TM && global.TM.AIChange && global.TM.AIChange.Narrative && typeof global.TM.AIChange.Narrative.setFactionLeader === 'function') {
        p1.faction_succession.forEach(function(sc) {
          if (!sc || !(sc.factionId || sc.faction) || !(sc.newLeaderId || sc.newLeader)) return;
          var factionRef=String(sc.factionId || sc.faction).trim();
          var fac=(GM.facs || []).find(function(f) {
            return f && f.id != null && String(f.id).trim()===factionRef;
          });
          if (!fac && !sc.factionId) {
            var matches=(GM.facs || []).filter(function(f) { return f && f.name===sc.faction; });
            if (matches.length===1) fac=matches[0];
          }
          if (fac) global.TM.AIChange.Narrative.setFactionLeader(fac, sc.newLeaderId || sc.newLeader, GM, '势力继统');
        });
      }
      // 1.4: 幻觉防火墙——后验校验（检查AI返回的人名/地名是否在白名单内）
      if (p1 && p1.npc_actions) {
        var _aliveSet = {};
        (GM.chars || []).forEach(function(c) { if (c.alive !== false) _aliveSet[c.name] = true; });
        p1.npc_actions.forEach(function(act) {
          if (act.name && !_aliveSet[act.name]) {
            // 尝试模糊匹配
            var _fuzzy = (typeof _fuzzyFindChar === 'function') ? _fuzzyFindChar(act.name) : null;
            if (_fuzzy) {
              DebugLog.log('ai', '[幻觉修正] NPC名' + act.name + '→' + _fuzzy.name);
              act.name = _fuzzy.name;
            } else {
              DebugLog.warn('ai', '[幻觉检测] AI生成了不存在的NPC: ' + act.name);
              act._hallucinated = true;
            }
          }
        });
        // 过滤掉无法修正的幻觉NPC行动
        p1.npc_actions = p1.npc_actions.filter(function(a) { return !a._hallucinated; });
      }

      if (p1 && global.TM && global.TM.MemoryTurnInference && typeof global.TM.MemoryTurnInference.enqueuePostTurnCandidates === 'function') {
        ctx.meta.memoryWriteback = global.TM.MemoryTurnInference.enqueuePostTurnCandidates(GM, p1, { sourceId: 'SC1', forceDraft: true, autoAcceptTrusted: true });
      }

      if (p1 && global.TM && global.TM.MemoryTurnArchive && typeof global.TM.MemoryTurnArchive.archiveTurn === 'function') {
        ctx.meta.memoryArchive = global.TM.MemoryTurnArchive.archiveTurn(GM, p1, { sourceId: 'SC1', sourceType: 'aiTurnResult' });
      }
      if (ctx.meta.memoryArchive && ctx.meta.memoryArchive.archived && global.TM && global.TM.MemoryTurnRollup && typeof global.TM.MemoryTurnRollup.rebuildFromArchive === 'function') {
        ctx.meta.memoryRollup = global.TM.MemoryTurnRollup.rebuildFromArchive(GM, { turn: GM && GM.turn });
      }

    ctx.results.sc1 = p1;
    ctx.record.shizhengji = shizhengji || "";
    ctx.record.zhengwen = zhengwen || "";
    ctx.record.playerStatus = playerStatus || "";
    ctx.record.playerInner = playerInner || "";
    ctx.record.turnSummary = turnSummary || "";
    ctx.record.shiluText = shiluText || "";
    ctx.record.szjTitle = szjTitle || "";
    ctx.record.szjSummary = szjSummary || "";
    ctx.record.personnelChanges = Array.isArray(personnelChanges) ? personnelChanges : [];
    ctx.record.hourenXishuo = hourenXishuo || "";
    // ★存近回合时政记/实录原文·供下一回合推演承接(治"叙事与推演断裂":旧仅 chronicleAfterwords 存 2 句/200 字·丢尽情节线/未决伏笔·
    //   AI 每回合几乎接不上上回合真实叙事)·环形缓冲留最近 2 回合·限长(注入侧再按上下文预算截断)·随存档序列化。
    try {
      var _szjFull = String(shizhengji || ''), _shiluFull = String(shiluText || '');
      if ((_szjFull + _shiluFull).replace(/\s/g, '').length >= 20) {
        if (!Array.isArray(GM._recentNarrative)) GM._recentNarrative = [];
        // 压缩摘要:AI 的 szjSummary 优先·否则确定性提取(首句…末句)·供超窗后折入长线综述
        var _szjSum = String(szjSummary || '').trim();
        if (!_szjSum) {
          var _ss = _szjFull.split(/[。！？\n]/).map(function(x){ return x.trim(); }).filter(function(x){ return x.length >= 4; });
          if (_ss.length) _szjSum = _ss[0] + (_ss.length > 1 ? '…' + _ss[_ss.length - 1] : '');
        }
        GM._recentNarrative.push({ turn: GM.turn, shizhengji: _szjFull.slice(0, 2600), shilu: _shiluFull.slice(0, 1300), summary: _szjSum.slice(0, 200) });
        // 超出 6 回合原文窗口→最老回合折入"长线叙事综述"(压缩·每回合更新·封顶 15 回合梗概)
        if (!Array.isArray(GM._narrativeDigest)) GM._narrativeDigest = [];
        while (GM._recentNarrative.length > 6) {
          var _evNarr = GM._recentNarrative.shift();
          if (_evNarr && _evNarr.summary) GM._narrativeDigest.push({ turn: _evNarr.turn, summary: _evNarr.summary });
        }
        if (GM._narrativeDigest.length > 15) GM._narrativeDigest = GM._narrativeDigest.slice(-15);
      }
    } catch (_rnStoreE) {}
    _applied.chars = _applied.chars || {
      char_updates: p1 && Array.isArray(p1.char_updates) ? p1.char_updates.length : 0,
      character_deaths: p1 && Array.isArray(p1.character_deaths) ? p1.character_deaths.length : 0
    };
    _applied.factions = _applied.factions || {
      faction_changes: p1 && Array.isArray(p1.faction_changes) ? p1.faction_changes.length : 0,
      faction_events: p1 && Array.isArray(p1.faction_events) ? p1.faction_events.length : 0,
      faction_relation_changes: p1 && Array.isArray(p1.faction_relation_changes) ? p1.faction_relation_changes.length : 0,
      faction_ai_outcomes: p1 && Array.isArray(p1.faction_ai_outcomes) ? p1.faction_ai_outcomes.length : 0
    };
    _applied.offices = _applied.offices || {
      office_assignments: p1 && Array.isArray(p1.office_assignments) ? p1.office_assignments.length : 0,
      office_changes: p1 && Array.isArray(p1.office_changes) ? p1.office_changes.length : 0,
      office_aggregate: p1 && Array.isArray(p1.office_aggregate) ? p1.office_aggregate.length : 0
    };
    _applied.fiscal = _applied.fiscal || { fiscal_adjustments: p1 && Array.isArray(p1.fiscal_adjustments) ? p1.fiscal_adjustments.length : 0 };
    _applied.admin = _applied.admin || { admin_changes: p1 && Array.isArray(p1.admin_changes) ? p1.admin_changes.length : 0 };
    _applied.events = _applied.events || { events: p1 && Array.isArray(p1.events) ? p1.events.length : 0 };
    _applied.harem = _applied.harem || { harem_events: p1 && Array.isArray(p1.harem_events) ? p1.harem_events.length : 0 };
    ctx.meta.timing.apply = Date.now() - _applyStart;
    return ctx;
  };

})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

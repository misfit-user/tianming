// @ts-check
/// <reference path="types.d.ts" />
(function(global) {
  'use strict';

  function _safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _turn() { return _safeNum(global.GM && global.GM.turn) || 1; }
  function _clonePlain(v) {
    if (!v || typeof v !== 'object') return v;
    try { return JSON.parse(JSON.stringify(v)); } catch(_) {}
    if (Array.isArray(v)) return v.slice();
    var out = {};
    Object.keys(v).forEach(function(k){ out[k] = v[k]; });
    return out;
  }
  function _ensureFactionAiTurnLedger(turn) {
    var G = global.GM || null;
    if (!G) return null;
    turn = _safeNum(turn) || _turn();
    if (!G._npcFactionAiTurnLedger || G._npcFactionAiTurnLedger.turn !== turn) {
      G._npcFactionAiTurnLedger = {
        turn: turn,
        createdAt: turn,
        sc16: null,
        dispatch: G._npcFactionLlmDispatchLedger || null,
        runs: (G._npcFactionLlmLedger && G._npcFactionLlmLedger.runs) || {},
        actions: [],
        candidateRanks: [],
        notes: [],
        stats: {}
      };
    }
    if (!Array.isArray(G._npcFactionAiTurnLedger.actions)) G._npcFactionAiTurnLedger.actions = [];
    if (!Array.isArray(G._npcFactionAiTurnLedger.candidateRanks)) G._npcFactionAiTurnLedger.candidateRanks = [];
    if (!Array.isArray(G._npcFactionAiTurnLedger.notes)) G._npcFactionAiTurnLedger.notes = [];
    return G._npcFactionAiTurnLedger;
  }

  var VALID_MEM_TYPES = ['军务','政务','民生','经济','人事','密奏'];
  var VALID_DECISIONS = ['approved','rejected','annotated','referred'];
  var VALID_EDICT_TYPES = ['催征','减俸','补饷','整军','安抚','罢党争','怀柔','赏赐','巡抚','经略'];
  var VALID_CHAOYI_TYPES = ['cooperate','attack','compromise','infight'];
  var VALID_OFFICE_KINDS = ['promote','demote','appoint','dismiss','transfer'];
  var TYPES = ['memorial','edict','court_alignment','office_change','fiscal_policy','military_order','diplomacy','province_policy','rebellion_policy','spy_or_intrigue'];
  // 【F2·势力活世界】总闸 GM._factionLivingWorld(默认OFF·本局存档·御驾亲征式)门控的额外动作类型·OFF 时 validateDecision 不收=零回归
  var LIVING_WORLD_TYPES = ['declare_war', 'join_war'];
  var VALID_CASUS_BELLI = ['rebellion', 'border', 'claim', 'holy', 'subjugation', 'none'];
  var ACTION_CONTRACT = {
    memorial: {
      required: ['from','type','content','rulerDecision'],
      optional: ['ruling','loyaltyDelta'],
      mutates: ['fac.npcMemorials','char.loyalty'],
      visible: ['qijuHistory','faction panel ledger']
    },
    edict: {
      required: ['type','content'],
      optional: ['trigger','treasuryDelta','loyaltyDeltas'],
      mutates: ['fac.npcEdicts','fac.treasury','char.loyalty'],
      visible: ['qijuHistory','faction panel ledger']
    },
    court_alignment: {
      required: ['type','summary'],
      optional: ['partyImbalanceDelta','loyaltyDeltaByParty'],
      mutates: ['fac.npcChaoyi','party metrics','char.loyalty'],
      visible: ['qijuHistory','faction panel ledger']
    },
    office_change: {
      required: ['target','newPosition'],
      optional: ['kind','loyaltyDelta','reason'],
      mutates: ['char.position','char.officialTitle','admin hierarchy when hook exists'],
      visible: ['qijuHistory','character card','office UI']
    },
    fiscal_policy: {
      required: ['resource'],
      optional: ['reason','incomeDelta','expenseDelta','longTermIncomeDelta','longTermExpenseDelta','policyName','durationTurns'],
      mutates: ['fac.treasury.money/grain/cloth','fac.fiscalPolicy.longTermIncomeDelta/longTermExpenseDelta','fac.npcFiscalActions'],
      visible: ['faction panel','treasury UI','qijuHistory']
    },
    military_order: {
      required: ['army','order'],
      optional: ['commander','destination','location','garrison','soldiersDelta','moraleDelta','trainingDelta','reason'],
      mutates: ['GM.armies','army.soldiers/morale/training/location','fac.npcMilitaryActions'],
      visible: ['army UI','map/faction panel','qijuHistory']
    },
    diplomacy: {
      required: ['targetFaction','relationDelta'],
      optional: ['relationType','reason','treaty','treatyName','durationTurns'],
      mutates: ['GM.factionRelations','GM.treaties','fac.npcDiplomacyActions'],
      visible: ['faction relation UI','qijuHistory']
    },
    province_policy: {
      required: ['province','policy'],
      optional: ['ownerFaction','minxinDelta','corruptionDelta','unrestDelta','taxDelta','revenueDelta','reason'],
      mutates: ['GM._provinceToFaction','GM.provinceStats','fac.territories','province public order/tax fields'],
      visible: ['map color','province panel','qijuHistory']
    },
    rebellion_policy: {
      required: ['targetFaction','policy'],
      optional: ['support','reason'],
      mutates: ['targetFac._rebellionPressure','fac.npcRebellionPolicies'],
      visible: ['faction AI ledger','qijuHistory']
    },
    spy_or_intrigue: {
      required: ['targetFaction','intrigue'],
      optional: ['target','relationDelta','pressure','reason'],
      mutates: ['targetFac._intriguePressure','GM.factionRelations','fac.npcIntrigueActions'],
      visible: ['faction AI ledger','qijuHistory']
    },
    declare_war: {
      required: ['targetFaction'],
      optional: ['casusBelli','reason'],
      mutates: ['GM.activeWars (via CasusBelliSystem.declareWar·真开战·停战/重复/盟友连坐一并结算)'],
      visible: ['war UI','faction relation UI','qijuHistory','御案时政']
    },
    join_war: {
      required: ['targetFaction'],
      optional: ['casusBelli','reason','warId'],
      mutates: ['GM.activeWars (加入已有战争·可选 warId 指定加入哪一场·缺失取涉目标最新一场·对 targetFaction 宣战·走 CasusBelliSystem·新战 parentWarId 关联原战)'],
      visible: ['war UI','faction relation UI','qijuHistory','御案时政']
    }
  };

  function getActionContract() {
    var c = _clonePlain(ACTION_CONTRACT);
    if (!_livingWorldOn()) LIVING_WORLD_TYPES.forEach(function(t){ delete c[t]; });   // OFF 时不公开 living-world 类型(绝对零泄露)
    return c;
  }

  function formatActionContractForPrompt(opts) {
    opts = opts || {};
    var maxChars = _safeNum(opts.maxChars) || 1800;
    var lines = ['Use actions[] only with these canonical action types. Required fields must use visible candidate names.'];
    var _types = TYPES.slice();
    if (_livingWorldOn()) { maxChars = Math.max(maxChars, 2800); _types = LIVING_WORLD_TYPES.concat(TYPES); lines.push('LIVING WORLD ENABLED — TWO EXTRA VALID action types (declare_war / join_war) are listed FIRST below and route through the real war system: casus belli REQUIRED (missing/none/invalid is rejected when the target is the player). The canonical action-type list is 12 (not 10) while this is on; use these for genuine strategic war, not idle threats.'); }
    _types.forEach(function(type) {
      var c = ACTION_CONTRACT[type] || {};
      lines.push('- ' + type + ': required=' + _arr(c.required).join(',')
        + '; optional=' + _arr(c.optional).join(',')
        + '; mutates=' + _arr(c.mutates).join('/'));
    });
    var out = lines.join('\n');
    return out.length > maxChars ? out.slice(0, maxChars - 20) + '\n...contract truncated' : out;
  }

  function _classifyChar(c) {
    if (global.TM && global.TM.FactionNpcMemorial && global.TM.FactionNpcMemorial._classifyChar) {
      return global.TM.FactionNpcMemorial._classifyChar(c);
    }
    var s = String((c && (c.role || c.position || c.title || c.office)) || '').toLowerCase();
    if (/ruler|king|emperor|主君|皇|王|汗|可汗|首领/.test(s)) return 'ruler';
    if (/将|帅|军|都统|总兵|commander|general/.test(s)) return 'general';
    if (/宗|族|贝勒|王子|clan/.test(s)) return 'clan';
    if (/臣|相|阁|部|院|官|侍郎|尚书|court/.test(s)) return 'court';
    return 'other';
  }

  function _slugId(v) {
    return String(v == null ? '' : v).replace(/[^\w\u4e00-\u9fa5-]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
  }

  function _makeDecisionId(fac, turn) {
    return 'npc_llm_' + (turn || _turn()) + '_' + _slugId(fac && fac.name);
  }

  function _makeAction(decisionId, turn, fac, type, idx, payload, source) {
    return {
      decisionId: decisionId,
      actionId: decisionId + '_' + type + '_' + idx,
      type: type,
      turn: turn,
      faction: fac && fac.name || '',
      source: source || 'legacy',
      payload: payload || {}
    };
  }

  function _nativeActionPayload(a) {
    var payload = {};
    if (a && a.payload && typeof a.payload === 'object') {
      Object.keys(a.payload).forEach(function(k){ payload[k] = a.payload[k]; });
    }
    Object.keys(a || {}).forEach(function(k) {
      if (k === 'type' || k === 'actionType' || k === 'decisionId' || k === 'actionId' || k === 'payload' || k === 'source') return;
      payload[k] = a[k];
    });
    return payload;
  }

  function validateDecision(input) {
    if (!input || typeof input !== 'object') return null;
    var d = _clonePlain(input);
    if (typeof d.rationale !== 'string') d.rationale = '';
    if (!Array.isArray(d.memorials)) d.memorials = [];
    d.memorials = d.memorials.filter(function(m) {
      return m && typeof m === 'object'
        && typeof m.from === 'string'
        && VALID_MEM_TYPES.indexOf(m.type) >= 0
        && VALID_DECISIONS.indexOf(m.rulerDecision) >= 0
        && typeof m.content === 'string';
    }).slice(0, 3);
    if (!(d.edict && typeof d.edict === 'object' && VALID_EDICT_TYPES.indexOf(d.edict.type) >= 0 && typeof d.edict.content === 'string')) d.edict = null;
    if (!(d.chaoyi && typeof d.chaoyi === 'object' && VALID_CHAOYI_TYPES.indexOf(d.chaoyi.type) >= 0)) d.chaoyi = null;
    if (!Array.isArray(d.office)) d.office = [];
    d.office = d.office.filter(function(o) {
      return o && typeof o === 'object' && VALID_OFFICE_KINDS.indexOf(o.kind) >= 0 && typeof o.target === 'string';
    }).slice(0, 2);
    if (!Array.isArray(d.actions)) d.actions = [];
    d.actions = d.actions.filter(function(a) {
      if (!a || typeof a !== 'object') return false;
      var _at = a.type || a.actionType;
      return TYPES.indexOf(_at) >= 0 || (_livingWorldOn() && LIVING_WORLD_TYPES.indexOf(_at) >= 0);
    }).slice(0, 8);
    return d;
  }

  function normalizeDecisionActions(fac, decision, opts) {
    opts = opts || {};
    var turn = _safeNum(opts.turn) || _turn();
    var d = validateDecision(decision);
    if (!d) return [];
    var decisionId = opts.decisionId || d.decisionId || _makeDecisionId(fac, turn);
    var actions = [];
    d.memorials.forEach(function(m, idx){ actions.push(_makeAction(decisionId, turn, fac, 'memorial', idx, m, 'legacy')); });
    if (d.edict) actions.push(_makeAction(decisionId, turn, fac, 'edict', 0, d.edict, 'legacy'));
    if (d.chaoyi) actions.push(_makeAction(decisionId, turn, fac, 'court_alignment', 0, d.chaoyi, 'legacy'));
    d.office.forEach(function(o, idx){ actions.push(_makeAction(decisionId, turn, fac, 'office_change', idx, o, 'legacy')); });
    d.actions.forEach(function(a, idx) {
      var type = a.type || a.actionType;
      actions.push(_makeAction(decisionId, turn, fac, type, idx, _nativeActionPayload(a), 'native'));
    });
    return actions;
  }

  function _pushFacTrajectory(fac, key, rec) {
    if (!fac || !key || !rec) return;
    if (!Array.isArray(fac[key])) fac[key] = [];
    fac[key].push(rec);
    if (fac[key].length > 30) fac[key] = fac[key].slice(-30);
  }

  function _recordAction(fac, action, status, detail) {
    if (!fac || !action) return;
    var row = {
      decisionId: action.decisionId,
      actionId: action.actionId,
      faction: fac.name || action.faction || '',
      type: action.type,
      source: action.source || '',
      turn: action.turn || _turn(),
      status: status || 'applied',
      detail: detail || null,
      engine: 'FactionActionEngine'
    };
    if (!Array.isArray(fac._npcLlmActionLedger)) fac._npcLlmActionLedger = [];
    fac._npcLlmActionLedger.push(row);
    if (fac._npcLlmActionLedger.length > 120) fac._npcLlmActionLedger = fac._npcLlmActionLedger.slice(-120);
    var turnLedger = _ensureFactionAiTurnLedger(row.turn);
    if (turnLedger) {
      turnLedger.actions.push(row);
      if (turnLedger.actions.length > 300) turnLedger.actions = turnLedger.actions.slice(-300);
    }
  }

  function recordLocalAction(fac, type, payload, rec) {
    var turn = _turn();
    var idx = (rec && rec.id) ? _slugId(rec.id) : _nextLocalActionIndex(fac, type, turn);
    var action = _makeAction('npc_local_' + turn + '_' + _slugId(fac && fac.name), turn, fac, type, idx, payload || {}, 'local');
    if (rec && typeof rec === 'object') {
      rec._decisionId = action.decisionId;
      rec._actionId = action.actionId;
      rec._actionType = type;
      rec._actionSource = 'local';
    }
    _recordAction(fac, action, 'applied', rec || null);
    return action;
  }

  function _nextLocalActionIndex(fac, type, turn) {
    if (!fac) return _slugId(type || 'local') + '_1';
    if (fac._npcLocalActionCounterTurn !== turn || !fac._npcLocalActionCounters || typeof fac._npcLocalActionCounters !== 'object') {
      fac._npcLocalActionCounterTurn = turn;
      fac._npcLocalActionCounters = {};
    }
    var key = String(type || 'local');
    fac._npcLocalActionCounters[key] = _safeNum(fac._npcLocalActionCounters[key]) + 1;
    return _slugId(key) + '_' + fac._npcLocalActionCounters[key];
  }

  function _entryFor(fac) {
    return (global.GM && global.GM._facIndex && fac && global.GM._facIndex[fac.name]) || null;
  }

  function _aliveFor(fac) {
    var entry = _entryFor(fac);
    if (entry && Array.isArray(entry.chars)) return entry.chars.filter(function(c){ return c && c.alive !== false; });
    var G = global.GM || {};
    return _arr(G.chars).filter(function(c){ return c && c.alive !== false && c.faction === (fac && fac.name); });
  }

  function _findAliveChar(alive, name) {
    var key = String(name || '').trim();
    if (!key) return null;
    return _arr(alive).find(function(c){ return c && String(c.name || c.id || '').trim() === key; }) || null;
  }

  function _armyBelongsToFac(army, fac) {
    if (!army || !fac || !fac.name) return true;
    var owner = String(army.faction || army.ownerFaction || army.factionName || '').trim();
    return !owner || owner === fac.name;
  }

  function _provinceExists(province) {
    var G = global.GM || {};
    var name = String(province || '').trim();
    if (!name) return false;
    if (G._provinceToFaction && Object.prototype.hasOwnProperty.call(G._provinceToFaction, name)) return true;
    if (G.provinceStats && Object.prototype.hasOwnProperty.call(G.provinceStats, name)) return true;
    return _arr(G.facs).some(function(f) {
      return _arr(f && f.territories).indexOf(name) >= 0 || _arr(f && f.provinceIds).indexOf(name) >= 0;
    });
  }

  function _payloadTargetFor(action) {
    var p = action && action.payload || {};
    return p.targetFaction || p.toFaction || p.targetFac || p.target || p.to || '';
  }

  function validateActionTarget(fac, action, ctx) {
    ctx = ctx || {};
    if (!fac || !action || (TYPES.indexOf(action.type) < 0 && LIVING_WORLD_TYPES.indexOf(action.type) < 0)) return { ok:false, reason:'invalid action' };
    var p = action.payload || {};
    var alive = ctx.alive || _aliveFor(fac);
    if (action.type === 'memorial') {
      var from = p.from || p.target || '';
      return _findAliveChar(alive, from) ? { ok:true } : { ok:false, reason:'char not found', target:from };
    }
    if (action.type === 'office_change') {
      var target = p.target || p.char || p.name || '';
      return _findAliveChar(alive, target) ? { ok:true } : { ok:false, reason:'char not found', target:target };
    }
    if (action.type === 'fiscal_policy') {
      var resource = String(p.resource || p.kind || 'money').trim();
      if (['money','grain','cloth'].indexOf(resource) < 0) return { ok:false, reason:'invalid resource', resource:resource };
      var delta = p.treasuryDelta != null ? _safeNum(p.treasuryDelta) : p.delta != null ? _safeNum(p.delta) : p.amount != null ? _safeNum(p.amount) : 0;
      var incomeDelta = p.incomeDelta != null ? _safeNum(p.incomeDelta) : p.longTermIncomeDelta != null ? _safeNum(p.longTermIncomeDelta) : 0;
      var expenseDelta = p.expenseDelta != null ? _safeNum(p.expenseDelta) : p.longTermExpenseDelta != null ? _safeNum(p.longTermExpenseDelta) : 0;
      if (!delta && !incomeDelta && !expenseDelta) return { ok:false, reason:'missing fiscal effect' };
      if (delta && !(fac.treasury && typeof fac.treasury === 'object')) return { ok:false, reason:'missing treasury' };
      return { ok:true };
    }
    if (action.type === 'military_order') {
      var armyName = p.army || p.armyName || p.name || p.unitName || p.unit || '';
      var army = _findArmy(armyName);
      if (!army) return { ok:false, reason:'army not found', army:armyName };
      if (!_armyBelongsToFac(army, fac)) return { ok:false, reason:'army belongs to other faction', army:armyName };
      var commander = p.commander || p.commanderName || p.general || p.leader || p.newCommander || p.newGeneral || '';
      if (commander && !_findAliveChar(alive, commander)) return { ok:false, reason:'commander not found', commander:commander };
      return { ok:true };
    }
    if (action.type === 'diplomacy') {
      var from = p.fromFaction || p.actorFaction || action.faction || (fac && fac.name) || '';
      var to = p.targetFaction || p.toFaction || p.target || p.to || '';
      if (!from || !to || from === to) return { ok:false, reason:'missing faction target', targetFaction:to };
      return _findFac(to) ? { ok:true } : { ok:false, reason:'target faction not found', targetFaction:to };
    }
    if (action.type === 'province_policy') {
      var province = p.province || p.region || p.division || p.name || '';
      var owner = p.ownerFaction || p.newOwner || p.targetFaction || p.faction || p.toFaction || '';
      if (!_provinceExists(province)) return { ok:false, reason:'province not found', province:province };
      var wantsOwnerChange = owner || String(p.policy || '').indexOf('transfer') >= 0 || String(p.policy || '').indexOf('owner') >= 0;
      if (wantsOwnerChange && !_findFac(owner)) return { ok:false, reason:'owner faction not found', ownerFaction:owner };
      return { ok:true };
    }
    if (action.type === 'declare_war' || action.type === 'join_war') {
      var _wt = p.targetFaction || p.target || p.toFaction || p.defender || p.against || p.enemy || p.to || '';
      _wt = String((_wt && (_wt.name || _wt)) || '').trim();
      if (!_wt || _wt === (fac && fac.name)) return { ok:false, reason:'missing faction target', targetFaction:_wt };
      return _findFac(_wt) ? { ok:true } : { ok:false, reason:'target faction not found', targetFaction:_wt };
    }
    if (action.type === 'spy_or_intrigue' || action.type === 'rebellion_policy') {
      var targetFac = _payloadTargetFor(action);
      if (!targetFac || targetFac === fac.name) return { ok:false, reason:'missing faction target', targetFaction:targetFac };
      return _findFac(targetFac) ? { ok:true } : { ok:false, reason:'target faction not found', targetFaction:targetFac };
    }
    return { ok:true };
  }

  function dryRunDecision(fac, decision, opts) {
    opts = opts || {};
    var turn = _safeNum(opts.turn) || _turn();
    var d = validateDecision(decision);
    if (!d) return { ok:false, errors:[{ reason:'decision invalid' }], actions:[] };
    var actions = normalizeDecisionActions(fac, d, { turn:turn, decisionId: opts.decisionId });
    var ctx = { alive:_aliveFor(fac), ruler:null };
    ctx.ruler = _rulerOf(ctx.alive);
    var errors = [];
    actions.forEach(function(action) {
      var res = validateActionTarget(fac, action, ctx);
      if (!res || !res.ok) errors.push({ actionId:action.actionId, type:action.type, reason:(res && res.reason) || 'invalid action target', detail:res || null });
    });
    return { ok:errors.length === 0, errors:errors, actions:actions, turn:turn };
  }

  function _rulerOf(alive) {
    return alive.find(function(c){ return _classifyChar(c) === 'ruler'; }) || alive[0] || null;
  }

  function _applyMemorial(fac, action, ctx) {
    var p = action.payload || {};
    var alive = ctx.alive || [];
    var ruler = ctx.ruler;
    var char = alive.find(function(c){ return c.name === p.from; });
    if (!char) return { ok:false, reason:'char not found', target:p.from };
    var loyaltyDelta = _clamp(_safeNum(p.loyaltyDelta), -10, 10);
    char.loyalty = _clamp(_safeNum(char.loyalty) + loyaltyDelta, 0, 100);
    if (!Array.isArray(char._memorialMemory)) char._memorialMemory = [];
    char._memorialMemory.push((action.turn || _turn()) + ': ' + p.type + '·' + p.rulerDecision);
    if (char._memorialMemory.length > 10) char._memorialMemory = char._memorialMemory.slice(-10);
    var rec = {
      id: 'npcm_llm_' + (action.turn || _turn()) + '_' + fac.name + '_' + _slugId(action.actionId),
      from: p.from,
      fromRole: _classifyChar(char),
      to: ruler ? ruler.name : '',
      type: p.type,
      subtype: p.type === '密奏' ? '密折' : '上疏',
      content: p.content,
      status: p.rulerDecision,
      ruling: p.ruling || '',
      turn: action.turn || _turn(),
      resolvedTurn: action.turn || _turn(),
      impact: { loyaltyDelta: loyaltyDelta, memoryNote: (action.turn || _turn()) + ': ' + p.type + '·' + p.rulerDecision },
      _generatedByLlm: action.source !== 'local',
      _decisionId: action.decisionId,
      _actionId: action.actionId,
      _actionType: action.type
    };
    _pushFacTrajectory(fac, 'npcMemorials', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge) try { global.TM.FactionNpcNewsBridge.pushMemorial(fac, rec); } catch(_){}
    return { ok:true, summaryKey:'memorials', detail:{ from:p.from, type:p.type } };
  }

  function _applyEdict(fac, action, ctx) {
    var p = action.payload || {};
    var alive = ctx.alive || [];
    var ruler = ctx.ruler;
    var treasuryDelta = _clamp(_safeNum(p.treasuryDelta), -1000000, 1000000);
    if (fac.treasury && typeof fac.treasury === 'object') fac.treasury.money = Math.max(0, _safeNum(fac.treasury.money) + treasuryDelta);
    var loyDeltas = p.loyaltyDeltas || {};
    ['court','general','clan'].forEach(function(role) {
      var d = _clamp(_safeNum(loyDeltas[role]), -15, 15);
      if (!d) return;
      alive.forEach(function(c){ if (_classifyChar(c) === role) c.loyalty = _clamp(_safeNum(c.loyalty) + d, 0, 100); });
    });
    var rec = {
      id: 'npce_llm_' + (action.turn || _turn()) + '_' + fac.name + '_' + _slugId(action.actionId),
      issuer: ruler ? ruler.name : '',
      turn: action.turn || _turn(),
      type: p.type,
      content: p.content,
      trigger: p.trigger || '',
      effects: { treasuryDelta: treasuryDelta, loyaltyDeltas: loyDeltas },
      applied: true,
      _generatedByLlm: action.source !== 'local',
      _decisionId: action.decisionId,
      _actionId: action.actionId,
      _actionType: action.type
    };
    _pushFacTrajectory(fac, 'npcEdicts', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge) try { global.TM.FactionNpcNewsBridge.pushEdict(fac, rec); } catch(_){}
    return { ok:true, summaryKey:'edicts', detail:{ type:p.type, treasuryDelta:treasuryDelta } };
  }

  function _applyCourt(fac, action) {
    var p = action.payload || {};
    var pid = _clamp(_safeNum(p.partyImbalanceDelta), -0.3, 0.3);
    if (fac.derivedHealth && fac.derivedHealth._source) {
      fac.derivedHealth._source.partyImbalance = _clamp(_safeNum(fac.derivedHealth._source.partyImbalance) + pid, 0, 1);
    }
    var alive = _aliveFor(fac);
    var lByP = p.loyaltyDeltaByParty || {};
    Object.keys(lByP).forEach(function(party) {
      var d = _clamp(_safeNum(lByP[party]), -10, 10);
      alive.forEach(function(c){ if (c.party === party) c.loyalty = _clamp(_safeNum(c.loyalty) + d, 0, 100); });
    });
    var rec = {
      id: 'npccy_llm_' + (action.turn || _turn()) + '_' + fac.name + '_' + _slugId(action.actionId),
      turn: action.turn || _turn(),
      type: p.type,
      parties: Object.keys(lByP),
      participants: p.participants || [],
      summary: p.summary || '',
      effects: { partyImbalanceDelta: pid, loyaltyDeltaByParty: lByP },
      _generatedByLlm: action.source !== 'local',
      _decisionId: action.decisionId,
      _actionId: action.actionId,
      _actionType: action.type
    };
    _pushFacTrajectory(fac, 'npcChaoyi', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge) try { global.TM.FactionNpcNewsBridge.pushChaoyi(fac, rec); } catch(_){}
    return { ok:true, summaryKey:'chaoyi', detail:{ type:p.type, partyImbalanceDelta:pid } };
  }

  function _applyOffice(fac, action, ctx) {
    var p = action.payload || {};
    var target = p.target || p.char || p.name || '';
    var alive = ctx.alive || _aliveFor(fac);
    var ruler = ctx.ruler || _rulerOf(alive);
    var char = alive.find(function(c){ return c.name === target; });
    if (!char) return { ok:false, reason:'char not found', target:target };
    var d = _clamp(_safeNum(p.loyaltyDelta != null ? p.loyaltyDelta : p.loyalty_delta), -15, 15);
    var posBefore = char.position || char.officialTitle || char.role || char.title || '';
    var newPosition = p.newPosition || p.position || p.post || p.title || posBefore || '(罢免)';
    var hookResult = null;
    var appointHook = (typeof global.onAppointment === 'function') ? global.onAppointment
      : ((global.AIChangeApplier && typeof global.AIChangeApplier.onAppointment === 'function') ? global.AIChangeApplier.onAppointment : null);
    if (appointHook && newPosition && p.kind !== 'demote' && p.kind !== 'dismiss') {
      try { hookResult = appointHook(target, newPosition, { dept: p.dept || p.deptHint || '' }); } catch(_){}
    }
    char.position = newPosition || char.officialTitle || posBefore;
    if (newPosition && !char.officialTitle) char.officialTitle = newPosition;
    char.loyalty = _clamp(_safeNum(char.loyalty) + d, 0, 100);
    var rec = {
      id: action.actionId,
      action: p.kind || p.action || 'appoint',
      target: target,
      ruler: ruler ? ruler.name : '',
      reason: p.reason || '',
      effect: { positionFrom: posBefore, positionTo: char.position, loyaltyDelta: d, appointmentHook: !!(hookResult && hookResult.ok), treeUpdated: !!(hookResult && hookResult.treeUpdated) },
      turn: action.turn || _turn(),
      _generatedByLlm: action.source !== 'local',
      _decisionId: action.decisionId,
      _actionId: action.actionId,
      _actionType: action.type
    };
    _pushFacTrajectory(fac, 'npcOfficeActions', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge) try { global.TM.FactionNpcNewsBridge.pushOffice(fac, rec); } catch(_){}
    return { ok:true, summaryKey:'office', detail:{ target:target, positionTo:char.position } };
  }

  function _applyFiscal(fac, action) {
    var p = action.payload || {};
    var resource = String(p.resource || p.kind || 'money').trim();
    if (['money','grain','cloth'].indexOf(resource) < 0) resource = 'money';
    var delta = p.treasuryDelta != null ? _safeNum(p.treasuryDelta) : p.delta != null ? _safeNum(p.delta) : p.amount != null ? _safeNum(p.amount) : 0;
    var incomeDelta = p.incomeDelta != null ? _safeNum(p.incomeDelta) : p.longTermIncomeDelta != null ? _safeNum(p.longTermIncomeDelta) : 0;
    var expenseDelta = p.expenseDelta != null ? _safeNum(p.expenseDelta) : p.longTermExpenseDelta != null ? _safeNum(p.longTermExpenseDelta) : 0;
    if (!delta && !incomeDelta && !expenseDelta) return { ok:false, reason:'missing fiscal effect' };
    var before = fac.treasury && typeof fac.treasury === 'object' ? _safeNum(fac.treasury[resource]) : 0;
    var after = before;
    if (delta) {
      if (!fac.treasury || typeof fac.treasury !== 'object') return { ok:false, reason:'missing treasury' };
      fac.treasury[resource] = Math.max(0, before + delta);
      after = fac.treasury[resource];
    }
    if (!fac.fiscalPolicy || typeof fac.fiscalPolicy !== 'object') fac.fiscalPolicy = {};
    fac.fiscalPolicy.longTermIncomeDelta = _safeNum(fac.fiscalPolicy.longTermIncomeDelta) + incomeDelta;
    fac.fiscalPolicy.longTermExpenseDelta = _safeNum(fac.fiscalPolicy.longTermExpenseDelta) + expenseDelta;
    fac.fiscalPolicy.lastLlmPolicy = {
      turn: action.turn || _turn(),
      resource: resource,
      policyName: p.policyName || p.policy || '',
      reason: p.reason || p.rationale || '',
      incomeDelta: incomeDelta,
      expenseDelta: expenseDelta,
      treasuryDelta: delta
    };
    if (fac.derivedEconomy && typeof fac.derivedEconomy === 'object') {
      fac.derivedEconomy.llmIncomeDelta = _safeNum(fac.derivedEconomy.llmIncomeDelta) + incomeDelta;
      fac.derivedEconomy.llmExpenseDelta = _safeNum(fac.derivedEconomy.llmExpenseDelta) + expenseDelta;
    }
    var rec = { id:action.actionId, turn:action.turn || _turn(), resource:resource, delta:delta, incomeDelta:incomeDelta, expenseDelta:expenseDelta, from:before, to:after, reason:p.reason || p.rationale || '', _generatedByLlm:action.source !== 'local', _decisionId:action.decisionId, _actionId:action.actionId, _actionType:action.type };
    _pushFacTrajectory(fac, 'npcFiscalActions', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge && typeof global.TM.FactionNpcNewsBridge.pushFiscalPolicy === 'function') try { global.TM.FactionNpcNewsBridge.pushFiscalPolicy(fac, rec); } catch(_){}
    return { ok:true, summaryKey:'fiscalPolicy', detail:{ resource:resource, from:before, to:after, delta:delta, incomeDelta:incomeDelta, expenseDelta:expenseDelta } };
  }

  function _findArmy(name) {
    var G = global.GM || {};
    var key = String(name || '').trim();
    if (!key || !Array.isArray(G.armies)) return null;
    return G.armies.find(function(a) {
      return a && [a.name, a.armyName, a.id, a.unitName, a.title].some(function(v){ return String(v || '').trim() === key; });
    }) || null;
  }

  function _armyCommander(army) { return String((army && (army.commander || army.commanderName || army.general || army.leader)) || '').trim(); }

  function _syncArmyCommanderAliases(army, commander) {
    if (!army) return false;
    commander = String(commander || '').trim();
    var changed = false;
    ['commander','commanderName','commanderDisplayName','commander_name','general','generalName','leader','leaderName','chiefCommander','chiefGeneral','mainGeneral'].forEach(function(k) {
      if (army[k] !== commander) { army[k] = commander; changed = true; }
    });
    return changed;
  }

  function _applyMilitary(fac, action) {
    var p = action.payload || {};
    var armyName = p.army || p.armyName || p.name || p.unitName || p.unit || '';
    var commander = p.commander || p.commanderName || p.general || p.leader || p.newCommander || p.newGeneral || '';
    var army = _findArmy(armyName);
    if (!army) return { ok:false, reason:'army not found', army:armyName };
    var oldCommander = _armyCommander(army);
    if (army.commandChain && army.commandChain.mode === 'receipt' && !(global.TM && TM.CommandAuthority)) return {ok:false,reason:'军令交接尚待核验'};
    var commandResult = global.TM && TM.CommandAuthority && TM.CommandAuthority.applyNpcOrder(army,fac,p,'faction-action-engine');
    if (commandResult && !commandResult.ok) return commandResult;
    var usedGlobal = !!commandResult;
    if (!usedGlobal && typeof global.applyAIArmyChange === 'function') {
      try {
        var res = global.applyAIArmyChange({name:armyName,commander:commander || undefined,destination:p.destination,location:p.location,garrison:p.garrison,reason:p.reason || p.rationale || ''},{source:'faction-action-engine'});
        usedGlobal = !!(res && res.ok);
      } catch(_){}
    }
    if (!usedGlobal && commander) _syncArmyCommanderAliases(army, commander);
    if (!usedGlobal) {
      if (p.destination) army.destination = p.destination;
      if (p.location || p.garrison) { army.location = p.location || p.garrison; army.garrison = p.garrison || p.location; }
    }
    var soldiersDelta = _safeNum(p.soldiersDelta != null ? p.soldiersDelta : p.troopsDelta);
    var moraleDelta = _safeNum(p.moraleDelta);
    var trainingDelta = _safeNum(p.trainingDelta);
    if (soldiersDelta) {
      var soldiersKey = army.soldiers != null ? 'soldiers' : (army.troops != null ? 'troops' : (army.count != null ? 'count' : 'soldiers'));
      army[soldiersKey] = Math.max(0, _safeNum(army[soldiersKey]) + soldiersDelta);
      if (soldiersKey !== 'soldiers') army.soldiers = army[soldiersKey];
    }
    if (moraleDelta) army.morale = _clamp(_safeNum(army.morale) + moraleDelta, 0, 100);
    if (trainingDelta) army.training = _clamp(_safeNum(army.training) + trainingDelta, 0, 100);
    if (!Array.isArray(army.orders)) army.orders = [];
    army.orders.push({ turn: action.turn || _turn(), order: p.order || p.kind || 'military_order', reason: p.reason || p.rationale || '', source: 'faction-llm' });
    if (army.orders.length > 20) army.orders = army.orders.slice(-20);
    var rec = { id:action.actionId, turn:action.turn || _turn(), action:p.order || p.kind || 'military_order', army:army.name || armyName, commanderFrom:oldCommander, commanderTo:commander || _armyCommander(army), soldiersDelta:soldiersDelta, moraleDelta:moraleDelta, trainingDelta:trainingDelta, reason:p.reason || p.rationale || '', _generatedByLlm:action.source !== 'local', _decisionId:action.decisionId, _actionId:action.actionId, _actionType:action.type };
    _pushFacTrajectory(fac, 'npcMilitaryActions', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge && typeof global.TM.FactionNpcNewsBridge.pushMilitaryAction === 'function') try { global.TM.FactionNpcNewsBridge.pushMilitaryAction(fac, rec); } catch(_){}
    var _milEvent = null;
    var _ord = String(p.order || p.kind || '');
    if (/move|reinforce|移防|调动|增兵|开拔|进兵|移屯/i.test(_ord) || Math.abs(_safeNum(soldiersDelta)) >= 5000) _milEvent = { kind:'troop_move', actor:(fac && fac.name), target:(p.destination || p.location || p.garrison || '') };
    return { ok:true, summaryKey:'military', detail:{ army:rec.army, commanderFrom:oldCommander, commanderTo:rec.commanderTo, soldiersDelta:soldiersDelta, moraleDelta:moraleDelta, trainingDelta:trainingDelta }, worldEvent:_milEvent };
  }

  function _findRelationRecord(from, to) {
    var G = global.GM || {};
    return _arr(G.factionRelations).find(function(r){ return r && r.from === from && r.to === to; }) || null;
  }

  function _upsertRelationRecord(from, to, patch) {
    var G = global.GM || {};
    if (!Array.isArray(G.factionRelations)) G.factionRelations = [];
    var rec = _findRelationRecord(from, to);
    if (!rec) { rec = { from:from, to:to, type:'neutral', value:0, desc:'' }; G.factionRelations.push(rec); }
    if (patch.type != null) rec.type = patch.type;
    if (patch.value != null) rec.value = _clamp(_safeNum(patch.value), -100, 100);
    if (patch.desc != null) rec.desc = patch.desc;
    return rec;
  }

  function _applyDiplomacy(fac, action) {
    var p = action.payload || {};
    var from = p.fromFaction || p.actorFaction || action.faction || (fac && fac.name) || '';
    var to = p.targetFaction || p.toFaction || p.target || p.to || '';
    if (!from || !to || from === to) return { ok:false, reason:'missing faction target' };
    var delta = _safeNum(p.relationDelta != null ? p.relationDelta : p.delta);
    var oldRec = _findRelationRecord(from, to) || _findRelationRecord(to, from);
    var oldValue = oldRec && oldRec.value != null ? _safeNum(oldRec.value) : 0;
    var nextValue = (p.value != null) ? _clamp(_safeNum(p.value), -100, 100) : _clamp(oldValue + delta, -100, 100);
    var relType = p.relationType || p.newType || p.status || (oldRec && oldRec.type) || 'neutral';
    var desc = p.reason || p.event || p.desc || '';
    if (typeof global.setFactionRelation === 'function') {
      try { global.setFactionRelation(from, to, { value:nextValue, type:relType, desc:desc }, { mirror:true }); } catch(_){}
    } else {
      _upsertRelationRecord(from, to, { value:nextValue, type:relType, desc:desc });
      _upsertRelationRecord(to, from, { value:nextValue, type:relType, desc:desc });
    }
    var treatyTitle = p.treaty || p.treatyName || p.agreement || '';
    var treatyRec = null;
    if (treatyTitle) {
      var G = global.GM || {};
      if (!Array.isArray(G.treaties)) G.treaties = [];
      treatyRec = {
        id: action.actionId + '_treaty',
        turn: action.turn || _turn(),
        from: from,
        to: to,
        title: String(treatyTitle),
        type: relType,
        status: 'active',
        durationTurns: p.durationTurns != null ? _safeNum(p.durationTurns) : null,
        expiresTurn: p.durationTurns != null ? (action.turn || _turn()) + _safeNum(p.durationTurns) : null,
        reason: desc,
        _source: 'faction-llm'
      };
      G.treaties.push(treatyRec);
      if (G.treaties.length > 80) G.treaties = G.treaties.slice(-80);
    }
    var rec = { id:action.actionId, turn:action.turn || _turn(), from:from, to:to, relationFrom:oldValue, relationTo:nextValue, relationType:relType, treaty:treatyTitle || '', reason:desc, _generatedByLlm:action.source !== 'local', _decisionId:action.decisionId, _actionId:action.actionId, _actionType:action.type };
    _pushFacTrajectory(fac, 'npcDiplomacyActions', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge && typeof global.TM.FactionNpcNewsBridge.pushDiplomacyAction === 'function') try { global.TM.FactionNpcNewsBridge.pushDiplomacyAction(fac, rec); } catch(_){}
    var _dipEvent = null;
    var _relDelta = _safeNum(nextValue) - _safeNum(oldValue);
    if (treatyTitle || /盟|结盟|alliance|同盟/i.test(String(relType)) || _relDelta >= 40) _dipEvent = { kind:'alliance', actor:from, target:to, rel:String(relType||''), treaty:String(treatyTitle||'') };
    else if (_relDelta <= -40 || /敌|绝交|背盟|反目|betray|hostile/i.test(String(relType))) _dipEvent = { kind:'betrayal', actor:from, target:to, rel:String(relType||'') };
    return { ok:true, summaryKey:'diplomacy', detail:{ from:from, to:to, relationFrom:oldValue, relationTo:nextValue, treaty:treatyTitle || '', treatyRecord:!!treatyRec }, worldEvent:_dipEvent };
  }

  function _adjustProvinceField(st, keys, delta, lo, hi) {
    if (!st || !delta) return null;
    var key = keys.find(function(k){ return st[k] != null; }) || keys[0];
    var before = _safeNum(st[key]);
    var after = before + delta;
    if (lo != null || hi != null) after = _clamp(after, lo == null ? -Infinity : lo, hi == null ? Infinity : hi);
    st[key] = after;
    return { key:key, from:before, to:after, delta:delta };
  }

  function _applyProvince(fac, action) {
    var p = action.payload || {};
    var province = p.province || p.region || p.division || p.name || '';
    var owner = p.ownerFaction || p.newOwner || p.targetFaction || p.faction || p.toFaction || '';
    if (!province) return { ok:false, reason:'missing province', province:province };
    var G = global.GM || {};
    if (!G.provinceStats) G.provinceStats = {};
    if (!G.provinceStats[province]) G.provinceStats[province] = {};
    var st = G.provinceStats[province];
    var oldOwner = (G._provinceToFaction && G._provinceToFaction[province]) || st.owner || '';
    var changed = false;
    if (owner && global.TM && global.TM.FactionMembership && typeof global.TM.FactionMembership.assignProvince === 'function') {
      try { changed = global.TM.FactionMembership.assignProvince(province, owner, { reason:p.reason || '势力行动引擎', silent:true }); } catch(_){}
    }
    if (owner && !changed) {
      if (!G._provinceToFaction) G._provinceToFaction = {};
      G._provinceToFaction[province] = owner;
      st.owner = owner;
      _arr(G.facs).forEach(function(f) {
        if (!f || !f.name) return;
        if (Array.isArray(f.territories)) f.territories = f.territories.filter(function(x){ return x !== province; });
        if (Array.isArray(f.provinceIds)) f.provinceIds = f.provinceIds.filter(function(x){ return x !== province; });
        if (f.name === owner) {
          if (!Array.isArray(f.territories)) f.territories = [];
          if (!Array.isArray(f.provinceIds)) f.provinceIds = [];
          if (f.territories.indexOf(province) < 0) f.territories.push(province);
          if (f.provinceIds.indexOf(province) < 0) f.provinceIds.push(province);
        }
      });
      changed = oldOwner !== owner;
    } else if (!st.owner && oldOwner) {
      st.owner = oldOwner;
    }
    var effects = {};
    var minxin = _adjustProvinceField(st, ['minxinLocal','minxin','publicSentiment','popularSupport'], _safeNum(p.minxinDelta), 0, 100);
    var corruption = _adjustProvinceField(st, ['corruptionLocal','corruption'], _safeNum(p.corruptionDelta), 0, 100);
    var unrest = _adjustProvinceField(st, ['unrest','unrestLocal','rebellionRisk'], _safeNum(p.unrestDelta), 0, 100);
    var tax = _adjustProvinceField(st, ['taxRevenue','revenue','annualTaxIncome'], _safeNum(p.taxDelta != null ? p.taxDelta : p.revenueDelta), null, null);
    // 真值源并账：势力行动改的是 G.provinceStats，但聚合(G.minxin.trueIndex)/民变判级读的是 adminHierarchy 的
    //   div.minxin / div.corruption。不同步则势力施压的地方民心/腐败进不了推演真值 = 蒸发。把同等增量落到 div。
    try {
      var _PU = global.TM && global.TM.AIChange && global.TM.AIChange.PathUtils;
      var _resolveDiv = _PU && (_PU.findDivisionByNameFuzzy || _PU.findDivisionByNameOrId);
      var _div = _resolveDiv ? _resolveDiv(G, province) : null;
      if (_div) {
        var _mxD = _safeNum(p.minxinDelta);
        if (_mxD) {
          _div.minxin = _clamp(_safeNum(_div.minxin != null ? _div.minxin : 60) + _mxD, 0, 100);
          if (_div.minxinDetails && typeof _div.minxinDetails === 'object') _div.minxinDetails.trueIndex = _div.minxin;
        }
        var _coD = _safeNum(p.corruptionDelta);
        if (_coD) _div.corruption = _clamp(_safeNum(_div.corruption != null ? _div.corruption : 0) + _coD, 0, 100);
      }
    } catch (_) {}
    if (minxin) effects.minxin = minxin;
    if (corruption) effects.corruption = corruption;
    if (unrest) effects.unrest = unrest;
    if (tax) effects.tax = tax;
    var rec = { id:action.actionId, turn:action.turn || _turn(), province:province, policy:p.policy || (owner ? 'transfer_owner' : 'governance'), ownerFrom:oldOwner, ownerTo:owner || oldOwner, reason:p.reason || '', changed:changed, effects:effects, _generatedByLlm:action.source !== 'local', _decisionId:action.decisionId, _actionId:action.actionId, _actionType:action.type };
    _pushFacTrajectory(fac, 'npcProvincePolicies', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge && typeof global.TM.FactionNpcNewsBridge.pushProvincePolicy === 'function') try { global.TM.FactionNpcNewsBridge.pushProvincePolicy(fac, rec); } catch(_){}
    return { ok:true, summaryKey:'provincePolicy', detail:{ province:province, ownerFrom:oldOwner, ownerTo:owner || oldOwner, effects:effects } };
  }

  function _findFac(name) {
    var G = global.GM || {};
    return _arr(G.facs).find(function(f){ return f && f.name === name; }) || null;
  }

  function _applyIntrigue(fac, action) {
    var p = action.payload || {};
    var targetFacName = p.targetFaction || p.toFaction || p.targetFac || '';
    var targetFac = _findFac(targetFacName);
    if (!targetFac) return { ok:false, reason:'target faction not found', targetFaction:targetFacName };
    var pressure = Math.max(1, Math.round(Math.abs(_safeNum(p.relationDelta || p.pressure || 8)) / 6));
    targetFac._intriguePressure = _safeNum(targetFac._intriguePressure) + pressure;
    if (p.relationDelta) _applyDiplomacy(fac, _makeAction(action.decisionId, action.turn, fac, 'diplomacy', 0, { targetFaction:targetFacName, relationDelta:p.relationDelta, relationType:p.relationType || '暗斗加深', reason:p.reason || '暗中离间' }, action.source));
    var rec = { id:action.actionId, turn:action.turn || _turn(), targetFaction:targetFacName, intrigue:p.intrigue || p.policy || 'covert', pressure:pressure, reason:p.reason || '', _generatedByLlm:action.source !== 'local', _decisionId:action.decisionId, _actionId:action.actionId, _actionType:action.type };
    _pushFacTrajectory(fac, 'npcIntrigueActions', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge && typeof global.TM.FactionNpcNewsBridge.pushIntrigue === 'function') try { global.TM.FactionNpcNewsBridge.pushIntrigue(fac, rec); } catch(_){}
    return { ok:true, summaryKey:'intrigue', detail:{ targetFaction:targetFacName, pressure:pressure } };
  }

  function _applyRebellion(fac, action) {
    var p = action.payload || {};
    var targetFacName = p.targetFaction || p.toFaction || p.targetFac || '';
    var targetFac = _findFac(targetFacName);
    if (!targetFac) return { ok:false, reason:'target faction not found', targetFaction:targetFacName };
    var support = Math.max(1, _safeNum(p.support || p.pressure || 1));
    targetFac._rebellionPressure = _safeNum(targetFac._rebellionPressure) + support;
    targetFac._rebellionSponsoredTurn = action.turn || _turn();
    var rec = { id:action.actionId, turn:action.turn || _turn(), targetFaction:targetFacName, policy:p.policy || 'incite', support:support, reason:p.reason || '', _generatedByLlm:action.source !== 'local', _decisionId:action.decisionId, _actionId:action.actionId, _actionType:action.type };
    _pushFacTrajectory(fac, 'npcRebellionPolicies', rec);
    if (global.TM && global.TM.FactionNpcNewsBridge && typeof global.TM.FactionNpcNewsBridge.pushRebellionPolicy === 'function') try { global.TM.FactionNpcNewsBridge.pushRebellionPolicy(fac, rec); } catch(_){}
    return { ok:true, summaryKey:'rebellionPolicy', detail:{ targetFaction:targetFacName, support:support } };
  }

  // ── 【F2·势力活世界】总闸读口 + 真战争接线(declare_war/join_war 走 CasusBelliSystem·绝不自写 activeWars) ──
  function _livingWorldOn() {
    if (!global.GM || global.GM._factionLivingWorld === false) return false;   // 2026-07-22 翻默认 ON·可关(显式 false 才关)
    if (typeof global.agentModeOn === 'function' && global.agentModeOn()) return false;   // B8·agent 模式(mode-b·平行回合引擎)下总闸不生效·功能不可达·与 agent-flags「子 flag 不点亮」同一语义
    return true;
  }
  var _LW_PLAYER_WAR_REL_THRESHOLD = -40;   // 对玩家宣战/参战门槛：关系值须 <= 此值 且 有正当 casus belli·防开局乱咬
  function _lwPlayerFacNames() {
    var G = global.GM || {}, P0 = global.P || {}, out = [];
    function push(v){ v = String(v == null ? '' : v).trim(); if (v && out.indexOf(v) < 0) out.push(v); }
    push(P0.playerInfo && P0.playerInfo.factionName); push(P0.playerFactionName); push(P0.playerFaction);
    push(G.playerFactionName); push(G.playerFaction); if (G.playerInfo) push(G.playerInfo.factionName);
    _arr(G.facs).forEach(function(f){ if (f && (f.isPlayer || f.playerControlled || f.controlledBy === 'player' || f.controller === 'player')) push(f.name); });
    return out;
  }
  function _lwResolveFacName(v) {
    var name = String((v && (v.name || v.factionName)) || v || '').trim();
    if (!name) return '';
    var f = _findFac(name);
    return f ? f.name : name;
  }
  function _lwResolveCasusBelli(v) {
    var s0 = String(v == null ? '' : v).trim().toLowerCase();
    if (VALID_CASUS_BELLI.indexOf(s0) >= 0) return s0;
    var z = String(v == null ? '' : v);
    if (/rebel|叛|逆|平叛/i.test(z)) return 'rebellion';
    if (/border|边|疆/i.test(z)) return 'border';
    if (/claim|宣称|领土|故土/i.test(z)) return 'claim';
    if (/holy|讨不臣|天子|勤王/i.test(z)) return 'holy';
    if (/subjug|征服|吞并/i.test(z)) return 'subjugation';
    return '';   // 未识别·不擅自归一(玩家门槛 fail-closed 用；NPC 侧调用处补 'border' 宽松默认)
  }
  function _lwPlayerWarBlocked(attacker, target, cbMatched) {
    if (_lwPlayerFacNames().indexOf(target) < 0) return null;   // 非玩家势力·无额外门槛(NPC-vs-NPC 宽松)
    var rel = _findRelationRecord(attacker, target) || _findRelationRecord(target, attacker);
    var relVal = rel && rel.value != null ? _safeNum(rel.value) : 0;
    if (relVal > _LW_PLAYER_WAR_REL_THRESHOLD) return { reason: 'player-war blocked: relation ' + relVal + ' > ' + _LW_PLAYER_WAR_REL_THRESHOLD, relValue: relVal };
    // fail-closed：对玩家宣战/参战·casus belli 必须是明确正当法理(缺失/none/非法一律拒·不走宽松归一)
    if (!cbMatched || cbMatched === 'none') return { reason: 'player-war blocked: needs an explicit legitimate casus belli (fail-closed)' };
    return null;
  }
  function _lwWarOngoing(w) {
    if (!w || w.active === false || w.ended === true || w.endedTurn) return false;
    var st = String(w.status || '');
    return st !== 'ended' && st !== 'peace' && st !== 'truce';   // 与 hasPeaced 谓词对齐
  }
  function _lwAlreadyAtWar(a, b) {
    return _arr((global.GM || {}).activeWars).some(function(w){ return w && ((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)); });
  }
  function _lwDeclareViaCasusBelli(attacker, target, cbId) {
    var CB = global.CasusBelliSystem;
    if (!CB || typeof CB.declareWar !== 'function') return { ok: false, reason: 'CasusBelliSystem unavailable' };
    var res;
    try { res = CB.declareWar(attacker, target, cbId); } catch (e) { return { ok: false, reason: 'declareWar threw: ' + ((e && e.message) || e) }; }
    if (!res || res.success !== true) return { ok: false, reason: (res && res.message) || 'declareWar failed' };
    return { ok: true, war: res.war || null };
  }
  function _applyDeclareWar(fac, action) {
    if (!_livingWorldOn()) return { ok: false, reason: 'living world off' };
    var p = action.payload || {};
    var attacker = fac && fac.name;
    var target = _lwResolveFacName(p.targetFaction || p.target || p.toFaction || p.defender || p.to);
    if (!attacker || !target || attacker === target) return { ok: false, reason: 'missing/invalid war target', targetFaction: target };
    if (!_findFac(target)) return { ok: false, reason: 'target faction not found', targetFaction: target };
    if (_lwAlreadyAtWar(attacker, target)) return { ok: false, reason: 'already at war', targetFaction: target };
    var cbMatched = _lwResolveCasusBelli(p.casusBelli || p.cb);   // 只认 casusBelli/cb 作法理·reason 不充数
    var blocked = _lwPlayerWarBlocked(attacker, target, cbMatched);
    if (blocked) return { ok: false, reason: blocked.reason, targetFaction: target };
    var cbId = cbMatched || 'border';   // NPC-vs-NPC 未识别时宽松默认 border(玩家侧已 fail-closed 拦下)
    var dr = _lwDeclareViaCasusBelli(attacker, target, cbId);
    if (!dr.ok) return { ok: false, reason: dr.reason, targetFaction: target };
    var rec = { id: action.actionId, turn: action.turn || _turn(), targetFaction: target, casusBelli: (dr.war && dr.war.casusBelli) || cbId, warId: (dr.war && dr.war.id) || '', reason: p.reason || '', _generatedByLlm: action.source !== 'local', _decisionId: action.decisionId, _actionId: action.actionId, _actionType: action.type };
    _pushFacTrajectory(fac, 'npcWarActions', rec);
    return { ok: true, summaryKey: 'wars', detail: { targetFaction: target, warId: rec.warId, casusBelli: rec.casusBelli }, worldEvent: { kind: 'declare_war', actor: attacker, target: target, cb: rec.casusBelli } };
  }
  function _applyJoinWar(fac, action) {
    if (!_livingWorldOn()) return { ok: false, reason: 'living world off' };
    var p = action.payload || {};
    var joiner = fac && fac.name;
    var enemy = _lwResolveFacName(p.targetFaction || p.against || p.enemy || p.target || p.to);
    if (!joiner || !enemy || joiner === enemy) return { ok: false, reason: 'missing/invalid war target', targetFaction: enemy };
    if (!_findFac(enemy)) return { ok: false, reason: 'target faction not found', targetFaction: enemy };
    // 必须已有涉 enemy 的进行中战争(=加入非另起)。优先 honor LLM 指定的合法 warId·缺失/非法→确定性规则=取涉目标最新一场(startTurn 最大·并列取数组末位)
    var _joinWars = _arr((global.GM || {}).activeWars).filter(function(w){ return _lwWarOngoing(w) && (w.attacker === enemy || w.defender === enemy); });   // 仅进行中(过滤 inactive/ended 残留·防死战 warId 误判合法)
    if (!_joinWars.length) return { ok: false, reason: 'no ongoing war involving target (join needs an existing war)', targetFaction: enemy };
    var _wantWarId = p.warId || p.warID || p.war || '';
    var origWar = _wantWarId ? (_joinWars.filter(function(w){ return String(w.id) === String(_wantWarId); })[0] || null) : null;
    if (!origWar) origWar = _joinWars.reduce(function(best, w){ return (!best || _safeNum(w.startTurn) >= _safeNum(best.startTurn)) ? w : best; }, null);
    if (_lwAlreadyAtWar(joiner, enemy)) return { ok: false, reason: 'already at war', targetFaction: enemy };
    var cbMatched = _lwResolveCasusBelli(p.casusBelli || p.cb);
    var blocked = _lwPlayerWarBlocked(joiner, enemy, cbMatched);
    if (blocked) return { ok: false, reason: blocked.reason, targetFaction: enemy };
    var cbId = cbMatched || 'holy';   // 参战默认「天子讨不臣」(玩家侧已 fail-closed)
    var dr = _lwDeclareViaCasusBelli(joiner, enemy, cbId);
    if (!dr.ok) return { ok: false, reason: dr.reason, targetFaction: enemy };
    // war 结构为双边(无盟军侧·盟友参战本就靠独立 war 对象·见 tm-feudal-warfare _ty_callAlliesToWar)·
    //   故「加入」= 对 enemy 新起双边战 + parentWarId 关联原战·语义取舍注此。
    if (dr.war) { dr.war.parentWarId = origWar.id || ''; dr.war._joinedWar = true; }
    var rec = { id: action.actionId, turn: action.turn || _turn(), targetFaction: enemy, casusBelli: (dr.war && dr.war.casusBelli) || cbId, warId: (dr.war && dr.war.id) || '', parentWarId: origWar.id || '', joinedWar: true, reason: p.reason || '', _generatedByLlm: action.source !== 'local', _decisionId: action.decisionId, _actionId: action.actionId, _actionType: action.type };
    _pushFacTrajectory(fac, 'npcWarActions', rec);
    return { ok: true, summaryKey: 'wars', detail: { targetFaction: enemy, warId: rec.warId, parentWarId: origWar.id || '', joinedWar: true }, worldEvent: { kind: 'join_war', actor: joiner, target: enemy, cb: rec.casusBelli } };
  }
  // 设置面板「势力活世界·实验」开关处理器(tm-patches.js 设置渲染调·切 GM._factionLivingWorld·本局存档生效·御驾亲征式 pill 类切换)
  function setFactionLivingWorld(on, btn) {
    on = !!on;
    try { if (global.GM) { global.GM._factionLivingWorld = on; global.GM._factionLivingWorldSetByUser = true; } } catch (e) {}   // arch-ok: F2 势力活世界总闸 + 用户意图戳·本局存档·御驾亲征式设置开关(唯一写口)
    try { if (global.P) { global.P.conf = global.P.conf || {}; global.P.conf.factionLivingWorldDefault = on; } } catch (e) {}   // arch-ok: 跨局默认镜像·发车前(临时 GM 会被 tm-patches-start 重建)靠此存活到新局·normalizer 无戳时读它
    try { if (btn && btn.parentNode) { var bs = btn.parentNode.querySelectorAll('button[data-slhs]'); for (var i = 0; i < bs.length; i++) { var want = bs[i].getAttribute('data-slhs') === '1'; bs[i].className = 'bt ' + (want === on ? 'bp' : 'bs') + ' bsm'; } } } catch (e) {}
    try { if (typeof global._tmSyncLivingWorldMaster === 'function') global._tmSyncLivingWorldMaster(); } catch (e) {}   // 个体切换后同步「活世界演绎·总纲」勾选态(幂等·不递归)
    try { if (typeof global.toast === 'function') global.toast(on ? '势力活世界已开启 · 列国将真宣战/结盟/立志/兴事(本局存档生效)' : '势力活世界已关闭 · 列国维持现状'); } catch (e) {}
  }

  var APPLIERS = {
    memorial: _applyMemorial,
    edict: _applyEdict,
    court_alignment: _applyCourt,
    office_change: _applyOffice,
    fiscal_policy: _applyFiscal,
    military_order: _applyMilitary,
    diplomacy: _applyDiplomacy,
    province_policy: _applyProvince,
    spy_or_intrigue: _applyIntrigue,
    rebellion_policy: _applyRebellion,
    declare_war: _applyDeclareWar,
    join_war: _applyJoinWar
  };

  function ensureStrategy(fac, decision, actions) {
    if (!fac) return null;
    if (!fac.aiStrategy || typeof fac.aiStrategy !== 'object') fac.aiStrategy = {};
    var s = fac.aiStrategy;
    if (!Array.isArray(s.goals)) s.goals = [];
    if (!Array.isArray(s.grudges)) s.grudges = [];
    if (!Array.isArray(s.warAims)) s.warAims = [];
    // B4·目标栈激活(总闸带动/独立开)时 s.goals 归 FactionGoalStack 结构化对象所有·字符串行为标签改落 s.recentActionLabels(objectives 亦已收同标签)·防混合数组撞契约
    var _gsOn = (typeof agentFlagOn === 'function') ? !!agentFlagOn('factionGoalStackEnabled') : !!(global.P && global.P.conf && global.P.conf.factionGoalStackEnabled);
    if (_gsOn) {
      if (!Array.isArray(s.recentActionLabels)) s.recentActionLabels = [];
      if (s.goals.some(function(g){ return typeof g === 'string'; })) {   // B4·一次性迁移·幂等(迁完再跑无字符串项)
        s.goals.forEach(function(g){ if (typeof g === 'string' && s.recentActionLabels.indexOf(g) < 0) s.recentActionLabels.push(g); });
        s.goals = s.goals.filter(function(g){ return g && typeof g === 'object'; });
      }
    }
    // 【势力 agent·posture 自著·2026-06-19】开关开 + LLM 给了 posture → 用势力自己宣告的战略姿态(替冻结的启发式默认·随局势演进)·否则保留现有或启发式种子(零回归)
    if (decision && decision.posture && (typeof agentFlagOn === 'function' ? agentFlagOn('factionAgentEnabled') : (global.P && global.P.conf && global.P.conf.factionAgentEnabled))) {
      s.posture = String(decision.posture).slice(0, 16);
    } else if (!s.posture) {
      s.posture = (fac.aiProfile && fac.aiProfile.posture) || fac.posture || '观望';
    }
    var turn = _turn();
    if (decision && decision.rationale) s.currentPlan = String(decision.rationale).slice(0, 160);
    _arr(actions).forEach(function(a) {
      var p = a.payload || {};
      var label = a.type + (p.targetFaction ? ':' + p.targetFaction : p.province ? ':' + p.province : p.army ? ':' + p.army : '');
      if (_gsOn) { if (s.recentActionLabels.indexOf(label) < 0) s.recentActionLabels.push(label); } else if (s.goals.indexOf(label) < 0) { s.goals.push(label); }
      if ((a.type === 'diplomacy' && _safeNum(p.relationDelta) < 0) || a.type === 'spy_or_intrigue') {
        var g = p.targetFaction || p.toFaction || p.target || '';
        if (g && s.grudges.indexOf(g) < 0) s.grudges.push(g);
      }
      if (a.type === 'province_policy' || a.type === 'military_order') {
        var aim = p.province || p.destination || p.army || '';
        if (aim && s.warAims.indexOf(aim) < 0) s.warAims.push(aim);
      }
    });
    if (_gsOn) { if (s.recentActionLabels.length > 12) s.recentActionLabels = s.recentActionLabels.slice(-12); } else if (s.goals.length > 12) { s.goals = s.goals.slice(-12); }
    if (s.grudges.length > 12) s.grudges = s.grudges.slice(-12);
    if (s.warAims.length > 12) s.warAims = s.warAims.slice(-12);
    s.lastUpdatedTurn = turn;
    return s;
  }

  // 【F2·Slice2】目标生命周期修剪·仅总闸 ON 时跑(OFF 时 ensureStrategyV2 行为不变=零回归)：
  //   claims 已占(本势力现掌该地)→达成移除·threats 已亡(不在现存势力)/已结盟→失效移除·alliances 已亡→移除·
  //   结构化目标栈 FactionGoalStack.pruneGoals(超期未推进→abandoned·降权)。
  function _pruneStrategyLifecycle(fac, s, turn) {
    var G = global.GM || {};
    var facNames = {};
    _arr(G.facs).forEach(function(f){ if (f && f.name) facNames[f.name] = true; });
    var p2f = (G._provinceToFaction && typeof G._provinceToFaction === 'object') ? G._provinceToFaction : null;
    var myName = fac && fac.name;
    var pruned = { claims: 0, threats: 0, alliances: 0 };
    if (Array.isArray(s.claims) && p2f && myName) {
      s.claims = s.claims.filter(function(c){ var n = String(c || '').trim(); if (n && p2f[n] === myName) { pruned.claims++; return false; } return true; });
    }
    var allySet = {};
    _arr(s.alliances).forEach(function(a){ allySet[String(a)] = true; });
    if (Array.isArray(s.threats)) {
      s.threats = s.threats.filter(function(t){ var n = String(t || '').trim(); if (n && (!facNames[n] || allySet[n])) { pruned.threats++; return false; } return true; });
    }
    if (Array.isArray(s.alliances)) {
      s.alliances = s.alliances.filter(function(a){ var n = String(a || '').trim(); if (n && !facNames[n]) { pruned.alliances++; return false; } return true; });
    }
    try { if (global.TM && global.TM.FactionGoalStack && typeof global.TM.FactionGoalStack.pruneGoals === 'function') global.TM.FactionGoalStack.pruneGoals(fac, turn); } catch (_) {}
    return pruned;
  }
  function ensureStrategyV2(fac, decision, actions) {
    var s = ensureStrategy(fac, decision, actions);
    if (!s) return s;
    var turn = _turn();
    s.version = Math.max(_safeNum(s.version), 2);
    if (!Array.isArray(s.objectives)) s.objectives = [];
    if (!Array.isArray(s.threats)) s.threats = [];
    if (!Array.isArray(s.claims)) s.claims = [];
    if (!Array.isArray(s.alliances)) s.alliances = [];
    if (!Array.isArray(s.covertTargets)) s.covertTargets = [];
    if (!Array.isArray(s.economicPlans)) s.economicPlans = [];
    if (!Array.isArray(s.governanceFocus)) s.governanceFocus = [];
    if (!Array.isArray(s.treaties)) s.treaties = [];
    if (!Array.isArray(s.militaryPlans)) s.militaryPlans = [];
    if (!s.cooldowns || typeof s.cooldowns !== 'object') s.cooldowns = {};
    _arr(actions).forEach(function(a) {
      var p = a.payload || {};
      var label = a.type + (p.targetFaction ? ':' + p.targetFaction : p.province ? ':' + p.province : p.army ? ':' + p.army : '');
      if (label && s.objectives.indexOf(label) < 0) s.objectives.push(label);
      s.cooldowns[a.type] = turn;
      if ((a.type === 'diplomacy' && _safeNum(p.relationDelta) < 0) || a.type === 'spy_or_intrigue') {
        var hostile = p.targetFaction || p.toFaction || p.target || '';
        if (hostile && s.threats.indexOf(hostile) < 0) s.threats.push(hostile);
      }
      if (a.type === 'diplomacy' && _safeNum(p.relationDelta) > 0) {
        var ally = p.targetFaction || p.toFaction || p.target || '';
        if (ally && s.alliances.indexOf(ally) < 0) s.alliances.push(ally);
      }
      if (a.type === 'province_policy') {
        var claim = p.province || p.region || p.division || '';
        if (claim && s.claims.indexOf(claim) < 0) s.claims.push(claim);
        if (claim && s.governanceFocus.indexOf(claim) < 0) s.governanceFocus.push(claim);
      }
      if (a.type === 'fiscal_policy') {
        var econ = (p.policyName || p.policy || p.reason || p.resource || 'fiscal_policy') + ':' + (_safeNum(p.incomeDelta || p.longTermIncomeDelta) || 0) + '/' + (_safeNum(p.expenseDelta || p.longTermExpenseDelta) || 0);
        if (s.economicPlans.indexOf(econ) < 0) s.economicPlans.push(econ);
      }
      if (a.type === 'diplomacy' && (p.treaty || p.treatyName || p.agreement)) {
        var treaty = (p.targetFaction || p.toFaction || p.target || '') + ':' + (p.treaty || p.treatyName || p.agreement);
        if (treaty && s.treaties.indexOf(treaty) < 0) s.treaties.push(treaty);
      }
      if (a.type === 'military_order') {
        var mil = (p.army || p.armyName || p.name || '') + ':' + (p.order || p.kind || 'military_order');
        if (mil && s.militaryPlans.indexOf(mil) < 0) s.militaryPlans.push(mil);
      }
      if (a.type === 'rebellion_policy' || a.type === 'spy_or_intrigue') {
        var covert = p.targetFaction || p.toFaction || p.targetFac || '';
        if (covert && s.covertTargets.indexOf(covert) < 0) s.covertTargets.push(covert);
      }
    });
    if (s.objectives.length > 16) s.objectives = s.objectives.slice(-16);
    if (s.threats.length > 16) s.threats = s.threats.slice(-16);
    if (s.claims.length > 16) s.claims = s.claims.slice(-16);
    if (s.alliances.length > 16) s.alliances = s.alliances.slice(-16);
    if (s.covertTargets.length > 16) s.covertTargets = s.covertTargets.slice(-16);
    if (s.economicPlans.length > 16) s.economicPlans = s.economicPlans.slice(-16);
    if (s.governanceFocus.length > 16) s.governanceFocus = s.governanceFocus.slice(-16);
    if (s.treaties.length > 16) s.treaties = s.treaties.slice(-16);
    if (s.militaryPlans.length > 16) s.militaryPlans = s.militaryPlans.slice(-16);
    s.lastDecision = {
      turn: turn,
      rationale: decision && decision.rationale ? String(decision.rationale).slice(0, 180) : '',
      actionTypes: _arr(actions).map(function(a){ return a.type; }).slice(0, 12)
    };
    s.lastUpdatedTurn = turn;
    if (_livingWorldOn()) { try { _pruneStrategyLifecycle(fac, s, turn); } catch (_) {} }   // F2·Slice2·目标生命周期修剪(仅总闸 ON)
    return s;
  }

  function _actionDedupeKey(action) {
    var p = action && action.payload || {};
    if (!action || !action.type) return '';
    if (action.type === 'memorial') return action.type + ':' + (p.from || p.char || p.name || '') + ':' + (p.type || p.category || '');
    if (action.type === 'edict') return action.type + ':' + (p.type || p.category || '') + ':' + (p.trigger || p.reason || '');
    if (action.type === 'court_alignment') return action.type + ':' + (p.type || p.mode || '') + ':' + Object.keys(p.loyaltyDeltaByParty || p.parties || {}).sort().join('|');
    if (action.type === 'office_change') return action.type + ':' + (p.target || p.char || p.name || '') + ':' + (p.newPosition || p.position || p.post || p.title || '');
    if (action.type === 'fiscal_policy') return action.type + ':' + (p.resource || p.kind || 'money') + ':' + (p.treasuryDelta != null ? p.treasuryDelta : p.delta != null ? p.delta : p.amount);
    if (action.type === 'military_order') return action.type + ':' + (p.army || p.armyName || p.name || '') + ':' + (p.commander || p.commanderName || p.general || p.destination || p.location || '');
    if (action.type === 'diplomacy') return action.type + ':' + (p.targetFaction || p.toFaction || p.target || '') + ':' + (p.relationDelta != null ? p.relationDelta : p.value);
    if (action.type === 'province_policy') return action.type + ':' + (p.province || p.region || p.division || '') + ':' + (p.ownerFaction || p.newOwner || p.targetFaction || '');
    if (action.type === 'spy_or_intrigue' || action.type === 'rebellion_policy') return action.type + ':' + (p.targetFaction || p.toFaction || p.targetFac || '') + ':' + (p.policy || p.intrigue || '');
    return '';
  }

  function _detailDedupeKey(type, detail) {
    detail = detail || {};
    if (type === 'memorial') return type + ':' + (detail.from || detail.char || detail.name || '') + ':' + (detail.type || detail.category || '');
    if (type === 'edict') return type + ':' + (detail.type || detail.category || '') + ':' + (detail.trigger || detail.reason || '');
    if (type === 'court_alignment') return type + ':' + (detail.type || detail.mode || '') + ':' + Object.keys(detail.loyaltyDeltaByParty || detail.parties || {}).sort().join('|');
    if (type === 'office_change') {
      var eff = detail.effect || {};
      return type + ':' + (detail.target || '') + ':' + (eff.positionTo || detail.newPosition || '');
    }
    if (type === 'fiscal_policy') return type + ':' + (detail.resource || 'money') + ':' + (detail.delta != null ? detail.delta : detail.amount);
    if (type === 'military_order') return type + ':' + (detail.army || detail.name || '') + ':' + (detail.commanderTo || detail.destination || '');
    if (type === 'diplomacy') return type + ':' + (detail.to || detail.targetFaction || '') + ':' + (detail.relationTo != null ? detail.relationTo : detail.relationDelta);
    if (type === 'province_policy') return type + ':' + (detail.province || '') + ':' + (detail.ownerTo || detail.ownerFaction || '');
    if (type === 'spy_or_intrigue' || type === 'rebellion_policy') return type + ':' + (detail.targetFaction || '') + ':' + (detail.policy || detail.intrigue || '');
    return '';
  }

  // F2·2026-05-22·SC16 采纳审计·比对 fac._sc16Directive 跟 decision.actions[] 的重叠度
  function _normName(v) { return String(v == null ? '' : v).replace(/\s+/g, '').trim().toLowerCase(); }
  function _auditSc16Compliance(fac, actions, turn) {
    var directive = (fac && fac._sc16Directive) || null;
    if (!directive) return null;
    var dActions = _arr(directive.actions);
    var dDiplomacy = _arr(directive.diplomacy);
    var dDirectives = _arr(directive.directives);
    var totalDirectiveItems = dActions.length + dDiplomacy.length + dDirectives.length;
    if (!totalDirectiveItems) return null;
    // 把 decision.actions[] 索引化·分别按 targetFaction / province / target / army 建集合
    var appliedActionList = _arr(actions).filter(function(a){ return a && a.payload; });
    var byTargetFac = {}, byProvince = {}, byTargetChar = {}, byArmy = {}, byDiplomacyTo = {}, byActionType = {};
    appliedActionList.forEach(function(a) {
      var p = a.payload || {};
      var tFac = _normName(p.targetFaction || p.toFaction || p.target || p.newOwner || p.ownerFaction);
      var prov = _normName(p.province || p.region || p.division);
      var tChar = _normName(p.target || p.from || p.char);
      var army = _normName(p.army || p.armyName);
      if (tFac) byTargetFac[tFac] = (byTargetFac[tFac] || 0) + 1;
      if (prov) byProvince[prov] = (byProvince[prov] || 0) + 1;
      if (tChar) byTargetChar[tChar] = (byTargetChar[tChar] || 0) + 1;
      if (army) byArmy[army] = (byArmy[army] || 0) + 1;
      byActionType[a.type] = (byActionType[a.type] || 0) + 1;
      if (a.type === 'diplomacy' && tFac) byDiplomacyTo[tFac] = (byDiplomacyTo[tFac] || 0) + 1;
    });
    var rationaleText = (fac && fac._lastLlmRationale && fac._lastLlmRationale.text) ? String(fac._lastLlmRationale.text).toLowerCase() : '';

    var adopted = 0;
    var ignoredItems = [];
    // directive.actions[]·目标 = target/targetFaction/province，匹配 decision 里同 target 的任意 action
    dActions.forEach(function(da) {
      var target = _normName(da.target || da.targetFaction || da.toFaction);
      var province = _normName(da.province || da.region);
      var matched = (target && (byTargetFac[target] || byTargetChar[target])) || (province && byProvince[province]);
      if (matched) adopted++;
      else ignoredItems.push({ type:'action', summary:_txtPreview(da.action || da.intent || da.reason || da, 80), target:da.target || da.targetFaction || da.province || '' });
    });
    // directive.diplomacy[]·匹配 decision 中 diplomacy action 的 to
    dDiplomacy.forEach(function(dd) {
      var to = _normName(dd.to || dd.toFaction || dd.targetFaction);
      var matched = to && byDiplomacyTo[to];
      if (matched) adopted++;
      else ignoredItems.push({ type:'diplomacy', summary:(dd.from || '?') + '→' + (dd.to || '?') + ' ' + (dd.new_relation || dd.type || ''), target:dd.to || '' });
    });
    // directive.directives[]·strategic intent·软匹配·rationale 含关键词 OR 任意 action type 匹配 preferred_actions
    dDirectives.forEach(function(dd) {
      var pref = _arr(dd.preferred_actions || dd.preferredActions);
      var intent = String(dd.strategic_intent || dd.must_follow || dd.reason || '').toLowerCase();
      var matched = false;
      pref.forEach(function(p) {
        var k = _normName(p);
        if (k && byActionType[k]) matched = true;
      });
      if (!matched && intent) {
        ['diplomacy','military','fiscal','memorial','edict','office'].forEach(function(token) {
          if (intent.indexOf(token) >= 0 && byActionType[token + (token === 'fiscal' ? '_policy' : (token === 'office' ? '_change' : (token === 'military' ? '_order' : '')))]) matched = true;
        });
        if (rationaleText && intent.split(/[，。·、 ]+/).some(function(w){ return w.length >= 3 && rationaleText.indexOf(w) >= 0; })) matched = true;
      }
      if (matched) adopted++;
      else ignoredItems.push({ type:'directive', summary:_txtPreview(intent || JSON.stringify(dd), 80), target:'' });
    });

    var complianceScore = totalDirectiveItems > 0 ? Math.round(100 * adopted / totalDirectiveItems) : 0;
    var result = {
      turn: turn,
      directiveCount: totalDirectiveItems,
      directiveActions: dActions.length,
      directiveDiplomacy: dDiplomacy.length,
      directiveDirectives: dDirectives.length,
      adoptedCount: adopted,
      ignoredItems: ignoredItems.slice(0, 8),
      complianceScore: complianceScore,
      hasDirectContent: !!directive.hasDirectContent,
      priorityScore: directive.priorityScore || 0,
      priorityRank: directive.priorityRank || 0,
      directiveHash: directive.directiveHash || ''  // F2 Sub 3·让 cooldown 跨回合查"已执行"
    };
    if (!Array.isArray(fac._sc16ComplianceHistory)) fac._sc16ComplianceHistory = [];
    fac._sc16ComplianceHistory.push(result);
    if (fac._sc16ComplianceHistory.length > 8) fac._sc16ComplianceHistory = fac._sc16ComplianceHistory.slice(-8);
    return result;
  }
  // G3-C·2026-05-22·决策风格 rolling memory·从当回合 actions 算 4 metric·写入 fac.aiStyleTrajectory 滑窗 5
  function _updateStyleTrajectory(fac, actions, turn) {
    if (!fac || !Array.isArray(actions) || !actions.length) return null;
    var total = actions.length;
    // 1·aggressiveness·军事 + 敌意外交 + 间谍 + 叛乱 占比 0-100
    var aggressive = actions.filter(function(a){
      if (a.type === 'military_order' || a.type === 'spy_or_intrigue' || a.type === 'rebellion_policy') return true;
      if (a.type === 'diplomacy') {
        var p = a.payload || {};
        return _safeNum(p.relationDelta) < -10;
      }
      return false;
    }).length;
    var aggressiveness = Math.round(aggressive / total * 100);
    // 2·riskTaking·大 treasuryDelta abs + 违约 (relationDelta < -50) + spy
    var risk = 0;
    actions.forEach(function(a) {
      var p = a.payload || {};
      var td = Math.abs(_safeNum(p.treasuryDelta));
      if (td >= 100000) risk += 2;
      else if (td >= 30000) risk += 1;
      if (a.type === 'diplomacy' && _safeNum(p.relationDelta) <= -50) risk += 2;
      if (a.type === 'spy_or_intrigue') risk += 1;
      if (a.type === 'rebellion_policy') risk += 2;
    });
    var riskTaking = Math.min(100, Math.round(risk / total * 50));
    // 3·fiscalDiscipline·正向·减俸 / 紧缩 类·负向·赏赐 / 加禄 类
    var disciplineScore = 0;
    actions.forEach(function(a) {
      var p = a.payload || {};
      if (a.type === 'edict') {
        var et = String(p.type || '');
        if (et === '减俸' || et === '催征' || et === '罢党争') disciplineScore += 1;
        if (et === '赏赐' || et === '怀柔') disciplineScore -= 1;
      }
      if (a.type === 'fiscal_policy') {
        if (_safeNum(p.expenseDelta) < 0) disciplineScore += 1;
        if (_safeNum(p.treasuryDelta) < -50000) disciplineScore -= 1;
      }
    });
    var fiscalDiscipline = 50 + Math.round(disciplineScore * 100 / Math.max(1, total));
    fiscalDiscipline = Math.max(0, Math.min(100, fiscalDiscipline));
    // 4·expansionism·province / military 攻势 / 外扩外交占比
    var expansion = actions.filter(function(a) {
      if (a.type === 'province_policy') {
        var p = a.payload || {};
        return String(p.policy || '').indexOf('transfer') >= 0 || _safeNum(p.unrestDelta) < 0;
      }
      if (a.type === 'military_order') {
        var p = a.payload || {};
        return String(p.order || '') === 'move' || String(p.order || '') === 'reinforce';
      }
      return false;
    }).length;
    var expansionism = Math.round(expansion / total * 100);

    var row = {
      turn: turn,
      aggressiveness: aggressiveness,
      riskTaking: riskTaking,
      fiscalDiscipline: fiscalDiscipline,
      expansionism: expansionism,
      actionCount: total
    };
    if (!Array.isArray(fac.aiStyleTrajectory)) fac.aiStyleTrajectory = [];
    // 同 turn 覆盖·不同 turn 追加
    var existing = fac.aiStyleTrajectory.findIndex(function(r){ return r && r.turn === turn; });
    if (existing >= 0) fac.aiStyleTrajectory[existing] = row;
    else fac.aiStyleTrajectory.push(row);
    if (fac.aiStyleTrajectory.length > 5) fac.aiStyleTrajectory = fac.aiStyleTrajectory.slice(-5);
    return row;
  }

  function _txtPreview(v, max) {
    var s = '';
    if (v == null) s = '';
    else if (typeof v === 'string') s = v;
    else if (typeof v === 'object') s = JSON.stringify(v);
    else s = String(v);
    s = s.replace(/\s+/g, ' ').trim();
    if (max && s.length > max) return s.slice(0, max) + '...';
    return s;
  }

  function _hasLocalDuplicate(fac, action) {
    var key = _actionDedupeKey(action);
    if (!key) return false;
    return _arr(fac && fac._npcLlmActionLedger).some(function(row) {
      return row && row.turn === action.turn && row.type === action.type && row.status === 'applied'
        && row.source === 'local' && _detailDedupeKey(row.type, row.detail) === key;
    });
  }

  // 【F2·Slice3】重大势力决策(宣战/参战/背刺/结盟/大军调动)→ 世界事件入御案时政(玩家下回合可见须应对)。
  //   防洪：全局 cap 3/回合·每势力 cap 1/回合·同 id 去重·只发本势力最重的一条。走 currentIssues 既有 shape(phase8-formal-bridge 读)。
  var _FLW_EVENT_RANK = { declare_war: 5, join_war: 4, betrayal: 3, alliance: 2, troop_move: 1 };
  function _flwAllianceWord(rel, treaty) {
    var z = String(rel || '') + '|' + String(treaty || '');
    if (/互不侵犯|nonaggr|中立|互不|不侵/i.test(z)) return '议互不侵犯';
    if (/互市|通商|trade|deal|贸易|商约/i.test(z)) return '通商互市';
    if (/媾和|议和|peace|和约/i.test(z)) return '媾和';
    return '结盟';
  }
  // B7·过期清理(每回合必经·无新事件也跑)·直接删(与 phase8 消费面对齐·不留半死条)·只碰本系统 _flw
  function _expireWorldEvents(G, turn) {
    if (!G || !Array.isArray(G.currentIssues)) return;
    G.currentIssues = G.currentIssues.filter(function(x){ return !(x && x._flw && x.status === 'pending' && (turn - _safeNum(x.raisedTurn) > 2)); });   // arch-ok: F2 世界事件跨回合过期(只剔本系统 _flw)
    var _activeFlw = G.currentIssues.filter(function(x){ return x && x._flw && x.status === 'pending'; });
    if (_activeFlw.length > 5) {   // 全局活跃上限 5·超则删最老
      _activeFlw.sort(function(a, b){ return _safeNum(a.raisedTurn) - _safeNum(b.raisedTurn); });
      var _drop = {};
      _activeFlw.slice(0, _activeFlw.length - 5).forEach(function(x){ _drop[x.id] = true; });
      G.currentIssues = G.currentIssues.filter(function(x){ return !(x && _drop[x.id]); });   // arch-ok: F2 世界事件全局活跃上限(只剔本系统 _flw)
    }
  }
  function _emitWorldEvents(fac, events, turn) {
    events = _arr(events); if (!events.length || !fac || !fac.name) return 0;
    var G = global.GM || {};
    if (!Array.isArray(G.currentIssues)) G.currentIssues = [];   // arch-ok: F2 世界事件入御案时政(currentIssues 既有子树)
    _expireWorldEvents(G, turn);
    var mineTurn = G.currentIssues.filter(function(x){ return x && x._flw && _safeNum(x.raisedTurn) === turn; });
    if (mineTurn.length >= 3) return 0;
    if (mineTurn.some(function(x){ return x._flwActor === fac.name; })) return 0;
    var ev = events.slice().sort(function(a, b){ return (_FLW_EVENT_RANK[b && b.kind] || 0) - (_FLW_EVENT_RANK[a && a.kind] || 0); })[0];
    if (!ev || !ev.kind) return 0;
    var actor = fac.name, target = String(ev.target || '');
    var id = 'iss_flw_' + turn + '_' + _slugId(ev.kind) + '_' + _slugId(actor) + '_' + _slugId(target);
    if (G.currentIssues.some(function(x){ return x && x.id === id; })) return 0;
    var CN = {
      declare_war: { t: actor + ' 向 ' + target + ' 宣战', d: actor + '以「' + (ev.cb || '边衅') + '」为名对 ' + target + ' 兴兵。列国相攻·牵动天下·陛下当早为之备。', sev: '紧要' },
      join_war:    { t: actor + ' 参战攻 ' + target, d: actor + ' 加入对 ' + target + ' 之战事·战端愈广。', sev: '紧要' },
      betrayal:    { t: actor + ' 与 ' + target + ' 交恶', d: actor + ' 与 ' + target + ' 邦交骤裂·恐启衅端。', sev: '要事' },
      alliance:    { t: actor + ' 与 ' + target + ' ' + _flwAllianceWord(ev.rel, ev.treaty), d: actor + ' 与 ' + target + ' ' + _flwAllianceWord(ev.rel, ev.treaty) + '·邦交生变·陛下宜察其向背。', sev: '要事' },
      troop_move:  { t: actor + ' 大军调动', d: actor + ' 大举调兵' + (target ? '·指向 ' + target : '') + '·边情叵测。', sev: '要事' }
    }[ev.kind] || { t: actor + ' 有重大动向', d: actor + ' 近有异动。', sev: '要事' };
    var issue = {
      id: id, title: CN.t, description: CN.d, category: '外交军务', severity: CN.sev,
      status: 'pending', raisedTurn: turn,
      raisedDate: (typeof global.getTSText === 'function' ? global.getTSText(turn) : (G._gameDate || '')),
      linkedFactions: [actor, target].filter(Boolean), proposer: '边报', dept: '兵部',
      _info: true, _flw: true, _flwActor: actor, _flwKind: ev.kind
    };
    G.currentIssues.push(issue);   // arch-ok: F2 势力活世界·重大势力决策入御案时政(currentIssues 既有子树·经裁定·非写主入口)
    return 1;
  }
  function applyDecision(fac, decision, opts) {
    opts = opts || {};
    var d = validateDecision(decision);
    var turn = _safeNum(opts.turn) || _turn();
    var actions = normalizeDecisionActions(fac, d, { turn:turn, decisionId: opts.decisionId });
    var alive = _aliveFor(fac);
    var ruler = _rulerOf(alive);
    var ctx = { alive:alive, ruler:ruler };
    var summary = { memorials:0, edicts:0, chaoyi:0, office:0, actions:0, attemptedActions: actions.length, skippedActions:0, mergedActions:0, skippedDetails:[], mergedDetails:[] };
    // F1·2026-05-22·in-batch 去重·防 LLM 同一 decision 重复 emit (legacy+native 双填或纯 native 双填)
    var seenBatchKeys = {};
    var _worldEvents = [];   // F2·Slice3·收集重大决策世界事件(仅总闸 ON 时消费)
    actions.forEach(function(action) {
      var preflight = validateActionTarget(fac, action, ctx);
      if (!preflight || !preflight.ok) {
        var preflightDetail = { stage:'preflight', reason:(preflight && preflight.reason) || 'invalid action target', detail:preflight || null };
        summary.skippedActions++;
        summary.skippedDetails.push({ actionId: action.actionId, type: action.type, reason: preflightDetail.reason, target: preflight && (preflight.target || preflight.army || preflight.province || preflight.resource) });
        _recordAction(fac, action, 'skipped', preflightDetail);
        return;
      }
      var batchKey = _actionDedupeKey(action);
      if (batchKey && seenBatchKeys[batchKey]) {
        var batchMergeDetail = { reason:'duplicate in batch', key:batchKey, firstSource:seenBatchKeys[batchKey].source, dupSource:action.source };
        summary.mergedActions++;
        summary.mergedDetails.push({ actionId: action.actionId, type: action.type, reason: batchMergeDetail.reason, key: batchKey, firstSource:batchMergeDetail.firstSource, dupSource:batchMergeDetail.dupSource });
        _recordAction(fac, action, 'merged', batchMergeDetail);
        return;
      }
      if (_hasLocalDuplicate(fac, action)) {
        var mergeDetail = { reason:'duplicate local action', key:_actionDedupeKey(action) };
        summary.mergedActions++;
        summary.mergedDetails.push({ actionId: action.actionId, type: action.type, reason: mergeDetail.reason, key: mergeDetail.key });
        _recordAction(fac, action, 'merged', mergeDetail);
        return;
      }
      var applier = APPLIERS[action.type];
      var res = applier ? applier(fac, action, ctx) : { ok:false, reason:'no applier' };
      if (res && res.ok) {
        var key = res.summaryKey || action.type;
        summary[key] = (summary[key] || 0) + 1;
        summary.actions++;
        if (_livingWorldOn() && res && res.worldEvent) _worldEvents.push(res.worldEvent);
        if (batchKey) seenBatchKeys[batchKey] = { source: action.source, actionId: action.actionId };
        _recordAction(fac, action, 'applied', res.detail || null);
      } else {
        var failReason = (res && res.reason) || 'apply failed';
        summary.skippedActions++;
        summary.skippedDetails.push({ actionId: action.actionId, type: action.type, reason: failReason });
        _recordAction(fac, action, 'skipped', { reason:failReason });
      }
    });
    if (_livingWorldOn()) { try { _expireWorldEvents(global.GM || {}, turn); if (_worldEvents.length) _emitWorldEvents(fac, _worldEvents, turn); } catch (_) {} }   // F2·Slice3·后果事件化(过期清理每回合必经·再判新事件)
    if (d && d.rationale) fac._lastLlmRationale = { turn:turn, text:d.rationale };
    ensureStrategyV2(fac, d, actions);
    // G3-C·2026-05-22·决策风格 rolling memory·写在 strategy 后·只算 applied actions·skipped 不入
    try { _updateStyleTrajectory(fac, actions.filter(function(a){ return a && a.type; }), turn); } catch(_){}
    // F2 Sub 1·2026-05-22·SC16 采纳审计·跑在 strategy 之后·summary 之前·结果挂在 summary 上
    var compliance = null;
    try { compliance = _auditSc16Compliance(fac, actions, turn); } catch(_){}
    try {
      fac._lastLlmApplySummary = {
        turn: turn,
        decisionId: actions[0] && actions[0].decisionId || '',
        attemptedActions: summary.attemptedActions,
        appliedActions: summary.actions,
        skippedActions: summary.skippedActions,
        mergedActions: summary.mergedActions,
        skippedDetails: summary.skippedDetails.slice(-8),
        mergedDetails: summary.mergedDetails.slice(-8),
        sc16Compliance: compliance,
        updatedAt: Date.now()
      };
    } catch(_){}
    if (compliance) summary.sc16Compliance = compliance;
    return summary;
  }

  function getSc16Compliance(facName) {
    var G = global.GM || {};
    var fac = (Array.isArray(G.facs) && facName) ? G.facs.find(function(x){ return x && x.name === facName; }) : null;
    if (!fac) return null;
    return {
      faction: facName,
      last: (fac._lastLlmApplySummary && fac._lastLlmApplySummary.sc16Compliance) || null,
      history: _arr(fac._sc16ComplianceHistory).slice()
    };
  }

  function _latestRunTurn(fac) {
    var rows = _arr(fac && fac._npcLlmActionLedger);
    var last = 0;
    rows.forEach(function(r){ if (r && r.turn > last) last = r.turn; });
    return last;
  }

  function _relationPressureFor(fac, playerFactionNames) {
    var G = global.GM || {};
    var score = 0;
    var reasons = [];
    _arr(G.factionRelations).forEach(function(r) {
      if (!fac || !r || (r.from !== fac.name && r.to !== fac.name)) return;
      var other = r.from === fac.name ? r.to : r.from;
      var value = r.value != null ? _safeNum(r.value) : 0;
      if (value <= -50) { score += Math.min(35, Math.abs(value) * 0.25); reasons.push('relation'); }
      if (_arr(playerFactionNames).indexOf(other) >= 0) {
        score += value <= -30 ? 28 : 12;
        reasons.push(value <= -30 ? 'player-relation' : 'player-border');
      }
    });
    return { score:score, reasons:reasons };
  }

  function _ledgerFailurePressure(fac, turn) {
    var rows = _arr(fac && fac._npcLlmActionLedger).filter(function(r){ return r && turn - _safeNum(r.turn) <= 3; });
    var failed = rows.filter(function(r){ return r.status === 'skipped' || r.status === 'failed'; }).length;
    var applied = rows.filter(function(r){ return r.status === 'applied'; }).length;
    if (!failed) return 0;
    return Math.min(18, failed * 4 + (applied ? 0 : 6));
  }

  function _mentionsFac(v, fac) {
    var name = String(fac && fac.name || '').trim();
    if (!name) return false;
    var txt = '';
    try { txt = (typeof v === 'string') ? v : JSON.stringify(v); } catch(_) { txt = String(v || ''); }
    return txt.indexOf(name) >= 0;
  }

  function _sc16DirectiveFor(fac) {
    var G = global.GM || {};
    return (G._sc16FactionDirectives && G._sc16FactionDirectives.byFaction && fac && G._sc16FactionDirectives.byFaction[fac.name])
      || (fac && fac._sc16Directive)
      || null;
  }

  function scoreFactionCandidate(fac, opts) {
    opts = opts || {};
    var G = global.GM || {};
    var turn = _safeNum(opts.turn) || _turn();
    var score = Math.max(1, _safeNum(fac && fac.derivedStrength && fac.derivedStrength.value) * 0.35);
    var reasons = [];
    var dh = (fac && fac.derivedHealth) || {};
    var de = (fac && fac.derivedEconomy) || {};
    var health = dh.overall != null ? _safeNum(dh.overall) : 60;
    if (health < 70) { var crisis = (70 - health) * 1.5; score += crisis; reasons.push('crisis+' + Math.round(crisis)); }
    if (fac && fac._fiscalCrisis) { score += 35; reasons.push('fiscal'); }
    if (de.fiscalStress) { score += Math.min(45, _safeNum(de.fiscalStress) * 0.7); reasons.push('stress'); }
    var inWar = _arr(G.activeWars).some(function(w) {
      var sides = _arr(w && w.sides).concat(_arr(w && w.factions)).concat([w && w.attacker, w && w.defender].filter(Boolean));
      return fac && sides.indexOf(fac.name) >= 0;
    });
    if (inWar) { score += 45; reasons.push('war'); }
    var intervened = _arr(G._npcInterventions).some(function(x){ return x && fac && x.targetFac === fac.name && turn - _safeNum(x.turn) <= 3; });
    if (intervened) { score += 35; reasons.push('intervention'); }
    var rel = _relationPressureFor(fac, opts.playerFactionNames || []);
    if (rel.score) { score += rel.score; reasons = reasons.concat(rel.reasons); }
    var intrigue = _safeNum(fac && fac._intriguePressure);
    if (intrigue) { score += Math.min(28, intrigue * 4); reasons.push('intrigue'); }
    var rebellion = _safeNum(fac && fac._rebellionPressure);
    if (rebellion) { score += Math.min(35, rebellion * 5); reasons.push('rebellion'); }
    var tre = fac && fac.treasury;
    if (tre && _safeNum(tre.money) <= 0) { score += 25; reasons.push('empty-treasury'); }
    if (fac && fac.aiProfile && fac.aiProfile.strategicPriority) {
      score += Math.min(30, _safeNum(fac.aiProfile.strategicPriority));
      reasons.push('profile-priority');
    }
    var storyPriority = _safeNum(fac && (fac.narrativePriority || fac.plotPriority || fac.storyPriority));
    if (storyPriority) {
      score += Math.min(35, storyPriority);
      reasons.push('story');
    }
    var directive = _sc16DirectiveFor(fac);
    if (directive && directive.hasDirectContent) {
      score += 42;
      reasons.push('sc16-directive');
    } else if (directive) {
      score += 14;
      reasons.push('sc16-context');
    }
    var sc16Priority = directive ? _safeNum(directive.priorityScore || directive.priority || (directive.raw && directive.raw.priority)) : 0;
    if (sc16Priority > 0) {
      score += Math.min(70, sc16Priority * 0.75);
      reasons.push('sc16-priority');
    }
    var sc16Rank = directive ? _safeNum(directive.priorityRank) : 0;
    if (sc16Rank > 0 && sc16Rank <= 5) {
      score += Math.max(4, 16 - sc16Rank * 2);
      reasons.push('sc16-rank');
    }
    var hotspot = 0;
    _arr(G.currentIssues).slice(-12).forEach(function(i){ if (_mentionsFac(i, fac)) hotspot += 8; });
    _arr(G.factionEvents).slice(-12).forEach(function(e){ if (_mentionsFac(e, fac)) hotspot += 8; });
    _arr(G._factionUndercurrents).slice(-12).forEach(function(e){ if (_mentionsFac(e, fac)) hotspot += 10; });
    _arr(G.qijuHistory).slice(0, 30).forEach(function(q){ if (_mentionsFac(q, fac)) hotspot += 3; });
    if (hotspot) {
      score += Math.min(40, hotspot);
      reasons.push('hotspot');
    }
    var failPressure = _ledgerFailurePressure(fac, turn);
    if (failPressure) { score += failPressure; reasons.push('retry-pressure'); }
    if (_arr(fac && fac.npcProvincePolicies).some(function(p){ return p && turn - _safeNum(p.turn) <= 2 && p.ownerFrom === fac.name && p.ownerTo !== fac.name; })) {
      score += 25; reasons.push('recent-loss');
    }
    var last = _latestRunTurn(fac);
    if (!last) { score += 24; reasons.push('fresh'); }
    else if (turn > last) {
      var stale = Math.min(50, (turn - last) * 6);
      score += stale;
      reasons.push(stale >= 30 ? 'long-idle' : 'stale');
    }
    return { fac:fac, score:score, reasons:reasons };
  }

  function rankFactionCandidates(factions, opts) {
    return _arr(factions).map(function(f){ return scoreFactionCandidate(f, opts); }).sort(function(a, b){ return b.score - a.score; });
  }

  global.TM = global.TM || {};
  global.TM.FactionActionEngine = {
    TYPES: TYPES,
    validateDecision: validateDecision,
    normalizeDecisionActions: normalizeDecisionActions,
    applyDecision: applyDecision,
    dryRunDecision: dryRunDecision,
    validateActionTarget: validateActionTarget,
    recordLocalAction: recordLocalAction,
    getActionContract: getActionContract,
    formatActionContractForPrompt: formatActionContractForPrompt,
    ensureStrategy: ensureStrategyV2,
    scoreFactionCandidate: scoreFactionCandidate,
    rankFactionCandidates: rankFactionCandidates,
    getSc16Compliance: getSc16Compliance,
    livingWorldOn: _livingWorldOn,
    setFactionLivingWorld: setFactionLivingWorld,
    _applyDeclareWar: _applyDeclareWar,
    _applyJoinWar: _applyJoinWar,
    _pruneStrategyLifecycle: _pruneStrategyLifecycle,
    _emitWorldEvents: _emitWorldEvents,
    _expireWorldEvents: _expireWorldEvents
  };
  if (typeof global !== 'undefined') { try { global._tmSetFactionLivingWorld = setFactionLivingWorld; } catch (e) {} }

  if (typeof module !== 'undefined' && module.exports) module.exports = global.TM.FactionActionEngine;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));

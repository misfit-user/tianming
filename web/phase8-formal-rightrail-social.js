// @ts-check
// ═══════════════════════════════════════════════════════════════════════
//  phase8-formal-rightrail-social.js — 御案右 rail「社会层/阶层党派观测」分片
//  （巨石拆分第二十四拆·20260706·自 phase8-formal-rightrail.js 行 1359-3113 迁出·体内 0 改字节）
//  内容：社会层势位/趋势/近账/关系边/生态信号 + 政策链可观测(Party/Class Observability·rightPc*) +
//        阶层/党派面板(renderRightClassPanel/renderRightPartyPanel/renderGangRich/renderPartyClassDebug)。
//
//  【装载序·硬约束】须在 phase8-formal-rightrail.js（origin）【之后】装载（index.html 中紧随其后）：
//    origin 装载期已向 bucket TM.__p8RailParts 导出本片闭包捕获的 origin 成员(下方 reverse 捕获行)，
//    本片再把社会层/阶层党派函数回填 bucket 供 origin 委托 shim 于调用期解析。
//    错序=捕获到 undefined→立崩。装载序契约见 scripts/lint-split-contracts.js。
//    §1 别名块自 window.TMPhase8FormalBridge 再派生(纯读 bridge._xxx·与 origin 同引用)。
// ═══════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  var bridge = window.TMPhase8FormalBridge;
  if (!bridge) {
    console.error('[phase8-formal-rightrail-social] TMPhase8FormalBridge not init·bridge.js 必须先 load');
    return;
  }
  var __p8R = (function(){ var t = window.TM = window.TM || {}; return t.__p8RailParts = t.__p8RailParts || {}; })();
  // ── §1 别名再派生(与 origin 15-73 同源·纯读 bridge._xxx·同引用) ──
  var state = bridge._state || window.TM_PHASE8_FORMAL;

  // ── alias 块 (cross-closure helpers from bridge._xxx) ──────────────
  var esc = bridge._esc;
  var attr = bridge._attr;
  var asset = bridge._asset;
  var fmtNum = bridge._fmtNum;
  var miniRows = bridge._miniRows;
  var actionButton = bridge._actionButton;
  var moduleShell = bridge._moduleShell;
  var dossierRows = bridge._dossierRows;
  var ownerKey = bridge._ownerKey;
  var ownerName = bridge._ownerName;
  var findFaction = bridge._findFaction;
  var findPerson = bridge._findPerson;
  var personKey = bridge._personKey;
  var getPeople = bridge._getPeople;
  var getMapData = bridge._getMapData;
  var getParties = bridge._getParties;
  var getClasses = bridge._getClasses;
  var collectRecentEvents = bridge._collectRecentEvents;
  var getTurnText = bridge._getTurnText;
  var firstArray = bridge._firstArray;
  var actionBtn = bridge._actionBtn;
  var actionChip = bridge._actionChip;
  var renderActionStats = bridge._renderActionStats;
  var compactText = bridge._compactText;
  var getMemorials = bridge._getMemorials;
  var getIssues = bridge._getIssues;
  var getActiveScenario = bridge._getActiveScenario;
  var getArmies = bridge._getArmies;
  var issueIsResolved = bridge._issueIsResolved;
  var tmfRenwuPortrait = bridge._tmfRenwuPortrait;
  var toast = bridge._toast;
  var RIGHT_ARMY_INITIAL_ROWS = 36;
  var RIGHT_ADMIN_INITIAL_ROWS = 24;
  var RIGHT_OFFICE_INITIAL_NODES = 8;
  var _rightArmyRenderSeq = 0;
  var _rightAdminRenderSeq = 0;
  var _rightOfficeRenderSeq = 0;

  // ── reverse 捕获：origin body 函数(origin 装载期 PLUMBING-B 已导出·均函数声明) ──
  var rightArmyBar = __p8R.rightArmyBar, rightArmyRows = __p8R.rightArmyRows, rightClassDemandByName = __p8R.rightClassDemandByName, rightFindSocialActor = __p8R.rightFindSocialActor, rightIssueNum = __p8R.rightIssueNum;
  //>>P8RAIL-SPLIT24-BODY-START
  function rightSocNum(x, keys, fallback){
    return rightIssueNum(x, keys, fallback == null ? 50 : fallback);
  }

  function rightSocialName(row){
    return String(row && (row.name || row.label || row.id || row.className || row.partyName) || '').trim();
  }

  function rightSocialLocalizeText(value){
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(rightSocialLocalizeText).filter(Boolean).join(' / ');
    if (typeof value === 'object') {
      value = value.display || value.text || value.name || value.topic || value.title || value.goalText || value.demandText ||
        value.goal || value.agenda || value.demand || value.reason || value.id || '';
    }
    var out = String(value || '').trim();
    if (!out) return '';
    [
      [/relieve tax and arrear pressure/gi, '缓解税负与积欠'],
      [/pay arrears and stabilize garrisons/gi, '清偿欠饷并安定驻军'],
      [/pay military wage arrears/gi, '清偿军饷拖欠'],
      [/reduce tax and levy pressure/gi, '减轻税赋与征派压力'],
      [/reduce tax and arrear pressure/gi, '缓解税负与积欠'],
      [/reduce emergency levy/gi, '减轻紧急征派'],
      [/force emergency levy review/gi, '推动复核紧急征派'],
      [/keep levy review moving/gi, '维持征派复核推进'],
      [/claim credit for levy review/gi, '借征派复核争取声望'],
      [/carry rural relief through court debate/gi, '经廷议推动乡里纾困'],
      [/carry rural relief/gi, '推动乡里纾困'],
      [/carry tenant relief/gi, '推动佃户纾困'],
      [/defend arrear collection/gi, '维护追征积欠'],
      [/farmer levy relief/gi, '农户征派纾困'],
      [/emergency grain levy/gi, '急征粮役'],
      [/emergency levy review/gi, '紧急征派复核'],
      [/rural relief promise/gi, '乡里纾困承诺'],
      [/responded to rural burden/gi, '回应乡里负担'],
      [/rural burden became party agenda/gi, '乡里负担转为党派议程'],
      [/high rural burden/gi, '乡里负担沉重'],
      [/memorial approval reassured tenants/gi, '奏疏准行安定佃户'],
      [/memorial approval gives party leverage/gi, '奏疏准行给予党派筹码'],
      [/approved memorial to investigate/gi, '批准奏疏查核'],
      [/party outcome changed class mood/gi, '党派结果牵动阶层情绪'],
      [/ecology signal tax linked class pressure to party agenda/gi, '税负生态信号把阶层压力牵入党派议程'],
      [/ecology signal tax linked class pressure/gi, '税负生态信号牵动阶层压力'],
      [/ecology matched/gi, '制度生态匹配'],
      [/ecology signal/gi, '生态信号'],
      [/class-minxin bridge/gi, '阶层民心桥'],
      [/social-political-signal/gi, '社会政治信号'],
      [/runtime-pressure/gi, '运行压力'],
      [/runtime-affinity/gi, '运行亲和'],
      [/runtime-estranged/gi, '运行疏离'],
      [/player-action/gi, '玩家操作'],
      [/memorial-decision-desk/gi, '奏疏批复'],
      [/petition/gi, '请愿'],
      [/memorial/gi, '上书'],
      [/propaganda/gi, '宣传'],
      [/obstruction/gi, '阻挠'],
      [/obstruct/gi, '阻挠'],
      [/funding/gi, '资助'],
      [/alliance/gi, '联盟'],
      [/split/gi, '分裂'],
      [/strike/gi, '罢工'],
      [/uprising/gi, '民变'],
      [/association/gi, '结社'],
      [/turn-result-class-evidence/gi, '回合推演·阶层证据'],
      [/turn-result-party-evidence/gi, '回合推演·党派证据'],
      [/turn-result-corruption-pressure/gi, '回合推演·贪腐压力'],
      [/turn-result-military-arrears/gi, '回合推演·军饷拖欠'],
      [/turn-result-tax-pressure/gi, '回合推演·税负压力'],
      [/turn-result-keju-pressure/gi, '回合推演·科举压力'],
      [/turn-result-local-unrest/gi, '回合推演·地方不稳'],
      [/turn-result-land-pressure/gi, '回合推演·土地压力'],
      [/turn-result/gi, '回合推演'],
      [/fiscal-peasant-burden/gi, '财政民负'],
      [/tax-pressure/gi, '税负压力'],
      [/corruption-pressure/gi, '贪腐压力'],
      [/military-arrears/gi, '军饷拖欠'],
      [/keju-pressure/gi, '科举压力'],
      [/land-pressure/gi, '土地压力'],
      [/local-unrest/gi, '地方不稳'],
      [/arrear-pressure/gi, '积欠压力'],
      [/tax pressure/gi, '税负压力'],
      [/corruption pressure/gi, '贪腐压力'],
      [/military arrears/gi, '军饷拖欠'],
      [/wage arrears/gi, '欠饷'],
      [/tenant households carrying rent arrears/gi, '承担租佃积欠的佃户'],
      [/smoke-ecology-apply-(\d+)/gi, '生态关系更新T$1'],
      [/smoke-ecology-tax-(\d+)/gi, '税负生态信号T$1'],
      [/smoke-cause-chain-turn/gi, '因果链回合证据'],
      [/smoke-cause-chain-apply/gi, '因果链应用'],
      [/smoke-turn-result-apply/gi, '回合推演应用'],
      [/smoke-turn-result/gi, '回合推演测试'],
      [/smoke-llm-calibration/gi, 'LLM校准'],
      [/confidence\s+/gi, '置信 '],
      [/affinity=(\d+)/gi, '亲和=$1'],
      [/unfulfilled/gi, '未兑现'],
      [/fulfilled/gi, '已兑现'],
      [/blocked/gi, '受阻'],
      [/issued/gi, '已明发'],
      [/reissued/gi, '再议'],
      [/resolved/gi, '已解决'],
      [/expired/gi, '已过期'],
      [/planned/gi, '筹划中'],
      [/active/gi, '活跃'],
      [/aligned/gi, '趋同'],
      [/estranged/gi, '疏离'],
      [/wavering/gi, '摇摆'],
      [/latent/gi, '潜伏'],
      [/calm/gi, '平稳'],
      [/signal/gi, '信号'],
      [/action/gi, '行动']
    ].forEach(function(pair){ out = out.replace(pair[0], pair[1]); });
    var tags = {
      fiscal: '财政', tax: '税负', land: '土地', keju: '科举', office: '官制', local: '地方',
      military: '军务', commerce: '商贸', corvee: '徭役', levy: '征派', tenant: '佃户',
      peasant: '民户', relief: '纾困', memorial: '奏疏', court: '廷议', party: '党派',
      class: '阶层', minxin: '民心', wage: '军饷', arrears: '积欠', source: '来源'
    };
    out = out.replace(/\b([a-z][a-z0-9_-]*)\b/gi, function(token){
      var key = String(token || '').toLowerCase();
      return Object.prototype.hasOwnProperty.call(tags, key) ? tags[key] : token;
    });
    return out;
  }

  function rightSocialBriefText(value){
    return rightSocialLocalizeText(rightSocialFirstText(value));
  }

  function rightSocialSameName(a, b){
    a = String(a || '').replace(/\s+/g, '').toLowerCase();
    b = String(b || '').replace(/\s+/g, '').toLowerCase();
    return !!(a && b && a === b);
  }

  function rightSocialPushCause(out, cause){
    if (!cause || !cause.text) return;
    var sig = [cause.source || '', cause.turn || '', cause.text || ''].join('|');
    if (out.some(function(x){ return [x.source || '', x.turn || '', x.text || ''].join('|') === sig; })) return;
    out.push(cause);
  }

  function rightSocialCauseTextFromChange(ch){
    if (!ch) return '';
    var field = ch.field ? rightSocialLocalizeText(ch.field) + ' ' : '';
    var delta = '';
    var oldN = Number(ch.oldValue);
    var newN = Number(ch.newValue);
    if (isFinite(oldN) && isFinite(newN) && oldN !== newN) delta = ' ' + (newN > oldN ? '+' : '') + Math.round((newN - oldN) * 100) / 100;
    return [field + delta, rightSocialLocalizeText(ch.reason)].filter(Boolean).join(' · ');
  }

  function rightSocialTurnChanges(actorType, name, out){
    var gm = window.GM || {};
    var bucket = gm.turnChanges && gm.turnChanges[actorType === 'party' ? 'parties' : 'classes'];
    (Array.isArray(bucket) ? bucket : []).forEach(function(row){
      if (!row || !rightSocialSameName(row.name, name)) return;
      (Array.isArray(row.changes) ? row.changes : []).slice(-3).forEach(function(ch){
        var text = rightSocialCauseTextFromChange(ch);
        if (text) rightSocialPushCause(out, { source: '回合变化', text: text });
      });
    });
  }

  function rightSocialClassCauses(row, out){
    (Array.isArray(row._socialPoliticalHistory) ? row._socialPoliticalHistory : []).slice(-3).forEach(function(h){
      rightSocialPushCause(out, {
        turn: h.turn,
        source: rightSocialLocalizeText(h.sourceSystem || h.source || '系统信号'),
        text: [h.kind, h.reason].map(rightSocialLocalizeText).filter(Boolean).join(' · ')
      });
    });
    (Array.isArray(row.partyOutcomeHistory) ? row.partyOutcomeHistory : []).slice(-3).forEach(function(h){
      var refs = (Array.isArray(h.refs) ? h.refs : []).map(function(r){ return r && r.partyName; }).filter(Boolean).join('/');
      rightSocialPushCause(out, {
        turn: h.turn,
        source: '廷议回响',
        text: [(refs ? refs : ''), rightSocialLocalizeText(h.outcome || h.status), h.satisfactionDelta != null ? ('满意 ' + h.satisfactionDelta) : ''].filter(Boolean).join(' · ')
      });
    });
    var gm = window.GM || {};
    (Array.isArray(gm._partyClassCourtIssueLinks) ? gm._partyClassCourtIssueLinks : []).slice(-8).forEach(function(x){
      if (!x || !rightSocialSameName(x.className, rightSocialName(row))) return;
      rightSocialPushCause(out, {
        turn: x.turn,
        source: '议题牵连',
        text: [(x.party || ''), rightSocialLocalizeText(x.topic || ''), rightSocialLocalizeText(x.goalText || '')].filter(Boolean).join(' · ')
      });
    });
  }

  function rightSocialPartyCauses(row, out){
    (Array.isArray(row._socialPoliticalHistory) ? row._socialPoliticalHistory : []).slice(-3).forEach(function(h){
      rightSocialPushCause(out, {
        turn: h.turn,
        source: rightSocialLocalizeText(h.sourceSystem || h.source || '系统信号'),
        text: [h.kind, h.reason].map(rightSocialLocalizeText).filter(Boolean).join(' · ')
      });
    });
    (Array.isArray(row.agenda_history) ? row.agenda_history : []).slice(-3).forEach(function(h){
      rightSocialPushCause(out, {
        turn: h.turn,
        source: rightSocialLocalizeText(h.source || '议程变动'),
        text: [h.reason, h.currentAgenda, h.shortGoal, h.text].map(rightSocialLocalizeText).filter(Boolean).join(' · ')
      });
    });
    var gm = window.GM || {};
    (Array.isArray(gm._partyClassCourtIssueLinks) ? gm._partyClassCourtIssueLinks : []).slice(-8).forEach(function(x){
      if (!x || !rightSocialSameName(x.party, rightSocialName(row))) return;
      rightSocialPushCause(out, {
        turn: x.turn,
        source: '议题牵连',
        text: [(x.className || ''), rightSocialLocalizeText(x.topic || ''), rightSocialLocalizeText(x.goalText || '')].filter(Boolean).join(' · ')
      });
    });
  }

  function rightSocialNearCauses(actorType, row){
    var out = [];
    var name = rightSocialName(row);
    rightSocialTurnChanges(actorType, name, out);
    if (actorType === 'party') rightSocialPartyCauses(row, out);
    else rightSocialClassCauses(row, out);
    return out.filter(function(x){ return x && x.text; }).slice(-4).reverse();
  }

  function rightSocialSignalCauses(actorType, row){
    var api = window.TM && window.TM.SocialPoliticalSignals;
    if (!api || typeof window.TM.SocialPoliticalSignals.getRecentCauses !== 'function') return [];
    try {
      return window.TM.SocialPoliticalSignals.getRecentCauses(window.GM || {}, actorType, rightSocialName(row), { limit: 4 }) || [];
    } catch (_) {
      return [];
    }
  }

  function renderRightSocialSignalCauses(actorType, row){
    var causes = rightSocialSignalCauses(actorType, row);
    if (!causes.length) return '';
    return '<div class="tmrp-social-cause tmrp-signal-cause"><b>近因</b>' + causes.map(function(c){
      var head = [(c.turn ? ('T' + c.turn) : ''), c.sourceLabel || c.sourceSystem || '信号', c.kind || ''].filter(Boolean).join(' · ');
      var detail = [c.summary || '', c.linkedIssue ? ('议题 ' + c.linkedIssue) : '', c.reason || ''].filter(Boolean).join(' · ');
      head = rightSocialLocalizeText(head);
      detail = rightSocialLocalizeText(detail);
      var title = [head, detail].filter(Boolean).join(' · ');
      return '<span class="tmrp-cause-row" title="' + attr(title) + '"><em class="tmrp-cause-source">' + esc(head) + '</em><small>' + esc(detail || '暂无细节') + '</small></span>';
    }).join('') + '</div>';
  }

  function renderRightSocialCauses(actorType, row){
    var signalHtml = renderRightSocialSignalCauses(actorType, row);
    var causes = rightSocialNearCauses(actorType, row);
    if (!causes.length) return signalHtml || '<div class="tmrp-social-cause empty"><b>近因</b><span>暂无可追溯变化</span></div>';
    return signalHtml + '<div class="tmrp-social-cause"><b>近因</b>' + causes.map(function(c){
      var text = rightSocialLocalizeText(c.text || '');
      var source = rightSocialLocalizeText(c.source || '来源');
      return '<span title="' + attr(text) + '">' + esc((c.turn ? ('T' + c.turn + ' · ') : '') + source + ' · ' + text) + '</span>';
    }).join('') + '</div>';
  }

  function rightSocialFirstText(v){
    var arr = Array.isArray(v) ? v : [v];
    for (var i = 0; i < arr.length; i += 1) {
      var x = arr[i];
      if (x == null) continue;
      if (typeof x === 'object') x = x.text || x.name || x.party || x.class || x.goal || x.agenda || x.demand || '';
      x = String(x || '').trim();
      if (x) return rightSocialLocalizeText(x);
    }
    return '';
  }

  function rightSocialClassParties(row){
    var out = [];
    function add(v){
      if (!v) return;
      if (typeof v === 'object') v = v.party || v.partyName || v.class || v.name || v.id || '';
      v = String(v || '').trim();
      if (v && out.indexOf(v) < 0) out.push(v);
    }
    [row.supportingParties, row.supporting_parties, row.parties, row.linkedParties].forEach(function(list){
      (Array.isArray(list) ? list : [list]).forEach(add);
    });
    var gm = window.GM || {};
    var idx = gm._partyGoalRelationIndex;
    var name = rightSocialName(row);
    if (idx && idx.classParties && idx.classParties[name]) (Array.isArray(idx.classParties[name]) ? idx.classParties[name] : [idx.classParties[name]]).forEach(add);
    (Array.isArray(gm._partyClassCourtIssueLinks) ? gm._partyClassCourtIssueLinks : []).forEach(function(x){
      if (x && rightSocialSameName(x.className, name)) add(x.party);
    });
    return out.slice(0, 3);
  }

  function rightSocialRelationEdges(actorType, row){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var edges = [];
    var state = gm.partyClassRelations && gm.partyClassRelations.edges;
    if (state && typeof state === 'object') {
      Object.keys(state).forEach(function(k){
        var edge = state[k];
        if (!edge) return;
        if (actorType === 'party') {
          if (!rightSocialSameName(edge.partyName, name)) return;
        } else if (!rightSocialSameName(edge.className, name)) return;
        edges.push(edge);
      });
    }
    var idx = gm._partyGoalRelationIndex;
    if (idx && Array.isArray(idx.evidence)) {
      idx.evidence.forEach(function(e){
        if (!e) return;
        if (actorType === 'party') {
          if (!rightSocialSameName(e.partyName, name)) return;
        } else if (!rightSocialSameName(e.className, name)) return;
        var exists = edges.some(function(edge){
          return rightSocialSameName(edge.className, e.className) && rightSocialSameName(edge.partyName, e.partyName);
        });
        if (!exists) edges.push({
          className: e.className,
          partyName: e.partyName,
          affinity: e.affinity,
          trust: e.trust,
          grievance: e.grievance,
          status: e.status || e.source || '',
          lastSource: e.source || '',
          lastReason: e.detail || ''
        });
      });
    }
    return edges.sort(function(a, b){
      var aa = Number(a && a.affinity);
      var bb = Number(b && b.affinity);
      if (!isFinite(aa)) aa = 0;
      if (!isFinite(bb)) bb = 0;
      return bb - aa;
    }).slice(0, 4);
  }

  function rightSocialEcologySignals(actorType, row){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var store = gm._partyClassEcology || {};
    return (Array.isArray(store.signalHistory) ? store.signalHistory : []).filter(function(s){
      if (!s) return false;
      var list = actorType === 'party' ? s.affectedParties : s.affectedClasses;
      return (Array.isArray(list) ? list : []).some(function(x){ return rightSocialSameName(x, name); });
    }).slice(-3).reverse();
  }

  function rightRelationClassRisk(className){
    var cls = rightFindSocialActor('class', className);
    return cls ? rightSocialRisk('class', cls) : '风险待察';
  }

  function rightRelationRouteForecast(edge){
    edge = edge || {};
    var className = edge.className || '';
    var partyName = edge.partyName || '';
    var demand = rightSocialLocalizeText(rightClassDemandByName(className) || '阶层诉求');
    var risk = rightRelationClassRisk(className);
    var grievance = Number(edge.grievance);
    if (!isFinite(grievance)) grievance = 45;
    var affinity = Number(edge.affinity);
    var highRisk = /民变|罢工|请愿|风险/.test(risk) || grievance >= 66 || (isFinite(affinity) && affinity < 30);
    return '预期：通过诏书/奏疏/问对/朝议/鸿雁处理「' + demand + '」会牵动' +
      (partyName || '相关党派') + '/' + (className || '相关阶层') + '关系 · 风险：' + risk +
      (highRisk ? ' · 建议廷议' : '');
  }

  function renderRightSocialEcology(actorType, row){
    var edges = rightSocialRelationEdges(actorType, row);
    var signals = rightSocialEcologySignals(actorType, row);
    if (!edges.length && !signals.length) return '';
    function edgeRow(edge){
      edge = edge || {};
      var peer = actorType === 'party' ? edge.className : edge.partyName;
      if (!peer) return '';
      var status = edge.status || 'latent';
      var statusLabel = rightSocialLocalizeText(status);
      var aff = edge.affinity != null && isFinite(Number(edge.affinity)) ? Math.round(Number(edge.affinity)) : '—';
      var trust = edge.trust != null && isFinite(Number(edge.trust)) ? Math.round(Number(edge.trust)) : '—';
      var grievance = edge.grievance != null && isFinite(Number(edge.grievance)) ? Math.round(Number(edge.grievance)) : '—';
      var source = edge.lastSource || edge.source || '';
      var reason = edge.lastReason || edge.reason || '';
      var chainKind = actorType === 'party' ? 'demand' : 'party';
      var routeForecast = rightSocialLocalizeText(rightRelationRouteForecast(edge));
      var sourceReason = rightSocialLocalizeText([source, reason].filter(Boolean).join(' · '));
      return '<div class="tmrp-ecology-edge ' + attr(String(status).toLowerCase()) + '">' +
        '<button type="button" class="tmrp-ecology-link" data-right-action="social-chain" data-chain-kind="' + attr(chainKind) + '" data-actor-type="' + attr(actorType) + '" data-name="' + attr(rightSocialName(row)) + '" data-target="' + attr(peer) + '" data-topic="' + attr(reason || peer) + '">' + esc(peer) + '</button>' +
        '<span>' + esc(statusLabel) + '</span>' +
        '<small>亲和 ' + esc(aff) + ' · 信 ' + esc(trust) + ' · 怨 ' + esc(grievance) + '</small>' +
        (sourceReason ? '<em title="' + attr(sourceReason) + '">' + esc(sourceReason) + '</em>' : '') +
        '<div class="tmrp-ecology-forecast" title="' + attr(routeForecast) + '">' + esc(routeForecast) + '</div>' +
        '</div>';
    }
    function signalRow(s){
      var cats = Array.isArray(s.categories) ? s.categories.join('/') : '';
      var kind = rightSocialLocalizeText(s.kind || 'signal');
      var sourceText = rightSocialLocalizeText([s.source || '', cats].filter(Boolean).join(' · '));
      return '<div class="tmrp-ecology-signal"><b>T' + esc(s.turn || '') + ' ' + esc(kind) + '</b><span>' + esc(sourceText) + '</span></div>';
    }
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>生态关系</b><small>' + esc(edges.length ? '动态亲和' : '信号来源') + '</small></div>' +
      (edges.length ? '<div class="tmrp-ecology-list">' + edges.map(edgeRow).filter(Boolean).join('') + '</div>' : '') +
      (signals.length ? '<div class="tmrp-ecology-signals">' + signals.map(signalRow).join('') + '</div>' : '') +
      '</div>';
  }

  function rightClassCharacterAllEdges(){
    var gm = window.GM || {};
    var store = gm.classCharacterRelations || {};
    var raw = store.edges || {};
    var rows = [];
    if (Array.isArray(raw)) rows = raw.slice();
    else Object.keys(raw).forEach(function(k){ if (raw[k]) rows.push(raw[k]); });
    return rows.filter(Boolean);
  }

  function rightClassCharacterScore(edge){
    edge = edge || {};
    return (Number(edge.affinity) || 0) + (Number(edge.legitimacy) || 0) + (Number(edge.trust) || 0) + (Number(edge.mobilization) || 0) * 0.4 - (Number(edge.grievance) || 0) * 0.7;
  }

  function rightClassCharacterEdgesForClass(row){
    var name = rightSocialName(row);
    var seen = {};
    var out = [];
    function add(edge){
      if (!edge || !rightSocialSameName(edge.className, name)) return;
      var key = String(edge.characterId || edge.characterName || '') + '|' + String(edge.role || '');
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(edge);
    }
    rightPcArray(row && row.classCharacterRelations).forEach(add);
    rightClassCharacterAllEdges().forEach(add);
    return out.sort(function(a, b){ return rightClassCharacterScore(b) - rightClassCharacterScore(a); }).slice(0, 8);
  }

  function rightClassCharacterRoleLabel(role){
    role = String(role || '').toLowerCase();
    if (role === 'patron') return '庇护';
    if (role === 'broker') return '调停';
    if (role === 'suppressor') return '压制';
    if (role === 'symbol') return '象征';
    if (role === 'debtor') return '亏欠';
    if (role === 'enemy') return '仇怨';
    return '代表';
  }

  function rightClassCharacterPct(v){
    var n = Number(v);
    if (!isFinite(n)) return '—';
    if (Math.abs(n) <= 1) n *= 100;
    return String(Math.round(Math.max(0, Math.min(100, n))));
  }

  function renderRightClassCharacterRow(edge){
    edge = edge || {};
    var name = edge.characterName || edge.characterId || '未名人物';
    var reason = rightSocialLocalizeText(rightPcArray(edge.evidence).slice(-2).join(' · ') || edge.reason || edge.source || '');
    return '<button type="button" class="tmrp-ecology-edge tmrp-class-character-edge" data-right-action="wendui-select" data-id="' + attr(edge.characterId || edge.characterName || '') + '">' +
      '<span>' + esc(name) + '</span>' +
      '<small>' + esc(rightClassCharacterRoleLabel(edge.role)) + ' · 亲 ' + esc(rightClassCharacterPct(edge.affinity)) + ' · 信 ' + esc(rightClassCharacterPct(edge.trust)) + ' · 怨 ' + esc(rightClassCharacterPct(edge.grievance)) + '</small>' +
      (reason ? '<em title="' + attr(reason) + '">近因：' + esc(rightPcText(reason, 88)) + '</em>' : '') +
      '</button>';
  }

  function renderRightClassCharacterGroup(title, rows){
    rows = rightPcArray(rows).filter(Boolean);
    if (!rows.length) return '';
    return '<details class="tmrp-class-character-group" open><summary>' + esc(title) + ' · ' + esc(rows.length) + '</summary>' + rows.map(renderRightClassCharacterRow).join('') + '</details>';
  }

  function renderRightClassCharacterLinks(row){
    var edges = rightClassCharacterEdgesForClass(row);
    if (!edges.length) return '';
    var reps = edges.filter(function(e){ return !/suppressor|enemy/i.test(String(e.role || '')) && (Number(e.grievance) || 0) < 0.45; }).slice(0, 3);
    var beneficiaries = edges.filter(function(e){ return reps.indexOf(e) < 0 && (Number(e.affinity) || 0) >= 0.45; }).slice(0, 3);
    var grudges = edges.filter(function(e){ return /suppressor|enemy/i.test(String(e.role || '')) || (Number(e.grievance) || 0) >= 0.45; }).slice(0, 3);
    return '<div class="tmrp-ecology tmrp-class-character"><div class="tmrp-ecology-head"><b>阶层人物</b><small>谁代表谁，谁欠谁</small></div><div class="tmrp-ecology-list">' +
      renderRightClassCharacterGroup('代表人物', reps) +
      renderRightClassCharacterGroup('受益人物', beneficiaries) +
      renderRightClassCharacterGroup('怨恨人物', grudges) +
      '</div></div>';
  }

  function rightClassCharacterDelegateName(row){
    var edges = rightClassCharacterEdgesForClass(row);
    for (var i = 0; i < edges.length; i += 1) {
      var e = edges[i] || {};
      if (/suppressor|enemy/i.test(String(e.role || ''))) continue;
      if ((Number(e.grievance) || 0) >= 0.55) continue;
      return e.characterId || e.characterName || '';
    }
    return '';
  }

  function rightClassMinxinKey(row){
    try {
      if (window.TM && TM.ClassMinxinBridge && typeof TM.ClassMinxinBridge._classKeyOf === 'function') {
        return TM.ClassMinxinBridge._classKeyOf(row || {});
      }
    } catch(_) {}
    var explicit = row && (row.classKey || row.key || row.id || row.classId);
    if (explicit) return String(explicit || '').replace(/\s+/g, '').toLowerCase().trim();
    return String(rightSocialName(row) || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function rightClassMinxinBridgeRows(row){
    var gm = window.GM || {};
    var byClass = gm.minxin && gm.minxin.byClass;
    if (!byClass || typeof byClass !== 'object') return '';
    var key = rightClassMinxinKey(row);
    var name = rightSocialName(row);
    var mx = byClass[key] || null;
    if (!mx) {
      Object.keys(byClass).some(function(k){
        var candidate = byClass[k];
        if (!candidate) return false;
        if (rightSocialSameName(candidate.className, name) || rightSocialSameName(k, key)) {
          mx = candidate;
          key = k;
          return true;
        }
        return false;
      });
    }
    var ledger = rightPcArray(gm._classMinxinBridgeLedger).filter(function(x){
      return x && (rightSocialSameName(x.classKey, key) || rightSocialSameName(x.className, name));
    }).slice(-3).reverse();
    if (!mx && !ledger.length) return '';
    var rows = '';
    if (mx) {
      var trueIdx = Number(mx.true != null ? mx.true : mx.index);
      var perceived = Number(mx.perceived != null ? mx.perceived : trueIdx);
      var phaseLabel = rightSocialLocalizeText(mx.unrestPhase || 'calm');
      var pressureReason = rightSocialLocalizeText(mx.lastPressure && mx.lastPressure.reason || '');
      rows += '<div class="tmrp-ecology-edge ' + attr(String(mx.unrestPhase || 'calm').toLowerCase()) + '">' +
        '<span>民心</span>' +
        '<small>真实 ' + esc(isFinite(trueIdx) ? Math.round(trueIdx) : '—') + ' · 感知 ' + esc(isFinite(perceived) ? Math.round(perceived) : '—') + ' · ' + esc(phaseLabel) + '</small>' +
        (pressureReason ? '<em title="' + attr(pressureReason) + '">' + esc(rightPcText(pressureReason, 90)) + '</em>' : '') +
        '</div>';
    }
    ledger.forEach(function(x){
      var regs = rightPcArray(x.appliedRegions).map(function(r){ return r && (r.region || r.name || r.id || r); }).filter(Boolean).slice(0, 3).join(' / ');
      rows += '<div class="tmrp-ecology-signal"><b>T' + esc(x.turn || '') + ' ' + esc(rightSocialLocalizeText(x.sourceSystem || 'class-minxin')) + '</b><span>' +
        esc(rightSocialLocalizeText([x.linkedIssue || '', regs || '', x.reason || ''].filter(Boolean).join(' · '))).slice(0, 160) +
        '</span></div>';
    });
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>阶层民心</b><small>民心联动</small></div><div class="tmrp-ecology-list">' + rows + '</div></div>';
  }

  function rightSocialIssueLinks(actorType, row){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var out = [];
    function add(raw, source){
      if (!raw) return;
      var topic = raw.topic || raw.title || raw.goalText || raw.reason || '';
      if (!topic) return;
      var id = raw.issueId || raw.id || raw.topicId || raw.chaoyiTrackId || topic;
      var sig = String(id || topic);
      if (out.some(function(x){ return String(x.id || x.topic) === sig; })) return;
      out.push({ id: id, topic: rightSocialLocalizeText(topic), source: rightSocialLocalizeText(source || raw.source || ''), party: raw.party || raw.sourceParty || '', className: raw.className || raw.sourceClass || '' });
    }
    (Array.isArray(gm._partyClassCourtIssueLinks) ? gm._partyClassCourtIssueLinks : []).forEach(function(x){
      if (!x) return;
      if (actorType === 'party' && rightSocialSameName(x.party, name)) add(x, 'goal-link');
      if (actorType !== 'party' && rightSocialSameName(x.className, name)) add(x, 'goal-link');
    });
    (Array.isArray(gm._pendingTinyiTopics) ? gm._pendingTinyiTopics : []).forEach(function(x){
      if (!x) return;
      if (actorType === 'party' && (rightSocialSameName(x.party, name) || rightSocialSameName(x.sourceParty, name))) add(x, 'pending');
      if (actorType !== 'party' && (rightSocialSameName(x.className, name) || rightSocialSameName(x.sourceClass, name))) add(x, 'pending');
    });
    return out.slice(0, 3);
  }

  function rightSocialRecentRuling(actorType, row, issues){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var issueTopics = (issues || []).map(function(x){ return String(x.topic || x.id || ''); });
    var rows = []
      .concat(Array.isArray(gm.tinyiSeals) ? gm.tinyiSeals : [])
      .concat(Array.isArray(gm._courtRecords) ? gm._courtRecords : []);
    for (var i = rows.length - 1; i >= 0; i -= 1) {
      var r = rows[i] || {};
      var topic = r.topic || r.title || '';
      var actorHit = actorType === 'party'
        ? (rightSocialSameName(r.sourceParty, name) || rightSocialSameName(r.party, name))
        : (rightSocialSameName(r.sourceClass, name) || rightSocialSameName(r.className, name));
      var issueHit = topic && issueTopics.some(function(t){ return t && (String(topic).indexOf(t) >= 0 || String(t).indexOf(topic) >= 0); });
      if (actorHit || issueHit) return { topic: topic, status: r.sealStatus || r.status || r.result || r.decision || '', grade: r.grade || '' };
    }
    return null;
  }

  function rightSocialRisk(actorType, row){
    if (actorType === 'party') {
      var cohesion = rightSocNum(row, ['cohesion','unity'], 50);
      var inf = rightSocNum(row, ['influence','power','weight'], 50);
      if (cohesion < 45) return '凝聚偏低，易分裂';
      if (inf > 70) return '党势偏盛，易阻挠';
      return row.shortGoal || row.currentAgenda ? '目标推进中' : '暂无明显风险';
    }
    var sat = rightSocNum(row, ['satisfaction','support','mood','loyalty'], 50);
    var unrest = row && row.unrestLevels || {};
    var strike = Number(unrest.strike || 0);
    var revolt = Number(unrest.revolt || 0);
    if (sat < 30 || revolt >= 70) return '民变苗头';
    if (strike >= 60) return '罢工/聚众风险';
    if (sat < 45) return '请愿升温';
    return '风险平稳';
  }

  function rightSocialChainButton(kind, label, target, topic, actorType, row){
    if (!label) return '';
    var displayLabel = rightSocialLocalizeText(label);
    var displayTopic = rightSocialLocalizeText(topic || label);
    return '<button type="button" class="tmrp-chain-step" data-right-action="social-chain" data-chain-kind="' + attr(kind) + '" data-actor-type="' + attr(actorType) + '" data-name="' + attr(rightSocialName(row)) + '" data-target="' + attr(target || '') + '" data-topic="' + attr(displayTopic) + '">' + esc(displayLabel) + '</button>';
  }

  function rightClassActionDelegate(row){
    var actions = rightActorActionRows('class', row);
    for (var i = 0; i < actions.length; i += 1) {
      var a = actions[i] || {};
      if (a.delegateCharacter || a.delegateCharacterId) {
        return {
          label: a.delegateCharacter || a.delegateCharacterId,
          target: a.delegateCharacterId || a.delegateCharacter,
          role: a.delegateRole || '',
          evidence: a.delegateEvidence || ''
        };
      }
    }
    var edges = rightClassCharacterEdgesForClass(row);
    for (var j = 0; j < edges.length; j += 1) {
      var e = edges[j] || {};
      if (/suppressor|enemy/i.test(String(e.role || ''))) continue;
      if ((Number(e.grievance) || 0) >= 0.5) continue;
      if (e.characterName || e.characterId) {
        return {
          label: e.characterName || e.characterId,
          target: e.characterId || e.characterName,
          role: e.role || '',
          evidence: rightPcArray(e.evidence).join(' / ')
        };
      }
    }
    return null;
  }

  function renderRightSocialChain(actorType, row){
    var name = rightSocialName(row);
    var issues = rightSocialIssueLinks(actorType, row);
    var demand = actorType === 'party'
      ? rightSocialFirstText(row.shortGoal || row.currentAgenda || row.agenda)
      : rightSocialFirstText(row.currentDemand || row.demands);
    var parties = actorType === 'party' ? [name] : rightSocialClassParties(row);
    var issue = issues[0] || null;
    var ruling = rightSocialRecentRuling(actorType, row, issues);
    var risk = rightSocialRisk(actorType, row);
    var html = '';
    html += rightSocialChainButton('demand', demand || (actorType === 'party' ? '近期目标' : '阶层诉求'), demand, issue && issue.topic, actorType, row);
    if (actorType !== 'party') {
      var delegate = rightClassActionDelegate(row);
      html += rightSocialChainButton('delegate', delegate ? delegate.label : '待定代理人物', delegate && (delegate.target || delegate.label), issue && issue.topic || demand, actorType, row);
    }
    html += rightSocialChainButton('party', parties[0] || (actorType === 'party' ? name : '待形成支持党派'), parties[0] || '', issue && issue.topic, actorType, row);
    html += rightSocialChainButton('issue', issue ? issue.topic : '待付廷议', issue && issue.id, issue && issue.topic || demand, actorType, row);
    html += rightSocialChainButton('ruling', ruling ? ((ruling.status || '裁决') + (ruling.grade ? ' ' + ruling.grade : '')) : '暂无裁决', ruling && ruling.topic, ruling && ruling.topic || demand, actorType, row);
    html += rightSocialChainButton('risk', risk, risk, issue && issue.topic || demand, actorType, row);
    return '<div class="tmrp-social-chain">' + html + '</div>';
  }

  function rightActorActionRows(actorType, row){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var source = actorType === 'party' ? gm.party_actions : gm.class_actions;
    var embedded = row && (actorType === 'party' ? row.party_actions : row.class_actions);
    var seen = {};
    return (rightPcArray(source).concat(rightPcArray(embedded))).filter(function(a){
      if (!a || a.actorType !== actorType || !rightSocialSameName(a.actorId, name)) return false;
      if (/expired|resolved|cancelled|canceled/i.test(String(a.status || ''))) return false;
      var key = a.id || [a.actorType, a.actorId, a.actionType, a.linkedIssue, a.turn].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(-4).reverse();
  }

  function rightActorTinyiForAction(action){
    var gm = window.GM || {};
    var key = action && (action.id || [action.actorType, action.actorId, action.actionType, action.linkedIssue, action.agenda || action.grievance, action.turn].join('|'));
    var issue = action && action.linkedIssue;
    var rows = Array.isArray(gm._pendingTinyiTopics) ? gm._pendingTinyiTopics : [];
    for (var i = 0; i < rows.length; i += 1) {
      var topic = rows[i] || {};
      var linked = Array.isArray(topic.linkedActions) ? topic.linkedActions : [];
      if (key && linked.some(function(x){ return String(x) === String(key); })) return topic;
      if (issue && String(topic.issueId || topic.id || topic.topicId || topic.linkedIssue || '') === String(issue)) return topic;
    }
    return null;
  }

  function renderRightActorActions(actorType, row){
    var actions = rightActorActionRows(actorType, row);
    if (!actions.length) return '';
    return '<div class="tmrp-actor-action"><b>正在行动</b>' + actions.map(function(a){
      var tinyi = rightActorTinyiForAction(a);
      var head = rightSocialLocalizeText(['T' + (a.turn || ''), a.actionType || 'action', a.status || 'planned'].filter(Boolean).join(' · '));
      var delegate = a.delegateCharacter ? ('代理人物：' + a.delegateCharacter + (a.delegateRole ? '（' + rightClassCharacterRoleLabel(a.delegateRole) + '）' : '')) : '';
      var delegateEvidence = a.delegateEvidence ? ('近因：' + rightSocialLocalizeText(a.delegateEvidence)) : '';
      var body = rightSocialLocalizeText([
        a.agenda || a.grievance || '',
        delegate,
        delegateEvidence,
        tinyi && tinyi.topic ? ('廷议 ' + tinyi.topic) : (a.linkedIssue ? ('议题 ' + a.linkedIssue) : ''),
        a.source || ''
      ].filter(Boolean).join(' · '));
      return '<span title="' + attr([head, body].filter(Boolean).join(' · ')) + '"><em>' + esc(head) + '</em><small>' + esc(body || '自主压力') + '</small></span>';
    }).join('') + '</div>';
  }

  function renderRightSocialActions(actorType, row){
    var name = rightSocialName(row);
    var safeName = attr(name);
    var firstLabel = actorType === 'party' ? '召党魁' : '召代表';
    var edictLabel = actorType === 'party' ? '拟平衡诏' : '拟安抚诏';
    return '<div class="tmrp-action-row tmrp-social-actions">' +
      '<button type="button" class="tmrp-btn" data-right-action="social-action" data-actor-type="' + attr(actorType) + '" data-name="' + safeName + '" data-social-command="audience">' + firstLabel + '</button>' +
      '<button type="button" class="tmrp-btn primary" data-right-action="social-action" data-actor-type="' + attr(actorType) + '" data-name="' + safeName + '" data-social-command="chaoyi">付廷议</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="social-action" data-actor-type="' + attr(actorType) + '" data-name="' + safeName + '" data-social-command="edict">' + edictLabel + '</button>' +
      '</div>';
  }

  function rightPcArray(v){
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
  }

  function rightPcText(v, n){
    var text = '';
    if (v && typeof v === 'object') {
      text = v.text || v.reason || v.summary || v.topic || v.title || v.goalText || v.agenda || v.name || v.id || '';
    } else {
      text = v == null ? '' : String(v);
    }
    if (typeof compactText === 'function') return compactText(text, n || 140);
    text = String(text || '').replace(/\s+/g, ' ').trim();
    return text.length > (n || 140) ? text.slice(0, n || 140) : text;
  }

  function rightPcJson(v){
    try { return JSON.stringify(v || {}); } catch (_) { return ''; }
  }

  function rightPcRow(title, body, tags){
    tags = rightPcArray(tags).filter(Boolean).slice(0, 5);
    return '<div class="tmrp-pcdebug-row"><b>' + esc(title || 'entry') + '</b>' +
      '<span>' + esc(body || '') + '</span>' +
      (tags.length ? '<div class="tmrp-pcdebug-tags">' + tags.map(function(t){ return '<i class="tmrp-pcdebug-tag">' + esc(t) + '</i>'; }).join('') + '</div>' : '') +
      '</div>';
  }

  function rightPcSection(title, small, rows, emptyText){
    rows = rightPcArray(rows).filter(Boolean);
    return '<section class="tmrp-card tmrp-pcdebug-section"><div class="tmrp-card-title"><span>' + esc(title) + '</span><small>' + esc(small || '') + '</small></div>' +
      (rows.length ? '<div class="tmrp-pcdebug-list">' + rows.join('') + '</div>' : '<div class="tmrp-empty">' + esc(emptyText || '暂无记录') + '</div>') +
      '</section>';
  }

  // 状态枚举→中文(仅显示用·枚举值本身不变)
  var _PC_STAT_CN = { active:'在办', stalled:'停滞', resolved:'化解', expired:'过期', pending:'待决', escalated:'升级', applied:'已应', settled:'了结', done:'完成', failed:'失败', delayed:'延期', executing:'执行中', completed:'完成', queued:'待办', converted:'已转', drift:'漂移',
    critical:'危殆', high:'紧要', medium:'寻常', low:'轻微', watch:'观望', hot:'灼热',
    signal:'信号', commitment:'承诺', consumer:'消费端', secret:'密信', alliance:'结盟', conspiracy:'密谋', routine:'例行', report:'禀报', warning:'警讯',
    refer:'付议', annotate:'批示', reject:'驳回', hold:'留中', approve:'准奏', responded:'已应', abolished:'已废',
    issued:'颁行', sealed:'已用印', promulgated:'颁行', vetoed:'封驳', tabled:'搁置', annotated:'已批' };
  function _pcStatCn(v){ if(v==null||v==='')return ''; var s=String(v); return _PC_STAT_CN[s] || _PC_STAT_CN[s.toLowerCase()] || s; }

  function rightPcSignalRows(gm){
    return rightPcArray(gm && gm._socialPoliticalSignals && gm._socialPoliticalSignals.items).slice(-8).reverse().map(function(s){
      return rightPcRow(
        'T' + (s.turn || '') + ' ' + (s.sourceSystem || '信号') + '/' + (s.kind || ''),
        rightPcText(s.reason || '', 140),
        [
          s.linkedIssue || '',
          '强度 ' + (s.intensity != null ? s.intensity : ''),
          '置信 ' + (s.confidence != null ? s.confidence : ''),
          s.resolved ? '化解' : (s.escalated ? '升级' : (s.applied ? '已应' : '待决'))
        ]
      );
    });
  }

  function rightPcMaintenanceRows(gm){
    var signalRows = rightPcArray(gm && gm._socialPoliticalSignalMaintenance).slice(-4).reverse().map(function(x){
      return rightPcRow('T' + (x.turn || '') + ' signal maintenance', rightPcJson(x.summary), [x.source || '']);
    });
    var actorRows = rightPcArray(gm && gm._partyClassActorMaintenance).slice(-4).reverse().map(function(x){
      return rightPcRow('T' + (x.turn || '') + ' actor maintenance', rightPcJson(x.summary), [x.source || '']);
    });
    var escalationRows = rightPcArray(gm && gm._socialPoliticalSignalEscalations).slice(-5).reverse().map(function(x){
      return rightPcRow('T' + (x.turn || '') + ' 升级', rightPcText(x.reason || x.kind || '', 140), [x.linkedIssue || '', rightPcArray(x.affectedClasses).join('/'), x.kind || '']);
    });
    return signalRows.concat(actorRows).concat(escalationRows);
  }

  function rightPcActorMemoryRows(gm){
    return rightPcArray(gm && gm._partyClassActorMemory && gm._partyClassActorMemory.items).slice(-10).reverse().map(function(m){
      return rightPcRow(
        'T' + (m.turn || '') + ' ' + (m.actorType || '') + ' ' + (m.actorId || ''),
        rightPcText((m.agenda || '') + ' / ' + (m.grievance || '') + ' / ' + (m.belief || ''), 180),
        [m.source || '', m.linkedIssue || '', _pcStatCn(m.status) || (m.resolved ? '化解' : (m.expired ? '过期' : '在办')), '置信 ' + (m.confidence != null ? m.confidence : '')]
      );
    });
  }

  function rightPcActionRows(gm){
    var partyRows = rightPcArray(gm && gm.party_actions).slice(-6).reverse().map(function(a){
      return rightPcRow('党派动作 ' + (a.actorId || ''), rightPcText((a.actionType || '') + ' / ' + (a.agenda || ''), 160), [a.linkedIssue || '', _pcStatCn(a.status), 'T' + (a.turn || '')]);
    });
    var classRows = rightPcArray(gm && gm.class_actions).slice(-6).reverse().map(function(a){
      return rightPcRow('阶层动作 ' + (a.actorId || ''), rightPcText((a.actionType || '') + ' / ' + (a.agenda || ''), 160), [a.linkedIssue || '', _pcStatCn(a.status), 'T' + (a.turn || '')]);
    });
    return partyRows.concat(classRows);
  }

  function rightPcClassCharacterRows(gm){
    gm = gm || window.GM || {};
    var store = gm.classCharacterRelations || {};
    var history = rightPcArray(store.history).slice(-6).reverse().map(function(h){
      return rightPcRow(
        '阶层人物·历 ' + (h.className || '') + '/' + (h.characterName || ''),
        rightPcText(rightPcArray(h.evidence).join(' / ') || h.reason || h.source || h.type || '', 160),
        [h.role || '', h.source || '', 'T' + (h.turn || '')]
      );
    });
    var edgeRows = rightClassCharacterAllEdges().slice(0, 8).map(function(e){
      return rightPcRow(
        '阶层人物·联 ' + (e.className || '') + '/' + (e.characterName || ''),
        rightPcText(rightPcArray(e.evidence).join(' / ') || e.source || '', 160),
        [
          e.role || '',
          '信任 ' + rightClassCharacterPct(e.trust),
          '积怨 ' + rightClassCharacterPct(e.grievance),
          'T' + (e.lastTurn || '')
        ]
      );
    });
    return edgeRows.concat(history);
  }

  function rightPcTinyiRows(gm){
    var pendingRows = rightPcArray(gm && gm._pendingTinyiTopics).slice(-7).reverse().map(function(t){
      return rightPcRow('廷议队列 ' + (t.topic || t.title || ''), rightPcText((t.goalText || t.demandText || t.reason || ''), 150), [t.sourceType || t.source || '', t.party || t.sourceParty || '', t.sourceClass || t.className || '', t.issueId || t.linkedIssue || '']);
    });
    var linkRows = rightPcArray(gm && gm._partyClassCourtIssueLinks).slice(-6).reverse().map(function(l){
      return rightPcRow('议题关联 ' + (l.topic || l.issueId || ''), rightPcText(l.goalText || l.reason || '', 150), [l.party || '', l.className || '', 'T' + (l.turn || '')]);
    });
    var courtRows = rightPcArray(gm && gm._courtRecords).concat(rightPcArray(gm && gm.tinyiSeals)).slice(-8).reverse().map(function(r){
      var status = _pcStatCn(r.sealStatus || r.status || r.result || '') + (r.grade ? ' ' + r.grade : '');
      return rightPcRow('朝议记录 ' + (r.topic || r.title || ''), rightPcText(r.demandText || r.body || r.reason || '', 150), [status, r.sourceParty || r.party || '', r.sourceClass || r.className || '', r.issueId || r.chaoyiTrackId || '']);
    });
    return pendingRows.concat(linkRows).concat(courtRows);
  }

  function rightPcInstitutionLifecycleRows(gm){
    gm = gm || window.GM || {};
    var parser = window.EdictParser || null;
    var rows = [];
    rightPcArray(gm.dynamicInstitutions).slice(-8).reverse().forEach(function(inst){
      if (!inst) return;
      var view = null;
      try {
        if (parser && typeof parser.getInstitutionLifecycleView === 'function') view = parser.getInstitutionLifecycleView(inst.id);
      } catch (_) {}
      view = view || {
        id: inst.id || '',
        name: inst.name || '',
        stage: inst.stage || '',
        currentStage: inst.stage || '',
        visibleSteps: [],
        timeline: rightPcArray(inst.history),
        feedback: rightPcArray(inst.lifecycle && inst.lifecycle.feedback),
        historicalReferences: rightPcArray(inst.lifecycle && inst.lifecycle.historicalReferences)
      };
      var steps = rightPcArray(view.visibleSteps).map(function(s){
        return (s.status === 'done' ? '完成 ' : '待办 ') + (s.key || s.label || '');
      }).join(' / ');
      var feedback = rightPcArray(view.feedback).slice(-2).map(function(f){
        return f.summary || f.text || f.reason || f.note || '';
      }).filter(Boolean).join(' / ');
      var refs = rightPcArray(view.historicalReferences).slice(-2).map(function(r){
        return r.note || r.text || r.citedBy || '';
      }).filter(Boolean).join(' / ');
      var body = [
        '当前 ' + (view.currentStage || view.stage || inst.stage || ''),
        steps,
        feedback ? ('反馈 ' + feedback) : '',
        refs ? ('历 ' + refs) : ''
      ].filter(Boolean).join(' | ');
      rows.push(rightPcRow(
        'Institution Lifecycle ' + (view.name || inst.name || inst.id || ''),
        rightPcText(body, 260),
        [view.currentStage || inst.stage || '', inst.rank ? ('品级 ' + inst.rank) : '', inst.createdTurn != null ? ('T' + inst.createdTurn) : '']
      ));
    });
    rightPcArray(gm._institutionLifecycleEvents).slice(-5).reverse().forEach(function(e){
      rows.push(rightPcRow(
        '制度大事 ' + (e.name || e.id || ''),
        rightPcText([(e.phaseKey || e.action || ''), e.text || ''].filter(Boolean).join(' / '), 200),
        ['T' + (e.turn || ''), e.phaseKey || '', e.action || '']
      ));
    });
    return rows;
  }

  function rightPcClassMinxinBridge(){
    var tm = window.TM || {};
    return tm.ClassMinxinBridge || null;
  }

  function rightPcClassMinxinDiagnostics(gm){
    gm = gm || window.GM || {};
    var api = rightPcClassMinxinBridge();
    if (api && typeof api.diagnostics === 'function') {
      try { return api.diagnostics(gm, { limit: 8 }); } catch (_) {}
    }
    var mx = gm.minxin || {};
    var byClass = [];
    Object.keys(mx.byClass || {}).forEach(function(key){
      var row = mx.byClass[key] || {};
      byClass.push({
        classKey: key,
        className: row.className || key,
        true: row.true != null ? row.true : row.index,
        perceived: row.perceived,
        unrestPhase: row.unrestPhase,
        demand: row.demand,
        lastPressure: row.lastPressure
      });
    });
    return {
      audit: gm._classMinxinBridgeAudit || null,
      warnings: [],
      maintenance: gm._classMinxinBridgeMaintenance || null,
      ledger: rightPcArray(gm._classMinxinBridgeLedger).slice(-8).reverse(),
      byClass: byClass.slice(0, 8),
      courtTopics: rightPcArray(gm._pendingTinyiTopics).filter(function(t){
        return t && (t.from === 'class-minxin-bridge' || t.sourceType === 'class_pressure' || (t.origin && t.origin.sourceType === 'class_minxin_bridge'));
      }).slice(0, 8),
      uprisingCandidates: rightPcArray(mx.uprisingCandidates).slice(-8).reverse()
    };
  }

  function rightPcRegionText(row){
    var names = [];
    rightPcArray(row && row.appliedRegions).forEach(function(r){
      var name = r && (r.region || r.name || r.id || r);
      if (name && names.indexOf(String(name)) < 0) names.push(String(name));
    });
    rightPcArray(row && row.regionWeights).forEach(function(r){
      var name = r && (r.region || r.name || r.id || r);
      if (name && names.indexOf(String(name)) < 0) names.push(String(name));
    });
    return names.join('/');
  }

  function rightPcClassMinxinRows(gm){
    var diag = rightPcClassMinxinDiagnostics(gm);
    var rows = [];
    var audit = diag.audit || {};
    var counts = audit.counts || {};
    if (diag.audit) {
      rows.push(rightPcRow(
        '稽核 ' + (audit.ok ? 'OK' : 'FAIL'),
        rightPcText((diag.warnings && diag.warnings.length ? diag.warnings.join(' / ') : rightPcJson(counts)), 220),
        ['重复 ' + (counts.duplicates || 0), '漂移 ' + (counts.drifts || 0), '盲区 ' + (counts.blindRegionWrites || 0), audit.source || '']
      ));
    }
    if (diag.maintenance) {
      rows.push(rightPcRow(
        'T' + (diag.maintenance.turn || '') + ' maintenance',
        rightPcJson({ courtIssues: diag.maintenance.courtIssues || 0, uprisingCandidates: diag.maintenance.uprisingCandidates || 0, auditOk: diag.maintenance.auditOk !== false }),
        [diag.maintenance.source || '', diag.maintenance.auditOk === false ? 'audit FAIL' : 'audit OK']
      ));
    }
    rightPcArray(diag.byClass).slice(0, 6).forEach(function(c){
      var lp = c.lastPressure || {};
      rows.push(rightPcRow(
        'byClass ' + (c.className || c.classKey || ''),
        rightPcText('实情 ' + (c.true != null ? c.true : c.index) + ' 观感 ' + (c.perceived != null ? c.perceived : '') + ' / ' + (c.unrestPhase || '') + ' / ' + (lp.reason || c.demand || ''), 180),
        [c.classKey || '', lp.linkedIssue || '', lp.delta != null ? ('增减 ' + lp.delta) : '']
      ));
    });
    rightPcArray(diag.ledger).slice(0, 6).forEach(function(row){
      var regions = rightPcRegionText(row);
      rows.push(rightPcRow(
        '账目 ' + (row.className || row.classKey || ''),
        rightPcText([row.reason || row.sourceSystem || '', regions].filter(Boolean).join(' / '), 180),
        [row.linkedIssue || '', row.sourceSystem || '', row.delta != null ? ('增减 ' + row.delta) : '', regions]
      ));
    });
    rightPcArray(diag.courtTopics).slice(0, 5).forEach(function(t){
      rows.push(rightPcRow(
        'Court Topic ' + (t.topic || t.title || t.id || ''),
        rightPcText(t.demandText || t.reason || '', 160),
        [t.from || t.sourceType || '', t.sourceClass || t.className || '', t.linkedIssue || t.issueId || '']
      ));
    });
    rightPcArray(diag.uprisingCandidates).slice(0, 5).forEach(function(c){
      rows.push(rightPcRow(
        '民变候选 ' + (c.id || ''),
        rightPcText([c.cause || '', c.region || ''].filter(Boolean).join(' / '), 160),
        [c.className || c.classKey || '', c.linkedIssue || '', c.level != null ? ('级别 ' + c.level) : '', c.momentum != null ? ('势头 ' + c.momentum) : '']
      ));
    });
    return rows;
  }

  function rightPcMinxinLedgerApi(){
    var tm = window.TM || {};
    return tm.MinxinLedger || null;
  }

  function rightPcMinxinLedgerSnapshot(gm){
    gm = gm || window.GM || {};
    var api = rightPcMinxinLedgerApi();
    if (api && typeof api.snapshot === 'function') {
      try { return api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    var ledger = gm._minxinLedger || {};
    var mx = gm.minxin || {};
    return {
      trueIndex: mx.trueIndex,
      perceivedIndex: mx.perceivedIndex,
      visibilityTier: mx.visibilityTier,
      recent: rightPcArray(ledger.items).slice(-8).reverse(),
      uprisingChain: rightPcArray(mx.uprisingChain),
      byRegion: mx.byRegion || {},
      byClass: mx.byClass || {}
    };
  }

  function rightPcMinxinLedgerRows(gm){
    var snap = rightPcMinxinLedgerSnapshot(gm);
    var rows = [];
    if (!snap) return rows;
    rows.push(rightPcRow(
      '实情 / 朝堂观感',
      rightPcText('实情 ' + (snap.trueIndex != null ? snap.trueIndex : '') + ' 观感 ' + (snap.perceivedIndex != null ? snap.perceivedIndex : '') + ' 显隐 ' + (snap.visibilityTier || ''), 180),
      ['Minxin Ledger']
    ));
    rightPcArray(snap.recent).slice(0, 6).forEach(function(row){
      var classes = rightPcArray(row.targetClasses).map(function(c){ return c.name || c.classKey || c; }).filter(Boolean).join('/');
      var regions = rightPcArray(row.targetRegions).map(function(r){ return r.region || r.name || r.id || r; }).filter(Boolean).join('/');
      rows.push(rightPcRow(
        'T' + (row.turn || '') + ' ' + (row.kind || row.sourceSystem || '信号'),
        rightPcText([row.reason || '', regions, classes].filter(Boolean).join(' / '), 190),
        [row.deltaTrue != null ? ('增减 ' + row.deltaTrue) : '', row.linkedIssue || '', row.policyActionId || row.courtIssueId || '']
      ));
    });
    Object.keys(snap.byRegion || {}).slice(0, 5).forEach(function(key){
      var r = snap.byRegion[key] || {};
      rows.push(rightPcRow(
        '地方 ' + (r.regionName || key),
        rightPcText('实情 ' + (r.true != null ? r.true : r.index) + ' 观感 ' + (r.perceived != null ? r.perceived : '') + ' 段位 ' + (r.phase || ''), 170),
        [r.visibilityTier || '', key]
      ));
    });
    Object.keys(snap.byClass || {}).slice(0, 5).forEach(function(key){
      var c = snap.byClass[key] || {};
      rows.push(rightPcRow(
        '阶层 ' + (c.className || key),
        rightPcText('实情 ' + (c.true != null ? c.true : c.index) + ' 观感 ' + (c.perceived != null ? c.perceived : '') + ' 缘由 ' + (c.lastReason || ''), 170),
        [c.linkedIssue || '', key]
      ));
    });
    rightPcArray(snap.uprisingChain).slice(0, 5).forEach(function(c){
      rows.push(rightPcRow(
        '民变链 ' + (c.region || c.regionName || c.id || ''),
        rightPcText(c.cause || c.reason || '', 170),
        [c.className || c.classKey || '', c.level != null ? ('级别 ' + c.level) : '', c.momentum != null ? ('势头 ' + c.momentum) : '']
      ));
    });
    return rows;
  }

  function rightPcMinxinLedgerCopyText(gm){
    gm = gm || window.GM || {};
    var api = rightPcMinxinLedgerApi();
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Ledger Diagnostics ===\n' + rightPcJson(rightPcMinxinLedgerSnapshot(gm));
  }

  function rightPcMinxinPressureRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinPressureActions;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinPressureActions || {};
      snap = {
        active: rightPcArray(store.items).filter(function(x){ return x && x.status === 'active'; }).slice(-8).reverse(),
        recent: rightPcArray(store.items).slice(-8).reverse(),
        responses: rightPcArray(store.responses).slice(-8).reverse(),
        maintenance: gm._minxinPressureActionsMaintenance || null
      };
    }
    var rows = [];
    if (snap.maintenance) {
      rows.push(rightPcRow(
        '维护·第' + (snap.maintenance.turn || ''),
        rightPcText('扫描 ' + (snap.maintenance.scanned || 0) + ' 生成 ' + (snap.maintenance.spawned || 0) + ' 在办 ' + (snap.maintenance.active || 0), 160),
        [snap.maintenance.source || '']
      ));
    }
    rightPcArray(snap.active || snap.recent).slice(0, 6).forEach(function(item){
      rows.push(rightPcRow(
        '积压 ' + (item.regionName || '') + ' / ' + (item.className || ''),
        rightPcText([item.reason || '', item.demandText || ''].filter(Boolean).join(' / '), 190),
        [_pcStatCn(item.severity), item.true != null ? ('实情 ' + item.true) : '', _pcStatCn(item.status), item.id || '']
      ));
    });
    rightPcArray(snap.responses).slice(0, 5).forEach(function(r){
      rows.push(rightPcRow(
        '回应 ' + (r.channel || '') + ' / ' + (_pcStatCn(r.decision)),
        rightPcText(r.text || '', 180),
        [r.linkedIssue || '', r.deltaTrue != null ? ('增减 ' + r.deltaTrue) : '', 'T' + (r.turn || '')]
      ));
    });
    return rows;
  }

  function rightPcMinxinPressureCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinPressureActions;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Pressure Actions Diagnostics ===\n' + rightPcJson(gm._minxinPressureActions || {});
  }

  function rightPcMinxinCommitmentRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinCommitmentTracker;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinCommitments || {};
      snap = {
        maintenance: gm._minxinCommitmentsMaintenance || null,
        active: rightPcArray(store.items).filter(function(x){ return x && (x.status === 'active' || x.status === 'stalled'); }).slice(-8).reverse(),
        recent: rightPcArray(store.items).slice(-8).reverse(),
        settlements: rightPcArray(store.settlements).slice(-8).reverse()
      };
    }
    var rows = [];
    if (snap.maintenance) {
      rows.push(rightPcRow(
        '维护·第' + (snap.maintenance.turn || ''),
        rightPcText('在办 ' + (snap.maintenance.active || 0) + ' 停滞 ' + (snap.maintenance.stalled || 0) + ' 化解 ' + (snap.maintenance.resolved || 0) + ' 了结 ' + (snap.maintenance.settled || 0), 180),
        [snap.maintenance.source || '']
      ));
    }
    rightPcArray(snap.active || snap.recent).slice(0, 6).forEach(function(item){
      rows.push(rightPcRow(
        '承诺 ' + (item.regionName || '') + ' / ' + (item.className || ''),
        rightPcText([item.text || '', '措置 ' + rightPcArray(item.measures).join('/')].filter(Boolean).join(' / '), 190),
        [_pcStatCn(item.status), item.progress != null ? ('进度 ' + item.progress) : '', item.dueTurn ? ('限期 ' + item.dueTurn) : '', item.id || '']
      ));
    });
    rightPcArray(snap.settlements).slice(0, 5).forEach(function(s){
      rows.push(rightPcRow(
        '结案 ' + (_pcStatCn(s.status)),
        rightPcText(s.reason || '', 190),
        [s.commitmentId || '', s.deltaTrue != null ? ('增减 ' + s.deltaTrue) : '', s.progress != null ? ('进度 ' + s.progress) : '']
      ));
    });
    return rows;
  }

  function rightPcMinxinCommitmentCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinCommitmentTracker;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Commitments Diagnostics ===\n' + rightPcJson(gm._minxinCommitments || {});
  }

  function rightPcMinxinResponsibilityRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinResponsibilityChain;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinResponsibilityChain || {};
      snap = {
        maintenance: gm._minxinResponsibilityMaintenance || null,
        assignments: rightPcArray(store.assignments).slice(-8).reverse(),
        officialReports: rightPcArray(store.officialReports).slice(-8).reverse(),
        rumors: rightPcArray(store.rumors).slice(-8).reverse(),
        interventions: rightPcArray(store.interventions).slice(-8).reverse(),
        accountability: rightPcArray(store.accountability).slice(-8).reverse()
      };
    }
    var rows = [];
    if (snap.maintenance) {
      rows.push(rightPcRow(
        '维护·第' + (snap.maintenance.turn || ''),
        rightPcText('指派 ' + (snap.maintenance.assigned || 0) + ' 官报 ' + (snap.maintenance.reports || 0) + ' 风闻 ' + (snap.maintenance.rumors || 0) + ' 问责 ' + (snap.maintenance.accountability || 0), 180),
        [snap.maintenance.source || '']
      ));
    }
    rightPcArray(snap.assignments).slice(0, 5).forEach(function(a){
      rows.push(rightPcRow(
        '指派 ' + (a.regionName || '') + ' / ' + (a.className || ''),
        rightPcText('承办司 ' + (a.agency || '') + ' 承办人 ' + (a.executor && a.executor.name || ''), 190),
        [a.commitmentId || '', a.falseReportRisk != null ? ('风险 ' + a.falseReportRisk) : '']
      ));
    });
    rightPcArray(snap.officialReports).slice(0, 5).forEach(function(r){
      rows.push(rightPcRow(
        '官报·' + (r.executorName || ''),
        rightPcText((r.regionName || '') + ' / ' + (r.className || '') + ' 所报 ' + (r.reportedProgress || 0) + ' 实际 ' + (r.actualProgress || 0), 190),
        [r.commitmentId || '', r.falseReportRisk != null ? ('风险 ' + r.falseReportRisk) : '']
      ));
    });
    rightPcArray(snap.rumors).slice(0, 5).forEach(function(r){
      rows.push(rightPcRow(
        '风闻 ' + (_pcStatCn(r.severity)),
        rightPcText(r.text || '', 190),
        [r.commitmentId || '', r.falseReportRisk != null ? ('风险 ' + r.falseReportRisk) : '', r.trueProgress != null ? ('实情 ' + r.trueProgress) : '']
      ));
    });
    rightPcArray(snap.accountability).slice(0, 5).forEach(function(a){
      rows.push(rightPcRow(
        '问责',
        rightPcText(a.reason || '', 190),
        [a.commitmentId || '', a.memorialId || '', a.tinyiId || '']
      ));
    });
    return rows;
  }

  function rightPcMinxinResponsibilityCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinResponsibilityChain;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Responsibility Chain Diagnostics ===\n' + rightPcJson(gm._minxinResponsibilityChain || {});
  }

  function rightPcMinxinHardLinkRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinHardLinks;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinHardLinks || {};
      snap = {
        summary: store.summary || {
          fiscal: gm.fiscal && gm.fiscal.minxinHardLinks || {},
          military: gm.military && gm.military.minxinHardLinks || {},
          hukou: gm.hukou && gm.hukou.minxinHardLinks || {},
          localExecution: gm.localExecution && gm.localExecution.minxinHardLinks || {}
        },
        regionImpacts: rightPcArray(store.regionImpacts).slice(-8).reverse(),
        ledger: rightPcArray(store.ledger).slice(-8).reverse()
      };
    }
    var rows = [];
    var summary = snap.summary || {};
    var fiscal = summary.fiscal || {};
    var military = summary.military || {};
    var hukou = summary.hukou || {};
    var local = summary.localExecution || {};
    rows.push(rightPcRow(
      'fiscal / conscription / hukou',
      rightPcText('实际 ' + (fiscal.actualRevenue || 0) + ' 申报 ' + (fiscal.claimedRevenue || 0) + ' 缺口 ' + (fiscal.revenueGap || 0) + ' 募兵 ' + (military.availableRecruits || 0), 190),
      ['隐匿 ' + (hukou.hiddenHouseholds || 0), '流民 ' + (hukou.refugees || 0), '执行 ' + (local.avgExecutionRate || 0)]
    ));
    rightPcArray(snap.regionImpacts).slice(0, 6).forEach(function(row){
      rows.push(rightPcRow(
        '硬链 ' + (row.regionName || ''),
        rightPcText('财赋 ' + ((row.fiscal && row.fiscal.actualRevenue) || 0) + '/' + ((row.fiscal && row.fiscal.claimedRevenue) || 0) + ' 征调 ' + ((row.conscription && row.conscription.recruitmentEfficiency) || 0) + ' 户籍 ' + ((row.hukou && row.hukou.hiddenHouseholds) || 0), 190),
        ['民心 ' + (row.trueMinxin || 0), '执行 ' + (row.localExecutionRate || 0), row.reason || '']
      ));
    });
    rightPcArray(snap.ledger).slice(0, 4).forEach(function(e){
      rows.push(rightPcRow(
        '强制 ' + (e.regionName || ''),
        rightPcText(e.reason || e.kind || '', 190),
        ['增减 ' + (e.deltaTrue || 0), '募兵 ' + (e.shortTermRecruits || 0), 'T' + (e.turn || '')]
      ));
    });
    return rows;
  }

  function rightPcMinxinHardLinkCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinHardLinks;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Hard Links Diagnostics ===\n' + rightPcJson(gm._minxinHardLinks || {});
  }

  function rightPcMinxinHardLinkConsumerRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinHardLinkConsumers;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinHardLinkConsumers || {};
      snap = {
        summary: store.summary || {},
        events: rightPcArray(store.events).slice(-8).reverse()
      };
    }
    var rows = [];
    var summary = snap.summary || {};
    var fiscal = summary.fiscal || {};
    var military = summary.military || {};
    var hukou = summary.hukou || {};
    var execution = summary.execution || {};
    rows.push(rightPcRow(
      '消费上限',
      rightPcText('实收 ' + (fiscal.actualIncome || 0) + '/' + (fiscal.plannedIncome || 0) + ' 募兵 ' + (military.approvedRecruits || 0) + '/' + (military.requestedRecruits || 0), 190),
      ['税基 ' + (hukou.effectiveTaxHouseholds || 0), '执行 ' + (execution.effectiveExecutionRate || 0)]
    ));
    rightPcArray(snap.events).slice(0, 6).forEach(function(e){
      var p = e.payload || {};
      rows.push(rightPcRow(
        e.type || '消费端',
        rightPcText(rightPcJson(p), 190),
        ['T' + (e.turn || '')]
      ));
    });
    return rows;
  }

  function rightPcMinxinHardLinkConsumerCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinHardLinkConsumers;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Hard Link Consumers Diagnostics ===\n' + rightPcJson(gm._minxinHardLinkConsumers || {});
  }

  function rightPcHujiRuntimeBridgeRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.HujiRuntimeBridge;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._hujiRuntimeBridge || {};
      snap = store.snapshot || {};
      snap.operations = rightPcArray(store.operations).slice(-8).reverse();
    }
    var rows = [];
    var hukou = snap.hukou || {};
    var corvee = (snap.corvee && snap.corvee.summary) || {};
    var military = snap.military || {};
    var hujiHardEffects = snap.hardEffects || gm._hujiHardEffects || {};
    var hardFiscal = hujiHardEffects.fiscal || {};
    var hardMilitary = hujiHardEffects.military || {};
    var hardCorvee = hujiHardEffects.corvee || {};
    rows.push(rightPcRow(
      'hukouLedger',
      rightPcText('在籍 ' + (hukou.registeredHouseholds || 0) + ' households / ' + (hukou.registeredMouths || 0) + ' mouths / ' + (hukou.registeredDing || 0) + ' ding', 190),
      ['隐匿 ' + (hukou.hiddenCount || 0), '逃户 ' + (hukou.fugitives || 0), '税基 ' + (hukou.effectiveTaxHouseholds || 0)]
    ));
    rows.push(rightPcRow(
      'corveeLedger',
      rightPcText('诉求 ' + (corvee.totalDemandDays || 0) + ' 兑现 ' + (corvee.fulfilledDays || 0) + ' 缺口 ' + (corvee.gapDays || 0), 190),
      ['负担 ' + (corvee.burden || 0), '折银 ' + (corvee.commutationRate || 0), '地方 ' + (corvee.regionCount || 0)]
    ));
    rows.push(rightPcRow(
      'militaryServicePool',
      rightPcText('在办 ' + (military.activeSoldiers || 0) + ' 可用 ' + (military.availableRecruits || 0) + ' 请拨 ' + (military.requestedRecruits || 0), 190),
      ['合格 ' + (military.eligibleDing || 0), '亏缺 ' + (military.shortfall || 0), '实效 ' + (military.avgRecruitmentEfficiency || 0)]
    ));
    if (hujiHardEffects && (hujiHardEffects.fiscal || hujiHardEffects.military || hujiHardEffects.corvee)) {
      rows.push(rightPcRow(
        'hujiHardEffects',
        rightPcText('财赋×' + (hardFiscal.collectionMultiplier || 0) + ' 损耗 ' + (hardFiscal.revenueLoss || 0) + ' · draft shortfall ' + (hardMilitary.shortfall || 0) + ' · minxin ' + (hardCorvee.minxinDelta || 0), 190),
        ['税基 ' + (hardFiscal.taxBaseRatio || 0), 'morale -' + (hardMilitary.moralePenalty || 0), '廷议 ' + ((hujiHardEffects.tinyi && hujiHardEffects.tinyi.totalPending) || 0)]
      ));
    }
    rightPcArray(hujiHardEffects.ledger).slice(-4).reverse().forEach(function(e){
      var s = e.summary || {};
      rows.push(rightPcRow(
        'hardEffectLedger',
        rightPcText((e.stage || '') + '/' + (e.kind || '') + ' 损耗 ' + (s.revenueLoss != null ? s.revenueLoss : '') + ' 亏缺 ' + (s.shortfall != null ? s.shortfall : '') + ' 民心 ' + (s.minxinDelta != null ? s.minxinDelta : ''), 190),
        ['T' + (e.turn || ''), '调整 ' + (s.adjustment != null ? s.adjustment : ''), e.source || '']
      ));
    });
    rightPcArray(snap.operations).slice(0, 5).forEach(function(op){
      rows.push(rightPcRow(
        'playerHujiOperation',
        rightPcText(op.text || op.reason || '', 190),
        ['T' + (op.turn || ''), rightPcArray(op.tags).join('/'), op.linkedIssue || '']
      ));
    });
    return rows;
  }

  function rightPcHujiRuntimeBridgeCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.HujiRuntimeBridge;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Huji Runtime Bridge Diagnostics ===\n' + rightPcJson(gm._hujiRuntimeBridge || {});
  }

  function rightPcHujiGovernanceRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.HujiGovernanceLoop;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._hujiGovernanceLoop || {};
      snap = {
        commitments: rightPcArray(gm._hujiCommitments).slice(-8).reverse(),
        events: rightPcArray(store.events).slice(-8).reverse(),
        stats: store.stats || {}
      };
    }
    var rows = [];
    rows.push(rightPcRow(
      'governanceSummary',
      rightPcText('在办 ' + (snap.active || 0) + ' 完成 ' + (snap.completed || 0) + ' 合计 ' + (snap.count || rightPcArray(snap.commitments).length), 190),
      ['新建 ' + ((snap.stats && snap.stats.created) || 0), '计入 ' + ((snap.stats && snap.stats.ticked) || 0)]
    ));
    rightPcArray(snap.commitments).slice(0, 6).forEach(function(c){
      var executorOffice = c.executorOffice || c.executorDept || '';
      var executorHolder = c.executorHolder || '';
      var executorLabel = executorOffice + (executorHolder ? '/' + executorHolder : '');
      rows.push(rightPcRow(
        c.type || '承诺',
        rightPcText((c.status || 'active') + ' 进度 ' + (c.progress || 0) + ' 执行 ' + (c.executionRate || 0) + ' 朝堂 ' + (c.courtDecision || '-')
          + (executorLabel ? ' 承办人 ' + executorLabel : '')
          + (c.executorReliability != null ? ' 可信 ' + c.executorReliability : '')
          + ' - ' + (c.target || c.title || ''), 220),
        ['T' + (c.turn || ''), '已付 ' + (c.paidCost || 0) + '/' + (c.cost || 0), executorLabel || c.linkedIssue || '']
      ));
    });
    rightPcArray(snap.events).slice(0, 4).forEach(function(e){
      var p = e.payload || {};
      rows.push(rightPcRow(
        e.type || 'governanceEvent',
        rightPcText(rightPcJson(p), 190),
        ['T' + (e.turn || ''), e.source || '']
      ));
    });
    return rows;
  }

  function rightPcHujiGovernanceCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.HujiGovernanceLoop;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Huji Governance Loop Diagnostics ===\n' + rightPcJson({ store: gm._hujiGovernanceLoop || {}, commitments: gm._hujiCommitments || [] });
  }

  function rightPcClassMinxinCopyText(gm){
    gm = gm || window.GM || {};
    var parts = [];
    var api = rightPcClassMinxinBridge();
    if (api && typeof api.diagnosticsText === 'function') {
      try { parts.push(api.diagnosticsText(gm, { limit: 12 })); } catch (_) {}
    }
    if (!parts.length) parts.push('=== Class Minxin Bridge Diagnostics ===\n' + rightPcJson(rightPcClassMinxinDiagnostics(gm)));
    parts.push(rightPcMinxinLedgerCopyText(gm));
    parts.push(rightPcMinxinPressureCopyText(gm));
    parts.push(rightPcMinxinCommitmentCopyText(gm));
    parts.push(rightPcMinxinResponsibilityCopyText(gm));
    parts.push(rightPcMinxinHardLinkCopyText(gm));
    parts.push(rightPcMinxinHardLinkConsumerCopyText(gm));
    parts.push(rightPcHujiRuntimeBridgeCopyText(gm));
    parts.push(rightPcHujiGovernanceCopyText(gm));
    return parts.join('\n\n');
  }

  function rightPcCopyDiagnostics(gm){
    var text = rightPcClassMinxinCopyText(gm);
    window._tmLastPartyClassDebugCopy = text;
    try {
      var nav = window.navigator || (typeof navigator !== 'undefined' ? navigator : null);
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') nav.clipboard.writeText(text);
    } catch (_) {}
    toast('诊断快照已复制');
    return text;
  }

  function renderPartyClassDebug(){
    var gm = window.GM || {};
    var signalCount = rightPcArray(gm._socialPoliticalSignals && gm._socialPoliticalSignals.items).length;
    var memCount = rightPcArray(gm._partyClassActorMemory && gm._partyClassActorMemory.items).length;
    var actionCount = rightPcArray(gm.party_actions).length + rightPcArray(gm.class_actions).length;
    var tinyiCount = rightPcArray(gm._pendingTinyiTopics).length;
    var ccCount = rightClassCharacterAllEdges().length;
    return '<div class="tmrp-pcdebug">' +
      '<section class="tmrp-card tmrp-pcdebug-copy"><div class="tmrp-card-title"><span>阶层民心桥</span><small>复制当前诊断快照</small></div><div class="tmrp-action-row"><button type="button" class="tmrp-btn" data-right-action="pcdebug-copy">复制诊断</button></div></section>' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(signalCount) + '</b><span>信号</span></div><div class="tmrp-stat"><b>' + esc(memCount) + '</b><span>记忆</span></div><div class="tmrp-stat"><b>' + esc(actionCount) + '</b><span>动作</span></div><div class="tmrp-stat"><b>' + esc(tinyiCount) + '</b><span>廷议</span></div><div class="tmrp-stat"><b>' + esc(ccCount) + '</b><span>阶层人物</span></div></div>' +
      rightPcSection('民心账目', '实情 / 观感 / 矩阵 / 民变', rightPcMinxinLedgerRows(gm), '暂无民心账目') +
      rightPcSection('民情积压·待处置', '奏疏 / 廷议 / 问对 / 鸿雁', rightPcMinxinPressureRows(gm), '暂无民情积压') +
      rightPcSection('民情承诺', '执行 / 代价 / 反弹', rightPcMinxinCommitmentRows(gm), '暂无民情承诺') +
      rightPcSection('民情责任链', '承办 / 官报 / 风闻 / 问责', rightPcMinxinResponsibilityRows(gm), '暂无民情责任链记录') +
      rightPcSection('民心硬链', '财赋 / 征调 / 户籍 / 执行', rightPcMinxinHardLinkRows(gm), '暂无民心硬链记录') +
      rightPcSection('民心硬链·消费端', '实收 / 募兵 / 税基 / 诏令上限', rightPcMinxinHardLinkConsumerRows(gm), '暂无消费端记录') +
      rightPcSection('户籍运行桥', '户籍 / 徭役 / 役源 / 玩家操作', rightPcHujiRuntimeBridgeRows(gm), '暂无户籍桥记录') +
      rightPcSection('户籍治理环', '正式操作 / 承诺 / 执行', rightPcHujiGovernanceRows(gm), '暂无户籍治理承诺') +
      rightPcSection('制度生命周期', '提案 / 廷议 / 试行 / 存档', rightPcInstitutionLifecycleRows(gm), '暂无制度生命周期记录') +
      rightPcSection('阶层民心桥', '稽核 / 账目 / 朝堂 / 民变', rightPcClassMinxinRows(gm), '暂无阶层民心桥记录') +
      rightPcSection('社会政治信号', '近期确定性证据', rightPcSignalRows(gm), '暂无信号') +
      rightPcSection('维护 / 升级', '衰减、化解、未决积压', rightPcMaintenanceRows(gm), '暂无维护记录') +
      rightPcSection('行动者记忆', '议程 / 积怨 / 信念账', rightPcActorMemoryRows(gm), '暂无行动者记忆') +
      rightPcSection('行动者动作', '党派动作 / 阶层动作', rightPcActionRows(gm), '暂无行动者动作') +
      rightPcSection('阶层人物关系', '拥护 / 怨望 / 证据', rightPcClassCharacterRows(gm), '暂无阶层人物记录') +
      rightPcSection('廷议队列 / 朝议记录', '议题关联与裁决', rightPcTinyiRows(gm), '暂无廷议/朝议记录') +
      '</div>';
  }

  // Outline keeps the observability entry visible so closed-loop evidence is easy to inspect.
  function rightIsDebug(){
    return true;
  }
  function renderGangRich(){
    var tab = state.rightOutlineTab || 'classes';
    return '<div class="tmrp-outline-shell">' +
      '<div class="tmrp-tabs"><button type="button" class="' + (tab === 'classes' ? 'active' : '') + '" data-right-action="outline-tab" data-tab="classes">阶层</button><button type="button" class="' + (tab === 'parties' ? 'active' : '') + '" data-right-action="outline-tab" data-tab="parties">党派</button></div>' +
      (rightIsDebug() ? '<section class="tmrp-card tmrp-pcdebug-entry"><div class="tmrp-action-row"><button type="button" class="tmrp-btn" data-right-action="pcdebug-open">观测账本</button></div></section>' : '') +
      (tab === 'parties' ? renderRightPartyPanel() : renderRightClassPanel()) +
      '</div>';
  }

  function rightFindSocialRow(rows, key){
    key = String(key || '');
    for (var i = 0; i < (rows || []).length; i += 1) { if (rightSocialName(rows[i]) === key) return rows[i]; }
    return null;
  }

  // ── 社会层地基（2026-06-12）：趋势/势位/近账/议程条目 helpers ──
  function rightSocGM(){ return (typeof GM === 'object' && GM) || {}; }
  function rightSatTrend(c){
    var t = 0, turn = Number(rightSocGM().turn) || 0;
    ((c && c._satLedger) || []).forEach(function(e){ if (e && e.t >= turn - 1) t += (Number(e.d) || 0); });
    return Math.round(t * 10) / 10;
  }
  function rightTrendTag(t){
    if (!t) return '';
    return '<i class="tmrp-trend ' + (t > 0 ? 'up' : 'down') + '">' + (t > 0 ? '▲' : '▼') + Math.abs(t) + '</i>';
  }
  function rightClassPressureTag(c){
    var sat = rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50);
    var base = Number(c && c._structBaseline);
    if (!isFinite(base)) return '';
    if (base - sat >= 8) return '<i class="tmrp-trend up">回升中</i>';
    if (sat - base >= 8) return '<i class="tmrp-trend down">承压</i>';
    return '';
  }
  function rightClassRadicalTag(c){
    var rf = Number(c && c._radicalFrac);
    if (!isFinite(rf) || rf < 0.2) return '';
    var band = rf >= 0.6 ? '鼎沸' : (rf >= 0.4 ? '汹汹' : '不稳');
    return '<i class="tmrp-trend down" title="乱民比例·激进民情（汹涌则近民变）">乱民' + Math.round(rf * 10) + '成·' + band + '</i>';
  }
  function rightSatLedgerRows(c){
    var rows = ((c && c._satLedger) || []).slice(-4).reverse().map(function(e){
      if (!e) return '';
      var d = Number(e.d) || 0;
      return '<div class="tmrp-ledger-row"><b class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d > 0 ? '+' : '') + d + '</b><small>' + esc('T' + (e.t != null ? e.t : '?') + ' · ' + rightSocialLocalizeText(String(e.why || e.src || '')).slice(0, 44)) + '</small></div>';
    }).filter(Boolean).join('');
    if (!rows) return '';
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>满意近账</b><small>何因增减</small></div><div class="tmrp-ecology-list">' + rows + '</div></div>';
  }
  function rightAgendaChips(c){
    var items = ((c && c._agenda && c._agenda.items) || []).slice()
      .sort(function(a, b){ return (Number(b.urgency) || 1) - (Number(a.urgency) || 1); }).slice(0, 6);
    if (!items.length) return '';
    var turn = Number(rightSocGM().turn) || 0;
    var chips = items.map(function(it){
      var u = Math.max(1, Math.min(3, Number(it.urgency) || 1));
      var dur = it.sinceTurn != null ? Math.max(0, turn - it.sinceTurn) : 0;
      return '<span class="tmrp-pill tmrp-agenda u' + u + '" title="' + attr((it.kind === 'seed' ? '本位诉求' : (it.kind === 'ai' ? '时局诉求' : '结构诉求')) + (dur ? '·已持续' + dur + '回合' : '')) + '">' + esc(String(it.text || '').slice(0, 20)) + (dur >= 2 ? '<small>·' + dur + '回合</small>' : '') + '</span>';
    }).join('');
    return '<div class="tmrp-chip-list tmrp-agenda-list">' + chips + '</div>';
  }
  // 地域分账（2026-06-12）：同阶不同地境遇悬殊·取最艰 4 地
  function rightClassRegionRows(c){
    var vs = (Array.isArray(c && c.regionalVariants) ? c.regionalVariants : []).filter(function(v){ return v && v.region && isFinite(Number(v.satisfaction)); });
    if (!vs.length) return '';
    vs = vs.slice().sort(function(a, b){ return Number(a.satisfaction) - Number(b.satisfaction); }).slice(0, 4);
    var rows = vs.map(function(v){
      var sNum = Math.round(Number(v.satisfaction));
      var base = Number(v._structBaseline);
      return '<div class="tmrp-ledger-row"><b class="' + (sNum < 35 ? 'neg' : 'pos') + '">' + sNum + '</b><small>' + esc(String(v.region) + (isFinite(base) ? '（势位' + Math.round(base) + '）' : '') + (v.distinguishing ? ' · ' + String(v.distinguishing).slice(0, 22) : '')) + '</small></div>';
    }).join('');
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>地域分账</b><small>同阶不同地</small></div><div class="tmrp-ecology-list">' + rows + '</div></div>';
  }
  function rightPartyLedgerRows(p){
    var ps = rightSocGM().partyState && rightSocGM().partyState[p && p.name];
    var rows = ((ps && ps.historyLog) || []).slice(-4).reverse().map(function(e){
      if (!e) return '';
      var d = Number(e.delta != null ? e.delta : e.influenceDelta) || 0;
      if (!d && !e.reason) return '';
      var label = e.field === 'cohesion' ? '凝聚' : '影响';
      return '<div class="tmrp-ledger-row"><b class="' + (d >= 0 ? 'pos' : 'neg') + '">' + label + (d > 0 ? '+' : '') + (Math.round(d * 10) / 10) + '</b><small>' + esc('T' + (e.turn != null ? e.turn : '?') + ' · ' + rightSocialLocalizeText(String(e.reason || '')).slice(0, 44)) + '</small></div>';
    }).filter(Boolean).join('');
    if (!rows) return '';
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>党势近账</b><small>何因消长</small></div><div class="tmrp-ecology-list">' + rows + '</div></div>';
  }
  function rightPartyRelChips(p){
    var ps = rightSocGM().partyState && rightSocGM().partyState[p && p.name];
    var foes = [].concat((ps && ps.conflictWith) || p.enemies || p.rivals || []).filter(Boolean).slice(0, 3);
    var allies = [].concat((ps && ps.alliedWith) || p.allies || []).filter(Boolean).slice(0, 3);
    if (!foes.length && !allies.length) return '';
    var chips = allies.map(function(x){ return '<span class="tmrp-pill tmrp-agenda u1">盟·' + esc(String(x).slice(0, 12)) + '</span>'; })
      .concat(foes.map(function(x){ return '<span class="tmrp-pill tmrp-agenda u3">敌·' + esc(String(x).slice(0, 12)) + '</span>'; })).join('');
    return '<div class="tmrp-chip-list">' + chips + '</div>';
  }

  // 政柄徽(V3式·2026-07-03)：秉政/在野/边缘——读 p.standing(canonical)或 partyState 镜像
  function rightPartyStandingTag(p){
    var st = p && (p.standing || (rightSocGM().partyState && rightSocGM().partyState[rightSocialName(p)] && rightSocGM().partyState[rightSocialName(p)].standing));
    if (st === 'governing') return ' <span class="tmrp-pill tmrp-agenda u1">秉政</span>';
    if (st === 'marginal') return ' <span class="tmrp-pill tmrp-agenda u3">边缘</span>';
    if (st === 'opposition') return ' <span class="tmrp-pill">在野</span>';
    return '';
  }
  // 政治运动 chips(V3式)：本阶层的运动·初起/成势/鼎沸
  function rightClassMovementChips(c){
    var GMx = rightSocGM();
    if (!c || !c.name || !Array.isArray(GMx._politicalMovements)) return '';
    var mine = GMx._politicalMovements.filter(function(m){ return m && m.className === c.name; });
    if (!mine.length) return '';
    var chips = mine.slice(0, 3).map(function(m){
      var tone = Number(m.support) >= 70 ? 'u3' : (Number(m.support) >= 40 ? 'u2' : 'u1');
      return '<span class="tmrp-pill tmrp-agenda ' + tone + '">运动·' + esc(String(m.label || m.kind).slice(0, 14)) + '·' + esc(m.phase || '') + esc(Math.round(Number(m.support) || 0)) + '</span>';
    }).join('');
    return '<div class="tmrp-chip-list">' + chips + '</div>';
  }

  // 失真层S3b·阶层满意度据奏(键='class.'+阶层名·head/detail/均值三处同键·上报偏高=有司报民感圣恩)
  function rightSocSatReported(c, sat){
    var RV = window.TM && TM.ReportedView;
    if (!RV || !RV.active(window.P || null)) return sat;
    return RV.value('minxin', 'class.' + rightSocialName(c), sat, { direction: 'good' }).shown;
  }

  // 列表态·紧凑行(2026-07-11·玩家反馈行14「没必要滑动·一页显示」)：名+满意/影响数字+一行诉求·
  // 条形图/立场/盟敌 chips/逐卡提示全撤(详情 flyout 一样不少)·整行可点进详情。
  function rightSocialClassHead(c){
    var sat = rightSocSatReported(c, rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50));
    var inf = rightSocNum(c, ['influence','power','weight'], 0);
    var brief = rightSocialBriefText(c.demands || c.currentDemand);
    return '<section class="tmrp-card tmrp-social-head ' + (sat < 45 ? 'hot' : (sat > 62 ? 'ok' : '')) + '" data-right-action="outline-select" data-type="class" data-key="' + attr(rightSocialName(c)) + '">' +
      '<div class="tmrp-card-title"><span>' + esc(c.name || c.label || c.id || '未名阶层') + '</span><small>满意 ' + esc(Math.round(sat)) + rightTrendTag(rightSatTrend(c)) + rightClassPressureTag(c) + rightClassRadicalTag(c) + ' · 影响 ' + esc(Math.round(inf)) + ' ›</small></div>' +
      (brief ? '<div class="tmrp-meta">' + esc(String(brief).slice(0, 44)) + '</div>' : '') +
      '</section>';
  }

  // 详情态·全 11 层深析(置入左展 flyout·壳自带头部×与滚动)
  function rightSocialClassDetail(c){
    var sat = rightSocSatReported(c, rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50));
    var inf = rightSocNum(c, ['influence','power','weight'], 0);
    var baseRow = isFinite(Number(c._structBaseline)) ? [['势位(应然)', String(Math.round(c._structBaseline)) + (Array.isArray(c._structParts) && c._structParts.length ? ' · ' + c._structParts.slice(0, 2).join(' · ') : '')]] : [];
    var leg = rightSocGM()._legitimacy;
    var legRow = (leg && leg.flag) ? [['天命权重', '权贵满意(clout)' + leg.clout + ' / 民心(人口)' + leg.pop + ' · ' + leg.flag]] : [];
    var agendaHtml = rightAgendaChips(c);
    return '<section class="tmrp-card ' + (sat < 45 ? 'hot' : (sat > 62 ? 'ok' : '')) + '"><div class="tmrp-card-title"><span>' + esc(c.name || c.label || c.id || '未名阶层') + '</span><small>满意 ' + esc(Math.round(sat)) + rightTrendTag(rightSatTrend(c)) + rightClassPressureTag(c) + rightClassRadicalTag(c) + ' · 影响 ' + esc(Math.round(inf)) + '</small></div>' +
      rightArmyBar('满意', sat) + rightArmyBar('影响', inf) +
      rightArmyRows([['规模', rightSocialLocalizeText(c.size || c.population || c.scale)], ['经济角色', rightSocialLocalizeText(c.economicRole || c.role)], ['法律地位', rightSocialLocalizeText(c.status)], ['流动性', rightSocialLocalizeText(c.mobility)], ['特权', rightSocialLocalizeText(c.privileges)], ['义务', rightSocialLocalizeText(c.obligations)]].concat(baseRow).concat(legRow)) +
      (agendaHtml || rightArmyRows([['诉求', rightSocialBriefText(c.demands || c.currentDemand)]])) +
      rightClassMovementChips(c) +
      rightClassRegionRows(c) +
      rightSatLedgerRows(c) +
      renderRightSocialCauses('class', c) +
      rightClassMinxinBridgeRows(c) +
      renderRightSocialEcology('class', c) +
      renderRightClassCharacterLinks(c) +
      renderRightSocialChain('class', c) +
      renderRightActorActions('class', c) +
      renderRightSocialActions('class', c) +
      '<div class="tmrp-meta">' + esc(rightSocialLocalizeText(c.description || c.desc || '')) + '</div></section>';
  }

  function renderRightClassPanel(){
    var rows = getClasses();
    var avg = rows.length ? Math.round(rows.reduce(function(s, c){ return s + rightSocSatReported(c, rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50)); }, 0) / rows.length) : 0;
    var maxInf = rows.reduce(function(m, c){ return Math.max(m, rightSocNum(c, ['influence','power','weight'], 0)); }, 0);
    var summary = '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(rows.length) + '</b><span>阶层</span></div><div class="tmrp-stat"><b>' + esc(avg) + '</b><span>平均满意</span></div><div class="tmrp-stat"><b>' + esc(maxInf) + '</b><span>最高影响</span></div></div>';
    if (!rows.length) return summary + '<section class="tmrp-card empty"><div class="tmrp-empty">暂无阶层数据。</div></section>';
    return summary + '<div class="tmrp-meta">点某行·左侧展开议程、近账、民心与行动链</div><div class="tmrp-scroll tall">' + rows.map(rightSocialClassHead).join('') + '</div>';
  }

  // 盟敌一行简计(紧凑行用·全名单在详情 flyout)
  function rightPartyRelBrief(p){
    var ps = rightSocGM().partyState && rightSocGM().partyState[p && p.name];
    var foes = [].concat((ps && ps.conflictWith) || p.enemies || p.rivals || []).filter(Boolean).length;
    var allies = [].concat((ps && ps.alliedWith) || p.allies || []).filter(Boolean).length;
    if (!foes && !allies) return '';
    return ' · ' + (allies ? '盟' + allies : '') + (allies && foes ? '/' : '') + (foes ? '敌' + foes : '');
  }
  function rightSocialPartyHead(p){
    var inf = rightSocNum(p, ['influence','power','weight'], 0);
    var status = p.status || p.state || '未录';
    var brief = rightSocialBriefText(p.currentAgenda || p.agenda || p.shortGoal);
    return '<section class="tmrp-card tmrp-social-head ' + (/活跃|active/i.test(String(status)) ? 'hot' : '') + '" data-right-action="outline-select" data-type="party" data-key="' + attr(rightSocialName(p)) + '">' +
      '<div class="tmrp-card-title"><span>' + esc(p.name || p.label || p.id || '未名党派') + rightPartyStandingTag(p) + '</span><small>' + esc(rightSocialLocalizeText(status)) + ' · 影响 ' + esc(Math.round(inf)) + rightPartyRelBrief(p) + ' ›</small></div>' +
      (brief ? '<div class="tmrp-meta">' + esc(String(brief).slice(0, 44)) + '</div>' : '') +
      '</section>';
  }

  function rightSocialPartyDetail(p){
    var inf = rightSocNum(p, ['influence','power','weight'], 0);
    var status = p.status || p.state || '未录';
    var stance = p.policyStance || p.stances || p.agenda;
    var stanceHtml = (Array.isArray(stance) ? stance : [stance]).filter(Boolean).map(function(x){ return '<span class="tmrp-pill">' + esc(rightSocialLocalizeText(x)) + '</span>'; }).join('');
    return '<section class="tmrp-card ' + (/活跃|active/i.test(String(status)) ? 'hot' : '') + '"><div class="tmrp-card-title"><span>' + esc(p.name || p.label || p.id || '未名党派') + rightPartyStandingTag(p) + '</span><small>' + esc(rightSocialLocalizeText(status)) + ' · 影响 ' + esc(Math.round(inf)) + '</small></div>' +
      rightArmyBar('影响', inf) +
      rightArmyRows([['首领', p.leader || p.head], ['立场', rightSocialLocalizeText(p.ideology || p.stance)], ['支持群体', rightSocialLocalizeText(p.base || p.supportBase)], ['核心成员', rightSocialLocalizeText(p.members)], ['当前议程', rightSocialBriefText(p.currentAgenda || p.agenda)], ['短期目标', rightSocialBriefText(p.shortGoal)], ['长期追求', rightSocialBriefText(p.longGoal)]]) +
      rightPartyRelChips(p) +
      rightPartyLedgerRows(p) +
      renderRightSocialCauses('party', p) +
      renderRightSocialEcology('party', p) +
      renderRightSocialChain('party', p) +
      renderRightActorActions('party', p) +
      renderRightSocialActions('party', p) +
      '<div class="tmrp-chip-list">' + stanceHtml + '</div></section>';
  }

  function renderRightPartyPanel(){
    var rows = getParties();
    var active = rows.filter(function(p){ return /活跃|active/i.test(String(p.status || p.state || '')); }).length;
    var maxInf = rows.reduce(function(m, p){ return Math.max(m, rightSocNum(p, ['influence','power','weight'], 0)); }, 0);
    var summary = '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(rows.length) + '</b><span>党派</span></div><div class="tmrp-stat"><b>' + esc(active) + '</b><span>活跃</span></div><div class="tmrp-stat"><b>' + esc(maxInf) + '</b><span>最高影响</span></div></div>';
    if (!rows.length) return summary + '<section class="tmrp-card empty"><div class="tmrp-empty">暂无党派数据。</div></section>';
    return summary + '<div class="tmrp-meta">点某行·左侧展开近账、生态关系与行动链</div><div class="tmrp-scroll tall">' + rows.map(rightSocialPartyHead).join('') + '</div>';
  }

  // 百官空态·幽灵预览：取数名真实臣僚灰显作示例（让玩家看懂钉选后长什么样·非死白）
  //>>P8RAIL-SPLIT24-BODY-END
  // ── forward 回填：本片社会层/阶层党派成员 → bucket(origin 委托 shim 调用期解析) ──
  __p8R.renderGangRich = renderGangRich; __p8R.renderPartyClassDebug = renderPartyClassDebug; __p8R.rightClassCharacterDelegateName = rightClassCharacterDelegateName; __p8R.rightFindSocialRow = rightFindSocialRow; __p8R.rightPcCopyDiagnostics = rightPcCopyDiagnostics;
  __p8R.rightSocGM = rightSocGM; __p8R.rightSocialBriefText = rightSocialBriefText; __p8R.rightSocialClassDetail = rightSocialClassDetail; __p8R.rightSocialLocalizeText = rightSocialLocalizeText; __p8R.rightSocialName = rightSocialName;
  __p8R.rightSocialNearCauses = rightSocialNearCauses; __p8R.rightSocialPartyDetail = rightSocialPartyDetail; __p8R.rightSocialSameName = rightSocialSameName;
})();

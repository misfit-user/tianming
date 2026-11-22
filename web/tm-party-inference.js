// ============================================================
//  tm-party-inference.js — 党派/阶层演绎层（批乙·2026-07-22·AI 主导）
//
//  owner 宪法：「实体化≠模板化——身份与行为必须 AI 演绎·确定性只配兜底账本」。
//  党派此前是纯数值傀儡：partyDynamics(helpers §perturn·seq25) 每回合只产一句描述串进
//  GM._partyDynamics·唯一消费=prompt 叙事段·零数值后果。本层照旧民变演绎层（tm-revolt-inference.js，11-21 删）范式
//  把党派升成一等演员——AI 为各党立身份(纲领/处世/图谋/底线)、逐回合决断自主行动。
//
//  两条 AI 通道（皆随 partyInferenceEnabled 默认 ON·AI 缺席时确定性模板兜底=双轨）：
//  A. forgeIdentity(惰性·tick 内一次)：为无 _identity 的活跃党批量锻身份；顺带为活跃阶层锻
//     轻装身份 cls._identity({creed,voice})——阶层动作从模板句升为有立场口吻(消费在 actors)。
//  B. tickInference(每回合一次·post-turn job partyInference·幂等戳 _partyInferTurn)：各党作为
//     一等演员由 AI 决断本回合 0-2 个动作(联名/清议/杯葛/结盟交恶/议程转向/倒阁施压/煽动阶层)。
//
//  宪法闸（本层唯一硬码职责·只验不产·_applyActions 独立导出供 smoke 直验）：
//   · 所有 cohesion/influence delta 硬夹 ±15(对齐校准器)·各动作另有更紧的专项闸(清议±6/杯葛±5)
//   · 党魁变更一律拒(党魁演变归既有 partyDynamics/廷议系统)
//   · standing 只从 officeCount 派生·本层绝不直设(未注册的 set_standing 类动作静默拒+计数)
//   · 联名 cosigners 须全在世在册(≤5)·煽动必经 ClassMinxinBridge.applyClassPressure(satDelta±4)
//   · 单党单回合动作 ≤2·全局单回合 ≤10
//  兜底双轨：flag 关或 AI 缺席→零行为(partyDynamics 确定性检测+party-class-actors 阈值动作本就
//   零 AI 继续跑·演绎层纯叠加)。演绎产出不回写 GM._partyDynamics(那是确定性信号源)·prompt 独立构造。
//  本文件为 GM.memorials/partyState.historyLog/currentAgenda 等的写口(已登记 gm-writes owners)。
// ============================================================
(function (global) {
  'use strict';

  var MAX_ACTIONS_PER_PARTY = 2;   // 单党单回合动作封顶
  var MAX_ACTIONS_GLOBAL = 10;     // 全局单回合动作封顶
  var COH_INF_CAP = 15;            // cohesion/influence delta 硬夹(对齐校准器 ±15)
  var PROPAGANDA_CAP = 6;          // 清议造势 influence delta 闸
  var OBSTRUCT_CAP = 5;            // 杯葛掣肘 cohesion/influence 对冲闸
  var INCITE_SAT_CAP = 4;          // 煽动阶层 satisfactionDelta 闸
  var MAX_COSIGNERS = 5;           // 联名署名封顶
  var MAX_PARTIES_PER_TURN = 8;    // 每回合进 forge/tick 的党数封顶(按 influence 降序·余党下回合自然轮动)
  var MEMORIAL_PENDING_CAP = 12;   // 奏疏总闸·pending 奏疏≥此则党派联名让位常规奏疏(玩家批红队列保护)
  var DEAD_STATUS_RE = /湮灭|解散|dissolved|消亡/;

  function _clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }
  function _clampDelta(v, cap) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return Math.max(-cap, Math.min(cap, v));
  }
  function _uid() {
    try { if (typeof global.uid === 'function') return global.uid(); } catch (_) {}
    return 'pinf-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }
  function _eb(msg) {
    try { if (typeof global.addEB === 'function') global.addEB('党争', msg); } catch (_) {}
  }
  function _chron(G, text) {
    try {
      if (!Array.isArray(G._chronicle)) G._chronicle = [];
      G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || '', type: '党争', text: text, tags: ['党派', 'AI演绎'] });
    } catch (_) {}
  }
  function _aiOn() {
    try { return typeof global.callAI === 'function'; } catch (_) { return false; }
  }
  function enabled() {
    try { return !(global.P && global.P.conf && global.P.conf.partyInferenceEnabled === false); }
    catch (_) { return false; }
  }

  // ── 活跃集合 ──────────────────────────────────────────────
  function activeParties(G) {
    return (G.parties || []).filter(function (p) {
      if (!p || !p.name) return false;
      if (p.mergedWith || p.disposedTurn) return false;
      return !DEAD_STATUS_RE.test(String(p.status || ''));
    });
  }
  function activeClasses(G) {
    return (G.classes || []).filter(function (c) { return c && c.name; });
  }
  // 党数封顶：按 influence 降序取 top MAX_PARTIES_PER_TURN 进 forge/tick(prompt 膨胀+成本护栏)·
  // 截断时函数内 log 计数·未入选党下回合仍有机会(按 influence 自然轮动)。
  function activePartiesCapped(G) {
    var list = activeParties(G).slice().sort(function (a, b) {
      return (Number(b.influence) || 0) - (Number(a.influence) || 0);
    });
    if (list.length > MAX_PARTIES_PER_TURN) {
      try { if (typeof console !== 'undefined' && console.log) console.log('[party-inference] 活跃党 ' + list.length + ' > 封顶 ' + MAX_PARTIES_PER_TURN + '·本回合取 influence top' + MAX_PARTIES_PER_TURN + '·余 ' + (list.length - MAX_PARTIES_PER_TURN) + ' 党下回合轮动'); } catch (_) {}
      list = list.slice(0, MAX_PARTIES_PER_TURN);
    }
    return list;
  }
  // pending 奏疏数(玩家批红队列)：非 reviewed 且未落定(镜像校准器 snapshotPlayerOperations 口径)
  function _pendingMemorialCount(G) {
    return (Array.isArray(G.memorials) ? G.memorials : []).filter(function (m) {
      if (!m) return false;
      if (m.reviewed === true) return false;
      return !/resolved|closed|done|rejected|approved/i.test(String(m.status || ''));
    }).length;
  }
  function _partyByName(G, name) {
    name = String(name || '').trim();
    if (!name) return null;
    var list = G.parties || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].name === name) return list[i];
    return null;
  }
  function _classByName(G, name) {
    name = String(name || '').trim();
    if (!name) return null;
    var list = G.classes || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || !c.name) continue;
      if (c.name === name || c.name.indexOf(name) >= 0 || name.indexOf(c.name) >= 0) return c;
    }
    return null;
  }
  function _livingChar(G, name) {
    name = String(name || '').trim();
    if (!name) return null;
    var list = G.chars || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c && c.name === name && c.alive !== false) return c;
    }
    return null;
  }

  // ── partyState 台账口（本层写口·gm-writes owners 登记）────────
  function _ensurePS(G, name) {
    if (!G.partyState || typeof G.partyState !== 'object' || Array.isArray(G.partyState)) G.partyState = {};
    var ps = G.partyState[name];
    if (!ps || typeof ps !== 'object') {
      ps = { influence: 0, cohesion: 0, alliedWith: [], conflictWith: [], officeCount: 0, historyLog: [] };
      G.partyState[name] = ps;
    }
    if (!Array.isArray(ps.historyLog)) ps.historyLog = [];
    if (!Array.isArray(ps.alliedWith)) ps.alliedWith = [];
    if (!Array.isArray(ps.conflictWith)) ps.conflictWith = [];
    return ps;
  }
  function _psLog(G, name, entry) {
    var ps = _ensurePS(G, name);
    ps.historyLog.push(entry);
    if (ps.historyLog.length > 20) ps.historyLog = ps.historyLog.slice(-20);
  }
  function _addRel(G, name, field, other) {
    var ps = _ensurePS(G, name);
    if (!Array.isArray(ps[field])) ps[field] = [];
    if (other && ps[field].indexOf(other) < 0) ps[field].push(other);
  }
  function _removeRel(G, name, field, other) {
    var ps = _ensurePS(G, name);
    if (Array.isArray(ps[field])) ps[field] = ps[field].filter(function (x) { return x !== other; });
  }
  // 数值动量·硬夹 ±COH_INF_CAP·双写回 partyState(镜像 three-systems 双写范式)
  function _applyPartyNum(G, party, field, delta) {
    delta = _clampDelta(delta, COH_INF_CAP);
    if (!delta) return 0;
    var cur = Number(party[field]);
    if (!isFinite(cur)) cur = 50;
    party[field] = Math.round(_clamp(cur + delta, 0, 100) * 100) / 100;
    var ps = _ensurePS(G, party.name);
    ps[field] = party[field];
    return delta;
  }
  // 党魁/核心党人记忆(重大动作·喂 hearts)
  function _partyMemory(G, party, text, emo, imp) {
    try {
      if (typeof global.NpcMemorySystem === 'undefined' || !global.NpcMemorySystem.remember) return;
      var leader = party.leader || party.head;
      if (!leader) return;
      global.NpcMemorySystem.remember(leader, text, emo || '虑', imp || 5, '党争', { type: 'political' });
    } catch (_) {}
  }

  // ── subcall A·锻身份（惰性·tick 内一次·党魁真人已由 canonical 写口保证）────────
  function _templatePartyIdentity(party) {
    var ideo = String(party.ideology || '').trim();
    var coh = Number(party.cohesion);
    if (!isFinite(coh)) coh = 50;
    party._identity = {
      creed: (ideo || '匡扶社稷·各安其分').slice(0, 40),
      stance: (coh >= 65 ? '持重守正' : (coh <= 35 ? '骑墙观望' : '因势周旋')),
      agenda: String(party.currentAgenda || '稳固党势').slice(0, 30),
      redlines: '不容异党专朝·护党人进退',
      _identityFallback: true
    };
    return party._identity;
  }
  function _templateClassIdentity(cls) {
    var demand = '';
    try {
      var d = cls.demands || cls.currentDemand || cls.currentAgenda || cls.shortGoal;
      demand = Array.isArray(d) ? String(d[0] || '') : String(d || '');
    } catch (_) {}
    cls._identity = {
      creed: (demand || (String(cls.name || '') + '·各安生业')).slice(0, 30),
      voice: '恳切陈情',
      _identityFallback: true
    };
    return cls._identity;
  }
  function _forgeTemplates(G) {
    // 确定性兜底（AI 缺席/失败）：为无 _identity 的活跃党/阶层拼保守身份·标 _identityFallback
    var np = 0, nc = 0;
    activeParties(G).forEach(function (p) { if (!p._identity) { _templatePartyIdentity(p); np++; } });
    activeClasses(G).forEach(function (c) { if (!c._identity) { _templateClassIdentity(c); nc++; } });
    return { parties: np, classes: nc, fallback: true };
  }
  function _buildForgePrompt(G, parties, classes) {
    var lines = ['你是天命推演引擎的党争演绎官。' + (G.eraName || '') + '·朝局汹汹——须为下列党派/阶层立真身份(纲领要能号召·处世要合其性情·底线要像史书里的立身之本·禁「XX党」式空模板)。'];
    if (parties.length) {
      lines.push('【党派】');
      parties.forEach(function (p) {
        var ps = (G.partyState && G.partyState[p.name]) || {};
        var hist = (Array.isArray(p.agenda_history) ? p.agenda_history.slice(-2) : []).map(function (h) { return h && h.agenda; }).filter(Boolean).join('→');
        var base = [];
        (Array.isArray(p.socialBase) ? p.socialBase : [p.socialBase]).forEach(function (b) {
          if (!b) return; base.push((typeof b === 'object') ? (b.name || b.className || '') : String(b));
        });
        lines.push('- 「' + p.name + '」ideology「' + (p.ideology || '?') + '」·党魁' + (p.leader || '?')
          + '·社会基础[' + (base.filter(Boolean).join('/') || '?') + ']·朝位' + (ps.standing || p.standing || '?')
          + '·近期议程[' + (hist || p.currentAgenda || '?') + ']');
      });
    }
    if (classes.length) {
      lines.push('【阶层】');
      classes.forEach(function (c) {
        var d = c.demands || c.currentDemand || c.shortGoal || '';
        lines.push('- 「' + c.name + '」诉求「' + (Array.isArray(d) ? d.join('·') : String(d || '?')) + '」');
      });
    }
    lines.push('只返回 JSON：{"parties":[{"name":"党名","creed":"纲领≤40字","stance":"处世≤12字","agenda":"当下图谋≤30字","redlines":"底线≤30字"}],"classes":[{"name":"阶层名","creed":"本位诉求口号≤30字","voice":"代言风格≤12字"}]}');
    return lines.join('\n');
  }
  async function forgeIdentity(G) {
    G = G || global.GM;
    if (!G || !enabled()) return null;   // flag OFF 全截·公开口入口·OFF 时不锻不写 _identity
    var parties = activePartiesCapped(G).filter(function (p) { return !p._identity; });   // 党数封顶随此 cap
    var classes = activeClasses(G).filter(function (c) { return !c._identity; });
    if (!parties.length && !classes.length) return { parties: 0, classes: 0 };
    if (!_aiOn()) return _forgeTemplates(G);
    try {
      var resp = await global.callAI(_buildForgePrompt(G, parties, classes), 900,
        null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'party-identity' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      var pd = (j && Array.isArray(j.parties)) ? j.parties : [];
      var cd = (j && Array.isArray(j.classes)) ? j.classes : [];
      var pmap = {}; pd.forEach(function (x) { if (x && x.name) pmap[String(x.name).trim()] = x; });
      var cmap = {}; cd.forEach(function (x) { if (x && x.name) cmap[String(x.name).trim()] = x; });
      var np = 0, nc = 0;
      parties.forEach(function (p) {
        var x = pmap[p.name];
        if (x && (x.creed || x.agenda)) {
          p._identity = {
            creed: String(x.creed || '').slice(0, 40), stance: String(x.stance || '').slice(0, 14),
            agenda: String(x.agenda || '').slice(0, 30), redlines: String(x.redlines || '').slice(0, 30)
          };
          np++;
        } else { _templatePartyIdentity(p); }  // 该党 AI 未覆盖→模板兜底
      });
      classes.forEach(function (c) {
        var x = cmap[c.name] || cmap[String(c.name).trim()];
        if (!x) { Object.keys(cmap).forEach(function (k) { if (!x && (k.indexOf(c.name) >= 0 || c.name.indexOf(k) >= 0)) x = cmap[k]; }); }
        if (x && (x.creed || x.voice)) {
          c._identity = { creed: String(x.creed || '').slice(0, 30), voice: String(x.voice || '').slice(0, 12) };
          nc++;
        } else { _templateClassIdentity(c); }
      });
      if (np || nc) _eb('党争演绎官为 ' + np + ' 党' + (nc ? '、' + nc + ' 阶层' : '') + '立身份');
      return { parties: np, classes: nc };
    } catch (_eF) {
      return _forgeTemplates(G);  // AI 失败→模板兜底(双轨)
    }
  }

  // ── subcall B·逐回合党派行为（AI 决断·宪法闸落账）────────────────
  function _edictDigest(G) {
    var out = [];
    (Array.isArray(G._edictTracker) ? G._edictTracker.slice(-6) : []).forEach(function (e) {
      var t = String((e && (e.content || e.text || e.title)) || '');
      if (t) out.push(t.slice(0, 60));
    });
    return out;
  }
  function _buildTickPrompt(G, parties) {
    var lines = ['你是天命推演引擎的党争演绎官。朝堂之上党争激荡·以下各党皆是活的政治势力——你为每党决断本回合作为(宁少勿滥·每党 0-2 个动作)。',
      '【朝局】回合T' + (G.turn || 0) + '·' + (G.eraName || '') + '·皇威' + ((G.huangwei && G.huangwei.index) || '?') + '·皇权' + ((G.huangquan && G.huangquan.index) || '?')];
    parties.forEach(function (p, i) {
      var idy = p._identity || {};
      var ps = (G.partyState && G.partyState[p.name]) || {};
      lines.push('【党' + (i + 1) + '·' + p.name + '】纲领「' + (idy.creed || '?') + '」·处世「' + (idy.stance || '?') + '」·图谋「' + (idy.agenda || '?') + '」·底线「' + (idy.redlines || '?') + '」'
        + '·影响' + (Number(p.influence) || '?') + '·内聚' + (Number(p.cohesion) || '?') + '·朝位' + (ps.standing || p.standing || '?') + '·占官' + (ps.officeCount || 0)
        + (ps.alliedWith && ps.alliedWith.length ? '·盟[' + ps.alliedWith.join('/') + ']' : '') + (ps.conflictWith && ps.conflictWith.length ? '·仇[' + ps.conflictWith.join('/') + ']' : '')
        + '·当下议程「' + (p.currentAgenda || '?') + '」');
    });
    var dyn = (Array.isArray(G._partyDynamics) ? G._partyDynamics : []).map(function (d) { return d && d.desc; }).filter(Boolean);
    if (dyn.length) lines.push('【确定性内情(作证据·勿照抄)】' + dyn.join('｜'));
    var eds = _edictDigest(G);
    if (eds.length) lines.push('【本回合诏旨/廷议概要】' + eds.join('｜'));
    lines.push('【可用动作】joint_memorial(cosigners=联名者姓名数组≤5·title/content=奏疏)·propaganda(influenceDelta=清议造势≤±6)·'
      + 'obstruct(target=杯葛的党)·ally(target=结盟的党)·rupture(target=交恶的党)·agenda_shift(newAgenda=议程转向)·'
      + 'press(target=倒阁矛头·outcome=win|lose)·incite(target=煽动的阶层·satisfactionDelta=≤±4)。');
    lines.push('【铁则】联名须实有其人且在世；杯葛/结盟/交恶的对象须在党册；煽动只能撼动阶层情绪(经民心桥)·不得径改数值；'
      + '党魁更替、朝位升降不由你定(归廷议/官制)；行动须合乎各党纲领处世。');
    lines.push('只返回 JSON：{"parties":[{"name":"党名","narrative":"本回合作为叙事≤50字","actions":[{"type":"...","target":"","cosigners":[],"title":"","content":"","newAgenda":"","influenceDelta":0,"satisfactionDelta":0,"outcome":"","reason":""}]}]}');
    return lines.join('\n');
  }

  // 动作落账（独立导出·smoke 不经真 AI 直验宪法闸）
  function _applyActions(G, parsed) {
    if (!parsed || !Array.isArray(parsed.parties)) return { applied: 0, blocked: 0 };
    var turn = G.turn || 0, applied = 0, blocked = 0;

    parsed.parties.forEach(function (pp) {
      var party = pp && _partyByName(G, pp.name);
      if (!party) return;  // 不在党册·整条跳过
      if (pp.narrative) _chron(G, '「' + party.name + '」' + String(pp.narrative).slice(0, 60));
      var acts = Array.isArray(pp.actions) ? pp.actions.slice(0, MAX_ACTIONS_PER_PARTY) : [];  // 单党≤2
      acts.forEach(function (act) {
        if (applied >= MAX_ACTIONS_GLOBAL) { blocked++; return; }  // 全局≤10
        if (!act || !act.type) { blocked++; return; }
        try {
          switch (String(act.type)) {
            case 'joint_memorial': {
              // 奏疏总闸：玩家批红队列保护·pending 奏疏≥MEMORIAL_PENDING_CAP 则党派联名让位常规奏疏(转 blocked·不落疏)
              if (_pendingMemorialCount(G) >= MEMORIAL_PENDING_CAP) { blocked++; return; }
              // 宪法闸：cosigners 须全在世在册(≤5)
              var raw = Array.isArray(act.cosigners) ? act.cosigners.slice(0, MAX_COSIGNERS) : [];
              if (!raw.length) { blocked++; return; }
              var resolved = [], ok = true;
              raw.forEach(function (nm) { var c = _livingChar(G, nm); if (!c) ok = false; else resolved.push(c.name); });
              if (!ok || !resolved.length) { blocked++; _eb('「' + party.name + '」联名流产·有署名者已不在朝'); return; }
              if (!Array.isArray(G.memorials)) G.memorials = [];
              var lead = _livingChar(G, party.leader);
              var from = (lead && lead.name) || resolved[0] || party.name;
              G.memorials.push({
                id: _uid(), from: from, title: String(act.title || (party.name + '联名奏')).slice(0, 40),
                type: '政务', content: String(act.content || act.agenda || act.reason || '').slice(0, 300),
                status: 'pending', turn: turn, reply: '', cosigners: resolved, _partyInference: party.name
              });
              _eb('「' + party.name + '」' + from + '率 ' + resolved.length + ' 人联名上书' + (act.title ? '·' + String(act.title).slice(0, 20) : ''));
              _partyMemory(G, party, '吾党联名抗疏·' + String(act.title || act.agenda || '陈情于阙').slice(0, 24), '决', 6);
              applied++; return;
            }
            case 'propaganda': {
              var d = _clampDelta(Number(act.influenceDelta != null ? act.influenceDelta : act.delta), PROPAGANDA_CAP);
              if (!d) { blocked++; return; }
              _applyPartyNum(G, party, 'influence', d);
              _psLog(G, party.name, { turn: turn, type: 'propaganda', reason: String(act.reason || act.agenda || '清议造势').slice(0, 60), influenceDelta: d });
              _eb('「' + party.name + '」清议造势·影响' + (d > 0 ? '+' : '') + d);
              applied++; return;
            }
            case 'obstruct': {
              var t = _partyByName(G, act.target);
              if (!t || t === party) { blocked++; return; }
              _addRel(G, party.name, 'conflictWith', t.name);
              _addRel(G, t.name, 'conflictWith', party.name);
              _applyPartyNum(G, party, 'cohesion', _clampDelta(Number(act.cohesionDelta != null ? act.cohesionDelta : -3), OBSTRUCT_CAP));
              _applyPartyNum(G, t, 'influence', -Math.abs(_clampDelta(Number(act.influenceDelta != null ? act.influenceDelta : -3), OBSTRUCT_CAP)));
              _psLog(G, party.name, { turn: turn, type: 'obstruct', target: t.name, reason: String(act.reason || '杯葛掣肘').slice(0, 60) });
              _eb('「' + party.name + '」杯葛「' + t.name + '」·掣肘朝议');
              applied++; return;
            }
            case 'ally': {
              var ta = _partyByName(G, act.target);
              if (!ta || ta === party) { blocked++; return; }
              _addRel(G, party.name, 'alliedWith', ta.name);
              _addRel(G, ta.name, 'alliedWith', party.name);
              _removeRel(G, party.name, 'conflictWith', ta.name);
              _removeRel(G, ta.name, 'conflictWith', party.name);
              _psLog(G, party.name, { turn: turn, type: 'ally', target: ta.name, reason: String(act.reason || '结盟').slice(0, 60) });
              _eb('「' + party.name + '」与「' + ta.name + '」缔盟·共进退');
              _partyMemory(G, party, '与「' + ta.name + '」结盟·同气连枝', '喜', 5);
              applied++; return;
            }
            case 'rupture': {
              var tr = _partyByName(G, act.target);
              if (!tr || tr === party) { blocked++; return; }
              _addRel(G, party.name, 'conflictWith', tr.name);
              _addRel(G, tr.name, 'conflictWith', party.name);
              _removeRel(G, party.name, 'alliedWith', tr.name);
              _removeRel(G, tr.name, 'alliedWith', party.name);
              _psLog(G, party.name, { turn: turn, type: 'rupture', target: tr.name, reason: String(act.reason || '交恶').slice(0, 60) });
              _eb('「' + party.name + '」与「' + tr.name + '」交恶·反目成仇');
              _partyMemory(G, party, '与「' + tr.name + '」决裂·势不两立', '怒', 5);
              applied++; return;
            }
            case 'agenda_shift': {
              // 镜像 apply:1595 既有落账器语义(currentAgenda + agenda_history)
              var na = String(act.newAgenda || act.agenda || '').slice(0, 40);
              if (!na) { blocked++; return; }
              var old = party.currentAgenda || '';
              party.currentAgenda = na;
              if (!Array.isArray(party.agenda_history)) party.agenda_history = [];
              party.agenda_history.push({ turn: turn, agenda: na, outcome: String(act.reason || '议程转向').slice(0, 60), prev: old });
              if (party.agenda_history.length > 20) party.agenda_history = party.agenda_history.slice(-20);
              _eb('「' + party.name + '」议程转向「' + na + '」' + (act.reason ? '（' + String(act.reason).slice(0, 30) + '）' : ''));
              applied++; return;
            }
            case 'press': {
              // 只落 historyLog + recentPolicy 账 + 一条党魁记忆·倒阁实效由 officeCount 齿轮自然发生·不改官职
              var win = act.outcome === 'win' || act.win === true;
              var ps = _ensurePS(G, party.name);
              if (win) ps.recentPolicyWin = (Number(ps.recentPolicyWin) || 0) + 1;
              else ps.recentPolicyLose = (Number(ps.recentPolicyLose) || 0) + 1;
              _psLog(G, party.name, { turn: turn, type: 'press', target: String(act.target || '').slice(0, 40), outcome: win ? 'win' : 'lose', reason: String(act.reason || '倒阁施压').slice(0, 60) });
              _partyMemory(G, party, '吾党廷争倒阁·' + (win ? '占上风' : '受挫') + (act.target ? '·矛头指' + String(act.target).slice(0, 16) : ''), win ? '喜' : '怒', 6);
              _eb('「' + party.name + '」施压倒阁' + (act.target ? '·矛头指「' + act.target + '」' : '') + '·' + (win ? '得势' : '未逞'));
              applied++; return;
            }
            case 'incite': {
              // 宪法闸：必经 ClassMinxinBridge.applyClassPressure·绝不直写 minxin/satisfaction·satDelta ±4
              var Bridge = global.TM && global.TM.ClassMinxinBridge;
              if (!Bridge || typeof Bridge.applyClassPressure !== 'function') { blocked++; return; }
              var cls = _classByName(G, act.target);
              if (!cls) { blocked++; return; }
              var sd = _clampDelta(Number(act.satisfactionDelta != null ? act.satisfactionDelta : act.delta), INCITE_SAT_CAP);
              if (!sd) { blocked++; return; }
              Bridge.applyClassPressure(G, {
                turn: turn,
                sourceSystem: 'party-inference-incite',
                sourceId: ['party-incite', turn, party.name, cls.name || act.target].join('|'),
                className: cls.name || String(act.target),
                satisfactionDelta: sd,
                linkedIssue: String(act.linkedIssue || ''),
                reason: String(act.reason || (party.name + '煽动' + (cls.name || act.target))).slice(0, 80)
              });
              _psLog(G, party.name, { turn: turn, type: 'incite', target: cls.name || String(act.target), satisfactionDelta: sd });
              _eb('「' + party.name + '」煽动「' + (cls.name || act.target) + '」·情绪' + (sd > 0 ? '+' : '') + sd);
              applied++; return;
            }
            default: blocked++;  // 未注册动作(含 set_leader/set_standing 等越权)静默拒+计数
          }
        } catch (_eA) { blocked++; }
      });
    });
    return { applied: applied, blocked: blocked };
  }

  async function tickInference(G) {
    G = G || global.GM;
    if (!G) return null;
    var turn = G.turn || 0;
    // 幂等闸下沉·所有入口(pipeline/job/外部直调)共用同一闸·先查后置(与 _revoltInferTurn 同范式)
    if (G._partyInferTurn === turn) return null;
    if (!enabled() || !_aiOn()) return null;
    var parties = activePartiesCapped(G);   // 党数封顶·top influence
    if (!parties.length) return null;
    G._partyInferTurn = turn;   // arch-ok 党派演绎回合戳·先查后置
    try {
      await forgeIdentity(G);  // 惰性锻身份(无 _identity 的活跃党/阶层一次·随党数封顶)
    } catch (_eI) {}
    try {
      var resp = await global.callAI(_buildTickPrompt(G, parties), 1600,
        null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'party-inference' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      return _applyActions(G, j);
    } catch (_eT) { return null; }
  }

  // 每回合调此口：排逐回合演绎(post-turn job·幂等回合戳·与 revoltInference 同范式)
  function schedule(G) {
    G = G || global.GM;
    if (!enabled() || !G) return;
    if (!_aiOn()) return;                      // 无 AI→零行为(确定性层继续跑·双轨兜底)
    var turn = G.turn || 0;
    if (G._partyInferTurn === turn) return;     // 省调用优化(权威幂等闸在 tickInference·所有入口共用)
    if (!activeParties(G).length) return;
    var job = function () { return tickInference(G); };  // 幂等戳由 tickInference 先查后置
    if (typeof global._enqueuePostTurnJob === 'function') global._enqueuePostTurnJob('partyInference', job);
    else job();
  }
  function aiOn() { return _aiOn(); }

  var API = {
    schedule: schedule, forgeIdentity: forgeIdentity, tickInference: tickInference,
    _applyActions: _applyActions, _forgeTemplates: _forgeTemplates, enabled: enabled, aiOn: aiOn,
    activeParties: activeParties, activeClasses: activeClasses, activePartiesCapped: activePartiesCapped,
    MAX_ACTIONS_PER_PARTY: MAX_ACTIONS_PER_PARTY, MAX_ACTIONS_GLOBAL: MAX_ACTIONS_GLOBAL,
    MAX_PARTIES_PER_TURN: MAX_PARTIES_PER_TURN, MEMORIAL_PENDING_CAP: MEMORIAL_PENDING_CAP
  };
  global.TM = global.TM || {};
  global.TM.PartyInference = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  // 结算管线注册：晚序(92·partyDynamics=25 已产 GM._partyDynamics 证据·revoltEntity=90 之后)·
  // 管线缺席(裸跑/smoke)→静默·smoke 直调 _applyActions/forgeIdentity
  try {
    if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
      global.SettlementPipeline.register('partyInference', '党派演绎', function () {
        try { schedule(global.GM); } catch (_eS) {}
      }, 92, 'perturn');
    }
  } catch (_eR) {}
})(typeof window !== 'undefined' ? window : globalThis);

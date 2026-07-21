// ============================================================
//  tm-revolt-inference.js — 民变演绎层（批三·2026-07-21·AI 主导）
//
//  owner 重批(2026-07-21)落地：「实体化≠模板化——身份与行为必须 AI 演绎·确定性只配兜底账本」。
//  owner 三拍板：①起号立领袖=专门轻量 subcall ②建国时机交 AI（宪法只记账）③确定性层降级保双轨。
//
//  两个 subcall（皆随 revoltEntityEnabled·AI 缺席时镜像层模板兜底=双轨）：
//  A. forgeIdentity(具象化时一次)：AI 起真旗号·立有名有姓的渠帅（优先从在档不满人物揭竿）·
//     定纲领/stance/agenda——民变从此是「人」不是模板棋子。
//  B. tickInference(每回合一次·post-turn job)：各股民变作为一等演员由 AI 决断——打哪/占哪/
//     裹挟/分裂/合流/僭号建国/如何应对朝廷招抚旨（读 GM._edictTracker 真旨全文·可讨价/诈许/
//     真受抚·不保成功·无独立 UI=owner 批三令）。
//
//  宪法闸（本层唯一硬码职责·只验不产）：占府须军至且兵力压过守备(防幻觉割地)·招抚须真有其旨
//  且帑廪真拿得出银(GM.guoku.balance·镜像 openGranary 支出范式)·裹挟每回合封顶 25%·股数封 5·
//  受抚真散伙·渠帅死亡仍只走裁决器。地图真改色=批四(数据层 occupiedBy+factionColors 本批就绪)。
//  本文件为 occupiedBy/_occupiedDivs/受抚落账等的写口(已登记 gm-writes owners)。
// ============================================================
(function (global) {
  'use strict';

  var MAX_STOCKS = 5;              // 在场股数封顶(防AI裂殖爆炸)
  var RECRUIT_CAP_RATIO = 0.25;    // 裹挟每回合封顶
  var REBEL_COLORS = ['#8b3a2e', '#7a5c2e', '#5c2e7a', '#2e6b5c', '#7a2e50'];  // 义军势力色池(按序取)

  function _eb(msg) {
    try { if (typeof global.addEB === 'function') global.addEB('民变', msg); } catch (_) {}
  }
  function _chron(G, text) {
    try {
      if (!Array.isArray(G._chronicle)) G._chronicle = [];
      G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || '', type: '民变', text: text, tags: ['民变', 'AI演绎'] });
    } catch (_) {}
  }
  function _aiOn() {
    try { return typeof global.callAI === 'function'; } catch (_) { return false; }
  }
  function enabled() {
    try { return !!(global.P && global.P.conf && global.P.conf.revoltEntityEnabled === true); }
    catch (_) { return false; }
  }
  function _fuzzyDiv(G, name) {
    try {
      var PU = global.TM && global.TM.AIChange && global.TM.AIChange.PathUtils;
      if (!PU || !name) return null;
      var fn = (typeof PU.findDivisionByNameFuzzy === 'function') ? PU.findDivisionByNameFuzzy
             : ((typeof PU.findDivisionByNameOrId === 'function') ? PU.findDivisionByNameOrId : null);
      return fn ? fn(G, name) : null;
    } catch (_) { return null; }
  }
  // 帑廪支出（镜像 GuokuEngine.Actions.openGranary 范式：balance 直扣+money.stock 同步·不足=false）
  function _spendSilver(G, amount, label) {
    amount = Math.max(0, Math.round(Number(amount) || 0));
    if (!amount) return false;
    try { if (typeof global.GuokuEngine !== 'undefined' && typeof global.GuokuEngine.ensureModel === 'function') global.GuokuEngine.ensureModel(); } catch (_) {}
    var g = G.guoku;
    if (!g || (Number(g.balance) || 0) < amount) return false;
    g.balance -= amount;
    try { if (g.ledgers && g.ledgers.money) g.ledgers.money.stock = g.balance; } catch (_) {}
    try { if (typeof global.addEB === 'function') global.addEB('朝代', label + '·帑出 ' + amount + ' 两'); } catch (_) {}
    return true;
  }
  function _ensureColor(G, facName) {
    try {
      if (!G.mapData) return;
      if (!G.mapData.factionColors) G.mapData.factionColors = {};
      if (!G.mapData.factionColors[facName]) {
        var used = Object.keys(G.mapData.factionColors).length;
        G.mapData.factionColors[facName] = REBEL_COLORS[used % REBEL_COLORS.length];
      }
    } catch (_) {}
  }
  function _stockOf(G, fac) {
    var rid = fac.sourceRevoltId;
    var revolts = (G.minxin && G.minxin.revolts) || [];
    var r = null;
    for (var i = 0; i < revolts.length; i++) if (revolts[i] && revolts[i].id === rid) { r = revolts[i]; break; }
    var army = null;
    for (var a = 0; a < (G.armies || []).length; a++) {
      var x = G.armies[a];
      if (x && x._revoltEntity && x.sourceRevoltId === rid && !x.disbanded) { army = x; break; }
    }
    var leader = null;
    for (var c = 0; c < (G.chars || []).length; c++) {
      var ch = G.chars[c];
      if (ch && ch.sourceRevoltId === rid && !ch._revoltDefeated) { leader = ch; break; }
    }
    return { fac: fac, r: r, army: army, leader: leader };
  }
  function _recentPacifyEdicts(G, stock) {
    var out = [];
    var tracker = Array.isArray(G._edictTracker) ? G._edictTracker.slice(-8) : [];
    var keys = [stock.fac.name, (stock.r && stock.r.region) || '', (stock.leader && stock.leader.name) || ''].filter(Boolean);
    tracker.forEach(function (e) {
      var t = String((e && (e.content || e.title)) || '');
      if (!t) return;
      if (t.indexOf('抚') < 0 && t.indexOf('招安') < 0) return;
      var hit = keys.some(function (k) { return k && t.indexOf(k) >= 0; });
      // 泛旨（「招抚流贼」不点名）也算·点名旨优先语义交给 AI 读原文
      if (hit || t.indexOf('流贼') >= 0 || t.indexOf('义军') >= 0 || t.indexOf('乱民') >= 0) out.push(t.slice(0, 120));
    });
    return out;
  }

  // ── subcall A·起号立领袖（具象化时一次·owner 拍板①）────────────────────────
  async function forgeIdentity(G, r) {
    if (!_aiOn()) return null;
    var localMx = '';
    try { localMx = String((G.minxin && G.minxin.trueIndex) || ''); } catch (_) {}
    var discontent = (G.chars || [])
      .filter(function (c) { return c && c.alive !== false && !c.isPlayer && !c._revoltEntity && (Number(c.loyalty) || 50) < 40; })
      .slice(0, 3)
      .map(function (c) { return c.name + '(' + (c.officialTitle || '在野') + '·忠诚' + (Number(c.loyalty) || 0) + ')'; });
    var prompt = '你是天命推演引擎的民变演绎官。' + (r.region || '某地') + '民乱已成燎原(' + (G.eraName || '') + '·当地民心约' + localMx + ')·须为这股民变立真身份。\n'
      + (discontent.length ? '在档心怀怨望者(可选其揭竿·亦可另立草莽新人)：' + discontent.join('·') + '\n' : '')
      + '要求：旗号须像真实史书里的名号(教门/年号/绰号皆可·2-6字·禁「XX义军」式模板)·渠帅要有名有姓·'
      + '纲领要能号召饥民。只返回 JSON：\n'
      + '{"banner":"旗号","leaderName":"渠帅姓名","leaderFrom":"existing|new","creed":"纲领≤20字","stance":"处世≤12字","agenda":"图谋≤20字"}';
    try {
      var resp = await global.callAI(prompt, 400, null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'revolt-identity' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      if (j && j.banner && j.leaderName) {
        r._identity = {
          banner: String(j.banner).slice(0, 10), leaderName: String(j.leaderName).slice(0, 12),
          leaderFrom: j.leaderFrom === 'existing' ? 'existing' : 'new',
          creed: String(j.creed || '').slice(0, 24), stance: String(j.stance || '').slice(0, 14), agenda: String(j.agenda || '').slice(0, 24)
        };
        delete r._identityPending;
        _eb((r.region || '某地') + '乱民推「' + r._identity.leaderName + '」为主·树「' + r._identity.banner + '」之旗·倡言「' + (r._identity.creed || '替天行道') + '」');
        return r._identity;
      }
    } catch (_eF) {}
    delete r._identityPending;  // 失败→镜像层下回合模板兜底(双轨)
    return null;
  }

  // ── subcall B·逐回合民变行为（AI 决断·宪法闸落账）───────────────────────────
  function _buildTickPrompt(G, stocks) {
    var lines = ['你是天命推演引擎的民变演绎官。天下汹汹·以下各股民变皆是活的势力——你为每股决断本回合作为。',
      '【天下大势】回合T' + (G.turn || 0) + '·' + (G.eraName || '') + '·朝廷皇威' + ((G.huangwei && G.huangwei.index) || '?') + '·皇权' + ((G.huangquan && G.huangquan.index) || '?') + '·全国民心' + ((G.minxin && G.minxin.trueIndex) || '?')];
    stocks.forEach(function (s, i) {
      var idy = (s.r && s.r._identity) || {};
      var occ = (s.fac._occupiedDivs || []).join('/') || '无';
      lines.push('【股' + (i + 1) + '·id=' + s.fac.sourceRevoltId + '】「' + s.fac.name + '」渠帅' + ((s.leader && s.leader.name) || '?')
        + '·纲领「' + (idy.creed || '?') + '」·stance「' + (idy.stance || '?') + '」·图谋「' + (idy.agenda || '?') + '」'
        + '·兵' + ((s.army && s.army.soldiers) || 0) + '·士气' + ((s.army && s.army.morale) || '?') + '·驻' + ((s.army && s.army.location) || '?')
        + '·已据：' + occ + '·声势级「' + (s.r ? (s.r.level || '?') : '?') + '」');
      var eds = _recentPacifyEdicts(G, s);
      if (eds.length) lines.push('  ↳朝廷近旨(与本股相关·据 stance/agenda 决定受抚/拒抚/讨价·亦可诈许)：' + eds.join('｜'));
    });
    lines.push('【可用动作】move(target=府县名)·occupy(target=府县名·须军已至且兵力足)·recruit(delta=裹挟人数)·'
      + 'split(banner/leaderName/creed/target=分裂新股)·merge(target=并入的股id)·proclaim(stateName=国号·僭号建国·时机自断)·'
      + 'pacify_accept(silverDemand=受抚索银·officeTitle=讨的官职)·pacify_refuse(reason)·pacify_counter(silverDemand/officeTitle=还价)。');
    lines.push('【铁则】没有朝廷招抚旨不得 pacify_*；占府会被引擎验兵力·虚占无效；裹挟有上限；行动须合乎各股纲领与处境·宁少勿滥(每股1-3个)。');
    lines.push('只返回 JSON：{"stocks":[{"id":"股id","narrative":"本回合作为叙事≤60字","actions":[{"type":"...","target":"","delta":0,"banner":"","leaderName":"","creed":"","silverDemand":0,"officeTitle":"","stateName":"","reason":""}]}]}');
    return lines.join('\n');
  }

  // 动作落账（独立导出·smoke 不经真 AI 直验宪法闸）
  function _applyActions(G, parsed) {
    if (!parsed || !Array.isArray(parsed.stocks)) return { applied: 0, blocked: 0 };
    var turn = G.turn || 0, applied = 0, blocked = 0;
    var stockList = (G.facs || []).filter(function (f) { return f && f._revoltEntity; }).map(function (f) { return _stockOf(G, f); });
    var byId = {};
    stockList.forEach(function (s) { byId[s.fac.sourceRevoltId] = s; });

    parsed.stocks.forEach(function (ps) {
      var s = ps && byId[ps.id];
      if (!s || !s.r || s.r.status !== 'ongoing') return;
      if (ps.narrative) _chron(G, '「' + s.fac.name + '」' + String(ps.narrative).slice(0, 80));
      (Array.isArray(ps.actions) ? ps.actions.slice(0, 3) : []).forEach(function (act) {
        if (!act || !act.type) return;
        try {
          switch (String(act.type)) {
            case 'move': {
              if (!s.army || s.army.disbanded) { blocked++; return; }
              var mdiv = _fuzzyDiv(G, act.target);
              var dest = (mdiv && mdiv.name) || String(act.target || '').slice(0, 20);
              if (!dest) { blocked++; return; }
              s.army.location = dest; s.army.garrison = dest; s.army.state = 'march';
              _eb('「' + s.fac.name + '」移师' + dest); applied++;
              return;
            }
            case 'occupy': {
              // 宪法闸：府在档+军已至+兵力压过守备(2×militaryRecruits+2000)·防 AI 幻觉割地
              var div = _fuzzyDiv(G, act.target);
              if (!div || !s.army || s.army.disbanded) { blocked++; return; }
              var at = String(s.army.location || '');
              var here = at && (at === div.name || at.indexOf(div.name) >= 0 || String(div.name).indexOf(at) >= 0);
              var need = 2 * (Number(div.militaryRecruits) || 2000) + 2000;
              if (!here || (s.army.soldiers || 0) < need) { blocked++; _eb('「' + s.fac.name + '」图占' + (div.name || act.target) + '而' + (!here ? '师未至' : '兵力不敌守备') + '·未逞'); return; }
              div.occupiedBy = s.fac.name; div._occupiedTurn = turn;
              if (!Array.isArray(s.fac._occupiedDivs)) s.fac._occupiedDivs = [];
              if (s.fac._occupiedDivs.indexOf(div.name) < 0) s.fac._occupiedDivs.push(div.name);
              _ensureColor(G, s.fac.name);
              _eb('★「' + s.fac.name + '」攻陷' + div.name + '·开仓散粮·设官置吏'); _chron(G, div.name + '陷于「' + s.fac.name + '」'); applied++;
              return;
            }
            case 'recruit': {
              if (!s.army || s.army.disbanded) { blocked++; return; }
              var cap = Math.round((s.army.soldiers || 0) * RECRUIT_CAP_RATIO);
              var d = Math.max(0, Math.min(Number(act.delta) || 0, cap));
              if (!d) { blocked++; return; }
              s.army.soldiers += d; s.army.size = s.army.soldiers; s.army.strength = s.army.soldiers;
              _eb('「' + s.fac.name + '」裹挟饥民 ' + d + ' 众'); applied++;
              return;
            }
            case 'split': {
              var ongoing = ((G.minxin && G.minxin.revolts) || []).filter(function (x) { return x && x.status === 'ongoing' && (x.level || 0) >= 3; });
              if (ongoing.length >= MAX_STOCKS) { blocked++; return; }
              var nr = {
                id: s.r.id + '_s' + turn, region: String(act.target || s.r.region || ''), status: 'ongoing',
                level: Math.max(3, (s.r.level || 3) - 1), turn: turn, leader: String(act.leaderName || ''), _aiBorn: true
              };
              if (act.banner) nr._identity = { banner: String(act.banner).slice(0, 10), leaderName: String(act.leaderName || '').slice(0, 12), leaderFrom: 'new', creed: String(act.creed || '').slice(0, 24), stance: '', agenda: '' };
              G.minxin.revolts.push(nr);
              _eb('「' + s.fac.name + '」分裂·' + (act.leaderName || '偏帅') + '自树「' + (act.banner || '别部') + '」之旗'); _chron(G, '「' + s.fac.name + '」裂为两股'); applied++;
              return;
            }
            case 'merge': {
              var t2 = byId[act.target];
              if (!t2 || t2 === s || !t2.r || t2.r.status !== 'ongoing') { blocked++; return; }
              if (s.army && t2.army && !t2.army.disbanded) { s.army.soldiers += (t2.army.soldiers || 0); s.army.size = s.army.soldiers; s.army.strength = s.army.soldiers; }
              t2.r.status = 'dispersed'; t2.r._mergedInto = s.r.id;  // 镜像层覆灭清账走既有路径
              _eb('「' + t2.fac.name + '」举众来投·并于「' + s.fac.name + '」麾下'); applied++;
              return;
            }
            case 'proclaim': {
              // owner 拍板②：建国时机交 AI·宪法只记账
              if (s.fac.isState) { blocked++; return; }
              s.fac.isState = true; s.fac.stateName = String(act.stateName || s.fac.name).slice(0, 8);
              if (s.leader) s.leader.officialTitle = '「' + s.fac.stateName + '」僭号之主';
              try { if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) global.AuthorityEngines.adjustHuangwei('lostVirtueRumor', -10, '「' + s.fac.stateName + '」僭号建国'); } catch (_) {}
              _eb('★★「' + s.fac.name + '」僭号建国·国号「' + s.fac.stateName + '」·' + ((s.leader && s.leader.name) || '渠帅') + '称制'); _chron(G, '「' + s.fac.stateName + '」僭号立·天下震骇'); applied++;
              return;
            }
            case 'pacify_accept': {
              // 宪法闸：真有其旨才可受抚·帑廪真拿得出银才成局
              if (!_recentPacifyEdicts(G, s).length) { blocked++; return; }
              var ask = Math.max(0, Math.round(Number(act.silverDemand) || ((s.r.level || 3) * 100000)));
              if (ask > 0 && !_spendSilver(G, ask, '招抚「' + s.fac.name + '」')) {
                _eb('「' + s.fac.name + '」许抚而帑廪不给·抚局遂败·其众复叛'); blocked++;
                return;
              }
              s.r.status = 'pacified';
              s.r._pacified = { turn: turn, silver: ask, officeTitle: String(act.officeTitle || '').slice(0, 16) };
              _eb('★「' + s.fac.name + '」受抚罢兵' + (ask ? '·得银 ' + ask + ' 两' : '') + (act.officeTitle ? '·' + ((s.leader && s.leader.name) || '渠帅') + '得授' + act.officeTitle : ''));
              _chron(G, '「' + s.fac.name + '」受抚·' + (s.r.region || '') + '兵revolt息'); applied++;
              return;
            }
            case 'pacify_refuse': {
              if (!_recentPacifyEdicts(G, s).length) { blocked++; return; }
              _eb('「' + s.fac.name + '」拒抚：' + String(act.reason || '不信朝廷').slice(0, 40)); applied++;
              return;
            }
            case 'pacify_counter': {
              if (!_recentPacifyEdicts(G, s).length) { blocked++; return; }
              _eb('「' + s.fac.name + '」讨价：索银 ' + (Number(act.silverDemand) || 0) + ' 两' + (act.officeTitle ? '·求授' + act.officeTitle : '') + '·抚局未定'); applied++;
              return;
            }
            default: blocked++;
          }
        } catch (_eA) { blocked++; }
      });
    });
    return { applied: applied, blocked: blocked };
  }

  async function tickInference(G) {
    G = G || global.GM;
    if (!enabled() || !_aiOn() || !G) return null;
    var stocks = (G.facs || []).filter(function (f) { return f && f._revoltEntity; }).map(function (f) { return _stockOf(G, f); })
      .filter(function (s) { return s.r && s.r.status === 'ongoing'; });
    if (!stocks.length) return null;
    try {
      var resp = await global.callAI(_buildTickPrompt(G, stocks), 1600, null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'revolt-inference' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      return _applyActions(G, j);
    } catch (_eT) { return null; }
  }

  // 镜像层每回合调此口：具象化前先派身份 subcall·实体在场则排逐回合演绎(post-turn job·autosave 后落也幂等)
  function schedule(G) {
    if (!enabled() || !G) return;
    var turn = G.turn || 0;
    // A·待具象化的新股→派身份锻造(一次·失败下回合镜像层模板兜底)
    try {
      ((G.minxin && G.minxin.revolts) || []).forEach(function (r) {
        if (!r || r.status !== 'ongoing' || (r.level || 0) < 3) return;
        if (r._identity || r._identityPending == null && !_aiOn()) return;
        var hasEntity = (G.facs || []).some(function (f) { return f && f._revoltEntity && f.sourceRevoltId === r.id; });
        if (hasEntity || r._identity) return;
        if (r._identityPending != null) return;  // 已在锻
        if (!_aiOn()) return;                    // 无 AI→镜像层直接模板兜底(双轨)
        r._identityPending = turn;
        var job = function () { return forgeIdentity(G, r); };
        if (typeof global._enqueuePostTurnJob === 'function') global._enqueuePostTurnJob('revoltIdentity_' + r.id, job);
        else job();
      });
    } catch (_eS) {}
    // B·逐回合行为演绎(每回合一次)
    try {
      if (!_aiOn()) return;
      if (G._revoltInferTurn === turn) return;
      var hasAny = (G.facs || []).some(function (f) { return f && f._revoltEntity; });
      if (!hasAny) return;
      G._revoltInferTurn = turn;  // arch-ok 民变演绎回合戳·幂等(与 _wtAuditTurn 同范式)
      var job2 = function () { return tickInference(G); };
      if (typeof global._enqueuePostTurnJob === 'function') global._enqueuePostTurnJob('revoltInference', job2);
      else job2();
    } catch (_eB) {}
  }

  var API = { schedule: schedule, forgeIdentity: forgeIdentity, tickInference: tickInference, _applyActions: _applyActions, _recentPacifyEdicts: _recentPacifyEdicts, _spendSilver: _spendSilver, enabled: enabled, MAX_STOCKS: MAX_STOCKS };
  global.TM = global.TM || {};
  global.TM.RevoltInference = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

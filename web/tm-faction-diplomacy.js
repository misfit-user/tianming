// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-faction-diplomacy.js — 势力 agent 双向外交（S1·NPC↔NPC·核心）
//
// 把势力从"各自盘算的平行 agent"升级成"会谈判/结盟/背叛的 agent 社会"。
// 现状缺口(一手核实)：势力间无双向谈判——decideFor 的 diplomacy 是**单向**(relationDelta 一改了事)·tm-faction-npc-chaoyi.js 的协作/攻讦是**启发式掷骰**(按 cohesion/imbalance 概率·非 agent 按目标决定)。
//
// 本模块让交互从双方 agent 推理涌现·且**零额外 LLM 调用**(骑每派现有 decideFor)：
//   ① A 的决策产 proposals(向谁·结盟/媾和/交易/联手/最后通牒·条款+理由)
//   ② recordProposals 存到目标派 fac._incomingProposals(跨回合·目标=玩家则入 GM._pendingFactionProposalsToPlayer 队·留 S2 走鸿雁/奏疏)
//   ③ B 决策时 formatIncomingProposals 注入 INCOMING_PROPOSALS 段(谁向我提了什么)
//   ④ B 的决策产 proposalResponses(接受/拒绝/还价·按 B 自己 aiStrategy 的目标/宿怨/姿态)
//   ⑤ applyResponses 结算：接受→双方 aiStrategy.alliances 互加·拒→提议方结怨·还价→反向新提议。
//
// 守铁律：后台(玩家不等·骑 post-turn 的势力决策)·有界(每派每回合≤少量提议·跨回合谈判=更真实的外交节奏)·开关 factionAgentEnabled 默认关·零回归·跨朝代中立(proposal type 通用词·无朝代专名)。
// 接线(decideFor·S1 同步做)：_buildPrompt 注 INCOMING_PROPOSALS 段 + 决策 schema 加 proposals/proposalResponses + apply 调 recordProposals/applyResponses。
// ============================================================

(function (global) {
  var TM = global.TM = global.TM || {};
  if (TM.FactionDiplomacy) return;

  var TYPES = { alliance: 1, nonaggression: 1, deal: 1, joint_action: 1, ultimatum: 1, peace: 1 };
  var TYPE_CN = { alliance: '结盟', nonaggression: '互不侵犯', deal: '交易', joint_action: '联手', ultimatum: '最后通牒', peace: '媾和' };
  var EXPIRE_TURNS = 4, MAX_PENDING = 6;

  function _dbg() { try { if (global.DebugLog && typeof global.DebugLog.log === 'function') global.DebugLog.log.apply(global.DebugLog, ['ai'].concat(Array.prototype.slice.call(arguments))); } catch (e) {} }
  function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function _facByName(name) { var G = global.GM || {}; if (!Array.isArray(G.facs)) return null; var k = _norm(name); for (var i = 0; i < G.facs.length; i++) { if (G.facs[i] && _norm(G.facs[i].name) === k) return G.facs[i]; } return null; }
  function _isPlayerName(name) {
    var P = global.P || {}, k = _norm(name);
    if (!k) return false;
    var pi = P.playerInfo || {};
    return [pi.factionName, P.playerFactionName, P.playerFaction, (global.GM && global.GM.playerFaction)].some(function (n) { return n && _norm(n) === k; });
  }
  function _strat(fac) { if (!fac.aiStrategy || typeof fac.aiStrategy !== 'object') fac.aiStrategy = {}; var s = fac.aiStrategy; if (!Array.isArray(s.alliances)) s.alliances = []; if (!Array.isArray(s.grudges)) s.grudges = []; return s; }
  function _pushUniq(arr, v) { if (v && arr.indexOf(v) < 0) arr.push(v); }
  function _log(entry) { try { var G = global.GM; if (!G) return; if (!Array.isArray(G._factionDiplomacyLog)) G._factionDiplomacyLog = []; G._factionDiplomacyLog.push(entry); if (G._factionDiplomacyLog.length > 40) G._factionDiplomacyLog = G._factionDiplomacyLog.slice(-40); } catch (e) {} }

  // 【S2·玩家通道】势力对玩家的提议 → 复用现有「势力使节」求见结构(tm-endturn-apply.js envoy audience)·surface 到问对·玩家在对话中回应·进 jishiRecords→sc1q/PLAYER_RECENT 反馈回势力
  // 外交 type → 问对现有「外藩使节」效果表(tm-wendui.js _WD_ENVOY_EFFECTS)·仅映语义安全的两类(无强制机械副作用)·余走 _default(准 rel+12/驳 rel-12)
  var _DIP2ENVOY = { alliance: 'form_confederation', peace: 'sue_for_peace' };
  function _toPlayerAudience(fromName, item) {
    var G = global.GM; if (!G) return;
    if (!Array.isArray(G._pendingAudiences)) G._pendingAudiences = [];
    // 防刷屏：同派同 type 未决的使节求见只留最新一条(仅去重本通道·_factionProposalId 标记)
    var _dedup = function (a) { return !(a && a._factionProposalId && a._diplomacyType === item.type && _norm(a.fromFaction) === _norm(fromName)); };
    if (typeof _wdCleansePendingAudiences === 'function' && typeof GM !== 'undefined' && G === GM) _wdCleansePendingAudiences(_dedup);   // 唯一清洗写口(按谓词)
    else G._pendingAudiences = G._pendingAudiences.filter(_dedup);
    // 批己·势力提议也挂谈判会话·玩家可回价续谈(flag OFF→ngId 保持 null·旧行为不变)
    var _ngId = null;
    try {
      var _N = global.TM && global.TM.Negotiation;
      if (_N && typeof _N.open === 'function' && _N.enabled()) {
        var _ng = _N.open({ topic: 'diplomacy', initiator: fromName, sourceRef: { kind: 'proposal', refId: item.id }, offer: { by: 'them', terms: item.terms || (TYPE_CN[item.type] || item.type) }, turn: item.turn });
        _ngId = _ng && _ng.id;
      }
    } catch (_e) {}
    G._pendingAudiences.push({
      name: fromName + '使节', reason: '【' + (TYPE_CN[item.type] || item.type) + '】' + (item.terms || '') + (item.rationale ? '（' + item.rationale + '）' : ''),
      turn: item.turn, isEnvoy: true, fromFaction: fromName, interactionType: (_DIP2ENVOY[item.type] || 'faction_proposal'),
      _factionProposalId: item.id, _diplomacyType: item.type, _negotiationId: _ngId
    });
    if (typeof _wdCapPendingAudiences === 'function' && typeof GM !== 'undefined' && G === GM) _wdCapPendingAudiences(20);   // 唯一去顶写口
    else if (G._pendingAudiences.length > 20) G._pendingAudiences = G._pendingAudiences.slice(-20);
    _log({ turn: item.turn, kind: 'propose_player', from: fromName, to: 'player', type: item.type, terms: item.terms });
  }

  // ── ① 存提议：A 的 proposals → 目标派 _incomingProposals(玩家目标入 player 队·留 S2) ──
  // B2②·全局递增序号(GM 级)·防同回合多次 recordProposals 的本地 n 重置 → id 碰撞(dp-5-a-0 撞 dp-5-a-0)
  function _dipSeq() { var G = global.GM; if (!G) return Date.now(); var v = Number(G._factionDiplomacySeq); G._factionDiplomacySeq = (isFinite(v) ? v : 0) + 1; return G._factionDiplomacySeq; }   // arch-ok: F2 外交提案全局递增序号(GM 级·防 id 碰撞)
  function recordProposals(fromName, proposals, turn) {
    if (!Array.isArray(proposals) || !proposals.length) return { recorded: 0, toPlayer: 0 };
    var recorded = 0, toPlayer = 0;
    proposals.slice(0, 4).forEach(function (p) {
      if (!p || !p.toFaction || !p.type || !TYPES[p.type]) return;
      if (_norm(p.toFaction) === _norm(fromName)) return; // 不向自己提
      var item = { id: 'dp-' + turn + '-' + _norm(fromName).slice(0, 6) + '-' + _dipSeq(), from: String(fromName).slice(0, 30), type: p.type, terms: String(p.terms || '').slice(0, 60), rationale: String(p.rationale || '').slice(0, 50), turn: turn, status: 'pending' };
      if (_isPlayerName(p.toFaction)) {
        // 目标=玩家：①入队(供观测/反馈) ②【S2】路由成「势力使节」求见(复用现有 envoy audience·surface 到问对)
        var G = global.GM; if (!G) return;
        if (!Array.isArray(G._pendingFactionProposalsToPlayer)) G._pendingFactionProposalsToPlayer = [];
        G._pendingFactionProposalsToPlayer.push(Object.assign({ to: 'player' }, item));
        if (G._pendingFactionProposalsToPlayer.length > 12) G._pendingFactionProposalsToPlayer = G._pendingFactionProposalsToPlayer.slice(-12);
        _toPlayerAudience(String(fromName).slice(0, 30), item);
        toPlayer++;
        return;
      }
      var target = _facByName(p.toFaction);
      if (!target) return; // 目标势力不存在
      if (!Array.isArray(target._incomingProposals)) target._incomingProposals = [];
      // B2①·去重键加 terms 摘要：仅【同 from+type+条款】的重复才合并·真正不同条款的两提案都保留(不再丢第一条)
      target._incomingProposals = target._incomingProposals.filter(function (x) { return !(x.status === 'pending' && _norm(x.from) === _norm(item.from) && x.type === item.type && _norm(x.terms) === _norm(item.terms)); });
      target._incomingProposals.push(item);
      if (target._incomingProposals.length > MAX_PENDING) target._incomingProposals = target._incomingProposals.slice(-MAX_PENDING);
      _log({ turn: turn, kind: 'propose', from: item.from, to: p.toFaction, type: p.type, terms: item.terms });
      recorded++;
    });
    return { recorded: recorded, toPlayer: toPlayer };
  }

  // ── ③ 感知：目标派决策时·格式化待它回应的提议(INCOMING_PROPOSALS 段) ──
  function formatIncomingProposals(fac, turn) {
    if (!fac) return [];
    _expire(fac, turn != null ? turn : _turn());
    var pend = (fac._incomingProposals || []).filter(function (p) { return p && p.status === 'pending'; });
    if (!pend.length) return [];
    var lines = ['  其他势力本回合/近回合向你提出的外交动议·你须在 proposalResponses 中逐条回应(accept/reject/counter·按你自己的目标/宿怨/姿态权衡·非必接受)：'];
    pend.slice(0, MAX_PENDING).forEach(function (p) {
      lines.push('  · [id:' + p.id + '] 来自「' + p.from + '」·' + (TYPE_CN[p.type] || p.type) + (p.terms ? '·条款：' + p.terms : '') + (p.rationale ? '·其由：' + p.rationale : '') + '(T' + p.turn + ')·回应时于 proposalResponses 填此 id');
    });
    return lines;
  }

  // ── ⑤ 结算：目标派的 responses → 应用结果(从双方推理涌现) ──
  function applyResponses(fac, responses, turn) {
    if (!fac || !Array.isArray(responses) || !responses.length) return { resolved: 0 };
    var resolved = 0;
    responses.slice(0, MAX_PENDING).forEach(function (r) {
      if (!r || !r.decision) return;
      var pendAll = (fac._incomingProposals || []).filter(function (p) { return p.status === 'pending'; });
      if (!pendAll.length) return;
      // B2③·张冠李戴防护(fail-closed)：带 id → 命中即结算·未命中则保持未决(不降级猜)；无 id → 仅候选唯一才结算·歧义(0 或 >1)保持未决
      var prop = null;
      var pid = r.proposalId != null ? r.proposalId : r.id;
      if (pid != null && String(pid)) {
        prop = pendAll.filter(function (p) { return String(p.id) === String(pid); })[0] || null;
        if (!prop) return;   // 带 id 未命中 → fail-closed·保持未决
      } else {
        var cand = pendAll;
        if (r.from) cand = cand.filter(function (p) { return _norm(p.from) === _norm(r.from); });
        if (r.type) { var rt = _norm(r.type); cand = cand.filter(function (p) { return _norm(p.type) === rt || _norm(TYPE_CN[p.type]) === rt; }); }
        if (cand.length !== 1) return;   // 无候选/歧义 → 保持未决(不错配)
        prop = cand[0];
      }
      var proposer = _facByName(prop.from);
      var dec = _norm(r.decision);
      if (dec === 'accept') {
        prop.status = 'accepted';
        _resolveAccept(proposer, fac, prop);
        _log({ turn: turn, kind: 'accept', from: prop.from, to: fac.name, type: prop.type, reason: String(r.reason || '').slice(0, 50) });
      } else if (dec === 'counter') {
        prop.status = 'countered';
        // 反向新提议：fac → proposer(还价)
        if (proposer) {
          recordProposals(fac.name, [{ toFaction: prop.from, type: prop.type, terms: String(r.counterTerms || r.reason || '').slice(0, 60), rationale: '对「' + prop.from + '」原议的还价' }], turn);
        }
        _log({ turn: turn, kind: 'counter', from: prop.from, to: fac.name, type: prop.type, counter: String(r.counterTerms || '').slice(0, 50) });
      } else { // reject
        prop.status = 'rejected';
        // 提议被拒·提议方可能结怨被拒方(尤其最后通牒/结盟被拒)
        if (proposer && (prop.type === 'ultimatum' || prop.type === 'alliance' || prop.type === 'joint_action')) {
          _pushUniq(_strat(proposer).grudges, fac.name);
        }
        _log({ turn: turn, kind: 'reject', from: prop.from, to: fac.name, type: prop.type, reason: String(r.reason || '').slice(0, 50) });
      }
      resolved++;
    });
    // 清理已决的(保留近期供观测)
    fac._incomingProposals = (fac._incomingProposals || []).filter(function (p) { return p.status === 'pending' || (turn - p.turn) <= 2; });
    return { resolved: resolved };
  }

  // 结盟/互不侵犯/联手落 GM.treaties——与 tm-feudal-warfare._ty_callAlliesToWar 消费面对齐字段(parties/type/mutual_defense/active)·
  //   此前只写 aiStrategy.alliances(软标签)·战争盟友参战只读真实 treaties → 结盟「无牙」。alliance 置 mutual_defense 使盟友应约参战。
  function _lodgeTreaty(a, b, type, turn) {
    try {
      var G = global.GM; if (!G) return;
      if (!Array.isArray(G.treaties)) G.treaties = [];   // arch-ok: F2 势力社会结盟落账(GM.treaties 既有子树·战争引擎消费面)
      var mutual = (type === 'alliance');
      var typeName = ({ alliance: '同盟', nonaggression: '互不侵犯', joint_action: '共同行动' })[type] || type;
      var dup = G.treaties.some(function (t) {
        if (!t || t.active === false || t.type !== type) return false;
        var parties = Array.isArray(t.parties) ? t.parties.map(function (p) { return (p && p.name) || p; }) : [];
        return parties.indexOf(a) >= 0 && parties.indexOf(b) >= 0;
      });
      if (dup) return;
      G.treaties.push({ id: 'ftr-' + (turn || _turn()) + '-' + _norm(type).slice(0, 10) + '-' + _dipSeq(), type: type, typeName: typeName, mutual_defense: mutual, parties: [{ name: a }, { name: b }], startTurn: (turn || _turn()), active: true, _source: 'faction-diplomacy' });   // arch-ok: F2 结盟落 GM.treaties(战争引擎消费面)·全局序号防同回合跨类型碰撞
      if (G.treaties.length > 80) G.treaties = G.treaties.slice(-80);   // arch-ok: F2 结盟落账截断(GM.treaties 既有子树·战争引擎消费面)
    } catch (e) {}
  }

  function _resolveAccept(proposer, target, prop) {
    if (!proposer || !target) return;
    var ps = _strat(proposer), ts = _strat(target);
    if (prop.type === 'alliance' || prop.type === 'nonaggression' || prop.type === 'joint_action') {
      _pushUniq(ps.alliances, target.name); _pushUniq(ts.alliances, proposer.name);
      // 结盟→消解彼此宿怨
      ps.grudges = ps.grudges.filter(function (g) { return _norm(g) !== _norm(target.name); });
      ts.grudges = ts.grudges.filter(function (g) { return _norm(g) !== _norm(proposer.name); });
      _lodgeTreaty(proposer.name, target.name, prop.type, prop.turn);   // B3·落 GM.treaties·让战争盟友参战真读到
    } else if (prop.type === 'peace') {
      // 媾和必须走唯一战争终结入口；只消宿怨不等于结束战争。
      ps.grudges = ps.grudges.filter(function (g) { return _norm(g) !== _norm(target.name); });
      ts.grudges = ts.grudges.filter(function (g) { return _norm(g) !== _norm(proposer.name); });
      var G = global.GM || {};
      var wars = Array.isArray(G.activeWars) ? G.activeWars.slice() : [];
      wars.forEach(function (war) {
        if (!war) return;
        var wa = _norm(war.attacker || war.from || war.sideA), wd = _norm(war.defender || war.to || war.sideB);
        var pa = _norm(proposer.name), ta = _norm(target.name);
        if (!((wa === pa && wd === ta) || (wa === ta && wd === pa))) return;
        if (global.CasusBelliSystem && typeof global.CasusBelliSystem.endWar === 'function') global.CasusBelliSystem.endWar(war.id);
      });
    }
    // deal/ultimatum 接受：记入双方 currentPlan 提示·不强改 alliances
  }

  function _expire(fac, turn) {
    if (!fac || !Array.isArray(fac._incomingProposals)) return;
    fac._incomingProposals.forEach(function (p) { if (p.status === 'pending' && (turn - p.turn) > EXPIRE_TURNS) p.status = 'lapsed'; });
  }

  function _turn() { return (global.GM && global.GM.turn) || 0; }

  function diplomacyLog(GM) { GM = GM || global.GM; return (GM && GM._factionDiplomacyLog) || []; }
  function summarize(GM) {
    GM = GM || global.GM; var log = (GM && GM._factionDiplomacyLog) || [];
    var by = {}; log.slice(-20).forEach(function (e) { by[e.kind] = (by[e.kind] || 0) + 1; });
    return { recentEvents: log.length, byKind: by, pendingToPlayer: ((GM && GM._pendingFactionProposalsToPlayer) || []).length };
  }

  // ── ⑥【S3】玩家对「我的提议」的答复 → 回写发起势力持久记忆(aiStrategy)·供其下回合决策显式感知(非仅邦交 delta 间接推) ──
  function recordPlayerResponse(fromName, info) {
    info = info || {};
    var fac = _facByName(fromName); if (!fac) return false;
    if (!fac.aiStrategy) fac.aiStrategy = {};
    var arr = Array.isArray(fac.aiStrategy.playerProposalOutcomes) ? fac.aiStrategy.playerProposalOutcomes : [];
    arr = arr.filter(function (o) { return o && o.id !== info.id; }); // 同提议只留一条结果
    arr.push({ id: info.id || '', type: info.type || '', terms: String(info.terms || '').slice(0, 50), outcome: info.outcome || '', turn: info.turn != null ? info.turn : _turn() });
    if (arr.length > 6) arr = arr.slice(-6);
    fac.aiStrategy.playerProposalOutcomes = arr;
    _log({ turn: info.turn != null ? info.turn : _turn(), kind: 'player_response', from: fromName, to: 'player', type: info.type, outcome: info.outcome });
    return true;
  }

  // ── ⑦【S3】感知：发起势力决策时·格式化「君上对我提议的近期答复」(PLAYER_PROPOSAL_OUTCOMES 段) ──
  var _OUTCOME_CN = { accepted: '已纳', rejected: '见拒', temporized: '羁縻未决', countered: '君上还价' };
  function formatPlayerProposalOutcomes(fac, turn) {
    if (!fac || !fac.aiStrategy) return [];
    var arr = (fac.aiStrategy.playerProposalOutcomes || []).filter(function (o) { return o && (turn == null || (turn - (o.turn || 0)) <= 8); }); // 仅近 8 回合
    if (!arr.length) return [];
    var lines = ['  你近回合向君上(玩家)递交之议·已得答复(据此调整对君上之策：见纳则可深交/趁势进言·见拒则另谋或转冷·勿重复无效之请)：'];
    arr.slice(-4).forEach(function (o) {
      lines.push('  · ' + (TYPE_CN[o.type] || o.type) + (o.terms ? '·' + o.terms : '') + ' → ' + (_OUTCOME_CN[o.outcome] || o.outcome) + '(T' + o.turn + ')');
    });
    return lines;
  }

  TM.FactionDiplomacy = {
    recordProposals: recordProposals,
    formatIncomingProposals: formatIncomingProposals,
    applyResponses: applyResponses,
    recordPlayerResponse: recordPlayerResponse,
    formatPlayerProposalOutcomes: formatPlayerProposalOutcomes,
    diplomacyLog: diplomacyLog,
    summarize: summarize,
    TYPE_CN: TYPE_CN
  };
})(typeof window !== 'undefined' ? window : globalThis);

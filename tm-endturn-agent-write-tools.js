// @ts-check
// ============================================================
// tm-endturn-agent-write-tools.js — 模式 b · S3 · 守护写工具 + 校验闸
//
// 让 agent **自主守护写整局存档任意内容**(「想怎么改怎么改」侧)·且是**安全的命门**(自主无审批→护栏即命)。
// 核心**真复用** tm-ai-change-pathutils.js 的 applyPathSet/applyPathDelta/applyPathPush + isPathBlocked
//   (与模式 a 的 applier `changes` 走同一套路径写·零重复·side-effect/core-var 同步/loyalty clamp 全继承)。
// 详设 docs/agent-mode-design.md §4.2 / §5。
//
// 每次写经校验闸(_guarded)六步:
//   ① 黑名单(复用 isPathBlocked·护时序/config/API/_内部)  ② 数值合法(拒 NaN/Inf)
//   ③ 引用完整性(委托 PathUtils resolvePath:path-not-found/array-非数字键 拒)
//   ④ 玩家保护(agent 模式额外层·护玩家专属/神圣字段·可扩展调优)
//   ⑤ 引擎让步标记(写引擎拥有域→打 _agentOverrides 标·systems/派生重算 S5 见标即跳·甲案)
//   ⑥ 写即报告(产出焊缝:type:'change' 与模式 a 同构·render 一视同仁·_turnReport 直接 push)
//
// 焊死:写=报告条目。`_turnReport` 在 `_*` 黑名单内→**直接 push**(不经守护写·守护写不能改 _ 字段)。
// 3 工具:set_field / adjust_field / push_field(通用·path 化·任意 GM 字段)。语义糖(任免/调动)留 S4 按需。
// ============================================================

(function (root) {
  'use strict';
  var TM = root.TM || (root.TM = {});
  TM.Endturn = TM.Endturn || {};

  function _PU() { return (root.TM && root.TM.AIChange && root.TM.AIChange.PathUtils) || null; }
  function _GM(ctx) { return (ctx && ctx.GM) || root.GM || null; }

  // ④ 玩家保护:agent 模式额外护栏(在 applier 黑名单之上)·护玩家专属/神圣字段。可扩展(真机调优)。
  var PLAYER_PROTECTED_PATHS = [
    /^playerCharId$/i, /^playerFaction(Id)?$/i, /(^|\.)isPlayer$/i
  ];
  function _isPlayerProtected(path) {
    if (!path) return false;
    var p = String(path).replace(/^GM\./, '');
    return PLAYER_PROTECTED_PATHS.some(function (re) { return re.test(p); });
  }

  // ⑤ 引擎拥有域:agent 写这些→打覆写标·systems/派生重算(S5)见标即跳(甲案让步)。可扩展。
  var ENGINE_OWNED = [
    /^guoku($|\.)/, /^neitang($|\.)/, /^huji($|\.)/, /^population($|\.)/,
    /^environment($|\.)/, /^fiscal/i, /^minxin($|\.)/
  ];
  function _isEngineOwned(path) {
    if (!path) return false;
    var p = String(path).replace(/^GM\./, '');
    return ENGINE_OWNED.some(function (re) { return re.test(p); });
  }
  function _markOverride(gm, path) {
    if (!gm) return;
    if (!gm._agentOverrides) gm._agentOverrides = {};
    gm._agentOverrides[String(path).replace(/^GM\./, '')] = { turn: gm.turn || 0 };
  }

  function _numBad(v) { return typeof v === 'number' && (isNaN(v) || !isFinite(v)); }

  // 写即报告(产出焊缝)·_turnReport 是 `_*` 黑名单内→必须直接 push(守护写改不了 _ 字段)
  function _report(gm, entry) {
    if (!gm) return;
    if (!Array.isArray(gm._turnReport)) gm._turnReport = [];
    gm._turnReport.push(entry);
    if (!Array.isArray(gm._agentWriteLog)) gm._agentWriteLog = [];
    gm._agentWriteLog.push(entry);  // 观测/覆盖脊柱(S4)/对拍(S6)用
  }
  function _recordFail(gm, op, path, reason) {
    if (!gm) return;
    if (!Array.isArray(gm._agentWriteFailed)) gm._agentWriteFailed = [];
    gm._agentWriteFailed.push({ op: op, path: path, reason: reason, turn: gm.turn || 0 });
  }

  // ── 校验闸:所有写经此 ──
  function _guarded(gm, op, path, payload, reason) {
    var PU = _PU();
    if (!gm) return { ok: false, reason: '无存档' };
    if (!PU) return { ok: false, reason: 'PathUtils 未加载' };
    if (!path) return { ok: false, reason: '缺 path' };
    // ① 黑名单(复用 applier 同一套)
    if (PU.isPathBlocked(path)) { _recordFail(gm, op, path, '黑名单禁区'); return { ok: false, reason: '黑名单禁区:' + path }; }
    // ④ 玩家保护
    if (_isPlayerProtected(path)) { _recordFail(gm, op, path, '玩家保护'); return { ok: false, reason: '玩家保护:' + path }; }
    // ② 数值合法
    if ((op === 'adjust' || op === 'set') && _numBad(payload)) { _recordFail(gm, op, path, '非法数值'); return { ok: false, reason: '非法数值(NaN/Inf)' }; }
    // ③ 引用完整性 + 真写(委托 PathUtils·复用现成)
    var res;
    try {
      if (op === 'push') res = PU.applyPathPush(gm, path, payload);
      else if (op === 'adjust') res = PU.applyPathDelta(gm, path, payload, reason);
      else res = PU.applyPathSet(gm, path, payload, reason);
    } catch (e) { _recordFail(gm, op, path, 'apply 异常:' + (e && e.message)); return { ok: false, reason: 'apply 异常:' + (e && e.message) }; }
    if (!res || !res.ok) { _recordFail(gm, op, path, (res && res.reason) || 'apply 失败'); return { ok: false, reason: (res && res.reason) || 'apply 失败' }; }
    // ⑤ 引擎让步标记
    if (_isEngineOwned(path)) _markOverride(gm, path);
    // ⑥ 写即报告
    _report(gm, { type: 'change', path: res.path || path, old: res.old, new: res.new, delta: res.delta, reason: reason, turn: gm.turn || 0, _agent: true, _op: op });
    return { ok: true, path: res.path || path, old: res.old, new: res.new };
  }

  // ── 语义写工具:改硬核结构化账走真引擎入口 ──
  //   裸 path 写结构化账会落错字段(如 normalizeCoreVarPath 把 guoku.balance 改写成 guoku.money·且 engine-first 后被 reconcile 覆盖)·
  //   故财政走 FiscalEngine.spendFromGuoku/addToGuoku(ledger+scalar+记账+欠账)·人事走 onAppointment/onDismissal(联动仕途/俸禄/公库)。
  //   仍统一经 _report(产出焊缝) + _recordFail(可见) + _markOverride(引擎让步)。
  function _accStock(gm, acc, cur) { try { var a = gm && gm[acc]; if (a && typeof a === 'object') return a[cur]; return a; } catch (e) { return undefined; } }

  function _semTreasury(gm, input) {
    var FE = root.FiscalEngine;
    if (!gm) return { ok: false, reason: '无存档' };
    if (!FE || (typeof FE.spendFromGuoku !== 'function' && typeof FE.addToGuoku !== 'function')) { _recordFail(gm, 'treasury', 'guoku', 'FiscalEngine 未加载'); return { ok: false, reason: 'FiscalEngine 未加载' }; }
    var delta = Number(input.delta);
    if (_numBad(delta) || delta === 0) { _recordFail(gm, 'treasury', 'guoku', '非法/零 delta'); return { ok: false, reason: '非法或零 delta' }; }
    var cur = (input.currency === 'grain' || input.currency === 'cloth') ? input.currency : 'money';
    var reason = input.reason || 'agent 推演';
    var before = _accStock(gm, 'guoku', cur);
    var amt = {}; amt[cur] = Math.abs(delta); var res;
    try { res = (delta < 0) ? FE.spendFromGuoku(amt, reason) : FE.addToGuoku(amt, reason); }
    catch (e) { _recordFail(gm, 'treasury', 'guoku.' + cur, 'engine 异常:' + (e && e.message)); return { ok: false, reason: 'engine 异常:' + (e && e.message) }; }
    if (!res || res.ok === false) { _recordFail(gm, 'treasury', 'guoku.' + cur, (res && res.reason) || 'engine 拒绝'); return { ok: false, reason: (res && res.reason) || 'engine 拒绝' }; }
    var after = _accStock(gm, 'guoku', cur);
    _markOverride(gm, 'guoku');
    _report(gm, { type: 'change', path: 'guoku.' + cur, old: before, new: after, reason: reason, turn: gm.turn || 0, _agent: true, _op: 'treasury' });
    return { ok: true, path: 'guoku.' + cur, old: before, new: after };
  }

  function _semAppoint(gm, input) {
    var fn = root.onAppointment;
    if (typeof fn !== 'function') { _recordFail(gm, 'appoint', input && input.name, 'onAppointment 未加载'); return { ok: false, reason: 'onAppointment 未加载' }; }
    if (!input || !input.name || !input.position) return { ok: false, reason: '缺 name/position' };
    var res; try { res = fn(input.name, input.position); } catch (e) { _recordFail(gm, 'appoint', input.name, 'engine 异常:' + (e && e.message)); return { ok: false, reason: 'engine 异常:' + (e && e.message) }; }
    if (res && res.ok === false) { _recordFail(gm, 'appoint', input.name, res.reason || '任命失败'); return { ok: false, reason: res.reason || '任命失败' }; }
    _report(gm, { type: 'change', path: 'chars/' + input.name, old: '', new: input.position, reason: (input.reason || '') + '·任 ' + input.position, turn: gm.turn || 0, _agent: true, _op: 'appoint' });
    return { ok: true, path: 'chars/' + input.name, new: input.position };
  }

  function _semDismiss(gm, input) {
    var fn = root.onDismissal;
    if (typeof fn !== 'function') { _recordFail(gm, 'dismiss', input && input.name, 'onDismissal 未加载'); return { ok: false, reason: 'onDismissal 未加载' }; }
    if (!input || !input.name) return { ok: false, reason: '缺 name' };
    var res; try { res = fn(input.name, input.reason || ''); } catch (e) { _recordFail(gm, 'dismiss', input.name, 'engine 异常:' + (e && e.message)); return { ok: false, reason: 'engine 异常:' + (e && e.message) }; }
    if (res && res.ok === false) { _recordFail(gm, 'dismiss', input.name, res.reason || '去职失败'); return { ok: false, reason: res.reason || '去职失败' }; }
    _report(gm, { type: 'change', path: 'chars/' + input.name, reason: (input.reason || '') + '·去职', turn: gm.turn || 0, _agent: true, _op: 'dismiss' });
    return { ok: true, path: 'chars/' + input.name };
  }

  // ── 删除数组项(推演后果:部队覆灭/党派清洗/阶层消亡/势力剪除)·强护栏:黑名单/玩家保护/禁删玩家本人 ──
  function _semRemove(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var PU = _PU();
    var path = input && input.path;
    if (!path) return { ok: false, reason: '缺 path(要删项的数组路径·如 parties/classes/armies)' };
    if (PU && PU.isPathBlocked(path)) { _recordFail(gm, 'remove', path, '黑名单'); return { ok: false, reason: '黑名单禁区:' + path }; }
    if (_isPlayerProtected(path)) { _recordFail(gm, 'remove', path, '玩家保护'); return { ok: false, reason: '玩家保护:' + path }; }
    var p = String(path).replace(/^GM\./, ''); var parts = p.split('.').filter(function (s) { return s !== ''; });
    var cur = gm; for (var i = 0; i < parts.length; i++) { if (cur == null || typeof cur !== 'object') { cur = null; break; } cur = cur[parts[i]]; }
    if (!Array.isArray(cur)) { _recordFail(gm, 'remove', path, '非数组'); return { ok: false, reason: path + ' 不是数组·remove_field 只删数组项' }; }
    var idx = -1;
    if (typeof input.index === 'number') idx = input.index;
    else if (input.match != null) { var m = String(input.match); for (var j = 0; j < cur.length; j++) { var it = cur[j]; if (it && typeof it === 'object' && (String(it.id) === m || String(it.name) === m || String(it.title) === m)) { idx = j; break; } } }
    if (idx < 0 || idx >= cur.length) { _recordFail(gm, 'remove', path, '未找到项'); return { ok: false, reason: '未找到要删的项(给 index 下标 或 match=id/名称)' }; }
    var removed = cur[idx];
    if (removed && typeof removed === 'object' && ((gm.playerCharId != null && String(removed.id) === String(gm.playerCharId)) || (gm.playerFactionId != null && String(removed.id) === String(gm.playerFactionId)) || removed.isPlayer)) { _recordFail(gm, 'remove', path, '禁删玩家'); return { ok: false, reason: '禁删玩家本人/玩家势力' }; }
    cur.splice(idx, 1);
    if (_isEngineOwned(path)) _markOverride(gm, path);
    _report(gm, { type: 'change', path: path + '[' + idx + ']', old: _brief(removed), new: '(已删除)', reason: (input.reason || '') + '·删除', turn: gm.turn || 0, _agent: true, _op: 'remove' });
    return { ok: true, path: path, removed: removed };
  }

  // ── 收入支出项(岁入岁出流水)·增/改/停/删·复用 applier 的 fiscal_adjustments(零 drift·像 adjust_treasury 复用 FiscalEngine)──
  //   收入支出项存 guoku.extraIncome[]/extraExpense[](或 neitang/province)·applyAITurnChanges 处理 add/update/stop/remove + 立即作用余额 + recurring。
  function _semFiscalItem(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var fn = root.applyAITurnChanges;
    if (typeof fn !== 'function') { _recordFail(gm, 'fiscal_item', input && input.name, 'applyAITurnChanges 未加载'); return { ok: false, reason: 'applyAITurnChanges 未加载' }; }
    var kind = String((input && input.kind) || '').toLowerCase();
    if (!/^(income|收入|expense|支出)$/.test(kind)) return { ok: false, reason: '缺/错 kind(income 收入 / expense 支出)' };
    var action = String((input && input.action) || 'add').toLowerCase();
    var entry = {
      target: (input && input.target) || 'guoku',
      kind: /income|收入/.test(kind) ? 'income' : 'expense',
      resource: (input && input.resource) || 'money',
      category: (input && input.category) || '',
      name: (input && (input.name || input.category)) || '财政项',
      amount: (input && input.amount) != null ? input.amount : 0,
      action: action,
      recurring: !!(input && input.recurring),
      reason: (input && input.reason) || 'agent 推演'
    };
    if (input && input.id != null) entry.id = input.id;
    if (input && input.stopAfterTurn != null) entry.stopAfterTurn = input.stopAfterTurn;
    if (/^(add|update)$/.test(action) && !(entry.amount > 0)) return { ok: false, reason: '增/改需正 amount' };
    var before = (gm._turnReport || []).length;
    var res; try { res = fn({ fiscal_adjustments: [entry] }); } catch (e) { _recordFail(gm, 'fiscal_item', entry.name, 'apply 异常:' + (e && e.message)); return { ok: false, reason: 'apply 异常:' + (e && e.message) }; }
    var fiscalDone = (gm._turnReport || []).slice(before).some(function (e) { return e && e.type === 'fiscal_adj'; });
    if (!fiscalDone) { _recordFail(gm, 'fiscal_item', entry.name, '财政项未落地(target/province 解析失败?)'); return { ok: false, reason: '财政项未落地(查 target·province:地名 须存在)' }; }
    _report(gm, { type: 'change', path: entry.target + '.' + (entry.kind === 'income' ? 'extraIncome' : 'extraExpense'), new: entry.name + ' ' + (/stop|remove/.test(action) ? '(停/删)' : ((entry.kind === 'income' ? '增收+' : '开支-') + entry.amount)) + (entry.recurring ? '·年例' : ''), reason: entry.reason, turn: gm.turn || 0, _agent: true, _op: 'fiscal_item' });
    return { ok: true, target: entry.target, name: entry.name, kind: entry.kind };
  }

  // ── ② 军事指挥(募兵/调动/改将/创建/解散)·复用 applyAIArmyChange(canonical·tm-ai-change-army.js)──
  function _semArmy(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var fn = root.applyAIArmyChange;
    if (typeof fn !== 'function') { _recordFail(gm, 'army', input && (input.armyName || input.name), 'applyAIArmyChange 未加载'); return { ok: false, reason: 'applyAIArmyChange 未加载' }; }
    var nm = input && (input.armyName || input.name);
    if (!nm) return { ok: false, reason: '缺 armyName(军队名)' };
    var change = { armyName: nm };
    if (input.action) change.action = input.action;                       // create 创建 / 其余更新
    if (input.soldiersDelta != null) change.soldiersDelta = input.soldiersDelta;  // 募兵(+)/损耗(-)
    else if (input.soldiers != null) change.soldiers = input.soldiers;     // 设定兵力
    if (input.location != null) change.location = input.location;          // 调动移防
    if (input.commander != null) change.commander = input.commander;       // 改将
    if (input.state != null) change.state = input.state;                   // 解散='disbanded' 等
    if (input.faction != null) change.faction = input.faction;
    var res; try { res = fn(change, {}); } catch (e) { _recordFail(gm, 'army', nm, 'engine 异常:' + (e && e.message)); return { ok: false, reason: 'engine 异常:' + (e && e.message) }; }
    if (res && res.ok === false) { _recordFail(gm, 'army', nm, res.reason || '军令失败'); return { ok: false, reason: res.reason || '军令失败' }; }
    _report(gm, { type: 'change', path: 'armies/' + nm, new: _brief(change), reason: (input.reason || '') + '·军令', turn: gm.turn || 0, _agent: true, _op: 'army' });
    return { ok: true, path: 'armies/' + nm };
  }

  // ── ③ 外交战和(宣战/议和/邦交)·复用 declareWar/endWar/setFactionRelation(canonical)──
  function _semDiplomacy(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var action = String((input && input.action) || '').toLowerCase();
    if (/declare|宣战|war$/.test(action)) {
      var fnW = root.declareWar; if (typeof fnW !== 'function') { _recordFail(gm, 'diplomacy', '', 'declareWar 未加载'); return { ok: false, reason: 'declareWar 未加载' }; }
      if (!input.attacker || !input.defender) return { ok: false, reason: '宣战缺 attacker/defender(势力名)' };
      var rw; try { rw = fnW(input.attacker, input.defender, input.casusBelli || 'none'); } catch (e) { return { ok: false, reason: 'engine 异常:' + (e && e.message) }; }
      if (rw && rw.success === false) { _recordFail(gm, 'diplomacy', input.attacker, rw.message || '宣战失败'); return { ok: false, reason: rw.message || '宣战失败' }; }
      _report(gm, { type: 'change', path: 'activeWars', new: input.attacker + '→' + input.defender + '(宣战)', reason: (input.reason || '') + '·宣战', turn: gm.turn || 0, _agent: true, _op: 'declare_war' });
      return { ok: true };
    }
    if (/peace|议和|停战|end/.test(action)) {
      var fnE = root.endWar; if (typeof fnE !== 'function') { _recordFail(gm, 'diplomacy', '', 'endWar 未加载'); return { ok: false, reason: 'endWar 未加载' }; }
      var warId = input.warId;
      if (!warId && input.attacker && input.defender) { var w = (gm.activeWars || []).find(function (x) { return x && ((x.attacker === input.attacker && x.defender === input.defender) || (x.attacker === input.defender && x.defender === input.attacker)); }); warId = w && w.id; }
      if (!warId) return { ok: false, reason: '议和缺 warId(或 attacker+defender 定位现有战争)' };
      try { fnE(warId); } catch (e) { return { ok: false, reason: 'engine 异常:' + (e && e.message) }; }
      _report(gm, { type: 'change', path: 'activeWars', new: '议和·' + warId, reason: (input.reason || '') + '·议和', turn: gm.turn || 0, _agent: true, _op: 'make_peace' });
      return { ok: true };
    }
    if (/relation|邦交|态度|stance/.test(action)) {
      var fnR = root.setFactionRelation; if (typeof fnR !== 'function') { _recordFail(gm, 'diplomacy', '', 'setFactionRelation 未加载'); return { ok: false, reason: 'setFactionRelation 未加载' }; }
      if (!input.from || !input.to) return { ok: false, reason: '设邦交缺 from/to(势力名)' };
      var patch = {}; if (input.value != null) patch.value = input.value; if (input.delta != null) patch.delta = input.delta; if (input.type) patch.type = input.type; if (input.reason) patch.reason = input.reason;
      if (patch.value == null && patch.delta == null && !patch.type) return { ok: false, reason: '设邦交需 value/delta/type 至少一项' };
      try { fnR(input.from, input.to, patch, { mirror: input.mirror !== false }); } catch (e) { return { ok: false, reason: 'engine 异常:' + (e && e.message) }; }
      _report(gm, { type: 'change', path: 'factionRelations/' + input.from + '-' + input.to, new: _brief(patch), reason: (input.reason || '') + '·邦交', turn: gm.turn || 0, _agent: true, _op: 'set_relation' });
      return { ok: true };
    }
    return { ok: false, reason: '未知外交 action(declare_war 宣战 / make_peace 议和 / set_relation 设邦交)' };
  }

  // 区划树查找(adminHierarchy 递归·按名/id)·返回 {div, parentArr, idx}
  // P/GM 双源并存：BuildingWorks.tick 消费 P.adminHierarchy，而部分旧/agent 路径只给 GM.adminHierarchy。
  // 写工具优先落 P 树，避免 agent 兴工写到建筑 tick 看不到的镜像树。
  function _adminSources(gm) {
    var srcs = [];
    function add(ah, label) {
      if (!ah || typeof ah !== 'object' || !Object.keys(ah).length) return;
      if (srcs.some(function (s) { return s.ah === ah; })) return;
      srcs.push({ ah: ah, label: label });
    }
    add(root.P && root.P.adminHierarchy, 'P.adminHierarchy');
    add(gm && gm.adminHierarchy, 'GM.adminHierarchy');
    add(root.GM && root.GM.adminHierarchy, 'root.GM.adminHierarchy');
    return srcs;
  }
  function _walkDiv(gm, name) {
    var key = String(name); var found = null;
    function rec(list, label) {
      if (!Array.isArray(list) || found) return;
      for (var i = 0; i < list.length; i++) {
        var d = list[i]; if (!d) continue;
        if (String(d.name) === key || String(d.id) === key) { found = { div: d, parentArr: list, idx: i, source: label }; return; }
        rec(d.children || d.divisions || d.subDivisions, label); if (found) return;
      }
    }
    function walkRoot(ah, label) {
      if (found) return;
      if (Array.isArray(ah)) { rec(ah, label); return; }
      if (ah && (ah.name || ah.id || ah.divisions || ah.children || ah.subDivisions || ah.subs)) {
        if (String(ah.name) === key || String(ah.id) === key) { found = { div: ah, parentArr: null, idx: -1, source: label }; return; }
        rec(ah.divisions || ah.children || ah.subDivisions || ah.subs, label);
        return;
      }
      Object.keys(ah).forEach(function (fk) {
        if (found) return;
        var node = ah[fk];
        rec(node && (node.divisions || node.children || node.subDivisions || node.subs), label);
      });
    }
    _adminSources(gm).forEach(function (src) {
      walkRoot(src.ah, src.label);
    });
    return found;
  }

  // ── ④ 建筑工程(兴工/拆毁)·兴工 push 工程(引擎 tick 自动完工入账)·拆毁复用 TM.BuildingWorks.revertBuilding(逆回经济效果)──
  function _semBuilding(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var action = String((input && input.action) || 'start').toLowerCase();
    var region = input && input.region;
    if (!region) return { ok: false, reason: '缺 region(地块名)' };
    var hit = _walkDiv(gm, region);
    if (!hit) { _recordFail(gm, 'building', region, '未找到地块'); return { ok: false, reason: '未找到地块:' + region + '(区划树中无此名)' }; }
    var div = hit.div;
    if (/start|开建|兴工|build/.test(action)) {
      if (!input.name) return { ok: false, reason: '兴工缺 name(工程名)' };
      if (!Array.isArray(div.buildings)) div.buildings = [];
      var turns = Math.max(1, parseInt(input.turns, 10) || 3);
      div.buildings.push({ name: input.name, status: 'building', costActual: Number(input.cost) || 0, remainingTurns: turns, startTurn: gm.turn || 0, timeActual: turns, level: Number(input.level) || 1, _agent: true });
      _report(gm, { type: 'change', path: 'div(' + region + ').buildings', new: input.name + '(兴工·' + turns + '回合)', reason: (input.reason || '') + '·兴工', turn: gm.turn || 0, _agent: true, _op: 'building_start' });
      return { ok: true, region: region, name: input.name };
    }
    if (/demolish|拆|罢|cancel|撤/.test(action)) {
      if (!input.name || !Array.isArray(div.buildings)) return { ok: false, reason: '缺 name 或该地无工程' };
      var idx = -1; for (var i = 0; i < div.buildings.length; i++) { if (div.buildings[i] && div.buildings[i].name === input.name) { idx = i; break; } }
      if (idx < 0) return { ok: false, reason: '未找到工程:' + input.name };
      var bld = div.buildings[idx];
      var revFn = root.TM && root.TM.BuildingWorks && root.TM.BuildingWorks.revertBuilding;
      if (typeof revFn === 'function') { try { revFn(div, bld); } catch (e) {} }  // 逆回完工经济效果(未完工无 appliedDelta=no-op)
      div.buildings.splice(idx, 1);
      _report(gm, { type: 'change', path: 'div(' + region + ').buildings', old: input.name, new: '(拆毁)', reason: (input.reason || '') + '·拆毁', turn: gm.turn || 0, _agent: true, _op: 'building_demolish' });
      return { ok: true, region: region, name: input.name };
    }
    return { ok: false, reason: '未知 action(start 兴工 / demolish 拆毁)' };
  }

  // ── ① 行政区划改制(设府/废县/改隶/升降)·无引擎·裸改 adminHierarchy(谨慎·只放行安全字段)──
  function _semDivision(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var action = String((input && input.action) || 'modify').toLowerCase();
    var region = input && input.region;
    if (/modify|改|改制|改隶|升|降/.test(action)) {
      if (!region) return { ok: false, reason: '缺 region' };
      var hit = _walkDiv(gm, region);
      if (!hit) return { ok: false, reason: '未找到地块:' + region };
      var fields = (input && input.fields) || {};
      var allow = ['name', 'regionType', 'level', 'governor', 'note', 'specialCulture', 'parentId'];  // 安全可改(非引擎重算账)
      var changed = [];
      allow.forEach(function (f) { if (fields[f] !== undefined) { hit.div[f] = fields[f]; changed.push(f + '=' + fields[f]); } });
      if (!changed.length) return { ok: false, reason: '无可改字段(fields 支持:' + allow.join('/') + ')' };
      _report(gm, { type: 'change', path: 'div(' + region + ')', new: changed.join(' '), reason: (input.reason || '') + '·区划改制', turn: gm.turn || 0, _agent: true, _op: 'division_modify' });
      return { ok: true, region: region };
    }
    if (/remove|废|裁|撤/.test(action)) {
      if (!region) return { ok: false, reason: '缺 region' };
      var hitR = _walkDiv(gm, region);
      if (!hitR) return { ok: false, reason: '未找到地块:' + region };
      hitR.parentArr.splice(hitR.idx, 1);
      _report(gm, { type: 'change', path: 'div(' + region + ')', old: region, new: '(废除)', reason: (input.reason || '') + '·废区划', turn: gm.turn || 0, _agent: true, _op: 'division_remove' });
      return { ok: true, region: region };
    }
    if (/add|设|增|置/.test(action)) {
      if (!input || !input.name) return { ok: false, reason: '设区划缺 name' };
      var parentHit = input.parent ? _walkDiv(gm, input.parent) : null;
      if (!parentHit) return { ok: false, reason: '设区划需 parent(上级地块名·须存在)' };
      var pd = parentHit.div; var plist = pd.children || pd.divisions || (pd.children = []);
      plist.push({ name: input.name, regionType: input.regionType || 'county', level: input.level || 3, _agent: true });
      _report(gm, { type: 'change', path: 'div(' + input.parent + ').children', new: input.name + '(新设)', reason: (input.reason || '') + '·设区划', turn: gm.turn || 0, _agent: true, _op: 'division_add' });
      return { ok: true, region: input.name };
    }
    return { ok: false, reason: '未知 action(modify 改制 / add 设 / remove 废)' };
  }

  // ── 人物所在地(移驻/在途)·软字段 ch.location/_travelTo(渲染"现居X·正往Y") ──
  function _semMoveChar(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var nm = input && input.name;
    if (!nm) return { ok: false, reason: '缺 name(人物名)' };
    var loc = input && input.location;
    if (loc == null || loc === '') return { ok: false, reason: '缺 location(目的地)' };
    var ch = (gm.chars || []).filter(function (c) { return c && c.name === nm; })[0];
    if (!ch) { _recordFail(gm, 'move_char', nm, '未找到人物'); return { ok: false, reason: '未找到人物:' + nm }; }
    var old = ch.location || '';
    loc = String(loc).slice(0, 60);
    if (input.traveling) { ch._travelTo = loc; }                 // 在途:现居不变·正往 loc
    else { ch.location = loc; ch._travelTo = ''; }               // 已抵:现居 loc
    ch._changed = true;
    _report(gm, { type: 'change', path: 'chars/' + nm + '/location', old: old, new: (input.traveling ? ('(正往)' + loc) : loc), reason: (input.reason || '') + (input.traveling ? '·启程' : '·移驻'), turn: gm.turn || 0, _agent: true, _op: 'move_character' });
    return { ok: true, path: 'chars/' + nm + '/location', old: old, new: loc };
  }

  // ── 迁都·朝廷 GM.capital(+_capitalHistory·镜像 apply move_capital) / 某势力 fac.capital ──
  function _semCapital(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var cap = input && (input.capital || input.to);
    if (!cap) return { ok: false, reason: '缺 capital(新都名)' };
    cap = String(cap).slice(0, 40);
    if (input.faction) {                                          // 某势力迁都
      var fac = (gm.facs || []).filter(function (f) { return f && (f.name === input.faction || f.id === input.faction); })[0];
      if (!fac) { _recordFail(gm, 'capital', input.faction, '未找到势力'); return { ok: false, reason: '未找到势力:' + input.faction }; }
      var oldF = fac.capital || '';
      if (oldF === cap) return { ok: false, reason: '已是该势力之都' };
      fac.capital = cap;
      _report(gm, { type: 'change', path: 'facs/' + fac.name + '/capital', old: oldF, new: cap, reason: (input.reason || '') + '·迁都', turn: gm.turn || 0, _agent: true, _op: 'relocate_capital' });
      return { ok: true, path: 'facs/' + fac.name + '/capital', old: oldF, new: cap };
    }
    var oldC = gm.capital || gm._capital || '';                   // 朝廷迁都
    if (oldC === cap) return { ok: false, reason: '已是国都' };
    if (!Array.isArray(gm._capitalHistory)) gm._capitalHistory = [];
    gm._capitalHistory.push({ turn: gm.turn || 0, from: oldC, to: cap, reason: input.reason || '迁都', _agent: true });
    gm.capital = cap;
    _report(gm, { type: 'change', path: 'capital', old: oldC, new: cap, reason: (input.reason || '') + '·迁都', turn: gm.turn || 0, _agent: true, _op: 'relocate_capital' });
    return { ok: true, path: 'capital', old: oldC, new: cap };
  }

  // ── 地块易主→变色·复用 canonical setMapRegionOwner(tm-map-system.js·改 owner+color+ownerHistory+turnChanges.map+updateMapColors 重绘) ──
  function _semRegionOwner(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var region = input && (input.region || input.regionId || input.regionName);
    if (!region) return { ok: false, reason: '缺 region(地块名/id)' };
    var newOwner = input && (input.newOwner || input.owner || input.toFaction);
    if (!newOwner) return { ok: false, reason: '缺 newOwner(新归属势力)' };
    var fn = root.setMapRegionOwner;
    if (typeof fn !== 'function') { _recordFail(gm, 'region_owner', region, 'setMapRegionOwner 未加载'); return { ok: false, reason: 'setMapRegionOwner 未加载(地图系统未就绪)' }; }
    var res;
    try { res = fn(region, newOwner, { reason: input.reason || '领地易主' }); }
    catch (e) { _recordFail(gm, 'region_owner', region, 'engine 异常:' + (e && e.message)); return { ok: false, reason: 'engine 异常:' + (e && e.message) }; }
    if (!res) { _recordFail(gm, 'region_owner', region, '未找到地块'); return { ok: false, reason: '未找到地块:' + region + '(地图区域无此名)' }; }
    var _newName = (res && (res.ownerName || res.factionName || res.owner)) || newOwner;
    _report(gm, { type: 'change', path: 'map/' + (res.name || region) + '/owner', new: _newName, reason: (input.reason || '') + '·地块易主(变色)', turn: gm.turn || 0, _agent: true, _op: 'change_region_owner' });
    return { ok: true, path: 'map/' + (res.name || region) + '/owner', new: _newName };
  }

  // ── 地块状态:按名(_walkDiv)改区划软状态(民心/繁荣)·这些 engine-first 后写为本回合最终值·下回合引擎从此演化 ──
  //   命门:只放行软状态(AI 推演直接影响)·人口(div.population 对象·人口引擎管)/财赋(div.fiscal·财政引擎账)/聚合派生字段不在此·那些走专用工具或由引擎结算·勿直改(会被重算覆盖)。
  var _REGION_SOFT = { minxin: [0, 100], minxinLocal: [0, 100], prosperity: [0, 100] };
  function _semRegionState(gm, input) {
    if (!gm) return { ok: false, reason: '无存档' };
    var region = input && (input.region || input.regionName);
    if (!region) return { ok: false, reason: '缺 region(地块名)' };
    var field = input && input.field;
    if (!field || !_REGION_SOFT[field]) return { ok: false, reason: 'field 须为软状态之一:' + Object.keys(_REGION_SOFT).join('/') + '(民心 minxin/繁荣 prosperity·人口/财赋/军备等引擎账请用专用工具·勿直改)' };
    var hit = _walkDiv(gm, region);
    if (!hit) { _recordFail(gm, 'region_state', region, '未找到地块'); return { ok: false, reason: '未找到地块:' + region + '(区划树中无此名)' }; }
    var div = hit.div;
    var rng = _REGION_SOFT[field];
    var old = (typeof div[field] === 'number') ? div[field] : null;
    var nv;
    if (input.delta != null) { var base = (old == null) ? 60 : old; nv = base + Number(input.delta); }
    else if (input.value != null) { nv = Number(input.value); }
    else return { ok: false, reason: '需 value(设为) 或 delta(增减) 之一' };
    if (isNaN(nv) || !isFinite(nv)) return { ok: false, reason: '值非法(NaN/Inf)' };
    nv = Math.max(rng[0], Math.min(rng[1], Math.round(nv)));
    div[field] = nv;
    if (field === 'minxin' && typeof div.minxinLocal === 'number') div.minxinLocal = nv;        // 民心同步本地账
    if (field === 'minxinLocal' && typeof div.minxin === 'number') div.minxin = nv;
    _report(gm, { type: 'change', path: 'div(' + region + ').' + field, old: old, new: nv, reason: (input.reason || '') + '·地块状态', turn: gm.turn || 0, _agent: true, _op: 'adjust_region_state' });
    return { ok: true, path: 'div(' + region + ').' + field, old: old, new: nv };
  }

  // ── 通用守护写工具(3) + 语义写工具(4·硬核账走引擎) + 删除(1) ──
  var DEFS = [
    { name: 'set_field', description: '设置存档任意字段为新值(路径化)。如 path="chars.0.mood" value="忧"。用于剧情/心境/关系等软字段。【勿用于国库/任职等硬核结构化账·那些用 adjust_treasury/appoint_official】', parameters: { type: 'object', properties: { path: { type: 'string' }, value: { description: '新值·任意类型(数/串/对象/数组)' }, reason: { type: 'string', description: '推演依据·会进回合报告' } }, required: ['path', 'value'] } },
    { name: 'adjust_field', description: '对数值字段增减(在原值上 +delta)。如 path="minxin" delta=-5。用于软数值。【国库增减用 adjust_treasury·勿裸改 guoku】', parameters: { type: 'object', properties: { path: { type: 'string' }, delta: { type: 'number' }, reason: { type: 'string', description: '推演依据·会进回合报告' } }, required: ['path', 'delta'] } },
    { name: 'push_field', description: '向数组字段追加一项。如 path="evtLog" value={turn,type,text}。新增事件/记录/条目时用。', parameters: { type: 'object', properties: { path: { type: 'string' }, value: { description: '要追加的项·任意类型' }, reason: { type: 'string', description: '推演依据·会进回合报告' } }, required: ['path', 'value'] } },
    // ── 语义写工具:硬核结构化账走真引擎(裸 path 写会落错字段) ──
    { name: 'adjust_treasury', description: '增减国库(走财政引擎·正确记账+面板同步)。delta 负=支出(赈灾/赏赐/军费)·正=入账(贡赋/赔款/互市)。currency: money(默认)/grain/cloth。**改国库必须用此·勿用 set_field/adjust_field 裸改 guoku**。', parameters: { type: 'object', properties: { delta: { type: 'number' }, currency: { type: 'string', description: 'money(默认)/grain/cloth' }, reason: { type: 'string', description: '推演依据·会进回合报告' } }, required: ['delta'] } },
    { name: 'appoint_official', description: '任命官员到某职位(走人事引擎·联动仕途/俸禄/公库/势力)。**改任职用此·勿裸改 chars**。', parameters: { type: 'object', properties: { name: { type: 'string', description: '人物名' }, position: { type: 'string', description: '官职' }, reason: { type: 'string' } }, required: ['name', 'position'] } },
    { name: 'dismiss_official', description: '罢免/去职某官员(走人事引擎·正确解绑公库/状态)。', parameters: { type: 'object', properties: { name: { type: 'string', description: '人物名' }, reason: { type: 'string' } }, required: ['name'] } },
    { name: 'remove_field', description: '删除数组中的一项(推演后果:部队覆灭/党派清洗/阶层消亡/势力剪除等)。path=数组路径(如 parties/classes/armies/facs)·用 index(下标数字) 或 match(id/名称) 指定删哪项。**禁删玩家本人/玩家势力**·确属推演结果才删。', parameters: { type: 'object', properties: { path: { type: 'string' }, index: { type: 'number', description: '要删项的下标(与 match 二选一)' }, match: { type: 'string', description: '要删项的 id/名称(与 index 二选一)' }, reason: { type: 'string' } }, required: ['path'] } },
    { name: 'adjust_fiscal_item', description: '增/改/停/删收入支出流水项(开税源/砍军费/设年例·走财政引擎立即作用余额·勿裸改guoku)。kind=income/expense·action=add(默认)/update/stop/remove·target=guoku(默认)/neitang/province:地名·amount金额(增改需正)·recurring年例。', parameters: { type: 'object', properties: { kind: { type: 'string', description: 'income收入/expense支出' }, action: { type: 'string', description: 'add/update/stop/remove' }, target: { type: 'string', description: 'guoku/neitang/province:地名' }, name: { type: 'string', description: '项目名(如盐税/辽东军费)' }, category: { type: 'string' }, amount: { type: 'number' }, resource: { type: 'string', description: 'money(默认)/grain/cloth' }, recurring: { type: 'boolean' }, reason: { type: 'string' } }, required: ['kind'] } },
    // ── ② 军事指挥 ③ 外交战和(走真引擎) ──
    { name: 'command_army', description: '军事指挥:募兵/调动/改将/创建/解散(走军队引擎·勿裸改armies)。armyName军名·soldiersDelta兵力增减·location移防·commander主将·action=create创建·state=disbanded解散。', parameters: { type: 'object', properties: { armyName: { type: 'string' }, soldiersDelta: { type: 'number' }, soldiers: { type: 'number' }, location: { type: 'string' }, commander: { type: 'string' }, action: { type: 'string' }, state: { type: 'string' }, faction: { type: 'string' }, reason: { type: 'string' } }, required: ['armyName'] } },
    { name: 'diplomatic_action', description: '外交战和(走外交引擎·勿裸改activeWars/stance):action=declare_war宣战(attacker/defender·可casusBelli)/make_peace议和(warId 或 attacker+defender定位)/set_relation设邦交(from/to + value绝对值或delta增减或type关系)。', parameters: { type: 'object', properties: { action: { type: 'string', description: 'declare_war/make_peace/set_relation' }, attacker: { type: 'string' }, defender: { type: 'string' }, casusBelli: { type: 'string' }, warId: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, value: { type: 'number' }, delta: { type: 'number' }, type: { type: 'string' }, reason: { type: 'string' } }, required: ['action'] } },
    // ── ④ 建筑工程 ① 行政区划改制 ──
    { name: 'building_project', description: '建筑工程(走营造引擎):action=start兴工(region地块开建·引擎逐回合推进自动完工)/demolish拆毁(逆回经济效果)。region地块名·name工程名·turns工期(默认3)·cost耗费·level等级。', parameters: { type: 'object', properties: { action: { type: 'string', description: 'start/demolish' }, region: { type: 'string', description: '地块名' }, name: { type: 'string', description: '工程名' }, turns: { type: 'number' }, cost: { type: 'number' }, level: { type: 'number' }, reason: { type: 'string' } }, required: ['region'] } },
    { name: 'restructure_division', description: '行政区划改制(设府/废县/改隶/升降·裸改谨慎):action=modify改制(fields:name/regionType/level/governor/改隶用parentId)/add设新区划(需parent)/remove废区划。region=目标地块名。', parameters: { type: 'object', properties: { action: { type: 'string', description: 'modify/add/remove' }, region: { type: 'string' }, fields: { type: 'object', description: 'name/regionType/level/governor/parentId' }, parent: { type: 'string', description: 'add 上级地块名' }, name: { type: 'string', description: 'add 新区划名' }, regionType: { type: 'string' }, level: { type: 'number' }, reason: { type: 'string' } }, required: ['action'] } },
    // ── 舆地变迁:人物所在地 / 迁都 / 地块易主变色 ──
    { name: 'move_character', description: '更改人物所在地(移驻/赴任/在途)。name 人物名·location 目的地名·traveling=true 则记"正往(在途未到)"、false(默认)记"现居(已抵)"。用于人物因任职/出征/流放/还朝而移动。', parameters: { type: 'object', properties: { name: { type: 'string', description: '人物名' }, location: { type: 'string', description: '目的地(地名)' }, traveling: { type: 'boolean', description: 'true=在途未到/false=已抵(默认)' }, reason: { type: 'string' } }, required: ['name', 'location'] } },
    { name: 'relocate_capital', description: '迁都。capital 新都名。不带 faction=朝廷迁都(写 GM.capital + _capitalHistory);带 faction=某势力迁都(写 fac.capital)。用于推演出迁都/陪都/势力易治所之事。', parameters: { type: 'object', properties: { capital: { type: 'string', description: '新都名' }, faction: { type: 'string', description: '可选·某势力名(缺=朝廷)' }, reason: { type: 'string' } }, required: ['capital'] } },
    { name: 'change_region_owner', description: '地块易主→地图变色(走 canonical setMapRegionOwner·改 owner + 颜色 + 易主史 + turnChanges + 重绘地图)。region 地块名·newOwner 新归属势力名。用于推演出攻占/割让/归附/叛附致领地所有者变迁。', parameters: { type: 'object', properties: { region: { type: 'string', description: '地块名/id' }, newOwner: { type: 'string', description: '新归属势力名' }, reason: { type: 'string' } }, required: ['region', 'newOwner'] } },
    { name: 'adjust_region_state', description: '改地块软状态(按地块名定位):民心 minxin / 繁荣 prosperity(0-100)。value 设为定值 或 delta 增减。用于推演出某地兵燹/灾荒/善政致民心繁荣升降。【人口/财赋/军备等硬核账由引擎结算·勿用此·那些用 adjust_fiscal_item/command_army 等或交给引擎】。', parameters: { type: 'object', properties: { region: { type: 'string', description: '地块名' }, field: { type: 'string', description: 'minxin 民心 / minxinLocal / prosperity 繁荣' }, value: { type: 'number', description: '设为定值(0-100·与 delta 二选一)' }, delta: { type: 'number', description: '在原值上增减(与 value 二选一)' }, reason: { type: 'string' } }, required: ['region', 'field'] } }
  ];
  var TOOL_SET = {}; DEFS.forEach(function (d) { TOOL_SET[d.name] = true; });

  function _brief(v) { try { var s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > 60 ? s.slice(0, 60) + '…' : String(s); } catch (e) { return String(v); } }

  // handle(name, input, ctx) → {ok, name, text, result}·async(与只读工具统一·便于 S4 循环统一 await)
  async function handle(name, input, ctx) {
    input = input || {};
    var gm = _GM(ctx);
    var reason = input.reason || 'agent 推演';
    var r;
    switch (name) {
      case 'set_field':    r = _guarded(gm, 'set', input.path, input.value, reason); break;
      case 'adjust_field': r = _guarded(gm, 'adjust', input.path, input.delta, reason); break;
      case 'push_field':   r = _guarded(gm, 'push', input.path, input.value, reason); break;
      case 'adjust_treasury':  r = _semTreasury(gm, input); break;
      case 'appoint_official': r = _semAppoint(gm, input); break;
      case 'dismiss_official': r = _semDismiss(gm, input); break;
      case 'remove_field':     r = _semRemove(gm, input); break;
      case 'adjust_fiscal_item': r = _semFiscalItem(gm, input); break;
      case 'command_army':       r = _semArmy(gm, input); break;
      case 'diplomatic_action':  r = _semDiplomacy(gm, input); break;
      case 'building_project':   r = _semBuilding(gm, input); break;
      case 'restructure_division': r = _semDivision(gm, input); break;
      case 'move_character':       r = _semMoveChar(gm, input); break;
      case 'relocate_capital':     r = _semCapital(gm, input); break;
      case 'change_region_owner':  r = _semRegionOwner(gm, input); break;
      case 'adjust_region_state':  r = _semRegionState(gm, input); break;
      default: return { ok: false, name: name, text: '(未知写工具:' + name + ')' };
    }
    var text = r.ok
      ? '✓ 已改 ' + (r.path || input.path || r.target || r.region || name) + (r.old !== undefined ? ' :' + _brief(r.old) + '→' + _brief(r.new) : (r.new !== undefined ? ' =' + _brief(r.new) : '')) + '(已落地·入回合报告)'
      : '✗ ' + name + ' 未落地:' + r.reason + ' —— 据此修正参数后重试(或改用更合适的工具)';
    return { ok: r.ok, name: name, text: text, result: r };
  }

  function defs() { return DEFS.slice(); }
  function isToolName(name) { return Object.prototype.hasOwnProperty.call(TOOL_SET, name); }

  TM.Endturn.AgentWriteTools = {
    defs: defs,
    DEFS: DEFS,
    handle: handle,
    isToolName: isToolName,
    guardedWrite: _guarded,          // 测试 / S4 循环可直用
    isEngineOwned: _isEngineOwned,
    isPlayerProtected: _isPlayerProtected,
    PLAYER_PROTECTED_PATHS: PLAYER_PROTECTED_PATHS,
    ENGINE_OWNED: ENGINE_OWNED
  };
})(typeof window !== 'undefined' ? window : globalThis);

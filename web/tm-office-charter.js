// ============================================================
//  tm-office-charter.js — 设衙章程演绎层（设新衙门批一·2026-07-21）
//
//  实体化≠模板化：玩家下诏设新衙门后·拟制态期间由 AI 拟「开衙章程」——正名/职掌/
//  官职表(名·品级·编制·职权·月俸)/首任荐单/开办费。廷议裁定仍走 tm-office-reform
//  抵抗管线(宪法层)·准/部分落树时按章程落全结构；AI 缺席或章程验废→现行裸壳落树=双轨零回归。
//
//  宪法闸(_validateCharter·只验不产)：品级须在本朝品级表(_activeRankHierarchy·跨朝代)·
//  职权⊆九权词表且每职≤3·职数≤6·员额1-8·月俸夹取品级俸×[0.5,2]·开办费夹取[500,30000]·
//  首任只荐在档活人(非玩家·≤3)·重名正名回退玩家原名。开办费国库真扣在裁定落树侧(tm-office-reform)。
//
//  flag officeCharterEnabled(默认关·设置→官制活化细粒度)·只对「增设衙门级」拟章·
//  增设单官职(oc.position)不拟章(照旧)。承载=_enqueuePostTurnJob·失败静默回裸壳。
// ============================================================
(function (global) {
  'use strict';

  var MAX_POSITIONS = 6;      // 一衙职数封顶(防 AI 开衙即造小朝廷)
  var MAX_HEADCOUNT = 8;      // 单职员额封顶
  var MAX_POWERS_PER_POS = 3; // 单职职权封顶
  var SETUP_COST_MIN = 500, SETUP_COST_MAX = 30000;   // 开办费夹取带(两)
  // 九权词表(镜像 tm-office-powermap POWER_LABEL·勿自造键)
  var POWER_KEYS = ['taxCollect', 'militaryCommand', 'appointment', 'impeach', 'supervise', 'yinBu', 'judicial', 'works', 'drafting'];
  var POWER_CN = { taxCollect: '征税', militaryCommand: '调兵', appointment: '辟署', impeach: '弹劾', supervise: '监察', yinBu: '荐荫', judicial: '刑狱', works: '营造', drafting: '票拟' };
  var AUTH_SET = { decision: 1, execution: 1, advisory: 1, supervision: 1 };

  function enabled() {
    try { return typeof global.officeFlagOn === 'function' && global.officeFlagOn('officeCharterEnabled'); }
    catch (_) { return false; }
  }
  function _aiOn() {
    try { return typeof global.callAI === 'function'; } catch (_) { return false; }
  }
  function _eb(msg) {
    try { if (typeof global.addEB === 'function') global.addEB('官制改革', msg); } catch (_) {}
  }
  function _rankTable() {
    try { if (typeof global._activeRankHierarchy === 'function') return global._activeRankHierarchy() || null; } catch (_) {}
    return null;
  }
  function _rankEntry(H, rankStr) {
    if (!H || !rankStr) return null;
    for (var i = 0; i < H.length; i++) { if (H[i] && H[i].label && String(rankStr).indexOf(H[i].label) >= 0) return H[i]; }
    return null;
  }
  function _findChar(name) {
    try { if (typeof global.findCharByName === 'function') return global.findCharByName(name); } catch (_) {}
    return null;
  }
  // 衙门级增设判定(与 tm-office-reform._reformKind 的 add 语义对齐·但只认衙门级=无 position)
  function _isDeptAdd(item) {
    if (!item || item.position) return false;
    return /增设|新设|增置|创设/.test(String(item.reformDetail || ''));
  }
  function _treeNames(G) {
    var out = [];
    (function walk(ns) {
      (ns || []).forEach(function (n) { if (n && n.name) { out.push(n.name); if (n.subs) walk(n.subs); } });
    })(G.officeTree);
    return out;
  }

  // ── 宪法闸：AI 章程原料→合规章程(废则 null→裸壳双轨) ──────────────────────
  function _validateCharter(G, j, item) {
    if (!j || typeof j !== 'object') return null;
    var H = _rankTable();
    var existing = _treeNames(G);
    // 目标名：顶层增设=dept·某部下增设子衙=newDept(AI 写端 office_changes 形态)
    var playerName = item ? String(item.newDept || item.dept || '') : '';
    // 正名：2-12字·与现有衙门重名→回退玩家原名(玩家原名即目标名·不算重名)
    var name = String(j.name || '').trim().slice(0, 12);
    if (!name || (name !== playerName && existing.indexOf(name) >= 0)) name = playerName;
    if (!name) return null;
    var positions = [];
    (Array.isArray(j.positions) ? j.positions : []).slice(0, MAX_POSITIONS).forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      var pn = String(p.name || '').trim().slice(0, 14);
      if (pn.length < 2) return;
      var re = H ? _rankEntry(H, p.rank) : null;
      if (H && !re) return;                       // 有品级表则品级必须在表(宪法闸)·无表(裸跑)从宽
      var rank = re ? (String(p.rank).trim() || re.label) : String(p.rank || '').slice(0, 10);
      var baseSal = re ? (Number(re.salary) || 20) : 20;
      var sal = Math.round(Number(p.salary));
      if (!isFinite(sal) || sal <= 0) sal = baseSal;
      sal = Math.max(Math.ceil(baseSal * 0.5), Math.min(baseSal * 2, sal));   // 月俸循品级俸 band
      var cnt = Math.round(Number(p.count));
      if (!isFinite(cnt) || cnt < 1) cnt = 1;
      if (cnt > MAX_HEADCOUNT) cnt = MAX_HEADCOUNT;
      var powers = (Array.isArray(p.powers) ? p.powers : []).filter(function (k) { return POWER_KEYS.indexOf(k) >= 0; }).slice(0, MAX_POWERS_PER_POS);
      var authority = (p.authority && AUTH_SET[p.authority]) ? p.authority : '';
      positions.push({
        name: pn, rank: rank, count: cnt, salary: sal,
        powers: powers, authority: authority,
        duties: String(p.duties || '').slice(0, 30)
      });
    });
    if (!positions.length) return null;
    var heads = [];
    var posNames = positions.map(function (p) { return p.name; });
    (Array.isArray(j.heads) ? j.heads : []).forEach(function (h) {
      if (heads.length >= 3 || !h || typeof h !== 'object') return;
      var hp = String(h.position || '');
      if (posNames.indexOf(hp) < 0) return;
      var ch = _findChar(String(h.name || ''));
      if (!ch || ch.alive === false || ch.isPlayer) return;
      if (heads.some(function (x) { return x.name === ch.name; })) return;
      heads.push({ position: hp, name: ch.name, reason: String(h.reason || '').slice(0, 30) });
    });
    var setup = Math.round(Number(j.setupCost));
    if (!isFinite(setup) || setup <= 0) setup = 2000 * positions.length;
    setup = Math.max(SETUP_COST_MIN, Math.min(SETUP_COST_MAX, setup));
    return {
      name: name, desc: String(j.desc || '').slice(0, 40),
      positions: positions, heads: heads, setupCost: setup
    };
  }

  // ── 章程 subcall(拟制态期间一次·失败静默→裸壳双轨) ────────────────────────
  function _buildPrompt(G, item) {
    var H = _rankTable();
    var rankLine = H ? H.map(function (r) { return r.label; }).join('·') : '(依本朝常制)';
    var tops = (G.officeTree || []).map(function (n) {
      var subs = (n.subs || []).map(function (s) { return s.name; }).filter(Boolean);
      return n.name + (subs.length ? ('(' + subs.slice(0, 6).join('/') + ')') : '');
    }).slice(0, 14).join('·');
    var cands = (G.chars || [])
      .filter(function (c) { return c && c.alive !== false && !c.isPlayer && !c._revoltEntity && (Number(c.loyalty) || 50) >= 40; })
      .sort(function (a, b) { return (Number(b.administration) || 0) - (Number(a.administration) || 0); })
      .slice(0, 6)
      .map(function (c) { return c.name + '(' + (c.officialTitle || '在野') + '·政' + (Number(c.administration) || 0) + '·忠' + (Number(c.loyalty) || 0) + ')'; });
    var powerLine = POWER_KEYS.map(function (k) { return k + '=' + POWER_CN[k]; }).join('·');
    var silver = (G.guoku && Number(G.guoku.balance)) || 0;
    return '你是天命推演引擎的典制演绎官。君上下诏设立新衙门「' + (item.newDept || item.dept || '') + '」'
      + (item.reason ? '(诏旨事由：' + String(item.reason).slice(0, 60) + ')' : '') + '·此议正在拟制·须为其拟定开衙章程。\n'
      + '【本朝品级】' + rankLine + '\n'
      + '【职权词表(键名=义)】' + powerLine + '\n'
      + '【现有衙门】' + (tops || '无') + '（正名勿与现有重名·职掌与现有衙门之权相侵者·廷议抵抗必重）\n'
      + (cands.length ? '【在档可用之才】' + cands.join('·') + '\n' : '')
      + '【帑廪】余银约 ' + silver + ' 两\n'
      + '要求：衙门正名须像真实官署名(2-8字·亦可沿用君上所命之名)·官职1-' + MAX_POSITIONS + '个(首列主官)·'
      + '各职定品级(必须取自本朝品级表)·编制员额·职权(每职至多' + MAX_POWERS_PER_POS + '项·只用词表键名·无则空)·'
      + '月俸(石·大体循品级)·职掌一句。首任可从在档之才中荐(至多3人·亦可不荐)。开办费(两)据规模实估。只返回 JSON：\n'
      + '{"name":"正名","desc":"职掌≤40字","positions":[{"name":"职名","rank":"品级","count":1,"powers":["键名"],"authority":"decision|execution|advisory|supervision","salary":38,"duties":"≤30字"}],"heads":[{"position":"职名","name":"人名","reason":"≤30字"}],"setupCost":3000}';
  }

  async function forgeCharter(G, item) {
    if (!_aiOn() || !item) return null;
    try {
      var resp = await global.callAI(_buildPrompt(G, item), 1200, null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'office-charter' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      var v = _validateCharter(G, j, item);
      if (v) {
        item._charter = v;
        delete item._charterPending;
        _eb('«' + v.name + '»开衙章程已拟：' + v.positions.map(function (p) { return p.name + '(' + p.rank + '×' + p.count + ')'; }).join('·') + '·开办约' + v.setupCost + '两·待廷议裁定');
        return v;
      }
    } catch (_eF) {}
    delete item._charterPending;   // 失败→裁定时裸壳落树(双轨)
    return null;
  }

  // ── 每回合 tick：给拟制中的衙门级增设派章程锻造(一次·幂等) ──────────────────
  function tick(G) {
    if (!enabled()) return;
    G = G || global.GM;
    if (!G || !Array.isArray(G._pendingReforms) || !G._pendingReforms.length) return;
    if (!_aiOn()) return;   // 无 AI→裁定时裸壳兜底(双轨)
    G._pendingReforms.forEach(function (item) {
      if (!item || item.status !== '拟制中' || !_isDeptAdd(item)) return;
      if (item._charter || item._charterPending != null) return;
      item._charterPending = G.turn || 0;
      var job = function () { return forgeCharter(G, item); };
      if (typeof global._enqueuePostTurnJob === 'function') global._enqueuePostTurnJob('officeCharter_' + (item._key || item.dept || ''), job);
      else job();
    });
  }

  var API = { tick: tick, forgeCharter: forgeCharter, _validateCharter: _validateCharter, _buildPrompt: _buildPrompt, enabled: enabled, POWER_KEYS: POWER_KEYS, MAX_POSITIONS: MAX_POSITIONS, SETUP_COST_MIN: SETUP_COST_MIN, SETUP_COST_MAX: SETUP_COST_MAX };
  global.TM = global.TM || {};
  global.TM.OfficeCharter = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  try {
    if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
      global.SettlementPipeline.register('officeCharter', '章程演绎', function () {
        try { tick(global.GM); } catch (_eT) {}
      }, 93, 'perturn');
    }
  } catch (_eR) {}
})(typeof window !== 'undefined' ? window : globalThis);

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

  async function forgeCharter(G, item, opts) {
    if (!_aiOn() || !item) return null;
    try {
      var resp = await global.callAI(_buildPrompt(G, item), 1200, null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'office-charter' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      var v = _validateCharter(G, j, item);
      if (v) {
        item._charter = v;
        delete item._charterPending;
        if (!(opts && opts.silent)) _eb('«' + v.name + '»开衙章程已拟：' + v.positions.map(function (p) { return p.name + '(' + p.rank + '×' + p.count + ')'; }).join('·') + '·开办约' + v.setupCost + '两·待廷议裁定');
        return v;
      }
    } catch (_eF) {}
    delete item._charterPending;   // 失败→裁定时裸壳落树(双轨)
    return null;
  }

  // ── 批四·旧账收口：dynamicInstitutions 一次性迁入官制树（owner 拍板分叉③）──────
  // 权设台账衙门(浅账·永长不成真衙)→经 applyReformToTree 正门落 officeTree 真节点·著为定制。
  // 岁支旧账停走(tm-edict-parser tick 见 _migratedToTree 即跳)·俸给改循官制 calcSalary。
  // 有 AI 则补章程充实职官表(俸循品级·失败留裸节点亦成体统)·旧掌其事者荐正授入建议库。
  // flag officeDynMigrationEnabled 默认关·幂等(逐 inst 标记)·同名并账不重立。
  function migEnabled() {
    try { return typeof global.officeFlagOn === 'function' && global.officeFlagOn('officeDynMigrationEnabled'); }
    catch (_) { return false; }
  }
  function _findTreeNode(G, name) {
    var hit = null;
    (function walk(ns) {
      (ns || []).forEach(function (n) { if (!hit && n) { if (n.name === name) { hit = n; return; } walk(n.subs); } });
    })(G.officeTree);
    return hit;
  }
  async function _furnishMigratedNode(G, inst) {
    var node = _findTreeNode(G, inst.name);
    if (!node || (node.positions && node.positions.length)) return;   // 已有职官(并账/他途充实)→不动
    var synth = { reformDetail: '增设', dept: inst.name, reason: inst.duties || '' };
    var v = await forgeCharter(G, synth, { silent: true });
    if (!v || typeof global._offCharterPositions !== 'function') return;
    node = _findTreeNode(G, inst.name);                               // 异步窗口后重找(防树已变)
    if (!node || (node.positions && node.positions.length)) return;
    node.positions = global._offCharterPositions(v, false);
    if (!node.desc && v.desc) node.desc = v.desc;
    _eb('«' + inst.name + '»迁制补章：定' + node.positions.map(function (p) { return p.name + '(' + p.rank + '×' + (p.establishedCount || 1) + ')'; }).join('·') + '·俸给循品级入官俸');
    (v.heads || []).forEach(function (h) {
      if (!Array.isArray(G._edictSuggestions)) G._edictSuggestions = [];   // arch-ok 迁制荐单入建议库·只荐不任守五渠道
      G._edictSuggestions.push({ source: '章程', from: '铨曹', content: '授' + h.name + '为' + inst.name + h.position + (h.reason ? '（' + h.reason + '）' : ''), turn: G.turn, used: false });   // arch-ok 同上
    });
  }
  function migrateDynInstitutions(G) {
    if (!migEnabled()) return;
    G = G || global.GM;
    if (!G || !Array.isArray(G.dynamicInstitutions) || !G.dynamicInstitutions.length) return;
    if (typeof global.applyReformToTree !== 'function' || !Array.isArray(G.officeTree)) return;
    G.dynamicInstitutions.forEach(function (inst) {
      if (!inst || inst._migratedToTree || inst.stage === 'abolished' || inst._viaReform) return;
      var name = String(inst.name || '').trim();
      if (!name) { inst._migratedToTree = true; return; }
      var existed = !!_findTreeNode(G, name);
      if (!existed) {
        var reform = (inst.subordinateTo && _findTreeNode(G, inst.subordinateTo))
          ? { reformDetail: '增设', dept: inst.subordinateTo, newDept: name, reason: inst.duties || '权设之衙·迁制归树' }
          : { reformDetail: '增设', dept: name, reason: inst.duties || '权设之衙·迁制归树' };
        var ap = global.applyReformToTree(G, reform);
        if (!ap || !ap.applied) return;   // 落树未成(异形树等)→下回合再试·不标记
      }
      inst._migratedToTree = true;
      inst.stage = 'migrated';
      _eb('«' + name + '»由权设台账归入官制树·著为定制' + (existed ? '（同名衙门已在树·并账不重立）' : ''));
      // 旧掌其事者·荐正授(确定性·不赖 AI)
      if (inst.headOfficial) {
        var hc = _findChar(String(inst.headOfficial));
        if (hc && hc.alive !== false && !hc.isPlayer) {
          if (!Array.isArray(G._edictSuggestions)) G._edictSuggestions = [];   // arch-ok 迁制正授荐单·只荐不任守五渠道
          G._edictSuggestions.push({ source: '章程', from: '铨曹', content: '授' + hc.name + '为«' + name + '»主官（旧掌其事·迁制正名）', turn: G.turn, used: false });   // arch-ok 同上
        }
      }
      // AI 补章程充实职官表(新落的裸节点才需要·失败留裸=亦成体统)
      if (!existed && _aiOn()) {
        var job = function () { return _furnishMigratedNode(G, inst); };
        if (typeof global._enqueuePostTurnJob === 'function') global._enqueuePostTurnJob('officeDynMig_' + name, job);
        else job();
      }
    });
  }

  // ── 批红修改（批二·owner 拍板：章程进廷议前玩家可改品级/编制/职权）────────────
  // edits.positions=[{name(锚·不可改),rank,count,powers[]}]·改后整章重过 _validateCharter=同一宪法闸
  // (换品级→月俸自动随新品级俸 band 重夹取·野键照滤·员额照夹)·首任荐单过滤到幸存职位·开办费不动。
  function _applyCharterRevision(G, item, edits) {
    if (!item || item.status !== '拟制中' || !item._charter) return { ok: false, reason: '此议已决或无章程可批' };
    var ch = item._charter;
    var byName = {};
    (Array.isArray(edits && edits.positions) ? edits.positions : []).forEach(function (e) { if (e && e.name) byName[e.name] = e; });
    var raw = {
      name: ch.name, desc: ch.desc, setupCost: ch.setupCost,
      heads: (ch.heads || []).map(function (h) { return { position: h.position, name: h.name, reason: h.reason }; }),
      positions: (ch.positions || []).map(function (p) {
        var e = byName[p.name] || {};
        return {
          name: p.name,
          rank: (e.rank != null ? e.rank : p.rank),
          count: (e.count != null ? e.count : p.count),
          powers: (Array.isArray(e.powers) ? e.powers : p.powers),
          authority: p.authority, salary: p.salary, duties: p.duties
        };
      })
    };
    var v = _validateCharter(G, raw, item);
    if (!v) return { ok: false, reason: '批红后章程无一职合式(品级须在本朝品级表)·未收' };
    v.setupCost = ch.setupCost;   // 开办费照旧案(批红不改钱·防边改边压价)
    item._charter = v;
    item._charterRevised = true;
    _eb('«' + v.name + '»章程御笔批红改定：' + v.positions.map(function (p) { return p.name + '(' + p.rank + '×' + p.count + ')'; }).join('·') + '·仍待廷议裁定');
    return { ok: true, charter: v };
  }

  // 批红弹窗（浏览器侧·smoke 不走 DOM 只验 _applyCharterRevision）
  function _charterReviewOpen(itemKey) {
    if (typeof document === 'undefined') return;
    var G = global.GM;
    if (!G || !Array.isArray(G._pendingReforms)) return;
    var item = null;
    for (var i = 0; i < G._pendingReforms.length; i++) {
      var it = G._pendingReforms[i];
      if (it && it._key === itemKey && it.status === '拟制中' && it._charter) { item = it; break; }
    }
    if (!item) { try { if (typeof global.toast === 'function') global.toast('此议已决或章程未拟'); } catch (_) {} return; }
    var ch = item._charter;
    var H = _rankTable() || [];
    var esc = (typeof global.escHtml === 'function') ? global.escHtml : function (s) { return String(s).replace(/</g, '&lt;'); };
    var bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
    var html = '<div style="background:var(--color-surface,#1c1917);border:1px solid var(--gold-500,#b08d3f);border-radius:8px;padding:1.1rem 1.3rem;max-width:560px;max-height:82vh;overflow-y:auto;">';
    html += '<div style="font-size:0.95rem;color:var(--gold,#c9a227);letter-spacing:0.08em;margin-bottom:0.35rem;">批红·«' + esc(ch.name) + '»开衙章程</div>';
    html += '<div style="font-size:0.7rem;color:var(--txt-d,#8a8378);margin-bottom:0.6rem;">' + esc(ch.desc || '') + ' · 开办 ' + ch.setupCost + ' 两（批红不改）· 改品级则月俸随品自正</div>';
    ch.positions.forEach(function (p, pi) {
      html += '<div data-pos="' + esc(p.name) + '" style="border-top:1px dotted var(--bdr,#3a352d);padding:0.45rem 0;">';
      html += '<b style="font-size:0.8rem;color:var(--gold,#c9a227);">' + esc(p.name) + '</b> ';
      html += '<select data-f="rank" style="font-size:0.72rem;background:transparent;color:inherit;border:1px solid var(--bdr,#3a352d);">';
      H.forEach(function (r) { html += '<option value="' + esc(r.label) + '"' + (p.rank.indexOf(r.label) >= 0 ? ' selected' : '') + '>' + esc(r.label) + '</option>'; });
      html += '</select> 员额<input data-f="count" type="number" min="1" max="' + MAX_HEADCOUNT + '" value="' + p.count + '" style="width:3em;font-size:0.72rem;background:transparent;color:inherit;border:1px solid var(--bdr,#3a352d);">';
      html += '<div style="margin-top:0.25rem;font-size:0.7rem;">';
      POWER_KEYS.forEach(function (k) {
        html += '<label style="margin-right:0.55rem;white-space:nowrap;cursor:pointer;"><input data-f="pw" data-k="' + k + '" type="checkbox"' + (p.powers.indexOf(k) >= 0 ? ' checked' : '') + ' style="vertical-align:-2px;">' + POWER_CN[k] + '</label>';
      });
      html += '</div></div>';
    });
    html += '<div style="text-align:right;margin-top:0.7rem;"><button class="bt" data-act="ok">批红定案</button> <button class="bt" data-act="close">罢</button></div>';
    html += '</div>';
    bg.innerHTML = html;
    bg.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t === bg || (t && t.getAttribute && t.getAttribute('data-act') === 'close')) { bg.remove(); return; }
      if (t && t.getAttribute && t.getAttribute('data-act') === 'ok') {
        var edits = { positions: [] };
        bg.querySelectorAll('[data-pos]').forEach(function (row) {
          var powers = [];
          row.querySelectorAll('[data-f="pw"]').forEach(function (cb) { if (cb.checked) powers.push(cb.getAttribute('data-k')); });
          var cntEl = row.querySelector('[data-f="count"]'), rkEl = row.querySelector('[data-f="rank"]');
          edits.positions.push({ name: row.getAttribute('data-pos'), rank: rkEl ? rkEl.value : '', count: cntEl ? parseInt(cntEl.value, 10) : 1, powers: powers });
        });
        var r = _applyCharterRevision(G, item, edits);
        try { if (typeof global.toast === 'function') global.toast(r.ok ? '章程批红已定·仍待廷议' : ('未收：' + r.reason)); } catch (_) {}
        if (r.ok) { bg.remove(); try { if (typeof global.renderVarDrawers === 'function') global.renderVarDrawers(); } catch (_) {} }
      }
    });
    document.body.appendChild(bg);
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

  var API = { tick: tick, forgeCharter: forgeCharter, _validateCharter: _validateCharter, _applyCharterRevision: _applyCharterRevision, migrateDynInstitutions: migrateDynInstitutions, _furnishMigratedNode: _furnishMigratedNode, migEnabled: migEnabled, _buildPrompt: _buildPrompt, enabled: enabled, POWER_KEYS: POWER_KEYS, MAX_POSITIONS: MAX_POSITIONS, SETUP_COST_MIN: SETUP_COST_MIN, SETUP_COST_MAX: SETUP_COST_MAX };
  global._charterReviewOpen = _charterReviewOpen;
  global.TM = global.TM || {};
  global.TM.OfficeCharter = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  try {
    if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
      global.SettlementPipeline.register('officeCharter', '章程演绎', function () {
        try { tick(global.GM); } catch (_eT) {}
      }, 93, 'perturn');
      global.SettlementPipeline.register('officeDynMigration', '旧衙归树', function () {
        try { migrateDynInstitutions(global.GM); } catch (_eM) {}
      }, 94, 'perturn');
    }
  } catch (_eR) {}
})(typeof window !== 'undefined' ? window : globalThis);

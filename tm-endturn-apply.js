// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-apply.js - endturn AI sc1 writeback
//
// Phase 7 P7-epsilon (2026-05-05, Codex).
// Extracted from tm-endturn-ai-infer.js section 4.
// Refactor-only: preserves writeback order and runs inside the sc1 callback.
// Exports: TM.Endturn.AI.apply.writeBack(ctx).
// ============================================================
(function(global) {
  if (typeof global.TM === "undefined") global.TM = {};
  if (typeof global.TM.Endturn === "undefined") global.TM.Endturn = {};
  if (typeof global.TM.Endturn.AI === "undefined") global.TM.Endturn.AI = {};
  if (typeof global.TM.Endturn.AI.apply === "undefined") global.TM.Endturn.AI.apply = {};

  var ns = global.TM.Endturn.AI.apply;

  function ensureGroups(ctx) {
    ctx.input = ctx.input || {};
    ctx.prompt = ctx.prompt || {};
    ctx.subcalls = ctx.subcalls || {};
    ctx.results = ctx.results || {};
    ctx.apply = ctx.apply || {};
    ctx.apply.applied = ctx.apply.applied || { chars: null, factions: null, offices: null, fiscal: null, admin: null, events: null, harem: null };
    ctx.followup = ctx.followup || {};
    ctx.record = ctx.record || {};
    ctx.meta = ctx.meta || { errors: [], warnings: [], timing: {}, retries: {} };
    ctx.meta.timing = ctx.meta.timing || {};
    return ctx;
  }
  function _tmApplyLoyaltyDelta(ch, delta, reason, source, opts) {
    if (!ch) return null;
    opts = opts || {};
    opts.source = source || opts.source;
    if (typeof global.adjustCharacterLoyalty === "function") return global.adjustCharacterLoyalty(ch, delta, reason, opts); if (!reason && opts.ai !== true) return { ok: false, blocked: true, reason: "missing-reason" };
    var oldValue = (typeof ch.loyalty === "number" && isFinite(ch.loyalty)) ? ch.loyalty : 50;
    ch.loyalty = Math.max(0, Math.min(100, oldValue + Math.round(Number(delta) || 0)));
    return { ok: true, oldValue: oldValue, newValue: ch.loyalty, fallback: true };
  }
  function _tmApplyLoyaltySet(ch, value, reason, source, opts) {
    if (!ch) return null;
    opts = opts || {};
    opts.source = source || opts.source;
    if (typeof global.setCharacterLoyalty === "function") return global.setCharacterLoyalty(ch, value, reason, opts);
    if (!reason && opts.ai !== true) return { ok: false, blocked: true, reason: "missing-reason" };
    var oldValue = (typeof ch.loyalty === "number" && isFinite(ch.loyalty)) ? ch.loyalty : 50;
    var target = Number(value);
    if (!isFinite(target)) target = oldValue;
    ch.loyalty = Math.max(0, Math.min(100, Math.round(target)));
    return { ok: true, oldValue: oldValue, newValue: ch.loyalty, fallback: true };
  }
  function _tmFirstText() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }
  ns.writeBack = async function(ctx) {
    ensureGroups(ctx);
    var _applyStart = Date.now();
    var p1 = ctx.results.sc1 || null;
    var sc = ctx.prompt.sc;
    var shizhengji = ctx.record.shizhengji || "";
    var zhengwen = ctx.record.zhengwen || "";
    var playerStatus = ctx.record.playerStatus || "";
    var playerInner = ctx.record.playerInner || "";
    var turnSummary = ctx.record.turnSummary || "";
    var shiluText = ctx.record.shiluText || "";
    var szjTitle = ctx.record.szjTitle || "";
    var szjSummary = ctx.record.szjSummary || "";
    var personnelChanges = Array.isArray(ctx.record.personnelChanges) ? ctx.record.personnelChanges : [];
    var hourenXishuo = ctx.record.hourenXishuo || "";
    var _applied = ctx.apply.applied;

      // §4 sc1 写回（applyAITurnChanges + 各字段族 GM 落地·~4000 行）
      // ═══════════════════════════════════════════════════════════
      if(p1){
        try { if (typeof preflightAIWriteBack === 'function') preflightAIWriteBack(p1, { source: 'endturn-full-p1' }); } catch(_pfE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_pfE, 'endturn] preflightAIWriteBack') : console.warn('[endturn] preflightAIWriteBack:', _pfE); }
        // 方案融入：AI 产出的通用变化/任免/机构/区划/事件/NPC行动/关系 → 统一应用
        try {
          if (typeof applyAITurnChanges === 'function') {
            applyAITurnChanges({
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
              char_updates: Array.isArray(p1.char_updates) ? p1.char_updates : [],
              office_assignments: Array.isArray(p1.office_assignments) ? p1.office_assignments : [],
              faction_updates: Array.isArray(p1.faction_updates) ? p1.faction_updates : [],
              party_updates: Array.isArray(p1.party_updates) ? p1.party_updates : [],
              // 兜底：AI 常只写 personnel_changes (展示用) 而不写 office_assignments — applier 里做备胎消费
              personnel_changes: Array.isArray(p1.personnel_changes) ? p1.personnel_changes : [],
              // 问天 directive 合规回报
              directive_compliance: Array.isArray(p1.directive_compliance) ? p1.directive_compliance : [],
              regent_decisions: Array.isArray(p1.regent_decisions) ? p1.regent_decisions : []
            });
          }
        } catch(_applyErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_applyErr, 'endturn] applyAITurnChanges:') : console.warn('[endturn] applyAITurnChanges:', _applyErr); }

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

            // 取 reconcile 工具集
            var _reconcileTools = (window.TM_AI_SCHEMA && TM_AI_SCHEMA.reconcileTools) || [];
            var _toolResp = null;
            if (typeof callAIWithTools === 'function' && _reconcileTools.length > 0) {
              _toolResp = await callAIWithTools(_reconcilePrompt, _reconcileTools, { maxTok: 1500, tier: 'secondary' });
            } else {
              // 极端兜底（不该发生·callAIWithTools 应已加载）
              var _raw = await callAI(_reconcilePrompt, 1500, undefined, 'secondary');
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
              _patch.sentiment_changes.forEach(function(s) {
                var pathMap = { minxin: 'minxin', huangwei: 'huangwei', huangquan: 'huangquan' };
                var key = pathMap[s.target]; if (!key || !GM[key]) return;
                if (typeof GM[key] === 'object' && typeof GM[key].index === 'number') {
                  GM[key].index = Math.max(0, Math.min(100, GM[key].index + s.delta));
                } else if (typeof GM[key] === 'number') {
                  GM[key] = Math.max(0, Math.min(100, GM[key] + s.delta));
                }
                // 登记 turnChanges 供史记显示
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: key + '.index', label: ({minxin:'民心',huangwei:'皇威',huangquan:'皇权'})[s.target], delta: s.delta, reason: s.reason || '一致性补录' });
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
                  GM.minxin.revolts.push({
                    region: r.region,
                    leader: r.leader || '',
                    scale: r.scale || 1000,
                    startedTurn: GM.turn || 0,
                    status: 'ongoing',
                    _autoFromReconcile: true
                  });
                } else if (r.action === 'suppress' || r.action === 'appease') {
                  var openR = GM.minxin.revolts.find(function(x){return x && x.status === 'ongoing' && x.region === r.region;});
                  if (openR) {
                    openR.status = (r.action === 'suppress') ? 'suppressed' : 'appeased';
                    openR.endedTurn = GM.turn || 0;
                  }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'minxin.revolts', label: r.region + '·民变·' + r.action, delta: r.action==='start'?1:-1, reason: r.reason || '一致性补录' });
              });
              // 天灾补录
              _patch.disaster_events.forEach(function(d) {
                if (!Array.isArray(GM.activeDisasters)) GM.activeDisasters = [];
                GM.activeDisasters.push({
                  type: d.category,
                  category: d.category,
                  region: d.region,
                  severity: d.severity || 'moderate',
                  casualties: d.casualties || 0,
                  startedTurn: GM.turn || 0,
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
                  GM.parties.push({ name: e.partyName, leader: e.leader||'', members: e.leader?[e.leader]:[], formedTurn: GM.turn||0, status: 'active', reason: e.reason||'', _autoFromReconcile: true });
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
              _patch.conspiracy_events.forEach(function(e) {
                if (!GM._conspiracies) GM._conspiracies = [];
                GM._conspiracies.push({ turn: GM.turn||0, action: e.action, instigator: e.instigator, target: e.target||'', outcome: e.outcome||'suppressed', conspirators: e.conspirators||[], reason: e.reason||'', _autoFromReconcile: true });
                // 主谋通常应受惩·登记 NPC 状态
                var inst = (GM.chars||[]).find(function(c){return c && c.name === e.instigator;});
                if (inst && (e.outcome === 'suppressed' || e.action === 'plot_failed' || e.action === 'coup_failed')) {
                  inst._imprisoned = true;
                  inst._conspiracyConvicted = true;
                  inst._imprisonedTurn = GM.turn||0;
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: '_conspiracies', label: '谋反·' + e.instigator + '·' + e.action + '/' + (e.outcome||''), delta: 1, reason: e.reason || '一致性补录' });
              });
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
              applyAITurnChanges({
                personnel_changes: _patch.personnel_changes,
                office_assignments: _patch.office_assignments,
                fiscal_adjustments: _patch.fiscal_adjustments,
                military_changes: _patch.military_changes,
                // 不传 narrative·避免触发 validator 死循环
                shilu_text: '',
                shizhengji: ''
              });
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

        // v5·人物生成 B · 取消每回合 API 调用·改为玩家手动点击 pending 名时按需生成
        // scanMentionedCharacters 只允许登记 pending，不允许在回合推演中自动调用 AI 生成人物
        // pending 名仍由 char-link 的 onclick 触发 _tmClickPendingChar → crystallizePendingCharacter

        shizhengji = _tmFirstText(p1.shizhengji, p1.shizheng, p1.szj, p1.zhengwen, p1.shilu_text);
        turnSummary = _tmFirstText(p1.turn_summary, p1.summary);
        playerStatus = _tmFirstText(p1.player_status, p1.playerStatus); // 兼容旧字段
        playerInner = _tmFirstText(p1.player_inner, p1.playerInner);   // 兼容旧字段
        // 新增字段
        shiluText = _tmFirstText(p1.shilu_text, p1.shilu, p1.record);
        szjTitle = _tmFirstText(p1.szj_title, p1.shizhengji_title, p1.title);
        szjSummary = _tmFirstText(p1.szj_summary, p1.shizhengji_summary, p1.summary);
        if (!zhengwen) zhengwen = _tmFirstText(p1.zhengwen, p1.houren_xishuo, p1.hourenXishuo, p1.houren);
        personnelChanges = Array.isArray(p1.personnel_changes) ? p1.personnel_changes : [];
        // 将主角内省记入角色记忆（兼容旧逻辑）
        if (playerInner && typeof NpcMemorySystem !== 'undefined' && P.playerInfo && P.playerInfo.characterName) {
          var _innerEmo = /痛|苦|忧|恨|怒|惧|恐|悲|泪/.test(playerInner) ? '忧' : /喜|乐|慰|畅|笑/.test(playerInner) ? '喜' : '平';
          NpcMemorySystem.remember(P.playerInfo.characterName, playerInner, _innerEmo, 6);
        }
        if(p1.resource_changes){
          Object.entries(p1.resource_changes).forEach(function(e){
            var d=parseFloat(e[1]);if(isNaN(d))return;
            if(GM.vars[e[0]]){
              GM.vars[e[0]].value=clamp(GM.vars[e[0]].value+d,GM.vars[e[0]].min,GM.vars[e[0]].max);
            } else {
              // AI动态创建新变量（如改革进度、特殊资源等）
              GM.vars[e[0]]={value:clamp(d,0,9999),min:0,max:9999,unit:''};
              _dbg('[resource_changes] \u52A8\u6001\u521B\u5EFA\u53D8\u91CF: ' + e[0] + ' = ' + d);
            }
          });
          // 公式约束校验+联动执行
          _enforceFormulas(p1.resource_changes);
        }
        if(p1.relation_changes)Object.entries(p1.relation_changes).forEach(function(e){var d=parseFloat(e[1]);if(isNaN(d))return;if(GM.rels[e[0]])GM.rels[e[0]].value=clamp(GM.rels[e[0]].value+d,-100,100);});
        if(p1.event&&p1.event.title){
          // 事件白名单校验
          var _evtCheck = (typeof EventConstraintSystem!=='undefined') ? EventConstraintSystem.validate(p1.event) : {allowed:true};
          if (_evtCheck.allowed) {
            addEB(p1.event.type||"\u4E8B\u4EF6",p1.event.title + (_evtCheck.downgraded ? '（纯叙事）' : ''));
            if (!_evtCheck.downgraded && typeof EventConstraintSystem!=='undefined') EventConstraintSystem.recordTriggered(p1.event.type);
          } else {
            _dbg('[EventConstraint] 事件被拒绝:', p1.event.type, _evtCheck.reason);
          }
        }

        // 应用 AI 返回的地图变化
        if(p1.map_changes && P.map) {
          try {
            applyAIMapChanges(p1, P.map);
          } catch(e) {
            console.error('应用地图变化失败:', e);
          }
        }
        // 处理 NPC 自主行为（AI 报告的 NPC 独立行动）
        if (p1.npc_actions && Array.isArray(p1.npc_actions)) {
          p1.npc_actions.forEach(function(act) {
            if (!act.name || !act.action) return;
            // 2.3: 模糊匹配名称（防止AI用字/号/略称导致匹配失败）
            var _ff = typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar : null;
            if (_ff && act.name && !findCharByName(act.name)) {
              var _fm = _ff(act.name);
              if (_fm) act.name = _fm.name;
            }
            if (_ff && act.target && !findCharByName(act.target)) {
              var _ft = _ff(act.target);
              if (_ft) act.target = _ft.name;
            }

            if (!_tmNpcLedgerPreflight({ source: 'main_ai:npc_actions', kind: 'npc_action', actor: act.name, behaviorType: act.behaviorType || act.type || 'unknown', type: act.type || act.behaviorType || 'unknown', target: act.target || '', action: act.action || '' }, 'AI NPC行动已阻止')) return;

            // 尝试机械执行（让 AI 的决策产生真实游戏效果）
            var mechanicallyExecuted = false;

            if (act.behaviorType === 'appoint' && act.target) {
              // NPC 任命：尝试通过 PostTransfer 执行
              if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts) {
                var targetPost = null;
                GM.postSystem.posts.forEach(function(p) {
                  if (p.name && act.action.indexOf(p.name) >= 0 && (!p.holder || p.status === 'vacant')) targetPost = p;
                });
                if (targetPost) {
                  PostTransfer.seat(targetPost.id, act.target, act.name);
                  if (typeof recordCharacterArc === 'function') recordCharacterArc(act.target, 'appointment', '被' + act.name + '任命为' + targetPost.name);
                  if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
                    var _tc = (GM.chars || []).find(function(c){ return c.name === act.target; });
                    if (_tc) CorruptionEngine.markAsRecentAppointment(_tc);
                  }
                  if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 8, '被提拔');
                  mechanicallyExecuted = true;
                }
              }
            } else if (act.behaviorType === 'dismiss' && act.target) {
              // NPC 罢免
              if (typeof PostTransfer !== 'undefined') {
                PostTransfer.cascadeVacate(act.target);
                if (typeof recordCharacterArc === 'function') recordCharacterArc(act.target, 'dismissal', '被' + act.name + '罢免');
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -12, '被罢免');
                mechanicallyExecuted = true;
              }
            } else if (act.behaviorType === 'declare_war' && act.target) {
              // NPC 宣战：更新亲疏
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, -30, '宣战');
              if (typeof WarWeightSystem !== 'undefined') WarWeightSystem.addTruce(act.name, act.target);
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reward' && act.target) {
              // NPC 赏赐
              var targetChar = findCharByName(act.target);
              if (targetChar) {
                if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(targetChar, 5, (act.name || 'NPC') + '\u8D4F\u8D50', { source:'npc-action-reward' });
                else targetChar.loyalty = Math.min(100, ((typeof targetChar.loyalty === 'number' && isFinite(targetChar.loyalty)) ? targetChar.loyalty : 50) + 5);
              }
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 10, '受赏');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'punish' && act.target) {
              // NPC 惩罚
              var pChar = findCharByName(act.target);
              if (pChar) {
                if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(pChar, -8, (act.name || 'NPC') + '\u60E9\u7F5A', { source:'npc-action-punish' });
                else pChar.loyalty = Math.max(0, ((typeof pChar.loyalty === 'number' && isFinite(pChar.loyalty)) ? pChar.loyalty : 50) - 8);
              }
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -15, '受罚');
              if (typeof StressSystem !== 'undefined' && pChar) StressSystem.checkStress(pChar, '受罚');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'request_loyalty' && act.target) {
              // NPC 拉拢/试探忠诚
              var rlChar = findCharByName(act.target);
              if (rlChar) {
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 3, '被拉拢');
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(act.target, act.name + '暗中拉拢示好', '平', 5, act.name);
                  NpcMemorySystem.remember(act.name, '试探' + act.target + '的立场', '平', 4, act.target);
                }
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reform') {
              // NPC 推行改革
              if (typeof AutoReboundSystem !== 'undefined' && AutoReboundSystem.checkReforms) {
                var reformChanges = {};
                reformChanges[act.intent || '改革'] = 5;
                AutoReboundSystem.checkReforms(reformChanges);
              }
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(act.name, '推行改革：' + (act.intent || act.action), '平', 6);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'betray') {
              // NPC 背叛
              var bCh = findCharByName(act.name);
              if (bCh) {
                if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(bCh, -25, '\u80CC\u53DB\uFF1A' + (act.action || act.intent || ''), { source:'npc-action-betray' });
                else bCh.loyalty = Math.max(0, ((typeof bCh.loyalty === 'number' && isFinite(bCh.loyalty)) ? bCh.loyalty : 50) - 25);
                bCh.stance = '投机';
              }
              if (typeof AffinityMap !== 'undefined' && act.target) AffinityMap.add(act.name, act.target, -25, '背叛');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(act.name, '背叛：' + act.action, '忧', 9, act.target||'');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'conspire') {
              // NPC 密谋串联
              if (typeof AffinityMap !== 'undefined' && act.target) AffinityMap.add(act.name, act.target, 8, '密谋同盟');
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(act.name, '暗中串联' + (act.target||''), '平', 6, act.target||'');
                if (act.target) NpcMemorySystem.remember(act.target, act.name + '来联络密事', '平', 5, act.name);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'petition' || act.behaviorType === 'investigate') {
              // NPC 上疏/弹劾调查
              if (act.target) {
                var _tgt = findCharByName(act.target);
                if (_tgt) { _tgt.stress = Math.min(100, (_tgt.stress||0) + 8); }
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, -8, act.behaviorType === 'investigate' ? '弹劾' : '进谏批评');
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'obstruct') {
              // NPC 阻挠政令（仅事件，不修改顶栏数值）
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'slander') {
              // NPC 造谣中伤
              if (act.target) {
                var _slCh = findCharByName(act.target);
                if (_slCh) {
                  if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_slCh, -5, (act.name || 'NPC') + '\u9020\u8C23\u4E2D\u4F24', { source:'npc-action-slander' });
                  else _slCh.loyalty = Math.max(0, ((typeof _slCh.loyalty === 'number' && isFinite(_slCh.loyalty)) ? _slCh.loyalty : 50) - 5);
                  _slCh.stress = Math.min(100, (_slCh.stress||0) + 10);
                }
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -12, '被中伤');
                if (typeof FaceSystem !== 'undefined' && _slCh) FaceSystem.loseFace(_slCh, 10, act.name + '造谣');
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reconcile' || act.behaviorType === 'mentor') {
              // NPC 和解/提携
              if (act.target) {
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, act.behaviorType === 'mentor' ? 12 : 8, act.behaviorType === 'mentor' ? '师徒提携' : '冰释前嫌');
                var _rcCh = findCharByName(act.target);
                if (_rcCh) {
                  if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_rcCh, 3, act.behaviorType === 'mentor' ? '\u5E08\u5F92\u63D0\u643A' : '\u51B0\u91CA\u524D\u5ACC', { source:'npc-action-reconcile-mentor' });
                  else _rcCh.loyalty = Math.min(100, ((typeof _rcCh.loyalty === 'number' && isFinite(_rcCh.loyalty)) ? _rcCh.loyalty : 50) + 3);
                }
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'train_troops' || act.behaviorType === 'fortify' || act.behaviorType === 'patrol') {
              // 军事行为——提升相关军队士气/训练
              var _armyMatch = (GM.armies||[]).find(function(a){return !a.destroyed && (a.commander === act.name || (act.target && a.name === act.target));});
              if (_armyMatch) {
                if (act.behaviorType === 'train_troops') _armyMatch.training = Math.min(100, (_armyMatch.training||50) + 5);
                else if (act.behaviorType === 'patrol') _armyMatch.morale = Math.min(100, (_armyMatch.morale||50) + 3);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'flee' || act.behaviorType === 'retire' || act.behaviorType === 'travel') {
              // NPC 出逃/告老/游历——移动位置
              if (act.new_location) {
                var _flCh = findCharByName(act.name);
                if (_flCh) { _flCh.location = act.new_location; _flCh._locationExplicit = false; }
              }
              if (act.behaviorType === 'flee') {
                var _flCh2 = findCharByName(act.name);
                if (_flCh2) {
                  if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_flCh2, -20, '\u51FA\u9003\u907F\u7978', { source:'npc-action-flee' });
                  else _flCh2.loyalty = Math.max(0, ((typeof _flCh2.loyalty === 'number' && isFinite(_flCh2.loyalty)) ? _flCh2.loyalty : 50) - 20);
                }
              }
              if (act.behaviorType === 'retire') {
                // 告老还乡——从官制中移除（新老模型同步）
                if (GM.officeTree) (function _rmHolder(nodes) {
                  nodes.forEach(function(n) {
                    if (n.positions) n.positions.forEach(function(p) {
                      if (p.holder === act.name || (Array.isArray(p.actualHolders) && p.actualHolders.some(function(h){return h && h.name===act.name;}))) {
                        if (typeof _offDismissPerson === 'function') _offDismissPerson(p, act.name);
                        else p.holder = '';
                      }
                    });
                    if (n.subs) _rmHolder(n.subs);
                  });
                })(GM.officeTree);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'develop' || act.behaviorType === 'donate') {
              // 地方发展/赈灾
              if (act.target && GM.provinceStats && GM.provinceStats[act.target]) {
                var ps = GM.provinceStats[act.target];
                if (act.behaviorType === 'develop') ps.prosperity = Math.min(100, (ps.prosperity||50) + 5);
                if (act.behaviorType === 'donate') ps.unrest = Math.max(0, (ps.unrest||0) - 5);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'hoard' || act.behaviorType === 'smuggle') {
              // 囤积/走私——损害经济
              if (GM.taxPressure !== undefined) GM.taxPressure = Math.min(100, GM.taxPressure + 2);
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'suppress') {
              // 镇压——仅事件，不修改顶栏数值
              mechanicallyExecuted = true;
            }

            // NPC行为导致的位置移动（通用处理——flee/retire/travel已内部处理，此处兜底其他情况）
            if (act.new_location && !mechanicallyExecuted) {
              var _nlCh = findCharByName(act.name);
              if (_nlCh && !_isSameLocation(_nlCh.location, act.new_location)) {
                _nlCh.location = act.new_location;
                _nlCh._locationExplicit = false;
              }
            }

            // NPC行为产生连锁记忆——行动者、被动者、旁观同僚都会记住
            if (typeof NpcMemorySystem !== 'undefined' && act.behaviorType && act.behaviorType !== 'none') {
              // 行动者自己的记忆
              var _actEmo = (act.behaviorType === 'reward' || act.behaviorType === 'appoint') ? '喜' : (act.behaviorType === 'punish' || act.behaviorType === 'dismiss') ? '平' : (act.behaviorType === 'declare_war') ? '怒' : '平';
              NpcMemorySystem.remember(act.name, act.action, _actEmo, 5, act.target || '');
              // 同势力同僚也会知道这件事（朝堂无秘密）
              if (act.target && GM.chars && (act.behaviorType === 'punish' || act.behaviorType === 'dismiss' || act.behaviorType === 'declare_war')) {
                var _actChar = findCharByName(act.name);
                if (_actChar && _actChar.faction) {
                  GM.chars.forEach(function(colleague) {
                    if (colleague.alive !== false && colleague.name !== act.name && colleague.name !== act.target && colleague.faction === _actChar.faction) {
                      NpcMemorySystem.remember(colleague.name, act.name + '对' + act.target + '施以' + act.behaviorType, '忧', 3, act.name);
                    }
                  });
                }
              }
            }

            // 无论是否机械执行，都记录事件
            // 公开事件中只显示 publicReason（对外说辞），不泄露 privateMotiv（真实动机）
            var _pubReason = act.publicReason || act.intent || '';
            var _evtText = act.name + '：' + act.action + (act.target ? '（对象：' + act.target + '）' : '') + (act.result ? ' → ' + act.result : '');
            if (_pubReason) _evtText += '（' + _pubReason + '）';
            _tmNpcLedgerRecord({ source: 'main_ai:npc_actions', kind: 'npc_action', actor: act.name, behaviorType: act.behaviorType || act.type || 'unknown', type: act.type || act.behaviorType || 'unknown', target: act.target || '', action: act.action || '', result: act.result || '', publicReason: _pubReason, motivePrivate: act.privateMotiv || act.innerThought || '', intent: act.intent || '', status: mechanicallyExecuted ? 'applied' : 'narrative_only', uiRoutes: ['event', 'memory'] });
            addEB('NPC自主', _evtText);
            // 角色弧线记录真实动机（玩家通过人物志可窥见深层故事）
            var _arcDesc = act.action;
            if (act.privateMotiv) _arcDesc += '——' + act.privateMotiv;
            else if (act.innerThought) _arcDesc += '——' + act.innerThought;
            if (typeof recordCharacterArc === 'function') recordCharacterArc(act.name, 'autonomous', _arcDesc);

            if (!mechanicallyExecuted && act.behaviorType && act.behaviorType !== 'none') {
              _dbg('[npc_actions] ' + act.name + ' 行为 ' + act.behaviorType + ' 无法机械执行，仅记录叙事');
            }

            // 3.1: 涟漪效应——与被影响者关系密切的人额外触发记忆
            if (act.target && typeof NpcMemorySystem !== 'undefined' && GM.chars) {
              var _targetCh = findCharByName(act.target);
              if (_targetCh && _targetCh._impressions) {
                for (var _rpn in _targetCh._impressions) {
                  if (_rpn === act.name || _rpn === act.target) continue;
                  var _rpImp = _targetCh._impressions[_rpn];
                  if (Math.abs(_rpImp.favor) >= 15) {
                    var _rpCh = findCharByName(_rpn);
                    if (_rpCh && _rpCh.alive !== false) {
                      var _rpEmo = _rpImp.favor > 0 ? (act.behaviorType === 'punish' || act.behaviorType === 'dismiss' || act.behaviorType === 'slander' ? '\u6012' : '\u559C') : '\u5E73';
                      var _rpDelta = _rpImp.favor > 0 ? -3 : 2; // 友被害→怨施害者；敌被害→对施害者好感
                      NpcMemorySystem.remember(_rpn, act.target + '\u88AB' + act.name + act.behaviorType, _rpEmo, 4, act.name);
                      if (typeof AffinityMap !== 'undefined') AffinityMap.add(_rpn, act.name, _rpDelta, act.target + '\u88AB' + act.behaviorType);
                    }
                  }
                }
              }
            }
          });
        }

        // 处理 NPC 主动来书（AI推演的远方NPC写信给皇帝）
        if (p1.npc_letters && Array.isArray(p1.npc_letters)) {
          if (!GM._pendingNpcLetters) GM._pendingNpcLetters = [];
          var _nlAccepted = 0, _nlSkipNoChar = 0, _nlSkipCapital = 0, _nlSkipMissing = 0;
          p1.npc_letters.forEach(function(nl) {
            if (!nl.from || !nl.content) { _nlSkipMissing++; return; }
            // 验证from是远方NPC
            var _nlCh = findCharByName(nl.from);
            var _cap = GM._capital || '京城';
            if (!_nlCh) { _nlSkipNoChar++; _dbg('[npc_letters] 找不到角色: ' + nl.from + '·跳过'); return; }
            if (_nlCh.isPlayer) { _nlSkipMissing++; return; }
            if (_nlCh.alive === false) { _nlSkipMissing++; return; }
            if (_isSameLocation(_nlCh.location, _cap)) {
              // 在京 NPC 不应走鸿雁——但 AI 已生成内容·改投奏疏避免内容浪费
              _nlSkipCapital++;
              _dbg('[npc_letters] 在京NPC ' + nl.from + ' 写信·改投奏疏');
              if (!GM.memorials) GM.memorials = [];
              GM.memorials.push({
                id: uid(), from: nl.from, title: _nlCh.officialTitle||_nlCh.title||'',
                type: nl.type === 'impeach' ? '人事' : (nl.type === 'warning' ? '军务' : '政务'),
                subtype: nl.type === 'intelligence' ? '密折' : '题本',
                content: nl.content, status: 'pending', turn: GM.turn, reply: '',
                reliability: 'medium', bias: 'none', priority: nl.urgency === 'extreme' ? 'urgent' : 'normal',
                _convertedFromLetter: true
              });
              _tmNpcLedgerRecord({ source: 'main_ai:npc_letters', kind: 'npc_letter', actor: nl.from, type: nl.type || 'report', behaviorType: nl.type || 'report', target: '天子', action: nl.content || '', result: nl.suggestion || '', status: 'converted_to_memorial', uiRoutes: ['memorials', 'memory'] });
              return;
            }
            _nlAccepted++;
            GM._pendingNpcLetters.push({
              from: nl.from,
              type: nl.type || 'report',
              urgency: nl.urgency || 'normal',
              content: nl.content,
              suggestion: nl.suggestion || '',
              replyExpected: nl.replyExpected !== false
            });
            _tmNpcLedgerRecord({ source: 'main_ai:npc_letters', kind: 'npc_letter', actor: nl.from, type: nl.type || 'report', behaviorType: nl.type || 'report', target: '天子', action: nl.content || '', result: nl.suggestion || '', status: 'queued', uiRoutes: ['letters', 'memory'] });
            // NPC 记一笔·"我写过这封信"·以备日后推演时保持一致
            try {
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                var emoMap = { warning: '忧', plea: '忧', report: '敬', intelligence: '惧', thanks: '敬', impeach: '怒', condolence: '哀', personal: '平', recommend: '敬', greeting: '平' };
                var emo = emoMap[nl.type] || '平';
                var memTxt = '自' + (_nlCh.location || '远方') + '上书天子：' + (nl.subjectLine ? '《'+nl.subjectLine.slice(0,20)+'》' : '') + String(nl.content).slice(0, 60);
                NpcMemorySystem.remember(nl.from, memTxt, emo, nl.urgency === 'extreme' ? 9 : nl.urgency === 'urgent' ? 7 : 5, '天子');
              }
            } catch(_memE) {}
            _dbg('[npc_letters] ' + nl.from + ' 主动来书（' + (nl.type||'report') + '）');
          });
          _dbg('[npc_letters] 入队 ' + _nlAccepted + ' 封·跳过(无角色 ' + _nlSkipNoChar + '·在京改奏疏 ' + _nlSkipCapital + '·缺字段 ' + _nlSkipMissing + ')');
        }

        // 处理 NPC 间通信（密谋/结盟/情报交换）
        if (p1.npc_correspondence && Array.isArray(p1.npc_correspondence)) {
          if (!GM._pendingNpcCorrespondence) GM._pendingNpcCorrespondence = [];
          p1.npc_correspondence.forEach(function(nc) {
            if (!nc.from || !nc.to) return;
            if (!_tmNpcLedgerPreflight({ source: 'main_ai:npc_correspondence', kind: 'npc_correspondence', actor: nc.from, type: nc.type || 'secret', behaviorType: nc.type || 'secret', target: nc.to, action: nc.content || nc.summary || '' }, 'AI NPC通信已阻止')) return;
            GM._pendingNpcCorrespondence.push({
              from: nc.from, to: nc.to,
              content: nc.content||'', summary: nc.summary||'',
              implication: nc.implication||'', type: nc.type||'secret'
            });
            _tmNpcLedgerRecord({ source: 'main_ai:npc_correspondence', kind: 'npc_correspondence', actor: nc.from, type: nc.type || 'secret', behaviorType: nc.type || 'secret', target: nc.to || '', action: nc.content || nc.summary || '', result: nc.implication || '', status: 'queued', uiRoutes: ['correspondence', 'memory'] });
            _dbg('[npc_correspondence] ' + nc.from + ' → ' + nc.to + '（' + (nc.type||'secret') + '）');
          });
        }

        // 处理驿路阻断
        if (p1.route_disruptions && Array.isArray(p1.route_disruptions)) {
          if (!GM._routeDisruptions) GM._routeDisruptions = [];
          p1.route_disruptions.forEach(function(rd) {
            if (!rd.route && !rd.from) return;
            var route = rd.route || (rd.from + '-' + rd.to);
            // 检查是否已有该路线的阻断记录
            var existing = GM._routeDisruptions.find(function(d) { return d.route === route && !d.resolved; });
            if (rd.resolved) {
              // 恢复驿路
              if (existing) existing.resolved = true;
              _dbg('[route_disruptions] 驿路恢复：' + route);
            } else if (!existing) {
              GM._routeDisruptions.push({
                route: route, from: rd.from||'', to: rd.to||'',
                reason: rd.reason||'', resolved: false, turn: GM.turn
              });
              _dbg('[route_disruptions] 驿路阻断：' + route + '（' + (rd.reason||'') + '）');
              if (typeof addEB === 'function') addEB('传书', '⚠ 驿路阻断：' + route + (rd.reason ? '（' + rd.reason + '）' : ''));
            }
          });
        }

        // 处理 NPC 间亲疏变化（AI 推演的人际关系变动）
        if (p1.affinity_changes && Array.isArray(p1.affinity_changes)) {
          p1.affinity_changes.forEach(function(ac) {
            if (!ac.a || !ac.b || !ac.delta) return;
            var delta = clamp(parseInt(ac.delta) || 0, -30, 30);
            if (delta !== 0 && typeof AffinityMap !== 'undefined') {
              AffinityMap.add(ac.a, ac.b, delta, ac.reason || 'AI\u63A8\u6F14');
            }
            // 4.2: 存储结构化关系类型
            if (ac.relType) {
              var ch_a = findCharByName(ac.a);
              if (ch_a) {
                if (!ch_a._relationships) ch_a._relationships = {};
                if (!ch_a._relationships[ac.b]) ch_a._relationships[ac.b] = [];
                var existingRel = ch_a._relationships[ac.b].find(function(r){return r.type===ac.relType;});
                if (existingRel) { existingRel.strength = Math.max(-100, Math.min(100, (existingRel.strength||0) + (ac.delta||0))); }
                else { ch_a._relationships[ac.b].push({type: ac.relType, strength: ac.delta||0, since: GM.turn}); }
                // 双向
                var ch_b = findCharByName(ac.b);
                if (ch_b) {
                  if (!ch_b._relationships) ch_b._relationships = {};
                  if (!ch_b._relationships[ac.a]) ch_b._relationships[ac.a] = [];
                  var existingRel2 = ch_b._relationships[ac.a].find(function(r){return r.type===ac.relType;});
                  if (existingRel2) { existingRel2.strength = Math.max(-100, Math.min(100, (existingRel2.strength||0) + (ac.delta||0))); }
                  else { ch_b._relationships[ac.a].push({type: ac.relType, strength: ac.delta||0, since: GM.turn}); }
                }
              }
            }
          });
        }

        // 处理角色目标更新（4.1: NPC动态目标系统）
        if (p1.goal_updates && Array.isArray(p1.goal_updates)) {
          p1.goal_updates.forEach(function(gu) {
            if (!gu.name) return;
            var ch = findCharByName(gu.name);
            if (!ch) return;
            if (!ch.personalGoals) ch.personalGoals = [];
            var action = gu.action || 'update';
            if (action === 'add' || action === 'replace') {
              // 添加新目标或替换已完成的目标
              var newGoal = {
                id: gu.goalId || ('goal_' + Date.now() + '_' + Math.floor(Math.random()*1000)),
                type: gu.type || 'power',
                longTerm: gu.longTerm || gu.goal || '',
                shortTerm: gu.shortTerm || '',
                progress: gu.progress || 0,
                priority: gu.priority || 5,
                context: gu.context || '',
                createdTurn: GM.turn,
                dynamic: true
              };
              if (action === 'replace' && gu.goalId) {
                var idx = ch.personalGoals.findIndex(function(g){return g.id===gu.goalId;});
                if (idx >= 0) ch.personalGoals[idx] = newGoal;
                else ch.personalGoals.push(newGoal);
              } else {
                ch.personalGoals.push(newGoal);
              }
              // 最多3个目标
              if (ch.personalGoals.length > 3) ch.personalGoals = ch.personalGoals.sort(function(a,b){return (b.priority||5)-(a.priority||5);}).slice(0,3);
            } else if (action === 'complete') {
              // 目标达成
              var gi = ch.personalGoals.findIndex(function(g){return g.id===gu.goalId;});
              if (gi >= 0) {
                var completed = ch.personalGoals.splice(gi, 1)[0];
                if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(ch.name, '达成目标：' + completed.longTerm, '喜', 8);
                addEB('目标', ch.name + '达成：' + completed.longTerm);
              }
            } else {
              // update: 更新现有目标的短期目标/进度/上下文
              var existing = gu.goalId ? ch.personalGoals.find(function(g){return g.id===gu.goalId;}) : ch.personalGoals[0];
              if (existing) {
                if (gu.shortTerm) existing.shortTerm = gu.shortTerm;
                if (gu.progress !== undefined) existing.progress = Math.max(0, Math.min(100, gu.progress));
                if (gu.context) existing.context = gu.context;
                if (gu.longTerm) existing.longTerm = gu.longTerm;
              }
            }
            // 兼容旧格式
            ch.personalGoal = ch.personalGoals.length > 0 ? ch.personalGoals[0].longTerm : '';
            _dbg('[Goal] ' + gu.name + ' ' + action + ': ' + (gu.longTerm || gu.shortTerm || gu.goalId));
          });
        }

        // 6.1: 伏笔/回收系统处理
        if (p1.foreshadowing && Array.isArray(p1.foreshadowing)) {
          if (!GM._foreshadowings) GM._foreshadowings = [];
          p1.foreshadowing.forEach(function(fs) {
            if (!fs.content || !fs.action) return;
            if (fs.action === 'plant') {
              var newFs = {
                id: 'fs_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                content: fs.content,
                type: fs.type || 'mystery',
                resolveCondition: fs.resolveCondition || '',
                plantTurn: GM.turn,
                resolved: false
              };
              GM._foreshadowings.push(newFs);
              addEB('\u6697\u7EBF', fs.content.slice(0, 40));
              // 6.1联动编年纪事：在编年面板创建一个"进行中"事件（玩家可见的表层线索）
              if (!GM.biannianItems) GM.biannianItems = [];
              GM.biannianItems.push({
                id: newFs.id,
                name: fs.content.slice(0, 15),
                title: fs.content.slice(0, 15),
                content: fs.content,
                startTurn: GM.turn,
                turn: GM.turn,
                duration: 9999, // 持续到被回收
                date: typeof getTSText === 'function' ? getTSText(GM.turn) : '',
                _isForeshadow: true // 内部标记
              });
              _dbg('[Foreshadow] plant: ' + fs.content.slice(0, 40));
            } else if (fs.action === 'resolve') {
              // 模糊匹配最佳伏笔
              var bestMatch = null;
              var bestScore = 0;
              GM._foreshadowings.forEach(function(existing) {
                if (existing.resolved) return;
                var score = 0;
                // 内容相似度：简单字符匹配
                var keywords = fs.content.replace(/[，。、！？\s]/g, '').split('');
                var existWords = existing.content.replace(/[，。、！？\s]/g, '');
                keywords.forEach(function(ch) { if (existWords.indexOf(ch) >= 0) score++; });
                if (fs.type && fs.type === existing.type) score += 5;
                if (score > bestScore) { bestScore = score; bestMatch = existing; }
              });
              if (bestMatch && bestScore >= 3) {
                bestMatch.resolved = true;
                bestMatch.resolveTurn = GM.turn;
                bestMatch.resolveContent = fs.content;
                addEB('\u8F6C\u6298', bestMatch.content.slice(0,15) + '\u2192' + fs.content.slice(0, 25));
                if (typeof ChronicleSystem !== 'undefined' && typeof ChronicleSystem.addMonthDraft === 'function') {
                  ChronicleSystem.addMonthDraft(GM.turn, '\u4F0F\u7B14\u56DE\u6536', bestMatch.content + ' \u2192 ' + fs.content);
                }
                // 6.1联动编年纪事：完成对应的biannian事件
                if (GM.biannianItems) {
                  var _bIdx = GM.biannianItems.findIndex(function(b){ return b._isForeshadow && b.id === bestMatch.id; });
                  if (_bIdx >= 0) {
                    GM.biannianItems[_bIdx].duration = GM.turn - GM.biannianItems[_bIdx].startTurn;
                    GM.biannianItems[_bIdx].content = bestMatch.content + ' \u2192 ' + fs.content;
                  }
                }
                _dbg('[Foreshadow] resolve: ' + fs.content.slice(0, 40) + ' matched: ' + bestMatch.content.slice(0, 30));
              } else {
                _dbg('[Foreshadow] resolve failed - no match for: ' + fs.content.slice(0, 40));
              }
            }
          });
          // 动态上限控制
          var _dpt = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
          var _fsLimit = _dpt <= 3 ? 100 : _dpt <= 40 ? 40 : _dpt <= 100 ? 25 : 15;
          var _unresolvedFs = GM._foreshadowings.filter(function(f) { return !f.resolved; });
          if (_unresolvedFs.length > _fsLimit) {
            // 按埋下回合排序，移除最老的
            _unresolvedFs.sort(function(a, b) { return a.plantTurn - b.plantTurn; });
            var _toRemove = _unresolvedFs.length - _fsLimit;
            for (var _ri = 0; _ri < _toRemove; _ri++) {
              _unresolvedFs[_ri].resolved = true;
              _unresolvedFs[_ri].resolveTurn = GM.turn;
              _unresolvedFs[_ri].resolveContent = '\u8D85\u4E0A\u9650\u81EA\u52A8\u79FB\u9664';
              // 清理对应的biannianItem（防止幽灵条目）
              if (GM.biannianItems) {
                var _bci = GM.biannianItems.findIndex(function(b){ return b._isForeshadow && b.id === _unresolvedFs[_ri].id; });
                if (_bci >= 0) GM.biannianItems.splice(_bci, 1);
              }
            }
            _dbg('[Foreshadow] trimmed ' + _toRemove + ' oldest unresolved (limit=' + _fsLimit + ')');
          }
        }

        // 处理时局要务更新
        if (p1.current_issues_update && Array.isArray(p1.current_issues_update)) {
          if (!GM.currentIssues) GM.currentIssues = [];
          p1.current_issues_update.forEach(function(iu) {
            if (!iu.action) return;
            if (iu.action === 'add' && iu.title) {
              var newIssue = {
                id: 'issue_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                title: iu.title,
                category: iu.category || '',
                description: iu.description || '',
                status: 'pending',
                raisedTurn: GM.turn,
                raisedDate: typeof getTSText === 'function' ? getTSText(GM.turn) : ''
              };
              GM.currentIssues.push(newIssue);
              addEB('\u65F6\u5C40', '\u65B0\u8981\u52A1\uFF1A' + iu.title);
              _dbg('[Issues] add: ' + iu.title);
            } else if (iu.action === 'resolve' && iu.id) {
              var _ri = GM.currentIssues.find(function(i) { return i.id === iu.id && i.status === 'pending'; });
              if (_ri) {
                _ri.status = 'resolved';
                _ri.resolvedTurn = GM.turn;
                _ri.resolvedDate = typeof getTSText === 'function' ? getTSText(GM.turn) : '';
                addEB('\u65F6\u5C40', '\u8981\u52A1\u89E3\u51B3\uFF1A' + _ri.title);
                _dbg('[Issues] resolve: ' + _ri.title);
              }
            } else if (iu.action === 'update' && iu.id) {
              var _ui = GM.currentIssues.find(function(i) { return i.id === iu.id; });
              if (_ui) {
                if (iu.description) _ui.description = iu.description;
                if (iu.title) _ui.title = iu.title;
                if (iu.category) _ui.category = iu.category;
                _dbg('[Issues] update: ' + _ui.title);
              }
            }
          });
        }

        applyCharacterDeaths(p1);  // R100 抽出·原 220 行 if-block → tm-ai-apply-deaths.js

        // 检测AI叙事中的怀孕事件（从shizhengji中提取）
        if (typeof HaremSettlement !== 'undefined' && GM.chars) {
          var _pregKeywords = /(\S{1,4})(有孕|怀孕|有喜|身怀六甲|珠胎暗结)/;
          var _pregMatch = (shizhengji || '').match(_pregKeywords);
          if (_pregMatch) {
            var _pregMother = findCharByName(_pregMatch[1]);
            if (_pregMother && _pregMother.spouse) {
              HaremSettlement.registerPregnancy(_pregMother.name);
            }
          }
        }

        // 处理角色属性变化（AI直接调整个体角色忠诚/野心等）
        if (p1.char_updates && Array.isArray(p1.char_updates)) {
          var _pNameCU = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.char_updates.forEach(function(cu) {
            if (!cu.name) return;
            var ch = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(cu.name) : null) || findCharByName(cu.name);
            if (!ch) return;
            // ── 玩家保护：玩家角色的决策字段(立场/党派/官职) 不允许 AI 修改 ──
            var _isPlayerTarget = (_pNameCU && cu.name === _pNameCU) || ch.isPlayer;
            if (_isPlayerTarget) {
              // 移除玩家决策字段——只保留状态影响字段(stress/health/能力变化)
              delete cu.new_stance;
              delete cu.new_party;
              delete cu.new_location; // 玩家位置由玩家自行决定
              delete cu.add_traits;
              delete cu.remove_traits;
              // loyalty_delta 对玩家无意义（玩家不会对自己忠诚）
              delete cu.loyalty_delta;
              delete cu.legitimacy_delta;
            }
            if (cu.loyalty_delta) {
              var oldL = (typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50;
              var _loyClamp = (typeof _getModeParams === 'function') ? _getModeParams().loyaltyClamp : 20;
              var _loyDelta = clamp(parseInt(cu.loyalty_delta)||0, -_loyClamp, _loyClamp);
              if (typeof adjustCharacterLoyalty === 'function') {
                adjustCharacterLoyalty(ch, _loyDelta, cu.reason || '', { source:'ai-char-updates', ai:true, defaultReason:'AI\u63A8\u6F14', maxAbs:_loyClamp });
              } else if (cu.reason) {
                ch.loyalty = clamp(((typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50) + _loyDelta, 0, 100);
                if (Math.abs(cu.loyalty_delta) >= 5) recordChange('characters', cu.name, 'loyalty', oldL, ch.loyalty, cu.reason || 'AI推演');
              }
            }
            if (cu.ambition_delta) {
              ch.ambition = clamp((ch.ambition||50) + clamp(parseInt(cu.ambition_delta)||0, -15, 15), 0, 100);
            }
            if (cu.stress_delta && typeof StressSystem !== 'undefined') {
              ch.stress = clamp((ch.stress||0) + clamp(parseInt(cu.stress_delta)||0, -20, 20), 0, 100);
            }
            // 外交能力变化
            if (cu.diplomacy_delta) {
              ch.diplomacy = clamp((ch.diplomacy||50) + clamp(parseInt(cu.diplomacy_delta)||0, -15, 15), 0, 100);
            }
            // 其余 7 维能力变化（AI可根据经历调整）
            ['intelligence','valor','military','administration','management','charisma','benevolence'].forEach(function(_dim) {
              var _deltaKey = _dim + '_delta';
              if (cu[_deltaKey]) {
                ch[_dim] = clamp((ch[_dim]||50) + clamp(parseInt(cu[_deltaKey])||0, -15, 15), 0, 100);
              }
            });
            // 特质增删（如经历事件后新获特质/失去特质）
            if (Array.isArray(cu.add_traits) && cu.add_traits.length) {
              if (!Array.isArray(ch.traits)) ch.traits = [];
              cu.add_traits.forEach(function(tid) {
                if (typeof TRAIT_LIBRARY === 'undefined' || !TRAIT_LIBRARY[tid]) return;
                // 自动移除冲突特质
                if (typeof traitsConflict === 'function') {
                  ch.traits = ch.traits.filter(function(x) { return !traitsConflict(x, tid); });
                }
                if (ch.traits.indexOf(tid) < 0) ch.traits.push(tid);
              });
            }
            if (Array.isArray(cu.remove_traits) && cu.remove_traits.length && Array.isArray(ch.traits)) {
              ch.traits = ch.traits.filter(function(tid) { return cu.remove_traits.indexOf(tid) < 0; });
            }
            // 正统性变化
            if (cu.legitimacy_delta) {
              ch.legitimacy = clamp((ch.legitimacy||50) + clamp(parseInt(cu.legitimacy_delta)||0, -20, 20), 0, 100);
            }
            // 所在地变更（如被外派、流放、召回京城等）
            if (cu.new_location && typeof cu.new_location === 'string') {
              var _oldLoc = ch.location || GM._capital || '京城';
              ch.location = cu.new_location;
              ch._locationExplicit = false; // AI设置的非编辑器显式
              if (_oldLoc !== cu.new_location) {
                recordChange('characters', cu.name, 'location', _oldLoc, cu.new_location, cu.reason || 'AI推演');
                if (typeof addEB === 'function') addEB('人事', cu.name + '从' + _oldLoc + '赴' + cu.new_location);
              }
            }
            // 立场变化
            if (cu.new_stance && typeof cu.new_stance === 'string') {
              ch.stance = cu.new_stance;
            }
            // 党派变化
            if (cu.new_party !== undefined) {
              ch.party = cu.new_party || '';
            }
            // 压力-特质挂钩
            if (cu.action_type && typeof StressTraitSystem !== 'undefined') {
              var _stressDelta = StressTraitSystem.evaluateStress(ch, cu.action_type);
              if (_stressDelta !== 0) {
                ch.stress = clamp((ch.stress||0) + _stressDelta, 0, 100);
              }
            }
            // NPC记忆：记录重大变化
            if (typeof NpcMemorySystem !== 'undefined' && cu.reason) {
              var _emo = '平';
              if (cu.loyalty_delta && cu.loyalty_delta < -5) _emo = '怒';
              else if (cu.loyalty_delta && cu.loyalty_delta > 5) _emo = '喜';
              else if (cu.stress_delta && cu.stress_delta > 5) _emo = '忧';
              var _imp = Math.min(10, Math.max(1, Math.abs(cu.loyalty_delta||0) + Math.abs(cu.stress_delta||0)));
              if (_imp >= 3) NpcMemorySystem.remember(cu.name, cu.reason, _emo, _imp, '天子');
            }
          });
        }

        // 处理势力变化
        if (p1.faction_changes && Array.isArray(p1.faction_changes)) {
          p1.faction_changes.forEach(function(fc) {
            if (!fc.name) return;
            var fac = (typeof _fuzzyFindFac === 'function' ? _fuzzyFindFac(fc.name) : null) || findFacByName(fc.name);
            if (!fac) return;
            if (fc.strength_delta) {
              var oldS = fac.strength || 50;
              var _strClamp = (typeof _getModeParams === 'function') ? _getModeParams().strengthClamp * 2 : 20;
              fac.strength = clamp(oldS + clamp(parseInt(fc.strength_delta)||0, -_strClamp, _strClamp), 0, 100);
              recordChange('factions', fc.name, 'strength', oldS, fac.strength, fc.reason || 'AI\u63A8\u6F14');
            }
            if (fc.economy_delta) {
              fac.economy = clamp((fac.economy || 50) + clamp(parseInt(fc.economy_delta)||0, -20, 20), 0, 100);
            }
            if (fc.playerRelation_delta) {
              fac.playerRelation = clamp((fac.playerRelation || 0) + clamp(parseInt(fc.playerRelation_delta)||0, -30, 30), -100, 100);
            }
            // 势力覆灭级联（在所有delta处理完毕后检查）
            // [Slice D/F\u00B72026-05-10] \u8D70 TM.FactionMembership.dissolveFaction \u4E09\u6863\u8F6C\u5C01\u7B56\u7565
            if (fac.strength <= 0 && !fac.destroyed) {
              fac.destroyed = true;
              addEB('\u52BF\u529B\u52A8\u6001', fc.name + '\u5DF2\u8986\u706D\uFF1A' + (fc.reason || ''));
              if (typeof GameEventBus !== 'undefined') GameEventBus.emit('faction:defeated', { name: fc.name, reason: fc.reason || '' });
              var _membersBefore = (GM.chars||[]).filter(function(c){return c.alive !== false && c.faction === fc.name;}).map(function(c){return c.name;});
              if (typeof window !== 'undefined' && window.TM && TM.FactionMembership && TM.FactionMembership.dissolveFaction) {
                TM.FactionMembership.dissolveFaction(fc.name, { reason: fc.reason || '\u5176\u529B\u8870\u7AF8', conqueror: fc.conqueror || '' });
              } else if (GM.chars) {
                GM.chars.forEach(function(c) {
                  if (c.alive !== false && c.faction === fc.name) c.faction = '';
                });
              }
              if (GM.chars && typeof NpcMemorySystem !== 'undefined') {
                _membersBefore.forEach(function(_nm){
                  NpcMemorySystem.remember(_nm, '\u6240\u5C5E\u52BF\u529B' + fc.name + '\u8986\u706D', '\u5FE7', 8);
                });
              }
              if (GM.armies) {
                GM.armies.forEach(function(a) {
                  if (!a.destroyed && a._factionHistory && a._factionHistory.length > 0) {
                    var _lastH = a._factionHistory[a._factionHistory.length - 1];
                    if (_lastH.from === fc.name && _lastH.turn === (GM.turn || 0)) {
                      a.morale = Math.max(0, (a.morale || 50) - 30);
                      addEB('\u519B\u4E8B', a.name + '\u56E0\u52BF\u529B\u8986\u706D\u58EB\u6C14\u5D29\u6E83');
                    }
                  }
                });
              }
            }
          });
        }

        // ── 处理势力自治事件 ──
        // 条约违约检测
        if (p1.faction_events && typeof TreatySystem !== 'undefined' && TreatySystem.checkViolations) {
          TreatySystem.checkViolations(p1.faction_events);
        }
        if (p1.faction_events && Array.isArray(p1.faction_events)) {
          p1.faction_events.forEach(function(fe) {
            if (!fe.actor || !fe.action) return;
            var evt = { turn: GM.turn, actor: fe.actor, target: fe.target || '', action: fe.action, result: fe.result || '' };
            if (!GM.factionEvents) GM.factionEvents = [];
            GM.factionEvents.push(evt);
            // 防止无限增长——保留最近100条
            if (GM.factionEvents.length > 100) GM.factionEvents = GM.factionEvents.filter(function(e) { return e.turn >= GM.turn - 5; });
            // 内政事件的strength_effect自动应用
            var _seVal = parseFloat(fe.strength_effect);
            if (!isNaN(_seVal) && _seVal !== 0) {
              var _seFac = findFacByName(fe.actor);
              if (_seFac) {
                _seFac.strength = clamp((_seFac.strength||50) + clamp(_seVal, -10, 10), 0, 100);
              }
            }
            // 分类事件日志
            var _feTag = fe.actionType ? fe.actionType : (fe.target ? '外交' : '内政');
            addEB('势力·' + _feTag, fe.actor + (fe.target ? '→' + fe.target : '') + '：' + fe.action + (fe.result ? '(' + fe.result + ')' : ''));
            _dbg('[FactionEvent/' + _feTag + '] ' + fe.actor + ' → ' + (fe.target || '自身') + ': ' + fe.action);

            // ── 机械系统自动路由 ──
            var _act = (fe.action || '').toLowerCase();
            // 宣战 → CasusBelliSystem
            if ((_act.indexOf('宣战') >= 0 || _act.indexOf('开战') >= 0) && fe.target) {
              if (typeof CasusBelliSystem !== 'undefined') CasusBelliSystem.declareWar(fe.actor, fe.target, fe.casusBelli || 'none');
              if (typeof GameEventBus !== 'undefined') GameEventBus.emit('war:start', {attacker: fe.actor, defender: fe.target, reason: fe.action});
            }
            // 结盟/和亲/朝贡/互市 → TreatySystem
            if (typeof TreatySystem !== 'undefined') {
              if (_act.indexOf('结盟') >= 0 || _act.indexOf('同盟') >= 0) TreatySystem.createTreaty('alliance', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('和亲') >= 0) TreatySystem.createTreaty('marriage', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('朝贡') >= 0) TreatySystem.createTreaty('tribute', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('互市') >= 0) TreatySystem.createTreaty('trade', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('停战') >= 0 || _act.indexOf('讲和') >= 0) TreatySystem.createTreaty('truce', fe.actor, fe.target || '', fe.terms);
            }
            // 行军 → MarchSystem
            if ((_act.indexOf('行军') >= 0 || _act.indexOf('调军') >= 0 || _act.indexOf('进军') >= 0) && typeof MarchSystem !== 'undefined' && MarchSystem._getConfig().enabled) {
              var _marchArmy = (GM.armies||[]).find(function(a) { return a.name === fe.actor || a.faction === fe.actor; });
              if (_marchArmy && fe.target) {
                MarchSystem.createMarchOrder(_marchArmy, _marchArmy.garrison || _marchArmy.location || fe.actor, fe.target, fe.geoData || null);
              }
            }
            // 政变/叛乱 → 势力实力大幅变动
            if (_act.indexOf('政变') >= 0 || _act.indexOf('叛乱') >= 0 || _act.indexOf('篡位') >= 0) {
              var _coupFac = findFacByName(fe.actor);
              if (_coupFac) {
                _coupFac.strength = Math.max(5, (_coupFac.strength||50) - 15); // 内部动荡大减实力
                if (fe.result && (fe.result.indexOf('成功') >= 0 || fe.result.indexOf('胜') >= 0)) {
                  // 政变成功——可能更换首领
                  if (fe.newLeader) _coupFac.leader = fe.newLeader;
                  _coupFac.strength = Math.min(100, (_coupFac.strength||30) + 10); // 稳定后回升
                }
              }
            }
            // 改革 → 实力缓慢提升（但可能引发内部不满）
            if (_act.indexOf('改革') >= 0 || _act.indexOf('变法') >= 0) {
              var _reformFac = findFacByName(fe.actor);
              if (_reformFac) _reformFac.strength = Math.min(100, (_reformFac.strength||50) + 2);
            }
            // 征兵 → 军事力量增长
            if (_act.indexOf('征兵') >= 0 || _act.indexOf('扩军') >= 0) {
              var _recFac = findFacByName(fe.actor);
              if (_recFac && _recFac.militaryStrength) {
                _recFac.militaryStrength = Math.round(_recFac.militaryStrength * 1.1);
              }
            }
            // 围城 → SiegeSystem
            if ((_act.indexOf('围城') >= 0 || _act.indexOf('攻城') >= 0 || _act.indexOf('围困') >= 0) && typeof SiegeSystem !== 'undefined' && SiegeSystem._getConfig().enabled) {
              var _siegeArmy = (GM.armies||[]).find(function(a) { return a.name === fe.actor || a.faction === fe.actor; });
              if (_siegeArmy) {
                // 三层读取：AI事件字段 → AI geoData → 地图区域 → 默认值
                var _siegeRegion = (P.map&&P.map.regions||[]).find(function(r){return (r.id||r.name)===fe.target;});
                var _geo = fe.geoData || {};
                var _siegeFort = fe.fortLevel || _geo.fortLevel || (_siegeRegion ? (_siegeRegion.passLevel||0) : 2);
                var _siegeGarrison = fe.garrison || _geo.garrison || (_siegeRegion ? (_siegeRegion.troops||3000) : 3000);
                SiegeSystem.createSiege(_siegeArmy, fe.target || '未知城池', _siegeFort, _siegeGarrison);
              }
            }
          });
        }

        // ── 处理势力间关系变化 ──
        if (p1.faction_relation_changes && Array.isArray(p1.faction_relation_changes)) {
          if (!GM.factionRelations) GM.factionRelations = [];
          p1.faction_relation_changes.forEach(function(rc) {
            if (!rc.from || !rc.to) return;
            var delta = parseInt(rc.delta) || 0;
            // 查找已有关系
            var existing = GM.factionRelations.find(function(r) { return r.from === rc.from && r.to === rc.to; });
            if (existing) {
              if (rc.type) existing.type = rc.type;
              existing.value = clamp((existing.value || 0) + delta, -100, 100);
              if (rc.reason) existing.desc = rc.reason;
            } else {
              GM.factionRelations.push({ from: rc.from, to: rc.to, type: rc.type || '中立', value: clamp(delta, -100, 100), desc: rc.reason || '' });
            }
            // 双向：自动创建反向关系（如果不存在）
            var reverse = GM.factionRelations.find(function(r) { return r.from === rc.to && r.to === rc.from; });
            if (!reverse) {
              GM.factionRelations.push({ from: rc.to, to: rc.from, type: rc.type || '中立', value: clamp(delta, -100, 100), desc: rc.reason || '' });
            } else {
              // 反向也受影响（幅度减半）
              reverse.value = clamp((reverse.value || 0) + Math.round(delta * 0.5), -100, 100);
            }
            _dbg('[FactionRelChange] ' + rc.from + '→' + rc.to + ' ' + (rc.type || '') + ' ' + delta + ' ' + (rc.reason || ''));
          });
          // 防止无限增长——合并重复关系对，保留最新值
          if (GM.factionRelations && GM.factionRelations.length > 200) {
            var _relMap = {};
            GM.factionRelations.forEach(function(r) { _relMap[r.from + '→' + r.to] = r; });
            GM.factionRelations = Object.values(_relMap);
          }
          if (typeof syncFactionRelationsFromList === 'function') syncFactionRelationsFromList(GM.factionRelations);
        }

        // 处理党派变化
        if (p1.party_changes && Array.isArray(p1.party_changes)) {
          p1.party_changes.forEach(function(pc) {
            if (!pc.name) return;
            var party = null;
            if (GM.parties) GM.parties.forEach(function(p) { if (p.name === pc.name) party = p; });
            if (!party) return;
            if (pc.influence_delta) {
              var oldI = party.influence || 50;
              party.influence = clamp(oldI + clamp(parseInt(pc.influence_delta)||0, -20, 20), 0, 100);
              recordChange('parties', pc.name, 'influence', oldI, party.influence, pc.reason || 'AI\u63A8\u6F14');
            }
            if (pc.new_status) { party.status = pc.new_status; addEB('\u515A\u6D3E', pc.name + '\u72B6\u6001\u53D8\u4E3A' + pc.new_status); }
            if (pc.new_leader) { party.leader = pc.new_leader; addEB('\u515A\u6D3E', pc.name + '\u65B0\u9996\u9886:' + pc.new_leader); }
            if (pc.new_agenda) party.currentAgenda = pc.new_agenda;
            if (pc.new_shortGoal) party.shortGoal = pc.new_shortGoal;
          });
        }

        // 处理阶层变化
        if (p1.class_changes && Array.isArray(p1.class_changes)) {
          p1.class_changes.forEach(function(cc) {
            if (!cc.name) return;
            var cls = null;
            if (GM.classes) GM.classes.forEach(function(c) { if (c.name === cc.name) cls = c; });
            if (!cls) return;
            var _classWrite = null;
            if (TM && TM.ClassEngine && typeof TM.ClassEngine.applyClassChange === 'function') {
              try {
                _classWrite = TM.ClassEngine.applyClassChange(GM, cls, cc, { turn: GM.turn, source: 'endturn-ai-infer' });
              } catch(_clsE) {
                (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_clsE, 'endturn] class change helper:') : console.warn('[endturn] class change helper:', _clsE);
              }
            }
            if (_classWrite && _classWrite.ok) {
              recordChange('classes', cc.name, 'satisfaction', _classWrite.before.satisfaction, _classWrite.after.satisfaction, cc.reason || 'AI\u63A8\u6F14');
              recordChange('classes', cc.name, 'influence', _classWrite.before.influence, _classWrite.after.influence, cc.reason || 'AI\u63A8\u6F14');
            } else {
              var _fallbackSatApplied = 0;
              if (cc.satisfaction_delta) {
                var oldS = parseInt(cls.satisfaction) || 50;
                cls.satisfaction = clamp(oldS + clamp(parseInt(cc.satisfaction_delta)||0, -20, 20), 0, 100);
                _fallbackSatApplied = cls.satisfaction - oldS;
                recordChange('classes', cc.name, 'satisfaction', oldS, cls.satisfaction, cc.reason || 'AI\u63A8\u6F14');
              }
              if (cc.influence_delta) {
                var oldI = parseInt(cls.influence || cls.classInfluence) || 50;
                cls.influence = clamp(oldI + clamp(parseInt(cc.influence_delta)||0, -20, 20), 0, 100);
                recordChange('classes', cc.name, 'influence', oldI, cls.influence, cc.reason || 'AI\u63A8\u6F14');
              }
              if (cc.new_demands) cls.demands = cc.new_demands;
              if (cc.new_status) cls.status = cc.new_status;
              if (_fallbackSatApplied && TM && TM.ClassEngine && typeof TM.ClassEngine.applyClassPartyCoupling === 'function') {
                try {
                  TM.ClassEngine.applyClassPartyCoupling(GM, cls, _fallbackSatApplied, { turn: GM.turn, source: 'endturn-ai-infer', reason: cc.reason || '' });
                } catch(_classCoupleFallbackE) {
                  (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_classCoupleFallbackE, 'endturn] class party fallback coupling:') : console.warn('[endturn] class party fallback coupling:', _classCoupleFallbackE);
                }
              }
            }
          });
        }

        if (TM && TM.ClassEngine && typeof TM.ClassEngine.applyAlertResponses === 'function') {
          try {
            TM.ClassEngine.applyAlertResponses(GM, p1.class_alert_responses, { turn: GM.turn, source: 'endturn-ai-infer' });
          } catch(_classAlertE) {
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_classAlertE, 'endturn] class alert responses:') : console.warn('[endturn] class alert responses:', _classAlertE);
          }
        }

        if (Array.isArray(p1.reissue_topics) && p1.reissue_topics.length > 0 && typeof window._ty3_applyAIReissueTopics === 'function') {
          try {
            window._ty3_applyAIReissueTopics(p1.reissue_topics, { turn: GM.turn, source: 'endturn-ai-infer', deferOpen: true });
          } catch(_reissueTopicsE) {
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_reissueTopicsE, 'endturn] reissue topics:') : console.warn('[endturn] reissue topics:', _reissueTopicsE);
          }
        }

        // 处理部队变化
        if (p1.army_changes && Array.isArray(p1.army_changes)) {
          p1.army_changes.forEach(function(ac) {
            if (!ac.name) return;
            if (typeof global.applyAIArmyChange === 'function') {
              global.applyAIArmyChange(ac, { source: 'endturn.army_changes', recordChange: recordChange });
              return;
            }
            var army = GM.armies ? GM.armies.find(function(a) { return a.name === ac.name; }) : null;
            if (!army) return;
            if (ac.soldiers_delta) {
              var oldS = army.soldiers || 0;
              army.soldiers = Math.max(0, oldS + (parseInt(ac.soldiers_delta) || 0));
              recordChange('military', ac.name, 'soldiers', oldS, army.soldiers, ac.reason || 'AI推演');
              // 部队全灭
              if (army.soldiers <= 0) { army.destroyed = true; addEB('军事', ac.name + '全军覆没：' + (ac.reason || '')); }
            }
            if (ac.morale_delta) {
              var oldM = army.morale || 50;
              army.morale = clamp(oldM + clamp(parseInt(ac.morale_delta) || 0, -30, 30), 0, 100);
              recordChange('military', ac.name, 'morale', oldM, army.morale, ac.reason || 'AI推演');
            }
            if (ac.training_delta) {
              var oldT = army.training || 50;
              army.training = clamp(oldT + clamp(parseInt(ac.training_delta) || 0, -20, 20), 0, 100);
            }
            // 5.2: AI调兵——设置行军目的地
            if (ac.destination && typeof ac.destination === 'string') {
              army.destination = ac.destination;
              army._remainingDistance = 0; // 重置，armyMarch pipeline会重新计算
              addEB('\u884C\u519B', ac.name + '\u63A5\u4EE4\u8C03\u5F80' + ac.destination);
            }
          });
        }

        // 处理物品变动
        if (p1.item_changes && Array.isArray(p1.item_changes)) {
          p1.item_changes.forEach(function(ic) {
            if (!ic.name) return;
            var item = GM.items ? GM.items.find(function(it) { return it.name === ic.name; }) : null;
            if (!item) return;
            var wasAcquired = item.acquired;
            if (ic.acquired !== undefined) item.acquired = !!ic.acquired;
            if (ic.owner !== undefined) item.owner = ic.owner;
            if (item.acquired && !wasAcquired) {
              addEB('\u7269\u54C1', '\u83B7\u5F97' + ic.name + (ic.reason ? '\uFF1A' + ic.reason : ''));
            } else if (!item.acquired && wasAcquired) {
              addEB('\u7269\u54C1', '\u5931\u53BB' + ic.name + (ic.reason ? '\uFF1A' + ic.reason : ''));
            }
          });
        }

        // 处理时代状态变动
        if (p1.era_state_delta && GM.eraState) {
          ['socialStability','economicProsperity','centralControl','militaryProfessionalism','culturalVibrancy','bureaucracyStrength'].forEach(function(key) {
            var dk = key + '_delta';
            if (p1.era_state_delta[dk]) {
              var d = parseFloat(p1.era_state_delta[dk]) || 0;
              d = Math.max(-0.1, Math.min(0.1, d)); // 每回合最大±10%
              var oldV = GM.eraState[key] || 0.5;
              GM.eraState[key] = Math.max(0, Math.min(1, oldV + d));
            }
          });
          // 朝代阶段可由AI直接调整
          if (p1.era_state_delta.dynastyPhase) GM.eraState.dynastyPhase = p1.era_state_delta.dynastyPhase;
        }

        // 处理全局状态指标变动（税压）
        if (p1.global_state_delta) {
          var gsd = p1.global_state_delta;
          if (gsd.taxPressure_delta) GM.taxPressure = clamp((GM.taxPressure||50) + clamp(parseInt(gsd.taxPressure_delta)||0, -15, 15), 0, 100);
        }

        // 处理官制占位实体化（将 generated:false 占位变成真角色）
        if (p1.office_spawn && Array.isArray(p1.office_spawn) && GM.officeTree) {
          var _spawnedCount = 0;
          p1.office_spawn.forEach(function(sp) {
            if (!sp || !sp.dept || !sp.position || !sp.holderName) return;
            if (_spawnedCount >= 5) return; // 单回合上限
            // 重名校验
            if (findCharByName(sp.holderName)) {
              _dbg('[office_spawn] 跳过：姓名重复 ' + sp.holderName);
              return;
            }
            // 递归找 position
            var targetPos = null, targetDept = null;
            (function walk(ns, deptChain) {
              ns.forEach(function(n) {
                if (!n) return;
                var chain = deptChain ? deptChain + '·' + n.name : n.name;
                if ((n.name === sp.dept || chain.indexOf(sp.dept) >= 0) && Array.isArray(n.positions)) {
                  var found = n.positions.find(function(p){ return p && p.name === sp.position; });
                  if (found && !targetPos) { targetPos = found; targetDept = n; }
                }
                if (n.subs) walk(n.subs, chain);
              });
            })(GM.officeTree, '');
            if (!targetPos) {
              _dbg('[office_spawn] 未找到 ' + sp.dept + '·' + sp.position);
              return;
            }
            if (!Array.isArray(targetPos.actualHolders)) targetPos.actualHolders = [];
            // 找第一个 generated:false 占位
            var slot = targetPos.actualHolders.find(function(h){ return h && h.generated === false; });
            if (!slot) {
              _dbg('[office_spawn] ' + sp.position + ' 无占位可实体化');
              return;
            }
            // 实体化占位
            slot.name = sp.holderName;
            slot.generated = true;
            slot.spawnedTurn = GM.turn;
            // 双向同步老字段（双层模型）
            if (!targetPos.holder) {
              targetPos.holder = sp.holderName;
            } else if (targetPos.holder !== sp.holderName) {
              if (!Array.isArray(targetPos.additionalHolders)) targetPos.additionalHolders = [];
              if (targetPos.additionalHolders.indexOf(sp.holderName) < 0) targetPos.additionalHolders.push(sp.holderName);
            }
            // 更新 actualCount（具象+占位共计）
            var _totalActual = targetPos.actualHolders.length;
            if (targetPos.actualCount == null || targetPos.actualCount < _totalActual) targetPos.actualCount = _totalActual;
            // 创建角色
            var abilities = sp.abilities || {};
            var newChar = {
              name: sp.holderName,
              title: targetDept.name + sp.position,
              officialTitle: sp.position,
              age: parseInt(sp.age, 10) || 35,
              gender: 'male',
              faction: (P.playerInfo && P.playerInfo.factionName) || '',
              stance: sp.stance || '中立',
              loyalty: Math.max(0, Math.min(100, parseInt(sp.loyalty, 10) || 50)),
              intelligence: Math.max(1, Math.min(100, parseInt(abilities.intelligence, 10) || 50)),
              administration: Math.max(1, Math.min(100, parseInt(abilities.administration, 10) || 50)),
              military: Math.max(1, Math.min(100, parseInt(abilities.military, 10) || 40)),
              valor: Math.max(1, Math.min(100, parseInt(abilities.valor, 10) || 40)),
              charisma: Math.max(1, Math.min(100, parseInt(abilities.charisma, 10) || 50)),
              diplomacy: Math.max(1, Math.min(100, parseInt(abilities.diplomacy, 10) || 50)),
              benevolence: Math.max(1, Math.min(100, parseInt(abilities.benevolence, 10) || 50)),
              personality: sp.personality || '',
              alive: true,
              _spawnedFromOffice: { dept: targetDept.name, position: sp.position, turn: GM.turn, reason: sp.reason || '' }
            };
            if (!Array.isArray(GM.chars)) GM.chars = [];
            GM.chars.push(newChar);
            _spawnedCount++;
            addEB('\u5B98\u5236', '\u3010\u5B9E\u4F53\u5316\u3011' + sp.holderName + '\u5C31\u4EFB' + targetDept.name + sp.position + (sp.reason ? '\uFF08' + sp.reason + '\uFF09' : ''));
            if (GM.qijuHistory) {
              GM.qijuHistory.unshift({
                turn: GM.turn,
                date: typeof getTSText === 'function' ? getTSText(GM.turn) : '',
                content: '\u3010\u5B98\u5236\u5B9E\u4F53\u3011\u900F\u8FC7\u63A8\u6F14\u6D89\u53CA\uFF0C' + targetDept.name + sp.position + '\u4E4B\u4F4D\u4E4B\u4EFB\u804C\u8005' + sp.holderName + '\u6D6E\u51FA\u53F2\u4E0B\u3002' + (sp.reason || ''),
                category: '\u5B98\u5236'
              });
            }
          });
        }

        // ── 党派议程演进 ──
        if (p1.party_agenda_shift && Array.isArray(p1.party_agenda_shift) && GM.parties) {
          p1.party_agenda_shift.forEach(function(sh) {
            if (!sh || !sh.party) return;
            var pObj = GM.parties.find(function(p){return p.name === sh.party;});
            if (!pObj) return;
            var old = pObj.currentAgenda || sh.oldAgenda || '';
            pObj.currentAgenda = sh.newAgenda || pObj.currentAgenda;
            if (sh.influence_delta) pObj.influence = Math.max(0, Math.min(100, (pObj.influence||50) + parseFloat(sh.influence_delta)));
            if (!Array.isArray(pObj.agenda_history)) pObj.agenda_history = [];
            pObj.agenda_history.push({ turn: GM.turn, agenda: sh.newAgenda || '', outcome: sh.reason || '', prev: old });
            if (pObj.agenda_history.length > 20) pObj.agenda_history = pObj.agenda_history.slice(-20);
            addEB('\u515A\u4E89', sh.party + '\u8BAE\u7A0B\u8F6C\u5411\u300C' + (sh.newAgenda || '') + '\u300D' + (sh.reason ? '\uFF08' + sh.reason + '\uFF09' : ''));
          });
        }

        // ── 党派分裂 ──
        if (p1.party_splinter && Array.isArray(p1.party_splinter) && GM.parties) {
          p1.party_splinter.forEach(function(sp) {
            if (!sp || !sp.parent || !sp.newName) return;
            var parent = GM.parties.find(function(p){return p.name === sp.parent;});
            if (!parent) return;
            if (GM.parties.some(function(p){return p.name === sp.newName;})) return;
            var newParty = {
              name: sp.newName,
              ideology: sp.ideology || parent.ideology || '',
              leader: sp.newLeader || '',
              influence: Math.floor((parent.influence||50) * 0.4),
              status: '活跃',
              splinterFrom: parent.name,
              cohesion: 70,
              agenda_history: [{ turn: GM.turn, agenda: '立派', outcome: sp.reason||'' }],
              socialBase: parent.socialBase ? JSON.parse(JSON.stringify(parent.socialBase)) : [],
              memberCount: (sp.members && sp.members.length) || 0,
              description: '自' + parent.name + '分裂，' + (sp.reason||''),
              _createdTurn: GM.turn
            };
            GM.parties.push(newParty);
            parent.influence = Math.max(5, (parent.influence||50) - 15);
            parent.cohesion = Math.max(10, (parent.cohesion||60) - 15);
            // 迁移成员
            if (Array.isArray(sp.members) && GM.chars) {
              sp.members.forEach(function(nm) {
                var ch = findCharByName(nm);
                if (ch && ch.party === parent.name) ch.party = sp.newName;
              });
            }
            addEB('\u515A\u4E89', '\u3010\u5206\u88C2\u3011' + parent.name + '\u5206\u88C2\u51FA' + sp.newName + (sp.reason ? '\uFF08' + sp.reason + '\uFF09' : ''));
          });
        }

        // ── 党派合流 ──
        if (p1.party_merge && Array.isArray(p1.party_merge) && GM.parties) {
          p1.party_merge.forEach(function(mg) {
            if (!mg || !mg.absorber || !mg.absorbed) return;
            var abs = GM.parties.find(function(p){return p.name === mg.absorber;});
            var absd = GM.parties.find(function(p){return p.name === mg.absorbed;});
            if (!abs || !absd) return;
            abs.influence = Math.min(100, (abs.influence||50) + Math.floor((absd.influence||50) * 0.5));
            abs.memberCount = (abs.memberCount||0) + (absd.memberCount||0);
            absd.mergedWith = abs.name;
            absd.status = '已解散';
            // 迁移成员
            if (GM.chars) GM.chars.forEach(function(c){ if (c.party === absd.name) c.party = abs.name; });
            // 从 parties 中移除被吸收方
            GM.parties = GM.parties.filter(function(p){return p.name !== absd.name || p.mergedWith;});
            addEB('\u515A\u4E89', '\u3010\u5408\u6D41\u3011' + absd.name + '\u5E76\u5165' + abs.name + (mg.reason ? '\uFF08' + mg.reason + '\uFF09' : ''));
          });
        }

        // ── 势力继承事件 ──
        if (p1.faction_succession && Array.isArray(p1.faction_succession) && GM.facs) {
          p1.faction_succession.forEach(function(sc) {
            if (!sc || !sc.faction || !sc.newLeader) return;
            var fObj = GM.facs.find(function(f){return f.name === sc.faction;});
            if (!fObj) return;
            var oldLeader = fObj.leader;
            fObj.leader = sc.newLeader;
            if (fObj.leaderInfo) fObj.leaderInfo.name = sc.newLeader;
            if (!fObj.succession) fObj.succession = { rule: 'primogeniture', designatedHeir: '', stability: 60 };
            fObj.succession.stability = Math.max(0, Math.min(100, (fObj.succession.stability||60) + (parseInt(sc.stability_delta)||0)));
            if (!Array.isArray(fObj.historicalEvents)) fObj.historicalEvents = [];
            fObj.historicalEvents.push({ turn: GM.turn, event: sc.disputeType || '继承', impact: oldLeader + '→' + sc.newLeader });
            addEB('\u7EE7\u627F', '\u3010' + sc.faction + '\u3011' + (oldLeader||'?') + '\u2192' + sc.newLeader + '(' + (sc.disputeType||'\u6B63\u5E38\u7EE7\u627F') + ')' + (sc.narrative ? '\uFF1A' + sc.narrative.slice(0,80) : ''));
            if (GM.qijuHistory) {
              GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u7EE7\u627F\u4E8B\u3011' + sc.faction + '\uFF1A' + sc.narrative, category: '\u52BF\u529B' });
            }
          });
        }

        // ── 问对承诺进展更新 ──
        if (p1.commitment_update && Array.isArray(p1.commitment_update) && GM._npcCommitments) {
          p1.commitment_update.forEach(function(cu) {
            if (!cu || !cu.id) return;
            // 遍历找到对应承诺
            var found = null, foundNpc = null;
            Object.keys(GM._npcCommitments).forEach(function(nm) {
              (GM._npcCommitments[nm]||[]).forEach(function(c) {
                if (c.id === cu.id) { found = c; foundNpc = nm; }
              });
            });
            if (!found) return;
            // 若 AI 指定了 npcName 但与实际不符，以实际为准
            var npcActual = cu.npcName || foundNpc;
            found.progress = Math.max(0, Math.min(100, (found.progress||0) + (parseInt(cu.progress_delta,10)||0)));
            if (cu.status) found.status = cu.status;
            if (cu.feedback) found.feedback = cu.feedback;
            found.lastUpdateTurn = GM.turn;
            // 完成/失败处理
            if (found.status === 'completed' || found.consequenceType === 'success') {
              found.status = 'completed';
              addEB('\u95EE\u5BF9\u00B7\u5C65\u884C', foundNpc + '\u4EAB\u606F\uFF1A' + found.task.slice(0,30) + '——' + (cu.feedback||'').slice(0, 40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(foundNpc, '履命完成：' + found.task + '——' + (cu.feedback||''), '慰', 5);
              // 忠诚奖励
              var _cch = findCharByName(foundNpc);
              if (_cch) {
                if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_cch, 3, '\u95EE\u5BF9\u5C65\u547D\u5B8C\u6210', { source:'wendui-task-completed' });
                else _cch.loyalty = Math.min(100, ((typeof _cch.loyalty === 'number' && isFinite(_cch.loyalty)) ? _cch.loyalty : 50) + 3);
              }
            } else if (found.status === 'failed' || cu.consequenceType === 'abandoned') {
              found.status = 'failed';
              addEB('\u95EE\u5BF9\u00B7\u5931\u8BFA', foundNpc + '\u672A\u5C65\uFF1A' + found.task.slice(0,30) + '——' + (cu.feedback||'').slice(0,40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(foundNpc, '未履命：' + found.task + '——' + (cu.feedback||''), '忧', 5);
              var _fch = findCharByName(foundNpc);
              if (_fch) {
                if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_fch, -3, '\u95EE\u5BF9\u5C65\u547D\u5931\u8BFA', { source:'wendui-task-failed' });
                else _fch.loyalty = Math.max(0, ((typeof _fch.loyalty === 'number' && isFinite(_fch.loyalty)) ? _fch.loyalty : 50) - 3);
                _fch.stress = Math.min(100, (_fch.stress||0) + 5);
              }
            } else if (cu.feedback) {
              addEB('\u95EE\u5BF9\u00B7\u8FDB\u5C55', foundNpc + '：' + (cu.feedback||'').slice(0,50));
            }
            // 写入起居注
            if (GM.qijuHistory && cu.feedback) {
              GM.qijuHistory.unshift({
                turn: GM.turn,
                date: typeof getTSText==='function'?getTSText(GM.turn):'',
                content: '【问对·履命】' + foundNpc + '就「' + found.task + '」：' + cu.feedback,
                category: '问对'
              });
            }
            // 完成/失败的承诺保留在 list 但状态终结；deadline 过期未完成自动标 failed
            if (found.status === 'pending' || found.status === 'executing' || found.status === 'delayed') {
              var elapsed = GM.turn - found.assignedTurn;
              if (elapsed > (found.deadline || 3) + 2 && found.progress < 50) {
                found.status = 'failed';
                addEB('\u95EE\u5BF9\u00B7\u8FC7\u671F', foundNpc + '迟迟未办：' + found.task.slice(0,30));
              }
            }
          });
        }

        // ── 起义前兆（酝酿期） ──
        if (p1.revolt_precursor && Array.isArray(p1.revolt_precursor)) {
          if (!Array.isArray(GM._revoltPrecursors)) GM._revoltPrecursors = [];
          p1.revolt_precursor.forEach(function(pc) {
            if (!pc || !pc.class || !pc.indicator) return;
            GM._revoltPrecursors.push({
              turn: GM.turn, class: pc.class, region: pc.region || '',
              indicator: pc.indicator, severity: pc.severity || 'mild',
              detail: pc.detail || '', couldLeadTo: pc.couldLeadTo || ''
            });
            // 老前兆自动过期（>15 回合）
            GM._revoltPrecursors = GM._revoltPrecursors.filter(function(p){return GM.turn - p.turn < 15;});
            // 推动 unrestLevels 下降（对应阶层）
            var _cObj = (GM.classes||[]).find(function(c){return c.name === pc.class;});
            if (_cObj) {
              if (!_cObj.unrestLevels) _cObj.unrestLevels = { grievance: 60, petition: 70, strike: 80, revolt: 90 };
              var _drop = pc.severity === 'critical' ? 10 : pc.severity === 'severe' ? 5 : 2;
              _cObj.unrestLevels.grievance = Math.max(0, (_cObj.unrestLevels.grievance||60) - _drop);
              if (pc.severity !== 'mild') _cObj.unrestLevels.petition = Math.max(0, (_cObj.unrestLevels.petition||70) - _drop * 0.7);
              if (pc.severity === 'critical') _cObj.unrestLevels.revolt = Math.max(0, (_cObj.unrestLevels.revolt||90) - _drop * 0.5);
            }
            var _indLbl = {famine:'饥荒',landConcentration:'土地兼并',heavyTax:'苛税',corvee:'繁役',officialCorruption:'吏治腐败',propheticOmen:'谶纬异象',secretSociety:'教门密谋'}[pc.indicator] || pc.indicator;
            addEB('\u524D\u5146', '\u3010' + (pc.region||'') + '\u3011' + pc.class + '——' + _indLbl + '(' + (pc.severity||'') + ')' + (pc.detail?'：' + pc.detail.slice(0,80):''));
          });
        }

        // ── 阶层起义爆发——长周期生命周期起点 ──
        if (p1.class_revolt && Array.isArray(p1.class_revolt) && GM.classes) {
          if (!Array.isArray(GM._activeRevolts)) GM._activeRevolts = [];
          p1.class_revolt.forEach(function(rv) {
            if (!rv || !rv.class || !rv.leaderName) return;
            var cObj = GM.classes.find(function(c){return c.name === rv.class;});
            if (!cObj) return;
            var _rid = rv.revoltId || ('revolt_' + GM.turn + '_' + Math.random().toString(36).slice(2, 8));
            if (GM._activeRevolts.some(function(r){return r.id === _rid;})) return; // 重复ID
            // 生成起义领袖角色（若不存在）
            if (GM.chars && !findCharByName(rv.leaderName)) {
              var _abBase = { intelligence: 50, administration: 40, military: 55, valor: 65, charisma: 75, diplomacy: 40, benevolence: 50 };
              // 根据 ideology 调整能力倾向
              if (rv.ideology === 'religious') { _abBase.charisma += 15; _abBase.intelligence += 10; _abBase.diplomacy += 5; }
              else if (rv.ideology === 'warlord' || rv.organizationType === 'militaryMutiny') { _abBase.military += 15; _abBase.valor += 10; }
              else if (rv.ideology === 'nobleClaim') { _abBase.administration += 15; _abBase.intelligence += 10; _abBase.charisma += 10; }
              else if (rv.ideology === 'populist') { _abBase.benevolence += 15; _abBase.charisma += 10; }
              GM.chars.push({
                name: rv.leaderName,
                title: rv.class + '领袖',
                faction: rv.class + '起义军',
                class: rv.class,
                alive: true,
                age: 35,
                loyalty: 0,
                stance: '反对',
                intelligence: Math.min(100, _abBase.intelligence),
                administration: Math.min(100, _abBase.administration),
                military: Math.min(100, _abBase.military),
                valor: Math.min(100, _abBase.valor),
                charisma: Math.min(100, _abBase.charisma),
                diplomacy: Math.min(100, _abBase.diplomacy),
                benevolence: Math.min(100, _abBase.benevolence),
                personality: '起义领袖——' + (rv.slogan || (rv.demands ? rv.demands.join('、') : '')),
                _spawnedFromRevolt: { revoltId: _rid, class: rv.class, region: rv.region, turn: GM.turn }
              });
            }
            // 生成副将（若指定且不存在）
            if (Array.isArray(rv.secondaryLeaders) && GM.chars) {
              rv.secondaryLeaders.forEach(function(sln) {
                if (!sln || findCharByName(sln)) return;
                GM.chars.push({
                  name: sln, title: rv.class + '义军副将', faction: rv.class + '起义军', class: rv.class, alive: true,
                  age: 32, loyalty: 70, stance: '反对',
                  intelligence: 45, administration: 35, military: 60, valor: 65, charisma: 50, diplomacy: 35, benevolence: 45,
                  _spawnedFromRevolt: { revoltId: _rid, class: rv.class, region: rv.region, turn: GM.turn, role: 'secondary' }
                });
              });
            }
            // 构建 revolt 实体
            var revolt = {
              id: _rid,
              class: rv.class, region: rv.region || '',
              leaderName: rv.leaderName,
              secondaryLeaders: Array.isArray(rv.secondaryLeaders) ? rv.secondaryLeaders : [],
              ideology: rv.ideology || 'populist',
              organizationType: rv.organizationType || 'flowingBandit',
              slogan: rv.slogan || '',
              religiousSect: rv.religiousSect || '',
              historicalArchetype: rv.historicalArchetype || '',
              scale: rv.scale || '中',
              militaryStrength: parseInt(rv.militaryStrength, 10) || 5000,
              composition: rv.composition || '',
              supplyStatus: 50,
              phase: rv.phase || 'uprising',
              demands: Array.isArray(rv.demands) ? rv.demands : [],
              grievances: Array.isArray(rv.grievances) ? rv.grievances : [],
              spreadPattern: rv.spreadPattern || 'mobile',
              territoryControl: rv.region ? [rv.region] : [],
              absorbedForces: [],
              externalSupport: [],
              defectedOfficials: [],
              startTurn: GM.turn,
              history: [{ turn: GM.turn, phase: rv.phase || 'uprising', event: '首义：' + (rv.reason || rv.slogan || '') }],
              outcome: null
            };
            GM._activeRevolts.push(revolt);

            // 更新阶层领袖
            if (!Array.isArray(cObj.leaders)) cObj.leaders = [];
            if (cObj.leaders.indexOf(rv.leaderName) < 0) cObj.leaders.push(rv.leaderName);
            // 加入 activeWars
            if (!Array.isArray(GM.activeWars)) GM.activeWars = [];
            GM.activeWars.push({
              enemy: rv.class + '起义军', leader: rv.leaderName, region: rv.region,
              militaryStrength: revolt.militaryStrength, turn: GM.turn,
              demands: revolt.demands, revoltId: _rid
            });
            // 清理关联前兆（已爆发）
            if (Array.isArray(GM._revoltPrecursors)) {
              GM._revoltPrecursors = GM._revoltPrecursors.filter(function(pc){return !(pc.class === rv.class && pc.region === rv.region);});
            }
            addEB('\u8D77\u4E49', '\u3010' + (rv.region||'') + '\u3011' + rv.class + '\u8D77\u4E49\uFF01\u9886\u8896' + rv.leaderName + (rv.slogan?'\u6253\u300C' + rv.slogan + '\u300D':'') + '\u2014\u2014' + (rv.historicalArchetype?'\u5F62\u5982' + rv.historicalArchetype + '\uFF0C':'') + '\u89C4\u6A21' + (rv.scale||'\u4E2D') + (rv.reason ? '\u56E0\u2014\u2014' + rv.reason : ''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义爆发】' + rv.leaderName + '起兵于' + (rv.region||'?') + (rv.slogan?'，号"' + rv.slogan + '"':'') + '。' + (rv.reason||''), category: '起义' });
          });
        }

        // ── 起义进展更新 ──
        if (p1.revolt_update && Array.isArray(p1.revolt_update) && GM._activeRevolts) {
          p1.revolt_update.forEach(function(ru) {
            if (!ru || !ru.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === ru.revoltId;});
            if (!r || r.outcome) return;
            var oldPhase = r.phase;
            if (ru.newPhase) r.phase = ru.newPhase;
            if (Array.isArray(ru.territoryGained)) ru.territoryGained.forEach(function(t){ if(t && r.territoryControl.indexOf(t)<0) r.territoryControl.push(t); });
            if (Array.isArray(ru.territoryLost)) ru.territoryLost.forEach(function(t){ r.territoryControl = r.territoryControl.filter(function(tt){return tt !== t;}); });
            if (ru.strength_delta) r.militaryStrength = Math.max(0, (r.militaryStrength||0) + parseInt(ru.strength_delta, 10));
            if (ru.supplyStatus_delta) r.supplyStatus = Math.max(0, Math.min(100, (r.supplyStatus||50) + parseInt(ru.supplyStatus_delta, 10)));
            if (Array.isArray(ru.absorbedForces)) ru.absorbedForces.forEach(function(f){ if (r.absorbedForces.indexOf(f) < 0) r.absorbedForces.push(f); });
            if (Array.isArray(ru.externalSupport)) ru.externalSupport.forEach(function(s){ if (r.externalSupport.indexOf(s) < 0) r.externalSupport.push(s); });
            if (Array.isArray(ru.defectedOfficials)) {
              ru.defectedOfficials.forEach(function(nm) {
                if (r.defectedOfficials.indexOf(nm) < 0) r.defectedOfficials.push(nm);
                var _och = findCharByName(nm);
                if (_och) {
                  // [Slice J·2026-05-10] 走 Membership API
                  if (typeof window !== 'undefined' && window.TM && TM.FactionMembership) {
                    TM.FactionMembership.assignChar(_och, r.class + '起义军', { reason: '官员投奔起义军' });
                  } else {
                    _och.faction = r.class + '起义军';
                  }
                  _tmApplyLoyaltySet(_och, 80, '\u6295\u5954\u8D77\u4E49\u519B', 'revolt-defect');
                  _och._defectedTurn = GM.turn;
                  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(nm, '投奔起义军：' + (r.slogan||''), '决', 8);
                }
              });
            }
            // 领袖伤亡
            if (ru.leaderCasualty) {
              addEB('\u8D77\u4E49', '\u3010' + r.leaderName + '\u3011' + ru.leaderCasualty);
              if (/\u6B7B|\u6218\u6B7B|\u88AB\u6740|\u906E\u6BD9/.test(ru.leaderCasualty)) {
                var _lCh = findCharByName(r.leaderName);
                if (_lCh) { _lCh.alive = false; _lCh.dead = true; _lCh.deathTurn = GM.turn; _lCh.deathReason = ru.leaderCasualty; if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: _lCh.name, reason: ru.leaderCasualty }); }
                // 领袖死亡通常推向 decline（除非已转 establishment）
                if (r.phase !== 'establishment') r.phase = 'decline';
              }
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: ru.keyEvent || ru.narrative || '推进' });
            // 同步 activeWars 的 militaryStrength
            if (Array.isArray(GM.activeWars)) {
              GM.activeWars.forEach(function(w){ if (w.revoltId === r.id) w.militaryStrength = r.militaryStrength; });
            }
            // 自动建政提示——若进入 establishment 而未转化，AI 下回合应 revolt_transform to faction_create
            if (r.phase === 'establishment' && oldPhase !== 'establishment') {
              r._needTransform = true;
            }
            addEB('\u8D77\u4E49', '\u3010' + r.leaderName + '\u3011' + (oldPhase!==r.phase?'\u8F6C\u5165' + r.phase + '\uFF1A':'\u63A8\u8FDB\uFF1A') + (ru.keyEvent||'') + (ru.narrative?'\u2014\u2014' + ru.narrative.slice(0,80):''));
            if (GM.qijuHistory && (ru.keyEvent || ru.narrative)) {
              GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义·' + r.phase + '】' + r.leaderName + '：' + (ru.keyEvent||ru.narrative||''), category: '起义' });
            }
          });
        }

        // ── 镇压行动 ──
        if (p1.revolt_suppress && Array.isArray(p1.revolt_suppress) && GM._activeRevolts) {
          p1.revolt_suppress.forEach(function(sp) {
            if (!sp || !sp.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === sp.revoltId;});
            if (!r || r.outcome) return;
            var cas = sp.casualties || {};
            if (cas.rebel) r.militaryStrength = Math.max(0, (r.militaryStrength||0) - parseInt(cas.rebel, 10));
            if (sp.tactic === '坚壁清野') r.supplyStatus = Math.max(0, (r.supplyStatus||50) - 15);
            if (sp.tactic === '分化瓦解') { r.absorbedForces = r.absorbedForces.slice(0, Math.max(0, r.absorbedForces.length - 2)); }
            if (sp.outcome === 'victory') {
              r.outcome = 'suppressed';
              r.phase = 'ending';
              // 移除 activeWars
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              // 领袖被杀
              var _l = findCharByName(r.leaderName);
              if (_l) { _l.alive = false; _l.dead = true; _l.deathTurn = GM.turn; _l.deathReason = '起义失败被剿'; if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: _l.name, reason: '起义失败被剿' }); }
            } else if (sp.outcome === 'defeat') {
              // 官军反被击溃——起义壮大
              r.militaryStrength = Math.min(999999, (r.militaryStrength||0) + 3000);
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '镇压:' + (sp.suppressor||'官军') + '-' + (sp.outcome||'相持') });
            addEB('\u9547\u538B', '【' + (sp.suppressor||'官军') + '】' + (sp.tactic||'') + '→' + r.leaderName + '之乱' + (sp.outcome==='victory'?'\u5E73\u5B9A':sp.outcome==='defeat'?'\u53CD\u88AB\u51FB\u6E83':'') + (sp.narrative?'\u2014\u2014' + sp.narrative.slice(0,80):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【镇压】' + (sp.suppressor||'?') + '战' + r.leaderName + '，结' + (sp.outcome||'?') + '。' + (sp.narrative||''), category: '起义' });
          });
        }

        // ── 招安行动 ──
        if (p1.revolt_amnesty && Array.isArray(p1.revolt_amnesty) && GM._activeRevolts) {
          p1.revolt_amnesty.forEach(function(am) {
            if (!am || !am.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === am.revoltId;});
            if (!r || r.outcome) return;
            if (am.outcome === 'accepted') {
              r.outcome = 'coopted';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              // 领袖归顺：faction 改回朝廷，loyalty 恢复
              var _acLeaders = Array.isArray(am.acceptedLeaders) && am.acceptedLeaders.length ? am.acceptedLeaders : [r.leaderName];
              _acLeaders.forEach(function(nm) {
                var _ch = findCharByName(nm);
                if (_ch) {
                  // [Slice J\u00B72026-05-10] \u8D70 Membership API
                  var _newFac = (P.playerInfo && P.playerInfo.factionName) || _ch.faction;
                  if (typeof window !== 'undefined' && window.TM && TM.FactionMembership && _newFac !== _ch.faction) {
                    TM.FactionMembership.assignChar(_ch, _newFac, { reason: '\u62DB\u5B89\u5F52\u9644' });
                  } else {
                    _ch.faction = _newFac;
                  }
                  _tmApplyLoyaltySet(_ch, 45, '\u62DB\u5B89\u5F52\u9644', 'revolt-amnesty-accepted');
                  _ch._cooptedTurn = GM.turn;
                  _ch.title = '归附·' + (_ch.title || '将领');
                }
              });
            } else if (am.outcome === 'split') {
              // 分化：接受者归顺，拒绝者继续
              if (Array.isArray(am.acceptedLeaders)) {
                am.acceptedLeaders.forEach(function(nm) {
                  var _ch = findCharByName(nm);
                  if (_ch) {
                    // [Slice J\u00B72026-05-10] \u8D70 Membership API
                    var _newFac = (P.playerInfo && P.playerInfo.factionName) || _ch.faction;
                    if (typeof window !== 'undefined' && window.TM && TM.FactionMembership && _newFac !== _ch.faction) {
                      TM.FactionMembership.assignChar(_ch, _newFac, { reason: '\u5206\u5316\u5F52\u9644' });
                    } else {
                      _ch.faction = _newFac;
                    }
                    _tmApplyLoyaltySet(_ch, 40, '\u5206\u5316\u5F52\u9644', 'revolt-amnesty-split');
                    _ch._cooptedTurn = GM.turn;
                  }
                });
              }
              r.militaryStrength = Math.floor((r.militaryStrength||0) * 0.5);
              r.phase = 'decline';
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '招安:' + (am.envoy||'') + '-' + (am.outcome||'') });
            addEB('\u62DB\u5B89', '【' + (am.envoy||'?') + '】招安' + r.leaderName + '：' + (am.outcome||'?') + (am.terms?'；条件：' + am.terms.slice(0,60):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【招安】' + (am.envoy||'?') + '抚' + r.leaderName + '，' + (am.outcome||'?') + '。' + (am.narrative||''), category: '起义' });
          });
        }

        // ── 起义转化（建政 / 招安编入 / 融入他派 / 改朝） ──
        if (p1.revolt_transform && Array.isArray(p1.revolt_transform) && GM._activeRevolts) {
          p1.revolt_transform.forEach(function(tr) {
            if (!tr || !tr.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === tr.revoltId;});
            if (!r || r.outcome) return;
            if (tr.transformType === 'toFaction' && tr.newFactionName) {
              // 自动创建 faction
              if (!Array.isArray(GM.facs)) GM.facs = [];
              if (!GM.facs.some(function(f){return f.name === tr.newFactionName;})) {
                GM.facs.push({
                  id: 'faction_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
                  name: tr.newFactionName,
                  type: r.organizationType === 'builtState' ? '主权国' : '起义军',
                  leader: r.leaderName,
                  territory: (tr.finalTerritory || r.territoryControl.join('、')),
                  strength: Math.min(100, 20 + Math.floor((r.militaryStrength||0) / 5000)),
                  militaryStrength: r.militaryStrength || 10000,
                  economy: 30,
                  attitude: '敌对',
                  playerRelation: -50,
                  cohesion: { political: 40, military: 70, economic: 30, cultural: r.ideology === 'religious' ? 80 : 50, ethnic: r.ideology === 'ethnic' ? 90 : 60, loyalty: 70 },
                  militaryBreakdown: { standingArmy: Math.floor((r.militaryStrength||0) * 0.6), militia: Math.floor((r.militaryStrength||0) * 0.4), elite: 0, fleet: 0 },
                  succession: { rule: 'strongest', designatedHeir: '', stability: 30 },
                  historicalEvents: [{ turn: r.startTurn, event: '起义立国', impact: r.slogan||'' }, { turn: GM.turn, event: '正式建政', impact: tr.narrative||'' }],
                  internalParties: [],
                  description: '自' + r.class + '起义（' + (r.historicalArchetype||'') + '）升级',
                  color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),
                  _createdTurn: GM.turn,
                  _fromRevolt: r.id
                });
                // 更新角色 faction·走 Membership API
                if (GM.chars) {
                  if (typeof window !== 'undefined' && window.TM && TM.FactionMembership) {
                    TM.FactionMembership.bulkReassignChars(function(c){return c.faction === r.class + '起义军';}, tr.newFactionName, { reason: '起义军建政·' + tr.newFactionName });
                  } else {
                    GM.chars.filter(function(c){return c.faction === r.class + '起义军';}).forEach(function(c){ c.faction = tr.newFactionName; });
                  }
                }
                // activeWars 更新
                if (Array.isArray(GM.activeWars)) {
                  GM.activeWars.forEach(function(w){ if (w.revoltId === r.id) w.enemy = tr.newFactionName; });
                }
              }
              r.outcome = 'seceded';
              r.phase = 'ending';
            } else if (tr.transformType === 'dynastyReplaced') {
              r.outcome = 'dynastyReplaced';
              r.phase = 'ending';
              // 游戏结束信号——让上层 UI 处理
              GM._gameOverPending = { reason: 'dynasty_replaced_by_revolt', revoltId: r.id, newDynasty: tr.newFactionName, narrative: tr.narrative };
              addEB('\u6539\u671D', '【改朝换代】' + r.leaderName + '之乱颠覆旧朝，' + (tr.newFactionName||'新朝') + '立。');
            } else if (tr.transformType === 'merged' && tr.mergedInto) {
              r.outcome = 'merged';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              if (GM.chars) {
                if (typeof window !== 'undefined' && window.TM && TM.FactionMembership) {
                  TM.FactionMembership.bulkReassignChars(function(c){return c.faction === r.class + '起义军';}, tr.mergedInto, { reason: '起义军并入·' + tr.mergedInto });
                } else {
                  GM.chars.filter(function(c){return c.faction === r.class + '起义军';}).forEach(function(c){ c.faction = tr.mergedInto; });
                }
              }
            } else if (tr.transformType === 'coopted') {
              r.outcome = 'coopted';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
            } else if (tr.transformType === 'dissolved') {
              r.outcome = 'dissolved';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '转化:' + tr.transformType });
            addEB('\u8D77\u4E49', '【转化】' + r.leaderName + '之乱→' + tr.transformType + (tr.newFactionName?'：立' + tr.newFactionName:'') + (tr.narrative?'——' + tr.narrative.slice(0,80):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义转化】' + r.leaderName + '：' + tr.transformType + '。' + (tr.narrative||''), category: '起义' });
          });
        }

        // ── 党派新建 ──
        if (p1.party_create && Array.isArray(p1.party_create)) {
          if (!Array.isArray(GM.parties)) GM.parties = [];
          p1.party_create.forEach(function(pc) {
            if (!pc || !pc.name) return;
            if (GM.parties.some(function(p){return p.name === pc.name;})) return;
            var newP = {
              name: pc.name,
              ideology: pc.ideology || '',
              leader: pc.leader || '',
              influence: parseInt(pc.influence, 10) || 20,
              status: pc.status || '活跃',
              cohesion: parseInt(pc.cohesion, 10) || 70,
              memberCount: parseInt(pc.memberCount, 10) || 0,
              crossFaction: !!pc.crossFaction,
              currentAgenda: pc.currentAgenda || '',
              socialBase: Array.isArray(pc.socialBase) ? pc.socialBase : [],
              agenda_history: [{ turn: GM.turn, agenda: '立党', outcome: pc.reason || pc.trigger || '' }],
              focal_disputes: [],
              officePositions: [],
              description: pc.reason || '',
              _createdTurn: GM.turn
            };
            GM.parties.push(newP);
            // 党魁如是已有角色，则标记其 party
            if (pc.leader) {
              var _ldr = findCharByName(pc.leader);
              if (_ldr) _ldr.party = pc.name;
            }
            addEB('\u515A\u4E89', '\u3010\u65B0\u515A\u5D1B\u8D77\u3011' + pc.name + (pc.leader ? '\uFF08\u9996\uFF1A' + pc.leader + '\uFF09' : '') + (pc.trigger ? '\u2014\u2014' + pc.trigger : '') + (pc.reason ? '\uFF1A' + pc.reason : ''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u65B0\u515A\u3011' + pc.name + '\u6210\u7ACB\u3002' + (pc.reason||''), category: '\u515A\u6D3E' });
          });
        }

        // ── 党派覆灭 ──
        if (p1.party_dissolve && Array.isArray(p1.party_dissolve) && GM.parties) {
          p1.party_dissolve.forEach(function(pd) {
            if (!pd || !pd.name) return;
            var pObj = GM.parties.find(function(p){return p.name === pd.name;});
            if (!pObj) return;
            pObj.status = '已解散';
            pObj._dissolvedTurn = GM.turn;
            pObj._dissolveCause = pd.cause;
            // 成员去向
            if (GM.chars) {
              GM.chars.filter(function(c){return c.party === pd.name;}).forEach(function(c) {
                c.party = '';
                c.partyRank = '';
                c._formerParty = pd.name;
                // 按 fatePerMember 调整状态
                if (pd.cause === 'liquidated' || pd.cause === 'leaderKilled') {
                  _tmApplyLoyaltyDelta(c, -20, '\u515A\u6D3E\u88AB\u6E05\u7B97', 'party-dissolve-liquidated');
                  c.stress = Math.min(100, (c.stress||0) + 25);
                }
                if (typeof NpcMemorySystem !== 'undefined') {
                  var _emo = pd.cause === 'liquidated' ? '恨' : pd.cause === 'leaderKilled' ? '悲' : '忧';
                  NpcMemorySystem.remember(c.name, pd.name + '被' + (pd.cause||'解散') + '——' + (pd.fatePerMember||''), _emo, 7);
                }
              });
            }
            // 从列表中移除（保留 _dissolvedTurn 供历史追溯）
            GM.parties = GM.parties.filter(function(p){return p.name !== pd.name;});
            var _cLbl = {banned:'被查禁',liquidated:'被肃清',faded:'自然消亡',leaderKilled:'领袖被杀而散',absorbed:'被吞并'}[pd.cause] || pd.cause || '覆灭';
            addEB('\u515A\u4E89', '\u3010\u515A\u6D3E\u89E6\u706D\u3011' + pd.name + _cLbl + (pd.perpetrator?'\uFF08' + pd.perpetrator + '\u4E3B\u7F16\uFF09':'') + (pd.reason?'\uFF1A' + pd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u515A\u6D3E\u89E6\u706D\u3011' + pd.name + _cLbl + '\u3002' + (pd.reason||''), category: '\u515A\u6D3E' });
          });
        }

        // ── 势力新建 ──
        if (p1.faction_create && Array.isArray(p1.faction_create)) {
          if (!Array.isArray(GM.facs)) GM.facs = [];
          p1.faction_create.forEach(function(fc) {
            if (!fc || !fc.name) return;
            if (GM.facs.some(function(f){return f.name === fc.name;})) return;
            var newF = {
              id: 'faction_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
              name: fc.name,
              type: fc.type || '起义军',
              leader: fc.leader || '',
              territory: fc.territory || '',
              strength: parseInt(fc.strength, 10) || 30,
              militaryStrength: parseInt(fc.militaryStrength, 10) || 10000,
              economy: parseInt(fc.economy, 10) || 40,
              attitude: fc.attitude || '敌对',
              playerRelation: parseInt(fc.playerRelation, 10) || -30,
              cohesion: fc.cohesion || { political: 50, military: 60, economic: 40, cultural: 50, ethnic: 60, loyalty: 50 },
              militaryBreakdown: { standingArmy: parseInt(fc.militaryStrength, 10)||10000, militia: 0, elite: 0, fleet: 0 },
              succession: { rule: 'strongest', designatedHeir: '', stability: 40 },
              historicalEvents: [{ turn: GM.turn, event: '立国', impact: fc.triggerEvent || fc.reason || '' }],
              internalParties: [],
              parentFaction: fc.parentFaction || '',
              description: fc.reason || '',
              color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),
              _createdTurn: GM.turn
            };
            GM.facs.push(newF);
            if (typeof addToIndex === 'function') addToIndex('fac', newF.name, newF);
            // 关联现有角色·新势力立国·领袖入籍·走 Membership API (Slice J)
            if (fc.leader) {
              var _fLdr = findCharByName(fc.leader);
              if (_fLdr) {
                if (typeof window !== 'undefined' && window.TM && TM.FactionMembership) {
                  TM.FactionMembership.assignChar(_fLdr, fc.name, { reason: '新势力立国·领袖入籍' });
                } else {
                  _fLdr.faction = fc.name;
                }
              }
            }
            // 若有 parentFaction，母势力凝聚力下降
            if (fc.parentFaction) {
              var _par = GM.facs.find(function(f){return f.name === fc.parentFaction;});
              if (_par) {
                if (_par.cohesion) _par.cohesion.political = Math.max(0, (_par.cohesion.political||50) - 15);
                _par.strength = Math.max(5, (_par.strength||50) - 10);
                if (!Array.isArray(_par.historicalEvents)) _par.historicalEvents = [];
                _par.historicalEvents.push({ turn: GM.turn, event: fc.name + '脱离', impact: '政治统一度下降' });
              }
            }
            addEB('\u52BF\u529B', '\u3010\u65B0\u52BF\u529B\u7AD6\u8D77\u3011' + fc.name + '\u6210\u7ACB\uFF08' + (fc.type||'') + '\uFF09' + (fc.parentFaction?'\u2014\u2014\u8131\u79BB\u81EA' + fc.parentFaction:'') + (fc.triggerEvent?'\uFF1A' + fc.triggerEvent:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u65B0\u52BF\u529B\u3011' + fc.name + '\u7AD6\u8D77\u3002' + (fc.reason||''), category: '\u52BF\u529B' });
          });
        }

        // ── 势力覆灭 ──
        if (p1.faction_dissolve && Array.isArray(p1.faction_dissolve) && GM.facs) {
          p1.faction_dissolve.forEach(function(fd) {
            if (!fd || !fd.name) return;
            var fObj = GM.facs.find(function(f){return f.name === fd.name;});
            if (!fObj) return;
            if (fObj.isPlayer) { addEB('势力', '【拒绝】不得在 faction_dissolve 中灭玩家势力'); return; }
            fObj._dissolvedTurn = GM.turn;
            fObj._dissolveCause = fd.cause;
            // 征服者处理
            if (fd.conqueror && (fd.cause === 'conquered' || fd.cause === 'absorbed')) {
              var _con = GM.facs.find(function(f){return f.name === fd.conqueror;});
              if (_con) {
                _con.strength = Math.min(100, (_con.strength||50) + Math.floor((fObj.strength||30) * 0.4));
                if (fObj.militaryStrength) _con.militaryStrength = (_con.militaryStrength||0) + Math.floor(fObj.militaryStrength * 0.3);
                if (!Array.isArray(_con.historicalEvents)) _con.historicalEvents = [];
                _con.historicalEvents.push({ turn: GM.turn, event: '吞并' + fd.name, impact: '国力增强' });
              }
            }
            // 角色处理·走 Membership API (Slice D/F)
            if (GM.chars) {
              var _affected = GM.chars.filter(function(c){return c.faction === fd.name;});
              _affected.forEach(function(c){ c._formerFaction = fd.name; });
              var _newFac = (fd.cause === 'conquered' || fd.cause === 'absorbed') ? (fd.conqueror || '') : '';
              if (typeof window !== 'undefined' && window.TM && TM.FactionMembership) {
                TM.FactionMembership.bulkReassignChars(function(c){return c.faction === fd.name;}, _newFac, {
                  reason: '势力解散·' + (fd.cause||'') + (_newFac?'→' + _newFac:'')
                });
              } else {
                _affected.forEach(function(c){ c.faction = _newFac; });
              }
              if (_newFac) {
                _affected.forEach(function(c){
                  _tmApplyLoyaltyDelta(c, -25, '势力被征服', 'faction-dissolve-conquered');
                  c.stress = Math.min(100, (c.stress||0) + 30);
                });
              }
              if (typeof NpcMemorySystem !== 'undefined') {
                _affected.forEach(function(c){
                  NpcMemorySystem.remember(c.name, fd.name + '亡国：' + (fd.cause||'') + '——' + (fd.leaderFate||''), '悲', 8);
                });
              }
            }
            // 出逃核心人物
            if (Array.isArray(fd.refugees)) {
              fd.refugees.forEach(function(nm) {
                var _r = findCharByName(nm);
                if (_r) { _r._refugee = true; _r._refugeeTurn = GM.turn; _tmApplyLoyaltyDelta(_r, -10, '\u52BF\u529B\u8986\u706D\u51FA\u9003', 'faction-dissolve-refugee'); }
              });
            }
            // 从 activeWars 移除相关条目（该势力已灭）
            if (Array.isArray(GM.activeWars)) {
              GM.activeWars = GM.activeWars.filter(function(w) { return w.enemy !== fd.name; });
            }
            // 从 factions 中移除
            GM.facs = GM.facs.filter(function(f){return f.name !== fd.name;});
            if (typeof removeFromIndex === 'function') removeFromIndex('fac', fd.name);
            // 关系矩阵清理
            if (typeof removeFactionRelationsForFaction === 'function') {
              removeFactionRelationsForFaction(fd.name);
            } else if (GM.factionRelationsMap) {
              delete GM.factionRelationsMap[fd.name];
              Object.keys(GM.factionRelationsMap).forEach(function(k) {
                if (GM.factionRelationsMap[k] && typeof GM.factionRelationsMap[k] === 'object') delete GM.factionRelationsMap[k][fd.name];
                if (k.indexOf(fd.name + '->') === 0 || k.indexOf('->' + fd.name) > 0) delete GM.factionRelationsMap[k];
              });
            }
            var _fcLbl = {conquered:'被征服',absorbed:'被并入',collapsed:'内部崩解',seceded_all:'分崩离析',replaced:'被取代'}[fd.cause] || fd.cause || '覆灭';
            addEB('\u52BF\u529B', '\u3010\u52BF\u529B\u89E6\u706D\u3011' + fd.name + _fcLbl + (fd.conqueror?'\uFF08\u4E3A' + fd.conqueror + '\u6240\u7EC8\uFF09':'') + (fd.territoryFate?'\uFF0C\u7586\u571F:' + fd.territoryFate:'') + (fd.leaderFate?'\u2014\u2014\u9996\u8111:' + fd.leaderFate:'') + (fd.reason?'\uFF1A' + fd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u52BF\u529B\u89E6\u706D\u3011' + fd.name + _fcLbl + '\u3002' + (fd.reason||''), category: '\u52BF\u529B' });
          });
        }

        // ── 阶层兴起 ──
        if (p1.class_emerge && Array.isArray(p1.class_emerge)) {
          if (!Array.isArray(GM.classes)) GM.classes = [];
          p1.class_emerge.forEach(function(ce) {
            if (!ce || !ce.name) return;
            if (GM.classes.some(function(c){return c.name === ce.name;})) return;
            var newC = {
              name: ce.name,
              size: ce.size || '约5%',
              mobility: ce.mobility || '中',
              economicRole: ce.economicRole || '其他',
              status: ce.status || '良民',
              privileges: ce.privileges || '',
              obligations: ce.obligations || '',
              satisfaction: parseInt(ce.satisfaction, 10) || 50,
              influence: parseInt(ce.influence, 10) || 15,
              demands: ce.demands || '',
              unrestThreshold: parseInt(ce.unrestThreshold, 10) || 30,
              representativeNpcs: [],
              leaders: [],
              supportingParties: [],
              regionalVariants: [],
              internalFaction: [],
              unrestLevels: { grievance: 60, petition: 70, strike: 80, revolt: 90 },
              economicIndicators: { wealth: 40, taxBurden: 40, landHolding: 20 },
              description: '【新兴阶层】' + (ce.origin || '') + (ce.reason ? '——' + ce.reason : ''),
              _emergeTurn: GM.turn,
              _origin: ce.origin
            };
            GM.classes.push(newC);
            addEB('\u9636\u5C42', '\u3010\u65B0\u9636\u5C42\u5174\u8D77\u3011' + ce.name + (ce.origin?'\u2014\u2014' + ce.origin:'') + (ce.reason?'\uFF1A' + ce.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u9636\u5C42\u5174\u66BF\u3011' + ce.name + '\u5174\u8D77\u3002' + (ce.reason||''), category: '\u9636\u5C42' });
          });
        }

        // ── 阶层消亡 ──
        if (p1.class_dissolve && Array.isArray(p1.class_dissolve) && GM.classes) {
          p1.class_dissolve.forEach(function(cd) {
            if (!cd || !cd.name) return;
            var cObj = GM.classes.find(function(c){return c.name === cd.name;});
            if (!cObj) return;
            cObj._dissolvedTurn = GM.turn;
            cObj._dissolveCause = cd.cause;
            // 成员流向：character.class 迁移
            if (GM.chars) {
              GM.chars.filter(function(c){return c.class === cd.name;}).forEach(function(c) {
                c._formerClass = cd.name;
                c.class = cd.successorClass || '';
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(c.name, cd.name + '消亡：' + (cd.cause||'') + '——' + (cd.membersFate||''), '忧', 6);
                }
              });
            }
            // 依赖该阶层的党派 socialBase 清理
            if (Array.isArray(GM.parties)) {
              GM.parties.forEach(function(p) {
                if (Array.isArray(p.socialBase)) p.socialBase = p.socialBase.filter(function(sb){return sb.class !== cd.name;});
              });
            }
            // 从 classes 移除
            GM.classes = GM.classes.filter(function(c){return c.name !== cd.name;});
            var _ccLbl = {abolished:'被法令废除',assimilated:'被吸收融合',extincted:'衰落消亡',replaced:'被新阶层取代'}[cd.cause] || cd.cause || '消亡';
            addEB('\u9636\u5C42', '\u3010\u9636\u5C42\u6D88\u4EA1\u3011' + cd.name + _ccLbl + (cd.successorClass?'\uFF08\u7EE7\u4EFB\uFF1A' + cd.successorClass + '\uFF09':'') + (cd.membersFate?'\u2014\u2014\u6210\u5458:' + cd.membersFate:'') + (cd.reason?'\uFF1A' + cd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u9636\u5C42\u6D88\u4EA1\u3011' + cd.name + _ccLbl + '\u3002' + (cd.reason||''), category: '\u9636\u5C42' });
          });
        }

        // ── 势力关系动态变化 ──
        if (TM && TM.ClassEngine && typeof TM.ClassEngine.finalizeTurn === 'function') {
          try {
            TM.ClassEngine.finalizeTurn(GM, p1, { turn: GM.turn, source: 'endturn-ai-infer' });
          } catch(_clsFinalizeE) {
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_clsFinalizeE, 'endturn] class finalize:') : console.warn('[endturn] class finalize:', _clsFinalizeE);
          }
        }

        if (p1.faction_relation_shift && Array.isArray(p1.faction_relation_shift)) {
          p1.faction_relation_shift.forEach(function(rs) {
            if (!rs || !rs.from || !rs.to) return;
            var delta = parseFloat(rs.relation_delta) || 0;
            if (typeof setFactionRelation === 'function') {
              setFactionRelation(rs.from, rs.to, {
                delta: delta,
                new_type: rs.new_type,
                event: rs.event || rs.reason || ''
              }, { mirror: true });
            } else if (typeof ensureFactionRelation === 'function') {
              [ensureFactionRelation(rs.from, rs.to), ensureFactionRelation(rs.to, rs.from)].forEach(function(r) {
                if (!r) return;
                if (delta) r.value = Math.max(-100, Math.min(100, (r.value||0) + delta));
                if (rs.new_type) r.type = rs.new_type;
                if (!Array.isArray(r.historicalEvents)) r.historicalEvents = [];
                r.historicalEvents.push({ turn: GM.turn, event: rs.event || rs.reason || '', delta: delta });
                if (r.historicalEvents.length > 20) r.historicalEvents = r.historicalEvents.slice(-20);
              });
            }
            addEB('\u5916\u4EA4', rs.from + '\u2194' + rs.to + ' ' + (rs.new_type||(delta>0?'\u6539\u5584':'\u6076\u5316')) + (rs.event ? '\uFF1A' + rs.event : ''));
          });
        }

        // 处理官制变动（AI可任命/罢免官员）
        if (p1.office_changes && Array.isArray(p1.office_changes) && GM.officeTree) {
          p1.office_changes.forEach(function(oc) {
            if (!oc.dept || !oc.position || !oc.action) return;
            // 遍历官制树查找匹配的部门和职位
            (function walkTree(nodes) {
              nodes.forEach(function(node) {
                if (node.name === oc.dept && node.positions) {
                  node.positions.forEach(function(pos) {
                    if (pos.name === oc.position) {
                      if (oc.action === 'appoint' && oc.person) {
                        var oldHolder = pos.holder || '';
                        // 新模型：把旧 holder 转成占位再把新 holder 填入
                        if (oldHolder && oldHolder !== oc.person && typeof _offDismissPerson === 'function') _offDismissPerson(pos, oldHolder);
                        if (typeof _offAppointPerson === 'function') _offAppointPerson(pos, oc.person);
                        else pos.holder = oc.person;
                        // 记录继任方式到事件（让叙事更准确）
                        var _succDesc = '';
                        if (pos.succession) {
                          var _succMap = {appointment:'\u6D41\u5B98\u4EFB\u547D',hereditary:'\u4E16\u88AD\u7EE7\u4EFB',examination:'\u79D1\u4E3E\u9009\u62D4',military:'\u519B\u529F\u6388\u804C',recommendation:'\u4E3E\u8350\u4EFB\u7528'};
                          _succDesc = _succMap[pos.succession] ? '(\u4EE5' + _succMap[pos.succession] + ')' : '';
                        }
                        addEB('\u4EFB\u547D', oc.person + _succDesc + '\u4EFB' + oc.dept + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
                        var ch = findCharByName(oc.person);
                        if (ch) {
                          _tmApplyLoyaltyDelta(ch, 5, '\u83B7\u4EFB\u5B98\u804C', 'office-change-appoint');
                          ch.officialTitle = oc.position;
                          ch.title = oc.dept + oc.position;
                          // 举主追踪——从reason中提取"由某某举荐"
                          if (oc.reason) {
                            var _jzMatch = (oc.reason||'').match(/由(.{1,6})举荐|(.{1,6})推荐/);
                            if (_jzMatch) {
                              ch._recommendedBy = _jzMatch[1] || _jzMatch[2];
                              ch._recommendTurn = GM.turn;
                            }
                          }
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(oc.person, 'appointment', '\u4EFB' + oc.dept + oc.position);
                          if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
                            CorruptionEngine.markAsRecentAppointment(ch);
                          }
                        }
                        // 清除旧任职者的官职字段
                        if (oldHolder) {
                          var _oldCh = findCharByName(oldHolder);
                          if (_oldCh && _oldCh.officialTitle === oc.position) _oldCh.officialTitle = '';
                        }
                        // 同步PostSystem（如果有对应post）
                        if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts) {
                          var _mp = GM.postSystem.posts.find(function(p) { return p.name === oc.position || p.name === oc.dept + oc.position; });
                          if (_mp && oc.person) PostTransfer.seat(_mp.id, oc.person, 'AI\u63A8\u6F14');
                        }
                        // 同步行政区划governor（如果该官职对应某个行政单位的主官）
                        if (P.adminHierarchy) {
                          (function _syncAdmGov(ah) {
                            var _aks = Object.keys(ah);
                            _aks.forEach(function(k) {
                              if (!ah[k] || !ah[k].divisions) return;
                              (function _walk(divs) {
                                divs.forEach(function(dv) {
                                  if (dv.officialPosition === oc.position && (!dv.governor || dv.governor === oldHolder)) {
                                    dv.governor = oc.person;
                                    if (GM.provinceStats && GM.provinceStats[dv.name]) GM.provinceStats[dv.name].governor = oc.person;
                                  }
                                  if (dv.children) _walk(dv.children);
                                });
                              })(ah[k].divisions);
                            });
                          })(P.adminHierarchy);
                        }
                      } else if (oc.action === 'promote' && pos.holder) {
                        // 晋升——品级提升，可能调任新职
                        if (oc.newRank) pos.rank = oc.newRank;
                        addEB('晋升', pos.holder + '晋升' + (oc.newRank||'') + (oc.reason ? '（' + oc.reason + '）' : ''));
                        var _pch = findCharByName(pos.holder);
                        if (_pch) {
                          _tmApplyLoyaltyDelta(_pch, 8, '\u664B\u5347\u5B98\u9636', 'office-change-promote');
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(pos.holder, 'promotion', '晋升' + (oc.newRank||''));
                        }
                        // 如果指定了新职位，执行调任
                        if (oc.newPosition && oc.newDept) {
                          var _transferPerson = pos.holder;
                          if (_transferPerson && typeof _offDismissPerson === 'function') _offDismissPerson(pos, _transferPerson);
                          else pos.holder = ''; // 空出旧位
                          // 查找新职位并任命
                          (function _findNewPos(ns) {
                            ns.forEach(function(nd) {
                              if (nd.name === oc.newDept && nd.positions) {
                                nd.positions.forEach(function(np) {
                                  if (np.name === oc.newPosition) {
                                    // 记录历任
                                    if (!np._history) np._history = [];
                                    if (np.holder) np._history.push({ holder: np.holder, to: GM.turn });
                                    if (typeof _offSeatPersonInPosition === 'function') {
                                      _offSeatPersonInPosition(np, _transferPerson, { replace: true });
                                    } else if (typeof _offAppointPerson === 'function') {
                                      if (np.holder && np.holder !== _transferPerson && typeof _offDismissPerson === 'function') _offDismissPerson(np, np.holder);
                                      _offAppointPerson(np, _transferPerson);
                                    } else {
                                      np.holder = _transferPerson;
                                    }
                                  }
                                });
                              }
                              if (nd.subs) _findNewPos(nd.subs);
                            });
                          })(GM.officeTree);
                        }
                      } else if (oc.action === 'demote' && pos.holder) {
                        if (oc.newRank) pos.rank = oc.newRank;
                        addEB('降级', pos.holder + '降为' + (oc.newRank||'') + (oc.reason ? '（' + oc.reason + '）' : ''));
                        var _dch2 = findCharByName(pos.holder);
                        if (_dch2) {
                          _tmApplyLoyaltyDelta(_dch2, -8, '\u964D\u7EA7\u5B98\u9636', 'office-change-demote');
                          _dch2.stress = Math.min(100, (_dch2.stress||0) + 10);
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(pos.holder, 'demotion', '降为' + (oc.newRank||''));
                        }
                      } else if (oc.action === 'transfer' && pos.holder && oc.newDept && oc.newPosition) {
                        var _tPerson = pos.holder;
                        // 记录历任
                        if (!pos._history) pos._history = [];
                        pos._history.push({ holder: _tPerson, to: GM.turn });
                        if (typeof _offDismissPerson === 'function') _offDismissPerson(pos, _tPerson);
                        else pos.holder = '';
                        addEB('调任', _tPerson + '调任' + oc.newDept + oc.newPosition);
                        // 任命到新位
                        (function _findTP(ns2) {
                          ns2.forEach(function(nd2) {
                            if (nd2.name === oc.newDept && nd2.positions) {
                              nd2.positions.forEach(function(np2) {
                                if (np2.name === oc.newPosition) {
                                  if (!np2._history) np2._history = [];
                                  if (np2.holder) np2._history.push({ holder: np2.holder, to: GM.turn });
                                  if (typeof _offSeatPersonInPosition === 'function') {
                                    _offSeatPersonInPosition(np2, _tPerson, { replace: true });
                                  } else if (typeof _offAppointPerson === 'function') {
                                    if (np2.holder && np2.holder !== _tPerson && typeof _offDismissPerson === 'function') _offDismissPerson(np2, np2.holder);
                                    _offAppointPerson(np2, _tPerson);
                                  } else {
                                    np2.holder = _tPerson;
                                  }
                                }
                              });
                            }
                            if (nd2.subs) _findTP(nd2.subs);
                          });
                        })(GM.officeTree);
                        var _tch = findCharByName(_tPerson);
                        if (_tch) {
                          _tch.officialTitle = oc.newPosition;
                          _tch.title = oc.newDept + oc.newPosition;
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(_tPerson, 'transfer', '调任' + oc.newDept + oc.newPosition);
                        }
                      } else if (oc.action === 'evaluate' && pos.holder && oc.evaluator) {
                        // NPC考评——由负责考察的官员执行（带偏见）
                        if (!pos._evaluations) pos._evaluations = [];
                        pos._evaluations.push({
                          turn: GM.turn, evaluator: oc.evaluator,
                          grade: oc.grade || '平庸', comment: oc.comment || '',
                          holder: pos.holder
                        });
                        if (pos._evaluations.length > 10) pos._evaluations.shift();
                        addEB('考评', oc.evaluator + '考评' + pos.holder + '：' + (oc.grade||'') + (oc.comment ? '（' + oc.comment + '）' : ''));
                        // 考评者记忆
                        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                          NpcMemorySystem.remember(oc.evaluator, '考评' + pos.holder + '为' + oc.dept + oc.position + '：' + (oc.grade||''), '平', 4);
                          NpcMemorySystem.remember(pos.holder, '被' + oc.evaluator + '考评为' + (oc.grade||''), oc.grade === '失职' ? '怨' : '平', 5);
                        }
                        // 举主连坐——失职考评追溯举主
                        if (oc.grade === '失职') {
                          var _evalCh = findCharByName(pos.holder);
                          if (_evalCh && _evalCh._recommendedBy) {
                            addEB('举主连坐', pos.holder + '考评失职，举主' + _evalCh._recommendedBy + '受牵连（举人不当）');
                            if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                              NpcMemorySystem.remember(_evalCh._recommendedBy, '所举荐的' + pos.holder + '被评为失职，本人受"举人不当"之责', '忧', 6);
                            }
                            var _jzCh = findCharByName(_evalCh._recommendedBy);
                            if (_jzCh) {
                              _tmApplyLoyaltyDelta(_jzCh, -5, '\u4E3E\u4E3B\u8FDE\u5750', 'office-evaluation-sponsor');
                              _jzCh.stress = Math.min(100, (_jzCh.stress||0) + 8);
                            }
                          }
                        }
                      } else if (oc.action === 'dismiss') {
                        var dismissed = pos.holder;
                        // 新模型：把该任职者从 actualHolders 移除，留占位
                        if (dismissed && typeof _offDismissPerson === 'function') _offDismissPerson(pos, dismissed);
                        else pos.holder = '';
                        if (dismissed) {
                          addEB('\u7F62\u514D', dismissed + '\u88AB\u514D\u53BB' + oc.dept + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
                          var dch = findCharByName(dismissed);
                          if (dch) {
                            // 致仕（退休）vs 罢免——情绪影响不同
                          var _isRetire = (oc.reason||'').indexOf('\u81F4\u4ED5') >= 0 || (oc.reason||'').indexOf('\u9000\u4F11') >= 0 || (oc.reason||'').indexOf('\u4E5E\u9AB8\u9AA8') >= 0 || (oc.reason||'').indexOf('\u8D50\u91D1\u8FD8\u4E61') >= 0;
                          if (_isRetire) {
                            _tmApplyLoyaltyDelta(dch, 5, '\u6069\u51C6\u81F4\u4ED5', 'office-dismiss-retire'); // 恩准致仕→感恩
                            dch.stress = Math.max(0, (dch.stress||0) - 20); // 卸任减压
                            dch._retired = true;
                            dch._retireTurn = GM.turn;
                            addEB('\u81F4\u4ED5', dismissed + '\u6069\u51C6\u81F4\u4ED5\u5F52\u7530' + (oc.reason ? '（' + oc.reason + '）' : ''));
                          } else {
                            _tmApplyLoyaltyDelta(dch, -10, '\u88AB\u514D\u53BB\u5B98\u804C', 'office-dismiss-remove');
                            dch.stress = Math.min(100, (dch.stress||0) + 15);
                          }
                          if (dch.officialTitle === oc.position) dch.officialTitle = '';
                          dch.title = _isRetire ? '致仕' : '';
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(dismissed, _isRetire ? 'retirement' : 'dismissal', (_isRetire ? '\u6069\u51C6\u81F4\u4ED5' : '\u88AB\u514D\u53BB') + oc.dept + oc.position + (oc.reason ? '：' + oc.reason : ''));
                          }
                          // 同步PostSystem
                          if (typeof PostTransfer !== 'undefined') PostTransfer.cascadeVacate(dismissed);
                          // 同步行政区划：清除被免职者的governor
                          if (P.adminHierarchy) {
                            (function _clearAdmGov(ah) {
                              var _aks2 = Object.keys(ah);
                              _aks2.forEach(function(k) {
                                if (!ah[k] || !ah[k].divisions) return;
                                (function _walk2(divs) {
                                  divs.forEach(function(dv) {
                                    if (dv.governor === dismissed) {
                                      dv.governor = '';
                                      if (GM.provinceStats && GM.provinceStats[dv.name]) GM.provinceStats[dv.name].governor = '';
                                    }
                                    if (dv.children) _walk2(dv.children);
                                  });
                                })(ah[k].divisions);
                              });
                            })(P.adminHierarchy);
                          }
                        }
                      }
                    }
                  });
                }
                if (node.subs) walkTree(node.subs);
              });
            })(GM.officeTree);
            // reform动作——在walkTree之外处理（修改树结构）
            if (oc.action === 'reform' && oc.reformDetail) {
              var _rd = oc.reformDetail;
              if (oc.position && (_rd.indexOf('增设') >= 0 || _rd.indexOf('新设') >= 0)) {
                // 增设官职（在指定部门下）——同时填充老字段与新字段
                (function _addPos(ns) {
                  ns.forEach(function(n) {
                    if (n.name === oc.dept) {
                      if (!n.positions) n.positions = [];
                      var _newPos = {
                        name: oc.position, rank: oc.newRank||'', holder: '', desc: oc.reason||'',
                        headCount: 1, actualCount: 0, additionalHolders: [],
                        establishedCount: 1, vacancyCount: 1, actualHolders: []
                      };
                      n.positions.push(_newPos);
                    }
                    if (n.subs) _addPos(n.subs);
                  });
                })(GM.officeTree);
                addEB('官制改革', oc.dept + '增设' + oc.position + (oc.reason ? '（' + oc.reason + '）' : ''));
              } else if (!oc.position && (_rd.indexOf('增设') >= 0 || _rd.indexOf('新设') >= 0)) {
                // 增设部门
                if (oc.newDept) {
                  // 增设为某部门的下属
                  (function _addSub(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.dept) {
                        if (!n.subs) n.subs = [];
                        n.subs.push({ name: oc.newDept, desc: oc.reason||'', positions: [], subs: [], functions: [] });
                      }
                      if (n.subs) _addSub(n.subs);
                    });
                  })(GM.officeTree);
                  addEB('官制改革', oc.dept + '下增设' + oc.newDept);
                } else {
                  // 增设顶层部门
                  var _newName = oc.dept || '新设部门';
                  GM.officeTree.push({ name: _newName, desc: oc.reason||'', positions: [], subs: [], functions: [] });
                  addEB('官制改革', '增设' + _newName + (oc.reason ? '（' + oc.reason + '）' : ''));
                }
              } else if (_rd.indexOf('裁撤') >= 0 || _rd.indexOf('废除') >= 0) {
                if (oc.position) {
                  // 裁撤官职
                  (function _delPos(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.dept && n.positions) {
                        var _dismissed = n.positions.filter(function(p){ return p.name === oc.position && p.holder; });
                        _dismissed.forEach(function(p) {
                          var dch = findCharByName(p.holder);
                          if (dch) { dch.officialTitle = ''; dch.title = ''; }
                        });
                        n.positions = n.positions.filter(function(p) { return p.name !== oc.position; });
                      }
                      if (n.subs) _delPos(n.subs);
                    });
                  })(GM.officeTree);
                  addEB('官制改革', '裁撤' + oc.dept + oc.position);
                } else {
                  // 裁撤部门
                  GM.officeTree = GM.officeTree.filter(function(d) { return d.name !== oc.dept; });
                  (function _delSub(ns) { ns.forEach(function(n) { if (n.subs) { n.subs = n.subs.filter(function(s) { return s.name !== oc.dept; }); _delSub(n.subs); } }); })(GM.officeTree);
                  addEB('官制改革', '裁撤' + oc.dept + (oc.reason ? '（' + oc.reason + '）' : ''));
                }
              } else if (_rd.indexOf('改名') >= 0 || _rd.indexOf('更名') >= 0) {
                (function _rename(ns) { ns.forEach(function(n) { if (n.name === oc.dept && oc.newDept) n.name = oc.newDept; if (n.subs) _rename(n.subs); }); })(GM.officeTree);
                addEB('官制改革', oc.dept + '更名为' + (oc.newDept||''));
              } else if (_rd.indexOf('合并') >= 0) {
                // 合并：将oc.dept合并入oc.newDept（职位转移）
                var _srcDept = null;
                (function _findSrc(ns) { ns.forEach(function(n) { if (n.name === oc.dept) _srcDept = n; if (n.subs) _findSrc(n.subs); }); })(GM.officeTree);
                if (_srcDept) {
                  (function _findDst(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.newDept) {
                        if (!n.positions) n.positions = [];
                        (_srcDept.positions||[]).forEach(function(p) { n.positions.push(p); });
                        if (!n.subs) n.subs = [];
                        (_srcDept.subs||[]).forEach(function(s) { n.subs.push(s); });
                      }
                      if (n.subs) _findDst(n.subs);
                    });
                  })(GM.officeTree);
                  // 删除源部门
                  GM.officeTree = GM.officeTree.filter(function(d) { return d.name !== oc.dept; });
                  (function _delMerged(ns) { ns.forEach(function(n) { if (n.subs) { n.subs = n.subs.filter(function(s) { return s.name !== oc.dept; }); _delMerged(n.subs); } }); })(GM.officeTree);
                  addEB('官制改革', oc.dept + '并入' + oc.newDept);
                }
              } else if (_rd.indexOf('拆分') >= 0 && Array.isArray(oc.splitInto) && oc.splitInto.length > 0) {
                // 拆分：将 oc.dept 按 splitInto 分成多个新部门；原部门的 positions 按 splitInto 指定的 positions 分配
                var _splitSrc = null, _splitParent = null;
                (function _findSp(ns, parent) {
                  ns.forEach(function(n) {
                    if (n.name === oc.dept) { _splitSrc = n; _splitParent = parent; }
                    if (n.subs) _findSp(n.subs, n);
                  });
                })(GM.officeTree, null);
                if (_splitSrc) {
                  var _splitSiblings = _splitParent ? _splitParent.subs : GM.officeTree;
                  var _srcIdx = _splitSiblings.indexOf(_splitSrc);
                  var _newDepts = oc.splitInto.map(function(info) {
                    var posList = Array.isArray(info.positions) ? info.positions : [];
                    // 从源部门摘取匹配 positions（按 name）
                    var takenPos = [];
                    posList.forEach(function(pn) {
                      var pname = typeof pn === 'string' ? pn : (pn && pn.name);
                      if (!pname) return;
                      var idx = (_splitSrc.positions||[]).findIndex(function(p){return p.name===pname;});
                      if (idx >= 0) { takenPos.push(_splitSrc.positions[idx]); _splitSrc.positions.splice(idx,1); }
                    });
                    return { name: info.name || '新部门', desc: info.desc || '', positions: takenPos, subs: [], functions: info.functions || [] };
                  });
                  // 未分配的 positions 追加到第一个新部门
                  if (_splitSrc.positions && _splitSrc.positions.length > 0 && _newDepts.length > 0) {
                    _newDepts[0].positions = _newDepts[0].positions.concat(_splitSrc.positions);
                  }
                  // 替换：移除原部门，插入新部门
                  _splitSiblings.splice.apply(_splitSiblings, [_srcIdx, 1].concat(_newDepts));
                  addEB('官制改革', oc.dept + '拆分为' + _newDepts.map(function(d){return d.name;}).join('、'));
                }
              } else if (_rd.indexOf('改制') >= 0 && Array.isArray(oc.restructurePlan) && oc.restructurePlan.length > 0) {
                // 改制：执行一揽子原子动作，每项是一个 reform 子命令 {action, dept, position, newDept, ...}
                var _restructureCount = 0;
                oc.restructurePlan.forEach(function(atom) {
                  if (!atom || !atom.action) return;
                  var subOC = {
                    dept: atom.dept, position: atom.position,
                    newDept: atom.newDept, newPosition: atom.newPosition,
                    newRank: atom.newRank,
                    reason: atom.reason || oc.reason || '改制',
                    action: 'reform',
                    reformDetail: atom.action,
                    splitInto: atom.splitInto,
                    intoDept: atom.intoDept
                  };
                  // 复用本分支处理逻辑——简化起见用 addEB 日志（实际结构变更依赖下一 oc 迭代）
                  // 直接调用自身分支不方便，这里做常见原子动作的内联处理
                  if (atom.action === '增设' && subOC.position && subOC.dept) {
                    (function _ap(ns) { ns.forEach(function(n) {
                      if (n.name === subOC.dept) {
                        if (!n.positions) n.positions = [];
                        n.positions.push({
                          name: subOC.position, rank: subOC.newRank||'', holder: '', desc: subOC.reason||'',
                          headCount: 1, actualCount: 0, additionalHolders: [],
                          establishedCount: 1, vacancyCount: 1, actualHolders: []
                        });
                      }
                      if (n.subs) _ap(n.subs);
                    }); })(GM.officeTree);
                    _restructureCount++;
                  } else if (atom.action === '裁撤' && subOC.position && subOC.dept) {
                    (function _dp(ns) { ns.forEach(function(n) { if (n.name === subOC.dept && n.positions) n.positions = n.positions.filter(function(p) { return p.name !== subOC.position; }); if (n.subs) _dp(n.subs); }); })(GM.officeTree);
                    _restructureCount++;
                  } else if (atom.action === '改名' && subOC.dept && subOC.newDept) {
                    (function _rn(ns) { ns.forEach(function(n) { if (n.name === subOC.dept) n.name = subOC.newDept; if (n.subs) _rn(n.subs); }); })(GM.officeTree);
                    _restructureCount++;
                  }
                });
                addEB('官制改革', '【改制】' + (oc.reason||'') + '——执行' + _restructureCount + '项原子变更');
              }
              _dbg('[office_reform] ' + _rd + ' ' + (oc.dept||''));
            }
            // 任命/免职时记录历任
            if ((oc.action === 'appoint' || oc.action === 'dismiss') && oc.dept && oc.position) {
              (function _recHistory(ns) {
                ns.forEach(function(n) {
                  if (n.name === oc.dept && n.positions) {
                    n.positions.forEach(function(p) {
                      if (p.name === oc.position) {
                        if (!p._history) p._history = [];
                        if (oc.action === 'dismiss' && oc.person) {
                          p._history.push({ holder: oc.person, to: GM.turn, reason: oc.reason||'' });
                        } else if (oc.action === 'appoint' && oc.person) {
                          p._history.push({ holder: oc.person, from: GM.turn });
                        }
                        if (p._history.length > 20) p._history = p._history.slice(-20);
                      }
                    });
                  }
                  if (n.subs) _recHistory(n.subs);
                });
              })(GM.officeTree);
            }
          });
        }

        // 处理部门聚合事件（双层模型）
        if (p1.office_aggregate && Array.isArray(p1.office_aggregate) && GM.officeTree) {
          p1.office_aggregate.forEach(function(oa) {
            if (!oa.dept) return;
            // 找到对应部门
            var _targetDept = null;
            (function _fd(ns) { ns.forEach(function(n) { if (n.name === oa.dept) _targetDept = n; if (n.subs) _fd(n.subs); }); })(GM.officeTree);
            if (!_targetDept) return;
            // actualCount变动（递补/离职）
            if (oa.actualCount_delta) {
              var delta = parseInt(oa.actualCount_delta) || 0;
              // 分摊到各职位的actualCount
              (_targetDept.positions||[]).forEach(function(p) {
                if (typeof _offMigratePosition === 'function') _offMigratePosition(p);
                if (delta > 0 && (p.actualCount||0) < (p.headCount||1)) {
                  var canAdd = Math.min(delta, (p.headCount||1) - (p.actualCount||0));
                  p.actualCount = (p.actualCount||0) + canAdd;
                  // 新模型同步：递补增加占位，减少 vacancyCount
                  if (!Array.isArray(p.actualHolders)) p.actualHolders = [];
                  for (var _ai = 0; _ai < canAdd; _ai++) {
                    p.actualHolders.push({ name:'', generated:false, placeholderId:'ph_'+Math.random().toString(36).slice(2,8), filledTurn: GM.turn });
                  }
                  p.vacancyCount = Math.max(0, (p.establishedCount||p.headCount||1) - p.actualCount);
                  delta -= canAdd;
                } else if (delta < 0 && (p.actualCount||0) > _offMaterializedCount(p)) {
                  var canRemove = Math.min(-delta, (p.actualCount||0) - _offMaterializedCount(p));
                  p.actualCount = (p.actualCount||0) - canRemove;
                  // 新模型同步：移除占位（仅 generated:false 的），增加 vacancyCount
                  if (Array.isArray(p.actualHolders)) {
                    for (var _ri = 0; _ri < canRemove; _ri++) {
                      var _phIdx = p.actualHolders.findIndex(function(h){return h && h.generated===false;});
                      if (_phIdx >= 0) p.actualHolders.splice(_phIdx, 1);
                    }
                  }
                  p.vacancyCount = Math.max(0, (p.establishedCount||p.headCount||1) - p.actualCount);
                  delta += canRemove;
                }
              });
              if (delta > 0) addEB('官制', oa.dept + '递补' + delta + '人');
              else if (delta < 0) addEB('官制', oa.dept + '减员' + Math.abs(delta) + '人');
            }
            // 考评摘要（存入部门级别）
            if (oa.evaluation_summary) {
              if (!_targetDept._evalHistory) _targetDept._evalHistory = [];
              _targetDept._evalHistory.push({ turn: GM.turn, summary: oa.evaluation_summary });
              if (_targetDept._evalHistory.length > 5) _targetDept._evalHistory.shift();
              // 具象角色的考评同步到position._evaluations
              var _namedAll = [].concat(oa.evaluation_summary.named_excellent||[], oa.evaluation_summary.named_good||[], oa.evaluation_summary.named_average||[], oa.evaluation_summary.named_poor||[]);
              _namedAll.forEach(function(name) {
                var _grade = (oa.evaluation_summary.named_excellent||[]).indexOf(name) >= 0 ? '卓越' :
                             (oa.evaluation_summary.named_good||[]).indexOf(name) >= 0 ? '称职' :
                             (oa.evaluation_summary.named_poor||[]).indexOf(name) >= 0 ? '失职' : '平庸';
                (_targetDept.positions||[]).forEach(function(p) {
                  if (p.holder === name || (p.additionalHolders||[]).indexOf(name) >= 0) {
                    if (!p._evaluations) p._evaluations = [];
                    p._evaluations.push({ turn: GM.turn, evaluator: '有司', grade: _grade, comment: '', holder: name });
                  }
                });
              });
              if (oa.narrative) addEB('考评', oa.narrative);
            }
            // 贪腐查处
            if (oa.corruption_found) {
              addEB('吏治', oa.dept + '查出' + oa.corruption_found + '人贪腐' + ((oa.named_corrupt||[]).length > 0 ? '（' + oa.named_corrupt.join('、') + '等）' : ''));
            }
          });
        }

        // 处理封臣关系变动（AI新通道）
        if (p1.vassal_changes && Array.isArray(p1.vassal_changes)) {
          p1.vassal_changes.forEach(function(vc) {
            if (!vc.action) return;
            if (vc.action === 'establish' && vc.vassal && vc.liege) {
              if (typeof establishVassalage === 'function') {
                var ok = establishVassalage(vc.vassal, vc.liege);
                if (ok) {
                  if (vc.tributeRate !== undefined) {
                    var _vFac = GM._indices.facByName ? GM._indices.facByName.get(vc.vassal) : null;
                    if (_vFac) _vFac.tributeRate = clamp(parseFloat(vc.tributeRate) || 0.3, 0.05, 0.8);
                  }
                  addEB('\u5C01\u81E3', vc.vassal + '\u6210\u4E3A' + vc.liege + '\u7684\u5C01\u81E3' + (vc.reason ? '(' + vc.reason + ')' : ''));
                }
              }
            } else if (vc.action === 'break' && vc.vassal) {
              if (typeof breakVassalage === 'function') {
                var ok2 = breakVassalage(vc.vassal);
                if (ok2) addEB('\u5C01\u81E3', vc.vassal + '\u8131\u79BB\u5C01\u81E3\u5173\u7CFB' + (vc.reason ? '(' + vc.reason + ')' : ''));
              }
            } else if (vc.action === 'change_tribute' && vc.vassal && vc.tributeRate !== undefined) {
              var _vf = GM._indices.facByName ? GM._indices.facByName.get(vc.vassal) : null;
              if (_vf && _vf.liege) {
                var oldRate = _vf.tributeRate || 0.3;
                _vf.tributeRate = clamp(parseFloat(vc.tributeRate) || 0.3, 0.05, 0.8);
                addEB('\u5C01\u81E3', vc.vassal + '\u8D21\u8D4B\u6BD4\u4F8B\u8C03\u6574\uFF1A' + Math.round(oldRate*100) + '%\u2192' + Math.round(_vf.tributeRate*100) + '%' + (vc.reason ? '(' + vc.reason + ')' : ''));
              }
            }
          });
        }

        // 处理头衔爵位变动（AI新通道）
        if (p1.title_changes && Array.isArray(p1.title_changes)) {
          p1.title_changes.forEach(function(tc) {
            if (!tc.action || !tc.character) return;
            var _tch = findCharByName(tc.character);
            if (!_tch) return;
            if (!_tch.titles) _tch.titles = [];

            if (tc.action === 'grant') {
              // 册封头衔
              var _tName = tc.titleName || '';
              var _tLevel = parseInt(tc.titleLevel) || 5;
              var _existing = _tch.titles.find(function(t) { return t.name === _tName; });
              if (!_existing && _tName) {
                _tch.titles.push({
                  name: _tName, level: _tLevel,
                  hereditary: tc.hereditary || false,
                  grantedTurn: GM.turn, grantedBy: tc.grantedBy || '\u671D\u5EF7',
                  privileges: tc.privileges || [], _suppressed: []
                });
                addEB('\u518C\u5C01', tc.character + '\u88AB\u518C\u5C01\u4E3A' + _tName + (tc.reason ? '(' + tc.reason + ')' : ''));
                if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_grant', '\u518C\u5C01' + _tName);
                _tmApplyLoyaltyDelta(_tch, 5, '\u518C\u5C01\u7235\u4F4D', 'title-grant');
              }
            } else if (tc.action === 'revoke') {
              // 剥夺头衔
              var _tIdx = _tch.titles.findIndex(function(t) { return t.name === (tc.titleName || ''); });
              if (_tIdx !== -1) {
                var _removed = _tch.titles.splice(_tIdx, 1)[0];
                addEB('\u964D\u7235', tc.character + '\u7684' + _removed.name + '\u5934\u8854\u88AB\u5265\u593A' + (tc.reason ? '(' + tc.reason + ')' : ''));
                if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_revoke', '\u88AB\u593A' + _removed.name);
                _tmApplyLoyaltyDelta(_tch, -15, '\u593A\u53BB\u7235\u4F4D', 'title-revoke');
                _tch.stress = Math.min(100, (_tch.stress || 0) + 10);
              }
            } else if (tc.action === 'promote') {
              // 晋升头衔（移除旧最高，授予新的更高头衔）
              var _tName2 = tc.titleName || '';
              var _tLevel2 = parseInt(tc.titleLevel) || 3;
              // 移除同类型的旧头衔（等级更低的）
              _tch.titles = _tch.titles.filter(function(t) { return t.level <= _tLevel2; });
              _tch.titles.push({
                name: _tName2, level: _tLevel2,
                hereditary: tc.hereditary || false,
                grantedTurn: GM.turn, grantedBy: '\u671D\u5EF7',
                privileges: tc.privileges || [], _suppressed: []
              });
              addEB('\u664B\u7235', tc.character + '\u664B\u5347\u4E3A' + _tName2 + (tc.reason ? '(' + tc.reason + ')' : ''));
              if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_promote', '\u664B\u5347' + _tName2);
              _tmApplyLoyaltyDelta(_tch, 3, '\u664B\u5347\u7235\u4F4D', 'title-promote');
            } else if (tc.action === 'inherit' && tc.from) {
              // 继承头衔
              var _deceased = findCharByName(tc.from);
              if (_deceased && _deceased.titles) {
                var _iTitle = _deceased.titles.find(function(t) { return t.name === (tc.titleName || ''); });
                if (_iTitle && (_iTitle.hereditary || (GM.eraState && (GM.eraState.centralControl || 0.5) < 0.5))) {
                  _tch.titles.push({
                    name: _iTitle.name, level: _iTitle.level,
                    hereditary: _iTitle.hereditary,
                    grantedTurn: GM.turn, grantedBy: tc.from + '(\u7EE7\u627F)',
                    privileges: _iTitle.privileges || [], _suppressed: _iTitle._suppressed || []
                  });
                  addEB('\u7EE7\u627F', tc.character + '\u7EE7\u627F\u4E86' + tc.from + '\u7684' + _iTitle.name + '\u5934\u8854');
                }
              }
            }
          });
        }

        // 处理建筑变动（AI新通道）
        if (p1.building_changes && Array.isArray(p1.building_changes)) {
          // 确保GM建筑数据结构存在
          if (!GM.buildings) GM.buildings = [];
          if (!GM._indices) GM._indices = {};
          if (!GM._indices.buildingById) GM._indices.buildingById = new Map();
          if (!GM._indices.buildingByTerritory) GM._indices.buildingByTerritory = new Map();

          p1.building_changes.forEach(function(bc) {
            if (!bc.action || !bc.territory) return;

            // 同步写入 adminHierarchy 的 division.buildings（新模式——去结构化，由AI自判效果）
            if (bc.action === 'build' || bc.action === 'custom_build' || bc.action === 'upgrade' || bc.action === 'destroy') {
              if (P.adminHierarchy) {
                var _targetDiv = null;
                Object.keys(P.adminHierarchy).forEach(function(fk) {
                  var fh = P.adminHierarchy[fk]; if (!fh || !fh.divisions) return;
                  (function _walk(ds) {
                    ds.forEach(function(d) {
                      if (d.name === bc.territory) _targetDiv = d;
                      if (d.children) _walk(d.children);
                      if (d.divisions) _walk(d.divisions);
                    });
                  })(fh.divisions);
                });
                if (_targetDiv) {
                  if (!_targetDiv.buildings) _targetDiv.buildings = [];
                  if (bc.action === 'destroy') {
                    _targetDiv.buildings = _targetDiv.buildings.filter(function(b) { return b.name !== bc.type; });
                    addEB('\u5EFA\u8BBE', bc.territory + '拆除 ' + bc.type);
                  } else if (bc.action === 'upgrade') {
                    var _exB = _targetDiv.buildings.find(function(b) { return b.name === bc.type; });
                    if (_exB) {
                      _exB.level = (_exB.level || 1) + 1;
                      addEB('\u5EFA\u8BBE', bc.territory + '的' + bc.type + '升级至' + _exB.level + '级');
                    }
                  } else {
                    // build 或 custom_build
                    var _isCustom = bc.action === 'custom_build' || bc.isCustom;
                    var _feasibility = bc.feasibility || '合理';
                    if (_feasibility === '不合理') {
                      addEB('\u5EFA\u8BBE', bc.territory + '拟建 ' + bc.type + ' 因不合理未能实施');
                    } else {
                      _targetDiv.buildings.push({
                        name: bc.type,
                        level: bc.level || 1,
                        isCustom: _isCustom,
                        description: bc.description || '',
                        judgedEffects: bc.judgedEffects || '',
                        costActual: bc.costActual || null,
                        timeActual: bc.timeActual || null,
                        status: (bc.timeActual && bc.timeActual > 0) ? 'building' : 'completed',
                        remainingTurns: bc.timeActual || 0,
                        startTurn: GM.turn
                      });
                      addEB('\u5EFA\u8BBE', bc.territory + (_isCustom?'自定义建造 ':'建造 ') + bc.type + (_feasibility!=='合理'?('('+_feasibility+')'):'') + (bc.reason?' —— '+bc.reason:''));
                    }
                  }
                }
              }
            }

            // 以下为旧版本的 BUILDING_TYPES/GM.buildings 逻辑（保留兼容）
            // 支持中文建筑名匹配到type key
            var _bcType = (bc.type || '').replace(/\s/g, '_').toLowerCase();
            if (!_bcType) return;
            // 如果type是中文名，尝试从BUILDING_TYPES反查key
            if (typeof BUILDING_TYPES !== 'undefined') {
              var _btKeys = Object.keys(BUILDING_TYPES);
              for (var _bk = 0; _bk < _btKeys.length; _bk++) {
                if (BUILDING_TYPES[_btKeys[_bk]].name === bc.type) { _bcType = _btKeys[_bk]; break; }
              }
            }

            if (bc.action === 'build' && _bcType) {
              if (typeof createBuilding === 'function') {
                // 推断势力归属
                var _bFaction = bc.faction || '';
                if (!_bFaction && GM.facs) {
                  var _ownerFac = GM.facs.find(function(f) { return f.territories && f.territories.indexOf(bc.territory) !== -1; });
                  if (_ownerFac) _bFaction = _ownerFac.name;
                }
                var _newB = createBuilding(_bcType, bc.level || 1, _bFaction, bc.territory);
                GM.buildings.push(_newB);
                GM._indices.buildingById.set(_newB.id, _newB);
                if (!GM._indices.buildingByTerritory.has(bc.territory)) GM._indices.buildingByTerritory.set(bc.territory, []);
                GM._indices.buildingByTerritory.get(bc.territory).push(_newB);
                addEB('\u5EFA\u8BBE', bc.territory + '\u5EFA\u9020\u4E86' + _newB.name + (bc.reason ? '(' + bc.reason + ')' : ''));
              }
            } else if (bc.action === 'upgrade' && _bcType) {
              // 升级建筑
              var _bList = GM._indices.buildingByTerritory ? GM._indices.buildingByTerritory.get(bc.territory) : null;
              if (_bList) {
                var _bMatch = _bList.find(function(b) { return b.type === _bcType; });
                if (_bMatch) {
                  var _btInfo = typeof BUILDING_TYPES !== 'undefined' ? BUILDING_TYPES[_bcType] : null;
                  var _maxLv = (_btInfo && _btInfo.maxLevel) || 5;
                  if (_bMatch.level < _maxLv) {
                    _bMatch.level++;
                    if (typeof getBuildingEffects === 'function') _bMatch.effects = getBuildingEffects(_bcType, _bMatch.level);
                    addEB('\u5EFA\u8BBE', bc.territory + '\u7684' + _bMatch.name + '\u5347\u7EA7\u81F3' + _bMatch.level + '\u7EA7' + (bc.reason ? '(' + bc.reason + ')' : ''));
                  }
                }
              }
            } else if (bc.action === 'destroy' && _bcType) {
              // 拆除建筑
              var _bList2 = GM._indices.buildingByTerritory ? GM._indices.buildingByTerritory.get(bc.territory) : null;
              if (_bList2) {
                var _bIdx = _bList2.findIndex(function(b) { return b.type === _bcType; });
                if (_bIdx !== -1) {
                  var _removed = _bList2.splice(_bIdx, 1)[0];
                  if (GM.buildings) GM.buildings = GM.buildings.filter(function(b) { return b.id !== _removed.id; });
                  if (GM._indices.buildingById) GM._indices.buildingById.delete(_removed.id);
                  addEB('\u5EFA\u8BBE', bc.territory + '\u7684' + _removed.name + '\u88AB\u62C6\u9664' + (bc.reason ? '(' + bc.reason + ')' : ''));
                }
              }
            }
          });
        }

        // 处理行政区划变动（AI新通道）
        if (p1.admin_changes && Array.isArray(p1.admin_changes) && P.adminHierarchy) {
          p1.admin_changes.forEach(function(ac) {
            if (!ac.action || !ac.division) return;

            // 在行政区划树中查找目标节点
            var _targetDiv = null;
            function _findDiv(divs) {
              for (var i = 0; i < divs.length; i++) {
                if (divs[i].name === ac.division) { _targetDiv = divs[i]; return; }
                if (divs[i].children) _findDiv(divs[i].children);
              }
            }
            var _adminKeys = Object.keys(P.adminHierarchy);
            for (var _ak = 0; _ak < _adminKeys.length; _ak++) {
              var _ah = P.adminHierarchy[_adminKeys[_ak]];
              if (_ah && _ah.divisions) _findDiv(_ah.divisions);
              if (_targetDiv) break;
            }

            if (!_targetDiv) return;

            if (ac.action === 'appoint_governor' && ac.person) {
              var oldGov = _targetDiv.governor || '';
              _targetDiv.governor = ac.person;
              addEB('\u4EFB\u547D', ac.person + '\u88AB\u4EFB\u547D\u4E3A' + ac.division + '\u4E3B\u5B98' + (ac.reason ? '(' + ac.reason + ')' : ''));
              var _govCh = findCharByName(ac.person);
              if (_govCh) _tmApplyLoyaltyDelta(_govCh, 3, '\u4EFB\u5730\u65B9\u4E3B\u5B98', 'admin-governor-appoint');
              // 同步到officeTree：如果该行政单位有officialPosition，同步到对应position.holder
              if (_targetDiv.officialPosition && GM.officeTree) {
                (function _syncOffPos(nodes) {
                  nodes.forEach(function(nd) {
                    if (nd.positions) {
                      nd.positions.forEach(function(p) {
                        if (p.name === _targetDiv.officialPosition && (!p.holder || p.holder === oldGov)) {
                          p.holder = ac.person;
                        }
                      });
                    }
                    if (nd.subs) _syncOffPos(nd.subs);
                  });
                })(GM.officeTree);
              }
            } else if (ac.action === 'remove_governor') {
              var _removedGov = _targetDiv.governor;
              _targetDiv.governor = '';
              if (_removedGov) {
                addEB('\u7F62\u514D', _removedGov + '\u88AB\u514D\u53BB' + ac.division + '\u4E3B\u5B98' + (ac.reason ? '(' + ac.reason + ')' : ''));
                var _rCh = findCharByName(_removedGov);
                if (_rCh) { _tmApplyLoyaltyDelta(_rCh, -8, '\u514D\u53BB\u5730\u65B9\u4E3B\u5B98', 'admin-governor-remove'); _rCh.stress = Math.min(100, (_rCh.stress || 0) + 10); }
                // 同步清除officeTree中的holder
                if (_targetDiv.officialPosition && GM.officeTree) {
                  (function _clrOffPos(nodes) {
                    nodes.forEach(function(nd) {
                      if (nd.positions) nd.positions.forEach(function(p) { if (p.name === _targetDiv.officialPosition && p.holder === _removedGov) p.holder = ''; });
                      if (nd.subs) _clrOffPos(nd.subs);
                    });
                  })(GM.officeTree);
                }
              }
            } else if (ac.action === 'adjust') {
              addEB('\u5730\u65B9', ac.division + ': ' + (ac.reason || '\u5730\u65B9\u5B98\u6CBB\u7406'));
            }

            // delta字段统一处理（所有action类型都可附带）
            if (ac.prosperity_delta) {
              _targetDiv.prosperity = clamp((_targetDiv.prosperity || 50) + clamp(parseInt(ac.prosperity_delta) || 0, -20, 20), 0, 100);
            }
            if (ac.population_delta) {
              _targetDiv.population = Math.max(0, (_targetDiv.population || 50000) + clamp(parseInt(ac.population_delta) || 0, -50000, 50000));
            }

            // 同步到地方区划
            if (GM.provinceStats && GM.provinceStats[ac.division]) {
              var _ps = GM.provinceStats[ac.division];
              if (_targetDiv.governor !== undefined) _ps.governor = _targetDiv.governor;
              if (_targetDiv.prosperity !== undefined) _ps.wealth = _targetDiv.prosperity;
              if (_targetDiv.population !== undefined) _ps.population = _targetDiv.population;
              if (ac.corruption_delta) _ps.corruption = clamp((_ps.corruption || 0) + clamp(parseInt(ac.corruption_delta) || 0, -20, 20), 0, 100);
              if (ac.stability_delta) _ps.stability = clamp((_ps.stability || 50) + clamp(parseInt(ac.stability_delta) || 0, -20, 20), 0, 100);
              if (ac.unrest_delta) _ps.unrest = clamp((_ps.unrest || 0) + clamp(parseInt(ac.unrest_delta) || 0, -20, 20), 0, 100);
            }
          });
        }

        // 处理中国化管辖层级变更（封建/削藩/改土归流等）
        if (p1.autonomy_changes && Array.isArray(p1.autonomy_changes) && P.adminHierarchy) {
          p1.autonomy_changes.forEach(function(ac) {
            if (!ac || !ac.action || !ac.division) return;
            // 查找区划
            var _targetAutDiv = null;
            Object.keys(P.adminHierarchy).forEach(function(fk) {
              var fh = P.adminHierarchy[fk];
              if (!fh || !fh.divisions) return;
              (function _w(ds) {
                ds.forEach(function(d) { if (d.name === ac.division) _targetAutDiv = d; if (d.divisions) _w(d.divisions); });
              })(fh.divisions);
            });
            if (!_targetAutDiv) return;
            // 按动作分支
            if (ac.action === 'enfeoff_prince' || ac.action === 'enfeoff_duke') {
              _targetAutDiv.autonomy = {
                type: 'fanguo',
                subtype: ac.subtype || (ac.action === 'enfeoff_prince' ? 'real' : 'nominal'),
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 80,
                tributeRate: ac.tributeRate || (ac.subtype === 'real' ? 0.5 : 0.15),
                grantedTurn: GM.turn
              };
              addEB('\u518C\u5C01', (ac.holder || '某人') + ' 受封为' + (ac.titleName || '王') + '，封地 ' + ac.division);
              // NPC 记忆：受封者感恩
              if (ac.holder && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(ac.holder, '受封' + (ac.titleName || '王') + '于' + ac.division + '，皇恩浩荡', '喜', 8);
              }
            } else if (ac.action === 'enfeoff_tusi') {
              _targetAutDiv.autonomy = {
                type: 'jimi', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '宣慰使',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 70,
                tributeRate: ac.tributeRate || 0.1
              };
              addEB('\u6388\u7F81\u7E3B', (ac.holder || '某部') + ' 授' + (ac.titleName || '宣慰使') + '，镇守 ' + ac.division);
            } else if (ac.action === 'invest_tributary') {
              _targetAutDiv.autonomy = {
                type: 'chaogong', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 60,
                tributeRate: ac.tributeRate || 0.05
              };
              addEB('\u518C\u5C01\u5C5E\u56FD', (ac.holder || '某国') + ' 受册为属国，朝贡 ' + ac.division);
            } else if (ac.action === 'establish_fanzhen') {
              _targetAutDiv.autonomy = {
                type: 'fanzhen', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '节度使',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 50,
                tributeRate: ac.tributeRate || 0.1
              };
              addEB('\u8BBE\u7F6E\u85E9\u9547', (ac.holder || '') + ' 任' + (ac.titleName || '节度使') + '，镇守 ' + ac.division);
            } else if (ac.action === 'grace_edict') {
              // 推恩令——分封子弟后逐代分薄
              if (_targetAutDiv.autonomy) {
                _targetAutDiv.autonomy.gracePartitions = (_targetAutDiv.autonomy.gracePartitions || 0) + 1;
                var _holder = _targetAutDiv.autonomy.holder;
                if (_targetAutDiv.autonomy.gracePartitions >= 5) {
                  // 五代后自动回收
                  _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
                  addEB('\u63A8\u6069\u4EE4', ac.division + ' 五代分封完毕，自然回归直辖');
                } else {
                  // 削弱藩王实力
                  _targetAutDiv.autonomy.loyalty = Math.min(100, (_targetAutDiv.autonomy.loyalty || 70) + 5);
                  _targetAutDiv.autonomy.tributeRate = Math.max(0.05, (_targetAutDiv.autonomy.tributeRate || 0.3) - 0.05);
                  addEB('\u63A8\u6069\u4EE4', ac.division + ' 行推恩（第' + _targetAutDiv.autonomy.gracePartitions + '代），藩权逐代分薄');
                }
                // NPC记忆：持爵者忧虑
                if (_holder && typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(_holder, '朝廷行推恩令于 ' + ac.division + '，宗业渐分于子孙，藩权日薄', '忧', 6);
                }
              }
            } else if (ac.action === 'abolish_fief') {
              // 削藩——直接回收，引发忠诚暴跌
              var _hld = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u524A\u85E9', '回收' + _hld + '之封地 ' + ac.division + '，改为直辖');
              // 如果该 holder 对应一个势力，忠诚度暴跌 + 初始化 rebellionRisk
              var _hldFac = (GM.facs || []).find(function(f) { return f.name === _hld; });
              if (_hldFac) {
                _hldFac.loyaltyToLiege = Math.max(0, (_hldFac.loyaltyToLiege !== undefined ? _hldFac.loyaltyToLiege : 60) - 40);
                _hldFac.rebellionRisk = Math.min(100, (_hldFac.rebellionRisk !== undefined ? _hldFac.rebellionRisk : 20) + 40);
              }
              // 持爵者 NPC 本人记仇
              var _hldChar = GM._indices && GM._indices.charByName ? GM._indices.charByName.get(_hld) : null;
              if (_hldChar && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_hld, '封地' + ac.division + '被朝廷削夺，宗业尽失', '恨', 10);
                if (_hldChar.loyalty !== undefined) _tmApplyLoyaltyDelta(_hldChar, -30, '\u5C01\u5730\u88AB\u524A\u593A', 'autonomy-abolish-fief');
                if (_hldChar.ambition !== undefined) _hldChar.ambition = Math.min(100, (_hldChar.ambition||50) + 20);
              }
            } else if (ac.action === 'tusi_to_liuguan') {
              // 改土归流
              var _oldTusi = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u6539\u571F\u5F52\u6D41', ac.division + ' 改土归流，设流官');
              if (_oldTusi && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_oldTusi, '祖传土司之位被改流官夺去，族人散失', '恨', 9);
              }
            } else if (ac.action === 'conquer_as_prefecture') {
              // 征讨设郡
              var _oldKing = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u5F81\u4F10\u8BBE\u90E1', '征讨' + ac.division + '，于其地置郡');
              if (_oldKing && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_oldKing, '国破家亡，宗社沦丧于 ' + ac.division, '恨', 10);
              }
            }
          });
        }

        // 处理行政区划树结构变更（P1/P2/P4）
        if (p1.admin_division_updates && Array.isArray(p1.admin_division_updates) && P.adminHierarchy) {
          // 确定玩家行政区划数据
          var _ahPlayerKey = P.adminHierarchy.player ? 'player' : null;
          if (!_ahPlayerKey) {
            var _ahks = Object.keys(P.adminHierarchy);
            for (var _ki = 0; _ki < _ahks.length; _ki++) {
              if (P.adminHierarchy[_ahks[_ki]] && P.adminHierarchy[_ahks[_ki]].divisions) { _ahPlayerKey = _ahks[_ki]; break; }
            }
          }
          var _ahPlayer = _ahPlayerKey ? P.adminHierarchy[_ahPlayerKey] : null;
          if (_ahPlayer) {
            // 辅助：在树中查找节点（返回 { node, parent, index }）
            function _findAdminNode(name, divs, parent) {
              for (var i = 0; i < divs.length; i++) {
                if (divs[i].name === name) return { node: divs[i], parent: parent, arr: divs, index: i };
                if (divs[i].children && divs[i].children.length > 0) {
                  var r = _findAdminNode(name, divs[i].children, divs[i]);
                  if (r) return r;
                }
              }
              return null;
            }

            p1.admin_division_updates.forEach(function(adu) {
              if (!adu.action) return;
              var act = adu.action;

              if (act === 'add') {
                // 新增行政区到指定上级下
                var newDiv = {
                  id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                  name: adu.division || '未命名',
                  level: adu.level || '',
                  officialPosition: adu.officialPosition || '',
                  governor: adu.governor || '',
                  description: adu.description || '',
                  population: parseInt(adu.population) || 50000,
                  prosperity: parseInt(adu.prosperity) || 50,
                  terrain: adu.terrain || '',
                  specialResources: adu.specialResources || '',
                  taxLevel: adu.taxLevel || '\u4E2D',
                  children: []
                };
                if (adu.parentDivision) {
                  var parentFound = _findAdminNode(adu.parentDivision, _ahPlayer.divisions, null);
                  if (parentFound) {
                    if (!parentFound.node.children) parentFound.node.children = [];
                    parentFound.node.children.push(newDiv);
                  } else {
                    _ahPlayer.divisions.push(newDiv); // 找不到上级则添加为顶级
                  }
                } else {
                  _ahPlayer.divisions.push(newDiv);
                }
                // 同步到provinceStats
                if (!GM.provinceStats) GM.provinceStats = {};
                var _playerFacName = (P.playerInfo && P.playerInfo.factionName) || '';
                GM.provinceStats[newDiv.name] = {
                  name: newDiv.name, owner: _playerFacName,
                  population: newDiv.population, wealth: newDiv.prosperity,
                  stability: 60, development: Math.round(newDiv.prosperity * 0.8),
                  taxRevenue: 0, militaryRecruits: 0,
                  unrest: 15, corruption: 25,
                  terrain: newDiv.terrain, specialResources: newDiv.specialResources,
                  governor: newDiv.governor, taxLevel: newDiv.taxLevel
                };
                addEB('\u884C\u653F', '\u65B0\u589E\u884C\u653F\u533A\u5212\uFF1A' + newDiv.name + (adu.reason ? '(' + adu.reason + ')' : ''));

              } else if (act === 'remove') {
                var found = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (found) {
                  found.arr.splice(found.index, 1);
                  if (GM.provinceStats && GM.provinceStats[adu.division]) delete GM.provinceStats[adu.division];
                  addEB('\u884C\u653F', '\u64A4\u9500\u884C\u653F\u533A\u5212\uFF1A' + adu.division + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'rename') {
                var found = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (found && adu.newName) {
                  var oldName = found.node.name;
                  found.node.name = adu.newName;
                  // 同步provinceStats
                  if (GM.provinceStats && GM.provinceStats[oldName]) {
                    GM.provinceStats[adu.newName] = GM.provinceStats[oldName];
                    GM.provinceStats[adu.newName].name = adu.newName;
                    delete GM.provinceStats[oldName];
                  }
                  addEB('\u884C\u653F', oldName + '\u6539\u540D\u4E3A' + adu.newName + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'merge') {
                // 合并：将源节点数据并入目标节点，删除源节点
                if (adu.division === adu.mergeInto) return; // 防止自我合并
                var src = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                var dst = adu.mergeInto ? _findAdminNode(adu.mergeInto, _ahPlayer.divisions, null) : null;
                if (src && dst && src.node !== dst.node) {
                  // 合并人口
                  dst.node.population = (dst.node.population || 0) + (src.node.population || 0);
                  // 合并子节点
                  if (src.node.children && src.node.children.length > 0) {
                    if (!dst.node.children) dst.node.children = [];
                    dst.node.children = dst.node.children.concat(src.node.children);
                  }
                  src.arr.splice(src.index, 1);
                  // 同步provinceStats
                  if (GM.provinceStats) {
                    var _srcPS = GM.provinceStats[adu.division];
                    var _dstPS = GM.provinceStats[adu.mergeInto];
                    if (_srcPS && _dstPS) {
                      _dstPS.population += _srcPS.population || 0;
                      _dstPS.taxRevenue += _srcPS.taxRevenue || 0;
                      _dstPS.militaryRecruits += _srcPS.militaryRecruits || 0;
                    }
                    delete GM.provinceStats[adu.division];
                  }
                  addEB('\u884C\u653F', adu.division + '\u5E76\u5165' + adu.mergeInto + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'split') {
                // 拆分：原节点保留，创建新节点分走部分人口
                var orig = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (orig && adu.splitResult && Array.isArray(adu.splitResult) && adu.splitResult.length > 0) {
                  var parentArr = orig.parent ? orig.parent.children : _ahPlayer.divisions;
                  var splitCount = adu.splitResult.length;
                  var popPerSplit = Math.floor((orig.node.population || 50000) / (splitCount + 1));
                  orig.node.population = popPerSplit; // 原节点保留一份
                  adu.splitResult.forEach(function(newName) {
                    var newDiv = {
                      id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                      name: newName, level: orig.node.level || '',
                      officialPosition: orig.node.officialPosition || '',
                      governor: '', description: '\u62C6\u5206\u81EA' + adu.division,
                      population: popPerSplit, prosperity: orig.node.prosperity || 50,
                      terrain: orig.node.terrain || '', specialResources: '',
                      taxLevel: orig.node.taxLevel || '\u4E2D', children: []
                    };
                    parentArr.push(newDiv);
                  });
                  addEB('\u884C\u653F', adu.division + '\u62C6\u5206\u4E3A' + adu.splitResult.join('\u3001') + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'territory_gain') {
                // P2: 获得领土 → 创建"未定行政区"临时顶级节点
                var undetermined = _findAdminNode('\u672A\u5B9A\u884C\u653F\u533A', _ahPlayer.divisions, null);
                if (!undetermined) {
                  var undNode = {
                    id: 'div_undetermined', name: '\u672A\u5B9A\u884C\u653F\u533A',
                    level: '\u4E34\u65F6', officialPosition: '',
                    description: '\u65B0\u83B7\u5F97\u9886\u571F\uFF0C\u7B49\u5F85\u7BA1\u7406\u65B9\u6848',
                    population: 0, prosperity: 30, terrain: '', taxLevel: '\u4E2D',
                    children: []
                  };
                  _ahPlayer.divisions.push(undNode);
                  undetermined = { node: undNode };
                }
                // 添加获得的行政区到未定行政区下
                var gainDiv = {
                  id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                  name: adu.division || '\u65B0\u9886\u571F',
                  level: adu.level || '', officialPosition: adu.officialPosition || '',
                  governor: '', description: '\u4ECE' + (adu.gainedFrom || '\u654C\u65B9') + '\u83B7\u5F97',
                  population: parseInt(adu.population) || 30000, prosperity: parseInt(adu.prosperity) || 30,
                  terrain: adu.terrain || '', specialResources: adu.specialResources || '',
                  taxLevel: adu.taxLevel || '\u4E2D', children: []
                };
                if (!undetermined.node.children) undetermined.node.children = [];
                undetermined.node.children.push(gainDiv);
                undetermined.node.population += gainDiv.population;
                // 同步provinceStats
                if (!GM.provinceStats) GM.provinceStats = {};
                var _pfn = (P.playerInfo && P.playerInfo.factionName) || '';
                GM.provinceStats[gainDiv.name] = {
                  name: gainDiv.name, owner: _pfn,
                  population: gainDiv.population, wealth: gainDiv.prosperity,
                  stability: 40, development: 30,
                  taxRevenue: 0, militaryRecruits: 0,
                  unrest: 30, corruption: 30,
                  terrain: gainDiv.terrain, specialResources: gainDiv.specialResources,
                  governor: '', taxLevel: gainDiv.taxLevel
                };
                addEB('\u9886\u571F', '\u83B7\u5F97\u9886\u571F\uFF1A' + gainDiv.name + '\uFF0C\u7EB3\u5165\u672A\u5B9A\u884C\u653F\u533A' + (adu.reason ? '(' + adu.reason + ')' : ''));
                // 触发上奏/议程
                if (GM.memorials) {
                  GM.memorials.push({
                    type: 'territory', priority: 'urgent', turn: GM.turn, status: 'pending',
                    title: '\u65B0\u83B7\u9886\u571F' + gainDiv.name + '\u7BA1\u7406\u65B9\u6848',
                    content: '\u81E3\u5949\u8868\uFF1A\u65B0\u83B7' + gainDiv.name + '\u5C1A\u672A\u8BBE\u7F6E\u884C\u653F\u533A\u5212\u548C\u5730\u65B9\u5B98\uFF0C\u8BF7\u965B\u4E0B\u5B9A\u593A\u7BA1\u7406\u65B9\u6848\u3002',
                    from: '\u6709\u53F8', reply: ''
                  });
                }

              } else if (act === 'territory_loss') {
                // P2: 丢失领土 → 数据对玩家清零
                var lost = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (lost) {
                  // 记录丢失前数据（供侨置用）
                  if (!GM._lostTerritories) GM._lostTerritories = {};
                  GM._lostTerritories[adu.division] = {
                    node: JSON.parse(JSON.stringify(lost.node)),
                    lostTo: adu.lostTo || '\u654C\u65B9',
                    turn: GM.turn
                  };
                  // 从玩家树中移除
                  lost.arr.splice(lost.index, 1);
                  // 从provinceStats中移除
                  if (GM.provinceStats && GM.provinceStats[adu.division]) {
                    delete GM.provinceStats[adu.division];
                  }
                  // 递归移除所有子节点的provinceStats
                  function _removeChildPS(children) {
                    if (!children) return;
                    children.forEach(function(c) {
                      if (GM.provinceStats && GM.provinceStats[c.name]) delete GM.provinceStats[c.name];
                      if (c.children) _removeChildPS(c.children);
                    });
                  }
                  _removeChildPS(lost.node.children);
                  addEB('\u9886\u571F', '\u4E22\u5931\u9886\u571F\uFF1A' + adu.division + '\uFF0C\u5F52\u5C5E' + (adu.lostTo || '\u654C\u65B9') + (adu.reason ? '(' + adu.reason + ')' : ''));
                  // 地方官受影响 + NPC记忆
                  var _lostGov = lost.node.governor;
                  if (_lostGov) {
                    var _lgCh = findCharByName(_lostGov);
                    if (_lgCh) {
                      _tmApplyLoyaltyDelta(_lgCh, -10, '\u4EFB\u6240\u5931\u5730', 'admin-territory-lost-governor');
                      _lgCh.stress = Math.min(100, (_lgCh.stress || 0) + 15);
                      if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                        NpcMemorySystem.remember(_lostGov, '\u6240\u8F96' + adu.division + '\u5931\u9677\u4E8E' + (adu.lostTo || '\u654C\u65B9') + '\uFF0C\u5BF9\u6B64\u6DF1\u611F\u7126\u8651\u548C\u7F9A\u803B', 'trauma');
                      }
                    }
                  }
                  // 触发侨置决策上奏
                  if (GM.memorials) {
                    GM.memorials.push({
                      type: 'territory', priority: 'urgent', turn: GM.turn, status: 'pending',
                      title: adu.division + '\u5931\u9677\uFF0C\u662F\u5426\u4FA8\u7F6E\uFF1F',
                      content: '\u81E3\u5949\u8868\uFF1A' + adu.division + '\u5DF2\u5931\u9677\u4E8E' + (adu.lostTo || '\u654C\u65B9') + '\uFF0C\u8BF7\u965B\u4E0B\u5B9A\u593A\u662F\u5426\u4FA8\u7F6E\u6B64\u5730\u884C\u653F\u533A\u5212\u3002',
                      from: '\u6709\u53F8', reply: '',
                      _qiaozhiTarget: adu.division
                    });
                  }
                }

              } else if (act === 'reform') {
                // P4: 行政改革
                addEB('\u884C\u653F', '\u884C\u653F\u6539\u9769\uFF1A' + (adu.division || '') + ' ' + (adu.description || adu.reason || ''));
              }
            });
          }
        }

        // 处理后宫事件
        if (p1.harem_events && Array.isArray(p1.harem_events) && GM.harem) {
          p1.harem_events.forEach(function(he) {
            if (!he.type || !he.character) return;
            if (he.type === 'pregnancy') {
              if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
              GM.harem.pregnancies.push({ mother: he.character, startTurn: GM.turn, detail: he.detail || '' });
              addEB('\u540E\u5BAB', he.character + '\u6709\u5B55');
            } else if (he.type === 'birth') {
              addEB('\u540E\u5BAB', he.character + '\u8BDE\u4E0B\u5B50\u55E3' + (he.detail || ''));
              // 从pregnancies移除
              if (GM.harem.pregnancies) GM.harem.pregnancies = GM.harem.pregnancies.filter(function(p) { return p.mother !== he.character; });
            } else if (he.type === 'rank_change') {
              var sp = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (sp) {
                // 优先使用结构化newRank字段，回退到detail文本
                var _newRankId = he.newRank || he.detail || '';
                sp.spouseRank = _newRankId;
                // 获取位份中文名显示
                var _rankDisplayName = _newRankId;
                if (typeof getHaremRankName === 'function') {
                  var _rn = getHaremRankName(_newRankId);
                  if (_rn && _rn !== _newRankId) _rankDisplayName = _rn;
                }
                addEB('\u540E\u5BAB', he.character + '\u664B\u5C01\u4E3A' + _rankDisplayName);
              }
            } else if (he.type === 'death') {
              var spd = GM.chars ? GM.chars.find(function(c) { return c.name === he.character; }) : null;
              if (spd) {
                spd.alive = false; spd.dead = true; spd.deathTurn = GM.turn; spd.deathReason = he.detail || '';
                // 触发完整死亡级联（官职清理/军队统帅/事件总线/叙事事实）
                if (typeof PostTransfer !== 'undefined') PostTransfer.cascadeVacate(he.character);
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: he.character, reason: he.detail || '薨逝' });
                // 军队统帅清理
                if (GM.armies) GM.armies.forEach(function(a) { if (a.commander === he.character) { a.commander = ''; a.morale = Math.max(0, (a.morale||50) - 15); } });
              }
              addEB('\u540E\u5BAB', he.character + '\u85A8\u901D' + (he.detail ? '\uFF1A' + he.detail : ''));
            } else if (he.type === 'favor_change') {
              // 宠爱变化
              var spf = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (spf) {
                if (spf.favor === undefined) spf.favor = 50;
                spf.favor = clamp(spf.favor + clamp(parseInt(he.favor_delta) || 0, -30, 30), 0, 100);
                if (he.detail) addEB('\u540E\u5BAB', he.character + '\uFF1A' + he.detail);
                // 宠爱极端值影响忠诚
                if (spf.favor > 85) _tmApplyLoyaltyDelta(spf, 2, '\u540E\u5BAB\u5BA0\u7231\u589E\u76CA', 'harem-favor-high');
                if (spf.favor < 20) _tmApplyLoyaltyDelta(spf, -3, '\u540E\u5BAB\u5BA0\u7231\u51B7\u843D', 'harem-favor-low');
              }
            } else if (he.type === 'scandal') {
              // 丑闻/纠纷
              var sps = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (sps) {
                sps.stress = Math.min(100, (sps.stress || 0) + 15);
                if (sps.favor !== undefined) sps.favor = Math.max(0, sps.favor - 10);
              }
              addEB('\u540E\u5BAB', he.character + '\u4E11\u95FB' + (he.detail ? '\uFF1A' + he.detail : ''));
              // NPC记忆
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                NpcMemorySystem.remember(he.character, '\u540E\u5BAB\u4E11\u95FB\uFF1A' + (he.detail || ''), 'scandal');
              }
            }
          });
        }

        // 处理皇城宫殿变更
        if (p1.palace_changes && Array.isArray(p1.palace_changes)) {
          // 自动初始化（若剧本未启用皇城系统但AI尝试建）
          if (!P.palaceSystem) P.palaceSystem = { enabled: true, capitalName: '', capitalDescription: '', palaces: [] };
          if (!P.palaceSystem.palaces) P.palaceSystem.palaces = [];
          p1.palace_changes.forEach(function(pc) {
            if (!pc.action) return;
            var palaces = P.palaceSystem.palaces;
            if (pc.action === 'build') {
              var nm = pc.newPalace || pc.palace;
              if (!nm) return;
              var _feas = pc.feasibility || '合理';
              if (_feas === '不合理') {
                addEB('\u5BAB\u5EFA', '拟建 ' + nm + ' 因不合理未能实施');
                return;
              }
              palaces.push({
                id: 'pal_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
                name: nm,
                type: pc.palaceType || 'main_hall',
                function: pc.reason || '',
                description: pc.judgedEffects || '',
                status: (pc.timeActual && pc.timeActual > 0) ? 'underconstruction' : 'intact',
                level: 1,
                subHalls: [],
                isHistorical: false,
                costActual: pc.costActual || 0,
                remainingTurns: pc.timeActual || 0,
                startTurn: GM.turn
              });
              addEB('\u5BAB\u5EFA', '新建' + nm + (pc.reason ? '：' + pc.reason : ''));
            } else if (pc.action === 'renovate') {
              var _p = palaces.find(function(x) { return x.name === pc.palace; });
              if (_p) {
                _p.status = 'intact';
                _p.lastRenovation = GM.turn;
                addEB('\u5BAB\u5EFA', _p.name + ' 修缮完工');
              }
            } else if (pc.action === 'ruined') {
              var _p2 = palaces.find(function(x) { return x.name === pc.palace; });
              if (_p2) {
                _p2.status = 'ruined';
                addEB('\u5BAB\u5EFA', _p2.name + ' 荒废' + (pc.reason ? '：' + pc.reason : ''));
              }
            } else if (pc.action === 'abandon') {
              var _idx = palaces.findIndex(function(x) { return x.name === pc.palace; });
              if (_idx >= 0) {
                var _ab = palaces[_idx];
                palaces.splice(_idx, 1);
                addEB('\u5BAB\u5EFA', _ab.name + ' 废弃' + (pc.reason ? '：' + pc.reason : ''));
              }
            } else if (pc.action === 'assign') {
              // 居所分配/移居
              var _tp = palaces.find(function(x) { return x.name === pc.palace; });
              if (_tp && _tp.subHalls) {
                var _sh = _tp.subHalls.find(function(s) { return s.name === pc.subHall; });
                if (_sh && pc.occupant) {
                  // 获取原居所用于比较（判断是晋升还是贬谪）
                  var _prevRole = null;
                  palaces.forEach(function(xp) {
                    if (!xp.subHalls) return;
                    xp.subHalls.forEach(function(xs) {
                      if (xs.occupants && xs.occupants.indexOf(pc.occupant) >= 0) _prevRole = xs.role;
                    });
                  });
                  // 从原位移除
                  palaces.forEach(function(xp) {
                    if (!xp.subHalls) return;
                    xp.subHalls.forEach(function(xs) {
                      if (xs.occupants) xs.occupants = xs.occupants.filter(function(n) { return n !== pc.occupant; });
                    });
                  });
                  // 移入新位
                  if (!_sh.occupants) _sh.occupants = [];
                  _sh.occupants.push(pc.occupant);
                  // 更新 character.residence
                  var _ch = (GM.chars || []).find(function(c) { return c.name === pc.occupant; });
                  if (_ch) _ch.residence = { palaceId: _tp.id, subHallId: _sh.id };
                  addEB('\u5BAB\u5EFA', pc.occupant + ' 移居' + _tp.name + '·' + _sh.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                  // NPC 记忆：按升降分级写入
                  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                    var _roleRank = { main:3, side:2, attached:1 };
                    var _prevRk = _prevRole ? _roleRank[_prevRole] : 0;
                    var _newRk = _roleRank[_sh.role] || 1;
                    var _moodText, _moodKey;
                    if (_newRk > _prevRk) { _moodText = '迁居' + _tp.name + '·' + _sh.name + '，位遇晋升'; _moodKey = '喜'; }
                    else if (_newRk < _prevRk) { _moodText = '由旧居迁至 ' + _tp.name + '·' + _sh.name + '，位遇下降，恐圣眷不再'; _moodKey = '忧'; }
                    else { _moodText = '迁居 ' + _tp.name + '·' + _sh.name; _moodKey = '平'; }
                    NpcMemorySystem.remember(pc.occupant, _moodText, _moodKey, 5);
                  }
                }
              }
            } else if (pc.action === 'build' && pc.occupant) {
              // AI若在新建时指定居住者，也写入记忆
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                NpcMemorySystem.remember(pc.occupant, '蒙恩新赐' + (pc.newPalace || pc.palace) + '为居所', '喜', 7);
              }
            } else if (pc.action === 'abandon' || pc.action === 'ruined') {
              // 若废弃/荒废的宫殿有居住者，通知NPC记忆
              var _ruinedPal = palaces.find(function(x) { return x.name === pc.palace; });
              if (!_ruinedPal && pc.action === 'abandon') {
                // already removed, lookup previous occupants is not possible
              }
              // 对于 ruined，occupants仍然在对象中可查
              if (_ruinedPal && _ruinedPal.subHalls) {
                _ruinedPal.subHalls.forEach(function(sh) {
                  (sh.occupants || []).forEach(function(occ) {
                    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                      NpcMemorySystem.remember(occ, '所居 ' + _ruinedPal.name + ' 荒废，流离失所', '忧', 6);
                    }
                  });
                });
              }
            }
          });
        }

        // 处理文事作品（诗词文赋画等）
        if (p1.cultural_works && Array.isArray(p1.cultural_works) && p1.cultural_works.length > 0) {
          if (!GM.culturalWorks) GM.culturalWorks = [];
          var _pNameW = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.cultural_works.forEach(function(w) {
            if (!w || !w.author || !w.content || !w.title) return;
            // ── 玩家保护：作者是玩家——除非玩家在本回合诏令中明确命自己作，否则过滤 ──
            if (_pNameW && w.author === _pNameW) {
              // 检查 motivation 是否 commissioned（由玩家诏令命作）
              if (w.motivation !== 'commissioned' && w.motivation !== 'duty') {
                addEB('\u8FC7\u6EE4', 'AI 试图让玩家 ' + _pNameW + ' autonomous 作 ' + w.title + '，已过滤');
                return;
              }
            }
            // 补全字段
            var work = {
              id: 'work_T' + GM.turn + '_' + Math.random().toString(36).slice(2, 8),
              author: w.author,
              turn: GM.turn,
              date: w.date || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
              location: w.location || '',
              triggerCategory: w.triggerCategory || 'mood',
              trigger: w.trigger || 'casual_mood',
              motivation: w.motivation || 'spontaneous',
              lifeStage: w.lifeStage || '',
              genre: w.genre || 'shi',
              subtype: w.subtype || '',
              title: w.title,
              content: w.content,
              mood: w.mood || '',
              theme: w.theme || '',
              elegance: w.elegance || 'refined',
              dedicatedTo: Array.isArray(w.dedicatedTo) ? w.dedicatedTo : [],
              inspiredBy: w.inspiredBy || '',
              commissionedBy: w.commissionedBy || '',
              praiseTarget: w.praiseTarget || '',
              satireTarget: w.satireTarget || '',
              quality: parseInt(w.quality) || 60,
              politicalImplication: w.politicalImplication || '',
              politicalRisk: w.politicalRisk || 'low',
              narrativeContext: w.narrativeContext || '',
              preservationPotential: w.preservationPotential || 'low',
              isPreserved: (w.preservationPotential === 'high' || (parseInt(w.quality) || 0) >= 88),
              appreciatedBy: [],
              echoResponses: [],
              isForbidden: false,
              authorTraits: []
            };
            // 记录作者特质快照
            var authorCh = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(w.author) : null) || findCharByName(w.author);
            if (authorCh) {
              work.authorTraits = Array.isArray(authorCh.traits) ? authorCh.traits.slice() : [];
              // 作者索引
              if (!Array.isArray(authorCh.works)) authorCh.works = [];
              authorCh.works.push(work.id);
              // ── 作者自身记忆——"我记得自己写过这篇" ──
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                var _authorMood = (work.motivation === 'mourning' || work.mood === '悲怆' || work.mood === '凄苦') ? '忧' :
                                  (work.mood === '豪迈' || work.mood === '豪放' || work.motivation === 'celebration') ? '喜' :
                                  (work.motivation === 'critique' || work.mood === '讽刺') ? '恨' : '平';
                var _importance = Math.min(10, Math.max(4, Math.round((work.quality || 60) / 12)));
                var _memText = '作《' + work.title + '》于' + (work.location || '此地') + '——' +
                               (work.mood ? work.mood + '之作' : '') +
                               (work.narrativeContext ? '：' + work.narrativeContext.substring(0, 50) : '');
                NpcMemorySystem.remember(authorCh.name, _memText, _authorMood, _importance);
              }
            }
            GM.culturalWorks.push(work);
            // === 按动机应用差异化效果 ===
            var _mot = work.motivation;
            var _qBonus = Math.max(0, (work.quality - 50)) / 10; // 0-5
            if (authorCh) {
              if (_mot === 'spontaneous' || _mot === 'self_express') {
                // 自发之作：单纯文名
                if (work.quality >= 85) addEB('文事', authorCh.name + '作' + work.title + '，一时传诵');
              } else if (_mot === 'flattery') {
                // 干谒求官——看质量+委托对象
                var _target = (work.dedicatedTo && work.dedicatedTo[0]) || work.praiseTarget;
                var _targetCh = _target ? findCharByName(_target) : null;
                if (work.elegance === 'refined' && work.quality >= 75) {
                  if (_targetCh) {
                    _targetCh.affinity = (_targetCh.affinity || 50) + 5;
                    addEB('\u6587\u4E8B', authorCh.name + '以《' + work.title + '》干谒' + _target + '，得赏识');
                  }
                } else if (work.elegance === 'vernacular' || work.quality < 60) {
                  // 谄媚过度 → 士林讥嘲
                  authorCh.prestige = Math.max(0, (authorCh.prestige || 50) - 2);
                  addEB('\u6587\u4E8B', authorCh.name + '作《' + work.title + '》献媚于' + _target + '，士林讥之');
                }
              } else if (_mot === 'critique' || work.politicalRisk === 'high') {
                // 讽谕之作：风险+长远文名
                addEB('\u6587\u4E8B', '【讽谕】' + authorCh.name + '《' + work.title + '》出，' + (work.satireTarget ? '暗讽' + work.satireTarget + '，' : '') + '士论哗然');
                // 讽刺对象若为权贵，其可能记恨
                var _satCh = work.satireTarget ? findCharByName(work.satireTarget) : null;
                if (_satCh && typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(_satCh.name, authorCh.name + '作讽谕之文《' + work.title + '》暗刺吾，宜记之', '恨', 7);
                  _satCh.affinity = Math.max(0, (_satCh.affinity || 50) - 8);
                }
                if (work.quality >= 85) {
                  authorCh.prestige = Math.min(100, (authorCh.prestige || 50) + 3);
                }
              } else if (_mot === 'ghostwrite' && work.commissionedBy) {
                // 代笔：委托人署名得名声，作者得润笔
                addEB('\u6587\u4E8B', authorCh.name + '代' + work.commissionedBy + '撰《' + work.title + '》');
                var _commCh = findCharByName(work.commissionedBy);
                if (_commCh) {
                  _commCh.prestige = Math.min(100, (_commCh.prestige || 50) + Math.round(_qBonus));
                  _commCh.affinity = (_commCh.affinity || 50) + 3;
                  // 双方都记忆此事（委托人知道这是代笔，作者也记得）
                  if (typeof NpcMemorySystem !== 'undefined') {
                    NpcMemorySystem.remember(_commCh.name, '托' + authorCh.name + '代作《' + work.title + '》——知其实笔', '平', 5, authorCh.name);
                  }
                }
              } else if (_mot === 'mourning' || _mot === 'memorial') {
                // 悼亡/祭文：仁孝名声
                authorCh.benevolence = Math.min(100, (authorCh.benevolence || 50) + 1);
                addEB('\u6587\u4E8B', authorCh.name + '撰《' + work.title + '》以祭，情深意切');
              } else if (_mot === 'celebration') {
                // 颂扬
                var _prTar = work.praiseTarget ? findCharByName(work.praiseTarget) : null;
                if (_prTar) {
                  _prTar.affinity = (_prTar.affinity || 50) + 4;
                  addEB('\u6587\u4E8B', authorCh.name + '作' + work.title + '颂' + work.praiseTarget);
                  // 被颂者的记忆
                  if (typeof NpcMemorySystem !== 'undefined') {
                    NpcMemorySystem.remember(_prTar.name, authorCh.name + '作《' + work.title + '》颂吾——感其知遇', '喜', 6, authorCh.name);
                  }
                }
              } else if (_mot === 'farewell') {
                // 送别
                (work.dedicatedTo || []).forEach(function(n) {
                  var _ch = findCharByName(n);
                  if (_ch) {
                    _ch.affinity = (_ch.affinity || 50) + 5;
                    _tmApplyLoyaltyDelta(_ch, 2, '\u6587\u4E8B\u8D60\u522B', 'cultural-work-farewell');
                    // 受赠者记忆
                    if (typeof NpcMemorySystem !== 'undefined') {
                      NpcMemorySystem.remember(n, authorCh.name + '于别时赠《' + work.title + '》，情深意厚', '喜', 7);
                    }
                  }
                });
                addEB('\u6587\u4E8B', authorCh.name + '送别' + (work.dedicatedTo||[]).join('、') + '，作《' + work.title + '》');
              } else if (_mot === 'response') {
                // 次韵酬答：文友关系
                (work.dedicatedTo || []).forEach(function(n) {
                  var _ch = findCharByName(n);
                  if (_ch) {
                    _ch.affinity = (_ch.affinity || 50) + 4;
                    if (typeof NpcMemorySystem !== 'undefined') {
                      NpcMemorySystem.remember(n, authorCh.name + '次韵和余作《' + work.title + '》——文友相重', '喜', 5);
                    }
                  }
                });
              } else if (_mot === 'duty' || _mot === 'commissioned') {
                // 应制：皇恩+
                _tmApplyLoyaltyDelta(authorCh, 1, '\u5E94\u5236\u5949\u8BCF\u4F5C\u6587', 'cultural-work-duty');
              }
              // 通用效果：威望与文化影响
              authorCh.prestige = Math.min(100, (authorCh.prestige || 50) + Math.round(_qBonus * 0.5));
              if (GM.eraState && typeof GM.eraState.culturalVibrancy === 'number') {
                GM.eraState.culturalVibrancy = Math.min(1.0, GM.eraState.culturalVibrancy + Math.max(0, work.quality - 70) * 0.001);
              }
            }
          });
        }

        // 处理诏令生命周期更新（AI每回合推进的阶段状态）
        if (p1.edict_lifecycle_update && Array.isArray(p1.edict_lifecycle_update) && p1.edict_lifecycle_update.length > 0) {
          if (!GM._edictLifecycle) GM._edictLifecycle = [];
          p1.edict_lifecycle_update.forEach(function(u) {
            if (!u || !u.edictId) return;
            // 查找或创建生命周期记录
            var entry = GM._edictLifecycle.find(function(e) { return e.edictId === u.edictId; });
            if (!entry) {
              // 新条目——必须能在 _edictTracker 找到对应诏令，否则视为 AI 臆造并拒绝
              var _src = (GM._edictTracker || []).find(function(t) { return t.id === u.edictId; });
              if (!_src) {
                addEB('\u8BCF\u4EE4', '【过滤】AI 试图为不存在的诏令ID(' + u.edictId + ')创建生命周期，已拒绝');
                _dbg('[edict_lifecycle] 拒绝臆造 edictId=' + u.edictId);
                return;
              }
              entry = {
                edictId: u.edictId,
                edictType: u.edictType || '',
                edictContent: _src.content || '',
                edictCategory: _src.category || '',
                startTurn: GM.turn,
                stages: [],
                reformPhase: u.reformPhase || null,
                pilotRegion: u.pilotRegion || '',
                expansionRegions: [],
                oppositionLeaders: [],
                supporters: [],
                totalEffects: {},
                isCompleted: false
              };
              GM._edictLifecycle.push(entry);
            }
            // 推进阶段
            var stageEntry = {
              turn: GM.turn,
              stage: u.stage || 'execution',
              progress: u.stageProgress || 0,
              executor: u.executor || '',
              executorEffectiveness: u.executorEffectiveness || 0.5,
              resistanceDescription: u.resistanceDescription || '',
              narrativeSnippet: u.narrativeSnippet || ''
            };
            entry.stages.push(stageEntry);
            if (u.reformPhase) entry.reformPhase = u.reformPhase;
            if (u.pilotRegion && !entry.pilotRegion) entry.pilotRegion = u.pilotRegion;
            if (Array.isArray(u.expansionRegions)) {
              u.expansionRegions.forEach(function(r) {
                if (entry.expansionRegions.indexOf(r) < 0) entry.expansionRegions.push(r);
              });
            }
            if (Array.isArray(u.oppositionLeaders)) {
              u.oppositionLeaders.forEach(function(n) {
                if (entry.oppositionLeaders.indexOf(n) < 0) entry.oppositionLeaders.push(n);
              });
            }
            if (Array.isArray(u.supporters)) {
              u.supporters.forEach(function(n) {
                if (entry.supporters.indexOf(n) < 0) entry.supporters.push(n);
              });
            }
            // 阶段 = sedimentation 标为完成
            if (u.stage === 'sedimentation') entry.isCompleted = true;

            // 应用 currentEffects 到资源/阶层
            if (u.currentEffects && typeof u.currentEffects === 'object') {
              Object.keys(u.currentEffects).forEach(function(k) {
                var v = parseFloat(u.currentEffects[k]) || 0;
                entry.totalEffects[k] = (entry.totalEffects[k] || 0) + v;
                // 已有变量：直接应用
                if (GM.vars && GM.vars[k]) {
                  GM.vars[k].value = Math.max(GM.vars[k].min || 0, Math.min(GM.vars[k].max || 999999999, (GM.vars[k].value || 0) + v));
                } else if (k === 'stateTreasury' && typeof GM.stateTreasury === 'number') {
                  GM.stateTreasury = Math.max(0, GM.stateTreasury + v);
                }
              });
            }
            // 阶层影响 → classSatisfaction / unrest 联动
            if (u.classesAffected && typeof u.classesAffected === 'object' && GM.classes) {
              Object.keys(u.classesAffected).forEach(function(cls) {
                var info = u.classesAffected[cls] || {};
                var impact = parseFloat(info.impact) || 0;
                var clsObj = (GM.classes || []).find(function(c) { return c.name === cls; });
                if (clsObj) {
                  clsObj.satisfaction = Math.max(0, Math.min(100, (clsObj.satisfaction || 50) + impact));
                  if (TM && TM.ClassEngine && typeof TM.ClassEngine.applyClassPartyCoupling === 'function' && impact) {
                    try {
                      TM.ClassEngine.applyClassPartyCoupling(GM, clsObj, impact, { turn: GM.turn, source: 'endturn-ai-infer', reason: info.reason || '' });
                    } catch(_classCoupleImpactE) {
                      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_classCoupleImpactE, 'endturn] class party impact coupling:') : console.warn('[endturn] class party impact coupling:', _classCoupleImpactE);
                    }
                  }
                  // 联动分级不满：满意度剧降推高 unrestLevels 阶梯
                  if (!clsObj.unrestLevels) clsObj.unrestLevels = { grievance: 60, petition: 70, strike: 80, revolt: 90 };
                  if (impact < -5) {
                    clsObj.unrestLevels.grievance = Math.max(0, (clsObj.unrestLevels.grievance || 60) + impact * 0.8);
                    if (impact < -10) clsObj.unrestLevels.petition = Math.max(0, (clsObj.unrestLevels.petition || 70) + impact * 0.5);
                    if (impact < -20) clsObj.unrestLevels.strike = Math.max(0, (clsObj.unrestLevels.strike || 80) + impact * 0.3);
                  }
                }
              });
            }
            // 势力影响 → factionRelations / playerRelation 联动
            if (u.factionsAffected && typeof u.factionsAffected === 'object' && GM.facs) {
              Object.keys(u.factionsAffected).forEach(function(fn) {
                var info = u.factionsAffected[fn] || {};
                var delta = parseFloat(info.relation_delta) || 0;
                var fObj = (GM.facs || []).find(function(f) { return f.name === fn; });
                if (fObj) {
                  if (delta) fObj.playerRelation = Math.max(-100, Math.min(100, (fObj.playerRelation || 0) + delta));
                  if (info.attitude_shift && info.attitude_shift !== fObj.attitude) {
                    fObj.attitude = info.attitude_shift;
                    addEB('外交', fn + '因诏令转向' + info.attitude_shift + (info.reason ? '（' + info.reason + '）' : ''));
                  }
                  // 存入势力历史大事
                  if (!Array.isArray(fObj.historicalEvents)) fObj.historicalEvents = [];
                  if (Math.abs(delta) >= 5) {
                    fObj.historicalEvents.push({ turn: GM.turn, event: '对' + ((P.playerInfo && P.playerInfo.factionName) || '我方') + '诏令的反应', impact: (delta > 0 ? '关系+' : '关系') + delta });
                    if (fObj.historicalEvents.length > 30) fObj.historicalEvents = fObj.historicalEvents.slice(-30);
                  }
                }
              });
            }
            // 党派影响 → influence / agenda_history 联动
            if (u.partiesAffected && typeof u.partiesAffected === 'object' && GM.parties) {
              Object.keys(u.partiesAffected).forEach(function(pn) {
                var info = u.partiesAffected[pn] || {};
                var infDelta = parseFloat(info.influence_delta) || 0;
                var pObj = (GM.parties || []).find(function(pp) { return pp.name === pn; });
                if (pObj) {
                  if (infDelta) pObj.influence = Math.max(0, Math.min(100, (pObj.influence || 50) + infDelta));
                  // 写入议程演进
                  if (info.agenda_impact || info.reason) {
                    if (!Array.isArray(pObj.agenda_history)) pObj.agenda_history = [];
                    pObj.agenda_history.push({ turn: GM.turn, agenda: info.agenda_impact || '诏令反应', outcome: info.reason || '' });
                    if (pObj.agenda_history.length > 20) pObj.agenda_history = pObj.agenda_history.slice(-20);
                  }
                  // 反对派 → 党员写入恨意记忆
                  if (info.agenda_impact === '反对' && typeof NpcMemorySystem !== 'undefined' && GM.chars) {
                    GM.chars.filter(function(c){return c.party === pn;}).slice(0, 3).forEach(function(c) {
                      NpcMemorySystem.remember(c.name, '党议反对诏令(' + (u.edictType||'') + ')', '恨', 5);
                    });
                  }
                }
              });
            }

            // 意外后果 → 编年 + 起居注
            if (u.unintendedConsequences) {
              addEB('\u8BCF\u4EE4', '【意外】' + u.unintendedConsequences);
              if (GM.qijuHistory) {
                GM.qijuHistory.unshift({
                  turn: GM.turn,
                  date: typeof getTSText==='function'?getTSText(GM.turn):'',
                  content: '【意外后果】' + u.unintendedConsequences,
                  category: '诏令'
                });
              }
            }

            // 阻力生成 → 反对派 NPC 记忆（恨意积累）
            if (Array.isArray(u.oppositionLeaders) && typeof NpcMemorySystem !== 'undefined') {
              u.oppositionLeaders.forEach(function(oppName) {
                NpcMemorySystem.remember(oppName, '反对诏令(' + (u.edictType||'') + ')——深恶之', '恨', 6);
                // 与执行者建立冲突级关系
                if (u.executor && typeof applyNpcInteraction === 'function') {
                  // 这里不直接 applyNpcInteraction（避免叠加过多），只做记忆标记
                }
              });
            }
            // 事件板简要记录
            var stageLabel = (typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[u.stage]) ? EDICT_STAGES[u.stage].label : (u.stage||'');
            var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[u.edictType]) ? EDICT_TYPES[u.edictType].label : (u.edictType||'');
            var phaseTag = '';
            if (u.reformPhase && typeof REFORM_PHASES !== 'undefined' && REFORM_PHASES[u.reformPhase]) {
              phaseTag = '·' + REFORM_PHASES[u.reformPhase].label;
            }
            addEB('\u8BCF\u4EE4', typeLabel + phaseTag + ' → ' + stageLabel + (u.executor ? '(' + u.executor + '督办)' : '') + (u.narrativeSnippet ? '：' + u.narrativeSnippet.substring(0,60) : ''));
          });
        }

        // 处理 NPC 互动
        if (p1.npc_interactions && Array.isArray(p1.npc_interactions) && p1.npc_interactions.length > 0) {
          var _pName = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.npc_interactions.forEach(function(it) {
            if (!it || !it.type || !it.actor || !it.target) return;
            // ── 玩家保护：actor=玩家的 autonomous 互动一律过滤（玩家应通过诏令/批奏疏/问对自行操作）──
            if (_pName && (it.actor === _pName)) {
              addEB('\u8FC7\u6EE4', 'AI 试图替玩家 ' + _pName + ' autonomous 互动(' + it.type + '→' + it.target + ')，已过滤');
              return;
            }
            if (!_tmNpcLedgerPreflight({ source: 'main_ai:npc_interactions', kind: 'npc_interaction', actor: it.actor, type: it.type, behaviorType: it.type, target: it.target, action: it.description || '' }, 'AI NPC互动已阻止')) return;
            if (typeof applyNpcInteraction !== 'function') return;
            var extra = { description: it.description || '' };
            var ok = applyNpcInteraction(it.actor, it.target, it.type, extra);
            if (ok) {
              var typeInfo = (typeof NPC_INTERACTION_TYPES !== 'undefined' && NPC_INTERACTION_TYPES[it.type]) ? NPC_INTERACTION_TYPES[it.type].label : it.type;
              _tmNpcLedgerRecord({ source: 'main_ai:npc_interactions', kind: 'npc_interaction', actor: it.actor, type: it.type, behaviorType: it.type, target: it.target, action: it.description || typeInfo || '', result: it.result || '', status: 'applied', uiRoutes: ['relations', 'memory'] });
              addEB('\u4EBA\u7269', it.actor + '→' + it.target + ' ' + typeInfo + (it.description ? '：' + it.description : ''));
              // ── 名望/贤能涨跌（由行为定义查询）──
              try {
                var _typeDef = (typeof NPC_INTERACTION_TYPES !== 'undefined' && NPC_INTERACTION_TYPES[it.type]) ? NPC_INTERACTION_TYPES[it.type] : null;
                var _cEng = (typeof CharEconEngine !== 'undefined') ? CharEconEngine : null;
                if (_typeDef && _cEng) {
                  var _actorCh = (typeof findCharByName==='function') ? findCharByName(it.actor) : null;
                  var _targetCh = (typeof findCharByName==='function') ? findCharByName(it.target) : null;
                  if (_actorCh && _typeDef.fameActor) _cEng.adjustFame(_actorCh, _typeDef.fameActor, typeInfo+'→'+it.target);
                  if (_targetCh && _typeDef.fameTarget) _cEng.adjustFame(_targetCh, _typeDef.fameTarget, '被'+it.actor+typeInfo);
                  if (_actorCh && _typeDef.virtueActor) _cEng.adjustVirtueMerit(_actorCh, _typeDef.virtueActor, typeInfo);
                  if (_targetCh && _typeDef.virtueTarget) _cEng.adjustVirtueMerit(_targetCh, _typeDef.virtueTarget, '被'+typeInfo);
                }
              } catch(_fve){}
              // ── 当事人（actor、target）写入记忆 ──
              if (typeof NpcMemorySystem !== 'undefined') {
                var _aggressive = ['impeach','slander','frame_up','betray','expose_secret'].indexOf(it.type) >= 0;
                var _friendly = ['recommend','guarantee','petition_jointly','private_visit','invite_banquet','gift_present','duel_poetry'].indexOf(it.type) >= 0;
                var _emo = _aggressive ? '怒' : (_friendly ? '喜' : '平');
                var _wt = _aggressive ? 6 : (_friendly ? 4 : 3);
                if (it.actor && it.actor !== _pName) {
                  NpcMemorySystem.remember(it.actor, '我对 ' + it.target + ' ' + typeInfo + (it.description ? '：' + it.description.slice(0,30) : ''), _emo, _wt);
                }
                if (it.target && it.target !== _pName) {
                  NpcMemorySystem.remember(it.target, ' ' + it.actor + ' 对我 ' + typeInfo + (it.description ? '——' + it.description.slice(0,30) : ''), _aggressive ? '恨' : _emo, _wt);
                }
              }
              // 涉及第三方——也记入他们的记忆
              if (Array.isArray(it.involvedOthers) && typeof NpcMemorySystem !== 'undefined') {
                it.involvedOthers.forEach(function(n) {
                  if (n && n !== _pName) NpcMemorySystem.remember(n, '见 ' + it.actor + ' 对 ' + it.target + ' ' + typeInfo, '平', 3);
                });
              }
              // ── NPC 对玩家行为的分发 ──
              if (_pName && it.target === _pName) {
                _dispatchNpcActionToPlayer(it, typeInfo);
              }
              // ── publicKnown 的 NPC 间互动 → 起居注风闻 + 风闻录事 ──
              if (it.publicKnown) {
                if (GM.qijuHistory) {
                  GM.qijuHistory.unshift({
                    turn: GM.turn,
                    date: typeof getTSText==='function'?getTSText(GM.turn):'',
                    content: '【风闻】' + it.actor + ' 对 ' + it.target + ' ' + typeInfo + (it.description ? '——' + it.description.substring(0,60) : ''),
                    category: '风闻'
                  });
                }
                if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  var _fwType = (['impeach','slander','frame_up','expose_secret'].indexOf(it.type)>=0) ? '告状'
                              : (['correspond_secret','share_intelligence'].indexOf(it.type)>=0) ? '密札'
                              : (['private_visit','invite_banquet','duel_poetry','gift_present','recommend','guarantee','petition_jointly'].indexOf(it.type)>=0) ? '耳报'
                              : '风议';
                  PhaseD.addFengwen({
                    type: _fwType,
                    text: it.actor + '·' + typeInfo + '·' + it.target + (it.description ? '——' + it.description.slice(0,80) : ''),
                    credibility: 0.7,
                    source: 'npc_interaction',
                    actors: [it.actor, it.target].concat(it.involvedOthers||[]),
                    turn: GM.turn
                  });
                }
              } else if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen && Math.random() < 0.2) {
                // 非公开互动 20% 概率由耳目察觉，走"密札"
                PhaseD.addFengwen({
                  type: '密札',
                  text: '耳目报：' + it.actor + '→' + it.target + ' ' + typeInfo + '（未广传）',
                  credibility: 0.4,
                  source: 'spy',
                  actors: [it.actor, it.target],
                  turn: GM.turn
                });
              }
            }
          });
        }

        // 辅助：NPC 对玩家的互动分发到相应 tab
        function _dispatchNpcActionToPlayer(it, typeInfo) {
          if (!GM) return;
          var actor = it.actor, desc = it.description || typeInfo;
          var turn = GM.turn;
          var date = typeof getTSText==='function'?getTSText(turn):'';
          // 按 type 分发
          if (it.type === 'impeach' || it.type === 'slander' || it.type === 'expose_secret') {
            // 弹劾/诽谤/揭发 → 奏疏（弹章）
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, type: '弹章', subtype: '公疏',
              title: actor + '弹劾' + (it.involvedOthers && it.involvedOthers[0] ? it.involvedOthers[0] : ''),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          } else if (it.type === 'recommend' || it.type === 'guarantee' || it.type === 'petition_jointly') {
            // 举荐/担保/联名 → 奏疏
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, type: '荐表', subtype: '公疏',
              title: actor + (it.type==='recommend'?'举荐':it.type==='guarantee'?'担保':'联名'),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          } else if (it.type === 'private_visit' || it.type === 'invite_banquet' || it.type === 'duel_poetry') {
            // 私访/宴请/切磋 → 问对（求见队列）
            if (!GM._pendingAudiences) GM._pendingAudiences = [];
            GM._pendingAudiences.push({ name: actor, reason: desc, turn: turn });
          } else if (it.type === 'gift_present' || it.type === 'correspond_secret' || it.type === 'share_intelligence') {
            // 馈赠/密信/通报 → 鸿雁（NPC 主动来书）
            // R: 旧版只填 from/to/letterType/content/turn/status·缺 _npcInitiated/sentTurn/deliveryTurn/
            //    fromLocation·导致 Section 3 不接管·UI 不显示「回书/摘入」按钮·日期渲染异常
            if (!GM.letters) GM.letters = [];
            var _actorCh = (typeof findCharByName === 'function') ? findCharByName(actor) : null;
            var _capital = GM._capital || '京城';
            var _fromLoc = (_actorCh && _actorCh.location) || '远方';
            var _dpv1 = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
            var _nowD1 = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (turn-1)*_dpv1;
            GM.letters.push({
              id: 'letter_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, to: '玩家',
              fromLocation: _fromLoc, toLocation: _capital,
              letterType: it.type === 'gift_present' ? 'gift' : 'intelligence',
              content: desc,
              sentTurn: turn, deliveryTurn: turn,
              _sentDay: _nowD1, _deliveryDay: _nowD1, _travelDays: 0,
              status: 'delivered', urgency: 'normal',
              _npcInitiated: true, _replyExpected: it.type !== 'gift_present',
              _playerRead: false, _sendMode: 'multi_courier'
            });
          } else if (it.type === 'frame_up' || it.type === 'betray') {
            // 构陷/背叛 → 奏疏(警报) + 起居注
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: '有司', type: '警报', subtype: '密折',
              title: actor + (it.type==='betray'?'似有不臣之心':'恐有构陷之谋'),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          }
          // 所有对玩家的 NPC 行为也记起居注
          if (GM.qijuHistory) {
            GM.qijuHistory.unshift({
              turn: turn, date: date,
              content: '【' + typeInfo + '】' + actor + '→陛下' + (desc ? '：' + desc : ''),
              category: '对上'
            });
          }
        }

        // 处理势力深度互动
        if (p1.faction_interactions_advanced && Array.isArray(p1.faction_interactions_advanced) && p1.faction_interactions_advanced.length > 0) {
          var _pFac = (P.playerInfo && P.playerInfo.factionName) || '';
          p1.faction_interactions_advanced.forEach(function(it) {
            if (!it || !it.type || !it.from || !it.to) return;
            // ── 玩家势力保护：from=玩家势力的主动宣战/结盟/毁约等一律过滤——这些只能由玩家诏令触发 ──
            var _playerInitiatedTypes = ['declare_war','sue_for_peace','form_confederation','break_confederation','trade_embargo','open_market','send_envoy','demand_tribute','pay_tribute','royal_marriage','send_hostage','cultural_exchange','spy_infiltration','assassin_dispatch','annex_vassal','recognize_independence','incite_rebellion','proxy_war'];
            if (_pFac && it.from === _pFac && _playerInitiatedTypes.indexOf(it.type) >= 0) {
              addEB('\u8FC7\u6EE4', 'AI 试图替玩家势力 ' + _pFac + ' autonomous 对外 ' + it.type + '，已过滤（须玩家诏令）');
              return;
            }
            if (typeof applyFactionInteraction !== 'function') return;
            var extra = {
              description: it.description || it.terms || '',
              viaProxy: it.viaProxy || '',
              action: it.action || '',
              treatyType: it.treatyType || '',
              terms: it.terms || '',
              until: it.until || null
            };
            var ok = applyFactionInteraction(it.from, it.to, it.type, extra);
            if (ok) {
              var typeInfo = (typeof FACTION_INTERACTION_TYPES !== 'undefined' && FACTION_INTERACTION_TYPES[it.type]) ? FACTION_INTERACTION_TYPES[it.type].label : it.type;
              addEB('\u52BF\u529B', it.from + '→' + it.to + ' ' + typeInfo + (it.description ? '：' + it.description : ''));
              // 公开势力互动 → 风闻录事（机密类除外）
              try {
                var _covertTypes = ['spy_infiltration','assassin_dispatch','incite_rebellion'];
                var _isCovert = _covertTypes.indexOf(it.type) >= 0;
                if (!_isCovert && typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  var _fwType = it.type === 'declare_war' ? '\u6218\u62A5'
                              : it.type === 'border_clash' ? '\u8FB9\u62A5'
                              : it.type === 'royal_marriage' ? '\u548C\u4EB2'
                              : it.type === 'send_hostage' ? '\u8D28\u5B50'
                              : it.type === 'demand_tribute' || it.type === 'pay_tribute' ? '\u671D\u8D21'
                              : it.type === 'open_market' || it.type === 'trade_embargo' ? '\u4E92\u5E02'
                              : it.type === 'form_confederation' || it.type === 'break_confederation' ? '\u76DF\u7EA6'
                              : it.type === 'send_envoy' ? '\u9063\u4F7F'
                              : it.type === 'cultural_exchange' || it.type === 'religious_mission' ? '\u4F7F\u8282'
                              : it.type === 'military_aid' || it.type === 'proxy_war' ? '\u519B\u60C5'
                              : it.type === 'pay_indemnity' ? '\u8D54\u6B3E'
                              : it.type === 'annex_vassal' || it.type === 'recognize_independence' ? '\u5916\u4EA4'
                              : it.type === 'gift_treasure' ? '\u8D60\u8D22'
                              : it.type === 'sue_for_peace' ? '\u8BF7\u548C'
                              : '\u98CE\u8BAE';
                  PhaseD.addFengwen({
                    type: _fwType,
                    text: it.from + '\u00B7' + typeInfo + '\u00B7' + it.to + (it.description ? '\u2014\u2014' + String(it.description).slice(0,60) : ''),
                    credibility: 0.85,
                    source: 'faction_public',
                    actors: [it.from, it.to],
                    turn: GM.turn
                  });
                }
              } catch(_fwErr){}
              // 联姻细节——写入角色数据
              if (it.type === 'royal_marriage' && it.marriageDetails) {
                addEB('\u548C\u4EB2', it.marriageDetails);
              }
              // 质子细节
              if (it.type === 'send_hostage' && it.hostageDetails) {
                addEB('\u8D28\u5B50', it.hostageDetails);
              }
              // 宣战——联动 activeWars + 编年
              if (it.type === 'declare_war') {
                if (GM.activeWars) GM.activeWars.push({ attacker: it.from, defender: it.to, startTurn: GM.turn, reason: it.reason || '', declared: true });
                if (!GM.biannianItems) GM.biannianItems = [];
                GM.biannianItems.unshift({
                  turn: GM.turn, startTurn: GM.turn,
                  date: typeof getTSText==='function'?getTSText(GM.turn):'',
                  title: it.from + ' 对 ' + it.to + ' 宣战',
                  content: it.description || (it.from + '向' + it.to + '下战书，两国开战。'),
                  duration: 1, importance: 'high', category: '军事'
                });
              }
              // ── 势力对玩家势力的分发 ──
              if (_pFac && it.to === _pFac) {
                _dispatchFactionActionToPlayer(it, typeInfo);
              }
            }
          });
        }

        // 辅助：他国势力对玩家势力的互动分发
        function _dispatchFactionActionToPlayer(it, typeInfo) {
          if (!GM) return;
          var from = it.from, desc = it.description || typeInfo;
          var turn = GM.turn;
          var date = typeof getTSText==='function'?getTSText(turn):'';
          // 外交类 → 鸿雁（国书）
          var diplomaticTypes = ['send_envoy','demand_tribute','pay_tribute','royal_marriage','send_hostage','sue_for_peace','form_confederation','break_confederation','cultural_exchange','religious_mission','gift_treasure','pay_indemnity','open_market','trade_embargo','recognize_independence'];
          if (diplomaticTypes.indexOf(it.type) >= 0) {
            if (!GM.letters) GM.letters = [];
            // R: 旧版缺 _npcInitiated/sentTurn/deliveryTurn·to 用"朝廷"与其它路径不一致·补齐
            var _capital2 = GM._capital || '京城';
            var _dpv2 = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
            var _nowD2 = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (turn-1)*_dpv2;
            GM.letters.push({
              id: 'letter_diplomatic_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: from, to: '玩家',
              fromLocation: from + '·使节', toLocation: _capital2,
              letterType: 'diplomatic',
              subtype: it.type,
              content: desc + (it.terms ? '\n条款：'+it.terms : '') + (it.tributeItems ? '\n贡物：'+it.tributeItems : ''),
              sentTurn: turn, deliveryTurn: turn,
              _sentDay: _nowD2, _deliveryDay: _nowD2, _travelDays: 0,
              status: 'delivered', urgency: 'normal',
              _npcInitiated: true, _replyExpected: true, _playerRead: false,
              _sendMode: 'multi_courier'
            });
            // 需要玩家回应的重大外交（和亲/索贡/请和/联盟）→ 问对待接见
            var requireResponseTypes = ['royal_marriage','demand_tribute','sue_for_peace','form_confederation','send_envoy'];
            if (requireResponseTypes.indexOf(it.type) >= 0) {
              if (!GM._pendingAudiences) GM._pendingAudiences = [];
              GM._pendingAudiences.push({
                name: from + '使节', reason: typeInfo + '——' + desc, turn: turn,
                isEnvoy: true, fromFaction: from, interactionType: it.type
              });
            }
          }
          // 军事类 → 编年（重大）+ 奏疏（边报）
          var militaryTypes = ['declare_war','border_clash','assassin_dispatch','incite_rebellion','proxy_war','spy_infiltration'];
          if (militaryTypes.indexOf(it.type) >= 0) {
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_border_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: '边军塘报', type: '边报', subtype: '公疏',
              title: from + ' ' + typeInfo,
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn,
              urgency: it.type === 'declare_war' ? 'extreme' : 'urgent'
            });
            // 宣战已在上方入编年；其余军事事件也入编年
            if (it.type !== 'declare_war') {
              if (!GM.biannianItems) GM.biannianItems = [];
              GM.biannianItems.unshift({
                turn: turn, startTurn: turn, date: date,
                title: from + ' ' + typeInfo,
                content: desc, duration: 1,
                importance: it.type === 'border_clash' ? 'high' : 'medium',
                category: '军事'
              });
            }
          }
          // 并吞/承认独立 → 编年
          if (it.type === 'annex_vassal' || it.type === 'recognize_independence') {
            if (!GM.biannianItems) GM.biannianItems = [];
            GM.biannianItems.unshift({
              turn: turn, startTurn: turn, date: date,
              title: it.type === 'annex_vassal' ? (from + '并吞' + it.to) : (from + '宣告独立'),
              content: desc, duration: 1, importance: 'high', category: '政治'
            });
          }
          // 所有对玩家势力的行为都入起居注
          if (GM.qijuHistory) {
            GM.qijuHistory.unshift({
              turn: turn, date: date,
              content: '【外藩】' + from + ' → 本朝：' + typeInfo + (desc ? '——' + desc.substring(0,80) : ''),
              category: '外交'
            });
          }
        }

        // 处理科技/民政解锁（AI可在推演中解锁科技或推行政策）
        if (p1.tech_civic_unlocks && Array.isArray(p1.tech_civic_unlocks)) {
          p1.tech_civic_unlocks.forEach(function(tu) {
            if (!tu.name) return;
            if (tu.type === 'tech') {
              var tech = GM.techTree ? GM.techTree.find(function(t) { return t.name === tu.name && !t.unlocked; }) : null;
              if (tech) {
                tech.unlocked = true;
                // 扣除费用（如果有）
                if (tech.costs && Array.isArray(tech.costs)) {
                  tech.costs.forEach(function(c) { if (c.variable && GM.vars[c.variable]) GM.vars[c.variable].value = Math.max(GM.vars[c.variable].min||0, GM.vars[c.variable].value - (c.amount||0)); });
                }
                // 应用效果
                if (tech.effect) {
                  Object.entries(tech.effect).forEach(function(e) { if (GM.vars[e[0]]) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value + (parseFloat(e[1])||0), GM.vars[e[0]].min||0, GM.vars[e[0]].max||9999); });
                }
                addEB('\u79D1\u6280', '\u89E3\u9501' + tu.name + (tu.reason ? '(' + tu.reason + ')' : ''));
              }
            } else if (tu.type === 'civic') {
              var civic = GM.civicTree ? GM.civicTree.find(function(c) { return c.name === tu.name && !c.adopted; }) : null;
              if (civic) {
                civic.adopted = true;
                if (civic.costs && Array.isArray(civic.costs)) {
                  civic.costs.forEach(function(c) { if (c.variable && GM.vars[c.variable]) GM.vars[c.variable].value = Math.max(GM.vars[c.variable].min||0, GM.vars[c.variable].value - (c.amount||0)); });
                }
                if (civic.effect) {
                  Object.entries(civic.effect).forEach(function(e) { if (GM.vars[e[0]]) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value + (parseFloat(e[1])||0), GM.vars[e[0]].min||0, GM.vars[e[0]].max||9999); });
                }
                addEB('\u6C11\u653F', '\u63A8\u884C' + tu.name + (tu.reason ? '(' + tu.reason + ')' : ''));
              }
            }
          });
        }

        // 4.1: 处理国策变更（AI可添加/废除国策）
        if (p1.policy_changes && Array.isArray(p1.policy_changes)) {
          if (!GM.customPolicies) GM.customPolicies = [];
          var _pTree = (P.mechanicsConfig && P.mechanicsConfig.policyTree) || [];
          p1.policy_changes.forEach(function(pc) {
            if (!pc.action || !pc.name) return;
            if (pc.action === 'add') {
              // 检查前置条件
              var pDef = _pTree.find(function(pt) { return pt.name === pc.name || pt.id === pc.name; });
              if (pDef && pDef.prerequisites && pDef.prerequisites.length > 0) {
                var allMet = pDef.prerequisites.every(function(pre) {
                  return GM.customPolicies.some(function(cp) { return cp.name === pre || cp.id === pre; });
                });
                if (!allMet) { addEB('国策', pc.name + '前置条件不满足，未能施行'); return; }
              }
              if (!GM.customPolicies.some(function(cp) { return cp.name === pc.name; })) {
                GM.customPolicies.push({ name: pc.name, id: pc.name, enactedTurn: GM.turn, reason: pc.reason || '' });
                addEB('国策', '施行新国策：' + pc.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                // NPC记忆：所有在朝NPC记住新国策
                if (typeof NpcMemorySystem !== 'undefined') {
                  (GM.chars || []).forEach(function(c) {
                    if (c.alive !== false && !c.isPlayer && c.officialTitle) {
                      NpcMemorySystem.remember(c.name, '朝廷推行新国策：' + pc.name, '平', 4);
                    }
                  });
                }
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('policy:enacted', { name: pc.name, reason: pc.reason });
              }
            } else if (pc.action === 'remove') {
              var _idx = GM.customPolicies.findIndex(function(cp) { return cp.name === pc.name || cp.id === pc.name; });
              if (_idx >= 0) {
                GM.customPolicies.splice(_idx, 1);
                addEB('国策', '废除国策：' + pc.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                // NPC记忆：在朝NPC记住国策废除
                if (typeof NpcMemorySystem !== 'undefined') {
                  (GM.chars || []).forEach(function(c) {
                    if (c.alive !== false && !c.isPlayer && c.officialTitle) {
                      NpcMemorySystem.remember(c.name, '朝廷废除国策：' + pc.name, '平', 4);
                    }
                  });
                }
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('policy:abolished', { name: pc.name, reason: pc.reason });
              }
            }
          });
          if (GM.customPolicies.length > 30) GM.customPolicies = GM.customPolicies.slice(-30);
        }

        // 2.4: 处理阴谋干预（AI可推进/破坏/中止阴谋）
        if (p1.scheme_actions && Array.isArray(p1.scheme_actions) && GM.activeSchemes) {
          p1.scheme_actions.forEach(function(sa) {
            if (!sa.schemeId && !sa.schemer) return;
            var scheme = GM.activeSchemes.find(function(s) {
              return (sa.schemeId && s.id === sa.schemeId) || (sa.schemer && s.schemer === sa.schemer && s.status === 'active');
            });
            if (!scheme) return;
            if (sa.action === 'advance') {
              var _advAmt = Math.abs(parseInt(sa.amount) || 20);
              scheme.progress = Math.min(100, scheme.progress + Math.min(_advAmt, 50));
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '被推进(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划推进顺利', '喜', 5, scheme.target);
            } else if (sa.action === 'disrupt') {
              var _disAmt = Math.abs(parseInt(sa.amount) || 30);
              scheme.progress = Math.max(0, scheme.progress - Math.min(_disAmt, 50));
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '受阻(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划受阻：' + (sa.reason || ''), '忧', 6, scheme.target);
            } else if (sa.action === 'abort') {
              scheme.status = 'failure';
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '被迫中止(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划被迫中止', '忧', 8, scheme.target);
            } else if (sa.action === 'expose') {
              scheme.status = 'exposed';
              scheme.discovered = true;
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '阴谋败露(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(scheme.schemer, '对' + scheme.target + '的' + scheme.typeName + '阴谋败露，身败名裂', '忧', 9, scheme.target);
                NpcMemorySystem.remember(scheme.target, '识破了' + scheme.schemer + '的' + scheme.typeName + '阴谋', '怒', 8, scheme.schemer);
              }
              // 暴露的阴谋 → 风闻录事（高可信度公告）
              try {
                if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  PhaseD.addFengwen({
                    type: '\u63ED\u79C1',
                    text: scheme.schemer + '\u8C0B\u5BB3 ' + scheme.target + ' \u4E4B\u4E8B\u8D25\u9732\u2014\u2014' + String(sa.reason||'').slice(0,60),
                    credibility: 0.9,
                    source: 'scheme_exposed',
                    actors: [scheme.schemer, scheme.target],
                    turn: GM.turn
                  });
                }
              } catch(_e){}
              // 同步更新 ChronicleTracker 条目（阴谋暴露后对玩家可见）
              try {
                if (typeof ChronicleTracker !== 'undefined' && scheme.id) {
                  var _ex = ChronicleTracker.findBySource('scheme', scheme.id);
                  if (_ex) {
                    ChronicleTracker.update(_ex.id, { hidden: false, currentStage: '\u5DF2\u66B4\u9732', result: sa.reason || '' });
                    ChronicleTracker.abort(_ex.id, '\u5DF2\u66B4\u9732');
                  }
                }
              } catch(_e){}
            }
          });
        }

        // 处理时间线/事件触发（统一处理timeline和events）
        if (p1.timeline_triggers && Array.isArray(p1.timeline_triggers)) {
          // 1. 查找时间线事件
          if (P.timeline) {
            var _allTL = [].concat(P.timeline.past||[]).concat(P.timeline.future||[]);
            p1.timeline_triggers.forEach(function(tt) {
              if (!tt.name) return;
              var evt = _allTL.find(function(t) { return (t.name === tt.name || t.event === tt.name) && !t.triggered; });
              if (evt) {
                evt.triggered = true;
                evt.triggeredTurn = GM.turn;
                evt.triggeredResult = tt.result || '';
                addEB('\u5386\u53F2\u8282\u70B9', evt.name + '\u5DF2\u53D1\u751F' + (tt.result ? '\uFF1A' + tt.result : ''));
                _dbg('[TimelineTrigger] ' + evt.name);
              }
            });
          }
          // 2. 也查找编辑器定义的事件（GM.events）
          if (GM.events && GM.events.length > 0) {
            p1.timeline_triggers.forEach(function(tt) {
              if (!tt.name) return;
              var gmEvt = GM.events.find(function(e) { return e.name === tt.name && !e.triggered; });
              if (gmEvt) {
                gmEvt.triggered = true;
                gmEvt.triggeredTurn = GM.turn;
                gmEvt.triggeredResult = tt.result || '';
                addEB('\u4E8B\u4EF6', gmEvt.name + '\u5DF2\u89E6\u53D1' + (tt.result ? '\uFF1A' + tt.result : ''));
                _dbg('[EventTrigger] ' + gmEvt.name);
                // 连锁事件：如果有chainNext，提示AI关注
                if (gmEvt.chainNext) {
                  addEB('\u8FDE\u9501', gmEvt.name + '\u89E6\u53D1\u540E\u5E94\u7EE7\u7EED\u5F15\u53D1: ' + gmEvt.chainNext);
                }
              }
            });
          }
        }
        // 1.1: 处理诏令执行反馈——支持跨回合长期诏令的追报+连锁效应累积
        if (p1.edict_feedback && Array.isArray(p1.edict_feedback) && GM._edictTracker) {
          p1.edict_feedback.forEach(function(ef) {
            if (!ef.content && !ef.edictId) return;
            var tracker = null;
            // Path 1: 按 edictId 精确匹配（AI 若遵循指示会填 edictId）
            if (ef.edictId) {
              tracker = GM._edictTracker.find(function(t) { return t.id === ef.edictId; });
            }
            // Path 2: 按 content 模糊匹配本回合 pending
            if (!tracker && ef.content) {
              tracker = GM._edictTracker.find(function(t) {
                return t.turn === GM.turn && t.status === 'pending' && t.content.indexOf(ef.content.slice(0, 10)) >= 0;
              });
            }
            // Path 3: 跨回合匹配·对前回合未收束诏令追报
            if (!tracker && ef.content) {
              tracker = GM._edictTracker.find(function(t) {
                return t.turn < GM.turn && (t.status==='executing'||t.status==='partial'||t.status==='obstructed'||t.status==='pending_delivery')
                  && t.content.indexOf(ef.content.slice(0, 10)) >= 0;
              });
            }
            // Path 4: 按类别匹配本回合 pending
            if (!tracker) {
              tracker = GM._edictTracker.find(function(t) { return t.turn === GM.turn && t.status === 'pending'; });
            }
            if (tracker) {
              // 远方诏令——信使未送达前强制pending_delivery
              if (tracker._remoteTargets && tracker._letterIds && tracker._letterIds.length > 0) {
                var _allDelivered = tracker._letterIds.every(function(lid) {
                  var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
                  return lt && (lt.status === 'delivered' || lt.status === 'returned' || lt.status === 'replying');
                });
                if (!_allDelivered) {
                  tracker.status = 'pending_delivery';
                  tracker.feedback = ef.feedback || '信使尚在途中，目标NPC未收到诏令';
                  tracker.progressPercent = 0;
                  return;
                }
              }
              // 旧回合追报·连锁效应累积（不覆盖·累加）
              if (tracker.turn < GM.turn) {
                if (!tracker._chainEffects) tracker._chainEffects = [];
                tracker._chainEffects.push({
                  turn: GM.turn, status: ef.status || 'executing',
                  effect: ef.feedback || ef.content || '',
                  progress: parseInt(ef.progressPercent) || tracker.progressPercent || 0
                });
                // 累积进度·不倒退
                var newProg = parseInt(ef.progressPercent) || 0;
                if (newProg > (tracker.progressPercent || 0)) tracker.progressPercent = newProg;
                tracker.status = ef.status || tracker.status;
                tracker.feedback = ef.feedback || tracker.feedback;
              } else {
                // 本回合新诏令·初次设置
                tracker.status = ef.status || 'executing';
                tracker.assignee = ef.assignee || tracker.assignee || '';
                tracker.feedback = ef.feedback || '';
                tracker.progressPercent = parseInt(ef.progressPercent) || (ef.status === 'completed' ? 100 : 50);
              }
              // 受阻/完成推送到 eventBus 供 数值变化说明立即展示
              if (ef.status === 'obstructed') {
                addEB('\u8BCF\u4EE4\u53D7\u963B', tracker.category + '\uFF1A' + tracker.content.slice(0,40) + ' \u2014 ' + (ef.feedback || '\u6267\u884C\u53D7\u963B'));
              } else if (ef.status === 'completed') {
                addEB('\u8BCF\u4EE4\u529F\u6210', tracker.category + '\uFF1A' + tracker.content.slice(0,40) + ' \u2014 ' + (ef.feedback || '\u5DF2\u8F7D\u65BD\u884C'));
              } else if (ef.status === 'partial') {
                addEB('\u8BCF\u4EE4\u90E8\u884C', tracker.category + '\uFF1A' + tracker.content.slice(0,40) + ' \u2014 ' + (ef.feedback || '\u90E8\u5206\u6267\u884C'));
              } else if (tracker.turn < GM.turn) {
                addEB('\u8BCF\u4EE4\u8FDB\u5C55', tracker.category + '\uFF1A' + tracker.content.slice(0,30) + ' \u8FDB\u5C55 ' + (tracker.progressPercent||0) + '% \u2014 ' + (ef.feedback || ''));
              }
            }
          });
        }
      }else{
        shizhengji="\u63A8\u6F14\u5B8C\u6210";
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
    _applied.chars = _applied.chars || {
      char_updates: p1 && Array.isArray(p1.char_updates) ? p1.char_updates.length : 0,
      character_deaths: p1 && Array.isArray(p1.character_deaths) ? p1.character_deaths.length : 0
    };
    _applied.factions = _applied.factions || {
      faction_changes: p1 && Array.isArray(p1.faction_changes) ? p1.faction_changes.length : 0,
      faction_events: p1 && Array.isArray(p1.faction_events) ? p1.faction_events.length : 0,
      faction_relation_changes: p1 && Array.isArray(p1.faction_relation_changes) ? p1.faction_relation_changes.length : 0
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

  function _tmNpcLedger() {
    return global.TM && global.TM.NPC && global.TM.NPC.ActionLedger ? global.TM.NPC.ActionLedger : null;
  }
  function _tmNpcLedgerPreflight(raw, label) {
    try {
      var L = _tmNpcLedger();
      if (!L || !L.preflight) return true;
      var pf = L.preflight(raw, global.GM);
      if (pf && !pf.ok) {
        if (typeof global.addEB === 'function') global.addEB('过滤', (label || 'AI NPC行动已阻止') + '：' + (raw.actor || raw.name || raw.from || '') + '·' + (pf.errors || []).join('/'));
        return false;
      }
    } catch(_npcLedgerPreflightErr) {}
    return true;
  }
  function _tmNpcLedgerRecord(raw) {
    try {
      var L = _tmNpcLedger();
      if (L && L.record) L.record(raw, { markHandled: true });
    } catch(_npcLedgerRecordErr) {}
  }

})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

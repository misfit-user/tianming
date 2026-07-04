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
// ── 章节导航（§ 锚点；跳转请 grep 小节标题，行号会随改动漂移）──
//   入口  TM.Endturn.AI.apply.writeBack(ctx) —— endturn sc1 的回写主体，按下列顺序写回 GM
//   §1 忠诚/基础   adjustCharacterLoyalty · setCharacterLoyalty · ensureGroups
//   §2 玩家保护     grep「玩家保护」—— 禁 AI 改玩家角色的立场/党派/官职/势力外交
//   §3 势力机制     势力自治事件 · 机械系统自动路由 · 势力间关系变化
//   §4 党派演进     党派议程演进 · 党派分裂 · 党派合流 · 党派新建/覆灭
//   §5 问对承诺     问对承诺进展更新
//   §6 起义生命周期 起义前兆 → 爆发 → 进展 → 镇压/招安 → 转化（建政/编入/改朝）
//   §7 实体增减     势力新建/覆灭 · 阶层兴起/消亡 · 势力关系动态变化 · 势力继承
//   §8 议题/军事    _ty3_applyAIReissueTopics（重发议题）· applyAIArmyChange（军事变更）
//   §9 著作效果     按动机应用差异化效果（grep「按动机应用差异化效果」）
//   §10 autonomous  NPC 自主互动：名望/贤能涨跌 · 当事人记忆 · 对玩家分发 · 风闻录事
//   §11 官职/账本   官职位移辅助(_tmFindOfficePosition…) · NPC 账本(_tmNpcLedger…) · addEB
// ============================================================
(function(global) {

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

  // ── NPC 行为类型→中文动词(供记忆/事件文案·复用 prompt 既有标签·防英文 behaviorType 漏进中文叙事·2026-06-13) ──
  var _NPC_BEHAVIOR_CN = { appoint:'任用', dismiss:'罢黜', declare_war:'宣战', reward:'赏赐', punish:'惩处', request_loyalty:'拉拢', reform:'推行新政', betray:'背叛', conspire:'密谋串联', petition:'进谏', investigate:'查劾', impeach:'弹劾', obstruct:'阻挠', slander:'中伤', reconcile:'和解', mentor:'提携', train_troops:'操练', fortify:'整饬城防', patrol:'巡防', flee:'出逃', retire:'告老', travel:'游历', develop:'兴修', donate:'捐输', hoard:'囤积', smuggle:'走私', suppress:'镇压', petition_jointly:'联名上书', recruit:'招募', study:'查访', recommend:'举荐', confront:'对质', mediate:'调和', frame_up:'构陷', expose_secret:'揭发', share_intelligence:'通风报信', guarantee:'担保', gift_present:'馈赠', private_visit:'私访', invite_banquet:'宴请', correspond_secret:'通密信', form_clique:'结党', marriage_alliance:'联姻', master_disciple:'收徒', duel_poetry:'诗文唱和', mourn_together:'共哀', mourn:'致哀', rival_compete:'争胜', obey:'听命', desert:'哗变' };
  function _npcBehaviorVerbCN(bt) {
    var k = String(bt == null ? '' : bt).toLowerCase().trim();
    if (_NPC_BEHAVIOR_CN[k]) return _NPC_BEHAVIOR_CN[k];
    return /[a-z]/i.test(k) ? '处置' : (bt || '处置'); // 未知英文型→中性词·绝不漏英文;已中文则原样
  }
  // 暴露 NPC 行为中文译名为单一真源（朝野动态 feed 等只读消费方复用·勿在别处复制此表）
  try { global.TM = global.TM || {}; global.TM.NPC = global.TM.NPC || {}; if (typeof global.TM.NPC.behaviorVerbCN !== 'function') global.TM.NPC.behaviorVerbCN = _npcBehaviorVerbCN; } catch (_e) {}
  // ── 诏令类型 key→中文(未知/英文键则隐去括注·绝不显原始英文键) ──
  var _EDICT_TYPE_CN = { political:'朝政', policy:'朝政', personnel:'人事', military:'军务', military_order:'军务', military_reform:'军改', diplomatic:'外交', diplomacy:'外交', finance:'财赋', fiscal:'财赋', economy:'财赋', economic:'财赋', taxation:'赋税', agriculture:'农政', education:'教化', culture:'文教', education_culture:'文教', religion:'礼制', justice:'刑名', law:'律令', province:'地方', province_policy:'地方', social:'民生', minsheng:'民生', other:'其他' };
  function _edictTypeCN(et) {
    var k = String(et == null ? '' : et).toLowerCase().trim();
    if (!k) return '';
    if (_EDICT_TYPE_CN[k]) return '（' + _EDICT_TYPE_CN[k] + '）';
    return /[a-z]/i.test(k) ? '' : '（' + et + '）'; // 英文键隐去·中文键保留
  }
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
  function _tmAppendUniqueText(base, extra) {
    base = (typeof base === "string") ? base.trim() : "";
    extra = (typeof extra === "string") ? extra.trim() : "";
    if (!extra) return base;
    if (!base) return extra;
    if (base.indexOf(extra) >= 0) return base;
    return base + "\n\n" + extra;
  }
  // W2a 双算硬护栏谓词（抽出·可单测真代码）：会战 reactor 本回合(容 1 拍·覆盖 GM.turn++ 在 ai/post-turn 之间
  //   的边界)已负扣的 loser，AI 再负扣 strength_delta 即双算 → 返 0 拦截；正向/未结算/超 1 拍 原样返回。
  function _tmGuardBattleStrengthDelta(G, facName, sd) {
    if (!(sd < 0) || !G || !Array.isArray(G._battleSettledFactions) || !facName) return sd;
    var hit = G._battleSettledFactions.some(function(b){ var _dt = (G.turn||0) - (b && b.turn || 0); return b && b.faction === facName && _dt >= 0 && _dt <= 1 && (b.strengthDelta||0) < 0; });
    return hit ? 0 : sd;
  }
  ns.guardBattleStrengthDelta = _tmGuardBattleStrengthDelta;   // 暴露供单测真代码（smoke-w2a-doublecount-guard）
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
            var _applyRes1 = applyAITurnChanges({
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
              faction_updates: Array.isArray(p1.faction_updates) ? p1.faction_updates : [],
              party_updates: Array.isArray(p1.party_updates) ? p1.party_updates : [],
              // 兜底：AI 常只写 personnel_changes (展示用) 而不写 office_assignments — applier 里做备胎消费
              personnel_changes: Array.isArray(p1.personnel_changes) ? p1.personnel_changes : [],
              // 问天 directive 合规回报
              directive_compliance: Array.isArray(p1.directive_compliance) ? p1.directive_compliance : [],
              regent_decisions: Array.isArray(p1.regent_decisions) ? p1.regent_decisions : []
            });
            _surfaceUnappliedChanges(_applyRes1, 'sc1主应用');  // 【落地核对】接住失败清单·让静默 #1 可见
          }
        } catch(_applyErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_applyErr, 'endturn] applyAITurnChanges:') : console.warn('[endturn] applyAITurnChanges:', _applyErr); }

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
                try { var _nm = String(_niyiRaw).match(/\[[\s\S]*\]/); if (_nm) _niyiArr = JSON.parse(_nm[0]); } catch(_nje) {}
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
                try { var _zm = String(_zsRaw).match(/\[[\s\S]*\]/); if (_zm) _zsArr = JSON.parse(_zm[0]); } catch (_zje) {}
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
                GM._conspiracies.push({ turn: GM.turn||0, action: _action, instigator: e.instigator, target: e.target||'', outcome: _outcome, conspirators: e.conspirators||[], reason: e.reason||'', _autoFromReconcile: true, _qamGated: _qamGated || undefined });
                // 主谋通常应受惩·登记 NPC 状态（被门降级的得逞→按未遂同样下狱）
                var inst = (GM.chars||[]).find(function(c){return c && c.name === e.instigator;});
                if (inst && (_outcome === 'suppressed' || _action === 'plot_failed' || _action === 'coup_failed')) {
                  inst._imprisoned = true;
                  inst._conspiracyConvicted = true;
inst._imprisonedTurn = GM.turn||0;
                  inst._imprisonReason = '谋逆事发·下诏狱待勘';
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: '_conspiracies', label: '谋反·' + e.instigator + '·' + _action + '/' + _outcome, delta: 1, reason: e.reason || '一致性补录' });
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
        try {
          if (global.TM && global.TM.FactionAiMainloopBridge && typeof global.TM.FactionAiMainloopBridge.applyTurnOutcomes === 'function') {
            var _faiBridge = global.TM.FactionAiMainloopBridge.applyTurnOutcomes(GM, p1, { source: 'sc1-writeback' });
            if (_faiBridge && _faiBridge.shizhengjiAppend) {
              shizhengji = _tmAppendUniqueText(shizhengji, _faiBridge.shizhengjiAppend);
              p1.shizhengji = shizhengji;
            }
            if (_faiBridge && _faiBridge.hourenAppend) {
              hourenXishuo = _tmAppendUniqueText(hourenXishuo, _faiBridge.hourenAppend);
              p1.houren_xishuo = _tmAppendUniqueText(p1.houren_xishuo || p1.hourenXishuo || '', _faiBridge.hourenAppend);
              p1.hourenXishuo = p1.houren_xishuo;
            }
          }
        } catch(_faiBridgeE) { try { console.warn('[faction-ai-mainloop] apply failed', _faiBridgeE); } catch(_) {} }
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

            // 官制活化 ④B·npc_action → 履职反哺（开 officeDutyStateEnabled·官的本回合行止定性回调其履职度·与才五常基线漂移叠加·关则零回归）
            try {
              if (typeof officeFlagOn === 'function' && officeFlagOn('officeDutyStateEnabled') && typeof applyNpcActionToDuty === 'function') {
                var _dutyBack = applyNpcActionToDuty(GM, act);
                if (_dutyBack && typeof addEB === 'function') addEB('官制', '履职随行·' + _dutyBack.dept + _dutyBack.pos + '(' + _dutyBack.holder + ')因本回合行止·履职' + (_dutyBack.delta > 0 ? '+' : '') + _dutyBack.delta + '→' + _dutyBack.fulfillment);
              }
            } catch (_dutyBackE) {}

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
                  NpcMemorySystem.remember(act.target, act.name + '暗中拉拢示好', '平', 6, act.name);  // ★5→6 被拉拢方知情记忆过推演门槛
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
                if (act.target) NpcMemorySystem.remember(act.target, act.name + '来联络密事', '平', 6, act.name);  // ★5→6 被联络方知情记忆过推演门槛
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
                else if (act.behaviorType === 'fortify') { _armyMatch.morale = Math.min(100, (_armyMatch.morale||50) + 2); _armyMatch.fortification = Math.min(100, (Number(_armyMatch.fortification) || 0) + 5); }
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
            } else if (act.behaviorType === 'gift_present' || act.behaviorType === 'invite_banquet' || act.behaviorType === 'private_visit' || act.behaviorType === 'correspond_secret' || act.behaviorType === 'share_intelligence' || act.behaviorType === 'duel_poetry' || act.behaviorType === 'mourn_together' || act.behaviorType === 'mourn' || act.behaviorType === 'master_disciple' || act.behaviorType === 'guarantee' || act.behaviorType === 'obey') {
              // 社交结好——馈赠/宴请/私访/密信/通风报信/唱和/共哀/师徒/担保/听命:增进亲疏(软纽带·不碰编制/兵额)
              if (act.target && typeof AffinityMap !== 'undefined') {
                var _bondTbl = { master_disciple: 12, guarantee: 8, gift_present: 6, invite_banquet: 6, private_visit: 6, correspond_secret: 6, share_intelligence: 6, duel_poetry: 5, mourn_together: 5, mourn: 5, obey: 5 };
                var _bd = _bondTbl[act.behaviorType] || 5;
                // ★2026-07-04 AffinityMap 是对称无向图(key 按名排序)·此前调两次(A→B _bd + B→A 0.6×)落同一条边叠成 1.6×·系"以为有向"之误。单次即双向。
                AffinityMap.add(act.name, act.target, _bd, _npcBehaviorVerbCN(act.behaviorType));
                if (act.behaviorType === 'master_disciple' || act.behaviorType === 'guarantee' || act.behaviorType === 'obey') {
                  var _bondCh = findCharByName(act.behaviorType === 'obey' ? act.name : act.target);
                  if (_bondCh && typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_bondCh, act.behaviorType === 'master_disciple' ? 3 : 2, _npcBehaviorVerbCN(act.behaviorType), { source: 'npc-action-bond' });
                }
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'frame_up' || act.behaviorType === 'expose_secret') {
              // 构陷/揭发——重于中伤:损忠诚/加压力/掉面子/亲疏崩
              if (act.target) {
                var _fuCh = findCharByName(act.target);
                if (_fuCh) {
                  if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_fuCh, -6, (act.name || 'NPC') + _npcBehaviorVerbCN(act.behaviorType), { source: 'npc-action-frameup' });
                  _fuCh.stress = Math.min(100, (_fuCh.stress || 0) + 12);
                  if (typeof FaceSystem !== 'undefined') FaceSystem.loseFace(_fuCh, 12, act.name + _npcBehaviorVerbCN(act.behaviorType));
                }
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -15, '被' + _npcBehaviorVerbCN(act.behaviorType));
                if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(act.target, '遭' + act.name + _npcBehaviorVerbCN(act.behaviorType), '怒', 7, act.name);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'confront' || act.behaviorType === 'rival_compete') {
              // 对质/争胜——双向交恶·各添压力
              if (act.target) {
                if (typeof AffinityMap !== 'undefined') { AffinityMap.add(act.name, act.target, -8, _npcBehaviorVerbCN(act.behaviorType)); }  // ★对称图·单次即双向交恶(原调两次叠成 -16)
                var _cfCh = findCharByName(act.target);
                if (_cfCh) _cfCh.stress = Math.min(100, (_cfCh.stress || 0) + 5);
                var _cfSelf = findCharByName(act.name);
                if (_cfSelf) _cfSelf.stress = Math.min(100, (_cfSelf.stress || 0) + 3);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'impeach' || act.behaviorType === 'petition_jointly') {
              // 弹劾/联名上书——同 investigate:被劾者加压·亲疏降
              if (act.target) {
                var _imCh = findCharByName(act.target);
                if (_imCh) _imCh.stress = Math.min(100, (_imCh.stress || 0) + 8);
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, -8, _npcBehaviorVerbCN(act.behaviorType));
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'form_clique' || act.behaviorType === 'marriage_alliance') {
              // 结党/联姻——缔结强纽带(软亲疏·派系归属仍走 faction_updates·此处不动编册)
              if (act.target && typeof AffinityMap !== 'undefined') {
                var _alD = act.behaviorType === 'marriage_alliance' ? 15 : 10;
                AffinityMap.add(act.name, act.target, _alD, _npcBehaviorVerbCN(act.behaviorType));  // ★对称图·单次即双向缔结(原调两次叠成 2×)
                if (act.behaviorType === 'marriage_alliance') {
                  var _maCh = findCharByName(act.target);
                  if (_maCh && typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_maCh, 3, '联姻之好', { source: 'npc-action-marriage' });
                }
                if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(act.target, act.name + '与己' + _npcBehaviorVerbCN(act.behaviorType), '平', 6, act.name);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'recommend') {
              // 举荐——被荐者感念举主(亲疏+)·记一笔(擢用仍由铨政/功名系统定夺·此处只记人情)
              if (act.target) {
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 8, '荐拔之恩');
                if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(act.target, act.name + '举荐提携', '喜', 6, act.name);  // ★5→6 被荐者感念记忆过推演门槛
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'mediate') {
              // 调和——居中转圜·弱化版和解(亲疏+)
              if (act.target && typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, 6, '居中调和');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'recruit' || act.behaviorType === 'desert') {
              // 募兵/哗变——只动军队士气训练(软)·兵额由 army_changes 权威通道结算·此处不重复计
              var _milMatch = (GM.armies||[]).find(function(a){return !a.destroyed && (a.commander === act.name || (act.target && a.name === act.target));});
              if (_milMatch) {
                if (act.behaviorType === 'recruit') { _milMatch.morale = Math.min(100, (_milMatch.morale||50) + 3); }
                else { _milMatch.morale = Math.max(0, (_milMatch.morale||50) - 6); _milMatch.training = Math.max(0, (_milMatch.training||50) - 5); }
              }
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
              // ★2026-07-04 交互双向性·公开互动当事人(B)的知情记忆(B视角措辞+正确情绪)·imp6 过 <npc-hearts> 推演门槛(impMin6-8)·
              //   治「B 该知情却在朝议/问对/推演失忆穿帮」。此前 B 只拿到自动镜像的 imp4(且情绪被 flipMap 翻成中性)→取不到。
              //   排除:covert(slander/frame_up/expose_secret/betray·被算计者不该/已按知情边界另处理)与
              //   已显式强双写者(request_loyalty/conspire/recommend→下方5→6·form_clique/marriage_alliance imp6)。
              var _bKnow = {
                appoint:['受'+act.name+'擢任','喜'], dismiss:['遭'+act.name+'罢黜','怒'],
                reward:['蒙'+act.name+'赏赐','喜'], punish:['受'+act.name+'惩处','怒'],
                declare_war:['遭'+act.name+'宣战','惧'],
                petition:['遭'+act.name+'上疏参劾','怒'], investigate:['遭'+act.name+'弹劾查勘','惧'],
                impeach:['遭'+act.name+'弹劾','怒'], petition_jointly:['遭'+act.name+'联名参劾','怒'],
                reconcile:['与'+act.name+'冰释前嫌','喜'], mentor:['蒙'+act.name+'提携','敬'],
                mediate:[act.name+'居中调和','平'], confront:['与'+act.name+'当廷对质','怒'],
                rival_compete:['与'+act.name+'争锋','怒'],
                gift_present:['受'+act.name+'馈赠','喜'], invite_banquet:['受'+act.name+'宴请','喜'],
                private_visit:['受'+act.name+'登门私访','喜'], duel_poetry:['与'+act.name+'诗文唱和','喜'],
                mourn_together:['与'+act.name+'共哀','平'], mourn:['受'+act.name+'吊唁','平'],
                master_disciple:['与'+act.name+'结师徒之谊','敬'], guarantee:['蒙'+act.name+'担保','敬'],
                obey:[act.name+'听命归附','平'],
                correspond_secret:['与'+act.name+'密信往还','平'], share_intelligence:['得'+act.name+'通风报信','平']
              };
              var _hasBKnow = !!(act.target && act.target !== act.name && _bKnow[act.behaviorType]);
              // ★covert(诽谤/背叛/构陷/揭发)的 actor 记忆也须 _noMirror·否则通用镜像会把 imp4 泄露给被算计者(codex 审)。
              //   slander 由此真正单向(被中伤者不自动知情);betray/frame_up/expose_secret 的"受害者会发现"由各自 branch 显式 target 写(imp7/8)保留·此处只去掉冗余镜像。
              var _isCovert = act.behaviorType === 'slander' || act.behaviorType === 'betray' || act.behaviorType === 'frame_up' || act.behaviorType === 'expose_secret';
              // 行动者自己的记忆(显式写 B 或 covert 时关自动镜像)
              var _actEmo = (act.behaviorType === 'reward' || act.behaviorType === 'appoint') ? '喜' : (act.behaviorType === 'punish' || act.behaviorType === 'dismiss') ? '平' : (act.behaviorType === 'declare_war') ? '怒' : '平';
              NpcMemorySystem.remember(act.name, act.action, _actEmo, 5, act.target || '', (_hasBKnow || _isCovert) ? { _noMirror: true } : undefined);
              // 当事人(B)按 B 视角留一条 imp6 知情记忆
              if (_hasBKnow) {
                try { NpcMemorySystem.remember(act.target, _bKnow[act.behaviorType][0], _bKnow[act.behaviorType][1], 6, act.name, { _noMirror: true, source: 'witnessed', type: 'general' }); } catch(_bkE) {}
              }
              // 同势力同僚也会知道这件事（朝堂无秘密）
              if (act.target && GM.chars && (act.behaviorType === 'punish' || act.behaviorType === 'dismiss' || act.behaviorType === 'declare_war')) {
                var _actChar = findCharByName(act.name);
                if (_actChar && _actChar.faction) {
                  GM.chars.forEach(function(colleague) {
                    if (colleague.alive !== false && colleague.name !== act.name && colleague.name !== act.target && colleague.faction === _actChar.faction) {
                      NpcMemorySystem.remember(colleague.name, act.name + '对' + act.target + '施以' + _npcBehaviorVerbCN(act.behaviorType), '忧', 3, act.name);
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
                      NpcMemorySystem.remember(_rpn, act.target + '\u88AB' + act.name + _npcBehaviorVerbCN(act.behaviorType), _rpEmo, 4, act.name);
                      if (typeof AffinityMap !== 'undefined') AffinityMap.add(_rpn, act.name, _rpDelta, act.target + '\u88AB' + _npcBehaviorVerbCN(act.behaviorType));
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
            if (_nlCh.alive === false || _nlCh.dead) { _nlSkipMissing++; return; }
            if (_isSameLocation(_nlCh.location, _cap)) {
              // 在京 NPC 不应走鸿雁——但 AI 已生成内容·改投奏疏避免内容浪费
              _nlSkipCapital++;
              // 势力守卫(owner 2026-06)：奏疏=臣→君·仅本朝臣子可转奏疏。敌方/异势力角色(纵在京·如质子/降人/使节)不上奏疏给玩家。
              if (typeof _memSameFactionAsPlayer === 'function' && !_memSameFactionAsPlayer(_nlCh)) {
                _dbg('[npc_letters] 在京NPC ' + nl.from + ' 非本朝(' + (_nlCh.faction||'?') + ')·不转奏疏'); return;
              }
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
            var _ncF = findCharByName(nc.from), _ncT = findCharByName(nc.to);
            if ((_ncF && (_ncF.alive === false || _ncF.dead)) || (_ncT && (_ncT.alive === false || _ncT.dead))) return; // 死者不参与密信
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
            var _rawA = ac.a, _rawB = ac.b;
            if (typeof canonicalizeCharName === 'function') {
              try {
                ac.a = canonicalizeCharName(ac.a) || ac.a;
                ac.b = canonicalizeCharName(ac.b) || ac.b;
              } catch (_) {}
            }
            if (ac.a !== _rawA && !ac.raw_a) ac.raw_a = _rawA;
            if (ac.b !== _rawB && !ac.raw_b) ac.raw_b = _rawB;
            if (ac.a === ac.b) return;
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
              if (GM._foreshadowings.length > 250) {
                var _fsKeep = GM._foreshadowings.filter(function(f){ return f && !f.resolved; });
                var _fsRes = GM._foreshadowings.filter(function(f){ return f && f.resolved; });
                GM._foreshadowings = _fsKeep.concat(_fsRes.slice(-60));
              }
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
                var existWords = new Set(existing.content.replace(/[，。、！？\s]/g, '').split(''));
                keywords.forEach(function(ch) { if (existWords.has(ch)) score++; });
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
          function _normalizeIssueUpdate(iu, existing) {
            if (typeof TM !== 'undefined' && TM.MemoryIssueGovernance && typeof TM.MemoryIssueGovernance.normalizeIssueUpdate === 'function') {
              return TM.MemoryIssueGovernance.normalizeIssueUpdate(iu, GM, existing);
            }
            var _ev = Array.isArray(iu.evidenceRefs) ? iu.evidenceRefs.slice(0, 8) : [];
            var _hasEv = _ev.length > 0;
            var _conf = typeof iu.confidence === 'number' ? Math.max(0, Math.min(1, iu.confidence)) : (_hasEv ? 0.55 : 0.4);
            return {
              sourceType: iu.sourceType || (existing && existing.sourceType) || 'ai_analysis',
              authorityLevel: _hasEv ? (iu.authorityLevel || (existing && existing.authorityLevel) || 'ai_analysis') : 'ai_analysis',
              confidence: _hasEv ? _conf : Math.min(_conf, 0.45),
              evidenceRefs: _ev,
              basisRefs: _ev,
              generatedBy: iu.generatedBy || (existing && existing.generatedBy) || 'sc1.current_issues_update',
              factStatus: _hasEv ? (iu.factStatus || (existing && existing.factStatus) || 'advisory') : 'advisory_unverified'
            };
          }
          function _recordIssueEdge(edge) {
            if (typeof TM !== 'undefined' && TM.MemoryIssueGovernance && typeof TM.MemoryIssueGovernance.recordIssueEdge === 'function') {
              return TM.MemoryIssueGovernance.recordIssueEdge(GM, edge);
            }
            return null;
          }
          p1.current_issues_update.forEach(function(iu) {
            if (!iu.action) return;
            if (iu.action === 'add' && iu.title) {
              var _issueMeta = _normalizeIssueUpdate(iu, null);
              var newIssue = {
                id: 'issue_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                title: iu.title,
                category: iu.category || '',
                description: iu.description || '',
                status: 'pending',
                raisedTurn: GM.turn,
                raisedDate: typeof getTSText === 'function' ? getTSText(GM.turn) : '',
                sourceType: _issueMeta.sourceType,
                authorityLevel: _issueMeta.authorityLevel,
                confidence: _issueMeta.confidence,
                evidenceRefs: _issueMeta.evidenceRefs,
                basisRefs: _issueMeta.basisRefs,
                generatedBy: _issueMeta.generatedBy,
                factStatus: _issueMeta.factStatus
              };
              GM.currentIssues.push(newIssue);
              if (iu.supersedes || iu.replacesId) {
                _recordIssueEdge({ type: 'supersedes', src: newIssue.id, dst: iu.supersedes || iu.replacesId, reason: iu.reason || iu.edgeReason || 'current issue add' });
              }
              addEB('\u65F6\u5C40', '\u65B0\u8981\u52A1\uFF1A' + iu.title);
              _dbg('[Issues] add: ' + iu.title);
            } else if (iu.action === 'resolve' && iu.id) {
              var _ri = GM.currentIssues.find(function(i) { return i.id === iu.id && i.status === 'pending'; });
              if (_ri) {
                _ri.status = 'resolved';
                _ri.resolvedTurn = GM.turn;
                _ri.resolvedDate = typeof getTSText === 'function' ? getTSText(GM.turn) : '';
                _ri.factStatus = 'resolved_advisory';
                if (typeof TM !== 'undefined' && TM.MemoryIssueGovernance && typeof TM.MemoryIssueGovernance.createIssueResolutionEdge === 'function') TM.MemoryIssueGovernance.createIssueResolutionEdge(GM, iu.id, iu.id, GM.turn);
                else _recordIssueEdge({ type: 'supersedes', src: 'issue_resolution:' + iu.id, dst: 'strategic_issue:' + iu.id, reason: iu.reason || 'issue_resolution' });
                addEB('\u65F6\u5C40', '\u8981\u52A1\u89E3\u51B3\uFF1A' + _ri.title);
                _dbg('[Issues] resolve: ' + _ri.title);
              }
            } else if (iu.action === 'update' && iu.id) {
              var _ui = GM.currentIssues.find(function(i) { return i.id === iu.id; });
              if (_ui) {
                var _updatedMeta = _normalizeIssueUpdate(iu, _ui);
                if (iu.description) _ui.description = iu.description;
                if (iu.title) _ui.title = iu.title;
                if (iu.category) _ui.category = iu.category;
                _ui.sourceType = _updatedMeta.sourceType;
                _ui.authorityLevel = _updatedMeta.authorityLevel;
                _ui.confidence = _updatedMeta.confidence;
                if (Array.isArray(iu.evidenceRefs) || Array.isArray(iu.basisRefs) || !_ui.evidenceRefs || !_ui.evidenceRefs.length) _ui.evidenceRefs = _updatedMeta.evidenceRefs;
                _ui.basisRefs = _updatedMeta.basisRefs;
                if (iu.factStatus || !_ui.factStatus || _updatedMeta.factStatus === 'advisory_unverified') _ui.factStatus = _updatedMeta.factStatus;
                if (iu.supersedes || iu.replacesId) {
                  _recordIssueEdge({ type: 'supersedes', src: _ui.id, dst: iu.supersedes || iu.replacesId, reason: iu.reason || iu.edgeReason || 'current issue update' });
                }
                if (iu.contradicts) {
                  _recordIssueEdge({ type: 'contradicts', src: _ui.id, dst: iu.contradicts, reason: iu.reason || iu.edgeReason || 'current issue contradiction' });
                }
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
            if (_pregMother && (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(_pregMother) : _pregMother.spouse === true)) {
              HaremSettlement.registerPregnancy(_pregMother.name);
            }
          }
        }

        // 处理角色属性变化（AI直接调整个体角色忠诚/野心等）
        if (p1.char_updates && Array.isArray(p1.char_updates)) {
          var _pNameCU = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.char_updates.forEach(function(cu) {
            if (!cu.name) return;
            var _rawCuName = cu.name;
            if (typeof canonicalizeCharName === 'function') {
              try { cu.name = canonicalizeCharName(cu.name) || cu.name; } catch (_) {}
            }
            if (cu.name !== _rawCuName && !cu.raw_name) cu.raw_name = _rawCuName;
            var ch = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(cu.name) : null) || findCharByName(cu.name);
            if (!ch) return;
            // ── 玩家保护：玩家角色的决策字段(立场/党派/官职) 不允许 AI 修改 ──
            var _isPlayerTarget = (_pNameCU && (cu.name === _pNameCU || _rawCuName === _pNameCU)) || ch.isPlayer;
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
              var _sd = clamp(parseInt(fc.strength_delta)||0, -_strClamp, _strClamp);
              // W2a \u786C\u62A4\u680F\uFF1A\u672C\u56DE\u5408\u8BE5\u52BF\u529B\u5B9E\u529B\u5DF2\u7531\u4F1A\u6218 reactor \u7ED3\u7B97\uFF08_battleSettledFactions\u00B7prompt \u5DF2\u544A\u77E5\u300C\u519B\u52A1\u5DF2\u7ED3\u7B97\u00B7\u52FF\u91CD\u590D\u6263\u300D\uFF09\uFF0C
              //   AI \u82E5\u4ECD\u8D1F\u6263\u5176\u5B9E\u529B\u5373\u53CC\u7B97 \u2192 \u786C\u7F6E 0 \u62E6\u622A\u3002\u8F6F\u9632(prompt)+\u786C\u9632(\u6B64\u5904)\u53CC\u4FDD\u9669\u3002\u8C13\u8BCD\u62BD _tmGuardBattleStrengthDelta \u53EF\u5355\u6D4B\u3002
              var _sdG = _tmGuardBattleStrengthDelta(GM, fc.name, _sd);
              if (_sdG === 0 && _sd < 0) {
                try { addEB('\u52BF\u529B\u52A8\u6001', fc.name + '\u00B7\u672C\u56DE\u5408\u5B9E\u529B\u5DF2\u7531\u519B\u52A1\u7ED3\u7B97\u00B7\u62E6\u622A AI \u91CD\u590D\u6263' + _sd + '\uFF08\u9632\u53CC\u7B97\uFF09'); } catch(_wgd){}
              }
              _sd = _sdG;
              if (_sd !== 0) {
                fac.strength = clamp(oldS + _sd, 0, 100);
                recordChange('factions', fc.name, 'strength', oldS, fac.strength, fc.reason || 'AI\u63A8\u6F14');
              }
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
                var _divFort = 0;
                try { // 2026-06-12: 建筑工役引擎写的 division.fortLevel（城墙/敌台完工档位）进围城读链
                  if (P.adminHierarchy) Object.keys(P.adminHierarchy).forEach(function(_fk){
                    var _fh = P.adminHierarchy[_fk]; if (!_fh || !_fh.divisions) return;
                    (function _wk(_ds){ _ds.forEach(function(_d){
                      if (_d && _d.name === fe.target && _d.fortLevel > _divFort) _divFort = _d.fortLevel;
                      if (_d && _d.children) _wk(_d.children); if (_d && _d.divisions) _wk(_d.divisions);
                    }); })(_fh.divisions);
                  });
                } catch(_) {}
                var _siegeFort = fe.fortLevel || _geo.fortLevel || _divFort || (_siegeRegion ? (_siegeRegion.passLevel||0) : 2);
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
              // 党派近账+引擎账即时镜像（单源对账：AI 写的是 canonical，立刻同步 partyState 防漂移）
              try {
                var _psn = GM.partyState && GM.partyState[pc.name];
                if (_psn) {
                  if (!Array.isArray(_psn.historyLog)) _psn.historyLog = [];
                  _psn.historyLog.push({ turn: GM.turn, field: 'influence', delta: party.influence - oldI, reason: pc.reason || 'AI\u63A8\u6F14' });
                  if (_psn.historyLog.length > 16) _psn.historyLog = _psn.historyLog.slice(-16);
                  _psn.influence = party.influence;
                  _psn._synced_influence = party.influence;
                }
              } catch(_psSyncE) {}
            }
            if (pc.new_status) { party.status = pc.new_status; addEB('\u515A\u6D3E', pc.name + '\u72B6\u6001\u53D8\u4E3A' + pc.new_status); }
            if (pc.new_leader) { party.leader = pc.new_leader; addEB('\u515A\u6D3E', pc.name + '\u65B0\u9996\u9886:' + pc.new_leader); }
            if (pc.new_agenda) { party.currentAgenda = pc.new_agenda; party._agendaTurn = GM.turn; party._agendaSource = 'ai'; }
            if (pc.new_shortGoal) party.shortGoal = pc.new_shortGoal;
          });
        }

        // 党派结盟/交恶（2026-06-12 backlog）：对称写入双方 partyState 盟敌名册 + 近账
        if (p1.party_relation_changes && Array.isArray(p1.party_relation_changes)) {
          p1.party_relation_changes.forEach(function(prc) {
            if (!prc || !prc.party || !prc.target || !GM.partyState) return;
            var rel = String(prc.relation || '').toLowerCase();
            var relCn = (rel === 'ally' || rel === '\u76DF') ? '\u7ED3\u76DF' : (rel === 'rival' || rel === '\u654C') ? '\u4EA4\u6076' : '\u5F52\u5E73';
            function applyOne(selfName, otherName) {
              var ps = GM.partyState[selfName];
              if (!ps) return false;
              function arr(k) { if (!Array.isArray(ps[k])) ps[k] = []; return ps[k]; }
              function drop(k) { ps[k] = arr(k).filter(function(x) { return String(x) !== otherName; }); }
              if (relCn === '\u7ED3\u76DF') { drop('conflictWith'); if (arr('alliedWith').indexOf(otherName) < 0) ps.alliedWith.push(otherName); }
              else if (relCn === '\u4EA4\u6076') { drop('alliedWith'); if (arr('conflictWith').indexOf(otherName) < 0) ps.conflictWith.push(otherName); }
              else { drop('alliedWith'); drop('conflictWith'); }
              if (!Array.isArray(ps.historyLog)) ps.historyLog = [];
              ps.historyLog.push({ turn: GM.turn, field: 'relation', delta: 0, reason: relCn + '\u00B7' + otherName + (prc.reason ? '\u00B7' + String(prc.reason).slice(0, 40) : '') });
              if (ps.historyLog.length > 16) ps.historyLog = ps.historyLog.slice(-16);
              return true;
            }
            var ok1 = applyOne(String(prc.party), String(prc.target));
            applyOne(String(prc.target), String(prc.party));
            if (ok1) addEB('\u515A\u6D3E', String(prc.party) + '\u4E0E' + String(prc.target) + relCn + (prc.reason ? '\uFF1A' + String(prc.reason).slice(0, 40) : ''));
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
            (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(newChar);
            _spawnedCount++;
            addEB('\u5B98\u5236', '\u3010\u5B9E\u4F53\u5316\u3011' + sp.holderName + '\u5C31\u4EFB' + targetDept.name + sp.position + (sp.reason ? '\uFF08' + sp.reason + '\uFF09' : ''));
            if (GM.qijuHistory) {
              if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
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
            // 从 parties 中移除被吸收方（旧写法 `|| p.mergedWith` 对刚打标的被吸收方恒真=filter 空转·
            // 已解散党永久留在 parties 参与票权/列表·2026-07-04 审查定罪）
            GM.parties = GM.parties.filter(function(p){return p.name !== absd.name;});
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
            addEB('\u7EE7\u627F', '\u3010' + sc.faction + '\u3011' + (oldLeader||'?') + '\u2192' + sc.newLeader + '(' + ({forced_abdication:'逼宫禅位',contested_succession:'争立',usurpation:'篡位',coup:'政变夺位',regency:'摄政',peaceful:'平稳承袭'}[sc.disputeType]||sc.disputeType||'\u6B63\u5E38\u7EE7\u627F') + ')' + (sc.narrative ? '\uFF1A' + sc.narrative.slice(0,80) : ''));
            if (GM.qijuHistory) {
              if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u7EE7\u627F\u4E8B\u3011' + sc.faction + '\uFF1A' + sc.narrative, category: '\u52BF\u529B' });
            }
          });
        }

        // ★2026-07-01 W2b硬版·记忆确定性影响办事:信重之臣(对朕好感≥40且心绪不恶)判逾期时多给1回合宽限(benefit of the doubt)。
        //   仅正向(绝不缩短任何人的宽限=对谁都不会更严·安全无平衡风险)·点亮零调用的 getImpression/getMood·让记忆真正影响办事判定。
        var _tmCommitGrace = function(npcName){
          if (!npcName || typeof NpcMemorySystem === 'undefined') return 0;
          var _pn = (typeof P !== 'undefined' && P.playerInfo && P.playerInfo.characterName) || '';
          var _fv = (_pn && NpcMemorySystem.getImpression) ? NpcMemorySystem.getImpression(npcName, _pn) : 0;
          var _md = NpcMemorySystem.getMood ? NpcMemorySystem.getMood(npcName) : '';
          var _bad = (_md === '怒' || _md === '恨' || _md === '惧' || _md === '怨');
          return (_fv >= 40 && !_bad) ? 1 : 0;
        };

        // Codex修·MED:承诺履成的 canonical 结构化后果(query降腐败/intel入情报/finance提实征率)抽为共享·commitment_update 与 dialogue_commitment_feedback 两条完成路径都调·_canonFired 防双计。
        function _fireCommitCanon(found, foundNpc, _ckW, feedbackText) {
          if (!found || found._canonFired) return;
          if (found.category === 'query') {
            var _ckFE = (typeof FiscalEngine !== 'undefined' && FiscalEngine) || (typeof window !== 'undefined' && window.FiscalEngine) || null;
            if (_ckFE && typeof _ckFE.adjustPlayerDivisionCorruption === 'function') {
              var _ckPFac = (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.factionName) || '';
              var _ckCorrDrop = Math.max(2, Math.min(5, Math.round(2 * _ckW)));
              var _ckNDiv = _ckFE.adjustPlayerDivisionCorruption(_ckPFac, -_ckCorrDrop, 0, 100);
              if (_ckNDiv === 0) _ckFE.adjustPlayerDivisionCorruption('', -_ckCorrDrop, 0, 100); // 势力 key 对不上→不过滤兜底
              if (typeof addEB === 'function') addEB('问对·实绩', foundNpc + '查办履成·吏治浊度降' + _ckCorrDrop);
            }
          } else if (found.category === 'intel') {
            if (!Array.isArray(GM._interceptedIntel)) GM._interceptedIntel = [];
            GM._interceptedIntel.push({ turn: GM.turn, interceptor: foundNpc, from: '密查', to: '皇帝', content: '奉旨密查所得：' + String(found.task || '').slice(0,30) + (feedbackText ? '——' + String(feedbackText).slice(0,60) : ''), urgency: 'report' });
            if (GM._interceptedIntel.length > 40) GM._interceptedIntel.shift();
            if (typeof addEB === 'function') addEB('问对·实绩', foundNpc + '密查复命·情报入风闻');
          } else if (found.category === 'finance') {
            var _ckFE2 = (typeof FiscalEngine !== 'undefined' && FiscalEngine) || (typeof window !== 'undefined' && window.FiscalEngine) || null;
            if (_ckFE2 && typeof _ckFE2.adjustPlayerCompliance === 'function') {
              var _ckPFac2 = (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.factionName) || '';
              var _ckCompUp = Math.min(0.05, 0.02 * _ckW);
              var _ckNC = _ckFE2.adjustPlayerCompliance(_ckPFac2, _ckCompUp, 0.1, 1);
              if (_ckNC === 0) _ckFE2.adjustPlayerCompliance('', _ckCompUp, 0.1, 1); // 势力 key 对不上→不过滤兜底
              if (typeof addEB === 'function') addEB('问对·实绩', foundNpc + '理财履成·实征率升' + (Math.round(_ckCompUp*1000)/10) + '%');
            }
          }
          found._canonFired = true;
        }

        // ── 问对承诺进展更新 ──
        if (p1.commitment_update && Array.isArray(p1.commitment_update) && GM._npcCommitments) {
          var _commitmentUpdateSeen = {};
          p1.commitment_update.forEach(function(cu) {
            if (!cu || !cu.id) return;
            var _cuIdKey = String(cu.id);
            if (_commitmentUpdateSeen[_cuIdKey]) return;
            _commitmentUpdateSeen[_cuIdKey] = true;
            // 遍历找到对应承诺
            var found = null, foundNpc = null;
            Object.keys(GM._npcCommitments).forEach(function(nm) {
              (GM._npcCommitments[nm]||[]).forEach(function(c) {
                if (c.id === cu.id) { found = c; foundNpc = nm; }
              });
            });
            if (!found) return;
            if (found._terminalSettled && (found.status === 'completed' || found.status === 'failed' || found.status === 'obstructed')) return;
            // 若 AI 指定了 npcName 但与实际不符，以实际为准
            var npcActual = cu.npcName || foundNpc;
            found.progress = Math.max(0, Math.min(100, (found.progress||0) + (parseInt(cu.progress_delta,10)||0)));
            if (cu.status) found.status = cu.status;
            if (cu.feedback) found.feedback = cu.feedback;
            found.lastUpdateTurn = GM.turn;
            // 完成/失败处理
            var _ckW = ({dispatch:2.0,diplomacy:2.0,finance:1.8,intel:1.6,query:1.3,write:1.1,other:1.0})[found.category||'other']||1.0;
            var _ckWill = (typeof found.willingness === 'number') ? found.willingness : 0.6;
            if (found.status === 'completed' || found.consequenceType === 'success') {
              found.status = 'completed';
              found._terminalSettled = true;
              found._terminalSettledTurn = GM.turn;
              found._terminalSettledKind = 'completed';
              addEB('问对·履行', foundNpc + '享息：' + found.task.slice(0,30) + '——' + (cu.feedback||'').slice(0, 40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(foundNpc, '履命完成：' + found.task + '——' + (cu.feedback||''), '慰', Math.min(8, 4 + Math.round(_ckW)));
              var _cch = findCharByName(foundNpc);
              if (_cch) {
                _cch._promiseKept = (_cch._promiseKept || 0) + 1;   // P-commit-calib·累积履约(治『恩德不累积』同源)
                var _ckGain = Math.max(1, Math.min(8, Math.round(
                  ((cu.consequenceType === 'partial') ? 1.5 : 3) * _ckW          // 基础×category权重
                  + ((_ckWill < 0.4) ? 1.5 : 0)                                  // 勉强应承却办成→意外受信
                  + Math.min(2, (_cch._promiseKept - 1) * 0.5)                   // 屡次履约累积信任(封顶+2)
                )));
                if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_cch, _ckGain, '问对履命完成', { source:'wendui-task-completed' });
                else _cch.loyalty = Math.min(100, ((typeof _cch.loyalty === 'number' && isFinite(_cch.loyalty)) ? _cch.loyalty : 50) + _ckGain);
              }
              // P-commit-calib·(b-稳) 硬产出承诺履成→确定性结构化后果（canonical 通道·有界·prompt 已去重防双计）·Codex修·MED:抽为 _fireCommitCanon 两条完成路径共用
              _fireCommitCanon(found, foundNpc, _ckW, cu.feedback);
            } else if (found.status === 'failed' || cu.consequenceType === 'abandoned') {
              found.status = 'failed';
              found._terminalSettled = true;
              found._terminalSettledTurn = GM.turn;
              found._terminalSettledKind = 'npc_duty_failed';
              found._failReason = String(cu.failReason || '').slice(0, 12) || found._failReason || '';   // ★2026-07-01 打磨·结构化失败归因(供交办面板显「为何办砸」)
              found._loyaltyPenaltyBlocked = true;
              addEB('问对·失诺', foundNpc + '未履：' + found.task.slice(0,30) + '——' + (cu.feedback||'').slice(0,40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(foundNpc, '未履命：' + found.task + '——' + (cu.feedback||''), '忧', Math.min(8, 4 + Math.round(_ckW)));
              var _fch = findCharByName(foundNpc);
              if (_fch) {
                _fch._promiseBroken = (_fch._promiseBroken || 0) + 1;   // NPC 奉旨差事未闭环·只记履约信用，不视为玩家违约
                _fch._dutyFailures = (_fch._dutyFailures || 0) + 1;
                _fch._lastDutyFailureTurn = GM.turn;
                _fch.stress = Math.min(100, (_fch.stress||0) + Math.min(12, Math.round(5 * _ckW)));
              }
            } else if (cu.feedback) {
              addEB('问对·进展', foundNpc + '：' + (cu.feedback||'').slice(0,50));
            }
            // 写入起居注
            if (GM.qijuHistory && cu.feedback) {
              if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
                turn: GM.turn,
                date: typeof getTSText==='function'?getTSText(GM.turn):'',
                content: '【问对·履命】' + foundNpc + '就「' + found.task + '」：' + cu.feedback,
                category: '问对'
              });
            }
            // 完成/失败的承诺保留在 list 但状态终结；deadline 过期未完成自动标 failed
            if (found.status === 'pending' || found.status === 'executing' || found.status === 'delayed') {
              var elapsed = GM.turn - found.assignedTurn;
              if (elapsed > (found.deadline || 3) + 2 + _tmCommitGrace(foundNpc) && found.progress < 50) {
                found.status = 'failed';
                found._terminalSettled = true;
                found._terminalSettledTurn = GM.turn;
                found._terminalSettledKind = 'npc_duty_overdue';
                found._failReason = found._failReason || '迟延无果';   // ★打磨·确定性兜底归因
                found._loyaltyPenaltyBlocked = true;
                addEB('\u95EE\u5BF9\u00B7\u8FC7\u671F', foundNpc + '迟迟未办：' + found.task.slice(0,30));
              }
            }
          });
        }

        // P-commit-calib·静默失约兜底：NPC 奉旨差事过期(deadline+2)且进度<50 → 判未办成+记履约信用，不扣忠诚
        if (GM._npcCommitments && typeof GM._npcCommitments === 'object') {
          Object.keys(GM._npcCommitments).forEach(function(_swNm) {
            (GM._npcCommitments[_swNm] || []).forEach(function(_swC) {
              if (!_swC || _swC.status === 'completed' || _swC.status === 'failed' || _swC._terminalSettled) return;
              if (_swC.lastUpdateTurn === GM.turn) return;
              var _swEl = (GM.turn || 0) - (_swC.assignedTurn || GM.turn || 0);
              if (_swEl > ((_swC.deadline || 3) + 2 + _tmCommitGrace(_swNm)) && (_swC.progress || 0) < 50) {
                _swC.status = 'failed';
                _swC.lastUpdateTurn = GM.turn;
                _swC._terminalSettled = true;
                _swC._terminalSettledTurn = GM.turn;
                _swC._terminalSettledKind = 'npc_duty_lapsed';
                _swC._failReason = _swC._failReason || '搁置未办';   // ★打磨·确定性兜底归因
                _swC._loyaltyPenaltyBlocked = true;
                if (!_swC.feedback) _swC.feedback = '迟迟未办，无声搁置';
                var _swCh = findCharByName(_swNm);
                if (_swCh) {
                  var _swW = ({dispatch:2.0,diplomacy:2.0,finance:1.8,intel:1.6,query:1.3,write:1.1,other:1.0})[_swC.category||'other']||1.0;
                  _swCh._promiseBroken = (_swCh._promiseBroken || 0) + 1;
                  _swCh._dutyFailures = (_swCh._dutyFailures || 0) + 1;
                  _swCh._lastDutyFailureTurn = GM.turn;
                  _swCh.stress = Math.min(100, (_swCh.stress||0) + Math.min(10, Math.round(4 * _swW)));
                }
                if (typeof addEB === 'function') addEB('问对·搁置', _swNm + '搁置未办：' + String(_swC.task||'').slice(0,30));
              }
            });
          });
        }

        // #1·帝王治术 court-level 涟漪：本回合问对赏罚的集体后果（滥刑→在京群臣震恐离心·广恩→归心；有界封顶·经 canonical adjustCharacterLoyalty·prompt 已去重）
        if (GM._wdRewardPunish && Array.isArray(GM._wdRewardPunish)) {
          var _ccRp = GM._wdRewardPunish.filter(function(r){ return r && r.turn === GM.turn; });
          if (_ccRp.length) {
            var _ccHarsh = 0, _ccGrace = 0, _ccTargets = {};
            _ccRp.forEach(function(r){ _ccTargets[r.target] = true; if (r.type === 'reward') _ccGrace++; else _ccHarsh += (r.detail === 'imprison' ? 3 : (r.detail === 'cane' || r.detail === 'demote') ? 2 : 1); });
            var _ccDelta = 0, _ccStress = 0, _ccTag = '';
            if (_ccHarsh >= 3) { _ccDelta = -1; _ccStress = 3; _ccTag = '滥刑·群臣自危'; }
            else if (_ccGrace >= 2 && _ccHarsh === 0) { _ccDelta = 1; _ccStress = -2; _ccTag = '广恩·朝堂归心'; }
            if (_ccDelta !== 0) {
              var _ccN = 0;
              (GM.chars || []).forEach(function(c) {
                if (!c || c.isPlayer || c.alive === false || _ccTargets[c.name]) return;
                if (typeof _wdIsAtCapital === 'function' && !_wdIsAtCapital(c)) return;
                if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(c, _ccDelta, '帝王治术·' + _ccTag, { source:'wendui-court-conduct' });
                else c.loyalty = Math.max(0, Math.min(100, ((typeof c.loyalty === 'number') ? c.loyalty : 50) + _ccDelta));
                if (_ccStress) c.stress = Math.max(0, Math.min(100, (c.stress || 0) + _ccStress));
                _ccN++;
              });
              if (_ccN && typeof addEB === 'function') addEB('朝堂', '帝王治术（' + _ccTag + '）·在京 ' + _ccN + ' 员忠诚' + (_ccDelta > 0 ? '+' : '') + _ccDelta);
            }
          }
        }

        // ④ 朝堂噤声：本回合屡拒忠谏（拒见 warn 求见）→ 在京忠正之臣集体心灰、噤声自保（接 #1 帝王治术涟漪·只伤忠正者·谄佞本不谏）
        if (Array.isArray(GM._wdRefusedCounsel)) {
          var _rcThis = GM._wdRefusedCounsel.filter(function(r){ return r && r.turn === GM.turn; });
          if (_rcThis.length >= 2) {
            var _silN = 0;
            (GM.chars || []).forEach(function(c){
              if (!c || c.isPlayer || c.alive === false) return;
              if (typeof _wdIsAtCapital === 'function' && !_wdIsAtCapital(c)) return;
              if ((c.loyalty || 50) < 55) return;  // 只忠正之臣会因"进言无用"心灰
              if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(c, -1, '帝屡拒忠谏·群臣噤声自保', { source:'wendui-counsel-chill' });
              else c.loyalty = Math.max(0, Math.min(100, ((typeof c.loyalty === 'number') ? c.loyalty : 50) - 1));
              c.stress = Math.max(0, Math.min(100, (c.stress || 0) + 2));
              _silN++;
            });
            GM._courtSilenced = GM.turn;  // 噤声标记（供求见/进谏意愿参考）
            if (_silN && typeof addEB === 'function') addEB('朝堂', '帝屡拒忠谏（' + _rcThis.length + ' 起）·群臣噤声自保（在京 ' + _silN + ' 忠正之臣离心）');
          }
        }

        // Phase 2.5·dialogue_commitment_feedback apply (与 commitment_update 故意分离·source_conv_id 关联)
        // SC1 输出此字段·sc1q→SC1→apply 闭环·apply 时根据 source_conv_id 找对应 commit·非命中则新建 (sc1q-only commit)
        if (p1.dialogue_commitment_feedback && Array.isArray(p1.dialogue_commitment_feedback)) {
          if (!GM._npcCommitments || typeof GM._npcCommitments !== 'object') GM._npcCommitments = {};
          var _sc1qResults = (GM._turnAiResults && GM._turnAiResults.subcall1q) || {};
          var _sc1qCommits = Array.isArray(_sc1qResults.dialogue_commitments) ? _sc1qResults.dialogue_commitments : [];
          p1.dialogue_commitment_feedback.forEach(function(dcf) {
            if (!dcf || !dcf.npc) return;
            // 查匹配 sc1q commit (R-D dedup·source_conv_id 优先)
            var srcCommit = null;
            if (dcf.source_conv_id) {
              srcCommit = _sc1qCommits.find(function(c) { return c && c.source_conv_id === dcf.source_conv_id; });
            }
            // Codex修·MED:source_conv_id 未回带时按 npc+task 相似度兜底找回 sc1q commit(取回 category 触发结构化后果·防误落 dialogue)
            if (!srcCommit && dcf.npc) {
              var _dcfT = String(dcf.task || '').slice(0, 12);
              srcCommit = _sc1qCommits.find(function(c) {
                if (!c || c.npc !== dcf.npc) return false;
                var _ct = String(c.task || '');
                return !_dcfT || _ct.indexOf(_dcfT) >= 0 || (_ct.slice(0, 12) && String(dcf.task || '').indexOf(_ct.slice(0, 12)) >= 0);
              });
            }
            var nm = dcf.npc;
            if (!Array.isArray(GM._npcCommitments[nm])) GM._npcCommitments[nm] = [];
            var arr = GM._npcCommitments[nm];
            var _curT = GM.turn || 1;
            var taskRef = (srcCommit && srcCommit.task) || dcf.task || '';
            // dedup·当前回合 assignedTurn 且 task 相似度视为重复
            var dup = arr.find(function(c) {
              if (!c || c.assignedTurn !== _curT) return false;
              if (!c.task || !taskRef) return false;
              return c.task.indexOf(taskRef.slice(0, 10)) >= 0 || taskRef.indexOf(c.task.slice(0, 10)) >= 0;
            });
            var target = dup;
            if (!target) {
              target = {
                id: 'sc1q_' + _curT + '_' + nm + '_' + arr.length,
                task: taskRef,
                category: (srcCommit && srcCommit.category) || dcf.category || 'dialogue',   // 【Q4】用 sc1q 分类·让财赋/查办/侦查履成能触发 canonical 结构化后果(原硬编码 dialogue 恒落 other 权重·饿死结构化效应)
                assignedTurn: _curT,
                deadline: parseInt(srcCommit && srcCommit.deadline, 10) || 3,   // Codex修·HIGH:sc1q deadline 是字符串"3回合内"·须解析为数字·否则过期结算(:2338)串接为 NaN 永不触发+面板渲染 NaN

                status: dcf.status || 'pending',
                progress: parseInt(dcf.progressPercent, 10) || 0,
                willingness: (srcCommit && srcCommit.willingness) || 0.5,
                npcPromise: (srcCommit && srcCommit.required_npc_action) || '',
                feedback: dcf.feedback || '',
                lastUpdateTurn: _curT,
                _sc1qSource: dcf.source_type || (srcCommit && srcCommit.source_type) || '',
                _sc1qSourceConvId: dcf.source_conv_id || '',
                _sc1qTarget: (srcCommit && srcCommit.required_npc_action) || '',
                _sc1qPlayerEmphasis: (srcCommit && srcCommit.player_emphasis) || '',
                sourceRefs: [{ type: 'dialogueCommitment', id: dcf.source_conv_id || (srcCommit && srcCommit.source_conv_id) || ('sc1q-' + _curT + '-' + nm + '-' + arr.length), authority: 'court_report', turn: _curT, role: 'commitment_source' }],
                basisRefs: []
              };
              target.basisRefs = target.sourceRefs;
              arr.push(target);
            } else {
              if (dcf.status) target.status = dcf.status;
              if (dcf.feedback) target.feedback = dcf.feedback;
              if (dcf.progressPercent != null) target.progress = Math.max(0, Math.min(100, parseInt(dcf.progressPercent, 10) || 0));
              target.lastUpdateTurn = _curT;
              if (!Array.isArray(target.sourceRefs) || !target.sourceRefs.length) {
                target.sourceRefs = [{ type: 'dialogueCommitment', id: dcf.source_conv_id || (srcCommit && srcCommit.source_conv_id) || target.id, authority: 'court_report', turn: _curT, role: 'commitment_source' }];
              }
              if (!Array.isArray(target.basisRefs) || !target.basisRefs.length) target.basisRefs = target.sourceRefs;
            }
            if (target.status === 'completed') {
              target._terminalSettled = true;
              target._terminalSettledTurn = _curT;
              target._terminalSettledKind = 'completed';
              addEB('对话·履行', nm + '·' + String(taskRef).slice(0, 30) + '·' + String(dcf.feedback || '').slice(0, 40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(nm, '对话承诺已履行·' + String(taskRef).slice(0, 40), '慰', 4);
              // Codex修·MED:feedback 完成路径也触发 canonical 结构化后果(财赋/查办/侦查)·原先只 commitment_update 路径有→sc1q 承诺常走 feedback 完成却拿不到效应
              _fireCommitCanon(target, nm, ({dispatch:2.0,diplomacy:2.0,finance:1.8,intel:1.6,query:1.3,write:1.1,other:1.0})[target.category||'other']||1.0, dcf.feedback);
            } else if (target.status === 'failed' || target.status === 'obstructed') {
              target._terminalSettled = true;
              target._terminalSettledTurn = _curT;
              target._terminalSettledKind = target.status === 'obstructed' ? 'npc_duty_obstructed' : 'npc_duty_failed';
              target._loyaltyPenaltyBlocked = true;
              addEB('对话·失诺', nm + '·' + String(taskRef).slice(0, 30) + '·' + String(dcf.feedback || '').slice(0, 40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(nm, '对话承诺失诺·' + String(taskRef).slice(0, 40), '愧', 4);
            }
          });
          _dbg('[dialogue_commitment_feedback] applied ' + p1.dialogue_commitment_feedback.length + ' feedbacks');
        }

        // 【sc1q 升级·Q1·修承诺蒸发洞】无条件把每条 sc1q dialogue_commitment reconcile 进 _npcCommitments。
        //   原逻辑仅当 sc1 回吐 dialogue_commitment_feedback 才建 commit → sc1 漏吐则玩家听到的承诺静默蒸发、永不追责。
        //   此处补建缺失的(pending)·不覆盖 feedback 已处理的(同回合 source_conv_id/task 相似即视为已建)·让每句承诺都进问责闭环。
        try {
          var _q1Commits = (GM._turnAiResults && GM._turnAiResults.subcall1q && Array.isArray(GM._turnAiResults.subcall1q.dialogue_commitments)) ? GM._turnAiResults.subcall1q.dialogue_commitments : [];
          if (_q1Commits.length) {
            if (!GM._npcCommitments || typeof GM._npcCommitments !== 'object') GM._npcCommitments = {};
            var _q1T = GM.turn || 1, _q1New = 0;
            _q1Commits.forEach(function(c) {
              if (!c || !c.npc || !c.task) return;
              var nm = c.npc, _task = String(c.task || '');
              if (!Array.isArray(GM._npcCommitments[nm])) GM._npcCommitments[nm] = [];
              var arr = GM._npcCommitments[nm];
              var exists = arr.find(function(e) {
                if (!e || e.assignedTurn !== _q1T) return false;
                if (c.source_conv_id && e._sc1qSourceConvId === c.source_conv_id) return true;
                if (e.task && _task) return e.task.indexOf(_task.slice(0, 10)) >= 0 || _task.indexOf(e.task.slice(0, 10)) >= 0;
                return false;
              });
              if (exists) return;   // feedback 已建·不重复
              arr.push({
                id: 'sc1qAuto_' + _q1T + '_' + nm + '_' + arr.length,
                task: _task,
                category: c.category || 'dialogue',
                assignedTurn: _q1T,
                deadline: parseInt(c.deadline, 10) || 3,   // Codex修·HIGH:同 feedback 路径·sc1q deadline 字符串→数字·否则过期结算 NaN
                status: 'pending',
                progress: 0,
                willingness: (typeof c.willingness === 'number') ? c.willingness : 0.5,
                npcPromise: c.required_npc_action || '',
                feedback: '',
                lastUpdateTurn: _q1T,
                _sc1qSource: c.source_type || '',
                _sc1qSourceConvId: c.source_conv_id || '',
                _sc1qTarget: c.required_npc_action || '',
                _sc1qPlayerEmphasis: c.player_emphasis || '',
                _sc1qAutoReconciled: true,
                sourceRefs: [{ type: 'dialogueCommitment', id: c.source_conv_id || ('sc1qAuto-' + _q1T + '-' + nm + '-' + arr.length), authority: 'court_report', turn: _q1T, role: 'commitment_source' }],
                basisRefs: []
              });
              _q1New++;
            });
            if (_q1New) _dbg('[sc1q·Q1 reconcile] 无条件补建 ' + _q1New + ' 条承诺(防 sc1 漏吐蒸发)');
          }
        } catch(_q1E) { _dbg('[sc1q·Q1 reconcile] fail:', _q1E); }

        // 【sc1q 升级·Q2·修死车道】collective_resolutions(朝议决议)原只进 prompt、从不持久化 → 朝堂决议零跟进问责。
        //   存进 GM._courtResolutions(滚动·带 turn/status)·给决议一个状态之家·可被下回合承接与追责(不像 per-NPC 承诺那样有闭环)。
        try {
          var _q2Res = (GM._turnAiResults && GM._turnAiResults.subcall1q && Array.isArray(GM._turnAiResults.subcall1q.collective_resolutions)) ? GM._turnAiResults.subcall1q.collective_resolutions : [];
          if (_q2Res.length) {
            if (!Array.isArray(GM._courtResolutions)) GM._courtResolutions = [];
            var _q2T = GM.turn || 1;
            _q2Res.forEach(function(r) {
              if (!r || !r.topic || !r.decision) return;
              if (GM._courtResolutions.some(function(e){ return e && e.turn === _q2T && e.topic === String(r.topic).slice(0, 60); })) return;   // 同回合同议题去重(Codex修·MED:比存储的截断版·否则>60字议题一回合重复入两条)
              GM._courtResolutions.push({
                id: 'cr_' + _q2T + '_' + GM._courtResolutions.length,   // 【Q2闭环】稳定 id·供下回合 court_resolution_feedback 匹配
                topic: String(r.topic).slice(0, 60),
                forum: String(r.forum || '').slice(0, 12),
                decision: String(r.decision).slice(0, 120),
                adoptedByEmperor: !!r.adopted_by_emperor,
                requiredActions: Array.isArray(r.required_actions) ? r.required_actions.slice(0, 6).map(function(a){ return String(a).slice(0, 60); }) : [],
                turn: _q2T,
                status: 'pending'
              });
            });
            if (GM._courtResolutions.length > 40) GM._courtResolutions = GM._courtResolutions.slice(-40);
            _dbg('[sc1q·Q2] 持久化 ' + _q2Res.length + ' 条朝议决议进 GM._courtResolutions');
          }
        } catch(_q2E) { _dbg('[sc1q·Q2] fail:', _q2E); }

        // 【Q2 闭环·消费】court_resolution_feedback:SC1 跟进往期未结朝议决议 → 更新 GM._courtResolutions 状态(resolved/stalled)·让决议问责闭环(原先只持久化无人回读)。
        try {
          if (Array.isArray(p1.court_resolution_feedback) && Array.isArray(GM._courtResolutions)) {
            p1.court_resolution_feedback.forEach(function(fb) {
              if (!fb) return;
              var _cr = null;
              if (fb.id) _cr = GM._courtResolutions.find(function(e){ return e && e.id === fb.id; });
              if (!_cr && fb.topic) {   // id 未回带→按 topic 相似度兜底
                var _ft = String(fb.topic).slice(0, 10);
                _cr = GM._courtResolutions.find(function(e){ return e && (e.status === 'pending' || e.status === 'stalled') && e.topic && (e.topic.indexOf(_ft) >= 0 || String(fb.topic).indexOf(e.topic.slice(0, 10)) >= 0); });
              }
              if (!_cr || (_cr.status !== 'pending' && _cr.status !== 'stalled')) return;
              var _st = fb.status;
              if (_st === 'resolved' || _st === 'completed' || _st === 'done') {
                _cr.status = 'resolved'; _cr.resolvedTurn = GM.turn;
                if (fb.note) _cr.followupNote = String(fb.note).slice(0, 80);
                if (typeof addEB === 'function') addEB('朝议·落实', String(_cr.topic || '').slice(0, 30) + '·' + String(fb.note || _cr.decision || '').slice(0, 40));
              } else if (_st === 'stalled' || _st === 'obstructed' || _st === 'blocked') {
                _cr.status = 'stalled'; _cr.lastUpdateTurn = GM.turn;
                if (fb.note) _cr.followupNote = String(fb.note).slice(0, 80);
                if (typeof addEB === 'function') addEB('朝议·梗阻', String(_cr.topic || '').slice(0, 30) + '·' + String(fb.note || '').slice(0, 40));
              }
            });
          }
        } catch(_crfE) { _dbg('[sc1q·Q2 feedback] fail:', _crfE); }

        // 【Q2 闭环·确定性追责】pending/stalled 决议超 _crMaxAge 回合仍无跟进 → 判 lapsed(决而不行·束之高阁)·出事件·避免决议永远悬而不决。
        try {
          if (Array.isArray(GM._courtResolutions) && GM._courtResolutions.length) {
            var _crT = GM.turn || 1;
            var _crMaxAge = (P.conf && P.conf.courtResolutionMaxAge) || 5;
            GM._courtResolutions.forEach(function(e){
              if (!e || (e.status !== 'pending' && e.status !== 'stalled')) return;
              if (_crT - (e.turn || _crT) >= _crMaxAge) {
                e.status = 'lapsed'; e.lapsedTurn = _crT;
                if (typeof addEB === 'function') addEB('朝议·搁置', String(e.topic || '').slice(0, 30) + '·决而不行·束之高阁');
              }
            });
          }
        } catch(_crAgeE) {}

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
              (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })({
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
                (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })({
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义爆发】' + rv.leaderName + '起兵于' + (rv.region||'?') + (rv.slogan?'，号"' + rv.slogan + '"':'') + '。' + (rv.reason||''), category: '起义' });
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
            if (ru.strength_delta) r.militaryStrength = Math.max(0, (r.militaryStrength||0) + (parseInt(ru.strength_delta, 10) || 0)); // ||0·AI给非数字曾写NaN入档(2026-07-04 审查定罪)
            if (ru.supplyStatus_delta) r.supplyStatus = Math.max(0, Math.min(100, (r.supplyStatus||50) + (parseInt(ru.supplyStatus_delta, 10) || 0)));
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
              if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义·' + r.phase + '】' + r.leaderName + '：' + (ru.keyEvent||ru.narrative||''), category: '起义' });
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
            if (cas.rebel) r.militaryStrength = Math.max(0, (r.militaryStrength||0) - (parseInt(cas.rebel, 10) || 0)); // ||0·同上防NaN
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【镇压】' + (sp.suppressor||'?') + '战' + r.leaderName + '，结' + (sp.outcome||'?') + '。' + (sp.narrative||''), category: '起义' });
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【招安】' + (am.envoy||'?') + '抚' + r.leaderName + '，' + (am.outcome||'?') + '。' + (am.narrative||''), category: '起义' });
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
            addEB('\u8D77\u4E49', '【转化】' + r.leaderName + '之乱→' + ({toFaction:'据地立帜',dynastyReplaced:'改朝换代',merged:'并入他部',coopted:'招安受抚',dissolved:'溃散平定'}[tr.transformType]||tr.transformType) + (tr.newFactionName?'：立' + tr.newFactionName:'') + (tr.narrative?'——' + tr.narrative.slice(0,80):''));
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义转化】' + r.leaderName + '：' + tr.transformType + '。' + (tr.narrative||''), category: '起义' });
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u65B0\u515A\u3011' + pc.name + '\u6210\u7ACB\u3002' + (pc.reason||''), category: '\u515A\u6D3E' });
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u515A\u6D3E\u89E6\u706D\u3011' + pd.name + _cLbl + '\u3002' + (pd.reason||''), category: '\u515A\u6D3E' });
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
            addEB('\u52BF\u529B', '\u3010\u65B0\u52BF\u529B\u7AD6\u8D77\u3011' + fc.name + '\u6210\u7ACB\uFF08' + (({military:'军镇',religious:'教门',warlord:'藩镇',foreign:'外藩',dynasty:'王朝',rebel:'义军',tribe:'部族',sect:'会党',separatist:'割据',bandit:'草寇',peasant:'民军'}[fc.type])||fc.type||'') + '\uFF09' + (fc.parentFaction?'\u2014\u2014\u8131\u79BB\u81EA' + fc.parentFaction:'') + (fc.triggerEvent?'\uFF1A' + fc.triggerEvent:''));
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u65B0\u52BF\u529B\u3011' + fc.name + '\u7AD6\u8D77\u3002' + (fc.reason||''), category: '\u52BF\u529B' });
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
            // 从 activeWars 移除相关条目（该势力已灭）——条目形状多样(enemy/attacker/defender/faction)·
            // 只滤 enemy 曾让 declare_war 形战争成幽灵条目(2026-07-04 审查定罪)
            if (Array.isArray(GM.activeWars)) {
              GM.activeWars = GM.activeWars.filter(function(w) {
                return !(w && (w.enemy === fd.name || w.attacker === fd.name || w.defender === fd.name || w.faction === fd.name));
              });
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u52BF\u529B\u89E6\u706D\u3011' + fd.name + _fcLbl + '\u3002' + (fd.reason||''), category: '\u52BF\u529B' });
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
              _origin: ce.origin,
              descriptor: (ce.descriptor && typeof ce.descriptor === 'object') ? ce.descriptor : undefined
            };
            GM.classes.push(newC); if (typeof TM !== 'undefined' && TM.ClassEngine && TM.ClassEngine.ensureClassPopulationCell) TM.ClassEngine.ensureClassPopulationCell(newC, GM); if (typeof TM !== 'undefined' && TM.SocialFoundation && TM.SocialFoundation.reconcileClassDescriptor) TM.SocialFoundation.reconcileClassDescriptor(newC, GM);
            if (newC.descriptor && newC.descriptor._needsAdjudication && typeof callAI === 'function') {
              // ⑤·硬骨头升 secondary-LLM 裁：现生阶层带表外 novel 标签→低优先 AI 归一通用词表(fire-and-forget·失败保确定性兜底)
              (function (_c) {
                var _ap = '【阶层定性·归一】新兴阶层「' + _c.name + '」(治生:' + (_c.economicRole || '') + '·特权:' + String(_c.privileges || '无').slice(0, 30) + '·影响' + (_c.influence || '') + ')现有标签 fiscalStatus=' + (_c.descriptor.fiscalStatus || '') + '·unrestArchetype=' + (_c.descriptor.unrestArchetype || '') + '(或为表外原词)。请归一到通用词表后输出：stratum(上/中/下)、fiscalStatus(优免/编户/受饷/法外)、unrestArchetype(暴烈/撤离/不合作/哗变/倒戈)。只输出 JSON {"stratum":"","fiscalStatus":"","unrestArchetype":""}·勿输出其他。';
                Promise.resolve(callAI(_ap, 300, undefined, 'secondary', { priority: 'low', timeoutMs: 40000, maxRetries: 1 })).then(function (_ar) {
                  try {
                    var _aj = JSON.parse(String(_ar || '').replace(/```json|```/g, '').trim());
                    if (_aj && TM.SocialFoundation && TM.SocialFoundation.applyAdjudicatedDescriptor && TM.SocialFoundation.applyAdjudicatedDescriptor(_c, _aj) && typeof addEB === 'function') addEB('阶层', '【定性】' + _c.name + '·' + _c.descriptor.stratum + '/' + _c.descriptor.fiscalStatus + '/' + _c.descriptor.unrestArchetype);
                  } catch (_pe) {}
                }).catch(function () {});
              })(newC);
            }
            addEB('\u9636\u5C42', '\u3010\u65B0\u9636\u5C42\u5174\u8D77\u3011' + ce.name + (ce.origin?'\u2014\u2014' + ce.origin:'') + (ce.reason?'\uFF1A' + ce.reason:''));
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u9636\u5C42\u5174\u66BF\u3011' + ce.name + '\u5174\u8D77\u3002' + (ce.reason||''), category: '\u9636\u5C42' });
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u9636\u5C42\u6D88\u4EA1\u3011' + cd.name + _ccLbl + '\u3002' + (cd.reason||''), category: '\u9636\u5C42' });
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

        // 官制活化 Slice④ 改制裁定 pass：拟制满一回合→裁定（开关 officeReformAdjudicationEnabled·默认关零回归）
        if (typeof officeFlagOn === 'function' && officeFlagOn('officeReformAdjudicationEnabled') && typeof adjudicatePendingReforms === 'function') {
          try { adjudicatePendingReforms(GM, { aiVerdicts: (p1 && p1.reform_verdicts) || null }); } catch (_arpE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_arpE, 'apply] reform adjudicate:') : console.warn('[apply] reform adjudicate:', _arpE); }
        }
        // 处理官制变动（AI可任命/罢免官员）
        if (p1.office_changes && Array.isArray(p1.office_changes) && GM.officeTree) {
          // 官制活化 Slice④ 拟制态捕获：adjudication 开时·reform oc 入队(拟制中)·不即落·关则原样(3340 即落·零回归)
          if (typeof officeFlagOn === 'function' && officeFlagOn('officeReformAdjudicationEnabled') && typeof enqueuePendingReform === 'function') {
            p1.office_changes = p1.office_changes.filter(function (oc) { if (oc && oc.action === 'reform' && oc.reformDetail) { enqueuePendingReform(GM, oc); return false; } return true; });
          }
          var _officeMoveExitMap = _tmBuildOfficeMoveExitMap(GM, p1);
          p1.office_changes.forEach(function(oc) {
            if (!oc.dept || !oc.position || !oc.action) return;
            var _ocMatchedTree = false; // 单一真相源:树是否精确匹配·未匹配则回退写人物 officialTitle
            // 单一真相源·robust 解析:AI 官衔常啰嗦(如"内阁首辅·建极殿大学士"·树座名"首辅·建极殿大学士"),
            //   精确相等对不上→旧任职者不让位、新官溢出编制外(ghost 病)。先解析到正座·使任免可靠落座。
            var _ocSeat = null;
            if (/^(appoint|dismiss|promote|demote|transfer)$/.test(oc.action) && typeof _offResolveSeat === 'function') {
              try { _ocSeat = _offResolveSeat(oc.dept, oc.position); } catch (_ocResErr) {}
            }
            // 遍历官制树查找匹配的部门和职位
            (function walkTree(nodes) {
              nodes.forEach(function(node) {
                if (node.positions) {
                  node.positions.forEach(function(pos) {
                    var _ocMatchPos = _ocSeat ? (node === _ocSeat.node && pos === _ocSeat.pos) : (node.name === oc.dept && pos.name === oc.position);
                    if (_ocMatchPos) {
                      _ocMatchedTree = true;
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
                          ch.officialTitle = _ocSeat ? pos.name : oc.position;  // 解析到正座→落 canonical 座名(derive 精确落座·免啰嗦衔/重名病)
                          ch.title = _ocSeat ? pos.name : (oc.dept + oc.position);
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
                        // 单一真相源·让位:仅单编制座位自动腾退被顶替的现任(多编制靠 vacancy 容纳)·robust 按座撤衔治 ghost
                        var _estab1 = (pos.establishedCount || pos.headCount || 1) <= 1;
                        if (_estab1 && oldHolder && oldHolder !== oc.person) {
                          var _oldCh = findCharByName(oldHolder);
                          if (_oldCh && typeof _offVacateCharFromSeat === 'function') {
                            if (_offVacateCharFromSeat(_oldCh, node.name, pos.name)) addEB('去位', oldHolder + '去' + node.name + pos.name + '（由' + oc.person + '接任）');
                          } else if (_oldCh && _oldCh.officialTitle === oc.position) { _oldCh.officialTitle = ''; _oldCh.title = ''; }
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
                        var _pairedMoveExit = dismissed ? _officeMoveExitMap[_tmOfficeDismissKey(oc.dept, oc.position, dismissed)] : null;
                        var _isMoveExit = !!_pairedMoveExit || _tmIsNonPunitiveOfficeExitReason(oc.reason);
                        // 新模型：把该任职者从 actualHolders 移除，留占位
                        if (dismissed && typeof _offDismissPerson === 'function') _offDismissPerson(pos, dismissed);
                        else pos.holder = '';
                        if (dismissed) {
                          addEB(_isMoveExit ? '\u8F6C\u4EFB' : '\u7F62\u514D', dismissed + (_isMoveExit ? '\u5378\u4EFB' : '\u88AB\u514D\u53BB') + oc.dept + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
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
                          } else if (_isMoveExit) {
                            dch.stress = Math.max(0, (dch.stress||0) - 3);
                          } else {
                            _tmApplyLoyaltyDelta(dch, -10, '\u88AB\u514D\u53BB\u5B98\u804C', 'office-dismiss-remove');
                            dch.stress = Math.min(100, (dch.stress||0) + 15);
                          }
                          // 单一真相源:规范卸任·robust 按座撤衔(治啰嗦/简衔精确相等清不掉的 ghost)·回退精确·title 同步剩余主职防误成布衣(症状②)
                          var _dchVacated = false;
                          if (typeof _offVacateCharFromSeat === 'function') _dchVacated = _offVacateCharFromSeat(dch, node.name, pos.name);
                          if (!_dchVacated) {
                            if (_isMoveExit) { if (dch.officialTitle === oc.position) dch.officialTitle = ''; }
                            else if (typeof _offRemoveCharOfficeTitle === 'function') _offRemoveCharOfficeTitle(dch, oc.position);
                            else if (dch.officialTitle === oc.position) dch.officialTitle = '';
                          }
                          if (_isRetire) dch.title = '致仕';
                          else if (!_dchVacated && typeof _offRemoveCharOfficeTitle !== 'function' && !_isMoveExit) dch.title = '';
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(dismissed, _isRetire ? 'retirement' : (_isMoveExit ? 'transfer' : 'dismissal'), (_isRetire ? '\u6069\u51C6\u81F4\u4ED5' : (_isMoveExit ? '\u8F6C\u4EFB\u5378\u804C' : '\u88AB\u514D\u53BB')) + oc.dept + oc.position + (oc.reason ? '：' + oc.reason : ''));
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
            // 单一真相源:树无精确匹配的人事变动·仍把意图写入人物 officialTitle(派生据此落座/卸座)·
            //   否则推演叙事显示了官职变化但图志/树都不变(症状③)
            if (!_ocMatchedTree && oc.action === 'appoint' && oc.person) {
              var _ucCh = findCharByName(oc.person);
              if (_ucCh) {
                if (typeof _offAddCharOfficeTitle === 'function') _offAddCharOfficeTitle(_ucCh, oc.position, { concurrent: !!oc.concurrent });
                else _ucCh.officialTitle = oc.position;
                if (!_ucCh.title) _ucCh.title = (oc.dept || '') + oc.position;
                addEB('任命', oc.person + '任' + (oc.dept || '') + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
              }
            } else if (!_ocMatchedTree && oc.action === 'dismiss' && oc.person) {
              var _ucCh2 = findCharByName(oc.person);
              if (_ucCh2 && typeof _offRemoveCharOfficeTitle === 'function') {
                _offRemoveCharOfficeTitle(_ucCh2, oc.position);
                addEB('罢免', oc.person + '免去' + (oc.dept || '') + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
              }
            }
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
                          if (dch) { if (typeof _offVacateCharFromSeat === 'function') _offVacateCharFromSeat(dch, oc.dept, oc.position); else if (typeof _offRemoveCharOfficeTitle === 'function') _offRemoveCharOfficeTitle(dch, oc.position); else { dch.officialTitle = ''; dch.title = ''; } } // 单一真相源:裁撤官职并清兼职数组·否则派生从残留 officialTitles 进编制外幻影
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

        // ── 官制树确定性任命·过回合权威落地（斩断“UI 任命还要过 AI 识别”依赖·根治反复掉职 bug·2026-07-01）──
        // 玩家在官制树上任命的官员(_offPickerConfirm·带 _offTreeAppoint 标记)是确定性事实·此处在下面 sync 前
        // 权威重申 char.officialTitle(压过 AI 识别链的漏识别/误覆盖)·再交 sync 从正确 char 重建 holder。
        // 手打诏令任命(无 _offTreeAppoint·未进此支)不受影响·仍走 AI 识别。
        try {
          var _oteFind = (typeof findCharByName === 'function') ? findCharByName : function (nm) { return (GM.chars || []).find(function (c) { return c && c.name === nm; }); };
          (GM._edictTracker || []).forEach(function (_ote) {
            if (!_ote || !_ote._offTreeAppoint || _ote._offApplied) return;
            var _oaa = _ote._appointmentAction;
            if (!_oaa || !_oaa.character || !_oaa.position) return;
            var _oteNew = _oteFind(_oaa.character);
            if (_oteNew) {
              if (_oaa.mode === 'concurrent') {
                if (!Array.isArray(_oteNew.concurrentTitles)) _oteNew.concurrentTitles = [];
                if (_oteNew.concurrentTitles.indexOf(_oaa.position) < 0) _oteNew.concurrentTitles.push(_oaa.position);
              } else {
                _oteNew.officialTitle = _oaa.position;   // 权威重申·压过 AI 识别链
                if (!_oteNew.title) _oteNew.title = _oaa.position;
                if (_oaa.oldHolder && _oaa.oldHolder !== _oaa.character) {   // 辞旧就新·旧任离座(若 AI 未处理)
                  var _oteOld = _oteFind(_oaa.oldHolder);
                  if (_oteOld && _oteOld.officialTitle === _oaa.position) { _oteOld.officialTitle = ''; _oteOld.title = ''; }
                }
              }
            }
            _ote._offApplied = true;    // 防重复落地
            _ote.status = 'executed';   // 确定性完成·不再交 AI/督察
          });
        } catch (_oteErr) {}

        // 单一真相源:office_changes 处理后从人物 officialTitle 重建官制树任职者
        try { if (typeof _offSyncHoldersFromChars === 'function') _offSyncHoldersFromChars({ force: true }); } catch (_e) {}

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
              // 贪腐案发 → 被查者减功名（FAILURE_DELTA corruption_exposed·激活既有失败表·功名=政绩·唯贪腐"案发"与廉洁相关）
              if (Array.isArray(oa.named_corrupt) && window.CharEconEngine && window.TMPromotion) {
                oa.named_corrupt.forEach(function(_cn) {
                  var _cc = (typeof findCharByName === 'function') ? findCharByName(_cn) : null;
                  if (_cc) CharEconEngine.adjustVirtueMerit(_cc, TMPromotion.failureDelta('corruption_exposed'), '贪腐案发');
                });
              }
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
              // 影子根治刀1(2026-07-04)：P/GM 双源搜地块——真机存档 P.adminHierarchy 常为空{}·活树在 GM。
              // 旧只搜 P 树→他档真记录(名/描述/工期)静默没建·掉进下方旧兼容通道铸「未知建筑」影子。
              // 镜像 _adminSources 范式：P 先·GM 树非同一对象才补·顶层 divisions||children 都认。
              if (P.adminHierarchy || GM.adminHierarchy) {
                var _targetDiv = null;
                var _bcRoots = [];
                if (P.adminHierarchy && typeof P.adminHierarchy === 'object') _bcRoots.push(P.adminHierarchy);
                if (GM.adminHierarchy && typeof GM.adminHierarchy === 'object' && GM.adminHierarchy !== P.adminHierarchy) _bcRoots.push(GM.adminHierarchy);
                _bcRoots.forEach(function(_ahRoot) {
                  if (_targetDiv) return;
                  Object.keys(_ahRoot).forEach(function(fk) {
                    if (_targetDiv) return;
                    var fh = _ahRoot[fk]; var _ds0 = fh && (fh.divisions || fh.children); if (!_ds0 || !_ds0.length) return;
                    (function _walk(ds) {
                      ds.forEach(function(d) {
                        if (!d || _targetDiv) return;
                        if (d.name === bc.territory) { _targetDiv = d; return; }
                        if (d.children) _walk(d.children);
                        if (d.divisions) _walk(d.divisions);
                      });
                    })(_ds0);
                  });
                });
                if (_targetDiv) {
                  if (!_targetDiv.buildings) _targetDiv.buildings = [];
                  var _bcDisp = ((typeof BUILDING_TYPES !== 'undefined' && BUILDING_TYPES[bc.type] && BUILDING_TYPES[bc.type].name) || bc.type);
                  // 影子根治刀1b(2026-07-04)：同名工程仍在建 → AI 复报(续修/重申)是常态·静默勿重
                  // (勿重复立项·也勿走 upgrade 分支——那会 level++ 且 applyCompletion 提前入账未竣之效)。
                  // bc.action 置 noop 同时令下方旧兼容通道跳过·两本账都不重记。
                  if ((bc.action === 'build' || bc.action === 'custom_build') && _targetDiv.buildings.some(function(b){ return b && b.name === bc.type && b.status === 'building'; })) {
                    bc.action = 'noop_inprogress';
                  } else if (bc.action === 'build' && !bc.isCustom) {
                    // 刀三:标准 build 但该地已有同名建筑 → 规范为 upgrade(扩建意图),不重复新建同名工程
                    var _sameName = _targetDiv.buildings.find(function(b){ return b && b.name === bc.type; });
                    if (_sameName) bc.action = 'upgrade';
                  }
                  if (bc.action === 'destroy') {
                    // 2026-06-12: 拆毁前按 appliedDelta 回退已入账效果（建筑工役引擎·存量可逆）
                    _targetDiv.buildings.forEach(function(b) {
                      if (b && b.name === bc.type && typeof TM !== 'undefined' && TM.BuildingWorks) {
                        try { TM.BuildingWorks.revertBuilding(_targetDiv, b); } catch(_) {}
                      }
                    });
                    _targetDiv.buildings = _targetDiv.buildings.filter(function(b) { return b.name !== bc.type; });
                    addEB('\u5EFA\u8BBE', bc.territory + '拆除 ' + _bcDisp);
                  } else if (bc.action === 'upgrade') {
                    var _exB = _targetDiv.buildings.find(function(b) { return b.name === bc.type; });
                    if (_exB) {
                      _exB.level = (_exB.level || 1) + 1;
                      // 丙:扩建按本次追加投入/新核定入账——回报随投入,不再只给固定一级
                      if (bc.costActual) _exB.costActual = bc.costActual;
                      if (bc.effectsStructured && typeof bc.effectsStructured === 'object') _exB.effectsStructured = bc.effectsStructured;
                      // 2026-06-12: 升级即时再入账一级份效果（appliedDelta 累计·拆毁整体回退）
                      if (typeof TM !== 'undefined' && TM.BuildingWorks) {
                        try {
                          var _bwPrevTurn = _exB.appliedTurn; delete _exB.appliedTurn;
                          var _bwPrevDelta = _exB.appliedDelta || {}; delete _exB.appliedDelta;
                          TM.BuildingWorks.applyCompletion(_targetDiv, _exB, P, GM);
                          var _bwNewDelta = _exB.appliedDelta || {};
                          Object.keys(_bwPrevDelta).forEach(function(k){ _bwNewDelta[k] = (_bwNewDelta[k] || 0) + _bwPrevDelta[k]; });
                          _exB.appliedDelta = _bwNewDelta;
                          if (_exB.appliedTurn == null && _bwPrevTurn != null) _exB.appliedTurn = _bwPrevTurn;
                        } catch(_) {}
                      }
                      addEB('\u5EFA\u8BBE', bc.territory + '的' + _bcDisp + '升级至' + _exB.level + '级');
                    }
                  } else if (bc.action === 'build' || bc.action === 'custom_build') {
                    // build 或 custom_build（显式条件·刀1b 的 noop_inprogress 从此整链穿过不落账）
                    var _isCustom = bc.action === 'custom_build' || bc.isCustom;
                    var _feasibility = bc.feasibility || '合理';
                    if (_feasibility === '不合理') {
                      addEB('\u5EFA\u8BBE', bc.territory + '拟建 ' + _bcDisp + ' 因不合理未能实施');
                    } else {
                      var _newBld = {
                        name: bc.type,
                        level: bc.level || 1,
                        isCustom: _isCustom,
                        description: bc.description || '',
                        judgedEffects: bc.judgedEffects || '',
                        effectsStructured: (bc.effectsStructured && typeof bc.effectsStructured === 'object') ? bc.effectsStructured : null,
                        costActual: bc.costActual || null,
                        timeActual: bc.timeActual || null,
                        status: (bc.timeActual && bc.timeActual > 0) ? 'building' : 'completed',
                        remainingTurns: bc.timeActual || 0,
                        startTurn: GM.turn
                      };
                      _targetDiv.buildings.push(_newBld);
                      // 完工入账缺口修（2026-07-03）：timeActual≤0 直落 completed 的建筑绕过 tick→
                      // applyCompletion 永不触发·效果从不入账（也进不了工竣立制钩）。此处即时补入账。
                      if (_newBld.status === 'completed') {
                        try {
                          var _BW = (typeof TM !== 'undefined' && TM.BuildingWorks) || (typeof window !== 'undefined' && window.TM && window.TM.BuildingWorks);
                          if (_BW && typeof _BW.applyCompletion === 'function') _BW.applyCompletion(_targetDiv, _newBld, P, GM);
                        } catch (_bwcE) {}
                      }
                      addEB('\u5EFA\u8BBE', bc.territory + (_isCustom?'自定义建造 ':'建造 ') + _bcDisp + (_feasibility!=='合理'?('('+_feasibility+')'):'') + (bc.reason?' —— '+bc.reason:''));
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
            // 影子根治刀2(2026-07-04)：反查不到类型 = 自拟/未知中文名——真记录已由上方双源通道
            // 落 div.buildings 新账。旧账 createBuilding(未知type) 只会铸「未知建筑」死影子
            // (无描述/无 status/无效果·且按键位把营造志真记录挤出)——绝不再铸。
            var _btResolved = (typeof BUILDING_TYPES !== 'undefined') && !!BUILDING_TYPES[_bcType];

            if (bc.action === 'build' && _bcType && _btResolved) {
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
            // S6（2026-06-12）：治理效果按本地政令执行率打折——官缺/主官出缺/驿路阻滞/贪腐全在执行率里。
            var _s6ExecRate = 1;
            try {
              if (typeof TM !== 'undefined' && TM.FieldPipes && typeof TM.FieldPipes.policyExecRate === 'function') {
                _s6ExecRate = TM.FieldPipes.policyExecRate(_targetDiv).rate;
              }
            } catch(_) {}
            function _s6Scale(v) {
              var n = parseInt(v) || 0;
              if (!n || _s6ExecRate >= 1) return n;
              var scaled = Math.round(n * _s6ExecRate);
              return scaled === 0 ? (n > 0 ? 1 : -1) : scaled; // 不归零：至少存一分政令余效
            }
            if (ac.prosperity_delta) {
              _targetDiv.prosperity = clamp((_targetDiv.prosperity || 50) + clamp(_s6Scale(ac.prosperity_delta), -20, 20), 0, 100);
            }
            if (ac.population_delta) {
              _targetDiv.population = Math.max(0, (_targetDiv.population || 50000) + clamp(_s6Scale(ac.population_delta), -50000, 50000));
            }

            // 同步到地方区划
            if (GM.provinceStats && GM.provinceStats[ac.division]) {
              var _ps = GM.provinceStats[ac.division];
              if (_targetDiv.governor !== undefined) _ps.governor = _targetDiv.governor;
              if (_targetDiv.prosperity !== undefined) _ps.wealth = _targetDiv.prosperity;
              if (_targetDiv.population !== undefined) _ps.population = _targetDiv.population;
              if (ac.corruption_delta) _ps.corruption = clamp((_ps.corruption || 0) + clamp(_s6Scale(ac.corruption_delta), -20, 20), 0, 100);
              if (ac.stability_delta) _ps.stability = clamp((_ps.stability || 50) + clamp(_s6Scale(ac.stability_delta), -20, 20), 0, 100);
              if (ac.unrest_delta) _ps.unrest = clamp((_ps.unrest || 0) + clamp(_s6Scale(ac.unrest_delta), -20, 20), 0, 100);
            }
          });
        }

        // 处理地块状态变更（2026-06-12·状态系统）：奇观/灾异/风云/圣裁落地块持续境况·
        // 效果硬闸（econPct ±25%·民心 ±2/回合·工期 ≤24·每地 ≤12 条）在 TM.RegionStatus.normalize
        if (p1.region_status_changes && Array.isArray(p1.region_status_changes) && P.adminHierarchy) {
          p1.region_status_changes.forEach(function(sc) {
            if (!sc || !sc.region) return;
            var _rsApi = (typeof TM !== 'undefined' && TM.RegionStatus) || null;
            var _fpApi = (typeof TM !== 'undefined' && TM.FieldPipes) || null;
            if (!_rsApi || !_fpApi) return;
            var _scDiv = _fpApi.findDivisionByName(P, sc.region);
            if (!_scDiv) return;
            if (sc.action === 'remove') {
              if (_rsApi.remove(_scDiv, sc.name || sc.id, undefined, GM)) {
                addEB('地方', sc.region + '状态消解：' + (sc.name || sc.id) + (sc.reason ? '——' + sc.reason : ''));
              }
            } else {
              var _scFx = _rsApi.add(_scDiv, { kind: sc.kind, name: sc.name, desc: sc.desc || sc.reason || '', econPct: sc.econPct, minxinPerTurn: sc.minxinPerTurn, durationTurns: sc.durationTurns, source: 'ai' }, GM);
              if (_scFx) {
                addEB('地方', sc.region + '现状态【' + _scFx.name + '】' + (_scFx.econPct ? '·岁入 ' + (_scFx.econPct > 0 ? '+' : '') + Math.round(_scFx.econPct * 100) + '%' : '') + (sc.reason ? '——' + sc.reason : ''));
              }
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
                        NpcMemorySystem.remember(_lostGov, '\u6240\u8F96' + adu.division + '\u5931\u9677\u4E8E' + (adu.lostTo || '\u654C\u65B9') + '\uFF0C\u5BF9\u6B64\u6DF1\u611F\u7126\u8651\u548C\u7F9A\u803B', '\u5FE7', 7, undefined, { type: 'trauma' }); // \u53C2\u6570\u9519\u4F4D\u4FEE:'trauma'\u66FE\u5360emotion\u4F4D\u00B7importance\u843D\u9ED8\u8BA45\u6C38\u4E0D\u6210\u4F24\u75A4(2026-07-04 \u5BA1\u67E5\u5B9A\u7F6A)
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
              var sp = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true); }) : null;
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
              var spf = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true); }) : null;
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
              var sps = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true); }) : null;
              if (sps) {
                sps.stress = Math.min(100, (sps.stress || 0) + 15);
                if (sps.favor !== undefined) sps.favor = Math.max(0, sps.favor - 10);
              }
              addEB('\u540E\u5BAB', he.character + '\u4E11\u95FB' + (he.detail ? '\uFF1A' + he.detail : ''));
              // NPC记忆
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                NpcMemorySystem.remember(he.character, '\u540E\u5BAB\u4E11\u95FB\uFF1A' + (he.detail || ''), '\u5FE7', 7, undefined, { type: 'scandal' }); // \u53C2\u6570\u9519\u4F4D\u4FEE:'scandal'\u66FE\u5360emotion\u4F4D(2026-07-04 \u5BA1\u67E5\u5B9A\u7F6A)
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
                addEB('\u8FC7\u6EE4', 'AI 试图让玩家 ' + _pNameW + ' 擅自代行 ' + w.title + '，已过滤');
                return;
              }
            }
            // 补全字段
            var work = {
              id: 'work_T' + GM.turn + '_' + Math.random().toString(36).slice(2, 8),
              author: w.author,
              turn: GM.turn,
              date: (typeof getTSText === 'function' ? getTSText(GM.turn) : (w.date || '')),  // engine-deterministic year for this-turn works; ignore AI-hallucinated dates
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
                  var _uaOldSat = Number(clsObj.satisfaction || 50) || 50;
                  if (TM && TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function') {
                    TM.ClassEngine.gateSatisfaction(GM, clsObj, impact, { turn: GM.turn, source: 'unlock-effect', reason: info.reason || '解锁影响' });
                  } else {
                    clsObj.satisfaction = Math.max(0, Math.min(100, _uaOldSat + impact));
                  }
                  var _uaApplied = (Number(clsObj.satisfaction) || _uaOldSat) - _uaOldSat;
                  if (TM && TM.ClassEngine && typeof TM.ClassEngine.applyClassPartyCoupling === 'function' && _uaApplied) {
                    try {
                      TM.ClassEngine.applyClassPartyCoupling(GM, clsObj, _uaApplied, { turn: GM.turn, source: 'endturn-ai-infer', reason: info.reason || '' });
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
                      NpcMemorySystem.remember(c.name, '党议反对诏令' + _edictTypeCN(u.edictType), '恨', 5);
                    });
                  }
                }
              });
            }

            // 意外后果 → 编年 + 起居注
            if (u.unintendedConsequences) {
              addEB('\u8BCF\u4EE4', '【意外】' + u.unintendedConsequences);
              if (GM.qijuHistory) {
                if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
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
                NpcMemorySystem.remember(oppName, '反对诏令' + _edictTypeCN(u.edictType) + '——深恶之', '恨', 6);
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

        // 处理 AI 授功名出身（门荫/捐纳/军功/吏进/特赐/加衔）——结构化出身生成路径
        if (p1.gongming_grants && Array.isArray(p1.gongming_grants) && p1.gongming_grants.length > 0 && window.TMGongming) {
          var _gmPName = (P.playerInfo && P.playerInfo.characterName) || '';
          var _gmActLbl = { menyin: '荫叙', nazi: '捐纳例监', junggong: '录军功', lijin: '吏员升流', enci: '特赐进士出身' };
          p1.gongming_grants.forEach(function(gg) {
            if (!gg || !gg.name || !gg.action) return;
            if (_gmPName && gg.name === _gmPName) { addEB('过滤', 'AI 试图改君上功名出身，已过滤'); return; }
            var _gch = (typeof findCharByName === 'function') ? findCharByName(gg.name) : null;
            if (!_gch) return;
            try {
              if (gg.action === 'honor' && gg.honor) {
                TMGongming.addHonor(_gch, String(gg.honor), GM);
                addEB('功名', gg.name + ' 加衔「' + gg.honor + '」' + (gg.reason ? '·' + gg.reason : ''));
              } else if (TMGongming.PRODUCTION_PRESETS && TMGongming.PRODUCTION_PRESETS[gg.action]) {
                TMGongming.grantPreset(_gch, gg.action, { tier: gg.tier, honors: gg.honor ? [String(gg.honor)] : undefined, turn: GM.turn }, GM);
                addEB('功名', gg.name + ' 由' + (_gmActLbl[gg.action] || gg.action) + '授功名' + (gg.reason ? '·' + gg.reason : ''));
              }
            } catch (_gge) {}
          });
        }

        // ①·C4 流寇处置（AI roving_actions→剿/抚·走 PhaseF3 API·邸报由 API 出·单行避混 CRLF）
        if (p1.roving_actions && Array.isArray(p1.roving_actions) && typeof PhaseF3 !== 'undefined') { p1.roving_actions.forEach(function(ra){ if(!ra||!ra.action) return; try { var _rid=ra.id||ra.name; if(/suppress|剿|镇压|平叛|围剿/.test(ra.action)) PhaseF3.suppressRovingRebel(_rid, Number(ra.force)||30000); else if(/pacify|抚|招抚|招安|赦/.test(ra.action)) PhaseF3.pacifyRovingRebel(_rid); } catch(_re){} }); }

        // ④·G 名额杠杆（AI keju_quota_change→调 quotaPerExam·夹50-1500·下一科 _kejuMobilityFlow 据此 throttle 士人受阻·单行避混 CRLF）
        if (p1.keju_quota_change && typeof p1.keju_quota_change === 'object' && typeof P !== 'undefined' && P && P.keju) { var _kq = p1.keju_quota_change, _kcur = Number(P.keju.quotaPerExam) || 0, _knv = (_kq.value != null) ? Number(_kq.value) : (_kcur + (Number(_kq.delta) || 0)); if (isFinite(_knv)) { _knv = Math.max(50, Math.min(1500, Math.round(_knv))); if (_knv !== _kcur) { P.keju.quotaPerExam = _knv; if (typeof addEB === 'function') addEB('科举', '诏调科举名额 ' + _kcur + '→' + _knv + (_kq.reason ? '·' + _kq.reason : '') + (_knv < _kcur ? '（取士益严·恐激士林怨望）' : '（广开取士·然稀清流增优免）')); } } }

        // 处理 AI 功名升降（立功涨/失职减·失败全表由 AI 按情节报责任人·激活既有 FAILURE_DELTA 全表）
        if (p1.merit_changes && Array.isArray(p1.merit_changes) && p1.merit_changes.length > 0 && window.CharEconEngine) {
          var _mcPName = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.merit_changes.forEach(function(mc) {
            if (!mc || !mc.name) return;
            if (_mcPName && mc.name === _mcPName) return; // 君上功名不受 AI 改
            var _mch = (typeof findCharByName === 'function') ? findCharByName(mc.name) : null;
            if (!_mch) return;
            try {
              if (mc.kind === 'failure' && window.TMPromotion) {
                var _fd = TMPromotion.failureDelta(mc.failureType || 'task_botched');
                if (_fd) { CharEconEngine.adjustVirtueMerit(_mch, _fd, mc.reason || mc.failureType || '失职'); addEB('功名', mc.name + ' 因「' + (mc.reason || mc.failureType || '失职') + '」失功名 ' + Math.abs(_fd)); }
              } else {
                if (CharEconEngine.addAchievement) CharEconEngine.addAchievement(_mch, Math.min(20, Number(mc.amount) || 8), mc.reason || '立功');
                addEB('功名', mc.name + ' 以「' + (mc.reason || '功绩') + '」著功名');
              }
            } catch (_mce) {}
          });
        }

        // 处理 NPC 互动
        if (p1.npc_interactions && Array.isArray(p1.npc_interactions) && p1.npc_interactions.length > 0) {
          var _pName = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.npc_interactions.forEach(function(it) {
            if (!it || !it.type || !it.actor || !it.target) return;
            // ── 玩家保护：actor=玩家的 autonomous 互动一律过滤（玩家应通过诏令/批奏疏/问对自行操作）──
            if (_pName && (it.actor === _pName)) {
              addEB('\u8FC7\u6EE4', 'AI 试图替玩家 ' + _pName + ' 擅自互动(' + it.type + '→' + it.target + ')，已过滤');
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
                  // 功名×SCALE 对齐 0-15000 尺度·仅正政绩(举荐/调和/师徒等)入功名;负的(构陷/背叛)属政治品行·#3 功名=政绩不直接扣
                  if (_actorCh && _typeDef.virtueActor > 0) { _cEng.adjustVirtueMerit(_actorCh, Math.round(_typeDef.virtueActor * (window.TMPromotion ? TMPromotion.SCALE : 1)), typeInfo); if (_cEng.addAchievement) _cEng.addAchievement(_actorCh, Math.min(8, _typeDef.virtueActor), typeInfo); }
                  if (_targetCh && _typeDef.virtueTarget > 0) _cEng.adjustVirtueMerit(_targetCh, Math.round(_typeDef.virtueTarget * (window.TMPromotion ? TMPromotion.SCALE : 1)), '被'+typeInfo);
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
                  if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
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
          // 势力守卫(owner 2026-06)：弹章/荐表=臣→君奏疏·须本朝臣子。异势力角色不上奏疏给玩家(其私信/通报仍可走鸿雁·见下分支)。
          // actor 解析为真实角色且非本朝→视为「非本朝臣」;无名职衔(解析为 null)属本朝官·放行。
          var _actorChDp = (typeof findCharByName==='function') ? findCharByName(actor) : null;
          var _actorNonCourt = !!(_actorChDp && typeof _memSameFactionAsPlayer === 'function' && !_memSameFactionAsPlayer(_actorChDp));
          // 按 type 分发
          if (it.type === 'impeach' || it.type === 'slander' || it.type === 'expose_secret') {
            // 弹劾/诽谤/揭发 → 奏疏（弹章）
            if (_actorNonCourt) return; // 异势力不上弹章
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, type: '弹章', subtype: '公疏',
              title: actor + '弹劾' + (it.involvedOthers && it.involvedOthers[0] ? it.involvedOthers[0] : ''),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          } else if (it.type === 'recommend' || it.type === 'guarantee' || it.type === 'petition_jointly') {
            // 举荐/担保/联名 → 奏疏
            if (_actorNonCourt) return; // 异势力不上荐表
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, type: '荐表', subtype: '公疏',
              title: actor + (it.type==='recommend'?'举荐':it.type==='guarantee'?'担保':'联名'),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          } else if (it.type === 'private_visit' || it.type === 'invite_banquet' || it.type === 'duel_poetry') {
            // 私访/宴请/切磋 → 问对（求见队列）
            // 势力守卫(2026-07-04)：殿外求见=臣候于阶下·须本朝人物。上方弹章/荐表已有 _actorNonCourt 闸·此分支原漏——外邦君主经此入求见队列再喂推演·被放大成「皇太极奏请陛下」级污染。只拦明确标了异势力者(空 faction/无名职衔沿弹章惯例视为本朝放行)。外藩正规往来走 isEnvoy 使节线(_dispatchFactionActionToPlayer)不经此处。
            if (_actorChDp && typeof _tmIsForeignCourtChar === 'function' && _tmIsForeignCourtChar(_actorChDp)) return;
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
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
              addEB('\u8FC7\u6EE4', 'AI 试图替玩家势力 ' + _pFac + ' 擅自对外 ' + it.type + '，已过滤（须玩家诏令）');
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
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
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
              // 【Codex 审查修·F2】旧存档 sc1c 阴谋无 status → 缺 status 视作 active(仅终态 failure/exposed 才排除)·否则永远推进不了。
              return (sa.schemeId && s.id === sa.schemeId) || (sa.schemer && s.schemer === sa.schemer && (s.status === 'active' || s.status == null));
            });
            if (!scheme) return;
            // 【sc1c 升级·C1 + Codex 审查修·F1】progress 双表征:sc1c=字符串阶段(ChronicleTracker 读)+数值 progressPct(推进);
            //   ★但 feudal 阴谋(tm-feudal.js)用**数值** progress·绝不可覆写成字符串(否则其数值运算变 NaN 损坏)——按 progress 类型分流。
            var _stagePctC1 = { '长期布局':15, '酝酿中':35, '即将发动':70, '已发':90 };
            var _pctToStageC1 = function(p){ return p < 25 ? '长期布局' : (p < 55 ? '酝酿中' : (p < 85 ? '即将发动' : '已发')); };
            var _tnC1 = scheme.typeName || '密谋';
            if (sa.action === 'advance') {
              var _advAmt = Math.abs(parseInt(sa.amount) || 20);
              if (typeof scheme.progress === 'string') {   // sc1c 字符串阶段 scheme
                var _pctA = (typeof scheme.progressPct === 'number') ? scheme.progressPct : (_stagePctC1[scheme.progress] || 30);
                _pctA = Math.min(100, _pctA + Math.min(_advAmt, 50));
                scheme.progressPct = _pctA; scheme.progress = _pctToStageC1(_pctA);
              } else {                                      // feudal 数值 progress scheme·直接数值加减·勿覆写成字符串
                scheme.progress = Math.min(100, (Number(scheme.progress) || 0) + Math.min(_advAmt, 50));
              }
              addEB('阴谋', scheme.schemer + '的' + _tnC1 + '被推进(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, _tnC1 + '计划推进顺利', '喜', 5, scheme.target);
            } else if (sa.action === 'disrupt') {
              var _disAmt = Math.abs(parseInt(sa.amount) || 30);
              if (typeof scheme.progress === 'string') {
                var _pctD = (typeof scheme.progressPct === 'number') ? scheme.progressPct : (_stagePctC1[scheme.progress] || 30);
                _pctD = Math.max(0, _pctD - Math.min(_disAmt, 50));
                scheme.progressPct = _pctD; scheme.progress = _pctToStageC1(_pctD);
              } else {
                scheme.progress = Math.max(0, (Number(scheme.progress) || 0) - Math.min(_disAmt, 50));
              }
              addEB('阴谋', scheme.schemer + '的' + _tnC1 + '受阻(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, _tnC1 + '计划受阻：' + (sa.reason || ''), '忧', 6, scheme.target);
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
                // v0.2\u00B7\u4E8B\u4EF6\u5E76\u5165\u5FA1\u6848\u65F6\u653F:\u88AB AI \u89E6\u53D1\u7684\u7F16\u8F91\u5668\u4E8B\u4EF6\u82E5\u5E26 choices(\u5F85\u73A9\u5BB6\u51B3\u65AD)\u2192 \u8FDB currentIssues \u5FA1\u6848\u65F6\u653F\u00B7\u8BA9\u73A9\u5BB6\u5728\u90A3\u91CC\u6289\u62E9(\u5F00\u5173\u5F00\u00B7\u590D\u7528\u5F00\u5C40\u4E8B\u4EF6 issue \u7ED3\u6784)\u3002
                //   \u65E0 choices(\u7EAF\u53D9\u4E8B/\u7EAF effect \u4E8B\u4EF6)\u2192 \u8D70\u539F addEB \u4E8B\u4EF6\u680F\u64AD\u62A5(\u8FD1\u4E8B\u901A\u77E5)\u3002\u5F00\u5173\u5173 \u2192 \u5168\u8D70\u539F addEB(\u96F6\u56DE\u5F52)\u3002
                // 选项来源:choices(开局/史实式·tianqi7 用此)优先·playerChoices(剧本作者玩家选项·{label,consequence})兜底映射→choice 结构。
                var _evChoices = (Array.isArray(gmEvt.choices) && gmEvt.choices.length) ? gmEvt.choices
                  : (Array.isArray(gmEvt.playerChoices) && gmEvt.playerChoices.length)
                    ? gmEvt.playerChoices.map(function(_pc){ return { text: _pc.label || _pc.text || '应对', desc: _pc.consequence || _pc.desc || '', aiHint: _pc.consequence || _pc.aiHint || '' }; })
                    : null;
                var _evToIssue = (typeof _eventAdjudicationOn === 'function' && _eventAdjudicationOn() && _evChoices && _evChoices.length);
                if (_evToIssue) {
                  if (!Array.isArray(GM.currentIssues)) GM.currentIssues = [];
                  var _evIid = 'issue_' + (gmEvt.id || gmEvt.name || 'evt');
                  var _evDup = GM.currentIssues.some(function(i){ return (gmEvt.id && i.sourceEventId === gmEvt.id) || i.id === _evIid; });
                  if (!_evDup) {
                    GM.currentIssues.push({
                      id: _evIid, sourceEventId: gmEvt.id || '',
                      title: gmEvt.name || '\u4E8B\u4EF6', description: gmEvt.narrative || gmEvt.description || '',
                      category: gmEvt.importance === '\u5173\u952E' ? '\u5173\u952E\u51B3\u7B56' : '\u8981\u4E8B',
                      status: 'pending', raisedTurn: GM.turn, raisedDate: GM._gameDate || '',
                      choices: _evChoices.slice(),
                      linkedChars: gmEvt.linkedChars || [], linkedFactions: gmEvt.linkedFactions || [],
                      longTermConsequences: gmEvt.longTermConsequences || null,
                      historicalNote: gmEvt.historicalNote || ''
                    });
                    addEB('\u8981\u52A1', '\u4E8B\u4EF6\u4E34\u5FA1\u6848\uFF1A' + (gmEvt.name || ''));
                  }
                } else {
                  addEB('\u4E8B\u4EF6', gmEvt.name + '\u5DF2\u89E6\u53D1' + (tt.result ? '\uFF1A' + tt.result : ''));
                }
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

  function _tmOfficeDismissKey(dept, position, holder) {
    return [dept || "", position || "", holder || ""].join("\u001f");
  }
  function _tmFindOfficePosition(nodes, dept, position) {
    var found = null;
    (function walk(list) {
      (list || []).forEach(function(node) {
        if (found || !node) return;
        if (node.name === dept && Array.isArray(node.positions)) {
          node.positions.forEach(function(pos) {
            if (!found && pos && pos.name === position) found = { node: node, pos: pos };
          });
        }
        if (!found && Array.isArray(node.subs)) walk(node.subs);
      });
    })(nodes || []);
    return found;
  }
  function _tmIsNonPunitiveOfficeExitReason(reason) {
    var text = String(reason || "");
    if (!text) return false;
    if (/罪|贪|赃|劾|弹|罢|黜|夺|革|免职|下狱|系狱|流放|处决|赐死|失职|问罪|查办|处分/.test(text)) return false;
    return /升任|晋升|擢|超擢|迁任|迁转|转任|调任|改任|补授|拜|授|入阁|起复|外放|赴任/.test(text);
  }
  function _tmBuildOfficeMoveExitMap(G, p1) {
    var map = {};
    if (!G || !p1 || !Array.isArray(p1.office_changes)) return map;
    var appointees = {};
    p1.office_changes.forEach(function(oc) {
      if (!oc || oc.action !== "appoint" || !oc.person) return;
      appointees[oc.person] = oc;
    });
    var assignments = Array.isArray(p1.office_assignments) ? p1.office_assignments : [];
    p1.office_changes.forEach(function(oc) {
      if (!oc || oc.action !== "dismiss" || !oc.dept || !oc.position) return;
      var hit = _tmFindOfficePosition(G.officeTree || [], oc.dept, oc.position);
      var holder = oc.person || oc.name || (hit && hit.pos && hit.pos.holder) || "";
      if (!holder) return;
      var paired = appointees[holder] || assignments.find(function(oa) {
        if (!oa || oa.name !== holder) return false;
        var act = oa.action || "appoint";
        return act === "appoint" || act === "transfer" || act === "promote";
      }) || null;
      if (paired || _tmIsNonPunitiveOfficeExitReason(oc.reason)) {
        map[_tmOfficeDismissKey(oc.dept, oc.position, holder)] = paired || { action: "office_move", reason: oc.reason || "" };
      }
    });
    return map;
  }

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

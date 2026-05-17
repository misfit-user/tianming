// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-ai-infer.js — 回合 AI 推演巨函数 (R110 从 tm-endturn.js L2186-12711 拆出)
//
// ⚠ 此文件仅有一个函数：async function _endTurn_aiInfer(edicts, xinglu, memRes, oldVars)
//   长约 11,330 行（更新于 2026-04-28）·是项目最大的单函数·包含 sysP prompt 构建 + sc1/sc1b/sc1c 三次 AI 子调用
//   + 所有 AI 返回字段的写回逻辑 (char_updates/factions/offices/fiscal/admin/events/harem 等)
//
// 后续工作：按 AI schema 字段族进一步拆成 tm-ai-apply-chars/factions/offices/fiscal/admin/events/harem.js
//   需先为每个字段族写 pre/post 行为快照·现阶段先做文件级隔离·内部不动
//
// 姊妹: tm-endturn-prep.js (L1-2185·前置) + tm-endturn-core.js (L12712-end·入口)
//
// R147 章节导航（更新于 2026-04-28·替代死代码为数据驱动 lifecycle 块约 80 行）：
//   §1 [L17-3120]   入参初始化 + sysP prompt 构建（包含 lifecycle 块 L54-130）
//   §2 [L3121-3200] Sub-call 注册化基础设施（_runSubcall + 共享变量声明）
//   §3 [L3201-5055] sc0/sc05/sc1/sc1b/sc1c 子调用（深度思考/记忆/主推演/文事/势力）
//   §4 [L5056-9580] sc1 写回（applyAITurnChanges + 各字段族 GM 落地）
//   §5 [L9581-end]  sc15-sc27 后续子调用 + 收尾（NPC/势力/财政/军事/审计/丰化/叙事）
// ============================================================

// [slice 3c.1·2026-05-07] externalCtx 第 5 参数·调用方传进则在 finalize 前 copy ai 内部 ctx 到 externalCtx
// 让 pipeline ctx 看到全部 sc0-sc28 子调用结果·零行为变化·为 3c.2+ 消费者迁移铺路
async function _endTurn_aiInfer(edicts, xinglu, memRes, oldVars, externalCtx) {
  // ═══════════════════════════════════════════════════════════
  // §1 入参初始化 + sysP prompt 构建
  // ═══════════════════════════════════════════════════════════
  var shizhengji="",zhengwen="",playerStatus="",playerInner="",turnSummary="";
  // 新增字段：实录、时政记标题/总结、人事变动、后人戏说
  var shiluText="",szjTitle="",szjSummary="",personnelChanges=[],hourenXishuo="";
  var timeRatio = getTimeRatio();

  // 2. AI推演
  if(P.ai.key){
    // 严格史实模式：检索数据库
    if(P.conf.gameMode === 'strict_hist' && P.conf.refText) {
      showLoading("检索数据库中",20);
    }

    showLoading("\u6253\u5305\u6570\u636E",25);
    // §1 (原 L41-3243·R209 P7-γ 迁出至 tm-endturn-prompt.js)
    // R209a (per Codex P7-β addendum)·ctx 字段补全·tp/sc2/sc_audit/sc_memwrite/sc28·_changeSummary 移 followup·suggestions 入 record
    var ctx = {
      input: {
        edicts: edicts, xinglu: xinglu, memRes: memRes, oldVars: oldVars,
        timeRatio: timeRatio
      },
      prompt: {
        sysP: '', tp: '', sc: null,
        _shiluR: null, _shiluMin: 0, _shiluMax: 0,
        _szjR: null, _szjMin: 0, _szjMax: 0,
        _hourenR: null, _hourenMin: 0, _hourenMax: 0,
        _zwR: null, _zwMin: 0, _zwMax: 0,
        _commentR: null
      },
      // ─── 待 P7-δ/ε/ζ/η 填 ───
      subcalls: { _runSubcall: null, _tok: null, _buildFetchBody: null, _truncatedOnce: false, _effectiveOutCap: 0, _checkTruncated: null },
      results: {
        sc0: null, sc05: null, sc1: null, sc1b: null, sc1c: null, sc07: null,
        sc15: null, sc_memwrite: null, sc16: null, sc17: null, sc18: null,
        sc_audit: null, sc2: null, sc25: null, sc27: null, sc28: null,
        sc_consolidate: null
      },
      apply: {
        _hardConstraints: '',
        applied: { chars: null, factions: null, offices: null, fiscal: null, admin: null, events: null, harem: null }
      },
      followup: {
        _changeSummary: [],   // R209a·从 apply 移此 (per Codex addendum)·§5 produce
        npcDeep: null, fiscalMil: null, narrative: null
      },
      record: {
        shizhengji: '', zhengwen: '', playerStatus: '', playerInner: '', turnSummary: '',
        shiluText: '', szjTitle: '', szjSummary: '', personnelChanges: [], hourenXishuo: '',
        suggestions: []       // R209a?added per Codex addendum
      },
      meta: { errors: [], warnings: [], timing: {}, retries: {} }
    };
    await TM.Endturn.AI.prompt.build(ctx);
    // re-bind locals·§2-§5 仍以原 var name 引用 (最小 diff)
    var sysP = ctx.prompt.sysP;
    var tp = ctx.prompt.tp;       // R209a·sub-call prompt base·§3 L229 tp0·L848 tp1 用
    var sc = ctx.prompt.sc;
    var _shiluR = ctx.prompt._shiluR, _shiluMin = ctx.prompt._shiluMin, _shiluMax = ctx.prompt._shiluMax;
    var _szjR = ctx.prompt._szjR, _szjMin = ctx.prompt._szjMin, _szjMax = ctx.prompt._szjMax;
    var _hourenR = ctx.prompt._hourenR, _hourenMin = ctx.prompt._hourenMin, _hourenMax = ctx.prompt._hourenMax;
    var _zwR = ctx.prompt._zwR, _zwMin = ctx.prompt._zwMin, _zwMax = ctx.prompt._zwMax;
    var _commentR = ctx.prompt._commentR;

    // ═══════════════════════════════════════════════════════════
    // P7-delta bridge: section 2+3 moved to tm-endturn-ai.js.
    try{
      TM.Endturn.AI.subcalls.setupInfra(ctx);
      var url = ctx.subcalls.url;
      var _tok = ctx.subcalls._tok;
      var _buildFetchBody = ctx.subcalls._buildFetchBody;
      var _checkTruncated = ctx.subcalls._checkTruncated;
      var _effectiveOutCap = ctx.subcalls._effectiveOutCap;
      var _modelTemp = ctx.subcalls._modelTemp;
      var _modelFamily = ctx.subcalls._modelFamily;
      var _subcallMeta = [];
      var _quietLoad = null;
      var _maybeCacheSys = null;
      var _runSubcall = null;
      var _runSubcallBatch = null;
      var _queuePostTurnSubcall = null;
      var _flushQueuedPostTurnSubcalls = null;
      var _awaitQueuedPostTurnSubcallsById = null;
      var aiThinking = "";
      var memoryReview = "";
      var p1 = null;
      var p2 = null;
      var p1Summary = "";
      await TM.Endturn.AI.subcalls.runMain(ctx, async function() {
        url = ctx.subcalls.url;
        _tok = ctx.subcalls._tok;
        _buildFetchBody = ctx.subcalls._buildFetchBody;
        _checkTruncated = ctx.subcalls._checkTruncated;
        _effectiveOutCap = ctx.subcalls._effectiveOutCap;
        _modelTemp = ctx.subcalls._modelTemp;
        _modelFamily = ctx.subcalls._modelFamily;
        _subcallMeta = ctx.subcalls._subcallMeta || [];
        _quietLoad = ctx.subcalls._quietLoad;
        _maybeCacheSys = ctx.subcalls._maybeCacheSys;
        _runSubcall = ctx.subcalls._runSubcall;
        _runSubcallBatch = ctx.subcalls._runSubcallBatch;
        _queuePostTurnSubcall = ctx.subcalls._queuePostTurnSubcall;
        _flushQueuedPostTurnSubcalls = ctx.subcalls._flushQueuedPostTurnSubcalls;
        _awaitQueuedPostTurnSubcallsById = ctx.subcalls._awaitQueuedPostTurnSubcallsById;
        aiThinking = ctx.results.sc0 || "";
        memoryReview = ctx.results.sc05 || "";
        p1 = ctx.results.sc1 || null;
        p2 = ctx.results.sc2 || null;
        p1Summary = (ctx.followup && ctx.followup.p1Summary) || "";
        await TM.Endturn.AI.apply.writeBack(ctx);
        p1 = ctx.results.sc1 || p1;
        p2 = ctx.results.sc2 || p2;
        p1Summary = (ctx.followup && ctx.followup.p1Summary) || p1Summary;
        shizhengji = ctx.record.shizhengji || "";
        zhengwen = ctx.record.zhengwen || "";
        playerStatus = ctx.record.playerStatus || "";
        playerInner = ctx.record.playerInner || "";
        turnSummary = ctx.record.turnSummary || "";
        shiluText = ctx.record.shiluText || "";
        szjTitle = ctx.record.szjTitle || "";
        szjSummary = ctx.record.szjSummary || "";
        personnelChanges = Array.isArray(ctx.record.personnelChanges) ? ctx.record.personnelChanges : [];
        hourenXishuo = ctx.record.hourenXishuo || "";
      }); // end Sub-call 1 _runSubcall

      // ═══════════════════════════════════════════════════════════
      // P7-zeta bridge: section 5 follow-up moved to tm-endturn-followup.js.
      await TM.Endturn.AI.followup.run(ctx);
      p1 = ctx.results.sc1 || p1;
      p2 = ctx.results.sc2 || p2;
      p1Summary = (ctx.followup && ctx.followup.p1Summary) || p1Summary;
      shizhengji = ctx.record.shizhengji || "";
      zhengwen = ctx.record.zhengwen || "";
      playerStatus = ctx.record.playerStatus || "";
      playerInner = ctx.record.playerInner || "";
      turnSummary = ctx.record.turnSummary || "";
      shiluText = ctx.record.shiluText || "";
      szjTitle = ctx.record.szjTitle || "";
      szjSummary = ctx.record.szjSummary || "";
      personnelChanges = Array.isArray(ctx.record.personnelChanges) ? ctx.record.personnelChanges : [];
      hourenXishuo = ctx.record.hourenXishuo || "";
    }
    catch(err){shizhengji="\u5931\u8D25:"+err.message;zhengwen="\u9519\u8BEF";}
  }else{
    Object.keys(GM.vars).forEach(function(n){GM.vars[n].value=clamp(GM.vars[n].value+Math.floor(random()*7)-3,GM.vars[n].min,GM.vars[n].max);});
    shizhengji="\u56FD\u5BB6\u53D8\u5316\u4E2D";zhengwen="\u65F6\u5149\u6D41\u901D";playerStatus="\u5982\u5E38";
  }
  // 存储本回合 AI 叙事摘要供 NPC 引擎使用（避免重复 API 调用）
  var _npcHandledNames = [];
  try {
    if (typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger && TM.NPC.ActionLedger.collectHandledNamesFromP1) {
      _npcHandledNames = TM.NPC.ActionLedger.collectHandledNamesFromP1(p1);
    } else {
      _npcHandledNames = (p1 && p1.npc_actions) ? p1.npc_actions.map(function(a) { return a && a.name; }).filter(Boolean) : [];
    }
  } catch(_npcHandledErr) {
    _npcHandledNames = (p1 && p1.npc_actions) ? p1.npc_actions.map(function(a) { return a && a.name; }).filter(Boolean) : [];
  }

  GM._turnContext = {
    edicts: edicts,
    shizhengji: (shizhengji || '').substring(0, 300),
    zhengwen: (zhengwen || '').substring(0, 200),
    npcActionsThisTurn: _npcHandledNames
  };

  // AI失败兜底——确保玩家至少看到时间推进的信息
  if (!shizhengji) {
    var _tsF = typeof getTSText === 'function' ? getTSText(GM.turn) : '本期';
    shizhengji = _tsF + '，天下暂无大事。（AI推演未返回有效数据）';
  }
  if (!zhengwen) zhengwen = '时移事去，朝堂内外一切如故。';

  // 清洗·剥除 HTML 残片/onclick/event 引号序列/markdown 链接·防 AI 污染
  function _stripHtmlResidue(s) {
    if (!s || typeof s !== 'string') return s;
    // 1. 剥除 HTML 标签 <tag>...</tag> 或 <tag />
    s = s.replace(/<[^>]+>/g, '');
    // 2. 剥除 onclick/onmouseover 等事件属性残片·如 `', event)">`  `, event)>` 等
    s = s.replace(/['"]?\s*,?\s*event\s*\)['"]?\s*>?/g, '');
    s = s.replace(/onclick\s*=\s*['"][^'"]*['"]/g, '');
    // 3. 剥除 markdown 链接 [text](url)·保留 text
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // 4. 剥除可疑 JS 协议
    s = s.replace(/javascript:[^\s,·]*/g, '');
    // 5. 规范化多余空白
    s = s.replace(/\s+,/g, '，').replace(/\s*>+\s*/g, '').replace(/\s{3,}/g, ' ');
    return s;
  }
  shizhengji = _stripHtmlResidue(shizhengji);
  zhengwen = _stripHtmlResidue(zhengwen);
  if (shiluText) shiluText = _stripHtmlResidue(shiluText);
  if (hourenXishuo) hourenXishuo = _stripHtmlResidue(hourenXishuo);

  // P7-η bridge·写回 sanitized locals 至 ctx.record·调 record.finalize 替原 inline return
  // no-AI 路径 ctx 未建·此处 fallback 建最小 ctx 以供 finalize
  ctx = ctx || { input: {}, record: {} };
  ctx.input = ctx.input || {};
  ctx.input.timeRatio = timeRatio;
  ctx.record = ctx.record || {};
  ctx.record.shizhengji = shizhengji;
  ctx.record.zhengwen = zhengwen;
  ctx.record.playerStatus = playerStatus;
  ctx.record.playerInner = playerInner;
  ctx.record.turnSummary = turnSummary;
  ctx.record.shiluText = shiluText || '';
  ctx.record.szjTitle = szjTitle || '';
  ctx.record.szjSummary = szjSummary || '';
  ctx.record.personnelChanges = personnelChanges || [];
  ctx.record.hourenXishuo = hourenXishuo || '';
  // suggestions·优先 ctx.record.suggestions (P7-ζ followup 已写自 sc2)·非 (p2&&p2.suggestions) 直 (per Codex addendum)
  ctx.record.suggestions = Array.isArray(ctx.record.suggestions) ? ctx.record.suggestions : [];

  // [slice 3c.1·2026-05-07] 把内部 ctx 关键字段 copy 到 externalCtx·让 pipeline ctx 能看到全部子调用结果
  // 不动消费方·此为 paving·3c.2 起 render/post-ai-edict 等才改读 ctx.results 而非 GM._turnAiResults
  if (externalCtx && typeof externalCtx === 'object') {
    try {
      externalCtx.results = Object.assign(externalCtx.results || {}, ctx.results || {});
      externalCtx.apply = Object.assign(externalCtx.apply || {}, ctx.apply || {});
      externalCtx.followup = Object.assign(externalCtx.followup || {}, ctx.followup || {});
      externalCtx.record = Object.assign(externalCtx.record || {}, ctx.record || {});
      externalCtx.prompt = Object.assign(externalCtx.prompt || {}, ctx.prompt || {});
      if (!externalCtx.meta) externalCtx.meta = {};
      externalCtx.meta.aiInferMeta = ctx.meta;
    } catch(_3cE) { try { console.warn('[ai-infer 3c.1] external ctx export failed', _3cE); } catch(_){} }
  }

  return TM.Endturn.AI.record.finalize(ctx);
}

// ══════ §E 系统更新已迁移到 tm-endturn-systems.js (R95) ══════
// - _endTurn_updateSystems(timeRatio, zhengwen)
// ═══════════════════════════════════════════════════════

/** Step 4: 渲染 + 存档 — UI 更新、史记显示、自动存档 */
// ============================================================
//  endTurn() — 主调度器，按阶段调用子函数
// ============================================================
/** 主回合推演入口（玩家点击"静待时变"触发） */
// ══════ 朝会追踪+post-turn 决策已迁移到 tm-court-meter.js (R96) ══════
// - recordCourtHeld / _settleCourtMeter
// - _showPostTurnCourtPromptAndStartEndTurn / _postTurnCourtChoose
// - _showPostTurnCourtBanner / _updatePostTurnCourtBanner / _hidePostTurnCourtBanner
// - _onPostTurnCourtEnd (async)
// ═══════════════════════════════════════════════════════

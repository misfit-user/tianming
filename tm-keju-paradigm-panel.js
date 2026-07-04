// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   科举改革议题构造 panel（Stage 2·Phase L·点「⚖️ 改革科举范式」开 reform proposal modal）
//   §L2 议题构造   _kjpOpenReformProposal · 复选 11 大类 paradigm 字段 · _kjpBuildTopicText
//   §L3 幅度/试点  改革幅度 · 试点 · 朝议预判（各党 stance 分布）· 召对
//   §L4 策对       召史策对（b）· 对比策对（f2·timeline +/✓ 按钮）
//   §提交         _kjpSubmitReform → keyi topicType=reform → tinyi v3 8 阶段议政 → L7 apply
//   §回滚         _kjpL11OpenRollbackModal
// ─────────────────────────────────────────────
/**
 * tm-keju-paradigm-panel.js — Stage 2·Phase L·Slice L2·改革议题构造 panel
 * v1.2·post-audit·event delegation + 全 30+ 字段 UI 暴露 (P0+P1 修)
 *
 * 职责·让玩家点 "⚖️ 改革科举范式" 按钮·开 reform proposal modal·
 *      复选 11 大类 paradigm 字段·实时显示议题文本 + 各党 stance 分布·
 *      提交走现 keyi `topicType='reform'`·tinyi v3 8 阶段议政·议毕 L7 apply。
 *
 * red line·
 *   - 无草稿·点开 panel·改完即上奏 (无 save/discard)·跟"筹办"按钮 paradigm 一致
 *   - 无 hardcode 党名·遍历 GM.parties + 调 _ty3_initialStanceFromDims·跟 F4c 一致
 *   - 议题走 keyi `topicType='reform'`·非新 modal 议政
 *   - NPC 反应 0 自造·全复用 tinyi v3
 *   - flag gate·P.conf.useNewKejuL !== false（默认开）·仅显式设 =false 才隐藏按钮
 *   - event delegation·rerender 不重 bind·避免 listener 双绑
 *
 * 集成点·
 *   - tm-keju.js openKejuPanel·已 enabled 分支加 "⚖️ 改革科举范式" 按钮
 *   - 按钮 onclick = _kjpOpenReformProposal()
 *   - 提交 → openKeyiSession({topicType:'reform', topicData:{paradigmDiff,...}})
 *
 * ⚠️ L3·R5·跨阶段 TODO·留 placeholder·后续 slice 接·
 *   - L3 write·`npc._kjpReformLean` (NPC 改革倾向累积) + `GM._kjpPrivateAudienceLog` (召对历史 cap 50·save 保)
 *   - L3 透传·topicData.{magnitudeDescriptor / magnitudeParsed / pilotScope / pilotCandidates /
 *                       courtMoodNarrative / courtMoodScale / courtMoodKeyNpcs / privateAudiences / isForced}
 *   - L4·tinyi v3 read·_ty3_initialStanceFromDims 加 read `npc._kjpReformLean` → 调 stance intensity
 *   - L4·tinyi v3 read·议政 prompt 加 magnitudeDescriptor + pilotScope·NPC 知幅度/试点
 *   - L7·议政通过 → 真 apply paradigmDiff 到 GM._kejuParadigm·写 chronicle
 *   - L7·apply 时·参考 magnitudeParsed.years 决定生效速度·参考 pilotScope 决定生效范围
 */
(function(global) {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·常量
  // ════════════════════════════════════════════════════════════════

  var NEUTRAL_PARTIES = ['中立', '无党', '无党派'];


  // ══ 立项拆分 alias（2026-07-04·alias 范式首例）══════════════════
  //  渲染族 25 函数+9 常量表本体在 tm-keju-paradigm-panel-render.js（载于本文件之前·勿动序）
  //  以下绑回闭包本地名·§5-§L10 业务体 0 改动·vm 沙箱只载本文件时这些名=undefined(烟测须先载 sibling)
  var _KJPR = (global.TM && global.TM.Keju && global.TM.Keju.ParadigmPanelRender) || {};
  var SUBJECT_CANDIDATES = _KJPR.SUBJECT_CANDIDATES;
  var PENALTY_OPTIONS = _KJPR.PENALTY_OPTIONS;
  var EXAMINER_TYPE_OPTIONS = _KJPR.EXAMINER_TYPE_OPTIONS;
  var INSPECTION_LEVEL_OPTIONS = _KJPR.INSPECTION_LEVEL_OPTIONS;
  var RANKING_RULE_OPTIONS = _KJPR.RANKING_RULE_OPTIONS;
  var FEE_REIMBURSEMENT_OPTIONS = _KJPR.FEE_REIMBURSEMENT_OPTIONS;
  var RETAKE_OPTIONS = _KJPR.RETAKE_OPTIONS;
  var RESTORATION_DYNASTIES = _KJPR.RESTORATION_DYNASTIES;
  var MAGNITUDE_PRESETS = _KJPR.MAGNITUDE_PRESETS;
  var _kjpRenderProposalHtml = _KJPR._kjpRenderProposalHtml;
  var _kjpRenderSection = _KJPR._kjpRenderSection;
  var _kjpRenderMagnitudeBody = _KJPR._kjpRenderMagnitudeBody;
  var _kjpRenderPilotBody = _KJPR._kjpRenderPilotBody;
  var _kjpRenderCourtMoodBody = _KJPR._kjpRenderCourtMoodBody;
  var _kjpRenderAudienceBody = _KJPR._kjpRenderAudienceBody;
  var _kjpRenderCeduiBody = _KJPR._kjpRenderCeduiBody;
  var _kjpRenderReformObjectionChip = _KJPR._kjpRenderReformObjectionChip;
  var _kjpRenderCeduiTimeline = _KJPR._kjpRenderCeduiTimeline;
  var _kjpRenderCeduiCompare = _KJPR._kjpRenderCeduiCompare;
  var _kjpInvokeCedui = _KJPR._kjpInvokeCedui;
  var _kjpRenderSubjectsBody = _KJPR._kjpRenderSubjectsBody;
  var _kjpRenderL10PresetAction = _KJPR._kjpRenderL10PresetAction;
  var _kjpRenderL6SubjectActions = _KJPR._kjpRenderL6SubjectActions;
  var _kjpRenderL6SuggestionsBody = _KJPR._kjpRenderL6SuggestionsBody;
  var _kjpRenderTierBody = _KJPR._kjpRenderTierBody;
  var _kjpRenderCandidateBody = _KJPR._kjpRenderCandidateBody;
  var _kjpRenderExaminerBody = _KJPR._kjpRenderExaminerBody;
  var _kjpRenderQuotaBody = _KJPR._kjpRenderQuotaBody;
  var _kjpRenderAllocationBody = _KJPR._kjpRenderAllocationBody;
  var _kjpRenderIdentityBody = _KJPR._kjpRenderIdentityBody;
  var _kjpRenderLinkageBody = _KJPR._kjpRenderLinkageBody;
  var _kjpRenderCeremonyBody = _KJPR._kjpRenderCeremonyBody;
  var _kjpRenderPenaltyBody = _KJPR._kjpRenderPenaltyBody;
  var _kjpRenderLangMetaBody = _KJPR._kjpRenderLangMetaBody;


  // ════════════════════════════════════════════════════════════════
  // §1·flag gate
  // ════════════════════════════════════════════════════════════════

  function _kjpIsLEnabled() {
    if (typeof P === 'undefined' || !P) return false;
    if (!P.conf) return true;
    return P.conf.useNewKejuL !== false;
  }

  // ════════════════════════════════════════════════════════════════
  // §2·主入口·_kjpOpenReformProposal
  // ════════════════════════════════════════════════════════════════

  function _kjpOpenReformProposal() {
    if (!_kjpIsLEnabled()) {
      try { if (typeof toast === 'function') toast('⚠️ 科举改革系统已被关闭（默认开·如需重开，控制台设 P.conf.useNewKejuL=true）'); } catch(_){}
      return;
    }
    if (typeof GM === 'undefined' || !GM._kejuParadigm) {
      try { if (typeof toast === 'function') toast('⚠️ 科举 paradigm 未初始化'); } catch(_){}
      return;
    }
    if (typeof document === 'undefined') return;  // smoke 环境

    // A1 修·幂等·若 reform modal 已存·先移除·防双开
    var existingReform = document.getElementById('kjp-reform-modal');
    if (existingReform) existingReform.remove();
    // RX·C5·防御·reset L4 cedui window globals·防上次 panel session 残留
    // RZ·Z8·删 _kjpCurrentCeduiNpcName 死代码 (写入但从未读·hook 拿参数 npcName 从 wendui)
    try {
      window._kjpCurrentCeduiDraft = null;
      window._kjpCurrentCeduiDiff = null;
      window._kjpCurrentCeduiDigest = '';
      window._kjpCurrentCeduiArchetype = null;
    } catch(_){}

    var kp = document.getElementById('keju-panel-modal');
    var wasFromKejuPanel = !!kp;
    if (kp) kp.remove();

    var modal = document.createElement('div');
    modal.className = 'modal-bg show';
    modal.id = 'kjp-reform-modal';

    var draft = _kjpInitDraft();
    modal._kjpDraft = draft;
    modal._kjpWasFromKejuPanel = wasFromKejuPanel;  // C2 修·记开 panel 时是否从 keju panel 来
    modal.innerHTML = _kjpRenderProposalHtml(draft);
    document.body.appendChild(modal);

    _kjpBindEventDelegation(modal);
    _kjpRefreshPreview(modal);

    // L-C·s5·A2·首开 toast 一次性提示·persist localStorage
    try {
      if (typeof localStorage !== 'undefined' &&
          !localStorage.getItem('tm_lc_intro_seen')) {
        if (typeof toast === 'function') {
          toast('💡 改革面板已重整·头部含快捷按钮·点 [📜 改革志] 看历史');
        }
        localStorage.setItem('tm_lc_intro_seen', '1');
      }
    } catch(_){}
  }

  // ════════════════════════════════════════════════════════════════
  // §3·init draft·临时 in-memory copy·非持久
  // ════════════════════════════════════════════════════════════════


  function _kjpInitDraft() {
    var p = GM._kejuParadigm;
    return {
      // L3·新加
      magnitudeDescriptor: '',           // 古文·user 输入或选 preset
      magnitudeDescriptorPreset: '',     // preset key
      magnitudeParsed: null,             // LLM 解读·{scale, tags, years, reversible, paraphrase}

      pilotScope: { name: '全国一举', reason: '默认·中枢直辖', source: 'default' },
      pilotCandidates: [],               // LLM 推 5 候选·缓存
      pilotLoading: false,

      courtMoodNarrative: '',            // LLM 古文 (启始空)
      courtMoodScale: 50,                // 内部 number
      courtMoodKeyNpcs: [],              // 关键 NPC names
      courtMoodLoading: false,
      courtMoodLastDiffHash: '',         // M4·上次 LLM 评估时的 diff 哈希
      courtMoodStale: false,             // M4·paradigm 改后但未重算 → true

      privateAudiences: [],              // 私谈历史·[{npc, intent, llmReply, costApplied, ts}]
      audienceLoading: false,            // M7·LLM 召对调用中
      isForced: false,

      // copy 全 paradigm 字段·draft 跟 base
      subjectsBase: _deepClone(p.subjects),
      subjectsDraft: _deepClone(p.subjects),
      tiersBase: _deepClone(p.tiers),
      tiersDraft: _deepClone(p.tiers),
      examIntervalBase: p.examInterval, examIntervalDraft: p.examInterval,
      retakePolicyBase: p.retakePolicy, retakePolicyDraft: p.retakePolicy,
      examinerRulesBase: _deepClone(p.examinerRules),
      examinerRulesDraft: _deepClone(p.examinerRules),
      candidateRulesBase: _deepClone(p.candidateRules),
      candidateRulesDraft: _deepClone(p.candidateRules),
      quotaBase: _deepClone(p.quota),
      quotaDraft: _deepClone(p.quota),
      rankingRuleBase: p.rankingRule, rankingRuleDraft: p.rankingRule,
      allocationRulesBase: _deepClone(p.allocationRules),
      allocationRulesDraft: _deepClone(p.allocationRules),
      ideologyBase: p.ideology, ideologyDraft: p.ideology,
      graduateTitleBase: p.graduateTitle, graduateTitleDraft: p.graduateTitle,
      cohortBondStrengthBase: p.cohortBondStrength, cohortBondStrengthDraft: p.cohortBondStrength,
      mentorLineageBase: p.mentorLineage, mentorLineageDraft: p.mentorLineage,
      schoolIntegrationBase: p.schoolIntegration, schoolIntegrationDraft: p.schoolIntegration,
      taxPrivilegeBase: _deepClone(p.taxPrivilege),
      taxPrivilegeDraft: _deepClone(p.taxPrivilege),
      shadowBase: p.shadow, shadowDraft: p.shadow,
      clanPrivilegeBase: p.clanPrivilege, clanPrivilegeDraft: p.clanPrivilege,
      ceremonyBase: _deepClone(p.ceremony),
      ceremonyDraft: _deepClone(p.ceremony),
      penaltiesBase: _deepClone(p.penalties),
      penaltiesDraft: _deepClone(p.penalties),
      languageBase: p.language, languageDraft: p.language,
      intent: 'reform',         // 'reform' / 'restoration'
      restorationDynasty: '',   // 复古议·复哪朝
      _userEditedTopic: null,
      // RAA·B2·L6 state·non-undefined·防 render 时 undefined access
      l6Loading: false,
      l6Suggestions: [],
      // RBB·BB-B3·gen token·stale promise 写已关闭 draft 的 guard
      _l6Gen: 0,
      // RBB·BB-C1·已 accept 的 suggestion id set·UI 显 "已加入" disabled
      _l6AcceptedIds: {},
      // L10·v2·C3·preset 字段默 null·每开 modal 清·防跨议题 leak
      _l10PresetId: null,
      _l10PresetCanonicalName: null,
      _l10PresetHistoricalEvaluation: null,
      _l10PresetBy: null
    };
  }

  // ══ 【立项拆分 2026-07-04】§4·render modal HTML(原§229-954·渲染族25函数) ══
  //  → tm-keju-paradigm-panel-render.js（载于本文件之前）·经头部 alias 回绑·体 0 改动


  // ════════════════════════════════════════════════════════════════
  // §5·event delegation·A1 修·一处 listener·rerender 不重 bind
  // ════════════════════════════════════════════════════════════════

  function _kjpBindEventDelegation(modal) {
    if (modal._kjpListenersBound) return;
    modal._kjpListenersBound = true;
    // A5 修·input 只处理 text/number/range/textarea·避免 checkbox 双触发 (input + change)
    modal.addEventListener('input', function(e) {
      var t = e.target;
      if (!t) return;
      var tag = t.tagName;
      var ty = t.type;
      if (ty === 'text' || ty === 'number' || ty === 'range' || tag === 'TEXTAREA') {
        _kjpHandleInputOrChange(modal, e);
      }
    });
    modal.addEventListener('change', function(e) {
      var t = e.target;
      if (!t) return;
      var tag = t.tagName;
      var ty = t.type;
      // change 处理 checkbox / radio / select
      if (ty === 'checkbox' || ty === 'radio' || tag === 'SELECT') {
        _kjpHandleInputOrChange(modal, e);
      }
    });
    modal.addEventListener('click', function(e) { _kjpHandleClick(modal, e); });
  }

  // C5 修·debounce refresh·100ms·避免 range slider 频繁触发
  function _kjpRefreshPreviewDebounced(modal) {
    if (modal._kjpRefreshTimer) {
      try { clearTimeout(modal._kjpRefreshTimer); } catch(_){}
    }
    modal._kjpRefreshTimer = setTimeout(function() {
      _kjpRefreshPreview(modal);
      modal._kjpRefreshTimer = null;
    }, 100);
  }

  function _kjpHandleInputOrChange(modal, e) {
    var t = e.target;
    if (!t || !t.classList) return;
    var draft = modal._kjpDraft;
    if (!draft) return;
    var refresh = true;

    // RX·A1·cedui advisor dropdown change·更新按钮文案 dynamic
    if (t.classList.contains('kjp-cedui-advisor')) {
      try {
        var ceduiBtn = modal.querySelector('.kjp-cedui-btn');
        if (ceduiBtn) {
          ceduiBtn.textContent = t.value
            ? '▶ 召 ' + t.value + ' 策对 (5 精力)'
            : '▶ 召 advisor 策对 (5 精力)';
        }
      } catch(_){}
      return;   // 无需 refresh preview
    }

    // intent radio
    if (t.name === 'kjp-intent') {
      draft.intent = t.value;
      // toggle restoration dynasty input
      var resSpan = modal.querySelector('.kjp-restoration-dyn');
      if (resSpan) resSpan.style.display = (t.value === 'restoration') ? '' : 'none';
    }
    else if (t.id === 'kjp-restoration-dynasty') { draft.restorationDynasty = t.value; }
    // subjects
    else if (t.classList.contains('kjp-subject-weight')) {
      var idx = parseInt(t.dataset.idx, 10);
      if (draft.subjectsDraft[idx]) {
        draft.subjectsDraft[idx].weight = parseInt(t.value, 10) || 0;
        var span = t.parentNode.querySelector('.kjp-subject-weight-val');
        if (span) span.textContent = (parseInt(t.value, 10) || 0) + '%';
        _kjpL10MarkUserEdited(draft);   // L10·RAA·C1·改 subject weight·清 preset 标记
      }
    }
    // tier
    else if (t.classList.contains('kjp-exam-interval')) { draft.examIntervalDraft = parseInt(t.value, 10) || 0; }
    else if (t.classList.contains('kjp-retake-policy')) { draft.retakePolicyDraft = t.value; }
    // candidate
    else if (t.classList.contains('kjp-cand-allow-foreigner')) { draft.candidateRulesDraft.allowForeigner = t.checked; }
    else if (t.classList.contains('kjp-cand-allow-minority')) { draft.candidateRulesDraft.allowMinority = t.checked; }
    else if (t.classList.contains('kjp-cand-require-prefecture')) { draft.candidateRulesDraft.requirePrefecture = t.checked; }
    else if (t.classList.contains('kjp-cand-require-rec')) { draft.candidateRulesDraft.requireRecommendation = t.checked; }
    else if (t.classList.contains('kjp-cand-min-age')) { draft.candidateRulesDraft.minAge = parseInt(t.value, 10) || 0; }
    else if (t.classList.contains('kjp-cand-max-age')) { draft.candidateRulesDraft.maxAge = parseInt(t.value, 10) || 0; }
    else if (t.classList.contains('kjp-cand-fee')) { draft.candidateRulesDraft.feeReimbursement = t.value; }
    // examiner
    else if (t.classList.contains('kjp-ex-type')) {
      var tp = t.dataset.type;
      if (!Array.isArray(draft.examinerRulesDraft.type)) draft.examinerRulesDraft.type = [];
      var arr = draft.examinerRulesDraft.type;
      var i = arr.indexOf(tp);
      if (t.checked && i < 0) arr.push(tp);
      else if (!t.checked && i >= 0) arr.splice(i, 1);
    }
    else if (t.classList.contains('kjp-ex-min-years')) { draft.examinerRulesDraft.minYears = parseInt(t.value, 10) || 0; }
    else if (t.classList.contains('kjp-ex-blind-scoring')) { draft.examinerRulesDraft.blindScoring = t.checked; }
    else if (t.classList.contains('kjp-ex-blind-copying')) { draft.examinerRulesDraft.blindCopying = t.checked; }
    else if (t.classList.contains('kjp-ex-avoid')) {
      if (!draft.examinerRulesDraft.avoidanceRules) draft.examinerRulesDraft.avoidanceRules = {};
      draft.examinerRulesDraft.avoidanceRules[t.dataset.key] = t.checked;
    }
    else if (t.classList.contains('kjp-ex-inspection')) { draft.examinerRulesDraft.inspectionLevel = t.value; }
    else if (t.classList.contains('kjp-ex-mentor-bond')) { draft.examinerRulesDraft.mentorBondStrength = t.value; }
    else if (t.classList.contains('kjp-ex-leak-penalty')) { draft.examinerRulesDraft.leakPenalty = t.value; }
    // quota
    else if (t.classList.contains('kjp-quota-total')) { draft.quotaDraft.total = parseInt(t.value, 10) || 0; }
    else if (t.classList.contains('kjp-ranking-rule')) { draft.rankingRuleDraft = t.value; }
    else if (t.classList.contains('kjp-quota-enabled')) {
      if (!draft.quotaDraft.ratios) draft.quotaDraft.ratios = {};
      var dim = t.dataset.dim;
      if (!draft.quotaDraft.ratios[dim]) draft.quotaDraft.ratios[dim] = { enabled: false, values: {} };
      draft.quotaDraft.ratios[dim].enabled = t.checked;
    }
    else if (t.classList.contains('kjp-quota-values')) {
      var dim2 = t.dataset.dim;
      if (!draft.quotaDraft.ratios) draft.quotaDraft.ratios = {};
      if (!draft.quotaDraft.ratios[dim2]) draft.quotaDraft.ratios[dim2] = { enabled: false, values: {} };
      // C1 修·JSON 无效·UI 红框 + 不 refresh
      try {
        var parsed = JSON.parse(t.value);
        draft.quotaDraft.ratios[dim2].values = parsed;
        t.classList.remove('kjp-input-error');
      } catch(_) {
        t.classList.add('kjp-input-error');
        refresh = false;
      }
    }
    // allocation
    else if (t.classList.contains('kjp-alloc-count')) {
      var ck = t.dataset.class;
      if (!draft.allocationRulesDraft[ck]) draft.allocationRulesDraft[ck] = { count:0, positions:[] };
      draft.allocationRulesDraft[ck].count = parseInt(t.value, 10) || 0;
    }
    else if (t.classList.contains('kjp-alloc-positions')) {
      var pk = t.dataset.class;
      if (!draft.allocationRulesDraft[pk]) draft.allocationRulesDraft[pk] = { count:0, positions:[] };
      draft.allocationRulesDraft[pk].positions = t.value.split(/[,\s，、]+/).filter(function(x){return x;});
    }
    else if (t.classList.contains('kjp-alloc-waiting')) { draft.allocationRulesDraft.waitingYears = parseInt(t.value, 10) || 0; }
    else if (t.classList.contains('kjp-alloc-imp-review')) { draft.allocationRulesDraft.imperialReviewRequired = t.checked; }
    else if (t.classList.contains('kjp-alloc-post-adj')) { draft.allocationRulesDraft.posthumousAdjustment = t.checked; }
    // identity
    else if (t.classList.contains('kjp-id-graduate-title')) { draft.graduateTitleDraft = t.value; }
    else if (t.classList.contains('kjp-id-cohort-bond')) { draft.cohortBondStrengthDraft = t.value; }
    else if (t.classList.contains('kjp-id-mentor-lineage')) { draft.mentorLineageDraft = t.checked; }
    // linkage
    else if (t.classList.contains('kjp-lk-school-int')) { draft.schoolIntegrationDraft = t.value; }
    else if (t.classList.contains('kjp-lk-tax-jinshi')) { if(!draft.taxPrivilegeDraft) draft.taxPrivilegeDraft={}; draft.taxPrivilegeDraft.jinshi = t.checked; }
    else if (t.classList.contains('kjp-lk-tax-juren')) { if(!draft.taxPrivilegeDraft) draft.taxPrivilegeDraft={}; draft.taxPrivilegeDraft.juren = t.checked; }
    else if (t.classList.contains('kjp-lk-tax-xiucai')) { if(!draft.taxPrivilegeDraft) draft.taxPrivilegeDraft={}; draft.taxPrivilegeDraft.xiucai = t.checked; }
    else if (t.classList.contains('kjp-lk-shadow')) { draft.shadowDraft = t.value; }
    else if (t.classList.contains('kjp-lk-clan-priv')) { draft.clanPrivilegeDraft = t.checked; }
    // ceremony
    else if (t.classList.contains('kjp-cer-palace-test')) { if(!draft.ceremonyDraft) draft.ceremonyDraft={}; draft.ceremonyDraft.palaceTest = t.value; }
    else if (t.classList.contains('kjp-cer-roster')) { if(!draft.ceremonyDraft) draft.ceremonyDraft={}; draft.ceremonyDraft.rosterRelease = t.value; }
    else if (t.classList.contains('kjp-cer-flower-riding')) { if(!draft.ceremonyDraft) draft.ceremonyDraft={}; draft.ceremonyDraft.flowerRiding = t.checked; }
    else if (t.classList.contains('kjp-cer-name-stele')) { if(!draft.ceremonyDraft) draft.ceremonyDraft={}; draft.ceremonyDraft.nameStele = t.checked; }
    else if (t.classList.contains('kjp-cer-banquet')) { if(!draft.ceremonyDraft) draft.ceremonyDraft={}; draft.ceremonyDraft.bondingBanquet = t.checked; }
    else if (t.classList.contains('kjp-cer-kowtow')) { if(!draft.ceremonyDraft) draft.ceremonyDraft={}; draft.ceremonyDraft.kowtowRound = parseInt(t.value, 10) || 0; }
    // penalty
    else if (t.classList.contains('kjp-pen-cheating')) { if(!draft.penaltiesDraft) draft.penaltiesDraft={}; draft.penaltiesDraft.cheating = t.value; }
    else if (t.classList.contains('kjp-pen-leak')) { if(!draft.penaltiesDraft) draft.penaltiesDraft={}; draft.penaltiesDraft.leak = t.value; }
    else if (t.classList.contains('kjp-pen-taboo')) { if(!draft.penaltiesDraft) draft.penaltiesDraft={}; draft.penaltiesDraft.taboo = t.value; }
    else if (t.classList.contains('kjp-pen-bribery')) { if(!draft.penaltiesDraft) draft.penaltiesDraft={}; draft.penaltiesDraft.bribery = t.value; }
    // lang + meta
    else if (t.classList.contains('kjp-lm-language')) { draft.languageDraft = t.value; }
    else if (t.classList.contains('kjp-lm-ideology')) { draft.ideologyDraft = t.value; _kjpL10MarkUserEdited(draft); }
    // topic 文本 user 手改
    else if (t.id === 'kjp-topic-text') {
      draft._userEditedTopic = t.value;
      refresh = false;
    }
    else {
      refresh = false;  // 未识别·不 refresh
    }

    // C5 修·debounce·避免 range slider 频繁触发
    if (refresh) _kjpRefreshPreviewDebounced(modal);
  }

  function _kjpHandleClick(modal, e) {
    var t = e.target;
    if (!t || !t.classList) return;
    var draft = modal._kjpDraft;
    if (!draft) return;

    if (t.classList.contains('kjp-close-btn') || t.classList.contains('kjp-cancel-btn')) {
      var wasFromKeju = modal._kjpWasFromKejuPanel;
      // A1 修·清 debounce timer·防 modal 已 remove 后 fire·僵尸 refresh
      if (modal._kjpRefreshTimer) {
        try { clearTimeout(modal._kjpRefreshTimer); } catch(_){}
        modal._kjpRefreshTimer = null;
      }
      // L10·RBB·BB-A1·auto-close L10/L8 子 modal·防 stale write
      try {
        var l10m = document.getElementById('kjp-l10-preset-modal');
        if (l10m) l10m.remove();
        var l8m = document.getElementById('kjp-l8-chronicle-modal');
        if (l8m) l8m.remove();
      } catch(_){}
      modal.remove();
      // C2 修·若从 keju panel 来·关后回 keju panel
      if (wasFromKeju) {
        try { if (typeof openKejuPanel === 'function') openKejuPanel(); } catch(_){}
      }
      return;
    }
    // L8·e·改革志 button·弹独立 modal
    if (t.classList.contains('kjp-l8-chronicle-btn')) {
      try { _kjpOpenL8ChronicleModal(); } catch(e) { try { console.warn('[L8 open]', e); } catch(_){} }
      return;
    }
    // L-C·s5·sub-header 快捷 rollback button·开 L11 modal·target 自取 _reformInProgress
    if (t.classList.contains('kjp-lc-quick-rollback-btn')) {
      var rid = t.dataset.rid;
      if (!rid) return;
      var paradigmQ = (typeof GM !== 'undefined' && GM && GM._kejuParadigm) || {};
      var targetQ = null;
      var hlQ = paradigmQ.history || [];
      for (var qi = 0; qi < hlQ.length; qi++) {
        if (hlQ[qi] && hlQ[qi].id === rid) { targetQ = hlQ[qi]; break; }
      }
      if (targetQ && typeof window !== 'undefined' &&
          typeof window._kjpL11OpenRollbackModal === 'function') {
        try { window._kjpL11OpenRollbackModal(targetQ); } catch(err) {
          try { console.warn('[L-C·s5 quick-rollback]', err); } catch(_){}
        }
      }
      return;
    }
    // L10·历史模板 button·弹独立 modal
    if (t.classList.contains('kjp-l10-open-btn')) {
      try { _kjpOpenL10PresetModal(modal); } catch(e) { try { console.warn('[L10 open]', e); } catch(_){} }
      return;
    }
    if (t.classList.contains('kjp-submit-btn')) {
      _kjpSubmitFromModal(modal);
      return;
    }
    if (t.classList.contains('kjp-subject-del')) {
      var idx = parseInt(t.dataset.idx, 10);
      draft.subjectsDraft.splice(idx, 1);
      _kjpL10MarkUserEdited(draft);   // L10·RAA·C1·改 subjects·清 preset 标记
      _kjpRerenderSubjects(modal);
      _kjpRefreshPreview(modal);
      return;
    }
    if (t.classList.contains('kjp-add-subject-btn')) {
      var sel = modal.querySelector('.kjp-add-subject-select');
      if (!sel || !sel.value) return;
      var cand = SUBJECT_CANDIDATES.find(function(c) { return c.id === sel.value; });
      if (!cand) return;
      // 防 dup
      if (draft.subjectsDraft.some(function(s) { return s.id === cand.id; })) return;
      draft.subjectsDraft.push({
        id: cand.id, name: cand.name, weight: cand.defaultWeight,
        ideology: cand.ideology, format: cand.format, maxScore: 100,
        nameVariants: {}, introducedYear: null, introducedBy: null, parentSubject: null,
        examinerBias: {}, candidateBias: {}, textbookRef: null, trainingCenterRef: null,
        cohortGen: 'g-new', regionalWeight: null, customFields: {}
      });
      _kjpL10MarkUserEdited(draft);   // L10·RAA·C1·改 subjects·清 preset 标记
      _kjpRerenderSubjects(modal);
      _kjpRefreshPreview(modal);
      return;
    }
    // L6·c·LLM 推荐 button
    if (t.classList.contains('kjp-l6-suggest-btn')) {
      // RAA·C3·若 loading·skip·debounce 双击
      if (draft.l6Loading) return;
      // RAA·C1·若 helper 未载·toast 提示·非 silent return
      if (typeof window._kjpL6LlmSuggestSubjects !== 'function') {
        try { if (typeof toast === 'function') toast('⚠️ L6 LLM 推荐 helper 未载·检查脚本加载'); } catch(_){}
        return;
      }
      draft.l6Loading = true;
      // RAA·C2·覆盖前·clear 前次推荐·user 知 "新推荐 spawn 中"
      draft.l6Suggestions = [];
      // RBB·BB-B3·gen token·捕获本次·resolve 时比对·stale skip
      draft._l6Gen = (draft._l6Gen || 0) + 1;
      var thisGen = draft._l6Gen;
      _kjpRerenderSubjects(modal);
      // RBB·BB-A4·传 draft.subjectsDraft·dedup 也排同 session 已 push
      window._kjpL6LlmSuggestSubjects(5, '', draft.subjectsDraft || []).then(function(suggestions) {
        // RBB·BB-B3·stale guard·若 draft 已替换 (modal 关再开) 或 modal 已 detach·skip
        if (draft._l6Gen !== thisGen) return;
        if (modal && modal.isConnected === false) return;
        draft.l6Suggestions = suggestions || [];
        draft.l6Loading = false;
        // RBB·BB-B1·全 dedup → 0·toast 知道
        if (!draft.l6Suggestions.length) {
          try { if (typeof toast === 'function') toast('LLM 推荐均与现有 / 草案重·0 新候选·可换 hint 重推'); } catch(_){}
        }
        try { _kjpRerenderSubjects(modal); } catch(_){}
      }).catch(function() {
        if (draft._l6Gen !== thisGen) return;
        draft.l6Loading = false;
        // RAA·C1·timeout / fail·toast
        try { if (typeof toast === 'function') toast('⚠️ LLM 推荐失败·请重试'); } catch(_){}
        try { _kjpRerenderSubjects(modal); } catch(_){}
      });
      return;
    }
    // L6·c·自定义 button·user prompt + LLM 合理化
    if (t.classList.contains('kjp-l6-custom-btn')) {
      // RAA·C3·若 loading·skip
      if (draft.l6Loading) return;
      if (typeof window._kjpL6LlmRationalizeSubject !== 'function') {
        try { if (typeof toast === 'function') toast('⚠️ L6 LLM 合理化 helper 未载'); } catch(_){}
        return;
      }
      var input = (typeof window !== 'undefined' && window.prompt)
        ? window.prompt('陛下欲增何科? (一句简描·LLM 合理化)')
        : '';
      // RAA·C4·user 取消 (null) / 输空·skip 非 error
      if (input === null || input === undefined) return;
      var trimmed = String(input || '').trim();
      if (!trimmed) {
        try { if (typeof toast === 'function') toast('未输入科名·已取消'); } catch(_){}
        return;
      }
      draft.l6Loading = true;
      // RBB·BB-B3·gen token·custom path 也走 stale guard
      draft._l6Gen = (draft._l6Gen || 0) + 1;
      var cThisGen = draft._l6Gen;
      _kjpRerenderSubjects(modal);
      window._kjpL6LlmRationalizeSubject(trimmed).then(function(subject) {
        if (draft._l6Gen !== cThisGen) return;
        if (modal && modal.isConnected === false) return;
        if (subject) {
          draft.subjectsDraft = draft.subjectsDraft || [];
          // 防 dup·若 id 已存·skip + toast
          if (draft.subjectsDraft.some(function(s) { return s.id === subject.id; })) {
            try { if (typeof toast === 'function') toast('该科已在草案·skip'); } catch(_){}
          } else if (draft.subjectsDraft.some(function(s) { return s.name === subject.name; })) {
            try { if (typeof toast === 'function') toast('草案已含同名科·skip'); } catch(_){}
          } else {
            draft.subjectsDraft.push(subject);
            _kjpL10MarkUserEdited(draft);   // L10·RAA·C1·L6 LLM 加新 subject·清 preset 标记
          }
        }
        draft.l6Loading = false;
        try { _kjpRerenderSubjects(modal); } catch(_){}
        try { _kjpRefreshPreview(modal); } catch(_){}
      }).catch(function() {
        if (draft._l6Gen !== cThisGen) return;
        draft.l6Loading = false;
        try { if (typeof toast === 'function') toast('⚠️ LLM 合理化失败·请重试'); } catch(_){}
        try { _kjpRerenderSubjects(modal); } catch(_){}
      });
      return;
    }
    // L6·c·suggestion accept button·点 + 加入草案
    if (t.classList.contains('kjp-l6-accept-btn')) {
      var aidx = parseInt(t.dataset.idx, 10);
      if (draft.l6Suggestions && draft.l6Suggestions[aidx]) {
        var s = draft.l6Suggestions[aidx];
        draft.subjectsDraft = draft.subjectsDraft || [];
        // 防 dup·by id + name
        if (draft.subjectsDraft.some(function(x) { return x.id === s.id || x.name === s.name; })) {
          try { if (typeof toast === 'function') toast('该科已在草案·skip'); } catch(_){}
          return;
        }
        draft.subjectsDraft.push(s);
        _kjpL10MarkUserEdited(draft);   // L10·RAA·C1·L6 accept·清 preset 标记
        // RBB·BB-C1·mark accepted·render 显 "已加入" 替 + 按钮
        if (!draft._l6AcceptedIds) draft._l6AcceptedIds = {};
        draft._l6AcceptedIds[s.id] = true;
        _kjpRerenderSubjects(modal);
        _kjpRefreshPreview(modal);
      }
      return;
    }
    if (t.classList.contains('kjp-class-toggle')) {
      var className = t.dataset.class;
      if (!Array.isArray(draft.candidateRulesDraft.excludedClasses)) draft.candidateRulesDraft.excludedClasses = [];
      var arr = draft.candidateRulesDraft.excludedClasses;
      var i2 = arr.indexOf(className);
      if (i2 >= 0) arr.splice(i2, 1);
      else arr.push(className);
      _kjpRerenderCandidate(modal);
      _kjpRefreshPreview(modal);
      return;
    }
    if (t.classList.contains('kjp-reset-topic-btn')) {
      draft._userEditedTopic = null;
      _kjpRefreshPreview(modal);
      return;
    }
    // ─── L3·改革幅度 ───
    if (t.classList.contains('kjp-mag-preset')) {
      draft.magnitudeDescriptor = t.dataset.desc;
      draft.magnitudeDescriptorPreset = t.dataset.key;
      draft.magnitudeParsed = null;  // 重新解读
      _kjpL10MarkUserEdited(draft);   // L10·RBB·BB-B1·改 magnitudeDescriptor·清 preset 标记 (虚假命名变种)
      // R4·B4·restorative preset → intent='restoration'·非 restorative 且当前是 restoration → 回 reform
      var newIntent = _kjpDeriveIntentFromPreset(t.dataset.key, draft.intent);
      if (newIntent !== draft.intent) {
        _kjpApplyMagPresetIntent(draft, newIntent);
        // sync UI·radio + dynasty selector
        try {
          var radio = modal.querySelector('input[name="kjp-intent"][value="' + newIntent + '"]');
          if (radio) radio.checked = true;
          var resSpan = modal.querySelector('.kjp-restoration-dyn');
          if (resSpan) resSpan.style.display = (newIntent === 'restoration') ? '' : 'none';
        } catch(_){}
        // R5·D2·切到 restoration 但 dynasty 未选·toast 提示
        if (newIntent === 'restoration' && !draft.restorationDynasty) {
          try { if (typeof toast === 'function') toast('⚠️ 复古议·请选复何朝旧章 (顶部下拉)'); } catch(_){}
        }
      }
      _kjpRerenderSection(modal, 'l3-magnitude', _kjpRenderMagnitudeBody);
      _kjpInvokeMagnitudeLlm(modal);
      _kjpRefreshPreviewDebounced(modal);
      return;
    }
    if (t.classList.contains('kjp-mag-llm-btn')) {
      var inp = modal.querySelector('.kjp-mag-input');
      if (inp) draft.magnitudeDescriptor = inp.value;
      _kjpInvokeMagnitudeLlm(modal);
      return;
    }
    // ─── L3·试点 ───
    if (t.classList.contains('kjp-pilot-llm-btn')) {
      _kjpInvokePilotLlm(modal);
      return;
    }
    if (t.classList.contains('kjp-pilot-pick')) {
      var idx = parseInt(t.dataset.idx, 10);
      var cand = (draft.pilotCandidates || [])[idx];
      if (cand) {
        draft.pilotScope = { name: cand.name, reason: cand.reason, source: 'llm', historicalParallel: cand.historicalParallel };
        _kjpRerenderSection(modal, 'l3-pilot', _kjpRenderPilotBody);
        _kjpRefreshPreviewDebounced(modal);
      }
      return;
    }
    if (t.classList.contains('kjp-pilot-set-custom')) {
      var ci = modal.querySelector('.kjp-pilot-custom');
      if (ci && ci.value) {
        draft.pilotScope = { name: ci.value, reason: '玩家自定', source: 'custom' };
        _kjpRerenderSection(modal, 'l3-pilot', _kjpRenderPilotBody);
        _kjpRefreshPreviewDebounced(modal);
      }
      return;
    }
    // ─── L3·朝议预判 ───
    if (t.classList.contains('kjp-courtmood-llm-btn')) {
      _kjpInvokeCourtMoodLlm(modal);
      return;
    }
    if (t.classList.contains('kjp-key-npc')) {
      // 关键人物·一键预填入召对 NPC 输入框
      var npcName = t.dataset.npc;
      var aIn = modal.querySelector('.kjp-audience-npc');
      if (aIn) aIn.value = npcName;
      return;
    }
    // ─── L3·召对 ───
    if (t.classList.contains('kjp-audience-btn')) {
      var npcIn = modal.querySelector('.kjp-audience-npc');
      var intentSel = modal.querySelector('.kjp-audience-intent');
      if (!npcIn || !npcIn.value) {
        try { if (typeof toast === 'function') toast('⚠️ 请输 NPC 姓名'); } catch(_){}
        return;
      }
      _kjpInvokeAudienceLlm(modal, npcIn.value, intentSel ? intentSel.value : 'lure');
      return;
    }
    // ─── L4·b·召史策对 ───
    if (t.classList.contains('kjp-cedui-btn')) {
      var advSel = modal.querySelector('.kjp-cedui-advisor');
      if (!advSel || !advSel.value) {
        try { if (typeof toast === 'function') toast('⚠️ 请先选 advisor'); } catch(_){}
        return;
      }
      _kjpInvokeCedui(modal, advSel.value);
      return;
    }
    // ─── L4·f2·对比策对 (timeline 内 +/✓ 按钮) ───
    if (t.classList.contains('kjp-cedui-compare-btn')) {
      var trackId = t.dataset.trackId;
      if (!trackId) return;
      if (!modal._kjpCompareSelection) modal._kjpCompareSelection = [];
      var idx = modal._kjpCompareSelection.indexOf(trackId);
      if (idx >= 0) {
        modal._kjpCompareSelection.splice(idx, 1);
      } else {
        if (modal._kjpCompareSelection.length >= 2) {
          // RY·A3·FIFO 静默 → toast 提示 user
          try { if (typeof toast === 'function') toast('已替最早选'); } catch(_){}
          modal._kjpCompareSelection.shift();
        }
        modal._kjpCompareSelection.push(trackId);
      }
      _kjpRerenderSection(modal, 'l4-cedui', _kjpRenderCeduiBody);
      return;
    }
    if (t.classList.contains('kjp-cedui-compare-clear')) {
      modal._kjpCompareSelection = [];
      _kjpRerenderSection(modal, 'l4-cedui', _kjpRenderCeduiBody);
      return;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §L3·LLM 调用 + section rerender helper
  // ════════════════════════════════════════════════════════════════

  function _kjpRerenderSection(modal, catKey, bodyFn) {
    var sec = modal.querySelector('.kjp-cat-' + catKey + ' .kjp-section-body');
    if (sec) sec.innerHTML = bodyFn(modal._kjpDraft);
  }

  // B4·pure logic helper·smoke 可直接测·无 DOM 依赖
  function _kjpDeriveIntentFromPreset(presetKey, currentIntent) {
    if (presetKey === 'restorative') return 'restoration';
    // 从 restorative 切到非 restorative·intent 回 reform
    if (currentIntent === 'restoration' && presetKey && presetKey !== 'restorative') return 'reform';
    return currentIntent;
  }

  function _kjpApplyMagPresetIntent(draft, newIntent) {
    if (!draft) return;
    draft.intent = newIntent;
  }

  // R6·M1+M2·改革倾向累积器·clamp [-100,+100] + turn-distance decay
  //   schema·`{value:N, lastTurn:T}` (旧 number 兼容·首次写自动升级)
  //   decay·每 5 turn 衰减半值·指数·防早期承诺永不褪
  function _kjpAccumReformLean(npc, dlt, curTurn) {
    if (!npc) return null;
    var d = parseInt(dlt, 10) || 0;
    if (!d) return npc._kjpReformLean || null;   // 0 增量·不动
    var t = parseInt(curTurn, 10) || 0;
    var prev = npc._kjpReformLean;
    var existing = 0;
    if (prev && typeof prev === 'object') {
      existing = parseInt(prev.value, 10) || 0;
      var elapsed = Math.max(0, t - (parseInt(prev.lastTurn, 10) || 0));
      if (elapsed > 0) existing = Math.round(existing * Math.pow(0.5, elapsed / 5));
    } else if (typeof prev === 'number') {
      // R6·schema 迁移·旧 plain number → 一次性吸收 (无 turn stamp·无 decay)
      existing = prev;
    }
    var next = Math.max(-100, Math.min(100, existing + d));
    npc._kjpReformLean = { value: next, lastTurn: t };
    return npc._kjpReformLean;
  }

  // R6·B3·LLM 并发计数器·跨 4 invoker 共享·>=3 时 toast 背压
  //   不阻塞·不互斥·只是提示·callAISmart 本身 throttle 由 API 层处理
  function _kjpBumpLlmConcurrent(draft, delta) {
    if (!draft) return 0;
    var d = parseInt(delta, 10) || 0;
    draft._activeLlmCount = Math.max(0, (parseInt(draft._activeLlmCount, 10) || 0) + d);
    if (d > 0 && draft._activeLlmCount >= 3) {
      try { if (typeof toast === 'function') toast('⏳ ' + draft._activeLlmCount + ' 个 LLM 同时推算·建议按序点·防 rate-limit'); } catch(_){}
    }
    return draft._activeLlmCount;
  }

  async function _kjpInvokeMagnitudeLlm(modal) {
    var draft = modal._kjpDraft;
    if (!draft || !draft.magnitudeDescriptor) {
      try { if (typeof toast === 'function') toast('⚠️ 请先选 preset 或写 descriptor'); } catch(_){}
      return;
    }
    if (typeof _kjpLlmParseMagnitudeDescriptor !== 'function') return;
    // R5·B2·loading 防双击 race
    if (draft.magnitudeLoading) return;
    draft.magnitudeLoading = true;
    _kjpBumpLlmConcurrent(draft, +1);
    try {
      var res = await _kjpLlmParseMagnitudeDescriptor(draft.magnitudeDescriptor);
      // R5·B3·若 modal 已 close (cancel race)·skip 写入·R6·B2·flag 必 reset (finally 走)
      if (!modal.isConnected) return;
      draft.magnitudeParsed = res;
      _kjpRerenderSection(modal, 'l3-magnitude', _kjpRenderMagnitudeBody);
      _kjpRefreshPreviewDebounced(modal);
    } catch (e) {
      try { console.warn('[L3] magnitude llm fail', e); } catch(_){}
    } finally {
      // R6·B2·对称·任何路径 (early return / throw) 都 reset
      draft.magnitudeLoading = false;
      _kjpBumpLlmConcurrent(draft, -1);
    }
  }

  async function _kjpInvokePilotLlm(modal) {
    var draft = modal._kjpDraft;
    if (typeof _kjpLlmSuggestPilots !== 'function') return;
    // R5·B2·loading 防双击 race
    if (draft.pilotLoading) return;
    draft.pilotLoading = true;
    _kjpBumpLlmConcurrent(draft, +1);
    _kjpRerenderSection(modal, 'l3-pilot', _kjpRenderPilotBody);
    try {
      var diff = _kjpComputeDiff(draft);
      var era = (GM._kejuParadigm && GM._kejuParadigm.initEra) || '';
      var cands = await _kjpLlmSuggestPilots({ era: era, paradigmDiff: diff, magnitudeDescriptor: draft.magnitudeDescriptor });
      // R5·B3·modal cancel race
      if (!modal.isConnected) return;
      draft.pilotCandidates = cands || [];
    } catch (e) {
      try { console.warn('[L3] pilot llm fail', e); } catch(_){}
    } finally {
      // R6·B2·对称·任何路径都 reset
      draft.pilotLoading = false;
      _kjpBumpLlmConcurrent(draft, -1);
    }
    if (modal.isConnected) _kjpRerenderSection(modal, 'l3-pilot', _kjpRenderPilotBody);
  }

  async function _kjpInvokeCourtMoodLlm(modal) {
    var draft = modal._kjpDraft;
    if (typeof _kjpLlmAssessCourtMood !== 'function') return;
    // R5·B2·loading 防双击 race
    if (draft.courtMoodLoading) return;
    draft.courtMoodLoading = true;
    _kjpBumpLlmConcurrent(draft, +1);
    _kjpRerenderSection(modal, 'l3-courtmood', _kjpRenderCourtMoodBody);
    try {
      var diff = _kjpComputeDiff(draft);
      var l3Meta = _kjpExtractL3Meta(draft);
      var stances = _kjpEstimateStanceDistribution(diff, l3Meta);
      var parties = (typeof GM !== 'undefined' && Array.isArray(GM.parties)) ? GM.parties : [];
      var topicText = _kjpBuildTopicText(diff, l3Meta);
      var magTags = (draft.magnitudeParsed && draft.magnitudeParsed.tags) || ['moderate'];
      var res = await _kjpLlmAssessCourtMood({
        stances: stances, parties: parties, paradigmDiff: diff,
        topicText: topicText, magnitudeTags: magTags,
        pilotScope: draft.pilotScope    // M1·LLM 需 pilot context
      });
      // R5·B3·modal cancel race·skip 写入
      if (!modal.isConnected) return;
      draft.courtMoodNarrative = res.narrative;
      draft.courtMoodScale = res.scale;
      draft.courtMoodKeyNpcs = res.keyNpcs;
      // M4·hash 锁·标 fresh
      try { draft.courtMoodLastDiffHash = JSON.stringify(diff); } catch(_) { draft.courtMoodLastDiffHash = ''; }
      draft.courtMoodStale = false;
    } catch (e) {
      try { console.warn('[L3] courtMood llm fail', e); } catch(_){}
      // R5·D3·toast 前 check modal 还在·防幻觉
      if (modal.isConnected) {
        try { if (typeof toast === 'function') toast('⚠️ 朝议预判失败·稍后再试'); } catch(_){}
      }
    } finally {
      // R6·B2·对称·任何路径都 reset
      draft.courtMoodLoading = false;
      _kjpBumpLlmConcurrent(draft, -1);
    }
    if (modal.isConnected) _kjpRerenderSection(modal, 'l3-courtmood', _kjpRenderCourtMoodBody);
  }

  async function _kjpInvokeAudienceLlm(modal, npcName, intent) {
    var draft = modal._kjpDraft;
    if (typeof _kjpLlmAudienceDialog !== 'function') return;
    // R4·M7·防 user 反复点·loading 中拒新 call
    if (draft.audienceLoading) {
      try { if (typeof toast === 'function') toast('⏳ 召对中·请稍候'); } catch(_){}
      return;
    }
    var npc = (typeof findCharByName === 'function') ? findCharByName(npcName) : null;
    if (!npc) {
      try { if (typeof toast === 'function') toast('⚠️ 未找到 NPC·' + npcName); } catch(_){}
      return;
    }
    draft.audienceLoading = true;
    _kjpBumpLlmConcurrent(draft, +1);
    // R6·B2·outer try/finally·确保 cancel-race 的 early `return` 也能 reset loading + rerender
    try {
    // R5·D1·rerender 前 capture 当前 input value·rerender 完写回
    var savedInputVal = '';
    var savedIntentVal = intent;
    try {
      var npcIn0 = modal.querySelector('.kjp-audience-npc');
      var intIn0 = modal.querySelector('.kjp-audience-intent');
      if (npcIn0) savedInputVal = npcIn0.value;
      if (intIn0) savedIntentVal = intIn0.value;
    } catch(_){}
    _kjpRerenderSection(modal, 'l3-audience', _kjpRenderAudienceBody);
    _kjpRestoreAudienceInputValues(modal, savedInputVal, savedIntentVal);

    try {
      var diff = _kjpComputeDiff(draft);
      var l3Meta = _kjpExtractL3Meta(draft);
      var topicText = _kjpBuildTopicText(diff, l3Meta);
      var res = await _kjpLlmAudienceDialog({
        npc: npc, intent: intent, paradigmDiff: diff,
        topicText: topicText, courtMoodScale: draft.courtMoodScale
      });
      // R5·B3·若 modal 已 close (cancel race)·跳 GM 写·防静默扣钱
      if (!modal.isConnected) return;
      // R6·M5·probe 不该改朝议·LLM 即使返非零·invoker 强制 0·不信 LLM
      if (intent === 'probe' && res) res.supportDelta = 0;
      // R6·B1·防 LLM 返脏数据·parseInt 一次·下游全用 sdNum
      var sdNum = parseInt(res && res.supportDelta, 10) || 0;
      // R4·B2/B3 + R5·B1·cost apply·intent 入·probe 不动 affinity
      var costApplied = _kjpApplyAudienceCost(npc, res, intent);
      // R6·M1+M2·写 NPC._kjpReformLean·走 helper·clamp [-100,+100] + turn-distance decay
      //   tinyi v3 集成留 L4 (见 panel 顶 TODO)
      if (res && res.willAccept && sdNum) {
        try { _kjpAccumReformLean(npc, sdNum, GM.turn || 0); } catch(_){}
      }
      try {
        if (typeof GM !== 'undefined' && GM) {
          if (!Array.isArray(GM._kjpPrivateAudienceLog)) GM._kjpPrivateAudienceLog = [];
          // R6·M3·log entry 加 offerTerms + cost·L4/L7 reader 可回溯承诺细节
          // R6·B1·supportDelta 走 sdNum (parseInt 过)·防脏
          GM._kjpPrivateAudienceLog.push({
            turn: GM.turn || 0,
            npc: npcName, intent: intent,
            supportDelta: sdNum, willAccept: !!(res && res.willAccept),
            offerTerms: String((res && res.offerTerms) || ''),
            cost: (res && res.cost) || {},
            ts: Date.now()
          });
          // 保留近 50 条·防膨胀
          if (GM._kjpPrivateAudienceLog.length > 50) {
            GM._kjpPrivateAudienceLog.splice(0, GM._kjpPrivateAudienceLog.length - 50);
          }
        }
      } catch(_){}
      // 记录 in-modal
      if (!draft.privateAudiences) draft.privateAudiences = [];
      draft.privateAudiences.push({
        npc: npcName, intent: intent,
        speech: res.speech, offerTerms: res.offerTerms, cost: res.cost,
        supportDelta: sdNum, willAccept: res.willAccept,
        costApplied: costApplied, ts: (GM.turn || 0)
      });
      // 局部改 courtMoodScale·narrative 不动 (LLM 重算 user 自己点)
      // R6·M5·probe 已 enforce sdNum=0·此处自然不动
      if (sdNum && draft.courtMoodScale !== undefined) {
        draft.courtMoodScale = Math.max(0, Math.min(100, draft.courtMoodScale + sdNum));
      }
      try { if (typeof toast === 'function') toast('召对·' + npcName + (res.willAccept ? '·允' : '·未允') + '·支持 ' + (sdNum >= 0 ? '+' : '') + sdNum); } catch(_){}
    } catch (e) {
      try { console.warn('[L3] audience llm fail', e); } catch(_){}
      // R5·M3·失败 push record·user 看到失败历史·防重复 invoke 浪费 token
      if (modal.isConnected) {
        try {
          if (!draft.privateAudiences) draft.privateAudiences = [];
          draft.privateAudiences.push({
            npc: npcName, intent: intent,
            speech: '(LLM 失败·稍后再试)',
            offerTerms: '', cost: {},
            supportDelta: 0, willAccept: false,
            costApplied: false, failed: true, ts: (GM.turn || 0)
          });
        } catch(_){}
        // R5·D3·toast 前 check modal 还在
        try { if (typeof toast === 'function') toast('⚠️ 召对失败·LLM 调用错·稍后再试'); } catch(_){}
      }
    }
    } finally {
      // R6·B2·outer finally·任何路径 (early return / throw / 正常) 都 reset
      // 无论成败·清 loading + rerender·若 modal 已关 skip rerender (DOM 已 detach)
      draft.audienceLoading = false;
      _kjpBumpLlmConcurrent(draft, -1);
      if (modal.isConnected) {
        // 再保 input value·rerender 后重新填
        var savedInputVal2 = '';
        var savedIntentVal2 = intent;
        try {
          var npcIn1 = modal.querySelector('.kjp-audience-npc');
          var intIn1 = modal.querySelector('.kjp-audience-intent');
          if (npcIn1) savedInputVal2 = npcIn1.value;
          if (intIn1) savedIntentVal2 = intIn1.value;
        } catch(_){}
        _kjpRerenderSection(modal, 'l3-audience', _kjpRenderAudienceBody);
        _kjpRestoreAudienceInputValues(modal, savedInputVal2, savedIntentVal2);
        _kjpRerenderSection(modal, 'l3-courtmood', _kjpRenderCourtMoodBody);
      }
    }
  }

  // R5·D1·rerender 后写回 audience input + intent select·防 user 输的 NPC 名丢
  function _kjpRestoreAudienceInputValues(modal, npcVal, intentVal) {
    if (!modal || !modal.isConnected) return;
    try {
      var npcIn = modal.querySelector('.kjp-audience-npc');
      var intIn = modal.querySelector('.kjp-audience-intent');
      if (npcIn && npcVal) npcIn.value = npcVal;
      if (intIn && intentVal) intIn.value = intentVal;
    } catch(_){}
  }

  // R4·B2·affinity 改了也算 applied
  // R4·B3·prestige/guoku clamp <= 0·防 LLM 返正数涨钱/望
  // R5·B1·intent 参·probe 不动 affinity (探口风不该惩罚)·lure/pressure 按 willAccept 决方向
  function _kjpApplyAudienceCost(npc, res, intent) {
    if (!res || !npc) return false;
    var applied = false;
    intent = intent || 'lure';
    // affinity·按 intent + willAccept 决·probe=0·lure 允+5/拒-5·pressure 允+3/拒-10
    try {
      if (typeof _updateAffinityBetween === 'function' && typeof P !== 'undefined' && P.playerInfo && P.playerInfo.name) {
        var affDelta;
        if (intent === 'probe') affDelta = 0;
        else if (intent === 'pressure') affDelta = res.willAccept ? 3 : -10;
        else affDelta = res.willAccept ? 5 : -5;   // lure·拒不重罚 (-5 vs 旧 -15)
        if (affDelta !== 0) {
          _updateAffinityBetween(P.playerInfo.name, npc.name, affDelta);
          applied = true;
        }
      }
    } catch(_){}
    // cost·仅 willAccept 时应用·clamp <= 0
    if (!res.willAccept) return applied;
    try {
      var cost = res.cost || {};
      var prestige = parseInt(cost.prestige, 10);
      if (prestige && prestige < 0 && typeof GM !== 'undefined' && GM.vars && GM.vars['威望']) {
        GM.vars['威望'].value = Math.max(0, (GM.vars['威望'].value || 0) + prestige);
        applied = true;
      }
      var guoku = parseInt(cost.guoku, 10);
      if (guoku && guoku < 0 && typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) {
        // 国库支出走 FiscalEngine 真账(2026-07-04 收口)
        FiscalEngine.spendFromGuoku({ money: -guoku }, '科举范式之费');
        applied = true;
      }
    } catch(_){}
    return applied;
  }

  // re-render subjects body·event delegation 自动 cover 新节点·不需 rebind
  function _kjpRerenderSubjects(modal) {
    var section = modal.querySelector('.kjp-cat-subjects .kjp-section-body');
    if (section) section.innerHTML = _kjpRenderSubjectsBody(modal._kjpDraft);
  }
  function _kjpRerenderCandidate(modal) {
    var section = modal.querySelector('.kjp-cat-candidate .kjp-section-body');
    if (section) section.innerHTML = _kjpRenderCandidateBody(modal._kjpDraft);
  }

  // ════════════════════════════════════════════════════════════════
  // §6·_kjpComputeDiff·全 30+ 字段
  // ════════════════════════════════════════════════════════════════

  function _kjpComputeDiff(draft) {
    if (!draft) return null;
    var diff = {
      subjects: { added: [], removed: [], weightChanged: [] },
      tiers: {},  // L3 完整支持·此 stub
      examInterval: null,
      retakePolicy: null,
      examinerRules: {},
      candidateRules: {},
      quota: {},
      rankingRule: null,
      allocationRules: {},
      ideology: null,
      graduateTitle: null,
      cohortBondStrength: null,
      mentorLineage: null,
      schoolIntegration: null,
      taxPrivilege: {},
      shadow: null,
      clanPrivilege: null,
      ceremony: {},
      penalties: {},
      language: null,
      intent: draft.intent || 'reform',
      restorationDynasty: draft.restorationDynasty || ''
    };
    // subjects
    var baseIds = {}, draftIds = {};
    (draft.subjectsBase || []).forEach(function(s) { baseIds[s.id] = s; });
    (draft.subjectsDraft || []).forEach(function(s) {
      draftIds[s.id] = s;
      if (!baseIds[s.id]) {
        // RBB·BB-A2·full subject 入 diff·避 L6 rich metadata 在 diff 编码时丢
        diff.subjects.added.push({
          id: s.id, name: s.name, weight: s.weight,
          ideology: s.ideology, format: s.format,
          historicalAnalog: s.historicalAnalog, rationale: s.rationale,
          maxScore: s.maxScore, introducedYear: s.introducedYear,
          introducedBy: s.introducedBy, customFields: s.customFields
        });
      }
      else if (baseIds[s.id].weight !== s.weight) diff.subjects.weightChanged.push({ id: s.id, name: s.name, oldW: baseIds[s.id].weight, newW: s.weight });
    });
    (draft.subjectsBase || []).forEach(function(s) {
      if (!draftIds[s.id]) diff.subjects.removed.push({ id: s.id, name: s.name });
    });
    // examInterval
    if (draft.examIntervalDraft !== draft.examIntervalBase) diff.examInterval = { old: draft.examIntervalBase, new: draft.examIntervalDraft };
    if (draft.retakePolicyDraft !== draft.retakePolicyBase) diff.retakePolicy = { old: draft.retakePolicyBase, new: draft.retakePolicyDraft };
    // C7 修·tier diff·即 UI 当前 readonly·若 draft 被外部 hack·diff 仍能抓
    var tb_t = draft.tiersBase || [];
    var td_t = draft.tiersDraft || [];
    if (JSON.stringify(tb_t) !== JSON.stringify(td_t)) {
      diff.tiers = {
        changed: true,
        oldCount: tb_t.length,
        newCount: td_t.length,
        oldNames: tb_t.map(function(t) { return t.name || t.id || '?'; }),
        newNames: td_t.map(function(t) { return t.name || t.id || '?'; })
      };
    }
    // examinerRules
    var eb = draft.examinerRulesBase || {};
    var ed = draft.examinerRulesDraft || {};
    ['blindScoring','blindCopying','mentorBondStrength','inspectionLevel','leakPenalty','minYears'].forEach(function(k) {
      if (ed[k] !== eb[k]) diff.examinerRules[k] = ed[k];
    });
    // type array diff
    var ebType = (eb.type || []).slice().sort().join(',');
    var edType = (ed.type || []).slice().sort().join(',');
    if (ebType !== edType) diff.examinerRules.type = (ed.type || []).slice();
    // avoidanceRules
    var avB = eb.avoidanceRules || {}, avD = ed.avoidanceRules || {};
    ['avoid_kin','avoid_native','avoid_disciple','avoid_recent','avoid_party','avoid_age'].forEach(function(k) {
      if (avD[k] !== avB[k]) {
        if (!diff.examinerRules.avoidanceRules) diff.examinerRules.avoidanceRules = {};
        diff.examinerRules.avoidanceRules[k] = avD[k];
      }
    });
    // candidateRules
    var cb = draft.candidateRulesBase || {}, cd = draft.candidateRulesDraft || {};
    ['allowForeigner','allowMinority','requireRecommendation','requirePrefecture','minAge','maxAge','feeReimbursement'].forEach(function(k) {
      if (cd[k] !== cb[k]) diff.candidateRules[k] = cd[k];
    });
    var ebClasses = (cb.excludedClasses || []).slice().sort().join(',');
    var edClasses = (cd.excludedClasses || []).slice().sort().join(',');
    if (ebClasses !== edClasses) {
      diff.candidateRules.excludedClasses = {
        added: (cd.excludedClasses || []).filter(function(x) { return (cb.excludedClasses || []).indexOf(x) < 0; }),
        removed: (cb.excludedClasses || []).filter(function(x) { return (cd.excludedClasses || []).indexOf(x) < 0; })
      };
    }
    // quota
    var qb = draft.quotaBase || {}, qd = draft.quotaDraft || {};
    if (qb.total !== qd.total) diff.quota.total = { old: qb.total, new: qd.total };
    var rb = qb.ratios || {}, rd = qd.ratios || {};
    ['geo','class','party','prefecture','minority'].forEach(function(dim) {
      var rbd = rb[dim] || { enabled:false, values:{} };
      var rdd = rd[dim] || { enabled:false, values:{} };
      var changed = (rbd.enabled !== rdd.enabled) ||
        (JSON.stringify(rbd.values || {}) !== JSON.stringify(rdd.values || {}));
      if (changed) {
        if (!diff.quota.ratios) diff.quota.ratios = {};
        diff.quota.ratios[dim] = { enabled: rdd.enabled, values: rdd.values || {} };
      }
    });
    if (draft.rankingRuleDraft !== draft.rankingRuleBase) diff.rankingRule = { old: draft.rankingRuleBase, new: draft.rankingRuleDraft };
    // allocationRules
    var ab = draft.allocationRulesBase || {}, ad = draft.allocationRulesDraft || {};
    ['firstClass','secondClass','thirdClass'].forEach(function(k) {
      var bk = ab[k] || {}, dk = ad[k] || {};
      var changed = (bk.count !== dk.count) ||
        (JSON.stringify(bk.positions || []) !== JSON.stringify(dk.positions || []));
      if (changed) diff.allocationRules[k] = { count: dk.count, positions: dk.positions };
    });
    if (ab.waitingYears !== ad.waitingYears) diff.allocationRules.waitingYears = { old: ab.waitingYears, new: ad.waitingYears };
    if (ab.imperialReviewRequired !== ad.imperialReviewRequired) diff.allocationRules.imperialReviewRequired = ad.imperialReviewRequired;
    if (ab.posthumousAdjustment !== ad.posthumousAdjustment) diff.allocationRules.posthumousAdjustment = ad.posthumousAdjustment;
    // meta
    if (draft.ideologyDraft !== draft.ideologyBase) diff.ideology = { old: draft.ideologyBase, new: draft.ideologyDraft };
    if (draft.graduateTitleDraft !== draft.graduateTitleBase) diff.graduateTitle = { old: draft.graduateTitleBase, new: draft.graduateTitleDraft };
    if (draft.cohortBondStrengthDraft !== draft.cohortBondStrengthBase) diff.cohortBondStrength = { old: draft.cohortBondStrengthBase, new: draft.cohortBondStrengthDraft };
    if (draft.mentorLineageDraft !== draft.mentorLineageBase) diff.mentorLineage = draft.mentorLineageDraft;
    if (draft.schoolIntegrationDraft !== draft.schoolIntegrationBase) diff.schoolIntegration = { old: draft.schoolIntegrationBase, new: draft.schoolIntegrationDraft };
    var tb = draft.taxPrivilegeBase || {}, td = draft.taxPrivilegeDraft || {};
    ['jinshi','juren','xiucai'].forEach(function(k) { if (tb[k] !== td[k]) diff.taxPrivilege[k] = td[k]; });
    if (draft.shadowDraft !== draft.shadowBase) diff.shadow = { old: draft.shadowBase, new: draft.shadowDraft };
    if (draft.clanPrivilegeDraft !== draft.clanPrivilegeBase) diff.clanPrivilege = draft.clanPrivilegeDraft;
    var cb2 = draft.ceremonyBase || {}, cd2 = draft.ceremonyDraft || {};
    ['palaceTest','rosterRelease','flowerRiding','nameStele','bondingBanquet','kowtowRound'].forEach(function(k) {
      if (cd2[k] !== cb2[k]) diff.ceremony[k] = cd2[k];
    });
    var pb = draft.penaltiesBase || {}, pd = draft.penaltiesDraft || {};
    ['cheating','leak','taboo','bribery'].forEach(function(k) {
      if (pd[k] !== pb[k]) diff.penalties[k] = pd[k];
    });
    if (draft.languageDraft !== draft.languageBase) diff.language = { old: draft.languageBase, new: draft.languageDraft };
    return diff;
  }

  // ════════════════════════════════════════════════════════════════
  // §7·_kjpClassifyDiffTags·扩到全字段
  // ════════════════════════════════════════════════════════════════

  function _kjpClassifyDiffTags(diff) {
    var tags = ['reform'];
    if (!diff) return tags;
    if (diff.intent === 'restoration') tags.push('restoration');
    if (diff.subjects.added.length || diff.subjects.removed.length || diff.subjects.weightChanged.length) tags.push('subject-change');
    if (diff.examInterval || diff.retakePolicy) tags.push('tier-cycle-change');
    if (diff.tiers && diff.tiers.changed) tags.push('tier-structure-change');
    if (Object.keys(diff.examinerRules).length) tags.push('examiner-rule');
    if (Object.keys(diff.candidateRules).length) tags.push('candidate-rule');
    if (Object.keys(diff.quota).length) tags.push('quota-change');
    if (diff.rankingRule) tags.push('ranking-change');
    if (Object.keys(diff.allocationRules).length) tags.push('allocation-change');
    if (diff.ideology) tags.push('ideology-shift');
    if (diff.schoolIntegration) tags.push('school-system');
    if (Object.keys(diff.taxPrivilege).length) tags.push('tax-privilege');
    if (diff.shadow) tags.push('shadow-change');
    if (typeof diff.clanPrivilege === 'boolean') tags.push('clan-priv');
    if (diff.cohortBondStrength) tags.push('cohort-bond');
    if (typeof diff.mentorLineage === 'boolean') tags.push('mentor-lineage');
    if (Object.keys(diff.ceremony).length) tags.push('ceremony-change');
    if (Object.keys(diff.penalties).length) tags.push('penalty-change');
    if (diff.language) tags.push('language-change');
    if (diff.graduateTitle) tags.push('graduate-title');
    var magnitude = _kjpDiffMagnitude(diff);
    if (magnitude >= 60) tags.push('radical-reform');
    else if (magnitude >= 30) tags.push('moderate-reform');
    else tags.push('minor-reform');
    return tags;
  }

  // C2 修·magnitude 权重常量化·便后续调优
  var MAGNITUDE_WEIGHTS = {
    subjectAdd: 15,
    subjectRemove: 20,
    subjectWeightPerUnit: 0.5,   // weight 变化 / 2
    examInterval: 5,
    retakePolicy: 4,
    examinerRuleEach: 8,
    candidateRuleEach: 10,
    quotaChangeEach: 6,
    rankingChange: 8,
    allocationEach: 5,
    ideologyShift: 30,
    schoolIntegration: 10,
    taxPrivEach: 5,
    shadowChange: 6,
    clanPriv: 5,
    cohortBond: 5,
    mentorLineage: 5,
    ceremonyEach: 3,
    penaltyEach: 4,
    languageChange: 8,
    graduateTitle: 10
  };

  function _kjpDiffMagnitude(diff) {
    if (!diff) return 0;
    var W = MAGNITUDE_WEIGHTS;
    var m = 0;
    m += diff.subjects.added.length * W.subjectAdd;
    m += diff.subjects.removed.length * W.subjectRemove;
    m += diff.subjects.weightChanged.reduce(function(s, w) { return s + Math.abs(w.newW - w.oldW) * W.subjectWeightPerUnit; }, 0);
    if (diff.examInterval) m += W.examInterval;
    if (diff.retakePolicy) m += W.retakePolicy;
    m += Object.keys(diff.examinerRules).length * W.examinerRuleEach;
    m += Object.keys(diff.candidateRules).length * W.candidateRuleEach;
    m += Object.keys(diff.quota).length * W.quotaChangeEach;
    if (diff.rankingRule) m += W.rankingChange;
    m += Object.keys(diff.allocationRules).length * W.allocationEach;
    if (diff.ideology) m += W.ideologyShift;
    if (diff.schoolIntegration) m += W.schoolIntegration;
    m += Object.keys(diff.taxPrivilege).length * W.taxPrivEach;
    if (diff.shadow) m += W.shadowChange;
    if (typeof diff.clanPrivilege === 'boolean') m += W.clanPriv;
    if (diff.cohortBondStrength) m += W.cohortBond;
    if (typeof diff.mentorLineage === 'boolean') m += W.mentorLineage;
    m += Object.keys(diff.ceremony).length * W.ceremonyEach;
    m += Object.keys(diff.penalties).length * W.penaltyEach;
    if (diff.language) m += W.languageChange;
    if (diff.graduateTitle) m += W.graduateTitle;
    return Math.min(100, Math.round(m));
  }

  // ════════════════════════════════════════════════════════════════
  // §8·_kjpBuildTopicText·古文议题
  // ════════════════════════════════════════════════════════════════

  // C3 修·拆 helper·按 paradigm 类分组·便于维护 + 后续扩字段
  // L3·R4·抽 helper·draft → l3Meta·便所有调用方复用
  function _kjpExtractL3Meta(draft) {
    if (!draft) return null;
    return {
      magnitudeDescriptor: draft.magnitudeDescriptor,
      magnitudeDescriptorPreset: draft.magnitudeDescriptorPreset,
      magnitudeParsed: draft.magnitudeParsed,
      pilotScope: draft.pilotScope,
      pilotCandidates: draft.pilotCandidates,
      courtMoodNarrative: draft.courtMoodNarrative,
      courtMoodScale: draft.courtMoodScale,
      courtMoodKeyNpcs: draft.courtMoodKeyNpcs,
      privateAudiences: draft.privateAudiences,
      isForced: draft.isForced,
      // L10·v2·C1·preset 字段流入 topicData·L7 callback 读 ctx.topicData·skip L9 LLM
      l10PresetId: draft._l10PresetId || null,
      l10PresetCanonicalName: draft._l10PresetCanonicalName || null,
      l10PresetHistoricalEvaluation: draft._l10PresetHistoricalEvaluation || null,
      l10PresetBy: draft._l10PresetBy || null
    };
  }

  // M3·magnitudeDescriptor 入议题文本前置 (NPC stance 看得到幅度)
  function _kjpAppendMagnitude(parts, l3Meta) {
    if (!l3Meta || !l3Meta.magnitudeDescriptor) return;
    parts.push('以"' + l3Meta.magnitudeDescriptor + '"之势');
  }

  // M2·pilotScope 入议题文本 (NPC 知道试点范围)
  function _kjpAppendPilot(parts, l3Meta) {
    if (!l3Meta || !l3Meta.pilotScope || !l3Meta.pilotScope.name) return;
    var n = l3Meta.pilotScope.name;
    // 默认全国一举·不显 (议题简洁)
    if (/^全国/.test(n)) return;
    parts.push('先试·' + n);
  }

  function _kjpAppendRestoration(parts, diff) {
    if (diff.intent !== 'restoration') return;
    if (diff.restorationDynasty) parts.push('复 ' + diff.restorationDynasty + ' 朝旧章');
    else parts.push('复祖宗成法');
  }

  function _kjpAppendSubjects(parts, diff) {
    diff.subjects.removed.forEach(function(s) { parts.push('废' + s.name); });
    diff.subjects.added.forEach(function(s) { parts.push('增' + s.name + '·权重 ' + s.weight + '%'); });
    diff.subjects.weightChanged.forEach(function(s) { parts.push('改' + s.name + '·权重 ' + s.oldW + '%→' + s.newW + '%'); });
  }

  function _kjpAppendTier(parts, diff) {
    if (diff.examInterval) parts.push('改考期·从 ' + diff.examInterval.old + ' 年至 ' + diff.examInterval.new + ' 年');
    if (diff.retakePolicy) parts.push('改加试·' + diff.retakePolicy.new);
    if (diff.tiers && diff.tiers.changed) {
      parts.push('改 tier 结构·' + (diff.tiers.oldNames || []).join('/') + ' → ' + (diff.tiers.newNames || []).join('/'));
    }
  }

  function _kjpAppendExaminer(parts, diff) {
    var er = diff.examinerRules;
    if (er.blindScoring === false) parts.push('罢糊名之制');
    if (er.blindScoring === true) parts.push('立糊名之制');
    if (er.blindCopying === false) parts.push('罢誊录之制');
    if (er.blindCopying === true) parts.push('立誊录之制');
    if (er.mentorBondStrength) parts.push('改主考门生·' + er.mentorBondStrength);
    if (er.inspectionLevel) parts.push('改监察·' + er.inspectionLevel);
    if (er.leakPenalty) parts.push('改泄题罚·' + er.leakPenalty);
    if (er.type) parts.push('改主考资格·' + er.type.join('/'));
    if (er.minYears !== undefined) parts.push('改主考任年·' + er.minYears + ' 年');
    if (er.avoidanceRules) {
      Object.keys(er.avoidanceRules).forEach(function(k) {
        parts.push((er.avoidanceRules[k] ? '立' : '罢') + '·' + k);
      });
    }
  }

  function _kjpAppendCandidate(parts, diff) {
    var cr = diff.candidateRules;
    if (cr.allowMinority === true) parts.push('许蒙古色目应考');
    if (cr.allowMinority === false) parts.push('禁蒙古色目应考');
    if (cr.allowForeigner === true) parts.push('许宾贡 (外族)');
    if (cr.allowForeigner === false) parts.push('罢宾贡');
    if (cr.requireRecommendation === true) parts.push('立保举之制');
    if (cr.requireRecommendation === false) parts.push('罢保举之制');
    if (cr.requirePrefecture === true) parts.push('立户籍之限');
    if (cr.requirePrefecture === false) parts.push('罢户籍之限');
    if (cr.minAge !== undefined || cr.maxAge !== undefined) parts.push('改年龄之限');
    if (cr.feeReimbursement) parts.push('改考费·' + cr.feeReimbursement);
    if (cr.excludedClasses) {
      if (cr.excludedClasses.removed && cr.excludedClasses.removed.length) parts.push('许 ' + cr.excludedClasses.removed.join('、') + ' 应考');
      if (cr.excludedClasses.added && cr.excludedClasses.added.length) parts.push('禁 ' + cr.excludedClasses.added.join('、') + ' 应考');
    }
  }

  function _kjpAppendQuota(parts, diff) {
    if (diff.quota.total) parts.push('改录取·从 ' + diff.quota.total.old + ' 名至 ' + diff.quota.total.new + ' 名');
    if (diff.quota.ratios) {
      Object.keys(diff.quota.ratios).forEach(function(dim) {
        var r = diff.quota.ratios[dim];
        parts.push((r.enabled ? '立' : '罢') + ' ' + dim + ' 分卷');
      });
    }
    if (diff.rankingRule) parts.push('改排名·' + diff.rankingRule.new);
  }

  function _kjpAppendAllocation(parts, diff) {
    var keys = Object.keys(diff.allocationRules).filter(function(k) {
      return k !== 'waitingYears' && k !== 'imperialReviewRequired' && k !== 'posthumousAdjustment';
    });
    if (keys.length) parts.push('改授官·' + keys.join('/'));
    if (diff.allocationRules.waitingYears) parts.push('改候补·' + diff.allocationRules.waitingYears.old + ' → ' + diff.allocationRules.waitingYears.new + ' 年');
    if (typeof diff.allocationRules.imperialReviewRequired === 'boolean') parts.push((diff.allocationRules.imperialReviewRequired ? '立' : '罢') + ' 御审');
    if (typeof diff.allocationRules.posthumousAdjustment === 'boolean') parts.push((diff.allocationRules.posthumousAdjustment ? '立' : '罢') + ' 死后可调');
  }

  function _kjpAppendIdentity(parts, diff) {
    if (diff.graduateTitle) parts.push('改进士头衔·' + diff.graduateTitle.old + ' → ' + diff.graduateTitle.new);
    if (diff.cohortBondStrength) parts.push('改同年关系·' + diff.cohortBondStrength.new);
    if (typeof diff.mentorLineage === 'boolean') parts.push((diff.mentorLineage ? '立' : '罢') + 'mentor lineage 记录');
  }

  function _kjpAppendLinkage(parts, diff) {
    if (diff.schoolIntegration) parts.push('改学制·' + diff.schoolIntegration.old + ' → ' + diff.schoolIntegration.new);
    Object.keys(diff.taxPrivilege).forEach(function(k) { parts.push((diff.taxPrivilege[k] ? '立' : '罢') + ' ' + k + ' 免赋'); });
    if (diff.shadow) parts.push('改荫子·' + diff.shadow.old + ' → ' + diff.shadow.new);
    if (typeof diff.clanPrivilege === 'boolean') parts.push((diff.clanPrivilege ? '立' : '罢') + ' 宗族特权');
  }

  function _kjpAppendCeremony(parts, diff) {
    Object.keys(diff.ceremony).forEach(function(k) {
      var v = diff.ceremony[k];
      parts.push('改仪轨·' + k + '·' + (typeof v === 'boolean' ? (v?'立':'罢') : v));
    });
  }

  function _kjpAppendPenalty(parts, diff) {
    Object.keys(diff.penalties).forEach(function(k) { parts.push('改' + k + '罚·' + diff.penalties[k]); });
  }

  function _kjpAppendLangIdeology(parts, diff) {
    if (diff.language) parts.push('改考试语·' + diff.language.old + ' → ' + diff.language.new);
    if (diff.ideology) parts.push('改科举之本·' + diff.ideology.old + ' → ' + diff.ideology.new);
  }

  function _kjpBuildTopicText(diff, l3Meta) {
    if (!diff) return '';
    var parts = [];
    _kjpAppendMagnitude(parts, l3Meta);   // M3·幅度前置
    _kjpAppendRestoration(parts, diff);
    _kjpAppendSubjects(parts, diff);
    _kjpAppendTier(parts, diff);
    _kjpAppendExaminer(parts, diff);
    _kjpAppendCandidate(parts, diff);
    _kjpAppendQuota(parts, diff);
    _kjpAppendAllocation(parts, diff);
    _kjpAppendIdentity(parts, diff);
    _kjpAppendLinkage(parts, diff);
    _kjpAppendCeremony(parts, diff);
    _kjpAppendPenalty(parts, diff);
    _kjpAppendLangIdeology(parts, diff);
    _kjpAppendPilot(parts, l3Meta);       // M2·试点末置
    if (parts.length === 0) return '';
    return '改科举·' + parts.join('·') + '·伏请陛下察议';
  }

  // ════════════════════════════════════════════════════════════════
  // §9·_kjpEstimateStanceDistribution·复用 tinyi v3·遍历 GM.parties
  // ════════════════════════════════════════════════════════════════

  function _kjpEstimateStanceDistribution(diff, l3Meta) {
    if (typeof GM === 'undefined' || !GM) return {};
    var topicText = _kjpBuildTopicText(diff, l3Meta);
    var tags = _kjpClassifyDiffTags(diff);
    var partyStances = {};
    var parties = GM.parties || [];

    parties.forEach(function(p) {
      if (!p || !p.name) return;
      if (NEUTRAL_PARTIES.indexOf(p.name) >= 0) {
        partyStances[p.name] = { stance: 'neutral', intensity: 0.3, source: 'neutral_party', memberCount: 0 };
        return;
      }
      var members = [];
      if (typeof _ty3_getPartyMembers === 'function') {
        try { members = _ty3_getPartyMembers(p.name) || []; } catch(_) { members = []; }
      } else {
        members = (GM.chars || []).filter(function(ch) { return ch && ch.party === p.name && ch.alive !== false; });
      }
      var stances = members.map(function(nm) {
        var ch = (typeof nm === 'string') ? (typeof findCharByName === 'function' ? findCharByName(nm) : null) : nm;
        if (!ch) return null;
        if (typeof _ty3_initialStanceFromDims !== 'function') return { stance: 'neutral', intensity: 0.4 };
        try { return _ty3_initialStanceFromDims(ch, topicText, tags); }
        catch(_) { return { stance: 'neutral', intensity: 0.4 }; }
      }).filter(Boolean);
      partyStances[p.name] = _aggregateStance(stances, p.name);
    });
    return partyStances;
  }

  function _aggregateStance(stances, partyName) {
    if (!stances || !stances.length) return { stance: 'neutral', intensity: 0, memberCount: 0 };
    var counts = { support: 0, oppose: 0, neutral: 0 };
    var totalIntensity = { support: 0, oppose: 0, neutral: 0 };
    stances.forEach(function(s) {
      if (!s || !s.stance) return;
      counts[s.stance] = (counts[s.stance] || 0) + 1;
      totalIntensity[s.stance] = (totalIntensity[s.stance] || 0) + (s.intensity || 0);
    });
    var dominant = 'neutral';
    var maxCount = 0;
    ['support', 'oppose', 'neutral'].forEach(function(k) {
      if (counts[k] > maxCount) { maxCount = counts[k]; dominant = k; }
    });
    var avgIntensity = counts[dominant] > 0 ? totalIntensity[dominant] / counts[dominant] : 0;
    return {
      stance: dominant, intensity: Math.round(avgIntensity * 100) / 100,
      memberCount: stances.length, _breakdown: counts, _partyName: partyName
    };
  }

  // ════════════════════════════════════════════════════════════════
  // §10·refresh preview
  // ════════════════════════════════════════════════════════════════

  function _kjpRefreshPreview(modal) {
    if (!modal) return;
    var draft = modal._kjpDraft;
    if (!draft) return;
    var diff = _kjpComputeDiff(draft);
    var l3Meta = _kjpExtractL3Meta(draft);
    var topicEl = modal.querySelector('#kjp-topic-text');
    if (topicEl && draft._userEditedTopic === null) {
      topicEl.value = _kjpBuildTopicText(diff, l3Meta);
    }
    // M4·diff hash 比对·若 paradigm 改了·标 courtMood stale
    try {
      var diffHash = JSON.stringify(diff);
      if (draft.courtMoodLastDiffHash && draft.courtMoodLastDiffHash !== diffHash && draft.courtMoodNarrative && !draft.courtMoodStale) {
        draft.courtMoodStale = true;
        _kjpRerenderSection(modal, 'l3-courtmood', _kjpRenderCourtMoodBody);
      }
    } catch(_){}
    var previewEl = modal.querySelector('#kjp-stance-preview');
    if (previewEl) {
      var stances = _kjpEstimateStanceDistribution(diff, l3Meta);
      // A4 修·weight sum > 100 warning
      var weightSum = (draft.subjectsDraft || []).reduce(function(s, x) { return s + (x.weight || 0); }, 0);
      var warningHtml = '';
      if (weightSum > 100) {
        warningHtml = '<div class="kjp-warning">⚠️ 题目权重总和 = ' + weightSum + '%·超 100·上奏前请调整</div>';
      } else if (weightSum < 100 && weightSum > 0) {
        warningHtml = '<div class="kjp-info">ⓘ 题目权重总和 = ' + weightSum + '%·未满 100</div>';
      }
      previewEl.innerHTML = warningHtml + _kjpRenderStancePreview(stances, _kjpDiffMagnitude(diff));
    }
  }

  function _kjpRenderStancePreview(stances, magnitude) {
    var keys = Object.keys(stances);
    if (!keys.length) return '<span class="kjp-muted">(无党派记录)</span>';
    var html = '';
    keys.forEach(function(p) {
      var s = stances[p];
      var icon = s.stance === 'support' ? '✓' : (s.stance === 'oppose' ? '✗' : '○');
      var color = s.stance === 'support' ? 'var(--ok)' : (s.stance === 'oppose' ? 'var(--bad)' : 'var(--txt-d)');
      html += '<div class="kjp-stance-row"><span style="color:' + color + ';">' + icon + '</span> ' +
        '<span class="kjp-party">' + _escHtml(p) + '</span>·' +
        '<span class="kjp-stance-label">' + s.stance + '</span>' +
        ' (intensity ' + s.intensity + '·' + s.memberCount + ' 人)</div>';
    });
    var resist = magnitude >= 60 ? '高' : (magnitude >= 30 ? '中' : '低');
    // D2·标签明确·"改动幅度·diff 字段累加"·非 LLM 推算的政治阻力
    html += '<div class="kjp-magnitude">改动幅度 (diff 字段累加)·' + magnitude + ' / 100·结构阻力·<b>' + resist + '</b></div>';
    return html;
  }

  // ════════════════════════════════════════════════════════════════
  // §11·submit·调 keyi
  // ════════════════════════════════════════════════════════════════

  function _kjpSubmitFromModal(modal) {
    var draft = modal._kjpDraft;
    // R5·M2·若 audience LLM 仍在跑·privateAudiences 漏最新·阻 submit·让 user 等
    if (draft.audienceLoading) {
      try { if (typeof toast === 'function') toast('⏳ 召对 LLM 仍在跑·请稍候再上奏'); } catch(_){}
      return;
    }
    // 其他 invoker (magnitude/pilot/courtMood) 不阻 submit·因为·
    //   - magnitude/pilot/courtMood 缺·议政仍能进 (LLM 数据非必)
    //   - audience 缺·私谈承诺漏·tinyi v3 议政时 NPC stance 不准
    // R2·A2 修·flush debounce·若 pending·立即 refresh·让 textarea 跟 stance 是最新
    if (modal._kjpRefreshTimer) {
      try { clearTimeout(modal._kjpRefreshTimer); } catch(_){}
      modal._kjpRefreshTimer = null;
      _kjpRefreshPreview(modal);
    }
    var diff = _kjpComputeDiff(draft);
    var l3Meta = _kjpExtractL3Meta(draft);
    var topicEl = modal.querySelector('#kjp-topic-text');
    var topicText = (topicEl && topicEl.value) || _kjpBuildTopicText(diff, l3Meta);
    if (!topicText) {
      try { if (typeof toast === 'function') toast('⚠️ 议题为空·请先选改革维度'); } catch(_){}
      return;
    }
    // A3 修·weight sum > 100·confirm 阻断 (smoke 无 confirm·跳过 confirm)
    var weightSum = (draft.subjectsDraft || []).reduce(function(s, x) { return s + (x.weight || 0); }, 0);
    if (weightSum > 100 && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      var msg = '题目权重总和 = ' + weightSum + '%·超 100·上奏后议政可能产生意外结果·确定上奏?';
      if (!window.confirm(msg)) return;
    }
    // L3·package 全字段·复用 helper
    _kjpSubmitReform(diff, topicText, draft.intent, draft.restorationDynasty, l3Meta);
  }

  function _kjpSubmitReform(diff, topicText, intent, restorationDynasty, l3Meta) {
    if (typeof openKeyiSession !== 'function') {
      try { console.warn('[L2] openKeyiSession 未载·无法上奏'); } catch(_){}
      try { if (typeof toast === 'function') toast('⚠️ keyi 议政模块未载'); } catch(_){}
      return false;
    }
    try {
      if (typeof document !== 'undefined') {
        var modal = document.getElementById('kjp-reform-modal');
        if (modal) {
          // A1 修·安全·清 timer
          if (modal._kjpRefreshTimer) {
            try { clearTimeout(modal._kjpRefreshTimer); } catch(_){}
            modal._kjpRefreshTimer = null;
          }
          modal.remove();
        }
      }
    } catch(_){}
    try {
      // L3·扩 topicData·含 magnitude/pilot/courtMood/audiences/isForced
      var topicData = {
        topic: topicText,
        paradigmDiff: diff,
        intent: intent || 'reform',
        restorationDynasty: restorationDynasty || '',
        source: 'kj-paradigm-l3',
        sourceVersion: 3
      };
      if (l3Meta) {
        topicData.magnitudeDescriptor = l3Meta.magnitudeDescriptor;
        topicData.magnitudeDescriptorPreset = l3Meta.magnitudeDescriptorPreset;
        topicData.magnitudeParsed = l3Meta.magnitudeParsed;
        topicData.pilotScope = l3Meta.pilotScope;
        topicData.pilotCandidates = l3Meta.pilotCandidates;
        topicData.courtMoodNarrative = l3Meta.courtMoodNarrative;
        topicData.courtMoodScale = l3Meta.courtMoodScale;
        topicData.courtMoodKeyNpcs = l3Meta.courtMoodKeyNpcs;
        topicData.privateAudiences = l3Meta.privateAudiences;
        topicData.isForced = !!l3Meta.isForced;
        // L10·v2·C1·preset shortcircuit·L7 callback step 4.5 读·skip L9 LLM 命名
        topicData.l10PresetId = l3Meta.l10PresetId;
        topicData.l10PresetCanonicalName = l3Meta.l10PresetCanonicalName;
        topicData.l10PresetHistoricalEvaluation = l3Meta.l10PresetHistoricalEvaluation;
        topicData.l10PresetBy = l3Meta.l10PresetBy;
      }
      // L7·a·B3 路径·KEYI_TOPIC_TYPES.reform.callback='_kjReformKeyiCallback'·L7 expose 这个 global
      openKeyiSession({ topicType: 'reform', topicData: topicData });
    } catch (e) {
      try { console.warn('[L2] openKeyiSession 失败', e); } catch(_){}
      return false;
    }
    try {
      if (typeof GM !== 'undefined' && GM && Array.isArray(GM._chronicle)) {
        // C4 修·_escHtml topic text·防 XSS·虽然 Electron local
        // A4 修·加"待 L7 apply"·让 user 知改革效果待后续 slice
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          date: GM._gameDate || '',
          type: 'keju-reform-proposed',
          text: (intent === 'restoration' ? '复古议' : '改革议') + '·' + _escHtml(topicText.slice(0, 60)) + '·（议毕·待 L7 apply）',
          tags: ['科举', 'paradigm', intent || 'reform']
        });
      }
    } catch(_){}
    return true;
  }

  // ════════════════════════════════════════════════════════════════
  // §11.5·L4·b2·策对政治后果·走 ChronicleTracker + R6 + F4·非自建独立机制
  // ════════════════════════════════════════════════════════════════

  function _kjpInitForecastReputation(npc) {
    if (!npc) return;
    if (!npc._forecastReputation) {
      npc._forecastReputation = {
        totalForecasts: 0,
        accurateForecasts: 0,
        averageScore: 0,
        lastForecastTurn: -1,   // RZ·Z5·init -1·防 turn=0 (debug / early game) collision·skip first bump
        reputation: 'new'
      };
    }
  }

  function _kjpBumpForecastReputation(npc, turn) {
    if (!npc) return;
    _kjpInitForecastReputation(npc);
    var rep = npc._forecastReputation;
    var t = parseInt(turn, 10) || 0;
    // Y-B3·same-turn guard·防 user 同 turn 重召刷 totalForecasts
    if (rep.lastForecastTurn === t) return;
    rep.totalForecasts = (parseInt(rep.totalForecasts, 10) || 0) + 1;
    rep.lastForecastTurn = t;
    // accurateForecasts + averageScore·L7 后 _kjpAuditForecastAccuracy 真填
    // Y-B1·若 totalForecasts > 0 但 accurateForecasts=0 + averageScore=0·标 'unaudited' (L7 未填)·非 'unreliable'
    var avg = parseInt(rep.averageScore, 10) || 0;
    var acc = parseInt(rep.accurateForecasts, 10) || 0;
    if (rep.totalForecasts === 0) {
      rep.reputation = 'new';
    } else if (acc === 0 && avg === 0) {
      rep.reputation = 'unaudited';   // L7 hook 未填准度·非真"不准"
    } else if (avg >= 70) {
      rep.reputation = 'reliable';
    } else if (avg >= 50) {
      rep.reputation = 'mixed';
    } else {
      rep.reputation = 'unreliable';
    }
  }

  // L7·g 真填·5 因子 weighted·按 advisor archetype 的"典型预测" vs actual 对比·返 0-100
  function _kjpAuditForecastAccuracy(chronicleEntry, actualOutcome) {
    if (!chronicleEntry || !actualOutcome) return 0;
    var weights = { method: 20, passed: 30, prestige: 15, yanguan: 20, rampSpan: 15 };
    var score = 0;
    var archetype = _kjpExtractArchetypeFromEntry(chronicleEntry);
    var typical = _kjpArchetypeTypicalForecast(archetype);

    // 1·method match·archetype 倾向 vs actual
    if (typical.predictedMethod === actualOutcome.method) score += weights.method;
    else if (typical.predictedMethod === 'any') score += weights.method * 0.5;

    // 2·passed match
    if (typical.predictedPassed === actualOutcome.passed) score += weights.passed;

    // 3·prestige direction·绝对差<5 → 满·同向 → 半·反向 → 0
    if (typeof typical.predictedPrestigeDelta === 'number') {
      var actualP = parseInt(actualOutcome.prestigeDelta, 10) || 0;
      var typicalP = typical.predictedPrestigeDelta;
      if (Math.sign(typicalP) === Math.sign(actualP)) {
        score += weights.prestige * (Math.abs(typicalP - actualP) < 5 ? 1 : 0.5);
      }
    } else {
      score += weights.prestige * 0.5;  // 中性 = 半分
    }

    // 4·yanguan spawned match
    if (typical.predictedYanguan === !!actualOutcome.yanguanSpawned) score += weights.yanguan;

    // 5·rampUpYears 误差·<2 满·<5 半·>=5 0
    if (typeof typical.predictedRampUpYears === 'number') {
      var diffY = Math.abs(typical.predictedRampUpYears - (parseInt(actualOutcome.rampUpYears, 10) || 0));
      if (diffY < 2) score += weights.rampSpan;
      else if (diffY < 5) score += weights.rampSpan * 0.5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // 从 ChronicleTracker entry narrative 提 archetype·L4·b2 写 "archetype·label·digest..."
  // RAA·B7·加 fallback·若 regex 失·查 stakeholders + npc archetype·避免 narrative format 变 → 全 default A3
  function _kjpExtractArchetypeFromEntry(entry) {
    if (!entry) return 'A3_pragmatic';
    var narr = entry.narrative || '';
    var m = narr.match(/^(A[1-8]_[a-z_]+)/);
    if (m) return m[1];
    // fallback 1·entry 上若有 _archetype 字段 (旧 schema 兜底)
    if (entry._archetype && /^A[1-8]_/.test(entry._archetype)) return entry._archetype;
    // fallback 2·从 entry.actor 调 advisor archetype helper (若 expose)
    if (entry.actor && typeof window !== 'undefined' &&
        typeof window._kjpInferAdvisorArchetype === 'function' &&
        typeof window.findCharByName === 'function') {
      var npc = window.findCharByName(entry.actor);
      if (npc) {
        try {
          var arch = window._kjpInferAdvisorArchetype(npc);
          if (arch && /^A[1-8]_/.test(arch)) return arch;
        } catch(_){}
      }
    }
    try { console.warn('[L7·g·B7] archetype 提取失败·narrative=', narr.slice(0, 40), '·fallback A3_pragmatic'); } catch(_){}
    return 'A3_pragmatic';
  }

  // 8 archetype 典型 forecast·L7 backfill 用·非真存 advisor "预测" 字段·按 archetype 推
  function _kjpArchetypeTypicalForecast(archetype) {
    var typicalMap = {
      A1_radical:       { predictedMethod: 'edict',   predictedPassed: true,  predictedPrestigeDelta: +15, predictedYanguan: true,  predictedRampUpYears: 3 },
      A2_conservative:  { predictedMethod: 'council', predictedPassed: false, predictedPrestigeDelta: -5,  predictedYanguan: false, predictedRampUpYears: 1 },
      A3_pragmatic:     { predictedMethod: 'council', predictedPassed: true,  predictedPrestigeDelta: +5,  predictedYanguan: false, predictedRampUpYears: 3 },
      A4_chronicler:    { predictedMethod: 'any',     predictedPassed: true,  predictedPrestigeDelta:  0,  predictedYanguan: false, predictedRampUpYears: 5 },
      A5_celestial:     { predictedMethod: 'any',     predictedPassed: false, predictedPrestigeDelta: -10, predictedYanguan: true,  predictedRampUpYears: 7 },
      A6_frontier:      { predictedMethod: 'edict',   predictedPassed: true,  predictedPrestigeDelta: +10, predictedYanguan: false, predictedRampUpYears: 2 },
      A7_imperial_kin:  { predictedMethod: 'council', predictedPassed: true,  predictedPrestigeDelta: +5,  predictedYanguan: false, predictedRampUpYears: 4 },
      A8_recluse:       { predictedMethod: 'any',     predictedPassed: false, predictedPrestigeDelta: -5,  predictedYanguan: true,  predictedRampUpYears: 5 }
    };
    return typicalMap[archetype] || typicalMap.A3_pragmatic;
  }

  // L4·b2·5 路径写入·复用 wendui history (1) + ChronicleTracker (2) + R6 accum (3) + reputation (4) + F4 (5)
  function _kjpApplyCeduiOutcome(npc, archetype, draft) {
    if (!npc) return;
    var turn = (typeof GM !== 'undefined' && GM.turn) || 0;
    var diff = (typeof _kjpComputeDiff === 'function' && draft) ? _kjpComputeDiff(draft) : null;
    var paradigmDigest = (typeof _kjpSummarizeDiff === 'function' && diff) ? String(_kjpSummarizeDiff(diff)).slice(0, 100) : '';
    var archLabel = (typeof ARCHETYPE_LABELS === 'object' && ARCHETYPE_LABELS[archetype]) ? ARCHETYPE_LABELS[archetype] : archetype;

    // 1. NPC 记忆·wendui 已 push (mode='cedui'·ceduiParadigmDigest)·此处不重做

    // 2. GM 编年·走 ChronicleTracker.upsert
    // RX·C4·sourceId 加 turn·保历史·同 paradigm 跨 turn 多次策对不被 upsert 覆盖
    // RY·B5·digest slice 0,20 → 0,40·防前 20 字符 collision (改革 paradigm hash 前 20 易撞)
    // RBB·BB-A1/C1·digest slice 0,40 → 0,80·防 multi-reform 同前 40 char digest collision·L7 backfill 也 80
    try {
      if (typeof window !== 'undefined' && window.ChronicleTracker && typeof window.ChronicleTracker.upsert === 'function') {
        window.ChronicleTracker.upsert({
          sourceType: 'kjp-cedui',
          sourceId: npc.name + '_T' + turn + '_' + paradigmDigest.slice(0, 80),
          type: 'reform-counsel',
          category: '科举改革',
          title: '召 ' + npc.name + ' 策对·' + paradigmDigest.slice(0, 30),
          narrative: archetype + '·' + archLabel + '·' + paradigmDigest.slice(0, 80),
          actor: npc.name,
          stakeholders: [npc.name, npc.party || ''].filter(Boolean),
          currentStage: '策对完毕',
          startTurn: turn,
          priority: 'low'
        });
      }
    } catch(_){}

    // 3. NPC reformLean +3·复用 R6 helper·clamp + decay
    // RX·B2 → RY·B2·走 _forecastReputation.lastForecastTurn 检·删 _lastCeduiTurn 冗余字段
    var sameTurnRepeat = (npc._forecastReputation && npc._forecastReputation.lastForecastTurn === turn);
    if (!sameTurnRepeat) {
      try {
        if (typeof _kjpAccumReformLean === 'function') {
          _kjpAccumReformLean(npc, 3, turn);
        }
      } catch(_){}
    }
    // _lastCeduiTurn 删·走 reputation.lastForecastTurn (Step 4 内 bump set)

    // 4. reputation·L4 留字段·L7 后真填准度
    try { _kjpBumpForecastReputation(npc, turn); } catch(_){}

    // 5. 泄露·loyalty<60 + rand<0.3 → 直接 F4 enqueue·非自建 leak 状态机
    var leaked = false;
    try {
      var loyalty = parseInt(npc.loyalty, 10) || 50;
      if (loyalty < 60 && Math.random() < 0.3) {
        leaked = true;
        if (typeof window !== 'undefined' && typeof window._kjSpawnYanguanQingyi === 'function') {
          window._kjSpawnYanguanQingyi({
            source: 'cedui-leak',
            advisorNpc: npc.name,
            advisorParty: npc.party || '',
            reason: '陛下密召 ' + npc.name + ' 策对改革·偏听一方·当广纳众议'
          });
        }
        // 标 ChronicleTracker entry leaked·便 timeline render 显
        // RX·C4·sourceId 改为 name_Tturn_digest·findBySource 也需对应
        // RBB·BB-A1/C1·digest 40 → 80·跟 upsert sourceId 一致
        try {
          if (typeof window !== 'undefined' && window.ChronicleTracker && typeof window.ChronicleTracker.findBySource === 'function') {
            var entry = window.ChronicleTracker.findBySource('kjp-cedui', npc.name + '_T' + turn + '_' + paradigmDigest.slice(0, 80));
            if (entry && typeof window.ChronicleTracker.update === 'function') {
              window.ChronicleTracker.update(entry.id, { narrative: entry.narrative + ' LEAKED' });
            }
          }
        } catch(_){}
      }
    } catch(_){}

    // 6. 精力·wendui 已扣 5·此处不重扣

    return { leaked: leaked, paradigmDigest: paradigmDigest, archetype: archetype, sameTurnRepeat: sameTurnRepeat };
  }

  // L4·b2·wendui closeWenduiModal 末调·窗内 set 的 _kjpCurrentCeduiNpcName / Draft / Archetype 读出
  function _kjpOnCeduiClose(npcName) {
    if (!npcName) return;
    try {
      var npc = (typeof findCharByName === 'function') ? findCharByName(npcName) : null;
      if (!npc) return;
      var arch = (typeof window !== 'undefined' && window._kjpCurrentCeduiArchetype) || 'A3_pragmatic';
      var draft = (typeof window !== 'undefined' && window._kjpCurrentCeduiDraft) || null;
      if (!draft) return;
      var outcome = _kjpApplyCeduiOutcome(npc, arch, draft);
      var paradigmDigest = (outcome && outcome.paradigmDigest) || '';
      var curTurn = (typeof GM !== 'undefined' && GM.turn) || 0;
      // 清 window globals (防 leak)·RZ·Z8·删 _kjpCurrentCeduiNpcName
      try {
        window._kjpCurrentCeduiDraft = null;
        window._kjpCurrentCeduiDiff = null;
        window._kjpCurrentCeduiDigest = '';
        window._kjpCurrentCeduiArchetype = null;
      } catch(_){}
      // L4·f1·multi-consult auto-trigger·近 5 turn 同 paradigm 别 advisor 已 cedui → 跑 merge LLM (async)
      try { _kjpMaybeTriggerMultiConsultMerge(npcName, paradigmDigest, curTurn); } catch(_){}
      // panel rerender L4·cedui section·更新 timeline 显新策对
      try {
        var modal = (typeof document !== 'undefined') ? document.getElementById('kjp-reform-modal') : null;
        if (modal && typeof _kjpRerenderSection === 'function') {
          _kjpRerenderSection(modal, 'l4-cedui', _kjpRenderCeduiBody);
        }
      } catch(_){}
    } catch (e) {
      try { console.warn('[L4·b2] _kjpOnCeduiClose fail', e); } catch(_){}
    }
  }

  // L4·f1·multi-consult auto-detect·近 5 turn 同 paradigm 别 advisor 已 cedui·trigger merge LLM
  // RY·B5·digest slice 0,40·RY·C1·已 trigger 过同 paradigm multi → skip·防 chronicle 爆
  // RY·A2·multi entry narrative 加 archetype 摘要 (vs)
  async function _kjpMaybeTriggerMultiConsultMerge(currentAdvisor, paradigmDigest, turn) {
    if (!currentAdvisor || !paradigmDigest) return;
    if (typeof window === 'undefined' || !window.ChronicleTracker) return;
    var raw = window.ChronicleTracker.listVisible
      ? window.ChronicleTracker.listVisible()
      : ((window.GM && window.GM._chronicleTracks) || []);
    var digestKey = paradigmDigest.slice(0, 40);   // RY·B5

    // RY·C1·dedupe·若同 paradigm 已有 multi-consult entry → skip (防多 advisor 触发 chronicle 爆)
    var existingMulti = (raw || []).find(function(t) {
      if (!t || t.sourceType !== 'kjp-multi-consult') return false;
      var p = String(t.sourceId || '').split('_');
      var d = p.length >= 3 ? p.slice(2).join('_') : '';
      return d === digestKey;
    });
    if (existingMulti) return;

    var ceduiTracks = (raw || []).filter(function(t) {
      if (!t || t.sourceType !== 'kjp-cedui') return false;
      if (Math.abs((t.startTurn || 0) - turn) > 5) return false;   // 近 5 turn
      if (t.actor === currentAdvisor) return false;                  // 不同 advisor
      // 同 paradigm·按 sourceId 末段 digest 匹·RY·B5·slice 40
      var parts = String(t.sourceId || '').split('_');
      var entryDigest = parts.length >= 3 ? parts.slice(2).join('_').slice(0, 40) : '';
      return entryDigest === digestKey;
    });
    if (!ceduiTracks.length) return;
    // 取最近一条·作 advisor B
    ceduiTracks.sort(function(a, b) { return (b.startTurn || 0) - (a.startTurn || 0); });
    var advisorB = ceduiTracks[0].actor;
    if (!advisorB || typeof _kjpLlmMergeAdvisorViews !== 'function') return;
    // 跑 merge LLM (async·不阻塞 panel)
    try {
      var merged = await _kjpLlmMergeAdvisorViews(currentAdvisor, advisorB, paradigmDigest);
      if (!merged) return;
      // RY·A2·narrative 加 archetype 摘要 (label vs label)
      var npcAforNarr = (typeof findCharByName === 'function') ? findCharByName(currentAdvisor) : null;
      var npcBforNarr = (typeof findCharByName === 'function') ? findCharByName(advisorB) : null;
      var labels = (typeof ARCHETYPE_LABELS === 'object') ? ARCHETYPE_LABELS
                  : (typeof window !== 'undefined' && window.ARCHETYPE_LABELS) || {};
      var archAlbl = (npcAforNarr && typeof _kjpInferAdvisorArchetype === 'function')
                    ? (labels[_kjpInferAdvisorArchetype(npcAforNarr)] || '务实') : '务实';
      var archBlbl = (npcBforNarr && typeof _kjpInferAdvisorArchetype === 'function')
                    ? (labels[_kjpInferAdvisorArchetype(npcBforNarr)] || '务实') : '务实';
      var narrative = archAlbl + ' vs ' + archBlbl + '·共识·' + String(merged.consensusForecast || '').slice(0, 60) +
                     '·分歧 ' + (merged.disagreements || []).length + ' 条·互动 ' + (merged.advisorRelations || []).length + ' 条';
      // chronicle 加 multi-consult entry
      if (window.ChronicleTracker && typeof window.ChronicleTracker.add === 'function') {
        window.ChronicleTracker.add({
          sourceType: 'kjp-multi-consult',
          sourceId: 'multi_T' + turn + '_' + digestKey,
          type: 'reform-multi-consult',
          category: '科举改革',
          title: '协商策对·' + currentAdvisor + ' (' + archAlbl + ') + ' + advisorB + ' (' + archBlbl + ')',
          narrative: narrative,
          actor: currentAdvisor + ' + ' + advisorB,
          stakeholders: [currentAdvisor, advisorB],
          currentStage: '协商完毕',
          startTurn: turn,
          priority: 'low'
        });
      }
      // 跨党 → _factionTension +1·一次性 prestige bonus·走两 advisor 取 party
      try {
        var npcA = (typeof findCharByName === 'function') ? findCharByName(currentAdvisor) : null;
        var npcB = (typeof findCharByName === 'function') ? findCharByName(advisorB) : null;
        if (npcA && npcB && npcA.party && npcB.party && npcA.party !== npcB.party) {
          if (typeof GM !== 'undefined' && GM) {
            GM._factionTension = Math.min(100, (parseInt(GM._factionTension, 10) || 0) + 1);
            // 一次性 prestige bonus·"看似公允"
            if (!GM._kjpFairnessBonusGranted) {
              GM._kjpFairnessBonusGranted = true;
              if (GM.vars && GM.vars['威望']) {
                GM.vars['威望'].value = Math.min(100, (GM.vars['威望'].value || 0) + 5);
              }
            }
          }
        }
      } catch(_){}
      // rerender panel
      try {
        var modal2 = (typeof document !== 'undefined') ? document.getElementById('kjp-reform-modal') : null;
        if (modal2 && typeof _kjpRerenderSection === 'function') {
          _kjpRerenderSection(modal2, 'l4-cedui', _kjpRenderCeduiBody);
        }
      } catch(_){}
    } catch (e) {
      try { console.warn('[L4·f1] multi-consult merge fail', e); } catch(_){}
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §12·辅助
  // ════════════════════════════════════════════════════════════════

  function _deepClone(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(_deepClone);
    var out = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = _deepClone(obj[k]);
    }
    return out;
  }

  function _escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ════════════════════════════════════════════════════════════════
  // §13·暴露
  // ════════════════════════════════════════════════════════════════

  global._kjpOpenReformProposal = _kjpOpenReformProposal;
  global._kjpComputeDiff = _kjpComputeDiff;
  global._kjpClassifyDiffTags = _kjpClassifyDiffTags;
  global._kjpBuildTopicText = _kjpBuildTopicText;
  global._kjpEstimateStanceDistribution = _kjpEstimateStanceDistribution;
  global._kjpSubmitReform = _kjpSubmitReform;
  global._kjpDiffMagnitude = _kjpDiffMagnitude;
  // L3·R4·新 expose·smoke 直接测·panel 内调用
  global._kjpExtractL3Meta = _kjpExtractL3Meta;
  global._kjpDeriveIntentFromPreset = _kjpDeriveIntentFromPreset;
  global._kjpApplyMagPresetIntent = _kjpApplyMagPresetIntent;
  global._kjpApplyAudienceCost = _kjpApplyAudienceCost;
  // R6·新 expose·smoke 单测 helper
  global._kjpAccumReformLean = _kjpAccumReformLean;
  global._kjpBumpLlmConcurrent = _kjpBumpLlmConcurrent;
  global._kjpRenderAudienceBody = _kjpRenderAudienceBody;
  // L4·b/b2·策对 expose
  global._kjpRenderCeduiBody = _kjpRenderCeduiBody;
  global._kjpRenderCeduiTimeline = _kjpRenderCeduiTimeline;
  global._kjpInvokeCedui = _kjpInvokeCedui;
  global._kjpApplyCeduiOutcome = _kjpApplyCeduiOutcome;
  global._kjpBumpForecastReputation = _kjpBumpForecastReputation;
  global._kjpInitForecastReputation = _kjpInitForecastReputation;
  global._kjpAuditForecastAccuracy = _kjpAuditForecastAccuracy;
  // L7·g·archetype helper expose (smoke / external 调用)
  global._kjpExtractArchetypeFromEntry = _kjpExtractArchetypeFromEntry;
  global._kjpArchetypeTypicalForecast = _kjpArchetypeTypicalForecast;
  // L4·b2·wendui close hook (wendui closeWenduiModal 末调)
  global._kjpOnCeduiClose = _kjpOnCeduiClose;
  // L4·f1·multi-consult auto-detect + merge
  global._kjpMaybeTriggerMultiConsultMerge = _kjpMaybeTriggerMultiConsultMerge;

  // ════════════════════════════════════════════════════════════════
  // §L8·改革志 modal·开 / render
  // ════════════════════════════════════════════════════════════════
  function _kjpOpenL8ChronicleModal() {
    if (typeof document === 'undefined') return;
    var existing = document.getElementById('kjp-l8-chronicle-modal');
    if (existing) { try { existing.remove(); } catch(_){} }
    var paradigm = (typeof GM !== 'undefined' && GM && GM._kejuParadigm) || {};
    var modal = document.createElement('div');
    modal.id = 'kjp-l8-chronicle-modal';
    modal.className = 'modal kjp-l8-modal';
    // L12·initial tab + active bio name·module state
    modal._kjpActiveTab = 'evolution';
    modal._kjpActiveBioName = null;
    // L12·tabs container·gated by L12 flag·若 off·tabs 不显·只 evolution
    var l12Enabled = (typeof window !== 'undefined' && typeof window._isL12Enabled === 'function') ?
                     window._isL12Enabled() : false;
    var tabsHtml = '';
    if (l12Enabled) {
      tabsHtml =
        '<div class="kjp-l12-tabs">' +
          '<button class="kjp-l12-tab kjp-l12-tab-active" data-tab="evolution">年度演化</button>' +
          '<button class="kjp-l12-tab" data-tab="list">改革列表</button>' +
          '<button class="kjp-l12-tab" data-tab="reformer">改革者</button>' +
        '</div>';
    }
    modal.innerHTML =
      '<div class="kjp-modal-content kjp-l8-modal-content">' +
        '<div class="kjp-modal-header">' +
          '<div class="kjp-modal-title">📜 改革志·年度演化 + 跨代承袭</div>' +
          '<button class="bt bs bsm kjp-l8-close-btn">✕</button>' +
        '</div>' +
        tabsHtml +
        '<div class="kjp-modal-body kjp-l8-body-wrap">' +
          _kjpRenderL8ChronicleBody(paradigm) +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // L12·rerender helper·bio gen 完后 cb 调
    // RAA·C1·必传 modal ctx·保 activeTab + activeBioName·非默认 evolution
    if (typeof window !== 'undefined') {
      window._kjpL12RerenderTab = function() {
        try {
          var m = document.getElementById('kjp-l8-chronicle-modal');
          if (!m) return;
          var body = m.querySelector('.kjp-l8-body-wrap');
          if (body) body.innerHTML = _kjpRenderL8ChronicleBody((GM && GM._kejuParadigm) || {}, m);
        } catch(_){}
      };
    }
    modal.addEventListener('click', function(e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (t.classList.contains('kjp-l8-close-btn')) {
        try { modal.remove(); } catch(_){}
        return;
      }
      // L12·tab switch
      if (t.classList.contains('kjp-l12-tab')) {
        var tab = t.dataset.tab || 'evolution';
        modal._kjpActiveTab = tab;
        // toggle active class
        try {
          var allTabs = modal.querySelectorAll('.kjp-l12-tab');
          allTabs.forEach(function(b) {
            b.classList.remove('kjp-l12-tab-active');
          });
          t.classList.add('kjp-l12-tab-active');
        } catch(_){}
        try {
          var body = modal.querySelector('.kjp-l8-body-wrap');
          if (body) body.innerHTML = _kjpRenderL8ChronicleBody((GM && GM._kejuParadigm) || {}, modal);
        } catch(_){}
        return;
      }
      // L12·改革后果汇总 折叠 toggle
      if (t.classList.contains('kjp-l12-sum-toggle')) {
        var rid2 = t.dataset.rid;
        if (!rid2) return;
        try {
          var sumBox = modal.querySelector('.kjp-l12-sum-wrap[data-rid="' + rid2 + '"]');
          if (sumBox) sumBox.classList.toggle('kjp-l12-sum-open');
        } catch(_){}
        return;
      }
      // L12·改革者 bio button·trigger gen + inline expand·A5 single active
      if (t.classList.contains('kjp-l12-bio-btn')) {
        var bname = t.dataset.name;
        if (!bname) return;
        modal._kjpActiveBioName = bname;
        try {
          var body2 = modal.querySelector('.kjp-l8-body-wrap');
          if (body2) body2.innerHTML = _kjpRenderL8ChronicleBody((GM && GM._kejuParadigm) || {}, modal);
        } catch(_){}
        return;
      }
      // L12·timeline bar click → 跳 evolution tab + scroll to section
      // RBB·F1·目标 section 的 summary 自动展开·user 见 context
      if (t.classList.contains('kjp-l12-tl-bar') ||
          (t.parentElement && t.parentElement.classList && t.parentElement.classList.contains('kjp-l12-tl-bar'))) {
        var barEl = t.classList.contains('kjp-l12-tl-bar') ? t : t.parentElement;
        var rid3 = barEl.dataset.rid;
        if (!rid3) return;
        modal._kjpActiveTab = 'evolution';
        try {
          var allTabs2 = modal.querySelectorAll('.kjp-l12-tab');
          allTabs2.forEach(function(b) { b.classList.remove('kjp-l12-tab-active'); });
          var evoTab = modal.querySelector('.kjp-l12-tab[data-tab="evolution"]');
          if (evoTab) evoTab.classList.add('kjp-l12-tab-active');
          var body3 = modal.querySelector('.kjp-l8-body-wrap');
          if (body3) {
            body3.innerHTML = _kjpRenderL8ChronicleBody((GM && GM._kejuParadigm) || {}, modal);
            setTimeout(function() {
              var sect = body3.querySelector('.kjp-l8-reform-section[data-rid="' + rid3 + '"]');
              if (sect && sect.scrollIntoView) sect.scrollIntoView({ behavior: 'smooth', block: 'start' });
              // RBB·F1·summary auto-open (timeline jump 目标·user 见 context)
              var sumBox = body3.querySelector('.kjp-l12-sum-wrap[data-rid="' + rid3 + '"]');
              if (sumBox) sumBox.classList.add('kjp-l12-sum-open');
            }, 50);
          }
        } catch(_){}
        return;
      }
      // L11·timeline [废止] button click·开 rollback modal
      // RAA·A8·multi-click dedup·先 remove any existing L11 rollback modal·防多 modal
      if (t.classList.contains('kjp-l11-rollback-btn')) {
        var rid = t.dataset.rid;
        if (!rid) return;
        // dedup·先 remove 既存的 L11 rollback modal (防快速点不同 entry 双开)
        try {
          var existing = document.getElementById('kjp-l11-rollback-modal');
          if (existing) existing.remove();
        } catch(_){}
        var paradigm2 = (typeof GM !== 'undefined' && GM && GM._kejuParadigm) || {};
        var target = null;
        var hl = paradigm2.history || [];
        for (var i = 0; i < hl.length; i++) {
          if (hl[i] && hl[i].id === rid) { target = hl[i]; break; }
        }
        if (target && typeof window !== 'undefined' &&
            typeof window._kjpL11OpenRollbackModal === 'function') {
          try { window._kjpL11OpenRollbackModal(target); } catch(err) {
            try { console.warn('[L11·open]', err); } catch(_){}
          }
        }
        return;
      }
    });
  }

  function _kjpRenderL8ChronicleBody(paradigm, modalCtx) {
    // L12·tab routing·若 modal._kjpActiveTab 非 evolution·走 L12 sub-render
    var l12Enabled = (typeof window !== 'undefined' && typeof window._isL12Enabled === 'function') ?
                     window._isL12Enabled() : false;
    var activeTab = (modalCtx && modalCtx._kjpActiveTab) || 'evolution';
    if (l12Enabled && activeTab === 'list') {
      if (typeof window._kjpL12RenderTimelineTab === 'function') {
        return window._kjpL12RenderTimelineTab(paradigm);
      }
    }
    if (l12Enabled && activeTab === 'reformer') {
      if (typeof window._kjpL12RenderReformerTab === 'function') {
        return window._kjpL12RenderReformerTab(paradigm, modalCtx._kjpActiveBioName);
      }
    }
    // evolution tab (default·现 L8 path)
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL8 === false) {
      return '<div class="kjp-muted kjp-l8-disabled-hint">L8 未启·设 P.conf.useNewKejuL8=true 开年度演化 + 跨代承袭</div>';
    }
    var html = '';
    // 跨代承袭顶 banner
    if (paradigm._inheritance) {
      var i = paradigm._inheritance;
      html += '<div class="kjp-l8-inheritance-banner">' +
        '<b>新朝承前·' + _escHtml(i.mode || '') + '</b><br>' + _escHtml(i.edict || '') +
        (i.rationale ? '<div class="kjp-l8-rationale">' + _escHtml(i.rationale) + '</div>' : '') +
        '</div>';
    }
    var chronicle = paradigm._reformChronicle || {};
    var histById = {};
    (paradigm.history || []).forEach(function(h) { if (h && h.id) histById[h.id] = h; });
    var histIds = Object.keys(chronicle);
    if (!histIds.length) {
      html += '<div class="kjp-muted">(无改革志·改革施行后会逐年累积)</div>';
      return html;
    }
    var L9_SWAN_LABEL = {
      examiner_corrupt:  '主考贿赂',
      student_boycott:   '考生罢考',
      reformer_illness:  '改革者病',
      finance_diversion: '财政挪用'
    };
    histIds.forEach(function(histId) {
      var entry = histById[histId] || { magnitudeDescriptor: '(未知改革)', method: '', status: '' };
      // L12·section data-rid·timeline click → 跳到此 section
      html += '<div class="kjp-l8-reform-section" data-rid="' + _escHtml(entry.id || histId) + '">';
      // L9·canonicalName 顶 banner (若已命名)
      if (entry.canonicalName) {
        html += '<div class="kjp-l9-canonical-name">📜 ' + _escHtml(entry.canonicalName) + '</div>';
        if (entry.historicalEvaluation) {
          html += '<div class="kjp-l9-hist-eval">' + _escHtml(entry.historicalEvaluation) + '</div>';
        }
      }
      html += '<b>' + _escHtml(entry.magnitudeDescriptor || '') + '</b>·' +
        _escHtml(entry.method || '') + '·' + _escHtml(entry.status || '');
      // L11·timeline 注 [废止] button·gate (status + flag + !rollback tag + !rolled_back)
      if (typeof window !== 'undefined' && typeof window._kjpL11RenderTimelineRollbackButton === 'function') {
        html += ' ' + window._kjpL11RenderTimelineRollbackButton(entry);
      }
      // L12·改革后果汇总 折叠 button·gated by L12 + entry.id valid
      if (l12Enabled && entry.id) {
        html += ' <button class="bt bsm kjp-l12-sum-toggle" data-rid="' + _escHtml(entry.id) +
                '">📊 后果汇总</button>';
        var sumHtml = (typeof window._kjpL12RenderImpactSummary === 'function')
          ? window._kjpL12RenderImpactSummary(entry) : '';
        html += '<div class="kjp-l12-sum-wrap" data-rid="' + _escHtml(entry.id) + '">' +
                sumHtml + '</div>';
      }
      var years = Object.keys(chronicle[histId] || {}).map(Number)
                  .filter(function(n){ return !isNaN(n); })
                  .sort(function(a,b){ return a-b; });
      years.forEach(function(y) {
        var e = chronicle[histId][y];
        if (!e) return;
        // L9·若 stub 无 specialEvent·skip·若 stub 但有 specialEvent (黑天鹅 evolve 前 fire)·渲染
        if (e._stub && !e.specialEvent) return;
        // L9·黑天鹅 chip
        var swanChip = e.specialEvent ?
          '<span class="kjp-l9-swan-chip kjp-l9-sev-' + _escHtml(e.specialEvent.severity || 'low') + '">⚠️ ' +
            _escHtml(L9_SWAN_LABEL[e.specialEvent.type] || '意外') +
          '</span>' : '';
        html += '<div class="kjp-l8-year-entry">' +
          '<span class="year-label">' + y + '年</span>' + swanChip +
          (e.text ? '<div class="kjp-l8-text">' + _escHtml(e.text) + '</div>' : '') +
          (e.snippets && e.snippets.length ?
            '<div class="kjp-l8-snippets">· ' + e.snippets.map(_escHtml).join('·') + '</div>' : '') +
          (e.npcReact && e.npcReact.length ?
            '<div class="kjp-l8-npc">[NPC] ' + e.npcReact.map(function(r) {
              return _escHtml(r.name) + '·' + _escHtml(r.action) + '·' + _escHtml(r.reaction);
            }).join('·') + '</div>' : '') +
          (e.specialEvent && e.specialEvent.narrative ?
            '<div class="kjp-l9-swan-narr">[黑天鹅] ' + _escHtml(e.specialEvent.narrative) + '</div>' : '') +
          '</div>';
      });
      html += '</div>';
    });
    return html;
  }
  global._kjpOpenL8ChronicleModal = _kjpOpenL8ChronicleModal;
  global._kjpRenderL8ChronicleBody = _kjpRenderL8ChronicleBody;

  // ════════════════════════════════════════════════════════════════
  // §L10·历史改革 preset modal·open + render + apply
  //   复用 L2 draft state + L8 modal frame paradigm
  // ════════════════════════════════════════════════════════════════

  function _kjpOpenL10PresetModal(reformModal) {
    if (typeof document === 'undefined') return;
    if (typeof L10_PRESETS === 'undefined') return;
    var existing = document.getElementById('kjp-l10-preset-modal');
    if (existing) { try { existing.remove(); } catch(_){} }
    var listModal = document.createElement('div');
    listModal.id = 'kjp-l10-preset-modal';
    listModal.className = 'modal kjp-l10-modal';
    listModal.innerHTML =
      '<div class="kjp-modal-content kjp-l10-modal-content">' +
        '<div class="kjp-modal-header">' +
          '<div class="kjp-modal-title">📜 历史改革模板·按朝代</div>' +
          '<button class="bt bs bsm kjp-l10-close-btn">✕</button>' +
        '</div>' +
        '<div class="kjp-modal-body">' +
          _kjpRenderL10PresetList(reformModal) +
        '</div>' +
      '</div>';
    document.body.appendChild(listModal);
    listModal.addEventListener('click', function(e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (t.classList.contains('kjp-l10-close-btn')) {
        try { listModal.remove(); } catch(_){}
        return;
      }
      if (t.classList.contains('kjp-l10-apply-btn')) {
        var pid = t.dataset.pid;
        try { _kjpL10ApplyPreset(pid, reformModal); } catch(err) {
          try { console.warn('[L10·apply]', err); } catch(_){}
        }
        try { listModal.remove(); } catch(_){}
      }
    });
  }

  function _kjpRenderL10PresetList(reformModal) {
    if (typeof L10_PRESETS === 'undefined' || !Array.isArray(L10_PRESETS)) {
      return '<div class="kjp-muted">L10_PRESETS 未载</div>';
    }
    var era = (GM && GM._kejuParadigm && GM._kejuParadigm.initEra) || '';
    var eraKey = (typeof _kjpL8EraToKey === 'function')
      ? _kjpL8EraToKey(era)
      : String(era || '').toLowerCase();
    var sameEra = (typeof _kjpL10FilterByEra === 'function')
      ? _kjpL10FilterByEra(eraKey)
      : L10_PRESETS.slice();
    var html = '';
    // 当朝 preset (若 fallback all·标志显)
    var sameEraOnly = L10_PRESETS.filter(function(p) { return p.era === eraKey; });
    if (sameEraOnly.length) {
      html += '<div class="kjp-l10-section-title">本朝 (' +
              (typeof _kjpL10EraLabel === 'function' ? _kjpL10EraLabel(eraKey) : eraKey) +
              '·' + sameEraOnly.length + ')</div>';
      html += sameEraOnly.map(_renderCard).join('');
    } else if (sameEra.length) {
      html += '<div class="kjp-l10-section-title kjp-muted">本朝无 preset·显全朝代 (' + sameEra.length + ')</div>';
    }
    // 全朝代 list 折叠 (若本朝有)·或直接显 (若本朝无)
    if (sameEraOnly.length) {
      html += '<details class="kjp-l10-all-section">';
      html += '<summary>查全朝代 (' + L10_PRESETS.length + ')</summary>';
      html += L10_PRESETS.map(_renderCard).join('');
      html += '</details>';
    } else {
      html += L10_PRESETS.map(_renderCard).join('');
    }
    return html;

    function _renderCard(p) {
      var eraLbl = (typeof _kjpL10EraLabel === 'function') ? _kjpL10EraLabel(p.era) : p.era;
      var yearStr = (p.year < 0) ? ('前' + Math.abs(p.year)) : String(p.year);
      return '<div class="kjp-l10-preset-card">' +
        '<div class="kjp-l10-card-head">' +
          '<b>' + _escHtml(p.canonicalName) + '</b>·' +
          '<span class="kjp-l10-era-badge">' + _escHtml(eraLbl) + '</span>·' +
          _escHtml(p.by) + '·' + yearStr + '年·' +
          '<span class="kjp-l10-method">' + _escHtml(p.method || '') + '</span>' +
        '</div>' +
        '<div class="kjp-l10-hist-eval">' + _escHtml(p.historicalEvaluation || '') + '</div>' +
        '<div class="kjp-l10-mag">' + _escHtml(p.magnitudeDescriptor || '') + '</div>' +
        '<button class="bt bsm kjp-l10-apply-btn" data-pid="' + _escHtml(p.id) + '">▶ 一键 fill</button>' +
      '</div>';
    }
  }

  // L10·apply·fill draft·复用 L2 _kjpRerenderSubjects + _kjpRefreshPreview
  // RAA·C2·必 ship magnitudeParsed·skip L3 LLM 重解
  // RAA·B1·magnitudeDescriptorPreset 同 set·防 L3 重 fire
  // RAA·C3·_l10PresetId 标记 commit shortcircuit·_kjpInitDraft 已默 null·跨议题 reset
  function _kjpL10ApplyPreset(presetId, modal) {
    if (typeof L10_PRESETS === 'undefined' || !Array.isArray(L10_PRESETS)) return;
    if (!presetId || !modal || !modal._kjpDraft) return;
    var preset = null;
    for (var i = 0; i < L10_PRESETS.length; i++) {
      if (L10_PRESETS[i].id === presetId) { preset = L10_PRESETS[i]; break; }
    }
    if (!preset) return;
    var draft = modal._kjpDraft;

    // L11·A2·若 preset 含 'rollback' tag·走 L11 rollback path·有 target → rollback modal·无 → fallback restoration
    try {
      var tags = (preset.magnitudeParsed && preset.magnitudeParsed.tags) || [];
      var isRollbackPreset = tags.indexOf && tags.indexOf('rollback') >= 0;
      if (isRollbackPreset && typeof window !== 'undefined' &&
          typeof window._kjpL11ApplyL10RollbackPreset === 'function') {
        var handled = window._kjpL11ApplyL10RollbackPreset(preset, modal);
        if (handled) return;   // L11 接管·跳现 apply
        // 未接管 (无 target)·draft._l10RollbackFallback 已 set·继续走现 apply path (intent fallback 已 set)
      }
    } catch(_){}

    // RAA·C2·multi-apply warn·user 已 apply 过 preset (不同 id)·toast 提示·非 block (叠加 OK 但 user 应知)
    if (draft._l10PresetId && draft._l10PresetId !== preset.id) {
      try {
        if (typeof toast === 'function') {
          toast('⚠️ 已 apply "' + (draft._l10PresetCanonicalName || draft._l10PresetId) +
                '"·此次叠加 "' + preset.canonicalName + '"·subjects 合并');
        }
      } catch(_){}
    }

    // subjects·added·dedup by name
    if (preset.diff && preset.diff.subjects) {
      (preset.diff.subjects.added || []).forEach(function(s) {
        draft.subjectsDraft = draft.subjectsDraft || [];
        if (!draft.subjectsDraft.some(function(x) { return x.name === s.name; })) {
          draft.subjectsDraft.push(Object.assign({}, s));
        }
      });
      (preset.diff.subjects.removed || []).forEach(function(s) {
        // RAA·B1·id 优先匹配·若 preset 指 id·只删 id 同·避同名不同 id 误删
        // 若 preset 无 id·才走 name 匹配
        draft.subjectsDraft = (draft.subjectsDraft || []).filter(function(x) {
          if (s.id) return x.id !== s.id;
          return x.name !== s.name;
        });
      });
    }
    // ideology / examInterval / retakePolicy
    if (preset.diff && preset.diff.ideology) draft.ideologyDraft = preset.diff.ideology;
    if (preset.diff && preset.diff.examInterval != null) draft.examIntervalDraft = preset.diff.examInterval;
    if (preset.diff && preset.diff.retakePolicy) draft.retakePolicyDraft = preset.diff.retakePolicy;
    // magnitude·全 set·skip L3 LLM·preset 必 ship magnitudeParsed
    draft.magnitudeDescriptor = preset.magnitudeDescriptor || '';
    draft.magnitudeDescriptorPreset = preset.magnitudeDescriptorPreset || preset.id;
    draft.magnitudeParsed = preset.magnitudeParsed || null;
    // 标记 preset 来源·L7 commit step 4.5 读 topicData.l10PresetId → skip L9 LLM
    draft._l10PresetId = preset.id;
    draft._l10PresetCanonicalName = preset.canonicalName;
    draft._l10PresetHistoricalEvaluation = preset.historicalEvaluation;
    draft._l10PresetBy = preset.by;

    // rerender·复用 L2 path
    try { _kjpRerenderSubjects(modal); } catch(_){}
    try { _kjpRefreshPreview(modal); } catch(_){}
    // toast
    try {
      if (typeof toast === 'function') {
        toast('📜 已 fill·' + preset.canonicalName + '·可编辑后上奏 (政治后果同手动)');
      }
    } catch(_){}
  }

  global._kjpOpenL10PresetModal = _kjpOpenL10PresetModal;
  global._kjpRenderL10PresetList = _kjpRenderL10PresetList;
  global._kjpL10ApplyPreset = _kjpL10ApplyPreset;
  global._kjpRenderL10PresetAction = _kjpRenderL10PresetAction;

  // L10·RAA·C1·material edit detect·user 改 subjects/ideology 后清 preset 标记·走 L9 LLM
  // 防虚假命名 (e.g. apply 熙宁变法 后 user 改 subjects·canonicalName 仍 '熙宁变法' 但实际不同)
  function _kjpL10MarkUserEdited(draft) {
    if (!draft) return;
    if (!draft._l10PresetId) return;   // 未 apply preset·noop
    var prev = draft._l10PresetCanonicalName;
    draft._l10PresetId = null;
    draft._l10PresetCanonicalName = null;
    draft._l10PresetHistoricalEvaluation = null;
    draft._l10PresetBy = null;
    try {
      if (typeof toast === 'function') {
        toast('📝 已改 "' + (prev || '') + '" 内容·canonicalName 走 L9 LLM 自定命名');
      }
    } catch(_){}
  }
  global._kjpL10MarkUserEdited = _kjpL10MarkUserEdited;

  // ════════════════════════════════════════════════════════════════
  // L-C·s3·modal state cleanup helpers·cascade clear per feature
  //   集中清·避散布各 close handler·新 feature 加字段时只改这里
  // ════════════════════════════════════════════════════════════════

  function _kjpDraftClearL10(draft) {
    if (!draft) return;
    draft._l10PresetId = null;
    draft._l10PresetCanonicalName = null;
    draft._l10PresetHistoricalEvaluation = null;
    draft._l10PresetBy = null;
    draft._l10RollbackFallback = null;
  }

  function _kjpModalClearL12(modal) {
    if (!modal) return;
    modal._kjpActiveTab = 'evolution';
    modal._kjpActiveBioName = null;
  }

  function _kjpModalClearL11(modal) {
    if (!modal) return;
    modal._kjpL11Target = null;
    modal._kjpL11Mode = null;
    modal._kjpL11Keep = null;
  }

  global._kjpDraftClearL10 = _kjpDraftClearL10;
  global._kjpModalClearL12 = _kjpModalClearL12;
  global._kjpModalClearL11 = _kjpModalClearL11;

  if (!global.TM) global.TM = {};
  if (!global.TM.Keju) global.TM.Keju = {};
  if (!global.TM.Keju.ParadigmPanel) global.TM.Keju.ParadigmPanel = {};
  global.TM.Keju.ParadigmPanel.open = _kjpOpenReformProposal;
  global.TM.Keju.ParadigmPanel.computeDiff = _kjpComputeDiff;
  global.TM.Keju.ParadigmPanel.classifyTags = _kjpClassifyDiffTags;
  global.TM.Keju.ParadigmPanel.buildTopicText = _kjpBuildTopicText;
  global.TM.Keju.ParadigmPanel.estimateStance = _kjpEstimateStanceDistribution;
  global.TM.Keju.ParadigmPanel.submitReform = _kjpSubmitReform;
  global.TM.Keju.ParadigmPanel.diffMagnitude = _kjpDiffMagnitude;
  global.TM.Keju.ParadigmPanel.SUBJECT_CANDIDATES = SUBJECT_CANDIDATES;
  global.TM.Keju.ParadigmPanel.NEUTRAL_PARTIES = NEUTRAL_PARTIES;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjpOpenReformProposal: _kjpOpenReformProposal,
      _kjpComputeDiff: _kjpComputeDiff,
      _kjpClassifyDiffTags: _kjpClassifyDiffTags,
      _kjpBuildTopicText: _kjpBuildTopicText,
      _kjpEstimateStanceDistribution: _kjpEstimateStanceDistribution,
      _kjpSubmitReform: _kjpSubmitReform,
      _kjpDiffMagnitude: _kjpDiffMagnitude,
      _kjpExtractL3Meta: _kjpExtractL3Meta,
      _kjpDeriveIntentFromPreset: _kjpDeriveIntentFromPreset,
      _kjpApplyMagPresetIntent: _kjpApplyMagPresetIntent,
      _kjpApplyAudienceCost: _kjpApplyAudienceCost,
      _kjpAccumReformLean: _kjpAccumReformLean,
      _kjpBumpLlmConcurrent: _kjpBumpLlmConcurrent,
      _kjpRenderAudienceBody: _kjpRenderAudienceBody,
      // L4·b/b2
      _kjpRenderCeduiBody: _kjpRenderCeduiBody,
      _kjpRenderCeduiTimeline: _kjpRenderCeduiTimeline,
      _kjpInvokeCedui: _kjpInvokeCedui,
      _kjpApplyCeduiOutcome: _kjpApplyCeduiOutcome,
      _kjpBumpForecastReputation: _kjpBumpForecastReputation,
      _kjpInitForecastReputation: _kjpInitForecastReputation,
      _kjpAuditForecastAccuracy: _kjpAuditForecastAccuracy,
      _kjpOnCeduiClose: _kjpOnCeduiClose,
      _kjpMaybeTriggerMultiConsultMerge: _kjpMaybeTriggerMultiConsultMerge,
      SUBJECT_CANDIDATES: SUBJECT_CANDIDATES,
      NEUTRAL_PARTIES: NEUTRAL_PARTIES
    };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   御案·中央内容区（12 kind dispatch + tmfRenwu* 人物图志 + renwu filter UI·Wave 5 从 bridge 拆出）
//   §1 alias 块       cross-closure helpers from bridge._xxx
//   §2 late-bound     wrappers（into bridge / window）
//   §3 module body    迁入主体（body 0 改动）：renderRenwuModule · 时政 _shizheng* · 朝议/科举/密召入口
//   §4 attach         public API + re-attach bridge 导出
// ─────────────────────────────────────────────
// phase8-formal-modules.js·module 中央内容区 (12 kind dispatch + tmfRenwu* 人物图志 + renwu filter UI)
// split from phase8-formal-bridge.js·2026-05-26·Wave 5
// paradigm·head alias 块·body 0 改动·跨闭包 helper 通过 bridge._xxx + late-bound wrapper

(function(){
  'use strict';

  var bridge = window.TMPhase8FormalBridge;
  if (!bridge) {
    console.error('[phase8-formal-modules] TMPhase8FormalBridge not init·bridge.js 必须先 load');
    return;
  }

  var state = bridge._state || window.TM_PHASE8_FORMAL;

  // ── alias 块 (cross-closure helpers from bridge._xxx) ──────────────
  var esc = bridge._esc;
  var attr = bridge._attr;
  var asset = bridge._asset;
  var fmtNum = bridge._fmtNum;
  var miniRows = bridge._miniRows;
  var actionButton = bridge._actionButton;
  var dossierRows = bridge._dossierRows;
  var ownerKey = bridge._ownerKey;
  var ownerName = bridge._ownerName;
  var findFaction = bridge._findFaction;
  var findPerson = bridge._findPerson;
  var personKey = bridge._personKey;
  var personNameKey = bridge._personNameKey;
  var getPeople = bridge._getPeople;
  var getMapData = bridge._getMapData;
  var getParties = bridge._getParties;
  var getClasses = bridge._getClasses;
  var collectRecentEvents = bridge._collectRecentEvents;
  var getTurnText = bridge._getTurnText;
  var firstArray = bridge._firstArray;
  var compactText = bridge._compactText;
  var getMemorials = bridge._getMemorials;
  var getIssues = bridge._getIssues;
  var getLetters = bridge._getLetters;
  var getActiveScenario = bridge._getActiveScenario;
  var getArmies = bridge._getArmies;
  var issueIsResolved = bridge._issueIsResolved;
  var toast = bridge._toast;
  var renderEventFeed = bridge._renderEventFeed;
  var isPinned = bridge._isPinned;
  var issueRank = bridge._issueRank;
  var renderIssueCard = bridge._renderIssueCard;
  var renderIssueDetail = bridge._renderIssueDetail;

  // ── late-bound wrappers (orchestration into bridge / window) ───────
  function openPanel(slot){ return bridge.openPanel(slot); }
  function openGuoku(){ return bridge.openGuoku(); }
  function clearOfficeStandaloneMode(){ return bridge._clearOfficeStandaloneMode && bridge._clearOfficeStandaloneMode(); }
  function pinPerson(idOrName, force){ return bridge._pinPerson && bridge._pinPerson(idOrName, force); }
  function rightOpenGuokuLegacyAction(method){
    var rr = bridge.rightrail || {};
    if (rr.rightOpenGuokuLegacyAction) return rr.rightOpenGuokuLegacyAction(method);
  }

  var RENWU_INITIAL_RENDER_LIMIT = 80;
  var RENWU_RENDER_BATCH_SIZE = 60;
  var _renwuRenderBatchToken = 0;
  var _renwuFilterTimer = 0;

  // ── module body (P3 Wave 5 迁入·1241 行·body 0 改动) ─────────────

  function closeModule(){
    var old = document.getElementById('tmf-module-overlay');
    if (old) old.remove();
    _renwuRenderBatchToken++;
    if (_renwuFilterTimer) {
      clearTimeout(_renwuFilterTimer);
      _renwuFilterTimer = 0;
    }
  }

  function moduleShell(kind, title, sub, left, main, right){
    return '<section class="tmf-module tmf-module-' + esc(kind) + '" role="dialog" aria-label="' + esc(title) + '">' +
      '<header><div><span>Phase 8 · 正式界面</span><h2>' + esc(title) + '</h2><p>' + esc(sub || '') + '</p></div><button type="button" data-module-close="1">×</button></header>' +
      '<div class="tmf-module-body">' +
        '<aside class="tmf-module-left">' + left + '</aside>' +
        '<main class="tmf-module-main">' + main + '</main>' +
        '<aside class="tmf-module-right">' + right + '</aside>' +
      '</div>' +
      '</section>';
  }

  function openModule(kind, options){
    clearOfficeStandaloneMode();
    state.activeModule = { kind: kind, options: options || {} };
    closeModule();
    var ov = document.createElement('div');
    ov.id = 'tmf-module-overlay';
    ov.className = 'tmf-module-overlay tmf-module-overlay-' + String(kind || 'generic').replace(/[^\w-]/g, '');
    ov.innerHTML = renderModule(kind, options || {});
    ov.addEventListener('click', function(e){
      if (e.target === ov || (e.target && e.target.dataset && e.target.dataset.moduleClose)) {
        closeModule();
        return;
      }
      var btn = e.target && e.target.closest ? e.target.closest('[data-module-action]') : null;
      if (!btn) return;
      handleModuleAction(btn.dataset.moduleAction, moduleActionData(btn));
    });
    ov.addEventListener('input', function(e){
      if (e.target && e.target.matches && e.target.matches('[data-renwu-search]')) scheduleRenwuFilter(ov, 120);
    });
    ov.addEventListener('compositionend', function(e){
      if (e.target && e.target.matches && e.target.matches('[data-renwu-search]')) filterRenwuOverlay(ov);
    });
    ov.addEventListener('change', function(e){
      if (e.target && e.target.matches && e.target.matches('[data-renwu-filter]')) filterRenwuOverlay(ov);
    });
    document.body.appendChild(ov);
    if (kind === 'renwu') {
      var people = getPeople();
      var selected = findPerson(state.modulePerson) || people[0] || {};
      appendRenwuCardsChunked(ov, people, personKey(selected));
      filterRenwuOverlay(ov, { preserveScroll: true });
      restoreRenwuRosterScroll(ov);
    } else if (ov.querySelector('[data-renwu-card]')) {
      filterRenwuOverlay(ov);
    }
  }

  function rerenderModule(options){
    if (!state.activeModule) return;
    if (state.activeModule.kind === 'renwu' && !(options && options.skipRenwuScrollRemember)) rememberRenwuRosterScroll();
    openModule(state.activeModule.kind, state.activeModule.options || {});
  }

  function moduleActionData(btn){
    var data = {};
    try {
      Object.keys(btn && btn.dataset || {}).forEach(function(k){ data[k] = btn.dataset[k]; });
    } catch (_) {}
    data.buttonText = compactText(btn && (btn.textContent || btn.value || ''), 120);
    data.ariaLabel = btn && btn.getAttribute ? (btn.getAttribute('aria-label') || btn.getAttribute('title') || '') : '';
    return data;
  }

  function emitPlayerActionSignal(payload, options){
    options = options || {};
    var recorded = false;
    try {
      if (window.TM && TM.PlayerActionSignals && typeof TM.PlayerActionSignals.record === 'function') {
        TM.PlayerActionSignals.record(GM, payload);
        recorded = true;
      }
    } catch (_) {}
    try {
      if (options.calibrate !== false && window.TM && TM.PartyClassLlmCalibrator && typeof TM.PartyClassLlmCalibrator.notifyPlayerAction === 'function') {
        TM.PartyClassLlmCalibrator.notifyPlayerAction(Object.assign({}, payload, { skipSignalRecord: recorded }));
      }
    } catch (_) {}
  }

  function shouldCalibrateUiAction(action, data, extraText){
    data = data || {};
    if (window.P && P.conf) {
      if (P.conf.partyClassLlmUiActionsEnabled === false || P.conf.partyClassLlmUiClicksEnabled === false) return false;
      if (P.conf.partyClassLlmCalibrateAllUiClicks === true) return true;
    }
    action = String(action || '');
    if (action === 'add-edict') return !!extraText;
    if (action === 'issue-done') return true;
    if (action === 'shizheng-choice') return true;
    if (action === 'shizheng-convene' || action === 'shizheng-secret') return true;
    return false;
  }

  function recordUiActionSignal(action, data, extraText){
    try {
      if (!window.GM) return;
      data = data || {};
      var text = [
        state.activeModule && state.activeModule.kind,
        action,
        data.buttonText,
        data.ariaLabel,
        data.id,
        data.text,
        data.topic,
        data.tab,
        data.method,
        data.personAction,
        extraText
      ].filter(Boolean).join(' ');
      var payload = {
        root: GM,
        source: 'phase8-formal-module',
        action: action || '',
        kind: action || '',
        topic: data.topic || data.tab || data.method || data.buttonText || '',
        target: data.id || '',
        targetId: data.id || '',
        text: text,
        evidence: [data.buttonText, extraText].filter(Boolean)
      };
      emitPlayerActionSignal(payload, { calibrate: shouldCalibrateUiAction(action, data, extraText) });
    } catch (_) {}
  }

  function handleModuleAction(action, data){
    recordUiActionSignal(action, data);
    if (action === 'add-edict') {
      var issue = getIssues().find(function(x){ return String(x.id) === String(data.id || ''); });
      if (!issue) return;
      var draftText = '就“' + issue.title + '”，着有关衙门会同详议，限期具奏。';
      recordUiActionSignal(action, data, [issue.title, issue.category, issue.severity, issue.proposer, issue.text, draftText].filter(Boolean).join(' '));
      state.edictDraft = state.edictDraft || [];
      state.edictDraft.push(draftText);
      rerenderModule();
    } else if (action === 'clear-edict') {
      state.edictDraft = [];
      rerenderModule();
    } else if (action === 'issue-done') {
      toast('已记录裁断：' + (data.id || '议题'));
    } else if (action === 'select-issue') {
      state.shizhengIssue = data.id || '';
      rerenderModule();
    } else if (action === 'shizheng-old' || action === 'shizheng-refresh') {
      rerenderModule();
    } else if (action === 'shizheng-choice') {
      if (typeof window._chooseIssueOption === 'function') {
        window._chooseIssueOption(data.id || '', Number(data.choice || 0));
        state.shizhengIssue = data.id || state.shizhengIssue || '';
        setTimeout(function(){
          rerenderModule();
          renderEventFeed();
        }, 0);
      } else {
        toast('裁断流程未加载');
      }
    } else if (action === 'shizheng-convene') {
      closeModule();
      if (typeof window._shizhengConvene === 'function') window._shizhengConvene(data.id || '');
      else if (typeof window.openChaoyi === 'function') window.openChaoyi();
      else openModule('chaoyi', { mode: 'tingyi' });
    } else if (action === 'shizheng-secret') {
      closeModule();
      if (typeof window._shizhengSecret === 'function') window._shizhengSecret(data.id || '');
      else if (typeof window.openMiZhaoPicker === 'function') window.openMiZhaoPicker(data.id || '');
      else openModule('wendui');
    } else if (action === 'select-person') {
      state.modulePerson = data.id || '';
      if (refreshRenwuSelection()) return;
      rerenderModule();
    } else if (action === 'pin-person') {
      pinPerson(data.id, true);
      rerenderModule();
    } else if (action === 'renwu-tab') {
      state.renwuTab = data.tab || 'overview';
      if (refreshRenwuSelection()) return;
      rerenderModule();
    } else if (action === 'renwu-reset') {
      state.renwuFilters = { q: '', group: 'all', faction: 'all', status: 'all', showDead: false };
      state.renwuRosterScroll = 0;
      rerenderModule({ skipRenwuScrollRemember: true });
    } else if (action === 'renwu-person-action') {
      if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.personAction === 'function') {
        window.TMPhase8FormalBridge.personAction(data.id, data.personAction || 'detail');
      }
    } else if (action === 'ceming-open') {
      if (window.TM && TM.ceming && typeof TM.ceming.openDialog === 'function') {
        TM.ceming.openDialog();
        var cemingOverlay = document.getElementById('ceming-overlay');
        if (cemingOverlay) cemingOverlay.style.zIndex = '10050';
      } else {
        toast('策名系统未加载');
      }
    } else if (action === 'record-tab') {
      state.recordTab = data.tab || 'shiji';
      rerenderModule();
    } else if (action === 'panel') {
      closeModule();
      openPanel(data.slot || '');
    } else if (action === 'finance-full') {
      openGuoku();
    } else if (action === 'finance-old') {
      rightOpenGuokuLegacyAction(data.method);
    } else if (action === 'open-keju-panel') {
      closeModule();
      if (typeof window.openKejuPanel === 'function') window.openKejuPanel();
      else if (typeof window.showKejuModal === 'function') window.showKejuModal();
      else toast('科举系统未加载');
    } else if (action === 'toast') {
      toast(data.text || '已记录');
    }
  }

  function renderModule(kind, options){
    if (kind === 'edict') return renderEdictModule();
    if (kind === 'memorial') return renderMemorialModule();
    if (kind === 'letter') return renderLetterModule();
    if (kind === 'records') return renderRecordsModule();
    if (kind === 'renwu') return (window.renderRenwuModule || renderRenwuModule)();
    if (kind === 'shizheng') return renderShizhengModule();
    if (kind === 'wendui') return renderWenduiModule();
    if (kind === 'chaoyi') return renderChaoyiModule(options || {});
    if (kind === 'keju') return renderKejuModule();
    if (kind === 'wenshi') return renderWenshiModule();
    if (kind === 'finance') return renderFinanceModule();
    if (kind === 'office') return renderOfficeModule();
    return moduleShell('generic', '国事面板', '正式页 Phase8 原生面板', '', '<p class="tmf-module-note">暂无内容。</p>', '');
  }

  function renderIssueListForEdict(){
    var issues = getIssues();
    return '<h3>议事清册</h3><div class="tmf-module-scroll">' + issues.map(function(x){
      return '<article class="tmf-module-item"><b>' + esc(x.title) + '</b><span>' + esc(x.category) + ' · ' + esc(x.severity) + ' · ' + esc(x.proposer) + '</span><p>' + esc(x.text || '无详情') + '</p><button type="button" data-module-action="add-edict" data-id="' + esc(x.id) + '">纳入</button></article>';
    }).join('') + '</div>';
  }

  function renderEdictModule(){
    var draft = state.edictDraft || [];
    if (!draft.length) draft = ['奉天承运皇帝诏曰：', '诸司各以本职详议急务，毋得互相推诿。'];
    var main = '<h3>御笔草诏</h3><div class="tmf-edict-paper">' + draft.map(function(x){ return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' +
      '<div class="tmf-module-actions"><button type="button" data-module-action="toast" data-text="诏书已暂存">暂存草诏</button><button type="button" data-module-action="toast" data-text="已交内阁票拟">交内阁票拟</button><button type="button" data-module-action="clear-edict">清空草诏</button></div>';
    var right = '<h3>诏令参数</h3>' + miniRows([['类型','政务 / 军务 / 经济 / 司法 / 其他'],['主角行止','亲批、留中、召对、廷议'],['润色','明实录体 / 白话 / 严旨'],['后续','写入近事、史官实录、变量影响']]) +
      '<div class="tmf-module-stack"><button data-module-action="toast" data-text="已切换为经济诏令">经济</button><button data-module-action="toast" data-text="已切换为军务诏令">军务</button><button data-module-action="toast" data-text="已切换为其他诏令">其他</button></div>';
    return moduleShell('edict', '撰写诏书', '正式御案页：议事清册、草诏、类型、主角行止、润色与发布链', renderIssueListForEdict(), main, right);
  }

  function renderMemorialModule(){
    var mems = getMemorials();
    var selected = mems[0] || {};
    var left = '<h3>奏疏待览</h3><div class="tmf-module-scroll">' + (mems.length ? mems.map(function(x){
      return '<article class="tmf-module-item"><b>' + esc(x.title) + '</b><span>' + esc(x.from) + ' · ' + esc(x.dept) + ' · ' + esc(({pending:'待批',pending_review:'待覆核',approved:'已准',rejected:'已驳',referred:'已转',hold:'留中'}[x.status]||x.status)) + '</span></article>';
    }).join('') : '<p class="tmf-module-note">暂无待批奏疏。</p>') + '</div>';
    var main = '<h3>' + esc(selected.title || '暂无奏疏') + '</h3><div class="tmf-prose">' + esc(selected.text || '暂无正文。') + '</div>' +
      '<div class="tmf-module-actions"><button data-module-action="toast" data-text="已朱批准行">朱批准行</button><button data-module-action="toast" data-text="已留中">留中</button><button data-module-action="panel" data-slot="issue">转朝议</button></div>';
    var right = '<h3>批阅链路</h3>' + miniRows([['来源','奏疏 / 议题 / 近事'],['批复','准行、驳回、留中、转议'],['影响','变量、人物记忆、史官档案'],['待批', mems.length + ' 件']]);
    return moduleShell('memorial', '百官奏疏', '正式页内阅览、筛选、朱批与转议', left, main, right);
  }

  function renderLetterModule(){
    var people = getPeople().slice(0, 18);
    var letters = getLetters();
    var left = '<h3>收发簿</h3><div class="tmf-module-scroll">' + (letters.length ? letters.map(function(x){
      return '<article class="tmf-module-item"><b>' + esc(x.title) + '</b><span>' + esc(x.from) + ' → ' + esc(x.to) + ' · ' + esc(({pending:'待批',pending_review:'待覆核',unread:'未阅',sent:'已发',draft:'草稿'}[x.status]||x.status)) + '</span><p>' + esc(x.text || '') + '</p></article>';
    }).join('') : '<p class="tmf-module-note">暂无来信。可从右侧选择人物拟信。</p>') + '</div>';
    var main = '<h3>拟写书信</h3><div class="tmf-letter-editor"><input value="密谕" aria-label="书信题名"><textarea aria-label="书信正文">卿在外任，凡地方灾伤、军饷、民情，务须据实具奏，不得粉饰。</textarea></div>' +
      '<div class="tmf-module-actions"><button data-module-action="toast" data-text="已入鸿雁待发">入鸿雁待发</button><button data-module-action="toast" data-text="已存为草稿">存为草稿</button></div>';
    var right = '<h3>收信人</h3><div class="tmf-module-scroll compact">' + people.map(function(p){
      return '<button class="tmf-person-pick" data-module-action="select-person" data-id="' + esc(personKey(p)) + '"><b>' + esc(p.name || personKey(p)) + '</b><span>' + esc(p.office || p.title || p.faction || '') + '</span></button>';
    }).join('') + '</div>';
    return moduleShell('letter', '鸿雁传书', '正式页内收发、拟信、择人、草稿与驿路状态', left, main, right);
  }

  function renderRecordsModule(){
    var tab = state.recordTab || 'shiji';
    var tabs = [['shiji','史记'],['shilu','实录'],['jishi','纪事'],['biannian','编年']];
    var events = collectRecentEvents();
    var left = '<h3>史官实录</h3><div class="tmf-module-tabs">' + tabs.map(function(t){
      return '<button class="' + (tab === t[0] ? 'active' : '') + '" data-module-action="record-tab" data-tab="' + esc(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    var main = '<h3>' + esc((tabs.find(function(t){ return t[0] === tab; }) || tabs[0])[1]) + '</h3><div class="tmf-module-scroll records">' + (events.length ? events.map(function(x){
      return '<article class="tmf-record-row"><span>T' + esc(x.turn) + '</span><b>' + esc(x.title) + '</b><p>' + esc(x.text || x.time || '') + '</p></article>';
    }).join('') : '<p class="tmf-prose">暂无近事记录。</p>') + '</div>';
    var right = '<h3>自动来源</h3>' + miniRows([['御案时政','裁断入档'],['诏书','发布入档'],['奏疏','朱批入档'],['地图','地块事件入档']]);
    return moduleShell('records', '史官实录', '史记、实录、纪事、编年四类在正式页内切换', left, main, right);
  }

  function tmfRenwuText(v, fallback){
    if (v == null || v === '') return fallback == null ? '未记' : fallback;
    if (Array.isArray(v)) return v.map(function(x){ return tmfRenwuText(x, ''); }).filter(Boolean).join('、') || (fallback == null ? '未记' : fallback);
    if (typeof v === 'object') {
      if (v.text || v.name || v.title || v.desc || v.description) return tmfRenwuText(v.text || v.name || v.title || v.desc || v.description, fallback);
      var parts = [];
      Object.keys(v).forEach(function(k){
        var val = v[k];
        if (val == null || val === '' || typeof val === 'function') return;
        parts.push(tmfRenwuCn(k) + '：' + tmfRenwuText(val, '未记'));
      });
      return parts.join(' · ') || (fallback == null ? '未记' : fallback);
    }
    return tmfRenwuCn(String(v));
  }

  function tmfRenwuCn(v){
    var s = String(v == null ? '' : v);
    var exact = {
      male:'男', female:'女', man:'男', woman:'女',
      true:'是', false:'否', alive:'存世', dead:'已殁',
      court:'在朝', local:'在外', inner:'内廷', outer:'外朝',
      civil:'文臣', military:'武将', official:'官员', scholar:'士人',
      imperial:'皇族', noble:'世家', gentry:'士族', common:'寒门',
      publicPurse:'公库', publicCoffers:'公库', privateWealth:'私产',
      money:'银钱', grain:'粮米', cloth:'布帛', fame:'名望',
      fameValue:'名望', virtueMerit:'贤能', virtue:'贤德',
      health:'健康', stress:'压力', ambition:'野心', loyalty:'忠诚',
      administration:'政务', intelligence:'智谋', militaryAbility:'军务',
      charisma:'魅力', diplomacy:'外交', management:'管理',
      familyTier:'门第', clanPrestige:'族望', familyPrestige:'家望',
      spouseClan:'姻亲', fatherClan:'父族', motherClan:'母族',
      personalGoal:'个人志向', innerThought:'内心独白', stressSources:'压力来源',
      traitIds:'特质', traits:'特质', resources:'资源', relations:'关系',
      impressions:'印象', memories:'记忆', history:'履历', career:'仕途',
      works:'著述', culturalWorks:'文事作品', publicAssets:'公用资源'
    };
    if (exact[s] != null) return exact[s];
    return s
      .replace(/\bmale\b/g, '男').replace(/\bfemale\b/g, '女')
      .replace(/\balive\b/g, '存世').replace(/\bdead\b/g, '已殁')
      .replace(/\bcourt\b/g, '在朝').replace(/\blocal\b/g, '在外')
      .replace(/\binner\b/g, '内廷').replace(/\bouter\b/g, '外朝')
      .replace(/\bpublicPurse\b/g, '公库').replace(/\bpublicCoffers\b/g, '公库')
      .replace(/\bprivateWealth\b/g, '私产').replace(/\bfamilyTier\b/g, '门第')
      .replace(/\bimperial\b/g, '皇族').replace(/\bnoble\b/g, '世家')
      .replace(/\bgentry\b/g, '士族').replace(/\bcommon\b/g, '寒门');
  }

  function tmfRenwuArray(v){
    if (v == null || v === '') return [];
    return Array.isArray(v) ? v : [v];
  }

  function tmfRenwuField(p, keys, fallback){
    p = p || {};
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      if (p[k] != null && p[k] !== '') return p[k];
      if (p.stats && p.stats[k] != null && p.stats[k] !== '') return p.stats[k];
      if (p.abilities && p.abilities[k] != null && p.abilities[k] !== '') return p.abilities[k];
      if (p.attributes && p.attributes[k] != null && p.attributes[k] !== '') return p.attributes[k];
    }
    return fallback;
  }

  function tmfRenwuNum(p, keys, fallback){
    var raw = tmfRenwuField(p, keys, fallback);
    var n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }

  function tmfRenwuClamp(v){
    var n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function tmfRenwuShort(v, len){
    var s = tmfRenwuText(v, '');
    len = len || 78;
    return s.length > len ? s.slice(0, len - 1) + '…' : s;
  }

  function tmfRenwuFaction(p){
    return tmfRenwuText(tmfRenwuField(p, ['faction','force','realm','camp','party','group'], ''), '未归属');
  }

  function tmfRenwuGroup(p){
    var text = [
      p && p.group, p && p.role, p && p.office, p && p.title, p && p.faction, p && p.status, p && p.location
    ].map(function(x){ return tmfRenwuText(x, ''); }).join(' ');
    if (/皇|帝|宗室|后|妃|宫|王/.test(text)) return '宫禁';
    if (/宦|阉|太监|司礼|内臣|内廷/.test(text)) return '内廷';
    if (/军|将|督|帅|兵|边|卫|镇|营/.test(text)) return '军务';
    if (/户|钱|粮|财|税|漕|库/.test(text)) return '财赋';
    if (/阁|部|卿|御史|翰林|文|学|士|书院/.test(text)) return '文臣';
    if (/商|民|绅|流民|矿|盐|海/.test(text)) return '士民';
    return tmfRenwuText(p && (p.group || p.role), '朝野');
  }

  function tmfRenwuStatusTokens(p){
    var text = [
      p && p.status, p && p.location, p && p.group, p && p.office
    ].map(function(x){ return tmfRenwuText(x, ''); }).join(' ');
    var out = [];
    if (!p || p.alive !== false) out.push('alive');
    else out.push('dead');
    // 2026-05-21·下狱/流放/逃亡 优先 (覆盖位置类 token)
    if (p && (p._imprisoned || p.imprisoned)) out.push('imprison');
    if (p && (p._exiled || p.exiled)) out.push('exile');
    if (p && (p._fled || p._missing)) out.push('fled');
    if (/在朝|京|京师|宫|内阁|外朝|朝中/.test(text)) out.push('court');
    if (/地方|外任|边|辽|海|镇|督师|巡抚|总兵/.test(text)) out.push('local');
    if (/后宫|内廷|司礼|太监|内臣/.test(text)) out.push('inner');
    return out.join(' ');
  }

  function tmfRenwuStatusLabel(p){
    var tokens = tmfRenwuStatusTokens(p);
    if (tokens.indexOf('dead') >= 0) return '已殁';
    // 2026-05-21·入狱/流放/逃亡 状态优先于位置·体现真实困境
    if (tokens.indexOf('imprison') >= 0) {
      var _heldM = Math.max(0, ((window.GM && GM.turn) || 0) - ((p && p._imprisonedTurn) || 0));
      return '诏狱·' + _heldM + '月';
    }
    if (tokens.indexOf('exile') >= 0) return '流放';
    if (tokens.indexOf('fled') >= 0) return '逃亡';
    if (tokens.indexOf('inner') >= 0) return '内廷';
    if (tokens.indexOf('court') >= 0) return '在朝';
    if (tokens.indexOf('local') >= 0) return '在外';
    return tmfRenwuText(p && p.status, '存世');
  }

  function tmfRenwuPortrait(p){
    var src = tmfRenwuField(p, ['portrait','avatar','image','img','photo','fullBody','halfBody','characterImage','illustration','standingArt','cardPortrait'], '');
    if (src) {
      src = String(src);
      if (/^(https?:|data:|\/|preview\/|assets\/)/.test(src)) return src;
      if (src.indexOf('img/') === 0) return 'preview/' + src;
      if (src.indexOf('portraits/') === 0) return 'preview/img/' + src;
      return src;
    }
    var text = [
      p && p.name, p && p.gender, p && p.role, p && p.office, p && p.title, p && p.group, p && p.faction
    ].map(function(x){ return tmfRenwuText(x, ''); }).join(' ');
    if (/皇帝|天子|帝|朱由校|朱由检/.test(text)) return asset('portraits/ming-emperor-ai.png');
    if (/后|妃|嫔|夫人|女|客氏/.test(text)) return asset('portraits/ming-empress-ai.png');
    if (/宦|阉|太监|司礼|魏忠贤|内臣/.test(text)) return asset('portraits/ming-eunuch-ai.png');
    if (/将|军|帅|总兵|督师|辽东|边|镇|毛文龙|袁崇焕/.test(text)) return asset('portraits/ming-general-ai.png');
    if (/儒|士|书院|讲官|翰林|学/.test(text)) return asset('portraits/ming-scholar-ai.png');
    return asset('portraits/ming-civil-ai.png');
  }

  function tmfRenwuTone(p){
    var key = tmfRenwuFaction(p) + ' ' + tmfRenwuGroup(p);
    if (/后金|满|清|建州|女真/.test(key)) return { color:'#7eb8a7', rgb:'126,184,167' };
    if (/阉|宦|内廷|魏/.test(key)) return { color:'#b64d3c', rgb:'182,77,60' };
    if (/军|辽|边|镇|海/.test(key)) return { color:'#c28f4f', rgb:'194,143,79' };
    if (/东林|书院|士|文/.test(key)) return { color:'#d4be7a', rgb:'212,190,122' };
    if (/商|民|流|矿|盐/.test(key)) return { color:'#8fae72', rgb:'143,174,114' };
    return { color:'#b89a53', rgb:'184,154,83' };
  }

  function tmfRenwuStyle(p){
    var tone = tmfRenwuTone(p || {});
    return '--rw-color:' + tone.color + ';--rw-rgb:' + tone.rgb + ';';
  }

  function tmfRenwuFilterText(p){
    return [
      p && p.name, p && p.courtesy, p && p.office, p && p.title, p && p.role,
      p && p.faction, p && p.group, p && p.location, p && p.status, p && p.bio,
      p && p.description, p && p.innerThought
    ].map(function(x){ return tmfRenwuText(x, ''); }).join(' ').toLowerCase();
  }

  function tmfRenwuOptionValues(people, getter){
    var seen = {};
    var out = [];
    people.forEach(function(p){
      var v = tmfRenwuText(getter(p), '');
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out.slice(0, 20);
  }

  function tmfRenwuRelations(p, people){
    var rows = [];
    var raw = p && (p.relations || p.relationships || p.impressions || p.guanxi);
    function resolveName(id){
      var hit = people.find(function(x){ return personKey(x) === String(id) || x.name === String(id); });
      return hit ? (hit.name || personKey(hit)) : String(id || '未详');
    }
    function add(id, label, score){
      id = String(id || '').trim();
      if (!id) return;
      rows.push({
        id: id,
        name: resolveName(id),
        label: tmfRenwuText(label, '关系'),
        score: score == null || score === '' ? '—' : score
      });
    }
    if (Array.isArray(raw)) {
      raw.forEach(function(x){
        if (Array.isArray(x)) add(x[0], x[1], x[2]);
        else if (x && typeof x === 'object') add(x.id || x.target || x.name || x.with || x.to || x.person, x.label || x.type || x.relation || x.kind, x.score || x.value || x.affinity || x.trust);
        else if (x) add(x, '关联', '');
      });
    } else if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(function(k){
        var v = raw[k];
        if (v && typeof v === 'object') add(k, v.label || v.type || v.relation || '关系', v.score || v.value || v.affinity || v.trust);
        else add(k, typeof v === 'string' ? v : '关系', typeof v === 'number' ? v : '');
      });
    }
    if (p && p._impressions && typeof p._impressions === 'object') {
      Object.keys(p._impressions).forEach(function(k){
        if (k === '玩家') return;
        var v = p._impressions[k] || {};
        var favor = Number(v.favor || v.score || v.value || 0);
        if (!Number.isFinite(favor) || Math.abs(favor) < 3) return;
        var label = favor >= 15 ? '感恩深厚' : (favor >= 5 ? '有好感' : (favor <= -15 ? '深怀恨意' : (favor <= -5 ? '心存不满' : '寻常')));
        add(k, label, (favor > 0 ? '+' : '') + favor);
      });
    }
    if (!rows.length) {
      var f = tmfRenwuFaction(p);
      people.filter(function(x){ return personKey(x) !== personKey(p) && tmfRenwuFaction(x) === f; }).slice(0, 5).forEach(function(x){
        add(personKey(x), '同属' + f, 0);
      });
    }
    return rows.slice(0, 10);
  }

  function tmfRenwuClassRelationEdges(p){
    var gm = window.GM || {};
    var key = personKey(p || {});
    var name = p && p.name || key;
    var seen = {};
    var out = [];
    function same(a, b){
      return String(a || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase() ===
        String(b || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase();
    }
    function add(edge){
      if (!edge) return;
      if (!same(edge.characterId || edge.characterName, key || name) && !same(edge.characterName, name)) return;
      var sig = String(edge.className || '') + '|' + String(edge.role || '');
      if (!sig || seen[sig]) return;
      seen[sig] = true;
      out.push(edge);
    }
    tmfRenwuArray(p && p.classBackings).forEach(add);
    var raw = gm.classCharacterRelations && gm.classCharacterRelations.edges || {};
    if (Array.isArray(raw)) raw.forEach(add);
    else Object.keys(raw).forEach(function(k){ add(raw[k]); });
    return out.sort(function(a, b){
      function score(e){
        return (Number(e && e.affinity) || 0) + (Number(e && e.legitimacy) || 0) + (Number(e && e.trust) || 0) - (Number(e && e.grievance) || 0) * 0.75;
      }
      return score(b) - score(a);
    }).slice(0, 8);
  }

  function tmfRenwuClassRole(role){
    role = String(role || '').toLowerCase();
    if (role === 'patron') return '庇护';
    if (role === 'broker') return '调停';
    if (role === 'suppressor') return '压制';
    if (role === 'symbol') return '象征';
    if (role === 'debtor') return '亏欠';
    if (role === 'enemy') return '仇怨';
    return '代表';
  }

  function tmfRenwuClassPct(v){
    var n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) <= 1) n *= 100;
    return Math.round(Math.max(0, Math.min(100, n)));
  }

  function tmfRenwuClassRelationList(edges, emptyText){
    edges = tmfRenwuArray(edges).filter(Boolean);
    if (!edges.length) return '<div class="renwu-prose">' + esc(emptyText || '暂无阶层关系。') + '</div>';
    return '<div class="renwu-list renwu-class-relations">' + edges.map(function(e){
      var reason = tmfRenwuArray(e.evidence).slice(-2).map(function(x){ return tmfRenwuText(x, ''); }).filter(Boolean).join(' · ') || e.reason || e.source || '';
      return '<div class="renwu-list-row renwu-class-relation-row"><span>' + esc(e.className || '未名阶层') + '</span><b>' +
        esc(tmfRenwuClassRole(e.role)) + ' · 亲' + esc(tmfRenwuClassPct(e.affinity)) + ' 信' + esc(tmfRenwuClassPct(e.trust)) + ' 怨' + esc(tmfRenwuClassPct(e.grievance)) +
        (reason ? '<small title="' + attr(reason) + '">近因：' + esc(tmfRenwuShort(reason, 68)) + '</small>' : '') +
      '</b></div>';
    }).join('') + '</div>';
  }

  function tmfRenwuMemories(p){
    var out = [];
    function add(x){
      if (x == null || x === '') return;
      if (Array.isArray(x)) { x.forEach(add); return; }
      if (typeof x === 'object') {
        out.push(tmfRenwuText(x.text || x.detail || x.title || x.reason || x.memory || x.event || x, ''));
      } else {
        out.push(String(x));
      }
    }
    add(p && (p.memories || p.memory || p.memoryAnchors || p.experiences || p.history));
    var gm = window.GM || {};
    var k = personKey(p || {});
    if (gm.characterMemories && k) add(gm.characterMemories[k] || gm.characterMemories[p && p.name]);
    if (Array.isArray(gm._memoryArchiveFull) && p && p.name) {
      gm._memoryArchiveFull.forEach(function(m){
        if (!m) return;
        if (m.char && m.char !== p.name) return;
        add(m);
      });
    }
    add(p && (p._memory || p._experienceLog || p._scars));
    if (!out.length && p && p.innerThought) out.push(p.innerThought);
    return out.filter(Boolean);
  }

  function tmfRenwuListRows(rows){
    return '<div class="renwu-list">' + rows.map(function(r){
      return '<div class="renwu-list-row"><span>' + esc(r[0]) + '</span><b>' + esc(tmfRenwuText(r[1], '未记')) + '</b></div>';
    }).join('') + '</div>';
  }

  function tmfRenwuAbilityBars(p){
    var defs = [
      ['智', ['智','intelligence','wisdom','smart']],
      ['政', ['政','administration','politics','governance']],
      ['武', ['武','military','martial','war']],
      ['人', ['人','charisma','charm','diplomacy']],
      ['工', ['工','management','craft','logistics']],
      ['仁', ['仁','virtue','benevolence','morality']],
      ['野', ['野','ambition']],
      ['压', ['压','stress','pressure']]
    ];
    return '<div class="renwu-ability-grid">' + defs.map(function(d){
      var v = tmfRenwuNum(p, d[1], '—');
      return '<div class="renwu-ability"><span class="k">' + esc(d[0]) + '</span><span class="bar"><span class="fill" style="width:' + tmfRenwuClamp(v) + '%"></span></span><span class="v">' + esc(v) + '</span></div>';
    }).join('') + '</div>';
  }

  function tmfRenwuWuchangValue(p, key){
    var source = (p && (p.wuchangOverride || p.wuchang || p.fiveConstants || p.morals)) || {};
    var aliases = {
      '仁': ['仁','ren','benevolence','compassion'],
      '义': ['义','yi','righteousness','justice'],
      '礼': ['礼','li','ritual','propriety'],
      '智': ['智','zhi','wisdom','intelligence'],
      '信': ['信','xin','trust','faith']
    }[key] || [key];
    for (var i = 0; i < aliases.length; i += 1) {
      if (source[aliases[i]] != null && source[aliases[i]] !== '') return source[aliases[i]];
      if (p && p[aliases[i]] != null && p[aliases[i]] !== '') return p[aliases[i]];
      if (p && p.stats && p.stats[aliases[i]] != null && p.stats[aliases[i]] !== '') return p.stats[aliases[i]];
    }
    return '—';
  }

  function tmfRenwuWuchangHtml(p, compact){
    var keys = ['仁','义','礼','智','信'];
    return '<div class="' + (compact ? 'renwu-wuchang compact' : 'renwu-wuchang') + '">' + keys.map(function(k){
      var v = tmfRenwuWuchangValue(p, k);
      var n = Number(v);
      var cls = Number.isFinite(n) ? (n >= 70 ? 'hi' : (n >= 45 ? 'mid' : 'lo')) : '';
      return '<span class="' + cls + '" title="' + esc(k + ' ' + tmfRenwuText(v, '未记')) + '"><b>' + esc(k) + '</b><i>' + esc(v) + '</i></span>';
    }).join('') + '</div>';
  }

  function tmfRenwuSourceNotes(p){
    var raw = tmfRenwuArray(p && (p.sourceNotes || p.sources || p.historicalSources || p.notes || p.commentary));
    return raw.map(function(x){ return tmfRenwuText(x, ''); }).filter(Boolean);
  }

  function tmfRenwuSideMetric(label, value){
    return '<div class="renwu-side-metric"><span>' + esc(label) + '</span><b>' + esc(tmfRenwuText(value, '未记')) + '</b></div>';
  }

  function tmfRenwuResourceLines(p){
    var rows = [];
    var labels = {
      publicPurse: '公库',
      publicAssets: '公产',
      privateWealth: '私产',
      wealth: '私产',
      militaryPower: '兵权',
      army: '军队',
      clients: '门生',
      network: '人脉',
      silver: '银',
      grain: '粮',
      food: '粮',
      troops: '兵',
      influence: '声望',
      reputation: '声望'
    };
    function compact(value){
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).map(function(k){
          return (labels[k] || tmfRenwuCn(k)) + ':' + tmfRenwuText(value[k], '未记');
        }).join(' · ');
      }
      return tmfRenwuText(value, '');
    }
    function push(label, value){
      value = compact(value);
      if (value) rows.push([label, value]);
    }
    push('公库', p && (p.publicPurse || p.publicAssets));
    push('私产', p && (p.privateWealth || p.wealth));
    if (p && p.resources && typeof p.resources === 'object' && !Array.isArray(p.resources)) {
      push('公库', p.resources.publicPurse || p.resources.publicCoffers || p.resources.publicAssets);
      push('私产', p.resources.privateWealth || p.resources.wealth);
      push('名望', p.resources.fame != null ? p.resources.fame : p.resources.fameValue);
      push('贤能', p.resources.virtueMerit != null ? p.resources.virtueMerit : p.resources.virtue);
      push('健康', p.resources.health);
      push('压力', p.resources.stress);
    }
    push('兵权', p && (p.militaryPower || p.army));
    push('门生', p && (p.clients || p.network));
    tmfRenwuArray(p && (p.resources || p.resource)).slice(0, 5).forEach(function(x){
      if (Array.isArray(x)) push(tmfRenwuText(x[0], '资源'), x.slice(1).join(' · '));
      else if (x && typeof x === 'object') push(tmfRenwuText(x.name || x.type || x.title, '资源'), x.value || x.desc || x.detail || x.text || x);
      else push('资源', x);
    });
    return rows;
  }

  function tmfRenwuOpenFullButton(p, key){
    return '<button type="button" data-module-action="renwu-person-action" data-person-action="detail" data-id="' + attr(key || personKey(p)) + '">完整人物志<span>打开旧完整人物志，查看六页签全量档案</span></button>';
  }

  function tmfRenwuMetricValue(p, key, fallback){
    var res = (p && p.resources) || {};
    var map = {
      fame: p && (p.fame != null ? p.fame : (p.reputation != null ? p.reputation : (res.fame != null ? res.fame : res.fameValue))),
      virtue: p && (p.virtue != null ? p.virtue : (p.morality != null ? p.morality : (res.virtueMerit != null ? res.virtueMerit : res.virtue))),
      health: p && (p.health != null ? p.health : res.health),
      stress: p && (p.stress != null ? p.stress : res.stress)
    };
    return map[key] != null && map[key] !== '' ? map[key] : fallback;
  }

  function tmfRenwuExtraRows(p){
    return [
      ['职事', p.officeDuties || p.duties || '未记'],
      ['兼衔', p.concurrentTitle || '未记'],
      ['上司', p.superior || '未记'],
      ['师承', p.mentor || '未记'],
      ['好友', p.friends || '未记'],
      ['爱好', p.hobbies || '未记'],
      ['立场', p.stance || p.position || '未记'],
      ['辞令', p.diction || '未记'],
      ['与君主', p.playerRelation || '未记'],
      ['个人志向', p.personalGoal || p.goal || '未记']
    ];
  }

  function tmfRenwuArcHtml(p){
    var gm = window.GM || {};
    var arc = p && p.name && gm._charArcs ? gm._charArcs[p.name] : null;
    if (!arc) return '';
    return '<section class="renwu-sec"><div class="renwu-sec-title">情节弧</div>' + tmfRenwuListRows([
      ['当前境', arc.arcStage || '未记'],
      ['情绪', arc.emotionalState || '未记'],
      ['动机', arc.motivation || '未记'],
      ['潜动向', arc.nextCue || '未记'],
      ['进度', arc.arcProgress != null ? arc.arcProgress + '%' : '未记']
    ]) + '</section>';
  }

  function tmfRenwuExperienceHtml(p){
    var exp = p && (p._experience || p.exp);
    var recent = p && (p._experienceLog || (exp && exp.recent));
    if (!exp && !recent) return '';
    var rows = [];
    if (exp && typeof exp === 'object') {
      Object.keys(exp).forEach(function(k){
        if (k === 'recent') return;
        if (typeof exp[k] === 'number') rows.push([tmfRenwuCn(k), exp[k]]);
      });
    }
    return '<section class="renwu-sec"><div class="renwu-sec-title">人生历练</div>' +
      (rows.length ? tmfRenwuListRows(rows.slice(0, 8)) : '') +
      '<div class="renwu-source-list">' + (tmfRenwuArray(recent).slice(-5).map(function(x){ return '<p>' + esc(tmfRenwuText(x, '')) + '</p>'; }).join('') || '<p>暂无近期历练。</p>') + '</div></section>';
  }

  function tmfRenwuCareerCompatHtml(p){
    var html = '';
    if (p && p.name && typeof window._offRenderCareerHTML === 'function') {
      try {
        var career = window._offRenderCareerHTML(p.name);
        if (career) html += '<section class="renwu-sec"><div class="renwu-sec-title">官制仕途</div><div class="renwu-legacy-html">' + career + '</div></section>';
      } catch(_) {}
    }
    var faceText = '';
    try {
      if (typeof window.FaceSystem !== 'undefined' && p && p._face !== undefined && typeof FaceSystem.getFaceText === 'function') {
        faceText = FaceSystem.getFaceText(p);
      }
    } catch(_) {}
    if (p && (p._face !== undefined || p.personalGoal || p._goalSatisfaction !== undefined || faceText)) {
      html += '<section class="renwu-sec"><div class="renwu-sec-title">颜面与志向</div>' + tmfRenwuListRows([
        ['颜面', p._face !== undefined ? p._face : '未记'],
        ['颜面评语', faceText || '未记'],
        ['个人志向', p.personalGoal || p.goal || '未记'],
        ['满足度', p._goalSatisfaction !== undefined ? Math.round(p._goalSatisfaction) + '%' : '未记']
      ]) + '</section>';
    }
    return html;
  }

  function tmfRenwuIndexTags(p, people){
    var tags = [tmfRenwuFaction(p), tmfRenwuGroup(p), tmfRenwuStatusLabel(p), p && p.location, p && (p.rank || p.role), p && (p.family || p.clan)].filter(Boolean);
    var relCount = tmfRenwuRelations(p, people).length;
    var memCount = tmfRenwuMemories(p).length;
    tags.push('关系' + relCount);
    tags.push('记忆' + memCount);
    return tags.filter(function(t, i, arr){ return arr.indexOf(t) === i; }).slice(0, 10);
  }

  function tmfRenwuCard(p, selectedKey){
    var key = personKey(p);
    var stats = [
      ['智', tmfRenwuNum(p, ['智','intelligence','wisdom'], '—')],
      ['政', tmfRenwuNum(p, ['政','administration','politics'], '—')],
      ['武', tmfRenwuNum(p, ['武','military','martial'], '—')]
    ];
    var tags = [tmfRenwuFaction(p), tmfRenwuGroup(p), tmfRenwuStatusLabel(p)].filter(Boolean);
    return '<button type="button" class="renwu-card ' + (key === selectedKey ? 'active ' : '') + (isPinned(key) ? 'pinned' : '') + '" style="' + tmfRenwuStyle(p) + '" data-renwu-card="1" data-module-action="select-person" data-id="' + attr(key) + '" data-filter-text="' + attr(tmfRenwuFilterText(p)) + '" data-group="' + attr(tmfRenwuGroup(p)) + '" data-faction="' + attr(tmfRenwuFaction(p)) + '" data-status="' + attr(tmfRenwuStatusTokens(p)) + '">' +
      '<img class="renwu-thumb" src="' + attr(tmfRenwuPortrait(p)) + '" alt="">' +
      '<span class="renwu-card-main">' +
        '<span class="renwu-card-name">' + esc(p.name || key || '未名') + '</span>' +
        '<span class="renwu-card-meta">' + esc(tmfRenwuShort(tmfRenwuText(p.office || p.title || p.role, '未仕') + ' · ' + tmfRenwuFaction(p), 34)) + '</span>' +
        '<span class="renwu-card-tags">' + tags.map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('') + '</span>' +
        '<span class="renwu-card-bars">' + stats.map(function(s){ return '<span class="renwu-card-bar"><span>' + esc(s[0]) + '</span><i style="--v:' + tmfRenwuClamp(s[1]) + '%"></i></span>'; }).join('') + '</span>' +
        tmfRenwuWuchangHtml(p, true) +
      '</span>' +
      '<span class="renwu-loyalty"><b>' + esc(tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')) + '</b><small>忠</small></span>' +
    '</button>';
  }

  function renwuYield(fn){
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: 80 });
      return;
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fn);
      return;
    }
    setTimeout(fn, 16);
  }

  function appendRenwuCardsChunked(root, people, selectedKey){
    var list = renwuRosterList(root);
    if (!list) return false;
    people = Array.isArray(people) ? people : [];
    var token = ++_renwuRenderBatchToken;
    var idx = 0;
    function build(limit){
      var html = '';
      var end = Math.min(people.length, idx + limit);
      while (idx < end) {
        html += tmfRenwuCard(people[idx], selectedKey);
        idx++;
      }
      return html;
    }
    list.innerHTML = people.length ? build(RENWU_INITIAL_RENDER_LIMIT) : '<p class="renwu-prose">暂无人物数据。</p>';
    function pump(){
      if (token !== _renwuRenderBatchToken) return;
      var html = build(RENWU_RENDER_BATCH_SIZE);
      if (html) {
        list.insertAdjacentHTML('beforeend', html);
        filterRenwuOverlay(root, { preserveScroll: true });
      }
      if (idx < people.length) renwuYield(pump);
    }
    if (idx < people.length) renwuYield(pump);
    return true;
  }

  function scheduleRenwuFilter(root, delay){
    if (_renwuFilterTimer) clearTimeout(_renwuFilterTimer);
    _renwuFilterTimer = setTimeout(function(){
      _renwuFilterTimer = 0;
      filterRenwuOverlay(root);
    }, delay == null ? 120 : delay);
  }

  function tmfRenwuIsPlayer(p){
    var key = personKey(p || {});
    var name = String((p && p.name) || '');
    return key === 'player' || key === 'emperor' || /皇帝|帝王|天子/.test(String(p && (p.role || p.office || p.rank) || '') + name);
  }

  function tmfRenwuInCapital(p){
    return /京|宫|朝|内廷|在朝|在京/.test(String(p && (p.location || '') || '') + String(p && (p.status || '') || '') + String(p && (p.group || '') || '') + String(p && (p.office || '') || ''));
  }

  function tmfRenwuProfileHead(p, key){
    var isSelf = tmfRenwuIsPlayer(p);
    var inCapital = tmfRenwuInCapital(p);
    var primary = isSelf ? ['mind', '御览心志'] : (inCapital ? ['wendui', '召入问对'] : ['letter', '鸿雁传书']);
    var actionAttr = primary[0] === 'mind'
      ? 'data-module-action="renwu-tab" data-tab="mind"'
      : 'data-module-action="renwu-person-action" data-person-action="' + attr(primary[0]) + '" data-id="' + attr(key) + '"';
    var judgement = tmfRenwuText(p.innerThought || p.bio || p.description || p.desc || p.goal, '暂无人物判断。');
    var age = tmfRenwuText(p.age ? (p.age + '岁') : '', '年龄未详');
    var office = tmfRenwuText(p.office || p.title || p.role, '未仕');
    return '<section class="renwu-profile-head" style="' + tmfRenwuStyle(p) + '">' +
      '<div class="renwu-portrait-frame"><img class="renwu-portrait-large" src="' + attr(tmfRenwuPortrait(p)) + '" alt=""></div>' +
      '<div class="renwu-profile-title">' +
        '<h3>' + esc(p.name || key || '暂无人物') + '</h3>' +
        '<div class="courtesy">' + esc(tmfRenwuText(p.courtesy || p.zi || p.styleName, '未录字号')) + ' · ' + esc(age) + '</div>' +
        '<div class="office"><span class="renwu-pill faction">' + esc(tmfRenwuFaction(p)) + '</span><span class="renwu-pill">' + esc(tmfRenwuGroup(p)) + '</span><span class="renwu-pill">' + esc(tmfRenwuStatusLabel(p)) + '</span><span class="renwu-pill">' + esc(office) + '</span></div>' +
        '<div class="renwu-heart-grid">' +
          [['忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')], ['野心', tmfRenwuNum(p, ['ambition','野'], '—')], ['压力', tmfRenwuMetricValue(p, 'stress', tmfRenwuNum(p, ['stress','压'], '—'))], ['康健', tmfRenwuMetricValue(p, 'health', tmfRenwuNum(p, ['health','健康'], '—'))]].map(function(x){
            return '<div class="renwu-heart"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>';
          }).join('') +
        '</div>' +
        '<div class="renwu-action-row"><button type="button" class="primary" ' + actionAttr + '>' + esc(primary[1]) + '</button><button type="button" data-module-action="renwu-person-action" data-person-action="detail" data-id="' + attr(key) + '">完整人物志</button><button type="button" data-module-action="renwu-person-action" data-person-action="letter" data-id="' + attr(key) + '"' + (isSelf ? ' disabled' : '') + '>鸿雁传书</button><button type="button" data-module-action="renwu-person-action" data-person-action="office" data-id="' + attr(key) + '">官制任免</button><button type="button" data-module-action="pin-person" data-id="' + attr(key) + '">钉选</button></div>' +
        '<div class="renwu-verdict"><b>人物判断</b><p>' + esc(tmfRenwuShort(judgement, 180)) + '</p></div>' +
      '</div>' +
    '</section>';
  }

  function tmfRenwuWorks(p){
    return tmfRenwuArray(p && (p.works || p.writings || p.memorials || p.documents || p.zoushu)).map(function(x){
      if (x && typeof x === 'object') return x;
      return { title: tmfRenwuText(x, '著述'), type: '记录', excerpt: tmfRenwuText(x, '') };
    });
  }

  function tmfRenwuWorkCards(p){
    var works = tmfRenwuWorks(p);
    return works.length ? works.slice(0, 8).map(function(w){
      return '<div class="renwu-work-card"><b>' + esc(tmfRenwuText(w.title || w.name, '未题')) + ' · ' + esc(tmfRenwuText(w.type || w.kind, '著述')) + '</b><span>' + esc(tmfRenwuText(w.turn || w.time || w.date, '未署')) + ' · ' + esc(tmfRenwuText(w.excerpt || w.summary || w.text || w.detail, '暂无摘录')) + '</span></div>';
    }).join('') : '<div class="renwu-prose">暂无著述奏疏。</div>';
  }

  function tmfRenwuEvents(p){
    var events = p && (p.events || p.career || p.history || []);
    return Array.isArray(events) ? events : [];
  }

  function tmfRenwuTimeline(events){
    return '<div class="renwu-timeline">' + (Array.isArray(events) && events.length ? events.slice(0, 16).map(function(x){
      var turn = Array.isArray(x) ? x[0] : (x.turn || x.time || x.year || '记');
      var text = Array.isArray(x) ? x[1] : (x.text || x.event || x.title || x);
      return '<div class="renwu-event"><span class="turn">' + esc(turn) + '</span><span class="event">' + esc(tmfRenwuText(text, '')) + '</span></div>';
    }).join('') : '<div class="renwu-prose">暂无履历节点。</div>') + '</div>';
  }

  function tmfRenwuFamilyTreeHtml(p){
    var family = tmfRenwuText(p.family || p.clan, '未录家族');
    var father = tmfRenwuText(p.father || p.fatherName || p.fatherClan, '父族未详');
    var mother = tmfRenwuText(p.mother || p.motherName || p.motherClan, '母族未详');
    var spouse = tmfRenwuText(p.spouse || p.spouseClan, '姻亲未详');
    var children = tmfRenwuArray(p.children).map(function(x){ return tmfRenwuText((x && typeof x === 'object') ? (x.name || x.relation || x) : x, '子嗣'); }).slice(0, 4);
    return '<div class="renwu-family-tree">' +
      '<div class="renwu-family-row"><div class="renwu-family-node">' + esc(father) + '</div><div class="renwu-family-node">' + esc(mother) + '</div></div>' +
      '<div class="renwu-family-line"></div><div class="renwu-family-row"><div class="renwu-family-node self">' + esc(p.name || family) + '</div><div class="renwu-family-node">' + esc(spouse) + '</div></div>' +
      '<div class="renwu-family-line"></div><div class="renwu-family-row">' + (children.length ? children.map(function(c){ return '<div class="renwu-family-node">' + esc(c) + '</div>'; }).join('') : '<div class="renwu-family-node">暂无子嗣记录</div>') + '</div>' +
    '</div>';
  }

  function tmfRenwuDetailTab(p, people){
    var tab = state.renwuTab || 'overview';
    var memories = tmfRenwuMemories(p);
    var relations = tmfRenwuRelations(p, people);
    if (tab === 'mind') {
      var stressSources = tmfRenwuArray(p.stressSources || p.pressureSources);
      var notesMind = tmfRenwuSourceNotes(p);
      return '<div class="renwu-panel active"><div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">当前心绪</div><div class="renwu-prose">心境：' + esc(tmfRenwuText(p.mood || p.state || '未记', '未记')) + '<br><br>' + esc(tmfRenwuText(p.innerThought || p.goal, '暂无心绪记录。')) + '</div></section>' +
        '<section class="renwu-sec"><div class="renwu-sec-title">压力来源</div>' + tmfRenwuListRows(stressSources.length ? stressSources.map(function(x){ return ['来源', x]; }) : [['来源', '暂无明确记录']]) + '</section>' +
        '</div>' +
        tmfRenwuArcHtml(p) +
        tmfRenwuExperienceHtml(p) +
        '<section class="renwu-sec"><div class="renwu-sec-title">五常心性</div>' + tmfRenwuWuchangHtml(p, false) + '</section>' +
        '<section class="renwu-sec"><div class="renwu-sec-title">记忆模块</div><details class="renwu-memory" open><summary>完整记忆 · ' + memories.length + ' 条</summary>' + (memories.length ? memories.map(function(m, i){ return '<p><b>' + (i + 1) + '</b>' + esc(tmfRenwuText(m, '')) + '</p>'; }).join('') : '<p>暂无记忆记录。</p>') + '</details></section>' +
        '<section class="renwu-sec"><div class="renwu-sec-title">史料/旁注</div><div class="renwu-source-list">' + (notesMind.length ? notesMind.slice(0, 8).map(function(x){ return '<p>' + esc(x) + '</p>'; }).join('') : '<p>暂无史料旁注。</p>') + '</div></section></div>';
    }
    if (tab === 'relations') {
      var classEdges = tmfRenwuClassRelationEdges(p);
      var classBackings = classEdges.filter(function(e){ return !/suppressor|enemy/i.test(String(e.role || '')) && (Number(e.grievance) || 0) < 0.45; });
      var classGrudges = classEdges.filter(function(e){ return /suppressor|enemy/i.test(String(e.role || '')) || (Number(e.grievance) || 0) >= 0.45; });
      return '<div class="renwu-panel active"><div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">对玩家态度</div>' + tmfRenwuListRows([
        ['忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')],
        ['怨望', Math.max(0, 100 - Number(tmfRenwuNum(p, ['loyalty','loyal','忠'], 50)))],
        ['党派', tmfRenwuFaction(p)],
        ['关键判断', Number(tmfRenwuNum(p, ['loyalty','loyal','忠'], 50)) >= 70 ? '可托付' : (Number(tmfRenwuNum(p, ['loyalty','loyal','忠'], 50)) >= 45 ? '可接触' : '需防范')]
      ]) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">立场</div>' + tmfRenwuListRows([['所属', tmfRenwuFaction(p)], ['派系/身份', tmfRenwuGroup(p)], ['立场', p.stance || p.position || '未记'], ['党派', p.party || '未记']]) + '</section></div>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">关系网络</div><div class="renwu-rel-list">' + (relations.length ? relations.map(function(r){
        return '<button type="button" data-module-action="select-person" data-id="' + attr(r.id) + '"><span>' + esc(r.label) + '</span><b>' + esc(r.name) + '</b><i>' + esc(r.score) + '</i></button>';
      }).join('') : '<p class="renwu-prose">暂无显性关系。</p>') + '</div></section>' +
      '<div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">阶层背书</div>' + tmfRenwuClassRelationList(classBackings, '暂无明确阶层背书。') + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">阶层怨望</div>' + tmfRenwuClassRelationList(classGrudges, '暂无明显阶层怨望。') + '</section></div>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">血亲与旧属</div><div class="renwu-list">' + (tmfRenwuArray(p.familyMembers || p.relatives || p.oldFollowers).length ? tmfRenwuArray(p.familyMembers || p.relatives || p.oldFollowers).map(function(m){
        return '<div class="renwu-list-row"><span>' + esc(tmfRenwuText(m.relation || m.type, '关系')) + '</span><b>' + esc(tmfRenwuText(m.name || m, '未名')) + '</b></div>';
      }).join('') : '<div class="renwu-prose">暂无血亲旧属。</div>') + '</div></section></div>';
    }
    if (tab === 'career') {
      var events = tmfRenwuEvents(p);
      return '<div class="renwu-panel active"><div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">仕途面板</div>' + tmfRenwuListRows([
        ['现职', p.office || p.title || '未仕'],
        ['品秩', p.rank || '未记'],
        ['入仕节点', p.joinTurn || p.entry || '未详'],
        ['可任方向', tmfRenwuText((p.role || '未记') + ' · ' + (p.stance || p.position || tmfRenwuFaction(p)), '未记')],
        ['所在', p.location || p.status || '未记'],
        ['风险', Number(tmfRenwuNum(p, ['ambition','野'], 0)) >= 70 ? '求进太急' : (Number(tmfRenwuNum(p, ['stress','压'], 0)) >= 60 ? '压力较高' : '暂无急险')]
      ]) + '</section><section class="renwu-sec"><div class="renwu-sec-title">著述奏疏</div>' + tmfRenwuWorkCards(p) + '</section></div>' +
      tmfRenwuCareerCompatHtml(p) +
      '<section class="renwu-sec"><div class="renwu-sec-title">履历与事件</div>' + tmfRenwuTimeline(events) + '</section></div>';
    }
    if (tab === 'identity') {
      var idRows = [['姓名', p.name || '未名'], ['字/号', p.courtesy || p.zi || p.styleName || '未记'], ['性别', p.gender || (p.isFemale ? 'female' : '') || '未记'], ['年龄', p.age || '未记'], ['籍贯', p.birthplace || p.hometown || p.origin || '未记'], ['族属', p.ethnicity || p.clan || p.family || '未记'], ['信仰', p.faith || '未记'], ['文化', p.culture || p.learning || '未记'], ['声望', tmfRenwuMetricValue(p, 'fame', '未记')], ['贤德', tmfRenwuMetricValue(p, 'virtue', '未记')]];
      return '<div class="renwu-panel active"><section class="renwu-sec"><div class="renwu-sec-title">身份档案</div><div class="renwu-id-grid">' + idRows.map(function(r){ return '<div class="renwu-id-cell"><span>' + esc(r[0]) + '</span><b>' + esc(tmfRenwuText(r[1], '未记')) + '</b></div>'; }).join('') + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">公开身份</div>' + tmfRenwuListRows([
        ['官职', p.office || p.title || '未仕'],
        ['品秩', p.rank || '未记'],
        ['所属', tmfRenwuFaction(p)],
        ['门类', tmfRenwuGroup(p)],
        ['位置', p.location || '未记'],
        ['状态', tmfRenwuStatusLabel(p)]
      ]) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">公私身份对照</div>' + tmfRenwuListRows(tmfRenwuExtraRows(p)) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">形貌与传略</div><div class="renwu-prose">' + esc(tmfRenwuText(p.appearance || '', '暂无形貌记录。')) + '\n\n' + esc(tmfRenwuText(p.bio || p.description || p.desc || '', '暂无传略。')) + '</div></section></div>';
    }
    if (tab === 'family') {
      var familyMembers = tmfRenwuArray(p.familyMembers || p.relatives || p.familyTree);
      var children = tmfRenwuArray(p.children).map(function(x){ return typeof x === 'object' ? x : { name: x, relation: '子女' }; });
      return '<div class="renwu-panel active"><section class="renwu-sec"><div class="renwu-sec-title">家族谱系</div>' + tmfRenwuFamilyTreeHtml(p) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">家族总览</div>' + tmfRenwuListRows([
        ['家族', p.family || p.clan || '未记'],
        ['家格', p.familyTier || p.clanRank || '未记'],
        ['家望', p.clanPrestige || p.familyPrestige || '未记'],
        ['父族', p.fatherClan || p.family || '未记'],
        ['母族', p.motherClan || '未记'],
        ['姻亲', p.spouseClan || p.spouse || '未记']
      ]) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">亲族人物</div><div class="renwu-list">' + (familyMembers.length ? familyMembers.map(function(m){
        return '<div class="renwu-list-row"><span>' + esc(tmfRenwuText(m.relation || m.type, '亲族')) + '</span><b>' + esc(tmfRenwuText(m.name || m, '未名')) + ' · ' + esc(tmfRenwuText(m.family || m.clan || p.family, '未记')) + '</b></div>';
      }).join('') : '<div class="renwu-prose">暂无亲族记录。</div>') + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">子嗣</div><div class="renwu-list">' + (children.length ? children.map(function(m){
        return '<div class="renwu-list-row"><span>' + esc(tmfRenwuText(m.relation || '子女', '子女')) + '</span><b>' + esc(tmfRenwuText(m.name || m, '未名')) + '</b></div>';
      }).join('') : '<div class="renwu-prose">暂无子嗣记录。</div>') + '</div></section></div>';
    }
    if (tab === 'resources') {
      var resourceLines = tmfRenwuResourceLines(p);
      return '<div class="renwu-panel active"><div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">公用资源</div>' + tmfRenwuListRows([
        ['公库', p.publicPurse || p.publicAssets || '未记'],
        ['职权资源', resourceLines.map(function(r){ return r[0] + ':' + r[1]; }).join('；') || '未录'],
        ['所在地', p.location || '未记'],
        ['官职绑定', p.office || p.title || '未仕']
      ]) + '</section><section class="renwu-sec"><div class="renwu-sec-title">私产与声望</div><div class="renwu-resource-grid">' + [
        ['私产', p.privateWealth || p.wealth || '未记'],
        ['名望', tmfRenwuMetricValue(p, 'fame', '未记')],
        ['贤德', tmfRenwuMetricValue(p, 'virtue', '未记')],
        ['家望', p.clanPrestige || p.familyPrestige || '未记'],
        ['可动用关系', relations.length + ' 条']
      ].map(function(r){ return '<div class="renwu-resource"><span>' + esc(r[0]) + '</span><b>' + esc(tmfRenwuText(r[1], '未记')) + '</b></div>'; }).join('') + '</div></section></div>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">可调动资源</div><div class="renwu-list">' + (tmfRenwuArray(p.resources || p.resource).length ? tmfRenwuArray(p.resources || p.resource).map(function(x){
        return '<div class="renwu-list-row"><span>资源</span><b>' + esc(tmfRenwuText(x, '')) + '</b></div>';
      }).join('') : '<div class="renwu-prose">暂无明确资源记录。</div>') + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">约束</div>' + tmfRenwuListRows([
        ['风险', p.risk || p.danger || (Number(tmfRenwuNum(p, ['ambition','野'], 0)) >= 70 ? '野心偏高' : '未记')],
        ['把柄', p.leverage || p.secret || '未记'],
        ['弱点', p.weakness || '未记'],
        ['目标', p.goal || '未记']
      ]) + '</section></div>';
    }
    if (tab === 'actions') {
      var key = personKey(p);
      return '<div class="renwu-panel active"><section class="renwu-sec"><div class="renwu-sec-title">可用行动</div><div class="renwu-action-grid">' +
        '<button type="button" class="primary" data-module-action="renwu-person-action" data-person-action="wendui" data-id="' + attr(key) + '">御前问对<span>召见此人，进入问对流程</span></button>' +
        '<button type="button" data-module-action="renwu-person-action" data-person-action="letter" data-id="' + attr(key) + '">鸿雁传书<span>写信给此人或转入书信草稿</span></button>' +
        '<button type="button" data-module-action="renwu-person-action" data-person-action="office" data-id="' + attr(key) + '">官制任免<span>转入官制，处理任官调动</span></button>' +
        '<button type="button" data-module-action="pin-person" data-id="' + attr(key) + '">钉选到臣<span>放入右侧紧要之臣列表</span></button>' +
        tmfRenwuOpenFullButton(p, key) +
      '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">行动依据</div>' + tmfRenwuListRows([
        ['忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')],
        ['野心', tmfRenwuNum(p, ['ambition','野'], '—')],
        ['压力', tmfRenwuNum(p, ['stress','压'], '—')],
        ['关系', tmfRenwuRelations(p, people).slice(0, 3).map(function(r){ return r.name + '(' + r.label + ')'; })]
      ]) + '</section></div>';
    }
    return '<div class="renwu-panel active"><div class="renwu-grid-2">' +
      '<section class="renwu-sec"><div class="renwu-sec-title">人物总览</div>' + tmfRenwuListRows([
        ['姓名', p.name || '未名'],
        ['字/号', p.courtesy || p.zi || p.styleName || '未记'],
        ['官职', p.office || p.title || '未仕'],
        ['品秩', p.rank || '未记'],
        ['所属', tmfRenwuFaction(p)],
        ['门类', tmfRenwuGroup(p)],
        ['所在', p.location || '未记'],
        ['状态', tmfRenwuStatusLabel(p)],
        ['当前目标', p.goal || '未记']
      ]) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">声望与状态</div><div class="renwu-quality-grid">' + [
        ['忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')],
        ['野心', tmfRenwuNum(p, ['ambition','野'], '—')],
        ['压力', tmfRenwuMetricValue(p, 'stress', tmfRenwuNum(p, ['stress','压'], '—'))],
        ['健康', tmfRenwuMetricValue(p, 'health', tmfRenwuNum(p, ['health','健康'], '—'))],
        ['名望', tmfRenwuMetricValue(p, 'fame', '未记')],
        ['贤德', tmfRenwuMetricValue(p, 'virtue', '未记')],
        ['家望', p.clanPrestige || p.familyPrestige || '未记'],
        ['可用人物', people.filter(function(x){ return !x || x.alive !== false; }).length + ' / ' + people.length]
      ].map(function(r){ return '<div class="renwu-resource"><span>' + esc(r[0]) + '</span><b>' + esc(tmfRenwuText(r[1], '未记')) + '</b></div>'; }).join('') + '</div></section>' +
      '</div>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">八维评量</div>' + tmfRenwuAbilityBars(p) + '</section>' +
      '<div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">五常与性情</div><div class="renwu-prose">' + tmfRenwuWuchangHtml(p, false) + '<br>' + esc(tmfRenwuText(p.personality || p.innerThought || p.bio, '暂无性情记录。')) + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">可用标签</div><div class="renwu-list">' + (tmfRenwuArray(p.traits || p.tags).length ? tmfRenwuArray(p.traits || p.tags).map(function(t){ return '<div class="renwu-list-row"><span>特质</span><b>' + esc(tmfRenwuText(t, '')) + '</b></div>'; }).join('') : '<div class="renwu-prose">暂无显性特质。</div>') + '</div></section></div></div>';
  }

  function tmfRenwuSide(p, people){
    var relations = tmfRenwuRelations(p, people).slice(0, 5);
    var memories = tmfRenwuMemories(p).slice(0, 5);
    var notes = tmfRenwuSourceNotes(p).slice(0, 3);
    var resources = tmfRenwuResourceLines(p).slice(0, 7);
    var tags = tmfRenwuIndexTags(p, people);
    var persona = tmfRenwuText(p.aiPersona || p.personality || p.behaviorModel || p.speechStyle, '');
    var pos = [[50,14],[78,34],[71,72],[25,72],[20,34]];
    return '<aside class="renwu-side" style="' + tmfRenwuStyle(p) + '">' +
      '<div class="renwu-side-top"><div class="renwu-side-title">关系小图</div><div class="renwu-mini-network">' +
      '<span class="renwu-mini-node self">' + esc(p.name || '人物') + '</span>' +
      relations.map(function(r, i){ return '<button type="button" class="renwu-mini-node" style="left:' + pos[i][0] + '%;top:' + pos[i][1] + '%" data-module-action="select-person" data-id="' + attr(r.id) + '">' + esc(tmfRenwuShort(r.name, 4)) + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="renwu-side-scroll">' +
        '<div class="renwu-side-card"><b>状态</b><div class="renwu-side-metrics">' +
          tmfRenwuSideMetric('忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')) +
          tmfRenwuSideMetric('野心', tmfRenwuNum(p, ['ambition','野'], '—')) +
          tmfRenwuSideMetric('压力', tmfRenwuMetricValue(p, 'stress', tmfRenwuNum(p, ['stress','压'], '—'))) +
          tmfRenwuSideMetric('健康', tmfRenwuMetricValue(p, 'health', tmfRenwuNum(p, ['health','健康'], '—'))) +
          tmfRenwuSideMetric('名望', tmfRenwuMetricValue(p, 'fame', '未记')) +
          tmfRenwuSideMetric('贤德', tmfRenwuMetricValue(p, 'virtue', '未记')) +
        '</div></div>' +
        '<div class="renwu-side-card"><b>朝局位置</b><span>' + esc(tmfRenwuFaction(p) + ' · ' + tmfRenwuGroup(p) + ' · ' + tmfRenwuStatusLabel(p)) + '</span><span>' + esc(tmfRenwuText(p.location || p.office || p.role, '未记')) + '</span></div>' +
        '<div class="renwu-side-card"><b>五常速览</b>' + tmfRenwuWuchangHtml(p, true) + '</div>' +
        '<div class="renwu-side-card"><b>资源</b><div class="renwu-mini-list">' + (resources.length ? resources.map(function(r){ return '<span><i>' + esc(r[0]) + '</i>' + esc(tmfRenwuShort(r[1], 42)) + '</span>'; }).join('') : '<span>暂无可调动资源。</span>') + '</div></div>' +
        '<div class="renwu-side-card"><b>关系网络</b><div class="renwu-mini-list">' + (relations.length ? relations.map(function(r){ return '<button type="button" data-module-action="select-person" data-id="' + attr(r.id) + '"><i>' + esc(r.label) + '</i>' + esc(r.name) + '<em>' + esc(r.score) + '</em></button>'; }).join('') : '<span>暂无显性关系。</span>') + '</div></div>' +
        '<div class="renwu-side-card"><b>AI性格</b><span>' + esc(tmfRenwuShort(persona || '暂无性格脚本。', 72)) + '</span></div>' +
        '<div class="renwu-side-card"><b>最近记忆</b>' + (memories.length ? memories.map(function(m){ return '<span>' + esc(tmfRenwuShort(m, 54)) + '</span>'; }).join('') : '<span>暂无记忆。</span>') + '</div>' +
        '<div class="renwu-side-card"><b>史料摘录</b>' + (notes.length ? notes.map(function(x){ return '<span>' + esc(tmfRenwuShort(x, 64)) + '</span>'; }).join('') : '<span>暂无史料摘录。</span>') + '</div>' +
        '<div class="renwu-side-card"><b>索引</b><div class="renwu-index-tags">' + tags.map(function(t){ return '<span>' + esc(tmfRenwuShort(t, 8)) + '</span>'; }).join('') + '</div></div>' +
        '<div class="renwu-side-card"><b>可用操作</b><div class="renwu-mini-list"><button type="button" data-module-action="renwu-person-action" data-person-action="detail" data-id="' + attr(personKey(p)) + '"><i>全志</i>完整人物志<em>详</em></button></div></div>' +
      '</div>' +
    '</aside>';
  }

  function renwuFilterState(){
    var filters = state.renwuFilters || {};
    state.renwuFilters = filters;
    filters.q = String(filters.q || '');
    filters.group = filters.group || 'all';
    filters.faction = filters.faction || 'all';
    filters.status = filters.status || 'all';
    filters.showDead = !!filters.showDead;
    return filters;
  }

  function renwuOption(value, label, current){
    value = String(value == null ? '' : value);
    return '<option value="' + attr(value) + '"' + (String(current) === value ? ' selected' : '') + '>' + esc(label == null ? value : label) + '</option>';
  }

  function renwuRosterList(root){
    root = root || document;
    return root.querySelector ? root.querySelector('.renwu-roster-list') : null;
  }

  function rememberRenwuRosterScroll(root){
    var list = renwuRosterList(root || document.getElementById('tmf-module-overlay'));
    if (!list) return;
    state.renwuRosterScroll = Number(list.scrollTop || 0);
  }

  function restoreRenwuRosterScroll(root){
    var y = Number(state.renwuRosterScroll || 0);
    if (!y) return;
    var apply = function(){
      var list = renwuRosterList(root || document.getElementById('tmf-module-overlay'));
      if (list) list.scrollTop = y;
    };
    apply();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
    else setTimeout(apply, 0);
  }

  function renwuTabsMarkup(){
    var tabs = [['overview','总览'],['identity','身份'],['mind','心绪'],['relations','关系'],['career','履历'],['family','家族'],['resources','资源'],['actions','行动']];
    return '<nav class="renwu-tabs">' + tabs.map(function(t){
      return '<button type="button" class="renwu-tab ' + ((state.renwuTab || 'overview') === t[0] ? 'active' : '') + '" data-module-action="renwu-tab" data-tab="' + attr(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</nav>';
  }

  function refreshRenwuSelection(root){
    root = root || document.getElementById('tmf-module-overlay');
    if (!root || !state.activeModule || state.activeModule.kind !== 'renwu') return false;
    var people = getPeople();
    var selected = findPerson(state.modulePerson) || people[0] || {};
    var selectedKey = personKey(selected);
    if (selectedKey) state.modulePerson = selectedKey;
    Array.prototype.forEach.call(root.querySelectorAll('[data-renwu-card]'), function(card){
      card.classList.toggle('active', String((card.dataset && card.dataset.id) || '') === String(selectedKey));
    });
    Array.prototype.forEach.call(root.querySelectorAll('.renwu-head-btn[data-id]'), function(btn){
      btn.setAttribute('data-id', selectedKey || '');
    });
    var main = root.querySelector('.renwu-main');
    if (main) {
      main.innerHTML = tmfRenwuProfileHead(selected, selectedKey) +
        renwuTabsMarkup() +
        '<div class="renwu-detail-scroll" style="' + tmfRenwuStyle(selected) + '">' + tmfRenwuDetailTab(selected, people) + '</div>';
    }
    var side = root.querySelector('.renwu-side');
    if (side) side.outerHTML = tmfRenwuSide(selected, people);
    return true;
  }

  function filterRenwuOverlay(root, options){
    root = root || document;
    options = options || {};
    var filters = renwuFilterState();
    var oldQ = filters.q;
    var oldGroup = filters.group;
    var oldFaction = filters.faction;
    var oldStatus = filters.status;
    var oldShowDead = filters.showDead;
    var q = (root.querySelector('[data-renwu-search]') || {}).value || '';
    q = q.trim().toLowerCase();
    var group = (root.querySelector('[data-renwu-group]') || {}).value || 'all';
    var faction = (root.querySelector('[data-renwu-faction]') || {}).value || 'all';
    var status = (root.querySelector('[data-renwu-status]') || {}).value || 'all';
    var showDead = !!((root.querySelector('[data-renwu-dead]') || {}).checked);
    filters.q = q;
    filters.group = group;
    filters.faction = faction;
    filters.status = status;
    filters.showDead = showDead;
    var changed = oldQ !== q || oldGroup !== group || oldFaction !== faction || oldStatus !== status || oldShowDead !== showDead;
    var shown = 0;
    root.querySelectorAll('[data-renwu-card]').forEach(function(card){
      var ok = true;
      var text = String((card.dataset && card.dataset.filterText) || card.textContent || '').toLowerCase();
      if (q && text.indexOf(q) < 0) ok = false;
      if (group !== 'all' && card.dataset.group !== group) ok = false;
      if (faction !== 'all' && card.dataset.faction !== faction) ok = false;
      if (status !== 'all' && (' ' + (card.dataset.status || '') + ' ').indexOf(' ' + status + ' ') < 0) ok = false;
      if (!showDead && status !== 'dead' && (' ' + (card.dataset.status || '') + ' ').indexOf(' dead ') >= 0) ok = false;
      card.hidden = !ok;
      card.style.display = ok ? '' : 'none';
      card.setAttribute('aria-hidden', ok ? 'false' : 'true');
      if (ok) shown += 1;
    });
    var count = root.querySelector('#renwu-visible-count');
    if (count) count.textContent = shown;
    // 空状态:筛选/搜索零结果时注入「无匹配之人」(原全 display:none 致名册空白似面板坏)
    var _rlist = renwuRosterList(root);
    if (_rlist) {
      var _empty = _rlist.querySelector('#renwu-filter-empty');
      if (shown === 0) {
        if (!_empty) {
          _empty = document.createElement('div');
          _empty.id = 'renwu-filter-empty';
          _empty.className = 'renwu-roster-empty';
          _empty.style.cssText = 'padding:18px 12px;text-align:center;color:#9c8b6b;font-size:13px;letter-spacing:0.05em';
          _rlist.appendChild(_empty);
        }
        _empty.textContent = (q || group !== 'all' || faction !== 'all' || status !== 'all') ? '朝野寂寂·无匹配之人' : '暂无人物';
      } else if (_empty) {
        _empty.remove();
      }
    }
    if (changed && !options.preserveScroll) {
      var list = renwuRosterList(root);
      if (list) list.scrollTop = 0;
      state.renwuRosterScroll = 0;
    }
  }

  function renderRenwuModule(){
    var people = getPeople();
    var selected = findPerson(state.modulePerson) || people[0] || {};
    var selectedKey = personKey(selected);
    if (selectedKey) state.modulePerson = selectedKey;
    var alive = people.filter(function(p){ return !p || p.alive !== false; }).length;
    var factions = tmfRenwuOptionValues(people, tmfRenwuFaction);
    var groups = tmfRenwuOptionValues(people, tmfRenwuGroup);
    var pinnedCount = (state.pinnedPeople || []).length;
    var filters = renwuFilterState();
    var tabs = [['overview','总览'],['identity','身份'],['mind','心绪'],['relations','关系'],['career','履历'],['family','家族'],['resources','资源'],['actions','行动']];
    var loyalty = tmfRenwuNum(selected, ['loyalty','loyal','忠'], '—');
    var ambition = tmfRenwuNum(selected, ['ambition','野'], '—');
    var stress = tmfRenwuNum(selected, ['stress','压'], '—');
    var health = tmfRenwuNum(selected, ['health','健康'], '—');
    var judgement = tmfRenwuText(selected.innerThought || selected.bio || selected.description || selected.desc || selected.goal, '暂无人物判断。');
    return '<section class="renwu-atlas tmf-renwu-atlas" role="dialog" aria-label="人物图志">' +
      '<header class="renwu-atlas-head">' +
        '<div class="renwu-titleblock"><div class="renwu-title-seal">志</div><div class="renwu-titletext"><div class="renwu-title-line"><h2>人物图志</h2><button type="button" class="renwu-ceming-btn" data-module-action="ceming-open">策名</button></div><p>索引朝野人物、仕途、心绪、关系与可用行动</p></div></div>' +
        '<div class="renwu-head-actions"><button type="button" class="renwu-head-btn" data-module-action="renwu-person-action" data-person-action="detail" data-id="' + attr(selectedKey) + '">完整</button><button type="button" class="renwu-head-btn" data-module-action="renwu-reset">清筛</button><button type="button" class="renwu-head-btn" data-module-action="pin-person" data-id="' + attr(selectedKey) + '">钉选</button><button type="button" class="renwu-head-btn" data-module-close="1">×</button></div>' +
      '</header>' +
      '<div class="renwu-atlas-body">' +
        '<aside class="renwu-roster">' +
          '<div class="renwu-statbar"><div class="renwu-stat"><b>' + people.length + '</b><span>入志</span></div><div class="renwu-stat"><b>' + alive + '</b><span>存世</span></div><div class="renwu-stat"><b>' + pinnedCount + '</b><span>钉选</span></div></div>' +
          '<div class="renwu-tools">' +
            '<div class="renwu-tool-row"><input class="renwu-search" data-renwu-search value="' + attr(filters.q) + '" placeholder="输入姓名、官职、派系、记忆"><label class="renwu-check"><input type="checkbox" data-renwu-filter data-renwu-dead' + (filters.showDead ? ' checked' : '') + '>含已殁</label></div>' +
            '<div class="renwu-filter-row three">' +
              '<select data-renwu-filter data-renwu-group>' + renwuOption('all', '全部门类', filters.group) + groups.map(function(g){ return renwuOption(g, g, filters.group); }).join('') + '</select>' +
              '<select data-renwu-filter data-renwu-faction>' + renwuOption('all', '全部势力', filters.faction) + factions.map(function(f){ return renwuOption(f, f, filters.faction); }).join('') + '</select>' +
              '<select data-renwu-filter data-renwu-status>' + renwuOption('all', '全部状态', filters.status) + renwuOption('court', '在朝', filters.status) + renwuOption('local', '在外', filters.status) + renwuOption('inner', '内廷', filters.status) + renwuOption('dead', '已殁', filters.status) + '</select>' +
            '</div>' +
            '<div class="renwu-legend"><span>当前显示 <b id="renwu-visible-count">' + people.length + '</b> 人</span><span>点击人物切换档案</span></div>' +
          '</div>' +
          '<div class="renwu-roster-list" data-renwu-roster-chunked="1">' + (people.length ? '<p class="renwu-prose">人物索引载入中...</p>' : '<p class="renwu-prose">暂无人物数据。</p>') + '</div>' +
        '</aside>' +
        '<main class="renwu-main">' +
          tmfRenwuProfileHead(selected, selectedKey) +
          renwuTabsMarkup() +
          '<div class="renwu-detail-scroll" style="' + tmfRenwuStyle(selected) + '">' + tmfRenwuDetailTab(selected, people) + '</div>' +
        '</main>' +
        tmfRenwuSide(selected, people) +
      '</div>' +
    '</section>';
  }

  function renderShizhengModule(){
    var issues = getIssues();
    var sorted = issues.slice().sort(function(a, b){
      var ar = issueIsResolved(a) ? 1 : 0;
      var br = issueIsResolved(b) ? 1 : 0;
      if (ar !== br) return ar - br;
      return issueRank(b) - issueRank(a);
    });
    var selected = sorted.find(function(x){ return String(x.id) === String(state.shizhengIssue || ''); }) || sorted[0] || null;
    if (selected) state.shizhengIssue = selected.id;
    var pending = issues.filter(function(x){ return !issueIsResolved(x); });
    var resolved = issues.filter(issueIsResolved);
    var linkedCount = issues.reduce(function(sum, x){
      return sum + ((x.linkedChars || []).length) + ((x.linkedFactions || []).length);
    }, 0);
    var left = '<div class="tmf-sz-summary">' +
      '<span><i>待裁</i><b>' + esc(pending.length) + '</b></span>' +
      '<span><i>已裁</i><b>' + esc(resolved.length) + '</b></span>' +
      '<span><i>牵涉</i><b>' + esc(linkedCount) + '</b></span>' +
      '</div><div class="tmf-sz-list">' + sorted.map(function(x){ return renderIssueCard(x, selected && selected.id); }).join('') + '</div>';
    var main = renderIssueDetail(selected);
    var issueId = selected ? attr(selected.id) : '';
    var right = '<h3>联动入口</h3><div class="tmf-sz-actions">' +
      '<button type="button" class="tmf-sz-action primary" data-module-action="shizheng-refresh">刷新御案</button>' +
      '<button type="button" class="tmf-sz-action" data-module-action="shizheng-convene" data-id="' + issueId + '">御前召对群臣</button>' +
      '<button type="button" class="tmf-sz-action" data-module-action="shizheng-secret" data-id="' + issueId + '">独召密问</button>' +
      '<button type="button" class="tmf-sz-action" data-module-action="add-edict" data-id="' + issueId + '">转诏书草案</button>' +
      '<button type="button" class="tmf-sz-action" data-module-action="record-tab" data-tab="jishi">开史官实录</button>' +
      '</div><div class="tmf-sz-hint">本页只承接政务议题的读取、筛选、裁断、召对、密问与转诏入口；近事、邸报、人物和势力活动归事件栏。</div>';
    return moduleShell('shizheng', '御案时政', '时局要务、待裁议题、召对密问与裁断记录', left, main, right);
  }

  function renderWenduiModule(){
    var people = getPeople().filter(function(p){
      return /京|宫|朝|内廷|在朝|在京/.test(String(p.location || '') + String(p.status || '') + String(p.group || '') + String(p.office || ''));
    }).slice(0, 18);
    if (!people.length) people = getPeople().slice(0, 18);
    var left = '<h3>可召臣僚</h3><div class="tmf-module-scroll compact">' + people.map(function(p){
      return '<button class="tmf-person-pick" data-module-action="select-person" data-id="' + esc(personKey(p)) + '"><b>' + esc(p.name || personKey(p)) + '</b><span>' + esc(p.office || p.title || p.faction || '') + '</span></button>';
    }).join('') + '</div>';
    var main = '<h3>御前问对</h3><div class="tmf-prose">选择臣僚后，可在此记录问对主题、风险与后续旨意。正式接入时由这里生成问对上下文，而不是打开旧问对标签页。</div><div class="tmf-letter-editor"><textarea>朕欲问边饷、阉党、民变三事，卿据实陈奏。</textarea></div>';
    var right = '<h3>问对结果</h3>' + miniRows([['写入','人物记忆'],['联动','诏书 / 朝议 / 史官'],['限制','远方人物转鸿雁'],['状态','待问']]);
    return moduleShell('wendui', '政务问对', '正式页内问对面板，读取人物、在京状态、记忆与后续动作', left, main, right);
  }

  function renderChaoyiModule(options){
    var mode = options.mode || 'tingyi';
    var titles = { routine:'常朝', tingyi:'廷议', yuqian:'御前会议' };
    var issues = getIssues();
    var left = '<h3>朝议类型</h3><div class="tmf-module-stack"><button class="' + (mode === 'routine' ? 'active' : '') + '" data-module-action="toast" data-text="已选择常朝">常朝</button><button class="' + (mode === 'tingyi' ? 'active' : '') + '" data-module-action="toast" data-text="已选择廷议">廷议</button><button class="' + (mode === 'yuqian' ? 'active' : '') + '" data-module-action="toast" data-text="已选择御前会议">御前会议</button></div>';
    var main = '<h3>' + esc(titles[mode] || '廷议') + '</h3><div class="tmf-chaoyi-scene"><img src="' + esc(asset(mode === 'routine' ? 'chaoyi-changchao-scene-v1.png' : (mode === 'yuqian' ? 'chaoyi-yuqian-scene-v1.png' : 'chaoyi-tingyi-scene-v1.png'))) + '" alt=""></div><div class="tmf-module-scroll compact">' + issues.map(function(x){
      return '<article class="tmf-module-item"><b>' + esc(x.title) + '</b><span>' + esc(x.category) + ' · ' + esc(x.severity) + '</span></article>';
    }).join('') + '</div>';
    var right = '<h3>流程</h3>' + miniRows([['一','选朝议类型'],['二','择议题'],['三','臣僚发言'],['四','形成裁断']]);
    return moduleShell('chaoyi', '朝会', '常朝、廷议、御前会议三类流程在正式页内展开', left, main, right);
  }

  function renderKejuModule(){
    var pk = (typeof P !== 'undefined' && P && P.keju) || {};
    var gp = (window.GM && GM._kejuParadigm) || {};
    var enabled = !!pk.enabled;
    var current = pk.currentExam || null;
    var jinshiCount = (pk.history && pk.history.length) || 0;
    var lastExam = pk.lastExamDate ? (pk.lastExamDate.year + '年' + (pk.lastExamDate.month || '') + '月') : '从未举办';
    var subjects = (gp.subjects && gp.subjects.length)
      ? gp.subjects.map(function(s){ return s && (s.name || s.id) || ''; }).filter(Boolean).slice(0, 6).join('·')
      : (pk.examSubjects || '未定');
    var tierCount = (gp.tiers && gp.tiers.length) || 0;
    var quotaTotal = (gp.quota && gp.quota.total) || pk.quotaPerExam || '未定';
    var initEra = gp.initEra || '';
    var reformHistory = (gp.reformChronicle && gp.reformChronicle.length) || 0;
    var leftRows = [
      ['制度', enabled ? '已启用' : '未启用'],
      ['当前', current ? ((current.stage || current.phase || '进行中')) : (enabled ? '待开科' : '—')],
      ['进士累计', jinshiCount + ' 名'],
      ['上次科举', lastExam]
    ];
    var rightRows = [
      ['科目', subjects],
      ['层级', tierCount ? (tierCount + ' tier') : '—'],
      ['每科取士', String(quotaTotal)],
      ['改革次数', String(reformHistory) + (initEra ? ' · 创自' + initEra : '')]
    ];
    var mainHtml = '<h3>科举主面板</h3>' +
      '<p class="tmf-module-note">完整流程·贡士选拔·会试·殿试·钦点三甲·授官派任·改革议政，均在主面板内进行。</p>' +
      '<div class="tmf-shizheng-grid"><article><b>' + esc(enabled ? '续科取士' : '开科取士') + '</b>' +
      '<p>' + esc(current ? '当前已有科举在 ' + (current.stage || '进行') + '，点击继续。' : (enabled ? '依照当前 paradigm 启动下一科。' : '尚未启用科举·点击进入决议启用。')) + '</p>' +
      '<button class="tmf-action main" onclick="if(typeof window.openKejuPanel===&#39;function&#39;)window.openKejuPanel();else if(typeof toast===&#39;function&#39;)toast(&#39;科举系统未加载&#39;);">📜 入科举主面板</button>' +
      '</article><article><b>改革范式</b><p>调整科目·层级·取士额·主考权重。所有改革走议政流程，由臣僚廷议。</p>' +
      '<button data-module-action="open-keju-panel">改革议政</button></article></div>';
    return moduleShell('keju', '科举', '正式页内承接科举主面板入口·真状态汇总，详流程在 openKejuPanel modal 内展开',
      '<h3>科场</h3>' + miniRows(leftRows),
      mainHtml,
      '<h3>制度范式</h3>' + miniRows(rightRows) +
        '<p class="tmf-module-note">字段来自 GM._kejuParadigm·P.keju.history·tm-keju-paradigm.js</p>'
    );
  }

  function renderWenshiModule(){
    return moduleShell('wenshi', '文事', '承接旧文事标签页：文苑、著述、士论、教化与文治影响',
      '<h3>文事门类</h3><div class="tmf-module-stack"><button>文苑</button><button>士论</button><button>教化</button></div>',
      '<h3>文治记录</h3><div class="tmf-prose">当前暂无正式文事记录。后续从科举、人物著述、诏令与奏疏中自动归档。</div>',
      '<h3>联动字段</h3>' + miniRows([['士林','待估'],['文教','待估'],['清议','待估'],['著述','自动摘入']])
    );
  }

  function renderFinanceModule(){
    var g = (window.GM && GM.guoku) || {};
    var n = (window.GM && GM.neitang) || {};
    // 失真层保卫·库藏取据奏口径(与顶栏 _VAR_RENDERERS.guoku()/neitang() 同源)·不再裸读 stockMoney||money 等模糊回退
    var _VR = (typeof window !== 'undefined' && window._VAR_RENDERERS) || null;
    var _gv = null, _nv = null;
    try { if (_VR && typeof _VR.guoku === 'function') _gv = _VR.guoku(); } catch(_e1){}
    try { if (_VR && typeof _VR.neitang === 'function') _nv = _VR.neitang(); } catch(_e2){}
    function _stockView(view, idx, obj, kind){
      if (view && Array.isArray(view.subItems) && view.subItems[idx]) return view.subItems[idx].v;
      if (typeof window._barAccountStock === 'function' && typeof window._barFmtNum === 'function') return window._barFmtNum(window._barAccountStock(obj, kind));
      return obj[kind];
    }
    return moduleShell('finance', '户部财计', '正式页内国库、内帑、收入支出与风险；完整账册沿用旧国库面板',
      '<h3>库藏</h3>' + miniRows([['太仓银', _stockView(_gv, 0, g, 'money')],['太仓粮', _stockView(_gv, 1, g, 'grain')],['内帑银', _stockView(_nv, 0, n, 'money')],['本回合', getTurnText(window.GM && GM.turn)]]),
      '<h3>收支</h3>' + miniRows([['本期收入', g.turnIncome || g.monthlyIncome],['本期支出', g.turnExpense || g.monthlyExpense],['军饷', g.armyExpense || '待核'],['宗禄', g.royalExpense || '待核'],['风险', g.risk || '待核'],['可支月数', g.months || '待估']]),
      '<h3>动作</h3><div class="tmf-module-stack"><button data-module-action="finance-full">打开完整帑廪</button><button data-module-action="finance-old" data-method="extraTax">加派钱粮</button><button data-module-action="finance-old" data-method="openGranary">开仓赈济</button><button data-module-action="finance-old" data-method="loan">借贷筹款</button><button data-module-action="toast" data-text="已记录拨内帑">拨内帑</button><button data-module-action="toast" data-text="已记录核饷">核饷</button><button data-module-action="toast" data-text="已转御案时政">转御案时政</button></div>'
    );
  }

  function renderOfficeModule(){
    var people = getPeople().slice(0, 16);
    return moduleShell('office', '官制衙门', '正式页内承接官制树、任免、荐贤与钉选人物',
      '<h3>职官候选</h3><div class="tmf-module-scroll compact">' + people.map(function(p){ return '<button class="tmf-person-pick" data-module-action="select-person" data-id="' + esc(personKey(p)) + '"><b>' + esc(p.name || personKey(p)) + '</b><span>' + esc(p.office || p.title || '') + '</span></button>'; }).join('') + '</div>',
      '<h3>官制操作</h3><div class="tmf-shizheng-grid"><article><b>任免</b><p>选择人物与官缺，形成任免草案。</p><button data-module-action="toast" data-text="已记录任免草案">拟任</button></article><article><b>廷推</b><p>由臣僚推荐候选，进入朝议。</p><button data-module-action="toast" data-text="已记录廷推">廷推</button></article></div>',
      '<h3>联动</h3>' + miniRows([['人物图志','候选读取'],['御案时政','人事议题'],['史官实录','任免入档'],['变量','吏治/皇权']])
    );
  }

  // ── public API attach (Wave 5·modules) ────────────────────────────
  bridge.modules = bridge.modules || {};
  bridge.modules.renderModule = renderModule;
  bridge.modules.openModule = openModule;
  bridge.modules.closeModule = closeModule;
  bridge.modules.rerenderModule = rerenderModule;
  bridge.modules.renderRenwuModule = renderRenwuModule;
  bridge.modules.handleModuleAction = handleModuleAction;
  bridge.modules.moduleShell = moduleShell;
  bridge.modules.tmfRenwuPortrait = tmfRenwuPortrait;
  window.renderRenwuModule = renderRenwuModule;

  // ── re-attach bridge exposes that previously came from bridge.js ──
  bridge.openModule = openModule;
  bridge._closeModule = closeModule;
  bridge._moduleShell = moduleShell;
  bridge._handleModuleAction = handleModuleAction;
  bridge._tmfRenwuPortrait = tmfRenwuPortrait;
  bridge.openRenwu = function(){ openModule('renwu'); };

})();

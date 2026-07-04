// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-keju-paradigm-panel-render.js — 科举范式面板·渲染族+常量表
 *  （2026-07-04 立项拆分·alias 范式首例·自 tm-keju-paradigm-panel.js 切出）
 *  内容：§0 常量表(NEUTRAL_PARTIES 留守 origin)+§3 MAGNITUDE_PRESETS+§4 渲染族 25 函数
 *  origin 头部 alias 块把以下导出绑回其闭包本地名——origin §5-§L10 业务体 0 改动
 *  加载序：index.html 中紧挨 tm-keju-paradigm-panel.js 之前（alias 在 origin 装载期解析·错序=undefined）
 * ═══════════════════════════════════════════════════════════════════════ */
(function(global) {
  'use strict';

  // ── 常量表（自 origin §0/§3 搬家·origin alias 回绑）──
  // C4 修·候选 subject 扩到 15·更多历史科目 (L6 ship 后 LLM 推荐替换)
  var SUBJECT_CANDIDATES = [
    { id: 'celun',     name: '策论',   ideology: 'reformist',   format: '时务策',         defaultWeight: 20 },
    { id: 'suanxue',   name: '算学',   ideology: 'practical',   format: '九章算术',       defaultWeight: 10 },
    { id: 'gezhi',     name: '格致',   ideology: 'practical',   format: '物理化学',       defaultWeight: 10 },
    { id: 'lvfa',      name: '律法',   ideology: 'practical',   format: '律令策',         defaultWeight: 10 },
    { id: 'jingyi',    name: '经义',   ideology: 'traditional', format: '通经义',         defaultWeight: 20 },
    { id: 'shifu',     name: '诗赋',   ideology: 'traditional', format: '律诗·赋',       defaultWeight: 15 },
    { id: 'wuxue',     name: '武学',   ideology: 'practical',   format: '韬略·战例',     defaultWeight: 15 },
    { id: 'fanyi',     name: '翻译',   ideology: 'practical',   format: '满汉对译',       defaultWeight: 10 },
    // 扩 7·历史科目
    { id: 'bingfa',    name: '兵法',   ideology: 'practical',   format: '孙子·吴子',     defaultWeight: 10 },
    { id: 'yantie',    name: '盐铁',   ideology: 'practical',   format: '盐铁论·桑弘羊', defaultWeight: 10 },
    { id: 'nonggong',  name: '农工',   ideology: 'practical',   format: '齐民要术·王祯', defaultWeight: 10 },
    { id: 'xixue',     name: '西学',   ideology: 'modern',      format: '万国通史·欧罗巴', defaultWeight: 10 },
    { id: 'wanguoshi', name: '万国史', ideology: 'modern',      format: '寰宇地理',       defaultWeight: 10 },
    { id: 'yixue',     name: '医学',   ideology: 'practical',   format: '本草·伤寒论',   defaultWeight: 10 },
    { id: 'tianwen',   name: '天文',   ideology: 'practical',   format: '历算·星占',     defaultWeight: 10 }
  ];

  var PENALTY_OPTIONS = ['demote', 'whip', 'expel', 'banish', 'death', 'lingchi', 'individual', 'kin_punishment'];
  var EXAMINER_TYPE_OPTIONS = ['scholar', 'military', 'foreign', 'eunuch', 'aristocrat'];
  var INSPECTION_LEVEL_OPTIONS = ['low', 'medium', 'high'];
  var RANKING_RULE_OPTIONS = ['by_score', 'by_origin', 'by_party', 'by_recommendation'];
  var FEE_REIMBURSEMENT_OPTIONS = ['self', 'state_subsidy', 'waived'];
  var RETAKE_OPTIONS = ['no', 'allow_3x', 'unlimited'];

  // 复古议·朝代历史 reference (用于 "复 X 朝" 文案)
  var RESTORATION_DYNASTIES = ['唐', '北宋', '南宋', '明', '清', '汉'];

  // L3 magnitude descriptor presets
  var MAGNITUDE_PRESETS = [
    { key: 'incremental', label: '缓改·徐徐图之 (类·庆历新政)',     descriptor: '缓改·徐徐图之' },
    { key: 'moderate',    label: '中改·循序渐进 (类·王安石三经新义)', descriptor: '中改·循序渐进' },
    { key: 'radical',     label: '急除积弊·一旦决之 (类·商鞅/戊戌)',  descriptor: '急除积弊·一旦决之' },
    { key: 'restorative', label: '复古·返本归源 (类·朱元璋废元制)',   descriptor: '复古·返本归源' }
  ];

  // ── 跨闭包小帮手（复制自 origin §12·范式军规:17行内 pure helper 复制优于共享抽象层）──
  function _escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }


  // ── 运行期委托 shim：§4 体内的 _kjpComputeDiff 调用在渲染时才解析·彼时 origin 已装载并导出 ──
  function _kjpComputeDiff(draft) { return global.TM.Keju.ParadigmPanel.computeDiff(draft); }

  // ════════════════════════════════════════════════════════════════
  // §4·render modal HTML·11 大类全暴露
  // ════════════════════════════════════════════════════════════════

  function _kjpRenderProposalHtml(draft) {
    var p = GM._kejuParadigm;
    // L-C·s5·sub-header gated rollback button·若有 active reform 才显
    var subHeaderRollback = '';
    try {
      var ip = p && p._reformInProgress;
      if (ip && ip.histId) {
        // 找 target entry·label 显 canonicalName
        var targetEntry = null;
        var hist = p.history || [];
        for (var i = 0; i < hist.length; i++) {
          if (hist[i] && hist[i].id === ip.histId) { targetEntry = hist[i]; break; }
        }
        if (targetEntry) {
          var targetLabel = (targetEntry.canonicalName || targetEntry.magnitudeDescriptor || '现行改革').slice(0, 8);
          subHeaderRollback = ' <button class="bt bs bsm kjp-lc-quick-rollback-btn" data-rid="' +
            _escHtml(ip.histId) + '" title="快捷·开 L11 rollback modal·废止此改革">⟲ 废止 ' +
            _escHtml(targetLabel) + '</button>';
        }
      }
    } catch(_){}
    return '' +
      '<div class="kjp-modal-content">' +
        '<div class="kjp-modal-header">' +
          '<div class="kjp-modal-title">⚖️ 改革科举范式</div>' +
          '<button class="bt bs bsm kjp-close-btn">✕</button>' +
        '</div>' +
        '<div class="kjp-lc-sub-header">' +
          '<button class="bt bs bsm kjp-l8-chronicle-btn" title="改革志·LLM 年度演化推演 + 跨代承袭">📜 改革志</button>' +
          subHeaderRollback +
        '</div>' +
        '<div class="kjp-modal-body">' +
          '<div class="kjp-section">' +
            '<div class="kjp-section-title">当前·' + _escHtml(p.initEra || '未知') +
              '·ideology=' + _escHtml(p.ideology) +
              '·' + p.subjects.length + ' 科·' + p.tiers.length + ' tier·' +
              p.quota.total + ' 名</div>' +
          '</div>' +

          '<div class="kjp-section">' +
            '<label><input type="radio" name="kjp-intent" value="reform" checked> 改革 (新政)</label> ' +
            '<label><input type="radio" name="kjp-intent" value="restoration"> 复古 (复 X 朝旧章)</label>' +
            '<span class="kjp-restoration-dyn" style="display:none;"> 复·' +
              '<select id="kjp-restoration-dynasty">' +
              '<option value="">(请选朝代)</option>' +
              RESTORATION_DYNASTIES.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('') +
              '</select></span>' +
          '</div>' +

          // L3·改革路径 (幅度·试点·朝议预判·召对)
          _kjpRenderSection('l3-magnitude', '改革幅度·古文 descriptor (LLM 解读)', false, _kjpRenderMagnitudeBody(draft)) +
          _kjpRenderSection('l3-pilot', '试点范围·LLM 推荐 (按朝代)', false, _kjpRenderPilotBody(draft)) +
          _kjpRenderSection('l3-courtmood', '朝议预判·LLM 古文 narrative (实时)', false, _kjpRenderCourtMoodBody(draft)) +
          _kjpRenderSection('l3-audience', '召对·私谈 NPC·LLM 模拟反应', true, _kjpRenderAudienceBody(draft)) +
          // L4·b·召史策对·借 wendui mode='cedui'·8 archetype voice·NPC 答策对 + 政治后果
          _kjpRenderSection('l4-cedui', '召史策对·密召史官 / 翰林 / 老臣 (8 派)', true, _kjpRenderCeduiBody(draft)) +

          _kjpRenderSection('subjects', 'A·题目', false, _kjpRenderSubjectsBody(draft)) +
          _kjpRenderSection('tier', 'B·tier·间隔·复试', true, _kjpRenderTierBody(draft)) +
          _kjpRenderSection('candidate', 'C·考生资格', false, _kjpRenderCandidateBody(draft)) +
          _kjpRenderSection('examiner', 'D·主考', false, _kjpRenderExaminerBody(draft)) +
          _kjpRenderSection('quota', 'E·录取', false, _kjpRenderQuotaBody(draft)) +
          _kjpRenderSection('allocation', 'F·授官·一甲/二甲/三甲', true, _kjpRenderAllocationBody(draft)) +
          _kjpRenderSection('identity', 'G·身份·同年·门生', true, _kjpRenderIdentityBody(draft)) +
          _kjpRenderSection('linkage', 'H·联动·学制·免赋·荫子', true, _kjpRenderLinkageBody(draft)) +
          _kjpRenderSection('ceremony', 'I·仪轨·谢恩·簪花跨马·题名碑', true, _kjpRenderCeremonyBody(draft)) +
          _kjpRenderSection('penalty', 'J·惩罚·舞弊·泄题·避讳', true, _kjpRenderPenaltyBody(draft)) +
          _kjpRenderSection('meta', 'K·语言·L·元 (ideology)', false, _kjpRenderLangMetaBody(draft)) +

          '<div class="kjp-section kjp-preview-section">' +
            '<div class="kjp-section-title">议题文本 (古文·可手改) <button class="bt bsm kjp-reset-topic-btn">↺ 重置 auto</button></div>' +
            '<textarea id="kjp-topic-text" class="kjp-topic-text" rows="3" placeholder="点选改革维度·自动生成议题"></textarea>' +
          '</div>' +

          '<div class="kjp-section kjp-preview-section">' +
            '<div class="kjp-section-title">朝中预览 (读 GM.parties·复用 tinyi v3)</div>' +
            '<div id="kjp-stance-preview" class="kjp-stance-preview">(改完显示各党 stance)</div>' +
          '</div>' +
        '</div>' +
        '<div class="kjp-modal-footer">' +
          '<button class="bt kjp-cancel-btn">取消</button>' +
          '<button class="bt bp kjp-submit-btn">上奏议政 →</button>' +
        '</div>' +
      '</div>';
  }

  function _kjpRenderSection(catKey, title, collapsedDefault, bodyHtml) {
    var open = collapsedDefault ? '' : ' open';
    return '<details class="kjp-section kjp-cat-' + catKey + '"' + open + '>' +
      '<summary class="kjp-section-title">' + _escHtml(title) + '</summary>' +
      '<div class="kjp-section-body">' + bodyHtml + '</div>' +
      '</details>';
  }

  // ════════════════════════════════════════════════════════════════
  // L3·改革路径 sections·改革幅度·试点·朝议预判·召对
  // ════════════════════════════════════════════════════════════════

  function _kjpRenderMagnitudeBody(draft) {
    var parsed = draft.magnitudeParsed || {};
    var html = '<div class="kjp-row">choose preset 或自行手写古文 descriptor·LLM 解读阻力/年数/可逆</div>';
    html += '<div class="kjp-row">';
    MAGNITUDE_PRESETS.forEach(function(p) {
      html += '<button class="bt bsm kjp-mag-preset" data-desc="' + _escHtml(p.descriptor) + '" data-key="' + p.key + '">' +
        _escHtml(p.label) + '</button> ';
    });
    html += '</div>';
    html += '<div class="kjp-row"><input type="text" class="kjp-mag-input" value="' +
      _escHtml(draft.magnitudeDescriptor) +
      '" placeholder="或手写·如 商鞅一旦决 / 张相考成法" style="width:60%"> ' +
      '<button class="bt bsm kjp-mag-llm-btn">▶ LLM 解读</button></div>';
    if (parsed && parsed.scale !== undefined) {
      // D2·标签明确·"政治阻力"·LLM 算·跟下方 stance preview 的"改动幅度"区分
      html += '<div class="kjp-mag-parsed">LLM 解读 (' + (parsed._source || 'unknown') + ')·' +
        '政治阻力 <b>' + parsed.scale + '/100</b>·' +
        '预 <b>' + parsed.years + '</b> 年生效·' +
        (parsed.reversible ? '可逆' : '部分不可逆') + '·tags·' + (parsed.tags || []).join('/') +
        (parsed.paraphrase ? '·"' + _escHtml(parsed.paraphrase) + '"' : '') +
        '</div>';
    }
    return html;
  }

  function _kjpRenderPilotBody(draft) {
    var sel = draft.pilotScope || {};
    var html = '<div class="kjp-row">当前·<b>' + _escHtml(sel.name) + '</b>·' + _escHtml(sel.reason || '') + '</div>';
    html += '<div class="kjp-row"><button class="bt bsm kjp-pilot-llm-btn"' + (draft.pilotLoading ? ' disabled' : '') + '>' +
      (draft.pilotLoading ? '⏳ 推荐中...' : '▶ LLM 推荐 5 候选 (按朝代)') + '</button> ' +
      '<input type="text" class="kjp-pilot-custom" placeholder="或自定·如 河北山东" style="width:200px"> ' +
      '<button class="bt bsm kjp-pilot-set-custom">设</button></div>';
    if (draft.pilotCandidates && draft.pilotCandidates.length) {
      html += '<div class="kjp-row">LLM 推荐 (' + (draft.pilotCandidates[0]._source || '?') + ')·</div>';
      draft.pilotCandidates.forEach(function(c, i) {
        html += '<div class="kjp-pilot-cand" data-idx="' + i + '">' +
          '<button class="bt bsm kjp-pilot-pick" data-idx="' + i + '">选</button> ' +
          '<b>' + _escHtml(c.name) + '</b>·阻 ' + _escHtml(c.expectedResistance) + '·' +
          _escHtml(c.reason) +
          (c.historicalParallel ? '·<span class="kjp-muted">史·' + _escHtml(c.historicalParallel) + '</span>' : '') +
          '</div>';
      });
    }
    return html;
  }

  function _kjpRenderCourtMoodBody(draft) {
    var html = '';
    // M4·stale 警告·paradigm 已变·上次推算失效
    if (draft.courtMoodStale && draft.courtMoodNarrative) {
      html += '<div class="kjp-stale-warning">⚠️ paradigm 已变·上次推算已失效·请重算朝议</div>';
    }
    html += '<div class="kjp-row"><button class="bt bsm kjp-courtmood-llm-btn"' + (draft.courtMoodLoading ? ' disabled' : '') + '>' +
      (draft.courtMoodLoading ? '⏳ 推算中...' : (draft.courtMoodStale && draft.courtMoodNarrative ? '▶ 重算朝议 (paradigm 已变)' : '▶ LLM 朝议预判 (古文 narrative)')) + '</button> ' +
      '<span class="kjp-muted">每改 paradigm·建议重新推算</span></div>';
    if (draft.courtMoodNarrative && !draft.courtMoodStale) {
      html += '<div class="kjp-courtmood-narrative">' + _escHtml(draft.courtMoodNarrative) + '</div>';
      html += '<div class="kjp-courtmood-meta">' +
        // R6·M4·label 修·>=60="已过门槛 (info)"·<60="差 N%·宜召对"·明显是支持度·非阻力
        '朝议支持度 (内部·非显玩家) <b>' + draft.courtMoodScale + '/100</b>·' +
        '门槛 60/100·' +
        (draft.courtMoodScale >= 60 ? '<span class="kjp-info">已过门槛</span>' :
                                       '<span class="kjp-warning">差 ' + (60 - draft.courtMoodScale) + '%·宜先召对斡旋</span>') +
        '</div>';
      if (draft.courtMoodKeyNpcs && draft.courtMoodKeyNpcs.length) {
        // B5·filter 不存 NPC·防点 key-npc 后 audience LLM toast 未找到
        var validNpcs = draft.courtMoodKeyNpcs.filter(function(n) {
          return (typeof findCharByName === 'function') ? !!findCharByName(n) : true;
        });
        if (validNpcs.length) {
          html += '<div class="kjp-row">关键人物·' + validNpcs.map(function(n) {
            return '<button class="bt bsm kjp-key-npc" data-npc="' + _escHtml(n) + '">' + _escHtml(n) + '</button>';
          }).join(' ') + '</div>';
        }
      }
    } else if (draft.courtMoodNarrative && draft.courtMoodStale) {
      html += '<div class="kjp-courtmood-narrative kjp-muted">' + _escHtml(draft.courtMoodNarrative) + '</div>';
      html += '<div class="kjp-muted">(上述已失效·请重算)</div>';
    } else {
      html += '<div class="kjp-muted">尚未推算·点 LLM 朝议预判·读 GM.parties + paradigmDiff 算</div>';
    }
    return html;
  }

  function _kjpRenderAudienceBody(draft) {
    var html = '<div class="kjp-row">召对·选 NPC + 意图·LLM 模拟反应 + cost 推算</div>';
    // M8·datalist autocomplete·朝中名臣·上限 100 防膨胀
    var aliveChars = (typeof GM !== 'undefined' && Array.isArray(GM.chars))
      ? GM.chars.filter(function(c) { return c && c.name && c.alive !== false; }).slice(0, 100)
      : [];
    html += '<datalist id="kjp-npc-list">' +
      aliveChars.map(function(c) {
        var label = c.officialTitle ? (c.name + '·' + c.officialTitle) : c.name;
        return '<option value="' + _escHtml(c.name) + '" label="' + _escHtml(label) + '">';
      }).join('') +
      '</datalist>';
    html += '<div class="kjp-row">' +
      '<input list="kjp-npc-list" type="text" class="kjp-audience-npc" placeholder="NPC 姓名·输/选" style="width:200px"> ' +
      '<select class="kjp-audience-intent">' +
      '<option value="lure">拉拢支持</option>' +
      '<option value="pressure">威胁退让</option>' +
      '<option value="probe">探口风</option>' +
      '</select> ' +
      '<button class="bt bsm kjp-audience-btn"' + (draft.audienceLoading ? ' disabled' : '') + '>' +
      (draft.audienceLoading ? '⏳ 召对中...' : '▶ 召对·LLM') +
      '</button>' +
      '</div>';
    if (draft.privateAudiences && draft.privateAudiences.length) {
      html += '<div class="kjp-row"><b>历次召对·</b></div>';
      draft.privateAudiences.slice().reverse().forEach(function(a, i) {
        // R6·D1·失败 entry 给独立 css class + ⚠️ 前缀·user 一眼区分
        // R6·D2·防 supportDelta undefined·parseInt 兜底
        var failed = !!a.failed;
        var sd = parseInt(a.supportDelta, 10) || 0;
        var rowClass = 'kjp-audience-record' + (failed ? ' kjp-audience-failed' : '');
        var failPrefix = failed ? '⚠️ ' : '';
        html += '<div class="' + rowClass + '">' +
          '<div>' + failPrefix + '<b>' + _escHtml(a.npc) + '</b>·' + _escHtml(a.intent === 'lure' ? '拉拢' : a.intent === 'pressure' ? '威胁' : '探口风') +
          '·支持 ' + (sd >= 0 ? '+' : '') + sd + '</div>' +
          '<div class="kjp-audience-speech">"' + _escHtml(a.speech || '') + '"</div>' +
          (a.offerTerms ? '<div class="kjp-muted">条件·' + _escHtml(a.offerTerms) + '</div>' : '') +
          (failed ? '' : (a.costApplied ? '<div class="kjp-muted">cost·' + _escHtml(JSON.stringify(a.cost || {})) + '</div>' : '<div class="kjp-muted">cost·未应用</div>')) +
          '</div>';
      });
    }
    return html;
  }

  // ════════════════════════════════════════════════════════════════
  // L4·b·召史策对·dropdown + 按钮 + 历次策对 timeline (复用 ChronicleTracker)
  // ════════════════════════════════════════════════════════════════

  function _kjpRenderCeduiBody(draft) {
    var advisors = (typeof _kjpListForecastAdvisors === 'function') ? _kjpListForecastAdvisors() : [];
    if (!advisors.length) {
      return '<div class="kjp-muted">京中无可召策对的史官/翰林/老臣·扩文官后再策对</div>';
    }
    var html = '<div class="kjp-row kjp-muted">借密召史官策问改革 5-10 年后效·按 8 派 archetype voice 答策·走问对机制·5 精力/次</div>';
    html += '<div class="kjp-row">';
    html += '<select class="kjp-cedui-advisor" style="width:240px">';
    html += '<option value="">(选 advisor)</option>';
    advisors.forEach(function(c) {
      var arch = (typeof _kjpInferAdvisorArchetype === 'function') ? _kjpInferAdvisorArchetype(c) : 'A3_pragmatic';
      var label = (typeof ARCHETYPE_LABELS === 'object' && ARCHETYPE_LABELS[arch]) ? ARCHETYPE_LABELS[arch] : '务实派';
      var rep = c._forecastReputation;
      // RZ·Z1·chip 加 reputation label (new/unaudited/reliable/mixed/unreliable)·让 user 看出区别
      // RZ·Z4·"(新)" 标新人
      var repTag;
      if (rep && rep.totalForecasts > 0) {
        var repLabel = rep.reputation || 'unaudited';
        repTag = '·言中 ' + (rep.accurateForecasts || 0) + '/' + rep.totalForecasts +
                 ' (' + (rep.averageScore || 0) + '·' + repLabel + ')';
      } else {
        repTag = '·言中 ?/0 (新)';
      }
      html += '<option value="' + _escHtml(c.name) + '">' + _escHtml(c.name) + '·' + label + repTag + '</option>';
    });
    html += '</select> ';
    html += '<button class="bt bsm kjp-cedui-btn" data-cedui-btn>▶ 召 advisor 策对 (5 精力)</button>';
    html += '</div>';
    // 历次策对 timeline (复用 ChronicleTracker)·RX·A4·传 draft 算 stale·L4·f2·modal 给对比 view 用
    var _modal = (typeof document !== 'undefined') ? document.getElementById('kjp-reform-modal') : null;
    html += _kjpRenderCeduiTimeline(draft, _modal);
    // L5·d·改革反对奏疏 chip + 跳百官奏疏 link
    html += _kjpRenderReformObjectionChip();
    return html;
  }

  // L5·d·改革反对奏疏 chip·链接到「百官奏疏」main UI·non-new modal
  // RAA·A1·onclick fallback toast / A2·useNewKejuL5=false 提示
  function _kjpRenderReformObjectionChip() {
    var memorials = [];
    try {
      if (typeof GM !== 'undefined' && Array.isArray(GM.memorials)) {
        memorials = GM.memorials.filter(function(m) {
          return m && m.subtype === '改革反对' && m.status === 'pending';
        });
      }
    } catch(_){}
    // L5 默认开(gate `!== false`)·仅显式设 false 才算关。旧码此处多一层 `!` 反相→默认(开)也误显「需开 L5」·已修。
    var l5Off = !!(typeof P !== 'undefined' && P && P.conf && P.conf.useNewKejuL5 === false);
    if (!memorials.length) {
      var emptyText = l5Off
        ? '议政后·反对派可能上书 (需开 P.conf.useNewKejuL5)·入「百官奏疏」面板'
        : '议政后·反对派可能上书 (LLM 古文 200-400 字)·入「百官奏疏」面板';
      return '<div class="kjp-row kjp-muted">' + emptyText + '</div>';
    }
    // RAA·A1·onclick·若 module 名错 / bridge 未载·toast 提示·非 silent fail
    var jumpExpr = '(function(){' +
      'try{' +
        'if(window.TMPhase8FormalBridge && typeof TMPhase8FormalBridge.openModule==="function"){' +
          'TMPhase8FormalBridge.openModule("memorial");' +
        '}else if(typeof toast==="function"){' +
          'toast("「百官奏疏」module 未载·请点主菜单进入");' +
        '}' +
      '}catch(e){if(typeof toast==="function") toast("跳转失败·请手动开「百官奏疏」");}' +
    '})();return false;';
    return '<div class="kjp-row"><b>反对奏疏·' + memorials.length + ' 条待批</b>·' +
           '<a href="#" onclick=\'' + jumpExpr.replace(/'/g, '&#39;') + '\'>→ 入百官奏疏批阅</a></div>';
  }

  // 复用 ChronicleTracker.list / GM._chronicleTracks·近 5 条
  // RX·A4·当前 paradigm 跟 entry sourceId 内 digest 不匹时·标 stale
  // L4·f1·timeline 含 kjp-cedui + kjp-multi-consult 两类·multi-consult 标 ⚖️
  // L4·f2·支持对比 view·若 modal._kjpCompareSelection 存·渲两列并排
  function _kjpRenderCeduiTimeline(draft, modal) {
    var tracks = [];
    if (typeof window !== 'undefined' && window.ChronicleTracker) {
      try {
        var raw = window.ChronicleTracker.listVisible
          ? window.ChronicleTracker.listVisible()
          : (window.GM && window.GM._chronicleTracks) || [];
        tracks = (raw || []).filter(function(t) {
          return t && (t.sourceType === 'kjp-cedui' || t.sourceType === 'kjp-multi-consult') && !t.hidden;
        });
      } catch(_){}
    }
    // RX·A3·空态文案改清楚
    if (!tracks.length) return '<div class="kjp-row kjp-muted">尚无策对·选 advisor 后点策对按钮</div>';
    // RZ·Z2·分类限·cedui top 3 + multi top 2·防 multi 挤掉 cedui 历史·混 sort 综合显
    var ceduiSorted = tracks.filter(function(t) { return t.sourceType === 'kjp-cedui'; })
                            .sort(function(a, b) { return (b.startTurn||0) - (a.startTurn||0); }).slice(0, 3);
    var multiSorted = tracks.filter(function(t) { return t.sourceType === 'kjp-multi-consult'; })
                            .sort(function(a, b) { return (b.startTurn||0) - (a.startTurn||0); }).slice(0, 2);
    tracks = ceduiSorted.concat(multiSorted)
                        .sort(function(a, b) { return (b.startTurn||0) - (a.startTurn||0); });
    // RX·A4·算当前 paradigm digest·跟 entry sourceId 比对
    var currentDigest = '';
    try {
      if (draft && typeof _kjpComputeDiff === 'function' && typeof _kjpSummarizeDiff === 'function') {
        // RY·B5·跟 sourceId 写入一致·slice 40·防前 20 字符 collision
        currentDigest = String(_kjpSummarizeDiff(_kjpComputeDiff(draft)) || '').slice(0, 40);
      }
    } catch(_){}
    // L4·f2·对比 view·若 modal._kjpCompareSelection 有 2 个 id·渲两列
    var compareSel = (modal && modal._kjpCompareSelection) || [];
    var compareView = '';
    if (compareSel.length === 2) {
      compareView = _kjpRenderCeduiCompare(compareSel, tracks);
    }
    var rows = tracks.map(function(t) {
      var isMulti = t.sourceType === 'kjp-multi-consult';
      var leaked = (t.narrative || '').indexOf('LEAKED') >= 0 ? ' <span class="kjp-bad">●泄</span>' : '';
      var multiTag = isMulti ? ' <span class="kjp-info">⚖️ 协商</span>' : '';
      // stale 仅 cedui·multi-consult 不算
      var staleClass = '';
      var staleTag = '';
      if (!isMulti && currentDigest && t.sourceId) {
        var parts = String(t.sourceId).split('_');
        // RY·B5·跟 sourceId 写入一致·slice 40
        var entryDigest = parts.length >= 3 ? parts.slice(2).join('_').slice(0, 40) : '';
        if (entryDigest && entryDigest !== currentDigest) {
          staleClass = ' kjp-cedui-stale';
          staleTag = ' <span class="kjp-muted">⚠️ paradigm 已变·此对策已 stale</span>';
        }
      }
      // L4·f2·对比按钮·仅 cedui 类可选 (multi-consult 不可对比)
      var compareBtn = isMulti ? '' :
        ' <button class="bt bsm kjp-cedui-compare-btn" data-track-id="' + _escHtml(t.id || '') + '">' +
        ((compareSel.indexOf(t.id) >= 0) ? '✓ 已选' : '+ 对比') + '</button>';
      return '<div class="kjp-cedui-row' + staleClass + '">T' + (t.startTurn || '?') + '·<b>' + _escHtml(t.actor || '?') + '</b>·' +
        _escHtml(String(t.title || '').slice(0, 50)) + leaked + multiTag + staleTag + compareBtn + '</div>';
    }).join('');
    return '<div class="kjp-row"><b>历次策对·</b>选 2 条 cedui 对比</div>' + rows + compareView;
  }

  // L4·f2·对比 view·两列并排·读 wendui history 取 last cedui reply
  function _kjpRenderCeduiCompare(compareIds, allTracks) {
    if (!compareIds || compareIds.length !== 2) return '';
    var t1 = allTracks.find(function(t) { return t.id === compareIds[0]; });
    var t2 = allTracks.find(function(t) { return t.id === compareIds[1]; });
    if (!t1 || !t2) return '';
    var npc1 = t1.actor;
    var npc2 = t2.actor;
    var GM_ = (typeof GM !== 'undefined') ? GM : (typeof window !== 'undefined' ? window.GM : null);
    var hist1 = (GM_ && GM_.wenduiHistory && GM_.wenduiHistory[npc1]) || [];
    var hist2 = (GM_ && GM_.wenduiHistory && GM_.wenduiHistory[npc2]) || [];
    // 取 last cedui npc reply
    var reply1 = '';
    for (var i = hist1.length - 1; i >= 0; i--) { var m = hist1[i]; if (m && m.role === 'npc' && m.mode === 'cedui') { reply1 = m.content; break; } }
    var reply2 = '';
    for (var j = hist2.length - 1; j >= 0; j--) { var n = hist2[j]; if (n && n.role === 'npc' && n.mode === 'cedui') { reply2 = n.content; break; } }
    return '<div class="kjp-cedui-compare">' +
      '<div class="kjp-cedui-compare-col">' +
        '<div class="kjp-cedui-compare-head"><b>' + _escHtml(npc1) + '</b>·T' + (t1.startTurn || '?') + '</div>' +
        '<div class="kjp-cedui-compare-body">' + _escHtml(String(reply1).slice(0, 300) || '(无 cedui reply)') + '</div>' +
      '</div>' +
      '<div class="kjp-cedui-compare-col">' +
        '<div class="kjp-cedui-compare-head"><b>' + _escHtml(npc2) + '</b>·T' + (t2.startTurn || '?') + '</div>' +
        '<div class="kjp-cedui-compare-body">' + _escHtml(String(reply2).slice(0, 300) || '(无 cedui reply)') + '</div>' +
      '</div>' +
      '<div class="kjp-row"><button class="bt bsm kjp-cedui-compare-clear">清对比</button></div>' +
      '</div>';
  }

  // L4·b·invoker·点按钮调·archetype 派 → set draft → openWenduiModal('cedui', prefill)
  function _kjpInvokeCedui(modal, advisorName) {
    if (typeof openWenduiModal !== 'function') {
      try { if (typeof toast === 'function') toast('⚠️ wendui 问对系统未载·无法策对'); } catch(_){}
      return;
    }
    // RX·B1·防双击 race·已开 wendui modal 时拒新 call·防 DOM id collision + globals 覆
    try {
      if (typeof document !== 'undefined' && document.getElementById('wendui-modal')) {
        if (typeof toast === 'function') toast('⏳ 问对已开·关后再召');
        return;
      }
    } catch(_){}
    var draft = modal._kjpDraft;
    if (!draft) return;
    var npc = (typeof findCharByName === 'function') ? findCharByName(advisorName) : null;
    if (!npc) {
      try { if (typeof toast === 'function') toast('⚠️ 未找到 NPC·' + advisorName); } catch(_){}
      return;
    }
    var arch = (typeof _kjpInferAdvisorArchetype === 'function')
      ? _kjpInferAdvisorArchetype(npc)
      : 'A3_pragmatic';
    var prefill = (typeof _kjpBuildCeduiPrefill === 'function')
      ? _kjpBuildCeduiPrefill(npc, arch, draft)
      : '【陛下密召】改革议·请略陈对策。';

    // L4·a·set global·wendui prompt builder + close hook 可读
    try {
      window._kjpCurrentCeduiDraft = draft;
      var diff = (typeof _kjpComputeDiff === 'function') ? _kjpComputeDiff(draft) : null;
      window._kjpCurrentCeduiDiff = diff;
      window._kjpCurrentCeduiDigest = (typeof _kjpSummarizeDiff === 'function' && diff)
        ? _kjpSummarizeDiff(diff)
        : '';
      window._kjpCurrentCeduiArchetype = arch;
      // RZ·Z8·_kjpCurrentCeduiNpcName 删·hook 参数已带 npcName
    } catch(_){}

    // L4·b·call wendui (mode='cedui'·prefill 预填消息)
    try {
      openWenduiModal(advisorName, 'cedui', prefill);
    } catch (e) {
      try { console.warn('[L4·b] openWenduiModal fail', e); } catch(_){}
    }
  }

  // -------- 题目层 --------
  function _kjpRenderSubjectsBody(draft) {
    var html = '<div class="kjp-subjects-list">';
    draft.subjectsDraft.forEach(function(s, i) {
      html += '<div class="kjp-subject-row" data-idx="' + i + '">' +
        '<span class="kjp-subject-name">' + _escHtml(s.name) +
        ' <span class="kjp-muted">[' + _escHtml(s.ideology || '') + ']</span></span>' +
        '<input type="range" min="0" max="100" value="' + (s.weight || 0) + '" class="kjp-subject-weight" data-idx="' + i + '"> ' +
        '<span class="kjp-subject-weight-val">' + (s.weight || 0) + '%</span> ' +
        '<button class="bt bsm kjp-subject-del" data-idx="' + i + '">删</button>' +
        '</div>';
    });
    html += '</div><div class="kjp-add-subject-row">' +
      '<select class="kjp-add-subject-select">' +
      '<option value="">+ 加新题目 (8 候选·L6 ship 后 LLM 推荐)</option>';
    SUBJECT_CANDIDATES.forEach(function(c) {
      if (!draft.subjectsDraft.some(function(s) { return s.id === c.id; })) {
        html += '<option value="' + c.id + '">' + _escHtml(c.name) + ' (' + _escHtml(c.format) + '·' + c.ideology + ')</option>';
      }
    });
    html += '</select><button class="bt bsm kjp-add-subject-btn">加</button></div>';
    // L6·c·LLM 推荐 + 自定义新 subject (flag gate useNewKejuL6)
    html += _kjpRenderL6SubjectActions(draft);
    // L10·历史模板 button (flag gate useNewKejuL10)
    html += _kjpRenderL10PresetAction(draft);
    return html;
  }

  // L10·历史模板 button·跟 L6 button 同 row paradigm
  function _kjpRenderL10PresetAction(draft) {
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL10 === false) return '';
    if (typeof L10_PRESETS === 'undefined') return '';
    var l10Mark = draft && draft._l10PresetId
      ? ' <span class="kjp-l10-marked">📜 已 fill·' + _escHtml(draft._l10PresetCanonicalName || '') + '</span>'
      : '';
    return '<div class="kjp-row kjp-l10-actions">' +
      '<button class="bt bsm kjp-l10-open-btn" title="按朝代见 13+ 历史改革·一键 fill">' +
        '📜 历史模板 (' + L10_PRESETS.length + ' 真历史)' + '</button>' +
      l10Mark +
      '</div>';
  }

  // L6·c·LLM 推荐 + 自定义新 subject·UI
  // RAA·A1·flag off hint·A2·console.warn debug·A4·LLM 返空字段 placeholder
  function _kjpRenderL6SubjectActions(draft) {
    // RAA·A1·flag off·显 hint·非 silent hide·user 知 feature 存在 + 怎么开
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL6 === false) {
      try { console.warn('[L6] disabled·set P.conf.useNewKejuL6=true to enable LLM 推荐 / 自定义新 subject'); } catch(_){}
      return '<div class="kjp-row kjp-muted kjp-l6-disabled-hint">▶ LLM 推荐 / 自定义新科·需开 P.conf.useNewKejuL6 (设置面板)</div>';
    }
    return '<div class="kjp-row kjp-l6-actions">' +
      '<button class="bt bsm kjp-l6-suggest-btn"' + (draft.l6Loading ? ' disabled' : '') + '>' +
        (draft.l6Loading ? '⏳ LLM 推荐中...' : '▶ LLM 推荐 5 个新科 (按朝代 + 现状)') + '</button> ' +
      '<button class="bt bsm kjp-l6-custom-btn"' + (draft.l6Loading ? ' disabled' : '') + '>' +
        (draft.l6Loading ? '...' : '▶ 自定义新科 (LLM 合理化)') + '</button>' +
      '</div>' +
      _kjpRenderL6SuggestionsBody(draft);
  }

  function _kjpRenderL6SuggestionsBody(draft) {
    var suggestions = draft.l6Suggestions || [];
    if (!suggestions.length) return '';
    // RAA·A3·若 count<推荐·不 mislead·正确显示实际数
    var html = '<div class="kjp-l6-suggestions"><b>LLM 推荐·' + suggestions.length + ' 候选</b>·点击 + 加入草案·</div>';
    var accepted = draft._l6AcceptedIds || {};
    suggestions.forEach(function(s, i) {
      // RAA·A4·空字段 placeholder·避空白
      var idLabel = _escHtml(s.ideology || '未标');
      var analog = _escHtml(s.historicalAnalog || '(未提供出处)');
      var format = _escHtml(s.format || '(未提供考法)');
      var rationale = _escHtml(s.rationale || '(LLM 未提供推荐理由)');
      // RBB·BB-C1·已 accept 标记·button 显 "✓ 已加入" disabled·非 silent dedup
      var isAccepted = accepted[s.id] === true;
      var btnHtml = isAccepted
        ? '<button class="bt bsm kjp-l6-accept-btn" data-idx="' + i + '" disabled>✓ 已加入</button>'
        : '<button class="bt bsm kjp-l6-accept-btn" data-idx="' + i + '">+ 加入草案</button>';
      html += '<div class="kjp-l6-suggestion-card' + (isAccepted ? ' kjp-l6-accepted' : '') + '">' +
        '<div><b>' + _escHtml(s.name) + '</b>·权重 ' + s.weight +
          '·<span class="kjp-info">' + idLabel + '</span>' +
          ' <span class="kjp-muted">· ' + analog + '</span></div>' +
        '<div class="kjp-l6-format">' + format + '</div>' +
        '<div class="kjp-rationale">' + rationale + '</div>' +
        btnHtml +
        '</div>';
    });
    return html;
  }

  // -------- tier 层 --------
  function _kjpRenderTierBody(draft) {
    var tiers = (draft.tiersDraft || []).map(function(t) { return _escHtml(t.name); }).join(' → ');
    return '<div class="kjp-row"><span>当前 tier 流·</span><span class="kjp-tiers-display">' + (tiers || '(无)') + '</span></div>' +
      '<div class="kjp-row"><span>考试间隔 (examInterval) ·</span>' +
      '<input type="number" class="kjp-exam-interval" value="' + (draft.examIntervalDraft || 0) + '" min="0" max="20"> 年/科 ' +
      '<span class="kjp-muted">(0=不定期·1=岁举·3=三年一科)</span></div>' +
      '<div class="kjp-row"><span>加试政策 (retakePolicy)·</span>' +
      '<select class="kjp-retake-policy">' +
      RETAKE_OPTIONS.map(function(v) { return '<option value="' + v + '"' + (draft.retakePolicyDraft===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>' +
      '<p class="kjp-muted">tier 加/删 暂不支持·v3 sliced (L3)</p>';
  }

  // -------- 考生层 --------
  function _kjpRenderCandidateBody(draft) {
    var d = draft.candidateRulesDraft;
    var exClasses = d.excludedClasses || [];
    var hasClass = function(c) { return exClasses.indexOf(c) >= 0; };
    return '<div class="kjp-row">' +
      '<label><input type="checkbox" class="kjp-cand-allow-foreigner" ' + (d.allowForeigner?'checked':'') + '> 准外族 (宾贡)</label> ' +
      '<label><input type="checkbox" class="kjp-cand-allow-minority" ' + (d.allowMinority?'checked':'') + '> 准少数民族</label> ' +
      '<label><input type="checkbox" class="kjp-cand-require-prefecture" ' + (d.requirePrefecture?'checked':'') + '> 需户籍</label> ' +
      '<label><input type="checkbox" class="kjp-cand-require-rec" ' + (d.requireRecommendation?'checked':'') + '> 需保举</label>' +
      '</div>' +
      '<div class="kjp-row">年龄范围·' +
      '<input type="number" class="kjp-cand-min-age" value="' + (d.minAge || 0) + '" min="0" max="100"> ~ ' +
      '<input type="number" class="kjp-cand-max-age" value="' + (d.maxAge || 0) + '" min="0" max="120"> 岁</div>' +
      '<div class="kjp-row">考费来源·' +
      '<select class="kjp-cand-fee">' +
      FEE_REIMBURSEMENT_OPTIONS.map(function(v) { return '<option value="' + v + '"' + (d.feeReimbursement===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kjp-row">排除阶层 (excludedClasses)·当前·<span class="kjp-classes-list">' +
      _escHtml(exClasses.join('、') || '(无)') + '</span></div>' +
      '<div class="kjp-row">' +
      (function() {
        // A3 修·hardcode 7 类 + dynamic (任何已 excluded 但不在 hardcode 的)
        var hardcode = ['僧道', '商贾子', '女子', '倡优', '罪人', '匠户', '皂吏'];
        var dynamic = (exClasses || []).filter(function(c) { return hardcode.indexOf(c) < 0; });
        var all = hardcode.concat(dynamic);
        return all.map(function(c) {
          return '<button class="bt bsm kjp-class-toggle" data-class="' + _escHtml(c) + '">' + (hasClass(c)?'准':'禁') + _escHtml(c) + '</button>';
        }).join(' ');
      })() + '</div>';
  }

  // -------- 主考层 --------
  function _kjpRenderExaminerBody(draft) {
    var d = draft.examinerRulesDraft;
    var av = d.avoidanceRules || {};
    var hasType = function(t) { return (d.type || []).indexOf(t) >= 0; };
    return '<div class="kjp-row">主考资格·' +
      EXAMINER_TYPE_OPTIONS.map(function(t) {
        return '<label><input type="checkbox" class="kjp-ex-type" data-type="' + t + '" ' + (hasType(t)?'checked':'') + '> ' + t + '</label>';
      }).join(' ') + '</div>' +
      '<div class="kjp-row">最低任职年限·' +
      '<input type="number" class="kjp-ex-min-years" value="' + (d.minYears || 0) + '" min="0" max="50"> 年</div>' +
      '<div class="kjp-row">' +
      '<label><input type="checkbox" class="kjp-ex-blind-scoring" ' + (d.blindScoring?'checked':'') + '> 糊名</label> ' +
      '<label><input type="checkbox" class="kjp-ex-blind-copying" ' + (d.blindCopying?'checked':'') + '> 誊录</label></div>' +
      '<div class="kjp-row">回避制度·' +
      '<label><input type="checkbox" class="kjp-ex-avoid" data-key="avoid_kin" ' + (av.avoid_kin?'checked':'') + '> 避亲</label> ' +
      '<label><input type="checkbox" class="kjp-ex-avoid" data-key="avoid_native" ' + (av.avoid_native?'checked':'') + '> 避籍</label> ' +
      '<label><input type="checkbox" class="kjp-ex-avoid" data-key="avoid_disciple" ' + (av.avoid_disciple?'checked':'') + '> 避门生</label> ' +
      '<label><input type="checkbox" class="kjp-ex-avoid" data-key="avoid_recent" ' + (av.avoid_recent?'checked':'') + '> 避近期</label> ' +
      '<label><input type="checkbox" class="kjp-ex-avoid" data-key="avoid_party" ' + (av.avoid_party?'checked':'') + '> 避同党</label> ' +
      '<label><input type="checkbox" class="kjp-ex-avoid" data-key="avoid_age" ' + (av.avoid_age?'checked':'') + '> 避年齿</label></div>' +
      '<div class="kjp-row">监察等级·' +
      '<select class="kjp-ex-inspection">' +
      INSPECTION_LEVEL_OPTIONS.map(function(v) { return '<option value="' + v + '"' + (d.inspectionLevel===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kjp-row">主考门生关系 (mentorBondStrength)·' +
      '<select class="kjp-ex-mentor-bond">' +
      ['strong', 'weak', 'none', 'collective'].map(function(v) { return '<option value="' + v + '"' + (d.mentorBondStrength===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kjp-row">泄题惩罚 (leakPenalty)·' +
      '<select class="kjp-ex-leak-penalty">' +
      PENALTY_OPTIONS.map(function(v) { return '<option value="' + v + '"' + (d.leakPenalty===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>';
  }

  // -------- 录取层 --------
  function _kjpRenderQuotaBody(draft) {
    var q = draft.quotaDraft;
    var ratios = q.ratios || {};
    var html = '<div class="kjp-row">录取总数·' +
      '<input type="number" class="kjp-quota-total" value="' + (q.total || 0) + '" min="0" max="9999"> 人</div>' +
      '<div class="kjp-row">排名规则 (rankingRule)·' +
      '<select class="kjp-ranking-rule">' +
      RANKING_RULE_OPTIONS.map(function(v) { return '<option value="' + v + '"' + (draft.rankingRuleDraft===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>';
    ['geo', 'class', 'party', 'prefecture', 'minority'].forEach(function(k) {
      var r = ratios[k] || { enabled: false, values: {} };
      html += '<div class="kjp-row kjp-quota-ratio" data-dim="' + k + '">' +
        '<label><input type="checkbox" class="kjp-quota-enabled" data-dim="' + k + '" ' + (r.enabled?'checked':'') + '> 启用 ' + k + ' 分卷</label> ' +
        '<input type="text" class="kjp-quota-values" data-dim="' + k + '" value="' +
        _escHtml(JSON.stringify(r.values || {})) +
        '" placeholder=\'{"南":55,"北":35,"中":10}\' style="width:280px;font-family:monospace;font-size:0.8rem">' +
        '</div>';
    });
    return html;
  }

  // -------- 授官层 --------
  function _kjpRenderAllocationBody(draft) {
    var a = draft.allocationRulesDraft || {};
    var renderClass = function(key, label) {
      var c = a[key] || {};
      return '<div class="kjp-alloc-class">' +
        '<span class="kjp-alloc-label">' + label + '·</span>' +
        '人数·<input type="number" class="kjp-alloc-count" data-class="' + key + '" value="' + (c.count || 0) + '" min="0" max="999"> ' +
        '位置·<input type="text" class="kjp-alloc-positions" data-class="' + key + '" value="' + _escHtml((c.positions || []).join(',')) + '" placeholder="翰林,六部" style="width:160px"> ' +
        '</div>';
    };
    return renderClass('firstClass', '一甲 (状元/榜眼/探花)') +
      renderClass('secondClass', '二甲') +
      renderClass('thirdClass', '三甲') +
      '<div class="kjp-row">候补年数 (waitingYears)·' +
      '<input type="number" class="kjp-alloc-waiting" value="' + (a.waitingYears || 0) + '" min="0" max="20"></div>' +
      '<div class="kjp-row">' +
      '<label><input type="checkbox" class="kjp-alloc-imp-review" ' + (a.imperialReviewRequired?'checked':'') + '> 需御审 (imperialReviewRequired)</label> ' +
      '<label><input type="checkbox" class="kjp-alloc-post-adj" ' + (a.posthumousAdjustment?'checked':'') + '> 死后可调 (posthumousAdjustment·改革者门生重排)</label></div>';
  }

  // -------- 身份层 --------
  function _kjpRenderIdentityBody(draft) {
    return '<div class="kjp-row">进士头衔 (graduateTitle)·' +
      '<input type="text" class="kjp-id-graduate-title" value="' + _escHtml(draft.graduateTitleDraft || '') + '" placeholder="进士/学士/童子郎/等"></div>' +
      '<div class="kjp-row">同年关系强度 (cohortBondStrength)·' +
      '<select class="kjp-id-cohort-bond">' +
      ['strong', 'weak', 'none'].map(function(v) { return '<option value="' + v + '"' + (draft.cohortBondStrengthDraft===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kjp-row">' +
      '<label><input type="checkbox" class="kjp-id-mentor-lineage" ' + (draft.mentorLineageDraft?'checked':'') + '> 主考-门生 lineage 记录 (mentorLineage)</label></div>';
  }

  // -------- 联动层 --------
  function _kjpRenderLinkageBody(draft) {
    var tp = draft.taxPrivilegeDraft || {};
    return '<div class="kjp-row">学制·' +
      '<select class="kjp-lk-school-int">' +
      ['required', 'optional', 'none', 'alternative'].map(function(v) { return '<option value="' + v + '"' + (draft.schoolIntegrationDraft===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kjp-row">免赋·' +
      '<label><input type="checkbox" class="kjp-lk-tax-jinshi" ' + (tp.jinshi?'checked':'') + '> 进士免赋</label> ' +
      '<label><input type="checkbox" class="kjp-lk-tax-juren" ' + (tp.juren?'checked':'') + '> 举人免赋</label> ' +
      '<label><input type="checkbox" class="kjp-lk-tax-xiucai" ' + (tp.xiucai?'checked':'') + '> 秀才免役</label></div>' +
      '<div class="kjp-row">荫子荫孙 (shadow)·' +
      '<select class="kjp-lk-shadow">' +
      ['high', 'low', 'none'].map(function(v) { return '<option value="' + v + '"' + (draft.shadowDraft===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kjp-row">' +
      '<label><input type="checkbox" class="kjp-lk-clan-priv" ' + (draft.clanPrivilegeDraft?'checked':'') + '> 宗族特权 (clanPrivilege)</label></div>';
  }

  // -------- 仪轨层 --------
  function _kjpRenderCeremonyBody(draft) {
    var c = draft.ceremonyDraft || {};
    return '<div class="kjp-row">殿试形式 (palaceTest)·' +
      '<input type="text" class="kjp-cer-palace-test" value="' + _escHtml(c.palaceTest || '') + '" placeholder="御前策问"></div>' +
      '<div class="kjp-row">放榜形式 (rosterRelease)·' +
      '<input type="text" class="kjp-cer-roster" value="' + _escHtml(c.rosterRelease || '') + '" placeholder="黄榜张挂"></div>' +
      '<div class="kjp-row">' +
      '<label><input type="checkbox" class="kjp-cer-flower-riding" ' + (c.flowerRiding?'checked':'') + '> 簪花跨马</label> ' +
      '<label><input type="checkbox" class="kjp-cer-name-stele" ' + (c.nameStele?'checked':'') + '> 进士题名碑</label> ' +
      '<label><input type="checkbox" class="kjp-cer-banquet" ' + (c.bondingBanquet?'checked':'') + '> 琼林宴</label></div>' +
      '<div class="kjp-row">谢恩叩拜数 (kowtowRound)·' +
      '<input type="number" class="kjp-cer-kowtow" value="' + (c.kowtowRound || 0) + '" min="0" max="20"></div>';
  }

  // -------- 惩罚层 --------
  function _kjpRenderPenaltyBody(draft) {
    var p = draft.penaltiesDraft || {};
    var renderPen = function(key, label) {
      return '<div class="kjp-row">' + label + '·' +
        '<select class="kjp-pen-' + key + '">' +
        PENALTY_OPTIONS.map(function(v) { return '<option value="' + v + '"' + (p[key]===v?' selected':'') + '>' + v + '</option>'; }).join('') +
        '</select></div>';
    };
    return renderPen('cheating', '舞弊 (cheating)') +
      renderPen('leak', '泄题 (leak)') +
      renderPen('taboo', '违讳 (taboo)') +
      renderPen('bribery', '贿赂 (bribery)');
  }

  // -------- 语言 + 元 --------
  function _kjpRenderLangMetaBody(draft) {
    return '<div class="kjp-row">考试语言 (language)·' +
      '<input type="text" class="kjp-lm-language" value="' + _escHtml(draft.languageDraft || '') + '" placeholder="classical_chinese / classical_chinese+manchu / 自定" style="width:280px"></div>' +
      '<div class="kjp-row">ideology·' +
      '<select class="kjp-lm-ideology">' +
      ['traditional', 'reformist', 'practical', 'modern'].map(function(v) { return '<option value="' + v + '"' + (draft.ideologyDraft===v?' selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div>';
  }

  // ── 导出（origin alias 块逐名回绑）──
  if (!global.TM) global.TM = {};
  if (!global.TM.Keju) global.TM.Keju = {};
  global.TM.Keju.ParadigmPanelRender = {
    _kjpRenderProposalHtml: _kjpRenderProposalHtml,
    _kjpRenderSection: _kjpRenderSection,
    _kjpRenderMagnitudeBody: _kjpRenderMagnitudeBody,
    _kjpRenderPilotBody: _kjpRenderPilotBody,
    _kjpRenderCourtMoodBody: _kjpRenderCourtMoodBody,
    _kjpRenderAudienceBody: _kjpRenderAudienceBody,
    _kjpRenderCeduiBody: _kjpRenderCeduiBody,
    _kjpRenderReformObjectionChip: _kjpRenderReformObjectionChip,
    _kjpRenderCeduiTimeline: _kjpRenderCeduiTimeline,
    _kjpRenderCeduiCompare: _kjpRenderCeduiCompare,
    _kjpInvokeCedui: _kjpInvokeCedui,
    _kjpRenderSubjectsBody: _kjpRenderSubjectsBody,
    _kjpRenderL10PresetAction: _kjpRenderL10PresetAction,
    _kjpRenderL6SubjectActions: _kjpRenderL6SubjectActions,
    _kjpRenderL6SuggestionsBody: _kjpRenderL6SuggestionsBody,
    _kjpRenderTierBody: _kjpRenderTierBody,
    _kjpRenderCandidateBody: _kjpRenderCandidateBody,
    _kjpRenderExaminerBody: _kjpRenderExaminerBody,
    _kjpRenderQuotaBody: _kjpRenderQuotaBody,
    _kjpRenderAllocationBody: _kjpRenderAllocationBody,
    _kjpRenderIdentityBody: _kjpRenderIdentityBody,
    _kjpRenderLinkageBody: _kjpRenderLinkageBody,
    _kjpRenderCeremonyBody: _kjpRenderCeremonyBody,
    _kjpRenderPenaltyBody: _kjpRenderPenaltyBody,
    _kjpRenderLangMetaBody: _kjpRenderLangMetaBody,
    SUBJECT_CANDIDATES: SUBJECT_CANDIDATES,
    PENALTY_OPTIONS: PENALTY_OPTIONS,
    EXAMINER_TYPE_OPTIONS: EXAMINER_TYPE_OPTIONS,
    INSPECTION_LEVEL_OPTIONS: INSPECTION_LEVEL_OPTIONS,
    RANKING_RULE_OPTIONS: RANKING_RULE_OPTIONS,
    FEE_REIMBURSEMENT_OPTIONS: FEE_REIMBURSEMENT_OPTIONS,
    RETAKE_OPTIONS: RETAKE_OPTIONS,
    RESTORATION_DYNASTIES: RESTORATION_DYNASTIES,
    MAGNITUDE_PRESETS: MAGNITUDE_PRESETS,
  };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

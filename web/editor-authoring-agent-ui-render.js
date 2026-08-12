// @ts-check
// ═══ 巨石拆分(20260706·第十八拆)：渲染族(transcript/diff/结果)迁出 editor-authoring-agent-ui.js ═══
// 装载序契约(见 lint-split-contracts)：render 在 origin【之后】装载(icons→origin→render)。
//   render 是纯消费+发布者：静态别名读 origin(ui/esc/_md/_mdLine/_streamThenLink/rememberConvention/_logScrollMaybe)
//   + icons(_icon/_TOOL_ICON)·发布 render* 供 origin 反向 shim。ui 对象经 __aaUiParts.ui 共享(origin 先建·此处读同一引用·突变全域一致)。
(function(global) {
  'use strict';
  if (typeof document === 'undefined') return;
  var TM = global.TM = global.TM || {};
  var __aaU = TM.__aaUiParts = TM.__aaUiParts || {};   // dep-graph 可识别的 provide 形(TM.X=)
  var ui = __aaU.ui;   // origin(先装载)已建·共享同一引用
  var esc = __aaU.esc, _md = __aaU._md, _mdLine = __aaU._mdLine, _streamThenLink = __aaU._streamThenLink,
      rememberConvention = __aaU.rememberConvention, _logScrollMaybe = __aaU._logScrollMaybe,
      _icon = __aaU._icon, _TOOL_ICON = __aaU._TOOL_ICON;
  // 改动说明：把 agent 的 finish summary（做了什么+为什么）+ 计划备注醒目展示在 diff 之上；
  // 方向B · 若 agent 发现可长期沿用的约定，列出 + 给「记住」按钮（追加进持久 conventions）。
  function renderSummary(summary, notes, suggestions, stream) {
    if (!ui.els || !ui.els.summary) return;
    var s = (summary || '').trim();
    var sug = (suggestions || []).filter(Boolean);
    if (!s && (!notes || !notes.length) && !sug.length) { ui.els.summary.style.display = 'none'; return; }
    var html = '';
    if (s || (notes && notes.length)) {
      html += '<b>本次改动说明</b>' + (s ? _md(s) : '（agent 未给出说明）');
      if (notes && notes.length) {
        html += '<div class="note">思路：' + notes.slice(0, 4).map(function(n) { return esc(String(n).slice(0, 120)); }).join('；') + '</div>';
      }
    }
    if (sug.length) {
      html += '<div class="tm-aa-sug"><b>建议记住的约定</b>' + sug.slice(0, 5).map(function(c, i) {
        return '<div class="sug-row"><span>' + esc(String(c).slice(0, 120)) + '</span><button type="button" class="sug-keep" data-i="' + i + '">记住</button></div>';
      }).join('') + '</div>';
    }
    ui.els.summary.innerHTML = html;
    ui.els.summary.style.display = '';
    Array.prototype.forEach.call(ui.els.summary.querySelectorAll('.sug-keep'), function(btn) {
      btn.addEventListener('click', function() {
        var idx = +btn.getAttribute('data-i'), conv = sug[idx];
        if (conv && rememberConvention(conv)) {   // S9 · 记到本剧本层(CC 默认记进项目 CLAUDE.md 同款)
          btn.textContent = '已记住 ✓（本剧本）'; btn.disabled = true;
        }
      });
    });
    _streamThenLink(ui.els.summary, stream);   // UI·P 流式吐字 + UI·AH 实体 linkify
  }

  // UI·Z · 思考过程折叠块（Claude.ai「Thought for Ns」招牌）：把本轮 agent 的多段推理（onText·原来平铺 💭 行）
  //   收拢进一个默认收起的 <details>，标题显「💭 推理 N 步」并实时计数；点开看完整推理叙事。每轮(run)一个块。
  // UI·Z2 · 统一「执行过程」折叠块：本轮的推理 + 工具调用全收进同一个默认收起的 <details>
  //   （对齐 Claude 网页端折叠思考/工具调用）。点开看完整推理叙事 + 逐个工具卡。每轮(run)一个块。
  function _ensureExecBlock() {
    var blk = ui._thinkEl;
    if (!blk || !blk.isConnected) {
      if (ui.els) { ui.els.logSec.style.display = ''; ui.els.logWrap.style.display = ''; }
      blk = document.createElement('details');
      blk.className = 'tm-aa-think';
      blk.open = !!ui.running;   // 工作过程 · 运行中默认展开（实时看步骤流入）·收尾自动折叠
      blk.innerHTML = '<summary class="tm-aa-think-sum"><span class="tk-label">执行中…</span></summary><div class="tm-aa-think-body"></div>';
      if (ui.els) ui.els.log.appendChild(blk);
      ui._thinkEl = blk; ui._thinkCount = 0;
    }
    return blk;
  }
  // 工作过程 · 实时活动行：转环 + 当前动作/思考（贴在执行块下方·收尾移除）
  function _ensureLive() {
    if (!ui.running) return null;
    var lv = ui._liveEl;
    if (!lv || !lv.isConnected) {
      lv = document.createElement('div');
      lv.className = 'tm-aa-live';
      lv.innerHTML = '<span class="lv-spin"></span><span class="lv-tx">国师正在斟酌…</span>';
      if (ui.els) ui.els.log.appendChild(lv);
      ui._liveEl = lv;
    } else if (ui.els && ui.els.log.lastElementChild !== lv) {
      ui.els.log.appendChild(lv);   // 保持在流式尾部（执行块内新增步骤不影响·回应卡插入后仍殿后）
    }
    return lv;
  }
  function _setLive(text, isThink) {
    var lv = _ensureLive(); if (!lv) return;
    var tx = lv.querySelector('.lv-tx');
    if (tx) { tx.textContent = String(text || '').slice(0, 90); tx.classList.toggle('think', !!isThink); }
    _logScrollMaybe();
  }
  function _removeLive() {
    if (ui._liveEl) { try { ui._liveEl.remove(); } catch (e) {} ui._liveEl = null; }
  }
  function _bumpExecLabel(blk) {
    ui._thinkCount = (ui._thinkCount || 0) + 1;
    var lbl = blk.querySelector('.tk-label'); if (lbl) lbl.textContent = '执行过程 · ' + ui._thinkCount + ' 步';
  }
  function appendText(text, iter) {
    if (!ui.els || !text) return;
    var blk = _ensureExecBlock();
    var line = document.createElement('div');
    line.className = 'tk-line';
    line.textContent = String(text).slice(0, 400);
    blk.querySelector('.tm-aa-think-body').appendChild(line);
    _bumpExecLabel(blk);
    _setLive(String(text).slice(0, 90), true);   // 工作过程 · 最新思考进活动行（衬线斜体）
    _logScrollMaybe();
  }

  // 维度2 · 把工具调用 / diff 渲染成玩家看得懂的中文（rendering only · 两编辑器同享）。
  var _COLL_CN = { characters: '人物', factions: '势力', parties: '党派', classes: '阶层', items: '物品', events: '事件', families: '家族', cities: '城市', traitDefinitions: '特质', adminHierarchy: '行政区划', military: '军务', variables: '变量', relations: '关系', openingLetters: '开场信', government: '官制', officeTree: '官职树', officeConfig: '官制成本', goals: '目标' };
  function _shortVal(v) {
    if (v == null) return '空';
    if (typeof v === 'object') return String(v.name || v.id || v.title || (Array.isArray(v) ? (v.length + ' 项') : JSON.stringify(v))).slice(0, 40);
    return String(v).slice(0, 40);
  }
  function _friendlyPath(p) {
    var s = String(p || '');
    var top = s.split(/[.\[]/)[0];
    var rest = s.slice(top.length).replace(/^\./, '').replace(/\[(\d+)\]/g, '#$1').replace(/\./g, ' › ');
    return (_COLL_CN[top] || top) + (rest ? ' › ' + rest : '');
  }
  function _friendlyStep(step) {
    var n = step.name, i = step.input || {}, r = step.result || {};
    switch (n) {
      case 'applyEdit': return '改 ' + _friendlyPath(i.path) + ' ＝ ' + _shortVal(i.value);
      case 'getFields': return '查看 ' + ((i.paths || []).slice(0, 3).map(_friendlyPath).join('、') || '(多路径)') + ((i.paths || []).length > 3 ? ' 等 ' + i.paths.length + ' 处' : '');
      case 'applyPush': return '新增一项到 ' + (_COLL_CN[i.path] || _friendlyPath(i.path)) + '：' + _shortVal(i.value);
      case 'removeEntity': return '删除 ' + _friendlyPath(i.path);
      case 'getField': return '查看 ' + _friendlyPath(i.path);
      case 'searchEntities': return '搜索 ' + (_COLL_CN[i.collection] || i.collection || '') + (i.query ? '「' + i.query + '」' : '');
      case 'globalSearch': return '全局检索「' + (i.query || '') + '」' + (r.total != null ? '（命中 ' + r.total + '）' : '');
      case 'findReferences': return '查引用「' + (i.name || '') + '」' + (r.exactCount != null ? '（精确 ' + r.exactCount + '·提及 ' + (r.mentionCount || 0) + '）' : '');
      case 'renameEntity': return '✎ 改名「' + (i.oldName || '') + '」→「' + (i.newName || '') + '」' + (r.changed != null ? '（联动 ' + r.changed + ' 处）' : '');
      case 'listCollection': return '浏览 ' + (_COLL_CN[i.collection] || i.collection || '') + (r.count != null ? '（共 ' + r.count + '）' : '');
      case 'describeSchema': return '查字段形状 ' + (i.kind || '(全部)');
      case 'fieldContract': return '查运行契约 ' + (_COLL_CN[i.field] || i.field || '(全部)') + (r.canonicalField && r.canonicalField !== i.field ? '（按 ' + r.canonicalField + '）' : '');
      case 'listSource': return '列源码清单' + (i.filter ? '「' + i.filter + '」' : '') + (r.matched != null ? '（命中 ' + r.matched + '）' : '');
      case 'grepSource': return '搜源码「' + (i.query || '') + '」' + (r.hits ? '（命中 ' + r.hits.length + '）' : '');
      case 'readSource': return '读源码 ' + (i.path || '');
      case 'genReference': return '查生成范式 ' + (i.part || '(全部)');
      case 'listGaps': return '查规格缺口' + (r.requiredMissing ? '（必需缺 ' + r.requiredMissing.length + '）' : '');
      case 'validateDraft': return '校验' + (r.ok === false ? '：发现 ' + ((r.violations || []).length) + ' 处问题' : '：通过');
      case 'preflight': return '运行时体检' + (r.bootable === false ? '：' + ((r.blockers || []).length) + ' 处阻塞' : (r.bootable === true ? '：可运行' : ''));
      case 'bulkAdd': return '批量新增 ' + (r.added != null ? r.added : '') + ' 项到 ' + (_COLL_CN[i.collection] || i.collection || '');
      case 'multiEdit': return '一次改 ' + (r.applied != null ? r.applied : (i.edits || []).length) + ' 处';
      case 'note': return '备注：' + _shortVal(i.text);
      case 'flagUncertain': return '标记待核 ' + _friendlyPath(i.path) + (i.reason ? '（' + _shortVal(i.reason) + '）' : '');
      case 'recordConvention': return '记下约定：' + _shortVal(i.convention);
      case 'generateImage': return '生图 → ' + _friendlyPath(i.path) + (r.model ? '（' + r.model + '）' : '') + (r.image ? ' · ' + r.image : '');
      case 'finish': return '完成：' + (i.summary || '');
      default: return n + '(' + JSON.stringify(i).slice(0, 60) + ')';
    }
  }

  function appendLog(step) {
    if (!ui.els) return;
    if (step && step.tokensUsed != null) ui._lastTokens = step.tokensUsed;   // 方向I · 实时计量
    if (step && step.budget) ui._budget = step.budget;   // S10 · 预算上限(上下文余量表)
    if (step && step.iteration != null) ui._lastIter = step.iteration;
    var execBlk = _ensureExecBlock();   // UI·Z2 · 工具卡收进同一个「执行过程」折叠块
    var r = step.result || {};
    var cls = (step.name === 'finish' && r.ok) ? 'fin' : (r.ok ? 'ln' : 'bad');
    var detail = r.ok ? '' : (' — ' + esc(r.reason || ''));
    if (r.violations && r.violations.length) detail += ' [' + esc(r.violations.slice(0, 3).join('; ')) + ']';
    // UI·C · 工具调用折叠卡片：收起=友好摘要，点开=完整 input/output（像 Claude Code 的工具卡）
    var inputStr = ''; try { inputStr = JSON.stringify(step.input); } catch (e) { inputStr = String(step.input == null ? '' : step.input); }
    var resultStr = ''; try { resultStr = JSON.stringify(step.result); } catch (e) { resultStr = String(step.result == null ? '' : step.result); }
    var card = document.createElement('details');
    card.className = 'tm-aa-step ' + cls;
    card.innerHTML = '<summary><span class="st-ic">' + _icon(_TOOL_ICON[step.name] || 'route') + '</span><span class="st-tx">#' + step.iteration + ' ' + esc(_friendlyStep(step)) + detail + '</span></summary>'
      + '<div class="tm-aa-step-body">'
      + (inputStr && inputStr !== '{}' ? '<div class="sb-row"><span class="sb-k">输入</span><pre>' + esc(inputStr.slice(0, 600)) + (inputStr.length > 600 ? '…' : '') + '</pre></div>' : '')
      + (resultStr && resultStr !== '{}' ? '<div class="sb-row"><span class="sb-k">结果</span><pre>' + esc(resultStr.slice(0, 600)) + (resultStr.length > 600 ? '…' : '') + '</pre></div>' : '')
      + '</div>';
    var body = execBlk.querySelector('.tm-aa-think-body'); if (body) body.appendChild(card); else ui.els.log.appendChild(card);
    _bumpExecLabel(execBlk);
    _setLive('刚完成：' + _friendlyStep(step) + ' · 继续推演中…');   // 工作过程 · 最新动作进活动行
    _logScrollMaybe();
  }

  // UI·X · 每条改动渲染成可【接受/拒绝】的 hunk（idx=在 diffs 数组里的稳定下标·拒绝集 ui._diffRejected）
  function _diffEntryHtml(d, uncReason, idx) {
    var p = _friendlyPath(d.path);
    var pj = '<span class="tm-aa-diff-jump" data-reveal-path="' + esc(d.path || '') + '" title="在折子里精确定位此处">' + esc(p) + '</span>';
    var warn = uncReason ? '<span class="tm-aa-unc">待核：' + esc(uncReason) + '</span>' : '';
    var cls = uncReason ? ' uncertain' : '';
    var body;
    if (d.type === 'added') body = '<span class="hunk-body add' + cls + '">＋ 新增 ' + pj + '：' + esc(_shortVal(d.after)) + warn + '</span>';
    else if (d.type === 'removed') body = '<span class="hunk-body rm' + cls + '">－ 删除 ' + pj + warn + '</span>';
    else body = '<span class="hunk-body ch' + cls + '">✎ 改 ' + pj + '：' + esc(_shortVal(d.before)) + ' → ' + esc(_shortVal(d.after)) + warn + '</span>';
    var rejected = ui._diffRejected && ui._diffRejected.has(idx);
    return '<div class="tm-aa-hunk' + (rejected ? ' rejected' : '') + '" data-diff-idx="' + idx + '">'
      + '<button type="button" class="hunk-tog" data-diff-idx="' + idx + '" title="' + (rejected ? '已拒绝·点击接受' : '已接受·点击拒绝') + '">' + (rejected ? '✗' : '✓') + '</button>'
      + body + '</div>';
  }
  // 置信度标注：某 diff 路径是否被 agent 标为没把握（前缀双向匹配），返回理由或 ''
  function _uncReasonFor(path, uncList) {
    var dp = String(path || '');
    for (var i = 0; i < (uncList || []).length; i++) {
      var up = String(uncList[i].path || ''); if (!up) continue;
      if (dp === up || dp.indexOf(up) === 0 || up.indexOf(dp) === 0) return uncList[i].reason || '（未注明原因）';
    }
    return '';
  }
  // UI·X · 逐条接受/拒绝（Cursor/Claude Code edit-review）：每条改动一个 ✓/✗ 开关，应用时只落接受的；
  //   组级「全拒/全收」批量切；置信度低的条目 ⚠ 高亮。renderDiff 存 diffs+unc 并重置拒绝集，_paintDiff 负责画。
  function renderDiff(diffs, uncertainties) {
    if (!ui.els) return;
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    ui._lastDiffs = diffs || [];
    ui._lastUnc = uncertainties || [];
    if (!ui._diffRejected) ui._diffRejected = new Set();
    ui._diffRejected.clear();   // 新一批 diff 默认全接受
    (ui._lastDiffs).forEach(function(d, i) { d.__idx = i; });   // 稳定下标
    _paintDiff();
    ui.els.diff.onclick = function(ev) {   // 委托（每次重渲覆盖·不叠加）
      var t = ev.target;
      var tog = t.closest ? t.closest('.hunk-tog') : null;
      if (tog) { _toggleHunk(+tog.getAttribute('data-diff-idx')); return; }
      var grp = t.closest ? t.closest('.grp-tog') : null;
      if (grp) { _toggleGroup((grp.getAttribute('data-group-idxs') || '').split(',').filter(Boolean).map(Number)); return; }
    };
  }
  function _diffHeaderText() {
    var diffs = ui._lastDiffs || [], rej = ui._diffRejected || new Set();
    var totalUnc = diffs.filter(function(d) { return _uncReasonFor(d.path, ui._lastUnc); }).length;
    if (!diffs.length) return '改动预览';
    var acc = diffs.length - rej.size;
    return '改动预览 · 接受 ' + acc + '/' + diffs.length + ' 处' + (rej.size ? '（✗' + rej.size + '）' : '') + (totalUnc ? ' · ' + totalUnc + ' 处待核' : '');
  }
  function _paintDiff() {
    var diffs = ui._lastDiffs || [], unc = ui._lastUnc || [];
    ui.els.diffSec.textContent = _diffHeaderText();
    if (!diffs.length) { ui.els.diff.innerHTML = '<div class="ln" style="color:#8f8a7e">（无改动）</div>'; return; }
    var groups = {}, order = [];
    diffs.forEach(function(d) { var top = String(d.path || '').split(/[.\[]/)[0] || '(根)'; if (!groups[top]) { groups[top] = []; order.push(top); } groups[top].push(d); });
    ui.els.diff.innerHTML = order.map(function(field) {
      var es = groups[field];
      // 每一处都必须可见、可拒绝；禁止把第 41 项后的未展示改动默认为接受。
      var inner = es.map(function(d) { return _diffEntryHtml(d, _uncReasonFor(d.path, unc), d.__idx); }).join('');
      var gUnc = es.filter(function(d) { return _uncReasonFor(d.path, unc); }).length;
      var idxs = es.map(function(d) { return d.__idx; });
      var allRej = idxs.every(function(i) { return ui._diffRejected.has(i); });
      var firstPath = (es[0] && es[0].path) || field;
      return '<div class="tm-aa-diff-group" data-group="' + esc(field) + '"><div class="tm-aa-diff-head"><b class="tm-aa-diff-jump" data-reveal-field="' + esc(field) + '" data-first-path="' + esc(firstPath) + '" title="在折子里定位此字段（跳首处改动）">' + esc(_COLL_CN[field] || field) + ' \u2197</b> <span style="color:#8f8a7e">(' + es.length + ' 处' + (gUnc ? ' · 待核' + gUnc : '') + ')</span><button type="button" class="grp-tog" data-group-idxs="' + idxs.join(',') + '">' + (allRej ? '全收' : '全拒') + '</button></div>' + inner + '</div>';
    }).join('');
  }
  function _toggleHunk(idx) {
    if (!ui._diffRejected) ui._diffRejected = new Set();
    if (ui._diffRejected.has(idx)) ui._diffRejected.delete(idx); else ui._diffRejected.add(idx);
    _paintDiff();
  }
  function _toggleGroup(idxs) {
    if (!idxs.length) return;
    if (!ui._diffRejected) ui._diffRejected = new Set();
    var allRej = idxs.every(function(i) { return ui._diffRejected.has(i); });
    idxs.forEach(function(i) { if (allRej) ui._diffRejected.delete(i); else ui._diffRejected.add(i); });   // 全拒→全收，否则全拒
    _paintDiff();
  }

  function renderValidation(report) {
    if (!ui.els) return;
    var v = ui.els.val;
    v.style.display = '';
    if (report.ok) { v.className = 'tm-aa-val ok'; v.textContent = '✓ 校验通过'; return; }
    v.className = 'tm-aa-val bad';
    v.textContent = '仍有 ' + report.violations.length + ' 项校验问题：' + report.violations.slice(0, 4).join('；');
  }

  // 方向D · 审阅报告：总评进 summary 块、findings 按严重度排序着色进 diff 区（只读·无应用）
  function renderReview(review, stream) {
    if (!ui.els) return;
    if (ui.els.summary) {
      ui.els.summary.innerHTML = '<b>剧本审阅报告</b><span class="tm-aa-stream">' + esc((review && review.summary) || '（无总评）') + '</span>';
      ui.els.summary.style.display = '';
      _streamThenLink(ui.els.summary.querySelector('.tm-aa-stream'), stream);   // UI·P 吐字 + UI·AH linkify（总评部分）
    }
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    var findings = ((review && review.findings) || []).slice();
    ui.els.diffSec.textContent = '审阅发现（' + findings.length + ' 条）';
    var sevRank = { '高': 0, '中': 1, '低': 2 };
    findings.sort(function(a, b) { return (sevRank[a && a.severity] != null ? sevRank[a.severity] : 3) - (sevRank[b && b.severity] != null ? sevRank[b.severity] : 3); });
    if (!findings.length) { ui.els.diff.innerHTML = '<div class="ln" style="color:#7fe0a0">✓ 未发现明显问题</div>'; return; }
    ui.els.diff.innerHTML = findings.slice(0, 40).map(function(f) {
      f = f || {};
      var sev = f.severity || '?';
      var sevCls = sev === '高' ? 'rm' : (sev === '中' ? 'ch' : 'add');
      return '<div class="tm-aa-finding"><span class="sev ' + sevCls + '">[' + esc(sev) + ']</span> <b>' + esc(f.dimension || '') + '</b>'
        + (f.location ? ' <span class="loc">' + esc(String(f.location).slice(0, 50)) + '</span>' : '')
        + '<div class="iss">' + _mdLine(f.issue || '') + '</div>'
        + (f.suggestion ? '<div class="sug">→ ' + _mdLine(f.suggestion) + '</div>' : '') + '</div>';
    }).join('') + (findings.length > 40 ? '<div class="ln">… 还有 ' + (findings.length - 40) + ' 条</div>' : '');
  }

  // 方向K · 交互式澄清：作为对话气泡展示问题（玩家在输入框作答后续接）—— 不碰 summary/diff
  function renderClarify(questions) {
    if (!ui.els) return;
    questions = questions || [];
    var qs = questions.map(function(q, i) {
      return '<div class="ai-q">' + (i + 1) + '. ' + esc(typeof q === 'string' ? q : JSON.stringify(q)) + '</div>';
    }).join('') || '<div class="ai-q">（未列出具体问题）</div>';
    _appendGuoshiMsg('<span class="ai-who">国师 · 请教</span>要改得准，我需要先弄清几点：<div class="ai-qs">' + qs + '</div><div class="ai-hint">在下方输入框作答后发送即可继续</div>');
  }

  // 国师的对话消息气泡（进谏/澄清走它·像聊天而非塞进改动预览区）—— 追加到对话流，不碰 summary/diff
  function _appendGuoshiMsg(innerHtml) {
    if (!ui.els || !ui.els.log) return;
    if (ui.els.logSec) ui.els.logSec.style.display = '';
    if (ui.els.logWrap) ui.els.logWrap.style.display = '';
    var b = document.createElement('div');
    b.className = 'tm-aa-msg-ai';
    b.innerHTML = innerHtml;
    ui.els.log.appendChild(b);
    _logScrollMaybe(true);
  }
  // 刀1 · 国师进谏：作为对话气泡展示异议 + 替代方案（玩家在输入框回应后走续接通道）
  function renderRemonstrance(r) {
    if (!ui.els) return;
    r = r || {};
    var sevMap = { '史实': '史实存疑', '平衡': '数值失衡', '机制': '跨朝代机制' };
    var html = '<span class="ai-who">国师 · 进谏</span>'
      + '<span class="ai-sev">' + esc(sevMap[r.severity] || r.severity || '谏') + '</span>'
      + esc(r.concern || '（此举我以为不妥，恕未及细陈）')
      + (r.suggestion ? '<div class="ai-sug">↳ 建议：' + esc(r.suggestion) + '</div>' : '')
      + '<div class="ai-hint">在下方回应后发送即可继续：采纳建议 ／「我坚持，因为…」／ 换个需求</div>';
    _appendGuoshiMsg(html);
  }

  // 计划模式 · 展示 agent 的编号计划
  function renderPlan(plan) {
    if (!ui.els) return;
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    ui.els.diffSec.textContent = '改动计划（批准后执行）';
    var steps = (plan && plan.steps) || [];
    var rows = [];
    if (plan && plan.summary) rows.push('<div class="ch">' + esc(plan.summary) + '</div>');
    steps.forEach(function(s, i) { rows.push('<div class="ln">' + (i + 1) + '. ' + esc(typeof s === 'string' ? s : (s.text || JSON.stringify(s))) + '</div>'); });
    if (!rows.length) rows.push('<div class="ln">（agent 未给出明确步骤）</div>');
    ui.els.diff.innerHTML = rows.join('');
  }


  // ── 发布给 origin(反向 shim 调用)的渲染成员 ──
  __aaU.renderSummary = renderSummary; __aaU._removeLive = _removeLive; __aaU.appendText = appendText;
  __aaU.appendLog = appendLog; __aaU.renderDiff = renderDiff; __aaU.renderValidation = renderValidation;
  __aaU.renderReview = renderReview; __aaU.renderClarify = renderClarify;
  __aaU.renderRemonstrance = renderRemonstrance; __aaU.renderPlan = renderPlan;
})(typeof window !== 'undefined' ? window : this);

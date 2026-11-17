// ============================================================
// Module: editor-engine-constants.js
// Domain: Editor / 引擎元规则·官制
// Owns:
//   - engineConstants 5 owned sub-forms
//   - officeSubtabs (官制分组 tabs)
//   - officeClassifierPatterns (官署命名分类)
//   - officialRanks (官品/勋阶)
//   - concurrentTitleCatalog (兼衔)
//   - inquiryBodyCatalog (审案机构)
// Does not own:
//   - 官制运行时 (tm-office-runtime.js)
//   - 官制 panel UI (tm-office-panel.js)
//   - 官制 in-game editor (tm-office-editor.js)
//   - 模型要求 (editor-model-requirements.js)
// Public API:
//   - global.renderEngineConstants(containerId)
//   - global.add/edit/delete{OfficeSubtab|Pattern|Rank|Title|Body}
// Depends on:
//   - global scriptData (editor-core.js·scriptData.engineConstants)
//   - editor-shared utils (escHtml / autoSave)
// Used by:
//   - editor.html "官制·引擎元规则" sidebar group
// Tests:
//   - syntax-check
// Refactor notes:
//   - Phase 6 系统翻新 我做 (Phase 0 时)
//   - Phase 3·rename → editor-form-office-engine.js (与 model-requirements 合 form-meta? 待 audit)
//   - Phase 5 namespace·TM.Editor.EngineConstants
// ============================================================

(function(global) {
  'use strict';

  function ensureEC() {
    if (!scriptData.engineConstants) scriptData.engineConstants = {};
    return scriptData.engineConstants;
  }

  // ============================================
  // 1. officeSubtabs·array of {id, label, patterns:[]}
  // ============================================
  function renderOfficeSubtabs() {
    var ec = ensureEC();
    if (!Array.isArray(ec.officeSubtabs)) ec.officeSubtabs = [];
    var el = document.getElementById('officeSubtabs-list');
    if (typeof updateBadge === 'function') updateBadge('officeSubtabs', ec.officeSubtabs.length);
    if (!el) return;
    if (ec.officeSubtabs.length === 0) {
      el.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">暂无官署子标签。</div>';
      return;
    }
    var html = '';
    ec.officeSubtabs.forEach(function(t, i) {
      html += '<div class="card" style="border-left:3px solid var(--gold);">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
      html += '<strong style="color:var(--gold-light);">' + escHtml(t.label || t.id || '?') + '</strong>';
      html += '<span style="font-size:11px;color:var(--text-dim);">id: ' + escHtml(t.id || '') + '</span>';
      html += '</div>';
      html += '<div style="font-size:12px;color:var(--text-secondary);line-height:1.6;">patterns: ' + escHtml((t.patterns || []).join(' / ').slice(0, 200)) + '</div>';
      html += '<div style="margin-top:8px;display:flex;gap:6px;">';
      html += '<button class="btn btn-small" onclick="editOfficeSubtab(' + i + ')">编辑</button>';
      html += '<button class="btn btn-small btn-danger" onclick="deleteOfficeSubtab(' + i + ')">删除</button>';
      html += '</div></div>';
    });
    el.innerHTML = html;
  }
  function addOfficeSubtab() {
    var ec = ensureEC();
    if (!Array.isArray(ec.officeSubtabs)) ec.officeSubtabs = [];
    ec.officeSubtabs.push({ id: 'subtab_' + Date.now(), label: '新子标签', patterns: [] });
    renderOfficeSubtabs();
    editOfficeSubtab(ec.officeSubtabs.length - 1);
  }
  function editOfficeSubtab(idx) {
    var ec = ensureEC();
    var t = ec.officeSubtabs && ec.officeSubtabs[idx];
    if (!t) return;
    var html = '<div class="form-group"><label>ID</label><input id="ost-id" value="' + escHtml(t.id || '') + '"></div>';
    html += '<div class="form-group"><label>标签</label><input id="ost-label" value="' + escHtml(t.label || '') + '"></div>';
    html += '<div class="form-group"><label>匹配模式·逗号或换行分隔</label><textarea id="ost-patterns" rows="6">' + escHtml((t.patterns || []).join(',')) + '</textarea></div>';
    showGenericModal('编辑·官署子标签', html, function() {
      t.id = (document.getElementById('ost-id') || {}).value || t.id;
      t.label = (document.getElementById('ost-label') || {}).value || t.label;
      var pEl = document.getElementById('ost-patterns');
      t.patterns = pEl ? pEl.value.split(/[\n,，、]+/).map(function(v){return v.trim();}).filter(Boolean) : [];
      renderOfficeSubtabs();
      if (typeof autoSave === 'function') autoSave();
    });
  }
  function deleteOfficeSubtab(idx) {
    var ec = ensureEC();
    if (!ec.officeSubtabs) return;
    ec.officeSubtabs.splice(idx, 1);
    renderOfficeSubtabs();
    if (typeof autoSave === 'function') autoSave();
  }

  // ============================================
  // 2. officeClassifierPatterns·array of {pattern, court, group}
  // ============================================
  function renderOfficeClassifierPatterns() {
    var ec = ensureEC();
    if (!Array.isArray(ec.officeClassifierPatterns)) ec.officeClassifierPatterns = [];
    var el = document.getElementById('officeClassifierPatterns-list');
    if (typeof updateBadge === 'function') updateBadge('officeClassifierPatterns', ec.officeClassifierPatterns.length);
    if (!el) return;
    if (ec.officeClassifierPatterns.length === 0) {
      el.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">暂无官职分类规则。</div>';
      return;
    }
    var html = '';
    ec.officeClassifierPatterns.forEach(function(p, i) {
      html += '<div class="card" style="border-left:3px solid var(--gold);">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
      html += '<strong style="color:var(--gold-light);">' + escHtml(p.group || '?') + '</strong>';
      html += '<span style="font-size:11px;color:var(--text-dim);">court: ' + escHtml(p.court || '?') + '</span>';
      html += '</div>';
      html += '<code style="font-size:11px;color:var(--text-secondary);background:#222;padding:2px 6px;border-radius:3px;display:block;word-break:break-all;">' + escHtml(p.pattern || '') + '</code>';
      html += '<div style="margin-top:8px;display:flex;gap:6px;">';
      html += '<button class="btn btn-small" onclick="editOfficeClassifierPattern(' + i + ')">编辑</button>';
      html += '<button class="btn btn-small btn-danger" onclick="deleteOfficeClassifierPattern(' + i + ')">删除</button>';
      html += '</div></div>';
    });
    el.innerHTML = html;
  }
  function addOfficeClassifierPattern() {
    var ec = ensureEC();
    if (!Array.isArray(ec.officeClassifierPatterns)) ec.officeClassifierPatterns = [];
    ec.officeClassifierPatterns.push({ pattern: '', court: 'central', group: 'civil_minister' });
    renderOfficeClassifierPatterns();
    editOfficeClassifierPattern(ec.officeClassifierPatterns.length - 1);
  }
  function editOfficeClassifierPattern(idx) {
    var ec = ensureEC();
    var p = ec.officeClassifierPatterns && ec.officeClassifierPatterns[idx];
    if (!p) return;
    var html = '<div class="form-group"><label>正则模式 (用 | 分隔多个官名)</label><input id="ocp-pattern" value="' + escHtml(p.pattern || '') + '"></div>';
    html += '<div class="form-group"><label>朝堂位置</label><select id="ocp-court"><option value="central"' + (p.court==='central'?' selected':'') + '>central</option><option value="inner"' + (p.court==='inner'?' selected':'') + '>inner</option><option value="local"' + (p.court==='local'?' selected':'') + '>local</option><option value="frontier"' + (p.court==='frontier'?' selected':'') + '>frontier</option></select></div>';
    html += '<div class="form-group"><label>分组 (group)</label><input id="ocp-group" value="' + escHtml(p.group || '') + '"></div>';
    showGenericModal('编辑·官职分类规则', html, function() {
      p.pattern = (document.getElementById('ocp-pattern') || {}).value || p.pattern;
      p.court = (document.getElementById('ocp-court') || {}).value || p.court;
      p.group = (document.getElementById('ocp-group') || {}).value || p.group;
      renderOfficeClassifierPatterns();
      if (typeof autoSave === 'function') autoSave();
    });
  }
  function deleteOfficeClassifierPattern(idx) {
    var ec = ensureEC();
    if (!ec.officeClassifierPatterns) return;
    ec.officeClassifierPatterns.splice(idx, 1);
    renderOfficeClassifierPatterns();
    if (typeof autoSave === 'function') autoSave();
  }

  // ============================================
  // 3. officialRanks·array of strings
  // ============================================
  function renderOfficialRanks() {
    var ec = ensureEC();
    if (!Array.isArray(ec.officialRanks)) ec.officialRanks = [];
    var el = document.getElementById('officialRanks-list');
    if (typeof updateBadge === 'function') updateBadge('officialRanks', ec.officialRanks.length);
    if (!el) return;
    var html = '<div class="form-group"><label>官品·一行一个 (从高到低)</label>';
    html += '<textarea id="oranks-list-textarea" rows="20" style="font-family:monospace;font-size:13px;">' + escHtml(ec.officialRanks.join('\n')) + '</textarea></div>';
    html += '<button class="btn btn-small" onclick="saveOfficialRanksFromTextarea()">保存</button>';
    el.innerHTML = html;
  }
  function saveOfficialRanksFromTextarea() {
    var ec = ensureEC();
    var ta = document.getElementById('oranks-list-textarea');
    if (!ta) return;
    ec.officialRanks = ta.value.split(/\n+/).map(function(s){return s.trim();}).filter(Boolean);
    renderOfficialRanks();
    if (typeof autoSave === 'function') autoSave();
    if (typeof showToast === 'function') showToast('官品已保存 ' + ec.officialRanks.length + ' 条');
  }

  // ============================================
  // 4. concurrentTitleCatalog·array of {id, name, politicalWeight}
  // ============================================
  function renderConcurrentTitleCatalog() {
    var ec = ensureEC();
    if (!Array.isArray(ec.concurrentTitleCatalog)) ec.concurrentTitleCatalog = [];
    var el = document.getElementById('concurrentTitleCatalog-list');
    if (typeof updateBadge === 'function') updateBadge('concurrentTitleCatalog', ec.concurrentTitleCatalog.length);
    if (!el) return;
    if (ec.concurrentTitleCatalog.length === 0) {
      el.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">暂无兼衔。</div>';
      return;
    }
    var html = '';
    ec.concurrentTitleCatalog.forEach(function(t, i) {
      html += '<div class="card" style="border-left:3px solid var(--gold);">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
      html += '<strong style="color:var(--gold-light);">' + escHtml(t.name || '?') + '</strong>';
      html += '<span style="font-size:11px;color:var(--text-dim);">权重 ' + (t.politicalWeight !== undefined ? t.politicalWeight : '?') + '</span>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--text-dim);">id: ' + escHtml(t.id || '') + '</div>';
      html += '<div style="margin-top:8px;display:flex;gap:6px;">';
      html += '<button class="btn btn-small" onclick="editConcurrentTitle(' + i + ')">编辑</button>';
      html += '<button class="btn btn-small btn-danger" onclick="deleteConcurrentTitle(' + i + ')">删除</button>';
      html += '</div></div>';
    });
    el.innerHTML = html;
  }
  function addConcurrentTitle() {
    var ec = ensureEC();
    if (!Array.isArray(ec.concurrentTitleCatalog)) ec.concurrentTitleCatalog = [];
    ec.concurrentTitleCatalog.push({ id: 'title_' + Date.now(), name: '新兼衔', politicalWeight: 5 });
    renderConcurrentTitleCatalog();
    editConcurrentTitle(ec.concurrentTitleCatalog.length - 1);
  }
  function editConcurrentTitle(idx) {
    var ec = ensureEC();
    var t = ec.concurrentTitleCatalog && ec.concurrentTitleCatalog[idx];
    if (!t) return;
    var html = '<div class="form-group"><label>ID</label><input id="ct-id" value="' + escHtml(t.id || '') + '"></div>';
    html += '<div class="form-group"><label>名称</label><input id="ct-name" value="' + escHtml(t.name || '') + '"></div>';
    html += '<div class="form-group"><label>政治权重 (0-10)</label><input id="ct-weight" type="number" min="0" max="10" step="0.5" value="' + (t.politicalWeight !== undefined ? t.politicalWeight : 5) + '"></div>';
    showGenericModal('编辑·兼衔', html, function() {
      t.id = (document.getElementById('ct-id') || {}).value || t.id;
      t.name = (document.getElementById('ct-name') || {}).value || t.name;
      var w = parseFloat((document.getElementById('ct-weight') || {}).value);
      t.politicalWeight = isNaN(w) ? 5 : w;
      renderConcurrentTitleCatalog();
      if (typeof autoSave === 'function') autoSave();
    });
  }
  function deleteConcurrentTitle(idx) {
    var ec = ensureEC();
    if (!ec.concurrentTitleCatalog) return;
    ec.concurrentTitleCatalog.splice(idx, 1);
    renderConcurrentTitleCatalog();
    if (typeof autoSave === 'function') autoSave();
  }

  // ============================================
  // 5. inquiryBodyCatalog·object {key: {name, power, structure, key, note}}
  // ============================================
  function renderInquiryBodyCatalog() {
    var ec = ensureEC();
    if (typeof ec.inquiryBodyCatalog !== 'object' || !ec.inquiryBodyCatalog) ec.inquiryBodyCatalog = {};
    var el = document.getElementById('inquiryBodyCatalog-list');
    var keys = Object.keys(ec.inquiryBodyCatalog);
    if (typeof updateBadge === 'function') updateBadge('inquiryBodyCatalog', keys.length);
    if (!el) return;
    if (keys.length === 0) {
      el.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">暂无审查机构。</div>';
      return;
    }
    var html = '';
    keys.forEach(function(k) {
      var b = ec.inquiryBodyCatalog[k];
      var safeKey = k.replace(/'/g, "\\'");
      html += '<div class="card" style="border-left:3px solid var(--gold);">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
      html += '<strong style="color:var(--gold-light);">' + escHtml(b.name || k) + '</strong>';
      html += '<span style="font-size:11px;color:var(--text-dim);">' + escHtml(b.key || '') + '</span>';
      html += '</div>';
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;"><b>权:</b> ' + escHtml(b.power || '') + '</div>';
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;"><b>构:</b> ' + escHtml(b.structure || '') + '</div>';
      if (b.note) html += '<div style="font-size:11px;color:var(--text-dim);font-style:italic;">' + escHtml(b.note) + '</div>';
      html += '<div style="margin-top:8px;display:flex;gap:6px;">';
      html += '<button class="btn btn-small" onclick="editInquiryBody(\'' + safeKey + '\')">编辑</button>';
      html += '<button class="btn btn-small btn-danger" onclick="deleteInquiryBody(\'' + safeKey + '\')">删除</button>';
      html += '</div></div>';
    });
    el.innerHTML = html;
  }
  function addInquiryBody() {
    var ec = ensureEC();
    if (typeof ec.inquiryBodyCatalog !== 'object' || !ec.inquiryBodyCatalog) ec.inquiryBodyCatalog = {};
    var defaultName = '新审查机构';
    var n = defaultName;
    var i = 1;
    while (ec.inquiryBodyCatalog[n]) { n = defaultName + i++; }
    ec.inquiryBodyCatalog[n] = { name: n, power: '', structure: '', key: 'central', note: '' };
    renderInquiryBodyCatalog();
    editInquiryBody(n);
  }
  function editInquiryBody(key) {
    var ec = ensureEC();
    var b = ec.inquiryBodyCatalog && ec.inquiryBodyCatalog[key];
    if (!b) return;
    var html = '<div class="form-group"><label>名称 (即 key)</label><input id="ib-name" value="' + escHtml(b.name || key) + '"></div>';
    html += '<div class="form-group"><label>权能</label><textarea id="ib-power" rows="2">' + escHtml(b.power || '') + '</textarea></div>';
    html += '<div class="form-group"><label>结构</label><textarea id="ib-structure" rows="2">' + escHtml(b.structure || '') + '</textarea></div>';
    html += '<div class="form-group"><label>层级</label><select id="ib-key"><option value="central"' + (b.key==='central'?' selected':'') + '>central</option><option value="local"' + (b.key==='local'?' selected':'') + '>local</option><option value="inner"' + (b.key==='inner'?' selected':'') + '>inner</option></select></div>';
    html += '<div class="form-group"><label>备注</label><textarea id="ib-note" rows="3">' + escHtml(b.note || '') + '</textarea></div>';
    showGenericModal('编辑·审查机构', html, function() {
      var newName = (document.getElementById('ib-name') || {}).value || key;
      b.name = newName;
      b.power = (document.getElementById('ib-power') || {}).value || '';
      b.structure = (document.getElementById('ib-structure') || {}).value || '';
      b.key = (document.getElementById('ib-key') || {}).value || 'central';
      b.note = (document.getElementById('ib-note') || {}).value || '';
      if (newName !== key) {
        ec.inquiryBodyCatalog[newName] = b;
        delete ec.inquiryBodyCatalog[key];
      }
      renderInquiryBodyCatalog();
      if (typeof autoSave === 'function') autoSave();
    });
  }
  function deleteInquiryBody(key) {
    var ec = ensureEC();
    if (!ec.inquiryBodyCatalog) return;
    delete ec.inquiryBodyCatalog[key];
    renderInquiryBodyCatalog();
    if (typeof autoSave === 'function') autoSave();
  }

  // ============================================
  // global export·hook sidebar
  // ============================================
  global.renderOfficeSubtabs = renderOfficeSubtabs;
  global.addOfficeSubtab = addOfficeSubtab;
  global.editOfficeSubtab = editOfficeSubtab;
  global.deleteOfficeSubtab = deleteOfficeSubtab;
  global.renderOfficeClassifierPatterns = renderOfficeClassifierPatterns;
  global.addOfficeClassifierPattern = addOfficeClassifierPattern;
  global.editOfficeClassifierPattern = editOfficeClassifierPattern;
  global.deleteOfficeClassifierPattern = deleteOfficeClassifierPattern;
  global.renderOfficialRanks = renderOfficialRanks;
  global.saveOfficialRanksFromTextarea = saveOfficialRanksFromTextarea;
  global.renderConcurrentTitleCatalog = renderConcurrentTitleCatalog;
  global.addConcurrentTitle = addConcurrentTitle;
  global.editConcurrentTitle = editConcurrentTitle;
  global.deleteConcurrentTitle = deleteConcurrentTitle;
  global.renderInquiryBodyCatalog = renderInquiryBodyCatalog;
  global.addInquiryBody = addInquiryBody;
  global.editInquiryBody = editInquiryBody;
  global.deleteInquiryBody = deleteInquiryBody;

  document.addEventListener('click', function(e) {
    var item = e.target.closest && e.target.closest('.sidebar-item');
    if (!item) return;
    var panel = item.dataset.panel;
    if (panel === 'officeSubtabs') setTimeout(renderOfficeSubtabs, 50);
    else if (panel === 'officeClassifierPatterns') setTimeout(renderOfficeClassifierPatterns, 50);
    else if (panel === 'officialRanks') setTimeout(renderOfficialRanks, 50);
    else if (panel === 'concurrentTitleCatalog') setTimeout(renderConcurrentTitleCatalog, 50);
    else if (panel === 'inquiryBodyCatalog') setTimeout(renderInquiryBodyCatalog, 50);
  });

})(typeof window !== 'undefined' ? window : this);

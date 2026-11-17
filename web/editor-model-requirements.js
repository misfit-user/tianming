// ============================================================
// Module: editor-model-requirements.js
// Domain: Editor / 剧本元·LLM 适配
// Owns:
//   - scriptData.modelRequirements 编辑表单
//   - 7 字段·minOutputK / minContextK / needsChineseClassical /
//             recommendedTier / recommendedModels /
//             batchPersonaMaxLen / warningThreshold
//   - batchPersonaMaxLen 配 PromptComposer.getBatchPersonaMaxLen (v6)
// Does not own:
//   - PromptComposer 本身 (tm-prompt-composer.js)
//   - LLM 调度 (tm-ai-infra.js)
//   - 引擎常量 (editor-engine-constants.js)
// Public API:
//   - global.renderModelRequirements(containerId)
// Depends on:
//   - global scriptData (editor-core.js)
//   - escHtml / autoSave
// Used by:
//   - editor.html "高级·模型适配·模型要求" sidebar item
// Tests:
//   - syntax-check
// Refactor notes:
//   - Phase 0 系统翻新 我做
//   - Phase 3·rename → editor-form-meta.js (合 剧本基础信息)
//   - Phase 5 namespace·TM.Editor.ModelRequirements
// ============================================================

(function(global) {
  'use strict';

  function ensureMR() {
    if (!scriptData.modelRequirements) scriptData.modelRequirements = {};
    return scriptData.modelRequirements;
  }

  function renderModelRequirements() {
    var mr = ensureMR();
    var el = document.getElementById('modelRequirements-form');
    if (!el) return;
    var html = '';
    html += '<div class="form-group"><label>最低输出长度 (K tokens·sc1 主推演 JSON 易超·建议 8K+)</label>';
    html += '<input id="mr-minOutputK" type="number" min="1" max="64" value="' + (mr.minOutputK || 8) + '"></div>';

    html += '<div class="form-group"><label>最低上下文长度 (K tokens·剧本+sysP+history·建议 32K+)</label>';
    html += '<input id="mr-minContextK" type="number" min="4" max="256" value="' + (mr.minContextK || 32) + '"></div>';

    html += '<div class="form-group"><label>需中文古典能力</label>';
    html += '<input id="mr-needsChineseClassical" type="checkbox"' + (mr.needsChineseClassical ? ' checked' : '') + '></div>';

    html += '<div class="form-group"><label>推荐 tier</label>';
    html += '<select id="mr-recommendedTier">';
    ['high','medium','low'].forEach(function(t) {
      html += '<option value="' + t + '"' + ((mr.recommendedTier || 'high') === t ? ' selected' : '') + '>' + t + '</option>';
    });
    html += '</select></div>';

    html += '<div class="form-group"><label>推荐模型 (逗号分隔·如 claude-sonnet/claude-opus/gpt-4o/gpt-4.1/deepseek-r1/gemini-2.5)</label>';
    html += '<textarea id="mr-recommendedModels" rows="2">' + escHtml((mr.recommendedModels || []).join(', ')) + '</textarea></div>';

    html += '<div class="form-group"><label>批 NPC 人设最大字数 (batchPersonaMaxLen·v6 加·configurable maxLen·default 200·小模型可降 64-128·大模型升 500+)</label>';
    html += '<input id="mr-batchPersonaMaxLen" type="number" min="32" max="2000" value="' + (mr.batchPersonaMaxLen || 200) + '"></div>';

    html += '<div class="form-group"><label>警告·若模型不达标的提示</label>';
    html += '<textarea id="mr-warningThreshold" rows="3">' + escHtml(mr.warningThreshold || '') + '</textarea></div>';

    html += '<button class="btn btn-add" onclick="saveModelRequirements()">保存模型要求</button>';
    el.innerHTML = html;
  }

  function saveModelRequirements() {
    var mr = ensureMR();
    var gv = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var gn = function(id) { var v = gv(id); return v === '' ? undefined : Number(v); };
    var gb = function(id) { var el = document.getElementById(id); return el ? !!el.checked : false; };

    var minOut = gn('mr-minOutputK'); if (minOut !== undefined) mr.minOutputK = minOut;
    var minCtx = gn('mr-minContextK'); if (minCtx !== undefined) mr.minContextK = minCtx;
    mr.needsChineseClassical = gb('mr-needsChineseClassical');
    var tier = gv('mr-recommendedTier'); if (tier) mr.recommendedTier = tier;
    var models = gv('mr-recommendedModels');
    mr.recommendedModels = models ? models.split(/[,，、\n]+/).map(function(s){return s.trim();}).filter(Boolean) : [];
    var maxLen = gn('mr-batchPersonaMaxLen'); if (maxLen !== undefined) mr.batchPersonaMaxLen = maxLen;
    var warn = gv('mr-warningThreshold'); if (warn !== undefined) mr.warningThreshold = warn;

    if (typeof autoSave === 'function') autoSave();
    if (typeof showToast === 'function') showToast('模型要求已保存·minOutputK ' + mr.minOutputK + '·minContextK ' + mr.minContextK + '·batchPersonaMaxLen ' + mr.batchPersonaMaxLen);
  }

  global.renderModelRequirements = renderModelRequirements;
  global.saveModelRequirements = saveModelRequirements;

  document.addEventListener('click', function(e) {
    var item = e.target.closest && e.target.closest('.sidebar-item');
    if (!item) return;
    var panel = item.dataset.panel;
    if (panel === 'modelRequirements') setTimeout(renderModelRequirements, 50);
  });

})(typeof window !== 'undefined' ? window : this);

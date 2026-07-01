// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-player-settings.js — 导入导出 + 设置 + API 模型探测 (R127 从 tm-player-actions.js L1-500 拆出)
// 姊妹: tm-player-core.js (L501-3303·游戏控制+文苑+人物志)
//       tm-hongyan-office.js (L3304-end·鸿雁传书+官制)
// ??: closeSettings / model probe / secondary API helpers
//       _renderModelProbePanel/_probeRunContext/_probeRunOutput/_probeRunEvidence/_saveSecondaryAPI/
//       _toggleSecondaryEnabled/_testSecondaryAPI/_probeClearCache
// ============================================================

function closeSettings(){_$("settings-bg").classList.remove("show");}

// ============================================================
// 模型能力校验面板·防欺骗·M3 支持双 tier
// ============================================================
function _renderEvidenceDetails(evidence) {
  if (!evidence || !Array.isArray(evidence.checks) || !evidence.checks.length) return '';
  var totalMs = Number(evidence.elapsedMs || 0);
  var h = '<details style="margin-top:0.45rem;padding:0.4rem;background:rgba(0,0,0,0.14);border:1px solid var(--bdr);border-radius:3px;">';
  h += '<summary style="cursor:pointer;color:var(--gold);font-size:0.72rem;">实测明细';
  if (totalMs) h += ' · ' + Math.round(totalMs / 1000) + '秒';
  if (evidence.profile) h += ' · ' + escHtml(String(evidence.profile));
  h += '</summary>';
  evidence.checks.forEach(function(c){
    var color = c.ok ? 'var(--celadon-400)' : 'var(--vermillion-400)';
    h += '<div style="margin-top:0.35rem;padding-top:0.35rem;border-top:1px dashed var(--bdr);font-size:0.71rem;line-height:1.55;">';
    h += '<span style="color:' + color + ';">' + (c.ok ? '通过' : '失败') + '</span>';
    h += ' · <b>' + escHtml(c.label || c.id || '-') + '</b>';
    h += ' · 权重' + (c.weight || 0);
    if (c.latencyMs) h += ' · ' + c.latencyMs + 'ms';
    if (c.responseChars) h += ' · ' + c.responseChars + '字';
    if (c.finishReason) h += ' · ' + escHtml(String(c.finishReason));
    h += '<div style="color:var(--txt-d);">' + escHtml(c.detail || '') + '</div>';
    h += '</div>';
  });
  h += '</details>';
  return h;
}

function _renderModelProbePanel(tier) {
  tier = tier || 'primary';
  var _sfx = tier === 'secondary' ? '_secondary' : '';
  var cfg = P.conf || {};
  var isSec = tier === 'secondary';
  var _hasKey = isSec ? !!(P.ai && P.ai.secondary && P.ai.secondary.key) : !!(P.ai && P.ai.key);
  if (isSec && !_hasKey) {
    return '<div style="font-size:0.74rem;padding:0.5rem 0.6rem;background:rgba(138,92,245,0.04);border-left:3px solid var(--purple,#8a5cf5);border-radius:2px;color:var(--txt-d);line-height:1.7;">' +
      '<b style="color:var(--purple,#8a5cf5);">\u3010\u6B21 API\u3011</b> \u672A\u914D\u7F6E\u00B7\u914D\u7F6E\u540E\u6B64\u5904\u5C06\u663E\u793A\u63A2\u6D4B\u7ED3\u679C\u3002' +
    '</div>';
  }
  var model = '(未配置)';
  if (isSec && P.ai.secondary && P.ai.secondary.model) model = P.ai.secondary.model;
  else if (!isSec) model = P.ai.model || '(未配置)';
  var wlCtxK = (typeof _matchModelCtx === 'function') ? _matchModelCtx(model) : 0;
  var wlOutK = (typeof _matchModelOutput === 'function') ? _matchModelOutput(model) : 0;
  var detCtx = cfg['_detectedContextK' + _sfx] || 0;
  var detOut = cfg['_detectedMaxOutput' + _sfx] || 0;
  var measOut = cfg['_measuredMaxOutput' + _sfx] || 0;
  var layer = cfg['_ctxDetectLayer' + _sfx] || '未探测';
  var probe = cfg._probeHistory || {};
  var self = isSec ? probe.selfReport_secondary : probe.selfReport;
  var out = isSec ? probe.outputLimit_secondary : probe.outputLimit;
  var evidence = isSec ? probe.evidence_secondary : probe.evidence;

  var _tierLbl = isSec ? '【次 API】' : '【主 API】';
  var h = '<div style="font-size:0.76rem;line-height:1.8;padding:0.4rem;background:' + (isSec?'rgba(138,92,245,0.04)':'rgba(184,154,83,0.04)') + ';border-left:3px solid ' + (isSec?'var(--purple,#8a5cf5)':'var(--gold-d)') + ';border-radius:2px;">';
  h += '<div><b>' + _tierLbl + ' \u5F53\u524D\u6A21\u578B\uFF1A</b><code style="color:var(--gold);">' + escHtml(model) + '</code></div>';
  h += '<div style="margin-top:0.4rem;display:grid;grid-template-columns:auto auto auto auto;gap:0.3rem 0.8rem;padding:0.4rem;background:var(--color-elevated);border-radius:3px;">';
  h += '<div style="color:var(--txt-d);">\u6765\u6E90</div><div style="color:var(--txt-d);">\u4E0A\u4E0B\u6587</div><div style="color:var(--txt-d);">\u8F93\u51FA\u4E0A\u9650</div><div style="color:var(--txt-d);">\u5907\u6CE8</div>';
  h += '<div>\u767D\u540D\u5355</div><div>' + (wlCtxK ? wlCtxK+'K' : '-') + '</div><div>' + (wlOutK ? wlOutK+'K' : '-') + '</div><div style="color:var(--txt-d);font-size:0.7rem;">\u6570\u636E\u5E93\u58F0\u79F0</div>';
  if (self) {
    h += '<div>AI\u81EA\u62A5</div>';
    h += '<div>' + (self.contextClaimedK ? self.contextClaimedK+'K' : '-') + '</div>';
    h += '<div>' + (self.outputClaimedK ? self.outputClaimedK+'K' : '-') + '</div>';
    h += '<div style="color:var(--txt-d);font-size:0.7rem;">仅参考·' + escHtml((self.modelClaimedName||'').slice(0,20)) + '</div>';
  }
  if (detCtx || detOut) {
    h += '<div>API\u63A2\u6D4B</div>';
    h += '<div>' + (detCtx ? detCtx+'K' : '-') + '</div>';
    h += '<div>' + (detOut ? Math.round(detOut/1024)+'K' : '-') + '</div>';
    h += '<div style="color:var(--txt-d);font-size:0.7rem;">' + escHtml(layer) + '</div>';
  }
  if (out && out.realLimitTokens > 0) {
    h += '<div style="color:var(--gold);">\u5B9E\u6D4B</div>';
    h += '<div>-</div>';
    h += '<div style="color:var(--gold);">' + Math.round(out.realLimitTokens/1024*10)/10 + 'K</div>';
    h += '<div style="color:var(--txt-d);font-size:0.7rem;">\u771F\u5B9E\u4EA7\u51FA</div>';
  }
  if (evidence) {
    var evColor = evidence.reliability === 'high' ? 'var(--celadon-400)' : (evidence.reliability === 'medium' ? 'var(--gold)' : 'var(--vermillion-400)');
    h += '<div style="color:' + evColor + ';">证据校验</div>';
    h += '<div>-</div>';
    h += '<div style="color:' + evColor + ';">' + (evidence.weightedScore || evidence.score || 0) + '/100</div>';
    h += '<div style="color:var(--txt-d);font-size:0.7rem;">' + (evidence.passed || 0) + '/' + (evidence.total || 0) + '项通过' + (evidence.responseModel ? '·' + escHtml(String(evidence.responseModel).slice(0,18)) : '') + (evidence.elapsedMs ? '·' + Math.round(evidence.elapsedMs/1000) + '秒' : '') + '</div>';
  }
  h += '</div>';
  if (evidence) h += _renderEvidenceDetails(evidence);

  h += '<div style="margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.35rem;">';
  if (isSec) {
    h += "<button class=\"bt bs bsm\" onclick=\"_probeRunSelfReport('secondary')\">自报校验</button>";
    h += "<button class=\"bt bs bsm\" onclick=\"_probeRunContext('secondary')\">上下文探测</button>";
    h += "<button class=\"bt bs bsm\" onclick=\"_probeRunOutput('secondary')\">实测输出</button>";
    h += "<button class=\"bt bp bsm\" onclick=\"_probeRunEvidence('secondary')\">证据校验</button>";
    h += "<button class=\"bt bs bsm\" onclick=\"_showAvailableModels('secondary')\">模型列表</button>";
  } else {
    h += "<button class=\"bt bs bsm\" onclick=\"_probeRunSelfReport('primary')\">自报校验</button>";
    h += "<button class=\"bt bs bsm\" onclick=\"_probeRunContext('primary')\">上下文探测</button>";
    h += "<button class=\"bt bs bsm\" onclick=\"_probeRunOutput('primary')\">实测输出</button>";
    h += "<button class=\"bt bp bsm\" onclick=\"_probeRunEvidence('primary')\">证据校验</button>";
    h += "<button class=\"bt bs bsm\" onclick=\"_showAvailableModels('primary')\">模型列表</button>";
  }
  h += '</div>';

  // 冲突警告
  var warns = [];
  if (self && self.warnings && self.warnings.length) warns = warns.concat(self.warnings);
  if (evidence && evidence.warnings && evidence.warnings.length) warns = warns.concat(evidence.warnings);
  if (out && out.realLimitTokens > 0 && wlOutK > 0) {
    var measK = Math.round(out.realLimitTokens/1024);
    if (measK < wlOutK * 0.6) warns.push('\u5B9E\u6D4B\u8F93\u51FA ' + measK + 'K \u8FDC\u4F4E\u4E8E\u767D\u540D\u5355 ' + wlOutK + 'K\u00B7\u7591\u4EE3\u7406\u7F29\u6C34');
  }
  if (warns.length) {
    h += '<div style="margin-top:0.5rem;padding:0.4rem;background:rgba(192,64,48,0.1);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.72rem;color:var(--vermillion-400);">';
    h += '\u26A0 \u7591\u4F2A\u6216\u7F29\u6C34\u8B66\u544A\uFF1A';
    warns.forEach(function(w){ h += '<div style="padding-left:0.6rem;">\u00B7 ' + escHtml(w) + '</div>'; });
    h += '</div>';
  }

  // 当前生效值·按 tier 读
  var manualCtx = cfg['contextSizeK' + _sfx] || 0;
  var manualOut = cfg['maxOutputTokens' + _sfx] || 0;
  var effCtxK = manualCtx || detCtx || wlCtxK || 32;
  var effOutTok = manualOut || measOut || detOut || (wlOutK * 1024) || 0;
  h += '<div style="margin-top:0.5rem;padding:0.4rem;background:rgba(107,176,124,0.08);border-left:3px solid var(--celadon-400);border-radius:3px;font-size:0.72rem;">';
  h += '\u2713 \u5F53\u524D\u751F\u6548\uFF1A\u4E0A\u4E0B\u6587 <b>' + effCtxK + 'K</b>\u00B7\u8F93\u51FA\u4E0A\u9650 <b>' + (effOutTok ? effOutTok+' tokens' : '\u6A21\u578B\u81EA\u7531') + '</b>';
  if (manualCtx || manualOut) h += ' <span style="color:var(--gold);">(\u624B\u52A8\u8986\u5199)</span>';
  h += '</div>';
  h += '<div style="margin-top:0.35rem;color:var(--txt-d);font-size:0.71rem;">能力判断优先级：手动覆写 ＞ 实测输出/API探测 ＞ 白名单 ＞ 自报。自报不直接决定生效值。</div>';
  h += '</div>';
  return h;
}

function _refreshBothProbePanels() {
  var el = _$('s-model-probe-body');
  if (!el) return;
  el.innerHTML = _renderModelProbePanel('primary') + '<div style="margin-top:0.4rem;"></div>' + _renderModelProbePanel('secondary');
}

function _tierHasKey(tier) {
  if (tier === 'secondary') return !!(P.ai && P.ai.secondary && P.ai.secondary.key);
  return !!(P.ai && P.ai.key);
}

async function _probeRunContext(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('\u8BF7\u5148\u914D\u7F6E' + (tier==='secondary'?'\u6B21\u8981':'\u4E3B') + ' API'); return; }
  toast('\u6B63\u5728\u63A2\u6D4B\u4E0A\u4E0B\u6587\u00B7' + (tier==='secondary'?'\u6B21 API':'\u4E3B API') + '\u2026');
  try {
    if (typeof detectModelContextSize !== 'function') { toast('\u63A2\u6D4B\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
    await detectModelContextSize({ force: true, tier: tier, onProgress: function(msg){ if (typeof showLoading === 'function') showLoading(msg, 50); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    toast('\u2705 \u4E0A\u4E0B\u6587\u63A2\u6D4B\u5B8C\u6210');
    _refreshBothProbePanels();
  } catch(e) { if (typeof hideLoading === 'function') hideLoading(); toast('\u63A2\u6D4B\u5931\u8D25\uFF1A' + (e.message||e)); }
}

async function _probeRunOutput(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('\u8BF7\u5148\u914D\u7F6E ' + (tier==='secondary'?'\u6B21\u8981':'\u4E3B') + ' API'); return; }
  if (!confirm('\u5B9E\u6D4B\u8F93\u51FA\u4E0A\u9650\u4F1A\u8017 1-3 \u6B21\u957F\u7BC7\u8C03\u7528\u00B7\u7EE7\u7EED\uFF1F')) return;
  toast('\u6B63\u5728\u5B9E\u6D4B\u8F93\u51FA\u4E0A\u9650\u2026');
  try {
    if (typeof detectModelOutputLimit !== 'function') { toast('\u63A2\u6D4B\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
    if (typeof showLoading === 'function') showLoading('\u5B9E\u6D4B\u8F93\u51FA\u4E2D\u2026', 20);
    await detectModelOutputLimit({ tier: tier, onProgress: function(msg){ if (typeof showLoading === 'function') showLoading(msg, 50); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    toast('\u2705 \u8F93\u51FA\u4E0A\u9650\u5B9E\u6D4B\u5B8C\u6210');
    _refreshBothProbePanels();
  } catch(e) { if (typeof hideLoading === 'function') hideLoading(); toast('\u5B9E\u6D4B\u5931\u8D25\uFF1A' + (e.message||e)); }
}

async function _probeRunEvidence(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('请先配置 ' + (tier==='secondary'?'次要':'主') + ' API'); return; }
  if (!confirm('证据校验会发起 6 次小型调用：基础JSON、天命结构小样、坏JSON修复、长上下文、时政记/实录、持续输出。继续？')) return;
  toast('正在进行模型证据校验…');
  try {
    if (typeof probeModelEvidenceAudit !== 'function') { toast('证据校验函数未加载'); return; }
    if (typeof showLoading === 'function') showLoading('模型证据校验中…', 25);
    var r = await probeModelEvidenceAudit({ tier: tier, onProgress: function(msg){ if (typeof showLoading === 'function') showLoading(msg, 55); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    toast((r && r.score >= 90) ? ('✅ 证据校验通过·' + r.score + '/100') : ('⚠ 证据校验完成·' + ((r && r.score) || 0) + '/100'));
    _refreshBothProbePanels();
  } catch(e) {
    if (typeof hideLoading === 'function') hideLoading();
    toast('证据校验失败：' + (e.message || e));
  }
}

async function _probeRunSelfReport(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('\u8BF7\u5148\u914D\u7F6E ' + (tier==='secondary'?'\u6B21\u8981':'\u4E3B') + ' API'); return; }
  toast('\u6B63\u5728\u8BE2\u95EE\u6A21\u578B\u81EA\u62A5\u2026');
  try {
    if (typeof probeModelSelfReport !== 'function') { toast('\u63A2\u6D4B\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
    if (typeof showLoading === 'function') showLoading('\u6A21\u578B\u81EA\u62A5\u4E2D\u2026', 30);
    var r = await probeModelSelfReport({ tier: tier, onProgress: function(msg){ if (typeof showLoading === 'function') showLoading(msg, 50); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    var warnCt = (r && r.warnings && r.warnings.length) || 0;
    toast(warnCt ? ('\u26A0 \u5B8C\u6210\u00B7 ' + warnCt + ' \u6761\u7591\u4F2A\u8B66\u544A') : '\u2705 \u81EA\u62A5\u6821\u9A8C\u5B8C\u6210');
    _refreshBothProbePanels();
  } catch(e) { if (typeof hideLoading === 'function') hideLoading(); toast('\u81EA\u62A5\u5931\u8D25\uFF1A' + (e.message||e)); }
}

// 新·列出 API 可用模型·弹窗展示
async function _showAvailableModels(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('\u8BF7\u5148\u914D\u7F6E ' + (tier==='secondary'?'\u6B21':'\u4E3B') + ' API'); return; }
  if (typeof listAvailableModels !== 'function') { toast('\u5217\u6A21\u578B\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
  if (typeof showLoading === 'function') showLoading('\u6B63\u5728\u62C9\u53D6\u6A21\u578B\u5217\u8868\u2026', 30);
  try {
    var models = await listAvailableModels({ tier: tier });
    if (typeof hideLoading === 'function') hideLoading();
    if (!models || !models.length) { toast('\u672A\u80FD\u83B7\u53D6\u6A21\u578B\u5217\u8868'); return; }
    // 弹窗展示
    var html = '<div class="modal-bg show" id="_modelListModal" onclick="if(event.target===this)this.remove()" style="z-index:9999;">';
    html += '<div class="modal-box" style="max-width:780px;max-height:80vh;overflow-y:auto;background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.5rem;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">';
    html += '<div style="font-size:1rem;font-weight:700;color:var(--gold);">' + (tier==='secondary'?'\u6B21':'\u4E3B') + ' API \u53EF\u7528\u6A21\u578B\uFF08\u5171 ' + models.length + ' \u4E2A\uFF09</div>';
    html += '<button class="bt bs bsm" onclick="document.getElementById(\'_modelListModal\').remove()">\u2715</button></div>';
    html += '<div style="font-size:0.7rem;color:var(--ink-300);margin-bottom:0.5rem;">\u2605 \u6807\u7B7E=\u5728\u767D\u540D\u5355\u00B7\u5DF2\u77E5\u80FD\u529B\uFF1B\u70B9\u51FB\u6A21\u578B ID \u5373\u53EF\u586B\u5165</div>';
    html += '<table style="width:100%;font-size:0.76rem;border-collapse:collapse;">';
    html += '<tr style="color:var(--txt-d);border-bottom:1px solid var(--bdr);"><td>\u6A21\u578B ID</td><td style="text-align:right;">\u4E0A\u4E0B\u6587</td><td style="text-align:right;">\u8F93\u51FA</td><td style="text-align:right;">\u64CD\u4F5C</td></tr>';
    models.forEach(function(m){
      var star = m.matched ? '<span style="color:var(--gold);">\u2605</span> ' : '';
      html += '<tr style="border-bottom:1px solid rgba(107,93,79,0.1);">';
      html += '<td style="padding:4px 0;"><code style="color:' + (m.matched?'var(--gold)':'var(--txt-s)') + ';">' + star + escHtml(m.id) + '</code>';
      if (m.ownedBy) html += '<span style="color:var(--ink-300);font-size:0.7rem;"> · ' + escHtml(m.ownedBy) + '</span>';
      html += '</td>';
      html += '<td style="text-align:right;padding:4px 0;">' + (m.contextK ? m.contextK+'K' : '-') + '</td>';
      html += '<td style="text-align:right;padding:4px 0;">' + (m.outputK ? m.outputK+'K' : '-') + '</td>';
      html += '<td style="text-align:right;padding:4px 0;">';
      var inputId = tier==='secondary' ? 's-sec-model' : 's-model';
      html += '<button class="bt bs bsm" onclick="var i=document.getElementById(\'' + inputId + '\');if(i){i.value=' + JSON.stringify(m.id).replace(/"/g,'&quot;') + ';toast(\'\u5DF2\u586B\u5165\u00B7\u8BF7\u70B9\u4FDD\u5B58\');}">\u9009\u6B64</button>';
      html += '</td></tr>';
    });
    html += '</table></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  } catch(e) {
    if (typeof hideLoading === 'function') hideLoading();
    toast('\u83B7\u53D6\u6A21\u578B\u5217\u8868\u5931\u8D25\uFF1A' + (e.message||e));
  }
}

// M3·保存次要 API 配置
function _saveSecondaryAPI() {
  var sk = (_$('s-sec-key')||{}).value || '';
  var su = (_$('s-sec-url')||{}).value || '';
  var sm = (_$('s-sec-model')||{}).value || '';
  if (sk || su || sm) {
    if (!P.ai) P.ai = {};
    P.ai.secondary = { key: sk.trim(), url: su.trim(), model: sm.trim() };
  } else {
    if (P.ai) delete P.ai.secondary;
  }
  try { localStorage.setItem('tm_api', JSON.stringify(P.ai)); } catch(_) {}
  if (typeof saveP === 'function') saveP();
  if (window.tianming && window.tianming.isDesktop) { try { window.tianming.autoSave(_tmStripAiKeyView(P)).catch(function(){}); } catch(_){} }
  if (sk && su) toast('\u2705 \u6B21\u8981 API \u5DF2\u4FDD\u5B58\u00B7\u95EE\u5BF9/\u671D\u8BAE\u5C06\u8D70\u6B64\u914D\u7F6E');
  else toast('\u2705 \u5DF2\u6E05\u7A7A\u6B21\u8981 API\u00B7\u6240\u6709\u8C03\u7528\u56DE\u9000\u4E3B API');
  // 重新打开设置以刷新状态徽标和探测面板
  try { closeSettings(); openSettings(); } catch(_){}
}

// 次 API 启用开关·切换时即时生效
function _toggleSecondaryEnabled(on) {
  if (!P.conf) P.conf = {};
  P.conf.secondaryEnabled = !!on;
  if (typeof saveP === 'function') saveP();
  toast(on ? '\u2705 \u5DF2\u542F\u7528\u6B21 API\u00B7\u95EE\u5BF9/\u671D\u8BAE\u5C06\u8D70\u6B64\u8DEF' : '\u2705 \u5DF2\u5173\u95ED\u6B21 API\u00B7\u6240\u6709\u8C03\u7528\u56DE\u9000\u4E3B API');
  // 刷新设置面板以更新徽标
  try { closeSettings(); openSettings(); } catch(_){}
}
// P15: 通用 P.conf 字段开关·切换 boolean 值并保存
function _togglePConf(confKey, on) {
  if (!P.conf) P.conf = {};
  if (confKey === 'npcAiPrecision') {
    if (window.TM && TM.FactionNpcSettings && typeof TM.FactionNpcSettings.setEnabled === 'function') {
      TM.FactionNpcSettings.setEnabled(!!on);
    } else {
      P.conf.npcAiPrecision = !!on;
      if (on) P.conf.npcAiPrecisionMode = 'eager';
      else if (window.TM && TM.FactionNpcInTurnDriver && typeof TM.FactionNpcInTurnDriver.cancelInTurnTimers === 'function') {
        TM.FactionNpcInTurnDriver.cancelInTurnTimers();
      }
    }
  } else {
    P.conf[confKey] = !!on;
  }
  if (typeof saveP === 'function') saveP();
  var labels = {
    recallGateEnabled: { on: '已启用召回节流·常规回合跳过 SC_RECALL 节省 API', off: '已关闭召回节流·每回合都全跑 5 源召回' },
    consolidationEnabled: { on: '已启用后台记忆固化', off: '已关闭后台记忆固化·sc_consolidate 不再调用' },
    memorySynthesisEnabled: { on: '已启用后台记忆固化/综合', off: '已关闭后台记忆固化·记忆连贯性减低' },
    semanticRecallAutoload: { on: '已启用语义检索自动加载', off: '已关闭语义检索自动加载·SC_RECALL 第 5 源失效' },
    agentUpgradesEnabled: { on: '已启用全部 agent 升级（实验）·6 项 AI agent 化全开', off: '已关闭全部 agent 升级·各 agent 回落写死路径（单独开关仍生效）' },
    eventUnificationEnabled: { on: '已启用事件系统统一（S1 骨架·当前无可见效果·仅验证不破坏现状）', off: '已关闭事件系统统一·事件总线 drain 不跑' },
    officeActivationEnabled: { on: '已启用官制活化（实验）·5 刀全开：职权舆图/履职度/权限门/改制裁定/按需细查', off: '已关闭官制活化·官制回落写死路径（各刀独立开关仍生效）' },
    agentAdaptiveDeepen: { on: '已启用自适应深化·收尾只深化本回合有动静的维度（省调用·去填充·地板维度始终深化）', off: '已关闭自适应深化·每维度都深化（深度纯粹优先·更耗调用）' },
    talentCohortEnabled: { on: '已启用人才范式渗透（实验）·新式学校→多瓶颈漏斗→渐渗+双向阻力·兴造弹窗见「人才与风气」', off: '已关闭人才范式渗透·学校不再注入人才引擎（零回归）' },
    worldReactorBattleEnabled: { on: '已启用兵败牵动天下·战败方确定性折损实力', off: '已关闭·战败只走 AI 裁量·不自动折损实力' },
    populationBottomUpEnabled: { on: '已启用人口自下而上·按叶级政区分别核算', off: '已关闭·走全局粗粒度人口增长' },
    cognitionFeedbackEnabled: { on: '已启用认知反馈·知遇/贬谪落到忠诚数值', off: '已关闭·忠诚不因升降迁谪自动漂移' },
    useNewKejuScandal: { on: '已启用科场弊案·科举可能爆舞弊/科场案', off: '已关闭科场弊案链' }
  };
  var l = labels[confKey] || { on: '已启用 ' + confKey, off: '已关闭 ' + confKey };
  if (typeof toast === 'function') toast('✅ ' + (on ? l.on : l.off));
}

// 记忆深度(agent 长记忆窗口·回合·按模型能力)·近 N 回合喂细·更早压缩为脉络(仍可调取)·#4+#5
function _setAgentMemoryDepth(v) {
  if (!P.conf) P.conf = {};
  var n = Math.max(2, Math.min(parseInt(v, 10) || 6, 40));
  P.conf.agentMemoryDepth = n;
  if (typeof saveP === 'function') saveP();
  if (typeof toast === 'function') toast('✅ 记忆深度设为 ' + n + ' 回合(近 ' + n + ' 回合喂细·更早自动压缩为脉络·agent 仍可主动查全)');
}

// 工作上下文窗口(agent 多轮推演保留最近 N 轮工具明细全文·更早折叠为一行摘要·省 token·刀2)·仅 Agent 模式生效
function _setAgentTranscriptRounds(v) {
  if (!P.conf) P.conf = {};
  var n = Math.max(1, Math.min(parseInt(v, 10) || 2, 6));
  P.conf.agentTranscriptRecentRounds = n;
  if (typeof saveP === 'function') saveP();
  if (typeof toast === 'function') toast('✅ 工作上下文窗口设为最近 ' + n + ' 轮(更早折叠为摘要·省 token)');
}

// 【S6·实验模式】总闸 + 模式选择(LLM / Agent·互斥)·切换即时生效·重渲设置面板
//   关=零回归;LLM 模式=对现回合管线的增量增强(原"实验玩法");Agent 模式=模式 b 平行引擎(替换管线)。
function _toggleExperimentalEnabled(on) {
  if (!P.conf) P.conf = {};
  P.conf.experimentalEnabled = !!on;
  if (!P.conf.experimentalMode) P.conf.experimentalMode = 'llm'; // 默认 LLM 模式
  if (typeof saveP === 'function') saveP();
  if (typeof toast === 'function') toast(on ? '✅ 已开启实验模式·请在下方选择 LLM / Agent 模式' : '✅ 已关闭实验模式·一切实验内容回落');
  try { closeSettings(); openSettings(); } catch (_) {}
}
function _setExperimentalMode(mode) {
  if (!P.conf) P.conf = {};
  P.conf.experimentalMode = (mode === 'agent') ? 'agent' : 'llm';
  if (typeof saveP === 'function') saveP();
  if (typeof toast === 'function') {
    toast(P.conf.experimentalMode === 'agent'
      ? '🤖 已切到 Agent 模式·回合推演由 AI agent 主动改世界(实验·替换 LLM 管线)'
      : '🧠 已切到 LLM 模式·对现管线的增量增强(②③①/朝堂/记忆管家…)');
  }
  try { closeSettings(); openSettings(); } catch (_) {}
}


// 测试次 API 连接·发一条极短请求验证 key/url/model 可达
function _renderMemoryDiagnosticsButton() {
  return "<button class=\"bt bs bsm\" onclick=\"if(window.TM&&TM.ai&&TM.ai.openMemoryDiagnostics){TM.ai.openMemoryDiagnostics();}else if(typeof openMemoryDiagnostics==='function'){openMemoryDiagnostics();}else{toast('记忆诊断未加载');}\">记忆诊断</button>";
}

async function _testSecondaryAPI() {
  if (!(P.ai && P.ai.secondary && P.ai.secondary.key)) { toast('\u8BF7\u5148\u4FDD\u5B58\u6B21 API \u914D\u7F6E'); return; }
  if (typeof callAIMessages !== 'function') { toast('\u6D4B\u8BD5\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
  if (typeof showLoading === 'function') showLoading('\u6B63\u5728\u6D4B\u8BD5\u6B21 API\u8FDE\u63A5\u2026', 20);
  var t0 = Date.now();
  try {
    // callAIMessages(messages, maxTok, signal, tier)
    var res = await callAIMessages([{ role:'user', content: '\u7528\u4E00\u4E2A\u6C49\u5B57\u56DE\u590D\uFF1A\u597D' }], 10, null, 'secondary');
    if (typeof hideLoading === 'function') hideLoading();
    var dt = Date.now() - t0;
    var text = typeof res === 'string' ? res : ((res && (res.content || res.text)) || '');
    toast('\u2713 \u6B21 API \u901A\u00B7' + dt + 'ms\u00B7\u6A21\u578B\u56DE\uFF1A' + (text||'').trim().slice(0,24));
  } catch(e) {
    if (typeof hideLoading === 'function') hideLoading();
    toast('\u2717 \u6B21 API \u6D4B\u8BD5\u5931\u8D25\uFF1A' + ((e && e.message)||e));
  }
}

// M2·保存 API 配置后自动跑一次上下文探测（轻量层 0-3·不跑实测以免烧钱）
async function _saveAPIAndAutoProbe() {
  var newKey = (_$('s-key')||{}).value||'';
  var newUrl = (_$('s-url')||{}).value||'';
  var newModel = (_$('s-model')||{}).value||'';
  var _changed = (P.ai.key !== newKey) || (P.ai.url !== newUrl) || (P.ai.model !== newModel);
  P.ai.key = newKey; P.ai.url = newUrl; P.ai.model = newModel;
  try { localStorage.setItem('tm_api', JSON.stringify(P.ai)); } catch(_) {}
  if (typeof saveP === 'function') saveP();
  if (window.tianming && window.tianming.isDesktop) { try { window.tianming.autoSave(_tmStripAiKeyView(P)).catch(function(){}); } catch(_){} }
  if (!_changed) { toast('\u2705 \u5DF2\u4FDD\u5B58\uFF08\u914D\u7F6E\u672A\u53D8\uFF09'); return; }
  // 配置变化·清旧缓存·跑新探测
  delete P.conf._detectedContextK; delete P.conf._detectedMaxOutput; delete P.conf._measuredMaxOutput; delete P.conf._ctxCacheKey; delete P.conf._ctxDetectLayer; delete P.conf._probeHistory;
  if (!newKey) { toast('\u2705 \u5DF2\u4FDD\u5B58\uFF08\u672A\u914D key\u00B7\u8DF3\u8FC7\u81EA\u52A8\u6821\u9A8C\uFF09'); return; }
  toast('\u2705 \u5DF2\u4FDD\u5B58\u00B7\u6B63\u5728\u81EA\u52A8\u6821\u9A8C\u6A21\u578B\u00B7\u7A0D\u5019\u2026');
  try {
    if (typeof showLoading === 'function') showLoading('\u81EA\u52A8\u6821\u9A8C\u6A21\u578B\u80FD\u529B\u2026', 30);
    if (typeof detectModelContextSize === 'function') await detectModelContextSize({ force: true, onProgress: function(m){ if (typeof showLoading === 'function') showLoading(m, 50); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    _refreshBothProbePanels();
    var wlCtx = (typeof _matchModelCtx === 'function') ? _matchModelCtx(newModel) : 0;
    var wlOut = (typeof _matchModelOutput === 'function') ? _matchModelOutput(newModel) : 0;
    if (wlCtx && wlOut) toast('\u2705 \u6A21\u578B\u5DF2\u8BC6\u522B\uFF1A\u4E0A\u4E0B\u6587 ' + wlCtx + 'K\u00B7\u8F93\u51FA ' + wlOut + 'K');
    else toast('\u26A0 \u672A\u5728\u767D\u540D\u5355\u00B7\u5DF2\u8FD4\u56DE\u63A2\u6D4B\u7ED3\u679C\u00B7\u5EFA\u8BAE\u624B\u52A8\u8DD1"\u5B9E\u6D4B\u8F93\u51FA\u4E0A\u9650"');
  } catch(e) { if (typeof hideLoading === 'function') hideLoading(); toast('\u26A0 \u81EA\u52A8\u6821\u9A8C\u5931\u8D25\uFF1A' + (e.message||e)); }
}

function _probeClearCache() {
  if (!confirm('\u6E05\u9664\u6240\u6709\u63A2\u6D4B\u7F13\u5B58\uFF1F\u4E0B\u6B21\u5C06\u91CD\u65B0\u63A2\u6D4B\u3002')) return;
  delete P.conf._detectedContextK;
  delete P.conf._detectedMaxOutput;
  delete P.conf._measuredMaxOutput;
  delete P.conf._ctxCacheKey;
  delete P.conf._ctxDetectLayer;
  delete P.conf._probeHistory;
  if (typeof saveP === 'function') saveP();
  toast('\u5DF2\u6E05\u9664\u63A2\u6D4B\u7F13\u5B58');
  _refreshBothProbePanels();
}

// ============================================================
//  \u4E2D\u8F6C\u7AD9\u4E0D\u5B89\u5168\u8BC1\u4E66\u653E\u884C\uFF082026-06-11\uFF09
//  \u73A9\u5BB6 BYOK \u7528\u7684\u53CD\u4EE3/\u4E2D\u8F6C\u7AD9\u5E38\u8BC1\u4E66\u57DF\u540D\u4E0D\u5339\u914D\u6216\u81EA\u7B7E\u540D \u2192 \u5BA2\u6237\u7AEF\u62D2\u7EDD\u8FDE\u63A5\u3002
//  \u5F00\u5173 P.conf.insecureTlsRelay \u5F00\u542F\u540E\uFF0C\u628A\u73A9\u5BB6\u914D\u7F6E\u7684 API host\uFF08\u4E3B/\u6B21/\u751F\u56FE\uFF09
//  \u4E0B\u53D1\u7ED9\u684C\u9762 Electron(certificate-error \u653E\u884C) \u4E0E\u5B89\u5353 Capacitor(InsecureTls \u63D2\u4EF6)\uFF0C
//  \u4EC5\u5BF9\u8FD9\u4E9B host \u8DF3\u8FC7\u6821\u9A8C\u3002\u5B98\u65B9\u670D\u52A1\u5668\u57DF\u540D\u6C38\u4E0D\u653E\u884C\uFF08\u9632 MITM \u63A8\u6076\u610F\u70ED\u66F4\uFF09\u3002
//  \u5728\u7EBF\u7F51\u9875\u7248\u53D7\u6D4F\u89C8\u5668\u9650\u5236\u65E0\u6CD5\u7ED5\u8FC7\u2014\u2014\u5F00\u5173\u5BF9\u5176\u65E0\u6548\uFF08\u9759\u9ED8\uFF09\u3002
// ============================================================
var TM_INSECURE_TLS_OFFICIAL = ['api.themisfitserspeople.top', 'themisfitserspeople.top'];

function _tmInsecureHostOf(u) {
  try {
    if (!u) return '';
    var s = String(u).trim();
    if (!s) return '';
    if (s.indexOf('://') < 0 && s.indexOf('/') < 0 && s.indexOf(':') < 0) return s.toLowerCase();
    var p = new URL(s.indexOf('://') >= 0 ? s : ('https://' + s));
    return (p.hostname || '').toLowerCase();
  } catch (e) { return ''; }
}

function _tmGatherRelayHosts() {
  var hosts = [];
  function add(u) {
    var h = _tmInsecureHostOf(u);
    if (h && TM_INSECURE_TLS_OFFICIAL.indexOf(h) < 0 && hosts.indexOf(h) < 0) hosts.push(h);
  }
  try {
    var ai = (typeof P !== 'undefined' && P && P.ai) || {};
    add(ai.url);
    if (ai.secondary) add(ai.secondary.url);
    try { var img = JSON.parse(localStorage.getItem('tm_api_image') || '{}'); if (img && img.url) add(img.url); } catch (e) {}
  } catch (e) {}
  return hosts;
}

// \u628A\u5F53\u524D\u5F00\u5173+host \u4E0B\u53D1\u5230\u539F\u751F\u7AEF\uFF08Electron / Capacitor\uFF09\u00B7\u5E42\u7B49\u00B7\u968F\u65F6\u53EF\u8C03
function tmApplyInsecureTlsConfig() {
  try {
    var enabled = !!(typeof P !== 'undefined' && P && P.conf && P.conf.insecureTlsRelay === true);
    var hosts = enabled ? _tmGatherRelayHosts() : [];
    var cfg = { enabled: enabled, hosts: hosts };
    if (window.tianming && typeof window.tianming.setInsecureTlsConfig === 'function') {
      try { window.tianming.setInsecureTlsConfig(cfg); } catch (e) {}
    }
    try {
      var cap = window.Capacitor;
      if (cap && cap.Plugins && cap.Plugins.InsecureTls && typeof cap.Plugins.InsecureTls.setConfig === 'function') {
        cap.Plugins.InsecureTls.setConfig(cfg);
      }
    } catch (e) {}
    return cfg;
  } catch (e) { return { enabled: false, hosts: [] }; }
}

// \u5F00\u5173\u5207\u6362\uFF08\u8BBE\u7F6E\u9762\u677F\u590D\u9009\u6846 onchange\uFF09
function sToggleInsecureTlsRelay(on) {
  if (typeof P === 'undefined' || !P) return;
  if (!P.conf) P.conf = {};
  P.conf.insecureTlsRelay = !!on;
  if (typeof saveP === 'function') saveP();
  tmApplyInsecureTlsConfig();
  if (typeof toast === 'function') {
    toast(on
      ? '\u26A0 \u5DF2\u5141\u8BB8\u4E2D\u8F6C\u7AD9\u4E0D\u5B89\u5168\u8BC1\u4E66\u00B7\u4EC5\u5BF9\u4F60\u586B\u5199\u7684 API \u5730\u5740\u751F\u6548'
      : '\u2705 \u5DF2\u6062\u590D\u4E25\u683C\u8BC1\u4E66\u6821\u9A8C');
  }
}

// \u542F\u52A8\u6062\u590D\u540E\u4E0B\u53D1\u4E00\u6B21\uFF1BP \u5F02\u6B65\u6062\u590D\u53EF\u80FD\u665A\u4E8E DOMContentLoaded\uFF0C\u6545\u540C\u65F6\u542C tm:p-restored
try {
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('tm:p-restored', function () { try { tmApplyInsecureTlsConfig(); } catch (e) {} });
    window.addEventListener('load', function () { setTimeout(function () { try { tmApplyInsecureTlsConfig(); } catch (e) {} }, 1200); });
  }
} catch (e) {}


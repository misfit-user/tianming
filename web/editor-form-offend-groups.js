// ??????? (editor-form-offend-groups.js)
// ? editor-game-systems.js ??
function renderOffendGroupsList() {
  if (!scriptData.offendGroups) scriptData.offendGroups = { enabled: false, decayRate: 0.05, groups: [] };
  var chk = document.getElementById('offendGroups-enabled');
  if (chk) chk.checked = scriptData.offendGroups.enabled;
  var dr = document.getElementById('offendGroups-decayRate');
  if (dr) dr.value = scriptData.offendGroups.decayRate || 0.05;

  var el = document.getElementById('offendGroups-list');
  if (!el) return;
  var groups = scriptData.offendGroups.groups || [];
  if (groups.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">暂无利益集团，点击下方添加或使用AI生成</div>';
    return;
  }
  var html = '';
  groups.forEach(function(g, i) {
    html += '<div class="card" style="border-left:3px solid var(--danger);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<strong style="color:var(--gold-light);">' + escHtml(g.name || '未命名') + '</strong>';
    html += '<span style="font-size:11px;color:var(--text-dim);">ID: ' + escHtml(g.id || '') + '</span>';
    html += '</div>';
    html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:6px;">' + escHtml(g.description || '') + '</div>';
    if (g.thresholds && g.thresholds.length > 0) {
      html += '<div style="font-size:12px;color:var(--text-dim);">阈值：';
      g.thresholds.forEach(function(t) { html += '<span style="background:var(--bg-tertiary);padding:1px 6px;border-radius:4px;margin-right:4px;">' + t.score + '分→' + escHtml(t.description || '').slice(0, 20) + '</span>'; });
      html += '</div>';
    }
    html += '<div style="margin-top:8px;display:flex;gap:6px;">';
    html += '<button class="btn btn-small" onclick="editOffendGroup(' + i + ')">编辑</button>';
    html += '<button class="btn btn-small btn-danger" onclick="deleteOffendGroup(' + i + ')">删除</button>';
    html += '</div></div>';
  });
  el.innerHTML = html;
}

function addOffendGroupEntry() {
  if (!scriptData.offendGroups.groups) scriptData.offendGroups.groups = [];
  scriptData.offendGroups.groups.push({
    id: 'group_' + Date.now(), name: '新利益集团', description: '',
    thresholds: [{ score: 30, description: '开始不满', consequences: ['声望下降'] }, { score: 60, description: '公开反对', consequences: ['朝堂动荡'] }, { score: 90, description: '密谋叛乱', consequences: ['可能起兵'] }]
  });
  renderOffendGroupsList();
  editOffendGroup(scriptData.offendGroups.groups.length - 1);
}

function editOffendGroup(idx) {
  var g = scriptData.offendGroups.groups[idx];
  if (!g) return;
  var html = '<div class="form-group"><label>集团ID</label><input id="og-id" value="' + escHtml(g.id) + '"></div>';
  html += '<div class="form-group"><label>名称</label><input id="og-name" value="' + escHtml(g.name) + '"></div>';
  html += '<div class="form-group"><label>描述</label><textarea id="og-desc" rows="3">' + escHtml(g.description) + '</textarea></div>';
  html += '<div class="form-group"><label>阈值配置（JSON数组）</label><textarea id="og-thresholds" rows="4">' + escHtml(JSON.stringify(g.thresholds || [], null, 2)) + '</textarea></div>';
  showGenericModal('编辑利益集团', html, function() {
    g.id = gv('og-id');
    g.name = gv('og-name');
    g.description = gv('og-desc');
    try { g.thresholds = JSON.parse(gv('og-thresholds')); } catch(e) {}
    renderOffendGroupsList();
    if (typeof autoSave === 'function') autoSave();
  });
}

function deleteOffendGroup(idx) {
  scriptData.offendGroups.groups.splice(idx, 1);
  renderOffendGroupsList();
  if (typeof autoSave === 'function') autoSave();
}

function aiGenerateOffendGroups() {
  var ctx = '剧本：' + scriptData.name + ' 朝代：' + scriptData.dynasty + ' 背景：' + (scriptData.overview || '').slice(0, 200);
  var prompt = '你是天命游戏副本设计师。' + ctx + '\n请为这个朝代生成4-6个可被得罪的利益集团。\n返回JSON数组，每项：{id:"group_xxx",name:"集团名",description:"描述该集团的政治影响力和利益诉求",thresholds:[{score:30,description:"低级不满",consequences:["后果1"]},{score:60,description:"中级反对",consequences:["后果1","后果2"]},{score:90,description:"高级叛乱",consequences:["严重后果"]}]}\n集团应包括：文官集团、武将集团、宗室外戚、地方豪强、宗教势力等，根据朝代特色调整。\n只返回JSON。';
  // 增量：读取已有利益集团
  var existing = (scriptData.offendGroups && scriptData.offendGroups.groups) || [];
  if (existing.length > 0) {
    prompt += '\n\n【已有利益集团】\n' + existing.map(function(g) { return g.name + '：' + (g.description||'').slice(0,60); }).join('\n') + '\n\n请在此基础上补充新的集团，不要重复已有内容。\n';
  }
  showLoading('AI生成利益集团...');
  callAIEditor(prompt, 2000).then(function(c) {
    hideLoading();
    try {
      var arr = JSON.parse(extractJSONMatch(c, 'array')[0]);
      if (Array.isArray(arr)) { scriptData.offendGroups.groups = (scriptData.offendGroups.groups || []).concat(arr); scriptData.offendGroups.enabled = true; var chk = document.getElementById('offendGroups-enabled'); if (chk) chk.checked = true; renderOffendGroupsList(); showToast('已生成 ' + arr.length + ' 个利益集团'); if (typeof autoSave === 'function') autoSave(); }
    } catch(e) { showToast('解析失败'); }
  }).catch(function(e) { hideLoading(); showToast('生成失败: ' + e.message); });
}

// ============================================================
// 面板切换时渲染新面板
// ============================================================



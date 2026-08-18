// ??/??????? (editor-form-goals.js)
// ? editor-game-systems.js ??
function renderGoalsList() {
  if (!scriptData.goals) scriptData.goals = [];
  var el = document.getElementById('goals-list');
  if (!el) return;
  if (scriptData.goals.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">暂无目标条件，点击下方添加或使用AI生成</div>';
    return;
  }
  var html = '';
  scriptData.goals.forEach(function(g, i) {
    var typeLabels = { win: '胜利', lose: '失败', npc_goal: 'NPC目标', milestone: '里程碑' };
    var typeColor = { win: 'var(--success)', lose: 'var(--danger)', npc_goal: 'var(--info)', milestone: 'var(--gold)' };
    html += '<div class="card" style="border-left:3px solid ' + (typeColor[g.type] || 'var(--border)') + ';">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<strong style="color:' + (typeColor[g.type] || 'var(--gold)') + ';">' + escHtml(g.name || '未命名') + '</strong>';
    html += '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.05);color:var(--text-secondary);">' + (typeLabels[g.type] || g.type || '未分类') + '</span>';
    html += '</div>';
    html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:8px;">' + escHtml(g.description || '') + '</div>';
    if (g.conditions && g.conditions.length > 0) {
      html += '<div style="font-size:12px;color:var(--text-dim);">条件：';
      g.conditions.forEach(function(c) { html += '<span style="background:var(--bg-tertiary);padding:1px 6px;border-radius:4px;margin-right:4px;">' + escHtml(c.type + ':' + (c.variable || c.target || '') + (c.operator || '>=') + (c.value || '')) + '</span>'; });
      html += '</div>';
    }
    html += '<div style="margin-top:8px;display:flex;gap:6px;">';
    html += '<button class="btn btn-small" onclick="editGoalEntry(' + i + ')">编辑</button>';
    html += '<button class="btn btn-small btn-danger" onclick="deleteGoalEntry(' + i + ')">删除</button>';
    html += '</div></div>';
  });
  el.innerHTML = html;
}

function addGoalEntry() {
  if (!scriptData.goals) scriptData.goals = [];
  scriptData.goals.push({
    name: '新目标', type: 'win', description: '',
    conditions: [{ type: 'variable_gte', variable: '', value: 0 }]
  });
  renderGoalsList();
  editGoalEntry(scriptData.goals.length - 1);
}

function editGoalEntry(idx) {
  var g = scriptData.goals[idx];
  if (!g) return;
  var html = '<div class="form-group"><label>目标名称</label><input id="ge-name" value="' + escHtml(g.name) + '"></div>';
  html += '<div class="form-group"><label>类型</label><select id="ge-type"><option value="win"' + (g.type==='win'?' selected':'') + '>胜利条件</option><option value="lose"' + (g.type==='lose'?' selected':'') + '>失败条件</option><option value="npc_goal"' + (g.type==='npc_goal'?' selected':'') + '>NPC目标模板</option><option value="milestone"' + (g.type==='milestone'?' selected':'') + '>里程碑</option></select></div>';
  html += '<div class="form-group"><label>描述</label><textarea id="ge-desc" rows="3">' + escHtml(g.description) + '</textarea></div>';
  html += '<div class="form-group"><label>达成条件（JSON，如 [{"type":"variable_gte","variable":"国库","value":100000}]）</label><textarea id="ge-cond" rows="3">' + escHtml(JSON.stringify(g.conditions || [])) + '</textarea></div>';
  showGenericModal('编辑目标条件', html, function() {
    g.name = gv('ge-name');
    g.type = gv('ge-type');
    g.description = gv('ge-desc');
    try { g.conditions = JSON.parse(gv('ge-cond')); } catch(e) {}
    renderGoalsList();
    if (typeof autoSave === 'function') autoSave();
  });
}

function deleteGoalEntry(idx) {
  scriptData.goals.splice(idx, 1);
  renderGoalsList();
  if (typeof autoSave === 'function') autoSave();
}

function aiGenerateGoals() {
  var ctx = '剧本：' + scriptData.name + ' 朝代：' + scriptData.dynasty + ' 背景：' + (scriptData.overview || '').slice(0, 200);
  var prompt = '你是天命游戏副本设计师。' + ctx + '\n请为这个剧本生成4-6个目标条件，包含胜利条件、失败条件和里程碑。\n返回JSON数组，每项：{name:"目标名",type:"win/lose/milestone/npc_goal",description:"描述",conditions:[{type:"variable_gte/survive/event",variable:"变量名",value:数值}]}\n条件类型：variable_gte(变量>=值),variable_lte(变量<=值),survive(存活N回合),event(特定事件发生)\n只返回JSON。';
  // 增量：读取已有目标
  if (scriptData.goals && scriptData.goals.length > 0) {
    prompt += '\n\n【已有目标条件】\n' + scriptData.goals.map(function(g) { return '[' + g.type + '] ' + g.name + '：' + (g.description||'').slice(0,60); }).join('\n') + '\n\n请在此基础上补充新的目标条件，不要重复已有内容。\n';
  }
  showLoading('AI生成目标条件...');
  callAIEditor(prompt, 2000).then(function(c) {
    hideLoading();
    try {
      var arr = JSON.parse(extractJSONMatch(c, 'array')[0]);
      if (Array.isArray(arr)) { scriptData.goals = (scriptData.goals || []).concat(arr); renderGoalsList(); showToast('已生成 ' + arr.length + ' 个目标条件'); if (typeof autoSave === 'function') autoSave(); }
    } catch(e) { showToast('解析失败'); }
  }).catch(function(e) { hideLoading(); showToast('生成失败: ' + e.message); });
}

// ============================================================
// 初始皇命（钉子条目）编辑·对应 GM._memTables.imperialEdict 表
// ============================================================



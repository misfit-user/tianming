// ============================================================
// 剧本编辑器 — 科技/政策/变量/规则/事件/时间线 (editor-game-systems.js)
// 依赖: editor-core.js (scriptData, escHtml, autoSave, etc.)
// ============================================================

  // ============================================================
  // 科技树 — 结构化编辑（costs/effect/prereqs 对齐游戏运行时格式）
  // ============================================================

  // 通用：费用行
  function _costRow(c, i, prefix) {
    var varOpts = '<option value="">选择变量</option>';
    var allVars = [];
    if (scriptData.variables) {
      if (scriptData.variables.base) allVars = allVars.concat(scriptData.variables.base);
      if (scriptData.variables.other) allVars = allVars.concat(scriptData.variables.other);
    }
    allVars.forEach(function(v) { if (v.name) varOpts += '<option value="' + escHtml(v.name) + '"' + (c.variable === v.name ? ' selected' : '') + '>' + escHtml(v.name) + '</option>'; });
    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:3px;" id="' + prefix + '_cost_' + i + '">' +
      '<select style="flex:1;font-size:11px;">' + varOpts + '</select>' +
      '<input type="number" value="' + (c.amount||0) + '" min="0" placeholder="数量" style="width:70px;font-size:11px;">' +
      '<button type="button" onclick="this.parentElement.remove()" style="font-size:10px;padding:0 4px;background:#5a2020;color:#eee;border:none;border-radius:2px;">X</button></div>';
  }
  // 通用：效果行
  function _effectRow(varName, delta, i, prefix) {
    var varOpts = '<option value="">选择变量</option>';
    var allVars = [];
    if (scriptData.variables) {
      if (scriptData.variables.base) allVars = allVars.concat(scriptData.variables.base);
      if (scriptData.variables.other) allVars = allVars.concat(scriptData.variables.other);
    }
    allVars.forEach(function(v) { if (v.name) varOpts += '<option value="' + escHtml(v.name) + '"' + (varName === v.name ? ' selected' : '') + '>' + escHtml(v.name) + '</option>'; });
    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:3px;" id="' + prefix + '_eff_' + i + '">' +
      '<select style="flex:1;font-size:11px;">' + varOpts + '</select>' +
      '<input type="number" value="' + (delta||0) + '" placeholder="变化量" style="width:70px;font-size:11px;">' +
      '<button type="button" onclick="this.parentElement.remove()" style="font-size:10px;padding:0 4px;background:#5a2020;color:#eee;border:none;border-radius:2px;">X</button></div>';
  }
  // 添加费用/效果行的全局辅助
  function _addCostRow(prefix) {
    var l = document.getElementById(prefix + '_costs_list');
    if (!l) return;
    var n = l.querySelectorAll('[id^="' + prefix + '_cost_"]').length;
    l.insertAdjacentHTML('beforeend', _costRow({variable:'',amount:0}, n, prefix));
  }
  function _addEffectRow(prefix) {
    var l = document.getElementById(prefix + '_effects_list');
    if (!l) return;
    var n = l.querySelectorAll('[id^="' + prefix + '_eff_"]').length;
    l.insertAdjacentHTML('beforeend', _effectRow('', 0, n, prefix));
  }

  // 收集费用行
  function _collectCosts(prefix) {
    var costs = [];
    document.querySelectorAll('[id^="' + prefix + '_cost_"]').forEach(function(row) {
      var sel = row.querySelector('select');
      var inp = row.querySelector('input[type="number"]');
      if (sel && inp && sel.value) costs.push({variable: sel.value, amount: parseInt(inp.value)||0});
    });
    return costs;
  }
  // 收集效果行
  function _collectEffects(prefix) {
    var effect = {};
    document.querySelectorAll('[id^="' + prefix + '_eff_"]').forEach(function(row) {
      var sel = row.querySelector('select');
      var inp = row.querySelector('input[type="number"]');
      if (sel && inp && sel.value) effect[sel.value] = parseInt(inp.value)||0;
    });
    return effect;
  }

  // 构建科技/民政通用编辑表单
  function _buildTechCivicForm(item, prefix, extraFields) {
    var body = '<div class="form-group"><label>名称 *</label><input type="text" id="' + prefix + '_name" value="' + escHtml(item.name||'') + '"></div>';
    if (extraFields) body += extraFields;
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>时代等级</label><select id="' + prefix + '_era" style="width:100%;">';
    ['初级','中级','高级','顶级'].forEach(function(e) { body += '<option value="' + e + '"' + (item.era === e ? ' selected' : '') + '>' + e + '</option>'; });
    body += '</select></div></div>';
    // 前置依赖
    body += '<div class="form-group"><label>前置依赖</label><input type="text" id="' + prefix + '_prereqs" value="' + escHtml(Array.isArray(item.prereqs) ? item.prereqs.join(',') : (item.prereq||'')) + '" placeholder="逗号分隔已有科技/政策名"></div>';
    // 费用
    body += '<div style="margin:8px 0 4px;font-size:12px;font-weight:700;color:var(--gold);">研发/推行费用</div>';
    body += '<div style="font-size:10px;color:var(--txt-d);margin-bottom:4px;">变量名应与剧本中定义的变量一致</div>';
    body += '<div id="' + prefix + '_costs_list">';
    var costs = Array.isArray(item.costs) ? item.costs : [];
    // 兼容旧文本cost
    if (!costs.length && item.cost) costs = [{variable:'', amount: parseInt(item.cost)||0}];
    costs.forEach(function(c, ci) { body += _costRow(c, ci, prefix); });
    body += '</div>';
    body += '<button type="button" onclick="_addCostRow(\'' + prefix + '\')" style="font-size:10px;padding:1px 8px;margin-bottom:6px;">+ 添加费用项</button>';
    // 效果
    body += '<div style="margin:8px 0 4px;font-size:12px;font-weight:700;color:var(--gold);">解锁/推行效果</div>';
    body += '<div id="' + prefix + '_effects_list">';
    var effect = item.effect || {};
    var effEntries = Object.entries(effect);
    effEntries.forEach(function(e, ei) { body += _effectRow(e[0], e[1], ei, prefix); });
    body += '</div>';
    body += '<button type="button" onclick="_addEffectRow(\'' + prefix + '\')" style="font-size:10px;padding:1px 8px;margin-bottom:6px;">+ 添加效果项</button>';
    body += '<div class="form-group"><label>描述</label><textarea id="' + prefix + '_desc" rows="2">' + escHtml(item.description||item.desc||'') + '</textarea></div>';
    return body;
  }

  // C1: 渲染科技卡片（增强版）
  function _renderTechCard(item, editFn, delFn, idx) {
    var costStr = Array.isArray(item.costs) ? item.costs.map(function(c){return (c.amount||0)+c.variable;}).join('+') : (item.cost||'');
    var effStr = item.effect ? Object.entries(item.effect).map(function(e){return e[0]+(e[1]>0?'+':'')+e[1];}).join(' ') : '';
    var h = '<div class="card" onclick="' + editFn + '(' + idx + ')">';
    h += '<div class="card-title">' + escHtml(item.name||'') + (item.era ? ' <span style="font-size:10px;color:var(--txt-d);">[' + item.era + ']</span>' : '') + '</div>';
    h += '<div class="card-meta">';
    if (costStr) h += '<span style="font-size:10px;color:var(--red,#a44);">费:' + escHtml(costStr) + '</span> ';
    if (effStr) h += '<span style="font-size:10px;color:var(--green,#4a4);">效:' + escHtml(effStr) + '</span>';
    h += '</div>';
    if (item.description || item.desc) h += '<div class="card-desc">' + escHtml((item.description||item.desc||'').substring(0,60)) + '</div>';
    h += '<div style="position:absolute;top:8px;right:8px;"><button class="btn" style="padding:2px 8px;font-size:11px;" onclick="event.stopPropagation();' + delFn + '(' + idx + ')">删除</button></div>';
    h += '</div>';
    return h;
  }

  function renderTechTree() {
    var milEl = document.getElementById('techMilList');
    var civEl = document.getElementById('techCivilList');
    if (milEl) { milEl.innerHTML = ''; (scriptData.techTree.military||[]).forEach(function(t,i){ milEl.innerHTML += _renderTechCard(t,'editTechMil','deleteTechMil',i); }); }
    if (civEl) { civEl.innerHTML = ''; (scriptData.techTree.civil||[]).forEach(function(t,i){ civEl.innerHTML += _renderTechCard(t,'editTechCivil','deleteTechCivil',i); }); }
    updateBadge('techTree', (scriptData.techTree.military||[]).length + (scriptData.techTree.civil||[]).length);
  }

  function addTech(type) {
    var label = type === 'military' ? '军事' : '民用';
    var body = _buildTechCivicForm({}, 'tc', '');
    openGenericModal('添加' + label + '科技', body, function() {
      var d = { name: gv('tc_name'), era: gv('tc_era'), prereqs: gv('tc_prereqs').split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean), costs: _collectCosts('tc'), effect: _collectEffects('tc'), desc: gv('tc_desc') };
      if (!d.name) { showToast('请输入名称'); return; }
      scriptData.techTree[type].push(d);
      closeGenericModal(); renderTechTree(); autoSave(); showToast('已添加');
    });
  }
  function editTechMil(i) { editTechItem('military',i); }
  function editTechCivil(i) { editTechItem('civil',i); }
  function deleteTechMil(i) { scriptData.techTree.military.splice(i,1); renderTechTree(); autoSave(); }
  function deleteTechCivil(i) { scriptData.techTree.civil.splice(i,1); renderTechTree(); autoSave(); }
  function editTechItem(type, i) {
    var c = scriptData.techTree[type][i];
    var body = _buildTechCivicForm(c, 'tc', '');
    openGenericModal('编辑科技', body, function() {
      scriptData.techTree[type][i] = { name: gv('tc_name'), era: gv('tc_era'), prereqs: gv('tc_prereqs').split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean), costs: _collectCosts('tc'), effect: _collectEffects('tc'), desc: gv('tc_desc') };
      closeGenericModal(); renderTechTree(); autoSave();
    });
  }

  // ============================================================
  // 民政树 — 结构化编辑
  // ============================================================

  function renderCivicTree() {
    var keys = ['city','policy','resource','corruption'];
    var total = 0;
    keys.forEach(function(k) {
      var cap = k.charAt(0).toUpperCase() + k.slice(1);
      var listEl = document.getElementById('civ' + cap + 'List');
      if (listEl) {
        listEl.innerHTML = '';
        (scriptData.civicTree[k]||[]).forEach(function(c, i) {
          listEl.innerHTML += _renderTechCard(c, "editCivic_" + k, "deleteCivic_" + k, i);
        });
      }
      total += (scriptData.civicTree[k]||[]).length;
    });
    updateBadge('civicTree', total);
  }

  function addCivic(k) {
    var catLabels = {city:'城建',policy:'政策',resource:'资源',corruption:'吏治'};
    var body = _buildTechCivicForm({}, 'cv', '');
    openGenericModal('添加' + (catLabels[k]||'') + '政策', body, function() {
      var d = { name: gv('cv_name'), category: k, era: gv('cv_era'), prereqs: gv('cv_prereqs').split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean), costs: _collectCosts('cv'), effect: _collectEffects('cv'), desc: gv('cv_desc') };
      if (!d.name) { showToast('请输入名称'); return; }
      scriptData.civicTree[k].push(d);
      closeGenericModal(); renderCivicTree(); autoSave(); showToast('已添加');
    });
  }

  (function() {
    ['city','policy','resource','corruption'].forEach(function(k) {
      window['editCivic_' + k] = function(i) {
        var c = scriptData.civicTree[k][i];
        var body = _buildTechCivicForm(c, 'cv', '');
        openGenericModal('编辑政策', body, function() {
          scriptData.civicTree[k][i] = { name: gv('cv_name'), category: k, era: gv('cv_era'), prereqs: gv('cv_prereqs').split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean), costs: _collectCosts('cv'), effect: _collectEffects('cv'), desc: gv('cv_desc') };
          closeGenericModal(); renderCivicTree(); autoSave();
        });
      };
      window['deleteCivic_' + k] = function(i) {
        scriptData.civicTree[k].splice(i,1); renderCivicTree(); autoSave();
      };
    });
  })();

  function renderVariables() {
    var v = scriptData.variables;
    if (!v || Array.isArray(v)) { scriptData.variables = { base:[], other:[], formulas:[] }; v = scriptData.variables; }
    if (!v.base) v.base = [];
    if (!v.other) v.other = [];
    if (!v.formulas) v.formulas = [];

    // ── 基础变量 ──
    var bEl = document.getElementById('varBaseList');
    if (bEl) {
      if (!v.base.length) {
        bEl.innerHTML = '<div style="color:var(--txt-d);padding:6px 0">暂无基础变量</div>';
      } else {
        bEl.innerHTML = v.base.map(function(it, i) {
          var _rangeStr = '';
          if (it.min !== undefined || it.max !== undefined) _rangeStr = ' [' + (it.min||0) + '~' + (it.max||'∞') + ']';
          var _badges = '';
          if (it.isCore) _badges += '<span style="font-size:10px;padding:1px 4px;background:var(--gold-d);color:#fff;border-radius:3px;margin-left:4px;">核心</span>';
          if (it.inversed) _badges += '<span style="font-size:10px;padding:1px 4px;background:#c04030;color:#fff;border-radius:3px;margin-left:4px;">反向</span>';
          if (it.displayName && it.displayName !== it.name) _badges += '<span style="font-size:10px;color:var(--txt-d);margin-left:4px;">显示:' + escHtml(it.displayName) + '</span>';
          return '<div style="border:1px solid var(--bg-4);border-radius:6px;margin-bottom:6px;overflow:hidden">' +
            '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-2)">' +
            '<strong style="flex:1">' + escHtml(it.name||'') + _badges + '</strong>' +
            (it.defaultValue ? '<span style="font-size:11px;color:var(--txt-d)">初始:' + escHtml(it.defaultValue) + (it.unit ? escHtml(it.unit) : '') + _rangeStr + '</span>' : '') +
            '<button class="bd bsm" onclick="editBaseVar(' + i + ')">❖</button>' +
            '<button class="bd bsm" onclick="deleteBaseVar(' + i + ')">✕</button>' +
            '</div>' +
            (it.calcMethod ? '<div style="padding:3px 8px 5px 8px;font-size:11px;color:#7ab8e8">计算: ' + escHtml(String(it.calcMethod).substring(0,80)) + '</div>' : '') +
            (it.description ? '<div style="padding:2px 8px 5px 8px;font-size:12px;color:var(--txt-d)">' + escHtml(String(it.description).substring(0,60)) + '</div>' : '') +
            '</div>';
        }).join('');
      }
    }

    // ── 其他变量 ──
    var oEl = document.getElementById('varOtherList');
    if (oEl) {
      if (!v.other.length) {
        oEl.innerHTML = '<div style="color:var(--txt-d);padding:6px 0">暂无其他变量</div>';
      } else {
        oEl.innerHTML = v.other.map(function(it, i) {
          var _oRange = '';
          if (it.min !== undefined || it.max !== undefined) _oRange = ' [' + (it.min||0) + '~' + (it.max||'?') + ']';
          var _oBadges = '';
          if (it.isCore) _oBadges += '<span style="font-size:10px;padding:1px 4px;background:var(--gold-d);color:#fff;border-radius:3px;margin-left:4px;">核心</span>';
          if (it.inversed) _oBadges += '<span style="font-size:10px;padding:1px 4px;background:#c04030;color:#fff;border-radius:3px;margin-left:4px;">反向</span>';
          if (it.displayName && it.displayName !== it.name) _oBadges += '<span style="font-size:10px;color:var(--txt-d);margin-left:4px;">显示:' + escHtml(it.displayName) + '</span>';
          return '<div style="border:1px solid var(--bg-4);border-radius:6px;margin-bottom:6px;overflow:hidden">' +
            '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-2)">' +
            '<strong style="flex:1">' + escHtml(it.name||'') + _oBadges + '</strong>' +
            (it.defaultValue ? '<span style="font-size:11px;color:var(--txt-d)">初始:' + escHtml(it.defaultValue) + (it.unit ? escHtml(it.unit) : '') + _oRange + '</span>' : '') +
            '<button class="bd bsm" onclick="editOtherVar(' + i + ')">❖</button>' +
            '<button class="bd bsm" onclick="deleteOtherVar(' + i + ')">✕</button>' +
            '</div>' +
            (it.description ? '<div style="padding:2px 8px 5px 8px;font-size:12px;color:var(--txt-d)">' + escHtml(String(it.description).substring(0,60)) + '</div>' : '') +
            '</div>';
        }).join('');
      }
    }

    // ── 关联公式 ──
    var fEl = document.getElementById('varFormulaList');
    if (fEl) {
      if (!v.formulas.length) {
        fEl.innerHTML = '<div style="color:var(--txt-d);padding:6px 0">暂无关联公式</div>';
      } else {
        fEl.innerHTML = v.formulas.map(function(it, i) {
          var ft = _formulaTypes[it.type] || _formulaTypes.income;
          var chainHtml = '';
          if (it.chains && it.chains.length > 0) {
            chainHtml = '<div style="padding:2px 8px 4px;font-size:10px;color:var(--indigo-400);line-height:1.6;">'
              + it.chains.map(function(c){return '↳ '+escHtml(c);}).join('<br>') + '</div>';
          }
          var relHtml = '';
          if (it.relatedVars && it.relatedVars.length > 0) {
            relHtml = '<div style="padding:1px 8px;font-size:10px;color:var(--txt-d);">关联：' + it.relatedVars.map(function(v){return '<span style="background:var(--bg-4);padding:0 3px;border-radius:2px;margin:0 1px;">'+escHtml(v)+'</span>';}).join('') + '</div>';
          }
          return '<div style="border:1px solid var(--bg-4);border-radius:6px;margin-bottom:6px;overflow:hidden;border-left:3px solid '+ft.color+'">'
            + '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-2)">'
            + '<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:var(--bg-4);color:'+ft.color+'">'+ft.label+'</span>'
            + '<strong style="flex:1;color:var(--gold)">' + escHtml(it.name||'') + '</strong>'
            + '<button class="bd bsm" onclick="editFormula(' + i + ')">❖</button>'
            + '<button class="bd bsm" onclick="deleteFormula(' + i + ')">✕</button>'
            + '</div>'
            + (it.expression ? '<div style="padding:3px 8px 5px;font-size:11px;color:#a0d080;font-family:monospace;white-space:pre-wrap;line-height:1.5">' + escHtml(it.expression) + '</div>' : '')
            + chainHtml + relHtml
            + (it.description ? '<div style="padding:2px 8px 5px;font-size:11px;color:var(--txt-d)">' + escHtml(it.description) + '</div>' : '')
            + '</div>';
        }).join('');
      }
    }

    var total = v.base.length + v.other.length + v.formulas.length;
    updateBadge('variables', total);
  }

  function addBaseVar() {
    var body = '<div class="form-group"><label>变量名</label><input id="gm_name" placeholder="如：国库"></div>' +
      '<div class="form-group"><label>显示名（游戏中显示，留空则用变量名）</label><input id="gm_displayName" placeholder="如：国库储银"></div>' +
      '<div style="display:flex;gap:12px;"><div class="form-group" style="flex:1;"><label>初始值</label><input id="gm_value" placeholder="如：1000000"></div>' +
      '<div class="form-group" style="flex:1;"><label>单位</label><input id="gm_unit" placeholder="如：两、石、人、%"></div>' +
      '<div class="form-group" style="flex:1;"><label>最小值</label><input id="gm_min" type="number" value="0"></div>' +
      '<div class="form-group" style="flex:1;"><label>最大值</label><input id="gm_max" type="number" value="10000000"></div></div>' +
      '<div style="display:flex;gap:12px;margin-bottom:8px;">' +
      '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="gm_isCore"> 核心指标（在游戏界面顶部显示变化量）</label>' +
      '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="gm_inversed"> 反向指标（数值越高越差，如流寇/灾情）</label></div>' +
      '<div class="form-group"><label>计算方式</label>' +
      '<textarea id="gm_calc" rows="3" placeholder="描述该变量如何计算，如：每回合卬赋收入加X两银，截留官员工资Y，赢仗报酉时加Z……"></textarea></div>' +
      '<div class="form-group"><label>包含项（可选）</label>' +
      '<textarea id="gm_components" rows="3" placeholder="详细收支明细，每行一项"></textarea></div>' +
      '<div class="form-group"><label>说明</label><textarea id="gm_desc" rows="2"></textarea></div>';
    openGenericModal('添加基础变量', body, function() {
      var nm = gv('gm_name').trim();
      if (!nm) { showToast('请输入变量名'); return; }
      if (!scriptData.variables || Array.isArray(scriptData.variables)) scriptData.variables = { base:[], other:[], formulas:[] };
      var comps = gv('gm_components').trim();
      var newVar = { name: nm, defaultValue: gv('gm_value').trim(), unit: gv('gm_unit').trim(), min: parseFloat(gv('gm_min'))||0, max: parseFloat(gv('gm_max'))||10000000, calcMethod: gv('gm_calc').trim(), components: comps, description: gv('gm_desc').trim() };
      var dispName = gv('gm_displayName').trim();
      if (dispName) newVar.displayName = dispName;
      if (document.getElementById('gm_isCore') && document.getElementById('gm_isCore').checked) newVar.isCore = true;
      if (document.getElementById('gm_inversed') && document.getElementById('gm_inversed').checked) newVar.inversed = true;
      scriptData.variables.base.push(newVar);
      renderVariables(); autoSave();
    });
  }

  function editBaseVar(i) {
    if (!scriptData.variables || !scriptData.variables.base) return;
    var c = scriptData.variables.base[i]; if (!c) return;
    var body = '<div class="form-group"><label>变量名</label><input id="gm_name" value="' + escHtml(c.name||'') + '"></div>' +
      '<div class="form-group"><label>显示名（游戏中显示，留空则用变量名）</label><input id="gm_displayName" value="' + escHtml(c.displayName||'') + '"></div>' +
      '<div style="display:flex;gap:12px;"><div class="form-group" style="flex:1;"><label>初始值</label><input id="gm_value" value="' + escHtml(c.defaultValue||'') + '"></div>' +
      '<div class="form-group" style="flex:1;"><label>单位</label><input id="gm_unit" value="' + escHtml(c.unit||'') + '"></div>' +
      '<div class="form-group" style="flex:1;"><label>最小值</label><input id="gm_min" type="number" value="' + (c.min !== undefined ? c.min : 0) + '"></div>' +
      '<div class="form-group" style="flex:1;"><label>最大值</label><input id="gm_max" type="number" value="' + (c.max !== undefined ? c.max : 10000000) + '"></div></div>' +
      '<div style="display:flex;gap:12px;margin-bottom:8px;">' +
      '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="gm_isCore"' + (c.isCore ? ' checked' : '') + '> 核心指标（在游戏界面顶部显示变化量）</label>' +
      '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="gm_inversed"' + (c.inversed ? ' checked' : '') + '> 反向指标（数值越高越差）</label></div>' +
      '<div class="form-group"><label>计算方式</label><textarea id="gm_calc" rows="3">' + escHtml(c.calcMethod||'') + '</textarea></div>' +
      '<div class="form-group"><label>包含项（可选）</label><textarea id="gm_components" rows="3">' + escHtml(c.components||'') + '</textarea></div>' +
      '<div class="form-group"><label>说明</label><textarea id="gm_desc" rows="2">' + escHtml(c.description||'') + '</textarea></div>';
    openGenericModal('编辑基础变量', body, function() {
      c.name = gv('gm_name').trim() || c.name;
      c.displayName = gv('gm_displayName').trim() || '';
      c.defaultValue = gv('gm_value').trim();
      c.unit = gv('gm_unit').trim();
      c.min = parseFloat(gv('gm_min')) || 0;
      c.max = parseFloat(gv('gm_max')) || 10000000;
      c.calcMethod = gv('gm_calc').trim();
      c.components = gv('gm_components').trim();
      c.description = gv('gm_desc').trim();
      c.isCore = !!(document.getElementById('gm_isCore') && document.getElementById('gm_isCore').checked);
      c.inversed = !!(document.getElementById('gm_inversed') && document.getElementById('gm_inversed').checked);
      renderVariables(); autoSave();
    });
  }

  function deleteBaseVar(i) {
    if (!scriptData.variables || !scriptData.variables.base) return;
    scriptData.variables.base.splice(i, 1);
    renderVariables(); autoSave();
  }

  function addOtherVar() {
    var body = '<div class="form-group"><label>变量名</label><input id="gm_name" placeholder="如：盐铁专营收入"></div>' +
      '<div class="form-group"><label>显示名（游戏中显示，留空则用变量名）</label><input id="gm_displayName" placeholder="如：盐铁收入"></div>' +
      '<div style="display:flex;gap:12px;"><div class="form-group" style="flex:1;"><label>初始值</label><input id="gm_value" placeholder="如：50000"></div>' +
      '<div class="form-group" style="flex:1;"><label>单位</label><input id="gm_unit" placeholder="如：两、石"></div>' +
      '<div class="form-group" style="flex:1;"><label>最小值</label><input id="gm_min" type="number" value="0"></div>' +
      '<div class="form-group" style="flex:1;"><label>最大值</label><input id="gm_max" type="number" value="100"></div></div>' +
      '<div style="display:flex;gap:12px;margin-bottom:8px;">' +
      '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="gm_isCore"> 核心指标</label>' +
      '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="gm_inversed"> 反向指标（越高越差）</label></div>' +
      '<div class="form-group"><label>包含项（可选）</label>' +
      '<textarea id="gm_components" rows="3" placeholder="详细收支明细，每行一项"></textarea></div>' +
      '<div class="form-group"><label>说明</label><textarea id="gm_desc" rows="3" placeholder="描述该变量的时代特色、计算方式等"></textarea></div>';
    openGenericModal('添加其他变量', body, function() {
      var nm = gv('gm_name').trim();
      if (!nm) { showToast('请输入变量名'); return; }
      if (!scriptData.variables || Array.isArray(scriptData.variables)) scriptData.variables = { base:[], other:[], formulas:[] };
      var comps = gv('gm_components').trim();
      var newVar = { name: nm, defaultValue: gv('gm_value').trim(), unit: gv('gm_unit').trim(), min: parseFloat(gv('gm_min'))||0, max: parseFloat(gv('gm_max'))||100, components: comps, description: gv('gm_desc').trim() };
      var dispName = gv('gm_displayName').trim();
      if (dispName) newVar.displayName = dispName;
      if (document.getElementById('gm_isCore') && document.getElementById('gm_isCore').checked) newVar.isCore = true;
      if (document.getElementById('gm_inversed') && document.getElementById('gm_inversed').checked) newVar.inversed = true;
      scriptData.variables.other.push(newVar);
      renderVariables(); autoSave();
    });
  }

  function editOtherVar(i) {
    if (!scriptData.variables || !scriptData.variables.other) return;
    var c = scriptData.variables.other[i]; if (!c) return;
    var body = '<div class="form-group"><label>变量名</label><input id="gm_name" value="' + escHtml(c.name||'') + '"></div>' +
      '<div class="form-group"><label>显示名</label><input id="gm_displayName" value="' + escHtml(c.displayName||'') + '"></div>' +
      '<div style="display:flex;gap:12px;"><div class="form-group" style="flex:1;"><label>初始值</label><input id="gm_value" value="' + escHtml(c.defaultValue||'') + '"></div>' +
      '<div class="form-group" style="flex:1;"><label>单位</label><input id="gm_unit" value="' + escHtml(c.unit||'') + '"></div>' +
      '<div class="form-group" style="flex:1;"><label>最小值</label><input id="gm_min" type="number" value="' + (c.min !== undefined ? c.min : 0) + '"></div>' +
      '<div class="form-group" style="flex:1;"><label>最大值</label><input id="gm_max" type="number" value="' + (c.max !== undefined ? c.max : 100) + '"></div></div>' +
      '<div style="display:flex;gap:12px;margin-bottom:8px;">' +
      '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="gm_isCore"' + (c.isCore ? ' checked' : '') + '> 核心指标</label>' +
      '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="gm_inversed"' + (c.inversed ? ' checked' : '') + '> 反向指标</label></div>' +
      '<div class="form-group"><label>包含项（可选）</label><textarea id="gm_components" rows="3">' + escHtml(c.components||'') + '</textarea></div>' +
      '<div class="form-group"><label>说明</label><textarea id="gm_desc" rows="3">' + escHtml(c.description||'') + '</textarea></div>';
    openGenericModal('编辑其他变量', body, function() {
      c.name = gv('gm_name').trim() || c.name;
      c.displayName = gv('gm_displayName').trim() || '';
      c.defaultValue = gv('gm_value').trim();
      c.unit = gv('gm_unit').trim();
      c.min = parseFloat(gv('gm_min')) || 0;
      c.max = parseFloat(gv('gm_max')) || 100;
      c.components = gv('gm_components').trim();
      c.description = gv('gm_desc').trim();
      c.isCore = !!(document.getElementById('gm_isCore') && document.getElementById('gm_isCore').checked);
      c.inversed = !!(document.getElementById('gm_inversed') && document.getElementById('gm_inversed').checked);
      renderVariables(); autoSave();
    });
  }

  function deleteOtherVar(i) {
    if (!scriptData.variables || !scriptData.variables.other) return;
    scriptData.variables.other.splice(i, 1);
    renderVariables(); autoSave();
  }

  var _formulaTypes = {
    income: {label:'收支公式', color:'var(--celadon-400)', desc:'每回合自动计算增减项（如：国库 += 各省税收 - 军饷 - 官俸）'},
    constraint: {label:'约束条件', color:'var(--vermillion-400)', desc:'变量必须满足的硬规则（如：粮食储备 >= 0）'},
    trigger: {label:'触发规则', color:'var(--gold-400)', desc:'达到阈值时触发效果（如：粮储<100石 → 触发灾情事件）'},
    coupling: {label:'联动关系', color:'var(--indigo-400)', desc:'一个变量变化引起另一个变化（如：税赋↑10% → 民心↓5）'},
    ratio: {label:'比例/基数', color:'#a0d080', desc:'变量间的计算关系（如：军饷=兵力×2贯/人/月）'}
  };

  function addFormula() {
    var typeOptions = Object.keys(_formulaTypes).map(function(k) {
      return '<option value="'+k+'">'+_formulaTypes[k].label+'</option>';
    }).join('');
    var body = '<div class="form-group"><label>类型</label><select id="gm_type">'+typeOptions+'</select></div>'
      + '<div class="form-group"><label>公式名称</label><input id="gm_name" placeholder="如：岁入·租调钱"></div>'
      + '<div class="form-group"><label>关联变量</label><input id="gm_related" placeholder="逗号分隔，如：国库,在册丁男,租调率"></div>'
      + '<div class="form-group"><label>公式表达式</label>'
      + '<textarea id="gm_expr" rows="5" placeholder="可用自然语言或数学表达式，如：\n国库钱 += 租调钱 + 盐业收入 + 铁业收入 - 军饷 - 官俸 - 基建\n租调钱 = 在册丁男 × 租约0.87贯/丁 × 实收率\n粮储 < 100石 → 触发灾情事件"></textarea></div>'
      + '<div class="form-group"><label>链式影响（可选，每行一条）</label>'
      + '<textarea id="gm_chain" rows="3" placeholder="如：\n均田覆盖↑ → 租调基数↑ → 岁入↑\n税赋↑ → 民心↓ → 流民↑"></textarea></div>'
      + '<div class="form-group"><label>备注</label><textarea id="gm_desc" rows="2"></textarea></div>';
    openGenericModal('添加关联公式', body, function() {
      var nm = gv('gm_name').trim();
      if (!nm) { showToast('请输入公式名称'); return; }
      if (!scriptData.variables || Array.isArray(scriptData.variables)) scriptData.variables = { base:[], other:[], formulas:[] };
      var relatedStr = gv('gm_related').trim();
      var relatedVars = relatedStr ? relatedStr.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      var chainStr = gv('gm_chain').trim();
      var chains = chainStr ? chainStr.split('\n').map(function(s){return s.trim();}).filter(Boolean) : [];
      scriptData.variables.formulas.push({
        name: nm,
        type: gv('gm_type') || 'income',
        expression: gv('gm_expr').trim(),
        relatedVars: relatedVars,
        chains: chains,
        description: gv('gm_desc').trim()
      });
      renderVariables(); autoSave();
    });
  }

  function editFormula(i) {
    if (!scriptData.variables || !scriptData.variables.formulas) return;
    var c = scriptData.variables.formulas[i]; if (!c) return;
    var relatedStr = (c.relatedVars && Array.isArray(c.relatedVars)) ? c.relatedVars.join(',') : '';
    var chainStr = (c.chains && Array.isArray(c.chains)) ? c.chains.join('\n') : '';
    var typeOptions = Object.keys(_formulaTypes).map(function(k) {
      return '<option value="'+k+'"'+(c.type===k?' selected':'')+'>'+_formulaTypes[k].label+'</option>';
    }).join('');
    var body = '<div class="form-group"><label>类型</label><select id="gm_type">'+typeOptions+'</select></div>'
      + '<div class="form-group"><label>公式名称</label><input id="gm_name" value="' + escHtml(c.name||'') + '"></div>'
      + '<div class="form-group"><label>关联变量</label><input id="gm_related" value="' + escHtml(relatedStr) + '" placeholder="逗号分隔"></div>'
      + '<div class="form-group"><label>公式表达式</label><textarea id="gm_expr" rows="5">' + escHtml(c.expression||'') + '</textarea></div>'
      + '<div class="form-group"><label>链式影响</label><textarea id="gm_chain" rows="3">' + escHtml(chainStr) + '</textarea></div>'
      + '<div class="form-group"><label>备注</label><textarea id="gm_desc" rows="2">' + escHtml(c.description||'') + '</textarea></div>';
    openGenericModal('编辑关联公式', body, function() {
      c.name = gv('gm_name').trim() || c.name;
      c.type = gv('gm_type') || c.type || 'income';
      c.expression = gv('gm_expr').trim();
      var rs = gv('gm_related').trim();
      c.relatedVars = rs ? rs.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      var cs = gv('gm_chain').trim();
      c.chains = cs ? cs.split('\n').map(function(s){return s.trim();}).filter(Boolean) : [];
      c.description = gv('gm_desc').trim();
      renderVariables(); autoSave();
    });
  }

  function deleteFormula(i) {
    if (!scriptData.variables || !scriptData.variables.formulas) return;
    scriptData.variables.formulas.splice(i, 1);
    renderVariables(); autoSave();
  }

  function renderRules() {
    document.getElementById('ruleBaseText').value
      = scriptData.rules.base || '';
    document.getElementById('ruleCombatText').value
      = scriptData.rules.combat || '';
    document.getElementById('ruleEconomyText').value
      = scriptData.rules.economy || '';
    document.getElementById('ruleDiplomacyText').value
      = scriptData.rules.diplomacy || '';
    var vals = [
      scriptData.rules.base,
      scriptData.rules.combat,
      scriptData.rules.economy,
      scriptData.rules.diplomacy
    ];
    var count = 0;
    for (var i = 0; i < vals.length; i++) {
      if (vals[i]) count++;
    }
    updateBadge('rules', count);
  }

  function updateRule(k, v) {
    scriptData.rules[k] = v;
    var vals = [
      scriptData.rules.base,
      scriptData.rules.combat,
      scriptData.rules.economy,
      scriptData.rules.diplomacy
    ];
    var count = 0;
    for (var i = 0; i < vals.length; i++) {
      if (vals[i]) count++;
    }
    updateBadge('rules', count);
    autoSave();
  }

  function renderEvents() {
    var ek = [
      'historical', 'random',
      'conditional', 'story', 'chain'
    ];
    var total = 0;
    for (var i = 0; i < ek.length; i++) {
      var k = ek[i];
      var cap = k.charAt(0).toUpperCase() + k.slice(1);
      var listId = 'evt' + cap + 'List';
      var _evtArr = scriptData.events[k] || [];
      renderSimpleList(
        listId, _evtArr,
        ['name','importance','trigger','description'],
        'editEvent_' + k, 'deleteEvent_' + k
      );
      total += _evtArr.length;
    }
    updateBadge('events', total);
  }

  function addEvent(k) {
    var charOptions = (scriptData.characters||[]).map(function(c){return c.name;}).join(',');
    var facOptions = (scriptData.factions||[]).map(function(f){return f.name;}).join(',');
    var body = '';
    body += '<div class="form-group"><label>事件名称</label><input type="text" id="gm_name"></div>';
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>重要性</label><select id="gm_importance"><option value="普通">普通</option><option value="重要">重要</option><option value="关键">关键</option></select></div>';
    if (k === 'chain') body += '<div class="form-group" style="flex:1;"><label>下一事件(链式)</label><input type="text" id="gm_chainNext" placeholder="触发完成后下一个事件名"></div>';
    body += '</div>';
    body += '<div class="form-group"><label>触发条件</label><textarea id="gm_trigger" rows="2" placeholder="如：某变量>50、某角色死亡、某势力覆灭"></textarea></div>';
    body += '<div class="form-group"><label>影响/效果</label><textarea id="gm_effect" rows="2" placeholder="如：国库-5000、粮储-300、触发战争"></textarea></div>';
    body += '<div class="form-group"><label>关联角色(逗号分隔)</label><input type="text" id="gm_linkedChars" placeholder="' + (charOptions.substring(0,60)||'角色名') + '"></div>';
    body += '<div class="form-group"><label>关联势力(逗号分隔)</label><input type="text" id="gm_linkedFacs" placeholder="' + (facOptions.substring(0,60)||'势力名') + '"></div>';
    body += '<div class="form-group"><label>描述</label><textarea id="gm_desc" rows="3"></textarea></div>';
    openGenericModal('添加事件(' + k + ')', body, function() {
      var linkedCharsStr = gv('gm_linkedChars').trim();
      var linkedFacsStr = gv('gm_linkedFacs').trim();
      var d = {
        name: gv('gm_name'),
        trigger: gv('gm_trigger'),
        effect: gv('gm_effect'),
        description: gv('gm_desc'),
        importance: gv('gm_importance') || '普通',
        linkedChars: linkedCharsStr ? linkedCharsStr.split(/[,，]/).map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
        linkedFactions: linkedFacsStr ? linkedFacsStr.split(/[,，]/).map(function(s){return s.trim();}).filter(function(s){return s;}) : []
      };
      if (k === 'chain') d.chainNext = gv('gm_chainNext') || '';
      if (!d.name) {
        showToast('请输入名称'); return;
      }
      scriptData.events[k].push(d);
      closeGenericModal();
      renderEvents();
      autoSave();
      showToast('已添加');
    });
  }

  (function() {
    var ek = [
      'historical', 'random',
      'conditional', 'story', 'chain'
    ];
    for (var m = 0; m < ek.length; m++) {
      (function(k) {
        window['editEvent_' + k] = function(i) {
          var c = scriptData.events[k][i];
          var linkedCharsStr = Array.isArray(c.linkedChars) ? c.linkedChars.join(',') : (c.linkedChars||'');
          var linkedFacsStr = Array.isArray(c.linkedFactions) ? c.linkedFactions.join(',') : (c.linkedFactions||'');
          var body = '';
          body += '<div class="form-group"><label>名称</label><input type="text" id="gm_name" value="' + escHtml(c.name||'') + '"></div>';
          body += '<div style="display:flex;gap:12px;">';
          body += '<div class="form-group" style="flex:1;"><label>重要性</label><select id="gm_importance"><option value="普通"' + (c.importance==='普通'||!c.importance?' selected':'') + '>普通</option><option value="重要"' + (c.importance==='重要'?' selected':'') + '>重要</option><option value="关键"' + (c.importance==='关键'?' selected':'') + '>关键</option></select></div>';
          if (k === 'chain') body += '<div class="form-group" style="flex:1;"><label>下一事件(链式)</label><input type="text" id="gm_chainNext" value="' + escHtml(c.chainNext||'') + '"></div>';
          body += '</div>';
          body += '<div class="form-group"><label>触发条件</label><textarea id="gm_trigger" rows="2">' + escHtml(c.trigger||'') + '</textarea></div>';
          body += '<div class="form-group"><label>效果</label><textarea id="gm_effect" rows="2">' + escHtml(c.effect||'') + '</textarea></div>';
          body += '<div class="form-group"><label>关联角色</label><input type="text" id="gm_linkedChars" value="' + escHtml(linkedCharsStr) + '"></div>';
          body += '<div class="form-group"><label>关联势力</label><input type="text" id="gm_linkedFacs" value="' + escHtml(linkedFacsStr) + '"></div>';
          body += '<div class="form-group"><label>描述</label><textarea id="gm_desc" rows="3">' + escHtml(c.description||'') + '</textarea></div>';
          openGenericModal('编辑事件', body, function() {
            var _lc = gv('gm_linkedChars').trim();
            var _lf = gv('gm_linkedFacs').trim();
            var updated = {
              name: gv('gm_name'),
              trigger: gv('gm_trigger'),
              effect: gv('gm_effect'),
              description: gv('gm_desc'),
              importance: gv('gm_importance') || '普通',
              linkedChars: _lc ? _lc.split(/[,，]/).map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
              linkedFactions: _lf ? _lf.split(/[,，]/).map(function(s){return s.trim();}).filter(function(s){return s;}) : []
            };
            if (k === 'chain') updated.chainNext = gv('gm_chainNext') || '';
            scriptData.events[k][i] = updated;
            closeGenericModal();
            renderEvents();
            autoSave();
          });
        };
        window['deleteEvent_' + k] = function(i) {
          scriptData.events[k].splice(i, 1);
          renderEvents();
          autoSave();
        };
      })(ek[m]);
    }
  })();

  // A1+A2: 时间线增强
  function renderTimeline() {
    ['past','future'].forEach(function(k) {
      var listId = k === 'past' ? 'tlPastList' : 'tlFutureList';
      var el = document.getElementById(listId);
      if (!el) return;
      el.innerHTML = '';
      (scriptData.timeline[k]||[]).forEach(function(t, i) {
        var impClr = t.importance === '关键' ? 'var(--red,#c44)' : t.importance === '重要' ? 'var(--gold)' : 'var(--txt-d)';
        var h = '<div class="card" onclick="editTL_' + k + '(' + i + ')">';
        h += '<div class="card-title">' + escHtml(t.name||t.event||'') + '</div>';
        h += '<div class="card-meta">';
        if (t.year||t.date) h += '<span style="color:var(--gold);">' + escHtml(t.year||t.date) + '</span> ';
        if (t.importance) h += '<span style="font-size:10px;color:' + impClr + ';">[' + t.importance + ']</span> ';
        if (t.linkedChars) h += '<span style="font-size:10px;color:var(--txt-d);">' + escHtml(t.linkedChars) + '</span>';
        h += '</div>';
        if (t.description) h += '<div class="card-desc">' + escHtml(t.description.substring(0,60)) + '</div>';
        if (k === 'future' && t.triggerCondition) h += '<div style="font-size:10px;color:var(--blue,#4a7ab8);">触发: ' + escHtml(t.triggerCondition.substring(0,30)) + '</div>';
        h += '<div style="position:absolute;top:8px;right:8px;"><button class="btn" style="padding:2px 8px;font-size:11px;" onclick="event.stopPropagation();deleteTL_' + k + '(' + i + ')">删除</button></div>';
        h += '</div>';
        el.innerHTML += h;
      });
    });
    updateBadge('timeline', (scriptData.timeline.past||[]).length + (scriptData.timeline.future||[]).length);
  }

  function _buildTimelineForm(t, isFuture) {
    var body = '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:2;"><label>事件名 *</label><input type="text" id="tl_name" value="' + escHtml(t.name||t.event||'') + '"></div>';
    body += '<div class="form-group" style="flex:1;"><label>时间/年份</label><input type="text" id="tl_year" value="' + escHtml(t.year||t.date||'') + '" placeholder="如:建安四年春"></div>';
    body += '<div class="form-group" style="flex:1;"><label>重要程度</label><select id="tl_importance" style="width:100%;">';
    ['普通','重要','关键'].forEach(function(imp) { body += '<option value="' + imp + '"' + (t.importance === imp ? ' selected' : '') + '>' + imp + '</option>'; });
    body += '</select></div></div>';
    body += '<div class="form-group"><label>描述</label><textarea id="tl_desc" rows="3">' + escHtml(t.description||'') + '</textarea></div>';
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>关联角色</label><input type="text" id="tl_chars" value="' + escHtml(t.linkedChars||'') + '" placeholder="逗号分隔角色名"></div>';
    body += '<div class="form-group" style="flex:1;"><label>关联势力</label><input type="text" id="tl_facs" value="' + escHtml(t.linkedFactions||'') + '" placeholder="逗号分隔势力名"></div></div>';
    if (isFuture) {
      body += '<div class="form-group"><label>触发条件（供AI参考）</label><input type="text" id="tl_trigger" value="' + escHtml(t.triggerCondition||'') + '" placeholder="如：当某势力实力>80 或 某角色死亡后"></div>';
    }
    return body;
  }

  function _collectTimelineForm(isFuture) {
    var d = {
      name: gv('tl_name'), year: gv('tl_year'), importance: gv('tl_importance'),
      description: gv('tl_desc'), linkedChars: gv('tl_chars'), linkedFactions: gv('tl_facs')
    };
    if (isFuture) d.triggerCondition = gv('tl_trigger');
    return d;
  }

  function addTimeline(k) {
    var isFuture = k === 'future';
    var body = _buildTimelineForm({}, isFuture);
    openGenericModal('添加' + (isFuture ? '未来事件' : '历史事件'), body, function() {
      var d = _collectTimelineForm(isFuture);
      d.type = k;
      if (!d.name) { showToast('请输入事件名'); return; }
      scriptData.timeline[k].push(d);
      closeGenericModal(); renderTimeline(); autoSave(); showToast('已添加');
    });
  }

  (function() {
    ['past','future'].forEach(function(k) {
      var isFuture = k === 'future';
      window['editTL_' + k] = function(i) {
        var c = scriptData.timeline[k][i];
        var body = _buildTimelineForm(c, isFuture);
        openGenericModal('编辑事件', body, function() {
          var d = _collectTimelineForm(isFuture);
          d.type = k;
          // 保留旧字段
          if (c.triggered) d.triggered = c.triggered;
          scriptData.timeline[k][i] = d;
          closeGenericModal(); renderTimeline(); autoSave();
        });
      };
      window['deleteTL_' + k] = function(i) {
        scriptData.timeline[k].splice(i, 1);
        renderTimeline(); autoSave();
      };
    });
  })();

// ============================================================
// 目标/胜负条件 编辑
// ============================================================

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
      var arr = JSON.parse(c.match(/\[[\s\S]*\]/)[0]);
      if (Array.isArray(arr)) { scriptData.goals = (scriptData.goals || []).concat(arr); renderGoalsList(); showToast('已生成 ' + arr.length + ' 个目标条件'); if (typeof autoSave === 'function') autoSave(); }
    } catch(e) { showToast('解析失败'); }
  }).catch(function(e) { hideLoading(); showToast('生成失败: ' + e.message); });
}

// ============================================================
// 初始皇命（钉子条目）编辑·对应 GM._memTables.imperialEdict 表
// ============================================================

function renderImperialEdictsList() {
  if (!scriptData.imperialEdicts) scriptData.imperialEdicts = [];
  var el = document.getElementById('imperialEdicts-list');
  if (!el) return;
  if (scriptData.imperialEdicts.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">暂无初始皇命·点击下方添加</div>';
    return;
  }
  var html = '';
  scriptData.imperialEdicts.forEach(function(e, i) {
    html += '<div class="card" style="border-left:3px solid var(--gold);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<strong style="color:var(--gold);">[优先级 ' + (e.priority || 5) + '] ' + escHtml((e.content || '').slice(0, 40)) + (e.content && e.content.length > 40 ? '…' : '') + '</strong>';
    html += '</div>';
    html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:8px;">' + escHtml(e.content || '') + '</div>';
    if (e.condition) html += '<div style="font-size:11px;color:var(--text-dim);">生效条件：' + escHtml(e.condition) + '</div>';
    html += '<div style="margin-top:8px;display:flex;gap:6px;">';
    html += '<button class="btn btn-small" onclick="editImperialEdictEntry(' + i + ')">编辑</button>';
    html += '<button class="btn btn-small btn-danger" onclick="deleteImperialEdictEntry(' + i + ')">删除</button>';
    html += '</div></div>';
  });
  el.innerHTML = html;
}

function addImperialEdictEntry() {
  if (!scriptData.imperialEdicts) scriptData.imperialEdicts = [];
  scriptData.imperialEdicts.push({
    priority: 5,
    content: '（在此输入皇命内容·如：祖训不可改）',
    condition: '永久生效',
    startTurn: 1
  });
  renderImperialEdictsList();
  editImperialEdictEntry(scriptData.imperialEdicts.length - 1);
}

function editImperialEdictEntry(idx) {
  var e = scriptData.imperialEdicts[idx];
  if (!e) return;
  var html = '<div class="form-group"><label>优先级（1-10·数值越大越优先）</label><input id="ie-pri" type="number" min="1" max="10" value="' + (e.priority || 5) + '"></div>';
  html += '<div class="form-group"><label>皇命内容（祖训/先帝遗诏/禁忌等·AI 不可改写）</label><textarea id="ie-content" rows="4">' + escHtml(e.content || '') + '</textarea></div>';
  html += '<div class="form-group"><label>生效条件（永久/至 T<n>/某事件后等·留空默认永久）</label><input id="ie-cond" value="' + escHtml(e.condition || '') + '"></div>';
  html += '<div class="form-group"><label>颁布回合</label><input id="ie-turn" type="number" min="1" value="' + (e.startTurn || 1) + '"></div>';
  showGenericModal('编辑初始皇命', html, function() {
    e.priority = parseInt(gv('ie-pri'), 10) || 5;
    e.content = gv('ie-content');
    e.condition = gv('ie-cond') || '永久生效';
    e.startTurn = parseInt(gv('ie-turn'), 10) || 1;
    renderImperialEdictsList();
    if (typeof autoSave === 'function') autoSave();
  });
}

function deleteImperialEdictEntry(idx) {
  if (!confirm('删除此条初始皇命？')) return;
  scriptData.imperialEdicts.splice(idx, 1);
  renderImperialEdictsList();
  if (typeof autoSave === 'function') autoSave();
}

// ============================================================
// 得罪群体 编辑
// ============================================================

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
      var arr = JSON.parse(c.match(/\[[\s\S]*\]/)[0]);
      if (Array.isArray(arr)) { scriptData.offendGroups.groups = (scriptData.offendGroups.groups || []).concat(arr); scriptData.offendGroups.enabled = true; var chk = document.getElementById('offendGroups-enabled'); if (chk) chk.checked = true; renderOffendGroupsList(); showToast('已生成 ' + arr.length + ' 个利益集团'); if (typeof autoSave === 'function') autoSave(); }
    } catch(e) { showToast('解析失败'); }
  }).catch(function(e) { hideLoading(); showToast('生成失败: ' + e.message); });
}

// ============================================================
// 面板切换时渲染新面板
// ============================================================

(function() {
  // 监听面板切换，渲染新增面板
  var _origSidebarInit = false;
  document.addEventListener('click', function(e) {
    var item = e.target.closest && e.target.closest('.sidebar-item');
    if (!item) return;
    var panel = item.dataset.panel;
    if (panel === 'goals') setTimeout(renderGoalsList, 50);
    else if (panel === 'offendGroups') setTimeout(renderOffendGroupsList, 50);
    else if (panel === 'kejuSystem') setTimeout(function() {
      var k = scriptData.keju || {};
      var _s = function(id, val) { var e = document.getElementById(id); if (e) e.value = val || ''; };
      var _c = function(id, val) { var e = document.getElementById(id); if (e) e.checked = !!val; };
      _c('keju-enabled', k.enabled);
      _c('keju-reformed', k.reformed);
      _s('keju-examInterval', k.examIntervalNote);
      _s('keju-quota', k.quotaPerExam);
      _s('keju-subjects', k.examSubjects);
      _s('keju-specialRules', k.specialRules);
      _s('keju-examNote', k.examNote);
    }, 50);
  });

  // ============================================================
  // 后宫位份渲染
  // ============================================================
  // 位分级别视觉色（按尊卑）
  function _haremRankColor(level) {
    if (level <= 1) return '#ffd700'; // 皇后金
    if (level === 2) return '#e74c3c'; // 皇贵妃红
    if (level === 3) return '#9b59b6'; // 贵妃紫
    if (level <= 5) return '#3498db'; // 妃/嫔蓝
    if (level <= 7) return '#16a085'; // 贵人/常在绿
    return '#95a5a6';                  // 低位灰
  }

  window.renderHaremConfig = function() {
    var el = document.getElementById('haremRanksList');
    if (!el) return;
    var hc = scriptData.haremConfig || {rankSystem:[], succession:'eldest_legitimate'};
    // 老位分字段迁移：无 stipend/privileges/rituals 数组时补默认，避免 UI 显示异常
    if (hc.rankSystem && Array.isArray(hc.rankSystem)) {
      hc.rankSystem.forEach(function(r) {
        if (!r.stipend || typeof r.stipend !== 'object') r.stipend = {};
        if (r.privileges && typeof r.privileges === 'string') {
          r.privileges = r.privileges.split(/[、，,\/]/).map(function(s){return s.trim();}).filter(Boolean);
        }
        if (!Array.isArray(r.privileges)) r.privileges = [];
        if (r.alias && typeof r.alias === 'string') r.alias = [r.alias];
        if (!Array.isArray(r.alias)) r.alias = [];
        if (r.rituals && typeof r.rituals === 'string') r.rituals = [r.rituals];
        if (!Array.isArray(r.rituals)) r.rituals = [];
        if (!r.residenceLevel) r.residenceLevel = r.level <= 2 ? 'main' : r.level <= 5 ? 'side' : 'shared';
        if (r.canBearHeir === undefined) r.canBearHeir = true;
      });
    }
    var sel = document.getElementById('harem-succession');
    if (sel) sel.value = hc.succession || 'eldest_legitimate';
    var descEl = document.getElementById('harem-description');
    if (descEl) descEl.value = hc.haremDescription || '';
    var mcEl = document.getElementById('harem-motherClan');
    if (mcEl) mcEl.value = hc.motherClanSystem || '';
    var snEl = document.getElementById('harem-successionNote');
    if (snEl) snEl.value = hc.successionNote || '';
    if (!hc.rankSystem || hc.rankSystem.length === 0) {
      el.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:12px;text-align:center;">暂无位份配置。点击"🤖 AI 生成后宫位份"按朝代自动生成完整位分体系。</div>';
      return;
    }
    // 按level排序
    hc.rankSystem.sort(function(a, b) { return (a.level||0) - (b.level||0); });
    // 统计占用（结合GM.chars.rankLevel——若已在游戏中）
    el.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">按尊卑排序（level越小越尊） · 共 <b style="color:var(--gold,#c9a849);">' + hc.rankSystem.length + '</b> 级</div>'
      + hc.rankSystem.map(function(r, i) {
        var color = _haremRankColor(r.level || 5);
        var quota = r.maxCount || r.quota || 0;
        var quotaText = quota > 0 ? '编制 <b>' + quota + '</b> 人' : '不限';
        var stipend = r.stipend || {};
        var stipendText = '';
        if (stipend.silver || stipend.rice) {
          stipendText = '银' + (stipend.silver||0) + '两/年 · 米' + (stipend.rice||0) + '石/年';
        }
        return '<div style="padding:10px 12px;margin-bottom:6px;background:var(--bg-tertiary);border-left:4px solid ' + color + ';border-radius:4px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
          + '<div><span style="font-size:15px;color:' + color + ';font-weight:700;">' + (r.icon || '') + ' ' + escHtml(r.name) + '</span>'
          + '<span style="margin-left:8px;font-size:11px;color:var(--text-secondary);padding:2px 6px;background:rgba(255,255,255,0.05);border-radius:3px;">Lv' + (r.level||0) + '</span>'
          + '<span style="margin-left:4px;font-size:11px;color:var(--text-secondary);">' + quotaText + '</span>'
          + (r.creationDynasty ? '<span style="margin-left:4px;font-size:10px;color:#888;">（' + escHtml(r.creationDynasty) + '始设）</span>' : '')
          + '</div>'
          + '<div style="display:flex;gap:4px;">'
          + '<button class="btn btn-sm" onclick="_editHaremRank(' + i + ')" title="编辑">\u7F16</button>'
          + '<button class="btn btn-sm btn-danger" onclick="scriptData.haremConfig.rankSystem.splice(' + i + ',1);renderHaremConfig();autoSave();">\u5220</button>'
          + '</div></div>'
          + (r.alias ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">称谓：' + escHtml(Array.isArray(r.alias)?r.alias.join('、'):r.alias) + (r.selfAddress?(' · 自称'+escHtml(r.selfAddress)):'') + '</div>' : '')
          + (stipendText ? '<div style="font-size:11px;color:#d4a04c;margin-top:2px;">俸禄：' + stipendText + (r.servantCount?' · 随侍'+r.servantCount+'人':'') + '</div>' : '')
          + (r.dressCode ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">服饰：' + escHtml(r.dressCode.substring(0,60)) + '</div>' : '')
          + (r.privileges ? '<div style="font-size:11px;color:#9b59b6;margin-top:2px;">特权：' + escHtml(Array.isArray(r.privileges)?r.privileges.join('、'):r.privileges) + '</div>' : '')
          + (r.residenceLevel ? '<div style="font-size:11px;color:#16a085;margin-top:2px;">居所：' + ({main:'主殿独居',side:'偏殿居住',shared:'合住'}[r.residenceLevel]||r.residenceLevel) + (r.motherClanInfluence?' · 母族影响'+Math.round(r.motherClanInfluence*100)+'%':'') + '</div>' : '')
          + '</div>';
      }).join('');
  };

  // 打开位分编辑弹窗——分组布局
  function _haremRankModal(rankData, saveCallback) {
    var r = rankData || { id:'rank_'+Date.now(), name:'', level:1, maxCount:0 };
    var stipend = r.stipend || {};
    var privileges = Array.isArray(r.privileges) ? r.privileges.join('、') : (r.privileges || '');
    var alias = Array.isArray(r.alias) ? r.alias.join('、') : (r.alias || '');
    var rituals = Array.isArray(r.rituals) ? r.rituals.join('、') : (r.rituals || '');
    var html = '<div style="max-height:70vh;overflow-y:auto;">'
      // 基本信息
      + '<div style="background:rgba(255,215,0,0.05);border-left:3px solid #ffd700;padding:8px 12px;margin-bottom:10px;border-radius:4px;">'
      + '<div style="font-size:12px;color:#ffd700;font-weight:700;margin-bottom:6px;">◆ 基本信息</div>'
      + '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;">'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">位分名（如皇后/皇贵妃/妃）</label><input id="_hr_name" value="' + escHtml(r.name||'') + '" style="width:100%;"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">尊卑级(1最尊)</label><input id="_hr_level" type="number" min="1" max="12" value="' + (r.level||1) + '" style="width:100%;"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">编制人数(0不限)</label><input id="_hr_maxCount" type="number" min="0" value="' + (r.maxCount||r.quota||0) + '" style="width:100%;"></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px;">'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">图标</label><input id="_hr_icon" value="' + escHtml(r.icon||'') + '" placeholder="如👑" style="width:100%;"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">他称(以/分)</label><input id="_hr_alias" value="' + escHtml(alias) + '" placeholder="如皇后娘娘/国母" style="width:100%;"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">自称</label><input id="_hr_selfAddress" value="' + escHtml(r.selfAddress||'') + '" placeholder="如本宫/哀家" style="width:100%;"></div>'
      + '</div>'
      + '<div style="margin-top:6px;"><label style="font-size:11px;color:var(--text-secondary);">始设朝代（可留空）</label><input id="_hr_creationDynasty" value="' + escHtml(r.creationDynasty||'') + '" placeholder="如明/清" style="width:100%;"></div>'
      + '</div>'
      // 待遇
      + '<div style="background:rgba(212,160,76,0.05);border-left:3px solid #d4a04c;padding:8px 12px;margin-bottom:10px;border-radius:4px;">'
      + '<div style="font-size:12px;color:#d4a04c;font-weight:700;margin-bottom:6px;">◆ 待遇（俸禄·随侍·服饰）</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">银两/年</label><input id="_hr_silver" type="number" min="0" value="' + (stipend.silver||0) + '" style="width:100%;"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">米/石/年</label><input id="_hr_rice" type="number" min="0" value="' + (stipend.rice||0) + '" style="width:100%;"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">布匹/年</label><input id="_hr_cloth" type="number" min="0" value="' + (stipend.cloth||0) + '" style="width:100%;"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">随侍人数</label><input id="_hr_servantCount" type="number" min="0" value="' + (r.servantCount||0) + '" style="width:100%;"></div>'
      + '</div>'
      + '<div style="margin-top:6px;"><label style="font-size:11px;color:var(--text-secondary);">服饰规制</label><textarea id="_hr_dressCode" rows="2" placeholder="如：凤冠霞帔、金黄色九龙九凤冠、明黄盘龙袍" style="width:100%;">' + escHtml(r.dressCode||'') + '</textarea></div>'
      + '</div>'
      // 居所与地位
      + '<div style="background:rgba(22,160,133,0.05);border-left:3px solid #16a085;padding:8px 12px;margin-bottom:10px;border-radius:4px;">'
      + '<div style="font-size:12px;color:#16a085;font-weight:700;margin-bottom:6px;">◆ 居所与母族</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">居所等级</label>'
      + '<select id="_hr_residenceLevel" style="width:100%;">'
      + '<option value="main"' + (r.residenceLevel==='main'?' selected':'') + '>主殿独居</option>'
      + '<option value="side"' + (r.residenceLevel==='side'?' selected':'') + '>偏殿</option>'
      + '<option value="shared"' + (r.residenceLevel==='shared'?' selected':'') + '>合住</option>'
      + '</select></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">母族影响力(0-1)</label><input id="_hr_mci" type="number" step="0.1" min="0" max="1" value="' + (r.motherClanInfluence||0.3) + '" style="width:100%;"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">子嗣可入继大统</label>'
      + '<select id="_hr_canBearHeir" style="width:100%;">'
      + '<option value="true"' + (r.canBearHeir!==false?' selected':'') + '>是</option>'
      + '<option value="false"' + (r.canBearHeir===false?' selected':'') + '>否</option>'
      + '</select></div>'
      + '</div>'
      + '</div>'
      // 特权与礼制
      + '<div style="background:rgba(155,89,182,0.05);border-left:3px solid #9b59b6;padding:8px 12px;margin-bottom:10px;border-radius:4px;">'
      + '<div style="font-size:12px;color:#9b59b6;font-weight:700;margin-bottom:6px;">◆ 特权与礼制</div>'
      + '<div style="margin-bottom:6px;"><label style="font-size:11px;color:var(--text-secondary);">特权（多项用顿号分隔）</label><textarea id="_hr_privileges" rows="2" placeholder="如：参与朝政、教养皇子、独居宫殿、可封母族" style="width:100%;">' + escHtml(privileges) + '</textarea></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">参与礼制</label><input id="_hr_rituals" value="' + escHtml(rituals) + '" placeholder="如：朝贺、祭祀随侍、册立典礼" style="width:100%;"></div>'
      + '</div>'
      + '</div>';
    openEditorModal(r.name ? '编辑位分：' + r.name : '添加后宫位分', html, function() {
      var _g = function(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
      var name = _g('_hr_name'); if (!name) return;
      var data = {
        id: r.id || 'rank_' + Date.now(),
        name: name,
        level: parseInt(_g('_hr_level')) || 1,
        maxCount: parseInt(_g('_hr_maxCount')) || 0,
        icon: _g('_hr_icon'),
        alias: _g('_hr_alias').split(/[、，,\/]/).filter(function(s){return s.trim();}).map(function(s){return s.trim();}),
        selfAddress: _g('_hr_selfAddress'),
        creationDynasty: _g('_hr_creationDynasty'),
        stipend: {
          silver: parseInt(_g('_hr_silver')) || 0,
          rice: parseInt(_g('_hr_rice')) || 0,
          cloth: parseInt(_g('_hr_cloth')) || 0
        },
        servantCount: parseInt(_g('_hr_servantCount')) || 0,
        dressCode: _g('_hr_dressCode'),
        residenceLevel: _g('_hr_residenceLevel') || 'shared',
        motherClanInfluence: parseFloat(_g('_hr_mci')) || 0.3,
        canBearHeir: _g('_hr_canBearHeir') !== 'false',
        privileges: _g('_hr_privileges').split(/[、，,\/]/).filter(function(s){return s.trim();}).map(function(s){return s.trim();}),
        rituals: _g('_hr_rituals').split(/[、，,\/]/).filter(function(s){return s.trim();}).map(function(s){return s.trim();})
      };
      saveCallback(data);
    });
  }

  window._addHaremRank = function() {
    if (!scriptData.haremConfig) scriptData.haremConfig = {rankSystem:[], succession:'eldest_legitimate'};
    if (!scriptData.haremConfig.rankSystem) scriptData.haremConfig.rankSystem = [];
    var maxLevel = 0;
    scriptData.haremConfig.rankSystem.forEach(function(r) { if (r.level > maxLevel) maxLevel = r.level; });
    _haremRankModal({ id:'rank_'+Date.now(), level: maxLevel+1 }, function(data) {
      scriptData.haremConfig.rankSystem.push(data);
      scriptData.haremConfig.rankSystem.sort(function(a, b) { return a.level - b.level; });
      renderHaremConfig();
      autoSave();
    });
  };

  window._editHaremRank = function(idx) {
    var r = scriptData.haremConfig && scriptData.haremConfig.rankSystem && scriptData.haremConfig.rankSystem[idx];
    if (!r) return;
    _haremRankModal(r, function(data) {
      scriptData.haremConfig.rankSystem[idx] = data;
      scriptData.haremConfig.rankSystem.sort(function(a, b) { return a.level - b.level; });
      renderHaremConfig();
      autoSave();
    });
  };

  // ── AI 按朝代智能生成后宫位分体系 ──
  window.aiGenerateHaremRanks = async function() {
    if (!P.ai || !P.ai.key) { alert('请先配置AI'); return; }
    var dynasty = scriptData.dynasty || '';
    var year = scriptData.gameSettings && scriptData.gameSettings.startYear;
    if (!dynasty) { alert('请先在剧本设置中填写朝代'); return; }
    var prompt = '你是中国古代宫廷礼制专家。请根据以下朝代为该剧本生成完整、严谨、符合史实的后宫位分体系。\n\n'
      + '【朝代】' + dynasty + (year ? (' 起始年份：' + year) : '') + '\n\n'
      + '【历代后宫制度参考】\n'
      + '- 周：后/三夫人/九嫔/二十七世妇/八十一御妻\n'
      + '- 汉：皇后/昭仪/婕妤/娥/容华/美人/八子/充依/良人等十余级\n'
      + '- 唐：皇后/四夫人(贵淑德贤妃)/九嫔/九婕妤/九美人/九才人\n'
      + '- 宋：皇后/贵妃/妃/婕妤/美人/才人/贵仪/顺仪等\n'
      + '- 明：皇后/皇贵妃/贵妃/妃/嫔/选侍/淑女等（皇贵妃为明朝独创）\n'
      + '- 清：皇后/皇贵妃(1)/贵妃(2)/妃(4)/嫔(6)/贵人/常在/答应/官女子\n\n'
      + '请严格按该朝代史实生成 6-10 级位分，返回纯JSON：\n'
      + '{\n'
      + '  "rankSystem": [\n'
      + '    {\n'
      + '      "id": "rank_huanghou",\n'
      + '      "name": "皇后",\n'
      + '      "level": 1,\n'
      + '      "maxCount": 1,\n'
      + '      "icon": "👑",\n'
      + '      "alias": ["皇后娘娘","国母","中宫"],\n'
      + '      "selfAddress": "本宫",\n'
      + '      "stipend": {"silver": 1000, "rice": 800, "cloth": 80},\n'
      + '      "servantCount": 20,\n'
      + '      "dressCode": "凤冠霞帔……（该朝代具体服饰规制）",\n'
      + '      "residenceLevel": "main",\n'
      + '      "rituals": ["朝贺","祭祀主祭","册立典礼"],\n'
      + '      "privileges": ["统摄六宫","参与朝政","册封母族","与帝同居主殿"],\n'
      + '      "motherClanInfluence": 0.8,\n'
      + '      "canBearHeir": true,\n'
      + '      "creationDynasty": "' + dynasty + '"\n'
      + '    }\n'
      + '  ]\n'
      + '}\n\n'
      + '要求：\n'
      + '1. 必须符合该朝代真实历史——如明代要有"皇贵妃"，清代要到"官女子"，汉代要用"昭仪/婕妤"等古称\n'
      + '2. level从1(皇后)开始递增，越尊贵数字越小\n'
      + '3. maxCount按史实：皇后1、皇贵妃1、贵妃2、妃4、嫔6、贵人以下不限\n'
      + '4. dressCode要具体描述该朝代该位分的服饰规制（凤冠/霞帔/品级珠数等）\n'
      + '5. stipend按该朝代标准：皇后最丰、逐级递减\n'
      + '6. privileges详细列出特权（参朝/教子/母族/居所）\n'
      + '7. residenceLevel：皇后皇贵妃贵妃=main；妃嫔=side；贵人以下=shared\n'
      + '8. 只返回JSON，不要任何其他文字';
    showLoading('AI生成后宫位分...');
    try {
      var _callFn = (typeof callAIEditor === 'function') ? callAIEditor : (typeof callAISmart === 'function') ? callAISmart : (typeof callAI === 'function') ? callAI : null;
      if (!_callFn) throw new Error('AI调用不可用');
      var content = await _callFn(prompt, 4000);
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('无法解析JSON');
      var result = JSON.parse(m[0]);
      if (!result.rankSystem || !Array.isArray(result.rankSystem)) throw new Error('格式不正确');
      if (!scriptData.haremConfig) scriptData.haremConfig = {rankSystem:[], succession:'eldest_legitimate'};
      scriptData.haremConfig.rankSystem = result.rankSystem.map(function(r) {
        return {
          id: r.id || 'rank_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
          name: r.name || '',
          level: parseInt(r.level) || 1,
          maxCount: parseInt(r.maxCount) || 0,
          icon: r.icon || '',
          alias: Array.isArray(r.alias) ? r.alias : (r.alias ? [r.alias] : []),
          selfAddress: r.selfAddress || '',
          stipend: r.stipend || {},
          servantCount: parseInt(r.servantCount) || 0,
          dressCode: r.dressCode || '',
          residenceLevel: r.residenceLevel || 'shared',
          rituals: Array.isArray(r.rituals) ? r.rituals : (r.rituals ? [r.rituals] : []),
          privileges: Array.isArray(r.privileges) ? r.privileges : (r.privileges ? [r.privileges] : []),
          motherClanInfluence: parseFloat(r.motherClanInfluence) || 0.3,
          canBearHeir: r.canBearHeir !== false,
          creationDynasty: r.creationDynasty || dynasty
        };
      });
      scriptData.haremConfig.rankSystem.sort(function(a, b) { return a.level - b.level; });
      autoSave();
      renderHaremConfig();
      showToast('已生成 ' + result.rankSystem.length + ' 级后宫位分');
    } catch(e) {
      console.error('[AI后宫位分]', e);
      showToast('生成失败：' + (e.message || e));
    } finally { hideLoading(); }
  };

  // ============================================================
  // 皇城宫殿系统（中国古代皇家建筑群）
  // ============================================================
  var PALACE_TYPES = {
    main_hall: { label:'外朝主殿', color:'#ffd700', desc:'皇帝朝会/大典' },
    imperial_residence: { label:'帝居宫殿', color:'#e74c3c', desc:'皇帝日常寝宫' },
    consort_residence: { label:'后妃居所', color:'#9b59b6', desc:'妃嫔居住' },
    dowager: { label:'太后/太妃宫', color:'#d4a04c', desc:'太后/太妃居所' },
    crown_prince: { label:'太子宫', color:'#3498db', desc:'太子/皇子读书居住' },
    ceremonial: { label:'礼制建筑', color:'#95a5a6', desc:'祭祀/册立大典场所' },
    garden: { label:'园林行宫', color:'#16a085', desc:'游幸避暑' },
    office: { label:'内廷办公', color:'#7f8c8d', desc:'内阁/司礼监等' },
    offering: { label:'祭祀宗庙', color:'#c0392b', desc:'太庙/奉先殿等' }
  };

  window.renderPalaceSystem = function() {
    var el = document.getElementById('palacesList');
    if (!el) return;
    var ps = scriptData.palaceSystem || {palaces:[]};
    var capName = document.getElementById('palace-capitalName');
    if (capName) capName.value = ps.capitalName || '';
    var enSel = document.getElementById('palace-enabled');
    if (enSel) enSel.value = ps.enabled ? 'true' : 'false';
    var capDesc = document.getElementById('palace-capitalDescription');
    if (capDesc) capDesc.value = ps.capitalDescription || '';
    if (!ps.palaces || ps.palaces.length === 0) {
      el.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:12px;text-align:center;">暂无宫殿配置。点击"🤖 AI 按朝代生成"自动生成完整皇城宫殿群。</div>';
      return;
    }
    // 按type分组
    var groups = {};
    ps.palaces.forEach(function(p) {
      var t = p.type || 'main_hall';
      if (!groups[t]) groups[t] = [];
      groups[t].push(p);
    });
    var html = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">共 <b style="color:var(--gold,#c9a849);">' + ps.palaces.length + '</b> 处宫殿 · 按功能分组</div>';
    Object.keys(PALACE_TYPES).forEach(function(t) {
      var grp = groups[t]; if (!grp || grp.length === 0) return;
      var info = PALACE_TYPES[t];
      html += '<div style="margin-bottom:10px;">';
      html += '<div style="font-size:13px;color:' + info.color + ';font-weight:700;margin-bottom:4px;padding:4px 0;border-bottom:1px solid ' + info.color + '44;">◆ ' + info.label + ' <span style="font-size:11px;color:var(--text-secondary);font-weight:normal;">· ' + info.desc + '</span></div>';
      grp.forEach(function(pal, gi) {
        var realIdx = ps.palaces.indexOf(pal);
        var occCount = 0;
        if (pal.subHalls) pal.subHalls.forEach(function(sh) { if (sh.occupants) occCount += sh.occupants.length; });
        html += '<div style="padding:8px 10px;margin-bottom:4px;background:var(--bg-tertiary);border-left:3px solid ' + info.color + ';border-radius:3px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div><span style="font-size:14px;color:' + info.color + ';font-weight:700;">' + escHtml(pal.name) + '</span>';
        if (pal.location) html += '<span style="margin-left:8px;font-size:11px;color:var(--text-secondary);">📍' + escHtml(pal.location) + '</span>';
        if (pal.status && pal.status !== 'intact') {
          var statusMap = { damaged:'损坏', ruined:'荒废', underconstruction:'在建' };
          html += '<span style="margin-left:6px;font-size:10px;color:#e74c3c;">[' + (statusMap[pal.status] || pal.status) + ']</span>';
        }
        html += '</div>';
        html += '<div style="display:flex;gap:4px;">';
        html += '<button class="btn btn-sm" onclick="_editPalace(' + realIdx + ')">编</button>';
        html += '<button class="btn btn-sm btn-danger" onclick="scriptData.palaceSystem.palaces.splice(' + realIdx + ',1);renderPalaceSystem();autoSave();">删</button>';
        html += '</div></div>';
        if (pal.function) html += '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">功能：' + escHtml(pal.function) + '</div>';
        if (pal.description) html += '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">' + escHtml(pal.description.substring(0, 100)) + (pal.description.length > 100 ? '…' : '') + '</div>';
        // 主殿偏殿
        if (pal.subHalls && pal.subHalls.length > 0) {
          html += '<div style="margin-top:4px;padding-left:12px;font-size:11px;">';
          pal.subHalls.forEach(function(sh) {
            var roleLabel = { main:'主殿', side:'偏殿', attached:'附殿' }[sh.role] || sh.role;
            var shColor = sh.role === 'main' ? '#ffd700' : sh.role === 'side' ? '#9b59b6' : '#16a085';
            html += '<div style="color:' + shColor + ';margin-bottom:1px;">├ <b>' + escHtml(sh.name) + '</b> <span style="color:var(--text-secondary);">(' + roleLabel + '，容' + (sh.capacity||1) + '人)</span>';
            if (sh.rankRestriction && sh.rankRestriction.length > 0) html += ' <span style="color:var(--text-dim);">[限:' + sh.rankRestriction.join('/') + ']</span>';
            if (sh.occupants && sh.occupants.length > 0) html += ' <span style="color:#4ade80;">居:' + sh.occupants.join('、') + '</span>';
            html += '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    });
    el.innerHTML = html;
  };

  function _palaceModal(palData, saveCb) {
    var p = palData || { id:'pal_'+Date.now(), name:'', type:'main_hall', subHalls:[] };
    var subHallsHtml = (p.subHalls || []).map(function(sh, i) {
      return '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 2fr auto;gap:4px;align-items:center;margin-bottom:3px;" data-sh-idx="' + i + '">'
        + '<input placeholder="殿名" value="' + escHtml(sh.name||'') + '" class="_sh_name">'
        + '<select class="_sh_role"><option value="main"' + (sh.role==='main'?' selected':'') + '>主殿</option><option value="side"' + (sh.role==='side'?' selected':'') + '>偏殿</option><option value="attached"' + (sh.role==='attached'?' selected':'') + '>附殿</option></select>'
        + '<input type="number" min="1" placeholder="容量" value="' + (sh.capacity||1) + '" class="_sh_cap">'
        + '<input placeholder="限位分(如妃/嫔,以、分)" value="' + escHtml((sh.rankRestriction||[]).join('、')) + '" class="_sh_rank">'
        + '<button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>'
        + '</div>';
    }).join('');
    var typeOpts = Object.keys(PALACE_TYPES).map(function(k) {
      return '<option value="' + k + '"' + (p.type===k?' selected':'') + '>' + PALACE_TYPES[k].label + '</option>';
    }).join('');
    var html = '<div style="max-height:70vh;overflow-y:auto;">'
      + '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;margin-bottom:8px;">'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">宫殿名</label><input id="_p_name" value="' + escHtml(p.name||'') + '" placeholder="如乾清宫"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">类型</label><select id="_p_type">' + typeOpts + '</select></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">状态</label>'
      + '<select id="_p_status"><option value="intact"' + (p.status==='intact'||!p.status?' selected':'') + '>完好</option><option value="damaged"' + (p.status==='damaged'?' selected':'') + '>损坏</option><option value="ruined"' + (p.status==='ruined'?' selected':'') + '>荒废</option><option value="underconstruction"' + (p.status==='underconstruction'?' selected':'') + '>在建</option></select></div>'
      + '</div>'
      + '<div style="margin-bottom:6px;"><label style="font-size:11px;color:var(--text-secondary);">位置</label><input id="_p_location" value="' + escHtml(p.location||'') + '" placeholder="如内廷中轴/东六宫区域"></div>'
      + '<div style="margin-bottom:6px;"><label style="font-size:11px;color:var(--text-secondary);">主要功能</label><input id="_p_function" value="' + escHtml(p.function||'') + '" placeholder="如皇帝寝宫与日常议政"></div>'
      + '<div style="margin-bottom:6px;"><label style="font-size:11px;color:var(--text-secondary);">历史描述</label><textarea id="_p_description" rows="2">' + escHtml(p.description||'') + '</textarea></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:6px;">'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">月维护费</label><input id="_p_maintainCost" type="number" min="0" value="' + (p.maintainCost||0) + '"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">始建年</label><input id="_p_builtYear" type="number" value="' + (p.builtYear||0) + '"></div>'
      + '<div><label style="font-size:11px;color:var(--text-secondary);">规模等级</label><input id="_p_level" type="number" min="1" max="5" value="' + (p.level||1) + '"></div>'
      + '</div>'
      + '<div style="background:rgba(155,89,182,0.05);border-left:3px solid #9b59b6;padding:8px;border-radius:4px;margin-top:8px;">'
      + '<div style="font-size:12px;color:#9b59b6;font-weight:700;margin-bottom:6px;">◆ 主殿/偏殿/附殿（居所细分）</div>'
      + '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">一座宫殿可分主殿+若干偏殿附殿，妃嫔按位分分别居住</div>'
      + '<div id="_p_subHalls">' + subHallsHtml + '</div>'
      + '<button class="btn btn-sm" onclick="var c=document.getElementById(\'_p_subHalls\');var d=document.createElement(\'div\');d.style.cssText=\'display:grid;grid-template-columns:2fr 1fr 1fr 2fr auto;gap:4px;align-items:center;margin-bottom:3px;\';d.innerHTML=&quot;<input placeholder=殿名 class=_sh_name><select class=_sh_role><option value=main>主殿</option><option value=side>偏殿</option><option value=attached>附殿</option></select><input type=number min=1 value=1 placeholder=容量 class=_sh_cap><input placeholder=限位分 class=_sh_rank><button class=&apos;btn btn-sm btn-danger&apos; onclick=this.parentElement.remove()>×</button>&quot;;c.appendChild(d);" style="margin-top:6px;">+ 添加殿</button>'
      + '</div>'
      + '</div>';
    openEditorModal(p.name ? '编辑宫殿：' + p.name : '添加宫殿', html, function() {
      var _g = function(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
      var subHalls = [];
      var shRows = document.querySelectorAll('#_p_subHalls > div');
      shRows.forEach(function(row) {
        var n = row.querySelector('._sh_name').value.trim(); if (!n) return;
        var rank = row.querySelector('._sh_rank').value.trim();
        subHalls.push({
          id: 'sh_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
          name: n,
          role: row.querySelector('._sh_role').value,
          capacity: parseInt(row.querySelector('._sh_cap').value) || 1,
          occupants: [],
          rankRestriction: rank ? rank.split(/[、，,\/]/).map(function(s){return s.trim();}).filter(Boolean) : []
        });
      });
      saveCb({
        id: p.id || 'pal_' + Date.now(),
        name: _g('_p_name'),
        type: _g('_p_type') || 'main_hall',
        function: _g('_p_function'),
        description: _g('_p_description'),
        location: _g('_p_location'),
        maintainCost: parseInt(_g('_p_maintainCost')) || 0,
        builtYear: parseInt(_g('_p_builtYear')) || 0,
        level: parseInt(_g('_p_level')) || 1,
        status: _g('_p_status') || 'intact',
        subHalls: subHalls,
        isHistorical: p.isHistorical !== false
      });
    });
  }

  window._addPalace = function() {
    if (!scriptData.palaceSystem) scriptData.palaceSystem = {enabled:true, palaces:[]};
    if (!scriptData.palaceSystem.palaces) scriptData.palaceSystem.palaces = [];
    _palaceModal(null, function(data) {
      scriptData.palaceSystem.palaces.push(data);
      renderPalaceSystem();
      autoSave();
    });
  };

  window._editPalace = function(idx) {
    var p = scriptData.palaceSystem && scriptData.palaceSystem.palaces && scriptData.palaceSystem.palaces[idx];
    if (!p) return;
    _palaceModal(p, function(data) {
      scriptData.palaceSystem.palaces[idx] = data;
      renderPalaceSystem();
      autoSave();
    });
  };

  window.aiGeneratePalaceSystem = async function() {
    if (!P.ai || !P.ai.key) { alert('请先配置AI'); return; }
    var dynasty = scriptData.dynasty || '';
    if (!dynasty) { alert('请先在剧本设置中填写朝代'); return; }
    var year = scriptData.gameSettings && scriptData.gameSettings.startYear;
    var prompt = '你是中国古代皇家建筑与宫廷礼制专家。请根据以下朝代生成完整、符合史实的皇城宫殿群。\n\n'
      + '【朝代】' + dynasty + (year ? (' 起始年份：' + year) : '') + '\n\n'
      + '【历代皇城参考】\n'
      + '- 汉：长安城 → 长乐宫(太后)/未央宫(帝)/建章宫(离宫)/甘泉宫(祭祀)\n'
      + '- 唐：长安城 → 太极宫(初唐)/大明宫(后来主)/兴庆宫(玄宗)——三大内\n'
      + '- 北宋：东京汴梁 → 大内(外朝+内廷)/艮岳(后苑)\n'
      + '- 明：紫禁城 → 外朝三大殿(奉天/华盖/谨身)+后廷三宫(乾清/交泰/坤宁)+东六宫+西六宫+文华殿/武英殿/太庙/社稷坛\n'
      + '- 清：紫禁城 → 外朝三大殿(太和/中和/保和)+后廷(乾清/交泰/坤宁)+东六宫(景仁/承乾/钟粹/景阳/永和/延禧)+西六宫(永寿/翊坤/储秀/启祥/长春/咸福)+宁寿宫(太后)+慈宁宫+圆明园\n\n'
      + '返回纯JSON：\n'
      + '{\n'
      + '  "capitalName": "皇城正式名称",\n'
      + '  "capitalDescription": "皇城总体介绍(100-200字)",\n'
      + '  "palaces": [\n'
      + '    {\n'
      + '      "name": "乾清宫",\n'
      + '      "type": "imperial_residence",\n'
      + '      "function": "皇帝寝宫与日常议政",\n'
      + '      "description": "明清两代皇帝的寝宫......",\n'
      + '      "location": "内廷中轴",\n'
      + '      "maintainCost": 2000,\n'
      + '      "builtYear": 1420,\n'
      + '      "level": 3,\n'
      + '      "status": "intact",\n'
      + '      "subHalls": [\n'
      + '        {"name":"乾清宫正殿","role":"main","capacity":1,"rankRestriction":["皇后"]},\n'
      + '        {"name":"昭仁殿","role":"side","capacity":1,"rankRestriction":["贵妃"]},\n'
      + '        {"name":"弘德殿","role":"side","capacity":1,"rankRestriction":["妃"]}\n'
      + '      ]\n'
      + '    }\n'
      + '  ]\n'
      + '}\n\n'
      + '【type可选值】\n'
      + '- main_hall 外朝主殿(朝会/大典)\n'
      + '- imperial_residence 帝居宫殿(皇帝寝宫)\n'
      + '- consort_residence 后妃居所\n'
      + '- dowager 太后/太妃宫\n'
      + '- crown_prince 太子宫\n'
      + '- ceremonial 礼制建筑(册立大典)\n'
      + '- garden 园林行宫\n'
      + '- office 内廷办公(内阁/司礼监)\n'
      + '- offering 祭祀宗庙\n\n'
      + '要求：\n'
      + '1. 严格按朝代史实生成——明清用紫禁城，汉用长乐未央，唐用太极大明，不得张冠李戴\n'
      + '2. 生成 10-20 处宫殿，涵盖外朝/后廷/居所/太后宫/太子宫/园林/礼制\n'
      + '3. 每处宫殿的 subHalls 数组表示主殿+偏殿+附殿——后宫宫殿(如储秀宫/永和宫)必须有主殿+多个偏殿细分，每个偏殿可居 1-2 位妃嫔\n'
      + '4. rankRestriction 填该朝代对应位分(皇后/皇贵妃/贵妃/妃/嫔/贵人/常在等)——必须与位分体系一致\n'
      + '5. role=main(主殿)/side(偏殿)/attached(附殿)——主殿通常较大较尊\n'
      + '6. location 要具体(内廷中轴/东六宫区域/西六宫/西苑等)\n'
      + '7. description 简述历史沿革与功能(50-100字)\n'
      + '8. 只返回JSON，不要任何其他文字';
    showLoading('AI生成皇城宫殿...');
    try {
      var _callFn = (typeof callAIEditor === 'function') ? callAIEditor : (typeof callAISmart === 'function') ? callAISmart : (typeof callAI === 'function') ? callAI : null;
      if (!_callFn) throw new Error('AI调用不可用');
      var content = await _callFn(prompt, 6000);
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('无法解析JSON');
      var result = JSON.parse(m[0]);
      if (!scriptData.palaceSystem) scriptData.palaceSystem = {enabled:true, palaces:[]};
      scriptData.palaceSystem.enabled = true;
      scriptData.palaceSystem.capitalName = result.capitalName || '';
      scriptData.palaceSystem.capitalDescription = result.capitalDescription || '';
      scriptData.palaceSystem.palaces = (result.palaces || []).map(function(p) {
        return {
          id: 'pal_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
          name: p.name || '',
          type: p.type || 'main_hall',
          function: p.function || '',
          description: p.description || '',
          location: p.location || '',
          maintainCost: parseInt(p.maintainCost) || 0,
          builtYear: parseInt(p.builtYear) || 0,
          level: parseInt(p.level) || 1,
          status: p.status || 'intact',
          subHalls: (p.subHalls || []).map(function(sh) {
            return {
              id: 'sh_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
              name: sh.name || '',
              role: sh.role || 'main',
              capacity: parseInt(sh.capacity) || 1,
              occupants: [],
              rankRestriction: Array.isArray(sh.rankRestriction) ? sh.rankRestriction : (sh.rankRestriction ? [sh.rankRestriction] : [])
            };
          }),
          isHistorical: true
        };
      });
      autoSave();
      renderPalaceSystem();
      showToast('已生成皇城「' + (result.capitalName||'') + '」共 ' + scriptData.palaceSystem.palaces.length + ' 处宫殿');
    } catch(e) {
      console.error('[AI皇城]', e);
      showToast('生成失败：' + (e.message || e));
    } finally { hideLoading(); }
  };

  // ============================================================
  // 显著矛盾系统（黑格尔哲学：矛盾是推动事物发展的源泉）
  // ============================================================

  window.renderContradictions = function() {
    var el = document.getElementById('contradictions-list');
    if (!el) return;
    if (!scriptData.playerInfo) scriptData.playerInfo = {};
    if (!scriptData.playerInfo.coreContradictions) scriptData.playerInfo.coreContradictions = [];
    var list = scriptData.playerInfo.coreContradictions;

    if (list.length === 0) {
      el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:10px;text-align:center;">暂无矛盾。点击"AI生成矛盾"或手动添加。矛盾是AI推演的核心驱动力。</div>';
      return;
    }

    var dimColors = {political:'#6366f1',economic:'#f59e0b',military:'#ef4444',social:'#10b981'};
    var dimNames = {political:'政治',economic:'经济',military:'军事',social:'社会'};
    var sevColors = {critical:'#dc2626',major:'#f59e0b',minor:'#6b7280'};
    var sevNames = {critical:'致命',major:'重大',minor:'潜在'};

    el.innerHTML = list.map(function(c, i) {
      var dc = dimColors[c.dimension] || '#9ca3af';
      var dn = dimNames[c.dimension] || c.dimension;
      var sc = sevColors[c.severity] || '#6b7280';
      var sn = sevNames[c.severity] || c.severity;
      return '<div style="margin-bottom:8px;padding:10px;background:rgba(0,0,0,0.3);border-left:4px solid ' + dc + ';border-radius:6px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
        + '<div style="display:flex;align-items:center;gap:6px;">'
        + '<span style="font-weight:700;color:' + dc + ';font-size:13px;">' + escHtml(c.title || '') + '</span>'
        + '<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:' + dc + '22;color:' + dc + ';">' + dn + '</span>'
        + '<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:' + sc + '22;color:' + sc + ';">' + sn + '</span>'
        + '</div>'
        + '<div style="display:flex;gap:4px;">'
        + '<button class="btn" style="padding:1px 6px;font-size:10px;" onclick="editContradiction(' + i + ')">编辑</button>'
        + '<button class="btn" style="padding:1px 6px;font-size:10px;" onclick="deleteContradiction(' + i + ')">删除</button>'
        + '</div></div>'
        + (c.parties ? '<div style="font-size:11px;color:var(--gold);margin-bottom:3px;">冲突方: ' + escHtml(c.parties) + '</div>' : '')
        + '<div style="font-size:12px;color:var(--text-secondary);">' + escHtml(c.description || '').substring(0, 120) + '</div>'
        + '</div>';
    }).join('');
  };

  window.addContradiction = function() {
    var body = '<div class="form-group"><label>矛盾标题 *</label><input type="text" id="_ct_title" placeholder="如：阶级与族群冲突"></div>'
      + '<div style="display:flex;gap:12px;">'
      + '<div class="form-group" style="flex:1;"><label>维度</label><select id="_ct_dim"><option value="political">政治</option><option value="economic">经济</option><option value="military">军事</option><option value="social">社会</option></select></div>'
      + '<div class="form-group" style="flex:1;"><label>严重程度</label><select id="_ct_sev"><option value="critical">致命</option><option value="major">重大</option><option value="minor">潜在</option></select></div>'
      + '</div>'
      + '<div class="form-group"><label>冲突双方</label><input type="text" id="_ct_parties" placeholder="如：六镇鲜卑军勋集团 vs 中原汉化士族"></div>'
      + '<div class="form-group"><label>详细描述</label><textarea id="_ct_desc" rows="4" placeholder="描述矛盾的历史根源、当前态势、可能走向。AI推演时将围绕此矛盾展开叙事。"></textarea></div>';
    openEditorModal('添加显著矛盾', body, function() {
      var title = document.getElementById('_ct_title').value.trim();
      if (!title) return;
      if (!scriptData.playerInfo.coreContradictions) scriptData.playerInfo.coreContradictions = [];
      scriptData.playerInfo.coreContradictions.push({
        title: title,
        dimension: document.getElementById('_ct_dim').value,
        severity: document.getElementById('_ct_sev').value,
        parties: document.getElementById('_ct_parties').value.trim(),
        description: document.getElementById('_ct_desc').value.trim()
      });
      renderContradictions();
      autoSave();
    });
  };

  window.editContradiction = function(i) {
    var c = scriptData.playerInfo.coreContradictions[i];
    if (!c) return;
    var body = '<div class="form-group"><label>矛盾标题</label><input type="text" id="_ct_title" value="' + escHtml(c.title||'') + '"></div>'
      + '<div style="display:flex;gap:12px;">'
      + '<div class="form-group" style="flex:1;"><label>维度</label><select id="_ct_dim"><option value="political"' + (c.dimension==='political'?' selected':'') + '>政治</option><option value="economic"' + (c.dimension==='economic'?' selected':'') + '>经济</option><option value="military"' + (c.dimension==='military'?' selected':'') + '>军事</option><option value="social"' + (c.dimension==='social'?' selected':'') + '>社会</option></select></div>'
      + '<div class="form-group" style="flex:1;"><label>严重程度</label><select id="_ct_sev"><option value="critical"' + (c.severity==='critical'?' selected':'') + '>致命</option><option value="major"' + (c.severity==='major'?' selected':'') + '>重大</option><option value="minor"' + (c.severity==='minor'?' selected':'') + '>潜在</option></select></div>'
      + '</div>'
      + '<div class="form-group"><label>冲突双方</label><input type="text" id="_ct_parties" value="' + escHtml(c.parties||'') + '"></div>'
      + '<div class="form-group"><label>详细描述</label><textarea id="_ct_desc" rows="4">' + escHtml(c.description||'') + '</textarea></div>';
    openEditorModal('编辑矛盾', body, function() {
      c.title = document.getElementById('_ct_title').value.trim() || c.title;
      c.dimension = document.getElementById('_ct_dim').value;
      c.severity = document.getElementById('_ct_sev').value;
      c.parties = document.getElementById('_ct_parties').value.trim();
      c.description = document.getElementById('_ct_desc').value.trim();
      renderContradictions();
      autoSave();
    });
  };

  window.deleteContradiction = function(i) {
    scriptData.playerInfo.coreContradictions.splice(i, 1);
    renderContradictions();
    autoSave();
  };

  window.aiGenerateContradictions = async function() {
    var _apiCfg = {}; try { _apiCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    var apiKey = _apiCfg.key || '';
    var apiUrl = _apiCfg.url || 'https://api.openai.com/v1/chat/completions';
    var apiModel = _apiCfg.model || 'gpt-4o';
    if (!apiKey) { alert('请先配置 API 密钥！'); return; }

    var dynasty = scriptData.dynasty || '未知朝代';
    var overview = scriptData.overview || '';
    var pi = scriptData.playerInfo || {};

    var prompt = '你是一位精通中国历史与黑格尔辩证法的历史学家。根据以下剧本信息，生成该时期玩家势力面临的核心矛盾。\n\n'
      + '【哲学基础】恶是推动社会发展的重要动力，矛盾是推动事物发展的源泉（黑格尔）。\n'
      + '每个矛盾必须覆盖政治、经济、军事、社会四大维度之一，且矛盾之间应形成联动关系。\n\n'
      + '朝代：' + dynasty + '\n'
      + '剧本概述：' + (overview || '').slice(0, 300) + '\n'
      + '玩家势力：' + (pi.factionName || '') + '\n'
      + '玩家角色：' + (pi.characterName || '') + '\n\n'
      + '返回JSON：{"contradictions":[\n'
      + '  {"title":"矛盾标题(8字内)","dimension":"political/economic/military/social","severity":"critical/major/minor","parties":"冲突双方(如：X vs Y)","description":"详细描述(80-150字，含历史根源、当前态势、可能走向)"}\n'
      + ']}\n\n'
      + '要求：\n'
      + '1. 生成4-6个核心矛盾，必须覆盖政治、经济、军事、社会四个维度\n'
      + '2. 至少1个致命(critical)矛盾、2个重大(major)矛盾\n'
      + '3. 矛盾必须基于真实历史，不可虚构\n'
      + '4. 每个矛盾的description必须包含：历史根源、当前态势、对玩家的影响\n'
      + '5. 矛盾之间应有联动关系（如经济崩溃加剧社会矛盾，军事失控源于政治分裂）\n'
      + '6. 底层逻辑：玩家的任何决策都将在四个维度引发连锁反应\n'
      + '7. 只返回JSON';

    showLoading('正在生成显著矛盾...');
    try {
      var response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ model: apiModel, messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
      });
      if (!response.ok) throw new Error('API请求失败：' + response.status);
      var data = await response.json();
      var content = data.choices[0].message.content.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析JSON');
      var result = JSON.parse(jsonMatch[0]);

      if (result.contradictions && Array.isArray(result.contradictions)) {
        if (!scriptData.playerInfo.coreContradictions) scriptData.playerInfo.coreContradictions = [];
        result.contradictions.forEach(function(c) {
          scriptData.playerInfo.coreContradictions.push(c);
        });
        renderContradictions();
        autoSave();
        showToast('生成' + result.contradictions.length + '个核心矛盾');
      }
    } catch(e) {
      console.error('AI生成失败：', e);
      showToast('生成失败：' + e.message);
    } finally { hideLoading(); }
  };

  // 注册到 renderAll
  // ============================================================
  // 新增config可视化编辑面板
  // ============================================================

  /** 渲染战争法则面板 */
  window.renderWarConfig = function(containerId) {
    var el = document.getElementById(containerId || 'warConfigContainer');
    if (!el) return;
    if (!scriptData.warConfig) scriptData.warConfig = {casusBelliTypes:[]};
    var wc = scriptData.warConfig;
    var html = '<h4>⚔ 宣战理由(Casus Belli)</h4><div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">定义本朝代的战争正当性类型。AI宣战时须指定理由，否则套用"无端开衅"（最高惩罚）。</div>';
    (wc.casusBelliTypes||[]).forEach(function(cb,i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px">';
      html += '<b>' + escHtml(cb.name) + '</b> 停战' + (cb.truceMonths||12) + '月';
      html += ' <button class="bd bsm" onclick="editWarCB('+i+')">编辑</button><button class="bd bsm" onclick="scriptData.warConfig.casusBelliTypes.splice('+i+',1);renderWarConfig()">删</button></div>';
    });
    html += '<button class="bt bs bsm" onclick="addWarCB()">+ 添加理由</button>';
    el.innerHTML = html;
  };
  window.addWarCB = function() {
    if (!scriptData.warConfig) scriptData.warConfig = {casusBelliTypes:[]};
    if (!scriptData.warConfig.casusBelliTypes) scriptData.warConfig.casusBelliTypes = [];
    scriptData.warConfig.casusBelliTypes.push({id:'new_'+Date.now(),name:'新理由',truceMonths:12});
    if (typeof autoSave==='function') autoSave();
    renderWarConfig();
  };
  window.editWarCB = function(i) {
    var cb = scriptData.warConfig.casusBelliTypes[i]; if (!cb) return;
    var body = '<div class="fd"><label>ID</label><input id="wcb-id" value="'+(cb.id||'')+'"></div>'
      + '<div class="fd"><label>名称</label><input id="wcb-name" value="'+(cb.name||'')+'"></div>'
      + '<div class="fd"><label>停战月数</label><input type="number" id="wcb-truce" value="'+(cb.truceMonths||12)+'"></div>';
    openEditorModal('编辑宣战理由', body, function() {
      cb.id = document.getElementById('wcb-id').value;
      cb.name = document.getElementById('wcb-name').value;
      cb.truceMonths = parseInt(document.getElementById('wcb-truce').value)||12;
      if (typeof autoSave==='function') autoSave();
      renderWarConfig();
    });
  };

  /** 渲染外交法则面板 */
  window.renderDiplomacyConfig = function(containerId) {
    var el = document.getElementById(containerId || 'diplomacyConfigContainer');
    if (!el) return;
    if (!scriptData.diplomacyConfig) scriptData.diplomacyConfig = {treatyTypes:[]};
    var dc = scriptData.diplomacyConfig;
    var html = '<h4>🤝 条约类型</h4><div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">定义本朝代的条约/盟约类型（同盟/和亲/朝贡/互市等）。</div>';
    (dc.treatyTypes||[]).forEach(function(t,i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;font-size:12px">';
      html += '<b>' + escHtml(t.name) + '</b> 期限' + (t.durationMonths||'永久') + '月';
      html += ' <button class="bd bsm" onclick="scriptData.diplomacyConfig.treatyTypes.splice('+i+',1);renderDiplomacyConfig()">删</button></div>';
    });
    html += '<button class="bt bs bsm" onclick="if(!scriptData.diplomacyConfig.treatyTypes)scriptData.diplomacyConfig.treatyTypes=[];scriptData.diplomacyConfig.treatyTypes.push({id:\'new_\'+Date.now(),name:\'新条约\',durationMonths:12});renderDiplomacyConfig()">+ 添加</button>';
    el.innerHTML = html;
  };

  /** 渲染阴谋系统面板 */
  window.renderSchemeConfig = function(containerId) {
    var el = document.getElementById(containerId || 'schemeConfigContainer');
    if (!el) return;
    if (!scriptData.schemeConfig) scriptData.schemeConfig = {enabled:false,schemeTypes:[]};
    var sc = scriptData.schemeConfig;
    var html = '<h4>🗡 阴谋系统</h4>';
    html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(sc.enabled?'checked':'')+' onchange="scriptData.schemeConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用阴谋系统（刺杀/策反/离间等需冷却和成功率检定）</div></div>';
    (sc.schemeTypes||[]).forEach(function(s,i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;font-size:12px">';
      html += '<b>' + escHtml(s.name) + '</b> 基础' + Math.round((s.baseSuccess||0)*100) + '% 冷却' + (s.cooldownMonths||24) + '月';
      html += ' <button class="bd bsm" onclick="scriptData.schemeConfig.schemeTypes.splice('+i+',1);renderSchemeConfig()">删</button></div>';
    });
    html += '<button class="bt bs bsm" onclick="if(!scriptData.schemeConfig.schemeTypes)scriptData.schemeConfig.schemeTypes=[];scriptData.schemeConfig.schemeTypes.push({id:\'new\',name:\'新阴谋\',baseSuccess:0.2,cooldownMonths:12});renderSchemeConfig()">+ 添加</button>';
    el.innerHTML = html;
  };

  /** 渲染决策系统面板 */
  window.renderDecisionConfig = function(containerId) {
    var el = document.getElementById(containerId || 'decisionConfigContainer');
    if (!el) return;
    if (!scriptData.decisionConfig) scriptData.decisionConfig = {decisions:[]};
    var dc = scriptData.decisionConfig;
    var html = '<h4>👑 重大决策</h4><div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">定义称帝/称王/废黜等重大政治变革的条件和成本。</div>';
    (dc.decisions||[]).forEach(function(d,i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;font-size:12px">';
      html += '<b>' + escHtml(d.name) + '</b> ' + (d.description||'');
      html += ' <button class="bd bsm" onclick="scriptData.decisionConfig.decisions.splice('+i+',1);renderDecisionConfig()">删</button></div>';
    });
    html += '<button class="bt bs bsm" onclick="if(!scriptData.decisionConfig.decisions)scriptData.decisionConfig.decisions=[];scriptData.decisionConfig.decisions.push({id:\'new\',name:\'新决策\',conditions:[],cost:{},effects:[],description:\'\'});renderDecisionConfig()">+ 添加</button>';
    el.innerHTML = html;
  };

  /** 渲染事件约束面板 */
  window.renderEventConstraints = function(containerId) {
    var el = document.getElementById(containerId || 'eventConstraintsContainer');
    if (!el) return;
    if (!scriptData.eventConstraints) scriptData.eventConstraints = {enabled:false,types:[]};
    var ec = scriptData.eventConstraints;
    var html = '<h4>📋 事件约束</h4>';
    html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(ec.enabled?'checked':'')+' onchange="scriptData.eventConstraints.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用事件白名单（限制AI可触发的事件类型和频率）</div></div>';
    (ec.types||[]).forEach(function(t,i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;font-size:12px">';
      html += '<b>' + escHtml(t.name||t.id) + '</b> 年上限' + (t.maxPerYear||'无') + ' 间隔' + (t.minIntervalMonths||'无') + '月';
      if (t.condition) html += ' 条件:' + t.condition;
      html += ' <button class="bd bsm" onclick="scriptData.eventConstraints.types.splice('+i+',1);renderEventConstraints()">删</button></div>';
    });
    html += '<button class="bt bs bsm" onclick="if(!scriptData.eventConstraints.types)scriptData.eventConstraints.types=[];scriptData.eventConstraints.types.push({id:\'new\',name:\'新事件类型\',maxPerYear:2,minIntervalMonths:6});renderEventConstraints()">+ 添加</button>';
    el.innerHTML = html;
  };

  /** 渲染编年史配置面板 */
  window.renderChronicleConfig = function(containerId) {
    var el = document.getElementById(containerId || 'chronicleConfigContainer');
    if (!el) return;
    if (!scriptData.chronicleConfig) scriptData.chronicleConfig = {yearlyEnabled:false,style:'biannian',yearlyMinChars:800,yearlyMaxChars:1500};
    var cc = scriptData.chronicleConfig;
    var html = '<h4>📜 编年史配置</h4>';
    html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(cc.yearlyEnabled?'checked':'')+' onchange="scriptData.chronicleConfig.yearlyEnabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用年度编年史汇总（跨年时AI生成年度史）</div></div>';
    html += '<div style="margin-top:8px"><label style="font-size:13px">仿写风格 <select onchange="scriptData.chronicleConfig.style=this.value;if(typeof autoSave===\'function\')autoSave()" style="background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:3px 8px">';
    var styles = [['biannian','编年体 (《资治通鉴》)'],['shilu','实录体 (各朝实录)'],['jizhuan','纪传体 (《史记》)'],['jishi','纪事本末体'],['biji','笔记体 (《世说新语》)'],['custom','自定义']];
    styles.forEach(function(s) { html += '<option value="'+s[0]+'" '+(cc.style===s[0]?'selected':'')+'>'+s[1]+'</option>'; });
    html += '</select></label></div>';
    html += '<div style="display:flex;gap:8px;margin-top:6px">';
    html += '<label style="font-size:12px">最少字数<input type="number" value="'+(cc.yearlyMinChars||800)+'" style="width:55px" onchange="scriptData.chronicleConfig.yearlyMinChars=parseInt(this.value)||800"></label>';
    html += '<label style="font-size:12px">\u6700\u591A\u5B57\u6570<input type="number" value="'+(cc.yearlyMaxChars||1500)+'" style="width:55px" onchange="scriptData.chronicleConfig.yearlyMaxChars=parseInt(this.value)||1500"></label>';
    html += '</div>';
    html += '<div class="form-group" style="margin-top:8px;"><label style="font-size:12px">\u98CE\u683C\u8303\u6587\uFF08\u53EF\u9009\uFF0C200\u5B57\u5DE6\u53F3\uFF0C\u4F5C\u4E3AAI\u6587\u98CE\u53C2\u7167\uFF09</label>';
    html += '<textarea style="width:100%;font-size:12px;height:60px;" placeholder="\u7C98\u8D34\u4E00\u6BB5\u4F60\u5E0C\u671BAI\u53C2\u7167\u7684\u53F2\u4E66\u98CE\u683C\u8303\u6587..." onchange="scriptData.chronicleConfig.styleSample=this.value">'+ escHtml(cc.styleSample||'') +'</textarea></div>';
    el.innerHTML = html;
  };

  // ============================================================
  // 优化1: 初始恩怨/门生编辑器
  // ============================================================

  window.renderInitialEnYuan = function(containerId) {
    var el = document.getElementById(containerId || 'initialEnYuanContainer');
    if (!el) return;
    if (!scriptData.initialEnYuan) scriptData.initialEnYuan = [];
    var list = scriptData.initialEnYuan;
    var html = '<h4>🔥 初始恩怨关系</h4><div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">预设角色之间的历史恩怨，游戏开始时自动加载到恩怨系统。</div>';
    list.forEach(function(ey, i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;font-size:12px;display:flex;align-items:center;gap:6px">';
      html += '<span style="color:'+(ey.type==='en'?'#6c6':'#c66')+'">'+( ey.type==='en'?'恩':'怨')+'</span>';
      html += escHtml(ey.from) + '→' + escHtml(ey.to) + ' 强度' + (ey.强度||1);
      if (ey.不共戴天) html += ' <b style="color:#c44">不共戴天</b>';
      if (ey.事由) html += ' (' + escHtml(ey.事由) + ')';
      html += ' <button class="bd bsm" onclick="scriptData.initialEnYuan.splice('+i+',1);renderInitialEnYuan()">删</button></div>';
    });
    html += '<button class="bt bs bsm" onclick="addInitialEnYuan()">+ 添加恩怨</button>';

    // 初始门生
    if (!scriptData.initialPatronNetwork) scriptData.initialPatronNetwork = [];
    var plist = scriptData.initialPatronNetwork;
    html += '<h4 style="margin-top:12px">🎓 初始门生关系</h4><div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">预设座主-门生、同年、同乡等人际网络。</div>';
    plist.forEach(function(pn, i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;font-size:12px;display:flex;align-items:center;gap:6px">';
      html += escHtml(pn.座主) + '→' + escHtml(pn.门生) + ' (' + (pn.关系类型||'座主门生') + ') 亲密' + (pn.亲密度||60);
      html += ' <button class="bd bsm" onclick="scriptData.initialPatronNetwork.splice('+i+',1);renderInitialEnYuan()">删</button></div>';
    });
    html += '<button class="bt bs bsm" onclick="addInitialPatron()">+ 添加门生关系</button>';
    el.innerHTML = html;
  };

  window.addInitialEnYuan = function() {
    var chars = (scriptData.characters||[]).map(function(c){return c.name;});
    var charOpts = chars.map(function(n){return '<option value="'+escHtml(n)+'">'+escHtml(n)+'</option>';}).join('');
    var body = '<div class="fd"><label>类型</label><select id="iey-type"><option value="en">恩</option><option value="yuan">怨</option></select></div>'
      + '<div class="fd"><label>施恩/结怨者</label><select id="iey-from">'+charOpts+'</select></div>'
      + '<div class="fd"><label>受恩/受害者</label><select id="iey-to">'+charOpts+'</select></div>'
      + '<div class="fd"><label>强度(1-5)</label><input type="number" id="iey-str" value="3" min="1" max="5"></div>'
      + '<div class="fd"><label>事由</label><input type="text" id="iey-reason" placeholder="如:提拔之恩/杀父之仇"></div>'
      + '<div class="fd"><label><input type="checkbox" id="iey-bgdt"> 不共戴天(永不衰减)</label></div>';
    openEditorModal('添加初始恩怨', body, function() {
      scriptData.initialEnYuan.push({
        type: document.getElementById('iey-type').value,
        from: document.getElementById('iey-from').value,
        to: document.getElementById('iey-to').value,
        强度: parseInt(document.getElementById('iey-str').value)||3,
        事由: document.getElementById('iey-reason').value||'',
        不共戴天: document.getElementById('iey-bgdt').checked
      });
      if (typeof autoSave==='function') autoSave();
      renderInitialEnYuan();
    });
  };

  window.addInitialPatron = function() {
    var chars = (scriptData.characters||[]).map(function(c){return c.name;});
    var charOpts = chars.map(function(n){return '<option value="'+escHtml(n)+'">'+escHtml(n)+'</option>';}).join('');
    var body = '<div class="fd"><label>座主/上级</label><select id="ipn-master">'+charOpts+'</select></div>'
      + '<div class="fd"><label>门生/下级</label><select id="ipn-student">'+charOpts+'</select></div>'
      + '<div class="fd"><label>关系类型</label><select id="ipn-type"><option value="座主门生">座主门生</option><option value="同年">同年</option><option value="同乡">同乡</option><option value="故吏">故吏</option><option value="姻亲">姻亲</option></select></div>'
      + '<div class="fd"><label>亲密度(0-100)</label><input type="number" id="ipn-aff" value="60" min="0" max="100"></div>';
    openEditorModal('添加初始门生关系', body, function() {
      scriptData.initialPatronNetwork.push({
        座主: document.getElementById('ipn-master').value,
        门生: document.getElementById('ipn-student').value,
        关系类型: document.getElementById('ipn-type').value,
        亲密度: parseInt(document.getElementById('ipn-aff').value)||60
      });
      if (typeof autoSave==='function') autoSave();
      renderInitialEnYuan();
    });
  };

  // ============================================================
  // 优化2: 行政层级规则编辑器
  // ============================================================

  window.renderAdminConfig = function(containerId) {
    var el = document.getElementById(containerId || 'adminConfigContainer');
    if (!el) return;
    if (!scriptData.adminConfig) scriptData.adminConfig = {tierRules:[
      {level:'country',name:'国/朝',tributeMultiplier:1.0,maxArmies:10,canAppoint:true,canLevy:true,canDeclareWar:true},
      {level:'province',name:'道/路/省',tributeMultiplier:0.8,maxArmies:5,canAppoint:true,canLevy:true,canDeclareWar:false},
      {level:'prefecture',name:'州/府/郡',tributeMultiplier:0.5,maxArmies:2,canAppoint:false,canLevy:true,canDeclareWar:false},
      {level:'county',name:'县/城',tributeMultiplier:0.3,maxArmies:0,canAppoint:false,canLevy:false,canDeclareWar:false},
      {level:'district',name:'乡/镇',tributeMultiplier:0.1,maxArmies:0,canAppoint:false,canLevy:false,canDeclareWar:false}
    ],capitalLinkage:true};
    var ac = scriptData.adminConfig;
    var html = '<h4>🏛 行政层级权力规则</h4>';
    html += '<div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">定义每一级行政区划的权力差异。</div>';
    html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(ac.capitalLinkage?'checked':'')+' onchange="scriptData.adminConfig.capitalLinkage=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>治所联动（上级governor/税制自动同步首府）</div></div>';
    html += '<table style="font-size:12px;border-collapse:collapse;width:100%;margin-top:8px"><tr style="border-bottom:1px solid var(--bg-4)"><th style="text-align:left;padding:3px">层级</th><th>贡赋倍率</th><th>最大军队</th><th>可任命</th><th>可征兵</th><th>可宣战</th></tr>';
    (ac.tierRules||[]).forEach(function(r, i) {
      html += '<tr>';
      html += '<td style="padding:3px"><b>'+escHtml(r.name)+'</b><br><span style="font-size:10px;color:var(--txt-d)">'+r.level+'</span></td>';
      html += '<td style="text-align:center"><input type="number" step="0.1" value="'+r.tributeMultiplier+'" style="width:45px" onchange="scriptData.adminConfig.tierRules['+i+'].tributeMultiplier=parseFloat(this.value)||1"></td>';
      html += '<td style="text-align:center"><input type="number" value="'+r.maxArmies+'" style="width:35px" onchange="scriptData.adminConfig.tierRules['+i+'].maxArmies=parseInt(this.value)||0"></td>';
      html += '<td style="text-align:center"><input type="checkbox" '+(r.canAppoint?'checked':'')+' onchange="scriptData.adminConfig.tierRules['+i+'].canAppoint=this.checked"></td>';
      html += '<td style="text-align:center"><input type="checkbox" '+(r.canLevy?'checked':'')+' onchange="scriptData.adminConfig.tierRules['+i+'].canLevy=this.checked"></td>';
      html += '<td style="text-align:center"><input type="checkbox" '+(r.canDeclareWar?'checked':'')+' onchange="scriptData.adminConfig.tierRules['+i+'].canDeclareWar=this.checked"></td>';
      html += '</tr>';
    });
    html += '</table>';
    el.innerHTML = html;
  };

  // ============================================================
  // 优化3: NPC行为/交互编辑器
  // ============================================================

  window.renderNpcBehaviors = function(containerId) {
    var el = document.getElementById(containerId || 'npcBehaviorsContainer');
    if (!el) return;
    var html = '<h4>🤖 NPC行为模板</h4><div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">定义NPC可执行的行为类型及触发权重。启用/禁用控制该行为是否生效。</div>';

    var behaviors = (scriptData.npcEngine && scriptData.npcEngine.behaviors) || [];
    if (behaviors.length > 0) {
      behaviors.forEach(function(b, i) {
        html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;display:flex;align-items:center;gap:6px;font-size:12px">';
        html += '<input type="checkbox" '+(b.enabled!==false?'checked':'')+' onchange="scriptData.npcEngine.behaviors['+i+'].enabled=this.checked;if(typeof autoSave===\'function\')autoSave()">';
        html += '<b>'+escHtml(b.name)+'</b>';
        html += '<span style="color:var(--txt-d)">['+escHtml(b.category||'')+']</span>';
        if (b.weight && b.weight.base !== undefined) html += ' 基础权重:'+b.weight.base;
        html += '</div>';
      });
    } else {
      html += '<div style="font-size:12px;color:var(--txt-d);padding:4px">未定义行为模板（将使用代码默认值）</div>';
    }

    html += '<h4 style="margin-top:12px">🤝 NPC交互模板</h4><div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">定义NPC/玩家可执行的交互动作。</div>';

    var interactions = (scriptData.interactionSystem && scriptData.interactionSystem.interactions) || [];
    if (interactions.length > 0) {
      interactions.forEach(function(it, i) {
        html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:4px 8px;margin-bottom:3px;display:flex;align-items:center;gap:6px;font-size:12px">';
        html += '<b>'+escHtml(it.name)+'</b>';
        html += '<span style="color:var(--txt-d)">['+escHtml(it.category||'')+']</span>';
        if (it.cost && it.cost.money) html += ' 费用:'+it.cost.money;
        html += ' <button class="bd bsm" onclick="scriptData.interactionSystem.interactions.splice('+i+',1);renderNpcBehaviors()">删</button>';
        html += '</div>';
      });
    } else {
      html += '<div style="font-size:12px;color:var(--txt-d);padding:4px">未定义交互模板（将使用代码默认值）</div>';
    }

    el.innerHTML = html;
  };

  var _origRenderAll = window.renderAll;
  window.renderAll = function() {
    if (_origRenderAll) _origRenderAll();
    if (typeof renderExternalForces === 'function') renderExternalForces();
    if (typeof renderHaremConfig === 'function') renderHaremConfig();
    if (typeof renderContradictions === 'function') renderContradictions();
  };
})();

// ============================================================
// 1.7: Prompt模板编辑 + mechanicsConfig可视化编辑
// 提供弹窗式编辑界面，修改 P.promptOverrides 和 P.mechanicsConfig
// ============================================================

/** 打开Prompt模板编辑弹窗 */
function openPromptOverridesEditor() {
  if (!scriptData.promptOverrides) scriptData.promptOverrides = {};
  var po = scriptData.promptOverrides;
  var templates = (typeof PromptTemplate !== 'undefined') ? PromptTemplate.list() : [];

  var body = '<div style="margin-bottom:0.8rem;font-size:0.85rem;color:var(--txt-d);">'+
    '自定义AI Prompt模板——覆盖引擎默认的prompt段落。留空则使用默认。'+
    '</div>';

  // 内置模板列表
  if (templates.length > 0) {
    body += '<div style="margin-bottom:0.5rem;font-size:0.8rem;">已注册模板：' + templates.join(', ') + '</div>';
  }

  // 自定义覆盖编辑区
  body += '<div class="form-group"><label>系统提示前缀（注入到sysP最前面）</label>'+
    '<textarea id="po_prefix" rows="3" placeholder="如：你是一位严谨的历史学家，擅长宋朝历史...">' + escHtml(po.systemPrefix || '') + '</textarea></div>';

  body += '<div class="form-group"><label>NPC行为指导（覆盖NPC行为段）</label>'+
    '<textarea id="po_npcGuide" rows="3" placeholder="留空使用默认">' + escHtml(po.npcGuide || '') + '</textarea></div>';

  body += '<div class="form-group"><label>叙事风格要求（覆盖文风指令）</label>'+
    '<textarea id="po_narrativeStyle" rows="3" placeholder="留空使用默认">' + escHtml(po.narrativeStyle || '') + '</textarea></div>';

  if (typeof openGenericModal === 'function') {
    openGenericModal('Prompt模板编辑', body, function() {
      scriptData.promptOverrides = {
        systemPrefix: (document.getElementById('po_prefix') ? document.getElementById('po_prefix').value : '').trim() || undefined,
        npcGuide: (document.getElementById('po_npcGuide') ? document.getElementById('po_npcGuide').value : '').trim() || undefined,
        narrativeStyle: (document.getElementById('po_narrativeStyle') ? document.getElementById('po_narrativeStyle').value : '').trim() || undefined
      };
      // 清理空值
      var _po = scriptData.promptOverrides;
      Object.keys(_po).forEach(function(k) { if (!_po[k]) delete _po[k]; });
      if (typeof autoSave === 'function') autoSave();
      if (typeof showToast === 'function') showToast('Prompt模板已保存');
    });
  }
}

/** 3.1: 打开mechanicsConfig可视化编辑弹窗 */
function openMechanicsConfigEditor() {
  if (!scriptData.mechanicsConfig) scriptData.mechanicsConfig = {};
  var mc = scriptData.mechanicsConfig;

  // 标签页式编辑面板
  var tabs = [
    {id:'mc-coupling',label:'\u72B6\u6001\u8026\u5408'},
    {id:'mc-npcBehavior',label:'NPC\u884C\u4E3A'},
    {id:'mc-agenda',label:'\u8BAE\u7A0B\u6A21\u677F'},
    {id:'mc-era',label:'\u65F6\u4EE3\u8FDB\u5EA6'},
    {id:'mc-char',label:'\u89D2\u8272\u89C4\u5219'},
    {id:'mc-npcIntent',label:'NPC\u610F\u56FE'},
    {id:'mc-policy',label:'\u653F\u7B56\u6811'},
    {id:'mc-decisions',label:'\u91CD\u5927\u51B3\u7B56'},
    {id:'mc-trade',label:'\u8D38\u6613\u8DEF\u7EBF'},
    {id:'mc-raw',label:'JSON\u539F\u59CB'}
  ];
  var body = '<div style="margin-bottom:0.5rem;font-size:0.82rem;color:var(--txt-d);">\u673A\u5236\u914D\u7F6E\u2014\u2014\u8FD9\u4E9B\u89C4\u5219\u4EC5\u4E3AAI\u63D0\u4F9B\u53C2\u8003\u4FE1\u606F\uFF0CAI\u53EF\u81EA\u884C\u51B3\u5B9A\u662F\u5426\u91C7\u7EB3\u3002\u672A\u914D\u7F6E\u7684\u89C4\u5219\u4E0D\u4F1A\u9650\u5236AI\u63A8\u6F14\u3002</div>';
  body += '<div style="display:flex;gap:2px;flex-wrap:wrap;margin-bottom:0.5rem;">';
  tabs.forEach(function(t,i){
    body += '<button class="mc-tab-btn' + (i===0?' active':'') + '" onclick="_mcSwitchTab(\'' + t.id + '\',this)" style="padding:4px 10px;font-size:0.75rem;border:1px solid var(--bdr);border-radius:4px;background:' + (i===0?'var(--gold-d)':'var(--bg-2)') + ';color:' + (i===0?'#fff':'var(--txt-s)') + ';cursor:pointer;">' + t.label + '</button>';
  });
  body += '</div>';

  // === 1. 状态耦合规则 ===
  body += '<div id="mc-coupling" class="mc-panel" style="display:block;">';
  body += '<div style="font-size:0.82rem;color:var(--txt-d);margin-bottom:0.4rem;">\u5F53\u6761\u4EF6\u6EE1\u8DB3\u65F6\uFF0C\u5EFA\u8BAE\u76EE\u6807\u53D8\u91CF\u7684\u6708\u57FA\u51C6\u53D8\u5316\u91CF\u3002AI\u81EA\u884C\u51B3\u5B9A\u5B9E\u9645\u53D8\u5316\u3002</div>';
  body += '<div id="mc-coupling-list"></div>';
  body += '<button onclick="_mcAddCoupling()" style="padding:4px 12px;font-size:0.78rem;margin-top:0.3rem;">+ \u6DFB\u52A0\u89C4\u5219</button>';
  body += '</div>';

  // === 2. NPC行为类型 ===
  body += '<div id="mc-npcBehavior" class="mc-panel" style="display:none;">';
  body += '<div style="font-size:0.82rem;color:var(--txt-d);margin-bottom:0.4rem;">\u5B9A\u4E49NPC\u53EF\u80FD\u7684\u884C\u4E3A\u7C7B\u578B\u53CA\u6743\u91CD\u56E0\u5B50\uFF0C\u4F9BAI\u5206\u6790NPC\u610F\u56FE\u65F6\u53C2\u8003\u3002</div>';
  body += '<div id="mc-npcBehavior-list"></div>';
  body += '<button onclick="_mcAddBehavior()" style="padding:4px 12px;font-size:0.78rem;margin-top:0.3rem;">+ \u6DFB\u52A0\u884C\u4E3A\u7C7B\u578B</button>';
  body += '</div>';

  // === 3. 议程模板 ===
  body += '<div id="mc-agenda" class="mc-panel" style="display:none;">';
  body += '<div style="font-size:0.82rem;color:var(--txt-d);margin-bottom:0.4rem;">\u5B9A\u4E49\u5B63\u5EA6\u8BAE\u9898\u6A21\u677F\uFF0C\u6761\u4EF6\u6EE1\u8DB3\u65F6\u81EA\u52A8\u751F\u6210\u8BAE\u9898\u9009\u9879\u3002</div>';
  body += '<div id="mc-agenda-list"></div>';
  body += '<button onclick="_mcAddAgenda()" style="padding:4px 12px;font-size:0.78rem;margin-top:0.3rem;">+ \u6DFB\u52A0\u8BAE\u9898</button>';
  body += '</div>';

  // === 4. 时代进度规则 ===
  body += '<div id="mc-era" class="mc-panel" style="display:none;">';
  body += '<div style="font-size:0.82rem;color:var(--txt-d);margin-bottom:0.4rem;">\u5B9A\u4E49\u671D\u4EE3\u8870\u9000/\u4E2D\u5174\u7684\u6761\u4EF6\uFF0C\u4F9BAI\u5224\u65AD\u671D\u4EE3\u8D8B\u52BF\u65F6\u53C2\u8003\u3002</div>';
  body += '<div class="form-group"><label>\u8870\u9000\u6761\u4EF6</label><div id="mc-era-collapse"></div><button onclick="_mcAddEraRule(\'collapse\')" style="padding:3px 10px;font-size:0.75rem;">+ \u6DFB\u52A0</button></div>';
  body += '<div class="form-group"><label>\u4E2D\u5174\u6761\u4EF6</label><div id="mc-era-restoration"></div><button onclick="_mcAddEraRule(\'restoration\')" style="padding:3px 10px;font-size:0.75rem;">+ \u6DFB\u52A0</button></div>';
  body += '</div>';

  // === 5. 角色规则 ===
  body += '<div id="mc-char" class="mc-panel" style="display:none;">';
  var cr = mc.characterRules || {};
  var hc = cr.healthConfig || {};
  body += '<div class="form-group"><label>\u6708\u57FA\u7840\u8870\u51CF</label><input id="mc-hDecay" type="number" step="0.01" value="' + (hc.monthlyDecay||0.1) + '" style="width:80px;"> <span style="font-size:0.72rem;color:var(--txt-d);">\u6781\u7F13\u6162\u81EA\u7136\u8001\u5316</span></div>';
  body += '<div class="form-group"><label>\u52A0\u901F\u8001\u5316\u5E74\u9F84</label><input id="mc-ageThresh" type="number" value="' + (hc.ageAccelThreshold||60) + '" style="width:80px;"></div>';
  body += '<div class="form-group"><label>\u52A0\u901F\u7387</label><input id="mc-ageAccel" type="number" step="0.1" value="' + (hc.ageAccelRate||0.3) + '" style="width:80px;"></div>';
  body += '</div>';

  // === 6. NPC意图调度 ===
  body += '<div id="mc-npcIntent" class="mc-panel" style="display:none;">';
  var ni = mc.npcIntentConfig || {};
  body += '<div class="form-group"><label>\u9AD8\u91CD\u8981\u5EA6\u5206\u6790\u95F4\u9694(\u5929)</label><input id="mc-niHigh" type="number" value="' + (ni.highImportanceIntervalDays||15) + '" style="width:80px;"></div>';
  body += '<div class="form-group"><label>\u4E2D\u91CD\u8981\u5EA6\u5206\u6790\u95F4\u9694(\u5929)</label><input id="mc-niMid" type="number" value="' + (ni.midImportanceIntervalDays||45) + '" style="width:80px;"></div>';
  body += '<div class="form-group"><label>\u4F4E\u91CD\u8981\u5EA6\u5206\u6790\u95F4\u9694(\u5929)</label><input id="mc-niLow" type="number" value="' + (ni.lowImportanceIntervalDays||90) + '" style="width:80px;"></div>';
  body += '</div>';

  // === 7. 政策树 ===
  body += '<div id="mc-policy" class="mc-panel" style="display:none;">';
  body += '<textarea id="mc_policy_raw" rows="6" style="width:100%;font-family:monospace;font-size:0.78rem;" placeholder=\'[{"id":"tax_reform","name":"\u7A0E\u5236\u6539\u9769"}]\'>' + escHtml(JSON.stringify(mc.policyTree || [], null, 2)) + '</textarea>';
  body += '</div>';

  // === 8. 重大决策 ===
  body += '<div id="mc-decisions" class="mc-panel" style="display:none;">';
  body += '<textarea id="mc_decisions_raw" rows="6" style="width:100%;font-family:monospace;font-size:0.78rem;" placeholder=\'[{"id":"usurp","name":"\u7BE1\u4F4D"}]\'>' + escHtml(JSON.stringify(mc.decisions || [], null, 2)) + '</textarea>';
  body += '</div>';

  // === 9. 贸易路线 ===
  body += '<div id="mc-trade" class="mc-panel" style="display:none;">';
  body += '<div style="font-size:0.82rem;color:var(--txt-d);margin-bottom:0.4rem;">\u5B9A\u4E49\u8D38\u6613\u8DEF\u7EBF\uFF0C\u6BCF\u56DE\u5408\u7ED3\u7B97\u8D38\u6613\u6536\u5165\u3002\u8D38\u6613\u91CF\u4E3A\u57FA\u7840\u6536\u5165\uFF08\u4F1A\u53D7\u5B89\u5168\u7CFB\u6570\u8C03\u6574\uFF09\u3002</div>';
  body += '<div id="mc-trade-list"></div>';
  body += '<button onclick="_mcAddTradeRoute()" style="padding:4px 12px;font-size:0.78rem;margin-top:0.3rem;">+ \u6DFB\u52A0\u8D38\u6613\u8DEF\u7EBF</button>';
  body += '</div>';

  // === 10. JSON原始 ===
  body += '<div id="mc-raw" class="mc-panel" style="display:none;">';
  body += '<textarea id="mc_raw_json" rows="12" style="width:100%;font-family:monospace;font-size:0.78rem;">' + escHtml(JSON.stringify(mc, null, 2)) + '</textarea>';
  body += '</div>';

  if (typeof openGenericModal === 'function') {
    openGenericModal('\u673A\u5236\u914D\u7F6E\u7F16\u8F91', body, function() {
      // 收集所有面板数据
      mc.couplingRules = _mcCollectCoupling();
      mc.npcBehaviorTypes = _mcCollectBehaviors();
      mc.agendaTemplates = _mcCollectAgendas();
      mc.eraProgress = _mcCollectEraRules();
      // 角色规则
      if (!mc.characterRules) mc.characterRules = {};
      if (!mc.characterRules.healthConfig) mc.characterRules.healthConfig = {};
      var hEl;
      hEl = document.getElementById('mc-hDecay'); if (hEl) mc.characterRules.healthConfig.monthlyDecay = parseFloat(hEl.value) || 0.1;
      hEl = document.getElementById('mc-ageThresh'); if (hEl) mc.characterRules.healthConfig.ageAccelThreshold = parseInt(hEl.value) || 60;
      hEl = document.getElementById('mc-ageAccel'); if (hEl) mc.characterRules.healthConfig.ageAccelRate = parseFloat(hEl.value) || 0.3;
      // NPC意图调度
      if (!mc.npcIntentConfig) mc.npcIntentConfig = {};
      hEl = document.getElementById('mc-niHigh'); if (hEl) mc.npcIntentConfig.highImportanceIntervalDays = parseInt(hEl.value) || 15;
      hEl = document.getElementById('mc-niMid'); if (hEl) mc.npcIntentConfig.midImportanceIntervalDays = parseInt(hEl.value) || 45;
      hEl = document.getElementById('mc-niLow'); if (hEl) mc.npcIntentConfig.lowImportanceIntervalDays = parseInt(hEl.value) || 90;
      // 贸易路线
      mc.tradeRoutes = _mcCollectTradeRoutes();
      // 政策树/决策
      var _tryParse = function(id, fb) { var el=document.getElementById(id); if(!el||!el.value.trim())return fb; try{return JSON.parse(el.value);}catch(e){showToast(id+' JSON\u683C\u5F0F\u9519\u8BEF');return fb;} };
      mc.policyTree = _tryParse('mc_policy_raw', mc.policyTree || []);
      mc.decisions = _tryParse('mc_decisions_raw', mc.decisions || []);
      // 原始JSON覆盖——仅当用户当前在JSON原始标签页时才应用（防止旧数据覆盖UI编辑）
      var _rawPanel = document.getElementById('mc-raw');
      if (_rawPanel && _rawPanel.style.display !== 'none') {
        var rawEl = document.getElementById('mc_raw_json');
        if (rawEl && rawEl.value.trim()) {
          try { var rawObj = JSON.parse(rawEl.value); Object.assign(mc, rawObj); } catch(e) { /* 忽略raw覆盖错误 */ }
        }
      }
      if (typeof autoSave === 'function') autoSave();
      if (typeof showToast === 'function') showToast('\u673A\u5236\u914D\u7F6E\u5DF2\u4FDD\u5B58');
    });
    // 渲染列表内容
    setTimeout(function() {
      _mcRenderCouplingList(mc.couplingRules || []);
      _mcRenderBehaviorList(mc.npcBehaviorTypes || []);
      _mcRenderAgendaList(mc.agendaTemplates || []);
      _mcRenderEraRules(mc.eraProgress || {});
      _mcRenderTradeRouteList(mc.tradeRoutes || []);
    }, 100);
  }
}

// === 标签页切换 ===
function _mcSwitchTab(panelId, btn) {
  document.querySelectorAll('.mc-panel').forEach(function(p){p.style.display='none';});
  document.querySelectorAll('.mc-tab-btn').forEach(function(b){b.style.background='var(--bg-2)';b.style.color='var(--txt-s)';b.classList.remove('active');});
  var panel = document.getElementById(panelId); if(panel)panel.style.display='block';
  if(btn){btn.style.background='var(--gold-d)';btn.style.color='#fff';btn.classList.add('active');}
}

// === 状态耦合规则CRUD ===
function _mcRenderCouplingList(rules) {
  var el = document.getElementById('mc-coupling-list'); if (!el) return;
  if (!rules || rules.length === 0) { el.innerHTML = '<div style="color:var(--txt-d);font-size:0.78rem;">\u6682\u65E0\u89C4\u5219\u3002AI\u4ECD\u53EF\u81EA\u884C\u63A8\u6F14\u72B6\u6001\u8054\u52A8\u3002</div>'; return; }
  el.innerHTML = rules.map(function(r,i){
    return '<div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;padding:4px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;">'+
      '<span style="color:var(--gold);min-width:16px;">#'+(i+1)+'</span>'+
      '\u5F53 <input class="mc-cr-if" value="'+escHtml(r.if||'')+'" style="width:140px;font-size:0.75rem;" placeholder="GM.stateTreasury<0">'+
      ' \u2192 <input class="mc-cr-target" value="'+escHtml(r.target||'')+'" style="width:80px;font-size:0.75rem;" placeholder="\u76EE\u6807\u53D8\u91CF">'+
      ' \u6708\u57FA\u51C6 <input class="mc-cr-pm" type="number" step="0.5" value="'+(r.perMonth||0)+'" style="width:50px;font-size:0.75rem;">'+
      ' \u539F\u56E0 <input class="mc-cr-reason" value="'+escHtml(r.reason||'')+'" style="width:100px;font-size:0.75rem;">'+
      ' <button onclick="this.parentElement.remove()" style="color:var(--red);font-size:0.8rem;background:none;border:none;cursor:pointer;">\u2715</button></div>';
  }).join('');
}
function _mcAddCoupling() { var el=document.getElementById('mc-coupling-list'); if(!el)return; var d=document.createElement('div'); d.style.cssText='display:flex;gap:4px;align-items:center;margin-bottom:4px;padding:4px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;'; d.innerHTML='<span style="color:var(--gold);min-width:16px;">+</span>\u5F53 <input class="mc-cr-if" style="width:140px;font-size:0.75rem;" placeholder="GM.stateTreasury<0"> \u2192 <input class="mc-cr-target" style="width:80px;font-size:0.75rem;" placeholder="\u76EE\u6807\u53D8\u91CF"> \u6708\u57FA\u51C6 <input class="mc-cr-pm" type="number" step="0.5" value="0" style="width:50px;font-size:0.75rem;"> \u539F\u56E0 <input class="mc-cr-reason" style="width:100px;font-size:0.75rem;"> <button onclick="this.parentElement.remove()" style="color:var(--red);font-size:0.8rem;background:none;border:none;cursor:pointer;">\u2715</button>'; el.appendChild(d); }
function _mcCollectCoupling() { var items=[]; document.querySelectorAll('#mc-coupling-list > div').forEach(function(row){ var r={}; var ifs=row.querySelector('.mc-cr-if'); if(ifs)r.if=ifs.value.trim(); var tg=row.querySelector('.mc-cr-target'); if(tg)r.target=tg.value.trim(); var pm=row.querySelector('.mc-cr-pm'); if(pm)r.perMonth=parseFloat(pm.value)||0; var rs=row.querySelector('.mc-cr-reason'); if(rs)r.reason=rs.value.trim(); if(r.if&&r.target)items.push(r); }); return items; }

// === NPC行为类型CRUD ===
function _mcRenderBehaviorList(types) {
  var el = document.getElementById('mc-npcBehavior-list'); if (!el) return;
  if (!types || types.length === 0) { el.innerHTML = '<div style="color:var(--txt-d);font-size:0.78rem;">\u6682\u65E0\u884C\u4E3A\u7C7B\u578B\u3002AI\u4ECD\u53EF\u81EA\u7531\u751F\u6210NPC\u884C\u4E3A\u3002</div>'; return; }
  el.innerHTML = types.map(function(t,i){
    return '<div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;padding:4px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;">'+
      'ID <input class="mc-bt-id" value="'+escHtml(t.id||'')+'" style="width:80px;font-size:0.75rem;">'+
      ' \u540D\u79F0 <input class="mc-bt-name" value="'+escHtml(t.name||'')+'" style="width:80px;font-size:0.75rem;">'+
      ' \u6743\u91CD\u56E0\u5B50 <input class="mc-bt-wf" value="'+escHtml(JSON.stringify(t.weightFactors||{}))+'" style="width:160px;font-size:0.75rem;" placeholder=\'{"intelligence":0.5}\'>'+
      ' <button onclick="this.parentElement.remove()" style="color:var(--red);font-size:0.8rem;background:none;border:none;cursor:pointer;">\u2715</button></div>';
  }).join('');
}
function _mcAddBehavior() { var el=document.getElementById('mc-npcBehavior-list'); if(!el)return; var d=document.createElement('div'); d.style.cssText='display:flex;gap:4px;align-items:center;margin-bottom:4px;padding:4px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;'; d.innerHTML='ID <input class="mc-bt-id" style="width:80px;font-size:0.75rem;" placeholder="petition"> \u540D\u79F0 <input class="mc-bt-name" style="width:80px;font-size:0.75rem;" placeholder="\u4E0A\u4E66\u8C0F\u8A00"> \u6743\u91CD\u56E0\u5B50 <input class="mc-bt-wf" style="width:160px;font-size:0.75rem;" placeholder=\'{"intelligence":0.5}\'> <button onclick="this.parentElement.remove()" style="color:var(--red);font-size:0.8rem;background:none;border:none;cursor:pointer;">\u2715</button>'; el.appendChild(d); }
function _mcCollectBehaviors() { var items=[]; document.querySelectorAll('#mc-npcBehavior-list > div').forEach(function(row){ var t={}; var id=row.querySelector('.mc-bt-id'); if(id)t.id=id.value.trim(); var nm=row.querySelector('.mc-bt-name'); if(nm)t.name=nm.value.trim(); var wf=row.querySelector('.mc-bt-wf'); if(wf){try{t.weightFactors=JSON.parse(wf.value);}catch(e){t.weightFactors={};}} if(t.id)items.push(t); }); return items; }

// === 议程模板CRUD ===
function _mcRenderAgendaList(agendas) {
  var el = document.getElementById('mc-agenda-list'); if (!el) return;
  if (!agendas || agendas.length === 0) { el.innerHTML = '<div style="color:var(--txt-d);font-size:0.78rem;">\u6682\u65E0\u8BAE\u9898\u6A21\u677F\u3002</div>'; return; }
  el.innerHTML = agendas.map(function(a,i){
    return '<div style="margin-bottom:6px;padding:6px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;">'+
      '\u8BAE\u9898 <input class="mc-ag-title" value="'+escHtml(a.title||'')+'" style="width:120px;font-size:0.75rem;">'+
      ' \u6761\u4EF6 <input class="mc-ag-cond" value="'+escHtml(a.condition||'')+'" style="width:150px;font-size:0.75rem;" placeholder="GM.stateTreasury<100">'+
      ' <button onclick="this.parentElement.remove()" style="color:var(--red);font-size:0.8rem;background:none;border:none;cursor:pointer;float:right;">\u2715</button></div>';
  }).join('');
}
function _mcAddAgenda() { var el=document.getElementById('mc-agenda-list'); if(!el)return; var d=document.createElement('div'); d.style.cssText='margin-bottom:6px;padding:6px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;'; d.innerHTML='\u8BAE\u9898 <input class="mc-ag-title" style="width:120px;font-size:0.75rem;" placeholder="\u662F\u5426\u52A0\u7A0E"> \u6761\u4EF6 <input class="mc-ag-cond" style="width:150px;font-size:0.75rem;" placeholder="GM.stateTreasury<100"> <button onclick="this.parentElement.remove()" style="color:var(--red);font-size:0.8rem;background:none;border:none;cursor:pointer;float:right;">\u2715</button>'; el.appendChild(d); }
function _mcCollectAgendas() { var items=[]; document.querySelectorAll('#mc-agenda-list > div').forEach(function(row){ var a={}; var ti=row.querySelector('.mc-ag-title'); if(ti)a.title=ti.value.trim(); var co=row.querySelector('.mc-ag-cond'); if(co)a.condition=co.value.trim(); if(a.title)items.push(a); }); return items; }

// === 时代进度规则CRUD ===
function _mcRenderEraRules(ep) {
  var _renderList = function(containerId, rules) {
    var el = document.getElementById(containerId); if (!el) return;
    if (!rules || rules.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = rules.map(function(r){
      return '<div style="display:flex;gap:4px;align-items:center;margin-bottom:3px;font-size:0.75rem;">'+
        '<input class="mc-era-cond" value="'+escHtml(r.condition||'')+'" style="width:180px;font-size:0.75rem;" placeholder="GM.stateTreasury<0">'+
        ' \u6807\u7B7E <input class="mc-era-label" value="'+escHtml(r.label||'')+'" style="width:100px;font-size:0.75rem;">'+
        ' <button onclick="this.parentElement.remove()" style="color:var(--red);background:none;border:none;cursor:pointer;">\u2715</button></div>';
    }).join('');
  };
  _renderList('mc-era-collapse', (ep.collapseRules||[]));
  _renderList('mc-era-restoration', (ep.restorationRules||[]));
}
function _mcAddEraRule(type) { var el=document.getElementById('mc-era-'+type); if(!el)return; var d=document.createElement('div'); d.style.cssText='display:flex;gap:4px;align-items:center;margin-bottom:3px;font-size:0.75rem;'; d.innerHTML='<input class="mc-era-cond" style="width:180px;font-size:0.75rem;" placeholder="GM.stateTreasury<0"> \u6807\u7B7E <input class="mc-era-label" style="width:100px;font-size:0.75rem;"> <button onclick="this.parentElement.remove()" style="color:var(--red);background:none;border:none;cursor:pointer;">\u2715</button>'; el.appendChild(d); }
function _mcCollectEraRules() {
  var ep = {};
  var _collect = function(containerId) {
    var items=[]; var el=document.getElementById(containerId); if(!el)return items;
    el.querySelectorAll('div').forEach(function(row){ var r={}; var c=row.querySelector('.mc-era-cond'); if(c)r.condition=c.value.trim(); var l=row.querySelector('.mc-era-label'); if(l)r.label=l.value.trim(); if(r.condition)items.push(r); });
    return items;
  };
  ep.collapseRules = _collect('mc-era-collapse');
  ep.restorationRules = _collect('mc-era-restoration');
  return ep;
}

// === 贸易路线CRUD ===
function _mcRenderTradeRouteList(routes) {
  var el = document.getElementById('mc-trade-list'); if (!el) return;
  if (!routes || routes.length === 0) { el.innerHTML = '<div style="color:var(--txt-d);font-size:0.78rem;">\u6682\u65E0\u8D38\u6613\u8DEF\u7EBF\u3002</div>'; return; }
  el.innerHTML = routes.map(function(r,i){
    return '<div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;padding:4px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;flex-wrap:wrap;">'+
      '<span style="color:var(--gold);min-width:16px;">#'+(i+1)+'</span>'+
      '\u8D77\u70B9 <input class="mc-tr-from" value="'+escHtml(r.from||'')+'" style="width:80px;font-size:0.75rem;" placeholder="\u957F\u5B89">'+
      ' \u2192 <input class="mc-tr-to" value="'+escHtml(r.to||'')+'" style="width:80px;font-size:0.75rem;" placeholder="\u6D1B\u9633">'+
      ' \u8D27\u7269 <input class="mc-tr-goods" value="'+escHtml(r.goods||'')+'" style="width:60px;font-size:0.75rem;" placeholder="\u4E1D\u7EF8">'+
      ' \u8D38\u6613\u91CF <input class="mc-tr-volume" type="number" value="'+(r.volume||100)+'" style="width:60px;font-size:0.75rem;">'+
      ' \u98CE\u9669 <input class="mc-tr-risk" type="number" step="0.1" value="'+(r.risk||0)+'" style="width:50px;font-size:0.75rem;" min="0" max="1">'+
      ' \u63A7\u5236\u65B9 <input class="mc-tr-ctrl" value="'+escHtml(r.controlledBy||'')+'" style="width:70px;font-size:0.75rem;">'+
      ' <button onclick="this.parentElement.remove()" style="color:var(--red);font-size:0.8rem;background:none;border:none;cursor:pointer;">\u2715</button></div>';
  }).join('');
}
function _mcAddTradeRoute() {
  var el=document.getElementById('mc-trade-list'); if(!el)return;
  // 如果只有占位文字则清空
  if (el.querySelector('div') && !el.querySelector('.mc-tr-from')) el.innerHTML = '';
  var d=document.createElement('div');
  d.style.cssText='display:flex;gap:4px;align-items:center;margin-bottom:4px;padding:4px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;flex-wrap:wrap;';
  d.innerHTML='<span style="color:var(--gold);min-width:16px;">+</span>'+
    '\u8D77\u70B9 <input class="mc-tr-from" style="width:80px;font-size:0.75rem;" placeholder="\u957F\u5B89">'+
    ' \u2192 <input class="mc-tr-to" style="width:80px;font-size:0.75rem;" placeholder="\u6D1B\u9633">'+
    ' \u8D27\u7269 <input class="mc-tr-goods" style="width:60px;font-size:0.75rem;" placeholder="\u4E1D\u7EF8">'+
    ' \u8D38\u6613\u91CF <input class="mc-tr-volume" type="number" value="100" style="width:60px;font-size:0.75rem;">'+
    ' \u98CE\u9669 <input class="mc-tr-risk" type="number" step="0.1" value="0" style="width:50px;font-size:0.75rem;" min="0" max="1">'+
    ' \u63A7\u5236\u65B9 <input class="mc-tr-ctrl" style="width:70px;font-size:0.75rem;">'+
    ' <button onclick="this.parentElement.remove()" style="color:var(--red);font-size:0.8rem;background:none;border:none;cursor:pointer;">\u2715</button>';
  el.appendChild(d);
}
function _mcCollectTradeRoutes() {
  var items=[];
  document.querySelectorAll('#mc-trade-list > div').forEach(function(row){
    var r={};
    var f=row.querySelector('.mc-tr-from'); if(f)r.from=f.value.trim();
    var t=row.querySelector('.mc-tr-to'); if(t)r.to=t.value.trim();
    var g=row.querySelector('.mc-tr-goods'); if(g)r.goods=g.value.trim();
    var v=row.querySelector('.mc-tr-volume'); if(v)r.volume=parseInt(v.value)||100;
    var rk=row.querySelector('.mc-tr-risk'); if(rk)r.risk=parseFloat(rk.value)||0;
    var c=row.querySelector('.mc-tr-ctrl'); if(c)r.controlledBy=c.value.trim();
    if(r.from&&r.to)items.push(r);
  });
  return items;
}

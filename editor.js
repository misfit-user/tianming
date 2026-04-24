// ============================================================
// 剧本编辑器 — 剩余功能 (editor.js)
// 此文件包含未被提取到独立模块的编辑器功能。
// 依赖: editor-core.js, editor-crud.js, editor-military.js,
//       editor-game-systems.js, editor-government.js,
//       editor-ai-gen.js, editor-ai-validate.js, editor-map.js
// ============================================================

  function renderMap() {
    console.log('[renderMap] Called with:', {
      hasMap: !!scriptData.map,
      mapItemsLength: scriptData.map && scriptData.map.items ? scriptData.map.items.length : 0
    });
    if (!scriptData.map) scriptData.map = { items: [] };
    if (!scriptData.map.items) scriptData.map.items = [];
    var el = document.getElementById('mapItemList');
    if (!el) return;
    var items = scriptData.map.items;
    if (!items.length) {
      el.innerHTML = '<div style="color:var(--txt-d);padding:8px">\u6682\u65e0\u5730\u56fe\u6570\u636e</div>';
    } else {
      console.log('[renderMap] Rendering', items.length, 'map items');
      var typeColor = { city: 'var(--gold)', strategic: '#e05c5c', geo: '#5ca8e0' };
      var typeLabel = { city: '\u57ce\u5e02', strategic: '\u6218\u7565\u8981\u5730', geo: '\u5730\u7406' };
      el.innerHTML = items.map(function(it, i) {
        var t = it.type || 'city';
        var col = typeColor[t] || 'var(--txt-d)';
        var lbl = typeLabel[t] || t;
        var sub = [];
        if (it.owner) sub.push('\u5c5e\u65bc:' + escHtml(it.owner));
        if (it.controller) sub.push('\u63a7\u5236:' + escHtml(it.controller));
        if (it.population) sub.push('\u4eba\u53e3:' + escHtml(it.population));
        if (it.climate) sub.push('\u6c14\u5019:' + escHtml(it.climate));
        if (it.significance) sub.push(escHtml(it.significance));
        if (it.resources) sub.push('\u8d44\u6e90:' + escHtml(it.resources));
        return '<div style="border:1px solid var(--bg-4);border-radius:6px;margin-bottom:6px;overflow:hidden">' +
          '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-2)">' +
          '<span style="color:' + col + ';font-weight:bold;font-size:12px;flex:0 0 auto">[' + escHtml(lbl) + ']</span>' +
          '<strong style="flex:1">' + escHtml(it.name || '') + '</strong>' +
          (sub.length ? '<span style="font-size:11px;color:var(--txt-d)">' + sub.join(' | ') + '</span>' : '') +
          '<button class="bd bsm" onclick="editMapItem(' + i + ')">\u2756</button>' +
          '<button class="bd bsm" onclick="deleteMapItem(' + i + ')">\u2715</button>' +
          '</div>' +
          (it.description ? '<div style="padding:4px 8px 6px 8px;font-size:12px;color:var(--txt-d)">' + escHtml(it.description) + '</div>' : '') +
          '</div>';
      }).join('');
    }
    updateBadge('map', items.length);
  }

  function addMapItem() {
    var typeOpts = '<option value="city">\u57ce\u5e02</option><option value="strategic">\u6218\u7565\u8981\u5730</option><option value="geo">\u5730\u7406\u73af\u5883</option>';
    var body = '<div class="form-group"><label>\u7c7b\u578b</label>' +
      '<select id="gm_type" onchange="window._mapFormUpdate()">' + typeOpts + '</select></div>' +
      '<div class="form-group"><label>\u540d\u79f0</label><input id="gm_name" placeholder="\u5982\uff1a\u957f\u5b89\u57ce"></div>' +
      '<div id="gm_extra"></div>' +
      '<div class="form-group"><label>\u63cf\u8ff0</label><textarea id="gm_desc" rows="3"></textarea></div>';
    openGenericModal('\u6dfb\u52a0\u5730\u56fe\u6761\u76ee', body, function() {
      var t = gv('gm_type');
      var item = { type: t, name: gv('gm_name').trim(), description: gv('gm_desc').trim() };
      if (t === 'city') {
        item.owner = gv('gm_owner') || '';
        item.population = gv('gm_population') || '';
        item.resources = gv('gm_resources') || '';
        item.defenses = gv('gm_defenses') || '';
      } else if (t === 'strategic') {
        item.controller = gv('gm_controller') || '';
        item.significance = gv('gm_significance') || '';
      } else if (t === 'geo') {
        item.climate = gv('gm_climate') || '';
      }
      if (!item.name) { showToast('\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a'); return; }
      if (!scriptData.map) scriptData.map = { items: [] };
      if (!scriptData.map.items) scriptData.map.items = [];
      scriptData.map.items.push(item);
      renderMap();
      autoSave();
    });
    setTimeout(function() { window._mapFormUpdate(); }, 50);
  }

  window._mapFormUpdate = function() {
    var t = gv('gm_type');
    var ex = document.getElementById('gm_extra');
    if (!ex) return;
    if (t === 'city') {
      ex.innerHTML =
        '<div class="form-group"><label>\u5c5e\u65bc</label><input id="gm_owner"></div>' +
        '<div class="form-group"><label>\u4eba\u53e3</label><input id="gm_population"></div>' +
        '<div class="form-group"><label>\u8d44\u6e90</label><input id="gm_resources"></div>' +
        '<div class="form-group"><label>\u9632\u5fa1</label><input id="gm_defenses"></div>';
    } else if (t === 'strategic') {
      ex.innerHTML =
        '<div class="form-group"><label>\u63a7\u5236\u65b9</label><input id="gm_controller"></div>' +
        '<div class="form-group"><label>\u6218\u7565\u610f\u4e49</label><input id="gm_significance"></div>';
    } else if (t === 'geo') {
      ex.innerHTML =
        '<div class="form-group"><label>\u6c14\u5019\u5730\u8c8c</label><input id="gm_climate"></div>';
    } else {
      ex.innerHTML = '';
    }
  };

  function editMapItem(i) {
    if (!scriptData.map || !scriptData.map.items) return;
    var item = scriptData.map.items[i];
    if (!item) return;
    var t = item.type || 'city';
    var typeOpts =
      '<option value="city"' + (t==='city'?' selected':'') + '>\u57ce\u5e02</option>' +
      '<option value="strategic"' + (t==='strategic'?' selected':'') + '>\u6218\u7565\u8981\u5730</option>' +
      '<option value="geo"' + (t==='geo'?' selected':'') + '>\u5730\u7406\u73af\u5883</option>';
    var extraHTML = '';
    if (t === 'city') {
      extraHTML =
        '<div class="form-group"><label>\u5c5e\u65bc</label><input id="gm_owner" value="' + escHtml(item.owner||'') + '"></div>' +
        '<div class="form-group"><label>\u4eba\u53e3</label><input id="gm_population" value="' + escHtml(item.population||'') + '"></div>' +
        '<div class="form-group"><label>\u8d44\u6e90</label><input id="gm_resources" value="' + escHtml(item.resources||'') + '"></div>' +
        '<div class="form-group"><label>\u9632\u5fa1</label><input id="gm_defenses" value="' + escHtml(item.defenses||'') + '"></div>';
    } else if (t === 'strategic') {
      extraHTML =
        '<div class="form-group"><label>\u63a7\u5236\u65b9</label><input id="gm_controller" value="' + escHtml(item.controller||'') + '"></div>' +
        '<div class="form-group"><label>\u6218\u7565\u610f\u4e49</label><input id="gm_significance" value="' + escHtml(item.significance||'') + '"></div>';
    } else if (t === 'geo') {
      extraHTML =
        '<div class="form-group"><label>\u6c14\u5019\u5730\u8c8c</label><input id="gm_climate" value="' + escHtml(item.climate||'') + '"></div>';
    }
    var body =
      '<div class="form-group"><label>\u7c7b\u578b</label>' +
      '<select id="gm_type" disabled>' + typeOpts + '</select></div>' +
      '<div class="form-group"><label>\u540d\u79f0</label><input id="gm_name" value="' + escHtml(item.name||'') + '"></div>' +
      '<div id="gm_extra">' + extraHTML + '</div>' +
      '<div class="form-group"><label>\u63cf\u8ff0</label><textarea id="gm_desc" rows="3">' + escHtml(item.description||'') + '</textarea></div>';
    openGenericModal('\u7f16\u8f91\u5730\u56fe\u6761\u76ee', body, function() {
      item.name = gv('gm_name').trim() || item.name;
      item.description = gv('gm_desc').trim();
      if (t === 'city') {
        item.owner = gv('gm_owner') || '';
        item.population = gv('gm_population') || '';
        item.resources = gv('gm_resources') || '';
        item.defenses = gv('gm_defenses') || '';
      } else if (t === 'strategic') {
        item.controller = gv('gm_controller') || '';
        item.significance = gv('gm_significance') || '';
      } else if (t === 'geo') {
        item.climate = gv('gm_climate') || '';
      }
      renderMap();
      autoSave();
    });
  }

  function deleteMapItem(i) {
    if (!scriptData.map || !scriptData.map.items) return;
    scriptData.map.items.splice(i, 1);
    renderMap();
    autoSave();
  }

  function renderWorldSettings() {
    document.getElementById('wsCultureText').value
      = scriptData.worldSettings.culture || '';
    document.getElementById('wsWeatherText').value
      = scriptData.worldSettings.weather || '';
    document.getElementById('wsReligionText').value
      = scriptData.worldSettings.religion || '';
    document.getElementById('wsEconomyText').value
      = scriptData.worldSettings.economy || '';
    document.getElementById('wsTechText').value
      = scriptData.worldSettings.technology || '';
    document.getElementById('wsDiplomacyText').value
      = scriptData.worldSettings.diplomacy || '';
    var count = 0;
    if (scriptData.worldSettings.culture) count++;
    if (scriptData.worldSettings.weather) count++;
    if (scriptData.worldSettings.religion) count++;
    if (scriptData.worldSettings.economy) count++;
    if (scriptData.worldSettings.technology) count++;
    if (scriptData.worldSettings.diplomacy) count++;
    updateBadge('worldSettings', count);
  }

  function updateWorldSetting(k, v) {
    scriptData.worldSettings[k] = v;
    autoSave();
  }

  // ============================================================
  // 时代状态系统
  // ============================================================

  function updateEraState(k, v) {
    if (!scriptData.eraState) {
      scriptData.eraState = {
        politicalUnity: 0.7,
        centralControl: 0.6,
        legitimacySource: 'hereditary',
        socialStability: 0.6,
        economicProsperity: 0.6,
        culturalVibrancy: 0.7,
        bureaucracyStrength: 0.6,
        militaryProfessionalism: 0.5,
        landSystemType: 'mixed',
        dynastyPhase: 'peak',
        contextDescription: ''
      };
    }
    scriptData.eraState[k] = v;
    autoSave();
  }

  function renderEraState() {
    if (!scriptData.eraState) {
      scriptData.eraState = {
        politicalUnity: 0.7,
        centralControl: 0.6,
        legitimacySource: 'hereditary',
        socialStability: 0.6,
        economicProsperity: 0.6,
        culturalVibrancy: 0.7,
        bureaucracyStrength: 0.6,
        militaryProfessionalism: 0.5,
        landSystemType: 'mixed',
        dynastyPhase: 'peak',
        contextDescription: ''
      };
    }

    var es = scriptData.eraState;

    // 更新滑块和数值显示
    document.getElementById('eraStatePoliticalUnity').value = es.politicalUnity;
    document.getElementById('eraStatePoliticalUnityVal').textContent = es.politicalUnity;

    document.getElementById('eraStateCentralControl').value = es.centralControl;
    document.getElementById('eraStateCentralControlVal').textContent = es.centralControl;

    document.getElementById('eraStateSocialStability').value = es.socialStability;
    document.getElementById('eraStateSocialStabilityVal').textContent = es.socialStability;

    document.getElementById('eraStateEconomicProsperity').value = es.economicProsperity;
    document.getElementById('eraStateEconomicProsperityVal').textContent = es.economicProsperity;

    document.getElementById('eraStateCulturalVibrancy').value = es.culturalVibrancy;
    document.getElementById('eraStateCulturalVibrancyVal').textContent = es.culturalVibrancy;

    document.getElementById('eraStateBureaucracyStrength').value = es.bureaucracyStrength;
    document.getElementById('eraStateBureaucracyStrengthVal').textContent = es.bureaucracyStrength;

    document.getElementById('eraStateMilitaryProfessionalism').value = es.militaryProfessionalism;
    document.getElementById('eraStateMilitaryProfessionalismVal').textContent = es.militaryProfessionalism;

    // 更新下拉框
    document.getElementById('eraStateLegitimacySource').value = es.legitimacySource;
    document.getElementById('eraStateLandSystemType').value = es.landSystemType;
    document.getElementById('eraStateDynastyPhase').value = es.dynastyPhase;

    // 更新描述
    document.getElementById('eraStateContextDescription').value = es.contextDescription || '';
  }

  // ============================================================
  // 经济配置
  // ============================================================

  function updateEconomyConfig(key, value) {
    if (!scriptData.economyConfig) {
      scriptData.economyConfig = {
        enabled: false,
        currency: '贯',
        baseIncome: 10000,
        tributeRatio: 0.3,
        tributeAdjustment: 0,
        taxRate: 0.1,
        inflationRate: 0.02,
        economicCycle: 'stable',
        specialResources: '',
        tradeSystem: '',
        description: '',
        redistributionRate: 0.3,
        tradeBonus: 0.1,
        agricultureMultiplier: 1.0,
        commerceMultiplier: 1.0
      };
    }
    scriptData.economyConfig[key] = value;

    // 更新显示
    if (key === 'enabled') {
      var content = document.getElementById('economyConfig-content');
      if (content) content.style.display = value ? 'block' : 'none';
    } else if (key === 'redistributionRate' || key === 'tributeRatio') {
      var el = document.getElementById('economy-redistribution-value');
      if (el) el.textContent = Math.round(value * 100) + '%';
    } else if (key === 'taxRate') {
      var el = document.getElementById('economy-taxRate-value');
      if (el) el.textContent = Math.round(value * 100) + '%';
    } else if (key === 'inflationRate') {
      var el = document.getElementById('economy-inflation-value');
      if (el) el.textContent = Math.round(value * 100) + '%';
    } else if (key === 'tradeBonus') {
      var el = document.getElementById('economy-tradeBonus-value');
      if (el) el.textContent = Math.round(value * 100) + '%';
    }
    autoSave();
  }

  function renderEconomyConfig() {
    if (!scriptData.economyConfig) {
      scriptData.economyConfig = {
        enabled: false,
        currency: '贯',
        baseIncome: 10000,
        tributeRatio: 0.3,
        tributeAdjustment: 0,
        taxRate: 0.1,
        inflationRate: 0.02,
        economicCycle: 'stable',
        specialResources: '',
        tradeSystem: '',
        description: '',
        redistributionRate: 0.3,
        tradeBonus: 0.1,
        agricultureMultiplier: 1.0,
        commerceMultiplier: 1.0
      };
    }

    var ec = scriptData.economyConfig;

    // 更新启用状态
    var enabledCheckbox = document.getElementById('economyConfig-enabled');
    if (enabledCheckbox) {
      enabledCheckbox.checked = ec.enabled || false;
      var content = document.getElementById('economyConfig-content');
      if (content) content.style.display = ec.enabled ? 'block' : 'none';
    }

    // 更新滑块和数值显示
    var el;
    if (el = document.getElementById('economy-redistribution')) el.value = (ec.redistributionRate || ec.tributeRatio || 0.3) * 100;
    if (el = document.getElementById('economy-redistribution-value')) el.textContent = Math.round((ec.redistributionRate || ec.tributeRatio || 0.3) * 100) + '%';
    if (el = document.getElementById('economy-baseIncome')) el.value = ec.baseIncome || 10000;
    if (el = document.getElementById('economy-taxRate')) el.value = (ec.taxRate || 0.1) * 100;
    if (el = document.getElementById('economy-taxRate-value')) el.textContent = Math.round((ec.taxRate || 0.1) * 100) + '%';
    if (el = document.getElementById('economy-inflation')) el.value = (ec.inflationRate || 0.02) * 100;
    if (el = document.getElementById('economy-inflation-value')) el.textContent = Math.round((ec.inflationRate || 0.02) * 100) + '%';
    if (el = document.getElementById('economy-tradeBonus')) el.value = (ec.tradeBonus || 0.1) * 100;
    if (el = document.getElementById('economy-tradeBonus-value')) el.textContent = Math.round((ec.tradeBonus || 0.1) * 100) + '%';
    if (el = document.getElementById('economy-agricultureMultiplier')) el.value = ec.agricultureMultiplier || 1.0;
    if (el = document.getElementById('economy-commerceMultiplier')) el.value = ec.commerceMultiplier || 1.0;

    // 更新新增字段
    if (el = document.getElementById('economy-currency')) el.value = ec.currency || '贯';
    if (el = document.getElementById('economy-cycle')) el.value = ec.economicCycle || 'stable';
    if (el = document.getElementById('economy-specialResources')) el.value = ec.specialResources || '';
    if (el = document.getElementById('economy-tradeSystem')) el.value = ec.tradeSystem || '';
    if (el = document.getElementById('economy-description')) el.value = ec.description || '';
  }

  async function aiGenerateEconomyConfig() {
    var context = '剧本名称：' + (scriptData.name || '未命名') + '\n'
      + '剧本概述：' + (scriptData.overview || '无') + '\n'
      + '朝代：' + (scriptData.dynasty || '未知') + '\n'
      + '皇帝：' + (scriptData.emperor || '未知') + '\n'
      + '开始年份：' + (scriptData.gameSettings.startYear || 1) + '\n';

    if (scriptData.eraState && scriptData.eraState.contextDescription) {
      context += '时代状态：' + scriptData.eraState.contextDescription + '\n';
      context += '集权度：' + (scriptData.eraState.centralControl || 0.5) + '\n';
      context += '经济繁荣度：' + (scriptData.eraState.economicProsperity || 0.5) + '\n';
    }

    var prompt = '你是一个历史经济专家。根据以下剧本背景，为游戏设计合理的经济配置参数：\n\n'
      + context + '\n'
      + '请返回JSON格式，包含以下字段：\n'
      + '{\n'
      + '  "currency": "贯",  // 货币名称，如：贯、两、文、铜钱等\n'
      + '  "baseIncome": 10000,  // 10-100000，基础月度收入，繁荣时代可提高\n'
      + '  "tributeRatio": 0.3,  // 0-1，贡奉比例（地方向中央），集权度高时高（0.5-0.8），低时低（0.1-0.3）\n'
      + '  "redistributionRate": 0.3,  // 0-1，中央回拨比例，集权度高时可降低（0.2-0.3），集权度低时应提高（0.4-0.5）\n'
      + '  "taxRate": 0.1,  // 0-1，基础税率，通常0.1-0.25\n'
      + '  "inflationRate": 0.02,  // 0-0.2，通货膨胀率，稳定时代0.01-0.03，动荡时代0.05-0.15\n'
      + '  "economicCycle": "stable",  // prosperity/stable/recession/depression\n'
      + '  "specialResources": "丝绸、茶叶、盐铁",  // 该朝代的重要经济资源\n'
      + '  "tradeSystem": "市舶司管理海外贸易，盐铁专营",  // 贸易制度描述\n'
      + '  "tradeBonus": 0.1,  // 0-1，贸易加成，贸易繁荣时代（如宋代）0.2-0.4，其他0.05-0.15\n'
      + '  "agricultureMultiplier": 1.0,  // 0.1-5，农业产出系数，农业时代1.0-1.5\n'
      + '  "commerceMultiplier": 1.0,  // 0.1-5，商业产出系数，商业繁荣时代1.5-2.5\n'
      + '  "description": "该朝代经济运作方式的总体描述"  // 为AI推演提供背景知识\n'
      + '}\n\n'
      + '注意：\n'
      + '1. 参数要符合历史背景和时代特征\n'
      + '2. 集权度高的朝代（秦汉、明清）：高贡奉率、低回拨率、高税率\n'
      + '3. 分裂时期（五代十国、南北朝）：低贡奉率、高回拨率、低税率、高通胀\n'
      + '4. 商业繁荣时期（宋代）：高贸易加成、高商业系数\n'
      + '5. 农业为主时期：高农业系数、低商业系数\n'
      + '6. 货币名称要符合历史（唐宋用贯、明清用两等）\n'
      + '7. description要详细描述该朝代的财政制度、税收体系、贸易特点等';

    // 读取已有经济配置
    var existingContext = '';
    if (scriptData.economyConfig && Object.keys(scriptData.economyConfig).length > 0) {
      existingContext = '\n\n【已有经济配置】\n' + JSON.stringify(scriptData.economyConfig, null, 2) + '\n\n请在现有配置基础上补充完善，调整参数使其更符合历史实际，增加更多细节描述。如果某些字段已有合理值，可以保留或微调。\n';
      prompt += existingContext;
    }

    try {
      showLoading('正在生成经济配置...');
      var result = await callAIEditor(prompt, 1200);
      var jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');

      var data = JSON.parse(jsonMatch[0]);
      if (!scriptData.economyConfig) scriptData.economyConfig = {};

      scriptData.economyConfig.currency = data.currency || '贯';
      scriptData.economyConfig.baseIncome = data.baseIncome || 10000;
      scriptData.economyConfig.tributeRatio = data.tributeRatio || 0.3;
      scriptData.economyConfig.redistributionRate = data.redistributionRate || 0.3;
      scriptData.economyConfig.taxRate = data.taxRate || 0.1;
      scriptData.economyConfig.inflationRate = data.inflationRate || 0.02;
      scriptData.economyConfig.economicCycle = data.economicCycle || 'stable';
      scriptData.economyConfig.specialResources = data.specialResources || '';
      scriptData.economyConfig.tradeSystem = data.tradeSystem || '';
      scriptData.economyConfig.tradeBonus = data.tradeBonus || 0.1;
      scriptData.economyConfig.agricultureMultiplier = data.agricultureMultiplier || 1.0;
      scriptData.economyConfig.commerceMultiplier = data.commerceMultiplier || 1.0;
      scriptData.economyConfig.description = data.description || '';

      renderEconomyConfig();
      hideLoading();
      showToast('经济配置生成成功！');
    } catch(e) {
      hideLoading();
      alert('生成失败：' + e.message);
    }
  }

  window.updateEconomyConfig = updateEconomyConfig;
  window.aiGenerateEconomyConfig = aiGenerateEconomyConfig;

  function updatePostSystemConfig(key, value) {
    if (!scriptData.postSystem) {
      scriptData.postSystem = {
        enabled: false,
        postRules: []
      };
    }
    scriptData.postSystem[key] = value;

    // 更新显示
    renderPostSystem();
  }

  function renderPostSystem() {
    if (!scriptData.postSystem) {
      scriptData.postSystem = {
        enabled: false,
        postRules: []
      };
    }

    var ps = scriptData.postSystem;
    var listDiv = document.getElementById('postTemplates-list');
    if (!listDiv) return;

    listDiv.innerHTML = '';

    if (!ps.postRules || ps.postRules.length === 0) {
      listDiv.innerHTML = '<div style="color: #666; font-style: italic; padding: 20px; text-align: center;">暂无岗位规则</div>';
      return;
    }

    ps.postRules.forEach(function(rule, idx) {
      var successionColors = {
        'appointment': '#60a5fa',
        'hereditary': '#f87171',
        'examination': '#4ade80',
        'recommendation': '#a78bfa',
        'purchase': '#fbbf24',
        'military': '#f97316'
      };
      var successionNames = {
        'appointment': '皇帝任命',
        'hereditary': '世袭',
        'examination': '科举',
        'recommendation': '举荐',
        'purchase': '捐纳',
        'military': '军功'
      };
      var color = successionColors[rule.succession] || '#9a9590';
      var successionText = successionNames[rule.succession] || rule.succession;

      var h = '<div class="card" onclick="editPostRule(' + idx + ')">';
      h += '<div class="card-title">' + escHtml(rule.positionName) + '</div>';
      h += '<div class="card-meta">';
      h += '<span class="card-tag" style="background: ' + color + ';">' + escHtml(successionText) + '</span>';
      if (rule.hasAppointmentRight) {
        h += ' <span class="card-tag tag-core">辟署权</span>';
      }
      h += '</div>';
      h += '<div class="card-desc">' + escHtml(rule.description || '暂无描述') + '</div>';
      if (rule.requirements || rule.authority) {
        h += '<div style="margin-top: 8px; font-size: 11px; color: var(--text-dim);">';
        if (rule.requirements) h += '条件: ' + escHtml(rule.requirements) + ' ';
        if (rule.authority) h += '职权: ' + escHtml(rule.authority);
        h += '</div>';
      }
      h += '<div style="position: absolute; top: 8px; right: 8px;">';
      h += '<button class="btn" style="padding: 2px 8px; font-size: 11px;" onclick="event.stopPropagation(); deletePostRule(' + idx + ')">删除</button>';
      h += '</div>';
      h += '</div>';
      listDiv.innerHTML += h;
    });
  }

  var editingPostRuleIndex = -1;

  function openAddPostTemplateModal() {
    editingPostRuleIndex = -1;
    document.getElementById('postRuleModalTitle').textContent = '添加岗位规则';
    document.getElementById('postRuleName').value = '';
    document.getElementById('postRuleSuccession').value = 'appointment';
    document.getElementById('postRuleHasAppointment').checked = false;
    document.getElementById('postRuleDescription').value = '';
    document.getElementById('postRuleRequirements').value = '';
    document.getElementById('postRuleAuthority').value = '';
    document.getElementById('postRuleModal').classList.add('show');
  }

  function editPostRule(index) {
    if (!scriptData.postSystem || !scriptData.postSystem.postRules[index]) return;

    editingPostRuleIndex = index;
    var rule = scriptData.postSystem.postRules[index];

    document.getElementById('postRuleModalTitle').textContent = '编辑岗位规则';
    document.getElementById('postRuleName').value = rule.positionName || '';
    document.getElementById('postRuleSuccession').value = rule.succession || 'appointment';
    document.getElementById('postRuleHasAppointment').checked = rule.hasAppointmentRight || false;
    document.getElementById('postRuleDescription').value = rule.description || '';
    document.getElementById('postRuleRequirements').value = rule.requirements || '';
    document.getElementById('postRuleAuthority').value = rule.authority || '';
    document.getElementById('postRuleModal').classList.add('show');
  }

  function closePostRuleModal() {
    document.getElementById('postRuleModal').classList.remove('show');
    editingPostRuleIndex = -1;
  }

  function savePostRule() {
    var positionName = document.getElementById('postRuleName').value.trim();
    var succession = document.getElementById('postRuleSuccession').value;
    var hasAppointmentRight = document.getElementById('postRuleHasAppointment').checked;
    var description = document.getElementById('postRuleDescription').value.trim();
    var requirements = document.getElementById('postRuleRequirements').value.trim();
    var authority = document.getElementById('postRuleAuthority').value.trim();

    if (!positionName) {
      alert('请输入职位名称');
      return;
    }

    if (!scriptData.postSystem) {
      scriptData.postSystem = {
        enabled: false,
        postRules: []
      };
    }
    if (!scriptData.postSystem.postRules) {
      scriptData.postSystem.postRules = [];
    }

    var postRule = {
      positionName: positionName,
      succession: succession,
      hasAppointmentRight: hasAppointmentRight,
      description: description,
      requirements: requirements,
      authority: authority
    };

    if (editingPostRuleIndex >= 0) {
      // 编辑现有岗位规则
      scriptData.postSystem.postRules[editingPostRuleIndex] = postRule;
    } else {
      // 添加新岗位规则
      scriptData.postSystem.postRules.push(postRule);
    }

    closePostRuleModal();
    renderPostSystem();
    autoSave();
    showToast('岗位规则已保存');
  }

  function deletePostRule(index) {
    if (!scriptData.postSystem || !scriptData.postSystem.postRules[index]) return;

    var rule = scriptData.postSystem.postRules[index];
    if (!confirm('确定要删除岗位规则"' + rule.positionName + '"吗？')) return;

    scriptData.postSystem.postRules.splice(index, 1);
    renderPostSystem();
    autoSave();
    showToast('岗位规则已删除');
  }

  async function aiGeneratePostTemplates() {
    var _apiCfg = {}; try { _apiCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    var apiKey = _apiCfg.key || '';
    var apiUrl = _apiCfg.url || 'https://api.openai.com/v1/chat/completions';
    var apiModel = _apiCfg.model || 'gpt-4o';

    if (!apiKey) {
      alert('请先配置 API 密钥！');
      return;
    }

    var dynasty = scriptData.dynasty || '未知朝代';
    var emperor = scriptData.emperor || '未知皇帝';
    var year = scriptData.gameSettings.startYear || 1;
    var overview = scriptData.overview || '';

    var _esP = scriptData.eraState || {};
    var postEraCtx = '';
    if (_esP.centralControl) postEraCtx += '集权度：' + Math.round((_esP.centralControl||0.5)*100) + '%\n';
    if (_esP.bureaucracyStrength) postEraCtx += '官僚体系强度：' + Math.round((_esP.bureaucracyStrength||0.5)*100) + '%\n';
    if (_esP.legitimacySource) postEraCtx += '正统来源：' + _esP.legitimacySource + '\n';

    var prompt = '你是一个中国古代历史和官制专家。根据以下剧本信息，生成该朝代的官职运作规则：\n\n'
      + '朝代：' + dynasty + '\n'
      + '皇帝：' + emperor + '\n'
      + '年份：' + year + '\n'
      + postEraCtx
      + '剧本概述：' + overview + '\n\n'
      + '注意：必须根据该朝代实际官制生成，不可套用其他朝代。\n'
      + '请返回 JSON 格式，包含 postRules 数组，每个规则包含以下字段：\n'
      + '{\n'
      + '  "postRules": [\n'
      + '    {\n'
      + '      "positionName": "节度使",  // 官职名称（简体中文）\n'
      + '      "succession": "hereditary",  // appointment/hereditary/examination/recommendation/purchase/military\n'
      + '      "hasAppointmentRight": true,  // 是否拥有辟署权（可自行任命下属）\n'
      + '      "description": "节度使掌管一方军政大权，唐末以来逐渐形成世袭制度",  // 规则的历史背景描述\n'
      + '      "requirements": "需要皇帝信任或军功显赫，通常由朝廷重臣担任",  // 任职条件\n'
      + '      "authority": "掌管辖区内的军政大权，拥有人事任命权和财政权"  // 职权范围\n'
      + '    }\n'
      + '  ]\n'
      + '}\n\n'
      + '要求：\n'
      + '1. 生成5-10个主要官职的运作规则\n'
      + '2. 官职名称必须使用简体中文，符合该朝代的历史背景\n'
      + '3. succession继承方式选项：\n'
      + '   - appointment: 皇帝任命（最常见）\n'
      + '   - hereditary: 世袭（藩镇、封国）\n'
      + '   - examination: 科举选拔\n'
      + '   - recommendation: 举荐\n'
      + '   - purchase: 捐纳\n'
      + '   - military: 军功\n'
      + '4. 根据该朝代特点判断哪些官职拥有辟署权\n'
      + '5. description要详细描述该官职的历史运作方式和特点\n'
      + '6. requirements描述任职条件（品级、资历、能力等）\n'
      + '7. authority描述职权范围和影响力\n'
      + '8. 这些规则是为了让AI推演时符合历史逻辑，不是游戏机制\n'
      + '9. 只返回 JSON，不要其他文字';

    // 读取已有岗位规则
    var existingContext = '';
    if (scriptData.postSystem && scriptData.postSystem.postRules && scriptData.postSystem.postRules.length > 0) {
      var existingPosts = scriptData.postSystem.postRules.map(function(p) {
        return '- ' + p.positionName + '（' + p.succession + '）：' + (p.description || '').substring(0, 80);
      }).join('\n');
      existingContext = '\n\n【已有岗位规则】\n' + existingPosts + '\n\n请补充新的官职规则，不要重复已有的官职。可以添加更多层级的官职（中央、地方、军事、文官等）。\n';
      prompt += existingContext;
    }

    showLoading('正在生成岗位规则...');
    try {
      var _callFn = (typeof callAIEditor === 'function') ? callAIEditor : (typeof callAI === 'function') ? callAI : null;
      if (!_callFn) throw new Error('AI调用函数不可用');
      var content = await _callFn(prompt, 4000);
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');
      var result = JSON.parse(jsonMatch[0]);

      if (!result.postRules || !Array.isArray(result.postRules)) {
        // 兜底：如果返回的是数组而非对象
        var arrMatch = content.match(/\[\s*\{[\s\S]*\]/);
        if (arrMatch) result = { postRules: JSON.parse(arrMatch[0]) };
        else throw new Error('\u8FD4\u56DE\u7684\u6570\u636E\u683C\u5F0F\u4E0D\u6B63\u786E');
      }

      // 批量添加到现有列表，而不是覆盖
      if (!scriptData.postSystem) {
        scriptData.postSystem = {
          enabled: false,
          postRules: []
        };
      }
      if (!scriptData.postSystem.postRules) {
        scriptData.postSystem.postRules = [];
      }

      // 将AI生成的岗位规则添加到现有列表
      scriptData.postSystem.postRules.push(...result.postRules);

      autoSave();
      renderPostSystem();
      showToast('岗位规则生成成功！已添加 ' + result.postRules.length + ' 个规则');

    } catch (error) {
      console.error('AI 生成失败：', error);
      showToast('AI 生成失败：' + error.message);
    } finally {
      hideLoading();
    }
  }

  window.updatePostSystemConfig = updatePostSystemConfig;
  window.openAddPostTemplateModal = openAddPostTemplateModal;
  window.editPostRule = editPostRule;
  window.deletePostRule = deletePostRule;
  window.closePostRuleModal = closePostRuleModal;
  window.savePostRule = savePostRule;
  window.aiGeneratePostTemplates = aiGeneratePostTemplates;

  // 封臣系统配置函数
  function updateVassalSystemConfig(key, value) {
    if (!scriptData.vassalSystem) {
      scriptData.vassalSystem = {
        enabled: false,
        description: ''
      };
    }
    scriptData.vassalSystem[key] = value;

    // 更新显示
    renderVassalSystem();
  }

  function renderVassalSystem() {
    if (!scriptData.vassalSystem) {
      scriptData.vassalSystem = {
        enabled: false,
        vassalTypes: [],
        vassalRelations: []
      };
    }

    var vs = scriptData.vassalSystem;
    var listDiv = document.getElementById('vassalTypes-list');
    if (!listDiv) return;

    listDiv.innerHTML = '';

    if (!vs.vassalTypes || vs.vassalTypes.length === 0) {
      listDiv.innerHTML = '<div style="color: #666; font-style: italic; padding: 20px; text-align: center;">暂无封臣类型</div>';
    } else {
      vs.vassalTypes.forEach(function(vt, index) {
        var h = '<div class="card" onclick="editVassalType(' + index + ')">';
        h += '<div class="card-title">' + escHtml(vt.name) + '</div>';
        h += '<div class="card-meta">';
        if (vt.relationshipType) {
          h += '<span class="card-tag tag-core">' + escHtml(vt.relationshipType) + '</span> ';
        }
        h += '<span class="card-tag">' + escHtml(vt.rank || '未设置') + '</span>';
        if (vt.era) h += ' <span class="card-tag">' + escHtml(vt.era) + '</span>';
        h += '</div>';

        if (vt.controlLevel || vt.succession) {
          h += '<div style="margin-top: 6px; font-size: 12px; color: var(--text-secondary);">';
          if (vt.controlLevel) h += '控制: ' + escHtml(vt.controlLevel) + ' ';
          if (vt.succession) h += '继承: ' + escHtml(vt.succession);
          h += '</div>';
        }

        // 新增：贡奉/征兵/叛乱阈值
        var numInfo = [];
        if (vt.tributeRate) numInfo.push('贡奉' + Math.round(vt.tributeRate * 100) + '%');
        if (vt.levyRate) numInfo.push('征兵' + Math.round(vt.levyRate * 100) + '%');
        if (vt.rebellionThreshold) numInfo.push('叛乱阈值' + vt.rebellionThreshold);
        if (numInfo.length > 0) {
          h += '<div style="margin-top: 4px; font-size: 11px; color: var(--accent);">' + numInfo.join(' | ') + '</div>';
        }

        // 自治领域
        if (vt.autonomyFields && vt.autonomyFields.length > 0) {
          h += '<div style="margin-top: 4px; font-size: 11px;">';
          vt.autonomyFields.forEach(function(af) {
            h += '<span class="card-tag" style="font-size:10px;margin-right:2px;">' + escHtml(af) + '</span>';
          });
          h += '</div>';
        }

        if (vt.obligations || vt.rights) {
          h += '<div class="card-desc" style="margin-top: 8px;">';
          if (vt.obligations) h += '<div style="margin-bottom: 4px;">义务: ' + escHtml(vt.obligations.substring(0, 60)) + (vt.obligations.length > 60 ? '...' : '') + '</div>';
          if (vt.rights) h += '<div>权利: ' + escHtml(vt.rights.substring(0, 60)) + (vt.rights.length > 60 ? '...' : '') + '</div>';
          h += '</div>';
        }

        if (vt.relatedTo) {
          h += '<div style="margin-top: 8px; font-size: 11px; color: var(--text-dim);">';
          h += '关联: ' + escHtml(vt.relatedTo);
          h += '</div>';
        }

        h += '<div style="position: absolute; top: 8px; right: 8px;">';
        h += '<button class="btn" style="padding: 2px 8px; font-size: 11px;" onclick="event.stopPropagation(); deleteVassalType(' + index + ')">删除</button>';
        h += '</div>';
        h += '</div>';
        listDiv.innerHTML += h;
      });
    }

    // 渲染封臣关系预设区域
    renderVassalRelations();
  }

  // 封臣关系预设渲染
  function renderVassalRelations() {
    if (!scriptData.vassalSystem.vassalRelations) scriptData.vassalSystem.vassalRelations = [];
    var relDiv = document.getElementById('vassalRelations-list');
    if (!relDiv) return;

    var rels = scriptData.vassalSystem.vassalRelations;
    var h = '';
    if (rels.length === 0) {
      h = '<div style="color: #666; font-style: italic; padding: 10px; text-align: center; font-size: 12px;">暂无预设封臣关系（开局时A势力是B势力的封臣）</div>';
    } else {
      rels.forEach(function(r, idx) {
        h += '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:13px;">';
        h += '<span style="color:var(--accent);">' + escHtml(r.vassal || '') + '</span>';
        h += '<span style="color:var(--text-dim);">→ 臣属于 →</span>';
        h += '<span style="color:var(--gold, #d4a);">' + escHtml(r.liege || '') + '</span>';
        if (r.vassalType) h += ' <span class="card-tag" style="font-size:10px;">' + escHtml(r.vassalType) + '</span>';
        h += ' <span style="font-size:11px;color:var(--text-secondary);">贡' + Math.round((r.tributeRate || 0.3) * 100) + '% 忠' + (r.loyalty || 50) + '</span>';
        h += '<button class="btn" style="padding:1px 6px;font-size:10px;margin-left:auto;" onclick="deleteVassalRelation(' + idx + ')">×</button>';
        h += '</div>';
      });
    }
    relDiv.innerHTML = h;
  }

  function addVassalRelation() {
    var factions = scriptData.factions || [];
    if (factions.length < 2) { alert('请先创建至少两个势力'); return; }

    // 弹出简易对话框
    var vassalName = prompt('封臣势力名称（从已有势力中选）：\n可选：' + factions.map(function(f){return f.name;}).join('、'));
    if (!vassalName) return;
    var liegeName = prompt('宗主势力名称：\n可选：' + factions.map(function(f){return f.name;}).join('、'));
    if (!liegeName || liegeName === vassalName) return;

    var vtNames = (scriptData.vassalSystem.vassalTypes || []).map(function(v){return v.name;});
    var vtName = vtNames.length > 0 ? prompt('封臣类型（可选）：\n可选：' + vtNames.join('、')) || '' : '';
    var tribute = parseFloat(prompt('贡奉比例（0-1，默认0.3）：') || '0.3') || 0.3;
    var loyalty = parseInt(prompt('初始忠诚度（0-100，默认60）：') || '60') || 60;

    if (!scriptData.vassalSystem.vassalRelations) scriptData.vassalSystem.vassalRelations = [];
    scriptData.vassalSystem.vassalRelations.push({
      vassal: vassalName, liege: liegeName,
      vassalType: vtName, tributeRate: Math.max(0.05, Math.min(0.8, tribute)),
      loyalty: Math.max(0, Math.min(100, loyalty))
    });
    renderVassalRelations();
    autoSave();
    showToast('封臣关系已添加');
  }

  function deleteVassalRelation(idx) {
    scriptData.vassalSystem.vassalRelations.splice(idx, 1);
    renderVassalRelations();
    autoSave();
  }

  var currentEditingVassalTypeIndex = -1;

  function openAddVassalTypeModal() {
    currentEditingVassalTypeIndex = -1;
    document.getElementById('vassalTypeModalTitle').textContent = '添加封臣类型';
    document.getElementById('vassalType-name').value = '';
    document.getElementById('vassalType-relationshipType').value = '藩镇割据';
    document.getElementById('vassalType-rank').value = '一等（亲王、节度使级）';
    document.getElementById('vassalType-obligations').value = '';
    document.getElementById('vassalType-rights').value = '';
    document.getElementById('vassalType-succession').value = '世袭罔替';
    document.getElementById('vassalType-controlLevel').value = '高度自治';
    var trEl = document.getElementById('vassalType-tributeRate'); if (trEl) trEl.value = 0.3;
    var lrEl = document.getElementById('vassalType-levyRate'); if (lrEl) lrEl.value = 0.5;
    var rbEl = document.getElementById('vassalType-rebellionThreshold'); if (rbEl) rbEl.value = 25;
    var afEl = document.getElementById('vassalType-autonomyFields'); if (afEl) afEl.value = '';
    document.getElementById('vassalType-era').value = '';
    document.getElementById('vassalType-relatedOfficials').value = '';
    document.getElementById('vassalType-relatedTo').value = '';
    var heEl = document.getElementById('vassalType-historicalExamples'); if (heEl) heEl.value = '';
    document.getElementById('vassalType-description').value = '';
    document.getElementById('vassalTypeModal').classList.add('show');
  }

  function editVassalType(index) {
    currentEditingVassalTypeIndex = index;
    var vt = scriptData.vassalSystem.vassalTypes[index];
    document.getElementById('vassalTypeModalTitle').textContent = '编辑封臣类型';
    document.getElementById('vassalType-name').value = vt.name || '';
    document.getElementById('vassalType-relationshipType').value = vt.relationshipType || '藩镇割据';
    document.getElementById('vassalType-rank').value = vt.rank || '一等（亲王、节度使级）';
    document.getElementById('vassalType-obligations').value = vt.obligations || '';
    document.getElementById('vassalType-rights').value = vt.rights || '';
    document.getElementById('vassalType-succession').value = vt.succession || '世袭罔替';
    document.getElementById('vassalType-controlLevel').value = vt.controlLevel || '高度自治';
    var trEl = document.getElementById('vassalType-tributeRate'); if (trEl) trEl.value = vt.tributeRate || 0.3;
    var lrEl = document.getElementById('vassalType-levyRate'); if (lrEl) lrEl.value = vt.levyRate || 0.5;
    var rbEl = document.getElementById('vassalType-rebellionThreshold'); if (rbEl) rbEl.value = vt.rebellionThreshold || 25;
    var afEl = document.getElementById('vassalType-autonomyFields'); if (afEl) afEl.value = Array.isArray(vt.autonomyFields) ? vt.autonomyFields.join('、') : '';
    document.getElementById('vassalType-era').value = vt.era || '';
    document.getElementById('vassalType-relatedOfficials').value = Array.isArray(vt.relatedOfficials) ? vt.relatedOfficials.join(',') : (vt.relatedOfficials || '');
    document.getElementById('vassalType-relatedTo').value = vt.relatedTo || '';
    var heEl = document.getElementById('vassalType-historicalExamples'); if (heEl) heEl.value = vt.historicalExamples || '';
    document.getElementById('vassalType-description').value = vt.description || '';
    document.getElementById('vassalTypeModal').classList.add('show');
  }

  function closeVassalTypeModal() {
    document.getElementById('vassalTypeModal').classList.remove('show');
    currentEditingVassalTypeIndex = -1;
  }

  function saveVassalType() {
    var relatedOfficialsInput = document.getElementById('vassalType-relatedOfficials').value.trim();
    var relatedOfficials = relatedOfficialsInput ? relatedOfficialsInput.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];

    var autoFieldsInput = (document.getElementById('vassalType-autonomyFields') || {}).value || '';
    var autonomyFields = autoFieldsInput ? autoFieldsInput.split(/[,，、]/).map(function(s){return s.trim();}).filter(function(s){return s;}) : [];

    var vassalType = {
      name: document.getElementById('vassalType-name').value,
      relationshipType: document.getElementById('vassalType-relationshipType').value,
      rank: document.getElementById('vassalType-rank').value,
      obligations: document.getElementById('vassalType-obligations').value,
      rights: document.getElementById('vassalType-rights').value,
      succession: document.getElementById('vassalType-succession').value,
      controlLevel: document.getElementById('vassalType-controlLevel').value,
      tributeRate: parseFloat((document.getElementById('vassalType-tributeRate') || {}).value) || 0.3,
      levyRate: parseFloat((document.getElementById('vassalType-levyRate') || {}).value) || 0.5,
      rebellionThreshold: parseInt((document.getElementById('vassalType-rebellionThreshold') || {}).value) || 25,
      autonomyFields: autonomyFields,
      era: document.getElementById('vassalType-era').value,
      relatedOfficials: relatedOfficials,
      relatedTo: document.getElementById('vassalType-relatedTo').value,
      historicalExamples: (document.getElementById('vassalType-historicalExamples') || {}).value || '',
      description: document.getElementById('vassalType-description').value
    };

    if (!vassalType.name.trim()) {
      alert('请输入封臣类型名称');
      return;
    }

    if (!scriptData.vassalSystem.vassalTypes) {
      scriptData.vassalSystem.vassalTypes = [];
    }

    if (currentEditingVassalTypeIndex >= 0) {
      scriptData.vassalSystem.vassalTypes[currentEditingVassalTypeIndex] = vassalType;
    } else {
      scriptData.vassalSystem.vassalTypes.push(vassalType);
    }

    closeVassalTypeModal();
    renderVassalSystem();
    autoSave();
    showToast('封臣类型已保存');
  }

  function deleteVassalType(index) {
    if (confirm('确定要删除这个封臣类型吗？')) {
      scriptData.vassalSystem.vassalTypes.splice(index, 1);
      renderVassalSystem();
      autoSave();
      showToast('封臣类型已删除');
    }
  }

  // ====== 官爵对应表辅助函数 ======

  /**
   * 根据官职名称推断封臣类型
   * @param {string} officialTitle - 官职名称
   * @returns {object|null} - 返回匹配的封臣类型信息，包括 vassalType, relationshipType, rank, confidence
   */
  function inferVassalTypeFromOfficial(officialTitle) {
    if (!officialTitle || !scriptData.officialVassalMapping) return null;

    var mappings = scriptData.officialVassalMapping.mappings || [];

    // 查找匹配的映射规则
    for (var i = 0; i < mappings.length; i++) {
      var mapping = mappings[i];
      if (officialTitle.indexOf(mapping.officialPattern) !== -1) {
        return {
          vassalType: mapping.vassalType,
          relationshipType: mapping.relationshipType,
          rank: mapping.rank,
          confidence: mapping.confidence,
          source: 'official-mapping'
        };
      }
    }

    return null;
  }

  /**
   * 根据封臣类型获取关联的官职列表
   * @param {string} vassalTypeName - 封臣类型名称
   * @returns {array} - 返回关联的官职名称数组
   */
  function getRelatedOfficialsForVassalType(vassalTypeName) {
    if (!scriptData.vassalSystem || !scriptData.vassalSystem.vassalTypes) return [];

    var vassalType = scriptData.vassalSystem.vassalTypes.find(function(vt) {
      return vt.name === vassalTypeName;
    });

    if (vassalType && vassalType.relatedOfficials) {
      return Array.isArray(vassalType.relatedOfficials) ? vassalType.relatedOfficials : [];
    }

    return [];
  }

  /**
   * 检查官职与封臣类型是否匹配
   * @param {string} officialTitle - 官职名称
   * @param {string} vassalTypeName - 封臣类型名称
   * @returns {object} - 返回匹配结果 { matched: boolean, confidence: number, reason: string }
   */
  function checkOfficialVassalMatch(officialTitle, vassalTypeName) {
    if (!officialTitle || !vassalTypeName) {
      return { matched: true, confidence: 1.0, reason: '无需检查' };
    }

    // 方法1：通过封臣类型的relatedOfficials字段检查
    var relatedOfficials = getRelatedOfficialsForVassalType(vassalTypeName);
    for (var i = 0; i < relatedOfficials.length; i++) {
      if (officialTitle.indexOf(relatedOfficials[i]) !== -1 || relatedOfficials[i].indexOf(officialTitle) !== -1) {
        return { matched: true, confidence: 0.9, reason: '封臣类型定义的关联官职' };
      }
    }

    // 方法2：通过官爵对应表检查
    var inferred = inferVassalTypeFromOfficial(officialTitle);
    if (inferred) {
      if (inferred.vassalType === vassalTypeName) {
        return { matched: true, confidence: inferred.confidence, reason: '官爵对应表精确匹配' };
      } else {
        return { matched: false, confidence: inferred.confidence, reason: '官职应对应封臣类型：' + inferred.vassalType };
      }
    }

    // 方法3：模糊匹配（官职名包含封臣类型名或反之）
    if (officialTitle.indexOf(vassalTypeName) !== -1 || vassalTypeName.indexOf(officialTitle) !== -1) {
      return { matched: true, confidence: 0.6, reason: '名称模糊匹配' };
    }

    // 无法判断，返回警告
    return { matched: false, confidence: 0.3, reason: '官职与封臣类型可能不匹配' };
  }

  async function aiGenerateVassalTypes() {
    var _apiCfg = {}; try { _apiCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    var apiKey = _apiCfg.key || '';
    var apiUrl = _apiCfg.url || 'https://api.openai.com/v1/chat/completions';
    var apiModel = _apiCfg.model || 'gpt-4o';

    if (!apiKey) {
      alert('请先配置 API 密钥！');
      return;
    }

    var dynasty = scriptData.dynasty || '未知朝代';
    var emperor = scriptData.emperor || '未知皇帝';
    var year = scriptData.gameSettings.startYear || 1;
    var overview = scriptData.overview || '';

    var prompt = '你是一个中国古代历史和封建制度专家。根据以下剧本信息，生成该朝代的封臣/藩属类型列表：\n\n'
      + '朝代：' + dynasty + '\n'
      + '皇帝：' + emperor + '\n'
      + '年份：' + year + '\n'
      + '剧本概述：' + overview + '\n\n'
      + '请返回 JSON 格式：\n'
      + '{\n'
      + '  "vassalTypes": [\n'
      + '    {\n'
      + '      "name": "封臣/藩属类型名称",\n'
      + '      "relationshipType": "藩镇割据/宗室藩王/异姓封国/羁縻州郡/朝贡属国",\n'
      + '      "rank": "一等（亲王、节度使级）/二等（郡王、观察使级）/三等（侯爵、刺史级）/四等（伯爵、县令级）/五等（子男爵、乡绅级）",\n'
      + '      "obligations": "义务描述（年贡、军役、朝觐等）",\n'
      + '      "rights": "权利描述（自主权、辟署权、征税权等）",\n'
      + '      "succession": "世袭罔替/世袭递降/非世袭/选举制",\n'
      + '      "controlLevel": "高度自治/部分自治/中央管控/完全独立",\n'
      + '      "era": "适用时代",\n'
      + '      "tributeRate": 0.3,\n'
      + '      "levyRate": 0.5,\n'
      + '      "rebellionThreshold": 25,\n'
      + '      "autonomyFields": ["税收","军事"],\n'
      + '      "historicalExamples": "历史上的典型例子",\n'
      + '      "relatedTo": "关联系统（官制、行政区划等）",\n'
      + '      "relatedOfficials": "该类封臣通常担任的官职，多个用逗号分隔（如：节度使、观察使、都督）",\n'
      + '      "description": "详细描述"\n'
      + '    }\n'
      + '  ]\n'
      + '}\n\n'
      + '要求：\n'
      + '1. 根据历史实际情况判断：\n'
      + '   - 秦汉：郡县制为主，但有异姓王、同姓王（汉初）\n'
      + '   - 魏晋：门阀世族，宗室藩王，羁縻州郡\n'
      + '   - 唐末五代：藩镇割据，节度使为实际封臣\n'
      + '   - 宋代：中央集权，但有宗室藩王体系\n'
      + '   - 明清：郡县制，但有藩王体系和朝贡体系\n'
      + '2. 生成3-6个典型的封臣/藩属类型\n'
      + '3. relationshipType要准确反映历史关系类型\n'
      + '4. rank要使用中国历史等级制度\n'
      + '5. controlLevel要反映中央对地方的实际控制程度\n'
      + '6. relatedOfficials要填写该类封臣通常担任的官职名称，这对于建立官职与封臣类型的关联非常重要\n'
      + '7. 新增字段 tributeRate(0-1默认贡奉比例)、levyRate(0-1征兵比例)、rebellionThreshold(叛乱忠诚阈值0-100)、autonomyFields(自治领域数组如["税收","军事","人事"])、historicalExamples(历史范例)\n'
      + '8. 这是为了让AI推演时符合历史逻辑，不是游戏机制\n'
      + '9. 只返回 JSON，不要其他文字';

    // 已有势力信息（让AI根据实际势力格局生成）
    if (scriptData.factions && scriptData.factions.length > 0) {
      prompt += '\n\n【已有势���】\n' + scriptData.factions.map(function(f) {
        return '- ' + f.name + (f.type ? '(' + f.type + ')' : '') + (f.leader ? ' 首领:' + f.leader : '') + ' 实力:' + (f.strength || 50);
      }).join('\n') + '\n请考虑这些势力间可能存在的封臣关系。';
    }

    // 读取已有封臣类型
    var existingContext = '';
    if (scriptData.vassalSystem && scriptData.vassalSystem.vassalTypes && scriptData.vassalSystem.vassalTypes.length > 0) {
      var existingVassals = scriptData.vassalSystem.vassalTypes.map(function(v) {
        return '- ' + v.name + '（' + v.rank + '）：' + (v.description || '').substring(0, 80);
      }).join('\n');
      existingContext = '\n\n【已有封臣类型】\n' + existingVassals + '\n\n请补充新的封臣类型，不要重复已有的类型。可以添加更多层级或特殊类型的封臣。\n';
      prompt += existingContext;
    }

    showLoading('正在生成封臣类型...');
    try {
      var _callFn = (typeof callAIEditor === 'function') ? callAIEditor :
                     (typeof callAISmart === 'function') ? callAISmart :
                     (typeof callAI === 'function') ? callAI : null;
      if (!_callFn) throw new Error('AI调用函数不可用');

      var content = await _callFn(prompt, 4000);
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');

      var result = JSON.parse(jsonMatch[0]);

      if (!result.vassalTypes || !Array.isArray(result.vassalTypes)) {
        throw new Error('返回的数据格式不正确');
      }

      // 批量添加到现有列表
      if (!scriptData.vassalSystem) {
        scriptData.vassalSystem = {
          enabled: false,
          vassalTypes: [],
          officialVassalMapping: {}
        };
      }
      if (!scriptData.vassalSystem.vassalTypes) {
        scriptData.vassalSystem.vassalTypes = [];
      }
      if (!scriptData.vassalSystem.officialVassalMapping) {
        scriptData.vassalSystem.officialVassalMapping = {};
      }

      result.vassalTypes.forEach(function(vt) {
        scriptData.vassalSystem.vassalTypes.push(vt);

        // 自动建立官爵对应关系
        if (vt.relatedOfficials) {
          var officials = vt.relatedOfficials.split(/[,，、]/);
          officials.forEach(function(official) {
            var trimmed = official.trim();
            if (trimmed) {
              scriptData.vassalSystem.officialVassalMapping[trimmed] = vt.name;
            }
          });
        }
      });

      autoSave();
      renderVassalSystem();
      showToast('封臣类型生成成功！共生成 ' + result.vassalTypes.length + ' 个类型');

    } catch (error) {
      console.error('AI 生成失败：', error);
      showToast('AI 生成失败：' + error.message);
    } finally {
      hideLoading();
    }
  }

  // 一键AI生成封臣关系
  async function aiGenerateVassalRelations() {
    var _apiCfg = {}; try { _apiCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    var apiKey = _apiCfg.key || '';
    var apiUrl = _apiCfg.url || 'https://api.openai.com/v1/chat/completions';
    var apiModel = _apiCfg.model || 'gpt-4o';
    if (!apiKey) { alert('请先配置 API 密钥！'); return; }

    var factions = scriptData.factions || [];
    if (factions.length < 2) { alert('请先创建至少两个势力'); return; }

    var vtNames = (scriptData.vassalSystem && scriptData.vassalSystem.vassalTypes || []).map(function(v){return v.name;});
    var dynasty = scriptData.dynasty || '未知朝代';
    var overview = scriptData.overview || '';

    var prompt = '你是中国古代封建关系专家。根据以下势力信息，推断它们之间可能的封臣-宗主关系：\n\n'
      + '朝代：' + dynasty + '\n'
      + '剧本概述：' + overview + '\n\n'
      + '【势力列表】\n' + factions.map(function(f) {
        return '- ' + f.name + (f.type ? '(' + f.type + ')' : '') + ' 实力:' + (f.strength || 50) + (f.leader ? ' 首领:' + f.leader : '') + (f.territory ? ' 领地:' + f.territory : '');
      }).join('\n') + '\n';

    if (vtNames.length > 0) {
      prompt += '\n【可用封臣类型】' + vtNames.join('、') + '\n';
    }

    prompt += '\n返回JSON：{"vassalRelations":[{"vassal":"封臣势力名","liege":"宗主势力名","vassalType":"封臣类型名或空","tributeRate":0.3,"loyalty":60,"reason":"关系原因"}]}\n'
      + '规则：\n1. 只创建合理的关系，不要强行配对\n2. 大势力通常是宗主，小势力或附属类型通常是封臣\n3. tributeRate根据关系紧密度设置(0.1-0.6)\n4. loyalty根据关系好坏设置(30-90)\n5. 只返回JSON';

    showLoading('正在推断封臣关系...');
    try {
      var _callFn = (typeof callAIEditor === 'function') ? callAIEditor : (typeof callAI === 'function') ? callAI : null;
      if (!_callFn) throw new Error('AI调用函数不可用');
      var content = await _callFn(prompt, 4000);
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');
      var result = JSON.parse(jsonMatch[0]);

      if (result.vassalRelations && Array.isArray(result.vassalRelations)) {
        if (!scriptData.vassalSystem.vassalRelations) scriptData.vassalSystem.vassalRelations = [];
        result.vassalRelations.forEach(function(r) {
          // 验证势力名称是否存在
          var hasVassal = factions.some(function(f){return f.name === r.vassal;});
          var hasLiege = factions.some(function(f){return f.name === r.liege;});
          if (hasVassal && hasLiege && r.vassal !== r.liege) {
            scriptData.vassalSystem.vassalRelations.push({
              vassal: r.vassal, liege: r.liege,
              vassalType: r.vassalType || '',
              tributeRate: Math.max(0.05, Math.min(0.8, r.tributeRate || 0.3)),
              loyalty: Math.max(0, Math.min(100, r.loyalty || 60))
            });
          }
        });
        renderVassalRelations();
        autoSave();
        showToast('封臣关系推断成功！生成 ' + result.vassalRelations.length + ' 组关系');
      }
    } catch(e) {
      console.error('AI生成失败：', e);
      showToast('AI生成失败：' + e.message);
    } finally { hideLoading(); }
  }

  window.updateVassalSystemConfig = updateVassalSystemConfig;
  window.openAddVassalTypeModal = openAddVassalTypeModal;
  window.editVassalType = editVassalType;
  window.closeVassalTypeModal = closeVassalTypeModal;
  window.saveVassalType = saveVassalType;
  window.deleteVassalType = deleteVassalType;
  window.aiGenerateVassalTypes = aiGenerateVassalTypes;
  window.aiGenerateVassalRelations = aiGenerateVassalRelations;
  window.addVassalRelation = addVassalRelation;
  window.deleteVassalRelation = deleteVassalRelation;
  window.renderVassalRelations = renderVassalRelations;

  // 头衔系统配置函数
  function updateTitleSystemConfig(key, value) {
    if (!scriptData.titleSystem) {
      scriptData.titleSystem = {
        enabled: false,
        description: ''
      };
    }
    scriptData.titleSystem[key] = value;

    // 更新显示
    renderTitleSystem();
  }

  function renderTitleSystem() {
    if (!scriptData.titleSystem) {
      scriptData.titleSystem = {
        enabled: false,
        titleRanks: []
      };
    }

    var ts = scriptData.titleSystem;
    var listDiv = document.getElementById('titleRanks-list');
    if (!listDiv) return;

    listDiv.innerHTML = '';

    if (!ts.titleRanks || ts.titleRanks.length === 0) {
      listDiv.innerHTML = '<div style="color: #666; font-style: italic; padding: 20px; text-align: center;">暂无头衔等级</div>';
      return;
    }

    ts.titleRanks.forEach(function(tr, index) {
      var h = '<div class="card" onclick="editTitleRank(' + index + ')">';
      h += '<div class="card-title">' + escHtml(tr.name) + '</div>';
      h += '<div class="card-meta">';
      if (tr.level !== undefined) h += '<span class="card-tag">等级 ' + escHtml(String(tr.level)) + '</span> ';
      h += '<span class="card-tag tag-historical">' + escHtml(tr.category || '未设置') + '</span>';
      if (tr.era) h += ' <span class="card-tag">' + escHtml(tr.era) + '</span>';
      if (tr.landGrant) h += ' <span class="card-tag" style="background:var(--green,#27ae60);color:#fff;">封地</span>';
      h += '</div>';
      // 数值信息行
      var numParts = [];
      if (tr.salary) numParts.push('俸禄' + tr.salary);
      if (tr.maxHolders) numParts.push('限额' + tr.maxHolders + '人');
      if (tr.degradeRule) numParts.push('递降:' + tr.degradeRule);
      if (numParts.length > 0) {
        h += '<div style="margin-top: 4px; font-size: 11px; color: var(--accent);">' + numParts.join(' | ') + '</div>';
      }
      if (tr.privileges || tr.requirements) {
        h += '<div class="card-desc">';
        if (tr.privileges) h += '特权: ' + escHtml(String(tr.privileges).substring(0, 50)) + ' ';
        if (tr.requirements) h += '条件: ' + escHtml(String(tr.requirements).substring(0, 50));
        h += '</div>';
      }
      if (tr.associatedPosts && tr.associatedPosts.length > 0) {
        h += '<div style="margin-top: 4px; font-size: 11px; color: var(--text-secondary);">关联官职: ' + escHtml(tr.associatedPosts.join('、')) + '</div>';
      }
      if (tr.succession || tr.relatedTo) {
        h += '<div style="margin-top: 8px; font-size: 11px; color: var(--text-dim);">';
        if (tr.succession) h += '继承: ' + escHtml(tr.succession) + ' ';
        if (tr.relatedTo) h += '关联: ' + escHtml(tr.relatedTo);
        h += '</div>';
      }
      h += '<div style="position: absolute; top: 8px; right: 8px;">';
      h += '<button class="btn" style="padding: 2px 8px; font-size: 11px;" onclick="event.stopPropagation(); deleteTitleRank(' + index + ')">删除</button>';
      h += '</div>';
      h += '</div>';
      listDiv.innerHTML += h;
    });
  }

  var currentEditingTitleRankIndex = -1;

  function openAddTitleRankModal() {
    currentEditingTitleRankIndex = -1;
    document.getElementById('titleRankModalTitle').textContent = '添加头衔等级';
    document.getElementById('titleRank-name').value = '';
    document.getElementById('titleRank-level').value = '';
    document.getElementById('titleRank-category').value = '王爵';
    document.getElementById('titleRank-succession').value = '';
    document.getElementById('titleRank-privileges').value = '';
    document.getElementById('titleRank-requirements').value = '';
    document.getElementById('titleRank-era').value = '';
    document.getElementById('titleRank-relatedTo').value = '';
    document.getElementById('titleRank-description').value = '';
    document.getElementById('titleRankModal').classList.add('show');
  }

  function editTitleRank(index) {
    currentEditingTitleRankIndex = index;
    var tr = scriptData.titleSystem.titleRanks[index];
    document.getElementById('titleRankModalTitle').textContent = '编辑头衔等级';
    document.getElementById('titleRank-name').value = tr.name || '';
    document.getElementById('titleRank-level').value = tr.level || '';
    document.getElementById('titleRank-category').value = tr.category || '王爵';
    document.getElementById('titleRank-succession').value = tr.succession || '';
    document.getElementById('titleRank-privileges').value = tr.privileges || '';
    document.getElementById('titleRank-requirements').value = tr.requirements || '';
    var salEl = document.getElementById('titleRank-salary'); if (salEl) salEl.value = tr.salary || '';
    var lgEl = document.getElementById('titleRank-landGrant'); if (lgEl) lgEl.checked = !!tr.landGrant;
    var mhEl = document.getElementById('titleRank-maxHolders'); if (mhEl) mhEl.value = tr.maxHolders || '';
    var drEl = document.getElementById('titleRank-degradeRule'); if (drEl) drEl.value = tr.degradeRule || '';
    var apEl = document.getElementById('titleRank-associatedPosts'); if (apEl) apEl.value = Array.isArray(tr.associatedPosts) ? tr.associatedPosts.join('、') : '';
    document.getElementById('titleRank-era').value = tr.era || '';
    document.getElementById('titleRank-relatedTo').value = tr.relatedTo || '';
    document.getElementById('titleRank-description').value = tr.description || '';
    document.getElementById('titleRankModal').classList.add('show');
  }

  function closeTitleRankModal() {
    document.getElementById('titleRankModal').classList.remove('show');
    currentEditingTitleRankIndex = -1;
  }

  function saveTitleRank() {
    var titleRank = {
      name: document.getElementById('titleRank-name').value,
      level: parseInt(document.getElementById('titleRank-level').value) || 0,
      category: document.getElementById('titleRank-category').value,
      succession: document.getElementById('titleRank-succession').value,
      privileges: document.getElementById('titleRank-privileges').value,
      requirements: document.getElementById('titleRank-requirements').value,
      salary: parseInt((document.getElementById('titleRank-salary') || {}).value) || 0,
      landGrant: !!((document.getElementById('titleRank-landGrant') || {}).checked),
      maxHolders: parseInt((document.getElementById('titleRank-maxHolders') || {}).value) || 0,
      degradeRule: (document.getElementById('titleRank-degradeRule') || {}).value || '',
      associatedPosts: (function() {
        var v = (document.getElementById('titleRank-associatedPosts') || {}).value || '';
        return v ? v.split(/[,，、]/).map(function(s){return s.trim();}).filter(function(s){return s;}) : [];
      })(),
      era: document.getElementById('titleRank-era').value,
      relatedTo: document.getElementById('titleRank-relatedTo').value,
      description: document.getElementById('titleRank-description').value
    };

    if (!titleRank.name.trim()) {
      alert('请输入头衔名称');
      return;
    }

    if (!scriptData.titleSystem.titleRanks) {
      scriptData.titleSystem.titleRanks = [];
    }

    if (currentEditingTitleRankIndex >= 0) {
      scriptData.titleSystem.titleRanks[currentEditingTitleRankIndex] = titleRank;
    } else {
      scriptData.titleSystem.titleRanks.push(titleRank);
    }

    closeTitleRankModal();
    renderTitleSystem();
    autoSave();
    showToast('头衔等级已保存');
  }

  function deleteTitleRank(index) {
    if (confirm('确定要删除这个头衔等级吗？')) {
      scriptData.titleSystem.titleRanks.splice(index, 1);
      renderTitleSystem();
      autoSave();
      showToast('头衔等级已删除');
    }
  }

  async function aiGenerateTitleRanks() {
    var _apiCfg = {}; try { _apiCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    var apiKey = _apiCfg.key || '';
    var apiUrl = _apiCfg.url || 'https://api.openai.com/v1/chat/completions';
    var apiModel = _apiCfg.model || 'gpt-4o';

    if (!apiKey) {
      alert('请先配置 API 密钥！');
      return;
    }

    var dynasty = scriptData.dynasty || '未知朝代';
    var emperor = scriptData.emperor || '未知皇帝';
    var year = scriptData.gameSettings.startYear || 1;
    var overview = scriptData.overview || '';

    var prompt = '你是一个中国古代历史和爵位制度专家。根据以下剧本信息，生成该朝代的头衔等级列表：\n\n'
      + '朝代：' + dynasty + '\n'
      + '皇帝：' + emperor + '\n'
      + '年份：' + year + '\n'
      + '剧本概述：' + overview + '\n\n'
      + '请返回 JSON 格式：\n'
      + '{\n'
      + '  "titleRanks": [\n'
      + '    {\n'
      + '      "name": "头衔名称",\n'
      + '      "level": 1-20（数字越小等级越高）,\n'
      + '      "category": "王爵/公爵/侯爵/伯爵/子爵/男爵/其他",\n'
      + '      "succession": "继承方式",\n'
      + '      "privileges": "特权描述",\n'
      + '      "requirements": "授予条件",\n'
      + '      "era": "适用时代",\n'
      + '      "salary": 1000,\n'
      + '      "landGrant": true,\n'
      + '      "maxHolders": 0,\n'
      + '      "degradeRule": "递降规则或空",\n'
      + '      "associatedPosts": ["关联官职1","关联官职2"],\n'
      + '      "relatedTo": "关联系统",\n'
      + '      "description": "详细描述"\n'
      + '    }\n'
      + '  ]\n'
      + '}\n\n'
      + '要求：\n'
      + '1. 根据历史实际情况：\n'
      + '   - 秦汉：二十等军功爵\n'
      + '   - 魏晋：九品中正制\n'
      + '   - 唐宋：五等爵制（王、公、侯、伯、子、男）\n'
      + '   - 明清：世袭递降制度\n'
      + '2. 生成5-10个典型的头衔等级\n'
      + '3. 每个等级要包含特权、授予条件、继承方式等关键信息\n'
      + '4. level字段要按等级高低排序（1最高，20最低）\n'
      + '5. salary为年俸数值，landGrant表示是否有封地，maxHolders为限额人数(0不限)，degradeRule为世袭递降规则\n'
      + '6. associatedPosts为该等级通常关联的官职数组\n'
      + '7. 这是为了让AI推演时使用正确的称谓和权力等级，不是游戏机制\n'
      + '8. 只返回 JSON，不要其他文字';

    // 已有角色（让AI关联头衔与人物）
    if (scriptData.characters && scriptData.characters.length > 0) {
      var keyChars = scriptData.characters.filter(function(c) { return c.type === '关键' || c.role; }).slice(0, 8);
      if (keyChars.length > 0) {
        prompt += '\n\n【关键角色】\n' + keyChars.map(function(c) { return '- ' + c.name + (c.title ? '(' + c.title + ')' : '') + (c.faction ? ' 属' + c.faction : ''); }).join('\n');
      }
    }

    // 读取已有头衔等级
    var existingContext = '';
    if (scriptData.titleSystem && scriptData.titleSystem.titleRanks && scriptData.titleSystem.titleRanks.length > 0) {
      var existingTitles = scriptData.titleSystem.titleRanks.map(function(t) {
        return '- ' + t.name + '（等级' + t.level + '，' + t.category + '）：' + (t.description || '').substring(0, 80);
      }).join('\n');
      existingContext = '\n\n【已有头衔等级】\n' + existingTitles + '\n\n请补充新的头衔等级，不要重复已有的头衔。可以添加更多层级或特殊类型的爵位。\n';
      prompt += existingContext;
    }

    showLoading('正在生成头衔等级...');
    try {
      var _callFn = (typeof callAIEditor === 'function') ? callAIEditor : (typeof callAI === 'function') ? callAI : null;
      if (!_callFn) throw new Error('AI调用函数不可用');
      var content = await _callFn(prompt, 4000);
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');
      var result = JSON.parse(jsonMatch[0]);

      if (!result.titleRanks || !Array.isArray(result.titleRanks)) {
        throw new Error('返回的数据格式不正确');
      }

      // 批量添加到现有列表
      if (!scriptData.titleSystem) {
        scriptData.titleSystem = {
          enabled: false,
          titleRanks: []
        };
      }
      if (!scriptData.titleSystem.titleRanks) {
        scriptData.titleSystem.titleRanks = [];
      }

      result.titleRanks.forEach(function(tr) {
        scriptData.titleSystem.titleRanks.push(tr);
      });

      autoSave();
      renderTitleSystem();
      showToast('头衔等级生成成功！共生成 ' + result.titleRanks.length + ' 个等级');

    } catch (error) {
      console.error('AI 生成失败：', error);
      showToast('AI 生成失败：' + error.message);
    } finally {
      hideLoading();
    }
  }

  window.updateTitleSystemConfig = updateTitleSystemConfig;
  window.openAddTitleRankModal = openAddTitleRankModal;
  window.editTitleRank = editTitleRank;
  window.closeTitleRankModal = closeTitleRankModal;
  window.saveTitleRank = saveTitleRank;
  window.deleteTitleRank = deleteTitleRank;
  window.aiGenerateTitleRanks = aiGenerateTitleRanks;

  // 行政区划AI生成函数
  // ── 行政区划AI生成：共享工具函数 ──

  function _adminBaseContext() {
    var dynasty = scriptData.dynasty || '未知朝代';
    var emperor = scriptData.emperor || '未知皇帝';
    var year = scriptData.gameSettings ? scriptData.gameSettings.startYear : 1;
    var overview = scriptData.overview || '';
    var ctx = '朝代：' + dynasty + '\n皇帝：' + emperor + '\n年份：' + year + '\n剧本概述：' + overview + '\n';
    if (scriptData.factions && scriptData.factions.length > 0) {
      ctx += '\n【已有势力】\n' + scriptData.factions.map(function(f) {
        return '- ' + f.name + (f.territory ? ' 领地:' + f.territory : '') + ' 实力:' + (f.strength || 50);
      }).join('\n') + '\n';
    }
    if (scriptData.characters && scriptData.characters.length > 0) {
      var cands = scriptData.characters.filter(function(c) { return c.officialTitle && c.officialTitle !== '无'; }).slice(0, 10);
      if (cands.length > 0) {
        ctx += '\n【可任命地方官的角色】\n' + cands.map(function(c) { return c.name + '(' + c.officialTitle + ')'; }).join('、') + '\n';
      }
    }
    return ctx;
  }

  function _collectDivisionNames(divs, prefix) {
    var names = [];
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      names.push(prefix + d.name + '（' + (d.level || '') + (d.population ? ' 人口' + d.population : '') + '）');
      if (d.children && d.children.length > 0) {
        names = names.concat(_collectDivisionNames(d.children, prefix + '  '));
      }
    }
    return names;
  }

  function _adminAssignIds(divs) {
    for (var i = 0; i < divs.length; i++) {
      if (!divs[i].id) divs[i].id = 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      if (!divs[i].children) divs[i].children = [];
      if (divs[i].children.length > 0) _adminAssignIds(divs[i].children);
    }
  }

  function _adminEnsureHierarchy(factionId) {
    if (!scriptData.adminHierarchy) scriptData.adminHierarchy = {};
    if (!scriptData.adminHierarchy[factionId]) {
      scriptData.adminHierarchy[factionId] = { name: '行政区划', description: '', divisions: [] };
    }
    return scriptData.adminHierarchy[factionId];
  }

  function _adminRefresh() {
    if (typeof renderAdminTree === 'function') renderAdminTree();
    if (typeof updateAdminStats === 'function') updateAdminStats();
    autoSave();
  }

  var _adminJsonFormat = '{\n'
    + '  "divisions": [\n'
    + '    {\n'
    + '      "name": "行政单位正式名称",\n'
    + '      "level": "该朝代实际行政层级名称（道/路/省/布政使司/府/州/县等，中文）",\n'
    + '      "officialPosition": "主官职位（节度使/观察使/布政使/知府/知州/县令等）",\n'
    + '      "governor": "主官人名（已有角色则填，否则留空）",\n'
    + '      "description": "特点、地理位置、重要性、历史沿革（简要）",\n'
    + '      "registeredHouseholds": "在编户口——格式严格为[数字]户/[数字]口（如186234户/1023567口）。优先查史料，查不到则推算。各地必须不同",\n'
    + '      "prosperity": "0-100（各地必须不同！富庶如江南80-90，贫瘠边疆20-40）",\n'
    + '      "terrain": "平原/丘陵/山地/水乡/沿海/沙漠/草原",\n'
    + '      "specialResources": "特产（盐/铁/丝绸/茶/瓷器等，无则留空）",\n'
    + '      "taxLevel": "轻/中/重",\n'
    + '      "autonomy": {\n'
    + '        "type": "zhixia/fanguo/fanzhen/jimi/chaogong（中国古代管辖类型：京畿直辖/分封藩国/藩镇/羁縻土司/朝贡外藩——严格按朝代历史习惯：秦汉明清多直辖；周/汉初/明初多藩国；中晚唐多藩镇；明清西南多土司；历代边疆多朝贡）",\n'
    + '        "subtype": "real/nominal（仅fanguo有意义，实封/虚封——明清宗室爵多虚封，只得食邑；汉初/明初塞王有兵权为实封）",\n'
    + '        "holder": "持爵者/土司/属国王名称（非直辖时必填，须是剧本已有角色或独立势力名）",\n'
    + '        "titleName": "对应爵位（亲王/国公/宣慰使/国王等）",\n'
    + '        "loyalty": "对中央忠诚 50-95（非直辖必填）",\n'
    + '        "tributeRate": "贡奉比例 0.05-0.5（非直辖必填，朝贡/羁縻较低，实封藩国较高）"\n'
    + '      },\n'
    + '      "children": []\n'
    + '    }\n'
    + '  ],\n'
    + '  "expectedTotal": 15,\n'
    + '  "complete": true\n'
    + '}\n';

  // ── P0：顶级行政区循环生成至完整 ──

  async function aiGenerateAdminHierarchy() {
    var currentFactionId = window._currentAdminFactionId || 'player';
    var ah = _adminEnsureHierarchy(currentFactionId);

    var baseCtx = _adminBaseContext();
    var maxRounds = 5; // 最多循环5次
    var round = 0;
    var totalGenerated = 0;

    showToast('正在生成最高一级行政区划…');

    while (round < maxRounds) {
      round++;

      // 构建已有顶级列表
      var existingTop = '';
      if (ah.divisions.length > 0) {
        existingTop = '\n【已生成的最高一级行政区划】\n'
          + ah.divisions.map(function(d) {
            return '- ' + d.name + '（' + (d.level || '') + '，人口' + (d.population || '未知') + '，' + (d.terrain || '') + '）';
          }).join('\n')
          + '\n共' + ah.divisions.length + '个。\n\n'
          + '请在此基础上补充尚未生成的最高一级行政区划，不要重复已有的。如果已经全部生成完毕，返回 {"divisions":[],"complete":true}。\n';
      }

      var prompt = '你是中国古代行政制度专家。请严格查阅正史地理志，为以下剧本背景生成该势力的【最高一级行政区划】。\n\n'
        + baseCtx + existingTop + '\n'
        + '【绝对规则——违反任何一条将导致结果无效】\n\n'
        + '1. 【行政区划≠地区≠城市】这三者绝不能混淆！\n'
        + '   · 行政区划是正式的行政管辖单位（有明确的制度名称和层级）\n'
        + '   · 地区/地名（如"湖广""关中""江南"）是地理概念，不是行政单位\n'
        + '   · 城市（如"京师""南京""长安"）是城市，不是最高一级行政区划\n'
        + '   · 例：明代"湖广"是地理俗称，正式行政名为"湖广布政使司"——只能生成后者，不得两者都生成\n'
        + '   · 例：明代"京师"是北京城，它是"北直隶"的下辖城市——京师不是最高一级行政区，北直隶才是\n'
        + '   · 例：明代"南京"是城市，它属于"南直隶"——南京不是最高一级行政区，南直隶才是\n'
        + '   · 再例：唐代"长安"是城市，属于"京畿道"——不得将长安与京畿道并列为同级\n\n'
        + '2. 【只生成最高一级行政区划】\n'
        + '   · 先确定该朝代的最高一级行政层级是什么：唐=道(十五道)，宋=路，元=行省，明=布政使司/都司/直隶，清=省\n'
        + '   · 只生成这一级！children必须为空数组[]（下级由玩家另行按需生成）\n'
        + '   · 名称必须使用该朝代正式的行政名称，不要用俗称/地理概念代替\n\n'
        + '3. 【数量必须完整符合史实】\n'
        + '   · 查阅与剧本年份最接近的正史地理志记载\n'
        + '   · 明代应有两京十三布政使司=15个顶级区划（北直隶/南直隶+十三布政使司）\n'
        + '   · 唐开元有十五道，宋路数量因时期不同为15-26路不等\n'
        + '   · expectedTotal必须填准确数量\n\n'
        + '4. 【不得出现重复或包含关系的同级条目】\n'
        + '   · 不得同时出现"湖广"和"湖广布政使司"（它们是同一个东西）\n'
        + '   · 不得同时出现"京师/北京"和"北直隶"（京师是北直隶的下属城市）\n'
        + '   · 不得同时出现"南京"和"南直隶"（南京是南直隶的下属城市）\n'
        + '   · 如果不确定，以正史《地理志》的正式名称为准\n\n'
        + '5. 【在编户口——必须真实差异化】\n'
        + '   · registeredHouseholds字段格式严格为"XX户/XX口"（如"186234户/1023567口"）\n'
        + '   · "在编户口"=官方户籍登记（不含隐匿人口），是征税徭役的依据\n'
        + '   · 优先查该朝代《地理志》《食货志》真实记载\n'
        + '   · 只有户数→用 户数×该时代平均每户口数 推算口数（汉约5口/户，唐约5-6，宋约2-3因隐匿严重，明约5-6）\n'
        + '   · 只有口数→反向推算户数\n'
        + '   · 都没有→据地位/经济/地理推算\n'
        + '   · 明代：南直隶"2001634户/11126450口"，云南"153498户/814573口"——差10倍以上！\n'
        + '   · 唐代：河南道"1507435户/8234102口"，岭南道"203764户/1087432口"\n'
        + '   · 绝不允许所有地区填相同数值\n'
        + '   · prosperity范围0-100：京畿/江南最富(70-90)，边疆最穷(20-40)，绝不允许相同\n\n'
        + '5b. 【主官必须同步生成】\n'
        + '   · officialPosition必须填该级别的实际主官职位\n'
        + '   · governor优先查史料找该时期该地区的真实任职者姓名，查不到则留空（不要编造）\n'
        + '   · 有governor时，该角色将自动加入剧本角色列表\n\n'
        + '6. terrain符合实际地理，specialResources反映史实特产\n'
        + '7. level统一使用该朝代正式行政层级名称（如"布政使司""道""路""省"等）\n'
        + '8. officialPosition填该级别的实际主官职位（如布政使、观察使、巡抚等）\n'
        + '9. 【管辖类型（autonomy字段）——严格按朝代历史分配】\n'
        + '   · 大一统集权期(秦汉郡县制/唐前期/宋/明成化后/清)——绝大多数直辖(zhixia)\n'
        + '   · 早期分封(周)/汉初诸侯王/明初塞王——部分为fanguo实封(有兵权)\n'
        + '   · 明代宗室封地(明中后)/清代宗室——fanguo虚封(食禄不治事，nominal)\n'
        + '   · 中晚唐——河朔、宣武等藩镇为fanzhen自治\n'
        + '   · 明清西南(云贵川)——多jimi羁縻土司(宣慰司/宣抚司)\n'
        + '   · 历代边疆部族/周边国(朝鲜/越南/琉球/蒙古诸部)——chaogong朝贡\n'
        + '   · 直辖区划 autonomy.type 填"zhixia"，holder/loyalty/tributeRate 留空\n'
        + '   · 非直辖必须填holder(持爵者)、loyalty(50-95)、tributeRate\n'
        + '10. 只返回JSON，不要其他文字。complete=true表示全部生成完毕\n\n'
        + '返回格式：\n' + _adminJsonFormat;

      try {
        var content = await callAIEditor(prompt, 4000);
        var jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('无法提取JSON');
        var result = JSON.parse(jsonMatch[0]);

        if (!result.divisions || !Array.isArray(result.divisions)) throw new Error('格式不正确');

        // 去重：跳过名称已存在的
        var existingNames = ah.divisions.map(function(d) { return d.name; });
        var newDivs = result.divisions.filter(function(d) { return existingNames.indexOf(d.name) === -1; });

        // 清理+解析
        newDivs.forEach(function(d) {
          d.children = [];
          // 解析registeredHouseholds "XX户/XX口" → households + population
          if (d.registeredHouseholds && typeof d.registeredHouseholds === 'string') {
            var _rhMatch = d.registeredHouseholds.match(/(\d+)\s*户.*?(\d+)\s*口/);
            if (_rhMatch) {
              d.households = parseInt(_rhMatch[1]) || 0;
              d.population = parseInt(_rhMatch[2]) || 0;
            }
          }
          if (!d.population && d.households) d.population = d.households * 5;
          if (!d.households && d.population) d.households = Math.round(d.population / 5);
          // 规范化 autonomy 字段——默认直辖，非直辖补全默认值
          if (!d.autonomy || typeof d.autonomy !== 'object') {
            d.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
          } else {
            var validTypes = ['zhixia','fanguo','fanzhen','jimi','chaogong'];
            if (validTypes.indexOf(d.autonomy.type) < 0) d.autonomy.type = 'zhixia';
            if (d.autonomy.type === 'zhixia') {
              d.autonomy.subtype = null; d.autonomy.holder = null;
              d.autonomy.loyalty = 100; d.autonomy.tributeRate = 0;
            } else {
              d.autonomy.loyalty = parseInt(d.autonomy.loyalty) || 70;
              d.autonomy.tributeRate = parseFloat(d.autonomy.tributeRate) || (d.autonomy.type === 'chaogong' ? 0.05 : d.autonomy.type === 'jimi' ? 0.1 : 0.3);
            }
          }
          // 主官→自动创建角色
          if (d.governor && d.governor.trim()) {
            var _govName = d.governor.trim();
            if (!scriptData.characters) scriptData.characters = [];
            var _exists = scriptData.characters.some(function(c) { return c.name === _govName; });
            if (!_exists) {
              scriptData.characters.push({
                name: _govName,
                title: d.officialPosition || '',
                officialTitle: d.officialPosition || '',
                role: d.name + (d.officialPosition || '长官'),
                location: d.name,
                loyalty: 55 + Math.floor(Math.random() * 20),
                intelligence: 45 + Math.floor(Math.random() * 30),
                administration: 50 + Math.floor(Math.random() * 25),
                military: 30 + Math.floor(Math.random() * 30),
                ambition: 40 + Math.floor(Math.random() * 25),
                alive: true
              });
            }
          }
        });

        _adminAssignIds(newDivs);
        ah.divisions = ah.divisions.concat(newDivs);
        totalGenerated += newDivs.length;

        _adminRefresh();
        showToast('第' + round + '轮：新增' + newDivs.length + '个，共' + ah.divisions.length + '个顶级行政区');

        // 检查是否完成
        if (result.complete === true || newDivs.length === 0) {
          break;
        }

      } catch (error) {
        console.error('[行政区划生成] 第' + round + '轮失败:', error);
        showToast('第' + round + '轮生成出错: ' + error.message + '，重试中…');
        // 继续下一轮重试
      }
    }

    showToast('顶级行政区划生成完毕：共' + ah.divisions.length + '个（' + round + '轮调用）');
  }

  window.aiGenerateAdminHierarchy = aiGenerateAdminHierarchy;

  // ── P0扩展：为指定行政区生成下级（按需，读取已有后扩充） ──

  async function aiExpandAdminChildren(divisionId) {
    var currentFactionId = window._currentAdminFactionId || 'player';
    var ah = _adminEnsureHierarchy(currentFactionId);

    // 递归查找目标节点
    function findDiv(divs) {
      for (var i = 0; i < divs.length; i++) {
        if (divs[i].id === divisionId) return divs[i];
        if (divs[i].children && divs[i].children.length > 0) {
          var found = findDiv(divs[i].children);
          if (found) return found;
        }
      }
      return null;
    }
    var target = findDiv(ah.divisions);
    if (!target) { showToast('未找到该行政区划'); return; }

    var baseCtx = _adminBaseContext();

    // 构建已有子节点上下文
    var existingChildren = '';
    if (target.children && target.children.length > 0) {
      existingChildren = '\n【该行政区下已有的子级行政区划】\n'
        + target.children.map(function(c) {
          return '- ' + c.name + '（' + (c.level || '') + '，人口' + (c.population || '未知') + '）';
        }).join('\n')
        + '\n共' + target.children.length + '个。\n\n'
        + '请在此基础上补充新的下级行政区划，不要重复已有的。优先生成该行政区的首府/治所。\n';
    }

    var prompt = '你是中国古代行政制度专家。请严格查阅正史地理志，为以下行政区生成其【直接下一级】行政区划。\n\n'
      + baseCtx
      + '\n【目标行政区】\n'
      + '名称：' + target.name + '\n'
      + '层级：' + (target.level || '未知') + '\n'
      + '总人口：' + (target.population || '未知') + '\n'
      + '描述：' + (target.description || '') + '\n'
      + existingChildren + '\n'
      + '【绝对规则】\n'
      + '1. 只生成【' + target.name + '】的直接下一级行政区划，不要跳级！children必须为空数组[]\n'
      + '2. 确定该朝代' + target.name + '的下一级行政层级是什么：\n'
      + '   · 如果上级是"道/路"→下级通常是"州/府/军/监"\n'
      + '   · 如果上级是"布政使司/直隶"→下级通常是"府/直隶州"\n'
      + '   · 如果上级是"府"→下级通常是"县"\n'
      + '   · 如果上级是"省"→下级通常是"府/直隶州"\n'
      + '   所有子级的level必须统一为同一行政层级\n'
      + '3. 【行政单位≠城市】注意区分：\n'
      + '   · "京师""南京""长安"是城市名，不是行政单位名\n'
      + '   · 行政单位名如"顺天府""应天府""京兆府"才是\n'
      + '   · 如果目标是"北直隶"，其下级应该是"顺天府""保定府"等，不是"京师"\n'
      + '4. 优先生成首府/治所（如该道/省的首府），然后其他重要的府州\n'
      + '5. 一次尽可能多生成（优先生成重要的），但不必补全——玩家可再次调用\n'
      + '6. 下级的households/population之和 ≤ 上级（不必相等，因为不是全部列出）\n'
      + '7. 【在编户口差异化】\n'
      + '   · registeredHouseholds格式"XX户/XX口"——优先查史料，查不到推算\n'
      + '   · 首府最大，边县最小，差异数倍。绝不允许子级数据相同\n'
      + '   · governor优先查史料真实任职者，查不到留空\n'
      + '8. 只返回JSON\n\n'
      + '返回格式：\n' + _adminJsonFormat;

    showToast('正在为「' + target.name + '」生成下级行政区划…');

    try {
      var content = await callAIEditor(prompt, 4000);
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法提取JSON');
      var result = JSON.parse(jsonMatch[0]);

      if (!result.divisions || !Array.isArray(result.divisions)) throw new Error('格式不正确');

      // 去重
      var existingNames = (target.children || []).map(function(c) { return c.name; });
      var newDivs = result.divisions.filter(function(d) { return existingNames.indexOf(d.name) === -1; });

      newDivs.forEach(function(d) {
        d.children = [];
        // 解析registeredHouseholds
        if (d.registeredHouseholds && typeof d.registeredHouseholds === 'string') {
          var _rhM = d.registeredHouseholds.match(/(\d+)\s*户.*?(\d+)\s*口/);
          if (_rhM) { d.households = parseInt(_rhM[1])||0; d.population = parseInt(_rhM[2])||0; }
        }
        if (!d.population && d.households) d.population = d.households * 5;
        if (!d.households && d.population) d.households = Math.round(d.population / 5);
        // 规范化 autonomy——默认继承父级管辖类型
        if (!d.autonomy || typeof d.autonomy !== 'object') {
          var _parentAut = target.autonomy || { type: 'zhixia' };
          d.autonomy = {
            type: _parentAut.type || 'zhixia',
            subtype: _parentAut.subtype || null,
            holder: _parentAut.holder || null,
            suzerain: _parentAut.suzerain || null,
            loyalty: _parentAut.loyalty || 100,
            tributeRate: _parentAut.tributeRate || 0
          };
        } else {
          var _vT = ['zhixia','fanguo','fanzhen','jimi','chaogong'];
          if (_vT.indexOf(d.autonomy.type) < 0) d.autonomy.type = (target.autonomy && target.autonomy.type) || 'zhixia';
          if (d.autonomy.type !== 'zhixia') {
            d.autonomy.loyalty = parseInt(d.autonomy.loyalty) || 70;
            d.autonomy.tributeRate = parseFloat(d.autonomy.tributeRate) || 0.2;
          }
        }
        // 主官→角色
        if (d.governor && d.governor.trim()) {
          var _gn = d.governor.trim();
          if (!scriptData.characters) scriptData.characters = [];
          if (!scriptData.characters.some(function(c){return c.name===_gn;})) {
            scriptData.characters.push({
              name: _gn, title: d.officialPosition||'', officialTitle: d.officialPosition||'',
              role: d.name+(d.officialPosition||''), location: d.name,
              loyalty: 55+Math.floor(Math.random()*20), intelligence: 45+Math.floor(Math.random()*30),
              administration: 50+Math.floor(Math.random()*25), military: 30+Math.floor(Math.random()*30),
              ambition: 40+Math.floor(Math.random()*25), alive: true
            });
          }
        }
      });
      _adminAssignIds(newDivs);

      if (!target.children) target.children = [];
      target.children = target.children.concat(newDivs);

      _adminRefresh();
      showToast('为「' + target.name + '」新增' + newDivs.length + '个下级行政区，共' + target.children.length + '个');

    } catch (error) {
      console.error('[下级行政区生成] 失败:', error);
      showToast('生成失败: ' + error.message);
    }
  }

  window.aiExpandAdminChildren = aiExpandAdminChildren;


  // 建筑系统配置函数
  function updateBuildingSystemConfig(key, value) {
    if (!scriptData.buildingSystem) {
      scriptData.buildingSystem = {
        enabled: false,
        buildingTypes: []
      };
    }
    scriptData.buildingSystem[key] = value;

    // 更新显示
    renderBuildingSystem();
  }

  function renderBuildingSystem() {
    if (!scriptData.buildingSystem) {
      scriptData.buildingSystem = {
        enabled: false,
        buildingTypes: []
      };
    }

    var bs = scriptData.buildingSystem;
    var listDiv = document.getElementById('buildingTypes-list');
    if (!listDiv) return;

    listDiv.innerHTML = '';

    if (!bs.buildingTypes || bs.buildingTypes.length === 0) {
      listDiv.innerHTML = '<div style="color: #666; font-style: italic; padding: 20px; text-align: center;">暂无建筑类型</div>';
      return;
    }

    bs.buildingTypes.forEach(function(bt, idx) {
      var categoryColors = {
        'military': '#f87171',
        'economic': '#4ade80',
        'cultural': '#60a5fa',
        'administrative': '#a78bfa',
        'religious': '#fbbf24',
        'infrastructure': '#9ca3af'
      };
      var categoryNames = {
        'military': '军事',
        'economic': '经济',
        'cultural': '文化',
        'administrative': '行政',
        'religious': '宗教',
        'infrastructure': '基础设施'
      };
      var color = categoryColors[bt.category] || '#9a9590';
      var categoryName = categoryNames[bt.category] || bt.category;

      var h = '<div class="card" onclick="editBuildingType(' + idx + ')">';
      h += '<div class="card-title">' + escHtml(bt.name) + '</div>';
      h += '<div class="card-meta">';
      h += '<span class="card-tag" style="background: ' + color + ';">' + escHtml(categoryName) + '</span>';
      h += '</div>';
      h += '<div class="card-desc">' + escHtml((bt.description || '暂无描述').substring(0, 60)) + '</div>';
      // 数值信息
      var numParts = [];
      if (bt.maxLevel) numParts.push('Lv' + bt.maxLevel);
      if (bt.baseCost) numParts.push('造价' + bt.baseCost);
      if (bt.buildTime) numParts.push(bt.buildTime + '回合');
      if (numParts.length > 0) {
        h += '<div style="margin-top:4px;font-size:11px;color:var(--accent);">' + numParts.join(' | ') + '</div>';
      }
      // 效果由 AI 根据描述判定，不再显示结构化摘要
      h += '<div style="position: absolute; top: 8px; right: 8px;">';
      h += '<button class="btn" style="padding: 2px 8px; font-size: 11px;" onclick="event.stopPropagation(); deleteBuildingType(' + idx + ')">删除</button>';
      h += '</div>';
      h += '</div>';
      listDiv.innerHTML += h;
    });
  }

  var editingBuildingTypeIndex = -1;

  function openAddBuildingTypeModal() {
    editingBuildingTypeIndex = -1;
    document.getElementById('buildingTypeModalTitle').textContent = '添加建筑类型';
    document.getElementById('buildingTypeName').value = '';
    document.getElementById('buildingTypeCategory').value = 'military';
    document.getElementById('buildingTypeDescription').value = '';
    document.getElementById('buildingTypeEffects').value = '';
    document.getElementById('buildingTypeRequirements').value = '';
    var ml = document.getElementById('buildingTypeMaxLevel'); if (ml) ml.value = 5;
    var bc = document.getElementById('buildingTypeBaseCost'); if (bc) bc.value = 1000;
    var bt = document.getElementById('buildingTypeBuildTime'); if (bt) bt.value = 3;
    ['monthlyIncome','monthlyTax','levy','garrison','fortLevel','culturalInfluence','adminEfficiency','prosperity'].forEach(function(k) {
      var el = document.getElementById('bte-' + k); if (el) el.value = 0;
    });
    document.getElementById('buildingTypeModal').classList.add('show');
  }

  function editBuildingType(index) {
    if (!scriptData.buildingSystem || !scriptData.buildingSystem.buildingTypes[index]) return;

    editingBuildingTypeIndex = index;
    var bt = scriptData.buildingSystem.buildingTypes[index];

    document.getElementById('buildingTypeModalTitle').textContent = '编辑建筑类型';
    document.getElementById('buildingTypeName').value = bt.name || '';
    document.getElementById('buildingTypeCategory').value = bt.category || 'military';
    document.getElementById('buildingTypeDescription').value = bt.description || '';
    var ml = document.getElementById('buildingTypeMaxLevel'); if (ml) ml.value = bt.maxLevel || 5;
    var bc = document.getElementById('buildingTypeBaseCost'); if (bc) bc.value = bt.baseCost || 1000;
    var btm = document.getElementById('buildingTypeBuildTime'); if (btm) btm.value = bt.buildTime || 3;
    document.getElementById('buildingTypeModal').classList.add('show');
  }

  function closeBuildingTypeModal() {
    document.getElementById('buildingTypeModal').classList.remove('show');
    editingBuildingTypeIndex = -1;
  }

  function saveBuildingType() {
    var name = document.getElementById('buildingTypeName').value.trim();
    var category = document.getElementById('buildingTypeCategory').value;
    var description = document.getElementById('buildingTypeDescription').value.trim();

    if (!name) {
      alert('请输入建筑名称');
      return;
    }

    if (!scriptData.buildingSystem) {
      scriptData.buildingSystem = { enabled: false, buildingTypes: [] };
    }
    if (!scriptData.buildingSystem.buildingTypes) {
      scriptData.buildingSystem.buildingTypes = [];
    }

    var buildingType = {
      name: name,
      category: category,
      description: description,
      maxLevel: parseInt((document.getElementById('buildingTypeMaxLevel') || {}).value) || 5,
      baseCost: parseInt((document.getElementById('buildingTypeBaseCost') || {}).value) || 1000,
      buildTime: parseInt((document.getElementById('buildingTypeBuildTime') || {}).value) || 3
      // 效果由AI根据描述自行判断——不存结构化字段
    };

    if (editingBuildingTypeIndex >= 0) {
      // 编辑现有建筑类型
      scriptData.buildingSystem.buildingTypes[editingBuildingTypeIndex] = buildingType;
    } else {
      // 添加新建筑类型
      scriptData.buildingSystem.buildingTypes.push(buildingType);
    }

    closeBuildingTypeModal();
    renderBuildingSystem();
    autoSave();
    showToast('建筑类型已保存');
  }

  function deleteBuildingType(index) {
    if (!scriptData.buildingSystem || !scriptData.buildingSystem.buildingTypes[index]) return;

    var bt = scriptData.buildingSystem.buildingTypes[index];
    if (!confirm('确定要删除建筑类型"' + bt.name + '"吗？')) return;

    scriptData.buildingSystem.buildingTypes.splice(index, 1);
    renderBuildingSystem();
    autoSave();
    showToast('建筑类型已删除');
  }


  async function aiGenerateBuildingTypes() {
    var _apiCfg = {}; try { _apiCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    var apiKey = _apiCfg.key || '';
    var apiUrl = _apiCfg.url || 'https://api.openai.com/v1/chat/completions';
    var apiModel = _apiCfg.model || 'gpt-4o';

    if (!apiKey) {
      alert('请先配置 API 密钥！');
      return;
    }

    var dynasty = scriptData.dynasty || '未知朝代';
    var emperor = scriptData.emperor || '未知皇帝';
    var year = scriptData.gameSettings.startYear || 1;
    var overview = scriptData.overview || '';

    var _es = scriptData.eraState || {};
    var eraCtx = '';
    if (_es.dynastyPhase) eraCtx += '阶段：' + _es.dynastyPhase + '\n';
    if (_es.economicProsperity) eraCtx += '经济繁荣度：' + Math.round((_es.economicProsperity||0.5)*100) + '%\n';
    if (_es.landSystemType) eraCtx += '土地制度：' + _es.landSystemType + '\n';

    var prompt = '你是一个中国古代历史和建筑文化专家。根据以下剧本信息，生成该朝代的典型建筑类型列表：\n\n'
      + '朝代：' + dynasty + '\n'
      + '皇帝：' + emperor + '\n'
      + '年份：' + year + '\n'
      + eraCtx
      + '剧本概述：' + overview + '\n\n'
      + '请返回 JSON 格式，包含 buildingTypes 数组，每个建筑包含以下字段：\n'
      + '{\n'
      + '  "buildingTypes": [\n'
      + '    {\n'
      + '      "name": "农田",\n'
      + '      "category": "economic",\n'
      + '      "description": "详细的历史文化描述——写明该建筑对地方繁荣/民生/财政/军事/文化等方面的实际影响与典故(150-300字)。不要写结构化数值，要详述——AI推演时将据此综合判定效果",\n'
      + '      "maxLevel": 5,\n'
      + '      "baseCost": 800,\n'
      + '      "buildTime": 2\n'
      + '    }\n'
      + '  ]\n'
      + '}\n\n'
      + '要求：\n'
      + '1. 生成10-15个建筑类型，涵盖六大类别（military军事/economic经济/cultural文化/administrative行政/religious宗教/infrastructure基础设施）\n'
      + '2. 建筑名称简体中文，符合朝代历史（军事:城墙/兵营/烽火台；经济:农田/集市/工坊/茶园/盐场；文化:书院/庙宇；行政:官署/驿站/仓库；宗教:寺庙/道观/祠堂；基建:水利/桥梁/码头）\n'
      + '3. description必须详尽——写建筑的历史文化、作用、影响范围（经济/军事/民心/文化等）、典故。这是AI推演时判定效果的唯一依据，不要写结构化数值\n'
      + '4. 仅保留 name/category/description/maxLevel(1-10)/baseCost/buildTime 六个字段\n'
      + '5. 不要返回effects、requirements、allowedTerrains、structuredEffects等旧字段\n'
      + '6. 必须根据该朝代特色生成符合时代的建筑\n'
      + '7. 只返回 JSON，不要其他文字';

    // 加入行政区划上下文
    if (scriptData.adminHierarchy) {
      var _adminNames = [];
      var _ak = Object.keys(scriptData.adminHierarchy);
      _ak.forEach(function(k) {
        var ah = scriptData.adminHierarchy[k];
        if (ah && ah.divisions) {
          ah.divisions.forEach(function(d) {
            _adminNames.push(d.name + (d.terrain ? '(' + d.terrain + ')' : ''));
          });
        }
      });
      if (_adminNames.length > 0) {
        prompt += '\n\n【已有行政区划】' + _adminNames.slice(0, 10).join('、') + '\n请考虑这些区域适合什么建筑。';
      }
    }

    // 读取已有建筑类型
    var existingContext = '';
    if (scriptData.buildingSystem && scriptData.buildingSystem.buildingTypes && scriptData.buildingSystem.buildingTypes.length > 0) {
      var existingBuildings = scriptData.buildingSystem.buildingTypes.map(function(b) {
        return '- ' + b.name + '（' + b.category + '）：' + (b.description || '').substring(0, 80);
      }).join('\n');
      existingContext = '\n\n【已有建筑类型】\n' + existingBuildings + '\n\n请补充新的建筑类型，不要重复已有的建筑。可以添加更多类别或特殊建筑。\n';
      prompt += existingContext;
    }

    showLoading('正在生成建筑类型...');
    try {
      // 使用统一的编辑器AI调用（自动兼容OpenAI/Anthropic等多种API）
      var _callFn = (typeof callAIEditor === 'function') ? callAIEditor :
                     (typeof callAISmart === 'function') ? callAISmart :
                     (typeof callAI === 'function') ? callAI : null;
      if (!_callFn) throw new Error('AI调用函数不可用');

      var content = await _callFn(prompt, 4000);
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');

      var result = JSON.parse(jsonMatch[0]);

      if (!result.buildingTypes || !Array.isArray(result.buildingTypes)) {
        throw new Error('返回的数据格式不正确');
      }

      // 批量添加到现有列表，而不是覆盖
      if (!scriptData.buildingSystem) {
        scriptData.buildingSystem = {
          enabled: false,
          buildingTypes: []
        };
      }
      if (!scriptData.buildingSystem.buildingTypes) {
        scriptData.buildingSystem.buildingTypes = [];
      }

      // 将AI生成的建筑类型添加到现有列表——清理旧结构化字段
      result.buildingTypes.forEach(function(b) {
        if (!b) return;
        // 仅保留新字段集
        delete b.effects; delete b.requirements; delete b.allowedTerrains;
        delete b.structuredEffects;
        scriptData.buildingSystem.buildingTypes.push({
          name: b.name || '',
          category: b.category || 'economic',
          description: b.description || '',
          maxLevel: parseInt(b.maxLevel) || 5,
          baseCost: parseInt(b.baseCost) || 1000,
          buildTime: parseInt(b.buildTime) || 3
        });
      });

      autoSave();
      renderBuildingSystem();
      showToast('建筑类型生成成功！已添加 ' + result.buildingTypes.length + ' 个建筑类型');

    } catch (error) {
      console.error('AI 生成失败：', error);
      showToast('AI 生成失败：' + error.message);
    } finally {
      hideLoading();
    }
  }

  window.updateBuildingSystemConfig = updateBuildingSystemConfig;
  window.openAddBuildingTypeModal = openAddBuildingTypeModal;
  window.editBuildingType = editBuildingType;
  window.deleteBuildingType = deleteBuildingType;
  window.closeBuildingTypeModal = closeBuildingTypeModal;
  window.saveBuildingType = saveBuildingType;
  window.aiGenerateBuildingTypes = aiGenerateBuildingTypes;


  async function aiGenerateEraState() {
    var _apiCfg = {}; try { _apiCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    var apiKey = _apiCfg.key || '';
    var apiUrl = _apiCfg.url || 'https://api.openai.com/v1/chat/completions';
    var apiModel = _apiCfg.model || 'gpt-4o';

    if (!apiKey) {
      alert('\u8BF7\u5148\u914D\u7F6E API \u5BC6\u94A5\uFF01');
      return;
    }

    var dynasty = scriptData.dynasty || '\u672A\u77E5\u671D\u4EE3';
    var emperor = scriptData.emperor || '\u672A\u77E5\u7687\u5E1D';
    var year = scriptData.gameSettings.startYear || 1;
    var overview = scriptData.overview || '';

    var prompt = '\u4F60\u662F\u4E00\u4E2A\u4E2D\u56FD\u53F2\u4E13\u5BB6\u3002\u6839\u636E\u4EE5\u4E0B\u4FE1\u606F\uFF0C\u63A8\u65AD\u5F53\u524D\u5386\u53F2\u65F6\u671F\u7684\u65F6\u4EE3\u72B6\u6001\uFF1A\n\n'
      + '\u671D\u4EE3\uFF1A' + dynasty + '\n'
      + '\u7687\u5E1D\uFF1A' + emperor + '\n'
      + '\u5E74\u4EFD\uFF1A' + year + '\n'
      + '\u5267\u672C\u6982\u8FF0\uFF1A' + overview + '\n\n'
      + '\u8BF7\u8FD4\u56DE JSON \u683C\u5F0F\uFF0C\u5305\u542B\u4EE5\u4E0B\u5B57\u6BB5\uFF1A\n'
      + '{\n'
      + '  "politicalUnity": 0.7,  // 0-1\uFF0C\u653F\u6CBB\u7EDF\u4E00\u5EA6\n'
      + '  "centralControl": 0.6,  // 0-1\uFF0C\u4E2D\u592E\u96C6\u6743\u5EA6\n'
      + '  "legitimacySource": "hereditary",  // hereditary/military/merit/divine/declining\n'
      + '  "socialStability": 0.6,  // 0-1\uFF0C\u793E\u4F1A\u7A33\u5B9A\u5EA6\n'
      + '  "economicProsperity": 0.6,  // 0-1\uFF0C\u7ECF\u6D4E\u7E41\u8363\u5EA6\n'
      + '  "culturalVibrancy": 0.7,  // 0-1\uFF0C\u6587\u5316\u6D3B\u529B\n'
      + '  "bureaucracyStrength": 0.6,  // 0-1\uFF0C\u5B98\u50DA\u4F53\u7CFB\u5F3A\u5EA6\n'
      + '  "militaryProfessionalism": 0.5,  // 0-1\uFF0C\u519B\u961F\u804C\u4E1A\u5316\u7A0B\u5EA6\n'
      + '  "landSystemType": "mixed",  // state/private/mixed\n'
      + '  "dynastyPhase": "peak",  // founding/expansion/peak/decline/collapse\n'
      + '  "contextDescription": "\u8BE6\u7EC6\u63CF\u8FF0\u5F53\u524D\u5386\u53F2\u65F6\u671F\u7684\u7279\u5F81\uFF0C200-400\u5B57"\n'
      + '}\n\n'
      + '\u6CE8\u610F\uFF1A\n'
      + '1. \u6839\u636E\u5386\u53F2\u4E8B\u5B9E\u63A8\u65AD\uFF0C\u4F8B\u5982\u5510\u4EE3\u5B97\u5927\u5386\u5E74\u95F4\uFF08\u5B89\u53F2\u4E4B\u4E71\u540E\uFF09\u5E94\u8BE5\u662F\u4F4E\u96C6\u6743\u3001\u85E9\u9547\u5272\u636E\n'
      + '2. \u5206\u8FA8\u738B\u671D\u9636\u6BB5\uFF1A\u5F00\u56FD/\u6269\u5F20/\u9F0E\u76DB/\u8870\u843D/\u5D29\u6E83\n'
      + '3. \u8003\u8651\u5206\u88C2\u65F6\u671F\uFF08\u5357\u5317\u671D\u3001\u4E94\u4EE3\u5341\u56FD\uFF09\u7684\u7279\u6B8A\u6027\n'
      + '4. contextDescription \u8981\u8BE6\u7EC6\u5177\u4F53\uFF0C\u5E2E\u52A9 AI \u7406\u89E3\u65F6\u4EE3\u7279\u5F81';

    // 读取已有时代状态
    var existingContext = '';
    if (scriptData.eraState && scriptData.eraState.contextDescription) {
      existingContext = '\n\n【已有时代状态】\n' + JSON.stringify(scriptData.eraState, null, 2) + '\n\n请在现有状态基础上补充完善，调整数值使其更符合历史实际，增加更多细节描述。\n';
      prompt += existingContext;
    }

    try {
      showLoading('正在生成时代状态...');

      var _callFn = (typeof callAIEditor === 'function') ? callAIEditor : (typeof callAI === 'function') ? callAI : null;
      if (!_callFn) throw new Error('AI调用函数不可用');
      var content = await _callFn(prompt, 2000);
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');

      var eraState = JSON.parse(jsonMatch[0]);

      // 更新 scriptData
      scriptData.eraState = eraState;

      // 刷新界面
      renderEraState();

      hideLoading();
      alert('\u65F6\u4EE3\u72B6\u6001\u751F\u6210\u6210\u529F\uFF01');
      autoSave();

    } catch (error) {
      hideLoading();
      console.error('AI \u751F\u6210\u5931\u8D25:', error);
      alert('AI \u751F\u6210\u5931\u8D25: ' + error.message);
    }
  }



  function importRefFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,.md';
    input.onchange = function(e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function() {
        document.getElementById('aiGenRef').value
          = r.result;
      };
      r.readAsText(f);
    };
    input.click();
  }


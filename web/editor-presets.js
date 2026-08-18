// @ts-check
/// <reference path="types.d.ts" />
/**
 * editor-presets.js
 * ============================================================
 * 剧本自定义预设编辑器
 *   · corveeProjects: 覆盖/追加 25 大徭役
 *   · migrationEvents: 覆盖/追加 9 迁徙
 *   · militarySystems: 覆盖/追加 7 兵制
 *   · taxItems: 覆盖/追加 19 税种
 *   · institutionTemplates: 覆盖/追加制度模板
 *
 * 作用：让不同朝代/架空剧本都能扩展游戏内容，而不是被硬编码预设束缚。
 *
 * UI：在编辑器侧栏新增"剧本预设"卡，折叠展开，每类一行 AI 生成按钮。
 * ============================================================
 */
(function(global) {
  'use strict';

  var INSTALLED = false;

  var PRESET_TYPES = [
    { key: 'corveeProjects',       label: '大徭役工程',  sampleFields: 'id,name,dynasty,year,labor,deathRate,duration,legitimacyDelta,minxinDelta,outcomes,notes' },
    { key: 'migrationEvents',      label: '迁徙事件',    sampleFields: 'id,name,year,scale,from[],to[],trigger,legitimacyDelta,culturalShift' },
    { key: 'militarySystems',      label: '兵制',        sampleFields: '键名:{name,dynasty,era,peakYear,corps{},totalStrength,collapse,successor}' },
    { key: 'taxItems',             label: '税种',        sampleFields: 'id,name,category(field/head/commerce/salt/tea/misc),rate,unit,dynasty,abolishedAt' },
    { key: 'institutionTemplates', label: '制度模板',    sampleFields: '键名:{name,category,lifecycleStages[],effects{},prerequisites[],notes}' },
    { key: 'classicalEdicts',      label: '历代典范诏',  sampleFields: 'id,dynasty,emperor,type,text,effect,note' },
    { key: 'abductionCases',       label: '禅让/逼宫案例', sampleFields: 'id,dynasty,year,type,actor,outcome,description' },
    { key: 'edictTemplates',       label: '诏令模板',    sampleFields: '键名:{name,templateText,hintFields[]}' }
  ];

  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : (s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')); }

  function _getCurrentPresets(key) {
    var sd = global.scriptData || {};
    if (!sd.customPresets) sd.customPresets = {};
    var data = sd.customPresets[key];
    if (data === undefined) {
      data = (key === 'militarySystems') ? {} : [];
      sd.customPresets[key] = data;
    }
    return data;
  }

  function _countPresets(key) {
    var d = _getCurrentPresets(key);
    return Array.isArray(d) ? d.length : Object.keys(d).length;
  }

  function renderPresetsPanel() {
    var wrap = document.getElementById('tm-custom-presets-panel');
    if (!wrap) return;
    var html = '<div style="padding:10px;border:1px solid #b89a53;border-radius:6px;background:rgba(184,154,83,0.04);">';
    html += '<div style="font-weight:600;color:#b89a53;margin-bottom:6px;">剧本自定义预设（覆盖/追加默认 25 大徭役等）</div>';
    html += '<div style="font-size:0.72rem;color:#999;margin-bottom:10px;">为当前剧本补充/替换历史预设，AI 推演时会合并使用；不同朝代/架空世界可配不同内容。</div>';

    PRESET_TYPES.forEach(function(t) {
      var count = _countPresets(t.key);
      html += '<div style="margin-bottom:8px;padding:6px 8px;background:#222;border-left:3px solid #b89a53;border-radius:3px;">';
      html += '<div style="display:flex;align-items:center;gap:8px;">';
      html += '<b style="flex:1;">' + _esc(t.label) + '</b>';
      html += '<span style="color:#999;font-size:0.7rem;">剧本定制: ' + count + '</span>';
      html += '<button type="button" onclick="tmCpsEdit(\''+t.key+'\')" style="padding:3px 8px;background:#444;color:#eee;border:none;border-radius:3px;cursor:pointer;font-size:0.7rem;">编辑</button>';
      html += '<button type="button" onclick="tmCpsAiGen(\''+t.key+'\')" style="padding:3px 8px;background:#b89a53;color:#111;border:none;border-radius:3px;cursor:pointer;font-size:0.7rem;">★AI生成</button>';
      html += '</div>';
      html += '<div style="font-size:0.65rem;color:#888;margin-top:2px;">字段：'+_esc(t.sampleFields)+'</div>';
      html += '</div>';
    });

    html += '</div>';
    wrap.innerHTML = html;
  }

  function tmCpsEdit(key) {
    var d = _getCurrentPresets(key);
    var json = JSON.stringify(d, null, 2);
    var body = '<div class="form-group"><label>自定义预设 JSON（'+key+'）</label>';
    body += '<textarea id="tmcps-json" rows="20" style="font-family:monospace;font-size:0.72rem;">'+_esc(json)+'</textarea>';
    body += '<div style="font-size:0.65rem;color:#888;margin-top:4px;">数组或对象格式，按 <code>'+_esc(PRESET_TYPES.find(function(x){return x.key===key;}).sampleFields)+'</code>。带同 id 会覆盖默认预设。</div>';
    body += '</div>';
    if (typeof global.openGenericModal === 'function') {
      global.openGenericModal('编辑剧本预设 · '+key, body, function() {
        var raw = document.getElementById('tmcps-json').value;
        try {
          var data = JSON.parse(raw);
          if (!global.scriptData) global.scriptData = {};
          if (!global.scriptData.customPresets) global.scriptData.customPresets = {};
          global.scriptData.customPresets[key] = data;
          if (global.closeGenericModal) global.closeGenericModal();
          if (global.autoSave) global.autoSave();
          if (global.showToast) global.showToast('已保存 '+key);
          renderPresetsPanel();
        } catch (e) {
          if (global.showToast) global.showToast('JSON 解析失败：'+e.message);
        }
      });
    }
  }

  function tmCpsAiGen(key) {
    var sd = global.scriptData || {};
    var dyn = (sd.settings && sd.settings.dynasty) || sd.dynasty || '未指定朝代';
    var bg  = (sd.settings && sd.settings.background) || sd.background || '';
    var era = (sd.settings && sd.settings.era) || sd.era || '';
    var t = PRESET_TYPES.find(function(x){return x.key===key;});
    if (!t) return;

    var promptTpl = {
      corveeProjects:       '按 ' + dyn + (era?'·'+era:'') + ' 的实际史实，生成 5-8 条【大徭役工程】 JSON 数组，对本剧本有特殊意义。每项：{id,name,dynasty,year,labor,deathRate,duration,legitimacyDelta,minxinDelta,outcomes:{farmland/defense/transport},notes}\n仅返回数组。',
      migrationEvents:      '按 ' + dyn + (era?'·'+era:'') + ' 特征，生成 3-5 条【迁徙事件】 JSON 数组。每项：{id,name,year,scale(人口数),from:[地域],to:[地域],trigger(major_revolt/famine/policy/conquest),legitimacyDelta,culturalShift}\n仅返回数组。',
      militarySystems:      '按 ' + dyn + ' 实际兵制生成 JSON 对象（键名为制度 id）。每键值：{name,dynasty,era,peakYear,hereditary/paidSoldiers,corps:{...各部队:人数},totalStrength,problems[],collapse,successor}\n仅返回对象。',
      taxItems:             '按 ' + dyn + ' 实际税制生成 JSON 数组，每项：{id,name,category(field/head/commerce/salt/tea/misc),rate,unit,dynasty,note}\n8-15 项，涵盖主要税种。仅返回数组。',
      institutionTemplates: '按 ' + dyn + ' 政治特征生成 JSON 对象（键名为制度 id）。每键值：{name,category(central/local/military/fiscal/supervisory),lifecycleStages(["initial","mature","declining"]),effects:{...},prerequisites:[],notes}\n5-10 项。仅返回对象。',
      classicalEdicts:      '按 ' + dyn + (era?'·'+era:'') + ' 的实际史实，生成 8-12 条【历代典范诏书】 JSON 数组。每项：{id,dynasty,emperor,type(reform/appointment/amnesty/tax/military/mourning/retirement等),text(诏书古文原文50-150字),effect(主要影响),note(历史背景)}\n仅返回数组。',
      abductionCases:       '按 ' + dyn + (era?'·'+era:'') + ' 可能出现的权力更替情形，生成 3-5 条【禅让/逼宫案例】 JSON 数组。每项：{id,dynasty,year,type(voluntary_abdication/coerced_abdication/coup/regicide),actor,outcome(success/failure/compromise),description(100字)}\n仅返回数组。',
      edictTemplates:       '按 ' + dyn + ' 特征生成 JSON 对象（键名为模板 id）。每键值：{name(模板名),templateText(填空式诏令模板,含【】占位符如【地名】【官职】),hintFields:[占位符列表]}\n6-10 项，涵盖赈灾/任免/减税/调兵/封赏/大赦等常见场景。仅返回对象。'
    };

    var prompt = '你是中国古代制度史专家。剧本背景：' + dyn + (era?'·'+era:'') + '。' + (bg?'背景说明：'+bg:'') + '\n\n任务：' + promptTpl[key] + '\n注意：与已有 25 大徭役 / 9 迁徙 / 7 兵制 默认预设保持兼容（同 id 覆盖，新 id 追加），避免完全重复。';
    var callFn = global.callAI || global.callAISmart;
    if (!callFn) { if (global.showToast) global.showToast('AI 服务未就绪'); return; }
    if (global.showLoading) global.showLoading('AI 生成 '+t.label+' 中...', 40);

    callFn({ prompt: prompt, expectJson: true }).then(function(res) {
      if (global.hideLoading) global.hideLoading();
      try {
        var txt = (typeof res === 'string') ? res : (res.text || res.content || JSON.stringify(res));
        var data = extractJSON(txt);
        if (data == null) throw new Error('AI 未返回唯一 JSON 值');
        if (!sd.customPresets) sd.customPresets = {};
        sd.customPresets[key] = data;
        if (global.autoSave) global.autoSave();
        if (global.showToast) global.showToast('已生成 ' + t.label + '，共 ' + (Array.isArray(data)?data.length:Object.keys(data).length) + ' 条');
        renderPresetsPanel();
      } catch (e) {
        console.error('[tmCpsAiGen] parse', e);
        if (global.showToast) global.showToast('AI 返回无法解析');
      }
    }).catch(function(err) {
      if (global.hideLoading) global.hideLoading();
      console.error(err);
      if (global.showToast) global.showToast('AI 请求失败');
    });
  }

  function _install() {
    if (INSTALLED) return true;
    // 注册新的编辑器 sidebar 标签：t-presets
    if (!global.editorTabs || !Array.isArray(global.editorTabs)) return false;
    var existed = global.editorTabs.some(function(t){ return t.id === 't-presets'; });
    if (!existed) {
      global.editorTabs.push({ id:'t-presets', icon:'\u58AC', label:'\u5267\u672C\u9884\u8BBE', group:'\u7CFB\u7EDF' });
    }

    // 包装 renderEdTab 以处理 t-presets
    if (typeof global.renderEdTab === 'function' && !global.renderEdTab.__presetsWrapped) {
      var orig = global.renderEdTab;
      global.renderEdTab = function(id) {
        if (id === 't-presets') {
          var em = document.getElementById('em');
          if (em) {
            em.innerHTML = '<div id="tm-custom-presets-panel" style="padding:10px;"></div>';
            renderPresetsPanel();
          }
          return;
        }
        return orig.apply(this, arguments);
      };
      global.renderEdTab.__presetsWrapped = true;
    }

    // 若编辑器 sidebar 已渲染（用户已经进入编辑器），重新渲染 sidebar 以显示新 tab
    var sb = document.getElementById('sidebar');
    if (sb && sb.children && sb.children.length > 0 && typeof global.enterEditor === 'function' && global.editingScenarioId) {
      // 只需要追加新 tab 的 HTML
      if (!sb.querySelector('.si[onclick*="t-presets"]')) {
        var newTab = document.createElement('div');
        newTab.className = 'si';
        newTab.setAttribute('onclick', 'switchEdTab(this,\'t-presets\')');
        newTab.innerHTML = '\u58AC <span>\u5267\u672C\u9884\u8BBE</span><span class="ed-badge" id="edb-t-presets"></span>';
        sb.appendChild(newTab);
      }
    }
    INSTALLED = true;
    return true;
  }

  // 对外暴露
  global.tmCpsEdit = tmCpsEdit;
  global.tmCpsAiGen = tmCpsAiGen;
  global.tmCpsRender = renderPresetsPanel;
  global.TM_CustomPresets = {
    install: _install,
    render: renderPresetsPanel,
    types: PRESET_TYPES
  };

  // 在 DOM 就绪后 + 编辑器激活时重试安装
  function _boot() {
    if (_install()) return;
    var tries = 0;
    var iv = setInterval(function() {
      if (_install() || ++tries > 30) clearInterval(iv);
    }, 500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }
})(typeof window !== 'undefined' ? window : this);

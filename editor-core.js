// ============================================================
// 剧本编辑器 — 核心模块 (editor-core.js)
// 包含: scriptData, escHtml, showLoading, hideLoading, editorInit,
//       loadScript, DOMContentLoaded, initSidebar, initSubTabs
// ============================================================

// ============================================================
// 剥本编辑器逻辑 — 权威来源！
// 这个文件包含：所有编辑器功能 (CRUD、AI生成、校验等)。
// 编辑器 UI 在 editor.html，游戏运行时在 index.html。
//
// 要添加/修改编辑器功能：直接修改这个文件。
// 不要将编辑器功能加入 index.html！
//
// 全局数据对象： scriptData（不是 P）
// 参见 ARCHITECTURE.md 了解整体架构。
// ============================================================

var scriptData = {
    id:'', // 剧本唯一ID，持久化到磁盘
    name:'', dynasty:'', emperor:'', overview:'',
    startYear: null,       // 起始公元年（负数=公元前）
    dynastyPhaseHint: '',  // 时代阶段提示：founding/rising/peak/stable/declining/crisis
    openingText:'',
    globalRules:'',
    playerInfo:{
      playerRole:'',         // 玩家定位：emperor/regent/general/minister/prince/merchant/custom
      playerRoleCustom:'',   // 自定义定位描述
      leaderIsPlayer: true,  // 领袖即玩家角色
      factionName:'', factionType:'', factionLeader:'', factionLeaderTitle:'',
      factionTerritory:'', factionStrength:'', factionCulture:'', factionGoal:'',
      factionResources:'', factionDesc:'',
      characterName:'', characterTitle:'', characterFaction:'', characterAge:'',
      characterGender:'', characterPersonality:'', characterFaith:'', characterCulture:'',
      characterBio:'', characterDesc:'',
      characterAppearance:'', characterCharisma:'',
      // 显著矛盾（黑格尔式：矛盾是推动事物发展的源泉）
      coreContradictions: []  // [{title:'矛盾标题',dimension:'political/economic/military/social',description:'详细描述',parties:'冲突双方',severity:'critical/major/minor'}]
    },
    gameSettings:{
      enabledSystems:{ items:true, military:true, techTree:true, civicTree:true, events:true, map:true, characters:true, factions:true, classes:true, rules:true, officeTree:true },
      startYear:1, startMonth:1, startDay:1,
      enableGanzhi:true, enableGanzhiDay:true,
      enableEraName:true, eraNames:[],
      daysPerTurn:30, turnDuration:1, turnUnit:'月'
    },
    time: null, // 时间配置（由gameSettings或独立配置）
    characters:[], factions:[], parties:[], classes:[], items:[],
    military:{ troops:[], facilities:[], organization:[], campaigns:[], initialTroops:[], militarySystem:[] },
    techTree:{ military:[], civil:[] },
    civicTree:{ city:[], policy:[], resource:[], corruption:[] },
    variables:{ base:[], other:[], formulas:[] },
    rules:{ base:'', combat:'', economy:'', diplomacy:'' },
    events:{ historical:[], random:[], conditional:[], story:[], chain:[] },
    timeline:{ past:[], future:[] },
    map:{ items:[] },
    mapData:{},
    externalForces:[],
    relations:[],
    // 势力间关系矩阵: [{from,to,type,value,desc}]
    factionRelations:[],
    worldSettings:{ culture:'', weather:'', religion:'', economy:'', technology:'', diplomacy:'' },
    government:{ name:'', description:'', selectionSystem:'', promotionSystem:'', historicalReference:'', nodes:[] },
    officeTree: [],
    cities: [],
    eraState: {
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
    },
    adminHierarchy: {},
    buildingSystem: {
      enabled: false,
      buildingTypes: []
    },
    postSystem: {
      enabled: false,
      postRules: []
    },
    vassalSystem: {
      enabled: false,
      vassalTypes: [],
      vassalRelations: []
    },
    titleSystem: {
      enabled: false,
      titleRanks: [],
      characterTitles: []
    },
    officialVassalMapping: {
      // 官爵对应表：定义官职与封臣类型的对应关系（由AI生成或手动配置，按朝代不同而不同）
      // 格式：{ officialPattern: 'xxx', vassalType: 'xxx', rank: 'xxx', confidence: 0.9 }
      mappings: []
    },
    economyConfig: {
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
    },
    // 目标/胜负条件定义
    goals: [],
    influenceGroups: [],
    // 得罪群体配置
    offendGroups: {
      enabled: false,
      decayEnabled: true,
      decayRate: 0.05,
      groups: []
    },
    // 科举系统配置
    keju: {
      enabled: false,
      reformed: false,
      examIntervalNote: '',
      examNote: ''
    },
    haremConfig: {
      rankSystem: [],
      succession: 'eldest_legitimate',
      haremDescription: '',
      successionNote: '',
      motherClanSystem: '',
      heirSelectionMethod: 'eldest_legitimate'
    },
    palaceSystem: {
      enabled: false,
      capitalName: '',
      capitalDescription: '',
      palaces: []
    },
    // 文事系统配置
    culturalConfig: {
      enabled: true,              // 启用文事系统
      dynastyFocus: 'auto',       // auto/tang_shi/song_ci/yuan_qu/ming_wen/qing_sanwen
      presetWorks: []             // 预设历史名作(可选——如剧本自带传世之作)
    },
    // 关系预设（角色关系+势力关系）
    presetRelations: {
      npc: [],        // 每条: {charA, charB, labels:['同年','政敌'], affinity, trust, respect, fear, hostility, conflictLevel, history:[]}
      faction: []     // 每条: {facA, facB, trust, hostility, economicTies, culturalAffinity, kinshipTies, territorialDispute, historicalEvents:[{turn, event, type}], activeTreaties:[]}
    },
    warConfig: { casusBelliTypes: [] },
    diplomacyConfig: { treatyTypes: [] },
    schemeConfig: { enabled: false, schemeTypes: [] },
    decisionConfig: { decisions: [] },
    // 诏令示例（引导AI认知本剧本诏令风格与阻力生态）
    edictConfig: {
      enabled: true,
      examples: [],           // 预设典型诏令：[{category,content,expectedResistance,typicalOpposition,typicalSupporter,historicalOutcome}]
      styleNote: ''           // 本朝代诏令风格提示（如"唐制：诏-敕-旨分明"、"明制：票拟批红"）
    },
    chronicleConfig: { yearlyEnabled: true, style: 'biannian', yearlyMinChars: 300, yearlyMaxChars: 600 },
    eventConstraints: { enabled: false, types: [] },
    // 阶段1-4新增的机制配置（由 _ensurePDefaults 初始化默认值）
    mechanicsConfig: {},
    // 军事配置（兵种/战斗阶段/动量由编辑器定义）
    militaryConfig: {}
  };

  // 3.4: 编辑历史与撤销系统
  var EditHistory = (function() {
    var _undoStack = [];
    var _redoStack = [];
    var MAX_HISTORY = 50;

    function _snapshot() {
      try { return JSON.stringify(scriptData); } catch(e) { return null; }
    }

    return {
      /** 保存当前状态到撤销栈（在修改前调用） */
      push: function(label) {
        var snap = _snapshot();
        if (!snap) return;
        _undoStack.push({label: label || 'edit', data: snap, time: Date.now()});
        if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
        _redoStack = []; // 新操作清空重做栈
      },
      /** 撤销 */
      undo: function() {
        if (_undoStack.length === 0) { if (typeof showToast === 'function') showToast('\u65E0\u53EF\u64A4\u9500\u7684\u64CD\u4F5C'); return false; }
        var current = _snapshot();
        if (current) _redoStack.push({label: 'redo', data: current, time: Date.now()});
        var prev = _undoStack.pop();
        try {
          var restored = JSON.parse(prev.data);
          Object.keys(scriptData).forEach(function(k) { delete scriptData[k]; });
          Object.assign(scriptData, restored);
          if (typeof showToast === 'function') showToast('\u5DF2\u64A4\u9500: ' + prev.label);
          return true;
        } catch(e) { return false; }
      },
      /** 重做 */
      redo: function() {
        if (_redoStack.length === 0) { if (typeof showToast === 'function') showToast('\u65E0\u53EF\u91CD\u505A\u7684\u64CD\u4F5C'); return false; }
        var current = _snapshot();
        if (current) _undoStack.push({label: 'undo', data: current, time: Date.now()});
        var next = _redoStack.pop();
        try {
          var restored = JSON.parse(next.data);
          Object.keys(scriptData).forEach(function(k) { delete scriptData[k]; });
          Object.assign(scriptData, restored);
          if (typeof showToast === 'function') showToast('\u5DF2\u91CD\u505A');
          return true;
        } catch(e) { return false; }
      },
      /** 获取撤销栈长度 */
      undoCount: function() { return _undoStack.length; },
      redoCount: function() { return _redoStack.length; },
      /** 清空历史 */
      clear: function() { _undoStack = []; _redoStack = []; }
    };
  })();

  // 3.4: 键盘快捷键 Ctrl+Z/Ctrl+Shift+Z
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      // Ctrl+Z 撤销——仅在非输入框中或有明确撤销意图时
      var tag = (document.activeElement||{}).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return; // 让输入框自己处理
      e.preventDefault();
      if (EditHistory.undo()) {
        // 刷新当前面板
        if (typeof renderCharacters === 'function') renderCharacters();
        if (typeof renderFactions === 'function') renderFactions();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      var tag2 = (document.activeElement||{}).tagName;
      if (tag2 === 'INPUT' || tag2 === 'TEXTAREA' || tag2 === 'SELECT') return;
      e.preventDefault();
      if (EditHistory.redo()) {
        if (typeof renderCharacters === 'function') renderCharacters();
        if (typeof renderFactions === 'function') renderFactions();
      }
    }
  });

  /** HTML转义 */
  function escHtml(s){if(s===null||s===undefined)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

  /** 编辑器通用弹窗（等同 openGenericModal，在 editor.html 上下文中可用） */
  if (typeof openEditorModal === 'undefined') {
    window.openEditorModal = function(title, bodyHTML, onSave) {
      var ov = document.createElement('div');
      ov.className = 'generic-modal-overlay';
      ov.id = 'gm-overlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:1006;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
      ov.innerHTML = '<div style="background:var(--bg-secondary,#1a1a25);border:1px solid var(--gold-dark,#8b7355);border-radius:12px;width:92%;max-width:520px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;">' +
        '<div style="padding:0.8rem 1rem;border-bottom:1px solid var(--border,#333);display:flex;justify-content:space-between;align-items:center;"><h3 style="color:var(--gold,#c9a84c);font-size:1rem;margin:0;">' + title + '</h3><button style="background:none;border:none;color:var(--text-secondary,#888);font-size:1.2rem;cursor:pointer;" onclick="closeEditorModal()">✕</button></div>' +
        '<div style="flex:1;overflow-y:auto;padding:1rem;">' + bodyHTML + '</div>' +
        '<div style="padding:0.6rem 1rem;border-top:1px solid var(--border,#333);display:flex;gap:0.5rem;justify-content:flex-end;">' +
        '<button class="btn" onclick="closeEditorModal()">取消</button>' +
        '<button class="btn btn-gold" id="gm-save-btn">保存</button></div></div>';
      document.body.appendChild(ov);
      document.getElementById('gm-save-btn').onclick = function() { if (onSave) onSave(); closeEditorModal(); };
    };
    window.closeEditorModal = function() { var ov = document.getElementById('gm-overlay'); if (ov) ov.remove(); };
  }
  // 别名兼容：openGenericModal → openEditorModal
  if (typeof openGenericModal === 'undefined') {
    window.openGenericModal = window.openEditorModal;
    window.closeGenericModal = window.closeEditorModal;
  }

  /** showLoading/hideLoading — 编辑器独立实现（index.html 有自己的版本） */
  var _edLoadingEl=null;
  function showLoading(msg,pct){
    if(!_edLoadingEl){
      _edLoadingEl=document.createElement('div');
      _edLoadingEl.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
      _edLoadingEl.innerHTML='<div style="color:#c9a96e;font-size:16px;margin-bottom:12px;" id="_ed_load_msg"></div><div style="width:200px;height:4px;background:#333;border-radius:2px;"><div id="_ed_load_bar" style="height:100%;background:#c9a96e;border-radius:2px;transition:width 0.3s;width:0%"></div></div>';
      document.body.appendChild(_edLoadingEl);
    }
    _edLoadingEl.style.display='flex';
    var m=document.getElementById('_ed_load_msg');if(m)m.textContent=msg||'处理中...';
    var b=document.getElementById('_ed_load_bar');if(b)b.style.width=(pct||0)+'%';
  }
  function hideLoading(){if(_edLoadingEl)_edLoadingEl.style.display='none';}

  var _lastValidateIssues = [];
  var currentPanel = 'scriptInfo';
  var currentAIGenTarget = '';
  var editingCharIndex = -1;

  function editorInit() {
    try { loadScript(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'editor] loadScript FAILED:') : console.error('[editor] loadScript FAILED:', e); }
    try { initSidebar(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'editor] initSidebar FAILED:') : console.error('[editor] initSidebar FAILED:', e); }
    try { initSubTabs(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'editor] initSubTabs FAILED:') : console.error('[editor] initSubTabs FAILED:', e); }
    try { renderAll(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'editor] renderAll FAILED:') : console.error('[editor] renderAll FAILED:', e); }
  }
  // 始终等DOMContentLoaded后初始化（确保所有defer脚本已加载完毕）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', editorInit);
  } else {
    // DOM已就绪但defer脚本可能仍在执行——延迟一个microtask确保全部加载
    setTimeout(editorInit, 0);
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var panel = document.getElementById('panel-apiSettings');
      if (panel && panel.classList.contains('show-api')) {
        panel.classList.remove('show-api');
      } else {
        returnToMain();
      }
    }
  });

  function initSidebar() {
    var items = document.querySelectorAll('.sidebar-item');
    console.log('[DEBUG] initSidebar: found', items.length, 'sidebar items');
    items.forEach(function(item) {
      item.addEventListener('click', function() {
        console.log('[DEBUG] sidebar click:', item.dataset.panel);
        items.forEach(function(i) {
          i.classList.remove('active');
        });
        item.classList.add('active');
        currentPanel = item.dataset.panel;
        var panels = document.querySelectorAll('.panel-section');
        console.log('[DEBUG] found', panels.length, 'panel-section elements');
        panels.forEach(function(p) {
          p.classList.remove('active');
        });
        var target = document.getElementById(
          'panel-' + currentPanel
        );
        console.log('[DEBUG] target panel:', 'panel-' + currentPanel, '=> exists:', !!target);
        if (target) target.classList.add('active');

        // 切换到面板时自动刷新该面板内容
        var _panelRenderers = {
          scriptInfo: function() { renderGameSettings(); },
          playerOverview: function() { if(typeof renderPlayerOverview==='function') renderPlayerOverview(); },
          characters: function() { if(typeof renderCharacters==='function') renderCharacters(); },
          factions: function() { if(typeof renderFactions==='function') renderFactions(); },
          parties: function() { if(typeof renderParties==='function') renderParties(); },
          classes: function() { if(typeof renderClasses==='function') renderClasses(); },
          items: function() { if(typeof renderItems==='function') renderItems(); },
          military: function() { if(typeof renderMilitaryNew==='function') renderMilitaryNew(); },
          techTree: function() { if(typeof renderTechTree==='function') renderTechTree(); },
          civicTree: function() { if(typeof renderCivicTree==='function') renderCivicTree(); },
          variables: function() { if(typeof renderVariables==='function') renderVariables(); },
          rules: function() { if(typeof renderRules==='function') renderRules(); },
          events: function() { if(typeof renderEvents==='function') renderEvents(); },
          timeline: function() { if(typeof renderTimeline==='function') renderTimeline(); },
          goals: function() { if(typeof renderGoalsList==='function') renderGoalsList(); },
          influenceGroups: function() { if(typeof renderInfluenceGroupsList==='function') renderInfluenceGroupsList(); },
          worldSettings: function() { if(typeof renderWorldSettings==='function') renderWorldSettings(); },
          eraState: function() { if(typeof renderEraState==='function') renderEraState(); if(typeof renderEconomyConfig==='function') renderEconomyConfig(); },
          economy: function() { if(typeof renderEconomyConfig==='function') renderEconomyConfig(); },
          buildingSystem: function() { if(typeof renderBuildingSystem==='function') renderBuildingSystem(); },
          government: function() { if(typeof renderGovernment==='function') renderGovernment(); if(typeof renderOfficeTree==='function') renderOfficeTree(); },
          postSystem: function() { if(typeof renderPostSystem==='function') renderPostSystem(); },
          vassalSystem: function() { if(typeof renderVassalSystem==='function') renderVassalSystem(); if(typeof renderTitleSystem==='function') renderTitleSystem(); },
          titleSystem: function() { if(typeof renderTitleSystem==='function') renderTitleSystem(); },
          kejuSystem: function() {},
          haremConfig: function() { if(typeof renderHaremConfig==='function') renderHaremConfig(); },
          palaceSystem: function() { if(typeof renderPalaceSystem==='function') renderPalaceSystem(); },
          administration: function() { if(typeof renderAdminTree==='function') renderAdminTree(); },
          mapSystem: function() { if(typeof renderMap==='function') renderMap(); if(typeof renderMapSystem==='function') renderMapSystem(); if(typeof renderTerrainConfig==='function') renderTerrainConfig(); },
          map: function() { if(typeof renderMap==='function') renderMap(); }
        };
        var _renderer = _panelRenderers[currentPanel];
        if (_renderer) setTimeout(_renderer, 50);
      });
    });

    // 地图编辑器链接
    var mapEditorLink = document.getElementById('map-editor-link');
    if (mapEditorLink) {
      mapEditorLink.addEventListener('click', function() {
        // 切换到地图面板并打开内嵌编辑器
        currentPanel = 'map';
        document.querySelectorAll('.sidebar-item').forEach(function(item) {
          item.classList.remove('active');
          if (item.dataset.panel === 'map') {
            item.classList.add('active');
          }
        });
        document.querySelectorAll('.panel-section').forEach(function(p) {
          p.classList.remove('active');
        });
        var mapPanel = document.getElementById('panel-map');
        if (mapPanel) mapPanel.classList.add('active');

        // 打开内嵌地图编辑器
        if (typeof toggleMapEditor === 'function') {
          toggleMapEditor();
        }
      });
    }
  }

  function initSubTabs() {
    var tabBars = document.querySelectorAll('.sub-tabs');
    tabBars.forEach(function(tabBar) {
      var tabs = tabBar.querySelectorAll('.sub-tab');
      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var panel = tabBar.closest('.panel-section');
          tabs.forEach(function(t) {
            t.classList.remove('active');
          });
          tab.classList.add('active');
          var contents = panel.querySelectorAll('.sub-content');
          contents.forEach(function(c) {
            c.classList.remove('active');
          });
          var subName = tab.dataset.sub;
          var target = panel.querySelector(
            '.sub-content[data-sub="' + subName + '"]'
          );
          if (target) target.classList.add('active');
          // 特定子标签页激活时触发渲染
          if (subName === 'milBattleConfig' && typeof renderBattleConfigEditor === 'function') {
            renderBattleConfigEditor('battleConfigContainer');
          }
          if (subName === 'ruleWarConfig' && typeof renderWarConfig === 'function') renderWarConfig();
          if (subName === 'ruleDipConfig' && typeof renderDiplomacyConfig === 'function') renderDiplomacyConfig();
          if (subName === 'ruleScheme' && typeof renderSchemeConfig === 'function') renderSchemeConfig();
          if (subName === 'ruleDecision' && typeof renderDecisionConfig === 'function') renderDecisionConfig();
          if (subName === 'ruleEventCon' && typeof renderEventConstraints === 'function') renderEventConstraints();
          if (subName === 'ruleChronicle' && typeof renderChronicleConfig === 'function') renderChronicleConfig();
          if (subName === 'ruleEnYuan' && typeof renderInitialEnYuan === 'function') renderInitialEnYuan();
          if (subName === 'ruleAdminCfg' && typeof renderAdminConfig === 'function') renderAdminConfig();
          if (subName === 'ruleNpcBhv' && typeof renderNpcBehaviors === 'function') renderNpcBehaviors();
        });
      });
    });
  }

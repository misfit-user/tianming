// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Audio & Theme System - 音频与主题系统
// Requires: tm-utils.js (GameHooks, _$, toast, saveP),
//           tm-game-engine.js (doExport, backToLaunch)
// ============================================================
var AudioSystem = {
  bgm: null,
  sfxVolume: 0.5,
  bgmVolume: 0.3,
  enabled: true,
  bgmEnabled: true,

  // 音效库
  sounds: {
    click: null,
    success: null,
    error: null,
    notification: null,
    turnEnd: null,
    achievement: null
  },

  // 初始化
  init: function() {
    // 从本地存储加载设置
    var savedSettings = localStorage.getItem('tianming_audio_settings');
    if (savedSettings) {
      try {
        var settings = JSON.parse(savedSettings);
        this.sfxVolume = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.5;
        this.bgmVolume = settings.bgmVolume !== undefined ? settings.bgmVolume : 0.3;
        this.enabled = settings.enabled !== undefined ? settings.enabled : true;
        this.bgmEnabled = settings.bgmEnabled !== undefined ? settings.bgmEnabled : true;
      } catch (e) {
        console.error('加载音频设置失败:', e);
      }
    }

    // 创建音效（使用 Web Audio API 生成简单音效）
    this.generateSounds();
  },

  // 生成音效
  generateSounds: function() {
    // 使用 Web Audio API 生成简单的音效
    // 这里使用占位符，实际项目中可以加载音频文件
    this.sounds.click = this.createTone(800, 0.05, 'sine');
    this.sounds.success = this.createTone(1000, 0.2, 'sine');
    this.sounds.error = this.createTone(400, 0.3, 'sawtooth');
    this.sounds.notification = this.createTone(1200, 0.15, 'sine');
    this.sounds.turnEnd = this.createTone(600, 0.4, 'triangle');
    this.sounds.achievement = this.createTone(1500, 0.5, 'sine');
  },

  // 创建音调
  createTone: function(frequency, duration, type) {
    return {
      frequency: frequency,
      duration: duration,
      type: type
    };
  },

  // 播放音效
  playSfx: function(soundName) {
    if (!this.enabled || !this.sounds[soundName]) return;

    try {
      var audioContext = new (window.AudioContext || window.webkitAudioContext)();
      var oscillator = audioContext.createOscillator();
      var gainNode = audioContext.createGain();

      var sound = this.sounds[soundName];

      oscillator.type = sound.type;
      oscillator.frequency.value = sound.frequency;

      gainNode.gain.value = this.sfxVolume;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + sound.duration);
    } catch (e) {
      console.error('播放音效失败:', e);
    }
  },

  // 播放背景音乐
  playBgm: function(url) {
    if (!this.bgmEnabled) return;

    try {
      if (this.bgm) {
        this.bgm.pause();
        this.bgm = null;
      }

      if (url) {
        this.bgm = new Audio(url);
        this.bgm.volume = this.bgmVolume;
        this.bgm.loop = true;
        this.bgm.play().catch(function(e) {
          _dbg('背景音乐播放失败（可能需要用户交互）:', e);
        });
      }
    } catch (e) {
      console.error('播放背景音乐失败:', e);
    }
  },

  // 停止背景音乐
  stopBgm: function() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
  },

  // 设置音效音量
  setSfxVolume: function(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  },

  // 设置背景音乐音量
  setBgmVolume: function(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgm) {
      this.bgm.volume = this.bgmVolume;
    }
    this.saveSettings();
  },

  // 切换音效开关
  toggleSfx: function() {
    this.enabled = !this.enabled;
    this.saveSettings();
    return this.enabled;
  },

  // 切换背景音乐开关
  toggleBgm: function() {
    this.bgmEnabled = !this.bgmEnabled;
    if (!this.bgmEnabled) {
      this.stopBgm();
    }
    this.saveSettings();
    return this.bgmEnabled;
  },

  // 保存设置
  saveSettings: function() {
    var settings = {
      sfxVolume: this.sfxVolume,
      bgmVolume: this.bgmVolume,
      enabled: this.enabled,
      bgmEnabled: this.bgmEnabled
    };
    localStorage.setItem('tianming_audio_settings', JSON.stringify(settings));
  }
};

// 打开音频设置面板
function openAudioSettings() {
  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'audio-settings-overlay';

  var html = '<div class="generic-modal" style="max-width:500px;">';
  html += '<div class="generic-modal-header">';
  html += '<h3>🔊 音频设置</h3>';
  html += '<button onclick="closeAudioSettings()">✕</button>';
  html += '</div>';

  html += '<div class="generic-modal-body">';

  // 音效开关
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding:0.8rem;background:var(--bg-3);border-radius:6px;">';
  html += '<div><strong>音效</strong><br><span style="font-size:0.85rem;color:var(--txt-d);">按钮点击、通知等音效</span></div>';
  html += '<label class="switch"><input type="checkbox" id="sfx-toggle" ' + (AudioSystem.enabled ? 'checked' : '') + ' onchange="toggleSfxSwitch()"><span class="slider"></span></label>';
  html += '</div>';

  // 音效音量
  html += '<div style="margin-bottom:1.5rem;">';
  html += '<label style="display:block;margin-bottom:0.5rem;"><strong>音效音量</strong></label>';
  html += '<input type="range" id="sfx-volume" min="0" max="100" value="' + (AudioSystem.sfxVolume * 100) + '" ';
  html += 'style="width:100%;" oninput="updateSfxVolume(this.value)">';
  html += '<div style="text-align:center;font-size:0.85rem;color:var(--txt-d);margin-top:0.3rem;" id="sfx-volume-display">' + Math.round(AudioSystem.sfxVolume * 100) + '%</div>';
  html += '</div>';

  // 背景音乐开关
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding:0.8rem;background:var(--bg-3);border-radius:6px;">';
  html += '<div><strong>背景音乐</strong><br><span style="font-size:0.85rem;color:var(--txt-d);">游戏背景音乐</span></div>';
  html += '<label class="switch"><input type="checkbox" id="bgm-toggle" ' + (AudioSystem.bgmEnabled ? 'checked' : '') + ' onchange="toggleBgmSwitch()"><span class="slider"></span></label>';
  html += '</div>';

  // 背景音乐音量
  html += '<div style="margin-bottom:1.5rem;">';
  html += '<label style="display:block;margin-bottom:0.5rem;"><strong>音乐音量</strong></label>';
  html += '<input type="range" id="bgm-volume" min="0" max="100" value="' + (AudioSystem.bgmVolume * 100) + '" ';
  html += 'style="width:100%;" oninput="updateBgmVolume(this.value)">';
  html += '<div style="text-align:center;font-size:0.85rem;color:var(--txt-d);margin-top:0.3rem;" id="bgm-volume-display">' + Math.round(AudioSystem.bgmVolume * 100) + '%</div>';
  html += '</div>';

  // 测试按钮
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:1rem;">';
  html += '<button class="bt bsm" onclick="AudioSystem.playSfx(\'click\')">测试点击音效</button>';
  html += '<button class="bt bsm" onclick="AudioSystem.playSfx(\'success\')">测试成功音效</button>';
  html += '<button class="bt bsm" onclick="AudioSystem.playSfx(\'notification\')">测试通知音效</button>';
  html += '<button class="bt bsm" onclick="AudioSystem.playSfx(\'achievement\')">测试成就音效</button>';
  html += '</div>';

  html += '</div>';
  html += '</div>';

  ov.innerHTML = html;
  document.body.appendChild(ov);

  // 添加开关样式
  if (!document.getElementById('switch-style')) {
    var style = document.createElement('style');
    style.id = 'switch-style';
    style.textContent = `
      .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
      .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
      input:checked + .slider { background-color: var(--gold); }
      input:checked + .slider:before { transform: translateX(26px); }
    `;
    document.head.appendChild(style);
  }
}

function closeAudioSettings() {
  var ov = document.getElementById('audio-settings-overlay');
  if (ov) ov.remove();
}

function toggleSfxSwitch() {
  var enabled = AudioSystem.toggleSfx();
  if (enabled) {
    AudioSystem.playSfx('click');
  }
}

function toggleBgmSwitch() {
  AudioSystem.toggleBgm();
}

function updateSfxVolume(value) {
  AudioSystem.setSfxVolume(value / 100);
  document.getElementById('sfx-volume-display').textContent = Math.round(value) + '%';
}

function updateBgmVolume(value) {
  AudioSystem.setBgmVolume(value / 100);
  document.getElementById('bgm-volume-display').textContent = Math.round(value) + '%';
}

// 在游戏启动时初始化音频系统
GameHooks.on('startGame:after', function() {
  AudioSystem.init();
});

// 在关键操作时播放音效
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子13）


// ============================================================
//  主题系统
// ============================================================

var ThemeSystem = {
  currentTheme: 'dark',
  themes: {
    dark: { name: '\u6697\u9ED1', icon: '\uD83C\uDF19' },
    light: { name: '\u660E\u4EAE', icon: '\u2600\uFE0F' },
    sepia: { name: '\u62A4\u773C', icon: '\uD83D\uDCD6' },
    blue: { name: '\u84DD\u8272', icon: '\uD83D\uDC99' },
    green: { name: '\u7EFF\u8272', icon: '\uD83D\uDC9A' },
    highcontrast: { name: '\u9AD8\u5BF9\u6BD4\u5EA6', icon: '\u2B24' }
  },

  // 初始化
  init: function() {
    // 从本地存储加载主题
    var savedTheme = localStorage.getItem('tianming_theme');
    if (savedTheme && this.themes[savedTheme]) {
      this.currentTheme = savedTheme;
    }
    this.apply();
  },

  // 应用主题
  apply: function() {
    if (this.currentTheme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
    localStorage.setItem('tianming_theme', this.currentTheme);
  },

  // 切换主题
  setTheme: function(themeName) {
    if (this.themes[themeName]) {
      this.currentTheme = themeName;
      this.apply();
      AudioSystem.playSfx('click');
    }
  }
};

// 打开主题设置面板
function openThemeSettings() {
  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'theme-settings-overlay';

  var html = '<div class="generic-modal" style="max-width:500px;">';
  html += '<div class="generic-modal-header">';
  html += '<h3>🎨 主题设置</h3>';
  html += '<button onclick="closeThemeSettings()">✕</button>';
  html += '</div>';

  html += '<div class="generic-modal-body">';
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;">';

  Object.keys(ThemeSystem.themes).forEach(function(key) {
    var theme = ThemeSystem.themes[key];
    var isActive = ThemeSystem.currentTheme === key;

    html += '<div onclick="ThemeSystem.setTheme(\'' + key + '\');closeThemeSettings();openThemeSettings();" ';
    html += 'style="';
    html += 'padding:1.5rem;';
    html += 'border:2px solid ' + (isActive ? 'var(--gold)' : 'var(--bdr)') + ';';
    html += 'border-radius:8px;';
    html += 'cursor:pointer;';
    html += 'text-align:center;';
    html += 'background:' + (isActive ? 'var(--bg-3)' : 'var(--bg-2)') + ';';
    html += 'transition:all 0.3s;';
    html += '">';
    html += '<div style="font-size:2rem;margin-bottom:0.5rem;">' + theme.icon + '</div>';
    html += '<div style="font-weight:700;color:' + (isActive ? 'var(--gold)' : 'var(--txt)') + ';">' + theme.name + '</div>';
    if (isActive) {
      html += '<div style="font-size:0.75rem;color:var(--gold-d);margin-top:0.3rem;">当前主题</div>';
    }
    html += '</div>';
  });

  html += '</div>';

  // 字体大小调整
  html += '<div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--bdr);">';
  html += '<h4 style="margin-bottom:1rem;">字体大小</h4>';
  html += '<div style="display:flex;gap:0.5rem;justify-content:center;">';
  html += '<button class="bt bsm" onclick="adjustFontSize(-1)">A-</button>';
  html += '<button class="bt bsm" onclick="adjustFontSize(0)">默认</button>';
  html += '<button class="bt bsm" onclick="adjustFontSize(1)">A+</button>';
  html += '</div>';
  html += '</div>';

  // 动画效果开关
  html += '<div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--bdr);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
  html += '<div><strong>动画效果</strong><br><span style="font-size:0.85rem;color:var(--txt-d);">启用界面过渡动画</span></div>';
  html += '<label class="switch"><input type="checkbox" id="animation-toggle" checked onchange="toggleAnimation()"><span class="slider"></span></label>';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  html += '</div>';

  ov.innerHTML = html;
  document.body.appendChild(ov);
}

function closeThemeSettings() {
  var ov = document.getElementById('theme-settings-overlay');
  if (ov) ov.remove();
}

function adjustFontSize(delta) {
  var root = document.documentElement;
  var currentSize = parseFloat(getComputedStyle(root).fontSize) || 16;
  var newSize;

  if (delta === 0) {
    newSize = 16; // 默认大小
  } else {
    newSize = currentSize + delta;
    if (newSize < 12) newSize = 12;
    if (newSize > 20) newSize = 20;
  }

  root.style.fontSize = newSize + 'px';
  localStorage.setItem('tianming_font_size', newSize);
  AudioSystem.playSfx('click');
}

function toggleAnimation() {
  var enabled = document.getElementById('animation-toggle').checked;
  if (enabled) {
    document.documentElement.style.setProperty('--transition-speed', '0.3s');
  } else {
    document.documentElement.style.setProperty('--transition-speed', '0s');
  }
  localStorage.setItem('tianming_animation', enabled);
}

// 在游戏启动时初始化主题系统
GameHooks.on('startGame:after', function() {
  ThemeSystem.init();

  // 恢复字体大小
  var savedFontSize = localStorage.getItem('tianming_font_size');
  if (savedFontSize) {
    document.documentElement.style.fontSize = savedFontSize + 'px';
  }

  // 恢复动画设置
  var savedAnimation = localStorage.getItem('tianming_animation');
  if (savedAnimation === 'false') {
    document.documentElement.style.setProperty('--transition-speed', '0s');
  }
});

// ============================================================
//  Electron DevTools焦点修复
// ============================================================
if(window.tianming&&window.tianming.isDesktop){
  // main.js中已有openDevTools/closeDevTools修复
  // 这里确保输入框始终可聚焦
  document.addEventListener("click",function(e){
    var tag=e.target.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"){
      setTimeout(function(){e.target.focus();},20);
    }
    window.focus();
  });
}

// ============================================================
//  导出功能（确保包含所有数据）
// ============================================================
function doExport(){
  if(!P.classes)P.classes=[];
  if(!P.externalForces)P.externalForces=[];
  if(!P.techTree)P.techTree=[];
  if(!P.civicTree)P.civicTree=[];
  if(!P.officeConfig)P.officeConfig={costVariables:[],shortfallEffects:""};
  if(!P.world.entries)P.world.entries=[];
  if(!P.officeDeptLinks)P.officeDeptLinks=[];

  var blob=new Blob([JSON.stringify(P,null,2)],{type:"application/json"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(P.conf.gameTitle||"tianming")+".json";a.click();
  toast("\u2705 \u5DF2\u5BFC\u51FA");
}

// 在启动页也加导出按钮
(function(){
  var menu=_$("lt-menu");if(!menu)return;
  var existing=menu.querySelector("[data-export]");if(existing)return;
  var expBtn=document.createElement("button");expBtn.className="lt-btn";expBtn.setAttribute("data-export","1");
  expBtn.innerHTML="\uD83D\uDCE4 <div><div style=\"font-weight:700;\">\u5BFC\u51FA\u9879\u76EE</div><div style=\"font-size:0.75rem;color:var(--txt-d);\">\u4FDD\u5B58\u6240\u6709\u5267\u672C\u6570\u636E</div></div>";
  expBtn.onclick=doExport;
  menu.appendChild(expBtn);
})();

// ============================================================
//  修复：确保所有编辑器标签页都能正确加载
// ============================================================
GameHooks.on('switchEdTab:after', function(el, id) {
  // 地图标签需要延迟绑定事件
  if(id==="t-map"){setTimeout(function(){bindMapEvents();drawMapEditor();renderRegionList();},100);}
});
// ============================================================
//  最终补漏
// ============================================================

// 1. 奏议数量设置（游戏内显示）
GameHooks.on('enterGame:after', function() {
  // 在奏议面板顶部添加数量设置
  var zl=_$("gt-zouyi");
  if(zl){
    var header=zl.querySelector("div:first-child");
    if(header&&header.innerHTML.indexOf("memorial-min")<0){
      header.innerHTML="<div style=\"display:flex;justify-content:space-between;align-items:center;\"><div style=\"font-size:0.95rem;font-weight:700;color:var(--gold);\">\u594F\u8BAE</div><div style=\"display:flex;gap:0.3rem;align-items:center;font-size:0.75rem;color:var(--txt-d);\">\u6BCF\u56DE <input type=\"number\" id=\"memorial-min\" value=\""+(P.conf.memorialMin||2)+"\" min=\"0\" max=\"10\" style=\"width:32px;\" onchange=\"P.conf.memorialMin=+this.value\"> ~ <input type=\"number\" id=\"memorial-max\" value=\""+(P.conf.memorialMax||4)+"\" min=\"1\" max=\"10\" style=\"width:32px;\" onchange=\"P.conf.memorialMax=+this.value\"> \u4EFD</div></div>";
    }
  }
}, 10);

// 2-6. 增强endTurn：注入完整上下文
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子3-8）

// ============================================================
//  存档读档优化 + 最终查漏
// ============================================================

// 1. 存档：确保包含所有数据

// 安全深拷贝辅助
function _safeClone(obj) {
  if (!obj) return obj;
  return typeof deepClone === 'function' ? deepClone(obj) : JSON.parse(JSON.stringify(obj));
}

// 确保 GM 所有字段存在默认值（存档前/读档后统一调用）
function _ensureGMDefaults() {
  if (!GM.shijiHistory) GM.shijiHistory = [];
  if (!GM.allCharacters) GM.allCharacters = [];
  if (!GM.classes) GM.classes = [];
  if (!GM.parties) GM.parties = [];
  if (!GM.extForces) GM.extForces = [];
  if (!GM.techTree) GM.techTree = [];
  if (!GM.civicTree) GM.civicTree = [];
  if (!GM.memorials) GM.memorials = [];
  if (!GM.qijuHistory) GM.qijuHistory = [];
  if (!GM.jishiRecords) GM.jishiRecords = [];
  if (!GM.biannianItems) GM.biannianItems = [];
  if (!GM.officeTree) GM.officeTree = [];
  if (!GM.officeChanges) GM.officeChanges = [];
  if (!GM.wenduiHistory) GM.wenduiHistory = {};
  if (!GM.evtLog) GM.evtLog = [];
  if (!GM.conv) GM.conv = [];
  if (!GM.autoSummary) GM.autoSummary = '';
  if (!GM.summarizedTurns) GM.summarizedTurns = [];
  if (!GM.characterArcs) GM.characterArcs = {};
  if (!GM.playerDecisions) GM.playerDecisions = [];
  if (!GM.memoryArchive) GM.memoryArchive = [];
  if (!GM.chronicleAfterwords) GM.chronicleAfterwords = [];
  if (!GM.customPolicies) GM.customPolicies = [];
  if (!GM.affinityMap) GM.affinityMap = {};
  if (!GM.offendGroupScores) GM.offendGroupScores = {};
  if (!GM.activeRebounds) GM.activeRebounds = [];
  if (!GM.triggeredOffendEvents) GM.triggeredOffendEvents = {};
  if (!GM._tyrantDecadence) GM._tyrantDecadence = 0;
  if (!GM._tyrantHistory) GM._tyrantHistory = [];
  if (!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
  if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
  if (!GM.families) GM.families = {};
  if (!GM.memoryAnchors) GM.memoryAnchors = [];
  if (!GM.provinceStats) GM.provinceStats = {};
  if (!GM.eraStateHistory) GM.eraStateHistory = [];
  if (!GM.pendingConsequences) GM.pendingConsequences = [];
  if (!GM.turnChanges) GM.turnChanges = { variables: [], characters: [], factions: [], parties: [], classes: [], military: [], map: [] };
  if (!GM.historicalEvents) GM.historicalEvents = [];
  if (!GM.playerPendingTasks) GM.playerPendingTasks = [];
  if (!GM.factionRelations) GM.factionRelations = [];
  if (!GM.factionEvents) GM.factionEvents = [];
  if (!GM._factionHistory) GM._factionHistory = [];
  if (!GM._factionUndercurrents) GM._factionUndercurrents = [];
  if (!GM._factionUndercurrentsHistory) GM._factionUndercurrentsHistory = [];
  if (!GM._courtRecords) GM._courtRecords = [];
  if (!GM.activeSchemes) GM.activeSchemes = [];
  // 方案新增字段
  if (!GM._edictTracker) GM._edictTracker = [];
  if (!GM._plotThreads) GM._plotThreads = [];
  if (!GM._decisionEchoes) GM._decisionEchoes = [];
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  if (!GM._approvedMemorials) GM._approvedMemorials = [];
  if (!GM._achievements) GM._achievements = [];
  // N4: 主角精力系统
  if (GM._energy === undefined) GM._energy = 100;
  if (GM._energyMax === undefined) GM._energyMax = 100;
  // E2: 考课历史
  if (!GM._annualReviewHistory) GM._annualReviewHistory = [];
  // P7: 科举待铨队列
  if (!GM._kejuPendingAssignment) GM._kejuPendingAssignment = [];
  // 阶段一：叙事事实可变层
  if (!GM._mutableFacts) GM._mutableFacts = [];
  // 阶段一：时代双进度条
  if (!GM.eraProgress) GM.eraProgress = { collapse: 0, restoration: 0 };
  // 阶段一：外部威胁聚合
  if (GM.borderThreat === undefined) GM.borderThreat = 0;
  if (!GM.monthlyChronicles) GM.monthlyChronicles = [];
  if (!GM.yearlyChronicles) GM.yearlyChronicles = [];
  if (!GM._aiMemorySummaries) GM._aiMemorySummaries = [];
}

// 确保 P 所有字段存在默认值
function _ensurePDefaults() {
  if (!P.ai) P.ai = {};
  if (!P.classes) P.classes = [];
  if (!P.externalForces) P.externalForces = [];
  if (!P.techTree) P.techTree = [];
  if (!P.civicTree) P.civicTree = [];
  if (!P.officeConfig) P.officeConfig = { costVariables: [], shortfallEffects: '' };
  if (!P.world) P.world = { history: '', politics: '', economy: '', military: '', culture: '', glossary: '', entries: [], rules: '' };
  if (!P.world.entries) P.world.entries = [];
  if (!P.officeDeptLinks) P.officeDeptLinks = [];
  if (!P.relations) P.relations = [];
  if (!P.events) P.events = [];
  if (!P.items) P.items = [];
  if (!P.characters) P.characters = [];
  if (!P.factions) P.factions = [];
  if (!P.parties) P.parties = [];
  if (!P.variables) P.variables = [];
  // 确保公式索引存在
  if (P.variables && !Array.isArray(P.variables) && P.variables.formulas) {
    P._varFormulas = P.variables.formulas;
  }
  if (!P._varFormulas) P._varFormulas = [];
  if (!P.conf) P.conf = {};
  if (!P.conf.verbosity) P.conf.verbosity = 'standard';
  // 阶段一：mechanicsConfig默认值
  if (!P.mechanicsConfig) P.mechanicsConfig = {};
  var mc = P.mechanicsConfig;
  // 编年史白名单——默认只含朝代无关的通用事件类型
  // 朝代特有的（科举/朝议/和亲/改元等）应由编辑器在剧本中配置追加
  // 剧本编辑参考（勿机械读取——即使是唐朝帝制剧本也不应原样照搬，须按实际剧本需要取舍）：
  //   唐朝帝制剧本可追加 '科举','朝议','改元','和亲'
  if (!mc.chronicleWhitelist) mc.chronicleWhitelist = ['继承','宣战','任命','罢免','叛乱','阴谋','驾崩','灾荒','大捷'];
  // 季度议程——模板由编辑器配置，默认空（不预设任何朝代特定议题）
  // 效果由AI在推演中判断，options中不含effect字段
  if (!mc.agendaTemplates) mc.agendaTemplates = [];
  // 时代进度规则——默认空
  // 编辑器应根据剧本定义的变量配置衰退/中兴规则
  if (!mc.eraProgress) mc.eraProgress = {
    collapseRules: [],
    restorationRules: [],
    collapseThreshold: 100, restorationThreshold: 100
  };
  if (!mc.borderThreat) mc.borderThreat = { warningThreshold: 60, criticalThreshold: 80, softFloor: { threshold: 20, damping: 0.5 } };

  // 阶段二：核心机制增强默认值
  // 2.1 状态耦合规则——默认空数组，仅在编辑器明确配置时才生效
  // 不预设任何朝代特定的耦合逻辑，由AI在推演中自行判断级联效应
  if (!mc.couplingRules) mc.couplingRules = [];
  // 2.2 诏令效果完全由AI判断，不做机械关键词匹配（天命是AI游戏，非崇祯式单机）
  // 2.3 执行率管线——默认空（仅供AI参考的情境信息，不做机械折扣）
  // 编辑器应根据剧本朝代配置具体层级
  // 剧本编辑参考（勿机械读取——即使是对应朝代也不应原样照搬，须按实际官制设计调整）：
  //   唐朝：[{name:'中书门下',functionKey:'central_admin'},{name:'御史台',functionKey:'censorate'},
  //          {name:'六部',functionKey:null},{name:'地方州县',functionKey:'local_admin'}]
  //   秦汉：[{name:'丞相府',functionKey:'central_admin'},{name:'九卿',functionKey:null},
  //          {name:'郡县',functionKey:'local_admin'}]
  if (!mc.executionPipeline) mc.executionPipeline = [];
  if (mc.executionFloor === undefined) mc.executionFloor = 0.35;

  // 阶段三：深度系统重构默认值
  // 3.1 NPC行为意图分析——行为类型和配置由编辑器定义，默认空
  if (!mc.npcBehaviorTypes) mc.npcBehaviorTypes = [];
  if (!mc.npcIntentConfig) mc.npcIntentConfig = {
    highImportanceIntervalDays: 15,   // 高重要度NPC意图分析间隔（天）
    midImportanceIntervalDays: 45,    // 中重要度
    lowImportanceIntervalDays: 90     // 低重要度
  };
  // 3.2 月度编年史配置
  if (!mc.chronicleConfig) mc.chronicleConfig = {
    monthlyWordLimit: 200,
    yearlyWordLimit: 2000,
    narratorRole: '史官'
  };

  // 阶段四：生态完善默认值
  // 4.1 政策树——编辑器配置前置依赖链，效果由AI判断
  if (!mc.policyTree) mc.policyTree = [];
  // 4.3 战斗系统——兵种和阶段由编辑器配置
  if (!P.militaryConfig) P.militaryConfig = {};
  if (!P.militaryConfig.unitTypes) P.militaryConfig.unitTypes = [];
  if (!P.militaryConfig.battlePhases) P.militaryConfig.battlePhases = [
    { id: 'deploy', name: '部署' },
    { id: 'clash', name: '交锋' },
    { id: 'decisive', name: '决战' }
  ];
  if (!P.militaryConfig.momentumConfig) P.militaryConfig.momentumConfig = { winGain: 0.15, losePenalty: 0.15, max: 1.5, min: 0.6 };
  // 4.4 角色模型扩展——health/virtue/legitimacy规则由编辑器配置
  if (!mc.characterRules) mc.characterRules = {};
  if (!mc.characterRules.healthConfig) mc.characterRules.healthConfig = {
    monthlyDecay: 0.1,
    ageAccelThreshold: 60,
    ageAccelRate: 0.3
  };
  // virtue/legitimacy规则默认空——不预设任何朝代特定公式
  if (!mc.characterRules.virtueRules) mc.characterRules.virtueRules = [];
  if (!mc.characterRules.legitimacyRules) mc.characterRules.legitimacyRules = [];
  // 4.6 重大决策——编辑器配置决策类型和条件
  if (!mc.decisions) mc.decisions = [];
}

// 统一的存档前准备函数——所有存档路径都必须调用此函数
function _prepareGMForSave() {
  // 系统序列化
  // 注意：GM._chronicle是编年事件数组，不可与ChronicleSystem的月/年摘要对象混用——分开存
  GM._chronicleSysState = typeof ChronicleSystem !== 'undefined' ? ChronicleSystem.serialize() : null;
  GM._warTruces = typeof WarWeightSystem !== 'undefined' ? WarWeightSystem.serialize() : null;
  GM._rngState = typeof getRngState === 'function' ? getRngState() : null;
  // 亲疏/得罪/反弹/观感
  if (GM.affinityMap) GM._savedAffinityMap = _safeClone(GM.affinityMap);
  if (GM.offendGroupScores) GM._savedOffendScores = _safeClone(GM.offendGroupScores);
  if (GM.activeRebounds) GM._savedActiveRebounds = _safeClone(GM.activeRebounds);
  if (GM.triggeredOffendEvents) GM._savedTriggeredOffend = _safeClone(GM.triggeredOffendEvents);
  if (typeof OpinionSystem !== 'undefined' && OpinionSystem.getAllEventOpinions) GM._savedEventOpinions = OpinionSystem.getAllEventOpinions();
  // 昏君/变量映射/后宫/家族/AI记忆
  if (GM._tyrantDecadence) GM._savedTyrantDecadence = GM._tyrantDecadence;
  if (GM._tyrantHistory && GM._tyrantHistory.length > 0) GM._savedTyrantHistory = _safeClone(GM._tyrantHistory);
  if (GM._varMapping) GM._savedVarMapping = _safeClone(GM._varMapping);
  if (GM.harem) GM._savedHarem = _safeClone(GM.harem);
  if (GM.families) GM._savedFamilies = _safeClone(GM.families);
  if (GM._varFormulas && GM._varFormulas.length > 0) GM._savedVarFormulas = _safeClone(GM._varFormulas);
  if (GM._foreshadows) GM._savedForeshadows = _safeClone(GM._foreshadows);
  if (GM._aiMemory) GM._savedAiMemory = _safeClone(GM._aiMemory);
  // 矛盾演化系统
  if (GM._contradictions && GM._contradictions.length > 0) GM._savedContradictions = _safeClone(GM._contradictions);
  // 鸿雁传书+京城
  if (GM.letters && GM.letters.length > 0) GM._savedLetters = _safeClone(GM.letters);
  if (GM._capital) GM._savedCapital = GM._capital;
  if (GM._currentTrend) GM._savedTrend = GM._currentTrend;
  // 新增：保存更多运行时系统数据
  if (GM.characterArcs && Object.keys(GM.characterArcs).length > 0) GM._savedCharacterArcs = _safeClone(GM.characterArcs);
  if (GM.playerDecisions && GM.playerDecisions.length > 0) GM._savedPlayerDecisions = _safeClone(GM.playerDecisions);
  if (GM.memoryArchive && GM.memoryArchive.length > 0) GM._savedMemoryArchive = _safeClone(GM.memoryArchive);
  if (GM.chronicleAfterwords && GM.chronicleAfterwords.length > 0) GM._savedChronicleAfterwords = _safeClone(GM.chronicleAfterwords);
  if (GM.customPolicies && GM.customPolicies.length > 0) GM._savedCustomPolicies = _safeClone(GM.customPolicies);
  if (GM.memoryAnchors && GM.memoryAnchors.length > 0) GM._savedMemoryAnchors = _safeClone(GM.memoryAnchors);
  if (GM.provinceStats && Object.keys(GM.provinceStats).length > 0) GM._savedProvinceStats = _safeClone(GM.provinceStats);
  if (GM.eraState) GM._savedEraState = _safeClone(GM.eraState);
  if (GM.eraStateHistory && GM.eraStateHistory.length > 0) GM._savedEraStateHistory = _safeClone(GM.eraStateHistory);
  if (GM.postSystem) GM._savedPostSystem = _safeClone(GM.postSystem);
  // 存档6大系统配置（P层存放但需跟随GM存盘）
  if (P.vassalSystem) GM._savedVassalSystem = _safeClone(P.vassalSystem);
  if (P.titleSystem) GM._savedTitleSystem = _safeClone(P.titleSystem);
  if (P.buildingSystem) GM._savedBuildingSystem = _safeClone(P.buildingSystem);
  if (P.adminHierarchy) GM._savedAdminHierarchy = _safeClone(P.adminHierarchy);
  if (P.keju) GM._savedKeju = _safeClone(P.keju);
  if (P.officialVassalMapping) GM._savedOfficialVassalMapping = _safeClone(P.officialVassalMapping);
  if (P.government) GM._savedGovernment = _safeClone(P.government);
  if (GM.eraNames) GM._savedEraNames = _safeClone(GM.eraNames);
  if (GM._aiScenarioDigest) GM._savedAiDigest = _safeClone(GM._aiScenarioDigest);
  // 诏令追踪
  if (GM._edictTracker) GM._savedEdictTracker = _safeClone(GM._edictTracker);
  // 诏令草稿（玩家当前 tab 输入中的文字——防止存档丢失）
  var _eDrafts = {};
  ['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth','xinglu-pub'].forEach(function(id) {
    var el = typeof _$ === 'function' ? _$(id) : document.getElementById(id);
    if (el && typeof el.value === 'string' && el.value.trim()) _eDrafts[id] = el.value;
  });
  if (Object.keys(_eDrafts).length > 0) GM._savedEdictDrafts = _eDrafts;
  else delete GM._savedEdictDrafts;
  // 事件总线
  if (typeof StoryEventBus !== 'undefined') GM._savedEventBus = StoryEventBus.serialize();
  // 恩怨/门生/阴谋
  if (GM.enYuanRecords) GM._savedEnYuanRecords = _safeClone(GM.enYuanRecords);
  if (GM.patronNetwork) GM._savedPatronNetwork = _safeClone(GM.patronNetwork);
  if (GM.activeSchemes) GM._savedActiveSchemes = _safeClone(GM.activeSchemes);
  if (GM.yearlyChronicles) GM._savedYearlyChronicles = _safeClone(GM.yearlyChronicles);
  if (GM.monthlyChronicles) GM._savedMonthlyChronicles = _safeClone(GM.monthlyChronicles);
  if (GM._aiMemorySummaries) GM._savedAiMemorySummaries = _safeClone(GM._aiMemorySummaries);
  if (GM.schemeCooldowns) GM._savedSchemeCooldowns = _safeClone(GM.schemeCooldowns);
  if (GM.eventCooldowns) GM._savedEventCooldowns = _safeClone(GM.eventCooldowns);
  // 战斗/行军/围城系统运行时数据
  if (GM.marchOrders) GM._savedMarchOrders = _safeClone(GM.marchOrders);
  if (GM.activeSieges) GM._savedActiveSieges = _safeClone(GM.activeSieges);
  if (GM.activeBattles) GM._savedActiveBattles = _safeClone(GM.activeBattles);
  if (GM.battleHistory) GM._savedBattleHistory = _safeClone(GM.battleHistory);
  if (GM.activeWars) GM._savedActiveWars = _safeClone(GM.activeWars);
  if (GM.treaties) GM._savedTreaties = _safeClone(GM.treaties);
  if (GM._diplomaticMissions) GM._savedDiplomaticMissions = _safeClone(GM._diplomaticMissions);
  if (GM._foreshadowings) GM._savedForeshadowings = _safeClone(GM._foreshadowings);
  if (GM._tensionHistory) GM._savedTensionHistory = _safeClone(GM._tensionHistory);
  if (GM._yearlyDigest) GM._savedYearlyDigest = _safeClone(GM._yearlyDigest);
  if (GM._metricHistory) GM._savedMetricHistory = _safeClone(GM._metricHistory);
  if (GM._militaryReform) GM._savedMilitaryReform = _safeClone(GM._militaryReform);
  if (GM._rngCheckpoints) GM._savedRngCheckpoints = _safeClone(GM._rngCheckpoints);
  // 新增系统字段保存
  if (GM._energy !== undefined) GM._savedEnergy = GM._energy;
  if (GM._energyMax !== undefined) GM._savedEnergyMax = GM._energyMax;
  if (GM._annualReviewHistory) GM._savedAnnualReviewHistory = _safeClone(GM._annualReviewHistory);
  if (GM._kejuPendingAssignment) GM._savedKejuPending = _safeClone(GM._kejuPendingAssignment);
  if (GM._successionEvent) GM._savedSuccessionEvent = _safeClone(GM._successionEvent);
  // 阶段一新字段保存
  if (GM._mutableFacts) GM._savedMutableFacts = _safeClone(GM._mutableFacts);
  if (GM._lostTerritories) GM._savedLostTerritories = _safeClone(GM._lostTerritories);
  if (GM.currentIssues) GM._savedCurrentIssues = _safeClone(GM.currentIssues);
  if (GM._aiDispatchStats) GM._savedAiDispatchStats = _safeClone(GM._aiDispatchStats);
  if (GM._npcClaims) GM._savedNpcClaims = _safeClone(GM._npcClaims);
  if (GM._eavesdroppedTopics) GM._savedEavesdroppedTopics = _safeClone(GM._eavesdroppedTopics);
  if (GM._interceptedIntel) GM._savedInterceptedIntel = _safeClone(GM._interceptedIntel);
  if (GM._undeliveredLetters) GM._savedUndeliveredLetters = _safeClone(GM._undeliveredLetters);
  if (GM._letterSuspects) GM._savedLetterSuspects = _safeClone(GM._letterSuspects);
  if (GM._courierStatus) GM._savedCourierStatus = _safeClone(GM._courierStatus);
  if (GM._pendingNpcLetters && GM._pendingNpcLetters.length > 0) GM._savedPendingNpcLetters = _safeClone(GM._pendingNpcLetters);
  if (GM._pendingMemorialDeliveries && GM._pendingMemorialDeliveries.length > 0) GM._savedPendingMemDeliveries = _safeClone(GM._pendingMemorialDeliveries);
  if (GM._pendingNpcCorrespondence && GM._pendingNpcCorrespondence.length > 0) GM._savedPendingNpcCorr = _safeClone(GM._pendingNpcCorrespondence);
  if (GM._officeCollapsed) GM._savedOfficeCollapsed = _safeClone(GM._officeCollapsed);
  if (GM._wdState && Object.keys(GM._wdState).length > 0) GM._savedWdState = _safeClone(GM._wdState);
  if (GM._playerDirectives && GM._playerDirectives.length > 0) GM._savedPlayerDirectives = _safeClone(GM._playerDirectives);
  if (GM._importedMemories && GM._importedMemories.length > 0) GM._savedImportedMemories = _safeClone(GM._importedMemories);
  if (GM._wentianHistory && GM._wentianHistory.length > 0) GM._savedWentianHistory = _safeClone(GM._wentianHistory);
  // 新增：记忆系统持久化（A1 + B2 + B1 校验器日志）
  if (GM._memoryLayers && (GM._memoryLayers.L2 && GM._memoryLayers.L2.length || GM._memoryLayers.L3 && GM._memoryLayers.L3.length)) GM._savedMemoryLayers = _safeClone(GM._memoryLayers);
  if (GM._epitaphs && GM._epitaphs.length > 0) GM._savedEpitaphs = _safeClone(GM._epitaphs);
  if (GM._fakeDeathHolding && Object.keys(GM._fakeDeathHolding).length > 0) GM._savedFakeDeathHolding = _safeClone(GM._fakeDeathHolding);
  if (GM._fiscalValidatorLog && GM._fiscalValidatorLog.length > 0) GM._savedFiscalValidatorLog = _safeClone(GM._fiscalValidatorLog);
  // M1-M4 新增字段
  // 清理 ephemeral post-turn 任务（Promise 不可序列化）
  if (GM._postTurnJobs) delete GM._postTurnJobs;
  // 无上限保护：_memoryArchiveFull 保留最近 5000 条（约 100-200 回合全记忆）
  if (GM._memoryArchiveFull && GM._memoryArchiveFull.length > 5000) {
    GM._memoryArchiveFull = GM._memoryArchiveFull.slice(-5000);
  }
  if (GM._memoryArchiveFull && GM._memoryArchiveFull.length > 0) GM._savedMemoryArchiveFull = _safeClone(GM._memoryArchiveFull);
  if (GM._causalGraph && (GM._causalGraph.nodes && GM._causalGraph.nodes.length || GM._causalGraph.edges && GM._causalGraph.edges.length)) GM._savedCausalGraph = _safeClone(GM._causalGraph);
  if (GM._factionArcs && Object.keys(GM._factionArcs).length > 0) GM._savedFactionArcs = _safeClone(GM._factionArcs);
  if (GM._aiReflections && GM._aiReflections.length > 0) GM._savedAiReflections = _safeClone(GM._aiReflections);
  if (GM._lastTurnPredictions) GM._savedLastTurnPredictions = _safeClone(GM._lastTurnPredictions);
  // per-char：arcs + relationHistory
  if (GM.chars) {
    var _charMemExt = {};
    GM.chars.forEach(function(c) {
      if (!c || !c.name) return;
      var e = {};
      if (Array.isArray(c._arcs) && c._arcs.length > 0) e.arcs = _safeClone(c._arcs);
      if (c._relationHistory && Object.keys(c._relationHistory).length > 0) e.relationHistory = _safeClone(c._relationHistory);
      if (Object.keys(e).length > 0) _charMemExt[c.name] = e;
    });
    if (Object.keys(_charMemExt).length > 0) GM._savedCharMemExt = _charMemExt;
  }
  if (GM._chronicle && GM._chronicle.length > 0) GM._savedChronicle = _safeClone(GM._chronicle);
  if (GM._wdRewardPunish && GM._wdRewardPunish.length > 0) GM._savedWdRewardPunish = _safeClone(GM._wdRewardPunish);
  if (GM._lastEvalTurn) GM._savedLastEvalTurn = GM._lastEvalTurn;
  // 角色官制字段批量保存
  if (GM.chars) {
    var _charOfficeFields = {};
    GM.chars.forEach(function(c) {
      var f = {};
      if (c._mourning) f.mourning = _safeClone(c._mourning);
      if (c._retired) f.retired = true;
      if (c._retireTurn) f.retireTurn = c._retireTurn;
      if (c._recommendedBy) f.recommendedBy = c._recommendedBy;
      if (c._recommendTurn) f.recommendTurn = c._recommendTurn;
      if (c._mourningOldPost) f.mourningOldPost = _safeClone(c._mourningOldPost);
      if (c._mourningDismissed) f.mourningDismissed = true;
      if (Object.keys(f).length > 0) _charOfficeFields[c.name] = f;
    });
    if (Object.keys(_charOfficeFields).length > 0) GM._savedCharOfficeFields = _charOfficeFields;
  }
  if (GM._routeDisruptions && GM._routeDisruptions.length > 0) GM._savedRouteDisruptions = _safeClone(GM._routeDisruptions);
  if (GM._npcCorrespondence && GM._npcCorrespondence.length > 0) GM._savedNpcCorrespondence = _safeClone(GM._npcCorrespondence);
  if (GM.eraProgress) GM._savedEraProgress = _safeClone(GM.eraProgress);
  if (GM.borderThreat !== undefined) GM._savedBorderThreat = GM.borderThreat;
  if (P.officeConfig) GM._savedOfficeConfig = _safeClone(P.officeConfig);
  // 存档建筑运行时数据（GM层）
  if (GM.buildings && GM.buildings.length > 0) GM._savedBuildings = _safeClone(GM.buildings);
  if (GM.buildingQueue && GM.buildingQueue.length > 0) GM._savedBuildingQueue = _safeClone(GM.buildingQueue);
  if (GM.mapData) GM._savedMapData = _safeClone(GM.mapData);
  if (GM.npcContext) GM._savedNpcContext = _safeClone(GM.npcContext);
  if (GM.pendingConsequences && GM.pendingConsequences.length > 0) GM._savedPendingConsequences = _safeClone(GM.pendingConsequences);
  if (GM.factionRelations && GM.factionRelations.length > 0) GM._savedFactionRelations = _safeClone(GM.factionRelations);
  if (GM.factionEvents && GM.factionEvents.length > 0) GM._savedFactionEvents = _safeClone(GM.factionEvents);
  if (GM._factionHistory && GM._factionHistory.length > 0) GM._savedFactionHistory = _safeClone(GM._factionHistory);
  if (GM._factionUndercurrentsHistory && GM._factionUndercurrentsHistory.length > 0) GM._savedFacUndHist = _safeClone(GM._factionUndercurrentsHistory);
  if (GM._factionUndercurrents && GM._factionUndercurrents.length > 0) GM._savedFacUndercurrents = _safeClone(GM._factionUndercurrents);
  if (GM._approvedMemorials && GM._approvedMemorials.length > 0) GM._savedApprovedMemorials = _safeClone(GM._approvedMemorials);
  if (GM._courtRecords && GM._courtRecords.length > 0) GM._savedCourtRecords = _safeClone(GM._courtRecords);
  if (GM._plotThreads && GM._plotThreads.length > 0) GM._savedPlotThreads = _safeClone(GM._plotThreads);
  if (GM._decisionEchoes && GM._decisionEchoes.length > 0) GM._savedDecisionEchoes = _safeClone(GM._decisionEchoes);
  if (GM._edictSuggestions && GM._edictSuggestions.length > 0) GM._savedEdictSuggestions = _safeClone(GM._edictSuggestions);
  // 文事系统存档
  if (GM.culturalWorks && GM.culturalWorks.length > 0) GM._savedCulturalWorks = _safeClone(GM.culturalWorks);
  if (GM._forgottenWorks && GM._forgottenWorks.length > 0) GM._savedForgottenWorks = _safeClone(GM._forgottenWorks);
  if (GM.factionRelationsMap && Object.keys(GM.factionRelationsMap).length > 0) GM._savedFactionRelationsMap = _safeClone(GM.factionRelationsMap);
  if (GM._edictLifecycle && GM._edictLifecycle.length > 0) GM._savedEdictLifecycle = _safeClone(GM._edictLifecycle);
  if (GM._activeRevolts && GM._activeRevolts.length > 0) GM._savedActiveRevolts = _safeClone(GM._activeRevolts);
  if (GM._revoltPrecursors && GM._revoltPrecursors.length > 0) GM._savedRevoltPrecursors = _safeClone(GM._revoltPrecursors);
  if (GM._npcCommitments && Object.keys(GM._npcCommitments).length > 0) GM._savedNpcCommitments = _safeClone(GM._npcCommitments);
  if (GM._secretMeetings && GM._secretMeetings.length > 0) GM._savedSecretMeetings = _safeClone(GM._secretMeetings);
  if (GM._achievements && GM._achievements.length > 0) GM._savedAchievements = _safeClone(GM._achievements);
  // 7.4: 历史索引
  if (GM._historyIndex) GM._savedHistoryIndex = _safeClone(GM._historyIndex);
  if (GM._historyIndexCursor) GM._savedHistoryIndexCursor = GM._historyIndexCursor;
  // 确保所有字段有默认值
  _ensureGMDefaults();
  _ensurePDefaults();
  if (typeof buildCoreMetricLabels === 'function') buildCoreMetricLabels();
}

doSaveGame=async function(){
  if(!GM.running){toast("\u8BF7\u5148\u5F00\u59CB\u6E38\u620F");return;}
  _prepareGMForSave();

  if(window.tianming&&window.tianming.isDesktop){
    // 桌面端：面板UI
    var sc=findScenarioById(GM.sid);
    var defName=GM.saveName||("T"+GM.turn+"_"+(sc?sc.name:"save"));
    var list=await window.tianming.listSaves();
    var files=list.success?list.files.filter(function(f){return f.name!=="__autosave__";}):[];
    files.sort(function(a,b){return (b.modified||0)-(a.modified||0);});
    var html='<div style="padding:1.5rem;max-width:520px;margin:auto">';
    html+='<h2 style="color:var(--gold);margin-bottom:1rem">\u4FDD\u5B58\u6E38\u620F</h2>';
    html+='<label style="display:block;margin-bottom:0.4rem;color:var(--txt-s)">\u5B58\u6863\u540D</label>';
    html+='<input id="save-name-inp" class="inp" style="width:100%;margin-bottom:0.8rem" value="'+defName+'">';
    html+='<button class="btn" style="margin-bottom:1.2rem" onclick="desktopDoSave()">\u4FDD\u5B58</button>';
    if(files.length){
      html+='<h4 style="color:var(--txt-d);margin-bottom:0.5rem">\u8986\u76D6\u73B0\u6709\u5B58\u6863</h4>';
      html+='<div style="max-height:220px;overflow-y:auto">';
      files.forEach(function(f){
        var meta=f.meta||{};
        var sub=(meta.scenario?'\u5267\u672C:'+meta.scenario+' ':'')+(meta.turn?'T'+meta.turn:'');
        html+='<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;background:var(--bg-3);border-radius:6px;padding:0.4rem 0.75rem">';
        html+='<div style="flex:1;min-width:0">';
        html+='<div style="color:var(--txt-s);font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</div>';
        html+='<div style="color:var(--txt-d);font-size:0.72rem">'+f.modifiedStr+(sub?' &nbsp;\u00b7 '+sub:'')+'</div>';
        html+='</div>';
        html+='<button style="padding:0.15rem 0.6rem;border:none;border-radius:4px;background:var(--gold);color:#111;cursor:pointer;font-size:0.78rem;font-family:inherit" '+'onclick="_$(\"save-name-inp\").value='+JSON.stringify(f.name)+';desktopDoSave()">\u8986\u76D6</button>';
        html+='</div>';
      });
      html+='</div>';
    }
    html+='<button class="btn" style="margin-top:1rem" onclick="enterGame()">\u53D6\u6D88</button>';
    html+='</div>';
    showPanel(html);
    _$('G').style.display='none';
  }else{
    // 浏览器端：直接导出
    var sc2=findScenarioById(GM.sid);
    var name="T"+GM.turn+"_"+(sc2?sc2.name:"save")+"_"+new Date().toISOString().slice(0,10);
    var saveData2=deepClone(P);
    saveData2.gameState=deepClone(GM);
    saveData2._saveMeta={name:name,turn:GM.turn,time:getTSText(GM.turn),scenario:sc2?sc2.name:"",date:new Date().toISOString(),version:P.meta.v};
    var blob=new Blob([JSON.stringify(saveData2,null,2)],{type:"application/json"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+".json";a.click();
    toast("\u2705 \u5DF2\u5BFC\u51FA: "+name+".json");
  }
};

window.desktopDoSave=async function(){
  var name=(_$("save-name-inp").value||"").trim();
  if(!name){toast("\u8BF7\u8F93\u5165\u5B58\u6863\u540D");return;}
  var sc=findScenarioById(GM.sid);
  _prepareGMForSave(); // 序列化所有系统数据+确保GM/P字段默认值
  var saveData=deepClone(P);
  saveData.gameState=deepClone(GM);
  saveData._saveMeta={name:name,turn:GM.turn,time:getTSText(GM.turn),scenario:sc?sc.name:"",date:new Date().toISOString(),version:P.meta.v};
  try{
    var r=await window.tianming.saveProject(name,saveData);
    if(r.success){GM.saveName=name;toast("\u2705 \u5DF2\u4FDD\u5B58");enterGame();}
    else toast("\u5931\u8D25: "+(r.error||""));
  }catch(e){toast("\u5931\u8D25: "+e.message);}
};

// 2. 读档：完整恢复所有状态

// 统一恢复所有_saved*字段到运行时字段
function _restoreSavedFields() {
  // 亲疏/得罪/反弹/观感
  if (GM._savedAffinityMap) { GM.affinityMap = GM._savedAffinityMap; delete GM._savedAffinityMap; }
  if (GM._savedOffendScores) { GM.offendGroupScores = GM._savedOffendScores; delete GM._savedOffendScores; }
  if (GM._savedActiveRebounds) { GM.activeRebounds = GM._savedActiveRebounds; delete GM._savedActiveRebounds; }
  if (GM._savedTriggeredOffend) { GM.triggeredOffendEvents = GM._savedTriggeredOffend; delete GM._savedTriggeredOffend; }
  if (GM._savedEventOpinions && typeof OpinionSystem !== 'undefined' && OpinionSystem.restoreEventOpinions) {
    OpinionSystem.restoreEventOpinions(GM._savedEventOpinions);
    delete GM._savedEventOpinions;
  }
  // 昏君/变量映射/后宫/家族/AI记忆
  if (GM._savedTyrantDecadence) { GM._tyrantDecadence = GM._savedTyrantDecadence; delete GM._savedTyrantDecadence; }
  if (GM._savedTyrantHistory) { GM._tyrantHistory = GM._savedTyrantHistory; delete GM._savedTyrantHistory; }
  if (GM._savedVarMapping) { GM._varMapping = GM._savedVarMapping; delete GM._savedVarMapping; }
  if (GM._savedHarem) { GM.harem = GM._savedHarem; delete GM._savedHarem; }
  if (GM._savedFamilies) { GM.families = GM._savedFamilies; delete GM._savedFamilies; }
  if (GM._savedVarFormulas) { GM._varFormulas = GM._savedVarFormulas; delete GM._savedVarFormulas; }
  if (GM._savedForeshadows) { GM._foreshadows = GM._savedForeshadows; delete GM._savedForeshadows; }
  if (GM._savedAiMemory) { GM._aiMemory = GM._savedAiMemory; delete GM._savedAiMemory; }
  if (GM._savedTrend) { GM._currentTrend = GM._savedTrend; delete GM._savedTrend; }
  // 新增的_saved*字段恢复
  if (GM._savedCharacterArcs) { GM.characterArcs = GM._savedCharacterArcs; delete GM._savedCharacterArcs; }
  if (GM._savedPlayerDecisions) { GM.playerDecisions = GM._savedPlayerDecisions; delete GM._savedPlayerDecisions; }
  if (GM._savedMemoryArchive) { GM.memoryArchive = GM._savedMemoryArchive; delete GM._savedMemoryArchive; }
  if (GM._savedChronicleAfterwords) { GM.chronicleAfterwords = GM._savedChronicleAfterwords; delete GM._savedChronicleAfterwords; }
  if (GM._savedCustomPolicies) { GM.customPolicies = GM._savedCustomPolicies; delete GM._savedCustomPolicies; }
  if (GM._savedMemoryAnchors) { GM.memoryAnchors = GM._savedMemoryAnchors; delete GM._savedMemoryAnchors; }
  if (GM._savedProvinceStats) { GM.provinceStats = GM._savedProvinceStats; delete GM._savedProvinceStats; }
  if (GM._savedEraState) { GM.eraState = GM._savedEraState; delete GM._savedEraState; }
  if (GM._savedEraStateHistory) { GM.eraStateHistory = GM._savedEraStateHistory; delete GM._savedEraStateHistory; }
  if (GM._savedPostSystem) { GM.postSystem = GM._savedPostSystem; delete GM._savedPostSystem; }
  // 恢复6大系统配置到P
  if (GM._savedVassalSystem) { P.vassalSystem = GM._savedVassalSystem; delete GM._savedVassalSystem; }
  if (GM._savedTitleSystem) { P.titleSystem = GM._savedTitleSystem; delete GM._savedTitleSystem; }
  if (GM._savedBuildingSystem) { P.buildingSystem = GM._savedBuildingSystem; delete GM._savedBuildingSystem; }
  if (GM._savedAdminHierarchy) { P.adminHierarchy = GM._savedAdminHierarchy; delete GM._savedAdminHierarchy; }
  if (GM._savedKeju) { P.keju = GM._savedKeju; delete GM._savedKeju; }
  if (GM._savedOfficialVassalMapping) { P.officialVassalMapping = GM._savedOfficialVassalMapping; delete GM._savedOfficialVassalMapping; }
  if (GM._savedGovernment) { P.government = GM._savedGovernment; delete GM._savedGovernment; }
  // 矛盾演化系统
  if (GM._savedContradictions) { GM._contradictions = GM._savedContradictions; delete GM._savedContradictions; }
  // 鸿雁传书+京城
  if (GM._savedLetters) { GM.letters = GM._savedLetters; delete GM._savedLetters; }
  if (GM._savedCapital) { GM._capital = GM._savedCapital; delete GM._savedCapital; }
  if (GM._savedEraNames) { GM.eraNames = GM._savedEraNames; delete GM._savedEraNames; }
  if (GM._savedAiDigest) { GM._aiScenarioDigest = GM._savedAiDigest; delete GM._savedAiDigest; }
  // 恢复诏令追踪字段
  if (GM._savedEdictTracker) { GM._edictTracker = GM._savedEdictTracker; delete GM._savedEdictTracker; }
  // 恢复诏令草稿到 textarea（延时执行，确保 DOM 已就绪）
  if (GM._savedEdictDrafts) {
    var _drafts = GM._savedEdictDrafts;
    delete GM._savedEdictDrafts;
    setTimeout(function() {
      Object.keys(_drafts).forEach(function(id) {
        var el = typeof _$ === 'function' ? _$(id) : document.getElementById(id);
        if (el) el.value = _drafts[id];
      });
    }, 500);
  }
  // 恢复事件总线
  if (GM._savedEventBus && typeof StoryEventBus !== 'undefined') { StoryEventBus.deserialize(GM._savedEventBus); delete GM._savedEventBus; }
  // 恢复恩怨/门生/阴谋
  if (GM._savedEnYuanRecords) { GM.enYuanRecords = GM._savedEnYuanRecords; delete GM._savedEnYuanRecords; }
  if (GM._savedPatronNetwork) { GM.patronNetwork = GM._savedPatronNetwork; delete GM._savedPatronNetwork; }
  if (GM._savedActiveSchemes) { GM.activeSchemes = GM._savedActiveSchemes; delete GM._savedActiveSchemes; }
  if (GM._savedYearlyChronicles) { GM.yearlyChronicles = GM._savedYearlyChronicles; delete GM._savedYearlyChronicles; }
  if (GM._savedMonthlyChronicles) { GM.monthlyChronicles = GM._savedMonthlyChronicles; delete GM._savedMonthlyChronicles; }
  if (GM._savedAiMemorySummaries) { GM._aiMemorySummaries = GM._savedAiMemorySummaries; delete GM._savedAiMemorySummaries; }
  if (GM._savedSchemeCooldowns) { GM.schemeCooldowns = GM._savedSchemeCooldowns; delete GM._savedSchemeCooldowns; }
  if (GM._savedEventCooldowns) { GM.eventCooldowns = GM._savedEventCooldowns; delete GM._savedEventCooldowns; }
  // 恢复战斗/行军/围城系统运行时数据
  if (GM._savedMarchOrders) { GM.marchOrders = GM._savedMarchOrders; delete GM._savedMarchOrders; }
  if (GM._savedActiveSieges) { GM.activeSieges = GM._savedActiveSieges; delete GM._savedActiveSieges; }
  if (GM._savedActiveBattles) { GM.activeBattles = GM._savedActiveBattles; delete GM._savedActiveBattles; }
  if (GM._savedBattleHistory) { GM.battleHistory = GM._savedBattleHistory; delete GM._savedBattleHistory; }
  if (GM._savedActiveWars) { GM.activeWars = GM._savedActiveWars; delete GM._savedActiveWars; }
  if (GM._savedTreaties) { GM.treaties = GM._savedTreaties; delete GM._savedTreaties; }
  if (GM._savedDiplomaticMissions) { GM._diplomaticMissions = GM._savedDiplomaticMissions; delete GM._savedDiplomaticMissions; }
  if (GM._savedForeshadowings) { GM._foreshadowings = GM._savedForeshadowings; delete GM._savedForeshadowings; }
  if (GM._savedTensionHistory) { GM._tensionHistory = GM._savedTensionHistory; delete GM._savedTensionHistory; }
  if (GM._savedYearlyDigest) { GM._yearlyDigest = GM._savedYearlyDigest; delete GM._savedYearlyDigest; }
  if (GM._savedMetricHistory) { GM._metricHistory = GM._savedMetricHistory; delete GM._savedMetricHistory; }
  if (GM._savedMilitaryReform) { GM._militaryReform = GM._savedMilitaryReform; delete GM._savedMilitaryReform; }
  if (GM._savedRngCheckpoints) { GM._rngCheckpoints = GM._savedRngCheckpoints; delete GM._savedRngCheckpoints; }
  // 恢复新增系统字段
  if (GM._savedEnergy !== undefined) { GM._energy = GM._savedEnergy; delete GM._savedEnergy; }
  if (GM._savedEnergyMax !== undefined) { GM._energyMax = GM._savedEnergyMax; delete GM._savedEnergyMax; }
  if (GM._savedAnnualReviewHistory) { GM._annualReviewHistory = GM._savedAnnualReviewHistory; delete GM._savedAnnualReviewHistory; }
  if (GM._savedKejuPending) { GM._kejuPendingAssignment = GM._savedKejuPending; delete GM._savedKejuPending; }
  if (GM._savedSuccessionEvent) { GM._successionEvent = GM._savedSuccessionEvent; delete GM._savedSuccessionEvent; }
  // 阶段一新字段恢复
  if (GM._savedMutableFacts) { GM._mutableFacts = GM._savedMutableFacts; delete GM._savedMutableFacts; }
  if (GM._savedLostTerritories) { GM._lostTerritories = GM._savedLostTerritories; delete GM._savedLostTerritories; }
  if (GM._savedCurrentIssues) { GM.currentIssues = GM._savedCurrentIssues; delete GM._savedCurrentIssues; }
  if (GM._savedAiDispatchStats) { GM._aiDispatchStats = GM._savedAiDispatchStats; delete GM._savedAiDispatchStats; }
  if (GM._savedNpcClaims) { GM._npcClaims = GM._savedNpcClaims; delete GM._savedNpcClaims; }
  if (GM._savedEavesdroppedTopics) { GM._eavesdroppedTopics = GM._savedEavesdroppedTopics; delete GM._savedEavesdroppedTopics; }
  if (GM._savedInterceptedIntel) { GM._interceptedIntel = GM._savedInterceptedIntel; delete GM._savedInterceptedIntel; }
  if (GM._savedUndeliveredLetters) { GM._undeliveredLetters = GM._savedUndeliveredLetters; delete GM._savedUndeliveredLetters; }
  if (GM._savedLetterSuspects) { GM._letterSuspects = GM._savedLetterSuspects; delete GM._savedLetterSuspects; }
  if (GM._savedCourierStatus) { GM._courierStatus = GM._savedCourierStatus; delete GM._savedCourierStatus; }
  if (GM._savedPendingNpcLetters) { GM._pendingNpcLetters = GM._savedPendingNpcLetters; delete GM._savedPendingNpcLetters; }
  if (GM._savedPendingMemDeliveries) { GM._pendingMemorialDeliveries = GM._savedPendingMemDeliveries; delete GM._savedPendingMemDeliveries; }
  if (GM._savedPendingNpcCorr) { GM._pendingNpcCorrespondence = GM._savedPendingNpcCorr; delete GM._savedPendingNpcCorr; }
  if (GM._savedOfficeCollapsed) { GM._officeCollapsed = GM._savedOfficeCollapsed; delete GM._savedOfficeCollapsed; }
  if (GM._savedWdState) { GM._wdState = GM._savedWdState; delete GM._savedWdState; }
  if (GM._savedPlayerDirectives) { GM._playerDirectives = GM._savedPlayerDirectives; delete GM._savedPlayerDirectives; }
  if (GM._savedImportedMemories) { GM._importedMemories = GM._savedImportedMemories; delete GM._savedImportedMemories; }
  if (GM._savedWentianHistory) { GM._wentianHistory = GM._savedWentianHistory; delete GM._savedWentianHistory; }
  // 新增：记忆系统恢复
  if (GM._savedMemoryLayers) { GM._memoryLayers = GM._savedMemoryLayers; delete GM._savedMemoryLayers; }
  if (GM._savedEpitaphs) { GM._epitaphs = GM._savedEpitaphs; delete GM._savedEpitaphs; }
  if (GM._savedFakeDeathHolding) { GM._fakeDeathHolding = GM._savedFakeDeathHolding; delete GM._savedFakeDeathHolding; }
  if (GM._savedFiscalValidatorLog) { GM._fiscalValidatorLog = GM._savedFiscalValidatorLog; delete GM._savedFiscalValidatorLog; }
  // M1-M4 新增字段
  if (GM._savedMemoryArchiveFull) { GM._memoryArchiveFull = GM._savedMemoryArchiveFull; delete GM._savedMemoryArchiveFull; }
  if (GM._savedCausalGraph) { GM._causalGraph = GM._savedCausalGraph; delete GM._savedCausalGraph; }
  if (GM._savedFactionArcs) { GM._factionArcs = GM._savedFactionArcs; delete GM._savedFactionArcs; }
  if (GM._savedAiReflections) { GM._aiReflections = GM._savedAiReflections; delete GM._savedAiReflections; }
  if (GM._savedLastTurnPredictions) { GM._lastTurnPredictions = GM._savedLastTurnPredictions; delete GM._savedLastTurnPredictions; }
  if (GM._savedCharMemExt && GM.chars) {
    GM.chars.forEach(function(c) {
      if (!c || !c.name) return;
      var e = GM._savedCharMemExt[c.name];
      if (!e) return;
      if (e.arcs) c._arcs = e.arcs;
      if (e.relationHistory) c._relationHistory = e.relationHistory;
    });
    delete GM._savedCharMemExt;
  }
  if (GM._savedChronicle) { GM._chronicle = GM._savedChronicle; delete GM._savedChronicle; }
  if (GM._savedWdRewardPunish) { GM._wdRewardPunish = GM._savedWdRewardPunish; delete GM._savedWdRewardPunish; }
  if (GM._savedLastEvalTurn) { GM._lastEvalTurn = GM._savedLastEvalTurn; delete GM._savedLastEvalTurn; }
  // 恢复角色官制字段
  if (GM._savedCharOfficeFields && GM.chars) {
    GM.chars.forEach(function(c) {
      var f = GM._savedCharOfficeFields[c.name];
      if (!f) return;
      if (f.mourning) c._mourning = f.mourning;
      if (f.retired) c._retired = true;
      if (f.retireTurn) c._retireTurn = f.retireTurn;
      if (f.recommendedBy) c._recommendedBy = f.recommendedBy;
      if (f.recommendTurn) c._recommendTurn = f.recommendTurn;
      if (f.mourningOldPost) c._mourningOldPost = f.mourningOldPost;
      if (f.mourningDismissed) c._mourningDismissed = true;
    });
    delete GM._savedCharOfficeFields;
  }
  if (GM._savedRouteDisruptions) { GM._routeDisruptions = GM._savedRouteDisruptions; delete GM._savedRouteDisruptions; }
  if (GM._savedNpcCorrespondence) { GM._npcCorrespondence = GM._savedNpcCorrespondence; delete GM._savedNpcCorrespondence; }
  if (GM._savedEraProgress) { GM.eraProgress = GM._savedEraProgress; delete GM._savedEraProgress; }
  if (GM._savedBorderThreat !== undefined) { GM.borderThreat = GM._savedBorderThreat; delete GM._savedBorderThreat; }
  if (GM._savedOfficeConfig) { P.officeConfig = GM._savedOfficeConfig; delete GM._savedOfficeConfig; }
  // 恢复建筑运行时数据
  if (GM._savedBuildings) { GM.buildings = GM._savedBuildings; delete GM._savedBuildings; }
  if (GM._savedBuildingQueue) { GM.buildingQueue = GM._savedBuildingQueue; delete GM._savedBuildingQueue; }
  if (GM._savedMapData) { GM.mapData = GM._savedMapData; delete GM._savedMapData; }
  if (GM._savedNpcContext) { GM.npcContext = GM._savedNpcContext; delete GM._savedNpcContext; }
  if (GM._savedPendingConsequences) { GM.pendingConsequences = GM._savedPendingConsequences; delete GM._savedPendingConsequences; }
  if (GM._savedFactionRelations) { GM.factionRelations = GM._savedFactionRelations; delete GM._savedFactionRelations; }
  if (GM._savedFactionEvents) { GM.factionEvents = GM._savedFactionEvents; delete GM._savedFactionEvents; }
  if (GM._savedFactionHistory) { GM._factionHistory = GM._savedFactionHistory; delete GM._savedFactionHistory; }
  if (GM._savedFacUndHist) { GM._factionUndercurrentsHistory = GM._savedFacUndHist; delete GM._savedFacUndHist; }
  if (GM._savedFacUndercurrents) { GM._factionUndercurrents = GM._savedFacUndercurrents; delete GM._savedFacUndercurrents; }
  if (GM._savedApprovedMemorials) { GM._approvedMemorials = GM._savedApprovedMemorials; delete GM._savedApprovedMemorials; }
  if (GM._savedCourtRecords) { GM._courtRecords = GM._savedCourtRecords; delete GM._savedCourtRecords; }
  if (GM._savedPlotThreads) { GM._plotThreads = GM._savedPlotThreads; delete GM._savedPlotThreads; }
  if (GM._savedDecisionEchoes) { GM._decisionEchoes = GM._savedDecisionEchoes; delete GM._savedDecisionEchoes; }
  if (GM._savedEdictSuggestions) { GM._edictSuggestions = GM._savedEdictSuggestions; delete GM._savedEdictSuggestions; }
  if (GM._savedCulturalWorks) { GM.culturalWorks = GM._savedCulturalWorks; delete GM._savedCulturalWorks; }
  if (GM._savedForgottenWorks) { GM._forgottenWorks = GM._savedForgottenWorks; delete GM._savedForgottenWorks; }
  if (GM._savedFactionRelationsMap) { GM.factionRelationsMap = GM._savedFactionRelationsMap; delete GM._savedFactionRelationsMap; }
  if (GM._savedEdictLifecycle) { GM._edictLifecycle = GM._savedEdictLifecycle; delete GM._savedEdictLifecycle; }
  if (GM._savedActiveRevolts) { GM._activeRevolts = GM._savedActiveRevolts; delete GM._savedActiveRevolts; }
  if (GM._savedRevoltPrecursors) { GM._revoltPrecursors = GM._savedRevoltPrecursors; delete GM._savedRevoltPrecursors; }
  if (GM._savedNpcCommitments) { GM._npcCommitments = GM._savedNpcCommitments; delete GM._savedNpcCommitments; }
  if (GM._savedSecretMeetings) { GM._secretMeetings = GM._savedSecretMeetings; delete GM._savedSecretMeetings; }
  if (GM._savedAchievements) { GM._achievements = GM._savedAchievements; delete GM._savedAchievements; }
  // 7.4: 历史索引恢复
  if (GM._savedHistoryIndex) { GM._historyIndex = GM._savedHistoryIndex; delete GM._savedHistoryIndex; }
  if (GM._savedHistoryIndexCursor) { GM._historyIndexCursor = GM._savedHistoryIndexCursor; delete GM._savedHistoryIndexCursor; }
}

function fullLoadGame(data){
  // 兼容两种存档格式：
  // 格式A (desktopDoSave/doSaveGame): data = P, data.gameState = GM
  // 格式B (SaveManager): data.gameState = {GM, P}
  if (data.gameState && data.gameState.GM && data.gameState.P) {
    // 格式B：SaveManager格式
    P = data.gameState.P;
    GM = data.gameState.GM;
  } else {
    // 格式A：标准格式
    P = data;
    if (data.gameState) {
      GM = data.gameState;
    }
  }

  if(GM){
    GM.running=true;
    // 读档时强制重置busy——若存档时推演未完成（例如自动存档在endTurn中途触发），busy可能遗留为true导致"静待时变"失效
    GM.busy = false;
    GM._endTurnBusy = false;
    if(GM._rngState && typeof restoreRng === 'function') restoreRng(GM._rngState);
    // 兼容旧存档：旧版本将ChronicleSystem序列化数据错误地写入GM._chronicle（覆盖了原本的数组）——检测并迁移
    if (GM._chronicle && !Array.isArray(GM._chronicle) && typeof GM._chronicle === 'object'
        && (GM._chronicle.monthDrafts || GM._chronicle.yearChronicles)) {
      if (!GM._chronicleSysState) GM._chronicleSysState = GM._chronicle;
      GM._chronicle = [];
    }
    if(GM._chronicleSysState && typeof ChronicleSystem !== 'undefined') ChronicleSystem.deserialize(GM._chronicleSysState);
    if(GM._warTruces && typeof WarWeightSystem !== 'undefined') WarWeightSystem.deserialize(GM._warTruces);

    // 恢复所有_saved*字段
    _restoreSavedFields();

    // 迁移官制树到双层模型
    if (typeof _offMigrateTree === 'function' && GM.officeTree) _offMigrateTree(GM.officeTree);
    // 官制officialTitle同步——确保ch.officialTitle与GM.officeTree一致
    if (GM.officeTree && GM.chars) {
      (function _syncTitles(nodes) {
        nodes.forEach(function(n) {
          (n.positions||[]).forEach(function(p) {
            if (p.holder) {
              var _sch = GM.chars.find(function(c){ return c.name === p.holder; });
              if (_sch) _sch.officialTitle = p.name;
            }
          });
          if (n.subs) _syncTitles(n.subs);
        });
      })(GM.officeTree);
    }
    // 确保所有字段有默认值
    _ensureGMDefaults();
    _ensurePDefaults();
    if (typeof buildCoreMetricLabels === 'function') buildCoreMetricLabels();

    // 角色完整字段补齐（兼容旧存档/手工导入的 JSON）
    try {
      if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function') {
        CharFullSchema.ensureAll(GM.chars);
      }
    } catch(e) { console.error('[fullLoadGame] CharFullSchema.ensureAll 失败:', e); }

    // 重建索引
    if (typeof buildIndices === 'function') buildIndices();

    _$("launch").style.display="none";
    _$("bar").style.display="flex";
    _$("bar-btns").innerHTML="";
    _$("G").style.display="grid";
    _$("E").style.display="none";
    _$("shiji-btn").classList.add("show");
    _$("save-btn").classList.add("show");

    // ── 管辖层级/封建字段迁移（老存档兼容）──
    if (GM.facs && GM.facs.length > 0) {
      GM.facs.forEach(function(f) {
        if (!f) return;
        if (f.liege) {
          if (!f.relationType) f.relationType = 'vassal';          // 默认封臣
          if (f.loyaltyToLiege === undefined) f.loyaltyToLiege = 60;
          if (f.rebellionRisk === undefined) f.rebellionRisk = 20;
        }
      });
    }
    // 派生所有区划 autonomy（首次载入/老存档）
    if (typeof applyAutonomyToAllDivisions === 'function') {
      try { applyAutonomyToAllDivisions(); } catch(_autE) { console.warn('[autonomy] 派生失败', _autE); }
    }
    // 自动分配后妃居所
    if (typeof autoAssignHaremResidences === 'function') {
      try { autoAssignHaremResidences(); } catch(_resE) { console.warn('[residence] 分配失败', _resE); }
    }
    // 载入存档后：若 GM.adminHierarchy 缺失/为空（老存档），从剧本或 P 恢复
    try {
      var _ahEmpty = !GM.adminHierarchy ||
                     typeof GM.adminHierarchy !== 'object' ||
                     Object.keys(GM.adminHierarchy).length === 0;
      if (_ahEmpty) {
        var _scAh = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
        if (_scAh && _scAh.adminHierarchy) {
          GM.adminHierarchy = deepClone(_scAh.adminHierarchy);
          console.log('[fullLoadGame] GM.adminHierarchy 从 scenario 恢复·keys=' + Object.keys(GM.adminHierarchy).join(','));
        } else if (P.adminHierarchy) {
          GM.adminHierarchy = deepClone(P.adminHierarchy);
          console.log('[fullLoadGame] GM.adminHierarchy 从 P 恢复·keys=' + Object.keys(GM.adminHierarchy).join(','));
        }
      }
    } catch(_ahLE) { console.warn('[fullLoadGame] adminHierarchy 恢复失败', _ahLE); }

    // 集成桥梁：老存档可能缺 divisions 深化字段，init 会补齐并建立 legacy proxy
    if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.init === 'function') {
      try { IntegrationBridge.init(); } catch(_ibE) { console.warn('[bridge] init 失败', _ibE); }
    }

    // 同步剧本自定义预设（HistoricalPresets 动态 getter 读取 window.scriptData.customPresets）
    try {
      if (P && P.customPresets) {
        if (!window.scriptData) window.scriptData = {};
        window.scriptData.customPresets = P.customPresets;
      }
    } catch(_cpLE) { console.warn('[load] customPresets sync 失败', _cpLE); }

    enterGame();
    renderGameState();
    renderOfficeTree();
    renderBiannian();
    renderMemorials();
    renderJishi();
    if(typeof renderShijiList==="function")renderShijiList();
    if(typeof renderGameTech==="function")renderGameTech();
    if(typeof renderGameCivic==="function")renderGameCivic();
    if(typeof renderRenwu==="function")renderRenwu();
    if(typeof renderSidePanels==="function")renderSidePanels();

    toast("\u2705 \u5DF2\u52A0\u8F7D: T"+GM.turn+" "+getTSText(GM.turn));
  }else{
    loadT();
    toast("\u9879\u76EE\u5DF2\u52A0\u8F7D\uFF0C\u8BF7\u9009\u62E9\u5267\u672C");
    _$("launch").style.display="none";
    showScnManage();
  }
}

// 3. 文件读取（保留Electron桌面端支持）
importSaveFile=function(){
  // Electron桌面端：使用原生文件对话框
  if(window.tianming&&window.tianming.isDesktop&&window.tianming.dialogImport){
    window.tianming.dialogImport().then(function(res){
      if(!res||res.canceled||!res.success)return;
      try{ fullLoadGame(res.data); }catch(err){ toast('\u5931\u8D25: '+err.message); }
    }).catch(function(){ toast('\u5931\u8D25'); });
    return;
  }
  // 浏览器端：文件选择器
  var inp=document.createElement("input");inp.type="file";inp.accept=".json";
  inp.onchange=function(e){
    var f=e.target.files[0];if(!f)return;
    showLoading("\u8BFB\u53D6\u6587\u4EF6...",30);
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        showLoading("\u89E3\u6790\u6570\u636E...",60);
        var data=JSON.parse(ev.target.result);
        showLoading("\u6062\u590D\u72B6\u6001...",90);
        fullLoadGame(data);
        hideLoading();
      }catch(err){hideLoading();toast("\u5931\u8D25: "+err.message);}
    };
    reader.readAsText(f);
  };
  inp.click();
};

// 4. Electron读取（覆盖旧版）——统一使用卷宗UI
if(window.tianming&&window.tianming.isDesktop){
  doLoadSave=function(){
    if(typeof openSaveManager==='function'){openSaveManager();return;}
    // 降级：旧版文件列表
    (async function(){var list=await window.tianming.listSaves();
    var files=list.success?list.files.filter(function(f){return f.name!=="__autosave__";}):[];
    files.sort(function(a,b){return (b.modified||0)-(a.modified||0);});
    var html="<div style='padding:1.5rem;max-width:560px;margin:auto'>";
    html+="<h2 style='color:var(--gold);margin-bottom:1rem'>\u8BFB\u53D6\u5B58\u6863</h2>";
    if(!files.length){
      html+="<p style='color:var(--txt-d)'>\u65E0\u5B58\u6863\u3002</p>";
    }else{
      html+="<div style='max-height:340px;overflow-y:auto'>";
      files.forEach(function(f){
        var meta=f.meta||{};
        var sub=(meta.scenario?'\u5267\u672C:'+meta.scenario+' ':'')+(meta.turn?'T'+meta.turn:'');
        html+="<div style='display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;background:var(--bg-3);border-radius:6px;padding:0.5rem 0.75rem'>";
        html+="<div style='flex:1;min-width:0'>";
        html+="<div style='color:var(--txt-s);font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>"+f.name+"</div>";
        html+="<div style='color:var(--txt-d);font-size:0.75rem'>"+(f.modifiedStr||"")+" \u00b7 "+Math.round(f.size/1024)+" KB"+(sub?" \u00b7 "+sub:"")+"</div>";
        html+="</div>";
        html+="<button style='padding:0.2rem 0.7rem;border:none;border-radius:4px;background:var(--gold);color:#111;cursor:pointer;font-size:0.8rem;font-family:inherit' "
          +"onclick='window.desktopLoadSave("+JSON.stringify(f.name)+")'>"+"\u8F7D\u5165"+"</button>";
        html+="<button style='padding:0.2rem 0.6rem;border:none;border-radius:4px;background:#5a2020;color:#eee;cursor:pointer;font-size:0.8rem;font-family:inherit' "
          +"onclick='window.desktopDeleteSave("+JSON.stringify(f.name)+")'>"+"\u5220\u9664"+"</button>";
        html+="</div>";
      });
      html+="</div>";
    }
    html+="<div style='display:flex;gap:0.8rem;margin-top:1rem'>";
    html+="<button class='btn' onclick='importSaveFile()'>\u4ECE\u6587\u4EF6\u5BFC\u5165</button>";
    html+="<button class='btn' onclick='showMain()'>\u8FD4\u56DE</button>";
    html+="</div>";
    html+="</div>";
    showPanel(html);
    _$("G").style.display="none";
  })();};

  window.desktopLoadSave=async function(name){
    showLoading("\u8BFB\u53D6\u5B58\u6863...",30);
    try{
      var r=await window.tianming.loadProject(name);
      if(r.success&&r.data){
        showLoading("\u6062\u590D...",70);
        try { fullLoadGame(r.data); }
        catch (_lpE) { console.error('[loadProject] 恢复失败', _lpE); toast('恢复失败: ' + (_lpE.message||_lpE)); }
        finally { hideLoading(); }
      }else{hideLoading();toast("\u52A0\u8F7D\u5931\u8D25");}
    }catch(e){hideLoading();toast("\u5931\u8D25: "+e.message);}
  };

  window.desktopDeleteSave=async function(name){
    if(!confirm("\u786E\u8BA4\u5220\u9664\u5B58\u6863\u300C"+name+"\u300D\uFF1F"))return;
    var r=await window.tianming.deleteSave(name);
    if(r.success){toast("\u5DF2\u5220\u9664");doLoadSave();}
    else toast("\u5220\u9664\u5931\u8D25: "+(r.error||""));
  };
}

// 6. 自动存档（Electron）
if(window.tianming&&window.tianming.isDesktop){
  // 每60秒自动存档（始终保存P，游戏运行时附带GM）
  setInterval(async function(){
    try{
      if(GM.running && typeof _prepareGMForSave === 'function') _prepareGMForSave();
      var saveData=deepClone(P);
      if(GM.running){saveData.gameState=deepClone(GM);saveData._saveMeta={turn:GM.turn,scenario:findScenarioById(GM.sid)||{name:''},saveName:GM.saveName,date:new Date().toISOString()};}
      await window.tianming.autoSave(saveData);
      // 同时写localStorage兜底
      try{localStorage.setItem("tm_P",JSON.stringify(P));}catch(e2){}
    }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
  },60000);

  // 启动时检测自动存档
  (async function(){
    try{
      var r=await window.tianming.loadAutoSave();
      if(r.success&&r.data){
        if(r.data.gameState&&r.data.gameState.running){
          // 有运行中的游戏——提示恢复
          if(confirm("\u68C0\u6D4B\u5230\u81EA\u52A8\u5B58\u6863 (T"+(r.data.gameState.turn||1)+")\uFF0C\u662F\u5426\u6062\u590D\uFF1F")){
            showLoading("\u6062\u590D...",50);
            try { fullLoadGame(r.data); }
            catch (_restE) { console.error('[autoRestore] 恢复失败', _restE); toast('恢复失败: ' + (_restE.message||_restE)); }
            finally { hideLoading(); }
          }
        } else if(r.data.scenarios&&r.data.scenarios.length>0){
          // 没有运行中的游戏但有剧本数据——静默恢复P结构
          var data=r.data;
          for(var key in data){
            if(data.hasOwnProperty(key)&&key!=='gameState'&&key!=='_saveMeta'){
              P[key]=data[key];
            }
          }
          console.log('[desktop] 已从autoSave恢复P（无游戏状态），scenarios:',P.scenarios.length);
        }
      }
    }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
  })();
}

// 6b. 浏览器端定期保存P + 页面关闭时保存
if(!window.tianming||!window.tianming.isDesktop){
  setInterval(function(){ try{saveP();}catch(e){} },120000);
}
// 页面关闭/刷新时紧急保存P
window.addEventListener('beforeunload',function(){
  try{localStorage.setItem("tm_P",JSON.stringify(P));}catch(e){}
});

// 7. 查漏：推演时奏议数量使用设置中的值
var _origGenMem=generateMemorials;
generateMemorials=function(){
  // 同步界面上的值到P.conf
  var minEl=_$("memorial-min");var maxEl=_$("memorial-max");
  if(minEl)P.conf.memorialMin=+minEl.value;
  if(maxEl)P.conf.memorialMax=+maxEl.value;
  _origGenMem();
};

// 8. 查漏：近N回合起居注完整内容打包
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子5）

// 9. 查漏：游戏规则注入推演
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子7）

// 10. 查漏：游戏模式（史实检查）
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子9）


// ============================================================
//  剧本编辑器桥接：打开 editor.html
// ============================================================
function openEditorHtml(scnId){
  var scn=findScenarioById(scnId);
  if(!scn){toast('找不到剧本');return;}

  // 确保 API 配置同步到 localStorage
  try{
    localStorage.setItem('tm_api',JSON.stringify(P.ai));
  }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }

  // 把 index.html 的剧本数据映射成 editor.js 的 scriptData 格式
  var scriptData={
    id: scnId,
    name: scn.name||'',
    startYear: scn.startYear||null,
    dynastyPhaseHint: scn.dynastyPhaseHint||'',
    dynasty: scn.dynasty||scn.era||'',
    emperor: scn.emperor||scn.role||'',
    overview: scn.overview||scn.background||scn.desc||'',
    openingText: scn.openingText||'',
    globalRules: scn.globalRules||'',
    playerInfo: scn.playerInfo||{factionName:'',factionDesc:'',characterName:'',characterDesc:'',coreContradictions:[]},
    gameSettings: scn.gameSettings||{enabledSystems:{items:true,military:true,techTree:true,civicTree:true,events:true,map:true,characters:true,factions:true,classes:true,rules:true,officeTree:true},startYear:1,startMonth:1,startDay:1,enableGanzhi:false,enableGanzhiDay:false,enableEraName:false,eraNames:[],turnDuration:1,turnUnit:'月'},
    time: scn.time||P.time||{year:-356,prefix:"公元前",suffix:"年",perTurn:"1s",customDays:90,varSpeed:false,seasons:["春","夏","秋","冬"],startS:2,sEffects:[],reign:"",reignY:1,display:"year_season",template:"{reign}{ry}年 {season}",startMonth:1,startDay:1,enableGanzhi:false,enableGanzhiDay:false,enableEraName:false,eraNames:[]},
    // 优先从 scn 对象本身取（磁盘加载的完整数据），其次从 P 按 sid 过滤
    characters: (scn.characters && scn.characters.length > 0) ? scn.characters : (P.characters||[]).filter(function(c){return c.sid===scnId;}),
    factions: (scn.factions && scn.factions.length > 0) ? scn.factions : (P.factions||[]).filter(function(f){return f.sid===scnId;}),
    parties: (scn.parties && scn.parties.length > 0) ? scn.parties : (P.parties||[]).filter(function(p){return p.sid===scnId;}),
    classes: (scn.classes && scn.classes.length > 0) ? scn.classes : (P.classes||[]).filter(function(c){return c.sid===scnId;}),
    items: (scn.items && scn.items.length > 0) ? scn.items : (P.items||[]).filter(function(it){return it.sid===scnId;}),
    military: scn.military||{troops:[],facilities:[],organization:[],campaigns:[],initialTroops:[],militarySystem:[]},
    techTree: scn.techTree||{military:[],civil:[]},
    civicTree: scn.civicTree||{city:[],policy:[],resource:[],corruption:[]},
    variables: scn.variables||{base:[],other:[],formulas:[]},
    rules: scn.rules||{base:'',combat:'',economy:'',diplomacy:''},
    events: scn.events||{historical:[],random:[],conditional:[],story:[],chain:[]},
    timeline: scn.timeline||{past:[],future:[]},
    map: scn.map||{items:[],regions:[],roads:[]},
    worldSettings: scn.worldSettings||{culture:'',weather:'',religion:'',economy:'',technology:'',diplomacy:''},
    government: scn.government||{name:'',description:'',selectionSystem:'',promotionSystem:'',historicalReference:'',nodes:[]},
    adminHierarchy: scn.adminHierarchy||{},
    officeTree: scn.officeTree||[],
    officeConfig: scn.officeConfig||{costVariables:[],shortfallEffects:''},
    eraState: scn.eraState||{politicalUnity:0.7,centralControl:0.6,legitimacySource:'hereditary',socialStability:0.6,economicProsperity:0.6,culturalVibrancy:0.7,bureaucracyStrength:0.6,militaryProfessionalism:0.5,landSystemType:'mixed',dynastyPhase:'peak',contextDescription:''},
    buildingSystem: scn.buildingSystem||{enabled:false,buildingTypes:[]},
    palaceSystem: scn.palaceSystem||{enabled:false,capitalName:'',capitalDescription:'',palaces:[]},
    culturalConfig: scn.culturalConfig||{enabled:true,dynastyFocus:'auto',presetWorks:[]},
    presetRelations: scn.presetRelations||{npc:[],faction:[]},
    battleConfig: scn.battleConfig||P.battleConfig||{enabled:true},
    initialEnYuan: scn.initialEnYuan||[],
    initialPatronNetwork: scn.initialPatronNetwork||[],
    chronicleConfig: scn.chronicleConfig||P.chronicleConfig||{yearlyEnabled:false,style:'biannian'},
    eventConstraints: scn.eventConstraints||P.eventConstraints||{enabled:false,types:[]},
    warConfig: scn.warConfig||P.warConfig||{casusBelliTypes:[]},
    diplomacyConfig: scn.diplomacyConfig||P.diplomacyConfig||{treatyTypes:[]},
    schemeConfig: scn.schemeConfig||P.schemeConfig||{enabled:false,schemeTypes:[]},
    decisionConfig: scn.decisionConfig||P.decisionConfig||{decisions:[]},
    edictConfig: scn.edictConfig||P.edictConfig||{enabled:true,examples:[],styleNote:''},
    postSystem: scn.postSystem||{enabled:false,postRules:[]},
    vassalSystem: scn.vassalSystem||{enabled:false,vassalTypes:[]},
    titleSystem: scn.titleSystem||{enabled:false,titleRanks:[]},
    officialVassalMapping: scn.officialVassalMapping||{mappings:[]},
    economyConfig: scn.economyConfig||{enabled:false,currency:'\u8D2F',baseIncome:10000,tributeRatio:0.3,tributeAdjustment:0,taxRate:0.1,inflationRate:0.02,economicCycle:'stable',specialResources:'',tradeSystem:'',description:'',redistributionRate:0.3,tradeBonus:0.1,agricultureMultiplier:1.0,commerceMultiplier:1.0},
    goals: scn.goals||[],
    offendGroups: {enabled:false,decayEnabled:false,decayRate:0.05,groups:[]}, // 已废弃，得罪机制由party/class offendThresholds替代
    keju: scn.keju||{enabled:false,reformed:false,examIntervalNote:'',examNote:''},
    externalForces: scn.externalForces||[],
    relations: (scn.relations && scn.relations.length > 0) ? scn.relations : (P.relations||[]).filter(function(r){return r.sid===scnId;}),
    factionRelations: scn.factionRelations||[],
    mapData: scn.mapData||{},
    haremConfig: scn.haremConfig||{rankSystem:[],succession:'eldest_legitimate'},
    cities: scn.cities||[]
  };
  // 写入IndexedDB（主存储）+ localStorage（兜底）
  var _edMeta = { scnId: scnId, scnName: P._activeScnName||scn.name||scnId };
  if (typeof TM_SaveDB !== 'undefined') {
    TM_SaveDB.save('current_script', scriptData, {
      name: scriptData.name || scnId,
      type: 'editor',
      turn: 0,
      scenarioName: scriptData.name || ''
    });
  }
  try {
    localStorage.setItem('tianming_script', JSON.stringify(scriptData));
  } catch(e) {
    console.warn('[openEditorHtml] localStorage写入失败（已保存到IndexedDB）:', e.message);
  }
  try {
    localStorage.setItem('tianming_editor_meta', JSON.stringify(_edMeta));
  } catch(e) { console.warn('[openEditorHtml] meta写入失败:', e.message); }
  console.log('[openEditorHtml] 准备跳转到 editor.html, scnId=' + scnId);
  window.location.href='editor.html';
}

// 页面加载时：若从 editor.html 返回，同步数据回 P.scenarios
(function syncFromEditor(){
  try{
    var metaRaw=localStorage.getItem('tianming_editor_meta');
    var scriptRaw=localStorage.getItem('tianming_script');
    _dbg('[syncFromEditor] metaRaw:', metaRaw ? '存在' : '不存在');
    _dbg('[syncFromEditor] scriptRaw:', scriptRaw ? '存在' : '不存在');
    if(!metaRaw||!scriptRaw)return;
    var meta=JSON.parse(metaRaw);
    var sd=JSON.parse(scriptRaw);
    // 确定剧本ID：优先meta.scnId，其次sd.id，最后用文件名生成
    var scnId = meta.scnId || sd.id || ('scn_file_' + (meta.scnName || 'unknown').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g,'_'));
    if (!scnId) return;
    // 找或创建对应剧本
    var idx=P.scenarios.findIndex(function(s){return s.id===scnId;});
    if(idx<0){P.scenarios.push({id:scnId,name:sd.name||'',era:sd.dynasty||'',role:sd.emperor||'',background:sd.overview||''});idx=P.scenarios.length-1;}
    var scn=P.scenarios[idx];
    scn.name=sd.name||scn.name;
    scn.era=sd.dynasty||scn.era;
    scn.dynasty=sd.dynasty||scn.dynasty||scn.era||'';
    scn.role=sd.emperor||scn.role;
    scn.emperor=sd.emperor||scn.emperor||scn.role||'';
    scn.background=sd.overview||scn.background;
    scn.overview=sd.overview||scn.overview||scn.background||'';
    scn.desc=sd.overview||scn.desc||'';
    scn.openingText=sd.openingText||scn.openingText||'';
    scn.globalRules=sd.globalRules||scn.globalRules||'';
    scn.playerInfo=sd.playerInfo||scn.playerInfo||{factionName:'',factionDesc:'',characterName:'',characterDesc:'',coreContradictions:[]};
    if(sd.gameSettings)scn.gameSettings=sd.gameSettings;
    // 时间配置：优先用sd.time，若为null则从sd.gameSettings构建
    if(sd.time && typeof sd.time === 'object' && sd.time.year !== undefined){
      scn.time=sd.time;
    } else if(sd.gameSettings){
      // 从gameSettings构建time对象
      var _gst = sd.gameSettings;
      if(!scn.time) scn.time = {};
      if(_gst.startYear !== undefined && _gst.startYear !== null && _gst.startYear !== '') {
        scn.time.year = Number(_gst.startYear);
        if(scn.time.year < 0) { scn.time.prefix = '公元前'; scn.time.suffix = '年'; }
        else { scn.time.prefix = '公元'; scn.time.suffix = '年'; }
      }
      if(_gst.startMonth) scn.time.startMonth = Number(_gst.startMonth);
      if(_gst.startDay) scn.time.startDay = Number(_gst.startDay);
      // 回合天数
      if(_gst.daysPerTurn && _gst.daysPerTurn > 0){
        scn.time.daysPerTurn = Number(_gst.daysPerTurn);
      } else if(_gst.turnUnit){
        // 旧格式兼容
        var _dMap4={'日':1,'周':7,'月':30,'季':90,'年':365};
        scn.time.daysPerTurn = (_gst.turnDuration||1) * (_dMap4[_gst.turnUnit]||30);
      }
      if(_gst.startLunarMonth) scn.time.startLunarMonth = Number(_gst.startLunarMonth);
      if(_gst.startLunarDay) scn.time.startLunarDay = Number(_gst.startLunarDay);
      if(_gst.enableGanzhi !== undefined) scn.time.enableGanzhi = _gst.enableGanzhi;
      if(_gst.enableGanzhiDay !== undefined) scn.time.enableGanzhiDay = _gst.enableGanzhiDay;
      if(_gst.enableEraName !== undefined) scn.time.enableEraName = _gst.enableEraName;
      if(_gst.eraNames && _gst.eraNames.length > 0) scn.time.eraNames = _gst.eraNames;
    }
    // 用 hasOwnProperty 检查：编辑器中清空的字段也应同步（空数组/空对象是有效值）
    var _syncField = function(key, fallback) {
      if (sd.hasOwnProperty(key)) { scn[key] = sd[key]; }
      else if (fallback !== undefined && !scn[key]) { scn[key] = fallback; }
    };
    _syncField('military');
    _syncField('techTree');
    _syncField('civicTree');
    _syncField('variables');
    _syncField('rules');
    _syncField('events');
    _syncField('timeline');
    _syncField('map');
    _syncField('worldSettings');
    _syncField('government');
    _syncField('adminHierarchy', {});
    // 自动从government.nodes同步到officeTree（确保编辑器编辑的官制进入运行时）
    if (sd.government && sd.government.nodes && sd.government.nodes.length > 0) {
      if (!sd.officeTree || sd.officeTree.length === 0) {
        sd.officeTree = JSON.parse(JSON.stringify(sd.government.nodes));
      }
    }
    _syncField('officeTree', []);
    _syncField('officeConfig');
    _syncField('eraState');
    _syncField('buildingSystem');
    _syncField('battleConfig');
    _syncField('adminConfig');
    _syncField('initialEnYuan');
    _syncField('initialPatronNetwork');
    _syncField('chronicleConfig');
    _syncField('eventConstraints');
    _syncField('warConfig');
    _syncField('diplomacyConfig');
    _syncField('schemeConfig');
    _syncField('decisionConfig');
    _syncField('postSystem');
    _syncField('vassalSystem');
    _syncField('titleSystem');
    _syncField('officialVassalMapping');
    _syncField('economyConfig');
    _syncField('goals');
    // offendGroups已移除，得罪机制由party/class的offendThresholds替代
    _syncField('keju');
    _syncField('playerInfo');
    _syncField('mapData');
    _syncField('externalForces');
    _syncField('relations');
    _syncField('haremConfig');
    _syncField('factionRelations');
    _syncField('startYear');
    _syncField('dynastyPhaseHint');
    _syncField('cities');
    // 合并人物/势力/党派/阶层/物品（替换同 sid 的条目）
    ['characters','factions','parties','classes','items'].forEach(function(key){
      if(!sd[key]||!sd[key].length)return;
      P[key]=(P[key]||[]).filter(function(it){return it.sid!==scnId;});
      sd[key].forEach(function(it){it.sid=scnId;});
      P[key]=P[key].concat(sd[key]);
    });
    P._activeScnName=meta.scnName||scn.name;
    // 不删除localStorage中的剧本数据——保留以便下次直接打开编辑器时可恢复
    localStorage.removeItem('tianming_editor_meta');
    // 注意：保留 tianming_script 以支持直接打开editor.html
    // 持久化P（确保浏览器版本也能保存剧本列表）
    if (typeof saveP === 'function') saveP();
    // 桌面端：保存完整的 scriptData 到磁盘（不是部分合并的 scn）
    // 编辑器的 sd 就是完整的 scriptData，直接存它才能保留全部41个字段
    if(window.tianming&&window.tianming.isDesktop&&window.tianming.saveScenario){
      var saveFname=meta.scnName||scn.name||scnId;
      // 确保 sd 包含 id 和双格式字段
      sd.id = scnId;
      if (sd.dynasty && !sd.era) sd.era = sd.dynasty;
      if (sd.era && !sd.dynasty) sd.dynasty = sd.era;
      if (sd.emperor && !sd.role) sd.role = sd.emperor;
      if (sd.role && !sd.emperor) sd.emperor = sd.role;
      if (sd.overview && !sd.background) sd.background = sd.overview;
      if (sd.background && !sd.overview) sd.overview = sd.background;
      window.tianming.saveScenario(saveFname, sd).catch(function(e){ console.warn("[catch] async:", e); });
    }
    // 返回剧本管理界面
    _dbg('[syncFromEditor] 同步完成，准备显示剧本管理界面');
    setTimeout(function(){showScnManage();},100);
  }catch(e){
    console.error('[syncFromEditor] 错误:', e);
  }
})();

// ── 页面加载：检测IndexedDB中的autosave并提示恢复 ──
(function _checkAutoRestore() {
  try {
    var mark = localStorage.getItem('tm_autosave_mark');
    if (!mark) return;
    var info = JSON.parse(mark);
    if (!info.turn) return;

    // 有自动存档标记——延迟弹窗（等IndexedDB打开）
    setTimeout(function() {
      if (GM.running) return; // 已经在游戏中（从syncFromEditor恢复的）
      var msg = '检测到上次推演（' + (info.scenarioName || '') + ' 第' + info.turn + '回合';
      if (info.eraName) msg += ' · ' + info.eraName;
      msg += '），是否恢复？';
      if (confirm(msg)) {
        showLoading('展卷恢复中……', 40);
        TM_SaveDB.load('autosave').then(function(record) {
          if (record && record.gameState) {
            if (typeof fullLoadGame === 'function') {
              try { fullLoadGame({ gameState: record.gameState }); toast('已恢复：第' + info.turn + '回合'); }
              catch (_asE) { console.error('[autosave] 恢复失败', _asE); toast('恢复失败: ' + (_asE.message||_asE)); }
              finally { hideLoading(); }
            } else { hideLoading(); }
          } else {
            hideLoading();
            toast('自动存档数据已损坏');
          }
        }).catch(function(e) { hideLoading(); toast('恢复失败: ' + (e && e.message || e)); });
      }
    }, 500);
  } catch(e) {}
})();

function _showOfficeStartModal(){
  var ov=document.createElement('div');
  ov.id='office-start-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML=`
    <div style="background:var(--bg2,#1e1e2e);border:1px solid var(--bdr,#444);border-radius:10px;padding:28px 32px;min-width:360px;max-width:520px;color:var(--txt,#ccc);font-size:14px;">
      <h3 style="margin:0 0 16px;font-size:16px;">当前剧本未配置官制，请选择如何处理</h3>
      <div style="margin-bottom:14px;">
        <label style="display:block;margin-bottom:6px;">模式</label>
        <label style="margin-right:18px;"><input type="radio" name="osm-mode" value="auto" checked> 自动生成（输入朝代）</label>
        <label><input type="radio" name="osm-mode" value="skip"> 跳过（无官制运行）</label>
      </div>
      <div id="osm-auto-area" style="margin-bottom:14px;">
        <label style="display:block;margin-bottom:6px;">朝代名称</label>
        <input id="osm-dynasty" type="text" placeholder="如：汉、唐、宋..." style="width:100%;box-sizing:border-box;padding:6px 10px;background:var(--bg3,#111);border:1px solid var(--bdr,#444);border-radius:6px;color:inherit;font-size:14px;">
      </div>
      <div id="osm-status" style="color:#f90;min-height:20px;margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="osm-confirm-btn" onclick="_osmConfirm()" style="padding:7px 20px;background:var(--acc,#5865f2);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">确定</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  // toggle auto/skip area
  ov.querySelectorAll('input[name=osm-mode]').forEach(function(r){
    r.addEventListener('change',function(){
      document.getElementById('osm-auto-area').style.display=this.value==='auto'?'':'none';
      document.getElementById('osm-confirm-btn').textContent=this.value==='auto'?'确定':'跳过';
    });
  });
}

async function _osmConfirm(){
  var ov=document.getElementById('office-start-overlay');
  if(!ov)return;
  var modeInput=ov.querySelector('input[name=osm-mode]:checked');
  if(!modeInput)return;
  var mode=modeInput.value;
  var status=document.getElementById('osm-status');
  if(mode==='skip'){
    ov.remove();
    toast("第1回合");
    return;
  }
  var dynastyInput=document.getElementById('osm-dynasty');
  if(!dynastyInput)return;
  var dynasty=(dynastyInput.value||'').trim();
  if(!dynasty){if(status)status.textContent='请输入朝代名称';return;}
  if(!P.ai||!P.ai.key){if(status)status.textContent='未配置 AI key，请先跳过';return;}
  var confirmBtn=document.getElementById('osm-confirm-btn');
  if(confirmBtn)confirmBtn.disabled=true;
  if(status)status.textContent='生成中...';
  try{
    showLoading('生成官制',50);
    var prompt='生成'+dynasty+'官制。返回JSON数组，格式：[{"name":"部门","positions":[{"name":"","holder":"","desc":"","rank":""}],"subs":[]}]\n生成5个主要部门。';
    var c=await callAISmart(prompt,3000,{minLength:200,maxRetries:3,validator:function(content){try{var cleaned=content.replace(/```json|```/g,'').trim();var jm=cleaned.match(/\[[\s\S]*?\](?=\s*$)/);if(!jm){jm=cleaned.match(/\[[\s\S]*\]/);}if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=5;}catch(e){return false;}}});
    var cleaned=c.replace(/```json|```/g,'').trim();var jm=cleaned.match(/\[[\s\S]*?\](?=\s*$)/);if(!jm){jm=cleaned.match(/\[[\s\S]*\]/);}
    if(jm){
      try{
        GM.officeTree=JSON.parse(jm[0]);
      }catch(parseErr){
        // 尝试修复常见JSON问题：去掉末尾多余逗号
        var fixedStr=jm[0].replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}');
        GM.officeTree=JSON.parse(fixedStr);
      }
      P.officeTree=deepClone(GM.officeTree);
      renderOfficeTree();
      hideLoading();
      ov.remove();
      toast("第1回合");
    } else {
      hideLoading();
      status.textContent='生成失败，请重试或跳过';
      document.getElementById('osm-confirm-btn').disabled=false;
    }
  }catch(e){
    hideLoading();
    status.textContent='错误: '+e.message;
    document.getElementById('osm-confirm-btn').disabled=false;
  }
}

// ==== aiGen_override.js ====
// ========================================================
// Feature 3+4+5: AI Gen Mode overrides
// auto/manual mode, style override, refText override
// Appended before closing script tag
// ========================================================

// Helper: build style+refText prefix for prompts
function _aiStylePrefix(styleVal, refVal) {
  var parts = [];
  if (styleVal) parts.push('\u5399\u4e8b\u98ce\u683c\uff1a' + styleVal + '\u3002');
  if (refVal) parts.push('\u53c2\u8003\u8d44\u6599\uff1a' + refVal + '\u3002');
  return parts.join('');
}

// Helper: render AI gen options panel
// Returns HTML string for mode/style/refText controls
// containerId: unique prefix for IDs
// showMode: whether to show auto/manual toggle
function _aiGenOptionsHTML(containerId, showMode) {
  var modeHtml = '';
  if (showMode) {
    modeHtml =
      '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:center;">'+
      '<span style="font-size:0.82rem;color:var(--txt-d);">\u751f\u6210\u6a21\u5f0f\uff1a</span>'+
      '<label style="font-size:0.82rem;"><input type="radio" name="'+containerId+'-mode" value="auto" checked onchange="_aiOptToggleMode(\'' + containerId + '\')" style="margin-right:3px;">\u81ea\u52a8\uff08\u540c\u5267\u672c\u671d\u4ee3\uff09</label>'+
      '<label style="font-size:0.82rem;"><input type="radio" name="'+containerId+'-mode" value="manual" onchange="_aiOptToggleMode(\'' + containerId + '\')" style="margin-right:3px;">\u624b\u52a8\uff08\u81ea\u5199\u63cf\u8ff0\uff09</label>'+
      '</div>'+
      '<div id="'+containerId+'-manual-area" style="display:none;margin-bottom:0.5rem;">'+
      '<textarea id="'+containerId+'-manual-desc" rows="2" placeholder="\u8bf7\u63cf\u8ff0\u8981\u751f\u6210\u7684\u5185\u5bb9\uff0c\u5982\u671d\u4ee3\u3001\u4eba\u7269\u7279\u5f81\u7b49\u2026" style="width:100%;font-size:0.82rem;"></textarea>'+
      '</div>';
  }
  return modeHtml +
    '<details style="margin-bottom:0.4rem;"><summary style="font-size:0.82rem;color:var(--txt-d);cursor:pointer;">\u2699\ufe0f \u9ad8\u7ea7\u9009\u9879</summary>'+
    '<div style="padding:0.4rem 0;">'+
    '<div style="margin-bottom:0.3rem;"><label style="font-size:0.8rem;color:var(--txt-d);">\u5399\u4e8b\u98ce\u683c\u8986\u76d6 <span style="font-size:0.75rem;">(\u7a7a\u5219\u7528\u5168\u5c40\u8bbe\u7f6e: '+((typeof P!=='undefined'&&P.conf&&P.conf.style)||'\u6587\u5b66\u5316')+')</span></label>'+
    '<input id="'+containerId+'-style" placeholder="\u5982\uff1a\u5c0f\u8bf4\u98ce\u683c/\u8bf4\u4e66\u4eba\u98ce\u683c/\u6b63\u53f2\u98ce\u683c" style="width:100%;font-size:0.82rem;"></div>'+
    '<div><label style="font-size:0.8rem;color:var(--txt-d);">\u53c2\u8003\u8d44\u6599\u8986\u76d6 <span style="font-size:0.75rem;">(\u7a7a\u5219\u7528\u5168\u5c40\u53c2\u8003\u6587\u672c)</span></label>'+
    '<textarea id="'+containerId+'-ref" rows="2" placeholder="\u53ef\u8d34\u5165\u53c2\u8003\u6587\u672c\u3001\u53f2\u4e66\u6bb5\u843d\u7b49\u2026" style="width:100%;font-size:0.82rem;"></textarea></div>'+
    '</div></details>';
}

function _aiOptToggleMode(containerId) {
  var radios = document.querySelectorAll('input[name="'+containerId+'-mode"]');
  var mode = 'auto';
  radios.forEach(function(r){ if(r.checked) mode = r.value; });
  var area = document.getElementById(containerId+'-manual-area');
  if (area) area.style.display = mode === 'manual' ? 'block' : 'none';
}

function _aiOptGetMode(containerId) {
  var radios = document.querySelectorAll('input[name="'+containerId+'-mode"]');
  var mode = 'auto';
  radios.forEach(function(r){ if(r.checked) mode = r.value; });
  return mode;
}

function _aiOptGetStyle(containerId) {
  var el = document.getElementById(containerId+'-style');
  return (el && el.value.trim()) || (P.conf && P.conf.style) || '';
}

function _aiOptGetRef(containerId) {
  var el = document.getElementById(containerId+'-ref');
  return (el && el.value.trim()) || (P.conf && P.conf.refText) || '';
}

function _aiOptGetManualDesc(containerId) {
  var el = document.getElementById(containerId+'-manual-desc');
  return (el && el.value.trim()) || '';
}

// ==== aiGen_override2.js ====
// ========================================================
// Feature 3+4+5: AI Gen Mode overrides (Part 2)
// Monkey-patches aiGenChr/aiGenFac/aiGenVar/aiGenTech/aiGenCivic/aiGenItems
// and adds style+refText fields to execFullGen panel
// Appended before closing script tag
// ========================================================

(function(){

// ---- wrap aiGenChr ----
window.aiGenChr = async function() {
  var cid = 'agchr';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u89d2\u8272',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      try {
        showLoading('\u751f\u6210\u89d2\u8272\u4e2d...',20);
        var ctx = findScenarioById(editingScenarioId);
        var era = ctx ? ctx.era : '';
        var scnName = ctx ? ctx.name : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62125\u4e2a\u89d2\u8272\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","title":"","desc":"","personality":"","stats":{},"loyalty":70,"ambition":50,"benevolence":50,"intelligence":70,"valor":60,"morale":75,"stance":"","faction":"","isHistorical":false}]';
        } else {
          var histReq = '\u300a\u8981\u6c42\u300b\u4eba\u7269\u5fc5\u987b\u662f' + era + '\u65f6\u671f\u5b9e\u9645\u5b58\u5728\u7684\u5386\u53f2\u4eba\u7269\uff0c\u4e0d\u5f97\u865a\u6784\u3002';
          promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002' + histReq + '\u8bf7\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62125\u4e2a\u5386\u53f2\u4eba\u7269\uff0c\u4e25\u683c\u6309\u6b63\u53f2\u8fd8\u539f\u3002\u8fd4\u56dejson:[{"name":"","title":"","desc":"","personality":"","stats":{},"loyalty":70,"ambition":50,"benevolence":50,"intelligence":70,"valor":60,"morale":75,"stance":"","faction":"","isHistorical":true}]';
        }
        var content = await callAISmart(prefix + promptBody, 2500,{minLength:200,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=5;}catch(e){return false;}}});
        var jm = content.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(c) {
            P.characters.push({sid:editingScenarioId,name:c.name||'',title:c.title||'',desc:c.desc||'',stats:c.stats||{},stance:c.stance||'',playable:false,personality:c.personality||'',appearance:'',skills:[],loyalty:c.loyalty!=null?c.loyalty:70,morale:c.morale!=null?c.morale:75,ambition:c.ambition!=null?c.ambition:50,benevolence:c.benevolence!=null?c.benevolence:50,intelligence:c.intelligence!=null?c.intelligence:70,valor:c.valor!=null?c.valor:60,dialogues:[],secret:'',faction:c.faction||'',aiPersonaText:'',behaviorMode:'',valueSystem:'',speechStyle:'',rels:[],isHistorical:c.isHistorical||false,age:30,gender:'\u7537'});
          });
          renderEdTab('t-chr'); hideLoading(); toast('\u2705 \u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(err) { hideLoading(); toast('\u5931\u8d25: ' + err.message); }
    }
  );
}

// ---- wrap aiGenFac ----
window.aiGenFac = async function() {
  var cid = 'agfac';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u6d3e\u7cfb',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      try {
        showLoading('\u751f\u6210\u6d3e\u7cfb\u4e2d...',20);
        var ctx = findScenarioById(editingScenarioId);
        var era = ctx ? ctx.era : '';
        var scnName = ctx ? ctx.name : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62123-5\u4e2a\u6d3e\u7cfb\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","leader":"","desc":"","strength":50,"ideology":"","territory":"","traits":[]}]';
        } else {
          var histReq = '\u300a\u8981\u6c42\u300b\u6d3e\u7cfb\u5fc5\u987b\u662f' + era + '\u65f6\u671f\u771f\u5b9e\u5b58\u5728\u7684\u5386\u53f2\u6d3e\u7cfb\u3001\u5355\u8425\u6216\u653f\u6cbb\u96c6\u56e2\uff0c\u9886\u8896\u4eba\u7269\u5fc5\u987b\u662f\u8be5\u65f6\u671f\u5b9e\u6709\u5176\u4eba\uff0c\u4e0d\u5f97\u865a\u6784\u3002';
          promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002' + histReq + '\u8bf7\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62123-5\u4e2a\u5386\u53f2\u4e0a\u5b9e\u9645\u5b58\u5728\u7684\u6d3e\u7cfb\u6216\u653f\u6cbb\u96c6\u56e2\uff0c\u4e25\u683c\u6309\u6b63\u53f2\u8fd8\u539f\u3002\u8fd4\u56dejson:[{"name":"","leader":"","desc":"","strength":50,"ideology":"","territory":"","traits":[]}]';
        }
        var c = await callAISmart(prefix + promptBody, 2000,{minLength:150,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
        var jm = c.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(f) {
            P.factions.push({sid:editingScenarioId,name:f.name||'',leader:f.leader||'',desc:f.desc||'',color:'#'+Math.floor(random()*16777215).toString(16).padStart(6,'0'),traits:f.traits||[],strength:f.strength||50,territory:f.territory||'',ideology:f.ideology||''});
          });
          renderEdTab('t-fac'); hideLoading(); toast('\u2705 \u5386\u53f2\u6d3e\u7cfb\u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(e) { hideLoading(); toast('\u5931\u8d25: ' + e.message); }
    }
  );
}

// ---- wrap aiGenVar ----
window.aiGenVar = async function() {
  var cid = 'agvar';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u53d8\u91cf\u4e0e\u5173\u7cfb',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      var sid = editingScenarioId;
      if (!sid) { toast('\u8bf7\u5148\u9009\u62e9\u5267\u672c'); return; }
      var scn = findScenarioById(sid)||{};
      var ctx = (scn.name||'') + (scn.era ? ',' + scn.era : '') + (scn.background ? ',' + scn.background.slice(0,80) : '');
      var promptBody;
      if (mode === 'manual' && manualDesc) {
        promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62126\u4e2a\u53d8\u91cf\u548c5\u4e2a\u5173\u7cfb\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:{"variables":[{"name":"","value":50,"min":0,"max":100,"desc":""}],"relations":[{"name":"","from":"","to":"","type":"","value":50}]}';
      } else {
        promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002\u5267\u672c\u80cc\u666f\uff1a' + ctx + '\n\u8bf7\u751f\u62126\u4e2a\u5168\u5c40\u53d8\u91cf\u548c5\u4e2a\u4eba\u7269\u5173\u7cfb\u3002\u53d8\u91cf\u5e94\u53cd\u6620\u8be5\u65f6\u671f\u771f\u5b9e\u653f\u6cbb\u3001\u519b\u4e8b\u3001\u7ecf\u6d4e\u3001\u6c11\u5fc3\u72b6\u51b5\u3002\n\u8fd4\u56dejson:{"variables":[{"name":"","value":50,"min":0,"max":100,"desc":""}],"relations":[{"name":"","from":"","to":"","type":"","value":50}]}';
      }
      showLoading('\u751f\u6210\u53d8\u91cf\u4e0e\u5173\u7cfb...');
      try {
        var raw = await callAISmart(prefix + promptBody, 2000,{minLength:100,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,'').trim());return j.variables&&Array.isArray(j.variables)&&j.variables.length>=6;}catch(e){return false;}}});
        var j = JSON.parse(raw.replace(/```json|```/g,'').trim());
        var added = 0;
        if (j.variables && Array.isArray(j.variables)) j.variables.forEach(function(v) {
          P.variables.push({id:uid(),sid:sid,name:v.name||'',value:v.value!=null?v.value:50,min:v.min!=null?v.min:0,max:v.max!=null?v.max:100,color:'#c9a84c',icon:'',cat:'',visible:true,desc:v.desc||''});
          added++;
        });
        if (j.relations && Array.isArray(j.relations)) j.relations.forEach(function(r) {
          P.relations.push({id:uid(),sid:sid,name:r.name||(r.from+'\u2192'+r.to),from:r.from||'',to:r.to||'',type:r.type||'',value:r.value!=null?r.value:50,desc:''});
          added++;
        });
        saveP(); renderEdTab('t-var'); toast('\u5df2\u751f\u6210\u53d8\u91cf/\u5173\u7cfb ' + added + '\u4e2a');
      } catch(e) { toast('\u751f\u6210\u5931\u8d25:' + e.message); }
      finally { hideLoading(); }
    }
  );
}

// ---- wrap aiGenTech ----
window.aiGenTech = async function() {
  var cid = 'agtech';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u79d1\u6280',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      try {
        showLoading('\u751f\u6210\u79d1\u6280\u4e2d...',20);
        var ctx = findScenarioById(editingScenarioId);
        var scnName = ctx ? ctx.name : '';
        var era = ctx ? ctx.era : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62128\u4e2a\u79d1\u6280\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","desc":"","prereqs":[],"costs":[],"effect":{},"era":""}]';
        } else {
          promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002\u8bf7\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62128\u4e2a\u8be5\u65f6\u671f\u5b9e\u9645\u5b58\u5728\u7684\u5386\u53f2\u79d1\u6280\u6216\u5236\u5ea6\u521b\u65b0\u3002\u8fd4\u56dejson:[{"name":"","desc":"","prereqs":[],"costs":[{"variable":"\u7ecf\u6d4e\u5b9e\u529b","amount":20}],"effect":{},"era":"\u521d\u7ea7/\u4e2d\u7ea7/\u9ad8\u7ea7"}]';
        }
        var c = await callAISmart(prefix + promptBody, 2000,{minLength:200,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=8;}catch(e){return false;}}});
        var jm = c.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(t) {
            P.techTree.push({sid:editingScenarioId,name:t.name||'',desc:t.desc||'',prereqs:t.prereqs||[],costs:t.costs||[],effect:t.effect||{},era:t.era||'\u521d\u7ea7',unlocked:false});
          });
          renderEdTab('t-tech'); hideLoading(); toast('\u2705 \u79d1\u6280\u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(e) { hideLoading(); toast('\u5931\u8d25: ' + e.message); }
    }
  );
}

// ---- wrap aiGenCivic ----
window.aiGenCivic = async function() {
  var cid = 'agcivic';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u5e02\u653f',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      showLoading('\u751f\u6210\u5e02\u653f\u4e2d...',20);
      try {
        var ctx = findScenarioById(editingScenarioId);
        var era = ctx ? ctx.era : '';
        var scnName = ctx ? ctx.name : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62123-5\u4e2a\u5e02\u653f\u6216\u5236\u5ea6\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","desc":"","era":"","prereqs":[],"effect":{},"costs":[]}]';
        } else {
          promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002\u8bf7\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62123-5\u4e2a\u5e02\u653f\u6b63\u7b56\u6216\u5236\u5ea6\uff0c\u5fc5\u987b\u662f\u8be5\u65f6\u671f\u5386\u53f2\u4e0a\u5b9e\u9645\u5b58\u5728\u7684\u3002\u8fd4\u56dejson:[{"name":"","desc":"","era":"","prereqs":[],"effect":{},"costs":[]}]';
        }
        var c = await callAISmart(prefix + promptBody, 2000,{minLength:150,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
        var jm = c.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(v) {
            P.civicTree.push({sid:editingScenarioId,name:v.name||'',desc:v.desc||'',era:v.era||era,prereqs:v.prereqs||[],costs:v.costs||[],effect:v.effect||{},adopted:false});
          });
          renderEdTab('t-civic'); hideLoading(); toast('\u2705 \u5e02\u653f\u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(e) { hideLoading(); toast('\u5931\u8d25: ' + e.message); }
    }
  );
}

// ---- wrap aiGenItems ----
window.aiGenItems = async function() {
  var cid = 'agitm';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u7269\u54c1',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      try {
        showLoading('\u751f\u6210\u7269\u54c1\u4e2d...',20);
        var ctx = findScenarioById(editingScenarioId);
        var scnName = ctx ? ctx.name : '';
        var era = ctx ? ctx.era : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62123-5\u4e2a\u7269\u54c1\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","type":"item/tech/policy","desc":"","effect":{},"prerequisite":""}]';
        } else {
          promptBody = '\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62123-5\u4e2a\u5177\u6709\u5386\u53f2\u611f\u7684\u7269\u54c1\u6216\u5b9d\u7269\u3002\u8fd4\u56dejson:[{"name":"","type":"item","desc":"","effect":{},"prerequisite":""}]';
        }
        var c = await callAISmart(prefix + promptBody, 1500,{minLength:100,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
        var jm = c.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(t) {
            P.items.push({sid:editingScenarioId,name:t.name||'',type:t.type||'item',desc:t.desc||'',effect:t.effect||{},prereq:t.prerequisite||'',acquired:false});
          });
          renderEdTab('t-itm'); hideLoading(); toast('\u2705 \u7269\u54c1\u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(e) { hideLoading(); toast('\u5931\u8d25: ' + e.message); }
    }
  );
}

// ---- override aiGenFullScenario: inject style+ref fields into panel ----
window.aiGenFullScenario = function() {
  var panel = _$('ai-full-gen-panel');
  if (!panel) return;
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  var globalStyle = (typeof P !== 'undefined' && P.conf && P.conf.style) || '\u6587\u5b66\u5316';
  panel.innerHTML =
    '<div class="cd"><h4 style="color:var(--gold);">\uD83E\uDD16 AI\u751f\u6210\u5386\u53f2\u5267\u672c</h4>'+
    '<div class="rw"><div class="fd full"><label>\u671d\u4ee3 / \u7687\u5e1d <span style="color:var(--txt-d);font-size:0.8rem;">\uff08\u5fc5\u586b\uff09</span></label>'+
    '<input id="fg-dynasty" placeholder="\u5982\uff1a\u660e\u671d\u5d07\u797a\u7687\u5e1d / \u5510\u671d\u674e\u4e16\u6c11" style="width:100%;"></div></div>'+
    '<div class="rw"><div class="fd full"><label>\u8865\u5145\u63cf\u8ff0 <span style="color:var(--txt-d);font-size:0.8rem;">\uff08\u53ef\u9009\uff0c\u6307\u5b9a\u80cc\u666f\u3001\u4e8b\u4ef6\uff09</span></label>'+
    '<textarea id="fg-desc" rows="2" placeholder="\u5982\uff1a\u5d07\u797a\u5341\u4e03\u5e74\uff0c\u674e\u81ea\u6210\u5175\u4e34\u57ce\u4e0b\uff0c\u671d\u5c40\u52a8\u8361\u2026"></textarea></div></div>'+
    '<div class="rw"><div class="fd"><label>\u751f\u6210\u8be6\u7ec6\u7a0b\u5ea6</label>'+
    '<select id="fg-words"><option value="brief">\u7b80\u7565\uff08\u5feb\u901f\uff09</option><option value="normal" selected>\u6807\u51c6\uff08\u63a8\u8350\uff09</option><option value="detailed">\u8be6\u7ec6\uff08\u5185\u5bb9\u4e30\u5bcc\uff09</option><option value="full">\u5b8c\u6574\uff08\u6700\u8be6\u5c3d\uff09</option></select></div></div>'+
    '<details style="margin:0.4rem 0;"><summary style="font-size:0.82rem;color:var(--txt-d);cursor:pointer;">\u2699\ufe0f \u9ad8\u7ea7\u9009\u9879</summary>'+
    '<div style="padding:0.4rem 0;">'+
    '<div style="margin-bottom:0.3rem;"><label style="font-size:0.8rem;color:var(--txt-d);">\u5399\u4e8b\u98ce\u683c\u8986\u76d6 <span style="font-size:0.75rem;">(\u7a7a\u5219\u7528\u5168\u5c40: ' + globalStyle + ')</span></label>'+
    '<input id="fg-style" placeholder="\u5982\uff1a\u5c0f\u8bf4\u98ce\u683c/\u8bf4\u4e66\u4eba\u98ce\u683c/\u6b63\u53f2\u98ce\u683c" style="width:100%;font-size:0.82rem;"></div>'+
    '<div><label style="font-size:0.8rem;color:var(--txt-d);">\u53c2\u8003\u8d44\u6599\u8986\u76d6 <span style="font-size:0.75rem;">(\u7a7a\u5219\u7528\u5168\u5c40\u53c2\u8003\u6587\u672c)</span></label>'+
    '<textarea id="fg-ref" rows="2" placeholder="\u53ef\u8d34\u5165\u53c2\u8003\u6587\u672c\u3001\u53f2\u4e66\u6bb5\u843d\u7b49\u2026" style="width:100%;font-size:0.82rem;"></textarea></div>'+
    '</div></details>'+
    '<button class="bai" onclick="execFullGen()" style="margin-top:0.8rem;width:100%;">\uD83D\uDE80 \u5f00\u59cb\u751f\u6210\u5386\u53f2\u5267\u672c</button>'+
    '<div id="fg-status" style="font-size:0.82rem;color:var(--txt-d);margin-top:0.3rem;"></div></div>';
}

// ---- patch execFullGen: wrap callAI to prepend style+ref prefix to all 11 prompts ----
var _orig_execFullGen = typeof execFullGen === 'function' ? execFullGen : null;
window.execFullGen = async function() {
  var styleEl = document.getElementById('fg-style');
  var refEl = document.getElementById('fg-ref');
  var styleVal = (styleEl && styleEl.value.trim()) || (P.conf && P.conf.style) || '';
  var refVal = (refEl && refEl.value.trim()) || (P.conf && P.conf.refText) || '';
  var prefix = _aiStylePrefix(styleVal, refVal);
  if (!prefix || !_orig_execFullGen) {
    if (_orig_execFullGen) return _orig_execFullGen.apply(this, arguments);
    return;
  }
  var _origCallAI = callAI;
  callAI = function(prompt, maxTok, signal) {
    return _origCallAI(prefix + prompt, maxTok, signal);
  };
  try {
    return await _orig_execFullGen.apply(this, arguments);
  } finally {
    callAI = _origCallAI;
    if (typeof _fgHideProgress === 'function') _fgHideProgress();
  }
}

})();

// ========================================================
// Phase 6: editTech / editFac / editRul / editEvt
// + render overrides with edit buttons
// ========================================================

// ---- editTech(i) ----
function editTech(i) {
  var t = P.techTree[i];
  if (!t) return;
  openGenericModal(
    '\u7F16\u8F91\u79D1\u6280',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="etk-name" value="' + (t.name||'') + '"></div>'+
    '<div class="form-group"><label>\u63CF\u8FF0</label><textarea id="etk-desc" rows="2">' + (t.desc||'') + '</textarea></div>'+
    '<div class="form-group"><label>\u65F6\u4EE3</label><select id="etk-era"><option value="\u521D\u7EA7"' + (t.era==='\u521D\u7EA7'?' selected':'') + '>\u521D\u7EA7</option><option value="\u4E2D\u7EA7"' + (t.era==='\u4E2D\u7EA7'?' selected':'') + '>\u4E2D\u7EA7</option><option value="\u9AD8\u7EA7"' + (t.era==='\u9AD8\u7EA7'?' selected':'') + '>\u9AD8\u7EA7</option></select></div>'+
    '<div class="form-group"><label>\u524D\u7F6E\u6761\u4EF6(\u9017\u53F7\u5206\u9694)</label><input id="etk-prereqs" value="' + (t.prereqs||[]).join(',') + '"></div>'+
    '<div class="form-group"><label>\u6548\u679C(JSON)</label><input id="etk-effect" value="' + JSON.stringify(t.effect||{}) + '"></div>',
    function() {
      var tk = P.techTree[i];
      if (!tk) return;
      tk.name = gv('etk-name');
      tk.desc = gv('etk-desc');
      tk.era = gv('etk-era');
      tk.prereqs = gv('etk-prereqs').split(',').map(function(s){return s.trim();}).filter(Boolean);
      try { tk.effect = JSON.parse(gv('etk-effect')); } catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
      renderEdTab('t-tech');
    }
  );
}

// ---- override renderTechTab with edit buttons ----
function renderTechTab(em, sid) {
  var list = P.techTree.filter(function(t){ return t.sid===sid; });
  em.innerHTML =
    '<h4 style="color:var(--gold);">\u79D1\u6280\u6811 (' + list.length + ')</h4>'+
    '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">'+
    '<button class="bt bp" onclick="openGenericModal(\u0027\u6DFB\u52A0\u79D1\u6280\u0027,'+
    '\u0027<div class=\\"form-group\\"><label>\u540D\u79F0</label><input id=\\"ntk-name\\" placeholder=\"\u65B0\u79D1\u6280\"></div><div class=\\"form-group\\"><label>\u63CF\u8FF0</label><textarea id=\\"ntk-desc\\" rows=\\"2\\"></textarea></div><div class=\\"form-group\\"><label>\u65F6\u4EE3</label><select id=\\"ntk-era\\"><option value=\\"\u521D\u7EA7\\" selected>\u521D\u7EA7</option><option value=\\"\u4E2D\u7EA7\\">\u4E2D\u7EA7</option><option value=\\"\u9AD8\u7EA7\\">\u9AD8\u7EA7</option></select></div>\u0027,'+
    'function(){P.techTree.push({sid:editingScenarioId,name:gv(\u0027ntk-name\u0027)||\u0027\u65B0\u79D1\u6280\u0027,desc:gv(\u0027ntk-desc\u0027),prereqs:[],costs:[],effect:{},era:gv(\u0027ntk-era\u0027),unlocked:false});renderEdTab(\u0027t-tech\u0027);});">\uFF0B</button>'+
    '<button class="bai" onclick="aiGenTech()">\uD83E\uDD16 AI\u751F\u6210</button></div>'+
    list.map(function(t) {
      var i = P.techTree.indexOf(t);
      return '<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<span><strong>' + t.name + '</strong> <span class="tg">' + (t.era||'') + '</span></span>'+
        '<span><button class="bt bsm" onclick="editTech(' + i + ')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.techTree.splice(' + i + ',1);renderEdTab(\u0027t-tech\u0027);">\u2715</button></span></div>'+
        (t.desc ? '<div style="font-size:0.82rem;color:var(--txt-d);margin-top:0.3rem;">' + t.desc + '</div>' : '') +
        '</div>';
    }).join('') || '<div style="color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0</div>';
}

// ---- editFac(i) ----
function editFac(i) {
  var f = P.factions[i];
  if (!f) return;
  openGenericModal(
    '\u7F16\u8F91\u6D3E\u7CFB',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="efc-name" value="' + (f.name||'') + '"></div>'+
    '<div class="form-group"><label>\u9886\u8896</label><input id="efc-leader" value="' + (f.leader||'') + '"></div>'+
    '<div class="form-group"><label>\u63CF\u8FF0</label><textarea id="efc-desc" rows="2">' + (f.desc||'') + '</textarea></div>'+
    '<div class="form-group"><label>\u610F\u8BC6\u5F62\u6001</label><input id="efc-ideology" value="' + (f.ideology||'') + '"></div>'+
    '<div class="form-group"><label>\u5730\u76D8</label><input id="efc-territory" value="' + (f.territory||'') + '"></div>'+
    '<div class="form-group"><label>\u5B9E\u529B (0-100)</label><input type="range" id="efc-strength" min="0" max="100" value="' + (f.strength!=null?f.strength:50) + '" oninput="document.getElementById(\u0027efc-strength-v\u0027).textContent=this.value"> <span id="efc-strength-v">' + (f.strength!=null?f.strength:50) + '</span></div>',
    function() {
      var fc = P.factions[i];
      if (!fc) return;
      fc.name = gv('efc-name');
      fc.leader = gv('efc-leader');
      fc.desc = gv('efc-desc');
      fc.ideology = gv('efc-ideology');
      fc.territory = gv('efc-territory');
      fc.strength = parseInt(gv('efc-strength'))||50;
      renderEdTab('t-fac');
    }
  );
}

// ---- override renderFacTab with edit buttons ----
function renderFacTab(em, sid) {
  var list = P.factions.filter(function(f){ return f.sid===sid; });
  em.innerHTML =
    '<h4 style="color:var(--gold);">\uD83C\uDFDB \u6D3E\u7CFB (' + list.length + ')</h4>'+
    '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">'+
    '<button class="bt bp" onclick="P.factions.push({sid:editingScenarioId,name:\u0027\u65B0\u6D3E\u7CFB\u0027,leader:\u0027\u0027,desc:\u0027\u0027,color:\u0027#888\u0027,traits:[],strength:50,territory:\u0027\u0027,ideology:\u0027\u0027,courtInfluence:50,popularInfluence:30});renderEdTab(\u0027t-fac\u0027);">\uFF0B</button>'+
    '<button class="bai" onclick="aiGenFac()">\uD83E\uDD16 AI\u751F\u6210</button></div>'+
    list.map(function(f) {
      var i = P.factions.indexOf(f);
      return '<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<strong>' + f.name + '</strong>'+
        '<span><button class="bt bsm" onclick="editFac(' + i + ')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.factions.splice(' + i + ',1);renderEdTab(\u0027t-fac\u0027);">\u2715</button></span></div>'+
        (f.desc ? '<div style="font-size:0.82rem;color:var(--txt-d);margin-top:0.2rem;">' + f.desc + '</div>' : '') +
        '</div>';
    }).join('') || '<div style="color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0</div>';
}

// ---- editRul(i) ----
function editRul(i) {
  var r = P.rules[i];
  if (!r) return;
  openGenericModal(
    '\u7F16\u8F91\u89C4\u5219',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="erl-name" value="' + (r.name||'') + '"></div>'+
    '<div class="form-group"><label>\u89E6\u53D1\u53D8\u91CF</label><input id="erl-var" value="' + (r.trigger&&r.trigger.variable||'') + '"></div>'+
    '<div class="form-group"><label>\u89E6\u53D1\u6761\u4EF6</label>'+
    '<select id="erl-op"><option value="&lt;"' + ((r.trigger&&r.trigger.op)==='<'?' selected':'') + '>&lt;</option>'+
    '<option value="&gt;"' + ((r.trigger&&r.trigger.op)==='>'?' selected':'') + '>&gt;</option>'+
    '<option value="=="' + ((r.trigger&&r.trigger.op)==='=='?' selected':'') + '>&gt;=</option></select>'+
    ' <input id="erl-val" type="number" value="' + (r.trigger&&r.trigger.value!=null?r.trigger.value:20) + '" style="width:60px;"></div>'+
    '<div class="form-group"><label>\u53D9\u4E8B\u6548\u679C</label><textarea id="erl-narrative" rows="2">' + (r.effect&&r.effect.narrative||'') + '</textarea></div>'+
    '<div class="form-group"><label>\u542F\u7528</label><input type="checkbox" id="erl-enabled"' + (r.enabled?' checked':'') + '></div>',
    function() {
      var rl = P.rules[i];
      if (!rl) return;
      rl.name = gv('erl-name');
      rl.enabled = document.getElementById('erl-enabled').checked;
      if (!rl.trigger) rl.trigger = {type:'threshold',variable:'',op:'<',value:20};
      rl.trigger.variable = gv('erl-var');
      rl.trigger.op = gv('erl-op');
      rl.trigger.value = parseFloat(gv('erl-val'))||0;
      if (!rl.effect) rl.effect = {narrative:'',varChg:{},event:null};
      rl.effect.narrative = gv('erl-narrative');
      renderEdTab('t-rul');
    }
  );
}

// ---- override renderRulTab with edit buttons ----
function renderRulTab(em, sid) {
  var list = P.rules.filter(function(r){ return r.sid===sid; });
  em.innerHTML =
    '<h4 style="color:var(--gold);">\u89C4\u5219 (' + list.length + ')</h4>'+
    '<button class="bt bp" style="margin-bottom:0.5rem;" onclick="P.rules.push({sid:editingScenarioId,name:\u0027\u65B0\u89C4\u5219\u0027,enabled:true,trigger:{type:\u0027threshold\u0027,variable:\u0027\u0027,op:\u0027<\u0027,value:20},effect:{narrative:\u0027\u0027,varChg:{},event:null}});renderEdTab(\u0027t-rul\u0027);">\uFF0B</button>'+
    list.map(function(r) {
      var i = P.rules.indexOf(r);
      return '<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<strong>' + r.name + '</strong>'+
        '<span><button class="bt bsm" onclick="editRul(' + i + ')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.rules.splice(' + i + ',1);renderEdTab(\u0027t-rul\u0027);">\u2715</button></span></div>'+
        '<div style="font-size:0.78rem;color:var(--txt-d);">' + (r.trigger&&r.trigger.variable?r.trigger.variable+' '+r.trigger.op+' '+r.trigger.value:'') + '</div>'+
        '</div>';
    }).join('') || '<div style="color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0</div>';
}

// ---- editEvt(i) ----
function editEvt(i) {
  var ev = P.events[i];
  if (!ev) return;
  openGenericModal(
    '\u7F16\u8F91\u4E8B\u4EF6',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="evt-name" value="' + (ev.name||'') + '"></div>'+
    '<div class="form-group"><label>\u89E6\u53D1\u56DE\u5408</label><input type="number" id="evt-turn" value="' + (ev.triggerTurn||0) + '"></div>'+
    '<div class="form-group"><label>\u7C7B\u578B</label>'+
    '<select id="evt-type"><option value="scripted"' + (ev.type==='scripted'?' selected':'') + '>scripted</option>'+
    '<option value="random"' + (ev.type==='random'?' selected':'') + '>random</option></select></div>'+
    '<div class="form-group"><label>\u53D9\u4E8B</label><textarea id="evt-narrative" rows="3">' + (ev.narrative||'') + '</textarea></div>'+
    '<div class="form-group"><label><input type="checkbox" id="evt-onetime"' + (ev.oneTime?' checked':'') + '> \u4EC5\u89E6\u53D1\u4E00\u6B21</label></div>',
    function() {
      var ev2 = P.events[i];
      if (!ev2) return;
      ev2.name = gv('evt-name');
      ev2.triggerTurn = parseInt(gv('evt-turn'))||0;
      ev2.type = gv('evt-type');
      ev2.narrative = gv('evt-narrative');
      ev2.oneTime = document.getElementById('evt-onetime').checked;
      renderEdTab('t-evt');
    }
  );
}

// ---- override renderEvtTab with edit buttons ----
function renderEvtTab(em, sid) {
  var list = P.events.filter(function(ev){ return ev.sid===sid; });
  em.innerHTML =
    '<h4 style="color:var(--gold);">\u4E8B\u4EF6 (' + list.length + ')</h4>'+
    '<button class="bt bp" style="margin-bottom:0.5rem;" onclick="P.events.push({sid:editingScenarioId,id:uid(),name:\u0027\u65B0\u4E8B\u4EF6\u0027,type:\u0027scripted\u0027,triggerTurn:0,oneTime:true,triggered:false,narrative:\u0027\u0027,choices:[]});renderEdTab(\u0027t-evt\u0027);">\uFF0B</button>'+
    list.map(function(ev) {
      var i = P.events.indexOf(ev);
      return '<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<strong>' + ev.name + '</strong>'+
        '<span><button class="bt bsm" onclick="editEvt(' + i + ')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.events.splice(' + i + ',1);renderEdTab(\u0027t-evt\u0027);">\u2715</button></span></div>'+
        '<div style="font-size:0.78rem;color:var(--txt-d);">\u7B2C ' + (ev.triggerTurn||0) + ' \u56DE\u5408 | ' + (ev.type||'scripted') + (ev.oneTime?' | \u5355\u6B21':'') + '</div>'+
        '</div>';
    }).join('') || '<div style="color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0</div>';
}

// ---- Feature 7: Enhanced game modes — pre-turn prompt injection ----
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子10）

// ---- Feature 6: Reference book import + world rules — patch renderWldTab ----
(function(){
  var _origRenderWldTab = typeof renderWldTab === 'function' ? renderWldTab : null;
  renderWldTab = function(em, sid) {
    if (_origRenderWldTab) _origRenderWldTab.apply(this, arguments);
    if (!em) em = _$('em');
    if (!em) return;
    var refVal = (typeof P !== 'undefined' && P.conf && P.conf.refText) ? P.conf.refText : '';
    var refSection = document.createElement('div');
    refSection.id = 'wld-ref-section';
    refSection.innerHTML =
      '<hr class="dv">'+
      '<div style="font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">参考书目</div>'+
      '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.5rem;">全局参考资料，供 AI 生成和史实模式使用。</div>'+
      '<div class="fd full">'+
      '<label>参考资料（可粘贴史书段落、论文等）</label>'+
      '<textarea id="wld-ref-text" rows="6" style="width:100%;" placeholder="在此粘贴参考文本…">' + (refVal.replace(/</g,'&lt;').replace(/>/g,'&gt;')) + '</textarea>'+
      '</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;">'+
      '<button class="bt bp" onclick="_wldSaveRef()">✅ 保存参考资料</button>'+
      '<button class="bt" onclick="_wldImportRef()">📂 导入文件</button>'+
      '<button class="bd" onclick="if(confirm(\'\u786e认清空参考资料?\')){\'wld-ref-text\';document.getElementById(\'wld-ref-text\').value=\'\';_wldSaveRef();toast(\'\u5df2清空\');}">\uD83D\uDDD1\uFE0F 清空</button>'+
      '</div>'+
      '<div id="wld-ref-info" style="font-size:0.78rem;color:var(--txt-d);margin-top:0.25rem;">' + (refVal ? '已存储 ' + refVal.length + ' 字符' : '未设置') + '</div>';
    em.appendChild(refSection);
  };
})();

function _wldSaveRef() {
  var el = document.getElementById('wld-ref-text');
  if (!el) return;
  if (!P.conf) P.conf = {};
  P.conf.refText = el.value;
  saveP();
  var info = document.getElementById('wld-ref-info');
  if (info) info.textContent = P.conf.refText ? '已存储 ' + P.conf.refText.length + ' 字符' : '未设置';
  toast('✅ 参考资料已保存');
}

function _wldImportRef() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.md';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var el = document.getElementById('wld-ref-text');
      if (el) {
        el.value = ev.target.result;
        _wldSaveRef();
      }
    };
    reader.readAsText(file, 'utf-8');
  };
  input.click();
}

// ============================================================
//  Phase 6 overrides: renderCivicTab / renderOfficeTab / aiGenOfficeEd
// ============================================================

// Override renderCivicTab: replace inline push with openGenericModal
function renderCivicTab(em) {
  var sid = editingScenarioId;
  var rows = (P.civicTree || []).map(function(c, i) {
    if (c.sid !== sid) return '';
    return '<div class="card" style="margin-bottom:6px;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;">'+
      '<strong>' + (c.name || '') + '</strong>'+
      '<span><button class="bt bsm" onclick="editCivic(' + i + ')">' + '\u7F16\u8F91</button>'+
      '<button class="bd bsm" onclick="P.civicTree.splice(' + i + ',1);renderEdTab(\'t-civic\');">\u2715</button></span>'+
      '</div>'+
      '<div style="font-size:12px;color:var(--txt-d);margin-top:2px;">' + (c.desc || '') + '</div>'+
      '</div>';
  }).join('');
  em.innerHTML = '<h4 style="color:var(--gold);">\u5E02\u653F\u6811</h4>'+
    '<div style="display:flex;gap:8px;margin-bottom:0.5rem;">'+
    '<button class="bt bp" onclick="_addCivic()">\uFF0B</button>'+
    '<button class="bt" onclick="aiGenCivic()">\u2728 AI\u751F\u6210</button>'+
    '</div>' + rows;
}

// _addCivic: open modal to create new civic item
function _addCivic() {
  openGenericModal('\u65B0\u5EFA\u5E02\u653F',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="gmf-name" placeholder="\u5E02\u653F\u540D\u79F0"></div>'+
    '<div class="form-group"><label>\u63CF\u8FF0</label><textarea id="gmf-desc" rows="2"></textarea></div>'+
    '<div class="form-group"><label>\u65F6\u4EE3</label><input id="gmf-era" value="\u521D\u7EA7"></div>',
    function() {
      if (!P.civicTree) P.civicTree = [];
      P.civicTree.push({
        sid: editingScenarioId,
        name: gv('gmf-name') || '\u65B0\u5E02\u653F',
        desc: gv('gmf-desc'),
        era: gv('gmf-era') || '\u521D\u7EA7',
        prereqs: [], costs: [], effect: {}, adopted: false
      });
      renderEdTab('t-civic');
    }
  );
}

// Office hierarchy helpers
function _officeGetByPath(path) {
  if (!P.officeTree) P.officeTree = [];
  var node = { subs: P.officeTree };
  var i = 0;
  while (i < path.length) {
    var seg = path[i];
    if (seg === 's') {
      // next segment is the sub-dept index
      i++; if (i >= path.length) return null;
      if (!node.subs) return null;
      node = node.subs[path[i]];
    } else if (seg === 'p') {
      // next segment is the position index
      i++; if (i >= path.length) return null;
      if (!node.positions) return null;
      node = node.positions[path[i]];
    } else {
      // legacy numeric-only path (top-level dept index)
      if (!node.subs) return null;
      node = node.subs[seg];
    }
    if (!node) return null;
    i++;
  }
  return node;
}
function _officeGetParentArr(path) {
  if (path.length === 0) return P.officeTree;
  // For tree-style paths ending in ['s', idx] or legacy [idx]
  var parentPath = path.slice(0, -2);
  var lastMarker = path[path.length - 2];
  if (lastMarker !== 's' && lastMarker !== 'p') {
    // legacy single-segment path
    return P.officeTree;
  }
  var parent = _officeGetByPath(parentPath);
  if (!parent) return null;
  if (lastMarker === 'p') {
    if (!parent.positions) parent.positions = [];
    return parent.positions;
  }
  if (!parent.subs) parent.subs = [];
  return parent.subs;
}
function _officeBuildTree(collapsed, opts) {
  if (!P.officeTree) P.officeTree = [];
  var W = (opts && opts.W) || 150, H = (opts && opts.H) || 44;
  var H_GAP = (opts && opts.H_GAP) || 30, V_GAP = (opts && opts.V_GAP) || 90;

  // Build a virtual Emperor root that wraps all top-level depts
  var rootData = {name: '皇帝', desc: '', positions: [], subs: P.officeTree};

  function buildNode(nd, path, depth, isPos, posIdx) {
    var key = JSON.stringify(path);
    var isCollapsed = !!(collapsed && collapsed[key]);
    var children = [];
    if (!isPos && !isCollapsed) {
      // dept children first: sub-departments
      var subs = nd.subs || [];
      for (var i = 0; i < subs.length; i++)
        children.push(buildNode(subs[i], path.concat(['s', i]), depth + 1, false, -1));
      // then positions as leaf nodes
      var ps = nd.positions || [];
      for (var pi = 0; pi < ps.length; pi++)
        children.push(buildNode(ps[pi], path.concat(['p', pi]), depth + 1, true, pi));
    }
    return {node: nd, path: path, depth: depth, children: children,
            isPos: isPos, posIdx: posIdx,
            leafCount: 0, x: 0, y: 0, w: W, h: H,
            collapsed: isCollapsed && !isPos};
  }

  function countLeaves(n) {
    if (!n.children.length) { n.leafCount = 1; return 1; }
    var total = 0;
    for (var i = 0; i < n.children.length; i++) total += countLeaves(n.children[i]);
    n.leafCount = Math.max(total, 1);
    return n.leafCount;
  }

  function assignXY(n, leftLeaf) {
    n.y = n.depth * (H + V_GAP);
    if (!n.children.length) {
      n.x = leftLeaf * (W + H_GAP);
    } else {
      var cursor = leftLeaf;
      for (var i = 0; i < n.children.length; i++) {
        assignXY(n.children[i], cursor);
        cursor += n.children[i].leafCount;
      }
      var fc = n.children[0], lc = n.children[n.children.length - 1];
      n.x = (fc.x + fc.w / 2 + lc.x + lc.w / 2) / 2 - W / 2;
    }
  }

  var flat = [];
  function flatten(n, parentRef) {
    var entry = {node: n.node, path: n.path, depth: n.depth,
                 x: n.x, y: n.y, w: n.w, h: n.h,
                 parent: parentRef, children: n.children,
                 collapsed: n.collapsed, isPos: n.isPos, posIdx: n.posIdx};
    flat.push(entry);
    for (var i = 0; i < n.children.length; i++) flatten(n.children[i], entry);
  }

  var root = buildNode(rootData, [], 0, false, -1);
  countLeaves(root);
  assignXY(root, 0);
  flatten(root, null);

  var maxX = 0, maxY = 0;
  for (var i = 0; i < flat.length; i++) {
    if (flat[i].x + flat[i].w > maxX) maxX = flat[i].x + flat[i].w;
    if (flat[i].y + flat[i].h > maxY) maxY = flat[i].y + flat[i].h;
  }
  return {flat: flat, width: maxX + H_GAP * 4, height: maxY + V_GAP * 2,
          nodeW: W, nodeH: H};
}

// v10·嵌套群组四层树 Emperor → Group → Dept → Pos（群组纵叠）
// opts: { courtKey, subTab, collapsed, W_DEPT, W_POS, H_DEPT, H_POS, H_GROUP, H_EMP }
function _officeBuildTreeV10(opts) {
  opts = opts || {};
  var courtKey = opts.courtKey || 'central';
  var subTab = opts.subTab || 'all';
  var collapsed = opts.collapsed || {};

  var EMP_W = opts.EMP_W || 240;
  var EMP_H = opts.EMP_H || 90;
  var GROUP_H = opts.GROUP_H || 60;
  var DEPT_W = opts.DEPT_W || 220;
  var DEPT_H = opts.DEPT_H || 110;
  var POS_W = opts.POS_W || 240;
  var POS_H = opts.POS_H || 210;
  var H_GAP = opts.H_GAP || 22;
  var DEPT_GAP = opts.DEPT_GAP || 16;
  var V_GAP = opts.V_GAP || 46;
  var V_GAP_GROUP = opts.V_GAP_GROUP || 32;

  var depts = P.officeTree || [];
  // 分类（不在 tm-audio-theme.js 中硬编 map·依赖 window._officeClassifyDept）
  var classify = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept : function(){ return { court:'central', group:'sijian' }; };

  // 过滤属于本 court 的部门·并进一步按 subTab
  var courtDepts = [];
  depts.forEach(function(d, idx){
    var cls = classify(d);
    if (cls.court !== courtKey) return;
    if (subTab !== 'all' && cls.group !== subTab) return;
    courtDepts.push({ dept:d, idx:idx, group:cls.group });
  });

  // 群组分桶·保持 subTab 顺序
  var GROUP_ORDER = (typeof OFFICE_SUBTABS !== 'undefined' && OFFICE_SUBTABS[courtKey])
    ? OFFICE_SUBTABS[courtKey].filter(function(g){ return g.key !== 'all'; })
    : [];
  var groupBuckets = {};
  GROUP_ORDER.forEach(function(g){ groupBuckets[g.key] = []; });
  courtDepts.forEach(function(cd){
    if (!groupBuckets[cd.group]) groupBuckets[cd.group] = [];
    groupBuckets[cd.group].push(cd);
  });

  // Emperor 虚根
  var emperor = { type:'emperor', node:null, children:[], parent:null, w:EMP_W, h:EMP_H, depth:0, path:[] };

  // 构造群组子树
  var groupNodes = [];
  GROUP_ORDER.forEach(function(g){
    var bucket = groupBuckets[g.key] || [];
    if (bucket.length === 0) return;
    var gNode = {
      type:'group', node:null, groupCfg:g, groupKey:g.key, courtKey:courtKey,
      children:[], parent:emperor, w:0, h:GROUP_H, depth:1
    };
    bucket.forEach(function(cd){
      var key = JSON.stringify([cd.idx]);
      var isCollapsed = !!collapsed[key];
      var deptNode = {
        type:'dept', node:cd.dept, path:[cd.idx], deptIdx:cd.idx,
        collapsed:isCollapsed, children:[], parent:gNode,
        w:DEPT_W, h:DEPT_H, depth:2
      };
      if (!isCollapsed) {
        (cd.dept.positions || []).forEach(function(p, pi){
          deptNode.children.push({
            type:'pos', node:p, deptName:cd.dept.name, deptIdx:cd.idx, posIdx:pi,
            path:[cd.idx, 'p', pi], children:[], parent:deptNode,
            w:POS_W, h:POS_H, depth:3
          });
        });
      }
      gNode.children.push(deptNode);
    });
    groupNodes.push(gNode);
  });
  emperor.children = groupNodes;

  // leafCount 递归
  function countLeaves(n) {
    if (!n.children.length) { n.leafCount = 1; return 1; }
    var t = 0;
    for (var i = 0; i < n.children.length; i++) t += countLeaves(n.children[i]);
    n.leafCount = Math.max(t, 1);
    return n.leafCount;
  }
  groupNodes.forEach(countLeaves);

  // 每群组独立布局·按行纵叠
  var yCursor = EMP_H + V_GAP;
  groupNodes.forEach(function(gNode) {
    var groupY = yCursor;
    var deptY = groupY + GROUP_H + V_GAP_GROUP;
    var posY = deptY + DEPT_H + V_GAP;
    var hasExp = gNode.children.some(function(d){ return d.children.length > 0; });

    function assignXY(n, leftX) {
      if (n.type === 'group') n.y = groupY;
      else if (n.type === 'dept') n.y = deptY;
      else if (n.type === 'pos') n.y = posY;

      if (!n.children.length) {
        var slotW = (n.type === 'pos') ? (POS_W + H_GAP) : (DEPT_W + DEPT_GAP);
        n.x = leftX + (slotW - n.w) / 2;
        n.slotW = slotW;
      } else {
        var cursor = leftX;
        n.children.forEach(function(c){ assignXY(c, cursor); cursor += c.slotW; });
        var fc = n.children[0], lc = n.children[n.children.length-1];
        if (n.type === 'group') {
          n.w = (lc.x + lc.w) - fc.x + 40;
          n.x = fc.x - 20;
          n.slotW = cursor - leftX;
        } else {
          var centerX = (fc.x + fc.w/2 + lc.x + lc.w/2) / 2;
          n.x = centerX - n.w/2;
          n.slotW = cursor - leftX;
        }
      }
    }
    assignXY(gNode, 0);

    if (hasExp) yCursor = posY + POS_H + V_GAP * 1.4;
    else yCursor = deptY + DEPT_H + V_GAP * 1.4;
  });

  // 水平居中所有群组到同一 cx（等于皇帝 cx）
  var maxGroupW = EMP_W;
  groupNodes.forEach(function(g){ if (g.w > maxGroupW) maxGroupW = g.w; });
  var leftPad = 50;
  var emperorCx = leftPad + maxGroupW / 2;

  groupNodes.forEach(function(gNode){
    var delta = emperorCx - (gNode.x + gNode.w / 2);
    function shift(n){ n.x += delta; n.children.forEach(shift); }
    shift(gNode);
  });

  emperor.x = emperorCx - EMP_W / 2;
  emperor.y = 0;

  var canvasWidth = 2 * leftPad + maxGroupW;
  var canvasHeight = groupNodes.length > 0 ? yCursor : (EMP_H + V_GAP * 2);

  var flat = [emperor];
  groupNodes.forEach(function(gNode){
    flat.push(gNode);
    gNode.children.forEach(function(d){
      flat.push(d);
      d.children.forEach(function(p){ flat.push(p); });
    });
  });

  return {
    flat: flat,
    root: emperor,
    groupNodes: groupNodes,
    emperorCx: emperorCx,
    width: canvasWidth,
    height: canvasHeight,
    isEmpty: groupNodes.length === 0
  };
}

function renderOfficeTab(em) {
  if (!P.officeTree) P.officeTree = [];
  if (!P._officeCollapsed) P._officeCollapsed = {};
  var layout = _officeBuildTree(P._officeCollapsed);
  var flat   = layout.flat;
  var NW = layout.nodeW, NH = layout.nodeH;
  var cw = Math.max(layout.width  + 80, 700);
  var ch = Math.max(layout.height + 80, 400);

  // SVG elbow connectors
  var svgLines = '';
  for (var i = 0; i < flat.length; i++) {
    var fi = flat[i];
    if (!fi.parent) continue;
    var px = fi.parent.x + fi.parent.w / 2;
    var py = fi.parent.y + fi.parent.h;
    var cx = fi.x + fi.w / 2;
    var cy = fi.y;
    var my = py + (cy - py) * 0.5;
    var clr = fi.isPos ? '#4a6a3a' : '#8a6e2e';
    var dsh = fi.isPos ? ' stroke-dasharray="4,3"' : '';
    svgLines += '<path d="M' + px + ',' + py
      + ' L' + px + ',' + my
      + ' L' + cx + ',' + my
      + ' L' + cx + ',' + cy + '"'
      + ' stroke="' + clr + '" stroke-width="1.5" fill="none" opacity="0.9"' + dsh + '/>';
  }

  // Node cards
  var nodesDivs = '';
  for (var i = 0; i < flat.length; i++) {
    var fi  = flat[i];
    var nd  = fi.node;
    var pathStr = JSON.stringify(fi.path);

    if (fi.isPos) {
      // ── Position leaf card ──
      nodesDivs +=
        '<div style="position:absolute;left:' + fi.x + 'px;top:' + fi.y + 'px;'
        + 'width:' + NW + 'px;height:' + NH + 'px;box-sizing:border-box;'
        + 'border:1px solid #2a4a24;border-radius:5px;background:#080e06;'
        + 'overflow:hidden;box-shadow:0 1px 5px rgba(0,0,0,0.6)">';
      nodesDivs +=
        '<div style="display:flex;align-items:center;gap:3px;padding:3px 4px;height:100%;box-sizing:border-box">';
      nodesDivs +=
        '<div style="width:20px;height:20px;border-radius:3px;border:1px solid #2a4a24;'
        + 'background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;'
        + 'font-size:10px;color:#6a9a50;flex-shrink:0">位</div>';
      nodesDivs += '<div style="flex:1;min-width:0">';
      var _svgSuccLabel = '';
      if (nd.succession) {
        var _svgSL = {appointment:'\u6D41',hereditary:'\u88AD',examination:'\u79D1',military:'\u519B',recommendation:'\u8350'};
        _svgSuccLabel = _svgSL[nd.succession] ? '<span style="font-size:8px;background:#2a3a24;padding:0 2px;border-radius:2px;color:#7a9a60;margin-left:2px;">' + _svgSL[nd.succession] + '</span>' : '';
      }
      nodesDivs +=
        '<div style="font-size:12px;color:#9ac870;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + (nd.name || '?') + _svgSuccLabel + '</div>';
      if (nd.rank || nd.holder) {
        nodesDivs += '<div style="font-size:10px;color:#5a7a42;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">';
        if (nd.rank)   nodesDivs += nd.rank;
        if (nd.holder) nodesDivs += (nd.rank ? ' \u2013 ' : '') + nd.holder;
        nodesDivs += '</div>';
      }
      nodesDivs += '</div>';
      nodesDivs +=
        '<div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">';
      // fi.path for pos is [...deptPath, 'p', pi] — need deptPath and pi separately
      var deptPath4 = fi.path.slice(0, fi.path.length - 2);
      var pi4 = fi.posIdx;
      nodesDivs +=
        '<button class="bd" style="font-size:9px;padding:0 3px;line-height:15px" '
        + 'onclick="_officeEditPos(' + JSON.stringify(deptPath4) + ',' + pi4 + ')">✎</button>';
      nodesDivs +=
        '<button class="bd" style="font-size:9px;padding:0 3px;line-height:15px" '
        + 'onclick="_officeDelPos(' + JSON.stringify(deptPath4) + ',' + pi4 + ')">×</button>';
      nodesDivs += '</div></div></div>';

    } else {
      // ── Department card ──
      var isEmperor = fi.depth === 0;
      var isRoot1   = fi.depth === 1;
      var borderC  = isEmperor ? '#d4a020' : (isRoot1 ? '#8a6e2e' : '#4a3a18');
      var headerBg = isEmperor ? '#2a1a00' : (isRoot1 ? '#1a1206' : '#121008');
      var cardBg   = isEmperor ? '#1e1600' : (isRoot1 ? '#140f04' : '#0e0b04');
      var nameClr  = isEmperor ? '#ffd040' : (isRoot1 ? '#e0b840' : '#c09428');
      var bw       = isEmperor ? '2.5px' : (isRoot1 ? '1.5px' : '1px');
      var icon     = isEmperor ? '天' : (isRoot1 ? '山' : (fi.depth === 2 ? '司' : '所'));

      var psCount  = (nd.positions || []).length;
      var subCount = (nd.subs || []).length;
      var canCollapse = (psCount + subCount > 0) && !isEmperor;
      var isCollapsed4 = fi.collapsed;
      var colBtn = canCollapse
        ? '<button class="bd" style="font-size:9px;padding:0 3px;line-height:16px;margin-left:2px" '
          + 'onclick="_officeToggle(' + pathStr + ')" title="' + (isCollapsed4 ? '展开' : '折叠') + '">'
          + (isCollapsed4 ? '▼' : '▲') + '</button>'
        : '';

      nodesDivs +=
        '<div style="position:absolute;left:' + fi.x + 'px;top:' + fi.y + 'px;'
        + 'width:' + NW + 'px;box-sizing:border-box;border:' + bw + ' solid ' + borderC + ';'
        + 'border-radius:6px;background:' + cardBg + ';overflow:hidden;'
        + 'box-shadow:0 2px 8px rgba(0,0,0,0.7)">';

      // header row
      nodesDivs +=
        '<div style="display:flex;align-items:center;gap:3px;padding:4px 4px;background:' + headerBg + ';border-bottom:1px solid ' + borderC + '">';
      nodesDivs +=
        '<div style="width:20px;height:20px;border-radius:3px;border:1px solid ' + borderC + ';'
        + 'background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;'
        + 'font-size:11px;color:' + nameClr + ';flex-shrink:0">' + icon + '</div>';
      nodesDivs +=
        '<span style="flex:1;font-size:12px;font-weight:bold;color:' + nameClr + ';'
        + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (nd.name || '?') + '</span>';
      nodesDivs += colBtn;
      if (!isEmperor) {
        nodesDivs +=
          '<button class="bd" style="font-size:8px;padding:0 2px;line-height:16px" '
          + 'onclick="_officeEditDept(' + pathStr + ')">✎</button>';
        nodesDivs +=
          '<button class="bd" style="font-size:8px;padding:0 2px;line-height:16px" '
          + 'onclick="_officeAddSub(' + pathStr + ')">↓</button>';
        nodesDivs +=
          '<button class="bd" style="font-size:8px;padding:0 2px;line-height:16px" '
          + 'onclick="_officeDelDept(' + pathStr + ')">×</button>';
      }
      nodesDivs += '</div>';

      // desc + stats strip
      var descText4 = nd.desc || '';
      var statsText4 = '';
      if (psCount)  statsText4 += psCount + '位';
      if (subCount) statsText4 += (statsText4 ? ' ' : '') + subCount + '个子部';
      nodesDivs +=
        '<div style="display:flex;align-items:center;gap:4px;padding:2px 5px;font-size:9px;color:#6a5020">';
      nodesDivs += (descText4
        ? '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + descText4 + '</span>'
        : '<span style="flex:1"></span>');
      if (statsText4)
        nodesDivs += '<span>' + statsText4 + '</span>';
      nodesDivs +=
        '<button class="bt" style="font-size:8px;padding:0 3px;line-height:15px" '
        + 'onclick="_officeAddPos(' + pathStr + ')">+官词</button>';
      nodesDivs += '</div>';

      nodesDivs += '</div>';
    }
  }

  var canvasId  = 'office-tree-canvas';
  var svgId     = 'office-tree-svg';
  var wrapperId = 'office-tree-wrap';

  em.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'
    + '<h4 style="color:var(--gold);margin:0">官制树状图</h4>'
    + '<button class="bt bp" onclick="_officeAddTopDept()">＋ 顶层部门</button>'
    + '<button class="bai" onclick="aiGenOfficeEd()">&#x1F916; AI生成</button>'
    + '<span style="font-size:11px;color:var(--txt-d);margin-left:auto">滚轮缩放 拖动平移</span>'
    + '</div>'
    + '<div id="' + wrapperId + '" style="overflow:hidden;border:1px solid #3a2a10;border-radius:8px;background:#0a0804;position:relative;height:520px;cursor:grab">'
    + '<div id="' + canvasId + '" style="position:absolute;transform-origin:0 0;left:0;top:0;width:' + cw + 'px;height:' + ch + 'px">'
    + '<svg id="' + svgId + '" style="position:absolute;top:0;left:0;pointer-events:none" width="' + cw + '" height="' + ch + '">'
    + svgLines
    + '</svg>'
    + nodesDivs
    + '</div>'
    + '</div>';

  // Zoom + pan
  (function() {
    var wrap = document.getElementById(wrapperId);
    var canvas = document.getElementById(canvasId);
    if (!wrap || !canvas) return;
    var scale = 1, ox = 20, oy = 20;
    function applyTransform() {
      canvas.style.transform = 'translate('+ox+'px,'+oy+'px) scale('+scale+')';
    }
    applyTransform();
    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      var rect = wrap.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var delta = e.deltaY > 0 ? 0.85 : 1.18;
      var newScale = Math.max(0.2, Math.min(3, scale * delta));
      ox = mx - (mx - ox) * (newScale / scale);
      oy = my - (my - oy) * (newScale / scale);
      scale = newScale;
      applyTransform();
    }, {passive: false});
    var drag = null;
    wrap.addEventListener('mousedown', function(e) {
      var t = e.target;
      if (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      e.preventDefault();
      drag = {sx: e.clientX - ox, sy: e.clientY - oy};
      wrap.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', function(e) {
      if (!drag) return;
      ox = e.clientX - drag.sx;
      oy = e.clientY - drag.sy;
      applyTransform();
    });
    document.addEventListener('mouseup', function() {
      drag = null;
      if (wrap) wrap.style.cursor = 'grab';
    });
  })();
}
function _officeToggle(path) {
  if (!P._officeCollapsed) P._officeCollapsed = {};
  var key = JSON.stringify(path);
  P._officeCollapsed[key] = !P._officeCollapsed[key];
  renderEdTab('t-office');
}



function _renderOfficeDept(dept, path, depth) {
  if (!dept) return '';
  var ps = dept.positions || [];
  var pathStr = JSON.stringify(path);
  var borderStyle = depth === 0
    ? 'border:2px solid var(--gold-dim,#6b5a2e);border-radius:8px;margin-bottom:10px;'
    : 'border:1px solid var(--bg-4,#333);border-radius:6px;margin:6px 0 6px 16px;';
  var bgColor = depth === 0 ? 'var(--bg-2)' : 'var(--bg-3)';
  var fns = dept.functions || [];
  var fnHTML = fns.length
    ? '<div style="padding:3px 8px 6px 8px;display:flex;flex-wrap:wrap;gap:4px">' +
      fns.map(function(fn, fi) {
        return '<span style="background:var(--bg-4,#2a2a2a);color:var(--txt-d);font-size:11px;'
          + 'padding:1px 6px;border-radius:10px;cursor:pointer" '
          + 'onclick="_officeFnDel(' + pathStr + ',' + fi + ')" title="点击删除">× ' + fn + '</span>';
      }).join('') + '</div>'
    : '';
  var posHTML = ps.map(function(p, pi) {
    return '<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;border-top:1px solid var(--bg-4,#333)">'
      + '<span style="flex:1;font-size:12px;color:var(--txt-s)">'
      + (p.name||'')
      + (p.rank ? ' <span style="color:var(--txt-d);font-size:11px">('+p.rank+')</span>' : '')
      + (function(){var _sl={appointment:'\u6D41',hereditary:'\u88AD',examination:'\u79D1',military:'\u519B',recommendation:'\u8350'};return p.succession&&_sl[p.succession]?' <span style="font-size:9px;background:var(--bg-4);padding:0 3px;border-radius:2px;color:var(--txt-d)">'+_sl[p.succession]+'</span>':'';})()
      + (p.holder ? ' <span style="color:var(--gold);font-size:11px">&mdash;'+p.holder+'</span>' : '')
      + '</span>'
      + '<span style="font-size:11px;color:var(--txt-d);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
      + (p.desc||'') + '</span>'
      + '<button class="bd bsm" onclick="_officeEditPos(' + pathStr + ',' + pi + ')">✎</button>'
      + '<button class="bd bsm" onclick="_officeDelPos(' + pathStr + ',' + pi + ')">✕</button>'
      + '</div>';
  }).join('');
  var subsHTML = (dept.subs || []).map(function(sub, si) {
    return _renderOfficeDept(sub, path.concat(['s', si]), depth + 1);
  }).join('');
  return '<div style="' + borderStyle + 'overflow:hidden">'
    + '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:' + bgColor + '">'
    + '<strong style="flex:0 0 auto;color:var(--gold)">' + (depth===0?'▶':'▸') + ' ' + (dept.name||'') + '</strong>'
    + (dept.desc
        ? '<span style="font-size:11px;color:var(--txt-d);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + dept.desc + '</span>'
        : '<span style="flex:1"></span>')
    + '<button class="bt bsm" onclick="_officeEditDept(' + pathStr + ')">✎ 编辑</button>'
    + '<button class="bt bsm" onclick="_officeAddFn(' + pathStr + ')">＋ 职能</button>'
    + '<button class="bt bsm" onclick="_officeAddPos(' + pathStr + ')">＋ 官职</button>'
    + '<button class="bt bsm" onclick="_officeAddSub(' + pathStr + ')">＋ 子部门</button>'
    + '<button class="bd bsm" onclick="_officeDelDept(' + pathStr + ')">✕</button>'
    + '</div>'
    + fnHTML + posHTML
    + (subsHTML ? '<div style="padding:0 6px 6px 6px">' + subsHTML + '</div>' : '')
    + '</div>';
}

function _officeAddTopDept() {
  openGenericModal('新建顶层部门',
    '<div class="form-group"><label>部门名称</label><input id="gmf-name" placeholder="如：内阁、内府"></div>'+
    '<div class="form-group"><label>部门职能</label><textarea id="gmf-desc" placeholder="该部门负责的国家职能..."></textarea></div>',
    function() {
      if (!P.officeTree) P.officeTree = [];
      P.officeTree.push({ name: gv('gmf-name') || '新部门', desc: document.getElementById('gmf-desc').value || '', positions: [], subs: [] });
      renderEdTab('t-office');
    }
  );
}
function _officeEditDept(path) {
  var dept = _officeGetByPath(path);
  if (!dept) return;
  var fns = dept.functions || [];
  openGenericModal('编辑部门',
    '<div class="form-group"><label>部门名</label><input id="gmf-name" value="' + (dept.name||'') + '"></div>'+
    '<div class="form-group"><label>简介</label><input id="gmf-desc" value="' + (dept.desc||'') + '"></div>'+
    '<div class="form-group"><label>现有职能（共 ' + fns.length + ' 项，在部门卡头点『＋职能』添加）</label>'+
    '<div style="font-size:12px;color:var(--txt-d)">' + (fns.length ? fns.join('、') : '暂无') + '</div></div>',
    function() {
      dept.name = gv('gmf-name') || dept.name;
      dept.desc = gv('gmf-desc');
      renderEdTab('t-office');
    }
  );
}
function _officeAddSub(path) {
  var parent = _officeGetByPath(path);
  if (!parent) return;
  openGenericModal('新建子部门',
    '<div class="form-group"><label>子部门名称</label><input id="gmf-name" placeholder="如：中书房、门下省"></div>'+
    '<div class="form-group"><label>部门职能</label><textarea id="gmf-desc" placeholder="该子部门的职能..." style="min-height:60px"></textarea></div>',
    function() {
      if (!parent.subs) parent.subs = [];
      parent.subs.push({ name: gv('gmf-name') || '新子部门', desc: document.getElementById('gmf-desc').value || '', positions: [], subs: [] });
      renderEdTab('t-office');
    }
  );
}
function _officeDelDept(path) {
  var arr = _officeGetParentArr(path);
  if (!arr) return;
  arr.splice(path[path.length-1], 1);
  renderEdTab('t-office');
}
function _officeAddFn(path) {
  var dept = _officeGetByPath(path);
  if (!dept) return;
  openGenericModal('添加职能',
    '<div class="form-group"><label>职能描述</label><input id="gmf-fn" placeholder="如：考核官员绩效"></div>',
    function() {
      var fn = gv('gmf-fn').trim();
      if (!fn) return;
      if (!dept.functions) dept.functions = [];
      dept.functions.push(fn);
      renderEdTab('t-office');
    }
  );
}
function _officeFnDel(path, fi) {
  var dept = _officeGetByPath(path);
  if (!dept || !dept.functions) return;
  dept.functions.splice(fi, 1);
  renderEdTab('t-office');
}
function _officeAddPos(path) {
  var dept = _officeGetByPath(path);
  if (!dept) return;
  openGenericModal('新建官职',
    '<div class="form-group"><label>官职名</label><input id="gmf-name" placeholder="如：尚书、中书令"></div>'+
    '<div class="form-group"><label>任职者</label><input id="gmf-holder" placeholder="姓名（可留空）"></div>'+
    '<div class="form-group"><label>品级</label><input id="gmf-rank" placeholder="如：正一品、从三品"></div>'+
    '<div class="form-group"><label>职能描述</label><textarea id="gmf-desc" placeholder="该官职负责的具体职能..."></textarea></div>',
    function() {
      if (!dept.positions) dept.positions = [];
      dept.positions.push({ name: gv('gmf-name') || '新官职', holder: gv('gmf-holder'), rank: gv('gmf-rank'), desc: document.getElementById('gmf-desc').value || '' });
      renderEdTab('t-office');
    }
  );
}
function _officeEditPos(path, pi) {
  var dept = _officeGetByPath(path);
  if (!dept || !dept.positions[pi]) return;
  var p = dept.positions[pi];
  openGenericModal('编辑官职',
    '<div class="form-group"><label>官职名</label><input id="gmf-name" value="' + (p.name||'') + '"></div>'+
    '<div class="form-group"><label>任职者</label><input id="gmf-holder" value="' + (p.holder||'') + '"></div>'+
    '<div class="form-group"><label>品级</label><input id="gmf-rank" value="' + (p.rank||'') + '"></div>'+
    '<div class="form-group"><label>职能描述</label><textarea id="gmf-desc">' + (p.desc||'') + '</textarea></div>',
    function() {
      p.name = gv('gmf-name') || p.name;
      p.holder = gv('gmf-holder');
      p.rank = gv('gmf-rank');
      p.desc = document.getElementById('gmf-desc').value;
      renderEdTab('t-office');
    }
  );
}
function _officeDelPos(path, pi) {
  var dept = _officeGetByPath(path);
  if (!dept || !dept.positions) return;
  dept.positions.splice(pi, 1);
  renderEdTab('t-office');
}
function _addOfficeDept() { _officeAddTopDept(); }
function _addOfficePos(di) { _officeAddPos([di]); }

// AI生成官制——三阶段：A完整骨架 B关键角色 C可选补充
function aiGenOfficeEd() {
  var _scnBg = '';
  // 尝试从剧本中获取朝代背景
  if (typeof editingScenarioId !== 'undefined') {
    var _sc = (typeof findScenarioById === 'function') ? findScenarioById(editingScenarioId) : null;
    if (_sc) _scnBg = (_sc.era||'') + ' ' + (_sc.dynasty||'') + ' ' + (_sc.name||'');
  }
  openGenericModal('\uD83E\uDD16 AI\u751F\u6210\u5B98\u5236\uFF08\u5B8C\u6574\u7248\uFF09',
    '<div class="form-group"><label>\u671D\u4EE3 / \u5386\u53F2\u80CC\u666F\u65F6\u671F</label>'
    +'<input id="gmf-dynasty" placeholder="\u5982\uFF1A\u5510\u671D\u5F00\u5143\u5E74\u95F4\u3001\u660E\u671D\u5D07\u797A\u5341\u4E03\u5E74" value="' + escHtml(_scnBg) + '"></div>'
    +'<div class="form-group"><label>\u751F\u6210\u8303\u56F4</label>'
    +'<select id="gmf-scope"><option value="full">\u5B8C\u6574\u5B98\u5236\uFF08\u6240\u6709\u90E8\u95E8+\u5173\u952E\u89D2\u8272\uFF09</option><option value="skeleton">\u4EC5\u9AA8\u67B6\uFF08\u4E0D\u751F\u6210\u89D2\u8272\uFF09</option></select></div>'
    +'<div style="font-size:0.75rem;color:var(--txt-d);margin-top:0.3rem;">AI\u5C06\u67E5\u8BE2\u8BE5\u671D\u4EE3\u804C\u5B98\u5FD7/\u767E\u5B98\u5FD7\uFF0C\u5B8C\u6574\u751F\u6210\u6240\u6709\u90E8\u95E8\u548C\u5B98\u804C\u3002\u53EF\u80FD\u9700\u8981\u591A\u6B21API\u8C03\u7528\u3002</div>',
    async function() {
      var dynasty = gv('gmf-dynasty');
      if (!dynasty) { toast('\u8BF7\u586B\u5199\u671D\u4EE3'); return; }
      var scope = gv('gmf-scope') || 'full';
      closeGenericModal();
      try {
        // ── 阶段A：完整官制骨架 ──
        showLoading('\u9636\u6BB5A\uFF1A\u751F\u6210\u5B8C\u6574\u5B98\u5236\u9AA8\u67B6...', 10);
        if (!P.officeTree) P.officeTree = [];
        var _maxRounds = 5, _round = 0;
        while (_round < _maxRounds) {
          _round++;
          var existDepts = P.officeTree.map(function(d) { return d.name; });
          var _existNote = existDepts.length > 0 ? '\n已有部门（不要重复）：' + existDepts.join('、') + '\n请补充剩余未生成的部门。' : '';
          var promptA = '你是中国历史官制专家。请为' + dynasty + '生成【完整】官制组织结构。\n'
            + '严格参照该朝代的《职官志》《百官志》或相关史料记载。\n'
            + '要求：\n'
            + '1. 生成该朝代的【所有】中央官署部门——不是5-8个，而是按史载的全部部门（如唐代三省六部九寺五监等）\n'
            + '2. 每个部门包含所有子部门（如尚书省下六部，每部下四司等）\n'
            + '3. 每个官职必须包含headCount（该官职按制度额定几人）\n'
            + '4. positions中holder留空，不填任何人名\n'
            + '5. 每个职位的rank必须是真实品级（正一品至从九品）\n'
            + _existNote
            + '\n仅返回JSON数组，格式：\n'
            + '[{"name":"部门名","desc":"简介","functions":["职能"],"positions":[{"name":"官名","rank":"品级","holder":"","headCount":2,"desc":"职责"}],"subs":[递归子部门]}]';
          var c = await callAISmart(promptA, 8000, {
            minLength: 500, maxRetries: 2,
            validator: function(ct) {
              try { var jm = ct.match(/\[[\s\S]*\]/); if (!jm) return false; var arr = JSON.parse(jm[0]); return Array.isArray(arr) && arr.length >= 1; } catch(e) { return false; }
            }
          });
          var cleaned = c.replace(/```json|```/g,'').trim();
          var jm = cleaned.match(/\[[\s\S]*?\](?=\s*$)/) || cleaned.match(/\[[\s\S]*\]/);
          if (jm) {
            var newDepts;
            try { newDepts = JSON.parse(jm[0]); } catch(pe) { newDepts = JSON.parse(jm[0].replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}')); }
            // 合并——不覆盖已有部门
            newDepts.forEach(function(nd) {
              var existing = P.officeTree.find(function(d) { return d.name === nd.name; });
              if (!existing) P.officeTree.push(nd);
              else {
                // 合并子部门和职位
                if (nd.subs) nd.subs.forEach(function(ns) {
                  if (!existing.subs) existing.subs = [];
                  if (!existing.subs.find(function(s){ return s.name === ns.name; })) existing.subs.push(ns);
                });
                if (nd.positions) nd.positions.forEach(function(np) {
                  if (!existing.positions) existing.positions = [];
                  if (!existing.positions.find(function(p){ return p.name === np.name; })) existing.positions.push(np);
                });
              }
            });
            showLoading('\u9636\u6BB5A\uFF1A\u7B2C' + _round + '\u6B21\u8C03\u7528\u5B8C\u6210\uFF0C\u5DF2\u6709' + P.officeTree.length + '\u4E2A\u90E8\u95E8', 10 + _round * 15);
          }
          // 检查完整性——唐代至少应有~15个顶级机构，宋/明/清类似
          if (P.officeTree.length >= 8) break; // 基本够了
        }
        // 迁移新数据到双层模型
        if (typeof _offMigrateTree === 'function') _offMigrateTree(P.officeTree);

        if (scope === 'skeleton') {
          renderEdTab('t-office');
          hideLoading(); toast('\u2705 \u5B98\u5236\u9AA8\u67B6\u5DF2\u751F\u6210\uFF08' + P.officeTree.length + '\u4E2A\u90E8\u95E8\uFF09');
          return;
        }

        // ── 阶段B：生成关键角色 ──
        showLoading('\u9636\u6BB5B\uFF1A\u751F\u6210\u5173\u952E\u5B98\u5458...', 60);
        // 收集所有主要官职（从三品以上）
        var keyPositions = [];
        (function _kp(nodes, dName) {
          nodes.forEach(function(n) {
            (n.positions||[]).forEach(function(p) {
              var rl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 99;
              if (rl <= 6) keyPositions.push({ dept: dName || n.name, pos: p.name, rank: p.rank, posRef: p });
            });
            if (n.subs) _kp(n.subs, n.name);
          });
        })(P.officeTree);

        if (keyPositions.length > 0) {
          var _existChars = (P.characters||[]).map(function(c) { return c.name; });
          var promptB = '你是中国历史专家。当前剧本背景：' + dynasty + '。\n'
            + '以下是该朝代的关键官职（从三品以上），请为每个职位推荐任职者。\n'
            + '【优先使用真实历史人物】——查找该时期的真实官员记载。实在找不到历史记载才用虚构人物。\n'
            + '某些职位在该时期可能确实空缺——如实标注vacant:true。\n'
            + ((_existChars.length > 0) ? '已有角色（不要重复）：' + _existChars.join('、') + '\n' : '')
            + '职位列表：\n'
            + keyPositions.map(function(k, i) { return (i+1) + '. ' + k.dept + ' · ' + k.pos + '（' + k.rank + '）'; }).join('\n')
            + '\n\n返回JSON数组：[{"dept":"部门","pos":"官职","holder":"人名（空缺则空）","vacant":false,"historical":true,"personality":"性格简述","intelligence":65,"administration":70,"loyalty":60,"ambition":50}]';
          var c2 = await callAISmart(promptB, 6000, {
            minLength: 200, maxRetries: 2,
            validator: function(ct) { try { var jm = ct.match(/\[[\s\S]*\]/); return jm && JSON.parse(jm[0]).length >= 1; } catch(e) { return false; } }
          });
          var cleaned2 = c2.replace(/```json|```/g,'').trim();
          var jm2 = cleaned2.match(/\[[\s\S]*?\](?=\s*$)/) || cleaned2.match(/\[[\s\S]*\]/);
          if (jm2) {
            var appointments;
            try { appointments = JSON.parse(jm2[0]); } catch(pe2) { appointments = JSON.parse(jm2[0].replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}')); }
            var _assigned = 0;
            appointments.forEach(function(a) {
              if (!a.holder || a.vacant) return;
              // 在officeTree中找到对应职位并填入holder
              (function _fill(nodes) {
                nodes.forEach(function(n) {
                  (n.positions||[]).forEach(function(p) {
                    if (p.name === a.pos && !p.holder && (n.name === a.dept || !a.dept)) {
                      p.holder = a.holder;
                      p.actualCount = Math.max(p.actualCount||0, 1);
                      _assigned++;
                    }
                  });
                  if (n.subs) _fill(n.subs);
                });
              })(P.officeTree);
              // 创建角色（如果不存在）
              if (!P.characters) P.characters = [];
              if (!P.characters.find(function(ch) { return ch.name === a.holder; })) {
                P.characters.push({
                  name: a.holder, title: a.pos, role: a.dept + a.pos,
                  personality: a.personality || '', intelligence: a.intelligence || 60,
                  administration: a.administration || 60, military: a.military || 40,
                  loyalty: a.loyalty || 60, ambition: a.ambition || 50,
                  officialTitle: a.pos, alive: true
                });
              }
            });
            showLoading('\u9636\u6BB5B\u5B8C\u6210\uFF0C\u4EFB\u547D' + _assigned + '\u4F4D\u5173\u952E\u5B98\u5458', 90);
          }
        }

        renderEdTab('t-office');
        hideLoading();
        var _ts = typeof _offTreeStats === 'function' ? _offTreeStats(P.officeTree) : {};
        toast('\u2705 \u5B98\u5236\u5DF2\u5B8C\u6574\u751F\u6210\uFF1A' + (_ts.depts||'?') + '\u4E2A\u90E8\u95E8\uFF0C' + (_ts.headCount||'?') + '\u4E2A\u7F16\u5236\uFF0C' + (_ts.materialized||'?') + '\u540D\u5177\u8C61\u89D2\u8272');
      } catch(e) { hideLoading(); toast('\u5931\u8D25: ' + (e.message||e)); console.error(e); }
    }
  );
}

/** 编辑器：为某部门AI补充生成角色（阶段C） */
function aiGenOfficeStaff(deptPath) {
  var dept = _officeGetByPath(deptPath);
  if (!dept) { toast('找不到部门'); return; }
  var _scnBg = '';
  if (typeof editingScenarioId !== 'undefined') {
    var _sc = (typeof findScenarioById === 'function') ? findScenarioById(editingScenarioId) : null;
    if (_sc) _scnBg = (_sc.era||'') + ' ' + (_sc.dynasty||'');
  }
  var _unfilled = (dept.positions||[]).filter(function(p) {
    var m = (p.holder ? 1 : 0) + (p.additionalHolders ? p.additionalHolders.length : 0);
    return (p.actualCount||0) > m; // 有未具象的在任者
  });
  if (_unfilled.length === 0) { toast('该部门所有在任者已具象'); return; }
  (async function() {
    try {
      showLoading('为' + dept.name + '补充人员...', 30);
      var _existChars = (P.characters||[]).map(function(c) { return c.name; });
      var prompt = '背景：' + (_scnBg || '中国古代') + '。\n'
        + '为' + dept.name + '的以下官职生成任职者角色。\n'
        + '优先使用真实历史人物，找不到再虚构。\n'
        + (_existChars.length > 0 ? '已有角色：' + _existChars.slice(0,20).join('、') + '\n' : '')
        + _unfilled.map(function(p, i) {
          var need = (p.actualCount||0) - ((p.holder?1:0) + (p.additionalHolders||[]).length);
          return (i+1) + '. ' + p.name + '（' + (p.rank||'') + '），需补' + need + '人';
        }).join('\n')
        + '\n返回JSON：[{"pos":"官职名","name":"人名","personality":"性格","intelligence":60,"administration":60,"loyalty":60}]';
      var c = await callAISmart(prompt, 4000, { minLength: 100, maxRetries: 2 });
      var jm = (c.replace(/```json|```/g,'').trim().match(/\[[\s\S]*\]/) || ['[]'])[0];
      var chars = JSON.parse(jm.replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}'));
      var added = 0;
      chars.forEach(function(ch) {
        if (!ch.name || !ch.pos) return;
        var p = (dept.positions||[]).find(function(pp) { return pp.name === ch.pos; });
        if (!p) return;
        if (!p.additionalHolders) p.additionalHolders = [];
        p.additionalHolders.push(ch.name);
        if (!P.characters) P.characters = [];
        if (!P.characters.find(function(c2) { return c2.name === ch.name; })) {
          P.characters.push({ name: ch.name, title: ch.pos, role: dept.name + ch.pos, personality: ch.personality||'', intelligence: ch.intelligence||55, administration: ch.administration||55, loyalty: ch.loyalty||55, ambition: ch.ambition||45, officialTitle: ch.pos, alive: true });
        }
        added++;
      });
      hideLoading();
      renderEdTab('t-office');
      toast('已补充' + added + '名角色');
    } catch(e) { hideLoading(); toast('失败: ' + (e.message||e)); }
  })();
}

// ============================================================
//  脚本加载完成标记
// ============================================================
_dbg('天命游戏脚本加载完成！');
_dbg('关键函数检查:');
_dbg('- doNewGame:', typeof doNewGame);
_dbg('- doLoadSave:', typeof doLoadSave);
_dbg('- doEditor:', typeof doEditor);
_dbg('- openSettings:', typeof openSettings);
_dbg('- _$:', typeof _$);

// 定义按钮绑定函数
function bindMainMenuButtons() {
  _dbg('========================================');
  _dbg('[bindMainMenuButtons] 开始绑定主菜单按钮事件...');
  _dbg('[bindMainMenuButtons] document.readyState:', document.readyState);

  var btnNewGame = document.getElementById('btn-new-game');
  var btnLoadSave = document.getElementById('btn-load-save');
  var btnEditor = document.getElementById('btn-editor');
  var btnSettings = document.getElementById('btn-settings');

  _dbg('[bindMainMenuButtons] 按钮查找结果:');
  _dbg('  btn-new-game:', btnNewGame ? '找到' : '未找到');
  _dbg('  btn-load-save:', btnLoadSave ? '找到' : '未找到');
  _dbg('  btn-editor:', btnEditor ? '找到' : '未找到');
  _dbg('  btn-settings:', btnSettings ? '找到' : '未找到');

  if (btnNewGame) {
    btnNewGame.onclick = function() {
      _dbg('[按钮点击] btn-new-game 被点击');
      doNewGame();
    };
    _dbg('  ✓ 绑定 btn-new-game 成功');
  } else {
    console.error('  ✗ btn-new-game 不存在');
  }

  if (btnLoadSave) {
    btnLoadSave.onclick = function() {
      _dbg('[按钮点击] btn-load-save 被点击');
      doLoadSave();
    };
    _dbg('  ✓ 绑定 btn-load-save 成功');
  } else {
    console.error('  ✗ btn-load-save 不存在');
  }

  if (btnEditor) {
    btnEditor.onclick = function() {
      _dbg('[按钮点击] btn-editor 被点击');
      doEditor();
    };
    _dbg('  ✓ 绑定 btn-editor 成功');
  } else {
    console.error('  ✗ btn-editor 不存在');
  }

  if (btnSettings) {
    btnSettings.onclick = function() {
      _dbg('[按钮点击] btn-settings 被点击');
      openSettings();
    };
    _dbg('  ✓ 绑定 btn-settings 成功');
  } else {
    console.error('  ✗ btn-settings 不存在');
  }

  _dbg('[bindMainMenuButtons] 主菜单按钮事件绑定完成！');
  _dbg('========================================');
}

// 绑定主菜单按钮事件 - 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindMainMenuButtons);
} else {
  // DOM 已经加载完成，立即绑定
  bindMainMenuButtons();
}

// ============================================================
//  科举制度系统
// ============================================================

/**
 * 初始化科举制度（游戏开始时调用）
 * 由 AI 根据朝代判断是否启用科举
 */

// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Audio & Theme System + fullLoadGame + officeTree 编辑（3,430 行）
// Requires: tm-utils.js (GameHooks, _$, toast, saveP),
//           tm-game-engine.js (doExport, backToLaunch)
// ============================================================
//
// ══════════════════════════════════════════════════════════════
//  📍 导航地图（2026-04-24 R78）
//  ⚠ 命名"audio-theme"误导——此文件内容远超音频和主题
// ══════════════════════════════════════════════════════════════
//
//  ┌─ §A 音频系统（L8-400） ─────────────────────────┐
//  │  AudioSystem 对象：bgm / sfxVolume / bgmEnabled
//  │  播放/停止/音量控制
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §B 主题系统（L400-900） ────────────────────────┐
//  │  主题切换 / CSS 变量管理
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §C 存档加载生命周期（L1134） ⚠ 历史债务 ──────────┐
//  │  L1134 fullLoadGame(data)         完整加载游戏状态
//  │        （本应在 tm-game-engine.js 或 tm-dynamic-systems.js）
//  │        含 P→GM 兜底恢复（adminHierarchy/officeTree）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §D 官制编辑 tab（L2580-3200） ─────────────────────┐
//  │  L2580 _officeBuildTreeV10(opts)  布局计算
//  │  L2745 renderOfficeTab(em)         官制 tab 主渲染
//  │  L2980 _renderOfficeDept(...)      部门节点渲染
//  │  （含 SVG 连线+拖拽+缩放）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §E 其他杂项（L3200+） ────────────────────────────┐
//  │  各种历史遗留辅助函数
//  └─────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  🛠️ 调试入口
// ══════════════════════════════════════════════════════════════
//
//  AudioSystem.play('click')
//  AudioSystem.bgmEnabled = false
//  fullLoadGame(data)                 手动加载存档
//
// ══════════════════════════════════════════════════════════════
//  ⚠️ 架构注意事项
// ══════════════════════════════════════════════════════════════
//
//  1. fullLoadGame 在此文件是历史遗留（本应在 game-engine）
//     改加载逻辑要来这里·不是去 tm-game-engine.js
//
//  2. _officeBuildTreeV10 接受 opts.officeTree（R5 修复过 P↔GM swap hack）
//     新代码传 opts.officeTree = GM.officeTree
//
//  3. renderOfficeTab 内有拖拽面板·2026-04-24 R3 修过
//     document 级监听器幂等·不再累积
//
//  4. 文件名"audio-theme"严重误导·未来应拆为
//     tm-audio.js + tm-theme.js + tm-office-editor.js + 把 fullLoadGame
//     迁到 tm-storage.js
//
// ══════════════════════════════════════════════════════════════
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
    // 从本地存储加载设置 (R153 包 try·private 模式不崩)
    var savedSettings = null;
    try { savedSettings = localStorage.getItem('tianming_audio_settings'); } catch(_){}
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
    try { localStorage.setItem('tianming_audio_settings', JSON.stringify(settings)); } catch(_){}
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
    // 从本地存储加载主题 (R153 包 try)
    var savedTheme = null;
    try { savedTheme = localStorage.getItem('tianming_theme'); } catch(_){}
    // 历史残留清理：旧版本允许 light/paper·CSS 是白底·与游戏深色基调冲突·一律强制回 dark
    if (savedTheme === 'light' || savedTheme === 'paper') {
      savedTheme = 'dark';
      try { localStorage.setItem('tianming_theme', 'dark'); } catch(_){}
      try { document.documentElement.removeAttribute('data-theme'); } catch(_){}
    }
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
    try { localStorage.setItem('tianming_theme', this.currentTheme); } catch(_){}
  },

  // 切换主题
  setTheme: function(themeName) {
    // 拒绝 light/paper（白底主题）·会与游戏深色基调冲突
    if (themeName === 'light' || themeName === 'paper') {
      if (typeof toast === 'function') toast('白底主题已停用·避免与游戏配色冲突');
      return;
    }
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
  try { localStorage.setItem('tianming_font_size', newSize); } catch(_){}
  AudioSystem.playSfx('click');
}

function toggleAnimation() {
  var enabled = document.getElementById('animation-toggle').checked;
  if (enabled) {
    document.documentElement.style.setProperty('--transition-speed', '0.3s');
  } else {
    document.documentElement.style.setProperty('--transition-speed', '0s');
  }
  try { localStorage.setItem('tianming_animation', enabled); } catch(_){}
}

// 在游戏启动时初始化主题系统
GameHooks.on('startGame:after', function() {
  ThemeSystem.init();

  // 恢复字体大小 (R153 包 try)
  var savedFontSize = null;
  try { savedFontSize = localStorage.getItem('tianming_font_size'); } catch(_){}
  if (savedFontSize) {
    document.documentElement.style.fontSize = savedFontSize + 'px';
  }

  // 恢复动画设置 (R153 包 try)
  var savedAnimation = null;
  try { savedAnimation = localStorage.getItem('tianming_animation'); } catch(_){}
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

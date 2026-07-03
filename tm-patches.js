// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  tm-patches.js — 跨领域补丁合集（2,186 行·"大杂烩"）
// Requires: tm-data-model.js, tm-utils.js, tm-mechanics.js,
//           tm-change-queue.js, tm-index-world.js, tm-npc-engine.js,
//           tm-game-engine.js, tm-endturn.js, tm-dynamic-systems.js (all prior modules)
// ============================================================
//
// ══════════════════════════════════════════════════════════════
//  📍 段落总导航（2026-04-24 R58）
// ══════════════════════════════════════════════════════════════
//
//  原始 2,186 行跨 6 大功能领域，已按 MODULE_REGISTRY §1.8 切分清单
//  本文件当前状态：**双保险策略**·原代码保留·新文件在 index.html
//  加载顺序之后覆盖同名函数（若新文件稳定后可删此段）。
//
//  ┌─ ⏳ §1 Settings UI（L1-512，~560 行·高风险·未迁） ──┐
//  │  openSettings 完整重写(含 API 配置 400+ innerHTML)
//  │  sSaveAPI / sTestConn / sDetectModels / sSaveSecondaryAPI /
//  │  sClearSecondaryAPI / sToggleSecondaryEnabled /
//  │  _sVerbUpdatePreview / _sMaxoutToggle / _sUpdateMaxoutInfo /
//  │  _sShowCtxInfo / _sTestImgConn / _sDetectImgCap / _sSaveImgAPI
//  │  → R22 占位现已并入 tm-ui-foundation.js 作**迁移靶文件**(含详细步骤)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ 🔶 §2 剧本管理 tab（L514-532，~20 行） ───────────┐
//  │  renderScnTab(em, sc) - 系统开关 + 剧本信息编辑
//  │  （未分类·可单独拆为 tm-scenario-tab.js）
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ⏳ §3 开局逻辑审查（L535-1040，~290 行·高风险） ──┐
//  │  _logicAuditOnStart(sc) - AI 生成缺失字段
//  │  doActualStart + 开场白动画
//  │  startGame 覆盖
//  │  → 未迁。风险：涉及 startGame，需要完整回归测试
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ⏳ §4 散碎补丁（L1040-1680，~640 行） ────────────┐
//  │  杂项 UI 修正 / 事件钩子 / NPC 互动补丁
//  │  → 未分类·需进一步切分
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ✓ §5 Editor Details（L1682-1860，~180 行） ───────┐
//  │  editChr + saveChrEdit + renderItmTab/RulTab/EvtTab/
//  │  FacTab/ClassTab/WldTab/TechTab + editClass2 + editTech2
//  │  + aiGenItems/Rules/Events/Classes/World/Tech
//  │  → 已迁至 tm-editor-details.js (R21 ✓)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ✓ §6 Modal System（L1861-1892，~30 行） ──────────┐
//  │  gv + openGenericModal + closeGenericModal +
//  │  showModal + closeModal
//  │  → 已迁至 tm-ui-foundation.js (R17 ✓ / P4-beta 合并)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ✓ §7 World View（L1894-2090，~200 行） ───────────┐
//  │  openWorldSituation / closeWorldSituation +
//  │  openHistoricalEvents / openEraTrends（兼容别名）+
//  │  drawEraTrendsChart（canvas 7 维趋势折线）
//  │  → 已迁至 tm-world-view.js (R20 ✓)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ ✓ §8 Military UI（L2092-2174，~85 行） ───────────┐
//  │  migrateMilUnits + addArmy + editArmy + renderMilTab +
//  │  aiGenMil
//  │  → 已迁至 tm-military-ui.js (R18 ✓)
//  └─────────────────────────────────────────────────────────┘
//
//  ┌─ 🔶 §9 官制 tab（L2175-2186，~11 行） ──────────────┐
//  │  renderOfficeTab 覆盖版
//  │  （混在 Military 之后·未来迁到 tm-office-editor.js）
//  └─────────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  📊 迁移进度
// ══════════════════════════════════════════════════════════════
//
//  已迁段：§5, §6, §7, §8         = ~495 行（23%）
//  未迁段：§1, §2, §3, §4, §9     = ~1,691 行（77%）
//  物理文件：仍 2,186 行（双保险不删）
//
//  详细路线图：PATCH_CLASSIFICATION.md · tm-patches.js 段
//  工时估算：剩余未迁约 40-70h（Settings UI 最重）
//
// ══════════════════════════════════════════════════════════════

// 覆盖openSettings为完整版

// P15.2 _togglePConf 工具函数（同文件保证·不依赖 player-settings.js·防被回滚）
if (typeof _togglePConf === 'undefined') {
  window._togglePConf = function(confKey, on) {
    if (typeof P === 'undefined' || !P) return;
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
      semanticRecallAutoload: { on: '已启用语义检索自动加载', off: '已关闭语义检索自动加载·SC_RECALL 第 5 源失效' },
      npcAiPrecision: { on: '已启用 NPC 势力真决策·会真实改动数据并写入账本', off: '已关闭 NPC 势力真决策·走本地模板 + 人格 hints' },
      npcAiCosmeticEnrich: { on: '已启用 NPC 文字润色·仅改显示文辞', off: '已关闭 NPC 文字润色·不影响真决策' },
      useTinyiV3: { on: '已启用廷议 v3 (默认·8 阶段·新框架)', off: '已关闭 v3·退回 v2 廷议 (简陋·5 阶段·已加 ChronicleTracker/ClassEngine 集成 fallback)' }
    };
    var l = labels[confKey] || { on: '已启用 ' + confKey, off: '已关闭 ' + confKey };
    if (typeof toast === 'function') toast('✅ ' + (on ? l.on : l.off));
  };
}

function _settingsEsc(v) {
  if (v == null) return '';
  return String(v).replace(/[&<>"]/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}

function _renderSettingsAudioSection() {
  var A = window.AudioSystem;
  if (!A) {
    return '<div class="settings-section tm-settings-audio"><h4>声乐</h4><div style="font-size:0.78rem;color:var(--txt-d);">音频系统尚未加载。</div></div>';
  }
  try { if (typeof A.loadPlaylist === 'function') A.loadPlaylist(); } catch(_){}
  var bgmPct = Math.round((A.bgmVolume == null ? 0.3 : A.bgmVolume) * 100);
  var sfxPct = Math.round((A.sfxVolume == null ? 0.5 : A.sfxVolume) * 100);
  var current = (typeof A.getCurrentTrack === 'function') ? A.getCurrentTrack() : null;
  var tracks = Array.isArray(A.playlist) ? A.playlist : [];
  var h = '<div class="settings-section tm-settings-audio"><h4>声乐</h4>';
  h += '<div class="tm-settings-sub">迁移自旧“音声”侧栏。控制背景音乐、音效和 BGM 曲库。</div>';
  h += '<div class="tm-settings-two">';
  h += '<label class="tm-settings-toggle"><input type="checkbox" id="s-audio-bgm-enabled" ' + (A.bgmEnabled !== false ? 'checked ' : '') + 'onchange="_settingsAudioToggleBgm(this.checked)"><span>背景音乐</span><em>' + (current ? _settingsEsc(current.title) : '未配置曲目') + '</em></label>';
  h += '<label class="tm-settings-toggle"><input type="checkbox" id="s-audio-sfx-enabled" ' + (A.enabled !== false ? 'checked ' : '') + 'onchange="_settingsAudioToggleSfx(this.checked)"><span>界面音效</span><em>按钮、通知、结算提示</em></label>';
  h += '</div>';
  h += '<div class="tm-settings-range"><span>乐音</span><input type="range" id="s-audio-bgm-volume" min="0" max="100" value="' + bgmPct + '" oninput="_settingsAudioSetBgmVolume(this.value)"><b id="s-audio-bgm-val">' + bgmPct + '</b></div>';
  h += '<div class="tm-settings-range"><span>声效</span><input type="range" id="s-audio-sfx-volume" min="0" max="100" value="' + sfxPct + '" oninput="_settingsAudioSetSfxVolume(this.value)"><b id="s-audio-sfx-val">' + sfxPct + '</b></div>';
  h += '<div class="tm-settings-loop">';
  h += '<button class="gs-audio-loop-btn ' + (A.loopMode === 'sequence' ? 'active' : '') + '" onclick="_settingsAudioLoopMode(\'sequence\')">顺序</button>';
  h += '<button class="gs-audio-loop-btn ' + ((A.loopMode || 'single') === 'single' ? 'active' : '') + '" onclick="_settingsAudioLoopMode(\'single\')">单曲</button>';
  h += '<button class="gs-audio-loop-btn ' + (A.loopMode === 'random' ? 'active' : '') + '" onclick="_settingsAudioLoopMode(\'random\')">随机</button>';
  h += '</div>';
  h += '<div class="tm-settings-track-list">';
  if (tracks.length) {
    tracks.forEach(function(t) {
      var active = current && current.id === t.id;
      h += '<button class="tm-settings-track ' + (active ? 'active' : '') + '" data-track-id="' + _settingsEsc(t.id) + '" onclick="_settingsAudioPlayTrack(\'' + String(t.id).replace(/'/g, "\\'") + '\')"><span>' + _settingsEsc(t.title) + '</span><em>' + _settingsEsc(t.meta || 'BGM') + '</em></button>';
    });
  } else {
    h += '<div class="tm-settings-empty">请把音乐文件放入 assets/audio/bgm，并在 tm-bgm-config.js 中登记。</div>';
  }
  h += '</div></div>';
  return h;
}

function _renderSettingsThemeFontSection() {
  if (window.TMThemeFont && typeof TMThemeFont.renderControls === 'function') {
    return TMThemeFont.renderControls({ context: 'settings' });
  }
  return '<div class="settings-section tm-settings-theme"><h4>主题字号</h4><div class="tm-settings-empty">主题字号模块尚未加载。</div></div>';
}

function _settingsMediaThemeInit() {
  try {
    var A = window.AudioSystem;
    if (A && (!A.playlist || !A.playlist.length) && typeof A.init === 'function') A.init();
  } catch(_){}
}

window._settingsAudioToggleBgm = function(on) {
  if (!window.AudioSystem) return;
  AudioSystem.bgmEnabled = !!on;
  if (on && typeof AudioSystem.ensureBgmPlaying === 'function') AudioSystem.ensureBgmPlaying();
  if (!on && typeof AudioSystem.stopBgm === 'function') AudioSystem.stopBgm();
  if (typeof AudioSystem.saveSettings === 'function') AudioSystem.saveSettings();
};
window._settingsAudioToggleSfx = function(on) {
  if (!window.AudioSystem) return;
  AudioSystem.enabled = !!on;
  if (on && typeof AudioSystem.playSfx === 'function') AudioSystem.playSfx('click');
  if (typeof AudioSystem.saveSettings === 'function') AudioSystem.saveSettings();
};
window._settingsAudioSetBgmVolume = function(v) {
  if (!window.AudioSystem) return;
  AudioSystem.setBgmVolume((Number(v) || 0) / 100);
  var el = _$('s-audio-bgm-val'); if (el) el.textContent = String(Math.round(Number(v) || 0));
};
window._settingsAudioSetSfxVolume = function(v) {
  if (!window.AudioSystem) return;
  AudioSystem.setSfxVolume((Number(v) || 0) / 100);
  var el = _$('s-audio-sfx-val'); if (el) el.textContent = String(Math.round(Number(v) || 0));
};
window._settingsAudioPlayTrack = function(id) {
  if (!window.AudioSystem || typeof AudioSystem.playTrack !== 'function') return;
  AudioSystem.playTrack(id);
  try { closeSettings(); openSettings(); } catch(_){}
};
window._settingsAudioLoopMode = function(mode) {
  if (!window.AudioSystem || typeof AudioSystem.setLoopMode !== 'function') return;
  AudioSystem.setLoopMode(mode);
  try { closeSettings(); openSettings(); } catch(_){}
};
window._settingsThemeApply = function(name, el) {
  if (typeof _tmApplyTheme === 'function') _tmApplyTheme(name, el);
};
window._settingsSizeApply = function(size, el) {
  if (typeof _tmApplySize === 'function') _tmApplySize(size, el);
};

function _settingsTabText(section, index) {
  var h = section && section.querySelector ? section.querySelector('h4') : null;
  var txt = h ? (h.textContent || '').replace(/\s+/g, ' ').trim() : '';
  // 导航标签精简（右栏 h4 原样不动）：去状态尾（如「○ 未配置」）与括注（如「（实验·默认关）」）·去 emoji（左栏中立·⚡🧪等留在右栏标题）
  if (txt) txt = txt.replace(/（[^）]*）/g, '').replace(/\s*[○●].*$/, '').replace(/[☀-➿️]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g, '').replace(/\s+/g, ' ').trim();
  var fallback = [
    'API连接', '次要 API', '性能', '更新工坊', '声乐', '主题字号',
    '回合读取', 'AI记忆', '生成字数', '高级预算', '模型校验',
    '文风', '游戏模式', '人物志', '提示词'
  ];
  return txt || fallback[index] || ('设置 ' + (index + 1));
}

function _settingsBuildTabs() {
  var body = _$('sb2');
  if (!body || body.querySelector('.settings-tab-shell')) return;
  var sections = Array.prototype.slice.call(body.children).filter(function(el) {
    return el && el.classList && el.classList.contains('settings-section');
  });
  if (sections.length <= 1) return;

  var saveBtn = Array.prototype.slice.call(body.children).filter(function(el) {
    return el && el.tagName === 'BUTTON' && /sSaveAll/.test(el.getAttribute('onclick') || '');
  })[0] || null;

  var shell = document.createElement('div');
  shell.className = 'settings-tab-shell';
  var tabs = document.createElement('div');
  tabs.className = 'settings-tabs';
  tabs.setAttribute('role', 'tablist');
  var panes = document.createElement('div');
  panes.className = 'settings-panes';

  // 左栏分组（2026-07-01·治「19 项平铺、顺序随意、标签截断」）：按标题归类·组内保持原顺序·
  // 只重排左栏 tab 顺序 + 插组标题·pane 仍按原顺序(只按 key 切换·顺序无关)·不动任何 section 内容。
  var _settingsGroups = [
    { name: '常用',      re: /界面显示|声乐|主题|字号|文风|游戏模式|回合读取/ },
    { name: 'AI · 模型', re: /API|次要|性能|成本|高级|预算|档位|模型|记忆|生成字数|提示词/ },
    { name: '玩法机制',  re: /御驾|战斗|玩法机制|人物志/ },
    { name: '实验 · 进阶', re: /实验/ },
    { name: '系统 · 其他', re: /更新|工坊/ }
  ];
  function _settingsGroupOf(title) {
    for (var g = 0; g < _settingsGroups.length; g++) { if (_settingsGroups[g].re.test(title)) return g; }
    return _settingsGroups.length - 1; // 未命中 → 落「系统·其他」（含将来新增分区，不丢）
  }

  // 稀签合并（2026-07-03·治「一签一个开关·半屏空荡」）：小节按主题并入同一 pane（节间距走 CSS）·
  // 左栏少而实。只并版面·不动任何 section 内容与既有控件 id。
  var _settingsMerges = [
    { label: '玩法 · 战斗与亲征', re: /战斗规则|御驾亲征|玩法机制/ },
    { label: '文风 · 游戏模式', re: /^文风|游戏模式/ }
  ];
  var _mergedPaneByRule = {};

  // 一遍：给每个 section 建 pane（按原 DOM 顺序）+ 记录分组·命中合并规则的节并入共享 pane
  var _settingsEntries = [];
  sections.forEach(function(section, idx) {
    var label = _settingsTabText(section, idx);
    var key = 'tab-' + idx;
    section.setAttribute('data-settings-section', key);
    var mi = -1;
    for (var m = 0; m < _settingsMerges.length; m++) { if (_settingsMerges[m].re.test(label)) { mi = m; break; } }
    if (mi >= 0 && _mergedPaneByRule[mi]) {
      _mergedPaneByRule[mi].appendChild(section);   // 并入既有共享 pane·不再出新签
      return;
    }
    var pane = document.createElement('div');
    pane.className = 'settings-pane';
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('data-settings-pane', key);
    pane.appendChild(section);
    panes.appendChild(pane);
    if (mi >= 0) { _mergedPaneByRule[mi] = pane; label = _settingsMerges[mi].label; }
    _settingsEntries.push({ key: key, label: label, group: _settingsGroupOf(label) });
  });

  // 二遍：按分组顺序渲染左栏 tab（组内保持原顺序），组首插组标题，编号按显示顺序连排
  var _settingsNum = 0;
  for (var _gi = 0; _gi < _settingsGroups.length; _gi++) {
    var _groupEntries = _settingsEntries.filter(function(e) { return e.group === _gi; });
    if (!_groupEntries.length) continue;
    var _gh = document.createElement('div');
    _gh.className = 'settings-tab-group';
    _gh.textContent = _settingsGroups[_gi].name;
    tabs.appendChild(_gh);
    _groupEntries.forEach(function(e) {
      _settingsNum++;
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'settings-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('data-settings-tab', e.key);
      tab.setAttribute('onclick', "_settingsSwitchTab('" + e.key + "')");
      tab.innerHTML = '<span class="settings-tab-index">' + String(_settingsNum).padStart(2, '0') + '</span><span class="settings-tab-label">' + _settingsEsc(e.label) + '</span>';
      tabs.appendChild(tab);
    });
  }

  shell.appendChild(tabs);
  shell.appendChild(panes);
  body.innerHTML = '';
  body.appendChild(shell);
  if (saveBtn) {
    var savebar = document.createElement('div');
    savebar.className = 'settings-savebar';
    savebar.appendChild(saveBtn);
    body.appendChild(savebar);
  }

  var active = 'tab-0';
  try {
    var remembered = localStorage.getItem('tm.settings.activeTab');
    if (remembered && shell.querySelector('[data-settings-pane="' + remembered + '"]')) active = remembered;
  } catch(_){}
  window._settingsSwitchTab(active);
}

window._settingsSwitchTab = function(key) {
  var body = _$('sb2');
  if (!body) return;
  body.querySelectorAll('.settings-tab').forEach(function(tab) {
    var on = tab.getAttribute('data-settings-tab') === key;
    tab.classList.toggle('active', on);
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  body.querySelectorAll('.settings-pane').forEach(function(pane) {
    pane.classList.toggle('active', pane.getAttribute('data-settings-pane') === key);
  });
  try { localStorage.setItem('tm.settings.activeTab', key); } catch(_){}
};

// 设置全文搜索（2026-07-03）：按「页签名 + 该页全部文字」过滤左栏·组内全隐则组题隐·
// 活签被滤走时自动切到首个命中·清空即复原。
window._settingsFilter = function(q) {
  var body = _$('sb2');
  if (!body) return;
  q = String(q || '').trim().toLowerCase();
  var firstHit = null;
  body.querySelectorAll('.settings-tab').forEach(function(tab) {
    var key = tab.getAttribute('data-settings-tab');
    var pane = body.querySelector('[data-settings-pane="' + key + '"]');
    var hay = ((tab.textContent || '') + ' ' + (pane ? (pane.textContent || '') : '')).toLowerCase();
    var hit = !q || hay.indexOf(q) >= 0;
    tab.classList.toggle('search-miss', !hit);
    if (hit && !firstHit) firstHit = key;
  });
  body.querySelectorAll('.settings-tab-group').forEach(function(gh) {
    var el = gh.nextElementSibling, vis = false;
    while (el && !(el.classList && el.classList.contains('settings-tab-group'))) {
      if (el.classList && el.classList.contains('settings-tab') && !el.classList.contains('search-miss')) { vis = true; break; }
      el = el.nextElementSibling;
    }
    gh.classList.toggle('search-miss', !vis);
  });
  if (q && firstHit) {
    var active = body.querySelector('.settings-tab.active');
    if (!active || active.classList.contains('search-miss')) window._settingsSwitchTab(firstHit);
  }
};

// ── 界面显示设置（2026-06-10·治玩家「双端字太小」反馈）─────────────────
// 字号档：html 根 font-size 缩放。--text-* token 全是 rem → 全局即时生效。
// 设备本地偏好（localStorage·不进存档）；index.html head 有同 key 的早期应用块。
window._tmSetUiFontScale = function(v, btn){
  try { localStorage.setItem('tm.uiFontScale', String(v)); } catch(_){}
  try { document.documentElement.style.fontSize = (v === 1 ? '' : (16 * v) + 'px'); } catch(_){}
  if (btn && btn.parentElement) {
    var sib = btn.parentElement.children;
    for (var i = 0; i < sib.length; i++) { sib[i].classList.remove('bp'); sib[i].classList.add('bs'); }
    btn.classList.remove('bs'); btn.classList.add('bp');
  }
};
// 渲染分辨率（fit 虚拟舞台·tm-fixed-fit.js 读同 key）：'auto'=桌面自适应窗口（不开 fit）·
// 'WxH'=固定舞台整体缩放（APK 必走舞台·默认 1477x831）。CSSOM 归一化不可逆 → 改档整页重载。
window._tmSetFitResolution = function(btn){
  var v = btn && btn.getAttribute ? btn.getAttribute('data-res') : String(btn || 'auto');
  try {
    if (!v || v === 'auto') localStorage.removeItem('tm.fitResolution');
    else localStorage.setItem('tm.fitResolution', v);
  } catch(_){}
  if (btn && btn.parentElement) {
    var sib = btn.parentElement.children;
    for (var i = 0; i < sib.length; i++) { sib[i].classList.remove('bp'); sib[i].classList.add('bs'); }
    btn.classList.remove('bs'); btn.classList.add('bp');
  }
  try { if (typeof toast === 'function') toast('分辨率已保存·即将刷新生效'); } catch(_){}
  setTimeout(function(){ try { location.reload(); } catch(_){} }, 900);
};
// 显示模式：全屏 / 窗口 切换（设置·界面显示）。Electron 走主进程 setFullScreen（须随安装包重建生效）；
// 浏览器/安卓 WebView 走 HTML5 Fullscreen API。偏好存 localStorage（只影响本设备）。
window._tmSetFullscreen = function(want, btn){
  want = !!want;
  try { localStorage.setItem('tm.fullscreen', want ? '1' : '0'); } catch(_){}
  var done = false;
  try { if (window.tianming && typeof window.tianming.setFullScreen === 'function') { window.tianming.setFullScreen(want); done = true; } } catch(_){}
  if (!done) {
    try {
      if (want) { var el = document.documentElement; var rf = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen; if (rf) { var _r = rf.call(el); if (_r && _r.catch) _r.catch(function(){}); } }
      else { var ef = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen; if (ef && (document.fullscreenElement || document.webkitFullscreenElement)) ef.call(document); }
    } catch(_){}
  }
  if (btn && btn.parentElement) { var sib = btn.parentElement.children; for (var i = 0; i < sib.length; i++) { sib[i].classList.remove('bp'); sib[i].classList.add('bs'); } btn.classList.remove('bs'); btn.classList.add('bp'); }
  try { if (typeof toast === 'function') toast(want ? '已切换为全屏' : '已切换为窗口模式'); } catch(_){}
};
// 启动时按上次偏好应用窗口模式（默认全屏不动）。Electron 须重建出含 setFullScreen 的 preload 才生效。
try { setTimeout(function(){ try { if (localStorage.getItem('tm.fullscreen') === '0' && window.tianming && typeof window.tianming.setFullScreen === 'function') window.tianming.setFullScreen(false); } catch(_){} }, 1200); } catch(_){}

openSettings=function(){
  var bg=_$("settings-bg");
  // 2026-07-03 \u8BBE\u7F6E\u9762\u677F\u5347\u7EA7\uFF1A\u5934\u90E8\u52A0\u5168\u6587\u641C\u7D22\uFF08\u6309\u9875\u7B7E\u540D/\u8BF4\u660E\u6587\u5B57\u8FC7\u6EE4\u5DE6\u680F\u00B7\u9996\u4E2A\u547D\u4E2D\u81EA\u52A8\u5207\u5165\uFF09
  bg.innerHTML="<div class=\"settings-box\"><div style=\"padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;gap:0.6rem;\"><div style=\"font-size:1.1rem;font-weight:700;color:var(--gold);white-space:nowrap;\">"+((typeof tmIcon==='function')?tmIcon('settings',18):'')+"\u8BBE\u7F6E</div><input class=\"settings-search\" id=\"s-search\" placeholder=\"\u641C\u8BBE\u7F6E\u2026\uFF08\u540D\u79F0\u6216\u8BF4\u660E\u6587\u5B57\uFF09\" oninput=\"_settingsFilter(this.value)\"><button class=\"bt bs bsm\" onclick=\"closeSettings()\">\u2715</button></div><div class=\"settings-body\" id=\"sb2\"></div></div>";

  var b=_$("sb2");
  b.innerHTML=
    // 界面显示（2026-06-10·玩家反馈双端字太小）·字号即时生效·分辨率（fit 舞台）改后重载生效
    // 出厂默认（owner 二次拍板再调大）：字号 1.2「大」·APK 分辨率 1477×831「标准」——读档 fallback
    // 须与 index.html early-apply / tm-fixed-fit.js 的默认一致，否则高亮档错位。
    (function(){
      var _fs = 1.2; try { _fs = parseFloat(localStorage.getItem('tm.uiFontScale')) || 1.2; } catch(_){}
      function pill(v, label){
        var on = Math.abs(_fs - v) < 0.01;
        return '<button class="bt ' + (on ? 'bp' : 'bs') + ' bsm" onclick="_tmSetUiFontScale(' + v + ',this)" style="flex:1;">' + label + '</button>';
      }
      var h = '<div class="settings-section"><h4>界面显示</h4>' +
        '<div style="font-size:0.78rem;color:var(--txt-d);margin:-0.2rem 0 0.4rem;">界面字号·即时生效·只影响本设备</div>' +
        '<div style="display:flex;gap:0.3rem;">' + pill(0.9,'小') + pill(1,'标准') + pill(1.2,'大') + pill(1.35,'特大') + '</div>';
      // 渲染分辨率（fit 虚拟舞台）·APK 必走舞台（默认 1477×831）·桌面/网页默认自适应窗口、
      // 显式选定分辨率后开固定舞台（选低于窗口的分辨率 = 界面整体放大）
      var isApk = false; try { isApk = !!(window.TM && TM.platform && TM.platform.kind === 'capacitor'); } catch(_){}
      var _res = ''; try { _res = localStorage.getItem('tm.fitResolution') || ''; } catch(_){}
      if (!_res) _res = isApk ? '1477x831' : 'auto';
      var pillR = function(v, label){
        var on = _res === v;
        return '<button class="bt ' + (on ? 'bp' : 'bs') + ' bsm" data-res="' + v + '" onclick="_tmSetFitResolution(this)" style="flex:1;">' + label + '</button>';
      };
      if (isApk) {
        h += '<div style="font-size:0.78rem;color:var(--txt-d);margin:0.6rem 0 0.4rem;">渲染分辨率·越低界面整体越大（字与按钮图像一起放大）·改后自动刷新</div>' +
          '<div style="display:flex;gap:0.3rem;">' + pillR('1920x1080','精细 1920×1080') + pillR('1477x831','标准 1477×831') + pillR('1280x720','最大 1280×720') + '</div>';
      } else {
        h += '<div style="font-size:0.78rem;color:var(--txt-d);margin:0.6rem 0 0.4rem;">渲染分辨率·「自适应」随窗口伸缩；选定分辨率后按固定舞台整体缩放（低于窗口 = 整体放大）·改后自动刷新</div>' +
          '<div style="display:flex;gap:0.3rem;">' + pillR('auto','自适应窗口') + pillR('1920x1080','1920×1080') + pillR('1600x900','1600×900') + pillR('1366x768','1366×768') + '</div>';
      }
      // 显示模式·全屏 / 窗口（设置·界面显示）
      var _fsPref = '1'; try { var _fp = localStorage.getItem('tm.fullscreen'); _fsPref = (_fp === '0') ? '0' : '1'; } catch(_){}
      var pillFs = function(want, label){ var on = (_fsPref === (want ? '1' : '0')); return '<button class="bt ' + (on ? 'bp' : 'bs') + ' bsm" onclick="_tmSetFullscreen(' + want + ',this)" style="flex:1;">' + label + '</button>'; };
      h += '<div style="font-size:0.78rem;color:var(--txt-d);margin:0.6rem 0 0.4rem;">显示模式·全屏沉浸或窗口化·只影响本设备</div>' +
        '<div style="display:flex;gap:0.3rem;">' + pillFs(true, '全屏') + pillFs(false, '窗口') + '</div>';
      return h + '</div>';
    })()+
    // 御驾亲征·战术战斗(接入 Phase2·开关 GM._yujiaQinzheng·本局存档生效)+他方战事旁观(O12·GM._yujiaObserve)
    (function(){
      var on = false, obOn = false; try { on = !!(typeof GM!=='undefined' && GM && GM._yujiaQinzheng); obOn = !!(typeof GM!=='undefined' && GM && GM._yujiaObserve); } catch(_){}
      function pill(want, label){ return '<button class="bt '+((on===want)?'bp':'bs')+' bsm" data-yjqz="'+(want?1:0)+'" onclick="_tmSetYujiaQinzheng('+want+',this)" style="flex:1;">'+label+'</button>'; }
      function pillOb(want, label){ return '<button class="bt '+((obOn===want)?'bp':'bs')+' bsm" data-yjob="'+(want?1:0)+'" onclick="_tmSetYujiaObserve('+want+',this)" style="flex:1;">'+label+'</button>'; }
      return '<div class="settings-section"><h4>御驾亲征 · 战术战斗</h4>'
        + '<div style="font-size:0.78rem;color:var(--txt-d);margin:-0.2rem 0 0.4rem;">开启后，直辖之师接敌可<b>御驾亲征·亲操此战</b>（实时战术战斗），战果回填庙堂；关闭则一律庙算决之。本局存档生效。</div>'
        + '<div style="display:flex;gap:0.3rem;">' + pill(true,'开启 · 亲征') + pill(false,'关闭 · 庙算') + '</div>'
        + '<div style="font-size:0.78rem;color:var(--txt-d);margin:0.6rem 0 0.4rem;">他方战事旁观：开启后，与朕无涉之战每回合末可<b>遣人观之</b>（战况重演·不改战果）。</div>'
        + '<div style="display:flex;gap:0.3rem;">' + pillOb(true,'开启 · 观之') + pillOb(false,'关闭 · 不观') + '</div>'
        + '</div>';
    })()+
    // API
    "<div class=\"settings-section\"><h4>API\u8FDE\u63A5</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u670D\u52A1\u5546</label><select id=\"s-prov\"><option value=\"openai\">OpenAI</option><option value=\"deepseek\">DeepSeek</option><option value=\"anthropic\">Claude</option><option value=\"custom\">\u81EA\u5B9A\u4E49</option></select></div><div class=\"fd\"><label>Key</label><input type=\"password\" id=\"s-key\" value=\""+(P.ai.key||"")+"\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u5730\u5740</label><input id=\"s-url\" value=\""+(P.ai.url||"")+"\" placeholder=\"https://api.openai.com/v1 \u6216\u4E2D\u8F6C\u7AD9URL\"></div><div class=\"fd\"><label>\u6A21\u578B</label><input id=\"s-model\" value=\""+(P.ai.model||"")+"\"></div></div>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin:-0.3rem 0 0.4rem;\">\u652F\u6301 OpenAI \u517C\u5BB9\u4E2D\u8F6C\u7AD9\uFF0C\u586B base URL \u5373\u53EF\u3002</div>"+
    (function(){
      var _on = !!(typeof P!=='undefined' && P && P.conf && P.conf.insecureTlsRelay===true);
      return '<label style="display:inline-flex;align-items:flex-start;gap:0.35rem;font-size:0.74rem;color:var(--txt-d);margin:-0.1rem 0 0.5rem;cursor:pointer;line-height:1.5;">'
        + '<input type="checkbox" id="s-insecure-tls" ' + (_on?'checked ':'') + 'onchange="sToggleInsecureTlsRelay(this.checked)" style="margin-top:0.15rem;flex:none;">'
        + '<span>\u5141\u8BB8\u4E2D\u8F6C\u7AD9<b style="color:var(--gold);">\u4E0D\u5B89\u5168\u8BC1\u4E66</b>\uFF08\u8BC1\u4E66\u57DF\u540D\u4E0D\u5339\u914D / \u81EA\u7B7E\u540D\u5BFC\u81F4\u8FDE\u4E0D\u4E0A\u65F6\u52FE\u9009\u00B7<b>\u4EC5\u5BF9\u4E0A\u65B9 API \u5730\u5740</b>\u751F\u6548\u00B7\u5B98\u65B9\u670D\u52A1\u5668\u4E0E\u70ED\u66F4\u4ECD\u4E25\u683C\u6821\u9A8C\u00B7\u5728\u7EBF\u7F51\u9875\u7248\u53D7\u6D4F\u89C8\u5668\u9650\u5236\u65E0\u6548\uFF09</span>'
        + '</label>';
    })()+
    "<div class=\"rw\"><div class=\"fd q\"><label>Temp</label><input type=\"number\" id=\"s-temp\" value=\""+(P.ai.temp||0.8)+"\" step=\"0.1\"></div><div class=\"fd q\"><label>\u8BB0\u5FC6</label><input type=\"number\" id=\"s-mem\" value=\""+(P.ai.mem||20)+"\"></div><div class=\"fd q\"><label>\u4E0A\u4E0B\u6587(K)</label><input type=\"number\" id=\"s-ctx\" value=\""+(P.conf.contextSizeK||0)+"\" placeholder=\"0=\u81EA\u52A8\" min=\"0\" title=\"\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\u5927\u5C0F(K tokens)\u3002\u7559\u7A7A\u62160=\u81EA\u52A8\u68C0\u6D4B\"></div></div>"+
    "<div style=\"font-size:0.7rem;color:var(--txt-d);margin:-0.2rem 0 0.3rem;\">\u4E0A\u4E0B\u6587\u7A97\u53E3\u5F71\u54CD\u8BB0\u5FC6\u538B\u7F29\u7B56\u7565\uFF1A128K+\u5BBD\u677E\u4FDD\u7559\u3001<32K\u6FC0\u8FDB\u538B\u7F29\u3001\u7559\u7A7A\u81EA\u52A8\u8BC6\u522B\u6A21\u578B</div>"+
    "<div style=\"display:flex;gap:0.3rem;margin-top:0.4rem;\"><button class=\"bai\" onclick=\"sDetectModels()\">\u68C0\u6D4B\u6A21\u578B</button><button class=\"bt bs bsm\" onclick=\"sTestConn()\">\u6D4B\u8BD5\u8FDE\u63A5</button><button class=\"bt bs bsm\" onclick=\"sReDetectCtx()\">\u91CD\u65B0\u63A2\u6D4B\u7A97\u53E3</button><button class=\"bt bp bsm\" onclick=\"sSaveAPI()\">\u4FDD\u5B58</button></div>"+
    "<div id=\"s-status\" style=\"font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;\"></div>"+
    "<div id=\"s-ctx-info\" style=\"font-size:0.72rem;color:var(--txt-d);margin-top:0.2rem;\"></div>"+
    "<div id=\"s-models\" class=\"model-list\" style=\"display:none;margin-top:0.4rem;\"></div>"+
    "<div style=\"margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid var(--bdr);\"><div style=\"font-size:0.75rem;color:var(--gold-d);margin-bottom:0.3rem;\">\u667A\u80FD\u751F\u56FE API\uFF08\u72EC\u7ACB\u914D\u7F6E\uFF0C\u7528\u4E8E\u7ACB\u7ED8\u7B49\u56FE\u7247\u751F\u6210\uFF09</div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">Key</label><input type=\"password\" id=\"s-img-key\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').key||'';}catch(e){return '';}})()+"\" placeholder=\"\u7559\u7A7A\u5219\u590D\u7528\u4E3BAPI\" style=\"font-size:0.8rem;\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">URL</label><input id=\"s-img-url\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').url||'';}catch(e){return '';}})()+"\" placeholder=\"https://api.openai.com/v1/images/generations\" style=\"font-size:0.8rem;\"></div><div class=\"fd\"><label style=\"font-size:0.72rem;\">\u6A21\u578B</label><input id=\"s-img-model\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').model||'dall-e-3';}catch(e){return 'dall-e-3';}})()+"\" style=\"font-size:0.8rem;width:80px;\"></div></div>"+
    "<div style=\"display:flex;gap:0.3rem;margin-top:0.3rem;\"><button class=\"bt bs bsm\" onclick=\"_sTestImgConn()\">\u6D4B\u8BD5\u8FDE\u63A5</button><button class=\"bt bs bsm\" onclick=\"_sDetectImgCap()\">\u68C0\u6D4B\u751F\u56FE\u529F\u80FD</button><button class=\"bt bp bsm\" onclick=\"_sSaveImgAPI()\">\u4FDD\u5B58</button></div>"+
    "<div id=\"s-img-status\" style=\"font-size:0.72rem;color:var(--txt-d);margin-top:0.3rem;\"></div></div></div>"+

    // 次要 API（M3·快模型路由）——与主 API UI 一致·仅数据对象区别
    (function(){
      var sec = (P.ai && P.ai.secondary) || {};
      var hasKey = !!(sec.key && sec.url);
      var enabled = !(P.conf && P.conf.secondaryEnabled === false);
      var active = hasKey && enabled;
      var badge;
      if (active) badge = ' <span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(107,176,124,0.18);color:var(--celadon-400,#6bb07c);font-size:0.7rem;font-weight:700;">\u25CF \u5DF2\u6FC0\u6D3B</span>';
      else if (hasKey) badge = ' <span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(184,154,83,0.18);color:var(--gold);font-size:0.7rem;font-weight:700;">\u25CB \u5DF2\u914D\u00B7\u672A\u542F\u7528</span>';
      else badge = ' <span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(120,120,120,0.2);color:var(--txt-d);font-size:0.7rem;">\u25CB \u672A\u914D\u7F6E</span>';
      return "<div class=\"settings-section\" style=\"border-left:3px solid var(--indigo-400,#4a6fa5);\"><h4 style=\"color:#92acd0;\">\u6B21\u8981 API\u00B7\u5FEB\u6A21\u578B\u8DEF\u7531" + badge + "</h4>"+
        "<div style=\"font-size:0.72rem;color:var(--txt-d);margin:-0.3rem 0 0.5rem;line-height:1.55;\">\u7528\u4E8E\u95EE\u5BF9\u00B7\u4E09\u79CD\u671D\u8BAE\u00B7\u6587\u4E8B\u52BF\u529B\u5B50\u8C03\u7528\u7B49\u6B21\u8981\u573A\u666F\u3002\u4E3B\u63A8\u6F14\u59CB\u7EC8\u8D70\u4E3B API\u3002</div>"+
        "<div class=\"rw\"><div class=\"fd\"><label>\u670D\u52A1\u5546</label><select id=\"s-sec-prov\"><option value=\"openai\">OpenAI</option><option value=\"deepseek\">DeepSeek</option><option value=\"anthropic\">Claude</option><option value=\"custom\">\u81EA\u5B9A\u4E49</option></select></div><div class=\"fd\"><label>Key</label><input type=\"password\" id=\"s-sec-key\" value=\""+(sec.key||"")+"\" placeholder=\"\u7559\u7A7A\u5219\u56DE\u9000\u4E3B API\"></div></div>"+
        "<div class=\"rw\"><div class=\"fd\"><label>\u5730\u5740</label><input id=\"s-sec-url\" value=\""+(sec.url||"")+"\" placeholder=\"https://api.openai.com/v1\"></div><div class=\"fd\"><label>\u6A21\u578B</label><input id=\"s-sec-model\" value=\""+(sec.model||"")+"\" placeholder=\"gpt-4o-mini / haiku\"></div></div>"+
        "<div style=\"font-size:0.7rem;color:var(--txt-d);margin:-0.2rem 0 0.3rem;\">\u63A8\u8350\uFF1Agpt-4o-mini \u00B7 claude-haiku-4-5 \u00B7 deepseek-chat \u00B7 gemini-2.5-flash</div>"+
        "<div style=\"display:flex;gap:0.3rem;margin-top:0.4rem;flex-wrap:wrap;\"><button class=\"bai\" onclick=\"sDetectSecondaryModels()\">\u68C0\u6D4B\u6A21\u578B</button><button class=\"bt bs bsm\" onclick=\"sTestSecondaryConn()\">\u6D4B\u8BD5\u8FDE\u63A5</button><button class=\"bt bp bsm\" onclick=\"sSaveSecondaryAPI()\">\u4FDD\u5B58</button>"+
        (hasKey ? "<button class=\"bt bd bsm\" onclick=\"sClearSecondaryAPI()\">\u6E05\u9664</button>" : "") +
        "<label style=\"display:inline-flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--txt-d);margin-left:auto;"+(hasKey?"":"opacity:0.5;cursor:not-allowed;")+"\"><input type=\"checkbox\" id=\"s-sec-enabled\" "+(enabled?"checked ":"")+(hasKey?"":"disabled ")+"onchange=\"sToggleSecondaryEnabled(this.checked)\"> \u542F\u7528\u6B21 API</label>"+
        "</div>"+
        "<div id=\"s-sec-status\" style=\"font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;\"></div>"+
        "<div id=\"s-sec-models\" class=\"model-list\" style=\"display:none;margin-top:0.4rem;\"></div>"+
        (hasKey ? "<div style=\"margin-top:0.5rem;padding:0.4rem 0.5rem;background:rgba(74,111,165,0.06);border-left:2px solid var(--indigo-400,#4a6fa5);border-radius:2px;font-size:0.7rem;color:var(--txt-d);line-height:1.55;\"><div><b style=\"color:#92acd0;\">\u6FC0\u6D3B\u65F6\u8DEF\u7531\uFF1A</b>\u95EE\u5BF9 \u00B7 \u5EF7\u8BAE \u00B7 \u5FA1\u524D \u00B7 \u5E38\u671D \u00B7 \u6587\u4E8B\u52BF\u529B\uFF08\u4E94\u7C7B\u9AD8\u9891\u5B50\u8C03\u7528\uFF09</div><div style=\"margin-top:0.2rem;\"><b>\u4E3B API \u59CB\u7EC8\u8D1F\u8D23\uFF1A</b>\u56DE\u5408\u63A8\u6F14(SC1/SC1b/SC1c) \u00B7 \u8BE2\u5929 \u00B7 \u8BE1\u5199\u6DF1\u5EA6\u6587\u672C</div></div>" : "") +
        "</div>";
    })()+

    // P15: 性能·成本控制（KokoroMemo 借鉴的 3 个开关）
    (function(){
      try { console.log('[P15 settings] 性能·成本控制 段渲染中·v=2026050104'); } catch(_){}
      var _gateOn = !!(P.conf && P.conf.recallGateEnabled === true);
      // 修复失效:消费端读 memorySynthesisEnabled(旧键 consolidationEnabled 被迁移框架删)·UI 读/写都对齐新键(兼容旧键回落)
      var _consolOn = !(P.conf && (P.conf.memorySynthesisEnabled === false || (P.conf.memorySynthesisEnabled === undefined && P.conf.consolidationEnabled === false)));
      var _semOn = !(P.conf && P.conf.semanticRecallAutoload === false);
      // 注:agent-only 调参(记忆深度/自适应深化/工作上下文窗口)已移至「🧪实验模式→🤖Agent 模式」块(仅该模式生效·归位)
      return '<div class="settings-section" style="border-left:3px solid var(--celadon-500,#5a8f7f);background:rgba(126,184,167,0.03);">' +
        '<h4 style="color:var(--celadon-400,#7eb8a7);">⚡ 性能·成本控制</h4>' +
        '<div style="font-size:0.72rem;color:var(--txt-d);margin:-0.3rem 0 0.6rem;line-height:1.55;">这些开关控制 AI 调用频率与本地资源使用·默认设置面向"质量优先"。</div>' +
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
          '<input type="checkbox" id="s-recall-gate" ' + (_gateOn?'checked ':'') + 'onchange="_togglePConf(\'recallGateEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">启用召回节流（省 API）</div>' +
            '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">开启后·常规回合跳过 SC_RECALL 5 源召回·节省 40-60% API 成本。关闭时（默认）每回合都跑全量召回·AI 记忆富度最高。</div>' +
          '</div>' +
        '</label>' +
        (function(){
          var _wtAgOn = !(P.conf && P.conf.wentianAgentMode === false);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-wentian-agent" ' + (_wtAgOn?'checked ':'') + 'onchange="_togglePConf(\'wentianAgentMode\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">问天·先查证后裁定（agent 模式·默认启用）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">问天指令先由 AI 用只读工具核实对象在档真名与现值（治错字/绰号/记错现状致直改失败）·再提交裁定·可一次多笔直改。多 1-3 次轻量调用（走次要 API）。关闭则回到单发解析。</div>' +
            '</div>' +
          '</label>';
        })() +
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
          '<input type="checkbox" id="s-consol" ' + (_consolOn?'checked ':'') + 'onchange="_togglePConf(\'memorySynthesisEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">后台记忆固化 / 综合（默认启用）</div>' +
            '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">每回合后台追加一次记忆整合调用（优先走次要 API）·不阻塞玩家·增加约 20% API 成本。关闭后 AI 记忆连贯性会减低。</div>' +
          '</div>' +
        '</label>' +
        // (agent-only 调参:记忆深度/自适应深化/工作上下文窗口 已移至「🧪实验模式→🤖Agent 模式」块)
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
          '<input type="checkbox" id="s-sem" ' + (_semOn?'checked ':'') + 'onchange="_togglePConf(\'semanticRecallAutoload\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">本地语义检索自动加载（默认启用）</div>' +
            '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">游戏开始 5 秒后后台加载 bge-small-zh 模型（23 MB）·提供 SC_RECALL 第 5 源语义同义召回。Electron 预打包后秒开·网页端从 hf-mirror 缓存。关闭可省 23 MB 下载。</div>' +
          '</div>' +
        '</label>' +
        // Phase F3·2026-05-10·NPC 决策精细化开关
        (function(){
          var _npcAi = !(P.conf && P.conf.npcAiPrecision === false);
          var _npcPolish = !(P.conf && P.conf.npcAiCosmeticEnrich === false);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-npc-ai" ' + (_npcAi?'checked ':'') + 'onchange="_togglePConf(\'npcAiPrecision\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">NPC 势力真决策（LLM 精细推演·真实改动数据）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">关闭：NPC 奏疏/诏令/朝议/人事主要走本地模板。开启：每回合按优先级调用 LLM，让非玩家势力产生可落账的财政、军务、外交、地政等行动；结果会进入势力 AI 账本、近事和后续推演依据。需有主 API key。</div>' +
            '</div>' +
          '</label>' +
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-npc-polish" ' + (_npcPolish?'checked ':'') + 'onchange="_togglePConf(\'npcAiCosmeticEnrich\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">NPC 文字润色（cosmetic·不改数据）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">只润色 NPC 已有奏疏/诏令的文辞显示，不新增行动、不改财政军务外交地政；用于和“真决策”区分。</div>' +
            '</div>' +
          '</label>';
        })()+
        // v2.6 Slice 0·廷议 v3 toggle·默认 ON (useTinyiV3 != false)·user 主动关到 v2 fallback
        (function(){
          var _v3On = !(P.conf && P.conf.useTinyiV3 === false);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-tinyi-v3" ' + (_v3On?'checked ':'') + 'onchange="_togglePConf(\'useTinyiV3\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">廷议·新框架 v3 (8 阶段·默认启用)</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">默认启用 v3 廷议·8 阶段政治模拟 (议前预审/起议/辩议/廷推/钦定/草诏/用印/追责)。关闭则退回 v2 (简陋 5 阶段·已加 ChronicleTracker/ClassEngine fallback)。sprint 测试期遇 bug 关掉走 v2。</div>' +
            '</div>' +
          '</label>';
        })()+
        // ─── 科举特科 toggle·2026-06-14 特科默认开（D2/G2/G3/G5·!== false）·H 私学仍 opt-in ───
        // D2·特科 spawn 总开关 (gate 所有 G1/G2/G3/G5 trigger)
        (function(){
          var _on = !!(P.conf && P.conf.useNewKejuD2 !== false);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-keju-d2" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'useNewKejuD2\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🎓 特科·总开关（默认开）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">恩科、武举、童子科等特科的总闸。开启后，特科会按朝代与时机（改元、大婚、战事等）自然出现于朝堂议程；关闭则朝中不再有任何特科。</div>' +
            '</div>' +
          '</label>';
        })()+
        // G2·恩科 mini-keju
        (function(){
          var _on = !!(P.conf && P.conf.useNewKejuG2 !== false);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-keju-g2" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'useNewKejuG2\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🎓 恩科（需总开关）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">逢万寿、改元、大婚等庆典加开的恩科。可经议程、问礼部或下诏三途开科，有谢恩大典；滥开则功名贬值。</div>' +
            '</div>' +
          '</label>';
        })()+
        // G3·武举 mini-keju
        (function(){
          var _on = !!(P.conf && P.conf.useNewKejuG3 !== false);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-keju-g3" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'useNewKejuG3\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🎓 武举（需总开关）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">战事吃紧或将才匮乏时开武举选将。含校阅大典、派往边镇、战功累升、武勋世家，乱世亦有兵谏之险。</div>' +
            '</div>' +
          '</label>';
        })()+
        // G5·童子科 mini-keju
        (function(){
          var _on = !!(P.conf && P.conf.useNewKejuG5 !== false);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-keju-g5" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'useNewKejuG5\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🎓 童子科（需总开关）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">为 9–14 岁神童特设。神童各有际遇（早夭、大器晚成、奇行避世、才尽），有抚摩大典；大器晚成者中年方真入会试。</div>' +
            '</div>' +
          '</label>';
        })()+
        // H·私学/书院·12 维深嵌入
        (function(){
          var _on = !!(P.conf && P.conf.useNewKejuH !== false);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-keju-h" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'useNewKejuH\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🏛️ 科举·H 私学/书院（默认开·12 维深嵌入）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">东林/复社/朱熹/王阳明书院·山长真 NPC·5 watershed (1190/1290/1500/1604/1654/1742)·学说真改 paradigm·反馈循环。</div>' +
            '</div>' +
          '</label>';
        })()+
        // Scandal·科场弊案 (opt-in·默认关·2026-07-01·补设置开关·此前仅 console 可开) ───
        (function(){
          var _on = !!(P.conf && P.conf.useNewKejuScandal === true);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-top:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-keju-scandal" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'useNewKejuScandal\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🎓 科场弊案（默认关）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">开启后，科举可能爆出舞弊/科场案（关节、冒籍、鬻题、通关节等），牵连考官士子、引发清议与查办；关闭则不触发弊案链。</div>' +
            '</div>' +
          '</label>';
        })()+
      '</div>';
    })()+

    // ── 🧪 实验模式·2026-06-20·先「开启实验模式」→ 选「LLM 模式」(原"实验玩法"·LLM 升级) 或「Agent 模式」(回合推演 agent化·模式 b) ──
    (function(){
      var _expOn = !!((P.conf && P.conf.experimentalEnabled) || (P.ai && P.ai.experimentalEnabled));
      var _mode = ((P.conf && P.conf.experimentalMode) || (P.ai && P.ai.experimentalMode) || 'llm');
      var _isAgent = (_mode === 'agent');
      var _on = !!((P.conf && P.conf.agentUpgradesEnabled) || (P.ai && P.ai.agentUpgradesEnabled));
      var _ftc = !!((P.conf && P.conf.factionToolDecisionEnabled) || (P.ai && P.ai.factionToolDecisionEnabled));
      var _evu = !!((P.conf && P.conf.eventUnificationEnabled) || (P.ai && P.ai.eventUnificationEnabled));
      var _ofa = !!((P.conf && P.conf.officeActivationEnabled) || (P.ai && P.ai.officeActivationEnabled));
      var _tlc = !!((P.conf && P.conf.talentCohortEnabled) || (P.ai && P.ai.talentCohortEnabled));
      var h = '<div class="settings-section" style="border-left:3px solid var(--vermillion-400,#c04030);background:rgba(192,64,48,0.04);">' +
        '<h4 style="color:var(--vermillion-300,#d4706a);">🧪 实验模式</h4>' +
        '<div style="font-size:0.72rem;color:var(--txt-d);margin:-0.3rem 0 0.6rem;line-height:1.55;">实验性玩法（默认关）。先<b>开启实验模式</b>·再二选一：<b>LLM 模式</b>(对现回合管线的增量增强)或 <b>Agent 模式</b>(全新·AI 主动改世界·替换管线)。会增加 API 调用·建议先小局试。</div>' +
        // 总闸
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">' +
          '<input type="checkbox" id="s-exp-enabled" ' + (_expOn?'checked ':'') + 'onchange="_toggleExperimentalEnabled(this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🧪 开启实验模式</div>' +
            '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">总闸。关闭则下方一切实验内容不生效（零回归）。</div>' +
          '</div>' +
        '</label>';
      if (_expOn) {
        // 模式选择（二选一·互斥）
        h += '<div style="margin:0.4rem 0;padding:0.45rem 0.55rem;background:rgba(192,64,48,0.07);border-radius:4px;">' +
          '<div style="font-size:0.74rem;color:var(--txt-d);margin-bottom:0.35rem;">选择模式（二选一·互斥）：</div>' +
          '<label style="display:inline-flex;align-items:center;gap:0.3rem;margin-right:1.2rem;cursor:pointer;font-size:0.84rem;font-weight:600;color:' + (!_isAgent?'var(--gold)':'var(--txt-d)') + ';">' +
            '<input type="radio" name="exp-mode" ' + (!_isAgent?'checked ':'') + 'onchange="_setExperimentalMode(\'llm\')"> 🧠 LLM 模式</label>' +
          '<label style="display:inline-flex;align-items:center;gap:0.3rem;cursor:pointer;font-size:0.84rem;font-weight:600;color:' + (_isAgent?'var(--gold)':'var(--txt-d)') + ';">' +
            '<input type="radio" name="exp-mode" ' + (_isAgent?'checked ':'') + 'onchange="_setExperimentalMode(\'agent\')"> 🤖 Agent 模式</label>' +
        '</div>';
        if (_isAgent) {
          // ── Agent 模式（模式 b·回合推演 agent化·选中即启用）──
          h += '<div style="padding:0.5rem 0.6rem;background:rgba(120,180,255,0.06);border-left:2px solid var(--celadon-500,#5a8f7f);border-radius:3px;">' +
            '<div style="font-size:0.82rem;color:var(--celadon-400,#7eb8a7);font-weight:600;">🤖 回合推演 agent 化（模式 b·已启用）</div>' +
            '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.6;margin-top:0.25rem;">选中即启用。回合推演<b>不再走 LLM 管线(sc0-sc28)</b>·改由 AI agent 像「局内 Claude Code」一样运作：引擎先算硬核基线 → agent 看真数 → 主动读写存档任意内容直接落地（想怎么改怎么改）→ 状态自检·崩则回滚降级。产出与应用焊死（报告=实际改动）·根治「推演说改了却没改」。<b>需主 API key·比 LLM 模式更慢更费（实验）</b>·崩溃自动回落 LLM。</div>' +
            '<div style="font-size:0.68rem;color:var(--txt-d);opacity:0.85;margin-top:0.3rem;">目前覆盖：回合推演。后续更多环节将按此 agent 化。</div>' +
          '</div>';
          // ── Agent 调参(仅 Agent 模式生效·从性能段归位·按模型能力调省调用/上下文) ──
          var _memDepth = Math.max(2, Math.round((P.conf && P.conf.agentMemoryDepth) || 6));
          var _adaptiveOn = !(P.conf && P.conf.agentAdaptiveDeepen === false);
          var _transRounds = Math.max(1, Math.round((P.conf && P.conf.agentTranscriptRecentRounds) || 2));
          h += '<div style="margin-top:0.45rem;padding:0.5rem 0.6rem;background:rgba(120,180,255,0.045);border-radius:3px;">' +
            '<div style="font-size:0.8rem;color:var(--celadon-400,#7eb8a7);font-weight:600;margin-bottom:0.15rem;">⚙️ Agent 调参（按模型能力 · 省调用/上下文）</div>' +
            // 记忆深度(agent 长记忆窗口)
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.35rem 0;border-top:1px dotted rgba(120,180,255,0.2);">' +
              '<div style="flex:1;">' +
                '<div style="font-size:0.8rem;color:var(--gold);font-weight:600;">记忆深度（回合）</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.55;margin-top:0.12rem;">近 N 回合喂"细节"·更早的自动压缩为综合脉络（压缩≠删·agent 仍可主动调取查全）。模型上下文越大可设越高（更全·更耗上下文）。' +
                  '<select onchange="if(window._setAgentMemoryDepth)_setAgentMemoryDepth(this.value)" style="margin-top:0.3rem;background:var(--bg-d,#1a1a1a);color:var(--txt);border:1px solid var(--bdr);border-radius:4px;padding:0.2rem 0.4rem;">' +
                    '<option value="4"' + (_memDepth===4?' selected':'') + '>4 · 精简(省上下文/弱模型)</option>' +
                    '<option value="6"' + (_memDepth===6?' selected':'') + '>6 · 标准(默认)</option>' +
                    '<option value="10"' + (_memDepth===10?' selected':'') + '>10 · 丰富(强模型)</option>' +
                    '<option value="15"' + (_memDepth===15?' selected':'') + '>15 · 极致(长上下文模型)</option>' +
                  '</select>' +
                '</div>' +
              '</div>' +
            '</label>' +
            // 刀1·自适应深化
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.35rem 0;border-top:1px dotted rgba(120,180,255,0.2);cursor:pointer;">' +
              '<input type="checkbox" id="s-adaptive-deepen" ' + (_adaptiveOn?'checked ':'') + 'onchange="_togglePConf(\'agentAdaptiveDeepen\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
              '<div style="flex:1;">' +
                '<div style="font-size:0.8rem;color:var(--gold);font-weight:600;">自适应深化（默认启用 · 省调用）</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.55;margin-top:0.12rem;">收尾时只深化本回合真有动静的维度（如本回合无战事·则跳过军事深化·省一次调用、去掉对空维度的填充）·地板维度（记忆/人物/世界/史记）始终深化。关闭则每维度都深化（深度纯粹优先·更耗调用）。</div>' +
              '</div>' +
            '</label>' +
            // 刀2·工作上下文窗口
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.35rem 0;border-top:1px dotted rgba(120,180,255,0.2);">' +
              '<div style="flex:1;">' +
                '<div style="font-size:0.8rem;color:var(--gold);font-weight:600;">工作上下文窗口（轮 · 省 token）</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.55;margin-top:0.12rem;">多轮推演时·上下文保留最近 N 轮的工具明细全文·更早的折叠为一行摘要（token 不随轮数膨胀）。越大越连贯·越耗 token。' +
                  '<select onchange="if(window._setAgentTranscriptRounds)_setAgentTranscriptRounds(this.value)" style="margin-top:0.3rem;background:var(--bg-d,#1a1a1a);color:var(--txt);border:1px solid var(--bdr);border-radius:4px;padding:0.2rem 0.4rem;">' +
                    '<option value="1"' + (_transRounds===1?' selected':'') + '>1 · 极省</option>' +
                    '<option value="2"' + (_transRounds===2?' selected':'') + '>2 · 标准(默认)</option>' +
                    '<option value="3"' + (_transRounds===3?' selected':'') + '>3 · 宽</option>' +
                    '<option value="4"' + (_transRounds===4?' selected':'') + '>4 · 最宽(长上下文)</option>' +
                  '</select>' +
                '</div>' +
              '</div>' +
            '</label>' +
          '</div>';
          // ── Agent 元认知增强（实验·各加 AI 调用·默认全关·按需逐个开 A/B 验·命门:硬核可信）──
          var _reflectOn = !!(P.conf && P.conf.agentSelfReflectEnabled);
          var _qualityOn = !!(P.conf && P.conf.agentQualityGateEnabled);
          var _edictOvOn = !!(P.conf && P.conf.agentEdictOversightEnabled);
          var _anomalyOn = !!(P.conf && P.conf.agentAnomalyEnabled);
          h += '<div style="margin-top:0.45rem;padding:0.5rem 0.6rem;background:rgba(180,140,255,0.05);border-radius:3px;">' +
            '<div style="font-size:0.8rem;color:#c4a3ff;font-weight:600;margin-bottom:0.15rem;">🧠 Agent 元认知增强（实验 · 各加 AI 调用 · 默认关）</div>' +
            '<div style="font-size:0.66rem;color:var(--txt-d);opacity:0.85;line-height:1.5;margin-bottom:0.1rem;">让 agent 学会自省/审稿/不失忆/深查——服务「硬核可信」命门。各项独立·按需开·每项每回合多一次 AI 调用。</div>' +
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.35rem 0;border-top:1px dotted rgba(180,140,255,0.2);cursor:pointer;">' +
              '<input type="checkbox" ' + (_reflectOn?'checked ':'') + 'onchange="_togglePConf(\'agentSelfReflectEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
              '<div style="flex:1;"><div style="font-size:0.8rem;color:var(--gold);font-weight:600;">自我反思 · 校准</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.55;margin-top:0.12rem;">每回合比对「上回合推演 vs 实际」→维护滚动偏差画像→下回合推演前注入校正（如「你倾向高估军力」），越玩越准。</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.35rem 0;border-top:1px dotted rgba(180,140,255,0.2);cursor:pointer;">' +
              '<input type="checkbox" ' + (_qualityOn?'checked ':'') + 'onchange="_togglePConf(\'agentQualityGateEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
              '<div style="flex:1;"><div style="font-size:0.8rem;color:var(--gold);font-weight:600;">内容质量闸</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.55;margin-top:0.12rem;">成文后、提交前审查史记（因果是否合理/有无时代错乱/是否与既定事实矛盾），不过则自动修订一轮再提交。</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.35rem 0;border-top:1px dotted rgba(180,140,255,0.2);cursor:pointer;">' +
              '<input type="checkbox" ' + (_edictOvOn?'checked ':'') + 'onchange="_togglePConf(\'agentEdictOversightEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
              '<div style="flex:1;"><div style="font-size:0.8rem;color:var(--gold);font-weight:600;">跨回合一致 · 诏令督查</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.55;margin-top:0.12rem;">把往回合在办的诏令（带进度/被架空）+近期已故名单注入推演（颁布≠见效·不失忆/不令已故者复活），并每回合真评估活诏令实效。</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.35rem 0;border-top:1px dotted rgba(180,140,255,0.2);cursor:pointer;">' +
              '<input type="checkbox" ' + (_anomalyOn?'checked ':'') + 'onchange="_togglePConf(\'agentAnomalyEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
              '<div style="flex:1;"><div style="font-size:0.8rem;color:var(--gold);font-weight:600;">冷门动作深查</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.55;margin-top:0.12rem;">玩家做出格/创造性举措时，agent 先深查真实史例先例再推演其可信后果（硬核×自由的命门交点·让天马行空也有史可依）。</div></div>' +
            '</label>' +
          '</div>';
          // ── 活世界·势力自主（实验·命门「活世界」·后台 agent 调用·默认关·扩展①）──
          //   agent 模式默认势力不决策(endturn-systems 不跑 NPC + factionAgentEnabled 被互斥关)→世界静止。此开关经"活世界例外"放行势力 agent③ 满血。
          var _liveWorldOn = !!(P.conf && P.conf.agentLiveWorldEnabled);
          h += '<div style="margin-top:0.45rem;padding:0.5rem 0.6rem;background:rgba(120,200,160,0.06);border-radius:3px;">' +
            '<div style="font-size:0.8rem;color:#9fe0c0;font-weight:600;margin-bottom:0.15rem;">🌍 活世界 · 势力自主决策（实验 · 默认关）</div>' +
            '<div style="font-size:0.66rem;color:var(--txt-d);opacity:0.85;line-height:1.5;margin-bottom:0.1rem;">agent 模式默认只推演「你的朝廷」·列国/各方势力静止。开启后每回合后台让最强及与你相关的数派势力自主决策（外交/备战/结盟/背叛）·世界不再围你转——服务「活世界」命门。复用已验证的势力 agent（含战略姿态/双向外交）·每派每回合多一次 AI 调用（封顶）。</div>' +
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.35rem 0;border-top:1px dotted rgba(120,200,160,0.25);cursor:pointer;">' +
              '<input type="checkbox" id="s-agent-liveworld" ' + (_liveWorldOn?'checked ':'') + 'onchange="_togglePConf(\'agentLiveWorldEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
              '<div style="flex:1;"><div style="font-size:0.8rem;color:var(--gold);font-weight:600;">势力自主当家</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.55;margin-top:0.12rem;">每回合后台跑数派非玩家势力的自主推演（激活：最强三派固定 + 与你相关者动态入选）·各派按自己的目标/宿怨/姿态行动并回写世界。需主 API key。</div></div>' +
            '</label>' +
          '</div>';
        } else {
          // ── LLM 模式（原"实验玩法"·对现管线的增量增强·各项独立开关）──
          h += '<div style="font-size:0.7rem;color:var(--txt-d);margin:0.25rem 0 0.2rem;line-height:1.5;">LLM 模式：在现有回合管线上叠加的 AI 增强（各项独立·可单独调试）。</div>' +
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">' +
            '<input type="checkbox" id="s-agent-upgrades" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'agentUpgradesEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🧠 启用全部 LLM 升级（默认关·实验）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">一键开启 9 项对 LLM 管线的增强：按需取数召回、势力前瞻目标栈、主推演异常路由、朝堂博弈、记忆管家固化、自我反思偏差校正、诏令执行督查、史实顾问引证(仅史实模式)、势力自主当家(激活策略3固定最强+5动态·战略姿态自著)。各项原有独立开关仍可单独调试。需主 API key·会增加 API 调用。</div>' +
            '</div>' +
          '</label>' +
          // ── 官制活化（实验）·总闸·2026-06-20·一键启用官职履职/权限门/改制裁定/agent 按需取数 ──
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;border-top:1px solid rgba(192,64,48,0.15);margin-top:0.3rem;">' +
            '<input type="checkbox" id="s-office-activation" ' + (_ofa?'checked ':'') + 'onchange="_togglePConf(\'officeActivationEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🏛️ 启用官制活化（默认关·实验）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">让死的官制活起来：①职权舆图喂推演 ②官员履职度(才+五常·失职衰减·与主动行动耦合) ③权限门(掌“征税”之权出缺/失职→实征打折·腐败涨) ④AI 裁定式改制(玩家自由改官制·官僚抵抗·拟制两回合) ⑤官署按需细查(agent 走次要 API·返职责描述)。各刀另有独立开关可单独调试·会增加 API 调用。</div>' +
            '</div>' +
          '</label>' +
          // ── 官制活化·细粒度（活化四刀/recall/出缺补员各独立开关·总闸开则全覆盖·此处供总闸关时单独调；默认开者可在此关·2026-07-01）──
          '<div style="font-size:0.74rem;color:var(--gold-d);margin:0.45rem 0 0.15rem;padding-top:0.35rem;border-top:1px dashed rgba(192,64,48,0.22);">🏛️ 官制活化·细粒度（总闸开则四刀全启；下列供总闸关时单独调·默认开者可在此关）</div>' +
          (function(){
            var _acts = [
              ['officePowerPerceptionEnabled','职权舆图（默认开）','把官制结构(谁掌何权/才德/履职/出缺)喂进 AI 推演·纯增益无 balance 后果。',true],
              ['officeDutyStateEnabled','官员履职度','官员履职度(才+五常)·失职衰减·与主动行动耦合(影响 balance)。',false],
              ['officeAuthorityGateEnabled','权限门控','掌“征税”等权者出缺/失职→实征打折·腐败涨(影响 balance)。',false],
              ['officeReformAdjudicationEnabled','改制裁定','玩家自由改官制→官僚抵抗·拟制两回合·AI 裁定准驳。',false],
              ['officeRecallAgentEnabled','官署按需细查','主推演对焦点衙门发 agent 子调用取职责细节(走次要 API·增调用)。',false],
              ['officeVacancyEnabled','出缺补员（默认开）','官员亡故/致仕留缺→按建制走出缺·可被补员(关则不自动出缺)。',true]
            ];
            var _ah = '';
            for (var _ai2 = 0; _ai2 < _acts.length; _ai2++) {
              var _ac = _acts[_ai2];
              var _acOn = _ac[3]
                ? !((P && P.conf && P.conf[_ac[0]] === false) || (P && P.ai && P.ai[_ac[0]] === false))
                : !!((P && P.conf && P.conf[_ac[0]]) || (P && P.ai && P.ai[_ac[0]]));
              _ah += '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.3rem 0;cursor:pointer;border-top:1px dotted rgba(192,64,48,0.12);">' +
                '<input type="checkbox" ' + (_acOn ? 'checked ' : '') + 'onchange="_togglePConf(\'' + _ac[0] + '\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
                '<div style="flex:1;"><div style="font-size:0.8rem;color:var(--gold);font-weight:600;">' + _ac[1] + '</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.5;margin-top:0.1rem;">' + _ac[2] + '</div></div>' +
                '</label>';
            }
            return _ah;
          })() +
          // ── 官制·机制深化（S1/S4·各独立开关·与上「官制活化」并行·默认关·2026-06-30）──
          '<div style="font-size:0.74rem;color:var(--gold-d);margin:0.45rem 0 0.15rem;padding-top:0.35rem;border-top:1px dashed rgba(192,64,48,0.22);">🏛️ 官制·机制深化（独立开关·默认关·开后官制真撬动财政/吏治/阴谋/人才/皇权）</div>' +
          (function(){
            var _items = [
              ['powerMinisterEnabled','权臣坐大','久居要位(宰相/首辅等)+高野心者坐大：截留奏疏·自拟诏命·皇权极弱时篡位终局。'],
              ['officeReviewLandingEnabled','考课落地','年度考课优劣真升降功名(驱动 rankLevel)：优等擢·劣等黜失职·连劣记数。'],
              ['officeConspiracyEnabled','官位入阴谋','官位品级喂阴谋：高官谋逆酝酿更快更隐秘·门生故吏更易拉拢。'],
              ['officeSatisfactionFeedbackEnabled','才不配位反哺','能臣才高位卑(怀才不遇)→忠诚渐降·久郁萌求去。'],
              ['officeSalaryHeadcountEnabled','俸禄认人','冗官超编→国库俸禄开支真增(冗官有财政代价·非凭空养)。'],
              ['officePersonnelTurnoverEnabled','致仕新陈代谢','年终察老：高龄官乞骸骨(可慰留)·耄耋准致仕去位(可诏起复)。'],
              ['officeJingchaEnabled','京察大计','每三年黜庸劣(屡考连劣)+拔沉才(怀才不遇)·只降擢功名(可逆)·不擅自革职。']
            ];
            var _hh = '';
            for (var _i = 0; _i < _items.length; _i++) {
              var _it = _items[_i];
              var _on = !!(typeof P !== 'undefined' && P && P.conf && P.conf[_it[0]]);
              _hh += '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.3rem 0;cursor:pointer;border-top:1px dotted rgba(192,64,48,0.12);">' +
                '<input type="checkbox" ' + (_on ? 'checked ' : '') + 'onchange="_togglePConf(\'' + _it[0] + '\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
                '<div style="flex:1;"><div style="font-size:0.8rem;color:var(--gold);font-weight:600;">' + _it[1] + '</div>' +
                '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.5;margin-top:0.1rem;">' + _it[2] + '</div></div>' +
                '</label>';
            }
            return _hh;
          })() +
          // 【A·S4】势力按需取数·单独 opt-in(总闸已含·此处供隔离试)·换深度非降本
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;border-top:1px solid rgba(192,64,48,0.15);margin-top:0.3rem;">' +
            '<input type="checkbox" id="s-faction-toolcall" ' + (_ftc?'checked ':'') + 'onchange="_togglePConf(\'factionToolDecisionEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🔧 势力按需取数（A·单独试·默认关）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">势力决策改 tool-calling：只给核心情报+工具，势力自己按需查对手/朝堂/往绩/世界/家底/历史先例(复用②检索)。<b>换决策深度，非降本</b>(2 轮·可能略增调用)。开后看控制台 <code>GM._factionToolStats</code> 观察查询行为。关 = 原单发不变。</div>' +
            '</div>' +
          '</label>' +
          // 【事件系统统一·S1】统一事件总线开关·独立(不并 LLM 升级总闸·同势力按需取数那样单独 opt-in)
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;border-top:1px solid rgba(192,64,48,0.15);margin-top:0.3rem;">' +
            '<input type="checkbox" id="s-event-unification" ' + (_evu?'checked ':'') + 'onchange="_togglePConf(\'eventUnificationEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🎭 事件系统统一（S1 骨架·默认关）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">把散落的事件机制统一为「活世界抛局面→玩家应对→AI 裁硬核后果」主线。<b>当前为 S1 骨架，拨开暂无可见变化</b>(仅打通事件总线管道+验证不破坏存档)；后续切片接通后，事件将由 AI 裁定连锁后果。现在开=仅供验证不炸。</div>' +
            '</div>' +
          '</label>' +
          // 【人才范式渗透·S1-S6】制度性建筑(新式学校)→人才渐渗·独立 opt-in
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;border-top:1px solid rgba(192,64,48,0.15);margin-top:0.3rem;">' +
            '<input type="checkbox" id="s-talent-cohort" ' + (_tlc?'checked ':'') + 'onchange="_togglePConf(\'talentCohortEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🎓 人才范式渗透（默认关·实验）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">新式学校不直接加数值，而向「人才范式渗透引擎」注入毕业生→多瓶颈漏斗(招生/师资质量/产业吸纳/历练数年/制度空间)→日积月累渐渗→因学而异的全局风气软修正(注入 AI 推演)+双向阻力(旧学请罢新学/失业学潮·入御案时政)。狂建空壳学校(无师资/无产业)无效·毕业即失业。兴造弹窗可见「人才与风气」一览·剧本可 preset 既有正统。</div>' +
            '</div>' +
          '</label>';
        }
      }
      h += '</div>';
      return h;
    })()+

    // ── 战斗规则·确定性战果 (opt-in·默认关·2026-06-15) ──
    (function(){
      var _on = !!(P.conf && P.conf.deterministicCasualties === true);
      return '<div class="settings-section"><h4>战斗规则</h4>' +
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">' +
        '<input type="checkbox" id="s-det-cas" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'deterministicCasualties\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
        '<div style="flex:1;">' +
          '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">⚔️ 确定性战果（默认关）</div>' +
          '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">开启后，当推演 AI 漏报或给出离谱伤亡时，改由战斗引擎按双方兵力、地形、城防、季节确定性核算战损，机械可信度更高；关闭则一切战果由 AI 自由裁量（默认）。</div>' +
        '</div>' +
      '</label></div>';
    })()+

    // ── 玩法机制·深化 (opt-in·默认关·2026-07-01·补设置开关·此前仅 console 可开·确定性玩法非 AI) ──
    (function(){
      var _mechs = [
        ['worldReactorBattleEnabled','⚔️ 兵败牵动天下（默认关）','开启后，一方在会战中大败，其军事实力确定性受损，并联动编年记述天下反应；关闭则战败只走 AI 自由裁量，不自动折损实力。'],
        ['populationBottomUpEnabled','👥 人口自下而上（默认关）','开启后，人口增长发生在各叶级政区、按当地民心与承载力分别核算并写入地方户口；关闭则走全局粗粒度增长。'],
        ['cognitionFeedbackEnabled','🎭 认知反馈·忠诚（默认关·未充分实测）','开启后，臣子被贬则渐离心、受知遇则渐效忠——把「知遇/贬谪」从叙事落到忠诚数值动平衡；关闭则忠诚不因升降迁谪自动漂移。此项动平衡幅度未充分验证，酌情开启。'],
        ['agencyWatchEnabled','🕵 密探常侦（默认关）','开启后，常设的直属天子密探机构（治理面板可诏设，依机构独立性识别，台谏不算）逐回合暗中侦缉，确定性推高在酿阴谋的败露进度；机构腐败、缺员则侦缉效力打折，特务坐大另有反噬制衡。关闭则查案只靠陛下亲自下诏。'],
        ['sysPTieringEnabled','⚡ AI 省流·分级系统提示（默认关）','开启后，过回合的各专项子推演（财政/军事/势力/诏令/认知/快照）只携带各自任务所需的系统提示段落，而非整份剧本大提示——一回合可省大量输入 token（省钱且提速），主推演与对话不受影响。若开启后出现人名地名错乱等异常，请关闭并反馈。']
      ];
      var _mh = '<div class="settings-section"><h4>玩法机制·深化（实验·默认关）</h4>' +
        '<div style="font-size:0.7rem;color:var(--txt-d);margin:0 0 0.2rem;line-height:1.5;">确定性玩法深化，不依赖 AI；默认关以保持零回归，逐项 opt-in。</div>';
      for (var _mi = 0; _mi < _mechs.length; _mi++) {
        var _m = _mechs[_mi];
        var _mon = !!(P && P.conf && P.conf[_m[0]]);
        _mh += '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;border-top:1px dotted var(--bdr);">' +
          '<input type="checkbox" ' + (_mon?'checked ':'') + 'onchange="_togglePConf(\'' + _m[0] + '\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
          '<div style="flex:1;"><div style="font-size:0.82rem;color:var(--gold);font-weight:600;">' + _m[1] + '</div>' +
          '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">' + _m[2] + '</div></div>' +
        '</label>';
      }
      // sc2Pipeline 是 P.ai 字符串非 P.conf 布尔·单独渲染于同栏(2026-07-02 人话化·此前仅「AI 管线开关(高级)」里的 jargon 复选框"sc2 3stage"·玩家不可能知道是什么)
      var _m3s = !!(P && P.ai && P.ai.sc2Pipeline === '3stage');
      _mh += '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;border-top:1px dotted var(--bdr);">' +
        '<input type="checkbox" ' + (_m3s?'checked ':'') + 'onchange="if(!P.ai)P.ai={};P.ai.sc2Pipeline=this.checked?\'3stage\':null;saveP();" style="margin-top:0.15rem;flex-shrink:0;">' +
        '<div style="flex:1;"><div style="font-size:0.82rem;color:var(--gold);font-weight:600;">📜 史记·三段成文（默认关）</div>' +
        '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">开启后，每回合史记正文改为三步产出：先铺场景大纲、再审时代错乱与人名（含亡者复活确定性拦截）、最后按大纲成文——正文更有章法、时代感更稳，代价是叙事一步变三步（多两次小额 AI 调用）。关闭则单步成文（默认）。</div></div>' +
      '</label>';
      _mh += '</div>';
      return _mh;
    })()+

    "<div class=\"settings-section\"><h4>更新与工坊</h4>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin-bottom:0.5rem;line-height:1.55;\">桌面版可检查本体更新、导入创意工坊包、启停工坊剧本。在线更新只接受高于当前版本的安装包。</div>"+
    "<button class=\"bt bp bsm\" onclick=\"window.openContentManager&&window.openContentManager()\">打开内容管理</button>"+
    "</div>"+

    _renderSettingsAudioSection()+
    _renderSettingsThemeFontSection()+

    // 回合读取
    "<div class=\"settings-section\"><h4>\u56DE\u5408\u8BFB\u53D6</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u8D77\u5C45\u6CE8\u8BFB\u53D6</label><input type=\"number\" id=\"s-qlb\" value=\""+(P.conf.qijuLookback||5)+"\"></div><div class=\"fd\"><label>\u53F2\u8BB0\u8BFB\u53D6</label><input type=\"number\" id=\"s-slb\" value=\""+(P.conf.shijiLookback||5)+"\"></div><div class=\"fd\"><label>\u6BCF N \u56DE\u5408\u5B58\u6863</label><input type=\"number\" id=\"s-as-turns\" value=\""+(P.conf.autoSaveTurns||5)+"\" min=\"0\" style=\"width:60px\"></div></div>"+
    "<div class=\"fd full\"><label>\u603B\u7ED3\u89C4\u5219(\u7559\u7A7A=AI\u81EA\u52A8)</label><textarea id=\"s-sumrule\" rows=\"2\">"+(P.conf.summaryRule||"")+"</textarea></div></div>"+

    // AI 记忆容量
    "<div class=\"settings-section\"><h4>AI\u8BB0\u5FC6\u5BB9\u91CF</h4>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin-bottom:0.4rem;\">\u8D85\u8FC7\u8BBE\u5B9A\u56DE\u5408\u6570\u7684\u8BB0\u5FC6\u5C06\u81EA\u52A8\u538B\u7F29\u4E3A\u5E74\u4EE3\u6458\u8981</div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u8BB0\u5FC6\u951A\u70B9</label><input type=\"number\" id=\"s-mem-anchor\" value=\""+(P.conf.memoryAnchorKeep||40)+"\" min=\"10\" max=\"200\"></div>"+
    "<div class=\"fd q\"><label>\u5E74\u4EE3\u5F52\u6863</label><input type=\"number\" id=\"s-mem-archive\" value=\""+(P.conf.memoryArchiveKeep||20)+"\" min=\"5\" max=\"100\"></div>"+
    "<div class=\"fd q\"><label>\u89D2\u8272\u5F27\u7EBF</label><input type=\"number\" id=\"s-mem-arc\" value=\""+(P.conf.characterArcKeep||10)+"\" min=\"3\" max=\"50\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u51B3\u7B56\u8BB0\u5F55</label><input type=\"number\" id=\"s-mem-dec\" value=\""+(P.conf.playerDecisionKeep||30)+"\" min=\"5\" max=\"100\"></div>"+
    "<div class=\"fd q\"><label>\u53D9\u4E8B\u8BB0\u5FC6</label><input type=\"number\" id=\"s-mem-chr\" value=\""+(P.conf.chronicleKeep||10)+"\" min=\"3\" max=\"50\"></div>"+
    "<div class=\"fd q\"><label>\u5BF9\u8BDD\u5386\u53F2</label><input type=\"number\" id=\"s-mem-conv\" value=\""+(P.conf.convKeep||40)+"\" min=\"10\" max=\"200\"></div></div></div>"+

    // AI生成字数
    "<div class=\"settings-section\"><h4>AI\u751F\u6210\u5B57\u6570</h4>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin-bottom:0.5rem;\">\u63A7\u5236\u5404\u7C7B\u5185\u5BB9\u7684\u751F\u6210\u5B57\u6570\uFF0C\u4F1A\u4E0E\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\u8054\u52A8\u7F29\u653E</div>"+
    "<div style=\"display:flex;gap:0.5rem;margin-bottom:0.6rem;flex-wrap:wrap;\">"+
    "<label class=\"wd-preset-label\"><input type=\"radio\" name=\"s-verbosity\" value=\"concise\" "+(P.conf.verbosity==='concise'?'checked':'')+"> \u7CBE\u7B80<span style=\"font-size:0.7rem;color:var(--txt-d);display:block;\">\u00D70.6 \u7701token</span></label>"+
    "<label class=\"wd-preset-label\"><input type=\"radio\" name=\"s-verbosity\" value=\"standard\" "+((P.conf.verbosity||'standard')==='standard'?'checked':'')+"> \u6807\u51C6<span style=\"font-size:0.7rem;color:var(--txt-d);display:block;\">\u00D71.0 \u63A8\u8350</span></label>"+
    "<label class=\"wd-preset-label\"><input type=\"radio\" name=\"s-verbosity\" value=\"detailed\" "+(P.conf.verbosity==='detailed'?'checked':'')+"> \u8BE6\u5C3D<span style=\"font-size:0.7rem;color:var(--txt-d);display:block;\">\u00D71.5 \u6C89\u6D78</span></label>"+
    "<label class=\"wd-preset-label\"><input type=\"radio\" name=\"s-verbosity\" value=\"custom\" "+(P.conf.verbosity==='custom'?'checked':'')+"> \u81EA\u5B9A\u4E49<span style=\"font-size:0.7rem;color:var(--txt-d);display:block;\">\u624B\u52A8\u8C03</span></label>"+
    "</div>"+
    "<div id=\"s-verb-preview\" style=\"background:var(--bg-3);border-radius:6px;padding:0.5rem 0.7rem;font-size:0.78rem;\"></div>"+
    // AI输出上限控件——默认使用检测值，玩家可手动调低
    "<div style=\"margin-top:0.8rem;padding:0.5rem 0.7rem;background:var(--bg-3);border-radius:6px;\">"+
    "<div style=\"display:flex;align-items:center;justify-content:space-between;gap:0.5rem;\">"+
    "<label style=\"font-size:0.8rem;color:var(--gold);\">AI\u8F93\u51FA\u4E0A\u9650(max_tokens)</label>"+
    "<div id=\"s-maxout-info\" style=\"font-size:0.7rem;color:var(--txt-d);\"></div>"+
    "</div>"+
    "<div style=\"display:flex;gap:10px;align-items:center;margin-top:0.4rem;font-size:0.76rem;\">"+
    "<label><input type=\"radio\" name=\"s-maxout-mode\" value=\"auto\" "+(!P.conf.maxOutputTokens?'checked':'')+" onchange=\"_sMaxoutToggle()\"> \u81EA\u52A8(\u6A21\u578B\u6700\u5927)</label>"+
    "<label><input type=\"radio\" name=\"s-maxout-mode\" value=\"manual\" "+(P.conf.maxOutputTokens?'checked':'')+" onchange=\"_sMaxoutToggle()\"> \u624B\u52A8</label>"+
    "<input type=\"number\" id=\"s-maxout-val\" value=\""+(P.conf.maxOutputTokens||'')+"\" placeholder=\"tokens\" style=\"width:90px;\" "+(!P.conf.maxOutputTokens?'disabled':'')+">"+
    "</div>"+
    "<div style=\"font-size:0.71rem;color:var(--txt-d);margin-top:0.3rem;line-height:1.4;\">\u81EA\u52A8=\u4F7F\u7528\u68C0\u6D4B\u5230\u7684\u6A21\u578B\u6700\u5927\u8F93\u51FA\u80FD\u529B\u3002\u624B\u52A8\u53EF\u8C03\u4F4E\u8282\u7701\u6210\u672C\u6216\u907F\u514D\u8D85\u65F6\u3002\u82E5AI\u8F93\u51FA\u88AB\u622A\u65AD\uFF0C\u53EF\u5728\u6B64\u8C03\u5927\u3002</div>"+
    "</div>"+
    "<div id=\"s-verb-custom\" style=\"display:none;margin-top:0.5rem;\">"+
    "<div style=\"font-size:0.72rem;color:var(--gold);margin-bottom:0.3rem;\">\u5206\u7C7B\u5FAE\u8C03\uFF08\u4EC5\u201C\u81EA\u5B9A\u4E49\u201D\u6A21\u5F0F\u751F\u6548\uFF09</div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u5B9E\u5F55</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-shilu1\" value=\""+(P.conf.shiluMin||200)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-shilu2\" value=\""+(P.conf.shiluMax||400)+"\" style=\"width:50px;\"></div></div>"+
    "<div class=\"fd q\"><label>\u65F6\u653F\u8BB0</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-szj1\" value=\""+(P.conf.szjMin||600)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-szj2\" value=\""+(P.conf.szjMax||1200)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u540E\u4EBA\u620F\u8BF4</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-houren1\" value=\""+(P.conf.hourenMin||2500)+"\" style=\"width:60px;\">~<input type=\"number\" id=\"s-houren2\" value=\""+(P.conf.hourenMax||6000)+"\" style=\"width:60px;\"></div></div>"+
    "<div class=\"fd q\"><label>\u594F\u758F(\u8C0F\u7AE0)</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-ml1\" value=\""+(P.conf.memLoyalMin||400)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-ml2\" value=\""+(P.conf.memLoyalMax||600)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"fd q\"><label>\u594F\u758F(\u666E\u901A)</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-mn1\" value=\""+(P.conf.memNormalMin||200)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-mn2\" value=\""+(P.conf.memNormalMax||350)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u594F\u758F(\u5BC6\u6298)</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-ms1\" value=\""+(P.conf.memSecretMin||150)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-ms2\" value=\""+(P.conf.memSecretMax||250)+"\" style=\"width:50px;\"></div></div>"+
    "<div class=\"fd q\"><label>\u95EE\u5BF9\u56DE\u590D</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-wd1\" value=\""+(P.conf.wdMin||120)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-wd2\" value=\""+(P.conf.wdMax||250)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u671D\u8BAE\u53D1\u8A00</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-cy1\" value=\""+(P.conf.cyMin||120)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-cy2\" value=\""+(P.conf.cyMax||250)+"\" style=\"width:50px;\"></div></div>"+
    "<div class=\"fd q\"><label>\u7F16\u5E74\u53F2\u8BB0</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-chr1\" value=\""+(P.conf.chronicleMin||800)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-chr2\" value=\""+(P.conf.chronicleMax||1500)+"\" style=\"width:50px;\"></div></div></div>"+
    "<div class=\"rw\"><div class=\"fd q\"><label>\u592A\u53F2\u516C\u66F0</label><div style=\"display:flex;gap:2px;\"><input type=\"number\" id=\"s-cmt1\" value=\""+(P.conf.commentMin||80)+"\" style=\"width:50px;\">~<input type=\"number\" id=\"s-cmt2\" value=\""+(P.conf.commentMax||200)+"\" style=\"width:50px;\"></div></div></div>"+
    "</div></div>"+

    // P18.1: Token 预算 + 模型档位（修复 dead player-settings 的 G4/G5·代码在读 UI 缺失）
    "<div class=\"settings-section\" style=\"border-left:3px solid var(--gold-d,#c0a060);background:rgba(192,160,96,0.04);\"><h4 style=\"color:var(--gold-l,#d4b878);\">高级·预算与档位</h4>"+
    "<div style=\"font-size:0.7rem;color:var(--txt-d);margin:-0.3rem 0 0.5rem;line-height:1.55;\">控制 token 总预算与模型能力档位·这些字段已被运行时代码读取·之前 UI 丢失·本升级补齐。</div>"+
    "<div class=\"rw\" style=\"align-items:center;\">"+
    "<div class=\"fd\"><label>每回合 Token 预算</label>"+
    "<div style=\"display:flex;gap:0.4rem;align-items:center;\">"+
    "<input type=\"number\" id=\"s-turn-budget\" min=\"0\" step=\"5000\" value=\""+(P.conf.turnTokenBudget||0)+"\" placeholder=\"0=无上限\" style=\"width:140px;\">"+
    "<span style=\"font-size:0.7rem;color:var(--txt-d);\">超支 toast 预警·不阻断游戏</span>"+
    "</div></div>"+
    "</div>"+
    "<div class=\"rw\" style=\"margin-top:0.4rem;\">"+
    "<div class=\"fd\"><label>模型档位</label>"+
    "<select id=\"s-model-tier\" style=\"width:220px;\">"+
    "<option value=\"auto\""+((P.conf.modelTier||'auto')==='auto'?' selected':'')+">自动（按模型能力探测）</option>"+
    "<option value=\"high\""+((P.conf.modelTier||'auto')==='high'?' selected':'')+">高级（gpt-4o/claude-opus/sonnet 4.x）</option>"+
    "<option value=\"medium\""+((P.conf.modelTier||'auto')==='medium'?' selected':'')+">中级（gpt-4o-mini/haiku）</option>"+
    "<option value=\"low\""+((P.conf.modelTier||'auto')==='low'?' selected':'')+">初级（小型开源·裁 schema）</option>"+
    "</select>"+
    "<span style=\"font-size:0.71rem;color:var(--txt-d);margin-left:0.5rem;\">手动覆写 schema 裁剪策略</span>"+
    "</div></div>"+
    "<div class=\"rw\" style=\"margin-top:0.4rem;\">"+
    "<div class=\"fd q\"><label>上下文覆写 K</label><input type=\"number\" id=\"s-ctx-override\" min=\"0\" value=\""+(P.conf.contextSizeK||0)+"\" placeholder=\"0=自动\" style=\"width:90px;\"></div>"+
    "<div class=\"fd q\"><label>max_tokens 覆写</label><input type=\"number\" id=\"s-out-override\" min=\"0\" value=\""+(P.conf.maxOutputTokens||0)+"\" placeholder=\"0=自动\" style=\"width:110px;\"></div>"+
    "</div>"+
    "<div style=\"font-size:0.71rem;color:var(--txt-d);margin-top:0.3rem;line-height:1.5;\">均留空或 0 = 走自动探测。下方【保存所有设置】按钮一并生效。</div>"+
    "</div>"+

    "<div class=\"settings-section\"><h4>\u6A21\u578B\u80FD\u529B\u6821\u9A8C</h4>"+
    "<div id=\"s-model-probe-body\">" + _renderModelProbePanel('primary') + '<div style="margin-top:0.4rem;"></div>' + _renderModelProbePanel('secondary') + "</div>"+
    "<div style=\"margin-top:0.6rem;padding:0.4rem;background:rgba(184,154,83,0.04);border-radius:3px;\">"+
    "<div style=\"font-size:0.7rem;color:var(--gold-d);margin-bottom:0.3rem;\">\u4E3B API \u64CD\u4F5C</div>"+
    "<div style=\"display:flex;gap:0.3rem;flex-wrap:wrap;\">"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunContext('primary')\">\u4E0A\u4E0B\u6587</button>"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunOutput('primary')\">\u8F93\u51FA\u5B9E\u6D4B</button>"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunSelfReport('primary')\">\u6A21\u578B\u81EA\u62A5</button>"+
    "<button class=\"bt bs bsm\" onclick=\"_showAvailableModels('primary')\">\u5217\u51FA\u53EF\u7528\u6A21\u578B</button>"+
    "</div></div>"+
    "<div style=\"margin-top:0.4rem;padding:0.4rem;background:rgba(74,111,165,0.04);border-radius:3px;\">"+
    "<div style=\"font-size:0.7rem;color:var(--purple,var(--indigo-400,#4a6fa5));margin-bottom:0.3rem;\">\u6B21 API \u64CD\u4F5C\uFF08\u672A\u914D\u5219\u6309\u94AE\u63D0\u9192\uFF09</div>"+
    "<div style=\"display:flex;gap:0.3rem;flex-wrap:wrap;\">"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunContext('secondary')\">\u4E0A\u4E0B\u6587</button>"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunOutput('secondary')\">\u8F93\u51FA\u5B9E\u6D4B</button>"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunSelfReport('secondary')\">\u6A21\u578B\u81EA\u62A5</button>"+
    "<button class=\"bt bs bsm\" onclick=\"_showAvailableModels('secondary')\">\u5217\u51FA\u53EF\u7528\u6A21\u578B</button>"+
    "</div></div>"+
    "<div style=\"margin-top:0.4rem;\"><button class=\"bt bs bsm\" onclick=\"_probeClearCache()\">\u6E05\u9664\u63A2\u6D4B\u7F13\u5B58</button></div>"+
    "</div>"+

    // 文风
    "<div class=\"settings-section\"><h4>\u6587\u98CE</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u5168\u5C40</label><select id=\"s-style\"><option value=\"\u6587\u5B66\u5316\" "+((P.conf.style||"")=="\u6587\u5B66\u5316"?"selected":"")+">\u6587\u5B66\u5316</option><option value=\"\u53F2\u4E66\u4F53\" "+((P.conf.style||"")=="\u53F2\u4E66\u4F53"?"selected":"")+">\u53F2\u4E66\u4F53</option><option value=\"\u622F\u5267\u5316\" "+((P.conf.style||"")=="\u622F\u5267\u5316"?"selected":"")+">\u622F\u5267\u5316</option><option value=\"\u7AE0\u56DE\u4F53\" "+((P.conf.style||"")=="\u7AE0\u56DE\u4F53"?"selected":"")+">\u7AE0\u56DE\u4F53</option><option value=\"\u7EAA\u4F20\u4F53\" "+((P.conf.style||"")=="\u7EAA\u4F20\u4F53"?"selected":"")+">\u7EAA\u4F20\u4F53</option><option value=\"\u767D\u8BDD\u6587\" "+((P.conf.style||"")=="\u767D\u8BDD\u6587"?"selected":"")+">\u767D\u8BDD\u6587</option></select></div><div class=\"fd\"><label>\u96BE\u5EA6</label><select id=\"s-diff\"><option value=\"narrative\" "+(/^(narrative|\u7B80\u5355|\u53D9\u4E8B)$/.test(P.conf.difficulty||"")?"selected":"")+">\u53D9\u4E8B\u00B7\u6E29\u548C</option><option value=\"standard\" "+(!/^(narrative|\u7B80\u5355|\u53D9\u4E8B|hardcore|\u56F0\u96BE|\u5730\u72F1|\u786C\u6838)$/.test(P.conf.difficulty||"")?"selected":"")+">\u6807\u51C6</option><option value=\"hardcore\" "+(/^(hardcore|\u56F0\u96BE|\u5730\u72F1|\u786C\u6838)$/.test(P.conf.difficulty||"")?"selected":"")+">\u786C\u6838</option></select></div></div>"+
    "<div class=\"fd full\"><label>\u81EA\u5B9A\u4E49\u6587\u98CE</label><textarea id=\"s-cstyle\" rows=\"2\">"+(P.conf.customStyle||"")+"</textarea></div></div>"+

    // 模式+AI深度
    "<div class=\"settings-section\"><h4>\u6E38\u620F\u6A21\u5F0F</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u6A21\u5F0F</label><select id=\"s-mode\"><option value=\"yanyi\" "+(P.conf.gameMode==="yanyi"?"selected":"")+">\u6F14\u4E49</option><option value=\"light_hist\" "+(P.conf.gameMode==="light_hist"?"selected":"")+">\u8F7B\u5EA6\u53F2\u5B9E</option><option value=\"strict_hist\" "+(P.conf.gameMode==="strict_hist"?"selected":"")+">\u4E25\u683C\u53F2\u5B9E</option></select></div>"+
    // Phase 7.5 D2\u00B7\u4E09\u6863\u91CD\u5B9A\u4E49 (doc \u5B57\u9762)\u00B7\u5168 18 (\u542B sc1q + sc2/sc27 3stage 3 \u6BB5) / \u5FEB 14 (Phase 4 \u5408\u5E76\u00B7\u8DF3 sc_consolidate) / \u8DF3 10 (\u8DF3 sc16/17/18/sc_audit)
    "<div class=\"fd\"><label>AI\u63A8\u6F14\u6DF1\u5EA6</label><select id=\"s-aidepth\"><option value=\"full\" "+((P.conf.aiCallDepth||'full')==='full'?'selected':'')+">\u5B8C\u6574\u00B7\u5168 (18 \u8C03\u7528\u00B7\u542B sc1q + 3stage)</option><option value=\"standard\" "+((P.conf.aiCallDepth||'full')==='standard'?'selected':'')+">\u6807\u51C6\u00B7\u5FEB (14 \u8C03\u7528\u00B7Phase 4 \u5408\u5E76\u540E)</option><option value=\"lite\" "+((P.conf.aiCallDepth||'full')==='lite'?'selected':'')+">\u7CBE\u7B80\u00B7\u8DF3 (10 \u8C03\u7528\u00B7\u8DF3 sc16/17/18/sc_audit)</option></select></div>"+
    // Phase 7\u00B7"AI \u6210\u672C\u9762\u677F"\u6309\u94AE (4 \u533A) + "\u5BFC\u51FA AI \u65E5\u5FD7" \u6309\u94AE
    "<div class=\"fd\"><label>AI \u8BCA\u65AD</label><div style=\"display:flex;gap:0.4rem;\">"+
    "<button class=\"bt bs bsm\" onclick=\"if(window.TM&&TM.ai&&TM.ai.showCostPanel){TM.ai.showCostPanel();}else if(typeof showAICostPanel==='function'){showAICostPanel();}else{toast('\u6210\u672C\u9762\u677F\u672A\u52A0\u8F7D');}\">\uD83D\uDCCA AI \u6210\u672C\u9762\u677F</button>"+
    "<button class=\"bt bs bsm\" onclick=\"if(window.TM&&TM.ai&&TM.ai.exportDiagnostics){TM.ai.exportDiagnostics();}else if(typeof exportAIDiagnosticsJSON==='function'){exportAIDiagnosticsJSON();}else{toast('\u8BCA\u65AD API \u672A\u52A0\u8F7D');}\">\u2193 \u5BFC\u51FA\u65E5\u5FD7</button>"+
    ((typeof _renderMemoryDiagnosticsButton === 'function') ? _renderMemoryDiagnosticsButton() : "<button class=\"bt bs bsm\" onclick=\"if(window.TM&&TM.ai&&TM.ai.openMemoryDiagnostics){TM.ai.openMemoryDiagnostics();}else if(typeof openMemoryDiagnostics==='function'){openMemoryDiagnostics();}else{toast('\u8BB0\u5FC6\u8BCA\u65AD\u672A\u52A0\u8F7D');}\">\u8BB0\u5FC6\u8BCA\u65AD</button>")+
    "</div></div>"+
    // Phase 7.5 A\u00B79 \u4E2A\u65B0 P.ai opt-in toggle \u66B4\u9732\u00B7user \u53EF\u52FE\u9009\u5207\u6362
    "<div class=\"fd\" style=\"flex-direction:column;align-items:flex-start;gap:0.3rem;\"><label>AI \u7BA1\u7EBF\u5F00\u5173 (\u9AD8\u7EA7)</label>"+
    "<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:0.25rem;font-size:0.78rem;width:100%;\">"+
    "<label><input type=\"checkbox\" "+(P.ai && P.ai.stream_sc1===true?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.stream_sc1=this.checked;saveP();\"> SC1 stream</label>"+
    "<label><input type=\"checkbox\" "+(P.ai && P.ai.openaiStrict===true?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.openaiStrict=this.checked;P.conf.strictSchemaEnabled=this.checked;saveP();\"> OpenAI strict</label>"+
    "<label><input type=\"checkbox\" "+(!(P.ai && P.ai.sc1OwnedBySc1b===false)?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc1OwnedBySc1b=this.checked;saveP();\"> SC1 \u8BA9 sc1b</label>"+
    "<label><input type=\"checkbox\" "+(!(P.ai && P.ai.sc1OwnedBySc1c===false)?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc1OwnedBySc1c=this.checked;saveP();\"> SC1 \u8BA9 sc1c</label>"+
    "<label><input type=\"checkbox\" "+(!(P.ai && P.ai.sc17Skip===false)?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc17Skip=this.checked;saveP();\"> SC17 \u8DF3</label>"+
    "<label><input type=\"checkbox\" "+(P.ai && P.ai.sc16Lite===true?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc16Lite=this.checked;saveP();\"> SC16 lite</label>"+
    "<label><input type=\"checkbox\" "+(P.ai && P.ai.sc18Lite===true?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc18Lite=this.checked;saveP();\"> SC18 lite</label>"+
    "<label><input type=\"checkbox\" "+(!(P.ai && P.ai.sc25cEnabled===false)?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc25cEnabled=this.checked;saveP();\"> sc25c \u53CC\u8C03\u7528</label>"+
    "<label><input type=\"checkbox\" "+(P.ai && P.ai.sc15nEnabled===true?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc15nEnabled=this.checked;saveP();\"> sc15n 3-tier</label>"+
    "<label><input type=\"checkbox\" "+(P.ai && P.ai.sc2Pipeline==='3stage'?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc2Pipeline=this.checked?'3stage':null;saveP();\"> sc2 3stage</label>"+
    "<label><input type=\"checkbox\" "+(P.ai && P.ai.narrativeReviewEnabled===true?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.narrativeReviewEnabled=this.checked;saveP();\"> sc27 叙事审查</label>"+
    "<label><input type=\"checkbox\" "+(P.ai && P.ai.sc28Enabled===true?'checked':'')+" onchange=\"if(!P.ai)P.ai={};P.ai.sc28Enabled=this.checked;saveP();\"> sc28 世界快照</label>"+
    "</div>"+
    "<span style=\"font-size:0.7rem;color:var(--ink-300,#888);\">\u6CE8\u00B7\u6539\u540E\u6E05 sysP cache\u00B7\u9996\u56DE\u5408\u591A\u82B1 ~$0.004 (Phase 7.5 D)</span>"+
    "</div></div></div>"+

    // ⚠️ P.conf.showRelation 当前是僵尸字段——UI 写但无消费者读·将来或补 renderCharProfile 端读取或删此 UI
    // 人物志
    "<div class=\"settings-section\"><h4>\u4EBA\u7269\u5FD7</h4>"+
    // Phase 7.5 D1\u00B7showRelation zombie toggle \u5DF2\u5220 (UI \u5199\u65E0\u6D88\u8D39\u8005\u8BFB\u00B7\u89C1 doc \u00A76.6)
    ""+

    // 提示词
    "<div class=\"settings-section\"><h4>AI\u63D0\u793A\u8BCD</h4>"+
    "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.3rem;\"><button class=\"bt bs bsm\" onclick=\"_$('s-prompt').value=DEFAULT_PROMPT;\">\u6062\u590D\u9ED8\u8BA4</button></div>"+
    "<textarea id=\"s-prompt\" rows=\"10\" style=\"font-family:monospace;font-size:0.8rem;width:100%;\">"+(P.ai.prompt||DEFAULT_PROMPT)+"</textarea>"+
    "<div class=\"fd full\" style=\"margin-top:0.5rem;\"><label>\u89C4\u5219</label><textarea id=\"s-rules\" rows=\"4\">"+(P.ai.rules||DEFAULT_RULES)+"</textarea></div></div>"+

    "<button class=\"bt bp\" onclick=\"sSaveAll()\" style=\"width:100%;padding:0.7rem;font-size:1rem;\">\u4FDD\u5B58\u6240\u6709\u8BBE\u7F6E</button>";

  _settingsBuildTabs();
  setTimeout(function(){
    var p=_$("s-prov");if(p&&P.ai.provider)p.value=P.ai.provider;
    // 次 API 服务商下拉·按已保存值回显
    var sp=_$("s-sec-prov"); var _secCfg=(P.ai&&P.ai.secondary)||{};
    if(sp&&_secCfg.provider)sp.value=_secCfg.provider;
    // 字数档位交互初始化
    _sVerbUpdatePreview();
    document.querySelectorAll('input[name="s-verbosity"]').forEach(function(r){
      r.addEventListener('change', _sVerbUpdatePreview);
    });
    // 显示当前上下文检测信息
    _sShowCtxInfo();
    try { _settingsMediaThemeInit(); } catch(_){}
  },100);
  bg.classList.add("show");
};

/** 显示当前上下文窗口检测信息 */
function _sShowCtxInfo() {
  var el = _$('s-ctx-info'); if (!el) return;
  var model = P.ai.model || '(未设置)';
  var k = getModelContextSizeK();
  var layer = P.conf._ctxDetectLayer || '未探测';
  var manual = (P.conf.contextSizeK && P.conf.contextSizeK > 0);
  var wl = _matchModelCtx(P.ai.model || '');
  var html = '<span style="color:var(--gold);">当前上下文窗口: <b>' + k + 'K</b></span>';
  html += ' · 模型: ' + model;
  html += ' · 来源: ' + (manual ? '手动设置' : layer);
  if (wl > 0 && !manual) html += ' · 白名单参考: ' + wl + 'K';
  // 最近探测日志
  if (typeof _ctxDetectLog !== 'undefined' && _ctxDetectLog.length > 0) {
    html += '<details style="margin-top:4px;"><summary style="cursor:pointer;color:var(--txt-d);">探测日志 (' + _ctxDetectLog.length + '条)</summary>';
    html += '<div style="max-height:120px;overflow-y:auto;font-size:0.71rem;padding:4px;background:var(--bg-3);border-radius:4px;margin-top:2px;">';
    _ctxDetectLog.forEach(function(e) { html += '<div>' + e.time + ' ' + e.msg + '</div>'; });
    html += '</div></details>';
  }
  el.innerHTML = html;
}

/** 重新探测上下文窗口 */
async function sReDetectCtx() {
  var st = _$('s-status');
  var key = _$('s-key') ? _$('s-key').value : P.ai.key;
  var url = _$('s-url') ? _$('s-url').value : P.ai.url;
  var model = _$('s-model') ? _$('s-model').value : P.ai.model;
  if (!key || !url || !model) { toast('请先填写API信息'); return; }

  // 临时应用设置
  var _orig = { key: P.ai.key, url: P.ai.url, model: P.ai.model };
  P.ai.key = key; P.ai.url = url; P.ai.model = model;

  if (st) st.innerHTML = '<span style="color:var(--gold);">正在探测上下文窗口...</span>';
  // 清缓存强制重新探测
  delete P.conf._detectedContextK; delete P.conf._ctxCacheKey; delete P.conf._ctxDetectLayer;

  try {
    var detK = await detectModelContextSize({
      force: true,
      onProgress: function(msg) { if (st) st.innerHTML = '<span style="color:var(--gold);">' + msg + '</span>'; }
    });
    if (st) st.innerHTML = '<span style="color:var(--green);">\u2705 探测完成: <b>' + detK + 'K</b> tokens (' + (P.conf._ctxDetectLayer || '') + ')</span>';
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C 探测失败: ' + (e.message || e) + '</span>';
  }

  // 恢复
  P.ai.key = _orig.key; P.ai.url = _orig.url; P.ai.model = _orig.model;
  _sShowCtxInfo();
  _sVerbUpdatePreview(); // 字数预览也会随上下文窗口变化
}

/**
 * 字数档位预览更新
 */
function _sVerbUpdatePreview() {
  var mode = 'standard';
  document.querySelectorAll('input[name="s-verbosity"]').forEach(function(r) { if (r.checked) mode = r.value; });
  var customPanel = _$('s-verb-custom');
  if (customPanel) customPanel.style.display = mode === 'custom' ? '' : 'none';

  var preview = _$('s-verb-preview'); if (!preview) return;
  // 临时切换verbosity计算预览
  var origV = P.conf.verbosity;
  P.conf.verbosity = mode;

  var cats = [
    ['shilu', '实录'], ['szj', '时政记'], ['houren', '后人戏说'],
    ['memLoyal', '奏疏(谏章)'], ['memNormal', '奏疏(普通)'], ['memSecret', '奏疏(密折)'],
    ['wd', '问对回复'], ['cy', '朝议发言'],
    ['chronicle', '编年史记'], ['comment', '太史公曰']
  ];
  var cp = (typeof getCompressionParams === 'function') ? getCompressionParams() : { scale: 1.0, contextK: 32 };
  var html = '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:var(--gold);">当前模型窗口: ' + cp.contextK + 'K</span>'
    + '<span>模型倍率: \u00D7' + Math.max(0.8, Math.min(cp.scale, 1.8)).toFixed(2) + '</span></div>';
  html += '<table style="width:100%;border-collapse:collapse;">';
  cats.forEach(function(c) {
    var r = _getCharRange(c[0]);
    html += '<tr><td style="padding:1px 4px;color:var(--txt-s);">' + c[1] + '</td>'
      + '<td style="padding:1px 4px;text-align:right;color:var(--txt);">' + r[0] + ' ~ ' + r[1] + ' 字</td></tr>';
  });
  html += '</table>';
  preview.innerHTML = html;
  P.conf.verbosity = origV; // 恢复
  // 同步更新输出上限信息
  _sUpdateMaxoutInfo();
}

/** 手动/自动切换输出上限输入框 */
function _sMaxoutToggle() {
  var mode = 'auto';
  document.querySelectorAll('input[name="s-maxout-mode"]').forEach(function(r) { if (r.checked) mode = r.value; });
  var inp = _$('s-maxout-val');
  if (inp) inp.disabled = (mode !== 'manual');
  _sUpdateMaxoutInfo();
}

/** 显示当前输出上限信息 */
function _sUpdateMaxoutInfo() {
  var info = _$('s-maxout-info'); if (!info) return;
  var detected = P.conf._detectedMaxOutput || 0;
  var manual = P.conf.maxOutputTokens || 0;
  var effective = manual > 0 ? manual : detected;
  if (effective > 0) {
    var k = (effective / 1024).toFixed(effective >= 10240 ? 0 : 1);
    info.innerHTML = '检测:<b>' + (detected?(detected/1024).toFixed(detected>=10240?0:1)+'K':'未知') + '</b> 生效:<b style="color:var(--gold);">' + k + 'K</b>';
  } else {
    info.innerHTML = '<span style="color:var(--txt-d);">未检测</span>';
  }
}

var DEFAULT_PROMPT="\u4F60\u662F\u5386\u53F2\u6A21\u62DF\u63A8\u6F14AI\u3002\u5267\u672C:{scenario_name} \u65F6\u4EE3:{era} \u89D2\u8272:{role}\n\u65F6\u95F4:{time_display} \u7B2C{turn}\u56DE\u5408\n\u96BE\u5EA6:{difficulty} \u6587\u98CE:{narrative_style}\n\u8D44\u6E90:{resources_json}\n\u5173\u7CFB:{relations_json}\n\u4EBA\u7269:{characters_json}\n\u89C4\u5219:{custom_rules}";
var DEFAULT_RULES="1.\u6570\u503C\u5408\u7406 2.\u89D2\u8272\u72EC\u7ACB 3.\u6218\u4E89\u6D88\u8017 4.\u5B63\u8282\u5F71\u54CD 5.\u5386\u53F2\u540D\u81E3\u7B26\u5408\u53F2\u5B9E";

function sSaveAPI(){
  P.ai.key=_$("s-key")?_$("s-key").value:"";P.ai.url=_$("s-url")?_$("s-url").value:"";P.ai.model=_$("s-model")?_$("s-model").value:"";P.ai.temp=parseFloat(_$("s-temp")?_$("s-temp").value:"0.8");P.ai.mem=parseInt(_$("s-mem")?_$("s-mem").value:"20");P.ai.provider=_$("s-prov")?_$("s-prov").value:"openai";
  try{ if(typeof tmApplyInsecureTlsConfig==='function') tmApplyInsecureTlsConfig(); }catch(_){}
  // ★2026-07-01·修「桌面端保存主 API key·关游戏再进就丢」:key 真源在 localStorage.tm_api(启动时 tm-player-core.js:257
  //   从此水合 P.ai)·桌面 autoSave 走 _tmStripAiKeyView 故意剥掉 key(不进可分享存档·安全)。原实现桌面分支只 autoSave、
  //   漏写 localStorage.tm_api → 主 key 只活内存·重启即失。改为两端都写 localStorage.tm_api(与 sSaveSecondaryAPI 同范式)·桌面再 autoSave。
  try{localStorage.setItem("tm_api",JSON.stringify(P.ai));}catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
  if(window.tianming&&window.tianming.isDesktop){window.tianming.autoSave(_tmStripAiKeyView(P)).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'catch] async:') : console.warn('[catch] async:', e); });}
  toast("\u2705 API\u5DF2\u4FDD\u5B58");
}
function sSaveAll(){
  sSaveAPI();
  // M3·次 API 字段同步保存（若面板上有填）
  if(_$("s-sec-key")||_$("s-sec-url")||_$("s-sec-model")){
    var _sk=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
    var _su=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
    var _sm=_$("s-sec-model")?_$("s-sec-model").value.trim():"";
    var _sp=_$("s-sec-prov")?_$("s-sec-prov").value:"openai";
    if(!P.ai)P.ai={};
    if(_sk||_su||_sm) P.ai.secondary={key:_sk,url:_su,model:_sm,provider:_sp};
    else if(P.ai) delete P.ai.secondary;
  }
  P.conf.qijuLookback=parseInt(_$("s-qlb")?_$("s-qlb").value:"5");P.conf.shijiLookback=parseInt(_$("s-slb")?_$("s-slb").value:"5");P.conf.summaryRule=_$("s-sumrule")?_$("s-sumrule").value:"";P.conf.autoSaveTurns=parseInt(_$("s-as-turns")?_$("s-as-turns").value:"5")||5;
  // AI 记忆容量设置
  P.conf.memoryAnchorKeep=parseInt(_$("s-mem-anchor")?_$("s-mem-anchor").value:"40")||40;
  P.conf.memoryArchiveKeep=parseInt(_$("s-mem-archive")?_$("s-mem-archive").value:"20")||20;
  P.conf.characterArcKeep=parseInt(_$("s-mem-arc")?_$("s-mem-arc").value:"10")||10;
  P.conf.playerDecisionKeep=parseInt(_$("s-mem-dec")?_$("s-mem-dec").value:"30")||30;
  P.conf.chronicleKeep=parseInt(_$("s-mem-chr")?_$("s-mem-chr").value:"10")||10;
  P.conf.convKeep=parseInt(_$("s-mem-conv")?_$("s-mem-conv").value:"40")||40;
  P.conf.contextSizeK=parseInt(_$("s-ctx")?_$("s-ctx").value:"0")||0;
  // AI生成字数档位
  var _vRadios = document.querySelectorAll('input[name="s-verbosity"]');
  _vRadios.forEach(function(r) { if (r.checked) P.conf.verbosity = r.value; });
  // AI输出上限
  var _moMode = 'auto';
  document.querySelectorAll('input[name="s-maxout-mode"]').forEach(function(r) { if (r.checked) _moMode = r.value; });
  if (_moMode === 'manual') {
    var _moVal = parseInt(_$("s-maxout-val")?_$("s-maxout-val").value:"0")||0;
    P.conf.maxOutputTokens = _moVal > 0 ? _moVal : 0;
  } else {
    P.conf.maxOutputTokens = 0; // 0=自动
  }
  // P18.1: turnTokenBudget + modelTier + 双覆写字段
  if (_$("s-turn-budget")) P.conf.turnTokenBudget = parseInt(_$("s-turn-budget").value) || 0;
  if (_$("s-model-tier")) P.conf.modelTier = _$("s-model-tier").value || 'auto';
  if (_$("s-ctx-override")) {
    var _ctxV = parseInt(_$("s-ctx-override").value) || 0;
    if (_ctxV > 0) P.conf.contextSizeK = _ctxV;
  }
  if (_$("s-out-override")) {
    var _outV = parseInt(_$("s-out-override").value) || 0;
    if (_outV > 0 && _moMode === 'auto') P.conf.maxOutputTokens = _outV; // 仅 auto 模式时被覆写
  }
  // 自定义字数（仅custom模式读取，但始终保存以便切换回来）
  P.conf.shiluMin=parseInt(_$("s-shilu1")?_$("s-shilu1").value:"200")||200;P.conf.shiluMax=parseInt(_$("s-shilu2")?_$("s-shilu2").value:"400")||400;
  P.conf.szjMin=parseInt(_$("s-szj1")?_$("s-szj1").value:"600")||600;P.conf.szjMax=parseInt(_$("s-szj2")?_$("s-szj2").value:"1200")||1200;
  P.conf.hourenMin=parseInt(_$("s-houren1")?_$("s-houren1").value:"2500")||2500;P.conf.hourenMax=parseInt(_$("s-houren2")?_$("s-houren2").value:"6000")||6000;
  P.conf.memLoyalMin=parseInt(_$("s-ml1")?_$("s-ml1").value:"400")||400;P.conf.memLoyalMax=parseInt(_$("s-ml2")?_$("s-ml2").value:"600")||600;
  P.conf.memNormalMin=parseInt(_$("s-mn1")?_$("s-mn1").value:"200")||200;P.conf.memNormalMax=parseInt(_$("s-mn2")?_$("s-mn2").value:"350")||350;
  P.conf.memSecretMin=parseInt(_$("s-ms1")?_$("s-ms1").value:"150")||150;P.conf.memSecretMax=parseInt(_$("s-ms2")?_$("s-ms2").value:"250")||250;
  P.conf.wdMin=parseInt(_$("s-wd1")?_$("s-wd1").value:"120")||120;P.conf.wdMax=parseInt(_$("s-wd2")?_$("s-wd2").value:"250")||250;
  P.conf.cyMin=parseInt(_$("s-cy1")?_$("s-cy1").value:"120")||120;P.conf.cyMax=parseInt(_$("s-cy2")?_$("s-cy2").value:"250")||250;
  P.conf.chronicleMin=parseInt(_$("s-chr1")?_$("s-chr1").value:"800")||800;P.conf.chronicleMax=parseInt(_$("s-chr2")?_$("s-chr2").value:"1500")||1500;
  P.conf.commentMin=parseInt(_$("s-cmt1")?_$("s-cmt1").value:"80")||80;P.conf.commentMax=parseInt(_$("s-cmt2")?_$("s-cmt2").value:"200")||200;
  P.conf.style=_$("s-style")?_$("s-style").value:"";P.conf.difficulty=_$("s-diff")?_$("s-diff").value:"";
  P.conf.customStyle=_$("s-cstyle")?_$("s-cstyle").value:"";P.conf.gameMode=_$("s-mode")?_$("s-mode").value:"yanyi";P.conf.aiCallDepth=_$("s-aidepth")?_$("s-aidepth").value:"full";
  P.ai.prompt=_$("s-prompt")?_$("s-prompt").value:"";P.ai.rules=_$("s-rules")?_$("s-rules").value:"";
  saveP(); // 持久化所有设置（含记忆容量配置）
  toast("\u2705 \u5168\u90E8\u5DF2\u4FDD\u5B58");
}

async function sDetectModels(){
  var key=_$("s-key")?_$("s-key").value:"";var baseUrl=_$("s-url")?_$("s-url").value:"";
  if(!key||!baseUrl){toast("\u586B\u5199Key\u548C\u5730\u5740");return;}
  var st=_$("s-status");if(st)st.textContent="\u68C0\u6D4B\u4E2D...";
  var modelsUrl=baseUrl.replace(/\/+$/,"");
  if(modelsUrl.indexOf("/chat/completions")>=0)modelsUrl=modelsUrl.replace("/chat/completions","/models");
  else{var vm=modelsUrl.match(/(.*\/v\d+)/);modelsUrl=vm?vm[1]+"/models":modelsUrl+"/models";}
  try{
    var resp=await fetch(modelsUrl,{method:"GET",headers:{"Authorization":"Bearer "+key}});
    if(!resp.ok){_$("s-models").style.display="flex";_$("s-models").innerHTML="<span class=\"model-chip\" onclick=\"sPickModel('gpt-4o',this)\">gpt-4o</span><span class=\"model-chip\" onclick=\"sPickModel('deepseek-chat',this)\">deepseek-chat</span><span class=\"model-chip\" onclick=\"sPickModel('claude-3-5-sonnet-20241022',this)\">claude-3-5-sonnet</span>";if(st)st.textContent="\u63A5\u53E3\u4E0D\u53EF\u7528\uFF0C\u5DF2\u663E\u793A\u5E38\u7528";return;}
    var data=await resp.json();var models=[];
    if(data.data&&Array.isArray(data.data))models=data.data.map(function(m){return m.id||"";}).filter(Boolean).sort();
    if(models.length>0){_$("s-models").style.display="flex";var cur=_$("s-model")?_$("s-model").value:"";_$("s-models").innerHTML=models.map(function(m){return "<span class=\"model-chip"+(m===cur?" active":"")+"\" onclick=\"sPickModel('"+m+"',this)\">"+m+"</span>";}).join("");if(st)st.innerHTML="<span style=\"color:var(--green);\">\u2705 "+models.length+"\u6A21\u578B</span>";}
  }catch(err){if(st)st.textContent="\u5931\u8D25: "+err.message;_$("s-models").style.display="flex";_$("s-models").innerHTML="<span class=\"model-chip\" onclick=\"sPickModel('gpt-4o',this)\">gpt-4o</span><span class=\"model-chip\" onclick=\"sPickModel('deepseek-chat',this)\">deepseek-chat</span>";}
}
function sPickModel(m,el){var inp=_$("s-model");if(inp)inp.value=m;document.querySelectorAll("#s-models .model-chip").forEach(function(c){c.classList.remove("active");});if(el)el.classList.add("active");}

// ══ 次要 API·M3 快模型路由 ══════════════════════════════════════
function sSaveSecondaryAPI(){
  var sk=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
  var su=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
  var sm=_$("s-sec-model")?_$("s-sec-model").value.trim():"";
  var sp=_$("s-sec-prov")?_$("s-sec-prov").value:"openai";
  if(!P.ai)P.ai={};
  if(sk||su||sm){
    P.ai.secondary={key:sk,url:su,model:sm,provider:sp};
    toast("\u2705 \u6B21 API \u5DF2\u4FDD\u5B58\u00B7\u95EE\u5BF9/\u671D\u8BAE\u5C06\u8D70\u6B64\u914D\u7F6E");
  } else {
    delete P.ai.secondary;
    toast("\u2705 \u5DF2\u6E05\u7A7A\u6B21 API\u00B7\u56DE\u9000\u4E3B API");
  }
  try{localStorage.setItem("tm_api",JSON.stringify(P.ai));}catch(e){}
  if(window.tianming&&window.tianming.isDesktop){try{window.tianming.autoSave(_tmStripAiKeyView(P)).catch(function(){});}catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-patches');}catch(_){}}}
  try{ if(typeof tmApplyInsecureTlsConfig==='function') tmApplyInsecureTlsConfig(); }catch(_){}  // 次 API 地址变了·刷新放行白名单
  saveP();
  // 刷新面板以更新徽标和清除按钮可见性
  try{closeSettings();openSettings();}catch(_){}
}

function sClearSecondaryAPI(){
  if(!confirm("\u786E\u5B9A\u6E05\u9664\u6B21 API \u914D\u7F6E\uFF1F"))return;
  if(P.ai)delete P.ai.secondary;
  try{localStorage.setItem("tm_api",JSON.stringify(P.ai));}catch(e){}
  saveP();
  toast("\u5DF2\u6E05\u9664\u6B21 API");
  try{closeSettings();openSettings();}catch(_){}
}

function sToggleSecondaryEnabled(on){
  if(!P.conf)P.conf={};
  P.conf.secondaryEnabled=!!on;
  saveP();
  toast(on?"\u2705 \u5DF2\u542F\u7528\u6B21 API":"\u5DF2\u5173\u95ED\u6B21 API\u00B7\u56DE\u9000\u4E3B API");
  try{closeSettings();openSettings();}catch(_){}
}

async function sDetectSecondaryModels(){
  var key=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
  var baseUrl=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
  if(!key||!baseUrl){toast("\u586B\u5199\u6B21 API Key \u548C\u5730\u5740");return;}
  var st=_$("s-sec-status");if(st)st.textContent="\u68C0\u6D4B\u4E2D\u2026";
  var modelsUrl=baseUrl.replace(/\/+$/,"");
  if(modelsUrl.indexOf("/chat/completions")>=0)modelsUrl=modelsUrl.replace("/chat/completions","/models");
  else{var vm=modelsUrl.match(/(.*\/v\d+)/);modelsUrl=vm?vm[1]+"/models":modelsUrl+"/models";}
  try{
    var resp=await fetch(modelsUrl,{method:"GET",headers:{"Authorization":"Bearer "+key}});
    if(!resp.ok){
      var ml=_$("s-sec-models");
      if(ml){ml.style.display="flex";ml.innerHTML="<span class=\"model-chip\" onclick=\"sPickSecModel('gpt-4o-mini',this)\">gpt-4o-mini</span><span class=\"model-chip\" onclick=\"sPickSecModel('claude-haiku-4-5',this)\">claude-haiku-4-5</span><span class=\"model-chip\" onclick=\"sPickSecModel('deepseek-chat',this)\">deepseek-chat</span>";}
      if(st)st.textContent="\u63A5\u53E3\u4E0D\u53EF\u7528\u00B7\u5DF2\u663E\u793A\u5E38\u7528\u5FEB\u6A21\u578B";
      return;
    }
    var data=await resp.json();var models=[];
    if(data.data&&Array.isArray(data.data))models=data.data.map(function(m){return m.id||"";}).filter(Boolean).sort();
    if(models.length>0){
      var ml2=_$("s-sec-models");
      if(ml2){ml2.style.display="flex";var cur=_$("s-sec-model")?_$("s-sec-model").value:"";ml2.innerHTML=models.map(function(m){return "<span class=\"model-chip"+(m===cur?" active":"")+"\" onclick=\"sPickSecModel('"+m+"',this)\">"+m+"</span>";}).join("");}
      if(st)st.innerHTML="<span style=\"color:var(--green);\">\u2705 "+models.length+" \u4E2A\u6A21\u578B</span>";
    }
  }catch(err){
    if(st)st.textContent="\u5931\u8D25\uFF1A"+err.message;
    var ml3=_$("s-sec-models");
    if(ml3){ml3.style.display="flex";ml3.innerHTML="<span class=\"model-chip\" onclick=\"sPickSecModel('gpt-4o-mini',this)\">gpt-4o-mini</span><span class=\"model-chip\" onclick=\"sPickSecModel('claude-haiku-4-5',this)\">claude-haiku-4-5</span>";}
  }
}

function sPickSecModel(m,el){
  var inp=_$("s-sec-model");if(inp)inp.value=m;
  document.querySelectorAll("#s-sec-models .model-chip").forEach(function(c){c.classList.remove("active");});
  if(el)el.classList.add("active");
}

async function sTestSecondaryConn(){
  var key=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
  var url=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
  var model=_$("s-sec-model")?_$("s-sec-model").value.trim():"gpt-4o-mini";
  if(!key||!url){toast("\u586B\u5199\u6B21 API Key \u548C\u5730\u5740");return;}
  var st=_$("s-sec-status");if(st)st.textContent="\u8FDE\u63A5\u4E2D\u2026";
  try{
    var testUrl=url;
    if(testUrl.indexOf("/chat/completions")<0)testUrl=testUrl.replace(/\/+$/,"")+"/chat/completions";
    var t0=Date.now();
    var resp=await fetch(testUrl,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:model,messages:[{role:"user",content:"Hi"}],max_tokens:5})});
    var dt=Date.now()-t0;
    if(resp.ok){
      if(st)st.innerHTML="<span style=\"color:var(--green);\">\u2705 \u8FDE\u63A5\u6210\u529F\u00B7"+dt+"ms</span>";
    }else{
      if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C HTTP "+resp.status+"</span>";
    }
  }catch(err){
    if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C "+err.message+"</span>";
  }
}
async function sTestConn(){
  var key=_$("s-key")?_$("s-key").value:"";var url=_$("s-url")?_$("s-url").value:"";
  if(!key||!url){toast("\u586B\u5199");return;}var st=_$("s-status");if(st)st.textContent="\u8FDE\u63A5\u4E2D...";
  // 临时更新P.ai以便detectModelContextSize能使用
  var _origKey=P.ai.key, _origUrl=P.ai.url, _origModel=P.ai.model;
  P.ai.key=key; P.ai.url=url; P.ai.model=_$("s-model")?_$("s-model").value:"gpt-4o";
  try{var testUrl=url;if(testUrl.indexOf("/chat/completions")<0)testUrl=testUrl.replace(/\/+$/,"")+"/chat/completions";
    var resp=await fetch(testUrl,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:P.ai.model,messages:[{role:"user",content:"Hi"}],max_tokens:5})});
    if(resp.ok){
      if(st)st.innerHTML="<span style=\"color:var(--green);\">\u2705 \u8FDE\u63A5\u6210\u529F\uFF0C\u6B63\u5728\u63A2\u6D4B\u4E0A\u4E0B\u6587\u7A97\u53E3...</span>";
      // 连接成功后自动探测上下文窗口
      try{
        delete P.conf._detectedContextK; delete P.conf._ctxCacheKey; delete P.conf._ctxDetectLayer;
        var detK = await detectModelContextSize({
          force: true,
          onProgress: function(msg) { if(st) st.innerHTML='<span style="color:var(--gold);">\u2705 \u8FDE\u63A5\u6210\u529F \u00B7 '+msg+'</span>'; }
        });
        if(st)st.innerHTML='<span style="color:var(--green);">\u2705 \u8FDE\u63A5\u6210\u529F \u00B7 \u4E0A\u4E0B\u6587: <b>'+detK+'K</b> ('+(P.conf._ctxDetectLayer||'')+')</span>';
        _sShowCtxInfo(); _sVerbUpdatePreview();
      }catch(ce){if(st)st.innerHTML='<span style="color:var(--green);">\u2705 \u8FDE\u63A5\u6210\u529F</span><span style="color:var(--txt-d);"> (\u63A2\u6D4B\u5931\u8D25)</span>';}
    }else{if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C HTTP "+resp.status+"</span>";}
  }catch(err){if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C "+err.message+"</span>";}
  // 恢复原始值（避免未保存时污染）
  P.ai.key=_origKey; P.ai.url=_origUrl; P.ai.model=_origModel;
}

// 生图API——保存
function _sSaveImgAPI() {
  var ik = (_$('s-img-key')||{}).value || '';
  var iu = (_$('s-img-url')||{}).value || '';
  var im = (_$('s-img-model')||{}).value || 'dall-e-3';
  if (ik || iu) {
    try { localStorage.setItem('tm_api_image', JSON.stringify({key:ik.trim(), url:iu.trim(), model:im.trim()})); } catch(_){}
  } else {
    try { localStorage.removeItem('tm_api_image'); } catch(_){}
  }
  toast('\u751F\u56FEAPI\u5DF2\u4FDD\u5B58');
}

// 生图API——测试连接
async function _sTestImgConn() {
  var st = _$('s-img-status');
  if (st) st.innerHTML = '<span style="color:var(--gold);">\u6D4B\u8BD5\u4E2D\u2026</span>';
  var cfg = typeof ImageAPI !== 'undefined' ? ImageAPI.getConfig() : null;
  if (!cfg || !cfg.supported) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C \u672A\u914D\u7F6E\u751F\u56FEAPI\uFF08Key\u6216URL\u4E3A\u7A7A\uFF09</span>';
    return;
  }
  try {
    // 用一个极简prompt测试连接（不实际生成图片，只验证认证）
    var resp = await fetch(cfg.url, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body: JSON.stringify({model:cfg.model||'dall-e-3',prompt:'test',n:1,size:'256x256',response_format:'url'})
    });
    if (resp.ok) {
      if (st) st.innerHTML = '<span style="color:var(--green);">\u2705 \u8FDE\u63A5\u6210\u529F\uFF0C\u751F\u56FEAPI\u53EF\u7528</span>';
    } else {
      var errMsg = '';
      try { var ej = await resp.json(); errMsg = (ej.error && ej.error.message) || ''; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-patches');}catch(_){}}
      if (st) st.innerHTML = '<span style="color:var(--red);">\u274C HTTP ' + resp.status + (errMsg ? ': ' + errMsg.slice(0,60) : '') + '</span>';
    }
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C \u7F51\u7EDC\u9519\u8BEF: ' + e.message + '</span>';
  }
}

// 生图API——检测是否支持生图功能
async function _sDetectImgCap() {
  var st = _$('s-img-status');
  if (st) st.innerHTML = '<span style="color:var(--gold);">\u68C0\u6D4B\u4E2D\u2026\u6B63\u5728\u5C1D\u8BD5\u751F\u6210\u6D4B\u8BD5\u56FE\u7247</span>';
  try {
    // 实际生成一张极小的测试图来验证生图能力
    var testUrl = await ImageAPI.generate('A simple red circle on white background, minimal, test image', {size:'256x256', quality:'standard'});
    if (testUrl) {
      if (st) st.innerHTML = '<span style="color:var(--green);">\u2705 \u751F\u56FE\u529F\u80FD\u6B63\u5E38\uFF01\u5DF2\u6210\u529F\u751F\u6210\u6D4B\u8BD5\u56FE\u7247\u3002</span>' +
        '<br><img src="' + (typeof escHtml==='function'?escHtml(testUrl):testUrl) + '" style="width:64px;height:64px;border-radius:4px;margin-top:4px;border:1px solid var(--bdr);">';
    }
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C \u751F\u56FE\u529F\u80FD\u4E0D\u53EF\u7528: ' + (typeof escHtml==='function'?escHtml(e.message):e.message).slice(0,80) + '</span>';
  }
}

// 系统开关面板
function renderScnTab(em,sc){
  var idx=P.scenarios.indexOf(sc);
  em.innerHTML=
    // 系统开关
    "<div class=\"cd\"><h4>\u7CFB\u7EDF\u5F00\u5173</h4>"+
    ["characters:\u89D2\u8272","factions:\u515A\u6D3E","items:\u7269\u54C1","military:\u519B\u4E8B","events:\u4E8B\u4EF6","map:\u5730\u56FE","techTree:\u79D1\u6280\u6811","civicTree:\u5E02\u653F\u6811"].map(function(s){var parts=s.split(":");return "<div class=\"toggle-wrap\"><label class=\"toggle\"><input type=\"checkbox\" "+(P.systems[parts[0]]!==false?"checked":"")+" onchange=\"P.systems['"+parts[0]+"']=this.checked\"><span class=\"toggle-slider\"></span></label><div>"+parts[1]+"</div></div>";}).join("")+"</div>"+
    // 剧本信息
    "<div class=\"cd\"><h4>\u5267\u672C\u4FE1\u606F</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u540D\u79F0</label><input value=\""+(sc.name||"")+"\" onchange=\"P.scenarios["+idx+"].name=this.value\"></div><div class=\"fd\"><label>\u65F6\u4EE3</label><input value=\""+(sc.era||"")+"\" onchange=\"P.scenarios["+idx+"].era=this.value\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u89D2\u8272</label><input value=\""+(sc.role||"")+"\" onchange=\"P.scenarios["+idx+"].role=this.value\"></div></div>"+
    "<div class=\"fd full\"><label>\u80CC\u666F</label><textarea rows=\"3\" onchange=\"P.scenarios["+idx+"].background=this.value\">"+(sc.background||"")+"</textarea></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.5rem;\"><label>\u5F00\u573A\u767D</label><textarea rows=\"6\" onchange=\"P.scenarios["+idx+"].opening=this.value\">"+(sc.opening||"")+"</textarea></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.5rem;\"><label>\u5EFA\u8BAE(\u6BCF\u884C)</label><textarea rows=\"3\" onchange=\"P.scenarios["+idx+"].suggestions=this.value.split('\\n').filter(Boolean)\">"+(sc.suggestions||[]).join("\n")+"</textarea></div>"+
    "<div class=\"rw\" style=\"margin-top:0.5rem;\"><div class=\"fd\"><label>\u80DC\u5229</label><textarea rows=\"2\" onchange=\"P.scenarios["+idx+"].winCond=this.value\">"+(sc.winCond||"")+"</textarea></div><div class=\"fd\"><label>\u5931\u8D25</label><textarea rows=\"2\" onchange=\"P.scenarios["+idx+"].loseCond=this.value\">"+(sc.loseCond||"")+"</textarea></div></div>"+
    "<hr class=\"dv\"><div class=\"rw\"><div class=\"fd\"><label>\u6587\u98CE</label><select onchange=\"P.scenarios["+idx+"].scnStyle=this.value\"><option value=\"\">\u8DDF\u968F\u5168\u5C40</option><option "+(sc.scnStyle==="\u6587\u5B66\u5316"?"selected":"")+">\u6587\u5B66\u5316</option><option "+(sc.scnStyle==="\u53F2\u4E66\u4F53"?"selected":"")+">\u53F2\u4E66\u4F53</option></select></div></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>\u53C2\u8003\u6587\u672C</label><textarea rows=\"3\" onchange=\"P.scenarios["+idx+"].refText=this.value\">"+(sc.refText||"")+"</textarea></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>\u5267\u672CAPI\u6307\u4EE4</label><textarea rows=\"2\" onchange=\"P.scenarios["+idx+"].customPrompt=this.value\">"+(sc.customPrompt||"")+"</textarea></div></div>";
}

// ============================================================
//  开局逻辑审查：AI生成缺失所在地 + 检查剧本数据矛盾
// ============================================================
async function _logicAuditOnStart(sc) {
  if (!P.ai.key || !GM.chars || GM.chars.length === 0) return;
  // 剧本已人工深化·跳过 AI 逻辑审查（角色 location/矛盾已手工填妥）
  if (sc && (sc.aiAutoEnrich === false || sc.isFullyDetailed === true)) {
    console.log('[LogicAudit] 剧本已深化·跳过 AI 审查');
    return;
  }
  var capital = GM._capital || '京城';
  var era = (sc && sc.era) || P.era || '';
  var bg = (sc && sc.background) || '';
  var dynasty = (sc && sc.dynasty) || '';
  var startYear = (P.time && P.time.year) || '';

  // ── 收集数据 ──
  var needLocation = []; // 缺所在地需AI生成的角色
  var haveLocation = []; // 已有所在地需审查的角色
  GM.chars.forEach(function(c) {
    if (c.alive === false) return;
    if (c._locationNeedAI) {
      needLocation.push(c);
    } else {
      haveLocation.push(c);
    }
  });

  // 行政区划
  var adminInfo = '';
  var adminPlaces = []; // 收集所有已知地名供AI参考
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(k) {
      var ah = P.adminHierarchy[k];
      if (ah && ah.divisions) {
        adminInfo += k + '辖下：';
        adminInfo += ah.divisions.map(function(d) {
          var gov = d.governor || '';
          var name = d.name || '';
          var cap = d.capital || '';
          if (name) adminPlaces.push(name);
          if (cap) adminPlaces.push(cap);
          return name + (cap ? '(治' + cap + ')' : '') + (gov ? '[' + gov + ']' : '');
        }).join('、');
        adminInfo += '\n';
      }
    });
  }

  // 官制
  var officeHolders = [];
  (function _walk(nodes, pre) {
    if (!nodes) return;
    nodes.forEach(function(n) {
      if (n.positions) n.positions.forEach(function(p) {
        if (p.holder) officeHolders.push({ dept: pre + n.name, pos: p.name, holder: p.holder });
      });
      if (n.subs) _walk(n.subs, pre + n.name + '/');
    });
  })(GM.officeTree, '');

  // ── 构建prompt ──
  var prompt = '你是' + (era || '中国古代') + '历史专家。请完成以下两项任务：\n\n';
  prompt += '【时代背景】' + (dynasty ? dynasty + ' ' : '') + era + (startYear ? '（' + startYear + '年）' : '') + '\n';
  if (bg) prompt += bg + '\n';
  prompt += '\u3010\u4EAC\u57CE/\u9996\u90FD\u3011' + capital + '\n';
  if (adminPlaces.length > 0) prompt += '\u3010\u5DF2\u77E5\u5730\u540D\u3011' + adminPlaces.join('\u3001') + '\n';

  // ═══ 任务一：为缺失所在地的角色生成位置 ═══
  if (needLocation.length > 0) {
    prompt += '\n═══ 任务一：生成角色所在地 ═══\n';
    prompt += '以下角色没有设置所在地，请根据其官职、身份和历史背景推断其应在何处。\n\n';
    needLocation.forEach(function(c) {
      var tags = [];
      if (c.isPlayer) tags.push('玩家');
      if (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true) tags.push('后妃');
      if (c.faction) tags.push('势力:' + c.faction);
      prompt += '  ' + c.name + '（' + (c.title || '无官职') + '）' + (tags.length ? ' [' + tags.join(',') + ']' : '');
      if (c.bio) prompt += ' \u7B80\u4ECB:' + c.bio;
      if (c.desc) prompt += ' ' + c.desc;
      prompt += '\n';
    });
    prompt += '\n推断规则：\n';
    prompt += '• 地方官（刺史/太守/知府/节度使/巡抚等）→ 其辖区治所\n';
    prompt += '• 中央朝臣（宰相/尚书/侍郎/御史等）→ 京城(' + capital + ')\n';
    prompt += '• 后妃/皇族 → 京城\n';
    prompt += '• 武将 → 根据其军职判断，守边将领在边镇，禁军将领在京城\n';
    prompt += '• 隐士/在野/被贬 → 根据史实或合理推断（如被贬岭南、归隐庐山等）\n';
    prompt += '• 真实历史人物 → 务必参照' + (startYear ? startYear + '年' : '该时期') + '的史实确定其所在地\n';
    prompt += '• 所在地用具体地名（如"杭州""范阳""洛阳"），不要用泛称（如"地方""边疆"）\n';
    prompt += '• 如果行政区划中有该地名，优先使用区划中的写法\n';
  }

  // ═══ 任务二：审查已有角色数据的逻辑矛盾 ═══
  prompt += '\n═══ 任务二：逻辑矛盾审查 ═══\n';
  prompt += '检查以下已有所在地的角色，是否存在矛盾：\n\n';
  haveLocation.forEach(function(c) {
    prompt += '  ' + c.name + '（' + (c.title || '') + '）在: ' + c.location;
    if (c.isPlayer) prompt += ' [玩家]';
    if (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true) prompt += ' [后妃]';
    if (c._locationExplicit) prompt += ' [手动设置]';
    prompt += '\n';
  });

  if (adminInfo) prompt += '\n【行政区划】\n' + adminInfo;
  if (officeHolders.length > 0) {
    prompt += '\n【中央官制】\n';
    officeHolders.forEach(function(o) { prompt += '  ' + o.dept + ' ' + o.pos + ': ' + o.holder + '\n'; });
  }

  prompt += '\n审查规则：\n';
  prompt += '• 地方官所在地应为辖区治所（"杭州刺史"应在杭州）\n';
  prompt += '• 中央官员应在京城\n';
  prompt += '• 行政区划的governor与角色title/location应一致\n';
  prompt += '• 标记[手动设置]的角色如果有矛盾仍然报告，但在reason中注明"编辑器设置，建议检查"\n';

  // ═══ 输出格式 ═══
  prompt += '\n═══ 输出格式（严格JSON）═══\n';
  prompt += '{\n';
  prompt += '  "locations": [{"name":"角色名","location":"推断的所在地","reason":"依据(15字内)"}],\n';
  prompt += '  "fixes": [{"name":"角色名","field":"location","oldValue":"原值","newValue":"正确值","reason":"原因(20字内)"}],\n';
  prompt += '  "notes": ["其他无法自动修正的问题"]\n';
  prompt += '}\n';
  prompt += 'locations: 任务一的结果（每个缺位角色一条）\n';
  prompt += 'fixes: 任务二的结果（仅有矛盾的角色）\n';
  prompt += '只输出JSON，不要解释。';

  try {
    var result = await callAISmart(prompt, 6000, { maxRetries: 2 });
    var data = (typeof extractJSON === 'function') ? extractJSON(result) : null;
    if (!data) return;

    var genCount = 0, fixCount = 0;

    // ── 应用任务一：生成的所在地 ──
    (data.locations || []).forEach(function(loc) {
      if (!loc.name || !loc.location) return;
      var ch = GM.chars.find(function(c) { return c.name === loc.name; });
      if (!ch) return;
      var old = ch.location;
      ch.location = loc.location;
      delete ch._locationNeedAI; // 清除标记
      genCount++;
      _dbg('[LogicAudit] 生成所在地: ' + loc.name + ' → ' + loc.location + ' (' + (loc.reason || '') + ')');
    });

    // 未被AI处理的角色，保持京城默认（清除标记）
    GM.chars.forEach(function(c) { delete c._locationNeedAI; });

    // ── 应用任务二：矛盾修正 ──
    (data.fixes || []).forEach(function(fix) {
      if (!fix.name || !fix.field || !fix.newValue) return;
      var ch = GM.chars.find(function(c) { return c.name === fix.name; });
      if (!ch) return;
      if (fix.field !== 'location') return; // 安全白名单

      var oldVal = ch[fix.field];
      // 编辑器显式设置的仅记录不覆盖
      if (ch._locationExplicit) {
        _dbg('[LogicAudit] 建议(未覆盖): ' + fix.name + ' "' + oldVal + '" → "' + fix.newValue + '" (' + (fix.reason || '') + ')');
        return;
      }
      ch[fix.field] = fix.newValue;
      fixCount++;
      _dbg('[LogicAudit] 修正: ' + fix.name + ' "' + (oldVal || '') + '" → "' + fix.newValue + '" (' + (fix.reason || '') + ')');
    });

    (data.notes || []).forEach(function(n) { _dbg('[LogicAudit] 备注: ' + n); });

    // ── 汇总 ──
    var totalChanges = genCount + fixCount;
    if (totalChanges > 0) {
      showLoading('\u903B\u8F91\u5BA1\u67E5: \u751F\u6210' + genCount + '\u5904\u6240\u5728\u5730\uFF0C\u4FEE\u6B63' + fixCount + '\u5904\u77DB\u76FE', 92);
      console.log('[LogicAudit] 生成所在地 ' + genCount + ' 处，修正矛盾 ' + fixCount + ' 处');
      if (GM.qijuHistory) {
        var logParts = [];
        if (genCount > 0) logParts.push('为' + genCount + '位人物生成所在地');
        if (fixCount > 0) logParts.push('修正' + fixCount + '处矛盾');
        GM.qijuHistory.unshift({
          turn: 0, date: '开局审查',
          content: '【逻辑审查】' + logParts.join('，') + '。'
        });
      }
    } else {
      showLoading('\u903B\u8F91\u5BA1\u67E5: \u6570\u636E\u65E0\u77DB\u76FE', 92);
    }
  } catch(e) {
    console.warn('[LogicAudit] 审查失败:', e.message || e);
  }
}

// 开场白动画（完全替换 startGame，doActualStart 内部调用 GameHooks）
function _tmStartHasRegions(map) {
  return !!(map && Array.isArray(map.regions) && map.regions.length > 0);
}

function _tmStartClone(value) {
  if (typeof deepClone === 'function') return deepClone(value);
  try { return JSON.parse(JSON.stringify(value)); } catch(_) { return value; }
}

function _tmStartIsOfficialTianqi(sid) {
  return String(sid || '') === 'sc-tianqi7-1627';
}

function _tmStartApplyOfficialSnapshot(sid, reason) {
  if (!_tmStartIsOfficialTianqi(sid)) return;
  if (typeof window === 'undefined' || typeof window.TM_TIANQI_APPLY_OFFICIAL_RUNTIME_SNAPSHOT !== 'function') return;
  try {
    window.TM_TIANQI_APPLY_OFFICIAL_RUNTIME_SNAPSHOT();
  } catch(e) {
    try {
      if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-snapshot-' + (reason || 'unknown'));
    } catch(_) {}
  }
}

function _tmStartFindScenario(sid, reason) {
  _tmStartApplyOfficialSnapshot(sid, reason);
  return (typeof findScenarioById === 'function') ? findScenarioById(sid) : null;
}

function _tmStartSidRows(key, sid, sc) {
  if (typeof P === 'undefined' || !P) return [];
  if (!Array.isArray(P[key])) P[key] = [];
  var rows = P[key].filter(function(row) { return row && (!row.sid || row.sid === sid); });
  if (rows.length === 0 && sc && Array.isArray(sc[key]) && sc[key].length > 0) {
    P[key] = P[key].filter(function(row) { return row && row.sid !== sid; });
    sc[key].forEach(function(row) {
      var copy = _tmStartClone(row);
      if (copy && typeof copy === 'object') copy.sid = sid;
      P[key].push(copy);
    });
    rows = P[key].filter(function(row) { return row && (!row.sid || row.sid === sid); });
  }
  return rows;
}

function _tmStartVariableRows(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  var out = [];
  if (Array.isArray(source.base)) {
    source.base.forEach(function(v) {
      var copy = _tmStartClone(v);
      if (copy && typeof copy === 'object') copy._category = copy._category || 'base';
      out.push(copy);
    });
  }
  if (Array.isArray(source.other)) {
    source.other.forEach(function(v) {
      var copy = _tmStartClone(v);
      if (copy && typeof copy === 'object') copy._category = copy._category || 'other';
      out.push(copy);
    });
  }
  return out;
}

function _tmStartLoadVars(sid, sc) {
  if (typeof GM === 'undefined' || !GM || typeof P === 'undefined' || !P) return 0;
  var rows = _tmStartVariableRows(P.variables).filter(function(v) { return v && (!v.sid || v.sid === sid); });
  if (rows.length === 0 && sc && sc.variables) rows = _tmStartVariableRows(sc.variables);
  if (rows.length === 0) return 0;
  if (!Array.isArray(P.variables) || P.variables.length === 0) P.variables = rows.map(function(v) {
    var copy = _tmStartClone(v);
    if (copy && typeof copy === 'object' && !copy.sid) copy.sid = sid;
    return copy;
  });
  if (!GM.vars || typeof GM.vars !== 'object') GM.vars = {};
  rows.forEach(function(v) {
    if (!v || !v.name) return;
    var gv = _tmStartClone(v);
    if (gv.value === undefined) gv.value = parseFloat(gv.defaultValue) || parseFloat(gv.initial) || parseFloat(gv.default) || 0;
    gv.value = parseFloat(gv.value) || 0;
    if (gv.min === undefined && gv.minimum !== undefined) gv.min = gv.minimum;
    if (gv.max === undefined && gv.maximum !== undefined) gv.max = gv.maximum;
    if (gv.min === undefined) gv.min = 0;
    if (gv.max === undefined) gv.max = Math.max(100, Math.abs(gv.value) * 10);
    gv.min = parseFloat(gv.min) || 0;
    gv.max = parseFloat(gv.max) || 100;
    if (gv.max <= gv.min) gv.max = gv.min + 100;
    GM.vars[gv.name] = gv;
  });
  return Object.keys(GM.vars || {}).length;
}

function _tmStartMapSource(sc, allowDisabled) {
  if (typeof GM !== 'undefined' && _tmStartHasRegions(GM.mapData)) return GM.mapData;
  if (typeof P !== 'undefined' && P) {
    if (_tmStartHasRegions(P.map) && (allowDisabled || P.map.enabled !== false)) return P.map;
    if (_tmStartHasRegions(P.mapData) && (allowDisabled || P.mapData.enabled !== false)) return P.mapData;
  }
  if (sc) {
    if (_tmStartHasRegions(sc.map) && (allowDisabled || sc.map.enabled !== false)) return sc.map;
    if (_tmStartHasRegions(sc.mapData) && (allowDisabled || sc.mapData.enabled !== false)) return sc.mapData;
  }
  return null;
}

function _tmStartBindMap(sourceMap) {
  if (!_tmStartHasRegions(sourceMap)) return null;
  var live = null;
  if (typeof bindRuntimeMapState === 'function') {
    try { live = bindRuntimeMapState(sourceMap); } catch(_) { live = null; }
  }
  if (!_tmStartHasRegions(live)) {
    live = _tmStartClone(sourceMap);
    if (typeof GM !== 'undefined' && GM) GM.mapData = live;
    if (typeof P !== 'undefined' && P) {
      P.map = live;
      P.mapData = live;
    }
  }
  if (live) live.enabled = true;
  return live;
}

function _tmStartConsumeMapChoice(sid) {
  if (typeof window === 'undefined') return true;
  var choice = window._pendingUseMap;
  var choiceSid = window._pendingMapModeSid;
  var choiceAt = Number(window._pendingMapModeAt || 0);
  var fresh = (choiceSid === sid) && (!choiceAt || (Date.now() - choiceAt < 30 * 60 * 1000));
  delete window._pendingUseMap;
  delete window._pendingMapModeSid;
  delete window._pendingMapModeAt;
  if (choice === false && fresh) return false;
  return true;
}

function _tmStartApplyMapChoice(sid, sc) {
  var useMap = _tmStartConsumeMapChoice(sid);
  if (useMap === false) {
    if (typeof P !== 'undefined' && P) {
      P.map = P.map || {};
      P.map.enabled = false;
      P.map.regions = [];
      P.map.roads = [];
      P.mapData = P.mapData || {};
      P.mapData.enabled = false;
      P.mapData.regions = [];
    }
    if (typeof GM !== 'undefined' && GM) {
      GM.mapData = null;
      GM._useAIGeo = true;
    }
    return false;
  }
  if (typeof GM !== 'undefined' && GM) GM._useAIGeo = false;
  var source = _tmStartMapSource(sc, true);
  if (source) _tmStartBindMap(source);
  return true;
}

function _tmStartRepairRuntimeData(sid, sc, reason) {
  if (typeof GM === 'undefined' || !GM || typeof P === 'undefined' || !P) return null;
  var official = _tmStartIsOfficialTianqi(sid);
  if (official) {
    _tmStartApplyOfficialSnapshot(sid, reason || 'repair');
    sc = (typeof findScenarioById === 'function') ? findScenarioById(sid) : sc;
  }
  var report = { reason: reason || '', chars: 0, facs: 0, vars: 0, mapRegions: 0, fixed: [] };
  var minChars = official ? 30 : 1;
  var minFacs = official ? 5 : 1;
  var minVars = official ? 10 : 1;
  var minRegions = official ? 10 : 1;

  if (!Array.isArray(GM.chars) || GM.chars.length < minChars) {
    var charRows = _tmStartSidRows('characters', sid, sc);
    if (charRows.length >= minChars) {
      GM.chars = charRows.map(function(c) { return _tmStartClone(c); });
      report.fixed.push('chars');
    }
  }
  if (!Array.isArray(GM.facs) || GM.facs.length < minFacs) {
    var facRows = _tmStartSidRows('factions', sid, sc);
    if (facRows.length >= minFacs) {
      GM.facs = facRows.map(function(f) {
        var copy = _tmStartClone(f);
        if (copy && typeof copy === 'object') {
          if (!copy.vassals) copy.vassals = [];
          if (copy.liege === undefined) copy.liege = null;
          if (copy.tributeRate === undefined) copy.tributeRate = 0.3;
          if (!copy.territories) copy.territories = [];
        }
        return copy;
      });
      report.fixed.push('facs');
    }
  }
  if (!GM.vars || Object.keys(GM.vars).length < minVars) {
    var varCount = _tmStartLoadVars(sid, sc);
    if (varCount >= minVars) report.fixed.push('vars');
  }
  if (!GM._useAIGeo && (!_tmStartHasRegions(GM.mapData) || GM.mapData.regions.length < minRegions)) {
    var mapSource = _tmStartMapSource(sc, true);
    var live = _tmStartBindMap(mapSource);
    if (_tmStartHasRegions(live) && live.regions.length >= minRegions) report.fixed.push('map');
  } else if (_tmStartHasRegions(GM.mapData)) {
    P.map = GM.mapData;
    P.mapData = GM.mapData;
  }

  report.chars = Array.isArray(GM.chars) ? GM.chars.length : 0;
  report.facs = Array.isArray(GM.facs) ? GM.facs.length : 0;
  report.vars = GM.vars ? Object.keys(GM.vars).length : 0;
  report.mapRegions = _tmStartHasRegions(GM.mapData) ? GM.mapData.regions.length : 0;
  if (report.fixed.length) {
    try { console.warn('[StartRuntimeRepair]', report); } catch(_) {}
    try { if (typeof buildIndices === 'function' && (report.fixed.indexOf('chars') >= 0 || report.fixed.indexOf('facs') >= 0)) buildIndices(); } catch(_) {}
  }
  return report;
}

function _tmStartDynastyContext(sc) {
  var dynasty = (sc && (sc.dynasty || sc.era)) || (typeof GM !== 'undefined' && GM && GM.eraState && GM.eraState.dynasty) || '';
  var phase = (typeof GM !== 'undefined' && GM && GM.eraState && GM.eraState.dynastyPhase) || 'peak';
  return { dynasty: dynasty, phase: phase };
}

function _tmStartRefreshFormalShell() {
  try { if (typeof renderTopBarVars === 'function') renderTopBarVars(); } catch(_) {}
  try {
    if (typeof window !== 'undefined' && window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.refresh === 'function') {
      window.TMPhase8FormalBridge.refresh();
    }
  } catch(_) {}
}

function _tmStartPrimeFormalRuntime(sid, sc, reason) {
  if (typeof GM === 'undefined' || !GM) return null;
  sc = sc || ((typeof findScenarioById === 'function' && sid) ? findScenarioById(sid) : null);
  var ctx = _tmStartDynastyContext(sc);
  var fixed = [];

  try {
    if (GM.turn === 1 && !GM._corruptionPresetDone && typeof CorruptionEngine !== 'undefined' && typeof CorruptionEngine.initFromDynasty === 'function') {
      CorruptionEngine.initFromDynasty(ctx.dynasty, ctx.phase, sc || {});
      GM._corruptionPresetDone = true;
      fixed.push('corruption');
    } else if (typeof CorruptionEngine !== 'undefined' && typeof CorruptionEngine.ensureModel === 'function') {
      CorruptionEngine.ensureModel();
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-corruption'); } catch(_) {} }

  try {
    if (GM.turn === 1 && !GM._guokuPresetDone && typeof GuokuEngine !== 'undefined' && typeof GuokuEngine.initFromDynasty === 'function') {
      GuokuEngine.initFromDynasty(ctx.dynasty, ctx.phase, sc || {});
      GM._guokuPresetDone = true;
      fixed.push('guoku');
    } else if (typeof GuokuEngine !== 'undefined' && typeof GuokuEngine.ensureModel === 'function') {
      GuokuEngine.ensureModel();
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-guoku'); } catch(_) {} }

  // 开局即真活算财政收入（根治「绍宋月入显估算 20万/旧兜底 7万·实应 ~70万」）。
  // 此处在 GuokuEngine 加载静态估算之后、enterGame 之前·adminHierarchy 与各区 economyBase 均已就绪——
  // 跑一次 cascadeCollect(turnDays:30=月入口径) 用真活算值覆盖静态估算。settle 幂等·首回合会重算。
  try {
    if (typeof CascadeTax !== 'undefined' && CascadeTax && typeof CascadeTax.collect === 'function'
        && GM && GM.adminHierarchy && (GM.adminHierarchy.player || Object.keys(GM.adminHierarchy).length)) {
      CascadeTax.collect({ faction: 'player', turnDays: 30 });
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-fiscal'); } catch(_) {} }

  // 役政/人力开局种子（根治「役负舆图开局灰·GM.renli.byRegion 空」）：同收入·开局即种 renli 账，
  // 让役负视图(yizheng 层·读 GM.renli.byRegion)开局有真值，而非等第一回合 endturnTick 才有。幂等·首回合会重算。
  try {
    if (typeof TM !== 'undefined' && TM.Renli) {
      if (typeof TM.Renli.ensurePilotSeeds === 'function') TM.Renli.ensurePilotSeeds(GM);
      if (typeof TM.Renli.endturnTick === 'function') TM.Renli.endturnTick(GM, typeof P !== 'undefined' ? P : null);
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-renli'); } catch(_) {} }

  try {
    if (GM.turn === 1 && !GM._neitangPresetDone && typeof NeitangEngine !== 'undefined' && typeof NeitangEngine.initFromDynasty === 'function') {
      NeitangEngine.initFromDynasty(ctx.dynasty, ctx.phase, sc || {});
      GM._neitangPresetDone = true;
      fixed.push('neitang');
    } else if (typeof NeitangEngine !== 'undefined' && typeof NeitangEngine.ensureModel === 'function') {
      NeitangEngine.ensureModel();
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-neitang'); } catch(_) {} }

  try {
    if (typeof HujiEngine !== 'undefined' && typeof HujiEngine.init === 'function') {
      HujiEngine.init(sc || {});
      fixed.push('population');
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-huji'); } catch(_) {} }

  try {
    if (typeof AuthorityEngines !== 'undefined' && typeof AuthorityEngines.init === 'function') {
      AuthorityEngines.init();
      fixed.push('authority');
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-authority'); } catch(_) {} }

  try {
    if (!GM._useAIGeo && !_tmStartHasRegions(GM.mapData)) {
      var mapSource = _tmStartMapSource(sc, true);
      if (_tmStartBindMap(mapSource)) fixed.push('map');
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-map'); } catch(_) {} }

  if (fixed.length) {
    try { console.warn('[StartRuntimePrime]', { reason: reason || '', fixed: fixed }); } catch(_) {}
  }
  _tmStartRefreshFormalShell();
  return fixed;
}

function _tmStartValidateScenarioBeforeLaunch(sc){
  // TM_START_GUARD: validate-scenario-before-start.
  if (typeof validateScenario !== 'function') return true;
  try {
    var validation = validateScenario(sc);
    if (!validation) return true;
    if (validation.valid === false) {
      var errors = Array.isArray(validation.errors) ? validation.errors : [];
      if (typeof toast === 'function') toast('\u5267\u672C\u9519\u8BEF: ' + errors.join('; '));
      try { console.error('[startGame] scenario validation failed:', errors); } catch(_) {}
      return false;
    }
    if (validation.warnings && validation.warnings.length > 0) {
      try { console.warn('[startGame] scenario validation warnings:', validation.warnings); } catch(_) {}
      try { if (typeof _dbg === 'function') _dbg('[startGame] validation warnings: ' + validation.warnings.join('; ')); } catch(_) {}
    }
  } catch(e) {
    if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, 'startGame scenario validation');
    else try { console.warn('[startGame scenario validation]', e); } catch(_) {}
    if (typeof toast === 'function') toast('\u5267\u672C\u6821\u9A8C\u5931\u8D25');
    return false;
  }
  return true;
}

function _tmStartConfirmModelRequirementsBeforeLaunch(sc){
  // TM_START_GUARD: model-requirements-warning-before-start.
  try {
    if (!sc || !sc.modelRequirements || !P || !P.ai || !P.ai.model) return true;
    var req = sc.modelRequirements;
    var warnings = [];
    var wlCtx = (typeof _matchModelCtx === 'function') ? _matchModelCtx(P.ai.model) : 0;
    var wlOut = (typeof _matchModelOutput === 'function') ? _matchModelOutput(P.ai.model) : 0;
    var conf = P.conf || {};
    var measuredCtx = conf._detectedContextK || wlCtx;
    var measuredOutK = conf._measuredMaxOutput ? Math.round(conf._measuredMaxOutput / 1024) : (conf._detectedMaxOutput ? Math.round(conf._detectedMaxOutput / 1024) : wlOut);
    if (req.minContextK && measuredCtx > 0 && measuredCtx < req.minContextK) warnings.push('\u4E0A\u4E0B\u6587 ' + measuredCtx + 'K < \u63A8\u8350 ' + req.minContextK + 'K');
    if (req.minOutputK && measuredOutK > 0 && measuredOutK < req.minOutputK) warnings.push('\u8F93\u51FA ' + measuredOutK + 'K < \u63A8\u8350 ' + req.minOutputK + 'K\u00B7\u4E3B\u63A8\u6F14 JSON \u6613\u88AB\u622A\u65AD');
    if (warnings.length === 0) return true;
    var models = (req.recommendedModels || []).join('/').slice(0, 80);
    var msg = '\u26A0 \u672C\u5267\u672C\u63A8\u8350: ' + models
      + '\n\u5F53\u524D\u6A21\u578B: ' + P.ai.model
      + '\n\n\u68C0\u51FA\u95EE\u9898:\n  \u00B7 ' + warnings.join('\n  \u00B7 ')
      + '\n\n' + (req.warningThreshold || '')
      + '\n\n\u662F\u5426\u4ECD\u8981\u5F00\u59CB?';
    if (typeof confirm === 'function' && !confirm(msg)) {
      if (typeof toast === 'function') toast('\u5DF2\u53D6\u6D88\u00B7\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u66F4\u6362\u6A21\u578B\u6216\u91CD\u8DD1\u6A21\u578B\u80FD\u529B\u6821\u9A8C');
      return false;
    }
  } catch(e) {
    if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, 'M1 modelReq check');
    else try { console.warn('[M1 modelReq check]', e); } catch(_) {}
  }
  return true;
}

startGame=async function(sid){
  var sc=_tmStartFindScenario(sid, 'startGame-pre') || findScenarioById(sid);
  if(!sc){toast("\u672A\u627E\u5230");return;}
  if (!_tmStartValidateScenarioBeforeLaunch(sc)) return;
  if (!_tmStartConfirmModelRequirementsBeforeLaunch(sc)) return;
  _$("scn-page").classList.remove("show");
  _$("launch").style.display="none";

  // 加载流程
  showLoading("\u751F\u6210\u4E16\u754C\u4E2D",0);

  // 第一阶段：读取剧本数据
  var steps=[
    {text:"\u8BFB\u53D6\u5267\u672C\u57FA\u672C\u4FE1\u606F",progress:5},
    {text:"\u8BFB\u53D6\u4E16\u754C\u8BBE\u5B9A",progress:10},
    {text:"\u8BFB\u53D6\u89D2\u8272\u6570\u636E",progress:20},
    {text:"\u8BFB\u53D6\u52BF\u529B\u6570\u636E",progress:30},
    {text:"\u8BFB\u53D6\u7269\u54C1\u7CFB\u7EDF",progress:40},
    {text:"\u8BFB\u53D6\u4E8B\u4EF6\u7CFB\u7EDF",progress:50},
    {text:"\u8BFB\u53D6\u5B98\u5236\u7CFB\u7EDF",progress:55},
    {text:"\u8BFB\u53D6\u519B\u4E8B\u7CFB\u7EDF",progress:60},
    {text:"\u8BFB\u53D6\u79D1\u6280\u6811",progress:65},
    {text:"\u8BFB\u53D6\u5E02\u653F\u6811",progress:70}
  ];

  for(var i=0;i<steps.length;i++){
    showLoading(steps[i].text+"...",steps[i].progress);
    await new Promise(function(r){setTimeout(r,200);});
  }

  // 第二阶段：AI 配置世界（如果配置了 AI）
  if(P.ai.key){
    showLoading("\u63A2\u6D4B\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3...",71);
    try {
      var _detK = await detectModelContextSize();
      showLoading("\u6A21\u578B\u4E0A\u4E0B\u6587: " + _detK + "K tokens",72);
      await new Promise(function(r){setTimeout(r,500);});
    } catch(_detErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_detErr, 'CtxDetect] 探测失败，使用默认值:') : console.warn('[CtxDetect] 探测失败，使用默认值:', _detErr); }
    showLoading("\u8FDE\u63A5AI\u7CFB\u7EDF...",72);
    await new Promise(function(r){setTimeout(r,300);});

    // 1. AI 读取并理解剧本基本信息
    showLoading("AI\u8BFB\u53D6\u5267\u672C\u57FA\u672C\u4FE1\u606F...",74);
    await new Promise(function(r){setTimeout(r,300);});

    // 2. AI 读取世界设定
    showLoading("AI\u8BFB\u53D6\u4E16\u754C\u8BBE\u5B9A...",76);
    await new Promise(function(r){setTimeout(r,300);});

    // 3. AI 读取角色信息
    var chars = P.characters.filter(function(c){return c.sid===sid;});
    if(chars.length > 0){
      showLoading("AI\u8BFB\u53D6\u89D2\u8272\u4FE1\u606F\uFF08" + chars.length + "\u4EBA\uFF09...",78);
      await new Promise(function(r){setTimeout(r,300);});
    }

    // 4. AI 读取势力信息
    var facs = P.factions.filter(function(f){return f.sid===sid;});
    if(facs.length > 0){
      showLoading("AI\u8BFB\u53D6\u52BF\u529B\u4FE1\u606F\uFF08" + facs.length + "\u4E2A\uFF09...",80);
      await new Promise(function(r){setTimeout(r,300);});
    }

    // 5. AI 统筹整合
    showLoading("AI\u7EDF\u7B79\u6574\u5408\u4E16\u754C\u6570\u636E...",82);
    await new Promise(function(r){setTimeout(r,500);});

    // 6. 生成开场白（如果需要）
    if(!sc.opening||sc.opening.length<50){
      showLoading("AI\u751F\u6210\u5F00\u573A\u767D...",85);
      try{
        // 构建完整的剧本上下文
        var contextPrompt = "\u4F60\u662FAI\u4E16\u754C\u914D\u7F6E\u7CFB\u7EDF\uFF0C\u8BF7\u6839\u636E\u4EE5\u4E0B\u5B8C\u6574\u7684\u5267\u672C\u6570\u636E\u751F\u6210\u5F00\u573A\u767D\u3002\n\n";

        contextPrompt += "\u3010\u5267\u672C\u57FA\u672C\u4FE1\u606F\u3011\n";
        contextPrompt += "\u540D\u79F0\uFF1A" + sc.name + "\n";
        contextPrompt += "\u65F6\u4EE3\uFF1A" + sc.era + "\n";
        contextPrompt += "\u89D2\u8272\uFF1A" + sc.role + "\n";
        if(sc.background) contextPrompt += "\u80CC\u666F\uFF1A" + sc.background + "\n";
        if(sc.overview) contextPrompt += "\u6982\u8FF0\uFF1A" + sc.overview + "\n";

        // 添加世界设定
        if(P.world && (P.world.history || P.world.politics || P.world.culture)){
          contextPrompt += "\n\u3010\u4E16\u754C\u8BBE\u5B9A\u3011\n";
          if(P.world.history) contextPrompt += "\u5386\u53F2\u80CC\u666F\uFF1A" + P.world.history.substring(0, 300) + (P.world.history.length > 300 ? "..." : "") + "\n";
          if(P.world.politics) contextPrompt += "\u653F\u6CBB\u683C\u5C40\uFF1A" + P.world.politics.substring(0, 300) + (P.world.politics.length > 300 ? "..." : "") + "\n";
          if(P.world.culture) contextPrompt += "\u6587\u5316\u7279\u8272\uFF1A" + P.world.culture.substring(0, 300) + (P.world.culture.length > 300 ? "..." : "") + "\n";
        }

        // 添加角色信息
        if(chars.length > 0){
          contextPrompt += "\n\u3010\u89D2\u8272\u5217\u8868\u3011\uFF08\u5171" + chars.length + "\u4EBA\uFF09\n";
          chars.slice(0, 15).forEach(function(c){
            contextPrompt += "- " + c.name;
            if(c.title) contextPrompt += "\uFF08" + c.title + "\uFF09";
            if(c.faction) contextPrompt += " \u6240\u5C5E\uFF1A" + c.faction;
            if(c.bio) contextPrompt += " \u7B80\u4ECB\uFF1A" + c.bio.substring(0, 80);
            contextPrompt += "\n";
          });
          if(chars.length > 15) contextPrompt += "...\u7B49\u5171" + chars.length + "\u4EBA\n";
        }

        // 添加势力信息
        if(facs.length > 0){
          contextPrompt += "\n\u3010\u52BF\u529B\u5217\u8868\u3011\uFF08\u5171" + facs.length + "\u4E2A\uFF09\n";
          facs.forEach(function(f){
            contextPrompt += "- " + f.name;
            if(f.leader) contextPrompt += " \u9996\u9886\uFF1A" + f.leader;
            if(f.desc) contextPrompt += " \u7B80\u4ECB\uFF1A" + f.desc.substring(0, 80);
            contextPrompt += "\n";
          });
          if(facs.length > 10) contextPrompt += "...\u7B49\u5171" + facs.length + "\u4E2A\u52BF\u529B\n";
        }

        // 添加物品系统
        var items = P.items.filter(function(t){return t.sid===sid;});
        if(items.length > 0){
          contextPrompt += "\n\u3010\u7269\u54C1\u7CFB\u7EDF\u3011\uFF08\u5171" + items.length + "\u4EF6\uFF09\n";
          items.slice(0, 5).forEach(function(t){
            contextPrompt += "- " + t.name;
            if(t.desc) contextPrompt += "\uFF1A" + t.desc.substring(0, 50);
            contextPrompt += "\n";
          });
          if(items.length > 5) contextPrompt += "...\u7B49\u5171" + items.length + "\u4EF6\u7269\u54C1\n";
        }

        // 添加游戏模式信息
        var gameMode = P.conf.gameMode || 'yanyi';
        contextPrompt += "\n\u3010\u6E38\u620F\u6A21\u5F0F\u3011";
        if(gameMode === 'strict_hist'){
          contextPrompt += "\u4E25\u683C\u53F2\u5B9E\u6A21\u5F0F\uFF0C\u5FC5\u987B\u4E25\u683C\u9075\u5FAA\u5386\u53F2\u4E8B\u5B9E\u3002\n";
          if(P.conf.refText) contextPrompt += "\n\u3010\u53C2\u8003\u53F2\u6599\u3011\n" + P.conf.refText.substring(0, 800) + (P.conf.refText.length > 800 ? "..." : "") + "\n";
        }else if(gameMode === 'light_hist'){
          contextPrompt += "\u8F7B\u5EA6\u53F2\u5B9E\u6A21\u5F0F\uFF0C\u5927\u4F53\u7B26\u5408\u5386\u53F2\u5373\u53EF\u3002\n";
        }else{
          contextPrompt += "\u6F14\u4E49\u6A21\u5F0F\uFF0C\u53EF\u81EA\u7531\u53D1\u6325\u3002\n";
        }

        contextPrompt += "\n\u3010\u4EFB\u52A1\u3011\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u5B8C\u6574\u7684\u5267\u672C\u6570\u636E\uFF0C\u7EFC\u5408\u8003\u8651\u6240\u6709\u89D2\u8272\u3001\u52BF\u529B\u3001\u4E16\u754C\u8BBE\u5B9A\uFF0C\u751F\u6210\u4E00\u6BB5400\u5B57\u7684\u5F00\u573A\u767D\u3002\u76F4\u63A5\u8F93\u51FA\u6587\u672C\uFF0C\u4E0D\u8981\u5305\u542B\u4EFB\u4F55\u5176\u4ED6\u5185\u5BB9\u3002";

        sc.opening=await callAISmart(contextPrompt, 2000, {minLength: 300, maxRetries: 3});

      // 历史检查环节（轻度和严格模式）
      if((P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist') && sc.opening && sc.opening.length > 50){
        showLoading("\u5386\u53F2\u68C0\u67E5\u4E2D...",92);
        try{
          var yearRange = P.conf.gameMode === 'strict_hist' ? 100 : 200;
          var histCheckPrompt = "\u4F60\u662F\u5386\u53F2\u987E\u95EEAI\u3002\u8BF7\u68C0\u67E5\u4EE5\u4E0B\u5F00\u573A\u767D\u662F\u5426\u5B58\u5728\u660E\u663E\u7684\u53F2\u5B9E\u9519\u8BEF\uFF08\u5982\u4EBA\u7269\u5E74\u4EE3\u9519\u8BEF\u3001\u4E8B\u4EF6\u987A\u5E8F\u9519\u8BEF\u3001\u5730\u7406\u9519\u8BEF\u7B49\uFF09\u3002\n\n"+
            "\u3010\u5267\u672C\u8BBE\u5B9A\u3011\n\u540D\u79F0\uFF1A"+sc.name+"\n\u65F6\u4EE3\uFF1A"+sc.era+"\n\u89D2\u8272\uFF1A"+sc.role+"\n\n"+
            "\u3010\u5F00\u573A\u767D\u3011\n"+sc.opening+"\n\n"+
            "\u8BF7\u8FD4\u56DEJSON\u683C\u5F0F\uFF1A{\"hasErrors\":true/false,\"errorCount\":0,\"errors\":[\"\u9519\u8BEF\u63CF\u8FF0\"],\"correctedText\":\"\u4FEE\u6B63\u540E\u7684\u5F00\u573A\u767D\"}\u3002\u5982\u679C\u6CA1\u6709\u9519\u8BEF\uFF0ChasErrors\u4E3Afalse\uFF0CcorrectedText\u4E3A\u7A7A\u3002";

          var histCheckResult = await callAISmart(histCheckPrompt, 2000, {maxRetries: 2});
          var histCheck = JSON.parse(histCheckResult.replace(/```json|```/g,"").trim());

          if(histCheck.hasErrors && histCheck.correctedText){
            sc.opening = histCheck.correctedText;
            _dbg('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u53D1\u73B0\u5E76\u4FEE\u6B63\u4E86 ' + (histCheck.errorCount || histCheck.errors.length) + ' \u5904\u53F2\u5B9E\u9519\u8BEF');
            if(histCheck.errors && histCheck.errors.length > 0){
              _dbg('[\u5386\u53F2\u68C0\u67E5] \u9519\u8BEF\u8BE6\u60C5\uFF1A', histCheck.errors);
            }
          }
        }catch(e){
          console.error('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u68C0\u67E5\u5931\u8D25\uFF1A', e);
        }
      }
    }catch(e){
      console.error('[AI生成开场白] 失败：', e);
    }
  }
  }

    // 7. AI 最终统筹总结（可选，不影响游戏启动）
    if(P.ai.key){
      showLoading("AI\u6700\u7EC8\u7EDF\u7B79\u603B\u7ED3...",88);
      try{
        // 构建统筹提示，让 AI 确认所有数据已正确加载
        var summaryPrompt = "\u4F60\u662FAI\u4E16\u754C\u914D\u7F6E\u7CFB\u7EDF\u3002\u8BF7\u7528\u4E00\u53E5\u8BDD\uFF0815\u5B57\u4EE5\u5185\uFF09\u786E\u8BA4\u4E16\u754C\u914D\u7F6E\u5B8C\u6210\u3002\u76F4\u63A5\u8F93\u51FA\u786E\u8BA4\u4FE1\u606F\uFF0C\u4E0D\u8981JSON\u683C\u5F0F\u3002";

        var summaryResult = await callAISmart(summaryPrompt, 50, {maxRetries: 1});
        _dbg('[AI统筹总结] ' + summaryResult);
      }catch(e){
        _dbg('[AI统筹总结] 跳过：', e);
      }
    }

  // 第三阶段：历史检查（轻度和严格模式）
  if((P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist') && sc.opening && sc.opening.length > 50){
    showLoading("\u5386\u53F2\u68C0\u67E5\u4E2D...",92);
    try{
      var yearRange = P.conf.gameMode === 'strict_hist' ? 100 : 200;
      var histCheckPrompt = "\u4F60\u662F\u5386\u53F2\u987E\u95EEAI\u3002\u8BF7\u68C0\u67E5\u4EE5\u4E0B\u5F00\u573A\u767D\u662F\u5426\u5B58\u5728\u660E\u663E\u7684\u53F2\u5B9E\u9519\u8BEF\uFF08\u5982\u4EBA\u7269\u5E74\u4EE3\u9519\u8BEF\u3001\u4E8B\u4EF6\u987A\u5E8F\u9519\u8BEF\u3001\u5730\u7406\u9519\u8BEF\u7B49\uFF09\u3002\n\n"+
        "\u3010\u5267\u672C\u8BBE\u5B9A\u3011\n\u540D\u79F0\uFF1A"+sc.name+"\n\u65F6\u4EE3\uFF1A"+sc.era+"\n\u89D2\u8272\uFF1A"+sc.role+"\n\n"+
        "\u3010\u5F00\u573A\u767D\u3011\n"+sc.opening+"\n\n"+
        "\u8BF7\u8FD4\u56DEJSON\u683C\u5F0F\uFF1A{\"hasErrors\":true/false,\"errorCount\":0,\"errors\":[\"\u9519\u8BEF\u63CF\u8FF0\"],\"correctedText\":\"\u4FEE\u6B63\u540E\u7684\u5F00\u573A\u767D\"}\u3002\u5982\u679C\u6CA1\u6709\u9519\u8BEF\uFF0ChasErrors\u4E3Afalse\uFF0CcorrectedText\u4E3A\u7A7A\u3002";

      var histCheckResult = await callAISmart(histCheckPrompt, 2000, {maxRetries: 2});
      var histCheck = JSON.parse(histCheckResult.replace(/```json|```/g,"").trim());

      if(histCheck.hasErrors && histCheck.correctedText){
        sc.opening = histCheck.correctedText;
        _dbg('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u53D1\u73B0\u5E76\u4FEE\u6B63\u4E86 ' + (histCheck.errorCount || histCheck.errors.length) + ' \u5904\u53F2\u5B9E\u9519\u8BEF');
        if(histCheck.errors && histCheck.errors.length > 0){
          _dbg('[\u5386\u53F2\u68C0\u67E5] \u9519\u8BEF\u8BE6\u60C5\uFF1A', histCheck.errors);
        }
      }
    }catch(e){
      console.error('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u68C0\u67E5\u5931\u8D25\uFF1A', e);
    }
  }

  // 第四阶段：完成初始化
  showLoading("\u521D\u59CB\u5316\u5B8C\u6210",95);
  await new Promise(function(r){setTimeout(r,300);});
  showLoading("\u51C6\u5907\u5C31\u7EEA",100);
  await new Promise(function(r){setTimeout(r,200);});

  hideLoading();

  // 开场白动画
  // 开场文本兜底：如果没有opening，用overview前200字
  if (!sc.opening || sc.opening.length <= 20) {
    if (sc.overview && sc.overview.length > 30) {
      sc.opening = sc.overview.substring(0, 200) + (sc.overview.length > 200 ? '...' : '');
    }
  }
  if(sc.opening&&sc.opening.length>20){
    // 2026-06 重制·入世仪典（跨剧本通用·数据全取 sc·缺则兜底）
    _tmShowOpeningCeremony(sc, sid);
  }else{
    doActualStart(sid);
  }
};

// ════ 开场白·入世仪典 overlay（2026-06 重制·跨剧本通用）════
// 时机：在 doActualStart 之前展示·此刻 P/GM 尚未初始化·所有数据均从 sc（剧本对象）取，缺则兜底。
// 数据：题署=sc.name/sc.era；身份=sc.playerInfo.characterName(去注解)→sc.characters 找立绘/称谓/bio；
//       戏眼=sc.events 里 isOpeningEvent/triggerTurn:1 的前 3 条（每剧本皆有·绝不写死单朝专名）。
function _tmShowOpeningCeremony(sc, sid) {
  var _esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // 玩家角色（容错去注解·跨剧本：绍宋 characterName 形如「赵构(穿越者赵玖)」）
  var _pi = sc.playerInfo || {};
  var _pName = _pi.characterName || '';
  var _pClean = (_pName.replace(/[（(].*$/, '').trim()) || _pName;
  var _pChar = null;
  (sc.characters || []).some(function (c) { if (c && (c.name === _pClean || c.name === _pName)) { _pChar = c; return true; } return false; });
  var _pTitle = _pi.characterTitle || (_pChar && (_pChar.officialTitle || _pChar.title)) || '';
  var _pPortrait = (_pChar && _pChar.portrait) || '';
  var _pBio = _pi.characterBio || (_pChar && _pChar.bio) || '';
  if (_pBio) _pBio = String(_pBio).replace(/\s+/g, ' ').trim().slice(0, 64);
  // 开局戏眼（开局事件前 3·跨剧本通用）
  var _eyes = [];
  (sc.events || []).forEach(function (e) {
    if (_eyes.length >= 3 || !e) return;
    if (!(e.isOpeningEvent === true || e.triggerTurn === 1)) return;
    _eyes.push({ ti: e.name || '开局要务', ds: String(e.description || e.narrative || '').replace(/\s+/g, ' ').trim().slice(0, 16), key: (e.importance === '关键') });
  });
  // 题署印字：剧本朝代字 > 剧本名首字
  var _sealCh = ((sc.dynastyChar || sc.dynasty || '').toString().charAt(0)) || ((sc.name || '天').toString().charAt(0));

  var ov = document.createElement('div');
  ov.id = 'tm-opening'; ov.className = 'tm-op';
  var h = '<div class="tm-op-world">';
  h += '<div class="tm-op-title"><div class="tm-op-seal">' + _esc(_sealCh) + '</div>'
    + '<div class="tm-op-tcol"><div class="tm-op-name">' + _esc(sc.name || '') + '</div>'
    + (sc.era ? '<div class="tm-op-sub">' + _esc(sc.era) + '</div>' : '') + '</div></div>';
  h += '<div class="tm-op-body">';
  if (_pName) {
    h += '<div class="tm-op-aside">';
    var _figInner = (_pPortrait
      ? '<img src="' + _esc(_pPortrait) + '" alt="" onerror="var f=this.closest(\'.tm-op-fig\');if(f)f.classList.add(\'no-img\');this.remove();">'
      : '')
      + '<span class="tm-op-figseal">' + _esc(_pClean.charAt(0) || '帝') + '</span>'
      + '<div class="tm-op-vig"></div><div class="tm-op-frame"></div><span class="tm-op-rtag">尔之所履</span>';
    h += '<div class="tm-op-fig' + (_pPortrait ? '' : ' no-img') + '">' + _figInner + '</div>';
    h += '<div class="tm-op-ident"><div class="tm-op-who">' + _esc(_pClean) + (_pTitle ? '<small>' + _esc(_pTitle) + '</small>' : '') + '</div>'
      + (_pBio ? '<div class="tm-op-plight">' + _esc(_pBio) + '</div>' : '') + '</div>';
    if (_eyes.length) {
      h += '<div class="tm-op-eyes"><div class="tm-op-eyes-h">开 局 戏 眼</div>';
      _eyes.forEach(function (ey) {
        h += '<div class="tm-op-eye' + (ey.key ? ' key' : '') + '"><span class="tm-op-eye-dot"></span><span class="tm-op-eye-tx"><b>' + _esc(ey.ti) + '</b>' + (ey.ds ? '<span>' + _esc(ey.ds) + '</span>' : '') + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
  }
  h += '<div class="tm-op-scroll' + (_pName ? '' : ' solo') + '"><div class="tm-op-scroll-h"><span class="tm-op-lbl">开 卷</span><span class="tm-op-hint">按 空格 略过逐字</span></div>'
    + '<div class="tm-op-paper"><div class="tm-op-narr" id="opening-text"></div></div></div>';
  h += '</div>';
  h += '<div class="tm-op-foot"><div class="tm-op-fnote">此局为<b>平行时空</b> · 史册由尔亲手改写。</div>'
    + '<div class="tm-op-btns"><button class="tm-op-skip" id="tm-op-skip">▶ 略过逐字</button>'
    + '<button class="tm-op-enter" id="tm-op-enter">提 笔 临 朝</button></div></div>';
  h += '</div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);

  // 逐字浮现（沿用现有 50ms·预渲染 visibility 防重排抖动）
  var textEl = ov.querySelector('#opening-text');
  var full = sc.opening || '';
  var _hh = '';
  for (var i = 0; i < full.length; i++) {
    var ch = full.charAt(i);
    if (ch === '\n') { _hh += '<br>'; continue; }
    _hh += '<span class="_ot-ch" style="opacity:0;">' + (ch === ' ' ? '&nbsp;' : (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch)) + '</span>';
  }
  textEl.innerHTML = _hh;
  var spans = textEl.querySelectorAll('._ot-ch');
  var idx = 0, allShown = false;
  var timer = setInterval(function () {
    if (idx >= spans.length || !ov.parentElement) { clearInterval(timer); allShown = true; return; }
    if (spans[idx]) spans[idx].style.opacity = '1';
    idx++;
  }, 50);
  function showAll() { clearInterval(timer); for (var k = 0; k < spans.length; k++) spans[k].style.opacity = '1'; allShown = true; }
  function enter() { clearInterval(timer); document.removeEventListener('keydown', onKey); if (ov.parentElement) ov.remove(); doActualStart(sid); }
  var skipBtn = ov.querySelector('#tm-op-skip'); if (skipBtn) skipBtn.addEventListener('click', function () { if (!allShown) showAll(); });
  var entBtn = ov.querySelector('#tm-op-enter'); if (entBtn) entBtn.addEventListener('click', enter);
  var onKey = function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!allShown) showAll(); else enter(); }
    else if (e.key === 'Escape') { e.preventDefault(); enter(); }
  };
  document.addEventListener('keydown', onKey);
}

function doActualStart(sid){
  showLoading('\u52A0\u8F7D\u5267\u672C\u914D\u7F6E...', 5);
  // 应用难度设置
  if (window._pendingDifficulty) {
    if (!P.conf) P.conf = {};
    P.conf.difficulty = window._pendingDifficulty;
    delete window._pendingDifficulty;
  }
  _tmStartApplyOfficialSnapshot(sid, 'doActualStart-pre');
  // 初始化GM（完整版，包含所有必要属性）
  var sc=_tmStartFindScenario(sid, 'doActualStart-find') || findScenarioById(sid);
  if(!sc){toast("\u672A\u627E\u5230");return;}
  // 治剧本数据串台(漏洞):P 为跨剧本复用的全局配置,下方 if(sc.X) P.X=... 只在新剧本含该字段时覆盖,缺字段则残留上一个剧本的值。
  // 绍宋无 government/military/map/mapData/mapRuntimeContract → 会漏天启的官制官员/军队/地图。故应用新剧本前先清空这些
  // 非 sid 隔离的「整个世界」字段,缺则保持空,绝不继承别的剧本(sid 隔离的 characters/factions/... 已自带过滤,不在此列)。
  ['government','military','map','mapData','mapRuntimeContract'].forEach(function(_lk){ try { delete P[_lk]; } catch(_le) { P[_lk] = undefined; } });
  var _prevSaveName=GM.saveName||'';GM={running:true,sid:sid,turn:1,vars:{},rels:{},chars:[],facs:[],items:[],armies:[],evtLog:[],conv:[],busy:false,memorials:[],qijuHistory:[],jishiRecords:[],biannianItems:[],officeTree:P.officeTree?deepClone(P.officeTree):[],wenduiTarget:null,wenduiHistory:{},officeChanges:[],shijiHistory:[],allCharacters:[],classes:[],parties:[],techTree:[],civicTree:[],autoSummary:"",summarizedTurns:[],currentDay:0,eraName:"",eraNames:[],eraState:sc.eraState?deepClone(sc.eraState):(P.eraState?deepClone(P.eraState):{politicalUnity:0.7,centralControl:0.6,legitimacySource:'hereditary',socialStability:0.6,economicProsperity:0.6,culturalVibrancy:0.7,bureaucracyStrength:0.6,militaryProfessionalism:0.5,landSystemType:'mixed',dynastyPhase:'peak',contextDescription:''}),taxPressure:52,playerAbilities:{management:0,military:0,scholarship:0,politics:0},currentIssues:[],pendingConsequences:[],memoryAnchors:[],provinceStats:{},playerPendingTasks:[],playerCharacterId:null,regentSignal:null,regentState:{},npcContext:null,turnChanges:{variables:[],characters:[],factions:[],parties:[],classes:[],military:[],map:[]},_listeners:{},_changeQueue:[],triggeredHistoryEvents:{},rigidTriggers:{},offendGroupScores:{},activeRebounds:[],triggeredOffendEvents:{},_indices:null,postSystem:null,mapData:null,eraStateHistory:[],factionRelations:[],factionEvents:[],_tyrantDecadence:0,_tyrantHistory:[],_varMapping:null,stateTreasury:0,privateTreasury:0,_bankruptcyTurns:0,enYuanRecords:[],patronNetwork:[],activeSchemes:[],schemeCooldowns:{},eventCooldowns:{},yearlyChronicles:[],activeBattles:[],battleHistory:[],_turnBattleResults:[],activeWars:[],treaties:[],marchOrders:[],activeSieges:[],_rngCheckpoints:[]};if(_prevSaveName)GM.saveName=_prevSaveName;

  // 根据era智能推断eraState缺失字段（当剧本未定义eraState时使用合理默认值）
  if (!sc.eraState && sc.era && GM.eraState) {
    var _era = sc.era || '';
    // 根据剧本名称/背景推断是否为衰落期
    var _bg = (sc.background || '') + (sc.name || '') + (sc.desc || '');
    if (_bg.indexOf('末') >= 0 || _bg.indexOf('衰') >= 0 || _bg.indexOf('亡') >= 0 || _bg.indexOf('挽') >= 0 || _bg.indexOf('困') >= 0) {
      GM.eraState.dynastyPhase = 'decline';
      GM.eraState.socialStability = 0.35;
      GM.eraState.economicProsperity = 0.3;
      GM.eraState.centralControl = 0.3;
    }
    // 秦/隋等短命统一王朝：高集权
    if (_era.indexOf('秦') >= 0 || _era.indexOf('隋') >= 0) {
      GM.eraState.centralControl = 0.9;
      GM.eraState.landSystemType = 'junxian';
    }
    // 南渡/偏安：低统一度
    if (_bg.indexOf('南渡') >= 0 || _bg.indexOf('偏安') >= 0 || _era.indexOf('南宋') >= 0 || _era.indexOf('东晋') >= 0) {
      GM.eraState.politicalUnity = 0.3;
    }
  }

  // 从剧本加载目标/得罪群体/科举配置
  if (sc.goals && sc.goals.length > 0) P.goals = deepClone(sc.goals);
  if (sc.offendGroups) P.offendGroups = deepClone(sc.offendGroups);
  if (sc.keju) P.keju = deepClone(sc.keju);
  if (sc.playerInfo) P.playerInfo = deepClone(sc.playerInfo);
  if (sc.engineConstants) {
    GM.engineConstants = deepClone(sc.engineConstants);
    P.engineConstants = deepClone(sc.engineConstants);
  }
  if (Array.isArray(sc.influenceGroups)) {
    GM.influenceGroups = deepClone(sc.influenceGroups);
    P.influenceGroups = deepClone(sc.influenceGroups);
  }

  // 初始皇命（钉子条目 + 隐藏天机）写入 12 表系统的 imperialEdict（玩家锁·AI 永读不写）
  if (sc.imperialEdicts && sc.imperialEdicts.length > 0 && window.MemTables) {
    try {
      MemTables.ensureInit();
      sc.imperialEdicts.forEach(function(e) {
        MemTables.editorWrite('imperialEdict', 'insert', {
          values: {
            0: String(e.priority || 5),
            1: String(e.content || ''),
            2: String(e.condition || '永久生效'),
            3: String(e.startTurn || 1),
            4: e.secret ? 'true' : ''
          }
        });
      });
    } catch(_ieE) { console.warn('[ImperialEdict] 初始皇命同步失败:', _ieE); }
  }

  // 加载时字段自动补全（防止旧剧本缺少新字段导致崩溃）
  if (!GM.characterArcs) GM.characterArcs = {};
  if (!GM.playerDecisions) GM.playerDecisions = [];
  if (!GM.memoryArchive) GM.memoryArchive = [];
  if (!GM.chronicleAfterwords) GM.chronicleAfterwords = [];
  if (!GM.customPolicies) GM.customPolicies = [];
  if (!GM.affinityMap) GM.affinityMap = {};
  if (!GM._rngState) initRng(sid + '_' + Date.now());

  // 重置全局系统状态（防止上一局数据残留）
  if (typeof ChronicleSystem !== 'undefined') ChronicleSystem.reset();
  if (typeof WarWeightSystem !== 'undefined') WarWeightSystem._truces = {};

  // 加载经济配置
  if (sc.economyConfig) {
    P.economyConfig = deepClone(sc.economyConfig);
  } else if (!P.economyConfig) {
    P.economyConfig = {
      redistributionRate: 0.3,
      baseIncome: 100
    };
  }

  // 加载岗位系统配置
  if (sc.postSystem) {
    GM.postSystem = deepClone(sc.postSystem);
  } else {
    GM.postSystem = {
      enabled: false,
      posts: []
    };
  }
  // A1: 从postRules自动生成实际posts（如果posts为空但有rules）
  if (GM.postSystem && GM.postSystem.postRules && GM.postSystem.postRules.length > 0 && (!GM.postSystem.posts || GM.postSystem.posts.length === 0)) {
    GM.postSystem.posts = [];
    GM.postSystem.postRules.forEach(function(rule) {
      var post = {
        id: 'post_' + (rule.positionName || '').replace(/\s/g, '_') + '_' + Date.now() + '_' + randInt(0, 999),
        name: rule.positionName || rule.name || '',
        territoryId: '',
        territoryName: '',
        holder: '',
        rank: rule.rank || 5,
        salary: rule.salary || 0,
        authority: [],
        requirements: {},
        appointedTurn: 0,
        term: 0,
        performance: 0,
        status: 'vacant',
        // 保留postRule的元数据供AI参考
        succession: rule.succession || 'appointment',
        hasAppointmentRight: rule.hasAppointmentRight || false,
        ruleDescription: rule.description || ''
      };
      // 从rule推断authority
      if (rule.succession === 'military') post.authority = ['military'];
      if (rule.hasAppointmentRight) post.authority.push('personnel');
      GM.postSystem.posts.push(post);
    });
    _dbg('[PostSystem] 从 ' + GM.postSystem.postRules.length + ' 条规则生成 ' + GM.postSystem.posts.length + ' 个岗位');
  }

  var _gs=(typeof sc!=="undefined"&&sc.gameSettings)||{};
  P.gameSettings = _gs; // 保存到P供运行时系统查询enabledSystems
  if(_gs.eraName)GM.eraName=_gs.eraName;
  if(_gs.eraNames&&_gs.eraNames.length)GM.eraNames=_gs.eraNames.slice();

  // 加载完整的时间配置（历法/季节/年号模板等）
  if(sc.time){
    P.time = deepClone(sc.time);
  }
  // ★ gameSettings 是编辑器「开局日期」权威字段：即使剧本带 sc.time（可能陈旧·含默认 year:-356 公元前356），
  //   也须以 gameSettings.startYear/startMonth/startDay 覆盖开局年月日——否则编辑器改了开局时间进游戏仍显旧 sc.time 年份（玩家报「固定公元前」）。
  //   见 tm-launch 注释「引擎权威读 gameSettings.startYear/startMonth（仅设 scn.time 会致公元前）」。剧本未设 gameSettings 相应字段则保留 sc.time 原值。
  if(_gs.startMonth)P.time.startMonth=_gs.startMonth;
  if(_gs.startDay)P.time.startDay=_gs.startDay;
  var _gsStartYear = (_gs.startYear!==undefined && _gs.startYear!=='' && !isNaN(Number(_gs.startYear)) && Number(_gs.startYear)!==0) ? Number(_gs.startYear) : null;
  if(_gsStartYear !== null) {
    P.time.year = _gsStartYear;                       // gameSettings.startYear 权威（编辑器改开局年的字段）
  } else if(!sc.time && sc.startYear) {
    // 兜底：无 sc.time 且无有效 gameSettings.startYear → 用剧本元数据顶层 startYear。
    // 不用 `!P.time.year` 判空——P.time 默认 year 为 -356（公元前356·真值），会漏掉此兜底（见 tm-data-model 默认）。
    // 有 sc.time 时保留 sc.time.year（不误伤纯 sc.time 剧本，含合法的公元前年份）。
    P.time.year = sc.startYear;
  }
  // 标准化回合时长：gameSettings.daysPerTurn 是编辑器权威字段，perTurn/customDays 只作旧系统兼容。
  if (typeof normalizeTimeConfigFromGameSettings === 'function') {
    P.time = normalizeTimeConfigFromGameSettings(P.time, _gs);
  } else if (!P.time.daysPerTurn) {
    var _dMapFallback={'\u65E5':1,'\u5468':7,'\u6708':30,'\u5B63':90,'\u5E74':365};
    P.time.daysPerTurn = (_gs.daysPerTurn && Number(_gs.daysPerTurn)) ||
      (_gs.turnUnit ? ((Number(_gs.turnDuration)||1) * (_dMapFallback[_gs.turnUnit]||30)) : 30);
  }
  // 从gameSettings映射干支和年号设置
  if (_gs.enableGanzhi !== undefined) P.time.enableGanzhi = _gs.enableGanzhi;
  if (_gs.enableGanzhiDay !== undefined) P.time.enableGanzhiDay = _gs.enableGanzhiDay;
  if (_gs.enableEraName !== undefined) P.time.enableEraName = _gs.enableEraName;
  if (_gs.eraNames && _gs.eraNames.length > 0 && (!P.time.eraNames || P.time.eraNames.length === 0)) {
    P.time.eraNames = deepClone(_gs.eraNames);
  }
  // dynastyPhaseHint → GM.eraState.dynastyPhase（如果eraState未显式设置phase）
  if(sc.dynastyPhaseHint && GM.eraState && (!GM.eraState.dynastyPhase || GM.eraState.dynastyPhase === 'peak')) {
    GM.eraState.dynastyPhase = sc.dynastyPhaseHint;
  }

  // 加载剧本的其他配置到 P 对象
  if(sc.military) P.military = deepClone(sc.military);
  if(sc.rules) P.rules = deepClone(sc.rules);
  if(sc.timeline) P.timeline = deepClone(sc.timeline);
  if(sc.map) P.map = deepClone(sc.map);
  if(sc.worldSettings) P.worldSettings = deepClone(sc.worldSettings);
  if(sc.government) P.government = deepClone(sc.government);
  if(sc.adminHierarchy) P.adminHierarchy = deepClone(sc.adminHierarchy);
  // 根治(跨剧本)：GM.adminHierarchy 此前只在 fullLoadGame(存档加载)恢复·doActualStart(新开局)从不设→
  // 新开局 GM.adminHierarchy=undefined → 财政引擎 cascadeCollect 经 getGame().adminHierarchy 找不到任何区 → 落 fixedCollect 兜底 → 收入畸低(绍宋开局显七万·实应数百万/月)。开局即同步。
  if(P.adminHierarchy && typeof GM !== 'undefined' && GM && (!GM.adminHierarchy || Object.keys(GM.adminHierarchy).length === 0)) GM.adminHierarchy = deepClone(P.adminHierarchy);
  if(sc.officeTree) P.officeTree = deepClone(sc.officeTree);
  if(sc.officeConfig) P.officeConfig = deepClone(sc.officeConfig);
  // 官制数据源优先级：government.nodes（编辑器主数据，含holder）> officeTree（旧兜底）
  if (P.government && P.government.nodes && P.government.nodes.length > 0) {
    var _govHasHolders = false;
    (function _chk(ns) { ns.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { if (p.holder) _govHasHolders = true; }); if (n.subs) _chk(n.subs); }); })(P.government.nodes);
    if (_govHasHolders || !P.officeTree || P.officeTree.length === 0) {
      P.officeTree = deepClone(P.government.nodes);
      _dbg('[Office] 使用 government.nodes 作为官制数据源' + (_govHasHolders ? '（含任职者）' : ''));
    }
  }
  // 同步到 GM
  if(P.officeTree && P.officeTree.length>0) GM.officeTree = deepClone(P.officeTree);
  if(sc.techTree) P.techTree = deepClone(sc.techTree);
  if(sc.civicTree) P.civicTree = deepClone(sc.civicTree);
  if(sc.variables) P.variables = deepClone(sc.variables);
  // 规范化变量：保留元数据（unit, calcMethod, components, category），分离公式
  if(P.variables && !Array.isArray(P.variables)){
    var _fv=[];
    if(P.variables.base) P.variables.base.forEach(function(v){ v._category='base'; _fv.push(v); });
    if(P.variables.other) P.variables.other.forEach(function(v){ v._category='other'; _fv.push(v); });
    // 公式单独存储到 P._varFormulas（不混入变量数组）
    P._varFormulas = P.variables.formulas || [];
    P.variables=_fv;
  }
  if(!P._varFormulas) P._varFormulas = [];
  if(P.techTree && !Array.isArray(P.techTree)){var _ft=[];if(P.techTree.military)_ft=_ft.concat(P.techTree.military);if(P.techTree.civil)_ft=_ft.concat(P.techTree.civil);P.techTree=_ft;}
  if(P.civicTree && !Array.isArray(P.civicTree)){var _fc=[];if(P.civicTree.city)_fc=_fc.concat(P.civicTree.city);if(P.civicTree.policy)_fc=_fc.concat(P.civicTree.policy);if(P.civicTree.resource)_fc=_fc.concat(P.civicTree.resource);if(P.civicTree.corruption)_fc=_fc.concat(P.civicTree.corruption);P.civicTree=_fc;}
  // rules保持对象格式{base,combat,economy,diplomacy}——这是文本规则描述，供AI推演参考
  // 不转为数组（旧版兼容：如果rules已经是数组则保持）
  if(sc.openingText) P.openingText = sc.openingText;
  if(sc.globalRules) P.globalRules = sc.globalRules;
  if(sc.mapData) P.mapData = deepClone(sc.mapData);
  // 剧本地图进入可变运行态：GM.mapData 为唯一 live state，P.map/P.mapData 同步引用它。
  // 这样 AI 的 map_changes、存档和地图系统读到的是同一份地块所有者/占领状态。
  if ((P.map && P.map.regions && P.map.regions.length > 0) || (P.mapData && P.mapData.regions && P.mapData.regions.length > 0)) {
    var _runtimeMapSource = (P.map && P.map.regions && P.map.regions.length > 0) ? P.map : P.mapData;
    if (typeof bindRuntimeMapState === 'function') {
      bindRuntimeMapState(_runtimeMapSource);
    } else {
      GM.mapData = deepClone(_runtimeMapSource);
      P.map = GM.mapData;
      P.mapData = GM.mapData;
    }
  }
  _tmStartApplyMapChoice(sid, sc);
  if(sc.buildingSystem) P.buildingSystem = deepClone(sc.buildingSystem);
  if(sc.battleConfig) P.battleConfig = deepClone(sc.battleConfig);
  if(sc.mechanicsConfig) { if(!P.mechanicsConfig) P.mechanicsConfig={}; Object.assign(P.mechanicsConfig, deepClone(sc.mechanicsConfig)); }
  if(sc.militaryConfig) P.militaryConfig = deepClone(sc.militaryConfig);
  // 加载初始恩怨/门生到GM
  if (sc.initialEnYuan && sc.initialEnYuan.length > 0 && typeof EnYuanSystem !== 'undefined') {
    sc.initialEnYuan.forEach(function(ey) {
      EnYuanSystem.add(ey.type, ey.from, ey.to, ey.强度||1, ey.事由||'', ey.不共戴天||false);
    });
  }
  if (sc.initialPatronNetwork && sc.initialPatronNetwork.length > 0 && typeof PatronNetwork !== 'undefined') {
    sc.initialPatronNetwork.forEach(function(pn) {
      PatronNetwork.establish(pn.座主, pn.门生, pn.关系类型||'座主门生', pn.亲密度||60);
    });
  }
  if(sc.adminConfig) P.adminConfig = deepClone(sc.adminConfig);
  if(sc.chronicleConfig) P.chronicleConfig = deepClone(sc.chronicleConfig);
  if(sc.eventConstraints) P.eventConstraints = deepClone(sc.eventConstraints);
  if(sc.warConfig) P.warConfig = deepClone(sc.warConfig);
  if(sc.diplomacyConfig) P.diplomacyConfig = deepClone(sc.diplomacyConfig);
  if(sc.schemeConfig) P.schemeConfig = deepClone(sc.schemeConfig);
  if(sc.decisionConfig) P.decisionConfig = deepClone(sc.decisionConfig);
  if(sc.vassalSystem) P.vassalSystem = deepClone(sc.vassalSystem);
  if(sc.titleSystem) P.titleSystem = deepClone(sc.titleSystem);
  if(sc.officialVassalMapping) P.officialVassalMapping = deepClone(sc.officialVassalMapping);

  // 加载剧本的角色、势力、党派、阶层等数据到 P 对象
  if(sc.characters) {
    // 移除旧的该剧本的角色，添加新的
    P.characters = (P.characters||[]).filter(function(c){return c.sid!==sid;});
    P.characters = P.characters.concat(sc.characters.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.factions) {
    P.factions = (P.factions||[]).filter(function(f){return f.sid!==sid;});
    P.factions = P.factions.concat(sc.factions.map(function(f){f.sid=sid;return f;}));
  }
  if(sc.parties) {
    P.parties = (P.parties||[]).filter(function(p){return p.sid!==sid;});
    P.parties = P.parties.concat(sc.parties.map(function(p){p.sid=sid;return p;}));
  }
  if(sc.classes) {
    P.classes = (P.classes||[]).filter(function(c){return c.sid!==sid;});
    P.classes = P.classes.concat(sc.classes.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.items) {
    P.items = (P.items||[]).filter(function(i){return i.sid!==sid;});
    P.items = P.items.concat(sc.items.map(function(i){i.sid=sid;return i;}));
  }
  if(sc.relations) {
    P.relations = (P.relations||[]).filter(function(r){return r.sid!==sid;});
    P.relations = P.relations.concat(sc.relations.map(function(r){r.sid=sid;return r;}));
  }

  if(sc.events) {
    var allEvents = [];
    if (Array.isArray(sc.events)) {
      // 扁平数组格式（官方剧本/bundle/内置自注册脚本：sc.events 直接是事件数组）。
      // 根治：旧加载器只认 {historical/random/conditional/story/chain} 对象格式，
      // 官方天启/绍宋的 sc.events 是扁平数组 → allEvents 恒空 → GM.events 空 → 开局事件无法激活成御案时政。
      // （1.3.4.1 旧天启靠 split-rows 把事件直接塞 P.events 绕过此处；换成扁平内置脚本后暴露。绍宋靠预制 currentIssues 兜底未暴露。）
      allEvents = sc.events.filter(Boolean).map(function(e){ e.sid=sid; if(!e.type) e.type='story'; return e; });
    } else {
      if(sc.events.historical) allEvents = allEvents.concat(sc.events.historical.map(function(e){e.sid=sid;e.type='historical';return e;}));
      if(sc.events.random) allEvents = allEvents.concat(sc.events.random.map(function(e){e.sid=sid;e.type='random';return e;}));
      if(sc.events.conditional) allEvents = allEvents.concat(sc.events.conditional.map(function(e){e.sid=sid;e.type='conditional';return e;}));
      if(sc.events.story) allEvents = allEvents.concat(sc.events.story.map(function(e){e.sid=sid;e.type='story';return e;}));
      if(sc.events.chain) allEvents = allEvents.concat(sc.events.chain.map(function(e){e.sid=sid;e.type='chain';return e;}));
    }
    // 移除旧的该剧本的事件，添加新的
    P.events = (P.events||[]).filter(function(e){return e.sid!==sid;});
    P.events = P.events.concat(allEvents);
  }

  // 刚性史事 sc.rigidHistoryEvents → P.rigidHistoryEvents（打 sid·与 characters/events 同构）。
  // 根治：此前缺这一步，编辑器/草案剧本写的 rigidHistoryEvents 从不进 P，下方 GM 副本 filter(sid) 恒空，
  // 史实进程提示(喂AI预知)+定时触发(checkHistoryEvents)全失效；仅官方 bundle 剧本靠自身预 load 生效。
  // 补齐后所有剧本一致。幂等：同 sid 旧条目先 filter 掉再 concat，重复 doActualStart 不累积。
  if(Array.isArray(sc.rigidHistoryEvents)) {
    P.rigidHistoryEvents = (P.rigidHistoryEvents||[]).filter(function(e){return e && e.sid!==sid;});
    P.rigidHistoryEvents = P.rigidHistoryEvents.concat(sc.rigidHistoryEvents.map(function(e){e.sid=sid;return e;}));
  }

  // 开局内容（御案时政 currentIssues / 奏疏 memorials / 开场书信 openingLetters→鸿雁 letters）→ GM。
  // 根治：此前缺这一步，剧本写的这三类从不进 GM，渲染器(御案时政/奏疏/鸿雁视图)读 GM.* 恒空。跨剧本通用·幂等(同 sid 先清再加)。
  if(typeof GM !== 'undefined' && GM){
    if(Array.isArray(sc.currentIssues)){
      GM.currentIssues = (GM.currentIssues||[]).filter(function(x){return x && x._sid!==sid;});
      sc.currentIssues.forEach(function(x){var c=deepClone(x); c._sid=sid; if(c.raisedTurn==null)c.raisedTurn=GM.turn||1; if(!c.status)c.status='pending'; GM.currentIssues.push(c);});
    }
    if(Array.isArray(sc.memorials)){
      GM.memorials = (GM.memorials||[]).filter(function(x){return x && x._sid!==sid;});
      sc.memorials.forEach(function(x){var c=deepClone(x); c._sid=sid; GM.memorials.push(c);});
    }
    if(Array.isArray(sc.openingLetters)){
      // 鸿雁运行时读 GM.letters；开场书信 openingLetters 是其开局来源。打 sid·幂等。
      GM.letters = (GM.letters||[]).filter(function(x){return x && x._sid!==sid;});
      sc.openingLetters.forEach(function(x){var c=deepClone(x); c._sid=sid; if(c.isOpening==null)c.isOpening=true; GM.letters.push(c);});
    }
    if(Array.isArray(sc.openingAudiences)){
      // 问对「阶下待见」运行时读 GM._pendingAudiences；开局远来求见(使节·告急·特请·非在京者动态浮现不了)由 openingAudiences 预置·打 sid·幂等。
      GM._pendingAudiences = (GM._pendingAudiences||[]).filter(function(x){return x && x._sid!==sid;});
      sc.openingAudiences.forEach(function(x){var c=deepClone(x); c._sid=sid; if(c._opening==null)c._opening=true; GM._pendingAudiences.push(c);});
    }
  }

  // 加载变量到GM.vars——保留编辑者写的所有字段，不假设任何固定格式
  (P.variables||[]).forEach(function(v){
    if(v.sid && v.sid!==sid) return;
    if(!v.name) return; // 至少要有名字
    var gv = deepClone(v);
    // 推断数值：尝试多种可能的字段名
    if(gv.value === undefined) {
      gv.value = parseFloat(gv.defaultValue) || parseFloat(gv.initial) || parseFloat(gv.default) || 0;
    }
    gv.value = parseFloat(gv.value) || 0;
    // min/max：有就用，没有就智能推断
    if(gv.min === undefined && gv.minimum !== undefined) gv.min = gv.minimum;
    if(gv.max === undefined && gv.maximum !== undefined) gv.max = gv.maximum;
    if(gv.min === undefined) gv.min = 0;
    if(gv.max === undefined) gv.max = Math.max(100, Math.abs(gv.value) * 10);
    gv.min = parseFloat(gv.min) || 0;
    gv.max = parseFloat(gv.max) || 100;
    if(gv.max <= gv.min) gv.max = gv.min + 100;
    GM.vars[gv.name] = gv;
  });
  // 存储公式/关联规则供AI参考（不做程序层面的计算）
  GM._varFormulas = P._varFormulas || [];
  (P.relations||[]).filter(function(r){return r.sid===sid;}).forEach(function(r){GM.rels[r.name]=deepClone(r);});
  // 加载势力间关系矩阵
  GM.factionRelations = deepClone(sc.factionRelations || P.factionRelations || []);
  if (!GM.factionRelationsMap) GM.factionRelationsMap = {};
  if (typeof syncFactionRelationsFromList === 'function') syncFactionRelationsFromList(GM.factionRelations);
  GM.chars=(P.characters||[]).filter(function(c){return c.sid===sid;}).map(function(c){return deepClone(c);});
  GM.facs=(P.factions||[]).filter(function(f){return f.sid===sid;}).map(function(f){
    var faction = deepClone(f);
    // 初始化封臣系统字段
    if (!faction.vassals) faction.vassals = [];
    if (!faction.liege) faction.liege = null;
    if (!faction.tributeRate) faction.tributeRate = 0.3;
    if (!faction.territories) faction.territories = [];
    return faction;
  });
  // 人物 factionId ↔ faction 名串 双向同步根治（跨剧本通用）。
  // 此前人物只有 faction 中文名串、无 factionId，引擎各处用 c.faction===f.name 关联→势力一改名/编辑器细化命名，
  // 人物名串就对不上、沦为孤儿（如"大越·李朝"vs"大越李朝"差一个中点）。根治：factionId 为稳定真相源——
  // 有 factionId 则用它校正 c.faction 名串（势力改名后人物名串自动跟新、永不孤儿）；无 factionId 的旧档/其他剧本，
  // 反向用名串回填 factionId。引擎其余各处仍读 c.faction 名串、零改动，但名串自此由 factionId 保证与 factions 一致。
  (function _syncCharFactionId(){
    if (!GM.chars || !GM.facs || !GM.facs.length) return;
    var byId = {}, byName = {};
    GM.facs.forEach(function(f){ if (f && f.id) byId[f.id] = f; if (f && f.name) byName[f.name] = f; });
    var corrected = 0, backfilled = 0;
    GM.chars.forEach(function(c){
      if (!c) return;
      if (c.factionId && byId[c.factionId]) {
        if (c.faction !== byId[c.factionId].name) corrected++;
        c.faction = byId[c.factionId].name;            // 有 id → 校正名串
      } else if (c.faction && byName[c.faction]) {
        c.factionId = byName[c.faction].id;             // 有名 → 回填 id（兼容旧档/中立桶名匹配）
        backfilled++;
      }
    });
    if (typeof _dbg === 'function') _dbg('[factionId同步] 校正名串' + corrected + ' 回填id' + backfilled);
  })();
  // 被俘态初始化（跨朝代通用·非绍宋专属）：剧本数据 stance/presenceState/status 标为被俘类状态 → 运行时 _captured 标记。
  // _captured 者身份仍属本势力(factionId 不变)，但人在敌境、排出本势力日常班底：廷议不召、不得任官、NPC 决策不选、官缺不计为在任。
  // 字段名不含朝代词——靖康「北狩」、土木堡「被俘」等皆由剧本数据驱动，引擎只认 _captured boolean，迎回/获释时可清。
  (function _initCapturedState(){
    if (!GM.chars) return;
    var CAPTURED_MARK = { '北狩': 1, '被俘': 1, '被掳': 1, '陷虏': 1, '没蕃': 1 };
    var PRESENT_MARK = { 'present': 1, '在场': 1, '在朝': 1, '随驾': 1, '在位': 1 };
    function _isCapturedTag(v){
      if (!v || typeof v !== 'string') return false;
      if (CAPTURED_MARK[v]) return true;
      for (var k in CAPTURED_MARK) { if (v.indexOf(k) === 0) return true; }  // "北狩·法理皇帝"等变体取主词
      return false;
    }
    var n = 0;
    GM.chars.forEach(function(c){
      if (!c) return;
      // 在场/在位/随驾/逃归者(presenceState 明示)绝不算被俘——即便别字段提及被俘字样(如柔福帝姬 present、邢焕随驾、金方北狩管理官)
      if (PRESENT_MARK[c.presenceState]) return;
      if (_isCapturedTag(c.presenceState) || _isCapturedTag(c.status) || _isCapturedTag(c.stance)) {
        c._captured = true;
        c._capturedLocation = c.location || c.currentLocation || '';
        if (c._capturedTurn == null) c._capturedTurn = 0;
        n++;
      }
    });
    if (typeof _dbg === 'function') _dbg('[被俘态] 标记 _captured ' + n + ' 人');
  })();
  GM.items=(P.items||[]).filter(function(t){return t.sid===sid;}).map(function(t){var c=deepClone(t);c.acquired=false;return c;});
  // 军队加载：优先 initialTroops（编辑器新 schema 完整部队表），armies 仅作兜底（旧字段通常只有少量代表部队）
  var _initTroops = (P.military && P.military.initialTroops) || [];
  var _legacyArmies = (P.military && P.military.armies) || [];
  var _rawArmies = (_initTroops.length > 0) ? _initTroops : _legacyArmies;
  GM.armies = _rawArmies.filter(function(a) { return !a.sid || a.sid === sid; }).map(function(a) {
    var army = deepClone(a);
    // 字段兼容映射
    if (army.size && !army.soldiers) army.soldiers = parseInt(army.size) || 1000;
    if (army.strength && !army.soldiers) army.soldiers = parseInt(army.strength) || 1000;
    if (!army.soldiers) army.soldiers = 1000;
    if (army.location && !army.garrison) army.garrison = army.location;
    // 兼容旧文本格式 composition → 结构化
    if (typeof army.composition === 'string' && army.composition) {
      army.composition = [{type: army.composition, count: army.soldiers}];
    }
    // 兼容旧文本格式 salary → 结构化
    if (typeof army.salary === 'string' && army.salary) {
      army.salary = [{resource: army.salary, amount: 0, unit: ''}];
    }
    // 兼容旧装备格式 quota/actual → count/condition
    if (army.equipment && Array.isArray(army.equipment)) {
      army.equipment.forEach(function(eq) {
        if (eq.actual !== undefined && eq.count === undefined) eq.count = eq.actual;
        if (eq.note && !eq.condition) eq.condition = eq.note;
      });
    }
    return army;
  });
  // 应用编辑器预设的封臣关系
  if (P.vassalSystem && P.vassalSystem.vassalRelations && P.vassalSystem.vassalRelations.length > 0) {
    P.vassalSystem.vassalRelations.forEach(function(rel) {
      var vassalFac = GM.facs.find(function(f) { return f.name === rel.vassal; });
      var liegeFac = GM.facs.find(function(f) { return f.name === rel.liege; });
      if (vassalFac && liegeFac) {
        vassalFac.liege = rel.liege;
        vassalFac.tributeRate = rel.tributeRate || 0.3;
        if (rel.vassalType) vassalFac.vassalType = rel.vassalType;
        if (!liegeFac.vassals) liegeFac.vassals = [];
        if (liegeFac.vassals.indexOf(rel.vassal) === -1) liegeFac.vassals.push(rel.vassal);
        if (rel.loyalty !== undefined) {
          var vRuler = GM.chars.find(function(c) { return c.faction === rel.vassal && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886'); });
          if (vRuler) vRuler.loyalty = rel.loyalty;
        }
      }
    });
  }
  // 应用编辑器预设的角色头衔
  if (P.titleSystem && P.titleSystem.characterTitles && P.titleSystem.characterTitles.length > 0) {
    P.titleSystem.characterTitles.forEach(function(ct) {
      var ch = GM.chars.find(function(c) { return c.name === ct.character; });
      if (ch) {
        if (!ch.titles) ch.titles = [];
        ch.titles.push({
          name: ct.titleName || '', level: ct.titleLevel || 5,
          hereditary: ct.hereditary || false, privileges: ct.privileges || [],
          _suppressed: [], grantedTurn: 0, grantedBy: '\u5F00\u5C40\u9884\u8BBE'
        });
      }
    });
  }

  GM.classes=(P.classes||[]).filter(function(c){return c.sid===sid;}).map(function(c){return deepClone(c);});
  GM.parties=(P.parties||[]).filter(function(p){return p.sid===sid;}).map(function(p){return deepClone(p);});
  GM.techTree=(P.techTree||[]).filter(function(t){return t.sid===sid;}).map(function(t){var c=deepClone(t);c.unlocked=false;return c;});
  GM.civicTree=(P.civicTree||[]).filter(function(c){return c.sid===sid;}).map(function(c){var cp=deepClone(c);cp.adopted=false;return cp;});
  GM.events=(P.events||[]).filter(function(e){return e.sid===sid;}).map(function(e){var ev=deepClone(e);if(ev.triggered===undefined)ev.triggered=false;return ev;});
  // 单一真相源(剧本隔离根治):刚性史事此前只存在于跨剧本累积的 P.rigidHistoryEvents(官方天启快照常驻·sid=天启)·
  // GM 没有对应数组→处理器/AI 被迫读 P 库→玩绍宋时会看到/触发天启的「魏忠贤自缢」等剧本事件。此处给当前局
  // 建一份只含本剧本的干净副本·让 gameplay 只读 GM(单剧本世界)·不再伸手进多剧本的 P 库。
  GM.rigidHistoryEvents=(P.rigidHistoryEvents||[]).filter(function(e){return e&&e.sid===sid;}).map(function(e){return deepClone(e);});
  // 天机·改命(穿越/上帝视角剧本)：开局建天机录(预知未来刚性史事)+注入御案时政。gated sc.tianjiEnabled(默认关·绍宋赵玖穿越开)·跨朝代。
  GM._tianjiEnabled = !!(sc && sc.tianjiEnabled);
  if (GM._tianjiEnabled && typeof TMTianji !== 'undefined') { try { TMTianji.build(GM); } catch(_tjE){} }
  // 边报·天下军情：从活势力关系算敌我大势·注入御案。gated sc.junqingBriefEnabled(默认关·绍宋开)·跨朝代。
  GM._junqingBriefEnabled = !!(sc && sc.junqingBriefEnabled);
  if (GM._junqingBriefEnabled && typeof TMJunqing !== 'undefined') { try { TMJunqing.build(GM); } catch(_jqE){} }
  // 新君观政·百日：即位之初的观政期(百官观望/政令初行阻/根基法理未固)·相位+AI framing。gated sc.xinjunObserveEnabled(默认关·绍宋开)·跨朝代。
  GM._xinjunObserveEnabled = !!(sc && sc.xinjunObserveEnabled);
  GM._xinjunObserveTurns = (sc && sc.xinjunObserveTurns) || 6;
  if (GM._xinjunObserveEnabled && typeof TMXinjun !== 'undefined') { try { TMXinjun.build(GM); } catch(_xjE){} }
  _tmStartRepairRuntimeData(sid, sc, 'after-runtime-load');
  GM.allCharacters=GM.chars.map(function(c){return{name:c.name,title:c.title,age:c.age||"?",gender:c.gender||"\u7537",personality:c.personality,appearance:c.appearance,desc:c.desc,loyalty:c.loyalty,relationValue:c.loyalty,faction:c.faction,recruited:true,recruitTurn:0,source:"\u521D\u59CB",avatarUrl:""};});

  // 自动为旧角色匹配 traitIds + 初始化stress/goals
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      if (typeof autoAssignTraitIds === 'function') autoAssignTraitIds(c);
      if (typeof validateTraits === 'function') validateTraits(c);
      if (typeof inferPersonalGoal === 'function') inferPersonalGoal(c);
      // 初始化压力值（若缺失）
      if (c.stress === undefined) c.stress = 0;
      // 初始化军事能力（若缺失，根据武勇和智力推算）
      if (c.military === undefined) {
        // 武将类角色军事偏高，文臣偏低，但都受智力修正
        var _valBase = c.valor || 50;
        var _intMod = ((c.intelligence || 50) - 50) * 0.3;
        c.military = Math.round(_valBase * 0.6 + _intMod + 20 + (random() - 0.5) * 20);
        c.military = clamp(c.military, 10, 95);
      }
      // 初始化政务能力（若缺失）
      if (c.administration === undefined) {
        c.administration = Math.round(((c.intelligence || 50) * 0.5 + 25) * (0.8 + random() * 0.4));
        c.administration = clamp(c.administration, 10, 95);
      }
      // 初始化魅力值（若缺失，根据已有属性推算）
      if (c.charisma === undefined) {
        c.charisma = Math.round(((c.intelligence || 50) + (c.loyalty || 50)) / 2 * (0.8 + random() * 0.4));
        c.charisma = clamp(c.charisma, 10, 95);
      }
      // 初始化外交值（若缺失，根据已有属性推算）
      if (c.diplomacy === undefined) {
        c.diplomacy = Math.round(((c.charisma || 50) + (c.intelligence || 50)) / 2 * (0.8 + random() * 0.4));
        c.diplomacy = clamp(c.diplomacy, 10, 95);
      }
      // 初始化家族（若缺失，从姓氏提取——开局后由AI丰富为郡望格式）
      if (!c.family) {
        var _nameStr = c.name || '';
        var _compSurnames = ['\u53F8\u9A6C','\u8BF8\u845B','\u4E0A\u5B98','\u6B27\u9633','\u7687\u752B','\u4EE4\u72D0','\u592A\u53F2','\u5B87\u6587','\u957F\u5B59','\u6148\u79A7','\u53F8\u5F92','\u7AEF\u6728','\u4E07\u4FDF','\u767E\u91CC','\u5C09\u8FDF','\u547C\u5EF6','\u5B8C\u989C','\u8D6B\u8FDE','\u72EC\u5B64','\u6155\u5BB9','\u62D3\u8DCB','\u5148\u8F9C','\u5CB3\u98DE','\u52A0\u5F00','\u4E2D\u5C71'];
        var _surname = '';
        for (var _si = 0; _si < _compSurnames.length; _si++) {
          if (_nameStr.indexOf(_compSurnames[_si]) === 0) { _surname = _compSurnames[_si]; break; }
        }
        if (!_surname && _nameStr.length >= 2) _surname = _nameStr.charAt(0);
        if (_surname) c.family = _surname + '\u6C0F';
      }
      // 初始化门第等级（若缺失）
      // familyTier: 'imperial'=皇族宗室 | 'noble'=世家大族 | 'gentry'=地方士族 | 'common'=寒门
      if (!c.familyTier) {
        if (c.isPlayer) c.familyTier = 'imperial';
        else if (c.title && /王|公|侯|伯/.test(c.title)) c.familyTier = 'noble';
        else c.familyTier = 'common'; // 默认寒门，开局后由AI丰富
      }
      // 初始化事件观感数组（若缺失）
      if (!c._eventOpinions) c._eventOpinions = [];
      // 初始化后宫/配偶字段（若缺失）
      // spouse: 是否为玩家配偶  spouseRank: 位份  children: 子女名  motherClan: 母族
      if (c.spouse === undefined) c.spouse = false;
      if (c.spouse && !c.spouseRank) c.spouseRank = 'consort';
      if (!c.children) c.children = [];
      if (!c.parentOf) c.parentOf = null; // 该角色是谁的子女
    });
  }

  // ── 标记玩家角色 & 玩家势力 ──
  (function _markPlayer() {
    var pi = P.playerInfo;
    if (!pi) return;
    var pName = (pi.characterName || '').trim();
    var fName = (pi.factionName || '').trim();

    // 1) 在 GM.chars 中找到玩家角色并标记 isPlayer
    if (pName && GM.chars) {
      var found = false;
      // 容错(跨剧本根治)：playerInfo.characterName 可能带注解(如绍宋"赵构(穿越者赵玖)")·与人物名"赵构"对不上→
      // 否则 2696 会误建一个空壳重复玩家角色(真角色的家谱/关系/记忆全废)+ 玩家势力派生失效(officeTree/阶层党派过滤不跑→显全势力)。剥括注重匹配。
      var pNameAlt = pName.replace(/[（(].*$/, '').trim();
      GM.chars.forEach(function(c) { c.isPlayer = false; }); // 先清除旧标记
      for (var _pi = 0; _pi < GM.chars.length; _pi++) {
        if (GM.chars[_pi].name === pName || (pNameAlt && pNameAlt !== pName && GM.chars[_pi].name === pNameAlt)) {
          GM.chars[_pi].isPlayer = true;
          // 同步 playerInfo 的详细字段到角色对象（角色对象优先，playerInfo补缺）
          if (!GM.chars[_pi].age && pi.characterAge) GM.chars[_pi].age = pi.characterAge;
          if (!GM.chars[_pi].gender && pi.characterGender) GM.chars[_pi].gender = pi.characterGender;
          if (!GM.chars[_pi].personality && pi.characterPersonality) GM.chars[_pi].personality = pi.characterPersonality;
          if (!GM.chars[_pi].title && pi.characterTitle) GM.chars[_pi].title = pi.characterTitle;
          if (!GM.chars[_pi].faction && pi.characterFaction) GM.chars[_pi].faction = pi.characterFaction;
          if (!GM.chars[_pi].faction && fName) GM.chars[_pi].faction = fName;
          if (!GM.chars[_pi].bio && pi.characterBio) GM.chars[_pi].bio = pi.characterBio;
          if (!GM.chars[_pi].desc && pi.characterDesc) GM.chars[_pi].desc = pi.characterDesc;
          if (!GM.chars[_pi].faith && pi.characterFaith) GM.chars[_pi].faith = pi.characterFaith;
          if (!GM.chars[_pi].culture && pi.characterCulture) GM.chars[_pi].culture = pi.characterCulture;
          if (!GM.chars[_pi].appearance && pi.characterAppearance) GM.chars[_pi].appearance = pi.characterAppearance;
          if (!GM.chars[_pi].charisma && pi.characterCharisma) GM.chars[_pi].charisma = parseInt(pi.characterCharisma) || 60;
          found = true;
          break;
        }
      }
      // 角色列表中没有玩家角色 → 自动创建
      if (!found) {
        var newChar = {
          name: pName, title: pi.characterTitle || '', faction: pi.characterFaction || fName || '',
          age: pi.characterAge || '', gender: pi.characterGender || '男',
          personality: pi.characterPersonality || '', bio: pi.characterBio || '',
          desc: pi.characterDesc || '', faith: pi.characterFaith || '', culture: pi.characterCulture || '',
          appearance: pi.characterAppearance || '', charisma: parseInt(pi.characterCharisma) || 60,
          diplomacy: parseInt(pi.characterDiplomacy) || 50,
          loyalty: 100, morale: 80, ambition: 50, benevolence: 50, intelligence: 60, valor: 50,
          isPlayer: true, isHistorical: true, alive: true, stress: 0
        };
        GM.chars.push(newChar);
        GM.allCharacters.push({
          name: newChar.name, title: newChar.title, age: newChar.age || '?', gender: newChar.gender,
          personality: newChar.personality, desc: newChar.desc, loyalty: 100, faction: newChar.faction,
          recruited: true, recruitTurn: 0, source: '初始'
        });
      }
    }

    // 2) 在 GM.facs 中标记玩家势力
    if (fName && GM.facs) {
      for (var _fi = 0; _fi < GM.facs.length; _fi++) {
        if (GM.facs[_fi].name === fName) {
          GM.facs[_fi].isPlayer = true;
          // 补全势力字段
          if (!GM.facs[_fi].leader && pi.factionLeader) GM.facs[_fi].leader = pi.factionLeader;
          if (!GM.facs[_fi].desc && pi.factionDesc) GM.facs[_fi].desc = pi.factionDesc;
          break;
        }
      }
    }

    // 人物势力绑定根治（通用·跨剧本）：把每个人物的 factionId 与 faction 名串补齐、双向对齐。
    // 此前人物多只靠 faction 名串关联（天启仅 48% 有 factionId）→名串是唯一锚、脆弱：势力改名/改换门庭即断。
    // 开局锚定 id+名，后续改换门庭(allegiance)、roster 归属、关系分发都有稳固双锚。
    (function _bindCharFactions(){
      if (!GM.chars || !GM.facs) return;
      var byName = {}, byId = {};
      GM.facs.forEach(function(f){ if (f) { if (f.name) byName[f.name] = f; if (f.id) byId[f.id] = f; } });
      var fixed = 0;
      GM.chars.forEach(function(ch){
        if (!ch) return;
        var fname = ch.faction || ch.factionName;
        if (fname && !ch.factionId) { var f = byName[fname] || byId[fname]; if (f && f.id) { ch.factionId = f.id; fixed++; } }
        if (ch.factionId && !ch.faction) { var f2 = byId[ch.factionId]; if (f2 && f2.name) { ch.faction = f2.name; fixed++; } }
        if (ch.factionId && ch.faction && byId[ch.factionId] && byId[ch.factionId].name !== ch.faction) { ch.faction = byId[ch.factionId].name; fixed++; }
      });
      if (fixed && typeof _dbg === 'function') _dbg('[绑定] 人物势力 factionId↔名 补齐对齐 ' + fixed + ' 处');
    })();

    // 2.5) 同好之谊·开局亲疏种子(owner 2026-06)：同势力且共享≥3雅好者=知音·开局即有亲疏。
    //   喂运行时 AffinityMap(GM.affinityMap)·被主推演 npc-hearts 盟友列表(top3·|值|≥20可见)+endturn-ai决策(_favA)+常朝/廷议消费——
    //   故为活字段·非孤立。与静态 894 关系互补(此为动态亲疏层)。仅同势力(相识 proxy)·门槛≥3共好(知音级·实测约389对·不撑爆affinityMap)·跨朝代任何剧本受益。
    (function _seedHobbyAffinity(){
      if (typeof AffinityMap === 'undefined' || !AffinityMap.add || !GM.chars) return;
      function hset(x){
        var h = x && x.hobbies; if (!h) return null;
        var arr = Array.isArray(h) ? h : (typeof h === 'string' ? h.split(/[、,，·\/;；]/) : []);
        var s = {}, n = 0;
        arr.forEach(function(v){ v = ('' + v).trim(); if (v && !s[v]) { s[v] = 1; n++; } });
        return n ? s : null;
      }
      var byFac = {};
      GM.chars.forEach(function(ch){ if (!ch || ch.alive === false || ch.dead) return; var f = ch.faction || ch.factionId || ch.factionName; if (!f) return; (byFac[f] = byFac[f] || []).push(ch); });
      var seeded = 0;
      Object.keys(byFac).forEach(function(fk){
        var arr = byFac[fk], sets = arr.map(hset);
        for (var i = 0; i < arr.length; i++) {
          if (!sets[i]) continue;
          for (var j = i + 1; j < arr.length; j++) {
            if (!sets[j]) continue;
            var sh = 0; for (var k in sets[i]) { if (sets[j][k]) sh++; }
            if (sh >= 3) { AffinityMap.add(arr[i].name, arr[j].name, Math.min(sh, 4) * 7, '同好之谊'); seeded++; }
          }
        }
      });
      if (seeded && typeof _dbg === 'function') _dbg('[同好] 开局共好亲疏种子 ' + seeded + ' 对(同势力·≥3雅好)');
    })();

    // 3) 设置 GM.playerCharacterId
    if (pName && GM.chars) {
      var pc = GM.chars.find(function(c) { return c.name === pName; }) || GM.chars.find(function(c) { return c.isPlayer; });
      if (pc) GM.playerCharacterId = pc.id || pc.name || pName;
      // 官制按玩家势力归属（根治：GM.officeTree 原为整个 scenario.officeTree·多势力剧本会串其他势力官职）
      var _pf = pc ? (pc.faction || pc.factionName) : null;
      if (_pf && GM.officeTree && GM.officeTree.length) {
        var _fac = (GM.facs || []).find(function(f) { return f.name === _pf || f.id === _pf; });
        if (_fac && Array.isArray(_fac.officeTree) && _fac.officeTree.length) {
          // 方案C 主路径：每势力官制分存于 faction.officeTree（天启格式·无 faction 字段）
          GM.officeTree = deepClone(_fac.officeTree);
        } else if (GM.officeTree.some(function(o) { return o.faction; })) {
          // 过渡兼容：顶层 officeTree 带 faction 字段→只留玩家势力的
          var _own = GM.officeTree.filter(function(o) { return o.faction === _pf; });
          if (_own.length) GM.officeTree = _own;
        }
        // 顶层 officeTree 无 faction（天启单势力）→ 保持全部·不变
      }
      // 阶层/党派按玩家势力归属（根治：GM.classes/parties 原为整个 scenario 全势力混渲·多势力剧本开局显 250 阶层/150 党派=灾难·同 officeTree 病）
      if (_pf) {
        if (Array.isArray(GM.classes) && GM.classes.length) {
          var _ownCls = GM.classes.filter(function(c) { return c && (c.faction === _pf || c.factionId === _pf); });
          if (_ownCls.length) GM.classes = _ownCls; // 守卫：过滤后非空才替换·天启单势力(无faction或全匹配)不受影响
        }
        if (Array.isArray(GM.parties) && GM.parties.length) {
          var _ownPty = GM.parties.filter(function(p) { return p && (p.faction === _pf || p.factionId === _pf || p.crossFaction); });
          if (_ownPty.length) GM.parties = _ownPty;
        }
      }
    }
  })();

  // 初始化家族注册表 + 从剧本加载 sc.families（根治）。
  // 此前仅初始化空对象·剧本定义的 families 数组从不加载→updateFamilyRenown/GM.families[name] 消费恒空。
  // 补后所有剧本一致·向后兼容：无 sc.families 则不变；已存在的 name 不覆盖。
  if (!GM.families) GM.families = {};
  if (Array.isArray(sc.families)) {
    sc.families.forEach(function(f) {
      if (f && f.name && !GM.families[f.name]) {
        var fam = deepClone(f);
        if (typeof fam.renown !== 'number') fam.renown = (typeof fam.prestige === 'number') ? fam.prestige : 50;
        GM.families[f.name] = fam;
      }
    });
  }

  // S6b·人才范式渗透引擎·剧本 preset（既有正统 label/初始 stock·design §2.3·仿 families 分发）。
  //   flag talentCohortEnabled 关 → 不播种（零回归）；跨朝代：范式名取剧本，引擎不预设任何「学」。不重复立。
  //   sc.talentParadigms = [{label, kind:'established'|'emergent', stock, influenceProfile?, absorptionKind?, maturityTurns?}]
  (function _seedTalentParadigms(){
    try {
      var TC = (typeof TM !== 'undefined' && TM.TalentCohorts) || (typeof window !== 'undefined' && window.TM && window.TM.TalentCohorts);
      if (!TC || typeof TC.enabled !== 'function' || !TC.enabled(P)) return;
      var presets = sc.talentParadigms || sc.talentCohorts;
      if (!Array.isArray(presets) || !presets.length) return;
      TC.init(GM, P);
      presets.forEach(function(pd){
        if (!pd || !pd.label || TC.findParadigm(GM, pd.label)) return;
        TC.registerParadigm(GM, {
          label: pd.label, kind: (pd.kind === 'emergent') ? 'emergent' : 'established',
          stock: pd.stock, influenceProfile: pd.influenceProfile, absorptionKind: pd.absorptionKind, maturityTurns: pd.maturityTurns
        });
      });
    } catch(_e){}
  })();

  // 剧本 relations 数组（from/to）分发到人物 ch.relations（根治）。
  // 此前剧本 relations 只进坏的 GM.rels[r.name]（relations 无 name 字段→key undefined·63条全覆盖成1条），
  // 而 getTopRelations/summarizeRelation 读的是人物自带 ch.relations·二者脱节→剧本人际关系在 AI 推演中恒空。
  // 双向分发·字段映射(value→hostility/conflictLevel·type→labels)·向后兼容：人物已有 ch.relations[other] 不覆盖。
  (function _dispatchScenarioRelations(){
    var _scRels = (sc.relations || []);
    if (!_scRels.length || !GM.chars) return;
    var _byName = {};
    GM.chars.forEach(function(c){ if (c && c.name) _byName[c.name] = c; });
    var _put = function(owner, other, r, hostility, conflictLevel){
      var c = _byName[owner]; if (!c) return;
      if (!c.relations) c.relations = {};
      if (c.relations[other]) return; // 不覆盖人物自带关系
      c.relations[other] = {
        affinity: (typeof r.affinity === 'number') ? r.affinity : 50,
        trust: (typeof r.trust === 'number') ? r.trust : 50,
        respect: (typeof r.respect === 'number') ? r.respect : 50,
        fear: (typeof r.fear === 'number') ? r.fear : 0,
        hostility: hostility, conflictLevel: conflictLevel,
        labels: r.type ? [r.type] : [], desc: r.desc || '',
        history: [], _fromScenario: true
      };
    };
    _scRels.forEach(function(r){
      if (!r || !r.from || !r.to) return;
      var hostility = (typeof r.value === 'number' && r.value < 0) ? Math.min(100, -r.value) : 0;
      var conflictLevel = (r.value <= -40) ? 2 : (r.value < -15 ? 1 : 0);
      _put(r.from, r.to, r, hostility, conflictLevel);
      _put(r.to, r.from, r, hostility, conflictLevel);
    });
  })();

  // 初始化后宫/继承系统数据
  if (!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
  if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
  // 从剧本加载后宫配置
  if (sc && sc.haremConfig) GM.harem = Object.assign(GM.harem, deepClone(sc.haremConfig));

  // ── 官制任职者自动匹配 ──
  // 角色的 title/officialTitle 与 officeTree.positions.holder 双向同步
  if (GM.officeTree && GM.officeTree.length > 0 && GM.chars && GM.chars.length > 0) {
    var _syncCount = 0;
    // 1) position有holder但角色没officialTitle → 设角色officialTitle
    // 2) position无holder但角色title匹配某职位名 → 填充holder
    (function _syncOffice(nodes) {
      nodes.forEach(function(dept) {
        (dept.positions || []).forEach(function(pos) {
          if (pos.holder || (Array.isArray(pos.actualHolders) && pos.actualHolders.length)) {
            // 职位已有人 → 确保该角色知道自己的官职；兼任者保留主职并写入 concurrentTitles
            var _holders = [];
            if (typeof _offAllHolders === 'function') {
              try { _holders = _offAllHolders(pos) || []; } catch(_) { _holders = []; }
            }
            if (!_holders.length && pos.holder) _holders = [pos.holder];
            _holders.forEach(function(_hn, _idx) {
              var ch = GM.chars.find(function(c) { return c.name === _hn && c.alive !== false; });
              if (!ch) return;
              if (typeof _offAddCharOfficeTitle === 'function') _offAddCharOfficeTitle(ch, pos.name, { concurrent: _idx > 0 || !!ch.officialTitle });
              else if (!ch.officialTitle) ch.officialTitle = pos.name;
              _syncCount++;
            });
          } else {
            // 职位空缺 → 从角色的title/officialTitle中寻找匹配
            var posName = pos.name || '';
            if (!posName) return;
            var matched = GM.chars.find(function(c) {
              if (c.alive === false) return false;
              // officialTitle精确匹配
              if (c.officialTitle && c.officialTitle === posName) return true;
              // title中包含职位名（如title="尚书令·xx"包含pos.name="尚书令"）
              if (c.title && c.title.indexOf(posName) >= 0) return true;
              // title直接就是职位名
              if (c.title && c.title === posName) return true;
              return false;
            });
            if (matched) {
              pos.holder = matched.name;
              if (!matched.officialTitle) matched.officialTitle = posName;
              _syncCount++;
            }
          }
        });
        if (dept.subs) _syncOffice(dept.subs);
      });
    })(GM.officeTree);
    if (_syncCount > 0) _dbg('[Office] 自动匹配官制任职者 ' + _syncCount + ' 处');
  }

  // 单一真相源:开局去重人物+从树回填officialTitle+派生任职者(与读档一致)
  try { if (typeof _offSyncHoldersFromChars === 'function') _offSyncHoldersFromChars({ importSeats: true, dedupChars: true, force: true }); } catch (_e) {}

  // 构建索引系统（性能优化）
  showLoading('\u6784\u5EFA\u7D22\u5F15...', 50);
  if(typeof buildIndices === 'function') buildIndices();

  // 初始化 AI 缓存系统
  if(typeof initAICache === 'function') initAICache();

  // 初始化 Unit 系统
  if (P.unitSystem && P.unitSystem.enabled && typeof initUnitSystem === 'function') {
    initUnitSystem();
  }

  // 初始化补给系统（可从battleConfig.supplyConfig或P.supplySystem触发）
  if (P.battleConfig && P.battleConfig.supplyConfig && P.battleConfig.supplyConfig.enabled) {
    if (!P.supplySystem) P.supplySystem = {};
    P.supplySystem.enabled = true;
  }
  if (P.supplySystem && P.supplySystem.enabled && typeof initSupplySystem === 'function') {
    initSupplySystem();
  }

  // 初始化建筑系统
  if (P.buildingSystem && P.buildingSystem.enabled && typeof initBuildingSystem === 'function') {
    showLoading('\u521D\u59CB\u5316\u5EFA\u7B51\u4E0E\u7ECF\u6D4E...', 70);
    initBuildingSystem();
  }

  // 初始化地图系统
  if(typeof initGameMap === 'function') initGameMap();
  // 构建邻接图（供行军/补给寻路使用）
  if(P.map && P.map.enabled && typeof buildAdjacencyGraph === 'function') buildAdjacencyGraph();

  // 初始化省级经济系统
  showLoading('\u521D\u59CB\u5316\u5730\u65B9\u533A\u5212...', 85);
  if(typeof initProvinceEconomy === 'function') initProvinceEconomy();

  // 初始化得罪群体系统
  if(typeof OffendGroupsSystem !== 'undefined' && OffendGroupsSystem.initialize) OffendGroupsSystem.initialize();

  // 初始化状态耦合系统
  if(typeof StateCouplingSystem !== 'undefined' && StateCouplingSystem.initialize) StateCouplingSystem.initialize();

  // 初始化集权回拨系统
  if(typeof CentralizationSystem !== 'undefined' && CentralizationSystem.initialize) CentralizationSystem.initialize();

  // 初始化领地产出系统
  if(typeof TerritoryProductionSystem !== 'undefined' && TerritoryProductionSystem.initialize) TerritoryProductionSystem.initialize();

  // 初始化职位系统
  if(typeof PositionSystem !== 'undefined' && PositionSystem.initialize) PositionSystem.initialize();


  _$("launch").style.display="none";_$("bar").style.display="flex";_$("bar-btns").innerHTML="";_$("G").style.display="grid";_$("E").style.display="none";
  _$("shiji-btn").classList.add("show");_$("save-btn").classList.add("show");

  _tmStartRepairRuntimeData(sid, sc, 'before-start-hook');
  _tmStartPrimeFormalRuntime(sid, sc, 'before-start-hook');
  GameHooks.run('startGame:after', sid);

  // 5.1: 剧本完整度预检（非阻断式警告）
  var _checkWarnings = [];
  if (!GM.chars || GM.chars.length < 3) _checkWarnings.push('\u89D2\u8272\u4E0D\u8DB3\uFF08\u5F53\u524D' + (GM.chars ? GM.chars.length : 0) + '\u4EBA\uFF0C\u5EFA\u8BAE\u22655\uFF09');
  if (!GM.chars || !GM.chars.some(function(c){return c.isPlayer;})) _checkWarnings.push('\u672A\u8BBE\u7F6E\u73A9\u5BB6\u89D2\u8272');
  if (!GM.facs || GM.facs.length === 0) _checkWarnings.push('\u672A\u8BBE\u7F6E\u52BF\u529B');
  if (!GM.vars || Object.keys(GM.vars).length === 0) _checkWarnings.push('\u672A\u5B9A\u4E49\u53D8\u91CF\uFF08\u56FD\u5E93/\u5A01\u671B/\u6C11\u5FC3\u7B49\uFF09');
  if (!P.time || !P.time.year) _checkWarnings.push('\u672A\u8BBE\u7F6E\u5F00\u59CB\u5E74\u4EFD');
  if (!GM.officeTree || GM.officeTree.length === 0) _checkWarnings.push('\u672A\u8BBE\u7F6E\u5B98\u5236');
  if (_checkWarnings.length > 0) {
    console.warn('[ScenarioCheck]', _checkWarnings.join('; '));
    // 在起居注中记录警告
    if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: 0, date: '\u5F00\u5C40\u68C0\u67E5', content: '\u3010\u5267\u672C\u4E0D\u5B8C\u6574\u8B66\u544A\u3011' + _checkWarnings.join('\uFF1B') });
  }

  // 确保所有字段有默认值
  if (typeof _ensureGMDefaults === 'function') _ensureGMDefaults();
  if (typeof _ensurePDefaults === 'function') _ensurePDefaults();
  // 清理新游戏时的旧会话数据
  if (typeof ChangeLog !== 'undefined') ChangeLog.clear();
  if (typeof GameEventBus !== 'undefined') GameEventBus.clear();
  if (typeof DecisionRegistry !== 'undefined') DecisionRegistry.loadFromConfig();
  if (typeof PromptLayerCache !== 'undefined') PromptLayerCache.clear();
  if (typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.reset();

  // ── 逻辑审查：AI检查剧本数据中的矛盾冲突并自动修正 ──
  if (P.ai && P.ai.key && GM.chars && GM.chars.length > 0) {
    (async function() {
      try {
        showLoading('\u903B\u8F91\u5BA1\u67E5\uFF1A\u68C0\u67E5\u5267\u672C\u6570\u636E\u77DB\u76FE...', 90);
        await _logicAuditOnStart(sc);
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'LogicAudit] error:') : console.warn('[LogicAudit] error:', e); }

      // AI深度预热（剧本标 isFullyDetailed 时内部跳过·用剧本文本兜底）
      if (typeof aiDeepReadScenario === 'function') {
        try {
          await aiDeepReadScenario();
        } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'DeepRead in doActualStart] error:') : console.warn('[DeepRead in doActualStart] error:', e); }
      }
      // 三项推演规划·并行发射（节省等待）·各 1 次 AI：
      //   · aiPlanScenarioForInference: NPC 议程/危机分岔/行文指纹
      //   · aiPlanFactionMatrix: 势力关系矩阵/轨迹/黑天鹅
      //   · aiPlanFirstTurnEvents: 首 3 回合候选事件池
      showLoading('\u89C4\u5212\u63A8\u6F14\u9519\u70B9\u00B7\u5E76\u884C 3 \u9879\u2026', 92);
      try {
        await Promise.all([
          (typeof aiPlanScenarioForInference === 'function') ? aiPlanScenarioForInference().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiPlan') : console.warn('[aiPlan]', e); }) : Promise.resolve(),
          (typeof aiPlanFactionMatrix === 'function') ? aiPlanFactionMatrix().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiFacMatrix') : console.warn('[aiFacMatrix]', e); }) : Promise.resolve(),
          (typeof aiPlanFirstTurnEvents === 'function') ? aiPlanFirstTurnEvents().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiFTE') : console.warn('[aiFTE]', e); }) : Promise.resolve()
        ]);
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '3 plans parallel') : console.warn('[3 plans parallel]', e); }
      showLoading('\u751F\u6210\u521D\u59CB\u594F\u758F...', 98);
      _tmStartRepairRuntimeData(sid, sc, 'before-enter-api');
      _tmStartPrimeFormalRuntime(sid, sc, 'before-enter-api');
      generateMemorials();
      hideLoading();
      enterGame();
      _tmStartRefreshFormalShell();
    })();
  } else {
    showLoading('\u8FDB\u5165\u6E38\u620F\u4E16\u754C...', 95);
    _tmStartRepairRuntimeData(sid, sc, 'before-enter-local');
    _tmStartPrimeFormalRuntime(sid, sc, 'before-enter-local');
    generateMemorials();
    setTimeout(function(){hideLoading();enterGame();_tmStartRefreshFormalShell();},100);
  }
  var hd=_$("qiju-history");if(hd&&sc)hd.innerHTML="<div class=\"qiju-record\"><div class=\"qiju-turn\">"+getTS(1)+" \u5F00\u7BC7</div><div class=\"nt\">"+sc.opening+"</div></div>";

  // 初始化科举制度（由AI判断是否启用）
  initKejuSystem(sc);

  if(!GM.officeTree||GM.officeTree.length===0){
    _showOfficeStartModal();
    return;
  }
  toast("第1回合");
}

// 奏议批复写入纪事本末
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子2）

// ============================================================

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
      useTinyiV3: { on: '已启用廷议 v3 (默认·8 阶段·新框架)', off: '已关闭 v3·退回 v2 廷议 (简陋·5 阶段·已加 ChronicleTracker/ClassEngine 集成 fallback)' },
      rigidHistEventsOff: { on: '已关闭注定史实事件·演义模式下史实人物的注定命运（如史实死亡）不再自动触发', off: '已恢复注定史实事件·演义模式下史实注定命运照常触发（轻度/严格史实模式一向照旧）' }
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
  h += '<div class="tm-settings-sub">殿乐与音效总调度；曲库可自备乐曲，导入后本机常存。</div>';
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
  // 2026-07-04 导入音乐入典章声乐页：接 AudioSystem.importUserMusic 既有引擎（IndexedDB blob·本机持久）
  if (typeof A.importUserMusic === 'function') {
    h += '<div class="tm-settings-audio-actions"><button type="button" class="bt bs" onclick="_settingsAudioImport()">导 入 音 乐</button><span class="tm-settings-audio-hint">自备乐曲入库常奏 · 存于本机（mp3 / ogg / wav 等）</span></div>';
  }
  h += '<div class="tm-settings-track-list">';
  if (tracks.length) {
    tracks.forEach(function(t) {
      var active = current && current.id === t.id;
      var safeId = String(t.id).replace(/'/g, "\\'");
      var del = t.user ? '<i class="tm-settings-track-del" title="移出曲库" onclick="event.stopPropagation();event.preventDefault();_settingsAudioRemoveTrack(\'' + safeId + '\')">✕</i>' : '';
      h += '<button class="tm-settings-track ' + (active ? 'active' : '') + '" data-track-id="' + _settingsEsc(t.id) + '" onclick="_settingsAudioPlayTrack(\'' + safeId + '\')"><span>' + _settingsEsc(t.title) + '</span><em>' + _settingsEsc(t.meta || 'BGM') + '</em>' + del + '</button>';
    });
  } else {
    h += '<div class="tm-settings-empty">曲库尚虚。点「导入音乐」，自备乐曲即可入库常奏。</div>';
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
// 2026-07-04 典章声乐·导入音乐：自建 picker（AudioSystem._pickMusicFiles 的 onDone 刷的是游戏内音声侧栏·
// 设置页须刷自己）·导入/移除后重开设置（activeTab 有 localStorage 记忆·回到声乐页）
window._settingsAudioImport = function() {
  var A = window.AudioSystem;
  if (!A || typeof A.importUserMusic !== 'function') return;
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'audio/*';
  inp.multiple = true;
  inp.style.display = 'none';
  inp.onchange = function() {
    if (!inp.files || !inp.files.length) return;
    A.importUserMusic(inp.files, function() {
      try { if (typeof toast === 'function') toast('乐曲已入库'); } catch(_){}
      try { closeSettings(); openSettings(); } catch(_){}
      try { if (window.TM && TM.UI && TM.UI.shell && typeof TM.UI.shell.refreshLeft === 'function') TM.UI.shell.refreshLeft(); } catch(_){}
    });
  };
  document.body.appendChild(inp);
  inp.click();
  setTimeout(function(){ try { inp.remove(); } catch(_){} }, 60000);
};
window._settingsAudioRemoveTrack = function(id) {
  if (!window.AudioSystem || typeof AudioSystem.removeUserTrack !== 'function') return;
  AudioSystem.removeUserTrack(id);
  try { if (typeof toast === 'function') toast('已移出曲库'); } catch(_){}
  try { closeSettings(); openSettings(); } catch(_){}
  try { if (window.TM && TM.UI && TM.UI.shell && typeof TM.UI.shell.refreshLeft === 'function') TM.UI.shell.refreshLeft(); } catch(_){}
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
  // 2026-07-04 典章：存钮若嵌在末节内（历史遗留·只有人物志签看得见）→提出来进全签常驻底栏
  if (!saveBtn) saveBtn = body.querySelector('button[onclick*="sSaveAll"]');

  // 2026-07-04 色律统一：节题 emoji 剥除（⚡🧪等彩emoji破纸面「墨·金·朱」色律·节题已有朱菱点·只动 h4 文本节点·行级标记不动）
  sections.forEach(function(section) {
    var _h4 = section.querySelector('h4');
    if (!_h4) return;
    for (var _n = _h4.firstChild; _n; _n = _n.nextSibling) {
      if (_n.nodeType === 3 && _n.nodeValue) _n.nodeValue = _n.nodeValue.replace(/[☀-➿️]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g, '').replace(/^\s+/, '');
    }
  });

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
    // 2026-07-04 设置重置：「实验·进阶」组退役——实验模式并入「系统·更新与实验」·组空即不渲染
    { name: '系统 · 其他', re: /更新|工坊|实验/ }
  ];
  function _settingsGroupOf(title) {
    for (var g = 0; g < _settingsGroups.length; g++) { if (_settingsGroups[g].re.test(title)) return g; }
    return _settingsGroups.length - 1; // 未命中 → 落「系统·其他」（含将来新增分区，不丢）
  }

  // 稀签合并（2026-07-03·治「一签一个开关·半屏空荡」）：小节按主题并入同一 pane（节间距走 CSS）·
  // 左栏少而实。只并版面·不动任何 section 内容与既有控件 id。
  var _settingsMerges = [
    { label: '玩法 · 战斗与亲征', re: /战斗规则|御驾亲征|玩法机制/ },
    { label: '文风 · 游戏模式', re: /^文风|游戏模式/ },
    // 2026-07-04 设置重置二批：治「单签单节·画布七成空」·16→11 签·语义配对·只并版面不动控件
    { label: '界面 · 主题字号', re: /界面显示|主题字号/ },
    { label: 'API · 连接与路由', re: /API连接|次要\s*API/ },
    { label: '性能 · 成本与预算', re: /性能·成本|预算与档位/ },
    { label: 'AI · 记忆与字数', re: /AI记忆|AI生成字数/ },
    { label: '系统 · 更新与实验', re: /更新与工坊|实验模式/ }
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

  // 二遍：按分组顺序渲染左栏目次（组内保持原顺序），组首插组标题。
  // 2026-07-04 典章重做：编号退役·改「卷首字印」（签名首个汉字入圈印·印色随分组 data-settings-group）
  for (var _gi = 0; _gi < _settingsGroups.length; _gi++) {
    var _groupEntries = _settingsEntries.filter(function(e) { return e.group === _gi; });
    if (!_groupEntries.length) continue;
    var _gh = document.createElement('div');
    _gh.className = 'settings-tab-group';
    _gh.setAttribute('data-settings-group', String(_gi));
    _gh.textContent = _settingsGroups[_gi].name;
    tabs.appendChild(_gh);
    _groupEntries.forEach(function(e) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'settings-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('data-settings-tab', e.key);
      tab.setAttribute('data-settings-group', String(_gi));
      tab.setAttribute('onclick', "_settingsSwitchTab('" + e.key + "')");
      var _glyph = (String(e.label).match(/[一-鿿]/) || ['·'])[0];
      tab.innerHTML = '<span class="settings-tab-glyph">' + _settingsEsc(_glyph) + '</span><span class="settings-tab-label">' + _settingsEsc(e.label) + '</span>';
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
  // 顺手清旧键 tianming_font_size（tm-audio-theme.js 旧 A+/A- 面板遗留）——它曾在开局时把根字号改回旧值
  try { localStorage.setItem('tm.uiFontScale', String(v)); localStorage.removeItem('tianming_font_size'); } catch(_){}
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

// ── 服务商预设（2026-07-10·13 家 OpenAI 兼容 + 自定义）─────────────────
// 选中只自动填地址（2026-07-11 owner 拍板：Model_ID 玩家自填·示例仅作文字提示·model 字段只供提示文案引用）。
// 请求格式无须在此区分——
// tm-ai-infra 的 _detectAIProvider 按 URL/模型名自动嗅探（anthropic 原生 / gemini / OAI 兼容）。
// Azure OpenAI 路径结构特殊（/openai/deployments/{名}/chat/completions?api-version=…+api-key 头），不入预设。
window.TM_PROVIDER_PRESETS = {
  deepseek:    { name:'DeepSeek',         url:'https://api.deepseek.com/v1',                             model:'deepseek-chat',           keyHint:'platform.deepseek.com → API Keys' },
  volcano:     { name:'火山方舟·豆包',    url:'https://ark.cn-beijing.volces.com/api/v3',                model:'doubao-seed-1-6-251015',  keyHint:'火山引擎控制台 → 方舟 → API Key 管理（Key 以 ark- 开头）',
                 modelHint:'方舟「Model_ID」两种填法二选一：① 模型名（如 doubao-seed-1-6-251015）；② <b>推理接入点 ID（ep- 开头）</b>——在方舟控制台「在线推理 → 接入点」页复制，原样填进 Model_ID 栏即可' },
  kimi:        { name:'Kimi·月之暗面',    url:'https://api.moonshot.cn/v1',                              model:'kimi-k2',                 keyHint:'platform.moonshot.cn → API Keys' },
  qwen:        { name:'通义千问',         url:'https://dashscope.aliyuncs.com/compatible-mode/v1',       model:'qwen-plus',               keyHint:'阿里云百炼控制台 → API-KEY' },
  zhipu:       { name:'智谱 GLM',         url:'https://open.bigmodel.cn/api/paas/v4',                    model:'glm-4.5',                 keyHint:'open.bigmodel.cn → API Keys' },
  qianfan:     { name:'百度千帆',         url:'https://qianfan.baidubce.com/v2',                         model:'ernie-4.5-turbo-128k',    keyHint:'百度智能云千帆控制台 → API Key' },
  siliconflow: { name:'硅基流动',         url:'https://api.siliconflow.cn/v1',                           model:'deepseek-ai/DeepSeek-V3', keyHint:'cloud.siliconflow.cn → API 密钥' },
  openrouter:  { name:'OpenRouter',       url:'https://openrouter.ai/api/v1',                            model:'deepseek/deepseek-chat',  keyHint:'openrouter.ai → Keys' },
  openai:      { name:'OpenAI',           url:'https://api.openai.com/v1',                               model:'gpt-4o',                  keyHint:'platform.openai.com → API keys' },
  gemini:      { name:'Gemini·谷歌',      url:'https://generativelanguage.googleapis.com/v1beta/openai', model:'gemini-3.5-flash',        keyHint:'aistudio.google.com → Get API key' },
  anthropic:   { name:'Claude·Anthropic', url:'https://api.anthropic.com/v1',                            model:'claude-sonnet-4-6',       keyHint:'console.anthropic.com → API Keys' },
  groq:        { name:'Groq',             url:'https://api.groq.com/openai/v1',                          model:'llama-3.3-70b-versatile', keyHint:'console.groq.com → API Keys' },
  ollama:      { name:'Ollama·本机',      url:'http://localhost:11434/v1',                               model:'llama3.1',                keyHint:'本机跑 ollama 无需注册·Key 随便填个占位（如 ollama）' },
  custom:      { name:'自定义',           url:'',                                                        model:'',                        keyHint:'' }
};
function _sProvOptions(){
  var h=''; for (var k in TM_PROVIDER_PRESETS){ h+='<option value="'+k+'">'+TM_PROVIDER_PRESETS[k].name+'</option>'; } return h;
}
// 未配置判定（2026-07-11 owner 拍板「默认全空·只显提示」）：无 Key 且地址/模型仍是出厂 OpenAI 默认值
// （tm-data-model.js P.ai 初始值）→ 视为从未配置，各栏显示空 + placeholder；动过任一项即照实回显。
function _sAiVirgin(){
  try {
    var a = (typeof P!=='undefined' && P.ai) || {};
    var facU='https://api.openai.com/v1/chat/completions', facM='gpt-4o';
    return !a.key && (!a.url || a.url===facU) && (!a.model || a.model===facM);
  } catch(_) { return false; }
}
window.sProvPreset = function(v, sec){
  var p = TM_PROVIDER_PRESETS[v];
  if (!p || !p.url) return; // 自定义/未知：不动已填内容
  var u = _$(sec ? 's-sec-url' : 's-url'), m = _$(sec ? 's-sec-model' : 's-model');
  if (u) u.value = p.url;
  // 2026-07-11 owner 拍板：预设只填地址·Model_ID 一律玩家自填（自动填示例模型名会误导接入点玩家——
  // 方舟等家的 Model_ID 是 ep- 接入点 ID·不是 LLM 名称）。示例只以文字提示·不进输入框。
  if (m && p.modelHint) m.title = p.modelHint.replace(/<[^>]+>/g, '');
  var st = _$(sec ? 's-sec-status' : 's-status');
  if (st) st.innerHTML = '已填入 <b>' + p.name + '</b> 的地址。Key 与 Model_ID 请自行填写'
    + (p.keyHint ? '——Key 去这里拿：' + p.keyHint : '')
    + (p.model && !p.modelHint ? '；Model_ID 参考：' + p.model : '')
    + '。填完点「测试连接」验证。'
    + (p.modelHint ? '<br>' + p.modelHint : '');
};

openSettings=function(){
  var bg=_$("settings-bg");
  // 2026-07-03 \u8BBE\u7F6E\u9762\u677F\u5347\u7EA7\uFF1A\u5934\u90E8\u52A0\u5168\u6587\u641C\u7D22\uFF08\u6309\u9875\u7B7E\u540D/\u8BF4\u660E\u6587\u5B57\u8FC7\u6EE4\u5DE6\u680F\u00B7\u9996\u4E2A\u547D\u4E2D\u81EA\u52A8\u5207\u5165\uFF09
  // 2026-07-04 \u8BBE\u7F6E\u91CD\u505A\u300C\u5178\u7AE0\u300D\u5168\u5C4F\u9875\uFF1A\u9898\u5934=\u73BA\u5370\u5927\u9898+\u68C0\u7D22+\u8FD4\u56DE\u00B7\u7ED3\u6784\u8D70 .settings-head \u7C7B\uFF08\u64A4 inline style\uFF09
  bg.innerHTML="<div class=\"settings-box\"><div class=\"settings-head\"><div class=\"settings-title\"><span class=\"settings-title-seal\">\u5178</span><div class=\"settings-title-txt\"><b>\u5178\u3000\u7AE0</b><small>\u8BF8 \u822C \u8C03 \u5EA6 \u00B7 \u7686 \u4E8E \u6B64 \u518C</small></div></div><input class=\"settings-search\" id=\"s-search\" placeholder=\"\u68C0\u7D22\u8BBE\u7F6E\u2026\uFF08\u540D\u79F0\u6216\u8BF4\u660E\u6587\u5B57\uFF09\" oninput=\"_settingsFilter(this.value)\"><button class=\"settings-return\" onclick=\"closeSettings()\">\u8FD4 \u56DE</button></div><div class=\"settings-body\" id=\"sb2\"></div></div>";

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
    // 势力活世界·实验(F2·开关 GM._factionLivingWorld·本局存档生效·总闸 OFF=零行为变更)
    (function(){
      var on = false; try { on = !!(typeof GM!=='undefined' && GM && GM._factionLivingWorld); } catch(_){}
      function pill(want, label){ return '<button class="bt '+((on===want)?'bp':'bs')+' bsm" data-slhs="'+(want?1:0)+'" onclick="_tmSetFactionLivingWorld('+want+',this)" style="flex:1;">'+label+'</button>'; }
      return '<div class="settings-section"><h4>势力活世界 · 实验</h4>'
        + '<div style="font-size:0.78rem;color:var(--txt-d);margin:-0.2rem 0 0.4rem;">开启后，列国势力不再只作壁上观：可<b>真宣战/参战</b>（走正当法理·非乱咬）、<b>结盟背刺</b>结出真外交后果、跨回合<b>立志兴事</b>，重大动向<b>入御案时政</b>待陛下应对。默认关（零行为变更），本局存档生效。</div>'
        + '<div style="display:flex;gap:0.3rem;">' + pill(true,'开启 · 活世界') + pill(false,'关闭 · 现状') + '</div>'
        + '</div>';
    })()+
    // API
    "<div class=\"settings-section\"><h4>API\u8FDE\u63A5</h4>"+
    // 2026-07-10 \u65B0\u624B\u6307\u5F15\uFF1A\u5199\u7ED9\u5B8C\u5168\u6CA1\u63A5\u89E6\u8FC7 AI / API \u7684\u73A9\u5BB6\u2014\u2014\u5148\u8BB2\u53BB\u54EA\u5F04\u8D26\u53F7\uFF0C\u518D\u9010\u680F\u8BB2\u600E\u4E48\u586B
    '<div style="font-size:0.75rem;color:var(--txt-d);line-height:1.65;margin:-0.2rem 0 0.55rem;">\u6E38\u620F\u5267\u60C5\u7531 AI \u5927\u6A21\u578B\u63A8\u6F14\uFF0C\u9700\u81EA\u5907\u4E00\u4E2A AI \u63A5\u53E3\u8D26\u53F7\uFF08\u6E38\u620F\u672C\u8EAB\u4E0D\u542B AI \u670D\u52A1\uFF09\u3002\u4ECE\u6CA1\u63A5\u89E6\u8FC7\uFF1F\u7167\u4E09\u6B65\u8D70\uFF1A<b>\u2460 \u6CE8\u518C</b>\u2014\u2014\u6311\u4E00\u5BB6 AI \u670D\u52A1\u5546\u5B98\u7F51\u6CE8\u518C\u8D26\u53F7\uFF08\u5982 DeepSeek\u3001OpenAI\uFF0C\u6216\u4EFB\u4E00 OpenAI \u517C\u5BB9\u4E2D\u8F6C\u7AD9\uFF09\uFF1B<b>\u2461 \u62FF\u5BC6\u94A5</b>\u2014\u2014\u5728\u5176\u5B98\u7F51\u300CAPI Keys\u300D\u9875\u521B\u5EFA\u4E00\u4E2A\u5BC6\u94A5\uFF0C\u5E76\u786E\u4FDD\u8D26\u6237\u6709\u5C11\u91CF\u4F59\u989D\uFF1B<b>\u2462 \u56DE\u6765\u586B</b>\u2014\u2014\u5728\u4E0B\u9762\u300C\u670D\u52A1\u5546\u300D\u91CC\u9009\u4E2D\u4F60\u6CE8\u518C\u7684\u90A3\u5BB6\uFF0C\u5730\u5740\u4F1A\u81EA\u52A8\u586B\u597D\uFF0CModel_ID \u548C Key \u81EA\u5DF1\u586B\u4E0A\uFF0C\u70B9\u300C\u6D4B\u8BD5\u8FDE\u63A5\u300D\u9A8C\u8BC1\uFF0C\u518D\u70B9\u300C\u4FDD\u5B58\u300D\u3002</div>'+
    "<div class=\"rw\"><div class=\"fd\"><label>\u670D\u52A1\u5546\uFF08\u9009\u4E00\u5BB6\u81EA\u52A8\u586B\u5730\u5740\uFF09</label><select id=\"s-prov\" onchange=\"sProvPreset(this.value)\"><option value=\"\">（请选择服务商）</option>"+_sProvOptions()+"</select></div><div class=\"fd\"><label>Key\uFF08API \u5BC6\u94A5\uFF0C\u76F8\u5F53\u4E8E\u5BC6\u7801\u00B7\u52FF\u5916\u6CC4\uFF09</label><input type=\"password\" id=\"s-key\" value=\""+(P.ai.key||"")+"\" placeholder=\"\u5728\u670D\u52A1\u5546\u5B98\u7F51\u300CAPI Keys\u300D\u9875\u521B\u5EFA\uFF0C\u591A\u4EE5 sk- \u5F00\u5934\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u5730\u5740\uFF08Base URL\u00B7\u670D\u52A1\u5546\u7684\u63A5\u53E3\u7F51\u5740\uFF09</label><input id=\"s-url\" value=\""+(_sAiVirgin()?"":(P.ai.url||""))+"\" placeholder=\"\u5982 https://api.deepseek.com/v1\uFF0C\u4E00\u822C\u4EE5 /v1 \u7ED3\u5C3E\"></div><div class=\"fd\"><label>Model_ID</label><input id=\"s-model\" value=\""+(_sAiVirgin()?"":(P.ai.model||""))+"\" placeholder=\"ep-......\u4E0D\u662FLLM\u540D\u79F0\"></div></div>"+
    '<div style="font-size:0.72rem;color:var(--txt-d);line-height:1.6;margin:-0.3rem 0 0.4rem;">\u4E09\u680F\u5185\u5BB9\u90FD\u6765\u81EA\u4F60\u6CE8\u518C\u7684\u670D\u52A1\u5546\uFF1A\u5730\u5740\u89C1\u5176\u6587\u6863\u300CAPI \u63A5\u53E3 / Base URL\u300D\uFF0CModel_ID \u89C1\u5176\u300C\u6A21\u578B\u5217\u8868\u300D\uFF08\u6CE8\u610F\uFF1A\u4E2A\u522B\u670D\u52A1\u5546\u586B\u7684\u4E0D\u662F\u6A21\u578B\u540D\u2014\u2014\u5982\u706B\u5C71\u65B9\u821F\u7528\u63A8\u7406\u63A5\u5165\u70B9\u7684\u73A9\u5BB6\u8981\u586B <b>ep- \u5F00\u5934\u7684\u63A5\u5165\u70B9 ID</b>\uFF0C\u9009\u4E2D\u65B9\u821F\u9884\u8BBE\u4F1A\u6709\u8BE6\u7EC6\u63D0\u793A\uFF09\u3002\u652F\u6301 OpenAI \u517C\u5BB9\u4E2D\u8F6C\u7AD9\uFF0C\u5730\u5740\u586B\u5176 base URL \u5373\u53EF\uFF1B\u6CA1\u5217\u8FDB\u9884\u8BBE\u7684\u670D\u52A1\u53EA\u8981\u63D0\u4F9B OpenAI \u517C\u5BB9\u63A5\u53E3\uFF0C\u624B\u52A8\u586B\u5730\u5740\u4E5F\u80FD\u901A\uFF08\u552F\u4E00\u4F8B\u5916\u662F Azure OpenAI\uFF0C\u8DEF\u5F84\u7ED3\u6784\u7279\u6B8A\uFF0C\u6682\u4E0D\u652F\u6301\uFF09\u3002</div>'+
    (function(){
      var _on = !!(typeof P!=='undefined' && P && P.conf && P.conf.insecureTlsRelay===true);
      return '<label style="display:inline-flex;align-items:flex-start;gap:0.35rem;font-size:0.74rem;color:var(--txt-d);margin:-0.1rem 0 0.5rem;cursor:pointer;line-height:1.5;">'
        + '<input type="checkbox" id="s-insecure-tls" ' + (_on?'checked ':'') + 'onchange="sToggleInsecureTlsRelay(this.checked)" style="margin-top:0.15rem;flex:none;">'
        + '<span>\u5141\u8BB8\u4E2D\u8F6C\u7AD9<b style="color:var(--gold);">\u4E0D\u5B89\u5168\u8BC1\u4E66</b>\uFF08\u8BC1\u4E66\u57DF\u540D\u4E0D\u5339\u914D / \u81EA\u7B7E\u540D\u5BFC\u81F4\u8FDE\u4E0D\u4E0A\u65F6\u52FE\u9009\u00B7<b>\u4EC5\u5BF9\u4E0A\u65B9 API \u5730\u5740</b>\u751F\u6548\u00B7\u5B98\u65B9\u670D\u52A1\u5668\u4E0E\u70ED\u66F4\u4ECD\u4E25\u683C\u6821\u9A8C\u00B7\u5728\u7EBF\u7F51\u9875\u7248\u53D7\u6D4F\u89C8\u5668\u9650\u5236\u65E0\u6548\uFF09</span>'
        + '</label>';
    })()+
    "<div class=\"rw\"><div class=\"fd q\"><label>Temp</label><input type=\"number\" id=\"s-temp\" value=\""+(_sAiVirgin()?"":(P.ai.temp||0.8))+"\" step=\"0.1\" placeholder=\"\u9ED8\u8BA4 0.8\"></div><div class=\"fd q\"><label>\u8BB0\u5FC6</label><input type=\"number\" id=\"s-mem\" value=\""+(_sAiVirgin()?"":(P.ai.mem||20))+"\" placeholder=\"\u9ED8\u8BA4 20\"></div><div class=\"fd q\"><label>\u4E0A\u4E0B\u6587(K)</label><input type=\"number\" id=\"s-ctx\" value=\""+((P.conf.contextSizeK||0)>0?P.conf.contextSizeK:"")+"\" placeholder=\"\u7559\u7A7A=\u81EA\u52A8\" min=\"0\" title=\"\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\u5927\u5C0F(K tokens)\u3002\u7559\u7A7A\u62160=\u81EA\u52A8\u68C0\u6D4B\"></div></div>"+
    "<div style=\"font-size:0.7rem;color:var(--txt-d);margin:-0.2rem 0 0.3rem;\">\u4E0A\u4E0B\u6587\u7A97\u53E3\u5F71\u54CD\u8BB0\u5FC6\u538B\u7F29\u7B56\u7565\uFF1A128K+\u5BBD\u677E\u4FDD\u7559\u3001<32K\u6FC0\u8FDB\u538B\u7F29\u3001\u7559\u7A7A\u81EA\u52A8\u8BC6\u522B\u6A21\u578B</div>"+
    "<div style=\"display:flex;gap:0.3rem;margin-top:0.4rem;\"><button class=\"bt bs bsm\" onclick=\"sTestConn()\">\u6D4B\u8BD5\u8FDE\u63A5</button><button class=\"bt bs bsm\" onclick=\"sReDetectCtx()\">\u91CD\u65B0\u63A2\u6D4B\u7A97\u53E3</button><button class=\"bt bp bsm\" onclick=\"sSaveAPI()\">\u4FDD\u5B58</button></div>"+
    "<div id=\"s-status\" style=\"font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;\"></div>"+
    "<div id=\"s-ctx-info\" style=\"font-size:0.72rem;color:var(--txt-d);margin-top:0.2rem;\"></div>"+
    "<div style=\"margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid var(--bdr);\"><div style=\"font-size:0.75rem;color:var(--gold-d);margin-bottom:0.3rem;\">\u667A\u80FD\u751F\u56FE API\uFF08\u72EC\u7ACB\u914D\u7F6E\uFF0C\u7528\u4E8E\u7ACB\u7ED8\u7B49\u56FE\u7247\u751F\u6210\uFF09</div>"+
    // 2026-07-10 \u65B0\u624B\u6307\u5F15 + \u6392\u7248\u653E\u5BBD\uFF1AURL/\u6A21\u578B\u5404\u5360\u6574\u884C\uFF08\u539F\u300CURL+80px \u6A21\u578B\u6846\u300D\u6324\u4E00\u884C\u00B7\u751F\u56FE\u6A21\u578B\u540D\u666E\u904D\u5F88\u957F\uFF09
    '<div style="font-size:0.72rem;color:var(--txt-d);line-height:1.6;margin:0 0 0.4rem;">\u7ED9\u4EBA\u7269\u7ACB\u7ED8\u7B49\u914D\u56FE\u7528\uFF0C\u4E0E\u4E0A\u65B9\u6587\u5B57 API \u4E92\u4E0D\u5F71\u54CD\uFF0C<b>\u4E0D\u60F3\u914D\u53EF\u6574\u6BB5\u7559\u7A7A</b>\uFF08Key \u7559\u7A7A\u65F6\u81EA\u52A8\u590D\u7528\u4E3B API \u7684 Key\uFF09\u3002URL \u586B\u670D\u52A1\u5546\u57FA\u5740\u6216\u5B8C\u6574\u751F\u56FE\u7AEF\u70B9\u7686\u53EF\uFF08\u57FA\u5740\u81EA\u52A8\u8865\u5168 /v1/images/generations\uFF09\uFF1B\u6A21\u578B\u586B\u670D\u52A1\u5546\u7684\u751F\u56FE\u6A21\u578B\u540D\u3002\u586B\u5B8C\u70B9\u300C\u6D4B\u8BD5\u8FDE\u63A5\u300D\u6216\u300C\u68C0\u6D4B\u751F\u56FE\u529F\u80FD\u300D\u9A8C\u8BC1\uFF0C\u518D\u70B9\u300C\u4FDD\u5B58\u300D\u3002</div>'+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">Key\uFF08\u751F\u56FE\u5BC6\u94A5\u00B7\u53EF\u7559\u7A7A\uFF09</label><input type=\"password\" id=\"s-img-key\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').key||'';}catch(e){return '';}})()+"\" placeholder=\"\u7559\u7A7A\u5219\u590D\u7528\u4E3B API \u7684 Key\" style=\"font-size:0.8rem;\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">URL\uFF08\u751F\u56FE\u63A5\u53E3\u00B7\u57FA\u5740\u6216\u5B8C\u6574\u7AEF\u70B9\u7686\u53EF\uFF09</label><input id=\"s-img-url\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').url||'';}catch(e){return '';}})()+"\" placeholder=\"\u5982 https://api.openai.com/v1/images/generations\" style=\"font-size:0.8rem;\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">Model_ID</label><input id=\"s-img-model\" value=\""+(function(){try{return JSON.parse(localStorage.getItem('tm_api_image')||'{}').model||'';}catch(e){return '';}})()+"\" placeholder=\"ep-......\u4E0D\u662FLLM\u540D\u79F0\" style=\"font-size:0.8rem;\"></div></div>"+
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
        "<div class=\"rw\"><div class=\"fd\"><label>\u670D\u52A1\u5546\uFF08\u9009\u4E00\u5BB6\u81EA\u52A8\u586B\u5730\u5740\uFF09</label><select id=\"s-sec-prov\" onchange=\"sProvPreset(this.value,'sec')\"><option value=\"\">（请选择服务商）</option>"+_sProvOptions()+"</select></div><div class=\"fd\"><label>Key</label><input type=\"password\" id=\"s-sec-key\" value=\""+(sec.key||"")+"\" placeholder=\"\u7559\u7A7A\u5219\u56DE\u9000\u4E3B API\"></div></div>"+
        "<div class=\"rw\"><div class=\"fd\"><label>\u5730\u5740</label><input id=\"s-sec-url\" value=\""+(sec.url||"")+"\" placeholder=\"https://api.openai.com/v1\"></div><div class=\"fd\"><label>Model_ID</label><input id=\"s-sec-model\" value=\""+(sec.model||"")+"\" placeholder=\"ep-......\u4E0D\u662FLLM\u540D\u79F0\"></div></div>"+
        "<div style=\"font-size:0.7rem;color:var(--txt-d);margin:-0.2rem 0 0.3rem;\">\u63A8\u8350\uFF1Agpt-4o-mini \u00B7 claude-haiku-4-5 \u00B7 deepseek-chat \u00B7 gemini-2.5-flash</div>"+
        "<div style=\"display:flex;gap:0.3rem;margin-top:0.4rem;flex-wrap:wrap;\"><button class=\"bt bs bsm\" onclick=\"sTestSecondaryConn()\">\u6D4B\u8BD5\u8FDE\u63A5</button><button class=\"bt bp bsm\" onclick=\"sSaveSecondaryAPI()\">\u4FDD\u5B58</button>"+
        (hasKey ? "<button class=\"bt bd bsm\" onclick=\"sClearSecondaryAPI()\">\u6E05\u9664</button>" : "") +
        "<label style=\"display:inline-flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--txt-d);margin-left:auto;"+(hasKey?"":"opacity:0.5;cursor:not-allowed;")+"\"><input type=\"checkbox\" id=\"s-sec-enabled\" "+(enabled?"checked ":"")+(hasKey?"":"disabled ")+"onchange=\"sToggleSecondaryEnabled(this.checked)\"> \u542F\u7528\u6B21 API</label>"+
        "</div>"+
        "<div id=\"s-sec-status\" style=\"font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;\"></div>"+
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
        (function(){
          var _wtFaOn = !!(P.conf && P.conf.wentianFulfillAudit === true);
          var _wtUdOn = !!(P.conf && P.conf.wentianUndo === true);
          return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-wentian-audit" ' + (_wtFaOn?'checked ':'') + 'onchange="_togglePConf(\'wentianFulfillAudit\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">问天·兑现对账（默认关闭·实验）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">问天裁定可附带量化指标·回合结束后引擎按在档真值<b>确定性核验</b>是否兑现（AI 说「已遵」而数字没动时·账本说了算）·结果盖进指令徽章并入问天历史。零额外 AI 调用。</div>' +
            '</div>' +
          '</label>' +
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
            '<input type="checkbox" id="s-wentian-undo" ' + (_wtUdOn?'checked ':'') + 'onchange="_togglePConf(\'wentianUndo\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">问天·直改可撤销（默认关闭·实验）</div>' +
              '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">问天数值直改落笔时快照原值·<b>当回合内</b>可在活跃指令列表一键回滚（↩撤）。过回合后推演已消化改动·不可再撤。天意造物类不可撤。</div>' +
            '</div>' +
          '</label>';
        })() +
          (function(){
            var _revEntOn = !!(P.conf && P.conf.revoltEntityEnabled === true);
            return '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
              '<input type="checkbox" id="s-revolt-entity" ' + (_revEntOn?'checked ':'') + 'onchange="_togglePConf(\'revoltEntityEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
              '<div style="flex:1;">' +
                '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">民变实体化（默认关闭·实验）</div>' +
                '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">民变闹到「暴动」及以上时具象化为<b>真实体</b>并交 <b>AI 演绎</b>：起真旗号·立有名有姓的渠帅·定纲领；此后每回合由 AI 决断攻守/裹挟/分裂合流/僭号建国·并按你的招抚旨意<b>真谈判</b>（讨价/诈许/真降皆有可能·银子真扣）。占据的府县真易手。被剿/瓦解则军散档除；打到顶级=<b>兵临京师三拍</b>（有储君则继统续玩残局）。无 AI 时落确定性兜底。每回合约多 1-2 次轻量调用（走次要 API）。关闭时维持原五级抽象台账。</div>' +
              '</div>' +
            '</label>' +
            '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
              '<input type="checkbox" id="s-border-invasion" ' + ((P.conf && P.conf.borderInvasionEnabled === true)?'checked ':'') + 'onchange="_togglePConf(\'borderInvasionEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
              '<div style="flex:1;">' +
                '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">边患·真实入侵（默认关闭·实验）</div>' +
                '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">边境风险持续高压（边军空虚+强敌在侧连续三回合）时·敌对势力<b>真的出兵</b>：一支入侵军出现在最危急的州府·军事系统照常接战；风险回落或击破则退兵（六回合内不再犯）。关闭时边患仅停留在数值与文案。</div>' +
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
              ['officeCharterEnabled','设衙章程','下诏设新衙门时 AI 拟开衙章程：正名·职掌·官职表(品级/编制/职权/月俸)·首任荐单·开办费(国库真扣)，廷议裁定后按章开衙。须同开「改制裁定」方有拟制态可拟(增 AI 子调用)。',false],
              ['officeDynMigrationEnabled','旧衙归树','把历年「设衙门」攒下的权设台账衙门一次性迁入官制树·著为定制：岁支旧账停走·员额俸给改循官制·旧掌其事者荐正授入建议库·有 AI 则补章程定职官表。开一次迁一次·并账不重立。',false],
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

    // ── 战斗规则·确定性战果 (默认开·2026-07-05 翻默认·原 opt-in 2026-06-15) ──
    (function(){
      var _on = !(P.conf && P.conf.deterministicCasualties === false);
      return '<div class="settings-section"><h4>战斗规则</h4>' +
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">' +
        '<input type="checkbox" id="s-det-cas" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'deterministicCasualties\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
        '<div style="flex:1;">' +
          '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">⚔️ 确定性战果（默认开）</div>' +
          '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">开启后（默认），当推演 AI 漏报或给出离谱伤亡时，改由战斗引擎按双方兵力、地形、城防、季节确定性核算战损，机械可信度更高；关闭则一切战果由 AI 自由裁量。</div>' +
        '</div>' +
      '</label></div>';
    })()+

    // ── 党争/阶层·LLM 校准 (默认开·2026-07 补设置开关·此前仅 console·耗 API) ──
    (function(){
      var _on = !(P.conf && P.conf.partyClassLlmEnabled === false);
      return '<div class="settings-section"><h4>AI 校准</h4>' +
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">' +
        '<input type="checkbox" id="s-party-class-llm" ' + (_on?'checked ':'') + 'onchange="_togglePConf(\'partyClassLlmEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
        '<div style="flex:1;">' +
          '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">🎭 党争/阶层·LLM 校准（默认开）</div>' +
          '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">开启后（默认），游戏按剧本设定的党派/阶层，在每回合推演及你临朝理事时用 AI 精细校准各党派、各阶层对时局的态度与倾向（耗 API）；关闭则省这部分 AI 调用，党派/阶层动态退回内置机械信号规则（仍照常演化，只是不再逐回合 AI 精修）。</div>' +
        '</div>' +
      '</label></div>';
    })()+

    // ── 玩法机制·深化 (opt-in·默认关·2026-07-01·补设置开关·此前仅 console 可开·确定性玩法非 AI) ──
    (function(){
      var _mechs = [
        ['worldReactorBattleEnabled','⚔️ 兵败牵动天下（默认关）','开启后，一方在会战中大败，其军事实力确定性受损，并联动编年记述天下反应；关闭则战败只走 AI 自由裁量，不自动折损实力。'],
        ['populationBottomUpEnabled','👥 人口自下而上（默认关）','开启后，人口增长发生在各叶级政区、按当地民心与承载力分别核算并写入地方户口；关闭则走全局粗粒度增长。'],
        ['cognitionFeedbackEnabled','🎭 认知反馈·忠诚（默认关·未充分实测）','开启后，臣子被贬则渐离心、受知遇则渐效忠——把「知遇/贬谪」从叙事落到忠诚数值动平衡；关闭则忠诚不因升降迁谪自动漂移。此项动平衡幅度未充分验证，酌情开启。'],
        ['agencyWatchEnabled','🕵 密探常侦（默认关）','开启后，常设的直属天子密探机构（治理面板可诏设，依机构独立性识别，台谏不算）逐回合暗中侦缉，确定性推高在酿阴谋的败露进度；衙门够力时，朝中百官暗动亦入耳目，以「密探风闻」呈御案（只报风闻类别，真相须下诏穷治）。机构腐败、缺员则侦缉效力打折，特务坐大另有反噬制衡。关闭则查案只靠陛下亲自下诏。'],
        ['marchSystemEnabled','🏇 军令·移防（默认关）','开启后，「朝野内情→军事要务」中我方驻防军队可直接下移防军令：指定目的地，行军按路程、季节、兵种逐回合推进，抵达自动接防（在途进度在抽屉与过回合报告可见）；有地图剧本走真寻路，无路可达则拒单。关闭则军队调动仅经诏令由 AI 推演。'],
        ['disasterSimEnabled','🌾 天时·灾异推演（默认关）','开启后，天灾由游戏自身环境模拟发生：气候严酷期（如小冰河）、国土过载、地方积弊都会推高灾异概率，灾种随季节物候（春夏旱、盛夏洪、夏秋蝗、冬春疫），同一局面必得同一天时（确定性，不掷骰）。灾起后赈济、粮价、流民、民变等既有机制原样联动。关闭则天灾仅由 AI 叙事偶发。'],
        ['edictDiplomacyEnabled','🕊 诏令·外交动词（默认关）','开启后，诏书中点名他国势力的「议和罢兵」「征讨宣战」「开互市」「纳岁币」将确定性落地：议和真止战并上停战期，宣战入战争法则（师出无名有代价），互市岁币真金出入国库并牵动皇威。诏书须点名对象势力方生效；否定语（如「不许议和」「罢互市」）不会被误执行。关闭则对外意志仅由 AI 推演斟酌。'],
        ['deptReplyEnabled','📋 部议限期·有司回奏（默认关）','开启后，常朝「发部议」交办有司的事项有真限期：逐回合催办、临期在常朝议程加急，限满由承办衙门主官具本回奏（呈御案时政）——主官虚悬则逾期无人回奏（可补官或申饬督办），主官离心则回奏敷衍塞责，可循报穷究。关闭则部议交办仅在常朝议程中列示，无人回奏。'],
        ['threatVarLinkEnabled','⚔ 外患威胁·联动战和（默认关）','开启后，剧本中声明了所系势力的威胁类变量（如绍宋「金军威胁等级」系于大金）不再是死数：逐回合向该势力实际实力与战和态势缓慢靠拢（史事抉择的冲击保留为渐衰的偏离，不被硬覆写），且该势力施加的边境风险随威胁值增减——威胁愈高边警愈紧，弭兵休战或削其实力则威胁渐消，「威胁≤N」类目标从此可经真实战和达成。关闭则此类变量仅由史事抉择拨动。'],
        ['benjiEnabled','📖 帝王本纪·盖棺论定（默认关）','开启后，终局（驾崩或亡国）时史馆据整局起居注、实录、时政记与编年，以文言本纪体为你修撰一部帝王本纪：在位每一年成一卷，逐卷修纂上屏，末卷并书身后之事并以「赞曰」作结——与太史公评语同屏呈现，并存入「历代亲历」供日后重读。修纂按在位年数发起多次 AI 调用（约每十二回合一次），长局耗时较久、逐卷可读。关闭则终局仅有太史公短评。'],
        ['massAmnestyEnabled','⚖ 恩诏大赦·放归有司（默认关）','开启后，诏书中「大赦天下」「恩赦海内」等全域赦语确定性落地：在押人犯尽数放归田里（谋逆、通敌等重罪与已定罪逆党不在赦列），蒙赦者感念天恩，恩诏入编年与御案时政；否定语（如「不得妄言大赦」）不会被误执行。个体点名赦免（释放某人、起复某人）一直可用，不受此开关影响。关闭则大赦仅由 AI 叙事斟酌，不真放人。'],
        ['clanGrowthEnabled','👑 宗藩世禄·随宗室繁衍（默认关）','开启后，「宗藩世禄」岁支不再是恒定账：凡朝代处于宗室压力时期（如明中后期，由朝代预设驱动），享世禄的王爵宗支数随宗室人口逐年繁衍同步攀升——开国不过数十家，数十年后宗禄渐成财政巨壑，是为宗禄之螺旋（确定性复利，开启时以当前账面为种子不跳变）。宗禄难支另有既有的宗室生计危机联动。关闭则宗藩世禄按恒定王爵数计。'],
        ['zoushuGenEnabled','📜 百官有事·主动上奏（默认关）','开启后，朝中对口衙门主官会就真实国事主动具疏，入常朝「百官奏疏」议程：地方民变由兵事主官奏闻、新罹灾异由钱谷主官请赈、部门积弊与部务逾期由风宪科道纠劾催督。所奏皆取自当下实况（确定性，不掷骰），同一事由六回合内不重奏；对口衙门主官虚悬则此事无人入奏——缺员之弊自见。关闭则常朝议程无百官主动上奏。'],
        ['sysPTieringEnabled','⚡ AI 省流·分级系统提示（默认关）','开启后，过回合的各专项子推演（财政/军事/势力/诏令/认知/快照）只携带各自任务所需的系统提示段落，而非整份剧本大提示——一回合可省大量输入 token（省钱且提速），主推演与对话不受影响。若开启后出现人名地名错乱等异常，请关闭并反馈。'],
        ['reportedViewEnabled','🕯 奏报失真·据奏与实情（默认关·仅严格史实模式生效）','开启后（且开局选了「严格史实」模式），朝廷数值面板所见渐为有司上报的「据奏值」——吏治愈坏、经手之臣愈离心，粉饰愈甚（同一回合数字恒定不乱跳，确定性推导不掷骰）；实情须经厂卫密奏、诏狱推问、派员核查方得掀见，掀开后若干回合内显实情。凡失真数字均标「据奏」徽以示口径。此为地基开关：各数值面板分波接入中（财政→民心→户口→军额→吏治），未接入的面板暂仍显实情。关闭或非严格史实模式则一切照旧。']
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
    "<button class=\"bt bs bsm\" onclick=\"if(window.TM&&TM.ai&&TM.ai.showCostPanel){TM.ai.showCostPanel();}else if(typeof showAICostPanel==='function'){showAICostPanel();}else{toast('\u6210\u672C\u9762\u677F\u672A\u52A0\u8F7D');}\">AI \u6210\u672C\u9762\u677F</button>"+
    "<button class=\"bt bs bsm\" onclick=\"if(window.TM&&TM.ai&&TM.ai.exportDiagnostics){TM.ai.exportDiagnostics();}else if(typeof exportAIDiagnosticsJSON==='function'){exportAIDiagnosticsJSON();}else{toast('\u8BCA\u65AD API \u672A\u52A0\u8F7D');}\">\u2193 \u5BFC\u51FA\u65E5\u5FD7</button>"+
    ((typeof _renderMemoryDiagnosticsButton === 'function') ? _renderMemoryDiagnosticsButton() : "<button class=\"bt bs bsm\" onclick=\"if(window.TM&&TM.ai&&TM.ai.openMemoryDiagnostics){TM.ai.openMemoryDiagnostics();}else if(typeof openMemoryDiagnostics==='function'){openMemoryDiagnostics();}else{toast('\u8BB0\u5FC6\u8BCA\u65AD\u672A\u52A0\u8F7D');}\">\u8BB0\u5FC6\u8BCA\u65AD</button>")+
    "</div></div>"+
    // Phase 7.5 A\u00B79 \u4E2A\u65B0 P.ai opt-in toggle \u66B4\u9732\u00B7user \u53EF\u52FE\u9009\u5207\u6362
    "<details class=\"fd tm-settings-adv\"><summary>AI \u7BA1\u7EBF\u5F00\u5173 \u00B7 \u9AD8\u7EA7\uFF08\u5185\u90E8\u5B50\u8C03\u7528\u65CB\u94AE\u00B7\u4E00\u822C\u65E0\u9700\u6539\u52A8\uFF09</summary>"+
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
    "<span style=\"font-size:0.7rem;color:var(--ink-300,#888);\">\u6CE8\uFF1A\u6539\u52A8\u540E\u9996\u56DE\u5408\u4F1A\u91CD\u5EFA\u63D0\u793A\u7F13\u5B58\uFF0C\u7565\u589E\u4E00\u6B21\u5C0F\u989D\u5F00\u9500\u3002</span>"+
    "</details></div>"+
    // ★还账(设flag必配设置开关)：rigidHistEventsOff 有读端(tm-history-events.js _rigidHistoryEventShouldFire)却无任何写端·changelog 曾承诺「可在设置里一键关闭」但玩家点不到。此处补开关·落「游戏模式」段(rw 行后·section 内)·走 _togglePConf→saveP 现有 conf 持久化管线(不自创路径)。默认未写=undefined=注定事件照常触发(保持现状)。
    '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.5rem 0 0.2rem;margin-top:0.3rem;border-top:1px dotted var(--bdr);cursor:pointer;">' +
      '<input type="checkbox" id="s-rigid-hist-off" ' + (P.conf && P.conf.rigidHistEventsOff===true ? 'checked ' : '') + 'onchange="_togglePConf(\'rigidHistEventsOff\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
      '<div style="flex:1;">' +
        '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">演义模式·关闭注定史实事件</div>' +
        '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">开启后，演义模式下史实人物的注定命运事件（如史实死亡）不再自动触发，交由你改写历史。轻度 / 严格史实模式不受影响。</div>' +
      '</div>' +
    '</label>' +
    "</div>"+

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
  // 最近探测日志（2026-07-10 改显示进服务窗：此前 <details> 在本行=模型信息栏内联展开·日志把模型那栏顶掉——改点击后渲染进 s-status 服务窗·再点收起）
  if (typeof _ctxDetectLog !== 'undefined' && _ctxDetectLog.length > 0) {
    html += ' · <a href="javascript:void(0)" onclick="_sShowDetectLog()" style="color:var(--gold);cursor:pointer;">探测日志(' + _ctxDetectLog.length + '条)</a>';
  }
  el.innerHTML = html;
}

/** 探测日志渲染进服务窗（s-status）·再点收起（2026-07-10） */
function _sShowDetectLog() {
  var st = _$('s-status'); if (!st) return;
  if (st.querySelector('#s-detect-log')) { st.innerHTML = ''; return; }
  if (typeof _ctxDetectLog === 'undefined' || !_ctxDetectLog.length) { st.innerHTML = '<span style="color:var(--txt-d);">（暂无探测日志）</span>'; return; }
  var h = '<div id="s-detect-log"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:var(--gold);">探测日志 (' + _ctxDetectLog.length + '条)</span><a href="javascript:void(0)" onclick="_sShowDetectLog()" style="color:var(--txt-d);font-size:0.7rem;cursor:pointer;">收起 ✕</a></div>';
  h += '<div style="max-height:120px;overflow-y:auto;font-size:0.71rem;padding:4px;background:var(--bg-3);border-radius:4px;margin-top:2px;">';
  _ctxDetectLog.forEach(function(e) { h += '<div>' + e.time + ' ' + (typeof escHtml === 'function' ? escHtml(e.msg) : e.msg) + '</div>'; });
  h += '</div></div>';
  st.innerHTML = h;
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

function _sApplyPrimaryApiFields(){
  P.ai.key=_$("s-key")?_$("s-key").value:"";P.ai.url=_$("s-url")?_$("s-url").value:"";P.ai.model=_$("s-model")?_$("s-model").value:"";var _tv=parseFloat(_$("s-temp")?_$("s-temp").value:"");P.ai.temp=isNaN(_tv)?0.8:_tv;var _mv=parseInt(_$("s-mem")?_$("s-mem").value:"");P.ai.mem=isNaN(_mv)?20:_mv;P.ai.provider=_$("s-prov")?_$("s-prov").value:"openai";
}
function sSaveAPI(){
  _sApplyPrimaryApiFields();
  try{ if(typeof tmApplyInsecureTlsConfig==='function') tmApplyInsecureTlsConfig(); }catch(_){}
  // ★2026-07-01·修「桌面端保存主 API key·关游戏再进就丢」:key 真源在 localStorage.tm_api(启动时 tm-player-core.js:257
  //   从此水合 P.ai)·桌面 autoSave 走 _tmStripAiKeyView 故意剥掉 key(不进可分享存档·安全)。原实现桌面分支只 autoSave、
  //   漏写 localStorage.tm_api → 主 key 只活内存·重启即失。改为两端都写 localStorage.tm_api(与 sSaveSecondaryAPI 同范式)·桌面再 autoSave。
  try{localStorage.setItem("tm_api",JSON.stringify(P.ai));}catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
  // 统一交给 saveP：对局中只写 IDB/lite，绝不以纯 P 覆盖桌面崩溃恢复档；非对局再由 saveP 写 Electron。
  if(typeof saveP==='function') saveP();
  toast("\u2705 API\u5DF2\u4FDD\u5B58");
}
function sSaveAll(){
  // 先把主/次 API 面板全部合入内存，最后一次性写 tm_api；旧实现先持久化旧 secondary，
  // 随后只改内存，导致重启恢复旧次 key。
  _sApplyPrimaryApiFields();
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
  try{ if(typeof tmApplyInsecureTlsConfig==='function') tmApplyInsecureTlsConfig(); }catch(_){}
  try{localStorage.setItem("tm_api",JSON.stringify(P.ai));}catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
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

// ── 连接体检·判读与报告卡（2026-07-04「全面加强测试连接时的模型能力检测」）──
// 快检三小调用走 probeModelQuickCheck(tm-ai-infra)·重项（证据校验/实测输出）按钮转交既有探测
function _sConnVerdict(qr, ctxK, outTok) {
  var notes = [];
  var grade = 3; // 3=堪任 2=可用 1=不宜
  if (!qr.json.ok) { grade = 1; notes.push('结构化输出不可靠（严格 JSON 未过）——回合结算的命门'); }
  if (ctxK > 0) {
    if (ctxK < 32) { grade = Math.min(grade, 1); notes.push('上下文仅 ' + ctxK + 'K，记忆须激进压缩，久局易失真'); }
    else if (ctxK < 64) { grade = Math.min(grade, 2); notes.push('上下文 ' + ctxK + 'K，中局之后记忆压缩趋紧'); }
  }
  if (outTok > 0 && outTok < 4096) { grade = Math.min(grade, 2); notes.push('输出上限约 ' + Math.round(outTok / 1024) + 'K，长篇（后人戏说、密折）可能被腰斩'); }
  if (qr.echo === 'mismatch') grade = Math.min(grade, 2);
  var label = grade === 3 ? '堪任天命推演' : grade === 2 ? '可用 · 体验有折损' : '不宜久任 · 见下方提醒';
  var color = grade === 3 ? 'var(--celadon-400,#5a8f7f)' : grade === 2 ? 'var(--gold)' : 'var(--vermillion-400,#c04030)';
  return { grade: grade, label: label, color: color, notes: notes };
}
function _sRenderConnReport(qr, ctxK, ctxSrc, outTok, outSrc, tier) {
  var esc = _settingsEsc;
  function chip(ok, label, title) {
    return '<span title="' + esc(title || '') + '" style="display:inline-flex;align-items:center;gap:3px;margin-right:0.6rem;white-space:nowrap;"><b style="color:' + (ok ? 'var(--celadon-400,#5a8f7f)' : 'var(--vermillion-400,#c04030)') + ';">' + (ok ? '✓' : '✕') + '</b>' + esc(label) + '</span>';
  }
  var v = _sConnVerdict(qr, ctxK, outTok);
  var h = '<div class="s-conn-report" style="margin-top:0.35rem;padding:0.5rem 0.65rem;border:1px solid var(--bdr);border-left:3px solid ' + v.color + ';border-radius:3px;background:rgba(0,0,0,0.05);font-size:0.74rem;line-height:1.9;">';
  h += '<div><b style="color:var(--gold);">连接体检</b> · ' + Math.round(qr.latencyMs) + 'ms';
  if (qr.responseModel) {
    var echoTxt = qr.echo === 'match' ? '回声一致' : qr.echo === 'family' ? '同族异名' : qr.echo === 'mismatch' ? '回声不符' : '回声未知';
    h += ' · <span style="color:' + (qr.echo === 'mismatch' ? 'var(--vermillion-400,#c04030)' : 'var(--txt-d)') + ';" title="API 实际返回的模型标识">' + echoTxt + '（' + esc(qr.responseModel) + '）</span>';
  }
  h += '</div>';
  h += '<div>' + chip(qr.stream.ok, '流式', qr.stream.detail) + chip(qr.json.ok, '严格JSON', qr.json.detail) + chip(qr.usageSeen, 'usage用量', '是否返回 token 用量·关系成本统计与预算档位');
  if (ctxK > 0) h += '<span style="margin-right:0.6rem;">上下文 <b>' + ctxK + 'K</b><small style="color:var(--txt-d);">（' + esc(ctxSrc || '') + '）</small></span>';
  if (outTok > 0) h += '<span>输出 <b>' + Math.round(outTok / 1024) + 'K</b><small style="color:var(--txt-d);">（' + esc(outSrc || '') + '）</small></span>';
  else h += '<span style="color:var(--txt-d);">输出上限未知 · 建议实测</span>';
  h += '</div>';
  h += '<div>判读：<b style="color:' + v.color + ';">' + v.label + '</b></div>';
  var warns = (qr.warnings || []).concat(v.notes).filter(function(w, i, arr) { return arr.indexOf(w) === i; });
  if (warns.length) h += '<div style="margin-top:0.15rem;color:var(--txt-d);">' + warns.map(function(w) { return '⚠ ' + esc(w); }).join('<br>') + '</div>';
  var t = tier === 'secondary' ? "'secondary'" : "'primary'";
  h += '<div style="margin-top:0.3rem;display:flex;gap:0.35rem;flex-wrap:wrap;">'
    + '<button class="bt bs bsm" onclick="_probeRunEvidence(' + t + ')">深度证据校验 · 6 次小调用</button>'
    + '<button class="bt bs bsm" onclick="_probeRunOutput(' + t + ')">实测输出上限</button>'
    + '<button class="bt bs bsm" onclick="_showAvailableModels(' + t + ')">可用模型清单</button>'
    + '</div></div>';
  return h;
}
async function sTestSecondaryConn(){
  var key=_$("s-sec-key")?_$("s-sec-key").value.trim():"";
  var url=_$("s-sec-url")?_$("s-sec-url").value.trim():"";
  var model=_$("s-sec-model")?_$("s-sec-model").value.trim():"gpt-4o-mini";
  if(!key||!url){toast("\u586B\u5199\u6B21 API Key \u548C\u5730\u5740");return;}
  var st=_$("s-sec-status");if(st)st.textContent="\u6B63\u5728\u4F53\u68C0\u2026";
  // \u4E34\u65F6\u5E94\u7528\u672A\u4FDD\u5B58\u7684\u6B21 API \u503C\uFF08\u4F53\u68C0\u8D70 tier \u7BA1\u9053\u8BFB P.ai.secondary\uFF09\u00B7\u7ED3\u675F\u540E\u6062\u590D
  var _had=!!(P.ai&&P.ai.secondary);
  var _orig=_had?{key:P.ai.secondary.key,url:P.ai.secondary.url,model:P.ai.secondary.model}:null;
  if(!P.ai)P.ai={}; // arch-ok 体检临时应用未保存值·收尾恢复（与主API sTestConn 同范式）
  if(!P.ai.secondary)P.ai.secondary={}; // arch-ok 同上
  P.ai.secondary.key=key;P.ai.secondary.url=url;P.ai.secondary.model=model; // arch-ok 同上·临时应用
  try{
    var qr=await probeModelQuickCheck({tier:'secondary',onProgress:function(msg){if(st)st.innerHTML='<span style="color:var(--gold);">'+msg+'</span>';}});
    var wlC=(typeof _matchModelCtx==='function')?_matchModelCtx(model):0;
    var wlO=((typeof _matchModelOutput==='function')?_matchModelOutput(model):0)*1024;
    var ctxK=(P.conf&&P.conf._detectedContextK_secondary)||wlC||0;
    var ctxSrc=(P.conf&&P.conf._detectedContextK_secondary)?(P.conf._ctxDetectLayer_secondary||'API\u63A2\u6D4B'):(wlC?'\u767D\u540D\u5355':'');
    var outTok=(P.conf&&P.conf._detectedMaxOutput_secondary)||wlO||0;
    var outSrc=(P.conf&&P.conf._detectedMaxOutput_secondary)?'API\u63A2\u6D4B':(wlO?'\u767D\u540D\u5355':'');
    if(st)st.innerHTML=_sRenderConnReport(qr,ctxK,ctxSrc,outTok,outSrc,'secondary');
  }catch(err){
    if(st)st.innerHTML="<span style=\"color:var(--red);\">\u274C "+(err.message||err)+"</span>";
  }
  // \u6062\u590D\u539F\u59CB\u503C\uFF08\u907F\u514D\u672A\u4FDD\u5B58\u65F6\u6C61\u67D3\uFF09
  if(_had){P.ai.secondary.key=_orig.key;P.ai.secondary.url=_orig.url;P.ai.secondary.model=_orig.model;} // arch-ok 体检收尾恢复原值
  else{try{delete P.ai.secondary;}catch(_){}} // arch-ok 体检收尾·本无次API则拆除临时对象
}
async function sTestConn(){
  var key=_$("s-key")?_$("s-key").value:"";var url=_$("s-url")?_$("s-url").value:"";
  if(!key||!url){toast("填写");return;}var st=_$("s-status");if(st)st.textContent="正在体检…";
  // 临时更新P.ai以便体检与探测能使用未保存值·结束后恢复
  var _origKey=P.ai.key, _origUrl=P.ai.url, _origModel=P.ai.model;
  P.ai.key=key; P.ai.url=url; P.ai.model=_$("s-model")?_$("s-model").value:"gpt-4o";
  try{
    // 2026-07-04 全面加强：快检三小调用（连通/延迟/模型回声 + 流式 + 严格JSON）→ 富报告卡
    var qr=await probeModelQuickCheck({tier:'primary',onProgress:function(msg){if(st)st.innerHTML='<span style="color:var(--gold);">'+msg+'</span>';}});
    // 上下文窗口探测（沿用既有分层探测）
    var detK=0;
    try{
      delete P.conf._detectedContextK; delete P.conf._ctxCacheKey; delete P.conf._ctxDetectLayer;
      detK=await detectModelContextSize({
        force:true,
        onProgress:function(msg){if(st)st.innerHTML='<span style="color:var(--gold);">连通 ✓ · '+msg+'</span>';}
      });
    }catch(_ce){}
    var wlCtx=(typeof _matchModelCtx==='function')?_matchModelCtx(P.ai.model||''):0;
    var ctxK=detK||wlCtx||0;
    var ctxSrc=detK?(P.conf._ctxDetectLayer||'API探测'):(wlCtx?'白名单':'');
    // 输出上限取已知最优来源（此处不实测·报告卡上有实测按钮）：手动 > 实测缓存 > API探测 > 白名单
    var wlOut=((typeof _matchModelOutput==='function')?_matchModelOutput(P.ai.model||''):0)*1024;
    var outTok=(P.conf.maxOutputTokens||0)||(P.conf._measuredMaxOutput||0)||(P.conf._detectedMaxOutput||0)||wlOut||0;
    var outSrc=P.conf.maxOutputTokens?'手动':(P.conf._measuredMaxOutput?'实测':(P.conf._detectedMaxOutput?'API探测':(wlOut?'白名单':'')));
    if(st)st.innerHTML=_sRenderConnReport(qr,ctxK,ctxSrc,outTok,outSrc,'primary');
    _sShowCtxInfo(); _sVerbUpdatePreview();
  }catch(err){if(st)st.innerHTML="<span style=\"color:var(--red);\">❌ "+(err.message||err)+"</span>";}
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
  // 2026-07-11 \u4FEE\u300C\u586B\u4E86\u6CA1\u4FDD\u5B58\u5C31\u6D4B\u2192\u6D4B\u5230\u65E7\u914D\u7F6E\u300D\uFF1A\u5148\u628A\u680F\u4F4D\u843D\u76D8\u00B7\u6D4B\u7684\u5C31\u662F\u773C\u524D\u586B\u7684
  try { _sSaveImgAPI(); } catch(_){}
  var cfg = typeof ImageAPI !== 'undefined' ? ImageAPI.getConfig() : null;
  if (!cfg || !cfg.supported) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C \u672A\u914D\u7F6E\u751F\u56FEAPI\uFF08Key\u6216URL\u4E3A\u7A7A\uFF09</span>';
    return;
  }
  try {
    // 故意用超小尺寸探测：多数服务商会拒 size（方舟 seedream 最小 92 万像素·dall-e-3 下限 1024²·2026-07-11 实测）——
    // 收到「尺寸类 400」即证明网络/Key/端点/模型路由全通且不出图不计费；401/403/404 才是真配置问题
    var resp = await fetch(cfg.url, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body: JSON.stringify({model:cfg.model||'dall-e-3',prompt:'test',n:1,size:'256x256',response_format:'url'})
    });
    var errMsg = '';
    if (!resp.ok) {
      try { var ej = await resp.json(); errMsg = (ej.error && ej.error.message) || ''; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-patches');}catch(_){}}
    }
    if (resp.ok) {
      if (st) st.innerHTML = '<span style="color:var(--green);">\u2705 \u8FDE\u63A5\u6210\u529F\uFF0C\u751F\u56FEAPI\u53EF\u7528</span>';
    } else if ((resp.status === 400 || resp.status === 422) && /size|pixel|resolution|width|height|\u5C3A\u5BF8|\u5206\u8FA8\u7387/i.test(errMsg)) {
      // \u5C3A\u5BF8\u88AB\u670D\u52A1\u5546\u6821\u9A8C\u62D2\u7EDD = \u5DF2\u901A\u8FC7\u8BA4\u8BC1\u5E76\u8DEF\u7531\u5230\u6A21\u578B\u00B7\u8FDE\u63A5\u53EF\u7528\uFF08\u63A2\u6D4B\u4E0D\u51FA\u56FE\u00B7\u4E0D\u8BA1\u8D39\uFF09
      if (st) st.innerHTML = '<span style="color:var(--green);">\u2705 \u8FDE\u63A5\u6B63\u5E38\uFF1AKey\u3001\u5730\u5740\u4E0E Model_ID \u5747\u53EF\u8FBE\uFF08\u670D\u52A1\u5546\u6821\u9A8C\u5230\u5C3A\u5BF8\u53C2\u6570\u5373\u8BC1\u660E\u8BA4\u8BC1\u4E0E\u7AEF\u70B9\u7686\u901A\u00B7\u672C\u63A2\u6D4B\u4E0D\u51FA\u56FE\u4E0D\u8BA1\u8D39\uFF09\u3002\u8981\u5B9E\u9645\u51FA\u56FE\u9A8C\u8BC1\uFF0C\u70B9\u300C\u68C0\u6D4B\u751F\u56FE\u529F\u80FD\u300D\u3002</span>';
    } else {
      if (st) st.innerHTML = '<span style="color:var(--red);">\u274C HTTP ' + resp.status + (errMsg ? ': ' + errMsg.slice(0,60) : '')
        + (resp.status === 404 ? '\u00B7\u63A5\u53E3\u8DEF\u5F84\u4E0D\u5BF9\uFF1FURL \u586B\u670D\u52A1\u5546\u57FA\u5740(\u81EA\u52A8\u8865\u5168 /v1/images/generations)\u6216\u5B8C\u6574\u751F\u56FE\u7AEF\u70B9\u7686\u53EF' : '')
        + (resp.status === 401 || resp.status === 403 ? '\u00B7Key \u65E0\u6548\u6216\u65E0\u6743\u9650\uFF1F' : '') + '</span>'
        + '<div style="color:var(--txt-d);font-size:0.68rem;margin-top:2px;">\u5B9E\u9645\u8BF7\u6C42\u7AEF\u70B9: ' + (typeof escHtml==='function'?escHtml(cfg.url):cfg.url) + '</div>';
    }
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:var(--red);">\u274C \u7F51\u7EDC\u9519\u8BEF: ' + e.message + '</span>';
  }
}

// 生图API——检测是否支持生图功能
async function _sDetectImgCap() {
  var st = _$('s-img-status');
  if (st) st.innerHTML = '<span style="color:var(--gold);">\u68C0\u6D4B\u4E2D\u2026\u6B63\u5728\u5C1D\u8BD5\u751F\u6210\u6D4B\u8BD5\u56FE\u7247</span>';
  try { _sSaveImgAPI(); } catch(_){} // 同测试连接：先把栏位落盘再测
  try {
    // 实际生成一张测试图验证生图能力。尺寸必须 1024x1024：
    // 256x256 低于方舟 seedream 最小面积（92 万像素）也低于 dall-e-3 下限（1024²）·2026-07-11 实测定罪
    var testUrl = await ImageAPI.generate('A simple red circle on white background, minimal, test image', {size:'1024x1024', quality:'standard'});
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
async function _logicAuditOnStart(sc, options) {
  options = options || {};
  var _background = options.background === true;
  var _session = (typeof _tmPlanningCaptureSession === 'function')
    ? _tmPlanningCaptureSession(options.session)
    : (options.session || { gmRef: GM, sid: GM && GM.sid, turn: GM && GM.turn });
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
    if (typeof _tmPlanningSessionCurrent === 'function' && !_tmPlanningSessionCurrent(_session)) {
      console.warn('[LogicAudit] 丢弃过期的开局审查结果');
      return;
    }
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
      if (!_background && typeof showLoading === 'function') showLoading('\u903B\u8F91\u5BA1\u67E5: \u751F\u6210' + genCount + '\u5904\u6240\u5728\u5730\uFF0C\u4FEE\u6B63' + fixCount + '\u5904\u77DB\u76FE', 92);
      console.log('[LogicAudit] 生成所在地 ' + genCount + ' 处，修正矛盾 ' + fixCount + ' 处');
      if (GM.qijuHistory) {
        var logParts = [];
        if (genCount > 0) logParts.push('为' + genCount + '位人物生成所在地');
        if (fixCount > 0) logParts.push('修正' + fixCount + '处矛盾');
        if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
          turn: 0, date: '开局审查',
          content: '【逻辑审查】' + logParts.join('，') + '。'
        });
      }
    } else {
      if (!_background && typeof showLoading === 'function') showLoading('\u903B\u8F91\u5BA1\u67E5: \u6570\u636E\u65E0\u77DB\u76FE', 92);
    }
  } catch(e) {
    console.warn('[LogicAudit] 审查失败:', e.message || e);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  【立项拆分 2026-07-04】剧本启动链(原§1705-末：_tmStart*/开场仪典/startGame/doActualStart)
//  → tm-patches-start.js（载于本文件之后）·保序切割·全局名跨文件解析
// ═══════════════════════════════════════════════════════════════════════

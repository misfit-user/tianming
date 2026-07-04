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
  bgmUrl: '',
  bgmScope: '',
  bgmLoading: false,
  bgmFailedAt: {},
  bgmFailureCooldownMs: 3 * 60 * 1000,
  autoBgmAttemptedAt: 0,
  autoBgmAttemptGapMs: 60 * 1000,
  playlist: [],
  currentTrackId: '',
  loopMode: 'sequence',
  sfxVolume: 0.5,
  bgmVolume: 0.3,
  enabled: true,
  bgmEnabled: true,
  menuTrack: null,

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
        var playlistVersion = window.TM_BGM_PLAYLIST_VERSION || '';
        var playlistChanged = playlistVersion && settings.bgmPlaylistVersion !== playlistVersion;
        this.currentTrackId = playlistChanged ? '' : (settings.currentTrackId || '');
        this.loopMode = playlistChanged ? (window.TM_BGM_DEFAULT_LOOP || 'sequence') : (settings.loopMode || window.TM_BGM_DEFAULT_LOOP || 'sequence');
      } catch (e) {
        console.error('加载音频设置失败:', e);
      }
    }

    this.loadMenuTrack();
    // ★重入 init 前撤旧导入轨 object URL(Codex P2:loadPlaylist 会重置 playlist→旧 user URL 泄漏堆积)
    try { (this.playlist || []).forEach(function(t) { if (t && t.user && t.src) { try { URL.revokeObjectURL(t.src); } catch (_) {} } }); } catch (_) {}
    this.loadPlaylist();
    // 恢复用户导入的 BGM(IndexedDB·异步·就绪后刷新音声面板)
    try { this.loadUserTracks(function() { if (window.TM && TM.UI && TM.UI.shell && typeof TM.UI.shell.refreshLeft === 'function') TM.UI.shell.refreshLeft(); }); } catch (_) {}
    // 创建音效（使用 Web Audio API 生成简单音效）
    this.generateSounds();
  },

  loadMenuTrack: function() {
    var track = window.TM_MENU_BGM && window.TM_MENU_BGM.src ? window.TM_MENU_BGM : null;
    this.menuTrack = track ? {
      id: String(track.id || 'menu-bgm'),
      title: track.title || track.id || 'Menu BGM',
      meta: track.meta || '',
      src: track.src
    } : null;
    return this.menuTrack;
  },

  loadPlaylist: function() {
    var tracks = Array.isArray(window.TM_BGM_TRACKS) ? window.TM_BGM_TRACKS : [];
    // 2026-07-04 重建内置列表时保导入轨（原先硬替换→设置声乐页每次渲染调本函数·把本会话导入轨从曲库冲掉）
    var userTracks = Array.isArray(this.playlist) ? this.playlist.filter(function(t) { return t && t.user; }) : [];
    this.playlist = tracks.filter(function(track) {
      return track && track.src;
    }).map(function(track, idx) {
      var id = track.id || ('bgm_' + idx);
      return {
        id: String(id),
        title: track.title || id,
        meta: track.meta || '',
        src: track.src
      };
    });
    if (userTracks.length) this.playlist = this.playlist.concat(userTracks);
    if (!this.currentTrackId && this.playlist.length) {
      this.currentTrackId = this.playlist[0].id;
    }
    return this.playlist;
  },

  getCurrentTrack: function() {
    if (!this.playlist || !this.playlist.length) this.loadPlaylist();
    var id = this.currentTrackId;
    var found = (this.playlist || []).find(function(track) { return track.id === id; });
    return found || (this.playlist && this.playlist[0]) || null;
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
  // perf round5 (2026-06-10): AudioContext 改共享单例——每次 new 一个上下文
  // 在 Windows 上是 10-100ms 级重操作·且浏览器并发上限 ~6 个·超限后创建失败
  playSfx: function(soundName) {
    if (!this.enabled || !this.sounds[soundName]) return;

    try {
      if (!this._sfxCtx || this._sfxCtx.state === 'closed') {
        this._sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      var audioContext = this._sfxCtx;
      if (audioContext.state === 'suspended') { try { audioContext.resume(); } catch (_) {} }
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
  playBgm: function(url, opts) {
    opts = opts || {};
    if (!this.bgmEnabled) return;

    try {
      var scope = opts.scope || 'game';
      if (url && this.bgm && this.bgmUrl === url && this.bgmScope === scope && (this.bgmLoading || !this.bgm.paused)) {
        return true;
      }
      if (url && this.bgmFailedAt && this.bgmFailedAt[url]) {
        var elapsed = Date.now() - this.bgmFailedAt[url];
        if (elapsed >= 0 && elapsed < this.bgmFailureCooldownMs) {
          _dbg('[BGM] skip recently failed track:', url);
          return false;
        }
      }
      if (this.bgm) {
        this.bgm.pause();
        this.bgm = null;
        this.bgmUrl = '';
        this.bgmScope = '';
        this.bgmLoading = false;
      }

      if (url) {
        var self = this;
        var audio = new Audio(url);
        this.bgm = audio;
        this.bgmUrl = url;
        this.bgmScope = scope;
        this.bgmLoading = true;
        audio.preload = 'none';
        audio.volume = this.bgmVolume;
        audio.loop = opts.loop !== undefined ? !!opts.loop : (this.loopMode === 'single' || (this.playlist || []).length <= 1);
        audio.onerror = function() {
          if (!self.bgmFailedAt) self.bgmFailedAt = {};
          self.bgmFailedAt[url] = Date.now();
          try { audio.pause(); } catch(_) {}
          if (self.bgm === audio) self.bgm = null;
          if (self.bgmUrl === url) self.bgmUrl = '';
          if (self.bgmScope === scope) self.bgmScope = '';
          self.bgmLoading = false;
          _dbg('[BGM] load failed; cooling down track:', url);
        };
        audio.onended = function() {
          if (self.loopMode !== 'single') self.nextTrack();
        };
        var playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(function(){ self.bgmLoading = false; }).catch(function(e) {
            self.bgmLoading = false;
            _dbg('背景音乐播放失败（可能需要用户交互）:', e);
          });
        } else {
          self.bgmLoading = false;
        }
        return true;
      }
    } catch (e) {
      console.error('播放背景音乐失败:', e);
      return false;
    }
  },

  playTrack: function(trackId) {
    if (!this.playlist || !this.playlist.length) this.loadPlaylist();
    var self = this;
    // ★守(Codex P1):默认播放(无 trackId)时若当前选中是尚未从 IndexedDB 载入的导入轨(user_)·勿用兜底覆盖其 currentTrackId(跨会话保选择·待 loadUserTracks 完成后自然播)
    if (!trackId && this.currentTrackId && this.currentTrackId.indexOf('user_') === 0 &&
        !(this.playlist || []).some(function(t) { return t.id === self.currentTrackId; })) {
      return false;
    }
    var track = (this.playlist || []).find(function(item) { return item.id === trackId; }) || this.getCurrentTrack();
    if (!track) return false;
    this.currentTrackId = track.id;
    this.saveSettings();
    return this.playBgm(track.src, { scope: 'game' }) !== false;
  },

  playMenuBgm: function() {
    var track = this.menuTrack || this.loadMenuTrack();
    if (!track) return false;
    return this.playBgm(track.src, { scope: 'menu', loop: true }) !== false;
  },

  playDefaultBgm: function() {
    var track = this.getCurrentTrack();
    if (!track) return false;
    return this.playTrack(track.id);
  },

  ensureBgmPlaying: function(opts) {
    opts = opts || {};
    if (!this.bgmEnabled) return false;
    if (opts.auto) {
      var now = Date.now();
      if (this.autoBgmAttemptedAt && now - this.autoBgmAttemptedAt >= 0 && now - this.autoBgmAttemptedAt < this.autoBgmAttemptGapMs) {
        return false;
      }
      this.autoBgmAttemptedAt = now;
    }
    if (this.bgmLoading) return true;
    if (this.bgm && !this.bgm.paused && this.bgmScope === 'game') return true;
    return this.playDefaultBgm();
  },

  autoEnsureBgmPlaying: function(reason) {
    return this.ensureBgmPlaying({ auto: true, reason: reason || '' });
  },

  nextTrack: function() {
    if (!this.playlist || this.playlist.length < 1) this.loadPlaylist();
    if (!this.playlist.length) return false;
    var currentId = this.currentTrackId;
    var idx = this.playlist.findIndex(function(track) { return track.id === currentId; });
    if (this.loopMode === 'random' && this.playlist.length > 1) {
      var nextIdx = Math.floor(Math.random() * this.playlist.length);
      if (nextIdx === idx) nextIdx = (nextIdx + 1) % this.playlist.length;
      return this.playTrack(this.playlist[nextIdx].id);
    }
    idx = idx < 0 ? 0 : (idx + 1) % this.playlist.length;
    return this.playTrack(this.playlist[idx].id);
  },

  // 停止背景音乐
  stopBgm: function() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
    this.bgmUrl = '';
    this.bgmScope = '';
    this.bgmLoading = false;
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
    } else {
      this.playDefaultBgm();
    }
    this.saveSettings();
    return this.bgmEnabled;
  },

  setLoopMode: function(mode) {
    this.loopMode = /^(single|sequence|random)$/.test(mode) ? mode : 'single';
    if (this.bgm) this.bgm.loop = this.loopMode === 'single' || (this.playlist || []).length <= 1;
    this.saveSettings();
  },

  // ══ 导入音乐（用户自备 BGM）══
  // 音乐文件大(MB 级)·不入 localStorage·存 IndexedDB(blob)跨会话持久;每次加载用 object URL 接入 playlist。
  _openUserBgmDB: function() {
    var self = this;
    if (self._userBgmDBPromise) return self._userBgmDBPromise;
    var p = new Promise(function(resolve, reject) {
      if (typeof indexedDB === 'undefined') { reject(new Error('indexedDB 不可用')); return; }
      var req = indexedDB.open('tmUserBgm', 1);
      req.onupgradeneeded = function(e) { var db = e.target.result; if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' }); };
      req.onsuccess = function(e) { resolve(e.target.result); };
      req.onerror = function() { reject(req.error || new Error('open failed')); };
    });
    // ★失败不永久缓存(Codex P1):rejected 则清空·下次调用重开(隐私模式恢复/瞬时失败后仍可持久化)
    p.catch(function() { if (self._userBgmDBPromise === p) self._userBgmDBPromise = null; });
    self._userBgmDBPromise = p;
    return p;
  },
  // 弹文件选择(audio/*·多选)→导入
  _pickMusicFiles: function() {
    var self = this;
    try {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'audio/*'; inp.multiple = true; inp.style.display = 'none';
      inp.onchange = function() {
        self.importUserMusic(inp.files, function() { if (window.TM && TM.UI && TM.UI.shell && typeof TM.UI.shell.refreshLeft === 'function') TM.UI.shell.refreshLeft(); });
        try { inp.remove(); } catch (_) {}
      };
      (document.body || document.documentElement).appendChild(inp);
      inp.click();
    } catch (e) { if (typeof toast === 'function') toast('无法打开文件选择'); }
  },
  // 导入文件列表:本会话即时接入 playlist(object URL) + 持久化到 IndexedDB
  importUserMusic: function(fileList, onDone) {
    var self = this;
    if (!self.playlist) self.loadPlaylist();
    var files = Array.prototype.slice.call(fileList || []).filter(function(f) {
      return f && (/^audio\//.test(f.type || '') || /\.(mp3|ogg|wav|flac|m4a|aac|opus|weba)$/i.test(f.name || ''));
    });
    if (!files.length) { if (typeof toast === 'function') toast('未选择音频文件'); if (onDone) onDone(); return; }
    var stamp = Date.now().toString(36);
    var made = files.map(function(file, i) {
      // 标题剥 < > " &(Codex P2:& 未转义会令 innerHTML 显示失真)·截60
      var title = String(file.name || '导入曲').replace(/\.[^.]+$/, '').replace(/[<>"&]/g, '').slice(0, 60) || '导入曲';
      // id 加随机段(Codex P1:防跨调用/跨tab 同毫秒同序号碰撞·put 会静默覆盖已有轨)
      var rand = Math.random().toString(36).slice(2, 8);
      return { id: 'user_' + stamp + '_' + rand + '_' + i, title: title, file: file };
    });
    made.forEach(function(m) { try { self.playlist.push({ id: m.id, title: m.title, meta: '导入', src: URL.createObjectURL(m.file), user: true }); } catch (_) {} });
    self._openUserBgmDB().then(function(db) {
      var tx = db.transaction('tracks', 'readwrite');
      var store = tx.objectStore('tracks');
      made.forEach(function(m) { try { store.put({ id: m.id, title: m.title, blob: m.file, addedAt: Date.now() }); } catch (_) {} });
      tx.oncomplete = function() { if (typeof toast === 'function') toast('已导入 ' + made.length + ' 首乐曲'); if (onDone) onDone(); };
      tx.onerror = function() { if (typeof toast === 'function') toast('已导入(本会话·持久化失败)'); if (onDone) onDone(); };
    }).catch(function() {
      if (typeof toast === 'function') toast('已导入 ' + made.length + ' 首(本会话·存储不可用)');
      if (onDone) onDone();
    });
  },
  // 开局/init 时从 IndexedDB 恢复用户导入曲目(异步·就绪后刷新面板)
  loadUserTracks: function(onDone) {
    var self = this;
    if (!self.playlist) self.loadPlaylist();
    self._openUserBgmDB().then(function(db) {
      var tx = db.transaction('tracks', 'readonly');
      var req = tx.objectStore('tracks').getAll();
      req.onsuccess = function() {
        (req.result || []).forEach(function(rec) {
          if (!rec || !rec.blob || !rec.id) return;
          if (self.playlist.some(function(t) { return t.id === rec.id; })) return;
          try { self.playlist.push({ id: rec.id, title: rec.title || '导入曲', meta: '导入', src: URL.createObjectURL(rec.blob), user: true }); } catch (_) {}
        });
        if (onDone) onDone();
      };
      req.onerror = function() { if (onDone) onDone(); };
    }).catch(function() { if (onDone) onDone(); });
  },
  // 移除一首导入曲目(仅 user 轨)：撤 object URL + 删 IndexedDB + 出 playlist
  removeUserTrack: function(id) {
    var self = this;
    var t = (self.playlist || []).find(function(x) { return x.id === id; });
    if (!t || !t.user) return false;
    if (self.bgm && self.bgmUrl === t.src) self.stopBgm();
    try { if (t.src) URL.revokeObjectURL(t.src); } catch (_) {}
    self.playlist = (self.playlist || []).filter(function(x) { return x.id !== id; });
    if (self.currentTrackId === id) { self.currentTrackId = (self.playlist[0] && self.playlist[0].id) || ''; self.saveSettings(); }
    self._openUserBgmDB().then(function(db) {
      // ★删除事务带回调(Codex P1:原无 onerror→失败静默→下次会话复活已删轨)
      try {
        var tx = db.transaction('tracks', 'readwrite');
        var rq = tx.objectStore('tracks').delete(id);
        rq.onerror = function() { try { console.warn('[BGM] 删除导入曲失败:', id, rq.error); } catch (_) {} };
        tx.onerror = function() { try { console.warn('[BGM] 删除导入曲事务失败:', id, tx.error); } catch (_) {} };
      } catch (e) { try { console.warn('[BGM] 删除导入曲异常:', e); } catch (_) {} }
    }).catch(function() {});
    if (typeof toast === 'function') toast('已移除导入乐曲');
    return true;
  },

  renderShellPanelHtml: function() {
    if (!this.playlist || !this.playlist.length) this.loadPlaylist();
    var current = this.getCurrentTrack();
    var enabledText = this.bgmEnabled ? '开' : '关';
    var bgmPct = Math.round(this.bgmVolume * 100);
    var sfxPct = Math.round(this.sfxVolume * 100);
    var html = '<div class="gs-panel-hdr"><div class="gs-panel-title">音 声 调 度</div><span class="gs-panel-cnt">' + enabledText + '</span></div>';
    html += '<div class="gs-audio-row"><span class="gs-audio-name">殿 乐</span><div class="gs-audio-ctrl"><input class="gs-audio-range" type="range" min="0" max="100" value="' + bgmPct + '" oninput="AudioSystem.setBgmVolume(this.value/100);var v=this.parentNode.parentNode.querySelector(\'.gs-audio-val\');if(v)v.textContent=this.value;"></div><span class="gs-audio-val">' + bgmPct + '</span></div>';
    html += '<div class="gs-audio-row"><span class="gs-audio-name">声 效</span><div class="gs-audio-ctrl"><input class="gs-audio-range" type="range" min="0" max="100" value="' + sfxPct + '" oninput="AudioSystem.setSfxVolume(this.value/100);var v=this.parentNode.parentNode.querySelector(\'.gs-audio-val\');if(v)v.textContent=this.value;"></div><span class="gs-audio-val">' + sfxPct + '</span></div>';
    html += '<div class="gs-audio-now">正 奏：<span class="h">' + (current ? current.title : '未配置曲目') + '</span>' + (current && current.meta ? '·' + current.meta : '') + '</div>';
    html += '<div class="gs-audio-custom">';
    html += '<button class="gs-audio-import" onclick="AudioSystem.toggleBgm();if(window.TM&&TM.UI&&TM.UI.shell&&typeof TM.UI.shell.refreshLeft===\'function\')TM.UI.shell.refreshLeft();">音 乐 开 关</button>';
    html += '<button class="gs-audio-import" onclick="AudioSystem._pickMusicFiles();">导 入 音 乐</button>';
    html += '<div class="gs-audio-lib">';
    if (this.playlist.length) {
      this.playlist.forEach(function(track) {
        var cls = current && current.id === track.id ? 'playing' : 'paused';
        var safeId = track.id.replace(/'/g, "\\'");
        var delBtn = track.user ? '<button class="gs-audio-del" title="移除导入乐曲" style="margin-left:auto;background:none;border:none;color:var(--vermillion-400,#c0563a);cursor:pointer;font-size:0.85em;line-height:1;padding:0 4px;flex:0 0 auto;" onclick="event.stopPropagation();AudioSystem.removeUserTrack(\'' + safeId + '\');if(window.TM&&TM.UI&&TM.UI.shell&&typeof TM.UI.shell.refreshLeft===\'function\')TM.UI.shell.refreshLeft();">✕</button>' : '';
        html += '<div class="gs-audio-song ' + cls + '" data-track-id="' + track.id + '" onclick="AudioSystem.playTrack(\'' + safeId + '\');if(window.TM&&TM.UI&&TM.UI.shell&&typeof TM.UI.shell.refreshLeft===\'function\')TM.UI.shell.refreshLeft();"><span class="title">' + track.title + '</span><span class="meta">' + (track.meta || '') + '</span>' + delBtn + '</div>';
      });
    } else {
      html += '<div class="gs-audio-song paused"><span class="title">请在 tm-bgm-config.js 配置曲目</span><span class="meta">BGM</span></div>';
    }
    html += '</div>';
    html += '<div class="gs-audio-loop">'
      + '<button class="gs-audio-loop-btn ' + (this.loopMode === 'sequence' ? 'active' : '') + '" onclick="AudioSystem.setLoopMode(\'sequence\');if(window.TM&&TM.UI&&TM.UI.shell&&typeof TM.UI.shell.refreshLeft===\'function\')TM.UI.shell.refreshLeft();">顺 序</button>'
      + '<button class="gs-audio-loop-btn ' + (this.loopMode === 'single' ? 'active' : '') + '" onclick="AudioSystem.setLoopMode(\'single\');if(window.TM&&TM.UI&&TM.UI.shell&&typeof TM.UI.shell.refreshLeft===\'function\')TM.UI.shell.refreshLeft();">单 曲</button>'
      + '<button class="gs-audio-loop-btn ' + (this.loopMode === 'random' ? 'active' : '') + '" onclick="AudioSystem.setLoopMode(\'random\');if(window.TM&&TM.UI&&TM.UI.shell&&typeof TM.UI.shell.refreshLeft===\'function\')TM.UI.shell.refreshLeft();">随 机</button>'
      + '</div>';
    html += '</div>';
    return html;
  },

  // 保存设置
  saveSettings: function() {
    var settings = {
      sfxVolume: this.sfxVolume,
      bgmVolume: this.bgmVolume,
      enabled: this.enabled,
      bgmEnabled: this.bgmEnabled,
      currentTrackId: this.currentTrackId,
      loopMode: this.loopMode,
      bgmPlaylistVersion: window.TM_BGM_PLAYLIST_VERSION || ''
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

GameHooks.on('enterGame:after', function() {
  if (!AudioSystem.playlist || !AudioSystem.playlist.length) AudioSystem.init();
  AudioSystem.stopBgm();
  AudioSystem.autoEnsureBgmPlaying('enterGame');
});

(function(){
  var wired = false;
  function isGameplayRunning() {
    try { return !!(window.GM && GM.running); } catch(_) { return false; }
  }
  function tryPlayMenu() {
    if (isGameplayRunning()) return;
    if (!AudioSystem.playlist || !AudioSystem.playlist.length) AudioSystem.init();
    AudioSystem.playMenuBgm();
  }
  window.TM_playMenuBgm = tryPlayMenu;
  if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function' && !wired) {
    wired = true;
    document.addEventListener('pointerdown', tryPlayMenu, { once: true, passive: true });
    document.addEventListener('keydown', tryPlayMenu, { once: true });
  }
})();

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

  var blob=new Blob([JSON.stringify(_tmStripAiKeyView(P),null,2)],{type:"application/json"});
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

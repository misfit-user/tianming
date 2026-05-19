// @ts-check
/// <reference path="types.d.ts" />
// ═══ 天命·更新公告弹窗 ═══
// 进入游戏首屏时若有未读更新，弹出邸报；主菜单可随时重开
(function() {
  'use strict';

  var STORAGE_KEY = 'tm.changelog.lastSeen';
  var _changelogData = null;
  var _loading = null;
  var _lastModalEntries = [];
  var _lastModalUnread = 0;

  function _load() {
    if (_changelogData) return Promise.resolve(_changelogData);
    if (_loading) return _loading;
    _loading = fetch('changelog.json?v=' + (window._TM_CACHE_V || Date.now()))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(j) {
        _changelogData = (j && Array.isArray(j.entries)) ? j : { entries: [] };
        return _changelogData;
      })
      .catch(function() { _changelogData = { entries: [] }; return _changelogData; });
    return _loading;
  }

  function _topSig(data) {
    if (!data || !data.entries || !data.entries.length) return '';
    // 用最新条目的 date+module+title 作指纹
    var e = data.entries[0];
    return (e.date || '') + '|' + (e.module || '') + '|' + (e.title || '');
  }

  function _getLastSeen() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; }
    catch (e) { return ''; }
  }

  function _setLastSeen(sig) {
    try { localStorage.setItem(STORAGE_KEY, sig); } catch (e) {}
  }

  function _formatDate(d) {
    if (!d) return '';
    return d; // 已是 YYYY-MM-DD 或 YYYY-MM-DD HH:mm
  }

  // R143·委托给 tm-utils.js:569 的 escHtml·有 fallback 防加载时序问题
  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : (s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')); }

  function _renderEntries(entries, unreadCount) {
    if (!entries || !entries.length) {
      return '<div style="text-align:center;color:var(--color-foreground-muted);padding:2rem;">暂无更新记录</div>';
    }
    var html = '';
    entries.forEach(function(e, idx) {
      var isNew = unreadCount != null && idx < unreadCount;
      html += '<div class="tm-cl-entry' + (isNew ? ' tm-cl-new' : '') + '">';
      html += '<div class="tm-cl-head">';
      html += '<span class="tm-cl-date">' + _esc(_formatDate(e.date)) + '</span>';
      html += '<span class="tm-cl-module">' + _esc(e.module || '更新') + '</span>';
      if (isNew) html += '<span class="tm-cl-badge">新</span>';
      html += '</div>';
      if (e.title) html += '<div class="tm-cl-title">' + _esc(e.title) + '</div>';
      if (Array.isArray(e.items) && e.items.length) {
        html += '<ul class="tm-cl-items">';
        e.items.forEach(function(it) {
          if (typeof it === 'string') {
            html += '<li>' + _esc(it) + '</li>';
          } else if (it && typeof it === 'object') {
            var what = _esc(it.what || it.text || '');
            var why = _esc(it.why || it.effect || '');
            html += '<li><span class="tm-cl-what">' + what + '</span>';
            if (why) html += '<span class="tm-cl-why">作用：' + why + '</span>';
            html += '</li>';
          }
        });
        html += '</ul>';
      }
      html += '</div>';
    });
    return html;
  }

  function _showModal(opts) {
    opts = opts || {};
    _load().then(function(data) {
      var entries = data.entries || [];
      var topSig = _topSig(data);
      var lastSeen = _getLastSeen();
      // 计算未读数（由顶向下，命中 lastSeen 之前的条目都算未读）
      var unread = 0;
      if (lastSeen) {
        for (var i = 0; i < entries.length; i++) {
          var sig = (entries[i].date || '') + '|' + (entries[i].module || '') + '|' + (entries[i].title || '');
          if (sig === lastSeen) break;
          unread++;
        }
      } else {
        unread = entries.length; // 从未读过，全部标新
      }

      // 移除旧弹窗
      var old = document.getElementById('tm-changelog-ov');
      if (old) old.remove();

      var ov = document.createElement('div');
      ov.id = 'tm-changelog-ov';
      ov.className = 'tm-cl-overlay';
      ov.onclick = function(e) { if (e.target === ov) _close(); };

      var header = '〔 邸 报 〕';
      var sub = unread > 0 ? ('本次更新 ' + unread + ' 条') : '最新动向';

      var html = '<div class="tm-cl-panel">';
      html += '<div class="tm-cl-panel-head">';
      html += '<div class="tm-cl-panel-title">' + header + '</div>';
      html += '<div class="tm-cl-panel-sub">' + sub + '</div>';
      html += '<button class="tm-cl-close" onclick="TM_Changelog.close()" aria-label="关闭">×</button>';
      html += '</div>';
      html += '<div class="tm-cl-body">' + _renderEntries(entries, unread) + '</div>';
      html += '<div class="tm-cl-foot">';
      if (unread > 0) {
        html += '<button class="bt bp" onclick="TM_Changelog.applyUpdate()">应用更新</button>';
        html += '<button class="bt bp" onclick="TM_Changelog.markRead()">已阅·闭卷</button>';
      } else {
        html += '<button class="bt bs" onclick="TM_Changelog.close()">收卷</button>';
      }
      html += '</div>';
      html += '</div>';
      ov.innerHTML = html;
      document.body.appendChild(ov);

      // 保存签名以便 markRead 使用
      ov._topSig = topSig;
      _lastModalEntries = entries.slice(0, Math.max(1, unread || 1));
      _lastModalUnread = unread || 0;

      // ESC 关闭
      var escHandler = function(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', escHandler);
          _close();
        }
      };
      document.addEventListener('keydown', escHandler);
      ov._escHandler = escHandler;
    });
  }

  function _close() {
    var ov = document.getElementById('tm-changelog-ov');
    if (ov) {
      if (ov._escHandler) document.removeEventListener('keydown', ov._escHandler);
      ov.remove();
    }
  }

  function _markRead() {
    var ov = document.getElementById('tm-changelog-ov');
    var sig = ov ? ov._topSig : '';
    if (sig) _setLastSeen(sig);
    _close();
  }

  function _applyUpdate() {
    var ov = document.getElementById('tm-changelog-ov');
    var sig = ov ? ov._topSig : _topSig(_changelogData);
    if (sig) _setLastSeen(sig);
    var entries = _lastModalEntries && _lastModalEntries.length ? _lastModalEntries : ((_changelogData && _changelogData.entries) || []).slice(0, Math.max(1, _lastModalUnread || 3));
    _close();
    var start = function() {
      if (window.TMContentManager && typeof window.TMContentManager.applyUpdateFromChangelog === 'function') {
        window.TMContentManager.applyUpdateFromChangelog(entries);
      } else if (window.openContentManager) {
        window.openContentManager();
        setTimeout(function(){
          if (window.TMContentManager && window.TMContentManager.switchTab) window.TMContentManager.switchTab('update');
        }, 100);
      } else {
        alert('更新模块尚未载入，请稍后再试。');
      }
    };
    setTimeout(start, 50);
    setTimeout(_updateDot, 80);
  }

  // 首屏自动弹出——仅在有未读时
  function _autoPopIfUnread() {
    _load().then(function(data) {
      if (!data || !data.entries || !data.entries.length) return;
      var topSig = _topSig(data);
      var lastSeen = _getLastSeen();
      if (lastSeen === topSig) return; // 已读过最新版
      // 首次访问或有新更新，弹出
      setTimeout(function() { _showModal(); }, 500);
    });
  }

  // 暴露 API
  window.TM_Changelog = {
    show: _showModal,
    close: _close,
    markRead: _markRead,
    applyUpdate: _applyUpdate,
    autoPop: _autoPopIfUnread,
    // 未读数供外部标记角标
    getUnreadCount: function() {
      return _load().then(function(data) {
        if (!data || !data.entries) return 0;
        var lastSeen = _getLastSeen();
        if (!lastSeen) return data.entries.length;
        for (var i = 0; i < data.entries.length; i++) {
          var e = data.entries[i];
          var sig = (e.date || '') + '|' + (e.module || '') + '|' + (e.title || '');
          if (sig === lastSeen) return i;
        }
        return data.entries.length;
      });
    }
  };

  // 邸报按钮红点联动
  function _updateDot() {
    var dot = document.getElementById('tm-cl-dot');
    if (!dot) return;
    window.TM_Changelog.getUnreadCount().then(function(n) {
      dot.style.display = n > 0 ? 'inline-block' : 'none';
    });
  }

  // 启动时自动检查——等启动画面就绪
  function _init() {
    _autoPopIfUnread();
    _updateDot();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // 监听关闭/标记后刷新红点
  var _origMark = _markRead;
  _markRead = function() { _origMark(); setTimeout(_updateDot, 50); };
  window.TM_Changelog.markRead = _markRead;
  window.TM_Changelog.updateDot = _updateDot;
})();

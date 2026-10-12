// map-editor-juben-handoff.js
// 地图编辑器 ↔ 剧本编辑器（御案）跳转往返桥 · 编辑器侧。
// 御案点「去地图编辑器」→ 写交接键 + 开本页(?tmFromJuben=1)；本脚本载入交接地图 + 注入「返回剧本」按钮。
// 返回时把当前 ME.EDITOR.map 写返回键，御案靠 storage 事件接收并经 applyMapPatch 写回。
// 键名与 scenario-editor-reset-app.js 约定一致。
(function () {
  'use strict';
  var HANDOFF_KEY = 'tm.scenarioEditorReset.mapHandoff.v1';
  var RETURN_KEY = 'tm.scenarioEditorReset.mapReturn.v1';
  // 治 quota：大地图（含 raster）落 IndexedDB，localStorage 只留小信号触发御案 storage 事件。
  // 复用 scenario-editor-reset-app.js 的同一库/表（键名 __mapReturn__），约定一致。
  var BRIDGE_DB_NAME = 'tm-scenario-editor-reset-projects';
  var BRIDGE_DB_STORE = 'projectBodies';
  var RETURN_DB_ID = '__mapReturn__';

  function openBridgeDb() {
    return new Promise(function (resolve) {
      try {
        if (!window.indexedDB) { resolve(null); return; }
        var req = indexedDB.open(BRIDGE_DB_NAME, 1);
        req.onupgradeneeded = function (ev) {
          var db = ev.target.result;
          if (!db.objectStoreNames.contains(BRIDGE_DB_STORE)) db.createObjectStore(BRIDGE_DB_STORE, { keyPath: 'id' });
        };
        req.onsuccess = function (ev) { resolve(ev.target.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  function bridgePut(id, body) {
    return openBridgeDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(BRIDGE_DB_STORE, 'readwrite');
          tx.objectStore(BRIDGE_DB_STORE).put({ id: id, body: body });
          tx.oncomplete = function () { db.close(); resolve(true); };
          tx.onerror = function () { db.close(); resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }
  function fromJuben() {
    try { return /[?&]tmFromJuben=1/.test(location.search); } catch (e) { return false; }
  }
  function readHandoff() {
    try { var raw = localStorage.getItem(HANDOFF_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function ME() { return (window.TM && window.TM.MapEditor) || null; }
  function ready() {
    var m = ME();
    return !!(m && m.EDITOR && m.EDITOR.canvas && typeof m.loadMap === 'function');
  }
  function whenReady(cb) {
    if (ready()) { cb(); return; }
    var tries = 0;
    var t = setInterval(function () {
      if (ready()) { clearInterval(t); cb(); }
      else if (++tries > 200) { clearInterval(t); }  // ~10s 放弃
    }, 50);
  }

  function injectReturnButton() {
    if (document.getElementById('juben-return-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'juben-return-btn';
    btn.type = 'button';
    btn.textContent = '← 返回剧本（写回地图）';
    btn.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99999;' +
      'padding:8px 18px;background:#c9a84c;color:#1a1206;border:1px solid #8a6a2c;border-radius:6px;' +
      'font:600 14px/1.4 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4);';
    btn.onmouseover = function () { btn.style.background = '#d9b85c'; };
    btn.onmouseout = function () { btn.style.background = '#c9a84c'; };
    btn.onclick = returnToJuben;
    document.body.appendChild(btn);
  }

  function returnToJuben() {
    var m = ME();
    if (!m || !m.EDITOR || !m.EDITOR.map) { alert('地图未就绪，无法返回'); return; }
    // 提交 raster 脏改（同 exportJSON 前置）
    try { if (window.TM && TM.MapEditor && TM.MapEditor.rastermaps) TM.MapEditor.rastermaps.commitAllDirty(); } catch (e) {}
    var payload = { createdAt: new Date().toISOString(), source: 'map-editor', native: m.EDITOR.map };
    // 大地图先落 IndexedDB（治 quota），成功后 localStorage 只写小信号触发御案 storage 事件。
    bridgePut(RETURN_DB_ID, payload).then(function (ok) {
      if (ok) {
        try { localStorage.setItem(RETURN_KEY, JSON.stringify({ idb: true, createdAt: payload.createdAt, ts: Date.now() })); }
        catch (e) { /* 信号仅几十字节，几乎不会爆；万一爆，数据已在 IDB，御案 focus 兜底仍可读 */ }
        finishReturn();
        return;
      }
      // IndexedDB 不可用：退回旧内联写法（小地图仍可），真爆配额则如实告知
      try { localStorage.setItem(RETURN_KEY, JSON.stringify(payload)); }
      catch (err) { alert('写回失败（地图可能过大且本地库不可用）：' + (err && err.message || err)); return; }
      finishReturn();
    });
  }

  function finishReturn() {
    try { localStorage.removeItem(HANDOFF_KEY); } catch (e) {}
    // 只有真正由御案 window.open 出来的子窗才允许 close。Electron 单窗 / 直接
    // 导航到地图编辑器时 window.close() 会关闭承载游戏的主窗，表现为游戏闪退。
    // 主窗和被拦截弹窗统一走 history.back()，返回御案后由 storage/focus 接收写回。
    var hasOpener = false;
    try { hasOpener = !!(window.opener && !window.opener.closed); } catch (e) {}
    if (hasOpener) {
      // Electron/Chromium may refuse a scripted close (for example when the
      // tab was opened by a redirect rather than window.open).  Keep the
      // close-first behaviour for a real child window, but retain a bounded
      // history fallback so the user is never stranded in the editor.
      try { window.close(); } catch (e) {}
      setTimeout(function () {
        var closed = false;
        try { closed = !!window.closed; } catch (e) {}
        if (closed) return;
        try { history.back(); } catch (e) {}
      }, 150);
      return;
    }
    try { history.back(); } catch (e) {}
  }

  function start() {
    if (!fromJuben()) return;
    var handoff = readHandoff();
    whenReady(function () {
      var m = ME();
      if (handoff && handoff.native && handoff.native.divisions && handoff.native.divisions.length) {
        try { m.loadMap(handoff.native); } catch (e) { console.error('[juben-handoff] loadMap 失败', e); }
      }
      injectReturnButton();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // 暴露给 e2e/调试
  window.JubenMapHandoff = { returnToJuben: returnToJuben, readHandoff: readHandoff, _keys: { HANDOFF_KEY: HANDOFF_KEY, RETURN_KEY: RETURN_KEY } };
})();

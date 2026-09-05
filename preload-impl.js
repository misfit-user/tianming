/*
 * ============================================================
 *  天命 · 预加载桥接脚本
 *  
 *  这个文件的作用：
 *  在"网页"和"电脑系统"之间架一座桥
 *  网页可以通过 window.tianming.xxx() 安全地调用系统功能
 * ============================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

const ONLINE_RENDERER_BODY_LIMIT_DEFAULT = 1024 * 1024;
const ONLINE_RENDERER_BODY_LIMIT_LARGE = 4 * 1024 * 1024;
const ONLINE_RENDERER_LARGE_BODY_ROUTES = new Set([
  'arena/submit', 'chronicles/publish', 'revision/propose', 'workshop/upload'
]);

function _onlineRouteName(pathname) {
  return String(pathname || '').replace(/^\/+/, '').split(/[?#]/)[0];
}

function _assertOnlineBodySize(pathname, body) {
  if (body == null) return body;
  const route = _onlineRouteName(pathname);
  const limit = ONLINE_RENDERER_LARGE_BODY_ROUTES.has(route)
    ? ONLINE_RENDERER_BODY_LIMIT_LARGE
    : ONLINE_RENDERER_BODY_LIMIT_DEFAULT;
  const bytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (bytes > limit) throw new Error('在线请求内容超过 ' + Math.floor(limit / (1024 * 1024)) + 'MB 上限');
  return body;
}

function _newSessionToken() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    }
  } catch (_) {}
  throw new Error('secure random generator unavailable');
}

let _autoSaveSessionToken = '';
try {
  const current = ipcRenderer.sendSync('auto-save-session-current');
  if (current && current.success && current.token) _autoSaveSessionToken = String(current.token);
} catch (_) {}
// sidecar 尚不存在时先在 preload 固定一个非空 token（暂不持久化）；这样首个写请求即使排队期间
// 遇到读档/新局 rotate，也携带旧 token 而不会被主进程误收编进新 session。
if (!_autoSaveSessionToken) _autoSaveSessionToken = _newSessionToken();

function _invokeAutoSave(data) {
  return ipcRenderer.invoke('auto-save', {
    __tmAutoSaveEnvelope: 1,
    sessionToken: _autoSaveSessionToken,
    data: data
  }).then(function(result) {
    if (result && result.sessionToken) _autoSaveSessionToken = String(result.sessionToken);
    return result;
  });
}

function _rotateAutoSaveSession(token) {
  try {
    const result = ipcRenderer.sendSync('auto-save-session-rotate', String(token || ''));
    if (result && result.success && result.token) _autoSaveSessionToken = String(result.token);
    return result || { success: false, error: '主进程未返回 session 结果' };
  } catch (e) {
    return { success: false, error: e && e.message || String(e) };
  }
}

function _subscribeRendererEvent(channel, callback) {
  if (typeof callback !== 'function') throw new TypeError(channel + ' listener must be a function');
  const listener = (_event, payload) => callback(payload);
  let active = true;
  ipcRenderer.on(channel, listener);
  return function dispose() {
    if (!active) return false;
    active = false;
    ipcRenderer.removeListener(channel, listener);
    return true;
  };
}

function _subscribeAppCloseFlush(callback) {
  if (typeof callback !== 'function') throw new TypeError('app-close-flush-request listener must be a function');
  const listener = (_event, payload) => {
    const requestId = payload && String(payload.requestId || '');
    if (!requestId) return;
    Promise.resolve().then(() => callback(Object.freeze({
      reason: String(payload && payload.reason || 'app-quit')
    }))).then(result => {
      const ok = !(result && result.ok === false);
      ipcRenderer.send('app-close-flush-complete', {
        requestId,
        ok,
        code: ok ? '' : String(result && result.code || 'background-save-flush-failed'),
        reason: String(result && result.reason || (ok ? 'background-saves-flushed' : 'background save flush failed'))
      });
    }, error => {
      ipcRenderer.send('app-close-flush-complete', {
        requestId,
        ok: false,
        code: 'background-save-flush-exception',
        reason: error && error.message || String(error)
      });
    });
  };
  let active = true;
  ipcRenderer.on('app-close-flush-request', listener);
  return function dispose() {
    if (!active) return false;
    active = false;
    ipcRenderer.removeListener('app-close-flush-request', listener);
    return true;
  };
}

// 把这些功能暴露给网页中的 JavaScript
contextBridge.exposeInMainWorld('tianming', {

  // === 标识：告诉网页"我在桌面环境中运行" ===
  isDesktop: true,
  platform: process.platform,  // 'win32' / 'darwin' / 'linux'

  // === 存档功能 ===
  saveProject: (filename, data) =>
    ipcRenderer.invoke('save-project', { filename, data }),

  loadProject: (filename) =>
    ipcRenderer.invoke('load-project', filename),

  listSaves: () =>
    ipcRenderer.invoke('list-saves'),

  listSaveTimelineRefs: () =>
    ipcRenderer.invoke('list-save-timeline-refs'),

  deleteSave: (filename) =>
    ipcRenderer.invoke('delete-save', filename),

  // === 自动存档 ===
  autoSave: (data) =>
    _invokeAutoSave(data),

  rotateAutoSaveSession: (token) =>
    _rotateAutoSaveSession(token),

  getAutoSaveSessionToken: () =>
    _autoSaveSessionToken,

  loadAutoSave: () =>
    ipcRenderer.invoke('load-auto-save'),

  // === 系统对话框 ===
  dialogExport: (data, opts) =>
    ipcRenderer.invoke('dialog-export', data, opts),

  dialogImport: () =>
    ipcRenderer.invoke('dialog-import'),

  dialogLoadImage: () =>
    ipcRenderer.invoke('dialog-load-image'),

  dialogLoadGeoJSON: () =>
    ipcRenderer.invoke('dialog-load-geojson'),

  // === 工具 ===
  openSaveDir: () =>
    ipcRenderer.invoke('open-save-dir'),

  quitApp: () =>
    ipcRenderer.invoke('app-quit'),

  onAppCloseFlushRequest: (callback) =>
    _subscribeAppCloseFlush(callback),

  // === 读 web 目录文本文件（国师源码工具·file:// 下 fetch 不可用的桌面通道）===
  readWebFile: (relPath) =>
    ipcRenderer.invoke('read-web-file', relPath),

  // === 窗口显示模式（全屏 / 窗口）===
  setFullScreen: (flag) =>
    ipcRenderer.invoke('set-fullscreen', flag),
  isFullScreen: () =>
    ipcRenderer.invoke('get-fullscreen'),

  getAppInfo: () =>
    ipcRenderer.invoke('get-app-info'),

  // === 调试日志 ===
  debugLog: (entries) =>
    ipcRenderer.invoke('debug-log', entries),

  openLogDir: () =>
    ipcRenderer.invoke('open-log-dir'),

  debugLogInfo: () =>
    ipcRenderer.invoke('debug-log-info'),

  // === 在线更新 ===
  onlineServiceStatus: () =>
    ipcRenderer.invoke('online-service-status'),

  // 在线账号与社区请求由主进程固定域名、固定路由代发；Bearer Token 永不进入 renderer。
  onlineRequest: (method, pathname, body) => {
    try {
      return ipcRenderer.invoke('online-request', { method, pathname, body: _assertOnlineBodySize(pathname, body) });
    } catch (error) {
      return Promise.reject(error);
    }
  },

  accountSession: () =>
    ipcRenderer.invoke('account-session'),

  accountRegister: (username, password, nickname) =>
    ipcRenderer.invoke('account-register', { username, password, nickname }),

  accountLogin: (username, password) =>
    ipcRenderer.invoke('account-login', { username, password }),

  accountMe: () =>
    ipcRenderer.invoke('account-me'),

  accountLogout: () =>
    ipcRenderer.invoke('account-logout'),

  checkForUpdate: () =>
    ipcRenderer.invoke('update-check'),

  downloadUpdate: () =>
    ipcRenderer.invoke('update-download'),

  installUpdate: () =>
    ipcRenderer.invoke('update-install'),

  onUpdateStatus: (callback) =>
    _subscribeRendererEvent('update-status', callback),

  // === renderer/web 热更新 ===
  hotUpdateStatus: () =>
    ipcRenderer.invoke('hot-update-status'),

  checkHotUpdate: () =>
    ipcRenderer.invoke('hot-update-check'),

  installHotUpdate: () =>
    ipcRenderer.invoke('hot-update-download-install'),

  setHotUpdateEnabled: (enabled) =>
    ipcRenderer.invoke('hot-update-set-enabled', !!enabled),

  rollbackHotUpdate: () =>
    ipcRenderer.invoke('hot-update-rollback'),

  reloadAfterHotUpdate: () =>
    ipcRenderer.invoke('hot-update-reload'),

  openHotUpdateDir: () =>
    ipcRenderer.invoke('hot-update-open-dir'),

  onHotUpdateStatus: (callback) =>
    _subscribeRendererEvent('hot-update-status', callback),

  // === 内容与创意工坊 ===
  contentStatus: () =>
    ipcRenderer.invoke('content-status'),

  importWorkshopPack: (overwrite) =>
    ipcRenderer.invoke('workshop-import-pack', { overwrite: !!overwrite }),

  loadWorkshopCatalog: (catalogUrl) =>
    ipcRenderer.invoke('workshop-catalog', { catalogUrl }),

  installWorkshopPackFromUrl: (packageUrl, sha256, overwrite) =>
    ipcRenderer.invoke('workshop-install-from-url', { packageUrl, sha256, overwrite: !!overwrite }),

  publishWorkshopPack: (pack) =>
    ipcRenderer.invoke('workshop-publish-pack', pack || {}),

  listWorkshopPacks: () =>
    ipcRenderer.invoke('workshop-list-packs'),

  setWorkshopPackEnabled: (id, enabled) =>
    ipcRenderer.invoke('workshop-set-enabled', { id, enabled }),

  uninstallWorkshopPack: (id) =>
    ipcRenderer.invoke('workshop-uninstall', id),

  openWorkshopDir: () =>
    ipcRenderer.invoke('workshop-open-dir'),

  loadEnabledWorkshopScenarios: () =>
    ipcRenderer.invoke('workshop-load-enabled-scenarios'),

  // === 剧本功能 ===
  listScenarios: () =>
    ipcRenderer.invoke('list-scenarios'),

  saveScenario: (filename, data) =>
    ipcRenderer.invoke('save-scenario', { filename, data }),

  loadScenario: (filename) =>
    ipcRenderer.invoke('load-scenario', filename),

  deleteScenario: (filename) =>
    ipcRenderer.invoke('delete-scenario', filename),

  openScenariosDir: () =>
    ipcRenderer.invoke('open-scenarios-dir'),

  // === 每回合数据 ===
  turnDataProtocolVersion: 2,
  stageTurnData: (payload) =>
    ipcRenderer.invoke('stage-turn-data', payload),

  publishTurnData: (payload) =>
    ipcRenderer.invoke('publish-turn-data', payload),

  recoverTurnData: (payload) =>
    ipcRenderer.invoke('recover-turn-data', payload),

  discardTurnData: (payload) =>
    ipcRenderer.invoke('discard-turn-data', payload),

  writeTurnData: (saveName, turn, data) =>
    ipcRenderer.invoke('write-turn-data', { saveName, turn, data }),

  readTurnData: (identity, turn) =>
    ipcRenderer.invoke('read-turn-data', Object.assign({}, identity, { turn })),

  listTurnData: (identity) =>
    ipcRenderer.invoke('list-turn-data', identity),

  readTurnsSummary: (identity, fromTurn, toTurn) =>
    ipcRenderer.invoke('read-turns-summary', Object.assign({}, identity, { fromTurn, toTurn })),

  deleteTurnData: (identity) => ipcRenderer.invoke('delete-turn-data', identity),

  openTurnDataDir: () =>
    ipcRenderer.invoke('open-turn-data-dir'),

  // === 接收主进程发来的消息 ===
  onMenuAction: (callback) =>
    _subscribeRendererEvent('menu-action', callback),

  onImportData: (callback) =>
    _subscribeRendererEvent('import-project-data', callback),
});

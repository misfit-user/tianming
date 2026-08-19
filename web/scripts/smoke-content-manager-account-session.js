#!/usr/bin/env node
'use strict';
// 工坊账号会话：新登录必须重读社交数据；401/失效必须同时清 storage 与内存用户；网络错误可手动重试。

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(ROOT, 'tm-content-manager.js'), 'utf8');
const community = fs.readFileSync(path.join(ROOT, 'tm-content-manager-community.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const onlineClientModule = require(path.join(ROOT, 'tm-online-client.js'));
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS ' + msg); } else { fail++; console.error('  FAIL ' + msg); } }
function sliceFn(src, marker) {
  const a = src.indexOf(marker); if (a < 0) return '';
  let i = src.indexOf('{', a), depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}' && --depth === 0) { j++; break; } }
  return src.slice(a, j);
}

const resetSrc = sliceFn(community, 'function resetAccountRemoteState(');
const identitySrc = sliceFn(community, 'function accountSessionIdentity(');
const replaceSrc = sliceFn(community, 'function replaceAccountSession(');
const invalidateSrc = sliceFn(community, 'function invalidateAccountSession(');
const refreshSrc = sliceFn(community, 'async function refreshAccountSession(');
const accountRefreshSrc = sliceFn(community, 'async function accountRefresh(');
const setEmailSrc = sliceFn(community, 'async function accountSetEmail(');
const logoutSrc = sliceFn(community, 'async function accountLogout(');
const expiredSrc = sliceFn(community, 'function _sessionExpiredError(');
const epochSrc = sliceFn(community, 'function _accountEpoch(');
const sameEpochSrc = sliceFn(community, 'function _sameAccountEpoch(');
const invalidateExpiredSrc = sliceFn(community, 'function _invalidateExpiredAtEpoch(');
const loadFriendsSrc = sliceFn(community, 'function loadFriends(');
ok(!!resetSrc && !!identitySrc && !!replaceSrc && !!invalidateSrc && !!refreshSrc && !!accountRefreshSrc && !!setEmailSrc && !!logoutSrc && !!expiredSrc && !!epochSrc && !!sameEpochSrc && !!invalidateExpiredSrc && !!loadFriendsSrc, '可抽取会话重置/身份替换/失效判定真代码');

let cleared = 0;
const online = {
  getSession: () => ({ token: 'new-token', user: { id: 2, username: 'new' } }),
  clearSession: () => { cleared++; }
};
const ctx = {
  state: {
    accountSession: { token: 'old-token', user: { id: 1, username: 'old' } },
    accountSessionEpoch: 7,
    friendsLoaded: true, friendsLoading: true, friendsStatus: 'error', friendsError: 'old', friendsData: { friends: [1] }, friendMessage: 'old',
    notifLoaded: true, notifLoading: true, notifStatus: 'error', notifError: 'old', notifData: { notifications: [1] }, notifMsg: 'old',
    dmOpen: true, dmView: 'chat', dmPeer: { id: 9 }, dmInbox: [1], dmMessages: [1], dmLoadStatus: 'error', dmLoadError: 'old', dmMsg: 'old'
  },
  window: { TM: { OnlineClient: online } }, TM: { OnlineClient: online }, Number, String
};
vm.createContext(ctx);
vm.runInContext(resetSrc + '\n' + identitySrc + '\n' + replaceSrc + '\n' + invalidateSrc + '\n' + refreshSrc + '\n' + expiredSrc, ctx);

(async function() {
  await ctx.refreshAccountSession();
  ok(ctx.state.accountSession && ctx.state.accountSession.user.username === 'new', '登录成功后内存会话切换为新用户');
  ok(ctx.state.friendsLoaded === false && ctx.state.friendsLoading === false && ctx.state.notifLoaded === false && ctx.state.notifLoading === false, '登录成功后好友/通知缓存与 loading 全复位');
  ok(ctx.state.dmOpen === false && ctx.state.dmView === 'inbox' && ctx.state.dmPeer === null && ctx.state.dmInbox.length === 0 && ctx.state.dmMessages.length === 0, '登录成功后旧私信身份与视图清空');
  ok(ctx.state.accountSessionEpoch === 8, '登录身份切换递增 epoch，使旧异步请求失效');

  ctx.invalidateAccountSession('登录已失效，请重新登录。');
  ok(cleared === 1 && ctx.state.accountSession === null, '认证失效同时清 storage token 与 state.accountSession');
  ok(ctx.state.accountMessage === '登录已失效，请重新登录。', '认证失效给出重新登录提示');
  ok(ctx.state.accountSessionEpoch === 9, '认证失效再次递增 epoch');
  ok(ctx._sessionExpiredError({ status: 401 }) && ctx._sessionExpiredError({ error: 'Unauthorized' }) && ctx._sessionExpiredError(new Error('请先登录')) && ctx._sessionExpiredError(new Error('Unauthorized')) && !ctx._sessionExpiredError(new Error('网络超时')), '401/中英文登录错误与普通网络错误正确分流');

  const invalidations = community.match(/invalidateAccountSession\('登录已失效，请重新登录。'\)/g) || [];
  ok(invalidations.length >= 6, '身份刷新、好友、通知与两条私信认证失败入口都清理完整会话');
  ok((community.match(/if \(!_sameAccountEpoch\(requestEpoch\)\) return;/g) || []).length >= 8, '好友、通知和私信成功/失败回调都拒绝旧身份 epoch');
  ok(((main + community).match(/replaceAccountSession\(/g) || []).length >= 4, '网页/桌面重开工坊与登录刷新统一走身份替换入口');
  ok(((main + community).match(/state\.accountSession\s*=/g) || []).length === 2, '账号内存身份只允许由替换/失效两个集中写口修改');
  ok(/replaceAccountSession\(\(onlineSession && \(onlineSession\.loggedIn \|\| onlineSession\.user\)\)/.test(community),
    '更新中心读取无 token 的桌面公开会话时仍优先当前在线身份，不复活旧 IPC 身份');
  ok((community.match(/_invalidateExpiredAtEpoch\(/g) || []).length >= 10, '好友、通知与私信写操作的 resolved/rejected 认证失败都统一失效会话');
  ok(/accountRefresh[\s\S]*?var requestEpoch = _accountEpoch\(\)[\s\S]*?_sameAccountEpoch\(requestEpoch\)/.test(community), '手动身份刷新拒绝旧账号晚到回包');
  ok(/tm-online-client\.js\?v=20260811-auditfix1/.test(indexHtml), '在线客户端修复已刷新运行时缓存戳');
  ok(/refreshFriends:\s*function/.test(main) && /TMContentManager\.refreshFriends\(\)/.test(community), '好友瞬时失败提供可达重试入口');
  ok(/if \(me && me\.loggedIn\)[\s\S]*?await refreshAccountSession\(\);[\s\S]*?else invalidateAccountSession\('登录已失效，请重新登录。'\)/.test(community), '手动刷新遇已失效 token 也清除内存用户');

  let resolveFriends, resolveRequests;
  const staleOnline = {
    isLoggedIn: () => true,
    friends: () => new Promise((resolve) => { resolveFriends = resolve; }),
    friendRequests: () => new Promise((resolve) => { resolveRequests = resolve; })
  };
  const staleCtx = {
    state: { accountSessionEpoch: 3, friendsData: null, friendsLoaded: false, friendsLoading: false, friendsStatus: 'idle', friendsError: '' },
    window: { TM: { OnlineClient: staleOnline } }, TM: { OnlineClient: staleOnline }, Number, String,
    render: () => { staleCtx.renderCount++; }, renderCount: 0,
    invalidateAccountSession: () => { staleCtx.invalidated = true; }
  };
  vm.createContext(staleCtx);
  vm.runInContext(resetSrc + '\n' + expiredSrc + '\n' + epochSrc + '\n' + sameEpochSrc + '\n' + loadFriendsSrc, staleCtx);
  staleCtx.loadFriends();
  staleCtx.resetAccountRemoteState();
  resolveFriends({ success: true, friends: [{ id: 1 }] });
  resolveRequests({ success: true, incoming: [], outgoing: [] });
  await Promise.resolve(); await Promise.resolve();
  ok(staleCtx.state.accountSessionEpoch === 4 && staleCtx.state.friendsData === null && staleCtx.renderCount === 0 && !staleCtx.invalidated,
    '旧账号好友请求晚到时不回写、不重渲、也不使新会话失效');

  const storageData = new Map();
  const storage = {
    getItem: (key) => storageData.has(key) ? storageData.get(key) : null,
    setItem: (key, value) => storageData.set(key, String(value)),
    removeItem: (key) => storageData.delete(key)
  };
  let finishOldLogout = null;
  function response(data) { return { ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(data)) }; }
  const raceClient = onlineClientModule.createOnlineClient({
    storage,
    fetch: (url, init) => {
      if (/account\/logout$/.test(url)) return new Promise((resolve) => { finishOldLogout = () => resolve(response({ success: true })); });
      if (/account\/login$/.test(url)) {
        const body = JSON.parse(init.body || '{}');
        const suffix = body.username === 'new' ? 'new' : 'old';
        return Promise.resolve(response({ success: true, token: 'token-' + suffix, user: { id: suffix, username: suffix } }));
      }
      return Promise.resolve(response({ success: true }));
    }
  });
  await raceClient.login({ username: 'old', password: '12345678' });
  const oldLogout = raceClient.logout();
  await raceClient.login({ username: 'new', password: '12345678' });
  finishOldLogout();
  await oldLogout;
  ok(raceClient.getSession().token === 'token-new' && raceClient.getSession().user.username === 'new',
    '旧账号登出请求晚到时不会清除新账号 token');

  let finishUiLogout = null;
  let persistedUiSession = { token: 'token-old', user: { id: 'old', username: 'old' } };
  const uiOnline = {
    logout: () => new Promise((resolve) => { finishUiLogout = resolve; }),
    getSession: () => persistedUiSession
  };
  const logoutCtx = {
    state: {
      accountSession: persistedUiSession, accountSessionEpoch: 0, accountMessage: '', onlineApiUrl: '',
      friendsLoaded: true, friendsLoading: false, friendsStatus: 'ok', friendsError: '', friendsData: {}, friendMessage: '',
      notifLoaded: true, notifLoading: false, notifStatus: 'ok', notifError: '', notifData: {}, notifMsg: '',
      dmOpen: false, dmView: 'inbox', dmPeer: null, dmInbox: [], dmMessages: [], dmLoadStatus: 'idle', dmLoadError: '', dmMsg: ''
    },
    TM: { OnlineClient: uiOnline }, Number, String,
    render: () => { logoutCtx.renderCount++; }, renderCount: 0
  };
  vm.createContext(logoutCtx);
  vm.runInContext(resetSrc + '\n' + identitySrc + '\n' + replaceSrc + '\n' + epochSrc + '\n' + sameEpochSrc + '\n' + logoutSrc, logoutCtx);
  const uiLogout = logoutCtx.accountLogout();
  persistedUiSession = { token: 'token-new', user: { id: 'new', username: 'new' } };
  finishUiLogout({ success: true });
  await uiLogout;
  ok(logoutCtx.state.accountSession && logoutCtx.state.accountSession.user.username === 'new' && /保留新的登录/.test(logoutCtx.state.accountMessage),
    '工坊旧登出回包晚到时也保留新账号内存身份');

  console.log('[smoke-content-manager-account-session] ' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(function(err) {
  console.error(err && err.stack || err);
  process.exit(1);
});

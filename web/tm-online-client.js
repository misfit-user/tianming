// Tianming online client — platform-agnostic fetch client for the tianming-api
// (accounts + workshop catalog). Works identically in the browser (web build)
// and the Electron renderer; the desktop main process keeps its own IPC path
// for disk-level work (pack install, auto-update). This module covers only the
// pure network calls, so a web player can register / login / browse the catalog
// with no Electron dependency.
//
// Mirrors the request semantics of main-impl.js postOnlineApi / getOnlineApi:
//   - apiUrl is the tianming-api base, normalised to a trailing slash
//   - paths are joined via new URL(path, base)
//   - a stored Bearer token is attached automatically
//   - the API returns JSON (incl. { success:false, error } on 4xx) which we
//     surface verbatim to callers, matching the desktop IPC handlers.
//
// Session is persisted as JSON under localStorage key `tm_online_session`
// (the Electron side persists to userData/.../account-session.json instead).
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // node: require for tests
  }
  if (root) {
    root.TM = root.TM || {};
    // default singleton + factory for callers that want an isolated instance
    root.TM.createOnlineClient = api.createOnlineClient;
    root.TM.OnlineClient = api.createOnlineClient();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var DEFAULT_API_URL = 'https://api.themisfitserspeople.top/tianming-api/';
  var SESSION_KEY = 'tm_online_session';
  var API_URL_KEY = 'tm_online_api_url';

  // ---- storage adapter: localStorage in browser, in-memory elsewhere -------
  function makeStorage(injected) {
    if (injected) return injected;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        // probe — some environments throw on access (private mode, sandbox)
        localStorage.getItem(SESSION_KEY);
        return localStorage;
      }
    } catch (e) {}
    var mem = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  }

  function normalizeApiUrl(raw) {
    var url = String(raw || '').trim();
    if (!url) return '';
    return url.charAt(url.length - 1) === '/' ? url : url + '/';
  }

  function joinUrl(base, pathname) {
    var p = String(pathname || '').replace(/^\/+/, '');
    return new URL(p, base).toString();
  }

  function createOnlineClient(opts) {
    opts = opts || {};
    var storage = makeStorage(opts.storage);
    var doFetch = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : null) : null);
    // B2（批B）：上传进度需 XMLHttpRequest（fetch 无原生上传进度事件）。可注入便于测试。
    var XHR = opts.XMLHttpRequest || (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : null);
    var defaultApiUrl = normalizeApiUrl(opts.apiUrl || DEFAULT_API_URL);

    function readSession() {
      try {
        var raw = storage.getItem(SESSION_KEY);
        if (!raw) return { token: '', apiUrl: getApiUrl(), user: null };
        var s = JSON.parse(raw) || {};
        return {
          token: String(s.token || ''),
          apiUrl: normalizeApiUrl(s.apiUrl || getApiUrl()),
          user: s.user && typeof s.user === 'object' ? s.user : null,
          loggedInAt: s.loggedInAt || ''
        };
      } catch (e) {
        return { token: '', apiUrl: getApiUrl(), user: null };
      }
    }

    function writeSession(session) {
      var payload = {
        token: String((session && session.token) || ''),
        apiUrl: normalizeApiUrl((session && session.apiUrl) || getApiUrl()),
        user: (session && session.user) || null,
        loggedInAt: (session && session.loggedInAt) || new Date().toISOString()
      };
      try { storage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch (e) {}
      return payload;
    }

    function clearSession() {
      try { storage.removeItem(SESSION_KEY); } catch (e) {}
    }

    function getApiUrl() {
      try {
        var saved = storage.getItem(API_URL_KEY);
        if (saved) return normalizeApiUrl(saved);
      } catch (e) {}
      return defaultApiUrl;
    }

    function setApiUrl(url) {
      var norm = normalizeApiUrl(url) || defaultApiUrl;
      try { storage.setItem(API_URL_KEY, norm); } catch (e) {}
      return norm;
    }

    function getToken() { return readSession().token; }
    function getSession() { return readSession(); }
    function isLoggedIn() { return !!readSession().token; }

    // ---- core request ------------------------------------------------------
    // Returns parsed JSON (incl. { success:false, error } on handled 4xx).
    // Throws only on network failure or an unparseable error response.
    function request(method, pathname, reqOpts) {
      reqOpts = reqOpts || {};
      if (!doFetch) return Promise.reject(new Error('当前环境不支持 fetch'));
      var apiUrl = normalizeApiUrl(reqOpts.apiUrl || readSession().apiUrl || getApiUrl());
      if (!apiUrl) return Promise.reject(new Error('缺少在线服务地址'));
      var url = joinUrl(apiUrl, pathname);
      var token = reqOpts.token != null ? String(reqOpts.token) : getToken();
      var headers = { 'Accept': 'application/json' };
      if (reqOpts.body != null) headers['Content-Type'] = 'application/json';
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var init = { method: method, headers: headers, mode: 'cors', cache: 'no-store' };
      if (reqOpts.body != null) init.body = JSON.stringify(reqOpts.body);
      return doFetch(url, init).then(function (resp) {
        return resp.text().then(function (text) {
          var data = null;
          if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
          if (data == null) {
            if (!resp.ok) throw new Error('在线服务返回 ' + resp.status);
            return {};
          }
          return data;
        });
      });
    }

    // ---- account -----------------------------------------------------------
    function health(apiUrl) {
      return request('GET', 'health', { apiUrl: apiUrl, token: '' });
    }

    function register(info, apiUrl) {
      info = info || {};
      var payload = {
        username: String(info.username || '').trim(),
        password: String(info.password || ''),
        nickname: String(info.nickname || '').trim(),
        email: String(info.email || '').trim()
      };
      return request('POST', 'account/register', { body: payload, token: '', apiUrl: apiUrl }).then(function (res) {
        if (res && res.success && res.token) writeSession({ token: res.token, apiUrl: normalizeApiUrl(apiUrl || getApiUrl()), user: res.user || null });
        return Object.assign({ success: false }, res || {});
      });
    }

    // 邮箱验证码登录（免密）：请求登录码 -> 用码登录（新邮箱自动注册）。
    function emailCodeRequest(email, apiUrl) {
      return request('POST', 'account/email-code', { body: { email: String(email || '').trim() }, token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function emailLogin(email, code, apiUrl) {
      return request('POST', 'account/email-login', { body: { email: String(email || '').trim(), code: String(code || '').trim() }, token: '', apiUrl: apiUrl })
        .then(function (res) {
          if (res && res.success && res.token) writeSession({ token: res.token, apiUrl: normalizeApiUrl(apiUrl || getApiUrl()), user: res.user || null });
          return Object.assign({ success: false }, res || {});
        });
    }

    // 账号找回（QQ 邮箱）：请求验证码 -> 用验证码重置密码。
    function requestReset(email, apiUrl) {
      return request('POST', 'account/request-reset', { body: { email: String(email || '').trim() }, token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function resetPassword(email, code, password, apiUrl) {
      return request('POST', 'account/reset', { body: { email: String(email || '').trim(), code: String(code || '').trim(), password: String(password || '') }, token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function setEmail(email, apiUrl) {
      var session = readSession();
      return request('POST', 'account/set-email', { body: { email: String(email || '').trim() }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) {
          if (res && res.success && res.user) writeSession({ token: session.token, apiUrl: normalizeApiUrl(apiUrl || session.apiUrl), user: res.user });
          return Object.assign({ success: false }, res || {});
        });
    }

    // 给工坊包评分（1-5 星，登录态，每用户每包一票，重复评分覆盖）
    function ratePack(id, score, apiUrl) {
      var session = readSession();
      return request('POST', 'workshop/rate', { body: { id: String(id || ''), score: Number(score) || 0 }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    // 单个工坊包最新元数据（用于已装包的更新检查）。
    function packMeta(id, apiUrl) {
      return request('GET', 'workshop/pack?id=' + encodeURIComponent(String(id || '')), { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    // 某作者的全部已上架作品（作者主页）。
    function authorPacks(opts, apiUrl) {
      opts = opts || {};
      var qs = opts.authorId != null && opts.authorId !== '' ? ('authorId=' + encodeURIComponent(opts.authorId)) : ('name=' + encodeURIComponent(opts.name || ''));
      return request('GET', 'workshop/author?' + qs, { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, packs: [] }, res || {}); });
    }

    // S3 评论：读取 / 发表（发表需登录）。
    function comments(packId, apiUrl) {
      return request('GET', 'workshop/comments?packId=' + encodeURIComponent(String(packId || '')), { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, comments: [], count: 0 }, res || {}); });
    }
    function postComment(packId, text, apiUrl) {
      var session = readSession();
      return request('POST', 'workshop/comment', { body: { packId: String(packId || ''), text: String(text || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    // P2-S1 好友（poll-based）。
    function friends(apiUrl) {
      var session = readSession();
      return request('GET', 'friends', { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, friends: [], count: 0 }, res || {}); });
    }
    function friendRequests(apiUrl) {
      var session = readSession();
      return request('GET', 'friends/requests', { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, incoming: [], outgoing: [] }, res || {}); });
    }
    function requestFriend(to, apiUrl) {
      var session = readSession();
      var body = (to && typeof to === 'object') ? to : { to: String(to || '') };
      return request('POST', 'friends/request', { body: body, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function respondFriend(requesterId, action, apiUrl) {
      var session = readSession();
      return request('POST', 'friends/respond', { body: { requesterId: requesterId, action: String(action || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function removeFriend(userId, apiUrl) {
      var session = readSession();
      return request('POST', 'friends/remove', { body: { userId: userId }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    // P2-S2 私信。
    function inbox(apiUrl) {
      var session = readSession();
      return request('GET', 'messages/inbox', { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, conversations: [], unread: 0 }, res || {}); });
    }
    function conversation(userId, apiUrl) {
      var session = readSession();
      return request('GET', 'messages/conversation?userId=' + encodeURIComponent(String(userId || '')), { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, messages: [], peer: null }, res || {}); });
    }
    function sendMessage(to, text, apiUrl) {
      var session = readSession();
      return request('POST', 'messages/send', { body: { userId: to, text: String(text || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    // P2-S3 通知。
    function notifications(apiUrl) {
      var session = readSession();
      return request('GET', 'notifications', { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, notifications: [], unread: 0 }, res || {}); });
    }
    function markNotificationRead(id, apiUrl) {
      var session = readSession();
      var body = (id === true || (id && id.all)) ? { all: true } : { id: id };
      return request('POST', 'notifications/read', { body: body, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    // P3-S1 世界线（fork 血缘）。
    function lineage(id, apiUrl) {
      return request('GET', 'workshop/lineage?id=' + encodeURIComponent(String(id || '')), { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, root: '', nodes: [] }, res || {}); });
    }
    // P3-S2 史册接龙。
    function chronicles(scenarioId, apiUrl) {
      var qs = scenarioId ? ('?scenarioId=' + encodeURIComponent(String(scenarioId))) : '';
      return request('GET', 'chronicles' + qs, { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, chronicles: [], count: 0 }, res || {}); });
    }
    function chroniclesChain(id, apiUrl) {
      return request('GET', 'chronicles/chain?id=' + encodeURIComponent(String(id || '')), { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, root: 0, chain: [] }, res || {}); });
    }
    function publishChronicle(meta, apiUrl) {
      meta = meta || {};
      var session = readSession();
      var payload = {
        scenarioId: String(meta.scenarioId || ''), parentId: meta.parentId || 0,
        title: String(meta.title || '').trim(), summary: String(meta.summary || ''), outcome: String(meta.outcome || '')
      };
      return request('POST', 'chronicles/publish', { body: payload, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    // P4-S2 社区背书 / 精选。
    function endorse(id, apiUrl) {
      var session = readSession();
      return request('POST', 'workshop/endorse', { body: { id: String(id || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function featured(apiUrl) {
      return request('GET', 'workshop/featured', { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, packs: [] }, res || {}); });
    }

    // A 史馆动态流：读流（关注/推荐）/ 发动态 / 点赞。
    function feed(scope, page, apiUrl) {
      var session = readSession();
      var qs = 'scope=' + encodeURIComponent(String(scope || 'recommend')) + '&page=' + (Number(page) || 1);
      return request('GET', 'feed?' + qs, { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, posts: [], page: 1, hasMore: false }, res || {}); });
    }
    function postFeed(meta, apiUrl) {
      meta = meta || {};
      var session = readSession();
      var payload = {
        type: String(meta.type || 'highlight'),
        title: String(meta.title || '').trim(),
        body: String(meta.body || '').trim(),
        imageRef: String(meta.imageRef || ''),
        refs: meta.refs && typeof meta.refs === 'object' ? meta.refs : {},
        metrics: Array.isArray(meta.metrics) ? meta.metrics.slice(0, 12) : [],
        circleId: meta.circleId || 0
      };
      return request('POST', 'feed/post', { body: payload, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function likePost(id, apiUrl) {
      var session = readSession();
      return request('POST', 'feed/like', { body: { id: id }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    // B 关注图谱：关注/取关（toggle）/ 关注信息（粉丝·关注·我是否已关注）。
    function follow(targetId, apiUrl) {
      var session = readSession();
      return request('POST', 'follow', { body: { targetId: targetId }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function followInfo(userId, apiUrl) {
      var session = readSession();
      return request('GET', 'follow?userId=' + encodeURIComponent(String(userId || '')), { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, followers: 0, following: 0, isFollowing: false }, res || {}); });
    }
    // B 收藏（服务器化）：收藏/取消（toggle）/ 我的收藏列表。
    function favorite(id, apiUrl) {
      var session = readSession();
      return request('POST', 'workshop/favorite', { body: { id: String(id || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function favoritesList(apiUrl) {
      var session = readSession();
      return request('GET', 'workshop/favorites', { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, favorites: [] }, res || {}); });
    }

    // M2 同台竞史（擂台）：列表 / 建擂台 / 详情(榜) / 提交战绩。
    function arenas(scenarioId, apiUrl) {
      var qs = scenarioId ? ('?scenarioId=' + encodeURIComponent(String(scenarioId))) : '';
      return request('GET', 'arenas' + qs, { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, arenas: [] }, res || {}); });
    }
    function createArena(meta, apiUrl) {
      meta = meta || {};
      var session = readSession();
      return request('POST', 'arena/create', { body: { scenarioId: String(meta.scenarioId || ''), title: String(meta.title || '').trim(), metric: String(meta.metric || 'years') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function arenaDetail(id, apiUrl) {
      var session = readSession();
      return request('GET', 'arena?id=' + encodeURIComponent(String(id || '')), { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, arena: null, leaderboard: [] }, res || {}); });
    }
    function submitArena(meta, apiUrl) {
      meta = meta || {};
      var session = readSession();
      return request('POST', 'arena/submit', { body: { arenaId: meta.arenaId, score: Number(meta.score) || 0, outcome: String(meta.outcome || ''), summary: String(meta.summary || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, leaderboard: [] }, res || {}); });
    }
    // M2 鉴赏家合集：列表 / 建合集 / 详情(含 packs) / 增删条目。
    function collections(ownerId, apiUrl) {
      var qs = ownerId ? ('?ownerId=' + encodeURIComponent(String(ownerId))) : '';
      return request('GET', 'collections' + qs, { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, collections: [] }, res || {}); });
    }
    function createCollection(meta, apiUrl) {
      meta = meta || {};
      var session = readSession();
      return request('POST', 'collection/create', { body: { title: String(meta.title || '').trim(), description: String(meta.description || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function collectionDetail(id, apiUrl) {
      return request('GET', 'collection?id=' + encodeURIComponent(String(id || '')), { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, collection: null, packs: [] }, res || {}); });
    }
    function collectionItem(collectionId, packId, action, apiUrl) {
      var session = readSession();
      return request('POST', 'collection/item', { body: { collectionId: collectionId, packId: String(packId || ''), action: action || 'add' }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    // M3 轻圈子：列表 / 详情 / 建圈 / 加入退出 / 圈内动态。
    function circles(apiUrl) {
      var session = readSession();
      return request('GET', 'circles', { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, circles: [] }, res || {}); });
    }
    function circleDetail(id, apiUrl) {
      var session = readSession();
      return request('GET', 'circle?id=' + encodeURIComponent(String(id || '')), { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, circle: null }, res || {}); });
    }
    function createCircle(meta, apiUrl) {
      meta = meta || {};
      var session = readSession();
      return request('POST', 'circle/create', { body: { name: String(meta.name || '').trim(), topic: String(meta.topic || ''), description: String(meta.description || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function joinCircle(circleId, action, apiUrl) {
      var session = readSession();
      return request('POST', 'circle/join', { body: { circleId: circleId, action: action || 'join' }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function circleFeed(circleId, page, apiUrl) {
      var session = readSession();
      return request('GET', 'feed?scope=circle&circleId=' + encodeURIComponent(String(circleId || '')) + '&page=' + (Number(page) || 1), { apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false, posts: [] }, res || {}); });
    }
    // M3 共编（PR 式）：提修订 / 列表 / 作者处理。
    function revisions(packId, apiUrl) {
      return request('GET', 'revisions?packId=' + encodeURIComponent(String(packId || '')), { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, revisions: [] }, res || {}); });
    }
    function proposeRevision(meta, apiUrl) {
      meta = meta || {};
      var session = readSession();
      return request('POST', 'revision/propose', { body: { packId: String(meta.packId || ''), note: String(meta.note || ''), diff: meta.diff || null }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function respondRevision(revisionId, action, apiUrl) {
      var session = readSession();
      return request('POST', 'revision/respond', { body: { revisionId: revisionId, action: action }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    // M3 约稿需求墙（只撮合·不碰钱）：列表 / 发约稿 / 关闭。
    function commissions(apiUrl) {
      return request('GET', 'commissions', { token: '', apiUrl: apiUrl })
        .then(function (res) { return Object.assign({ success: false, commissions: [] }, res || {}); });
    }
    function postCommission(meta, apiUrl) {
      meta = meta || {};
      var session = readSession();
      return request('POST', 'commission/post', { body: { kind: String(meta.kind || 'portrait'), title: String(meta.title || '').trim(), detail: String(meta.detail || '') }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }
    function closeCommission(id, apiUrl) {
      var session = readSession();
      return request('POST', 'commission/close', { body: { id: id }, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    function login(info, apiUrl) {
      info = info || {};
      var payload = { username: String(info.username || '').trim(), password: String(info.password || '') };
      return request('POST', 'account/login', { body: payload, token: '', apiUrl: apiUrl }).then(function (res) {
        if (res && res.success && res.token) writeSession({ token: res.token, apiUrl: normalizeApiUrl(apiUrl || getApiUrl()), user: res.user || null });
        return Object.assign({ success: false }, res || {});
      });
    }

    function me(apiUrl) {
      var session = readSession();
      if (!session.token) return Promise.resolve({ success: true, loggedIn: false, user: null, session: session });
      return request('GET', 'account/me', { apiUrl: apiUrl || session.apiUrl, token: session.token }).then(function (res) {
        if (res && res.success && res.user) writeSession({ token: session.token, apiUrl: normalizeApiUrl(apiUrl || session.apiUrl), user: res.user });
        return Object.assign({ loggedIn: !!(res && res.user) }, res || {}, { session: readSession() });
      });
    }

    function logout(apiUrl) {
      var session = readSession();
      // 登出请求可能晚于一次新登录返回；只允许清理发起登出时捕获的同一 token。
      // 否则旧账号的网络回包会把新账号刚写入 localStorage 的会话一并删掉。
      var done = function () {
        var current = readSession();
        if (!current.token || current.token === session.token) clearSession();
        return { success: true };
      };
      if (!session.token) return Promise.resolve(done());
      return request('POST', 'account/logout', { body: {}, apiUrl: apiUrl || session.apiUrl, token: session.token })
        .then(done, function (e) { var result = done(); result.warning = e && e.message; return result; });
    }

    // ---- workshop catalog (read) ------------------------------------------
    function catalog(catalogUrl) {
      var apiUrl = readSession().apiUrl || getApiUrl();
      var url = String(catalogUrl || '').trim();
      if (url) {
        // full catalog URL given — fetch directly
        if (!doFetch) return Promise.reject(new Error('当前环境不支持 fetch'));
        return doFetch(url, { method: 'GET', mode: 'cors', cache: 'no-store', headers: { 'Accept': 'application/json' } })
          .then(function (resp) {
            if (!resp.ok) throw new Error('在线目录 HTTP ' + resp.status);
            return resp.text();
          })
          .then(function (text) { return text ? JSON.parse(text) : { packs: [] }; })
          .then(function (cat) {
            if (cat && cat.success === false) throw new Error(cat.error || '在线目录返回失败');
            return normalizeCatalog(cat);
          });
      }
      return request('GET', 'workshop/catalog', { apiUrl: apiUrl, token: '' }).then(function (cat) {
        if (cat && cat.success === false) throw new Error(cat.error || '在线目录返回失败');
        return normalizeCatalog(cat);
      });
    }

    function normalizeCatalog(cat) {
      cat = cat || {};
      var packs = Array.isArray(cat.packs) ? cat.packs : [];
      return {
        type: String(cat.type || 'tianming-workshop-catalog'),
        title: String(cat.title || '天命创意工坊'),
        updatedAt: cat.updatedAt || '',
        packs: packs
      };
    }

    // UTF-8 安全 base64（btoa 仅支持 Latin1，中文剧本必须先编 UTF-8 字节）
    function utf8ToBase64(str) {
      str = String(str);
      try {
        if (typeof TextEncoder !== 'undefined' && typeof btoa !== 'undefined') {
          var bytes = new TextEncoder().encode(str), bin = '', CH = 0x8000;
          for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
          return btoa(bin);
        }
      } catch (e) {}
      if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64'); // node
      return btoa(unescape(encodeURIComponent(str)));
    }

    // B2（批B）：投稿包上传——有 onProgress 回调且 XHR 可用时改走 XMLHttpRequest 报上传
    // 进度（xhr.upload.onprogress 的 loaded/total）；否则回落 request() 的 fetch 路（行为
    // 不变）。鉴权头/URL/body 构造与 request() 逐字一致（Accept + Content-Type + Bearer）。
    function sendUpload(payload, apiUrl, token, onProgress) {
      if (typeof onProgress === 'function' && XHR) {
        var base = normalizeApiUrl(apiUrl || getApiUrl());
        if (!base) return Promise.reject(new Error('缺少在线服务地址'));
        var url = joinUrl(base, 'workshop/upload');
        var bodyStr = JSON.stringify(payload);
        return new Promise(function (resolve, reject) {
          var xhr = new XHR();
          xhr.open('POST', url, true);
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.setRequestHeader('Content-Type', 'application/json');
          if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
          if (xhr.upload) xhr.upload.onprogress = function (e) {
            if (e && e.lengthComputable) { try { onProgress({ loaded: e.loaded, total: e.total }); } catch (_) {} }
          };
          xhr.onload = function () {
            var text = xhr.responseText || '';
            var data = null;
            if (text) { try { data = JSON.parse(text); } catch (e2) { data = null; } }
            if (data == null) {
              if (xhr.status < 200 || xhr.status >= 300) { reject(new Error('在线服务返回 ' + xhr.status)); return; }
              resolve({}); return;
            }
            resolve(data);
          };
          xhr.onerror = function () { reject(new Error('上传请求失败')); };
          xhr.ontimeout = function () { reject(new Error('上传超时')); };
          xhr.onabort = function () { reject(new Error('上传已取消')); };
          xhr.send(bodyStr);
        });
      }
      // 回落 fetch 路（与原 request() 调用逐字一致）。
      return request('POST', 'workshop/upload', { body: payload, apiUrl: apiUrl, token: token });
    }

    // 批C·下载进度：把 fetch Response body 流式读成 Uint8Array，边读边报 onProgress(received,total)。
    // reader 不可用（老环境/无 body）时回落 resp.arrayBuffer()（行为不变）。纯网络原语·不碰 DOM/state。
    function readBytesWithProgress(resp, onProgress) {
      var reader = resp && resp.body && resp.body.getReader && resp.body.getReader();
      if (!reader) return resp.arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
      var total = Number((resp.headers && resp.headers.get && resp.headers.get('Content-Length')) || 0) || 0;
      var chunks = [], received = 0;
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) { var out = new Uint8Array(received), off = 0; for (var i = 0; i < chunks.length; i++) { out.set(chunks[i], off); off += chunks[i].length; } return out; }
          chunks.push(r.value); received += r.value.length;
          if (typeof onProgress === 'function') { try { onProgress(received, total); } catch (_) {} }
          return pump();
        });
      })();
    }

    // 上传一个纯文本剧本到工坊（落服务器自持存储 -> pending 待审）。
    function uploadScenario(meta, content, apiUrl, onProgress) {
      meta = meta || {};
      var json = (typeof content === 'string') ? content : JSON.stringify(content);
      var tags = Array.isArray(meta.tags) ? meta.tags : String(meta.tags || '').split(/[，,;；\s]+/).filter(Boolean);
      var payload = {
        title: String(meta.title || '').trim(),
        id: String(meta.id || '').trim(),
        version: String(meta.version || '1.0.0').trim(),
        description: String(meta.description || '').trim(),
        type: String(meta.type || 'scenario').trim(),
        tags: tags.slice(0, 20),
        parentId: String(meta.parentId || ''),
        filename: String(meta.filename || 'scenario.json'),
        contentBase64: utf8ToBase64(json)
      };
      // 发布补齐2026-07-21·纯文本剧本路由透传展示字段(老服务器忽略未知键=零害·服务器补丁后点亮)
      if (meta.releaseNotes) payload.releaseNotes = String(meta.releaseNotes).slice(0, 2000);
      if (meta.coverImage && meta.coverImage.contentBase64) payload.coverImage = meta.coverImage;
      if (Array.isArray(meta.galleryImages) && meta.galleryImages.length) payload.galleryImages = meta.galleryImages.slice(0, 6);
      var session = readSession();
      return sendUpload(payload, apiUrl || session.apiUrl, session.token, onProgress)
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    // P1-S2b：通用资产包上传（立绘/音乐/地图/MOD）。contentBase64 已是 base64（客户端打包二进制 → base64）。
    function uploadPack(meta, contentBase64, apiUrl, onProgress) {
      meta = meta || {};
      var t = String(meta.type || 'scenario').trim();
      var tags = Array.isArray(meta.tags) ? meta.tags : String(meta.tags || '').split(/[，,;；\s]+/).filter(Boolean);
      var payload = {
        title: String(meta.title || '').trim(),
        id: String(meta.id || '').trim(),
        version: String(meta.version || '1.0.0').trim(),
        description: String(meta.description || '').trim(),
        type: t,
        tags: tags.slice(0, 20),
        assets: Array.isArray(meta.assets) ? meta.assets.slice(0, 500) : [],
        parentId: String(meta.parentId || ''),
        packageKind: String(meta.packageKind || ''),
        releaseNotes: String(meta.releaseNotes || ''),
        coverImage: meta.coverImage || null,
        galleryImages: Array.isArray(meta.galleryImages) ? meta.galleryImages.slice(0, 8) : [],
        filename: String(meta.filename || (t === 'scenario' ? 'scenario.json' : 'pack.zip')),
        contentBase64: String(contentBase64 || '')
      };
      var session = readSession();
      return sendUpload(payload, apiUrl || session.apiUrl, session.token, onProgress)
        .then(function (res) { return Object.assign({ success: false }, res || {}); });
    }

    return {
      DEFAULT_API_URL: DEFAULT_API_URL,
      getApiUrl: getApiUrl,
      setApiUrl: setApiUrl,
      getSession: getSession,
      getToken: getToken,
      isLoggedIn: isLoggedIn,
      clearSession: clearSession,
      request: request,
      health: health,
      register: register,
      login: login,
      me: me,
      logout: logout,
      emailCodeRequest: emailCodeRequest,
      emailLogin: emailLogin,
      requestReset: requestReset,
      resetPassword: resetPassword,
      setEmail: setEmail,
      ratePack: ratePack,
      packMeta: packMeta,
      comments: comments,
      postComment: postComment,
      friends: friends,
      friendRequests: friendRequests,
      requestFriend: requestFriend,
      respondFriend: respondFriend,
      removeFriend: removeFriend,
      inbox: inbox,
      conversation: conversation,
      sendMessage: sendMessage,
      notifications: notifications,
      markNotificationRead: markNotificationRead,
      lineage: lineage,
      chronicles: chronicles,
      chroniclesChain: chroniclesChain,
      publishChronicle: publishChronicle,
      endorse: endorse,
      featured: featured,
      feed: feed,
      postFeed: postFeed,
      likePost: likePost,
      follow: follow,
      followInfo: followInfo,
      favorite: favorite,
      favoritesList: favoritesList,
      arenas: arenas,
      createArena: createArena,
      arenaDetail: arenaDetail,
      submitArena: submitArena,
      collections: collections,
      createCollection: createCollection,
      collectionDetail: collectionDetail,
      collectionItem: collectionItem,
      circles: circles,
      circleDetail: circleDetail,
      createCircle: createCircle,
      joinCircle: joinCircle,
      circleFeed: circleFeed,
      revisions: revisions,
      proposeRevision: proposeRevision,
      respondRevision: respondRevision,
      commissions: commissions,
      postCommission: postCommission,
      closeCommission: closeCommission,
      authorPacks: authorPacks,
      catalog: catalog,
      uploadScenario: uploadScenario,
      uploadPack: uploadPack,
      readBytesWithProgress: readBytesWithProgress
    };
  }

  return { createOnlineClient: createOnlineClient, DEFAULT_API_URL: DEFAULT_API_URL };
});

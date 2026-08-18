// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-resume-point.js — 残局接演·发布 payload 构造（Wave4 slice-1·2026-07-05）
//
// 残局接演：把本局存档发为「残局」类工坊包，他人可「从此局接演」续写这段天命。
//   种子=全量存档格式（与 SaveManager.exportSave 同形·剥 AI key）。
//   ★E2E 实证(2026-07-05·账号 misfit_tm)：服务器**有类型白名单**(scenario/portrait/music/map/mod)，
//     且 type='scenario' 会深校验剧本结构——存档体过不了。故残局搭 **type='mod'**(收原始 JSON 不校验)，
//     识别靠 **tags 含「残局」**(服务器不留存 packageKind·只留 tags)；下载回来是原始 JSON 直取(同 install 流)。
//   本 slice 做**可验核心**：从当前局构造残局包 payload（存档体 + upload-ready meta）。上传路径已 E2E 真验通。
//   slice-1b（UI 按钮 + base64 + uploadPack 网络上传·已接线·上传侧真验）。
//   slice-2（接演：resume 包 → 下载 + importSave + 起局·下载侧受审核门约束，需已审包才可跨用户真验）。
//
// 纯读 GM/P·不写游戏态·on-demand（非每回合）。
// ============================================================

(function (global) {
  var TM = global.TM = global.TM || {};
  if (TM.ResumePoint) return;

  function _deepClone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; } }

  // ASCII 安全 slug（服务器按 ASCII 化标题派生 id·中文塌成脏 id → 残局须显式唯一 id）
  function _slug(s) { return String(s || 'x').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'x'; }

  // 剥 AI key（残局公开分享·绝不外泄玩家密钥·同 exportSave:_tmStripAiKeyInPlace）
  function _stripKey(p) {
    try {
      if (p && p.ai && p.ai.key) p.ai.key = '';
      if (p && p.conf && p.conf.apiKey) p.conf.apiKey = '';
      if (p && p.conf && p.conf.aiKey) p.conf.aiKey = '';
    } catch (e) {}
    return p;
  }

  // 构造残局包 payload：{ meta, save }。save 与存档同形（gameState:{GM,P}）·meta 供 uploadPack（载体 type='mod'·tags 标残局）。
  function buildPayload(GM, P, opts) {
    opts = opts || {};
    GM = GM || global.GM; P = (P !== undefined ? P : global.P);
    if (!GM) return null;
    // 正式运行时复用统一存档 builder；独立模块 smoke / 旧嵌入页未加载 lifecycle 时保留兼容降级。
    var resumeState = (typeof global._buildSaveState === 'function')
      ? global._buildSaveState({ format: 'idb', detach: true, gm: GM, p: P || {} })
      : { GM: _deepClone(GM), P: _stripKey(_deepClone(P || {})) };
    var save = {
      gameState: resumeState,
      _format: 'tianming-save-v1',
      _resume: true
    };
    var scName = opts.scenarioName || GM.scenarioName || GM.sid || '未名局';
    var turn = GM.turn || 0;
    var era = opts.era || (typeof global.getTSText === 'function' ? global.getTSText(turn) : '');
    var when = era || ('第' + turn + '回合');
    var displayName = String(opts.name || ('残局·' + scName + '·' + when)).slice(0, 80);
    // 唯一 id（服务器按 ASCII 化标题派生 id·中文会塌成脏 id/撞车 → 显式给）。in-game 用 Date.now 保唯一，
    // node/vm 无 Date 时回落 turn（smoke 可控）。opts.idSuffix 可注入以便测试稳定。
    var suffix = String(opts.idSuffix != null ? opts.idSuffix : ((typeof Date !== 'undefined' && Date.now) ? Date.now() : turn));
    var id = String(opts.id || ('resume-' + _slug(GM.sid) + '-t' + turn + '-' + suffix));
    // 载体 type='mod'：服务器仅 scenario 深校验剧本结构（存档体过不了）；mod/map/portrait 收原始 JSON 不校验。
    // 识别残局靠 tags 含「残局」（服务器不留存 packageKind·只可靠留存 tags）+ 存档体内 _resume:true。
    var meta = {
      title: displayName,
      name: displayName,
      id: id,
      type: 'mod',
      packageKind: 'resume',
      version: String(opts.version || '1.0.0'),
      sourceScenario: GM.sid || '',
      turn: turn,
      description: String(opts.description || ('从「' + scName + '」' + when + '接演·续写这段天命。')).slice(0, 200),
      tags: ['残局', '接演'],
      filename: 'resume.json',
      assets: [{ name: displayName }]
    };
    return { meta: meta, save: save };
  }

  // 能否发残局：须在局中（running·已推过回合）
  function canPublish(GM) {
    GM = GM || global.GM;
    return !!(GM && GM.running && (GM.turn || 0) > 0);
  }

  // UTF-8 安全 base64（中文存档必须先编 UTF-8 字节·同 online-client utf8ToBase64）
  function _utf8ToBase64(str) {
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

  // 发残局：buildPayload → base64 → uploadPack（走 E2E 已验的同一条上传路径）。
  // 返回 Promise<{success, error?, pack?, needLogin?}>。登录/就绪校验前置，UI 只需展示 message。
  function publish(GM, P, opts) {
    var OC = global.TM && global.TM.OnlineClient;
    if (!OC || !OC.uploadPack) return Promise.resolve({ success: false, error: '在线工坊模块未就绪。' });
    if (!canPublish(GM || global.GM)) return Promise.resolve({ success: false, error: '需在局中（已推过回合）方可发为残局。' });
    if (!(OC.isLoggedIn && OC.isLoggedIn())) return Promise.resolve({ success: false, needLogin: true, error: '请先登录在线工坊账号，再发为残局。' });
    var pl = buildPayload(GM, P, opts);
    if (!pl) return Promise.resolve({ success: false, error: '当前无可发布的局。' });
    var b64;
    try { b64 = _utf8ToBase64(JSON.stringify(pl.save)); }
    catch (e) { return Promise.resolve({ success: false, error: '存档序列化失败：' + (e && e.message || '') }); }
    return Promise.resolve(OC.uploadPack(pl.meta, b64)).then(function (res) {
      return Object.assign({ success: false, _meta: pl.meta }, res || {});
    }, function (e) {
      return { success: false, error: '上传失败：' + (e && e.message || '网络错误') };
    });
  }

  // ── 接演：从残局存档对象起局（纯逻辑·不碰网络·可测）──
  // 复用游戏的 fullLoadGame（自带 UI 起局 + 跨档保留本地 API key + SaveMigrations 迁移旧档）。
  // 归一化为格式B 包 {gameState:{GM,P}}·兼容顶层 {GM,P}。返回 {success, turn?, error?}。
  function applyResume(save, opts) {
    opts = opts || {};
    if (!save || typeof save !== 'object') return { success: false, error: '残局存档结构异常。' };
    var wrapper;
    if (save.gameState && save.gameState.GM && save.gameState.P) wrapper = { gameState: { GM: save.gameState.GM, P: save.gameState.P } };
    else if (save.GM && save.P) wrapper = { gameState: { GM: save.GM, P: save.P } };
    else return { success: false, error: '无法识别的残局存档格式。' };
    // ★起局前校验最小可玩结构（防残缺/合成包把 fullLoadGame 带崩后留下半加载态·如缺 P.time→getSE 读 startS 崩）。
    // 真存档必有 P.time（季节/历法）+ GM.turn；缺则不碰全局态、优雅失败。
    var _gm = wrapper.gameState.GM, _p = wrapper.gameState.P;
    if (_gm.turn == null || !_p.time || typeof _p.time !== 'object') {
      return { success: false, error: '此残局存档不完整（缺少历法/回合等核心字段），无法接演。' };
    }
    if (global.SaveMigrations && typeof global.SaveMigrations.run === 'function') {
      try { wrapper = global.SaveMigrations.run(wrapper); } catch (e) {}
    }
    var boot = opts.boot || global.fullLoadGame;
    if (typeof boot !== 'function') return { success: false, error: '读档系统未就绪。' };
    boot(wrapper);
    var gm = wrapper.gameState && wrapper.gameState.GM;
    return { success: true, turn: (gm && gm.turn) || 0, sourceScenario: (gm && gm.sid) || '' };
  }

  // 接演：下载残局包（原始 JSON 直取·同 install 流）→ 解析 → applyResume 起局。
  // 返回 Promise<{success, turn?, error?}>。跨用户真下载受审核门约束（pending 包 403·需已审）。
  function resume(packageUrl, opts) {
    opts = opts || {};
    if (!packageUrl) return Promise.resolve({ success: false, error: '缺少残局下载地址。' });
    var doFetch = opts.fetch || global.fetch;
    if (typeof doFetch !== 'function') return Promise.resolve({ success: false, error: '当前环境不支持下载。' });
    return doFetch(packageUrl, { mode: 'cors', cache: 'no-store' })
      .then(function (resp) { if (!resp.ok) throw new Error('下载失败 HTTP ' + resp.status); return resp.text(); })
      .then(function (text) {
        if (text && text.length > 16 * 1024 * 1024) throw new Error('残局体积超过 16MB 上限。');
        var save;
        try { save = JSON.parse(text); } catch (e) { throw new Error('残局包解析失败（非存档 JSON）。'); }
        return applyResume(save, opts);
      })
      .then(function (r) { return r; }, function (e) { return { success: false, error: (e && e.message) || '接演失败。' }; });
  }

  TM.ResumePoint = { buildPayload: buildPayload, canPublish: canPublish, publish: publish, applyResume: applyResume, resume: resume, utf8ToBase64: _utf8ToBase64 };
})(typeof window !== 'undefined' ? window : globalThis);

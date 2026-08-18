#!/usr/bin/env node
'use strict';
// smoke-save-load-guard — 存档读口纵深防御（写口 bug 已由 de430926 收敛·本刀补读口报损）
//   覆盖三件事：
//   ① tm-storage.js load()：解压或 JSON.parse 失败必须 reject，绝不把损坏档伪装成空槽或半有效 record；
//      健康压缩档正常解析；未压缩旧档原样返回。
//   ② tm-save-manager.js loadFromSlot：交给 SaveMigrations/fullLoadGame 前先验形状，坏形状/畸形嵌套
//      （_loadError / Blob / 字符串 / 空对象 / {GM}缺P / gameState=null）明确报损并 return·不下传；
//      真空槽唯一判据 = record===null（走「该槽位没有存档」）。
//   ③ 形状判别 _isLoadableGameState 与 fullLoadGame 的格式A/格式B 分派镜像·判真集合 ⊆ fullLoadGame
//      能正确加载集合：格式B 须真实 {GM,P}（GM/P 皆对象且 GM 像 GM）·格式A 须外层含特征键·好档绝不误杀。
//      fullLoadGame 桩记录收到的 saveWrapper·断言其 gameState 落到与预期一致的格式分支。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ok  - ' + msg); } else { fail++; console.error('  FAIL - ' + msg); } }

const storageSrc = fs.readFileSync(path.join(ROOT, 'tm-storage.js'), 'utf8');
const managerSrc = fs.readFileSync(path.join(ROOT, 'tm-save-manager.js'), 'utf8');
const lifecycleSrc = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');

function sliceFn(src, marker) {
  const a = src.indexOf(marker); if (a < 0) return '';
  let i = src.indexOf('{', a), depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}' && --depth === 0) { j++; break; } }
  return src.slice(a, j);
}

// ============================================================
// 1. 源码契约（改动锚点在位·不被后续重构悄悄掀掉）
// ============================================================
console.log('=== 1. 源码契约 ===');
{
  const loadFn = sliceFn(storageSrc, 'function load(id)');
  ok(/record\.gameState = JSON\.parse\(jsonStr\)/.test(loadFn), 'storage.load() 解析压缩档');
  ok(!/parse_failed|record\.gameState\s*=\s*null/.test(loadFn), '解析失败不再降级成半有效 record');
  ok(!/\.catch\s*\([^)]*\)\s*\{[\s\S]*?return record/.test(loadFn), '解压/解析错误沿 Promise 拒绝向上传递');
}
{
  ok(/function _isLoadableGameState\(gs\)/.test(managerSrc), 'manager 定义 _isLoadableGameState 形状守卫');
  ok(/window\._isLoadableGameState = _isLoadableGameState/.test(managerSrc), '_isLoadableGameState 挂 window');
  const loadFromSlot = sliceFn(managerSrc, 'loadFromSlot: function(slotId)');
  const guardAt = loadFromSlot.indexOf('if (!_isLoadableGameState(record.gameState))');
  const loadErrAt = loadFromSlot.indexOf('if (record._loadError)');
  const wrapAt = loadFromSlot.indexOf('var saveWrapper = { gameState: record.gameState };');
  ok(loadErrAt > 0 && guardAt > 0 && wrapAt > 0, 'loadFromSlot 含 _loadError 分支 + 形状守卫 + saveWrapper');
  ok(loadErrAt < wrapAt && guardAt < wrapAt, '两道报损闸都在 saveWrapper 下传之前');
  ok(/存档已损坏，无法读取/.test(loadFromSlot), 'loadFromSlot 报损文案「存档已损坏，无法读取」');
  // 假绿防回归：真空槽文案只允许由 record===null 触发（不得再用 !record.gameState 把坏档当空槽）
  ok(!/if \(!record\.gameState\)\s*\{\s*toast\('该槽位没有存档'\)/.test(loadFromSlot), 'loadFromSlot 不再以 !record.gameState 静默当空槽（坏档归报损）');
  const emptyMsgCount = (loadFromSlot.match(/该槽位没有存档/g) || []).length;
  ok(emptyMsgCount === 1 && /if \(!record\) \{ toast\('该槽位没有存档'\); return; \}/.test(loadFromSlot), '「该槽位没有存档」仅一处·且由 record===null 守卫');
}
{
  ok(/data\.gameState && data\.gameState\.GM && data\.gameState\.P/.test(lifecycleSrc), 'fullLoadGame 格式B 判别（GM && P）存在·作对齐基准');
}

// ============================================================
// 2. tm-storage.js load()：动态跑 解压失败 / 解压成功 / 未压缩旧档 三路
// ============================================================
console.log('=== 2. storage.load() 三路真跑 ===');
function makeStorageCtx() {
  const store = new Map();
  const localStorage = {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, v); },
    removeItem(k) { store.delete(k); },
    key() { return null; }, get length() { return 0; }
  };
  const ctx = {
    window: { indexedDB: undefined },
    indexedDB: undefined,
    localStorage, console, Promise, JSON, Date, Math, Blob, Response,
    TextDecoder, Uint8Array, ArrayBuffer,
    navigator: { storage: {} }, setTimeout, clearTimeout
  };
  ctx.window.window = ctx.window; ctx.window.localStorage = localStorage; ctx.window.console = console;
  let src = storageSrc;
  const bootAt = src.lastIndexOf('\nTM_SaveDB.open().then');
  if (bootAt > 0) src = src.slice(0, bootAt);
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ctx, store };
}

(async () => {
  // 2a. 坏档：解压后是非法 JSON → reject，调用方明确报损
  {
    const { ctx, store } = makeStorageCtx();
    store.set('tm_idb_saves_slot_bad', JSON.stringify({ id: 'slot_bad', _compressed: true, gameState: 'BLOB_PLACEHOLDER' }));
    ctx.SaveCompression.decompress = function () { return Promise.resolve('{ this is: not valid json ]'); };
    let rejected = false;
    try { await ctx.TM_SaveDB.load('slot_bad'); } catch (e) { rejected = e instanceof SyntaxError || /JSON|position|property/i.test(String(e)); }
    ok(rejected, '解析失败：load() reject，不返回半有效 record');
  }
  // 2b. 健康压缩档：正常解析·无 _loadError
  {
    const { ctx, store } = makeStorageCtx();
    store.set('tm_idb_saves_slot_ok', JSON.stringify({ id: 'slot_ok', _compressed: true, gameState: 'BLOB_PLACEHOLDER' }));
    ctx.SaveCompression.decompress = function () { return Promise.resolve(JSON.stringify({ GM: { turn: 7 }, P: {} })); };
    const rec = await ctx.TM_SaveDB.load('slot_ok');
    ok(rec && rec.gameState && rec.gameState.GM && rec.gameState.GM.turn === 7, '健康压缩档：正常解析出 {GM,P}');
    ok(rec && !rec._loadError, '健康压缩档：不误标 _loadError');
  }
  // 2c. 未压缩旧档：gameState 已是对象·无 _compressed → 原样返回·无 _loadError·不走解压
  {
    const { ctx, store } = makeStorageCtx();
    store.set('tm_idb_saves_slot_legacy', JSON.stringify({ id: 'slot_legacy', gameState: { GM: { turn: 3, sid: 's1' }, P: { conf: {} } } }));
    let decompressCalled = false;
    ctx.SaveCompression.decompress = function () { decompressCalled = true; return Promise.resolve('{}'); };
    const rec = await ctx.TM_SaveDB.load('slot_legacy');
    ok(rec && rec.gameState && rec.gameState.GM && rec.gameState.GM.turn === 3, '未压缩旧档：gameState 原样返回');
    ok(rec && !rec._loadError && decompressCalled === false, '未压缩旧档：不走解压、不标 _loadError');
  }
  // 2d. 非 gzip Blob 旧档按 UTF-8 解码；不允许 String(ArrayBuffer) 腐化
  {
    const { ctx } = makeStorageCtx();
    const text = JSON.stringify({ GM: { turn: 9 }, P: { conf: {} } });
    const decoded = await ctx.SaveCompression.decompress(new Blob([text]));
    ok(decoded === text, '非 gzip Blob 旧档按 UTF-8 原文解码');
  }
  // 2e. gzip 数据在缺少 DecompressionStream 时明确拒绝
  {
    const { ctx } = makeStorageCtx();
    ctx.SaveCompression.decompressionSupported = false;
    let rejected = false;
    try { await ctx.SaveCompression.decompress(new Blob([new Uint8Array([0x1f, 0x8b, 0x00])])); }
    catch (e) { rejected = /不支持 gzip 解压/.test(String(e && e.message || e)); }
    ok(rejected, '缺少 gzip 解压能力时明确 reject');
  }

  // ============================================================
  // 3. tm-save-manager.js：形状守卫 + loadFromSlot 报损不下传
  // ============================================================
  console.log('=== 3. _isLoadableGameState + loadFromSlot 报损不下传 ===');
  const mctx = {
    window: {}, console, Promise, JSON, Object, Array, Blob, Date, Math,
    parseInt, isNaN, setTimeout, clearTimeout
  };
  mctx.window.window = mctx.window;
  vm.createContext(mctx);
  vm.runInContext(managerSrc, mctx);

  // 3a. _isLoadableGameState 单元：格式B须真实{GM,P}·格式A须特征键·畸形/坏形状全拦
  const L = mctx._isLoadableGameState;
  ok(L({ GM: { turn: 1 }, P: {} }) === true, '格式B 真实 {GM,P}（GM 像 GM·P 对象）→ 可读');
  ok(L({ GM: { turn: 1 } }) === false, '畸形档 {GM} 缺 P → 坏（否则 fullLoadGame 当格式A 误载外层）');
  ok(L({ GM: [], P: {} }) === false, '畸形档 {GM:[],P} GM 非对象 → 坏');
  ok(L({ GM: { turn: 1 }, P: 'x' }) === false, '畸形档 {GM,P:字符串} P 非对象 → 坏');
  ok(L({ GM: { foo: 1 }, P: {} }) === false, '畸形档 {GM,P} 但嵌套 GM 无特征键 → 坏');
  ok(L({ turn: 3, chars: [] }) === true, '格式A（外层即 GM·含 turn/chars）→ 可读');
  ok(L({ sid: 'shaosong' }) === true, '格式A（仅 sid 特征键）→ 可读');
  ok(L(new Blob(['x'])) === false, 'Blob（未解压压缩残留）→ 坏');
  ok(L('some string') === false, '字符串 → 坏');
  ok(L(12345) === false, '数字 → 坏');
  ok(L(null) === false, 'null → 坏');
  ok(L({}) === false, '空对象 → 坏');
  ok(L([1, 2, 3]) === false, '数组 → 坏');
  ok(L({ foo: 1, bar: 2 }) === false, '无 GM/无特征键的对象 → 坏');

  // 守卫「判真」⊆ fullLoadGame「能正确加载」：把 fullLoadGame 分派逻辑就地重放核验子集关系
  function fullLoadGameDispatch(gameState) {
    // 镜像 tm-save-lifecycle.js:816——返回加载后 GM 是否为像样 GM 对象（含特征键）
    let GM;
    if (gameState && gameState.GM && gameState.P) GM = gameState.GM;       // 格式B
    else GM = gameState;                                                    // 格式A
    return !!GM && typeof GM === 'object' && !Array.isArray(GM) &&
      (GM.turn !== undefined || GM.chars !== undefined || GM.sid !== undefined);
  }
  const truthy = [{ GM: { turn: 1 }, P: {} }, { turn: 3, chars: [] }, { sid: 'x' }];
  const falsy = [{ GM: { turn: 1 } }, { GM: [], P: {} }, { GM: { foo: 1 }, P: {} }, {}, { foo: 1 }];
  ok(truthy.every(function (g) { return L(g) === true && fullLoadGameDispatch(g) === true; }), '守卫判真样本 → fullLoadGame 都能载出像样 GM（子集关系成立）');
  ok(falsy.every(function (g) { return L(g) === false; }), '畸形/坏形状样本 → 守卫全判坏（这些 fullLoadGame 会误载）');

  // 3b/3c. loadFromSlot 行为：fullLoadGame 桩记录收到的 saveWrapper·校验落到预期格式分支
  function runLoad(record) {
    return new Promise(function (resolve) {
      const state = { toast: '', migrations: false, fullLoad: false, received: undefined };
      mctx.toast = function (m) { state.toast = m; };
      mctx.showLoading = function () {}; mctx.hideLoading = function () {};
      mctx.closeSaveManager = function () {};
      mctx.deepClone = function (v) { return v; };
      mctx.buildIndices = function () {}; mctx.enterGame = function () {}; mctx.renderGameState = function () {};
      mctx._tmInstallScenarioGetter = function () {};
      mctx.GM = {}; mctx.P = {};
      mctx.SaveMigrations = { run: function (w) { state.migrations = true; return w; }, stamp: function () {} };
      mctx.fullLoadGame = function (w) { state.fullLoad = true; state.received = w; };
      mctx.TM_SaveDB = { isAvailable: function () { return true; }, load: function () { return Promise.resolve(record); } };
      mctx.SaveManager.loadFromSlot(0);
      setTimeout(function () { resolve(state); }, 25);
    });
  }

  let s;
  s = await runLoad({ id: 'slot_0', gameState: null, _loadError: 'parse_failed' });
  ok(/损坏/.test(s.toast) && !s.migrations && !s.fullLoad, '坏档(_loadError=parse_failed)：报损·不下传');

  s = await runLoad({ id: 'slot_0', gameState: null });
  ok(/损坏/.test(s.toast) && !/没有存档/.test(s.toast) && !s.migrations && !s.fullLoad, 'record 存在但 gameState=null（含合法 JSON null·无 _loadError）：报损·非空槽');

  s = await runLoad({ id: 'slot_0', gameState: new Blob(['x']) });
  ok(/损坏/.test(s.toast) && !s.migrations && !s.fullLoad, '坏形状(Blob)：报损·不下传');

  s = await runLoad({ id: 'slot_0', gameState: 'raw-string-junk' });
  ok(/损坏/.test(s.toast) && !s.migrations && !s.fullLoad, '坏形状(字符串)：报损·不下传');

  s = await runLoad({ id: 'slot_0', gameState: {} });
  ok(/损坏/.test(s.toast) && !s.migrations && !s.fullLoad, '坏形状(空对象)：报损·不下传');

  s = await runLoad({ id: 'slot_0', gameState: { GM: { turn: 1 } } });
  ok(/损坏/.test(s.toast) && !s.migrations && !s.fullLoad, '畸形档 {GM} 缺 P：报损·不下传（本刀新拦下）');

  // 好档不被误杀：格式B 收到 {GM,P}·格式A 收到 GM 本体
  s = await runLoad({ id: 'slot_0', name: '甲', gameState: { GM: { turn: 2 }, P: { conf: {} } } });
  ok(!/损坏/.test(s.toast) && s.migrations && s.fullLoad, '格式B 好档：不报损·正常下传');
  ok(s.received && s.received.gameState && s.received.gameState.GM && s.received.gameState.GM.turn === 2 && s.received.gameState.P,
    '格式B：fullLoadGame 收到 {GM,P}（落格式B 分支·GM&&P 同真）');

  s = await runLoad({ id: 'slot_0', name: '乙', gameState: { turn: 5, chars: [] } });
  ok(!/损坏/.test(s.toast) && s.migrations && s.fullLoad, '格式A 好档：不报损·正常下传');
  ok(s.received && s.received.gameState && s.received.gameState.turn === 5 && s.received.gameState.GM === undefined && s.received.gameState.P === undefined,
    '格式A：fullLoadGame 收到 GM 本体（无 .GM/.P·落格式A 分支）');

  // 真空槽：唯一判据 record===null
  s = await runLoad(null);
  ok(/没有存档/.test(s.toast) && !/损坏/.test(s.toast) && !s.migrations && !s.fullLoad, 'record=null：报「该槽位没有存档」（唯一真空槽路径）');

  console.log('\n[smoke-save-load-guard] ' + pass + ' passed / ' + fail + ' failed · assertions=' + pass);
  process.exit(fail ? 1 : 0);
})().catch(function (err) {
  console.error('  FAIL - smoke crashed:', err && err.stack || err);
  console.log('\n[smoke-save-load-guard] ' + pass + ' passed / ' + (fail + 1) + ' failed');
  process.exit(1);
});

// ============================================================
//  smoke-apikey-restore-rehydrate.js — restoreP 三层恢复不冲掉主 API key 回归守卫
//  背景(2026-07-11·owner 报"进游戏一直都要重新添加API秘钥")：
//  saveP 各持久化端(IDB/tm_P/tm_P_lite/桌面autoSave)一律剥 key 落盘(安全·设计如此)；
//  但 tm-utils.js _restoreP 三层恢复 + _tmApplyMachinePrefsFromProject 曾整体覆盖 P.ai 从不回灌——
//  尤其 IndexedDB 层(07-04 由"只写不读"死代码修活)异步晚到(≤10s 短轮询)，把启动时
//  tm-player-core IIFE 刚从 tm_api 补回的 key 冲掉 → 每端每次启动 key 必丢。
//  (与 smoke-apikey-persist 互补：那边守"写 tm_api + 启动读回"两环·本测守第三环"恢复层覆盖后回灌"。
//   教训同款：写侧有测读侧漏网→07-04 补读侧；读侧有测恢复层漏网→本测补恢复层。链条上每一环都要有测。)
//  本测：vm 沙箱真跑 tm-utils.js·模拟真实时序(层1 lite/tm_P 同步覆盖→启动补 key→层2 IDB 异步晚到
//  覆盖→层3 桌面 autoSave 覆盖)·断言每层落地后 P.ai.key 仍存活·且无 tm_api 时不炸不造垃圾。
//  运行：node web/scripts/smoke-apikey-restore-rehydrate.js
// ============================================================
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'web', 'tm-utils.js'), 'utf-8');

const DEVICE_KEY = 'sk-SMOKE-DEVICE-KEY-13579';
let pass = 0, fail = 0;
function assert(c, m, detail) { if (c) { pass++; console.log('  ok· ' + m); } else { fail++; console.error('  FAIL· ' + m + (detail ? ' :: ' + detail : '')); } }

function makeCtx(opts) { // opts: { withTmApi, desktop, liteAi, tmP }
  const store = {};
  if (opts.withTmApi) store.tm_api = JSON.stringify({ key: DEVICE_KEY, url: 'https://dev.example/v1', model: 'dev-model' });
  if (opts.liteAi) store.tm_P_lite = JSON.stringify({ scenarios: [], ai: opts.liteAi, conf: {}, _hasFullData: true });
  if (opts.tmP) store.tm_P = JSON.stringify(opts.tmP);
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  let idbResolve = null;
  const TM_SaveDB = { loadProject: () => new Promise(r => { idbResolve = r; }), saveProject: () => Promise.resolve() };
  const pendingTimers = [];
  const ctx = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    JSON, Object, Array, Math, Date, parseFloat, parseInt, isNaN, String, Number, Boolean, RegExp, Promise, Error, TypeError,
    encodeURIComponent, decodeURIComponent,
    setTimeout: (fn) => { pendingTimers.push(fn); return pendingTimers.length; },
    clearTimeout: () => {},
    localStorage, TM_SaveDB,
    P: { scenarios: [], ai: { key: '', url: '', model: '' }, conf: {} },
    GM: { running: false },
    document: { querySelector: () => null, createElement: () => ({ click: () => {} }), addEventListener: () => {} },
    navigator: { userAgent: 'node-smoke' },
  };
  ctx.window = ctx;
  if (opts.desktop) {
    ctx.window.tianming = {
      isDesktop: true,
      loadAutoSave: () => Promise.resolve({ success: true, data: { scenarios: [{ id: 'sc-x', name: 'x' }], ai: { url: 'https://autosave.example/v1', model: 'as-model' } } }),
      autoSave: () => Promise.resolve(),
    };
  }
  ctx.__getIdbResolve = () => idbResolve;
  ctx.__timers = pendingTimers;
  vm.createContext(ctx);
  return ctx;
}
function drainTimers(ctx, rounds) { for (let i = 0; i < rounds; i++) { ctx.__timers.splice(0).forEach(fn => { try { fn(); } catch (_) {} }); } }
const tick = () => new Promise(r => setImmediate(r));

async function run() {
  // T1 浏览器端：lite(剥key) 同步覆盖 + IDB(剥key) 异步晚到覆盖 → key 存活（本 bug 主场景）
  {
    const ctx = makeCtx({ withTmApi: true, liteAi: { url: 'https://lite.example/v1', model: 'lite-model' } });
    vm.runInContext(SRC, ctx, { filename: 'tm-utils.js' });
    assert(ctx.P.ai.key === DEVICE_KEY, '层1 lite.ai(无key) 覆盖 P.ai 后 key 已从 tm_api 回灌', 'got=' + JSON.stringify(ctx.P.ai.key));
    // 模拟 tm-player-core 启动 IIFE(浏览器分支)——真实加载顺序在层1后·幂等补 key
    vm.runInContext('try{var s=localStorage.getItem("tm_api");if(s){var c=JSON.parse(s);P.ai.key=c.key||P.ai.key||"";P.ai.url=c.url||P.ai.url||"";P.ai.model=c.model||P.ai.model||"";}}catch(e){}', ctx);
    drainTimers(ctx, 3); await tick();
    const resolve = ctx.__getIdbResolve();
    assert(typeof resolve === 'function', '层2 IDB loadProject 短轮询已发起(层2活着·非死代码)');
    resolve({ scenarios: [{ id: 'sc-custom-1', name: '自建' }], characters: [], factions: [], variables: [], ai: { url: 'https://idb.example/v1', model: 'idb-model' } });
    await tick(); await tick();
    assert(ctx.P.ai.key === DEVICE_KEY, '层2 IDB(无key·异步晚到) 整树覆盖后 key 存活【本次回归主凶】', 'got=' + JSON.stringify(ctx.P.ai.key));
    assert(ctx.P.ai.model === 'dev-model', '合并口径=tm_api 非空字段赢(与 fullLoadGame._preservedAi 同口径)', 'got=' + ctx.P.ai.model);
  }
  // T2 桌面端：层3 autoSave(剥key) 覆盖 → key 存活
  {
    const ctx = makeCtx({ withTmApi: true, liteAi: { url: 'https://lite.example/v1' }, desktop: true });
    vm.runInContext(SRC, ctx, { filename: 'tm-utils.js' });
    ctx.__getIdbResolve()(null);await tick(); await tick();
    assert(ctx.P.scenarios[0].id === 'sc-x', '主项目缺失时确实完成桌面项目恢复');
    assert(ctx.P.ai.key === DEVICE_KEY, '层3 桌面 autoSave(无key) 覆盖后 key 存活', 'got=' + JSON.stringify(ctx.P.ai.key));
  }
  // T3 旧格式 tm_P(剥key) 整树覆盖 → key 存活
  {
    const ctx = makeCtx({ withTmApi: true, tmP: { scenarios: [{ id: 'sc-custom-1', name: '自建' }], characters: [], factions: [], variables: [], ai: { url: 'https://tmp.example/v1' } } });
    vm.runInContext(SRC, ctx, { filename: 'tm-utils.js' });
    assert(ctx.P.ai.key === DEVICE_KEY, '层1 tm_P(无key) 整树覆盖后 key 已回灌', 'got=' + JSON.stringify(ctx.P.ai.key));
  }
  // T4 新玩家无 tm_api：回灌不炸、不造垃圾
  {
    const ctx = makeCtx({ withTmApi: false, liteAi: { url: 'https://lite.example/v1', model: 'lite-model' } });
    vm.runInContext(SRC, ctx, { filename: 'tm-utils.js' });
    assert(ctx.P.ai.key === undefined || ctx.P.ai.key === '', '无 tm_api 时 key 保持空(不造垃圾)', 'got=' + JSON.stringify(ctx.P.ai.key));
    assert(ctx.P.ai.url === 'https://lite.example/v1', '无 tm_api 时 lite 配置正常恢复', 'got=' + ctx.P.ai.url);
  }
  // T5 静态守卫：五个覆盖点全部带回灌调用·防未来重构删漏
  {
    const restoreSeg = SRC.slice(SRC.indexOf('function _restoreP'));
    const calls = (restoreSeg.match(/_tmRehydrateAiFromDevice\(\)/g) || []).length;
    assert(calls >= 4, '_restoreP 内回灌调用 ≥4(层1×2/层2/层3·现=' + calls + ')');
    assert(/if \(project\.ai\) \{ P\.ai = project\.ai; _tmRehydrateAiFromDevice\(\); \}/.test(SRC), '_tmApplyMachinePrefsFromProject 覆盖 P.ai 后回灌');
    assert(/function _tmRehydrateAiFromDevice\(\)/.test(SRC), '_tmRehydrateAiFromDevice 函数存在');
  }
  console.log('');
  console.log('[smoke-apikey-restore-rehydrate] ' + pass + '/' + (pass + fail) + (fail ? ' — ' + fail + ' FAIL' : ' 全过'));
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('[smoke-apikey-restore-rehydrate] HARNESS ERROR:', e); process.exit(2); });

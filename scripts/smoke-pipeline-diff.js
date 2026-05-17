// scripts/smoke-pipeline-diff.js — pipeline 自一致性 / 决定性 smoke
// 创建：2026-05-07·slice cluster 1-6 双轨验证 (legacy vs pipeline)
// 重定位：2026-05-08·slice 7c·legacy 已删·flag 已废
//
// 目的(post-slice-7)：mode='legacy' 跟 mode='pipeline' 现都跑 pipeline·相当于 self-diff
//      4 passes (baseline self-diff + 'legacy' vs 'pipeline') 全 = 0 即证 pipeline 决定性
//      若引入随机性/时间敏感性·这里会 catch
//
// 不依赖 npm / jsdom / puppeteer·纯 Node vm
// 用法：
//   node scripts/smoke-pipeline-diff.js          # 跑·exit 0 通过
//   node scripts/smoke-pipeline-diff.js --verbose # 打印每个 diff 字段

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

// ─── 极简 DOM/window stub (照搬 smoke-letter-flow) ───────────────
function fakeEl() {
  const el = {
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    style: {}, children: [], childNodes: [],
    innerHTML: '', textContent: '', value: '',
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ return c; },
    remove(){},
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return fakeEl(); }, querySelectorAll(){ return []; },
    getBoundingClientRect(){ return {top:0,left:0,bottom:0,right:0,width:0,height:0}; },
    focus(){}, blur(){}, click(){}, scrollIntoView(){},
    insertBefore(c){ return c; }, cloneNode(){ return fakeEl(); },
    contains(){ return false; },
    parentNode: null, parentElement: null,
    firstChild: null, lastChild: null,
    nextSibling: null, previousSibling: null, dataset: {},
    offsetWidth:0, offsetHeight:0, clientWidth:0, clientHeight:0,
    scrollTop:0, scrollLeft:0, scrollWidth:0, scrollHeight:0,
    options: [], selectedIndex: -1, checked: false, disabled: false
  };
  return el;
}

function makeSandbox() {
  const sb = {
    console: {
      log: (...a) => { if (VERBOSE) process.stdout.write('[log] ' + a.join(' ') + '\n'); },
      warn: (...a) => { if (VERBOSE) process.stderr.write('[warn] ' + a.join(' ') + '\n'); },
      error: (...a) => process.stderr.write('[err] ' + a.map(x => (x && x.stack) ? x.stack : String(x)).join(' ') + '\n'),
      info: () => {}, debug: () => {}
    },
    setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate,
    queueMicrotask,
    Math, Date, JSON, RegExp, Error, Promise, Map, Set, WeakMap, WeakSet,
    Array, Object, String, Number, Boolean, Symbol,
    parseInt, parseFloat, isNaN, isFinite,
    document: {
      getElementById: () => fakeEl(),
      querySelector: () => fakeEl(),
      querySelectorAll: () => [],
      addEventListener: () => {}, removeEventListener: () => {},
      createElement: () => fakeEl(), createTextNode: () => fakeEl(),
      body: fakeEl(), documentElement: fakeEl(), head: fakeEl(),
      readyState: 'complete'
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
    navigator: { userAgent: 'node-pipeline-diff' },
    performance: { now: () => Date.now() },
    fetch: () => Promise.reject(new Error('stub·no-fetch·no AI key 也不应触发')),
    alert: () => {}, confirm: () => true, prompt: () => null,
    HTMLElement: function(){}, Event: function(){}, CustomEvent: function(){},
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: () => {},
    indexedDB: undefined,
    location: { href: '', hash: '', search: '', pathname: '/' },
    history: { pushState(){}, replaceState(){}, back(){}, forward(){} },
    getComputedStyle: () => ({ getPropertyValue(){ return ''; } }),
    matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){} })
  };
  sb.window = sb;
  sb.global = sb;
  sb.globalThis = sb;
  sb.addEventListener = () => {};
  sb.removeEventListener = () => {};
  sb.dispatchEvent = () => true;
  return sb;
}

// ─── 加载所有 index.html script + 剧本 ──────────────────────────
function bootSandbox() {
  const sb = makeSandbox();
  vm.createContext(sb);
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scriptRe = /<script[^>]+src="([^"]+\.js)[^"]*"/g;
  const scripts = [];
  let m;
  while ((m = scriptRe.exec(indexHtml)) !== null) scripts.push(m[1].split('?')[0]);
  let loaded = 0, failed = 0;
  for (const s of scripts) {
    const fp = path.join(ROOT, s);
    if (!fs.existsSync(fp)) continue;
    try {
      vm.runInContext(fs.readFileSync(fp, 'utf8'), sb, { filename: s });
      loaded++;
    } catch (e) {
      failed++;
      if (failed < 3) console.error('[load fail]', s, e.message.slice(0, 120));
    }
  }
  // 加剧本
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'scenarios/tianqi7-1627.js'), 'utf8'), sb); }
  catch (e) { console.error('scenario load fail:', e.message); process.exit(1); }
  return { sb, loaded, failed };
}

// ─── 手动 init GM·复用 smoke-letter-flow 注水模式 ───────────────
function initGM(sb) {
  if (!sb.P || !sb.P.scenarios || !sb.P.scenarios.length) {
    throw new Error('NO scenarios registered');
  }
  const sid = 'sc-tianqi7-1627';
  const sc = sb.P.scenarios.find(s => s.id === sid);
  if (!sc) throw new Error('scenario sc-tianqi7-1627 not found');
  if (!sb.GM) sb.GM = {};
  const GM = sb.GM;
  GM.running = true;
  GM.sid = sid;
  GM.turn = 1;
  GM.busy = false;
  GM.vars = GM.vars || {};
  GM.rels = GM.rels || {};
  GM.facs = (sb.P.factions || []).filter(f => f.sid === sid).map(f => Object.assign({}, f));
  GM.chars = (sb.P.characters || []).filter(c => c.sid === sid).map(c => Object.assign({}, c));
  GM.letters = [];
  GM._pendingNpcLetters = [];
  GM._letterSuspects = [];
  GM._courierStatus = {};
  GM._routeDisruptions = [];
  GM.adminHierarchy = sc.adminHierarchy || sb.P.adminHierarchy || null;
  GM._capital = (sc.playerInfo && sc.playerInfo.capital) || '京师';
  GM.evtLog = [];
  GM.officeChanges = [];
  GM.memorials = [];
  GM.qijuHistory = [];
  GM.shijiHistory = [];
  GM._chronicle = [];
  GM._edictTracker = [];
  GM.edicts = [];
  GM._edicts = [];
  GM.guoku = sb.P.guoku || { money: 1000, grain: 1000, cloth: 1000 };
  GM.neitang = sb.P.neitang || {};
  GM.population = sb.P.population || {};
  GM.officeTree = sc.officeTree || sb.P.officeTree || [];
  GM.armies = [];
  GM.activeWars = [];
  GM.activeBattles = [];
  GM.partyState = {};
  GM.classes = [];
  GM.parties = [];
  GM.currentIssues = [];
  GM._capitalHistory = [];
  GM._aiMemory = [];
  GM._consolidatedMemory = [];
  GM._postTurnJobs = [];
  GM._historicalDeviations = [];
  // 清 P.ai.key 让 AI 块整体 skip·两边都走 no-AI fallback
  if (!sb.P.ai) sb.P.ai = {};
  sb.P.ai.key = '';
  if (!sb.P.conf) sb.P.conf = {};
  sb.P.conf.daysPerTurn = 30;
  if (!sb.P.time) sb.P.time = {};
  sb.P.time.daysPerTurn = 30;
  return GM;
}

// ─── deepClone (避免 structuredClone 兼容) ──────────────────────
function deepClone(o) {
  return JSON.parse(JSON.stringify(o, function(k, v) {
    if (typeof v === 'function') return undefined;
    return v;
  }));
}

// ─── 状态 normalize + diff ───────────────────────────────────────
// 抹掉非确定字段(timestamp / Date.now id / 随机)
// tm-save-lifecycle.js 在 pre_endturn save 时把 chronicle/rng 等 clone 到 _saved*·async save 完成后 restore
// 在 headless 测试·async save 可能不收束·两边模式时序差异让 _saved* 在/不在·非真实回归·剔除
const STRIP_KEYS = new Set([
  '_savedChronicle', '_savedChronicleAfterwords', '_savedRngCheckpoints',
  '_savedCharacterArcs', '_savedPlayerDecisions',
  // 其它 in-flight backup·也是 save lifecycle 临时
  '_pendingShijiModal',
  '_endturnTimingLedger', '_endturnTimingHistory'
]);

function normalize(s) {
  const out = JSON.parse(JSON.stringify(s, function(k, v){
    if (typeof v === 'function') return undefined;
    if (STRIP_KEYS.has(k)) return undefined;  // 顶层就剔
    return v;
  }));
  // 递归扫描·替换形如 *_<13位时间戳>* 的字符串 + 各种 timestamp 字段·strip 嵌套 _saved*
  // uid() 生成的 id 也需 normalize·格式：Date.now().toString(36) + seq.toString(36).padStart(3) + random.toString(36).slice(2,7)
  // 总长 ~14-18 字符全 [0-9a-z]·_uidSeq 模块级 counter 跨 run 不重置·两次跑生成不同 id
  function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') {
      for (const k in o) {
        if (STRIP_KEYS.has(k)) { delete o[k]; continue; }
        const v = o[k];
        if (typeof v === 'string') {
          // 优先 id 检测·避免被 string-replace 拦截
          if (k === 'id' && /^[0-9a-z]{8,25}$/.test(v)) {
            o[k] = '<UID>';
          } else {
            o[k] = v.replace(/_\d{13}_/g, '_<TS>_').replace(/\b\d{13}\b/g, '<TS>');
          }
        } else if (k === 'savedAt' || k === 'timestamp' || k === '_ts') {
          o[k] = '<TS>';
        } else {
          walk(v);
        }
      }
    }
  }
  walk(out);
  return out;
}

function diffObj(a, b, prefix, out) {
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null) {
    out.push({ path: prefix, a: a, b: b });
    return;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      out.push({ path: prefix, a: '[len ' + (a||[]).length + ']', b: '[len ' + (b||[]).length + ']' });
      return;
    }
    for (let i = 0; i < a.length; i++) diffObj(a[i], b[i], prefix + '[' + i + ']', out);
    return;
  }
  if (typeof a === 'object') {
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    for (const k of keys) diffObj(a[k], b[k], prefix ? prefix + '.' + k : k, out);
    return;
  }
  if (a !== b) out.push({ path: prefix, a: a, b: b });
}

// ─── 跑一次 _endTurnCore ────────────────────────────────────────
// [slice 7c·2026-05-08] flag 已废·两个 mode 都跑 pipeline·变成 self-diff (决定性 smoke)
async function runOneTurn(sb, mode) {
  // mode 字段保留用于日志输出·不再影响行为
  if (typeof sb._endTurnCore !== 'function') {
    throw new Error('_endTurnCore not exposed in sandbox');
  }
  // _endTurnCore 是 async·await
  await sb._endTurnCore();
}

// ─── 主流程 ──────────────────────────────────────────────────────
(async function main() {
  process.stdout.write('[pipeline-diff] booting sandbox ... ');
  let bootResult;
  try { bootResult = bootSandbox(); }
  catch (e) { console.error('boot failed:', e.message); process.exit(1); }
  process.stdout.write('loaded ' + bootResult.loaded + ' / failed ' + bootResult.failed + '\n');

  const sb = bootResult.sb;
  // 等剧本注册 + module init (setTimeout 50 ms in scenarios)
  await new Promise(r => setTimeout(r, 200));

  process.stdout.write('[pipeline-diff] init GM from scenario ... ');
  try { initGM(sb); process.stdout.write('OK\n'); }
  catch (e) { console.error('init failed:', e.message); process.exit(1); }

  // ── pre-snapshot baseline state
  const baselineGM = deepClone(sb.GM);
  const baselineP = deepClone(sb.P);

  // ─── 锁 Math.random·两次跑共享同一确定序列 ───
  // 简易 mulberry32 PRNG·避免随机性混淆 pipeline 真实回归
  function makeSeededRandom(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const SEED = 0x12345678;
  function freshRandom() { sb.Math.random = makeSeededRandom(SEED); }

  // ── pass 0·baseline 自检·legacy 跑两次·diff 应为 0 (证明 fixture 确定性 OK)
  freshRandom();
  process.stdout.write('[pipeline-diff] pass 0a: legacy baseline run ... ');
  let baselineLegacyGM;
  try {
    await runOneTurn(sb, 'legacy');
    baselineLegacyGM = normalize(sb.GM);
    process.stdout.write('OK\n');
  } catch (e) {
    console.error('baseline legacy run failed:', e.message, '\n', e.stack);
    process.exit(2);
  }

  sb.GM = deepClone(baselineGM);
  sb.P = deepClone(baselineP);
  await new Promise(r => setTimeout(r, 100));

  freshRandom();
  process.stdout.write('[pipeline-diff] pass 0b: legacy baseline rerun ... ');
  let baselineLegacyGM2;
  try {
    await runOneTurn(sb, 'legacy');
    baselineLegacyGM2 = normalize(sb.GM);
    process.stdout.write('OK\n');
  } catch (e) {
    console.error('baseline legacy rerun failed:', e.message, '\n', e.stack);
    process.exit(2);
  }

  // 验证 fixture + seed 是确定的
  const baselineDiffs = [];
  diffObj(baselineLegacyGM, baselineLegacyGM2, '', baselineDiffs);
  if (baselineDiffs.length > 0) {
    console.log('[pipeline-diff] FAIL·baseline self-diff != 0 (' + baselineDiffs.length + ')·随机源未锁定·先修 fixture');
    baselineDiffs.slice(0, 5).forEach(d => console.log('  baseline diff: ' + d.path
      + '\n    A: ' + JSON.stringify(d.a).slice(0,200)
      + '\n    B: ' + JSON.stringify(d.b).slice(0,200)));
    process.exit(5);
  }
  console.log('[pipeline-diff] baseline self-diff = 0·fixture deterministic·继续 pipeline 对照');

  // ── pass 1·legacy
  sb.GM = deepClone(baselineGM);
  sb.P = deepClone(baselineP);
  await new Promise(r => setTimeout(r, 100));
  freshRandom();
  process.stdout.write('[pipeline-diff] pass 1: legacy mode ... ');
  let legacyGM, pipelineGM;
  try {
    await runOneTurn(sb, 'legacy');
    legacyGM = normalize(sb.GM);
    process.stdout.write('OK·turn=' + sb.GM.turn + '\n');
  } catch (e) {
    console.error('legacy run failed:', e.message, '\n', e.stack);
    process.exit(2);
  }

  // ── reset to baseline
  sb.GM = deepClone(baselineGM);
  sb.P = deepClone(baselineP);
  await new Promise(r => setTimeout(r, 100));

  // ── pass 2·pipeline
  freshRandom();
  process.stdout.write('[pipeline-diff] pass 2: pipeline mode ... ');
  try {
    await runOneTurn(sb, 'pipeline');
    pipelineGM = normalize(sb.GM);
    process.stdout.write('OK·turn=' + sb.GM.turn + '\n');
  } catch (e) {
    console.error('pipeline run failed:', e.message, '\n', e.stack);
    process.exit(3);
  }

  // ── diff
  const diffs = [];
  diffObj(legacyGM, pipelineGM, '', diffs);
  if (diffs.length === 0) {
    console.log('[pipeline-diff] PASS·legacy GM === pipeline GM (after normalize)');
    process.exit(0);
  } else {
    console.log('[pipeline-diff] FAIL·' + diffs.length + ' diff(s) between modes:');
    diffs.slice(0, 30).forEach(d => {
      const a = JSON.stringify(d.a);
      const b = JSON.stringify(d.b);
      console.log('  ' + d.path + '\n    legacy:   ' + (a||'<u>').slice(0,200)
                  + '\n    pipeline: ' + (b||'<u>').slice(0,200));
    });
    if (diffs.length > 30) console.log('  ... + ' + (diffs.length - 30) + ' more');
    process.exit(4);
  }
})();

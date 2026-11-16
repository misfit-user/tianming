#!/usr/bin/env node
'use strict';

// smoke-workshop-pipeline-a.js — 工坊全链修缮·批A（止血四刀）静态断言
//   A1 目录加载出错态与真空态分离 · A2 封面键位双键兼容 ·
//   A3 mod=混合资产组合包（接三条生效链）· A4 网页/安卓配额专门提示
// 风格沿袭 smoke-workshop-admin-review-ui.js：读运行时源码，正则/子串断言不回归。

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const cm = read('tm-content-manager.js');
const community = read('tm-content-manager-community.js');
const admin = read('workshop-admin.html');

// 语法自检（除 admin 内联脚本外，其余三个 JS 运行时源用 --check 由 run-smokes 侧跑；
// 这里对 admin 内联脚本 new Function 一遍，防审核台缩略图改动引入语法错）。
const adminScript = admin.match(/<script>([\s\S]*?)<\/script>/);
assert(adminScript, 'workshop-admin.html should include an inline script');
new Function(adminScript[1]);

// ── ① A1：catalog 直连分支存在 resp.ok 检查，且错误卡/空卡两态分离 ──
// 融合树：tm-online-client.js 采百工谱阁超集版（两条 catalog 路径均 resp.ok 抛错 + cat.success===false 抛业务错），
// 直连分支文案由批A「HTTP …」升为「在线目录 HTTP …」——语义（resp.text() 前先查 resp.ok、非 2xx 抛 HTTP 码）不变。
// community 侧错误卡（含「重试」）与真空卡两态分离，且靠 catalogError 标记而非文案串匹配

// ── ③ A3：waWarmup 含 mod 包扫描，且排除残局包 / 封面基名 ──
// mod 详情与安装文案的组合包语义

// ════════════════════════════════════════════════════════════════════════
//  返修·Codex 四条：把上面的「水断言」升级为可执行断言（纯 node·无 DOM）。
//  手法：正则从运行时源码抽出目标纯函数源文，new Function 包一层参数化注入闭包依赖后真跑。
// ════════════════════════════════════════════════════════════════════════

// 花括号平衡不敏感的轻量抽取器：本仓源码风格下顶层函数收尾恒为「\n  }」(2空格花括号独占一行)，
// 且函数体内层收尾缩进更深(≥4空格)——故从函数头首现处切到首个「\n  }」即函数全文。
function extractFn(src, header) {
  var s = src.indexOf(header);
  assert(s >= 0, 'extractFn 找不到函数头: ' + header);
  var rest = src.slice(s);
  var end = rest.indexOf('\n  }');
  assert(end >= 0, 'extractFn 找不到 2 空格收尾花括号: ' + header);
  return rest.slice(0, end + 4); // 含尾部 "\n  }"
}

// ── R4·R1：目录视图态纯 helper 真跑四态判定 ──────────────────────────────
(function testCatalogViewState() {
  var catalogViewState = new Function(extractFn(community, 'function catalogViewState(state)') + '\nreturn catalogViewState;')();
  assert(catalogViewState({ catalog: { packs: [{ id: 'a' }] }, catalogError: 'HTTP 500' }) === 'stale',
    'R4·R1: 出错+有旧数据 → stale（上方 banner·列表照常）');
  assert(catalogViewState({ catalog: null, catalogError: 'HTTP 500' }) === 'error',
    'R4·R1: 出错+无数据 → error（错误卡）');
  assert(catalogViewState({ catalog: { packs: [] }, catalogError: null }) === 'empty',
    'R4·R1: 无错误+无数据 → empty（真空卡）');
  assert(catalogViewState({ catalog: { packs: [{ id: 'a' }] }, catalogError: null }) === 'list',
    'R4·R1: 无错误+有数据 → list');
})();

// P1(三轮)·真跑渲染验输出（字符串共现到头：突变 `false && vs === 'error'` 字符串仍在会静默 PASS）：
// extractFn 抽 renderDiscover / renderBrowsePane 源文，new Function 参数化注入受控 catalogViewState +
// 哨兵 error-card('<<ERRCARD>>')/stale-banner('<<STALEBANNER>>')，其余闭包依赖给最小 stub
// （html helper 一律回 ''·esc 原样·state 按场景构造）。缺谁补谁·不 try/catch 吞错——抽取失配或运行抛错都必须红。
(function testPaneRenderOutput() {
  var ERR = '<<ERRCARD>>', STALE = '<<STALEBANNER>>';
  function esc(s) { return s == null ? '' : String(s); }
  function nil() { return ''; }
  function jsArg(s) { return "'" + esc(s) + "'"; }
  var covers = { tone: function () { return 'zhu'; }, sceneSVG: nil };
  var PACK_TYPES = [{ v: '', label: '全部' }, { v: 'scenario', label: '剧本' }, { v: 'portrait', label: '立绘' }];
  // 形参表（须与下方 TAIL 顺序一一对应；state / catalogViewState 每场景单独在 run() 里给）。
  // 融合后 renderDiscover/renderBrowsePane 以百工谱阁新结构为体（引入 document/truthEmpty/metricText/
  // packCoverUrl/hasMetric）——按需补齐 stub 面；四场景断言语义不变。
  var PARAMS = ['state', 'catalogViewState', 'catalogErrorCardHtml', 'catalogStaleBannerHtml',
    'mallSkeleton', 'mallGlyph', 'window', 'TMWorkshopCovers', 'jsArg', 'esc', 'mallStars',
    'mallCover', 'mallCard', 'mallTypeChips', 'PACK_TYPES', 'mallFopt', 'packTypeLabel',
    'document', 'truthEmpty', 'metricText', 'packCoverUrl', 'hasMetric'];
  var TAIL = [
    function () { return ERR; },   // catalogErrorCardHtml → 哨兵
    function () { return STALE; },  // catalogStaleBannerHtml → 哨兵
    nil,                            // mallSkeleton
    nil,                            // mallGlyph
    { TMWorkshopCovers: covers },   // window
    covers,                         // TMWorkshopCovers
    jsArg, esc, nil,                // jsArg / esc / mallStars
    nil, nil, nil,                  // mallCover / mallCard / mallTypeChips
    PACK_TYPES, nil, nil,           // PACK_TYPES / mallFopt / packTypeLabel
    { querySelector: function () { return null; } }, // document（heroHtml 取版本 meta）
    nil,                            // truthEmpty（真空/降级卡 → ''）
    nil,                            // metricText（下载量文案 → ''）
    nil,                            // packCoverUrl（投稿封面 URL → '' 视作无封面）
    function () { return false; }   // hasMetric（无真实字段 → 不纳入热门榜）
  ];
  function build(name) {
    return new Function(PARAMS.join(','), extractFn(community, 'function ' + name + '()') + '\nreturn ' + name + ';');
  }
  var discoverFactory = build('renderDiscover'), browseFactory = build('renderBrowsePane');
  function run(factory, state, vs) {
    return factory.apply(null, [state, function () { return vs; }].concat(TAIL))();
  }
  var pk = [{ id: 'a', type: 'scenario' }];
  // ① vs='error' 且无 packs → 两函数真输出各含错误卡哨兵。
  var s1 = { catalog: { packs: [] }, catalogError: 'HTTP 500', catalogLoading: false, catalogType: '', featuredOn: false };
  assert(run(discoverFactory, s1, 'error').indexOf(ERR) >= 0, 'P1·真跑: renderDiscover(error,无packs) 输出须含错误卡');
  assert(run(browseFactory, s1, 'error').indexOf(ERR) >= 0, 'P1·真跑: renderBrowsePane(error,无packs) 输出须含错误卡');
  // ② vs='stale' 且有 packs → 两函数真输出各含 stale banner 哨兵（列表照常渲染·不遮内容）。
  var s2 = { catalog: { packs: pk }, catalogError: 'HTTP 500', catalogLoading: false, catalogType: '', featuredOn: false };
  assert(run(discoverFactory, s2, 'stale').indexOf(STALE) >= 0, 'P1·真跑: renderDiscover(stale,有packs) 输出须含 stale banner');
  assert(run(browseFactory, s2, 'stale').indexOf(STALE) >= 0, 'P1·真跑: renderBrowsePane(stale,有packs) 输出须含 stale banner');
  // ③ vs='list' → 两哨兵都不出现。
  var d3 = run(discoverFactory, { catalog: { packs: pk }, catalogError: null, catalogLoading: false, catalogType: '', featuredOn: false }, 'list');
  var b3 = run(browseFactory, { catalog: { packs: pk }, catalogError: null, catalogLoading: false, catalogType: '', featuredOn: false }, 'list');
  assert(d3.indexOf(ERR) < 0 && d3.indexOf(STALE) < 0, 'P1·真跑: renderDiscover(list) 输出不得含错误卡/stale banner');
  assert(b3.indexOf(ERR) < 0 && b3.indexOf(STALE) < 0, 'P1·真跑: renderBrowsePane(list) 输出不得含错误卡/stale banner');
  // ④ browse 在 catalogLoading 时须 skeleton 优先·不出错误卡（即便 vs='error'）。
  var s4 = { catalog: { packs: [] }, catalogError: 'HTTP 500', catalogLoading: true, catalogType: '', featuredOn: false };
  assert(run(browseFactory, s4, 'error').indexOf(ERR) < 0, 'P1·真跑: renderBrowsePane(catalogLoading) 须 skeleton 优先·不出错误卡');
})();

// ── R4·R2：立绘归并顺序纯 helper 真跑（确定可复述·portrait 恒优先 mod·同类型按 order）──
(function testMergeOrder() {
  var waMergePortraitIndex = new Function(extractFn(cm, 'function waMergePortraitIndex(items)') + '\nreturn waMergePortraitIndex;')();
  var portraitItem = { type: 'portrait', order: 1, entries: [{ base: 'zhang', url: 'P::zhang' }] };
  var modItem = { type: 'mod', order: 0, entries: [{ base: 'zhang', url: 'M::zhang' }] };
  assert(waMergePortraitIndex([modItem, portraitItem]).zhang === 'P::zhang',
    'R4·R2: 同名立绘·portrait 包优先于 mod 包（输入序 mod 在前也不改结果）');
  assert(waMergePortraitIndex([portraitItem, modItem]).zhang === 'P::zhang',
    'R4·R2: 同名立绘·portrait 包优先于 mod 包（输入序 portrait 在前）');
  var pA = { type: 'portrait', order: 0, entries: [{ base: 'li', url: 'A::li' }] };
  var pB = { type: 'portrait', order: 1, entries: [{ base: 'li', url: 'B::li' }] };
  assert(waMergePortraitIndex([pB, pA]).li === 'A::li',
    'R4·R2: 同类型按 waListAssetPacks 列表序（order 小者先占坑）');
})();

// ── R4·R3：配额判定纯 helper 真跑（只认真配额错误·不误吞其他错误）──────────
(function testQuota() {
  var isQuotaError = new Function(extractFn(cm, 'function isQuotaError(e)') + '\nreturn isQuotaError;')();
  assert(isQuotaError({ name: 'QuotaExceededError' }) === true, 'R4·R3: QuotaExceededError 名 → true');
  assert(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }) === true, 'R4·R3: Firefox NS_ERROR_DOM_QUOTA_REACHED 名 → true');
  assert(isQuotaError(new Error('Persistent storage maximum size reached')) === true,
    'R4·R3: Firefox「Persistent storage maximum size reached」(storage+maximum size reached) → true');
  assert(isQuotaError(new Error('storage maximum size setting is malformed')) === false,
    'R4·R3: 「maximum size setting is malformed」非到达语义·不得误判为配额（maximum size 须配 reached|exceeded）');
  assert(isQuotaError(new Error('quota exceeded')) === true, 'R4·R3: message 含 quota → true');
  assert(isQuotaError(new Error('存储空间不足')) === true, 'R4·R3: 含「存储空间」→ true');
  assert(isQuotaError(new Error('storage is full')) === true, 'R4·R3: storage+full 组合 → true');
  assert(isQuotaError(new Error('Maximum call stack size exceeded')) === false,
    'R4·R3: "call stack size exceeded" 不得误判为配额（裸 exceeded 匹配已删·收紧不放宽）');
  assert(isQuotaError(new Error('network timeout')) === false, 'R4·R3: 无关错误 → false');
  assert(isQuotaError(null) === false, 'R4·R3: null → false');
})();

// ── P1·真源条 stale 档接入（Codex 融合审 NO-GO 返修）：stale=「有可用旧数据的降级态」，
//   真源条须走中间态(is-fallback)、绝不落 is-error 红档，且值含「旧目录」文案——真跑
//   renderWorkshopSourceStrip + workshopSourceBadge 验（删 stale 分支即红）。
(function testSourceStripStale() {
  function esc(s) { return s == null ? '' : String(s); }
  var badge = new Function('esc', extractFn(cm, 'function workshopSourceBadge(label, status, value, title)') + '\nreturn workshopSourceBadge;')(esc);
  var makeStrip = new Function(
    'state', 'workshopSourceBadge', 'desktop', 'currentWorkshopVersion', 'esc',
    extractFn(cm, 'function renderWorkshopSourceStrip()') + '\nreturn renderWorkshopSourceStrip;'
  );
  function strip(status) {
    return makeStrip(
      { catalogStatus: status, catalog: { packs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
        catalogError: '在线目录 HTTP 500；仓库官方清单不可用', featuredStatus: 'ok', featuredPacks: [{ id: 'f' }],
        packs: [{ id: 'x' }], webInstalled: [{ id: 'x' }] },
      badge, function () { return true; }, function () { return '1.2.3'; }, esc
    )();
  }
  var s = strip('stale');
  assert(s.indexOf('is-error') < 0, 'P1: 真源条 stale 整条不落 is-error（目录走中间态·精选/安装/版本均 ok）');
  assert(/is-fallback/.test(s), 'P1: 真源条 stale 目录档走中间态 is-fallback');
  assert(s.indexOf('旧目录') >= 0, 'P1: 真源条 stale 含「旧目录」文案（有旧数据的降级态）');
  // 反证：badge 直跑 error 档仍红、stale 档不红。
  assert(badge('正式在线目录', 'error', '不可用', '').indexOf('is-error') >= 0, 'P1: error 档仍落 is-error（反证）');
  assert(badge('正式在线目录', 'stale', '3 件·旧目录', '').indexOf('is-error') < 0, 'P1: stale 档 badge 不落 is-error（反证）');
})();

// ── P1·侧栏 browse/ranks 计数须纳入 stale（有旧数据即显示数量）：真跑 workshopPaneCount 验，
//   「改回 ^(ok|fallback)$」的突变会让 stale 计数消失即红。
(function testWorkshopPaneCountStale() {
  var makeCount = new Function('state', extractFn(cm, 'function workshopPaneCount(pane)') + '\nreturn workshopPaneCount;');
  function count(status, pane, packs) {
    return makeCount({ catalogStatus: status, catalog: { packs: packs } })(pane);
  }
  assert(count('stale', 'browse', [{ id: 'a' }, { id: 'b' }]) === 2, 'P1: workshopPaneCount(browse) stale 须显示数量(2)');
  assert(count('stale', 'ranks', [{ id: 'a' }]) === 1, 'P1: workshopPaneCount(ranks) stale 须显示数量(1)');
  assert(count('ok', 'browse', [{ id: 'a' }]) === 1, 'P1: ok 仍显示计数（反证）');
  assert(count('fallback', 'ranks', [{ id: 'a' }]) === 1, 'P1: fallback 仍显示计数（反证）');
  assert(count('idle', 'browse', [{ id: 'a' }]) === '', 'P1: idle 隐藏计数（反证）');
  assert(count('error', 'ranks', [{ id: 'a' }]) === '', 'P1: error 隐藏计数（反证）');
})();

// ── R4·loadWorkshopCatalog 三条生命周期路径真跑（成功清错 / 失败保留 stale / 开跑清错）──
(function testLoadCatalogLifecycle() {
  // 融合后 loadWorkshopCatalog 的 catch 先走百工谱阁 loadBundledCatalogFallback 再分层——注入其 stub
  // （恒返回 false = bundled 兜底也失败），令「失败保留旧在线数据(stale)」这条被测路径成立。
  var makeLWC = new Function(
    'state', 'render', 'desktop', 'document', 'window', 'TM', 'catalogUrlWithParams', 'saveCatalogUrl', 'loadBundledCatalogFallback',
    extractFn(cm, 'async function loadWorkshopCatalog()') + '\nreturn loadWorkshopCatalog;'
  );
  function runLWC(state, catalogFn, fallbackFn) {
    var lwc = makeLWC(
      state,
      function render() {},
      function desktop() { return false; },
      { getElementById: function () { return null; } },
      {},
      { OnlineClient: { catalog: catalogFn } },
      function catalogUrlWithParams() { return state.catalogUrl || ''; },
      function saveCatalogUrl() {},
      fallbackFn || async function loadBundledCatalogFallback() { return false; }
    );
    return lwc();
  }
  return (async function () {
    // ① 成功路径：catalog 返回 {packs:[…]} → catalogError 清空且 packs 落位。
    var s1 = { catalogUrl: 'u', defaultCatalogUrl: 'u', catalog: null, catalogError: null };
    await runLWC(s1, async function () { return { type: 'tianming-workshop-catalog', packs: [{ id: 'a' }, { id: 'b' }] }; });
    assert(s1.catalogError === null, 'R4·LWC①: 成功后 catalogError===null');
    assert(s1.catalog && s1.catalog.packs && s1.catalog.packs.length === 2, 'R4·LWC①: packs 落位');

    // ② 失败路径：抛 HTTP 500 → catalogError 含 'HTTP 500' 且旧 catalog 保持（stale 保留）。
    var s2 = { catalogUrl: 'u', defaultCatalogUrl: 'u', catalog: { type: 't', packs: [{ id: 'old' }] }, catalogError: null };
    await runLWC(s2, async function () { throw new Error('HTTP 500'); });
    assert(/HTTP 500/.test(s2.catalogError || ''), 'R4·LWC②: 失败后 catalogError 含 HTTP 500');
    assert(s2.catalog && s2.catalog.packs && s2.catalog.packs[0] && s2.catalog.packs[0].id === 'old',
      'R4·LWC②: 失败保留旧目录（不清 state.catalog）');

    // ③ 开跑清错：预置旧错误 → 成功后清空（护「state.catalogError = null;」清错行不被摘）。
    var s3 = { catalogUrl: 'u', defaultCatalogUrl: 'u', catalog: null, catalogError: '上一次的旧错误' };
    await runLWC(s3, async function () { return { packs: [{ id: 'z' }] }; });
    assert(s3.catalogError === null, 'R4·LWC③: 开跑清错→成功后 catalogError 为 null');

    // ④ P2 复合串保全（stale·有旧数据）：兜底 stub 主动把 catalogError 置为「在线；兜底」复合串并返 false
    //    → catch 的 if(!state.catalogError) 须保全该复合串，绝不被单在线 e.message 覆盖。
    //    （空兜底 stub 分不清「保全」与「无条件覆盖」·此路径专锁 P2 不回归。）
    var s4 = { catalogUrl: 'u', defaultCatalogUrl: 'u', catalog: { type: 't', packs: [{ id: 'keep' }] }, catalogError: null };
    await runLWC(s4, async function () { throw new Error('在线目录 HTTP 500'); }, async function () {
      s4.catalogError = '在线目录 HTTP 500；仓库清单 fetch 失败';
      return false;
    });
    assert(s4.catalogError === '在线目录 HTTP 500；仓库清单 fetch 失败',
      'R4·LWC④: 兜底复合错误须保全(stale)·不被单在线错误覆盖（含兜底失败原因）');
    assert(s4.catalogStatus === 'stale' && s4.catalog && s4.catalog.packs[0] && s4.catalog.packs[0].id === 'keep',
      'R4·LWC④: stale 保留旧数据且状态为 stale');

    // ⑤ P2 复合串保全（error·无旧数据）：同上但无旧目录 → catch 另一条 if(!state.catalogError) 也须保全复合串。
    var s5 = { catalogUrl: 'u', defaultCatalogUrl: 'u', catalog: null, catalogError: null };
    await runLWC(s5, async function () { throw new Error('在线目录 HTTP 500'); }, async function () {
      s5.catalogError = '在线目录 HTTP 500；仓库清单 fetch 失败';
      return false;
    });
    assert(s5.catalogError === '在线目录 HTTP 500；仓库清单 fetch 失败',
      'R4·LWC⑤: 兜底复合错误须保全(error·无数据)·不被单在线错误覆盖');
  })();
})().then(function () {
// 收尾行保持原样(列 0)：全部路径通过后打印 PASS。
console.log('[smoke-workshop-pipeline-a] PASS');
}).catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});

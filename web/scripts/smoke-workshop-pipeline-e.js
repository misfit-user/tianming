#!/usr/bin/env node
'use strict';

// smoke-workshop-pipeline-e.js — 工坊全链修缮·批E+批C 可执行断言
//   E-a feed scope 竞态守卫（先发后至不覆盖·真跑 loadFeed 源）· 输入快照恢复（真跑 render 快照/恢复段）
//   E-b 安装 404 归因文案（源位断言：throw 在 PK 魔数判定之前）· 官方/残局包 packMeta 跳过（谓词真跑）
//   C  网页下载进度（readBytesWithProgress 真跑：分块累计 + onProgress）· 复用批B 节流纯函数
//   返修（对抗审三修）：F1 DM 发送即失焦（sendDm blur→重渲快照不命中→已发文本不盖回·真跑）·
//     F2 loadFeed .then/.catch 两出口都有 scope 守卫· F3 packMeta 跳过谓词改按目录行语义(isResumePack(p))防英文 slug 误伤。
//   突变自检 ≥4 枚：scope 守卫删掉→红（真跑）/ 404 throw 删掉→红（源位）/ 条目数闸删掉→红（pipeline-b）/ blur 删掉→红（真跑）
//     ——各在内存副本上真跑验红，全程 fresh-read 证真源未被污染。
// 风格沿袭 smoke-workshop-pipeline-a/b：读运行时源码 + extractFn 抽纯函数真跑。

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// 家族装载序（lint-smoke-family-order）：origin 'tm-content-manager.js' 须先于
// 紧随其后的 'tm-content-manager-community.js'——故先读 origin，后读 community。
const cmSrc = read('tm-content-manager.js');
const communitySrc = read('tm-content-manager-community.js');
const onlineApi = require(path.join(ROOT, 'tm-online-client.js'));

// —— 抽取器（沿袭批A/B）：本仓顶层函数收尾恒为「\n  }」（2 空格花括号独占一行）。
function extractFn(src, header) {
  var s = src.indexOf(header);
  assert(s >= 0, 'extractFn 找不到函数头: ' + header);
  var rest = src.slice(s);
  var end = rest.indexOf('\n  }');
  assert(end >= 0, 'extractFn 找不到 2 空格收尾花括号: ' + header);
  return rest.slice(0, end + 4);
}
// 抽单行语句（快照/恢复段是 render() 内联行，非独立函数）：按唯一片段定位整行。
function lineWith(src, needle) {
  var i = src.indexOf(needle);
  assert(i >= 0, 'lineWith 找不到片段: ' + needle);
  var a = src.lastIndexOf('\n', i) + 1, b = src.indexOf('\n', i);
  return src.slice(a, b < 0 ? src.length : b).replace(/\r$/, '');
}
function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

// ════════════════════════════════════════════════════════════════════════
//  E-a-①：feed scope 竞态守卫真跑——先发后至的旧 scope 不覆盖当前页（真跑 loadFeed 源）
// ════════════════════════════════════════════════════════════════════════
var loadFeedSrc = extractFn(communitySrc, 'function loadFeed()');
assert(loadFeedSrc.includes("if ((state.feedScope || 'recommend') !== scope) return;"),
  'E-a①: loadFeed 源含 scope 守卫行');
// F2（返修）：scope 守卫须在 .then 与 .catch 两个异步出口都有——旧 scope 请求网络层 reject 晚到不得把错误态盖到当前页。
assert((loadFeedSrc.match(/!== scope\) return;/g) || []).length >= 2,
  'F2: loadFeed .then 与 .catch 两处异步出口都含 scope 守卫');

// 用注入的 window/TM/state/render 真跑抽出的 loadFeed 源（只引用这四个自由名）。
function buildLoadFeed(src) {
  return new Function('window', 'TM', 'state', 'render', src + '\nreturn loadFeed;');
}
function raceScenario(loadFeedFactory) {
  var deferreds = [];
  var fakeTM = { OnlineClient: { feed: function (scope) {
    var d = { scope: scope };
    d.promise = new Promise(function (res) { d.resolve = res; });
    deferreds.push(d); return d.promise;
  } } };
  var state = { feedScope: 'recommend', onlineApiUrl: '' };
  var loadFeed = loadFeedFactory({ TM: fakeTM }, fakeTM, state, function () {});
  loadFeed();                       // 发起 A：捕获 scope='recommend'（deferreds[0]）
  state.feedScope = 'following';    // 用户切到「关注」
  loadFeed();                       // 发起 B：捕获 scope='following'（deferreds[1]）
  // 先到 B（当前页·应生效），后到 A（旧 scope·应被守卫拦掉）
  deferreds[1].resolve({ success: true, posts: [{ id: 'FOL' }] });
  return tick().then(function () {
    deferreds[0].resolve({ success: true, posts: [{ id: 'REC' }] });
    return tick();
  }).then(function () { return state; });
}
var pRace = raceScenario(buildLoadFeed(loadFeedSrc)).then(function (state) {
  assert(state.feedData && state.feedData.posts && state.feedData.posts[0].id === 'FOL',
    'E-a①: 先发后至——旧 recommend 未覆盖当前 following（守卫生效）');
});

// ════════════════════════════════════════════════════════════════════════
//  E-a-②：重渲吞输入——快照/恢复段真跑（假 DOM 上跑 render() 内联的两行源）
// ════════════════════════════════════════════════════════════════════════
var snapLine = lineWith(cmSrc, 'var _snapAE = document.activeElement');
var restoreLine = lineWith(cmSrc, 'var _rel = document.getElementById(_snap.id)');
assert(/INPUT\|TEXTAREA/.test(snapLine), 'E-a②: 快照段限 input/textarea');
(function () {
  // 假 DOM：activeElement 是壳内正在编辑的输入框；重渲后 getElementById 返回「已被清空」的新元素。
  var fresh = { id: 'tm-mall-q', value: '', focused: false, sel: null,
    focus: function () { this.focused = true; }, setSelectionRange: function (s, e) { this.sel = [s, e]; } };
  var active = { tagName: 'INPUT', id: 'tm-mall-q', value: '天启', selectionStart: 2, selectionEnd: 2 };
  var bg = { contains: function (el) { return el === active; } };
  var document = { activeElement: active, getElementById: function (id) { return id === 'tm-mall-q' ? fresh : null; } };
  // 真跑源：快照 → （模拟 innerHTML 重建，焦点/字符已丢）→ 恢复。
  var runner = new Function('document', 'bg', snapLine + '\n' + restoreLine + '\nreturn _snap;');
  var snap = runner(document, bg);
  assert(snap && snap.id === 'tm-mall-q' && snap.v === '天启' && snap.s === 2, 'E-a②: 快照抓到 id/value/光标');
  assert.strictEqual(fresh.value, '天启', 'E-a②: 恢复后新元素 value 复原');
  assert.strictEqual(fresh.focused, true, 'E-a②: 恢复后重新聚焦');
  assert.deepStrictEqual(fresh.sel, [2, 2], 'E-a②: 恢复后光标位置复原');
})();

// ════════════════════════════════════════════════════════════════════════
//  F1（返修·阻断项）：DM 发送即失焦——sendDm 起异步前 blur，重渲快照不命中该框→已发文本不被盖回（清空保留）
// ════════════════════════════════════════════════════════════════════════
var sendDmSrc = extractFn(communitySrc, 'function sendDm()');
assert(/if \(el && el\.blur\) el\.blur\(\);/.test(sendDmSrc), 'F1: sendDm 起异步前对 #tm-dm-input 调 blur()');
// 真跑 sendDm 源（注入 document/state/TM/loadConversation/render）：验其同步 blur 令输入框失焦。
function runSendDm(src) {
  var body = { tagName: 'BODY' };
  var input = { tagName: 'INPUT', id: 'tm-dm-input', value: '你好，同志', selectionStart: 5, selectionEnd: 5,
    blur: function () { document.activeElement = body; } };
  var document = { activeElement: input, getElementById: function (id) { return id === 'tm-dm-input' ? input : null; } };
  var sent = null;
  var TM = { OnlineClient: { sendMessage: function (to, text) { sent = { to: to, text: text }; return { then: function () { return { catch: function () {} }; } }; } } };
  var state = { dmPeer: { id: 7 }, onlineApiUrl: '' };
  var sendDm = new Function('document', 'state', 'TM', 'loadConversation', 'render', '_accountEpoch', '_sameAccountEpoch', src + '\nreturn sendDm;')(
    document, state, TM, function () {}, function () {}, function () { return 0; }, function (epoch) { return epoch === 0; }
  );
  sendDm();
  return { document: document, body: body, input: input, sent: sent };
}
function renderKeepsBoxEmpty(activeEl, box, hostEl) {
  // 跑 render() 的快照/恢复两行源：activeElement 非壳内输入框时快照必为 null，重建的空框保持为空。
  var bg = { contains: function (el) { return el === hostEl; } };
  var doc2 = { activeElement: activeEl, getElementById: function (id) { return id === 'tm-dm-input' ? box : null; } };
  var snap = new Function('document', 'bg', snapLine + '\n' + restoreLine + '\nreturn _snap;')(doc2, bg);
  return snap;
}
(function () {
  var r = runSendDm(sendDmSrc);
  assert(r.sent && r.sent.text === '你好，同志', 'F1: 私信内容已提交发送');
  assert.strictEqual(r.document.activeElement, r.body, 'F1: sendDm 已令输入框失焦（activeElement 落回 body）');
  var fresh = { id: 'tm-dm-input', value: '', focus: function () {}, setSelectionRange: function () {} };
  var snap = renderKeepsBoxEmpty(r.document.activeElement, fresh, r.input);   // 失焦后 activeElement 不在壳内
  assert.strictEqual(snap, null, 'F1: 发送失焦后重渲快照为 null（不进回填）');
  assert.strictEqual(fresh.value, '', 'F1: 重渲后 #tm-dm-input 为空——已发文本不被盖回（清空保留·不误重发）');
})();

// ════════════════════════════════════════════════════════════════════════
//  E-b-①：安装 404 归因文案——throw 在 PK 魔数判定之前（源位断言）
// ════════════════════════════════════════════════════════════════════════
var installWebSrc = extractFn(cmSrc, 'async function installCatalogPackWeb(');
function okBeforePk(src) {
  var iThrow = src.indexOf("if (!resp.ok) throw new Error('下载失败：HTTP ' + resp.status);");
  var iPk = src.indexOf('rawBuf[0] === 0x50');
  return iThrow >= 0 && iPk >= 0 && iThrow < iPk;
}
assert(okBeforePk(installWebSrc), 'E-b①: resp.ok 404 归因 throw 在 PK 魔数判定之前（404 不再误报「仅支持 store zip」）');

// ════════════════════════════════════════════════════════════════════════
//  E-b-②：官方/残局包 packMeta 跳过——跳过谓词真跑
// ════════════════════════════════════════════════════════════════════════
var openDetailSrc = extractFn(cmSrc, 'function openPackDetail(');
// F3（返修）：跳过谓词改按目录行语义（isResumePack(p)）——不再单凭 id 前缀，英文标题 slug 出 resume- 的真实用户包不再漏富化。
assert(/p \? isResumePack\(p\) :/.test(openDetailSrc) && /indexOf\('tianming-official-'\) === 0/.test(openDetailSrc),
  'E-b②: openPackDetail packMeta 跳过谓词按目录行语义（official 前缀 || isResumePack(p)·锁三元式非注释）');
// 真跑真源 isResumePack + 目录行语义门（p=目录行恒非空；null 兜底走 id 前缀）。
var isResumePack = new Function(extractFn(cmSrc, 'function isResumePack(') + '\nreturn isResumePack;')();
var metaSkip = function (id, row) {
  return row
    ? (String(id).indexOf('tianming-official-') === 0 || isResumePack(row))
    : (String(id).indexOf('tianming-official-') === 0 || String(id).indexOf('resume-') === 0);
};
assert.strictEqual(metaSkip('tianming-official-mingmo', { id: 'tianming-official-mingmo' }), true, 'E-b②: 官方包跳过 packMeta');
assert.strictEqual(metaSkip('resume-tianqi7-t42-x', { tags: ['天启', '残局'] }), true, 'E-b②: 残局包(tags 含「残局」)跳过 packMeta');
assert.strictEqual(metaSkip('resume-tianqi7-t42-x', { packageKind: 'resume' }), true, 'E-b②: 残局包(packageKind=resume)跳过 packMeta');
assert.strictEqual(metaSkip('player-pack-42', { tags: [] }), false, 'E-b②: 普通玩家包照常富化');
assert.strictEqual(metaSkip('resume-adventure', { title: 'Resume Adventure', tags: [], packageKind: 'store-zip' }), false,
  'E-b②·F3: 英文标题 slug 出 resume- 的真实用户包(非残局行)不再漏富化');
assert.strictEqual(metaSkip('resume-x', null), true, 'E-b②·F3: 无目录行时回落 id 前缀兜底仍跳过');

// ════════════════════════════════════════════════════════════════════════
//  C-①：网页下载进度——readBytesWithProgress 真跑（分块累计 + onProgress + 回落）
// ════════════════════════════════════════════════════════════════════════
var client = onlineApi.createOnlineClient({ storage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} } });
assert.strictEqual(typeof client.readBytesWithProgress, 'function', 'C①: 导出 readBytesWithProgress');
function fakeResp(chunks, total) {
  var i = 0;
  return { headers: { get: function (k) { return k === 'Content-Length' ? String(total) : null; } },
    body: { getReader: function () { return { read: function () {
      return Promise.resolve(i < chunks.length ? { done: false, value: chunks[i++] } : { done: true });
    } }; } } };
}
var chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6, 7]), new Uint8Array([8, 9])];
var progs = [];
var pProg = client.readBytesWithProgress(fakeResp(chunks, 9), function (loaded, total) { progs.push([loaded, total]); })
  .then(function (out) {
    assert.deepStrictEqual(Array.from(out), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'C①: 分块流式拼回完整字节');
    assert.deepStrictEqual(progs, [[3, 9], [7, 9], [9, 9]], 'C①: onProgress 逐块累计 loaded/total');
    // reader 不可用 → 回落 arrayBuffer（行为不变）
    return client.readBytesWithProgress({ arrayBuffer: function () { return Promise.resolve(new Uint8Array([42]).buffer); } });
  }).then(function (fb) { assert.deepStrictEqual(Array.from(fb), [42], 'C①: 无 reader 回落 arrayBuffer'); });

// ── C-②：下载进度节流真跑——readBytesWithProgress 的原始进度经批B 节流纯函数收敛 ──
var shouldRender = new Function(extractFn(cmSrc, 'function uploadProgressShouldRender(') + '\nreturn uploadProgressShouldRender;')();
(function () {
  // 100 个 1% 步进的进度（同一时刻·sinceMs≈0）：节流后只在跨 5% 边界处渲染，远少于 100 次。
  var lastPct = -1, lastAt = 0, now = 0, renders = 0;
  for (var pct = 0; pct <= 100; pct++) { if (shouldRender(pct, lastPct, now - lastAt)) { lastPct = pct; lastAt = now; renders++; } }
  assert(renders < 30 && renders >= 20, 'C②: 100 步 1% 进度经节流收敛到约 20 次（<30·跨 5% 边界 + 100% 必渲）');
  assert.strictEqual(shouldRender(100, 99, 0), true, 'C②: 100% 必渲');
})();

// ════════════════════════════════════════════════════════════════════════
//  突变自检（≥3 枚）：内存副本上真跑验红
// ════════════════════════════════════════════════════════════════════════
// 突变1（scope 守卫删掉→红）：抽出的 loadFeed 源删守卫行 → 先发后至的旧 recommend【会】覆盖 following。
var pMut1 = (function () {
  var mutSrc = loadFeedSrc.replace(/ *if \(\(state\.feedScope \|\| 'recommend'\) !== scope\) return;\r?\n/, '');
  assert(mutSrc !== loadFeedSrc, '突变1: scope 守卫行确实被删');
  return raceScenario(buildLoadFeed(mutSrc)).then(function (state) {
    assert(state.feedData && state.feedData.posts[0].id === 'REC',
      '突变1: 删守卫后旧 recommend 覆盖了 following（真跑证守卫断言据此变红）');
  });
})();
// 突变2（404 throw 删掉→红）：installCatalogPackWeb 源删 404 归因行 → okBeforePk 断言变红。
(function () {
  var mutSrc = installWebSrc.replace(/ *if \(!resp\.ok\) throw new Error\('下载失败：HTTP ' \+ resp\.status\);\r?\n/, '');
  assert(mutSrc !== installWebSrc, '突变2: 404 归因行确实被删');
  assert.strictEqual(okBeforePk(mutSrc), false, '突变2: 删 404 throw 后 okBeforePk=false（源位断言据此变红）');
})();
// 突变3（条目数闸删掉→红）：见 smoke-workshop-pipeline-b（buildZip 条目数闸真跑 + 突变），此处不重复。
// 突变4（F1·删 blur→红）：sendDm 源删掉 blur 行 → 发送后输入框仍聚焦 → 重渲快照命中→已发文本被盖回（F1 断言据此变红）。
(function () {
  var mutSrc = sendDmSrc.replace(/ *if \(el && el\.blur\) el\.blur\(\);[^\n]*\r?\n/, '');
  assert(mutSrc !== sendDmSrc, '突变4: blur 行确实被删');
  var r = runSendDm(mutSrc);
  assert.strictEqual(r.document.activeElement, r.input, '突变4: 删 blur 后输入框仍聚焦');
  var fresh = { id: 'tm-dm-input', value: '', focus: function () {}, setSelectionRange: function () {} };
  // 快照命中（activeElement 仍是壳内输入框）→ 恢复把已发文本盖回空框——这正是 F1 防的回归。
  new Function('document', 'bg', snapLine + '\n' + restoreLine + '\n')(
    { activeElement: r.input, getElementById: function (id) { return id === 'tm-dm-input' ? fresh : null; } },
    { contains: function (el) { return el === r.input; } });
  assert.strictEqual(fresh.value, '你好，同志', '突变4: 删 blur→已发文本被盖回（证 F1 断言有效·据此变红）');
})();

// 突变自检未污染真源（fresh-read 证真源标记原样）。
assert(read('tm-content-manager-community.js').includes("if ((state.feedScope || 'recommend') !== scope) return;"),
  '收尾: community scope 守卫原样（未被突变污染）');
assert(read('tm-content-manager.js').includes("if (!resp.ok) throw new Error('下载失败：HTTP ' + resp.status);"),
  '收尾: 404 归因文案原样');
assert(read('tm-content-manager-community.js').includes('if (el && el.blur) el.blur();'),
  '收尾: sendDm blur 行原样（F1·未被突变污染）');
assert((read('tm-content-manager-community.js').match(/!== scope\) return;/g) || []).length >= 2,
  '收尾: loadFeed .then/.catch 两处 scope 守卫原样（F2）');
assert(read('tm-content-manager.js').includes('p ? isResumePack(p) :'),
  '收尾: packMeta 跳过谓词按目录行语义原样（F3·锁 gate 三元式非注释）');

// 全部同步断言过 + 异步真跑收敛后打 PASS（任一 reject → 非零退出）。
Promise.all([pRace, pProg, pMut1]).then(function () {
  console.log('[smoke-workshop-pipeline-e] PASS');
}).catch(function (e) { console.error(e && e.stack || e); process.exit(1); });

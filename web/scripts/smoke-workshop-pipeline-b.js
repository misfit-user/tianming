#!/usr/bin/env node
'use strict';

// smoke-workshop-pipeline-b.js — 工坊全链修缮·批B（创作端）可执行断言
//   B1 页内打包器：buildZip↔parseZip 互逆（中文名+二进制+CRC）· planLoosePack
//      manifest 生成（mod 图/音落位 + scenario entry）· 守门（超限/去路径/跳过/去重）
//   B2 上传进度：XHR 上传分支真跑（headers/url/body/progress/response）· 回落 fetch
//      行为不变 · uploadProgressShouldRender 纯函数节流
//   突变自检：CRC 表改坏 / UTF-8 旗标去掉 / 节流条件反转——各在内存副本上真跑验红，
//      全程不写真源（收尾断言真源标记原样·未被污染）。
// 风格沿袭 smoke-workshop-pipeline-a.js：读运行时源码 + extractFn 抽纯函数真跑。

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// 家族装载序（lint-smoke-family-order）：origin 'tm-content-manager.js' 须先于
// 紧随其后的 'tm-content-manager-community.js'——故先读 origin，后读 community。
const TMZipStore = require(path.join(ROOT, 'tm-zip-store.js'));
const cmSrc = read('tm-content-manager.js');
const communitySrc = read('tm-content-manager-community.js');
const onlineSrc = read('tm-online-client.js');
const zipSrc = read('tm-zip-store.js');

// —— 抽取器（沿袭批A）：本仓顶层函数收尾恒为「\n  }」（2 空格花括号独占一行）。
function extractFn(src, header) {
  var s = src.indexOf(header);
  assert(s >= 0, 'extractFn 找不到函数头: ' + header);
  var rest = src.slice(s);
  var end = rest.indexOf('\n  }');
  assert(end >= 0, 'extractFn 找不到 2 空格收尾花括号: ' + header);
  return rest.slice(0, end + 4);
}
function u8(arr) { return new Uint8Array(arr); }
// 从源串造隔离的 TMZipStore 实例（内存·不碰真源）——供突变自检真跑。
function loadZipStoreFrom(src) {
  var mod = { exports: {} };
  new Function('module', 'exports', src)(mod, mod.exports);
  return mod.exports;
}

// ════════════════════════════════════════════════════════════════════════
//  B1-①：buildZip↔parseZip 互逆（中文文件名 + 二进制数据 + CRC 全等）
// ════════════════════════════════════════════════════════════════════════
(function () {
  var entries = [
    { name: '立绘/张三.png', data: u8([0, 1, 2, 255, 254, 10, 13, 0, 66, 137]) },
    { name: 'music/主题曲.ogg', data: u8([79, 103, 103, 83, 0, 2, 0, 0, 255]) },
    { name: 'manifest.json', data: new TextEncoder().encode('{"id":"张三包","type":"mod"}') }
  ];
  var zip = TMZipStore.buildZip(entries);
  var back = TMZipStore.parseZip(zip);
  assert.strictEqual(back.length, entries.length, 'B1①: 解回条目数相等');
  entries.forEach(function (e, i) {
    assert.strictEqual(back[i].name, e.name, 'B1①: 文件名 UTF-8 往返相等: ' + e.name);
    assert.deepStrictEqual(Array.from(back[i].data), Array.from(e.data), 'B1①: 字节往返逐字相等: ' + e.name);
    assert.strictEqual(TMZipStore.crc32(back[i].data), TMZipStore.crc32(e.data), 'B1①: CRC 相等: ' + e.name);
  });
  // buildZip 须置 UTF-8 文件名旗标(bit11) 于本地头 general-purpose flag（偏移 6-7）。
  var flagZip = TMZipStore.buildZip([{ name: '甲', data: u8([1]) }]);
  assert.strictEqual(flagZip[6] | (flagZip[7] << 8), 0x0800, 'B1①: 本地头须置 UTF-8 文件名旗标(bit11)');
  // 中央目录同样须置 bit11：读 EOCD（无注释时末 22 字节）定位中央目录 offset，验其 general-purpose flag（中央目录头 +8）。
  (function () {
    var eo = flagZip.length - 22;
    assert.strictEqual(flagZip[eo] | (flagZip[eo + 1] << 8) | (flagZip[eo + 2] << 16) | (flagZip[eo + 3] * 0x1000000), 0x06054b50, 'B1①: EOCD 签名');
    var cdOff = flagZip[eo + 16] | (flagZip[eo + 17] << 8) | (flagZip[eo + 18] << 16) | (flagZip[eo + 19] * 0x1000000);
    assert.strictEqual(flagZip[cdOff] | (flagZip[cdOff + 1] << 8) | (flagZip[cdOff + 2] << 16) | (flagZip[cdOff + 3] * 0x1000000), 0x02014b50, 'B1①: 中央目录头签名');
    assert.strictEqual(flagZip[cdOff + 8] | (flagZip[cdOff + 9] << 8), 0x0800, 'B1①: 中央目录须置 UTF-8 文件名旗标(bit11·中央目录头偏移 +8)');
  })();
})();

// ── B1-⑤：buildZip 条目数 >65535 抛错（EOCD 条目数为 u16·拒静默截断成坏 zip）──
(function () {
  assert.throws(function () { TMZipStore.buildZip({ length: 65536, forEach: function () {} }); }, /65535|条目数/, 'B1⑤: 条目数 >65535 → buildZip 抛错');
  var ok = TMZipStore.buildZip([{ name: 'x', data: u8([1]) }]);
  assert(ok && ok.length > 0, 'B1⑤: 边界内正常条目数照常打包');
})();

// ── B1-②：坏 CRC 篡改一字节 → parseZip 必拒 ──
(function () {
  var zip = TMZipStore.buildZip([{ name: 'a.png', data: u8([1, 2, 3, 4, 5]) }]);
  var tampered = zip.slice();          // 本地头 30 + name(5)=偏移 35 起是数据区
  tampered[35] = tampered[35] ^ 0xFF;  // 翻一字节
  assert.throws(function () { TMZipStore.parseZip(tampered); }, /校验不符|zip/, 'B1②: 篡改数据 → parseZip 抛校验错');
})();

// ════════════════════════════════════════════════════════════════════════
//  B1-③：planLoosePack manifest 生成器真跑（mod 图/音落位 + scenario entry）
// ════════════════════════════════════════════════════════════════════════
var planLoosePack = TMZipStore.planLoosePack;   // 已随 buildZip 同居打包原语模块
(function () {
  var modPlan = planLoosePack('mod', '天启边镇', '1.0.0', '组合包', [
    { name: 'C:/tmp/张三.png', size: 100, index: 0 },
    { name: '主题.mp3', size: 200, index: 1 },
    { name: 'world.json', size: 50, index: 2 }
  ]);
  assert(modPlan.manifest.files.indexOf('portraits/张三.png') >= 0, 'B1③: mod 图片落 portraits/');
  assert(modPlan.manifest.files.indexOf('music/主题.mp3') >= 0, 'B1③: mod 音频落 music/');
  assert(modPlan.manifest.files.indexOf('world.json') >= 0, 'B1③: mod JSON 平铺');
  assert.strictEqual(modPlan.manifest.files.length, 3, 'B1③: manifest.files 齐全（3 件）');
  // 批A mod 立绘识别靠 assets[].type 类型化声明——立绘须带 portrait 类型且 file 指包内路径。
  assert(modPlan.assets.some(function (a) { return a.file === 'portraits/张三.png' && /portrait/.test(a.type); }),
    'B1③: mod 立绘 asset 带 portrait 类型声明（与批A识别约定对齐）');
  assert(!/tmp/.test(modPlan.manifest.files.join('|')), 'B1③: 去路径（原始 C:/tmp/ 不残留）');

  var scnPlan = planLoosePack('scenario', 'My Scn', '1.2.0', '', [{ name: 'world.json', size: 50, index: 0 }]);
  assert.strictEqual(scnPlan.manifest.entry, 'world.json', 'B1③: scenario manifest.entry 指向 JSON');
  assert.strictEqual(scnPlan.manifest.id, 'my-scn', 'B1③: slug 归一（小写连字符）');
  assert.strictEqual(scnPlan.manifest.type, 'scenario', 'B1③: manifest.type 落位');
})();

// ── B1-④：守门（超限提示 / 非白名单跳过 / 同名去重）──
(function () {
  var over = planLoosePack('portrait', 'p', '1.0.0', '', [{ name: 'huge.png', size: 25 * 1024 * 1024, index: 0 }]);
  assert(over.oversize.indexOf('huge.png') >= 0, 'B1④: 单文件>20MB 计入 oversize（醒目提示据此）');
  assert.strictEqual(over.totalSize, 25 * 1024 * 1024, 'B1④: totalSize 累计');

  var sk = planLoosePack('portrait', 'p', '1.0.0', '', [
    { name: 'evil.exe', size: 1, index: 0 }, { name: 'ok.png', size: 2, index: 1 }
  ]);
  assert(sk.skipped.indexOf('evil.exe') >= 0, 'B1④: 非白名单扩展名(.exe) 跳过并计数');
  assert(sk.manifest.files.indexOf('ok.png') >= 0, 'B1④: 白名单文件保留');

  var dup = planLoosePack('portrait', 'p', '1.0.0', '', [
    { name: '李四.png', size: 1, index: 0 }, { name: '李四.png', size: 2, index: 1 }
  ]);
  assert.deepStrictEqual(dup.manifest.files, ['李四.png', '李四-2.png'], 'B1④: 同名去重（-2 后缀）');
})();

// ── B1 接线守门（源码锁死关键行）──
assert(/LOOSE_MAX_SINGLE = 20 \* 1024 \* 1024/.test(zipSrc), 'B1: 单文件 20MB 阈值常量在 tm-zip-store');
assert(/LOOSE_MAX_TOTAL = 60 \* 1024 \* 1024/.test(zipSrc), 'B1: 总量 60MB 硬闸常量在 tm-zip-store');
assert(/planLoosePack: planLoosePack/.test(zipSrc), 'B1: TMZipStore 导出 planLoosePack');
assert(cmSrc.includes('TMZipStore.planLoosePack('), 'B1: 处理器走 TMZipStore.planLoosePack');
assert(cmSrc.includes('TMZipStore.LOOSE_MAX_TOTAL'), 'B1: 处理器用 TMZipStore.LOOSE_MAX_TOTAL 守门');
assert(cmSrc.includes('网页安装端上限约 64MB'), 'B1: 总量超限醒目提示文案在');
assert(cmSrc.includes('onPublishLooseFiles: onPublishLooseFiles'), 'B1: onPublishLooseFiles 已导出');
assert(cmSrc.includes("onPublishPackageFile({ files: [packFile] })"), 'B1: 打好的 .tm-pack 喂给现有 onPublishPackageFile 流程');
{
  assert(communitySrc.includes('onPublishLooseFiles(this)') && communitySrc.includes('没有现成包'),
    'B1: 创作中心第 1 步有「选散文件，我来打包」入口');
  assert(/looseAccept = pt === 'portrait'/.test(communitySrc), 'B1: accept 随「商店分类」过滤散文件类型');
  assert(communitySrc.includes("accept=\"' + esc(looseAccept) + '\""), 'B1: 散文件 input 的 accept 接 looseAccept');
}

// ════════════════════════════════════════════════════════════════════════
//  B2-①：XHR 上传分支真跑（注入 FakeXHR，验 headers/url/body/progress/response）
// ════════════════════════════════════════════════════════════════════════
const onlineApi = require(path.join(ROOT, 'tm-online-client.js'));
function makeStorageWithSession() {
  var mem = { tm_online_session: JSON.stringify({ token: 'TKN', apiUrl: 'https://x.test/api/', user: {} }) };
  return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
}
var pXhr = (function () {
  var sent = {};
  function FakeXHR() { this.upload = {}; this._h = {}; }
  FakeXHR.prototype.open = function (m, u) { sent.method = m; sent.url = u; };
  FakeXHR.prototype.setRequestHeader = function (k, v) { this._h[k] = v; };
  FakeXHR.prototype.send = function (body) {
    sent.body = body; sent.headers = this._h;
    if (this.upload.onprogress) this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
    this.status = 200; this.responseText = JSON.stringify({ success: true, pack: { id: 'p1', title: 'T' } });
    this.onload();
  };
  var c = onlineApi.createOnlineClient({
    storage: makeStorageWithSession(), XMLHttpRequest: FakeXHR,
    fetch: function () { throw new Error('XHR 分支不得回落 fetch'); }
  });
  var progs = [];
  return c.uploadPack({ title: 'T', id: 'p1', type: 'mod', version: '1.0.0', description: 'd' },
    'QUJD', undefined, function (p) { progs.push(p); }).then(function (res) {
    assert.strictEqual(sent.method, 'POST', 'B2①: XHR 方法 POST');
    assert(/\/workshop\/upload$/.test(sent.url), 'B2①: XHR URL = <api>/workshop/upload');
    assert.strictEqual(sent.headers['Authorization'], 'Bearer TKN', 'B2①: 鉴权头 Authorization 未丢');
    assert.strictEqual(sent.headers['Content-Type'], 'application/json', 'B2①: Content-Type 与 request() 一致');
    assert(/"contentBase64":"QUJD"/.test(sent.body), 'B2①: body 含 contentBase64');
    assert.deepStrictEqual(progs, [{ loaded: 50, total: 100 }], 'B2①: onProgress 收到 loaded/total');
    assert(res.success === true && res.pack && res.pack.id === 'p1', 'B2①: 响应解析回传');
  });
})();

// ── B2-②：无 XHR + 传了 onProgress → 回落 fetch（行为不变·auth 仍在·进度不触发）──
var pFallback = (function () {
  var capt = {}, fetchCalled = 0;
  function fakeFetch(url, init) {
    fetchCalled++; capt.url = url; capt.init = init;
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify({ success: true, pack: { id: 'p' } })); } });
  }
  var c = onlineApi.createOnlineClient({ storage: makeStorageWithSession(), fetch: fakeFetch, XMLHttpRequest: null });
  return c.uploadPack({ title: 'T', id: 'p', type: 'mod' }, 'QUJD', undefined,
    function () { throw new Error('回落 fetch 路不得触发上传进度'); }).then(function (res) {
    assert.strictEqual(fetchCalled, 1, 'B2②: 无 XHR → 回落 fetch 一次');
    assert.strictEqual(capt.init.headers.Authorization, 'Bearer TKN', 'B2②: 回落路鉴权头仍在');
    assert(res.success === true, 'B2②: 回落路响应正常');
  });
})();

// ── B2-③：uploadProgressShouldRender 纯函数节流真跑 ──
var shouldRender = new Function(
  extractFn(cmSrc, 'function uploadProgressShouldRender(') + '\nreturn uploadProgressShouldRender;')();
assert.strictEqual(shouldRender(100, 99, 0), true, 'B2③: 100% 必渲');
assert.strictEqual(shouldRender(3, 1, 200), false, 'B2③: <500ms 且 <5% → 不渲（节流）');
assert.strictEqual(shouldRender(3, 1, 600), true, 'B2③: ≥500ms → 渲');
assert.strictEqual(shouldRender(8, 1, 100), true, 'B2③: 百分比变化 ≥5 → 渲');
// B2 接线守门
assert(onlineSrc.includes('xhr.upload.onprogress'), 'B2: XHR 分支用 xhr.upload.onprogress 报进度');
assert(onlineSrc.includes('function sendUpload('), 'B2: uploadPack/uploadScenario 走统一 sendUpload');
assert(/uploadPack\(meta, contentBase64, apiUrl, onProgress\)/.test(onlineSrc), 'B2: uploadPack 增 onProgress 形参');
assert(/uploadScenario\(meta, content, apiUrl, onProgress\)/.test(onlineSrc), 'B2: uploadScenario 增 onProgress 形参');
assert(cmSrc.includes('正在上传投稿包… '), 'B2: 上传进度回写 publishMessage');
assert(cmSrc.includes('大包上传可能较久，请勿关闭页面'), 'B2: >30MB 提醒勿关页文案在');
assert(/bytes\.length > 30 \* 1024 \* 1024/.test(cmSrc), 'B2: >30MB 阈值判定在');

// ════════════════════════════════════════════════════════════════════════
//  突变自检（≥3 枚）：内存副本上真跑验红——证上面断言真吃对应的实现
// ════════════════════════════════════════════════════════════════════════
// 突变1：CRC 多项式改坏 → 用其 buildZip 打的包被【真】parseZip 拒（互逆断言的 CRC 臂真吃）。
(function () {
  var mutSrc = zipSrc.replace('0xEDB88320', '0xEDB88321');
  assert(mutSrc !== zipSrc, '突变1: CRC 表突变确实改动了源');
  var Mut = loadZipStoreFrom(mutSrc);
  var badZip = Mut.buildZip([{ name: 'a', data: u8([1, 2, 3]) }]);
  assert.throws(function () { TMZipStore.parseZip(badZip); }, /校验不符|zip/,
    '突变1: CRC 表改坏 → 真 parseZip 拒（互逆断言据此变红）');
})();
// 突变2：去掉 UTF-8 旗标 → 本地头 general-purpose flag 变 0（B1① 旗标断言据此变红）。
(function () {
  var mutSrc = zipSrc.replace(/0x0800/g, '0x0000');
  assert(mutSrc !== zipSrc, '突变2: UTF-8 旗标突变确实改动了源');
  var Mut = loadZipStoreFrom(mutSrc);
  var mf = Mut.buildZip([{ name: '甲', data: u8([1]) }]);
  assert.strictEqual(mf[6] | (mf[7] << 8), 0, '突变2: 去旗标后本地头旗标=0（bit11 断言据此变红）');
  var eo2 = mf.length - 22, cdOff2 = mf[eo2 + 16] | (mf[eo2 + 17] << 8) | (mf[eo2 + 18] << 16) | (mf[eo2 + 19] * 0x1000000);
  assert.strictEqual(mf[cdOff2 + 8] | (mf[cdOff2 + 9] << 8), 0, '突变2: 去旗标后中央目录旗标=0（中央目录 bit11 断言据此变红）');
})();
// 突变4：条目数闸删掉 → buildZip 不再拒 >65535（B1⑤ 断言据此变红）。
(function () {
  var mutSrc = zipSrc.replace(/ *if \(entries && entries\.length > 65535\) throw new Error\('zip 条目数超上限（65535）'\);\r?\n/, '');
  assert(mutSrc !== zipSrc, '突变4: 条目数闸行确实被删');
  var Mut = loadZipStoreFrom(mutSrc);
  assert.doesNotThrow(function () { Mut.buildZip({ length: 65536, forEach: function () {} }); }, '突变4: 删闸后不再拒 >65535（B1⑤ 据此变红）');
})();
// 突变3：节流条件反转（≥ → <）→ 原本该重渲的输入现不渲（B2③ 断言据此变红）。
(function () {
  var src = extractFn(cmSrc, 'function uploadProgressShouldRender(');
  var mutSrc = src.replace('sinceMs >= 500', 'sinceMs < 500').replace('Math.abs(pct - lastPct) >= 5', 'Math.abs(pct - lastPct) < 5');
  assert(mutSrc !== src, '突变3: 节流条件突变确实改动了源');
  var mut = new Function(mutSrc + '\nreturn uploadProgressShouldRender;')();
  assert.strictEqual(mut(50, 1, 600), false, '突变3: 反转后原该重渲(600ms,Δ49)现不渲——真断言 shouldRender(...)===true 据此变红');
})();

// 突变自检未污染真源（fresh-read 证真源标记原样·工作树对这几文件保持干净）。
assert(read('tm-zip-store.js').includes('0xEDB88320'), '收尾: tm-zip-store CRC 多项式原样（未被突变污染）');
assert(read('tm-zip-store.js').includes('u16(0x0800)'), '收尾: tm-zip-store UTF-8 旗标原样');
assert(read('tm-zip-store.js').includes('entries.length > 65535'), '收尾: tm-zip-store 条目数闸原样');
assert.strictEqual(read('tm-content-manager.js'), cmSrc, '收尾: tm-content-manager 与测试开始时字节一致（突变自检未落盘）');
assert.strictEqual(read('tm-content-manager-community.js'), communitySrc, '收尾: community 源与测试开始时字节一致');
assert.strictEqual(read('tm-online-client.js'), onlineSrc, '收尾: online client 源与测试开始时字节一致');

// 全部同步断言过 + 两条异步上传断言收敛后打 PASS（任一 reject → 非零退出）。
Promise.all([pXhr, pFallback]).then(function () {
  console.log('[smoke-workshop-pipeline-b] PASS');
}).catch(function (e) { console.error(e && e.stack || e); process.exit(1); });

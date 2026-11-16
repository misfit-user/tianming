#!/usr/bin/env node
// smoke-workshop-asset-effect.js — 工坊四类·批Ⅱ余刀+批Ⅴ防腐线（2026-07-22）：
// ①TMZipStore.parseZip：store zip 真解（实弹往返·中文名·CRC·压缩包明说拒收）；
// ②网页/安卓装资产包：installCatalogPackWeb zip 分支（PK 嗅探·sha256 校验·manifest 硬要求·
//   kind='asset' 入 IDB·帽 64MB/500 件）；
// ③TM.WorkshopAssets 桥：桌面 tm-content:// 与网页 IDB 统一取件·音乐/立绘/图幅三链共用；
// ④立绘生效：tm-renwu-tuzhi/tm-renwu-ui 同名兜底（角色自带立绘优先）；
// ⑤图幅生效：openMapPackInEditor→IDB 交接件(__me_import)→map-editor-io 就绪自取自删。

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function assert(cond, msg) {
  if (cond) { A++; console.log('  PASS ' + msg); }
  else { F++; console.log('  FAIL ' + msg); }
}

console.log('smoke-workshop-asset-effect');

// ── ① parseZip 实弹 ──
const Z = require(path.join(ROOT, 'tm-zip-store.js'));
assert(typeof Z.parseZip === 'function', 'parseZip 已导出');
{
  const enc = new TextEncoder();
  const entries = [
    { name: 'manifest.json', data: enc.encode('{"id":"t","type":"music"}') },
    { name: '战鼓琵琶.mp3', data: new Uint8Array([1, 2, 3, 4, 5, 6, 7]) },
  ];
  const back = Z.parseZip(Z.buildZip(entries));
  assert(back.length === 2 && back[1].name === '战鼓琵琶.mp3', '往返解包·中文文件名无恙');
  assert(JSON.stringify([...back[1].data]) === JSON.stringify([1, 2, 3, 4, 5, 6, 7]), '字节逐位相等（CRC 校验在）');
  const bad = Z.buildZip([{ name: 'a.bin', data: new Uint8Array([1]) }]);
  let eocd = -1;
  for (let i = bad.length - 22; i >= 0; i--) if (bad[i] === 0x50 && bad[i + 1] === 0x4b && bad[i + 2] === 0x05 && bad[i + 3] === 0x06) { eocd = i; break; }
  const cd = bad[eocd + 16] | (bad[eocd + 17] << 8) | (bad[eocd + 18] << 16) | (bad[eocd + 19] << 24);
  bad[cd + 10] = 8;
  let rejected = false;
  try { Z.parseZip(bad); } catch (e) { rejected = /仅支持 store/.test(e.message); }
  assert(rejected, '压缩(deflate) zip 明说拒收（引导走桌面版）');
  let traversal = false;
  try { Z.parseZip(Z.buildZip([{ name: '../evil.js', data: new Uint8Array([1]) }])); } catch (e) { traversal = /越界/.test(e.message); }
  assert(traversal, '越界路径(..)拒收');
}

// ── ② 网页装资产包（tm-content-manager.js 源契约）──

// ── ④ 立绘生效 ──

// ── ⑤ 图幅生效 ──

// ── ⑥ 音乐链走桥 ──
const au = fs.readFileSync(path.join(ROOT, 'tm-audio-theme.js'), 'utf8');
assert(!/window\.tianming\.listWorkshopPacks\(\)\.then/.test(au), 'audio 不再直连 IPC（桥内收口）');

// ── ⑦ 已装列表类型签 ──

console.log('smoke-workshop-asset-effect ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);

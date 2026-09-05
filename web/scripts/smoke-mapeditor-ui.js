#!/usr/bin/env node
'use strict';
/* smoke-mapeditor-ui — 地图编辑器·玄墨舆图家族对齐（2026-07-03）防腐线。
 * M1 token 重校：街机金 #ffd700 退役→鎏金族(#d9b566/#b89a53 锚国师/工坊)·纸族去琥珀。
 * M2 canvas 侧 UI 高亮统一：19 个 live 模块选中/辉光/框选/小地图 viewport 同族。
 * M3 wf-bar 首启空壳修复：start() 须 ensureBar 先于 render。
 * 守则：钉「能力可达/资产存在」不钉具体形态（smoke 假红教训）。 */
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var assetExists = relative => require('./lib-smoke-evidence').assetExists('smoke-mapeditor-ui.js', relative);
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-mapeditor-ui');

console.log('— M1 · token 重校(html) —');
var html = read('map-editor.html');
ok(/--gold-1:#d9b566/.test(html), '鎏金主 accent 在位(--gold-1:#d9b566)');
ok(/--gold-2:#b89a53/.test(html), '鎏金副 accent 锚家族(--gold-2:#b89a53)');
ok(!/ffd700|FFD700/.test(html), '街机金 #ffd700 在 html 清零');
ok(!/255,215,0|255, 215, 0/.test(html), '街机金 rgba 在 html 清零');
ok(/--paper-1:#d6ccb6/.test(html), '纸族去琥珀(--paper-1:#d6ccb6)');
ok(/玄墨舆图·家族对齐终局层/.test(html), '追加终局层段落标记在(回滚=删段)');

console.log('— M1 · 家族字体与题栏 —');
ok(/font-family:"ME-XiaoWei"/.test(html) && /ZCOOLXiaoWei-Regular\.ttf/.test(html), '@font-face ME-XiaoWei 声明在');
ok(assetExists('assets/fonts/ZCOOLXiaoWei-Regular.ttf'), '字体文件在 assets/fonts');
ok(assetExists('assets/fonts/MaShanZheng-Regular.ttf'), 'MaShanZheng 字体文件在');
ok((html.match(/class="me-msep"/g) || []).length >= 3 && /\.me-msep\{/.test(html), '顶栏菜单分组隔线(≥3 处+定义)');

console.log('— M2 · canvas 侧 UI 高亮统一(19 live 模块) —');
var mods = ['bitmap', 'bookmarks', 'borders', 'core', 'ferry', 'find', 'hover-glow', 'marquee', 'minimap',
  'postprocess', 'progress', 'rivers', 'roads', 'state', 'strongholds', 'tooltips', 'voronoi', 'workflow-chain'];
var dirty = [];
mods.forEach(function (m) {
  var src = read('map-editor-' + m + '.js');
  if (/ffd700|FFD700|255,215,0|255, 215, 0|fff7c2/.test(src)) dirty.push(m);
});
var rec = read('map-recognition.js');
if (/ffd700|FFD700|255,215,0/.test(rec)) dirty.push('map-recognition');
ok(dirty.length === 0, '街机金在全部 live 模块清零' + (dirty.length ? '·残留:' + dirty.join(',') : ''));
ok(/#d9b566/.test(read('map-editor-core.js')), 'core 选中高亮走家族金');
ok(/#efdfb2/.test(read('map-editor-core.js')), 'core hover 亮纸随族(#fff7c2→#efdfb2)');

console.log('— M3 · wf-bar 首启修复 —');
var wf = read('map-editor-workflow-chain.js');
var startBody = (wf.match(/function start\(chainId\)\{[\s\S]*?\n  \}/) || [''])[0];
ok(/ensureBar\(\);[\s\S]*render\(\);/.test(startBody), 'start() 内 ensureBar 先于 render(否则首启空壳 bar)');

console.log('— 关键结构存活 —');
['me-app', 'me-titlebar', 'me-rail-l', 'me-drawer-r', 'me-modal', 'me-minibar'].forEach(function (c) {
  ok(html.indexOf(c) !== -1, '结构类 .' + c + ' 在');
});

console.log('\nsmoke-mapeditor-ui ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);

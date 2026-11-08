#!/usr/bin/env node
/* eslint-env node */
'use strict';
// smoke-guoshi-map-panel — 地图编辑器里的国师面板（2026-10-15 国师重做 S6）：
//   换成与剧本工坊国师同一身「漆案金线」；对外契约（元素 id、data-role / data-action）不变；
//   「实时显示」与工坊共用开关（tm_aa_stream）和「这条线路不支持」记号（tm_aa_stream_off，键 = 地址|模型）；
//   ME.agent.run 把 stream / onDelta 递给国师的工具循环；半截参数的读取用核心里那一份。
const fs = require('fs'), path = require('path');
const web = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(web, f), 'utf8');
const ui = read('map-editor-agent-ui.js'), agent = read('map-editor-agent.js'), css = read('map-editor-agent.css'), mainUi = read('editor-authoring-agent-ui.js');
let P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-guoshi-map-panel');

ok(["launcher.id = 'me-guoshi-launcher'", "panel.id = 'me-guoshi'", 'id="me-guoshi-request"'].every(s => ui.includes(s)), '元素 id 照旧');
ok(['data-role="selection"', 'data-role="log"', 'data-role="status"', 'data-role="model"', 'data-role="readonly"', 'data-action="close"', 'data-action="undo"', 'data-action="stop"', 'type="submit"'].every(s => ui.includes(s)), 'data-role / data-action 照旧');
ok(/panel\._lastResult = response;/.test(ui), '最近一次结果仍挂在面板上');
ok(/stream:options\.stream===true,onDelta:options\.onDelta/.test(agent), 'ME.agent.run 把 stream / onDelta 递给工具循环');
ok(/stream: live, onDelta: live \? onDelta : undefined/.test(ui), '面板按开关请求实时显示');
ok(/localStorage\.getItem\('tm_aa_stream'\) === '0'/.test(ui) && /var STREAM_OFF_KEY = 'tm_aa_stream_off';/.test(ui), '与工坊共用实时显示开关和线路记号');
ok(/function lineKey\(cfg\) \{ return String\(cfg\.url \|\| ''\) \+ '\|' \+ String\(cfg\.model \|\| ''\); \}/.test(ui)
  && /function _streamLineKey\(\) \{ var c = _loadApiCfg\(\) \|\| \{\}; return String\(c\.url \|\| ''\) \+ '\|' \+ String\(c\.model \|\| ''\); \}/.test(mainUi), '线路记号的键两边同一写法（地址|模型）');
ok(/AA\.partialJsonString\(t\.args, 'summary'\)/.test(ui), '收尾说明的实时预览用核心里的半截参数读取');
ok(/localStorage\.getItem\('tm_aa_show_thinking'\) !== '0'/.test(ui) && /if \(s\.think\.trim\(\) && showThinking\(\)\) \{/.test(ui), '思考原文默认上屏、可关（与工坊同一开关）');
ok(/ev\.kind === 'done'\) \{ if \(r\.lv\) lvPaint\(r\); lvClear\(r, true\); return; \}/.test(ui), '一问收完：想法留作一条，旁听的半截收起');
ok(/data-act="undo">撤销这次<\/button>/.test(ui) && /var u = ME\.agent\.undo\(\);/.test(ui), '改了地图的回复下面直接给「撤销这次」');
ok(/if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); if \(ME\.agent\.isRunning\(\)\) stop\.click\(\);/.test(ui), 'Esc：在跑就停，不在跑就收起');
ok(/e\.stopPropagation\(\);   \/\/ 地图编辑器的快捷键别在这里触发/.test(ui), '面板里打字不触发地图编辑器的快捷键');
ok(/#me-guoshi,#me-guoshi-launcher\{--bg:#15110d;/.test(css) && /--verm:#b3301d/.test(css), '漆案金线的色');
ok(/body:has\(#me-guoshi:not\(\[hidden\]\)\) #me-guoshi-launcher\{display:none\}/.test(css), '面板开着时启动钮收起');
ok(/@media\(prefers-reduced-motion:reduce\)/.test(css), '减少动效时不转不闪');

console.log('\nsmoke-guoshi-map-panel ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);

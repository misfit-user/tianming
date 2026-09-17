#!/usr/bin/env node
// smoke-pinch-pan-gestures.js
// 验证手机版舆图/官制树可拖动+捏合缩放：
//   ① tm-pinch-pan.js 通用桥的手势数学(单指 pan / 双指 pinch / shouldStart 跳卡片 / detach)
//   ② 源契约:舆图 installMapInteraction 接 attachPinchPan(stage) 且 pointerdown 对 touch early-return;
//              官制树接 attachPinchPan(wrap) 且 shouldStart 跳卡片;tm-touch.css 两手势面 touch-action:none;
//              index.html 引入 tm-pinch-pan.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }
function near(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 0.01 : eps); }

// ── 载入通用桥到 vm ──
const sandbox = {};
sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
sandbox.Math = Math;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-pinch-pan.js'), 'utf8'), sandbox, { filename: 'tm-pinch-pan.js' });

console.log('smoke-pinch-pan-gestures');
ok(sandbox.TM && typeof sandbox.TM.attachPinchPan === 'function', '① TM.attachPinchPan 已导出');

// ── 假 surface 元素 ──
function fakeEl() {
  const handlers = {};
  return {
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    removeEventListener(type, fn) { if (handlers[type]) handlers[type] = handlers[type].filter(h => h !== fn); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 800 }; },
    _fire(type, ev) { (handlers[type] || []).forEach(h => h(ev)); },
    _count(type) { return (handlers[type] || []).length; }
  };
}
function tev(pts, target) {
  return { touches: pts.map(p => ({ clientX: p[0], clientY: p[1] })), target: target || { tagName: 'DIV' }, cancelable: true, preventDefault() {} };
}

// ── 单指 pan ──
let g = [];
let el = fakeEl();
let detach = sandbox.TM.attachPinchPan(el, { onGesture: e => g.push(e) });
el._fire('touchstart', tev([[100, 100]]));
el._fire('touchmove', tev([[130, 150]]));
ok(g.length === 1, '② 单指拖动触发一次 onGesture');
ok(g[0] && near(g[0].panDX, 30) && near(g[0].panDY, 50), '② 单指位移 panDX=30 panDY=50·实=' + (g[0] ? g[0].panDX + '/' + g[0].panDY : 'n/a'));
ok(g[0] && g[0].zoom === 1, '② 单指 zoom=1(纯平移不缩放)');

// 连续两段累加
el._fire('touchmove', tev([[140, 140]]));
ok(g.length === 2 && near(g[1].panDX, 10) && near(g[1].panDY, -10), '② 第二段以上次为基准 panDX=10 panDY=-10·实=' + (g[1] ? g[1].panDX + '/' + g[1].panDY : 'n/a'));

// ── 双指 pinch ──
g = []; el = fakeEl();
detach = sandbox.TM.attachPinchPan(el, { onGesture: e => g.push(e) });
el._fire('touchstart', tev([[100, 100], [200, 100]])); // dist=100, mid=(150,100)
el._fire('touchmove', tev([[50, 100], [250, 100]]));    // dist=200, mid=(150,100)
ok(g.length === 1 && near(g[0].zoom, 2), '③ 双指捏合 zoom=200/100=2·实=' + (g[0] ? g[0].zoom : 'n/a'));
ok(g[0] && near(g[0].cx, 150) && near(g[0].cy, 100), '③ 缩放锚点=双指中点(150,100)·实=' + (g[0] ? g[0].cx + ',' + g[0].cy : 'n/a'));
ok(g[0] && near(g[0].panDX, 0) && near(g[0].panDY, 0), '③ 中点不动→双指平移分量=0');

// 收窄→缩小
el._fire('touchmove', tev([[100, 100], [200, 100]])); // dist 回 100 → zoom=0.5
ok(g.length === 2 && near(g[1].zoom, 0.5), '③ 双指收窄 zoom=0.5(缩小)·实=' + (g[1] ? g[1].zoom : 'n/a'));

// ── shouldStart 跳卡片(单指落在按钮上不接管·保留点击) ──
g = []; el = fakeEl();
detach = sandbox.TM.attachPinchPan(el, {
  onGesture: e => g.push(e),
  shouldStart: t => t.tagName !== 'BUTTON'
});
el._fire('touchstart', tev([[100, 100]], { tagName: 'BUTTON' }));
el._fire('touchmove', tev([[160, 160]], { tagName: 'BUTTON' }));
ok(g.length === 0, '④ 单指落在按钮/卡片上 shouldStart=false → 不接管(无 onGesture·点击保留)');

// 双指即使起手在按钮上也接管(pinch 不受 shouldStart 约束)
el._fire('touchstart', tev([[100, 100], [200, 100]], { tagName: 'BUTTON' }));
el._fire('touchmove', tev([[50, 100], [250, 100]], { tagName: 'BUTTON' }));
ok(g.length === 1 && near(g[0].zoom, 2), '④ 双指 pinch 不受 shouldStart 约束(卡片上也能缩放)');

// ── detach 解绑 ──
g = []; el = fakeEl();
detach = sandbox.TM.attachPinchPan(el, { onGesture: e => g.push(e) });
ok(el._count('touchmove') === 1, '⑤ attach 后挂了 touchmove 监听');
detach();
ok(el._count('touchmove') === 0 && el._count('touchstart') === 0, '⑤ detach() 解绑全部 touch 监听');

// ════ 源契约 ════
const mapSrc = fs.readFileSync(path.join(WEB, 'phase8-formal-map.js'), 'utf8');
const offSrc = (fs.readFileSync(path.join(WEB, 'tm-office-runtime.js'), 'utf8') + '\n' + fs.readFileSync(path.join(WEB, 'tm-office-runtime-summary-appoint.js'), 'utf8'));
const cssSrc = fs.readFileSync(path.join(WEB, 'tm-touch.css'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');

ok(/TM\.attachPinchPan\(stage/.test(mapSrc), '⑥ 舆图 installMapInteraction 接 attachPinchPan(stage)');
ok(/pointerType === 'touch'\) return/.test(mapSrc), '⑥ 舆图 pointerdown 对 touch early-return(防 pointer+touch 双重 pan)');
ok(/onGesture:[\s\S]*?scheduleMapTransform\(\);\s*},\s*onEnd:/.test(mapSrc) && /function scheduleMapTransform[\s\S]{0,1200}applyMapTransform/.test(mapSrc), '⑥ 舆图 onGesture 经帧调度器施加 applyMapTransform');
ok(/TM\.attachPinchPan\(wrap/.test(offSrc), '⑦ 官制树接 attachPinchPan(wrap)');
ok(/shouldStart:\s*function/.test(offSrc) && /og-pos-card/.test(offSrc.slice(offSrc.indexOf('attachPinchPan(wrap'))), '⑦ 官制树 shouldStart 跳卡片(og-pos-card 等)保留点击');
ok(/#ming-map-layer/.test(cssSrc) && /#office-tree-wrap-game/.test(cssSrc) && /touch-action:\s*none/.test(cssSrc), '⑧ tm-touch.css 两手势面 touch-action:none');
ok(/tm-pinch-pan\.js/.test(htmlSrc), '⑨ index.html 引入 tm-pinch-pan.js');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

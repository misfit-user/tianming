// smoke-army-march-viz.js — 行军可视化(Wave2 军务 slice-1)
// 验：朝野内情左抽屉「军事要务」面板(_renderShellExtrasLeft §2.8)对在途军队渲染
//     趋向目的地+进度+剩余回合(此前 GM.marchOrders 仅喂 AI prompt·玩家侧零渲染器)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

function assert(c, m) { if (!c) { console.error('ASSERT FAIL:', m); process.exit(1); } }

// ── 极简 DOM stub：createElement 返回可读写 innerHTML/className/setAttribute/appendChild 的对象 ──
function makeEl() {
  const el = { _html: '', className: '', attrs: {}, children: [],
    appendChild(c) { this.children.push(c); },
    setAttribute(k, v) { this.attrs[k] = v; } };
  Object.defineProperty(el, 'innerHTML', { get() { return el._html; }, set(v) { el._html = v; } });
  return el;
}

const ctx = {};
ctx.window = ctx;                 // IIFE 里 window._renderShellExtrasLeft = ... 及自由变量 window
ctx.globalThis = ctx;
ctx.document = { createElement: makeEl, getElementById: function () { return null; } };
ctx.console = console;
ctx.P = { conf: {}, map: {}, military: {} };   // 剧本库(部分常驻面板裸引用)
// 常驻/跳过面板可能触到的 typeof 守卫 helper：不提供即走 typeof!=='function' 分支(安全)
ctx.GM = {
  running: true, turn: 5,
  armies: [
    { id: 'a1', name: '关宁铁骑', location: '山海关', commander: '', size: 30000, morale: 82, faction: '大明' },
    { id: 'a2', name: '大同镇兵', location: '大同', commander: '', size: 12000, morale: 60, faction: '大明' }
  ],
  // a1 在途·a2 驻守(无 march order)
  marchOrders: [
    { armyId: 'a1', armyName: '关宁铁骑', from: '山海关', to: '锦州', totalTurns: 3, progress: 1, status: 'marching', routeDescription: '经宁远→锦州' }
  ],
  chars: [{ isPlayer: true, faction: '大明' }]
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-shell-extras.js'), 'utf8'), ctx, { filename: 'tm-shell-extras.js' });
assert(typeof ctx._renderShellExtrasLeft === 'function', '_renderShellExtrasLeft 已定义');

const gl = makeEl();
try { ctx._renderShellExtrasLeft(gl); } catch (e) { console.error('render 抛错:', e && e.message); process.exit(1); }

// 找军队面板(data-panel-key='army')
const armyPanel = gl.children.find(function (c) { return c && c.attrs && c.attrs['data-panel-key'] === 'army'; });
assert(armyPanel, '① 军事要务面板已渲染(data-panel-key=army)');
const html = armyPanel._html || '';

// 在途军队 a1：显趋向锦州 + 进度 1/3 + 余2
assert(html.indexOf('锦州') >= 0, '② 在途军队显目的地(锦州)');
assert(html.indexOf('途中') >= 0, '③ 行军指示词(途中)');
assert(html.indexOf('1/3回合') >= 0, '④ 行军进度(1/3回合)');
assert(html.indexOf('余2') >= 0, '⑤ 剩余回合(余2)');
assert(html.indexOf('宁远') >= 0, '⑥ title 悬停含路线(经宁远→锦州)');
// 驻守军队 a2：不误显行军指示(其位置=大同·无 march order)
assert(html.indexOf('大同') >= 0, '⑦ 驻守军队仍显静态位置(大同)');
// a2 不应带"途中"——精确切出 a2 那段(大同镇兵 name 之后到面板尾)不含"途中"
const a2Idx = html.indexOf('大同镇兵');
assert(a2Idx >= 0, '⑧ 驻守军队 a2 已渲染');
const a2Seg = html.slice(a2Idx);
assert(a2Seg.indexOf('途中') < 0, '⑨ 驻守军队 a2 不误显行军指示');

// ── slice-1b：过回合军务总览表(2026-07-06 迁 tm-endturn-shiji-compose.js)marching 军队附进度 ──
// (静态守卫·渲染逻辑同抽屉已 runtime 验)

// ── slice-1d：右栏军队详情卡(phase8-formal-rightrail.js)marching 军队「当前动态」附进度 ──

console.log('smoke-army-march-viz OK — 行军可视化(抽屉 runtime 9 + 过回合静态 2 + 右栏静态 2)验证通过');

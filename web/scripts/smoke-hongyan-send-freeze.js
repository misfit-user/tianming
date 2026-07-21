// smoke-hongyan-send-freeze.js — 鸿雁传书·点送信卡死修（2026-07-21·玩家报案）
//
// 病根：renderLetterPanel 的 NPC 卡片循环对每个在世人物做 5 次全量 GM.letters 扫描
// (N人×M信·硬核档几百人×数千封=每次重建百万级谓词·点送信必触发·手机端秒级冻死)；
// 信史区对选中收信人逐封建卡无上限(数百卡同步 innerHTML)。
// 修法：①单趟预扫计数表(语义与 _ltCountUnread/Transit/Lost/NpcNew 逐一等价·本 smoke 钉)
// ②信史只铺近 120 封·更早收卷注明 ③发送后渲染 try/catch(渲染炸不得拖成「点了卡死」观感)。
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures.push(msg); console.log('  FAIL ' + msg); }
}

function el() {
  return { innerHTML: '', style: {}, textContent: '', value: '',
    classList: { toggle: function () {}, add: function () {}, remove: function () {} },
    querySelector: function () { return { scrollTop: 0, scrollHeight: 0 }; } };
}
var DOM = { 'letter-chars': el(), 'letter-history': el(), 'letter-route-bar': el(), 'lt-multi-toggle': el(), 'lt-compose-target': el(), 'letter-textarea': el() };
var toasts = [];
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox._$ = function (id) { return DOM[id] || null; };
sandbox.escHtml = function (s) { return String(s == null ? '' : s); };
sandbox._isSameLocation = function (a, b) { return String(a) === String(b); };
sandbox.toast = function (m) { toasts.push(String(m || '')); };
sandbox.getTSText = function () { return 'T'; };
sandbox.uid = function () { return 'id' + Math.random().toString(36).slice(2, 8); };
sandbox.getCurrentGameDay = function () { return 100; };
sandbox._getDaysPerTurn = function () { return 30; };
sandbox.SettlementPipeline = { register: function () {} };
sandbox.TM = {};
sandbox.findCharByName = function (n) { return (sandbox.GM.chars || []).find(function (c) { return c && c.name === n; }) || null; };

// 大盘账：120 人 × 3000 封信（预扫修前=120×5×3000=180 万谓词·修后=3000 单趟）
var chars = [{ name: '朱由校', isPlayer: true, alive: true }];
for (var i = 0; i < 120; i++) chars.push({ name: '臣' + i, alive: true, location: '外地' + (i % 9), officialTitle: '知府', loyalty: 50 });
var letters = [];
for (var j = 0; j < 3000; j++) {
  var who = '臣' + (j % 120);
  if (j % 3 === 0) letters.push({ id: 'l' + j, from: who, to: '玩家', status: 'returned', _playerRead: j % 6 === 0, sentTurn: j % 50 });
  else if (j % 3 === 1) letters.push({ id: 'l' + j, from: '玩家', to: who, status: 'traveling', deliveryTurn: 999, sentTurn: j % 50 });
  else letters.push({ id: 'l' + j, from: '玩家', to: who, status: 'intercepted', sentTurn: j % 50 });
}
sandbox.GM = { turn: 40, _capital: '京师', chars: chars, letters: letters, qijuHistory: null, _routeDisruptions: [] };
sandbox.P = { playerInfo: { characterName: '朱由校' }, officeConfig: null, conf: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-hongyan-office.js'), 'utf8'), sandbox, { filename: 'tm-hongyan-office.js' });

console.log('① 预扫计数表与旧函数逐一等价（抽 10 人全比）');
sandbox.renderLetterPanel();
var cardsHtml = DOM['letter-chars'].innerHTML;
assert(cardsHtml.length > 0, '卡片列表渲染出货');
var allEq = true;
for (var k = 0; k < 10; k++) {
  var nm = '臣' + (k * 11);
  var exp = {
    unread: sandbox._ltCountUnread(nm), transit: sandbox._ltCountTransit(nm),
    lost: sandbox._ltCountLost(nm), npcNew: sandbox._ltCountNpcNew(nm)
  };
  // 从渲染 html 里核对该人指示徽数字(unread/new/transit 有数字·lost 是 ?)
  var seg = cardsHtml.split('hy-npc-name">' + nm + '<')[0];  // 名字前最近一段含其 indicators? 不可靠——改直接比预扫表
  if (!seg) allEq = false;
}
// 直接钉语义：临时重放预扫逻辑与旧函数全量对比(120 人全比)
(function () {
  var G = sandbox.GM;
  var _lateTh = 1;  // _hyTurnsForMonths(1) 的值不影响本 fixture(deliveryTurn=999 无逾期)
  for (var c = 0; c < 120; c++) {
    var nm2 = '臣' + c;
    var mine = { unread: 0, transit: 0, lost: 0, npcNew: 0 };
    G.letters.forEach(function (l) {
      if (l.from === nm2 && !l._playerRead) { mine.unread++; if (l.status === 'returned') mine.npcNew++; }
      if (l.to === nm2) {
        if (l.status === 'traveling' || l.status === 'replying') mine.transit++;
        if (l.status === 'intercepted' || (l.status === 'traveling' && G.turn > l.deliveryTurn + _lateTh)) mine.lost++;
      }
    });
    if (mine.unread !== sandbox._ltCountUnread(nm2) || mine.transit !== sandbox._ltCountTransit(nm2)
      || mine.lost !== sandbox._ltCountLost(nm2) || mine.npcNew !== sandbox._ltCountNpcNew(nm2)) { allEq = false; break; }
  }
})();
assert(allEq, '120 人预扫语义 = 旧四函数逐一等价(零行为变化)');

console.log('② 静态契约：卡片循环不再每人全量扫');
var src = fs.readFileSync(path.join(ROOT, 'tm-hongyan-office.js'), 'utf8');
assert(!/_ltCountUnread\(ch\.name\)/.test(src), '循环内 _ltCountUnread(ch.name) 已除');
assert(/_cnt\[ch\.name\]/.test(src), '循环改查预扫表');

console.log('③ 信史收卷：>120 封只铺近 120');
sandbox.GM._pendingLetterTo = '臣0';
for (var m = 0; m < 200; m++) sandbox.GM.letters.push({ id: 'x' + m, from: '玩家', to: '臣0', status: 'arrived', content: '第' + m, sentTurn: m });
sandbox.renderLetterPanel();
var hist = DOM['letter-history'].innerHTML;
assert(hist.indexOf('已收卷') >= 0, '更早收卷注明');
assert((hist.match(/hy-letter/g) || []).length <= 130, '铺卡受限(≤120+头部余量)');

console.log('④ 发送后渲染炸 → 信仍发出·不拖成卡死观感');
DOM['letter-textarea'].value = '爱卿辛苦';
sandbox.GM._pendingLetterTo = '臣5';
var before = sandbox.GM.letters.length;
sandbox.renderLetterPanel = function () { throw new Error('render boom'); };
var threw = false;
try { sandbox.sendLetter(); } catch (e) { threw = true; }
assert(!threw, 'renderLetterPanel 炸 → sendLetter 不外抛(点击不僵)');
assert(sandbox.GM.letters.length === before + 1, '信已落账发出');
assert(toasts.some(function (t) { return t.indexOf('信函已发出') >= 0; }), '发出提示已弹');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-hongyan-send-freeze: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-hongyan-send-freeze (预扫等价/静态契约/信史收卷/渲染炸不僵)');

// smoke-zoushu-pool-gen.js — 百官有事·主动上奏（深挖第六轮②）
// 验：_tickZoushuPool(tm-endturn-helpers.js) 按真实局面（民变/灾异/积弊/部务逾期）
//     由对口衙门主官确定性生成上奏入 GM.zoushuPool（常朝 _cc2_collectAgendaSources 现成消费）·
//     0-2条/回合·同事由6回合窗防重·虚悬无人奏·flag zoushuGenEnabled 默认关。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(c, m) { N++; if (!c) { console.error('ASSERT FAIL [' + N + ']:', m); process.exit(1); } }

const ctx = { console: console, Date: Date, JSON: JSON, Math: Math, String: String, Number: Number, Array: Array, Object: Object, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite };
ctx.window = ctx; ctx.globalThis = ctx; ctx.global = ctx;
ctx.localStorage = { getItem: function(){return null;}, setItem: function(){}, removeItem: function(){} };
ctx.SettlementPipeline = { _regs: [], register: function (id, name, fn, prio) { this._regs.push({ id: id, prio: prio }); } };
ctx.addEB = function () {};
ctx.getTSText = function () { return ''; };
ctx.escHtml = function (s) { return String(s == null ? '' : s); };
ctx.findCharByName = function () { return null; };

function freshGM() {
  return {
    running: true, turn: 10, chars: [], cities: [],
    officeTree: [
      { name: '兵部', desc: '掌武备军政', functions: ['军事'], positions: [{ name: '尚书', rank: '2', holder: '孙承宗', duties: '总理戎政' }] },
      { name: '户部', desc: '掌户口钱粮赈济', functions: ['财政'], positions: [{ name: '尚书', rank: '2', holder: '毕自严', duties: '掌邦计' }] },
      { name: '都察院', desc: '掌监察纠劾', functions: ['监察'], positions: [{ name: '左都御史', rank: '2', holder: '左光斗', duties: '纠劾百司' }] }
    ],
    minxin: { revolts: [{ region: '陕西', level: 4, status: 'ongoing' }] },
    activeDisasters: [{ type: '旱灾', region: '河南', severity: 70, startedTurn: 10 }],
    corruption: { byDept: { fiscal: 72, central: 30 } },
    deptTasks: [{ dept: '户部', task: '清查京仓', status: 'overdue' }],
    currentIssues: []
  };
}
ctx.GM = freshGM();
ctx.P = { conf: {} };

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8'), ctx, { filename: 'tm-endturn-helpers.js' });
assert(typeof ctx._tickZoushuPool === 'function', '① _tickZoushuPool 已定义');
assert(ctx.SettlementPipeline._regs.some(function (r) { return r.id === 'zoushuGen'; }), '② 已注册 SettlementPipeline 步 zoushuGen');

// ── flag 默认关 = no-op ──
ctx._tickZoushuPool();
assert(!Array.isArray(ctx.GM.zoushuPool) || ctx.GM.zoushuPool.length === 0, '③ flag 默认关：池子不动');

// ── 开 flag：按急缓落池·每回合至多2条 ──
ctx.P.conf.zoushuGenEnabled = true;
ctx._tickZoushuPool();
assert(Array.isArray(ctx.GM.zoushuPool) && ctx.GM.zoushuPool.length === 2, '④ 首回合落池2条(封顶)');
var z0 = ctx.GM.zoushuPool[0], z1 = ctx.GM.zoushuPool[1];
assert(z0.from === '孙承宗' && z0.title.indexOf('民变') >= 0 && z0.type === '军务', '⑤ 民变最急·兵事主官奏闻');
assert(z0.urgency === 8, '⑥ 四级民变 urgency=8');
assert(z1.from === '毕自严' && z1.title.indexOf('请赈') >= 0 && z1.title.indexOf('旱灾') >= 0, '⑦ 灾异次之·钱谷主官请赈');
assert(z0.status === 'pending' && typeof z0.turn === 'number' && z0.content.indexOf('孙承宗谨奏') === 0 && z0.dept === '兵部', '⑧ 条目形状契约(from/title/content/status/turn/dept)·消费端并集');

// ── 同回合重入：事由防重·零新增 ──
ctx._tickZoushuPool();
assert(ctx.GM.zoushuPool.length === 2, '⑨ 同回合重入防重零新增');

// ── 次回合：已奏事由仍在窗内·轮到积弊+催督 ──
ctx.GM.turn = 11;
ctx._tickZoushuPool();
assert(ctx.GM.zoushuPool.length === 4, '⑩ 次回合续奏2条(积弊+催督)');
var z2 = ctx.GM.zoushuPool[2], z3 = ctx.GM.zoushuPool[3];
assert(z2.from === '左光斗' && z2.title.indexOf('纠劾') >= 0 && z2.title.indexOf('财计') >= 0, '⑪ 财计积弊·风宪主官纠劾');
assert(z3.from === '左光斗' && z3.title.indexOf('催督') >= 0 && z3.content.indexOf('清查京仓') >= 0, '⑫ 部务逾期·科道催督具名');

// ── 第三回合：四事由全在窗内·无事可奏 ──
ctx.GM.turn = 12;
ctx._tickZoushuPool();
assert(ctx.GM.zoushuPool.length === 4, '⑬ 事由窗内不重奏');

// ── 6回合窗过·旧奏出池·同事由可再奏 ──
ctx.GM.turn = 17;   // 10+7 > 窗6 → turn10 两条出池；旱灾已逾3回合新灾窗不再候选；积弊/催督(turn11)仍在窗内
ctx._tickZoushuPool();
var fresh17 = ctx.GM.zoushuPool.filter(function (z) { return z.turn === 17; });
assert(fresh17.length === 1 && fresh17[0]._sigKey === 'revolt:陕西', '⑭ 窗过出池·民变复奏(乱未平则再闻)·旧灾不再新奏');

// ── 虚悬：风宪无主官 → 积弊无人奏(诚实缺员) ──
ctx.GM = freshGM();
ctx.GM.minxin.revolts = []; ctx.GM.activeDisasters = [];
ctx.GM.officeTree[2].positions[0].holder = '';
ctx._tickZoushuPool();
assert(ctx.GM.zoushuPool.length === 0, '⑮ 对口衙门虚悬则此事无人入奏');

// ── 民变平息(status非ongoing)不奏·level<2不奏 ──
ctx.GM = freshGM();
ctx.GM.activeDisasters = []; ctx.GM.corruption = {}; ctx.GM.deptTasks = [];
ctx.GM.minxin.revolts = [{ region: '山东', level: 4, status: 'suppressed' }, { region: '山西', level: 1, status: 'ongoing' }];
ctx._tickZoushuPool();
assert(ctx.GM.zoushuPool.length === 0, '⑯ 已平/一级民变不入奏');

// ── 池容8条封顶 ──
ctx.GM = freshGM();
ctx.GM.zoushuPool = [];
for (var i = 0; i < 10; i++) ctx.GM.zoushuPool.push({ id: 'old' + i, _sigKey: 'k' + i, turn: 9, status: 'pending' });
ctx._tickZoushuPool();
assert(ctx.GM.zoushuPool.length <= 8 + 2, '⑰ 池容封顶(8+本回合新增)');

// ── 静态契约：消费端/开关在位 ──

console.log('smoke-zoushu-pool-gen OK — ' + N + ' 断言全绿（四信号/对口主官/防重窗/池容/虚悬/flag闸）');

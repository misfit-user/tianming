// smoke-dept-tasks-reply.js — 事下有司·限期回奏（深挖第六轮①）
// 验：_tickDeptTasksReply(tm-endturn-helpers.js) 对常朝「发部议」写入的 GM.deptTasks
//     逐回合递减 dueIn·限满按衙门解析主官具本回奏入御案时政(currentIssues)·
//     主官虚悬→overdue·主官离心→敷衍·flag deptReplyEnabled 默认关。
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
const ebLog = [];
ctx.addEB = function (cat, txt) { ebLog.push({ cat: cat, txt: txt }); };
ctx.getTSText = function () { return '天启七年'; };
ctx.escHtml = function (s) { return String(s == null ? '' : s); };
const chars = [
  { name: '毕自严', loyalty: 80, alive: true },   // 毕自严·忠悃主官
  { name: '周延儒', loyalty: 20, alive: true }    // 周延儒·离心主官
];
ctx.findCharByName = function (n) { for (var i = 0; i < chars.length; i++) if (chars[i].name === n) return chars[i]; return null; };

ctx.GM = {
  running: true, turn: 10, sid: 't', scenarioName: 's',
  chars: chars, cities: [],
  officeTree: [
    { name: '户部', desc: '掌天下户口钱粮', functions: ['财政'], positions: [{ name: '尚书', rank: '2', holder: '毕自严', duties: '总理部务' }] },
    { name: '礼部', desc: '掌礼仪科举', functions: ['礼仪'], positions: [{ name: '尚书', rank: '2', holder: '周延儒', duties: '总理部务' }] },
    { name: '工部', desc: '掌营缮工程', functions: ['营造'], positions: [{ name: '尚书', rank: '2', holder: '', duties: '总理部务' }] } // 虚悬
  ],
  deptTasks: [], currentIssues: []
};
ctx.P = { conf: {} };

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8'), ctx, { filename: 'tm-endturn-helpers.js' });
assert(typeof ctx._tickDeptTasksReply === 'function', '① _tickDeptTasksReply 已定义');
assert(ctx.SettlementPipeline._regs.some(function (r) { return r.id === 'deptTasksReply'; }), '② 已注册 SettlementPipeline 步 deptTasksReply');

function mkTask(dept, task) { return { dept: dept, task: task, detail: '详情' + task, assignedAtTurn: ctx.GM.turn, dueIn: 3, status: 'pending', source: 'changchao_refer' }; }

// ── flag 默认关 = no-op ──
ctx.GM.deptTasks = [mkTask('户部', '清查京仓')];
ctx._tickDeptTasksReply();
assert(ctx.GM.deptTasks[0].dueIn === 3 && ctx.GM.deptTasks[0].status === 'pending', '③ flag 默认关：dueIn/status 纹丝不动');
assert(ctx.GM.currentIssues.length === 0, '④ flag 关无时政注入');

// ── 开 flag：dueIn 逐回合递减·未满不奏 ──
ctx.P.conf.deptReplyEnabled = true;
ctx._tickDeptTasksReply();                        // turn 10: 3→2
assert(ctx.GM.deptTasks[0].dueIn === 2 && ctx.GM.deptTasks[0].status === 'pending', '⑤ T10 递减 3→2 未满不奏');
ctx._tickDeptTasksReply();                        // 同回合重入
assert(ctx.GM.deptTasks[0].dueIn === 2, '⑥ 同回合重入幂等不双减');
ctx.GM.turn = 11; ctx._tickDeptTasksReply();      // 2→1
ctx.GM.turn = 12; ctx._tickDeptTasksReply();      // 1→0 → 回奏
assert(ctx.GM.deptTasks[0].status === 'replied' && ctx.GM.deptTasks[0].repliedAtTurn === 12, '⑦ 限满回奏 status=replied');
assert(ctx.GM.currentIssues.length === 1, '⑧ 御案时政收到回奏一条');
var iss = ctx.GM.currentIssues[0];
assert(/^iss_deptreply_12_/.test(iss.id) && iss._deptReply === true && iss._info === true && iss.status === 'pending', '⑨ 时政条目 id/标记/状态契约');
assert(iss.title.indexOf('清查京仓') >= 0 && iss.description.indexOf('毕自严') >= 0, '⑩ 回奏具名主官与事项');
assert(iss.description.indexOf('敷衍') < 0, '⑪ 忠惇主官回奏非敷衍档');
assert(ebLog.some(function (e) { return e.cat === '部务'; }), '⑫ 编年入「部务」条');

// ── 已结任务不再重奏 ──
ctx.GM.turn = 13; ctx._tickDeptTasksReply();
assert(ctx.GM.currentIssues.length === 1, '⑬ 已结任务不重奏');

// ── 主官离心(loyalty<40) → 敷衍档 ──
ctx.GM.deptTasks.push({ dept: '礼部', task: '议大祭', detail: 'x', assignedAtTurn: 13, dueIn: 1, status: 'pending' });
ctx.GM.turn = 14; ctx._tickDeptTasksReply();
var iss2 = ctx.GM.currentIssues[1];
assert(iss2 && iss2.description.indexOf('周延儒') >= 0 && iss2.description.indexOf('敷衍') >= 0, '⑭ 离心主官回奏敷衍塞责档');

// ── 主官虚悬 → overdue 逾期未奏 ──
ctx.GM.deptTasks.push({ dept: '工部', task: '修皇陵', detail: 'x', assignedAtTurn: 14, dueIn: 1, status: 'pending' });
ctx.GM.turn = 15; ctx._tickDeptTasksReply();
var t3 = ctx.GM.deptTasks.filter(function (t) { return t.task === '修皇陵'; })[0];
var iss3 = ctx.GM.currentIssues[2];
assert(t3.status === 'overdue', '⑮ 虚悬衙门 status=overdue');
assert(iss3 && iss3.description.indexOf('申饬') >= 0 && iss3.title.indexOf('逾期未奏') >= 0, '⑯ 逾期未奏档提示申饬/补官');

// ── 未知衙门（officeTree 无匹配）→ 也走 overdue 诚实档不塌 ──
ctx.GM.deptTasks.push({ dept: '某部', task: '查驿递', detail: 'x', assignedAtTurn: 15, dueIn: 1, status: 'pending' });
ctx.GM.turn = 16; ctx._tickDeptTasksReply();
var t4 = ctx.GM.deptTasks.filter(function (t) { return t.task === '查驿递'; })[0];
assert(t4.status === 'overdue', '⑰ 查无此衙门也走逾期档不塔');

// ── 每回合封顶3件·余者下回合续报 ──
ctx.GM.deptTasks = [mkTask('户部', 'A'), mkTask('户部', 'B'), mkTask('户部', 'C'), mkTask('户部', 'D')];
ctx.GM.deptTasks.forEach(function (t) { t.dueIn = 1; });
ctx.GM.currentIssues = [];
ctx.GM.turn = 20; ctx._tickDeptTasksReply();
assert(ctx.GM.currentIssues.length === 3, '⑱ 单回合封顶3件');
ctx.GM.turn = 21; ctx._tickDeptTasksReply();
assert(ctx.GM.currentIssues.length === 4, '⑲ 第4件下回合续报');

// ── currentIssues 缺失不塌·任务照结 ──
ctx.GM.deptTasks = [mkTask('户部', 'E')]; ctx.GM.deptTasks[0].dueIn = 1;
ctx.GM.currentIssues = null;
ctx.GM.turn = 22; ctx._tickDeptTasksReply();
assert(ctx.GM.deptTasks[0].status === 'replied', '⑳ 时政数组缺失不塔任务照结');

// ── 台账瘦身：已结留12条 ──
ctx.GM.currentIssues = [];
ctx.GM.deptTasks = [];
for (var i = 0; i < 20; i++) ctx.GM.deptTasks.push({ dept: '户部', task: 'old' + i, status: 'replied', repliedAtTurn: 1 });
ctx.GM.deptTasks.push(mkTask('户部', '新事'));
ctx.GM.turn = 23; ctx._tickDeptTasksReply();
var closed = ctx.GM.deptTasks.filter(function (t) { return t.status !== 'pending'; });
var pend = ctx.GM.deptTasks.filter(function (t) { return t.status === 'pending'; });
assert(closed.length === 12, '⑴ 已结台账瘦身留12条');
assert(pend.length === 1 && pend[0].task === '新事', '⑵ pending 一律保留');

// ── 静态契约：设置开关已挂 ──

console.log('smoke-dept-tasks-reply OK — ' + N + ' 断言全绿（递减/回奏三档/封顶/瘦身/flag闸）');

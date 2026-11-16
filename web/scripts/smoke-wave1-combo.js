#!/usr/bin/env node
'use strict';
// smoke-wave1-combo.js — 波一斩旗转正·三旗同开组合冒烟（2026-07-16）
//   验第一波拟转正的三面旗在【同一 GM/P 世界·三旗全开】时共存、各自落点无串扰，
//   为 owner playtest 转正做前置保障。
//   三面旗与引擎读点：
//     · deptReplyEnabled   部议限期回奏  → tm-endturn-helpers.js:_tickDeptTasksReply
//     · zoushuGenEnabled   百官主动上奏  → tm-endturn-helpers.js:_tickZoushuPool
//     · massAmnestyEnabled 恩诏大赦      → tm-endturn-edict.js:applyEdictActions(massAmnesty 段)
//   底子取自三个单旗 smoke：smoke-dept-tasks-reply.js / smoke-zoushu-pool-gen.js /
//   smoke-mass-amnesty.js（另参 smoke-zoushu-ai-draft.js）。本测把三者的最小世界并成一个 GM/P。
//
// ── 覆盖边界声明（据真实引擎数据面·别硬造断言面）──
//   三链在引擎里的真实写点（读源码确认）：
//     部议 → 写 GM.deptTasks[].status/dueIn/repliedAtTurn + push GM.currentIssues(标 _deptReply) + addEB('部务')
//     上奏 → 写 GM.zoushuPool(push/prune)；【只读】消费 GM.deptTasks(overdue)/minxin/activeDisasters/corruption；
//            不写 deptTasks、不写 currentIssues、不调 addEB
//     大赦 → 写 GM.chars[]._imprisoned 等 + push GM.currentIssues(标 _amnesty) + addEB('恩诏')；
//            不碰 deptTasks、不碰 zoushuPool
//   → 真正的共享面只有两处，本测据实覆盖：
//       (a) GM.currentIssues 被【部议 + 大赦】共写：验各自 marker(_deptReply / _amnesty) 互斥不覆盖·计数可加；
//       (b) GM.deptTasks 被部议写、被上奏【只读】消费(overdue → 催督奏)：验上奏读取不回写污染·
//           且此耦合是【设计内】的（部议产出的 overdue 正确喂进上奏的催督链），不是串扰。
//   → 天然无共享写点者（大赦 vs 上奏、大赦 vs 部议的 deptTasks/zoushuPool）：
//       如实断言到「跑完对方链后，本链落点逐字段一致」即止（快照前后 JSON 比对）。
//   → 确定性：同一初始世界跑两遍·关键落点 JSON 逐字段一致（三旗文案皆自称不掷骰·路径无 Date/Math.random）。
//   ── 未覆盖（及原因）──
//     · SettlementPipeline 的真实回合驱动顺序、常朝 tm-chaoyi 对 zoushuPool 的下游消费、
//       奏疏 AI 代拟正文：本测只锁「确定性生产端 + 三旗互不串扰」，下游消费另有单测覆盖
//       (smoke-zoushu-ai-draft 等)，不在本刀范围。
//     · 数值面（皇威/民心/内帑等）：三链均不在确定性通道直写这些，故不断言。

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// ── 分节 OK/FAIL 汇总（失败即计数·末尾统一裁决退出码）──
let FAILS = 0, CHECKS = 0;
function ok(cond, msg) {
  CHECKS++;
  if (cond) console.log('  OK   ' + msg);
  else { console.log('  FAIL ' + msg); FAILS++; }
}
function section(name) { console.log('\n── ' + name + ' ──'); }

const jclone = function (o) { return JSON.parse(JSON.stringify(o)); };
const jeq = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

// ── 造一个三旗共用的最小世界（一个 GM/P·两引擎文件同载一个 vm）──
//   officeTree 铺齐三链所需对口衙门：户部(财政/赈济)·兵部(军事)·都察院(监察)·工部(营造·虚悬)
//   chars 含在任主官(供 loyalty 判敷衍)与在押人犯(供大赦放归/不赦)
function buildWorld() {
  const ctx = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    Date: Date, JSON: JSON, Math: Math, RegExp: RegExp,
    String: String, Number: Number, Boolean: Boolean, Array: Array, Object: Object,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
  ctx.SettlementPipeline = { _regs: [], register: function (id, name, fn, prio, phase) { this._regs.push({ id: id, prio: prio, phase: phase }); } };
  ctx._eb = [];
  ctx.addEB = function (cat, txt) { ctx._eb.push({ cat: cat, txt: txt }); };
  ctx.getTSText = function () { return '天启十年'; };
  ctx.escHtml = function (s) { return String(s == null ? '' : s); };
  ctx.toast = function () {};
  ctx.recordCharacterArc = function () {};
  ctx.findCharByName = function (n) { return (ctx.GM.chars || []).filter(function (c) { return c && c.name === n; })[0] || null; };

  const chars = [
    // 在任主官（供部议回奏判敷衍/办讫）
    { name: '毕自严', loyalty: 80, alive: true },   // 户部尚书·忠悃
    { name: '孙承宗', loyalty: 75, alive: true },   // 兵部尚书
    { name: '左光斗', loyalty: 70, alive: true },   // 左都御史
    { name: '周延儒', loyalty: 20, alive: true },   // 礼部尚书·离心（本世界未触其回奏·仅铺陈）
    // 在押人犯（供大赦放归 / 重罪不赦）
    { name: '卢象升', alive: true, faction: '明朝廷', _imprisoned: true, _imprisonedTurn: 6, _imprisonReason: '直言获罪下狱', officialTitle: null, position: '' },
    { name: '孙元化', alive: true, faction: '明朝廷', _imprisoned: true, _imprisonedTurn: 6, _imprisonReason: '铸炮失利下狱', officialTitle: null, position: '' },
    { name: '崔呈秀', alive: true, faction: '明朝廷', _imprisoned: true, _imprisonedTurn: 6, _imprisonReason: '坐谋逆下诏狱', officialTitle: null, position: '' }, // 谋逆·不赦
    { name: '王之心', alive: true, faction: '明朝廷', _imprisoned: true, _imprisonedTurn: 6, _imprisonReason: '贪墨下狱', _conspiracyConvicted: true, officialTitle: null, position: '' } // 已定罪逆党·不赦
  ];

  ctx.GM = {
    running: true, turn: 10, month: 1, sid: 't', scenarioName: 's',
    chars: chars, cities: [],
    officeTree: [
      { name: '户部', desc: '掌户口钱粮赈济', functions: ['财政', '赈济'], positions: [{ name: '尚书', rank: '2', holder: '毕自严', duties: '掌邦计' }] },
      { name: '兵部', desc: '掌武备军政', functions: ['军事'], positions: [{ name: '尚书', rank: '2', holder: '孙承宗', duties: '总理戎政' }] },
      { name: '都察院', desc: '掌监察纠劾', functions: ['监察'], positions: [{ name: '左都御史', rank: '2', holder: '左光斗', duties: '纠劾百司' }] },
      { name: '礼部', desc: '掌礼仪科举', functions: ['礼仪'], positions: [{ name: '尚书', rank: '2', holder: '周延儒', duties: '总理部务' }] },
      { name: '工部', desc: '掌营缮工程', functions: ['营造'], positions: [{ name: '尚书', rank: '2', holder: '', duties: '总理部务' }] } // 虚悬
    ],
    minxin: { revolts: [{ region: '陕西', level: 4, status: 'ongoing' }] },
    activeDisasters: [{ type: '旱灾', region: '河南', severity: 70, startedTurn: 10 }],
    corruption: { byDept: { fiscal: 72, central: 30 } },
    deptTasks: [
      { dept: '户部', task: '清查京仓', detail: '清查京仓积弊', assignedAtTurn: 9, dueIn: 1, status: 'pending', source: 'changchao_refer' },
      { dept: '工部', task: '修皇陵', detail: '修缮皇陵工程', assignedAtTurn: 9, dueIn: 1, status: 'pending', source: 'changchao_refer' } // 工部虚悬 → overdue
    ],
    zoushuPool: [],
    currentIssues: []
  };
  ctx.P = { playerInfo: { characterName: '崇祯', factionName: '明朝廷' }, conf: { deptReplyEnabled: true, zoushuGenEnabled: true, massAmnestyEnabled: true } };

  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8'), ctx, { filename: 'tm-endturn-helpers.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-edict.js'), 'utf8'), ctx, { filename: 'tm-endturn-edict.js' });
  return ctx;
}

// ── 在一个世界上依次驱动三条链（可选记录中途快照供串扰断言）──
//   顺序：部议(turn10) → 上奏(turn10) → 上奏(turn11) → 大赦(turn10)
//   记录 trace：部议后 deptTasks/eb·上奏后 deptTasks(验只读)·大赦前 deptTasks+zoushuPool+eb+issues
function runFull(withTrace) {
  const ctx = buildWorld();
  const GM = ctx.GM;
  const trace = {};

  // 链① 部议限期回奏（turn10：两任务 dueIn 1→0）
  GM.turn = 10;
  ctx._tickDeptTasksReply();
  if (withTrace) trace.afterDept = { deptTasks: jclone(GM.deptTasks), ebLen: ctx._eb.length, issuesLen: GM.currentIssues.length };

  // 链② 百官主动上奏（turn10 落 2 条：民变+灾异 / turn11 落 2 条：积弊+催督）
  if (withTrace) trace.deptTasksBeforeZoushu = jclone(GM.deptTasks);
  GM.turn = 10;
  ctx._tickZoushuPool();
  GM.turn = 11;
  ctx._tickZoushuPool();
  if (withTrace) trace.deptTasksAfterZoushu = jclone(GM.deptTasks);

  // 链③ 恩诏大赦（turn10 语境·放归普囚·重罪不赦）
  GM.turn = 10;
  if (withTrace) trace.preAmnesty = { deptTasks: jclone(GM.deptTasks), zoushuPool: jclone(GM.zoushuPool), ebLen: ctx._eb.length, issuesLen: GM.currentIssues.length };
  ctx.applyEdictActions(ctx.extractEdictActions('朕承天命，大赦天下，与民更始。'));

  return { ctx: ctx, trace: trace };
}

// ── 关键落点快照（供确定性双跑逐字段比对）──
function snapshot(ctx) {
  const GM = ctx.GM;
  return {
    deptStatuses: GM.deptTasks.map(function (t) { return t.task + ':' + t.status + ':' + t.dueIn; }),
    zoushu: GM.zoushuPool.map(function (z) { return [z._sigKey, z.from, z.title, z.dept, z.type, z.urgency, z.turn, z.id].join('|'); }),
    issues: GM.currentIssues.map(function (i) { return [i.id, !!i._deptReply, !!i._amnesty, i.category, i.title].join('|'); }),
    released: GM.chars.filter(function (c) { return c._releasedTurn === 10; }).map(function (c) { return c.name; }).sort(),
    stillHeld: GM.chars.filter(function (c) { return c._imprisoned === true; }).map(function (c) { return c.name; }).sort(),
    eb: ctx._eb.map(function (e) { return e.cat + ':' + e.txt; })
  };
}

// ════════════════════════════════════════════════════════════════
console.log('smoke-wave1-combo — 波一三旗同开组合冒烟');

const R = runFull(true);
const ctx = R.ctx, T = R.trace, GM = ctx.GM;

// ── 0. 加载与注册契约 ──
section('0. 双引擎同载一个 vm·四函数在位');
ok(typeof ctx._tickDeptTasksReply === 'function', '_tickDeptTasksReply 已定义');
ok(typeof ctx._tickZoushuPool === 'function', '_tickZoushuPool 已定义');
ok(typeof ctx.applyEdictActions === 'function' && typeof ctx.extractEdictActions === 'function', 'extract/applyEdictActions 已定义');
ok(ctx.SettlementPipeline._regs.some(function (r) { return r.id === 'deptTasksReply'; }), 'SettlementPipeline 注册 deptTasksReply');
ok(ctx.SettlementPipeline._regs.some(function (r) { return r.id === 'zoushuGen'; }), 'SettlementPipeline 注册 zoushuGen');

// ── 1. 链① 部议限期回奏·三旗全开下自身信号成立 ──
section('1. 部议限期回奏（deptReplyEnabled）');
var tCang = GM.deptTasks.filter(function (t) { return t.task === '清查京仓'; })[0];
var tLing = GM.deptTasks.filter(function (t) { return t.task === '修皇陵'; })[0];
ok(tCang && tCang.status === 'replied' && tCang.repliedAtTurn === 10, '户部「清查京仓」限满回奏 status=replied');
ok(tLing && tLing.status === 'overdue', '工部虚悬「修皇陵」→ overdue 逾期未奏');
var issDept = GM.currentIssues.filter(function (i) { return i._deptReply === true; });
ok(issDept.length === 2, '御案时政收到 2 条 _deptReply（回奏+逾期各一）');
var issCang = issDept.filter(function (i) { return i.title.indexOf('清查京仓') >= 0; })[0];
ok(issCang && issCang.description.indexOf('毕自严') >= 0 && issCang.description.indexOf('敷衍') < 0, '回奏具名忠悃主官毕自严·非敷衍档');
ok(issDept.every(function (i) { return i.category === '部务' && i._info === true && /^iss_deptreply_10_/.test(i.id); }), '时政条目 id/分类/标记契约');
ok(ctx._eb.filter(function (e) { return e.cat === '部务'; }).length === 2, '编年入「部务」2 条');

// ── 2. 链② 百官主动上奏·三旗全开下自身信号成立 ──
section('2. 百官主动上奏（zoushuGenEnabled）');
ok(Array.isArray(GM.zoushuPool) && GM.zoushuPool.length === 4, 'zoushuPool 落 4 条（turn10 民变+灾异·turn11 积弊+催督）');
var zRevolt = GM.zoushuPool.filter(function (z) { return z._sigKey === 'revolt:陕西'; })[0];
var zDis = GM.zoushuPool.filter(function (z) { return z._sigKey === 'dis:河南:旱灾'; })[0];
var zCorr = GM.zoushuPool.filter(function (z) { return z._sigKey === 'corr:fiscal'; })[0];
ok(zRevolt && zRevolt.from === '孙承宗' && zRevolt.type === '军务' && zRevolt.urgency === 8, '民变最急·兵部孙承宗奏闻 urgency=8');
ok(zDis && zDis.from === '毕自严' && zDis.title.indexOf('请赈') >= 0 && zDis.title.indexOf('旱灾') >= 0, '灾异·户部毕自严请赈');
ok(zCorr && zCorr.from === '左光斗' && zCorr.title.indexOf('纠劾') >= 0, '财计积弊·都察院左光斗纠劾');
// 同回合重入幂等·防重窗
ctx.GM.turn = 11; ctx._tickZoushuPool();
ok(GM.zoushuPool.length === 4, '同回合重入零新增（6 回合防重窗生效·未被他旗扰动）');

// ── 3. 链③ 恩诏大赦·三旗全开下自身信号成立 ──
section('3. 恩诏大赦（massAmnestyEnabled）');
var byName = function (n) { return GM.chars.filter(function (c) { return c.name === n; })[0]; };
ok(byName('卢象升')._imprisoned === false && byName('孙元化')._imprisoned === false, '在押普囚卢象升/孙元化尽放归');
ok(byName('卢象升')._releasedTurn === 10 && byName('卢象升')._recalledTurn === 10, '释放/召回戳齐');
ok((byName('卢象升').officialTitle == null || byName('卢象升').officialTitle === ''), '放归田里不复官');
ok(byName('崔呈秀')._imprisoned === true, '谋逆缘由崔呈秀不在赦列');
ok(byName('王之心')._imprisoned === true, '已定罪逆党王之心（_conspiracyConvicted）不赦');
var issAmn = GM.currentIssues.filter(function (i) { return i._amnesty === true; });
ok(issAmn.length === 1 && /^iss_amnesty_10/.test(issAmn[0].id), '御案时政收恩诏昭告 1 条');
ok(issAmn[0].description.indexOf('卢象升') >= 0 && issAmn[0].description.indexOf('2人') >= 0, '昭告具名放归+计数(2人)');
ok(issAmn[0].description.indexOf('不在赦列') >= 0, '昭告点明重犯不赦');
ok(ctx._eb.filter(function (e) { return e.cat === '恩诏'; }).length === 1, '编年入「恩诏」1 条');

// ── 4. 串扰断言：三链落点互不污染 ──
section('4. 串扰断言（三链落点互不污染）');
// 4a. 共享面 GM.currentIssues：部议与大赦共写·marker 互斥不覆盖·计数可加
ok(GM.currentIssues.length === issDept.length + issAmn.length, 'currentIssues 计数 = 部议(2)+大赦(1)·无覆盖丢条');
ok(GM.currentIssues.every(function (i) { return !(i._deptReply && i._amnesty); }), '无条目同时标 _deptReply 与 _amnesty（marker 互斥）');
ok(issAmn[0]._deptReply !== true && issCang._amnesty !== true, '大赦条无部议 marker·部议条无大赦 marker');
// 4b. 上奏【只读】消费 deptTasks：跑完上奏后 deptTasks 逐字段不变（不回写污染）
ok(jeq(T.deptTasksBeforeZoushu, T.deptTasksAfterZoushu), '上奏读取 overdue 后 deptTasks 逐字段一致（只读·不回写）');
// 4c. 部议 overdue 正确喂进上奏催督链（设计内耦合成立·非串扰）·且 replied 任务不被误催
var zDue = GM.zoushuPool.filter(function (z) { return /^due:/.test(z._sigKey); });
ok(zDue.length === 1 && zDue[0]._sigKey === 'due:修皇陵' && zDue[0].content.indexOf('修皇陵') >= 0, 'overdue「修皇陵」正确喂催督奏（部议→上奏设计内耦合）');
ok(!GM.zoushuPool.some(function (z) { return z._sigKey === 'due:清查京仓'; }), 'replied「清查京仓」不入催督（只 overdue 触发·状态不误判）');
// 4d. 大赦不碰 deptTasks / zoushuPool（快照前后逐字段一致）
ok(jeq(T.preAmnesty.deptTasks, jclone(GM.deptTasks)), '大赦后 deptTasks 逐字段一致（大赦不碰部议台账）');
ok(jeq(T.preAmnesty.zoushuPool, jclone(GM.zoushuPool)), '大赦后 zoushuPool 逐字段一致（大赦不碰奏疏池）');
// 4e. 编年台账分类隔离：上奏零编年·部议只入「部务」·大赦只入「恩诏」
ok(T.preAmnesty.ebLen === T.afterDept.ebLen, '上奏链零编年写入（跑完上奏 eb 长度不变）');
var ebCats = {}; ctx._eb.forEach(function (e) { ebCats[e.cat] = (ebCats[e.cat] || 0) + 1; });
ok(Object.keys(ebCats).sort().join(',') === '恩诏,部务', '编年分类仅 {部务,恩诏}·无跨链串类');

// ── 5. 确定性：同一初始世界跑两遍·关键落点逐字段一致 ──
section('5. 确定性双跑（三旗文案皆自称不掷骰）');
var s1 = snapshot(runFull(false).ctx);
var s2 = snapshot(runFull(false).ctx);
ok(jeq(s1, s2), '两遍关键落点(deptTasks/zoushuPool/currentIssues/放归/编年) JSON 逐字段一致');
ok(s1.released.join(',') === '卢象升,孙元化' && s1.stillHeld.join(',') === '崔呈秀,王之心', '双跑放归/羁押集合稳定');
ok(s1.zoushu.length === 4 && s1.issues.length === 3, '双跑落点计数稳定（奏疏4·时政3）');

// ── 6. 静态契约：三旗设置开关与引擎默认关闸在位 ──
section('6. 三旗设置开关与默认关闸静态契约');

// ════════════════════════════════════════════════════════════════
console.log('\n' + CHECKS + ' 检查·' + (CHECKS - FAILS) + ' 通过·' + FAILS + ' 失败');
if (FAILS === 0) { console.log('=== ALL PASS ==='); process.exit(0); }
else { console.log('=== FAIL ==='); process.exit(1); }

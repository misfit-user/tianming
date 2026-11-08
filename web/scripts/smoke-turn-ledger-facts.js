#!/usr/bin/env node
// 本回合账目实变 smoke：史官成文前交给史官的数目依据——期初期末、已落账收支、指标、人事、没落地的声明；只读不写。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); checks++; };

function load() {
  const c = { console: { log() {}, warn() {}, error() {} }, TM: {} };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-turn-ledger-facts.js'), 'utf8'), c, { filename: 'tm-turn-ledger-facts.js' });
  return c.TM.TurnLedgerFacts;
}

function world() {
  return {
    turn: 3,
    _prevGuoku: { ledgers: { money: { stock: 4200000 }, grain: { stock: 900000 } } },
    guoku: { ledgers: { money: { stock: 4080000 }, grain: { stock: 900000 } } },
    _prevNeitang: { money: 700000 },
    neitang: { money: 600000 },
    _turnReport: [
      { type: 'fiscal_adj', turn: 3, target: 'guoku', kind: 'expense', resource: 'money', name: '赈陕西饥', amount: 120000 },
      { type: 'fiscal_adj', turn: 3, target: 'neitang', kind: 'expense', resource: 'money', name: '辽饷', amount: 0, requested: 300000 },
      { type: 'fiscal_adj', turn: 2, target: 'guoku', kind: 'income', resource: 'money', name: '上回合的', amount: 5 },
      { type: 'aiPolicyAction', turn: 3, field: 'central_local_actions', text: '诏令：下拨陕西银40000两赈济水灾。' }
    ],
    turnChanges: {
      variables: [
        { name: 'minxin', label: '民心', oldValue: 41, newValue: 44, delta: 3, reasons: [{ desc: '赈陕西', amount: 2 }, { desc: '免辽饷', amount: 1 }] },
        { name: 'tiny', label: '微变', oldValue: 10, newValue: 10.2, delta: 0.2 }
      ],
      characters: [
        { name: '孙承宗', changes: [{ field: 'officialTitle', oldValue: '礼部右侍郎', newValue: '兵部尚书', reason: '诏起督师' }] },
        { name: '魏忠贤', changes: [{ field: 'alive', oldValue: true, newValue: false, reason: '自缢阜城' }, { field: 'loyalty', oldValue: 50, newValue: 52 }] }
      ],
      military: [{ name: '关宁军', changes: [{ field: 'soldiers', oldValue: 60000, newValue: 72000 }] }]
    },
    vars: { 国库年入: { value: 3500000, unit: '两' }, 太平: { value: 50 } },
    // 形状照 tm-endturn-apply-stages.js：applied.failed 逐条加 turn/source 存入
    _unappliedChanges: [
      { turn: 3, source: 'sc1', fiscal_adjustment: { target: 'neitang', kind: 'expense', name: '犒赏辽军', amount: 300000 }, reason: '内帑不足' },
      { turn: 3, source: 'sc1', personnel_change: { name: '袁崇焕', change: '督师蓟辽' }, reason: '找不到此人' },
      { turn: 3, source: 'sc1', faction_update: '后金', reason: '势力不存在' },
      { turn: 3, source: 'sc1', field: 'central_local_actions', text: '诏令：拨辽东银五万两。', reason: '无此区划' },
      { turn: 3, source: 'sc1主应用', validator: '_fiscalValidatorLog', field: '_fiscalValidatorLog', code: 'consistency-unlanded', reason: '一致性校验未落地：fiscal_expense_missing（拨）：叙事 100000，已记录 0' },
      // 严格预检剔掉的（11-07 回放实录形状）
      { turn: 3, source: 'sc1主应用', field: 'office_assignments', droppedBy: 'strict-preflight', index: 0, target: '右副都御史·总理陕西赈务', item: { name: '杨鹤', post: '右副都御史·总理陕西赈务', dept: '都察院', action: 'appoint' }, reason: 'office position is not declared in current office tree' },
      { turn: 2, source: 'sc1', char_update: '上回合的', reason: '上回合的不算' }
    ]
  };
}

const F = load();
ok(F && typeof F.block === 'function', '模块挂在 TM.TurnLedgerFacts.block');

// ── 1. 一回合的整段 ──
{
  const G = world();
  const before = JSON.stringify(G);
  const text = F.block(G, { turn: 3, oldVars: { 国库年入: 3400000, 太平: 50 } });
  eq(JSON.stringify(G), before, '只读：不改 GM');
  ok(text.indexOf('【本回合账目实变（成文依据·数目以此为准）】') >= 0, '有标题');
  ok(text.indexOf('国库：期初银420万两、粮90万石；本回合至此银−12万两') >= 0, '国库给期初与本回合动用：' + text);
  ok(text.indexOf('内帑：期初银70万两；本回合至此银−10万两') >= 0, '内帑按平铺字段也能读');
  ok(text.indexOf('408万') < 0 && text.indexOf('60万两') < 0, '不给半途库存（月终结算前的数）');
  ok(text.indexOf('（月终常例岁入、俸饷此时尚未结算，月终结余未定）') >= 0, '注明月终未结');
  ok(text.indexOf('· 出国库 银12万两：赈陕西饥') >= 0, '已落账支出');
  ok(text.indexOf('· 出内帑：辽饷（请 30万两，未拨出）') >= 0, '请而未拨的写明未拨出');
  ok(text.indexOf('上回合的') < 0, '别的回合的账与未落地都不进');
  ok(text.indexOf('· 央地调拨：下拨陕西银40000两赈济水灾。') >= 0, '央地调拨');
  ok(text.indexOf('民心：期初41，本回合+3（因赈陕西、免辽饷）') >= 0, '指标变动带原因');
  ok(text.indexOf('微变') < 0, '不足半点的指标不写');
  ok(text.indexOf('国库年入：期初340万两，本回合+10万两') >= 0, '回合开始快照补出 turnChanges 没记的变量');
  ok(text.indexOf('太平') < 0, '没变的变量不写');
  ok(text.indexOf('· 孙承宗：官职 礼部右侍郎→兵部尚书（诏起督师）') >= 0, '任免');
  ok(text.indexOf('· 魏忠贤：身故（自缢阜城）') >= 0, '身故；忠诚小变不写');
  ok(text.indexOf('兵马：关宁军：兵+1.2万（期初6万）') >= 0, '兵马');
  ok(text.indexOf('【没落地的声明（账上没有，不得写成已发生）】\n· 收支·犒赏辽军 内帑 30万：内帑不足') >= 0, '没落地的收支单列：' + text);
  ok(text.indexOf('· 任免·袁崇焕 督师蓟辽：找不到此人') >= 0, '没落地的任免');
  ok(text.indexOf('· 势力·后金：势力不存在') >= 0, '没落地的势力变动');
  ok(text.indexOf('· 央地调拨·拨辽东银五万两：无此区划') >= 0, '没落地的央地调拨（去掉句末标点）');
  ok(text.indexOf('· 钱粮核对：一致性校验未落地：fiscal_expense_missing（拨）：叙事 100000') >= 0, '一致性校验写中文名');
  ok(text.indexOf('· 任官·杨鹤 右副都御史·总理陕西赈务：office position') >= 0, '预检剔掉的写中文字段名与当事人');
  ok(text.indexOf('本回合的变动数以上面这份为准') >= 0, '末尾有成文规矩');
}

// ── 1b. 同回合早先失败那次留下的未落地条目不算这次 ──
{
  const G = world();
  const stale = { turn: 3, source: 'sc1-preflight', finalRollbackReason: 'ai-writeback-atomic-failed', faction_update: '早先那次', reason: '旧的' };
  G._unappliedChanges.unshift(stale);
  const before = [stale];
  const text = F.block(G, { turn: 3, before });
  ok(text.indexOf('早先那次') < 0, '主写回之前已有的条目不进：' + text);
  ok(text.indexOf('· 任免·袁崇焕 督师蓟辽：找不到此人') >= 0, '这次新添的照进');
  ok(F.block(G, { turn: 3 }).indexOf('早先那次') >= 0, '不给 before 时按回合数取（旧行为）');
  // 主写回中途会把整个数组深拷贝换掉（11-07 回放实测），旧条目成了新对象：仍须认得出
  G._unappliedChanges = JSON.parse(JSON.stringify(G._unappliedChanges));
  ok(F.block(G, { turn: 3, before }).indexOf('早先那次') < 0, '数组被深拷贝换掉后旧条目仍不进');
  // 这次又出一模一样的失败：旧的抵掉一条，多出来的照列
  G._unappliedChanges.push(Object.assign({}, stale));
  ok((F.block(G, { turn: 3, before }).match(/早先那次/g) || []).length === 1, '这次重出的同样失败照列一次');
}

// ── 1c. 库账流水里本回合新落的条目：奉诏补饷这类不经 AI 写回的开支也列名目 ──
{
  const G = world();
  // 形状照 ai-change-applier/fiscal-posting.js addDetail：ledgers[res].sinkDetails[类] = [{id, name, amount}]
  const arrears = (id, name, m, g) => [{ id, name, amount: m }, { id, name, amount: g }];
  const [m1, g1] = arrears('liability:a1', '补饷·京营·五军营', 90000, 36000);
  const [m2, g2] = arrears('liability:a2', '补饷·京营·三千营', 12000, 4800);
  const oldIncome = { id: 'tianfu:prev', name: '田赋', amount: 300000 };
  G._prevGuoku.ledgers.money.sourceDetails = { tianfu: [Object.assign({}, oldIncome)] };
  G.guoku.ledgers.money.sinkDetails = { junxiang: [m1, m2], qita: [{ id: 'fa:1', name: '赈陕西饥', amount: 120000 }] };
  G.guoku.ledgers.money.sourceDetails = { tianfu: [Object.assign({}, oldIncome)], juanNa: [{ id: 'jn:1', name: '捐纳·例监', amount: 50000 }] };
  G.guoku.ledgers.grain.sinkDetails = { junxiang: [g1, g2] };
  const text = F.block(G, { turn: 3 });
  ok(text.indexOf('· 出国库·补饷：银10.2万两、粮4.08万石（京营·五军营、京营·三千营）') >= 0, '补饷按名目归并、银粮分记：' + text);
  ok(text.indexOf('· 入国库·捐纳：银5万两（例监）') >= 0, '本回合新落的收入也列');
  ok(text.indexOf('田赋') < 0, '回合开始已有、数额没变的流水不算本回合');
  ok((text.match(/赈陕西饥/g) || []).length === 1, 'AI 写回的同名支出只列一次');
}

// ── 2. 库存没动、没有期初快照 ──
{
  const G = world();
  G.guoku = JSON.parse(JSON.stringify(G._prevGuoku));
  delete G._prevNeitang;
  const text = F.block(G, { turn: 3 });
  ok(text.indexOf('国库：期初银420万两、粮90万石；本回合至此未动') >= 0, '没动写未动：' + text);
  ok(text.indexOf('内帑：现存银60万两（期初未记）') >= 0, '没有期初快照时不冒称期初');
}

// ── 3. 什么都没变：不加任何字，史官提示逐字不变 ──
{
  eq(F.block({ turn: 1 }, { turn: 1 }), '', '空世界返回空串');
  eq(F.block(null, {}), '', '无 GM 返回空串');
}

// ── 4. 长度封顶 ──
{
  const G = world();
  G.turnChanges.characters = [];
  for (let i = 0; i < 400; i++) G.turnChanges.characters.push({ name: '某官' + i, changes: [{ field: 'officialTitle', oldValue: '甲'.repeat(20), newValue: '乙'.repeat(20) }] });
  G.turnChanges.variables = [];
  for (let i = 0; i < 400; i++) G.turnChanges.variables.push({ name: 'v' + i, label: '指标' + i + '甲'.repeat(30), oldValue: 1, newValue: 9, delta: 8 });
  const text = F.block(G, { turn: 3 });
  ok(text.length <= 2700, '整段封顶：' + text.length);
  ok(text.indexOf('本回合的变动数以上面这份为准') >= 0, '截断后规矩仍在末尾');
}

// ── 5. 接线：史官成文提示在诏令成效之后接这一段 ──
{
  const src = fs.readFileSync(path.join(WEB, 'tm-endturn-ai.js'), 'utf8');
  const a = src.indexOf('TM.EdictOutcomes.narrativeFacts(GM, GM.turn)');
  const b = src.indexOf('TM.TurnLedgerFacts.block(GM, { turn: GM.turn, oldVars: ctx && ctx.input && ctx.input.oldVars, before: _unappliedBeforeSc1 })');
  ok(a > 0 && b > a && b - a < 400, '时政记提示紧跟诏令成效接上账目实变');
  const snap = src.indexOf('var _unappliedBeforeSc1 = ');
  const apply = src.indexOf('await afterSc1(ctx);');
  const runD = src.indexOf('await _runSc1d();');
  ok(snap > 0 && snap < apply && apply < runD, '未落地快照取在主写回之前，史官成文在其后');
}

console.log('smoke-turn-ledger-facts ok checks=' + checks);

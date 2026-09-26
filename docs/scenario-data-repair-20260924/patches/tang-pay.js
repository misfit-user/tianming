// 晚唐剧本·官俸军饷（阶段三第十二刀）
//
// 官俸按职位的 monthlyPay（钱、粮、布）逐月支给，财政引擎与公帑都读它（salary 与 monthlyPay.money 同值）；
// 军饷按部队的每兵月给（monthly*PayPerSoldier）乘兵数支给，另有全军每月给养 monthlyUpkeep，salary 是每兵月给乘兵数的岁额。
// 核查逐类对照会昌后百官俸钱与《太白阴经》，这里改（data/tang-pay.js）：两处离谱的官俸、诸节度使按会昌三百贯、
// 神策优给取边军两倍、骑军补马料。后三项按史实会让开局财政吃紧，同志定「按史实算」。京官整组重定只写进报告。
// 职位在剧本里有三份（唐廷势力的 officeTree、顶层 officeTree、officeRegistryByFaction.唐朝廷），三份一向相同，一并改。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-pay.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const { FIXES, JIEDU, TROOPS, FODDER, NOT_APPLIED } = require(path.join(DIR, 'data/tang-pay.js'));

const FACTION = '唐朝廷';
const PAY_KEYS = ['money', 'grain', 'cloth'];
const SOLDIER_KEYS = { money: 'monthlyMoneyPayPerSoldier', grain: 'monthlyGrainPayPerSoldier', cloth: 'monthlyClothPayPerSoldier' };
const SALARY_RESOURCE = { money: '钱', grain: '粮食', cloth: '布匹' };

const tidy = (x) => Number(x.toPrecision(12));
const fmt = (pay) => PAY_KEYS.map((k) => pay[k]).join('/');
const quotesOf = (list) => list.map((q) => q.source + '：「' + q.text + '」').join('；');

// 三棵官制树（须按同一顺序遍历，三份职位一一对应）
function officeTrees(scenario) {
  const faction = scenario.factions.find((f) => f.name === FACTION);
  return [[faction.officeTree, '唐廷势力 officeTree'], [scenario.officeTree, '顶层 officeTree'], [scenario.officeRegistryByFaction[FACTION], 'officeRegistryByFaction']];
}

function positionsIn(tree) {
  const found = [];
  (function walk(nodes) {
    (nodes || []).forEach((node) => {
      (node.positions || []).forEach((p) => found.push(p));
      walk(node.subs || node.children || node.subDepts || []);
    });
  })(tree);
  return found;
}

// 名为 name 的职位的三份，核对三份俸给一致
function copiesOf(scenario, name) {
  const copies = officeTrees(scenario).map(([tree, label]) => {
    const found = positionsIn(tree).filter((p) => p.name === name);
    if (found.length !== 1) throw new Error(label + ' 里「' + name + '」有 ' + found.length + ' 个');
    return found[0];
  });
  const text = JSON.stringify({ salary: copies[0].salary, monthlyPay: copies[0].monthlyPay });
  if (copies.some((p) => JSON.stringify({ salary: p.salary, monthlyPay: p.monthlyPay }) !== text)) throw new Error(name + ' 三份俸给已不一致，核对后再改');
  if (copies[0].salary !== copies[0].monthlyPay.money) throw new Error(name + ' 的 salary 与月给钱数不同');
  return copies;
}

function setPay(copies, pay) {
  copies.forEach((p) => {
    p.salary = pay.money;
    p.monthlyPay = Object.assign({}, p.monthlyPay, pay);
  });
}

function troopOf(scenario, name) {
  const found = scenario.military.initialTroops.filter((t) => t.name === name && t.faction === FACTION);
  if (found.length !== 1) throw new Error('唐廷部队「' + name + '」有 ' + found.length + ' 支');
  return found[0];
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  // ---- 1. 单个职位 ----
  const officeRows = FIXES.map((fix) => {
    if (!(fix.quotes || []).length) throw new Error(fix.office + ' 没有附原文');
    const copies = copiesOf(scenario, fix.office);
    const before = Object.assign({}, copies[0].monthlyPay);
    const pay = fix.like ? Object.assign({}, copiesOf(scenario, fix.like)[0].monthlyPay) : fix.monthlyPay;
    PAY_KEYS.forEach((k) => { if (typeof pay[k] !== 'number') throw new Error(fix.office + ' 缺 ' + k); });
    if (fmt(pay) === fmt(before)) throw new Error(fix.office + ' 已是 ' + fmt(pay));
    setPay(copies, pay);
    return '| ' + fix.office + ' | ' + fmt(before) + ' | ' + fmt(pay) + (fix.like ? '（同' + fix.like + '）' : '') + ' | ' + fix.confidence + ' | ' + fix.why + ' | ' + quotesOf(fix.quotes) + ' |';
  });

  // ---- 2. 诸节度使按会昌三百贯 ----
  const jieduNames = [...new Set(positionsIn(officeTrees(scenario)[0][0]).filter((p) => p.name.endsWith(JIEDU.suffix)).map((p) => p.name))];
  const jieduDone = [];
  const jieduSkipped = [];
  jieduNames.forEach((name) => {
    const copies = copiesOf(scenario, name);
    if (fmt(copies[0].monthlyPay) !== fmt(JIEDU.from)) { jieduSkipped.push(name + '（' + fmt(copies[0].monthlyPay) + '）'); return; }
    setPay(copies, JIEDU.to);
    jieduDone.push(name);
  });
  if (!jieduDone.length) throw new Error('没有按会昌数改到任何节度使');

  // ---- 3. 神策优给 ----
  const troopRows = [];
  TROOPS.forEach((spec) => {
    spec.names.forEach((name) => {
      const t = troopOf(scenario, name);
      PAY_KEYS.forEach((k) => { if (t[SOLDIER_KEYS[k]] !== spec.from[k]) throw new Error(name + ' 的每兵月给' + k + ' 现为 ' + t[SOLDIER_KEYS[k]]); });
      if (t.soldiers !== t.payrollStrength) throw new Error(name + ' 的兵数与支饷人数不同');
      PAY_KEYS.forEach((k) => {
        t[SOLDIER_KEYS[k]] = spec.to[k];
        const row = t.salary.find((s) => s.resource === SALARY_RESOURCE[k]);
        if (!row) throw new Error(name + ' 的岁额缺' + SALARY_RESOURCE[k]);
        row.amount = tidy(spec.to[k] * t.soldiers * 12);
      });
      troopRows.push('| ' + name + ' | ' + t.soldiers + ' | 每兵月给 ' + fmt(spec.from) + ' → ' + fmt(spec.to) + ' | ' + spec.confidence + ' | ' + spec.why + ' | ' + quotesOf(spec.quotes) + ' |');
    });
  });

  // ---- 4. 骑军马料 ----
  Object.keys(FODDER.perRider).forEach((name) => {
    const t = troopOf(scenario, name);
    if (t.type !== 'cavalry') throw new Error(name + ' 不是骑军');
    const base = tidy(t.soldiers * FODDER.baseUpkeepGrainPerSoldier);
    if (t.monthlyUpkeep.grain !== base) throw new Error(name + ' 的每月给养粮现为 ' + t.monthlyUpkeep.grain + '，不是未加马料的 ' + base);
    const add = tidy(t.soldiers * FODDER.perRider[name]);
    t.monthlyUpkeep.grain = tidy(base + add);
    troopRows.push('| ' + name + ' | ' + t.soldiers + ' | 每月给养粮 ' + base + ' → ' + t.monthlyUpkeep.grain + '（每骑马料 ' + FODDER.perRider[name] + ' 石） | ' + FODDER.confidence + ' | ' +
      FODDER.why + (FODDER.perRider[name] === 3 ? '天宝间属朔方节度所管，按「朔方、河西，一人二匹」。' : '按一骑一马。') + ' | ' + quotesOf(FODDER.quotes) + ' |');
  });

  const report = ['# 晚唐·官俸军饷报告', '',
    '改单个职位 ' + FIXES.length + ' 处、诸节度使 ' + jieduDone.length + ' 员按会昌三百贯、神策三营按边军两倍给、骑军四军补马料（钱/粮/布，每月）；职位三份一并改。' +
      '后三项按史实会让开局财政吃紧（同志 09-27 定按史实算）。京官整组重定工作量大，列在末尾。', '',
    '## 单个职位', '', '| 职位 | 改前 | 改后 | 可信度 | 理由 | 依据 |', '| --- | --- | --- | --- | --- | --- |', ...officeRows, '',
    '## 诸节度使', '', JIEDU.why + '（可信度 ' + JIEDU.confidence + '）依据：' + quotesOf(JIEDU.quotes), '',
    '改为钱/粮/布 ' + fmt(JIEDU.to) + '：' + jieduDone.join('、') + '。', '',
    jieduSkipped.length ? '俸给不是标准数、未改：' + jieduSkipped.join('、') + '。' : '唐廷诸节度使俸给原都是标准数，全部改了。', '',
    '## 军饷', '', '| 部队 | 兵数 | 改动 | 可信度 | 理由 | 依据 |', '| --- | --- | --- | --- | --- | --- |', ...troopRows, '',
    '## 不改的建议', '', '| 编号 | 对象 | 建议 | 唐廷每月开支变化 | 不改的理由 |', '| --- | --- | --- | --- | --- |',
    ...NOT_APPLIED.map((r) => '| ' + r.id + ' | ' + r.target + ' | ' + r.proposal + ' | ' + r.impact + ' | ' + r.reason + ' |')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();

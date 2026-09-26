// 晚唐剧本·官俸（阶段三第十二刀）
//
// 官俸按职位的 monthlyPay（钱、粮、布）逐月支给，财政引擎与公帑都读它（salary 与 monthlyPay.money 同值）。
// 核查逐类对照会昌后百官俸钱，这里只改两处明显离谱的（data/tang-pay.js）；会动开局财政平衡的建议只写进报告。
// 职位在剧本里有三份（唐廷势力的 officeTree、顶层 officeTree、officeRegistryByFaction.唐朝廷），三份一向相同，一并改。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-pay.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const { FIXES, NOT_APPLIED } = require(path.join(DIR, 'data/tang-pay.js'));

const FACTION = '唐朝廷';
const PAY_KEYS = ['money', 'grain', 'cloth'];

// 一棵官制树里名为 name 的职位（须恰有一个）
function positionIn(tree, name, label) {
  const found = [];
  (function walk(nodes) {
    (nodes || []).forEach((node) => {
      (node.positions || []).forEach((p) => { if (p.name === name) found.push(p); });
      walk(node.subs || node.children || node.subDepts || []);
    });
  })(tree);
  if (found.length !== 1) throw new Error(label + ' 里「' + name + '」有 ' + found.length + ' 个');
  return found[0];
}

// 三份职位，核对三份的俸给一致
function copiesOf(scenario, name) {
  const faction = scenario.factions.find((f) => f.name === FACTION);
  const trees = [[faction.officeTree, '唐廷势力 officeTree'], [scenario.officeTree, '顶层 officeTree'], [scenario.officeRegistryByFaction[FACTION], 'officeRegistryByFaction']];
  const copies = trees.map(([tree, label]) => positionIn(tree, name, label));
  const text = JSON.stringify({ salary: copies[0].salary, monthlyPay: copies[0].monthlyPay });
  if (copies.some((p) => JSON.stringify({ salary: p.salary, monthlyPay: p.monthlyPay }) !== text)) throw new Error(name + ' 三份俸给已不一致，核对后再改');
  if (copies[0].salary !== copies[0].monthlyPay.money) throw new Error(name + ' 的 salary 与月给钱数不同');
  return copies;
}

const fmt = (pay) => PAY_KEYS.map((k) => pay[k]).join('/');

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  const rows = FIXES.map((fix) => {
    if (!(fix.quotes || []).length) throw new Error(fix.office + ' 没有附原文');
    const copies = copiesOf(scenario, fix.office);
    const before = Object.assign({}, copies[0].monthlyPay);
    const pay = fix.like ? Object.assign({}, copiesOf(scenario, fix.like)[0].monthlyPay) : fix.monthlyPay;
    PAY_KEYS.forEach((k) => { if (typeof pay[k] !== 'number') throw new Error(fix.office + ' 缺 ' + k); });
    if (fmt(pay) === fmt(before)) throw new Error(fix.office + ' 已是 ' + fmt(pay));
    copies.forEach((p) => {
      p.salary = pay.money;
      p.monthlyPay = Object.assign({}, p.monthlyPay, pay);
    });
    return '| ' + fix.office + ' | ' + fmt(before) + ' | ' + fmt(pay) + (fix.like ? '（同' + fix.like + '）' : '') + ' | ' + fix.confidence + ' | ' + fix.why + ' | ' +
      fix.quotes.map((q) => q.source + '：「' + q.text + '」').join('；') + ' |';
  });

  const report = ['# 晚唐·官俸报告', '',
    '改 ' + FIXES.length + ' 处明显离谱的官俸（钱/粮/布，每月），三份职位一并改；核查提出的其余 ' + NOT_APPLIED.length + ' 条建议会动开局财政平衡或把握不足，不改，列在后面。', '',
    '## 改动', '', '| 职位 | 改前 | 改后 | 可信度 | 理由 | 依据 |', '| --- | --- | --- | --- | --- | --- |', ...rows, '',
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

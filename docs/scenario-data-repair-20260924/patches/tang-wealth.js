// 晚唐剧本·人物家产（阶段三第十一刀）
//
// 83 人的家产与每月家用原是几组套写的数（十人一律 320、三十人一律 3530、外藩贵人与日本公卿一律 1275），观察使还有套了中书舍人的。
// 按开局身份分层，层基线取同层锚点（剧本里逐人写定的人物）的中位数；史料有开局前涉及家财的行迹才乘倍数（data/tang-wealth.js）。
// 只改钱、粮、布、珍宝、奴婢与家用，田产、商铺、债务等其余字段不动。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-wealth.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const { TIERS, PEOPLE } = require(path.join(DIR, 'data/tang-wealth.js'));

const WEALTH_KEYS = ['money', 'grain', 'cloth', 'treasure', 'slaves'];
const HOUSEHOLD_KEYS = ['money', 'grain', 'cloth'];
const LADDER = [3, 2, 0.7, 0.5, 0.3];

const tidy = (x) => Number(x.toPrecision(12));
const roundTo = (x, unit) => Math.round(tidy(x) / unit) * unit;

// 层基线乘倍数后按规整规则应得的数
function expected(median, factor) {
  const wealth = {};
  WEALTH_KEYS.forEach((k) => { wealth[k] = roundTo(median[k] * factor, k === 'treasure' ? 10 : 1); });
  if (median.slaves >= 1 && wealth.slaves < 1) wealth.slaves = 1;
  const household = {};
  HOUSEHOLD_KEYS.forEach((k) => { household[k] = Math.round(tidy(median.household[k] * factor * 100)) / 100; });
  return { wealth, household };
}

const householdOf = (c) => ((c.economyConfig || {}).expenseStreams || []).filter((s) => s.kind === 'household');
const fmtWealth = (w) => WEALTH_KEYS.map((k) => w[k]).join('/');
const fmtHousehold = (h) => HOUSEHOLD_KEYS.map((k) => h[k]).join('/');

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  const seen = new Set();
  const rows = PEOPLE.map((p) => {
    if (seen.has(p.id)) throw new Error(p.name + ' 重复');
    seen.add(p.id);
    const tier = TIERS[p.tier];
    if (!tier) throw new Error(p.name + ' 的层「' + p.tier + '」不存在');
    const c = scenario.characters.find((x) => x.id === p.id);
    if (!c || c.name !== p.name) throw new Error('找不到 ' + p.name + '（' + p.id + '）');
    const pw = c.resources.privateWealth;
    const streams = householdOf(c);
    if (streams.length !== 1) throw new Error(p.name + ' 的家用应恰有一项，现有 ' + streams.length + ' 项');

    // 现值须与数据所记改前的数相符，免得覆盖别处已改过的数
    WEALTH_KEYS.forEach((k) => { if (pw[k] !== p.was.wealth[k]) throw new Error(p.name + ' 的 ' + k + ' 现为 ' + pw[k] + '，数据记为 ' + p.was.wealth[k]); });
    HOUSEHOLD_KEYS.forEach((k) => { if (streams[0].monthly[k] !== p.was.household[k]) throw new Error(p.name + ' 的家用 ' + k + ' 现为 ' + streams[0].monthly[k]); });

    // 数值须由层基线与行迹倍数按规则算出
    p.adjustments.forEach((a) => {
      if (!LADDER.includes(a.factor)) throw new Error(p.name + ' 的倍数 ' + a.factor + ' 不在档位里');
      if (!a.text) throw new Error(p.name + ' 的行迹没有附原文');
    });
    const factor = p.adjustments.reduce((f, a) => f * a.factor, 1);
    const want = expected(tier.median, factor);
    if (fmtWealth(want.wealth) !== fmtWealth(p.wealth) || fmtHousehold(want.household) !== fmtHousehold(p.household)) {
      throw new Error(p.name + ' 的数与规则不符：应为 ' + fmtWealth(want.wealth) + '；' + fmtHousehold(want.household));
    }

    WEALTH_KEYS.forEach((k) => { pw[k] = p.wealth[k]; });
    HOUSEHOLD_KEYS.forEach((k) => { streams[0].monthly[k] = p.household[k]; });

    const why = p.adjustments.length
      ? p.adjustments.map((a) => '×' + a.factor + ' ' + a.why + '（' + a.source + '：「' + a.text + '」）').join('；')
      : '查无开局前涉财行迹，取层基线';
    return '| ' + p.name + ' | ' + (c.officialTitle || c.title || '') + ' | ' + p.tier + ' | ' + fmtWealth(p.was.wealth) + '；' + fmtHousehold(p.was.household) +
      ' | ' + fmtWealth(p.wealth) + '；' + fmtHousehold(p.household) + ' | ×' + tidy(factor) + ' | ' + why + ' | ' + p.confidence + ' |';
  });

  const tierRows = Object.keys(TIERS).map((name) => {
    const t = TIERS[name];
    const n = PEOPLE.filter((p) => p.tier === name).length;
    return '| ' + name + ' | ' + n + ' | ' + t.anchors.join('、') + ' | ' + fmtWealth(t.median) + '；' + fmtHousehold(t.median.household) + ' | ' + t.why + ' |';
  });

  const adjusted = PEOPLE.filter((p) => p.adjustments.length).length;
  const report = ['# 晚唐·人物家产报告', '',
    '改 ' + PEOPLE.length + ' 人的家产（钱/粮/布/珍宝/奴婢）与每月家用（钱/粮/布）：按开局身份分 ' + Object.keys(TIERS).length + ' 层，层基线取同层锚点中位数；' +
      '有开局前涉财行迹、附原文的 ' + adjusted + ' 人乘倍数，其余 ' + (PEOPLE.length - adjusted) + ' 人取层基线。', '',
    '## 分层', '', '| 层 | 人数 | 锚点 | 基线（钱/粮/布/珍宝/奴婢；家用钱/粮/布） | 说明 |', '| --- | --- | --- | --- | --- |', ...tierRows, '',
    '## 逐人', '', '| 人物 | 开局官职 | 层 | 改前 | 改后 | 倍数 | 依据 | 可信度 |', '| --- | --- | --- | --- | --- | --- | --- | --- |', ...rows];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();

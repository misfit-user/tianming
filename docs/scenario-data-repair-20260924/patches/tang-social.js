// 晚唐剧本·外藩阶层处境（阶段三第八刀）
//
// 外藩各块的阶层处境（socialConditions）是按势力整套照抄的：一个势力一两套行，套给每一块。于是清海镇的商船户出现在新罗九州，
// 通日本新罗海道的入海商户出现在不临海的上京，金山草原套着渔猎家户，改挂来的碛地还带着「谷物、林产与渡运」的聚落模板。
// 这里只改确实错的（data/tang-social.js）：专属某地或某类地的行只留在该地；改挂来的通用模板与地貌不合的，换成本家（或邻境同类）已有的一套。
// 只在剧本已有的行之间删、搬，行名、满意度、权重原样，不造新行新数；唯一改字的是渤海西京一行缘由（数值不动）。
// 每块的阶层处境在剧本里有三份（行政树地块、map.regions 与 mapData.regions 的 data），三份一向相同，一并改。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-social.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const { CHANGES, UNCHANGED } = require(path.join(DIR, 'data/tang-social.js'));
const lib = require(path.join(DIR, 'patches/tang-foreign-lib.js'));

const ACTIONS = ['remove', 'addRows', 'replaceList', 'reason'];
const MIN_ROWS = 2;

const clone = (x) => JSON.parse(JSON.stringify(x));
const names = (sc) => sc.classes.map((c) => c.className);

// 按权重的平均满意度（民心桥取阶层处境时的口径）
function weighted(sc) {
  const w = sc.classes.reduce((a, c) => a + c.weight, 0);
  return w ? Math.round((10 * sc.classes.reduce((a, c) => a + c.satisfaction * c.weight, 0)) / w) / 10 : 0;
}

// 地块及其阶层处境的三份副本
function holdersOf(scenario, leafId) {
  const { treeKey, leaf } = lib.findLeaf(scenario, leafId);
  const regions = [scenario.map.regions, scenario.mapData.regions].map((list) => list.find((r) => r.id === leaf.mapRegionId));
  if (regions.some((r) => !r || !r.data)) throw new Error(leaf.name + ' 在地图上缺地块数据');
  const text = JSON.stringify(leaf.socialConditions);
  if (regions.some((r) => JSON.stringify(r.data.socialConditions) !== text)) throw new Error(leaf.name + ' 的三份阶层处境已不一致，核对后再改');
  return { treeKey, leaf, regions };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  const before = new Map();   // 地块 id → 改前的行名与平均满意度
  const changeRows = CHANGES.map((change) => {
    if (!ACTIONS.includes(change.action)) throw new Error('未知动作 ' + change.action);
    if (!(change.quotes || []).length) throw new Error(change.faction + ' 的改动没有附原文');
    const source = change.from ? holdersOf(scenario, change.from).leaf.socialConditions : null;
    if (change.from && CHANGES.some((c) => c.leaves.includes(change.from))) throw new Error('参照地块 ' + change.from + ' 自己也在改动之列');
    const pick = (className) => {
      const row = source.classes.find((c) => c.className === className);
      if (!row) throw new Error('参照地块 ' + change.from + ' 没有「' + className + '」');
      return clone(row);
    };

    const leafNames = change.leaves.map((leafId) => {
      const { treeKey, leaf, regions } = holdersOf(scenario, leafId);
      if (treeKey !== change.faction) throw new Error(leaf.name + ' 现属 ' + treeKey + '，数据写的是 ' + change.faction);
      const sc = leaf.socialConditions;
      if (!before.has(leafId)) before.set(leafId, { faction: treeKey, name: leaf.name, rows: names(sc).join('、'), avg: weighted(sc) });

      if (change.action === 'remove') {
        change.classNames.forEach((n) => { if (!names(sc).includes(n)) throw new Error(leaf.name + ' 没有「' + n + '」可删'); });
        sc.classes = sc.classes.filter((c) => !change.classNames.includes(c.className));
      } else if (change.action === 'addRows') {
        change.classNames.forEach((n) => {
          if (names(sc).includes(n)) throw new Error(leaf.name + ' 已有「' + n + '」');
          sc.classes.push(pick(n));
        });
      } else if (change.action === 'replaceList') {
        if (names(source).join('、') !== change.classNames.join('、')) throw new Error('参照地块 ' + change.from + ' 的行是 ' + names(source).join('、') + '，数据写的是 ' + change.classNames.join('、'));
        leaf.socialConditions = clone(source);
      } else {
        if (change.classNames.length !== 1 || !change.reason) throw new Error('改缘由须只写一行并给出新缘由');
        const row = sc.classes.find((c) => c.className === change.classNames[0]);
        if (!row) throw new Error(leaf.name + ' 没有「' + change.classNames[0] + '」');
        row.reason = change.reason;
      }

      regions.forEach((r) => { r.data.socialConditions = clone(leaf.socialConditions); });
      return leaf.name;
    });

    const verb = { remove: '删去', addRows: '搬入', replaceList: '整套换成', reason: '改缘由' }[change.action];
    const what = change.action === 'replaceList' ? lib.findLeaf(scenario, change.from).leaf.name + ' 那套（' + change.classNames.join('、') + '）'
      : change.action === 'addRows' ? change.classNames.join('、') + '（取自 ' + lib.findLeaf(scenario, change.from).leaf.name + '）'
        : change.action === 'reason' ? change.classNames[0] + '：「' + change.reason + '」' : change.classNames.join('、');
    return '| ' + change.faction + ' | ' + leafNames.join('、') + ' | ' + verb + ' ' + what + ' | ' + change.confidence + ' | ' + change.why + ' | ' +
      change.quotes.map((q) => q.source + '：「' + q.text + '」').join('；') + ' |';
  });

  // 删、搬之后每块仍至少两行，行名不重
  before.forEach((b, id) => {
    const sc = lib.findLeaf(scenario, id).leaf.socialConditions;
    if (sc.classes.length < MIN_ROWS) throw new Error(b.name + ' 改后不足 ' + MIN_ROWS + ' 行');
    if (new Set(names(sc)).size !== sc.classes.length) throw new Error(b.name + ' 改后行名重复');
  });

  // 清海镇的船户只在武州
  const holdersWith = (className) => [...before.keys()].concat(['武州地区']).filter((id) => names(lib.findLeaf(scenario, id).leaf.socialConditions).includes(className));
  const qinghai = holdersWith('清海商船户');
  if (qinghai.join() !== '武州地区') throw new Error('清海商船户仍在 ' + qinghai.join('、'));

  const leafRows = [...before.keys()].map((id) => {
    const b = before.get(id);
    const sc = lib.findLeaf(scenario, id).leaf.socialConditions;
    return '| ' + b.faction + ' | ' + b.name + ' | ' + b.rows + ' | ' + names(sc).join('、') + ' | ' + b.avg + ' → ' + weighted(sc) + ' |';
  });

  const report = ['# 晚唐·外藩阶层处境报告', '',
    '改动 ' + CHANGES.length + ' 条，涉及 ' + before.size + ' 块（' + [...new Set(CHANGES.map((c) => c.faction))].join('、') + '）；其余势力照旧，理由见文末。' +
      '只在剧本已有的行之间删、搬，行名、满意度、权重原样；唯一改字的是渤海西京「入海商户」的缘由。平均满意度按权重计。', '',
    '## 改动', '', '| 势力 | 地块 | 改动 | 可信度 | 理由 | 依据 |', '| --- | --- | --- | --- | --- | --- |', ...changeRows, '',
    '## 各块改前改后', '', '| 势力 | 地块 | 改前各行 | 改后各行 | 平均满意度 |', '| --- | --- | --- | --- | --- |', ...leafRows, '',
    '## 未改的势力', '', '| 势力 | 理由 |', '| --- | --- |', ...Object.keys(UNCHANGED).map((f) => '| ' + f + ' | ' + UNCHANGED[f] + ' |')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();

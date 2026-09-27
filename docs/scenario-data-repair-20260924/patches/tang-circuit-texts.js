// 晚唐剧本·外藩各道描述（阶段三第七刀之二）
//
// 日本八道、吐蕃五道、回鹘三道的描述，是把本势力的总述照抄到每一道；黑水、室韦、吕宋、下缅甸、环王、湄公河上游各两道共用一段；
// 回鹘「金山诸部」与南诏「诸节度都督」两道写的是第六刀之一留下的改道说明，南诏「十睑」写的是王都概况。
// 核查时发现同一势力内有四块挂错了道（名为弥臣的地块挂在孟人诸港道、勃固反挂在弥臣道，嗢昆水挂在仙娥河道，
// 滨河上游诸城与哈里奔猜同在滨河谷地却分在两道），先按经纬改挂，再逐道重写：只写这一道的范围与所辖地块、治理结构和开局时的实情，每句事实附原文；史料稀少处标低可信度，宁短勿编
// （data/tang-circuit-texts.js）。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-circuit-texts.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const { MOVES, CIRCUITS } = require(path.join(DIR, 'data/tang-circuit-texts.js'));
const { assertLedgersAreEnginePreview, refreshLedgers } = require(path.join(DIR, 'patches/tang-redistribute.js'));
const lib = require(path.join(DIR, 'patches/tang-foreign-lib.js'));

const MIN_CHARS = 60;
const MAX_CHARS = 180;

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  const trees = Object.keys(scenario.adminHierarchy).filter((k) => k !== 'player' && !/^唐/.test(k));
  assertLedgersAreEnginePreview(scenario, trees);

  // 同一势力内改挂：行政树、地图、省道登记与诸库（不跨势力，财政账不动）
  const moveRows = MOVES.map(([leafId, toCircuitId, why]) => {
    const before = lib.findLeaf(scenario, leafId);
    const to = lib.findCircuit(scenario, toCircuitId);
    if (before.treeKey !== to.treeKey) throw new Error(leafId + ' 改挂要跨势力，本补丁只做同一势力内的改挂');
    if (before.circuit.id === toCircuitId) throw new Error(leafId + ' 已在 ' + to.circuit.name);
    const moved = lib.moveLeaf(scenario, leafId, toCircuitId);
    return '| ' + moved.leaf.name + ' | ' + moved.to + ' | ' + moved.fromCircuit + ' | ' + moved.toCircuit + ' | ' + why + ' |';
  });

  const rows =Object.keys(CIRCUITS).map((id) => {
    const spec = CIRCUITS[id];
    const { treeKey, circuit } = lib.findCircuit(scenario, id);
    if (treeKey !== spec.faction || circuit.name !== spec.name) throw new Error(id + ' 现为 ' + treeKey + '·' + circuit.name + '，数据写的是 ' + spec.faction + '·' + spec.name);
    const n = [...spec.description].length;
    if (n < MIN_CHARS || n > MAX_CHARS) throw new Error(spec.name + ' 的描述 ' + n + ' 字，应在 ' + MIN_CHARS + '～' + MAX_CHARS + ' 字之间');
    if (!(spec.quotes || []).length) throw new Error(spec.name + ' 没有附原文');
    const before = circuit.description || '';
    circuit.description = spec.description;
    return { spec, before };
  });

  // 有两道以上的外藩：各道描述互不相同，也不照抄势力总述
  Object.keys(scenario.adminHierarchy).filter((k) => k !== 'player' && !/^唐/.test(k)).forEach((key) => {
    const divisions = scenario.adminHierarchy[key].divisions;
    if (divisions.length < 2) return;
    const faction = lib.factionByName(scenario, key);
    const seen = new Set();
    divisions.forEach((c) => {
      if (c.description === faction.description) throw new Error(key + '·' + c.name + ' 仍照抄势力总述');
      if (seen.has(c.description)) throw new Error(key + ' 有两道描述相同');
      seen.add(c.description);
    });
  });

  // 开局账照引擎重算（同一势力内改挂，各块数值不变），府州写回地块 data 与 mapData
  refreshLedgers(scenario, trees);

  const clip = (s, n) => ([...s].length > n ? [...s].slice(0, n).join('') + '……' : s);
  const report = ['# 晚唐·外藩各道描述报告', '',
    '同一势力内改挂 ' + moveRows.length + ' 块；重写 ' + rows.length + ' 道（' + [...new Set(rows.map((r) => r.spec.faction))].map((f) => f + ' ' + rows.filter((r) => r.spec.faction === f).length).join('、') + '）。' +
      '只写范围与所辖地块、治理结构和开局时（开成五年正月十四日）的实情，每句事实附原文；可信度 L 的是史料稀少、据铭文或考古的二手研究。', '',
    '## 改挂', '', '| 地块 | 势力 | 原道 | 改挂到 | 依据 |', '| --- | --- | --- | --- | --- |', ...moveRows, '',
    '## 各道描述', '', '| 势力 | 道 | 原描述 | 新描述 | 可信度 | 依据 |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(({ spec, before }) => '| ' + spec.faction + ' | ' + spec.name + ' | ' + clip(before, 24) + ' | ' + spec.description + ' | ' + spec.confidence + ' | ' +
      spec.quotes.map((q) => q.source + '：「' + q.text + '」').join('；') + ' |')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();

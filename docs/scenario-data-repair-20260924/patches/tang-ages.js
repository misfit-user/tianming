// 晚唐剧本·年龄无考的人物（阶段三第九刀）
//
// 补入的人物年龄无考时取了常值（官员、将领、君长 55 岁，王子、特勒 35 岁），外藩原有人物也有十余人年龄没有原文依据。
// 逐人按史载生年、卒年享年、及第年、任官年代、亲属的顺序推估开局年龄（data/tang-ages.js），都推不出的保留现值。
// 补入的人物，健康原是按常值年龄算的，年龄改后按同一算法重算；原有人物的健康是逐人写的，不动。
// 本刀须在才具五常一刀之前跑：才具按年龄做少、老的折减。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-ages.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const { CHANGES, KEPT } = require(path.join(DIR, 'data/tang-ages.js'));

// 与 tang-people.js、tang-foreign-newpeople.js 补人时的算法相同
function healthByAge(age) { return age >= 65 ? 70 : age >= 55 ? 76 : age >= 45 ? 82 : 86; }

const METHODS = { recorded: '史载年岁', 'death-age': '卒年享年', 'degree-year': '及第年', career: '任官年代', kinship: '亲属' };

function characterOf(scenario, spec) {
  const found = spec.id ? scenario.characters.filter((c) => c.id === spec.id) : scenario.characters.filter((c) => c.name === spec.name);
  if (found.length !== 1 || found[0].name !== spec.name) throw new Error('找不到 ' + spec.name);
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

  let healthChanged = 0;
  const rows = CHANGES.map((spec) => {
    const c = characterOf(scenario, spec);
    if (!(spec.method in METHODS)) throw new Error(spec.name + ' 的推法「' + spec.method + '」不在列');
    if (!(spec.quotes || []).length) throw new Error(spec.name + ' 没有附原文');
    if (c.age !== spec.from) throw new Error(spec.name + ' 现为 ' + c.age + ' 岁，数据记为 ' + spec.from);
    if (!Number.isInteger(spec.to) || spec.to < 10 || spec.to > 90) throw new Error(spec.name + ' 的年龄 ' + spec.to + ' 不合理');
    if (spec.birthYear !== undefined && spec.birthYear !== 839 - spec.to) throw new Error(spec.name + ' 的生年与年龄不合 839 − 生年');

    let health = '';
    if (spec.scope === '新补常值' && spec.from !== null && c.health === healthByAge(spec.from)) {
      const next = healthByAge(spec.to);
      if (next !== c.health) { health = c.health + '→' + next; healthChanged += 1; }
      c.health = next;
    }
    c.age = spec.to;
    if (spec.birthYear !== undefined) c.birthYear = spec.birthYear;

    return '| ' + spec.name + ' | ' + c.faction + ' | ' + (spec.from === null ? '无' : spec.from) + ' → ' + spec.to + (spec.birthYear !== undefined ? '（生 ' + spec.birthYear + '）' : '') +
      ' | ' + METHODS[spec.method] + ' | ' + spec.confidence + ' | ' + health + ' | ' + spec.basis + ' | ' + spec.quotes.map((q) => q.source + '：「' + q.text + '」').join('；') + ' |';
  });

  const keptRows = KEPT.map((k) => {
    const c = characterOf(scenario, k);
    if (c.age !== k.age) throw new Error(k.name + ' 现为 ' + c.age + ' 岁，数据记为 ' + k.age);
    return '| ' + k.name + ' | ' + c.faction + ' | ' + k.age + ' | ' + k.why + ' |';
  });

  const report = ['# 晚唐·年龄无考人物报告', '',
    '改 ' + CHANGES.length + ' 人的开局年龄（' + Object.keys(METHODS).map((m) => METHODS[m] + ' ' + CHANGES.filter((s) => s.method === m).length).filter((s) => !/ 0$/.test(s)).join('、') +
      '），补入人物的健康随年龄重算 ' + healthChanged + ' 人；查无可推、保留现值 ' + KEPT.length + ' 人。开局周岁 = 839 − 生年；任官年代按最早一条有年份的任官取典型年龄，都是推估，只改年龄不写生年。', '',
    '## 改动', '', '| 人物 | 势力 | 年龄 | 推法 | 可信度 | 健康 | 依据 | 原文 |', '| --- | --- | --- | --- | --- | --- | --- | --- |', ...rows, '',
    '## 保留现值', '', '| 人物 | 势力 | 年龄 | 理由 |', '| --- | --- | --- | --- |', ...keptRows];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();

// 晚唐剧本·外藩人物（阶段三第六刀之二）
//
// 外藩虚构人物一百六十一人，东亚、西路两份核查（sources/tang-research/foreign-east.json、foreign-west-south.json 的 fictional 一节）
// 逐人查过，全是按模板起名的批量地方代表（「潢水·白结」「牙帐·白笔」之类），没有一个是首领；其中二十余人挂着官职或统兵。
// 同志 09-24 定：砍掉批量地方代表。撤销拼盘势力时已随势力删去 15 人，本补丁删去其余，一切引用照唐廷那一刀收拾
// （统兵官空缺不另编人名、官职改为「未记在任者」、关系、阶层代表、物品、家户、恩怨、家产登记删去）。
// 已有史实人物按核查改正年龄、官衔、文化与名字写法（data/tang-foreign-people.js，逐条附依据与可信度）。
// 补入史实人物在下一刀。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-foreign-people.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const WUCHANG_FILE = path.join(REPO, 'web/assets/reference/tang840-wuchang.json');
const lib = require(path.join(DIR, 'patches/tang-foreign-lib.js'));
const { FIXES, TEXT_FIXES, BIO_FIXES } = require(path.join(DIR, 'data/tang-foreign-people.js'));
const { FACTION_RENAMES } = require(path.join(DIR, 'data/tang-foreign.js'));

const TANG = /^唐/;
const EXPECTED_REPS = 146;
// 批量代表简名里与常用词相同的，不当人名删句
const COMMON_WORDS = new Set(['甘露', '两川']);

function sameFormat(raw, obj) {
  let out = JSON.stringify(obj, null, /^\{\r?\n {2}"/.test(raw) ? 2 : 0);
  if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
  if (/\r?\n$/.test(raw)) out += raw.includes('\r\n') ? '\r\n' : '\n';
  return out;
}

// 改名：全剧本字符串里的旧名一律换成新名（史料引文照录原文不动）
function swapText(node, from, to, counter) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      if (typeof v === 'string') { if (v.includes(from)) { node[i] = v.split(from).join(to); counter.n += 1; } } else if (v && typeof v === 'object') swapText(v, from, to, counter);
    });
    return;
  }
  if (Object.keys(node).some((k) => k.includes(from))) {
    const entries = Object.entries(node);
    Object.keys(node).forEach((k) => { delete node[k]; });
    entries.forEach(([k, v]) => { node[k.split(from).join(to)] = v; });
  }
  Object.keys(node).forEach((k) => {
    if (lib.QUOTE_KEYS.has(k)) return;
    const v = node[k];
    if (typeof v === 'string') { if (v.includes(from)) { node[k] = v.split(from).join(to); counter.n += 1; } } else if (v && typeof v === 'object') swapText(v, from, to, counter);
  });
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  const wuchangRaw = fs.readFileSync(WUCHANG_FILE, 'utf8');
  const wuchang = JSON.parse(wuchangRaw);

  // ---- 1. 批量地方代表：外藩虚构人物，逐一对上两份核查的名单 ----
  const renamedFaction = new Map(FACTION_RENAMES.map(([from, to]) => [from, to]));
  const listed = new Map();
  ['foreign-east.json', 'foreign-west-south.json'].forEach((file) => {
    const research = JSON.parse(fs.readFileSync(path.join(DIR, 'sources/tang-research', file), 'utf8'));
    research.fictional.forEach((f) => listed.set(f.name, { kind: f.kind, faction: renamedFaction.get(f.faction) || f.faction, reason: f.reason }));
  });
  const reps = scenario.characters.filter((c) => !TANG.test(c.faction) && c.isFictional);
  reps.forEach((c) => {
    const entry = listed.get(c.name);
    if (!entry || entry.kind !== 'batch-rep') throw new Error(c.name + '（' + c.faction + '）不在核查的批量代表名单里');
  });
  if (reps.length !== EXPECTED_REPS) throw new Error('外藩批量代表应为 ' + EXPECTED_REPS + ' 人，实得 ' + reps.length);
  const officeRows = [];
  const officeHolders = new Map();
  const walkOffices = (faction, nodes) => (nodes || []).forEach((o) => {
    (o.positions || []).forEach((p) => { if (p.holder) officeHolders.set(p.holder, (officeHolders.get(p.holder) || []).concat(faction + '·' + (o.name || '') + '·' + (p.name || ''))); });
    walkOffices(faction, o.subs || o.children);
  });
  scenario.factions.forEach((f) => walkOffices(f.name, f.officeTree));
  const troopRows = [];
  scenario.military.initialTroops.forEach((t) => { if (reps.some((c) => c.name === t.commander)) troopRows.push('| ' + t.faction + ' | ' + t.name + ' | ' + t.commander + ' |'); });
  reps.forEach((c) => { (officeHolders.get(c.name) || []).forEach((o) => officeRows.push('| ' + c.name + ' | ' + o + ' |')); });
  const counts = {};
  const bump = (key, n) => { counts[key] = (counts[key] || 0) + (n === undefined ? 1 : n); };
  const byFaction = {};
  reps.forEach((c) => { (byFaction[c.faction] = byFaction[c.faction] || []).push(c.name); });
  const { ids, names } = lib.removeCharacters(scenario, wuchang, reps, bump);
  TEXT_FIXES.forEach(([troop, from, to]) => {
    const t = scenario.military.initialTroops.find((x) => x.name === troop);
    if (!t || !t.description.includes(from)) throw new Error(troop + ' 的说明里没有「' + from + '」');
    t.description = t.description.split(from).join(to);
    bump('军队说明里顺带提到的代表改写');
  });

  // ---- 2. 史实人物改正 ----
  const fixRows = [];
  FIXES.forEach((fix) => {
    const c = scenario.characters.find((x) => x.name === fix.name);
    if (!c) throw new Error('人物表里没有 ' + fix.name);
    const changes = [];
    if (fix.rename) {
      const counter = { n: 0 };
      (fix.swaps || [[fix.name, fix.rename]]).forEach(([from, to]) => {
        swapText(scenario, from, to, counter);
        Object.values(wuchang.characters).forEach((w) => swapText(w, from, to, counter));
      });
      if (c.name !== fix.rename) throw new Error(fix.name + ' 换名后为 ' + c.name);
      changes.push('名 ' + fix.name + '→' + fix.rename + '（' + counter.n + ' 处）');
    }
    if (fix.aliases) { changes.push('别名 ' + JSON.stringify(c.aliases || []) + '→' + JSON.stringify(fix.aliases)); c.aliases = fix.aliases.slice(); }
    if (fix.age !== undefined) { changes.push('年龄 ' + c.age + '→' + fix.age); c.age = fix.age; }
    if (fix.title) {
      changes.push('称衔 ' + c.title + '→' + fix.title);
      ['role', 'occupation'].forEach((k) => { if (c[k] === c.title) c[k] = fix.title; });
      c.title = fix.title;
    }
    if (fix.officialTitle) { changes.push('官称 ' + c.officialTitle + '→' + fix.officialTitle); c.officialTitle = fix.officialTitle; }
    if (fix.culture !== undefined) { changes.push('文化 ' + c.culture + '→' + fix.culture); c.culture = fix.culture; }
    if (fix.location) {
      const region = scenario.map.regions.find((r) => r.name === fix.location && r.owner === c.faction);
      if (!region) throw new Error(fix.location + ' 不是 ' + c.faction + ' 的地块');
      changes.push('所在 ' + c.location + '→' + fix.location);
      c.location = fix.location;
      if ('locationId' in c) c.locationId = region.id;
    }
    fixRows.push('| ' + (fix.rename || fix.name) + ' | ' + c.faction + ' | ' + changes.join('；') + ' | ' + fix.why + ' |');
  });

  // ---- 3. 生平与说明里围绕批量代表编的句子（在改名之后，按新名找人） ----
  BIO_FIXES.forEach(([who, from, to]) => {
    const target = who.startsWith('势力:') ? lib.factionByName(scenario, who.slice(3)) : scenario.characters.find((c) => c.name === who);
    if (!target) throw new Error('没有 ' + who);
    const counter = { n: 0 };
    swapText(target, from, to, counter);
    if (!counter.n) throw new Error(who + ' 的文字里没有「' + from.slice(0, 20) + '」');
    bump('生平与说明里围绕代表的句子删改', counter.n);
  });

  // ---- 4. 外藩地块、城市、道的描述里编进代表名字的分句删去（剩下的地理与生计描写照留） ----
  // 名单取两份核查所列的全部批量代表（撤销拼盘势力时删去的也在内），全名与简名都算；地名本就含着的字（居延海的「延海」之类）不算
  const regionNames = scenario.map.regions.map((r) => r.name).join('|');
  const fragments = new Set();
  listed.forEach((entry, name) => {
    [name, name.includes('·') ? name.split('·').pop() : name.length === 3 ? name.slice(1) : name.length === 4 ? name.slice(2) : '']
      .filter((x) => x.length >= 2 && !regionNames.includes(x) && !COMMON_WORDS.has(x)).forEach((x) => fragments.add(x));
  });
  const cleanText = (text) => {
    if (typeof text !== 'string' || ![...fragments].some((x) => text.includes(x))) return text;
    const kept = text.split(/(?<=[。；])/).filter((clause) => ![...fragments].some((x) => clause.includes(x)));
    let out = kept.join('');
    if (out.endsWith('；')) out = out.slice(0, -1) + '。';
    return out;
  };
  let cleaned = 0;
  const cleanField = (obj, key) => { const next = cleanText(obj[key]); if (next !== obj[key]) { obj[key] = next; cleaned += 1; } };
  const foreignRegionIds = new Set();
  Object.keys(scenario.adminHierarchy).filter((k) => k !== 'player' && !TANG.test(k)).forEach((key) => {
    scenario.adminHierarchy[key].divisions.forEach((circuit) => {
      cleanField(circuit, 'description');
      (circuit.children || []).forEach((leaf) => { cleanField(leaf, 'description'); foreignRegionIds.add(leaf.mapRegionId); });
    });
  });
  scenario.cities.forEach((c) => { if (foreignRegionIds.has(c.regionId)) cleanField(c, 'description'); });
  scenario.map.regions.forEach((r) => {
    if (!foreignRegionIds.has(r.id)) return;
    cleanField(r, 'note');
    cleanField(r, 'description');
    if (r.data) cleanField(r.data, 'description');
  });
  scenario.mapData = JSON.parse(JSON.stringify(scenario.map));
  bump('地块、城市、道描述里编进代表名字的分句删去（按字段计）', cleaned);

  // ---- 自检 ----
  const text = JSON.stringify(scenario);
  const leftIds = [...ids].filter((id) => text.includes('"' + id + '"'));
  const leftNames = [...names].filter((n) => text.includes('"' + n + '"'));
  if (leftIds.length || leftNames.length) throw new Error('仍有残留：' + leftIds.concat(leftNames).slice(0, 8).join('、'));
  const missingArchive = scenario.characters.filter((c) => !wuchang.characters[c.id]);
  if (missingArchive.length) throw new Error('五常参考档缺人：' + missingArchive.map((c) => c.name).join('、'));

  const foreignLeft = scenario.characters.filter((c) => !TANG.test(c.faction));
  const report = ['# 晚唐·外藩人物报告', '',
    '外藩批量地方代表 ' + reps.length + ' 人删去（撤销拼盘势力时已随势力删去 15 人），全剧本剩 ' + scenario.characters.length + ' 人，其中外藩 ' + foreignLeft.length + ' 人，均为史实人物；史实人物改正 ' + FIXES.length + ' 人。',
    '名单逐一对上两份核查的 fictional 一节（均判为批量代表：模板名、身份泛称、生平为剧情化生活描写）。', '',
    '## 删去的批量代表（按势力）', '', '| 势力 | 人数 | 人物 |', '| --- | --- | --- |',
    ...Object.keys(byFaction).map((f) => '| ' + f + ' | ' + byFaction[f].length + ' | ' + byFaction[f].join('、') + ' |'), '',
    '### 他们占着的官职（改为「未记在任者」）', '', '| 人物 | 官职 |', '| --- | --- |', ...officeRows, '',
    '### 他们统领的军队（统兵官空缺，说明里的人名改称「守将」）', '', '| 势力 | 军队 | 原统兵官 |', '| --- | --- | --- |', ...troopRows, '',
    '### 引用收拾', '', '| 项 | 数 |', '| --- | --- |', ...Object.keys(counts).map((k) => '| ' + k + ' | ' + counts[k] + ' |'), '',
    '## 史实人物改正', '', '| 人物 | 势力 | 改动 | 依据（可信度） |', '| --- | --- | --- | --- |', ...fixRows];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    fs.writeFileSync(WUCHANG_FILE, sameFormat(wuchangRaw, wuchang));
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE) + ' 与 ' + path.relative(REPO, WUCHANG_FILE));
  }
}

main();

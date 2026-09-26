// 晚唐剧本·引用与关系（阶段三第七刀之一）
//
// 1. 统兵官：清海镇军的统兵官写作「张保皋」，人物表作「张保皐」（别名里有张保皋），按别名认人并补上 commanderId；
//    正文里同一人的两种写法统一为人物表的名字（别名与史料引文照录原写法不动）。
// 2. 所在地：张保皐、郑年的所在写「清海镇（武州地区）」，武州块第六刀之一已改用旧名武珍州。
// 3. 势力关系：原有 54 条的说明是把对方势力的「外交作风」照抄到每一条指向它的关系上（25 种说法套在 51 条上），
//    类型和数值也多是占位的「neutral 0/5」，连相攻二十年的回鹘与黠戛斯也写作中立。按两路核查逐条改写成开局时的实际关系，
//    每条附原文（data/tang-references.js）；另补入史有明文而原缺的几条。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-references.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const R = require(path.join(DIR, 'data/tang-references.js'));
const lib = require(path.join(DIR, 'patches/tang-foreign-lib.js'));

// AI 推演提示只截取说明的前 20 字，整句也不宜过长
const DESC_MAX = 50;

function stableId(prefix, text) {
  return prefix + crypto.createHash('sha1').update('sc-tang840-840:' + text).digest('hex').slice(0, 12);
}

// 正文里的人名异写换成人物表的名字：键与值都换（人物关系表以对方名字作键），键序不变；跳过别名与史料引文
function swapName(node, from, to, counter) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      if (typeof v === 'string') {
        if (v.includes(from)) { node[i] = v.split(from).join(to); counter.n += 1; }
      } else if (v && typeof v === 'object') swapName(v, from, to, counter);
    });
    return;
  }
  if (Object.keys(node).some((k) => k.includes(from))) {
    const entries = Object.entries(node);
    Object.keys(node).forEach((k) => { delete node[k]; });
    entries.forEach(([k, v]) => { node[k.split(from).join(to)] = v; });
    counter.n += 1;
  }
  Object.keys(node).forEach((k) => {
    if (k === 'aliases' || lib.QUOTE_KEYS.has(k)) return;
    const v = node[k];
    if (typeof v === 'string') {
      if (v.includes(from)) { node[k] = v.split(from).join(to); counter.n += 1; }
    } else if (v && typeof v === 'object') swapName(v, from, to, counter);
  });
}

// 统兵官不在人物表的，按人物别名认出唯一一人，改写成人物表的名字并补 id
function fixCommanders(scenario) {
  const byName = new Map(scenario.characters.map((c) => [c.name, c]));
  const byAlias = new Map();
  scenario.characters.forEach((c) => (c.aliases || []).forEach((a) => { (byAlias.get(a) || byAlias.set(a, []).get(a)).push(c); }));
  const rows = [];
  scenario.military.initialTroops.forEach((t) => {
    if (!t.commander || byName.has(t.commander)) return;
    const hits = byAlias.get(t.commander) || [];
    if (hits.length !== 1) throw new Error(t.name + ' 的统兵官「' + t.commander + '」不在人物表，按别名也认不出唯一一人');
    rows.push('| ' + t.name + ' | ' + t.commander + ' | ' + hits[0].name + '（' + hits[0].id + '） |');
    t.commander = hits[0].name;
    t.commanderId = hits[0].id;
  });
  scenario.military.initialTroops.forEach((t) => {
    if (!t.commander) return;
    const c = byName.get(t.commander);
    if (!c || t.commanderId !== c.id) throw new Error(t.name + ' 的统兵官与 commanderId 对不上');
  });
  return rows;
}

function pairKey(a, b) { return [a, b].sort().join('⇄'); }

function checkDesc(spec) {
  if (!spec.desc || [...spec.desc].length > DESC_MAX) throw new Error(spec.from + '→' + spec.to + ' 的说明为空或超过 ' + DESC_MAX + ' 字');
  if (!R.CATEGORY[spec.category]) throw new Error(spec.from + '→' + spec.to + ' 的分类「' + spec.category + '」不认识');
  if (!(spec.quotes || []).length) throw new Error(spec.from + '→' + spec.to + ' 没有附原文');
}

function applyRelations(scenario) {
  const factions = new Set(scenario.factions.map((f) => f.name));
  const byId = new Map(scenario.factionRelations.map((r) => [r.id, r]));
  const rows = [];
  const seen = new Set();
  const typeValue = (spec) => {
    const [type, value] = R.CATEGORY[spec.category];
    return [type, spec.value !== undefined ? spec.value : value];
  };
  R.RELATIONS.forEach((spec) => {
    checkDesc(spec);
    const rel = byId.get(spec.id);
    if (!rel) throw new Error('没有这条关系：' + spec.id);
    if (rel.from !== spec.from || rel.to !== spec.to) throw new Error(spec.id + ' 原记录是 ' + rel.from + '→' + rel.to + '，数据写的是 ' + spec.from + '→' + spec.to);
    if (seen.has(spec.id)) throw new Error(spec.id + ' 写了两遍');
    seen.add(spec.id);
    const before = rel.type + ' ' + rel.value;
    const [type, value] = typeValue(spec);
    if (spec.swap) { rel.from = spec.to; rel.to = spec.from; }
    rel.type = type;
    rel.value = value;
    rel.desc = spec.desc;
    rows.push({ from: rel.from, to: rel.to, before, after: type + ' ' + value, spec });
  });
  const keep = new Set((R.KEEP || []).map(([a, b]) => a + '→' + b));
  const missed = scenario.factionRelations.filter((r) => !seen.has(r.id) && !keep.has(r.from + '→' + r.to));
  if (missed.length) throw new Error('这些关系没有改写：' + missed.map((r) => r.from + '→' + r.to).join('、'));

  R.NEW_RELATIONS.forEach((spec) => {
    checkDesc(spec);
    [spec.from, spec.to].forEach((f) => { if (!factions.has(f)) throw new Error('没有这个势力：' + f); });
    const [type, value] = typeValue(spec);
    scenario.factionRelations.push({ id: stableId('frel-', spec.from + '→' + spec.to), sid: scenario.id, from: spec.from, to: spec.to, type, value, desc: spec.desc });
    rows.push({ from: spec.from, to: spec.to, before: '（原缺）', after: type + ' ' + value, spec });
  });

  // 同一对势力只许一条（引擎查关系不分方向）
  const pairs = new Set();
  scenario.factionRelations.forEach((r) => {
    [r.from, r.to].forEach((f) => { if (!factions.has(f)) throw new Error('关系 ' + r.from + '→' + r.to + ' 的一方不是势力'); });
    const k = pairKey(r.from, r.to);
    if (pairs.has(k)) throw new Error('同一对势力有两条关系：' + k);
    pairs.add(k);
  });
  return rows;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  // 先按别名认统兵官（异写统一之后就认不出原写法了）
  const commanderRows = fixCommanders(scenario);

  const variantRows = R.NAME_VARIANTS.map(([from, to, why]) => {
    const c = scenario.characters.find((x) => x.name === to);
    if (!c) throw new Error('人物表没有 ' + to);
    if (!(c.aliases || []).includes(from)) throw new Error(to + ' 的别名里没有 ' + from);
    const counter = { n: 0 };
    swapName(scenario, from, to, counter);
    return '| ' + from + ' | ' + to + ' | ' + counter.n + ' | ' + why + ' |';
  });

  const locationRows = Object.keys(R.LOCATION_FIXES).map((name) => {
    const c = scenario.characters.find((x) => x.name === name);
    if (!c) throw new Error('人物表没有 ' + name);
    const [loc, why] = R.LOCATION_FIXES[name];
    const before = c.location;
    if (before === loc) throw new Error(name + ' 的所在已经是 ' + loc);
    c.location = loc;
    return '| ' + name + ' | ' + before + ' | ' + loc + ' | ' + why + ' |';
  });

  const relationRows = applyRelations(scenario);
  const count = (pred) => relationRows.filter(pred).length;
  const categories = {};
  relationRows.forEach((r) => { categories[r.spec.category] = (categories[r.spec.category] || 0) + 1; });

  const quoteText = (spec) => spec.quotes.map((q) => q.source + '：「' + q.text + '」').join('；');
  const report = ['# 晚唐·引用与关系报告', '',
    '统兵官 ' + commanderRows.length + ' 处按别名认人；人名异写 ' + R.NAME_VARIANTS.length + ' 组统一；所在地旧名 ' + locationRows.length + ' 处；势力关系改写 ' +
      count((r) => r.before !== '（原缺）') + ' 条、补入 ' + count((r) => r.before === '（原缺）') + ' 条（' + Object.keys(categories).map((k) => k + ' ' + categories[k]).join('、') + '）。',
    '关系分类与数值：' + Object.keys(R.CATEGORY).map((k) => k + ' ' + R.CATEGORY[k].join(' ')).join('，') + '；役属与册封朝贡以 from 为宗主。', '',
    '## 统兵官', '', '| 军队 | 原写 | 改为 |', '| --- | --- | --- |', ...commanderRows, '',
    '## 人名异写', '', '| 原写 | 统一为 | 处数 | 依据 |', '| --- | --- | --- | --- |', ...variantRows, '',
    '## 所在地', '', '| 人物 | 原所在 | 改为 | 依据 |', '| --- | --- | --- | --- |', ...locationRows, '',
    '## 势力关系', '', '| 关系 | 原 | 新 | 说明 | 可信度 | 依据 |', '| --- | --- | --- | --- | --- | --- |',
    ...relationRows.map((r) => '| ' + r.from + '→' + r.to + ' | ' + r.before + ' | ' + r.after + ' | ' + r.spec.desc + ' | ' + (r.spec.confidence || '') + ' | ' +
      (r.spec.why ? r.spec.why + '。' : '') + quoteText(r.spec) + ' |')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 4).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();

// 晚唐剧本·人物才具与五常（阶段三第七刀之三）
//
// 外藩原有的日本、新罗 15 人，才具是同一组模板值（50/50/55/40/35/45/50/50/45/50/50）；第四刀之二、第六刀之三补入的 61 人，
// 才具套的是唐廷文臣、军将中位数，五常多是同一组保守起点，四十余人数字一模一样。两路核查逐人查过本传、薨卒传与编年，
// 按 data/tang-abilities.js 的规则重定：基线加上有原文的加减，再按年龄折算；查无可据的项保持基线。
// 五常已个别评定的人，只改与原文明显相违的几处；藤原常嗣按开局前病况改健康；两处生平写错的顺手改正。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-abilities.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const WUCHANG_FILE = path.join(REPO, 'web/assets/reference/tang840-wuchang.json');
const A = require(path.join(DIR, 'data/tang-abilities.js'));
const lib = require(path.join(DIR, 'patches/tang-foreign-lib.js'));

const KEYS = ['loyalty', 'ambition', 'intelligence', 'valor', 'military', 'administration', 'management', 'charisma', 'diplomacy', 'benevolence', 'integrity'];
const LABEL = { loyalty: '忠诚', ambition: '野心', intelligence: '智力', valor: '武勇', military: '军事', administration: '政务', management: '理财', charisma: '魅力', diplomacy: '辞令', benevolence: '仁厚', integrity: '操守' };
const DIMS = ['仁', '义', '礼', '智', '信'];
const STEPS = new Set([-20, -15, -10, -5, 5, 10, 15, 20]);

function sameFormat(raw, obj) {
  let out = JSON.stringify(obj, null, /^\{\r?\n {2}"/.test(raw) ? 2 : 0);
  if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
  if (/\r?\n$/.test(raw)) out += raw.includes('\r\n') ? '\r\n' : '\n';
  return out;
}

const clamp = (v) => Math.max(10, Math.min(95, v));

// 年龄折算：小于 20 或不小于 70 的武勇、军事各减 10；小于 20 的政务、理财、辞令各减 15
function ageDelta(age) {
  const d = {};
  if (age < 20 || age >= 70) { d.valor = -10; d.military = -10; }
  if (age < 20) { d.administration = -15; d.management = -15; d.diplomacy = -15; }
  return d;
}

function computeStats(spec, age) {
  const base = A.BASELINES[spec.baseline];
  if (!base) throw new Error(spec.name + ' 的基线「' + spec.baseline + '」不认识');
  const out = Object.assign({}, base);
  spec.adjust.forEach(([attr, delta, why, source, quote]) => {
    if (!KEYS.includes(attr)) throw new Error(spec.name + ' 加减的项「' + attr + '」不认识');
    if (!STEPS.has(delta)) throw new Error(spec.name + ' 的 ' + attr + ' 加减 ' + delta + ' 不在档位内');
    if (!why || !source || !quote) throw new Error(spec.name + ' 的 ' + attr + ' 加减缺理由或原文');
    out[attr] += delta;
  });
  const ad = ageDelta(age);
  Object.keys(ad).forEach((k) => { out[k] += ad[k]; });
  KEYS.forEach((k) => { out[k] = clamp(out[k]); });
  return { stats: out, age: ad };
}

function computeWuchang(spec) {
  const out = Object.assign({}, A.WUCHANG_DEFAULT);
  spec.adjust.forEach(([dim, delta, why, source, quote]) => {
    if (!DIMS.includes(dim)) throw new Error('五常维度「' + dim + '」不认识');
    if (!STEPS.has(delta)) throw new Error('五常加减 ' + delta + ' 不在档位内');
    if (!why || !source || !quote) throw new Error('五常加减缺理由或原文');
    out[dim] += delta;
  });
  DIMS.forEach((d) => { out[d] = Math.max(0, Math.min(100, out[d])); });
  return out;
}

// 人物各文字字段里的整句替换（史料引文照录原文不动）
function swapText(node, from, to, counter) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      if (typeof v === 'string') { if (v.includes(from)) { node[i] = v.split(from).join(to); counter.n += 1; } } else if (v && typeof v === 'object') swapText(v, from, to, counter);
    });
    return;
  }
  Object.keys(node).forEach((k) => {
    if (lib.QUOTE_KEYS.has(k)) return;
    const v = node[k];
    if (typeof v === 'string') { if (v.includes(from)) { node[k] = v.split(from).join(to); counter.n += 1; } } else if (v && typeof v === 'object') swapText(v, from, to, counter);
  });
}

function setWuchang(c, entry, scores, confidence) {
  const ordered = {};
  DIMS.forEach((d) => { ordered[d] = scores[d]; });
  c.wuchangOverride = Object.assign({}, ordered);
  c.wuchangAssessment.confidence = Object.assign({}, confidence);
  entry.initialScores = Object.assign({}, ordered);
  entry.confidence = Object.assign({}, confidence);
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
  const byId = new Map(scenario.characters.map((c) => [c.id, c]));
  const byName = new Map(scenario.characters.map((c) => [c.name, c]));
  const fmt = (o) => KEYS.map((k) => o[k]).join('/');

  // ---- 1. 才具与五常逐人重定 ----
  const seen = new Set();
  const rows = A.PEOPLE.map((spec) => {
    const c = byId.get(spec.id);
    if (!c || c.name !== spec.name) throw new Error(spec.id + ' 不是 ' + spec.name);
    if (seen.has(spec.id)) throw new Error(spec.name + ' 写了两遍');
    seen.add(spec.id);
    const before = fmt(c);
    const { stats, age } = computeStats(spec, c.age);
    KEYS.forEach((k) => { c[k] = stats[k]; });
    let wuchangRow = '';
    if (spec.wuchang) {
      const entry = wuchang.characters[c.id];
      if (!entry || entry.name !== c.name) throw new Error(c.name + ' 在五常参考档里没有条目');
      if ([...spec.wuchang.note].length <= 20) throw new Error(c.name + ' 的五常评语不足 20 字');
      const scores = computeWuchang(spec.wuchang);
      const beforeW = DIMS.map((d) => entry.initialScores[d]).join('/');
      setWuchang(c, entry, scores, spec.wuchang.confidence);
      entry.note = spec.wuchang.note;
      // 原有出处（带链接的）保留，核查查过的书补在后面
      const had = new Set((entry.sources || []).map((s) => s.book));
      entry.sources = (entry.sources || []).concat(spec.wuchang.sources.filter((book) => !had.has(book)).map((book) => ({ book })));
      wuchangRow = beforeW + '→' + DIMS.map((d) => scores[d]).join('/');
    }
    const adj = spec.adjust.map(([attr, delta, why]) => LABEL[attr] + (delta > 0 ? '+' : '') + delta + '（' + why + '）');
    Object.keys(age).forEach((k) => adj.push(LABEL[k] + age[k] + '（年龄 ' + c.age + '）'));
    return { spec, c, before, after: fmt(c), adj, wuchangRow };
  });

  // ---- 2. 已个别评定的五常：与原文明显相违的几处 ----
  const fixRows = A.WUCHANG_FIXES.map(([name, dim, value, confidence, why, source, quote, noteSwap]) => {
    const c = byName.get(name);
    if (!c) throw new Error('人物表没有 ' + name);
    if (!source || !quote) throw new Error(name + ' 的五常改正缺原文');
    const entry = wuchang.characters[c.id];
    const scores = Object.assign({}, entry.initialScores);
    const old = scores[dim];
    if (old === value) throw new Error(name + ' 的' + dim + '已是 ' + value);
    scores[dim] = value;
    const conf = Object.assign({}, entry.confidence, { [dim]: confidence });
    setWuchang(c, entry, scores, conf);
    if (noteSwap) {
      if (!entry.note.includes(noteSwap[0])) throw new Error(name + ' 的五常评语里没有「' + noteSwap[0] + '」');
      entry.note = entry.note.split(noteSwap[0]).join(noteSwap[1]);
    } else {
      entry.note += '（' + why + '。）';
    }
    if (!(entry.sources || []).some((s) => s.book === source)) entry.sources = (entry.sources || []).concat([{ book: source }]);
    return '| ' + name + ' | ' + dim + ' | ' + old + ' → ' + value + ' | ' + why + ' | ' + source + '：「' + quote + '」 |';
  });

  // ---- 3. 健康 ----
  const healthRows = A.HEALTH.map(([name, value, why, source, quote]) => {
    const c = byName.get(name);
    if (!c) throw new Error('人物表没有 ' + name);
    const old = c.health;
    c.health = value;
    return '| ' + name + ' | ' + old + ' → ' + value + ' | ' + why + ' | ' + source + '：「' + quote + '」 |';
  });

  // ---- 4. 生平改正（生平、AI 人设等各文字字段一并换） ----
  const bioRows = A.BIO_FIXES.map(([name, from, to, why, source, quote]) => {
    const c = byName.get(name);
    if (!c) throw new Error('人物表没有 ' + name);
    const counter = { n: 0 };
    swapText(c, from, to, counter);
    if (!counter.n) throw new Error(name + ' 的文字里没有「' + from + '」');
    return '| ' + name + ' | ' + from + ' | ' + to + '（' + counter.n + ' 处） | ' + why + ' | ' + source + '：「' + quote + '」 |';
  });

  // ---- 自检：五常参考档与人物一致 ----
  scenario.characters.forEach((c) => {
    const entry = wuchang.characters[c.id];
    if (!entry || JSON.stringify(entry.initialScores) !== JSON.stringify(c.wuchangOverride)) throw new Error(c.name + ' 的五常与参考档不一致');
    if (JSON.stringify(Object.keys(c.wuchangOverride)) !== JSON.stringify(DIMS)) throw new Error(c.name + ' 的五常键序不对');
  });
  // 才具仍相同的，报告里列明缘故（同一基线查无可据，或恰好只有同一项同档加减）
  const groups = new Map();
  scenario.characters.forEach((c) => { const k = fmt(c); (groups.get(k) || groups.set(k, []).get(k)).push(c.name); });
  const sameGroups = [...groups.entries()].filter(([, names]) => names.length > 1);
  const plain = rows.filter((r) => r.spec.adjust.length === 0);

  const report = ['# 晚唐·人物才具与五常报告', '',
    '重定 ' + rows.length + ' 人（唐廷补入 ' + rows.filter((r) => /^唐/.test(r.c.faction)).length + '、外藩 ' + rows.filter((r) => !/^唐/.test(r.c.faction)).length + '），有可据加减的 ' +
      (rows.length - plain.length) + ' 人；查无可据、才具仍是同类基线的 ' + plain.length + ' 人（' + plain.map((r) => r.c.name).join('、') + '）。' +
      '五常原为保守起点的重做 ' + rows.filter((r) => r.wuchangRow).length + ' 人，已个别评定的改正 ' + fixRows.length + ' 处；健康 ' + healthRows.length + ' 人；生平改正 ' + bioRows.length + ' 处。',
    '规则：基线（文官、军将、君主、宫廷君主）加有原文的加减（±5/±10/±15/±20），再按年龄折算，终值夹在 10～95；能力类可用一生事迹，品性类与五常只凭开局前行事与本传评语（「后事不计入开局」）。' +
      '基线：' + Object.keys(A.BASELINES).map((k) => k + ' ' + fmt(A.BASELINES[k])).join('；') + '（项序：' + KEYS.map((k) => LABEL[k]).join('、') + '）。', '',
    '## 才具', '', '| 人物 | 势力 | 基线 | 原值 | 新值 | 加减与依据 | 五常 |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => '| ' + r.c.name + ' | ' + r.c.faction + ' | ' + r.spec.baseline + ' | ' + r.before + ' | ' + r.after + ' | ' + (r.adj.join('；') || '查无可据，保持基线') + ' | ' + (r.wuchangRow || '') + ' |'), '',
    '## 才具仍相同的人', '', '全剧本 ' + scenario.characters.length + ' 人中，才具 11 项完全相同的还有 ' + sameGroups.length + ' 组：', '',
    '| 才具 | 人物 |', '| --- | --- |', ...sameGroups.map(([k, names]) => '| ' + k + ' | ' + names.join('、') + ' |'), '',
    '## 五常改正', '', '| 人物 | 维度 | 改动 | 理由 | 原文 |', '| --- | --- | --- | --- | --- |', ...fixRows, '',
    '## 健康', '', '| 人物 | 改动 | 理由 | 原文 |', '| --- | --- | --- | --- |', ...healthRows, '',
    '## 生平改正', '', '| 人物 | 原句 | 改为 | 理由 | 原文 |', '| --- | --- | --- | --- | --- |', ...bioRows];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 4).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    fs.writeFileSync(WUCHANG_FILE, sameFormat(wuchangRaw, wuchang));
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE) + ' 与 ' + path.relative(REPO, WUCHANG_FILE));
  }
}

main();

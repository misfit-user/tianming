// 晚唐剧本·京官料钱（第十三刀）。默认只核查，--write 写回，--report <文件> 输出逐席清单。
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { QUOTES, CAPITAL_DEPARTMENTS, RULES, UNRESOLVED } = require('../data/tang-capital-pay.js');
const REPO = path.resolve(__dirname, '../../..');
const FILE = path.join(REPO, 'scenarios/晚唐·开成五年（官方）.json');
const KEYS = ['money', 'grain', 'cloth'];
const round = (v) => Number(v.toFixed(8));
const fmt = (p) => KEYS.map((k) => p[k]).join('/');

// 官制页、编辑器优先读 perPersonSalary。沿原文案模板与六位显示精度重算，底层布仍为八位。
function payText(pay) {
  const labels = { money: '钱', grain: '粮食', cloth: '布匹' }, units = { money: '贯', grain: '石', cloth: '匹' };
  const text = (factor) => KEYS.filter((k) => pay[k] > 0).map((k) => labels[k] + Number((pay[k] * factor).toFixed(6)) + ' ' + units[k]).join('、');
  return '月俸 ' + text(1) + ' · 岁俸 ' + text(12);
}

function positions(tree) {
  const out = [];
  (function walk(nodes) {
    (nodes || []).forEach((d) => {
      (d.positions || []).forEach((p) => out.push({ department: d.name, p }));
      walk(d.subs || d.children || d.subDepts || []);
    });
  })(tree);
  assert.strictEqual(new Set(out.map((r) => r.p.id)).size, out.length, '职位 id 重复');
  return out;
}

// 编制口径：按 salaryHeadcount；引擎还要按任职者去掉不叠领的兼官，见 payrollTotal。
function total(rows) {
  const out = { money: 0, grain: 0, cloth: 0 };
  rows.forEach(({ p }) => KEYS.forEach((k) => { out[k] += p.monthlyPay[k] * (p.salaryHeadcount == null ? (p.holder || p.holderId ? 1 : 0) : p.salaryHeadcount); }));
  KEYS.forEach((k) => { out[k] = round(out[k]); });
  return out;
}

function payrollTotal(scenario) {
  const game = { chars: scenario.characters };
  const c = { GM: game, console: { log() {}, warn() {}, error() {} }, JSON, Math, Date };
  c.window = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(REPO, 'web/tm-public-treasury.js'), 'utf8'), c);
  const paid = c.TM.PublicTreasury.payrollItems({ game, tree: scenario.officeTree });
  const out = { money: 0, grain: 0, cloth: 0 };
  paid.forEach((p) => KEYS.forEach((k) => { out[k] += p.monthly[k] * p.count; }));
  KEYS.forEach((k) => { out[k] = round(out[k]); });
  return { total: out, omitted: positions(scenario.officeTree).filter(({ p }) => !paid.some((r) => r.positionId === p.id)).map(({ p }) => p.name + '（' + p.holder + '）') };
}

function apply(scenario) {
  const faction = scenario.factions.find((f) => f.name === '唐朝廷');
  const trees = [faction.officeTree, scenario.officeTree, scenario.officeRegistryByFaction['唐朝廷']];
  trees.slice(1).forEach((t) => assert.strictEqual(JSON.stringify(t), JSON.stringify(trees[0]), '三份官制树改前不一致'));
  const rows = positions(trees[0]);
  const mirrors = trees.slice(1).map((t) => new Map(positions(t).map((r) => [r.p.id, r.p])));
  const before = total(rows);
  const payrollBefore = payrollTotal(scenario);
  const changes = [], unresolved = [], excluded = [];
  const capital = new Set(CAPITAL_DEPARTMENTS);
  rows.forEach(({ department, p }) => {
    if (!capital.has(department)) { excluded.push({ department, name: p.name, id: p.id }); return; }
    assert.strictEqual(p.salary, p.monthlyPay.money, p.name + ' salary 与月给钱不同');
    const rules = RULES.filter((r) => r.match.test(p.name));
    assert(rules.length <= 1, p.name + ' 命中多项');
    if (!rules.length) {
      assert(UNRESOLVED[p.name], p.name + ' 新出现的京官未列核查结果');
      unresolved.push({ department, name: p.name, id: p.id, why: UNRESOLVED[p.name], pay: Object.assign({}, p.monthlyPay) });
      return;
    }
    const r = rules[0], q = QUOTES[r.quote];
    assert(q && q.text, p.name + ' 无原文');
    const old = Object.assign({}, p.monthlyPay);
    const oldText = p.perPersonSalary;
    assert.strictEqual(oldText, payText(old), p.name + ' 俸给文案不是原模板，须核对后再改');
    const money = r.cash ? r.amount : r.amount / 2;
    const next = Object.assign({}, old, { money, cloth: r.cash ? 0 : round(money / 1.2) });
    assert.notStrictEqual(fmt(old), fmt(next), p.name + ' 已应用，请整体重建');
    [p, ...mirrors.map((m) => m.get(p.id))].forEach((copy) => {
      copy.salary = money;
      copy.monthlyPay = Object.assign({}, next);
      copy.perPersonSalary = payText(next);
    });
    changes.push({ department, name: p.name, id: p.id, old, oldText, next, rule: r });
  });
  // 粮不动；地方、未考明的京职以及所有与俸给无关的字段必须完全不变。
  trees.slice(1).forEach((t) => assert.strictEqual(JSON.stringify(t), JSON.stringify(trees[0]), '三份官制树改后不一致'));
  changes.forEach((r) => assert.strictEqual(r.old.grain, r.next.grain));
  const after = total(rows);
  const payrollAfter = payrollTotal(scenario);
  assert.strictEqual(before.grain, after.grain);

  const ladders = [];
  function chain(label, groups) {
    const paid = groups.map((names) => rows.filter((x) => names.includes(x.p.name)).map((x) => x.p.monthlyPay.money));
    assert(paid.every((g) => g.length), label + ' 缺职位');
    for (let i = 1; i < paid.length; i++) assert(Math.min(...paid[i - 1]) >= Math.max(...paid[i]), label + ' 倒挂');
    ladders.push(label + '：' + paid.map((g) => [...new Set(g)].join(',')).join(' ≥ '));
  }
  chain('宰相、仆射、尚书、侍郎', [['门下侍郎·同平章事', '中书侍郎·同平章事'], ['尚书左仆射', '尚书右仆射'], ['吏部尚书', '户部尚书', '礼部尚书', '兵部尚书', '刑部尚书', '工部尚书'], ['吏部侍郎', '户部侍郎', '礼部侍郎', '兵部侍郎', '刑部侍郎', '工部侍郎']]);
  chain('尚书丞、郎中、员外郎', [['尚书左丞', '尚书右丞'], changes.filter((r) => /郎中$/.test(r.name)).map((r) => r.name), changes.filter((r) => /员外郎$/.test(r.name)).map((r) => r.name)]);
  chain('谏议、补阙、拾遗', [['谏议大夫', '起居舍人·兼谏议大夫'], ['左补阙', '右补阙', '左补阙·史馆修撰'], ['左拾遗', '右拾遗']]);
  chain('御史台', [['御史大夫'], ['御史中丞'], ['监察御史']]);
  ['太常', '光禄', '卫尉', '宗正', '太仆', '大理', '鸿胪', '司农', '太府'].forEach((n) => chain(n + '寺', [[n + '卿'], [n + '少卿']]));
  [['国子祭酒', '国子司业'], ['少府监', '少府少监'], ['将作大监', '将作少监'], ['军器监', '军器丞'], ['都水使者', '都水丞'], ['秘书监', '秘书少监'], ['殿中监', '殿中少监'], ['内侍监', '内侍少监'], ['京兆尹', '京兆少尹'], ['太子少傅·分司东都', '太子宾客·分司东都']].forEach((g) => chain(g.join('、'), g.map((n) => [n])));
  ['吏', '户', '礼', '兵', '刑', '工'].forEach((b) => chain(b + '部各司', [[b + '部尚书'], [b + '部侍郎'], changes.filter((r) => r.department.startsWith(b + '部·') && /郎中$/.test(r.name)).map((r) => r.name), changes.filter((r) => r.department.startsWith(b + '部·') && /员外郎$/.test(r.name)).map((r) => r.name)]));
  return { before, after, payrollBefore, payrollAfter, changes, unresolved, excluded, ladders };
}

function report(result) {
  const { before, after, payrollBefore, payrollAfter, changes, unresolved, excluded, ladders } = result;
  const delta = Object.fromEntries(KEYS.map((k) => [k, round(after[k] - before[k])]));
  const payrollDelta = Object.fromEntries(KEYS.map((k) => [k, round(payrollAfter.total[k] - payrollBefore.total[k])]));
  return ['# 晚唐·京官料钱报告', '',
    '改 ' + changes.length + ' 席（' + changes.length * 3 + ' 份职位副本）；未考明京职 ' + unresolved.length + ' 席保留，地方使职 ' + excluded.length + ' 席保留。钱/粮/布单位依次为贯/石/匹，每月；所有粮额不动。', '',
    '## 口径', '',
    '- 会昌优先，会昌缺明确对应数则取贞元四年。上层官按 sources/tang-research/pay.json 的 _meta 读法，百四十萬/百萬校读为 140/100 贯；保留原文以便复核，可信度 M，非声称原刻本已校定。',
    '- 宰相全钱，其他钱 = 料钱 ÷ 2、布 = 钱 ÷ 1.2，布保留八位小数。这是剧本名义折数，不是市价实值。',
    '- 同步 perPersonSalary：官制页和编辑器优先读此月俸/岁俸文案，按原模板重算（显示六位、底层布八位），不让账上新俸而界面仍显示旧数。岁俸仅月俸乘十二。',
    '- ' + QUOTES.half.source + '：「' + QUOTES.half.text + '」；' + QUOTES.cash.source + '：「' + QUOTES.cash.text + '」。',
    '- 京兆府是京府，纳入；东都分司按所列宫官本俸，纳入；东都留守及判官为地方使府，不纳入。中书舍人兼翰林不叠加；起居舍人兼谏议按较高项推定（M）。', '',
    '## 唐廷每月官俸合计', '', '| 范围 | 改前 | 改后 | 变化 |', '| --- | --- | --- | --- |',
    '| 全部唐廷职位（按 salaryHeadcount，含虚位） | ' + fmt(before) + ' | ' + fmt(after) + ' | ' + fmt(delta) + ' |',
    '| 生产公帑引擎去兼领后的应付官俸 | ' + fmt(payrollBefore.total) + ' | ' + fmt(payrollAfter.total) + ' | ' + fmt(payrollDelta) + ' |',
    '这里只计官员职位，不含军饷、吏员、杂支，不把三树重复相加。用 TM.PublicTreasury.payrollItems 实跑去兼领，改前排除 ' + payrollBefore.omitted.join('、') + '，改后排除 ' + payrollAfter.omitted.join('、') + '。两人均另领本官俸，不能在两个职位重复相加；实际到账仍取决于钱粮余额。', '',
    '## 逐席改前改后', '', '| 官署 | 职位（ID） | 改前 | 改后 | 料钱 | 可信度 | 对应理由 | 原文 |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...changes.map((r) => '| ' + r.department + ' | ' + r.name + '（' + r.id + '） | ' + fmt(r.old) + ' | ' + fmt(r.next) + ' | ' + r.rule.amount + ' | ' + r.rule.confidence + ' | ' + r.rule.why + ' | ' + QUOTES[r.rule.quote].source + '：「' + QUOTES[r.rule.quote].text + '」 |'), '',
    '## 有职而未考明料钱', '', '| 官署 | 职位（ID） | 原月给 | 原因 |', '| --- | --- | --- | --- |',
    ...unresolved.map((r) => '| ' + r.department + ' | ' + r.name + '（' + r.id + '） | ' + fmt(r.pay) + ' | ' + r.why + ' |'), '',
    '## 地方使职未动', '', ...excluded.map((r) => '- ' + r.department + '：' + r.name + '（' + r.id + '）'), '',
    '## 官署层级自检', '', '按月给钱比较（宰相全钱，其余半钱半帛）；这不等于以剧本 rankLevel 统一跨署排序。', '', ...ladders.map((l) => '- PASS ' + l), '',
    '## 核查边界', '',
    '堂后主书未采用 pay.json 的同名映射，因流外堂后吏与流内中书主书身份不等，按查无对应额保留。军器监与军器丞取贞元通类额（M）。宦官只有明确的内侍监改定，内侍少监、枢密使和神策中尉保留。会昌晚于开局，此刀是按委任采用的最近系统俸表，不声称开成五年逐席实付恰为该额。', '',
    '翰林学士承旨未考明本官，月钱仍 20.2，低于同署兼翰林学士的中书舍人改后 40（改前 21.45）。这是原先已有的使职/本官口径缺口，不能为凑排序给承旨编俸；上面的 PASS 只覆盖有明确可比本官的序列，不把此项掩作全官署绝无倒挂。', '',
    '原文已对指定 wikitext 库逐字核验（仅去空白、维基链接和排版标记）；网页复核：[新唐书卷055](https://zh.wikisource.org/wiki/新唐書/卷055)、[唐会要卷091](https://zh.wikisource.org/wiki/唐會要/卷091)、[卷092](https://zh.wikisource.org/wiki/唐會要/卷092)。'
  ].join('\n') + '\n';
}

function main() {
  const args = process.argv.slice(2), raw = fs.readFileSync(FILE, 'utf8'), s = JSON.parse(raw);
  assert.strictEqual(JSON.stringify(s) + '\n', raw, '剧本不是标准 JSON.stringify 输出，拒绝改写');
  const original = JSON.stringify(s);
  const result = apply(s);
  // 回滚允许的字段后必须与原剧本完全相同，防止误伤其他剧情或地方官俸。
  const restored = JSON.parse(JSON.stringify(s));
  const old = new Map(result.changes.map((r) => [r.id, r]));
  [restored.factions.find((f) => f.name === '唐朝廷').officeTree, restored.officeTree, restored.officeRegistryByFaction['唐朝廷']].forEach((t) => positions(t).forEach(({ p }) => {
    if (old.has(p.id)) { p.monthlyPay = old.get(p.id).old; p.salary = p.monthlyPay.money; p.perPersonSalary = old.get(p.id).oldText; }
  }));
  assert.strictEqual(JSON.stringify(restored), original, '俸给以外的字段发生变化');
  const i = args.indexOf('--report');
  if (i >= 0) { assert(args[i + 1], '--report 缺文件'); fs.writeFileSync(args[i + 1], report(result)); }
  console.log('京官料钱：改 ' + result.changes.length + ' 席，唐廷月官俸（引擎去兼领） ' + fmt(result.payrollBefore.total) + ' → ' + fmt(result.payrollAfter.total));
  if (args.includes('--write')) { fs.writeFileSync(FILE, JSON.stringify(s) + '\n'); console.log('已写入 ' + path.relative(REPO, FILE)); }
}

module.exports = { apply, report, positions, total };
if (require.main === module) main();

// 晚唐剧本·删去唐廷与河朔、昭义四镇的批量地方代表（阶段三第四刀之三）
//
// 原账给唐廷 176 个、河朔昭义四镇各 4 个府州挂了「地方代表」：按姓批量起名（陆文远、范元简、何令远……名字多以远、简、安、衡结尾），
// 一人挂几十个府州（文室广成挂 73 处）。同志 09-24 定：砍掉批量地方代表。这批人撑着一整层结构，本补丁一并收拾：
//   - 人物本身与五常参考档里的条目删去；
//   - 顶层关系与各人关系表里涉及他们的删去；
//   - 军队：唐军的统兵官原来全是他们。神策左、右军交还两中尉仇士良、鱼弘志（中尉是神策军的实际统帅）；
//     驻在道治所的军队归本道长官（节帅坐镇治所，兼领牙军；京兆尹不统兵，京畿除外），驻另设防御使之州（同州、华州）的归本州长官；
//     其余驻支州的军队统兵官空缺，
//     不另编人名。军队说明里的人名改称「守将」（神策各营称「营将」），领饷名单里删去他们；
//   - 阶层的代表人物、他们名下的 23 件物品、4 个虚构家户、8 条恩怨删去；
//   - 河朔四镇府里的书吏、营将等职位改为「未记在任者」（与唐廷官制里其余未记在任的职位同一写法）；
//   - 他们名下的家产登记删去。
// 外藩的批量代表随外藩一刀处理。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-local-reps.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const WUCHANG_FILE = path.join(REPO, 'web/assets/reference/tang840-wuchang.json');
const { TANG_TREES, leavesOf } = require(path.join(DIR, 'data/tang-sources.js'));

const TANG_FACTIONS = new Set(['唐朝廷', '唐·魏博镇', '唐·成德镇', '唐·卢龙镇', '唐·昭义镇']);
const EXPECTED_REPS = 192;
// 神策军归两中尉
const SHENCE = [
  { test: /^神策左|^左神策/, name: '仇士良' },
  { test: /^神策右|^右神策/, name: '鱼弘志' }
];
// 京兆尹是民政长官，不统兵
const NO_TROOP_CIRCUITS = new Set(['京畿']);

// 参考档按原文件的缩进、换行符与结尾写回（五常档是两格缩进、CRLF、末尾无换行）
function sameFormat(raw, obj) {
  let out = JSON.stringify(obj, null, /^\{\r?\n {2}"/.test(raw) ? 2 : 0);
  if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
  if (/\r?\n$/.test(raw)) out += raw.includes('\r\n') ? '\r\n' : '\n';
  return out;
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

  const reps = scenario.characters.filter((c) => c.isFictional && TANG_FACTIONS.has(c.faction));
  if (reps.length !== EXPECTED_REPS) throw new Error('批量代表应为 ' + EXPECTED_REPS + ' 人，实得 ' + reps.length);
  const repIds = new Set(reps.map((c) => c.id));
  const repNames = new Set(reps.map((c) => c.name));
  const isRep = (idOrName) => repIds.has(idOrName) || repNames.has(idOrName);
  const byName = new Map(scenario.characters.map((c) => [c.name, c]));
  const counts = {};
  const bump = (key, n) => { counts[key] = (counts[key] || 0) + (n === undefined ? 1 : n); };

  // ---- 人物、五常档、关系 ----
  scenario.characters = scenario.characters.filter((c) => !repIds.has(c.id));
  bump('人物删去', reps.length);
  reps.forEach((c) => { delete wuchang.characters[c.id]; });
  scenario.characters.forEach((c) => {
    Object.keys(c.relations || {}).forEach((name) => { if (repNames.has(name)) { delete c.relations[name]; bump('人物关系表条目删去'); } });
  });
  const relBefore = scenario.relations.length;
  scenario.relations = scenario.relations.filter((r) => !isRep(r.fromId) && !isRep(r.toId) && !isRep(r.from) && !isRep(r.to));
  bump('顶层关系删去', relBefore - scenario.relations.length);

  // ---- 军队 ----
  const seatOf = new Map(); // 府州名 → 以它为治所的道
  const leafByName = new Map();
  TANG_TREES.forEach((key) => scenario.adminHierarchy[key].divisions.forEach((circuit) => {
    const leaves = leavesOf([circuit], []);
    leaves.forEach((l) => leafByName.set(l.name, l));
    const seat = leaves.find((l) => l.id === circuit.capitalChildId);
    if (seat) seatOf.set(seat.name, circuit);
  }));
  const troopRows = [];
  scenario.military.initialTroops.forEach((t) => {
    const shence = SHENCE.find((s) => s.test.test(t.name));
    const hadRep = isRep(t.commanderId) || isRep(t.commander);
    if (!hadRep && !(shence && !t.commanderId)) return;
    const oldName = t.commander;
    let next = null;
    if (shence) next = byName.get(shence.name);
    else {
      const circuit = seatOf.get(t.garrison);
      let who = '';
      if (circuit) who = NO_TROOP_CIRCUITS.has(circuit.name) ? '' : circuit.governor;
      else who = (leafByName.get(t.garrison) || {}).governor || ''; // 另设防御使的州（同州、华州）归本州长官
      next = who ? byName.get(who) || null : null;
      if (next && next.location !== t.garrison) next = null;
    }
    t.commander = next ? next.name : '';
    t.commanderId = next ? next.id : '';
    bump(next ? '军队统兵官改为史实长官' : '军队统兵官空缺');
    if (oldName && t.description && t.description.includes(oldName)) {
      t.description = t.description.split(oldName).join(shence ? '营将' : '守将');
      bump('军队说明人名改称');
    }
    if (Array.isArray(t.payrollRecipients)) {
      const kept = t.payrollRecipients.filter((p) => !isRep(p.characterId));
      if (kept.length !== t.payrollRecipients.length) bump('领饷名单删去', t.payrollRecipients.length - kept.length);
      if (kept.length) t.payrollRecipients = kept; else delete t.payrollRecipients;
    }
    troopRows.push('| ' + t.name + ' | ' + t.garrison + ' | ' + (oldName || '（空）') + ' | ' + (t.commander || '（空缺）') + ' |');
  });

  // ---- 阶层、物品、家户、恩怨 ----
  scenario.classes.forEach((c) => {
    if (!Array.isArray(c.representativeNpcs)) return;
    const kept = c.representativeNpcs.filter((n) => !isRep(n));
    bump('阶层代表人物删去', c.representativeNpcs.length - kept.length);
    c.representativeNpcs = kept;
  });
  const itemRows = scenario.items.filter((i) => isRep(i.owner)).map((i) => i.name + '（' + i.owner + '）');
  scenario.items = scenario.items.filter((i) => !isRep(i.owner));
  bump('物品删去', itemRows.length);
  const familyRows = scenario.families.filter((f) => (f.members || []).some(isRep) || isRep(f.currentHead)).map((f) => f.name);
  scenario.families = scenario.families.filter((f) => !familyRows.includes(f.name));
  bump('虚构家户删去', familyRows.length);
  const enyuanBefore = scenario.initialEnYuan.length;
  scenario.initialEnYuan = scenario.initialEnYuan.filter((e) => !isRep(e.from) && !isRep(e.to) && !isRep(e.source) && !isRep(e.target));
  bump('恩怨删去', enyuanBefore - scenario.initialEnYuan.length);

  // ---- 官职：河朔四镇府里的书吏、营将 ----
  const vacate = (p) => {
    if (!isRep(p.holderId) && !isRep(p.holder)) return;
    p.holder = ''; p.holderId = ''; p.occupancyStatus = 'unrecorded';
    bump('官职改为未记在任者');
  };
  scenario.factions.forEach((f) => (f.officeTree || []).forEach((o) => (o.positions || []).forEach(vacate)));
  Object.values(scenario.officeRegistryByFaction || {}).forEach((list) => list.forEach((o) => (o.positions || []).forEach(vacate)));
  (scenario.officeTree || []).forEach((o) => (o.positions || []).forEach(vacate));

  // ---- 家产登记 ----
  const econ = scenario.characterEconomyConfig || {};
  if (Array.isArray(econ.assets)) {
    const before = econ.assets.length;
    econ.assets = econ.assets.filter((a) => !repIds.has(String(a.ownerEntityId || '').replace(/^[a-z-]+:/, '')));
    bump('家产登记删去', before - econ.assets.length);
  }

  // 收尾核对：剧本里不应再有这批人的 id 与名字
  const text = JSON.stringify(scenario);
  const leftIds = [...repIds].filter((id) => text.includes('"' + id + '"'));
  const leftNames = [...repNames].filter((n) => text.includes(n));
  if (leftIds.length || leftNames.length) throw new Error('仍有残留：' + leftIds.slice(0, 5).join('、') + ' ' + leftNames.slice(0, 5).join('、'));

  const report = ['# 晚唐·删去批量地方代表报告', '',
    '唐廷与河朔、昭义四镇的批量地方代表 ' + reps.length + ' 人删去，剩 ' + scenario.characters.length + ' 人。引用逐项收拾如下。', '',
    '| 处理 | 处数 |', '| --- | --- |', ...Object.keys(counts).map((k) => '| ' + k + ' | ' + counts[k] + ' |'), '',
    '## 军队统兵官', '', '神策军归两中尉；驻道治所的军队归本道长官（京畿除外），驻同州、华州的归本州防御使；其余空缺，不另编人名。', '',
    '| 军队 | 驻地 | 原统兵官 | 现统兵官 |', '| --- | --- | --- | --- |', ...troopRows, '',
    '## 删去的物品', '', itemRows.join('、'), '',
    '## 删去的家户', '', familyRows.join('、')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    fs.writeFileSync(WUCHANG_FILE, JSON.stringify(wuchang, null, wuchangRaw.includes('\n  "') ? 2 : 0) + (wuchangRaw.endsWith('\n') ? '\n' : ''));
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE) + ' 与 ' + path.relative(REPO, WUCHANG_FILE));
  }
}

main();

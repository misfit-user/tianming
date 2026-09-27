// 晚唐剧本·外藩名目与归属（阶段三第六刀之一）
//
// 外藩四十二家是批量写成的：区划名多是制作用语（「接触地」「观察区」「地理范围」「社群」），有几家把不相干的地块拼成一家
// （东部地方社群九块，从滇东、澜沧到嫩江、乌苏里江、于都斤山）。核查见 sources/tang-research/foreign-east.json、
// foreign-west-south.json，逐条依据与可信度在 data/tang-foreign.js。同志 09-26 定：拼盘势力按史实拆散归属；
// 黑水靺鞨仍独立，关系写作役属渤海。本补丁：
//   - 撤销五家拼盘势力（西缘、戈壁、辽东、鸭绿浿江、漠西林缘），各块改挂到开成间实际所属（渤海、新罗、回鹘、吐蕃、南诏、黠戛斯、
//     室韦），这几家的人物都是按模板起名的批量地方代表，随势力删去；东部地方社群八块改挂，留下的滇东一块改称牂牁诸蛮；
//   - 势力、道、地块的名目改为史名或地理名，区划类型去掉制作用语，都城指到地块；
//   - 南诏分出诸节度都督一道（原道改称十睑，只留王畿四睑），回鹘新立金山诸部一道；
//   - 渤海—黑水靺鞨、吐蕃—葱岭诸谷、南诏—骠国写作役属关系；
//   - 改挂地块的吏员与地方开支挪到新主账上，开局账按新主的税目用财政引擎重算。
// 人口与人物（批量代表、史实人物）在后两刀。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-foreign-names.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const WUCHANG_FILE = path.join(REPO, 'web/assets/reference/tang840-wuchang.json');
const DATA = require(path.join(DIR, 'data/tang-foreign.js'));
const lib = require(path.join(DIR, 'patches/tang-foreign-lib.js'));
const { assertLedgersAreEnginePreview, refreshLedgers } = require(path.join(DIR, 'patches/tang-redistribute.js'));

const TANG = /^唐/;

function sha1(text) {
  return crypto.createHash('sha1').update('sc-tang840-840:' + text).digest('hex');
}

// 参考档按原文件的缩进、换行符与结尾写回（五常档是两格缩进、CRLF、末尾无换行）
function sameFormat(raw, obj) {
  let out = JSON.stringify(obj, null, /^\{\r?\n {2}"/.test(raw) ? 2 : 0);
  if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
  if (/\r?\n$/.test(raw)) out += raw.includes('\r\n') ? '\r\n' : '\n';
  return out;
}

function foreignTrees(scenario) {
  return Object.keys(scenario.adminHierarchy).filter((k) => k !== 'player' && !TANG.test(k));
}

function leavesOf(scenario, key) {
  return scenario.adminHierarchy[key].divisions.reduce((out, c) => out.concat(c.children || []), []);
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
  assertLedgersAreEnginePreview(scenario, foreignTrees(scenario));
  delete scenario.mapData;

  const counts = {};
  const bump = (key, n) => { counts[key] = (counts[key] || 0) + (n === undefined ? 1 : n); };
  const originalName = new Map();
  const originalOwner = new Map();
  foreignTrees(scenario).forEach((key) => scenario.adminHierarchy[key].divisions.forEach((c) => (c.children || []).forEach((l) => {
    originalName.set(l.id, l.name);
    originalOwner.set(l.id, key + '·' + c.name);
  })));
  const tangLeafNames = new Set(['player'].concat(Object.keys(scenario.adminHierarchy).filter((k) => TANG.test(k)))
    .reduce((out, key) => out.concat(leavesOf(scenario, key).map((l) => l.name)), []));

  // ---- 1. 势力改名 ----
  const factionRows = DATA.FACTION_RENAMES.map(([from, to, conf, why]) => {
    const n = lib.renameFaction(scenario, from, to);
    return '| ' + from + ' | ' + to + ' | ' + conf + ' | ' + why + ' | ' + n + ' |';
  });

  // ---- 2. 新立道 ----
  const circuitIdOf = {};
  const newCircuitRows = [];
  Object.keys(DATA.NEW_CIRCUITS).forEach((key) => {
    const spec = DATA.NEW_CIRCUITS[key];
    const tree = scenario.adminHierarchy[spec.faction];
    const fromIndex = tree.divisions.findIndex((c) => c.id === spec.from);
    if (fromIndex < 0) throw new Error(spec.faction + ' 没有道 ' + spec.from);
    const from = tree.divisions[fromIndex];
    const id = 'circuit-' + sha1(spec.faction + ':' + spec.name).slice(0, 12);
    const circuit = Object.assign(JSON.parse(JSON.stringify(from)), { id, name: spec.name, description: spec.reason + '。', children: [] });
    tree.divisions.splice(fromIndex + 1, 0, circuit);
    const regIndex = scenario.map.circuitRegistry.findIndex((r) => r.key === spec.from);
    scenario.map.circuitRegistry.splice(regIndex + 1, 0, { key: id, name: spec.name, faction: spec.faction, memberRegionIds: [] });
    const accounts = scenario.publicTreasuryConfig.accounts;
    const poolIndex = accounts.findIndex((a) => a.id === 'pool:' + spec.from);
    const pool = Object.assign(JSON.parse(JSON.stringify(accounts[poolIndex])), { id: 'pool:' + id, name: spec.name + '诸库合计', members: [] });
    accounts.splice(poolIndex + 1, 0, pool);
    circuitIdOf[key] = id;
    newCircuitRows.push('| ' + spec.faction + ' | ' + spec.name + ' | ' + spec.reason + ' |');
  });

  // ---- 3. 南诏节度都督诸地挪到新道 ----
  DATA.NANZHAO_JIEDU.forEach((id) => lib.moveLeaf(scenario, id, circuitIdOf['nanzhao-jiedu']));

  // ---- 4. 改挂 ----
  const moved = DATA.MOVES.map(([leafId, faction, circuitKey, name, conf, why]) => {
    const r = lib.moveLeaf(scenario, leafId, circuitIdOf[circuitKey] || circuitKey);
    if (r.to !== faction) throw new Error(leafId + ' 挂到了 ' + r.to + '，应为 ' + faction);
    return { leafId, name, conf, why, from: r.from, to: r.to, old: originalName.get(leafId), origin: originalOwner.get(leafId) };
  });

  // ---- 5. 撤销拼盘势力：人物都是批量地方代表，随势力删去 ----
  const dissolveRows = [];
  const removedIds = new Set();
  const removedNames = new Set();
  DATA.DISSOLVE.forEach((name) => {
    const chars = scenario.characters.filter((c) => c.faction === name || c.factionId === name);
    const real = chars.filter((c) => !c.isFictional);
    if (real.length) throw new Error(name + ' 有史实人物，不能随势力删去：' + real.map((c) => c.name).join('、'));
    const { ids, names } = lib.removeCharacters(scenario, wuchang, chars, bump);
    ids.forEach((x) => removedIds.add(x));
    names.forEach((x) => removedNames.add(x));
    lib.dissolveFaction(scenario, name);
    const gone = moved.filter((m) => m.from === name).map((m) => m.old + '→' + m.to + '·' + m.name);
    dissolveRows.push('| ' + name + ' | ' + gone.join('；') + ' | ' + chars.map((c) => c.name).join('、') + ' |');
  });

  // ---- 6. 地块改名（先改成临时名再改成新名，免得新旧名互占） ----
  const renames = moved.map((m) => [m.leafId, m.name, m.from])
    .concat(Object.keys(DATA.LEAF_RENAMES).map((id) => [id, DATA.LEAF_RENAMES[id][0], null]));
  renames.forEach(([id, , former]) => lib.renameLeaf(scenario, id, '〔改名中' + id + '〕', former));
  renames.forEach(([id, name, former]) => lib.renameLeaf(scenario, id, name, former));
  const relocateRows = [];
  DATA.RELOCATE.forEach(([faction, fromId, toId, why]) => {
    const from = lib.findLeaf(scenario, fromId).leaf.name;
    const to = lib.findLeaf(scenario, toId).leaf.name;
    scenario.characters.forEach((c) => {
      if (c.faction !== faction || c.location !== from) return;
      c.location = to;
      if (c.locationId === fromId) c.locationId = toId;
      relocateRows.push('| ' + c.name + ' | ' + from + ' | ' + to + ' | ' + why + ' |');
    });
    // 王城宿卫随王城走
    scenario.military.initialTroops.forEach((t) => {
      if (t.faction !== faction || t.garrison !== fromId || !/宿卫/.test(t.name)) return;
      const old = t.name;
      ['garrison', 'location'].forEach((k) => { if (t[k] === fromId) t[k] = toId; });
      ['regionHint', 'garrisonName', 'locationName'].forEach((k) => { if (t[k] === from) t[k] = to; });
      ['name', 'description', 'commandAuthority'].forEach((k) => { if (typeof t[k] === 'string') t[k] = t[k].split(from).join(to); });
      if (t.funding && t.funding.regionId === fromId) t.funding.regionId = toId;
      // 地块上的驻军人数是驻在该块各军兵数之和
      const fromRegion = scenario.map.regions.find((r) => r.id === fromId);
      const toRegion = scenario.map.regions.find((r) => r.id === toId);
      fromRegion.troops -= t.soldiers || 0;
      toRegion.troops += t.soldiers || 0;
      relocateRows.push('| ' + old + '（军队） | ' + from + ' | ' + to + ' | ' + why + ' |');
    });
  });
  DATA.TROOP_RENAMES.forEach(([from, to, words]) => {
    const t = scenario.military.initialTroops.find((x) => x.name === from);
    if (!t) throw new Error('没有军队 ' + from);
    ['name', 'description', 'commandAuthority'].forEach((k) => {
      if (typeof t[k] === 'string') words.forEach(([a, b]) => { t[k] = t[k].split(a).join(b); });
    });
    if (t.name !== to) throw new Error(from + ' 改名得 ' + t.name + '，应为 ' + to);
    relocateRows.push('| ' + from + '（军队改名） | ' + t.garrisonName + ' | ' + to + ' | 军名带着改挂前的错地名 |');
  });
  const leafRows = Object.keys(DATA.LEAF_RENAMES).map((id) => {
    const [name, conf, why] = DATA.LEAF_RENAMES[id];
    return '| ' + originalName.get(id) + ' | ' + name + ' | ' + conf + ' | ' + why + ' |';
  });

  // ---- 7. 道改名 ----
  const circuitRows = Object.keys(DATA.CIRCUIT_RENAMES).map((id) => {
    const [name, conf, why] = DATA.CIRCUIT_RENAMES[id];
    const old = lib.renameCircuit(scenario, id, name);
    return '| ' + old + ' | ' + name + ' | ' + conf + ' | ' + why + ' |';
  });

  // ---- 8. 区划类型 ----
  const typeCounts = {};
  const countType = (from, to) => { typeCounts[from + '→' + to] = (typeCounts[from + '→' + to] || 0) + 1; };
  const circuitKeyOf = {};
  Object.keys(circuitIdOf).forEach((key) => { circuitKeyOf[circuitIdOf[key]] = key; });
  foreignTrees(scenario).forEach((key) => {
    scenario.adminHierarchy[key].divisions.forEach((c) => {
      const next = DATA.CIRCUIT_TYPES[c.id] || DATA.CIRCUIT_TYPES[circuitKeyOf[c.id]] || DATA.CIRCUIT_RENAME_TYPES[c.regionType] ||
        (DATA.CIRCUIT_META_TYPES.has(c.regionType) ? DATA.CIRCUIT_TYPE_DEFAULT : null);
      if (next && next !== c.regionType) { countType('道：' + c.regionType, next); c.regionType = next; }
      (c.children || []).forEach((l) => {
        const leafNext = DATA.LEAF_TYPES[l.id] || DATA.META_TYPES[l.regionType] ||
          (l.regionType === '地方战略观察地块' ? DATA.LEAF_TYPE_BY_FACTION[key] : null);
        if (l.regionType === '地方战略观察地块' && !leafNext) throw new Error(key + ' 没有默认地块类型');
        if (leafNext && leafNext !== l.regionType) { countType(l.regionType, leafNext); l.regionType = leafNext; }
      });
    });
  });

  // ---- 9. 都城 ----
  const capitalRows = Object.keys(DATA.CAPITALS).map((name) => {
    const f = lib.factionByName(scenario, name);
    const leafId = DATA.CAPITALS[name];
    const old = f.capitalName;
    if (leafId) {
      const { treeKey, leaf } = lib.findLeaf(scenario, leafId);
      if (treeKey !== name) throw new Error(name + ' 的都城 ' + leafId + ' 不在本势力');
      f.capitalName = leaf.name;
    } else f.capitalName = '';
    const note = DATA.CAPITAL_NOTES[name] || ['', '无统一都城或王帐可指'];
    return '| ' + name + ' | ' + old + ' | ' + (f.capitalName || '（空，无统一都城）') + ' | ' + note[0] + ' | ' + note[1] + ' |';
  });

  // ---- 10. 役属关系（宗主 → 属部，同唐廷与河朔诸镇的写法） ----
  const vassalRows = DATA.VASSALS.map(([from, to, conf, desc, quote]) => {
    lib.factionByName(scenario, from);
    lib.factionByName(scenario, to);
    const before = scenario.factionRelations.filter((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from));
    scenario.factionRelations = scenario.factionRelations.filter((r) => !before.includes(r));
    scenario.factionRelations.push({ id: 'frel-' + sha1('vassal:' + from + ':' + to).slice(0, 12), sid: scenario.id, from, to, type: 'vassal', value: 10, desc });
    return '| ' + from + ' | ' + to + ' | ' + conf + ' | ' + quote + ' |';
  });

  // ---- 11. 势力人口与领地按地块重算 ----
  foreignTrees(scenario).forEach((key) => {
    const f = lib.factionByName(scenario, key);
    const leaves = leavesOf(scenario, key);
    f.population = leaves.reduce((s, l) => s + (l.population || 0), 0);
    const own = new Set(leaves.map((l) => l.id));
    const extra = (f.territories || []).filter((id) => !own.has(id));
    const missing = leaves.filter((l) => !(f.territories || []).includes(l.id));
    if (extra.length || missing.length) throw new Error(key + ' 领地与地块不符：多 ' + extra.join('、') + ' 缺 ' + missing.map((l) => l.id).join('、'));
  });

  // ---- 12. 开局账按新主的税目重算，府州写回地块 data 与 mapData ----
  refreshLedgers(scenario, foreignTrees(scenario));

  // ---- 自检 ----
  const dissolvedAndOld = new Set(DATA.DISSOLVE.concat(DATA.FACTION_RENAMES.map((r) => r[0])));
  lib.assertGone(scenario, dissolvedAndOld, '撤销与改名前的势力名');
  lib.assertGone(scenario, removedIds, '删去人物的 id ');
  const text = JSON.stringify(scenario);
  const leftNames = [...removedNames].filter((n) => text.includes('"' + n + '"'));
  if (leftNames.length) throw new Error('删去的人物仍被引用：' + leftNames.join('、'));
  if (text.includes('〔改名中')) throw new Error('临时名没有改完');
  scenario.map.circuitRegistry.forEach((reg) => {
    const { circuit } = lib.findCircuit(scenario, reg.key);
    const members = (circuit.children || []).map((l) => l.id).sort().join(',');
    if (reg.memberRegionIds.slice().sort().join(',') !== members) throw new Error(reg.name + ' 省道登记与行政树不一致');
    const pool = scenario.publicTreasuryConfig.accounts.find((a) => a.id === 'pool:' + reg.key);
    if (pool && pool.members.slice().sort().join(',') !== (circuit.children || []).map((l) => 'region:' + l.id).sort().join(',')) throw new Error(reg.name + ' 诸库合计与行政树不一致');
  });
  const garrisoned = {};
  scenario.military.initialTroops.forEach((t) => { garrisoned[t.garrison] = (garrisoned[t.garrison] || 0) + (t.soldiers || 0); });
  scenario.map.regions.forEach((r) => {
    if (typeof r.troops === 'number' && r.troops !== (garrisoned[r.id] || 0)) throw new Error(r.name + ' 的驻军人数与驻军不符');
  });
  const foreignNames = new Map();
  foreignTrees(scenario).forEach((key) => leavesOf(scenario, key).forEach((l) => {
    if (foreignNames.has(l.name)) throw new Error('外藩地块重名：' + l.name + '（' + foreignNames.get(l.name) + '、' + key + '）');
    if (tangLeafNames.has(l.name)) throw new Error('外藩地块与唐州同名：' + l.name + '（' + key + '）');
    foreignNames.set(l.name, key);
  }));

  // ---- 报告 ----
  const moveRows = moved.map((m) => {
    const { treeKey, circuit } = lib.findLeaf(scenario, m.leafId);
    return '| ' + m.old + ' | ' + m.origin + ' | ' + treeKey + '·' + circuit.name + ' | ' + m.name + ' | ' + m.conf + ' | ' + m.why + ' |';
  });
  const factionsNow = foreignTrees(scenario).length;
  const report = ['# 晚唐·外藩名目与归属报告', '',
    '撤销拼盘势力 ' + DATA.DISSOLVE.length + ' 家，改挂地块 ' + moved.length + ' 块，势力改名 ' + DATA.FACTION_RENAMES.length + ' 家，道改名 ' + circuitRows.length +
      ' 个、新立 ' + newCircuitRows.length + ' 个，地块改名 ' + leafRows.length + ' 块（改挂的另 ' + moved.length + ' 块），外藩势力 ' + (factionsNow + DATA.DISSOLVE.length) + '→' + factionsNow + ' 家。',
    '依据与引文见 sources/tang-research/foreign-east.json、foreign-west-south.json；可信度 H 有原文直证，M 有原文而须推定，L 只有今人研究或推断。', '',
    '## 撤销的拼盘势力', '', '| 势力 | 各块去向 | 随势力删去的人物（批量地方代表） |', '| --- | --- | --- |', ...dissolveRows, '',
    '## 势力改名', '', '| 原名 | 新名 | 可信度 | 依据 | 改动处数 |', '| --- | --- | --- | --- | --- |', ...factionRows, '',
    '## 地块改挂', '', '| 原名 | 原属 | 新属 | 新名 | 可信度 | 依据 |', '| --- | --- | --- | --- | --- | --- |', ...moveRows, '',
    '改挂地块的吏员与地方开支从原主账挪到新主账（名目照新主同道邻块的写法），开局账按新主的税目用财政引擎按年预算重算。', '',
    '## 新立的道', '', '| 势力 | 道 | 依据 |', '| --- | --- | --- |', ...newCircuitRows, '',
    '南诏原道改称十睑，只留王畿阳苴咩城、赵川睑、白崖城、邆川四块；柘东、石城、柘东南诸蛮、通海、弄栋、永昌、银生、茫乃道、剑川、铁桥与改挂来的广荡城、丽水城归诸节度都督。', '',
    '## 道改名', '', '| 原名 | 新名 | 可信度 | 依据 |', '| --- | --- | --- | --- |', ...circuitRows, '',
    '## 地块改名', '', '| 原名 | 新名 | 可信度 | 依据 |', '| --- | --- | --- | --- |', ...leafRows, '',
    '### 随王城改所在的人物与宿卫', '', '| 人物或军队 | 原所在（改名后） | 改为 | 依据 |', '| --- | --- | --- | --- |', ...relocateRows, '',
    '## 区划类型', '', '| 原类型→新类型 | 块数 |', '| --- | --- |', ...Object.keys(typeCounts).map((k) => '| ' + k + ' | ' + typeCounts[k] + ' |'), '',
    '## 都城', '', '| 势力 | 原写 | 改为 | 可信度 | 依据 |', '| --- | --- | --- | --- | --- |', ...capitalRows, '',
    '## 役属关系', '', '| 宗主 | 属部 | 可信度 | 引文 |', '| --- | --- | --- | --- |', ...vassalRows, '',
    '## 随撤销势力删去的引用', '', '| 项 | 数 |', '| --- | --- |', ...Object.keys(counts).map((k) => '| ' + k + ' | ' + counts[k] + ' |')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    fs.writeFileSync(WUCHANG_FILE, sameFormat(wuchangRaw, wuchang));
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE) + ' 与 ' + path.relative(REPO, WUCHANG_FILE));
  }
}

main();

#!/usr/bin/env node
// scripts/lint-scenario-data.js — 官方剧本数据守卫（棘轮，2026-09-24）
//
// 盯的是三部官方剧本真源 scenarios/*（官方）.json 的数据质量：
//   - 引用：人物、势力、地块、行政树、省道、官制、军队、党派、阶层、关系之间互相指得上
//   - 格式：字段类型与引擎读取口径一致（人口是数字、结构占比是数、地形是中文……）
//   - 数值：户不多于口、丁不多于口、0～100 的量不越界、耕地量纲对
//   - 文字：地方描述不写制作过程、不整批复用同一段
//   - 府州：不整份照抄上级的定性字段、不按系数平分人口
//   - 死字段：剧本里有、游戏与编辑器脚本一处都不读的字段（按出现次数计）
//
// 棘轮：每部剧本每条规则的问题数记在基线里，只许减不许增。修完一刀用 --update 收紧。
// 规则说明与区划数据口径见 docs/scenario-data/区划数据宪法.md。
//
// 用法（在 web/ 下）：
//   node scripts/lint-scenario-data.js                  # 对比基线
//   node scripts/lint-scenario-data.js --update         # 重写基线（只在确认问题数下降后使用）
//   node scripts/lint-scenario-data.js --report <目录>  # 另存逐条问题清单与死字段清单
//   node scripts/lint-scenario-data.js --only tianqi7   # 只查一部（tianqi7 / shaosong / tang840）
//
// 基线：scripts/arch-baselines/scenario-data.json

'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib-arch-guard');

const WEB_ROOT = lib.WEB_ROOT;
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const BASELINE_FILE = path.join(lib.BASELINE_DIR, 'scenario-data.json');

const SCENARIOS = [
  { key: 'tianqi7', file: '天启七年·九月（官方）.json' },
  { key: 'shaosong', file: '绍宋·建炎元年八月（官方）.json' },
  { key: 'tang840', file: '晚唐·开成五年（官方）.json' }
];

const RULES = {
  'ref.entity.id': '实体缺 id',
  'ref.entity.sid': '实体缺 sid',
  'ref.faction.duplicate': '势力 id 或名字重复',
  'ref.faction.leader': '势力首领不在人物表',
  'ref.faction.leaderDead': '势力首领已死',
  'ref.faction.leaderForeign': '势力首领属于另一势力',
  'ref.faction.capital': '势力都城不是地图上的地块名',
  'ref.char.duplicateId': '人物 id 重复（开局按 id 去重会丢人）',
  'ref.char.duplicateName': '人物名重复（按名字查人的系统会串人）',
  'ref.char.faction': '人物所属势力不存在',
  'ref.char.factionId': '人物 factionId 不是现存势力',
  'ref.char.factionConflict': '人物 faction 与 factionId 指向不同势力',
  'ref.char.region': '人物所在地块 id 不存在',
  'ref.char.age': '人物年龄与生年不符或越界',
  'ref.char.party': '人物所属党派不在党派表',
  'ref.char.class': '人物所属阶层不在阶层表',
  'ref.region.duplicateId': '地块 id 重复',
  'ref.region.duplicateName': '地块名重复（按名字索引的账会互相覆盖）',
  'ref.region.owner': '地块归属势力不存在',
  'ref.region.neighbor': '邻接指向不存在的地块或不对称',
  'ref.circuit.member': '省道成员地块不存在',
  'ref.circuit.coverage': '地块不属于任何省道或同时属于多个',
  'ref.admin.treeKey': '行政树键名不是势力 id 或名字（引擎按键名找势力）',
  'ref.admin.treeFactionId': '行政树声明的 factionId 不是现存势力',
  'ref.admin.duplicateId': '区划 id 重复',
  'ref.admin.leafRegion': '行政叶子绑定的地块不存在',
  'ref.admin.nonTerritoryLeaf': '行政叶子挂在上级区划而非地块上（非领土账）',
  'ref.admin.regionUnbound': '地块没有对应的行政叶子',
  'ref.office.holder': '官职任职者不在人物表',
  'ref.office.holderDead': '官职任职者已死',
  'ref.army.commander': '统兵官不在人物表',
  'ref.army.commanderDead': '统兵官已死',
  'ref.army.faction': '军队所属势力不存在',
  'ref.army.garrison': '军队驻地不是地图上的地块',
  'ref.party.leader': '党魁不在人物表',
  'ref.party.faction': '党派所属势力不存在',
  'ref.class.faction': '阶层所属势力不存在',
  'ref.relation.char': '人物关系的一端不在人物表',
  'ref.relation.faction': '势力关系的一端不是现存势力',
  'fmt.population': 'population 不是数字（明细应放 populationDetail）',
  'fmt.percentString': '人口结构用字符串百分比',
  'fmt.carryingCapacity': 'carryingCapacity 不是对象',
  'fmt.terrainEnglish': '地形用英文代码',
  'fmt.circuitSchema': '省道登记没有 memberRegionIds',
  'num.householdsOverMouths': '户数大于口数',
  'num.dingOverMouths': '丁数大于口数',
  'num.mouthsPerHousehold': '户均口数不在 2～12 之间',
  'num.zeroPopulation': '区划没有人口或人口为 0',
  'num.outOfRange': '民心、吏治、繁荣、不稳越出 0～100',
  'num.actualOverClaimed': '实征大于应征',
  'num.farmlandUnit': '耕地量纲错误（小于 100 亩）',
  'text.meta': '地方描述写了制作过程或游戏术语',
  'text.templated': '同一段地方描述用于三个以上区划',
  'leaf.copiedFromParent': '府州的地形、特产、标签、民心、吏治整份照抄上级',
  'leaf.equalSplit': '同一上级下三个以上府州人口相同（按系数平分的痕迹）',
  'field.dead': '游戏与编辑器脚本一处都不读的字段（按出现次数计）'
};

// ---------------------------------------------------------------------------
// 运行时语料：web 顶层脚本、battle、modules、preview 下的手写模块（不含 _ 开头的一次性改写脚本），
// 不含测试脚本、生成的剧本包和第三方库。死字段判定只看字段名在语料里出没出现，宁宽勿严。
// ---------------------------------------------------------------------------
const CORPUS_DIRS = ['', 'battle', 'modules/ai-change-applier', 'preview'];
const CORPUS_EXCLUDE = new Set([
  'tm-official-scenario-bundle.js',
  'preview/official-scenarios-bundle.js',
  'preview/scenario-editor-reset-data.js'
]);

function loadCorpusTokens() {
  const tokens = new Set();
  let files = 0;
  for (const dir of CORPUS_DIRS) {
    const absDir = path.join(WEB_ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const name of fs.readdirSync(absDir)) {
      if (!name.endsWith('.js')) continue;
      const rel = (dir ? dir + '/' : '') + name;
      if (CORPUS_EXCLUDE.has(rel)) continue;
      if (dir === 'preview' && name.startsWith('_')) continue;
      const text = fs.readFileSync(path.join(absDir, name), 'utf8');
      const re = /[A-Za-z_$][\w$]*/g;
      let m;
      while ((m = re.exec(text))) tokens.add(m[0]);
      files++;
    }
  }
  return { tokens, files };
}

// 这些键下面是「以名字或 id 为键的字典」，键名本身是数据，不算字段名
const DICT_KEYS = new Set([
  'adminHierarchy', 'relations', 'byEthnicity', 'byFaith', 'officeRegistryByFaction',
  'geographicReferences', 'aliases', 'imperialAssets', 'attitude', 'resourceMap',
  'regionOverrides', 'byRegion', 'perTax', 'byFaction', 'byClass', 'byCircuit', 'byPrefecture',
  'byParty', 'overrides', 'officeSalaries', 'taxOverrides'
]);
// 体量巨大、与字段语义无关的几何数据，不进死字段统计
const GEOMETRY_KEYS = new Set(['geometry', 'path', 'd', 'points', 'coords', 'polygon', 'rings', 'arcs', 'outline', 'shape', 'svgPath']);
const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
// 人名、官名里的占位写法：不算引用断裂
const PLACEHOLDER_RE = /^(空缺|缺|无|未详|待补|暂缺|任官未详|—|-|（|\()/;
const META_TEXT_RE = /(剧本|绑定|几何|判定|schema|字段|数据|Codex|GPT|占位|TODO|地块|建模|示例|草案)/i;

function arr(v) { return Array.isArray(v) ? v : []; }
function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function collectDeadFields(scenario, corpus) {
  const dead = new Map();
  (function walk(node, pathLabel, parentKey, depth) {
    if (depth > 16 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, pathLabel + '[]', parentKey, depth + 1));
      return;
    }
    const isDict = DICT_KEYS.has(parentKey);
    for (const key of Object.keys(node)) {
      if (GEOMETRY_KEYS.has(key)) continue;
      if (depth === 0 && key === 'mapData') continue; // 与 map 逐字节相同，只查一份
      const childPath = pathLabel ? pathLabel + '.' + (isDict ? '*' : key) : key;
      if (!isDict && IDENT_RE.test(key) && !corpus.has(key)) {
        const entry = dead.get(key) || { count: 0, samplePath: childPath };
        entry.count += 1;
        dead.set(key, entry);
      }
      walk(node[key], childPath, isDict ? '' : key, depth + 1);
    }
  })(scenario, '', '', 0);
  return dead;
}

function populationOf(division) {
  if (!division) return null;
  const detail = isObj(division.populationDetail) ? division.populationDetail
    : (isObj(division.population) ? division.population : {});
  const mouths = num(detail.mouths);
  if (mouths !== null) return mouths;
  return num(division.population);
}

// ---------------------------------------------------------------------------
// 单部剧本体检
// ---------------------------------------------------------------------------
function auditScenario(scenario, corpus) {
  const issues = [];
  const counts = {};
  function report(rule, subject, detail) {
    counts[rule] = (counts[rule] || 0) + 1;
    issues.push({ rule, subject: String(subject || ''), detail: String(detail || '') });
  }

  // ---- 势力 ----
  const factions = arr(scenario.factions);
  const facById = new Map();
  const facByName = new Map();
  factions.forEach((f) => {
    if (!f.id) report('ref.entity.id', f.name, '势力没有 id');
    if (!f.sid) report('ref.entity.sid', f.name, '势力没有 sid');
    if ((f.id && facById.has(f.id)) || (f.name && facByName.has(f.name))) report('ref.faction.duplicate', f.name, f.id);
    if (f.id) facById.set(f.id, f);
    if (f.name) facByName.set(f.name, f);
  });
  const factionOf = (ref) => (ref ? (facById.get(ref) || facByName.get(ref) || null) : null);

  // ---- 人物 ----
  const characters = arr(scenario.characters);
  const charById = new Map();
  const charByName = new Map();
  characters.forEach((c) => {
    if (!c.id) report('ref.entity.id', c.name, '人物没有 id');
    if (!c.sid) report('ref.entity.sid', c.name, '人物没有 sid');
    if (c.id && charById.has(c.id)) report('ref.char.duplicateId', c.name, c.id + ' 已被 ' + charById.get(c.id).name + ' 使用');
    if (c.name && charByName.has(c.name)) report('ref.char.duplicateName', c.name, '同名人物');
    if (c.id && !charById.has(c.id)) charById.set(c.id, c);
    if (c.name && !charByName.has(c.name)) charByName.set(c.name, c);
  });
  const charOf = (ref) => (ref ? (charById.get(ref) || charByName.get(ref) || null) : null);

  // ---- 地块与省道 ----
  const map = isObj(scenario.map) ? scenario.map : {};
  const regions = arr(map.regions);
  const regionById = new Map();
  const regionByName = new Map();
  regions.forEach((r) => {
    if (regionById.has(r.id)) report('ref.region.duplicateId', r.name, r.id);
    if (regionByName.has(r.name)) report('ref.region.duplicateName', r.name, regionByName.get(r.name).id + ' 与 ' + r.id);
    if (!regionById.has(r.id)) regionById.set(r.id, r);
    if (!regionByName.has(r.name)) regionByName.set(r.name, r);
  });
  const isRegionRef = (ref) => !!ref && (regionById.has(ref) || regionByName.has(ref));

  regions.forEach((r) => {
    const ownerOk = [r.owner, r.currentOwner, r.factionId, r.ownerName, r.factionName].some((x) => factionOf(x));
    if (!ownerOk) report('ref.region.owner', r.name, String(r.owner || r.currentOwner || r.factionId || '(空)'));
    arr(r.neighbors).forEach((n) => {
      const other = regionById.get(n);
      if (!other) report('ref.region.neighbor', r.name, '指向不存在的 ' + n);
      else if (!arr(other.neighbors).includes(r.id)) report('ref.region.neighbor', r.name, '与 ' + other.name + ' 不对称');
    });
  });

  const circuits = arr(map.circuitRegistry);
  if (circuits.length) {
    const membership = new Map();
    const addMember = (regionId) => membership.set(regionId, (membership.get(regionId) || 0) + 1);
    const circuitKeys = new Set();
    circuits.forEach((c) => {
      [c.id, c.key].filter(Boolean).forEach((k) => circuitKeys.add(k));
      if (!Array.isArray(c.memberRegionIds)) {
        report('fmt.circuitSchema', c.name, '只有 ' + Object.keys(c).filter((k) => /member/i.test(k)).join('、'));
        return;
      }
      c.memberRegionIds.forEach((id) => {
        if (!regionById.has(id)) report('ref.circuit.member', c.name, id);
        else addMember(id);
      });
    });
    regions.forEach((r) => {
      let n = membership.get(r.id) || 0;
      // 省道登记没有成员表时，退回地块自己声明的上级
      if (n === 0 && (circuitKeys.has(r.parentId) || circuitKeys.has(r.circuitId))) n = 1;
      if (n !== 1) report('ref.circuit.coverage', r.name, n === 0 ? '不属于任何省道' : '属于 ' + n + ' 个省道');
    });
  }

  // ---- 行政树 ----
  const adminHierarchy = isObj(scenario.adminHierarchy) ? scenario.adminHierarchy : {};
  const divisionById = new Map();
  const leaves = [];
  const allNodes = [];
  Object.entries(adminHierarchy).forEach(([treeKey, tree]) => {
    if (!isObj(tree)) return;
    if (treeKey !== 'player' && !factionOf(treeKey)) {
      report('ref.admin.treeKey', treeKey, '树上写的是 ' + (tree.factionName || tree.name || '') + ' / ' + (tree.factionId || ''));
    }
    if (tree.factionId && !facById.has(tree.factionId)) report('ref.admin.treeFactionId', treeKey, tree.factionId);
    (function walk(nodes, parent) {
      arr(nodes).forEach((d) => {
        if (!isObj(d)) return;
        allNodes.push({ node: d, parent });
        if (d.id) {
          if (divisionById.has(d.id)) report('ref.admin.duplicateId', d.name, d.id);
          else divisionById.set(d.id, d);
        }
        const kids = arr(d.children);
        if (kids.length) walk(kids, d);
        else leaves.push({ node: d, parent });
      });
    })(tree.divisions, null);
  });

  const boundRegionIds = new Set();
  leaves.forEach(({ node }) => {
    const regionId = node.mapRegionId || arr(node.mappedRegions)[0];
    if (!regionId) return;
    if (regionById.has(regionId)) boundRegionIds.add(regionId);
    else if (divisionById.has(regionId)) report('ref.admin.nonTerritoryLeaf', node.name, '挂在 ' + divisionById.get(regionId).name);
    else report('ref.admin.leafRegion', node.name, regionId);
  });
  if (leaves.length) {
    regions.forEach((r) => {
      if (boundRegionIds.has(r.id)) return;
      if (arr(r.accountingLeafIds).some((id) => divisionById.has(id))) return;
      report('ref.admin.regionUnbound', r.name, r.id);
    });
  }

  // ---- 区划数值、格式、文字 ----
  const descriptionUse = new Map();
  allNodes.forEach(({ node }) => {
    const text = String(node.description || node.desc || '').trim();
    if (!text) return;
    descriptionUse.set(text, (descriptionUse.get(text) || 0) + 1);
    if (META_TEXT_RE.test(text)) report('text.meta', node.name, text.slice(0, 60));
  });
  descriptionUse.forEach((n, text) => {
    if (n >= 3) for (let i = 0; i < n; i++) report('text.templated', '(' + n + ' 处)', text.slice(0, 60));
  });

  leaves.forEach(({ node, parent }) => {
    const name = node.name;
    if (node.population !== undefined && typeof node.population !== 'number') report('fmt.population', name, typeof node.population);
    const mouths = populationOf(node);
    const detail = isObj(node.populationDetail) ? node.populationDetail : (isObj(node.population) ? node.population : {});
    const households = num(detail.households);
    const ding = num(detail.ding);
    if (!mouths) report('num.zeroPopulation', name, String(mouths));
    else {
      if (households !== null && households > mouths) report('num.householdsOverMouths', name, households + ' > ' + mouths);
      if (ding !== null && ding > mouths) report('num.dingOverMouths', name, ding + ' > ' + mouths);
      if (households && (mouths / households < 2 || mouths / households > 12)) report('num.mouthsPerHousehold', name, (mouths / households).toFixed(2));
    }
    ['minxin', 'minxinLocal', 'corruption', 'corruptionLocal', 'prosperity', 'unrest'].forEach((k) => {
      if (node[k] === undefined) return;
      const v = num(node[k]);
      if (v === null || v < 0 || v > 100) report('num.outOfRange', name, k + '=' + JSON.stringify(node[k]));
    });
    const fiscal = isObj(node.fiscalDetail) ? node.fiscalDetail : {};
    const claimed = num(fiscal.claimedRevenue);
    const actual = num(fiscal.actualRevenue);
    if (claimed !== null && actual !== null && actual > claimed * 1.001) report('num.actualOverClaimed', name, actual + ' > ' + claimed);
    const farmland = num(isObj(node.economyBase) ? node.economyBase.farmland : null);
    if (farmland !== null && farmland > 0 && farmland < 100 && mouths > 1000) report('num.farmlandUnit', name, String(farmland));
    ['byAge', 'byGender', 'byEthnicity', 'byFaith', 'bySettlement'].forEach((k) => {
      if (isObj(node[k]) && Object.values(node[k]).some((v) => typeof v === 'string')) report('fmt.percentString', name, k);
    });
    if (node.carryingCapacity !== undefined && node.carryingCapacity !== null && !isObj(node.carryingCapacity)) report('fmt.carryingCapacity', name, typeof node.carryingCapacity);
    if (typeof node.terrain === 'string' && /^[A-Za-z_\- ]+$/.test(node.terrain)) report('fmt.terrainEnglish', name, node.terrain);
    if (parent && parent.terrain !== undefined && parent.specialResources !== undefined && parent.tags !== undefined
      && node.terrain === parent.terrain
      && node.specialResources === parent.specialResources
      && JSON.stringify(node.tags) === JSON.stringify(parent.tags)
      && node.minxinLocal === parent.minxinLocal
      && node.corruptionLocal === parent.corruptionLocal) {
      report('leaf.copiedFromParent', name, '上级 ' + parent.name);
    }
  });

  // 同一上级下人口相同（容差万分之五，吸收平分时的取整差）
  const leavesByParent = new Map();
  leaves.forEach(({ node, parent }) => {
    if (!parent) return;
    const list = leavesByParent.get(parent) || [];
    list.push(node);
    leavesByParent.set(parent, list);
  });
  leavesByParent.forEach((list, parent) => {
    const values = list.map((n) => ({ n, v: populationOf(n) })).filter((x) => x.v > 0).sort((a, b) => a.v - b.v);
    let group = [];
    const flush = () => {
      if (group.length >= 3) group.forEach((x) => report('leaf.equalSplit', x.n.name, parent.name + ' 下 ' + group.length + ' 块同为 ' + x.v));
      group = [];
    };
    values.forEach((x) => {
      if (group.length && (x.v - group[group.length - 1].v) / x.v > 0.0005) flush();
      group.push(x);
    });
    flush();
  });

  // ---- 人物引用 ----
  const startYear = num(scenario.startYear) || num(isObj(scenario.time) ? scenario.time.year : null);
  const partyNames = new Set(arr(scenario.parties).map((p) => p.name).filter(Boolean));
  const partyIds = new Set(arr(scenario.parties).map((p) => p.id).filter(Boolean));
  const classNames = new Set(arr(scenario.classes).map((c) => c.name).filter(Boolean));
  const classIds = new Set(arr(scenario.classes).map((c) => c.id).filter(Boolean));
  characters.forEach((c) => {
    if (c.faction && !factionOf(c.faction)) report('ref.char.faction', c.name, c.faction);
    if (c.factionId && !facById.has(c.factionId)) report('ref.char.factionId', c.name, c.factionId);
    if (c.faction && c.factionId && factionOf(c.faction) && facById.has(c.factionId) && factionOf(c.faction) !== facById.get(c.factionId)) {
      report('ref.char.factionConflict', c.name, c.faction + ' / ' + c.factionId);
    }
    ['regionId', 'mapRegionId', 'locationId'].forEach((k) => {
      if (c[k] && !regionById.has(c[k])) report('ref.char.region', c.name, k + '=' + c[k]);
    });
    const age = num(c.age);
    const birthYear = num(c.birthYear);
    if (age !== null && (age < 0 || age > 110)) report('ref.char.age', c.name, '年龄 ' + age);
    else if (startYear !== null && age !== null && birthYear !== null && Math.abs(age - (startYear - birthYear)) > 2) {
      report('ref.char.age', c.name, '年龄 ' + age + '，生年 ' + birthYear);
    }
    if (c.party && !partyNames.has(c.party) && !partyIds.has(c.party)) report('ref.char.party', c.name, c.party);
    arr(c.partyIds).forEach((p) => { if (!partyIds.has(p) && !partyNames.has(p)) report('ref.char.party', c.name, p); });
    if (typeof c.class === 'string' && c.class && classNames.size && !classNames.has(c.class) && !classIds.has(c.class)) {
      report('ref.char.class', c.name, c.class);
    }
  });

  // ---- 势力引用 ----
  factions.forEach((f) => {
    const leader = typeof f.leader === 'string' ? f.leader : (isObj(f.leader) ? f.leader.name : '');
    if (leader && !PLACEHOLDER_RE.test(leader)) {
      const lc = charOf(leader);
      if (!lc) report('ref.faction.leader', f.name, leader);
      else {
        if (lc.alive === false) report('ref.faction.leaderDead', f.name, leader);
        const lcFaction = factionOf(lc.faction) || factionOf(lc.factionId);
        if (lcFaction && lcFaction !== f) report('ref.faction.leaderForeign', f.name, leader + ' 属 ' + lcFaction.name);
      }
    }
    const capital = f.capital || f.capitalName;
    if (capital && !isRegionRef(capital)) report('ref.faction.capital', f.name, capital);
  });

  // ---- 官制 ----
  (function walkOffices(nodes) {
    arr(nodes).forEach((dept) => {
      arr(dept.positions).forEach((p) => {
        const holderNames = []
          .concat(typeof p.holder === 'string' && p.holder ? p.holder.split(/[、,，\/]/) : [])
          .concat(arr(p.holders).map((h) => (isObj(h) ? h.name : h)))
          .map((h) => String(h || '').trim())
          .filter((h) => h && !PLACEHOLDER_RE.test(h));
        holderNames.forEach((h) => {
          const hc = charOf(h) || charOf(p.holderId);
          if (!hc) report('ref.office.holder', dept.name + '·' + p.name, h);
          else if (hc.alive === false) report('ref.office.holderDead', dept.name + '·' + p.name, h);
        });
      });
      walkOffices(dept.subs);
    });
  })(scenario.officeTree);

  // ---- 军队 ----
  arr(isObj(scenario.military) ? scenario.military.initialTroops : null).forEach((t) => {
    const commander = String(t.commander || '').trim();
    const cc = charOf(t.commanderId) || charOf(commander);
    if (commander && !PLACEHOLDER_RE.test(commander) && !cc) report('ref.army.commander', t.name, commander);
    if (cc && cc.alive === false) report('ref.army.commanderDead', t.name, cc.name);
    if (t.faction && !factionOf(t.faction)) report('ref.army.faction', t.name, t.faction);
    const garrison = t.garrisonRegionId || t.regionId || t.mapRegionId;
    if (garrison && !isRegionRef(garrison)) report('ref.army.garrison', t.name, garrison);
  });

  // ---- 党派、阶层 ----
  arr(scenario.parties).forEach((p) => {
    if (!p.id) report('ref.entity.id', p.name, '党派没有 id');
    if (!p.sid) report('ref.entity.sid', p.name, '党派没有 sid');
    const leader = typeof p.leader === 'string' ? p.leader.trim() : '';
    if (leader && !PLACEHOLDER_RE.test(leader) && !charOf(leader)) report('ref.party.leader', p.name, leader);
    if (p.faction && !factionOf(p.faction)) report('ref.party.faction', p.name, p.faction);
  });
  arr(scenario.classes).forEach((c) => {
    if (!c.id) report('ref.entity.id', c.name, '阶层没有 id');
    if (!c.sid) report('ref.entity.sid', c.name, '阶层没有 sid');
    if (c.faction && !factionOf(c.faction)) report('ref.class.faction', c.name, c.faction);
  });

  // ---- 关系 ----
  arr(scenario.relations).forEach((r) => {
    const ends = [r.from || r.a || r.source || r.char1, r.to || r.b || r.target || r.char2];
    ends.forEach((x) => { if (x && !charOf(x)) report('ref.relation.char', ends.join('—'), x); });
  });
  arr(scenario.factionRelations).forEach((r) => {
    const ends = [r.from || r.a || r.source || r.faction1, r.to || r.b || r.target || r.faction2];
    ends.forEach((x) => { if (x && !factionOf(x)) report('ref.relation.faction', ends.join('—'), x); });
  });

  // ---- 死字段 ----
  const dead = collectDeadFields(scenario, corpus);
  let deadTotal = 0;
  dead.forEach((entry) => { deadTotal += entry.count; });
  if (deadTotal) counts['field.dead'] = deadTotal;
  const deadList = [...dead.entries()]
    .map(([key, entry]) => ({ key, count: entry.count, samplePath: entry.samplePath }))
    .sort((a, b) => b.count - a.count);

  return { counts, issues, deadList };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const reportIndex = args.indexOf('--report');
  const reportDir = reportIndex >= 0 ? path.resolve(args[reportIndex + 1] || 'scenario-data-report') : null;
  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
  if (only && !SCENARIOS.some((s) => s.key === only)) {
    console.error('[lint-scenario-data] --only 只接受 ' + SCENARIOS.map((s) => s.key).join(' / '));
    process.exit(2);
  }
  if (update && only) {
    console.error('[lint-scenario-data] --update 要三部一起跑，不能和 --only 同用');
    process.exit(2);
  }

  const corpus = loadCorpusTokens();
  const baseline = lib.loadJSON(BASELINE_FILE, null);
  const current = {};
  const violations = [];
  const improvements = [];
  console.log('[lint-scenario-data] 运行时语料 ' + corpus.files + ' 个脚本');

  for (const entry of SCENARIOS) {
    if (only && entry.key !== only) continue;
    const sourcePath = path.join(REPO_ROOT, 'scenarios', entry.file);
    const scenario = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const result = auditScenario(scenario, corpus.tokens);
    current[entry.key] = result.counts;
    const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
    console.log('\n[lint-scenario-data] ' + entry.file.replace(/\.json$/, '') + '：' + total + ' 处');

    const base = (baseline && baseline.scenarios && baseline.scenarios[entry.key]) || {};
    const ruleIds = [...new Set(Object.keys(result.counts).concat(Object.keys(base)))].sort();
    ruleIds.forEach((rule) => {
      const now = result.counts[rule] || 0;
      const before = base[rule] || 0;
      const mark = now > before ? '  ↑ 超基线' : (now < before ? '  ↓ 可收紧' : '');
      console.log('  ' + rule.padEnd(28) + String(now).padStart(7) + '  （基线 ' + before + '）' + (RULES[rule] ? '  ' + RULES[rule] : '') + mark);
      if (now > before) violations.push(entry.key + ' · ' + rule + ' ' + before + ' → ' + now);
      if (now < before) improvements.push(entry.key + ' · ' + rule + ' ' + before + ' → ' + now);
    });

    if (reportDir) {
      fs.mkdirSync(reportDir, { recursive: true });
      const byRule = {};
      result.issues.forEach((i) => { (byRule[i.rule] = byRule[i.rule] || []).push(i.subject + '：' + i.detail); });
      fs.writeFileSync(path.join(reportDir, entry.key + '.issues.json'), JSON.stringify({ counts: result.counts, byRule }, null, 1));
      fs.writeFileSync(path.join(reportDir, entry.key + '.dead-fields.txt'),
        result.deadList.map((d) => String(d.count).padStart(7) + '  ' + d.key.padEnd(34) + d.samplePath).join('\n') + '\n');
    }
  }

  if (update) {
    lib.saveJSON(BASELINE_FILE, {
      note: '官方剧本数据棘轮基线：每部剧本每条规则的问题数，只许减不许增。规则见 lint-scenario-data.js 头注。',
      updatedAt: new Date().toISOString(),
      scenarios: current
    });
    console.log('\n[lint-scenario-data] 基线已更新 → ' + lib.rel(BASELINE_FILE));
    process.exit(0);
  }
  if (!baseline) {
    console.error('\n[lint-scenario-data] 无基线。先跑：node scripts/lint-scenario-data.js --update');
    process.exit(1);
  }
  if (improvements.length) console.log('\n[lint-scenario-data] 有 ' + improvements.length + ' 项比基线少，确认后用 --update 收紧。');
  if (violations.length) {
    console.error('\n[lint-scenario-data] FAIL — 以下问题数超过基线：');
    violations.forEach((v) => console.error('  ' + v));
    process.exit(1);
  }
  console.log('\n[lint-scenario-data] PASS — 没有问题数超过基线');
}

module.exports = { RULES, auditScenario, loadCorpusTokens };

if (require.main === module) main();

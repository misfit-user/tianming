#!/usr/bin/env node
// smoke-map-circuits.js — 省道（通志）数据层 TM.MapCircuits 的行为测试
//
// 覆盖三部官方剧本的三种省道形态（天启：登记绑定省级节点；晚唐：登记 key 即道节点 id；绍宋：只有登记、没有路级节点），
// 外加旧地图（无层级数据）、多势力分占、问题排序可复现、纯函数不改输入。
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const layout = require('../tm-map-realm-layout.js');
const circuits = require('../tm-map-circuits.js');

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

// 最小可用的矩形地块
function rect(x, y, w, h) {
  return { points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] };
}

function region(id, name, owner, extra) {
  return Object.assign(rect(0, 0, 10, 10), { id: id, name: name, level: 'prefecture', owner: owner }, extra || {});
}

function ownerOf(r) {
  return r.owner;
}

// 用一张小表模拟 findLiveAdminDivision：先按 id，再按名称
function adminFinder(nodes) {
  return function (ref) {
    if (ref.id) return nodes.find((n) => n.id === ref.id) || null;
    if (ref.name) return nodes.find((n) => n.name === ref.name) || null;
    return null;
  };
}

// ── 天启式 ─────────────────────────────────────────────

const tianqiMap = {
  regions: [
    region('ming-01-p01', '顺天府', 'ming', { parentId: 'cz-province-ming-01', data: { capital: true } }),
    region('ming-01-p02', '保定府', 'ming', { parentId: 'cz-province-ming-01' }),
    region('ming-01-p03', '永平府', 'houjin', { parentId: 'cz-province-ming-01' }),
    region('ming-02-p01', '西安府', 'ming', { parentId: 'cz-province-ming-02' })
  ],
  circuitRegistry: [
    { id: 'cz-province-ming-01', key: 'cz-province-ming-01', name: '北直隶', level: 'province', sourceAdminId: 'div_bzl' },
    { id: 'cz-province-ming-02', key: 'cz-province-ming-02', name: '陕西', level: 'province', sourceAdminId: 'div_sx' }
  ]
};
const tianqiAdmin = [
  {
    id: 'div_bzl', name: '北直隶', level: 'province',
    officialPosition: '顺天巡抚', governor: '刘诏',
    population: 8200000, minxinLocal: 46,                   // 冻结的开局数字，汇总时绝不能读
    strategicValue: '首善之区', threats: ['后金入塞'], leadingGentry: ['保定李氏'], academies: ['首善书院'],
    description: '畿辅重地，拱卫京师。',
    capitalChildId: 'div_pref_01',
    prefectures: [{ id: 'div_pref_01', name: '顺天府' }, { id: 'div_pref_02', name: '保定府' }]
  }
];

check('天启：同一省道跨势力仍是一个实体，key 与地图分组同源', () => {
  const index = circuits.indexCircuits(tianqiMap, { layout: layout, ownerOf: ownerOf });
  const bzl = index.circuits.get('cz-province-ming-01');
  assert.ok(bzl, '北直隶应被识别');
  assert.equal(bzl.label, '北直隶');
  assert.equal(bzl.members.length, 3, '被后金占去的永平府仍算北直隶成员');
  const owners = tianqiMap.regions.map(ownerOf);
  const rows = layout.administrativeGroups(tianqiMap, owners);
  tianqiMap.regions.forEach((r, i) => {
    assert.equal(circuits.circuitOf(index, r).key, rows[i].key, r.name + ' 的省道 key 必须与地图分组一致');
  });
  assert.ok(circuits.isRealCircuit(bzl));
});

check('天启：按本方切分，他属州单列', () => {
  const index = circuits.indexCircuits(tianqiMap, { layout: layout, ownerOf: ownerOf });
  const parts = circuits.partitionByOwner(index.circuits.get('cz-province-ming-01'), 'ming');
  assert.deepEqual(parts.own.map((r) => r.name), ['顺天府', '保定府']);
  assert.equal(parts.others.length, 1);
  assert.equal(parts.others[0].owner, 'houjin');
  assert.deepEqual(parts.others[0].regions.map((r) => r.name), ['永平府']);
});

check('天启：档案经 sourceAdminId 取到巡抚与治所', () => {
  const index = circuits.indexCircuits(tianqiMap, { layout: layout, ownerOf: ownerOf });
  const profile = circuits.profileOf(index.circuits.get('cz-province-ming-01'), { findAdmin: adminFinder(tianqiAdmin) });
  assert.equal(profile.source, 'admin');
  assert.equal(profile.adminId, 'div_bzl');
  assert.equal(profile.governor, '刘诏');
  assert.equal(profile.officialPosition, '顺天巡抚');
  assert.equal(profile.capital, '顺天府');
  assert.equal(profile.strategicValue, '首善之区');
  assert.deepEqual(profile.threats, ['后金入塞']);
  assert.deepEqual(profile.gentry, ['保定李氏']);
  assert.deepEqual(profile.academies, ['首善书院']);
  assert.equal(profile.description, '畿辅重地，拱卫京师。', '通志页头的描述取自省道节点的文字');
});

check('天启：汇总只读府州实时数，不读省级节点冻结的户口与民心', () => {
  const index = circuits.indexCircuits(tianqiMap, { layout: layout, ownerOf: ownerOf });
  const own = circuits.partitionByOwner(index.circuits.get('cz-province-ming-01'), 'ming').own;
  const live = {
    '顺天府': {
      data: { population: 3000000, garrison: 40000 }, pop: { ding: 800000 },
      fiscal: { actualRevenue: 90000, claimedRevenue: 100000, remittedToCenter: 60000, retainedBudget: 30000, compliance: 0.8 },
      liveDivision: { publicTreasury: { money: { stock: 1200 }, grain: { stock: 500 } } }
    },
    '保定府': {
      data: { population: 2000000, publicTreasury: { money: { stock: 800 } } }, pop: { ding: 500000 },
      fiscal: { actualRevenue: 50000, claimedRevenue: 300000, compliance: 0.4 }, army: { troops: 12000 }
    }
  };
  const moods = { '顺天府': 60, '保定府': 40 };
  const offices = { '顺天府': 70, '保定府': 20 };
  const sum = circuits.summarize(own, {
    bundle: (r) => live[r.name],
    mood: (r) => moods[r.name],
    office: (r) => offices[r.name]
  });
  assert.equal(sum.count, 2);
  assert.equal(sum.population, 5000000, '户口是两州实时数之和，不是省级节点的 8200000');
  assert.equal(sum.actualRevenue, 140000);
  assert.equal(sum.remittedToCenter, 60000);
  assert.equal(sum.retainedBudget, 30000);
  assert.equal(sum.troops, 52000);
  assert.equal(sum.mood, 52, '民心按人口加权：(60×300万 + 40×200万) / 500万');
  assert.equal(sum.office, 50, '吏治按人口加权：(70×300万 + 20×200万) / 500万');
  assert.equal(sum.ding, 1300000);
  assert.equal(sum.claimedRevenue, 400000);
  assert.equal(sum.compliance, 0.5, '合规与方志同口径：各州 compliance 按应征加权（0.8×10万 + 0.4×30万）/ 40万，不是实征 / 应征');
  assert.equal(sum.garrisoned, 2, '两州都有驻军');
  assert.deepEqual(sum.treasury, { money: 2000, grain: 500 }, '公帑取各州地方库藏，活区划优先、其次地块数据');
});

// ── 晚唐式 ─────────────────────────────────────────────

const tangMap = {
  regions: [
    region('t-1', '太原府', 'tang', { parentId: 'circuit-hedong', circuitTitle: '河东节度', circuitGovernor: '', capital: true }),
    region('t-2', '岚州', 'tang', { parentId: 'circuit-hedong', circuitTitle: '河东节度', circuitGovernor: '' }),
    region('t-3', '石州', 'tang', { parentId: 'circuit-hedong', circuitTitle: '河东节度', circuitGovernor: '' })
  ],
  circuitRegistry: [{ key: 'circuit-hedong', name: '河东', commandType: '节度', faction: '唐朝廷' }]
};
const tangAdmin = [
  { id: 'circuit-hedong', name: '河东', level: 'province', historicalTitle: '河东节度', commandType: '节度', custodyNote: '太原仓储与边军请给分账。', population: { mouths: 0, households: 0 } }
];

check('晚唐：登记 key 就是道节点 id，官衔可取，人名为空时留空', () => {
  const index = circuits.indexCircuits(tangMap, { layout: layout, ownerOf: ownerOf });
  const hedong = index.circuits.get('circuit-hedong');
  assert.equal(hedong.members.length, 3);
  const profile = circuits.profileOf(hedong, { findAdmin: adminFinder(tangAdmin) });
  assert.equal(profile.source, 'admin');
  assert.equal(profile.title, '河东节度');
  assert.equal(profile.commandType, '节度');
  assert.equal(profile.governor, '', '晚唐的道级长官人名为空，由界面写「未录」');
  assert.equal(profile.custodyNote, '太原仓储与边军请给分账。');
  assert.equal(profile.capital, '太原府');
});

check('晚唐：道节点上的 { mouths: 0 } 不参与汇总，数字来自各州', () => {
  const index = circuits.indexCircuits(tangMap, { layout: layout, ownerOf: ownerOf });
  const sum = circuits.summarize(index.circuits.get('circuit-hedong').members.map((m) => m.region), {
    bundle: (r) => ({ pop: { mouths: { '太原府': '120000', '岚州': 30000, '石州': 'abc' }[r.name] } })
  });
  assert.equal(sum.population, 150000, '数字字符串照常计入');
  assert.equal(sum.missing.population, 1, '读不出数的州记为缺失，不当成 0 悄悄吞掉');
});

// ── 绍宋式 ─────────────────────────────────────────────

const songMap = {
  regions: [
    region('ss-1', '开封府', 'song', { parentId: 'ss-circuit-jingji' }),
    region('ss-2', '陈留县', 'song', { parentId: 'ss-circuit-jingji' })
  ],
  circuitRegistry: [{ key: 'ss-circuit-jingji', id: 'ss-circuit-jingji', name: '京畿路', note: '以开封及现有京畿县块聚合' }]
};

check('绍宋：没有路级节点时只用登记备注；按名字撞上的同名府州必须被拒', () => {
  const index = circuits.indexCircuits(songMap, { layout: layout, ownerOf: ownerOf });
  const jingji = index.circuits.get('ss-circuit-jingji');
  const decoy = [{ id: 'x', name: '京畿路', level: 'prefecture' }];   // 没有下辖、层级不是省道
  const profile = circuits.profileOf(jingji, { findAdmin: adminFinder(decoy) });
  assert.equal(profile.source, 'registry');
  assert.equal(profile.adminId, '');
  assert.equal(profile.note, '以开封及现有京畿县块聚合');
  assert.equal(profile.governor, '');
});

// ── 旧地图与异常输入 ───────────────────────────────────

check('旧地图没有层级数据：每块自成一组，且不算正式省道', () => {
  const legacy = { regions: [region('a', '甲', 'A'), region('b', '乙', 'A')] };
  const index = circuits.indexCircuits(legacy, { layout: layout, ownerOf: ownerOf });
  assert.equal(index.circuits.size, 2, '没有 parentId 的地块不能被合并');
  index.circuits.forEach((c) => assert.equal(circuits.isRealCircuit(c), false));
});

check('缺少分组函数或地图为空时返回空索引，不抛错', () => {
  assert.equal(circuits.indexCircuits(tianqiMap, {}).circuits.size, 0);
  assert.equal(circuits.indexCircuits(null, { layout: layout }).circuits.size, 0);
  assert.equal(circuits.circuitOf(null, tianqiMap.regions[0]), null);
  assert.deepEqual(circuits.partitionByOwner(null, 'ming'), { own: [], others: [] });
  assert.equal(circuits.summarize(null, {}).count, 0);
  assert.deepEqual(circuits.rankProblems(null, {}), []);
});

// ── 问题轻重排序 ───────────────────────────────────────

check('问题排序按固定规则、可复现，并给出原因', () => {
  const rs = [region('z', '丁州', 'A'), region('y', '丙州', 'A'), region('x', '甲州', 'A'), region('w', '乙州', 'A')];
  const scores = {
    '甲州': { mood: 21, office: 88 },
    '乙州': { mood: 30 },
    '丙州': {},
    '丁州': {}
  };
  const hooks = {
    score: (r, mode) => (scores[r.name][mode] === undefined ? '' : scores[r.name][mode]),
    grade: (mode, value) => ({ mark: value >= 80 ? '蠹' : '危' }),
    isWarn: (mode, grade) => !!grade,
    statusOf: (r) => (r.name === '丙州' ? [{ kind: 'disaster', name: '旱蝗' }, { kind: 'wonder', name: '祥瑞' }] : []),
    unrestOf: (r) => (r.name === '丙州' ? 72 : 10)
  };
  const first = circuits.rankProblems(rs, hooks);
  assert.deepEqual(first.map((row) => row.region.name), ['甲州', '丙州', '乙州', '丁州']);
  assert.deepEqual(first.map((row) => row.score), [4, 2, 2, 0]);
  assert.deepEqual(first[0].reasons, ['民心 21 危', '吏治 88 蠹']);
  assert.deepEqual(first[1].reasons, ['旱蝗', '不稳 72'], '只有灾异计分，祥瑞不算问题');
  const again = circuits.rankProblems(rs.slice().reverse(), hooks);
  assert.deepEqual(again.map((row) => row.region.name), first.map((row) => row.region.name), '输入顺序不影响结果');
  assert.deepEqual(first[0].issues.map((issue) => issue.key), ['mode:mood:危', 'mode:office:蠹'], '结构化问题与原因一一对应');
});

check('共性上提：全道同档的问题提到道一级，各州只留独有问题，同分按人口排', () => {
  // 天启开局的样子：四州民心同为「忧」、吏治同为「蠹」，只有乙州另有灾异
  const rs = [region('a', '甲州', 'A'), region('b', '乙州', 'A'), region('c', '丙州', 'A'), region('d', '丁州', 'A')];
  const pops = { '甲州': 50, '乙州': 10, '丙州': 90, '丁州': 70 };
  const hooks = {
    score: (r, mode) => ({ mood: 40 + (r.name === '丙州' ? 1 : 0), office: 97 })[mode] ?? '',
    grade: (mode) => ({ mark: mode === 'mood' ? '忧' : '蠹' }),
    isWarn: () => true,
    statusOf: (r) => (r.name === '乙州' ? [{ kind: 'disaster', name: '蝗灾' }] : [])
  };
  const ranked = circuits.rankProblems(rs, hooks);
  assert.deepEqual(ranked.map((row) => row.score), [5, 4, 4, 4], '不上提时四州几乎同分，排不出轻重');
  const lifted = circuits.liftCommonProblems(ranked, { populationOf: (r) => pops[r.name] });
  assert.deepEqual(lifted.common.map((item) => item.label + ' ' + item.mark), ['民心 忧', '吏治 蠹'], '数值差一分、档位相同，仍算同一种问题');
  assert.equal(lifted.common[0].count, 4);
  assert.deepEqual(lifted.rows.map((row) => row.region.name), ['乙州', '丙州', '丁州', '甲州'], '独有问题在前，其余按人口多少');
  assert.deepEqual(lifted.rows[0].reasons, ['蝗灾']);
  assert.deepEqual(lifted.rows[1].reasons, []);
  const single = circuits.liftCommonProblems(ranked.slice(0, 1), {});
  assert.deepEqual(single.common, [], '只有一州时不归并');
  assert.deepEqual(single.rows[0].reasons, ranked[0].reasons);
  assert.deepEqual(circuits.liftCommonProblems(null, {}), { common: [], rows: [] });
});

check('营造汇总：按状态、类别、州计数，只展示不改账', () => {
  const rs = [region('a', '甲州', 'A'), region('b', '乙州', 'A'), region('c', '丙州', 'A')];
  const builds = {
    '甲州': [{ name: '卫所', status: 'completed' }, { name: '书院', status: 'building' }],
    '乙州': [{ name: '卫所', status: 'damaged' }, { name: '贡院' }, { name: '驿站', status: 'neglected' }],
    '丙州': []
  };
  const categories = { '卫所': 'military', '书院': 'cultural', '贡院': 'cultural' };
  const sum = circuits.summarizeBuildings(rs, { buildingsOf: (r) => builds[r.name], categoryOf: (b) => categories[b.name] });
  assert.equal(sum.total, 5);
  assert.deepEqual(sum.byStatus, { intact: 2, building: 1, neglected: 1, damaged: 1 }, '未标状态与已竣工都算完好');
  assert.deepEqual(sum.byCategory, { military: 2, cultural: 2, other: 1 }, '类型表查不到的归「其他」');
  assert.deepEqual(sum.byRegion.map((row) => row.region.name), ['乙州', '甲州'], '按座数排，没有建筑的州不列');
  assert.equal(circuits.summarizeBuildings(null, {}).total, 0);
});

// ── 纯函数与源码约束 ───────────────────────────────────

check('不改输入：跑完全部接口后地图与节点原样', () => {
  const before = JSON.stringify([tianqiMap, tianqiAdmin, tangMap, tangAdmin, songMap]);
  const index = circuits.indexCircuits(tianqiMap, { layout: layout, ownerOf: ownerOf });
  const bzl = index.circuits.get('cz-province-ming-01');
  circuits.partitionByOwner(bzl, 'ming');
  circuits.profileOf(bzl, { findAdmin: adminFinder(tianqiAdmin) });
  circuits.summarize(bzl.members.map((m) => m.region), { bundle: () => ({}) });
  const ranked = circuits.rankProblems(bzl.members.map((m) => m.region), {});
  circuits.liftCommonProblems(ranked, { populationOf: () => 1 });
  circuits.summarizeBuildings(bzl.members.map((m) => m.region), { buildingsOf: () => [], categoryOf: () => '' });
  assert.equal(JSON.stringify([tianqiMap, tianqiAdmin, tangMap, tangAdmin, songMap]), before);
});

check('源码约束：不碰 GM、P、DOM，也不调 AI', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'tm-map-circuits.js'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // 只查代码，不查注释
  assert.doesNotMatch(code, /\bGM\b/, '不得读写 GM');
  assert.doesNotMatch(code, /\bP\s*\./, '不得读写 P');
  assert.doesNotMatch(code, /\bdocument\b|\bwindow\.document\b/, '不得操作 DOM');
  assert.doesNotMatch(code, /fetch\(|_aiFetch|callAI/i, '不得调用 AI 或网络');
});

console.log('[smoke-map-circuits] ' + checks.length + ' 组检查全部通过');
checks.forEach((name) => console.log('  ok · ' + name));

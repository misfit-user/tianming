#!/usr/bin/env node
// smoke-division-reassign.js — 改隶写口（通志一期 S6）
//
// 用三部官方剧本的原始地图与行政树（不开整局）核对：府州在本方省道之间改隶时，行政树、地图地块、
// 省道登记三处一起改，地图分组（通志、省道边界、描金边都按它走）随之归到新省道；首府不许改出、
// 他方省道不许改入、不接壤可改但提示飞地；任一步失败三处全部撤回；P 与 GM 两份行政树都改；
// 回合末写工具 restructure_division 走同一写口。
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WEB = path.resolve(__dirname, '..');
const DR = require(path.join(WEB, 'tm-division-reassign.js'));
const layout = require(path.join(WEB, 'tm-map-realm-layout.js'));
const SCENARIOS = ['天启七年·九月（官方）.json', '晚唐·开成五年（官方）.json', '绍宋·建炎元年八月（官方）.json'];

const clone = (v) => JSON.parse(JSON.stringify(v));
const ownerOf = (r) => String(r.currentOwnerKey || r.ownerKey || r.stableFactionId || r.currentOwner || r.owner || '');
const checks = [];
function check(name, fn) { fn(); checks.push(name); }

function loadWorld(file) {
  const sc = JSON.parse(fs.readFileSync(path.join(WEB, 'bundled-scenarios', file), 'utf8'));
  return { map: clone(sc.map), gm: { turn: 1, adminHierarchy: clone(sc.adminHierarchy) } };
}
function walkAdmin(ah, test) {
  let found = null;
  const walk = (node, parent) => {
    if (found || !node || typeof node !== 'object') return;
    if (parent && test(node)) { found = { node, parent }; return; }
    for (const k of ['children', 'divisions', 'subDivisions', 'subs']) if (Array.isArray(node[k])) { node[k].forEach((c) => walk(c, node)); break; }
  };
  Object.keys(ah).forEach((k) => walk(ah[k], null));
  return found;
}
function adminOf(gm, r) {
  const ids = [String(r.adminBinding || ''), String(r.id)].filter(Boolean);
  return walkAdmin(gm.adminHierarchy, (n) => ids.indexOf(String(n.id)) >= 0);
}
// 行政节点是不是某条省道登记对应的节点（天启按 sourceAdminId，晚唐按 key，绍宋按名称；天启节点名与登记名可不同）
function isCircuitNode(node, entry) {
  return [String(entry.sourceAdminId || ''), String(entry.key || entry.id)].includes(String(node.id)) || node.name === entry.name;
}
function entryOf(map, key) {
  return map.circuitRegistry.find((e) => String(e.key || e.id) === String(key));
}
// 地图按这个分组画省道边界、写省名；通志、描金边也按它取成员
function groupKeyOf(map, r) {
  const rows = layout.administrativeGroups(map, map.regions.map(ownerOf));
  const row = rows.find((x) => x.region === r);
  return row && row.key;
}
// 玩家势力：行政树 player 根下第一个州的归属
function playerOwner(world) {
  const hit = walkAdmin({ player: world.gm.adminHierarchy.player }, (n) => world.map.regions.some((r) => String(r.adminBinding || r.id) === String(n.id)));
  const r = hit && world.map.regions.find((x) => String(x.adminBinding || x.id) === String(hit.node.id));
  return r ? ownerOf(r) : '';
}
// 挑一个本方、非首府、有接壤本方别道可去的州
function pickMovable(world, owner) {
  for (const r of world.map.regions) {
    if (ownerOf(r) !== owner) continue;
    const opts = { map: world.map, gm: world.gm };
    if (!DR.movable(r, opts).ok) continue;
    const target = DR.targetsFor(r, opts).find((t) => t.adjacent);
    if (target) return { region: r, target };
  }
  return null;
}

for (const file of SCENARIOS) {
  const label = file.replace(/（官方）\.json$/, '');

  check(label + '：改隶后行政树、地块、省道登记三处一致，地图分组归到新省道', () => {
    const world = loadWorld(file), opts = { map: world.map, gm: world.gm };
    const owner = playerOwner(world);
    assert.ok(owner, '找到玩家势力');
    const pick = pickMovable(world, owner);
    assert.ok(pick, '有可改隶的州');
    const r = pick.region, fromKey = DR.circuitOfRegion(r, opts).key, toKey = pick.target.key;
    const hadCircuitId = r.circuitId !== undefined, hadCircuitName = r.circuitName !== undefined;
    assert.equal(groupKeyOf(world.map, r), fromKey, '改前地图把它分在原道');
    const p = DR.plan(r, toKey, opts);
    assert.equal(p.ok, true, p.reason);
    assert.equal(p.enclave, false, '接壤不报飞地');
    const res = DR.apply(r, toKey, opts);
    assert.equal(res.ok, true, res.reason);
    // ③ 省道登记
    assert.ok(entryOf(world.map, toKey).memberRegionIds.map(String).includes(String(r.id)), '新道登记收入此州');
    assert.ok(!entryOf(world.map, fromKey).memberRegionIds.map(String).includes(String(r.id)), '原道登记除去此州');
    // ② 地图地块
    assert.equal(String(r.parentId), toKey, '地块上级改为新道');
    if (hadCircuitId) assert.equal(String(r.circuitId), toKey);
    if (hadCircuitName) assert.equal(r.circuitName, entryOf(world.map, toKey).name);
    // ① 行政树
    const hit = adminOf(world.gm, r);
    const to = entryOf(world.map, toKey);
    assert.ok(hit, '行政树里仍有此州');
    assert.ok(isCircuitNode(hit.parent, to), '行政树里挂到新道节点下：' + hit.parent.name);
    assert.equal(String(hit.node.parentId), String(hit.parent.id || hit.parent.name));
    // 地图分组随之改
    assert.equal(groupKeyOf(world.map, r), toKey, '地图分组归到新道');
    assert.equal(DR.circuitOfRegion(r, opts).key, toKey);
  });

  check(label + '：首府不许改出，他方省道不许改入', () => {
    const world = loadWorld(file), opts = { map: world.map, gm: world.gm };
    const owner = playerOwner(world);
    // 首府：取玩家某道行政节点的 capitalChildId 对应的州
    const capital = world.map.regions.find((r) => ownerOf(r) === owner && DR.movable(r, opts).ok === false && /首府/.test(DR.movable(r, opts).reason));
    assert.ok(capital, '找到本方某道首府');
    const anyTarget = world.map.circuitRegistry.find((e) => e !== world.map.circuitRegistry.find((x) => (x.memberRegionIds || []).map(String).includes(String(capital.id))));
    const p = DR.plan(capital, anyTarget.key || anyTarget.id, opts);
    assert.equal(p.ok, false);
    assert.match(p.reason, /首府|不是本方/, p.reason);
    const pick = pickMovable(world, owner);
    const foreign = world.map.circuitRegistry.find((e) => !(e.memberRegionIds || []).some((id) => { const x = world.map.regions.find((y) => String(y.id) === String(id)); return x && ownerOf(x) === owner; }));
    assert.ok(foreign, '有他方省道');
    const q = DR.plan(pick.region, foreign.key || foreign.id, opts);
    assert.equal(q.ok, false);
    assert.match(q.reason, /不是本方省道/);
  });

  check(label + '：不接壤可改但提示飞地；目标写错时拒绝并给出本方省道名', () => {
    const world = loadWorld(file), opts = { map: world.map, gm: world.gm };
    const owner = playerOwner(world);
    let found = null;
    for (const r of world.map.regions) {
      if (ownerOf(r) !== owner || !DR.movable(r, opts).ok) continue;
      const far = DR.targetsFor(r, opts).find((t) => !t.adjacent);
      if (far) { found = { r, far }; break; }
    }
    if (found) {
      const p = DR.plan(found.r, found.far.key, opts);
      assert.equal(p.ok, true, p.reason);
      assert.equal(p.enclave, true);
      assert.ok(p.warnings.some((w) => /飞地/.test(w)), p.warnings.join('；'));
    }
    const pick = pickMovable(world, owner);
    const bad = DR.plan(pick.region, '子虚乌有道', opts);
    assert.equal(bad.applies, true, '地图上隶于省道的州一律当省道改隶看');
    assert.equal(bad.ok, false);
    assert.match(bad.reason, /找不到目标省道/);
  });

  check(label + '：任一步失败三处全部撤回', () => {
    const world = loadWorld(file), opts = { map: world.map, gm: world.gm };
    const owner = playerOwner(world);
    const pick = pickMovable(world, owner);
    const to = entryOf(world.map, pick.target.key);
    // 把目标省道在行政树里的节点摘掉，行政树那一步就会失败
    const toAdmin = walkAdmin(world.gm.adminHierarchy, (n) => isCircuitNode(n, to));
    assert.ok(toAdmin, '找到目标省道的行政节点');
    const kids = ['children', 'divisions', 'subDivisions', 'subs'].map((k) => toAdmin.parent[k]).find(Array.isArray);
    kids.splice(kids.indexOf(toAdmin.node), 1);
    const before = JSON.stringify({ reg: world.map.circuitRegistry, r: pick.region, ah: world.gm.adminHierarchy });
    const res = DR.apply(pick.region, pick.target.key, opts);
    assert.equal(res.ok, false);
    assert.match(res.reason, /改隶撤回/);
    assert.equal(JSON.stringify({ reg: world.map.circuitRegistry, r: pick.region, ah: world.gm.adminHierarchy }), before, '登记、地块、行政树一字未变');
  });
}

check('P 与 GM 两份行政树都改；共用节点时不重复挪动', () => {
  const world = loadWorld(SCENARIOS[0]);
  const owner = playerOwner(world);
  const pick = pickMovable(world, owner);
  const prevP = globalThis.P;
  try {
    // 两份独立的树
    globalThis.P = { adminHierarchy: clone(world.gm.adminHierarchy) };
    const res = DR.apply(pick.region, pick.target.key, { map: world.map, gm: world.gm });
    assert.equal(res.ok, true, res.reason);
    const inP = adminOf({ adminHierarchy: globalThis.P.adminHierarchy }, pick.region), inGM = adminOf(world.gm, pick.region);
    assert.equal(inP.parent.id, inGM.parent.id, 'P 树与 GM 树挂到同一道');
    assert.ok(isCircuitNode(inGM.parent, entryOf(world.map, pick.target.key)));
    // 共用同一棵树
    const world2 = loadWorld(SCENARIOS[0]);
    const pick2 = pickMovable(world2, owner);
    globalThis.P = { adminHierarchy: world2.gm.adminHierarchy };
    const res2 = DR.apply(pick2.region, pick2.target.key, { map: world2.map, gm: world2.gm });
    assert.equal(res2.ok, true, res2.reason);
    const hit2 = adminOf(world2.gm, pick2.region);
    const kids = ['children', 'divisions'].map((k) => hit2.parent[k]).find(Array.isArray);
    assert.equal(kids.filter((n) => n === hit2.node).length, 1, '新道下只挂一次');
  } finally {
    globalThis.P = prevP;
  }
});

check('回合末写工具 restructure_division 经同一写口三处同步', () => {
  require(path.join(WEB, 'tm-agent-kernel.js'));
  require(path.join(WEB, 'tm-ai-change-pathutils.js'));
  require(path.join(WEB, 'tm-endturn-agent-write-tools.js'));
  const TM = globalThis.TM;
  const WT = TM.Endturn.AgentWriteTools;
  const world = loadWorld(SCENARIOS[0]);
  const owner = playerOwner(world);
  const pick = pickMovable(world, owner);
  const gm = Object.assign(world.gm, { mapData: world.map, _turnReport: [], _agentWriteLog: [] });
  const prev = TM.DivisionReassign;
  TM.DivisionReassign = DR;
  try {
    const toName = entryOf(world.map, pick.target.key).name;
    const r = WT.handleSync('restructure_division', { action: 'modify', region: pick.region.name, fields: { parentId: toName }, reason: '奉旨改隶' }, { GM: gm });
    assert.equal(r.ok, true, r.text);
    assert.equal(r.result.adapter, 'TM.DivisionReassign');
    assert.equal(String(pick.region.parentId), pick.target.key, '地块上级随写工具改');
    assert.ok(entryOf(world.map, pick.target.key).memberRegionIds.map(String).includes(String(pick.region.id)), '登记随写工具改');
    assert.ok(isCircuitNode(adminOf(gm, pick.region).parent, entryOf(world.map, pick.target.key)), '行政树随写工具改');
    assert.ok(gm._turnReport.some((e) => e && e._op === 'division_modify' && /改隶=/.test(e.new)), '写即报告');
    // 首府改出：写工具照写口拒绝，一处不改
    const capital = world.map.regions.find((x) => ownerOf(x) === owner && /首府/.test(DR.movable(x, { map: world.map, gm }).reason || ''));
    const before = JSON.stringify(world.map.circuitRegistry);
    const bad = WT.handleSync('restructure_division', { action: 'modify', region: capital.name, fields: { parentId: toName } }, { GM: gm });
    assert.equal(bad.ok, false);
    assert.match(bad.text, /首府/);
    assert.equal(JSON.stringify(world.map.circuitRegistry), before);
  } finally {
    TM.DivisionReassign = prev;
  }
});

console.log('[smoke-division-reassign] ' + checks.length + ' 组检查全部通过');
checks.forEach((name) => console.log('  ok · ' + name));

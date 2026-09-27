// 省道长官 smoke 共用开局与取数；每个调用进程只开一局，不连接真实 AI。
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const WEB = path.resolve(__dirname, '..');

// 沿通志 smoke 的 VM 开局方式，复用完整官方剧本装载与校验。
async function boot(sid) {
  const helperFile = path.join(__dirname, 'smoke-start-game-data-integrity.js');
  const source = fs.readFileSync(helperFile, 'utf8').replace(/^#![^\n]*\n/, '');
  const end = source.indexOf('(async function main()');
  assert(end >= 0, '开局 helper 边界存在');
  const helpers = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports',
    source.slice(0, end) + '\nreturn { loadGame };')(require, process, __dirname, helperFile, { exports: {} }, {});
  const context = helpers.loadGame(sid);
  vm.runInContext(`P.ai.key='';P.ai.url='';P.ai.model='';doActualStart(${JSON.stringify(sid)})`, context, { timeout: 120000 });
  await new Promise(resolve => setTimeout(resolve, 300));
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-map-realm-layout.js'), 'utf8'), context, { filename: 'tm-map-realm-layout.js' });
  const gm = context.GM, parts = context.TMPhase8FormalBridge.__p8MapParts, MC = context.TM.MapCircuits;
  assert(gm && gm.chars && gm.chars.length, '真实开局已产生人物');
  const player = gm.adminHierarchy.player;
  const faction = parts.findFaction(player.factionId || player.factionName || player.name, '') || {};
  const owner = faction.stableOwnerKey || faction.mapFactionId || faction.id || player.factionId;
  const index = MC.indexCircuits(gm.mapData, { layout: context.TMMapRealmLayout, ownerOf: parts.canonicalOwnerKey });
  const circuits = Array.from(index.circuits.values()).filter(circuit => MC.isRealCircuit(circuit) && MC.partitionByOwner(circuit, owner).own.length);
  assert(circuits.length > 0, '本方正式省道不为空');
  // VM 不解析 HTML，单独隔离弹出册页节点，避免共享默认节点污染标记。
  vm.runInContext(`var __govBook = document.createElement('div'), __govGetById = document.getElementById;
    document.getElementById = function(id){ return id === 'ppop' ? __govBook : __govGetById.call(document, id); };`, context);
  return { context, gm, parts, MC, owner, circuits, api: context.TM.CircuitGovernance, division: context.TM.DivisionReassign };
}

// 保存属性是否存在以及原值，所有临时测试写入在 finally 中完整恢复。
function withFields(object, fields, test) {
  const before = Object.keys(fields).map(key => [key, Object.getOwnPropertyDescriptor(object, key)]);
  Object.assign(object, fields);
  try { return test(); } finally {
    before.forEach(([key, descriptor]) => { if (descriptor) Object.defineProperty(object, key, descriptor); else delete object[key]; });
  }
}

// 对三棵运行态 JSON 逐字比较，读取必须连履职态的初始化都不发生。
function snapshot(gm) {
  return JSON.stringify({ officeTree: gm.officeTree, adminHierarchy: gm.adminHierarchy, chars: gm.chars });
}

// 全部公开读接口在同一快照区间运行，批量结果与单道结果一致。
function assertReadOnly(world) {
  const { gm, api, division, circuits, owner, context } = world;
  const before = snapshot(gm);
  const batch = api.listGovernors(gm, circuits, owner);
  circuits.forEach((circuit, i) => {
    const node = division.circuitAdminNode(gm, circuit.key, owner);
    const binding = api.resolveGovernorPosition(gm, node);
    if (binding) context.officeDutyView(gm, binding.position);
    assert.equal(JSON.stringify(api.governorOf(gm, circuit, owner)), JSON.stringify(batch[i]), '批量与单道一致');
  });
  assert.equal(snapshot(gm), before, 'officeTree/adminHierarchy/chars 的 JSON 不变');
}

// 提取真实通志中的长官卡，单独核对结构，避免命中其他卷里的同名文字。
function officialCard(world, circuit) {
  world.parts.openCircuitDossier(circuit.key, world.MC.partitionByOwner(circuit, world.owner).own[0]);
  const html = world.context.document.getElementById('ppop').innerHTML;
  const match = html.match(/<div class="bk-circuit-official">[\s\S]*?<\/div>/);
  assert(match, '通志含长官卡');
  return match[0];
}

// 打印未临时改动时的本方分布，缺失来源明确记为 null。
function distribution(world) {
  const status = { serving: 0, travelling: 0, vacant: 0, unbound: 0, note: 0 };
  const source = { governorOffice: 0, regionId: 0, name: 0, null: 0 };
  const views = world.api.listGovernors(world.gm, world.circuits, world.owner);
  views.forEach(view => { status[view.status]++; source[String(view.source)]++; });
  assert.equal(views.length, world.circuits.length, '视图数等于本方正式省道数');
  assert.equal(Object.values(status).reduce((sum, count) => sum + count, 0), world.circuits.length);
  console.log('[distribution] ' + JSON.stringify({ owner: world.owner, total: views.length, status, source }));
  return views;
}

// 单文件只开一局，并打印完整实测用时。
async function runSuite(sid, label, test) {
  const started = Date.now(), checks = [];
  try {
    const world = await boot(sid);
    const bootSeconds = (Date.now() - started) / 1000;
    const views = distribution(world);
    // 顺序运行每组断言，失败立即保留准确的组名与堆栈。
    function check(name, fn) { fn(); checks.push(name); console.log('  ok · ' + name); }
    await test(world, check, views);
    const elapsed = (Date.now() - started) / 1000;
    // 只打印用时：限时由 run-smokes 的每文件 120 秒把关，机器繁忙时不在用例里另设墙钟断言
    console.log('[timing] boot=' + bootSeconds.toFixed(3) + 's total=' + elapsed.toFixed(3) + 's');
    console.log('[' + label + '] PASS ' + checks.length + ' groups');
    process.exit(0);
  } catch (error) {
    console.error('[' + label + '] FAIL after ' + ((Date.now() - started) / 1000).toFixed(3) + 's', error && error.stack || error);
    process.exit(1);
  }
}

module.exports = { runSuite, withFields, snapshot, assertReadOnly, officialCard };

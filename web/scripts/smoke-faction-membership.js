#!/usr/bin/env node
// scripts/smoke-faction-membership.js — Slice D 单 mutator 测试
// 2026-05-10

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }

function makeGM() {
  return {
    turn: 5,
    facs: [
      { name: '明朝廷', id: 'fac_ming', leader: '朱由检' },
      { name: '后金', id: 'fac_houjin', leader: '皇太极' },
      { name: '附庸国', id: 'fac_vassal', leader: '某君', liege: '明朝廷' }
    ],
    chars: [
      { name: '韩爌', faction: '明朝廷', loyalty: 80, charisma: 70, alive: true, party: '东林党' },
      { name: '魏忠贤', faction: '明朝廷', loyalty: 30, charisma: 62, alive: true, party: '阉党' },
      { name: '皇太极', faction: '后金', loyalty: 100, charisma: 88, alive: true },
      { name: '某君', faction: '附庸国', loyalty: 60, charisma: 50, alive: true }
    ],
    armies: [
      { name: '关宁军', faction: '明朝廷', commander: '袁崇焕', soldiers: 80000 },
      { name: '京营', owner: '明朝廷', commander: '崔呈秀', soldiers: 60000 },  // 旧 owner 字段
      { name: '附庸军', faction: '附庸国', commander: '某将', soldiers: 5000 },
      { name: '两黄旗', faction: '后金', commander: '皇太极', soldiers: 15000 }
    ]
  };
}

function buildContext() {
  const ctx = {
    console: { log: () => {}, warn: () => {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, parseInt, parseFloat, isNaN, Set
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-index.js'), 'utf8'), ctx, { filename: 'tm-faction-index.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-derived-health.js'), 'utf8'), ctx, { filename: 'tm-faction-derived-health.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-membership.js'), 'utf8'), ctx, { filename: 'tm-faction-membership.js' });
  return ctx;
}

function testApiPresent() {
  const ctx = buildContext();
  assert(typeof ctx.TM.FactionMembership === 'object', 'TM.FactionMembership not exposed');
  ['assignChar','unassignChar','assignArmy','bulkReassignChars','bulkReassignArmies','dissolveFaction','renameFaction','lint',
   'assignProvince','bulkReassignProvinces','migrateProvinceOwnership'].forEach(function(m){
    assert(typeof ctx.TM.FactionMembership[m] === 'function', m + ' not a function');
  });
}

function testAssignChar() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  const han = ctx.GM.chars[0];
  // 转籍
  const ok = ctx.TM.FactionMembership.assignChar(han, '后金', { reason: '叛投' });
  assert(ok === true, 'assignChar should return true on actual change');
  assert(han.faction === '后金', 'faction not updated');
  assert(han.factionId === 'fac_houjin', 'factionId not auto-set from facs lookup');
  assert(Array.isArray(han._factionHistory), '_factionHistory not initialized');
  assert(han._factionHistory.length === 1, '_factionHistory should have 1 entry');
  assert(han._factionHistory[0].from === '明朝廷', 'history.from wrong');
  assert(han._factionHistory[0].to === '后金', 'history.to wrong');
  assert(han._factionHistory[0].turn === 5, 'history.turn wrong');
  assert(han._factionHistory[0].reason === '叛投', 'history.reason wrong');
  // 重复设同名·应 noop
  const noop = ctx.TM.FactionMembership.assignChar(han, '后金', {});
  assert(noop === false, 'assignChar same target should noop');
  assert(han._factionHistory.length === 1, 'history should not append on noop');
}

function testUnassign() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  const wei = ctx.GM.chars[1];
  ctx.TM.FactionMembership.unassignChar(wei, { reason: '势力倾覆' });
  assert(wei.faction === '', 'unassign should set to empty');
  assert(wei.factionId === '', 'factionId should clear');
  assert(wei._factionHistory[0].to === '', 'history.to should be empty');
}

function testAssignArmy() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // 京营·原 owner='明朝廷'·改归 后金
  const jingying = ctx.GM.armies[1];
  ctx.TM.FactionMembership.assignArmy(jingying, '后金', { reason: '京营叛降' });
  assert(jingying.faction === '后金', 'army.faction not updated');
  // Slice E·a.owner 字段应该被删除 (canonical 单源)
  assert(!('owner' in jingying) || jingying.owner === undefined, 'army.owner should be removed (Slice E)');
  assert(jingying.factionId === 'fac_houjin', 'army.factionId not set');
  assert(jingying._factionHistory[0].from === '明朝廷', 'history.from should read from old owner');
}

function testArmyMigration() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // makeGM 里 armies[1] 是 owner='明朝廷' (旧 schema)·migrate 应升到 faction
  const jy = ctx.GM.armies[1];
  assert(jy.owner === '明朝廷' && !jy.faction, '前置·京营 owner=明朝廷·faction 空');
  const ret = ctx.TM.FactionMembership.migrateArmyOwnerToFaction();
  assert(ret.migrated === 1, 'should migrate 1 army (京营)·got ' + ret.migrated);
  assert(jy.faction === '明朝廷', 'after migrate·faction should be 明朝廷');
  assert(!('owner' in jy) || jy.owner === undefined, 'owner field should be removed');
  assert(ret.idCovered >= 1, 'should cover factionId for at least 1');
}

function testCharIdMigration() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  const han = ctx.GM.chars[0];
  assert(!han.factionId, '前置·韩爌 没 factionId');
  const n = ctx.TM.FactionMembership.migrateCharsAddFactionId();
  assert(n >= 4, 'should backfill factionId for all 4 chars·got ' + n);
  assert(han.factionId === 'fac_ming', '韩爌 should get fac_ming');
}

function testBulkReassign() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // 把 明朝廷 全部 chars 批量改到 附庸国
  const cnt = ctx.TM.FactionMembership.bulkReassignChars(c => c.faction === '明朝廷', '附庸国', { reason: '禅位' });
  assert(cnt === 2, 'bulk should change 2 chars (韩爌+魏忠贤)·got ' + cnt);
  assert(ctx.GM.chars[0].faction === '附庸国', '韩爌 not bulk-assigned');
  assert(ctx.GM.chars[1].faction === '附庸国', '魏忠贤 not bulk-assigned');
  assert(ctx.GM.chars[2].faction === '后金', '皇太极 should be untouched');
}

function testDissolveWithLiege() {
  // 附庸国 解散·有 liege=明朝廷·应吸收
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  const ret = ctx.TM.FactionMembership.dissolveFaction('附庸国', {});
  assert(ret.strategy === 'absorbed-by-liege', 'should route to liege·got ' + ret.strategy);
  assert(ret.target === '明朝廷', 'target should be liege·got ' + ret.target);
  assert(ret.chars === 1, '附庸国 1 char should move·got ' + ret.chars);
  assert(ret.armies === 1, '附庸军 should move·got ' + ret.armies);
  assert(ctx.GM.chars[3].faction === '明朝廷', '某君 should now be 明朝廷');
  assert(ctx.GM.armies[2].faction === '明朝廷', '附庸军 should now be 明朝廷');
}

function testDissolveWithConqueror() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  const ret = ctx.TM.FactionMembership.dissolveFaction('附庸国', { conqueror: '后金' });
  assert(ret.strategy === 'conquered', 'conqueror should override liege·got ' + ret.strategy);
  assert(ret.target === '后金', 'target should be conqueror');
  assert(ctx.GM.chars[3].faction === '后金', '某君 should now be 后金');
}

function testDissolveOrphan() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // 明朝廷 没 liege·没 conqueror·应 orphaned
  const ret = ctx.TM.FactionMembership.dissolveFaction('明朝廷', {});
  assert(ret.strategy === 'orphaned', 'should orphan·got ' + ret.strategy);
  assert(ret.target === '', 'target should be empty');
  assert(ctx.GM.chars[0].faction === '', '韩爌 should be orphaned');
  assert(ctx.GM.chars[1].faction === '', '魏忠贤 should be orphaned');
}

function testRename() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // Slice G·一站式 rename·该函数自己改 facs[i].name
  const ret = ctx.TM.FactionMembership.renameFaction('明朝廷', '大顺');
  assert(ret.chars === 2, 'rename should cascade 2 chars·got ' + ret.chars);
  assert(ret.armies === 2, 'rename should cascade 2 armies·got ' + ret.armies);
  assert(ctx.GM.facs[0].name === '大顺', 'fac itself should be renamed');
  assert(ctx.GM.chars[0].faction === '大顺', '韩爌 faction not cascaded');
  assert(ctx.GM.armies[0].faction === '大顺', '关宁军 faction not cascaded');
}

function testResolveById() {
  // Slice G·factionId 优先·rename 后 char.faction 字段过期·resolve 走 ID 自动修复
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // 先 backfill ID
  ctx.TM.FactionMembership.migrateCharsAddFactionId();
  const han = ctx.GM.chars[0];
  assert(han.factionId === 'fac_ming', '前置·韩爌 ID=fac_ming');
  // 模拟 *外部直接改 facs[0].name* 不走 renameFaction (worst case)
  ctx.GM.facs[0].name = '大顺';
  // 此时 han.faction 还是 '明朝廷' (字符串过期)
  assert(han.faction === '明朝廷', '字符串过期 (尚未 cascade)');
  // resolveFaction 走 ID·应该返回新对象·并自动同步字符串
  const fac = ctx.TM.FactionMembership.resolveFaction(han);
  assert(fac && fac.id === 'fac_ming', 'resolve by ID should find renamed fac');
  assert(fac.name === '大顺', 'resolved fac.name is new name');
  assert(han.faction === '大顺', 'resolveFaction should auto-sync entity.faction');
}

function testResolveFallbackToName() {
  // 没 factionId 时·走 name fallback·向后兼容
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  const han = ctx.GM.chars[0];
  delete han.factionId;
  const fac = ctx.TM.FactionMembership.resolveFaction(han);
  assert(fac && fac.name === '明朝廷', 'fallback to name lookup');
}

function testFindFacById() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  const f = ctx.TM.FactionMembership.findFacById('fac_houjin');
  assert(f && f.name === '后金', 'findFacById should locate 后金');
  const none = ctx.TM.FactionMembership.findFacById('fac_nope');
  assert(none === null, 'unknown ID returns null');
}

function testLint() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // 注入一个 stale ref
  ctx.GM.chars.push({ name: '幽灵', faction: '不存在的势力', loyalty: 0, alive: true });
  ctx.GM.armies.push({ name: '幽灵军', faction: '另一个不存在', soldiers: 100 });
  const lr = ctx.TM.FactionMembership.lint();
  assert(lr.stale.chars.length === 1, 'lint should detect stale char ref');
  assert(lr.stale.chars[0].name === '幽灵', 'stale char name');
  assert(lr.stale.armies.length === 1, 'lint should detect stale army ref');
}

function testIndexAutoRefresh() {
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  // 初始 build
  ctx.TM.FactionIndex.rebuild();
  const beforeCnt = ctx.GM._facIndex['明朝廷'].metrics.charCount;
  // 转籍
  ctx.TM.FactionMembership.assignChar(ctx.GM.chars[0], '后金', {});
  // 索引应该自动刷新
  const afterCnt = ctx.GM._facIndex['明朝廷'].metrics.charCount;
  assert(afterCnt === beforeCnt - 1, 'index should auto-refresh on assignChar·before=' + beforeCnt + ' after=' + afterCnt);
}

function testAssignProvince() {
  // Slice H·province 单写口
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.GM._provinceToFaction = { '辽东': '后金', '北直隶': '明朝廷' };
  ctx.GM.provinceStats = {
    '辽东': { owner: '后金', name: '辽东' },
    '北直隶': { owner: '明朝廷', name: '北直隶' }
  };
  ctx.getFactionProvinces = (n) => Object.keys(ctx.GM._provinceToFaction).filter(p => ctx.GM._provinceToFaction[p] === n);
  // 北直隶 改归 后金
  const ok = ctx.TM.FactionMembership.assignProvince('北直隶', '后金', { reason: '后金破关' });
  assert(ok === true, 'assignProvince should return true');
  assert(ctx.GM._provinceToFaction['北直隶'] === '后金', 'canonical map should update');
  assert(ctx.GM.provinceStats['北直隶'].owner === '后金', 'provinceStats.owner should sync');
  const ming = ctx.GM.facs.find(f => f.name === '明朝廷');
  const houjin = ctx.GM.facs.find(f => f.name === '后金');
  assert((ming.territories||[]).indexOf('北直隶') < 0, '明朝廷 territories should drop 北直隶');
  assert((houjin.territories||[]).indexOf('北直隶') >= 0, '后金 territories should add 北直隶');
  assert(Array.isArray(ctx.GM.provinceStats['北直隶']._factionHistory), 'history should be initialized');
  assert(ctx.GM.provinceStats['北直隶']._factionHistory[0].from === '明朝廷', 'history.from');
}

function testProvinceMigration() {
  // Slice H·三源合一
  const ctx = buildContext();
  ctx.GM = {
    turn: 1,
    facs: [
      { name: '明朝廷', id: 'fac_ming', territories: ['北直隶', '河南'] },
      { name: '后金', id: 'fac_houjin', provinceIds: ['辽东'] }
    ],
    provinceStats: {
      '北直隶': { owner: '明朝廷', name: '北直隶' },
      '山东': { owner: '明朝廷', name: '山东' }   // 仅在 stats 里·不在 fac.territories
    },
    _provinceToFaction: { '河南': '明朝廷' }   // 仅在 map 里
  };
  ctx.getFactionProvinces = () => [];
  const ret = ctx.TM.FactionMembership.migrateProvinceOwnership();
  assert(ret.adopted === 4, 'should adopt 4 provinces·got ' + ret.adopted);
  assert(ctx.GM._provinceToFaction['山东'] === '明朝廷', '山东 should migrate from stats');
  assert(ctx.GM._provinceToFaction['辽东'] === '后金', '辽东 should migrate from fac.provinceIds');
  // 反向 sync 后·明朝廷.territories 应包 山东
  const ming = ctx.GM.facs[0];
  assert(ming.territories.indexOf('山东') >= 0, 'fac.territories should sync 山东');
  // 河南 在 _provinceToFaction 但不在 provinceStats·migration 不创建新 entry (其它字段未知)
  // 但应该出现在 fac.territories
  assert(ming.territories.indexOf('河南') >= 0, 'fac.territories should sync 河南');
}

function testDissolveCascadesProvinces() {
  // Slice H·dissolve 也带省份转封
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.GM._provinceToFaction = { '附庸地': '附庸国', '小附庸地': '附庸国' };
  ctx.GM.provinceStats = {
    '附庸地': { owner: '附庸国', name: '附庸地' },
    '小附庸地': { owner: '附庸国', name: '小附庸地' }
  };
  ctx.getFactionProvinces = () => [];
  const ret = ctx.TM.FactionMembership.dissolveFaction('附庸国', { conqueror: '后金' });
  assert(ret.provinces === 2, 'dissolve should cascade 2 provinces·got ' + ret.provinces);
  assert(ctx.GM._provinceToFaction['附庸地'] === '后金', '附庸地 should now be 后金');
  assert(ctx.GM.provinceStats['附庸地'].owner === '后金', 'provinceStats sync');
}

function testRenameCascadesProvinces() {
  // Slice H·rename 时省份归属字符串也要 cascade
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.GM._provinceToFaction = { '北直隶': '明朝廷', '南直隶': '明朝廷' };
  ctx.GM.provinceStats = {
    '北直隶': { owner: '明朝廷', name: '北直隶' },
    '南直隶': { owner: '明朝廷', name: '南直隶' }
  };
  ctx.getFactionProvinces = () => [];
  const ret = ctx.TM.FactionMembership.renameFaction('明朝廷', '大顺');
  assert(ret.provinces === 2, 'rename should cascade 2 provinces·got ' + ret.provinces);
  assert(ctx.GM._provinceToFaction['北直隶'] === '大顺', 'province map should follow rename');
}

function testBidirectionalFacMembers() {
  // Slice I·rebuild 后 fac.members 应填充
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  ctx.TM.FactionIndex.rebuild();
  const ming = ctx.GM.facs.find(f => f.name === '明朝廷');
  assert(ming.members && Array.isArray(ming.members.chars), 'fac.members.chars should exist');
  assert(ming.members.chars.length === 2, '明朝廷 should have 2 alive chars·got ' + ming.members.chars.length);
  assert(ming.members.armies.length >= 1, '明朝廷 should have armies');
  assert(ming.members.summary, 'summary should exist');
  assert(ming.members.summary.charCount === 2, 'summary.charCount');
  assert(ming.members.summary.rebuiltTurn === ctx.GM.turn, 'summary.rebuiltTurn');
}

function testBidirInvariant() {
  // Slice I·assign 后·fac.members 与 char.faction 必须双向一致
  const ctx = buildContext();
  ctx.GM = makeGM();
  ctx.getFactionProvinces = () => [];
  ctx.TM.FactionIndex.rebuild();
  // 转籍·rebuild 应被 API 自动触发
  const han = ctx.GM.chars[0];
  ctx.TM.FactionMembership.assignChar(han, '后金', {});
  // bidir lint
  const lr = ctx.TM.FactionMembership.lint();
  assert(lr.bidirIssues && lr.bidirIssues.length === 0, 'bidir invariant violated: ' + JSON.stringify(lr.bidirIssues));
  // fac.members 应该跟着更新
  const houjin = ctx.GM.facs.find(f => f.name === '后金');
  const inMembers = (houjin.members.chars || []).find(c => c.name === '韩爌');
  assert(inMembers, '韩爌 should now appear in 后金.members.chars');
}

function main() {
  testApiPresent();
  testAssignChar();
  testUnassign();
  testAssignArmy();
  testArmyMigration();
  testCharIdMigration();
  testBulkReassign();
  testDissolveWithLiege();
  testDissolveWithConqueror();
  testDissolveOrphan();
  testRename();
  testResolveById();
  testResolveFallbackToName();
  testFindFacById();
  testLint();
  testAssignProvince();
  testProvinceMigration();
  testDissolveCascadesProvinces();
  testRenameCascadesProvinces();
  testBidirectionalFacMembers();
  testBidirInvariant();
  testIndexAutoRefresh();
  console.log('[smoke-faction-membership] pass·23 tests');
}

try { main(); }
catch (e) {
  console.error('[smoke-faction-membership] fail: ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 8).join('\n'));
  process.exit(1);
}

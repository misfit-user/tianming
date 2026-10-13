#!/usr/bin/env node
'use strict';
// 读档悬空引用 / 重复稳定 id 修复（2026-10-13）
//   案：玩家自建剧本读档报「加载失败：地图地区[418].factionId 指向不存在的稳定 id: 台湾诸部」
//       和「行政区划 存在重复 id」——整档拒载。根治=读档迁移先修（按名找回→清空留收据；
//       重复 id 派生确定性新 id），校验器保持严格，修完必须零悬空、零重复。
//   本 smoke 同时是两边字段清单的漂移探针：修复器漏配任何一个校验器认的字段，这里立刻红。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'tm-save-world-validation.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
let pass = 0, fail = 0;
function ok(condition, message) {
  if (condition) { pass++; console.log('  PASS - ' + message); }
  else { fail++; console.error('  FAIL - ' + message); }
}
function sliceFn(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('missing helper: ' + marker);
  let cursor = src.indexOf('{', start), depth = 0;
  for (; cursor < src.length; cursor++) {
    if (src[cursor] === '{') depth++;
    else if (src[cursor] === '}' && --depth === 0) return src.slice(start, cursor + 1);
  }
  throw new Error('unterminated helper: ' + marker);
}
const helpers = [
  'function _tmStableIdMissing(', 'function _tmStableIdHash(', 'function _tmStableIdentityParts(',
  'function _tmCollectAdminDivisionEntries(', 'function _tmRepairDuplicateDivisionIds(', 'function _tmRepairDuplicateEntityIds(',
  'function _tmClearDanglingStableRefs(', 'function _tmAssignMissingStableIds(', 'function _tmUniqueEntityIdByName(',
  'function _tmEntityIdSet(', 'function _tmBackfillStableForeignKeys(', 'function _tmMigrateCoreStableIds(',
  'function _tmValidateUniqueStableIds(', 'function _tmValidateStableForeignKeys('
].map(marker => sliceFn(source, marker)).join('\n');
const context = {
  console: { warn() {}, log() {}, error() {} }, Math, JSON, Number, Object, Array, String, Error, WeakSet,
  _tmHasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
};
context.window = context;
vm.createContext(context);
vm.runInContext(helpers, context, { filename: 'tm-save-lifecycle-dangling-slice.js' });

function validateAll(world) {
  context._tmValidateUniqueStableIds('人物', world.chars);
  context._tmValidateUniqueStableIds('势力', world.facs);
  context._tmValidateUniqueStableIds('军队', world.armies);
  context._tmValidateUniqueStableIds('地图地区', world.mapData.regions);
  context._tmValidateUniqueStableIds('行政区划', context._tmCollectAdminDivisionEntries(world).map(e => e.item));
  context._tmValidateStableForeignKeys(world);
}

function customWorld() {
  return {
    sid: 'custom-taiwan', _campaignId: 'custom-campaign',
    chars: [
      { id: 'c1', name: '甲', gender: '男', birthYear: 1600, faction: '朝廷', factionId: 'f1', childrenIds: ['c2', 'ghost-child'], studentIds: ['ghost-student'],
        familyMembers: [{ characterId: 'ghost-member', name: '乙' }, { personId: 'ghost-person', name: '无此人' }] },
      { id: 'c2', name: '乙', gender: '女', birthYear: 1602, faction: '朝廷', factionId: '朝廷', father: '甲', fatherId: 'ghost-father', spouseId: 'ghost-spouse', mentorId: 'c1' }
    ],
    facs: [{ id: 'f1', name: '朝廷', leader: '甲', leaderId: 'ghost-leader', heirId: 'c2', memberIds: ['c1', 'ghost-member'] }],
    armies: [{ id: 'a1', name: '京营', commander: '无名将', commanderId: 'ghost-commander', faction: '朝廷', factionId: 'f1' }],
    harem: { crownPrince: '乙', crownPrinceId: 'ghost-prince' },
    mapData: { regions: [
      { id: 'r1', name: '台湾', owner: '台湾诸部', factionId: '台湾诸部', governorId: 'ghost-governor' },
      { id: 'r2', name: '京畿', factionId: '朝廷' },
      { id: 'r3', name: '江南', owner: '朝廷', factionId: 'f1', governorId: 'c1' }
    ] },
    officeTree: [{ name: '中枢', positions: [
      { name: '尚书', holder: '甲', holderId: 'c1', actualHolders: [{ characterId: 'ghost-holder', name: '无此人' }, { holderId: 'c2', name: '乙' }] },
      { name: '侍郎', holder: '无此人', holderId: 'ghost-vice' }
    ], subs: [{ name: '下属司', positions: [{ name: '郎中', holderId: 'ghost-sub' }] }] }],
    adminHierarchy: { player: { divisions: [{ id: 'd1', name: '北直隶', governorId: 'ghost-governor', children: [{ id: 'd2', name: '顺天府', parentId: 'd1', governorId: 'c2' }] }] } }
  };
}

console.log('[smoke-stable-id-dangling-repair]');

{
  const world = customWorld();
  let before = false;
  try { validateAll(world); } catch (error) { before = /指向不存在的稳定 id: 台湾诸部|指向不存在/.test(error.message); }
  ok(before, 'untouched custom world is rejected by the strict validator (the player-facing symptom)');
  const result = context._tmMigrateCoreStableIds(world);
  let after = true, afterError = '';
  try { validateAll(world); } catch (error) { after = false; afterError = error.message; }
  ok(after, 'after migration the same world passes unique-id and foreign-key validation' + (after ? '' : ' :: ' + afterError));
  ok(world.mapData.regions[0].factionId === undefined && world.mapData.regions[0].owner === '台湾诸部',
    'a region pointing at a faction that does not exist loses the dangling id but keeps its owner name');
  ok(world.mapData.regions[1].factionId === 'f1' && world.chars[1].factionId === 'f1',
    'factionId written as a faction name is resolved to the real faction id');
  ok(world.chars[1].fatherId === 'c1', 'dangling fatherId is recovered from the unique father name before clearing');
  ok(world.facs[0].leaderId === 'c1' && world.harem.crownPrinceId === 'c2',
    'leader and crown prince ids are recovered from their unique display names');
  ok(world.chars[1].spouseId === undefined && world.armies[0].commanderId === undefined && world.mapData.regions[0].governorId === undefined,
    'unrecoverable scalar references are cleared across chars, armies and regions');
  ok(!('motherId' in world.chars[0]) && !('coLeaderId' in world.facs[0]),
    'backfill no longer invents empty-string ids for references that never existed');
  ok(JSON.stringify(world.chars[0].childrenIds) === '["c2"]' && JSON.stringify(world.chars[0].studentIds) === '[]'
    && JSON.stringify(world.facs[0].memberIds) === '["c1"]',
    'dangling entries are dropped from id arrays while valid entries stay');
  ok(world.chars[0].familyMembers[0].characterId === 'c2' && world.chars[0].familyMembers[1].personId === undefined,
    'family member references recover by name or are cleared');
  const positions = world.officeTree[0].positions;
  ok(positions[0].actualHolders[0].characterId === undefined && positions[0].actualHolders[1].holderId === 'c2'
    && positions[1].holderId === undefined && world.officeTree[0].subs[0].positions[0].holderId === undefined,
    'office holder references are cleared through positions, actual holders and nested subs');
  const divisions = context._tmCollectAdminDivisionEntries(world).map(e => e.item);
  ok(divisions[0].governorId === undefined && divisions[1].governorId === 'c2', 'administrative governor references follow the same rule');
  ok(result.danglingRepaired > 0 && world._stableIdMigration.danglingRepaired === result.danglingRepaired
    && Array.isArray(world._stableIdMigration.danglingDetails)
    && world._stableIdMigration.danglingDetails.some(r => r.action === 'renamed' && r.to === 'f1')
    && world._stableIdMigration.danglingDetails.some(r => r.action === 'cleared' && r.from === '台湾诸部'),
    'every repair is receipted with its action (renamed / cleared / removed)');
  const again = context._tmMigrateCoreStableIds(world);
  ok(!again.danglingRepaired && !again.duplicateRepaired && again.total === 0, 'second migration pass is a no-op (idempotent)');
}

{
  const world = customWorld();
  world.mapData.regions.push({ id: 'r1', name: '台湾外岛', owner: '朝廷', factionId: 'f1' });
  world.chars.push({ id: 'c1', name: '甲二', gender: '男', birthYear: 1610, faction: '朝廷', factionId: 'f1' });
  world.armies.push({ id: 'a1', name: '京营别部', faction: '朝廷', factionId: 'f1' });
  world.facs.push({ id: 'f1', name: '伪朝', memberIds: [] });
  let before = false;
  try { validateAll(world); } catch (error) { before = /存在重复 id/.test(error.message); }
  ok(before, 'duplicate ids across regions/chars/armies/factions are rejected by the strict validator');
  const result = context._tmMigrateCoreStableIds(world);
  let after = true, afterError = '';
  try { validateAll(world); } catch (error) { after = false; afterError = error.message; }
  ok(after, 'after migration duplicates are resolved and the world validates' + (after ? '' : ' :: ' + afterError));
  ok(world.mapData.regions[0].id === 'r1' && /^r1__tmdup_[0-9a-f]{8}$/.test(world.mapData.regions[3].id),
    'first region keeps its id, the later duplicate gets a deterministic derived id');
  ok(world.chars[0].id === 'c1' && /^c1__tmdup_/.test(world.chars[2].id) && world.armies[0].id === 'a1' && /^a1__tmdup_/.test(world.armies[1].id)
    && world.facs[0].id === 'f1' && /^f1__tmdup_/.test(world.facs[1].id),
    'the same rule applies to characters, armies and factions');
  ok(result.duplicateRepaired === 4 && world._stableIdMigration.duplicateRepaired === 4, 'duplicate repairs are counted on the migration record');
  const derived = world.mapData.regions[3].id;
  const replay = customWorld();
  replay.mapData.regions.push({ id: 'r1', name: '台湾外岛', owner: '朝廷', factionId: 'f1' });
  context._tmMigrateCoreStableIds(replay);
  ok(replay.mapData.regions[3].id === derived, 'derived duplicate ids are deterministic across loads of the same world');
}

console.log('\n[smoke-stable-id-dangling-repair] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);

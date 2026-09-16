#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'tm-save-world-validation.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
let pass = 0;
let fail = 0;
function ok(condition, message) {
  if (condition) { pass++; console.log('  PASS - ' + message); }
  else { fail++; console.error('  FAIL - ' + message); }
}
function sliceFn(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('missing helper: ' + marker);
  let cursor = src.indexOf('{', start);
  let depth = 0;
  for (; cursor < src.length; cursor++) {
    if (src[cursor] === '{') depth++;
    else if (src[cursor] === '}' && --depth === 0) return src.slice(start, cursor + 1);
  }
  throw new Error('unterminated helper: ' + marker);
}

const helpers = [
  'function _tmStableIdMissing(',
  'function _tmStableIdHash(',
  'function _tmStableIdentityParts(',
  'function _tmCollectAdminDivisionEntries(',
  'function _tmAssignMissingStableIds(',
  'function _tmUniqueEntityIdByName(',
  'function _tmEntityIdSet(',
  'function _tmBackfillStableForeignKeys(',
  'function _tmMigrateCoreStableIds(',
  'function _tmValidateUniqueStableIds(',
  'function _tmValidateStableForeignKeys('
].map(marker => sliceFn(source, marker)).join('\n');

const context = {
  console, Math, JSON, Number, Object, Array, String, Error, WeakSet,
  _tmHasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
};
context.window = context;
vm.createContext(context);
vm.runInContext(helpers, context, { filename: 'tm-save-lifecycle-stable-id-slice.js' });

function legacyWorld(charOrder) {
  const charsByName = {
    '甲': { name: '甲', gender: '男', birthYear: 1600, faction: '朝廷' },
    '乙': { name: '乙', gender: '女', birthYear: 1602, faction: '朝廷' }
  };
  return {
    sid: 'same-scenario', _campaignId: 'same-campaign',
    chars: charOrder.map(name => JSON.parse(JSON.stringify(charsByName[name]))),
    facs: [{ name: '朝廷', leader: '甲' }],
    armies: [{ name: '京营', commander: '乙', faction: '朝廷' }],
    mapData: { regions: [{ name: '京畿', owner: '朝廷' }, { name: '江南', owner: '朝廷' }] },
    officeTree: [{ name: '中枢', positions: [{ name: '尚书', holder: '甲' }], subs: [] }],
    adminHierarchy: {
      player: { divisions: [
        { name: '北直隶', children: [{ name: '顺天府' }] },
        { name: '南直隶', children: [{ name: '应天府' }] }
      ] }
    }
  };
}

console.log('[smoke-stable-id-reference-integrity]');

{
  const first = legacyWorld(['甲', '乙']);
  const reordered = legacyWorld(['乙', '甲']);
  reordered.mapData.regions.reverse();
  context._tmMigrateCoreStableIds(first);
  context._tmMigrateCoreStableIds(reordered);
  const idsA = Object.fromEntries(first.chars.map(char => [char.name, char.id]));
  const idsB = Object.fromEntries(reordered.chars.map(char => [char.name, char.id]));
  const regionsA = Object.fromEntries(first.mapData.regions.map(region => [region.name, region.id]));
  const regionsB = Object.fromEntries(reordered.mapData.regions.map(region => [region.name, region.id]));
  ok(idsA['甲'] === idsB['甲'] && idsA['乙'] === idsB['乙'],
    'legacy character IDs remain stable when array order changes');
  ok(regionsA['京畿'] === regionsB['京畿'] && regionsA['江南'] === regionsB['江南'],
    'legacy region IDs are based on semantic identity rather than array position');
  ok(first._stableIdMigration.version === 3, 'order-independent migration records schema version 3');
}

{
  const first = legacyWorld(['甲', '乙']);
  const renamed = legacyWorld(['甲', '乙']);
  first.chars[0].sourceId = 'char-source-1';
  renamed.chars[0].sourceId = 'char-source-1';
  renamed.chars[0].name = '甲改名';
  context._tmMigrateCoreStableIds(first);
  context._tmMigrateCoreStableIds(renamed);
  ok(first.chars[0].id === renamed.chars[0].id,
    'explicit source identity remains stable across display-name changes');
}

{
  const world = legacyWorld(['甲', '乙']);
  world.adminHierarchy = { divisions: [{ name: '直辖州', children: [{ name: '属县' }] }] };
  context._tmMigrateCoreStableIds(world);
  const divisions = context._tmCollectAdminDivisionEntries(world).map(entry => entry.item);
  ok(divisions.length === 2 && divisions.every(division => typeof division.id === 'string'),
    'direct adminHierarchy.divisions layouts also receive stable IDs');
}

{
  const world = legacyWorld(['甲', '乙']);
  world.chars[1].factionId = 'dangling-faction';
  world.armies[0].commanderId = 'dangling-character';
  world.armies[0].factionId = 'dangling-faction';
  world.mapData.regions[0].factionId = 'dangling-faction';
  context._tmMigrateCoreStableIds(world);
  const factionId = world.facs[0].id;
  const commanderId = world.chars.find(char => char.name === '乙').id;
  ok(world.chars[1].factionId === factionId
    && world.armies[0].factionId === factionId
    && world.mapData.regions[0].factionId === factionId,
    'invalid faction references are repaired from unique legacy names');
  ok(world.armies[0].commanderId === commanderId,
    'invalid commanderId is repaired from the unique commander name');
  world.chars[1].father = '甲';
  world.chars[1].fatherId = 'dangling-relative';
  world.chars[0].childrenIds = ['乙'];
  world.chars[0].designatedHeirId = '乙';
  world.harem = { crownPrince: '乙', crownPrinceId: '乙' };
  world.officeTree[0].positions[0].holderId = 'dangling-holder';
  context._tmBackfillStableForeignKeys(world);
  ok(world.chars[1].fatherId === world.chars[0].id
    && world.officeTree[0].positions[0].holderId === world.chars[0].id,
  'relative and office-holder IDs are repaired from unique legacy names');
  ok(world.chars[0].childrenIds[0] === commanderId
    && world.chars[0].designatedHeirId === commanderId
    && world.harem.crownPrinceId === commanderId,
  'legacy child and crown-prince name references migrate to stable IDs');
  let valid = true;
  try { context._tmValidateStableForeignKeys(world); } catch (_) { valid = false; }
  ok(valid, 'repaired stable foreign keys pass closure validation');
}

{
  const world = legacyWorld(['甲', '乙']);
  context._tmMigrateCoreStableIds(world);
  world.armies[0].commander = '不存在的人物';
  world.armies[0].commanderId = 'missing-character-id';
  context._tmBackfillStableForeignKeys(world);
  let rejected = false;
  try { context._tmValidateStableForeignKeys(world); }
  catch (error) { rejected = /commanderId.*不存在/.test(error.message); }
  ok(rejected, 'unrepairable dangling commanderId is rejected before gameplay opens');
}

{
  const world = legacyWorld(['甲', '乙']);
  context._tmMigrateCoreStableIds(world);
  world.chars[1].spouseId = 'missing-spouse-id';
  let rejected = false;
  try { context._tmValidateStableForeignKeys(world); }
  catch (error) { rejected = /spouseId.*不存在/.test(error.message); }
  ok(rejected, 'dangling kinship IDs are rejected before gameplay opens');
}

{
  const world = legacyWorld(['甲', '乙']);
  world.chars = [
    { name:'张三', gender:'男', faction:'朝廷' },
    { name:'张三', gender:'男', faction:'朝廷' }
  ];
  let rejected = false;
  try { context._tmMigrateCoreStableIds(world); }
  catch (error) { rejected = /身份歧义/.test(error.message); }
  ok(rejected && world.chars.every(char => !char.id),
    'indistinguishable legacy entities are rejected before path order can become identity');
}

console.log('\n[smoke-stable-id-reference-integrity] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);

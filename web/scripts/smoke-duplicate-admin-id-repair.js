#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'tm-save-world-validation.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'tm-save-lifecycle.js'), 'utf8');
function sliceFn(marker) {
  const start = src.indexOf(marker); if (start < 0) throw new Error('missing ' + marker);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1); }
  throw new Error('unterminated ' + marker);
}
const ctx = { _tmHasOwn: (object, key) => Object.prototype.hasOwnProperty.call(object, key) };
vm.createContext(ctx);
vm.runInContext([
  sliceFn('function _tmStableIdMissing('),
  sliceFn('function _tmStableIdHash('),
  sliceFn('function _tmStableIdentityParts('),
  sliceFn('function _tmCollectAdminDivisionEntries('),
  sliceFn('function _tmRepairDuplicateDivisionIds('),
  sliceFn('function _tmRepairDuplicateEntityIds('),
  sliceFn('function _tmClearDanglingStableRefs('),
  sliceFn('function _tmUniqueEntityIdByName('),
  sliceFn('function _tmEntityIdSet('),
  sliceFn('function _tmBackfillStableForeignKeys('),
  sliceFn('function _tmAssignMissingStableIds('),
  sliceFn('function _tmMigrateCoreStableIds(')
].join('\n'), ctx);
function assert(ok, message) { if (!ok) throw new Error(message); }
const draft = {
  sid: 'custom-hokkaido',
  mapData: { regions: [{ name: '北海道', adminBinding: 'c10-hokkaido' }] },
  adminHierarchy: {
    player: { divisions: [
      { id: 'c10-hokkaido', name: '北海道', level: 'province', children: [{ id: 'child-a', name: '石狩', parentId: 'c10-hokkaido' }] },
      { id: 'c10-hokkaido', name: '北海道外海', level: 'province', children: [{ id: 'child-b', name: '渡岛', parentId: 'c10-hokkaido' }] }
    ] }
  }
};
const entries = ctx._tmCollectAdminDivisionEntries(draft);
const migration = ctx._tmMigrateCoreStableIds(draft);
const repaired = migration.duplicateRepaired;
const ids = entries.map(e => e.item.id);
assert(repaired === 1, 'one duplicate administrative ID repaired');
assert(new Set(ids).size === ids.length, 'all administrative IDs are unique after repair');
assert(ids[0] === 'c10-hokkaido', 'first existing ID remains the canonical reference');
assert(/^c10-hokkaido__tmdup_[0-9a-f]{8}$/.test(ids[2]), 'second branch receives deterministic derived ID');
assert(entries[3].item.parentId === ids[2], 'second branch child parentId follows repaired ID');
assert(draft.mapData.regions[0].adminBinding === ids[0], 'named map binding remains on the first branch');
const again = ctx._tmMigrateCoreStableIds(draft).duplicateRepaired;
assert(again === 0, 'repair is idempotent');
console.log('[smoke-duplicate-admin-id-repair] 6 passed / 0 failed');

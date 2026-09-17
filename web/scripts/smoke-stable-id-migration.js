'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const lifecycle = fs.readFileSync(path.join(__dirname, '..', 'tm-save-world-validation.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'tm-save-lifecycle.js'), 'utf8');

function sliceFn(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('missing function: ' + marker);
  let cursor = source.indexOf('{', start);
  let depth = 0;
  for (; cursor < source.length; cursor++) {
    if (source[cursor] === '{') depth++;
    else if (source[cursor] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, cursor + 1);
    }
  }
  throw new Error('unterminated function: ' + marker);
}

const functionNames = [
  '_tmHasOwn',
  '_tmStableIdMissing',
  '_tmStableIdHash',
  '_tmStableIdentityParts',
  '_tmCollectAdminDivisionEntries',
  '_tmAssignMissingStableIds',
  '_tmUniqueEntityIdByName',
  '_tmEntityIdSet',
  '_tmBackfillStableForeignKeys',
  '_tmMigrateCoreStableIds',
  '_tmValidateUniqueStableIds'
];

const context = { console, Math, Number, Object, Array, String, WeakSet };
vm.createContext(context);
for (const name of functionNames) {
  vm.runInContext(sliceFn(lifecycle, 'function ' + name), context, { filename: name + '.js' });
}

let pass = 0;
let fail = 0;
function ok(condition, message) {
  if (condition) {
    pass++;
    console.log('  PASS - ' + message);
  } else {
    fail++;
    console.error('  FAIL - ' + message);
  }
}

function legacyWorld() {
  return {
    sid: 'scenario-stable-id-smoke',
    _campaignId: 'campaign-stable-id-smoke',
    chars: [
      { name: '甲', faction: '朝廷' },
      { name: '乙', faction: '朝廷' }
    ],
    facs: [
      { name: '朝廷', leader: '甲' }
    ],
    armies: [
      { name: '京营', commander: '乙' }
    ],
    mapData: {
      regions: [
        { name: '京畿', controller: '朝廷' }
      ]
    },
    adminHierarchy: {
      player: {
        divisions: [
          {
            name: '北直隶',
            children: [
              { name: '顺天府' },
              { name: '保定府' }
            ]
          }
        ]
      }
    }
  };
}

function ids(world) {
  return {
    chars: world.chars.map(item => item.id),
    facs: world.facs.map(item => item.id),
    armies: world.armies.map(item => item.id),
    regions: world.mapData.regions.map(item => item.id),
    divisions: context._tmCollectAdminDivisionEntries(world).map(entry => entry.item.id)
  };
}

console.log('[smoke-stable-id-migration]');

const first = legacyWorld();
const second = legacyWorld();
const firstResult = context._tmMigrateCoreStableIds(first);
context._tmMigrateCoreStableIds(second);

ok(firstResult.total === 8, 'all missing core and nested division IDs are migrated');
ok(JSON.stringify(ids(first)) === JSON.stringify(ids(second)), 'legacy IDs are deterministic across repeated loads');
ok(Object.values(ids(first)).every(group => group.every(id => typeof id === 'string' && id.startsWith('tmlegacy_'))),
  'generated IDs use the stable legacy namespace');
ok(first.chars.every(ch => ch.factionId === first.facs[0].id), 'character faction names are backfilled to stable faction IDs');
ok(first.facs[0].leaderId === first.chars[0].id, 'faction leader name is backfilled to a stable character ID');
ok(first.armies[0].commanderId === first.chars[1].id, 'army commander name is backfilled to a stable character ID');
ok(first.mapData.regions[0].factionId === first.facs[0].id, 'region controller name is backfilled to a stable faction ID');
const receiptBeforeRepeat = JSON.stringify(first._stableIdMigration);
const repeatResult = context._tmMigrateCoreStableIds(first);
ok(repeatResult.total === 0 && JSON.stringify(first._stableIdMigration) === receiptBeforeRepeat,
  'repeating the migration is idempotent and does not inflate its receipt');

let validationError = null;
try {
  context._tmValidateUniqueStableIds('人物', first.chars);
  context._tmValidateUniqueStableIds('行政区划', context._tmCollectAdminDivisionEntries(first).map(entry => entry.item));
} catch (error) {
  validationError = error;
}
ok(validationError === null, 'migrated entities pass strict stable-ID validation');

let missingError = null;
try { context._tmValidateUniqueStableIds('人物', [{ name: '无编号' }]); } catch (error) { missingError = error; }
ok(!!missingError && /缺少稳定 id/.test(missingError.message), 'validation rejects a core entity with no ID');

let duplicateError = null;
try { context._tmValidateUniqueStableIds('人物', [{ id: 'same' }, { id: 'same' }]); } catch (error) { duplicateError = error; }
ok(!!duplicateError && /重复 id/.test(duplicateError.message), 'validation rejects duplicate stable IDs');

ok(/function _ensureGMDefaults\(GM, P\)[\s\S]*?_tmEnsureTimelineIdentity\(GM\);[\s\S]*?_tmMigrateCoreStableIds\(GM\);/.test(lifecycle),
  'load defaults run deterministic ID migration before world validation');

console.log('\n[smoke-stable-id-migration] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);

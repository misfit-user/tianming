#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const C = require('../tm-start-contracts.js'),
  { fixture } = require('./fixtures/native-start-fixture.cjs');
let pass = 0,
  fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('PASS ' + name);
  } catch (e) {
    fail++;
    console.error('FAIL ' + name + '\n' + e.stack);
  }
}
function inspect(f) {
  return C.inspect(f.scenario, { capabilities: f.capabilities });
}
function row(f, id = 'pb') {
  return inspect(f).profiles.find((p) => p.id === id);
}
function has(f, code, id) {
  assert(
    row(f, id).errors.some((e) => e.code === code),
    JSON.stringify(row(f, id)),
  );
  assert.equal(row(f, id).enabled, false);
}
test('synthetic heads, regent and delegated role validate independently without mutating source', () => {
  const f = fixture(),
    before = JSON.stringify(f.scenario),
    r = inspect(f);
  assert(r.valid);
  assert.equal(r.profiles.length, 4);
  assert(r.profiles.every((p) => p.enabled));
  assert.equal(JSON.stringify(f.scenario), before);
});
test('capability detection never labels absent runtime support as playable', () => {
  const f = fixture(),
    r = C.inspect(f.scenario);
  assert(r.valid);
  assert(r.profiles.every((p) => !p.enabled && p.errors.some((e) => e.code === 'capability-unavailable')));
});
test('exact ID chooses the second of two namesakes; missing ID never falls back to name', () => {
  const f = fixture();
  assert.equal(row(f).summary.characterId, 'cb');
  f.scenario.nativeStart.profiles[1].playerCharacterId = 'missing';
  has(f, 'character-missing');
  assert(row(f, 'pa').enabled, 'independent valid profile remains inspectable');
});
test('duplicate IDs within and across authoritative collections are blocking', () => {
  const f = fixture();
  f.scenario.classes[1].id = 'cb';
  const r = inspect(f);
  assert(r.errors.some((e) => e.code === 'duplicate-id'));
  assert(r.profiles.every((p) => !p.enabled));
  const g = fixture();
  g.scenario.nativeStart.profiles[1].id = 'pa';
  assert(inspect(g).errors.some((e) => e.code === 'duplicate-id'));
});
test('all supported dead markers block a start without reviving the character', () => {
  for (const marker of [{ alive: false }, { dead: true }, { status: 'dead' }, { status: '死亡' }]) {
    const f = fixture();
    Object.assign(f.scenario.characters[1], marker);
    has(f, 'character-dead');
  }
  const f = fixture();
  delete f.scenario.characters[1].alive;
  has(f, 'character-status-unknown');
});
test('royal title and old ruler label do not establish a current head relationship', () => {
  const f = fixture();
  f.scenario.factions[1].leaderCharacterId = 'cc';
  f.scenario.characters[1].title = '大皇帝';
  has(f, 'head-unproven');
});
test('explicit co-head and author-modeled basis are recognized without choosing the first head', () => {
  const f = fixture();
  f.scenario.factions[1].headOfStateIds = ['cg', 'cb'];
  assert(row(f).enabled);
  f.scenario.factions[1].headOfStateIds = ['cg'];
  has(f, 'head-unproven');
  f.scenario.nativeStart.authorities[1].basis = {
    kind: 'author-modeled',
    note: '合成共同执政声明',
    sourceRef: 'author-note-1',
  };
  assert(row(f).enabled);
});
test('representative remains representative with scoped grants even when display title changes', () => {
  const f = fixture();
  f.scenario.characters[2].title = '皇帝';
  const r = row(f, 'pr');
  assert(r.enabled);
  assert.equal(r.summary.roleKind, 'delegatedRepresentative');
  assert.deepEqual(f.scenario.nativeStart.authorities[2].grants, ['diplomacy']);
  f.scenario.nativeStart.authorities[2].basis.issuerCharacterId = 'cc';
  has(f, 'delegation-unproven', 'pr');
});
test('regency is an explicit relation rather than a title inference', () => {
  const f = fixture();
  f.scenario.factions[1].regentCharacterIds = [];
  has(f, 'regent-unproven', 'pg');
});
test('missing, inactive, role-mismatched, wildcard or unbounded authority is blocked', () => {
  for (const change of [
    (a) => {
      a.status = 'expired';
    },
    (a) => {
      a.roleKind = 'headOfState';
    },
    (a) => {
      a.grants = ['*'];
    },
    (a) => {
      delete a.jurisdiction;
    },
  ]) {
    const f = fixture();
    change(f.scenario.nativeStart.authorities[2]);
    assert(!row(f, 'pr').enabled);
  }
  const f = fixture();
  f.scenario.nativeStart.profiles[2].authorityRef = 'missing';
  has(f, 'authority-missing', 'pr');
});
test('region IDs and local rules must exist; no old-scenario fallbacks', () => {
  const f = fixture();
  f.scenario.nativeStart.profiles[1].startRegionId = '旧明朝省';
  has(f, 'region-missing');
  const g = fixture();
  g.scenario.nativeStart.profiles[1].rulesetRef = 'missing';
  has(g, 'ruleset-missing');
});
test('overrides are restricted to bounded opening text, not identity or world replacement', () => {
  const f = fixture();
  f.scenario.nativeStart.profiles[1].initialStateOverrides = { openingText: '乙国独立开场', startPressure: '有限库存' };
  assert(row(f).enabled);
  for (const override of [
    { characters: [] },
    { playerInfo: {} },
    { military: {} },
    { openingText: () => {} },
    { openingText: 'x'.repeat(16001) },
  ]) {
    f.scenario.nativeStart.profiles[1].initialStateOverrides = override;
    has(f, 'override-forbidden');
  }
});
test('zero accounts are real; missing/negative/nonfinite balances and borrowed foreign accounts are rejected', () => {
  const f = fixture();
  assert.equal(row(f, 'pa').summary.accounts[0].balance, 0);
  f.scenario.nativeStart.contentScopes[1].accountIds = ['account-a'];
  has(f, 'account-owner');
  for (const balance of [undefined, -1, Infinity, NaN, '0']) {
    const g = fixture();
    g.scenario.nativeStart.accounts[0].balance = balance;
    assert(inspect(g).errors.some((e) => e.code === 'account-invalid'));
  }
});
test('preview summaries use owner IDs, valid counts and original units without converting resources', () => {
  const f = fixture(),
    r = row(f);
  assert.equal(r.summary.soldiers, 80);
  assert.equal(r.summary.territoryCount, 1);
  assert.equal(r.summary.accounts[0].unit, 'unit-b');
  f.scenario.military.initialTroops[1].soldiers = undefined;
  assert.equal(row(f).summary.soldiers, null);
  delete f.scenario.map.regions[1].sovereignFactionId;
  assert.equal(row(f).summary.territoryCount, null);
});
test('army ownership and explicit joint pay are independent of commander nationality', () => {
  const f = fixture(),
    army = f.scenario.military.initialTroops[1];
  army.commanderId = 'ca';
  army.payerShares = [
    { accountId: 'account-a', share: 0.25 },
    { accountId: 'account-b', share: 0.75 },
  ];
  assert(inspect(f).valid);
  assert.equal(row(f).summary.soldiers, 80);
  assert.equal(army.ownerFactionId, 'fb');
  army.payerShares[1].share = 0.5;
  assert(inspect(f).errors.some((e) => e.code === 'army-payer-total'));
  army.payerShares = [{ accountId: 'missing', share: 1 }];
  assert(inspect(f).errors.some((e) => e.code === 'army-payer-share'));
  delete army.ownerFactionId;
  assert(inspect(f).errors.some((e) => e.code === 'army-owner'));
  const g = fixture();
  g.scenario.map.regions[1].taxAuthorityFactionId = 'missing';
  assert(inspect(g).errors.some((e) => e.code === 'region-authority-reference'));
});
test('closed profiles carry actual reasons; unsupported schema and corrupt map metadata fail closed', () => {
  const f = fixture();
  f.scenario.nativeStart.profiles[1].enabled = false;
  has(f, 'disabled-reason-missing');
  f.scenario.nativeStart.profiles[1].disabledReasons = ['作者暂未开放'];
  assert(row(f).valid);
  assert(!row(f).enabled);
  f.scenario.nativeStart.mapRef.contentHash = 'latest';
  assert(inspect(f).errors.some((e) => e.code === 'map-hash'));
  f.scenario.nativeStart.schemaVersion = 'unknown';
  assert.equal(inspect(f).valid, false);
});
test('legacy invalid explicit ID, multiple players and same-name ambiguity never silently substitute', () => {
  const f = fixture();
  delete f.scenario.nativeStart;
  f.scenario.playerInfo.characterId = 'missing';
  assert(!C.inspect(f.scenario).valid);
  delete f.scenario.playerInfo.characterId;
  f.scenario.characters[1].isPlayer = true;
  assert(!C.inspect(f.scenario).valid);
  f.scenario.characters.forEach((c) => {
    c.isPlayer = false;
  });
  f.scenario.playerInfo.characterName = '同名君主';
  assert(!C.inspect(f.scenario).valid);
});
test('legacy adapter is deterministic and preserves the bytes of all three official scenarios', () => {
  const dir = path.join(__dirname, '../../scenarios'),
    files = fs.readdirSync(dir).filter((f) => f.endsWith('（官方）.json'));
  const expected = { 'sc-tianqi7-1627': 'char_mp3yvbcal6op0', 'sc-jianyan1-1127-shaosong': 'char_jianyan1_01', 'sc-tang840-840': 'char-e75f49d9605e' };
  assert.equal(files.length, Object.keys(expected).length);
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(dir, file)),
      s = JSON.parse(bytes),
      original = JSON.stringify(s);
    const r = C.inspect(s);
    assert(r.valid, JSON.stringify(r.errors));
    assert.equal(r.mode, 'legacy');
    assert.equal(r.profiles.length, 1);
    assert.equal(r.profiles[0].summary.characterId, expected[s.id]);
    assert.deepEqual(C.inspect(s), r);
    assert.equal(JSON.stringify(s), original);
    assert.equal(
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(dir, file)))
        .digest('hex'),
      crypto.createHash('sha256').update(bytes).digest('hex'),
    );
  }
});
console.log(`native-start-contracts: ${pass} PASS / ${fail} FAIL`);
if (fail) process.exitCode = 1;

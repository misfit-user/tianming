// P1-B2/B3a：剧本产量、显式零、低产值、建筑增量与旧存档跨回合回归。
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const game = { GM: { turn: 1, policies: {} }, P: { conf: {} } };
game.window = game;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tm-fiscal-engine.js'), 'utf8'), game);
const settle = game.CascadeTax._settleLandFlow;
const pairs = [['saltProduction', 'saltRegion', 0.5], ['mineralProduction', 'mineralRegion', 0.1],
  ['horseProduction', 'horseRegion', 0.001], ['fishingProduction', 'fishingRegion', 0.05],
  ['maritimeTradeVolume', 'hasPort', 0.02], ['imperialFarmland', 'imperialDomain', 0.05]];
function division() {
  return { populationDetail: { mouths: 1000000, households: 200000, ding: 250000 }, prosperity: 50,
    corruption: 0, tags: {}, economyBase: { farmland: 1000000 }, carryingCapacity: { currentLoad: 1 } };
}
function resize(d, driver) { d.populationDetail.mouths = driver; d.economyBase.farmland = driver; }
for (const [key, tag, oldRate] of pairs) {
  for (const initial of [0, 25, 2000000]) {
    const d = division(); d.tags[tag] = true; d.economyBase[key] = initial;
    settle(d, { turnFracOfYear: 1 / 36 });
    assert.strictEqual(d.economyBase[key], initial, key + ' 首回合保留 ' + initial);
    d.economyBase[key] += 100; // 营造系统直接写入
    resize(d, 2000000); settle(d, {});
    assert.strictEqual(d.economyBase[key], initial * 2 + 100, key + ' 人口/田亩增加，保留建筑');
    const loaded = JSON.parse(JSON.stringify(d)); // 新存档读回仍沿用原始自然率
    resize(loaded, 1000000); settle(loaded, {});
    assert.strictEqual(loaded.economyBase[key], initial + 100, key + ' 读档后随人口/田亩回落');
    settle(loaded, {});
    assert.strictEqual(loaded.economyBase[key], initial + 100, key + ' 重复回合不累加');
  }
  const old = division(); old.tags[tag] = true;
  old.economyBase[key] = 1000000 * oldRate + 300;
  old.economyBase['_' + key + 'NaturalLast'] = 1000000 * oldRate;
  resize(old, 1200000); settle(old, {});
  assert.strictEqual(old.economyBase[key], Math.round(1200000 * oldRate) + 300, key + ' 旧存档建筑不放大');
  const untagged = division(); untagged.tags[tag] = false; untagged.economyBase[key] = 123;
  settle(untagged, {}); resize(untagged, 2000000); settle(untagged, {});
  assert.strictEqual(untagged.economyBase[key], 123, key + ' 非产区沿用原语义');
}
const empty = division(); empty.populationDetail.mouths = 0; empty.tags.saltRegion = true;
empty.economyBase.saltProduction = 0; settle(empty, {});
assert.ok(Number.isFinite(empty.economyBase._saltProductionNaturalRate));
const fractional = division(); fractional.tags.saltRegion = true; fractional.economyBase.saltProduction = 12.5;
settle(fractional, {}); assert.strictEqual(fractional.economyBase.saltProduction, 12.5);
settle(fractional, {}); assert.strictEqual(fractional.economyBase.saltProduction, 12.5, '驱动量未变，不取整漂移');
console.log('PASS production authored: six fields, high/low/zero, growth/decline, construction, save roundtrip and legacy migration');

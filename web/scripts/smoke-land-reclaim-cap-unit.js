// smoke-land-reclaim-cap-unit.js — 垦荒封顶单位（2026-10-14）
// 病：carryingCapacity.arable/historicalCap 是「口」(每亩养 0.3 口)，farmland 是「亩」，原来拿口数给亩数封顶，
//     口数只有亩数三成 → 中原各府开局就被判「已开满」，劝农诏一亩不涨（bot 10-13 在官方天启本实测）。
// 验：①有承载力数据的大府按 (1-载率)×1.5%×2.5 真涨 ②最终封顶 = 口数折亩×1.2（与开局田亩×1.2 取大）③无承载力数据也按开局两成封顶 ④载率≥1 不涨。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');

function harness() {
  const c = { console, GM: { policies: { encourageFarming: true }, turn: 1 }, P: {}, setTimeout, clearTimeout, addEB() {}, toast() {} };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-fiscal-engine.js'), 'utf8'), c, { filename: 'tm-fiscal-engine.js' });
  const settle = c.CascadeTax && c.CascadeTax._settleLandFlow;
  assert.strictEqual(typeof settle, 'function', 'CascadeTax._settleLandFlow 应导出');
  return { c, settle };
}
function div(farmland, cc) {
  const d = { name: '开封府', corruption: 50, minxin: 60, economyBase: { farmland: farmland, arableLand: farmland, landsAnnexed: 0, landsReclaimed: 0 } };
  if (cc) d.carryingCapacity = cc;
  return d;
}
const YEAR = { turnDays: 360, turnFracOfYear: 1 };
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n  ' + (e && e.stack || e)); } }

test('中原大府：500 万亩、承载 150 万口、载率 0.5、劝农 → 一年开垦 93,750 亩（原来 0 亩）', () => {
  const { settle } = harness();
  const d = div(5000000, { arable: 1500000, currentLoad: 0.5 });
  const r = settle(d, YEAR);
  assert.strictEqual(r.reclaimed, 93750, JSON.stringify(r));
  assert.strictEqual(d.economyBase.farmland, 5093750);
  assert.strictEqual(d.economyBase.landsReclaimed, 93750);
});

test('封顶：口数折亩×1.2 = 600 万亩，四十年后停在 600 万整', () => {
  const { settle } = harness();
  const d = div(5000000, { arable: 1500000, currentLoad: 0.5 });
  for (let y = 0; y < 40; y++) settle(d, YEAR);
  assert.strictEqual(d.economyBase.farmland, 6000000);
  assert.strictEqual(settle(d, YEAR).reclaimed, 0, '到顶后不再涨');
});

test('编辑器写了 historicalCap（口）：按它折亩封顶，高于 arable×1.2 时以它为准', () => {
  const { settle } = harness();
  const d = div(5000000, { arable: 1500000, historicalCap: 2400000, currentLoad: 0.5 });
  for (let y = 0; y < 60; y++) settle(d, YEAR);
  assert.strictEqual(d.economyBase.farmland, 8000000);  // 2,400,000 口 ÷ 0.3 = 8,000,000 亩
});

test('没有承载力数据的府州：按开局田亩两成封顶，默认载率 0.85 也能慢慢涨', () => {
  const { settle } = harness();
  const d = div(2000000, null);
  const r = settle(d, YEAR);
  assert.strictEqual(r.reclaimed, Math.round(2000000 * 0.15 * 0.015 * 2.5), JSON.stringify(r));
  for (let y = 0; y < 80; y++) settle(d, YEAR);
  assert.strictEqual(d.economyBase.farmland, 2400000);
  assert.strictEqual(d.economyBase._farmlandBaseline, 2000000, '开局底子记一次不再变');
});

test('载率 ≥ 1（人满为患）不开垦；不劝农时速率是劝农的 1/2.5', () => {
  const { c, settle } = harness();
  const full = div(5000000, { arable: 1500000, currentLoad: 1.1 });
  assert.strictEqual(settle(full, YEAR).reclaimed, 0);
  c.GM.policies.encourageFarming = false;
  const d = div(5000000, { arable: 1500000, currentLoad: 0.5 });
  assert.strictEqual(settle(d, YEAR).reclaimed, 37500);
});

test('兼并照旧：腐败 70 的府每年丢 0.8%，与开垦分账', () => {
  const { settle } = harness();
  const d = div(5000000, { arable: 1500000, currentLoad: 0.5 });
  d.corruption = 70;
  const r = settle(d, YEAR);
  assert.strictEqual(r.annexed, 40000, JSON.stringify(r));
  assert(r.reclaimed > 0);
});

console.log(`${passed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);

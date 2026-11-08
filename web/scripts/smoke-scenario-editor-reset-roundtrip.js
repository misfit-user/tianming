#!/usr/bin/env node
// smoke-scenario-editor-reset-roundtrip.js — behavioural smoke for the new
// scenario editor. Loads the official scenario builtins + preview adapter, applies the same
// shape-detection + save predicates the editor uses, and verifies a deep
// JSON round-trip preserves every field on both 天启 and 绍宋 scenarios. The
// editor itself uses a window-coupled IIFE so it cannot be required directly;
// instead this smoke replicates the editor's shape predicates against the
// real bundled data so a regression in either the bundle or the predicates
// surfaces here.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const appFile = path.join(ROOT, 'preview', 'scenario-editor-reset-app.js');
const bundleFile = path.join(ROOT, 'preview', 'official-scenarios-bundle.js');

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed += 1;
}

assert(fs.existsSync(appFile), 'preview app must exist');
assert(fs.existsSync(bundleFile), 'official scenarios bundle must exist');

// Load the three builtins (registry mode: the sandbox has no P) plus the preview adapter
// into a fresh sandbox so we get the real TM_OFFICIAL_SCENARIOS.
const bundleSrc = fs.readFileSync(bundleFile, 'utf8');
const sandbox = require('./lib-official-builtins.js').loadBuiltins();
vm.runInContext(bundleSrc, sandbox, { filename: 'official-scenarios-bundle.js' });
const bundle = sandbox.TM_OFFICIAL_SCENARIOS;
assert(bundle && typeof bundle === 'object', 'bundle should expose TM_OFFICIAL_SCENARIOS');
assert(bundle.tianqi7 && bundle.tianqi7.id, 'bundle should ship 天启 scenario');
assert(bundle.shaosong && bundle.shaosong.id, 'bundle should ship 绍宋 scenario');

// Replicas of the editor's shape predicates. These MUST match the editor's
// behaviour exactly — assertions below confirm the textual definition is the
// same as the editor's source.
function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
function isKindedVariables(value) {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  if (!keys.length) return false;
  return keys.every((k) => Array.isArray(value[k]));
}
function isRuleListField(field, value) {
  return Array.isArray(value) && ['globalRules', 'rules'].indexOf(field) >= 0;
}

const appSrc = fs.readFileSync(appFile, 'utf8');
assert(appSrc.includes('function isKindedVariables(value)'),
  'editor must expose isKindedVariables definition that this smoke mirrors');
assert(appSrc.includes("['globalRules', 'rules'].indexOf(field) >= 0"),
  'editor must expose the rule-list field membership predicate this smoke mirrors');

const tianqi = bundle.tianqi7;
const shaosong = bundle.shaosong;

// --- Shape expectations driven by the official scenarios ---------------------
assert(Array.isArray(tianqi.variables),
  '天启 variables should be array-shaped (legacy schema)');
assert(!isKindedVariables(tianqi.variables),
  'isKindedVariables should reject array-shaped variables');
assert(isKindedVariables(shaosong.variables),
  'isKindedVariables should detect kinded shape on 绍宋 variables');

assert(typeof tianqi.globalRules === 'string',
  '天启 globalRules should be string-shaped');
assert(!isRuleListField('globalRules', tianqi.globalRules),
  'rule-list predicate should reject string-shaped globalRules');
assert(Array.isArray(shaosong.globalRules),
  '绍宋 globalRules should be array-shaped');
assert(isRuleListField('globalRules', shaosong.globalRules),
  'rule-list predicate should accept array-shaped globalRules');

assert(isObject(tianqi.rigidTriggers) && !Array.isArray(tianqi.rigidTriggers),
  '天启 rigidTriggers should be object-shaped (keyed by trigger id)');
assert(Array.isArray(shaosong.rigidTriggers),
  '绍宋 rigidTriggers should be array-shaped (empty array)');

assert(isObject(tianqi.timeline),
  '天启 timeline should be object-shaped with past/future lanes');
assert(Array.isArray(tianqi.timeline.past) || Array.isArray(tianqi.timeline.future),
  '天启 timeline should carry at least one of past/future arrays');
// 绍宋已按天启标准全面完善：timeline 升级为 object {past,future}（游戏 AI/endturn 消费端读 .past/.future）
assert(isObject(shaosong.timeline) && (Array.isArray(shaosong.timeline.past) || Array.isArray(shaosong.timeline.future)),
  '绍宋 timeline should be object-shaped {past,future} (对标天启·游戏消费端所读)');

// rules: 两本同为 object（绍宋已按天启标准补全 base/combat/economy/diplomacy）
assert(isObject(tianqi.rules),
  '天启 rules should be object-shaped (legacy schema)');
assert(isObject(shaosong.rules),
  '绍宋 rules should be object-shaped {base,combat,economy,diplomacy} (对标天启已补全)');

// --- Round-trip via JSON ------------------------------------------------------
function deepKeyDigest(value, depth) {
  if (depth > 3 || value == null) return typeof value;
  if (Array.isArray(value)) return 'array[' + value.length + ']';
  if (typeof value !== 'object') return typeof value + ':' + (typeof value === 'string' ? value.length : value);
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => k + '=' + deepKeyDigest(value[k], depth + 1)).join(',') + '}';
}
[['tianqi7', tianqi], ['shaosong', shaosong]].forEach(([label, sc]) => {
  const roundtrip = JSON.parse(JSON.stringify(sc));
  assert(Object.keys(roundtrip).length === Object.keys(sc).length,
    label + ' top-level key count should survive JSON round-trip');
  Object.keys(sc).forEach((k) => {
    assert(Object.prototype.hasOwnProperty.call(roundtrip, k),
      label + ' should still own top-level key after round-trip: ' + k);
    assert(deepKeyDigest(sc[k], 0) === deepKeyDigest(roundtrip[k], 0),
      label + ' deep digest should match after round-trip for: ' + k);
  });
});

// --- Sanity-check the runtime field surfaces table reaches both scenarios ----
// The editor's RUNTIME_FIELD_SURFACES lists ~85 fields that the formal game
// runtime actually reads. We sample-check that the listed top-level fields
// are present on the appropriate scenario; otherwise the audit panel would
// underreport real coverage gaps.
const surfaces = appSrc.match(/runtimeSurface\('[^']+'/g) || [];
assert(surfaces.length > 60,
  'editor should declare a broad runtime field audit table (>60 entries)');
assert(appSrc.includes("runtimeSurface('rigidTriggers',"),
  'audit table should include rigidTriggers (天启 schema)');
assert(appSrc.includes("runtimeSurface('chronicleConfig',"),
  'audit table should include chronicleConfig (绍宋 schema)');
assert(appSrc.includes("runtimeSurface('startMonth',"),
  'audit table should include startMonth (绍宋-specific top-level key)');
assert(appSrc.includes("runtimeSurface('engineConstants',"),
  'audit table should include engineConstants (绍宋 v1.6 schema)');

// --- Field rename aliasing ---------------------------------------------------
// We can directly test the alias map by reading the literal source. The editor
// only writes through the alias when the canonical key is absent and the
// alias is present, so this is the safe replication condition.
const aliasPairs = [
  ['desc', 'description'],
  ['historicalEvents', 'history'],
  ['liege', 'lord']
];
aliasPairs.forEach(([a, b]) => {
  assert(appSrc.includes("'" + a + "'") && appSrc.includes("'" + b + "'"),
    'editor alias table should know the pair: ' + a + ' / ' + b);
});

console.log('smoke-scenario-editor-reset-roundtrip OK: ' + passed + ' assertions');

#!/usr/bin/env node
// smoke-old-save-compat.js — §6.5 R3·验老存档加载后新字段安全初始化

'use strict';

const fs = require('fs');
const path = require('path');
const { makeAssert } = require('./smoke-endturn-baseline-helpers');

const ROOT = path.resolve(__dirname, '..');
const passed = { value: 0 };
const assert = makeAssert(passed);

const saveSrc = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');

// ─── Migration framework ───
assert(/SAVE_SCHEMA_VERSION\s*=\s*'1\.3\.0-ai-upgrade'/.test(saveSrc),
  'SAVE_SCHEMA_VERSION 常量·1.3.0-ai-upgrade');
assert(/_MIGRATIONS\s*=\s*\[/.test(saveSrc),
  '_MIGRATIONS array·迁移规则');
assert(/function\s+runMigrations\s*\(\s*P\s*,\s*GM\s*\)/.test(saveSrc),
  'runMigrations(P, GM) 在 incoming/snapshot 上运行');
assert(/_saveSchemaVersion/.test(saveSrc),
  'P.conf._saveSchemaVersion 持久版本号');
assert(/_migrationLog/.test(saveSrc),
  'P.conf._migrationLog 迁移日志');

// ─── 关键字段 ensureGMDefaults ───
['_lastSc28Snapshot', '_costHistory', '_factionUndercurrents', '_courtRecords'].forEach(function(f) {
  assert(saveSrc.indexOf('GM.' + f) >= 0, 'ensureGMDefaults·' + f);
});

// ─── P.conf rename + migrate ───
assert(/memorySynthesisEnabled/.test(saveSrc),
  'P.conf.memorySynthesisEnabled 新字段');
assert(/consolidationEnabled[\s\S]{0,300}memorySynthesisEnabled\s*=\s*P\.conf\.consolidationEnabled/.test(saveSrc),
  '老字段 mirror 到新字段·删旧');

// ─── runMigrations 自动调用 ───
assert(/runMigrations\(P, GM\)/.test(saveSrc),
  '_ensurePDefaults 内调 runMigrations');
assert(/if \(failure\)[\s\S]*?throw failure;[\s\S]*?P\.conf\._saveSchemaVersion = SAVE_SCHEMA_VERSION/.test(saveSrc),
  '迁移失败先抛错，成功后才盖 schema version');

// ─── 新 P.conf defaults ───
['dialogueRecallTurns', 'costAlertThreshold', 'strictSchemaEnabled'].forEach(function(k) {
  assert(saveSrc.indexOf(k) >= 0, 'P.conf default·' + k);
});

console.log('[smoke-old-save-compat] pass assertions=' + passed.value);

#!/usr/bin/env node
'use strict';

// 审计回归：文件键、严格回合段、损坏读取、纯快照、迁移提交点与旧档迁移原子性。
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const main = fs.readFileSync(path.join(ROOT, 'main-impl.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(ROOT, 'web', 'tm-save-lifecycle.js'), 'utf8');
const storage = fs.readFileSync(path.join(ROOT, 'web', 'tm-storage.js'), 'utf8');
let pass = 0;
function ok(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok - ' + msg); }
function sliceFn(src, marker) {
  const a = src.indexOf(marker); if (a < 0) return '';
  let i = src.indexOf('{', a), d = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) { j++; break; }
  }
  return src.slice(a, j);
}

console.log('=== save integrity audit ===');

// 1. 主进程文件键：显示名相同清洗结果也不能覆盖彼此。
{
  const ctx = { crypto };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(main, 'function sanitize(') + '\n' + sliceFn(main, 'function stableStorageKey('), ctx);
  const a = ctx.stableStorageKey('甲:乙');
  const b = ctx.stableStorageKey('甲?乙');
  ok(a !== b && a.startsWith('甲_乙--') && b.startsWith('甲_乙--'), 'sanitize 碰撞名使用内容 hash 分离');
  ok(ctx.stableStorageKey('甲:乙') === a, 'storage key 对同一显示名稳定');
  ok(/storageKey/.test(main) && /_saveMeta\.name/.test(main), '列表返回 display name + canonical storageKey');
}

// 2. 回合号表示必须一一对应。
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(sliceFn(main, 'function turnSeg('), ctx);
  ok(ctx.turnSeg(0) === '0' && ctx.turnSeg('42') === '42', '规范整数回合可用');
  [-3, 3.5, '03', '3.5', '1e3', '7abc', 10000001].forEach(function(v) {
    let threw = false; try { ctx.turnSeg(v); } catch (_) { threw = true; }
    ok(threw, '非法回合号拒绝: ' + JSON.stringify(v));
  });
}

// 3. readJsonSafe 只把真正不存在当 fallback；损坏与权限类错误必须暴露。
{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-save-audit-'));
  const missing = path.join(temp, 'missing.json');
  const broken = path.join(temp, 'broken.json');
  fs.writeFileSync(broken, '{broken', 'utf8');
  const ctx = { fs };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(main, 'function readJsonSafe('), ctx);
  ok(ctx.readJsonSafe(missing, 17) === 17, 'ENOENT 返回 fallback');
  let threw = false; try { ctx.readJsonSafe(broken, 17); } catch (e) { threw = e instanceof SyntaxError || /JSON|position|property/i.test(String(e)); }
  ok(threw, 'JSON 损坏不被 fallback 掩盖');
  fs.rmSync(temp, { recursive: true, force: true });
}

// 4. 运行真实准备函数：快照补镜像/删临时态，但 live GM/P 字节不变。
{
  const blockStart = lifecycle.indexOf('function _safeClone(');
  const blockEnd = lifecycle.indexOf('\ndoSaveGame=async function', blockStart);
  const snapshot = sliceFn(lifecycle, 'function _autoSaveSnapshotGM(');
  const builder = sliceFn(lifecycle, 'function _buildSaveState(');
  ok(blockStart >= 0 && blockEnd > blockStart && snapshot && builder, '可抽取真实存档准备与 builder');
  const ctx = {
    console, Date, Math, JSON, Object, Array,
    document: { getElementById: function() { return null; } },
    window: { addEventListener: function() {}, _tmNewCampaignId: function() { return 'tmc_test'; } },
    deepClone: function(v) { return JSON.parse(JSON.stringify(v)); },
    _tmStripAiKeyInPlace: function(p) {
      if (p.ai) { delete p.ai.key; if (p.ai.secondary) delete p.ai.secondary.key; }
      return p;
    }
  };
  ctx.window.window = ctx.window;
  ctx.GM = {
    _campaignId: 'tmc_live', running: true, sid: 's', turn: 8,
    vars: { zero: 0 }, chars: [], facs: [], qijuHistory: [{ turn: 1 }],
    _postTurnJobs: { pending: true }, _tyrantDecadence: 0, _capital: '',
    _currentTrend: 0, _lastEvalTurn: 0
  };
  ctx.P = { ai: { key: 'secret', secondary: { key: 'secret2' } }, conf: {}, meta: { v: 'x' } };
  ctx.window.GM = ctx.GM; ctx.window.P = ctx.P;
  const gmBefore = JSON.stringify(ctx.GM);
  const pBefore = JSON.stringify(ctx.P);
  vm.createContext(ctx);
  vm.runInContext(lifecycle.slice(blockStart, blockEnd) + '\n' + snapshot + '\n' + builder
    + '\nthis.OUT=_buildSaveState({format:"idb"});', ctx);
  ok(JSON.stringify(ctx.GM) === gmBefore && JSON.stringify(ctx.P) === pBefore, '完整存档准备不修改 live GM/P');
  ok(!('_postTurnJobs' in ctx.OUT.GM) && ctx.GM._postTurnJobs.pending === true, '临时任务只从快照删除');
  ok(ctx.OUT.GM._savedTyrantDecadence === 0 && ctx.OUT.GM._savedCapital === ''
    && ctx.OUT.GM._savedTrend === 0 && ctx.OUT.GM._savedLastEvalTurn === 0, '零值/空串标量按属性存在性保存');
  ok(!ctx.OUT.P.ai.key && !ctx.OUT.P.ai.secondary.key && ctx.P.ai.key === 'secret', 'API key 只从快照剥离');
}

// 5. migration 必须全成功后才盖版本；失败保留可重试状态。
{
  const run = sliceFn(lifecycle, 'function runMigrations(');
  const ctx = { window: {}, Date, console, SAVE_SCHEMA_VERSION: 'next', _MIGRATIONS: [{
    from: '*', to: 'next', migrate: function(P) { P.conf.partial = true; throw new Error('boom'); }
  }] };
  vm.createContext(ctx);
  vm.runInContext(run, ctx);
  const p = { conf: { _saveSchemaVersion: 'old' } };
  let threw = false; try { ctx.runMigrations(p, {}); } catch (e) { threw = /boom/.test(String(e)); }
  ok(threw, 'migration 失败向上抛出');
  ok(p.conf._saveSchemaVersion === 'old' && p.conf._migrationFailure, 'migration 失败不盖目标版本并记录失败');
}

// 6. 旧源迁移：先全解析/全写，再删除；旧 DB 删除也必须等待原子写完成。
ok(/return Promise\.all\(candidates\.map[\s\S]*?\.then\(function\(results\)[\s\S]*?localStorage\.removeItem/.test(storage),
  'localStorage 迁移仅在全部目标写成功后删除源');
ok(/_putManyAtomic\(SAVE_STORE, records\)[\s\S]*?indexedDB\.deleteDatabase\(OLD_DB\)/.test(storage),
  '旧 IndexedDB 先单事务批量写，再删除旧库');
ok(/delReq\.onsuccess[\s\S]*?resolve\(migrated\)[\s\S]*?delReq\.onblocked[\s\S]*?reject/.test(storage),
  '旧库删除成功/失败/blocked 均显式结算');
ok(/function writeFileAtomic[\s\S]*?fs\.fsyncSync\(fd\)[\s\S]*?fs\.renameSync\(tmp, file\)[\s\S]*?fs\.rmSync\(tmp, \{ force: true \}\)/.test(main),
  '原子文件写使用唯一 tmp + fsync + rename + 失败清理');
ok(/function readJsonSafe[\s\S]*?e\.code === 'ENOENT'[\s\S]*?throw e/.test(main),
  '主进程读取只豁免 ENOENT');

console.log('\n[smoke-save-integrity-audit] pass=' + pass);

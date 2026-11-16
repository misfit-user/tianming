#!/usr/bin/env node
/* eslint-env node */
'use strict';
// smoke-yingzao-shadow.js — 营造「未知建筑」影子根治三刀契约（2026-07-04）
// 病根链（真机E2E已复现·mock AI整回合）：
//   ①AI落建造新通道只搜 P.adminHierarchy——真机存档 P 常为空{}·活树在 GM→真记录静默没建；
//   ②掉进旧兼容通道·自拟中文名反查 BUILDING_TYPES 失败→createBuilding 铸「未知建筑」影子进 GM.buildings；
//   ③影子按 territory|type 键位把新账真记录挤出 getAllBuildingsCompat→营造志全显「未知建筑·完好」
//     （无 status 渲成完好=「一回合全修好」假象）。
// 三刀：刀1写口双源(P→GM·divisions||children)+刀1b在建同名复报勿重(勿误升级提前入账)；
//       刀2反查失败绝不铸影子；刀3a读档存量清障(buildIndices 前)+刀3b compat合并层影子过滤。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function ok(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
  passed += 1;
}

// ── A. 刀3b 功能验：compat 合并层影子过滤（vm 实跑 tm-indices.js）──
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-indices.js'), 'utf8'), ctx, { filename: 'tm-indices.js' });

ctx.BUILDING_TYPES = { granary: { name: '粮仓' } };
ctx.P = { adminHierarchy: {} };   // 仿真机他档：P 库树为空
ctx.GM = {
  buildings: [
    // 影子条目：名=未知建筑·type=自拟中文名(反查不到)·无描述无 status——必须被过滤
    { id: 's1', type: '平壤大学', name: '未知建筑', territory: '北直隶', level: 1 },
    // 旧账正经条目：type 可反查——必须保留
    { id: 'g1', type: 'granary', name: '粮仓', territory: '北直隶', level: 2 }
  ],
  adminHierarchy: {
    player: {
      divisions: [
        { name: '北直隶', buildings: [
          { name: '平壤大学', isCustom: true, level: 1, status: 'building', remainingTurns: 60, description: '自拟大工程' }
        ] }
      ]
    }
  }
};

const all = vm.runInContext('getTerritoryBuildingsCompat("北直隶")', ctx);
ok(!all.some((b) => b.name === '未知建筑'), '刀3b:「未知建筑」影子条目不入 compat 合并清单');
ok(all.some((b) => b.name === '平壤大学' && b._divisionBuilding && b.status === 'building'),
  '刀3b: 新账真记录不再被影子按 territory|type 键位挤出（营造志全显未知建筑的直接病灶）');
ok(all.some((b) => b.name === '粮仓' && !b._divisionBuilding), '刀3b: 旧账可反查条目照常保留（老经济结算不受伤）');

// 边界：名恰叫未知建筑但 type 可反查（防误杀）——保留
ctx.GM.buildings.push({ id: 's2', type: 'granary', name: '未知建筑', territory: '南直隶', level: 1 });
const nan = vm.runInContext('getTerritoryBuildingsCompat("南直隶")', ctx);
ok(nan.length === 1, '刀3b: type 可反查的条目即便名为未知建筑也不误杀（只杀反查失败的死影子）');

// ── B. 刀3a 源契约：读档存量清障（tm-save-lifecycle.js）──
const saveSrc = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const purgeAt = saveSrc.indexOf('影子条目存量清障');
ok(purgeAt > 0, '刀3a: fullLoadGame 带影子条目存量清障段');
const purgeSeg = saveSrc.slice(purgeAt, purgeAt + 900);
ok(/GM\.buildings\.filter/.test(purgeSeg) && /未知建筑/.test(purgeSeg) && /!BUILDING_TYPES\[b\.type\]/.test(purgeSeg),
  '刀3a: 清障判据 = 名未知建筑 且 type 反查不到（与刀3b 同判据）');
const rebindHelperAt = saveSrc.indexOf('function _tmRebindRuntimeWorld(');
const rebindHelperSeg = saveSrc.slice(rebindHelperAt, rebindHelperAt + 3000);
const finalRebindAt = saveSrc.indexOf('_tmRebindRuntimeWorld({ strict: true, map: false })', purgeAt);
ok(rebindHelperAt > 0 && /buildIndices\(\)/.test(rebindHelperSeg) && finalRebindAt > purgeAt,
  '刀3a: 清障先于统一 runtime rebind 内的 buildIndices 重建（buildingByTerritory 不残留死引用）');

// ── C. 刀1/刀1b/刀2 源契约：AI落建造写口（tm-endturn-apply.js）──
const applySrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
const bcAt = applySrc.indexOf('building_changes.forEach');
ok(bcAt > 0, '刀1: building_changes 处理段存在');
const bcSeg = applySrc.slice(bcAt, bcAt + 12000);
ok(/_bcRoots\.push\(GM\.adminHierarchy\)/.test(bcSeg), '刀1: 找地块双源——GM.adminHierarchy 入搜索根（P 空档真记录不再静默没建）');
ok(!/_bcRoots\.push\(P\.adminHierarchy\)/.test(bcSeg), '刀1→11-15: 只搜游戏里那份区划（剧本库那份不再入搜索根·区划只留一份）');
ok(/fh\.divisions \|\| fh\.children/.test(bcSeg), '刀1: 顶层 divisions||children 都认（对齐 _adminSources 范式）');
ok(/noop_inprogress/.test(bcSeg) && /b\.status === 'building'/.test(bcSeg),
  '刀1b: 在建同名·AI复报置 noop（勿重复立项/勿误升级提前入账）');
ok(/bc\.action === 'build' \|\| bc\.action === 'custom_build'\) \{\s*\n\s*\/\/ build/.test(bcSeg),
  '刀1b: 落账分支显式条件（noop 整链穿过·非 catch-all else）');
ok(/_btResolved/.test(bcSeg) && /bc\.action === 'build' && _bcType && _btResolved/.test(bcSeg),
  '刀2: 旧兼容通道反查失败绝不 createBuilding 铸「未知建筑」影子');

console.log('[smoke-yingzao-shadow] pass assertions=' + passed);

#!/usr/bin/env node
/* eslint-env node */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function ok(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
  passed += 1;
}

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-indices.js'), 'utf8'), ctx, { filename: 'tm-indices.js' });

ctx.P = {
  adminHierarchy: {
    player: {
      divisions: [
        { name: '宁远', buildings: [{ name: '镇边堡', level: 1, status: 'building' }] },
        { name: '山海关', children: [{ name: '关城', buildings: [{ name: '敌台', level: 2, status: 'completed' }] }] }
      ]
    }
  }
};
ctx.GM = {
  buildings: [
    { id: 'old1', type: 'granary', name: '旧仓', territory: '宁远', level: 1 },
    { id: 'dup1', type: '镇边堡', name: '镇边堡', territory: '宁远', level: 1 }
  ],
  adminHierarchy: {}
};

const all = vm.runInContext('getAllBuildingsCompat()', ctx);
ok(Array.isArray(all), 'getAllBuildingsCompat 返回数组');
ok(all.some((b) => b.name === '旧仓' && !b._divisionBuilding), '兼容视图保留旧 GM.buildings');
ok(all.some((b) => b.name === '敌台' && b.territory === '关城' && b._divisionBuilding), '兼容视图收集嵌套 division.buildings[]');
ok(all.filter((b) => b.name === '镇边堡' && b.territory === '宁远').length === 1, '同地同名旧账/新账不重复展示');

const guancheng = vm.runInContext('getTerritoryBuildingsCompat("关城")', ctx);
ok(guancheng.length === 1 && guancheng[0].name === '敌台', 'getTerritoryBuildingsCompat 可按新主链 territory 查询');

const militarySrc = fs.readFileSync(path.join(ROOT, 'tm-military.js'), 'utf8');
const calcMatch = militarySrc.match(/function calculateBuildingOutput\(\)[\s\S]*?\/\/ 注册建筑产出到结算流水线/);
ok(calcMatch && /GM\.buildings/.test(calcMatch[0]), '旧建筑产出公式仍只读 GM.buildings');
ok(calcMatch && !/getAllBuildingsCompat|getTerritoryBuildingsCompat/.test(calcMatch[0]), '新 division.buildings[] 不进入旧产出公式，避免重复收益');

console.log('[smoke-building-compat] pass assertions=' + passed);

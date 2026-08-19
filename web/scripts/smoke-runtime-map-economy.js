#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'tm-economy.js'), 'utf8');
let assertions = 0;

function check(condition, message) {
  if (!condition) throw new Error('[smoke-runtime-map-economy] ' + message);
  assertions += 1;
}

const changes = [];
const context = {
  console: { log() {}, warn() {}, error() {} },
  Math, Date, JSON, Object, Array, Number, String, Boolean,
  parseInt, parseFloat, isFinite,
  finiteNumberOr(value, fallback) { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; },
  clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
  recordChange() { changes.push(Array.from(arguments)); },
  addEB() {},
  P: {
    economyConfig: { baseIncome: 100, redistributionRate: 0.5 },
    map: {
      regions: [
        { id: 'template-a', name: '同名州', population: 1000000, controller: '朝廷' }
      ]
    }
  },
  GM: {
    turn: 8,
    classes: [],
    eraState: { centralControl: 0.5, economicProsperity: 1, socialStability: 1 },
    mapData: {
      regions: [
        { id: 'runtime-a', name: '同名州', population: 1000, controller: '某节度使' },
        { id: 'runtime-b', name: '同名州', population: 2000, controller: '某节度使' }
      ]
    }
  }
};
context.getLiveMapData = () => context.GM.mapData;
context.window = context;
context.global = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'tm-economy.js' });

context.updateEconomy(1);

const tributeRows = changes.filter((row) => row[0] === 'economy' && row[2] === 'tribute');
const allocationRows = changes.filter((row) => row[0] === 'economy' && row[2] === 'allocation');
check(tributeRows.length === 2, 'both runtime regions must be taxed even when their display names match');
check(tributeRows[0][4] === 35 && tributeRows[1][4] === 35,
  'tax must use GM population/controller, not the high-population civil template region');
check(allocationRows.length === 2, 'stable region ids must prevent same-name redistribution ledger collisions');
check(context.P.map.regions[0].population === 1000000 && context.GM.mapData.regions[0].population === 1000,
  'template and runtime fixtures must remain isolated');

console.log('[smoke-runtime-map-economy] PASS assertions=' + assertions);

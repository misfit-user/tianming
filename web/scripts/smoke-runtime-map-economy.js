#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'tm-economy.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(ROOT, 'tm-map-system.js'), 'utf8');
let assertions = 0;

function check(condition, message) {
  if (!condition) throw new Error('[smoke-runtime-map-economy] ' + message);
  assertions += 1;
}

function extractFunction(text, name) {
  const start = text.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing function ' + name);
  const brace = text.indexOf('{', start);
  let depth = 0, quote = null, escaped = false;
  for (let i = brace; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('unterminated function ' + name);
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

const mapContext = {
  P: { adminHierarchy: null, map: { regions: [{ id: 'r1', name: '模板地区', owner: '旧主', color: '#111111' }], items: [] } },
  GM: {
    adminHierarchy: null,
    facs: [{ id: 'new-owner', name: '新主', color: '#abcdef' }],
    mapData: { regions: [{ id: 'r1', name: '运行地区', owner: 'new-owner', color: '#222222' }], items: [], factionColors: {} }
  },
  _dbg() {}
};
mapContext.getLiveMapData = () => mapContext.GM.mapData;
mapContext.window = mapContext;
mapContext.globalThis = mapContext;
vm.createContext(mapContext);
vm.runInContext(extractFunction(mapSource, 'updateMapColors'), mapContext, { filename: 'updateMapColors.js' });
mapContext.updateMapColors();
check(mapContext.GM.mapData.regions[0].color === '#abcdef', 'map color refresh must update the runtime GM region');
check(mapContext.P.map.regions[0].color === '#111111', 'map color refresh must not mutate or display the scenario template region');

console.log('[smoke-runtime-map-economy] PASS assertions=' + assertions);

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'tm-map-system.js'), 'utf8');
let assertions = 0;
function check(condition, message) {
  if (!condition) throw new Error('[smoke-map-pathfinding-heap] ' + message);
  assertions += 1;
}

function extractFunction(text, name) {
  const start = text.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing function ' + name);
  const brace = text.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
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

const context = { GM: { mapData: { adjacencyGraph: {}, regions: [] } }, P: { battleConfig: { supplyConfig: {} }, map: { regions: [] } } };
context.getLiveMapData = () => context.GM.mapData;
vm.createContext(context);
vm.runInContext(extractFunction(source, 'findPath'), context, { filename: 'findPath.js' });
vm.runInContext(extractFunction(source, 'calculateSupplyLine'), context, { filename: 'calculateSupplyLine.js' });

context.GM.mapData.adjacencyGraph = {
  A: [
    { target: 'B', distance: 10, movementCost: 1, type: 'land', terrain: 'plain' },
    { target: 'C', distance: 1, movementCost: 1, type: 'land', terrain: 'forest', hasPostRoad: true }
  ],
  C: [{ target: 'B', distance: 1, movementCost: 1, type: 'land', terrain: 'hill' }],
  B: []
};
let result = context.findPath('A', 'B');
check(JSON.stringify(result.path) === JSON.stringify(['A', 'C', 'B']) && result.cost === 1.7,
  'Dijkstra heap must relax a previously discovered node to the cheaper route');
check(result.hasPostRoad === true && JSON.stringify(result.terrainTypes) === JSON.stringify(['forest', 'hill']),
  'predecessor reconstruction must preserve terrain order and post-road metadata');

context.GM.mapData.adjacencyGraph = {
  A: [
    { target: 'W', distance: 2, movementCost: 1, type: 'water', terrain: 'water' },
    { target: 'L', distance: 1, movementCost: 1, type: 'land', terrain: 'plain' }
  ],
  W: [{ target: 'B', distance: 2, movementCost: 1, type: 'water', terrain: 'water' }],
  L: [{ target: 'B', distance: 1, movementCost: 1, type: 'land', terrain: 'plain' }],
  B: []
};
result = context.findPath('A', 'B', { waterOnly: true });
check(JSON.stringify(result.path) === JSON.stringify(['A', 'W', 'B']), 'waterOnly must filter every land edge');

context.GM.mapData.regions = [
  { id: 'C', owner: '敌军' }, { id: 'D', owner: '我军' }, { id: 'B', owner: '我军' }
];
context.GM.mapData.adjacencyGraph = {
  A: [
    { target: 'C', distance: 1, movementCost: 1, type: 'land' },
    { target: 'D', distance: 3, movementCost: 1, type: 'land' }
  ],
  C: [{ target: 'B', distance: 1, movementCost: 1, type: 'land' }],
  D: [{ target: 'B', distance: 3, movementCost: 1, type: 'land' }],
  B: []
};
result = context.findPath('A', 'B', { avoidEnemy: true, faction: '我军' });
check(JSON.stringify(result.path) === JSON.stringify(['A', 'D', 'B']), 'avoidEnemy must consult live runtime ownership');

context.P.map.regions = [{ id: 'C', owner: '我军' }];
context.GM.mapData.regions = [{ id: 'C', owner: '敌军' }, { id: 'B', owner: '我军' }];
context.GM.mapData.adjacencyGraph = {
  A: [{ target: 'C', distance: 1, movementCost: 1, type: 'land' }],
  C: [{ target: 'B', distance: 1, movementCost: 1, type: 'land' }],
  B: []
};
let supply = context.calculateSupplyLine('A', 'B', '我军');
check(supply.isCut === true && supply.efficiency === 0.1,
  'supply occupation must use hostile GM runtime state even when P template still says friendly');
context.GM.mapData.regions[0].owner = '我军';
context.P.battleConfig.supplyConfig.distanceDecay = 0;
supply = context.calculateSupplyLine('A', 'B', '我军');
check(supply.isCut === false && supply.efficiency === 1,
  'explicit distanceDecay=0 must remain zero instead of reverting to the default');

const graph = Object.create(null);
const count = 4000;
for (let i = 0; i < count; i++) {
  const edges = [];
  if (i + 1 < count) edges.push({ target: String(i + 1), distance: 1, movementCost: 1, type: 'land' });
  if (i + 2 < count) edges.push({ target: String(i + 2), distance: 2, movementCost: 1, type: 'land' });
  graph[String(i)] = edges;
}
context.GM.mapData.regions = [];
context.GM.mapData.adjacencyGraph = graph;
const startedAt = Date.now();
result = context.findPath('0', String(count - 1));
check(result && result.cost === count - 1 && result.path[0] === '0' && result.path[result.path.length - 1] === String(count - 1),
  'large graph must return the optimal route');
check(Date.now() - startedAt < 2000, '4000-node path should complete without repeated full-queue sorts or path cloning');
check(!/openSet\.sort|current\.path\.concat/.test(extractFunction(source, 'findPath')) && /bestG/.test(extractFunction(source, 'findPath')),
  'source guard requires heap relaxation and predecessor reconstruction');

console.log('[smoke-map-pathfinding-heap] PASS assertions=' + assertions);

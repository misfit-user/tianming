'use strict';
// 地图只存一份：P.map / P.mapData 与 GM.mapData 同一对象时，存档里只写 GM 那份；
// 读档后恢复出的剧本模板内容不变，且按读档校验的要求不与运行地图共享引用。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'tm-save-lifecycle.js'), 'utf8');
function slice(marker) {
  const start = source.indexOf(marker);
  assert(start >= 0, 'missing ' + marker);
  let at = source.indexOf('{', start), depth = 0;
  for (; at < source.length; at++) {
    if (source[at] === '{') depth++;
    else if (source[at] === '}' && --depth === 0) return source.slice(start, at + 1);
  }
  throw new Error('unterminated ' + marker);
}
function context() {
  const c = {
    Object, Array, JSON, structuredClone,
    deepClone: v => (v === null || typeof v !== 'object') ? v : structuredClone(v),
    // 只关心 P 的处理：GM 快照照样深拷贝，AI Key 剥离在此无关
    _autoSaveSnapshotGM: gm => structuredClone(gm),
    _tmStripAiKeyInPlace: p => p
  };
  vm.createContext(c);
  vm.runInContext([slice('function _safeClone('), slice('function _tmMapAliasesOfGM('), slice('function _tmRestoreMapAliases('), slice('function _tmSeparateMapTemplate('), slice('function _buildSaveState(')].join('\n'), c);
  return c;
}
function map(n) {
  return { id: 'fixture-map', regions: Array.from({ length: n }, (_, i) => ({ id: 'r' + i, name: '地块' + i, owner: 'f' + (i % 3), polygon: [[i, i + 1], [i + 2, i + 3]] })) };
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

test('only the same object counts as an alias', () => {
  const c = context(), m = map(3);
  assert.deepEqual(Array.from(c._tmMapAliasesOfGM({ map: m, mapData: m }, { mapData: m })), ['map', 'mapData']);
  assert.deepEqual(Array.from(c._tmMapAliasesOfGM({ map: m, mapData: map(3) }, { mapData: m })), ['map'], '内容相同但不是同一对象的照旧整份存');
  assert.deepEqual(Array.from(c._tmMapAliasesOfGM({ map: map(3) }, { mapData: m })), []);
  assert.deepEqual(Array.from(c._tmMapAliasesOfGM({ map: m }, { mapData: { regions: [] } })), [], '空地图不省');
  assert.deepEqual(Array.from(c._tmMapAliasesOfGM({ map: m }, {})), []);
});

test('aliased maps are saved once and live P is untouched', () => {
  const c = context(), m = map(50);
  const P = { conf: { a: 1 }, map: m, mapData: m, scenarios: [{ id: 's1' }] };
  const GM = { turn: 5, mapData: m, chars: [] };
  const state = c._buildSaveState({ gm: GM, p: P, prepare: false });
  assert.equal('map' in state.P, false);
  assert.equal('mapData' in state.P, false);
  assert.deepEqual(Array.from(state.P._mapAliasesOfGM), ['map', 'mapData']);
  assert.deepEqual(state.GM.mapData, m);
  assert.deepEqual(state.P.scenarios, P.scenarios);
  assert(P.map === m && P.mapData === m && !('_mapAliasesOfGM' in P), '运行中的 P 不受影响');
  const project = c._buildSaveState({ gm: GM, p: P, prepare: false, format: 'project' });
  assert.equal('map' in project, false);
  assert.deepEqual(project.gameState.mapData, m);
});

test('a separately held map is still saved in full', () => {
  const c = context(), m = map(10), editorMap = map(4);
  const state = c._buildSaveState({ gm: { turn: 1, mapData: m }, p: { map: editorMap, mapData: m }, prepare: false });
  assert.deepEqual(state.P.map, editorMap);
  assert.equal('mapData' in state.P, false);
  assert.deepEqual(Array.from(state.P._mapAliasesOfGM), ['mapData']);
});

test('load restores the template before rebind, and the rebind leaves template and runtime map unshared', () => {
  const c = context(), m = map(20);
  const saved = JSON.parse(JSON.stringify(c._buildSaveState({ gm: { turn: 9, mapData: m }, p: { map: m, mapData: m, conf: {} }, prepare: false })));
  const loadedMap = saved.GM.mapData;
  assert.deepEqual(Array.from(c._tmRestoreMapAliases(saved.P, saved.GM)), ['map', 'mapData']);
  assert(saved.P.map === loadedMap && saved.P.mapData === loadedMap, '重绑定前先指回读入的那份地图');
  assert.equal('_mapAliasesOfGM' in saved.P, false);
  saved.GM.mapData = structuredClone(saved.GM.mapData);   // 模拟运行地图重绑定：GM 换成新克隆
  c._tmSeparateMapTemplate(saved.P, saved.GM, ['map', 'mapData']);
  assert(saved.P.map !== saved.GM.mapData && saved.P.mapData !== saved.GM.mapData, '读档校验：剧本模板不与运行地图共享引用');
  assert.deepEqual(saved.P.map, m, '模板内容与旧存档单独存的那份相同');
  assert.deepEqual(saved.GM.mapData, m, '地图内容逐项一致');
  const old = { map: map(2), mapData: map(2), conf: {} };
  const oldSnapshot = JSON.stringify(old);
  assert.deepEqual(Array.from(c._tmRestoreMapAliases(old, { mapData: m })), []);
  assert.equal(JSON.stringify(old), oldSnapshot, '旧存档没有标记，原样不动');
});

test('without a rebind (e.g. AI geography) the template gets its own copy', () => {
  const c = context(), m = map(5);
  const P = { _mapAliasesOfGM: ['map', 'mapData'] }, GM = { mapData: m };
  c._tmRestoreMapAliases(P, GM);
  c._tmSeparateMapTemplate(P, GM, ['map', 'mapData']);
  assert(P.map !== GM.mapData && P.mapData !== GM.mapData);
  assert(P.map === P.mapData, '两个键共用同一份模板副本');
  assert.deepEqual(P.map, m);
});

test('saved size drops by the two duplicate copies', () => {
  const c = context(), m = map(2000);
  const P = { map: m, mapData: m, conf: {} }, GM = { turn: 1, mapData: m };
  const now = JSON.stringify(c._buildSaveState({ gm: GM, p: P, prepare: false })).length;
  const mapSize = JSON.stringify(m).length;
  assert(now < mapSize * 1.1, '存档只含一份地图：' + now + ' vs 地图 ' + mapSize);
});

console.log(JSON.stringify({ passed }));

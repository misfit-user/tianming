'use strict';
// Read-only harness: always execute the selected worktree's implementation.
const fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn');
const { webcrypto } = require('crypto');
const ROOT = path.resolve(__dirname, '../..');
function read(root, file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function functionSource(source, name) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  let found;
  function visit(node) {
    if (!node || typeof node !== 'object' || found) return;
    if (node.type === 'FunctionDeclaration' && node.id.name === name) { found = node; return; }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  if (!found) throw new Error('production-function-missing: ' + name);
  return source.slice(found.start, found.end);
}
function storage(root = ROOT, options = {}) {
  const work = { encodes: 0, encodedBytes: 0, encodeMs: [], spans: {}, counts: {}, warnings: [] };
  const local = new Map();
  class Encoder {
    encode(text) {
      const t = performance.now(), bytes = new TextEncoder().encode(text);
      work.encodes++; work.encodedBytes += bytes.length; work.encodeMs.push(performance.now() - t);
      return bytes;
    }
  }
  const c = {
    console: { log() {}, warn(...args) { work.warnings.push(String(args[0])); }, error() {} },
    Blob, Response, CompressionStream, DecompressionStream, TextDecoder, TextEncoder: Encoder,
    crypto: webcrypto, performance, setTimeout, clearTimeout, navigator: {},
    localStorage: { get length() { return local.size; }, key: i => [...local.keys()][i],
      getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)), removeItem: key => local.delete(key) },
    TM: { perf: { count(n, v) { work.counts[n] = (work.counts[n] || 0) + v; }, withSpan(n, fn) {
      const t = performance.now(), result = fn();
      const done = () => { (work.spans[n] ||= []).push(performance.now() - t); };
      if (result && typeof result.then === 'function') return result.finally(done);
      done(); return result;
    } } },
    ...options
  };
  c.window = c; vm.createContext(c);
  vm.runInContext(read(root, 'web/tm-storage.js'), c, { filename: 'tm-storage.js' });
  return { c, work, local };
}
function mapRenderer(root = ROOT, regions = [], legacyLabels = false) {
  const source = read(root, 'web/phase8-formal-map.js');
  const stage = { innerHTML: '', dataset: {}, querySelector() { return this.innerHTML.includes('tmf-formal-map') ? {} : null; } };
  const work = { paths: 0, layouts: 0, chrome: 0, features: 0 };
  const c = {
    console, performance, Map, state: {}, document: { getElementById: () => ({}) },
    mapStage: () => stage, isGameVisible: () => true,
    map: { id: 'fixture', regions, width: 1200, height: 720, oceans: [] },
    getMapData() { return c.map; }, requestMapLabelFeature() { work.features++; },
    mapIdentity: m => m.id, resolveBasemap: () => null, generatedBasemapLayer: () => '',
    canonicalOwnerKey: r => r.owner || '', regionColor: r => r.color || '#abc', GRADE_BANDS: {},
    esc: s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    regionTrueArea: () => 100, _tmAreaFont: () => 15, labelAnchor: () => ({ x: 5, y: 7 }),
    factionLabelLayer: () => '<g>faction</g>', sentinelLayer: () => '<g>sentinel</g>',
    applyMapTransform() {}, updateMapChrome() { work.chrome++; }, renderLegend() {}, renderMapAlerts() {}, syncMapSearch() {}, bindRegionPathEvents() {},
    scheduleLabelLayout() { work.layouts++; }, setTimeout() {}, renderFormalMapSoon() {},
    __TM_LABEL_LEGACY: legacyLabels
  };
  c.attr = c.esc; c.window = c; vm.createContext(c);
  const names = ['pathForRegion', 'centerForRegion', 'actualCenter', 'regionTier', 'levelsForScale', 'visibleRegionsForScale', 'formalMapSignature', 'renderFormalMap'];
  vm.runInContext(names.map(n => functionSource(source, n)).join('\n'), c, { filename: 'phase8-formal-map.js:actual-functions' });
  const actualPath = c.pathForRegion;
  c.pathForRegion = r => { work.paths++; return actualPath(r); };
  return { c, stage, work, render() { c.renderFormalMap(); }, invalidate() { c.state._lastFormalMapSig = null; } };
}
function officialScenarios(root = ROOT) {
  return ['绍宋·建炎元年八月（官方）.json', '天启七年·九月（官方）.json'].map(name => {
    const file = path.join(root, 'scenarios', name);
    return { name, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  });
}
function declarations(source, variables = []) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest' });
  return ast.body.filter(n => n.type === 'FunctionDeclaration' || n.type === 'VariableDeclaration' && n.declarations.every(d => variables.includes(d.id.name)))
    .map(n => source.slice(n.start, n.end)).join('\n');
}
function saveBuilder(root = ROOT) {
  const source = read(root, 'web/tm-save-lifecycle.js'), drafts = { 'edict-pol': { value: '保留正在输入的诏令😀e\u0301' } };
  const work = { clones: 0, cloneMs: 0 };
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [1700000000000])); } static now() { return 1700000000000; } }
  const c = { console: { log() {}, warn() {}, error() {} }, Date: FixedDate, structuredClone, setTimeout() {}, clearTimeout() {},
    document: { getElementById: id => drafts[id] || null }, addEventListener() {}, TM: {}, P: {}, GM: {},
    localStorage: { getItem: () => null, setItem() {} } };
  c.window = c; vm.createContext(c);
  const load = (code, file) => vm.runInContext(code, c, { filename: file });
  load(declarations(read(root, 'web/tm-utils.js'), ['_rngState', '_rngSeed']), 'tm-utils.js:actual-functions');
  load(read(root, 'web/tm-huji-engine.js'), 'tm-huji-engine.js');
  load(declarations(source, ['SAVE_SCHEMA_VERSION', '_MIGRATIONS', 'PREF_CONF_KEYS']), 'tm-save-lifecycle.js:actual-functions-and-migrations');
  load(read(root, 'web/tm-chronicle-system.js'), 'tm-chronicle-system.js');
  for (const [file, name] of [['web/tm-event-system.js', 'StoryEventBus'], ['web/tm-help-social.js', 'OpinionSystem'], ['web/tm-feudal-warfare.js', 'WarWeightSystem']]) {
    const text = read(root, file), node = acorn.parse(text, { ecmaVersion: 'latest' }).body.find(n => n.type === 'VariableDeclaration' && n.declarations.some(d => d.id.name === name));
    if (!node) throw new Error('missing subsystem ' + name);
    load(text.slice(node.start, node.end), file + ':actual-provider');
  }
  const actualClone = c.deepClone;
  c.deepClone = value => { const t = performance.now(); try { return actualClone(value); } finally { work.clones++; work.cloneMs += performance.now() - t; } };
  // Independent legacy preparation path still uses the actual normalizers, serializers and filter.
  function legacyBuild(format, gm = c.GM, p = c.P) {
    let g = c._autoSaveSnapshotGM(gm, { detach: true }), project = c.deepClone(p);
    const prepared = c._prepareGMForSave(g, project);
    g = c._autoSaveSnapshotGM(prepared.GM, { reuseMutable: true, detach: true });
    project = c._tmStripAiKeyInPlace(prepared.P); delete project.gameState;
    if (format === 'project') { project.gameState = g; return project; }
    return { GM: g, P: project };
  }
  return { c, work, drafts, legacyBuild };
}
function controlledWorld(scenario, longHistory = false) {
  const p = structuredClone(scenario); p.conf = { consolidationEnabled: false }; p.ai = {};
  const gm = { running: true, busy: false, turn: longHistory ? 800 : 1, sid: scenario.id, _campaignId: 'perf_campaign', _timelineId: 'tml_perf',
    vars: {}, rels: {}, chars: structuredClone(scenario.characters || []), facs: structuredClone(scenario.factions || []), armies: [],
    officeTree: structuredClone(scenario.officeTree || []), mapData: structuredClone(scenario.mapData?.regions?.length ? scenario.mapData : scenario.map),
    _chronicleSysState: { version: 3, monthDrafts: {}, yearChronicles: { 1127: { text: '已生成纪事' } }, yearBases: {} },
    _warTruces: { version: 1, truces: { example: 900 } }, renli: { byRegion: {}, reported: {} },
    _npcDecisionDiagnostics: Array.from({ length: 150 }, (_, i) => ({ turn: i, label: '诊断' })) };
  const rows = () => Array.from({ length: longHistory ? 800 : 2 }, (_, i) => ({ turn: i, text: '受控虚构历史·不包含玩家记录。😀'.repeat(longHistory ? 12 : 1) }));
  for (const key of ['_convArchive', 'letters', '_edictTracker', '_edictSuggestions', '_npcActionLedger', '_chronicle', 'culturalWorks', '_edictLifecycle', '_courtRecords', '_memoryArchiveFull', 'battleHistory']) gm[key] = rows();
  for (const key of ['families', 'provinceStats', 'characterArcs', '_npcFactionAiTurnLedger', 'factionRelationsMap', '_npcCommitments', '_historyIndex', '_factionArcs']) gm[key] = { fixture: rows() };
  gm._memoryLayers = { L2: rows(), L3: rows() }; gm._causalGraph = { nodes: rows(), edges: [] };
  return { gm, p };
}
module.exports = { ROOT, read, functionSource, storage, mapRenderer, officialScenarios, saveBuilder, controlledWorld };

const assert = require('assert');

const SID = 'sc-tianqi7-1627';

// 2026-06-25 官方剧本重建后的两层加载契约（本测试守的就是这两层都健在）：
//   Block 1 · 轻量剧本壳 scenarios/tianqi7-1627.js
//     不再把人物平铺到顶层 P.characters，而是把【自包含的 scenario 对象】(内嵌
//     characters/factions/map·43 区) 整体推进 P.scenarios，供启动页快速选择。
//     该文件以 `typeof window!=='undefined'?window:this` 注册，node 下须 shim window 才落到 global.P。
//   Block 2 · 7MB 运行时快照 data/scenario-supplements/tianqi7-official-runtime-snapshot.js
//     把完整花名册【平铺】到顶层 P.characters/factions/...（每条 sid 标记）+ 43 区地图，
//     并注册 tm:p-restored 自愈监听（存档还原后重新平铺）。这才是 gameplay 真正读取的可玩数据
//     （_tmActiveScenarioRows(P.characters) 按 GM.sid 过滤）。
// 历史版本曾要求壳自身平铺(旧手作 106 人无地图版)，重建后该职责移交快照，故旧断言已不适用。

function emptyProject() {
  return {
    scenarios: [{ id: SID, _version: 'cached-shell', name: 'cached shell' }],
    characters: [],
    factions: [],
    parties: [],
    classes: [],
    variables: [],
    events: [],
    relations: [],
    items: [],
    rigidHistoryEvents: []
  };
}

function flatCount(key) {
  return (global.P[key] || []).filter(function(item) { return item && item.sid === SID; }).length;
}

function assertFlatCounts(label) {
  assert(flatCount('characters') >= 30, label + ': missing characters');
  assert(flatCount('factions') >= 5, label + ': missing factions');
  assert(flatCount('variables') >= 10, label + ': missing variables');
  assert(flatCount('events') >= 10, label + ': missing events');
}

global.document = { readyState: 'complete' };

// ── Block 1: 剧本壳注册（含「缓存壳已存在仍能恢复」契约：emptyProject 里先放一个同 id 缓存壳） ──
global.window = global;            // 壳用 window 探测；shim 成 global 才会注册到 global.P
global.P = emptyProject();
global.saveP = function() {};
require('../scenarios/tianqi7-1627.js');
delete global.window;
const shell = global.P.scenarios.find(function(s) { return s && s.id === SID && Array.isArray(s.characters); });
assert(shell, 'scenario-shell: 天启剧本壳未注册进 P.scenarios');
assert(shell.characters.length >= 30, 'scenario-shell: 壳内嵌 characters 不足 (got ' + shell.characters.length + ')');
assert((shell.factions || []).length >= 5, 'scenario-shell: 壳内嵌 factions 不足');
const shellRegions = (shell.map && shell.map.regions) || (shell.mapData && shell.mapData.regions);
assert(shellRegions && shellRegions.length >= 30, 'scenario-shell: 壳内嵌 map regions 不足 (got ' + (shellRegions ? shellRegions.length : 'none') + ')');

// ── Block 2: 运行时快照平铺（gameplay 真读的可玩数据 + 还原自愈） ──
const listeners = {};
global.addEventListener = function(name, fn) { listeners[name] = fn; };
global.P = emptyProject();
global.saveP = function() {};
require('../data/scenario-supplements/tianqi7-official-runtime-snapshot.js');
assertFlatCounts('runtime-snapshot-initial');
const sc = global.P.scenarios.find(function(s) { return s && s.id === SID; });
assert(sc && ((sc.map && sc.map.regions && sc.map.regions.length) || (sc.mapData && sc.mapData.regions && sc.mapData.regions.length)), 'snapshot missing map regions');

global.P = emptyProject();
assert(typeof listeners['tm:p-restored'] === 'function', 'snapshot restore listener was not registered');
listeners['tm:p-restored']();
assertFlatCounts('runtime-snapshot-after-restore');

console.log('[smoke] tianqi official cache recovery PASS (shell + runtime-snapshot)');

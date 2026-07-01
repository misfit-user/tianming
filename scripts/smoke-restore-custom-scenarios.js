#!/usr/bin/env node
'use strict';
/* smoke-restore-custom-scenarios — 安卓/网页重启后自建剧本消失的根治：
 * 真因：7MB 官方运行时快照走 requestIdleCallback 延迟注入，IndexedDB 恢复毫秒级先跑；玩家在快照加载前创建剧本
 * 触发 saveP 时官方花名册尚未平铺(<30)，重启被 _tmIsIncompleteOfficialProject 判为不完整 → 旧码整体 return 跳过
 * 恢复 → 用户自建剧本随之丢失(桌面端有 layer3 autoSave 兜底·安卓/网页没有 → 安卓特有)。
 * 修：守卫触发时改调 _tmMergeCustomScenariosFromProject —— 保留刚注册的官方剧本，仅把自建剧本(及按 sid 归属的行)合并回来。
 * 本测抽源里的两个纯函数跑真实数据·并守接线契约。 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '..', 'tm-utils.js'), 'utf8');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-restore-custom-scenarios');

// ── 大括号配平抽取函数体（避免 require 整个带浏览器依赖的 tm-utils.js） ──
function extractFn(name) {
  const decl = 'function ' + name + '(';
  const start = src.indexOf(decl);
  if (start < 0) return null;
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const SID = 'sc-tianqi7-1627';
// 在沙箱里装配 P + 两个函数
const sandbox = { P: null };
function freshP(rows) {
  return {
    scenarios: [{ id: SID, name: '天启七年', _version: 'shell' }],   // register 脚本刚注册的官方剧本壳
    characters: [], factions: [], parties: [], classes: [],
    variables: [], events: [], relations: [], items: [], rigidHistoryEvents: []
  };
}

const mergeSrc = extractFn('_tmMergeCustomScenariosFromProject');
const countSrc = extractFn('_tmCountSidRowsInProject');
const incSrc = extractFn('_tmIsIncompleteOfficialProject');
ok(!!mergeSrc, '源含 _tmMergeCustomScenariosFromProject');
ok(!!countSrc && !!incSrc, '源含 _tmCountSidRowsInProject / _tmIsIncompleteOfficialProject');

// eval 装配（共享外层 P 变量）
let P;
const assemble = new Function('return (function(){ ' +
  'var P;' +
  countSrc + ';' + incSrc + ';' + mergeSrc + ';' +
  'return { set:function(v){P=v;}, get:function(){return P;}, ' +
  'merge:_tmMergeCustomScenariosFromProject, incomplete:_tmIsIncompleteOfficialProject, count:_tmCountSidRowsInProject };' +
  '})();');
const M = assemble();

// 缓存项目：官方天启不完整(0 characters) + 用户自建空白剧本 + 一个带内容的自建剧本
const CUSTOM_EMPTY = 'u-empty-1';
const CUSTOM_FULL = 'u-full-2';
function cachedProject() {
  return {
    scenarios: [
      { id: SID, name: '天启七年', _version: 'stale-shell' },          // 官方·陈旧
      { id: CUSTOM_EMPTY, name: '我的空白卷', era: '', role: '' },       // 自建·空白(用户实际报的情形)
      { id: CUSTOM_FULL, name: '我的架空卷', era: '天元', role: '主角' }  // 自建·有内容
    ],
    characters: [
      { id: 'c1', sid: CUSTOM_FULL, name: '虚构人物甲' },
      { id: 'c2', sid: SID, name: '官方人物·缓存残留' }                  // 官方行·不该被合并(应由快照平铺)
    ],
    factions: [{ id: 'f1', sid: CUSTOM_FULL, name: '虚构势力' }],
    variables: [], events: [], parties: [], classes: [], relations: [], items: [], rigidHistoryEvents: []
  };
}

// ① 缓存被正确判为「官方不完整」
ok(M.incomplete(cachedProject()) === true, '① 缓存官方天启<30 人 → 判为不完整(触发守卫)');

// ② 合并后：自建剧本(空白+有内容)都回到 P.scenarios，官方剧本仍在且不重复
P = freshP(); M.set(P);
const added = M.merge(cachedProject());
P = M.get();
const ids = P.scenarios.map(function (s) { return s.id; });
ok(added === 2, '② 合并 2 个自建剧本(返回数)');
ok(ids.indexOf(CUSTOM_EMPTY) >= 0, '② 空白自建剧本已恢复(用户报的情形)');
ok(ids.indexOf(CUSTOM_FULL) >= 0, '② 有内容自建剧本已恢复');
ok(ids.filter(function (x) { return x === SID; }).length === 1, '② 官方剧本仍在且未重复');

// ③ 官方剧本壳不被陈旧缓存覆盖(保留 register 注册的新壳)
const offShell = P.scenarios.find(function (s) { return s.id === SID; });
ok(offShell._version === 'shell', '③ 官方剧本壳保留刚注册版本(不被 stale-shell 覆盖)');

// ④ 自建剧本的内容行按 sid 合并；官方行不被缓存残留污染
ok(P.characters.some(function (c) { return c.sid === CUSTOM_FULL && c.name === '虚构人物甲'; }), '④ 自建剧本人物按 sid 合并');
ok(!P.characters.some(function (c) { return c.sid === SID; }), '④ 官方行不从缓存合并(留给快照平铺·不污染)');
ok(P.factions.some(function (f) { return f.sid === CUSTOM_FULL; }), '④ 自建剧本势力按 sid 合并');

// ⑤ 幂等：自建剧本已在 P 中 → 二次合并不重复添加(跨 layer1/layer2 双跑安全)
const before = P.scenarios.length, beforeChars = P.characters.length;
M.set(P); M.merge(cachedProject()); P = M.get();
ok(P.scenarios.length === before, '⑤ 幂等：自建剧本不重复添加(scenarios)');
ok(P.characters.length === beforeChars, '⑤ 幂等：自建剧本行不重复添加(characters)');

// ⑥ 无自建剧本时返回 0、不动 P
P = freshP(); M.set(P);
const n0 = M.merge({ scenarios: [{ id: SID, name: '天启七年' }], characters: [], factions: [] });
ok(n0 === 0, '⑥ 缓存只含官方剧本 → 合并 0 个');

// ⑦ 防御：project 无 scenarios / 非数组不崩
ok(M.merge(null) === 0 && M.merge({}) === 0 && M.merge({ scenarios: 'x' }) === 0, '⑦ 异常入参返回 0 不崩');

// ── 接线契约：两处 incomplete 分支改为合并自建剧本(不再裸 return 丢弃) ──
ok(/incomplete official cache from IndexedDB[\s\S]*?_tmMergeCustomScenariosFromProject\(fullP\)/.test(src) ||
   /_mergedN = _tmMergeCustomScenariosFromProject\(fullP\)/.test(src), '⑧ layer2(IndexedDB) 守卫改调合并自建剧本');
ok(/_mergedLite = _tmMergeCustomScenariosFromProject\(saved\)/.test(src), '⑨ layer1(tm_P) 守卫改调合并自建剧本');
ok(/indexeddb-incomplete-merge-custom/.test(src), '⑩ 恢复事件标记改为 merge-custom(不再 incomplete-skip)');
// 旧整体跳过措辞应已不在
ok(!/skipped incomplete official scenario project from IndexedDB/.test(src), '⑪ 旧「整体跳过」措辞已移除');

console.log('\nsmoke-restore-custom-scenarios ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);

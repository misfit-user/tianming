'use strict';
// 官方剧本真源（scenarios/*（官方）.json）里地图只存一份：map。
//
// 游戏运行时要 map 与 mapData 两份互不相干的拷贝。原先真源把同一份地图逐字写了两遍，
// 绍宋一部就多出四十二兆，单文件逼近 GitHub 的一百兆硬限，每改一次剧本仓库多记一倍。
// 现在真源不写 mapData，凡是要「运行时形态」的读取方都从这里补回。
//
// 主进程（load-scenario）与构建脚本（web/scripts/official-scenario-source.js）共用这一份，
// 所以放在仓根、列进 package.json 的 build.files 随安装包走。只依赖语言本身，不碰文件系统。

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// 真源省掉了 mapData：有 map、没有 mapData 这个键。
// 已经写了 mapData 的（哪怕是空对象）一律当作者有意为之，不算省略。
function omitsMapData(scenario) {
  return isObject(scenario) && isObject(scenario.map) && scenario.mapData === undefined;
}

// 补回 mapData：紧跟在 map 后面放一份独立拷贝，其余键的次序与内容原样。
// 不需要补时返回传入的同一个对象。
function withMapData(scenario) {
  if (!omitsMapData(scenario)) return scenario;
  const out = {};
  Object.keys(scenario).forEach((key) => {
    if (key === 'mapData') return;
    out[key] = scenario[key];
    if (key === 'map') out.mapData = cloneJson(scenario.map);
  });
  return out;
}

// 真源里 mapData 与 map 逐字相同，就是该省而没省的那一份。
function hasRedundantMapData(scenario) {
  return isObject(scenario) && isObject(scenario.map) && isObject(scenario.mapData)
    && JSON.stringify(scenario.map) === JSON.stringify(scenario.mapData);
}

// 写回真源前去掉多余的那一份。两份不同（或本来就没有）时返回传入的同一个对象。
function withoutRedundantMapData(scenario) {
  if (!hasRedundantMapData(scenario)) return scenario;
  const out = {};
  Object.keys(scenario).forEach((key) => {
    if (key !== 'mapData') out[key] = scenario[key];
  });
  return out;
}

module.exports = { omitsMapData, withMapData, hasRedundantMapData, withoutRedundantMapData };

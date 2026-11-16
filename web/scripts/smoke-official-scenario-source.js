#!/usr/bin/env node
// 官方剧本真源只存 map 一份：存盘形态与运行时形态之间的来回，以及主进程拿得到补回逻辑。
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const shape = require(path.join(ROOT, 'main-official-scenario.js'));
const source = require('./official-scenario-source.js');

let checks = 0;
function ok(condition, label) {
  assert.ok(condition, label);
  checks++;
}

// 存盘形态 → 运行时形态：mapData 紧跟 map，是独立拷贝，其余键原样同序
const stored = { id: 'sc-x', name: '甲', map: { regions: [{ id: 'a', owner: '明' }] }, cities: [1], tail: true };
const runtime = shape.withMapData(stored);
ok(JSON.stringify(Object.keys(runtime)) === JSON.stringify(['id', 'name', 'map', 'mapData', 'cities', 'tail']), '补回的 mapData 紧跟在 map 后面');
ok(JSON.stringify(runtime.mapData) === JSON.stringify(stored.map), '补回的 mapData 与 map 内容相同');
ok(runtime.mapData !== runtime.map && runtime.mapData.regions[0] !== runtime.map.regions[0], '补回的 mapData 是独立拷贝，改一份不动另一份');
ok(runtime.map === stored.map && runtime.cities === stored.cities, '其余键的值原样带过去');
ok(!('mapData' in stored), '不改传入的对象');

// 不该补的情形：已写了 mapData（哪怕为空）、没有 map、不是剧本对象
const own = { map: { regions: [1] }, mapData: { regions: [] } };
ok(shape.withMapData(own) === own, '作者自己写了 mapData 的不动');
const nomap = { id: 'sc-y' };
ok(shape.withMapData(nomap) === nomap, '没有 map 的不补');
ok(shape.withMapData(null) === null && shape.withMapData('x') === 'x', '不是对象的原样返回');

// 运行时形态 → 存盘形态：只去掉与 map 逐字相同的那一份
ok(shape.hasRedundantMapData(runtime) && !shape.hasRedundantMapData(stored) && !shape.hasRedundantMapData(own), '只有逐字相同的 mapData 才算多余');
const back = shape.withoutRedundantMapData(runtime);
ok(JSON.stringify(back) === JSON.stringify(stored), '去掉多余的一份后回到存盘形态，键序不变');
ok(shape.withoutRedundantMapData(own) === own, '两份不同的地图都留着');
ok(source.sourceText(runtime) === JSON.stringify(stored) + '\n', '写回真源的文本是存盘形态');
ok(source.runtimeText(stored) === JSON.stringify(runtime) + '\n', '内置副本的文本是运行时形态');

// 三部真源现在都是存盘形态，补回后 map、mapData 俱全
const files = source.listOfficialFiles();
ok(files.length >= 3, '找得到三部官方剧本真源');
files.forEach((file) => {
  const name = path.basename(file);
  const read = source.readOfficialScenario(file);
  ok(!('mapData' in read.stored), name + ' 真源不写 mapData');
  ok(read.data.mapData && read.data.mapData !== read.data.map
    && read.data.mapData.regions.length === read.data.map.regions.length && read.data.map.regions.length > 0,
    name + ' 读出来的运行时形态两份地图俱全');
  const keys = Object.keys(read.data);
  ok(keys.indexOf('mapData') === keys.indexOf('map') + 1, name + ' 运行时形态里 mapData 紧跟 map');
});

// 主进程用同一份补回逻辑，而且这个模块随安装包走（漏了的话装好的游戏一启动就找不到模块）
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
ok(pkg.build.files.includes('main-official-scenario.js'), '补回模块列进了安装包文件清单');

console.log('[smoke-official-scenario-source] PASS ' + checks + ' checks');

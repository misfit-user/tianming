#!/usr/bin/env node
// 官方剧本真源的读写口。
//
// 真源 scenarios/*（官方）.json 里地图只存 map 一份，不写 mapData（缘由见仓根 main-official-scenario.js）。
// 脚本直接 JSON.parse 真源拿到的是「存盘形态」：没有 mapData。要游戏运行时那种 map、mapData 俱全的
// 完整剧本，用这里的 readOfficialScenario；改完剧本要写回真源，用 writeOfficialScenario。
//
// 用法：
//   node web/scripts/official-scenario-source.js           # 只查：哪部真源还带着与 map 相同的 mapData
//   node web/scripts/official-scenario-source.js --strip   # 把多余的那一份从真源里去掉
'use strict';

const fs = require('fs');
const path = require('path');
const shape = require('../../main-official-scenario.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_DIR = path.join(REPO_ROOT, 'scenarios');
const OFFICIAL_FILE_RE = /（官方）\.json$/;

function listOfficialFiles() {
  return fs.readdirSync(SOURCE_DIR)
    .filter((name) => OFFICIAL_FILE_RE.test(name))
    .sort()
    .map((name) => path.join(SOURCE_DIR, name));
}

// 读一部真源。
//   raw    文件原文——算哈希、记字节数都认它
//   stored 存盘形态（没有 mapData）
//   data   运行时形态（补回了 mapData）
function readOfficialScenario(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const stored = JSON.parse(raw);
  return { raw, stored, data: shape.withMapData(stored) };
}

// 运行时形态的文本：内置 JSON 副本、热更包里装的都是它。
function runtimeText(data) {
  return JSON.stringify(shape.withMapData(data)) + '\n';
}

// 存盘形态的文本：真源一行紧凑 JSON 加换行。
function sourceText(data) {
  return JSON.stringify(shape.withoutRedundantMapData(data)) + '\n';
}

function writeOfficialScenario(file, data) {
  fs.writeFileSync(file, sourceText(data), 'utf8');
}

function redundantMessage(file) {
  return path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    + ' 带着一份与 map 逐字相同的 mapData。真源只存 map；'
    + '运行 node web/scripts/official-scenario-source.js --strip 去掉多余的那一份。';
}

function main(argv) {
  const strip = (argv || process.argv.slice(2)).includes('--strip');
  let redundant = 0;
  listOfficialFiles().forEach((file) => {
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!shape.hasRedundantMapData(stored)) return;
    redundant++;
    if (!strip) {
      console.error('[official-source] ' + redundantMessage(file));
      return;
    }
    const before = fs.statSync(file).size;
    writeOfficialScenario(file, stored);
    console.log('[official-source] ' + path.basename(file) + ' '
      + (before / 1048576).toFixed(1) + 'MB → ' + (fs.statSync(file).size / 1048576).toFixed(1) + 'MB');
  });
  if (redundant && !strip) process.exit(1);
  console.log('[official-source] ' + (strip ? '已去掉 ' + redundant + ' 份多余的 mapData' : '真源里没有多余的 mapData'));
}

if (require.main === module) main();

module.exports = {
  REPO_ROOT,
  SOURCE_DIR,
  listOfficialFiles,
  readOfficialScenario,
  writeOfficialScenario,
  runtimeText,
  sourceText,
  redundantMessage,
  hasRedundantMapData: shape.hasRedundantMapData,
  withMapData: shape.withMapData
};

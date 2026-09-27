#!/usr/bin/env node
// 天启剧本·势力引用对齐补丁（阶段一）
//
// 1. 行政树键名改成势力 id：原来 22 棵外藩树的键名是 laterJin、tokugawaJapan 这类别名，
//    开局经济（initProvinceEconomy）与财政引擎按键名找势力，找不到就整棵跳过，外藩地块改用随机人口。
//    改名后树上的 factionId 也写成同一个势力 id；factionName 不变。
// 2. 朵甘树（键名 dokham）声明属明朝廷，地图上也归明朝廷，与已在玩家树里的乌思藏同属羁縻：
//    把它的省级节点并入玩家树，删掉这棵独立的树。
// 3. 人物的 factionId 还是旧一代 id（fac_mp3yvbc…）的，按人物所属势力名改成现存势力 id。
// 地图地块上的 ownerKey（fac-ming、fac-chahar 这类稳定键）是另一套键，不动。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tianqi-faction-refs.js [--write]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '天启七年·九月（官方）.json');

function main() {
  const write = process.argv.includes('--write');
  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  const factionByName = new Map(scenario.factions.map((f) => [f.name, f]));
  const factionById = new Map(scenario.factions.map((f) => [f.id, f]));
  const log = [];

  // ---- 行政树 ----
  const oldTrees = scenario.adminHierarchy;
  const newTrees = {};
  const player = oldTrees.player;
  const playerFaction = factionByName.get(player.factionName);
  if (!playerFaction) throw new Error('玩家树声明的势力不存在：' + player.factionName);
  if (player.factionId !== playerFaction.id) {
    log.push('玩家树 factionId ' + player.factionId + ' → ' + playerFaction.id);
    player.factionId = playerFaction.id;
  }
  newTrees.player = player;

  Object.entries(oldTrees).forEach(([key, tree]) => {
    if (key === 'player') return;
    const faction = factionByName.get(tree.factionName) || factionById.get(key);
    if (!faction) throw new Error('行政树 ' + key + ' 声明的势力不存在：' + tree.factionName);
    if (faction === playerFaction) {
      // 声明属玩家势力的独立树：省级节点并入玩家树
      (tree.divisions || []).forEach((d) => {
        if (d.factionId && d.factionId !== playerFaction.id) d.factionId = playerFaction.id;
        player.divisions.push(d);
        log.push('树 ' + key + ' 的「' + d.name + '」并入玩家树');
      });
      return;
    }
    if (newTrees[faction.id]) throw new Error('两棵树指向同一势力：' + faction.name);
    if (key !== faction.id) log.push('树键 ' + key + ' → ' + faction.id + '（' + faction.name + '）');
    if (tree.factionId !== faction.id) log.push('树 ' + faction.name + ' factionId ' + tree.factionId + ' → ' + faction.id);
    tree.factionId = faction.id;
    newTrees[faction.id] = tree;
  });
  scenario.adminHierarchy = newTrees;

  // ---- 人物 factionId ----
  let fixedChars = 0;
  const unresolved = [];
  scenario.characters.forEach((c) => {
    if (!c.factionId || factionById.has(c.factionId)) return;
    const faction = factionByName.get(c.faction);
    if (!faction) { unresolved.push(c.name + '（' + c.faction + '）'); return; }
    c.factionId = faction.id;
    fixedChars++;
  });
  log.push('人物 factionId 改为现存势力 id：' + fixedChars + ' 人' + (unresolved.length ? '；无法对上的：' + unresolved.join('、') : ''));

  console.log(log.join('\n'));
  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('\n已写入 ' + path.relative(REPO, SCENARIO_FILE));
  } else {
    console.log('\n（试算，未写入；加 --write 写入）');
  }
}

main();

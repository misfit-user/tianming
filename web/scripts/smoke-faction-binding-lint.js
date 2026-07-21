#!/usr/bin/env node
// scripts/smoke-faction-binding-lint.js — Slice J·写侧强制 lint
// 2026-05-10
//
// 检测·新代码不允许直接 c.faction = / a.faction = / a.owner = 赋值
// 必须走 TM.FactionMembership.{assignChar, assignArmy, assignProvince} API。
// 白名单 (历史 fallback / API 自身 / editor scriptData)·见下方 ALLOW 列表。

'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function fail(msg) { throw new Error(msg); }

// 白名单·绝对路径相对 web/
const ALLOW_FILES = new Set([
  // API 本体·内部当然要直接赋值
  'tm-faction-membership.js',
  // 编辑器层·写 scriptData (P)·不是运行时 GM
  'editor-ai-gen.js',
  'editor-ai-multipass.js',
  'editor-ai-validate.js',
  'editor-crud.js',
  'editor-details.js',
  'editor-fullgen.js',
  // 模板/示例文件
  'tm-test.js',
  'tm-test-harness.js',
  // FullGen 在 tm-launch.js·init 时修复 stale ref·非运行时 mutate
  // (line 1063·已经 grandfathered)
  'tm-launch.js',
  // 地图编辑器·d.factionId 是 polygon 的字段·非 char/army.factionId·语义不同
  'map-editor-factions.js',
  // powerMinister.faction 是 string[] 数组·跟 char.faction string ref 完全不同·语义不同
  'tm-authority-complete.js',
  'tm-prophecy.js',
  // 地图编辑器·division(地图区划多边形)的 factionId 是地图归属元数据·子继承父·非 char/army 势力绑定·语义不同
  'map-editor-core.js'
]);

// 白名单·特定行·legacy fallback 在 if (window.TM && TM.FactionMembership) else 分支
const ALLOW_LINES = [
  // tm-endturn-apply.js·dissolve 路径的 legacy fallback (else 分支)
  { file: 'tm-endturn-apply.js', match: /_affected\.forEach.*c\.faction\s*=\s*_newFac/ },
  { file: 'tm-endturn-apply.js', match: /c\.alive\s*!==\s*false\s*&&\s*c\.faction\s*===\s*fc\.name\)\s*c\.faction\s*=\s*''/ },
  { file: 'tm-endturn-apply.js', match: /c\.faction\s*===\s*r\.class\s*\+\s*'起义军'/ },
  // tm-military.js:870·城市三字段·留作 backlog (city 不在 Slice E)
  { file: 'tm-military.js', match: /c\.faction\s*=\s*winner/ },
  // tm-military.js·siege city 三字段兼容写入；province owner 仍走 setProvinceOwner/assignProvince
  { file: 'tm-military.js', match: /c\.faction\s*=\s*owner/ },
  // tm-three-systems-ext.js·extendArmyFields 里的 init fallback (a.ownerFaction / a.owner 兜底)
  // 仅在缺字段时填充·非真 mutation·走 API 反而会触发 event·噪音
  { file: 'tm-three-systems-ext.js', match: /if \(!a\.faction && a\.ownerFaction\)/ },
  { file: 'tm-three-systems-ext.js', match: /if \(!a\.faction && a\.owner\)/ },
  // tm-military-ui.js / tm-wendui.js 的 fallback else 分支 (Slice J 改后的 fallback)
  { file: 'tm-military-ui.js', match: /else\s*\{\s*$/ },
  { file: 'tm-military-ui.js', match: /a\.faction\s*=\s*_newFac/ },
  { file: 'tm-wendui.js', match: /ch\.faction\s*=\s*_envFac/ },
  // tm-endturn-apply.js·新加的 fallback else 分支 (Slice J·5/10)
  { file: 'tm-endturn-apply.js', match: /_och\.faction\s*=\s*r\.class/ },
  { file: 'tm-endturn-apply.js', match: /_ch\.faction\s*=\s*_newFac/ },
  { file: 'tm-endturn-apply.js', match: /_fLdr\.faction\s*=\s*fc\.name/ },
  // tm-shiji-qiju-ui.js·types 是局部对象 {faction, military, ...}·types.faction 是分类计数·非 char.faction 写
  { file: 'tm-shiji-qiju-ui.js', match: /types\.faction\s*=/ },
  // tm-faction-npc-intervention.js·espionage 翻面 fallback (Membership API 不可用时)·已 try API·此为兜底
  { file: 'tm-faction-npc-intervention.js', match: /c\.faction\s*=\s*pn;/ },
  // tm-revolt-entity.js·_setCharFaction 已 try FactionMembership.assignChar·此为 API 缺席兜底(smoke 裸跑/装载序)
  { file: 'tm-revolt-entity.js', match: /ch\.faction\s*=\s*facName\s*\|\|\s*''/ },
  // tm-ai-change-applier.js / tm-ai-change-army.js (Slice 2 拆出) / tm-region-enrich.js:
  //   assignArmy first·direct write only in legacy fallback/catch.
  // tm-ai-change-applier.js·applyAllegianceChange 主路已走 assignChar；以下仅 membership 模块缺位时双锚 fallback.
  { file: 'tm-ai-change-applier.js', match: /ch\.faction\s*=\s*newName/ },
  { file: 'tm-ai-change-applier.js', match: /if \(newId\) ch\.factionId\s*=\s*newId/ },
  { file: 'tm-ai-change-applier.js', match: /army\.faction\s*=\s*factionName/ },
  { file: 'tm-ai-change-army.js',    match: /army\.faction\s*=\s*factionName/ },
  { file: 'tm-region-enrich.js',     match: /army\.faction\s*=\s*factionName/ },
  // tm-map-system.js: region.factionId mirrors map-region owner, not character/army/province membership.
  { file: 'tm-map-system.js', match: /region\.factionId\s*=\s*region\.owner/ },
  // map-editor-to-game.js: division.factionId is scenario map ownership metadata inherited from autonomyHierarchy,
  // not character/army/province membership mutation.
  { file: 'map-editor-to-game.js', match: /nd\.factionId\s*=\s*facId/ },
  // tm-endturn-agent-mode.js·d 是维度标志对象(_activeDims)·d.faction=1 是「势力维度有活动」的开关位·非势力归属绑定
  { file: 'tm-endturn-agent-mode.js', match: /d\.faction\s*=\s*1/ },
  // tm-endturn-agent-write-tools.js·change 是工具 schema 透传对象·change.faction 传给 applyAIArmyChange·
  //   下游 tm-ai-change-army.js 已走 TM.FactionMembership.assignArmy(已在本白名单)·此为 schema 透传非直接 mutate
  { file: 'tm-endturn-agent-write-tools.js', match: /change\.faction\s*=\s*input\.faction/ },
  // tm-patches-start.js·_bindCharFactions 名↔id 一致性同步；patches 加载早于 tm-faction-membership.js，且此处非归属变更.
  //   （2026-07-04 立项拆分：剧本启动链自 tm-patches.js 保序切出·五条豁免随代码迁档）
  { file: 'tm-patches-start.js', match: /c\.faction\s*=\s*byId\[c\.factionId\]\.name/ },
  { file: 'tm-patches-start.js', match: /c\.factionId\s*=\s*byName\[c\.faction\]\.id/ },
  { file: 'tm-patches-start.js', match: /ch\.factionId\s*=\s*f\.id/ },
  { file: 'tm-patches-start.js', match: /ch\.faction\s*=\s*f2\.name/ },
  { file: 'tm-patches-start.js', match: /ch\.faction\s*=\s*byId\[ch\.factionId\]\.name/ },
];

function scanFile(filePath, source, results) {
  const fileName = path.basename(filePath);
  if (ALLOW_FILES.has(fileName)) return;
  const lines = source.split('\n');
  // 单变量名 + .faction 直接赋值
  // 排除：a.faction === / a.faction != / a.faction || / a.faction && (那是读·不是写)
  // 排除：if/return/var 行 (避免 var x = obj.faction 误报)
  // 2026-05-10·Slice J 修·扩 regex 吃 `_` 开头变量 (如 _ch / _och / _newFac)
  const RE = /(^|[^A-Za-z0-9_])(_?[a-z][A-Za-z0-9_]{0,5}|char|chr|cur|target|ne|nc|np|sp|ldr|fc|ch|members|fac)\.faction\s*=\s*[^=]/;
  // 同样检 .factionId 写
  const RE_ID = /(^|[^A-Za-z0-9_])(_?[a-z][A-Za-z0-9_]{0,5}|char|chr|cur|target)\.factionId\s*=\s*[^=]/;
  // a.owner = 写
  const RE_OWNER = /(^|[^A-Za-z0-9_])(_?a|_?army|_?arm)\.owner\s*=\s*[^=]/;

  lines.forEach(function(lineText, idx){
    var lineNo = idx + 1;
    // 跳过整行注释 (// 在行首或仅前导空白)
    if (/^\s*\/\//.test(lineText)) return;
    // 跳过 *-line 注释里 (/* 形式偶尔单行)
    if (/^\s*\*/.test(lineText)) return;
    [
      [RE, 'faction='],
      [RE_ID, 'factionId='],
      [RE_OWNER, 'owner=']
    ].forEach(function(pair){
      if (pair[0].test(lineText)) {
        // 检 ALLOW_LINES
        var allowed = ALLOW_LINES.some(function(al){
          return al.file === fileName && al.match.test(lineText);
        });
        if (allowed) return;
        results.push({
          file: fileName, line: lineNo, kind: pair[1], snippet: lineText.trim().slice(0, 200)
        });
      }
    });
  });
}

function main() {
  const dir = ROOT;
  // 只扫 tm-*.js + map-*.js (运行时·不扫 editor / scripts / scenarios)
  const files = fs.readdirSync(dir).filter(function(f){
    return /\.js$/.test(f) && !/^editor-/.test(f);
  });
  const results = [];
  files.forEach(function(f){
    var fp = path.join(dir, f);
    if (!fs.statSync(fp).isFile()) return;
    var src = fs.readFileSync(fp, 'utf8');
    scanFile(fp, src, results);
  });

  if (results.length > 0) {
    console.error('[smoke-faction-binding-lint] FAIL·' + results.length + ' 处直接赋值未走 Membership API:');
    results.slice(0, 30).forEach(function(r){
      console.error('  ✗ ' + r.file + ':' + r.line + ' [' + r.kind + ']  ' + r.snippet);
    });
    if (results.length > 30) console.error('  ... +' + (results.length - 30) + ' more');
    console.error('');
    console.error('修复方案: 用 TM.FactionMembership.{assignChar, assignArmy, assignProvince}');
    console.error('或加入白名单 ALLOW_FILES / ALLOW_LINES (需注释说明原因)');
    process.exit(1);
  }
  console.log('[smoke-faction-binding-lint] pass·扫 ' + files.length + ' 文件·0 violations');
}

try { main(); }
catch (e) {
  console.error('[smoke-faction-binding-lint] error: ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  process.exit(1);
}

#!/usr/bin/env node
'use strict';
/* smoke-sovereign-address-sensing — 君上称谓感知失效修复(绍宋称"陛下"应"官家")
 * 双因:①常朝 tm-chaoyi-changchao.js 从不注入感知行 ②硬编码"陛下"强制(requireWords/系统提示/UI)。
 * 修:①感知行 _sovereignLanguagePromptLine 带 era 包具体称谓(eraLangField·宋→官家) ②常朝注入感知行+去强制
 *    ③era 包加 sovereignAddress 单词(song官家/ming陛下)+_sovereignAddressTerm 供 UI。数据层出专名·引擎中立查表。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-sovereign-address-sensing');

// ── ① era 包:数据层称谓(功能测·module.exports) ──
const pack = require(path.resolve(ROOT, 'tm-era-language-pack.js'));
ok(pack.ERA_PACKS.song.sovereignAddress === '官家', '① era包 song.sovereignAddress=官家');
ok(pack.ERA_PACKS.ming.sovereignAddress === '陛下', '① era包 ming.sovereignAddress=陛下');
ok(/官家/.test(pack.ERA_PACKS.song.imperialAddress) && /首选/.test(pack.ERA_PACKS.song.imperialAddress), '① song.imperialAddress 以官家为首选');
ok(pack.eraLangField('南宋·建炎初', 'sovereignAddress', '') === '官家', '① eraLangField(南宋·建炎初,sovereignAddress)=官家(绍宋 era 命中宋包)');
ok(pack.eraLangField('明·天启', 'sovereignAddress', '') === '陛下', '① eraLangField(明·天启)=陛下(明剧本不回归)');
ok(pack.eraLangField('宋', 'imperialAddress', '自定义称谓') === '自定义称谓', '① 剧本值优先于朝代包(scenarioValue 覆盖)');

// ── ② tm-data-model.js:感知行带 era 包称谓 + 单词助手 ──
const dm = fs.readFileSync(path.resolve(ROOT, 'tm-data-model.js'), 'utf8');
ok(/eraLangField\(_era, 'imperialAddress', _sv\)/.test(dm), '② 感知行 _sovereignLanguagePromptLine 接 eraLangField(imperialAddress)');
ok(/本朝君臣称谓（据此/.test(dm), '② 感知行输出"本朝君臣称谓"具体段');
ok(/function _sovereignAddressTerm\(G\)/.test(dm), '② 单词助手 _sovereignAddressTerm 定义');
ok(/window\._sovereignAddressTerm = _sovereignAddressTerm/.test(dm), '② _sovereignAddressTerm 暴露 window');
ok(/eraLangField\(era, 'sovereignAddress', ''\)/.test(dm), '② _sovereignAddressTerm 走 era 包 sovereignAddress');

// ── ③ tm-chaoyi-changchao.js:常朝注入感知行 + 去强制陛下 ──
const cc = fs.readFileSync(path.resolve(ROOT, 'tm-chaoyi-changchao.js'), 'utf8');
ok(/_sovereignLanguagePromptLine\(typeof GM !== 'undefined' \? GM : null\)/.test(cc), '③ 常朝系统提示注入感知行(补齐缺失)');
ok(!/requireWords: \['臣', '陛下'\]/.test(cc), '③ lead 模式 requireWords 不再强制"陛下"');
ok(/requireWords: \['臣'\]/.test(cc), '③ lead requireWords 仅留"臣"');
ok(!/皇帝（自称"朕"·臣下称"陛下"或"皇上"）/.test(cc), '③ 系统提示删除硬编码"臣下称陛下或皇上"');
ok(/君主（自称与臣下对其称谓一律依/.test(cc), '③ 玩家行改为依【称谓感知】(去硬编码)');
ok(/_sovereignAddressTerm\(typeof GM !== 'undefined' \? GM : null\)/.test(cc), '③ UI(speaker标签/系统气泡)改用 _sovereignAddressTerm');
ok(!/cy-bubble-meta">陛下</.test(cc), '③ 玩家气泡 meta 不再硬编码"陛下"');

console.log('\nsmoke-sovereign-address-sensing ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);

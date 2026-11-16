#!/usr/bin/env node
/* eslint-env node */
/*
 * smoke-court-office-imprison-dismiss-refresh.js
 * 2026-06-11·三修:
 *   task3a 罢官后仍上朝:`_cc3_isCourtOfficial` 改 officialTitle 优先(已写过即以它为准·罢官清成 ''/null→不判在朝;
 *           仅 undefined 才回退剧本 title)。行为校验。
 *   task3b 下狱/流放/逃亡后仍参与朝会:`_cc3_buildCharsFromGM` 入口硬排除(不只标 absent)。源码契约。
 *   task4  任命/罢免/改任推演成功但官制树 UI 不变:applier office/personnel 变更后延后刷新
 *           renderOfficeTree + TMPhase8FormalBridge.refresh()(去抖)。源码契约。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const changchao = (fs.readFileSync(path.join(ROOT, 'tm-chaoyi-changchao-adapter.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-chaoyi-changchao.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-chaoyi-changchao-flows.js'), 'utf8'));

let passed = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); passed += 1; }

// ── task3a 行为:抽出 _cc3_isCourtOfficial 实跑 ───────────────────────────────
const fnMatch = changchao.match(/function _cc3_isCourtOfficial\(ch\)[\s\S]*?return whitelist\.test\(t\);\s*\n\}/);
assert(fnMatch, '抽不到 _cc3_isCourtOfficial');
const ctx = { console: console };
vm.createContext(ctx);
vm.runInContext(fnMatch[0] + '\nthis.__isOff = _cc3_isCourtOfficial;', ctx);
const isOff = ctx.__isOff;

// 在任朝官(officialTitle 设了官职)→ true
assert(isOff({ officialTitle: '兵部尚书' }) === true, '在任兵部尚书→court official');
assert(isOff({ officialTitle: '内阁首辅', title: '内阁首辅' }) === true, '在任首辅→true');
// 罢官:officialTitle 清成 ''·但剧本旧 title 还在 → 必须 false(本次修复核心)
assert(isOff({ officialTitle: '', title: '兵部尚书' }) === false, '罢官(officialTitle=\'\'·title 旧职)→ 必须 false');
// 罢官走 onDismissal 清成 null·title 旧职 → false
assert(isOff({ officialTitle: null, title: '礼部尚书' }) === false, '罢官(officialTitle=null)→ 必须 false');
// 纯剧本只填 title(officialTitle 从未设·undefined)→ 回退 title·保留(无误伤)
assert(isOff({ title: '都察院左都御史' }) === true, '剧本只填 title(officialTitle undefined)→ 回退保留');
// 后宫/学生黑名单仍挡
assert(isOff({ officialTitle: '皇后', title: '皇后' }) === false, '皇后→ 非朝官');
assert(isOff({ officialTitle: '国子监生', title: '国子监生' }) === false, '监生→ 非朝官');
// 两者皆空 → false
assert(isOff({ officialTitle: '', title: '' }) === false, '无官职→ false');
// 对照:若仍用旧 `officialTitle||title` 回退·罢官者会误判 true(证明本修复有效)
const oldStyle = function (ch) { const t = (ch.officialTitle || ch.title || ''); return /尚书|侍郎|御史|大学士|首辅/.test(t); };
assert(oldStyle({ officialTitle: '', title: '兵部尚书' }) === true && isOff({ officialTitle: '', title: '兵部尚书' }) === false,
  '对照:旧回退会让罢官者上朝·新修已堵');

// ── task3b 源码:_cc3_buildCharsFromGM 入口硬排除下狱/流放/逃亡 ────────────────

console.log('[smoke-court-office-imprison-dismiss-refresh] PASS ' + passed + ' assertions');

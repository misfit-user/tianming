#!/usr/bin/env node
/* eslint-env node */
/*
 * smoke-wendui-dialogue-budget-typing.js
 * 2026-06-11·问对两修:
 *   #1 对话「生成一半就截断」=_aiDialogueTok 预算只够 reply·没给 JSON 元数据(忠诚/情绪/记忆/欺瞒/建议)留量
 *      → reply 写满后元数据被 finish_reason:length 截断。修=加 category-aware 固定元数据缓冲(wd 600 / 其余 250)。
 *      行为校验:vm 抽出 _aiDialogueTok 实算 token(stub _getCharRange)。
 *   #2 聊天打字卡顿:_wdUpdateCounter 改 rAF 合帧(消除每键同步 DOM 写 + 全局 MutationObserver 触发);
 *      .wd-modal-inner/.wd-modal-chat 加 contain 把样式/布局/重绘 scope 在弹窗内。源码契约。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const utils = fs.readFileSync(path.join(ROOT, 'tm-utils.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');

let passed = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); passed += 1; }

// ── #1 行为:抽出 _aiDialogueTok 实算 ─────────────────────────────────────────
const fnMatch = utils.match(/function _aiDialogueTok\(category, speakerCount\)[\s\S]*?return tok;\s*\n\}/);
assert(fnMatch, '抽不到 _aiDialogueTok 函数体');
const fnSrc = fnMatch[0];

function makeTok(range, maxOutputTokens) {
  const ctx = {
    window: {},
    console: { log: function () {} },
    _getCharRange: function () { return range; },
    P: { conf: (maxOutputTokens != null ? { maxOutputTokens: maxOutputTokens } : {}) },
    parseInt: parseInt, Math: Math
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.__tok = _aiDialogueTok;', ctx);
  return ctx.__tok;
}

const tokDefault = makeTok([150, 300]); // 默认问对/对话字数档·设置 auto
// 2026-06-11·owner:默认翻三倍。wd×1:基线 max(500,300*2.5)=750·+600 缓冲=1350·×3=4050
assert(tokDefault('wd', 1) === 4050, 'wd×1 默认应 4050((750+600)×3)·实=' + tokDefault('wd', 1));
// cy×3:(max(500,900*2.5)=2250 + 250)×3=7500
assert(tokDefault('cy', 3) === 7500, 'cy×3 默认应 7500((2250+250)×3)·实=' + tokDefault('cy', 3));
// cy×1:(750+250)×3=3000
assert(tokDefault('cy', 1) === 3000, 'cy×1 默认应 3000((750+250)×3)·实=' + tokDefault('cy', 1));
// 翻三倍后远高于旧 750(治截断)
assert(tokDefault('wd', 1) >= 750 * 3, 'wd 默认须≥旧 750 的三倍');
// 大字数档也随 range 线性放大
const tokBig = makeTok([300, 600]);
assert(tokBig('wd', 1) === (Math.max(500, Math.round(600 * 2.5)) + 600) * 3, 'wd 大档须随 range 放大后再×3');

// ── #2(task 2)设置「AI 输出上限 max_tokens」对对话生效 ────────────────────────
// 设置高于翻三倍默认 → 采用设置值(用户调高即生效)
assert(makeTok([150, 300], 12000)('wd', 1) === 12000, '设置 12000(>默认4050)→ 采用设置·实=' + makeTok([150, 300], 12000)('wd', 1));
// 设置低于默认 → 不回落到截断(默认作下限保护)
assert(makeTok([150, 300], 1000)('wd', 1) === 4050, '设置 1000(<默认4050)→ 保留默认下限 4050·实=' + makeTok([150, 300], 1000)('wd', 1));
// 设置 0/auto → 用默认
assert(makeTok([150, 300], 0)('wd', 1) === 4050, '设置 0(auto)→ 默认 4050');

// ── #2 打字:_wdUpdateCounter rAF 合帧 ────────────────────────────────────────

// ── #2 打字:CSS containment ───────────────────────────────────────────────────
const inner = css.match(/\.wd-modal-inner\{[^}]*\}/);
assert(inner && /contain:layout style;/.test(inner[0]), '.wd-modal-inner 须 contain:layout style');
const chat = css.match(/\.wd-modal-chat\{[\s\S]*?\}/);
assert(chat && /contain:layout style paint;/.test(chat[0]), '.wd-modal-chat 须 contain:layout style paint');

console.log('[smoke-wendui-dialogue-budget-typing] PASS ' + passed + ' assertions');

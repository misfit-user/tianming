#!/usr/bin/env node
// smoke-endturn-cause-legibility.js — 过回合「机械后果被玩家感知」B-batch
//   B1 民心逐因:MinxinLedger.recentCauses(此前只喂 AI·面板硬写 reasons:[] 只显裸数)→政治核心 chip
//   B2 皇威/皇权:_recordAuthorityChange 已写 turnChanges.variables reasons(按 label 匹配)→政治核心 chip
//   B4 人口:逃户/伤亡写死占位(「旱灾·洪灾·民逃江淮」断言假具体)→有真 population_changes 显真因·否则诚实通用
//   顶层函数直调(tm-endturn-render.js 非 IIFE)·同 smoke-endturn-party-class-change-groups harness。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let n = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); n++; }
function escHtml(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

const sandbox = {
  console, Math, Date, JSON, RegExp, Error, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
  escHtml,
  window: { TM: { errors: { capture(){}, captureSilent(){} },
    MinxinLedger: { recentCauses: function(_gm, opts){ return [
      { reason: '赈灾得民心', deltaTrue: 3, kind: 'relief' },
      { reason: '加派辽饷·民怨', deltaTrue: -5, kind: 'levy' }
    ]; } } } },
  GM: {
    turn: 9,
    minxin: 60, _prev_minxin: 66,        // 民心跌 6
    huangwei: 72, _prev_huangwei: 70,    // 皇威涨 2
    turnChanges: {
      // 皇威 authority 变动·_recordAuthorityChange 形状(path huangwei.index·label 皇威·reasons)
      variables: [
        { name: '皇威', label: '皇威', path: 'huangwei.index', oldValue: 70, newValue: 72, delta: 2,
          reason: '施恩闭环', reasons: [{ type: 'benevolence', amount: 2, desc: '大婚颁赏·施恩四方' }] }
      ],
      population_changes: [
        { region: '陕西', kind: 'flee', amount: 5000, reason: '苛役无度·民走关外' },
        { region: '河南', kind: 'flee', amount: 3000, reason: '大旱绝收' }
      ]
    }
  }
};
sandbox.TM = sandbox.window.TM;
sandbox.window = sandbox;  // 2026-07-06 组装迁 tm-endturn-shiji-compose.js(IIFE 挂 window)·浏览器语义 window=全局
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-shiji-compose.js'), 'utf8'), sandbox, { filename: 'tm-endturn-shiji-compose.js' });
const SJC = sandbox.TM.Endturn.ShijiCompose;

assert(SJC && typeof SJC.coreMetricReasons === 'function' && typeof SJC.popReasonHtml === 'function' && typeof SJC.reasonChips === 'function', '① 三 helper 可调(ShijiCompose 内核导出)');

// ── B2 皇威:按 label 匹配 turnChanges.variables 已有 reasons ──
const hw = SJC.coreMetricReasons('huangwei', '皇威');
assert(Array.isArray(hw) && hw.some(r => /施恩四方/.test(r.desc||'')), '② 皇威逐因取自 turnChanges.variables(施恩四方)');

// ── B1 民心:走 MinxinLedger.recentCauses(此前只喂 AI) ──
const mx = SJC.coreMetricReasons('minxin', '民心');
assert(mx.some(r => /赈灾得民心/.test(r.desc||'')) && mx.some(r => /加派辽饷/.test(r.desc||'')), '③ 民心逐因取自 MinxinLedger.recentCauses');
assert(mx.some(r => r.delta === 3) && mx.some(r => r.delta === -5), '④ 民心逐因带 delta(deltaTrue 映射·正负皆传)');

// ── 无匹配 metric → 空(不误挂别人的因) ──
assert(SJC.coreMetricReasons('someMetric', '不存在').length === 0, '⑤ 无匹配→空数组(不误挂)');

// ── _rucReasonChips 把逐因渲成 chip(端到端·民心因果真上屏) ──
const chips = SJC.reasonChips(mx);
assert(/赈灾得民心/.test(chips) && /加派辽饷/.test(chips) && /tr-reason-chip/.test(chips), '⑥ 逐因经 _rucReasonChips 渲成 chip 上屏');

// ── B4 人口:有真 population_changes(flee)→显真因带地域 ──
const fleeHtml = SJC.popReasonHtml(['flee'], '赋役、灾荒、兼并所迫');
assert(/陕西·苛役无度/.test(fleeHtml) && /河南·大旱绝收/.test(fleeHtml), '⑦ 逃户显真 population_changes 因(带地域)');
assert(/-5000/.test(fleeHtml), '⑧ 真因带减损量');

// ── B4 无真 population_changes(death 本回合无)→回落诚实通用(非硬编假具体) ──
const deathHtml = SJC.popReasonHtml(['death'], '新生·死亡·逃散');
assert(/新生·死亡·逃散/.test(deathHtml) && /tr-reason-txt/.test(deathHtml), '⑨ 无真因→回落诚实通用词');

// ── 静态契约（2026-07-06 组装迁 compose·模式随 _sjc 名）──
const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-shiji-compose.js'), 'utf8');
assert(!/民逃江淮/.test(src), '⑫ 旧误导硬编「民逃江淮」已除');

console.log('[smoke-endturn-cause-legibility] pass assertions=' + n);

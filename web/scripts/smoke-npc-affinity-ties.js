#!/usr/bin/env node
// smoke-npc-affinity-ties.js
// 验证「刀A:hearts 注入当前盟友/宿敌立场·闭合 npc_actions 行为后果的跨回合回路」。
// 手法:从 tm-endturn-prompt.js 抽**真** ties 片段包成 tiesFor()·喂 spy AffinityMap 实跑·非重新实现。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const PROMPT = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');

// ── 抽真片段实跑 ──
const a = PROMPT.indexOf('// 当前亲疏立场——top 盟友');
const b = PROMPT.indexOf('} catch (_tiesE) {}', a);
ok(a >= 0 && b > a, '能定位 ties 片段');
const snippet = PROMPT.slice(a, b + '} catch (_tiesE) {}'.length);

const ctx = { Math: Math };
ctx.tiesFor = null;
vm.createContext(ctx);
// 包成函数:片段引用 c / AffinityMap / _xE / xmlLines
vm.runInContext(
  'function tiesFor(c, AffinityMap, _xE, xmlLines) {\n' + snippet + '\n}',
  ctx, { filename: 'tiesFor.js' }
);
ok(typeof ctx.tiesFor === 'function', 'tiesFor(真片段) 装载');

const _xE = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

// spy AffinityMap:对称模型·按 |value| 降序返回 {name,value}
function mkAff(rels) {
  return { getRelations: function (name) { return (rels[name] || []).slice().sort(function (x, y) { return Math.abs(y.value) - Math.abs(x.value); }); } };
}

// ① 盟友+宿敌混合·各 top3·按强度
(function () {
  const aff = mkAff({
    '甲': [
      { name: '盟1', value: 60 }, { name: '盟2', value: 45 }, { name: '盟3', value: 30 }, { name: '盟4', value: 22 },
      { name: '敌1', value: -70 }, { name: '敌2', value: -40 }, { name: '敌3', value: -25 }, { name: '敌4', value: -21 },
      { name: '微', value: 10 } // |10|<20 噪声·应被滤掉
    ]
  });
  const out = [];
  ctx.tiesFor({ name: '甲' }, aff, _xE, out);
  ok(out.length === 1, '① 输出 1 行 <ties>·实=' + out.length);
  const line = out[0] || '';
  ok(/<ties>/.test(line) && /<\/ties>/.test(line), '① 含 <ties></ties>');
  ok((line.match(/<ally /g) || []).length === 3, '① 盟友取 top3·实=' + (line.match(/<ally /g) || []).length);
  ok((line.match(/<foe /g) || []).length === 3, '① 宿敌取 top3·实=' + (line.match(/<foe /g) || []).length);
  ok(line.indexOf('盟1') >= 0 && line.indexOf('盟2') >= 0 && line.indexOf('盟3') >= 0 && line.indexOf('盟4') < 0, '① 盟友按强度·盟4 被挤出');
  ok(line.indexOf('敌1') >= 0 && line.indexOf('敌4') < 0, '① 宿敌按强度·敌4 被挤出');
  ok(line.indexOf('微') < 0, '① |value|<20 噪声(微)被滤');
  ok(/favor="60"/.test(line) && /favor="-70"/.test(line), '① favor 数值带出');
})();

// ② 只有盟友·无宿敌
(function () {
  const aff = mkAff({ '乙': [{ name: '友', value: 50 }] });
  const out = [];
  ctx.tiesFor({ name: '乙' }, aff, _xE, out);
  ok(out.length === 1 && /<ally /.test(out[0]) && !/<foe /.test(out[0]), '② 只盟友·无 foe 标签');
})();

// ③ 无显著关系(全<20)→不输出 ties 行
(function () {
  const aff = mkAff({ '丙': [{ name: 'x', value: 5 }, { name: 'y', value: -8 }] });
  const out = [];
  ctx.tiesFor({ name: '丙' }, aff, _xE, out);
  ok(out.length === 0, '③ 无显著关系→不注入空 ties·实=' + out.length);
})();

// ④ AffinityMap 缺失→静默跳过(typeof 守卫·不抛错)
(function () {
  const out = [];
  let threw = false;
  try { ctx.tiesFor({ name: '丁' }, undefined, _xE, out); } catch (e) { threw = true; }
  ok(!threw && out.length === 0, '④ AffinityMap undefined 时静默跳过不抛错');
})();

// ⑤ XML 转义:名字含特殊字符
(function () {
  const aff = mkAff({ '戊': [{ name: '李<&>"', value: 40 }] });
  const out = [];
  ctx.tiesFor({ name: '戊' }, aff, _xE, out);
  ok(out[0].indexOf('&lt;') >= 0 && out[0].indexOf('&amp;') >= 0, '⑤ 名字特殊字符被 XML 转义');
})();

console.log('[smoke-npc-affinity-ties] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);

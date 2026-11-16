#!/usr/bin/env node
/* eslint-env node */
// smoke-keju-mobility-flow.js — G·科举守恒上行流（2026-06-16）实跑断言
//   Part A（真模块）：tickClassRadical 第⑤项 _aspirationBlock 注入 radicalFrac + 逐回合衰减 + 无字段回归安全。
//   Part B（真函数抽取）：_kejuMobilityFlow 读 classRatio 寒门占比→受阻怨望/泄压 + 守恒上行人口流 best-effort + no-op 安全。
'use strict';

const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-field-pipelines.js'));
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
const SF = require(path.join(WEB, 'tm-social-foundation.js'));

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
function r2(n) { return Math.round(Number(n) * 100) / 100; }
function mkCls(o) { return Object.assign({ name: '士大夫', economicRole: '治理' }, o); }

console.log('smoke-keju-mobility-flow — G 科举守恒上行流');
console.log('— Part A：tickClassRadical 受阻怨望项（真模块）—');

// 1. 受阻怨望抬高 radicalFrac（满意度中性·唯 _aspirationBlock 驱动）
const cBlock = mkCls({ satisfaction: 50, _radicalFrac: 0.1, _aspirationBlock: 0.4 });
SF.tickClassRadical({}, cBlock, {}, 5);
const cNone = mkCls({ satisfaction: 50, _radicalFrac: 0.1 });
SF.tickClassRadical({}, cNone, {}, 5);
ok(cBlock._radicalFrac > cNone._radicalFrac, '受阻怨望抬高 radicalFrac (' + cBlock._radicalFrac + ' > ' + cNone._radicalFrac + ')');
ok(r2(cBlock._radicalFrac) === 0.22, '受阻 pressure 0.4→快激进 +0.12 (got ' + cBlock._radicalFrac + ')');
ok(r2(cNone._radicalFrac) <= 0.1, '★无 _aspirationBlock→回归安全(慢平复·不受影响) (' + cNone._radicalFrac + ')');

// 2. 逐回合衰减（不被新一科再塞则消退 0.04/回合）
ok(r2(cBlock._aspirationBlock) === 0.36, '受阻怨望逐回合衰减 0.4→0.36 (' + cBlock._aspirationBlock + ')');
const cDecay = mkCls({ satisfaction: 50, _radicalFrac: 0.2, _aspirationBlock: 0.06 });
SF.tickClassRadical({}, cDecay, {}, 6);
ok(r2(cDecay._aspirationBlock) === 0.02, '小残怨望续衰减 0.06→0.02 (' + cDecay._aspirationBlock + ')');

console.log('— Part B：_kejuMobilityFlow（真函数抽取）—');
const src = (fs.readFileSync(path.join(WEB, 'tm-keju-runtime.js'), 'utf8') + '\n' + fs.readFileSync(path.join(WEB, 'tm-keju-runtime-keyi.js'), 'utf8'));
function sliceFn(s, marker) { const a = s.indexOf(marker); let j = s.indexOf('{', a), d = 0; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return s.slice(a, j); }
const fnSrc = sliceFn(src, 'function _kejuMobilityFlow(');

function runFlow(GM, stats, results) {
  const ebLog = [];
  const ctx = {
    Math: Math, Number: Number, isFinite: isFinite, Object: Object, console: console,
    GM: GM,
    addEB: function (cat, msg) { ebLog.push(cat + '·' + msg); },
    TM: { ClassEngine: { resolvePopulationKeys: function (cls) {
      const n = (cls && cls.name) || '';
      if (/自耕|编户|农/.test(n)) return ['peasant_self', 'bianhu'];
      if (/士绅|门阀/.test(n)) return ['gentry_high', 'gentry_low'];
      return [n];   // 士大夫/缙绅 落 byName（无 gentry 格子）——镜像真 resolver
    } } }
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.go=_kejuMobilityFlow;', ctx);
  ctx.go({}, stats, results);
  return ebLog;
}
function mkGM(extra) {
  return Object.assign({
    classes: [
      { name: '士大夫', economicRole: '治理', satisfaction: 30 },
      { name: '缙绅', economicRole: '治理', satisfaction: 64 },
      { name: '自耕农', economicRole: '生产', satisfaction: 26 }
    ]
  }, extra || {});
}

// 3. 寒门通道塞（占比低）→ 士大夫受阻怨望↑ + 邸报奏报
const gm1 = mkGM();
const eb1 = runFlow(gm1, { classRatio: { 士族: 0.7, 寒门: 0.1, 商贾: 0.2 } }, { length: 12 });
const sd1 = gm1.classes[0];
ok(r2(sd1._aspirationBlock) === 0.3, '寒门塞(占比0.1)→士大夫 _aspirationBlock=0.3 (' + sd1._aspirationBlock + ')');
ok(r2(sd1._kejuOpenness) === 0.1, '透明字段 _kejuOpenness=寒门占比0.1 (' + sd1._kejuOpenness + ')');
ok(eb1.some(function (e) { return /怨望渐深/.test(e); }), '严重受阻(>0.5)→邸报「士林怨望渐深」');

// 4. 寒门通道宽（占比高）→ 泄压（既有怨望消减）
const gm2 = mkGM();
gm2.classes[0]._aspirationBlock = 0.4;
runFlow(gm2, { classRatio: { 寒门: 0.5, 士族: 0.5 } }, { length: 20 });
ok(r2(gm2.classes[0]._aspirationBlock) === 0.25, '寒门通道宽→泄压 0.4→0.25 (' + gm2.classes[0]._aspirationBlock + ')');

// 5. 守恒上行人口流（格子存在）：自耕→士绅·conserved
const gm3 = mkGM({ population: { byClass: { peasant_self: { mouths: 6000000 }, gentry_low: { mouths: 200000 } } } });
const before = gm3.population.byClass.peasant_self.mouths + gm3.population.byClass.gentry_low.mouths;
runFlow(gm3, { classRatio: { 寒门: 0.4, 士族: 0.6 } }, { length: 20 });   // hanmenGrads=round(20*0.4)=8 → move 8*8=64
const after = gm3.population.byClass.peasant_self.mouths + gm3.population.byClass.gentry_low.mouths;
ok(gm3.population.byClass.peasant_self.mouths === 6000000 - 64, '上行流·自耕 −64 (' + gm3.population.byClass.peasant_self.mouths + ')');
ok(gm3.population.byClass.gentry_low.mouths === 200000 + 64, '上行流·士绅(gentry_low 兜底键) +64 (' + gm3.population.byClass.gentry_low.mouths + ')');
ok(before === after, '★上行人口流守恒（总数不变 ' + after + '）');

// 6. 无 gentry 格子 → 人口流 no-op（但怨望仍算）
const gm4 = mkGM({ population: { byClass: { peasant_self: { mouths: 6000000 } } } });
runFlow(gm4, { classRatio: { 寒门: 0.05, 士族: 0.95 } }, { length: 10 });
ok(gm4.population.byClass.peasant_self.mouths === 6000000, '无士绅格子→上行流 no-op(自耕不变·best-effort)');
ok(gm4.classes[0]._aspirationBlock > 0, '无格子仍算受阻怨望（teeth 不依赖人口格子） (' + gm4.classes[0]._aspirationBlock + ')');

// 7. 无 classRatio → 全 no-op 安全
const gm5 = mkGM({ population: { byClass: { peasant_self: { mouths: 6000000 }, gentry_low: { mouths: 200000 } } } });
runFlow(gm5, {}, { length: 20 });
ok(gm5.classes[0]._aspirationBlock === undefined && gm5.population.byClass.peasant_self.mouths === 6000000, '无 classRatio→全 no-op(怨望/人口流皆不动)');

console.log('\n[smoke-keju-mobility-flow] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);

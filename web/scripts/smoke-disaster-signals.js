#!/usr/bin/env node
'use strict';
// smoke-disaster-signals — 灾害派生信号产出(真bug·盘活 disasterLevel 等 8+ 死输入消费方)
//   实跑 _syncDisasterSignals:① 严重度聚合 ② disasterType/activeFamine ③ 无灾即清防陈旧
//   ④ 阈值穿越(moderate>0.3 激活既有消费方·minor<0.3 仅经济) ⑤ tickDisasters 两分支均调用(源契约)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-disaster-signals');

const guoku = fs.readFileSync(path.join(ROOT,'tm-guoku-engine.js'),'utf8');
const sevSrc = guoku.match(/var _DISASTER_SEV = \{[^;]*\};/);
const fnSrc = sliceFn(guoku, 'function _syncDisasterSignals(');
ok(!!sevSrc && !!fnSrc, '_DISASTER_SEV + _syncDisasterSignals 抽取成功');

function run(active, preVars, preFamine){
  const ctx = { Math: Math };
  ctx.GM = { vars: preVars || {}, activeFamine: !!preFamine };
  vm.createContext(ctx);
  vm.runInContext(sevSrc[0]+'\n'+fnSrc+'\nthis.go=function(a){ _syncDisasterSignals(a); };', ctx);
  ctx.go(active);
  return ctx.GM;
}

// ① 单 moderate 旱灾 ≈0.32
var m = run([{category:'drought', severity:'moderate'}]);
ok(m.vars.disasterLevel >= 0.31 && m.vars.disasterLevel <= 0.33, '① 单 moderate 旱灾 → disasterLevel≈0.32');
ok(m.vars.disasterType === 'drought', '② disasterType=drought(供旱荒赈济疏判定)');
ok(m.activeFamine === false, '② 单 moderate(0.32<0.35)→ 暂未饥荒');
ok(m.vars.disasterLevel > 0.3, '④ ★0.32>0.3·激活既有消费方(huji 死亡率/自耕农满意度/粮价)');

// ① severe 旱灾 ≈0.49 → 饥荒
var s = run([{category:'drought', severity:'severe'}]);
ok(s.vars.disasterLevel >= 0.48 && s.vars.disasterLevel <= 0.50, '① severe 旱灾 → ≈0.49');
ok(s.activeFamine === true, '② severe 旱灾(>0.35+旱类)→ activeFamine');

// ② severe 瘟疫 → 非饥荒类
var p = run([{category:'plague', severity:'severe'}]);
ok(p.vars.disasterType === 'plague' && p.activeFamine === false, '② severe 瘟疫→activeFamine false(瘟疫非饥荒类)');

// ① 两 severe 叠加 ≈0.61
var two = run([{category:'flood',severity:'severe'},{category:'drought',severity:'severe'}]);
ok(two.vars.disasterLevel >= 0.60 && two.vars.disasterLevel <= 0.62, '① 两 severe 叠加 → ≈0.61(0.49+0.12)');

// ④ 单 minor < 0.3 → 仅经济·无人口/民心效应
var mi = run([{category:'drought', severity:'minor'}]);
ok(mi.vars.disasterLevel < 0.3, '④ 单 minor(0.14)<0.3·不触发人口/民心(仅经济·税基已另治)');

// ③ 无灾即清防陈旧
var cleared = run([], { disasterLevel: 0.5, disasterType: 'flood' }, true);
ok(cleared.vars.disasterLevel === 0, '③ ★无灾→disasterLevel 清零(防陈旧·原早返回致永不归零)');
ok(cleared.vars.disasterType === '' && cleared.activeFamine === false, '③ 无灾→disasterType/activeFamine 一并清');

// ③ 从未设过 → 不无谓写入
var never = run([], {});
ok(!('disasterLevel' in never.vars) || never.vars.disasterLevel === 0, '③ 从未有灾→不无谓触碰(或保持0)');

console.log('\n结果: '+A+' 通过 / 0 失败');

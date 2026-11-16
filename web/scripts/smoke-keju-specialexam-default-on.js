#!/usr/bin/env node
'use strict';
// smoke-keju-specialexam-default-on — 验证「特科默认开」(#5·2026-06-14)
// 抽真闸门函数 _isD2/_isG2/_isG3/_isG5 Enabled 在沙箱实跑：
//   · 默认（flag undefined）→ 开（解锁三套成熟内容）
//   · 显式 false → 关（玩家 opt-out 仍生效）
//   · 显式 true → 开
//   · 无 P.conf → 关（防御守卫保留）
// + 源契约：6 处闸门走 !== false、设置 UI 文案改人话、复选框态同步

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function assert(c, m){ if(!c) throw new Error('[assert] ' + m); passed++; }

// 从源码 brace-match 抽出一个函数
function sliceFn(src, marker){
  const a = src.indexOf(marker);
  if (a < 0) return null;
  let i = src.indexOf('{', a), depth = 0, j = i;
  for (; j < src.length; j++){ const c = src[j]; if (c === '{') depth++; else if (c === '}'){ depth--; if (depth === 0){ j++; break; } } }
  return src.slice(a, j);
}

function gate(file, marker, flag){
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const fnSrc = sliceFn(src, marker);
  assert(!!fnSrc, marker + ' 抽取成功（' + file + '）');
  function run(P){
    const ctx = { P: P };
    vm.createContext(ctx);
    vm.runInContext(fnSrc + '\nthis.__r = ' + marker.replace('function ', '').replace('() {', '') + '();', ctx);
    return ctx.__r;
  }
  // 默认（flag 缺）→ 开
  assert(run({ conf: {} }) === true, flag + ' 默认（undefined）→ 开（解锁）');
  // 显式 false → 关（opt-out 保留）
  const offConf = {}; offConf[flag] = false;
  assert(run({ conf: offConf }) === false, flag + ' 显式 false → 关（玩家可关）');
  // 显式 true → 开
  const onConf = {}; onConf[flag] = true;
  assert(run({ conf: onConf }) === true, flag + ' 显式 true → 开');
  // 无 conf → 关（防御守卫）
  assert(run({}) === false, flag + ' 无 P.conf → 关（防御守卫保留）');
}

gate('tm-keju-special-exams.js', 'function _isD2Enabled() {', 'useNewKejuD2');
gate('tm-keju-enke.js',          'function _isG2Enabled() {', 'useNewKejuG2');
gate('tm-keju-wuju.js',          'function _isG3Enabled() {', 'useNewKejuG3');
gate('tm-keju-tongzi.js',        'function _isG5Enabled() {', 'useNewKejuG5');

// 设置 UI 源契约
{
  const p = (fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8'));
  assert(p.indexOf('🎓 特科·总开关（默认开）') >= 0, '设置标题改人话（特科总开关）');
  assert(p.indexOf('🎓 恩科（需总开关）') >= 0 && p.indexOf('🎓 武举（需总开关）') >= 0 && p.indexOf('🎓 童子科（需总开关）') >= 0, '恩科/武举/童子标题改人话');
  assert(p.indexOf('default OFF') < 0 && p.indexOf('need D2') < 0 && p.indexOf('spawn infra') < 0, '开发黑话已清（default OFF / need D2 / spawn infra）');
}

console.log('PASS smoke-keju-specialexam-default-on · ' + passed + ' 断言');

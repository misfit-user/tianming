#!/usr/bin/env node
'use strict';
// smoke-keju-tekedetail — 特科明细可展开(恩科/武举/童子科 history·原仅显 .length)
// 抽真 _kjExamReasonCN / _kjHistRows 沙箱实跑:缘由中文化(不漏英文)+三类明细渲染+空兜底+可点格源契约
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

function sliceFn(src, marker) {
  const a = src.indexOf(marker); if (a < 0) return null;
  let i = src.indexOf('{', a), depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { j++; break; } } }
  return src.slice(a, j);
}

const src = fs.readFileSync(path.join(ROOT, 'tm-keju.js'), 'utf8');
const f1 = sliceFn(src, 'function _kjExamReasonCN(h){');
const f2 = sliceFn(src, 'function _kjHistRows(arr,kind){');
ok(!!f1 && !!f2, '抽出 _kjExamReasonCN / _kjHistRows');

const ctx = { console, Math, String, Array, Object, RegExp };
vm.createContext(ctx);
vm.runInContext(f1 + '\n' + f2 + '\nthis.__r1=_kjExamReasonCN;this.__r2=_kjHistRows;', ctx);
const reason = ctx.__r1, rows = ctx.__r2;

console.log('smoke-keju-tekedetail');

// ① 缘由 subtype 中文化(prefix 映射)
ok(reason({ subtype: 'birthday' }) === '圣寿恩科', '① birthday → 圣寿恩科');
ok(reason({ subtype: 'reign-change' }) === '登极恩科', '① reign-change → 登极恩科');
ok(reason({ subtype: 'tesuoming-fengchan' }) === '祥瑞特开', '① fengchan → 祥瑞特开');
ok(reason({ subtype: 'war-merit' }) === '录功之科', '① war-merit → 录功之科');
ok(reason({ subtype: 'bingbu-backed' }) === '兵部所请', '① bingbu-backed → 兵部所请');
ok(reason({ subtype: 'libu-backed' }) === '礼部所请', '① libu-backed → 礼部所请');
ok(reason({ subtype: '_player_initiated' }) === '御点亲开', '① player → 御点亲开');
// ★未知 subtype → 空(绝不漏英文)
ok(reason({ subtype: 'totally-unknown-xyz' }) === '', '① ★未知 subtype → 空串(不漏英文)');

// ② 恩科明细渲染
const enke = [
  { year: 1627, subtype: 'birthday', examiner: '黄立极', jinshiCount: 18, jinshiNames: ['甲', '乙', '丙'] },
  { year: 1628, subtype: 'bingbu-backed', examiner: '李标', jinshiCount: 5, jinshiNames: [] }
];
const he = rows(enke, 'enke');
ok(he.indexOf('1627年') >= 0 && he.indexOf('1628年') >= 0, '② 恩科明细含两科年份');
ok(he.indexOf('圣寿恩科') >= 0, '② 缘由中文化(圣寿恩科)');
ok(he.indexOf('主考 黄立极') >= 0, '② 主考渲染');
ok(he.indexOf('中式 18 人') >= 0, '② 中式人数渲染');
ok(he.indexOf('甲、乙、丙') >= 0, '② 中者名单渲染');
ok(he.indexOf('bingbu-backed') < 0 && he.indexOf('birthday') < 0, '② ★无英文 subtype 泄漏');

// ③ 武举明细(wujinshiCount/Names)
const wuju = [{ year: 1627, subtype: 'war-merit', examiner: '孙承宗', wujinshiCount: 12, wujinshiNames: ['张武'] }];
const hw = rows(wuju, 'wuju');
ok(hw.indexOf('录功之科') >= 0 && hw.indexOf('中式 12 人') >= 0 && hw.indexOf('张武') >= 0, '③ 武举明细(缘由/武进士数/名)');

// ④ 童子科(poolSize·选童 N 名)
const tongzi = [{ year: 1627, subtype: 'recommendation', examiner: '某公', poolSize: 3 }];
const ht = rows(tongzi, 'tongzi');
ok(ht.indexOf('选童 3 名') >= 0, '④ 童子科用「选童 N 名」(读 poolSize)');

// ⑤ 空 → 兜底
ok(rows([], 'enke').indexOf('暂无开科记录') >= 0, '⑤ 空 history → 暂无开科记录');

console.log('\n结果: ' + A + ' 通过 / 0 失败');

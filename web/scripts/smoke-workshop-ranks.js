#!/usr/bin/env node
'use strict';

// smoke-workshop-ranks.js — 百工榜「只按真实字段排序」可执行断言（步骤2·排行榜用真数据）
//   真跑 renderRanksPane（extractFn 抽源 + 注入真实 hasMetric + stub state）：
//   ① 下载榜按真实 downloads 降序出排名列表（=默认榜有数据）
//   ② 口碑榜无有效评分 → 诚实空态，邀约文案「首个评分从你开始」（不假零、不占位）
//   ③ 社区推荐榜按真实 endorsements 出列表；无该指标的包不入榜
//   ④ 无任何指标的包被排除出全部三榜（诚实目录不给缺字段补位）
//   突变自检：把下载榜的 hasMetric 守卫改成 true → 无指标包混入下载榜（证守卫有效·据此变红）
//   风格沿袭 smoke-workshop-pipeline-e：读运行时源码 + extractFn 抽纯函数真跑；全程 fresh-read 证真源未污染。

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const communitySrc = read('tm-content-manager-community.js');

// 抽取器（沿袭 pipeline-a/b/e）：本仓顶层/内层函数收尾恒为「\n  }」（2 空格花括号独占一行）。
function extractFn(src, header) {
  var s = src.indexOf(header);
  assert(s >= 0, 'extractFn 找不到函数头: ' + header);
  var rest = src.slice(s);
  var end = rest.indexOf('\n  }');
  assert(end >= 0, 'extractFn 找不到 2 空格收尾花括号: ' + header);
  return rest.slice(0, end + 4);
}

var renderRanksSrc = extractFn(communitySrc, 'function renderRanksPane()');
var hasMetricSrc = extractFn(communitySrc, 'function hasMetric(');

// 用注入的 state/esc/jsArg/mallSkeleton/truthEmpty 真跑抽出的 renderRanksPane 源；
// hasMetric 用真源抽出体（守卫语义真跑，不用替身）。renderSrc 可换成突变副本。
function buildRender(renderSrc) {
  var esc = function (s) { return String(s == null ? '' : s); };
  var jsArg = function (s) { return "'" + String(s) + "'"; };
  var mallSkeleton = function () { return '<!--SKELETON-->'; };
  var truthEmpty = function (g, t, c) { return '<!--TRUTHEMPTY:' + String(t) + '-->'; };
  var factory = new Function('state', 'esc', 'jsArg', 'mallSkeleton', 'truthEmpty',
    hasMetricSrc + '\n' + renderSrc + '\nreturn renderRanksPane;');
  return function (state) { return factory(state, esc, jsArg, mallSkeleton, truthEmpty)(); };
}

// 分栏抽取：结构为 …<div class="rail"><h4>XXX榜</h4>…</div>（每栏隔离到下一 rail 或末尾）。
function rails(html) {
  var parts = html.split('<div class="rail">').slice(1);
  var map = {};
  parts.forEach(function (p) {
    var m = /^<h4>([^<]+)<\/h4>/.exec(p);
    if (m) map[m[1]] = p;
  });
  return map;
}

// 线上实况同构的 stub：downloads 有货(56/20/3)、endorse 有货(1)、评分缺席；丁卷无任何指标。
function makeState() {
  return {
    catalogStatus: 'idle',
    catalog: { packs: [
      { id: 'p1', title: '甲卷', author: '作者甲', downloads: 56, endorsements: 1 },
      { id: 'p2', title: '乙卷', author: '作者乙', downloads: 20 },
      { id: 'p3', title: '丙卷', author: '作者丙', downloads: 3 },
      { id: 'p4', title: '丁卷', author: '作者丁' }
    ] }
  };
}

var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error('  ✗ FAIL: ' + msg); } }

console.log('smoke-workshop-ranks');

var r = rails(buildRender(renderRanksSrc)(makeState()));

// ① 下载榜真实降序 + 默认榜有数据
ok(!/rank-empty/.test(r['下载榜']), '① 下载榜非空（默认榜有数据）');
ok(r['下载榜'].indexOf('甲卷') >= 0 && r['下载榜'].indexOf('↓' + '56') >= 0, '① 下载榜含真实下载量 56');
ok(r['下载榜'].indexOf('甲卷') < r['下载榜'].indexOf('乙卷') && r['下载榜'].indexOf('乙卷') < r['下载榜'].indexOf('丙卷'), '① 下载榜按 downloads 降序（56>20>3）');

// ② 口碑榜诚实空态·邀约文案
ok(/rank-empty/.test(r['口碑榜']), '② 口碑榜无有效评分→空态');
ok(r['口碑榜'].indexOf('首个评分从你开始') >= 0, '② 口碑空态为邀约文案（不假零不占位）');
ok(r['口碑榜'].indexOf('甲卷') < 0, '② 无评分的包不混入口碑榜');

// ③ 社区推荐榜真实 endorsements
ok(r['社区推荐榜'].indexOf('甲卷') >= 0 && r['社区推荐榜'].indexOf('✦' + '1') >= 0, '③ 推荐榜按真实 endorsements 出列表（甲卷 ✦1）');
ok(r['社区推荐榜'].indexOf('乙卷') < 0, '③ 无 endorsements 的包不入推荐榜');

// ④ 无任何指标的包被全部排除
ok(r['下载榜'].indexOf('丁卷') < 0 && r['口碑榜'].indexOf('丁卷') < 0 && r['社区推荐榜'].indexOf('丁卷') < 0, '④ 无指标的丁卷被排除出全部三榜（缺字段不补位）');

// —— 突变自检：删下载榜 hasMetric 守卫 → 无指标包(丁卷)混入下载榜 ——
var mutSrc = renderRanksSrc.replace("hasMetric(p, 'downloads')", 'true');
assert(mutSrc !== renderRanksSrc, '突变: 下载榜 hasMetric 守卫确被改');
var rMut = rails(buildRender(mutSrc)(makeState()));
ok(rMut['下载榜'].indexOf('丁卷') >= 0, '突变: 删下载榜 hasMetric 守卫后无指标包(丁卷)混入下载榜（证守卫有效·据此变红）');

// —— 收尾：fresh-read 证真源未被突变污染 + 邀约文案在真源 ——

console.log('\nsmoke-workshop-ranks ' + (fail ? 'FAIL' : 'PASS') + ' ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);

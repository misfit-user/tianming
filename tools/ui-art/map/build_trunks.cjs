// 舆图干流：从 Natural Earth 50m 大河（web/preview/img/east-asia-basemap-data.js，已在库里）取出折线，换到舆图世界坐标，
// 首尾相接的接成一条（金沙江 → 长江 → 下游……），记每段起点的「上游已流长度」。写成 web/ui/scene/map/trunks.js。
// 用途只是给山河境的细河分干支：挨着干流的那几段画粗（lines.js），不另画一套线。
// 用法：node tools/ui-art/map/build_trunks.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
global.window = {};
require(path.join(ROOT, 'web/preview/img/east-asia-basemap-data.js'));
const B = window.EAST_ASIA_BASEMAP;

// 底图坐标（经 70～144、纬 1～58.5 线性铺到 1200×720）→ 舆图世界（每度 20 像素，经 55°E、纬 67°N 为原点）
const toWorld = (x, y) => {
  const lon = B.extent.lon[0] + x * (B.extent.lon[1] - B.extent.lon[0]) / B.viewBox[2];
  const lat = B.extent.lat[1] - y * (B.extent.lat[1] - B.extent.lat[0]) / B.viewBox[3];
  return [(lon - 55) * 20, (67 - lat) * 20];
};
const parse = (d) => {
  const out = [];
  let cur = null;
  for (const m of d.matchAll(/([ML])\s*([-\d.]+)[\s,]+([-\d.]+)/g)) {
    if (m[1] === 'M' || !cur) { cur = []; out.push(cur); }
    cur.push(toWorld(+m[2], +m[3]));
  }
  return out;
};
const length = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };

const rivers = [];
for (const r of B.riverPaths) for (const pts of parse(r.d)) if (pts.length >= 2) rivers.push({ name: r.name, pts, len: length(pts), up: 0 });
// 首尾相接：一段的起点落在另一段的终点上，就是它的下游续段；上游已流长度沿续段累加（取最长的一支）
// 两段接头处原数据有零点几像素的出入：起点离另一段终点不到 0.6 像素即算相接
const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.6;
const feeders = (i) => rivers.map((r, j) => j).filter((j) => j !== i && near(rivers[j].pts[rivers[j].pts.length - 1], rivers[i].pts[0]));
const memo = new Map();
function upstream(i, seen = new Set()) {
  if (memo.has(i)) return memo.get(i);
  if (seen.has(i)) return 0;
  seen.add(i);
  let best = 0;
  for (const j of feeders(i)) best = Math.max(best, upstream(j, seen) + rivers[j].len);
  memo.set(i, best);
  return best;
}
rivers.forEach((r, i) => { r.up = upstream(i); });

const round = (v) => Math.round(v * 100) / 100;
const body = rivers.map((r) => `  { name: ${JSON.stringify(r.name)}, up: ${Math.round(r.up)}, pts: [${r.pts.map((q) => `${round(q[0])},${round(q[1])}`).join(',')}] }`).join(',\n');
const out = `// 由 tools/ui-art/map/build_trunks.cjs 生成，勿手改。来源：Natural Earth 50m rivers（公有领域），经 web/preview/img/east-asia-basemap-data.js。
// 每条：name 原名，up 起点处已流长度（世界像素），pts 平铺的 x,y（舆图世界坐标，自上游往下游）。
export const TRUNKS = [
${body}
];
`;
const dest = path.join(ROOT, 'web/ui/scene/map/trunks.js');
fs.writeFileSync(dest, out);
console.log(`干流 ${rivers.length} 段，${rivers.reduce((a, r) => a + r.pts.length, 0)} 点 → ${path.relative(ROOT, dest)}（${(out.length / 1024).toFixed(0)} KB）`);

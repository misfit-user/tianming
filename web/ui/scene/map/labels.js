// 舆图题名（照 CK3：字写在地面上——随地势起伏、随镜头透视，不是浮在屏上的贴字），随层级（index.js 的 TIERS）换：
// · 势力名（天下档）：顺疆域的形势弯着写，字号、字距随疆域大小铺开；疆域竖长就竖写（字正立）。只有一道的势力到省道档仍题国名。
// · 省道名（省道档）：同样顺各道的形势弯写，字小一档。
// · 府州名（府州档）：写在本府州里，字号随地块大小（大府大字、小州小字）；挡着治所城郭就挪到城郭下方。京城朱色、要府加重。
//   与邻名相撞的先缩字，还撞就不题（推近也不冒出来，免得一推一拉字忽有忽无）。
// · 大河名：顺河道写在河边（省道档大字疏、府州档小字密）。
// 字模是有符号距离场（SDF）一字一格，推近放大也不糊；四周一圈绢色晕，压在山水上也认得。屏上太小、太大的字淡去不画。
// 疆域形势：在府州编号图上按势力（省道、府州）找出最大的一块，求长轴，沿长轴分段量宽窄、取中线，中线拟一条缓弯的抛物线，字落在线上。
import * as THREE from 'three';
import { TRUNKS } from './trunks.js';
import { W, H } from './terrain.js';

// 题名：势力全名去掉括注；少数太长或俗称另有通名的照表。剧本地图上的 shortName 是图上小标用的一两字缩写（「察哈」「喀尔」），不拿来题名
export function realmTitle(name) {
  const n = String(name || '');
  if (SHORT[n]) return SHORT[n];
  return n.replace(/[（(][^）)]*[）)]/g, '').split('·')[0].trim() || n;
}
const SHORT = { '明朝廷': '大明', '荷兰·台海(东印度公司)': '荷兰', '西班牙·马尼拉': '西班牙', '大越黎郑阮格局': '大越', '虾夷地与松前氏': '虾夷', '吐鲁番诸伯克': '吐鲁番', '野人女真诸部': '野人女真', '葡萄牙·澳门': '澳门', '瓦刺诸部': '瓦剌' };
// 府州题名：去括注；名前冠了本省名以示区别的（南直隶太平府、江西建昌府）图上去掉省名——落在哪一省一看便知
export function prefTitle(r) {
  const strip = (s) => String(s || '').replace(/[（(][^）)]*[）)]/g, '').trim();
  let n = strip(r.name);
  const c = strip(r.circuit);
  if (c && n.startsWith(c)) {
    const rest = n.slice(c.length);
    if ([...rest].length >= 2 && /[府州司卫]$/.test(rest)) n = rest;
  }
  return n || String(r.name || '');
}
// 大河：Natural Earth 原名 → 题名；只在北纬 21.5 度以北落字（下游出了国境的不题）
const RIVERS = { Huang: '黄河', 'Chang Jiang': '长江', Yangtze: '长江', Han: '汉水', Liao: '辽河', Songhua: '松花江', 'Heilong Jiang': '黑龙江', Jinsha: '金沙江', Lancang: '澜沧江', Nu: '怒江', Gan: '赣江' };

// ---------- 题名的类：浓淡随层级、屏上大小的显隐、墨色与晕 ----------
// px：屏上字高（CSS 像素）小过 [0]～[1] 淡入，大过 [2]～[3] 淡去
const KIND = {
  realm:   { k: 0, ink: [0.13, 0.10, 0.07], halo: [0.95, 0.92, 0.84, 0.42], px: [9, 13, 420, 520] },
  sole:    { k: 1, ink: [0.13, 0.10, 0.07], halo: [0.95, 0.92, 0.84, 0.42], px: [9, 13, 420, 520] },
  circuit: { k: 2, ink: [0.17, 0.12, 0.08], halo: [0.95, 0.92, 0.84, 0.45], px: [9, 12, 220, 280] },
  pref:    { k: 3, ink: [0.16, 0.12, 0.08], halo: [0.96, 0.93, 0.85, 0.7], px: [8.5, 11, 64, 90] },
  seat:    { k: 4, ink: [0.09, 0.06, 0.03], halo: [0.97, 0.94, 0.86, 0.75], px: [8, 10.5, 72, 100] },
  capital: { k: 5, ink: [0.50, 0.12, 0.07], halo: [0.97, 0.94, 0.86, 0.75], px: [8, 10.5, 72, 100] },
  riverBig:   { k: 6, ink: [0.17, 0.35, 0.41], halo: [0.94, 0.94, 0.88, 0.65], px: [8.5, 11, 60, 80] },
  riverSmall: { k: 7, ink: [0.17, 0.35, 0.41], halo: [0.94, 0.94, 0.88, 0.75], px: [8.5, 11, 60, 80] }
};
const KINDS = Object.values(KIND).sort((a, b) => a.k - b.k);
// 字号、字距（世界像素）：kT 取宽窄的几成、kL 取长短的几成；spread 字铺开占长轴几成，maxAdv 字距最多几个字宽；bend 弯的上限；snap 长宽比不到此数的一律横写
const RULE = {
  realm:   { kT: 0.55, kL: 0.8, min: 11, max: 88, spread: 0.7, maxAdv: 2.6, bend: 0.45, snap: 1.35, steep: 58 },
  circuit: { kT: 0.4, kL: 0.8, min: 5.5, max: 44, spread: 0.6, maxAdv: 2.0, bend: 0.4, snap: 1.35, steep: 58 },
  pref:    { kT: 0.38, kL: 0.9, min: 2.7, max: 6.2, spread: 0, maxAdv: 1.06, bend: 0.25, snap: 1.8, steep: 62, tilt: 30 }
};

// ---------- 字模：有符号距离场，一字一格 64 像素，字身 44 像素，距离场内外各八像素（字外的晕从这里取） ----------
const CELL = 64, GLYPH = 44, SPREAD = 8, COLS = 32;
const FONTS = ["'TM-MaShanZheng', 'TM-WenKai', serif", "'TM-WenKai', 'KaiTi', serif"];
const glyphCache = new Map();                 // 「字体号|字」→ 距离场（全页共用，易主重排不重画）
const baseline = [];
let gctx = null;
const INF = 1e20;
// 一维距离变换（Felzenszwalb）：grid 里每格到最近「零格」的平方距离
function edt1d(grid, offset, stride, length, f, v, z) {
  v[0] = 0; z[0] = -INF; z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do { const r = v[k]; s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2; } while (s <= z[k] && --k > -1);
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k], qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}
function edt(grid, f, v, z) {
  for (let x = 0; x < CELL; x++) edt1d(grid, x, CELL, CELL, f, v, z);
  for (let y = 0; y < CELL; y++) edt1d(grid, y * CELL, 1, CELL, f, v, z);
}
function makeGlyph(font, ch) {
  if (!gctx) {
    const c = document.createElement('canvas');
    c.width = c.height = CELL;
    gctx = c.getContext('2d', { willReadFrequently: true });
  }
  const g = gctx;
  g.clearRect(0, 0, CELL, CELL);
  g.font = `${GLYPH}px ${FONTS[font]}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#000';
  // 各字共用一条基线（按「国」字的上下居中），免得「一」「口」各自居中、高低乱跳
  if (baseline[font] == null) { const m = g.measureText('国'); baseline[font] = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2; }
  g.fillText(ch, CELL / 2, CELL / 2 + baseline[font]);
  const px = g.getImageData(0, 0, CELL, CELL).data;
  const n = CELL * CELL, outer = new Float64Array(n), inner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    outer[i] = a >= 1 ? 0 : a <= 0 ? INF : Math.max(0, 0.5 - a) ** 2;
    inner[i] = a >= 1 ? INF : a <= 0 ? 0 : Math.max(0, a - 0.5) ** 2;
  }
  const f = new Float64Array(CELL), v = new Uint16Array(CELL), z = new Float64Array(CELL + 1);
  edt(outer, f, v, z);
  edt(inner, f, v, z);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.max(0, Math.min(255, Math.round(255 * (0.5 - (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / (2 * SPREAD)))));
  return out;
}

// ---------- 形势：编号图上按组找最大的一块，量长轴、宽窄、中线 ----------
// grid：每格所属组（-1 无）；orient(组, 长宽比, 长轴角) → { theta, vertical }。出每组 { area, mx, my, dir, vertical, t0, dt, cnt, sum }（格为单位）
const BINS = 40;
function analyze(grid, gw, gh, count, orient) {
  const n = gw * gh;
  const lab = new Int32Array(n), par = new Int32Array(n + 1);
  let next = 1;
  const find = (a) => { let r = a; while (par[r] !== r) r = par[r]; while (par[a] !== r) { const nx = par[a]; par[a] = r; a = nx; } return r; };
  for (let y = 0, i = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++, i++) {
      const g = grid[i];
      if (g < 0) continue;
      const l = x > 0 && grid[i - 1] === g ? lab[i - 1] : 0;
      const u = y > 0 && grid[i - gw] === g ? lab[i - gw] : 0;
      if (l && u) {
        if (l !== u) { const a = find(l), b = find(u); if (a !== b) { if (a < b) par[b] = a; else par[a] = b; } }
        lab[i] = l;
      } else if (l || u) lab[i] = l || u;
      else { par[next] = next; lab[i] = next++; }
    }
  }
  const root = new Int32Array(next);
  for (let l = 1; l < next; l++) root[l] = find(l);
  const area = new Float64Array(next), sx = new Float64Array(next), sy = new Float64Array(next);
  const sxx = new Float64Array(next), syy = new Float64Array(next), sxy = new Float64Array(next);
  for (let y = 0, i = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++, i++) {
      if (!lab[i]) continue;
      const r = root[lab[i]];
      lab[i] = r;
      area[r]++; sx[r] += x; sy[r] += y; sxx[r] += x * x; syy[r] += y * y; sxy[r] += x * y;
    }
  }
  // 每组取面积最大的一块（海岛、飞地不题）
  const best = new Int32Array(count), bestA = new Float64Array(count);
  const groupOfRoot = new Int32Array(next).fill(-1);
  for (let i = 0; i < n; i++) if (lab[i] && groupOfRoot[lab[i]] < 0) groupOfRoot[lab[i]] = grid[i];
  for (let r = 1; r < next; r++) {
    const g = groupOfRoot[r];
    if (g >= 0 && area[r] > bestA[g]) { bestA[g] = area[r]; best[g] = r; }
  }
  const shapes = new Array(count).fill(null);
  for (let g = 0; g < count; g++) {
    const r = best[g];
    if (!r) continue;
    const a = area[r], mx = sx[r] / a, my = sy[r] / a;
    const cxx = sxx[r] / a - mx * mx, cyy = syy[r] / a - my * my, cxy = sxy[r] / a - mx * my;
    const th0 = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    const tr = (cxx + cyy) / 2, det = Math.sqrt(Math.max(0, ((cxx - cyy) / 2) ** 2 + cxy * cxy));
    const elong = Math.sqrt((tr + det) / Math.max(tr - det, 1e-6));
    const o = orient(g, elong, th0 * 180 / Math.PI);
    let dir = [Math.cos(o.theta), Math.sin(o.theta)];
    if (o.vertical ? dir[1] < 0 : dir[0] < 0) dir = [-dir[0], -dir[1]];
    const vt = dir[0] * dir[0] * cxx + 2 * dir[0] * dir[1] * cxy + dir[1] * dir[1] * cyy;
    const sd = Math.sqrt(Math.max(vt, 0.25));
    shapes[g] = { area: a, mx, my, dir, vertical: o.vertical, t0: -2.6 * sd, dt: 5.2 * sd / BINS, cnt: new Float32Array(BINS), sum: new Float32Array(BINS) };
  }
  for (let y = 0, i = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++, i++) {
      const r = lab[i];
      if (!r) continue;
      const g = grid[i];
      if (best[g] !== r) continue;
      const s = shapes[g], dx = x - s.mx, dy = y - s.my;
      const t = dx * s.dir[0] + dy * s.dir[1];
      const b = Math.max(0, Math.min(BINS - 1, Math.floor((t - s.t0) / s.dt)));
      s.cnt[b]++;
      s.sum[b] += -dx * s.dir[1] + dy * s.dir[0];
    }
  }
  return shapes;
}

// 一组的字：沿形势中线（缓弯的抛物线）把 n 个字铺开。scale 一格合几世界像素。出 { glyphs: [{ x, y, rot }], size }（世界坐标）
function curveText(sh, n, rule, scale, sizeMul = 1) {
  const { cnt, sum, t0, dt } = sh;
  let tot = 0, maxC = 0;
  for (let b = 0; b < BINS; b++) { tot += cnt[b]; maxC = Math.max(maxC, cnt[b]); }
  if (!tot) return null;
  let acc = 0, mid = 0;
  for (let b = 0; b < BINS; b++) { acc += cnt[b]; if (acc >= tot / 2) { mid = b; break; } }
  // 中段连着够宽的那一截（宽不及最宽处三成的两头不算）
  let lo = mid, hi = mid;
  const cut = 0.3 * maxC;
  while (lo > 0 && cnt[lo - 1] >= cut) lo--;
  while (hi < BINS - 1 && cnt[hi + 1] >= cut) hi++;
  const tc = t0 + (lo + hi + 1) / 2 * dt, L = (hi - lo + 1) * dt;
  let T = 0, wsum = 0;
  for (let b = lo; b <= hi; b++) { T += cnt[b] * cnt[b] / dt; wsum += cnt[b]; }
  T /= wsum;
  // 中线：各段的中点按段内格数加权，拟 s = a·t² + b·t + c（t 自 tc 起算）
  let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, Y0 = 0, Y1 = 0, Y2 = 0;
  for (let b = lo; b <= hi; b++) {
    const w = cnt[b];
    if (!w) continue;
    const t = t0 + (b + 0.5) * dt - tc, y = sum[b] / w, t2 = t * t;
    S0 += w; S1 += w * t; S2 += w * t2; S3 += w * t2 * t; S4 += w * t2 * t2;
    Y0 += w * y; Y1 += w * t * y; Y2 += w * t2 * y;
  }
  const det3 = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const M = [S4, S3, S2, S3, S2, S1, S2, S1, S0];
  const D = det3(M);
  let qa = 0, qb = 0, qc = Y0 / S0;
  if (Math.abs(D) > 1e-9 * Math.max(1, S4 * S2 * S0)) {
    qa = det3([Y2, S3, S2, Y1, S2, S1, Y0, S1, S0]) / D;
    qb = det3([S4, Y2, S2, S3, Y1, S1, S2, Y0, S0]) / D;
    qc = det3([S4, S3, Y2, S3, S2, Y1, S2, S1, Y0]) / D;
  }
  // 弯不过限：两头的斜率比中间多不过 bend；限了弯就按剩下的重拟直线部分
  const amax = rule.bend / Math.max(L, 1);
  if (Math.abs(qa) > amax) {
    qa = Math.sign(qa) * amax;
    const r0 = Y0 - qa * S2, r1 = Y1 - qa * S3, dd = S0 * S2 - S1 * S1;
    qb = Math.abs(dd) > 1e-9 ? (S0 * r1 - S1 * r0) / dd : 0;
    qc = (r0 - qb * S1) / S0;
  }
  qb = Math.max(-0.3, Math.min(0.3, qb));
  // 字号：宽窄、长短各给一个上限，取小的
  const Tw = T * scale, Lw = L * scale;
  const size = Math.max(rule.min, Math.min(rule.max, Tw * rule.kT, Lw * rule.kL / (1.06 * n - 0.06))) * sizeMul;
  const adv = n > 1 ? Math.max(size * 1.06, Math.min(size * rule.maxAdv, (Lw * rule.spread - size) / (n - 1))) : 0;
  // 弧长换 t：从中点往两头量
  const slope = (t) => 2 * qa * t + qb;
  const arcT = (u) => {
    const target = Math.abs(u) / scale, sg = Math.sign(u), h = Math.max(target / 40, 1e-3);
    let t = 0, len = 0;
    while (len < target) { const ds = Math.hypot(1, slope(t + sg * h / 2)) * h; if (len + ds > target) { t += sg * h * (target - len) / ds; break; } len += ds; t += sg * h; }
    return t;
  };
  const [dx, dy] = sh.dir, nx = -dy, ny = dx;
  const glyphs = [];
  for (let i = 0; i < n; i++) {
    const t = arcT((i - (n - 1) / 2) * adv);
    const s = qa * t * t + qb * t + qc, tt = tc + t;
    const px = sh.mx + dx * tt + nx * s, py = sh.my + dy * tt + ny * s;
    const k = slope(t), tx = dx + nx * k, ty = dy + ny * k;
    const phi = Math.atan2(ty, tx);
    // 竖写的字只随行斜一半（竖排的字大致正立才好认）
    glyphs.push({ x: (px + 0.5) * scale, y: (py + 0.5) * scale, rot: sh.vertical ? (phi - Math.PI / 2) * 0.5 : phi });
  }
  return { glyphs, size };
}

// 定向：长宽比不到 snap 的横写；长轴陡过 steep 度竖写；府州横写时斜不过 tilt 度
const orientBy = (rule, chars) => (g, elong, deg) => {
  if (elong < rule.snap) return { theta: 0, vertical: false };
  if (Math.abs(deg) > rule.steep && (chars ? chars(g) : 2) > 1) return { theta: deg * Math.PI / 180, vertical: true };
  const lim = rule.tilt ?? 90;
  return { theta: Math.max(-lim, Math.min(lim, deg)) * Math.PI / 180, vertical: false };
};

// 相撞：字当圆盘（半径约半个字宽），按格子分桶
function collider(cell = 12) {
  const buckets = new Map();
  const key = (i, j) => i * 4096 + j;
  const each = (x, y, r, fn) => {
    for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) {
      for (let j = Math.floor((y - r) / cell); j <= Math.floor((y + r) / cell); j++) if (fn(key(i, j)) === false) return false;
    }
    return true;
  };
  return {
    free(glyphs, r) {
      return glyphs.every((g) => each(g.x, g.y, r, (k) => !(buckets.get(k) || []).some((o) => Math.hypot(o.x - g.x, o.y - g.y) < o.r + r)));
    },
    add(glyphs, r) {
      for (const g of glyphs) {
        const d = { x: g.x, y: g.y, r };
        each(g.x, g.y, r, (k) => { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(d); });
      }
    }
  };
}

// ---------- 着色器：字平铺在地面上，按类定浓淡、墨色与晕 ----------
// 一条题名一个高度（各字字心与四角的最高处），整条平铺：贴着起伏折起来的字压在山脊上会被折断；
// 各字各取各的高，推近、起伏拔高时高处的字在屏上往上跑，字序就乱了（「淡水社」看成「水淡社」）
const VERT = /* glsl */`
uniform float uRelief;
uniform float uPx;
uniform vec3 uCam;
uniform float uFogNear;
uniform float uFogFar;
uniform float uKindA[8];
uniform vec4 uKindPx[8];
uniform vec3 uInk[8];
uniform vec4 uHalo[8];
uniform vec4 uClip;              // 案上绢图：出了画框不多的题名整条挪进框（x0, y0, x1, y1），出得多的不题；平时不限
attribute float aKind;
attribute float aSize;
attribute float aH;              // 这条题名的高度（0～1，乘起伏）
attribute vec4 aBox;             // 这条题名的外框
varying vec2 vUv;
varying float vA;
varying vec3 vInk;
varying vec4 vHalo;
void main() {
  vec3 p = position;
  vec2 shift = max(uClip.xy - aBox.xy, 0.0) - max(aBox.zw - uClip.zw, 0.0);
  p.xz += shift;
  p.y = aH * uRelief + 0.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  int k = int(aKind + 0.5);
  float px = aSize * uPx / max(-mv.z, 1.0);
  vec4 f = uKindPx[k];
  vA = uKindA[k] * step(length(shift), aSize) * smoothstep(f.x, f.y, px) * (1.0 - smoothstep(f.z, f.w, px)) * (1.0 - smoothstep(uFogNear, uFogFar, distance(p, uCam)));
  vInk = uInk[k];
  vHalo = uHalo[k];
  vUv = uv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);     // 这一档不显的字整块甩出画面，不白跑片元
}`;
const FRAG = /* glsl */`
uniform sampler2D uAtlas;
varying vec2 vUv;
varying float vA;
varying vec3 vInk;
varying vec4 vHalo;
void main() {
  if (vA < 0.004) discard;
  float d = texture2D(uAtlas, vUv).r;
  float w = clamp(fwidth(d) * 0.75, 0.004, 0.25);
  float fill = smoothstep(0.5 - w, 0.5 + w, d);
  float halo = smoothstep(0.16, 0.5, d);
  halo *= halo * vHalo.a;
  float a = fill + halo * (1.0 - fill);
  vec3 col = vInk * fill + vHalo.rgb * halo * (1.0 - fill);
  gl_FragColor = vec4(col, a) * vA;                          // 预乘
  if (gl_FragColor.a < 0.004) discard;
}`;

const fadeBy = (d, a, b) => Math.max(0, Math.min(1, (d - a) / (b - a)));

// shared：与地形共用的 uniform（uRelief、uPx、uCam、远雾）；landAt(x, y) 判陆（0～1）；heightAt(x, y) 地面高（0～1，与地形网格同一张）
export function createLabels({ shared, landAt, heightAt }) {
  const group = new THREE.Group();
  group.renderOrder = 30;
  const uniforms = {
    uRelief: shared.uRelief, uPx: shared.uPx, uCam: shared.uCam, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar,
    uAtlas: { value: null },
    uClip: { value: new THREE.Vector4(-1e6, -1e6, 1e6, 1e6) },
    uKindA: { value: new Array(8).fill(0) },
    uKindPx: { value: KINDS.map((d) => new THREE.Vector4(...d.px)) },
    uInk: { value: KINDS.map((d) => new THREE.Vector3(...d.ink)) },
    uHalo: { value: KINDS.map((d) => new THREE.Vector4(...d.halo)) }
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
  });
  let mesh = null, atlas = null;
  let input = null, build = 0, pending = null, done = Promise.resolve();
  let important = new Set(), capitals = new Set();

  // 题名的料：{ kind, font, text, glyphs, size }。分几段算，段间交出主线程（开图、易主时不卡一大下）；stale() 为真即作废
  const tick = () => new Promise((r) => setTimeout(r, 0));
  async function layoutAll({ regions, realms, circuits, realmByRegion, circuitOf, ids }, stale) {
    const out = [];
    if (!regions.length || !ids) return out;
    const idAt = (x, y) => ids.data[Math.min(ids.height - 1, y) * ids.width + Math.min(ids.width - 1, x)] - 1;
    // 势力、省道：两世界像素一格
    const S = 2, gw = Math.ceil(W / S), gh = Math.ceil(H / S);
    const regionGrid = new Int32Array(gw * gh);
    for (let y = 0, i = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++, i++) {
        const wx = x * S + S / 2, wy = y * S + S / 2;
        regionGrid[i] = landAt(wx, wy) > 0.5 ? idAt(Math.floor(wx * 2), Math.floor(wy * 2)) : -1;
      }
    }
    const byGroup = (map) => {
      const g = new Int32Array(regionGrid.length);
      for (let i = 0; i < g.length; i++) { const r = regionGrid[i]; g[i] = r >= 0 && map[r] >= 0 ? map[r] : -1; }
      return g;
    };
    const realmText = realms.map((r) => [...realmTitle(r.name)]);
    const realmShapes = analyze(byGroup(realmByRegion), gw, gh, realms.length, orientBy(RULE.realm, (g) => realmText[g].length));
    realms.forEach((r, g) => {
      const sh = realmShapes[g];
      if (!sh || sh.area * S * S < 300) return;
      const multi = (r.circuits || 1) > 1;
      const lay = curveText(sh, realmText[g].length, RULE.realm, S);
      if (lay) out.push({ kind: multi ? KIND.realm : KIND.sole, font: 0, chars: realmText[g], ...lay });
    });
    await tick();
    if (stale()) return null;
    // 省道名：只题分了几道的势力
    const multiRealm = new Set(realms.map((r, i) => ((r.circuits || 1) > 1 ? i : -1)).filter((i) => i >= 0));
    const circMap = Int32Array.from(circuitOf, (c) => (c >= 0 && multiRealm.has(circuits[c].realm) ? c : -1));
    const circText = circuits.map((c) => [...(c.title || c.name || '')]);
    const circShapes = analyze(byGroup(circMap), gw, gh, circuits.length, orientBy(RULE.circuit, (g) => circText[g].length));
    circuits.forEach((c, g) => {
      const sh = circShapes[g];
      if (!sh || sh.area * S * S < 60 || !circText[g].length) return;
      const lay = curveText(sh, circText[g].length, RULE.circuit, S);
      if (lay) out.push({ kind: KIND.circuit, font: 0, chars: circText[g], ...lay });
    });
    // 省道档的大河名不压省道名、国名
    const bigHits = collider(24);
    for (const l of out) if (l.kind !== KIND.realm) bigHits.add(l.glyphs, l.size * 0.62);

    await tick();
    if (stale()) return null;
    // 府州：一世界像素一格
    const pw = W, ph = H;
    const prefGrid = new Int32Array(pw * ph);
    for (let y = 0, i = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++, i++) prefGrid[i] = landAt(x + 0.5, y + 0.5) > 0.5 ? idAt(x * 2 + 1, y * 2 + 1) : -1;
    }
    const prefText = regions.map((r) => [...prefTitle(r)]);
    await tick();
    if (stale()) return null;
    const prefShapes = analyze(prefGrid, pw, ph, regions.length, orientBy(RULE.pref, (g) => prefText[g].length));
    const rank = (i) => (capitals.has(i) ? 2 : important.has(i) ? 1 : 0);
    const order = regions.map((_, i) => i).filter((i) => prefShapes[i] && prefText[i].length)
      .sort((a, b) => rank(b) - rank(a) || prefShapes[b].area - prefShapes[a].area);
    const hits = collider(12);
    for (const i of order) {
      const k = rank(i), sh = prefShapes[i], r = regions[i];
      const rule = k ? { ...RULE.pref, min: k === 2 ? 4.2 : 3.4, max: RULE.pref.max * 1.12 } : RULE.pref;
      for (const mul of [1, 0.84, 0.7]) {
        const lay = curveText(sh, prefText[i].length, rule, 1, mul);
        if (!lay || lay.size < 2.2) break;
        if (r.center) avoidSeat(lay, r.center, k, sh.vertical);
        const rad = lay.size * 0.6, seen = lifted(lay.glyphs, lay.size);
        if (!hits.free(seen, rad)) continue;
        hits.add(seen, rad);
        out.push({ kind: k === 2 ? KIND.capital : k === 1 ? KIND.seat : KIND.pref, font: 1, chars: prefText[i], ...lay });
        break;
      }
    }
    // 大河名
    for (const l of riverLabels(bigHits, hits)) out.push(l);
    return out;
  }

  // 府州档相撞按「看上去」的位置算：题名整条抬到所在最高处，推近斜看时高处的往北（屏上往上）挪，
  // 挪多少约为高 × 起伏（府州档约二十九）× 俯角的正切（约一点一）
  const LIFT = 32;
  const topOf = (glyphs, size) => {
    const h = size / 2;
    let top = 0;
    for (const g of glyphs) for (const [dx, dy] of [[0, 0], [h, h], [-h, h], [h, -h], [-h, -h]]) top = Math.max(top, heightAt(g.x + dx, g.y + dy));
    return top;
  };
  const lifted = (glyphs, size) => { const dy = topOf(glyphs, size * 1.1) * LIFT; return glyphs.map((g) => ({ x: g.x, y: g.y - dy })); };

  // 城郭（立在治所上、向上画）压着字就把字挪开：横写挪到城郭下方，竖写挪到城郭右边。
  // 京城、要府常驻兵马，军旗的兵数签挂在治所下沿，多让出一截
  function avoidSeat(lay, [sx, sy], k, vertical) {
    const icon = k === 2 ? 4.2 : k === 1 ? 3.3 : 2.6, h = lay.size / 2, gap = k ? 4.5 : 0.5;
    const hit = lay.glyphs.some((g) => Math.abs(g.x - sx) < h + icon * 0.55 && g.y + h > sy - icon * 1.35 && g.y - h < sy + gap);
    if (!hit) return;
    if (vertical) {
      const dx = sx + icon * 0.6 + gap - Math.min(...lay.glyphs.map((g) => g.x - h));
      for (const g of lay.glyphs) g.x += dx;
    } else {
      const dy = sy + gap - Math.min(...lay.glyphs.map((g) => g.y - h));
      for (const g of lay.glyphs) g.y += dy;
    }
  }

  // 大河：省道档每隔三百多像素一处大字，府州档每隔一百五小字；字顺流铺开，写在河的北岸（竖流写在东岸）
  function riverLabels(bigHits, hits) {
    const out = [];
    const placed = [];
    for (const [kind, size, gap, first, adv, hitSet] of [[KIND.riverBig, 7.5, 330, 140, 2.3, bigHits], [KIND.riverSmall, 3.4, 150, 60, 2.0, hits]]) {
      for (const t of TRUNKS) {
        const name = RIVERS[t.name];
        if (!name) continue;
        const chars = [...name], n = chars.length;
        const p = [];
        for (let i = 0; i + 1 < t.pts.length; i += 2) p.push([t.pts[i], t.pts[i + 1]]);
        if (p.length < 3) continue;
        const cum = [0];
        for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
        const total = cum[cum.length - 1];
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
          const f = (s - cum[lo]) / Math.max(cum[hi] - cum[lo], 1e-6);
          return [p[lo][0] + (p[hi][0] - p[lo][0]) * f, p[lo][1] + (p[hi][1] - p[lo][1]) * f];
        };
        const step = size * adv, half = (n - 1) / 2 * step;
        for (let s = first; s + half < total - 10; s += gap) {
          if (s - half < 5) continue;
          const c = at(s);
          if (67 - c[1] / 20 < 21.5) continue;
          if (placed.some((q) => q.kind === kind && q.name === name && Math.hypot(q.x - c[0], q.y - c[1]) < gap * 0.6)) continue;
          const a = at(s - half - size), b = at(s + half + size);
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const vertical = Math.abs(Math.sin(ang)) > Math.sin(60 * Math.PI / 180);
          // 读的方向：横写自西往东、竖写自北往南；河往反方向流就倒着取点
          const flip = vertical ? b[1] < a[1] : b[0] < a[0];
          const glyphs = [];
          for (let i = 0; i < n; i++) {
            const u = s + (flip ? -1 : 1) * (i - (n - 1) / 2) * step;
            const q = at(u), q0 = at(u - size * 0.8), q1 = at(u + size * 0.8);
            let tx = q1[0] - q0[0], ty = q1[1] - q0[1];
            if (flip) { tx = -tx; ty = -ty; }
            const phi = Math.atan2(ty, tx);
            // 离开河道：横写往北（屏上方）、竖写往东
            const off = size * 1.05;
            let ox = -Math.sin(phi), oy = Math.cos(phi);
            if (vertical ? ox < 0 : oy > 0) { ox = -ox; oy = -oy; }
            glyphs.push({ x: q[0] + ox * off, y: q[1] + oy * off, rot: vertical ? (phi - Math.PI / 2) * 0.5 : phi });
          }
          if (glyphs.some((g) => landAt(g.x, g.y) < 0.5)) continue;
          const rad = size * 0.6, seen = kind === KIND.riverSmall ? lifted(glyphs, size) : glyphs;
          if (!hitSet.free(seen, rad)) continue;
          hitSet.add(seen, rad);
          placed.push({ kind, name, x: c[0], y: c[1] });
          out.push({ kind, font: 1, chars, glyphs, size });
        }
      }
    }
    return out;
  }

  // 字模图集：用到的字一格一个（R8，距离场）；字体先载齐再画
  async function atlasFor(labels) {
    const keys = new Map();
    for (const l of labels) for (const ch of l.chars) keys.set(l.font + '|' + ch, null);
    const need = [...keys.keys()].filter((k) => !glyphCache.has(k));
    if (need.length && document.fonts) {
      const byFont = [[], []];
      for (const k of need) byFont[+k[0]].push(k.slice(2));
      await Promise.all(byFont.map((chs, f) => (chs.length ? document.fonts.load(`${GLYPH}px ${FONTS[f]}`, chs.join('')).catch(() => null) : null)));
    }
    for (let i = 0; i < need.length; i++) {
      glyphCache.set(need[i], makeGlyph(+need[i][0], need[i].slice(2)));
      if (i % 96 === 95) await tick();
    }
    const list = [...keys.keys()];
    const rows = Math.ceil(list.length / COLS);
    let h = 256;
    while (h < rows * CELL) h *= 2;
    const w = COLS * CELL, data = new Uint8Array(w * h);
    const uv = new Map();
    list.forEach((k, idx) => {
      const col = idx % COLS, row = Math.floor(idx / COLS), g = glyphCache.get(k);
      for (let y = 0; y < CELL; y++) data.set(g.subarray(y * CELL, (y + 1) * CELL), (row * CELL + y) * w + col * CELL);
      uv.set(k, [col * CELL / w, row * CELL / h, CELL / w, CELL / h]);
    });
    const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return { tex, uv };
  }

  // 一字一块平板（四个顶点），字格比字身大（距离场外延），按格算大小
  function geometryFor(labels, uv) {
    let count = 0;
    for (const l of labels) count += l.glyphs.length;
    const pos = new Float32Array(count * 4 * 3), tuv = new Float32Array(count * 4 * 2), kind = new Float32Array(count * 4), size = new Float32Array(count * 4);
    const height = new Float32Array(count * 4), box = new Float32Array(count * 4 * 4);
    const idx = new Uint32Array(count * 6);
    let v = 0, e = 0;
    for (const l of labels) {
      const cellW = l.size * CELL / GLYPH, h = l.size * 0.55;
      const bx = [Math.min(...l.glyphs.map((g) => g.x)) - h, Math.min(...l.glyphs.map((g) => g.y)) - h, Math.max(...l.glyphs.map((g) => g.x)) + h, Math.max(...l.glyphs.map((g) => g.y)) + h];
      const top = topOf(l.glyphs, l.size * 1.1);
      l.glyphs.forEach((g, gi) => {
        const [u0, v0, du, dv] = uv.get(l.font + '|' + l.chars[gi]);
        const c = Math.cos(g.rot), s = Math.sin(g.rot);
        const base = v;
        for (let j = 0; j <= 1; j++) {
          for (let i = 0; i <= 1; i++) {
            const lx = (i - 0.5) * cellW, ly = (j - 0.5) * cellW;
            pos[v * 3] = g.x + lx * c - ly * s;
            pos[v * 3 + 1] = 0;
            pos[v * 3 + 2] = g.y + lx * s + ly * c;
            tuv[v * 2] = u0 + i * du;
            tuv[v * 2 + 1] = v0 + j * dv;
            height[v] = top;
            box.set(bx, v * 4);
            kind[v] = l.kind.k;
            size[v] = l.size;
            v++;
          }
        }
        idx[e++] = base; idx[e++] = base + 2; idx[e++] = base + 1;
        idx[e++] = base + 1; idx[e++] = base + 2; idx[e++] = base + 3;
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(tuv, 2));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aH', new THREE.BufferAttribute(height, 1));
    geo.setAttribute('aBox', new THREE.BufferAttribute(box, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo;
  }

  async function rebuild() {
    const token = ++build;
    const data = input;
    if (!data) return;
    const t0 = performance.now();
    const labels = await layoutAll(data, () => token !== build);
    if (!labels) return;
    const t1 = performance.now();
    const at = await atlasFor(labels);
    if (token !== build) { at.tex.dispose(); return; }
    const geo = geometryFor(labels, at.uv);
    if (mesh) { group.remove(mesh); mesh.geometry.dispose(); }
    atlas?.dispose();
    atlas = at.tex;
    uniforms.uAtlas.value = atlas;
    mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 30;
    group.add(mesh);
    stats = { labels: labels.length, glyphs: labels.reduce((s, l) => s + l.glyphs.length, 0), atlas: [atlas.image.width, atlas.image.height], layoutMs: Math.round(t1 - t0), totalMs: Math.round(performance.now() - t0) };
    placed = labels;
  }
  let stats = null, placed = [];
  // 改了料就排一次重排（同一轮里连着改几样只排一次）
  function schedule() {
    if (!pending) {
      pending = new Promise((r) => setTimeout(r, 0)).then(() => { pending = null; return rebuild(); }).catch((e) => console.error('舆图题名', e));
      done = pending;
    }
    return pending;
  }

  function update(dist) {
    const A = uniforms.uKindA.value;
    // 国名与省道名交替处略有交叠（1330～1370 两层都淡），免得停在交界处一个名字都没有
    const realm = fadeBy(dist, 1330, 1430), circIn = fadeBy(dist, 620, 720), circOut = 1 - fadeBy(dist, 1270, 1370);
    const pref = 1 - fadeBy(dist, 600, 700);
    A[0] = 0.92 * realm;
    A[1] = 0.92 * circIn;
    A[2] = 0.9 * Math.min(circIn, circOut);
    A[3] = A[4] = A[5] = pref;
    A[6] = 0.85 * Math.min(circIn, 1 - fadeBy(dist, 1300, 1600));
    A[7] = 0.85 * pref;
    if (mesh) mesh.visible = A.some((a) => a > 0.004);
  }

  return {
    group,
    // regions、realms（带 circuits 数）、circuits、realmByRegion、circuitOf：index.js 的层级数据；ids：府州编号图（2 倍）
    setData(next) { input = next; return schedule(); },
    update,
    // 案上绢图：题名整条挪进这个框（世界坐标 [x0, y0, x1, y1]）；给空即不限
    setClip(rect) { uniforms.uClip.value.set(...(rect || [-1e6, -1e6, 1e6, 1e6])); },
    // 京城（府州下标）；要府（布政司治所、身份所在等）：字先占位、字大
    setCapitals(list) { capitals = new Set(list || []); return schedule(); },
    setImportant(list) { important = new Set(list || []); return schedule(); },
    get capitals() { return capitals; },
    get important() { return important; },
    get ready() { return done; },
    get stats() { return stats; },
    // 排好的题名（调试、自检用）：[{ kind, text, size, glyphs }]
    get placed() { return placed.map((l) => ({ kind: Object.keys(KIND).find((k) => KIND[k] === l.kind), text: l.chars.join(''), size: l.size, glyphs: l.glyphs })); },
    clear() { input = null; build++; if (mesh) { group.remove(mesh); mesh.geometry.dispose(); mesh = null; } },
    dispose() { this.clear(); atlas?.dispose(); material.dispose(); }
  };
}

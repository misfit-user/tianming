// 舆图城郭立体模型（照 CK3 地图上的领地模型）：府州治所按聚落等第（model/settlement.js）画成立在地形上的小城。
// 城郭四档越大墙越高、门楼越多、民居越密：小城土墙一门；府城砖墙雉堞、四门城楼、鼓楼、衙署；大府添角楼、瓮城、钟楼、塔、关厢；
// 都会四门瓮城、正南箭楼、护城河、七级塔、寺。京城外城之内套一座朱墙黄瓦的皇城。残城断墙塌楼、屋舍焦黑、两股烟；
// 帐幕、山寨、市镇、港、河埠各一套。府州名下真建了的营造另画营造地标（书院、仓廒、水利、工坊、堡、烽燧、佛寺、祠庙、驿、官署、
// 石桥，在建的脚手架、半损的残垣），摆在城郭四周。日本、朝鲜、大越、南洋、西洋据点的城郭照当地样子（towns3d-east.js、towns3d-south.js），
// 那几处的市镇、港，与寺、祠庙、教堂、书院、堡、官署几样地标也照当地样子（localKind 按地域换模型名）；仓廒、水利之类各处一样。
// 全用代码现搭，不带模型文件：每样一份几何（城郭四档各两种街巷，相邻府州不雷同），同一样的城实例化一回画完。
// 尺度：世界一单位约五公里，城比真城大五六倍——最近处一座府城也才六十来像素宽，所以块面要简明好认（CK3 美术也这么说：
// 照最大缩放、最小地块定尺寸，形要硬朗，不能像玩具）。高度不随起伏倍率伸缩，只有落脚处的地面高跟着地形走；
// 墙、屋往地下多伸一截，坡地上不悬空。模型原点在城的正中，舆图摆放时把城往北挪，让南沿落在治所那一点（府州名、军旗都在治所下方）。
import * as THREE from 'three';
import { townVertex, townFragment } from './shaders.js';
import { eastBuilders, EAST_LOCAL } from './towns3d-east.js';
import { southBuilders, SOUTH_LOCAL } from './towns3d-south.js';

// ---------- 用色（与山川设色同一路：灰砖、黛瓦、粉墙、朱柱、黄琉璃） ----------
const C = {
  stone: [0.78, 0.73, 0.64], stoneTop: [0.7, 0.66, 0.58], earth: [0.8, 0.68, 0.5], earthTop: [0.72, 0.61, 0.45],
  hole: [0.13, 0.11, 0.1], red: [0.74, 0.29, 0.2], tile: [0.55, 0.56, 0.56], tileDark: [0.45, 0.47, 0.48], tileLight: [0.63, 0.64, 0.63],
  plaster: [0.95, 0.92, 0.86], plaster2: [0.9, 0.85, 0.74], earthHouse: [0.83, 0.73, 0.57],
  ground: [0.8, 0.74, 0.6], street: [0.88, 0.85, 0.76], pave: [0.88, 0.86, 0.8],
  gold: [0.86, 0.66, 0.26], marble: [0.9, 0.89, 0.85], palace: [0.68, 0.21, 0.15], ochre: [0.8, 0.64, 0.36],
  water: [0.37, 0.53, 0.57], wood: [0.47, 0.35, 0.25], woodLight: [0.62, 0.48, 0.33], thatch: [0.7, 0.6, 0.4],
  felt: [0.92, 0.89, 0.81], feltGold: [0.84, 0.68, 0.34], feltDark: [0.66, 0.58, 0.45],
  leaf: [0.33, 0.47, 0.34], leafDark: [0.26, 0.39, 0.29], burnt: [0.27, 0.24, 0.22], ash: [0.4, 0.38, 0.36], smoke: [0.46, 0.45, 0.44],
  hull: [0.41, 0.31, 0.22], sail: [0.66, 0.35, 0.23], pole: [0.26, 0.21, 0.17], banner: [0.7, 0.21, 0.15], black: [0.17, 0.15, 0.14],
  brick: [0.64, 0.4, 0.3], bamboo: [0.72, 0.65, 0.43], dust: [0.75, 0.69, 0.58], willow: [0.47, 0.6, 0.38], arch: [0.2, 0.25, 0.27],
  paddy: [0.5, 0.63, 0.36], paddyWet: [0.46, 0.6, 0.57], rice: [0.79, 0.71, 0.42], dike: [0.69, 0.63, 0.47],
  horse: [0.52, 0.36, 0.23], horseDark: [0.27, 0.21, 0.17], horseLight: [0.85, 0.81, 0.73],
  jade: [0.38, 0.56, 0.44], deep: [0.27, 0.43, 0.37], pale: [0.6, 0.71, 0.5], hay: [0.8, 0.69, 0.42]
};

// ---------- 搭几何：三角形逐个放（法线按面，着色器按正反面翻，绕向不拘），带顶点色；可套平移、绕竖轴转 ----------
class Shape {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.stack = []; this.t = [0, 0, 0, 1, 0]; this.sea = false; }
  push(x, y, z, yaw = 0) {
    this.stack.push(this.t);
    const [tx, ty, tz, c, s] = this.t, cy = Math.cos(yaw), sy = Math.sin(yaw);
    this.t = [tx + x * c + z * s, ty + y, tz - x * s + z * c, c * cy - s * sy, s * cy + c * sy];
  }
  pop() { this.t = this.stack.pop(); }
  v([x, y, z]) { const [tx, ty, tz, c, s] = this.t; return [tx + x * c + z * s, ty + y, tz - x * s + z * c]; }
  tri(a, b, c, col, k0 = 1, k1 = 1, k2 = 1) {
    const A = this.v(a), B = this.v(b), D = this.v(c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-10) return;
    nx /= l; ny /= l; nz /= l;
    const w = this.sea ? 0 : 1;
    for (const [P, k] of [[A, k0], [B, k1], [D, k2]]) {
      this.pos.push(P[0], P[1], P[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(col[0] * k, col[1] * k, col[2] * k, w);
    }
  }
  quad(a, b, c, d, col, k = null) { this.tri(a, b, c, col, k ? k[0] : 1, k ? k[1] : 1, k ? k[2] : 1); this.tri(a, c, d, col, k ? k[0] : 1, k ? k[2] : 1, k ? k[3] : 1); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.col, 4));
    g.computeBoundingBox();
    return g;
  }
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
// 远看的那一份（城在屏上只有几十像素宽时换上）：不要雉堞、不要树，屋顶一截，民居并成大块。搭模型时置上
let FAR = false;

// ---------- 器件 ----------
// 方块：x0..x1、y0..y1、z0..z1，四面加顶（底不画）；faces 只画哪几面（n 北 s 南 e 东 w 西 t 顶）
function box(m, x0, y0, z0, x1, y1, z1, col, { top = col, faces = 'nsewt' } = {}) {
  if (faces.includes('s')) m.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col);
  if (faces.includes('n')) m.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
  if (faces.includes('e')) m.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col);
  if (faces.includes('w')) m.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
  if (faces.includes('t') && top) m.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
}
// 平铺一块地面（街、院、河）
function flat(m, x0, z0, x1, z1, y, col) { m.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], col); }
// 台：底半宽 a0×b0 到顶 a1×b1，y0→y1，四面斜收
function mound(m, cx, cz, a0, b0, a1, b1, y0, y1, col, top = col) {
  const B = [[cx - a0, y0, cz + b0], [cx + a0, y0, cz + b0], [cx + a0, y0, cz - b0], [cx - a0, y0, cz - b0]];
  const T = [[cx - a1, y1, cz + b1], [cx + a1, y1, cz + b1], [cx + a1, y1, cz - b1], [cx - a1, y1, cz - b1]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; m.quad(B[i], B[j], T[j], T[i], col); }
  m.quad(T[0], T[1], T[2], T[3], top);
}
// 大屋顶（庑殿）：檐口 y，檐口外沿半宽 a、半深 b（已含出檐），顶高 h；檐面下凹（近檐缓、近脊陡），四角起翘 lift；
// 长边方向起正脊（a = b 时成攒尖）。ridge：正脊的颜色（不给不起脊）
function hipRoof(m, cx, y, cz, a, b, h, col, { lift = 0, ridge = null, bands = 3 } = {}) {
  const swap = b > a, A = swap ? b : a, B = swap ? a : b, r = A - B;
  const P = (u, w, t, k) => {
    const yy = y + h * Math.pow(t, 1.6) + lift * k * (1 - t) * (1 - t);
    return swap ? [cx + w, yy, cz + u] : [cx + u, yy, cz + w];
  };
  const corner = (s) => Math.pow(Math.abs(2 * s - 1), 4);
  const kk = (t) => 0.84 + 0.16 * t;
  const nb = FAR ? 1 : bands, nf = FAR ? 2 : 4, ne = FAR ? 1 : 2;
  for (const side of [1, -1]) {
    for (let i = 0; i < nb; i++) {
      const t0 = i / nb, t1 = (i + 1) / nb;
      for (let j = 0; j < nf; j++) {
        const s0 = j / nf, s1 = (j + 1) / nf;
        const pt = (s, t) => P((-A + 2 * A * s) * (1 - t) + (-r + 2 * r * s) * t, side * B * (1 - t), t, corner(s));
        m.quad(pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1), col, [kk(t0), kk(t0), kk(t1), kk(t1)]);
      }
      for (let j = 0; j < ne; j++) {
        const s0 = j / ne, s1 = (j + 1) / ne;
        const pt = (s, t) => P(side * (A * (1 - t) + r * t), (-B + 2 * B * s) * (1 - t), t, corner(s));
        m.quad(pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1), col, [kk(t0), kk(t0), kk(t1), kk(t1)]);
      }
    }
  }
  if (ridge && r > 0.01) {
    const rh = Math.max(0.018, h * 0.12), rw = Math.max(0.012, h * 0.08);
    if (swap) box(m, cx - rw, y + h - rh * 0.4, cz - r - rw, cx + rw, y + h + rh, cz + r + rw, ridge);
    else box(m, cx - r - rw, y + h - rh * 0.4, cz - rw, cx + r + rw, y + h + rh, cz + rw, ridge);
  }
}
// 重檐下层一圈檐：外沿半宽 a×b 在 y，收到 ai×bi 在 y+h（贴着上层墙身）
function skirt(m, cx, y, cz, a, b, ai, bi, h, col, lift = 0) {
  const corner = (s) => Math.pow(Math.abs(2 * s - 1), 4);
  const E = [[[-a, b], [a, b], [-ai, bi], [ai, bi]], [[a, b], [a, -b], [ai, bi], [ai, -bi]], [[a, -b], [-a, -b], [ai, -bi], [-ai, -bi]], [[-a, -b], [-a, b], [-ai, -bi], [-ai, bi]]];
  const nt = FAR ? 1 : 2, ns = FAR ? 2 : 3;
  for (const [o0, o1, i0, i1] of E) {
    for (let i = 0; i < nt; i++) {
      for (let j = 0; j < ns; j++) {
        const pt = (s, t) => {
          const ox = o0[0] + (o1[0] - o0[0]) * s, oz = o0[1] + (o1[1] - o0[1]) * s, ix = i0[0] + (i1[0] - i0[0]) * s, iz = i0[1] + (i1[1] - i0[1]) * s;
          return [cx + ox + (ix - ox) * t, y + h * Math.pow(t, 1.3) + lift * corner(s) * (1 - t) * (1 - t), cz + oz + (iz - oz) * t];
        };
        const t0 = i / nt, t1 = (i + 1) / nt, s0 = j / ns, s1 = (j + 1) / ns;
        m.quad(pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1), col, [0.86, 0.86, 1, 1]);
      }
    }
  }
}
// 两坡顶（悬山）：檐口 y，脊沿 x，半长 a（含出山）、半深 b（含出檐），高 h；两山墙三角用墙色，落在 x = ±wa
function gableRoof(m, cx, y, cz, a, b, h, col, wall, wa, wb, bent = false) {
  for (const side of [1, -1]) {
    const P = (u, t) => [cx + u, y + h * Math.pow(t, 1.25), cz + side * b * (1 - t)];
    if (bent) {                                 // 大些的屋顶两截，看得出下凹；民居一截就够（太小看不出，省面）
      m.quad(P(-a, 0), P(a, 0), P(a, 0.5), P(-a, 0.5), col, [0.86, 0.86, 0.94, 0.94]);
      m.quad(P(-a, 0.5), P(a, 0.5), P(a, 1), P(-a, 1), col, [0.94, 0.94, 1, 1]);
    } else m.quad(P(-a, 0), P(a, 0), P(a, 1), P(-a, 1), col, [0.86, 0.86, 1, 1]);
  }
  for (const sx of [-1, 1]) m.tri([cx + sx * wa, y, cz + wb], [cx + sx * wa, y, cz - wb], [cx + sx * wa, y + h * 0.96, cz], wall);
}
// 民居：宽 w（沿脊）深 d，墙高 wh；rot 横置（厢房，脊南北向）
function house(m, x, z, w, d, wh, wall, roof, rot = false, y0 = -0.5) {
  m.push(x, 0, z, rot ? Math.PI / 2 : 0);
  box(m, -w / 2, y0, -d / 2, w / 2, wh, d / 2, wall, { faces: 'nsew' });
  gableRoof(m, 0, wh, 0, w / 2 + 0.025, d / 2 + 0.035, d * 0.42, roof, wall, w / 2, d / 2);
  m.pop();
}
// 楼阁：台顶 y 上一座朱柱楼身（半宽 a×b、高 bh），tiers 重檐；roof 瓦色
function pavilion(m, x, y, z, a, b, bh, tiers, roof, { body = C.red, lift = 0.03, ridge = C.tileDark } = {}) {
  box(m, x - a, y, z - b, x + a, y + bh, z + b, body, { faces: 'nsew' });
  const o = Math.max(0.05, a * 0.28);
  if (tiers >= 2) {
    skirt(m, x, y + bh * 0.42, z, a + o, b + o, a, b, Math.min(a, b) * 0.32, roof, lift * 0.8);
    box(m, x - a * 0.78, y + bh, z - b * 0.78, x + a * 0.78, y + bh * 1.5, z + b * 0.78, body, { faces: 'nsew' });
    hipRoof(m, x, y + bh * 1.5, z, a * 0.78 + o, b * 0.78 + o, Math.max(a, b) * 0.52, roof, { lift, ridge });
  } else {
    hipRoof(m, x, y + bh, z, a + o, b + o, Math.max(a, b) * 0.56, roof, { lift, ridge });
  }
}
// 门洞：在 z 那一面（朝 +z）上开一个圭形的黑洞
function archway(m, x, y0, z, w, h) {
  m.quad([x - w / 2, y0, z], [x + w / 2, y0, z], [x + w / 2, y0 + h * 0.72, z], [x - w / 2, y0 + h * 0.72, z], C.hole);
  m.tri([x - w / 2, y0 + h * 0.72, z], [x + w / 2, y0 + h * 0.72, z], [x, y0 + h, z], C.hole);
}
// 城墙一圈（方城，外沿半宽 hw）：墙高 h、厚 t；crenel>0 外沿一排雉堞（间距）。四面通长，墙往地下多伸一截
function wallRing(m, hw, h, t, col, top, crenel) {
  const D = -1.0;
  box(m, -hw, D, hw - t, hw, h, hw, col, { top });
  box(m, -hw, D, -hw, hw, h, -hw + t, col, { top });
  box(m, -hw, D, -hw + t, -hw + t, h, hw - t, col, { top, faces: 'ewt' });
  box(m, hw - t, D, -hw + t, hw, h, hw - t, col, { top, faces: 'ewt' });
  if (crenel > 0 && !FAR) {
    const mw = crenel * 0.42, mh = Math.max(0.045, h * 0.13), md = Math.min(0.06, t * 0.35);
    for (let i = 0; i < 4; i++) {
      m.push(0, 0, 0, i * Math.PI / 2);
      for (let x = -hw + crenel * 0.6; x < hw - crenel * 0.4; x += crenel) box(m, x - mw / 2, h, hw - md, x + mw / 2, h + mh, hw, col, { top, faces: 'snt' });
      m.pop();
    }
  }
}
// 断墙（残城）：每面切成几截，丢掉一些，留下的高低参差，墙头焦黑
function brokenWalls(m, r, hw, h, t, col, top) {
  for (let i = 0; i < 4; i++) {
    m.push(0, 0, 0, i * Math.PI / 2);
    const n = 6;
    for (let k = 0; k < n; k++) {
      if (r() < 0.36) continue;
      const x0 = -hw + (2 * hw) * k / n, x1 = -hw + (2 * hw) * (k + 1) / n - 0.04;
      const hh = h * (0.35 + 0.65 * r());
      box(m, x0, -1, hw - t, x1, hh, hw, col, { top: C.burnt });
      for (let q = 0; q < 2; q++) { const rx = x0 + r() * (x1 - x0); box(m, rx - 0.05, -0.1, hw + 0.04 + r() * 0.12, rx + 0.05, 0.05 + r() * 0.04, hw + 0.14 + r() * 0.12, top); }
    }
    m.pop();
  }
}
// 城门（门朝 +z，在 z = zf 那道墙上）：墩台宽 gw、伸出墙外一点；城楼 tiers 重檐，0 只开门不起楼
function gate(m, zf, h, t, gw, tiers, wall, wallTop, roof) {
  const out = 0.06, y1 = h + 0.03;
  box(m, -gw / 2, -1, zf - t - out, gw / 2, y1, zf + out, wall, { top: wallTop });
  archway(m, 0, 0, zf + out + 0.004, gw * 0.3, h * 0.62);
  if (tiers > 0) {
    const a = gw * 0.38, b = Math.max(0.1, (t + out * 2) * 0.42);
    pavilion(m, 0, y1, zf - t / 2, a, b, Math.max(0.12, gw * 0.24), tiers, roof);
  }
}
// 瓮城：城门外一圈小城（门朝 +z），深 dep、半宽 bw；arrow 正面起一座箭楼（高墙身、一排排黑箭窗、大顶）
function barbican(m, zf, h, t, bw, dep, wall, wallTop, roof, arrow) {
  const hh = h * 0.94, t2 = t * 0.85;
  box(m, -bw, -1, zf + dep - t2, bw, hh, zf + dep, wall, { top: wallTop });
  box(m, -bw, -1, zf, -bw + t2, hh, zf + dep - t2, wall, { top: wallTop, faces: 'ewt' });
  box(m, bw - t2, -1, zf, bw, hh, zf + dep - t2, wall, { top: wallTop, faces: 'ewt' });
  if (arrow) {
    const aw = bw * 0.78, ad = t2 * 0.7, ah = h * 0.55, y = hh;
    box(m, -aw, y, zf + dep - t2 / 2 - ad, aw, y + ah, zf + dep - t2 / 2 + ad, C.stone, { faces: 'nsew' });
    for (let row = 0; row < 2; row++) for (let k = 0; k < 6; k++) {
      const x = -aw + aw * 2 * (k + 0.5) / 6, yy = y + ah * (0.3 + row * 0.38);
      m.quad([x - 0.025, yy, zf + dep - t2 / 2 + ad + 0.003], [x + 0.025, yy, zf + dep - t2 / 2 + ad + 0.003], [x + 0.025, yy + 0.04, zf + dep - t2 / 2 + ad + 0.003], [x - 0.025, yy + 0.04, zf + dep - t2 / 2 + ad + 0.003], C.hole);
    }
    hipRoof(m, 0, y + ah, zf + dep - t2 / 2, aw + 0.07, ad + 0.08, 0.17, roof, { lift: 0.03, ridge: C.tileDark });
  } else {
    archway(m, 0, 0, zf + dep + 0.004, bw * 0.4, h * 0.55);
  }
}
// 角楼：城角上一座方台小楼
function cornerTower(m, x, z, h, t, wall, wallTop, roof) {
  const s = t * 0.75 + 0.05;
  box(m, x - s, -1, z - s, x + s, h + 0.05, z + s, wall, { top: wallTop });
  pavilion(m, x, h + 0.05, z, s * 0.62, s * 0.62, 0.09, 1, roof, { lift: 0.025, ridge: null });
}
// 鼓楼、钟楼：方台（南北穿门洞）上一座重檐楼
function drumTower(m, x, z, s, roof) {
  box(m, x - s, -0.5, z - s, x + s, s * 0.95, z + s, C.stone, { top: C.stoneTop });
  archway(m, x, 0, z + s + 0.004, s * 0.5, s * 0.6);
  pavilion(m, x, s * 0.95, z, s * 0.66, s * 0.56, s * 0.5, 2, roof);
}
// 塔：levels 级，底宽 w，越往上越窄，各级一道薄檐，顶上一根刹
function pagoda(m, x, z, levels, w, body = C.plaster2, roof = C.tile) {
  box(m, x - w * 0.7, -0.4, z - w * 0.7, x + w * 0.7, 0.05, z + w * 0.7, C.stoneTop);
  let y = 0.05, ww = w;
  for (let i = 0; i < levels; i++) {
    const bh = (i === 0 ? 0.17 : 0.105) * (w / 0.26);
    box(m, x - ww / 2, y, z - ww / 2, x + ww / 2, y + bh, z + ww / 2, body, { faces: 'nsew' });
    y += bh;
    hipRoof(m, x, y - 0.004, z, ww / 2 + 0.065, ww / 2 + 0.065, 0.045, roof, { lift: 0.02, bands: 2 });
    y += 0.03;
    ww *= 0.9;
  }
  box(m, x - 0.012, y, z - 0.012, x + 0.012, y + 0.17, z + 0.012, C.pole, { faces: 'nsew' });
}
// 殿：台基上朱墙一座，大顶；y 台基落在多高（皇城三大殿坐在白石台上）
function hall(m, x, z, a, b, bh, roof, { base = C.stoneTop, body = C.red, tiers = 1, lift = 0.035, y = 0 } = {}) {
  box(m, x - a - 0.06, y - 0.4, z - b - 0.06, x + a + 0.06, y + 0.06, z + b + 0.06, base);
  pavilion(m, x, y + 0.06, z, a, b, bh, tiers, roof, { body, lift });
}
// 一圈矮院墙（衙署、寺、皇城用）：半宽 a×b、高 hh；南面留门（gateW）
function courtyard(m, x, z, a, b, hh, t, col, top, gateW = 0) {
  box(m, x - a, -0.4, z - b, x + a, hh, z - b + t, col, { top });
  box(m, x - a, -0.4, z - b + t, x - a + t, hh, z + b, col, { top, faces: 'ewt' });
  box(m, x + a - t, -0.4, z - b + t, x + a, hh, z + b, col, { top, faces: 'ewt' });
  if (gateW > 0) {
    box(m, x - a, -0.4, z + b - t, x - gateW / 2, hh, z + b, col, { top });
    box(m, x + gateW / 2, -0.4, z + b - t, x + a, hh, z + b, col, { top });
  } else box(m, x - a, -0.4, z + b - t, x + a, hh, z + b, col, { top });
}
// 树：一截干、一团八面体的冠
function tree(m, x, z, s, col = C.leaf) {
  if (FAR) return;
  box(m, x - 0.012 * s, -0.2, z - 0.012 * s, x + 0.012 * s, 0.07 * s, z + 0.012 * s, C.pole, { faces: 'nsew' });
  const y = 0.07 * s + 0.08 * s, r = 0.09 * s, top = [x, y + r * 1.25, z], bot = [x, y - r * 0.9, z];
  const ring = [[x + r, y, z], [x, y, z + r], [x - r, y, z], [x, y, z - r]];
  for (let i = 0; i < 4; i++) { const p = ring[i], q = ring[(i + 1) % 4]; m.tri(p, q, top, col); m.tri(q, p, bot, tint(col, 0.8)); }
}
// 烟：几团八面体，越往上越大越淡；s 整股的大小（小景用小一号的）
function smoke(m, x, z, y0, n = 4, s = 1) {
  for (let i = 0; i < n; i++) {
    const r = (0.07 + i * 0.045) * s, cx = x + i * 0.05 * s, cy = y0 + i * 0.2 * s + r, c = tint(C.smoke, 0.82 + i * 0.07);
    const top = [cx, cy + r, z], bot = [cx, cy - r, z], ring = [[cx + r, cy, z], [cx, cy, z + r], [cx - r, cy, z], [cx, cy, z - r]];
    for (let k = 0; k < 4; k++) { const p = ring[k], q = ring[(k + 1) % 4]; m.tri(p, q, top, c); m.tri(q, p, bot, c); }
  }
}
// 旗：一根杆、一面旗（big 大纛：杆顶垂一束黑缨）
function flag(m, x, z, h, col = C.banner, big = false) {
  const pw = big ? 0.02 : 0.013;
  box(m, x - pw, -0.2, z - pw, x + pw, h, z + pw, C.pole, { faces: 'nsew' });
  if (big) {
    const y = h - 0.02, r = 0.05;
    for (let k = 0; k < 4; k++) { const a0 = k * Math.PI / 2, a1 = a0 + Math.PI / 2; m.tri([x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x, y - 0.2, z], C.black); }
  } else {
    m.quad([x, h - 0.02, z], [x + 0.17, h - 0.045, z], [x + 0.17, h - 0.13, z], [x, h - 0.11, z], col);
  }
}
// 毡帐：半径 r、高 hh；圆壁、穹顶、顶上一圈天窗、南面黑门
function yurt(m, x, z, r, hh, felt = C.felt) {
  const n = 10, wallH = hh * 0.48, ring = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ring.push([Math.cos(a), Math.sin(a)]); }
  const dark = tint(felt, 0.82);
  for (let i = 0; i < n; i++) {
    const [c0, s0] = ring[i], [c1, s1] = ring[(i + 1) % n];
    m.quad([x + c0 * r, -0.3, z + s0 * r], [x + c1 * r, -0.3, z + s1 * r], [x + c1 * r, wallH, z + s1 * r], [x + c0 * r, wallH, z + s0 * r], felt);
    const rr = r * 0.2, top = hh * 0.98;
    m.quad([x + c0 * r, wallH, z + s0 * r], [x + c1 * r, wallH, z + s1 * r], [x + c1 * rr, top, z + s1 * rr], [x + c0 * rr, top, z + s0 * rr], dark);
    m.tri([x + c0 * rr, top, z + s0 * rr], [x + c1 * rr, top, z + s1 * rr], [x, top + 0.004, z], C.feltDark);
  }
  m.quad([x - r * 0.18, 0, z + r + 0.004], [x + r * 0.18, 0, z + r + 0.004], [x + r * 0.18, wallH * 0.82, z + r + 0.004], [x - r * 0.18, wallH * 0.82, z + r + 0.004], C.hole);
}
// 木栅：沿一圈折线（闭合），一根根尖头木排成锯齿，无厚
function palisade(m, pts, hh, tooth = 0.11) {
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / tooth));
    for (let k = 0; k < n; k++) {
      const a = k / n, b = (k + 1) / n, ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a, bx = x0 + (x1 - x0) * b, bz = z0 + (z1 - z0) * b;
      const hk = hh * (0.9 + 0.1 * Math.sin(k * 2.3 + i));
      m.quad([ax, -0.4, az], [bx, -0.4, bz], [bx, hk, bz], [ax, hk, az], C.wood);
      m.tri([ax, hk, az], [bx, hk, bz], [(ax + bx) / 2, hk + tooth * 0.85, (az + bz) / 2], C.woodLight);
    }
  }
}
// 吊脚楼：四根柱架起楼身，陡草顶
function stilt(m, x, z, w, d, raise, wh, rot = 0) {
  m.push(x, 0, z, rot);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(m, sx * w / 2 - 0.015, -0.3, sz * d / 2 - 0.015, sx * w / 2 + 0.015, raise, sz * d / 2 + 0.015, C.wood, { faces: 'nsew' });
  box(m, -w / 2, raise, -d / 2, w / 2, raise + wh, d / 2, C.woodLight);
  gableRoof(m, 0, raise + wh, 0, w / 2 + 0.05, d / 2 + 0.07, d * 0.75, C.thatch, C.woodLight, w / 2, d / 2);
  m.pop();
}
// 帆船：吃水线 y=0，长 L，头朝 +x；一张篷帆（默认褐红，朝鲜那样的白布帆、草席帆另给颜色）
function junk(m, x, z, yaw, L, sail = C.sail) {
  m.push(x, 0, z, yaw);
  const b = L * 0.17, hh = L * 0.12;
  const S = [[-L / 2, b * 0.7], [L * 0.32, b], [L / 2, 0], [L * 0.32, -b], [-L / 2, -b * 0.7]];
  for (let i = 0; i < S.length; i++) {
    const [x0, z0] = S[i], [x1, z1] = S[(i + 1) % S.length];
    m.quad([x0 * 0.82, -0.05, z0 * 0.6], [x1 * 0.82, -0.05, z1 * 0.6], [x1, hh, z1], [x0, hh, z0], C.hull);
  }
  for (let i = 1; i < S.length - 1; i++) m.tri([S[0][0], hh, S[0][1]], [S[i][0], hh, S[i][1]], [S[i + 1][0], hh, S[i + 1][1]], C.woodLight);
  box(m, -L * 0.5, hh, -b * 0.6, -L * 0.3, hh + L * 0.12, b * 0.6, C.hull);
  box(m, -0.012, hh, -0.012, 0.012, hh + L * 0.95, 0.012, C.pole, { faces: 'nsew' });
  // 篷帆斜着张（与船身成三十来度），从哪边看都看得见帆面
  m.push(0, 0, 0, 0.6);
  m.quad([-L * 0.02, hh + L * 0.18, 0], [L * 0.4, hh + L * 0.22, 0], [L * 0.36, hh + L * 0.9, 0], [-L * 0.02, hh + L * 0.92, 0], sail);
  for (let k = 1; k < 4; k++) { const yy = hh + L * (0.18 + 0.18 * k); m.quad([-L * 0.02, yy, 0.002], [L * 0.39, yy + 0.01, 0.002], [L * 0.39, yy + 0.022, 0.002], [-L * 0.02, yy + 0.012, 0.002], C.hull); }
  m.pop();
  m.pop();
}

// ---------- 城内 ----------
// 一片街坊：矩形里一排排民居（坐北朝南为主，间有厢房横置），keep 里的方块留空（衙署、寺、塔、鼓楼）。
// look：别处的样子（towns3d-east.js）换墙色 walls、瓦色 roofs，build(m, 心x, 心z, 宽, 深, 墙高, 墙色, 瓦色, 横置, r) 换盖什么样的屋（不给照盖 house）
function quarter(m, r, x0, z0, x1, z1, density, keep, burnt = false, look = null) {
  const walls = burnt ? [C.burnt, C.ash] : (look && look.walls) || [C.plaster, C.plaster, C.plaster2, C.earthHouse];
  const roofs = burnt ? [C.black, C.burnt] : (look && look.roofs) || [C.tile, C.tile, C.tileLight, C.tileDark];
  const build = (look && look.build) || house;
  let z = z0 + 0.02;
  while (z + 0.2 < z1) {
    const rowD = 0.19 + r() * 0.07;
    let x = x0 + 0.015 + r() * 0.04;
    while (x + 0.2 < x1) {
      const w = FAR ? 0.45 + r() * 0.45 : 0.2 + r() * 0.2, xe = Math.min(x + w, x1 - 0.015);
      const hit = keep.some(([a, b, c, d]) => xe > a && x < c && z + rowD > b && z < d);
      if (!hit && r() < density) {
        const side = !FAR && r() < 0.2, cx = (x + xe) / 2, cz = z + rowD / 2;
        const hw = side ? Math.min(rowD * 0.92, 0.26) : xe - x, hd = side ? Math.min(xe - x, 0.2) : rowD;
        if (burnt && r() < 0.45) box(m, cx - hw / 2, -0.5, cz - hd / 2, cx + hw / 2, 0.05 + r() * 0.05, cz + hd / 2, pick(r, walls));
        else {
          const wh = 0.095 + r() * 0.035, wall = pick(r, walls), roof = pick(r, roofs);
          if (build === house) house(m, cx, cz, hw, hd, wh, wall, roof, side);
          else build(m, cx, cz, hw, hd, wh, wall, roof, side, r);
        }
      } else if (!hit && !burnt && r() < 0.3) tree(m, (x + xe) / 2, z + rowD / 2, 0.8 + r() * 0.5);
      x = xe + 0.02 + r() * 0.035;
    }
    z += rowD + 0.035 + r() * 0.035;
  }
}
// 衙署：一圈院墙、一座门屋、一座大堂
function yamen(m, x, z, s) {
  courtyard(m, x, z, 0.42 * s, 0.34 * s, 0.1, 0.04, C.palace, C.tileDark, 0.18 * s);
  hall(m, x, z - 0.06 * s, 0.24 * s, 0.13 * s, 0.11, C.tile);
  house(m, x, z + 0.24 * s, 0.2 * s, 0.1 * s, 0.08, C.red, C.tile);
}
// 寺：一圈黄墙、一座大殿、殿后一座塔
function temple(m, x, z, s, levels = 5) {
  courtyard(m, x, z, 0.4 * s, 0.4 * s, 0.09, 0.04, C.ochre, C.tile, 0.16 * s);
  hall(m, x, z + 0.06 * s, 0.22 * s, 0.13 * s, 0.11, C.tile, { lift: 0.04 });
  pagoda(m, x, z - 0.24 * s, levels, 0.16 * s);
}
// 关厢：城门外沿大路两侧的铺面（门朝 +z 的框里，从 z0 往外长 len）
function suburb(m, r, z0, len, density = 0.85) {
  quarter(m, r, -0.95, z0, -0.14, z0 + len, density, []);
  quarter(m, r, 0.14, z0, 0.95, z0 + len, density, []);
  flat(m, -0.12, z0 - 0.1, 0.12, z0 + len, 0.012, C.street);
}

const YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
// 一座方城（四档、残城、京城外城共用）。o：hw 半宽、h 墙高、t 墙厚、earth 土墙、crenel 雉堞间距、gates 开门的面、tiers 各门城楼重檐数、
// corners 角楼、barb 瓮城的面、arrow 起箭楼的面、moat 护城河、density 民居疏密、drum/bell 鼓楼钟楼、yamenAt/templeAt/pagodaAt 落在哪个象限、
// suburbs 关厢的面、broken 残破、keep 另外留空的方块
function walledCity(m, r, o) {
  const { hw, h, t } = o;
  const wall = o.earth ? C.earth : C.stone, wallTop = o.earth ? C.earthTop : C.stoneTop, roof = C.tile;
  const inner = hw - t;
  flat(m, -inner, -inner, inner, inner, 0.02, o.broken ? C.ash : C.ground);
  const st = o.street ?? 0.14;
  flat(m, -st, -inner, st, inner, 0.028, C.street);
  if (o.gates.includes('e') || o.gates.includes('w')) flat(m, -inner, -st, inner, st, 0.028, C.street);
  const gw = o.gateW ?? Math.max(0.42, hw * 0.24), barbD = gw * 0.6;
  // 护城河贴着城墙绕一圈，瓮城探进河里，门前各一道桥
  const moatA = hw + 0.14, moatB = moatA + 0.32;
  if (o.moat) {
    const a = moatA, b = moatB;
    flat(m, -b, a, b, b, 0.012, C.water); flat(m, -b, -b, b, -a, 0.012, C.water);
    flat(m, -b, -a, -a, a, 0.012, C.water); flat(m, a, -a, b, a, 0.012, C.water);
    for (const g of o.gates) { m.push(0, 0, 0, YAW[g]); flat(m, -0.13, a - 0.02, 0.13, b + 0.02, 0.02, C.stoneTop); m.pop(); }
  }
  if (o.broken) brokenWalls(m, r, hw, h, t, wall, C.burnt);
  else wallRing(m, hw, h, t, wall, wallTop, o.crenel || 0);
  for (const g of o.gates) {
    m.push(0, 0, 0, YAW[g]);
    const barb = !!(o.barb && o.barb.includes(g));
    if (o.broken) {
      box(m, -gw / 2, -1, hw - t - 0.06, gw / 2, h * 0.7, hw + 0.06, wall, { top: C.burnt });
      archway(m, 0, 0, hw + 0.064, gw * 0.3, h * 0.55);
      for (const sx of [-1, 1]) box(m, sx * gw * 0.28 - 0.02, h * 0.7, hw - t / 2 - 0.02, sx * gw * 0.28 + 0.02, h * 0.7 + 0.14, hw - t / 2 + 0.02, C.black);
    } else gate(m, hw, h, t, gw, (o.tiers && o.tiers[g]) || 0, wall, wallTop, roof);
    if (barb) {
      flat(m, -gw * 0.95, hw + 0.05, gw * 0.95, hw + 0.06 + barbD, 0.022, C.ground);
      barbican(m, hw + 0.06, h, t, gw * 0.95, barbD, wall, wallTop, roof, o.arrow && o.arrow.includes(g));
    }
    if (o.suburbs && o.suburbs.includes(g)) suburb(m, r, Math.max(o.moat ? moatB + 0.06 : hw + 0.16, hw + 0.12 + (barb ? barbD : 0)), o.suburbLen || 0.9);
    m.pop();
  }
  if (o.corners) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) cornerTower(m, sx * (hw - t / 2), sz * (hw - t / 2), h, t, wall, wallTop, roof);
  // 城内：十字街口鼓楼（往北钟楼），衙署、寺、塔各占一个象限，其余民居
  const keep = (o.keep || []).slice();
  const Q = (q, s) => { const qx = q.includes('w') ? -1 : 1, qz = q.includes('n') ? -1 : 1; return [qx * inner * 0.52, qz * inner * 0.52 * (s || 1)]; };
  if (o.drum) {
    const s = o.drum;
    drumTower(m, 0, 0, s, roof);
    keep.push([-s - 0.05, -s - 0.05, s + 0.05, s + 0.05]);
    if (o.bell) { drumTower(m, 0, -inner * 0.42, s * 0.8, roof); keep.push([-s, -inner * 0.42 - s, s, -inner * 0.42 + s]); }
  }
  if (o.yamenAt) { const [x, z] = Q(o.yamenAt), s = o.yamenS || 1; yamen(m, x, z, s); keep.push([x - 0.46 * s, z - 0.38 * s, x + 0.46 * s, z + 0.38 * s]); }
  if (o.templeAt) { const [x, z] = Q(o.templeAt), s = o.templeS || 1; temple(m, x, z, s, o.templeLevels || 5); keep.push([x - 0.44 * s, z - 0.44 * s, x + 0.44 * s, z + 0.44 * s]); }
  if (o.pagodaAt) { const [x, z] = Q(o.pagodaAt), lv = o.pagodaLevels || 7; pagoda(m, x, z, lv, 0.26); keep.push([x - 0.26, z - 0.26, x + 0.26, z + 0.26]); }
  const g0 = st + 0.03;
  for (const [x0, z0, x1, z1] of [[-inner, -inner, -g0, -g0], [g0, -inner, inner, -g0], [-inner, g0, -g0, inner], [g0, g0, inner, inner]]) {
    quarter(m, r, x0 + 0.03, z0 + 0.03, x1 - 0.02, z1 - 0.02, o.density, keep, !!o.broken);
  }
  if (o.broken) { smoke(m, -inner * 0.35, inner * 0.1, 0.1, 4); smoke(m, inner * 0.4, -inner * 0.3, 0.05, 3); }
}

// ---------- 各样模型 ----------
// 城郭四档：小城、府城、大府、都会，各两种（v 换街巷、换衙署寺塔的象限与门）。各样搭完返回城墙外沿半宽（摆地标、定多大开始显都按它）
function town(m, v) {
  walledCity(m, rng(101 + v), {
    hw: 1.45, h: 0.3, t: 0.15, earth: true, gates: v ? ['s', 'e'] : ['s', 'n'], tiers: { s: 1 }, density: 0.8, street: 0.12,
    yamenAt: v ? 'nw' : 'ne', yamenS: 0.85
  });
  return 1.45;
}
function city(m, v) {
  walledCity(m, rng(201 + v), {
    hw: 1.95, h: 0.4, t: 0.18, crenel: 0.21, gates: ['s', 'n', 'e', 'w'], tiers: { s: 1, n: 1, e: 1, w: 1 }, density: 0.88,
    drum: 0.23, yamenAt: v ? 'ne' : 'nw', templeAt: v ? 'sw' : null, templeS: 0.85
  });
  return 1.95;
}
function grand(m, v) {
  walledCity(m, rng(301 + v), {
    hw: 2.45, h: 0.48, t: 0.2, crenel: 0.21, gates: ['s', 'n', 'e', 'w'], tiers: { s: 2, n: 1, e: 1, w: 1 }, corners: true,
    barb: v ? ['s', 'n'] : ['s'], density: 0.9, drum: 0.25, bell: true, yamenAt: v ? 'ne' : 'nw', pagodaAt: v ? 'sw' : 'se', pagodaLevels: 5,
    suburbs: ['s'], suburbLen: 0.8
  });
  return 2.45;
}
function metro(m, v) {
  walledCity(m, rng(401 + v), {
    hw: 3.0, h: 0.56, t: 0.22, crenel: 0.22, gates: ['s', 'n', 'e', 'w'], tiers: { s: 2, n: 2, e: 2, w: 2 }, corners: true,
    barb: ['s', 'n', 'e', 'w'], arrow: ['s'], moat: true, density: 0.93, drum: 0.28, bell: true, yamenAt: v ? 'ne' : 'nw', yamenS: 1.15,
    templeAt: v ? 'sw' : 'se', templeS: 1.1, templeLevels: 3, pagodaAt: v ? 'se' : 'sw', pagodaLevels: 7, suburbs: v ? ['s', 'w'] : ['s', 'e'], suburbLen: 1.0
  });
  return 3.0;
}
// 京城：外城（四门重檐、四面瓮城、正南箭楼、护城河），城中偏北一座皇城——朱墙黄瓦，午门、三大殿坐在白石台上
function capital(m) {
  const hw = 3.75, inner = 1.4, cz = -0.35;
  walledCity(m, rng(501), {
    hw, h: 0.62, t: 0.25, crenel: 0.23, gates: ['s', 'n', 'e', 'w'], tiers: { s: 2, n: 2, e: 2, w: 2 }, corners: true,
    barb: ['s', 'n', 'e', 'w'], arrow: ['s', 'n'], moat: true, density: 0.93, gateW: 0.95, suburbs: ['s'], suburbLen: 1.2,
    keep: [[-inner - 0.25, cz - inner - 0.25, inner + 0.25, cz + inner + 0.25]]
  });
  flat(m, -inner, cz - inner, inner, cz + inner, 0.032, C.pave);
  courtyard(m, 0, cz, inner, inner, 0.2, 0.07, C.palace, C.gold, 0.0);
  // 午门：南墙正中一座黄瓦门楼
  box(m, -0.45, -0.4, cz + inner - 0.1, 0.45, 0.24, cz + inner + 0.08, C.palace, { top: C.palace });
  archway(m, 0, 0, cz + inner + 0.084, 0.14, 0.17);
  pavilion(m, 0, 0.24, cz + inner - 0.01, 0.36, 0.09, 0.13, 2, C.gold, { lift: 0.035 });
  // 三大殿：白石三层台，前殿最大
  mound(m, 0, cz - 0.15, 0.62, 0.95, 0.52, 0.85, -0.4, 0.09, C.marble);
  hall(m, 0, cz + 0.42, 0.42, 0.19, 0.15, C.gold, { base: C.marble, body: C.palace, tiers: 2, lift: 0.045, y: 0.09 });
  hall(m, 0, cz - 0.06, 0.18, 0.15, 0.1, C.gold, { base: C.marble, body: C.palace, y: 0.09 });
  hall(m, 0, cz - 0.5, 0.32, 0.15, 0.12, C.gold, { base: C.marble, body: C.palace, lift: 0.04, y: 0.09 });
  // 后宫一路小殿、两厢
  for (const z of [cz - 0.95, cz - 1.15]) hall(m, 0, z, 0.22, 0.07, 0.08, C.gold, { base: C.marble, body: C.palace });
  for (const sx of [-1, 1]) for (const z of [cz + 0.4, cz - 0.2, cz - 0.8]) house(m, sx * 0.92, z, 0.36, 0.16, 0.09, C.palace, C.gold, true);
  tree(m, -1.15, cz - 1.15, 1.1); tree(m, 1.15, cz - 1.15, 1.1); tree(m, -1.15, cz + 1.0, 1.0); tree(m, 1.15, cz + 1.0, 1.0);
  return hw;
}
// 残城：府城那样的方城，墙断成几截、门楼塌了只剩焦柱、屋舍焦黑一半没了顶，两股烟、几株枯树
function ruin(m) {
  walledCity(m, rng(601), { hw: 1.95, h: 0.38, t: 0.18, gates: ['s', 'n', 'e', 'w'], density: 0.7, broken: true });
  for (const [x, z] of [[-1.2, 0.9], [1.1, -1.0], [0.6, 1.2]]) {
    box(m, x - 0.012, -0.2, z - 0.012, x + 0.012, 0.22, z + 0.012, C.black, { faces: 'nsew' });
    box(m, x - 0.09, 0.15, z - 0.01, x + 0.0, 0.17, z + 0.01, C.black, { faces: 'nsewt' });
  }
  return 1.95;
}
// 帐：几顶毡帐、一杆小旗
function yurtS(m) {
  const r = rng(701);
  for (const [x, z, s] of [[-0.45, 0.2, 0.34], [0.38, 0.32, 0.27], [0.05, -0.42, 0.3], [0.62, -0.28, 0.22], [-0.7, -0.4, 0.22]]) yurt(m, x, z, s, s * 1.12, r() < 0.3 ? C.feltDark : C.felt);
  flag(m, 0.05, 0.05, 0.62);
  return 0.95;
}
// 牙帐：正中一座金顶大帐，四围一圈毡帐，大纛
function yurtL(m) {
  const r = rng(702);
  yurt(m, 0, 0, 0.62, 0.66, C.feltGold);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.2; yurt(m, Math.cos(a) * 1.45, Math.sin(a) * 1.25, 0.24 + r() * 0.08, 0.3, r() < 0.25 ? C.feltDark : C.felt); }
  flag(m, 0.0, 0.85, 1.25, C.black, true);
  flag(m, -0.75, 0.7, 0.7); flag(m, 0.75, 0.7, 0.7);
  return 1.75;
}
// 寨：一圈木栅，栅里两座吊脚楼、一株树
function stockS(m) {
  palisade(m, [[-1.25, -1.0], [1.25, -1.05], [1.35, 0.85], [0.0, 1.1], [-1.3, 0.9]], 0.3);
  stilt(m, -0.45, -0.25, 0.62, 0.36, 0.12, 0.17);
  stilt(m, 0.5, 0.15, 0.5, 0.32, 0.1, 0.15, Math.PI / 2);
  tree(m, 0.55, -0.6, 1.3, C.leafDark);
  return 1.35;
}
// 大寨：大一圈木栅，正中一座多重檐的鼓楼，四座吊脚楼
function stockL(m) {
  palisade(m, [[-1.8, -1.45], [1.8, -1.45], [1.85, 1.4], [-1.85, 1.4]], 0.36);
  box(m, -0.16, -0.3, -0.16, 0.16, 0.22, 0.16, C.woodLight);
  let y = 0.22, a = 0.36;
  for (let i = 0; i < 5; i++) { hipRoof(m, 0, y, 0, a, a, 0.09, C.tileDark, { lift: 0.03, bands: 2 }); box(m, -a * 0.45, y + 0.05, -a * 0.45, a * 0.45, y + 0.13, a * 0.45, C.woodLight, { faces: 'nsew' }); y += 0.12; a *= 0.82; }
  box(m, -0.012, y, -0.012, 0.012, y + 0.14, 0.012, C.pole, { faces: 'nsew' });
  stilt(m, -1.0, -0.75, 0.62, 0.36, 0.12, 0.18); stilt(m, 1.0, -0.7, 0.58, 0.34, 0.12, 0.17);
  stilt(m, -1.05, 0.75, 0.56, 0.34, 0.1, 0.16, Math.PI / 2); stilt(m, 1.0, 0.8, 0.6, 0.36, 0.12, 0.17);
  tree(m, -0.55, 1.05, 1.3, C.leafDark); tree(m, 0.6, -1.1, 1.2, C.leafDark);
  return 1.9;
}
// 市镇：一条小河东西穿镇，河上一座拱桥；南北一条街，两侧铺面挨着铺面，河边一座两层酒楼挑着酒旗；镇边几株树
function market(m) {
  const r = rng(801);
  flat(m, -1.15, -0.11, 1.15, 0.11, 0.012, C.water);
  flat(m, -0.1, -1.05, 0.1, 1.05, 0.016, C.street);
  for (const sx of [-1, 1]) {
    for (let z = -1.0; z < -0.2; z += 0.21) house(m, sx * 0.27, z + 0.1, 0.32, 0.19, 0.1 + r() * 0.03, pick(r, [C.plaster, C.plaster2, C.earthHouse]), pick(r, [C.tile, C.tileLight]), true);
    for (let z = 0.2; z < 0.95; z += 0.21) house(m, sx * 0.27, z + 0.1, 0.32, 0.19, 0.1 + r() * 0.03, pick(r, [C.plaster, C.plaster2, C.earthHouse]), pick(r, [C.tile, C.tileLight]), true);
    for (const z of [-0.7, -0.4, 0.45, 0.75]) if (r() < 0.75) house(m, sx * 0.62, z, 0.26, 0.2, 0.09, pick(r, [C.plaster, C.plaster2]), C.tile);
  }
  // 酒楼：两层，河边
  box(m, 0.44, -0.4, -0.42, 0.86, 0.13, -0.16, C.woodLight);
  box(m, 0.48, 0.13, -0.39, 0.82, 0.24, -0.19, C.woodLight, { faces: 'nsew' });
  skirt(m, 0.65, 0.13, -0.29, 0.25, 0.17, 0.17, 0.1, 0.04, C.tile, 0.015);
  gableRoof(m, 0.65, 0.24, -0.29, 0.22, 0.15, 0.1, C.tile, C.woodLight, 0.17, 0.1);
  flag(m, 0.4, -0.2, 0.5, C.banner);
  // 拱桥：桥面一道弧
  const N = 8;
  for (let i = 0; i < N; i++) {
    const z0 = -0.24 + 0.48 * i / N, z1 = -0.24 + 0.48 * (i + 1) / N, y0 = 0.02 + 0.13 * Math.sin(Math.PI * i / N), y1 = 0.02 + 0.13 * Math.sin(Math.PI * (i + 1) / N);
    m.quad([-0.1, y0, z0], [0.1, y0, z0], [0.1, y1, z1], [-0.1, y1, z1], C.stoneTop);
    for (const sx of [-0.1, 0.1]) m.quad([sx, y0 - 0.06, z0], [sx, y1 - 0.06, z1], [sx, y1 + 0.015, z1], [sx, y0 + 0.015, z0], C.stone);
  }
  for (const [x, z, s] of [[-0.95, 0.5, 1.2], [0.95, 0.6, 1.1], [-0.9, -0.6, 1.0], [0.95, -0.8, 1.2], [-0.55, 1.0, 1.0]]) tree(m, x, z, s);
  return 1.1;
}
// 港（近海）：岸上一座长仓、两间屋，木栈伸进海里，两只张帆的船泊着（栈桥、船贴海面，岸上随地面）；
// sea 为假时是河埠（不近海而建了港）：栈桥、船随地面
function port(m, sea = true) {
  house(m, -0.25, -0.62, 0.8, 0.3, 0.13, C.plaster2, C.tile);
  house(m, 0.55, -0.55, 0.36, 0.24, 0.11, C.plaster, C.tileLight, true);
  house(m, -0.7, -0.2, 0.3, 0.22, 0.1, C.plaster, C.tile);
  m.sea = sea;
  box(m, -0.09, -0.06, -0.3, 0.09, 0.03, 1.35, C.woodLight);
  for (let z = 0; z <= 1.3; z += 0.26) for (const sx of [-0.1, 0.1]) box(m, sx - 0.015, -0.4, z - 0.015, sx + 0.015, 0.04, z + 0.015, C.wood, { faces: 'nsew' });
  junk(m, 0.38, 0.8, Math.PI / 2 + 0.2, 0.64);
  junk(m, -0.36, 1.15, Math.PI / 2 - 0.15, 0.52);
  m.sea = false;
  flag(m, 0.12, -0.3, 0.5);
  return 0.8;
}

// ---------- 营造地标（府州名下真建了的营造，摆在城郭四周；归类见 model/settlement.js） ----------
// 每样比城郭小一圈（半宽一上下），一眼认得出是什么：书院门外泮池、石坊，院里讲堂、藏书楼；仓廒几排长廒带气楼、几座圆囤；
// 水利一道渠、一座闸房、一架水车、几方水田；工坊馒头窑、高烟囱冒烟、一座敞棚；堡高墙四角敌台、当中敌楼；烽燧一座高墩冒狼烟；
// 佛寺黄墙、重檐大殿后起七级塔；祠庙朱墙、门外木牌坊、院里戏台和古柏；驿有官道、马厩、马圈里的马；官署门前一堵照壁、两根旗杆；
// 在建的是一座没上全顶的屋架，围着脚手架、立着吊杆；石桥五孔跨着一湾水；半损的是一圈断墙、几根焦柱、一片塌顶。都坐北朝南（门朝 +z）。

// 松柏：一截干、三层六棱的尖冠，越往上越小
function pine(m, x, z, s, col = C.leafDark) {
  if (FAR) return;
  box(m, x - 0.012 * s, -0.2, z - 0.012 * s, x + 0.012 * s, 0.06 * s, z + 0.012 * s, C.pole, { faces: 'nsew' });
  for (const [y0, r, h, k] of [[0.05, 0.11, 0.15, 0.85], [0.13, 0.085, 0.13, 0.93], [0.21, 0.06, 0.12, 1]]) {
    const apex = [x, (y0 + h) * s, z], c = tint(col, k);
    for (let i = 0; i < 6; i++) {
      const a0 = i * Math.PI / 3, a1 = a0 + Math.PI / 3;
      m.tri([x + Math.cos(a0) * r * s, y0 * s, z + Math.sin(a0) * r * s], [x + Math.cos(a1) * r * s, y0 * s, z + Math.sin(a1) * r * s], apex, c);
    }
  }
}
// 一片水（或台面）：椭圆的一段扇面，心 x,z、半轴 rx×rz，从角 a0 到 a1（0 朝东、π/2 朝南）
function pool(m, x, z, rx, rz, y, col, a0 = 0, a1 = Math.PI * 2, n = 16) {
  for (let i = 0; i < n; i++) {
    const b0 = a0 + (a1 - a0) * i / n, b1 = a0 + (a1 - a0) * (i + 1) / n;
    m.tri([x, y, z], [x + Math.cos(b0) * rx, y, z + Math.sin(b0) * rz], [x + Math.cos(b1) * rx, y, z + Math.sin(b1) * rz], col);
  }
}
// 牌坊：四柱三间，立在 z 那条线上，半宽 w、明间柱高 h。给了 roof 是木牌楼（明间、次间各起一道庑殿顶），
// 没给是石坊（柱头各压一块石，书院的棂星门那样）
function paifang(m, x, z, w, h, post, roof = null) {
  const pw = 0.024, inner = w / 3;
  for (const px of [-w, -inner, inner, w]) {
    const ph = Math.abs(px) > inner + 1e-6 ? h * 0.78 : h;
    box(m, x + px - pw, -0.3, z - pw, x + px + pw, ph, z + pw, post);
    box(m, x + px - pw * 2.2, -0.05, z - pw * 2.2, x + px + pw * 2.2, 0.06, z + pw * 2.2, C.stoneTop);
    if (!roof) box(m, x + px - pw * 1.8, ph, z - pw * 1.4, x + px + pw * 1.8, ph + 0.03, z + pw * 1.4, C.stoneTop);
  }
  box(m, x - inner, h * 0.78, z - pw * 0.8, x + inner, h * 0.9, z + pw * 0.8, post);
  for (const sx of [-1, 1]) {
    const a = x + sx * inner, b = x + sx * w;
    box(m, Math.min(a, b), h * 0.58, z - pw * 0.8, Math.max(a, b), h * 0.68, z + pw * 0.8, post);
  }
  if (roof) {
    hipRoof(m, x, h, z, inner + 0.07, 0.065, 0.065, roof, { lift: 0.022, bands: 2, ridge: roof });
    for (const sx of [-1, 1]) hipRoof(m, x + sx * (w + inner) / 2, h * 0.78, z, (w - inner) / 2 + 0.05, 0.055, 0.05, roof, { lift: 0.018, bands: 2 });
  }
}
// 圆囤：八棱的身，尖草顶
function silo(m, x, z, r, h, wall = C.plaster2, roof = C.thatch) {
  const n = 8, R = r * 1.22;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    m.quad([x + c0 * r, -0.3, z + s0 * r], [x + c1 * r, -0.3, z + s1 * r], [x + c1 * r, h, z + s1 * r], [x + c0 * r, h, z + s0 * r], wall);
    m.tri([x + c0 * R, h - 0.02, z + s0 * R], [x + c1 * R, h - 0.02, z + s1 * R], [x, h + r * 1.05, z], roof);
  }
}
// 长廒：一座东西向的长仓（宽 w、深 d、墙高 wh），脊上一道气楼，南墙一排气窗
function barn(m, x, z, w, d, wh) {
  box(m, x - w / 2, -0.4, z - d / 2, x + w / 2, wh, z + d / 2, C.plaster2, { faces: 'nsew' });
  gableRoof(m, x, wh, z, w / 2 + 0.03, d / 2 + 0.04, d * 0.42, C.tile, C.plaster2, w / 2, d / 2);
  const ry = wh + d * 0.42;
  box(m, x - w * 0.3, ry - 0.02, z - 0.03, x + w * 0.3, ry + 0.03, z + 0.03, C.plaster2, { faces: 'nsew' });
  gableRoof(m, x, ry + 0.03, z, w * 0.3 + 0.02, 0.06, 0.03, C.tileDark, C.plaster2, w * 0.3, 0.03);
  for (let k = 0; k < 5; k++) {
    const px = x - w / 2 + w * (k + 0.5) / 5, zf = z + d / 2 + 0.003;
    m.quad([px - 0.025, wh * 0.45, zf], [px + 0.025, wh * 0.45, zf], [px + 0.025, wh * 0.8, zf], [px - 0.025, wh * 0.8, zf], C.hole);
  }
}
// 馒头窑：八棱的穹顶，正南突出一截窑门
function kiln(m, x, z, r, h, col = C.brick) {
  const n = 8, rings = [[1, -0.3], [0.94, 0.4], [0.7, 0.78], [0.32, 0.97]];    // [半径比, 高]：-0.3 是埋进地里那截，余为高的几成
  const P = (rr, yy, a) => [x + Math.cos(a) * r * rr, yy < 0 ? yy : yy * h, z + Math.sin(a) * r * rr];
  const A = (i) => (i + 0.5) / n * Math.PI * 2;                               // 错开半格，正南是一面而不是一道棱
  for (let k = 0; k < rings.length - 1; k++) {
    const [r0, y0] = rings[k], [r1, y1] = rings[k + 1], c = tint(col, 0.88 + 0.06 * k);
    for (let i = 0; i < n; i++) m.quad(P(r0, y0, A(i)), P(r0, y0, A(i + 1)), P(r1, y1, A(i + 1)), P(r1, y1, A(i)), c);
  }
  const [rt, yt] = rings[rings.length - 1];
  for (let i = 0; i < n; i++) m.tri(P(rt, yt, A(i)), P(rt, yt, A(i + 1)), [x, h, z], tint(col, 1.06));
  box(m, x - 0.075, -0.3, z + r * 0.7, x + 0.075, h * 0.4, z + r + 0.05, col);
  archway(m, x, 0, z + r + 0.054, 0.08, h * 0.32);
}
// 敞棚：几根柱子架一道草顶，四面不砌墙（窑场、马厩用）；脊沿 x
function shed(m, x, z, w, d, ph, roof = C.thatch) {
  for (const fx of [-0.5, 0, 0.5]) for (const fz of [-0.5, 0.5]) {
    const px = x + fx * (w - 0.04), pz = z + fz * (d - 0.04);
    box(m, px - 0.013, -0.2, pz - 0.013, px + 0.013, ph, pz + 0.013, C.wood, { faces: 'nsew' });
  }
  gableRoof(m, x, ph, z, w / 2 + 0.04, d / 2 + 0.05, d * 0.4, roof, C.wood, w / 2, d / 2);
}
// 马：身、颈、头、四腿、尾，头朝本身的 +x（yaw 转向）；长约 0.25
function horse(m, x, z, yaw, col) {
  m.push(x, 0, z, yaw);
  box(m, -0.08, 0.07, -0.03, 0.07, 0.13, 0.03, col);
  box(m, 0.05, 0.11, -0.022, 0.1, 0.19, 0.022, col);
  box(m, 0.08, 0.16, -0.02, 0.15, 0.2, 0.02, col);
  for (const [lx, lz] of [[-0.065, -0.02], [-0.065, 0.02], [0.055, -0.02], [0.055, 0.02]]) box(m, lx - 0.01, -0.1, lz - 0.01, lx + 0.01, 0.075, lz + 0.01, tint(col, 0.8), { faces: 'nsew' });
  box(m, -0.1, 0.05, -0.008, -0.075, 0.12, 0.008, tint(col, 0.6));
  m.pop();
}
// 木栏：沿一圈折线，一根根桩、两道横木（横木无厚）
function fence(m, pts, hh = 0.07) {
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
    for (const y of [hh * 0.45, hh * 0.9]) m.quad([x0, y - 0.008, z0], [x1, y - 0.008, z1], [x1, y + 0.008, z1], [x0, y + 0.008, z0], C.woodLight);
    const k = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.12));
    for (let j = 0; j < k; j++) {
      const px = x0 + (x1 - x0) * j / k, pz = z0 + (z1 - z0) * j / k;
      box(m, px - 0.008, -0.1, pz - 0.008, px + 0.008, hh, pz + 0.008, C.wood, { faces: 'nsew' });
    }
  }
}
// 水车（筒车）：轮面朝南（立在 x-y 面上），轮心 x、cy、z，半径 R；两圈轮辋、八根辐、轮缘一圈竹筒，两侧木架托着轴
function waterWheel(m, x, cy, z, R) {
  const n = 14, t = 0.03, w = 0.008;
  for (const dz of [-0.035, 0.035]) {
    const P = (rr, a) => [x + Math.cos(a) * rr, cy + Math.sin(a) * rr, z + dz];
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      m.quad(P(R, a0), P(R, a1), P(R - t, a1), P(R - t, a0), C.wood);
    }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), e = R - t;
      m.quad([x - sa * w, cy + ca * w, z + dz], [x + ca * e - sa * w, cy + sa * e + ca * w, z + dz], [x + ca * e + sa * w, cy + sa * e - ca * w, z + dz], [x + sa * w, cy - ca * w, z + dz], C.woodLight);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2, px = x + Math.cos(a) * (R - t / 2), py = cy + Math.sin(a) * (R - t / 2);
    box(m, px - 0.02, py - 0.02, z - 0.045, px + 0.02, py + 0.02, z + 0.045, C.bamboo);
  }
  box(m, x - 0.018, cy - 0.018, z - 0.2, x + 0.018, cy + 0.018, z + 0.2, C.wood);
  for (const dz of [-0.17, 0.17]) box(m, x - 0.02, -0.3, z + dz - 0.02, x + 0.02, cy + 0.02, z + dz + 0.02, C.wood, { faces: 'nsew' });
}
// 水田：一块地分成 nx×nz 方，田埂隔开；有的插了秧、有的灌着水、有的稻黄了
function paddies(m, r, x0, z0, x1, z1, nx, nz) {
  flat(m, x0, z0, x1, z1, 0.012, C.dike);
  const g = 0.035, w = (x1 - x0) / nx, d = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    flat(m, x0 + i * w + g / 2, z0 + j * d + g / 2, x0 + (i + 1) * w - g / 2, z0 + (j + 1) * d - g / 2, 0.02, pick(r, [C.paddy, C.paddy, C.paddyWet, C.rice]));
  }
}

// 书院：粉墙黛瓦一圈院墙，南墙一座朱门；院里讲堂、两厢斋舍、后面两层的藏书楼，门内两株松；门外半月泮池、一座石坊（棂星门）
function lmAcademy(m) {
  const cz = -0.2;
  flat(m, -0.78, cz - 0.66, 0.78, cz + 0.66, 0.016, C.pave);
  courtyard(m, 0, cz, 0.82, 0.7, 0.11, 0.04, C.plaster, C.tileDark, 0.3);
  house(m, 0, cz + 0.68, 0.38, 0.14, 0.1, C.red, C.tileDark);
  archway(m, 0, 0, cz + 0.754, 0.1, 0.1);
  hall(m, 0, cz - 0.02, 0.32, 0.15, 0.12, C.tile, { lift: 0.035 });
  hall(m, 0, cz - 0.47, 0.27, 0.1, 0.1, C.tileDark, { tiers: 2 });
  for (const sx of [-1, 1]) house(m, sx * 0.6, cz + 0.12, 0.62, 0.16, 0.09, C.plaster, C.tile, true);
  pine(m, -0.3, cz + 0.42, 1.0); pine(m, 0.3, cz + 0.42, 1.0);
  pool(m, 0, cz + 0.84, 0.36, 0.22, 0.012, C.stoneTop, 0, Math.PI, 10);
  pool(m, 0, cz + 0.84, 0.3, 0.17, 0.018, C.water, 0, Math.PI, 10);
  paifang(m, 0, cz + 1.14, 0.38, 0.3, C.stone);
  return 0.9;
}
// 仓廒：一圈土墙，三排长廒，东边几座圆囤
function lmGranary(m) {
  flat(m, -0.9, -0.76, 0.9, 0.76, 0.016, C.ground);
  courtyard(m, 0, 0, 0.94, 0.8, 0.1, 0.05, C.earth, C.earthTop, 0.3);
  for (const sx of [-1, 1]) box(m, sx * 0.15 - 0.05, -0.3, 0.74, sx * 0.15 + 0.05, 0.17, 0.84, C.earth, { top: C.earthTop });
  for (const z of [-0.5, -0.1, 0.3]) barn(m, -0.2, z, 1.0, 0.24, 0.12);
  silo(m, 0.64, -0.42, 0.13, 0.17); silo(m, 0.64, -0.04, 0.13, 0.17); silo(m, 0.66, 0.36, 0.11, 0.15);
  return 0.95;
}
// 水利：一道东西的渠，石砌两岸；西段两座石墩夹一道闸板、墩上一间闸房，东段一架水车，轮顶一道木槽引水进渠北的田；渠南几方田、闸夫的屋、柳
function lmWaterworks(m) {
  const r = rng(903);
  paddies(m, r, -1.0, -0.98, 1.0, -0.28, 4, 2);
  paddies(m, r, -0.05, 0.28, 1.0, 0.95, 3, 2);
  flat(m, -1.05, -0.15, 1.05, 0.15, 0.014, C.water);
  box(m, -1.05, -0.3, 0.15, 1.05, 0.04, 0.21, C.stone, { top: C.stoneTop });
  box(m, -1.05, -0.3, -0.21, 1.05, 0.04, -0.15, C.stone, { top: C.stoneTop });
  const gx = -0.5;
  box(m, gx - 0.11, -0.3, 0.06, gx + 0.11, 0.13, 0.26, C.stone, { top: C.stoneTop });
  box(m, gx - 0.11, -0.3, -0.26, gx + 0.11, 0.13, -0.06, C.stone, { top: C.stoneTop });
  box(m, gx - 0.03, -0.1, -0.06, gx + 0.03, 0.1, 0.06, C.wood);
  m.push(gx, 0.13, 0);
  house(m, 0, 0, 0.5, 0.2, 0.09, C.plaster2, C.tile, true, 0);
  m.pop();
  waterWheel(m, 0.42, 0.2, 0, 0.3);
  box(m, 0.385, 0.38, -0.7, 0.455, 0.43, -0.05, C.wood);
  flat(m, 0.397, -0.69, 0.443, -0.06, 0.433, C.water);
  for (const z of [-0.36, -0.64]) box(m, 0.405, -0.2, z - 0.015, 0.435, 0.38, z + 0.015, C.wood, { faces: 'nsew' });
  house(m, -0.6, 0.55, 0.42, 0.22, 0.1, C.plaster, C.tile);
  tree(m, -0.25, 0.42, 1.2, C.willow); tree(m, -0.9, 0.85, 1.0, C.willow);
  return 1.05;
}
// 工坊：两座馒头窑，窑后各一根高烟囱冒烟；南边一座敞棚，棚下一排坯；一垛柴、一垛砖
function lmWorkshop(m) {
  flat(m, -0.88, -0.78, 0.88, 0.72, 0.016, C.dust);
  kiln(m, -0.36, -0.2, 0.32, 0.34);
  kiln(m, 0.36, -0.3, 0.25, 0.27);
  mound(m, -0.36, -0.62, 0.075, 0.075, 0.05, 0.05, -0.3, 0.66, C.brick, C.black);
  mound(m, 0.36, -0.64, 0.065, 0.065, 0.045, 0.045, -0.3, 0.54, C.brick, C.black);
  smoke(m, -0.36, -0.62, 0.66, 4);
  smoke(m, 0.36, -0.64, 0.54, 3);
  shed(m, 0.08, 0.42, 0.92, 0.32, 0.13);
  for (let k = 0; k < 6; k++) { const x = -0.26 + k * 0.13; box(m, x - 0.035, -0.05, 0.36, x + 0.035, 0.05, 0.47, C.earthHouse); }
  box(m, -0.84, -0.2, 0.18, -0.6, 0.1, 0.56, C.wood, { top: C.woodLight });
  box(m, 0.62, -0.2, 0.06, 0.84, 0.08, 0.28, C.brick);
  return 0.92;
}
// 堡：一圈高石墙带雉堞，南门一座城楼；四角敌台高出墙一截；当中偏北一座高台两层的敌楼，楼顶大旗；南半两排营房，前两座敌台各插一面旗
function lmFort(m) {
  const hw = 1.0, h = 0.44, t = 0.16;
  flat(m, -hw + t, -hw + t, hw - t, hw - t, 0.02, C.ground);
  flat(m, -0.11, 0, 0.11, hw - t, 0.028, C.street);
  wallRing(m, hw, h, t, C.stone, C.stoneTop, 0.2);
  gate(m, hw, h, t, 0.44, 1, C.stone, C.stoneTop, C.tile);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = sx * (hw - 0.07), z = sz * (hw - 0.07), s = 0.19;
    box(m, x - s, -1, z - s, x + s, h + 0.15, z + s, C.stone, { top: C.stoneTop });
    pavilion(m, x, h + 0.15, z, s * 0.62, s * 0.62, 0.1, 1, C.tileDark, { lift: 0.025, ridge: null });
  }
  box(m, -0.27, -0.5, -0.56, 0.27, 0.36, -0.04, C.stone, { top: C.stoneTop });
  archway(m, 0, 0, -0.036, 0.13, 0.22);
  pavilion(m, 0, 0.36, -0.3, 0.2, 0.18, 0.14, 2, C.tile);
  flag(m, 0, -0.3, 1.02);
  for (const sx of [-1, 1]) house(m, sx * 0.48, 0.42, 0.5, 0.2, 0.1, C.plaster2, C.tile);
  for (const sx of [-1, 1]) flag(m, sx * 0.93, 0.93, h + 0.62);
  return 1.12;
}
// 烽燧：夯土墩台下大上小，一层层夯土深浅相间，台顶一圈垛口、一股狼烟；墩前一座小坞（矮墙、一间屋、一杆旗）
function lmBeacon(m) {
  const N = 6, y0 = -0.4, y1 = 0.95, a0 = 0.27, a1 = 0.17, tz = -0.3;
  for (let k = 0; k < N; k++) {
    const t0 = k / N, t1 = (k + 1) / N;
    mound(m, 0, tz, a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t1, a0 + (a1 - a0) * t1, y0 + (y1 - y0) * t0, y0 + (y1 - y0) * t1, k % 2 ? C.earth : C.earthTop, C.earthTop);
  }
  for (let i = 0; i < 4; i++) {
    m.push(0, 0, tz, i * Math.PI / 2);
    for (const x of [-0.12, 0, 0.12]) box(m, x - 0.03, y1, a1 - 0.04, x + 0.03, y1 + 0.06, a1, C.earth, { top: C.earthTop });
    m.pop();
  }
  smoke(m, 0, tz, y1 + 0.02, 5, 0.85);
  courtyard(m, 0, 0.3, 0.46, 0.28, 0.08, 0.04, C.earth, C.earthTop, 0.16);
  house(m, -0.18, 0.28, 0.3, 0.16, 0.08, C.earthHouse, C.thatch);
  flag(m, 0.22, 0.24, 0.5);
  return 0.7;
}
// 佛寺：黄墙一圈，南墙一座山门；院中重檐大殿，殿前钟鼓二楼、一座香炉，殿后正中一座七级塔，两株古树
function lmTemple(m) {
  const cz = -0.04;
  flat(m, -0.86, cz - 0.86, 0.86, cz + 0.86, 0.016, C.pave);
  courtyard(m, 0, cz, 0.9, 0.9, 0.16, 0.045, C.ochre, C.tileDark, 0.32);
  hall(m, 0, cz + 0.88, 0.2, 0.08, 0.1, C.tile, { body: C.red });
  archway(m, 0, 0.06, cz + 0.964, 0.1, 0.09);
  hall(m, 0, cz + 0.1, 0.34, 0.19, 0.13, C.tile, { tiers: 2, lift: 0.045 });
  for (const sx of [-1, 1]) {
    box(m, sx * 0.56 - 0.1, -0.4, cz + 0.4, sx * 0.56 + 0.1, 0.12, cz + 0.6, C.stone, { top: C.stoneTop });
    pavilion(m, sx * 0.56, 0.12, cz + 0.5, 0.07, 0.07, 0.08, 2, C.tile);
  }
  pagoda(m, 0, cz - 0.55, 7, 0.24);
  box(m, -0.045, -0.1, cz + 0.475, 0.045, 0.07, cz + 0.565, C.black);
  tree(m, -0.6, cz - 0.6, 1.3); tree(m, 0.6, cz - 0.62, 1.2);
  return 1.0;
}
// 祠庙宫观：朱墙一圈，南墙一座门；门外一座木牌坊；进门迎面一座戏台（台口朝北对着正殿），正殿坐高台、翘角，殿前香炉；两株古柏
function lmShrine(m) {
  const cz = -0.16;
  flat(m, -0.8, cz - 0.72, 0.8, cz + 0.72, 0.016, C.pave);
  courtyard(m, 0, cz, 0.84, 0.76, 0.12, 0.045, C.red, C.tileDark, 0.3);
  house(m, 0, cz + 0.74, 0.4, 0.15, 0.11, C.red, C.tileDark);
  archway(m, 0, 0, cz + 0.819, 0.11, 0.1);
  box(m, -0.2, -0.4, cz + 0.22, 0.2, 0.09, cz + 0.5, C.stone, { top: C.wood });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = sx * 0.17, pz = cz + 0.36 + sz * 0.11;
    box(m, px - 0.014, 0.09, pz - 0.014, px + 0.014, 0.24, pz + 0.014, C.red, { faces: 'nsew' });
  }
  box(m, -0.18, 0.09, cz + 0.46, 0.18, 0.24, cz + 0.48, C.red, { faces: 'ns' });
  hipRoof(m, 0, 0.24, cz + 0.36, 0.27, 0.19, 0.12, C.tileDark, { lift: 0.05, ridge: C.tileDark });
  hall(m, 0, cz - 0.36, 0.34, 0.18, 0.13, C.tileDark, { lift: 0.05, y: 0.06 });
  box(m, -0.045, -0.1, cz - 0.025, 0.045, 0.07, cz + 0.065, C.black);
  paifang(m, 0, cz + 1.08, 0.42, 0.36, C.red, C.tileDark);
  pine(m, 0.6, cz + 0.06, 1.45); pine(m, -0.6, cz - 0.12, 1.25);
  return 0.92;
}
// 驿：南边一条东西的官道；西半一座驿舍院（门楼、正房、厢房），东半一座马厩敞棚、棚前木栏圈着两匹马；门前拴一匹白马、竖一杆旗
function lmRelay(m) {
  flat(m, -1.05, 0.6, 1.05, 0.8, 0.016, C.street);
  const cx = -0.42, cz = -0.2;
  flat(m, cx - 0.48, cz - 0.42, cx + 0.48, cz + 0.42, 0.016, C.ground);
  courtyard(m, cx, cz, 0.5, 0.46, 0.1, 0.04, C.earthHouse, C.tile, 0.24);
  house(m, cx, cz - 0.24, 0.62, 0.2, 0.1, C.plaster, C.tile);
  house(m, cx - 0.3, cz + 0.08, 0.32, 0.14, 0.085, C.plaster2, C.tile, true);
  house(m, cx, cz + 0.46, 0.3, 0.12, 0.1, C.earthHouse, C.tileDark);
  archway(m, cx, 0, cz + 0.524, 0.09, 0.09);
  shed(m, 0.55, -0.44, 0.76, 0.26, 0.11);
  fence(m, [[0.15, -0.24], [0.95, -0.24], [0.95, 0.4], [0.15, 0.4]], 0.075);
  horse(m, 0.38, 0.02, 0.35, C.horse);
  horse(m, 0.72, 0.2, Math.PI + 0.5, C.horseDark);
  horse(m, 0.02, 0.5, 0.15, C.horseLight);
  flag(m, -0.12, 0.42, 0.78);
  tree(m, -0.98, 0.42, 1.1);
  return 1.02;
}
// 官署：朱墙一圈，南墙三间大门；院里大堂、二堂，东西六房；门前两根旗杆、一堵照壁
function lmYamen(m) {
  const cz = -0.24;
  flat(m, -0.76, cz - 0.62, 0.76, cz + 0.62, 0.016, C.pave);
  courtyard(m, 0, cz, 0.8, 0.66, 0.12, 0.045, C.palace, C.tileDark, 0.3);
  hall(m, 0, cz + 0.66, 0.2, 0.08, 0.1, C.tile, { body: C.palace });
  archway(m, 0, 0.06, cz + 0.744, 0.1, 0.09);
  hall(m, 0, cz + 0.06, 0.34, 0.16, 0.13, C.tile, { lift: 0.035 });
  hall(m, 0, cz - 0.4, 0.26, 0.11, 0.1, C.tile);
  for (const sx of [-1, 1]) house(m, sx * 0.58, cz + 0.1, 0.62, 0.16, 0.09, C.plaster2, C.tile, true);
  for (const sx of [-1, 1]) flag(m, sx * 0.3, cz + 0.94, 0.86);
  box(m, -0.44, -0.3, cz + 1.14, 0.44, 0.2, cz + 1.2, C.palace, { top: null });
  gableRoof(m, 0, 0.2, cz + 1.17, 0.48, 0.07, 0.05, C.tileDark, C.palace, 0.44, 0.03);
  return 0.92;
}
// 在建：石台基上一座屋架（柱、梁、脊檩），北坡已铺瓦、南坡只上了椽子；南、东两面竹脚手架；西北一根吊杆吊着石料；一垛木料、一堆石料、一堆土
function lmScaffold(m) {
  box(m, -0.5, -0.4, -0.32, 0.5, 0.05, 0.32, C.stoneTop);
  const xs = [-0.42, -0.14, 0.14, 0.42], zs = [-0.26, 0, 0.26], ph = 0.3, ry = ph + 0.17;
  for (const x of xs) for (const z of zs) box(m, x - 0.016, 0.05, z - 0.016, x + 0.016, ph, z + 0.016, C.woodLight, { faces: 'nsew' });
  for (const z of zs) box(m, -0.44, ph - 0.03, z - 0.014, 0.44, ph, z + 0.014, C.woodLight);
  for (const x of xs) box(m, x - 0.014, ph - 0.03, -0.28, x + 0.014, ph, 0.28, C.woodLight);
  box(m, -0.5, ry - 0.025, -0.016, 0.5, ry + 0.005, 0.016, C.wood);
  m.quad([-0.5, ph - 0.01, -0.34], [0.5, ph - 0.01, -0.34], [0.5, ry, 0], [-0.5, ry, 0], C.tile);
  for (let x = -0.46; x < 0.47; x += 0.075) m.quad([x - 0.008, ph - 0.01, 0.34], [x + 0.008, ph - 0.01, 0.34], [x + 0.008, ry, 0], [x - 0.008, ry, 0], C.wood);
  const bam = C.bamboo, zf = 0.44;
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) box(m, x - 0.009, -0.2, zf - 0.009, x + 0.009, 0.66, zf + 0.009, bam, { faces: 'nsew' });
  for (const y of [0.18, 0.37, 0.56]) box(m, -0.62, y - 0.008, zf - 0.008, 0.62, y + 0.008, zf + 0.008, bam);
  for (const [xa, xb] of [[-0.6, -0.3], [0.3, 0.6]]) m.quad([xa, 0, zf + 0.012], [xa + 0.02, 0, zf + 0.012], [xb + 0.02, 0.56, zf + 0.012], [xb, 0.56, zf + 0.012], bam);
  for (const z of [-0.3, 0, 0.3]) box(m, 0.6 - 0.009, -0.2, z - 0.009, 0.6 + 0.009, 0.66, z + 0.009, bam, { faces: 'nsew' });
  for (const y of [0.18, 0.37, 0.56]) box(m, 0.6 - 0.008, y - 0.008, -0.32, 0.6 + 0.008, y + 0.008, zf, bam);
  const kx = -0.66, kz = -0.3, ty = 0.98, bx = -0.2, by = 0.86;
  box(m, kx - 0.016, -0.2, kz - 0.016, kx + 0.016, ty, kz + 0.016, C.wood, { faces: 'nsew' });
  m.quad([kx, ty - 0.015, kz], [bx, by - 0.015, kz], [bx, by + 0.015, kz], [kx, ty + 0.015, kz], C.wood);
  m.quad([kx, ty, kz - 0.015], [bx, by, kz - 0.015], [bx, by, kz + 0.015], [kx, ty, kz + 0.015], C.wood);
  m.quad([bx - 0.004, by, kz], [bx + 0.004, by, kz], [bx + 0.004, 0.5, kz], [bx - 0.004, 0.5, kz], C.pole);
  box(m, bx - 0.05, 0.42, kz - 0.04, bx + 0.05, 0.5, kz + 0.04, C.stone, { top: C.stoneTop });
  for (let k = 0; k < 3; k++) box(m, 0.22 + k * 0.04, -0.1, 0.6 + k * 0.02, 0.8 - k * 0.04, 0.04 + k * 0.04, 0.76 - k * 0.02, C.woodLight, { top: C.wood });
  box(m, -0.78, -0.2, 0.5, -0.56, 0.07, 0.72, C.stone, { top: C.stoneTop });
  box(m, -0.74, 0.07, 0.55, -0.62, 0.12, 0.66, C.stone, { top: C.stoneTop });
  mound(m, -0.78, 0.12, 0.13, 0.12, 0.05, 0.04, -0.2, 0.1, C.earth, C.earthTop);
  return 0.85;
}
// 石桥：一湾水（土岸一圈），一道五孔石拱桥东西跨过，桥面拱起、两边栏板；岸边三株垂柳
function lmBridge(m) {
  pool(m, 0, 0, 0.9, 0.74, 0.01, C.earthTop, 0, Math.PI * 2, 20);
  pool(m, 0, 0, 0.8, 0.64, 0.016, C.water, 0, Math.PI * 2, 20);
  const L = 1.05, B = 0.12, N = 12, Y = (x) => 0.07 + 0.17 * (1 - (x / L) ** 2);
  for (let i = 0; i < N; i++) {
    const x0 = -L + 2 * L * i / N, x1 = -L + 2 * L * (i + 1) / N, y0 = Y(x0), y1 = Y(x1);
    m.quad([x0, y0, B], [x1, y1, B], [x1, y1, -B], [x0, y0, -B], C.stoneTop);
    for (const sz of [B, -B]) {
      m.quad([x0, -0.3, sz], [x1, -0.3, sz], [x1, y1, sz], [x0, y0, sz], C.stone);
      m.quad([x0, y0, sz], [x1, y1, sz], [x1, y1 + 0.045, sz], [x0, y0 + 0.045, sz], C.stoneTop);
    }
  }
  for (const sx of [-1, 1]) m.quad([sx * L, -0.3, B], [sx * L, -0.3, -B], [sx * L, Y(L), -B], [sx * L, Y(L), B], C.stone);
  for (const sz of [B + 0.003, -B - 0.003]) {
    for (const [cx, rr] of [[-0.46, 0.085], [-0.23, 0.1], [0, 0.12], [0.23, 0.1], [0.46, 0.085]]) {
      for (let k = 0; k < 7; k++) {
        const a0 = Math.PI * k / 7, a1 = Math.PI * (k + 1) / 7;
        m.tri([cx, 0.016, sz], [cx + Math.cos(a0) * rr, 0.016 + Math.sin(a0) * rr, sz], [cx + Math.cos(a1) * rr, 0.016 + Math.sin(a1) * rr, sz], C.arch);
      }
    }
  }
  tree(m, -0.78, -0.5, 1.2, C.willow); tree(m, 0.82, 0.42, 1.15, C.willow); tree(m, 0.55, -0.66, 1.0, C.willow);
  return 1.05;
}
// 残垣（营造半损）：一圈院墙断成几截、墙头焦黑；台基上几根焦柱（一根倒了）、一片塌下来的顶；一地碎砖瓦，一股烟，两株枯树
function lmRuin(m) {
  const r = rng(907);
  flat(m, -0.62, -0.62, 0.62, 0.62, 0.016, tint(C.dust, 0.76));
  for (let i = 0; i < 4; i++) {
    m.push(0, 0, 0, i * Math.PI / 2);
    for (let k = 0; k < 5; k++) {
      if (r() < 0.35) continue;
      const x0 = -0.66 + 1.32 * k / 5, x1 = x0 + 1.32 / 5 - 0.05;
      box(m, x0, -0.4, 0.6, x1, 0.03 + r() * 0.11, 0.66, C.earth, { top: C.burnt });
    }
    m.pop();
  }
  box(m, -0.34, -0.4, -0.24, 0.34, 0.05, 0.16, C.stoneTop);
  for (const [x, z, hh] of [[-0.28, -0.18, 0.21], [0.28, -0.18, 0.15], [-0.28, 0.1, 0.1], [0.1, 0.1, 0.18], [0.28, 0.1, 0.07]]) box(m, x - 0.016, 0.05, z - 0.016, x + 0.016, 0.05 + hh, z + 0.016, C.black);
  box(m, -0.22, 0.05, 0, 0.16, 0.085, 0.035, C.black);
  m.quad([-0.3, 0.06, 0.14], [0.24, 0.06, 0.14], [0.2, 0.2, -0.14], [-0.26, 0.17, -0.14], C.tileDark);
  for (let k = 0; k < 6; k++) {
    const x = (r() - 0.5) * 1.0, z = 0.25 + r() * 0.25;
    box(m, x - 0.05, -0.1, z - 0.04, x + 0.05, 0.02 + r() * 0.04, z + 0.04, pick(r, [C.ash, C.burnt, C.stoneTop]));
  }
  smoke(m, 0, -0.05, 0.22, 3, 0.6);
  for (const [x, z] of [[-0.5, -0.45], [0.5, 0.42]]) {
    box(m, x - 0.012, -0.2, z - 0.012, x + 0.012, 0.22, z + 0.012, C.black, { faces: 'nsew' });
    box(m, x - 0.09, 0.15, z - 0.01, x, 0.17, z + 0.01, C.black);
  }
  return 0.75;
}
// 营造地标（model/settlement.js 给的样子）→ 模型：半损的画残垣；建了港而近处既不近海、河埠也没落点的，在四周画一座河埠
// 教堂（天主堂）本地仍画祠庙那样的殿（那时多是中式殿宇），西洋据点、南洋另画西式教堂
export const LANDMARK_MODEL = {
  academy: 'academy', granary: 'granary', waterworks: 'waterworks', workshop: 'workshop', fort: 'fort', beacon: 'beacon', temple: 'temple',
  shrine: 'shrine', church: 'church', relay: 'relay', yamen: 'yamen', bridge: 'bridge', scaffold: 'scaffold', ruin: 'ruinS', port: 'wharf'
};
// 城外诸样按地域换模型：市镇 market、港 port、河埠 wharf 与地标模型名 → 那一地域的样子；聚落等第没给地域（中原）或那一地域没另做的照原样
export function localKind(kind, culture) {
  const table = culture ? EAST_LOCAL[culture] || SOUTH_LOCAL[culture] : null;
  return (table && table[kind]) || kind;
}

// ---------- 林木、村舍（点景小图的立体版：近看才换上，远处仍是小图） ----------
// 照山水画点景的几样：松（层层横出的针叶团）、点叶（石绿圆冠）、夹叶（几团淡绿小冠）、杂树（高低三株）、柳（扁冠垂丝）、
// 村舍（两间屋、一株树）、庄（三间屋围着晒场、一垛草、一株树）。每株二三十面、每处村舍四五十面，几千处一起画也不重。
// 高约一单位，摆放时照点景小图的大小缩放（index.js SCATTER_K）

// 树冠：n 棱的一团，腰圈在 y、半径 r，往上收成尖、往下收一圈再收成尖（高 h：腰上六成、腰下四成）；band 为假时省掉下面那圈（上下各一尖）
function crown(m, x, y, z, r, h, col, n = 6, band = true) {
  const top = [x, y + h * 0.6, z], bot = [x, y - h * 0.4, z], lo = 0.72, ly = y - h * 0.22;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const p0 = [x + c0 * r, y, z + s0 * r], p1 = [x + c1 * r, y, z + s1 * r];
    m.tri(p0, p1, top, col);
    if (band) {
      const q0 = [x + c0 * r * lo, ly, z + s0 * r * lo], q1 = [x + c1 * r * lo, ly, z + s1 * r * lo];
      m.quad(q0, q1, p1, p0, tint(col, 0.88));
      m.tri(q1, q0, bot, tint(col, 0.76));
    } else m.tri(p1, p0, bot, tint(col, 0.8));
  }
}
// 干：一根细方柱，往地下多伸一截
function trunk(m, x, z, h, w = 0.035) { box(m, x - w, -0.25, z - w, x + w, h, z + w, C.wood, { faces: 'nsew' }); }
// 松：一根干，三层六棱的扁锥（针叶团），一层比一层小、左右略错开
function scPine(m) {
  trunk(m, 0, 0, 0.66, 0.032);
  for (const [y, r, h, dx, k] of [[0.22, 0.4, 0.22, 0.03, 0.95], [0.42, 0.31, 0.2, -0.04, 1.05], [0.6, 0.21, 0.2, 0.02, 1.15]]) {
    const c = tint(C.deep, k), apex = [dx, y + h, 0];
    for (let i = 0; i < 6; i++) {
      const a0 = (i + 0.5) * Math.PI / 3, a1 = a0 + Math.PI / 3;
      m.tri([dx + Math.cos(a0) * r, y, Math.sin(a0) * r], [dx + Math.cos(a1) * r, y, Math.sin(a1) * r], apex, c);
    }
  }
  return 0.4;
}
// 点叶：直干，一团石绿圆冠
function scDot(m) {
  trunk(m, 0, 0, 0.3);
  crown(m, 0, 0.5, 0, 0.36, 0.74, C.jade, 6);
  return 0.36;
}
// 夹叶：直干，三团淡绿小冠错落
function scJia(m) {
  trunk(m, 0, 0, 0.3, 0.03);
  for (const [x, y, z, r] of [[-0.15, 0.42, 0.05, 0.22], [0.15, 0.46, -0.05, 0.23], [0, 0.64, 0.02, 0.2]]) crown(m, x, y, z, r, r * 1.8, C.pale, 5, false);
  return 0.36;
}
// 杂树：高低三株，冠色深浅不一
function scGrove(m) {
  for (const [x, z, h, r, col] of [[-0.22, 0.06, 0.6, 0.21, C.jade], [0.15, -0.08, 0.78, 0.25, C.leafDark], [0.04, 0.2, 0.46, 0.18, C.pale]]) {
    trunk(m, x, z, h - r * 1.6, 0.025);
    crown(m, x, h - r * 0.6, z, r, r * 2, col, 5, false);
  }
  return 0.42;
}
// 柳：短干，一团扁冠，冠沿垂下一圈细丝
function scWillow(m) {
  trunk(m, 0, 0, 0.44, 0.04);
  crown(m, 0, 0.58, 0, 0.32, 0.26, C.willow, 6);
  const n = 9, w = 0.055;
  for (let i = 0; i < n; i++) {
    const a = (i + 0.3) / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), x = ca * 0.3, z = sa * 0.3;
    m.quad([x - sa * w, 0.55, z + ca * w], [x + sa * w, 0.55, z - ca * w], [x * 1.1 + sa * w * 0.4, 0.17, z * 1.1 - ca * w * 0.4], [x * 1.1 - sa * w * 0.4, 0.17, z * 1.1 + ca * w * 0.4], tint(C.willow, 0.9));
  }
  return 0.36;
}
// 村舍：两间小屋（一间瓦顶、一间草顶），屋后一株树
function scHamlet(m) {
  house(m, -0.12, 0.04, 0.42, 0.24, 0.13, C.plaster, C.tile, false, -0.3);
  house(m, 0.25, 0.17, 0.3, 0.2, 0.11, C.plaster2, C.thatch, true, -0.3);
  trunk(m, 0.3, -0.2, 0.26, 0.025);
  crown(m, 0.3, 0.38, -0.2, 0.17, 0.28, C.jade, 5, false);
  return 0.44;
}
// 庄：三间屋围着一块晒场，场边一垛草，屋后一株树
function scHamletB(m) {
  flat(m, -0.2, -0.06, 0.24, 0.24, 0.014, C.ground);
  house(m, -0.04, -0.22, 0.52, 0.24, 0.14, C.plaster, C.tile, false, -0.3);
  house(m, -0.4, 0.06, 0.36, 0.2, 0.12, C.plaster2, C.tile, true, -0.3);
  house(m, 0.4, 0.02, 0.32, 0.2, 0.11, C.earthHouse, C.thatch, true, -0.3);
  for (let i = 0; i < 6; i++) {
    const a0 = i * Math.PI / 3, a1 = a0 + Math.PI / 3, x = 0.12, z = 0.2, r = 0.08;
    m.tri([x + Math.cos(a0) * r, -0.02, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, -0.02, z + Math.sin(a1) * r], [x, 0.15, z], C.hay);
  }
  trunk(m, -0.42, -0.34, 0.28, 0.025);
  crown(m, -0.42, 0.42, -0.34, 0.18, 0.3, C.jade, 5, false);
  return 0.52;
}

// 各样：搭法（搭完返回城墙外沿半宽）
// 递给别处诸样（towns3d-east.js、towns3d-south.js）的器件；far() 问此刻搭的是不是远看那份
const KIT = {
  C, box, flat, mound, hipRoof, skirt, gableRoof, house, pavilion, archway, hall, courtyard, tree, pagoda, quarter, pool, flag, smoke,
  wallRing, stilt, palisade, junk, crown, trunk, rng, pick, tint, far: () => FAR
};
const BUILD = {
  town0: (m) => town(m, 0), town1: (m) => town(m, 1), city0: (m) => city(m, 0), city1: (m) => city(m, 1),
  grand0: (m) => grand(m, 0), grand1: (m) => grand(m, 1), metro0: (m) => metro(m, 0), metro1: (m) => metro(m, 1),
  capital, ruin, yurtS, yurtL, stockS, stockL, market, port: (m) => port(m, true), wharf: (m) => port(m, false),
  academy: lmAcademy, granary: lmGranary, waterworks: lmWaterworks, workshop: lmWorkshop, fort: lmFort, beacon: lmBeacon, temple: lmTemple,
  shrine: lmShrine, church: lmShrine, relay: lmRelay, yamen: lmYamen, bridge: lmBridge, scaffold: lmScaffold, ruinS: lmRuin,
  pine: scPine, dot: scDot, jia: scJia, grove: scGrove, willow: scWillow, hamlet: scHamlet, hamletB: scHamletB,
  // 日本、朝鲜诸样（towns3d-east.js）、大越南洋西洋据点诸样（towns3d-south.js）：器件从这里递过去
  ...eastBuilders(KIT),
  ...southBuilders(KIT)
};
// 林木、村舍那几样（createScatter 画的）；村舍另有日本、朝鲜、大越、南洋（西洋据点四郊同南洋）的样子，按地域换（localKind）
export const SCATTER_KINDS = ['pine', 'dot', 'jia', 'grove', 'willow', 'hamlet', 'hamletB',
  'jpHamlet', 'jpHamletB', 'koHamlet', 'koHamletB', 'vnHamlet', 'vnHamletB', 'seaHamlet', 'seaHamletB'];
export const TOWN_KINDS = Object.keys(BUILD);
// 有远看那一份的（城郭、京城、残城）；帐、寨、市镇、港、营造地标本就几百到一两千面，不另做
const HAS_FAR = /^(town|city|grand|metro)\d$|^(jp|jo|ko|vn|sea|we)\d\d$|^(capital|ruin|jpCap|joCap|koCap|vnCap|seaCap|weCap)$/;
// 近看、远看两份按城在屏上的宽（像素）交替：LOD_PX[0] 以下只画远看那份，LOD_PX[1] 以上只画近看那份，其间以抖点互补地换
export const LOD_PX = [48, 66];
const models = new Map();
// 一样模型：{ geometry, far（远看那一份 { geometry, tris }，没有为 null）, hw 城墙外沿半宽（摆地标、定多大开始显）,
// north 北沿, south 南沿（连瓮城、护城河、关厢，从模型原点量起）, radius 外接球半径, tris 三角形数 }
export function townModel(kind) {
  if (models.has(kind)) return models.get(kind);
  const build = BUILD[kind];
  if (!build) throw new Error('没有这样的城郭模型：' + kind);
  const m = new Shape();
  FAR = false;
  const hw = build(m);
  let far = null;
  if (HAS_FAR.test(kind)) {
    const mf = new Shape();
    FAR = true;
    try { build(mf); } finally { FAR = false; }
    far = { geometry: mf.geometry(), tris: mf.pos.length / 9 };
  }
  const geometry = m.geometry(), bb = geometry.boundingBox;
  const radius = Math.hypot(Math.max(-bb.min.x, bb.max.x), Math.max(-bb.min.z, bb.max.z), bb.max.y);
  const rec = { geometry, far, hw, north: -bb.min.z, south: bb.max.z, radius, tris: m.pos.length / 9 };
  models.set(kind, rec);
  return rec;
}

// 一层城郭：同一样的城一份实例化几何（有远看那份的另起一份，两份以抖点互补地换）。
// shared：与山川共用的 uRelief、uPx、uCam、uFogNear、uFogFar、uFogColor、uLookT，外加 uFadePx（占地宽在屏上多少像素开始显、全显）。
// set(list)：list 每项 { kind, x, z, h（落脚处地面高，0～1）, yaw, scale }，整层换过（只记下，画哪些由 update 挑）。
// update(camera)：每帧挑镜头里看得见、又大到开始显的那些写进实例缓冲，近看、远看两份各挑各的——全图四百来座城、七八十万面，
// 不挑的话每帧顶点要算两百多万个
export function createTowns(shared) {
  const group = new THREE.Group();
  const layers = new Map();
  // 一份几何一个网格；mode 0 只此一份、1 近看那份、2 远看那份（着色器按它定换份时的抖点）
  function part(geometry, model, mode, tris) {
    const geo = new THREE.InstancedBufferGeometry();
    for (const k of ['position', 'normal', 'aColor']) geo.setAttribute(k, geometry.getAttribute(k));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uSize: { value: model.hw * 2 }, uLod: { value: new THREE.Vector3(LOD_PX[0], LOD_PX[1], mode) } },
      vertexShader: townVertex, fragmentShader: townFragment, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 19;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, geo, mode, tris, cap: 0, base: null, ys: null, n: 0 };
  }
  function layerFor(kind) {
    if (layers.has(kind)) return layers.get(kind);
    const model = townModel(kind);
    const parts = model.far ? [part(model.geometry, model, 1, model.tris), part(model.far.geometry, model, 2, model.far.tris)] : [part(model.geometry, model, 0, model.tris)];
    const rec = { model, parts, items: [] };
    layers.set(kind, rec);
    return rec;
  }
  function set(list) {
    const by = new Map();
    for (const it of list) { if (!by.has(it.kind)) by.set(it.kind, []); by.get(it.kind).push(it); }
    for (const [kind, rec] of layers) if (!by.has(kind)) { rec.items = []; for (const p of rec.parts) { p.n = 0; p.geo.instanceCount = 0; p.mesh.visible = false; } }
    for (const [kind, items] of by) {
      const rec = layerFor(kind);
      rec.items = items;
      rec.gen = (rec.gen | 0) + 1;                // 换了一批城，下帧必重传
      for (const p of rec.parts) {
        if (items.length <= p.cap) continue;
        p.cap = Math.ceil(items.length * 1.25) + 4;
        p.base = new THREE.InstancedBufferAttribute(new Float32Array(p.cap * 3), 3);
        p.ys = new THREE.InstancedBufferAttribute(new Float32Array(p.cap * 2), 2);
        p.base.setUsage(THREE.DynamicDrawUsage);
        p.ys.setUsage(THREE.DynamicDrawUsage);
        p.geo.setAttribute('aBase', p.base);
        p.geo.setAttribute('aYS', p.ys);
      }
    }
  }
  // 挑出来的一座写进实例缓冲；sig 记这一帧挑了哪些（与上帧一样就不重传，镜头不动时一帧不传）
  const put = (p, it, s, k) => {
    const n = p.n++;
    p.base.array[n * 3] = it.x; p.base.array[n * 3 + 1] = it.h; p.base.array[n * 3 + 2] = it.z;
    p.ys.array[n * 2] = it.yaw || 0; p.ys.array[n * 2 + 1] = s;
    p.sig = (Math.imul(p.sig, 31) + k + 1) | 0;
  };
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
  function update(camera) {
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    // 屏上宽按到镜头的直线距离估（比着色器用的进深略小，所以门槛各让一成，宁多挑勿漏）
    const relief = shared.uRelief.value, uPx = shared.uPx.value, lo = shared.uFadePx.value.x * 0.9, cam = camera.position;
    for (const rec of layers.values()) {
      const { model, items, parts } = rec;
      for (const p of parts) { p.n = 0; p.sig = rec.gen | 0; }
      for (let k = 0; k < items.length; k++) {
        const it = items[k], s = it.scale || 1;
        sphere.center.set(it.x, it.h * relief, it.z);
        sphere.radius = model.radius * s;
        if (!frustum.intersectsSphere(sphere)) continue;
        const px = 2 * model.hw * s * uPx / Math.max(cam.distanceTo(sphere.center), 1);
        if (px < lo) continue;
        if (parts.length === 1) { put(parts[0], it, s, k); continue; }
        if (px > LOD_PX[0] * 0.9) put(parts[0], it, s, k);
        if (px < LOD_PX[1] * 1.1) put(parts[1], it, s, k);
      }
      for (const p of parts) {
        const sig = (Math.imul(p.sig, 7) + p.n) | 0;
        if (p.n && sig !== p.sent) { p.base.needsUpdate = true; p.ys.needsUpdate = true; p.sent = sig; }
        p.geo.instanceCount = p.n;
        p.mesh.visible = p.n > 0;
      }
    }
  }
  return {
    group, set, update,
    // 立体城郭的数目与面数：instances、tris 全图（按近看那份算），drawn、drawnTris 上一帧挑出来画的（近看、远看两份各算各的）
    get stats() {
      let n = 0, tris = 0, dn = 0, dtris = 0;
      for (const rec of layers.values()) {
        n += rec.items.length; tris += rec.items.length * rec.model.tris;
        for (const p of rec.parts) { dn += p.geo.instanceCount; dtris += p.geo.instanceCount * p.tris; }
      }
      return { instances: n, tris, drawn: dn, drawnTris: dtris };
    },
    dispose() { for (const rec of layers.values()) for (const p of rec.parts) { p.geo.dispose(); p.mesh.material.dispose(); } layers.clear(); }
  };
}

// 一层林木、村舍的立体版：全图几万处，按四十八个世界单位一块分好。每帧只挑镜头里、又近到开始显的那几块，把块里的实例整段拷进缓冲，
// 挑出的块与上帧一样就不重传。k：各样「点景小图的大小 → 模型比例」。着色器里的屏上宽按点景小图的大小算（uSize = 1/k），
// 所以 shared.uFadePx 与点景小图淡出的门槛（index.js 里小图那层的 uOutPx）是同一把尺子：小图淡出时立体的以抖点淡入，恰好接上。
// set(list)：list 每项 { kind, x, z, h（落脚处地面高，0～1）, yaw, size（点景小图的大小） }，整层换过
export function createScatter(shared, k) {
  const group = new THREE.Group();
  const CH = 48;
  const parts = new Map();
  let chunks = [], sent = null;
  function partFor(kind) {
    if (parts.has(kind)) return parts.get(kind);
    const model = townModel(kind), geo = new THREE.InstancedBufferGeometry();
    for (const a of ['position', 'normal', 'aColor']) geo.setAttribute(a, model.geometry.getAttribute(a));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uSize: { value: 1 / k[kind] }, uLod: { value: new THREE.Vector3(0, 0, 0) } },
      vertexShader: townVertex, fragmentShader: townFragment, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 18;
    mesh.visible = false;
    group.add(mesh);
    const p = { kind, model, geo, mesh, cap: 0, base: null, ys: null, total: 0, n: 0 };
    parts.set(kind, p);
    return p;
  }
  function set(list) {
    const grid = new Map(), totals = new Map();
    for (const it of list) {
      if (!k[it.kind]) continue;
      const key = Math.floor(it.x / CH) * 4096 + Math.floor(it.z / CH);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(it);
      totals.set(it.kind, (totals.get(it.kind) || 0) + 1);
    }
    for (const [kind, n] of totals) {
      const p = partFor(kind);
      if (n <= p.cap) continue;
      p.cap = n;
      p.base = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      p.ys = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
      p.base.setUsage(THREE.DynamicDrawUsage);
      p.ys.setUsage(THREE.DynamicDrawUsage);
      p.geo.setAttribute('aBase', p.base);
      p.geo.setAttribute('aYS', p.ys);
    }
    for (const p of parts.values()) p.total = totals.get(p.kind) || 0;
    chunks = [];
    for (const items of grid.values()) {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, h0 = Infinity, h1 = -Infinity, size = 0, reach = 0;
      const by = new Map();
      for (const it of items) {
        x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z);
        h0 = Math.min(h0, it.h); h1 = Math.max(h1, it.h);
        size = Math.max(size, it.size);
        reach = Math.max(reach, townModel(it.kind).radius * k[it.kind] * it.size);
        if (!by.has(it.kind)) by.set(it.kind, []);
        by.get(it.kind).push(it);
      }
      const data = [];
      for (const [kind, arr] of by) {
        const base = new Float32Array(arr.length * 3), ys = new Float32Array(arr.length * 2);
        arr.forEach((it, i) => {
          base[i * 3] = it.x; base[i * 3 + 1] = it.h; base[i * 3 + 2] = it.z;
          ys[i * 2] = it.yaw || 0; ys[i * 2 + 1] = k[kind] * it.size;
        });
        data.push({ part: parts.get(kind), base, ys, n: arr.length });
      }
      chunks.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.hypot(x1 - x0, z1 - z0) / 2 + reach, hm: (h0 + h1) / 2, hh: (h1 - h0) / 2, size, data });
    }
    sent = null;
  }
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere(), pass = [];
  function update(camera) {
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    const relief = shared.uRelief.value, uPx = shared.uPx.value, lo = shared.uFadePx.value.x * 0.9, cam = camera.position;
    pass.length = 0;
    let sig = 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      sphere.center.set(c.x, c.hm * relief, c.z);
      sphere.radius = c.r + c.hh * relief;
      if (!frustum.intersectsSphere(sphere)) continue;
      if (c.size * uPx / Math.max(cam.distanceTo(sphere.center) - sphere.radius, 1) < lo) continue;
      pass.push(c);
      sig = (Math.imul(sig, 31) + i + 1) | 0;
    }
    sig = (Math.imul(sig, 7) + pass.length) | 0;
    if (sig === sent) return;
    sent = sig;
    for (const p of parts.values()) p.n = 0;
    for (const c of pass) {
      for (const d of c.data) {
        const p = d.part;
        p.base.array.set(d.base, p.n * 3);
        p.ys.array.set(d.ys, p.n * 2);
        p.n += d.n;
      }
    }
    for (const p of parts.values()) {
      p.geo.instanceCount = p.n;
      p.mesh.visible = p.n > 0;
      if (p.n) { p.base.needsUpdate = true; p.ys.needsUpdate = true; }
    }
  }
  return {
    group, set, update,
    // 全图几处、分几块，上一帧挑出来画的几处、多少面；kinds 各样全图几处
    get stats() {
      let n = 0, drawn = 0, tris = 0;
      const kinds = {};
      for (const p of parts.values()) { n += p.total; drawn += p.geo.instanceCount; tris += p.geo.instanceCount * p.model.tris; if (p.total) kinds[p.kind] = p.total; }
      return { instances: n, chunks: chunks.length, drawn, drawnTris: tris, kinds };
    },
    dispose() { for (const p of parts.values()) { p.geo.dispose(); p.mesh.material.dispose(); } parts.clear(); chunks = []; }
  };
}

// 舆图上的线：疆界、省界、府界、海岸、江河、湖岸、辖区描金、点选描边。
// 一律是矢量折线做成的带子：宽度按屏幕像素算（远近都清楚、不出锯齿），顶点在显卡上按地形升高，深度略往前提，免得被同一处的山面吃掉。
// 府州多边形是从栅格描出来的（半像素一折的阶梯），先拆成「两侧归属相同」的边链、割角磨圆，再按两侧归属分国界、省界、府界。
// 江河：山河境的河是按一度一格切碎的短段，先按端点（容差一像素）接成水系，以最低处为出口，按「上游累计长度」定粗细——越往下游越粗。
import * as THREE from 'three';
import { W, H } from './terrain.js';
import { TRUNKS } from './trunks.js';

// ---------- 折线工具 ----------
// SVG 路径（只有 M、L、Z）→ 若干折线
export function parsePath(d) {
  const out = [];
  let cur = null;
  const re = /([MLZ])([^MLZ]*)/g;
  let m;
  while ((m = re.exec(d))) {
    if (m[1] === 'Z') { if (cur) cur.closed = true; continue; }
    const [x, y] = m[2].split(',').map(Number);
    if (m[1] === 'M' || !cur) { cur = { pts: [], closed: false }; out.push(cur); }
    cur.pts.push([x, y]);
  }
  return out;
}

// 割角磨圆（Chaikin）：开折线端点不动；闭合的整圈磨
export function chaikin(p, times = 2, closed = false) {
  let a = p;
  for (let t = 0; t < times; t++) {
    const n = a.length;
    if (n < 3) return a;
    const b = closed ? [] : [a[0]];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = a[i], p1 = a[(i + 1) % n];
      const q = [p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25];
      const r = [p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75];
      if (!closed && i === 0) b.push(r);
      else if (!closed && i === segs - 1) b.push(q);
      else b.push(q, r);
    }
    if (!closed) b.push(a[n - 1]);
    a = b;
  }
  return a;
}

// 抹平阶梯：前后各 k 点滑动平均（开折线端点不动）。描出来的边先抹一遍再割角，台阶就没了
export function relax(p, k = 2, closed = false) {
  const n = p.length;
  if (n < 3) return p;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i < 1 || i > n - 2)) { out.push(p[i]); continue; }
    let sx = 0, sy = 0, c = 0;
    for (let j = -k; j <= k; j++) {
      let q = i + j;
      if (closed) q = (q + n) % n;
      else q = Math.max(0, Math.min(n - 1, q));
      sx += p[q][0]; sy += p[q][1]; c++;
    }
    out.push([sx / c, sy / c]);
  }
  return out;
}

// 道格拉斯—普克简化（容差：世界像素）
export function simplify(p, tol = 0.08) {
  return simplifyIdx(p, tol).map((i) => p[i]);
}
// 同上，给留下的点的下标（江河要按下标取流量）
export function simplifyIdx(p, tol = 0.08) {
  if (p.length < 3) return p.map((_, i) => i);
  const keep = new Uint8Array(p.length);
  keep[0] = keep[p.length - 1] = 1;
  const stack = [[0, p.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = p[a], [bx, by] = p[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p[i][0] - ax) * dy - (p[i][1] - ay) * dx) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out = [];
  for (let i = 0; i < p.length; i++) if (keep[i]) out.push(i);
  return out;
}

const polyLength = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };

// ---------- 府州拓扑：边链 ----------
// 返回 [{ pts, a, b, closed }]：a、b 为两侧府州下标；b = -1 临无主之地，b = -2 临海。
// 相邻两府的边顶点未必对齐（各自描的），只一府有的边按区划图认对面：regionAt(x, y) 给府州下标（-1 无），isSea(x, y) 判海。
// 对面是别府的，只留下标小的那一府那一侧，免得两条几乎重合的线画两遍
export function regionChains(regions, regionAt, isSea) {
  const key = (p) => Math.round(p[0] * 100) + ',' + Math.round(p[1] * 100);
  const point = new Map();
  const edges = new Map();
  regions.forEach((r, i) => {
    const p = r.poly;
    if (!p || p.length < 3) return;
    for (let k = 0; k < p.length; k++) {
      const u = p[k], v = p[(k + 1) % p.length];
      const ku = key(u), kv = key(v);
      if (ku === kv) continue;
      point.set(ku, u);
      point.set(kv, v);
      const ek = ku < kv ? ku + '|' + kv : kv + '|' + ku;
      let e = edges.get(ek);
      if (!e) edges.set(ek, (e = { u: ku, v: kv, owners: [] }));
      if (!e.owners.includes(i)) e.owners.push(i);
    }
  });
  // 按两侧归属分组，组内顺着顶点接成链
  const groups = new Map();
  for (const e of edges.values()) {
    let [a, b = -1] = e.owners.slice().sort((x, y) => x - y);
    if (b === -1 && regionAt) {
      const u = point.get(e.u), v = point.get(e.v);
      const mx = (u[0] + v[0]) / 2, my = (u[1] + v[1]) / 2;
      const dx = v[0] - u[0], dy = v[1] - u[1], L = Math.hypot(dx, dy) || 1;
      // 府州描的海岸常比真海岸缩进几像素：往外探到 18 像素，先碰到别府的算邻界，碰到海（或江湖水面）的算海岸
      let other = -1, sea = false;
      for (const s of [1, -1]) {
        for (const r of [0.8, 1.6, 3, 5, 8, 12, 18]) {
          const x = mx - dy / L * r * s, y = my + dx / L * r * s;
          const k = regionAt(x, y);
          if (k === a) continue;
          if (k >= 0) { if (other < 0) other = k; break; }
          if (isSea(x, y)) { sea = true; break; }
        }
      }
      if (other >= 0) { if (other < a) continue; b = other; } else if (sea) b = -2;
    }
    const gk = a + '|' + b;
    if (!groups.has(gk)) groups.set(gk, { a, b, list: [] });
    groups.get(gk).list.push(e);
  }
  const chains = [];
  for (const g of groups.values()) {
    const adj = new Map();
    g.list.forEach((e, idx) => {
      for (const k of [e.u, e.v]) { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(idx); }
    });
    const used = new Uint8Array(g.list.length);
    const walk = (start) => {
      const keys = [start];
      let at = start;
      for (;;) {
        const next = (adj.get(at) || []).find((i) => !used[i]);
        if (next == null) break;
        used[next] = 1;
        const e = g.list[next];
        at = e.u === at ? e.v : e.u;
        keys.push(at);
        if (at === start) break;
      }
      return keys;
    };
    // 先从端点（度不为 2）走开链，余下的是闭环
    for (const [k, list] of adj) {
      if (list.length === 2) continue;
      while ((adj.get(k) || []).some((i) => !used[i])) {
        const keys = walk(k);
        if (keys.length > 1) chains.push({ pts: keys.map((x) => point.get(x)), a: g.a, b: g.b, closed: false });
      }
    }
    for (let i = 0; i < g.list.length; i++) {
      if (used[i]) continue;
      const keys = walk(g.list[i].u);
      if (keys.length > 2) chains.push({ pts: keys.slice(0, -1).map((x) => point.get(x)), a: g.a, b: g.b, closed: keys[0] === keys[keys.length - 1] });
    }
  }
  // 磨圆：先抹台阶再割角，端点（三府交界）不动，两侧共用一条线
  for (const c of chains) c.pts = simplify(chaikin(relax(relax(c.pts, 2, c.closed), 2, c.closed), 2, c.closed), 0.04);
  return chains;
}

// ---------- 水系：按上游累计长度定粗细 ----------
// heightAt(x, y) 取地形高；isSea(x, y) 判海。返回 [{ pts, flow: [每点上游累计长度], trunk: [每点是否干流上] }]。
// 山河境的河接不全（大半是孤段），累计长度只够分出支流的大小；干流靠 Natural Earth 大河（trunks.js）认：
// 一段细河有一半以上的点挨着某条大河（1.6 像素内），这一段就按那条大河在此处的已流长度算
export function riverNetwork(env, heightAt, isSea) {
  const pieces = [];
  for (const r of env.rivers) {
    if (r.major) continue;
    for (const l of parsePath(r.d)) if (l.pts.length >= 2) pieces.push(l.pts);
  }
  // 顶点网格：容差一像素把端点接到别段的顶点上（接在中段的，在那里断开）
  const cellOf = (x, y) => Math.floor(x) + ',' + Math.floor(y);
  const grid = new Map();
  pieces.forEach((p, i) => p.forEach((q, k) => { const c = cellOf(q[0], q[1]); if (!grid.has(c)) grid.set(c, []); grid.get(c).push([i, k]); }));
  const cuts = pieces.map(() => new Set());            // 每段在哪些顶点处断开
  const snap = new Map();                              // 端点 → 接到的顶点 [段, 点]
  pieces.forEach((p, i) => {
    for (const k of [0, p.length - 1]) {
      const q = p[k];
      let best = 1.0, hit = null;
      const cx = Math.floor(q[0]), cy = Math.floor(q[1]);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const [j, m] of grid.get((cx + dx) + ',' + (cy + dy)) || []) {
          if (j === i) continue;
          const d = Math.hypot(pieces[j][m][0] - q[0], pieces[j][m][1] - q[1]);
          if (d < best || (d === best && hit && j < hit[0])) { best = d; hit = [j, m]; }
        }
      }
      if (hit) {
        snap.set(i + ':' + k, hit);
        if (hit[1] > 0 && hit[1] < pieces[hit[0]].length - 1) cuts[hit[0]].add(hit[1]);
      }
    }
  });
  // 结点：每段的端点与断点；按坐标归并（接上的端点并到被接的顶点）
  const nodeKey = new Map();
  const nodes = [];
  const nodeAt = (q) => {
    const k = Math.round(q[0] * 50) + ',' + Math.round(q[1] * 50);
    if (!nodeKey.has(k)) { nodeKey.set(k, nodes.length); nodes.push({ x: q[0], y: q[1], edges: [] }); }
    return nodeKey.get(k);
  };
  const edges = [];
  pieces.forEach((p, i) => {
    const marks = [0, ...[...cuts[i]].sort((a, b) => a - b), p.length - 1];
    for (let s = 0; s + 1 < marks.length; s++) {
      const seg = p.slice(marks[s], marks[s + 1] + 1);
      if (seg.length < 2) continue;
      const endA = marks[s] === 0 && snap.has(i + ':0') ? pieces[snap.get(i + ':0')[0]][snap.get(i + ':0')[1]] : seg[0];
      const endB = marks[s + 1] === p.length - 1 && snap.has(i + ':' + (p.length - 1)) ? pieces[snap.get(i + ':' + (p.length - 1))[0]][snap.get(i + ':' + (p.length - 1))[1]] : seg[seg.length - 1];
      seg[0] = endA.slice();
      seg[seg.length - 1] = endB.slice();
      const a = nodeAt(seg[0]), b = nodeAt(seg[seg.length - 1]);
      if (a === b && seg.length < 3) continue;
      const e = { pts: seg, a, b, len: polyLength(seg), up: 0, down: -1 };
      edges.push(e);
      nodes[a].edges.push(edges.length - 1);
      nodes[b].edges.push(edges.length - 1);
    }
  });
  // 分水系：每个连通块以最低处（临海的优先）为出口，自出口往上游走，记每条边的下游端
  const seen = new Uint8Array(nodes.length);
  const order = [];
  for (let s = 0; s < nodes.length; s++) {
    if (seen[s]) continue;
    const comp = [];
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const n = stack.pop();
      comp.push(n);
      for (const ei of nodes[n].edges) {
        const e = edges[ei];
        const o = e.a === n ? e.b : e.a;
        if (!seen[o]) { seen[o] = 1; stack.push(o); }
      }
    }
    let root = comp[0], best = Infinity;
    for (const n of comp) {
      const v = heightAt(nodes[n].x, nodes[n].y) - (isSea(nodes[n].x, nodes[n].y) ? 1 : 0) - (nodes[n].edges.length === 1 ? 0.001 : 0);
      if (v < best) { best = v; root = n; }
    }
    // 广度优先定方向
    const visited = new Set([root]);
    const queue = [root];
    while (queue.length) {
      const n = queue.shift();
      for (const ei of nodes[n].edges) {
        const e = edges[ei];
        if (e.down >= 0) continue;
        const o = e.a === n ? e.b : e.a;
        e.down = n;
        order.push(ei);
        if (!visited.has(o)) { visited.add(o); queue.push(o); }
      }
    }
  }
  // 自上游累加：倒序走（离出口远的先算）
  const inflow = new Float64Array(nodes.length);
  for (let i = order.length - 1; i >= 0; i--) {
    const e = edges[order[i]];
    const upNode = e.down === e.a ? e.b : e.a;
    e.up = inflow[upNode] + e.len;
    inflow[e.down] += e.up;
  }
  const trunkAt = trunkIndex();
  return edges.map((e) => {
    // 折线按自上游往下游排；每点的流量 = 上游端流入 + 沿边已走的长度
    const pts = e.down === e.a ? e.pts.slice().reverse() : e.pts;
    const start = e.up - e.len;
    let acc = 0;
    let flow = pts.map((q, i) => { if (i) acc += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]); return start + acc; });
    const hits = pts.map((q) => trunkAt(q[0], q[1]));
    const onTrunk = hits.filter((x) => x != null).length * 2 >= pts.length;
    if (onTrunk) {
      // 没挨上的点取最近一个挨上的
      let last = hits.find((x) => x != null);
      flow = hits.map((x) => { if (x != null) last = x; return TRUNK_BASE + last; });
    }
    return { pts: chaikin(pts, 1), flow: chaikin(flow.map((f) => [f, 0]), 1).map((v) => v[0]), trunk: onTrunk };
  });
}

// 干流的流量从这里起算（比任何支流都大）
const TRUNK_BASE = 600;
// 干流点索引：每 0.5 像素一点，记已流长度；trunkAt(x, y) 给 1.6 像素内最近一点的已流长度，没有为 null
function trunkIndex() {
  const grid = new Map();
  for (const t of TRUNKS) {
    let s = t.up;
    for (let i = 0; i + 3 < t.pts.length; i += 2) {
      const ax = t.pts[i], ay = t.pts[i + 1], bx = t.pts[i + 2], by = t.pts[i + 3];
      const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / 0.5));
      for (let k = 0; k < n; k++) {
        const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
        const c = Math.floor(x / 2) + ',' + Math.floor(y / 2);
        if (!grid.has(c)) grid.set(c, []);
        grid.get(c).push([x, y, s + L * k / n]);
      }
      s += L;
    }
  }
  return (x, y) => {
    let best = 1.6, val = null;
    const cx = Math.floor(x / 2), cy = Math.floor(y / 2);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const q of grid.get((cx + dx) + ',' + (cy + dy)) || []) {
        const d = Math.hypot(q[0] - x, q[1] - y);
        if (d < best) { best = d; val = q[2]; }
      }
    }
    return val;
  };
}
// 江河宽度系数（乘 uWorldW 即世界宽度）：支流按累计长度 0.3～1，干流按已流长度 1.1～2.6
export function riverWidth(f) {
  if (f >= TRUNK_BASE) return Math.min(2.6, 1.1 + 0.32 * Math.log2(1 + (f - TRUNK_BASE) / 150));
  return Math.min(1.0, 0.3 + 0.12 * Math.log2(1 + f / 10));
}

// ---------- 带子几何 ----------
// lines: [{ pts, closed?, w?: 每点宽度系数, f?: 每点流量 }]；heightAt(x, y) 取地面高（0～1，与地形网格同一张微糊高度）
function ribbon(lines, heightAt) {
  let nv = 0, ni = 0;
  for (const l of lines) {
    const n = l.pts.length + (l.closed ? 1 : 0);
    if (n < 2) continue;
    nv += n * 2;
    ni += (n - 1) * 6;
  }
  const pos = new Float32Array(nv * 3), prev = new Float32Array(nv * 3), next = new Float32Array(nv * 3);
  const side = new Float32Array(nv), along = new Float32Array(nv), wide = new Float32Array(nv), flow = new Float32Array(nv);
  const index = new Uint32Array(ni);
  let v = 0, k = 0;
  for (const l of lines) {
    const p = l.closed ? [...l.pts, l.pts[0]] : l.pts;
    const n = p.length;
    if (n < 2) continue;
    let s = 0;
    const hs = p.map((q) => heightAt(q[0], q[1]));
    for (let i = 0; i < n; i++) {
      if (i) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      const a = i > 0 ? [...p[i - 1], hs[i - 1]] : l.closed ? [...p[n - 2], hs[n - 2]] : [2 * p[0][0] - p[1][0], 2 * p[0][1] - p[1][1], hs[0]];
      const b = i < n - 1 ? [...p[i + 1], hs[i + 1]] : l.closed ? [...p[1], hs[1]] : [2 * p[n - 1][0] - p[n - 2][0], 2 * p[n - 1][1] - p[n - 2][1], hs[n - 1]];
      const wi = l.w ? l.w[Math.min(i, l.w.length - 1)] : 1;
      const fi = l.f ? l.f[Math.min(i, l.f.length - 1)] : 0;
      for (const sd of [-1, 1]) {
        pos.set([p[i][0], hs[i], p[i][1]], v * 3);
        prev.set(a, v * 3);
        next.set(b, v * 3);
        side[v] = sd;
        along[v] = s;
        wide[v] = wi;
        flow[v] = fi;
        v++;
      }
      if (i < n - 1) {
        const o = v - 2;
        index.set([o, o + 1, o + 2, o + 1, o + 3, o + 2], k);
        k += 6;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
  g.setAttribute('aNext', new THREE.BufferAttribute(next, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  g.setAttribute('aW', new THREE.BufferAttribute(wide, 1));
  g.setAttribute('aFlow', new THREE.BufferAttribute(flow, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

const LINE_VERT = /* glsl */`
uniform float uRelief;
uniform vec2 uHalfView;        // 视口一半（CSS 像素）
uniform float uPx;             // 焦距（CSS 像素）
uniform float uWorldW;         // 世界宽度（世界像素；江河有实宽，近看变粗）
uniform float uMinPx, uMaxPx;  // 屏幕宽度上下限
uniform float uFlowMin;        // 江河：上游累计长度不及此数的淡去（随镜头远近定）
attribute vec3 aPrev;          // 前一点：x、y（世界）、地面高（0～1）
attribute vec3 aNext;
attribute float aSide;
attribute float aAlong;
attribute float aW;
attribute float aFlow;
varying float vSide;
varying float vHalf;
varying float vAlongPx;
varying float vFade;
vec4 clip(vec3 p) { return projectionMatrix * modelViewMatrix * vec4(p.x, p.z * uRelief, p.y, 1.0); }
void main() {
  vec4 c = clip(position.xzy);
  vec4 a = clip(aPrev);
  vec4 b = clip(aNext);
  vec2 sc = c.xy / c.w * uHalfView, sa = a.xy / a.w * uHalfView, sb = b.xy / b.w * uHalfView;
  vec2 d1 = sc - sa, d2 = sb - sc;
  d1 = dot(d1, d1) > 1e-8 ? normalize(d1) : (dot(d2, d2) > 1e-8 ? normalize(d2) : vec2(1.0, 0.0));
  d2 = dot(d2, d2) > 1e-8 ? normalize(d2) : d1;
  vec2 t = d1 + d2;
  t = dot(t, t) > 1e-6 ? normalize(t) : d1;
  vec2 n = vec2(-t.y, t.x);
  float miter = 1.0 / max(dot(n, vec2(-d1.y, d1.x)), 0.5);
  float px = clamp(uWorldW * aW * uPx / max(c.w, 1.0), uMinPx * aW, uMaxPx);
  float hw = px * 0.5 + 1.0;                               // 多出一像素做抗锯齿
  c.xy += n * aSide * hw * miter / uHalfView * c.w;
  c.z -= 2.0 * 5.0 * (1.5 + 0.004 * c.w) / max(c.w, 1.0);    // 深度往前提（只动深度，不动屏上位置）
  vSide = aSide * hw;
  vHalf = px * 0.5;
  vAlongPx = aAlong * uPx / max(c.w, 1.0);
  vFade = uFlowMin > 0.0 ? smoothstep(uFlowMin * 0.4, uFlowMin, aFlow) : 1.0;
  gl_Position = c;
}`;

const LINE_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
uniform vec4 uDash;    // 一节长、实线长、点起、点长（像素）；一节长为 0 即实线
uniform float uSoft;   // 1：中间浓、两边淡的晕带
uniform float uEdge;   // 两岸加深（江河）
varying float vSide;
varying float vHalf;
varying float vAlongPx;
varying float vFade;
void main() {
  float d = abs(vSide);
  float a = clamp(vHalf + 0.5 - d, 0.0, 1.0);
  if (uSoft > 0.5) { float k = clamp(1.0 - d / (vHalf + 1.0), 0.0, 1.0); a = k * k; }
  if (uDash.x > 0.0) {
    float m = mod(vAlongPx, uDash.x);
    float dash = smoothstep(-0.6, 0.6, uDash.y - m) * smoothstep(-0.6, 0.6, m);
    float dot2 = uDash.w > 0.0 ? smoothstep(-0.6, 0.6, m - uDash.z) * smoothstep(-0.6, 0.6, uDash.z + uDash.w - m) : 0.0;
    a *= max(dash, dot2);
  }
  vec3 col = mix(uColor, uColor * 0.62, uEdge * smoothstep(0.35, 1.0, d / max(vHalf, 0.5)) * step(1.6, vHalf));
  gl_FragColor = vec4(col, a * uAlpha * vFade);
  if (gl_FragColor.a < 0.004) discard;
}`;

// 线型（颜色按 sRGB 写，同舆图着色器）
const STYLES = {
  river:   { color: [0.33, 0.50, 0.55], worldW: 0.5, minPx: 0.7, maxPx: 40, edge: 1, order: 2 },
  shore:   { color: [0.27, 0.40, 0.44], minPx: 0.9, maxPx: 1.6, alpha: 0.8, order: 3 },
  pref:    { color: [0.33, 0.26, 0.19], minPx: 0.9, maxPx: 1.2, dash: [5.5, 3.2, 0, 0], order: 4 },
  circuit: { color: [0.27, 0.19, 0.12], minPx: 1.3, maxPx: 1.8, dash: [16, 8.5, 11.2, 1.8], order: 5 },
  circuitLine: { color: [0.27, 0.19, 0.12], minPx: 1.2, maxPx: 1.6, order: 5 },
  coast:   { color: [0.22, 0.27, 0.25], minPx: 1.2, maxPx: 1.8, alpha: 0.85, order: 6 },
  realmHalo: { color: [0.16, 0.10, 0.06], minPx: 6, maxPx: 8, soft: 1, alpha: 0.2, order: 7 },
  realm:   { color: [0.20, 0.13, 0.08], minPx: 2.0, maxPx: 3.0, alpha: 0.92, order: 8 },
  focus:   { color: [0.82, 0.62, 0.22], minPx: 2.4, maxPx: 3.2, order: 9 },
  focusHalo: { color: [0.95, 0.80, 0.42], minPx: 8, maxPx: 10, soft: 1, alpha: 0.35, order: 9 },
  hover:   { color: [0.98, 0.93, 0.80], minPx: 1.6, maxPx: 2.0, alpha: 0.9, order: 10 },
  picked:  { color: [0.86, 0.66, 0.24], minPx: 2.6, maxPx: 3.2, order: 11 },
  pickedHalo: { color: [1.0, 0.92, 0.66], minPx: 9, maxPx: 12, soft: 1, alpha: 0.45, order: 10 }
};

function lineMaterial(style, shared) {
  return new THREE.ShaderMaterial({
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,   // 带子的绕向随走向而定，两面都画
    uniforms: {
      uRelief: shared.uRelief, uPx: shared.uPx, uHalfView: shared.uHalfView,
      uWorldW: { value: style.worldW || 0 }, uMinPx: { value: style.minPx }, uMaxPx: { value: style.maxPx },
      uFlowMin: { value: 0 }, uColor: { value: new THREE.Vector3(...style.color) }, uAlpha: { value: style.alpha ?? 1 },
      uDash: { value: new THREE.Vector4(...(style.dash || [0, 0, 0, 0])) }, uSoft: { value: style.soft || 0 }, uEdge: { value: style.edge || 0 }
    }
  });
}

// ---------- 线层 ----------
// shared：与地形共用的 uniform（uTerrain、uRelief、uPx）；land(x, y) 判陆（0～1）；water(x, y) 判海与江湖水面；heightAt 取高
export function createLines({ env, shared, land, water, heightAt, size }) {
  const group = new THREE.Group();
  shared.uHalfView = { value: new THREE.Vector2(size.w / 2, size.h / 2) };
  const mats = {};
  for (const [k, s] of Object.entries(STYLES)) mats[k] = lineMaterial(s, shared);
  const meshes = {};
  function put(kind, lines) {
    if (meshes[kind]) { group.remove(meshes[kind]); meshes[kind].geometry.dispose(); delete meshes[kind]; }
    if (!lines || !lines.length) return;
    const m = new THREE.Mesh(ribbon(lines, heightAt), mats[STYLES[kind] ? kind : kind.split(':')[0]]);
    m.frustumCulled = false;
    m.renderOrder = (STYLES[kind] || STYLES[kind.split(':')[0]]).order;
    meshes[kind] = m;
    group.add(m);
  }
  const isSea = (x, y) => land(x, y) < 0.5;
  const isWater = water || isSea;

  // 海岸：陆地轮廓，去掉贴着图框的那几段
  const onFrame = (q) => q[0] <= 0.01 || q[1] <= 0.01 || q[0] >= W - 0.01 || q[1] >= H - 0.01;
  const coast = [];
  for (const p of env.landPaths) {
    for (const l of parsePath(p.d)) {
      let run = [];
      const pts = l.closed ? [...l.pts, l.pts[0]] : l.pts;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        if (i && onFrame(q) && onFrame(pts[i - 1])) { if (run.length > 1) coast.push(run); run = [q]; continue; }
        run.push(q);
      }
      if (run.length > 1) coast.push(run);
    }
  }
  put('coast', coast.map((p) => ({ pts: chaikin(simplify(p, 0.05), 1) })));

  // 江河与湖岸
  const rivers = riverNetwork(env, heightAt, isSea);
  // 江河按一条里最大的流量分三档，各成一网；远看时小的整档不画（着色器里本也淡去了，省得白画）
  const RIVER_TIERS = [[0, 40], [40, 200], [200, Infinity]];
  RIVER_TIERS.forEach(([lo, hi], i) => put('river:' + i, rivers.filter((r) => { const f = r.flow[r.flow.length - 1]; return f >= lo && f < hi; })
    .map((r) => { const keep = simplifyIdx(r.pts, 0.04); return { pts: keep.map((k) => r.pts[k]), f: keep.map((k) => r.flow[k]), w: keep.map((k) => riverWidth(r.flow[k])) }; })));
  // 傍水：江河两侧三像素内记一格（村舍落点用）
  const riverside = new Uint8Array(W * H);
  for (const r of rivers) {
    for (let i = 0; i < r.pts.length; i++) {
      if (r.flow[i] < 25) continue;
      const cx = Math.round(r.pts[i][0]), cy = Math.round(r.pts[i][1]);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) riverside[y * W + x] = 1;
      }
    }
  }
  const nearRiver = (x, y) => riverside[Math.max(0, Math.min(H - 1, Math.round(y))) * W + Math.max(0, Math.min(W - 1, Math.round(x)))] === 1;
  const shores = [];
  for (const r of env.rivers) if (r.major) for (const l of parsePath(r.d)) shores.push({ pts: chaikin(l.pts, 1, l.closed), closed: l.closed });
  for (const lake of env.lakeFaces) shores.push(...lakeOutline(lake.f));
  put('shore', shores);

  // 府州边链：换剧本时重拆；易主、辖区、点选时只重新分类
  let chains = [];
  let realmOf = [];
  let circuitOf = [];
  function setRegions(regions, regionAt) {
    chains = regionChains(regions, regionAt, isWater);
    circuitOf = regions.map((r) => r.circuit || '');
  }
  function setPolitics(realmByRegion) {
    realmOf = realmByRegion;
    const realm = [], circuit = [], pref = [];
    for (const c of chains) {
      if (c.b === -2) continue;                                  // 临海：海岸线另画
      if (c.b === -1) { if (realmOf[c.a] >= 0) realm.push(c); continue; }
      const ra = realmOf[c.a], rb = realmOf[c.b];
      if (ra !== rb) realm.push(c);
      else if (circuitOf[c.a] !== circuitOf[c.b]) circuit.push(c);
      else pref.push(c);
    }
    put('realm', realm);
    put('realmHalo', realm);
    put('circuit', circuit);
    put('circuitLine', circuit);
    put('pref', pref);
  }
  // 辖区描金：辖内与辖外之间（含临海一侧）
  function setFocus(set) {
    const on = new Set(set || []);
    const edge = on.size ? chains.filter((c) => on.has(c.a) !== (c.b >= 0 && on.has(c.b))) : [];
    put('focus', edge);
    put('focusHalo', edge);
  }
  // 一组府州的外缘（悬停、点选随层级：一府州、一道、一国）；同一组记着，免得每帧重拼
  const outline = (list) => { const on = new Set(list || []); return on.size ? chains.filter((c) => on.has(c.a) !== (c.b >= 0 && on.has(c.b))) : []; };
  const sig = (list) => (list || []).join(',');
  let hoverSig = '', pickSig = '';
  function setHover(list) { const s = sig(list); if (s === hoverSig) return; hoverSig = s; put('hover', outline(list)); }
  function setPicked(list) { const s = sig(list); if (s === pickSig) return; pickSig = s; const o = outline(list); put('picked', o); put('pickedHalo', o); }

  // 每帧：随镜头远近定各线浓淡（远看府界隐去、小河隐去）
  // 点选、悬停的描边只在活的舆图上（案上绢图不画）
  let transientOn = true;
  function transient(on) {
    transientOn = on;
    for (const k of ['hover', 'picked', 'pickedHalo']) if (meshes[k]) meshes[k].visible = on;
  }
  // 层级：天下档国界粗、省界淡；省道档省界实线；府州档省界点划、府界点线（看法设色时府界各档都要看得见）
  function update(dist) {
    for (const k of ['hover', 'picked', 'pickedHalo']) if (meshes[k]) meshes[k].visible = transientOn;
    const f = shared.uFocus ? shared.uFocus.value : 0;
    mats.focus.uniforms.uAlpha.value = f;
    mats.focusHalo.uniforms.uAlpha.value = 0.35 * f;
    const layer = shared.uLayer ? shared.uLayer.value : 0;
    const fill = shared.uFill ? shared.uFill.value : 0, mid = shared.uTierMid ? shared.uTierMid.value : 0;
    mats.pref.uniforms.uAlpha.value = Math.max(0.6 * (1 - fill), 0.5 * layer);
    mats.circuit.uniforms.uAlpha.value = 0.7 * (1 - fill);
    mats.circuitLine.uniforms.uAlpha.value = fill * (0.22 + 0.5 * mid) * (1 - layer);
    mats.realm.uniforms.uMinPx.value = 1.9 + 0.8 * fill;
    mats.realm.uniforms.uMaxPx.value = 2.4 + 1.0 * fill;
    const flowMin = Math.max(0, (dist - 150) * 0.3);
    mats.river.uniforms.uFlowMin.value = flowMin;
    mats.river.uniforms.uAlpha.value = 0.95;
    if (meshes['river:0']) meshes['river:0'].visible = flowMin * 0.4 < 40;
    if (meshes['river:1']) meshes['river:1'].visible = flowMin * 0.4 < 200;
    mats.realmHalo.uniforms.uAlpha.value = 0.08 + 0.12 * fill;
    // 淡到看不见的整网不画（省得白白光栅化一遍）
    for (const [k, m] of Object.entries(meshes)) {
      if (k === 'hover' || k === 'picked' || k === 'pickedHalo') continue;
      const mat = mats[STYLES[k] ? k : k.split(':')[0]];
      if (mat.uniforms.uAlpha.value < 0.004) m.visible = false;
      else if (!k.startsWith('river:')) m.visible = true;
    }
  }
  function setViewport(w, h) { shared.uHalfView.value.set(w / 2, h / 2); }
  function dispose() {
    for (const m of Object.values(meshes)) m.geometry.dispose();
    for (const m of Object.values(mats)) m.dispose();
  }
  return { group, setRegions, setPolitics, setFocus, setHover, setPicked, update, setViewport, transient, nearRiver, dispose };
}

// 湖：三角面列表的外缘（只出现一次的边）接成闭合折线
function lakeOutline(f) {
  const key = (x, y) => Math.round(x * 100) + ',' + Math.round(y * 100);
  const count = new Map();
  const pt = new Map();
  for (let i = 0; i + 5 < f.length; i += 6) {
    const tri = [[f[i], f[i + 1]], [f[i + 2], f[i + 3]], [f[i + 4], f[i + 5]]];
    for (let k = 0; k < 3; k++) {
      const u = tri[k], v = tri[(k + 1) % 3];
      const ku = key(...u), kv = key(...v);
      pt.set(ku, u); pt.set(kv, v);
      const ek = ku < kv ? ku + '|' + kv : kv + '|' + ku;
      const e = count.get(ek);
      if (e) e.n++; else count.set(ek, { u: ku, v: kv, n: 1 });
    }
  }
  const adj = new Map();
  const edges = [...count.values()].filter((e) => e.n === 1);
  edges.forEach((e, i) => { for (const k of [e.u, e.v]) { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
  const used = new Uint8Array(edges.length);
  const out = [];
  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const keys = [edges[i].u, edges[i].v];
    let at = edges[i].v;
    for (;;) {
      const nx = (adj.get(at) || []).find((j) => !used[j]);
      if (nx == null) break;
      used[nx] = 1;
      at = edges[nx].u === at ? edges[nx].v : edges[nx].u;
      if (at === keys[0]) break;
      keys.push(at);
    }
    if (keys.length > 2) out.push({ pts: chaikin(keys.map((k) => pt.get(k)), 1, true), closed: true });
  }
  return out;
}

// 舆图题名（DOM 层，字清楚、用页面字体；每帧按镜头投影摆位），随层级（index.js 的 TIERS）换：
// · 势力名（天下档）：照 CK3 的国名，顺着疆域的长轴把字一个个铺开，字距随疆域大小；长轴在屏上陡（过 55°）就竖写、字正立，
//   平就顺轴斜写。只有一道的势力（朝鲜、叶尔羌……）到省道档仍题国名。
// · 省道名（省道档）：同样顺长轴铺开，字小一档。
// · 府州名（府州档）：落在治所下方；京城、要府（setImportant）先占位，余者按面积大小依次避让。远看只留京城与要府。
// · 大河名：黄河、长江等顺流写在河边（只在中远景）。
import * as THREE from 'three';
import { TRUNKS } from './trunks.js';

// 题名：势力全名去掉括注；少数太长或俗称另有通名的照表。剧本地图上的 shortName 是图上小标用的一两字缩写（「察哈」「喀尔」），不拿来题名
export function realmTitle(name) {
  const n = String(name || '');
  if (SHORT[n]) return SHORT[n];
  return n.replace(/[（(][^）)]*[）)]/g, '').split('·')[0].trim() || n;
}
const SHORT = { '明朝廷': '大明', '荷兰·台海(东印度公司)': '荷兰', '西班牙·马尼拉': '西班牙', '大越黎郑阮格局': '大越', '虾夷地与松前氏': '虾夷', '吐鲁番诸伯克': '吐鲁番', '野人女真诸部': '野人女真', '葡萄牙·澳门': '澳门', '瓦刺诸部': '瓦剌' };
// 大河：Natural Earth 原名 → 题名；只在北纬 21.5 度以北落字（下游出了国境的不题）
const RIVERS = { Huang: '黄河', 'Chang Jiang': '长江', Yangtze: '长江', Han: '汉水', Liao: '辽河', Songhua: '松花江', 'Heilong Jiang': '黑龙江', Jinsha: '金沙江', Lancang: '澜沧江', Nu: '怒江', Gan: '赣江' };

const polyArea = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return Math.abs(a / 2); };

// 一个势力的题字轴：各府州治所按面积加权求主轴（2×2 协方差的长轴），长度取投影的一成到九成之间
function realmAxis(regs) {
  let sw = 0, mx = 0, my = 0;
  for (const r of regs) { sw += r.w; mx += r.x * r.w; my += r.y * r.w; }
  mx /= sw; my /= sw;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const r of regs) { const dx = r.x - mx, dy = r.y - my; cxx += r.w * dx * dx; cyy += r.w * dy * dy; cxy += r.w * dx * dy; }
  const th = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const dir = [Math.cos(th), Math.sin(th)];
  const proj = regs.map((r) => ({ t: (r.x - mx) * dir[0] + (r.y - my) * dir[1], w: r.w })).sort((a, b) => a.t - b.t);
  const pick = (q) => { let acc = 0; for (const p of proj) { acc += p.w; if (acc >= q * sw) return p.t; } return proj[proj.length - 1].t; };
  const t0 = pick(0.1), t1 = pick(0.9);
  const mid = (t0 + t1) / 2;
  return { cx: mx + dir[0] * mid, cy: my + dir[1] * mid, dir, len: Math.max(0, t1 - t0) };
}

// 一组府州的题字：字一个个顺长轴铺开（势力名、省道名共用）
function axisLabel(layer, cls, text, regs, sizeW, spread, maxStep) {
  const ax = realmAxis(regs);
  const chars = [...text];
  const n = chars.length;
  const len = Math.max(Math.min(ax.len * spread, (n - 1) * maxStep), (n - 1) * sizeW * 1.12);
  const step = n > 1 ? len / (n - 1) : 0;
  const els = chars.map((ch) => { const el = document.createElement('div'); el.className = 'm-lbl ' + cls; el.textContent = ch; layer.append(el); return el; });
  const pts = chars.map((_, i) => { const t = (i - (n - 1) / 2) * step; return [ax.cx + ax.dir[0] * t, ax.cy + ax.dir[1] * t]; });
  return { els, pts, sizeW };
}

export function createLabels({ layer, camera, size, heightAt, relief }) {
  let regionLbls = [], realmLbls = [], riverLbls = [], circuitLbls = [];
  let important = new Set(), capitals = new Set();
  const v = new THREE.Vector3();

  // ---------- 大河：每条河沿程每隔约三百像素一个落字处 ----------
  function buildRivers() {
    const out = [];
    for (const t of TRUNKS) {
      const name = RIVERS[t.name];
      if (!name) continue;
      const p = [];
      for (let i = 0; i + 1 < t.pts.length; i += 2) p.push([t.pts[i], t.pts[i + 1]]);
      let acc = 0, next = 120;
      for (let i = 1; i < p.length - 1; i++) {
        acc += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (acc < next) continue;
        next = acc + 300;
        if (67 - p[i][1] / 20 < 21.5) continue;
        const a = p[Math.max(0, i - 4)], b = p[Math.min(p.length - 1, i + 4)];
        out.push({ name, x: p[i][0], y: p[i][1], dx: b[0] - a[0], dy: b[1] - a[1] });
      }
    }
    return out;
  }

  function setData({ regions, realms, factions, circuits = [] }) {
    layer.replaceChildren();
    // 势力名：一字一个元素
    const byFaction = new Map();
    const site = (r) => ({ x: r.center[0], y: r.center[1], w: polyArea(r.poly) });
    regions.forEach((r) => {
      if (!r.faction || !r.poly || r.poly.length < 3) return;
      if (!byFaction.has(r.faction)) byFaction.set(r.faction, []);
      byFaction.get(r.faction).push(site(r));
    });
    // 字号随疆域大小；字距取长轴的六成，但至少一字一格不相叠，单字距最多一百四十像素
    realmLbls = realms.filter((r) => r.area >= 400 && byFaction.has(r.id)).map((r) => ({
      ...axisLabel(layer, 'realm-ch', realmTitle(r.name), byFaction.get(r.id), Math.max(14, Math.min(Math.sqrt(r.area) * 0.15, 105)), 0.62, 140),
      area: r.area, multi: (r.circuits || 1) > 1 }));
    // 省道名：只题分了几道的势力（只有一道的，省道档仍题国名）
    const multi = new Set(realms.map((r, i) => ((r.circuits || 1) > 1 ? i : -1)).filter((i) => i >= 0));
    circuitLbls = circuits.filter((c) => multi.has(c.realm)).map((c) => {
      const regs = c.regions.map((i) => regions[i]).filter((r) => r.poly && r.poly.length >= 3).map(site);
      const area = regs.reduce((s, r) => s + r.w, 0);
      if (area < 60 || !regs.length) return null;
      const sizeW = Math.max(9, Math.min(Math.sqrt(area) * 0.2, 46));
      return { ...axisLabel(layer, 'circ-ch', c.title, regs, sizeW, 0.5, sizeW * 1.7), area };
    }).filter(Boolean).sort((a, b) => b.area - a.area);
    // 府州名
    regionLbls = regions.map((r, i) => {
      const el = document.createElement('div');
      el.className = 'm-lbl pref';
      el.textContent = r.name;
      layer.append(el);
      return { el, i, x: r.center[0], y: r.center[1], area: r.poly ? polyArea(r.poly) : 0, len: [...r.name].length };
    });
    sortRegions();
    // 大河名
    riverLbls = buildRivers().map((r) => {
      const el = document.createElement('div');
      el.className = 'm-lbl river';
      el.textContent = r.name;
      layer.append(el);
      return { ...r, el };
    });
  }
  function rankOf(l) { return capitals.has(l.i) ? 2 : important.has(l.i) ? 1 : 0; }
  function sortRegions() {
    for (const l of regionLbls) {
      const k = rankOf(l);
      l.el.classList.toggle('cap', k === 2);
      l.el.classList.toggle('seat', k === 1);
    }
    regionLbls.sort((a, b) => rankOf(b) - rankOf(a) || b.area - a.area);
  }

  // 世界点 → 屏幕（CSS 像素）与深度；在镜头后面的给 null
  function screen(x, y, lift = 1) {
    v.set(x, heightAt(x, y) * relief() + lift, y).applyMatrix4(camera.matrixWorldInverse);
    const depth = -v.z;
    if (depth <= 1) return null;
    v.applyMatrix4(camera.projectionMatrix);
    if (Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.15) return null;
    return [(v.x * 0.5 + 0.5) * size.w, (-v.y * 0.5 + 0.5) * size.h, depth];
  }
  const pxPerUnit = (depth) => size.h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth);
  const hide = (el) => { if (el.style.opacity !== '0') el.style.opacity = 0; };
  const fadeBy = (d, a, b) => Math.max(0, Math.min(1, (d - a) / (b - a)));

  // 摆一组顺轴的字；collide 为真时与已占位的相撞就整组不显
  function placeAxis(r, alpha, minPx, maxPx, occupied, free, collide) {
    if (alpha <= 0) { r.els.forEach(hide); return; }
    const sp = r.pts.map((p) => screen(p[0], p[1], 4));
    if (sp.some((p) => !p)) { r.els.forEach(hide); return; }
    const first = sp[0], last = sp[sp.length - 1];
    let ang = Math.atan2(last[1] - first[1], last[0] - first[0]);
    const steep = Math.abs(Math.cos(ang)) < Math.cos(THREE.MathUtils.degToRad(55));
    // 读的方向：横写从左往右，竖写从上往下；屏上反了就倒过来排字
    let order = r.els.map((_, i) => i);
    if (sp.length > 1 && (steep ? first[1] > last[1] : first[0] > last[0])) { order = order.reverse(); ang += Math.PI; }
    const rot = steep ? 0 : ang;
    const boxes = order.map((ci, k) => { const p = sp[k], px = Math.min(r.sizeW * pxPerUnit(p[2]), maxPx), half = px * 0.5; return { ci, p, px, box: [p[0] - half, p[1] - half, p[0] + half, p[1] + half] }; });
    if (boxes.some((b) => b.px < minPx) || (collide && boxes.some((b) => !free(b.box)))) { r.els.forEach(hide); return; }
    for (const { ci, p, px, box } of boxes) {
      const el = r.els[ci];
      el.style.opacity = alpha.toFixed(2);
      el.style.fontSize = px.toFixed(1) + 'px';
      el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -50%) rotate(${rot.toFixed(3)}rad)`;
      occupied.push(box);
    }
  }

  function update(dist) {
    camera.updateMatrixWorld();
    const occupied = [];
    const free = (box) => !occupied.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));

    // 势力名：天下档显；只有一道的势力到省道档仍显（照 index.js 的层级界：1250～1450 天下与省道交替，600～760 省道与府州交替）。
    // 国名与省道名先后淡换（国名 1350～1450 淡去，省道名 1250～1350 淡入），不叠着两层半透明的字
    const realmAlpha = fadeBy(dist, 1350, 1450), soleAlpha = fadeBy(dist, 600, 760);
    for (const r of realmLbls) placeAxis(r, 0.84 * (r.multi ? realmAlpha : soleAlpha), 11, 120, occupied, free, false);
    // 省道名：省道档显，大的先占位
    const circAlpha = Math.min(fadeBy(dist, 600, 760), 1 - fadeBy(dist, 1250, 1350));
    for (const c of circuitLbls) placeAxis(c, 0.86 * circAlpha, 12, 46, occupied, free, true);

    // 府州名：京城一直在、要府到一千一百五、余者到七百二（府州档）
    const scale = Math.max(0.88, Math.min(1.22, 520 / dist));
    for (const l of regionLbls) {
      const k = rankOf(l);
      const limit = k === 2 ? 2600 : k === 1 ? 1150 : 720;
      if (dist > limit) { hide(l.el); continue; }
      const p = screen(l.x, l.y, 1);
      if (!p) { hide(l.el); continue; }
      const fs = (k === 2 ? 16 : k === 1 ? 14 : 12.5) * scale;
      const w = fs * l.len * 1.08, top = p[1] + 4;
      const box = [p[0] - w / 2 - 2, top - 1, p[0] + w / 2 + 2, top + fs * 1.25];
      // 京城向来先占位；远看势力大字铺开时也要让字（不压在国名上）
      if ((k < 2 || realmAlpha > 0.3 || circAlpha > 0.3) && !free(box)) { hide(l.el); continue; }
      occupied.push(box);
      l.el.style.opacity = (k ? 1 : 0.94 * (1 - fadeBy(dist, limit - 160, limit))).toFixed(2);
      l.el.style.fontSize = fs.toFixed(1) + 'px';
      l.el.style.transform = `translate(${p[0].toFixed(1)}px, ${top.toFixed(1)}px) translateX(-50%)`;
    }

    // 大河名：距离三百五到一千五之间；顺流向写，略偏离河道
    const riverAlpha = Math.min(fadeBy(dist, 300, 420), 1 - fadeBy(dist, 1300, 1600));
    for (const r of riverLbls) {
      if (riverAlpha <= 0) { hide(r.el); continue; }
      const p = screen(r.x, r.y, 1), q = screen(r.x + r.dx, r.y + r.dy, 1);
      if (!p || !q) { hide(r.el); continue; }
      let ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      if (Math.cos(ang) < 0) ang += Math.PI;
      const fs = 13.5 * scale;
      const ox = -Math.sin(ang) * fs * 0.9, oy = Math.cos(ang) * fs * 0.9;
      const cx = p[0] + ox, cy = p[1] + oy, half = fs * 1.6;
      const box = [cx - half, cy - half * 0.6, cx + half, cy + half * 0.6];
      if (!free(box)) { hide(r.el); continue; }
      occupied.push(box);
      r.el.style.opacity = (0.9 * riverAlpha).toFixed(2);
      r.el.style.fontSize = fs.toFixed(1) + 'px';
      r.el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) translate(-50%, -50%) rotate(${ang.toFixed(3)}rad)`;
    }
  }

  return {
    setData,
    update,
    // 京城（府州下标）；要府（布政司治所、身份所在等）
    setCapitals(list) { capitals = new Set(list || []); sortRegions(); },
    setImportant(list) { important = new Set(list || []); sortRegions(); },
    get capitals() { return capitals; },
    get important() { return important; },
    clear() { layer.replaceChildren(); regionLbls = []; realmLbls = []; riverLbls = []; circuitLbls = []; }
  };
}

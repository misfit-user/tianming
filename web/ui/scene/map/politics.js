// 舆图层级（照 CK3：远看天下诸国，近一档看各国之内的省道，再近看府州）：
// · 势力配色：矿物颜料一路，中等饱和，铺满一国也不刺眼；按剧本原色就近取色，邻国不同色，主势力（大明等）用缃黄。
// · 省道配色：同一势力的各省道取本色的一族深浅（明暗、冷暖略移），邻道不同——由天下推近到省道时，一国的整色碎成一族，接得自然。
// · 编号：府州 → 所属省道（同一势力里同名省道算一道；没写省道的府州自成一道）。
import { hexRgb } from './looks.js';

// 势力底色（sRGB）
export const REALM_INKS = [
  '#d6b25e',   // 缃黄（主势力）
  '#c46f58',   // 朱膘
  '#5f88a8',   // 石青
  '#71a07f',   // 石绿
  '#a690b6',   // 藕荷
  '#b27c50',   // 赭石
  '#66728c',   // 黛
  '#a9a255',   // 秋香
  '#a8566b',   // 胭脂
  '#4f8b8c',   // 苍青
  '#c6a27e',   // 驼
  '#93695f',   // 檀
  '#9cb47a',   // 松花
  '#7568a0',   // 靛紫
  '#d99a6c',   // 杏红
  '#7f9a86'    // 竹青
];

const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
// 两色相差（粗略的感知距离，红绿蓝加权）
function colorGap(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2], rm = (a[0] + b[0]) / 2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

// 府州相邻：编号图上左右、上下相邻的两府州记一对（下标，小的在前）
export function adjacency(ids, count) {
  const seen = new Set(), pairs = [];
  const { data, width, height } = ids;
  const note = (a, b) => {
    if (!a || !b || a === b) return;
    const lo = Math.min(a, b) - 1, hi = Math.max(a, b) - 1, k = lo * 65536 + hi;
    if (lo >= count || hi >= count || seen.has(k)) return;
    seen.add(k);
    pairs.push([lo, hi]);
  };
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = y * width + x, a = data[i];
      if (!a) continue;
      if (data[i + 1] !== a) note(a, data[i + 1]);
      if (data[i + width] !== a) note(a, data[i + width]);
    }
  }
  return pairs;
}

// 省道题名：去括注；括注前那段就是势力名的（「后金（盛京辽沈）」）取括注里头一段
export function circuitTitle(name, realmName) {
  const n = String(name || '');
  const base = n.replace(/[（(][^）)]*[）)]/g, '').trim();
  const inner = (n.match(/[（(]([^）)]*)[）)]/) || [])[1] || '';
  const realm = String(realmName || '').replace(/[（(][^）)]*[）)]/g, '').split('·')[0].trim();
  if (inner && (!base || base === realm)) return inner.split(/[·、，,]/)[0].trim() || base || n;
  return base || n;
}

// regions：府州；realmList：势力（terrain.realms 出的，带 id、name、color、area）；realmByRegion：府州下标 → 势力下标
// primary：主势力名的正则。memo：上回配的色（势力 id → 色、省道键 → 色），易主后各国各道照旧用原色，只给新冒出来的配色
// 出 { realmColors: ['#hex' 按势力下标], circuits: [{ key, name, title, realm, regions, color }], circuitOf: Int16Array }
export function politicsOf({ regions, realmList, realmByRegion, pairs, primary = /明朝廷|大明/, memo = { realm: new Map(), circuit: new Map() } }) {
  // ---- 势力配色：面积大的先挑；就剧本原色的色相取最近的一色，邻国已用的不取，别国已用的尽量不取
  const realmAdj = realmList.map(() => new Set());
  for (const [a, b] of pairs) {
    const ra = realmByRegion[a], rb = realmByRegion[b];
    if (ra >= 0 && rb >= 0 && ra !== rb) { realmAdj[ra].add(rb); realmAdj[rb].add(ra); }
  }
  const realmColors = new Array(realmList.length).fill(null);
  const used = new Map();
  const order = realmList.map((_, i) => i).sort((a, b) => realmList[b].area - realmList[a].area);
  const inks = REALM_INKS.map((hex) => ({ hex, rgb: hexRgb(hex), hsl: rgbToHsl(hexRgb(hex)) }));
  for (const i of order) {
    const r = realmList[i];
    if (memo.realm.has(r.id)) { realmColors[i] = memo.realm.get(r.id); used.set(realmColors[i], (used.get(realmColors[i]) || 0) + 1); continue; }
    if (primary.test(r.name)) { realmColors[i] = REALM_INKS[0]; used.set(REALM_INKS[0], (used.get(REALM_INKS[0]) || 0) + 1); continue; }
    const want = rgbToHsl(hexRgb(r.color || '#999999'));
    // 邻国已用的色、与之相近的色（相差不足一百二）都不取
    const neighbor = [...realmAdj[i]].map((j) => realmColors[j]).filter(Boolean).map(hexRgb);
    let best = null, bestScore = Infinity;
    for (const ink of inks.slice(1)) {
      if (neighbor.some((c) => colorGap(c, ink.rgb) < 120)) continue;
      const dh = Math.min(Math.abs(ink.hsl[0] - want[0]), 360 - Math.abs(ink.hsl[0] - want[0])) / 180;
      const dl = Math.abs(ink.hsl[2] - want[2]);
      const score = dh * (want[1] > 0.12 ? 1 : 0.2) + dl * 0.5 + (used.get(ink.hex) || 0) * 0.45;
      if (score < bestScore) { bestScore = score; best = ink.hex; }
    }
    realmColors[i] = best || inks[1 + (i % (inks.length - 1))].hex;
    used.set(realmColors[i], (used.get(realmColors[i]) || 0) + 1);
  }
  realmList.forEach((r, i) => memo.realm.set(r.id, realmColors[i]));

  // ---- 省道编号
  const circuits = [], byKey = new Map();
  const circuitOf = new Int16Array(regions.length).fill(-1);
  regions.forEach((r, i) => {
    const realm = realmByRegion[i];
    if (realm < 0) return;
    const key = realmList[realm].id + '|' + (r.circuit || '#' + i);
    let c = byKey.get(key);
    if (!c) {
      c = { key, name: r.circuit || r.name, title: '', realm, regions: [], color: null };
      byKey.set(key, c);
      circuits.push(c);
    }
    c.regions.push(i);
    circuitOf[i] = circuits.indexOf(c);
  });
  for (const c of circuits) c.title = circuitTitle(c.name, realmList[c.realm] && realmList[c.realm].name);

  // ---- 省道配色：本色一族深浅（明暗 ±、冷暖 ±），邻道取差得最远的一档
  const VARIANTS = [[0, 0, 0], [0, -0.06, 0.07], [0, 0.02, -0.07], [7, -0.02, 0.035], [-7, 0.0, -0.035], [4, -0.12, -0.02], [-5, 0.04, 0.10], [10, -0.08, -0.08], [-10, -0.05, 0.02]];
  const circAdj = circuits.map(() => new Set());
  for (const [a, b] of pairs) {
    const ca = circuitOf[a], cb = circuitOf[b];
    if (ca >= 0 && cb >= 0 && ca !== cb) { circAdj[ca].add(cb); circAdj[cb].add(ca); }
  }
  const byRealm = new Map();
  circuits.forEach((c, i) => { if (!byRealm.has(c.realm)) byRealm.set(c.realm, []); byRealm.get(c.realm).push(i); });
  for (const [realm, list] of byRealm) {
    const base = rgbToHsl(hexRgb(realmColors[realm]));
    const shades = VARIANTS.map(([dh, ds, dl]) => hslToRgb([base[0] + dh, Math.max(0.05, Math.min(0.85, base[1] + ds)), Math.max(0.2, Math.min(0.86, base[2] + dl))]));
    // 道多的先上色；省道一个的就用本色
    const sorted = list.slice().sort((a, b) => circAdj[b].size - circAdj[a].size);
    const count = new Array(shades.length).fill(0);
    for (const ci of sorted) {
      if (list.length === 1) { circuits[ci].color = realmColors[realm]; break; }
      const kept = memo.circuit.get(circuits[ci].key);
      if (kept && kept.base === realmColors[realm]) { circuits[ci].color = kept.color; circuits[ci].rgb = hexRgb(kept.color); continue; }
      const nb = [...circAdj[ci]].map((j) => circuits[j].rgb).filter(Boolean);
      let best = 0, bestScore = -Infinity;
      shades.forEach((s, k) => {
        const gap = nb.length ? Math.min(...nb.map((c) => colorGap(s, c))) : 999;
        const score = Math.min(gap, 140) - count[k] * 6 - (k === 0 ? 0 : 2);
        if (score > bestScore) { bestScore = score; best = k; }
      });
      count[best]++;
      circuits[ci].rgb = shades[best];
      circuits[ci].color = toHex(shades[best]);
    }
  }
  for (const c of circuits) { delete c.rgb; memo.circuit.set(c.key, { color: c.color, base: realmColors[c.realm] }); }
  return { realmColors, circuits, circuitOf };
}

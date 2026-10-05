// 笔与印：在 Canvas 上写字、钤印、裱绫、洒金。界面（诏付有司那方印）与场景（立轴、匾、楹联）共用。
// 只画 Canvas，不碰 WebGL；场景层自己把画布包成贴图。
// 场景里的墨迹、匾额、楹联写繁体（书写的旧规矩），界面文字仍用简体。
import { rand } from '../core/rand.js';

export const INK = '#17110b';
export const CINNABAR = '#b3301d';      // 印泥：朱砂偏橙

// 等字体就位：{ 字体名: 要用到的字 }。按需分片的字体只有真用到的字所在的那几片会被取来
export async function loadFonts(spec) {
  await Promise.all(Object.entries(spec).map(([family, text]) => document.fonts.load(`100px "${family}"`, text)));
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// 一个字的墨迹外框（textAlign=left、textBaseline=alphabetic 画在原点时）
function inkBox(g, ch, family, size = 200) {
  g.font = `${size}px "${family}"`;
  const m = g.measureText(ch);
  return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, size };
}

// 把一个字的墨迹撑满 (x, y, w, h) 这个框；stretch=false 时按比例、居中
export function fitGlyph(g, ch, family, x, y, w, h, { stretch = true, stroke = 0, mode = 'fill' } = {}) {
  const b = inkBox(g, ch, family);
  const gw = b.l + b.r, gh = b.a + b.d;
  let sx = w / gw, sy = h / gh;
  if (!stretch) sx = sy = Math.min(sx, sy);
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.scale(sx, sy);
  g.font = `${b.size}px "${family}"`;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  const ox = -(b.r - b.l) / 2, oy = (b.a - b.d) / 2;
  if (stroke) {
    g.lineJoin = 'round';
    g.lineWidth = stroke / Math.min(sx, sy);
    g.strokeText(ch, ox, oy);
  }
  if (mode === 'fill') g.fillText(ch, ox, oy);
  g.restore();
}

// ---------- 印 ----------
// 朱文（红字红边）或白文（红底字留白）；方印或椭圆引首章。返回透明底画布，贴到纸上用 multiply。
//   chars 自右往左、自上往下排：两字方印左右并排，两字长印与椭圆上下排，四字 2×2
export function sealCanvas({ chars, style = 'zhu', shape = 'square', w = 240, h = w, seed = 1, family = 'TM-Seal', color = CINNABAR }) {
  const [c, g] = canvas(w, h);
  const r = rand(seed);
  const path = () => {
    g.beginPath();
    if (shape === 'oval') g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
    else g.rect(2, 2, w - 4, h - 4);
  };
  const border = Math.round(Math.min(w, h) * (style === 'zhu' ? 0.07 : 0.05));
  const inset = style === 'zhu' ? border * 2.1 : border * 1.6;
  const n = chars.length;
  let cells;
  const iw = w - inset * 2, ih = h - inset * 2;
  if (n === 1) cells = [[0, 0, 1, 1]];
  else if (n === 2 && (shape === 'oval' || h > w * 1.25)) cells = [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]];
  else if (n === 2) cells = [[0.5, 0, 0.5, 1], [0, 0, 0.5, 1]];
  else if (n === 3) cells = [[0.5, 0, 0.5, 1], [0, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5]];
  else cells = [[0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [0, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5]];
  const gap = Math.min(w, h) * 0.03;
  const drawChars = () => {
    chars.forEach((ch, i) => {
      const [cx, cy, cw, chh] = cells[i];
      fitGlyph(g, ch, family, inset + cx * iw + gap, inset + cy * ih + gap, cw * iw - gap * 2, chh * ih - gap * 2,
        { stroke: style === 'bai' ? Math.min(w, h) * 0.035 : Math.min(w, h) * 0.018 });
    });
  };
  g.fillStyle = color;
  g.strokeStyle = color;
  if (style === 'bai') {
    path();
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    drawChars();
  } else {
    path();
    g.lineWidth = border;
    g.stroke();
    drawChars();
  }
  // 石花：边上崩几处、面上几点不着泥
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (let i = 0; i < 18; i++) {
    const side = r() * 4 | 0, t = r();
    const x = side === 0 ? t * w : side === 1 ? w - r() * 5 : side === 2 ? t * w : r() * 5;
    const y = side === 0 ? r() * 5 : side === 1 ? t * h : side === 2 ? h - r() * 5 : t * h;
    g.beginPath();
    g.arc(x, y, 1 + r() * Math.min(w, h) * 0.025, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.15 + r() * 0.5;
    g.beginPath();
    g.arc(r() * w, r() * h, 0.5 + r() * 1.8, 0, Math.PI * 2);
    g.fill();
  }
  // 印泥厚薄不匀
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = r() * h, rad = 10 + r() * Math.min(w, h) * 0.3;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(0,0,0,${r() * 0.18})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1;
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return c;
}

// ---------- 纸、绫 ----------
export function fibers(g, x, y, w, h, r, n, dark = '120,95,60', light = '255,250,235') {
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, a = r() * Math.PI, len = 3 + r() * 16;
    g.strokeStyle = r() < 0.5 ? `rgba(${light},${r() * 0.22})` : `rgba(${dark},${r() * 0.1})`;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    g.stroke();
  }
}

export function stains(g, x, y, w, h, r, n, tone = '150,120,70', k = 0.06) {
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, rad = 20 + r() * Math.min(w, h) * 0.18;
    const grad = g.createRadialGradient(px, py, 0, px, py, rad);
    grad.addColorStop(0, `rgba(${tone},${r() * k})`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
}

// 绫：本色地上同色暗花（小朵云，隔行错开），只在光下隐约
export function damask(g, x, y, w, h, ground, r, { step = 58, light = 'rgba(255,250,236,0.16)', dark = 'rgba(0,0,0,0.05)' } = {}) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = ground;
  g.fillRect(x, y, w, h);
  for (let j = 0, yy = y + step / 2; yy < y + h + step; j++, yy += step * 0.8) {
    for (let xx = x + (j % 2) * step / 2; xx < x + w + step; xx += step) {
      const s = step * 0.16;
      g.strokeStyle = light;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(xx, yy, s, Math.PI * 0.9, Math.PI * 2.1);
      g.arc(xx + s * 1.1, yy + s * 0.35, s * 0.6, Math.PI * 1.1, Math.PI * 2.4);
      g.arc(xx - s * 1.1, yy + s * 0.35, s * 0.6, Math.PI * 0.6, Math.PI * 1.9);
      g.stroke();
      g.strokeStyle = dark;
      g.beginPath();
      g.moveTo(xx - s * 1.6, yy + s * 0.95);
      g.lineTo(xx + s * 1.6, yy + s * 0.95);
      g.stroke();
    }
  }
  for (let yy = y; yy < y + h; yy += 3) {           // 丝的横纹
    g.fillStyle = `rgba(0,0,0,${0.015 + r() * 0.02})`;
    g.fillRect(x, yy, w, 1);
  }
  g.restore();
}

// ---------- 墨书 ----------
// 一个字：先一层淡墨晕（纸吃墨），再落正墨；每字大小、倾侧、浓淡略有出入，像手写
export function inkChar(g, ch, family, cx, cy, size, r, { color = INK, bleed = 0.3 } = {}) {
  const k = 1 + (r() - 0.5) * 0.05;
  g.save();
  g.translate(cx, cy);
  g.rotate((r() - 0.5) * 0.03);
  g.font = `${size * k}px "${family}"`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = `rgba(40,28,16,${bleed})`;
  g.shadowBlur = size * 0.012;
  g.globalAlpha = 0.9 + r() * 0.08;
  g.fillStyle = color;
  g.fillText(ch, 0, 0);
  g.shadowBlur = 0;
  g.globalAlpha = 0.5;
  g.fillText(ch, 0.6, 0.4);
  g.restore();
}

export function stamp(g, seal, x, y, alpha = 0.93) {
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = alpha;
  g.drawImage(seal, x, y);
  g.restore();
}

// ---------- 中堂立轴（启幕） ----------
// 二色裱：天地头青灰绫、画心四周米黄绫圈档、白局条；天头垂两条惊燕。
// 画心洒金蜡笺，墨书两行（默认「奉天承運 / 治亂由人」），款、引首章与名章。
// 返回三张画布：色、粗糙度、金属度（金屑那几点光滑带金属，侧光下一闪）
export async function titleScrollCanvases({ lines = ['奉天承運', '治亂由人'], inscription = '題天命卷首', seals = { name: ['中', '和'], motto: ['萬', '年'], lead: ['春', '秋'] } } = {}) {
  await loadFonts({ 'TM-Syuku': lines.join('') + inscription, 'TM-Seal': [...seals.name, ...seals.motto, ...seals.lead].join('') });
  const W = 1200, H = 3120;
  const [c, g] = canvas(W, H);
  const [cr, gr] = canvas(W, H);
  const [cm, gm] = canvas(W, H);
  const r = rand(17);
  const SIDE = 104, TOP = 610, UPPER = 150, LOWER = 120, BOTTOM = 330, JU = 7;
  const core = { x: SIDE + JU, y: TOP + UPPER + JU, w: W - (SIDE + JU) * 2 };
  core.h = H - BOTTOM - LOWER - JU - core.y;
  damask(g, 0, 0, W, H, '#7d8987', r, { step: 64 });
  damask(g, SIDE, TOP, W - SIDE * 2, H - TOP - BOTTOM, '#d4c49c', r, { step: 52, light: 'rgba(255,252,240,0.2)' });
  for (const fx of [0.37, 0.63]) {                  // 惊燕
    const x = W * fx - 16;
    damask(g, x, 0, 32, TOP - 8, '#d8c8a2', r, { step: 30 });
    g.strokeStyle = 'rgba(80,66,44,0.35)';
    g.lineWidth = 2;
    g.strokeRect(x + 3, -4, 26, TOP - 6);
  }
  g.fillStyle = 'rgba(40,34,26,0.35)';              // 天地头与圈档交界的暗缝
  g.fillRect(SIDE, TOP - 2, W - SIDE * 2, 3);
  g.fillRect(SIDE, H - BOTTOM - 1, W - SIDE * 2, 3);
  g.fillRect(SIDE - 2, TOP, 3, H - TOP - BOTTOM);
  g.fillRect(W - SIDE - 1, TOP, 3, H - TOP - BOTTOM);
  g.fillStyle = '#efe6cf';                          // 局条
  g.fillRect(core.x - JU, core.y - JU, core.w + JU * 2, core.h + JU * 2);
  const grad = g.createLinearGradient(0, core.y, 0, core.y + core.h);
  grad.addColorStop(0, '#ecdfb8');
  grad.addColorStop(0.5, '#eadcb2');
  grad.addColorStop(1, '#e2d1a3');
  g.fillStyle = grad;
  g.fillRect(core.x, core.y, core.w, core.h);
  stains(g, core.x, core.y, core.w, core.h, r, 70, '150,118,66', 0.07);
  fibers(g, core.x, core.y, core.w, core.h, r, 5000);
  const edge = g.createLinearGradient(core.x, 0, core.x + core.w, 0);
  edge.addColorStop(0, 'rgba(120,90,50,0.12)');
  edge.addColorStop(0.08, 'rgba(120,90,50,0)');
  edge.addColorStop(0.92, 'rgba(120,90,50,0)');
  edge.addColorStop(1, 'rgba(120,90,50,0.12)');
  g.fillStyle = edge;
  g.fillRect(core.x, core.y, core.w, core.h);
  gr.fillStyle = 'rgb(205,205,205)';
  gr.fillRect(0, 0, W, H);
  gr.fillStyle = 'rgb(150,150,150)';                  // 蜡笺比绫光一点
  gr.fillRect(core.x, core.y, core.w, core.h);
  gm.fillStyle = '#000';
  gm.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {                   // 洒金：大小金片疏密不匀
    const x = core.x + r() * core.w, y = core.y + r() * core.h;
    const s = r() < 0.08 ? 3 + r() * 6 : 0.8 + r() * 2.2;
    const pts = [];
    const n = 4 + (r() * 3 | 0);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.8;
      const rr = s * (0.6 + r() * 0.6);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    const tone = 170 + r() * 50;
    for (const [ctx, fill] of [[g, `rgb(${tone + 20},${tone - 10},${tone - 90})`], [gr, 'rgb(60,60,60)'], [gm, '#fff']]) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.fill();
    }
  }
  const size = 372, rowTop = core.y + 250, step = 404;
  const colR = core.x + core.w * 0.74, colL = core.x + core.w * 0.38;
  [...lines[0]].forEach((ch, i) => inkChar(g, ch, 'TM-Syuku', colR, rowTop + i * step, size, r));
  [...(lines[1] || '')].forEach((ch, i) => inkChar(g, ch, 'TM-Syuku', colL, rowTop + 40 + i * step, size, r));
  const kx = core.x + 92;
  [...inscription].forEach((ch, i) => inkChar(g, ch, 'TM-Syuku', kx, core.y + 1180 + i * 96, 84, r, { bleed: 0.2 }));
  const below = core.y + 1180 + inscription.length * 96;
  stamp(g, sealCanvas({ chars: seals.name, style: 'bai', w: 118, seed: 3 }), kx - 59, below + 10);
  stamp(g, sealCanvas({ chars: seals.motto, style: 'zhu', w: 112, seed: 5 }), kx - 56, below + 152);
  stamp(g, sealCanvas({ chars: seals.lead, style: 'zhu', shape: 'oval', w: 78, h: 150, seed: 9 }), colR + size * 0.5 + 6, core.y + 70);
  return { map: c, roughness: cr, metalness: cm, aspect: W / H };
}

// ---------- 匾 ----------
// 青地金字（宫殿匾额的规矩），字自右往左；字是贴金的阳文，带一点厚度（暗边在右下、亮边在左上）
export async function plaqueCanvas(text = '允執厥中', { family = 'TM-Boku', ground = ['#1f3050', '#15223a'] } = {}) {
  await loadFonts({ [family]: text });
  const W = 2048, H = 580;
  const [c, g] = canvas(W, H);
  const r = rand(29);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, ground[0]);
  grad.addColorStop(1, ground[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.08;                             // 漆面细断纹
  for (let i = 0; i < 500; i++) {
    g.strokeStyle = r() < 0.5 ? '#000' : '#6f86a8';
    g.lineWidth = 1;
    const x = r() * W, y = r() * H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 6);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#c9a25a';
  g.lineWidth = 6;
  g.strokeRect(34, 34, W - 68, H - 68);
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 2;
  g.strokeRect(40, 40, W - 80, H - 80);
  const chars = [...text];
  const box = 400, span = W - 360;
  chars.forEach((ch, i) => {
    const cx = W / 2 + span / 2 - (i + 0.5) * span / chars.length;
    const x = cx - box / 2, y = H / 2 - box / 2 + 6;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    fitGlyph(g, ch, family, x + 7, y + 9, box, box, { stretch: false });
    g.fillStyle = '#fff4c8';
    fitGlyph(g, ch, family, x - 2, y - 2, box, box, { stretch: false });
    const tg = g.createLinearGradient(0, y, 0, y + box);
    tg.addColorStop(0, '#f0d58e');
    tg.addColorStop(0.45, '#cfa352');
    tg.addColorStop(1, '#94692a');
    g.fillStyle = tg;
    fitGlyph(g, ch, family, x, y, box, box, { stretch: false });
  });
  g.globalCompositeOperation = 'multiply';          // 金面年久：几处磨暗
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(60,50,40,${r() * 0.25})`;
    g.beginPath();
    g.arc(r() * W, r() * H, 1 + r() * 4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}

// ---------- 楹联（抱柱联） ----------
// 黑漆地、金字，竖写一行；两侧金色起线
export async function coupletCanvas(text, { family = 'TM-Syuku' } = {}) {
  await loadFonts({ [family]: text });
  const W = 440, H = 2520;                 // 弧长 ≈ 370 毫米、高 2100 毫米
  const [c, g] = canvas(W, H);
  const r = rand(text.length * 13);
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#0c0806');
  grad.addColorStop(0.5, '#1d130e');
  grad.addColorStop(1, '#0c0806');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.07;
  for (let i = 0; i < 400; i++) {
    g.strokeStyle = r() < 0.5 ? '#000' : '#8a5a3a';
    const x = r() * W, y = r() * H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 4, y + (r() - 0.5) * 30);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#b8914a';
  g.lineWidth = 5;
  g.strokeRect(22, 22, W - 44, H - 44);
  g.strokeStyle = 'rgba(184,145,74,0.5)';
  g.lineWidth = 2;
  g.strokeRect(34, 34, W - 68, H - 68);
  const chars = [...text];
  const box = 264, step = (H - 180) / chars.length;
  chars.forEach((ch, i) => {
    const x = W / 2 - box / 2, y = 90 + i * step + (step - box) / 2;
    g.fillStyle = 'rgba(0,0,0,0.7)';
    fitGlyph(g, ch, family, x + 4, y + 6, box, box, { stretch: false });
    const tg = g.createLinearGradient(0, y, 0, y + box);
    tg.addColorStop(0, '#ecd08a');
    tg.addColorStop(0.5, '#c79a4e');
    tg.addColorStop(1, '#8e6428');
    g.fillStyle = tg;
    fitGlyph(g, ch, family, x, y, box, box, { stretch: false });
  });
  return c;
}

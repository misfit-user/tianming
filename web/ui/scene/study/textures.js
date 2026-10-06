// 书房的贴图：程序画的（纸、布、锦、绫、描金、题签、花笺、竹帘、护墙板、案面）与生图加工后的图片（assets/study/tex/）。
// 写字的贴图要等字体载入后再画。
import * as THREE from 'three';
import { rand } from '../../core/rand.js';
import { quality } from '../../core/quality.js';
import { cachedCanvas } from '../../core/texcache.js';

const TEX_BASE = new URL('../../assets/study/tex/', import.meta.url).href;

export function canvasTexture(w, h, draw, { srgb = true, repeat = null, aniso } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return wrapCanvas(c, { srgb, repeat, aniso });
}

export function wrapCanvas(c, { srgb = true, repeat = null, aniso } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso ?? quality().anisotropy;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// ---------- 图片 ----------
const imageCache = new Map();
export function loadImage(name) {
  if (!imageCache.has(name)) {
    imageCache.set(name, new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('贴图载入失败：' + name));
      img.src = TEX_BASE + name;
    }));
  }
  return imageCache.get(name);
}
export async function imageTexture(name, { srgb = true, repeat = null } = {}) {
  const t = new THREE.Texture(await loadImage(name));
  t.needsUpdate = true;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = quality().anisotropy;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// ---------- 纸与布 ----------
// 纸：底色上一层细纤维与淡淡的斑
export function paperTexture(base = '#ece2c8', seed = 11) {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rand(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 90;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(150,120,70,${r() * 0.05})`);
      grad.addColorStop(1, 'rgba(150,120,70,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 1800; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, len = 3 + r() * 14;
      g.strokeStyle = r() < 0.5 ? `rgba(255,250,235,${r() * 0.25})` : `rgba(120,95,60,${r() * 0.12})`;
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  }, { repeat: [1, 1] });
}

// 书口、纸叠侧面：一层层纸的细横线
export function paperEdgeTexture(color = '#e6dcc4') {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(120,95,60,${0.06 + (y % 6 === 0 ? 0.1 : 0)})`;
      g.fillRect(0, y, w, 1);
    }
  });
}

// 布：经纬交织
export function clothTexture(color, seed = 3) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    const r = rand(seed);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.05})`;
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
      g.fillRect(x, 0, 1, h);
    }
  }, { repeat: [3, 3] });
}

// 如意云头：锦、描金、绫都用
function cloud(g, x, y, s) {
  g.beginPath();
  g.arc(x, y, s, Math.PI * 0.9, Math.PI * 2.1);
  g.arc(x + s * 1.1, y + s * 0.35, s * 0.6, Math.PI * 1.1, Math.PI * 2.4);
  g.arc(x - s * 1.1, y + s * 0.35, s * 0.6, Math.PI * 0.6, Math.PI * 1.9);
  g.stroke();
  g.beginPath();
  g.arc(x, y + s * 0.15, s * 0.45, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
}

// 织锦：地色上团窠（圆内云头）四方连续
export function brocadeTexture(ground = '#7c1f14', gold = '#d7b060') {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = ground;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = gold;
    g.fillStyle = gold;
    const step = 128;
    for (let y = 0; y <= h; y += step) {
      for (let x = 0; x <= w; x += step) {
        for (const [ox, oy] of [[0, 0], [step / 2, step / 2]]) {
          const cx = x + ox, cy = y + oy;
          g.globalAlpha = ox ? 0.45 : 0.8;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(cx, cy, ox ? 16 : 40, 0, Math.PI * 2);
          g.stroke();
          if (!ox) {
            g.lineWidth = 2.5;
            cloud(g, cx, cy - 4, 12);
            g.beginPath();
            g.arc(cx, cy, 30, 0, Math.PI * 2);
            g.stroke();
          }
        }
      }
    }
    g.globalAlpha = 1;
  }, { repeat: [1, 1] });
}

// 黄绫诏书：明黄地、细织纹与一层缎光，四周一道织金团云边（字由页面 DOM 叠上去）。宽高比约 1.52，与摊开的诏卷同
export function silkScrollTexture() {
  return canvasTexture(2048, 1352, (g, w, h) => {
    const r = rand(29);
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#e9c766');
    base.addColorStop(0.5, '#e2bb52');
    base.addColorStop(1, '#d8ae44');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // 缎光：斜向一道宽而淡的亮带
    const sheen = g.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0.25, 'rgba(255,248,220,0)');
    sheen.addColorStop(0.45, 'rgba(255,248,220,0.16)');
    sheen.addColorStop(0.6, 'rgba(255,248,220,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h);
    // 织纹：经纬细线
    g.fillStyle = '#7a5410';
    g.globalAlpha = 0.06;
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    g.globalAlpha = 0.035;
    for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h);
    g.globalAlpha = 1;
    // 纤维浓淡
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '120,80,20' : '255,240,200'},${0.03 + r() * 0.04})`;
      g.fillRect(r() * w, r() * h, 20 + r() * 90, 1 + r() * 1.5);
    }
    // 织金团云边
    const band = Math.round(h * 0.075);
    g.fillStyle = 'rgba(150,96,22,0.55)';
    for (const [x, y, bw, bh] of [[0, 0, w, band], [0, h - band, w, band], [0, 0, band, h], [w - band, 0, band, h]]) g.fillRect(x, y, bw, bh);
    g.strokeStyle = 'rgba(250,224,150,0.85)';
    g.lineWidth = 2.5;
    const step = band * 1.6;
    const motif = (cx, cy) => { g.beginPath(); g.arc(cx, cy, band * 0.3, 0, Math.PI * 2); g.stroke(); cloud(g, cx, cy - 2, band * 0.12); };
    for (let x = band / 2; x < w; x += step) { motif(x, band / 2); motif(x, h - band / 2); }
    for (let y = band / 2 + step; y < h - step / 2; y += step) { motif(band / 2, y); motif(w - band / 2, y); }
    // 边内两道细金线
    g.strokeStyle = 'rgba(140,90,20,0.7)';
    g.lineWidth = 3;
    g.strokeRect(band + 10, band + 10, w - 2 * band - 20, h - 2 * band - 20);
    g.lineWidth = 1.5;
    g.strokeRect(band + 22, band + 22, w - 2 * band - 44, h - 2 * band - 44);
  });
}

// 绫（舆图裱边）：浅米色，同色暗花云纹，只在光下隐约可见
export function damaskTexture(ground = '#d9ccad') {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = ground;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,248,230,0.35)';
    g.lineWidth = 2;
    for (let y = 32; y < h; y += 96) {
      for (let x = 32 + ((y / 96) % 2) * 48; x < w; x += 96) cloud(g, x, y, 14);
    }
    const r = rand(5);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.04})`;
      g.fillRect(r() * w, r() * h, 1, 2);
    }
  }, { repeat: [6, 6] });
}

// 黑漆描金：双边框、四角云头、中间一圈团云（不画具体龙纹，免得像某朝专属）
export function gildTexture() {
  return canvasTexture(1024, 700, (g, w, h) => {
    g.fillStyle = '#120b08';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(214,174,96,0.9)';
    g.lineWidth = 5;
    g.strokeRect(26, 26, w - 52, h - 52);
    g.lineWidth = 2;
    g.strokeRect(44, 44, w - 88, h - 88);
    g.lineWidth = 3;
    for (const [x, y] of [[110, 110], [w - 110, 110], [110, h - 110], [w - 110, h - 110]]) cloud(g, x, y, 22);
    g.lineWidth = 4;
    g.beginPath();
    g.arc(w / 2, h / 2, 150, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.arc(w / 2, h / 2, 132, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cloud(g, w / 2 + Math.cos(a) * 80, h / 2 + Math.sin(a) * 80, 20);
    }
    cloud(g, w / 2, h / 2, 28);
    const r = rand(9);                               // 描金年久，金色斑驳
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(40,25,15,${r() * 0.35})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 1 + r() * 5, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
}

// 题签：素纸条，竖写书名，外一道细框
export function slipTexture(text, { color = '#2a1d14', ground = '#efe7d3', font = 'TM-Syuku' } = {}) {
  return canvasTexture(128, 512, (g, w, h) => {
    g.fillStyle = ground;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,30,0.5)';
    g.lineWidth = 3;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const chars = [...text];
    const size = Math.min(84, (h - 60) / chars.length);
    g.font = `${size}px "${font}"`;
    chars.forEach((ch, i) => g.fillText(ch, w / 2, 40 + size * (i + 0.5)));
  });
}

// 花笺：竖行小楷，右起；首行稍大作题。三种笺色（素笺、薛涛红笺、淡青笺），左下角淡印一枝折枝花（笺谱的套版印花）
export function noteTexture(title, lines, seed = 1) {
  const grounds = ['#efe5cc', '#f0dccd', '#e3e6d4'];
  const prints = ['rgba(150,120,80,0.16)', 'rgba(190,90,80,0.16)', 'rgba(90,120,100,0.18)'];
  const k = (seed - 1) % 3;
  return canvasTexture(512, 860, (g, w, h) => {
    const r = rand(seed);
    g.fillStyle = grounds[k];
    g.fillRect(0, 0, w, h);
    g.strokeStyle = prints[k];
    g.fillStyle = prints[k];
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(40, h - 40);
    g.bezierCurveTo(90, h - 150, 150, h - 190, 250, h - 260);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(140, h - 180);
    g.quadraticCurveTo(190, h - 170, 230, h - 120);
    g.stroke();
    for (const [x, y, s] of [[250, h - 262, 16], [232, h - 120, 13], [180, h - 214, 11], [120, h - 150, 9]]) {
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = 'rgba(170,60,40,0.3)';           // 朱丝栏
    g.lineWidth = 1;
    for (let x = w - 40; x > 30; x -= 52) {
      g.beginPath();
      g.moveTo(x, 30);
      g.lineTo(x, h - 30);
      g.stroke();
    }
    g.fillStyle = '#241a12';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const col = (text, x, size) => {
      g.font = `${size}px "TM-WenKai"`;
      [...text].forEach((ch, i) => g.fillText(ch, x + (r() - 0.5) * 1.5, 46 + i * size * 1.1));
    };
    col(title, w - 66, 36);
    lines.forEach((t, i) => col(t, w - 118 - i * 52, 27));
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(120,90,50,${r() * 0.05})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 10 + r() * 50, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// 竹帘：细竹篾横排，几道麻绳竖编（UV 按米，一张管 1 米见方）
export function bambooTexture() {
  return canvasTexture(512, 1024, (g, w, h) => {
    const r = rand(41);
    g.fillStyle = '#6b4a24';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      const tone = 150 + r() * 40;
      g.fillStyle = `rgb(${tone + 30},${tone + 8},${tone - 50})`;
      g.fillRect(0, y, w, 4.2);
      g.fillStyle = 'rgba(255,240,200,0.25)';
      g.fillRect(0, y + 0.6, w, 1);
      if (r() < 0.12) { g.fillStyle = 'rgba(90,60,30,0.35)'; g.fillRect(r() * w, y, 20 + r() * 80, 4); }
    }
    for (const x of [w * 0.18, w * 0.5, w * 0.82]) {
      g.fillStyle = '#4a2c16';
      g.fillRect(x - 3, 0, 6, h);
      for (let y = 0; y < h; y += 12) { g.fillStyle = 'rgba(30,16,8,0.5)'; g.fillRect(x - 4, y, 8, 2); }
    }
  }, { repeat: [1, 1] });
}

// 护墙板：紫檀底，每米一块镶板（外框阴线 + 一道描金细线）
export async function dadoTexture() {
  const img = await loadImage('zitan.jpg');
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.drawImage(img, 0, 0, w, h);
    g.fillStyle = 'rgba(20,8,4,0.25)';
    g.fillRect(0, 0, w, 40);
    g.fillRect(0, h - 70, w, 70);
    g.strokeStyle = 'rgba(12,4,2,0.7)';
    g.lineWidth = 10;
    g.strokeRect(70, 110, w - 140, h - 240);
    g.strokeStyle = 'rgba(226,186,110,0.35)';
    g.lineWidth = 3;
    g.strokeRect(92, 132, w - 184, h - 284);
  }, { repeat: [1, 1] });
}

// 案面：攒框装板（整张案一张图，UV 0~1）。长边「大边」纹理顺长、两头「抹头」纹理竖走，四角 45° 格角；
// 心板三块拼、纹理顺长；框与板之间一道细槽。包浆：四周略深中间略浅，几点旧墨渍、几道细划痕
export async function deskTopTexture() {
  const W = quality().tier === 'low' ? 2048 : 4096;
  const c = await cachedCanvas(`desk-top@${W}`, () => deskTopCanvas(W), { type: 'image/jpeg', quality: 0.93 });
  return wrapCanvas(c, { aniso: 16 });
}

async function deskTopCanvas(W) {
  const img = await loadImage('huanghuali.jpg');
  const H = Math.round(W * 2.2 / 3.8);
  const PX = W / 3.8;                                   // 每米多少像素
  const B = Math.round(0.13 * PX);                      // 边框宽
  const S = 0.3 * PX / img.width;                       // 一张木纹管 0.3 米
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  {
    const r = rand(51);
    const wood = (path, rot, ox, oy, tone) => {
      g.save();
      path();
      g.clip();
      const pat = g.createPattern(img, 'repeat');
      pat.setTransform(new DOMMatrix().translate(ox, oy).rotate(rot).scale(S * 2.2, S * (0.8 + r() * 0.15)));   // 顺纹拉长：鬼脸收成长流纹
      g.fillStyle = pat;
      g.fillRect(0, 0, W, H);
      if (tone) { g.fillStyle = tone; g.fillRect(0, 0, W, H); }
      g.restore();
    };
    const poly = (pts) => () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    const ph = (H - 2 * B) / 3;
    for (let k = 0; k < 3; k++) {
      wood(poly([[B, B + k * ph], [W - B, B + k * ph], [W - B, B + (k + 1) * ph], [B, B + (k + 1) * ph]]), 0, r() * 900, r() * 900,
        `rgba(${k === 1 ? '255,235,210,0.04' : '60,30,10,0.05'})`);
    }
    wood(poly([[0, 0], [W, 0], [W - B, B], [B, B]]), 0, r() * 900, 30, 'rgba(60,30,10,0.07)');
    wood(poly([[0, H], [W, H], [W - B, H - B], [B, H - B]]), 0, r() * 900, 400, 'rgba(60,30,10,0.07)');
    wood(poly([[0, 0], [B, B], [B, H - B], [0, H]]), 90, 60, r() * 900, 'rgba(60,30,10,0.1)');
    wood(poly([[W, 0], [W - B, B], [W - B, H - B], [W, H]]), 90, W - 80, r() * 900, 'rgba(60,30,10,0.1)');
    g.globalCompositeOperation = 'saturation';       // 压一压火气：去三成饱和，整体往褐里沉一点
    g.fillStyle = 'rgba(128,128,128,0.4)';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(214,190,160,0.25)';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    const line = (pts, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
    for (const [a, b] of [[[0, 0], [B, B]], [[W, 0], [W - B, B]], [[0, H], [B, H - B]], [[W, H], [W - B, H - B]]]) line([a, b], 2, 'rgba(30,14,4,0.55)');
    g.strokeStyle = 'rgba(28,12,4,0.6)';
    g.lineWidth = 3;
    g.strokeRect(B, B, W - 2 * B, H - 2 * B);
    g.strokeStyle = 'rgba(255,230,190,0.12)';
    g.lineWidth = 1.5;
    g.strokeRect(B + 3, B + 3, W - 2 * B - 6, H - 2 * B - 6);
    for (let k = 1; k < 3; k++) line([[B, B + k * ph], [W - B, B + k * ph]], 1.2, 'rgba(40,20,6,0.25)');
    const grad = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.62);
    grad.addColorStop(0, 'rgba(255,236,205,0.07)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(40,18,6,0.22)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 5; i++) {                       // 旧墨渍：淡、边缘晕开
      const x = W * (0.15 + r() * 0.7), y = H * (0.2 + r() * 0.6), rad = 8 + r() * 30;
      const ink = g.createRadialGradient(x, y, 0, x, y, rad);
      ink.addColorStop(0, 'rgba(40,30,25,0.22)');
      ink.addColorStop(1, 'rgba(40,30,25,0)');
      g.fillStyle = ink;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 160; i++) {                     // 细划痕
      const x = r() * W, y = r() * H, a = (r() - 0.5) * 0.6, l = 20 + r() * 140;
      line([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 0.8, r() < 0.5 ? 'rgba(255,235,200,0.1)' : 'rgba(30,14,4,0.12)');
    }
  }
  return c;
}

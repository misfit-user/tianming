// 舆图点景：程序现画的一张小图集（松、点叶、夹叶、杂树、柳、村舍、城郭、京城），每格 64×64，竖着贴在地面上（点精灵）。
// 画法照山水画里的点景：墨线勾干、石绿石青点叶、屋顶淡墨；远看只是一点颜色，近看才认得出是什么。
// 格序见 SPRITE（着色器按格号取）。
export const SPRITE = { pine: 0, dot: 1, jia: 2, grove: 3, willow: 4, hamlet: 5, city: 6, capital: 7 };
const CELL = 64, COLS = 4, ROWS = 2;

const INK = 'rgba(38,32,26,', GREEN = [92, 140, 108], DEEP = [52, 92, 86], BLUE = [70, 112, 128];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// 可重复的随机（同一张图集每次画得一样）
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 一笔：两头尖、中间粗的墨线（按折线描成实心带）
function stroke(g, pts, w0, w1, color) {
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
    const dx = q[0] - o[0], dy = q[1] - o[1], L = Math.hypot(dx, dy) || 1;
    const t = i / (pts.length - 1);
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push([p[0] - dy / L * w, p[1] + dx / L * w]);
    right.push([p[0] + dy / L * w, p[1] - dx / L * w]);
  }
  g.beginPath();
  g.moveTo(...left[0]);
  for (const p of left.slice(1)) g.lineTo(...p);
  for (const p of right.reverse()) g.lineTo(...p);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}
function trunk(g, x, y0, y1, bend, w) {
  const pts = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([x + Math.sin(t * Math.PI) * bend, y0 + (y1 - y0) * t]); }
  stroke(g, pts, w, w * 0.35, INK + '0.92)');
}
function blob(g, x, y, rx, ry, color) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
}

const PAINT = {
  // 松：斜干，层层横出的针叶团，下沿深
  pine(g, r) {
    trunk(g, 32, 62, 12, 3, 4);
    const tiers = [[16, 13], [25, 17], [34, 20], [43, 22]];
    for (const [y, w] of tiers) {
      const x = 32 + (r() - 0.5) * 6;
      blob(g, x, y + 2.5, w, 5.5, rgba(DEEP, 0.92));
      blob(g, x - 1, y, w * 0.86, 4.2, rgba([96, 132, 118], 0.9));
      g.strokeStyle = INK + '0.55)';
      g.lineWidth = 0.9;
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (0.1 + 0.8 * k / 8), rr = w * 0.9;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * rr * (k % 2 ? -1 : 1), y - Math.sin(a) * 3.2);
        g.stroke();
      }
    }
  },
  // 点叶：圆冠由几团石绿叠成，冠上撒墨点
  dot(g, r) {
    trunk(g, 32, 62, 30, -2, 4.5);
    stroke(g, [[32, 44], [24, 36], [20, 30]], 2.2, 0.8, INK + '0.85)');
    blob(g, 32, 30, 19, 16, rgba(DEEP, 0.9));
    blob(g, 25, 26, 12, 11, rgba(GREEN, 0.95));
    blob(g, 38, 22, 12, 11, rgba(GREEN, 0.9));
    blob(g, 33, 33, 11, 8, rgba(GREEN, 0.85));
    for (let k = 0; k < 46; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 17;
      blob(g, 32 + Math.cos(a) * d, 28 + Math.sin(a) * d * 0.85, 1.4 + r() * 1.2, 1.0 + r() * 0.7, INK + (0.35 + r() * 0.4) + ')');
    }
  },
  // 夹叶：墨线勾的小圈叶，填淡石绿
  jia(g, r) {
    trunk(g, 31, 62, 26, 2, 4);
    for (let k = 0; k < 22; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 15;
      const x = 32 + Math.cos(a) * d, y = 26 + Math.sin(a) * d * 0.8;
      g.beginPath();
      g.ellipse(x, y, 4.2, 3.2, r() * Math.PI, 0, Math.PI * 2);
      g.fillStyle = rgba([150, 178, 128], 0.95);
      g.fill();
      g.strokeStyle = INK + '0.8)';
      g.lineWidth = 1;
      g.stroke();
    }
  },
  // 杂树：高低三株
  grove(g, r) {
    const trees = [[20, 40, 10], [42, 34, 13], [31, 46, 8]];
    for (const [x, top, s] of trees) {
      trunk(g, x, 62, top + s * 0.4, (r() - 0.5) * 3, 2.6);
      blob(g, x, top, s, s * 0.85, rgba(DEEP, 0.9));
      blob(g, x - s * 0.3, top - s * 0.25, s * 0.7, s * 0.6, rgba(GREEN, 0.95));
      for (let k = 0; k < 10; k++) blob(g, x + (r() - 0.5) * s * 1.4, top + (r() - 0.5) * s, 1.1, 0.8, INK + '0.6)');
    }
  },
  // 柳：干上垂下的细丝
  willow(g, r) {
    trunk(g, 32, 62, 22, 4, 5);
    g.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      const x0 = 18 + r() * 28, y0 = 14 + r() * 12, len = 18 + r() * 18;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + (r() - 0.5) * 8, y0 + len * 0.5, x0 + (r() - 0.5) * 6, y0 + len);
      g.strokeStyle = rgba([132, 160, 92], 0.85);
      g.lineWidth = 1.6;
      g.stroke();
    }
    blob(g, 32, 18, 14, 6, rgba([118, 150, 90], 0.7));
  },
  // 村舍：两间小屋，歇山顶，旁一株树
  hamlet(g, r) {
    const house = (x, y, w, h) => {
      g.fillStyle = 'rgba(236,226,204,0.97)';
      g.fillRect(x - w / 2, y - h, w, h);
      g.strokeStyle = INK + '0.85)';
      g.lineWidth = 1.2;
      g.strokeRect(x - w / 2, y - h, w, h);
      g.beginPath();
      g.moveTo(x - w / 2 - 4, y - h + 1);
      g.lineTo(x - w / 2 + 3, y - h - 8);
      g.lineTo(x + w / 2 - 3, y - h - 8);
      g.lineTo(x + w / 2 + 4, y - h + 1);
      g.closePath();
      g.fillStyle = 'rgba(92,100,104,0.95)';
      g.fill();
      g.stroke();
      g.fillStyle = INK + '0.8)';
      g.fillRect(x - 2, y - h * 0.6, 4, h * 0.6);
    };
    trunk(g, 48, 60, 34, 2, 2.6);
    blob(g, 48, 30, 9, 8, rgba(GREEN, 0.95));
    for (let k = 0; k < 12; k++) blob(g, 48 + (r() - 0.5) * 14, 30 + (r() - 0.5) * 12, 1.1, 0.8, INK + '0.55)');
    house(24, 58, 22, 11);
    house(38, 62, 16, 9);
  },
  // 城：一段雉堞城墙，中开城门，门上城楼
  city(g) { cityWall(g, 1); },
  // 京城：城墙高、城楼两重
  capital(g) { cityWall(g, 2); }
};

function cityWall(g, tiers) {
  const y = 60, h = tiers > 1 ? 16 : 13, x0 = 6, x1 = 58;
  // 墙身
  g.fillStyle = 'rgba(150,132,104,0.98)';
  g.fillRect(x0, y - h, x1 - x0, h);
  // 雉堞
  for (let x = x0; x < x1; x += 5) g.fillRect(x, y - h - 3, 3, 3);
  g.strokeStyle = INK + '0.9)';
  g.lineWidth = 1.3;
  g.strokeRect(x0, y - h, x1 - x0, h);
  // 砖缝
  g.lineWidth = 0.5;
  for (let yy = y - h + 4; yy < y; yy += 4) { g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
  // 城门
  g.fillStyle = INK + '0.92)';
  g.beginPath();
  g.moveTo(28, y);
  g.lineTo(28, y - 7);
  g.arc(32, y - 7, 4, Math.PI, 0);
  g.lineTo(36, y);
  g.closePath();
  g.fill();
  // 城楼：台、柱、檐
  let top = y - h - 3;
  for (let t = 0; t < tiers; t++) {
    const w = 26 - t * 8, bh = 7;
    g.fillStyle = 'rgba(170,58,40,0.95)';
    g.fillRect(32 - w / 2 + 2, top - bh, w - 4, bh);
    g.lineWidth = 1;
    g.strokeRect(32 - w / 2 + 2, top - bh, w - 4, bh);
    g.beginPath();
    g.moveTo(32 - w / 2 - 4, top - bh + 1);
    g.quadraticCurveTo(32 - w / 2, top - bh - 2, 32 - w / 2 + 3, top - bh - 6);
    g.lineTo(32 + w / 2 - 3, top - bh - 6);
    g.quadraticCurveTo(32 + w / 2, top - bh - 2, 32 + w / 2 + 4, top - bh + 1);
    g.closePath();
    g.fillStyle = 'rgba(52,58,62,0.97)';
    g.fill();
    g.stroke();
    top -= bh + 6;
  }
}

let atlasCanvas = null;
export function spriteAtlas() {
  if (atlasCanvas) return atlasCanvas;
  const c = document.createElement('canvas');
  c.width = CELL * COLS;
  c.height = CELL * ROWS;
  const g = c.getContext('2d');
  Object.entries(SPRITE).forEach(([name, i]) => {
    g.save();
    g.translate((i % COLS) * CELL, Math.floor(i / COLS) * CELL);
    g.beginPath();
    g.rect(0, 0, CELL, CELL);
    g.clip();
    PAINT[name](g, rng(1000 + i * 77));
    g.restore();
  });
  atlasCanvas = c;
  return c;
}
export const ATLAS = { cols: COLS, rows: ROWS };

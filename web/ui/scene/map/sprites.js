// 舆图点景：程序现画的一张小图集（松、点叶、夹叶、杂树、柳、村舍、城郭、京城，聚落各档的庄、城、帐、寨、市镇、港），每格 64×64，竖着贴在地面上（点精灵）。
// 画法照山水画里的点景：墨线勾干、石绿石青点叶、屋顶淡墨；远看只是一点颜色，近看才认得出是什么。
// 格序见 SPRITE（着色器按格号取）。
export const SPRITE = {
  pine: 0, dot: 1, jia: 2, grove: 3, willow: 4, hamlet: 5, city: 6, capital: 7,
  // 聚落各档（model/settlement.js 定档）：庄、小城、大府、都会、残城、市镇、港、帐、牙帐、寨、大寨
  hamletB: 8, town: 9, grand: 10, metro: 11, ruin: 12, market: 13, port: 14, yurtS: 15, yurtL: 16, stockS: 17, stockL: 18
};
const CELL = 64, COLS = 8, ROWS = 4;              // 着色器 spriteFragment 按 8×4 格取，改这里要一起改

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
  // 庄：人烟稠处的大村，三四间屋、一株树、一垛草
  hamletB(g, r) {
    trunk(g, 50, 60, 30, 2, 2.6);
    blob(g, 50, 26, 10, 9, rgba(GREEN, 0.95));
    for (let k = 0; k < 12; k++) blob(g, 50 + (r() - 0.5) * 15, 26 + (r() - 0.5) * 13, 1.1, 0.8, INK + '0.55)');
    house(g, 16, 56, 18, 9);
    house(g, 33, 60, 20, 10);
    house(g, 27, 50, 14, 8);
    blob(g, 46, 59, 6, 4, 'rgba(196,164,96,0.95)');
    g.strokeStyle = INK + '0.7)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.ellipse(46, 59, 6, 4, 0, Math.PI, 0);
    g.stroke();
  },
  // 小城：夯土墙，墙头无雉堞，门上一座小门楼；墙后露几间屋顶
  town(g) {
    roofs(g, 14, 50, 49, 3);
    wall(g, 8, 56, 60, 11, { fill: EARTH, crenel: false, brick: false });
    gate(g, 32, 60, 7, 7);
    tower(g, 32, 49, 14, 1, 'rgba(84,90,94,0.96)');
  },
  // 府城：砖城雉堞，中开城门，门上一重城楼；墙后屋顶
  city(g) {
    roofs(g, 12, 52, 47, 4);
    wall(g, 6, 58, 60, 13);
    gate(g, 32, 60, 8, 7);
    tower(g, 32, 44, 24, 1);
  },
  // 大府：城高，两角角楼，城门楼两重，墙后屋顶更密
  grand(g) {
    roofs(g, 10, 54, 45, 6);
    wall(g, 4, 60, 60, 15);
    gate(g, 32, 60, 8, 8);
    tower(g, 32, 42, 24, 2);
    tower(g, 8, 42, 10, 1);
    tower(g, 56, 42, 10, 1);
  },
  // 都会：城门楼两重，城里一座七级塔、一座鼓楼，屋脊连片，城外关厢也有人家
  metro(g) {
    pagoda(g, 15, 46, 7, 8);
    tower(g, 47, 45, 12, 2, ROOF);
    roofs(g, 8, 56, 45, 8);
    wall(g, 6, 58, 58, 15);
    gate(g, 32, 58, 8, 8);
    tower(g, 32, 40, 22, 2);
    house(g, 3, 63, 9, 6);
    house(g, 61, 63, 9, 6);
  },
  // 京城：外城一道，门楼两重；里头一道朱墙，殿顶黄琉璃
  capital(g) {
    g.fillStyle = 'rgba(166,54,38,0.96)';
    g.fillRect(14, 38, 36, 10);
    g.strokeStyle = INK + '0.85)';
    g.lineWidth = 1;
    g.strokeRect(14, 38, 36, 10);
    hall(g, 32, 38, 26, 7, ROOF_Y);
    hall(g, 18, 40, 12, 5, ROOF_Y);
    hall(g, 46, 40, 12, 5, ROOF_Y);
    wall(g, 2, 62, 62, 13);
    gate(g, 32, 62, 9, 8);
    tower(g, 32, 49, 26, 2);
    tower(g, 6, 49, 9, 1);
    tower(g, 58, 49, 9, 1);
  },
  // 残城：城墙断成几截、墙头焦黑，门洞塌了半边，城楼只剩两根柱子，瓦砾，一股烟，一株枯树
  ruin(g, r) {
    g.strokeStyle = INK + '0.9)';
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(56, 62); g.lineTo(55, 40); g.moveTo(55, 47); g.lineTo(49, 40); g.moveTo(55, 45); g.lineTo(61, 38); g.moveTo(52, 43); g.lineTo(50, 36);
    g.stroke();
    for (let k = 0; k < 5; k++) blob(g, 34 + k * 1.5 + (r() - 0.5) * 2, 38 - k * 6.5, 3.4 + k * 1.4, 2.6 + k * 1.1, `rgba(${92 + k * 18},${88 + k * 18},${84 + k * 18},${0.75 - k * 0.11})`);
    for (const [x0, x1, h0, h1] of [[3, 19, 13, 8], [23, 31, 15, 11], [38, 50, 9, 5]]) {
      g.beginPath();
      g.moveTo(x0, 61);
      g.lineTo(x0, 61 - h0);
      for (let x = x0 + 2; x < x1; x += 2) g.lineTo(x, 61 - h0 + (h0 - h1) * (x - x0) / (x1 - x0) + (r() - 0.5) * 3);
      g.lineTo(x1, 61 - h1);
      g.lineTo(x1, 61);
      g.closePath();
      g.fillStyle = 'rgba(126,110,90,0.97)';
      g.fill();
      g.lineWidth = 1.2;
      g.stroke();
      blob(g, (x0 + x1) / 2, 61 - Math.max(h0, h1) + 2, (x1 - x0) * 0.3, 1.6, INK + '0.5)');
    }
    g.fillStyle = INK + '0.9)';
    g.beginPath(); g.moveTo(31, 61); g.lineTo(31, 55); g.arc(34, 55, 3, Math.PI, Math.PI * 1.6); g.lineTo(35, 61); g.closePath(); g.fill();
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(25, 46); g.lineTo(25, 37); g.moveTo(30, 46); g.lineTo(29.5, 40);
    g.stroke();
    for (let k = 0; k < 16; k++) blob(g, 16 + r() * 34, 60 + r() * 3, 1.5 + r(), 1, 'rgba(104,90,74,0.92)');
  },
  // 市镇：一条小河穿镇，一座拱桥，两岸铺面，门前挑着酒旗
  market(g) {
    g.fillStyle = 'rgba(120,158,164,0.85)';
    g.beginPath(); g.ellipse(36, 59, 13, 3.2, 0, 0, Math.PI * 2); g.fill();
    house(g, 12, 58, 18, 10);
    house(g, 23, 50, 12, 8);
    house(g, 54, 58, 16, 10);
    banner(g, 4, 58, 20);
    g.strokeStyle = INK + '0.9)';
    g.fillStyle = 'rgba(176,162,138,0.98)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(27, 60); g.quadraticCurveTo(36, 47, 45, 60); g.lineTo(42, 60); g.quadraticCurveTo(36, 53, 30, 60); g.closePath();
    g.fill();
    g.stroke();
  },
  // 港：岸上一座仓，木栈伸出去，两只张帆的船泊着（水只在船底一小片，好落在弯曲的海岸上）
  port(g) {
    g.fillStyle = 'rgba(112,152,166,0.7)';
    g.beginPath(); g.ellipse(40, 60, 22, 4, 0, 0, Math.PI * 2); g.fill();
    house(g, 11, 58, 18, 10);
    g.fillStyle = 'rgba(92,70,48,0.95)';
    g.fillRect(16, 55, 30, 3);
    for (let x = 20; x <= 44; x += 6) g.fillRect(x, 55, 1.5, 6);
    junk(g, 33, 61, 18, true);
    junk(g, 53, 59, 13, true);
  },
  // 帐：两顶毡帐，一杆小旗
  yurtS(g) {
    yurt(g, 22, 60, 20, 12);
    yurt(g, 42, 58, 16, 10);
    banner(g, 52, 58, 22);
  },
  // 牙帐：大帐居中，四围小帐，一杆大纛
  yurtL(g) {
    yurt(g, 10, 56, 14, 8);
    yurt(g, 54, 56, 14, 8);
    yurt(g, 32, 60, 28, 17, 'rgba(212,176,92,0.98)');
    yurt(g, 12, 63, 16, 9);
    yurt(g, 52, 63, 16, 9);
    banner(g, 46, 44, 34, true);
  },
  // 寨：一圈尖头木栅，栅后一座吊脚楼
  stockS(g) {
    stilt(g, 30, 50, 20, 9);
    palisade(g, 6, 58, 62, 11);
  },
  // 大寨：木栅，两座吊脚楼，当中一座多重檐的鼓楼
  stockL(g) {
    stilt(g, 14, 50, 16, 8);
    stilt(g, 50, 50, 16, 8);
    drumTower(g, 32, 52, 5);
    palisade(g, 2, 62, 63, 12);
  }
};

// ---------- 点景里的器件 ----------
const STONE = 'rgba(150,132,104,0.98)', EARTH = 'rgba(178,148,104,0.98)', ROOF = 'rgba(52,58,62,0.97)', ROOF_Y = 'rgba(214,166,58,0.98)', PILLAR = 'rgba(170,58,40,0.95)';
// 一段城墙：x0～x1，墙脚在 y，高 h；crenel 雉堞，brick 砖缝
function wall(g, x0, x1, y, h, { fill = STONE, crenel = true, brick = true } = {}) {
  g.fillStyle = fill;
  g.fillRect(x0, y - h, x1 - x0, h);
  if (crenel) for (let x = x0; x < x1 - 1; x += 5) g.fillRect(x, y - h - 3, 3, 3);
  g.strokeStyle = INK + '0.9)';
  g.lineWidth = 1.3;
  g.strokeRect(x0, y - h, x1 - x0, h);
  if (brick) {
    g.lineWidth = 0.5;
    for (let yy = y - h + 4; yy < y; yy += 4) { g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
  }
}
// 城门洞：中线 cx，脚在 y，宽 w，高 h（含拱）
function gate(g, cx, y, w, h) {
  g.fillStyle = INK + '0.92)';
  g.beginPath();
  g.moveTo(cx - w / 2, y);
  g.lineTo(cx - w / 2, y - h + w / 2);
  g.arc(cx, y - h + w / 2, w / 2, Math.PI, 0);
  g.lineTo(cx + w / 2, y);
  g.closePath();
  g.fill();
}
// 一座楼：台顶在 top，宽 w，tiers 重檐；返回楼顶的高度
function tower(g, cx, top, w, tiers, roof = ROOF) {
  for (let t = 0; t < tiers; t++) {
    const ww = w - t * w * 0.3, bh = Math.max(4, w * 0.27);
    g.fillStyle = PILLAR;
    g.fillRect(cx - ww / 2 + 2, top - bh, ww - 4, bh);
    g.strokeStyle = INK + '0.9)';
    g.lineWidth = 1;
    g.strokeRect(cx - ww / 2 + 2, top - bh, ww - 4, bh);
    eave(g, cx, top - bh + 1, ww, Math.max(3.5, ww * 0.23), roof);
    top -= bh + Math.max(3.5, ww * 0.23);
  }
  return top;
}
// 一道檐：中线 cx，檐口在 y，宽 w，高 h，两头起翘
function eave(g, cx, y, w, h, color) {
  g.beginPath();
  g.moveTo(cx - w / 2 - 4, y);
  g.quadraticCurveTo(cx - w / 2, y - h * 0.35, cx - w / 2 + 3, y - h);
  g.lineTo(cx + w / 2 - 3, y - h);
  g.quadraticCurveTo(cx + w / 2, y - h * 0.35, cx + w / 2 + 4, y);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = INK + '0.9)';
  g.lineWidth = 1;
  g.stroke();
}
// 殿：檐下一截朱墙，上一道大顶
function hall(g, cx, y, w, h, roof) {
  g.fillStyle = PILLAR;
  g.fillRect(cx - w / 2 + 2, y - h * 0.5, w - 4, h * 0.5);
  eave(g, cx, y - h * 0.5 + 1, w, h * 0.75, roof);
}
// 屋：中线 x，脚在 y，宽 w，墙高 h
function house(g, x, y, w, h, roof = 'rgba(92,100,104,0.95)') {
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
  g.fillStyle = roof;
  g.fill();
  g.stroke();
  g.fillStyle = INK + '0.8)';
  g.fillRect(x - 2, y - h * 0.6, 4, h * 0.6);
}
// 墙后露出的一溜屋脊：x0～x1 之间 n 道，檐口在 y
function roofs(g, x0, x1, y, n) {
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + step * (i + 0.5), dy = (i % 2) * 3;
    eave(g, cx, y + dy, step * 0.8, 5, i % 3 === 1 ? 'rgba(80,88,92,0.96)' : 'rgba(96,104,108,0.95)');
  }
}
// 七级塔：底在 y，levels 级，底宽 w，越往上越窄，顶一根刹
function pagoda(g, x, y, levels, w) {
  let top = y;
  for (let i = 0; i < levels; i++) {
    const ww = w * (1 - i * 0.07), bh = 3.2;
    g.fillStyle = 'rgba(206,190,160,0.98)';
    g.fillRect(x - ww / 2 + 1.5, top - bh, ww - 3, bh);
    g.strokeStyle = INK + '0.85)';
    g.lineWidth = 0.8;
    g.strokeRect(x - ww / 2 + 1.5, top - bh, ww - 3, bh);
    eave(g, x, top - bh + 0.5, ww * 0.8, 2.4, ROOF);
    top -= bh + 2.4;
  }
  g.strokeStyle = INK + '0.9)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(x, top - 6);
  g.stroke();
}
// 毡帐：脚在 y，宽 w，高 h；圆顶，顶上一圈天窗
function yurt(g, x, y, w, h, felt = 'rgba(238,232,216,0.98)') {
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.lineTo(x - w / 2, y - h * 0.45);
  g.quadraticCurveTo(x - w / 2, y - h, x, y - h);
  g.quadraticCurveTo(x + w / 2, y - h, x + w / 2, y - h * 0.45);
  g.lineTo(x + w / 2, y);
  g.closePath();
  g.fillStyle = felt;
  g.fill();
  g.strokeStyle = INK + '0.85)';
  g.lineWidth = 1.1;
  g.stroke();
  g.beginPath();
  g.moveTo(x - w / 2, y - h * 0.45);
  g.lineTo(x + w / 2, y - h * 0.45);
  g.lineWidth = 0.8;
  g.stroke();
  g.fillStyle = INK + '0.8)';
  g.fillRect(x - 2, y - h * 0.36, 4, h * 0.36);
  g.fillRect(x - w * 0.12, y - h - 1, w * 0.24, 2);
}
// 旗杆：脚在 y，高 h；big 为大纛（垂着一束毛缨）
function banner(g, x, y, h, big = false) {
  g.strokeStyle = INK + '0.9)';
  g.lineWidth = big ? 1.6 : 1.2;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - h);
  g.stroke();
  g.fillStyle = big ? 'rgba(60,54,48,0.95)' : 'rgba(170,58,40,0.95)';
  if (big) { g.beginPath(); g.moveTo(x - 3, y - h + 2); g.lineTo(x + 3, y - h + 2); g.lineTo(x + 1.5, y - h + 12); g.lineTo(x - 1.5, y - h + 12); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 9, y - h + 2.5); g.lineTo(x, y - h + 5.5); g.closePath(); g.fill(); }
}
// 木栅：x0～x1，脚在 y，高 h；一根根尖头木
function palisade(g, x0, x1, y, h) {
  for (let x = x0; x < x1; x += 3.2) {
    const hh = h * (0.86 + 0.14 * Math.sin(x * 1.7));
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - hh);
    g.lineTo(x + 1.4, y - hh - 2.4);
    g.lineTo(x + 2.8, y - hh);
    g.lineTo(x + 2.8, y);
    g.closePath();
    g.fillStyle = 'rgba(132,100,70,0.97)';
    g.fill();
    g.strokeStyle = INK + '0.8)';
    g.lineWidth = 0.7;
    g.stroke();
  }
  g.strokeStyle = INK + '0.85)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x0, y - h * 0.55);
  g.lineTo(x1, y - h * 0.55);
  g.stroke();
}
// 吊脚楼：楼身在 y 处架空，宽 w，高 h；脚下几根柱，上一道草顶
function stilt(g, x, y, w, h) {
  g.strokeStyle = INK + '0.85)';
  g.lineWidth = 1.1;
  for (const dx of [-w / 2 + 2, 0, w / 2 - 2]) { g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx, y + 8); g.stroke(); }
  g.fillStyle = 'rgba(180,140,96,0.97)';
  g.fillRect(x - w / 2, y - h, w, h);
  g.strokeRect(x - w / 2, y - h, w, h);
  eave(g, x, y - h + 1, w + 2, 7, 'rgba(150,128,82,0.97)');
}
// 鼓楼：多重檐的木楼，脚在 y，levels 重
function drumTower(g, x, y, levels) {
  g.fillStyle = 'rgba(180,140,96,0.97)';
  g.fillRect(x - 4, y - 8, 8, 8);
  g.strokeStyle = INK + '0.85)';
  g.lineWidth = 1;
  g.strokeRect(x - 4, y - 8, 8, 8);
  let top = y - 7;
  for (let i = 0; i < levels; i++) {
    const ww = 18 - i * 3;
    eave(g, x, top, ww, 3.6, 'rgba(88,92,90,0.96)');
    top -= 5.2;
  }
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(x, top + 1);
  g.lineTo(x, top - 4);
  g.stroke();
}
// 帆船：吃水线在 y，长 w；sail 张帆（褐红篷帆，横着几道竹骨）
function junk(g, x, y, w, sail) {
  g.beginPath();
  g.moveTo(x - w / 2, y - 3.5);
  g.quadraticCurveTo(x, y + 1.5, x + w / 2, y - 4.5);
  g.lineTo(x + w / 2 - 2, y - 1);
  g.lineTo(x - w / 2 + 2, y - 1);
  g.closePath();
  g.fillStyle = 'rgba(96,72,50,0.97)';
  g.fill();
  g.strokeStyle = INK + '0.9)';
  g.lineWidth = 1;
  g.stroke();
  if (!sail) return;
  g.beginPath();
  g.moveTo(x - 1, y - 3);
  g.lineTo(x - 1, y - 3 - w * 0.9);
  g.stroke();
  g.beginPath();
  g.moveTo(x - 0.5, y - 4);
  g.lineTo(x - 0.5, y - 3 - w * 0.85);
  g.quadraticCurveTo(x + w * 0.42, y - 3 - w * 0.7, x + w * 0.38, y - 5);
  g.closePath();
  g.fillStyle = 'rgba(166,84,52,0.95)';
  g.fill();
  g.stroke();
  g.lineWidth = 0.6;
  for (let k = 1; k < 4; k++) { const yy = y - 4 - w * 0.2 * k; g.beginPath(); g.moveTo(x - 0.5, yy); g.lineTo(x + w * 0.38, yy + 1.2); g.stroke(); }
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

// 舆图数据预处理：真实高程与山河境矢量（海岸、河湖）＋剧本府州 → 着色器要的几张场。
// 世界坐标：每度 20 像素，经 55°E、纬 67°N 为原点，2100 × 1540（与山河境 web/vendor/shanhe25d 一致）。
// 地形场与剧本无关（日后由 tools/ui-art 预先算好入资产）；府州编号与势力分界随剧本、随易主而变。

export const W = 2100;
export const H = 1540;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图载入失败：' + url));
    img.src = url;
  });
}

function pixels(img, w = img.width, h = img.height) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

// 真实高程（dem.png，4200×3080）：值 = 海拔(米) + 11000。归一成「海拔 / 6000」，海里是负数（留着画海深）
// hi 是原分辨率，lo 是 2×2 平均降到世界网格（2100×1540），派生场都在 lo 上算
export const DEM_SCALE = 6000;
export function decodeDem(img) {
  const w = img.width, h = img.height;
  const px = pixels(img);
  const hi = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hi[i] = (px[i * 4] * 256 + px[i * 4 + 1] - 11000) / DEM_SCALE;
  const lo = new Float32Array(W * H);
  const sx = w / W, sy = h / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) { sum += hi[(y * sy + dy) * w + x * sx + dx]; n++; }
      lo[y * W + x] = sum / n;
    }
  }
  return { hi, lo, width: w, height: h };
}

// 一维平方距离变换（Felzenszwalb & Huttenlocher）
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

// 二维欧氏距离（像素）：inside[i] 为真的点到最近「非 inside」点的距离
function distanceField(inside, w, h) {
  const INF = 1e20;
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = inside[i] ? INF : 0;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]);
  }
  return grid;
}

// 海岸：陆地轮廓填满后算有符号距离（陆上为正，海里为负，单位为世界像素）
export function coastField(env) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  for (const p of env.landPaths) g.fill(new Path2D(p.d), 'evenodd');
  const px = g.getImageData(0, 0, W, H).data;
  const land = new Uint8Array(W * H), sea = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const a = px[i * 4 + 3] / 255;
    land[i] = a >= 0.5 ? 1 : 0;
    sea[i] = 1 - land[i];
  }
  const dIn = distanceField(land, W, H), dOut = distanceField(sea, W, H);
  const out = new Float32Array(W * H);
  // 半像素修正让 0 等值线落在两像素之间
  for (let i = 0; i < W * H; i++) out[i] = land[i] ? dIn[i] - 0.5 : -(dOut[i] - 0.5);
  return out;
}

// 河湖：2 倍分辨率画线。R 通道是干流与湖，G 通道是支流（着色器里随缩放淡出）
export function riverMask(env, scale = 2) {
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.scale(scale, scale);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgb(0,255,0)';
  g.lineWidth = 0.6;
  for (const r of env.rivers) if (!r.major) g.stroke(new Path2D(r.d));
  g.strokeStyle = 'rgb(255,0,0)';
  g.lineWidth = 1.3;
  for (const r of env.rivers) if (r.major) g.stroke(new Path2D(r.d));
  // 湖是三角面列表（每 6 个数一个三角形），算作干流通道
  g.fillStyle = 'rgb(255,0,0)';
  g.beginPath();
  for (const lake of env.lakeFaces) {
    const f = lake.f;
    for (let i = 0; i + 5 < f.length; i += 6) {
      g.moveTo(f[i], f[i + 1]);
      g.lineTo(f[i + 2], f[i + 3]);
      g.lineTo(f[i + 4], f[i + 5]);
      g.closePath();
    }
  }
  g.fill();
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const out = new Uint8Array(c.width * c.height * 2);
  // getImageData 给的是去预乘的颜色，边缘覆盖率在 alpha 里，要乘回去
  for (let i = 0; i < c.width * c.height; i++) {
    const a = px[i * 4 + 3] / 255;
    out[i * 2] = Math.round(px[i * 4] * a);
    out[i * 2 + 1] = Math.round(px[i * 4 + 1] * a);
  }
  return { data: out, width: c.width, height: c.height };
}

// 府州编号图：自己做扫描线填充（奇偶规则），不经 Canvas 的抗锯齿，编号逐像素准确。0 表示不属任何府州
export function regionIdMap(regions, scale = 2) {
  const w = W * scale, h = H * scale;
  const ids = new Uint16Array(w * h);
  const xs = [];
  regions.forEach((region, index) => {
    const id = index + 1;
    const pts = region.poly;
    if (!pts || pts.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const y0 = Math.max(0, Math.floor(minY * scale)), y1 = Math.min(h - 1, Math.ceil(maxY * scale));
    for (let y = y0; y <= y1; y++) {
      const sy = (y + 0.5) / scale;
      xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > sy) !== (yj > sy)) xs.push(xi + (sy - yi) / (yj - yi) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] * scale - 0.5)), xb = Math.min(w - 1, Math.floor(xs[k + 1] * scale - 0.5));
        for (let x = xa; x <= xb; x++) ids[y * w + x] = id;
      }
    }
  });
  return { data: ids, width: w, height: h };
}

// 可分离盒式模糊，三遍近似高斯
export function blur(src, w, h, radius, passes = 3) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const r = Math.max(1, Math.round(radius));
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      const row = y * w;
      for (let x = -r; x <= r; x++) sum += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = sum / (2 * r + 1);
        sum += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum / (2 * r + 1);
        sum += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

// 滑动窗口极值（单调队列，一行一列各一遍，O(n)）：isMax 为真取最大，否则取最小
function slideExtreme(src, w, h, r, isMax) {
  const better = isMax ? (a, b) => a >= b : (a, b) => a <= b;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const dq = new Int32Array(Math.max(w, h) + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let head = 0, tail = 0;
    for (let i = 0; i < w + r; i++) {
      if (i < w) {
        const v = src[row + i];
        while (tail > head && better(v, src[row + dq[tail - 1]])) tail--;
        dq[tail++] = i;
      }
      const x = i - r;
      if (x < 0) continue;
      while (dq[head] < x - r) head++;
      tmp[row + x] = src[row + dq[head]];
    }
  }
  for (let x = 0; x < w; x++) {
    let head = 0, tail = 0;
    for (let i = 0; i < h + r; i++) {
      if (i < h) {
        const v = tmp[i * w + x];
        while (tail > head && better(v, tmp[dq[tail - 1] * w + x])) tail--;
        dq[tail++] = i;
      }
      const y = i - r;
      if (y < 0) continue;
      while (dq[head] < y - r) head++;
      out[y * w + x] = tmp[dq[head] * w + x];
    }
  }
  return out;
}

// 局部起伏范围：每点方圆 radius 内的最低与最高（再糊开免得出方块）。
// 着色器拿「(高 − 最低) / (最高 − 最低)」当这一点在本座山里的高低位置——山脚 0，山巅 1
export function localRange(height, w, h, radius, soften) {
  const lo = blur(slideExtreme(height, w, h, radius, false), w, h, soften, 3);
  const hi = blur(slideExtreme(height, w, h, radius, true), w, h, soften, 3);
  return { lo, hi };
}

// 到势力分界的距离（世界像素）：编号图降到 1 倍取势力，相邻势力不同处为界
export function realmBorderDistance(ids, regionRealm) {
  const scale = ids.width / W;
  const realm = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const id = ids.data[(y * scale) * ids.width + x * scale];
      realm[y * W + x] = id ? regionRealm[id] : -1;
    }
  }
  const notBorder = new Uint8Array(W * H).fill(1);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, r = realm[i];
      if (r < 0) continue;
      const n = [realm[i - 1], realm[i + 1], realm[i - W], realm[i + W]];
      if (n.some((v) => v >= 0 && v !== r)) notBorder[i] = 0;
    }
  }
  return distanceField(notBorder, W, H);
}

// 势力：按府州面积加权求题名位置，面积也用来定字号
export function realms(data) {
  const acc = {};
  data.regions.forEach((r) => {
    if (!r.faction) return;
    let area = 0, cx = 0, cy = 0;
    const p = r.poly;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const cross = p[j][0] * p[i][1] - p[i][0] * p[j][1];
      area += cross;
      cx += (p[j][0] + p[i][0]) * cross;
      cy += (p[j][1] + p[i][1]) * cross;
    }
    area /= 2;
    if (Math.abs(area) < 1e-6) return;
    cx /= 6 * area;
    cy /= 6 * area;
    const a = Math.abs(area);
    const f = acc[r.faction] || (acc[r.faction] = { id: r.faction, area: 0, x: 0, y: 0 });
    f.area += a;
    f.x += cx * a;
    f.y += cy * a;
  });
  return Object.values(acc).map((f) => ({ ...f, x: f.x / f.area, y: f.y / f.area, name: data.factions[f.id].name, color: data.factions[f.id].color }));
}

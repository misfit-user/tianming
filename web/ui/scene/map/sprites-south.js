// 舆图点景小图里的大越、南洋诸国、西洋据点诸样（同 sprites-east.js 一路）：照立体模型（towns3d-south.js）的样子画——
// 红瓦翘角的砖城与门楼、三关门与砖塔、钟形佛塔与砖塔、层层收顶的尖阁、高脚屋与椰、棱堡与教堂、西洋帆船……
// 格号由 sprites.js 按这里返回的次序接在日本、朝鲜诸样之后；哪一地域的哪一样用哪一格见 SOUTH_SPRITE_LOCAL。
export function southPainters(kit) {
  const { INK, rgba, stroke, blob, wall, gate, junk, palisade, rect, poly, slope, curved, ruinWall, smokeCol, deadTree, rubble } = kit;
  const ink = (a) => `${INK}${a})`;
  // 大越（照 towns3d-south.js 的 S）
  const VWALL = 'rgba(178,160,136,0.98)', VROOF = 'rgba(160,96,76,0.97)', VROOF2 = 'rgba(142,86,70,0.97)', VPILLAR = 'rgba(150,62,46,0.96)';
  const WHITE = 'rgba(242,236,220,0.98)', YROOF = 'rgba(214,166,58,0.98)', EARTH_W = 'rgba(196,170,128,0.97)', TERRACE = 'rgba(184,160,128,0.98)';
  const VBRICK = 'rgba(170,122,98,0.98)';
  // 南洋
  const BRICK = 'rgba(174,112,86,0.98)', BRICK_D = 'rgba(156,100,78,0.98)', THATCH = 'rgba(170,146,100,0.97)', GOLD = 'rgba(224,180,66,0.98)';
  const BAMBOO = 'rgba(188,154,108,0.97)', TROOF = 'rgba(196,96,56,0.97)', TROOF_EDGE = 'rgba(74,126,96,0.97)', RED_WALL = 'rgba(170,62,44,0.96)';
  // 西洋
  const FORT = 'rgba(212,198,172,0.98)', FORT_D = 'rgba(190,176,150,0.98)', CHURCH = 'rgba(244,236,214,0.98)', TILE = 'rgba(184,100,74,0.97)';
  const STONE_W = 'rgba(194,182,158,0.98)', CANVAS = 'rgba(240,232,212,0.97)', PAVING = 'rgba(214,204,182,0.9)';
  const WATER = 'rgba(112,152,166,0.86)', HULL = 'rgba(100,76,56,0.97)', SAIL = 'rgba(240,234,216,0.97)', MAT = 'rgba(204,180,132,0.97)', PIER = 'rgba(92,70,48,0.95)';
  const FROND = 'rgba(82,132,76,0.95)', FROND_D = 'rgba(64,108,62,0.95)', PALM_TRUNK = 'rgba(126,106,82,0.95)', RED_FLAG = 'rgba(196,52,44,0.95)';

  // ---------- 共用的器件 ----------
  function water(g, x0, x1, y, h = 3) {
    g.fillStyle = WATER;
    g.fillRect(x0, y - h, x1 - x0, h);
  }
  function pool(g, x, y, rx, ry) {
    g.fillStyle = WATER;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  function pier(g, x0, x1, y) {
    g.fillStyle = PIER;
    g.fillRect(x0, y, x1 - x0, 2.2);
    for (let x = x0 + 3; x <= x1 - 1; x += 5.5) g.fillRect(x, y, 1.4, 5.5);
  }
  function flag(g, x, y, h, color) {
    g.strokeStyle = ink(0.9);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - h);
    g.stroke();
    poly(g, [[x, y - h], [x + 7, y - h + 1.4], [x + 6.4, y - h + 4.6], [x, y - h + 5]], color, 0.6);
  }
  // 椰（槟榔）：细干略弯，顶上一蓬垂下的羽叶；脚在 y，高 h，lean 顶往右偏多少
  function palm(g, x, y, h, lean = 0) {
    stroke(g, [[x, y], [x + lean * 0.3, y - h * 0.5], [x + lean, y - h]], 2.1, 1.1, PALM_TRUNK);
    const tx = x + lean, ty = y - h;
    g.lineCap = 'round';
    for (const [a, col] of [[0.06, FROND_D], [0.94, FROND_D], [0.22, FROND], [0.78, FROND], [0.38, FROND], [0.62, FROND], [0.5, FROND_D]]) {
      const c = Math.cos(a * Math.PI), sn = Math.sin(a * Math.PI), L = 7.6;
      g.strokeStyle = col;
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + c * L * 0.6, ty - 2.2 - sn * 2.6, tx + c * L, ty + 3 - sn * 2.4);
      g.stroke();
    }
    g.lineCap = 'butt';
    blob(g, tx, ty + 0.4, 1.3, 1, 'rgba(110,90,60,0.9)');
  }
  // 高脚屋（南洋、西洋据点城外的尼巴屋）：几根柱架起楼身，陡的草两坡顶；脚在 y，宽 w，楼身高 h，架起 raise
  function nipa(g, x, y, w, h = 3.6, raise = 3, roof = THATCH) {
    g.strokeStyle = 'rgba(110,86,62,0.95)';
    g.lineWidth = 0.9;
    g.beginPath();
    for (const dx of [-w / 2 + 1, 0, w / 2 - 1]) {
      g.moveTo(x + dx, y);
      g.lineTo(x + dx, y - raise);
    }
    g.stroke();
    rect(g, x - w / 2, y - raise - h, w, h, BAMBOO, 0.8);
    g.fillStyle = ink(0.75);
    g.fillRect(x - 1, y - raise - h + 0.8, 2, h - 0.8);
    poly(g, [[x - w / 2 - 1.8, y - raise - h + 0.6], [x - w * 0.12, y - raise - h - w * 0.62], [x + w * 0.12, y - raise - h - w * 0.62], [x + w / 2 + 1.8, y - raise - h + 0.6]], roof, 0.8);
  }

  // ---------- 大越的器件 ----------
  // 红瓦顶：檐口两头翘、中间垂；dragon 时脊两头各一道上卷的龙尾（寺、庙、门楼）
  function vroof(g, cx, y, w, h, color = VROOF, dragon = true) {
    curved(g, cx, y, w, h, color, 3, 0.5, 0.9);
    if (!dragon) return;
    const ty = y - h * 0.5;
    for (const sx of [-1, 1]) {
      const x = cx + sx * (w / 2 + 3);
      stroke(g, [[x - sx * 1.2, ty + 0.6], [x + sx * 0.4, ty - 1.4], [x - sx * 0.4, ty - 3]], 1.4, 0.5, color);
    }
  }
  // 门楼：朱褐柱身、红瓦翘角，tiers 重；台顶在 top，宽 w
  function vTower(g, cx, top, w, tiers, roof = VROOF) {
    for (let t = 0; t < tiers; t++) {
      const ww = w - t * w * 0.3, bh = Math.max(3.6, w * 0.22), rh = Math.max(3.6, ww * 0.26);
      rect(g, cx - ww / 2 + 2, top - bh, ww - 4, bh, VPILLAR, 0.9);
      vroof(g, cx, top - bh + 1, ww, rh, roof);
      top -= bh + rh - 1;
    }
  }
  // 屋：白墙（或土墙）、红瓦（或草）顶；脚在 y，宽 w，墙高 h
  function vHouse(g, x, y, w, h = 4, roof = VROOF, wallc = WHITE) {
    rect(g, x - w / 2, y - h, w, h, wallc, 0.8);
    g.fillStyle = ink(0.8);
    g.fillRect(x - 1.2, y - h * 0.75, 2.4, h * 0.75);
    curved(g, x, y - h + 0.6, w, 4, roof, 2.2, 0.42, 0.8);
  }
  // 墙后露出的红瓦屋顶一溜
  function redRoofs(g, list) {
    for (const [x, y, w] of list) curved(g, x, y, w, 4, VROOF, 2, 0.42, 0.8);
  }
  // 砖塔（寺塔）：方身一级级收，每级一道薄檐；顶一根刹
  function vStupa(g, x, y, levels, w) {
    let top = y;
    for (let i = 0; i < levels; i++) {
      const ww = w * (1 - i * 0.08), bh = 2.8;
      rect(g, x - ww / 2, top - bh, ww, bh, VBRICK, 0.6);
      slope(g, x, top - bh + 0.4, ww, 1.3, VROOF2, 1, 0.4, 0.5);
      top -= bh + 1.3 - 0.4;
    }
    g.strokeStyle = ink(0.9);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x, top - 4);
    g.stroke();
  }
  // 白墙一道，上压一线红瓦
  function whiteWall(g, x0, x1, y, h) {
    rect(g, x0, y - h, x1 - x0, h, WHITE, 0.9);
    rect(g, x0 - 0.6, y - h - 1.5, x1 - x0 + 1.2, 1.6, VROOF, 0.6);
  }

  // ---------- 南洋的器件 ----------
  // 钟形佛塔：三层方台，钟形的身，上一截金尖刹（几道环）；gilt 通身金
  function stupa(g, x, y, s, gilt = false) {
    const body = gilt ? GOLD : WHITE;
    rect(g, x - 7 * s, y - 2 * s, 14 * s, 2 * s, body, 0.7);
    rect(g, x - 5.6 * s, y - 4 * s, 11.2 * s, 2 * s, body, 0.7);
    rect(g, x - 4.4 * s, y - 5.6 * s, 8.8 * s, 1.6 * s, body, 0.6);
    g.beginPath();
    g.moveTo(x - 4.2 * s, y - 5.6 * s);
    g.quadraticCurveTo(x - 4.4 * s, y - 12 * s, x, y - 13.6 * s);
    g.quadraticCurveTo(x + 4.4 * s, y - 12 * s, x + 4.2 * s, y - 5.6 * s);
    g.closePath();
    g.fillStyle = body;
    g.fill();
    g.strokeStyle = ink(0.85);
    g.lineWidth = 0.8;
    g.stroke();
    poly(g, [[x - 1.6 * s, y - 13 * s], [x, y - 23 * s], [x + 1.6 * s, y - 13 * s]], GOLD, 0.6);
    g.strokeStyle = ink(0.4);
    g.lineWidth = 0.5;
    for (let k = 1; k <= 4; k++) {
      const yy = y - 13 * s - k * 1.8 * s, hw = 1.6 * s * (1 - k * 0.18);
      g.beginPath();
      g.moveTo(x - hw, yy);
      g.lineTo(x + hw, yy);
      g.stroke();
    }
  }
  // 砖塔（占婆、真腊那样）：方台，身一节节收，正面一道尖拱的假门，顶一个圆锥
  function prang(g, x, y, s = 1) {
    rect(g, x - 6 * s, y - 2.6 * s, 12 * s, 2.6 * s, BRICK_D, 0.7);
    let top = y - 2.6 * s, w = 9 * s;
    for (let i = 0; i < 4; i++) {
      const h = (i ? 2.6 : 7) * s;
      rect(g, x - w / 2, top - h, w, h, BRICK, 0.7);
      if (!i) {
        g.fillStyle = ink(0.85);
        g.beginPath();
        g.moveTo(x - 1.4 * s, top);
        g.lineTo(x - 1.4 * s, top - 4 * s);
        g.lineTo(x, top - 5.4 * s);
        g.lineTo(x + 1.4 * s, top - 4 * s);
        g.lineTo(x + 1.4 * s, top);
        g.closePath();
        g.fill();
      }
      top -= h;
      w *= 0.8;
    }
    poly(g, [[x - w / 2, top], [x, top - 5 * s], [x + w / 2, top]], BRICK, 0.7);
  }
  // 层层收顶的尖阁（王宫、王府、营堂）：n 层陡顶一层比一层小，层间一道金边，顶上金刹；底檐在 y，宽 w
  function tiered(g, x, y, w, n, color = VROOF2, h = 4) {
    let top = y, ww = w;
    for (let i = 0; i < n; i++) {
      slope(g, x, top, ww, h, color, 1.6, ww * 0.2, 0.8);
      if (i < n - 1) {
        g.fillStyle = GOLD;
        g.fillRect(x - ww * 0.3, top - h - 0.4, ww * 0.6, 0.9);
      }
      top -= h - 0.6;
      ww *= 0.72;
    }
    poly(g, [[x - 0.9, top + 0.6], [x, top - 5], [x + 0.9, top + 0.6]], GOLD, 0.5);
  }
  // 泰式佛殿：白墙，山墙朝前，屋顶三层叠起（橙红、绿边），每层山尖一道金色的鸱尾
  function wat(g, x, y, w) {
    rect(g, x - w / 2, y - 6, w, 6, WHITE, 0.8);
    g.fillStyle = ink(0.8);
    g.fillRect(x - 1.6, y - 4.6, 3.2, 4.6);
    for (const dx of [-w * 0.32, w * 0.32]) g.fillRect(x + dx - 0.8, y - 4.4, 1.6, 2.2);
    for (const [dy, ww, hh] of [[-6.4, w * 0.56, 10], [-3.4, w * 0.8, 9], [0, w + 4, 7.5]]) {
      const base = y - 6 + dy + 0.6;
      poly(g, [[x - ww / 2, base], [x, base - hh], [x + ww / 2, base]], TROOF, 0.7);
      g.strokeStyle = TROOF_EDGE;
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(x - ww / 2 + 0.6, base - 0.4);
      g.lineTo(x, base - hh + 0.6);
      g.lineTo(x + ww / 2 - 0.6, base - 0.4);
      g.stroke();
      stroke(g, [[x, base - hh + 0.5], [x + 0.4, base - hh - 1.6], [x + 1.6, base - hh - 2.6]], 1.3, 0.5, GOLD);
    }
  }
  // 草葺的市棚、讲亭：几根柱，一道长长的草顶；脚在 y，宽 w
  function shed(g, x, y, w, roof = THATCH) {
    g.strokeStyle = 'rgba(110,86,62,0.95)';
    g.lineWidth = 0.9;
    g.beginPath();
    for (let dx = -w / 2 + 1; dx <= w / 2 - 0.9; dx += Math.max(4, (w - 2) / 3)) {
      g.moveTo(x + dx, y);
      g.lineTo(x + dx, y - 4.2);
    }
    g.stroke();
    for (let k = 0; k < 3; k++) blob(g, x - w / 3 + k * w / 3, y - 1, 1.6, 1.1, 'rgba(176,140,96,0.95)');
    slope(g, x, y - 3.8, w, 4.6, roof, 1.8, w * 0.22, 0.8);
  }
  // 小舟：两头尖的船身，船心一堆货
  function canoe(g, x, y, w) {
    g.beginPath();
    g.moveTo(x - w / 2, y - 2.4);
    g.quadraticCurveTo(x, y + 1.4, x + w / 2, y - 2.4);
    g.quadraticCurveTo(x, y - 0.6, x - w / 2, y - 2.4);
    g.closePath();
    g.fillStyle = HULL;
    g.fill();
    g.strokeStyle = ink(0.85);
    g.lineWidth = 0.6;
    g.stroke();
    blob(g, x - 0.6, y - 2, 2, 1.2, 'rgba(176,146,98,0.95)');
  }
  // 带边架的帆舟（吕宋、马来那样）：细长两头尖的船身，船身下一根浮木两道横杆架着；一根桅、一面斜张的席帆。吃水线 y，长 w
  function prahu(g, x, y, w) {
    g.strokeStyle = ink(0.8);
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x - w * 0.24, y - 2);
    g.lineTo(x - w * 0.26, y + 1.4);
    g.moveTo(x + w * 0.2, y - 2);
    g.lineTo(x + w * 0.22, y + 1.4);
    g.stroke();
    g.fillStyle = HULL;
    g.fillRect(x - w * 0.36, y + 0.8, w * 0.7, 1.1);
    g.beginPath();
    g.moveTo(x - w / 2, y - 3.4);
    g.quadraticCurveTo(x, y + 1, x + w / 2, y - 3.4);
    g.lineTo(x + w / 2 - 2, y - 2.2);
    g.lineTo(x - w / 2 + 2, y - 2.2);
    g.closePath();
    g.fill();
    g.stroke();
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x - 1, y - 2.4);
    g.lineTo(x + 0.6, y - w * 0.95);
    g.stroke();
    poly(g, [[x - w * 0.32, y - 4.6], [x - w * 0.02, y - w * 1.02], [x + w * 0.34, y - w * 0.84], [x + w * 0.08, y - 5.2]], MAT, 0.7);
    g.strokeStyle = ink(0.3);
    g.lineWidth = 0.5;
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      g.beginPath();
      g.moveTo(x - w * 0.32 + w * 0.3 * t, y - 4.6 - (w * 1.02 - 4.6) * t);
      g.lineTo(x + w * 0.08 + w * 0.26 * t, y - 5.2 - (w * 0.84 - 5.2) * t);
      g.stroke();
    }
  }

  // ---------- 西洋的器件 ----------
  // 十字：一竖一横
  function cross(g, x, y, h) {
    g.strokeStyle = ink(0.9);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - h);
    g.moveTo(x - h * 0.28, y - h * 0.7);
    g.lineTo(x + h * 0.28, y - h * 0.7);
    g.stroke();
  }
  // 钟楼：白墙方身，上头一排拱洞，四坡红瓦小顶，顶上十字；脚在 y，宽 w、高 h
  function belfry(g, x, y, w, h) {
    rect(g, x - w / 2, y - h, w, h, CHURCH, 0.8);
    g.fillStyle = ink(0.85);
    g.beginPath();
    g.moveTo(x - w * 0.22, y - h + 5);
    g.lineTo(x - w * 0.22, y - h + 2.6);
    g.arc(x, y - h + 2.6, w * 0.22, Math.PI, 0);
    g.lineTo(x + w * 0.22, y - h + 5);
    g.closePath();
    g.fill();
    g.strokeStyle = ink(0.5);
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(x - w / 2, y - h + 6.2);
    g.lineTo(x + w / 2, y - h + 6.2);
    g.stroke();
    poly(g, [[x - w / 2 - 0.8, y - h], [x, y - h - w * 0.62], [x + w / 2 + 0.8, y - h]], TILE, 0.7);
    cross(g, x, y - h - w * 0.62, 3.6);
  }
  // 教堂正面：白墙，一堵高出屋脊的山花墙（两肩巴洛克的涡卷）、黑拱门、一扇圆窗，顶上十字；tower 1 左后一座钟楼、2 两座
  function church(g, x, y, w, h, tower = 1) {
    if (tower) belfry(g, x - w / 2 - 1.5, y, 7, h + 9);
    if (tower === 2) belfry(g, x + w / 2 + 1.5, y, 7, h + 9);
    poly(g, [[x - w / 2, y], [x - w / 2, y - h], [x - w * 0.32, y - h], [x - w * 0.22, y - h - 3.6], [x - w * 0.13, y - h - 3.6], [x, y - h - 7.6],
      [x + w * 0.13, y - h - 3.6], [x + w * 0.22, y - h - 3.6], [x + w * 0.32, y - h], [x + w / 2, y - h], [x + w / 2, y]], CHURCH, 0.9);
    for (const sx of [-1, 1]) blob(g, x + sx * w * 0.27, y - h - 1.4, 1.1, 1.1, 'rgba(206,194,168,0.98)');
    g.strokeStyle = ink(0.5);
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(x - w / 2, y - h + 0.6);
    g.lineTo(x + w / 2, y - h + 0.6);
    g.stroke();
    g.fillStyle = ink(0.88);
    g.beginPath();
    g.moveTo(x - w * 0.12, y);
    g.lineTo(x - w * 0.12, y - h * 0.42);
    g.arc(x, y - h * 0.42, w * 0.12, Math.PI, 0);
    g.lineTo(x + w * 0.12, y);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(x, y - h - 1.2, 1.5, 0, Math.PI * 2);
    g.fill();
    cross(g, x, y - h - 7.6, 4);
  }
  // 石屋：石砌的底层，上层白墙出挑、几扇窗，红瓦四坡；脚在 y，宽 w，高 h
  function stoneHouse(g, x, y, w, h = 6) {
    rect(g, x - w / 2, y - h * 0.5, w, h * 0.5, STONE_W, 0.8);
    rect(g, x - w / 2 - 0.6, y - h, w + 1.2, h * 0.5, CHURCH, 0.8);
    g.fillStyle = ink(0.75);
    for (let xx = x - w / 2 + 2; xx < x + w / 2 - 1; xx += 3.4) g.fillRect(xx, y - h + 1, 1.4, 1.6);
    g.fillRect(x - 1, y - h * 0.42, 2, h * 0.42);
    slope(g, x, y - h + 0.5, w + 1.2, 3.2, TILE, 1.4, w * 0.2, 0.8);
  }
  // 棱堡城墙：矮厚的石墙（不起雉堞，几个黑炮眼），points 处各凸出一座菱形炮台（看去两片斜面、当中一道棱），台尖一座岗亭
  function bastions(g, x0, x1, y, h, points) {
    rect(g, x0, y - h, x1 - x0, h, FORT, 1);
    g.fillStyle = FORT_D;
    g.fillRect(x0 + 0.5, y - h + 0.5, x1 - x0 - 1, 1.3);
    g.fillStyle = ink(0.85);
    for (let x = x0 + 4; x < x1 - 3; x += 7) g.fillRect(x, y - h + 3, 2, 1.4);
    for (const bx of points) {
      poly(g, [[bx - 7, y + 1.4], [bx - 6, y - h - 0.6], [bx, y - h - 0.6], [bx, y + 2.2]], FORT, 0.9);
      poly(g, [[bx, y + 2.2], [bx, y - h - 0.6], [bx + 6, y - h - 0.6], [bx + 7, y + 1.4]], FORT_D, 0.9);
      // 岗亭：一小截圆身、半圆顶
      rect(g, bx - 1.3, y - h - 3.6, 2.6, 3, CHURCH, 0.6);
      g.beginPath();
      g.arc(bx, y - h - 3.6, 1.3, Math.PI, 0);
      g.fillStyle = FORT_D;
      g.fill();
      g.strokeStyle = ink(0.8);
      g.lineWidth = 0.6;
      g.stroke();
    }
  }
  // 西洋帆船：船身高，艉楼高起，一道金漆；前、中两桅横帆两层，后桅一面三角帆，主桅顶一面旗。吃水线 y，长 w，艏朝左
  function galleon(g, x, y, w) {
    const L = x - w / 2, R = x + w / 2;
    poly(g, [[L, y - 5], [L + 4, y], [R - 3, y], [R, y - 8.5], [R - 6, y - 8.5], [R - 6, y - 5.5], [L + 5, y - 4.4]], HULL, 0.8);
    g.fillStyle = 'rgba(214,180,96,0.95)';
    g.fillRect(L + 4, y - 3, w - 8, 0.9);
    const masts = [[x - w * 0.22, 0.9], [x + w * 0.05, 1.05], [x + w * 0.3, 0.7]];
    g.strokeStyle = ink(0.9);
    g.lineWidth = 0.9;
    for (const [mx, k] of masts) {
      g.beginPath();
      g.moveTo(mx, y - 4.5);
      g.lineTo(mx, y - 4.5 - w * 0.75 * k);
      g.stroke();
    }
    for (const [mx, k] of masts.slice(0, 2)) {
      for (let j = 0; j < 2; j++) {
        const top = y - 4.5 - w * 0.7 * k + j * w * 0.32 * k, hh = w * 0.26 * k, sw = w * (0.3 - j * 0.02) * (j ? 1.1 : 0.85);
        g.beginPath();
        g.moveTo(mx - sw / 2, top);
        g.lineTo(mx + sw / 2, top);
        g.quadraticCurveTo(mx + sw / 2 + 1, top + hh / 2, mx + sw / 2 - 0.4, top + hh);
        g.lineTo(mx - sw / 2 + 0.4, top + hh);
        g.quadraticCurveTo(mx - sw / 2 + 1, top + hh / 2, mx - sw / 2, top);
        g.closePath();
        g.fillStyle = SAIL;
        g.fill();
        g.strokeStyle = ink(0.8);
        g.lineWidth = 0.6;
        g.stroke();
      }
    }
    const [m3, k3] = masts[2];
    poly(g, [[m3, y - 4.5 - w * 0.7 * k3], [m3, y - 6], [m3 + w * 0.17, y - 6]], SAIL, 0.6);
    const [m2, k2] = masts[1], ty = y - 4.5 - w * 0.75 * k2;
    poly(g, [[m2, ty], [m2 + 5, ty + 1.2], [m2, ty + 2.4]], RED_FLAG, 0.5);
  }

  // ======================= 大越 =======================
  // 小城：砖石城墙雉堞，中开城门，门上一重红瓦翘角门楼；墙后红瓦屋顶，旁一株槟榔
  function vnS(g) {
    palm(g, 58, 50, 20, -2);
    redRoofs(g, [[12, 50, 11], [24, 48, 10], [42, 49, 11], [52, 51, 9]]);
    wall(g, 6, 58, 60, 11, { fill: VWALL });
    gate(g, 32, 60, 7, 7);
    vTower(g, 32, 49, 14, 1);
  }
  // 大城（大府、都会）：护城河，城高，二重门楼，城角两座小楼；城里红瓦成片，北头一座砖塔，槟榔
  function vnL(g) {
    vStupa(g, 50, 46, 6, 7);
    palm(g, 6, 47, 18, 2);
    redRoofs(g, [[14, 45, 10], [24, 43, 9], [40, 44, 10], [58, 46, 8], [19, 47, 9], [46, 47, 9]]);
    wall(g, 4, 60, 59, 13, { fill: VWALL });
    water(g, 1, 63, 63, 3.6);
    gate(g, 32, 59, 8, 8);
    vTower(g, 32, 46, 21, 2);
    vTower(g, 8, 46, 9, 1);
    vTower(g, 56, 46, 9, 1);
  }
  // 升龙：城里高台上的敬天殿（朱柱、黄瓦重檐）；外城一道，正中二重黄瓦端门、两旁小门；红瓦屋顶，槟榔
  function vnCap(g) {
    palm(g, 4, 46, 16, 2);
    palm(g, 60, 46, 16, -2);
    rect(g, 11, 36, 42, 4, TERRACE, 0.8);
    rect(g, 17, 31, 30, 5, VPILLAR, 0.8);
    vroof(g, 32, 31.6, 30, 6.5, YROOF);
    rect(g, 24, 23.2, 16, 2.8, VPILLAR, 0.7);
    vroof(g, 32, 23.8, 16, 4.6, YROOF);
    redRoofs(g, [[10, 46, 10], [54, 46, 10], [20, 47, 8], [44, 47, 8]]);
    wall(g, 2, 62, 62, 13, { fill: VWALL });
    gate(g, 32, 62, 8, 8);
    gate(g, 22, 62, 5, 6);
    gate(g, 42, 62, 5, 6);
    vTower(g, 32, 49, 24, 2, YROOF);
    vTower(g, 6, 49, 9, 1);
    vTower(g, 58, 49, 9, 1);
  }
  // 市（chợ）：后排红瓦筒屋，街心一座宽大的市场屋顶（四面敞着，柱下摊货）；槟榔
  function vnMarket(g) {
    palm(g, 6, 54, 18, 1.5);
    for (const [x, w] of [[20, 10], [31, 10], [42, 10], [53, 9]]) vHouse(g, x, 52, w, 4.5);
    g.strokeStyle = 'rgba(110,80,60,0.95)';
    g.lineWidth = 1;
    g.beginPath();
    for (const dx of [-13, -4.5, 4.5, 13]) {
      g.moveTo(32 + dx, 62.5);
      g.lineTo(32 + dx, 56);
    }
    g.stroke();
    for (const dx of [-9, 0, 9]) blob(g, 32 + dx, 61.4, 2.4, 1.3, 'rgba(176,146,98,0.95)');
    vroof(g, 32, 56.6, 30, 6.4, VROOF, false);
  }
  // 港：岸上红瓦白墙的货栈、一间草房，木栈伸进海里，一只帆船；椰
  function vnPort(g) {
    pool(g, 42, 60, 22, 4);
    palm(g, 4, 56, 16, 1.5);
    vHouse(g, 14, 58, 14, 6);
    vHouse(g, 25, 60, 8, 3.5, THATCH, EARTH_W);
    pier(g, 27, 46, 56.5);
    junk(g, 48, 61.5, 18, true);
  }
  // 寺（chùa）：后头上殿红瓦重檐，殿后一座砖塔；白墙；三关门（中间二重、两旁一重）；门前一方莲池；槟榔
  function vnTemple(g) {
    vStupa(g, 52, 50, 7, 7);
    palm(g, 6, 50, 17, 1.5);
    rect(g, 14, 44, 26, 6, VPILLAR, 0.8);
    vroof(g, 27, 44.6, 26, 6.5);
    rect(g, 19, 36.6, 16, 2.6, VPILLAR, 0.7);
    vroof(g, 27, 37.2, 16, 4.5);
    whiteWall(g, 4, 60, 56, 3.4);
    for (const [x, w, t] of [[16, 8, 1], [27, 10, 2], [38, 8, 1]]) {
      rect(g, x - w / 2 + 1, 56.5 - 4.4, w - 2, 4.4, WHITE, 0.8);
      g.fillStyle = ink(0.88);
      g.fillRect(x - 1.4, 56.5 - 3.6, 2.8, 3.6);
      vTower(g, x, 56.5 - 4.4, w, t);
    }
    pool(g, 52, 61, 9, 2.2);
    for (const [x, y] of [[48, 60.6], [53, 61.6], [56, 60.4]]) blob(g, x, y, 1, 0.7, 'rgba(224,150,160,0.95)');
  }
  // 庙（đền）：门外两根华表柱（白方柱、红瓦小帽）；前头宽矮大顶的拜亭，后头正殿；槟榔两株
  function vnShrine(g) {
    palm(g, 6, 50, 17, 1.5);
    palm(g, 58, 50, 16, -1.5);
    rect(g, 18, 41, 26, 5, VPILLAR, 0.8);
    vroof(g, 31, 41.6, 26, 6);
    g.strokeStyle = 'rgba(110,80,60,0.95)';
    g.lineWidth = 1;
    g.beginPath();
    for (const dx of [-14, -5, 5, 14]) {
      g.moveTo(31 + dx, 61);
      g.lineTo(31 + dx, 55);
    }
    g.stroke();
    vroof(g, 31, 55.6, 34, 8);
    for (const x of [8, 54]) {
      rect(g, x - 1.4, 44, 2.8, 18, WHITE, 0.8);
      rect(g, x - 2.2, 41.6, 4.4, 2.4, VROOF, 0.6);
      rect(g, x - 1, 39.4, 2, 2.2, WHITE, 0.6);
    }
  }
  // 文庙（văn miếu）：后头大成殿；白墙；门前奎文阁——四根白砖柱上一座二重楼阁（上层四面圆窗），红瓦翘角；槟榔
  function vnAcademy(g) {
    palm(g, 58, 52, 17, -1.5);
    rect(g, 6, 44, 30, 5, VPILLAR, 0.8);
    vroof(g, 21, 44.6, 30, 6);
    whiteWall(g, 3, 61, 56, 3.4);
    g.fillStyle = WHITE;
    g.strokeStyle = ink(0.8);
    g.lineWidth = 0.6;
    for (const x of [26, 36.4]) {
      g.fillRect(x, 53, 1.8, 9.4);
      g.strokeRect(x, 53, 1.8, 9.4);
    }
    vroof(g, 32, 53.4, 16, 3.6, VROOF, false);
    rect(g, 26.5, 43.6, 11, 6.4, 'rgba(130,70,52,0.96)', 0.8);
    g.strokeStyle = 'rgba(244,226,180,0.95)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.arc(32, 46.8, 2, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      g.beginPath();
      g.moveTo(32, 46.8);
      g.lineTo(32 + Math.cos(a) * 2, 46.8 + Math.sin(a) * 2);
      g.stroke();
    }
    vroof(g, 32, 44.2, 13, 5);
  }
  // 屯（đồn）：砖石方城、雉堞，南门一重楼；城里营房红瓦两排；一杆旗
  function vnFort(g) {
    redRoofs(g, [[18, 47, 14], [46, 47, 14]]);
    flag(g, 50, 48, 20, RED_FLAG);
    wall(g, 8, 56, 61, 12, { fill: VWALL });
    gate(g, 32, 61, 7, 7);
    vTower(g, 32, 49, 13, 1);
    for (const x of [8, 56]) {
      rect(g, x - 3.6, 45, 7.2, 16, VWALL, 1);
      g.fillStyle = VWALL;
      for (let k = 0; k < 2; k++) g.fillRect(x - 3.6 + k * 5, 42, 2.2, 3);
    }
  }
  // 衙：院里红瓦正堂、两厢；白墙一圈，南门一重楼；槟榔两株
  function vnYamen(g) {
    palm(g, 5, 50, 16, 1.5);
    palm(g, 59, 50, 16, -1.5);
    rect(g, 16, 43, 32, 6, VPILLAR, 0.8);
    vroof(g, 32, 43.6, 32, 7);
    vHouse(g, 12, 53, 11, 4);
    vHouse(g, 52, 53, 11, 4);
    whiteWall(g, 4, 60, 60.5, 4);
    rect(g, 27, 54.5, 10, 6, WHITE, 0.8);
    g.fillStyle = ink(0.9);
    g.fillRect(30, 56, 4, 4.5);
    vTower(g, 32, 54.5, 12, 1);
  }
  // 大越村：一座草顶土屋、一座红瓦白墙屋，屋旁一株槟榔
  function vnHamlet(g) {
    palm(g, 50, 62, 22, -1.5);
    vHouse(g, 22, 58, 18, 6, THATCH, EARTH_W);
    vHouse(g, 38, 62, 13, 5);
  }

  // ======================= 南洋诸国 =======================
  // 小城：一圈木栅，栅里高脚屋，椰
  function seaS(g) {
    palm(g, 54, 50, 20, -1.5);
    nipa(g, 20, 52, 13, 4, 3);
    nipa(g, 40, 51, 11, 4, 3);
    palm(g, 9, 52, 18, 1.5);
    palisade(g, 3, 61, 61, 9);
  }
  // 大城：红砖城（城头一排垛口），护城河；城后一座白身金顶的钟形大塔、一座砖塔，高脚屋的草顶；椰
  function seaL(g) {
    stupa(g, 30, 50, 1.25);
    prang(g, 50, 50, 0.9);
    palm(g, 8, 50, 18, 1.5);
    palm(g, 58, 52, 16, -1.5);
    for (const [x, y, w] of [[14, 49, 9], [42, 50, 8]]) poly(g, [[x - w / 2, y], [x, y - w * 0.7], [x + w / 2, y]], THATCH, 0.7);
    wall(g, 4, 60, 59, 11, { fill: BRICK });
    water(g, 1, 63, 63, 3.6);
    gate(g, 32, 59, 7, 7);
  }
  // 都城（蒲甘、阿瑜陀耶那样）：城里一座通身金的大塔，王宫七层尖阁（白台、朱墙）；大护城河、红砖城；椰
  function seaCap(g) {
    stupa(g, 21, 50, 1.6, true);
    rect(g, 36, 46, 20, 3, WHITE, 0.7);
    rect(g, 38.5, 41.5, 15, 4.5, RED_WALL, 0.7);
    tiered(g, 46, 42, 19, 6);
    palm(g, 4, 50, 16, 1.5);
    palm(g, 61, 52, 15, -1.5);
    wall(g, 2, 62, 59, 11, { fill: BRICK });
    water(g, 0, 64, 63.4, 4);
    gate(g, 32, 59, 8, 8);
  }
  // 市：一道运河（两只小舟），岸上草葺的市棚、高脚屋，椰，一座小白塔
  function seaMarket(g) {
    palm(g, 8, 50, 18, 1.5);
    stupa(g, 54, 50, 0.6);
    nipa(g, 22, 50, 11, 3.6, 2.6);
    nipa(g, 40, 49, 10, 3.4, 2.6);
    shed(g, 16, 57.5, 15);
    shed(g, 46, 57.5, 15);
    water(g, 0, 64, 64, 5);
    canoe(g, 24, 62.6, 12);
    canoe(g, 44, 63.2, 10);
  }
  // 港：岸上两座高脚货栈，木栈伸进海里，一只带边架的席帆舟；椰
  function seaPort(g) {
    pool(g, 42, 60, 22, 4);
    palm(g, 4, 54, 18, 1.5);
    nipa(g, 13, 58, 12, 4, 3);
    nipa(g, 25, 60, 9, 3.4, 3);
    pier(g, 28, 44, 56.5);
    prahu(g, 49, 61.5, 17);
  }
  // 寺（wat）：后头一座白身金顶的大塔；前头佛殿（白墙、橙红叠顶绿边、金鸱尾）；两旁两座金小塔；椰
  function seaTemple(g) {
    stupa(g, 32, 47, 1.1);
    stupa(g, 11, 57, 0.55, true);
    stupa(g, 53, 57, 0.55, true);
    palm(g, 61, 55, 15, -1.5);
    wat(g, 32, 62.5, 22);
  }
  // 祠（砖塔庙，占婆、真腊那样）：当中一座大砖塔，两旁两座小砖塔；矮砖墙、砖门；椰两株
  function seaShrine(g) {
    palm(g, 4, 54, 16, 1.5);
    palm(g, 60, 54, 16, -1.5);
    prang(g, 14, 57, 0.8);
    prang(g, 50, 57, 0.8);
    prang(g, 32, 56, 1.25);
    wall(g, 4, 60, 62.5, 5, { fill: BRICK, crenel: false });
    rect(g, 28, 55.5, 8, 7, BRICK_D, 0.8);
    g.fillStyle = ink(0.88);
    g.fillRect(30.4, 58, 3.2, 4.5);
    poly(g, [[27.4, 55.5], [32, 51.5], [36.6, 55.5]], BRICK, 0.7);
  }
  // 学（寺学）：后头佛殿（白墙、层层收顶）；前头一座长长的敞着的讲亭（草顶）；金小塔；椰
  function seaAcademy(g) {
    rect(g, 20, 42, 24, 6, WHITE, 0.8);
    tiered(g, 32, 42.6, 26, 3, TROOF);
    stupa(g, 53, 53, 0.55, true);
    palm(g, 6, 52, 17, 1.5);
    shed(g, 30, 62.5, 36);
  }
  // 堡：城里层层收顶的营堂、一杆旗；砖墙方城（垛口），两角砖楼，砖门
  function seaFort(g) {
    tiered(g, 30, 47, 18, 3, VROOF2);
    flag(g, 48, 49, 20, RED_FLAG);
    wall(g, 8, 56, 61, 12, { fill: BRICK });
    for (const x of [8, 56]) {
      rect(g, x - 3.6, 45, 7.2, 16, BRICK, 1);
      g.fillStyle = BRICK;
      for (let k = 0; k < 2; k++) g.fillRect(x - 3.6 + k * 5, 42, 2.2, 3);
    }
    gate(g, 32, 61, 7, 7);
  }
  // 王府：院里一座三层收顶的殿；两旁高脚长屋；白墙一圈、南门；椰
  function seaYamen(g) {
    palm(g, 5, 50, 16, 1.5);
    rect(g, 20, 44, 24, 6, RED_WALL, 0.8);
    tiered(g, 32, 44.6, 27, 3);
    nipa(g, 11, 56, 12, 3.6, 2.5);
    nipa(g, 53, 56, 12, 3.6, 2.5);
    rect(g, 4, 56.5, 56, 4.5, WHITE, 0.9);
    rect(g, 28, 54.5, 8, 6.5, WHITE, 0.8);
    g.fillStyle = ink(0.9);
    g.fillRect(30.4, 56.5, 3.2, 4.5);
    tiered(g, 32, 54.8, 10, 2, VROOF2, 3);
  }
  // 南洋村：两座高脚屋，一株椰
  function seaHamlet(g) {
    palm(g, 50, 62, 22, -2);
    nipa(g, 22, 60, 14, 4.5, 4);
    nipa(g, 37, 62, 11, 3.6, 3.4);
  }

  // ======================= 西洋据点 =======================
  // 小城（传教的镇子、小据点）：石铺广场后一座白墙教堂（山花墙、钟楼），两旁尼巴屋，椰
  function weS(g) {
    palm(g, 57, 52, 20, -1.5);
    g.fillStyle = PAVING;
    g.beginPath();
    g.ellipse(31, 59.5, 13, 3, 0, 0, Math.PI * 2);
    g.fill();
    church(g, 31, 57, 15, 9);
    nipa(g, 9, 60, 11, 3.6, 3);
    nipa(g, 48, 63, 10, 3.4, 3);
  }
  // 大城：城后教堂钟楼与红瓦屋顶；棱堡城墙（两头凸出菱形炮台，台尖岗亭），当中城门；一杆旗
  function weL(g) {
    belfry(g, 22, 50, 8, 22);
    for (const [x, y, w] of [[34, 50, 10], [46, 49, 9], [12, 50, 8]]) slope(g, x, y, w, 3.6, TILE, 1.4, w * 0.2, 0.8);
    flag(g, 44, 50, 20, RED_FLAG);
    bastions(g, 7, 57, 60, 10, [7, 57]);
    gate(g, 32, 60, 6, 6.5);
  }
  // 王城（马尼拉那样）：城里大教堂（两座钟楼）、红瓦成片；更宽的棱堡城墙、三座炮台；一杆旗
  function weCap(g) {
    for (const [x, y, w] of [[8, 47, 9], [56, 47, 9], [14, 50, 9], [50, 50, 9]]) slope(g, x, y, w, 3.6, TILE, 1.4, w * 0.2, 0.8);
    church(g, 30, 50, 14, 10, 2);
    flag(g, 50, 46, 18, RED_FLAG);
    bastions(g, 4, 60, 61, 10, [4, 32, 60]);
    gate(g, 18, 61, 5.5, 6);
    gate(g, 46, 61, 5.5, 6);
  }
  // 市（广场）：后头两层石屋，石铺广场当中一座喷泉，场上白布摊棚；椰
  function weMarket(g) {
    palm(g, 58, 52, 18, -1.5);
    for (const [x, w] of [[12, 14], [28, 14], [44, 13]]) stoneHouse(g, x, 52, w, 8);
    g.fillStyle = PAVING;
    g.beginPath();
    g.ellipse(32, 59, 28, 4.5, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(32, 60, 6, 1.8, 0, 0, Math.PI * 2);
    g.fillStyle = STONE_W;
    g.fill();
    g.strokeStyle = ink(0.8);
    g.lineWidth = 0.7;
    g.stroke();
    rect(g, 31.2, 54.5, 1.6, 5.5, STONE_W, 0.5);
    blob(g, 32, 54.2, 2.2, 1.4, 'rgba(170,206,218,0.9)');
    for (const x of [12, 52]) {
      g.strokeStyle = ink(0.85);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x - 5, 62);
      g.lineTo(x - 5, 57);
      g.moveTo(x + 5, 62);
      g.lineTo(x + 5, 57.6);
      g.stroke();
      poly(g, [[x - 6.6, 57.4], [x - 5, 55.6], [x + 5.6, 56.4], [x + 6.4, 58.2]], CANVAS, 0.7);
    }
  }
  // 港：岸上石砌货栈两座（红瓦）、一杆旗；石码头伸进海里，一只西洋帆船
  function wePort(g) {
    pool(g, 42, 60, 22, 4);
    stoneHouse(g, 10, 58, 14, 8);
    stoneHouse(g, 22, 60, 9, 6);
    flag(g, 3, 60, 20, RED_FLAG);
    rect(g, 26, 56, 18, 3, STONE_W, 0.8);
    galleon(g, 49, 62, 22);
  }
  // 教堂（天主堂）：大教堂（山花墙、钟楼）；旁修院石屋；前庭一座石十字架；椰
  function weChurch(g) {
    palm(g, 59, 55, 17, -1.5);
    stoneHouse(g, 50, 55, 12, 7);
    g.fillStyle = PAVING;
    g.beginPath();
    g.ellipse(28, 61, 16, 2.6, 0, 0, Math.PI * 2);
    g.fill();
    church(g, 28, 59, 21, 12);
    rect(g, 46.6, 61, 3, 2, STONE_W, 0.6);
    cross(g, 48, 61, 9);
  }
  // 学院（colegio）：后头一座小教堂的山花墙；两旁石屋，前头两层的拱廊楼；院心一株树
  function weAcademy(g) {
    church(g, 32, 47, 12, 7, 0);
    stoneHouse(g, 11, 52, 14, 8);
    stoneHouse(g, 53, 52, 14, 8);
    blob(g, 21, 48, 4.5, 4, rgba([82, 132, 96], 0.95));
    rect(g, 6, 54, 52, 4.5, CHURCH, 0.9);
    rect(g, 6, 58.5, 52, 4, STONE_W, 0.9);
    g.fillStyle = ink(0.8);
    for (let x = 9; x < 56; x += 5) {
      g.beginPath();
      g.moveTo(x, 62.5);
      g.lineTo(x, 60.2);
      g.arc(x + 1.4, 60.2, 1.4, Math.PI, 0);
      g.lineTo(x + 2.8, 62.5);
      g.closePath();
      g.fill();
      g.fillRect(x + 0.6, 55.2, 1.6, 1.8);
    }
    slope(g, 32, 54.5, 53, 3.4, TILE, 1.6, 4, 0.8);
  }
  // 堡：城里石营房（红瓦）两排；棱堡小城（两角菱形炮台），南门；一杆旗；墙头两门炮
  function weFort(g) {
    for (const [x, y, w] of [[22, 49, 16], [42, 49, 16]]) slope(g, x, y, w, 3.6, TILE, 1.4, w * 0.18, 0.8);
    flag(g, 32, 50, 22, RED_FLAG);
    bastions(g, 11, 53, 60, 10, [11, 53]);
    g.fillStyle = ink(0.9);
    for (const x of [21, 41]) g.fillRect(x, 49.4, 4.4, 1.3);
    gate(g, 32, 60, 6, 6.5);
  }
  // 官署（市政厅）：两层石厅（下层拱廊、上层白墙、红瓦四坡、顶上一杆旗），两旁石屋；前头石铺广场；椰
  function weYamen(g) {
    palm(g, 4, 55, 17, 1.5);
    stoneHouse(g, 11, 56, 10, 6);
    stoneHouse(g, 54, 56, 10, 6);
    flag(g, 32, 45, 12, RED_FLAG);
    rect(g, 18, 44, 28, 8, CHURCH, 0.9);
    g.fillStyle = ink(0.75);
    for (let x = 20.5; x < 44; x += 4.4) g.fillRect(x, 46, 1.6, 2.6);
    rect(g, 18, 52, 28, 8, STONE_W, 0.9);
    g.fillStyle = ink(0.8);
    for (let x = 20; x < 44; x += 4.6) {
      g.beginPath();
      g.moveTo(x, 60);
      g.lineTo(x, 55.6);
      g.arc(x + 1.5, 55.6, 1.5, Math.PI, 0);
      g.lineTo(x + 3, 60);
      g.closePath();
      g.fill();
    }
    slope(g, 32, 44.5, 29, 5, TILE, 2, 7, 0.9);
    g.fillStyle = PAVING;
    g.beginPath();
    g.ellipse(32, 62, 18, 1.8, 0, 0, Math.PI * 2);
    g.fill();
  }

  // ======================= 残城（凋敝或兵燹） =======================
  // 大越的残城：砖石城墙断成几截、墙头焦黑，门洞塌了半边，门楼的红瓦顶塌在墙头，瓦砾里几片红瓦，一股烟；一株槟榔、一株枯树
  function vnRuin(g, r) {
    palm(g, 58, 52, 18, -2);
    deadTree(g, 6, 62, 0.8);
    smokeCol(g, 33, 38, r);
    for (const [x0, x1, h0, h1] of [[3, 19, 13, 8], [23, 31, 15, 11], [38, 52, 9, 5]]) ruinWall(g, x0, x1, 61, h0, h1, VWALL, r);
    g.fillStyle = ink(0.9);
    g.beginPath();
    g.moveTo(31, 61);
    g.lineTo(31, 55);
    g.arc(34, 55, 3, Math.PI, Math.PI * 1.6);
    g.lineTo(35, 61);
    g.closePath();
    g.fill();
    poly(g, [[20, 47.5], [24, 43.5], [31, 45], [33, 49], [27, 49.6]], VROOF, 0.8);
    rubble(g, 14, 52, 60.5, r, 12);
    rubble(g, 18, 46, 60.5, r, 6, 'rgba(170,98,76,0.95)');
  }
  // 南洋的残城（阿瑜陀耶那样）：护城河犹在，红砖城断成几截；城里佛塔白灰剥尽、钟身塌了半截，砖塔顶塌了，荒树长在砖堆里；一株椰，一股烟
  function seaRuin(g, r) {
    palm(g, 6, 50, 18, 1.5);
    rect(g, 16, 46, 18, 2.4, BRICK_D, 0.7);
    rect(g, 18.5, 43.6, 13, 2.4, BRICK_D, 0.7);
    poly(g, [[19.6, 43.6], [19.4, 38], [21, 34.5], [23, 36.2], [25, 32.6], [27.4, 35.4], [29.4, 34], [30.6, 38], [30.4, 43.6]], BRICK, 0.8);
    rect(g, 40, 46, 13, 2.6, BRICK_D, 0.7);
    rect(g, 41.6, 39, 9.8, 7, BRICK, 0.7);
    g.fillStyle = ink(0.85);
    g.beginPath();
    g.moveTo(45.1, 46);
    g.lineTo(45.1, 42);
    g.lineTo(46.5, 40.6);
    g.lineTo(47.9, 42);
    g.lineTo(47.9, 46);
    g.closePath();
    g.fill();
    poly(g, [[42.6, 39], [42.6, 36.4], [44.6, 35], [46.4, 36.6], [48.6, 34.6], [50.4, 36.4], [50.4, 39]], BRICK, 0.7);
    for (const [x, y, s] of [[49.5, 35.5, 0.7], [21.5, 35.5, 0.6], [36, 44, 0.8]]) {
      blob(g, x, y - 2 * s, 4 * s, 3.2 * s, rgba([70, 112, 76], 0.95));
      blob(g, x - 1 * s, y - 3 * s, 2.4 * s, 2 * s, rgba([96, 140, 96], 0.95));
    }
    smokeCol(g, 36, 34, r, 4);
    for (const [x0, x1, h0, h1] of [[2, 16, 9, 6], [22, 36, 10, 7], [42, 60, 7, 4]]) ruinWall(g, x0, x1, 60, h0, h1, BRICK, r);
    water(g, 0, 64, 63.6, 3.4);
    rubble(g, 8, 58, 58.6, r, 12, 'rgba(150,98,76,0.92)');
  }
  // 西洋据点的残城：教堂没了顶，只剩参差的山花墙、黑洞洞的门窗，墙头熏黑，一股烟；棱堡的墙断成几截，一座炮台塌了半边；一株椰
  function weRuin(g, r) {
    palm(g, 58, 50, 18, -1.5);
    poly(g, [[20, 53], [20, 38], [23, 36], [26, 33], [28, 35], [31, 30], [34, 34], [37, 33], [40, 38], [40, 53]], CHURCH, 0.9);
    for (const [x, y] of [[25, 35.5], [31, 32.5], [37, 35]]) blob(g, x, y, 3, 1.6, ink(0.45));
    g.fillStyle = ink(0.88);
    g.beginPath();
    g.moveTo(27.6, 53);
    g.lineTo(27.6, 47);
    g.arc(30, 47, 2.4, Math.PI, 0);
    g.lineTo(32.4, 53);
    g.closePath();
    g.fill();
    for (const x of [23.6, 35.4]) g.fillRect(x, 41.5, 2, 3.4);
    smokeCol(g, 31, 30, r, 4);
    poly(g, [[3, 62], [4, 52], [10, 50.5], [10, 63]], FORT, 0.9);
    poly(g, [[10, 63], [10, 50.5], [14, 53], [17, 52], [17, 62]], FORT_D, 0.9);
    for (const [x0, x1, h0, h1] of [[17, 26, 8, 6], [32, 44, 9, 5], [48, 56, 6, 4]]) ruinWall(g, x0, x1, 61, h0, h1, FORT, r);
    rubble(g, 14, 56, 60.5, r, 12, 'rgba(176,164,140,0.92)');
  }

  return {
    vnS, vnL, vnCap, vnMarket, vnPort, vnTemple, vnShrine, vnAcademy, vnFort, vnYamen, vnHamlet,
    seaS, seaL, seaCap, seaMarket, seaPort, seaTemple, seaShrine, seaAcademy, seaFort, seaYamen, seaHamlet,
    weS, weL, weCap, weMarket, wePort, weChurch, weAcademy, weFort, weYamen,
    vnRuin, seaRuin, weRuin
  };
}

// 地域 → { 原样的格名: 当地的格名 }（同 EAST_SPRITE_LOCAL）。南洋、西洋据点照立体的分法：小城才是木栅、传教的镇子，府城起就是砖城、棱堡；
// 西洋据点的佛寺、祠庙照原样（立体的也没换）；
// 南洋的天主堂画西式教堂；西洋据点城外的村舍是尼巴屋，同南洋
export const SOUTH_SPRITE_LOCAL = {
  viet: {
    town: 'vnS', city: 'vnS', grand: 'vnL', metro: 'vnL', capital: 'vnCap', ruin: 'vnRuin', market: 'vnMarket', port: 'vnPort',
    temple: 'vnTemple', shrine: 'vnShrine', academy: 'vnAcademy', fort: 'vnFort', yamen: 'vnYamen', hamlet: 'vnHamlet', hamletB: 'vnHamlet'
  },
  seasia: {
    town: 'seaS', city: 'seaL', grand: 'seaL', metro: 'seaL', capital: 'seaCap', ruin: 'seaRuin', market: 'seaMarket', port: 'seaPort',
    temple: 'seaTemple', shrine: 'seaShrine', church: 'weChurch', academy: 'seaAcademy', fort: 'seaFort', yamen: 'seaYamen', hamlet: 'seaHamlet', hamletB: 'seaHamlet'
  },
  west: {
    town: 'weS', city: 'weL', grand: 'weL', metro: 'weL', capital: 'weCap', ruin: 'weRuin', market: 'weMarket', port: 'wePort',
    church: 'weChurch', academy: 'weAcademy', fort: 'weFort', yamen: 'weYamen', hamlet: 'seaHamlet', hamletB: 'seaHamlet'
  }
};

// 舆图点景小图里的日本、朝鲜诸样。低画质时城郭、市镇、港、营造地标都画成小图，中、高画质远看时的村舍也是小图，
// 这里照立体模型（towns3d-east.js）的样子画：石垣天守与城下町屋、平安的国衙与筑地塀、圆转的邑城与虹霓门楼、
// 町与湊、鸟居、场市与浦口、红箭门……
// 画法与 sprites.js 一路：墨线勾、淡彩填；每格 64×64，下沿是地面。格号由 sprites.js 按这里返回的次序接在原有各格之后，
// 哪一地域的哪一样用哪一格见 EAST_SPRITE_LOCAL（舆图经 sprites.js 的 localSprite 查）。
export function eastPainters(kit) {
  const { INK, GREEN, DEEP, rgba, trunk, blob, banner, palisade, rect, poly, slope, curved, ruinWall, smokeCol, deadTree, rubble, charredHouse } = kit;
  const ink = (a) => `${INK}${a})`;
  // 日本（照 towns3d-east.js 的 J）
  const PLASTER = 'rgba(242,240,232,0.98)', BLACK = 'rgba(64,60,56,0.97)', JROOF = 'rgba(92,102,116,0.97)', JROOF_L = 'rgba(122,130,142,0.96)';
  const JSTONE = 'rgba(172,170,160,0.98)', VERM = 'rgba(210,84,52,0.97)', BARK = 'rgba(134,102,78,0.97)', TSUIJI = 'rgba(228,210,166,0.98)';
  const WOOD = 'rgba(122,96,74,0.97)', WOOD_D = 'rgba(88,70,56,0.97)', THATCH = 'rgba(180,158,114,0.97)', JGREEN = 'rgba(108,152,126,0.97)';
  const GOLD = 'rgba(224,180,66,0.98)', BRONZE = 'rgba(92,108,92,0.97)', HULL = 'rgba(108,82,60,0.97)', SAIL = 'rgba(246,242,230,0.97)';
  const MAT = 'rgba(200,180,134,0.97)', EARTH_W = 'rgba(196,174,136,0.97)', PIER = 'rgba(92,70,48,0.95)', CHAR = 'rgba(58,52,48,0.97)';
  const WATER = 'rgba(112,152,166,0.86)', LEAF = 'rgba(96,132,118,0.9)', DEEP_A = rgba(DEEP, 0.93), GREEN_A = rgba(GREEN, 0.95);
  // 朝鲜（照 K）
  const KSTONE = 'rgba(200,198,188,0.98)', KROOF = 'rgba(82,84,90,0.97)', KPILLAR = 'rgba(160,70,52,0.97)', KGREEN = 'rgba(84,146,118,0.97)';
  const KWALL = 'rgba(242,234,216,0.98)', KEARTH = 'rgba(206,178,136,0.97)', KTHATCH = 'rgba(178,158,116,0.97)', JAR = 'rgba(98,70,54,0.97)';
  const RED_FLAG = 'rgba(196,52,44,0.95)', WHITE_CLOTH = 'rgba(246,242,232,0.97)';

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
  // 木栈：从岸上伸进水里，几根桩
  function pier(g, x0, x1, y) {
    g.fillStyle = PIER;
    g.fillRect(x0, y, x1 - x0, 2.2);
    for (let x = x0 + 3; x <= x1 - 1; x += 5.5) g.fillRect(x, y, 1.4, 5.5);
  }
  // 墙带一道瓦顶（白土塀、筑地塀、院墙）：x0～x1，脚在 y，高 h
  function cappedWall(g, x0, x1, y, h, fill, cap = JROOF) {
    rect(g, x0, y - h, x1 - x0, h, fill, 0.9);
    rect(g, x0 - 0.8, y - h - 1.6, x1 - x0 + 1.6, 1.7, cap, 0.6);
  }
  // 松：斜干，两三团横出的深绿
  function pine(g, x, y, s = 1) {
    trunk(g, x, y, y - 15 * s, 2 * s, 2.3 * s);
    blob(g, x - 3 * s, y - 13 * s, 6 * s, 2.8 * s, DEEP_A);
    blob(g, x + 2.5 * s, y - 17.5 * s, 5.2 * s, 2.6 * s, DEEP_A);
    blob(g, x - 2 * s, y - 13.6 * s, 4 * s, 1.6 * s, LEAF);
    blob(g, x + 2 * s, y - 18 * s, 3.4 * s, 1.4 * s, LEAF);
  }
  // 一株阔叶树（社叢、院里的古树、镇口的榉树）
  function tuft(g, x, y, s, r) {
    trunk(g, x, y, y - 9 * s, (r() - 0.5) * 2, 2 * s);
    blob(g, x, y - 12 * s, 7 * s, 6 * s, DEEP_A);
    blob(g, x - 2 * s, y - 14 * s, 4.6 * s, 4 * s, GREEN_A);
    for (let k = 0; k < 6; k++) blob(g, x + (r() - 0.5) * 10 * s, y - 12 * s + (r() - 0.5) * 8 * s, 0.9, 0.7, ink(0.5));
  }
  // 一面旗：杆、一块方旗
  function flag(g, x, y, h, color) {
    g.strokeStyle = ink(0.9);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - h);
    g.stroke();
    poly(g, [[x, y - h], [x + 7, y - h + 1.4], [x + 6.4, y - h + 4.6], [x, y - h + 5]], color, 0.6);
  }

  // ---------- 日本的器件 ----------
  // 石垣：脚在 y、高 h，底宽 w、顶宽 wt；两边扇形的弧（下缓上陡），几道断续的石缝
  function ishigaki(g, cx, y, w, h, wt) {
    const l0 = cx - w / 2, r0 = cx + w / 2, l1 = cx - wt / 2, r1 = cx + wt / 2;
    g.save();
    g.beginPath();
    g.moveTo(l0, y);
    g.quadraticCurveTo(l1 - 0.4, y - h * 0.3, l1, y - h);
    g.lineTo(r1, y - h);
    g.quadraticCurveTo(r1 + 0.4, y - h * 0.3, r0, y);
    g.closePath();
    g.fillStyle = JSTONE;
    g.fill();
    g.strokeStyle = ink(0.85);
    g.lineWidth = 1;
    g.stroke();
    g.clip();
    g.strokeStyle = ink(0.32);
    g.lineWidth = 0.6;
    for (let yy = y - h + 2.2, k = 0; yy < y - 0.5; yy += 2.3, k++) {
      g.setLineDash([2.4, 1.1]);
      g.lineDashOffset = k * 1.6;
      g.beginPath();
      g.moveTo(l0, yy);
      g.lineTo(r0, yy);
      g.stroke();
    }
    g.restore();
  }
  // 千鸟破风：屋面上起一个小山墙（白面、黛瓦两坡）
  function chidori(g, cx, y, w, h) {
    poly(g, [[cx - w / 2, y], [cx, y - h], [cx + w / 2, y]], PLASTER, 0.6);
    g.strokeStyle = JROOF;
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(cx - w / 2 - 0.8, y + 0.5);
    g.lineTo(cx, y - h - 0.5);
    g.lineTo(cx + w / 2 + 0.8, y + 0.5);
    g.stroke();
  }
  // 天守：脚在 y（天守台顶），底一重宽 w，n 重，一重比一重窄；白壁下截黑板、一排小窗；隔重起千鸟破风；
  // 顶重歇山大顶，脊两头一对金鯱。返回顶脊的高
  function tenshu(g, cx, y, w, n, wall = PLASTER) {
    let top = y, ww = w;
    for (let i = 0; i < n; i++) {
      ww = w * (1 - i * 0.5 / Math.max(1, n - 1));
      const last = i === n - 1, bh = i === 0 ? 5 : 4, eh = last ? 4.4 : 2.7;
      rect(g, cx - ww / 2, top - bh, ww, bh, wall, 0.8);
      g.fillStyle = BLACK;
      g.fillRect(cx - ww / 2 + 0.4, top - bh * 0.42, ww - 0.8, bh * 0.42 - 0.4);
      g.fillStyle = ink(0.8);
      for (let x = cx - ww / 2 + 1.8; x < cx + ww / 2 - 2.6; x += 3) g.fillRect(x, top - bh + 1, 1.3, 1.4);
      slope(g, cx, top - bh + 0.5, ww, eh, JROOF, last ? 2.4 : 1.8, ww * (last ? 0.27 : 0.13), 0.8);
      if (!last && i % 2 === 0 && ww > 9) chidori(g, cx, top - bh + 0.5 - eh * 0.2, Math.min(8, ww * 0.42), 2.8);
      top = top - bh - eh + 0.5;
    }
    for (const sx of [-1, 1]) blob(g, cx + sx * ww * 0.23, top - 0.3, 0.9, 1.3, GOLD);
    return top;
  }
  // 隅櫓：两重的小櫓，脚在 y，宽 w
  function yagura(g, cx, y, w) {
    rect(g, cx - w / 2, y - 4, w, 4, PLASTER, 0.8);
    g.fillStyle = BLACK;
    g.fillRect(cx - w / 2 + 0.4, y - 1.7, w - 0.8, 1.3);
    slope(g, cx, y - 3.6, w, 2.4, JROOF, 1.4, w * 0.14, 0.7);
    rect(g, cx - w * 0.32, y - 8.4, w * 0.64, 2.6, PLASTER, 0.7);
    slope(g, cx, y - 8, w * 0.64, 2.8, JROOF, 1.4, w * 0.16, 0.7);
  }
  // 町屋：临街一面，下截黑木格子、上截白壁，黛瓦；脚在 y，宽 w，高 h
  function machiya(g, x, y, w, h, roof = JROOF_L) {
    rect(g, x - w / 2, y - h, w, h, PLASTER, 0.8);
    g.fillStyle = WOOD_D;
    g.fillRect(x - w / 2 + 0.4, y - h * 0.56, w - 0.8, h * 0.56 - 0.4);
    g.strokeStyle = 'rgba(170,150,124,0.7)';
    g.lineWidth = 0.5;
    for (let xx = x - w / 2 + 1.4; xx < x + w / 2 - 0.8; xx += 1.5) {
      g.beginPath();
      g.moveTo(xx, y - h * 0.56);
      g.lineTo(xx, y - 0.4);
      g.stroke();
    }
    slope(g, x, y - h + 0.5, w, 3.4, roof, 1.5, w * 0.1, 0.8);
  }
  // 楼门（二重门）：下层朱柱、黑门洞，上层一间小阁；脚在 y，宽 w
  function roumon(g, x, y, w, roof = JROOF, body = VERM) {
    rect(g, x - w / 2, y - 5, w, 5, body, 0.8);
    g.fillStyle = ink(0.88);
    g.fillRect(x - w * 0.16, y - 4.4, w * 0.32, 4.4);
    slope(g, x, y - 4.6, w, 2.6, roof, 1.6, w * 0.12, 0.8);
    rect(g, x - w * 0.36, y - 9.8, w * 0.72, 3, body, 0.7);
    slope(g, x, y - 9.3, w * 0.72, 3.2, roof, 1.8, w * 0.14, 0.8);
  }
  // 门（棟门）：两柱、黑门洞、一道小顶；old 朱柱桧皮
  function gateJ(g, x, y, w, old) {
    rect(g, x - w / 2, y - 5.5, w, 5.5, old ? VERM : WOOD_D, 0.8);
    g.fillStyle = ink(0.9);
    g.fillRect(x - w * 0.3, y - 4.8, w * 0.6, 4.8);
    slope(g, x, y - 5, w, 3, old ? BARK : JROOF, 2, w * 0.14, 0.8);
  }
  // 塔（日本）：朱红塔身细、檐深；顶上相轮。脚在 y，levels 重，底宽 w
  function jPagoda(g, x, y, levels, w) {
    let top = y;
    for (let i = 0; i < levels; i++) {
      const ww = w * (1 - i * 0.055), bh = 2.3;
      rect(g, x - ww * 0.3, top - bh, ww * 0.6, bh, VERM, 0.6);
      slope(g, x, top - bh + 0.3, ww * 0.6, 2.1, JROOF, ww * 0.22, ww * 0.06, 0.7);
      top -= bh + 2.1 - 0.3;
    }
    g.strokeStyle = ink(0.9);
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x, top - 7);
    g.stroke();
    g.lineWidth = 0.7;
    for (let k = 1; k <= 4; k++) {
      g.beginPath();
      g.moveTo(x - 1.3, top - k * 1.3);
      g.lineTo(x + 1.3, top - k * 1.3);
      g.stroke();
    }
  }
  // 鸟居：两根朱柱，一道贯、一道岛木，上压两头上翘出挑的黑笠木；脚在 y，宽 w、高 h
  function torii(g, x, y, w, h) {
    const px = w * 0.34;
    g.fillStyle = VERM;
    g.fillRect(x - px - 0.9, y - h, 1.8, h);
    g.fillRect(x + px - 0.9, y - h, 1.8, h);
    g.fillRect(x - w * 0.42, y - h * 0.7, w * 0.84, 1.3);
    g.fillRect(x - w * 0.44, y - h + 0.6, w * 0.88, 1.6);
    g.strokeStyle = ink(0.85);
    g.lineWidth = 0.6;
    g.strokeRect(x - px - 0.9, y - h, 1.8, h);
    g.strokeRect(x + px - 0.9, y - h, 1.8, h);
    g.beginPath();
    g.moveTo(x - w / 2 - 0.5, y - h - 1.6);
    g.quadraticCurveTo(x, y - h + 0.2, x + w / 2 + 0.5, y - h - 1.6);
    g.lineTo(x + w / 2 - 0.2, y - h + 0.1);
    g.quadraticCurveTo(x, y - h + 1.6, x - w / 2 + 0.2, y - h + 0.1);
    g.closePath();
    g.fillStyle = BLACK;
    g.fill();
  }
  // 土蔵：白壁，下截黑底的海鼠壁（斜白格），一扇小窗，黛瓦两坡；脚在 y
  function kura(g, x, y, w, h) {
    rect(g, x - w / 2, y - h, w, h, PLASTER, 0.8);
    g.fillStyle = BLACK;
    g.fillRect(x - w / 2 + 0.4, y - h * 0.42, w - 0.8, h * 0.42 - 0.4);
    g.strokeStyle = 'rgba(236,232,222,0.75)';
    g.lineWidth = 0.5;
    for (let xx = x - w / 2 + 1.6; xx < x + w / 2 - 0.6; xx += 1.8) {
      g.beginPath();
      g.moveTo(xx, y - h * 0.42);
      g.lineTo(xx - 1.2, y - 0.4);
      g.stroke();
    }
    g.fillStyle = ink(0.85);
    g.fillRect(x - 1, y - h + 1.4, 2, 1.6);
    slope(g, x, y - h + 0.5, w, 3, JROOF, 1.3, w * 0.08, 0.8);
  }
  // 弁才船：平底宽身，船头翘起、船尾高起一截；一根桅、一张横张的帆（几道竖缝，下沿兜风）。吃水线 y，长 w，头朝左
  function bezaisen(g, x, y, w, sail = SAIL) {
    const L = x - w / 2, R = x + w / 2, mx = x - 1;
    poly(g, [[L, y - 4.6], [L + 4, y], [R - 2, y], [R, y - 3], [R, y - 5.6], [R - 4.6, y - 5.6], [R - 4.6, y - 3.2], [L + 2.4, y - 3.2]], HULL, 0.8);
    g.strokeStyle = ink(0.9);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(mx, y - 3.2);
    g.lineTo(mx, y - 3.4 - w * 0.95);
    g.stroke();
    const sw = w * 0.62, top = y - 3.4 - w * 0.88, bot = y - 6, mid = (top + bot) / 2;
    g.beginPath();
    g.moveTo(mx - sw / 2, top);
    g.lineTo(mx + sw / 2, top);
    g.quadraticCurveTo(mx + sw / 2 + 1.2, mid, mx + sw / 2, bot);
    g.lineTo(mx - sw / 2, bot);
    g.quadraticCurveTo(mx - sw / 2 + 1.2, mid, mx - sw / 2, top);
    g.closePath();
    g.fillStyle = sail;
    g.fill();
    g.lineWidth = 0.8;
    g.stroke();
    g.strokeStyle = ink(0.3);
    g.lineWidth = 0.5;
    for (let xx = mx - sw / 2 + 2; xx < mx + sw / 2 - 0.5; xx += 2) {
      g.beginPath();
      g.moveTo(xx, top + 0.5);
      g.lineTo(xx, bot - 0.5);
      g.stroke();
    }
    g.strokeStyle = ink(0.9);
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(mx - sw / 2 - 0.5, top);
    g.lineTo(mx + sw / 2 + 0.5, top);
    g.stroke();
  }
  // 常夜灯：石座、灯柱、亮着的灯室、宝形小顶
  function lantern(g, x, y) {
    rect(g, x - 2, y - 2.5, 4, 2.5, JSTONE, 0.7);
    rect(g, x - 1, y - 9, 2, 6.5, JSTONE, 0.6);
    rect(g, x - 2, y - 11.5, 4, 2.5, 'rgba(250,228,160,0.95)', 0.6);
    poly(g, [[x - 3, y - 11.5], [x, y - 14], [x + 3, y - 11.5]], JSTONE, 0.6);
  }
  // 火の見櫓：四根高柱（看去两根）、几道斜撑，顶上一层台、宝形小顶，台下悬一口半钟
  function fireTower(g, x, y, h) {
    g.strokeStyle = 'rgba(96,74,56,0.97)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - 3.2, y);
    g.lineTo(x - 1.6, y - h);
    g.moveTo(x + 3.2, y);
    g.lineTo(x + 1.6, y - h);
    g.stroke();
    g.lineWidth = 0.6;
    for (let k = 0; k < 3; k++) {
      const y0 = y - h * k / 3, y1 = y - h * (k + 1) / 3, w0 = 3.2 - 1.6 * k / 3, w1 = 3.2 - 1.6 * (k + 1) / 3;
      g.beginPath();
      g.moveTo(x - w0, y0);
      g.lineTo(x + w1, y1);
      g.moveTo(x + w0, y0);
      g.lineTo(x - w1, y1);
      g.stroke();
    }
    rect(g, x - 3, y - h - 1.4, 6, 1.4, WOOD, 0.6);
    poly(g, [[x - 3.8, y - h - 1.4], [x, y - h - 5.2], [x + 3.8, y - h - 1.4]], JROOF, 0.7);
    blob(g, x, y - h + 1.4, 1, 1.3, BRONZE);
  }
  // 农家：板壁，陡的茅草四坡顶，顶上一道短脊；脚在 y，宽 w
  function minka(g, x, y, w, wall = WOOD) {
    const rh = w * 0.42 + 2;
    rect(g, x - w / 2, y - 4, w, 4, wall, 0.8);
    g.fillStyle = ink(0.85);
    g.fillRect(x - 1.6, y - 3.4, 3.2, 3.4);
    slope(g, x, y - 3.5, w, rh, THATCH, 2.4, w * 0.36, 0.9);
    rect(g, x - w * 0.14 - 0.8, y - 3.5 - rh - 1.2, w * 0.28 + 1.6, 1.4, JROOF, 0.5);
  }
  // 杉：一根干，两层下宽上窄的尖冠
  function sugi(g, x, y, s = 1) {
    trunk(g, x, y, y - 9 * s, 0.4, 1.8 * s);
    poly(g, [[x - 4.6 * s, y - 7 * s], [x, y - 21 * s], [x + 4.6 * s, y - 7 * s]], DEEP_A, 0.7);
    poly(g, [[x - 3.4 * s, y - 15 * s], [x, y - 27 * s], [x + 3.4 * s, y - 15 * s]], DEEP_A, 0.7);
  }
  // 安土以前的人家：土墙，草葺或桧皮的顶
  function oldHouse(g, x, y, w, roof) {
    rect(g, x - w / 2, y - 3.6, w, 3.6, EARTH_W, 0.8);
    g.fillStyle = ink(0.8);
    g.fillRect(x - 1.4, y - 3, 2.8, 3);
    slope(g, x, y - 3.2, w, 4, roof, 2, w * 0.2, 0.8);
  }
  // 国衙的殿：朱柱、桧皮大顶；脚在 y，宽 w
  function kokuden(g, x, y, w, roof = BARK) {
    rect(g, x - w / 2, y - 5, w, 5, VERM, 0.8);
    g.fillStyle = ink(0.5);
    for (let xx = x - w / 2 + 3; xx < x + w / 2 - 1; xx += 3.5) g.fillRect(xx, y - 4.6, 0.8, 4.6);
    slope(g, x, y - 4.6, w, w * 0.22 + 2, roof, 2.6, w * 0.2, 0.9);
  }
  // 望楼：四根高柱（看去两根）、两道斜撑，上一层台、桧皮小顶
  function watchTower(g, x, y, h) {
    g.strokeStyle = 'rgba(110,86,64,0.97)';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(x - 2.8, y);
    g.lineTo(x - 2.2, y - h);
    g.moveTo(x + 2.8, y);
    g.lineTo(x + 2.2, y - h);
    g.stroke();
    g.lineWidth = 0.6;
    for (let k = 0; k < 2; k++) {
      const y0 = y - h * k / 2, y1 = y - h * (k + 1) / 2;
      g.beginPath();
      g.moveTo(x - 2.6, y0);
      g.lineTo(x + 2.4, y1);
      g.moveTo(x + 2.6, y0);
      g.lineTo(x - 2.4, y1);
      g.stroke();
    }
    rect(g, x - 3.6, y - h - 3.2, 7.2, 3.2, WOOD, 0.7);
    slope(g, x, y - h - 2.8, 7.2, 3.2, BARK, 1.4, 1.6, 0.7);
  }
  // 市棚：两根细柱上一道顶，棚下摆着货
  function stall(g, x, y, w, roof) {
    g.strokeStyle = 'rgba(110,86,64,0.95)';
    g.lineWidth = 0.9;
    g.beginPath();
    for (const dx of [-w / 2 + 1, w / 2 - 1]) {
      g.moveTo(x + dx, y);
      g.lineTo(x + dx, y - 4.4);
    }
    g.stroke();
    for (let k = 0; k < 3; k++) blob(g, x - w / 2 + 3 + k * (w - 6) / 2, y - 1, 1.6, 1.1, 'rgba(176,140,96,0.95)');
    slope(g, x, y - 4, w, 3.6, roof, 1.8, w * 0.18, 0.8);
  }

  // ---------- 朝鲜的器件 ----------
  // 邑城：一圈圆转的石城。远处那半圈（ringBack）只露一道细墙头，近处这半圈（ringFront）高、城头一排女墙。
  // 城圈心 cx,cy，半径 rx、ry，墙高 h
  function ringBack(g, cx, cy, rx, ry, h) {
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
    g.ellipse(cx, cy - h, rx, ry, 0, Math.PI * 2, Math.PI, true);
    g.closePath();
    g.fillStyle = KSTONE;
    g.fill();
    g.strokeStyle = ink(0.75);
    g.lineWidth = 0.8;
    g.stroke();
  }
  function ringFront(g, cx, cy, rx, ry, h, r) {
    g.save();
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    g.ellipse(cx, cy - h, rx, ry, 0, Math.PI, 0, true);
    g.closePath();
    g.fillStyle = KSTONE;
    g.fill();
    g.strokeStyle = ink(0.85);
    g.lineWidth = 1;
    g.stroke();
    g.clip();
    g.strokeStyle = ink(0.28);
    g.lineWidth = 0.5;
    for (let k = 0; k < 46; k++) {
      const a = r() * Math.PI, x = cx + rx * Math.cos(a), yy = cy + ry * Math.sin(a) - r() * h;
      g.beginPath();
      g.moveTo(x - 1.3, yy);
      g.lineTo(x + 1.3, yy);
      g.stroke();
    }
    g.restore();
    g.fillStyle = KSTONE;
    g.strokeStyle = ink(0.7);
    g.lineWidth = 0.5;
    for (let a = 0.04; a < 0.97; a += 0.042) {
      const x = cx + rx * Math.cos(a * Math.PI), y = cy - h + ry * Math.sin(a * Math.PI);
      g.fillRect(x - 0.9, y - 1.8, 1.8, 1.9);
      g.strokeRect(x - 0.9, y - 1.8, 1.8, 1.9);
    }
  }
  // 虹霓门：石砌门台（高出城墙一截），半圆拱的门洞，台上丹青门楼（tiers 重檐）；脚在 y，台宽 w、台高 th
  function kGate(g, x, y, w, tiers, th = 9) {
    rect(g, x - w / 2, y - th, w, th, KSTONE, 0.9);
    g.fillStyle = ink(0.9);
    g.beginPath();
    g.moveTo(x - 2.2, y);
    g.lineTo(x - 2.2, y - 4.4);
    g.arc(x, y - 4.4, 2.2, Math.PI, 0);
    g.lineTo(x + 2.2, y);
    g.closePath();
    g.fill();
    let top = y - th;
    for (let i = 0; i < tiers; i++) {
      const ww = (w + 1) * (1 - i * 0.22);
      rect(g, x - ww / 2 + 1.2, top - 3.4, ww - 2.4, 3.4, KPILLAR, 0.7);
      g.fillStyle = KGREEN;
      g.fillRect(x - ww / 2 + 1.6, top - 3.4, ww - 3.2, 1.1);
      curved(g, x, top - 3, ww, 4.2, KROOF, 3, 0.48, 0.8);
      top -= 3.4 + 4.2 - 0.8;
    }
  }
  // 瓦房：白墙、木柱，黛瓦翘角；脚在 y，宽 w、墙高 h
  function hanok(g, x, y, w, h = 4) {
    rect(g, x - w / 2, y - h, w, h, KWALL, 0.8);
    g.fillStyle = 'rgba(132,100,76,0.9)';
    for (let k = 0; k <= 3; k++) g.fillRect(x - w / 2 + k * (w - 0.9) / 3, y - h, 0.9, h);
    curved(g, x, y - h + 0.5, w, 4, KROOF, 2.4, 0.42, 0.8);
  }
  // 草房：土墙，圆鼓鼓的草顶，几道草绳
  function choga(g, x, y, w, h = 3.6) {
    const rh = w * 0.42;
    rect(g, x - w / 2, y - h, w, h, KEARTH, 0.8);
    g.fillStyle = ink(0.8);
    g.fillRect(x - 1.2, y - h * 0.8, 2.4, h * 0.8);
    g.beginPath();
    g.moveTo(x - w / 2 - 1.5, y - h + 0.8);
    g.quadraticCurveTo(x - w / 2 - 0.6, y - h - rh, x, y - h - rh);
    g.quadraticCurveTo(x + w / 2 + 0.6, y - h - rh, x + w / 2 + 1.5, y - h + 0.8);
    g.closePath();
    g.fillStyle = KTHATCH;
    g.fill();
    g.strokeStyle = ink(0.8);
    g.lineWidth = 0.8;
    g.stroke();
    g.strokeStyle = ink(0.3);
    g.lineWidth = 0.5;
    for (const t of [-0.25, 0, 0.25]) {
      g.beginPath();
      g.moveTo(x + t * w, y - h - rh * 0.95);
      g.lineTo(x + t * w * 1.5, y - h + 0.4);
      g.stroke();
    }
  }
  // 殿、官衙：石台（base 高，0 为无）上朱褐柱身、额枋一道青绿，黛瓦翘角大顶，tiers 重檐；脚在 y，身宽 w
  function kHall(g, x, y, w, bh = 5, rh = 6, base = 2.4, tiers = 1) {
    if (base) rect(g, x - w / 2 - 2, y - base, w + 4, base, KSTONE, 0.8);
    let top = y - base;
    for (let i = 0; i < tiers; i++) {
      const ww = w * (1 - i * 0.3), hh = i ? bh * 0.6 : bh, rr = i ? rh * 0.75 : rh;
      rect(g, x - ww / 2, top - hh, ww, hh, KPILLAR, 0.8);
      g.fillStyle = KGREEN;
      g.fillRect(x - ww / 2 + 0.4, top - hh, ww - 0.8, 1.2);
      curved(g, x, top - hh + 0.6, ww, rr, KROOF, 3, 0.45, 0.9);
      top -= hh + rr - 0.6;
    }
  }
  // 门屋（三门）：一间小屋，当中黑门洞；脚在 y
  function samun(g, x, y, w) {
    kHall(g, x, y, w, 3.6, 3.8, 0, 1);
    g.fillStyle = ink(0.9);
    g.fillRect(x - 1.5, y - 3.4, 3, 3.4);
  }
  // 红箭门：两根朱柱，上下两道横木，横木间一排箭尖，当中一个太极；脚在 y，宽 w、高 h
  function hongsal(g, x, y, w, h) {
    g.fillStyle = KPILLAR;
    g.fillRect(x - w / 2, y - h, 1.6, h);
    g.fillRect(x + w / 2 - 1.6, y - h, 1.6, h);
    g.fillRect(x - w / 2 - 0.5, y - h, w + 1, 1.3);
    g.strokeStyle = KPILLAR;
    g.lineWidth = 0.8;
    for (let xx = x - w / 2 + 1.8; xx < x + w / 2 - 1.2; xx += 1.7) {
      g.beginPath();
      g.moveTo(xx, y - h);
      g.lineTo(xx, y - h - 3.4);
      g.stroke();
    }
    blob(g, x, y - h - 1.6, 1.7, 1.7, 'rgba(48,72,150,0.96)');
    blob(g, x, y - h - 2.3, 1.7, 1, 'rgba(196,52,44,0.96)');
  }
  // 石塔（三层）：基坛、三层塔身，每层一道薄而宽的屋盖石，顶上相轮
  function stonePagoda(g, x, y, s = 1) {
    rect(g, x - 4 * s, y - 3 * s, 8 * s, 3 * s, KSTONE, 0.7);
    let top = y - 3 * s;
    for (let i = 0; i < 3; i++) {
      const w = (4.2 - i * 0.7) * s, h = (i ? 2 : 3) * s;
      rect(g, x - w / 2, top - h, w, h, KSTONE, 0.6);
      poly(g, [[x - w / 2 - 2.4 * s, top - h], [x - w / 2 - 1.4 * s, top - h - 1.4 * s], [x + w / 2 + 1.4 * s, top - h - 1.4 * s], [x + w / 2 + 2.4 * s, top - h]], 'rgba(176,174,164,0.98)', 0.6);
      top -= h + 1.4 * s;
    }
    g.strokeStyle = ink(0.85);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x, top - 3.5 * s);
    g.stroke();
  }
  // 瓮（酱缸）：褐釉的圆身、口沿，一点釉光
  function onggi(g, x, y, s = 1) {
    g.beginPath();
    g.ellipse(x, y - 2.2 * s, 2.2 * s, 2.3 * s, 0, 0, Math.PI * 2);
    g.fillStyle = JAR;
    g.fill();
    g.strokeStyle = ink(0.8);
    g.lineWidth = 0.6;
    g.stroke();
    g.fillStyle = 'rgba(70,50,40,0.97)';
    g.fillRect(x - 1.2 * s, y - 4.8 * s, 2.4 * s, 0.9 * s);
    blob(g, x - 0.8 * s, y - 3 * s, 0.6 * s, 0.9 * s, 'rgba(176,146,116,0.6)');
  }
  // 白布棚：两根细柱，上蒙一块微斜的白布
  function awning(g, x, y, w, h) {
    g.strokeStyle = ink(0.85);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x - w / 2 + 1, y);
    g.lineTo(x - w / 2 + 1, y - h);
    g.moveTo(x + w / 2 - 1, y);
    g.lineTo(x + w / 2 - 1, y - h + 1);
    g.stroke();
    poly(g, [[x - w / 2 - 1, y - h + 0.4], [x - w / 2 + 1, y - h - 1.6], [x + w / 2 + 1, y - h - 0.6], [x + w / 2 + 1.6, y - h + 1.4]], WHITE_CLOTH, 0.7);
  }
  // 船（朝鲜）：平身，一根桅、一张方帆（白布或草席，几道横骨）。吃水线 y，长 w
  function kBoat(g, x, y, w, sail) {
    poly(g, [[x - w / 2, y - 3.6], [x - w / 2 + 2.4, y], [x + w / 2 - 2, y], [x + w / 2, y - 3.6]], HULL, 0.8);
    g.strokeStyle = ink(0.9);
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x, y - 3.4);
    g.lineTo(x, y - 3.4 - w * 0.9);
    g.stroke();
    const sw = w * 0.46, top = y - 3.4 - w * 0.82, bot = y - 5;
    poly(g, [[x - sw / 2, top], [x + sw / 2, top + 0.6], [x + sw / 2 + 0.6, bot], [x - sw / 2 + 0.4, bot]], sail, 0.7);
    g.strokeStyle = ink(0.35);
    g.lineWidth = 0.5;
    for (let yy = top + 2.2; yy < bot - 0.5; yy += 2.2) {
      g.beginPath();
      g.moveTo(x - sw / 2 + 0.2, yy);
      g.lineTo(x + sw / 2 + 0.3, yy + 0.3);
      g.stroke();
    }
  }
  // 楼（书院门前那样的楼）：几根石柱架起，上层朱柱、额枋青绿，黛瓦翘角；脚在 y，宽 w
  function nugak(g, x, y, w) {
    g.fillStyle = KSTONE;
    g.strokeStyle = ink(0.75);
    g.lineWidth = 0.6;
    for (const dx of [-w / 2 + 0.6, -w / 6, w / 6 - 1.6, w / 2 - 2.2]) {
      g.fillRect(x + dx, y - 5, 1.6, 5);
      g.strokeRect(x + dx, y - 5, 1.6, 5);
    }
    rect(g, x - w / 2, y - 9, w, 4, KPILLAR, 0.8);
    g.fillStyle = KGREEN;
    g.fillRect(x - w / 2 + 0.4, y - 9, w - 0.8, 1.1);
    g.strokeStyle = ink(0.6);
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(x - w / 2, y - 6.4);
    g.lineTo(x + w / 2, y - 6.4);
    g.stroke();
    curved(g, x, y - 8.4, w, 5, KROOF, 3, 0.48, 0.9);
  }
  // 银杏：直干，几团黄绿叠成宽冠，冠上撒墨点
  function ginkgo(g, x, y, s, r) {
    trunk(g, x, y, y - 9 * s, 0.6, 2.2 * s);
    blob(g, x, y - 14 * s, 7.5 * s, 6.2 * s, 'rgba(168,158,72,0.95)');
    blob(g, x - 2.6 * s, y - 16 * s, 4.6 * s, 3.8 * s, 'rgba(210,192,92,0.95)');
    blob(g, x + 2.8 * s, y - 13 * s, 4 * s, 3.2 * s, 'rgba(196,180,84,0.95)');
    for (let k = 0; k < 8; k++) blob(g, x + (r() - 0.5) * 12 * s, y - 14 * s + (r() - 0.5) * 9 * s, 0.9, 0.7, ink(0.45));
  }

  // ======================= 日本 =======================
  // 阵屋、府城：小石垣上二重的小天守，白土塀；前头城下町屋，旁一株松
  function jpS(g) {
    pine(g, 54, 50, 0.85);
    ishigaki(g, 30, 50, 24, 7, 17);
    tenshu(g, 30, 43, 13, 2);
    cappedWall(g, 14, 46, 54, 3, PLASTER);
    for (const [x, y, w] of [[8, 61, 12], [20, 62, 10], [41, 62, 11], [54, 61, 12]]) machiya(g, x, y, w, 5.5);
  }
  // 大府、都会：堀、高石垣，四重天守（千鸟破风），两角隅櫓；前头町屋一片
  function jpL(g) {
    pine(g, 6, 47, 0.8);
    pine(g, 58, 46, 0.8);
    ishigaki(g, 32, 50, 38, 9, 29);
    yagura(g, 19.5, 41, 7);
    yagura(g, 44.5, 41, 7);
    tenshu(g, 32, 41, 16, 4);
    water(g, 4, 60, 53.5, 3.5);
    for (const [x, y, w] of [[6, 62, 10], [17, 61, 11], [28, 62, 9], [38, 62, 10], [49, 61, 11], [59, 62, 9]]) machiya(g, x, y, w, 5);
  }
  // 幕府所在：二之丸宽而矮的石垣、本丸高石垣，五重大天守，四座隅櫓；大堀；前头大名屋敷的白墙与町屋
  function jpCap(g) {
    ishigaki(g, 32, 51, 60, 5, 54);
    yagura(g, 7, 46, 7);
    yagura(g, 57, 46, 7);
    ishigaki(g, 32, 46, 36, 8, 28);
    yagura(g, 20, 38, 6);
    yagura(g, 44, 38, 6);
    tenshu(g, 32, 38, 18, 5);
    water(g, 1, 63, 55, 4);
    slope(g, 15.5, 57.8, 22, 3, JROOF, 1.4, 4, 0.8);
    cappedWall(g, 3, 28, 61, 3.4, PLASTER);
    for (const [x, w] of [[36, 9], [46, 10], [57, 11]]) machiya(g, x, 62, w, 5);
  }
  // 町（宿场町）：后排町屋，前排町屋当中留街口，街口一座小鸟居；东头火の見櫓
  function jpMarket(g) {
    for (const [x, w] of [[9, 12], [21, 11], [33, 12], [45, 11]]) machiya(g, x, 53, w, 6);
    fireTower(g, 57, 62, 30);
    for (const [x, w] of [[8, 13], [20, 10], [40, 11]]) machiya(g, x, 62, w, 6.5);
    torii(g, 30, 62, 8, 9);
  }
  // 湊：岸上两座土蔵、一座常夜灯；木栈伸进海里，一只弁才船泊着。old 安土以前：草葺的仓，没有常夜灯，席帆
  function port(g, old) {
    pool(g, 42, 60, 22, 4);
    if (old) {
      oldHouse(g, 10, 58, 14, THATCH);
      oldHouse(g, 21, 60, 10, THATCH);
    } else {
      kura(g, 9, 58, 12, 9);
      kura(g, 20, 60, 9, 7);
      lantern(g, 28, 60);
    }
    pier(g, 25, 47, 56.5);
    bezaisen(g, 47, 61.5, 20, old ? MAT : SAIL);
  }
  // 寺：白土塀（安土以前筑地塀）一圈，南面二重楼门；深檐黑木的本堂；东侧朱红五重塔（安土以前七重）；西头一株松
  function temple(g, levels, old) {
    pine(g, 7, 56, 0.85);
    jPagoda(g, 51, 57, levels, 10);
    rect(g, 15, 49, 22, 7, WOOD_D, 0.9);
    slope(g, 26, 49.5, 22, 8, JROOF, 3.4, 5.6, 1);
    cappedWall(g, 4, 60, 61, 4, old ? TSUIJI : PLASTER);
    roumon(g, 28, 61, 11);
  }
  // 社：社叢深绿一片；朱红本殿（桧皮顶、千木）在后，拝殿在前，前头一座大鸟居
  function jpShrine(g, r) {
    for (const [x, y, s] of [[10, 52, 1.1], [54, 52, 1.1], [20, 46, 0.9], [44, 46, 0.9], [32, 42, 0.8]]) tuft(g, x, y, s, r);
    rect(g, 23, 46, 18, 6, VERM, 0.8);
    slope(g, 32, 46.5, 18, 5, BARK, 2.4, 3.4, 0.9);
    g.strokeStyle = ink(0.9);
    g.lineWidth = 1;
    for (const sx of [-1, 1]) {
      const xx = 32 + sx * 5.6;
      g.beginPath();
      g.moveTo(xx - 1.6, 38.9);
      g.lineTo(xx + 1.6, 42.1);
      g.moveTo(xx + 1.6, 38.9);
      g.lineTo(xx - 1.6, 42.1);
      g.stroke();
    }
    rect(g, 17, 54, 30, 5, VERM, 0.8);
    slope(g, 32, 54.5, 30, 5, BARK, 2.6, 5, 0.9);
    torii(g, 32, 63, 18, 13);
  }
  // 学（藩校）：白土塀一圈、门；讲堂在前，黑漆的圣堂（两重檐）在后；门内两株松。old 国学（安土以前）：筑地塀，朱柱桧皮，圣堂单檐
  function academy(g, old) {
    pine(g, 9, 58, 0.9);
    pine(g, 55, 58, 0.85);
    rect(g, 24, 39, 16, 7, old ? VERM : BLACK, 0.8);
    slope(g, 32, 39.5, 16, 3.6, old ? BARK : JROOF, 2.2, 2.4, 0.8);
    if (!old) {
      rect(g, 27, 33.6, 10, 2.8, BLACK, 0.7);
      slope(g, 32, 34, 10, 3.4, JROOF, 2, 2.2, 0.8);
    }
    rect(g, 13, 48, 38, 8, old ? VERM : WOOD_D, 0.9);
    slope(g, 32, 48.5, 38, 6, old ? BARK : JROOF, 2.8, 7, 0.9);
    cappedWall(g, 8, 56, 61.5, 4, old ? TSUIJI : PLASTER);
    gateJ(g, 32, 61.5, 7, old);
  }
  // 砦（出城）：堀（南面一道土桥）、石垣台，台上白土塀、两座隅櫓、三重的小天守
  function jpFort(g) {
    ishigaki(g, 32, 57, 46, 9, 38);
    water(g, 2, 62, 61, 4);
    rect(g, 29, 57, 6, 4, 'rgba(178,148,104,0.98)', 0.7);
    cappedWall(g, 15, 49, 48, 2.4, PLASTER);
    yagura(g, 16, 48, 7);
    yagura(g, 48, 48, 7);
    tenshu(g, 32, 47, 15, 3);
  }
  // 代官所（奉行所）：主屋黑木、黛瓦大顶在后；前头长屋门（白壁、下截黑板、当中门洞）；门外一块高札；院里一株松
  function jpYamen(g) {
    pine(g, 9, 52, 0.85);
    rect(g, 17, 45, 28, 8, WOOD_D, 0.9);
    slope(g, 31, 45.5, 28, 8, JROOF, 3.2, 6.4, 1);
    rect(g, 4, 54, 48, 7, PLASTER, 0.9);
    g.fillStyle = BLACK;
    g.fillRect(4.4, 57.6, 47.2, 3);
    g.fillStyle = ink(0.75);
    for (const x of [8, 13, 18, 39, 44, 49]) g.fillRect(x - 1, 55.2, 2, 1.4);
    g.fillStyle = ink(0.92);
    g.fillRect(24, 55.4, 8, 5.6);
    slope(g, 28, 54.5, 48, 4, JROOF, 2.2, 3, 0.9);
    // 高札：两柱一块白板，上一道小顶
    g.fillStyle = WOOD_D;
    g.fillRect(55.4, 54, 1, 8);
    g.fillRect(61, 54, 1, 8);
    rect(g, 54.6, 53.4, 8.2, 4.4, PLASTER, 0.6);
    slope(g, 58.7, 53.6, 8.2, 2, JROOF, 1, 0.8, 0.6);
  }
  // 日本村：一座茅草农家、一座小土蔵，屋后一株杉
  function jpHamlet(g) {
    sugi(g, 50, 60, 1);
    minka(g, 24, 60, 22);
    kura(g, 42, 62, 9, 7);
  }

  // ======================= 日本（安土以前） =======================
  // 国府（小）：筑地塀围着国衙（朱柱、桧皮顶），门；四外草葺、桧皮的人家，一株树
  function joS(g, r) {
    tuft(g, 54, 52, 0.8, r);
    kokuden(g, 31, 50, 20);
    cappedWall(g, 15, 47, 54, 3.2, TSUIJI);
    gateJ(g, 31, 54, 6, true);
    for (const [x, y, w, roof] of [[8, 61, 12, THATCH], [20, 62, 10, BARK], [42, 62, 11, THATCH], [55, 61, 11, BARK]]) oldHouse(g, x, y, w, roof);
  }
  // 国府（大）：国衙更大、带一厢，旁边国分寺的七重塔；人家成片
  function joL(g) {
    jPagoda(g, 53, 51, 7, 9);
    kokuden(g, 10, 50, 10);
    kokuden(g, 28, 47, 26);
    cappedWall(g, 4, 44, 52, 3.4, TSUIJI);
    gateJ(g, 24, 52, 7, true);
    for (const [x, y, w, roof] of [[7, 61, 11, THATCH], [18, 62, 10, BARK], [29, 61, 10, THATCH], [40, 62, 11, BARK], [52, 61, 11, THATCH], [61, 62, 8, BARK]]) oldHouse(g, x, y, w, roof);
  }
  // 平安京：北头台上大极殿（朱柱、青瓦、鸱尾）；筑地塀一道，当中朱雀门（二重楼门、青瓦）；东头东寺五重塔；前头条坊人家
  function joCap(g) {
    jPagoda(g, 57, 52, 5, 8);
    rect(g, 12, 40, 34, 2.6, 'rgba(214,204,176,0.98)', 0.8);
    rect(g, 15, 34.5, 28, 5.5, VERM, 0.8);
    g.fillStyle = ink(0.5);
    for (let x = 18; x < 42; x += 3.4) g.fillRect(x, 35, 0.8, 5);
    slope(g, 29, 35, 28, 7.5, JGREEN, 3.6, 6.4, 1);
    for (const sx of [-1, 1]) blob(g, 29 + sx * 7.4, 27.2, 1, 1.5, BLACK);
    kokuden(g, 7, 49, 10, JGREEN);
    kokuden(g, 47, 49, 9, JGREEN);
    cappedWall(g, 1, 63, 54, 3.6, TSUIJI);
    roumon(g, 32, 56.5, 16, JGREEN);
    for (const [x, w, roof] of [[7, 11, BARK], [18, 10, THATCH], [46, 10, BARK], [57, 11, THATCH]]) oldHouse(g, x, 62.5, w, roof);
  }
  // 市（安土以前）：后排桧皮、草葺的人家，前头两处市棚，挑一面市旗，旁一株树
  function joMarket(g, r) {
    tuft(g, 8, 52, 0.85, r);
    for (const [x, w, roof] of [[22, 12, BARK], [35, 11, THATCH], [48, 12, BARK]]) oldHouse(g, x, 53, w, roof);
    stall(g, 14, 62, 13, THATCH);
    oldHouse(g, 30, 62, 11, THATCH);
    stall(g, 45, 62, 13, BARK);
    banner(g, 58, 62, 20);
  }
  // 城柵：外一圈木栅，南面二重楼门；栅里国衙；栅角两座望楼
  function joFort(g) {
    kokuden(g, 32, 50, 22);
    watchTower(g, 9, 58, 17);
    watchTower(g, 55, 58, 17);
    palisade(g, 2, 62, 61, 9);
    roumon(g, 32, 61, 11, BARK, WOOD);
  }
  // 官署（安土以前）：国衙，筑地塀，门，两株树
  function joYamen(g, r) {
    tuft(g, 9, 54, 0.85, r);
    tuft(g, 55, 54, 0.8, r);
    kokuden(g, 32, 52, 26);
    cappedWall(g, 8, 56, 60, 4, TSUIJI);
    gateJ(g, 32, 60, 8, true);
  }

  // ======================= 朝鲜 =======================
  // 邑城（小）：一圈圆转的石城，女墙；城里瓦房、草房；南面虹霓门，台上一重门楼
  function koS(g, r) {
    ringBack(g, 32, 51, 27, 8, 2.4);
    hanok(g, 40, 50, 13, 3.6);
    choga(g, 26, 51, 10, 3.2);
    hanok(g, 15, 53, 11, 3.4);
    choga(g, 50, 54, 9, 3);
    ringFront(g, 32, 51, 27, 8, 5, r);
    kGate(g, 32, 61, 9, 1, 8);
  }
  // 邑城（大）：城圈更大更高，二重门楼；城里客舍高起，瓦房多
  function koL(g, r) {
    ringBack(g, 32, 50, 30, 9, 2.8);
    kHall(g, 45, 48.5, 14, 4, 5.5, 0);
    hanok(g, 16, 49, 12, 3.4);
    hanok(g, 26, 52, 10, 3.2);
    choga(g, 9, 53, 8, 3);
    choga(g, 55, 53, 9, 3);
    choga(g, 38, 54, 9, 3);
    ringFront(g, 32, 50, 30, 9, 6.5, r);
    kGate(g, 32, 61.5, 11, 2, 8.5);
  }
  // 王都（汉阳那样）：城后北岳几座峰；城里宫阙（月台上重檐正殿，两旁行阁）；大城圈，南面崇礼门那样的二重大门楼
  function koCap(g, r) {
    const ridge = [[3, 47], [8, 39], [13, 41], [20, 28], [26, 34], [32, 24], [38, 31], [45, 27], [51, 36], [56, 33], [61, 47]];
    g.beginPath();
    g.moveTo(ridge[0][0], ridge[0][1]);
    for (let i = 1; i < ridge.length; i++) g.lineTo(ridge[i][0], ridge[i][1]);
    g.closePath();
    g.fillStyle = 'rgba(122,146,126,0.94)';
    g.fill();
    g.strokeStyle = ink(0.55);
    g.lineWidth = 0.8;
    g.stroke();
    // 峰上几笔皴
    g.strokeStyle = ink(0.32);
    g.lineWidth = 0.6;
    for (let i = 1; i < ridge.length - 1; i++) {
      const [x, y] = ridge[i];
      if (y > 36) continue;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x + (k - 1) * 1.4, y + 2 + k);
        g.lineTo(x + (k - 1) * 3.2 + (r() - 0.5) * 2, y + 7 + k * 1.5);
        g.stroke();
      }
    }
    ringBack(g, 32, 50, 31, 8.5, 2.8);
    for (const x of [13, 51]) {
      rect(g, x - 7, 41.5, 14, 2.6, KPILLAR, 0.6);
      curved(g, x, 42, 14, 3, KROOF, 2, 0.4, 0.7);
    }
    kHall(g, 32, 43, 20, 4.4, 6, 3.2, 2);
    for (const [x, y, w] of [[11, 51, 10], [52, 51, 10], [21, 53, 8], [44, 53, 9]]) hanok(g, x, y, w, 3);
    ringFront(g, 32, 50, 31, 8.5, 6.5, r);
    kGate(g, 32, 62, 12, 2, 7);
  }
  // 场市：后头瓦房、草房，场院里两处白布棚、一溜酱缸；酒幕挑一面白旗；镇口一株榉树
  function koMarket(g, r) {
    tuft(g, 7, 56, 0.9, r);
    hanok(g, 22, 52, 14, 4);
    choga(g, 42, 52, 12, 3.4);
    awning(g, 20, 62, 14, 7);
    awning(g, 44, 62, 15, 7);
    for (const [x, s] of [[29, 0.9], [33, 1], [37, 0.85]]) onggi(g, x, 62, s);
    flag(g, 57, 62, 20, WHITE_CLOTH);
  }
  // 浦口：岸上瓦仓、草房，木栈伸进海里，两只船（白布帆、草席帆）
  function koPort(g) {
    pool(g, 42, 60, 22, 4);
    hanok(g, 10, 58, 14, 5);
    choga(g, 22, 60, 9, 3.2);
    pier(g, 26, 46, 56.5);
    kBoat(g, 50, 61.5, 14, WHITE_CLOTH);
    kBoat(g, 37, 62.5, 11, KTHATCH);
  }
  // 寺刹：石台上大雄殿（丹青、黛瓦翘角），殿前三层石塔；前头天王门；院墙；一株古树
  function koTemple(g, r) {
    tuft(g, 55, 52, 1, r);
    kHall(g, 28, 53.5, 24, 5, 7, 2.6, 1);
    stonePagoda(g, 50, 58, 1);
    cappedWall(g, 4, 60, 61.5, 3.4, KWALL, KROOF);
    samun(g, 24, 62.5, 11);
  }
  // 祠堂：院墙，南面三门；石台上祠宇（丹青）；门外红箭门；两株树
  function koShrine(g, r) {
    tuft(g, 8, 52, 0.9, r);
    tuft(g, 56, 52, 0.85, r);
    kHall(g, 32, 51, 20, 5, 6.5, 3.4, 1);
    cappedWall(g, 10, 54, 56, 3.4, KWALL, KROOF);
    samun(g, 32, 56.5, 9);
    hongsal(g, 32, 63, 17, 7.5);
  }
  // 书院：前头一座楼（石柱架起、上层敞着），后头讲堂；院墙；院里一株银杏
  function koAcademy(g, r) {
    ginkgo(g, 54, 55, 1, r);
    kHall(g, 30, 50, 24, 5, 6.5, 2.4, 1);
    cappedWall(g, 6, 58, 57, 3, KWALL, KROOF);
    nugak(g, 26, 63, 18);
  }
  // 镇堡：随山势起伏的小石城（城头高低不平），南面虹霓门楼；城里两层将台，一杆帅旗
  function koFort(g, r) {
    kHall(g, 42, 47, 12, 4, 5, 2, 2);
    flag(g, 20, 50, 22, RED_FLAG);
    const top = (x) => 50 - 4 * Math.sin((x - 3) / 58 * Math.PI) - 1.2 * Math.sin((x - 3) / 6);
    g.save();
    g.beginPath();
    g.moveTo(3, 62);
    for (let x = 3; x <= 61; x += 2) g.lineTo(x, top(x));
    g.lineTo(61, 62);
    g.closePath();
    g.fillStyle = KSTONE;
    g.fill();
    g.strokeStyle = ink(0.85);
    g.lineWidth = 1;
    g.stroke();
    g.clip();
    g.strokeStyle = ink(0.28);
    g.lineWidth = 0.5;
    for (let k = 0; k < 40; k++) {
      const x = 3 + r() * 58, yy = top(x) + 1 + r() * (61 - top(x));
      g.beginPath();
      g.moveTo(x - 1.3, yy);
      g.lineTo(x + 1.3, yy);
      g.stroke();
    }
    g.restore();
    g.fillStyle = KSTONE;
    g.strokeStyle = ink(0.7);
    g.lineWidth = 0.5;
    for (let x = 4; x < 60; x += 2.6) {
      g.fillRect(x - 0.9, top(x) - 1.8, 1.8, 1.9);
      g.strokeRect(x - 0.9, top(x) - 1.8, 1.8, 1.9);
    }
    kGate(g, 32, 63, 10, 1, 8);
  }
  // 官衙：石台上东轩（丹青官衙、两旁厢房）；院墙南面三门；门外红箭门；一株树
  function koYamen(g, r) {
    tuft(g, 55, 50, 0.9, r);
    hanok(g, 9, 52, 10, 3.6);
    kHall(g, 30, 50, 28, 5.5, 7, 3, 1);
    cappedWall(g, 4, 58, 57, 3.4, KWALL, KROOF);
    samun(g, 30, 57.5, 10);
    hongsal(g, 30, 63.5, 15, 6.5);
  }
  // 朝鲜村：两座草房，院角两口酱缸，屋后一株树
  function koHamlet(g, r) {
    tuft(g, 49, 54, 0.9, r);
    choga(g, 22, 58, 16, 4);
    choga(g, 40, 62, 12, 3.6);
    onggi(g, 53, 62, 0.8);
    onggi(g, 57, 62, 0.7);
  }

  // ======================= 残城（凋敝或兵燹） =======================
  // 落城：堀与石垣犹在；天守烧得只剩台上一截参差的焦壁、两根焦柱，一股烟；土塀断成几截；前头町屋烧塌了；一株枯树
  function jpRuin(g, r) {
    deadTree(g, 56, 62);
    ishigaki(g, 28, 51, 30, 8, 22);
    poly(g, [[19, 43.2], [19, 37], [22, 35], [24, 38], [27, 33], [30, 37], [33, 35.5], [36, 38.5], [37, 43.2]], CHAR, 0.9);
    g.strokeStyle = ink(0.92);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(22, 43);
    g.lineTo(22.5, 30);
    g.moveTo(33, 43);
    g.lineTo(32.5, 31.5);
    g.stroke();
    smokeCol(g, 27, 33, r);
    water(g, 2, 58, 55, 4);
    for (const [x0, x1, h0, h1] of [[4, 14, 4, 2.5], [20, 30, 5, 3], [40, 52, 3.5, 2]]) ruinWall(g, x0, x1, 58.5, h0, h1, PLASTER, r);
    for (const [x, w] of [[10, 12], [30, 11], [48, 12]]) charredHouse(g, x, 62.5, w);
    rubble(g, 6, 56, 60.5, r);
  }
  // 残府（安土以前）：国衙正殿的台基上一排焦柱、一片塌下的桧皮顶，一股烟；筑地塀断成几截；人家烧塌了；一株枯树
  function joRuin(g, r) {
    deadTree(g, 57, 62);
    rect(g, 10, 46, 36, 3, 'rgba(206,194,166,0.98)', 0.8);
    g.strokeStyle = ink(0.92);
    g.lineWidth = 1.4;
    g.beginPath();
    for (const [x, h] of [[14, 9], [19, 6], [24, 10], [30, 5], [35, 8], [41, 7]]) {
      g.moveTo(x, 46);
      g.lineTo(x, 46 - h);
    }
    g.stroke();
    poly(g, [[27, 41], [44, 37.5], [47, 46], [30, 46]], 'rgba(96,76,62,0.96)', 0.8);
    smokeCol(g, 21, 36, r);
    for (const [x0, x1, h0, h1] of [[3, 15, 5, 3.5], [21, 33, 6, 4], [40, 50, 4.5, 2.5]]) ruinWall(g, x0, x1, 57, h0, h1, TSUIJI, r);
    for (const [x, w] of [[9, 12], [30, 11], [49, 11]]) charredHouse(g, x, 62.5, w);
    rubble(g, 6, 56, 60.5, r);
  }
  // 朝鲜的残城：城圈断成几截，虹霓门的石台、拱洞犹在，门楼烧剩焦柱，一股烟；城里草房烧塌了；一株枯树
  function koRuin(g, r) {
    deadTree(g, 58, 56, 0.85);
    const cut = (ranges, draw) => {
      g.save();
      g.beginPath();
      for (const [x0, x1] of ranges) g.rect(x0, 0, x1 - x0, 64);
      g.clip();
      draw();
      g.restore();
    };
    cut([[4, 20], [27, 40], [46, 60]], () => ringBack(g, 32, 51, 27, 8, 2.4));
    for (const [x, w] of [[18, 10], [40, 11], [28, 9]]) charredHouse(g, x, 52.5, w);
    smokeCol(g, 22, 42, r);
    cut([[4, 13], [19, 45], [51, 60]], () => ringFront(g, 32, 51, 27, 8, 5, r));
    for (const x of [13, 19, 45, 51]) blob(g, x, 54.5 + (x > 30 ? 0.5 : 0), 1.6, 2.6, ink(0.45));
    rect(g, 27.5, 53, 9, 8, KSTONE, 0.9);
    g.fillStyle = ink(0.9);
    g.beginPath();
    g.moveTo(29.8, 61);
    g.lineTo(29.8, 56.6);
    g.arc(32, 56.6, 2.2, Math.PI, 0);
    g.lineTo(34.2, 61);
    g.closePath();
    g.fill();
    g.strokeStyle = ink(0.92);
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(29, 53);
    g.lineTo(29.4, 46.5);
    g.moveTo(35, 53);
    g.lineTo(34.6, 48.5);
    g.stroke();
    rubble(g, 10, 54, 60.5, r, 10, 'rgba(150,146,136,0.92)');
  }

  return {
    jpS, jpL, jpCap, jpMarket, jpPort: (g) => port(g, false), jpTemple: (g) => temple(g, 5, false), jpShrine, jpAcademy: (g) => academy(g, false),
    jpFort, jpYamen, jpHamlet,
    joS, joL, joCap, joMarket, joPort: (g) => port(g, true), joTemple: (g) => temple(g, 7, true), joAcademy: (g) => academy(g, true), joFort, joYamen,
    koS, koL, koCap, koMarket, koPort, koTemple, koShrine, koAcademy, koFort, koYamen, koHamlet,
    jpRuin, joRuin, koRuin
  };
}

// 地域 → { 原样的格名: 当地的格名 }。城郭四档（town、city、grand、metro）分小、大两样，都城（capital）、残城（ruin）各另一样；
// 安土以前的社、村舍与安土以后同画。没列的照原样（仓廒、水利之类各处一样）
export const EAST_SPRITE_LOCAL = {
  japan: {
    town: 'jpS', city: 'jpS', grand: 'jpL', metro: 'jpL', capital: 'jpCap', ruin: 'jpRuin', market: 'jpMarket', port: 'jpPort',
    temple: 'jpTemple', shrine: 'jpShrine', academy: 'jpAcademy', fort: 'jpFort', yamen: 'jpYamen', hamlet: 'jpHamlet', hamletB: 'jpHamlet'
  },
  japanOld: {
    town: 'joS', city: 'joS', grand: 'joL', metro: 'joL', capital: 'joCap', ruin: 'joRuin', market: 'joMarket', port: 'joPort',
    temple: 'joTemple', shrine: 'jpShrine', academy: 'joAcademy', fort: 'joFort', yamen: 'joYamen', hamlet: 'jpHamlet', hamletB: 'jpHamlet'
  },
  korea: {
    town: 'koS', city: 'koS', grand: 'koL', metro: 'koL', capital: 'koCap', ruin: 'koRuin', market: 'koMarket', port: 'koPort',
    temple: 'koTemple', shrine: 'koShrine', academy: 'koAcademy', fort: 'koFort', yamen: 'koYamen', hamlet: 'koHamlet', hamletB: 'koHamlet'
  }
};
